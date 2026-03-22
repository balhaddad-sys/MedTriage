"""
CPU LoRA Fine-Tuning — Medical OCR Correction Model
====================================================
Trains a small language model on the mega dataset using LoRA on CPU.
Uses GPT-2 (124M params) as base — small enough for CPU, big enough to learn.

This creates a specialized medical OCR correction model that understands
context (not just dictionary lookup).
"""

import json
import os
import time
from pathlib import Path

import torch
from datasets import Dataset
from peft import LoraConfig, TaskType, get_peft_model
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    DataCollatorForLanguageModeling,
    Trainer,
    TrainingArguments,
)

SCRIPT_DIR = Path(__file__).resolve().parent
ADAPTERS_DIR = SCRIPT_DIR / "adapters"


def main():
    ADAPTERS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Load training data
    print("[*] Loading training data...")
    train_file = SCRIPT_DIR / "training_dataset.json"
    with open(train_file, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    # Format as text
    texts = []
    for item in raw_data:
        text = (
            f"### Instruction:\n{item['instruction']}\n\n"
            f"### Input:\n{item['input']}\n\n"
            f"### Response:\n{item['output']}"
        )
        texts.append({"text": text})

    print(f"[+] {len(texts):,} training examples loaded")

    # 2. Load model — GPT-2 small (124M) for CPU feasibility
    model_id = "gpt2"
    print(f"[*] Loading {model_id}...")

    tokenizer = AutoTokenizer.from_pretrained(model_id)
    tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        torch_dtype=torch.float32,  # CPU needs float32
    )

    # 3. Apply LoRA
    print("[*] Applying LoRA adapter...")
    lora_config = LoraConfig(
        r=8,  # Lower rank for CPU speed
        lora_alpha=16,
        target_modules=["c_attn", "c_proj"],  # GPT-2 attention layers
        lora_dropout=0.05,
        bias="none",
        task_type=TaskType.CAUSAL_LM,
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # 4. Tokenize
    print("[*] Tokenizing dataset...")

    def tokenize(examples):
        return tokenizer(
            examples["text"],
            truncation=True,
            max_length=256,  # Short sequences for speed
            padding="max_length",
        )

    dataset = Dataset.from_list(texts)
    tokenized = dataset.map(tokenize, batched=True, remove_columns=["text"])

    # 5. Train
    save_path = str(ADAPTERS_DIR / "medocr_lora_cpu")

    training_args = TrainingArguments(
        output_dir=str(ADAPTERS_DIR / "checkpoints"),
        num_train_epochs=1,
        per_device_train_batch_size=4,
        gradient_accumulation_steps=8,
        learning_rate=3e-4,
        warmup_steps=50,
        logging_steps=25,
        save_steps=500,
        save_total_limit=2,
        fp16=False,  # CPU — no fp16
        dataloader_num_workers=0,
        report_to="none",
        seed=42,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized,
        data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False),
    )

    print(f"[*] Starting CPU training on {len(texts):,} examples...")
    print(f"    Batch size: 4 x 8 accumulation = 32 effective")
    print(f"    Steps: ~{len(texts) // 32} per epoch")
    start = time.time()

    trainer.train()

    elapsed = time.time() - start
    print(f"\n[+] Training complete in {elapsed/60:.1f} minutes")

    # 6. Save adapter
    model.save_pretrained(save_path)
    tokenizer.save_pretrained(save_path)
    print(f"[+] LoRA adapter saved to: {save_path}")

    # 7. Quick inference test
    print("\n[*] Testing trained model...")
    model.eval()
    test_inputs = [
        "atorvastalln 40rng dally",
        "Acute myocardlal lnfarction",
        "pantcprazole 40mg lV BlD",
    ]
    for inp in test_inputs:
        prompt = f"### Instruction:\nCorrect the following OCR-extracted medical text:\n\n### Input:\n{inp}\n\n### Response:\n"
        tokens = tokenizer(prompt, return_tensors="pt")
        with torch.no_grad():
            output = model.generate(
                **tokens,
                max_new_tokens=50,
                do_sample=False,
                temperature=1.0,
            )
        result = tokenizer.decode(output[0], skip_special_tokens=True)
        # Extract just the response
        response = result.split("### Response:\n")[-1].strip().split("\n")[0]
        print(f"  IN:  {inp}")
        print(f"  OUT: {response}")
        print()

    # 8. Log
    log_entry = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "model": model_id,
        "method": "peft_lora_cpu",
        "pairs": len(texts),
        "epochs": 1,
        "elapsed_minutes": round(elapsed / 60, 1),
        "adapter_path": save_path,
    }
    log_file = ADAPTERS_DIR / "training_log.jsonl"
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(log_entry) + "\n")

    print(f"[+] Training log saved to {log_file}")


if __name__ == "__main__":
    main()
