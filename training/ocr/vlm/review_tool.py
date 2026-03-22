"""
Human Review Tool — CLI for the Self-Expanding Loop
====================================================
Presents flagged OCR entries one-by-one for doctor review.
Corrections are saved as training pairs for the next LoRA fine-tune.

Usage:
  python review_tool.py                    # Review all pending flags
  python review_tool.py --limit 20         # Review up to 20 entries
  python review_tool.py --stats            # Show review queue stats
"""

import argparse
import json
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
RESULTS_DIR = SCRIPT_DIR.parent / "results"
REVIEW_DIR = RESULTS_DIR / "flagged_for_review"
TRAINING_DIR = RESULTS_DIR / "training_pairs"

from audit_logger import AuditLogger


def load_pending_reviews():
    """Load all unreviewed flagged entries."""
    if not REVIEW_DIR.exists():
        return []

    pending = []
    for flag_file in sorted(REVIEW_DIR.glob("*.jsonl")):
        with open(flag_file, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    if record.get("human_correction") is None:
                        record["_file"] = str(flag_file)
                        record["_line"] = line_num
                        pending.append(record)
                except (json.JSONDecodeError, KeyError):
                    continue
    return pending


def save_correction(original_text, corrected_text, source_image, reviewer="doctor"):
    """Save a training pair from human review."""
    TRAINING_DIR.mkdir(parents=True, exist_ok=True)
    pair = {
        "source_image": source_image,
        "timestamp": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
        "original_ocr": original_text,
        "corrected_text": corrected_text,
        "reviewer": reviewer,
    }
    pair_file = TRAINING_DIR / "corrections.jsonl"
    with open(pair_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(pair, ensure_ascii=False) + "\n")


def interactive_review(limit=None, reviewer="doctor"):
    """Interactive CLI review loop."""
    pending = load_pending_reviews()
    if not pending:
        print("[*] No pending reviews. Queue is empty.")
        return

    audit = AuditLogger(RESULTS_DIR / "audit.db")
    total = len(pending)
    to_review = pending[:limit] if limit else pending

    print(f"\n=== Medical OCR Review Tool ===")
    print(f"    {total} entries pending review")
    print(f"    Reviewing: {len(to_review)} entries")
    print(f"    Commands: [Enter] = accept as-is, type correction, 's' = skip, 'q' = quit\n")

    reviewed = 0
    corrected = 0

    for i, entry in enumerate(to_review):
        print(f"--- [{i+1}/{len(to_review)}] Source: {entry.get('source_image', '?')} ---")
        print(f"    OCR text:    \"{entry['text']}\"")
        print(f"    Confidence:  {entry.get('confidence', '?')}")
        if entry.get("original_text") and entry["original_text"] != entry["text"]:
            print(f"    Pre-correct: \"{entry['original_text']}\"")
        if entry.get("corrections"):
            for c in entry["corrections"]:
                print(f"    Auto-fix:    \"{c.get('original', '')}\" -> \"{c.get('corrected', '')}\" ({c.get('method', '')})")

        user_input = input("    Your correction (Enter=accept, s=skip, q=quit): ").strip()

        if user_input.lower() == "q":
            print("[*] Quitting review.")
            break
        elif user_input.lower() == "s":
            continue
        elif user_input == "":
            # Accept as-is — still a valid training signal
            save_correction(
                entry.get("original_text", entry["text"]),
                entry["text"],
                entry.get("source_image", "unknown"),
                reviewer=reviewer,
            )
            audit.log_action(
                user=reviewer, action="review_accepted",
                file_path=entry.get("source_image", ""),
                file_hash="", details=json.dumps({"text": entry["text"]}),
            )
            reviewed += 1
        else:
            # Human correction
            save_correction(
                entry.get("original_text", entry["text"]),
                user_input,
                entry.get("source_image", "unknown"),
                reviewer=reviewer,
            )
            audit.log_action(
                user=reviewer, action="review_corrected",
                file_path=entry.get("source_image", ""),
                file_hash="",
                details=json.dumps({"original": entry["text"], "corrected": user_input}),
            )
            reviewed += 1
            corrected += 1
            print(f"    Saved: \"{entry['text']}\" -> \"{user_input}\"")

    print(f"\n[+] Review complete: {reviewed} reviewed, {corrected} corrected")
    print(f"    Training pairs saved to: {TRAINING_DIR / 'corrections.jsonl'}")


def show_stats():
    """Show review queue statistics."""
    pending = load_pending_reviews()

    pairs_file = TRAINING_DIR / "corrections.jsonl"
    pairs_count = 0
    if pairs_file.exists():
        pairs_count = sum(1 for line in open(pairs_file, encoding="utf-8") if line.strip())

    print(f"\n=== Review Queue Stats ===")
    print(f"  Pending reviews:    {len(pending)}")
    print(f"  Training pairs:     {pairs_count}")

    if pending:
        confs = [e.get("confidence", 0) for e in pending]
        print(f"  Avg confidence:     {sum(confs)/len(confs):.3f}")
        print(f"  Min confidence:     {min(confs):.3f}")
        print(f"  Max confidence:     {max(confs):.3f}")

    # Show source distribution
    sources = {}
    for e in pending:
        src = e.get("source_image", "unknown")
        sources[src] = sources.get(src, 0) + 1
    if sources:
        print(f"\n  By source image:")
        for src, count in sorted(sources.items(), key=lambda x: -x[1])[:10]:
            print(f"    {src:40s} {count:4d}")
    print()


def main():
    parser = argparse.ArgumentParser(description="Medical OCR Human Review Tool")
    parser.add_argument("--limit", type=int, help="Max entries to review")
    parser.add_argument("--reviewer", type=str, default="doctor", help="Reviewer name for audit")
    parser.add_argument("--stats", action="store_true", help="Show queue statistics")
    args = parser.parse_args()

    if args.stats:
        show_stats()
    else:
        interactive_review(limit=args.limit, reviewer=args.reviewer)


if __name__ == "__main__":
    main()
