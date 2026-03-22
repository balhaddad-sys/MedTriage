// OCR Training Data Collector — saves ward sheet photos + OCR output + user corrections
//
// Each scan session collects:
//   - Thumbnail of the original image (compressed JPEG, ~50KB)
//   - Raw OCR text output
//   - OCR-detected patients (what the engine produced)
//   - User-corrected patients (what was actually imported = ground truth)
//   - Engine metadata (profile, strategy, quality score, backend)
//
// Stored in localStorage under 'ocr_training_data'
// Export as JSON for offline analysis / model improvement

const STORAGE_KEY = 'ocr_training_data';
const MAX_SAMPLES = 50; // keep recent — images take more space
const THUMB_MAX_DIM = 800; // thumbnail max dimension
const THUMB_QUALITY = 0.6; // JPEG quality for thumbnails

// Create a compressed thumbnail from an image source
async function createThumbnail(imageSource) {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let img;

    if (imageSource instanceof HTMLCanvasElement) {
      img = imageSource;
    } else if (imageSource instanceof HTMLImageElement) {
      img = imageSource;
    } else {
      // File or Blob
      img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        if (imageSource instanceof Blob || imageSource instanceof File) {
          image.src = URL.createObjectURL(imageSource);
        } else if (typeof imageSource === 'string') {
          image.src = imageSource;
        } else {
          reject(new Error('Unknown image source'));
        }
      });
    }

    let w = img.width || img.naturalWidth;
    let h = img.height || img.naturalHeight;
    if (w > THUMB_MAX_DIM || h > THUMB_MAX_DIM) {
      const scale = THUMB_MAX_DIM / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);

    // Clean up object URL if we created one
    if (img !== imageSource && img.src?.startsWith('blob:')) {
      URL.revokeObjectURL(img.src);
    }

    return canvas.toDataURL('image/jpeg', THUMB_QUALITY);
  } catch (e) {
    console.warn('[OCR-DATA] Thumbnail creation failed:', e);
    return null;
  }
}

// Save a training sample
export async function saveTrainingSample({
  imageSource,
  rawText,
  ocrPatients,
  importedPatients,
  ocrMeta,
}) {
  const thumbnail = imageSource ? await createThumbnail(imageSource) : null;

  const sample = {
    id: `ocr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    device: getDeviceInfo(),

    // Image (compressed thumbnail)
    thumbnail,
    thumbnailSize: thumbnail ? Math.round(thumbnail.length * 0.75) : 0, // approx bytes

    // Raw OCR output
    rawText: (rawText || '').substring(0, 5000),

    // What OCR detected (engine output)
    ocrPatients: (ocrPatients || []).map(p => ({
      fullName: p.fullName || '',
      bed: p.bed || '',
      age: p.age ?? null,
      gender: p.gender || '',
      dx: p.dx || '',
      meds: p.meds || '',
      bloodType: p.bloodType || '',
      ward: p.ward || '',
      assignedDoctor: p.assignedDoctor || '',
      triage: p.triage || 'GREEN',
      mobility: p.mobility || '',
      reviewLevel: p.reviewLevel || '',
      confidence: p.confidence ?? null,
      fieldConfidence: p.fieldConfidence || null,
    })),

    // What user actually imported (ground truth)
    importedPatients: (importedPatients || []).map(p => ({
      fullName: p.fullName || '',
      bed: p.bed || '',
      age: p.age ?? null,
      gender: p.gender || '',
      dx: p.dx || '',
      meds: p.meds || '',
      bloodType: p.bloodType || '',
      ward: p.ward || '',
      assignedDoctor: p.assignedDoctor || '',
      triage: p.triage || 'GREEN',
      mobility: p.mobility || '',
    })),

    // Engine metadata
    meta: {
      engine: ocrMeta?.engine || '',
      backend: ocrMeta?.backend || '',
      strategy: ocrMeta?.strategy || '',
      profile: ocrMeta?.profile || '',
      qualityScore: ocrMeta?.qualityScore ?? null,
      qualityBand: ocrMeta?.qualityBand || '',
      wordConfidence: ocrMeta?.wordConfidence ?? null,
      processingTime: ocrMeta?.processingTime ?? null,
      reviewCount: ocrMeta?.reviewCount ?? null,
    },
  };

  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    existing.push(sample);
    while (existing.length > MAX_SAMPLES) existing.shift();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    console.log(`[OCR-DATA] Saved training sample: ${sample.id}, ${sample.ocrPatients.length} OCR → ${sample.importedPatients.length} imported`);
    return sample.id;
  } catch (e) {
    console.error('[OCR-DATA] Failed to save:', e);
    // If storage is full, try removing thumbnails from old samples
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      for (let i = 0; i < Math.min(10, existing.length); i++) {
        existing[i].thumbnail = null;
      }
      existing.push(sample);
      while (existing.length > MAX_SAMPLES) existing.shift();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch {
      console.error('[OCR-DATA] Still failed after cleanup');
    }
    return null;
  }
}

// Get all collected samples
export function getSamples() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

// Get summary stats
export function getTrainingStats() {
  const samples = getSamples();
  let totalOcrPatients = 0;
  let totalImported = 0;
  let totalEdited = 0;

  for (const s of samples) {
    totalOcrPatients += s.ocrPatients?.length || 0;
    totalImported += s.importedPatients?.length || 0;

    // Count how many were edited (name or dx differs between OCR and imported)
    for (const imp of (s.importedPatients || [])) {
      const ocrMatch = (s.ocrPatients || []).find(o => o.bed === imp.bed);
      if (ocrMatch && (ocrMatch.fullName !== imp.fullName || ocrMatch.dx !== imp.dx)) {
        totalEdited++;
      }
    }
  }

  return {
    samples: samples.length,
    totalOcrPatients,
    totalImported,
    totalEdited,
    withThumbnails: samples.filter(s => s.thumbnail).length,
  };
}

// Export all training data as JSON
export function exportTrainingJSON() {
  const samples = getSamples();
  const blob = new Blob([JSON.stringify(samples, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ocr-training-data-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Export as CSV (one row per patient, paired OCR vs imported)
export function exportTrainingCSV() {
  const samples = getSamples();
  const rows = [[
    'sample_id', 'timestamp', 'strategy', 'quality_score',
    'ocr_name', 'ocr_bed', 'ocr_age', 'ocr_dx', 'ocr_meds', 'ocr_triage',
    'true_name', 'true_bed', 'true_age', 'true_dx', 'true_meds', 'true_triage',
    'name_match', 'dx_match',
  ]];

  for (const s of samples) {
    const imported = s.importedPatients || [];
    const ocr = s.ocrPatients || [];

    for (let i = 0; i < Math.max(ocr.length, imported.length); i++) {
      const o = ocr[i] || {};
      const t = imported[i] || {};
      rows.push([
        s.id,
        s.timestamp,
        s.meta?.strategy || '',
        s.meta?.qualityScore ?? '',
        esc(o.fullName), esc(o.bed), o.age ?? '', esc(o.dx), esc(o.meds), o.triage || '',
        esc(t.fullName), esc(t.bed), t.age ?? '', esc(t.dx), esc(t.meds), t.triage || '',
        o.fullName === t.fullName ? '1' : '0',
        o.dx === t.dx ? '1' : '0',
      ]);
    }
  }

  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ocr-training-data-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function esc(str) {
  if (!str) return '""';
  return `"${String(str).replace(/"/g, '""').replace(/\n/g, ' ')}"`;
}

// Clear all collected data
export function clearTrainingData() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

function getDeviceInfo() {
  if (typeof navigator === 'undefined') return {};
  return {
    userAgent: navigator.userAgent?.substring(0, 100) || '',
    platform: navigator.platform || '',
  };
}
