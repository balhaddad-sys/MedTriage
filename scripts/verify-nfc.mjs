import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const tmpDir = mkdtempSync(join(tmpdir(), 'medevac-nfc-'));

// Helper to load a module with its dependencies resolved
function loadModule(filename, src) {
  const filepath = join(tmpDir, filename);
  writeFileSync(filepath, src);
  return import(pathToFileURL(filepath).href);
}

// ========== DES / 3DES Crypto Tests ==========
console.log('DES/3DES Crypto:');

const desSrc = readFileSync(resolve('src/modules/evacuation/des.js'), 'utf8');
writeFileSync(join(tmpDir, 'des.mjs'), desSrc);
const des = await import(pathToFileURL(join(tmpDir, 'des.mjs')).href);

// Test DES encrypt/decrypt round-trip
const testKey = new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF]);
const testBlock = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
const encrypted = des.desEncrypt(testKey, testBlock);
const decrypted = des.desDecrypt(testKey, encrypted);
for (let i = 0; i < 8; i++) {
  assert.equal(decrypted[i], testBlock[i], `DES round-trip byte ${i}`);
}
console.log('  DES encrypt/decrypt round-trip: OK');

// Test 3DES encrypt/decrypt round-trip
const testKey16 = new Uint8Array([
  0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF,
  0xFE, 0xDC, 0xBA, 0x98, 0x76, 0x54, 0x32, 0x10,
]);
const enc3 = des.des3Encrypt(testKey16, testBlock);
const dec3 = des.des3Decrypt(testKey16, enc3);
for (let i = 0; i < 8; i++) {
  assert.equal(dec3[i], testBlock[i], `3DES round-trip byte ${i}`);
}
// Verify 3DES output differs from single DES
let differs = false;
for (let i = 0; i < 8; i++) {
  if (enc3[i] !== encrypted[i]) { differs = true; break; }
}
assert.ok(differs, '3DES output should differ from single DES');
console.log('  3DES encrypt/decrypt round-trip: OK');

// Test 3DES-CBC encrypt/decrypt round-trip
const cbcData = new Uint8Array([
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18,
  0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28,
]);
const iv = new Uint8Array(8);
const cbcEnc = des.des3CbcEncrypt(testKey16, cbcData, iv);
const cbcDec = des.des3CbcDecrypt(testKey16, cbcEnc, iv);
for (let i = 0; i < cbcData.length; i++) {
  assert.equal(cbcDec[i], cbcData[i], `CBC round-trip byte ${i}`);
}
assert.equal(cbcEnc.length, 24, 'CBC encrypted length should match');
console.log('  3DES-CBC round-trip (3 blocks): OK');

// Test ISO 9797-1 padding
const padded = des.padISO9797(new Uint8Array([0x01, 0x02, 0x03]));
assert.equal(padded.length, 8, 'padding should round up to 8');
assert.equal(padded[3], 0x80, 'padding byte should be 0x80');
assert.equal(padded[4], 0x00, 'remaining should be 0x00');
const unpadded = des.unpadISO9797(padded);
assert.equal(unpadded.length, 3, 'unpadding should restore original length');
console.log('  ISO 9797-1 padding: OK');

// Test exact block padding
const pad8 = des.padISO9797(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
assert.equal(pad8.length, 16, 'exact block should add full padding block');
assert.equal(pad8[8], 0x80);
console.log('  ISO 9797-1 exact block padding: OK');

// Test retail MAC
const macResult = des.retailMac(testKey16, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
assert.equal(macResult.length, 8, 'MAC should be 8 bytes');
// MAC should be deterministic
const macResult2 = des.retailMac(testKey16, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
for (let i = 0; i < 8; i++) {
  assert.equal(macResult[i], macResult2[i], 'MAC should be deterministic');
}
// Different data should produce different MAC
const macResult3 = des.retailMac(testKey16, new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1]));
let macDiffers = false;
for (let i = 0; i < 8; i++) {
  if (macResult[i] !== macResult3[i]) { macDiffers = true; break; }
}
assert.ok(macDiffers, 'Different data should produce different MAC');
console.log('  Retail MAC: OK');

// Test DES key parity adjustment
const rawKey = new Uint8Array([0x00, 0x02, 0x04, 0x06, 0x08, 0x0A, 0x0C, 0x0E]);
const parityKey = des.adjustParity(rawKey);
for (let i = 0; i < 8; i++) {
  let bits = 0;
  let v = parityKey[i];
  while (v) { bits += v & 1; v >>= 1; }
  assert.equal(bits % 2, 1, `Key byte ${i} should have odd parity`);
}
console.log('  DES key parity: OK');

// ========== BAC Authentication Tests ==========
console.log('\nBAC Authentication:');

// Copy des.mjs so bacAuth can import it
const bacSrc = readFileSync(resolve('src/modules/evacuation/bacAuth.js'), 'utf8')
  .replace("from './des.js'", `from '${pathToFileURL(join(tmpDir, 'des.mjs')).href}'`);
writeFileSync(join(tmpDir, 'bacAuth.mjs'), bacSrc);
const bac = await import(pathToFileURL(join(tmpDir, 'bacAuth.mjs')).href);

// Test key derivation from MRZ
const kseed = await bac.deriveKeySeed('L898902C<', '690806', '940623');
assert.ok(kseed, 'Kseed should be derived');
assert.equal(kseed.length, 16, 'Kseed should be 16 bytes');
console.log('  Key seed derivation: OK');

// Test Kenc derivation
const kenc = await bac.deriveKenc(kseed);
assert.ok(kenc, 'Kenc should be derived');
assert.equal(kenc.length, 16, 'Kenc should be 16 bytes');
console.log('  Kenc derivation: OK');

// Test Kmac derivation
const kmac = await bac.deriveKmac(kseed);
assert.ok(kmac, 'Kmac should be derived');
assert.equal(kmac.length, 16, 'Kmac should be 16 bytes');
// Kenc and Kmac should differ
let kDiffers = false;
for (let i = 0; i < 16; i++) {
  if (kenc[i] !== kmac[i]) { kDiffers = true; break; }
}
assert.ok(kDiffers, 'Kenc and Kmac should be different');
console.log('  Kenc/Kmac difference: OK');

// Test determinism
const kenc2 = await bac.deriveKenc(kseed);
for (let i = 0; i < 16; i++) {
  assert.equal(kenc[i], kenc2[i], 'Key derivation should be deterministic');
}
console.log('  Key derivation determinism: OK');

// Test APDU wrapping produces valid structure
const testSSC = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]);
const wrapped = bac.wrapCommandAPDU(kenc, kmac, testSSC, 0x00, 0xA4, 0x02, 0x0C,
  new Uint8Array([0x01, 0x1E]), null);
assert.ok(wrapped.apdu, 'Wrapped APDU should exist');
assert.ok(wrapped.apdu.length > 10, 'Wrapped APDU should be non-trivial');
assert.equal(wrapped.apdu[0], 0x0C, 'CLA should have SM bit set');
assert.equal(wrapped.apdu[1], 0xA4, 'INS should be preserved');
assert.ok(wrapped.ssc, 'SSC should be returned');
// SSC should have been incremented
assert.equal(wrapped.ssc[7], 0x02, 'SSC should be incremented');
console.log('  APDU wrapping: OK');

// Test wrapping with Le
const wrappedLe = bac.wrapCommandAPDU(kenc, kmac, testSSC, 0x00, 0xB0, 0x00, 0x00, null, 4);
assert.ok(wrappedLe.apdu.length > 5, 'Wrapped APDU with Le should be non-trivial');
console.log('  APDU wrapping with Le: OK');

// ========== MRZ Parser Tests ==========
console.log('\nMRZ Parser:');

const mrzFile = join(tmpDir, 'mrzParser.mjs');
writeFileSync(mrzFile, readFileSync(resolve('src/modules/evacuation/mrzParser.js'), 'utf8'));
const { parseTD1, deriveBACKeySeed, getNationalityLabel, validateMRZ, BLOOD_TYPES } = await import(pathToFileURL(mrzFile).href);

const testLine1 = 'I<KWT2890123452<<<<<<<<<<<<<<';
const testLine2 = '8901152M3003155KWT<<<<<<<<<<<4';
const testLine3 = 'AL<HASHEMI<<BADER<<<<<<<<<<<<<<';

const parsed = parseTD1(testLine1, testLine2, testLine3);
assert.ok(parsed, 'parseTD1 should return a result');
assert.equal(parsed.issuingState, 'KWT');
assert.equal(parsed.sex, 'M');
assert.ok(parsed.fullName.includes('BADER'));
assert.equal(parsed.nationality, 'KWT');
assert.ok(parsed.bacKey);
assert.ok(parsed.dateOfBirth instanceof Date);
assert.ok(parsed.dateOfExpiry instanceof Date);
console.log('  MRZ TD1 parsing: OK');

const keySeedStr = deriveBACKeySeed('289012345', '890115', '300315');
assert.ok(keySeedStr);
console.log('  BAC key seed string: OK');

assert.equal(getNationalityLabel('KWT'), 'Kuwaiti');
assert.equal(getNationalityLabel('IND'), 'Indian');
assert.equal(getNationalityLabel(null), '');
console.log('  Nationality lookup: OK');

const validMrz = validateMRZ('I<KWT28901234567<<<<<<<<<<<<<\n890115<M300315<KWT<<<<<<<<<<<0\nAL<HASHEMI<<BADER<<<<<<<<<<<<<<');
assert.equal(validMrz.valid, true);
assert.equal(validateMRZ('line1\nline2').valid, false);
console.log('  MRZ validation: OK');

assert.equal(BLOOD_TYPES.length, 8);
assert.ok(BLOOD_TYPES.includes('O+'));
console.log('  Blood types: OK');

// ========== NFC Reader Tests ==========
console.log('\nNFC Reader:');

const nfcFile = join(tmpDir, 'nfcReader.mjs');
let nfcSrc = readFileSync(resolve('src/modules/evacuation/nfcReader.js'), 'utf8');
nfcSrc = nfcSrc.replace(/^import .* from .*$/gm, '');
writeFileSync(nfcFile, nfcSrc);
const nfcMod = await import(pathToFileURL(nfcFile).href);

const cid = nfcMod.parseCivilIdNumber('289011500123');
assert.ok(cid);
assert.equal(cid.civilId, '289011500123');
assert.equal(cid.birthYear, 1989);
assert.ok(cid.age > 30);
console.log('  Civil ID parsing: OK');

assert.equal(nfcMod.parseCivilIdNumber('123'), null);
assert.equal(nfcMod.parseCivilIdNumber(''), null);
console.log('  Invalid Civil ID rejection: OK');

assert.equal(nfcMod.validateCivilId('289011500123').valid, true);
assert.equal(nfcMod.validateCivilId('123456').valid, false);
assert.equal(nfcMod.validateCivilId('489011500123').valid, false);
console.log('  Civil ID validation: OK');

const testPatients = [
  { id: '1', civilId: '289011500123', fullName: 'Test' },
  { id: '2', civilId: '300101200456', fullName: 'Other' },
];
assert.equal(nfcMod.findExistingPatient(testPatients, '289011500123').id, '1');
assert.equal(nfcMod.findExistingPatient(testPatients, '289999900000'), null);
assert.equal(nfcMod.findExistingPatient(null, '289011500123'), null);
console.log('  Duplicate detection: OK');

assert.equal(nfcMod.getNfcBackend(), 'manual');
console.log('  NFC backend detection: OK');

// Test photoToDataUrl
const mockPhoto = { format: 'jpeg', data: new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]) };
const dataUrl = nfcMod.photoToDataUrl(mockPhoto);
assert.ok(dataUrl, 'should generate data URL');
assert.ok(dataUrl.startsWith('data:image/jpeg;base64,'), 'should be JPEG data URL');
const jp2Photo = { format: 'jp2', data: new Uint8Array([0x00, 0x00, 0x00, 0x0C]) };
const jp2Url = nfcMod.photoToDataUrl(jp2Photo);
assert.ok(jp2Url.startsWith('data:image/jp2;base64,'), 'should be JP2 data URL');
assert.equal(nfcMod.photoToDataUrl(null), null);
assert.equal(nfcMod.photoToDataUrl({}), null);
console.log('  Photo data URL generation: OK');

// ========== ICAO Reader Tests ==========
console.log('\nICAO Reader:');

// Load icaoReader with bacAuth dependency resolved
let icaoSrc = readFileSync(resolve('src/modules/evacuation/icaoReader.js'), 'utf8');
icaoSrc = icaoSrc.replace("from './bacAuth.js'", `from '${pathToFileURL(join(tmpDir, 'bacAuth.mjs')).href}'`);
writeFileSync(join(tmpDir, 'icaoReader.mjs'), icaoSrc);
const { parseTLV, parseAllTLV, parseDG2, FILE_IDS, DG_TAGS, ICAOReader } = await import(pathToFileURL(join(tmpDir, 'icaoReader.mjs')).href);

const tlvData = [0x61, 0x03, 0x01, 0x02, 0x03];
const tlv = parseTLV(tlvData);
assert.ok(tlv);
assert.equal(tlv.tag, 0x61);
assert.equal(tlv.length, 3);
console.log('  TLV parsing: OK');

const longTlv = [0x61, 0x81, 0x80, ...new Array(128).fill(0xAA)];
const parsedLong = parseTLV(longTlv);
assert.equal(parsedLong.length, 128);
console.log('  Long TLV parsing: OK');

assert.ok(FILE_IDS.EF_COM);
assert.ok(FILE_IDS.EF_DG1);
assert.ok(FILE_IDS.EF_DG2);
assert.ok(FILE_IDS.EF_DG11);
console.log('  ICAO file IDs: OK');

assert.equal(DG_TAGS[0x61], 'DG1');
assert.equal(DG_TAGS[0x75], 'DG2');
assert.equal(DG_TAGS[0x6B], 'DG11');
console.log('  DG tag mapping: OK');

const jpegData = new Uint8Array([0x00, 0x00, 0xFF, 0xD8, 0xFF, 0xE0, 0x01, 0x02, 0xFF, 0xD9]);
const photo = parseDG2(jpegData);
assert.ok(photo);
assert.equal(photo.format, 'jpeg');
console.log('  DG2 photo extraction: OK');

// Test ICAOReader class instantiation
const mockTransceive = async () => [];
const reader = new ICAOReader(mockTransceive);
assert.ok(reader);
assert.equal(reader.isAuthenticated, false, 'should start unauthenticated');
console.log('  ICAOReader instantiation: OK');

// Cleanup
rmSync(tmpDir, { recursive: true, force: true });
console.log('\nNFC verification passed (28 tests)');
