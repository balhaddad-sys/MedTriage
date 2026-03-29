# MedTriage OCR System — Security & Code Quality Audit Report

**Date:** 2026-03-23
**Scope:** Full OCR pipeline (frontend JS + Python backend + Docker infrastructure)
**Auditor:** Claude Code automated audit

---

## Executive Summary

The MedTriage OCR system is a well-architected, medical-grade OCR pipeline built on PaddleOCR with extensive domain specialization for Kuwaiti hospital environments. The system demonstrates strong security posture with air-gapped Docker deployment, tamper-evident audit trails, and proper PHI handling. However, several issues were identified across security, correctness, reliability, and compliance.

**Note:** No "Shifu" OCR integration exists in this codebase. The system uses PaddleOCR (via ONNX Runtime Web for browser, native PaddleOCR for server) and optionally DeepSeek-OCR-2 for high-accuracy processing.

**Severity Summary:**
- CRITICAL: 3
- HIGH: 5
- MEDIUM: 8
- LOW: 6

---

## CRITICAL Issues

### C1. VLM Bridge — HTTP (not HTTPS) Communication with No Authentication
**File:** `src/modules/evacuation/ocrVlmBridge.js:14`
**Severity:** CRITICAL

The VLM bridge communicates over plain HTTP (`http://${VLM_HOST}:8701`) with zero authentication. When accessed from a phone over WiFi, medical images containing PHI are sent unencrypted.

```js
const VLM_API_BASE = `http://${VLM_HOST}:8701`;
```

The `/correct` endpoint also accepts arbitrary corrections with no auth:
```js
formData.append('reviewer', reviewer); // No token, no auth
```

**Risk:** Any device on the same network can intercept PHI, inject false OCR corrections, or poison the training pipeline.

**Recommendation:**
- Add mTLS or at minimum a shared secret/bearer token
- Use HTTPS even on local networks (self-signed cert acceptable for air-gapped)
- Validate `reviewer` field against known user list

### C2. Training Data Poisoning via Unauthenticated `/correct` Endpoint
**File:** `training/ocr/vlm/serve.py:104-114`
**Severity:** CRITICAL

The `/correct` endpoint accepts training pairs from any caller without authentication. An attacker on the network can submit false corrections that get persisted to `corrections.jsonl` and eventually fine-tune the model.

```python
@app.post("/correct")
async def submit_correction(
    image_name: str = Form(...),
    original_text: str = Form(...),
    corrected_text: str = Form(...),
    reviewer: str = Form(default="doctor"),  # No verification
):
```

The `MedTermCorrector.learn()` also immediately updates the live dictionary:
```python
self.corrector.learn(original_text, corrected_text)  # Instant effect
```

**Risk:** Model poisoning could cause systematic misrecognition of patient names, medications, or diagnoses — a direct patient safety risk.

**Recommendation:**
- Add authentication (API key, JWT, or mTLS client cert)
- Rate-limit corrections per reviewer
- Require human review before corrections enter the training pipeline
- Add anomaly detection on correction patterns

### C3. Privacy Shield — Incomplete PII Redaction
**File:** `med_ocr/shield.py:24-33`
**Severity:** CRITICAL

The privacy shield only redacts 4 PII patterns (Civil IDs, MRNs, phones, DOBs). It does NOT redact:
- Patient names (the most common PHI in medical OCR)
- Addresses
- Email addresses
- Bed numbers (location identifiers under HIPAA)
- Diagnosis text (protected health information)
- Medication lists (can identify patients)

```python
CIVIL_ID_PATTERN = re.compile(r'\b[123]\d{11}\b')
MRN_PATTERN = re.compile(r'\b(?:MRN|File|ID)[:\s#]*(\d{6,8})\b', re.IGNORECASE)
PHONE_PATTERN = re.compile(r'(?:\+965[\s-]?)?\b\d{4}[\s-]?\d{4}\b')
DOB_PATTERN = re.compile(...)
# No name pattern, no address, no email, no bed
```

**Risk:** If shield.py is used to sanitize text before cloud processing, patient names and diagnoses are sent to external services in cleartext.

**Recommendation:**
- Add NER-based name detection (or at minimum, pattern-match against the 2000+ Kuwaiti name dictionary already in seed data)
- Redact bed numbers, email addresses
- Consider blanket approach: redact everything except known safe medical terms

---

## HIGH Issues

### H1. DeepSeek Backend — `trust_remote_code=True` Without Verification
**File:** `training/ocr/vlm/inference_engine.py:205-210`
**Severity:** HIGH

```python
self.tokenizer = AutoTokenizer.from_pretrained(self.MODEL_ID, trust_remote_code=True)
self.model = AutoModelForCausalLM.from_pretrained(
    self.MODEL_ID,
    trust_remote_code=True,
    ...
)
```

`trust_remote_code=True` allows arbitrary Python execution from the model repository. In an air-gapped environment this is mitigated, but if the model cache is populated before air-gapping, compromised model files could execute arbitrary code.

**Recommendation:**
- Pin exact model revision hashes
- Verify model checksums before loading
- Consider using `trust_remote_code=False` if the model supports it

### H2. SQLite Audit Logger Not Thread-Safe Despite Claim
**File:** `training/ocr/vlm/audit_logger.py:21`
**Severity:** HIGH

The docstring claims "Thread-safe SQLite audit logger" but creates a new connection per method call without any locking. Under concurrent FastAPI requests (uvicorn can use multiple workers), this can cause:
- `database is locked` errors
- Lost audit records
- Corrupt database

```python
def log_action(self, user, action, ...):
    conn = sqlite3.connect(str(self.db_path))  # New connection each time
    try:
        conn.execute("INSERT INTO audit_log ...")
        conn.commit()
    finally:
        conn.close()
```

**Recommendation:**
- Use a connection pool or a single shared connection with threading lock
- Set `check_same_thread=False` and use `threading.Lock`
- Or switch to WAL mode: `PRAGMA journal_mode=WAL`

### H3. Temp File Race Condition in `/ocr` Endpoint
**File:** `training/ocr/vlm/serve.py:64-74`
**Severity:** HIGH

```python
with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
    content = await file.read()
    tmp.write(content)
    tmp_path = tmp.name
```

The file content is fully loaded into memory before writing. For large medical images (e.g., high-res scans at 50MB+), this can cause OOM. No file size limit is enforced.

**Recommendation:**
- Add `max_size` limit to file upload (e.g., 50MB)
- Stream to disk in chunks rather than loading fully into memory
- Consider adding content-type validation (magic bytes check)

### H4. LocalStorage Overflow Risk for Seed Data + Models
**File:** `src/modules/evacuation/ocrLearner.js:70-77`
**Severity:** HIGH

The learner stores all models (2000+ names, 800+ medications, confusion matrices, layouts) in localStorage which has a 5-10MB limit per origin. With 14 seed data modules, the serialized JSON can approach or exceed this limit.

```js
localStorage.setItem(MODELS_KEY, JSON.stringify(models));
```

On overflow, `saveModels` silently catches the error and the learner re-seeds on every page load, causing performance degradation.

**Recommendation:**
- Migrate to IndexedDB (already used for audit log)
- Add size monitoring and data pruning
- Compress with LZ-string before storing

### H5. Batch Endpoint Has No File Count or Size Limit
**File:** `training/ocr/vlm/serve.py:77-101`
**Severity:** HIGH

```python
@app.post("/ocr/batch")
async def process_batch(
    files: list[UploadFile] = File(...),
    ...
):
```

No limit on number of files or total payload size. An attacker (or misconfigured client) could submit thousands of files, causing resource exhaustion on the GPU server.

**Recommendation:**
- Limit batch size (e.g., max 20 files)
- Add total payload size limit
- Add request timeout at the endpoint level

---

## MEDIUM Issues

### M1. Audit Hash Chain — `reviewLevels` Field Mismatch
**File:** `src/modules/evacuation/ocrAuditLog.js:127-131, 300-304`
**Severity:** MEDIUM

The hash chain computation includes `reviewLevels` (plural) in the payload, but the actual record field is named differently:

```js
// In verifyAuditChain (line 129):
reviewLevels: r.reviewLevels,

// In logOcrTransaction (line 303):
reviewLevels: record.reviewLevels,  // This field doesn't exist on the record
```

The record has `patientSummary.byReviewLevel` but no top-level `reviewLevels`. This means the hash is computed over `undefined`, making the chain verification always pass but on wrong data.

**Impact:** Hash chain integrity is weakened — modifications to review level data won't be detected.

### M2. Drug Correction Dictionary Contains Identity Mappings
**File:** `training/ocr/vlm/med_corrector.py:25-147`
**Severity:** MEDIUM

Multiple entries map a correct spelling to itself:
```python
"losartan": "losartan",
"metformin": "metformin",
"spironolactone": "spironolactone",
"fluconazole": "fluconazole",
```

Also duplicate keys that Python silently overwrites:
```python
"warfann": "warfarin",
"warfann": "warfarin",   # duplicate
"enoxapann": "enoxaparin",
"enoxapann": "enoxaparin",  # duplicate
"hepann": "heparin",
"hepann": "heparin",   # duplicate
"furosemde": "furosemide",
"furosemde": "furosemide",  # duplicate
```

**Impact:** Wasted lookup cycles and potential masking of intended correction entries.

### M3. VALID_TRIAGE Missing BLACK and GRAY Categories
**File:** `src/modules/evacuation/ocrPatientSchema.js:7`
**Severity:** MEDIUM

```js
const VALID_TRIAGE = new Set(['RED', 'YELLOW', 'GREEN', '']);
```

But `ocrTriageSuggestor.js` can produce BLACK and GRAY triage levels. Patients triaged as BLACK (deceased/expectant) or GRAY (contaminated) will fail validation.

**Impact:** Valid triage assignments rejected by schema validation.

### M4. `getAuditStats` Performance Issue — Sequential DB Queries in Loop
**File:** `src/modules/evacuation/ocrAuditLog.js:431-438`
**Severity:** MEDIUM

```js
for (const tx of transactions.slice(0, 500)) {
    const corrs = await getCorrections(tx.id);  // 500 sequential DB transactions
    corrections.push(...corrs);
}
```

This opens up to 500 sequential IndexedDB transactions. On a device with many audit records, this will block the UI thread for seconds.

**Recommendation:** Use a single transaction with index range query.

### M5. `stats` Endpoint Leaks File Handles
**File:** `training/ocr/vlm/serve.py:126-131`
**Severity:** MEDIUM

```python
flagged = sum(1 for f in review_dir.glob("*.jsonl")
              for line in open(f) if line.strip())
```

Files opened with `open(f)` are never explicitly closed. In a long-running server, this accumulates file descriptors.

**Recommendation:** Use `with open(f) as fh:` or `Path.read_text()`.

### M6. Phone Number Pattern Too Broad
**File:** `med_ocr/shield.py:30`
**Severity:** MEDIUM

```python
PHONE_PATTERN = re.compile(r'(?:\+965[\s-]?)?\b\d{4}[\s-]?\d{4}\b')
```

This matches any 8-digit number, which could be MRNs, lab values, bed numbers, or other non-phone data. The check `len >= 8` at line 92 doesn't help since the pattern already requires 8 digits.

**Impact:** Over-redaction of non-phone numeric data.

### M7. VLM Fast Path Returns Empty Patient Array
**File:** `src/modules/evacuation/ocrEngine.js:5303-5321`
**Severity:** MEDIUM

When VLM succeeds, the function returns `patients: []` with just raw text:
```js
return {
    patients: [], rawText: vlmResult.rawText,
    ...
};
```

The raw text is returned but no patient parsing is performed. The VLM elements are available in `vlmResult.vlmElements` but never parsed into patient objects.

**Impact:** VLM offload mode provides raw text but no structured patient data, making it unusable for the ward list UI without additional processing.

### M8. Docker Compose Version Deprecated
**File:** `training/ocr/vlm/docker-compose.yml:19`
**Severity:** MEDIUM

```yaml
version: "3.9"
```

The `version` field is deprecated in Docker Compose v2+ and ignored. While not a functional issue, it should be removed for forward compatibility.

---

## LOW Issues

### L1. Duplicate `computeWordLevelWER` Function
**File:** `src/modules/evacuation/ocrValidation.js:52-95`
**Severity:** LOW

`computeWER` and `computeWordLevelWER` are identical functions. The comment says "alias for backwards compatibility" but both are exported and used.

### L2. Redundant Anatomy Self-Mappings
**File:** `training/ocr/vlm/med_corrector.py:152-176`
**Severity:** LOW

Several anatomy corrections map correct spellings to themselves:
```python
"pulmonary": "pulmonary",
"tracheal": "tracheal",
"adrenai": "adrenal",  # also duplicated
```

### L3. Console.log Statements in Production Code
**File:** `src/modules/evacuation/ocrEngine.js` (throughout)
**Severity:** LOW

Extensive `console.log` statements including OCR text content that may contain PHI:
```js
console.log(`[OCR]   ${i}: "${r.text}" ...`);
```

**Recommendation:** Use a log-level system and ensure PHI is never logged.

### L4. Magic Numbers in Handwriting Detection
**File:** `src/modules/evacuation/ocrEngine.js:232`
**Severity:** LOW

```js
return (edgeCount / total) > 0.04 && (edgeCount / total) < 0.30;
```

Thresholds 0.04 and 0.30 are undocumented magic numbers.

### L5. `check_same_thread` Not Set for SQLite in Multi-threaded Context
**File:** `training/ocr/vlm/audit_logger.py:47`
**Severity:** LOW

SQLite connections are created without `check_same_thread=False`. Under uvicorn with async handlers, SQLite may raise errors if connections are used across threads.

### L6. Confidence Allowed to Exceed 1.0
**File:** `src/modules/evacuation/ocrPatientSchema.js:177`
**Severity:** LOW

```js
if (patient.confidence < 0 || patient.confidence > 1.1) {
```

Confidence is validated up to 1.1, not 1.0. The `clamp` function in ocrEngine.js also allows up to 1.08. Confidence scores should be strictly [0, 1].

---

## Positive Findings

The following aspects of the system are well-designed:

1. **Air-gapped Docker deployment** — `internal: true` network prevents data exfiltration
2. **Tamper-evident hash chain** in audit log with SHA-256 linking
3. **Decoupled triage suggestions** — auto-inferred fields are never written to patient records directly
4. **Safety flag system** — every auto-inferred field requires clinician confirmation
5. **Multi-pass OCR with variant consensus** — reduces single-pass errors
6. **Platt scaling confidence calibration** — honest confidence scores
7. **Comprehensive validation framework** with CER/WER/field accuracy metrics
8. **Medical-grade assessment** properly gates on real-world (not synthetic) data
9. **Self-expanding learning cycle** with proper separation of training and inference
10. **Arabic text support** with proper normalization (diacritics, taa marbuta, alef variants)

---

## Recommendations (Priority Order)

1. **Add authentication** to VLM API endpoints (C1, C2)
2. **Expand privacy shield** to cover patient names and diagnoses (C3)
3. **Enable HTTPS** on VLM bridge, even with self-signed certs (C1)
4. **Fix audit hash chain** field name mismatch (M1)
5. **Add BLACK/GRAY** to VALID_TRIAGE set (M3)
6. **Fix file handle leaks** in stats endpoint (M5)
7. **Add request size limits** to upload endpoints (H3, H5)
8. **Migrate learner storage** from localStorage to IndexedDB (H4)
9. **Fix SQLite thread safety** in audit logger (H2, L5)
10. **Clean up drug dictionary** duplicates and identity mappings (M2, L2)
11. **Wire VLM patient parsing** so VLM offload returns structured data (M7)
12. **Strip console.log PHI leaks** from production builds (L3)
