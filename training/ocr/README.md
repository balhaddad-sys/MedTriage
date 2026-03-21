# MedTriage OCR Training Workspace

This folder is the start of the real custom OCR program for MedTriage.

It is designed around four stages:

1. Build the MedTriage domain assets from the live OCR engine.
2. Generate synthetic training crops for beds, names, diagnoses, medications, and mixed rows.
3. Prepare a PaddleOCR-style recognition dataset from synthetic and manually labeled samples.
4. Run recognizer fine-tuning once the Python training stack is installed.

## Quick Start

1. `npm run ocr:train:workspace`
2. `npm run ocr:train:install`
3. `npm run ocr:train:synth -- --count 1500`
4. `npm run ocr:train:prepare`
5. `npm run verify:ocr-training`

If you want to install the full PaddleOCR CPU training stack as well:

1. `node scripts/install-ocr-training-stack.mjs --with-paddle`
2. `node scripts/train-ocr.mjs --epochs=1`

## Folder Layout

- `manifest/`: curated training materials and dataset registry
- `generated/`: MedTriage lexicon, charset, and synthetic corpus built from `ocrEngine.js`
- `raw/`: manually labeled or synthetic OCR samples before normalization
- `prepared/`: PaddleOCR-style label files and copied images
- `vendor/`: optional PaddleOCR clone for actual training
- `checkpoints/`: saved recognizer checkpoints

## Manual Data Format

Place first-party de-identified samples in:

- `training/ocr/raw/medtriage_manual/images/`
- `training/ocr/raw/medtriage_manual/labels.jsonl`

Each JSONL line should look like:

```json
{"image":"images/sample_0001.png","text":"E-M-03 Ahmed Ali 67/M NSTEMI","split":"train","language":"mixed","source":"medtriage-manual"}
```

## Notes

- Generated assets, prepared datasets, checkpoints, vendor clones, and local raw samples are ignored by `training/ocr/.gitignore` so the workspace stays commit-friendly.
- This machine currently looks CPU-only, so any local fine-tuning here will be a smoke test rather than a fast full training run.
- The synthetic generator is meant to bootstrap the recognizer, not replace real hospital data.
- Public datasets listed in `manifest/datasets.json` are the external sources to add next.
