# SOUP Documentation — Software of Unknown Provenance

## IEC 62304 Clause 8 Compliance

This document identifies and assesses all third-party software components (SOUP) used in the MedEvac OCR Engine v5.

---

## 1. SOUP Inventory

### 1.1 PaddleOCR (via paddleocr npm package)

| Field | Value |
|-------|-------|
| **Name** | PaddleOCR |
| **Publisher** | Baidu / PaddlePaddle |
| **Version** | As pinned in package.json |
| **License** | Apache 2.0 |
| **Purpose** | Text detection and recognition from images |
| **Classification** | Class B — Core OCR functionality |
| **Known Anomalies** | General-purpose model, not fine-tuned for medical text. Known confusion patterns: 0/O, 1/I/l, rn/m, 5/S. Arabic recognition less accurate than Latin. |
| **Risk Assessment** | Misrecognition of characters directly affects patient data. Mitigated by: multi-pass consensus, fuzzy matching, clinical vocabulary correction, mandatory human review. |
| **Verification** | Tested against ground truth datasets. CER and WER metrics tracked. Regression suite runs on updates. |
| **Update Policy** | Version pinned. Updates tested against regression suite before deployment. |

### 1.2 React / React Native

| Field | Value |
|-------|-------|
| **Name** | React |
| **Publisher** | Meta / Facebook |
| **Version** | As pinned in package.json |
| **License** | MIT |
| **Purpose** | UI framework for OCR scanner interface |
| **Classification** | Class A — UI rendering only |
| **Risk Assessment** | UI bugs could affect user interaction but not OCR accuracy. |
| **Verification** | Standard UI testing. |

### 1.3 Web Crypto API (browser built-in)

| Field | Value |
|-------|-------|
| **Name** | Web Crypto API |
| **Publisher** | W3C / Browser vendors |
| **Version** | Platform-dependent |
| **License** | N/A (browser built-in) |
| **Purpose** | SHA-256 hashing for image chain-of-custody |
| **Classification** | Class A — Audit/logging only |
| **Risk Assessment** | Minimal. Hash computation does not affect OCR accuracy. |

### 1.4 IndexedDB (browser built-in)

| Field | Value |
|-------|-------|
| **Name** | IndexedDB |
| **Publisher** | W3C / Browser vendors |
| **Version** | Platform-dependent |
| **License** | N/A (browser built-in) |
| **Purpose** | Persistent storage for audit trail and calibration data |
| **Classification** | Class A — Storage only |
| **Risk Assessment** | Storage failures handled with localStorage fallback. Data loss does not affect OCR accuracy. |

---

## 2. SOUP Risk Matrix

| Component | Failure Mode | Impact on System | Probability | Mitigation |
|-----------|-------------|-----------------|-------------|------------|
| PaddleOCR | Character misrecognition | Wrong patient data extracted | Moderate | Multi-pass, fuzzy matching, clinical validation, human review |
| PaddleOCR | Text detection failure | Patient row missed entirely | Low | Rescue passes, rotated variants, quality scoring |
| PaddleOCR | Model loading failure | OCR unavailable | Low | Preloading on app start, graceful error handling |
| PaddleOCR | Arabic model inaccuracy | Arabic names misread | Moderate | Latin+Arabic fusion, name lexicon matching |
| IndexedDB | Storage full | Audit records not saved | Low | localStorage fallback, size management |
| Web Crypto | API unavailable | No image hash | Low | Graceful fallback to 'hash_unavailable' |

---

## 3. SOUP Verification Strategy

### 3.1 PaddleOCR Verification
1. **Incoming inspection**: Run regression test suite against ground truth on every version update
2. **Anomaly tracking**: Document known confusion patterns (see OCR_CONFUSION_GROUPS in engine)
3. **Performance baseline**: Record CER/WER metrics per version
4. **Rollback plan**: Previous version available in npm cache; pin in package.json

### 3.2 Verification Frequency
- On every SOUP version update
- On every engine code change that affects OCR pipeline
- Monthly regression run against accumulated ground truth

---

## 4. SOUP Change Control

| Step | Action |
|------|--------|
| 1 | Identify new SOUP version |
| 2 | Review changelog for breaking changes |
| 3 | Run full regression test suite |
| 4 | Compare CER/WER metrics against baseline |
| 5 | If metrics regress > 1%, investigate before accepting |
| 6 | Update version pin in package.json |
| 7 | Document change in this file |

---

## Document Control

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-03-22 | MedEvac Engineering | Initial SOUP documentation |
