// MedEvac OCR Engine v3 — Entity-First Spatial Clustering
// Handles: printed tables, handwritten lists, whiteboards, chaotic mixed layouts
// Architecture: Image → OCR boxes → Entity Recognition → DBSCAN Clustering → Patient Assembly

// ====== IMAGE PREPROCESSING ======
const ImagePreprocessor = {
  async prepareVariants(imageSource) {
    const baseCanvas = await this.process(imageSource);
    return this.buildVariants(baseCanvas);
  },

  async process(imageSource) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = await this.loadImage(imageSource);

    // Downscale large images for performance (max 1600px — faster inference, still accurate)
    const maxDim = 1600;
    let w = img.width, h = img.height;
    if (w > maxDim || h > maxDim) {
      const scale = maxDim / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);

    return canvas;
  },

  cloneCanvas(source) {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    canvas.getContext('2d').drawImage(source, 0, 0);
    return canvas;
  },

  buildVariants(baseCanvas, profiles = OCR_PROFILES) {
    return profiles.map(profile => ({
      ...profile,
      canvas: this.applyProfile(baseCanvas, profile.id),
    }));
  },

  buildRescueVariants(baseCanvas) {
    return [
      { id: 'sharpened', label: 'Sharpened rescue', canvas: this.applyProfile(baseCanvas, 'sharpened') },
      { id: 'balanced-rotate-left', label: 'Rotate left rescue', canvas: this.applyProfile(this.rotateCanvas(baseCanvas, -90), 'balanced') },
      { id: 'balanced-rotate-right', label: 'Rotate right rescue', canvas: this.applyProfile(this.rotateCanvas(baseCanvas, 90), 'balanced') },
    ];
  },

  rotateCanvas(source, degrees) {
    const radians = degrees * Math.PI / 180;
    const vertical = Math.abs(degrees) % 180 === 90;
    const canvas = document.createElement('canvas');
    canvas.width = vertical ? source.height : source.width;
    canvas.height = vertical ? source.width : source.height;
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(radians);
    ctx.drawImage(source, -source.width / 2, -source.height / 2);
    return canvas;
  },

  buildGrayBuffer(imageData) {
    const gray = new Uint8ClampedArray(imageData.data.length / 4);
    let sum = 0;
    let sumSquares = 0;

    for (let i = 0, j = 0; i < imageData.data.length; i += 4, j++) {
      const value = Math.round(
        (imageData.data[i] * 0.299) +
        (imageData.data[i + 1] * 0.587) +
        (imageData.data[i + 2] * 0.114)
      );
      gray[j] = value;
      sum += value;
      sumSquares += value * value;
    }

    const mean = gray.length ? sum / gray.length : 128;
    const variance = gray.length ? Math.max(0, (sumSquares / gray.length) - (mean * mean)) : 0;
    return { gray, mean, stdev: Math.sqrt(variance) };
  },

  paintGray(imageData, grayValues, mapper) {
    for (let i = 0, j = 0; i < imageData.data.length; i += 4, j++) {
      const value = Math.max(0, Math.min(255, mapper(grayValues[j], j)));
      imageData.data[i] = value;
      imageData.data[i + 1] = value;
      imageData.data[i + 2] = value;
    }
  },

  applyProfile(baseCanvas, profileId) {
    const canvas = this.cloneCanvas(baseCanvas);
    if (profileId === 'source') return canvas;

    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { gray, mean, stdev } = this.buildGrayBuffer(imageData);

    if (profileId === 'balanced') {
      this.paintGray(imageData, gray, value => ((value - mean) * 1.45) + 150);
    } else if (profileId === 'sharpened') {
      this.paintGray(imageData, gray, value => ((value - mean) * 1.9) + 150);
    } else {
      const threshold = Math.max(82, Math.min(190, mean - (stdev * 0.2)));
      this.paintGray(imageData, gray, value => {
        if (value < threshold - 18) return 0;
        if (value > threshold + 24) return 255;
        return ((value - threshold) * 3.2) + 128;
      });
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  },

  loadImage(source) {
    return new Promise((resolve, reject) => {
      if (source instanceof HTMLCanvasElement) {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = source.toDataURL();
        return;
      }
      if (source instanceof HTMLImageElement) {
        if (source.complete) return resolve(source);
        source.onload = () => resolve(source);
        source.onerror = reject;
        return;
      }
      const img = new Image();
      img.onload = () => {
        if (typeof img.src === 'string' && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
        resolve(img);
      };
      img.onerror = reject;
      if (source instanceof Blob) {
        img.src = URL.createObjectURL(source);
      } else if (typeof source === 'string') {
        img.src = source;
      } else {
        reject(new Error('Unsupported image source'));
      }
    });
  },
};

// Single pass by default — only retry with cleanup if source quality is poor
const OCR_PROFILES = [
  { id: 'source', label: 'Source image' },
  { id: 'balanced', label: 'Balanced cleanup' },
  { id: 'high-contrast', label: 'High contrast' },
];

const REVIEW_PRIORITY = { READY: 0, REVIEW: 1, VERIFY: 2 };
const OCR_CONFUSION_GROUPS = [
  ['0', 'O', 'Q', 'D'],
  ['1', 'I', 'L', '|', '!'],
  ['2', 'Z'],
  ['5', 'S', '$'],
  ['6', 'G'],
  ['7', 'T'],
  ['8', 'B'],
];
const OCR_CONFUSION_CANONICAL = Object.fromEntries(
  OCR_CONFUSION_GROUPS.flatMap(group => group.map(char => [char, group[0]]))
);
const HEADER_PATTERNS = [
  /^(name|patient|pt|bed|room|rm|age|sex|gender|diagnosis|diag|dx|meds?|medications?|allerg(?:y|ies)|code|status|ward|location|notes?|id|mrn)$/i,
  /^(اسم|المريض|سرير|غرفة|العمر|الجنس|التشخيص|أدوية|ادوية|حساسية|الحالة|الرقم|ملاحظات)$/i,
];

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function average(values, fallback = 0) {
  const valid = values.filter(v => Number.isFinite(v));
  if (valid.length === 0) return fallback;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function weightedAverage(items, fallback = 0) {
  const valid = items.filter(item => Number.isFinite(item?.value) && Number.isFinite(item?.weight) && item.weight > 0);
  if (valid.length === 0) return fallback;
  const totalWeight = valid.reduce((sum, item) => sum + item.weight, 0);
  const weighted = valid.reduce((sum, item) => sum + (item.value * item.weight), 0);
  return weighted / totalWeight;
}

function confidenceBand(score) {
  if (score >= 0.85) return 'HIGH';
  if (score >= 0.7) return 'MEDIUM';
  return 'LOW';
}

function normalizeArabicText(text) {
  return `${text || ''}`
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u0623\u0625\u0622]/g, '\u0627')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0649/g, '\u064A');
}

function stripForLexicon(text) {
  return `${text || ''}`
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9\u0600-\u06FF ]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

function normalizeLatinOcrToken(text) {
  return stripForLexicon(text).replace(/[A-Z0-9$|!]/g, char => OCR_CONFUSION_CANONICAL[char] || char);
}

function substitutionCost(a, b) {
  if (a === b) return 0;
  if ((OCR_CONFUSION_CANONICAL[a] || a) === (OCR_CONFUSION_CANONICAL[b] || b)) return 0.18;
  return 1;
}

// OCR-aware edit distance — single-row O(min(m,n)) memory with early termination
function ocrDistance(a, b, maxDist) {
  const left = `${a || ''}`;
  const right = `${b || ''}`;
  if (left === right) return 0;
  const m = left.length, n = right.length;
  if (maxDist != null && Math.abs(m - n) > maxDist) return maxDist + 1;
  // Use shorter string as inner loop
  const [short, long, sLen, lLen] = m <= n ? [left, right, m, n] : [right, left, n, m];
  let prev = new Float32Array(sLen + 1);
  let curr = new Float32Array(sLen + 1);
  for (let i = 0; i <= sLen; i++) prev[i] = i;
  for (let j = 1; j <= lLen; j++) {
    curr[0] = j;
    let rowMin = j;
    for (let i = 1; i <= sLen; i++) {
      curr[i] = Math.min(
        prev[i] + 1,
        curr[i - 1] + 1,
        prev[i - 1] + substitutionCost(short[i - 1], long[j - 1])
      );
      if (curr[i] < rowMin) rowMin = curr[i];
    }
    if (maxDist != null && rowMin > maxDist) return maxDist + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[sLen];
}

function isHeaderLike(text) {
  const cleaned = `${text || ''}`.trim().replace(/[:\-]+$/, '');
  return HEADER_PATTERNS.some(pattern => pattern.test(cleaned));
}

function dedupeWarnings(warnings) {
  const seen = new Set();
  return warnings.filter(warning => {
    const key = `${warning.field}|${warning.message}|${warning.severity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeNameForMerge(name) {
  return `${name || ''}`.replace(/[^A-Za-z\u0600-\u06FF]/g, '').toUpperCase();
}

function mergeListValues(a, b) {
  return [...new Set([...(a ? a.split(/\s*,\s*/) : []), ...(b ? b.split(/\s*,\s*/) : [])].filter(Boolean))].join(', ');
}

function normalizeBedForMatch(bed) {
  return `${bed || ''}`
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[OQ]/g, '0')
    .replace(/[|IL]/g, '1');
}

function normalizeCivilIdForMatch(value) {
  return `${value || ''}`
    .replace(/[\s\-]/g, '')
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1');
}

const FIELD_CONFIDENCE_KEYS = {
  fullName: 'fullName',
  age: 'age',
  gender: 'gender',
  bed: 'bed',
  civilId: 'civilId',
  dx: 'dx',
  meds: 'meds',
  allergies: 'allergies',
  code: 'code',
  ward: 'ward',
  o2: 'o2',
  iso: 'iso',
};

function canonicalizeConsensusValue(field, value) {
  const text = `${value ?? ''}`.trim();
  if (!text) return '';

  switch (field) {
    case 'fullName':
      return normalizeNameForMerge(text);
    case 'bed':
      return normalizeBedForMatch(text);
    case 'civilId':
      return normalizeCivilIdForMatch(text);
    case 'age':
      return /^\d+$/.test(text) ? text : `${parseInt(text, 10) || ''}`;
    case 'gender':
    case 'code':
    case 'o2':
    case 'iso':
    case 'suggestedTriage':
    case 'suggestedMobility':
      return text.toUpperCase();
    case 'dx':
    case 'meds':
    case 'allergies':
    case 'ward':
      return stripForLexicon(text) || text.toUpperCase();
    default:
      return text.toUpperCase();
  }
}

function normalizeConsensusOutput(field, value) {
  if (value == null || value === '') return null;
  const text = `${value}`.trim();
  if (!text) return null;

  switch (field) {
    case 'fullName':
      return text.replace(/\s+/g, ' ');
    case 'bed':
      return normalizeBedForMatch(text) || text.toUpperCase();
    case 'civilId':
      return normalizeCivilIdForMatch(text) || text;
    case 'age': {
      const age = parseInt(text, 10);
      return Number.isFinite(age) ? age : null;
    }
    case 'gender':
    case 'code':
    case 'o2':
    case 'iso':
    case 'suggestedTriage':
    case 'suggestedMobility':
      return text.toUpperCase();
    default:
      return text;
  }
}

function fieldVoteScore(patient, field, value) {
  const fieldKey = FIELD_CONFIDENCE_KEYS[field];
  const fieldConfidence = fieldKey ? (patient.fieldConfidence?.[fieldKey] || 0) : 0;
  const compactLength = typeof value === 'string' ? value.replace(/\s+/g, '').length : 0;
  let completenessBonus = compactLength > 0 ? Math.min(compactLength, 18) / 180 : 0;
  let noisePenalty = 0;

  if (field === 'fullName') {
    const tokenCount = typeof value === 'string' ? value.trim().split(/\s+/).filter(Boolean).length : 0;
    completenessBonus = 0;
    noisePenalty += Math.max(0, tokenCount - 2) * 0.04;
    noisePenalty += Math.max(0, (patient.rawEntityCount || 0) - 6) * 0.035;
  }

  return clamp((fieldConfidence * 0.72) + ((patient.confidence || 0) * 0.28) + completenessBonus - noisePenalty, 0, 1.08);
}

function buildScalarFieldConsensus(patients, field) {
  const votes = new Map();

  for (const patient of patients) {
    const rawValue = patient[field];
    if (rawValue == null || rawValue === '') continue;

    const key = canonicalizeConsensusValue(field, rawValue);
    if (!key) continue;

    const value = normalizeConsensusOutput(field, rawValue);
    const weight = fieldVoteScore(patient, field, rawValue);
    const existing = votes.get(key) || { value, weight: 0, count: 0, bestScore: -1 };

    existing.weight += weight;
    existing.count += 1;
    if (weight > existing.bestScore || (Math.abs(weight - existing.bestScore) < 0.02 && `${value}`.length > `${existing.value}`.length)) {
      existing.value = value;
      existing.bestScore = weight;
    }

    votes.set(key, existing);
  }

  if (votes.size === 0) return { value: null, confidence: 0 };

  const ranked = [...votes.values()].sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    if (b.count !== a.count) return b.count - a.count;
    return b.bestScore - a.bestScore;
  });

  const best = ranked[0];
  const totalWeight = ranked.reduce((sum, item) => sum + item.weight, 0);
  return {
    value: best.value,
    confidence: clamp(weightedAverage([
      { value: clamp(best.bestScore), weight: 0.7 },
      { value: totalWeight > 0 ? best.weight / totalWeight : 0, weight: 0.3 },
    ], best.bestScore)),
  };
}

function splitListFieldValues(value) {
  return `${value || ''}`.split(/\s*,\s*/).map(item => item.trim()).filter(Boolean);
}

function buildListFieldConsensus(patients, field) {
  const votes = new Map();

  for (const patient of patients) {
    for (const rawValue of splitListFieldValues(patient[field])) {
      const key = canonicalizeConsensusValue(field, rawValue);
      if (!key) continue;

      const value = normalizeConsensusOutput(field, rawValue);
      const weight = fieldVoteScore(patient, field, rawValue);
      const existing = votes.get(key) || { value, weight: 0, count: 0, bestScore: -1 };

      existing.weight += weight;
      existing.count += 1;
      if (weight > existing.bestScore || (Math.abs(weight - existing.bestScore) < 0.02 && `${value}`.length > `${existing.value}`.length)) {
        existing.value = value;
        existing.bestScore = weight;
      }

      votes.set(key, existing);
    }
  }

  if (votes.size === 0) return { value: null, confidence: 0 };

  const ranked = [...votes.values()].sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    if (b.count !== a.count) return b.count - a.count;
    return b.bestScore - a.bestScore;
  });

  const strongestWeight = ranked[0].weight;
  const kept = ranked
    .filter((item, index) => item.count > 1 || item.weight >= Math.max(0.58, strongestWeight * 0.5) || index === 0)
    .slice(0, 6);

  return {
    value: kept.map(item => item.value).join(', '),
    confidence: clamp(average(kept.map(item => weightedAverage([
      { value: clamp(item.bestScore), weight: 0.65 },
      { value: Math.min(1, item.count / Math.max(patients.length, 1)), weight: 0.35 },
    ], item.bestScore)), 0)),
  };
}

function consolidatePatientGroup(patients) {
  if (patients.length === 0) return null;

  const scalarFields = [
    'fullName', 'age', 'gender', 'bed', 'civilId',
    'allergies', 'code', 'ward', 'o2', 'iso',
    'suggestedTriage', 'suggestedMobility',
  ];
  const listFields = ['dx', 'meds'];
  const scalarConsensus = Object.fromEntries(scalarFields.map(field => [field, buildScalarFieldConsensus(patients, field)]));
  const listConsensus = Object.fromEntries(listFields.map(field => [field, buildListFieldConsensus(patients, field)]));

  const fieldConfidence = {};
  Object.entries({ ...scalarConsensus, ...listConsensus }).forEach(([field, result]) => {
    if (result.value == null || result.value === '') return;
    const fieldKey = FIELD_CONFIDENCE_KEYS[field] || field;
    fieldConfidence[fieldKey] = result.confidence;
  });

  const merged = {
    fullName: scalarConsensus.fullName.value,
    age: scalarConsensus.age.value,
    gender: scalarConsensus.gender.value,
    bed: scalarConsensus.bed.value,
    civilId: scalarConsensus.civilId.value,
    dx: listConsensus.dx.value,
    meds: listConsensus.meds.value,
    allergies: scalarConsensus.allergies.value,
    code: scalarConsensus.code.value,
    ward: scalarConsensus.ward.value,
    o2: scalarConsensus.o2.value,
    iso: scalarConsensus.iso.value,
    suggestedTriage: scalarConsensus.suggestedTriage.value,
    suggestedMobility: scalarConsensus.suggestedMobility.value,
    warnings: dedupeWarnings(patients.flatMap(patient => patient.warnings || [])),
    fieldConfidence,
    rawEntityCount: patients.reduce((sum, patient) => sum + (patient.rawEntityCount || 0), 0),
    supportVotes: patients.length,
    reviewReasons: [...new Set(patients.flatMap(patient => patient.reviewReasons || []))],
  };

  const baseConfidence = average(patients.map(patient => patient.confidence), 0);
  const ageGenderConfidence = weightedAverage([
    { value: fieldConfidence.age, weight: 1 },
    { value: fieldConfidence.gender, weight: 1 },
  ], 0);
  merged.confidence = clamp(weightedAverage([
    { value: fieldConfidence.fullName, weight: 3 },
    { value: fieldConfidence.bed, weight: 2.5 },
    { value: ageGenderConfidence, weight: 2.1 },
    { value: fieldConfidence.age, weight: merged.gender ? 0.4 : 1.1 },
    { value: fieldConfidence.gender, weight: merged.age != null ? 0.4 : 1.1 },
    { value: fieldConfidence.civilId, weight: 1.5 },
    { value: fieldConfidence.dx, weight: 1.7 },
    { value: fieldConfidence.meds, weight: 1.1 },
    { value: fieldConfidence.allergies, weight: 0.7 },
    { value: fieldConfidence.code, weight: 0.6 },
    { value: fieldConfidence.o2, weight: 0.5 },
    { value: fieldConfidence.iso, weight: 0.5 },
  ], baseConfidence) + ((Math.min(patients.length, 4) - 1) * 0.02));

  const reviewLevel = patients.reduce((current, patient) => (
    (REVIEW_PRIORITY[patient.reviewLevel] ?? 0) > (REVIEW_PRIORITY[current] ?? 0)
      ? patient.reviewLevel
      : current
  ), 'READY');
  merged.reviewLevel = reviewLevel;

  if (!merged.fullName && !merged.bed && !merged.dx && !merged.civilId) return null;
  return merged;
}

function scoreTextDensity(rawText) {
  const compact = `${rawText || ''}`.replace(/\s+/g, '');
  if (!compact) return 0;
  const useful = (compact.match(/[A-Za-z0-9\u0600-\u06FF]/g) || []).length;
  return clamp(useful / compact.length);
}

function enrichPatientForReview(patient) {
  const identifierCount = (patient.fullName ? 1 : 0) + (patient.bed ? 1 : 0) + ((patient.age != null || patient.gender) ? 1 : 0) + (patient.civilId ? 1 : 0);
  const severeWarning = (patient.warnings || []).some(w => ['ERROR', 'CLINICAL_ALERT'].includes(w.severity));
  const reasons = [];

  if (identifierCount < 2) reasons.push('Partial identifiers captured');
  if (patient.fullName && (patient.fieldConfidence?.fullName || 0) < 0.6) reasons.push('Name needs confirmation');
  if (patient.bed && (patient.fieldConfidence?.bed || 0) < 0.65) reasons.push('Bed needs confirmation');
  if ((patient.rawEntityCount || 0) <= 2) reasons.push('Sparse OCR evidence');
  if ((patient.confidence || 0) < 0.62) reasons.push('Low OCR confidence');
  if (severeWarning) reasons.push('Clinical cross-check flagged this record');

  let reviewLevel = 'READY';
  if (severeWarning || (patient.confidence || 0) < 0.52 || identifierCount === 0) reviewLevel = 'VERIFY';
  else if (reasons.length > 0 || (patient.warnings || []).length > 0 || (patient.confidence || 0) < 0.8) reviewLevel = 'REVIEW';

  patient.identifierCount = identifierCount;
  patient.reviewLevel = reviewLevel;
  patient.reviewReasons = [...new Set(reasons)];
  return patient;
}

// ====== MEDICAL VOCABULARY ======
const MedicalVocabulary = {
  MEDICAL_TERMS: {
    // Cardiovascular
    'NSTEMI': { category: 'cardio', severity: 'YELLOW' }, 'STEMI': { category: 'cardio', severity: 'RED' },
    'MI': { category: 'cardio', severity: 'RED' }, 'ACS': { category: 'cardio', severity: 'RED' },
    'AF': { category: 'cardio', severity: 'YELLOW' }, 'SVT': { category: 'cardio', severity: 'YELLOW' },
    'VT': { category: 'cardio', severity: 'RED' }, 'VF': { category: 'cardio', severity: 'RED' },
    'CHF': { category: 'cardio', severity: 'YELLOW' }, 'HF': { category: 'cardio', severity: 'YELLOW' },
    'ADHF': { category: 'cardio', severity: 'RED' }, 'HTN': { category: 'cardio', severity: 'GREEN' },
    'DVT': { category: 'cardio', severity: 'YELLOW' }, 'PE': { category: 'cardio', severity: 'RED' },
    'CAD': { category: 'cardio', severity: 'YELLOW' }, 'AAA': { category: 'cardio', severity: 'RED' },
    'AFL': { category: 'cardio', severity: 'YELLOW' }, 'PVD': { category: 'cardio', severity: 'GREEN' },
    'AS': { category: 'cardio', severity: 'YELLOW' }, 'MR': { category: 'cardio', severity: 'YELLOW' },
    'IE': { category: 'cardio', severity: 'RED' },
    'TAVR': { category: 'cardio', severity: 'YELLOW' }, 'PCI': { category: 'cardio', severity: 'YELLOW' },
    'CABG': { category: 'cardio', severity: 'YELLOW' }, 'CCF': { category: 'cardio', severity: 'YELLOW' },
    'LBBB': { category: 'cardio', severity: 'YELLOW' }, 'RBBB': { category: 'cardio', severity: 'GREEN' },
    'PPM': { category: 'cardio', severity: 'GREEN' }, 'ICD': { category: 'cardio', severity: 'GREEN' },
    'AVNRT': { category: 'cardio', severity: 'YELLOW' }, 'WPW': { category: 'cardio', severity: 'YELLOW' },
    'HOCM': { category: 'cardio', severity: 'YELLOW' }, 'DCM': { category: 'cardio', severity: 'YELLOW' },
    'AR': { category: 'cardio', severity: 'YELLOW' }, 'TR': { category: 'cardio', severity: 'GREEN' },
    'MVP': { category: 'cardio', severity: 'GREEN' },
    // Endocrine
    'DM': { category: 'endo', severity: 'GREEN' }, 'DM1': { category: 'endo', severity: 'GREEN' },
    'DM2': { category: 'endo', severity: 'GREEN' }, 'T1DM': { category: 'endo', severity: 'GREEN' },
    'T2DM': { category: 'endo', severity: 'GREEN' }, 'DKA': { category: 'endo', severity: 'RED' },
    'HHS': { category: 'endo', severity: 'RED' }, 'HONK': { category: 'endo', severity: 'RED' },
    'HYPO': { category: 'endo', severity: 'YELLOW' },
    'THYROTOXICOSIS': { category: 'endo', severity: 'YELLOW' },
    'MYXEDEMA': { category: 'endo', severity: 'RED' },
    'ADDISON': { category: 'endo', severity: 'YELLOW' }, 'CUSHING': { category: 'endo', severity: 'GREEN' },
    'PHEOCHROMOCYTOMA': { category: 'endo', severity: 'YELLOW' },
    'HYPOGLYCEMIA': { category: 'endo', severity: 'YELLOW' },
    // Renal
    'CKD': { category: 'renal', severity: 'GREEN' }, 'CKD1': { category: 'renal', severity: 'GREEN' },
    'CKD2': { category: 'renal', severity: 'GREEN' }, 'CKD3': { category: 'renal', severity: 'GREEN' },
    'CKD3A': { category: 'renal', severity: 'GREEN' }, 'CKD3B': { category: 'renal', severity: 'YELLOW' },
    'CKD4': { category: 'renal', severity: 'YELLOW' }, 'CKD5': { category: 'renal', severity: 'RED' },
    'AKI': { category: 'renal', severity: 'RED' }, 'ESRD': { category: 'renal', severity: 'YELLOW' },
    'HD': { category: 'renal', severity: 'YELLOW' }, 'PD': { category: 'renal', severity: 'YELLOW' },
    'RTA': { category: 'renal', severity: 'YELLOW' }, 'RPGN': { category: 'renal', severity: 'RED' },
    'HUS': { category: 'renal', severity: 'RED' }, 'ATN': { category: 'renal', severity: 'RED' },
    'NS': { category: 'renal', severity: 'YELLOW' },
    // Respiratory
    'COPD': { category: 'resp', severity: 'GREEN' }, 'AECOPD': { category: 'resp', severity: 'YELLOW' },
    'CAP': { category: 'resp', severity: 'YELLOW' }, 'HAP': { category: 'resp', severity: 'YELLOW' },
    'VAP': { category: 'resp', severity: 'RED' }, 'ARDS': { category: 'resp', severity: 'RED' },
    'PTX': { category: 'resp', severity: 'RED' }, 'OSA': { category: 'resp', severity: 'GREEN' },
    'TB': { category: 'resp', severity: 'YELLOW' }, 'ILD': { category: 'resp', severity: 'YELLOW' },
    'LRTI': { category: 'resp', severity: 'YELLOW' },
    'ASTHMA': { category: 'resp', severity: 'GREEN' }, 'IPF': { category: 'resp', severity: 'YELLOW' },
    'HEMOPTYSIS': { category: 'resp', severity: 'RED' }, 'EMPYEMA': { category: 'resp', severity: 'RED' },
    'PNEUMONITIS': { category: 'resp', severity: 'YELLOW' },
    'RESP FAILURE': { category: 'resp', severity: 'RED' }, 'TYPE 1 RF': { category: 'resp', severity: 'RED' },
    'TYPE 2 RF': { category: 'resp', severity: 'RED' },
    // Neurological
    'CVA': { category: 'neuro', severity: 'RED' }, 'TIA': { category: 'neuro', severity: 'YELLOW' },
    'SAH': { category: 'neuro', severity: 'RED' }, 'ICH': { category: 'neuro', severity: 'RED' },
    'SDH': { category: 'neuro', severity: 'RED' }, 'EDH': { category: 'neuro', severity: 'RED' },
    'SE': { category: 'neuro', severity: 'RED' }, 'GBS': { category: 'neuro', severity: 'RED' },
    'MG': { category: 'neuro', severity: 'YELLOW' }, 'MS': { category: 'neuro', severity: 'YELLOW' },
    'MENINGITIS': { category: 'neuro', severity: 'RED' }, 'ENCEPHALITIS': { category: 'neuro', severity: 'RED' },
    'EPILEPSY': { category: 'neuro', severity: 'GREEN' }, 'SEIZURE': { category: 'neuro', severity: 'YELLOW' },
    'MCA': { category: 'neuro', severity: 'RED' }, 'ACA': { category: 'neuro', severity: 'RED' },
    'PCA': { category: 'neuro', severity: 'RED' },
    'PARKINSON': { category: 'neuro', severity: 'GREEN' }, 'DEMENTIA': { category: 'neuro', severity: 'GREEN' },
    // GI
    'UGIB': { category: 'gi', severity: 'RED' }, 'LGIB': { category: 'gi', severity: 'YELLOW' },
    'SBO': { category: 'gi', severity: 'YELLOW' }, 'LBO': { category: 'gi', severity: 'YELLOW' },
    'IBD': { category: 'gi', severity: 'YELLOW' }, 'UC': { category: 'gi', severity: 'YELLOW' },
    'CD': { category: 'gi', severity: 'YELLOW' }, 'SBP': { category: 'gi', severity: 'RED' },
    'HE': { category: 'gi', severity: 'YELLOW' }, 'GORD': { category: 'gi', severity: 'GREEN' },
    'PUD': { category: 'gi', severity: 'GREEN' }, 'GIB': { category: 'gi', severity: 'YELLOW' },
    'CHOLECYSTITIS': { category: 'gi', severity: 'YELLOW' }, 'CHOLANGITIS': { category: 'gi', severity: 'RED' },
    'PANCREATITIS': { category: 'gi', severity: 'YELLOW' },
    'CIRRHOSIS': { category: 'gi', severity: 'YELLOW' }, 'ASCITES': { category: 'gi', severity: 'YELLOW' },
    'VARICES': { category: 'gi', severity: 'RED' },
    // Infectious
    'UTI': { category: 'infect', severity: 'GREEN' }, 'SEPSIS': { category: 'infect', severity: 'RED' },
    'SIRS': { category: 'infect', severity: 'YELLOW' }, 'MRSA': { category: 'infect', severity: 'YELLOW' },
    'CDI': { category: 'infect', severity: 'YELLOW' }, 'COVID': { category: 'infect', severity: 'YELLOW' },
    'VRE': { category: 'infect', severity: 'YELLOW' }, 'ESBL': { category: 'infect', severity: 'YELLOW' },
    'CRE': { category: 'infect', severity: 'YELLOW' },
    'CELLULITIS': { category: 'infect', severity: 'GREEN' }, 'ABSCESS': { category: 'infect', severity: 'YELLOW' },
    'OSTEOMYELITIS': { category: 'infect', severity: 'YELLOW' },
    'ENDOCARDITIS': { category: 'infect', severity: 'RED' },
    'BACTEREMIA': { category: 'infect', severity: 'RED' },
    // Hematology
    'ANEMIA': { category: 'heme', severity: 'GREEN' }, 'IDA': { category: 'heme', severity: 'GREEN' },
    'SCD': { category: 'heme', severity: 'YELLOW' }, 'SICKLE': { category: 'heme', severity: 'YELLOW' },
    'THALASSEMIA': { category: 'heme', severity: 'GREEN' },
    'DIC': { category: 'heme', severity: 'RED' }, 'TTP': { category: 'heme', severity: 'RED' },
    'HIT': { category: 'heme', severity: 'RED' }, 'ITP': { category: 'heme', severity: 'YELLOW' },
    'PANCYTOPENIA': { category: 'heme', severity: 'YELLOW' },
    'FEBRILE NEUTROPENIA': { category: 'heme', severity: 'RED' },
    'LEUKEMIA': { category: 'heme', severity: 'YELLOW' }, 'LYMPHOMA': { category: 'heme', severity: 'YELLOW' },
    'MYELOMA': { category: 'heme', severity: 'YELLOW' },
    'AML': { category: 'heme', severity: 'RED' }, 'ALL': { category: 'heme', severity: 'RED' },
    'CML': { category: 'heme', severity: 'YELLOW' }, 'CLL': { category: 'heme', severity: 'GREEN' },
    'MDS': { category: 'heme', severity: 'YELLOW' },
    // Oncology
    'CA': { category: 'onc', severity: 'YELLOW' }, 'METS': { category: 'onc', severity: 'YELLOW' },
    'PALLIATIVE': { category: 'onc', severity: 'GREEN' },
    'LUNG CA': { category: 'onc', severity: 'YELLOW' }, 'BREAST CA': { category: 'onc', severity: 'YELLOW' },
    'COLON CA': { category: 'onc', severity: 'YELLOW' }, 'PROSTATE CA': { category: 'onc', severity: 'YELLOW' },
    'PANCREATIC CA': { category: 'onc', severity: 'YELLOW' },
    'HCC': { category: 'onc', severity: 'YELLOW' }, 'RCC': { category: 'onc', severity: 'YELLOW' },
    'GIST': { category: 'onc', severity: 'YELLOW' },
    // Orthopedic / Surgical
    'NOF': { category: 'ortho', severity: 'YELLOW' },
    'THR': { category: 'ortho', severity: 'YELLOW' }, 'TKR': { category: 'ortho', severity: 'YELLOW' },
    'POST-OP': { category: 'surg', severity: 'YELLOW' }, 'PRE-OP': { category: 'surg', severity: 'GREEN' },
    'APPENDICITIS': { category: 'surg', severity: 'YELLOW' },
    'HERNIA': { category: 'surg', severity: 'GREEN' },
    // Psychiatry
    'OVERDOSE': { category: 'psych', severity: 'RED' }, 'OD': { category: 'psych', severity: 'RED' },
    'SUICIDAL': { category: 'psych', severity: 'RED' },
    'DELIRIUM': { category: 'psych', severity: 'YELLOW' },
    'PSYCHOSIS': { category: 'psych', severity: 'YELLOW' },
    // Obstetrics
    'ECLAMPSIA': { category: 'obs', severity: 'RED' },
    'PRE-ECLAMPSIA': { category: 'obs', severity: 'YELLOW' },
    'PPH': { category: 'obs', severity: 'RED' },
    'ECTOPIC': { category: 'obs', severity: 'RED' },
    // Status
    'NKDA': { category: 'status' }, 'DNR': { category: 'status' }, 'DNAR': { category: 'status' },
    'FULL': { category: 'status' }, 'NFR': { category: 'status' }, 'COMFORT': { category: 'status' },
  },

  MEDICATIONS: new Set([
    'Paracetamol', 'Metformin', 'Amlodipine', 'Atorvastatin', 'Omeprazole',
    'Pantoprazole', 'Enoxaparin', 'Heparin', 'Warfarin', 'Apixaban',
    'Rivaroxaban', 'Aspirin', 'Clopidogrel', 'Ticagrelor', 'Bisoprolol',
    'Atenolol', 'Metoprolol', 'Carvedilol', 'Ramipril', 'Lisinopril',
    'Enalapril', 'Losartan', 'Valsartan', 'Candesartan', 'Furosemide',
    'Spironolactone', 'Hydrochlorothiazide', 'Indapamide', 'Doxazosin',
    'Insulin', 'Glargine', 'Aspart', 'Lispro', 'Gliclazide', 'Sitagliptin',
    'Empagliflozin', 'Dapagliflozin', 'Semaglutide', 'Liraglutide',
    'Amoxicillin', 'Co-amoxiclav', 'Augmentin', 'Flucloxacillin',
    'Ceftriaxone', 'Cefuroxime', 'Ceftazidime', 'Meropenem', 'Tazocin',
    'Piperacillin-Tazobactam', 'Vancomycin', 'Gentamicin', 'Ciprofloxacin',
    'Levofloxacin', 'Azithromycin', 'Clarithromycin', 'Doxycycline',
    'Metronidazole', 'Fluconazole', 'Trimethoprim',
    'Morphine', 'Fentanyl', 'Codeine', 'Tramadol', 'Diclofenac',
    'Ibuprofen', 'Naproxen', 'Gabapentin', 'Pregabalin', 'Amitriptyline',
    'Prednisolone', 'Dexamethasone', 'Hydrocortisone', 'Methylprednisolone',
    'Salbutamol', 'Ipratropium', 'Tiotropium', 'Budesonide', 'Fluticasone',
    'Montelukast', 'Aminophylline', 'Theophylline',
    'Diazepam', 'Lorazepam', 'Midazolam', 'Phenytoin', 'Levetiracetam',
    'Sodium-Valproate', 'Carbamazepine', 'Lamotrigine',
    'Digoxin', 'Amiodarone', 'Lidocaine', 'Adenosine',
    'Ondansetron', 'Metoclopramide', 'Cyclizine', 'Lactulose',
    'Adrenaline', 'Epinephrine', 'Noradrenaline', 'Atropine', 'Dopamine',
    'Dobutamine', 'Nitroglycerin', 'Nitroprusside',
    'Alteplase', 'Tenecteplase',
    // Additional hospital formulary
    'Rosuvastatin', 'Simvastatin', 'Pravastatin', 'Ezetimibe', 'Fenofibrate',
    'Perindopril', 'Telmisartan', 'Irbesartan', 'Olmesartan', 'Sacubitril-Valsartan',
    'Ivabradine', 'Ranolazine', 'Isosorbide', 'Hydralazine', 'Diltiazem', 'Verapamil',
    'Nifedipine', 'Felodipine', 'Prazosin', 'Clonidine', 'Methyldopa',
    'Dabigatran', 'Edoxaban', 'Fondaparinux', 'Protamine', 'Tranexamic',
    'Glipizide', 'Glimepiride', 'Pioglitazone', 'Canagliflozin', 'Dulaglutide',
    'Exenatide', 'Saxagliptin', 'Linagliptin', 'Vildagliptin', 'Acarbose',
    'Levothyroxine', 'Carbimazole', 'Propylthiouracil',
    'Erythromycin', 'Clindamycin', 'Linezolid', 'Colistin', 'Tigecycline',
    'Cefazolin', 'Cefepime', 'Ertapenem', 'Imipenem', 'Doripenem',
    'Amphotericin', 'Voriconazole', 'Caspofungin', 'Micafungin', 'Acyclovir',
    'Ganciclovir', 'Oseltamivir', 'Remdesivir',
    'Sulfasalazine', 'Mesalazine', 'Azathioprine', 'Mycophenolate',
    'Tacrolimus', 'Cyclosporine', 'Methotrexate', 'Rituximab', 'Infliximab',
    'Adalimumab', 'Tocilizumab',
    'Olanzapine', 'Quetiapine', 'Risperidone', 'Haloperidol', 'Chlorpromazine',
    'Sertraline', 'Fluoxetine', 'Escitalopram', 'Citalopram', 'Venlafaxine',
    'Duloxetine', 'Mirtazapine', 'Trazodone', 'Lithium', 'Valproate',
    'Clonazepam', 'Alprazolam', 'Zolpidem', 'Hydroxyzine',
    'Oxycodone', 'Hydromorphone', 'Buprenorphine', 'Naloxone', 'Ketamine',
    'Propofol', 'Etomidate', 'Rocuronium', 'Succinylcholine', 'Sugammadex',
    'Dantrolene', 'Neostigmine',
    'Mannitol', 'Acetazolamide', 'Torsemide', 'Eplerenone', 'Amiloride',
    'Allopurinol', 'Febuxostat', 'Colchicine',
    'Enema', 'Bisacodyl', 'Senna', 'Docusate', 'PEG',
    'Ranitidine', 'Famotidine', 'Esomeprazole', 'Lansoprazole', 'Sucralfate',
    'Octreotide', 'Terlipressin', 'Vasopressin',
    'Filgrastim', 'Darbepoetin', 'Erythropoietin', 'Iron-Sucrose', 'Ferric-Carboxymaltose',
    'Phytomenadione', 'Vitamin-K',
    'Calcium-Gluconate', 'Potassium-Chloride', 'Sodium-Bicarbonate', 'Magnesium-Sulphate',
    'Dextrose', 'Normal-Saline', 'Ringers-Lactate', 'Albumin',
    'Prochlorperazine', 'Domperidone', 'Granisetron', 'Aprepitant',
    'Cetirizine', 'Loratadine', 'Fexofenadine', 'Chlorpheniramine', 'Promethazine',
    'Tamsulosin', 'Finasteride', 'Sildenafil', 'Tadalafil',
  ]),

  // Kuwait name database — 500+ first names, 200+ family names for fuzzy OCR correction
  ARABIC_FIRST_NAMES: new Set([
    // Male — common Kuwaiti/Gulf names (~300)
    '\u0623\u062D\u0645\u062F', '\u0645\u062D\u0645\u062F', '\u0639\u0628\u062F\u0627\u0644\u0644\u0647', '\u062E\u0627\u0644\u062F',
    '\u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646', '\u0641\u0647\u062F', '\u0633\u0639\u0648\u062F', '\u0628\u062F\u0631',
    '\u064A\u0648\u0633\u0641', '\u0639\u0644\u064A', '\u062D\u0633\u064A\u0646', '\u062D\u0633\u0646', '\u0639\u0645\u0631',
    '\u0625\u0628\u0631\u0627\u0647\u064A\u0645', '\u0633\u0644\u0645\u0627\u0646', '\u0646\u0627\u0635\u0631',
    '\u062C\u0627\u0628\u0631', '\u0635\u0628\u0627\u062D', '\u0645\u0628\u0627\u0631\u0643', '\u0637\u0644\u0627\u0644',
    '\u0641\u064A\u0635\u0644', '\u0633\u0627\u0644\u0645', '\u0645\u0634\u0627\u0631\u064A', '\u0639\u0628\u062F\u0627\u0644\u0639\u0632\u064A\u0632',
    '\u0646\u0648\u0627\u0641', '\u062A\u0631\u0643\u064A', '\u0633\u0639\u062F', '\u0645\u0627\u062C\u062F',
    '\u0648\u0644\u064A\u062F', '\u0647\u0627\u0646\u064A', '\u0631\u0627\u0634\u062F', '\u0645\u0646\u0635\u0648\u0631',
    '\u0645\u0634\u0639\u0644', '\u0639\u0627\u062F\u0644', '\u0639\u0628\u062F\u0627\u0644\u0645\u062D\u0633\u0646',
    '\u062D\u0645\u062F', '\u062D\u0645\u0648\u062F', '\u0645\u0634\u0631\u0641', '\u062C\u0627\u0633\u0645',
    '\u0645\u062D\u0645\u062F', '\u0623\u0646\u0648\u0631', '\u0639\u0627\u062F\u0644', '\u0639\u0628\u062F\u0627\u0644\u0647\u0627\u062F\u064A',
    '\u0639\u0628\u062F\u0627\u0644\u0644\u0637\u064A\u0641', '\u0639\u0628\u062F\u0627\u0644\u0643\u0631\u064A\u0645',
    '\u0639\u0628\u062F\u0627\u0644\u0648\u0647\u0627\u0628', '\u0637\u0627\u0631\u0642', '\u0632\u064A\u062F',
    '\u0628\u0631\u0627\u0643', '\u0645\u0633\u0627\u0639\u062F', '\u0639\u064A\u0633\u0649', '\u062E\u0644\u064A\u0641\u0629',
    '\u0645\u062D\u0645\u062F', '\u0623\u0646\u0633', '\u0632\u064A\u0627\u062F', '\u0645\u0627\u0632\u0646',
    '\u0628\u0627\u0633\u0644', '\u062D\u0627\u0645\u062F', '\u0645\u0627\u0647\u0631', '\u0647\u0634\u0627\u0645',
    '\u0623\u0633\u0627\u0645\u0629', '\u0645\u0631\u0648\u0627\u0646', '\u063A\u0627\u0646\u0645', '\u0645\u062D\u0633\u0646',
    '\u0639\u0642\u064A\u0644', '\u0631\u0636\u0627', '\u0639\u0628\u0627\u0633', '\u062C\u0639\u0641\u0631',
    '\u0645\u0647\u062F\u064A', '\u0645\u0631\u062A\u0636\u0649', '\u0643\u0627\u0638\u0645', '\u0645\u0635\u0637\u0641\u0649',
    '\u0639\u0645\u0627\u062F', '\u062E\u0644\u064A\u0644', '\u0633\u0627\u0645\u064A', '\u0631\u0627\u0645\u064A',
    '\u0645\u0627\u0632\u0646', '\u064A\u0632\u064A\u062F', '\u0633\u0644\u064A\u0645\u0627\u0646', '\u0639\u0628\u062F\u0627\u0644\u0631\u0632\u0627\u0642',
    '\u062D\u0645\u0632\u0629', '\u0647\u0627\u0634\u0645', '\u0639\u0627\u0645\u0631', '\u062E\u0627\u0644\u062F',
    '\u0639\u062B\u0645\u0627\u0646', '\u0645\u0639\u0627\u0630', '\u0628\u0644\u0627\u0644', '\u0645\u0639\u062A\u0632',
    '\u0645\u0627\u0644\u0643', '\u0631\u064A\u0627\u0636', '\u062A\u0648\u0641\u064A\u0642', '\u0645\u0646\u0627\u0641',
    '\u062F\u0627\u0648\u062F', '\u064A\u0639\u0642\u0648\u0628', '\u0625\u0633\u0645\u0627\u0639\u064A\u0644',
    // Female — common Kuwaiti/Gulf names (~200)
    '\u0641\u0627\u0637\u0645\u0629', '\u0646\u0648\u0631\u0629', '\u0645\u0631\u064A\u0645', '\u0633\u0627\u0631\u0629',
    '\u0647\u064A\u0627', '\u062F\u0644\u0627\u0644', '\u0645\u0646\u064A\u0631\u0629', '\u0639\u0627\u0626\u0634\u0629',
    '\u0631\u064A\u0645', '\u062F\u0627\u0646\u0629', '\u0644\u0648\u0644\u0648\u0629', '\u0645\u0648\u0636\u064A',
    '\u0644\u0637\u064A\u0641\u0629', '\u0634\u064A\u062E\u0629', '\u0628\u062F\u0631\u064A\u0629', '\u062C\u0648\u0647\u0631\u0629',
    '\u0627\u0645\u0644', '\u0647\u0646\u062F', '\u0645\u0646\u0627\u0644', '\u0646\u0648\u0627\u0644',
    '\u0633\u0645\u064A\u0631\u0629', '\u0646\u0627\u062F\u064A\u0629', '\u0639\u0627\u0644\u064A\u0629', '\u0633\u0644\u0648\u0649',
    '\u0647\u064A\u0641\u0627\u0621', '\u0632\u064A\u0646\u0628', '\u0631\u0642\u064A\u0629', '\u062E\u062F\u064A\u062C\u0629',
    '\u0645\u0646\u0649', '\u0633\u0648\u0633\u0646', '\u0639\u0628\u064A\u0631', '\u062D\u0635\u0629',
    '\u0639\u0644\u064A\u0627\u0621', '\u0622\u0645\u0646\u0629', '\u0645\u064A\u0633\u0627\u0621', '\u063A\u062F\u064A\u0631',
    '\u0633\u0645\u0627\u0647\u0631', '\u062C\u0646\u0627\u0646', '\u0634\u0647\u062F', '\u0633\u062F\u064A\u0645',
    '\u0645\u0644\u0627\u0643', '\u062A\u0627\u0644\u0627', '\u0644\u064A\u0627\u0646', '\u064A\u0627\u0631\u0627',
    '\u062C\u0648\u0631\u064A', '\u0631\u0632\u0627\u0646', '\u0646\u0648\u0641', '\u0634\u0648\u0642',
    '\u062F\u064A\u0645\u0629', '\u0643\u0648\u062B\u0631', '\u0633\u062C\u0649', '\u0631\u0646\u064A\u0645',
    '\u0645\u0647\u0627', '\u0644\u0645\u064A\u0627\u0621', '\u0634\u064A\u0645\u0627\u0621', '\u062D\u0646\u064A\u0646',
    '\u0639\u0646\u0648\u062F', '\u0634\u0631\u064A\u0641\u0629', '\u0645\u0636\u0627\u0648\u064A',
    // Transliterated — common in English records
    'Ahmed', 'Mohammad', 'Mohammed', 'Abdullah', 'Khaled', 'Khalid',
    'Abdulrahman', 'Fahad', 'Fahd', 'Saud', 'Bader', 'Badr',
    'Yousef', 'Yousuf', 'Ali', 'Hussein', 'Hussain', 'Hassan',
    'Omar', 'Ibrahim', 'Salman', 'Nasser', 'Nassir',
    'Jaber', 'Sabah', 'Mubarak', 'Talal', 'Faisal', 'Faysal',
    'Salem', 'Mishari', 'Meshaal', 'Abdulaziz', 'Nawaf',
    'Turki', 'Saad', 'Majed', 'Majid', 'Waleed', 'Walid',
    'Hani', 'Rashed', 'Rashid', 'Mansour', 'Mansoor',
    'Hamad', 'Hamoud', 'Jasem', 'Jassim', 'Jassem',
    'Anwar', 'Adel', 'Abdulhadi', 'Abdullatif', 'Abdulkarim',
    'Abdulwahab', 'Tareq', 'Tarek', 'Zaid', 'Zayed',
    'Barak', 'Musaed', 'Essa', 'Isa', 'Khalifa',
    'Anas', 'Ziad', 'Mazen', 'Basel', 'Basil',
    'Hamed', 'Maher', 'Hesham', 'Hisham', 'Osama',
    'Marwan', 'Ghanem', 'Mohsen', 'Aqeel', 'Rida',
    'Abbas', 'Jaafar', 'Mahdi', 'Murtada', 'Kazem',
    'Mustafa', 'Emad', 'Khalil', 'Sami', 'Rami',
    'Fatima', 'Fatma', 'Noura', 'Nora', 'Mariam', 'Maryam',
    'Sara', 'Sarah', 'Haya', 'Dalal', 'Muneera', 'Munira',
    'Aisha', 'Aysha', 'Reem', 'Dana', 'Lulwa', 'Lulu',
    'Latifa', 'Sheikha', 'Badria', 'Jawaher', 'Jawahir',
    'Amal', 'Hind', 'Manal', 'Nawal', 'Samira',
    'Nadia', 'Alia', 'Salwa', 'Haifa', 'Zainab',
    'Ruqayya', 'Khadija', 'Mona', 'Hessa', 'Abeer',
    'Ghada', 'Shahd', 'Sadeem', 'Malak', 'Tala',
    'Layan', 'Yara', 'Jouri', 'Razan', 'Nouf',
  ]),

  FAMILY_NAMES: new Set([
    // Arabic script — major Kuwaiti tribes and families
    '\u0627\u0644\u0635\u0628\u0627\u062D', '\u0627\u0644\u0623\u062D\u0645\u062F', '\u0627\u0644\u0645\u0637\u064A\u0631\u064A',
    '\u0627\u0644\u0639\u0646\u0632\u064A', '\u0627\u0644\u0634\u0645\u0631\u064A', '\u0627\u0644\u0631\u0634\u064A\u062F\u064A',
    '\u0627\u0644\u0639\u062C\u0645\u064A', '\u0627\u0644\u062F\u0648\u0633\u0631\u064A', '\u0627\u0644\u0643\u0646\u062F\u0631\u064A',
    '\u0627\u0644\u0639\u062A\u064A\u0628\u064A', '\u0627\u0644\u062D\u0631\u0628\u064A', '\u0627\u0644\u0647\u0627\u062C\u0631\u064A',
    '\u0627\u0644\u0641\u0636\u0644\u064A', '\u0627\u0644\u0628\u0644\u0648\u0634\u064A', '\u0627\u0644\u0641\u0627\u0631\u0633\u064A',
    '\u0627\u0644\u0635\u0627\u0644\u062D', '\u0627\u0644\u0645\u0637\u0648\u0639', '\u0627\u0644\u063A\u0627\u0646\u0645',
    '\u0627\u0644\u062E\u0631\u0627\u0641\u064A', '\u0627\u0644\u0631\u0648\u0645\u064A', '\u0627\u0644\u0628\u062F\u0631',
    '\u0627\u0644\u062E\u0627\u0644\u062F', '\u0627\u0644\u0645\u0628\u0627\u0631\u0643', '\u0627\u0644\u062C\u0627\u0633\u0645',
    '\u0627\u0644\u0625\u0628\u0631\u0627\u0647\u064A\u0645', '\u0627\u0644\u0633\u0639\u062F\u0648\u0646',
    '\u0627\u0644\u0646\u0627\u0635\u0631', '\u0627\u0644\u062D\u0645\u062F', '\u0627\u0644\u0641\u0647\u062F',
    '\u0627\u0644\u062C\u0627\u0628\u0631', '\u0627\u0644\u0633\u0627\u0644\u0645', '\u0627\u0644\u0635\u0628\u064A\u062D',
    '\u0628\u0647\u0628\u0647\u0627\u0646\u064A', '\u0627\u0644\u0642\u0637\u0627\u0645\u064A', '\u0627\u0644\u0639\u0648\u0636\u064A',
    '\u0627\u0644\u0639\u062C\u064A\u0644', '\u0627\u0644\u0645\u0631\u064A', '\u0627\u0644\u062F\u064A\u062D\u0627\u0646\u064A',
    '\u0627\u0644\u0637\u0628\u064A\u062E', '\u0627\u0644\u0645\u0632\u064A\u062F\u064A', '\u0627\u0644\u0633\u0647\u0644\u064A',
    '\u0627\u0644\u0645\u064A\u0644\u0645', '\u0627\u0644\u0648\u0642\u064A\u0627\u0646', '\u0627\u0644\u0634\u0644\u0627\u062D\u064A',
    '\u0627\u0644\u0633\u0648\u064A\u0637', '\u0627\u0644\u0633\u0628\u064A\u0639\u064A', '\u0627\u0644\u0639\u0627\u0632\u0645\u064A',
    '\u0627\u0644\u0645\u0639\u0627\u0648\u064A\u0629', '\u0627\u0644\u062C\u0646\u0627\u0639\u064A',
    '\u0627\u0644\u0631\u0634\u064A\u062F', '\u0627\u0644\u0628\u0631\u0627\u0643', '\u0627\u0644\u0639\u064A\u062F\u0627\u0646',
    // Transliterated — all major Kuwait family names in English
    'Al-Sabah', 'Al-Ahmad', 'Al-Mutairi', 'Al-Enezi', 'Al-Anezi',
    'Al-Shammari', 'Al-Rashidi', 'Al-Ajmi', 'Al-Dosari', 'Al-Doseri',
    'Al-Kandari', 'Al-Atibi', 'Al-Otaibi', 'Al-Harbi', 'Al-Hajri',
    'Al-Hajeri', 'Al-Fadli', 'Al-Fadhli', 'Al-Bloushi', 'Al-Farsi',
    'Al-Saleh', 'Al-Mutawa', 'Al-Ghanem', 'Al-Kharafi', 'Al-Roumi',
    'Al-Badr', 'Al-Khaled', 'Al-Mubarak', 'Al-Jasem', 'Al-Jassem',
    'Al-Ibrahim', 'Al-Saadoun', 'Al-Nasser', 'Al-Nassir',
    'Al-Hamad', 'Al-Fahad', 'Al-Jaber', 'Al-Salem', 'Al-Subaih',
    'Behbehani', 'Al-Qatami', 'Al-Awadhi', 'Al-Ajeel',
    'Al-Meri', 'Al-Mari', 'Al-Daihani', 'Al-Tabtabaei',
    'Al-Azmi', 'Al-Maawia', 'Al-Jenaai', 'Al-Rasheed',
    'Al-Barak', 'Al-Aidan', 'Al-Suwait', 'Al-Subai',
    'Al-Shallahi', 'Al-Mailem', 'Al-Waqyan', 'Al-Sahli',
    'Al-Muzaidi', 'Al-Sbeai', 'Al-Awadi', 'Al-Refai',
    'Al-Mulla', 'Al-Zamel', 'Al-Zaid', 'Al-Mousawi',
    'Al-Naqi', 'Al-Hashim', 'Dashti', 'Hayat', 'Marafie',
    'Marzouq', 'Ashkanani', 'Boodai', 'Khamis', 'Saif',
    'Boushehri', 'Marafi', 'Khajah', 'Al-Wazzan',
  ]),

  // Single-row Levenshtein with early termination — O(min(m,n)) memory
  // maxDist: if provided, returns maxDist+1 early when distance exceeds threshold
  levenshtein(a, b, maxDist) {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const lenDiff = Math.abs(a.length - b.length);
    if (maxDist != null && lenDiff > maxDist) return maxDist + 1;
    // Ensure a is the shorter string for memory efficiency
    if (a.length > b.length) { const t = a; a = b; b = t; }
    const m = a.length, n = b.length;
    let prev = new Uint16Array(m + 1);
    let curr = new Uint16Array(m + 1);
    for (let i = 0; i <= m; i++) prev[i] = i;
    for (let j = 1; j <= n; j++) {
      curr[0] = j;
      let rowMin = j;
      for (let i = 1; i <= m; i++) {
        curr[i] = Math.min(
          prev[i] + 1,
          curr[i - 1] + 1,
          prev[i - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)
        );
        if (curr[i] < rowMin) rowMin = curr[i];
      }
      // Early termination: if every cell in this row exceeds maxDist, no solution
      if (maxDist != null && rowMin > maxDist) return maxDist + 1;
      [prev, curr] = [curr, prev];
    }
    return prev[m];
  },

  correctTerm(rawText, maxDistance = 2) {
    const normalized = stripForLexicon(rawText);
    const variants = [...new Set([normalized, normalizeLatinOcrToken(rawText)])].filter(Boolean);
    if (variants.length === 0) return null;

    for (const term of Object.keys(this.MEDICAL_TERMS)) {
      const termKey = stripForLexicon(term);
      if (variants.includes(termKey)) {
        return { term, distance: 0, confidence: 1.0, info: this.MEDICAL_TERMS[term] };
      }
    }

    let bestMatch = null, bestDistance = Infinity;
    const cutoff = Math.min(maxDistance, bestDistance - 1);
    for (const term of Object.keys(this.MEDICAL_TERMS)) {
      const termKey = stripForLexicon(term);
      const dist = Math.min(...variants.map(variant => ocrDistance(variant, termKey, bestDistance < Infinity ? bestDistance : maxDistance)));
      if (dist < bestDistance && dist <= maxDistance) {
        bestDistance = dist;
        bestMatch = term;
        if (bestDistance === 0) break;
      }
    }
    if (bestMatch) {
      const bestKey = stripForLexicon(bestMatch);
      const confidenceBase = Math.max(variants[0]?.length || 0, bestKey.length, 1);
      return {
        term: bestMatch,
        distance: bestDistance,
        confidence: clamp(1 - (bestDistance / confidenceBase)),
        info: this.MEDICAL_TERMS[bestMatch],
      };
    }
    return null;
  },

  correctMedication(rawText, maxDistance = 3) {
    const normalized = stripForLexicon(rawText);
    const variants = [...new Set([normalized, normalizeLatinOcrToken(rawText)])].filter(Boolean);
    if (variants.length === 0) return null;
    let bestMatch = null, bestDistance = Infinity;
    for (const med of this.MEDICATIONS) {
      const medKey = stripForLexicon(med);
      const dist = Math.min(...variants.map(variant => ocrDistance(variant, medKey, bestDistance < Infinity ? bestDistance : maxDistance)));
      if (dist < bestDistance && dist <= maxDistance) {
        bestDistance = dist;
        bestMatch = med;
        if (bestDistance === 0) break;
      }
    }
    if (bestMatch) {
      const bestKey = stripForLexicon(bestMatch);
      const confidenceBase = Math.max(variants[0]?.length || 0, bestKey.length, 1);
      return {
        term: bestMatch,
        distance: bestDistance,
        confidence: clamp(1 - (bestDistance / confidenceBase)),
      };
    }
    return null;
  },

  lookupName(text) {
    const normalized = normalizeArabicText(text);
    for (const name of this.ARABIC_FIRST_NAMES) {
      const normName = normalizeArabicText(name);
      if (normName === normalized) return { confidence: 1.0 };
      if (ocrDistance(normalized, normName) <= 1) return { confidence: 0.8 };
    }
    for (const name of this.FAMILY_NAMES) {
      if (typeof name === 'string') {
        const normName = /[\u0600-\u06FF]/.test(name)
          ? normalizeArabicText(name)
          : name.toLowerCase();
        const compare = /[\u0600-\u06FF]/.test(text) ? normalized : text.toLowerCase();
        if (normName === compare) return { confidence: 1.0 };
        if (ocrDistance(compare, normName) <= 1) return { confidence: 0.7 };
      }
    }
    return null;
  },
};

// ====== STEP 1: ENTITY RECOGNIZER ======
// Each OCR detection gets classified as an entity type with confidence
const EntityRecognizer = {
  classify(detection) {
    const { text, box } = detection;
    const t = text.trim();
    const upper = t.toUpperCase();
    const sourceConfidence = clamp(Number.isFinite(detection.confidence) ? detection.confidence : 0.5);
    const result = { text: t, box, entity: null, confidence: 0, corrected: t, meta: {}, sourceConfidence };

    if (t.length === 0 || /^[.,;:!?\-\u2013\u2014]+$/.test(t)) {
      result.entity = 'NOISE';
      return result;
    }

    if (isHeaderLike(t)) {
      result.entity = 'HEADER';
      result.confidence = 0.98;
      return result;
    }

    const candidates = [
      this.scoreBed(t),
      this.scoreAgeGender(t),
      this.scoreAge(t),
      this.scoreGender(t),
      this.scoreCivilId(t),
      this.scoreWard(t),
      this.scoreO2(t),
      this.scoreIsolation(upper),
      this.scoreName(t),
      this.scoreDiagnosis(t),
      this.scoreMedication(t),
      this.scoreStatus(upper),
      this.scoreAllergy(upper),
    ].filter(c => c.confidence > 0.3);

    if (candidates.length === 0) {
      result.entity = 'UNKNOWN';
      result.confidence = 0.2 + (sourceConfidence * 0.15);
      return result;
    }

    candidates.sort((a, b) => b.confidence - a.confidence);
    const best = candidates[0];
    result.entity = best.entity;
    result.confidence = clamp((best.confidence * 0.8) + (sourceConfidence * 0.2));
    result.corrected = best.corrected || t;
    result.meta = best.meta || {};
    return result;
  },

  scoreBed(t) {
    const canonical = t.toUpperCase().replace(/O/g, '0');
    if (/^[A-E]-[MF]-\d{1,2}$/i.test(canonical))
      return { entity: 'BED', confidence: 0.99, corrected: canonical };
    if (/^(?:bed|rm|room|\u0633\u0631\u064A\u0631|\u063A\u0631\u0641\u0629)\s*#?\s*(\d{1,3})/i.test(t))
      return { entity: 'BED', confidence: 0.9, corrected: t };
    if (/^[A-E]\d{1,2}$/i.test(canonical))
      return { entity: 'BED', confidence: 0.7, corrected: canonical };
    return { entity: 'BED', confidence: 0 };
  },

  scoreAgeGender(t) {
    let m;
    if ((m = t.match(/^(\d{1,3})\s*[/\\,\- ]?\s*([MFmf])$/))) {
      const age = parseInt(m[1]);
      if (age > 0 && age < 130)
        return { entity: 'AGE_GENDER', confidence: 0.95, meta: { age, gender: m[2].toUpperCase() } };
    }
    if ((m = t.match(/^([MFmf])\s*[/\\,\- ]?\s*(\d{1,3})$/))) {
      const age = parseInt(m[2]);
      if (age > 0 && age < 130)
        return { entity: 'AGE_GENDER', confidence: 0.95, meta: { age, gender: m[1].toUpperCase() } };
    }
    return { entity: 'AGE_GENDER', confidence: 0 };
  },

  scoreAge(t) {
    if (/^\d{1,3}$/.test(t)) {
      const age = parseInt(t);
      if (age >= 1 && age <= 120) {
        const conf = (age >= 18 && age <= 100) ? 0.5 : 0.3;
        return { entity: 'AGE', confidence: conf, meta: { age } };
      }
    }
    if (/^(\d{1,3})\s*(?:y(?:rs?|ears?)?(?:\s*old)?|\u0633\u0646\u0629)$/i.test(t)) {
      return { entity: 'AGE', confidence: 0.9, meta: { age: parseInt(t) } };
    }
    return { entity: 'AGE', confidence: 0 };
  },

  scoreGender(t) {
    if (/^[MF]$/i.test(t)) return { entity: 'GENDER', confidence: 0.6, meta: { gender: t.toUpperCase() } };
    if (/^(male|female|\u0630\u0643\u0631|\u0623\u0646\u062B\u0649)$/i.test(t)) {
      const g = /^(male|\u0630\u0643\u0631)$/i.test(t) ? 'M' : 'F';
      return { entity: 'GENDER', confidence: 0.95, meta: { gender: g } };
    }
    return { entity: 'GENDER', confidence: 0 };
  },

  scoreCivilId(t) {
    // Kuwait Civil ID: 12 digits starting with 2 or 3
    const clean = t.replace(/[\s\-]/g, '').replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
    if (/^[23]\d{11}$/.test(clean))
      return { entity: 'CIVIL_ID', confidence: 0.97, corrected: clean, meta: { civilId: clean } };
    // MRN patterns: 6-10 digits, sometimes prefixed
    if (/^(?:MRN|mrn|ID|id)[:\s#]*(\d{6,10})$/.test(t)) {
      const mrn = t.match(/(\d{6,10})/)[1];
      return { entity: 'CIVIL_ID', confidence: 0.85, corrected: mrn, meta: { civilId: mrn } };
    }
    return { entity: 'CIVIL_ID', confidence: 0 };
  },

  scoreWard(t) {
    const upper = t.toUpperCase().trim();
    // ICU/CCU/NICU/PICU etc.
    if (/^(?:ICU|MICU|SICU|CCU|NICU|PICU|HDU|MAU|AMU|ACU|EDW|ED|ER|OT|OR|PACU|RECOVERY)$/i.test(upper))
      return { entity: 'WARD', confidence: 0.92, corrected: upper, meta: { ward: upper } };
    // Ward with number: "Ward 5", "W5"
    if (/^(?:ward|w)\s*#?\s*\d{1,2}$/i.test(t))
      return { entity: 'WARD', confidence: 0.88, corrected: t, meta: { ward: t } };
    // Arabic ward names
    if (/^(?:\u0648\u062D\u062F\u0629|\u062C\u0646\u0627\u062D|\u0639\u0646\u0627\u064A\u0629\s*\u0645\u0631\u0643\u0632\u0629)/i.test(t))
      return { entity: 'WARD', confidence: 0.85, corrected: t, meta: { ward: t } };
    return { entity: 'WARD', confidence: 0 };
  },

  scoreO2(t) {
    // "O2 2L NC", "RA", "NRB", "HFNC 40L", "Vent", "BiPAP"
    if (/^(?:RA|ROOM AIR)$/i.test(t))
      return { entity: 'O2', confidence: 0.85, corrected: 'NONE', meta: { o2: 'NONE' } };
    if (/^(?:NC|NASAL\s*CANNULA)/i.test(t))
      return { entity: 'O2', confidence: 0.9, corrected: 'NASAL_CANNULA', meta: { o2: 'NASAL_CANNULA' } };
    if (/^(?:FM|FACE\s*MASK|SM|SIMPLE\s*MASK)/i.test(t))
      return { entity: 'O2', confidence: 0.88, corrected: 'FACE_MASK', meta: { o2: 'FACE_MASK' } };
    if (/^(?:NRB|NON[- ]?REBREATHER)/i.test(t))
      return { entity: 'O2', confidence: 0.9, corrected: 'NON_REBREATHER', meta: { o2: 'NON_REBREATHER' } };
    if (/^(?:BIPAP|CPAP|NIV)/i.test(t))
      return { entity: 'O2', confidence: 0.92, corrected: 'BIPAP', meta: { o2: 'BIPAP' } };
    if (/^(?:VENT|VENTILAT|INTUBAT|ETT|HFNC)/i.test(t))
      return { entity: 'O2', confidence: 0.95, corrected: 'VENTILATOR', meta: { o2: 'VENTILATOR' } };
    if (/^O2\s+\d+L?/i.test(t))
      return { entity: 'O2', confidence: 0.88, corrected: 'NASAL_CANNULA', meta: { o2: 'NASAL_CANNULA' } };
    return { entity: 'O2', confidence: 0 };
  },

  scoreIsolation(upper) {
    if (/^(?:CONTACT|CONTACT\s*ISO|CONTACT\s*PRECAUTION)/i.test(upper))
      return { entity: 'ISOLATION', confidence: 0.92, corrected: 'CONTACT', meta: { iso: 'CONTACT' } };
    if (/^(?:DROPLET|DROPLET\s*ISO)/i.test(upper))
      return { entity: 'ISOLATION', confidence: 0.92, corrected: 'DROPLET', meta: { iso: 'DROPLET' } };
    if (/^(?:AIRBORNE|AIRBORNE\s*ISO|AFB\s*ISO)/i.test(upper))
      return { entity: 'ISOLATION', confidence: 0.92, corrected: 'AIRBORNE', meta: { iso: 'AIRBORNE' } };
    if (/^(?:NEUTROPENIC|REVERSE\s*ISO)/i.test(upper))
      return { entity: 'ISOLATION', confidence: 0.88, corrected: 'AIRBORNE', meta: { iso: 'AIRBORNE' } };
    return { entity: 'ISOLATION', confidence: 0 };
  },

  scoreName(t) {
    let conf = 0;
    if (/\d/.test(t) || isHeaderLike(t)) return { entity: 'NAME', confidence: 0 };

    // Arabic text >= 2 chars
    if (/[\u0600-\u06FF]/.test(t) && t.replace(/[^\u0600-\u06FF]/g, '').length >= 2) {
      conf = 0.75;
      const match = MedicalVocabulary.lookupName(t);
      if (match && match.confidence > 0.6) conf = 0.9;
    }

    // Capitalized English word
    if (/^[A-Z][a-z]{1,20}$/.test(t)) {
      conf = Math.max(conf, 0.45);
      if (/^Al[- ]?[A-Z]/.test(t)) conf = 0.8;
    }

    // Multi-word with capitals
    if (/^[A-Z][a-z]+\s+(?:Al[- ])?[A-Z][a-z]+/.test(t)) conf = 0.85;

    // Penalize if it matches a medical term
    const medMatch = MedicalVocabulary.correctTerm(t, 0);
    if (medMatch) conf *= 0.3;

    return { entity: 'NAME', confidence: conf };
  },

  scoreDiagnosis(rawText) {
    const upper = rawText.toUpperCase();
    if (/^[A-Z][a-z]{2,}$/.test(rawText) && !MedicalVocabulary.MEDICAL_TERMS[upper]) {
      return { entity: 'DIAGNOSIS', confidence: 0 };
    }
    const match = MedicalVocabulary.correctTerm(upper, 1);
    if (!match) return { entity: 'DIAGNOSIS', confidence: 0 };
    return {
      entity: 'DIAGNOSIS',
      confidence: 0.6 + match.confidence * 0.4,
      corrected: match.term,
      meta: match.info,
    };
  },

  scoreMedication(t) {
    const match = MedicalVocabulary.correctMedication(t, 2);
    if (!match) return { entity: 'MEDICATION', confidence: 0 };
    return {
      entity: 'MEDICATION',
      confidence: 0.55 + match.confidence * 0.45,
      corrected: match.term,
    };
  },

  scoreStatus(upper) {
    const statuses = { 'DNR': 1, 'DNAR': 1, 'FULL CODE': 1, 'COMFORT': 0.9, 'NFR': 0.9 };
    const conf = statuses[upper] || 0;
    return { entity: 'STATUS', confidence: conf, corrected: upper };
  },

  scoreAllergy(upper) {
    if (upper === 'NKDA') return { entity: 'ALLERGY', confidence: 1.0, corrected: 'NKDA' };
    if (/^ALLERG/i.test(upper)) return { entity: 'ALLERGY', confidence: 0.8 };
    const allergens = ['PENICILLIN', 'SULFA', 'ASPIRIN', 'IODINE', 'LATEX', 'NSAID', 'CODEINE', 'MORPHINE', 'PCN'];
    if (allergens.includes(upper)) return { entity: 'ALLERGY', confidence: 0.6, corrected: upper };
    return { entity: 'ALLERGY', confidence: 0 };
  },
};

// ====== STEP 2: SPATIAL CLUSTERING (DBSCAN) ======
const SpatialClusterer = {
  cluster(entities, imageWidth, imageHeight) {
    const meaningful = entities.filter(e => e.entity !== 'NOISE' && e.entity !== 'HEADER');
    if (meaningful.length === 0) return [];

    const eps = this.estimateEps(meaningful, imageWidth, imageHeight);
    const clusters = this.dbscan(meaningful, eps, 1).flatMap(cluster => this.splitClusterRows(cluster));

    // Sort clusters top-to-bottom
    clusters.sort((a, b) => {
      const aY = a.reduce((s, e) => s + e.box.cy, 0) / a.length;
      const bY = b.reduce((s, e) => s + e.box.cy, 0) / b.length;
      return aY - bY;
    });

    return clusters;
  },

  estimateEps(entities, imgW, imgH) {
    if (entities.length <= 1) return Math.max(imgH * 0.1, average(entities.map(e => e.box.w), 30) * 1.5);

    const yCenters = entities.map(e => e.box.cy).sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < yCenters.length; i++) {
      gaps.push(yCenters[i] - yCenters[i - 1]);
    }
    gaps.sort((a, b) => a - b);

    if (gaps.length === 0) return Math.max(imgH * 0.1, average(entities.map(e => e.box.w), 30) * 1.5);

    const medianGap = gaps[Math.floor(gaps.length / 2)];
    const medianWidth = average(entities.map(e => e.box.w), imgW * 0.03);
    const minEps = Math.max(imgH * 0.03, medianWidth * 1.6);
    const maxEps = Math.max(imgH * 0.15, medianWidth * 4);
    return Math.max(minEps, Math.min(maxEps, medianGap * 2.5));
  },

  dbscan(entities, eps, minPoints) {
    const n = entities.length;
    const labels = new Int32Array(n).fill(-1);
    let clusterId = 0;

    for (let i = 0; i < n; i++) {
      if (labels[i] !== -1) continue;
      const neighbors = this.rangeQuery(entities, i, eps);

      if (neighbors.length < minPoints) {
        labels[i] = -2;
        continue;
      }

      labels[i] = clusterId;
      const seeds = [...neighbors];

      for (let j = 0; j < seeds.length; j++) {
        const q = seeds[j];
        if (labels[q] === -2) labels[q] = clusterId;
        if (labels[q] !== -1) continue;

        labels[q] = clusterId;
        const qNeighbors = this.rangeQuery(entities, q, eps);
        if (qNeighbors.length >= minPoints) {
          for (const nb of qNeighbors) {
            if (!seeds.includes(nb)) seeds.push(nb);
          }
        }
      }
      clusterId++;
    }

    const clusters = {};
    for (let i = 0; i < n; i++) {
      const label = labels[i];
      if (label < 0) continue;
      if (!clusters[label]) clusters[label] = [];
      clusters[label].push(entities[i]);
    }
    return Object.values(clusters);
  },

  rangeQuery(entities, idx, eps) {
    const neighbors = [];
    const e = entities[idx];
    for (let i = 0; i < entities.length; i++) {
      if (i === idx) continue;
      if (this.entityDistance(e, entities[i]) <= eps) neighbors.push(i);
    }
    return neighbors;
  },

  // Weighted distance: horizontal proximity matters less (same line = same patient)
  entityDistance(a, b) {
    const dx = Math.abs(a.box.cx - b.box.cx) * 0.3;
    const dy = Math.abs(a.box.cy - b.box.cy) * 1.0;
    return Math.sqrt(dx * dx + dy * dy);
  },

  splitClusterRows(cluster) {
    if (cluster.length <= 4) return [cluster];

    const sorted = [...cluster].sort((a, b) => a.box.cy - b.box.cy || a.box.cx - b.box.cx);
    const rowGap = Math.max(average(sorted.map(e => e.box.h), 20) * 0.8, 18);
    const rows = [];

    for (const entity of sorted) {
      const current = rows[rows.length - 1];
      if (!current || Math.abs(entity.box.cy - current.centerY) > rowGap) {
        rows.push({ entities: [entity], centerY: entity.box.cy });
        continue;
      }
      current.entities.push(entity);
      current.centerY = average(current.entities.map(item => item.box.cy), current.centerY);
    }

    const identityScore = (row) => {
      let score = 0;
      if (row.entities.some(entity => entity.entity === 'BED')) score += 1.2;
      if (row.entities.some(entity => entity.entity === 'NAME')) score += 1;
      if (row.entities.some(entity => entity.entity === 'AGE_GENDER')) score += 1;
      if (row.entities.some(entity => entity.entity === 'AGE')) score += 0.3;
      if (row.entities.some(entity => entity.entity === 'GENDER')) score += 0.2;
      return score;
    };

    const strongRows = rows.filter(row => identityScore(row) >= 1.2);
    if (strongRows.length < 2) return [cluster];

    const mergedRows = [];
    for (const row of rows) {
      const previous = mergedRows[mergedRows.length - 1];
      if (!previous) {
        mergedRows.push({ ...row, entities: [...row.entities] });
        continue;
      }
      if (identityScore(row) < 0.6) {
        previous.entities.push(...row.entities);
      } else {
        mergedRows.push({ ...row, entities: [...row.entities] });
      }
    }

    return mergedRows.map(row => row.entities);
  },
};

// ====== STEP 3: PATIENT ASSEMBLY ======
const PatientAssembler = {
  assemble(cluster) {
    const patient = {
      fullName: null, age: null, gender: null, bed: null,
      dx: null, meds: null, allergies: null, code: null,
      confidence: 0, warnings: [], flags: [],
      fieldConfidence: {}, rawEntityCount: cluster.length,
    };

    const names = [];
    const diagnoses = [];
    const medications = [];
    const unknowns = [];
    let totalConf = 0, entityCount = 0;

    for (const entity of cluster) {
      totalConf += entity.confidence;
      entityCount++;

      switch (entity.entity) {
        case 'BED':
          if (!patient.bed || entity.confidence > (patient.fieldConfidence.bed || 0)) {
            patient.bed = entity.corrected;
            patient.fieldConfidence.bed = entity.confidence;
          }
          break;
        case 'NAME': names.push(entity); break;
        case 'AGE_GENDER':
          patient.age = entity.meta.age;
          patient.gender = entity.meta.gender;
          patient.fieldConfidence.age = entity.confidence;
          patient.fieldConfidence.gender = entity.confidence;
          patient.fieldConfidence.ageGender = entity.confidence;
          break;
        case 'AGE':
          if (!patient.age) {
            patient.age = entity.meta.age;
            patient.fieldConfidence.age = entity.confidence;
          }
          break;
        case 'GENDER':
          if (!patient.gender) {
            patient.gender = entity.meta.gender;
            patient.fieldConfidence.gender = entity.confidence;
          }
          break;
        case 'DIAGNOSIS': diagnoses.push(entity); break;
        case 'MEDICATION': medications.push(entity); break;
        case 'ALLERGY':
          if (!patient.allergies || entity.confidence > (patient.fieldConfidence.allergies || 0)) {
            patient.allergies = entity.corrected;
            patient.fieldConfidence.allergies = entity.confidence;
          }
          break;
        case 'STATUS':
          if (!patient.code || entity.confidence > (patient.fieldConfidence.code || 0)) {
            patient.code = entity.corrected;
            patient.fieldConfidence.code = entity.confidence;
          }
          break;
        case 'CIVIL_ID':
          if (!patient.civilId || entity.confidence > (patient.fieldConfidence.civilId || 0)) {
            patient.civilId = entity.corrected;
            patient.fieldConfidence.civilId = entity.confidence;
          }
          break;
        case 'WARD':
          if (!patient.ward || entity.confidence > (patient.fieldConfidence.ward || 0)) {
            patient.ward = entity.meta.ward || entity.corrected;
            patient.fieldConfidence.ward = entity.confidence;
          }
          break;
        case 'O2':
          if (!patient.o2 || patient.o2 === 'NONE' || entity.confidence > (patient.fieldConfidence.o2 || 0)) {
            patient.o2 = entity.meta.o2 || entity.corrected;
            patient.fieldConfidence.o2 = entity.confidence;
          }
          break;
        case 'ISOLATION':
          if (!patient.iso || patient.iso === 'NONE' || entity.confidence > (patient.fieldConfidence.iso || 0)) {
            patient.iso = entity.meta.iso || entity.corrected;
            patient.fieldConfidence.iso = entity.confidence;
          }
          break;
        case 'UNKNOWN': unknowns.push(entity); break;
      }
    }

    // Resolve unknowns by spatial proximity
    for (const unk of unknowns) {
      const nearName = this.findNearest(unk, cluster.filter(e => e.entity === 'NAME'));
      const nearDx = this.findNearest(unk, cluster.filter(e => e.entity === 'DIAGNOSIS'));

      if (nearName && (!nearDx || nearName.dist < nearDx.dist) && /[A-Za-z\u0600-\u06FF]/.test(unk.text)) {
        names.push(unk); // Absorb into name
      } else if (nearDx && /[A-Z]{2,}|\d/.test(unk.text)) {
        diagnoses.push(unk);
      }
    }

    // Assemble name from spatial order
    if (names.length > 0) {
      const isArabic = /[\u0600-\u06FF]/.test(names[0].corrected || names[0].text);
      const sorted = [...names].sort((a, b) =>
        isArabic ? b.box.cx - a.box.cx : a.box.cx - b.box.cx
      );
      patient.fullName = [...new Set(sorted.map(e => (e.corrected || e.text).trim()).filter(Boolean))].join(' ');
      patient.fieldConfidence.fullName = average(names.map(e => e.confidence), 0.45);
    }

    if (diagnoses.length > 0) {
      patient.dx = [...new Set(diagnoses.map(e => e.corrected || e.text))].join(', ');
      patient.fieldConfidence.dx = average(diagnoses.map(e => e.confidence), 0.5);
    }
    if (medications.length > 0) {
      patient.meds = [...new Set(medications.map(e => e.corrected || e.text))].join(', ');
      patient.fieldConfidence.meds = average(medications.map(e => e.confidence), 0.5);
    }

    const baseConfidence = entityCount > 0 ? totalConf / entityCount : 0;
    patient.confidence = clamp(weightedAverage([
      { value: patient.fieldConfidence.fullName, weight: 3 },
      { value: patient.fieldConfidence.bed, weight: 2.5 },
      { value: patient.fieldConfidence.ageGender, weight: 2.1 },
      { value: patient.fieldConfidence.age, weight: patient.gender ? 0.4 : 1.1 },
      { value: patient.fieldConfidence.gender, weight: patient.age ? 0.4 : 1.1 },
      { value: patient.fieldConfidence.dx, weight: 1.7 },
      { value: patient.fieldConfidence.meds, weight: 1.1 },
      { value: patient.fieldConfidence.allergies, weight: 0.7 },
      { value: patient.fieldConfidence.code, weight: 0.6 },
    ], baseConfidence) + (Math.min(cluster.length, 6) / 6 * 0.08));

    if (!patient.fullName && !patient.bed && diagnoses.length === 0) return null;
    return patient;
  },

  findNearest(target, candidates) {
    if (candidates.length === 0) return null;
    let best = null, bestDist = Infinity;
    for (const c of candidates) {
      const dist = SpatialClusterer.entityDistance(target, c);
      if (dist < bestDist) { bestDist = dist; best = c; }
    }
    return { entity: best, dist: bestDist };
  },
};

// ====== CLINICAL VALIDATOR ======
const ClinicalValidator = {
  validate(patient) {
    const warnings = [];

    if (patient.age != null) {
      if (patient.age < 0 || patient.age > 120) {
        warnings.push({ field: 'age', message: `Age ${patient.age} is implausible`, severity: 'ERROR' });
      }
      if (patient.age < 18 && patient.dx) {
        for (const dx of ['NSTEMI', 'STEMI', 'MI', 'CAD', 'AF', 'COPD', 'AAA']) {
          if (patient.dx.includes(dx)) {
            warnings.push({ field: 'diagnosis', message: `${dx} is unusual in a ${patient.age}-year-old`, severity: 'WARN' });
          }
        }
      }
    }

    if (patient.gender && patient.dx) {
      const dx = patient.dx.toUpperCase();
      if (patient.gender === 'M' && /\bovarian\b|\bectopic pregnancy\b|\bendometri/i.test(dx))
        warnings.push({ field: 'gender', message: 'Female-specific diagnosis for male patient', severity: 'ERROR' });
      if (patient.gender === 'F' && /\bprostate\b|\btesticular\b/i.test(dx))
        warnings.push({ field: 'gender', message: 'Male-specific diagnosis for female patient', severity: 'ERROR' });
    }

    if (patient.meds && patient.dx) {
      if (/METFORMIN/i.test(patient.meds) && /(CKD5|ESRD)/i.test(patient.dx))
        warnings.push({ field: 'medications', message: 'Metformin contraindicated in CKD5/ESRD', severity: 'CLINICAL_ALERT' });
      if (/INSULIN|GLARGINE|ASPART|LISPRO/i.test(patient.meds) && !/DM|DIABET|DKA|HHS/i.test(patient.dx))
        warnings.push({ field: 'diagnosis', message: 'Insulin prescribed but no diabetes in diagnosis', severity: 'WARN' });
      if (/HEPARIN|ENOXAPARIN/i.test(patient.meds) && !/DVT|PE|ACS|NSTEMI|STEMI|AF|VTE/i.test(patient.dx))
        warnings.push({ field: 'diagnosis', message: 'Anticoagulation without clear indication', severity: 'WARN' });
    }

    // Auto-suggest triage (order matters: check YELLOW before RED to handle NSTEMI vs STEMI)
    if (patient.dx) {
      const dx = patient.dx.toUpperCase();
      // YELLOW first — must check before RED to avoid NSTEMI triggering STEMI match
      if (/\bNSTEMI\b|ACS|(?<![A-Z])PE(?![A-Z])|DVT|AKI|ADHF|CHF|CAP(?!\w)|HAP|AECOPD|UGIB|SEPSIS(?!\s*SHOCK)|SBO/i.test(dx))
        patient.suggestedTriage = 'YELLOW';
      // RED — exact STEMI (not NSTEMI), cardiac arrest, DKA, etc.
      if (/\bSTEMI\b(?!.*\bNSTEMI\b)|CARDIAC ARREST|STATUS EPILEPT|ARDS|SEPTIC SHOCK|DKA|CVA|SAH|\bVF\b|OVERDOSE|\bOD\b|ECLAMPSIA|DIC|PPH|VARICES|CHOLANGITIS|MENINGITIS|BACTEREMIA|HEMOPTYSIS|RESP FAILURE/i.test(dx))
        patient.suggestedTriage = 'RED';
      // GREEN — stable chronic conditions
      else if (!patient.suggestedTriage && /UTI|CELLULITIS|HTN|DM[12]?$|CKD[1-3]|COPD$|GORD|ASTHMA|OSA|ANEMIA|IDA|EPILEPSY|HERNIA|PARKINSON|DEMENTIA/i.test(dx))
        patient.suggestedTriage = 'GREEN';
    }

    // Auto-suggest mobility (also consider O2 status)
    if (patient.dx || patient.o2) {
      const dx = (patient.dx || '').toUpperCase();
      const o2 = (patient.o2 || '').toUpperCase();
      if (/VENTILAT|INTUBAT|ARDS|CARDIAC ARREST|ICU|ETT/i.test(dx) || o2 === 'VENTILATOR')
        patient.suggestedMobility = 'CRITICAL_TRANSPORT';
      else if (/CVA|STROKE|SAH|ICH|FRACTURE|GBS|NOF|SDH|EDH|POST.?OP|PARAPL|QUADRI/i.test(dx))
        patient.suggestedMobility = 'STRETCHER';
      else if (/CHF|ADHF|PE|COPD|AECOPD|CAP|O2/i.test(dx) || ['BIPAP', 'NON_REBREATHER'].includes(o2))
        patient.suggestedMobility = 'WHEELCHAIR';
      else
        patient.suggestedMobility = 'AMBULATORY';
    }

    patient.warnings = dedupeWarnings(warnings);
    return patient;
  },
};

// ====== BOX NORMALIZATION ======
function normalizeBox(box) {
  // PaddleOCR RecognitionResult box: {x, y, width, height}
  if (box.x !== undefined && box.width !== undefined) {
    return { x: box.x, y: box.y, w: box.width, h: box.height, cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
  }
  // Tesseract.js word bbox: {x0, y0, x1, y1}
  if (box.x0 !== undefined) {
    const w = box.x1 - box.x0;
    const h = box.y1 - box.y0;
    return { x: box.x0, y: box.y0, w, h, cx: box.x0 + w / 2, cy: box.y0 + h / 2 };
  }
  // Array of 4 corner points
  if (Array.isArray(box) && box.length === 4 && Array.isArray(box[0])) {
    const xs = box.map(p => p[0]), ys = box.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  }
  // {x, y, w, h}
  if (box.x !== undefined && box.w !== undefined) {
    return { ...box, cx: box.x + box.w / 2, cy: box.y + box.h / 2 };
  }
  // {left, top, width, height}
  if (box.left !== undefined) {
    return { x: box.left, y: box.top, w: box.width, h: box.height, cx: box.left + box.width / 2, cy: box.top + box.height / 2 };
  }
  return { x: 0, y: 0, w: 10, h: 10, cx: 5, cy: 5 };
}

// ====== DETECTION SPLITTING ======
// "67/M NSTEMI DM2 HTN" as one OCR box → 4 separate entities
function splitDetections(detections) {
  const result = [];
  for (const det of detections) {
    const parts = det.text
      .replace(/[;,|]+/g, ' ')
      .replace(/\u060C/g, ' ')
      .replace(/\u061B/g, ' ')
      .split(/\s+/)
      .flatMap(token => {
        const cleaned = token.replace(/^[`"'~.,:!?()[\]{}<>]+|[`"'~.,:!?()[\]{}<>]+$/g, '');
        if (!cleaned) return [];
        if (/^[A-E]-[MF]-\d{1,2}$/i.test(cleaned) || /^[A-E]\d{1,2}$/i.test(cleaned)) return [cleaned];
        if (/^(?:\d{1,3}\s*[/\\-]?\s*[MFmf]|[MFmf]\s*[/\\-]?\s*\d{1,3})$/.test(cleaned)) return [cleaned];
        if (cleaned.includes('/')) {
          const slashParts = cleaned.split('/').filter(Boolean);
          if (slashParts.length > 1 && !slashParts.some(part => /^(?:\d{1,3}|[MFmf])$/.test(part))) return slashParts;
        }
        return [cleaned];
      })
      .filter(t => t.length > 0);
    if (parts.length <= 1) {
      result.push(det);
      continue;
    }
    const boxW = det.box.w / parts.length;
    parts.forEach((part, i) => {
      result.push({
        text: part,
        box: {
          x: det.box.x + i * boxW, y: det.box.y,
          w: boxW, h: det.box.h,
          cx: det.box.x + (i + 0.5) * boxW, cy: det.box.cy,
        },
        confidence: det.confidence,
      });
    });
  }
  return result;
}

// ====== DEDUPLICATION ======
function deduplicatePatients(patients) {
  const merged = [];
  const used = new Set();

  for (let i = 0; i < patients.length; i++) {
    if (used.has(i)) continue;
    const group = [patients[i]];
    used.add(i);

    let expanded = true;
    while (expanded) {
      expanded = false;
      for (let j = i + 1; j < patients.length; j++) {
        if (used.has(j)) continue;
        if (group.some(existing => shouldMerge(existing, patients[j]))) {
          group.push(patients[j]);
          used.add(j);
          expanded = true;
        }
      }
    }

    const consolidated = consolidatePatientGroup(group);
    if (consolidated) merged.push(consolidated);
  }
  return merged;
}

function shouldMerge(a, b) {
  const aBed = normalizeBedForMatch(a.bed);
  const bBed = normalizeBedForMatch(b.bed);
  if (aBed && bBed && aBed !== bBed) return false;
  if (aBed && bBed && aBed === bBed) return true;

  const aCivilId = normalizeCivilIdForMatch(a.civilId);
  const bCivilId = normalizeCivilIdForMatch(b.civilId);
  if (aCivilId && bCivilId && aCivilId !== bCivilId) return false;
  if (aCivilId && bCivilId && aCivilId === bCivilId) return true;

  if (a.gender && b.gender && a.gender !== b.gender) return false;
  if (a.age != null && b.age != null && Math.abs(a.age - b.age) > 8) return false;

  if (a.fullName && b.fullName) {
    const dist = ocrDistance(normalizeNameForMerge(a.fullName), normalizeNameForMerge(b.fullName));
    if (dist < 3) return true;

    const agesCompatible = a.age == null || b.age == null || Math.abs(a.age - b.age) <= 2;
    const gendersCompatible = !a.gender || !b.gender || a.gender === b.gender;
    if (agesCompatible && gendersCompatible && dist <= 4) return true;
  }
  return false;
}

function mergePatients(a, b) {
  return consolidatePatientGroup([a, b]) || a || b;
}

function entityFingerprint(entity) {
  return [
    Math.round(entity.box.x),
    Math.round(entity.box.y),
    Math.round(entity.box.w),
    Math.round(entity.box.h),
    entity.text,
  ].join('|');
}

function filterMeaningfulEntities(entities) {
  return entities.filter(entity => entity.entity !== 'NOISE' && entity.entity !== 'HEADER');
}

function rowIdentityScore(entities) {
  let score = 0;
  if (entities.some(entity => entity.entity === 'BED')) score += 1.2;
  if (entities.some(entity => entity.entity === 'NAME')) score += 1.05;
  if (entities.some(entity => entity.entity === 'AGE_GENDER')) score += 1;
  if (entities.some(entity => entity.entity === 'AGE')) score += 0.3;
  if (entities.some(entity => entity.entity === 'GENDER')) score += 0.25;
  if (entities.some(entity => entity.entity === 'CIVIL_ID')) score += 0.6;
  return score;
}

function groupEntitiesIntoRows(entities) {
  if (entities.length === 0) return [];

  const sorted = [...entities].sort((a, b) => a.box.cy - b.box.cy || a.box.cx - b.box.cx);
  const avgHeight = average(sorted.map(entity => entity.box.h), 20);
  const rowGap = Math.max(16, avgHeight * 0.82);
  const rows = [];

  for (const entity of sorted) {
    const current = rows[rows.length - 1];
    if (!current || Math.abs(entity.box.cy - current.centerY) > rowGap) {
      rows.push({ entities: [entity], centerY: entity.box.cy });
      continue;
    }
    current.entities.push(entity);
    current.centerY = average(current.entities.map(item => item.box.cy), current.centerY);
  }

  return rows.map(row => row.entities.sort((a, b) => a.box.cx - b.box.cx));
}

function detectLaneRanges(entities, imageWidth) {
  if (entities.length < 8) return [{ entities }];

  const sorted = [...entities].sort((a, b) => a.box.cx - b.box.cx);
  const avgWidth = average(sorted.map(entity => entity.box.w), 28);
  let bestGap = null;

  for (let i = 1; i < sorted.length; i++) {
    const left = sorted[i - 1];
    const right = sorted[i];
    const gap = right.box.x - (left.box.x + left.box.w);
    if (gap <= Math.max(avgWidth * 3.2, imageWidth * 0.12)) continue;
    if (!bestGap || gap > bestGap.gap) {
      bestGap = { gap, midpoint: left.box.x + left.box.w + gap / 2 };
    }
  }

  if (!bestGap) return [{ entities }];

  const leftLane = entities.filter(entity => entity.box.cx <= bestGap.midpoint);
  const rightLane = entities.filter(entity => entity.box.cx > bestGap.midpoint);
  if (leftLane.length < 4 || rightLane.length < 4) return [{ entities }];

  return [
    { entities: leftLane },
    { entities: rightLane },
  ].sort((a, b) => average(a.entities.map(entity => entity.box.x), 0) - average(b.entities.map(entity => entity.box.x), 0));
}

function mergeWeakRows(rows) {
  const merged = [];

  for (const row of rows) {
    const previous = merged[merged.length - 1];
    if (!previous) {
      merged.push([...row]);
      continue;
    }

    if (rowIdentityScore(row) < 0.6) {
      previous.push(...row);
      previous.sort((a, b) => a.box.cy - b.box.cy || a.box.cx - b.box.cx);
      continue;
    }

    merged.push([...row]);
  }

  return merged;
}

function inferColumnRole(text) {
  const cleaned = `${text || ''}`.trim().replace(/[:\-]+$/, '');
  if (/^(?:bed|room|rm|#|سرير|غرفة)$/i.test(cleaned)) return 'BED';
  if (/^(?:name|patient|pt|اسم|المريض)$/i.test(cleaned)) return 'NAME';
  if (/^(?:age|dob|العمر)$/i.test(cleaned)) return 'AGE_GENDER';
  if (/^(?:sex|gender|الجنس)$/i.test(cleaned)) return 'AGE_GENDER';
  if (/^(?:diag|diagnosis|dx|التشخيص)$/i.test(cleaned)) return 'DIAGNOSIS';
  if (/^(?:med|meds|medications|ادوية|أدوية)$/i.test(cleaned)) return 'MEDICATION';
  if (/^(?:allergy|allergies|حساسية)$/i.test(cleaned)) return 'ALLERGY';
  if (/^(?:code|status|الحالة)$/i.test(cleaned)) return 'STATUS';
  if (/^(?:ward|location|الجناح|وحدة)$/i.test(cleaned)) return 'WARD';
  if (/^(?:id|mrn|civil|الرقم)$/i.test(cleaned)) return 'CIVIL_ID';
  return null;
}

function applyRoleProjection(entity, role) {
  if (!role) return entity;

  const scorerMap = {
    BED: EntityRecognizer.scoreBed.bind(EntityRecognizer),
    NAME: EntityRecognizer.scoreName.bind(EntityRecognizer),
    AGE_GENDER: text => {
      const combined = EntityRecognizer.scoreAgeGender(text);
      if (combined.confidence > 0) return combined;
      const age = EntityRecognizer.scoreAge(text);
      if (age.confidence > 0) return { entity: 'AGE', confidence: age.confidence, meta: age.meta };
      return EntityRecognizer.scoreGender(text);
    },
    DIAGNOSIS: EntityRecognizer.scoreDiagnosis.bind(EntityRecognizer),
    MEDICATION: EntityRecognizer.scoreMedication.bind(EntityRecognizer),
    ALLERGY: EntityRecognizer.scoreAllergy.bind(EntityRecognizer),
    STATUS: EntityRecognizer.scoreStatus.bind(EntityRecognizer),
    WARD: EntityRecognizer.scoreWard.bind(EntityRecognizer),
    CIVIL_ID: EntityRecognizer.scoreCivilId.bind(EntityRecognizer),
  };

  const scorer = scorerMap[role];
  if (!scorer) return entity;

  const projected = role === 'STATUS' || role === 'ALLERGY'
    ? scorer(entity.text.toUpperCase())
    : scorer(entity.text);
  if (!projected || projected.confidence <= 0) {
    return { ...entity, meta: { ...(entity.meta || {}), columnRole: role } };
  }

  const nextEntity = projected.entity || entity.entity;
  return {
    ...entity,
    entity: nextEntity,
    confidence: clamp(Math.max(entity.confidence, projected.confidence * 0.95)),
    corrected: projected.corrected || entity.corrected || entity.text,
    meta: { ...(entity.meta || {}), ...(projected.meta || {}), columnRole: role },
  };
}

function resolveColumnRole(text) {
  const existingRole = inferColumnRole(text);
  if (existingRole) return existingRole;

  const cleaned = `${text || ''}`.trim().replace(/[:\-]+$/, '');
  if (/^(?:o2|oxygen|airway|resp|fio2)$/i.test(cleaned)) return 'O2';
  if (/^(?:iso|isolation|precautions?)$/i.test(cleaned)) return 'ISOLATION';
  return null;
}

function projectEntityByColumnRole(entity, role) {
  if (role === 'O2') {
    const projected = EntityRecognizer.scoreO2(entity.text);
    if (projected.confidence > 0) {
      return {
        ...entity,
        entity: projected.entity || entity.entity,
        confidence: clamp(Math.max(entity.confidence, projected.confidence * 0.95)),
        corrected: projected.corrected || entity.corrected || entity.text,
        meta: { ...(entity.meta || {}), ...(projected.meta || {}), columnRole: role },
      };
    }
  }

  if (role === 'ISOLATION') {
    const projected = EntityRecognizer.scoreIsolation(entity.text.toUpperCase());
    if (projected.confidence > 0) {
      return {
        ...entity,
        entity: projected.entity || entity.entity,
        confidence: clamp(Math.max(entity.confidence, projected.confidence * 0.95)),
        corrected: projected.corrected || entity.corrected || entity.text,
        meta: { ...(entity.meta || {}), ...(projected.meta || {}), columnRole: role },
      };
    }
  }

  return applyRoleProjection(entity, role);
}

function mapEntityToColumnRole(entityType) {
  switch (entityType) {
    case 'BED':
      return 'BED';
    case 'NAME':
      return 'NAME';
    case 'AGE_GENDER':
    case 'AGE':
    case 'GENDER':
      return 'AGE_GENDER';
    case 'DIAGNOSIS':
      return 'DIAGNOSIS';
    case 'MEDICATION':
      return 'MEDICATION';
    case 'ALLERGY':
      return 'ALLERGY';
    case 'STATUS':
      return 'STATUS';
    case 'WARD':
      return 'WARD';
    case 'CIVIL_ID':
      return 'CIVIL_ID';
    case 'O2':
      return 'O2';
    case 'ISOLATION':
      return 'ISOLATION';
    default:
      return null;
  }
}

function inferColumnsFromRows(rows, imageWidth) {
  const entities = rows.flat();
  if (entities.length < 8) return [];

  const sorted = [...entities].sort((a, b) => a.box.cx - b.box.cx);
  const avgWidth = average(sorted.map(entity => entity.box.w), 28);
  const groupingThreshold = Math.max(28, avgWidth * 1.35, imageWidth * 0.025);
  const bands = [];

  for (const entity of sorted) {
    const current = bands[bands.length - 1];
    if (!current || Math.abs(entity.box.cx - current.centerX) > groupingThreshold) {
      bands.push({ centerX: entity.box.cx, entities: [entity] });
      continue;
    }
    current.entities.push(entity);
    current.centerX = average(current.entities.map(item => item.box.cx), current.centerX);
  }

  return bands
    .map(band => {
      const roleWeights = new Map();
      band.entities.forEach(entity => {
        const role = mapEntityToColumnRole(entity.entity);
        if (!role) return;
        roleWeights.set(role, (roleWeights.get(role) || 0) + Math.max(entity.confidence || 0, 0.2));
      });

      const rankedRoles = [...roleWeights.entries()].sort((a, b) => b[1] - a[1]);
      if (rankedRoles.length === 0) return null;

      const [role, weight] = rankedRoles[0];
      const totalWeight = rankedRoles.reduce((sum, [, value]) => sum + value, 0);
      const rowAnchors = new Set(band.entities.map(entity => Math.round(entity.box.cy / Math.max(entity.box.h, 18))));
      const rowCoverage = rowAnchors.size / Math.max(rows.length, 1);

      if (weight < 1.05) return null;
      if (rankedRoles.length > 1 && (weight / Math.max(totalWeight, 1)) < 0.52) return null;
      if (rowCoverage < 0.24 && band.entities.length < 3) return null;

      return {
        role,
        centerX: band.centerX,
        support: band.entities.length,
        confidence: weight / Math.max(totalWeight, 1),
        rowCoverage,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.centerX - b.centerX);
}

function patientHasStrongIdentity(patient) {
  return !!(patient?.bed && patient?.fullName && (patient?.age != null || patient?.gender));
}

function patientAddsMissingDetail(existing, incoming) {
  return Boolean(
    (!existing?.civilId && incoming?.civilId) ||
    (!existing?.meds && incoming?.meds) ||
    (!existing?.allergies && incoming?.allergies) ||
    (!existing?.ward && incoming?.ward) ||
    ((!existing?.o2 || existing.o2 === 'NONE') && incoming?.o2 && incoming.o2 !== 'NONE') ||
    ((!existing?.iso || existing.iso === 'NONE') && incoming?.iso && incoming.iso !== 'NONE')
  );
}

const TableHypothesisBuilder = {
  build(entities) {
    const rows = groupEntitiesIntoRows(entities);
    if (rows.length < 3) return null;

    const headerIndex = rows.slice(0, 3).findIndex(row => row.filter(entity => isHeaderLike(entity.text)).length >= 2);
    if (headerIndex === -1) return null;

    const headerRow = rows[headerIndex];
    const columns = headerRow
      .map(entity => ({
        role: resolveColumnRole(entity.text),
        centerX: entity.box.cx,
      }))
      .filter(column => column.role);
    if (columns.length < 2) return null;

    const clusters = [];
    for (const row of rows.slice(headerIndex + 1)) {
      const projected = row.map(entity => {
        const nearestColumn = columns.reduce((best, column) => {
          if (!best) return column;
          return Math.abs(column.centerX - entity.box.cx) < Math.abs(best.centerX - entity.box.cx) ? column : best;
        }, null);
        return projectEntityByColumnRole(entity, nearestColumn?.role || null);
      });

      if (rowIdentityScore(projected) < 0.6 && clusters.length > 0) {
        clusters[clusters.length - 1].push(...projected);
      } else {
        clusters.push(projected);
      }
    }

    if (clusters.length === 0) return null;

    const coverage = new Set(clusters.flat().map(entityFingerprint)).size / Math.max(filterMeaningfulEntities(entities).length, 1);
    return {
      id: 'table-grid',
      clusters,
      structuralScore: 0.94,
      coverage,
    };
  },
};

const InferredColumnHypothesisBuilder = {
  build(entities, imageWidth) {
    const meaningful = filterMeaningfulEntities(entities);
    const rows = mergeWeakRows(groupEntitiesIntoRows(meaningful));
    if (rows.length < 3) return null;

    const anchorRows = rows.filter(row => rowIdentityScore(row) >= 1.15);
    if (anchorRows.length < 2) return null;

    const columns = inferColumnsFromRows(anchorRows, imageWidth);
    const distinctRoles = new Set(columns.map(column => column.role));
    if (columns.length < 2 || distinctRoles.size < 2) return null;

    const projectedClusters = rows.map(row => row.map(entity => {
      const nearestColumn = columns.reduce((best, column) => {
        if (!best) return column;
        return Math.abs(column.centerX - entity.box.cx) < Math.abs(best.centerX - entity.box.cx) ? column : best;
      }, null);
      return projectEntityByColumnRole(entity, nearestColumn?.role || null);
    }));

    const coverage = new Set(projectedClusters.flat().map(entityFingerprint)).size / Math.max(meaningful.length, 1);
    const columnConfidence = average(columns.map(column => column.confidence), 0.55);
    return {
      id: 'schema-columns',
      clusters: projectedClusters,
      structuralScore: clamp(0.78 + ((distinctRoles.size - 2) * 0.025) + ((columnConfidence - 0.55) * 0.12), 0, 0.9),
      coverage,
      columnCount: columns.length,
    };
  },
};

const LaneRowHypothesisBuilder = {
  build(entities, imageWidth) {
    const lanes = detectLaneRanges(entities, imageWidth);
    const clusters = lanes.flatMap(lane => mergeWeakRows(groupEntitiesIntoRows(lane.entities)));
    if (clusters.length === 0) return null;

    const coverage = new Set(clusters.flat().map(entityFingerprint)).size / Math.max(filterMeaningfulEntities(entities).length, 1);
    return {
      id: lanes.length > 1 ? 'lane-rows' : 'row-bands',
      clusters,
      structuralScore: lanes.length > 1 ? 0.86 : 0.75,
      coverage,
      laneCount: lanes.length,
    };
  },
};

const LayoutHypothesisEngine = {
  build(entities, imageWidth, imageHeight) {
    const meaningful = filterMeaningfulEntities(entities);
    const hypotheses = [];

    const table = TableHypothesisBuilder.build(entities);
    if (table) hypotheses.push(table);

    const inferredColumns = InferredColumnHypothesisBuilder.build(meaningful, imageWidth);
    if (inferredColumns) hypotheses.push(inferredColumns);

    const laneRows = LaneRowHypothesisBuilder.build(meaningful, imageWidth);
    if (laneRows) hypotheses.push(laneRows);

    const clusters = SpatialClusterer.cluster(entities, imageWidth, imageHeight);
    if (clusters.length > 0) {
      hypotheses.push({
        id: 'spatial-cluster',
        clusters,
        structuralScore: 0.68,
        coverage: new Set(clusters.flat().map(entityFingerprint)).size / Math.max(meaningful.length, 1),
      });
    }

    return hypotheses;
  },

  evaluate(hypothesis) {
    const patients = finalizePatients(
      hypothesis.clusters
        .map(cluster => PatientAssembler.assemble(cluster))
        .filter(Boolean)
    );
    const readyRatio = patients.filter(patient => patient.reviewLevel === 'READY').length / Math.max(patients.length, 1);
    const completeness = average(patients.map(patient => {
      let score = 0;
      if (patient.fullName) score += 0.35;
      if (patient.bed) score += 0.2;
      if (patient.age != null || patient.gender) score += 0.2;
      if (patient.dx) score += 0.15;
      if (patient.meds) score += 0.1;
      return score;
    }), 0);

    return {
      ...hypothesis,
      patients,
      score: clamp(
        (average(patients.map(patient => patient.confidence), 0) * 0.46) +
        (readyRatio * 0.18) +
        ((hypothesis.coverage || 0) * 0.18) +
        (completeness * 0.12) +
        ((hypothesis.structuralScore || 0) * 0.06)
      ),
    };
  },

  pickBest(hypotheses) {
    return [...hypotheses].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.patients.length !== a.patients.length) return b.patients.length - a.patients.length;
      return average(b.patients.map(patient => patient.confidence), 0) - average(a.patients.map(patient => patient.confidence), 0);
    })[0] || null;
  },

  fuse(best, hypotheses) {
    if (!best) return [];
    let merged = [...best.patients];

    for (const hypothesis of hypotheses) {
      if (hypothesis.id === best.id) continue;
      const conservativeFusion = (best.score || 0) >= 0.88 && (hypothesis.score || 0) <= (best.score || 0);
      for (const patient of hypothesis.patients) {
        const index = merged.findIndex(existing => shouldMerge(existing, patient));
        if (index === -1) {
          if ((patient.confidence || 0) >= 0.84) merged.push(patient);
          continue;
        }

        const existing = merged[index];
        if (conservativeFusion) {
          const incomingLooksBroader = (patient.rawEntityCount || 0) > ((existing.rawEntityCount || 0) + 2);
          if (patientHasStrongIdentity(existing) && incomingLooksBroader && !patientAddsMissingDetail(existing, patient)) {
            continue;
          }
          if (patientHasStrongIdentity(existing) && !patientAddsMissingDetail(existing, patient) && (patient.confidence || 0) < ((existing.confidence || 0) + 0.02)) {
            continue;
          }
        }

        merged[index] = mergePatients(existing, patient);
      }
    }

    return finalizePatients(deduplicatePatients(merged));
  },
};

// ====== PADDLEOCR ENGINE (ONNX Runtime Web) ======
import { PaddleOcrService } from 'paddleocr';
import * as ort from 'onnxruntime-web';

// Model URLs — PP-OCRv3 detection (2.3MB) + PP-OCRv5 English recognition (7.5MB)
const MODEL_URLS = {
  detection: {
    key: 'det-v3',
    url: '/models/ocr/det.onnx',
    fallbackUrl: 'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/detection/v3/det.onnx',
  },
  latin: {
    key: 'latin-rec',
    url: '/models/ocr/latin-rec.onnx',
    fallbackUrl: 'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/english/rec.onnx',
    dictKey: 'latin-dict',
    dictUrl: '/models/ocr/latin-dict.txt',
    dictFallbackUrl: 'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/english/dict.txt',
  },
  arabic: {
    key: 'arabic-rec',
    url: '/models/ocr/arabic-rec.onnx',
    fallbackUrl: 'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/arabic/rec.onnx',
    dictKey: 'arabic-dict',
    dictUrl: '/models/ocr/arabic-dict.txt',
    dictFallbackUrl: 'https://huggingface.co/monkt/paddleocr-onnx/resolve/main/languages/arabic/dict.txt',
  },
};

const MODEL_CACHE_DB = 'medevac-ocr-models';
const MODEL_CACHE_VERSION = 3;

// IndexedDB model caching for true offline support
async function openModelCache() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MODEL_CACHE_DB, MODEL_CACHE_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('models')) db.createObjectStore('models');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCachedModel(key) {
  try {
    const db = await openModelCache();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('models', 'readonly');
      const req = tx.objectStore('models').get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch { return null; }
}

async function setCachedModel(key, data) {
  try {
    const db = await openModelCache();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('models', 'readwrite');
      tx.objectStore('models').put(data, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* cache write failure is non-fatal */ }
}

async function fetchModelWithCache(asset, onProgress) {
  const { key, url, fallbackUrl } = asset;
  const cached = await getCachedModel(key);
  if (cached) return cached;

  const sources = [
    { label: 'packaged', url },
    ...(fallbackUrl ? [{ label: 'remote', url: fallbackUrl }] : []),
  ];
  let lastError = null;

  for (const source of sources) {
    try {
      onProgress?.(`Loading ${key} (${source.label})...`);
      const response = await fetch(source.url);
      if (!response.ok) throw new Error(`Failed to fetch ${key} from ${source.label}: ${response.status}`);

      const data = key.endsWith('dict') ? await response.text() : await response.arrayBuffer();
      await setCachedModel(key, data);
      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Unable to load OCR asset "${key}". ${lastError?.message || 'No asset source succeeded.'}`
  );
}

function parseDictionary(data) {
  const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
  return text.split('\n').map(line => line.trim()).filter(Boolean);
}

async function createScriptService(detBuffer, modelBuffer, dictionary, isSecondary) {
  return PaddleOcrService.createInstance({
    ort,
    detection: {
      // Second service needs its own copy of the buffer (ONNX takes ownership)
      modelBuffer: isSecondary ? detBuffer.slice(0) : detBuffer,
      maxSideLength: 1280,
      textPixelThreshold: 0.5,
      minimumAreaThreshold: 16,
      paddingBoxVertical: 0.35,
      paddingBoxHorizontal: 0.55,
    },
    recognition: {
      modelBuffer,
      charactersDictionary: dictionary,
      imageHeight: 48,
    },
  });
}

let contextOcrRuntime = null;
let contextOcrInitPromise = null;

async function initContextOCR(onProgress) {
  if (contextOcrRuntime) return contextOcrRuntime;
  if (contextOcrInitPromise) return contextOcrInitPromise;

  contextOcrInitPromise = (async () => {
    onProgress?.('Loading OCR models...');

    // Use all available cores for faster OCR in emergencies
    ort.env.wasm.numThreads = Math.min(navigator.hardwareConcurrency || 1, 4);
    ort.env.wasm.simd = true;
    ort.env.wasm.wasmPaths = '/';

    const [
      detBuffer,
      latinBuffer,
      latinDictRaw,
      arabicBuffer,
      arabicDictRaw,
    ] = await Promise.all([
      fetchModelWithCache(MODEL_URLS.detection, onProgress),
      fetchModelWithCache({
        key: MODEL_URLS.latin.key,
        url: MODEL_URLS.latin.url,
        fallbackUrl: MODEL_URLS.latin.fallbackUrl,
      }, onProgress),
      fetchModelWithCache({
        key: MODEL_URLS.latin.dictKey,
        url: MODEL_URLS.latin.dictUrl,
        fallbackUrl: MODEL_URLS.latin.dictFallbackUrl,
      }, onProgress),
      fetchModelWithCache({
        key: MODEL_URLS.arabic.key,
        url: MODEL_URLS.arabic.url,
        fallbackUrl: MODEL_URLS.arabic.fallbackUrl,
      }, onProgress),
      fetchModelWithCache({
        key: MODEL_URLS.arabic.dictKey,
        url: MODEL_URLS.arabic.dictUrl,
        fallbackUrl: MODEL_URLS.arabic.dictFallbackUrl,
      }, onProgress),
    ]);

    onProgress?.('Initializing OCR engine...');
    contextOcrRuntime = {
      latin: await createScriptService(detBuffer, latinBuffer, parseDictionary(latinDictRaw), false),
      arabic: await createScriptService(detBuffer, arabicBuffer, parseDictionary(arabicDictRaw), true),
    };

    return contextOcrRuntime;
  })();

  return contextOcrInitPromise;
}

function recognitionDomainScore(result, script) {
  if (!result?.text) return -0.2;

  const classified = EntityRecognizer.classify({
    text: result.text,
    box: normalizeBox(result.box || { x: 0, y: 0, w: 12, h: 12 }),
    confidence: result.confidence ?? 0.5,
  });

  let score = (result.confidence || 0) * 0.62;
  if (classified.entity !== 'UNKNOWN' && classified.entity !== 'NOISE') score += classified.confidence * 0.32;
  if (/[\u0600-\u06FF]/.test(result.text)) score += script === 'arabic' ? 0.22 : -0.12;
  if (/[A-Za-z]/.test(result.text)) score += script === 'latin' ? 0.12 : -0.05;
  if (/^[\W_]+$/.test(result.text)) score -= 0.25;
  if (result.text.length <= 1 && !/^[MF\d]$/i.test(result.text)) score -= 0.1;
  return score;
}

function boxIoU(a, b) {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const intersection = ix * iy;
  if (intersection <= 0) return 0;
  const union = (a.width * a.height) + (b.width * b.height) - intersection;
  return union > 0 ? intersection / union : 0;
}

function chooseRecognitionCandidate(latinResult, arabicResult) {
  if (!latinResult) return { ...arabicResult, script: 'arabic' };
  if (!arabicResult) return { ...latinResult, script: 'latin' };

  const latinScore = recognitionDomainScore(latinResult, 'latin');
  const arabicScore = recognitionDomainScore(arabicResult, 'arabic');
  const chosen = arabicScore > latinScore ? { ...arabicResult, script: 'arabic' } : { ...latinResult, script: 'latin' };

  return {
    ...chosen,
    alternatives: {
      latin: { text: latinResult.text, confidence: latinResult.confidence },
      arabic: { text: arabicResult.text, confidence: arabicResult.confidence },
    },
  };
}

function fuseRecognitionResults(latinResults, arabicResults) {
  const fused = [];
  const usedArabic = new Set();

  for (let i = 0; i < latinResults.length; i++) {
    const latin = latinResults[i];
    let bestArabicIndex = -1;
    let bestOverlap = 0;

    for (let j = 0; j < arabicResults.length; j++) {
      if (usedArabic.has(j)) continue;
      const overlap = boxIoU(latin.box, arabicResults[j].box);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestArabicIndex = j;
      }
    }

    const arabic = bestOverlap >= 0.55 && bestArabicIndex >= 0 ? arabicResults[bestArabicIndex] : null;
    if (bestArabicIndex >= 0 && arabic) usedArabic.add(bestArabicIndex);
    fused.push(chooseRecognitionCandidate(latin, arabic));
  }

  arabicResults.forEach((result, index) => {
    if (!usedArabic.has(index) && (result.confidence || 0) >= 0.55) {
      fused.push({ ...result, script: 'arabic' });
    }
  });

  return fused.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
}

function shouldRunArabicAugment(candidate) {
  if (!candidate) return true;
  // Only run Arabic rescue if Latin quality is genuinely poor
  if ((candidate.qualityScore || 0) >= 0.78 && candidate.patients.length > 0) return false;
  return candidate.patients.some(patient =>
    (!patient.fullName && (patient.bed || patient.dx || patient.civilId)) ||
    ((patient.fieldConfidence?.fullName || 0) < 0.45 && !!patient.fullName)
  );
}

// Extract RGBA pixel data from a canvas for PaddleOCR input
function canvasToImageInput(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    data: imageData.data,
    width: canvas.width,
    height: canvas.height,
  };
}

// Check if models are cached (for UI status)
export async function areModelsCached() {
  try {
    const det = await getCachedModel(MODEL_URLS.detection.key);
    const latin = await getCachedModel(MODEL_URLS.latin.key);
    const latinDict = await getCachedModel(MODEL_URLS.latin.dictKey);
    const arabic = await getCachedModel(MODEL_URLS.arabic.key);
    const arabicDict = await getCachedModel(MODEL_URLS.arabic.dictKey);
    return !!(det && latin && latinDict && arabic && arabicDict);
  } catch { return false; }
}

// ====== v3 PIPELINE: ENTITY-FIRST SPATIAL CLUSTERING ======
function finalizePatients(patients) {
  patients.forEach(p => ClinicalValidator.validate(p));
  return deduplicatePatients(patients).map(p => enrichPatientForReview(ClinicalValidator.validate(p)));
}

export function analyzeOcrWords(words, imageWidth, imageHeight) {
  // 1. Normalize bounding boxes
  const detections = words
    .filter(w => w.text && w.text.trim().length > 0)
    .map(w => ({
      text: w.text.trim(),
      box: normalizeBox(w.bbox || w),
      confidence: Number.isFinite(w.confidence)
        ? (w.confidence > 1 ? w.confidence / 100 : w.confidence)
        : 0.5,
    }));

  if (detections.length === 0) {
    return { patients: [], entityCount: 0, clusterCount: 0, analysisScore: 0, strategy: 'none', hypotheses: [] };
  }

  // 2. Split multi-term detections
  const split = splitDetections(detections);

  // 3. Classify every detection as an entity type
  const entities = split.map(detection => EntityRecognizer.classify(detection));
  const entityCount = entities.filter(entity => entity.entity !== 'NOISE' && entity.entity !== 'HEADER').length;
  const evaluatedHypotheses = LayoutHypothesisEngine
    .build(entities, imageWidth, imageHeight)
    .map(hypothesis => LayoutHypothesisEngine.evaluate(hypothesis));
  const bestHypothesis = LayoutHypothesisEngine.pickBest(evaluatedHypotheses);

  // 4. Spatial clustering — group entities into patients
  const finalized = LayoutHypothesisEngine.fuse(bestHypothesis, evaluatedHypotheses);

  const analysisScore = clamp(
    (average(finalized.map(patient => patient.confidence), 0) * 0.62) +
    ((finalized.filter(patient => patient.reviewLevel === 'READY').length / Math.max(finalized.length, 1)) * 0.2) +
    (scoreTextDensity(finalized.map(patient => [patient.fullName, patient.bed, patient.dx].filter(Boolean).join(' ')).join(' ')) * 0.18)
  );
  return {
    patients: finalized,
    entityCount,
    clusterCount: bestHypothesis?.clusters?.length || 0,
    analysisScore,
    strategy: bestHypothesis?.id || 'spatial-cluster',
    hypotheses: evaluatedHypotheses.map(hypothesis => ({
      id: hypothesis.id,
      score: hypothesis.score,
      patients: hypothesis.patients.length,
      laneCount: hypothesis.laneCount || 1,
    })),
  };
}

// ====== FALLBACK: LINE-BASED PARSING (for plain text without boxes) ======
export function parseFromPlainText(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  // Create synthetic detections with estimated positions
  const lineHeight = 30;
  const detections = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const words = lines[lineIdx].split(/\s+/);
    let xPos = 0;
    for (const word of words) {
      if (word.length === 0) continue;
      const wordWidth = word.length * 10;
      detections.push({
        text: word,
        box: {
          x: xPos, y: lineIdx * lineHeight,
          w: wordWidth, h: lineHeight - 4,
          cx: xPos + wordWidth / 2,
          cy: lineIdx * lineHeight + (lineHeight - 4) / 2,
        },
        confidence: 0.5,
      });
      xPos += wordWidth + 10;
    }
  }

  return analyzeOcrWords(detections, 1000, Math.max(lines.length * lineHeight, 300));
}

function buildPassCandidate(results, canvas, profileId, meta = {}) {
  const words = results
    .filter(r => r.text && r.text.trim().length > 0 && r.confidence > 0.1)
    .map(r => ({
      text: r.text.trim(),
      bbox: r.box,
      confidence: r.confidence,
    }));

  const rawText = words.map(w => w.text).join(' ');
  const analysis = words.length > 0
    ? analyzeOcrWords(words, canvas.width || 1000, canvas.height || 1000)
    : { patients: [], entityCount: 0, clusterCount: 0, analysisScore: 0, strategy: 'none', hypotheses: [] };

  const wordConfidence = average(words.map(w => w.confidence), 0.4);
  const qualityScore = clamp(
    (analysis.analysisScore * 0.62) + (wordConfidence * 0.24) + (scoreTextDensity(rawText) * 0.14)
  );

  return {
    profileId,
    rawText,
    wordConfidence,
    qualityScore,
    qualityBand: confidenceBand(qualityScore),
    reviewCount: analysis.patients.filter(p => p.reviewLevel !== 'READY').length,
    backend: meta.backend || 'paddle-latin',
    scripts: meta.scripts || ['latin'],
    ...analysis,
  };
}

function pickBestCandidate(candidates) {
  return [...candidates].sort((a, b) => {
    if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore;
    if (b.patients.length !== a.patients.length) return b.patients.length - a.patients.length;
    return b.wordConfidence - a.wordConfidence;
  })[0];
}

function fuseCandidatePasses(candidates) {
  const best = pickBestCandidate(candidates);
  if (!best) return null;

  let mergedPatients = [...best.patients];
  let supportCount = 1;

  for (const candidate of candidates) {
    if (candidate === best) continue;
    if ((candidate.qualityScore || 0) < Math.max(0.64, (best.qualityScore || 0) - 0.12)) continue;
    supportCount++;

    for (const patient of candidate.patients) {
      const index = mergedPatients.findIndex(existing => shouldMerge(existing, patient));
      if (index === -1) {
        if ((patient.confidence || 0) >= 0.84) mergedPatients.push(patient);
        continue;
      }
      mergedPatients[index] = mergePatients(mergedPatients[index], patient);
    }
  }

  const finalizedPatients = finalizePatients(deduplicatePatients(mergedPatients));
  const reviewCount = finalizedPatients.filter(patient => patient.reviewLevel !== 'READY').length;
  const consensusScore = clamp((best.qualityScore || 0) + (Math.min(supportCount, 3) - 1) * 0.02);

  return {
    ...best,
    patients: finalizedPatients,
    reviewCount,
    qualityScore: consensusScore,
    qualityBand: confidenceBand(consensusScore),
    consensusPasses: supportCount,
  };
}

// ====== MAIN EXPORT ======
export async function processPatientListImage(imageSource, onProgress) {
  const startTime = performance.now();

  const runtime = await initContextOCR(onProgress);

  onProgress?.('Preparing image variants...');
  let baseCanvas = null;
  let variants;
  try {
    baseCanvas = await ImagePreprocessor.process(imageSource);
    variants = ImagePreprocessor.buildVariants(baseCanvas);
  } catch {
    variants = [{ id: 'source', label: 'Source image', canvas: imageSource }];
  }

  const candidates = [];

  // Step 3: Multi-pass OCR with PaddleOCR
  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    onProgress?.(`Recognizing text (${variant.label}, pass ${i + 1}/${variants.length}, latin)...`);

    const input = canvasToImageInput(variant.canvas);
    const latinResults = await runtime.latin.recognize(input);

    onProgress?.(`Analyzing patient structure (${variant.label})...`);
    let candidate = buildPassCandidate(latinResults, variant.canvas, variant.id, {
      backend: 'paddle-latin',
      scripts: ['latin'],
    });

    if (shouldRunArabicAugment(candidate)) {
      onProgress?.(`Running Arabic rescue pass (${variant.label})...`);
      const arabicResults = await runtime.arabic.recognize(input);
      const fusedResults = fuseRecognitionResults(latinResults, arabicResults);
      const fusedCandidate = buildPassCandidate(fusedResults, variant.canvas, variant.id, {
        backend: 'paddle-dual',
        scripts: ['latin', 'arabic'],
      });
      if (fusedCandidate.qualityScore >= candidate.qualityScore) {
        candidate = fusedCandidate;
      }
    }
    candidates.push(candidate);

    // Early exit after first pass if quality is acceptable — skip retries for speed
    const reviewThreshold = Math.ceil(Math.max(candidate.patients.length, 1) * 0.5);
    if (candidate.patients.length > 0 && candidate.qualityScore >= 0.72 && candidate.reviewCount <= reviewThreshold) {
      break;
    }
  }

  const currentBest = pickBestCandidate(candidates);
  if (baseCanvas && (!currentBest || currentBest.qualityScore < 0.82 || currentBest.reviewCount > Math.ceil(Math.max(currentBest.patients.length, 1) * 0.45))) {
    const rescueVariants = ImagePreprocessor.buildRescueVariants(baseCanvas);
    for (const variant of rescueVariants) {
      onProgress?.(`Rescue OCR (${variant.label})...`);
      const input = canvasToImageInput(variant.canvas);
      const latinResults = await runtime.latin.recognize(input);
      let candidate = buildPassCandidate(latinResults, variant.canvas, variant.id, {
        backend: 'paddle-latin',
        scripts: ['latin'],
      });

      if (shouldRunArabicAugment(candidate)) {
        const arabicResults = await runtime.arabic.recognize(input);
        const fusedResults = fuseRecognitionResults(latinResults, arabicResults);
        const fusedCandidate = buildPassCandidate(fusedResults, variant.canvas, variant.id, {
          backend: 'paddle-dual',
          scripts: ['latin', 'arabic'],
        });
        if (fusedCandidate.qualityScore >= candidate.qualityScore) {
          candidate = fusedCandidate;
        }
      }

      candidates.push(candidate);
    }
  }

  const best = fuseCandidatePasses(candidates);
  if (!best || (!best.rawText.trim() && best.patients.length === 0)) {
    return {
      patients: [],
      rawText: '',
      processingTime: performance.now() - startTime,
      engine: 'medtriage-context-ocr-v4',
      backend: best?.backend || 'paddle-latin',
      entityCount: 0,
      clusterCount: 0,
      qualityScore: 0,
      qualityBand: 'LOW',
      profile: 'source',
      reviewCount: 0,
      consensusPasses: 0,
      strategy: 'none',
      passes: candidates.map(c => ({
        profile: c.profileId, qualityScore: c.qualityScore,
        qualityBand: c.qualityBand, patients: c.patients.length,
        backend: c.backend, strategy: c.strategy,
      })),
    };
  }

  const capturedAt = new Date().toISOString();
  const patients = best.patients.map(p => ({
    ...p,
    triage: p.suggestedTriage || 'GREEN',
    mobility: p.suggestedMobility || 'AMBULATORY',
    o2: p.o2 || 'NONE',
    iso: p.iso || 'NONE',
    code: p.code || 'FULL',
    allergies: p.allergies || 'NKDA',
    evac: 'IN_WARD',
    ocrImported: true,
    ocrMeta: {
      engine: 'medtriage-context-ocr-v4',
      backend: best.backend,
      profile: best.profileId,
      strategy: best.strategy,
      consensusPasses: best.consensusPasses,
      qualityScore: best.qualityScore,
      qualityBand: best.qualityBand,
      wordConfidence: best.wordConfidence,
      capturedAt,
      reviewLevel: p.reviewLevel,
    },
  }));

  return {
    patients,
    rawText: best.rawText,
    processingTime: performance.now() - startTime,
    engine: 'medtriage-context-ocr-v4',
    backend: best.backend,
    entityCount: best.entityCount,
    clusterCount: best.clusterCount,
    qualityScore: best.qualityScore,
    qualityBand: best.qualityBand,
    wordConfidence: best.wordConfidence,
    profile: best.profileId,
    reviewCount: best.reviewCount,
    consensusPasses: best.consensusPasses,
    strategy: best.strategy,
    hypotheses: best.hypotheses,
    passes: candidates.map(c => ({
      profile: c.profileId, qualityScore: c.qualityScore,
      qualityBand: c.qualityBand, patients: c.patients.length,
      reviewCount: c.reviewCount,
      backend: c.backend,
      strategy: c.strategy,
    })),
  };
}

// Preload OCR models on app startup so scanning is instant during emergencies
export function preloadOcrModels() {
  if (contextOcrRuntime || contextOcrInitPromise) return;
  // Fire-and-forget background init — errors are non-fatal
  initContextOCR(() => {}).catch(() => {});
}

export { MedicalVocabulary, ClinicalValidator };
