# Test Coverage Analysis — MedTriage

## Current State

The project uses 4 validation scripts (`npm test`) instead of a traditional test framework:

| Script | What it tests | Test cases |
|--------|--------------|------------|
| `validate-protocols.mjs` | Protocol JSON structure (IDs, required fields, step refs) | ~6 checks per protocol |
| `verify-calculators.mjs` | Calculator test case structure (**not the actual formulas**) | 9 test cases |
| `verify-ocr.mjs` | OCR spatial analysis pipeline | 5 scenarios |
| `verify-nfc.mjs` | DES/3DES crypto, BAC auth, MRZ parsing, NFC reading, ICAO | 30+ assertions |

## Critical Gaps

### 1. Calculator formulas are never actually executed (CRITICAL)

`scripts/verify-calculators.mjs` only validates that the test case objects have inputs and min/max ranges — it never imports `CalcEngine.jsx` or calls any `compute()` function. A formula regression (e.g. wrong exponent in CKD-EPI) would pass CI silently.

**Recommendation:** Import `CALCULATORS` from `CalcEngine.jsx`, look up each calculator by name, call `compute()` with test inputs, and assert the result falls within `[min, max]`. Also add tests for `interpret()` to verify clinical staging thresholds.

**Priority: P0** — This is a medical application where incorrect calculator output could lead to patient harm.

### 2. Drug interaction checker has zero test coverage (HIGH)

`InteractionChecker.jsx` and the `INTERACTION_PAIRS` array in `drugData.js` (40+ interaction pairs with severity, mechanism, management) are untested. No verification that:
- Known major interactions (e.g. Warfarin + Amiodarone) are detected
- Bidirectional lookup works (drug1+drug2 == drug2+drug1)
- Severity sorting (Contraindicated > Major > Moderate > Minor) is correct
- No duplicate or conflicting entries exist

**Recommendation:** Create `scripts/verify-interactions.mjs` that:
- Validates all interaction pairs have required fields (drug1, drug2, severity, mechanism, management)
- Checks both drugs exist in `DRUG_DATABASE`
- Verifies no duplicate pairs
- Tests the matching logic with known pairs in both orders
- Validates severity values are from the allowed set

### 3. Input validation and boundary conditions untested (HIGH)

`CalcEngine.jsx` defines `BOUNDS` for 28 clinical parameters and a `validate()` function with hard/soft limits, but these are never tested. Edge cases matter:
- Creatinine of 0 (division by zero in Cockcroft-Gault: `72 * creatinine`)
- Negative age in CKD-EPI (`Math.pow(0.9938, age)`)
- Height of 0 in BMI (`(height/100)**2` → division by zero)
- FiO2 at exactly 0.21 vs 1.0 boundary in A-a gradient

**Recommendation:** Add boundary and edge-case tests for `validate()` and ensure compute functions handle invalid inputs gracefully.

### 4. Unit conversion functions untested (MEDIUM)

`convertUnit()` in `CalcEngine.jsx` handles creatinine (umol/L ↔ mg/dL), glucose (mmol/L ↔ mg/dL), BUN, calcium, and bilirubin conversions. These use specific conversion factors that are never verified against known reference values.

**Recommendation:** Add round-trip conversion tests and verify against standard reference values (e.g., creatinine 88.4 umol/L = 1.0 mg/dL).

### 5. MRZ parser edge cases (MEDIUM)

The MRZ parser has basic tests but lacks coverage for:
- Year boundary logic: `dobYear()` uses `yy > 30` as cutoff — someone born in 2031 would be misclassified as 1931
- Corrupted/partial MRZ data (truncated lines, invalid characters)
- Check digit computation with all edge characters (A-Z, 0-9, <)
- `parseDate()` with invalid months (13, 00) or days (32, 00)

### 6. Storage layer is completely untested (MEDIUM)

`src/data/storage.js` (228 lines) handles:
- IndexedDB CRUD operations
- Multi-layer backup (IndexedDB → localStorage → Cache API)
- Startup recovery with fallback chain
- Auto-export scheduling
- Audit log sorting

None of this is tested. The recovery logic (`recoverData()`) is particularly important — it's the data loss prevention mechanism.

**Recommendation:** Use an IndexedDB mock (e.g. `fake-indexeddb`) to test the CRUD operations, backup scheduling, and recovery fallback chain.

### 7. Audit logging untested (MEDIUM)

`src/data/audit.js` manages context (ward PIN, user ID, device ID) as module-level state and delegates to storage. No tests verify:
- Context is set correctly via `setAuditContext()`
- `logAction()` produces correctly structured entries
- `logTriageChange()` and `logEvacStatusChange()` pass the right action strings
- Partial context (e.g., missing deviceId) is handled

### 8. No tests for clinical scoring interpret() functions (HIGH)

Every calculator has an `interpret()` function that maps numeric results to clinical categories (e.g., GCS 8 → "Severe brain injury", eGFR 14 → "Kidney failure G5"). These clinical staging thresholds are never tested. Incorrect thresholds could lead to wrong triage decisions.

**Recommendation:** Add test cases that verify boundary values for each interpret function:
- eGFR at 89 vs 90 (G2 vs G1)
- GCS at 8 vs 9 (severe vs moderate)
- qSOFA at 1 vs 2 (low risk vs positive)
- Wells PE at 4 vs 4.5 (moderate vs high)

### 9. Protocol data integrity (LOW)

`validate-protocols.mjs` checks structure but not clinical accuracy. For example, it doesn't verify:
- Drug doses in protocol steps match the drug database
- Step decision trees have reachable endpoints (no dead-end paths)
- Timer durations are clinically reasonable (e.g., 2-minute CPR cycles)

### 10. No integration between modules (LOW)

No tests verify that modules work together. For example:
- A drug selected in the Interaction Checker should reference the same drug in DrugMonograph
- Calculator results that inform protocol decisions (e.g., GCS in trauma protocol) use consistent thresholds

## Recommended Implementation Order

| Priority | Area | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Fix calculator verification to actually run formulas | Small | Prevents silent formula regressions in safety-critical calculations |
| **P0** | Add interpret() threshold tests for all calculators | Small | Ensures correct clinical staging |
| **P1** | Add drug interaction verification script | Medium | Validates drug safety data integrity |
| **P1** | Add input validation & boundary tests for CalcEngine | Medium | Prevents division-by-zero and NaN results |
| **P2** | Add unit conversion round-trip tests | Small | Ensures lab value conversions are accurate |
| **P2** | Add MRZ edge case tests | Small | Prevents patient misidentification |
| **P3** | Add storage layer tests with IndexedDB mock | Medium | Verifies data persistence and recovery |
| **P3** | Add audit logging tests | Small | Ensures compliance trail is intact |
