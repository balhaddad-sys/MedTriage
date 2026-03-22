# OCR Validation Report — MedEvac v3

**Status**: NOT YET VALIDATED (template only)

This report MUST be completed with real-world clinical data before any
medical-grade claim is made. Synthetic data validation is insufficient.

---

## 1. Validation Dataset

| Metric | Required | Actual | Status |
|--------|----------|--------|--------|
| Total ward sheet images | >= 200 | ___ | [ ] |
| Hospitals represented | >= 3 | ___ | [ ] |
| Printed sheets | >= 100 | ___ | [ ] |
| Handwritten sheets | >= 50 | ___ | [ ] |
| Mixed format sheets | >= 30 | ___ | [ ] |
| Total patients in ground truth | >= 1000 | ___ | [ ] |
| Ground truth verified by clinician | 100% | ___ | [ ] |

## 2. Character-Level Accuracy

| Metric | Threshold | Actual | Pass |
|--------|-----------|--------|------|
| CER (printed) | < 1% | ___ | [ ] |
| CER (handwritten) | < 5% | ___ | [ ] |
| WER (printed) | < 3% | ___ | [ ] |
| WER (handwritten) | < 10% | ___ | [ ] |

## 3. Patient Detection

| Metric | Threshold | Actual | Pass |
|--------|-----------|--------|------|
| Patient detection rate | >= 95% | ___ | [ ] |
| False positive rate | < 2% | ___ | [ ] |
| Duplicate detection rate | >= 98% | ___ | [ ] |

## 4. Field-Level Accuracy

| Field | Threshold | Actual | Pass |
|-------|-----------|--------|------|
| Name accuracy | >= 98% | ___ | [ ] |
| Bed accuracy | >= 99% | ___ | [ ] |
| Diagnosis accuracy | >= 95% | ___ | [ ] |
| Age accuracy | >= 90% | ___ | [ ] |
| Gender accuracy | >= 95% | ___ | [ ] |

## 5. Safety Controls

| Control | Verified | Evidence |
|---------|----------|----------|
| VERIFY escalation on NAME_MISSING | [ ] | ___ |
| VERIFY escalation on BED_MISSING | [ ] | ___ |
| Clinical signoff gate blocks unsafe imports | [ ] | ___ |
| Persistence rejects unidentifiable records | [ ] | ___ |
| Audit trail hash chain verified | [ ] | ___ |
| All auto-inferred fields flagged UNVALIDATED | [ ] | ___ |

## 6. Confidence Calibration

| Metric | Threshold | Actual | Pass |
|--------|-----------|--------|------|
| ECE (Expected Calibration Error) | < 0.05 | ___ | [ ] |
| Calibration samples collected | >= 100 | ___ | [ ] |

## 7. Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Clinical Safety Officer | ___ | ___ | ___ |
| Software Engineer | ___ | ___ | ___ |
| Quality Assurance | ___ | ___ | ___ |

---

**IMPORTANT**: This report is a TEMPLATE. It must be completed with actual
validation results from real clinical ward sheet images. The current codebase
includes synthetic validation data only, which is insufficient for a
medical-grade claim per IEC 62304 requirements.
