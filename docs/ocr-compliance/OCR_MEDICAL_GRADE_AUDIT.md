# OCR Engine Medical-Grade Audit Report

**Date**: 2026-03-22
**Auditor**: Automated Code Audit (Claude)
**System**: MedEvac OCR Engine v5
**Scope**: Full audit of OCR pipeline to determine medical-grade readiness

---

## Executive Summary

The MedEvac OCR engine is a **well-architected, safety-conscious clinical decision support tool** that demonstrates strong alignment with medical software development practices. However, it does **not yet qualify as "medical-grade"** in the regulatory sense (FDA cleared / CE marked / IEC 62304 fully verified). It is best classified as a **Clinical Helper with a clear pathway to Medical Grade**.

### Verdict: `CLINICAL_HELPER` (with medical-grade architecture)

The system has the *infrastructure* for medical-grade operation but lacks the *evidence* (validated ground truth datasets, prospective clinical testing, completed V&V checklist) to substantiate the claim.

---

## 1. Architecture Assessment

### 1.1 OCR Pipeline (STRONG)

| Component | File | Assessment |
|-----------|------|------------|
| Image Preprocessor | `ocrEngine.js` | Multi-profile (printed/handwritten), CLAHE, Sauvola thresholding, denoising, skew correction. **Robust.** |
| Text Detection/Recognition | PaddleOCR (ONNX) | Production-grade OCR via ONNX Runtime Web. Supports Latin + Arabic. **Adequate for intended use.** |
| Entity Recognition | `ocrEngine.js` | Context-aware entity classification with confidence scoring. **Well-implemented.** |
| Spatial Analysis | `ocrEngine.js` | Multi-hypothesis (row-band, table-grid, DBSCAN). Hypothesis fusion. **Sophisticated.** |
| Clinical Intelligence | `ocrBrain.js` | Disambiguation, context scoring, clinical cross-checks. **Strong clinical awareness.** |
| VLM Bridge | `ocrVlmBridge.js` | Optional DeepSeek-OCR-2 backend with graceful fallback. **Good extensibility.** |

### 1.2 Safety Architecture (STRONG)

| Feature | Assessment |
|---------|------------|
| 3-tier review system (READY/REVIEW/VERIFY) | Correctly escalates uncertain results |
| Safety flags on auto-inferred fields | Prevents silent assumption of safe defaults |
| No dangerous defaults (allergies, code status, gender) | Verified by passing tests |
| Medication fuzzy matching with distance thresholds | Length-proportional edit distance limits |
| Dangerous drug pair prevention | Xanax/Lanox, Zantac/Zyrtec, Lasix/Losec etc. |
| Clinical plausibility checks | Vital ranges, age-diagnosis, gender-diagnosis cross-checks |
| Patient schema validation | Type checks, enum validation, identifier requirements |

### 1.3 Audit & Traceability (STRONG)

| Feature | Assessment |
|---------|------------|
| Immutable audit log (IndexedDB) | Append-only with SHA-256 image hashing |
| Transaction-level detail | Raw OCR, entities, patients, confidence, timing |
| Correction tracking | Ground truth collection for continuous improvement |
| Export (JSON/CSV) | Regulatory review support |
| Session tracking | Per-app-launch session IDs |

### 1.4 Confidence Calibration (STRONG)

| Feature | Assessment |
|---------|------------|
| Platt scaling (Newton-Raphson MLE) | Proper implementation per Platt (1999) |
| Isotonic regression (PAV) | Backup calibrator, properly implemented |
| Automatic method selection | Picks lower ECE between Platt and isotonic |
| Per-field models | Separate calibration for name, bed, age, dx, meds, gender |
| Minimum sample requirement | 30 samples before calibration activates (safe fallback to identity) |

### 1.5 Medical Knowledge Base (STRONG)

| Corpus | Size | Assessment |
|--------|------|------------|
| Diagnoses | 900+ with ICD-10 categories & severity | Comprehensive for evacuation use |
| Medications | 800+ with doses, routes, interactions | Strong pharmacology coverage |
| Lab panels | 300+ tests with normal/critical ranges | CBC, BMP, CMP, cardiac, coag |
| Abbreviations | 500+ clinical abbreviations | Extensive |
| OCR confusion patterns | 50+ character substitution rules | Covers major OCR failure modes |
| Arabic names | 2000+ male/female names | Region-appropriate |

---

## 2. Gaps Preventing Medical-Grade Classification

### 2.1 CRITICAL: No Validated Ground Truth Dataset

**Finding**: The validation framework (`ocrValidation.js`) is well-built but the IEC 62304 verification checklist (Section 5) is entirely unchecked:

```
- [ ] Validation dataset: minimum 500 ward sheet images with ground truth
- [ ] Entity recognition accuracy > 90% on test dataset
- [ ] End-to-end CER < 5% on printed ward sheets
- [ ] Patient detection rate > 95% on validation dataset
- [ ] Name field accuracy > 98%
- [ ] Bed field accuracy > 99%
```

**Impact**: Without validated metrics against a representative dataset, accuracy claims are unsubstantiated. The `assessMedicalGrade()` function would return `UNTESTED` on any real invocation.

**Recommendation**: Create a ground truth dataset of ≥500 labeled ward sheet images across diverse conditions (printed, handwritten, mixed Arabic/English, poor lighting, angled captures) and run `runValidation()` to produce auditable metrics.

### 2.2 CRITICAL: Verification Tests Cannot Run End-to-End

**Finding**: `verify-ocr.mjs` fails with `ERR_MODULE_NOT_FOUND: Cannot find package 'paddleocr'`. The end-to-end OCR verification tests are not executable in the current environment.

**Impact**: The OCR pipeline cannot be regression-tested in CI/CD without a browser or ONNX runtime environment. This means code changes could silently break accuracy.

**Recommendation**: Create a headless test harness (e.g., using jsdom + ONNX Runtime Node) or a Playwright-based integration test suite that can run in CI.

### 2.3 HIGH: No Prospective Clinical Validation

**Finding**: No evidence of prospective testing with real clinicians in simulated or actual evacuation scenarios.

**Impact**: Usability, error detection rates by reviewers, and real-world accuracy under stress conditions are unknown.

**Recommendation**: Conduct a controlled study with ≥5 clinicians reviewing OCR output from ≥100 real ward sheets, measuring:
- Time to review and correct
- Errors caught vs. errors missed
- False correction rate (correct OCR output changed by user)

### 2.4 MEDIUM: SOUP Version Pinning Incomplete

**Finding**: SOUP documentation states "As pinned in package.json" for PaddleOCR and React versions, but does not record the specific tested version numbers. The SOUP change control process exists on paper but has no evidence of execution.

**Recommendation**: Record exact version numbers in the SOUP documentation. Add a CI check that flags SOUP version changes and requires re-running the regression suite.

### 2.5 MEDIUM: No Adversarial/Stress Testing

**Finding**: Safety tests cover schema validation, fuzzy matching, and clinical plausibility, but there are no tests for:
- Adversarial inputs (deliberately crafted images to cause misreads)
- Extreme degradation (very low resolution, heavy noise, partial occlusion)
- Unicode/encoding attacks
- Timing attacks (DoS via large images)

**Recommendation**: Add a stress test suite with adversarial image samples that tests graceful degradation.

### 2.6 MEDIUM: Calibration Cold-Start Problem

**Finding**: Calibration requires 30+ correction samples per field before activating. Until then, raw PaddleOCR confidence scores are passed through uncalibrated, which are known to be poorly calibrated for domain-specific text.

**Impact**: Early users see confidence scores that don't reflect true accuracy, potentially leading to over-trust in high-confidence but incorrect results.

**Recommendation**: Ship with pre-computed calibration parameters from a development ground truth dataset. Fall back to identity only if the pre-computed model is unavailable.

### 2.7 LOW: Privacy Shield Not Integrated Into Main Pipeline

**Finding**: `med_ocr/shield.py` provides PII/PHI redaction but is a standalone Python utility, not integrated into the browser-based OCR pipeline. Images processed in-browser are never redacted.

**Impact**: If images are ever sent to a cloud VLM backend, they may contain unredacted PHI.

**Recommendation**: Ensure the VLM bridge (`ocrVlmBridge.js`) invokes the shield before any cloud transmission, or add client-side PII redaction.

---

## 3. What the System Gets Right

These are genuinely strong practices that exceed what most clinical OCR systems implement:

1. **No dangerous defaults**: Missing allergies → empty (not "NKDA"), missing code status → empty (not "FULL"), missing gender → empty (not "M"). Verified by 41 passing safety tests.

2. **Medication safety**: Length-proportional edit distance thresholds prevent look-alike/sound-alike drug confusion (e.g., Xanax ≠ Lanox). This is a known patient safety issue (ISMP Confused Drug Names List).

3. **Confidence calibration**: Platt scaling + isotonic regression with ECE measurement is the gold standard for classifier calibration. Most OCR systems skip this entirely.

4. **Immutable audit trail**: SHA-256 image hashing, append-only storage, correction tracking, and export capability. This meets or exceeds typical clinical audit requirements.

5. **Clinical context disambiguation**: "AF" maps to atrial fibrillation vs. air fluid level based on surrounding clinical context. This is sophisticated NLP behavior.

6. **Multi-hypothesis spatial analysis**: DBSCAN clustering + row-band + table-grid hypotheses with fusion scoring handles diverse ward sheet layouts without configuration.

7. **Self-learning pipeline**: Correction data feeds back into vocabulary, confusion matrices, and calibration models. The system improves with use.

8. **IEC 62304 risk assessment**: Class B classification with hazard analysis and risk control measures demonstrates regulatory awareness.

---

## 4. Test Results Summary

### Safety Tests: 41/41 PASS

| Suite | Tests | Status |
|-------|-------|--------|
| Patient Schema Validation | 10 | PASS |
| Medication Fuzzy Matching Safety | 12 | PASS |
| Dangerous Defaults Eliminated | 4 | PASS |
| Clinical Plausibility | 6 | PASS |
| Confidence Score Bounds | 3 | PASS |
| Edit Distance | 6 | PASS |

### End-to-End OCR Tests: NOT RUNNABLE

`verify-ocr.mjs` cannot execute due to missing `paddleocr` npm package in the current environment. This is an environment issue, not a code defect, but it means end-to-end accuracy cannot be verified in this audit.

---

## 5. Regulatory Context

| Standard | Status | Notes |
|----------|--------|-------|
| **IEC 62304** | Partial | Risk assessment done. V&V checklist incomplete. |
| **FDA 510(k) / De Novo** | Not applicable | System is clinician-reviewed decision support, likely exempt under clinical decision support criteria (21st Century Cures Act §3060) if it meets transparency requirements. |
| **CE/MDR (EU)** | Not assessed | Would require conformity assessment if marketed in EU. |
| **HIPAA** | Partial | Local-only processing (good). PHI redaction exists but not integrated into VLM bridge. |
| **ISO 13485** | Not assessed | QMS documentation would be required for medical device classification. |

---

## 6. Recommendations (Priority Order)

| Priority | Action | Effort |
|----------|--------|--------|
| P0 | Create validated ground truth dataset (≥500 images) and run `runValidation()` | High |
| P0 | Fix CI test environment so `verify-ocr.mjs` can run in headless mode | Medium |
| P1 | Conduct prospective clinician validation study | High |
| P1 | Ship pre-computed calibration parameters to eliminate cold-start | Low |
| P1 | Pin exact SOUP versions in documentation | Low |
| P2 | Integrate privacy shield into VLM bridge | Medium |
| P2 | Add adversarial/stress test suite | Medium |
| P3 | Pursue FDA clinical decision support exemption analysis | Medium |

---

## 7. Conclusion

The MedEvac OCR engine is **architecturally ready for medical-grade operation**. The safety mechanisms, calibration system, audit trail, and clinical knowledge base are well above average for clinical software. The primary gap is **evidence**: the system needs validated accuracy metrics from a representative dataset and prospective clinical testing to substantiate its medical-grade claims.

**Current Grade**: `CLINICAL_HELPER` — safe for use with mandatory clinician review
**Path to `MEDICAL_GRADE`**: Complete P0 and P1 recommendations above

---

*This audit was performed via static code analysis, safety test execution, and architectural review. It does not constitute a formal regulatory submission or clinical validation.*
