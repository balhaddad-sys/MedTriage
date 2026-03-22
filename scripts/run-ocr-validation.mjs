#!/usr/bin/env node
/**
 * OCR Validation Runner
 *
 * Validates ground truth dataset integrity and runs accuracy metrics.
 *
 * Mode 1 (default): Validate ground truth format + self-consistency
 * Mode 2 (--with-ocr-results <file>): Compare OCR output against ground truth
 *
 * Usage:
 *   node scripts/run-ocr-validation.mjs
 *   node scripts/run-ocr-validation.mjs --with-ocr-results training/ocr/ground-truth/ocr_results.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  computeCER,
  computeWER,
  computeFieldAccuracy,
  runValidation,
  exportValidationReport,
} from '../src/modules/evacuation/ocrValidation.js';
import { validatePatient } from '../src/modules/evacuation/ocrPatientSchema.js';

const GT_PATH = 'training/ocr/ground-truth/ground_truth.json';
const REPORT_PATH = 'training/ocr/ground-truth/validation_report.json';

// Medical-grade thresholds
const THRESHOLDS = {
  cer: { printed: 0.01, handwritten: 0.05 },
  wer: { printed: 0.03, handwritten: 0.10 },
  patientDetection: 0.95,
  nameAccuracy: 0.98,
  bedAccuracy: 0.99,
  dxAccuracy: 0.95,
};

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function banner(text) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${text}`);
  console.log('═'.repeat(60));
}

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }

// ═══════════════════════════════════════════════════════════════
// MODE 1: Ground Truth Validation
// ═══════════════════════════════════════════════════════════════

function validateGroundTruth(gt) {
  banner('GROUND TRUTH INTEGRITY CHECK');

  let errors = 0;
  let warnings = 0;
  let totalPatients = 0;

  for (let i = 0; i < gt.length; i++) {
    const entry = gt[i];

    // Required fields
    if (!entry.imageId) { fail(`Entry ${i}: missing imageId`); errors++; }
    if (!entry.rawText) { fail(`Entry ${i}: missing rawText`); errors++; }
    if (!entry.patients || !Array.isArray(entry.patients)) { fail(`Entry ${i}: missing/invalid patients array`); errors++; continue; }
    if (entry.patients.length === 0) { warn(`Entry ${i}: zero patients`); warnings++; }

    for (let j = 0; j < entry.patients.length; j++) {
      const p = entry.patients[j];
      totalPatients++;
      const v = validatePatient(p);
      if (!v.valid) {
        fail(`Entry ${i}, patient ${j} (${p.fullName || '?'}): ${v.errors.join('; ')}`);
        errors++;
      }
    }
  }

  console.log(`\n  Entries: ${gt.length}`);
  console.log(`  Patients: ${totalPatients}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Warnings: ${warnings}`);

  if (errors === 0) {
    pass(`Ground truth dataset is valid (${gt.length} sheets, ${totalPatients} patients)`);
  } else {
    fail(`Ground truth has ${errors} errors — fix before running validation`);
  }

  return errors === 0;
}

// ═══════════════════════════════════════════════════════════════
// MODE 1b: Self-Consistency (CER/WER on ground truth vs itself = 0)
// ═══════════════════════════════════════════════════════════════

function selfConsistencyCheck(gt) {
  banner('SELF-CONSISTENCY CHECK (ground truth vs itself)');

  // If we compare ground truth patients to themselves, accuracy should be 1.0
  let totalCER = 0;
  let totalWER = 0;
  let count = 0;

  for (const entry of gt.slice(0, 50)) { // Sample 50
    const cer = computeCER(entry.rawText, entry.rawText);
    const wer = computeWER(entry.rawText, entry.rawText);
    totalCER += cer;
    totalWER += wer;
    count++;

    if (cer !== 0) { fail(`Self-CER not 0 for ${entry.imageId}: ${cer}`); }
    if (wer !== 0) { fail(`Self-WER not 0 for ${entry.imageId}: ${wer}`); }
  }

  const fieldAcc = computeFieldAccuracy(
    gt[0].patients,
    gt[0].patients,
  );

  if (fieldAcc.overall === 1.0) {
    pass('Field accuracy self-check: 1.0 (perfect)');
  } else {
    fail(`Field accuracy self-check: ${fieldAcc.overall} (expected 1.0)`);
  }

  pass(`CER self-check: ${(totalCER / count).toFixed(6)} (expected 0)`);
  pass(`WER self-check: ${(totalWER / count).toFixed(6)} (expected 0)`);
}

// ═══════════════════════════════════════════════════════════════
// MODE 2: OCR Results vs Ground Truth
// ═══════════════════════════════════════════════════════════════

function runOCRValidation(gt, ocrResults) {
  banner('OCR ACCURACY VALIDATION');

  const matched = [];
  for (const gtEntry of gt) {
    const ocrEntry = ocrResults.find(r => r.imageId === gtEntry.imageId);
    if (ocrEntry) {
      matched.push({ gt: gtEntry, ocr: ocrEntry });
    }
  }

  info(`Matched ${matched.length}/${gt.length} ground truth entries to OCR results`);

  if (matched.length === 0) {
    fail('No matching entries found — check imageId alignment');
    return null;
  }

  // Per-sample metrics
  const metrics = {
    cer: [],
    wer: [],
    fieldAccuracy: [],
    patientDetection: [],
    byDifficulty: {},
    byStyle: {},
  };

  for (const { gt: gtEntry, ocr: ocrEntry } of matched) {
    const cer = computeCER(ocrEntry.rawText || '', gtEntry.rawText);
    const wer = computeWER(ocrEntry.rawText || '', gtEntry.rawText);
    const fieldAcc = computeFieldAccuracy(ocrEntry.patients || [], gtEntry.patients);

    metrics.cer.push(cer);
    metrics.wer.push(wer);
    metrics.fieldAccuracy.push(fieldAcc);
    metrics.patientDetection.push(fieldAcc.patientMatchRate);

    // By difficulty
    const diff = gtEntry.metadata?.difficulty || 'unknown';
    if (!metrics.byDifficulty[diff]) metrics.byDifficulty[diff] = { cer: [], wer: [], det: [] };
    metrics.byDifficulty[diff].cer.push(cer);
    metrics.byDifficulty[diff].wer.push(wer);
    metrics.byDifficulty[diff].det.push(fieldAcc.patientMatchRate);

    // By style
    const sty = gtEntry.metadata?.style || 'unknown';
    if (!metrics.byStyle[sty]) metrics.byStyle[sty] = { cer: [], wer: [], det: [] };
    metrics.byStyle[sty].cer.push(cer);
    metrics.byStyle[sty].wer.push(wer);
    metrics.byStyle[sty].det.push(fieldAcc.patientMatchRate);
  }

  // Aggregate
  const avg = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const p95 = arr => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length * 0.95)] || 0; };
  const med = arr => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] || 0; };

  banner('RESULTS');

  console.log(`\n  Overall (${matched.length} sheets):`);
  console.log(`    CER:   mean=${avg(metrics.cer).toFixed(4)}, median=${med(metrics.cer).toFixed(4)}, p95=${p95(metrics.cer).toFixed(4)}`);
  console.log(`    WER:   mean=${avg(metrics.wer).toFixed(4)}, median=${med(metrics.wer).toFixed(4)}, p95=${p95(metrics.wer).toFixed(4)}`);
  console.log(`    Patient Detection: mean=${avg(metrics.patientDetection).toFixed(4)}`);

  // Field-level aggregates
  const fields = ['fullName', 'bed', 'age', 'dx', 'meds', 'triage'];
  console.log(`\n  Field Accuracy:`);
  for (const f of fields) {
    const accs = metrics.fieldAccuracy
      .map(fa => fa.fields?.[f]?.accuracy)
      .filter(v => v != null);
    if (accs.length > 0) {
      console.log(`    ${f.padEnd(12)} ${(avg(accs) * 100).toFixed(1)}%`);
    }
  }

  // By difficulty
  console.log(`\n  By Difficulty:`);
  for (const [diff, data] of Object.entries(metrics.byDifficulty)) {
    console.log(`    ${diff.padEnd(10)} CER=${avg(data.cer).toFixed(4)}  WER=${avg(data.wer).toFixed(4)}  Detection=${avg(data.det).toFixed(4)}  (n=${data.cer.length})`);
  }

  // By style
  console.log(`\n  By Style:`);
  for (const [sty, data] of Object.entries(metrics.byStyle)) {
    console.log(`    ${sty.padEnd(20)} CER=${avg(data.cer).toFixed(4)}  Detection=${avg(data.det).toFixed(4)}  (n=${data.cer.length})`);
  }

  // Medical-grade assessment
  banner('MEDICAL-GRADE ASSESSMENT');

  const cerPass = avg(metrics.cer) <= THRESHOLDS.cer.printed;
  const werPass = avg(metrics.wer) <= THRESHOLDS.wer.printed;
  const detPass = avg(metrics.patientDetection) >= THRESHOLDS.patientDetection;

  (cerPass ? pass : fail)(`CER: ${(avg(metrics.cer) * 100).toFixed(2)}% (threshold: ${THRESHOLDS.cer.printed * 100}%)`);
  (werPass ? pass : fail)(`WER: ${(avg(metrics.wer) * 100).toFixed(2)}% (threshold: ${THRESHOLDS.wer.printed * 100}%)`);
  (detPass ? pass : fail)(`Patient Detection: ${(avg(metrics.patientDetection) * 100).toFixed(1)}% (threshold: ${THRESHOLDS.patientDetection * 100}%)`);

  const allPass = cerPass && werPass && detPass;
  console.log(`\n  VERDICT: ${allPass ? '✅ MEDICAL GRADE' : '❌ BELOW THRESHOLD — improvements needed'}`);

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    samplesEvaluated: matched.length,
    overall: {
      cer: { mean: avg(metrics.cer), median: med(metrics.cer), p95: p95(metrics.cer) },
      wer: { mean: avg(metrics.wer), median: med(metrics.wer), p95: p95(metrics.wer) },
      patientDetection: { mean: avg(metrics.patientDetection) },
    },
    byDifficulty: Object.fromEntries(
      Object.entries(metrics.byDifficulty).map(([k, v]) => [k, { cer: avg(v.cer), wer: avg(v.wer), detection: avg(v.det), n: v.cer.length }])
    ),
    byStyle: Object.fromEntries(
      Object.entries(metrics.byStyle).map(([k, v]) => [k, { cer: avg(v.cer), wer: avg(v.wer), detection: avg(v.det), n: v.cer.length }])
    ),
    medicalGrade: allPass,
    thresholds: THRESHOLDS,
  };

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  info(`Report saved to ${REPORT_PATH}`);

  return report;
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const ocrResultsArg = args.indexOf('--with-ocr-results');

if (!existsSync(GT_PATH)) {
  fail(`Ground truth not found at ${GT_PATH}`);
  console.log('  Run: python scripts/generate-ward-sheet-ground-truth.py');
  process.exit(1);
}

const gt = loadJSON(GT_PATH);

banner('OCR VALIDATION PIPELINE');
info(`Ground truth: ${gt.length} sheets`);

// Always validate ground truth integrity
const valid = validateGroundTruth(gt);
if (!valid) process.exit(1);

// Self-consistency
selfConsistencyCheck(gt);

// If OCR results provided, run full validation
if (ocrResultsArg >= 0 && args[ocrResultsArg + 1]) {
  const ocrPath = args[ocrResultsArg + 1];
  if (!existsSync(ocrPath)) {
    fail(`OCR results not found at ${ocrPath}`);
    process.exit(1);
  }
  const ocrResults = loadJSON(ocrPath);
  runOCRValidation(gt, ocrResults);
} else {
  banner('NEXT STEPS');
  info('Ground truth validated. To run full OCR accuracy measurement:');
  info('1. Run OCR engine on all ground truth images (browser or headless)');
  info('2. Save results as JSON: [{ imageId, rawText, patients: [...] }, ...]');
  info('3. Run: node scripts/run-ocr-validation.mjs --with-ocr-results <path>');
}
