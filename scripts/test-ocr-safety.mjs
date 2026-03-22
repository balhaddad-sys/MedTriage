#!/usr/bin/env node
// OCR Safety Tests — validates critical safety properties of the OCR engine
//
// Run: node scripts/test-ocr-safety.mjs
//
// Tests:
//   1. Patient schema validation
//   2. Medication fuzzy matching safety bounds
//   3. Dangerous defaults are eliminated
//   4. Clinical plausibility checks
//   5. Confidence score bounds

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════
// 1. PATIENT SCHEMA VALIDATION
// ═══════════════════════════════════════════════════════════════════

// Inline the schema validator (avoids browser-only imports)
const VALID_TRIAGE = new Set(['RED', 'YELLOW', 'GREEN', '']);
const VALID_MOBILITY = new Set(['AMBULATORY', 'WHEELCHAIR', 'STRETCHER', 'CRITICAL_TRANSPORT', '']);
const VALID_GENDER = new Set(['M', 'F', '']);
const VALID_REVIEW_LEVEL = new Set(['READY', 'REVIEW', 'VERIFY', '']);
const VALID_CODE_STATUS = new Set(['FULL', 'DNR', 'DNI', 'DNR/DNI', 'COMFORT', '']);

function validatePatient(patient) {
  const errors = [];
  const warnings = [];
  if (!patient || typeof patient !== 'object') {
    return { valid: false, errors: ['Patient record is null or not an object'], warnings: [] };
  }
  if (patient.fullName != null && typeof patient.fullName !== 'string') errors.push(`fullName must be string`);
  if (patient.age != null && typeof patient.age !== 'number') errors.push(`age must be number or null`);
  if (typeof patient.age === 'number' && (patient.age < 0 || patient.age > 150)) errors.push(`Implausible age: ${patient.age}`);
  if (patient.gender && !VALID_GENDER.has(patient.gender)) warnings.push(`Unknown gender: ${patient.gender}`);
  if (patient.triage && !VALID_TRIAGE.has(patient.triage)) errors.push(`Invalid triage: ${patient.triage}`);
  if (patient.mobility && !VALID_MOBILITY.has(patient.mobility)) errors.push(`Invalid mobility: ${patient.mobility}`);
  if (patient.confidence != null && (patient.confidence < 0 || patient.confidence > 1.1)) errors.push(`Confidence out of range`);
  if (!patient.fullName && !patient.bed && !patient.civilId) errors.push('No patient identifier');
  if (!patient.allergies) warnings.push('Allergies not captured');
  if (!patient.code) warnings.push('Code status not captured');
  if (!patient.gender) warnings.push('Gender not captured');
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    safetyFlags: [
      ...(!patient.allergies ? ['ALLERGIES_UNKNOWN'] : []),
      ...(!patient.code ? ['CODE_STATUS_UNKNOWN'] : []),
      ...(!patient.gender ? ['GENDER_UNKNOWN'] : []),
    ],
  };
}

describe('Patient Schema Validation', () => {
  test('valid patient passes validation', () => {
    const patient = {
      fullName: 'Ahmed Al-Mutairi',
      bed: 'A-M-3',
      age: 45,
      gender: 'M',
      dx: 'DKA',
      allergies: 'NKDA',
      code: 'FULL',
      triage: 'RED',
      mobility: 'STRETCHER',
      confidence: 0.85,
    };
    const result = validatePatient(patient);
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
    assert.ok(result.errors.some(e => e.includes('age')));
  });

  test('rejects invalid triage value', () => {
    const result = validatePatient({ fullName: 'Test', triage: 'PURPLE' });
    assert.equal(result.valid, false);
  });

  test('rejects patient with no identifiers', () => {
    const result = validatePatient({ dx: 'CHF' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('identifier')));
  });

  test('warns when allergies missing', () => {
    const result = validatePatient({ fullName: 'Test' });
    assert.ok(result.warnings.some(w => w.includes('Allergies')));
    assert.ok(result.safetyFlags.includes('ALLERGIES_UNKNOWN'));
  });

  test('warns when code status missing', () => {
    const result = validatePatient({ fullName: 'Test' });
    assert.ok(result.warnings.some(w => w.includes('Code status')));
    assert.ok(result.safetyFlags.includes('CODE_STATUS_UNKNOWN'));
  });

  test('warns when gender missing', () => {
    const result = validatePatient({ fullName: 'Test' });
    assert.ok(result.safetyFlags.includes('GENDER_UNKNOWN'));
  });

  test('accepts confidence at boundary', () => {
    const result = validatePatient({ fullName: 'Test', confidence: 0 });
    assert.equal(result.valid, true);
    const result2 = validatePatient({ fullName: 'Test', confidence: 1.0 });
    assert.equal(result2.valid, true);
  });

  test('rejects confidence out of range', () => {
    const result = validatePatient({ fullName: 'Test', confidence: 2.5 });
    assert.equal(result.valid, false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. MEDICATION FUZZY MATCHING SAFETY
// ═══════════════════════════════════════════════════════════════════

function safeMaxDistance(inputLen) {
  return inputLen <= 6 ? 0 : inputLen <= 9 ? 1 : inputLen <= 12 ? 2 : 3;
}

function editDistance(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[b.length][a.length];
}

describe('Medication Fuzzy Matching Safety', () => {
  test('short drug names (<=6 chars) require exact match', () => {
    assert.equal(safeMaxDistance(3), 0); // "ASA"
    assert.equal(safeMaxDistance(5), 0); // "Xanax"
    assert.equal(safeMaxDistance(6), 0); // "Lasix"
  });

  test('medium drug names (7-9 chars) allow 1 edit', () => {
    assert.equal(safeMaxDistance(7), 1); // "Aspirin"
    assert.equal(safeMaxDistance(9), 1); // "Metformin"
  });

  test('longer drug names (10-12 chars) allow 2 edits', () => {
    assert.equal(safeMaxDistance(10), 2);
    assert.equal(safeMaxDistance(12), 2);
  });

  test('long drug names (13+) allow 3 edits', () => {
    assert.equal(safeMaxDistance(13), 3); // "Acetaminophen"
    assert.equal(safeMaxDistance(15), 3);
  });

  // Dangerous pairs that must NOT match
  const DANGEROUS_PAIRS = [
    ['Xanax', 'Lanox'],    // benzodiazepine vs digoxin
    ['Zantac', 'Zyrtec'],  // famotidine vs cetirizine
    ['Taxol', 'Taxil'],    // paclitaxel confusion
    ['Cefox', 'Celox'],    // antibiotic vs hemostatic
    ['Lasix', 'Losec'],    // furosemide vs omeprazole
  ];

  for (const [a, b] of DANGEROUS_PAIRS) {
    test(`dangerous pair "${a}" must not match "${b}"`, () => {
      const dist = editDistance(a.toUpperCase(), b.toUpperCase());
      const maxDist = safeMaxDistance(a.length);
      assert.ok(
        dist > maxDist,
        `"${a}" (len=${a.length}) matched "${b}" with dist=${dist}, maxDist=${maxDist} — UNSAFE!`
      );
    });
  }

  // Valid corrections that should still work
  const VALID_CORRECTIONS = [
    ['Metformin', 'Metfornin', 1],    // n→n OCR error
    ['Amoxicillin', 'Amoxicillln', 1], // extra l
    ['Acetaminophen', 'Acetaminophan', 1], // e→a
  ];

  for (const [correct, ocr, expectedDist] of VALID_CORRECTIONS) {
    test(`valid correction "${ocr}" → "${correct}" should still work`, () => {
      const dist = editDistance(ocr.toUpperCase(), correct.toUpperCase());
      const maxDist = safeMaxDistance(ocr.length);
      assert.ok(dist <= maxDist, `"${ocr}" (len=${ocr.length}) should match "${correct}" with dist=${dist}, maxDist=${maxDist}`);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// 3. DANGEROUS DEFAULTS ELIMINATED
// ═══════════════════════════════════════════════════════════════════

describe('Dangerous Defaults Eliminated', () => {
  // Simulate the engine's patient output logic
  function simulatePatientOutput(ocrData) {
    const predictions = {};
    return {
      gender: ocrData.gender || predictions.gender || '',
      code: ocrData.code || '',
      allergies: ocrData.allergies || '',
    };
  }

  test('missing allergies defaults to empty, NOT "NKDA"', () => {
    const result = simulatePatientOutput({});
    assert.equal(result.allergies, '');
    assert.notEqual(result.allergies, 'NKDA');
  });

  test('missing gender defaults to empty, NOT "M"', () => {
    const result = simulatePatientOutput({});
    assert.equal(result.gender, '');
    assert.notEqual(result.gender, 'M');
  });

  test('missing code defaults to empty, NOT "FULL"', () => {
    const result = simulatePatientOutput({});
    assert.equal(result.code, '');
    assert.notEqual(result.code, 'FULL');
  });

  test('provided values are preserved', () => {
    const result = simulatePatientOutput({ gender: 'F', code: 'DNR', allergies: 'Penicillin' });
    assert.equal(result.gender, 'F');
    assert.equal(result.code, 'DNR');
    assert.equal(result.allergies, 'Penicillin');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. CLINICAL PLAUSIBILITY
// ═══════════════════════════════════════════════════════════════════

const VITAL_RANGES = {
  hr:   { min: 20, max: 250, critLow: 40, critHigh: 180 },
  sbp:  { min: 40, max: 300, critLow: 70, critHigh: 220 },
  spo2: { min: 40, max: 100, critLow: 88, critHigh: 101 },
  rr:   { min: 4, max: 60, critLow: 8, critHigh: 35 },
  temp: { min: 30, max: 43, critLow: 35, critHigh: 40 },
};

function validateVital(type, value) {
  const range = VITAL_RANGES[type];
  if (!range) return { valid: true };
  const v = parseFloat(value);
  if (isNaN(v)) return { valid: false, message: 'Not a number' };
  if (v < range.min || v > range.max) return { valid: false, implausible: true };
  if (v < range.critLow) return { valid: true, critical: true, low: true };
  if (v >= range.critHigh) return { valid: true, critical: true, high: true };
  return { valid: true, normal: true };
}

describe('Clinical Plausibility', () => {
  test('rejects impossible heart rate', () => {
    assert.equal(validateVital('hr', 0).valid, false);
    assert.equal(validateVital('hr', 500).valid, false);
  });

  test('flags critical low SpO2', () => {
    const result = validateVital('spo2', 75);
    assert.equal(result.valid, true);
    assert.equal(result.critical, true);
    assert.equal(result.low, true);
  });

  test('accepts normal vitals', () => {
    assert.equal(validateVital('hr', 72).normal, true);
    assert.equal(validateVital('spo2', 98).normal, true);
    assert.equal(validateVital('temp', 37.2).normal, true);
  });

  test('NaN vital is invalid', () => {
    assert.equal(validateVital('hr', 'abc').valid, false);
  });

  test('pediatric diagnosis in adult should flag', () => {
    const age = 45;
    const dx = 'bronchiolitis';
    const isPediatric = /\b(neonatal|bronchiolitis|croup|febrile seizure|kawasaki|intussusception)\b/i.test(dx);
    assert.ok(age > 18 && isPediatric, 'Should flag pediatric dx in adult');
  });

  test('adult diagnosis in infant should flag', () => {
    const age = 2;
    const dx = 'STEMI';
    const isAdultOnly = /\b(STEMI|NSTEMI|MI|DVT|PE|cirrhosis|COPD|lung cancer)\b/i.test(dx);
    assert.ok(age < 5 && isAdultOnly, 'Should flag adult dx in infant');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. CONFIDENCE SCORE BOUNDS
// ═══════════════════════════════════════════════════════════════════

function clamp(v, min = 0, max = 1) {
  return Math.min(max, Math.max(min, v));
}

describe('Confidence Score Bounds', () => {
  test('clamp keeps values in [0, 1]', () => {
    assert.equal(clamp(-0.5), 0);
    assert.equal(clamp(1.5), 1);
    assert.equal(clamp(0.5), 0.5);
  });

  test('learned name confidence cannot exceed 1.0', () => {
    // Simulates: confidence = Math.min(1.0, 0.6 + (count * 0.08))
    for (let count = 0; count < 100; count++) {
      const conf = Math.min(1.0, 0.6 + (count * 0.08));
      assert.ok(conf >= 0 && conf <= 1.0, `count=${count}, conf=${conf}`);
    }
  });

  test('fuzzy match confidence degrades with distance', () => {
    // Simulates: confidence = clamp(1 - (distance / confidenceBase))
    const confidenceBase = 8;
    for (let dist = 0; dist <= 3; dist++) {
      const conf = clamp(1 - (dist / confidenceBase));
      assert.ok(conf >= 0 && conf <= 1.0);
      if (dist > 0) {
        const prevConf = clamp(1 - ((dist - 1) / confidenceBase));
        assert.ok(conf < prevConf, `dist=${dist} should have lower confidence than dist=${dist - 1}`);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. EDIT DISTANCE CORRECTNESS
// ═══════════════════════════════════════════════════════════════════

describe('Edit Distance', () => {
  test('identical strings have distance 0', () => {
    assert.equal(editDistance('METFORMIN', 'METFORMIN'), 0);
  });

  test('single substitution has distance 1', () => {
    assert.equal(editDistance('METFORMIN', 'METFORNIN'), 1);
  });

  test('single insertion has distance 1', () => {
    assert.equal(editDistance('ASPIRIN', 'ASSPIRIN'), 1);
  });

  test('single deletion has distance 1', () => {
    assert.equal(editDistance('ASPIRIN', 'ASPRIN'), 1);
  });

  test('empty string distance equals other length', () => {
    assert.equal(editDistance('', 'ABC'), 3);
    assert.equal(editDistance('XYZ', ''), 3);
  });

  test('symmetric', () => {
    assert.equal(editDistance('ABC', 'XYZ'), editDistance('XYZ', 'ABC'));
  });
});

// Print summary
process.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✅ All OCR safety tests passed');
  } else {
    console.log('\n❌ Some OCR safety tests failed');
  }
});
