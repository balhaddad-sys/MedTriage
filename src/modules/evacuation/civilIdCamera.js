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

// MRZ recognition — looks for 3 lines of ~30 chars (TD1 format) on back of card
// MRZ chars: A-Z, 0-9, < — OCR-B font, highly standardized
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

  // Try to extract 3 MRZ lines from OCR text
  const mrzLines = extractMRZLines(allText);
  return {
    found: mrzLines.length === 3,
    lines: mrzLines,
    fullText: allText,
  };
}

// Extract TD1 MRZ lines from raw OCR text
// MRZ uses only: A-Z, 0-9, < — we clean OCR artifacts and find 3 lines of ~30 chars
function extractMRZLines(text) {
  if (!text) return [];

  // Normalize common OCR misreads in MRZ context
  const cleaned = text
    .replace(/[«»]/g, '<')      // OCR reads < as guillemets
    .replace(/\u00AB/g, '<')
    .replace(/\u00BB/g, '<')
    .replace(/[{}()\[\]]/g, '<') // brackets → fillers
    .replace(/[|lI!]/g, 'I')    // common l/I/1 confusion handled below
    .replace(/[—–\-_]/g, '<')   // dashes → fillers
    .replace(/\r\n/g, '\n');

  // Split into lines and try to find MRZ-like lines
  const rawLines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length >= 25);

  const mrzCandidates = [];
  for (const line of rawLines) {
    // Keep only MRZ-valid chars, normalize
    const mrzLine = line
      .toUpperCase()
      .replace(/0/g, '0')       // keep zero
      .replace(/O(?=[0-9])/g, '0') // O before digit → 0
      .replace(/[^A-Z0-9<]/g, '') // strip non-MRZ chars
      .substring(0, 30);

    // TD1 lines are exactly 30 chars
    if (mrzLine.length >= 28 && mrzLine.length <= 32) {
      // Pad or trim to 30
      mrzCandidates.push(mrzLine.padEnd(30, '<').substring(0, 30));
    }
  }

  if (mrzCandidates.length >= 3) {
    // Return last 3 candidates (MRZ is at bottom of card)
    return mrzCandidates.slice(-3);
  }

  // Fallback: try concatenating all text and splitting into 30-char chunks
  const allMrz = cleaned
    .toUpperCase()
    .replace(/O(?=[0-9])/g, '0')
    .replace(/[^A-Z0-9<\n]/g, '')
    .replace(/\n/g, '');

  if (allMrz.length >= 88) {
    // Look for the start of MRZ — line 1 starts with I, ID, or P
    const startIdx = allMrz.search(/I[A-Z<][A-Z<]{3}/);
    if (startIdx >= 0 && startIdx + 90 <= allMrz.length) {
      const chunk = allMrz.substring(startIdx, startIdx + 90);
      return [chunk.substring(0, 30), chunk.substring(30, 60), chunk.substring(60, 90)];
    }
    // Just take last 90 chars
    const tail = allMrz.slice(-90);
    if (tail.length === 90) {
      return [tail.substring(0, 30), tail.substring(30, 60), tail.substring(60, 90)];
    }
  }

  return mrzCandidates;
}
