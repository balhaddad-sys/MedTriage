// OCR Confidence Calibration — Platt Scaling + Isotonic Regression
//
// Medical-grade requirement: When the system says "confidence = 0.85",
// it must actually be correct ~85% of the time.
//
// This module:
//   1. Collects (predicted_confidence, was_correct) pairs from user corrections
//   2. Fits a Platt sigmoid: P(correct) = 1 / (1 + exp(A*f + B))
//   3. Applies calibration to raw OCR confidence scores
//   4. Computes Expected Calibration Error (ECE) to measure quality
//   5. Falls back to identity mapping when insufficient data
//
// Calibration is per-field (name, bed, age, dx, meds) since each has
// different error characteristics.

import { getCalibrationSamples, logCalibrationSample } from './ocrAuditLog.js';

// Minimum samples needed before calibration is applied
const MIN_CALIBRATION_SAMPLES = 30;

// Number of bins for ECE computation
const ECE_BINS = 10;

// Cached calibration models (per field)
let calibrationModels = {};
let lastModelFitTime = 0;
const MODEL_CACHE_MS = 300000; // Re-fit every 5 minutes

// Platt scaling parameters
function plattSigmoid(f, A, B) {
  return 1.0 / (1.0 + Math.exp(A * f + B));
}

// Fit Platt scaling via Newton-Raphson (simplified MLE)
// Ref: Platt (1999) "Probabilistic Outputs for SVMs"
function fitPlattScaling(predictions, labels) {
  const n = predictions.length;
  if (n < MIN_CALIBRATION_SAMPLES) return null;

  // Target values with Laplace smoothing
  const nPos = labels.filter(l => l).length;
  const nNeg = n - nPos;
  if (nPos === 0 || nNeg === 0) return null;

  const tPos = (nPos + 1) / (nPos + 2);
  const tNeg = 1 / (nNeg + 2);
  const t = labels.map(l => l ? tPos : tNeg);

  let A = 0;
  let B = Math.log((nNeg + 1) / (nPos + 1));
  const maxIter = 100;
  const epsilon = 1e-7;

  for (let iter = 0; iter < maxIter; iter++) {
    let d1a = 0, d1b = 0, d2a = 0, d2b = 0, d2ab = 0;

    for (let i = 0; i < n; i++) {
      const fApB = predictions[i] * A + B;
      let p;
      if (fApB >= 0) {
        p = Math.exp(-fApB) / (1 + Math.exp(-fApB));
      } else {
        p = 1 / (1 + Math.exp(fApB));
      }

      const d1 = t[i] - p;
      const d2 = p * (1 - p);

      d1a += predictions[i] * d1;
      d1b += d1;
      d2a += predictions[i] * predictions[i] * d2;
      d2b += d2;
      d2ab += predictions[i] * d2;
    }

    // Prevent singular Hessian
    if (Math.abs(d2a * d2b - d2ab * d2ab) < epsilon) break;

    const det = d2a * d2b - d2ab * d2ab;
    const dA = -(d2b * d1a - d2ab * d1b) / det;
    const dB = -(-d2ab * d1a + d2a * d1b) / det;

    A += dA;
    B += dB;

    if (Math.abs(dA) < epsilon && Math.abs(dB) < epsilon) break;
  }

  return { A, B };
}

// Isotonic regression (Pool Adjacent Violators)
// Used as backup when Platt doesn't fit well
function fitIsotonicRegression(predictions, labels) {
  const n = predictions.length;
  if (n < MIN_CALIBRATION_SAMPLES) return null;

  // Sort by prediction
  const pairs = predictions.map((p, i) => ({ pred: p, label: labels[i] ? 1 : 0 }));
  pairs.sort((a, b) => a.pred - b.pred);

  // Pool Adjacent Violators
  const blocks = pairs.map(p => ({ sum: p.label, count: 1, pred: p.pred }));

  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < blocks.length - 1; i++) {
      if (blocks[i].sum / blocks[i].count > blocks[i + 1].sum / blocks[i + 1].count) {
        blocks[i].sum += blocks[i + 1].sum;
        blocks[i].count += blocks[i + 1].count;
        blocks.splice(i + 1, 1);
        merged = true;
        break;
      }
    }
  }

  // Build lookup table
  const table = [];
  let idx = 0;
  for (const block of blocks) {
    const calibrated = block.sum / block.count;
    for (let i = 0; i < block.count; i++) {
      table.push({ raw: pairs[idx + i].pred, calibrated });
    }
    idx += block.count;
  }

  return table;
}

// Compute Expected Calibration Error
function computeECE(predictions, labels, calibrator) {
  const n = predictions.length;
  if (n === 0) return 1;

  const bins = Array.from({ length: ECE_BINS }, () => ({ sum: 0, correct: 0, count: 0 }));

  for (let i = 0; i < n; i++) {
    const calibrated = calibrator(predictions[i]);
    const binIdx = Math.min(Math.floor(calibrated * ECE_BINS), ECE_BINS - 1);
    bins[binIdx].sum += calibrated;
    bins[binIdx].correct += labels[i] ? 1 : 0;
    bins[binIdx].count++;
  }

  let ece = 0;
  for (const bin of bins) {
    if (bin.count === 0) continue;
    const avgConf = bin.sum / bin.count;
    const accuracy = bin.correct / bin.count;
    ece += (bin.count / n) * Math.abs(accuracy - avgConf);
  }

  return ece;
}

// Build calibration model for a specific field
async function buildFieldModel(field) {
  const samples = await getCalibrationSamples();
  const fieldSamples = field === 'overall'
    ? samples
    : samples.filter(s => s.field === field);

  if (fieldSamples.length < MIN_CALIBRATION_SAMPLES) {
    return { method: 'identity', sampleCount: fieldSamples.length, ece: null };
  }

  const predictions = fieldSamples.map(s => s.predictedConfidence);
  const labels = fieldSamples.map(s => s.wasCorrect);

  // Try Platt scaling
  const platt = fitPlattScaling(predictions, labels);
  const plattCalibrator = platt
    ? (f) => plattSigmoid(f, platt.A, platt.B)
    : (f) => f;
  const plattECE = platt ? computeECE(predictions, labels, plattCalibrator) : 1;

  // Try isotonic regression
  const isotonic = fitIsotonicRegression(predictions, labels);
  const isotonicCalibrator = isotonic
    ? (f) => interpolateIsotonic(isotonic, f)
    : (f) => f;
  const isotonicECE = isotonic ? computeECE(predictions, labels, isotonicCalibrator) : 1;

  // Pick better method
  if (plattECE <= isotonicECE && platt) {
    return {
      method: 'platt',
      params: platt,
      sampleCount: fieldSamples.length,
      ece: plattECE,
      calibrate: plattCalibrator,
    };
  } else if (isotonic) {
    return {
      method: 'isotonic',
      table: isotonic,
      sampleCount: fieldSamples.length,
      ece: isotonicECE,
      calibrate: isotonicCalibrator,
    };
  }

  return { method: 'identity', sampleCount: fieldSamples.length, ece: null };
}

function interpolateIsotonic(table, rawConfidence) {
  if (table.length === 0) return rawConfidence;
  if (rawConfidence <= table[0].raw) return table[0].calibrated;
  if (rawConfidence >= table[table.length - 1].raw) return table[table.length - 1].calibrated;

  for (let i = 0; i < table.length - 1; i++) {
    if (rawConfidence >= table[i].raw && rawConfidence <= table[i + 1].raw) {
      const range = table[i + 1].raw - table[i].raw;
      if (range === 0) return table[i].calibrated;
      const t = (rawConfidence - table[i].raw) / range;
      return table[i].calibrated + t * (table[i + 1].calibrated - table[i].calibrated);
    }
  }
  return rawConfidence;
}

// Ensure calibration models are fresh
async function ensureModels() {
  if (Date.now() - lastModelFitTime < MODEL_CACHE_MS && Object.keys(calibrationModels).length > 0) {
    return;
  }

  const fields = ['overall', 'fullName', 'bed', 'age', 'dx', 'meds', 'gender'];
  const models = {};

  for (const field of fields) {
    try {
      models[field] = await buildFieldModel(field);
    } catch {
      models[field] = { method: 'identity', sampleCount: 0, ece: null };
    }
  }

  calibrationModels = models;
  lastModelFitTime = Date.now();
}

// Calibrate a single confidence value
export async function calibrateConfidence(rawConfidence, field = 'overall') {
  await ensureModels();

  const model = calibrationModels[field] || calibrationModels.overall;
  if (!model || model.method === 'identity') return rawConfidence;

  return Math.max(0, Math.min(1, model.calibrate(rawConfidence)));
}

// Calibrate all confidence fields on a patient record
export async function calibratePatient(patient) {
  await ensureModels();

  const calibrated = { ...patient };
  calibrated.calibratedConfidence = await calibrateConfidence(patient.confidence || 0, 'overall');

  if (patient.fieldConfidence) {
    calibrated.calibratedFieldConfidence = {};
    for (const [field, conf] of Object.entries(patient.fieldConfidence)) {
      calibrated.calibratedFieldConfidence[field] = await calibrateConfidence(conf, field);
    }
  }

  return calibrated;
}

// Record a correction for calibration learning
export async function recordCalibrationCorrection(transactionId, patientIndex, field, predictedConfidence, wasCorrect) {
  await logCalibrationSample({
    transactionId,
    patientIndex,
    field,
    predictedConfidence,
    wasCorrect,
  });

  // Invalidate cache so models refit on next use
  lastModelFitTime = 0;
}

// Get calibration diagnostics
export async function getCalibrationDiagnostics() {
  await ensureModels();

  const diagnostics = {};
  for (const [field, model] of Object.entries(calibrationModels)) {
    diagnostics[field] = {
      method: model.method,
      sampleCount: model.sampleCount,
      ece: model.ece,
      isCalibrated: model.method !== 'identity',
      params: model.method === 'platt' ? model.params : undefined,
    };
  }

  return {
    fields: diagnostics,
    minSamplesRequired: MIN_CALIBRATION_SAMPLES,
    lastFitTime: lastModelFitTime > 0 ? new Date(lastModelFitTime).toISOString() : null,
    overallReady: (calibrationModels.overall?.method || 'identity') !== 'identity',
  };
}

// Generate reliability diagram data (for visualization / audit)
export async function getReliabilityDiagram(field = 'overall') {
  const samples = await getCalibrationSamples();
  const fieldSamples = field === 'overall' ? samples : samples.filter(s => s.field === field);

  if (fieldSamples.length < 10) return null;

  const bins = Array.from({ length: ECE_BINS }, () => ({ predictions: [], labels: [] }));

  for (const s of fieldSamples) {
    const binIdx = Math.min(Math.floor(s.predictedConfidence * ECE_BINS), ECE_BINS - 1);
    bins[binIdx].predictions.push(s.predictedConfidence);
    bins[binIdx].labels.push(s.wasCorrect ? 1 : 0);
  }

  return bins.map((bin, i) => ({
    binCenter: (i + 0.5) / ECE_BINS,
    avgConfidence: bin.predictions.length > 0 ? bin.predictions.reduce((s, v) => s + v, 0) / bin.predictions.length : (i + 0.5) / ECE_BINS,
    accuracy: bin.labels.length > 0 ? bin.labels.reduce((s, v) => s + v, 0) / bin.labels.length : null,
    count: bin.labels.length,
  }));
}
