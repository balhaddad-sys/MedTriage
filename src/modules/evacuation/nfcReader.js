// Kuwait Civil ID NFC Reader — Universal
// Priority: Capacitor NFC (native iOS/Android) → Web NFC (Chrome Android) → Manual entry
//
// iOS: CoreNFC via Capacitor plugin (reads NDEF from Civil ID)
// Android: Capacitor NFC or Web NFC API
// Desktop/Web: Manual Civil ID entry fallback

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
      return { supported: true, backend, label: 'Native NFC', hint: 'Hold Civil ID card near device' };
    case 'webnfc':
      return { supported: true, backend, label: 'Web NFC', hint: 'Hold Civil ID card against back of phone' };
    default:
      return { supported: false, backend, label: 'Manual Entry', hint: 'Enter 12-digit Civil ID number' };
  }
}

// ═══ CIVIL ID PARSER ═══
// Kuwait Civil ID: 12 digits
// Digit 1: century (2=1900s, 3=2000s)
// Digits 2-3: birth year, 4-5: month, 6-7: day
// Remaining: serial + check digit

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

// ═══ NDEF RECORD PARSER ═══
// Extracts structured data from Civil ID NFC records

function parseTextFromRecord(record) {
  let text = '';
  try {
    if (record.recordType === 'text') {
      const decoder = new TextDecoder(record.encoding || 'utf-8');
      const payload = record.data;
      const langLen = payload.getUint8(0) & 0x3F;
      text = decoder.decode(new DataView(payload.buffer, payload.byteOffset + 1 + langLen));
    } else if (record.recordType === 'url' || record.recordType === 'mime') {
      text = new TextDecoder().decode(record.data);
    } else {
      text = new TextDecoder().decode(record.data);
    }
  } catch { /* skip unreadable records */ }
  return text;
}

function extractCivilIdData(texts) {
  const result = {
    civilId: '',
    fullName: '',
    fullNameArabic: '',
    age: null,
    gender: '',
    nationality: '',
    raw: texts,
  };

  for (const text of texts) {
    // Civil ID number (12 digits starting with 2 or 3)
    const civilIdMatch = text.match(/\b[23]\d{11}\b/);
    if (civilIdMatch && !result.civilId) {
      result.civilId = civilIdMatch[0];
      const parsed = parseCivilIdNumber(civilIdMatch[0]);
      if (parsed) result.age = parsed.age;
    }

    // Arabic name
    if (/[\u0600-\u06FF]{2,}/.test(text) && !result.fullNameArabic) {
      const arabicParts = text.match(/[\u0600-\u06FF\s]+/g);
      if (arabicParts) {
        const name = arabicParts.join(' ').trim();
        if (name.length > 3) result.fullNameArabic = name;
      }
    }

    // English name
    if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(text.trim()) && !result.fullName) {
      result.fullName = text.trim();
    }

    // Gender
    if (/\b(MALE|FEMALE|M|F|ذكر|أنثى)\b/i.test(text) && !result.gender) {
      result.gender = /FEMALE|أنثى/i.test(text) ? 'F' : 'M';
    }

    // Nationality
    if (/\b(KUWAITI|كويتي|كويتية)\b/i.test(text)) {
      result.nationality = 'Kuwaiti';
    }
  }

  if (!result.fullName && result.fullNameArabic) {
    result.fullName = result.fullNameArabic;
  }

  return result;
}

// ═══ CAPACITOR NFC SCANNER ═══

async function scanCapacitorNfc(onResult, onError, onReading) {
  const NfcPlugin = window.Capacitor.Plugins.CapacitorNfc;
  const abortController = { aborted: false };

  try {
    // Check NFC availability
    const { isEnabled } = await NfcPlugin.isEnabled();
    if (!isEnabled) {
      onError?.(new Error('NFC is disabled. Please enable NFC in your device settings.'));
      return null;
    }

    // Start scanning
    await NfcPlugin.startScanSession({
      alertMessage: 'Hold your Kuwait Civil ID near the device',
    });

    // Listen for NFC tag detection
    const listener = await NfcPlugin.addListener('nfcTagDetected', (event) => {
      if (abortController.aborted) return;
      onReading?.();

      const texts = [];

      // Extract text from NDEF messages
      if (event.messages) {
        for (const message of event.messages) {
          if (message.records) {
            for (const record of message.records) {
              if (record.payload) {
                // Capacitor plugin returns payload as string or base64
                let text = '';
                if (typeof record.payload === 'string') {
                  // Try to decode — may have language prefix for text records
                  text = record.payload;
                  // Strip NDEF text record language prefix (first few bytes)
                  if (record.tnf === 1 && record.type === 'T') {
                    const langLen = text.charCodeAt(0);
                    text = text.substring(1 + langLen);
                  }
                }
                if (text) texts.push(text);
              }
            }
          }
        }
      }

      // Also try raw tag ID as potential data source
      if (event.id) texts.push(event.id);

      const parsed = extractCivilIdData(texts);
      parsed.serialNumber = event.id || '';
      parsed.nfcBackend = 'capacitor';

      // If we got raw data but no civil ID, check concatenated text
      if (!parsed.civilId && texts.length > 0) {
        const allText = texts.join(' ');
        const idMatch = allText.match(/\b[23]\d{11}\b/);
        if (idMatch) {
          parsed.civilId = idMatch[0];
          const info = parseCivilIdNumber(idMatch[0]);
          if (info) parsed.age = info.age;
        }
      }

      onResult(parsed);
    });

    // Listen for errors
    const errorListener = await NfcPlugin.addListener('nfcError', (event) => {
      if (!abortController.aborted) {
        onError?.(new Error(event.message || 'NFC read error. Try repositioning the card.'));
      }
    });

    // Return abort function
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

async function scanWebNfc(onResult, onError, onReading) {
  try {
    const ndef = new NDEFReader();
    const abortController = new AbortController();

    ndef.addEventListener('readingerror', () => {
      onError?.(new Error('Cannot read NFC tag. Try repositioning the card.'));
    });

    ndef.addEventListener('reading', ({ serialNumber, message }) => {
      onReading?.();

      const texts = [];
      for (const record of message.records) {
        const text = parseTextFromRecord(record);
        if (text) texts.push(text);
      }

      const parsed = extractCivilIdData(texts);
      parsed.serialNumber = serialNumber;
      parsed.nfcBackend = 'webnfc';

      // Fallback: try concatenated raw text for civil ID
      if (!parsed.civilId && texts.length > 0) {
        const allText = texts.join(' ');
        const idMatch = allText.match(/\b[23]\d{11}\b/);
        if (idMatch) {
          parsed.civilId = idMatch[0];
          const info = parseCivilIdNumber(idMatch[0]);
          if (info) parsed.age = info.age;
        }
      }

      onResult(parsed);
    });

    await ndef.scan({ signal: abortController.signal });
    return () => abortController.abort();

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
// Automatically picks the best available NFC backend

export async function scanNFC(onResult, onError, onReading) {
  const backend = getNfcBackend();

  if (backend === 'capacitor') {
    return scanCapacitorNfc(onResult, onError, onReading);
  }

  if (backend === 'webnfc') {
    return scanWebNfc(onResult, onError, onReading);
  }

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
