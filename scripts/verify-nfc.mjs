import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

// ========== MRZ Parser Tests ==========

const tmpDir = mkdtempSync(join(tmpdir(), 'medevac-nfc-'));
const mrzFile = join(tmpDir, 'mrzParser.mjs');
writeFileSync(mrzFile, readFileSync(resolve('src/modules/evacuation/mrzParser.js'), 'utf8'));
const { parseTD1, deriveBACKeySeed, getNationalityLabel, validateMRZ, BLOOD_TYPES } = await import(pathToFileURL(mrzFile).href);

// Test TD1 MRZ parsing with a sample Kuwait Civil ID MRZ
// Line 1: I<KWT289012345678<<<<<<<<<<<<
// Line 2: 8901156M3003151KWT<<<<<<<<<<<0
// Line 3: AL<<HASHEMI<<BADER<<<<<<<<<<<<<
const line1 = 'I<KWT28901234567<<<<<<<<<<<<<';
const line2 = '890115<M300315<KWT<<<<<<<<<<<0';
const line3 = 'AL<HASHEMI<<BADER<<<<<<<<<<<<<<';

// Use a valid sample with correct check digits
// Document number: 289012345, DOB: 890115, Expiry: 300315
const testLine1 = 'I<KWT2890123452<<<<<<<<<<<<<<';
const testLine2 = '8901152M3003155KWT<<<<<<<<<<<4';
const testLine3 = 'AL<HASHEMI<<BADER<<<<<<<<<<<<<<';

const parsed = parseTD1(testLine1, testLine2, testLine3);
assert.ok(parsed, 'parseTD1 should return a result');
assert.equal(parsed.issuingState, 'KWT', 'issuing state should be KWT');
assert.equal(parsed.sex, 'M', 'sex should be M');
assert.ok(parsed.fullName.includes('BADER'), 'full name should contain BADER');
assert.ok(parsed.surname.includes('AL HASHEMI') || parsed.surname.includes('AL<HASHEMI') || parsed.surname === 'AL HASHEMI', 'surname should contain AL HASHEMI');
assert.equal(parsed.nationality, 'KWT', 'nationality should be KWT');
assert.ok(parsed.bacKey, 'should produce BAC key components');
assert.ok(parsed.bacKey.documentNumber, 'BAC key should have document number');
assert.ok(parsed.bacKey.dateOfBirth, 'BAC key should have date of birth');
assert.ok(parsed.bacKey.dateOfExpiry, 'BAC key should have date of expiry');
assert.ok(parsed.dateOfBirth instanceof Date, 'dateOfBirth should be a Date');
assert.ok(parsed.dateOfExpiry instanceof Date, 'dateOfExpiry should be a Date');
assert.equal(parsed.age >= 0, true, 'age should be non-negative');

console.log('  MRZ TD1 parsing: OK');

// Test BAC key seed derivation
const keySeed = deriveBACKeySeed('289012345', '890115', '300315');
assert.ok(keySeed, 'BAC key seed should be generated');
assert.ok(keySeed.length > 20, 'BAC key seed should be at least 20 chars');
console.log('  BAC key derivation: OK');

// Test nationality label lookup
assert.equal(getNationalityLabel('KWT'), 'Kuwaiti');
assert.equal(getNationalityLabel('IND'), 'Indian');
assert.equal(getNationalityLabel('PAK'), 'Pakistani');
assert.equal(getNationalityLabel('EGY'), 'Egyptian');
assert.equal(getNationalityLabel('XXX'), 'XXX'); // Unknown returns code
assert.equal(getNationalityLabel(''), '');
assert.equal(getNationalityLabel(null), '');
console.log('  Nationality lookup: OK');

// Test MRZ validation
const validMrz = validateMRZ('I<KWT28901234567<<<<<<<<<<<<<\n890115<M300315<KWT<<<<<<<<<<<0\nAL<HASHEMI<<BADER<<<<<<<<<<<<<<');
assert.equal(validMrz.valid, true, 'valid MRZ should pass');
assert.equal(validMrz.lines.length, 3, 'should have 3 lines');

const invalidMrz = validateMRZ('line1\nline2');
assert.equal(invalidMrz.valid, false, 'two-line MRZ should fail');
console.log('  MRZ validation: OK');

// Test blood types list
assert.equal(BLOOD_TYPES.length, 8, 'should have 8 blood types');
assert.ok(BLOOD_TYPES.includes('O+'), 'should include O+');
assert.ok(BLOOD_TYPES.includes('AB-'), 'should include AB-');
console.log('  Blood types: OK');

// ========== NFC Reader Tests ==========

const nfcFile = join(tmpDir, 'nfcReader.mjs');
// Strip the import lines (they reference other modules) and test standalone functions
let nfcSrc = readFileSync(resolve('src/modules/evacuation/nfcReader.js'), 'utf8');
// Remove import lines that would fail in Node
nfcSrc = nfcSrc.replace(/^import .* from .*$/gm, '');
writeFileSync(nfcFile, nfcSrc);
const nfcMod = await import(pathToFileURL(nfcFile).href);

// Test parseCivilIdNumber
const cid = nfcMod.parseCivilIdNumber('289011500123');
assert.ok(cid, 'should parse valid Civil ID');
assert.equal(cid.civilId, '289011500123');
assert.equal(cid.birthYear, 1989);
assert.equal(cid.birthMonth, 1);
assert.equal(cid.birthDay, 15);
assert.ok(cid.age > 30, 'age should be > 30 for 1989 birth');
console.log('  Civil ID parsing: OK');

// Test invalid Civil ID
assert.equal(nfcMod.parseCivilIdNumber('123'), null, 'short ID should return null');
assert.equal(nfcMod.parseCivilIdNumber(''), null, 'empty ID should return null');
console.log('  Invalid Civil ID rejection: OK');

// Test validateCivilId
const valid = nfcMod.validateCivilId('289011500123');
assert.equal(valid.valid, true);
const invalid = nfcMod.validateCivilId('123456');
assert.equal(invalid.valid, false);
const badPrefix = nfcMod.validateCivilId('489011500123');
assert.equal(badPrefix.valid, false);
console.log('  Civil ID validation: OK');

// Test findExistingPatient
const patients = [
  { id: '1', civilId: '289011500123', fullName: 'Test' },
  { id: '2', civilId: '300101200456', fullName: 'Other' },
];
const found = nfcMod.findExistingPatient(patients, '289011500123');
assert.ok(found, 'should find existing patient');
assert.equal(found.id, '1');
const notFound = nfcMod.findExistingPatient(patients, '289999900000');
assert.equal(notFound, null, 'should not find non-existent patient');
const nullCheck = nfcMod.findExistingPatient(null, '289011500123');
assert.equal(nullCheck, null, 'should handle null patients');
console.log('  Duplicate detection: OK');

// Test getNfcBackend (in Node, should return 'manual')
const backend = nfcMod.getNfcBackend();
assert.equal(backend, 'manual', 'Node.js should return manual backend');
console.log('  NFC backend detection: OK');

// ========== ICAO Reader Tests ==========

const icaoFile = join(tmpDir, 'icaoReader.mjs');
writeFileSync(icaoFile, readFileSync(resolve('src/modules/evacuation/icaoReader.js'), 'utf8'));
const { parseTLV, parseAllTLV, parseDG2, FILE_IDS, DG_TAGS } = await import(pathToFileURL(icaoFile).href);

// Test TLV parser
const tlvData = [0x61, 0x03, 0x01, 0x02, 0x03];
const tlv = parseTLV(tlvData);
assert.ok(tlv, 'should parse TLV');
assert.equal(tlv.tag, 0x61);
assert.equal(tlv.length, 3);
assert.equal(tlv.value.length, 3);
console.log('  TLV parsing: OK');

// Test multi-byte length TLV
const longTlv = [0x61, 0x81, 0x80, ...new Array(128).fill(0xAA)];
const parsedLong = parseTLV(longTlv);
assert.ok(parsedLong, 'should parse long-form TLV');
assert.equal(parsedLong.length, 128);
console.log('  Long TLV parsing: OK');

// Test FILE_IDS exist
assert.ok(FILE_IDS.EF_COM, 'EF_COM file ID should exist');
assert.ok(FILE_IDS.EF_DG1, 'EF_DG1 file ID should exist');
assert.ok(FILE_IDS.EF_DG2, 'EF_DG2 file ID should exist');
assert.ok(FILE_IDS.EF_DG11, 'EF_DG11 file ID should exist');
console.log('  ICAO file IDs: OK');

// Test DG_TAGS mapping
assert.equal(DG_TAGS[0x61], 'DG1');
assert.equal(DG_TAGS[0x75], 'DG2');
assert.equal(DG_TAGS[0x6B], 'DG11');
console.log('  DG tag mapping: OK');

// Test JPEG detection in DG2
const jpegData = new Uint8Array([0x00, 0x00, 0xFF, 0xD8, 0xFF, 0xE0, 0x01, 0x02, 0xFF, 0xD9]);
const photo = parseDG2(jpegData);
assert.ok(photo, 'should find JPEG in DG2 data');
assert.equal(photo.format, 'jpeg');
console.log('  DG2 photo extraction: OK');

// Cleanup
rmSync(tmpDir, { recursive: true, force: true });
console.log('\nNFC verification passed');
