# MedTriage Context OCR Research and Architecture

## Goal

Build a context-specific OCR engine for MedTriage that is optimized for:

- hospital patient lists
- mixed Arabic and English content
- ward whiteboards, printed lists, and handwritten additions
- offline-first browser deployment
- field-level patient extraction, not just raw text transcription

This document records:

- the research basis for the design
- what is implemented now in the repo
- what still needs dataset work and model fine-tuning

## Honest Positioning

The engine now in `src/modules/evacuation/ocrEngine.js` is a new context OCR pipeline built for MedTriage, but it is not yet a fully custom-trained recognizer from zero. It uses general OCR backbones for low-level text recognition, then applies a custom domain-specific decoding and validation stack on top.

That is the right tradeoff for this codebase today:

- we get a large accuracy lift immediately
- we stay deployable in a browser
- we create a clean path toward a truly custom recognizer once we have data

## Research Summary

### 1. PaddleOCR / PP-OCRv5

Why it matters:

- strong practical OCR baseline
- multilingual support
- handwriting improvements
- ONNX Runtime deployment path

Relevant source:

- PaddleOCR releases: https://github.com/PaddlePaddle/PaddleOCR/releases
- monkt ONNX export/model card: https://huggingface.co/monkt/paddleocr-onnx/blob/main/README.md

Key takeaways:

- PP-OCRv5 improved recognition quality, including harder handwriting/document scenarios.
- PaddleOCR's current ecosystem includes language-specific recognizers, including Arabic.
- The ONNX deployment path makes browser-side inference realistic for this app.

Design implication:

- use a lightweight shared detector
- use script-specialized recognizers instead of pretending one English-only recognizer is enough for Kuwaiti hospital data

### 2. TrOCR

Relevant source:

- TrOCR paper: https://arxiv.org/abs/2109.10282

Key takeaways:

- transformer recognizers benefit from large synthetic pretraining plus task fine-tuning
- handwritten and printed text both improve when recognition is treated as image-to-sequence modeling, not just CRNN + post-hoc language correction

Design implication:

- MedTriage should eventually fine-tune its own recognizer heads on synthetic + de-identified hospital data
- the current engine is designed so the recognizer layer can later be swapped without rewriting the context decoder

### 3. PARSeq

Relevant source:

- PARSeq paper: https://arxiv.org/abs/2207.06966

Key takeaways:

- strong accuracy/latency tradeoff
- robust on arbitrarily oriented text
- context-aware decoding matters

Design implication:

- even before custom training, the MedTriage OCR engine should behave like a context-aware decoder, not a flat OCR dump
- this inspired the multi-hypothesis layout decoding and context-weighted candidate selection

### 4. LayoutLMv3

Relevant source:

- LayoutLMv3 repo and README: https://github.com/microsoft/unilm/tree/master/layoutlmv3

Key takeaways:

- document AI quality improves when text and image/layout are learned jointly
- layout matters as much as token identity for form understanding and structured extraction

Design implication:

- MedTriage OCR should score layout hypotheses, not rely on one clustering heuristic
- row bands, table-grid interpretation, and spatial clustering should compete and then be reconciled

### 5. Donut and SynthDoG

Relevant source:

- Donut paper: https://arxiv.org/abs/2111.15664

Key takeaways:

- OCR-free document understanding is possible, but heavy
- synthetic document generation is critical for task-specific fine-tuning

Design implication:

- full end-to-end OCR-free extraction is attractive long-term
- it is not the right first browser-side implementation for this repo because latency, model size, and offline packaging are still major constraints

### 6. SynthTIGER

Relevant source:

- SynthTIGER repo: https://github.com/clovaai/synthtiger

Key takeaways:

- synthetic OCR data generation can be customized for non-Latin scripts, custom corpora, and custom fonts
- this is a practical path for domain adaptation when labeled real data is scarce

Design implication:

- MedTriage should generate synthetic patient-list data with Arabic names, English diagnoses, medication names, bed formats, whiteboard noise, table headers, and mobile-photo artifacts

### 7. UVDoc

Relevant source:

- UVDoc paper: https://arxiv.org/abs/2302.02887

Key takeaways:

- document unwarping improves OCR on bent, curled, casually photographed pages

Design implication:

- geometric cleanup is a real next step for phone-photographed ward sheets
- not implemented yet, but explicitly planned

### 8. docTR

Relevant source:

- docTR repo: https://github.com/mindee/doctr

Key takeaways:

- two-stage OCR remains practical
- rotated-box handling and KIE-style downstream prediction are valuable in real deployments

Design implication:

- keep low-level OCR separate from structured patient extraction
- expose enough metadata that a later KIE stage can be added cleanly

## What Is Implemented Now

### 1. New Context Decoder

The OCR path now uses a MedTriage-specific decoding stack:

- OCR confusion-aware lexicon matching for diagnoses and medications
- row-band hypothesis builder
- table-grid hypothesis builder
- spatial-cluster hypothesis builder
- hypothesis scoring and fusion
- clinical plausibility validation

This is the key architectural shift:

- old mindset: one clustering heuristic
- new mindset: multiple structure hypotheses compete, then the engine fuses the best evidence

### 2. Script-Aware OCR Backend

The backend now initializes:

- one lightweight detector
- one Latin/English recognizer
- one Arabic recognizer

At runtime:

- Latin recognition runs first
- if the candidate looks weak or missing names, an Arabic rescue pass runs
- both result sets are fused box-by-box using domain-aware scoring

This is critical for MedTriage because the app often contains:

- Arabic names
- English diagnoses
- English drug names
- mixed notation like `67/M`, `NSTEMI`, `Ceftriaxone`, `NKDA`

### 3. Better OCR Error Recovery

The vocabulary matcher now accounts for common OCR confusions such as:

- `0 <-> O`
- `1 <-> I/L`
- `5 <-> S`
- `8 <-> B`

That improves correction of terms like:

- `NSTEM1 -> NSTEMI`
- `Ceftriax0ne -> Ceftriaxone`

### 4. Better Review Metadata

The review UI now shows:

- backend
- strategy
- engine

That makes it easier to understand why a scan succeeded or struggled.

## Files Changed

- `src/modules/evacuation/ocrEngine.js`
- `src/modules/evacuation/OCRScanner.jsx`
- `scripts/verify-ocr.mjs`

## Verification Added

The OCR verification script now covers:

- single-line patient parsing
- multi-line continuation parsing
- headered tables
- two-column/lane-separated layouts
- vocabulary correction on diagnoses and medications

## Current Limitations

These are the important honest limitations:

### 1. Recognizer is not yet custom-trained on MedTriage data

The engine is custom at the decoding and extraction layer, but not yet at the low-level recognizer weights.

### 2. No learned textline orientation classifier yet

PaddleOCR now has textline orientation support in its broader ecosystem, but this repo does not yet package that model.

### 3. No true document unwarping yet

We do image cleanup and multi-pass preprocessing, but not neural page unwarping.

### 4. No dedicated KIE model yet

Field extraction is still rule-guided and hypothesis-guided, not learned end-to-end from document layout examples.

## Roadmap to a Truly Custom OCR Engine

### Phase 1. Build the data engine

Create a de-identified corpus of:

- printed patient lists
- whiteboard captures
- handwritten ward lists
- mixed Arabic/English sheets
- low-light / skewed / partial phone captures

Targets:

- 2,000 to 5,000 real crops for recognition
- 500 to 1,000 full-page layouts for structured extraction

### Phase 2. Build synthetic MedTriage data

Use SynthTIGER-style generation to produce:

- Arabic name sequences
- English medication and diagnosis tokens
- bed/room identifiers
- ward headers
- table and whiteboard layouts
- blur, glare, tilt, compression, marker bleed, low-contrast noise

### Phase 3. Fine-tune recognizers

Train two lightweight recognizers:

- Arabic patient-name recognizer
- Latin clinical-token recognizer

Primary objective:

- minimize character error rate on this exact hospital vocabulary and capture style

### Phase 4. Train a lightweight layout/KIE model

Candidates:

- LayoutLMv3-style document encoder for field extraction
- compact detector + classifier head for field roles
- row/column classifier for ward-sheet formats

### Phase 5. Package models locally

Move from remote Hugging Face fetches to same-origin packaged assets so:

- install-time prewarm is possible
- offline behavior is deterministic
- hospital deployments are less dependent on external network availability during first use

## Evaluation Plan

Do not judge the OCR by raw text only. Track:

- character error rate
- word error rate
- field extraction F1
- patient record exact-match rate
- review-required rate
- false merge rate
- missed patient rate

Safety gates for production:

- zero catastrophic field swaps in validation set
- zero cross-patient merges in golden test scenarios
- high recall on bed, name, age/sex, and diagnosis
- explicit manual review escalation whenever confidence is weak

## Recommendation

The codebase is now in the right shape for a real custom OCR program:

- deployable today
- meaningfully better aligned to MedTriage's mixed-script hospital context
- architected for future recognizer fine-tuning instead of one-off heuristics

The next major leap will not come from more regexes. It will come from data:

1. collect de-identified real examples
2. synthesize hard examples aggressively
3. fine-tune recognizers and layout extraction on MedTriage-specific distributions

That is how this becomes not just a strong OCR feature, but a truly specialized hospital extraction engine.
