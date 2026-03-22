# IEC 62304 Risk Assessment — MedEvac OCR Engine v5

## 1. System Description

**Product**: MedEvac OCR Engine v5
**Intended Use**: Extract patient data from ward sheet photographs during hospital evacuation events. The OCR output assists clinicians in rapidly digitizing patient lists. All output requires clinician review and confirmation before use in patient care.

**Classification**: Class B software (IEC 62304) — Software that could contribute to a hazardous situation but where the hazardous situation does not result in unacceptable risk after risk control measures are applied.

**Rationale for Class B**: The OCR output is reviewed by a clinician before any patient care decision. The system does not directly control medical devices or administer treatment. However, incorrect OCR output that is not caught during review could lead to patient identification errors during evacuation.

---

## 2. Intended Use and Foreseeable Misuse

### 2.1 Intended Use
- Digitize printed or handwritten ward sheets during evacuation preparation
- Present extracted patient data for clinician review and correction
- Suggest (but not assign) triage categories based on diagnosis text
- Maintain audit trail of all OCR transactions and corrections

### 2.2 Foreseeable Misuse
| Misuse | Risk Level | Mitigation |
|--------|-----------|------------|
| Trusting OCR output without review | HIGH | 3-tier review system (READY/REVIEW/VERIFY), safety flags on auto-inferred fields |
| Using auto-suggested triage as final triage | HIGH | All suggestions marked UNVALIDATED, clinician confirmation required |
| Scanning non-medical documents | LOW | Medical vocabulary validation, low confidence flagging |
| Using in non-evacuation clinical workflow | MEDIUM | System designed for evacuation context only |
| Scanning in poor lighting conditions | MEDIUM | Multi-profile preprocessing, rescue passes, quality scoring |

---

## 3. Hazard Analysis

### 3.1 Hazard Identification

| ID | Hazard | Cause | Severity | Probability | Risk |
|----|--------|-------|----------|-------------|------|
| H-001 | Patient misidentification | OCR misreads name | Critical | Moderate | HIGH |
| H-002 | Wrong triage assignment | OCR misreads diagnosis, auto-triage suggests wrong level | Critical | Low | MEDIUM |
| H-003 | Missed patient on list | OCR fails to detect a patient row | Major | Low | MEDIUM |
| H-004 | Wrong medication listed | OCR misreads medication name | Critical | Moderate | HIGH |
| H-005 | Wrong allergy information | OCR misreads allergy field | Critical | Low | MEDIUM |
| H-006 | Duplicate patient entry | OCR creates two records for same patient | Minor | Moderate | LOW |
| H-007 | Wrong bed assignment | OCR misreads bed number | Major | Low | LOW |
| H-008 | Gender misassignment (auto-inferred) | Name-based gender prediction incorrect | Minor | Moderate | LOW |

### 3.2 Risk Control Measures

| Hazard | Control Measure | Residual Risk |
|--------|----------------|---------------|
| H-001 | Mandatory REVIEW flag when name confidence < 0.6, multi-pass consensus | LOW |
| H-002 | Triage decoupled from OCR, marked UNVALIDATED, requires clinician confirmation | LOW |
| H-003 | Multi-profile preprocessing, rescue passes, quality band reporting | LOW |
| H-004 | Fuzzy matching against pharmacology database, clinical cross-checks | MEDIUM |
| H-005 | CLINICAL_ALERT warning when medication-allergy cross-check fails | LOW |
| H-006 | OCR deduplication with edit-distance matching, bed-based merge | LOW |
| H-007 | Bed confidence scoring, REVIEW flag when bed confidence < 0.65 | LOW |
| H-008 | Safety flag on auto-inferred gender, escalates to REVIEW | LOW |

---

## 4. Software Safety Classification

### 4.1 Software Items

| Item | Classification | Rationale |
|------|---------------|-----------|
| Image Preprocessor | Class A | No direct clinical impact; preprocessing artifacts caught by OCR |
| PaddleOCR Engine (SOUP) | Class B | Core text recognition; errors propagate to patient data |
| Entity Recognizer | Class B | Misclassification could assign wrong field to patient |
| Spatial Clusterer (DBSCAN) | Class B | Incorrect clustering could merge/split patients |
| Clinical Validator | Class B | Cross-checks prevent clinical errors |
| Triage Suggestor | Class B | Suggestions could influence clinician if not clearly flagged |
| Audit Log | Class A | Recording-only; no clinical impact |
| Calibration Engine | Class A | Improves accuracy reporting; does not affect OCR output |

### 4.2 SOUP Components

See [SOUP_documentation.md](SOUP_documentation.md) for detailed SOUP analysis.

---

## 5. Verification and Validation Requirements

### 5.1 Unit-Level Verification
- [ ] Entity recognition accuracy > 90% on test dataset
- [ ] DBSCAN clustering correctly groups > 95% of patient rows
- [ ] Clinical cross-checks detect 100% of gender-diagnosis mismatches
- [ ] Deduplication correctly merges > 98% of duplicate entries

### 5.2 Integration-Level Verification
- [ ] End-to-end CER < 5% on printed ward sheets
- [ ] End-to-end CER < 10% on handwritten ward sheets
- [ ] Patient detection rate > 95% on validation dataset
- [ ] Name field accuracy > 98%
- [ ] Bed field accuracy > 99%
- [ ] Diagnosis field accuracy > 95%

### 5.3 System-Level Validation
- [ ] Validation dataset: minimum 500 ward sheet images with ground truth
- [ ] Confidence calibration: ECE < 0.05 when sufficient training data
- [ ] Audit trail: 100% of transactions logged with image hash
- [ ] Safety flags: 100% of auto-inferred fields flagged as UNVALIDATED
- [ ] Review escalation: all patients with safety flags escalated to REVIEW

### 5.4 Regression Testing
- Automated regression suite runs on every build
- Ground truth dataset versioned alongside code
- Accuracy metrics tracked over time per engine version

---

## 6. Configuration Management

- All OCR engine code under git version control
- SOUP versions pinned in package.json
- Ground truth datasets versioned in training/ directory
- Audit trail persisted in IndexedDB (exportable as JSON/CSV)

---

## 7. Maintenance

- Calibration models refit automatically as correction data accumulates
- Self-learning system (ocrLearner.js) improves vocabulary from corrections
- VLM bridge enables future model upgrades without engine changes
- Audit export enables periodic external review

---

## Document Control

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-03-22 | MedEvac Engineering | Initial risk assessment |
