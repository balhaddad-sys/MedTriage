// Kuwait Civil ID NFC Reader
// Uses Web NFC API to read Kuwait Civil ID cards
// Kuwait Civil IDs contain NDEF records with personal data

// Check if Web NFC is supported
export function isNFCSupported() {
  return 'NDEFReader' in window;
}

// Kuwait Civil ID number format: 12 digits (e.g., 281234567890)
// First digit: century (2 = 1900s, 3 = 2000s)
// Digits 2-3: birth year
// Digits 4-5: birth month
// Digits 6-7: birth day
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

// Parse NDEF records from Kuwait Civil ID
function parseNDEFRecords(records) {
  const result = {
    civilId: '',
    fullName: '',
    fullNameArabic: '',
    age: null,
    gender: '',
    nationality: '',
    raw: [],
  };

  for (const record of records) {
    let text = '';

    if (record.recordType === 'text') {
      const decoder = new TextDecoder(record.encoding || 'utf-8');
      // NDEF text records have a language code prefix byte
      const payload = record.data;
      const langLen = payload.getUint8(0) & 0x3F;
      text = decoder.decode(new DataView(payload.buffer, payload.byteOffset + 1 + langLen));
    } else if (record.recordType === 'url' || record.recordType === 'mime') {
      const decoder = new TextDecoder();
      text = decoder.decode(record.data);
    } else {
      // Try raw decode
      try {
        const decoder = new TextDecoder();
        text = decoder.decode(record.data);
      } catch {
        continue;
      }
    }

    result.raw.push(text);

    // Try to extract civil ID (12 digits)
    const civilIdMatch = text.match(/\b[23]\d{11}\b/);
    if (civilIdMatch && !result.civilId) {
      result.civilId = civilIdMatch[0];
      const parsed = parseCivilIdNumber(civilIdMatch[0]);
      if (parsed) result.age = parsed.age;
    }

    // Try to detect name patterns
    // Arabic name (right-to-left characters)
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

    // Gender detection
    if (/\b(MALE|FEMALE|M|F|ذكر|أنثى)\b/i.test(text) && !result.gender) {
      if (/FEMALE|أنثى/i.test(text)) result.gender = 'F';
      else if (/MALE|ذكر/i.test(text)) result.gender = 'M';
    }

    // Nationality
    if (/\b(KUWAITI|كويتي|كويتية)\b/i.test(text)) {
      result.nationality = 'Kuwaiti';
    }
  }

  // Use Arabic name if no English name found
  if (!result.fullName && result.fullNameArabic) {
    result.fullName = result.fullNameArabic;
  }

  return result;
}

// Start NFC scanning session
export async function scanNFC(onResult, onError, onReading) {
  if (!isNFCSupported()) {
    onError?.(new Error('NFC is not supported on this device. Web NFC requires Chrome on Android.'));
    return null;
  }

  try {
    const ndef = new NDEFReader();
    const abortController = new AbortController();

    ndef.addEventListener('readingerror', () => {
      onError?.(new Error('Cannot read NFC tag. Try repositioning the card.'));
    });

    ndef.addEventListener('reading', ({ serialNumber, message }) => {
      onReading?.();

      const records = [];
      for (const record of message.records) {
        records.push(record);
      }

      const parsed = parseNDEFRecords(records);
      parsed.serialNumber = serialNumber;

      // If we got raw data but couldn't parse structured fields,
      // try to extract civil ID from concatenated raw text
      if (!parsed.civilId && parsed.raw.length > 0) {
        const allText = parsed.raw.join(' ');
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

    // Return abort function
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

// Manual civil ID entry fallback — validate and extract age
export function validateCivilId(input) {
  const clean = input.replace(/\D/g, '');
  if (clean.length !== 12) return { valid: false, error: 'Civil ID must be 12 digits' };
  if (clean[0] !== '2' && clean[0] !== '3') return { valid: false, error: 'Invalid Civil ID prefix' };

  const parsed = parseCivilIdNumber(clean);
  if (!parsed) return { valid: false, error: 'Invalid Civil ID format' };
  if (parsed.age === null || parsed.age < 0 || parsed.age > 130) return { valid: false, error: 'Invalid birth date in Civil ID' };

  return { valid: true, ...parsed };
}
