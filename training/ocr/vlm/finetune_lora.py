"""
LoRA Fine-Tuning Script — Self-Expanding Nightly Build
======================================================
Uses Unsloth for 2-5x faster fine-tuning with 70% less VRAM.
Reads training pairs from the human correction queue and adapts
the OCR model's weights via Low-Rank Adaptation.

Usage:
  python finetune_lora.py                          # Use all available pairs
  python finetune_lora.py --min-pairs 50           # Only train if 50+ pairs
  python finetune_lora.py --epochs 3 --lr 2e-4     # Custom hyperparams
  python finetune_lora.py --export ./my_adapter     # Export adapter weights

Schedule this as a weekly cron/task:
  - Windows: Task Scheduler -> Sunday 02:00
  - Linux:   0 2 * * 0 cd /path/to/vlm && python finetune_lora.py
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
RESULTS_DIR = SCRIPT_DIR.parent / "results"
TRAINING_DIR = RESULTS_DIR / "training_pairs"
ADAPTERS_DIR = SCRIPT_DIR / "adapters"


def load_training_pairs():
    """Load human-corrected OCR pairs from the review pipeline."""
    pairs_file = TRAINING_DIR / "corrections.jsonl"
    if not pairs_file.exists():
        return []

    pairs = []
    seen = set()
    with open(pairs_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
                key = (record.get("original_ocr", ""), record.get("corrected_text", ""))
                if key[0] and key[1] and key not in seen:
                    seen.add(key)
                    pairs.append({
                        "instruction": "Correct the following OCR-extracted medical text:",
                        "input": record["original_ocr"],
                        "output": record["corrected_text"],
                    })
            except (json.JSONDecodeError, KeyError):
                continue
    return pairs


def format_for_training(pairs):
    """Format pairs into the Alpaca-style prompt format for fine-tuning."""
    formatted = []
    for pair in pairs:
        text = (
            f"### Instruction:\n{pair['instruction']}\n\n"
            f"### Input:\n{pair['input']}\n\n"
            f"### Response:\n{pair['output']}"
        )
        formatted.append({"text": text})
    return formatted


def run_finetune(pairs, epochs=1, learning_rate=2e-4, export_path=None):
    """Run LoRA fine-tuning using Unsloth (if available) or HuggingFace PEFT."""
    formatted = format_for_training(pairs)

    try:
        from unsloth import FastLanguageModel
        HAS_UNSLOTH = True
    except ImportError:
        HAS_UNSLOTH = False

    if HAS_UNSLOTH:
        return _finetune_unsloth(formatted, epochs, learning_rate, export_path)
    else:
        return _finetune_peft(formatted, epochs, learning_rate, export_path)


def _finetune_unsloth(data, epochs, lr, export_path):
    """Fine-tune using Unsloth (fastest, least VRAM)."""
    from unsloth import FastLanguageModel
    from datasets import Dataset
    from trl import SFTTrainer
    from transformers import TrainingArguments

    print("[*] Loading base model with Unsloth...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name="unsloth/Phi-4-mini-instruct",  # Lightweight medical-capable model
        max_seq_length=2048,
        dtype=None,  # Auto-detect
        load_in_4bit=True,
    )

    model = FastLanguageModel.get_peft_model(
        model,
        r=16,                    # LoRA rank
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                        "gate_proj", "up_proj", "down_proj"],
        lora_alpha=16,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
    )

    dataset = Dataset.from_list(data)

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=2048,
        args=TrainingArguments(
            per_device_train_batch_size=2,
            gradient_accumulation_steps=4,
            warmup_steps=5,
            num_train_epochs=epochs,
            learning_rate=lr,
            fp16=True,
            logging_steps=1,
            output_dir=str(ADAPTERS_DIR / "checkpoints"),
            optim="adamw_8bit",
            seed=42,
        ),
    )

    print(f"[*] Training on {len(data)} pairs for {epochs} epoch(s)...")
    stats = trainer.train()

    # Save adapter
    save_path = export_path or str(ADAPTERS_DIR / f"lora_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    model.save_pretrained(save_path)
    tokenizer.save_pretrained(save_path)
    print(f"[+] Adapter saved to: {save_path}")

    return {
        "method": "unsloth",
        "pairs": len(data),
        "epochs": epochs,
        "loss": stats.training_loss if hasattr(stats, "training_loss") else None,
        "adapter_path": save_path,
    }


def _finetune_peft(data, epochs, lr, export_path):
    """Fallback: fine-tune using HuggingFace PEFT (slower but universal)."""
    try:
        import torch
        from datasets import Dataset
        from peft import LoraConfig, get_peft_model, TaskType
        from transformers import (
            AutoModelForCausalLM, AutoTokenizer,
            TrainingArguments, Trainer, DataCollatorForLanguageModeling,
        )
    except ImportError as e:
        print(f"[!] Missing dependency: {e}")
        print("    Install with: pip install peft transformers datasets torch")
        return None

    print("[*] Loading base model with PEFT...")
    model_id = "microsoft/phi-2"  # Small but capable
    tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        trust_remote_code=True,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto",
    )

    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "k_proj", "v_proj", "dense"],
        lora_dropout=0.05,
        bias="none",
        task_type=TaskType.CAUSAL_LM,
    )
    model = get_peft_model(model, lora_config)

    def tokenize(examples):
        return tokenizer(examples["text"], truncation=True, max_length=2048, padding="max_length")

    dataset = Dataset.from_list(data).map(tokenize, batched=True)

    save_path = export_path or str(ADAPTERS_DIR / f"lora_{datetime.now().strftime('%Y%m%d_%H%M%S')}")

    training_args = TrainingArguments(
        output_dir=str(ADAPTERS_DIR / "checkpoints"),
        num_train_epochs=epochs,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        learning_rate=lr,
        fp16=torch.cuda.is_available(),
        logging_steps=1,
        save_steps=50,
        save_total_limit=2,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
        data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False),
    )

    print(f"[*] Training on {len(data)} pairs for {epochs} epoch(s)...")
    stats = trainer.train()

    model.save_pretrained(save_path)
    tokenizer.save_pretrained(save_path)
    print(f"[+] Adapter saved to: {save_path}")

    return {
        "method": "peft",
        "pairs": len(data),
        "epochs": epochs,
        "loss": stats.training_loss if hasattr(stats, "training_loss") else None,
        "adapter_path": save_path,
    }


def main():
    parser = argparse.ArgumentParser(description="LoRA Fine-Tuning for Medical OCR")
    parser.add_argument("--min-pairs", type=int, default=10,
                        help="Minimum training pairs required (default: 10)")
    parser.add_argument("--epochs", type=int, default=1,
                        help="Number of training epochs (default: 1)")
    parser.add_argument("--lr", type=float, default=2e-4,
                        help="Learning rate (default: 2e-4)")
    parser.add_argument("--export", type=str, default=None,
                        help="Export adapter to this path")
    args = parser.parse_args()

    # Load pairs
    pairs = load_training_pairs()
    print(f"[*] Found {len(pairs)} training pairs")

    if len(pairs) < args.min_pairs:
        print(f"[!] Need at least {args.min_pairs} pairs. Currently have {len(pairs)}. Skipping.")
        return

    # Ensure output dirs
    ADAPTERS_DIR.mkdir(parents=True, exist_ok=True)
    (ADAPTERS_DIR / "checkpoints").mkdir(parents=True, exist_ok=True)

    # Run fine-tuning
    result = run_finetune(pairs, epochs=args.epochs, learning_rate=args.lr, export_path=args.export)

    if result:
        # Log the training run
        log_file = ADAPTERS_DIR / "training_log.jsonl"
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **result,
        }
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry) + "\n")
        print(f"[+] Training complete. Log saved to {log_file}")
    else:
        print("[!] Training failed.")


if __name__ == "__main__":
    main()
