// OCR Patient Schema Validation - ensures OCR output meets structural requirements
//
// Every patient record assembled by the OCR engine must pass validation before
// being presented to the user. This catches malformed data, impossible values,
// and dangerous field combinations.

const VALID_TRIAGE = new Set(['RED', 'YELLOW', 'GREEN', '']);
const VALID_MOBILITY = new Set(['AMBULATORY', 'WHEELCHAIR', 'STRETCHER', 'CRITICAL_TRANSPORT', '']);
const VALID_GENDER = new Set(['M', 'F', '']);
const VALID_REVIEW_LEVEL = new Set(['READY', 'REVIEW', 'VERIFY', '']);
const VALID_BLOOD_TYPES = new Set([
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', '',
]);
const VALID_CODE_STATUS = new Set(['FULL', 'DNR', 'DNI', 'DNR/DNI', 'COMFORT', '']);
const VALID_ISO = new Set(['NONE', 'CONTACT', 'DROPLET', 'AIRBORNE', '']);
const SAFETY_FLAG_METADATA = {
  ALLERGIES_UNKNOWN: {
    field: 'allergies',
    reason: 'Allergies not captured - must be verified before medication administration',
  },
  CODE_STATUS_UNKNOWN: {
    field: 'code',
    reason: 'Code status not captured - must be verified',
  },
  GENDER_UNKNOWN: {
    field: 'gender',
    reason: 'Gender not captured - must be verified',
  },
  NAME_MISSING: {
    field: 'name',
    reason: 'Patient name not captured - verify identity before import',
  },
  BED_MISSING: {
    field: 'bed',
    reason: 'Bed or room not captured - verify location before import',
  },
  AUTO_INFERRED_GENDER: {
    field: 'gender',
    reason: 'Gender was auto-inferred - clinician confirmation required',
  },
  AUTO_INFERRED_TRIAGE: {
    field: 'triage',
    reason: 'Triage was auto-inferred - clinician confirmation required',
  },
  AUTO_INFERRED_MOBILITY: {
    field: 'mobility',
    reason: 'Mobility was auto-inferred - clinician confirmation required',
  },
  AUTO_INFERRED_O2: {
    field: 'o2',
    reason: 'O2 requirement was auto-inferred - clinician confirmation required',
  },
  AUTO_INFERRED_ISOLATION: {
    field: 'isolation',
    reason: 'Isolation was auto-inferred - clinician confirmation required',
  },
  AMBIGUOUS_TRIAGE: {
    field: 'triage',
    reason: 'Triage remains ambiguous - manual confirmation required',
  },
  DUPLICATE_SUSPECT: {
    field: 'identity',
    reason: 'Possible duplicate patient record - manual confirmation required',
  },
  CRITICAL_FIELD_LOW_CONFIDENCE: {
    field: 'identity',
    reason: 'Critical OCR field confidence is too low - manual confirmation required',
  },
};
const AUTO_INFERRED_FIELD_CODES = {
  gender: 'AUTO_INFERRED_GENDER',
  triage: 'AUTO_INFERRED_TRIAGE',
  mobility: 'AUTO_INFERRED_MOBILITY',
  o2: 'AUTO_INFERRED_O2',
  iso: 'AUTO_INFERRED_ISOLATION',
  isolation: 'AUTO_INFERRED_ISOLATION',
};
const FIELD_FALLBACK_CODES = {
  allergies: 'ALLERGIES_UNKNOWN',
  code: 'CODE_STATUS_UNKNOWN',
  gender: 'GENDER_UNKNOWN',
  fullname: 'NAME_MISSING',
  name: 'NAME_MISSING',
  bed: 'BED_MISSING',
};

export const CRITICAL_OCR_SAFETY_FLAG_CODES = new Set([
  'NAME_MISSING',
  'BED_MISSING',
  'AMBIGUOUS_TRIAGE',
  'DUPLICATE_SUSPECT',
  'CRITICAL_FIELD_LOW_CONFIDENCE',
]);

// Validate a single patient record - returns { valid, errors, warnings }
export function validatePatient(patient) {
  const errors = [];
  const warnings = [];

  if (!patient || typeof patient !== 'object') {
    return { valid: false, errors: ['Patient record is null or not an object'], warnings: [], safetyFlags: [] };
  }

  const fullName = typeof patient.fullName === 'string' ? patient.fullName.trim() : patient.fullName;
  const bed = typeof patient.bed === 'string' ? patient.bed.trim() : patient.bed;
  const civilId = typeof patient.civilId === 'string' ? patient.civilId.trim() : patient.civilId;
  const allergies = typeof patient.allergies === 'string' ? patient.allergies.trim() : patient.allergies;
  const code = typeof patient.code === 'string' ? patient.code.trim() : patient.code;
  const gender = typeof patient.gender === 'string' ? patient.gender.trim() : patient.gender;

  // Type checks
  if (patient.fullName != null && typeof patient.fullName !== 'string') {
    errors.push(`fullName must be string, got ${typeof patient.fullName}`);
  }
  if (patient.bed != null && typeof patient.bed !== 'string') {
    errors.push(`bed must be string, got ${typeof patient.bed}`);
  }
  if (patient.age != null && typeof patient.age !== 'number') {
    errors.push(`age must be number or null, got ${typeof patient.age}`);
  }
  if (patient.dx != null && typeof patient.dx !== 'string') {
    errors.push(`dx must be string, got ${typeof patient.dx}`);
  }

  // Age plausibility
  if (typeof patient.age === 'number') {
    if (patient.age < 0 || patient.age > 150) {
      errors.push(`Implausible age: ${patient.age}`);
    } else if (patient.age > 120) {
      warnings.push(`Unlikely age: ${patient.age}`);
    }
  }

  // Enum validation
  if (gender && !VALID_GENDER.has(gender)) {
    warnings.push(`Unknown gender value: "${gender}"`);
  }
  if (patient.triage && !VALID_TRIAGE.has(patient.triage)) {
    errors.push(`Invalid triage value: "${patient.triage}"`);
  }
  if (patient.mobility && !VALID_MOBILITY.has(patient.mobility)) {
    errors.push(`Invalid mobility value: "${patient.mobility}"`);
  }
  if (patient.reviewLevel && !VALID_REVIEW_LEVEL.has(patient.reviewLevel)) {
    warnings.push(`Unknown reviewLevel: "${patient.reviewLevel}"`);
  }
  if (code && !VALID_CODE_STATUS.has(code)) {
    warnings.push(`Unknown code status: "${code}"`);
  }
  if (patient.iso && !VALID_ISO.has(patient.iso)) {
    warnings.push(`Unknown isolation: "${patient.iso}"`);
  }

  // Blood type validation
  if (patient.bloodType && !VALID_BLOOD_TYPES.has(patient.bloodType)) {
    warnings.push(`Unknown blood type: "${patient.bloodType}"`);
  }

  // String length safety (prevent garbage data)
  if (typeof patient.fullName === 'string' && patient.fullName.length > 200) {
    errors.push(`Name suspiciously long (${patient.fullName.length} chars)`);
  }
  if (typeof patient.dx === 'string' && patient.dx.length > 1000) {
    warnings.push(`Diagnosis field very long (${patient.dx.length} chars)`);
  }
  if (typeof patient.meds === 'string' && patient.meds.length > 2000) {
    warnings.push(`Medications field very long (${patient.meds.length} chars)`);
  }

  // Civil ID format (Kuwait: 12 digits)
  if (civilId && !/^\d{10,14}$/.test(civilId.replace(/[\s-]/g, ''))) {
    warnings.push(`Civil ID format unexpected: "${civilId}"`);
  }

  // Confidence sanity
  if (patient.confidence != null) {
    if (typeof patient.confidence !== 'number' || patient.confidence < 0 || patient.confidence > 1.1) {
      errors.push(`Confidence out of range: ${patient.confidence}`);
    }
  }

  // Safety: flag when critical fields were not captured by OCR
  if (!fullName && !bed && !civilId) {
    errors.push('No patient identifier (name, bed, or civil ID)');
  }

  // Safety: warn on missing clinically important fields
  if (!allergies) {
    warnings.push('Allergies not captured - must be verified before medication administration');
  }
  if (!code) {
    warnings.push('Code status not captured - must be verified');
  }
  if (!gender) {
    warnings.push('Gender not captured - must be verified');
  }
  if (!fullName) {
    warnings.push('Patient name not captured - verify identity before import');
  }
  if (!bed) {
    warnings.push('Bed or room not captured - verify location before import');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    safetyFlags: [
      ...(!allergies ? ['ALLERGIES_UNKNOWN'] : []),
      ...(!code ? ['CODE_STATUS_UNKNOWN'] : []),
      ...(!gender ? ['GENDER_UNKNOWN'] : []),
      ...(!fullName ? ['NAME_MISSING'] : []),
      ...(!bed ? ['BED_MISSING'] : []),
    ],
  };
}

export function normalizeSafetyFlagCode(flag) {
  if (!flag) return '';
  if (typeof flag === 'string') return flag.trim().toUpperCase();
  if (typeof flag.code === 'string' && flag.code.trim()) return flag.code.trim().toUpperCase();
  if (typeof flag.reason === 'string') {
    const match = flag.reason.match(/\b[A-Z]{2,}(?:_[A-Z]{2,})+\b/);
    if (match) return match[0];
  }

  const fieldKey = normalizeFieldKey(flag.field);
  const reason = `${flag.reason || ''}`.toLowerCase();
  if (reason.includes('auto-inferred') || reason.includes('auto inferred') || reason.includes('inferred')) {
    return AUTO_INFERRED_FIELD_CODES[fieldKey] || '';
  }
  return FIELD_FALLBACK_CODES[fieldKey] || '';
}

export function createSafetyFlag(flag, overrides = {}) {
  const source = flag && typeof flag === 'object' ? flag : {};
  const field = normalizeFieldLabel(overrides.field ?? source.field ?? '');
  const explicitCode = normalizeSafetyFlagCode(overrides.code) || normalizeSafetyFlagCode(flag);
  const inferredCode = /auto-inferred|auto inferred|inferred/i.test(`${overrides.reason || source.reason || ''}`)
    ? AUTO_INFERRED_FIELD_CODES[normalizeFieldKey(field)] || ''
    : FIELD_FALLBACK_CODES[normalizeFieldKey(field)] || '';
  const code = explicitCode || inferredCode;
  const meta = SAFETY_FLAG_METADATA[code] || {};

  return {
    code,
    field: field || meta.field || '',
    reason: overrides.reason ?? source.reason ?? meta.reason ?? (code || 'REQUIRES_VERIFICATION'),
    value: overrides.value ?? source.value ?? '',
    status: overrides.status ?? source.status ?? 'UNVALIDATED',
  };
}

export function collectPatientSafetyFlags(patient, validation = null) {
  const rawFlags = [
    ...(Array.isArray(patient?.safetyFlags) ? patient.safetyFlags : []),
    ...(Array.isArray(patient?.ocrMeta?.autoSafetyFlags) ? patient.ocrMeta.autoSafetyFlags : []),
    ...(Array.isArray(patient?.ocrMeta?.safetyFlags) ? patient.ocrMeta.safetyFlags : []),
    ...(Array.isArray(validation?.safetyFlags) ? validation.safetyFlags : []),
  ];

  const seen = new Set();
  const normalized = [];
  for (const flag of rawFlags) {
    const shaped = createSafetyFlag(flag);
    if (!shaped.code && !shaped.field && !shaped.reason) continue;
    const key = `${shaped.code}|${shaped.field}|${shaped.reason}|${shaped.value}|${shaped.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(shaped);
  }

  return normalized;
}

export function assessOcrImportReadiness(patient, validation = null) {
  const derivedValidation = validation || validatePatient(patient);
  const safetyFlags = collectPatientSafetyFlags(patient, derivedValidation);
  const safetyFlagCodes = [...new Set(safetyFlags.map(flag => normalizeSafetyFlagCode(flag)).filter(Boolean))];
  const criticalSafetyFlagCodes = safetyFlagCodes.filter(code => CRITICAL_OCR_SAFETY_FLAG_CODES.has(code));
  const reviewLevel = patient?.reviewLevel || patient?.ocrMeta?.reviewLevel || '';
  const clinicianConfirmed = Boolean(patient?.ocrMeta?.clinicianConfirmedAt || patient?.ocrMeta?.clinicianConfirmed);
  const needsClinicianConfirmation = Boolean(patient?.ocrImported) && (
    reviewLevel === 'REVIEW' ||
    reviewLevel === 'VERIFY' ||
    safetyFlags.length > 0
  );

  const blockers = [];
  if (!derivedValidation.valid) {
    blockers.push({
      code: 'SCHEMA_INVALID',
      message: derivedValidation.errors[0] || 'Patient record failed validation.',
    });
  }
  if (!patient?.civilId && !patient?.fullName && !patient?.bed) {
    blockers.push({
      code: 'IDENTIFIER_REQUIRED',
      message: 'Patient needs a name, bed, or civil ID before import.',
    });
  }
  if (needsClinicianConfirmation && !clinicianConfirmed) {
    blockers.push({
      code: 'CLINICIAN_CONFIRMATION_REQUIRED',
      message: `${reviewLevel || 'REVIEW'} OCR records require explicit clinician confirmation before import.`,
    });
  }
  if (criticalSafetyFlagCodes.length > 0 && !clinicianConfirmed) {
    blockers.push({
      code: 'CRITICAL_SAFETY_FLAGS',
      message: 'Critical OCR safety flags still need clinician confirmation before import.',
    });
  }

  const uniqueBlockers = dedupeBlockers(blockers);
  return {
    ready: uniqueBlockers.length === 0,
    blockers: uniqueBlockers,
    message: uniqueBlockers[0]?.message || 'Ready to import',
    validation: derivedValidation,
    safetyFlags,
    safetyFlagCodes,
    criticalSafetyFlagCodes,
    reviewLevel,
    clinicianConfirmed,
    needsClinicianConfirmation,
  };
}

// Validate an array of patients - returns summary + per-patient results
export function validatePatientBatch(patients) {
  if (!Array.isArray(patients)) {
    return { valid: false, error: 'Expected array of patients', results: [] };
  }

  const results = patients.map((p, i) => ({
    index: i,
    ...validatePatient(p),
  }));

  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
  const allSafetyFlags = [...new Set(results.flatMap(r => r.safetyFlags))];

  return {
    valid: totalErrors === 0,
    patientCount: patients.length,
    validCount: results.filter(r => r.valid).length,
    invalidCount: results.filter(r => !r.valid).length,
    totalErrors,
    totalWarnings,
    safetyFlags: allSafetyFlags,
    results,
  };
}

function normalizeFieldKey(field) {
  return `${field || ''}`.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function normalizeFieldLabel(field) {
  const key = normalizeFieldKey(field);
  if (key === 'fullname') return 'name';
  if (key === 'iso') return 'isolation';
  return field || SAFETY_FLAG_METADATA[FIELD_FALLBACK_CODES[key]]?.field || '';
}

function dedupeBlockers(blockers) {
  const seen = new Set();
  return blockers.filter(blocker => {
    const key = blocker.code || blocker.message;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
