# MedTriage OCR Training Workspace

This folder is the start of the real custom OCR program for MedTriage.

It is designed around four stages:

1. Build the MedTriage domain assets from the live OCR engine.
2. Generate synthetic training crops for beds, names, diagnoses, medications, spreadsheet headers, ward banners, statuses, and roster-style rows.
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
- The synthetic set now intentionally oversamples spreadsheet roster concepts like `Room / Ward`, `Ward / Bed`, `Room No`, `Patient name`, `Pt Name`, `Assigned Doctor`, `Assigned Dr`, `Consultant Name`, `Ward 20`, `Male list (active)`, `Transfer list`, `Ward Transfer Sheet`, `Evening Census`, `Bed Board`, `New`, `Pending`, and `Chronic`, plus lowercase transliterated names.
- The generator also now emits sparse spreadsheet rows with blank doctor/status cells, numeric-room roster rows like `10 ali hussain ... Consultant saleh New`, ward-inline roster rows, ward pipe rows, title-section-header rows, header-alias rows, doctor-ward-status rows, title-header rows, doctor-status rows, numeric pipe rows, section-context rows, screenshot-style `sheet-block` sections with repeated headers and ward banners, mixed-language section blocks, wrapped-diagnosis continuation rows, stacked multi-ward blocks, split-name continuation blocks, partial-header blocks, and detail-heavy diagnoses like `CVA left MCA occlusion`, `Ischemic stroke with aphasia`, `Aspiration pneumonia`, `GI bleeding`, and `NSTEMI, heart failure`.
- Synthetic rendering now tracks visual difficulty too, including washed-grid, soft-scan, banded-sheet, tight-crop, clipped-grid, dense-sheet, dense-line, merged-sheet, phone-capture, faded-block, dense-block, left-clipped-block, right-clipped-block, top-clipped-block, and bottom-clipped-block variants so the recognizer sees rougher screenshot-like sheet crops instead of only clean rows.
- Synthetic generation is reproducible with `--seed` and now writes `training/ocr/raw/medtriage_synthetic/stats.json` so you can inspect coverage by kind, layout, style, difficulty, language, and split.
- Public datasets listed in `manifest/datasets.json` are the external sources to add next.
