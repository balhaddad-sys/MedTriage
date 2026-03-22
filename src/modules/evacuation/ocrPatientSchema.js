// OCR Patient Schema Validation — ensures OCR output meets structural requirements
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

// Validate a single patient record — returns { valid, errors, warnings }
export function validatePatient(patient) {
  const errors = [];
  const warnings = [];

  if (!patient || typeof patient !== 'object') {
    return { valid: false, errors: ['Patient record is null or not an object'], warnings: [] };
  }

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
  if (patient.gender && !VALID_GENDER.has(patient.gender)) {
    warnings.push(`Unknown gender value: "${patient.gender}"`);
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
  if (patient.code && !VALID_CODE_STATUS.has(patient.code)) {
    warnings.push(`Unknown code status: "${patient.code}"`);
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
  if (patient.civilId && !/^\d{10,14}$/.test(patient.civilId.replace(/[\s-]/g, ''))) {
    warnings.push(`Civil ID format unexpected: "${patient.civilId}"`);
  }

  // Confidence sanity
  if (patient.confidence != null) {
    if (typeof patient.confidence !== 'number' || patient.confidence < 0 || patient.confidence > 1.1) {
      errors.push(`Confidence out of range: ${patient.confidence}`);
    }
  }

  // Safety: flag when critical fields were not captured by OCR
  if (!patient.fullName && !patient.bed && !patient.civilId) {
    errors.push('No patient identifier (name, bed, or civil ID)');
  }

  // Safety: warn on missing clinically important fields
  if (!patient.allergies) {
    warnings.push('Allergies not captured — must be verified before medication administration');
  }
  if (!patient.code) {
    warnings.push('Code status not captured — must be verified');
  }
  if (!patient.gender) {
    warnings.push('Gender not captured — must be verified');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    safetyFlags: [
      ...(!patient.allergies ? ['ALLERGIES_UNKNOWN'] : []),
      ...(!patient.code ? ['CODE_STATUS_UNKNOWN'] : []),
      ...(!patient.gender ? ['GENDER_UNKNOWN'] : []),
      ...(!patient.fullName ? ['NAME_MISSING'] : []),
      ...(!patient.bed ? ['BED_MISSING'] : []),
    ],
  };
}

// Validate an array of patients — returns summary + per-patient results
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
