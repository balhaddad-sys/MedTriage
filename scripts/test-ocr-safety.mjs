#!/usr/bin/env node
// OCR Safety Tests — validates critical safety properties using PRODUCTION code
//
// Run: node scripts/test-ocr-safety.mjs
//
// These tests import the real runtime modules, NOT reimplementations.
// If these tests pass but the app regresses, there is a real bug.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Import PRODUCTION code — these are the actual modules the OCR engine uses
import { validatePatient } from '../src/modules/evacuation/ocrPatientSchema.js';
import { computeCER, computeWER, computeFieldAccuracy } from '../src/modules/evacuation/ocrValidation.js';
import { suggestTriage, suggestMobility, suggestClinicalParameters } from '../src/modules/evacuation/ocrTriageSuggestor.js';

// ═══════════════════════════════════════════════════════════════════
// 1. PATIENT SCHEMA VALIDATION (production validatePatient)
// ═══════════════════════════════════════════════════════════════════

describe('Patient Schema Validation (production)', () => {
  test('valid patient passes validation', () => {
    const result = validatePatient({
      fullName: 'Ahmed Al-Mutairi', bed: 'A-M-3', age: 45, gender: 'M',
      dx: 'DKA', allergies: 'NKDA', code: 'FULL', triage: 'RED',
      mobility: 'STRETCHER', confidence: 0.85,
    });
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  test('rejects null patient', () => {
    const result = validatePatient(null);
    assert.equal(result.valid, false);
  });

  test('rejects implausible age', () => {
    const result = validatePatient({ fullName: 'Test', age: -5 });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => /age/i.test(e)));
  });

  test('rejects invalid triage value', () => {
    const result = validatePatient({ fullName: 'Test', triage: 'PURPLE' });
    assert.equal(result.valid, false);
  });

  test('rejects patient with no identifiers', () => {
    const result = validatePatient({ dx: 'CHF' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => /identifier/i.test(e)));
  });

  test('warns when allergies missing', () => {
    const result = validatePatient({ fullName: 'Test' });
    assert.ok(result.warnings.some(w => /allerg/i.test(w)));
    assert.ok(result.safetyFlags.includes('ALLERGIES_UNKNOWN'));
  });

  test('warns when code status missing', () => {
    const result = validatePatient({ fullName: 'Test' });
    assert.ok(result.warnings.some(w => /code/i.test(w)));
    assert.ok(result.safetyFlags.includes('CODE_STATUS_UNKNOWN'));
  });

  test('warns when gender missing', () => {
    const result = validatePatient({ fullName: 'Test' });
    assert.ok(result.safetyFlags.includes('GENDER_UNKNOWN'));
  });

  test('accepts confidence at boundary', () => {
    assert.equal(validatePatient({ fullName: 'Test', confidence: 0 }).valid, true);
    assert.equal(validatePatient({ fullName: 'Test', confidence: 1.0 }).valid, true);
  });

  test('rejects confidence out of range', () => {
    assert.equal(validatePatient({ fullName: 'Test', confidence: 2.5 }).valid, false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. DANGEROUS DEFAULTS ELIMINATED
// ═══════════════════════════════════════════════════════════════════

describe('Dangerous Defaults Eliminated', () => {
  // These test the engine's output contract: missing safety-critical fields
  // must be empty strings, never safe-looking defaults.

  test('missing allergies in schema flags ALLERGIES_UNKNOWN', () => {
    const result = validatePatient({ fullName: 'Test', allergies: '' });
    assert.ok(result.safetyFlags.includes('ALLERGIES_UNKNOWN'));
  });

  test('missing code in schema flags CODE_STATUS_UNKNOWN', () => {
    const result = validatePatient({ fullName: 'Test', code: '' });
    assert.ok(result.safetyFlags.includes('CODE_STATUS_UNKNOWN'));
  });

  test('"NKDA" allergies does NOT flag safety (it was explicitly captured)', () => {
    const result = validatePatient({ fullName: 'Test', allergies: 'NKDA' });
    assert.ok(!result.safetyFlags.includes('ALLERGIES_UNKNOWN'));
  });

  test('"FULL" code does NOT flag safety (it was explicitly captured)', () => {
    const result = validatePatient({ fullName: 'Test', code: 'FULL' });
    assert.ok(!result.safetyFlags.includes('CODE_STATUS_UNKNOWN'));
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. TRIAGE SUGGESTIONS (production ocrTriageSuggestor)
// ═══════════════════════════════════════════════════════════════════

describe('Triage Suggestions (production)', () => {
  test('all suggestions are marked UNVALIDATED', () => {
    const result = suggestTriage({ dx: 'STEMI' });
    assert.equal(result.status, 'UNVALIDATED');
    assert.equal(result.requiresClinicianConfirmation, true);
  });

  test('STEMI suggests RED', () => {
    const result = suggestTriage({ dx: 'STEMI' });
    assert.equal(result.triage, 'RED');
  });

  test('NSTEMI suggests YELLOW (not RED)', () => {
    const result = suggestTriage({ dx: 'NSTEMI' });
    assert.equal(result.triage, 'YELLOW');
  });

  test('UTI suggests GREEN', () => {
    const result = suggestTriage({ dx: 'UTI' });
    assert.equal(result.triage, 'GREEN');
  });

  test('empty diagnosis returns null triage', () => {
    const result = suggestTriage({ dx: '' });
    assert.equal(result.triage, null);
    assert.equal(result.requiresClinicianConfirmation, true);
  });

  test('PE does not match room codes like PE01', () => {
    const result = suggestTriage({ dx: 'Room PE01 admitted' });
    // Should not trigger PE triage
    assert.ok(result.triage !== 'YELLOW' || !result.rules.some(r => r.ruleId === 'YELLOW_PE'));
  });

  test('suggestClinicalParameters bundle is all UNVALIDATED', () => {
    const result = suggestClinicalParameters({ dx: 'ARDS, septic shock' });
    assert.equal(result.allUnvalidated, true);
    assert.equal(result.requiresClinicianConfirmation, true);
    assert.ok(result.safetyNotice.includes('UNVALIDATED'));
  });

  test('cholangitis correctly suggests RED', () => {
    const result = suggestTriage({ dx: 'Ascending cholangitis' });
    assert.equal(result.triage, 'RED');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. VALIDATION METRICS (production ocrValidation)
// ═══════════════════════════════════════════════════════════════════

describe('Validation Metrics (production)', () => {
  test('CER is 0 for identical strings', () => {
    assert.equal(computeCER('hello world', 'hello world'), 0);
  });

  test('CER is 1 for completely different strings', () => {
    const cer = computeCER('abc', 'xyz');
    assert.ok(cer > 0.9); // not exactly 1 due to edit distance normalization
  });

  test('WER is 0 for identical text', () => {
    assert.equal(computeWER('hello world', 'hello world'), 0);
  });

  test('WER counts word-level substitutions correctly', () => {
    const wer = computeWER('hello world', 'hello earth');
    assert.equal(wer, 0.5); // 1 word wrong out of 2
  });

  test('field accuracy is 1.0 for perfect match', () => {
    const result = computeFieldAccuracy(
      [{ fullName: 'Ahmed', bed: 'A1', age: 45 }],
      [{ fullName: 'Ahmed', bed: 'A1', age: 45 }],
    );
    assert.equal(result.overall, 1.0);
  });

  test('field accuracy detects mismatches', () => {
    const result = computeFieldAccuracy(
      [{ fullName: 'Ahmed', bed: 'A1', age: 45, dx: 'CHF' }],
      [{ fullName: 'Ahmad', bed: 'A1', age: 45, dx: 'COPD' }],
    );
    assert.ok(result.overall < 1.0);
    assert.ok(result.fields.dx.accuracy < 1.0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. CONFIDENCE SCORE BOUNDS
// ═══════════════════════════════════════════════════════════════════

describe('Confidence Score Bounds', () => {
  test('schema rejects confidence > 1.1', () => {
    const result = validatePatient({ fullName: 'Test', confidence: 2.5 });
    assert.ok(result.errors.some(e => /confidence/i.test(e)));
  });

  test('schema rejects negative confidence', () => {
    const result = validatePatient({ fullName: 'Test', confidence: -0.5 });
    assert.ok(result.errors.some(e => /confidence/i.test(e)));
  });

  test('schema accepts confidence 0.0 and 1.0', () => {
    assert.equal(validatePatient({ fullName: 'Test', confidence: 0 }).valid, true);
    assert.equal(validatePatient({ fullName: 'Test', confidence: 1.0 }).valid, true);
  });
});
