// MRZ (Machine Readable Zone) parser for Kuwait Civil ID (TD1 format)
//
// Kuwait Civil IDs use TD1 format: 3 lines × 30 characters
// Line 1: Document type, issuing state, document number, check digit, optional data
// Line 2: Date of birth, check digit, sex, date of expiry, check digit, nationality, optional data, composite check
// Line 3: Name (surname<<given names)
//
// Reference: ICAO Doc 9303 Part 5

const WEIGHTS = [7, 3, 1];

function charValue(ch) {
  if (ch === '<') return 0;
  const code = ch.charCodeAt(0);
  if (code >= 48 && code <= 57) return code - 48; // 0-9
  if (code >= 65 && code <= 90) return code - 55; // A=10, B=11, ...
  return 0;
}

function computeCheckDigit(str) {
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    sum += charValue(str[i]) * WEIGHTS[i % 3];
  }
  return sum % 10;
}

function cleanField(field) {
  return field.replace(/<+/g, ' ').trim();
}

function parseDate(yymmdd) {
  const yy = parseInt(yymmdd.substring(0, 2), 10);
  const mm = parseInt(yymmdd.substring(2, 4), 10);
  const dd = parseInt(yymmdd.substring(4, 6), 10);
  // For DOB: years > 30 → 1900s, else 2000s
  // For expiry: years > 70 → 1900s, else 2000s
  return { yy, mm, dd };
}

function dobYear(yy) {
  return yy > 30 ? 1900 + yy : 2000 + yy;
}

function expiryYear(yy) {
  return yy > 70 ? 1900 + yy : 2000 + yy;
}

export function parseTD1(line1, line2, line3) {
  if (!line1 || !line2 || !line3) return null;

  const l1 = line1.toUpperCase().padEnd(30, '<');
  const l2 = line2.toUpperCase().padEnd(30, '<');
  const l3 = line3.toUpperCase().padEnd(30, '<');

  if (l1.length < 30 || l2.length < 30 || l3.length < 30) return null;

  const errors = [];

  // Line 1: document type (2), issuing state (3), document number (9), check digit (1), optional (15)
  const docType = cleanField(l1.substring(0, 2));
  const issuingState = cleanField(l1.substring(2, 5));
  const documentNumber = cleanField(l1.substring(5, 14));
  const docNumCheck = parseInt(l1[14], 10);
  const optionalData1 = cleanField(l1.substring(15, 30));

  // Verify document number check digit
  const computedDocCheck = computeCheckDigit(l1.substring(5, 14));
  if (docNumCheck !== computedDocCheck) {
    errors.push('Document number check digit mismatch');
  }

  // Line 2: DOB (6), check (1), sex (1), expiry (6), check (1), nationality (3), optional (11), composite check (1)
  const dobStr = l2.substring(0, 6);
  const dobCheck = parseInt(l2[6], 10);
  const sex = l2[7] === 'F' ? 'F' : l2[7] === 'M' ? 'M' : '<';
  const expiryStr = l2.substring(8, 14);
  const expiryCheck = parseInt(l2[14], 10);
  const nationality = cleanField(l2.substring(15, 18));
  const optionalData2 = cleanField(l2.substring(18, 29));
  const compositeCheck = parseInt(l2[29], 10);

  // Verify DOB check digit
  const computedDobCheck = computeCheckDigit(dobStr);
  if (dobCheck !== computedDobCheck) {
    errors.push('Date of birth check digit mismatch');
  }

  // Verify expiry check digit
  const computedExpiryCheck = computeCheckDigit(expiryStr);
  if (expiryCheck !== computedExpiryCheck) {
    errors.push('Date of expiry check digit mismatch');
  }

  // Verify composite check digit (lines 1[5..30] + lines 2[0..7] + lines 2[8..15] + lines 2[18..29])
  const compositeStr = l1.substring(5, 30) + l2.substring(0, 7) + l2.substring(8, 15) + l2.substring(18, 29);
  const computedComposite = computeCheckDigit(compositeStr);
  if (compositeCheck !== computedComposite) {
    errors.push('Composite check digit mismatch');
  }

  // Line 3: Name (surname << given names)
  const nameParts = l3.split('<<');
  const surname = cleanField(nameParts[0] || '');
  const givenNames = cleanField(nameParts.slice(1).join(' ') || '');

  // Parse dates
  const dob = parseDate(dobStr);
  const expiry = parseDate(expiryStr);

  const birthYear = dobYear(dob.yy);
  const dateOfBirth = new Date(birthYear, dob.mm - 1, dob.dd);
  const age = Math.floor((Date.now() - dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  const expiryFullYear = expiryYear(expiry.yy);
  const dateOfExpiry = new Date(expiryFullYear, expiry.mm - 1, expiry.dd);

  return {
    docType,
    issuingState,
    documentNumber,
    surname,
    givenNames,
    fullName: `${givenNames} ${surname}`.trim(),
    dateOfBirth,
    dateOfBirthRaw: dobStr,
    age: age >= 0 && age < 150 ? age : null,
    sex,
    dateOfExpiry,
    dateOfExpiryRaw: expiryStr,
    nationality,
    optionalData1,
    optionalData2,
    errors,
    valid: errors.length === 0,
    // BAC key components for NFC access control
    bacKey: {
      documentNumber,
      dateOfBirth: dobStr,
      dateOfExpiry: expiryStr,
    },
  };
}

// Derive BAC (Basic Access Control) key seed from MRZ data
// Used to establish encrypted session with the chip
export function deriveBACKeySeed(documentNumber, dateOfBirth, dateOfExpiry) {
  // Pad document number to 9 chars
  const docNum = documentNumber.toUpperCase().padEnd(9, '<');
  const docNumCheckDigit = computeCheckDigit(docNum);
  const dobCheckDigit = computeCheckDigit(dateOfBirth);
  const expiryCheckDigit = computeCheckDigit(dateOfExpiry);

  // MRZ_information = doc_number + check + dob + check + expiry + check
  return `${docNum}${docNumCheckDigit}${dateOfBirth}${dobCheckDigit}${dateOfExpiry}${expiryCheckDigit}`;
}

// ISO 3166-1 alpha-3 nationality codes common in Kuwait
export const NATIONALITY_CODES = {
  KWT: 'Kuwaiti',
  SAU: 'Saudi',
  ARE: 'Emirati',
  BHR: 'Bahraini',
  OMN: 'Omani',
  QAT: 'Qatari',
  IND: 'Indian',
  PAK: 'Pakistani',
  BGD: 'Bangladeshi',
  PHL: 'Filipino',
  EGY: 'Egyptian',
  JOR: 'Jordanian',
  SYR: 'Syrian',
  LBN: 'Lebanese',
  IRQ: 'Iraqi',
  IRN: 'Iranian',
  LKA: 'Sri Lankan',
  NPL: 'Nepali',
  ETH: 'Ethiopian',
  IDN: 'Indonesian',
  GBR: 'British',
  USA: 'American',
  FRA: 'French',
};

export function getNationalityLabel(code) {
  if (!code) return '';
  const upper = code.toUpperCase().trim();
  return NATIONALITY_CODES[upper] || upper;
}

// Blood type options for manual entry (not available via NFC)
export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Validate 3-line MRZ text (from OCR or manual entry)
export function validateMRZ(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length !== 3) return { valid: false, error: `Expected 3 lines, got ${lines.length}` };
  for (let i = 0; i < 3; i++) {
    if (lines[i].length < 28 || lines[i].length > 32) {
      return { valid: false, error: `Line ${i + 1} length ${lines[i].length} not valid (expected ~30)` };
    }
  }
  return { valid: true, lines };
}
