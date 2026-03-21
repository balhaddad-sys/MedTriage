// Camera-based Civil ID number reader using ML Kit OCR (native) or TextDetector (web)
// Opens camera, captures frames, sends to ML Kit, extracts 12-digit Civil ID number

function getOcrPlugin() {
  return typeof window !== 'undefined'
    ? window.Capacitor?.Plugins?.CivilIdOcr || null
    : null;
}

export function hasNativeOcr() {
  return !!getOcrPlugin();
}

// Capture a frame from a video element as base64 JPEG
export function captureFrame(video, canvas, quality) {
  if (!video || video.readyState < 2) return null;
  const ctx = canvas.getContext('2d');
  // Use a reasonable resolution for OCR
  const w = Math.min(video.videoWidth, 1280);
  const h = Math.round(w * (video.videoHeight / video.videoWidth));
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality || 0.85);
}

// Send frame to ML Kit OCR and look for Civil ID
export async function recognizeCivilId(base64Frame) {
  const plugin = getOcrPlugin();
  if (plugin) {
    try {
      const result = await plugin.recognizeFrame({ image: base64Frame });
      return {
        found: result.found || false,
        civilId: result.civilId || '',
        bloodType: result.bloodType || '',
        gender: result.gender || '',
        nameEn: result.nameEn || '',
        nameAr: result.nameAr || '',
        fullText: result.fullText || '',
      };
    } catch {
      return { found: false, civilId: '', fullText: '' };
    }
  }

  // Web fallback: TextDetector API (Chrome only, experimental)
  if (typeof window !== 'undefined' && 'TextDetector' in window) {
    try {
      // Convert base64 to blob
      const resp = await fetch(base64Frame);
      const blob = await resp.blob();
      const bitmap = await createImageBitmap(blob);
      const detector = new TextDetector();
      const texts = await detector.detect(bitmap);
      bitmap.close();

      const allText = texts.map(t => t.rawValue).join(' ');
      const clean = allText.replace(/[\s\-.]/g, '');
      const match = clean.match(/[23]\d{11}/);
      return {
        found: !!match,
        civilId: match ? match[0] : '',
        fullText: allText,
      };
    } catch {
      return { found: false, civilId: '', fullText: '' };
    }
  }

  return { found: false, civilId: '', fullText: '' };
}

// ═══ MRZ OCR — position-aware character correction for TD1 format ═══

// OCR character substitution map — common misreads in MRZ OCR-B font
const OCR_CHAR_MAP = {
  // Symbols → MRZ chars
  '«': '<', '»': '<', '\u00AB': '<', '\u00BB': '<',
  '{': '<', '}': '<', '(': '<', ')': '<', '[': '<', ']': '<',
  '—': '<', '–': '<', '-': '<', '_': '<', '~': '<', '=': '<',
  '.': '<', ',': '<', ';': '<', ':': '<', "'": '<', '"': '<',
  '`': '<', '\\': '<', '/': '<', '|': '<', '!': '<',
  '$': 'S', '@': '0', '#': '<', '%': '<', '^': '<', '&': '8',
  '*': '<', '+': '<', '?': '<',
  // Digit ↔ letter confusions (context-dependent, applied later)
  // Keep both forms here for reference
};

// When a position expects a DIGIT, map letter lookalikes → digits
const LETTER_TO_DIGIT = {
  'O': '0', 'o': '0', 'D': '0', 'Q': '0',
  'I': '1', 'l': '1', 'i': '1', '|': '1', '!': '1',
  'Z': '2', 'z': '2',
  'E': '3',
  'A': '4', 'h': '4',
  'S': '5', 's': '5',
  'G': '6', 'b': '6',
  'T': '7',
  'B': '8',
  'g': '9', 'q': '9',
};

// When a position expects a LETTER, map digit lookalikes → letters
const DIGIT_TO_LETTER = {
  '0': 'O', '1': 'I', '2': 'Z', '3': 'E',
  '4': 'A', '5': 'S', '6': 'G', '7': 'T',
  '8': 'B', '9': 'G',
};

// TD1 line structure: 'A' = alpha only, 'D' = digit only,
// 'X' = alphanumeric, '<' = filler expected, '*' = any MRZ char
// Line 1: type(2) + state(3) + docNum(9) + check(1) + optional(15)
const TD1_LINE1 = 'AAXXXXXXXXXDXXXXXXXXXXXXXXX'.split('').map((c,i) => {
  if (i < 2) return 'A';    // doc type: I, ID, AC, etc.
  if (i < 5) return 'A';    // issuing state (3 alpha)
  if (i < 14) return 'X';   // document number (alphanumeric)
  if (i === 14) return 'D';  // check digit
  return 'X';               // optional data (15 chars)
});

// Line 2: dob(6) + check(1) + sex(1) + expiry(6) + check(1) + nationality(3) + optional(11) + composite(1)
const TD1_LINE2 = Array(30).fill('X').map((_, i) => {
  if (i < 6) return 'D';    // date of birth (6 digits)
  if (i === 6) return 'D';  // DOB check digit
  if (i === 7) return 'S';  // sex: M, F, or <
  if (i < 14) return 'D';   // expiry (6 digits)
  if (i === 14) return 'D';  // expiry check digit
  if (i < 18) return 'A';   // nationality (3 alpha)
  if (i < 29) return 'X';   // optional data
  return 'D';               // composite check digit
});

// Line 3: all alpha + < (name)
const TD1_LINE3 = Array(30).fill('A');

// Apply position-aware correction to a single character
function correctChar(ch, posType) {
  let c = ch.toUpperCase();
  // Apply symbol map first
  if (OCR_CHAR_MAP[ch]) c = OCR_CHAR_MAP[ch];
  if (OCR_CHAR_MAP[c]) c = OCR_CHAR_MAP[c];

  if (posType === 'D') {
    // Must be digit
    if (c >= '0' && c <= '9') return c;
    if (c === '<') return '<'; // filler OK in some digit positions
    return LETTER_TO_DIGIT[c] || LETTER_TO_DIGIT[ch] || '0';
  }
  if (posType === 'A') {
    // Must be alpha or <
    if (c >= 'A' && c <= 'Z') return c;
    if (c === '<') return '<';
    return DIGIT_TO_LETTER[c] || DIGIT_TO_LETTER[ch] || '<';
  }
  if (posType === 'S') {
    // Sex field: M, F, or <
    if (c === 'M' || c === 'F' || c === '<') return c;
    if (c === 'W' || c === 'E') return 'F'; // common misread
    return 'M'; // default
  }
  // 'X' — any MRZ char is fine
  if (c >= 'A' && c <= 'Z') return c;
  if (c >= '0' && c <= '9') return c;
  if (c === '<') return '<';
  return '<';
}

// Correct an entire line using positional rules
function correctLine(raw, lineTemplate) {
  let result = '';
  for (let i = 0; i < 30; i++) {
    const ch = i < raw.length ? raw[i] : '<';
    result += correctChar(ch, lineTemplate[i]);
  }
  return result;
}

// Score how MRZ-like a raw string is (0-1)
function scoreMrzLine(raw, lineNum) {
  if (!raw || raw.length < 20) return 0;
  let mrzChars = 0;
  for (const ch of raw.toUpperCase()) {
    if ((ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch === '<') mrzChars++;
  }
  let score = mrzChars / raw.length;

  // Bonus for correct length
  const stripped = raw.replace(/\s/g, '');
  if (stripped.length >= 28 && stripped.length <= 32) score += 0.2;

  // Bonus for line-specific patterns
  const upper = raw.toUpperCase();
  if (lineNum === 0 && /^[IAP][A-Z<]/.test(upper)) score += 0.3;
  if (lineNum === 1 && /^\d{6}\d[MF<]/.test(upper.replace(/[^A-Z0-9<]/g, ''))) score += 0.3;
  if (lineNum === 2 && /^[A-Z<]{10,}/.test(upper.replace(/[^A-Z<]/g, ''))) score += 0.2;
  if (lineNum === 2 && upper.includes('<<')) score += 0.2;

  return Math.min(score, 1);
}

// Pre-clean a raw OCR line before position-aware correction
function preCleanLine(raw) {
  return raw
    .replace(/\s+/g, '')     // strip all whitespace
    .replace(/[«»\u00AB\u00BB]/g, '<')
    .replace(/[{}()\[\]]/g, '<')
    .replace(/[—–\-_~=]/g, '<')
    .replace(/[.,;:'""`]/g, '<')
    .replace(/[\\\/]/g, '<');
}

// MRZ recognition — looks for 3 lines of ~30 chars (TD1 format) on back of card
// Returns { found, lines, fullText, scores, rawLines }
export async function recognizeMRZ(base64Frame) {
  const plugin = getOcrPlugin();
  let allText = '';

  if (plugin) {
    try {
      const result = await plugin.recognizeFrame({ image: base64Frame });
      allText = result.fullText || '';
    } catch {
      return { found: false, lines: [], fullText: '' };
    }
  } else if (typeof window !== 'undefined' && 'TextDetector' in window) {
    try {
      const resp = await fetch(base64Frame);
      const blob = await resp.blob();
      const bitmap = await createImageBitmap(blob);
      const detector = new TextDetector();
      const texts = await detector.detect(bitmap);
      bitmap.close();
      allText = texts.map(t => t.rawValue).join('\n');
    } catch {
      return { found: false, lines: [], fullText: '' };
    }
  } else {
    return { found: false, lines: [], fullText: '' };
  }

  const result = extractMRZLines(allText);
  return { ...result, fullText: allText };
}

// Main extraction — finds and corrects 3 TD1 MRZ lines from raw OCR text
function extractMRZLines(text) {
  if (!text) return { found: false, lines: [], scores: [] };

  const rawLines = text.replace(/\r\n/g, '\n').split('\n')
    .map(l => l.trim())
    .filter(l => l.length >= 15);

  // Score each line for each MRZ position (line 1, 2, 3)
  const candidates = rawLines.map(raw => {
    const cleaned = preCleanLine(raw);
    return {
      raw,
      cleaned,
      scores: [
        scoreMrzLine(cleaned, 0),
        scoreMrzLine(cleaned, 1),
        scoreMrzLine(cleaned, 2),
      ],
    };
  });

  // Strategy 1: Find best 3 consecutive lines
  let bestTriple = null;
  let bestTripleScore = 0;
  for (let i = 0; i <= candidates.length - 3; i++) {
    const s = candidates[i].scores[0] + candidates[i+1].scores[1] + candidates[i+2].scores[2];
    if (s > bestTripleScore) {
      bestTripleScore = s;
      bestTriple = [candidates[i], candidates[i+1], candidates[i+2]];
    }
  }

  // Strategy 2: Pick best line for each position independently
  let bestIndep = [null, null, null];
  let bestIndepScores = [0, 0, 0];
  for (const c of candidates) {
    for (let pos = 0; pos < 3; pos++) {
      if (c.scores[pos] > bestIndepScores[pos]) {
        bestIndepScores[pos] = c.scores[pos];
        bestIndep[pos] = c;
      }
    }
  }
  const indepScore = bestIndepScores[0] + bestIndepScores[1] + bestIndepScores[2];

  // Use whichever strategy scores higher
  let chosen;
  if (bestTriple && bestTripleScore >= indepScore) {
    chosen = bestTriple;
  } else if (bestIndep[0] && bestIndep[1] && bestIndep[2]) {
    chosen = bestIndep;
  } else if (bestTriple) {
    chosen = bestTriple;
  } else {
    // Fallback: concatenate all text and split into 30-char chunks
    return extractMRZFromBlob(text);
  }

  const templates = [TD1_LINE1, TD1_LINE2, TD1_LINE3];
  const corrected = chosen.map((c, i) => correctLine(c.cleaned, templates[i]));
  const scores = chosen.map((c, i) => c.scores[i]);

  // Require minimum quality
  const minScore = Math.min(...scores);
  if (minScore < 0.3) {
    return { found: false, lines: corrected, scores, rawLines: chosen.map(c => c.raw) };
  }

  return {
    found: true,
    lines: corrected,
    scores,
    rawLines: chosen.map(c => c.raw),
  };
}

// Fallback: extract MRZ from a continuous blob of text
function extractMRZFromBlob(text) {
  const blob = preCleanLine(text.replace(/\n/g, '')).toUpperCase();
  if (blob.length < 85) return { found: false, lines: [], scores: [] };

  // Look for line 1 start pattern: I or P followed by country code
  const startMatch = blob.match(/[IAP][A-Z<][A-Z<]{3}/);
  if (startMatch) {
    const idx = blob.indexOf(startMatch[0]);
    if (idx >= 0 && idx + 90 <= blob.length) {
      const templates = [TD1_LINE1, TD1_LINE2, TD1_LINE3];
      const lines = [
        correctLine(blob.substring(idx, idx + 30), templates[0]),
        correctLine(blob.substring(idx + 30, idx + 60), templates[1]),
        correctLine(blob.substring(idx + 60, idx + 90), templates[2]),
      ];
      return { found: true, lines, scores: [0.5, 0.5, 0.5] };
    }
  }

  // Last resort: take last 90 chars
  if (blob.length >= 90) {
    const tail = blob.slice(-90);
    const templates = [TD1_LINE1, TD1_LINE2, TD1_LINE3];
    const lines = [
      correctLine(tail.substring(0, 30), templates[0]),
      correctLine(tail.substring(30, 60), templates[1]),
      correctLine(tail.substring(60, 90), templates[2]),
    ];
    return { found: true, lines, scores: [0.4, 0.4, 0.4] };
  }

  return { found: false, lines: [], scores: [] };
}
