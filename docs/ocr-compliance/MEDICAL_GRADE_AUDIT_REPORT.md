# Medical-Grade OCR Audit Report

**System**: MedEvac OCR Engine v5
**Audit Date**: 2026-03-23
**Scope**: Full architectural, safety, and regulatory readiness audit
**Verdict**: **NOT YET MEDICAL-GRADE** — Strong foundation, critical gaps remain

---

## Executive Summary

The MedTriage OCR system is an exceptionally well-architected clinical OCR pipeline that exceeds what most healthcare software attempts. It implements the right safety patterns (human-in-the-loop, audit trails, calibrated confidence, safety flags). However, **it cannot claim "medical-grade" status today** due to the absence of real-world clinical validation data, centralized audit storage, and formal regulatory sign-off.

**Current grade: `CLINICAL_HELPER`** — suitable as a clinician-supervised digitization aid, not as an autonomous medical data source.

---

## 1. ARCHITECTURE AUDIT

### 1.1 Pipeline Design — PASS

| Component | Assessment | Notes |
|-----------|-----------|-------|
| Image Preprocessing | **Strong** | Otsu, Sauvola adaptive threshold, CLAHE, morphological ops, handwriting detection, rotation rescue — comprehensive |
| OCR Engine (PaddleOCR) | **Adequate** | General-purpose model, not fine-tuned for medical text. VLM bridge available for higher accuracy |
| Entity Recognition | **Strong** | DBSCAN spatial clustering, header-aware role assignment, multi-pass consensus |
| Medical Brain | **Strong** | Context-dependent disambiguation (50+ ambiguous terms), clinical cross-validation, structured extraction |
| Patient Assembly | **Strong** | Schema validation, safety flags, duplicate detection, clinical plausibility checks |
| Confidence Calibration | **Strong** | Platt scaling + isotonic regression, per-field models, ECE tracking, 30-sample minimum |
| Triage Suggestor | **Strong** | Clearly decoupled, marked UNVALIDATED, requires clinician confirmation |
| Audit Trail | **Good with caveats** | SHA-256 hash chain, but device-local only (IndexedDB) |
| Self-Learning | **Good** | Vocabulary expansion from corrections, confusion matrix, word-level mappings |

**Architecture Score: 9/10** — The pipeline design is thorough and well-layered.

### 1.2 Preprocessing Pipeline — PASS

```
Raw Image → Downscale (max 1600px) → Handwriting Detection (edge density)
  → Profile Selection (PRINTED: 4 variants, HANDWRITTEN: 4 variants)
  → Rescue Passes (sharpened, adaptive, handwriting, ±90° rotation)
```

**Strengths**:
- Sauvola adaptive thresholding handles uneven lighting (common in hospital photos)
- Morphological open/close cleans handwriting artifacts
- Rotation rescue catches sideways documents
- Edge-density handwriting detection is a reasonable heuristic

**Weaknesses**:
- `maxDim = 1600` may lose fine detail on dense ward sheets with small text
- No perspective/skew correction for phone photos taken at an angle (Python VLM engine has deskew, JS engine does not)
- Handwriting detection threshold (0.04-0.30 edge density) is not validated against a ground truth set of handwritten vs printed images

### 1.3 OCR Confusion Model — PASS

```javascript
OCR_CONFUSION_GROUPS = [
  ['0', 'O', 'Q', 'D'], ['1', 'I', 'L', '|', '!', 'l'],
  ['5', 'S', '$'], ['rn', 'm'], ['cl', 'd'], ...
]
```

**Assessment**: Correct approach — reduced substitution cost (0.18 vs 1.0) for known OCR confusion pairs. Handles ligature confusion (`rn`→`m`, `cl`→`d`). This is domain-appropriate.

---

## 2. SAFETY AUDIT

### 2.1 Human-in-the-Loop — PASS

| Safety Control | Implemented | Notes |
|---------------|-------------|-------|
| 3-tier review (READY/REVIEW/VERIFY) | Yes | Escalation based on confidence + safety flags |
| Safety flags on auto-inferred fields | Yes | AUTO_INFERRED_GENDER, AUTO_INFERRED_TRIAGE, etc. |
| Critical safety flags block import | Yes | NAME_MISSING, BED_MISSING, AMBIGUOUS_TRIAGE require clinician confirmation |
| Triage suggestions marked UNVALIDATED | Yes | Explicitly decoupled from OCR |
| Clinical plausibility checks | Yes | Age range, gender-diagnosis consistency, drug-condition interactions |
| Missing field warnings | Yes | Allergies, code status, gender flagged when absent |

**This is the strongest aspect of the system.** Every auto-inferred field is flagged. Triage suggestions are explicitly unvalidated. Critical fields missing trigger import blockers.

### 2.2 Patient Identification Safety — PASS WITH CONCERNS

**Strengths**:
- NAME_MISSING and BED_MISSING are critical safety flags
- No patient record can be imported without at least one identifier (name, bed, or civil ID)
- Fuzzy matching against 2000+ name database catches common OCR errors
- Duplicate detection via edit-distance matching

**Concerns**:
- **CRITICAL**: Name field accuracy threshold is set at 98% — meaning 2 in 100 names could be wrong. For patient identification during evacuation, even 1% error rate is significant. The system relies on clinician review to catch these, which is appropriate but must be clearly communicated.
- Fuzzy matching with Levenshtein ≤3 could match "Ahmad" to "Ahmed" — correct culturally, but "Ahmad" to "Ahmas" is also within range and would be incorrect.

### 2.3 Medication Safety — PASS WITH CONCERNS

**Strengths**:
- 800+ medication database with fuzzy matching (≤4 edit distance)
- Drug-condition interaction warnings (e.g., CKD5 + Metformin)
- Pharmacology seed data includes indications, contraindications, dosing
- Drug database includes ATC codes, WHO EML status

**Concerns**:
- **CRITICAL**: Medication OCR errors are the highest-risk failure mode. "Methotrexate" misread as "Metoprolol" (edit distance = 6, exceeds threshold — good). But "Losartan" misread as "Loxapine" (edit distance = 4, within threshold — BAD). The fuzzy matching threshold of ≤4 is too generous for medications.
- No ISMP (Institute for Safe Medication Practices) Tall Man Lettering integration
- No look-alike/sound-alike (LASA) drug pair validation

### 2.4 Triage Safety — PASS

The triage suggestor (`ocrTriageSuggestor.js`) is correctly designed:
- Rule-based with transparent reasoning
- Every suggestion includes confidence + signal explanation
- All marked `UNVALIDATED` until clinician confirmation
- Clinician override creates audit record

This is the right approach — suggestions with mandatory human confirmation.

---

## 3. CONFIDENCE & CALIBRATION AUDIT

### 3.1 Calibration Engine — PASS

| Aspect | Assessment |
|--------|-----------|
| Method | Platt scaling (primary) + isotonic regression (fallback) |
| Per-field models | Yes — name, bed, age, dx, meds, gender, overall |
| Minimum samples | 30 before calibration activates |
| ECE tracking | Yes — Expected Calibration Error computed |
| Reliability diagrams | Yes — exportable for audit |

**This is textbook-correct calibration.** The Platt scaling implementation follows the original Platt (1999) paper with Newton-Raphson optimization and Laplace smoothing. The isotonic regression (Pool Adjacent Violators) is a proper fallback.

### 3.2 Quality Bands — REASONABLE

```
HIGH   (≥0.85): Accept without review
MEDIUM (0.70-0.85): Apply medical correction, accept
LOW    (0.50-0.70): Flag for human review
REJECT (<0.30): Discard
```

**Concern**: The "accept without review" threshold at 0.85 means 15% of HIGH-confidence results could be wrong (before calibration). After calibration, this should be accurate, but calibration requires ≥30 samples. **Until calibration is active, the quality bands are unreliable.**

**Recommendation**: Default to REVIEW for all records until calibration has ≥30 samples per field.

---

## 4. AUDIT TRAIL & COMPLIANCE

### 4.1 Audit Trail — PASS WITH CRITICAL GAP

**Strengths**:
- SHA-256 hash chain (each record includes previous record's hash)
- Image fingerprinting (SHA-256 of source image)
- Append-only transaction log
- Full patient records preserved
- User corrections tracked
- Engine metadata (backend, profile, timing)
- Export to JSON/CSV for regulatory review
- Chain integrity verification (`verifyAuditChain()`)

**CRITICAL GAP**: **Device-local storage only (IndexedDB)**

The audit trail is stored in the browser's IndexedDB. This means:
- Clearing browser data destroys the entire audit trail
- No central server synchronization
- No write-once storage (S3 Object Lock, WORM)
- No independent verification possible
- No retention policy enforcement
- Not accessible for multi-device audit

The code explicitly acknowledges this limitation (line 19-25 of `ocrAuditLog.js`). The localStorage fallback for failed IndexedDB writes is an emergency measure, not a solution.

**Verdict**: The audit trail *design* is medical-grade. The audit trail *storage* is NOT.

### 4.2 PII/PHI Protection — PASS

`med_ocr/shield.py` implements:
- Kuwait Civil ID redaction (`[123]\d{11}`)
- MRN redaction (6-8 digit patterns)
- Phone number redaction (+965 format)
- DOB redaction
- Token-based replacement with encrypted local mapping
- SQLite vault for re-identification

**Note**: The PII shield only operates on the Python pipeline. The JavaScript frontend OCR engine does not have equivalent PII redaction. If OCR results are transmitted anywhere (analytics, crash reports, etc.), patient data could leak.

### 4.3 IEC 62304 Compliance — PARTIAL

The `IEC62304_risk_assessment.md` is well-structured and honest about the system's limitations:
- Correctly classified as Class B software
- Comprehensive hazard analysis (8 hazards identified)
- Risk control measures documented
- SOUP inventory maintained

**Outstanding requirements explicitly listed in the document**:
1. Real-world validation corpus (min 200 images from 3+ hospitals) — **NOT DONE**
2. Field-level accuracy report on real images — **NOT DONE**
3. Signed release SOP (clinical safety officer) — **NOT DONE**
4. External audit of audit trail integrity — **NOT DONE**
5. Retention policy (5+ years) — **NOT DONE**
6. Central audit storage — **NOT DONE**

---

## 5. VALIDATION AUDIT

### 5.1 Validation Framework — PASS

The validation module (`ocrValidation.js`) correctly implements:
- Character Error Rate (CER) via edit distance
- Word Error Rate (WER) via word-level Levenshtein
- Field-level accuracy (per-patient field matching)
- Medical-grade thresholds:
  - CER: <1% printed, <5% handwritten
  - WER: <3% printed, <10% handwritten
  - Patient detection: >95%
  - Name accuracy: >98%
  - Bed accuracy: >99%
  - Diagnosis accuracy: >95%

### 5.2 Medical-Grade Gate — CORRECTLY IMPLEMENTED

```javascript
const grade = !anyData ? 'UNTESTED'
  : syntheticOnly ? 'SYNTHETIC_ONLY'
  : fieldGrade === 'FIELD_UNTESTED' ? 'FIELD_VALIDATION_REQUIRED'
  : (allPass && fieldGrade === 'PASS') ? 'MEDICAL_GRADE'
  : 'CLINICAL_HELPER';
```

**This gate is correct and honest.** The system:
- Refuses to claim MEDICAL_GRADE on synthetic data alone
- Requires field-level accuracy validation (name, bed, dx) — not just raw CER/WER
- Returns `SYNTHETIC_ONLY` when only synthetic ground truth is available
- Returns `FIELD_VALIDATION_REQUIRED` when field-level data is missing

### 5.3 Current Validation Status — SYNTHETIC ONLY

The system has:
- 500 synthetic ground truth samples (`training/ocr/ground-truth/`)
- 50 test result samples (`training/ocr/results/`)
- Zero real-world clinical images validated

**The system correctly reports its own status as SYNTHETIC_ONLY.** This is the honest answer.

---

## 6. GAPS TO MEDICAL-GRADE

### 6.1 Critical Gaps (Must Fix)

| # | Gap | Severity | Effort |
|---|-----|----------|--------|
| G-01 | **No real-world clinical validation** | CRITICAL | High — requires hospital partnership, IRB/ethics approval, image collection |
| G-02 | **Audit trail is device-local only** | CRITICAL | Medium — need server sync + write-once storage |
| G-03 | **No regulatory sign-off** | CRITICAL | Medium — requires clinical safety officer review |
| G-04 | **No PII redaction in JS frontend** | HIGH | Low — port shield.py patterns to JavaScript |
| G-05 | **Medication fuzzy match threshold too generous** | HIGH | Low — reduce from ≤4 to ≤2, add LASA pair checks |

### 6.2 Important Gaps (Should Fix)

| # | Gap | Severity | Effort |
|---|-----|----------|--------|
| G-06 | No deskew/perspective correction in JS engine | MEDIUM | Medium |
| G-07 | Quality bands unreliable before calibration (30 samples) | MEDIUM | Low — default to REVIEW until calibrated |
| G-08 | No CI integration for accuracy regression tracking | MEDIUM | Low |
| G-09 | Handwriting detection thresholds not validated | MEDIUM | Medium |
| G-10 | localStorage model storage not encrypted | LOW | Low |

### 6.3 Nice-to-Have

| # | Gap | Notes |
|---|-----|-------|
| G-11 | ICD-10 code extraction from diagnosis text | Would enable structured reporting |
| G-12 | SNOMED CT mapping | International interoperability |
| G-13 | HL7 FHIR export of OCR results | Integration with hospital systems |

---

## 7. WHAT THE SYSTEM DOES RIGHT

This audit would be incomplete without acknowledging the exceptional quality of the design:

1. **Safety-first architecture**: Every auto-inferred field is flagged. Triage is decoupled and unvalidated. Critical fields block import. This is the correct approach for clinical software.

2. **Honest self-assessment**: The code itself returns `SYNTHETIC_ONLY` and refuses to claim medical-grade status. The IEC 62304 document lists outstanding requirements openly. This is rare and commendable.

3. **Calibrated confidence**: Platt scaling with per-field models is textbook-correct. Most medical AI systems ship uncalibrated confidence scores. This one doesn't.

4. **Tamper-evident audit trail**: SHA-256 hash chain is the right design, even if storage needs upgrading to server-side.

5. **Domain-specific intelligence**: 3000+ hospital terms, OCR confusion matrices, clinical disambiguation, Kuwait-specific data — this isn't a generic OCR wrapper, it's a purpose-built medical system.

6. **Self-improving**: Learns from clinician corrections in real-time. Vocabulary, confusion patterns, and calibration all improve with use.

7. **Comprehensive preprocessing**: Multiple profiles, handwriting detection, rescue passes, rotation variants — handles the reality of hospital document photography.

8. **Clinical cross-validation**: Age-diagnosis plausibility, gender-diagnosis consistency, drug-condition interactions — goes beyond OCR into clinical safety.

---

## 8. VERDICT

### Is it medical-grade?

**No — but it's closer than most systems that claim to be.**

The architecture, safety controls, and design philosophy are medical-grade. The system is honest about its limitations and correctly refuses to overclaim. What's missing is operational maturity:

- Real-world validation with actual clinical images
- Centralized, tamper-proof audit storage
- Formal regulatory review and sign-off
- CI-integrated accuracy regression tracking

### What is it today?

**A well-designed clinical helper** — suitable for clinician-supervised digitization of ward sheets during evacuation, with mandatory human review of all output. The system's own `assessMedicalGrade()` correctly returns `CLINICAL_HELPER` or `SYNTHETIC_ONLY`.

### Path to medical-grade

1. Collect 200+ real ward sheet images from 3+ hospitals (with ethical approval)
2. Run validation, achieve thresholds on real data
3. Implement server-side audit sync with write-once storage
4. Port PII redaction to JavaScript frontend
5. Tighten medication fuzzy matching (≤2 edit distance + LASA pairs)
6. Get clinical safety officer sign-off
7. Run `assessMedicalGrade()` on real-world data — it will tell you when you've arrived

---

## Document Control

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-03-23 | Automated Audit | Initial comprehensive audit |
