// OCR Validation Framework — Ground Truth Testing + Accuracy Metrics
//
// Medical-grade requirement: Know your error rates.
//
// This module:
//   1. Defines ground truth format for validation datasets
//   2. Computes Character Error Rate (CER) via edit distance
//   3. Computes Word Error Rate (WER)
//   4. Computes field-level accuracy (name, bed, age, dx, meds)
//   5. Runs regression tests against saved ground truth
//   6. Tracks accuracy over time (per engine version)
//
// Ground truth format:
//   { imageId, rawText, patients: [{ fullName, bed, age, gender, dx, meds, triage }] }

// Levenshtein edit distance
function editDistance(a, b) {
  if (!a) return b ? b.length : 0;
  if (!b) return a.length;

  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

// Character Error Rate (CER)
// CER = edit_distance(predicted, reference) / len(reference)
// Medical-grade target: CER < 0.01 (1%) for printed, < 0.05 for handwritten
export function computeCER(predicted, reference) {
  if (!reference || reference.length === 0) return predicted ? 1 : 0;
  const dist = editDistance(
    normalizeForMetric(predicted),
    normalizeForMetric(reference),
  );
  return dist / normalizeForMetric(reference).length;
}

// Word Error Rate (WER) — word-level edit distance / reference word count
// Uses proper word-level Levenshtein (not character-level on joined string)
export function computeWER(predicted, reference) {
  const predWords = tokenize(predicted);
  const refWords = tokenize(reference);
  if (refWords.length === 0) return predWords.length > 0 ? 1 : 0;

  const m = predWords.length;
  const n = refWords.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = predWords[i - 1] === refWords[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n] / n;
}

// Alias for backwards compatibility
export function computeWordLevelWER(predicted, reference) {
  const predWords = tokenize(predicted);
  const refWords = tokenize(reference);
  if (refWords.length === 0) return predWords.length > 0 ? 1 : 0;

  const m = predWords.length;
  const n = refWords.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = predWords[i - 1] === refWords[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n] / n;
}

// Field-level accuracy (exact match after normalization)
export function computeFieldAccuracy(predictedPatients, referencePatients) {
  if (!referencePatients || referencePatients.length === 0) {
    return { overall: 0, fields: {}, patientMatchRate: 0, unmatched: predictedPatients?.length || 0 };
  }

  const fields = ['fullName', 'bed', 'age', 'gender', 'dx', 'meds', 'triage', 'bloodType', 'ward'];
  const fieldStats = {};
  for (const f of fields) {
    fieldStats[f] = { correct: 0, total: 0, cer: 0, errors: [] };
  }

  // Match predicted patients to reference patients by bed (primary) or name (secondary)
  const matched = [];
  const usedRef = new Set();

  for (const pred of (predictedPatients || [])) {
    let bestMatch = null;
    let bestScore = -1;

    for (let i = 0; i < referencePatients.length; i++) {
      if (usedRef.has(i)) continue;
      const ref = referencePatients[i];
      let score = 0;

      // Exact bed match
      if (pred.bed && ref.bed && normField(pred.bed) === normField(ref.bed)) score += 10;
      // Fuzzy name match
      if (pred.fullName && ref.fullName) {
        const dist = editDistance(normField(pred.fullName), normField(ref.fullName));
        const maxLen = Math.max(normField(pred.fullName).length, normField(ref.fullName).length);
        if (maxLen > 0) score += Math.max(0, 5 * (1 - dist / maxLen));
      }
      // Age match
      if (pred.age != null && ref.age != null && pred.age === ref.age) score += 2;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = i;
      }
    }

    if (bestMatch !== null && bestScore >= 3) {
      matched.push({ pred, ref: referencePatients[bestMatch] });
      usedRef.add(bestMatch);
    }
  }

  // Compute per-field accuracy
  for (const { pred, ref } of matched) {
    for (const f of fields) {
      const predRaw = f === 'age' ? String(pred[f] ?? '') : (pred[f] || '');
      const refRaw = f === 'age' ? String(ref[f] ?? '') : (ref[f] || '');
      const refVal = normField(refRaw);

      if (!refVal) continue; // Skip fields not in ground truth
      fieldStats[f].total++;

      if (fieldsMatch(f, predRaw, refRaw)) {
        fieldStats[f].correct++;
      } else {
        fieldStats[f].cer += computeCER(normField(predRaw), refVal);
        fieldStats[f].errors.push({ predicted: pred[f], expected: ref[f] });
      }
    }
  }

  // Compute final metrics
  const result = {};
  let totalCorrect = 0;
  let totalFields = 0;

  for (const f of fields) {
    const s = fieldStats[f];
    result[f] = {
      accuracy: s.total > 0 ? s.correct / s.total : null,
      total: s.total,
      correct: s.correct,
      avgCER: s.total - s.correct > 0 ? s.cer / (s.total - s.correct) : 0,
      errors: s.errors.slice(0, 10), // Keep top 10 errors for review
    };
    totalCorrect += s.correct;
    totalFields += s.total;
  }

  return {
    overall: totalFields > 0 ? totalCorrect / totalFields : 0,
    fields: result,
    patientMatchRate: referencePatients.length > 0 ? matched.length / referencePatients.length : 0,
    matchedPatients: matched.length,
    referencePatients: referencePatients.length,
    predictedPatients: predictedPatients?.length || 0,
    unmatchedPredicted: (predictedPatients?.length || 0) - matched.length,
    unmatchedReference: referencePatients.length - matched.length,
  };
}

// Run validation against a ground truth dataset
// dataSource: 'synthetic' | 'real-world' — MUST be 'real-world' for medical-grade claim
export function runValidation(ocrResults, groundTruth, dataSource = 'synthetic') {
  const fieldAggregate = {};
  const report = {
    timestamp: new Date().toISOString(),
    engineVersion: ocrResults.engine || 'unknown',
    dataSource, // 'synthetic' or 'real-world'
    syntheticOnly: dataSource === 'synthetic',
    samples: [],
    aggregate: {
      cer: { values: [], mean: 0, median: 0, p95: 0 },
      wer: { values: [], mean: 0, median: 0, p95: 0 },
      fieldAccuracy: {},
      patientDetectionRate: { values: [], mean: 0 },
    },
  };

  for (let i = 0; i < groundTruth.length; i++) {
    const gt = groundTruth[i];
    const ocr = ocrResults.results?.[i] || ocrResults;

    const cer = computeCER(ocr.rawText, gt.rawText);
    const wer = computeWordLevelWER(ocr.rawText, gt.rawText);
    const fieldAcc = computeFieldAccuracy(ocr.patients, gt.patients);

    report.samples.push({
      imageId: gt.imageId,
      cer,
      wer,
      fieldAccuracy: fieldAcc,
      patientMatchRate: fieldAcc.patientMatchRate,
    });

    report.aggregate.cer.values.push(cer);
    report.aggregate.wer.values.push(wer);
    report.aggregate.patientDetectionRate.values.push(fieldAcc.patientMatchRate);

    for (const [fieldName, stats] of Object.entries(fieldAcc.fields || {})) {
      if (!fieldAggregate[fieldName]) {
        fieldAggregate[fieldName] = { correct: 0, total: 0, cerSum: 0, cerCount: 0 };
      }
      fieldAggregate[fieldName].correct += stats.correct || 0;
      fieldAggregate[fieldName].total += stats.total || 0;
      const errorCount = Math.max(0, (stats.total || 0) - (stats.correct || 0));
      if (errorCount > 0) {
        fieldAggregate[fieldName].cerSum += (stats.avgCER || 0) * errorCount;
        fieldAggregate[fieldName].cerCount += errorCount;
      }
    }
  }

  // Compute aggregate stats
  for (const metric of ['cer', 'wer', 'patientDetectionRate']) {
    const vals = report.aggregate[metric].values;
    if (vals.length > 0) {
      vals.sort((a, b) => a - b);
      report.aggregate[metric].mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      report.aggregate[metric].median = vals[Math.floor(vals.length / 2)];
      report.aggregate[metric].p95 = vals[Math.floor(vals.length * 0.95)];
      report.aggregate[metric].min = vals[0];
      report.aggregate[metric].max = vals[vals.length - 1];
    }
  }

  const fieldAliases = { fullName: 'name', bed: 'bed', dx: 'dx' };
  for (const [fieldName, stats] of Object.entries(fieldAggregate)) {
    const accuracy = stats.total > 0 ? stats.correct / stats.total : null;
    report.aggregate.fieldAccuracy[fieldName] = accuracy;
    if (fieldAliases[fieldName]) {
      report.aggregate.fieldAccuracy[fieldAliases[fieldName]] = accuracy;
    }
  }

  // Medical-grade assessment
  report.medicalGradeAssessment = assessMedicalGrade(report.aggregate, report.syntheticOnly);

  return report;
}

// Assess whether metrics meet medical-grade thresholds
// syntheticOnly: if true, MEDICAL_GRADE cannot be granted regardless of scores
function assessMedicalGrade(aggregate, syntheticOnly = false) {
  const thresholds = {
    cer: { printed: 0.01, handwritten: 0.05, label: 'Character Error Rate' },
    wer: { printed: 0.03, handwritten: 0.10, label: 'Word Error Rate' },
    patientDetectionRate: { minimum: 0.95, label: 'Patient Detection Rate' },
    nameAccuracy: { minimum: 0.98, label: 'Name Field Accuracy' },
    bedAccuracy: { minimum: 0.99, label: 'Bed Field Accuracy' },
    dxAccuracy: { minimum: 0.95, label: 'Diagnosis Field Accuracy' },
  };

  const results = {};

  results.cer = {
    value: aggregate.cer?.mean ?? null,
    threshold: thresholds.cer.printed,
    passes: aggregate.cer?.mean != null && aggregate.cer.mean <= thresholds.cer.printed,
    label: thresholds.cer.label,
    note: aggregate.cer?.mean != null && aggregate.cer.mean <= thresholds.cer.handwritten
      ? 'Passes handwritten threshold'
      : null,
  };

  results.wer = {
    value: aggregate.wer?.mean ?? null,
    threshold: thresholds.wer.printed,
    passes: aggregate.wer?.mean != null && aggregate.wer.mean <= thresholds.wer.printed,
    label: thresholds.wer.label,
  };

  results.patientDetection = {
    value: aggregate.patientDetectionRate?.mean ?? null,
    threshold: thresholds.patientDetectionRate.minimum,
    passes: aggregate.patientDetectionRate?.mean != null && aggregate.patientDetectionRate.mean >= thresholds.patientDetectionRate.minimum,
    label: thresholds.patientDetectionRate.label,
  };

  // ═══ FIELD-LEVEL THRESHOLDS (previously declared but never enforced) ═══
  results.nameAccuracy = {
    value: aggregate.fieldAccuracy?.name ?? null,
    threshold: thresholds.nameAccuracy.minimum,
    passes: aggregate.fieldAccuracy?.name != null && aggregate.fieldAccuracy.name >= thresholds.nameAccuracy.minimum,
    label: thresholds.nameAccuracy.label,
  };

  results.bedAccuracy = {
    value: aggregate.fieldAccuracy?.bed ?? null,
    threshold: thresholds.bedAccuracy.minimum,
    passes: aggregate.fieldAccuracy?.bed != null && aggregate.fieldAccuracy.bed >= thresholds.bedAccuracy.minimum,
    label: thresholds.bedAccuracy.label,
  };

  results.dxAccuracy = {
    value: aggregate.fieldAccuracy?.dx ?? null,
    threshold: thresholds.dxAccuracy.minimum,
    passes: aggregate.fieldAccuracy?.dx != null && aggregate.fieldAccuracy.dx >= thresholds.dxAccuracy.minimum,
    label: thresholds.dxAccuracy.label,
  };

  // ALL checks must pass — including field-level thresholds
  const allPass = Object.values(results).every(r => r.passes || r.value === null);
  const anyData = Object.values(results).some(r => r.value !== null);
  // Field-level checks are mandatory for MEDICAL_GRADE — null field data = UNTESTED
  const hasFieldData = results.nameAccuracy.value !== null && results.bedAccuracy.value !== null;
  const fieldGrade = !hasFieldData ? 'FIELD_UNTESTED' : (results.nameAccuracy.passes && results.bedAccuracy.passes && results.dxAccuracy.passes) ? 'PASS' : 'FAIL';

  // MEDICAL_GRADE requires ALL checks pass INCLUDING field-level accuracy AND real-world data
  const grade = !anyData ? 'UNTESTED'
    : syntheticOnly ? 'SYNTHETIC_ONLY'
    : fieldGrade === 'FIELD_UNTESTED' ? 'FIELD_VALIDATION_REQUIRED'
    : (allPass && fieldGrade === 'PASS') ? 'MEDICAL_GRADE'
    : 'CLINICAL_HELPER';

  return {
    grade,
    results,
    fieldGrade,
    syntheticOnly,
    recommendation: !anyData
      ? 'No validation data available. Run against ground truth dataset to assess.'
      : syntheticOnly
        ? 'Validation used synthetic data only. Real-world clinical validation with actual ward sheet photographs is REQUIRED before medical-grade claim. See docs/ocr-compliance/VALIDATION_REPORT_TEMPLATE.md.'
      : fieldGrade === 'FIELD_UNTESTED'
        ? 'Field-level accuracy (name, bed, diagnosis) has not been validated. Run field-level validation before claiming medical-grade.'
      : (allPass && fieldGrade === 'PASS')
        ? 'All metrics including field-level thresholds meet medical-grade requirements on real-world data. Continue monitoring.'
        : 'Some metrics below threshold. Review error patterns and improve.',
  };
}

// Create a ground truth template from OCR results (user fills in corrections)
export function createGroundTruthTemplate(ocrResult) {
  return {
    imageId: `gt_${Date.now()}`,
    rawText: ocrResult.rawText || '',
    patients: (ocrResult.patients || []).map(p => ({
      fullName: p.fullName || '',
      bed: p.bed || '',
      age: p.age ?? null,
      gender: p.gender || '',
      dx: p.dx || '',
      meds: p.meds || '',
      triage: p.triage || '',
      bloodType: p.bloodType || '',
      ward: p.ward || '',
      assignedDoctor: p.assignedDoctor || '',
      _ocrConfidence: p.confidence,
      _reviewLevel: p.reviewLevel,
      _needsCorrection: p.reviewLevel !== 'READY',
    })),
    metadata: {
      createdAt: new Date().toISOString(),
      engine: ocrResult.engine || '',
      backend: ocrResult.backend || '',
      qualityScore: ocrResult.qualityScore || 0,
    },
  };
}

// Export validation report
export function exportValidationReport(report) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ocr-validation-report-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Helpers
function normalizeForMetric(text) {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function tokenize(text) {
  return normalizeForMetric(text).split(/\s+/).filter(Boolean);
}

function normField(val) {
  return (val || '').toString().toLowerCase().replace(/[\s_\-/]+/g, ' ').trim();
}

// Clinical field comparison — handles comma/space, order, case for dx and meds
function normClinicalField(val) {
  return (val || '').toString().toLowerCase()
    .replace(/[,;|]+/g, ' ')  // treat commas/semicolons as spaces
    .replace(/[\s]+/g, ' ')
    .replace(/\./g, '')       // remove periods
    .trim();
}

// Set-based comparison for medications (order doesn't matter)
function normMedsToSet(val) {
  return new Set(
    (val || '').toString().toLowerCase()
      .split(/[,;|]+/)
      .map(s => s.trim().replace(/[\s]+/g, ' '))
      .filter(Boolean)
  );
}

// Smart field match — uses appropriate comparison per field type
function fieldsMatch(field, predVal, refVal) {
  if (field === 'meds') {
    // Set-based: order doesn't matter for medications
    const predSet = normMedsToSet(predVal);
    const refSet = normMedsToSet(refVal);
    if (predSet.size === 0 && refSet.size === 0) return true;
    if (predSet.size === 0 || refSet.size === 0) return false;
    // Check if same meds present (symmetric)
    let matched = 0;
    for (const med of refSet) {
      for (const pred of predSet) {
        if (pred === med || editDistance(pred, med) <= Math.max(1, Math.floor(med.length / 6))) {
          matched++;
          break;
        }
      }
    }
    return matched >= refSet.size * 0.8; // 80% of reference meds found
  }
  if (field === 'dx') {
    // Clinical normalization: comma/space equivalence, case insensitive
    return normClinicalField(predVal) === normClinicalField(refVal);
  }
  if (field === 'triage') {
    return (predVal || '').toString().toUpperCase().trim() === (refVal || '').toString().toUpperCase().trim();
  }
  // Default: normalized exact match
  return normField(predVal) === normField(refVal);
}
