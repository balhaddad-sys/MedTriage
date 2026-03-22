// OCR VLM Bridge — Optional backend that delegates to the local VLM API server
//
// When the Docker VLM engine is running (localhost:8701), this module sends
// images to it for high-accuracy VLM-based OCR and returns results in the
// same format as the built-in PaddleOCR engine.
//
// Falls back gracefully to the built-in engine if the VLM server is unavailable.

const VLM_API_BASE = 'http://localhost:8701';
const VLM_TIMEOUT_MS = 30000;

let vlmAvailable = null; // null = unknown, true/false = cached probe result
let lastProbeTime = 0;
const PROBE_CACHE_MS = 60000; // Re-check availability every 60s

// ═══════════════════════════════════════════════════════════════════
// AVAILABILITY CHECK
// ═══════════════════════════════════════════════════════════════════
export async function isVlmAvailable() {
  const now = Date.now();
  if (vlmAvailable !== null && (now - lastProbeTime) < PROBE_CACHE_MS) {
    return vlmAvailable;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${VLM_API_BASE}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    vlmAvailable = res.ok;
  } catch {
    vlmAvailable = false;
  }
  lastProbeTime = now;
  return vlmAvailable;
}

// ═══════════════════════════════════════════════════════════════════
// SEND IMAGE TO VLM SERVER
// ═══════════════════════════════════════════════════════════════════
export async function processWithVlm(imageSource, onProgress) {
  onProgress?.('Connecting to VLM engine...');

  // Convert canvas/image to blob
  const blob = await imageToBlob(imageSource);
  if (!blob) throw new Error('Could not convert image to blob');

  const formData = new FormData();
  formData.append('file', blob, 'scan.png');
  formData.append('user', 'medevac_app');

  onProgress?.('Sending to VLM engine for analysis...');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VLM_TIMEOUT_MS);

  try {
    const res = await fetch(`${VLM_API_BASE}/ocr`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`VLM server returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    onProgress?.('VLM analysis complete, building patient list...');
    return transformVlmResponse(data);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('VLM engine timed out');
    }
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SUBMIT CORRECTION (self-expanding)
// ═══════════════════════════════════════════════════════════════════
export async function submitVlmCorrection(imageName, originalText, correctedText, reviewer = 'doctor') {
  const formData = new FormData();
  formData.append('image_name', imageName);
  formData.append('original_text', originalText);
  formData.append('corrected_text', correctedText);
  formData.append('reviewer', reviewer);

  const res = await fetch(`${VLM_API_BASE}/correct`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Correction submission failed: ${res.status}`);
  }
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════
// GET VLM STATS
// ═══════════════════════════════════════════════════════════════════
export async function getVlmStats() {
  const res = await fetch(`${VLM_API_BASE}/stats`);
  if (!res.ok) throw new Error(`Stats request failed: ${res.status}`);
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════
// TRANSFORM VLM RESPONSE -> ocrEngine format
// ═══════════════════════════════════════════════════════════════════
function transformVlmResponse(vlmData) {
  // vlmData.elements is the array of OCR results from the VLM engine
  const elements = vlmData.elements || [];

  // Reconstruct raw text from accepted elements
  const rawText = elements
    .filter(e => e.status === 'accepted' || e.status === 'review')
    .map(e => e.text)
    .join('\n');

  return {
    rawText,
    vlmElements: elements,
    vlmSummary: vlmData.summary || {},
    backend: 'vlm-' + (vlmData.backend || 'paddle'),
    processingTime: (vlmData.processing_time_s || 0) * 1000,
    qualityScore: vlmData.summary?.avg_confidence || 0,
    fileHash: vlmData.file_hash || '',
  };
}

// ═══════════════════════════════════════════════════════════════════
// IMAGE HELPERS
// ═══════════════════════════════════════════════════════════════════
async function imageToBlob(source) {
  // Canvas element
  if (source instanceof HTMLCanvasElement) {
    return new Promise(resolve => source.toBlob(resolve, 'image/png'));
  }

  // Already a blob
  if (source instanceof Blob) {
    return source;
  }

  // Image element — draw to canvas first
  if (source instanceof HTMLImageElement) {
    const canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth || source.width;
    canvas.height = source.naturalHeight || source.height;
    canvas.getContext('2d').drawImage(source, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }

  // Data URL string
  if (typeof source === 'string' && source.startsWith('data:')) {
    const res = await fetch(source);
    return res.blob();
  }

  return null;
}
