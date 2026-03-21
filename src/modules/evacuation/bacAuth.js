// BAC (Basic Access Control) authentication for ICAO 9303 documents
//
// Implements the full BAC protocol to establish a secure session with
// the Kuwait Civil ID chip via NFC. After BAC, all APDUs are wrapped
// in Secure Messaging (SM) with 3DES encryption and retail MAC.
//
// Protocol flow:
// 1. Derive Kseed from MRZ data (doc number + DOB + expiry)
// 2. Derive Kenc and Kmac from Kseed
// 3. GET CHALLENGE from chip → RND.IC
// 4. MUTUAL AUTHENTICATE with encrypted challenge response
// 5. Derive session keys (KSenc, KSmac) and send sequence counter (SSC)
//
// Reference: ICAO Doc 9303 Part 11, Section 4.3

import {
  des3CbcEncrypt,
  des3CbcDecrypt,
  retailMac,
  adjustParity,
  padISO9797,
  unpadISO9797,
} from './des.js';

// ====== SHA-1 via SubtleCrypto ======

async function sha1(data) {
  const buffer = data instanceof Uint8Array ? data.buffer : data;
  const hash = await crypto.subtle.digest('SHA-1', buffer);
  return new Uint8Array(hash);
}

// ====== KEY DERIVATION ======

// Compute MRZ check digit
function mrzCheckDigit(str) {
  const WEIGHTS = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    let val;
    if (ch === '<') val = 0;
    else if (ch >= '0' && ch <= '9') val = ch.charCodeAt(0) - 48;
    else if (ch >= 'A' && ch <= 'Z') val = ch.charCodeAt(0) - 55;
    else val = 0;
    sum += val * WEIGHTS[i % 3];
  }
  return (sum % 10).toString();
}

// Derive Kseed from MRZ data
// documentNumber: 9 chars (padded with '<' if shorter)
// dateOfBirth: 6 chars (YYMMDD)
// dateOfExpiry: 6 chars (YYMMDD)
export async function deriveKeySeed(documentNumber, dateOfBirth, dateOfExpiry) {
  const docNum = documentNumber.toUpperCase().padEnd(9, '<');
  const docCheck = mrzCheckDigit(docNum);
  const dobCheck = mrzCheckDigit(dateOfBirth);
  const expCheck = mrzCheckDigit(dateOfExpiry);

  const mrzInfo = `${docNum}${docCheck}${dateOfBirth}${dobCheck}${dateOfExpiry}${expCheck}`;
  const mrzBytes = new TextEncoder().encode(mrzInfo);
  const hash = await sha1(mrzBytes);

  return hash.slice(0, 16); // Kseed = first 16 bytes of SHA-1
}

// Derive Kenc or Kmac from Kseed
async function deriveKey(kseed, counter) {
  // D = Kseed || counter (4 bytes big-endian)
  const d = new Uint8Array(kseed.length + 4);
  d.set(kseed);
  d[kseed.length] = 0x00;
  d[kseed.length + 1] = 0x00;
  d[kseed.length + 2] = 0x00;
  d[kseed.length + 3] = counter;

  const hash = await sha1(d);

  // Ka = hash[0..7], Kb = hash[8..15]
  const ka = adjustParity(hash.slice(0, 8));
  const kb = adjustParity(hash.slice(8, 16));

  const key = new Uint8Array(16);
  key.set(ka, 0);
  key.set(kb, 8);
  return key;
}

// Derive encryption key (Kenc) from Kseed
export async function deriveKenc(kseed) {
  return deriveKey(kseed, 1);
}

// Derive MAC key (Kmac) from Kseed
export async function deriveKmac(kseed) {
  return deriveKey(kseed, 2);
}

// ====== MUTUAL AUTHENTICATION ======

function concat(...arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

function randomBytes(n) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function performBAC(transceiveFn, documentNumber, dateOfBirth, dateOfExpiry) {
  const ZERO_IV = new Uint8Array(8);

  // Step 1: Derive keys from MRZ
  const kseed = await deriveKeySeed(documentNumber, dateOfBirth, dateOfExpiry);
  const kenc = await deriveKenc(kseed);
  const kmac = await deriveKmac(kseed);

  // Step 2: GET CHALLENGE → RND.IC (8 bytes)
  const challengeCmd = [0x00, 0x84, 0x00, 0x00, 0x08];
  const challengeResp = await transceiveFn(challengeCmd);
  if (!challengeResp || challengeResp.length < 10) {
    throw new Error('GET CHALLENGE failed');
  }
  const sw1 = challengeResp[challengeResp.length - 2];
  const sw2 = challengeResp[challengeResp.length - 1];
  if (sw1 !== 0x90 || sw2 !== 0x00) {
    throw new Error(`GET CHALLENGE failed: SW=${sw1.toString(16)}${sw2.toString(16)}`);
  }
  const rndIC = challengeResp.slice(0, 8);

  // Step 3: Generate IFD random + key
  const rndIFD = randomBytes(8);
  const kIFD = randomBytes(16);

  // Step 4: Build and encrypt S = RND.IFD || RND.IC || K.IFD
  const S = concat(rndIFD, rndIC, kIFD);
  const eIFD = des3CbcEncrypt(kenc, S, ZERO_IV);
  const mIFD = retailMac(kmac, eIFD);

  // Step 5: MUTUAL AUTHENTICATE
  const cmdData = concat(eIFD, mIFD); // 40 bytes
  const authCmd = [0x00, 0x82, 0x00, 0x00, 0x28, ...cmdData, 0x28];
  const authResp = await transceiveFn(authCmd);
  if (!authResp || authResp.length < 42) {
    throw new Error('MUTUAL AUTHENTICATE failed: response too short');
  }
  const authSw1 = authResp[authResp.length - 2];
  const authSw2 = authResp[authResp.length - 1];
  if (authSw1 !== 0x90 || authSw2 !== 0x00) {
    throw new Error(`MUTUAL AUTHENTICATE failed: SW=${authSw1.toString(16)}${authSw2.toString(16)}`);
  }

  // Step 6: Verify response
  const eIC = authResp.slice(0, 32);
  const mIC = authResp.slice(32, 40);

  // Verify MAC
  const computedMIC = retailMac(kmac, eIC);
  for (let i = 0; i < 8; i++) {
    if (mIC[i] !== computedMIC[i]) {
      throw new Error('BAC: MAC verification failed on chip response');
    }
  }

  // Decrypt
  const R = des3CbcDecrypt(kenc, eIC, ZERO_IV);
  // R = RND.IC || RND.IFD || K.IC (32 bytes)

  // Verify RND.IC matches
  for (let i = 0; i < 8; i++) {
    if (R[i] !== rndIC[i]) {
      throw new Error('BAC: RND.IC mismatch in chip response');
    }
  }

  // Verify RND.IFD matches
  for (let i = 0; i < 8; i++) {
    if (R[8 + i] !== rndIFD[i]) {
      throw new Error('BAC: RND.IFD mismatch in chip response');
    }
  }

  const kIC = R.slice(16, 32);

  // Step 7: Derive session keys
  const ksSeed = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    ksSeed[i] = kIFD[i] ^ kIC[i];
  }

  const ksEnc = await deriveKenc(ksSeed);
  const ksMac = await deriveKmac(ksSeed);

  // Step 8: Compute Send Sequence Counter
  // SSC = RND.IC[4..7] || RND.IFD[4..7]
  const ssc = concat(rndIC.slice(4, 8), rndIFD.slice(4, 8));

  return { ksEnc, ksMac, ssc };
}

// ====== SECURE MESSAGING ======

function incrementSSC(ssc) {
  const out = new Uint8Array(ssc);
  for (let i = out.length - 1; i >= 0; i--) {
    out[i] = (out[i] + 1) & 0xFF;
    if (out[i] !== 0) break;
  }
  return out;
}

// Wrap an APDU command in Secure Messaging
export function wrapCommandAPDU(ksEnc, ksMac, ssc, cla, ins, p1, p2, data, le) {
  const ZERO_IV = new Uint8Array(8);
  let currentSSC = incrementSSC(ssc);

  const cmdHeader = new Uint8Array([cla | 0x0C, ins, p1, p2]); // Set SM bit in CLA
  const paddedHeader = padISO9797(cmdHeader);

  let doEncrypted = null;
  if (data && data.length > 0) {
    // Encrypt data: pad, then 3DES-CBC encrypt
    const paddedData = padISO9797(data);
    const encrypted = des3CbcEncrypt(ksEnc, paddedData, ZERO_IV);
    // Build DO'87: tag 87, length, padding indicator 01, encrypted data
    const do87Content = concat(new Uint8Array([0x01]), encrypted);
    doEncrypted = buildDO(0x87, do87Content);
  }

  let doLe = null;
  if (le !== undefined && le !== null) {
    // DO'97: expected response length
    if (le === 0 || le === 256) {
      doLe = new Uint8Array([0x97, 0x01, 0x00]);
    } else {
      doLe = new Uint8Array([0x97, 0x01, le & 0xFF]);
    }
  }

  // Build MAC input: SSC || padded header || DO'87 || DO'97
  let macInput = concat(currentSSC, paddedHeader);
  if (doEncrypted) macInput = concat(macInput, doEncrypted);
  if (doLe) macInput = concat(macInput, doLe);
  macInput = padISO9797(macInput);

  const mac = retailMac(ksMac, macInput);
  // DO'8E: MAC (always 8 bytes)
  const doMac = new Uint8Array([0x8E, 0x08, ...mac]);

  // Build protected APDU data
  let protectedData = new Uint8Array(0);
  if (doEncrypted) protectedData = concat(protectedData, doEncrypted);
  if (doLe) protectedData = concat(protectedData, doLe);
  protectedData = concat(protectedData, doMac);

  // Construct final APDU
  const apdu = [cla | 0x0C, ins, p1, p2, protectedData.length, ...protectedData, 0x00];

  return { apdu, ssc: currentSSC };
}

// Unwrap a Secure Messaging response
export function unwrapResponseAPDU(ksEnc, ksMac, ssc, response) {
  const ZERO_IV = new Uint8Array(8);
  let currentSSC = incrementSSC(ssc);

  if (response.length < 2) throw new Error('SM response too short');

  const sw1 = response[response.length - 2];
  const sw2 = response[response.length - 1];
  const responseData = response.slice(0, -2);

  // Parse TLV objects in response
  let decryptedData = null;
  let offset = 0;

  // Collect data for MAC verification
  let macInput = new Uint8Array(currentSSC);
  let macData = new Uint8Array(0);
  let receivedMac = null;

  while (offset < responseData.length) {
    const tag = responseData[offset++];
    let len = responseData[offset++];
    if (len & 0x80) {
      const numBytes = len & 0x7F;
      len = 0;
      for (let i = 0; i < numBytes; i++) {
        len = (len << 8) | responseData[offset++];
      }
    }
    const value = responseData.slice(offset, offset + len);
    offset += len;

    if (tag === 0x87) {
      // Encrypted data — first byte is padding indicator (0x01)
      const encrypted = value.slice(1);
      const decrypted = des3CbcDecrypt(ksEnc, encrypted, ZERO_IV);
      decryptedData = unpadISO9797(decrypted);
      // Include DO'87 in MAC data
      macData = concat(macData, buildDO(0x87, value));
    } else if (tag === 0x99) {
      // Processing status (SW1 SW2)
      macData = concat(macData, new Uint8Array([0x99, len, ...value]));
    } else if (tag === 0x8E) {
      // MAC
      receivedMac = value;
    }
  }

  // Verify MAC
  if (receivedMac) {
    const paddedMacInput = padISO9797(concat(macInput, macData));
    const computedMac = retailMac(ksMac, paddedMacInput);
    for (let i = 0; i < 8; i++) {
      if (i < receivedMac.length && receivedMac[i] !== computedMac[i]) {
        throw new Error('SM: MAC verification failed on response');
      }
    }
  }

  return {
    data: decryptedData,
    sw1,
    sw2,
    ok: sw1 === 0x90 && sw2 === 0x00,
    ssc: currentSSC,
  };
}

// Build a BER-TLV data object
function buildDO(tag, value) {
  const tagBytes = tag <= 0xFF ? [tag] : [(tag >> 8) & 0xFF, tag & 0xFF];
  let lenBytes;
  if (value.length < 0x80) {
    lenBytes = [value.length];
  } else if (value.length < 0x100) {
    lenBytes = [0x81, value.length];
  } else {
    lenBytes = [0x82, (value.length >> 8) & 0xFF, value.length & 0xFF];
  }
  return concat(new Uint8Array(tagBytes), new Uint8Array(lenBytes), value);
}

// ====== HIGH-LEVEL SECURE READ ======

// Read a file from the chip using Secure Messaging
export async function secureReadFile(transceiveFn, ksEnc, ksMac, ssc, fileId) {
  // SELECT file
  const selectData = new Uint8Array([(fileId >> 8) & 0xFF, fileId & 0xFF]);
  const selectWrapped = wrapCommandAPDU(ksEnc, ksMac, ssc, 0x00, 0xA4, 0x02, 0x0C, selectData, null);
  ssc = selectWrapped.ssc;

  const selectResp = await transceiveFn(selectWrapped.apdu);
  const selectResult = unwrapResponseAPDU(ksEnc, ksMac, ssc, selectResp);
  ssc = selectResult.ssc;

  if (!selectResult.ok) return { data: null, ssc };

  // READ BINARY: first read 4 bytes to get length
  const headerWrapped = wrapCommandAPDU(ksEnc, ksMac, ssc, 0x00, 0xB0, 0x00, 0x00, null, 4);
  ssc = headerWrapped.ssc;

  const headerResp = await transceiveFn(headerWrapped.apdu);
  const headerResult = unwrapResponseAPDU(ksEnc, ksMac, ssc, headerResp);
  ssc = headerResult.ssc;

  if (!headerResult.ok || !headerResult.data || headerResult.data.length < 2) {
    return { data: null, ssc };
  }

  // Parse TLV header to determine total file length
  const headerData = headerResult.data;
  let totalLen;
  let headerSize;
  if (headerData[1] < 0x80) {
    totalLen = headerData[1] + 2;
    headerSize = 2;
  } else if (headerData[1] === 0x81) {
    totalLen = headerData[2] + 3;
    headerSize = 3;
  } else if (headerData[1] === 0x82) {
    totalLen = ((headerData[2] << 8) | headerData[3]) + 4;
    headerSize = 4;
  } else {
    return { data: null, ssc };
  }

  if (totalLen > 50000) return { data: null, ssc }; // Safety limit

  // Read file in chunks
  const fileData = new Uint8Array(totalLen);
  let bytesRead = Math.min(headerResult.data.length, totalLen);
  fileData.set(headerResult.data.slice(0, bytesRead), 0);

  const chunkSize = 224; // Conservative chunk size
  while (bytesRead < totalLen) {
    const remaining = totalLen - bytesRead;
    const readLen = Math.min(chunkSize, remaining);
    const offsetHi = (bytesRead >> 8) & 0x7F;
    const offsetLo = bytesRead & 0xFF;

    const readWrapped = wrapCommandAPDU(ksEnc, ksMac, ssc, 0x00, 0xB0, offsetHi, offsetLo, null, readLen);
    ssc = readWrapped.ssc;

    const readResp = await transceiveFn(readWrapped.apdu);
    const readResult = unwrapResponseAPDU(ksEnc, ksMac, ssc, readResp);
    ssc = readResult.ssc;

    if (!readResult.ok || !readResult.data || readResult.data.length === 0) break;

    const chunk = readResult.data;
    fileData.set(chunk.slice(0, Math.min(chunk.length, totalLen - bytesRead)), bytesRead);
    bytesRead += chunk.length;

    if (chunk.length < readLen) break; // Short read — EOF
  }

  return { data: fileData.slice(0, bytesRead), ssc };
}
