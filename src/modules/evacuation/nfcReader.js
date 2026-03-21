// Kuwait Civil ID NFC reader
//
// Kuwait Civil ID cards behave like smart cards, not simple NDEF tags.
// In this app we support two useful levels of NFC:
// 1. Native Capacitor app: detect the raw tag, capture UID/tech types, and use
//    manual Civil ID entry when structured data is not exposed by the plugin.
// 2. Web NFC: detect a tap when possible, then validate manual Civil ID entry.

function isCapacitorNative() {
  return typeof window !== 'undefined' &&
    window.Capacitor &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform();
}

function getCapacitorNfcPlugin() {
  return typeof window !== 'undefined'
    ? window.Capacitor?.Plugins?.CapacitorNfc || null
    : null;
}

function hasCapacitorNfc() {
  return isCapacitorNative() && !!getCapacitorNfcPlugin();
}

function hasWebNfc() {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

function bytesToHex(bytes) {
  if (!Array.isArray(bytes) || bytes.length === 0) return '';
  return bytes.map(byte => (byte & 0xff).toString(16).padStart(2, '0').toUpperCase()).join(':');
}

function decodeBytes(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
  } catch {
    return '';
  }
}

function decodeNdefRecord(record) {
  if (!record) return '';

  const type = Array.isArray(record.type)
    ? String.fromCharCode(...record.type)
    : '';
  const payload = Array.isArray(record.payload) ? record.payload : [];
  if (payload.length === 0) return '';

  if (record.tnf === 0x01 && type === 'T') {
    const languageLength = payload[0] & 0x3f;
    return decodeBytes(payload.slice(1 + languageLength)).trim();
  }

  if (record.tnf === 0x01 && type === 'U') {
    return decodeBytes(payload.slice(1)).trim();
  }

  return decodeBytes(payload).trim();
}

function parseTextFromRecord(record) {
  try {
    if (record.recordType === 'text') {
      const decoder = new TextDecoder(record.encoding || 'utf-8');
      const payload = record.data;
      const languageLength = payload.getUint8(0) & 0x3f;
      return decoder.decode(new DataView(payload.buffer, payload.byteOffset + 1 + languageLength)).trim();
    }
    return new TextDecoder().decode(record.data).trim();
  } catch {
    return '';
  }
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

  if (backend === 'capacitor') {
    return {
      supported: true,
      backend,
      label: 'Native NFC',
      hint: 'Hold Kuwait Civil ID near the back of the device',
      canReadCard: false,
      canDetectCard: true,
      diagnostic: '',
    };
  }

  if (backend === 'webnfc') {
    return {
      supported: true,
      backend,
      label: 'Web NFC Detect',
      hint: 'Tap Civil ID on the back of an Android Chrome device',
      canReadCard: false,
      canDetectCard: true,
      diagnostic: '',
    };
  }

  const diagnostics = [];
  if (typeof window === 'undefined') diagnostics.push('No window object');
  else {
    if (!window.isSecureContext) diagnostics.push('Not HTTPS (secure context required)');
    if (!('NDEFReader' in window)) diagnostics.push('NDEFReader API not found');
    const ua = navigator.userAgent || '';
    if (!/Android/i.test(ua)) diagnostics.push('Not Android');
    if (!/Chrome\/\d/i.test(ua)) diagnostics.push('Not Chrome');
  }

  return {
    supported: false,
    backend,
    label: 'Manual Entry',
    hint: 'Enter 12-digit Civil ID number',
    canReadCard: false,
    canDetectCard: false,
    diagnostic: diagnostics.join(', ') || 'Unknown reason',
  };
}

export function parseCivilIdNumber(civilId) {
  const clean = `${civilId || ''}`.replace(/\D/g, '');
  if (clean.length !== 12) return null;

  const century = clean[0] === '2' ? 1900 : 2000;
  const year = century + parseInt(clean.substring(1, 3), 10);
  const month = parseInt(clean.substring(3, 5), 10);
  const day = parseInt(clean.substring(5, 7), 10);
  const birthDate = new Date(year, month - 1, day);

  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return null;
  }

  const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return {
    civilId: clean,
    birthYear: year,
    birthMonth: month,
    birthDay: day,
    age: age >= 0 && age < 130 ? age : null,
  };
}

function extractCivilIdFromTexts(texts) {
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
    const cleanText = `${text || ''}`.trim();
    if (!cleanText) continue;

    const civilIdMatch = cleanText.match(/\b[23]\d{11}\b/);
    if (civilIdMatch && !result.civilId) {
      result.civilId = civilIdMatch[0];
      const parsed = parseCivilIdNumber(civilIdMatch[0]);
      if (parsed) result.age = parsed.age;
    }

    if (/[\u0600-\u06FF]{2,}/.test(cleanText) && !result.fullNameArabic) {
      const parts = cleanText.match(/[\u0600-\u06FF\s]+/g);
      if (parts) {
        const name = parts.join(' ').replace(/\s+/g, ' ').trim();
        if (name.length > 3) result.fullNameArabic = name;
      }
    }

    if (/^[A-Z][a-z]+(\s+[A-Z][a-z'.-]+)+$/.test(cleanText) && !result.fullName) {
      result.fullName = cleanText;
    }

    if (/\b(MALE|FEMALE|ذكر|أنثى)\b/i.test(cleanText) && !result.gender) {
      result.gender = /FEMALE|أنثى/i.test(cleanText) ? 'F' : 'M';
    }

    if (/\b(KUWAITI|كويتي|كويتية)\b/i.test(cleanText)) {
      result.nationality = 'Kuwaiti';
    }
  }

  if (!result.fullName && result.fullNameArabic) result.fullName = result.fullNameArabic;
  return result;
}

function looksLikeSmartCardTag(tag, eventType) {
  const techTypes = Array.isArray(tag?.techTypes) ? tag.techTypes : [];
  return eventType === 'tag' || techTypes.some(type => /IsoDep|NfcA|NfcB/i.test(type));
}

function parseCapacitorEvent(event) {
  const tag = event?.tag || {};
  const texts = Array.isArray(tag.ndefMessage)
    ? tag.ndefMessage.map(record => decodeNdefRecord(record)).filter(Boolean)
    : [];
  const parsed = extractCivilIdFromTexts(texts);
  const serialNumber = bytesToHex(tag.id);
  const techTypes = Array.isArray(tag.techTypes) ? tag.techTypes : [];
  const likelyCivilId = Boolean(parsed.civilId) || looksLikeSmartCardTag(tag, event?.type);

  return {
    ...parsed,
    serialNumber,
    tagType: tag.type || event?.type || '',
    techTypes,
    nfcBackend: 'capacitor',
    tagDetected: true,
    likelyCivilId,
    needsManualId: !parsed.civilId,
  };
}

async function scanCapacitorNfc(onResult, onError, onReading) {
  const plugin = getCapacitorNfcPlugin();
  if (!plugin) {
    onError?.(new Error('Native NFC plugin is not available.'));
    return null;
  }

  const cleanup = async (listenerHandle) => {
    try {
      await listenerHandle?.remove?.();
    } catch {}
    try {
      await plugin.stopScanning();
    } catch {}
  };

  try {
    const { supported } = await plugin.isSupported();
    if (!supported) {
      onError?.(new Error('This device does not have NFC hardware.'));
      return null;
    }

    const { status } = await plugin.getStatus();
    if (status === 'NFC_DISABLED') {
      onError?.(new Error('NFC is disabled. Please enable NFC in system settings.'));
      return null;
    }
    if (status === 'NO_NFC') {
      onError?.(new Error('This device does not support NFC.'));
      return null;
    }

    let closed = false;
    const listener = await plugin.addListener('nfcEvent', async (event) => {
      if (closed) return;
      closed = true;
      onReading?.();
      const parsed = parseCapacitorEvent(event);
      await cleanup(listener);
      onResult?.(parsed);
    });

    await plugin.startScanning({
      invalidateAfterFirstRead: true,
      alertMessage: 'Hold your Kuwait Civil ID near the device',
      iosSessionType: 'tag',
    });

    return async () => {
      if (closed) return;
      closed = true;
      await cleanup(listener);
    };
  } catch (err) {
    const message = `${err?.message || err || ''}`;
    if (/NFC_DISABLED/i.test(message)) {
      onError?.(new Error('NFC is disabled. Please enable NFC in system settings.'));
    } else if (/NO_NFC/i.test(message)) {
      onError?.(new Error('Raw tag scanning is not enabled. On iPhone, add the TAG NFC entitlement before testing Civil ID detection.'));
    } else {
      onError?.(new Error(message || 'Failed to start NFC scanner.'));
    }
    return null;
  }
}

async function scanWebNfc(onResult, onError, onReading) {
  try {
    const ndef = new NDEFReader();
    const abortController = new AbortController();
    let resolved = false;

    ndef.addEventListener('reading', ({ serialNumber, message }) => {
      if (resolved) return;
      resolved = true;
      onReading?.();

      const texts = [];
      for (const record of message.records) {
        const text = parseTextFromRecord(record);
        if (text) texts.push(text);
      }

      const parsed = extractCivilIdFromTexts(texts);
      onResult?.({
        ...parsed,
        serialNumber: serialNumber || '',
        tagType: 'ndef',
        techTypes: [],
        nfcBackend: 'webnfc',
        tagDetected: true,
        likelyCivilId: true,
        needsManualId: !parsed.civilId,
      });
    });

    ndef.addEventListener('readingerror', () => {
      if (resolved) return;
      resolved = true;
      onReading?.();

      onResult?.({
        civilId: '',
        fullName: '',
        fullNameArabic: '',
        age: null,
        gender: '',
        nationality: '',
        serialNumber: '',
        tagType: 'unknown-smart-card',
        techTypes: [],
        nfcBackend: 'webnfc',
        tagDetected: true,
        likelyCivilId: true,
        needsManualId: true,
        raw: [],
      });
    });

    await ndef.scan({ signal: abortController.signal });

    return () => {
      resolved = true;
      abortController.abort();
    };
  } catch (err) {
    if (err?.name === 'NotAllowedError') {
      onError?.(new Error('NFC permission denied. Please allow NFC access in browser settings.'));
    } else if (err?.name === 'NotSupportedError') {
      onError?.(new Error('Web NFC is not available on this device/browser.'));
    } else {
      onError?.(new Error(err?.message || 'Failed to start Web NFC scanning.'));
    }
    return null;
  }
}

export async function scanNFC(onResult, onError, onReading) {
  const backend = getNfcBackend();
  if (backend === 'capacitor') return scanCapacitorNfc(onResult, onError, onReading);
  if (backend === 'webnfc') return scanWebNfc(onResult, onError, onReading);

  onError?.(new Error('NFC is not supported on this device. Use manual Civil ID entry.'));
  return null;
}

export function validateCivilId(input) {
  const clean = `${input || ''}`.replace(/\D/g, '');
  if (clean.length !== 12) return { valid: false, error: 'Civil ID must be 12 digits' };
  if (clean[0] !== '2' && clean[0] !== '3') return { valid: false, error: 'Invalid Civil ID prefix' };

  const parsed = parseCivilIdNumber(clean);
  if (!parsed) return { valid: false, error: 'Invalid Civil ID format' };
  if (parsed.age === null || parsed.age < 0 || parsed.age > 130) {
    return { valid: false, error: 'Invalid birth date in Civil ID' };
  }

  return { valid: true, ...parsed };
}
