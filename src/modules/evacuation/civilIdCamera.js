// Camera Civil ID / MRZ OCR — reliable frame capture for Capacitor Android
//
// Key insight: canvas.drawImage(video) produces black frames on many Android WebViews.
// Fix: use requestVideoFrameCallback or ImageCapture.grabFrame() with fallback chain.

function getOcrPlugin() {
  return typeof window !== 'undefined'
    ? window.Capacitor?.Plugins?.CivilIdOcr || null
    : null;
}

export function hasNativeOcr() {
  return !!getOcrPlugin();
}

// ═══ RELIABLE FRAME CAPTURE ═══
// Try multiple methods in order of reliability on Android WebView

export async function captureFrameAsync(video, canvas, quality) {
  if (!video || !video.videoWidth || !video.videoHeight || video.readyState < 2) return null;

  // Method 1: ImageCapture.grabFrame() — most reliable on Android
  if (video.srcObject && 'ImageCapture' in window) {
    try {
      const track = video.srcObject.getVideoTracks()[0];
      if (track && track.readyState === 'live') {
        const capture = new ImageCapture(track);
        const bitmap = await capture.grabFrame();
        const ctx = canvas.getContext('2d');
        canvas.width = Math.min(bitmap.width, 1280);
        canvas.height = Math.round(canvas.width * (bitmap.height / bitmap.width));
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        if (isNonBlack(ctx, canvas.width, canvas.height)) {
          return canvas.toDataURL('image/jpeg', quality || 0.8);
        }
      }
    } catch { /* fall through */ }
  }

  // Method 2: ImageCapture.takePhoto() — captures a full photo frame
  if (video.srcObject && 'ImageCapture' in window) {
    try {
      const track = video.srcObject.getVideoTracks()[0];
      if (track && track.readyState === 'live') {
        const capture = new ImageCapture(track);
        const blob = await capture.takePhoto({ imageWidth: 1280 });
        const bitmap = await createImageBitmap(blob);
        const ctx = canvas.getContext('2d');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        if (isNonBlack(ctx, canvas.width, canvas.height)) {
          return canvas.toDataURL('image/jpeg', quality || 0.8);
        }
      }
    } catch { /* fall through */ }
  }

  // Method 3: canvas.drawImage(video) — standard but unreliable on Android
  try {
    const ctx = canvas.getContext('2d');
    const w = Math.min(video.videoWidth, 1280);
    const h = Math.round(w * (video.videoHeight / video.videoWidth));
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    if (isNonBlack(ctx, w, h)) {
      return canvas.toDataURL('image/jpeg', quality || 0.8);
    }
  } catch { /* fall through */ }

  return null; // All methods failed
}

// Check if canvas has actual image data (not black/blank)
function isNonBlack(ctx, w, h) {
  try {
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);
    const data = ctx.getImageData(cx - 5, cy - 5, 10, 10).data;
    let bright = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 15 || data[i + 1] > 15 || data[i + 2] > 15) bright++;
    }
    return bright >= 5; // At least 5 of 100 pixels are non-black
  } catch {
    return true; // Can't check, assume it's fine
  }
}

// ═══ CIVIL ID OCR ═══

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
      return empty();
    }
  }

  // Web fallback: TextDetector API
  if (typeof window !== 'undefined' && 'TextDetector' in window) {
    try {
      const resp = await fetch(base64Frame);
      const blob = await resp.blob();
      const bitmap = await createImageBitmap(blob);
      const detector = new TextDetector();
      const texts = await detector.detect(bitmap);
      bitmap.close();
      const allText = texts.map(t => t.rawValue).join(' ');
      const clean = allText.replace(/[\s\-.]/g, '');
      const match = clean.match(/[23]\d{11}/);
      const btMatch = allText.match(/\b(AB|A|B|O)\s?[+-]/);
      return {
        found: !!match,
        civilId: match ? match[0] : '',
        bloodType: btMatch ? btMatch[0].replace(/\s/g, '') : '',
        gender: '', nameEn: '', nameAr: '',
        fullText: allText,
      };
    } catch { return empty(); }
  }

  return empty();
}

function empty() {
  return { found: false, civilId: '', bloodType: '', gender: '', nameEn: '', nameAr: '', fullText: '' };
}

// ═══ MRZ OCR ═══

export async function recognizeMRZ(base64Frame) {
  const plugin = getOcrPlugin();
  let allText = '';

  if (plugin) {
    try {
      const result = await plugin.recognizeFrame({ image: base64Frame });
      allText = result.fullText || '';
    } catch {
      return { found: false, lines: [], scores: [], fullText: '' };
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
      return { found: false, lines: [], scores: [], fullText: '' };
    }
  } else {
    return { found: false, lines: [], scores: [], fullText: '' };
  }

  const mrzLines = extractMRZLines(allText);
  const scores = mrzLines.map(line => scoreMRZLine(line));
  return {
    found: mrzLines.length === 3,
    lines: mrzLines,
    scores,
    fullText: allText,
  };
}

// ═══ MRZ LINE EXTRACTION ═══

function extractMRZLines(text) {
  if (!text) return [];

  const cleaned = text
    .replace(/[«»\u00AB\u00BB]/g, '<')
    .replace(/[{}()\[\]]/g, '<')
    .replace(/[—–\-_]/g, '<')
    .replace(/\r\n/g, '\n');

  const rawLines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length >= 25);
  const candidates = [];

  for (const line of rawLines) {
    const mrzLine = line
      .toUpperCase()
      .replace(/O(?=[0-9])/g, '0')
      .replace(/[^A-Z0-9<]/g, '')
      .substring(0, 30);

    if (mrzLine.length >= 28 && mrzLine.length <= 32) {
      candidates.push(mrzLine.padEnd(30, '<').substring(0, 30));
    }
  }

  if (candidates.length >= 3) return candidates.slice(-3);

  // Fallback: concatenate and split into 30-char chunks
  const allMrz = cleaned
    .toUpperCase()
    .replace(/O(?=[0-9])/g, '0')
    .replace(/[^A-Z0-9<\n]/g, '')
    .replace(/\n/g, '');

  if (allMrz.length >= 88) {
    const startIdx = allMrz.search(/I[A-Z<][A-Z<]{3}/);
    if (startIdx >= 0 && startIdx + 90 <= allMrz.length) {
      const chunk = allMrz.substring(startIdx, startIdx + 90);
      return [chunk.substring(0, 30), chunk.substring(30, 60), chunk.substring(60, 90)];
    }
    const tail = allMrz.slice(-90);
    if (tail.length === 90) {
      return [tail.substring(0, 30), tail.substring(30, 60), tail.substring(60, 90)];
    }
  }

  return candidates;
}

function scoreMRZLine(line) {
  if (!line || line.length < 28) return 0;
  let valid = 0;
  for (const ch of line) {
    if (/[A-Z0-9<]/.test(ch)) valid++;
  }
  return valid / 30;
}
