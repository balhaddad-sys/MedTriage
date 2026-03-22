"""
Data Pipeline — Medical OCR Training Data Fetcher
==================================================
Downloads and prepares medical document datasets for training:
  1. OmniDocBench — complex document parsing benchmark
  2. Synthetic generation from existing MedTriage seed data
  3. Distortion augmentation (shadows, blur, rotation, coffee stains)

Note: PhysioNet/MIMIC requires credentialed access.
      This script provides the download helpers but you must
      apply at https://physionet.org/ with your medical credentials.

Usage:
  python data_pipeline.py --download omnidoc
  python data_pipeline.py --augment ./raw/medtriage_synthetic/images/
  python data_pipeline.py --stats
"""

import argparse
import json
import os
import random
import shutil
from pathlib import Path

try:
    import cv2
    import numpy as np
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False

try:
    from PIL import Image, ImageDraw, ImageFilter
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

SCRIPT_DIR = Path(__file__).resolve().parent
RAW_DIR = SCRIPT_DIR.parent / "raw"
AUGMENTED_DIR = SCRIPT_DIR.parent / "augmented"
PREPARED_DIR = SCRIPT_DIR.parent / "prepared"


# ═══════════════════════════════════════════════════════════════════
# DATASET REGISTRY
# ═══════════════════════════════════════════════════════════════════
DATASETS = {
    "omnidoc": {
        "name": "OmniDocBench",
        "description": "Complex document parsing benchmark (tables, forms, mixed layouts)",
        "source": "huggingface",
        "repo_id": "opendatalab/OmniDocBench",
        "instructions": "pip install huggingface_hub && python data_pipeline.py --download omnidoc",
    },
    "rvlcdip": {
        "name": "RVL-CDIP (subset)",
        "description": "Document classification dataset — forms, invoices, letters",
        "source": "huggingface",
        "repo_id": "rvl_cdip",
        "instructions": "pip install datasets && python data_pipeline.py --download rvlcdip",
    },
    "mimic_cxr": {
        "name": "MIMIC-CXR (PhysioNet)",
        "description": "375K+ radiology reports — requires credentialed access",
        "source": "physionet",
        "url": "https://physionet.org/content/mimic-cxr/",
        "instructions": (
            "1. Register at https://physionet.org/\n"
            "2. Complete CITI training\n"
            "3. Request access to MIMIC-CXR\n"
            "4. Download with: wget -r -N -c -np --user YOUR_USER --ask-password "
            "https://physionet.org/files/mimic-cxr/2.0.0/"
        ),
    },
}


def download_omnidoc(target_dir):
    """Download OmniDocBench from HuggingFace."""
    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        print("[!] Install huggingface_hub: pip install huggingface_hub")
        return False

    target = target_dir / "omnidocbench"
    target.mkdir(parents=True, exist_ok=True)
    print(f"[*] Downloading OmniDocBench to {target}...")
    try:
        snapshot_download(
            repo_id="opendatalab/OmniDocBench",
            repo_type="dataset",
            local_dir=str(target),
        )
        print(f"[+] OmniDocBench downloaded to {target}")
        return True
    except Exception as e:
        print(f"[!] Download failed: {e}")
        return False


def download_rvlcdip_subset(target_dir, num_samples=1000):
    """Download a subset of RVL-CDIP for document layout training."""
    try:
        from datasets import load_dataset
    except ImportError:
        print("[!] Install datasets: pip install datasets")
        return False

    target = target_dir / "rvlcdip_subset"
    target.mkdir(parents=True, exist_ok=True)
    print(f"[*] Downloading {num_samples} RVL-CDIP samples...")
    try:
        ds = load_dataset("rvl_cdip", split=f"train[:{num_samples}]")
        for i, sample in enumerate(ds):
            img = sample["image"]
            img.save(target / f"rvlcdip_{i:05d}.png")
        print(f"[+] {num_samples} samples saved to {target}")
        return True
    except Exception as e:
        print(f"[!] Download failed: {e}")
        return False


# ═══════════════════════════════════════════════════════════════════
# DISTORTION AUGMENTATION
# Simulates real-world document degradation
# ═══════════════════════════════════════════════════════════════════
class DocumentAugmenter:
    """Applies realistic distortions to training images."""

    @staticmethod
    def add_shadow(img):
        """Simulate phone camera shadow."""
        if not HAS_PIL:
            return img
        if isinstance(img, np.ndarray):
            img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))

        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        w, h = img.size
        # Random diagonal shadow
        x1, y1 = random.randint(0, w // 3), 0
        x2, y2 = w, random.randint(h // 3, h)
        opacity = random.randint(40, 100)
        draw.polygon([(x1, y1), (w, y1), (x2, y2), (0, y2)], fill=(0, 0, 0, opacity))
        overlay = overlay.filter(ImageFilter.GaussianBlur(radius=20))
        result = Image.alpha_composite(img.convert("RGBA"), overlay)
        return result.convert("RGB")

    @staticmethod
    def add_blur(img, intensity=None):
        """Simulate out-of-focus phone photo."""
        if not HAS_CV2:
            return img
        if isinstance(img, Image.Image):
            img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        k = intensity or random.choice([3, 5, 7])
        return cv2.GaussianBlur(img, (k, k), 0)

    @staticmethod
    def add_rotation(img, max_degrees=5):
        """Simulate slightly tilted scan."""
        if not HAS_CV2:
            return img
        if isinstance(img, Image.Image):
            img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        angle = random.uniform(-max_degrees, max_degrees)
        h, w = img.shape[:2]
        M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
        return cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REPLICATE)

    @staticmethod
    def add_noise(img, intensity=15):
        """Simulate scanner noise."""
        if not HAS_CV2:
            return img
        if isinstance(img, Image.Image):
            img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        noise = np.random.normal(0, intensity, img.shape).astype(np.int16)
        noisy = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        return noisy

    @staticmethod
    def add_fold(img):
        """Simulate a folded document crease."""
        if not HAS_CV2:
            return img
        if isinstance(img, Image.Image):
            img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        h, w = img.shape[:2]
        fold_x = random.randint(w // 4, 3 * w // 4)
        fold_width = random.randint(2, 8)
        img[:, max(0, fold_x - fold_width):min(w, fold_x + fold_width)] = (
            img[:, max(0, fold_x - fold_width):min(w, fold_x + fold_width)] * 0.6
        ).astype(np.uint8)
        return img

    @staticmethod
    def add_coffee_stain(img):
        """Simulate a coffee ring stain on the document."""
        if not HAS_CV2:
            return img
        if isinstance(img, Image.Image):
            img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        h, w = img.shape[:2]
        cx = random.randint(w // 4, 3 * w // 4)
        cy = random.randint(h // 4, 3 * h // 4)
        r = random.randint(30, 80)
        overlay = img.copy()
        cv2.circle(overlay, (cx, cy), r, (180, 200, 220), thickness=random.randint(3, 8))
        return cv2.addWeighted(img, 0.7, overlay, 0.3, 0)

    @classmethod
    def augment(cls, img, num_augments=3):
        """Apply random combination of augmentations."""
        augmentations = [
            cls.add_shadow, cls.add_blur, cls.add_rotation,
            cls.add_noise, cls.add_fold, cls.add_coffee_stain,
        ]
        selected = random.sample(augmentations, min(num_augments, len(augmentations)))
        result = img
        for aug_fn in selected:
            try:
                result = aug_fn(result)
            except Exception:
                pass
        return result


def augment_directory(source_dir, output_dir=None, copies_per_image=3):
    """Generate augmented copies of all images in a directory."""
    source_dir = Path(source_dir)
    output_dir = Path(output_dir or AUGMENTED_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)

    images = sorted(
        p for p in source_dir.iterdir()
        if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"}
    )
    print(f"[*] Augmenting {len(images)} images x{copies_per_image} = {len(images) * copies_per_image} total")

    augmenter = DocumentAugmenter()
    count = 0

    for img_path in images:
        try:
            img = cv2.imread(str(img_path))
            if img is None:
                continue

            for i in range(copies_per_image):
                augmented = augmenter.augment(img)
                if isinstance(augmented, Image.Image):
                    augmented = cv2.cvtColor(np.array(augmented), cv2.COLOR_RGB2BGR)
                out_name = f"{img_path.stem}_aug{i:02d}{img_path.suffix}"
                cv2.imwrite(str(output_dir / out_name), augmented)
                count += 1
        except Exception as e:
            print(f"  [!] Failed: {img_path.name} — {e}")

    print(f"[+] Generated {count} augmented images in {output_dir}")
    return count


def show_stats():
    """Show dataset statistics."""
    print("\n=== Medical OCR Training Data Statistics ===\n")

    dirs = {
        "Raw synthetic": RAW_DIR / "medtriage_synthetic" / "images",
        "Augmented": AUGMENTED_DIR,
        "Prepared": PREPARED_DIR,
        "OmniDocBench": RAW_DIR / "omnidocbench",
        "RVL-CDIP subset": RAW_DIR / "rvlcdip_subset",
    }

    total = 0
    for name, path in dirs.items():
        if path.exists():
            count = sum(1 for p in path.rglob("*") if p.is_file() and
                        p.suffix.lower() in {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"})
            total += count
            print(f"  {name:25s} {count:6d} images")
        else:
            print(f"  {name:25s}    --- (not downloaded)")

    # Training pairs
    pairs_file = SCRIPT_DIR.parent / "results" / "training_pairs" / "corrections.jsonl"
    pairs_count = 0
    if pairs_file.exists():
        pairs_count = sum(1 for line in open(pairs_file) if line.strip())
    print(f"\n  {'Training pairs':25s} {pairs_count:6d} corrections")

    # Adapters
    if SCRIPT_DIR.joinpath("adapters").exists():
        adapters = list(SCRIPT_DIR.joinpath("adapters").glob("lora_*"))
        print(f"  {'LoRA adapters':25s} {len(adapters):6d} checkpoints")

    print(f"\n  {'TOTAL IMAGES':25s} {total:6d}")
    print()


def main():
    parser = argparse.ArgumentParser(description="Medical OCR Data Pipeline")
    parser.add_argument("--download", choices=["omnidoc", "rvlcdip", "all"],
                        help="Download a dataset")
    parser.add_argument("--augment", type=str,
                        help="Augment images in this directory")
    parser.add_argument("--copies", type=int, default=3,
                        help="Augmented copies per image (default: 3)")
    parser.add_argument("--output", type=str,
                        help="Output directory for augmented images")
    parser.add_argument("--stats", action="store_true",
                        help="Show dataset statistics")
    parser.add_argument("--list", action="store_true",
                        help="List available datasets")
    args = parser.parse_args()

    if args.list:
        print("\n=== Available Datasets ===\n")
        for key, ds in DATASETS.items():
            print(f"  [{key}] {ds['name']}")
            print(f"         {ds['description']}")
            print(f"         {ds['instructions']}\n")
        return

    if args.download:
        RAW_DIR.mkdir(parents=True, exist_ok=True)
        if args.download in ("omnidoc", "all"):
            download_omnidoc(RAW_DIR)
        if args.download in ("rvlcdip", "all"):
            download_rvlcdip_subset(RAW_DIR)

    if args.augment:
        augment_directory(args.augment, output_dir=args.output, copies_per_image=args.copies)

    if args.stats:
        show_stats()

    if not any([args.download, args.augment, args.stats, args.list]):
        parser.print_help()


if __name__ == "__main__":
    main()
