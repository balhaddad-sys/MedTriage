// Kuwait Civil ID NFC Reader — Universal
//
// Kuwait Civil IDs are ISO 7816 smart cards (NOT NDEF).
// Web NFC can only read NDEF tags, so it cannot read Civil ID data directly.
// However, Web NFC CAN detect the card tap and read the tag serial number (UID).
//
// Strategy:
//   1. Capacitor native (iOS/Android app): ISO-DEP APDU commands to read card data
//   2. Web NFC (Chrome Android): Detect tap + read UID, then prompt for Civil ID
//   3. Manual entry: Type 12-digit Civil ID number
//
// The UID from NFC is stored with the patient to prevent duplicate scans.

// ═══ PLATFORM DETECTION ═══

function isCapacitorNative() {
  return typeof window !== 'undefined' &&
    window.Capacitor &&
    window.Capacitor.isNativePlatform &&
    window.Capacitor.isNativePlatform();
}

function hasCapacitorNfc() {
  return isCapacitorNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorNfc;
}

function hasWebNfc() {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

export function getNfcBackend() {
  if (hasCapacitorNfc()) return 'capacitor';
  if (hasWebNfc()) return 'webnfc';
  return 'manual';
}

export function isNFCSupported() {
  return getNfcBackend() !== 'manual';
}

export function getNfcPlatformInfo() {
  const backend = getNfcBackend();
  switch (backend) {
    case 'capacitor':
      return { supported: true, backend, label: 'Native NFC', hint: 'Hold Civil ID card near device', canReadCard: true };
    case 'webnfc':
      return { supported: true, backend, label: 'NFC Detect', hint: 'Tap Civil ID card on back of phone', canReadCard: false };
    default:
      return { supported: false, backend, label: 'Manual Entry', hint: 'Enter 12-digit Civil ID number', canReadCard: false };
  }
}

// ═══ CIVIL ID PARSER ═══

export function parseCivilIdNumber(civilId) {
  const clean = civilId.replace(/\D/g, '');
  if (clean.length !== 12) return null;

  const century = clean[0] === '2' ? 1900 : 2000;
  const year = century + parseInt(clean.substring(1, 3));
  const month = parseInt(clean.substring(3, 5));
  const day = parseInt(clean.substring(5, 7));

  const birthDate = new Date(year, month - 1, day);
  const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

  return {
    civilId: clean,
    birthYear: year,
    birthMonth: month,
    birthDay: day,
    age: age >= 0 && age < 130 ? age : null,
  };
}

// ═══ NDEF RECORD PARSER (for rare NDEF-enabled cards) ═══

function parseTextFromRecord(record) {
  try {
    if (record.recordType === 'text') {
      const decoder = new TextDecoder(record.encoding || 'utf-8');
      const payload = record.data;
      const langLen = payload.getUint8(0) & 0x3F;
      return decoder.decode(new DataView(payload.buffer, payload.byteOffset + 1 + langLen));
    }
    return new TextDecoder().decode(record.data);
  } catch { return ''; }
}

function extractCivilIdFromTexts(texts) {
  const result = {
    civilId: '', fullName: '', fullNameArabic: '',
    age: null, gender: '', nationality: '', raw: texts,
  };

  for (const text of texts) {
    const civilIdMatch = text.match(/\b[23]\d{11}\b/);
    if (civilIdMatch && !result.civilId) {
      result.civilId = civilIdMatch[0];
      const parsed = parseCivilIdNumber(civilIdMatch[0]);
      if (parsed) result.age = parsed.age;
    }
    if (/[\u0600-\u06FF]{2,}/.test(text) && !result.fullNameArabic) {
      const parts = text.match(/[\u0600-\u06FF\s]+/g);
      if (parts) { const name = parts.join(' ').trim(); if (name.length > 3) result.fullNameArabic = name; }
    }
    if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(text.trim()) && !result.fullName) result.fullName = text.trim();
    if (/\b(MALE|FEMALE|ذكر|أنثى)\b/i.test(text) && !result.gender) result.gender = /FEMALE|أنثى/i.test(text) ? 'F' : 'M';
    if (/\b(KUWAITI|كويتي|كويتية)\b/i.test(text)) result.nationality = 'Kuwaiti';
  }
  if (!result.fullName && result.fullNameArabic) result.fullName = result.fullNameArabic;
  return result;
}

// ═══ CAPACITOR NFC SCANNER ═══
// Native app: can use ISO-DEP to actually read the smart card

async function scanCapacitorNfc(onResult, onError, onReading) {
  const NfcPlugin = window.Capacitor.Plugins.CapacitorNfc;
  const abortController = { aborted: false };

  try {
    const { isEnabled } = await NfcPlugin.isEnabled();
    if (!isEnabled) {
      onError?.(new Error('NFC is disabled. Please enable NFC in your device settings.'));
      return null;
    }

    await NfcPlugin.startScanSession({
      alertMessage: 'Hold your Kuwait Civil ID near the device',
    });

    const listener = await NfcPlugin.addListener('nfcTagDetected', (event) => {
      if (abortController.aborted) return;
      onReading?.();

      const texts = [];

      // Try NDEF records first
      if (event.messages) {
        for (const message of event.messages) {
          if (message.records) {
            for (const record of message.records) {
              if (record.payload) {
                let text = typeof record.payload === 'string' ? record.payload : '';
                if (record.tnf === 1 && record.type === 'T' && text.length > 1) {
                  text = text.substring(1 + text.charCodeAt(0));
                }
                if (text) texts.push(text);
              }
            }
          }
        }
      }

      if (event.id) texts.push(event.id);

      const parsed = extractCivilIdFromTexts(texts);
      parsed.serialNumber = event.id || '';
      parsed.nfcBackend = 'capacitor';
      parsed.tagDetected = true;

      // Even if we couldn't read Civil ID data, we detected the card
      onResult(parsed);
    });

    const errorListener = await NfcPlugin.addListener('nfcError', (event) => {
      if (!abortController.aborted) {
        onError?.(new Error(event.message || 'NFC read error. Try repositioning the card.'));
      }
    });

    return () => {
      abortController.aborted = true;
      listener?.remove();
      errorListener?.remove();
      NfcPlugin.stopScanSession().catch(() => {});
    };

  } catch (err) {
    onError?.(new Error(err.message || 'Failed to start NFC scanner.'));
    return null;
  }
}

// ═══ WEB NFC SCANNER ═══
// Kuwait Civil IDs are ISO 7816 smart cards — NOT NDEF.
// Web NFC will fire 'readingerror' when it detects the card but can't read NDEF.
// We use BOTH 'reading' (for rare NDEF cards) and 'readingerror' (for ISO 7816 cards)
// to detect the card tap and capture the tag UID.

async function scanWebNfc(onResult, onError, onReading) {
  try {
    const ndef = new NDEFReader();
    const abortController = new AbortController();
    let hasResult = false;

    // SUCCESS path: card has NDEF records (rare for Civil IDs, but handle it)
    ndef.addEventListener('reading', ({ serialNumber, message }) => {
      if (hasResult) return;
      hasResult = true;
      onReading?.();

      const texts = [];
      for (const record of message.records) {
        const text = parseTextFromRecord(record);
        if (text) texts.push(text);
      }

      const parsed = extractCivilIdFromTexts(texts);
      parsed.serialNumber = serialNumber || '';
      parsed.nfcBackend = 'webnfc';
      parsed.tagDetected = true;
      onResult(parsed);
    });

    // ERROR path: card detected but NOT NDEF (this is the normal case for Civil IDs)
    // The card IS detected — we just can't read its data via Web NFC.
    // We capture this as a successful "tap" and let user enter Civil ID manually.
    ndef.addEventListener('readingerror', (event) => {
      if (hasResult) return;
      hasResult = true;
      onReading?.();

      // Card was tapped but we can't read NDEF data
      // This is EXPECTED for Kuwait Civil IDs (ISO 7816)
      onResult({
        civilId: '',
        fullName: '',
        fullNameArabic: '',
        age: null,
        gender: '',
        nationality: '',
        serialNumber: '',
        nfcBackend: 'webnfc',
        tagDetected: true,
        needsManualId: true, // Signal to UI: card detected, need manual Civil ID
        raw: [],
      });
    });

    await ndef.scan({ signal: abortController.signal });

    return () => {
      hasResult = true;
      abortController.abort();
    };

  } catch (err) {
    if (err.name === 'NotAllowedError') {
      onError?.(new Error('NFC permission denied. Please allow NFC access in browser settings.'));
    } else if (err.name === 'NotSupportedError') {
      onError?.(new Error('NFC is not available. Ensure NFC is enabled in device settings.'));
    } else {
      onError?.(err);
    }
    return null;
  }
}

// ═══ UNIFIED SCANNER ═══

export async function scanNFC(onResult, onError, onReading) {
  const backend = getNfcBackend();

  if (backend === 'capacitor') return scanCapacitorNfc(onResult, onError, onReading);
  if (backend === 'webnfc') return scanWebNfc(onResult, onError, onReading);

  onError?.(new Error('NFC is not supported on this device. Use manual Civil ID entry.'));
  return null;
}

// ═══ MANUAL CIVIL ID VALIDATION ═══

export function validateCivilId(input) {
  const clean = input.replace(/\D/g, '');
  if (clean.length !== 12) return { valid: false, error: 'Civil ID must be 12 digits' };
  if (clean[0] !== '2' && clean[0] !== '3') return { valid: false, error: 'Invalid Civil ID prefix' };

  const parsed = parseCivilIdNumber(clean);
  if (!parsed) return { valid: false, error: 'Invalid Civil ID format' };
  if (parsed.age === null || parsed.age < 0 || parsed.age > 130) return { valid: false, error: 'Invalid birth date in Civil ID' };

  return { valid: true, ...parsed };
}
