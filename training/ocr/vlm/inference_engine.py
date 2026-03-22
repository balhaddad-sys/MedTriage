"""
MedGrade VLM Inference Engine
=============================
Hybrid Vision-Language Model pipeline for medical document OCR.
Supports PaddleOCR (lightweight) and DeepSeek-OCR-2 (high-accuracy) backends.

Architecture:
  Image -> Layout Analysis -> VLM Extraction -> Confidence Scoring
        -> Medical Terminology Correction -> Structured JSON Output
        -> Self-Expanding Flagging (low-confidence -> review queue)

Usage:
  python inference_engine.py --image lab_report.jpg
  python inference_engine.py --batch ./scans/ --backend paddle
"""

import argparse
import hashlib
import json
import os
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Attempt VLM imports — graceful fallback if not installed
try:
    import cv2
    import numpy as np
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False

try:
    from paddleocr import PaddleOCR
    HAS_PADDLE = True
except ImportError:
    HAS_PADDLE = False

try:
    from transformers import AutoModelForCausalLM, AutoTokenizer
    HAS_TRANSFORMERS = True
except ImportError:
    HAS_TRANSFORMERS = False

# Local imports
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from med_corrector import MedTermCorrector
from audit_logger import AuditLogger


# ═══════════════════════════════════════════════════════════════════
# CONFIDENCE THRESHOLDS
# ═══════════════════════════════════════════════════════════════════
CONFIDENCE_HIGH = 0.92       # Accept without review
CONFIDENCE_MEDIUM = 0.75     # Apply medical correction, then accept
CONFIDENCE_LOW = 0.50        # Flag for human review
CONFIDENCE_REJECT = 0.30     # Too unreliable — discard

# ═══════════════════════════════════════════════════════════════════
# IMAGE PREPROCESSOR
# ═══════════════════════════════════════════════════════════════════
class ImagePreprocessor:
    """Prepares medical document images for VLM inference."""

    @staticmethod
    def load(image_path):
        if not HAS_CV2:
            raise ImportError("opencv-python required: pip install opencv-python")
        img = cv2.imread(str(image_path))
        if img is None:
            raise FileNotFoundError(f"Cannot read image: {image_path}")
        return img

    @staticmethod
    def prepare_variants(img):
        """Generate multiple preprocessing variants for ensemble OCR."""
        variants = []

        # Original
        variants.append(("original", img.copy()))

        # Grayscale + adaptive threshold (good for printed text)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        variants.append(("grayscale", cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)))

        # High contrast (good for faded documents)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        variants.append(("high_contrast", cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)))

        # Denoised (good for phone photos)
        denoised = cv2.fastNlMeansDenoisingColored(img, None, 10, 10, 7, 21)
        variants.append(("denoised", denoised))

        # Sharpened (good for blurry scans)
        kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
        sharpened = cv2.filter2D(img, -1, kernel)
        variants.append(("sharpened", sharpened))

        return variants

    @staticmethod
    def deskew(img):
        """Correct rotation for tilted scans."""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.bitwise_not(gray)
        coords = np.column_stack(np.where(gray > 0))
        if len(coords) < 50:
            return img
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        if abs(angle) < 0.5:
            return img
        h, w = img.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        return cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC,
                              borderMode=cv2.BORDER_REPLICATE)

    @staticmethod
    def file_hash(path):
        """SHA-256 hash for audit trail."""
        sha = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha.update(chunk)
        return sha.hexdigest()


# ═══════════════════════════════════════════════════════════════════
# VLM BACKENDS
# ═══════════════════════════════════════════════════════════════════
class PaddleBackend:
    """PaddleOCR backend — fast, lightweight. Supports v3.4+ API."""

    def __init__(self, lang="en", use_gpu=True):
        if not HAS_PADDLE:
            raise ImportError("PaddleOCR required: pip install paddleocr paddlepaddle-gpu")
        import os
        os.environ['PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK'] = 'True'
        init_kwargs = {"lang": lang}
        if use_gpu:
            init_kwargs["text_det_limit_side_len"] = 960
        self.engine = PaddleOCR(**init_kwargs)

    def predict(self, img):
        """Run OCR and return standardized results."""
        results = list(self.engine.predict(img))
        if not results:
            return []

        entries = []
        for result in results:
            # v3.4 OCRResult is dict-like with .json['res'] containing the data
            res = None
            if hasattr(result, 'json') and isinstance(result.json, dict):
                res = result.json.get('res', {})
            elif isinstance(result, dict):
                res = result.get('res', result)
            else:
                continue

            texts = res.get('rec_texts', []) or []
            scores = res.get('rec_scores', []) or []
            polys = res.get('rec_polys', []) or []

            for i, text in enumerate(texts):
                if not text or not text.strip():
                    continue
                conf = float(scores[i]) if i < len(scores) else 0.5
                coords = []
                if i < len(polys) and polys[i] is not None:
                    try:
                        coords = [[int(p[0]), int(p[1])] for p in polys[i]]
                    except (TypeError, IndexError):
                        pass
                entries.append({
                    "text": text.strip(),
                    "confidence": round(conf, 4),
                    "coordinates": coords,
                    "type": "text",
                    "backend": "paddle",
                })
        return entries


class DeepSeekBackend:
    """DeepSeek-OCR-2 backend — high accuracy for complex medical docs."""

    MODEL_ID = "deepseek-ai/deepseek-vl2-small"

    def __init__(self, use_gpu=True):
        if not HAS_TRANSFORMERS:
            raise ImportError("transformers required: pip install transformers torch")
        import torch
        device = "cuda" if use_gpu and torch.cuda.is_available() else "cpu"
        self.device = device
        self.tokenizer = AutoTokenizer.from_pretrained(self.MODEL_ID, trust_remote_code=True)
        self.model = AutoModelForCausalLM.from_pretrained(
            self.MODEL_ID,
            trust_remote_code=True,
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
        ).to(device)

    def predict(self, img):
        """Use VLM to extract structured text from document image."""
        import torch
        from PIL import Image as PILImage

        if isinstance(img, np.ndarray):
            pil_img = PILImage.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        else:
            pil_img = PILImage.open(img)

        prompt = (
            "Extract all text from this medical document. "
            "Return each text element with its approximate position (top/middle/bottom, left/center/right) "
            "and type (header, table_cell, handwriting, printed, stamp, checkbox). "
            "Format as JSON array."
        )

        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)
        with torch.no_grad():
            outputs = self.model.generate(**inputs, max_new_tokens=2048)
        response = self.tokenizer.decode(outputs[0], skip_special_tokens=True)

        # Parse VLM response into standardized format
        try:
            parsed = json.loads(response)
            if isinstance(parsed, list):
                return [{
                    "text": item.get("text", ""),
                    "confidence": item.get("confidence", 0.85),
                    "coordinates": item.get("position", []),
                    "type": item.get("type", "text"),
                    "backend": "deepseek",
                } for item in parsed]
        except (json.JSONDecodeError, TypeError):
            pass

        # Fallback: treat entire response as single text block
        return [{
            "text": response.strip(),
            "confidence": 0.70,
            "coordinates": [],
            "type": "text",
            "backend": "deepseek",
        }]


# ═══════════════════════════════════════════════════════════════════
# MEDICAL GRADE INFERENCE ENGINE
# ═══════════════════════════════════════════════════════════════════
class MedGradeInferenceEngine:
    """
    The main inference pipeline.

    Image -> Preprocess -> Multi-variant OCR -> Ensemble Merge
          -> Medical Correction -> Confidence Filtering
          -> Structured Output + Audit Log + Self-Expanding Flags
    """

    def __init__(self, backend="paddle", output_dir=None, use_gpu=True):
        self.output_dir = Path(output_dir or SCRIPT_DIR.parent / "results")
        self.review_dir = self.output_dir / "flagged_for_review"
        self.training_dir = self.output_dir / "training_pairs"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.review_dir.mkdir(parents=True, exist_ok=True)
        self.training_dir.mkdir(parents=True, exist_ok=True)

        # Initialize backend
        if backend == "deepseek":
            self.backend = DeepSeekBackend(use_gpu=use_gpu)
        else:
            self.backend = PaddleBackend(use_gpu=use_gpu)

        # Medical terminology corrector
        self.corrector = MedTermCorrector()

        # Audit logger
        self.audit = AuditLogger(self.output_dir / "audit.db")

    def process_document(self, image_path, user="system"):
        """Full pipeline: preprocess -> OCR -> correct -> filter -> output."""
        image_path = Path(image_path)
        file_hash = ImagePreprocessor.file_hash(image_path)
        start_time = time.monotonic()

        print(f"[*] Processing: {image_path.name}")

        # 1. Load and preprocess
        img = ImagePreprocessor.load(image_path)
        img = ImagePreprocessor.deskew(img)

        # 2. Multi-variant OCR
        variants = ImagePreprocessor.prepare_variants(img)
        all_results = []
        for variant_name, variant_img in variants:
            try:
                results = self.backend.predict(variant_img)
                for r in results:
                    r["variant"] = variant_name
                all_results.extend(results)
            except Exception as e:
                print(f"  [!] Variant '{variant_name}' failed: {e}")

        # 3. Ensemble merge (deduplicate, pick highest confidence)
        merged = self._ensemble_merge(all_results)

        # 4. Medical terminology correction
        corrected = []
        for entry in merged:
            original_text = entry["text"]
            fixed_text, corrections = self.corrector.correct(original_text)
            entry["text"] = fixed_text
            entry["original_text"] = original_text
            entry["corrections"] = corrections
            if fixed_text != original_text:
                entry["confidence"] = min(entry["confidence"] + 0.05, 0.99)
            corrected.append(entry)

        # 5. Confidence filtering + self-expanding flags
        accepted = []
        flagged = []
        rejected = []

        for entry in corrected:
            conf = entry["confidence"]
            if conf >= CONFIDENCE_HIGH:
                entry["status"] = "accepted"
                accepted.append(entry)
            elif conf >= CONFIDENCE_LOW:
                entry["status"] = "review"
                flagged.append(entry)
                self._flag_for_review(image_path, entry)
            else:
                entry["status"] = "rejected"
                rejected.append(entry)

        elapsed = round(time.monotonic() - start_time, 2)

        # 6. Build structured output
        output = {
            "file": image_path.name,
            "file_hash": file_hash,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "processing_time_s": elapsed,
            "backend": type(self.backend).__name__,
            "summary": {
                "total_elements": len(corrected),
                "accepted": len(accepted),
                "flagged_for_review": len(flagged),
                "rejected": len(rejected),
                "avg_confidence": round(
                    sum(e["confidence"] for e in corrected) / max(len(corrected), 1), 4
                ),
            },
            "elements": corrected,
        }

        # 7. Save output
        out_path = self.output_dir / f"{image_path.stem}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)

        # 8. Audit log
        self.audit.log_action(
            user=user,
            action="ocr_process",
            file_path=str(image_path),
            file_hash=file_hash,
            details=json.dumps(output["summary"]),
        )

        print(f"[+] Done in {elapsed}s — {len(accepted)} accepted, "
              f"{len(flagged)} flagged, {len(rejected)} rejected")
        return output

    def process_batch(self, directory, user="system"):
        """Process all images in a directory."""
        directory = Path(directory)
        images = sorted(
            p for p in directory.iterdir()
            if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"}
        )
        print(f"[*] Batch processing: {len(images)} images in {directory}")
        results = []
        for img_path in images:
            try:
                result = self.process_document(img_path, user=user)
                results.append(result)
            except Exception as e:
                print(f"  [!] Failed: {img_path.name} — {e}")
        return results

    def _ensemble_merge(self, results):
        """Deduplicate OCR results from multiple variants, keeping highest confidence."""
        if not results:
            return []

        # Group by normalized text
        groups = {}
        for entry in results:
            key = entry["text"].strip().lower()
            if not key:
                continue
            if key not in groups or entry["confidence"] > groups[key]["confidence"]:
                groups[key] = entry

        return sorted(groups.values(), key=lambda e: e["confidence"], reverse=True)

    def _flag_for_review(self, image_path, entry):
        """Save low-confidence entries for human review (self-expanding hook)."""
        flag_file = self.review_dir / f"{image_path.stem}_flagged.jsonl"
        with open(flag_file, "a", encoding="utf-8") as f:
            record = {
                "source_image": image_path.name,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "text": entry["text"],
                "original_text": entry.get("original_text", entry["text"]),
                "confidence": entry["confidence"],
                "coordinates": entry.get("coordinates", []),
                "corrections": entry.get("corrections", []),
                "human_correction": None,  # To be filled by reviewer
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")

    def submit_correction(self, image_name, original_text, corrected_text, reviewer="doctor"):
        """
        Human-in-the-loop: submit a correction for a flagged entry.
        This creates a training pair for the self-expanding fine-tune.
        """
        pair = {
            "source_image": image_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "original_ocr": original_text,
            "corrected_text": corrected_text,
            "reviewer": reviewer,
        }
        pair_file = self.training_dir / "corrections.jsonl"
        with open(pair_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(pair, ensure_ascii=False) + "\n")

        self.audit.log_action(
            user=reviewer,
            action="correction_submitted",
            file_path=image_name,
            file_hash="",
            details=json.dumps({"original": original_text, "corrected": corrected_text}),
        )

        # Also feed back into the corrector's live dictionary
        self.corrector.learn(original_text, corrected_text)

        print(f"[+] Training pair saved: '{original_text}' -> '{corrected_text}'")


# ═══════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description="MedGrade VLM Inference Engine")
    parser.add_argument("--image", type=str, help="Path to a single image")
    parser.add_argument("--batch", type=str, help="Path to a directory of images")
    parser.add_argument("--backend", choices=["paddle", "deepseek"], default="paddle",
                        help="VLM backend (default: paddle)")
    parser.add_argument("--output", type=str, help="Output directory")
    parser.add_argument("--no-gpu", action="store_true", help="Disable GPU")
    parser.add_argument("--user", type=str, default="cli_user", help="User ID for audit")
    args = parser.parse_args()

    engine = MedGradeInferenceEngine(
        backend=args.backend,
        output_dir=args.output,
        use_gpu=not args.no_gpu,
    )

    if args.image:
        engine.process_document(args.image, user=args.user)
    elif args.batch:
        engine.process_batch(args.batch, user=args.user)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
