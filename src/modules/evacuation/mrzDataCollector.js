// MRZ OCR Data Collector — saves raw OCR vs corrected output for training
//
// Each scan session collects:
//   - Every frame's raw OCR text + corrected MRZ lines + scores
//   - The final accepted/edited MRZ (ground truth)
//   - Timestamp, device info
//
// Data is stored in localStorage under 'mrz_training_data'
// Export as JSON for offline analysis and OCR tuning

const STORAGE_KEY = 'mrz_training_data';
const MAX_SAMPLES = 200; // cap to avoid filling storage

// Start a new collection session — returns sessionId
export function startSession() {
  const sessionId = `mrz_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const session = {
    id: sessionId,
    startedAt: new Date().toISOString(),
    device: getDeviceInfo(),
    frames: [],       // raw OCR data per frame
    accepted: null,   // what the user accepted
    corrected: null,  // what the user manually corrected (ground truth)
    finalLines: null,  // the 3 MRZ lines used
  };
  // Store in memory first, flush on accept
  if (typeof window !== 'undefined') {
    window.__mrzSession = session;
  }
  return sessionId;
}

// Log a single OCR frame result
export function logFrame(data) {
  if (typeof window === 'undefined' || !window.__mrzSession) return;
  const session = window.__mrzSession;

  // Only keep last 30 frames to avoid bloat
  if (session.frames.length >= 30) {
    session.frames.shift();
  }

  session.frames.push({
    ts: Date.now(),
    rawOcr: (data.fullText || '').substring(0, 500),
    rawLines: data.rawLines || [],
    correctedLines: data.lines || [],
    scores: data.scores || [],
    found: data.found || false,
  });
}

// Record the accepted MRZ (what the scanner produced)
export function logAccepted(mrzLines, parsed) {
  if (typeof window === 'undefined' || !window.__mrzSession) return;
  const session = window.__mrzSession;
  session.accepted = {
    lines: mrzLines,
    documentNumber: parsed?.documentNumber || '',
    fullName: parsed?.fullName || '',
    dateOfBirth: parsed?.dateOfBirthRaw || '',
    sex: parsed?.sex || '',
    nationality: parsed?.nationality || '',
    errors: parsed?.errors || [],
    valid: parsed?.valid || false,
  };
  session.finalLines = mrzLines;
}

// Record a manual correction (ground truth label)
export function logCorrected(correctedLines, parsed) {
  if (typeof window === 'undefined' || !window.__mrzSession) return;
  const session = window.__mrzSession;
  session.corrected = {
    lines: correctedLines,
    documentNumber: parsed?.documentNumber || '',
    fullName: parsed?.fullName || '',
    dateOfBirth: parsed?.dateOfBirthRaw || '',
    sex: parsed?.sex || '',
    nationality: parsed?.nationality || '',
    valid: parsed?.valid || false,
  };
  session.finalLines = correctedLines;
}

// Flush the current session to localStorage
export function flushSession() {
  if (typeof window === 'undefined' || !window.__mrzSession) return;
  const session = window.__mrzSession;
  session.endedAt = new Date().toISOString();

  // Only save if we have at least some OCR data
  if (session.frames.length === 0 && !session.accepted) {
    window.__mrzSession = null;
    return;
  }

  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    existing.push(session);
    // Cap storage
    while (existing.length > MAX_SAMPLES) existing.shift();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (e) {
    console.error('[MRZ-DATA] Failed to save training data:', e);
  }

  window.__mrzSession = null;
}

// Get all collected sessions
export function getSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

// Get summary stats
export function getStats() {
  const sessions = getSessions();
  const totalFrames = sessions.reduce((sum, s) => sum + (s.frames?.length || 0), 0);
  const withCorrections = sessions.filter(s => s.corrected).length;
  const withAccepted = sessions.filter(s => s.accepted).length;
  const validAccepted = sessions.filter(s => s.accepted?.valid).length;

  return {
    sessions: sessions.length,
    totalFrames,
    withAccepted,
    withCorrections,
    validAccepted,
  };
}

// Export all data as downloadable JSON
export function exportAsJSON() {
  const sessions = getSessions();
  const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mrz-training-data-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Export as CSV — one row per frame, with raw OCR and corrected lines
export function exportAsCSV() {
  const sessions = getSessions();
  const rows = [['session_id', 'frame_idx', 'timestamp', 'raw_ocr', 'corrected_line1', 'corrected_line2', 'corrected_line3', 'score1', 'score2', 'score3', 'ground_truth_line1', 'ground_truth_line2', 'ground_truth_line3']];

  for (const session of sessions) {
    const gt = session.corrected?.lines || session.accepted?.lines || ['', '', ''];
    for (let i = 0; i < (session.frames?.length || 0); i++) {
      const f = session.frames[i];
      rows.push([
        session.id,
        i,
        f.ts,
        csvEscape(f.rawOcr || ''),
        csvEscape(f.correctedLines?.[0] || ''),
        csvEscape(f.correctedLines?.[1] || ''),
        csvEscape(f.correctedLines?.[2] || ''),
        f.scores?.[0]?.toFixed(3) || '',
        f.scores?.[1]?.toFixed(3) || '',
        f.scores?.[2]?.toFixed(3) || '',
        csvEscape(gt[0] || ''),
        csvEscape(gt[1] || ''),
        csvEscape(gt[2] || ''),
      ]);
    }
  }

  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mrz-training-data-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(str) {
  if (!str) return '""';
  return `"${str.replace(/"/g, '""').replace(/\n/g, '\\n')}"`;
}

// Clear all collected data
export function clearAll() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// Build a character-level confusion matrix from collected data
// Returns { [expected_char]: { [ocr_char]: count } }
export function buildConfusionMatrix() {
  const sessions = getSessions();
  const matrix = {};

  for (const session of sessions) {
    const gt = session.corrected?.lines || session.accepted?.lines;
    if (!gt || gt.length !== 3) continue;

    for (const frame of (session.frames || [])) {
      if (!frame.correctedLines || frame.correctedLines.length !== 3) continue;

      for (let lineIdx = 0; lineIdx < 3; lineIdx++) {
        const truth = gt[lineIdx] || '';
        // Use raw OCR lines if available, otherwise corrected
        const ocrRaw = frame.rawLines?.[lineIdx] || frame.correctedLines[lineIdx] || '';

        for (let charIdx = 0; charIdx < Math.min(truth.length, ocrRaw.length, 30); charIdx++) {
          const expected = truth[charIdx];
          const got = ocrRaw[charIdx];
          if (!expected || !got) continue;

          if (!matrix[expected]) matrix[expected] = {};
          matrix[expected][got] = (matrix[expected][got] || 0) + 1;
        }
      }
    }
  }

  return matrix;
}

function getDeviceInfo() {
  if (typeof navigator === 'undefined') return {};
  return {
    userAgent: navigator.userAgent?.substring(0, 100) || '',
    platform: navigator.platform || '',
    isNative: !!window.Capacitor?.isNativePlatform?.(),
  };
}
