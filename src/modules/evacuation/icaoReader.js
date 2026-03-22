// ICAO 9303 MRTD Reader for Kuwait Civil ID
//
// Implements APDU-level communication with the Civil ID chip via
// Capacitor NFC plugin's transceive capability (IsoDep).
//
// Protocol flow:
// 1. Select ICAO MRTD applet (AID: A0000002471001)
// 2. Establish BAC session (3DES encrypted channel) using MRZ-derived keys
// 3. Read EF.COM to discover available data groups
// 4. Read DG1 (MRZ data), DG2 (photo), DG11 (additional personal details)
//
// All reads after BAC authentication use Secure Messaging (SM) with
// 3DES encryption and ISO 9797-1 retail MAC.

import { performBAC, secureReadFile } from './bacAuth.js';

// ICAO MRTD Application Identifier
const MRTD_AID = [0xA0, 0x00, 0x00, 0x02, 0x47, 0x10, 0x01];

// APDU command builders
function selectApplet(aid) {
  return [0x00, 0xA4, 0x04, 0x0C, aid.length, ...aid];
}

function selectFile(fileId) {
  return [0x00, 0xA4, 0x02, 0x0C, 0x02, (fileId >> 8) & 0xFF, fileId & 0xFF];
}

function readBinary(offset, length) {
  return [0x00, 0xB0, (offset >> 8) & 0x7F, offset & 0xFF, length];
}

// File identifiers for ICAO data groups
const FILE_IDS = {
  EF_COM: 0x011E,
  EF_DG1: 0x0101,
  EF_DG2: 0x0102,
  EF_DG7: 0x0107,
  EF_DG11: 0x010B,
  EF_DG12: 0x010C,
  EF_DG15: 0x010F,
  EF_SOD: 0x011D,
  EF_CARD_ACCESS: 0x011C,
};

// Data group tag mapping
const DG_TAGS = {
  0x61: 'DG1',
  0x75: 'DG2',
  0x67: 'DG7',
  0x6B: 'DG11',
  0x6C: 'DG12',
  0x6F: 'DG15',
};

// TLV (Tag-Length-Value) parser for ASN.1 BER encoded data
function parseTLV(data, offset = 0) {
  if (offset >= data.length) return null;

  let tag = data[offset++];
  if ((tag & 0x1F) === 0x1F) {
    tag = (tag << 8) | data[offset++];
    while (data[offset - 1] & 0x80) {
      tag = (tag << 8) | data[offset++];
    }
  }

  let length = data[offset++];
  if (length & 0x80) {
    const numBytes = length & 0x7F;
    length = 0;
    for (let i = 0; i < numBytes; i++) {
      length = (length << 8) | data[offset++];
    }
  }

  const value = data.slice(offset, offset + length);
  return { tag, length, value, endOffset: offset + length };
}

function parseAllTLV(data) {
  const results = [];
  let offset = 0;
  while (offset < data.length) {
    const tlv = parseTLV(data, offset);
    if (!tlv) break;
    results.push(tlv);
    offset = tlv.endOffset;
  }
  return results;
}

// Parse EF.COM to discover available data groups
function parseEfCom(data) {
  const groups = [];
  const tlvs = parseAllTLV(data);

  for (const tlv of tlvs) {
    if (tlv.tag === 0x60) {
      const innerTlvs = parseAllTLV(tlv.value);
      for (const inner of innerTlvs) {
        if (inner.tag === 0x5C) {
          // Tag list — each byte is a DG tag
          for (const byte of inner.value) {
            const dgName = DG_TAGS[byte];
            if (dgName) groups.push(dgName);
          }
        }
      }
    }
  }

  return groups;
}

// Parse DG1 (MRZ data) — contains the full MRZ as stored on chip
function parseDG1(data) {
  const tlvs = parseAllTLV(data);
  for (const tlv of tlvs) {
    if (tlv.tag === 0x61) {
      const innerTlvs = parseAllTLV(tlv.value);
      for (const inner of innerTlvs) {
        if (inner.tag === 0x5F1F) {
          // MRZ data as UTF-8 string
          const mrzBytes = inner.value;
          const mrz = new TextDecoder('utf-8').decode(new Uint8Array(mrzBytes));
          return mrz;
        }
      }
      // Fallback: try to find raw MRZ in value
      const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(tlv.value));
      if (text.length >= 88) {
        return text.substring(text.length - 90);
      }
    }
  }
  return null;
}

// Parse DG2 (facial photo) — returns JPEG/JP2 image bytes
function parseDG2(data) {
  // DG2 contains a biometric data block with JPEG or JPEG2000 image
  // Look for JPEG header (FF D8 FF) or JP2 header (00 00 00 0C 6A 50)
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  // Find JPEG start
  for (let i = 0; i < bytes.length - 2; i++) {
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xD8 && bytes[i + 2] === 0xFF) {
      // Find JPEG end (FF D9)
      for (let j = bytes.length - 1; j > i; j--) {
        if (bytes[j] === 0xD9 && bytes[j - 1] === 0xFF) {
          return {
            format: 'jpeg',
            data: bytes.slice(i, j + 1),
          };
        }
      }
      return { format: 'jpeg', data: bytes.slice(i) };
    }
  }

  // Find JP2 start (JPEG 2000)
  for (let i = 0; i < bytes.length - 6; i++) {
    if (bytes[i] === 0x00 && bytes[i + 1] === 0x00 && bytes[i + 2] === 0x00 &&
        bytes[i + 3] === 0x0C && bytes[i + 4] === 0x6A && bytes[i + 5] === 0x50) {
      return { format: 'jp2', data: bytes.slice(i) };
    }
  }

  return null;
}

// Parse DG11 (additional personal details)
function parseDG11(data) {
  const result = {
    fullNameNative: null,
    placeOfBirth: null,
    permanentAddress: null,
    telephone: null,
    profession: null,
    personalNumber: null,
  };

  const tlvs = parseAllTLV(data);
  for (const tlv of tlvs) {
    if (tlv.tag === 0x6B) {
      const innerTlvs = parseAllTLV(tlv.value);
      for (const inner of innerTlvs) {
        const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(inner.value));
        switch (inner.tag) {
          case 0x5F0E: result.fullNameNative = text; break; // Name in native script (Arabic)
          case 0x5F11: result.placeOfBirth = text; break;
          case 0x5F42: result.permanentAddress = text; break;
          case 0x5F12: result.telephone = text; break;
          case 0x5F13: result.profession = text; break;
          case 0x5F10: result.personalNumber = text; break;
        }
      }
    }
  }

  return result;
}

// Check APDU response status word
function checkSW(response) {
  if (!response || response.length < 2) return { ok: false, sw: 0 };
  const sw = (response[response.length - 2] << 8) | response[response.length - 1];
  return { ok: sw === 0x9000, sw, data: response.slice(0, -2) };
}

// Main ICAO reader class — uses Capacitor NFC transceive
export class ICAOReader {
  constructor(transceiveFn) {
    this.transceive = transceiveFn;
    this.maxReadSize = 0xE0; // 224 bytes — safe max for most chips
    // Secure messaging state (set after BAC)
    this.ksEnc = null;
    this.ksMac = null;
    this.ssc = null;
    // Adaptive chunk sizing — start large, shrink on errors
    this.readRetries = 3;
    this.transceiveTimeout = 5000;
  }

  async selectMRTD() {
    const cmd = selectApplet(MRTD_AID);
    const response = await this.transceive(cmd);
    return checkSW(response);
  }

  // Perform BAC authentication using MRZ-derived keys
  async authenticateBAC(documentNumber, dateOfBirth, dateOfExpiry) {
    const { ksEnc, ksMac, ssc } = await performBAC(
      this.transceive,
      documentNumber,
      dateOfBirth,
      dateOfExpiry,
    );
    this.ksEnc = ksEnc;
    this.ksMac = ksMac;
    this.ssc = ssc;
    return true;
  }

  get isAuthenticated() {
    return this.ksEnc !== null && this.ksMac !== null;
  }

  // Read a file — uses secure messaging if authenticated
  async readFile(fileId) {
    if (this.isAuthenticated) {
      return this.readFileSecure(fileId);
    }
    return this.readFilePlain(fileId);
  }

  // Transceive with retry logic for flaky NFC connections
  async transceiveRetry(cmd, retries) {
    const maxRetries = retries ?? this.readRetries;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const resp = await this.transceive(cmd);
        if (resp && resp.length >= 2) return resp;
      } catch (err) {
        if (attempt === maxRetries) throw err;
      }
    }
    return [];
  }

  // Read file without secure messaging (for unauthenticated access)
  async readFilePlain(fileId) {
    const selCmd = selectFile(fileId);
    const selResp = await this.transceiveRetry(selCmd);
    const selResult = checkSW(selResp);
    if (!selResult.ok) return null;

    // Read header to determine file size
    const headerCmd = readBinary(0, 8);
    const headerResp = await this.transceiveRetry(headerCmd);
    const headerResult = checkSW(headerResp);
    if (!headerResult.ok || headerResult.data.length < 2) return null;

    const totalLength = this.parseTotalLength(headerResult.data);
    if (totalLength === null || totalLength > 50000) return null;

    // Fast chunked read with adaptive sizing
    const data = new Uint8Array(totalLength);
    let offset = 0;
    let chunkSize = this.maxReadSize;

    // Copy header data we already have
    const headerBytes = Math.min(headerResult.data.length, totalLength);
    data.set(headerResult.data.slice(0, headerBytes), 0);
    offset = headerBytes;

    while (offset < totalLength) {
      const remaining = totalLength - offset;
      const readSize = Math.min(chunkSize, remaining);
      const cmd = readBinary(offset, readSize);

      try {
        const resp = await this.transceiveRetry(cmd, 1);
        const result = checkSW(resp);
        if (!result.ok) {
          // Try smaller chunks on failure
          if (chunkSize > 32) { chunkSize = Math.floor(chunkSize / 2); continue; }
          break;
        }
        data.set(result.data, offset);
        offset += result.data.length;
        if (result.data.length < readSize) break;
      } catch {
        if (chunkSize > 32) { chunkSize = Math.floor(chunkSize / 2); continue; }
        break;
      }
    }

    return Array.from(data.slice(0, offset));
  }

  // Parse total file length from TLV header bytes
  parseTotalLength(headerData) {
    if (headerData.length < 2) return null;
    const tag = headerData[0];
    let lenOffset = 1;
    // Multi-byte tag
    if ((tag & 0x1F) === 0x1F) {
      lenOffset = 2;
      while (lenOffset < headerData.length && headerData[lenOffset - 1] & 0x80) lenOffset++;
    }
    if (lenOffset >= headerData.length) return null;

    const firstLen = headerData[lenOffset];
    if (firstLen < 0x80) return firstLen + lenOffset + 1;
    if (firstLen === 0x81 && lenOffset + 1 < headerData.length) return headerData[lenOffset + 1] + lenOffset + 2;
    if (firstLen === 0x82 && lenOffset + 2 < headerData.length) return ((headerData[lenOffset + 1] << 8) | headerData[lenOffset + 2]) + lenOffset + 3;
    return null;
  }

  // Read file with secure messaging (after BAC authentication)
  async readFileSecure(fileId) {
    const { data, ssc } = await secureReadFile(
      this.transceive,
      this.ksEnc,
      this.ksMac,
      this.ssc,
      fileId,
    );
    this.ssc = ssc;
    return data ? Array.from(data) : null;
  }

  async readEfCOM() {
    const data = await this.readFile(FILE_IDS.EF_COM);
    if (!data) return [];
    return parseEfCom(data);
  }

  async readDG1() {
    const data = await this.readFile(FILE_IDS.EF_DG1);
    if (!data) return null;
    return parseDG1(data);
  }

  async readDG2() {
    const data = await this.readFile(FILE_IDS.EF_DG2);
    if (!data) return null;
    return parseDG2(data);
  }

  async readDG11() {
    const data = await this.readFile(FILE_IDS.EF_DG11);
    if (!data) return null;
    return parseDG11(data);
  }
}

// Attempt ICAO reading via Capacitor NFC transceive
// mrzData: optional { documentNumber, dateOfBirth, dateOfExpiry } for BAC auth
// onProgress: optional callback(stage: string) for UI updates
// options: { readPhoto: false } to skip DG2 for speed
// Returns null if transceive is not available or ICAO applet is not found
export async function attemptICAORead(nfcPlugin, mrzData, onProgress, options) {
  // Capacitor plugin methods are Proxy objects — typeof check may fail
  // Instead, just check the plugin exists and try to call transceive
  if (!nfcPlugin) {
    return null;
  }
  // Quick check: try calling transceive to see if it exists
  try {
    if (!nfcPlugin.transceive) return null;
  } catch {
    return null;
  }

  const readPhoto = options?.readPhoto !== false; // default true

  const transceive = async (cmd) => {
    try {
      const cmdArray = Array.from(cmd);
      const result = await Promise.race([
        nfcPlugin.transceive({ data: cmdArray }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Transceive timeout')), 5000)),
      ]);
      // Handle both response formats:
      // Custom IsoDep plugin: { response: JSArray }
      // The response may be a JSArray (Capacitor bridge converts to regular array)
      const resp = result?.response;
      if (!resp) return [];
      // Capacitor JSArray may come as: real array, object with numeric keys, or JSON string
      if (Array.isArray(resp)) return resp;
      if (typeof resp === 'string') {
        try { return JSON.parse(resp); } catch { return []; }
      }
      // JSArray-like object with numeric indices or length property
      const arr = [];
      const len = resp.length || 0;
      if (len > 0) {
        for (let i = 0; i < len; i++) arr.push(Number(resp[i]) || 0);
      } else {
        for (let i = 0; resp[i] !== undefined && i < 1000; i++) arr.push(Number(resp[i]) || 0);
      }
      return arr;
    } catch {
      return [];
    }
  };

  const reader = new ICAOReader(transceive);

  try {
    // Step 1: Probe for known smart card applets
    onProgress?.('Probing card applets...');

    // Try multiple AIDs — Kuwait Civil ID may not use standard ICAO AID
    const AIDS_TO_TRY = [
      { name: 'ICAO MRTD', aid: [0xA0, 0x00, 0x00, 0x02, 0x47, 0x10, 0x01] },
      { name: 'Kuwait PACI', aid: [0xA0, 0x00, 0x00, 0x00, 0x77, 0x01, 0x08, 0x00, 0x07, 0x00, 0x00, 0xFE, 0x00, 0x00, 0x01, 0x00] },
      { name: 'PIV', aid: [0xA0, 0x00, 0x00, 0x03, 0x08, 0x00, 0x00, 0x10, 0x00, 0x01, 0x00] },
      { name: 'GP ISD', aid: [0xA0, 0x00, 0x00, 0x01, 0x51, 0x00, 0x00] },
      { name: 'PKI', aid: [0xA0, 0x00, 0x00, 0x00, 0x63, 0x50, 0x4B, 0x43, 0x53, 0x2D, 0x31, 0x35] },
      { name: 'eID', aid: [0xE8, 0x28, 0xBD, 0x08, 0x0F] },
      { name: 'Master File', aid: [0x3F, 0x00] },
    ];

    let selectedApp = null;
    const probeResults = [];
    for (const { name, aid } of AIDS_TO_TRY) {
      try {
        const cmd = [0x00, 0xA4, 0x04, 0x00, aid.length, ...aid];
        const resp = await transceive(cmd);
        const sw = resp.length >= 2 ? ((resp[resp.length - 2] << 8) | resp[resp.length - 1]) : 0;
        const ok = sw === 0x9000 || (sw >> 8) === 0x61; // 9000=OK, 61xx=OK with data
        console.log(`[ICAO] Probe ${name}: SW=${sw.toString(16)}, ok=${ok}, resp=${resp.length}bytes`);
        probeResults.push({ name, sw: sw.toString(16), ok, dataLen: resp.length - 2 });
        if (ok) { selectedApp = name; break; }
      } catch (e) {
        console.log(`[ICAO] Probe ${name}: error=${e.message}`);
        probeResults.push({ name, error: e.message });
      }
    }

    console.log('[ICAO] Probe results:', JSON.stringify(probeResults));

    // Also try reading the ATR historical bytes by selecting MF
    if (!selectedApp) {
      try {
        const mfCmd = [0x00, 0xA4, 0x00, 0x00, 0x02, 0x3F, 0x00];
        const mfResp = await transceive(mfCmd);
        const sw = mfResp.length >= 2 ? ((mfResp[mfResp.length - 2] << 8) | mfResp[mfResp.length - 1]) : 0;
        console.log(`[ICAO] Select MF: SW=${sw.toString(16)}, data=${JSON.stringify(mfResp)}`);
        if (sw === 0x9000 || (sw >> 8) === 0x61) selectedApp = 'Master File';
      } catch {}
    }

    // If MF selected, try to read Kuwait Civil ID files directly
    if (selectedApp === 'Master File') {
      onProgress?.('Reading Civil ID files...');
      const civilIdData = await readKuwaitCivilIdFiles(transceive, onProgress);
      return {
        icaoDetected: false, needsBAC: false, bacAuthenticated: false,
        availableGroups: [], mrz: null, photo: null, additionalDetails: null,
        probeResults, selectedApp,
        ...civilIdData,
      };
    }

    onProgress?.('Selecting MRTD applet...');
    console.log('[ICAO] Selecting MRTD applet...');
    const selectResult = await reader.selectMRTD();
    console.log('[ICAO] Select result:', JSON.stringify({ ok: selectResult.ok, sw: selectResult.sw?.toString(16) }));
    if (!selectResult.ok) {
      return { icaoDetected: false, needsBAC: false, bacAuthenticated: false, availableGroups: [], mrz: null, photo: null, additionalDetails: null, probeResults, selectedApp };
    }

    const result = {
      icaoDetected: true,
      needsBAC: false,
      bacAuthenticated: false,
      availableGroups: [],
      mrz: null,
      photo: null,
      additionalDetails: null,
    };

    // Step 2: Try unauthenticated read of EF.COM
    onProgress?.('Reading chip directory...');
    let groups = await reader.readEfCOM();

    // Step 3: If unauthenticated read failed and we have MRZ data, try BAC
    if (groups.length === 0 && mrzData) {
      try {
        onProgress?.('Authenticating (BAC)...');
        await reader.authenticateBAC(
          mrzData.documentNumber,
          mrzData.dateOfBirth,
          mrzData.dateOfExpiry,
        );
        result.bacAuthenticated = true;
        groups = await reader.readEfCOM();
      } catch (bacErr) {
        result.bacError = bacErr.message;
      }
    }

    if (groups.length === 0 && !mrzData) {
      result.needsBAC = true;
      return result;
    }

    result.availableGroups = groups;

    // Step 4: Read DG1 first (small, ~200 bytes, <1 sec)
    if (groups.includes('DG1')) {
      onProgress?.('Reading MRZ data...');
      result.mrz = await reader.readDG1();
    }

    // Step 5: Read DG11 (Arabic name, small file)
    if (groups.includes('DG11')) {
      onProgress?.('Reading personal details...');
      result.additionalDetails = await reader.readDG11();
    }

    // Step 6: DG2 photo is 5-15KB — only if requested and MRZ succeeded
    // Skip photo in emergency mode for speed (readPhoto: false)
    if (readPhoto && groups.includes('DG2') && result.mrz) {
      onProgress?.('Reading photo (hold steady ~5s)...');
      try {
        const photoTimeout = 12000; // 12s max for photo read
        const photoPromise = reader.readDG2();
        const photo = await Promise.race([
          photoPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Photo read timeout')), photoTimeout)),
        ]);
        result.photo = photo;
      } catch {
        // Photo read failed or timed out — not critical
        result.photoError = true;
      }
    }

    onProgress?.('Done');
    return result;
  } catch {
    return null;
  }
}

// ═══ KUWAIT CIVIL ID — DIRECT FILE READ (no ICAO, no BAC) ═══
// The Kuwait Civil ID chip uses a flat MF structure with EF files.
// We enumerate common file IDs and read whatever is accessible.

async function selectEF(transceive, fileId) {
  const cmd = [0x00, 0xA4, 0x00, 0x00, 0x02, (fileId >> 8) & 0xFF, fileId & 0xFF];
  const resp = await transceive(cmd);
  const sw = resp.length >= 2 ? ((resp[resp.length - 2] << 8) | resp[resp.length - 1]) : 0;
  return { ok: sw === 0x9000 || (sw >> 8) === 0x61, sw, data: resp.slice(0, -2) };
}

async function readBinaryFromEF(transceive, maxBytes) {
  const data = [];
  let offset = 0;
  const chunkSize = 224;
  while (offset < (maxBytes || 4096)) {
    const cmd = [0x00, 0xB0, (offset >> 8) & 0x7F, offset & 0xFF, Math.min(chunkSize, maxBytes - offset)];
    let resp;
    try { resp = await transceive(cmd); } catch { break; }
    if (!resp || resp.length < 2) break;
    const sw = (resp[resp.length - 2] << 8) | resp[resp.length - 1];
    if (sw !== 0x9000 && (sw >> 8) !== 0x62) break; // 62xx = warning but data returned
    const chunk = resp.slice(0, -2);
    if (chunk.length === 0) break;
    data.push(...chunk);
    offset += chunk.length;
    if (chunk.length < chunkSize) break;
  }
  return data;
}

function tryDecodeText(bytes) {
  if (!bytes || bytes.length === 0) return '';
  try {
    // Try UTF-8 first
    const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
    // Filter out non-printable chars except Arabic
    return text.replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\n\r\t]/g, '').trim();
  } catch {
    return '';
  }
}

async function readKuwaitCivilIdFiles(transceive, onProgress) {
  const result = {
    civilIdFromChip: true,
    filesFound: [],
    filesData: {},
    civilId: '',
    fullName: '',
    fullNameArabic: '',
    age: null,
    gender: '',
    nationality: '',
  };

  // Common file IDs to try on Kuwait Civil ID chips
  // These are educated guesses based on common smart card structures
  const filesToTry = [
    // Standard DF/EF IDs
    { id: 0x0001, name: 'EF01' },
    { id: 0x0002, name: 'EF02' },
    { id: 0x0003, name: 'EF03' },
    { id: 0x0004, name: 'EF04' },
    { id: 0x0005, name: 'EF05' },
    { id: 0x0006, name: 'EF06' },
    // PACI-specific file IDs
    { id: 0x0100, name: 'EF0100' },
    { id: 0x0101, name: 'EF0101' },
    { id: 0x0102, name: 'EF0102' },
    { id: 0x0103, name: 'EF0103' },
    // Common ID card file IDs
    { id: 0x2F00, name: 'EF.DIR' },
    { id: 0x2F01, name: 'EF.ATR' },
    { id: 0x5000, name: 'EF5000' },
    { id: 0x5001, name: 'EF5001' },
    { id: 0x5002, name: 'EF5002' },
    { id: 0x5003, name: 'EF5003' },
    { id: 0x6001, name: 'EF6001' },
    { id: 0x6002, name: 'EF6002' },
    { id: 0x6003, name: 'EF6003' },
    // Some cards use short EF IDs
    { id: 0x0011, name: 'PersonalData' },
    { id: 0x0012, name: 'CardData' },
    { id: 0x0013, name: 'Photo' },
    { id: 0x0014, name: 'Fingerprint' },
  ];

  // First re-select MF
  try {
    await transceive([0x00, 0xA4, 0x00, 0x00, 0x02, 0x3F, 0x00]);
  } catch {}

  let filesProbed = 0;
  for (const { id, name } of filesToTry) {
    filesProbed++;
    if (filesProbed % 5 === 0) {
      onProgress?.(`Scanning files (${filesProbed}/${filesToTry.length})...`);
    }

    try {
      const sel = await selectEF(transceive, id);
      if (!sel.ok) continue;

      // File exists! Try to read it
      const data = await readBinaryFromEF(transceive, 512);
      if (data.length === 0) continue;

      const text = tryDecodeText(data);
      const hex = data.slice(0, 32).map(b => b.toString(16).padStart(2, '0')).join(' ');

      console.log(`[KWID] File ${name} (${id.toString(16)}): ${data.length} bytes, text="${text.substring(0, 100)}", hex=${hex}`);

      result.filesFound.push({ id: id.toString(16), name, size: data.length, text: text.substring(0, 200), hex });
      result.filesData[name] = { data, text };

      // Try to extract Civil ID number (12 digits starting with 2 or 3)
      const civilIdMatch = text.match(/[23]\d{11}/);
      if (civilIdMatch && !result.civilId) {
        result.civilId = civilIdMatch[0];
        const parsed = parseCivilIdNumberLocal(civilIdMatch[0]);
        if (parsed) result.age = parsed.age;
      }

      // Try to extract name (Arabic)
      if (/[\u0600-\u06FF]{3,}/.test(text) && !result.fullNameArabic) {
        const arabicParts = text.match(/[\u0600-\u06FF\s]{3,}/g);
        if (arabicParts) result.fullNameArabic = arabicParts[0].trim();
      }

      // Try to extract English name
      if (/[A-Z][a-z]+\s+[A-Z][a-z]+/.test(text) && !result.fullName) {
        const nameMatch = text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/);
        if (nameMatch) result.fullName = nameMatch[0];
      }

      // Try to extract gender
      if (/\b(MALE|FEMALE|M|F)\b/i.test(text) && !result.gender) {
        result.gender = /FEMALE|F/i.test(text) ? 'F' : 'M';
      }

      // Re-select MF before trying next file
      try { await transceive([0x00, 0xA4, 0x00, 0x00, 0x02, 0x3F, 0x00]); } catch {}

    } catch {
      // File doesn't exist or not accessible — skip
      continue;
    }
  }

  // Also try READ RECORD for record-based files
  onProgress?.('Trying record-based reads...');
  try {
    for (let recNum = 1; recNum <= 5; recNum++) {
      const cmd = [0x00, 0xB2, recNum, 0x04, 0x00]; // Read record
      let resp;
      try { resp = await transceive(cmd); } catch { break; }
      if (!resp || resp.length < 2) break;
      const sw = (resp[resp.length - 2] << 8) | resp[resp.length - 1];
      if (sw !== 0x9000) break;
      const data = resp.slice(0, -2);
      const text = tryDecodeText(data);
      if (text) {
        console.log(`[KWID] Record ${recNum}: ${data.length} bytes, text="${text.substring(0, 100)}"`);
        result.filesFound.push({ id: `rec${recNum}`, name: `Record${recNum}`, size: data.length, text: text.substring(0, 200) });
      }
    }
  } catch {}

  if (!result.fullName && result.fullNameArabic) result.fullName = result.fullNameArabic;

  onProgress?.('Done');
  console.log(`[KWID] Summary: ${result.filesFound.length} files, civilId=${result.civilId}, name=${result.fullName}`);
  return result;
}

function parseCivilIdNumberLocal(civilId) {
  const clean = `${civilId || ''}`.replace(/\D/g, '');
  if (clean.length !== 12) return null;
  const century = clean[0] === '2' ? 1900 : 2000;
  const year = century + parseInt(clean.substring(1, 3), 10);
  const month = parseInt(clean.substring(3, 5), 10);
  const day = parseInt(clean.substring(5, 7), 10);
  const age = Math.floor((Date.now() - new Date(year, month - 1, day).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return { civilId: clean, age: age >= 0 && age < 130 ? age : null };
}

export { FILE_IDS, DG_TAGS, parseTLV, parseAllTLV, parseEfCom, parseDG1, parseDG2, parseDG11 };
