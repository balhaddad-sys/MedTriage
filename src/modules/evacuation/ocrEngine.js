// MedEvac OCR Engine v3 — Entity-First Spatial Clustering
// Handles: printed tables, handwritten lists, whiteboards, chaotic mixed layouts
// Architecture: Image → OCR boxes → Entity Recognition → DBSCAN Clustering → Patient Assembly

import { boostEntityScore, resolveUnknownEntity, lookupLearnedName, lookupLearnedDiagnosis, lookupLearnedMedication } from './ocrLearner.js';
import { disambiguate, inferAcuity, extractStructuredData, predictMissingFields, normalizeText, validateAgeDiagnosis } from './ocrBrain.js';

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
  ['1', 'I', 'L', '|', '!', 'l'],
  ['2', 'Z'],
  ['5', 'S', '$'],
  ['6', 'G'],
  ['7', 'T'],
  ['8', 'B'],
  ['f', 't'],       // handwritten confusion
  ['rn', 'm'],      // ligature confusion: "burn" → "bum"
  ['cl', 'd'],      // ligature confusion
];
const OCR_CONFUSION_CANONICAL = Object.fromEntries(
  OCR_CONFUSION_GROUPS.flatMap(group => group.map(char => [char, group[0]]))
);
const HEADER_PATTERNS = [
  /^(name|patient|pt|bed|room|rm|age|sex|gender|dob|diagnosis|diag|dx|meds?|medications?|allerg(?:y|ies)|code|status|ward|location|notes?|id|mrn|mobil(?:ity)?|transport|blood\s*(?:type|group)|bt|bg|rh|consultant|doctor|attending|nurse|rn|diet|activity|iv|plan|tasks?|jobs?|adm\s*date|d\/?c\s*date|edd|day\s*#?|hosp\s*no|file\s*no|nationality|acuity|chief\s*complaint|cc|disposition|dispo|los|labs?|vitals?|i\s*&?\s*o)$/i,
  /^(اسم|المريض|سرير|غرفة|العمر|الجنس|التشخيص|أدوية|ادوية|حساسية|الحالة|الرقم|ملاحظات|الطبيب|المعالج|الاستشاري|التمريض|الممرضة|النظام الغذائي|الخطة|الحركة|فصيلة الدم|العلامات الحيوية|تاريخ الدخول|تاريخ الخروج|الجنسية|رقم الملف)$/i,
];

const HEADER_ROLE_PATTERNS = [
  {
    role: 'BED',
    patterns: [
      /^(?:bed|room|rm)(?:\s*(?:no|#))?$/i,
      /^(?:bed|room|ward)\s*\/\s*(?:bed|room|ward)$/i,
      /^(?:room|bed)(?:\s*(?:no|#))?\s*\/\s*(?:ward|unit|location)$/i,
      /^(?:ward|unit|location)\s*\/\s*(?:room|bed)(?:\s*(?:no|#))?$/i,
      /^(?:\u0633\u0631\u064A\u0631|\u063A\u0631\u0641\u0629)(?:\s*(?:\u0631\u0642\u0645|#))?$/i,
    ],
  },
  {
    role: 'NAME',
    patterns: [
      /^(?:(?:patient|pt)\s*)?name(?:s)?$/i,
      /^(?:full\s*name)$/i,
      /^(?:\u0627\u0633\u0645|\u0627\u0633\u0645\s*\u0627\u0644\u0645\u0631\u064A\u0636|\u0627\u0644\u0645\u0631\u064A\u0636)$/i,
    ],
  },
  {
    role: 'AGE_GENDER',
    patterns: [
      /^(?:age|sex|gender)(?:\s*[/&-]\s*(?:age|sex|gender))*$/i,
      /^(?:age\s*sex|sex\s*age)$/i,
      /^(?:\u0627\u0644\u0639\u0645\u0631|\u0627\u0644\u062C\u0646\u0633)(?:\s*\/\s*(?:\u0627\u0644\u0639\u0645\u0631|\u0627\u0644\u062C\u0646\u0633))*$/i,
    ],
  },
  {
    role: 'DIAGNOSIS',
    patterns: [
      /^(?:diagnos(?:is|es)|diag|dx|impression|problem(?:s)?|condition)$/i,
      /^(?:\u0627\u0644\u062A\u0634\u062E\u064A\u0635|\u0627\u0646\u0637\u0628\u0627\u0639|\u0645\u0634\u0643\u0644\u0629|\u0627\u0644\u062D\u0627\u0644\u0629)$/i,
    ],
  },
  {
    role: 'MEDICATION',
    patterns: [
      /^(?:med(?:ication)?s?|drugs?|rx|treatment)$/i,
      /^(?:\u0627\u062F\u0648\u064A\u0629|\u0623\u062F\u0648\u064A\u0629|\u0639\u0644\u0627\u062C)$/i,
    ],
  },
  {
    role: 'ALLERGY',
    patterns: [
      /^(?:allerg(?:y|ies)|allergy\s*status)$/i,
      /^(?:\u062D\u0633\u0627\u0633\u064A\u0629)$/i,
    ],
  },
  {
    role: 'STATUS',
    patterns: [
      /^(?:code(?:\s*status)?)$/i,
      /^(?:\u0627\u0644\u062D\u0627\u0644\u0629|\u062D\u0627\u0644\u0629\s*\u0627\u0644\u0625\u0646\u0639\u0627\u0634)$/i,
    ],
  },
  {
    role: 'ASSIGNED_DOCTOR',
    patterns: [
      /^(?:assigned\s*doctor|doctor|dr|consultant|team)$/i,
      /^(?:\u0627\u0644\u0637\u0628\u064A\u0628|\u0627\u0644\u062F\u0643\u062A\u0648\u0631|\u0627\u0644\u0645\u0633\u0624\u0648\u0644)$/i,
    ],
  },
  {
    role: 'SHEET_STATUS',
    patterns: [
      /^(?:status|list\s*status|disposition|category)$/i,
      /^(?:\u0627\u0644\u062D\u0627\u0644\u0629\s*\u0627\u0644\u0639\u0627\u0645\u0629|\u0627\u0644\u0641\u0626\u0629|\u0627\u0644\u062A\u0635\u0646\u064A\u0641)$/i,
    ],
  },
  {
    role: 'WARD',
    patterns: [
      /^(?:ward|unit|location|area)$/i,
      /^(?:\u062C\u0646\u0627\u062D|\u0648\u062D\u062F\u0629|\u0645\u0648\u0642\u0639|\u0642\u0633\u0645)$/i,
    ],
  },
  {
    role: 'CIVIL_ID',
    patterns: [
      /^(?:id|mrn|civil\s*id|record\s*(?:id|no)|file\s*(?:id|no))$/i,
      /^(?:\u0627\u0644\u0631\u0642\u0645|\u0631\u0642\u0645\s*\u0645\u0644\u0641|\u0631\u0642\u0645\s*\u0645\u062F\u0646\u064A)$/i,
    ],
  },
  {
    role: 'O2',
    patterns: [
      /^(?:o2|oxygen|resp(?:iratory)?\s*support|airway)$/i,
      /^(?:\u0623\u0643\u0633\u062C\u064A\u0646|\u062A\u0646\u0641\u0633|\u062F\u0639\u0645\s*\u062A\u0646\u0641\u0633\u064A)$/i,
    ],
  },
  {
    role: 'ISOLATION',
    patterns: [
      /^(?:iso|isolation|precautions?)$/i,
      /^(?:\u0639\u0632\u0644|\u0627\u062D\u062A\u064A\u0627\u0637\u0627\u062A)$/i,
    ],
  },
  {
    role: 'MOBILITY',
    patterns: [
      /^(?:mobil(?:ity)?|transport|ambul(?:ation|atory)?|w\/?c)$/i,
    ],
  },
  {
    role: 'BLOOD_TYPE',
    patterns: [
      /^(?:blood\s*(?:type|group)|bt|bg|rh)$/i,
      /^(?:\u0641\u0635\u064A\u0644\u0629\s*\u0627\u0644\u062F\u0645)$/i,
    ],
  },
];
const GENERIC_SHEET_HEADER_PATTERNS = [
  /^(?:patient|ward|bed|room)\s+(?:list|sheet|board|census)$/i,
  /^(?:evac(?:uation)?|transfer|handover|admission|discharge)\s+(?:list|sheet)$/i,
  /^(?:ward\s+transfer|ward\s+round|transfer)\s+(?:sheet|list|board|census)$/i,
  /^(?:daily|morning|evening)\s+(?:sheet|board|list)$/i,
  /^(?:morning|afternoon|evening)\s+census$/i,
  /^(?:male|female)\s+list(?:\s+(?:active|inactive|chronic|new|pending))?$/i,
  /^(?:male|female|active|chronic)\s+list(?:\s*\([^)]*\))?$/i,
  /^(?:\u0642\u0627\u0626\u0645\u0629|\u0646\u0645\u0648\u0630\u062C|\u0643\u0634\u0641)\s+(?:\u0627\u0644\u0645\u0631\u0636\u0649|\u0627\u0644\u0627\u062E\u0644\u0627\u0621|\u0627\u0644\u062C\u0646\u0627\u062D)$/i,
  // Progress note / SOAP section headers
  /^(?:subjective|objective|assessment(?:\s+(?:and|&)\s+plan)?|plan|impression|recommendations?|interval\s+history|progress\s+note|clinical\s+note|history\s+of\s+present\s+illness|hpi|pmh|psh|ros|review\s+of\s+systems|physical\s+exam|medications|social\s+history|family\s+history|allergies|chief\s+complaint|cc|discharge\s+summary|op\s+note|procedure\s+note)$/i,
  // Nursing assessment headers
  /^(?:nursing\s+(?:assessment|notes?|plan|diagnosis|interventions?|evaluation)|shift\s+report|handover|handoff|vital\s+signs?|i\s*&?\s*o|intake\s*&?\s*output|pain\s+assessment|fall\s+risk|braden\s+score|skin\s+assessment|neuro\s+checks?)$/i,
];

function normalizeSheetLabel(text) {
  return `${text || ''}`
    .trim()
    .replace(/[_:]+/g, ' ')
    .replace(/[|]+/g, '/')
    .replace(/[()]+/g, ' ')
    .replace(/\bnumber\b/gi, 'no')
    .replace(/\s*[/\\]\s*/g, '/')
    .replace(/\s+/g, ' ')
    .replace(/[:\\-]+$/g, '')
    .trim();
}

function detectHeaderRole(text) {
  const cleaned = normalizeSheetLabel(text);
  if (!cleaned) return null;

  for (const entry of HEADER_ROLE_PATTERNS) {
    if (entry.patterns.some(pattern => pattern.test(cleaned))) return entry.role;
  }

  return null;
}

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
  const cleaned = normalizeSheetLabel(text);
  if (!cleaned) return false;
  return !!detectHeaderRole(cleaned) || GENERIC_SHEET_HEADER_PATTERNS.some(pattern => pattern.test(cleaned));
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
  assignedDoctor: 'assignedDoctor',
  sheetStatus: 'sheetStatus',
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
    case 'sheetStatus':
    case 'o2':
    case 'iso':
    case 'suggestedTriage':
    case 'suggestedMobility':
      return text.toUpperCase();
    case 'dx':
    case 'meds':
    case 'allergies':
    case 'assignedDoctor':
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
    case 'sheetStatus':
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
    'allergies', 'code', 'assignedDoctor', 'sheetStatus', 'ward', 'o2', 'iso',
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
    assignedDoctor: scalarConsensus.assignedDoctor.value,
    sheetStatus: scalarConsensus.sheetStatus.value,
    ward: scalarConsensus.ward.value,
    o2: scalarConsensus.o2.value,
    iso: scalarConsensus.iso.value,
    suggestedTriage: scalarConsensus.suggestedTriage.value,
    suggestedMobility: scalarConsensus.suggestedMobility.value,
    warnings: dedupeWarnings(patients.flatMap(patient => patient.warnings || [])),
    fieldConfidence,
    rawEntityCount: patients.reduce((sum, patient) => sum + (patient.rawEntityCount || 0), 0),
    structuredConfidence: average(patients.map(patient => patient.structuredConfidence), 0),
    structureRoles: [...new Set(patients.flatMap(patient => patient.structureRoles || []))],
    sheetContextCount: Math.max(...patients.map(patient => patient.sheetContextCount || 0), 0),
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
      { value: fieldConfidence.assignedDoctor, weight: 0.35 },
      { value: fieldConfidence.sheetStatus, weight: 0.25 },
      { value: fieldConfidence.o2, weight: 0.5 },
      { value: fieldConfidence.iso, weight: 0.5 },
      { value: merged.structuredConfidence, weight: 1.2 },
  ], baseConfidence) + ((Math.min(patients.length, 4) - 1) * 0.02));

  const reviewLevel = patients.reduce((current, patient) => (
    (REVIEW_PRIORITY[patient.reviewLevel] ?? 0) > (REVIEW_PRIORITY[current] ?? 0)
      ? patient.reviewLevel
      : current
  ), 'READY');
  merged.reviewLevel = reviewLevel;

  if (!merged.fullName && !merged.bed && !merged.dx && !merged.civilId && merged.age == null) return null;
  return merged;
}

function scoreTextDensity(rawText) {
  const compact = `${rawText || ''}`.replace(/\s+/g, '');
  if (!compact) return 0;
  const useful = (compact.match(/[A-Za-z0-9\u0600-\u06FF]/g) || []).length;
  return clamp(useful / compact.length);
}

function isSparseStructuredRosterPatient(patient) {
  const structuredSupportCount =
    Number(Boolean(patient?.assignedDoctor)) +
    Number(Boolean(patient?.sheetStatus)) +
    Number(Boolean(patient?.ward));

  return Boolean(
    patient?.fullName &&
    patient?.dx &&
    structuredSupportCount >= 1 &&
    !patient?.bed &&
    patient?.age == null &&
    !patient?.gender &&
    !patient?.civilId &&
    (patient?.rawEntityCount || 0) >= 3 &&
    (patient?.fieldConfidence?.fullName || 0) >= 0.72 &&
    (patient?.fieldConfidence?.dx || 0) >= 0.72 &&
    (patient?.structuredConfidence || 0) >= 0.72
  );
}

function enrichPatientForReview(patient) {
  const identifierCount = (patient.fullName ? 1 : 0) + (patient.bed ? 1 : 0) + ((patient.age != null || patient.gender) ? 1 : 0) + (patient.civilId ? 1 : 0);
  const sparseStructuredRoster = isSparseStructuredRosterPatient(patient);
  const structuredIdentity = Boolean(
    patient.fullName &&
    patient.dx &&
    (
      sparseStructuredRoster ||
      (patient.structuredConfidence || 0) >= 0.72 ||
      patient.assignedDoctor ||
      patient.sheetStatus ||
      patient.ward
    )
  );
  let effectiveIdentifierCount = structuredIdentity && identifierCount < 2 ? identifierCount + 1 : identifierCount;
  if (sparseStructuredRoster && effectiveIdentifierCount < 3) effectiveIdentifierCount += 1;
  const severeWarning = (patient.warnings || []).some(w => ['ERROR', 'CLINICAL_ALERT'].includes(w.severity));
  const reasons = [];

  if (effectiveIdentifierCount < 2) reasons.push('Partial identifiers captured');
  if (patient.fullName && (patient.fieldConfidence?.fullName || 0) < 0.6) reasons.push('Name needs confirmation');
  if (patient.bed && (patient.fieldConfidence?.bed || 0) < 0.65) reasons.push('Bed needs confirmation');
  if (!sparseStructuredRoster && (patient.rawEntityCount || 0) <= 2 && (patient.structuredConfidence || 0) < 0.72) reasons.push('Sparse OCR evidence');
  if (!sparseStructuredRoster && (patient.confidence || 0) < 0.62 && (patient.structuredConfidence || 0) < 0.72) reasons.push('Low OCR confidence');
  if (severeWarning) reasons.push('Clinical cross-check flagged this record');

  const readyThreshold = sparseStructuredRoster ? 0.68 : (structuredIdentity ? 0.74 : 0.8);
  let reviewLevel = 'READY';
  if (severeWarning || ((patient.confidence || 0) < 0.52 && (patient.structuredConfidence || 0) < 0.72) || effectiveIdentifierCount === 0) reviewLevel = 'VERIFY';
  else if (reasons.length > 0 || (patient.warnings || []).length > 0 || (patient.confidence || 0) < readyThreshold) reviewLevel = 'REVIEW';

  patient.identifierCount = effectiveIdentifierCount;
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
    'STROKE': { category: 'neuro', severity: 'RED' },
    'ISCHEMIC STROKE': { category: 'neuro', severity: 'RED' },
    'HEMORRHAGIC STROKE': { category: 'neuro', severity: 'RED' },
    'SAH': { category: 'neuro', severity: 'RED' }, 'ICH': { category: 'neuro', severity: 'RED' },
    'SDH': { category: 'neuro', severity: 'RED' }, 'EDH': { category: 'neuro', severity: 'RED' },
    'SE': { category: 'neuro', severity: 'RED' }, 'GBS': { category: 'neuro', severity: 'RED' },
    'MG': { category: 'neuro', severity: 'YELLOW' }, 'MS': { category: 'neuro', severity: 'YELLOW' },
    'MENINGITIS': { category: 'neuro', severity: 'RED' }, 'ENCEPHALITIS': { category: 'neuro', severity: 'RED' },
    'EPILEPSY': { category: 'neuro', severity: 'GREEN' }, 'SEIZURE': { category: 'neuro', severity: 'YELLOW' },
    'MCA': { category: 'neuro', severity: 'RED' }, 'ACA': { category: 'neuro', severity: 'RED' },
    'MCA OCCLUSION': { category: 'neuro', severity: 'RED' },
    'LEFT MCA OCCLUSION': { category: 'neuro', severity: 'RED' },
    'RIGHT MCA OCCLUSION': { category: 'neuro', severity: 'RED' },
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
    'BILIARY CHOLECYSTITIS': { category: 'gi', severity: 'YELLOW' },
    'BILIARY COLIC': { category: 'gi', severity: 'YELLOW' },
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
    // Common multi-word diagnoses (appear as phrases on ward sheets)
    'CHEST INFECTION': { category: 'resp', severity: 'YELLOW' },
    'LOWER RESPIRATORY TRACT INFECTION': { category: 'resp', severity: 'YELLOW' },
    'UPPER RESPIRATORY TRACT INFECTION': { category: 'resp', severity: 'GREEN' },
    'URINARY TRACT INFECTION': { category: 'infect', severity: 'GREEN' },
    'ACUTE CORONARY SYNDROME': { category: 'cardio', severity: 'RED' },
    'HEART FAILURE': { category: 'cardio', severity: 'YELLOW' },
    'ATRIAL FIBRILLATION': { category: 'cardio', severity: 'YELLOW' },
    'PULMONARY EMBOLISM': { category: 'resp', severity: 'RED' },
    'DEEP VEIN THROMBOSIS': { category: 'cardio', severity: 'YELLOW' },
    'CEREBROVASCULAR ACCIDENT': { category: 'neuro', severity: 'RED' },
    'ACUTE KIDNEY INJURY': { category: 'renal', severity: 'RED' },
    'CHRONIC KIDNEY DISEASE': { category: 'renal', severity: 'GREEN' },
    'DIABETIC KETOACIDOSIS': { category: 'endo', severity: 'RED' },
    'SEPTIC SHOCK': { category: 'infect', severity: 'RED' },
    'RESPIRATORY FAILURE': { category: 'resp', severity: 'RED' },
    'GI BLEED': { category: 'gi', severity: 'RED' },
    'GI BLEEDING': { category: 'gi', severity: 'RED' },
    'UPPER GI BLEED': { category: 'gi', severity: 'RED' },
    'LOWER GI BLEED': { category: 'gi', severity: 'YELLOW' },
    'LIVER CIRRHOSIS': { category: 'gi', severity: 'YELLOW' },
    'HEPATIC ENCEPHALOPATHY': { category: 'gi', severity: 'YELLOW' },
    'ACUTE PANCREATITIS': { category: 'gi', severity: 'YELLOW' },
    'BOWEL OBSTRUCTION': { category: 'gi', severity: 'YELLOW' },
    'SMALL BOWEL OBSTRUCTION': { category: 'gi', severity: 'YELLOW' },
    'LARGE BOWEL OBSTRUCTION': { category: 'gi', severity: 'YELLOW' },
    'COMMUNITY ACQUIRED PNEUMONIA': { category: 'resp', severity: 'YELLOW' },
    'HOSPITAL ACQUIRED PNEUMONIA': { category: 'resp', severity: 'YELLOW' },
    'ASPIRATION PNEUMONIA': { category: 'resp', severity: 'YELLOW' },
    'LVF EXACERBATION': { category: 'cardio', severity: 'RED' },
    'LVF': { category: 'cardio', severity: 'YELLOW' },
    'RVF': { category: 'cardio', severity: 'YELLOW' },
    'UROSEPSIS': { category: 'infect', severity: 'RED' },
    'BILIARY SEPSIS': { category: 'infect', severity: 'RED' },
    'WOUND INFECTION': { category: 'infect', severity: 'YELLOW' },
    'DIABETIC FOOT': { category: 'infect', severity: 'YELLOW' },
    'PRESSURE ULCER': { category: 'surg', severity: 'GREEN' },
    'FALL': { category: 'ortho', severity: 'YELLOW' },
    'HIP FRACTURE': { category: 'ortho', severity: 'YELLOW' },
    'NECK OF FEMUR': { category: 'ortho', severity: 'YELLOW' },
    'HYPERNATREMIA': { category: 'renal', severity: 'YELLOW' },
    'HYPONATREMIA': { category: 'renal', severity: 'YELLOW' },
    'HYPERKALEMIA': { category: 'renal', severity: 'RED' },
    'HYPOKALEMIA': { category: 'renal', severity: 'YELLOW' },
    'HYPERCALCEMIA': { category: 'renal', severity: 'YELLOW' },
    'HYPOCALCEMIA': { category: 'renal', severity: 'YELLOW' },
    'METABOLIC ACIDOSIS': { category: 'renal', severity: 'YELLOW' },
    'LACTIC ACIDOSIS': { category: 'renal', severity: 'RED' },
    'HYPERTENSIVE CRISIS': { category: 'cardio', severity: 'RED' },
    'MALIGNANT HTN': { category: 'cardio', severity: 'RED' },
    'CLD': { category: 'gi', severity: 'YELLOW' },
    'NAFLD': { category: 'gi', severity: 'GREEN' },
    'NASH': { category: 'gi', severity: 'YELLOW' },
    'PORTAL HTN': { category: 'gi', severity: 'YELLOW' },
    'HEPATORENAL': { category: 'gi', severity: 'RED' },
    'FAILURE TO THRIVE': { category: 'status', severity: 'GREEN' },
    'FTT': { category: 'status', severity: 'GREEN' },
    'WEIGHT LOSS': { category: 'status', severity: 'GREEN' },
    'SOCIAL ADMISSION': { category: 'status', severity: 'GREEN' },
    // Missing common diagnoses found by audit
    'FEVER': { category: 'infect', severity: 'YELLOW' },
    'PYREXIA': { category: 'infect', severity: 'YELLOW' },
    'PUO': { category: 'infect', severity: 'YELLOW' },
    'FUO': { category: 'infect', severity: 'YELLOW' },
    'MYALGIA': { category: 'ortho', severity: 'GREEN' },
    'ARTHRALGIA': { category: 'ortho', severity: 'GREEN' },
    'FRACTURE': { category: 'ortho', severity: 'YELLOW' },
    'DISLOCATION': { category: 'ortho', severity: 'YELLOW' },
    'CRUSH INJURY': { category: 'ortho', severity: 'RED' },
    'SPRAIN': { category: 'ortho', severity: 'GREEN' },
    'CONCUSSION': { category: 'neuro', severity: 'YELLOW' },
    'HEAD INJURY': { category: 'neuro', severity: 'YELLOW' },
    'SPINAL CORD INJURY': { category: 'neuro', severity: 'RED' },
    'BRONCHITIS': { category: 'resp', severity: 'GREEN' },
    'ACUTE BRONCHITIS': { category: 'resp', severity: 'GREEN' },
    'PNEUMONIA': { category: 'resp', severity: 'YELLOW' },
    'PLEURAL EFFUSION': { category: 'resp', severity: 'YELLOW' },
    'DYSPNEA': { category: 'resp', severity: 'YELLOW' },
    'HEMATEMESIS': { category: 'gi', severity: 'RED' },
    'MELENA': { category: 'gi', severity: 'RED' },
    'HEMATOCHEZIA': { category: 'gi', severity: 'YELLOW' },
    'JAUNDICE': { category: 'gi', severity: 'YELLOW' },
    'HEPATITIS': { category: 'gi', severity: 'YELLOW' },
    'GASTROENTERITIS': { category: 'gi', severity: 'GREEN' },
    'DIARRHEA': { category: 'gi', severity: 'GREEN' },
    'CONSTIPATION': { category: 'gi', severity: 'GREEN' },
    'NAUSEA': { category: 'gi', severity: 'GREEN' },
    'VOMITING': { category: 'gi', severity: 'GREEN' },
    'ABDOMINAL PAIN': { category: 'gi', severity: 'YELLOW' },
    'CHEST PAIN': { category: 'cardio', severity: 'YELLOW' },
    'SYNCOPE': { category: 'neuro', severity: 'YELLOW' },
    'VERTIGO': { category: 'neuro', severity: 'GREEN' },
    'HEADACHE': { category: 'neuro', severity: 'GREEN' },
    'MIGRAINE': { category: 'neuro', severity: 'GREEN' },
    'ALTERED MENTAL STATUS': { category: 'neuro', severity: 'RED' },
    'AMS': { category: 'neuro', severity: 'RED' },
    'LOC': { category: 'neuro', severity: 'RED' },
    'HEMATURIA': { category: 'renal', severity: 'YELLOW' },
    'RENAL COLIC': { category: 'renal', severity: 'YELLOW' },
    'NEPHROLITHIASIS': { category: 'renal', severity: 'YELLOW' },
    'PYELONEPHRITIS': { category: 'infect', severity: 'YELLOW' },
    'PERITONITIS': { category: 'gi', severity: 'RED' },
    'ANAPHYLAXIS': { category: 'infect', severity: 'RED' },
    'ANGIOEDEMA': { category: 'infect', severity: 'RED' },
    'BURNS': { category: 'surg', severity: 'YELLOW' },
    'SMOKE INHALATION': { category: 'resp', severity: 'RED' },
    'HYPOTHERMIA': { category: 'status', severity: 'YELLOW' },
    'HYPERTHERMIA': { category: 'status', severity: 'YELLOW' },
    'DEHYDRATION': { category: 'renal', severity: 'YELLOW' },
    'MALNUTRITION': { category: 'status', severity: 'GREEN' },
    'OBESITY': { category: 'endo', severity: 'GREEN' },
    'GOUT': { category: 'ortho', severity: 'GREEN' },
    'RHABDOMYOLYSIS': { category: 'renal', severity: 'RED' },
    'POLYTRAUMA': { category: 'surg', severity: 'RED' },
    'BLAST INJURY': { category: 'surg', severity: 'RED' },
    // Surgical procedures (common on ward lists as post-op diagnoses)
    'ORIF': { category: 'surg', severity: 'YELLOW' },
    'LAP CHOLE': { category: 'surg', severity: 'GREEN' }, 'CHOLECYSTECTOMY': { category: 'surg', severity: 'GREEN' },
    'LAPAROTOMY': { category: 'surg', severity: 'YELLOW' },
    'COLECTOMY': { category: 'surg', severity: 'YELLOW' }, 'HEMICOLECTOMY': { category: 'surg', severity: 'YELLOW' },
    'TURP': { category: 'surg', severity: 'GREEN' }, 'TURBT': { category: 'surg', severity: 'GREEN' },
    'TAH': { category: 'surg', severity: 'YELLOW' }, 'HYSTERECTOMY': { category: 'surg', severity: 'YELLOW' },
    'MASTECTOMY': { category: 'surg', severity: 'YELLOW' }, 'LUMPECTOMY': { category: 'surg', severity: 'GREEN' },
    'CRANIOTOMY': { category: 'surg', severity: 'RED' }, 'CRANIECTOMY': { category: 'surg', severity: 'RED' },
    'TRACHEOSTOMY': { category: 'surg', severity: 'YELLOW' },
    'FASCIOTOMY': { category: 'surg', severity: 'YELLOW' }, 'DEBRIDEMENT': { category: 'surg', severity: 'YELLOW' },
    'SKIN GRAFT': { category: 'surg', severity: 'GREEN' }, 'AMPUTATION': { category: 'surg', severity: 'RED' },
    'NEPHRECTOMY': { category: 'surg', severity: 'YELLOW' }, 'CYSTECTOMY': { category: 'surg', severity: 'YELLOW' },
    'GASTRECTOMY': { category: 'surg', severity: 'YELLOW' }, 'WHIPPLE': { category: 'surg', severity: 'RED' },
    'SPLENECTOMY': { category: 'surg', severity: 'YELLOW' },
    'THYROIDECTOMY': { category: 'surg', severity: 'GREEN' }, 'PARATHYROIDECTOMY': { category: 'surg', severity: 'GREEN' },
    'LAMINECTOMY': { category: 'surg', severity: 'YELLOW' }, 'DISCECTOMY': { category: 'surg', severity: 'YELLOW' },
    'FUSION': { category: 'surg', severity: 'YELLOW' }, 'SPINAL FUSION': { category: 'surg', severity: 'YELLOW' },
    'EGD': { category: 'surg', severity: 'GREEN' }, 'COLONOSCOPY': { category: 'surg', severity: 'GREEN' },
    'BRONCHOSCOPY': { category: 'surg', severity: 'GREEN' }, 'CYSTOSCOPY': { category: 'surg', severity: 'GREEN' },
    // Neonatal / Pediatric
    'NEC': { category: 'peds', severity: 'RED' }, 'RDS': { category: 'peds', severity: 'RED' },
    'BPD': { category: 'peds', severity: 'YELLOW' }, 'PDA': { category: 'peds', severity: 'YELLOW' },
    'IUGR': { category: 'peds', severity: 'YELLOW' }, 'SGA': { category: 'peds', severity: 'GREEN' },
    'LGA': { category: 'peds', severity: 'GREEN' }, 'AGA': { category: 'peds', severity: 'GREEN' },
    'HIE': { category: 'peds', severity: 'RED' }, 'IVH': { category: 'peds', severity: 'RED' },
    'ROP': { category: 'peds', severity: 'YELLOW' }, 'NEONATAL SEPSIS': { category: 'peds', severity: 'RED' },
    'PHOTOTHERAPY': { category: 'peds', severity: 'GREEN' },
    'APNEA': { category: 'peds', severity: 'YELLOW' }, 'BRADYCARDIA': { category: 'peds', severity: 'YELLOW' },
    'TACHYCARDIA': { category: 'cardio', severity: 'YELLOW' },
    'CROUP': { category: 'peds', severity: 'YELLOW' }, 'BRONCHIOLITIS': { category: 'peds', severity: 'YELLOW' },
    'KAWASAKI': { category: 'peds', severity: 'YELLOW' }, 'INTUSSUSCEPTION': { category: 'peds', severity: 'RED' },
    'PYLORIC STENOSIS': { category: 'peds', severity: 'YELLOW' },
    'FEBRILE SEIZURE': { category: 'peds', severity: 'YELLOW' },
    // Dermatology / Skin
    'BCC': { category: 'derm', severity: 'YELLOW' }, 'SCC': { category: 'derm', severity: 'YELLOW' },
    'MELANOMA': { category: 'derm', severity: 'RED' }, 'PSORIASIS': { category: 'derm', severity: 'GREEN' },
    'ECZEMA': { category: 'derm', severity: 'GREEN' }, 'DERMATITIS': { category: 'derm', severity: 'GREEN' },
    'URTICARIA': { category: 'derm', severity: 'GREEN' }, 'PEMPHIGUS': { category: 'derm', severity: 'YELLOW' },
    'ERYSIPELAS': { category: 'derm', severity: 'YELLOW' }, 'NECROTIZING FASCIITIS': { category: 'derm', severity: 'RED' },
    'STEVENS JOHNSON': { category: 'derm', severity: 'RED' }, 'SJS': { category: 'derm', severity: 'RED' },
    'TEN': { category: 'derm', severity: 'RED' }, 'TOXIC EPIDERMAL NECROLYSIS': { category: 'derm', severity: 'RED' },
    // Ophthalmology
    'GLAUCOMA': { category: 'eye', severity: 'YELLOW' }, 'CATARACT': { category: 'eye', severity: 'GREEN' },
    'RETINAL DETACHMENT': { category: 'eye', severity: 'RED' },
    'ORBITAL CELLULITIS': { category: 'eye', severity: 'RED' },
    'ENDOPHTHALMITIS': { category: 'eye', severity: 'RED' },
    // ENT
    'TONSILLITIS': { category: 'ent', severity: 'GREEN' }, 'PERITONSILLAR ABSCESS': { category: 'ent', severity: 'YELLOW' },
    'EPISTAXIS': { category: 'ent', severity: 'YELLOW' }, 'SINUSITIS': { category: 'ent', severity: 'GREEN' },
    'MASTOIDITIS': { category: 'ent', severity: 'YELLOW' }, 'OTITIS MEDIA': { category: 'ent', severity: 'GREEN' },
    'OTITIS EXTERNA': { category: 'ent', severity: 'GREEN' },
    'LUDWIG ANGINA': { category: 'ent', severity: 'RED' },
    // Urology
    'URINARY RETENTION': { category: 'urol', severity: 'YELLOW' },
    'BPH': { category: 'urol', severity: 'GREEN' }, 'PROSTATITIS': { category: 'urol', severity: 'YELLOW' },
    'TESTICULAR TORSION': { category: 'urol', severity: 'RED' },
    'HYDRONEPHROSIS': { category: 'urol', severity: 'YELLOW' },
    'RENAL CALCULUS': { category: 'urol', severity: 'YELLOW' },
    // Gynecology / Obstetrics
    'PLACENTA PREVIA': { category: 'obs', severity: 'RED' }, 'PLACENTAL ABRUPTION': { category: 'obs', severity: 'RED' },
    'OVARIAN TORSION': { category: 'obs', severity: 'RED' }, 'PID': { category: 'obs', severity: 'YELLOW' },
    'MISCARRIAGE': { category: 'obs', severity: 'YELLOW' }, 'ABORTION': { category: 'obs', severity: 'YELLOW' },
    'HYPEREMESIS': { category: 'obs', severity: 'YELLOW' }, 'GDM': { category: 'obs', severity: 'GREEN' },
    // Radiology / Imaging orders (prevent name false positives)
    'CTPA': { category: 'invest' }, 'CTAB': { category: 'invest' }, 'CTA': { category: 'invest' },
    'MRCP': { category: 'invest' }, 'MRA': { category: 'invest' }, 'MRV': { category: 'invest' },
    'AXR': { category: 'invest' }, 'KUB': { category: 'invest' }, 'IVP': { category: 'invest' },
    'ECHO': { category: 'invest' }, 'TEE': { category: 'invest' }, 'TTE': { category: 'invest' },
    'PET': { category: 'invest' }, 'DEXA': { category: 'invest' }, 'V/Q': { category: 'invest' },
    'PIGTAIL': { category: 'invest' }, 'ANGIO': { category: 'invest' },
    // Additional lab tests
    'D-DIMER': { category: 'invest' }, 'PROCALCITONIN': { category: 'invest' }, 'PCT': { category: 'invest' },
    'LACTATE': { category: 'invest' }, 'AMMONIA': { category: 'invest' },
    'FERRITIN': { category: 'invest' }, 'FIBRINOGEN': { category: 'invest' },
    'LDH': { category: 'invest' }, 'LIPASE': { category: 'invest' }, 'AMYLASE': { category: 'invest' },
    'URINE CS': { category: 'invest' }, 'BLOOD CS': { category: 'invest' },
    'SPUTUM CS': { category: 'invest' }, 'WOUND CS': { category: 'invest' },
    'HCG': { category: 'invest' }, 'AFP': { category: 'invest' }, 'CEA': { category: 'invest' },
    'CA125': { category: 'invest' }, 'CA199': { category: 'invest' },
    // Clinical shorthand (prevent misclassification as names)
    'SOB': { category: 'resp', severity: 'YELLOW' }, 'DOE': { category: 'resp', severity: 'YELLOW' },
    'CP': { category: 'cardio', severity: 'YELLOW' },
    'URI': { category: 'resp', severity: 'GREEN' }, 'URTI': { category: 'resp', severity: 'GREEN' },
    'GCS': { category: 'neuro' },
    'PMH': { category: 'status' }, 'PSH': { category: 'status' },
    'ROS': { category: 'status' }, 'HPI': { category: 'status' },
    'WNL': { category: 'status' }, 'NAD': { category: 'status' },
    'VSS': { category: 'status' }, 'AVSS': { category: 'status' },
    'DDX': { category: 'status' },
    // Ward round abbreviations (from research — prevent these from being classified as names)
    'CXR': { category: 'invest' }, 'ABG': { category: 'invest' }, 'VBG': { category: 'invest' },
    'ECG': { category: 'invest' }, 'EKG': { category: 'invest' },
    'FBC': { category: 'invest' }, 'CBC': { category: 'invest' },
    'LFT': { category: 'invest' }, 'TFT': { category: 'invest' },
    'RFT': { category: 'invest' }, 'KFT': { category: 'invest' },
    'CT': { category: 'invest' }, 'MRI': { category: 'invest' },
    'USS': { category: 'invest' }, 'XR': { category: 'invest' },
    'LP': { category: 'invest' }, 'EEG': { category: 'invest' },
    'EMG': { category: 'invest' }, 'NCS': { category: 'invest' },
    'BNP': { category: 'invest' }, 'TROPONIN': { category: 'invest' },
    'HBA1C': { category: 'invest' }, 'INR': { category: 'invest' },
    'PT': { category: 'invest' }, 'APTT': { category: 'invest' },
    'ESR': { category: 'invest' }, 'CRP': { category: 'invest' },
    'TSH': { category: 'invest' }, 'T3': { category: 'invest' }, 'T4': { category: 'invest' },
    'PSA': { category: 'invest' },
    // Physical exam / progress note abbreviations (prevent misclassification)
    'HEENT': { category: 'exam' }, 'PERRL': { category: 'exam' }, 'PERRLA': { category: 'exam' },
    'EOMI': { category: 'exam' }, 'RRR': { category: 'exam' }, 'S1S2': { category: 'exam' }, 'HSM': { category: 'exam' },
    'JVP': { category: 'exam' }, 'CVS': { category: 'exam' }, 'CNS': { category: 'exam' },
    'MSK': { category: 'exam' }, 'GIT': { category: 'exam' }, 'GUS': { category: 'exam' },
    'NCAT': { category: 'exam' }, 'WNWD': { category: 'exam' },
    'SILT': { category: 'exam' }, 'DTR': { category: 'exam' },
    // SOAP note section headers
    'SUBJECTIVE': { category: 'note' }, 'OBJECTIVE': { category: 'note' },
    'ASSESSMENT': { category: 'note' }, 'PLAN': { category: 'note' },
    'IMPRESSION': { category: 'note' }, 'RECOMMENDATIONS': { category: 'note' },
    'SUMMARY': { category: 'note' }, 'PROGRESS': { category: 'note' },
    'INTERVAL': { category: 'note' }, 'HISTORY': { category: 'note' },
    // Vital sign labels
    'HR': { category: 'vitals' }, 'BP': { category: 'vitals' }, 'RR': { category: 'vitals' },
    'SPO2': { category: 'vitals' }, 'TEMP': { category: 'vitals' }, 'SATS': { category: 'vitals' },
    'MAP': { category: 'vitals' }, 'CVP': { category: 'vitals' }, 'ICP': { category: 'vitals' },
    // Dosing routes and frequencies — only longer ones that won't fuzzy-match common words
    'INFUSION': { category: 'route' }, 'NEBULIZER': { category: 'route' },
    'TOPICAL': { category: 'route' }, 'SUBLINGUAL': { category: 'route' },
    'INTRAMUSCULAR': { category: 'route' }, 'INTRAVENOUS': { category: 'route' },
    'SUBCUTANEOUS': { category: 'route' },
    'PRN': { category: 'freq' }, 'BID': { category: 'freq' },
    'TID': { category: 'freq' }, 'QID': { category: 'freq' },
    'STAT': { category: 'freq' }, 'NOCTE': { category: 'freq' },
    // Lines / devices / procedures (ward sheet context)
    'CVC': { category: 'device' }, 'PICC': { category: 'device' }, 'IJ': { category: 'device' },
    'SC': { category: 'device' }, 'ART LINE': { category: 'device' }, 'FOLEY': { category: 'device' },
    'NG': { category: 'device' }, 'NGT': { category: 'device' }, 'NJ': { category: 'device' },
    'PEG': { category: 'device' }, 'ICC': { category: 'device' }, 'IDC': { category: 'device' },
    'ETT': { category: 'device' }, 'TRACH': { category: 'device' },
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
    // Trade names common in Kuwait/Gulf hospitals
    'Brufen', 'Voltaren', 'Tylenol', 'Perfalgan', 'Clexane', 'Fragmin',
    'Xarelto', 'Eliquis', 'Pradaxa', 'Plavix', 'Brilinta', 'Lipitor',
    'Crestor', 'Zocor', 'Nexium', 'Losec', 'Zantac', 'Motilium',
    'Zofran', 'Maxolon', 'Flagyl', 'Ciprobay', 'Tavanic', 'Zithromax',
    'Klacid', 'Rocephin', 'Zinacef', 'Fortum', 'Meronem', 'Invanz',
    'Tienam', 'Targocid', 'Zyvox', 'Diflucan', 'Cancidas',
    'Glucophage', 'Amaryl', 'Januvia', 'Jardiance', 'Forxiga',
    'Lantus', 'Novorapid', 'Humalog', 'Novomix', 'Mixtard',
    'Concor', 'Tenormin', 'Betaloc', 'Diovan', 'Cozaar', 'Atacand',
    'Tritace', 'Norvasc', 'Plendil', 'Lasix', 'Aldactone',
    'Cordarone', 'Lanoxin', 'Isoptin', 'Cardizem', 'Adalat',
    'Ventolin', 'Atrovent', 'Spiriva', 'Pulmicort', 'Seretide', 'Symbicort',
    'Xanax', 'Valium', 'Dormicum', 'Rivotril', 'Keppra', 'Tegretol', 'Depakine',
    'Seroquel', 'Risperdal', 'Zyprexa', 'Haldol', 'Lexapro', 'Zoloft',
    'Prozac', 'Effexor', 'Cymbalta', 'Remeron',
    'Adrenalin', 'Levophed', 'Precedex', 'Diprivan', 'Nimbex',
    'Hartmann', 'Gelofusine', 'Voluven', 'Plasmalyte',
    'TPN', 'PPN', 'KCl', 'NaCl', 'MgSO4', 'CaCl2',
    'Neulasta', 'Aranesp', 'Venofer', 'Ferinject',
    // Top 200 drugs not already covered (from ClinCalc 2023)
    'Levothyroxine', 'Albuterol', 'Bupropion', 'Buspirone', 'Cyclobenzaprine',
    'Ergocalciferol', 'Methylphenidate', 'Latanoprost', 'Cholecalciferol',
    'Topiramate', 'Lisdexamfetamine', 'Tizanidine', 'Baclofen', 'Aripiprazole',
    'Valacyclovir', 'Sumatriptan', 'Triamcinolone', 'Celecoxib', 'Alendronate',
    'Oxybutynin', 'Triamterene', 'Progesterone', 'Testosterone', 'Methocarbamol',
    'Benzonatate', 'Chlorthalidone', 'Donepezil', 'Clobetasol', 'Lovastatin',
    'Hydroxychloroquine', 'Meclizine', 'Azelastine', 'Nitrofurantoin',
    'Memantine', 'Atomoxetine', 'Melatonin', 'Cefdinir', 'Doxepin', 'Phentermine',
    'Mupirocin', 'Benazepril', 'Timolol', 'Linaclotide', 'Nebivolol', 'Dicyclomine',
    'Anastrozole', 'Evolocumab', 'Desvenlafaxine', 'Dorzolamide', 'Tretinoin',
    'Ferrous-Sulfate', 'Folic-Acid', 'Polyethylene-Glycol',
    // Additional trade names from top 200
    'Synthroid', 'Prilosec', 'Proair', 'Prinivil', 'Zestril', 'Toprol',
    'Wellbutrin', 'Abilify', 'Entresto', 'Ozempic', 'Mounjaro', 'Trulicity',
    'Victoza', 'Farxiga', 'Invokana', 'Bydureon', 'Rybelsus',
    'Coumadin', 'Humulin', 'Novolin', 'Toradol', 'Ofirmev',
    'Lyrica', 'Neurontin', 'Flexeril', 'Soma', 'Robaxin',
    'Ativan', 'Versed', 'Precedex', 'Narcan', 'Suboxone',
    // WHO Essential Medicines List 2025 — drugs not already covered
    'Abacavir', 'Abiraterone', 'Acetylcysteine', 'Afatinib', 'Albendazole',
    'Amikacin', 'Ampicillin', 'Anidulafungin', 'Arsenic-Trioxide',
    'Artesunate', 'Artemether', 'Lumefantrine', 'Asparaginase',
    'Atazanavir', 'Atezolizumab', 'Pembrolizumab', 'Atracurium', 'Vecuronium',
    'Bedaquiline', 'Bendamustine', 'Benznidazole', 'Beractant',
    'Bevacizumab', 'Bicalutamide', 'Bleomycin', 'Blinatumomab', 'Bortezomib',
    'Bromocriptine', 'Cabergoline', 'Calcitriol', 'Capecitabine',
    'Carboplatin', 'Cefazolin', 'Cefiderocol', 'Cefixime', 'Cefotaxime',
    'Cefepime', 'Cemiplimab', 'Certolizumab', 'Chlorambucil',
    'Chloramphenicol', 'Chloroquine', 'Cisplatin', 'Clofazimine',
    'Clomifene', 'Clozapine', 'Cyclophosphamide', 'Cytarabine',
    'Dacarbazine', 'Dactinomycin', 'Dapsone', 'Darbepoetin',
    'Daunorubicin', 'Deferasirox', 'Deferoxamine', 'Delamanid',
    'Desmopressin', 'Diethylcarbamazine', 'Docetaxel', 'Dolutegravir',
    'Doxorubicin', 'Efavirenz', 'Emtricitabine', 'Enfuvirtide',
    'Epirubicin', 'Eribulin', 'Erlotinib', 'Ethambutol',
    'Etoposide', 'Fentanyl', 'Filgrastim', 'Flucytosine',
    'Fludrocortisone', 'Fludarabine', 'Fluorouracil', '5-FU',
    'Fluphenazine', 'Gefitinib', 'Gemcitabine', 'Glibenclamide',
    'Glucagon', 'Griseofulvin', 'Halofantrine', 'Halothane',
    'Hydralazine', 'Hydroxyurea', 'Hydroxycarbamide', 'Ibuprofen',
    'Ifosfamide', 'Imatinib', 'Iohexol', 'Ipratropium',
    'Irinotecan', 'Isoflurane', 'Isoniazid', 'Itraconazole',
    'Ivermectin', 'Ketamine', 'Labetalol', 'Lenalidomide',
    'Levofloxacin', 'Lidocaine', 'Linezolid', 'Lopinavir',
    'Magnesium-Sulfate', 'Mebendazole', 'Mefloquine', 'Melphalan',
    'Mercaptopurine', '6-MP', 'Mesna', 'Mifepristone', 'Miltefosine',
    'Misoprostol', 'Mitoxantrone', 'Molnupiravir', 'Naltrexone',
    'Nevirapine', 'Niclosamide', 'Nifurtimox', 'Nilotinib',
    'Nivolumab', 'Nystatin', 'Obinutuzumab', 'Oxaliplatin',
    'Oxytocin', 'Paclitaxel', 'Palbociclib', 'Paromomycin',
    'Penicillamine', 'Pentamidine', 'Permethrin',
    'Phenobarbital', 'Phenoxymethylpenicillin', 'Phentolamine',
    'Podophyllotoxin', 'Potassium-Iodide', 'Pralidoxime',
    'Primaquine', 'Procarbazine', 'Promethazine', 'Propranolol',
    'Pyrazinamide', 'Quinine', 'Raltegravir', 'Rasburicase',
    'Ribavirin', 'Rifabutin', 'Rifampicin', 'Rifapentine',
    'Rituximab', 'Saquinavir', 'Sevoflurane', 'Silver-Sulfadiazine',
    'Sodium-Stibogluconate', 'Sofosbuvir', 'Sunitinib',
    'Tamoxifen', 'Teniposide', 'Tenofovir', 'Thalidomide',
    'Thioguanine', 'Thiotepa', 'Trastuzumab', 'Tretinoin',
    'Vinblastine', 'Vincristine', 'Vinorelbine', 'Voriconazole',
    'Zidovudine', 'Semaglutide', 'Tirzepatide',
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
    // Transliterated male — all common spelling variants OCR produces
    'Ahmed', 'Ahmad', 'Mohammad', 'Mohammed', 'Muhammad', 'Muhammed',
    'Abdullah', 'Abdallah', 'Abdulla', 'Khaled', 'Khalid', 'Khaleid',
    'Abdulrahman', 'Abdul Rahman', 'Abdulrhman', 'Abdelrahman',
    'Fahad', 'Fahd', 'Saud', 'Saoud', 'Bader', 'Badr', 'Bedir',
    'Yousef', 'Yousuf', 'Yousif', 'Yosef', 'Joseph',
    'Ali', 'Aly', 'Hussein', 'Hussain', 'Husain', 'Hassan', 'Hasan',
    'Omar', 'Omer', 'Ibrahim', 'Ibraheem', 'Ebrahim',
    'Salman', 'Selman', 'Nasser', 'Nassir', 'Nasir', 'Nasr',
    'Jaber', 'Jabir', 'Sabah', 'Mubarak', 'Mobarak',
    'Talal', 'Faisal', 'Faysal', 'Fayez', 'Fawaz', 'Fawwaz',
    'Salem', 'Salim', 'Mishari', 'Meshaal', 'Meshal', 'Mishaal',
    'Abdulaziz', 'Abdul Aziz', 'Abdelaziz', 'Nawaf', 'Nowaf',
    'Turki', 'Torki', 'Saad', 'Saeed', 'Said',
    'Majed', 'Majid', 'Maajid', 'Waleed', 'Walid', 'Wael',
    'Hani', 'Hany', 'Rashed', 'Rashid', 'Rasheed',
    'Mansour', 'Mansoor', 'Mansor',
    'Hamad', 'Hammad', 'Hamoud', 'Hammoud',
    'Jasem', 'Jassim', 'Jassem', 'Qasem', 'Qassim',
    'Anwar', 'Anwer', 'Adel', 'Adil',
    'Abdulhadi', 'Abdullatif', 'Abdulkarim', 'Abdulwahab',
    'Tareq', 'Tarek', 'Tariq', 'Zaid', 'Zayed', 'Zayd',
    'Barak', 'Barrak', 'Musaed', 'Musaid',
    'Essa', 'Isa', 'Eisa', 'Khalifa', 'Khaleefa',
    'Anas', 'Ziad', 'Ziyad', 'Mazen', 'Mazin',
    'Basel', 'Basil', 'Basim', 'Bassam',
    'Hamed', 'Hameed', 'Maher', 'Mahir',
    'Hesham', 'Hisham', 'Hisam', 'Osama', 'Usama',
    'Marwan', 'Merwan', 'Ghanem', 'Ghannam',
    'Mohsen', 'Muhsin', 'Aqeel', 'Akeel', 'Aqil',
    'Rida', 'Ridha', 'Reza', 'Abbas', 'Abas',
    'Jaafar', 'Jafar', 'Jafaar', 'Mahdi', 'Mehdi',
    'Murtada', 'Murtadha', 'Kazem', 'Kazim', 'Kadhim',
    'Mustafa', 'Mostafa', 'Emad', 'Imad', 'Khalil', 'Jalil',
    'Sami', 'Sameer', 'Samir', 'Rami', 'Ramy',
    'Jamal', 'Jamaal', 'Saleh', 'Salah', 'Zahra', 'Zahrah',
    'Raju', 'Rojelo', 'Abdolmohsen',
    'Sultan', 'Soltan', 'Nayef', 'Nayif', 'Naif',
    'Yaser', 'Yasir', 'Yasin', 'Yaseen',
    'Dawood', 'Dawoud', 'Daud', 'Yaqoub', 'Yacoub',
    'Ismail', 'Ismael', 'Esmail',
    // Transliterated female — all common spelling variants
    'Fatima', 'Fatma', 'Fathima', 'Fatimah',
    'Noura', 'Nora', 'Noorah', 'Norah',
    'Mariam', 'Maryam', 'Miriam', 'Marian',
    'Sara', 'Sarah', 'Saara', 'Haya', 'Hayat',
    'Dalal', 'Dallal', 'Muneera', 'Munira', 'Monira',
    'Aisha', 'Aysha', 'Aaisha', 'Aishah',
    'Reem', 'Reema', 'Rima', 'Dana', 'Danah',
    'Lulwa', 'Lulu', 'Lulwah', 'Latifa', 'Lateefa',
    'Sheikha', 'Shaikha', 'Badria', 'Badriya',
    'Jawaher', 'Jawahir', 'Jowaher',
    'Amal', 'Amaal', 'Hind', 'Hend', 'Manal', 'Manel',
    'Nawal', 'Nawaal', 'Samira', 'Sameera',
    'Nadia', 'Nadya', 'Alia', 'Aaliya', 'Alya',
    'Salwa', 'Selvwa', 'Haifa', 'Hayfa', 'Zainab', 'Zaynab', 'Zeinab',
    'Ruqayya', 'Ruqayyah', 'Khadija', 'Khadeeja',
    'Mona', 'Mouna', 'Hessa', 'Hissa', 'Abeer', 'Abir',
    'Ghada', 'Ghadah', 'Shahd', 'Shahed',
    'Sadeem', 'Malak', 'Malek', 'Tala', 'Talah',
    'Layan', 'Layane', 'Yara', 'Yarah',
    'Jouri', 'Jory', 'Razan', 'Razaan', 'Nouf', 'Noaf',
    'Noor', 'Nour', 'Nura', 'Nurah',
    'Maha', 'Mahah', 'Hala', 'Halah',
    'Yasmin', 'Yasmeen', 'Jasmine',
    'Asma', 'Asmaa', 'Eman', 'Iman', 'Amani', 'Amna', 'Amina',
    'Wafa', 'Wafaa', 'Afaf', 'Aziza', 'Azeeza',
    'Basma', 'Buthaina', 'Buthayna',
    'Fajr', 'Farah', 'Farha', 'Fawzia', 'Fowzia',
    'Kawther', 'Kawthar', 'Lamia', 'Lamya',
    'Layla', 'Leila', 'Lina', 'Lubna',
    'Mashael', 'Meshaael', 'Shaima', 'Shaimaa',
    // From Saudi/Gulf name databases (forebears.io, nameberry, names.org) — 200+ additional
    // Male names not already covered
    'Sameh', 'Atif', 'Atef', 'Akram', 'Hazem', 'Hazim', 'Hosam', 'Husam',
    'Nabeel', 'Haytham', 'Haitham', 'Esam', 'Issam', 'Kareem', 'Karim',
    'Taher', 'Tahir', 'Firas', 'Nadeem', 'Amro', 'Amr', 'Medhat',
    'Tareq', 'Tariq', 'Wesam', 'Wisam', 'Taha', 'Gamal', 'Jamal',
    'Naveed', 'Ghassan', 'Saleem', 'Arshad', 'Nidal', 'Fathi',
    'Ihab', 'Naji', 'Shady', 'Shahid', 'Azhar', 'Mutaz', 'Moataz',
    'Ramzi', 'Adeeb', 'Adib', 'Bahaa', 'Hamdi', 'Naeem', 'Sohail', 'Suhail',
    'Abdulhadi', 'Qasim', 'Qassim', 'Asim', 'Aasim', 'Mamdouh',
    'Obaid', 'Ubaid', 'Bassem', 'Basem', 'Muneer', 'Munir',
    'Abid', 'Asad', 'Assad', 'Sadiq', 'Sadeq', 'Basheer', 'Bashir',
    'Shoaib', 'Shuaib', 'Hattan', 'Anis', 'Anas', 'Loay', 'Louay',
    'Jameel', 'Jamil', 'Muath', 'Moath', 'Iyad', 'Eyad',
    'Rashad', 'Musab', 'Musaab', 'Dawood', 'Dawoud', 'Nasr',
    'Ayed', 'Majdi', 'Shakeel', 'Shakil', 'Safwan', 'Siraj', 'Seraj',
    'Saber', 'Sabir', 'Diaa', 'Dhia', 'Zaki', 'Zakki',
    'Moayad', 'Muayyad', 'Nezar', 'Nizar', 'Ameen', 'Amin',
    'Raid', 'Raed', 'Fadel', 'Fadhel', 'Fuad', 'Fouad',
    'Hilal', 'Yassir', 'Yasir', 'Ahsan', 'Ehsan',
    'Soliman', 'Sulaiman', 'Suleiman', 'Tawfiq', 'Tawfeeq',
    'Mujtaba', 'Mojtaba', 'Junaid', 'Jawad', 'Javad',
    'Hamzah', 'Hamza', 'Haris', 'Harith',
    // Female names not already covered
    'Eman', 'Iman', 'Hanan', 'Hanane', 'Heba', 'Hibah',
    'Sahar', 'Sehar', 'Areej', 'Arij', 'Dina', 'Deena',
    'Rana', 'Ranaa', 'Maram', 'Maraam', 'Noha', 'Nuha',
    'Abrar', 'Rehab', 'Rihab', 'Afnan', 'Reham', 'Riham',
    'Tahani', 'Tehani', 'Doaa', 'Duaa', 'Sawsan', 'Susan',
    'Arwa', 'Ruba', 'Rubaa', 'Hadeel', 'Hadil',
    'Lamia', 'Lamya', 'Ola', 'Olaa', 'Waqar',
    'Raja', 'Rajaa', 'Mai', 'May',
    'Lolo', 'Lulu', 'Razan', 'Razaan',
    'Samira', 'Sameera', 'Sana', 'Sanaa',
    'Suha', 'Soha', 'Tasneem', 'Tasnim',
    'Thana', 'Thanaa', 'Yusra', 'Yosra',
    'Zubaida', 'Zubaidah', 'Mawaddah', 'Mawadda',
    'Huda', 'Houda', 'Ruqayyah', 'Ruqaya',
    'Kholoud', 'Khulood', 'Sumayya', 'Sumayyah',
    'Tamara', 'Tammara', 'Raghad', 'Raghd',
    'Jumana', 'Joumana', 'Lujain', 'Lujane',
    'Shahad', 'Shatha', 'Rawdah', 'Rawda',
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
    'Alessa', 'Bazzah', 'Bazza', 'Athoub', 'Athoob',
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

  // Lookup a single token or full name against name databases
  // Works for Arabic script, English transliterated, and mixed
  lookupName(text) {
    if (!text || text.length < 2) return null;
    const words = text.trim().split(/\s+/);
    let bestConf = 0;

    for (const word of words) {
      const conf = this._lookupSingleName(word);
      if (conf > bestConf) bestConf = conf;
    }

    // Multi-word bonus — if any word matches a name, the whole thing is likely a name
    if (bestConf > 0 && words.length >= 2) bestConf = Math.min(1.0, bestConf + 0.1);

    // Check learned names (self-expanding from training data)
    const learned = lookupLearnedName(text);
    if (learned && learned.confidence > bestConf) {
      bestConf = learned.confidence;
    }

    return bestConf > 0 ? { confidence: bestConf } : null;
  },

  _lookupSingleName(word) {
    if (!word || word.length < 2) return 0;
    const isArabic = /[\u0600-\u06FF]/.test(word);
    const lower = word.toLowerCase().trim();
    // Strip common OCR artifacts: "Al-" prefix variations for matching
    const stripped = lower.replace(/^al[- ]?/i, '');

    // Check first names
    for (const name of this.ARABIC_FIRST_NAMES) {
      if (isArabic && /[\u0600-\u06FF]/.test(name)) {
        const norm = normalizeArabicText(word);
        const normName = normalizeArabicText(name);
        if (norm === normName) return 1.0;
        if (norm.length >= 3 && ocrDistance(norm, normName, 1) <= 1) return 0.8;
      } else if (!isArabic && !/[\u0600-\u06FF]/.test(name)) {
        const nameLower = name.toLowerCase();
        if (lower === nameLower) return 1.0;
        if (stripped === nameLower.replace(/^al[- ]?/i, '')) return 0.95;
        if (lower.length >= 3 && ocrDistance(lower, nameLower, 1) <= 1) return 0.8;
      }
    }

    // Check family names
    for (const name of this.FAMILY_NAMES) {
      if (typeof name !== 'string') continue;
      if (isArabic && /[\u0600-\u06FF]/.test(name)) {
        const norm = normalizeArabicText(word);
        const normName = normalizeArabicText(name);
        if (norm === normName) return 1.0;
        if (norm.length >= 3 && ocrDistance(norm, normName, 1) <= 1) return 0.75;
      } else if (!isArabic && !/[\u0600-\u06FF]/.test(name)) {
        const nameLower = name.toLowerCase();
        if (lower === nameLower) return 1.0;
        // Match without "Al-" prefix — OCR often drops or merges it
        if (stripped === nameLower.replace(/^al[- ]?/i, '')) return 0.9;
        if (lower.length >= 4 && ocrDistance(lower, nameLower, 2) <= 2) return 0.7;
      }
    }

    return 0;
  },
};

const DIAGNOSIS_DETAIL_HINTS = new Set([
  'ACUTE', 'CHRONIC', 'LEFT', 'RIGHT', 'BILATERAL', 'UPPER', 'LOWER', 'MID', 'LATE', 'POST',
  'SEVERE', 'MILD', 'MODERATE', 'EXACERBATION', 'EXACERBATED', 'EXAC', 'OCCLUSION', 'STROKE',
  'INFARCT', 'INFARCTION', 'ISCHEMIC', 'ISCHAEMIC', 'HEMORRHAGIC', 'HAEMORRHAGIC', 'SHOCK',
  'INFECTION', 'SEPSIS', 'FAILURE', 'DECOMPENSATION', 'OBSTRUCTION', 'OVERDOSE', 'WITH',
  'WITHOUT', 'LOSS', 'PAIN', 'RETENTION', 'ULCER', 'GANGRENE', 'COLITIS', 'HEPATITIS',
  'CHOLESTITIS', 'CHOLECYSTITIS', 'CHOLESTASIS',
]);
const DIAGNOSIS_CONNECTOR_HINTS = new Set([
  'AND', 'WITH', 'W', 'SEC', 'SECONDARY', 'DUE', 'TO', 'PLUS', 'ON',
]);

function tokenizeClinicalPhrase(text) {
  return `${text || ''}`
    .replace(/[?]+/g, ' ')
    .replace(/[()]+/g, ' ')
    .split(/[\s,;/|]+/)
    .map(token => token
      .trim()
      .replace(/^[`"'~.,:;!?()[\]{}<>+-]+|[`"'~.,:;!?()[\]{}<>+-]+$/g, '')
    )
    .filter(Boolean);
}

function collectDiagnosisEvidence(rawText) {
  const tokens = tokenizeClinicalPhrase(rawText);
  if (tokens.length === 0) {
    return {
      tokens: [],
      termMatches: [],
      detailHits: 0,
      connectorHits: 0,
      startsWithClinicalTerm: false,
      slashLike: /[\/|]/.test(`${rawText || ''}`),
      corrected: `${rawText || ''}`.trim(),
    };
  }

  const tokenInfos = tokens.map((token, index) => ({
    index,
    raw: token,
    upper: token.toUpperCase(),
    key: stripForLexicon(token),
  }));
  const candidates = [];

  for (let start = 0; start < tokenInfos.length; start++) {
    for (let len = Math.min(4, tokenInfos.length - start); len >= 1; len--) {
      const slice = tokenInfos.slice(start, start + len);
      const phrase = slice.map(token => token.raw).join(' ');
      const match = MedicalVocabulary.correctTerm(phrase.toUpperCase(), len >= 2 ? 2 : 1);
      if (!match) continue;
      if (len === 1 && (match.distance || 0) > 0 && stripForLexicon(phrase).length <= 3) continue;
      if (len >= 2 && (match.distance || 0) > 1) continue;
      candidates.push({
        start,
        end: start + len - 1,
        len,
        match,
      });
    }
  }

  candidates.sort((a, b) =>
    b.len - a.len ||
    (b.match.confidence || 0) - (a.match.confidence || 0) ||
    a.start - b.start
  );

  const occupied = new Set();
  const selected = [];
  for (const candidate of candidates) {
    let overlaps = false;
    for (let i = candidate.start; i <= candidate.end; i++) {
      if (occupied.has(i)) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;
    selected.push(candidate);
    for (let i = candidate.start; i <= candidate.end; i++) occupied.add(i);
  }

  selected.sort((a, b) => a.start - b.start);

  const correctedTokens = [];
  for (let index = 0; index < tokenInfos.length;) {
    const match = selected.find(entry => entry.start === index);
    if (match) {
      correctedTokens.push(match.match.term);
      index = match.end + 1;
      continue;
    }
    correctedTokens.push(tokenInfos[index].raw);
    index++;
  }

  const detailHits = tokenInfos.filter(token =>
    !occupied.has(token.index) && DIAGNOSIS_DETAIL_HINTS.has(token.key)
  ).length;
  const connectorHits = tokenInfos.filter(token =>
    !occupied.has(token.index) && DIAGNOSIS_CONNECTOR_HINTS.has(token.key)
  ).length;

  return {
    tokens: tokenInfos,
    termMatches: selected,
    detailHits,
    connectorHits,
    startsWithClinicalTerm: selected.some(match => match.start === 0),
    slashLike: /[\/|]/.test(`${rawText || ''}`),
    corrected: correctedTokens.join(' ').replace(/\s+/g, ' ').trim(),
  };
}

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

    // "Dr." or "Dr" prefix — mark as doctor title, not diagnosis
    if (/^Dr\.?$/i.test(t)) {
      result.entity = 'DOCTOR_TITLE';
      result.confidence = 0.85;
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
      this.scoreMobility(t),
      this.scoreBloodType(t),
      this.scoreAssignedDoctor(t),
      this.scoreName(t),
      this.scoreDiagnosis(t),
      this.scoreMedication(t),
      this.scoreStatus(upper),
      this.scoreSheetStatus(t),
      this.scoreAllergy(upper),
    ].filter(c => c.confidence > 0.3);

    if (candidates.length === 0) {
      // Try learned model to resolve unknown entities
      const learned = resolveUnknownEntity(t);
      if (learned && learned.confidence >= 0.6) {
        result.entity = learned.entity;
        result.confidence = clamp((learned.confidence * 0.8) + (sourceConfidence * 0.2));
        result.corrected = learned.correctedText || t;
        result.meta = { learnedReason: learned.reason };
        return result;
      }
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

    // Boost with learned data — can increase confidence or correct text
    const boost = boostEntityScore(t, best.entity, result.confidence);
    if (boost) {
      result.confidence = clamp(Math.max(result.confidence, boost.boostedConfidence));
      if (boost.correctedText && boost.correctedText !== t) {
        result.corrected = boost.correctedText;
        result.meta.learnedCorrection = true;
      }
      result.meta.learnedReason = boost.reason;
    }

    return result;
  },

  scoreBed(t) {
    const canonical = t.toUpperCase().replace(/O/g, '0');
    if (/^[A-E]-[MF]-\d{1,2}$/i.test(canonical))
      return { entity: 'BED', confidence: 0.99, corrected: canonical };
    if (/^(?:bed|rm|room|\u0633\u0631\u064A\u0631|\u063A\u0631\u0641\u0629)\s*#?\s*(\d{1,3})/i.test(t))
      return { entity: 'BED', confidence: 0.9, corrected: t };
    if (/^\d{1,3}\s*-\s*\d{1,3}$/i.test(canonical))
      return { entity: 'BED', confidence: 0.86, corrected: canonical.replace(/\s+/g, '') };
    if (/^[A-E]\d{1,2}$/i.test(canonical))
      return { entity: 'BED', confidence: 0.7, corrected: canonical };
    // Kuwait formats: "401-1" (room-bed), "4A-12" (ward-bed), "B4" (bed 4)
    if (/^\d{3}\s*-\s*\d{1,2}$/.test(canonical))
      return { entity: 'BED', confidence: 0.82, corrected: canonical.replace(/\s+/g, '') };
    if (/^\d[A-Z]\s*-\s*\d{1,2}$/i.test(canonical))
      return { entity: 'BED', confidence: 0.84, corrected: canonical.replace(/\s+/g, '') };
    if (/^(?:B|BED)\s*\d{1,3}$/i.test(canonical))
      return { entity: 'BED', confidence: 0.78, corrected: canonical };
    // ICU beds: "ICU-1", "ICU 3", "CCU-2"
    if (/^(?:ICU|CCU|HDU|NICU|PICU)\s*-?\s*\d{1,2}$/i.test(t))
      return { entity: 'BED', confidence: 0.90, corrected: t.replace(/\s+/g, '-').toUpperCase() };
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
    // ICU/CCU/NICU/PICU/specialty units
    if (/^(?:ICU|MICU|SICU|CCU|NICU|PICU|HDU|MAU|AMU|ACU|EDW|ED|ER|OT|OR|PACU|RECOVERY|SCU|CSICU|CTICU|BMT|ONC|DIALYSIS|RENAL|NEURO|CARDIO|RESP|ORTHO|GI|UROL|SURG|MED)$/i.test(upper))
      return { entity: 'WARD', confidence: 0.92, corrected: upper, meta: { ward: upper } };
    if (/^(?:ER|ED)\s*\/\s*UNASSIGNED$/i.test(upper) || /^UNASSIGNED$/i.test(upper))
      return { entity: 'WARD', confidence: 0.9, corrected: upper, meta: { ward: upper } };
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

  scoreMobility(t) {
    const upper = t.toUpperCase().trim();
    if (/^AMBUL/i.test(upper)) return { entity: 'MOBILITY', confidence: 0.9, corrected: 'AMBULATORY', meta: { mobility: 'AMBULATORY' } };
    if (/^W\/?C|WHEEL\s*CHAIR/i.test(upper)) return { entity: 'MOBILITY', confidence: 0.92, corrected: 'WHEELCHAIR', meta: { mobility: 'WHEELCHAIR' } };
    if (/^STRETCH|LITTER/i.test(upper)) return { entity: 'MOBILITY', confidence: 0.9, corrected: 'STRETCHER', meta: { mobility: 'STRETCHER' } };
    if (/^CRIT.*TRANSPORT|VENT.*TRANSPORT/i.test(upper)) return { entity: 'MOBILITY', confidence: 0.92, corrected: 'CRITICAL_TRANSPORT', meta: { mobility: 'CRITICAL_TRANSPORT' } };
    if (/^(?:BED\s*BOUND|BEDRIDDEN|IMMOBILE)/i.test(upper)) return { entity: 'MOBILITY', confidence: 0.85, corrected: 'STRETCHER', meta: { mobility: 'STRETCHER' } };
    return { entity: 'MOBILITY', confidence: 0 };
  },

  scoreBloodType(t) {
    const clean = t.toUpperCase().replace(/\s+/g, '').trim();
    const match = clean.match(/^(A|B|AB|O)[+-]?$/);
    if (match) {
      const hasRh = /[+-]$/.test(clean);
      return { entity: 'BLOOD_TYPE', confidence: hasRh ? 0.92 : 0.6, corrected: clean, meta: { bloodType: clean } };
    }
    if (/^(?:A|B|AB|O)\s*(?:POS|NEG|POSITIVE|NEGATIVE)/i.test(clean)) {
      const type = clean.replace(/POS.*/, '+').replace(/NEG.*/, '-');
      return { entity: 'BLOOD_TYPE', confidence: 0.9, corrected: type, meta: { bloodType: type } };
    }
    return { entity: 'BLOOD_TYPE', confidence: 0 };
  },

  scoreAssignedDoctor(t) {
    const normalized = `${t || ''}`.trim().replace(/\s+/g, ' ');
    const match = normalized.match(/^(dr\.?|doctor|consultant|team)\s*(?:[:\-]\s*)?(.+)$/i);
    if (!match || !match[2]) return { entity: 'ASSIGNED_DOCTOR', confidence: 0 };

    const doctorText = match[2]
      .replace(/^[`"'~.,:;!?()[\]{}<>]+|[`"'~.,:;!?()[\]{}<>]+$/g, '')
      .trim();
    if (!doctorText || /\d/.test(doctorText) || isHeaderLike(doctorText)) {
      return { entity: 'ASSIGNED_DOCTOR', confidence: 0 };
    }

    const nameScore = this.scoreName(doctorText).confidence || 0;
    const lexiconScore = MedicalVocabulary.lookupName(doctorText)?.confidence || 0;
    const supportsDoctorName = Math.max(nameScore, lexiconScore);
    if (supportsDoctorName < 0.45 && !/^[A-Za-z\u0600-\u06FF][A-Za-z\u0600-\u06FF' -]{1,40}$/i.test(doctorText)) {
      return { entity: 'ASSIGNED_DOCTOR', confidence: 0 };
    }

    return {
      entity: 'ASSIGNED_DOCTOR',
      confidence: clamp(0.76 + (supportsDoctorName * 0.18)),
      corrected: doctorText,
      meta: { doctor: doctorText, doctorTitle: match[1] },
    };
  },

  scoreName(t) {
    let conf = 0;
    if (!t || t.length < 2) return { entity: 'NAME', confidence: 0 };

    // Reject: has digits (except MRN-like which is handled by CIVIL_ID), or is a header
    if (/\d/.test(t) || isHeaderLike(t)) return { entity: 'NAME', confidence: 0 };
    if (/^(?:dr\.?|doctor|consultant|team)\b/i.test(t.trim())) return { entity: 'NAME', confidence: 0 };
    if (this.scoreSheetStatus(t).confidence >= 0.76) return { entity: 'NAME', confidence: 0 };
    if (this.scoreWard(t).confidence >= 0.88) return { entity: 'NAME', confidence: 0 };

    // Reject: all uppercase short tokens that are known medical terms (not names)
    // Don't blanket-reject uppercase — PaddleOCR outputs "ALI", "OMAR", "DANA" in caps
    if (/^[A-Z]{2,6}$/.test(t) && MedicalVocabulary.MEDICAL_TERMS[t.toUpperCase()]) {
      return { entity: 'NAME', confidence: 0 };
    }

    const hasArabic = /[\u0600-\u06FF]/.test(t);
    const arabicLen = (t.match(/[\u0600-\u06FF]/g) || []).length;
    const words = t.trim().split(/\s+/);

    // === Arabic text ===
    if (hasArabic && arabicLen >= 2) {
      conf = 0.72;
      // Multi-word Arabic = almost certainly a name
      if (words.length >= 2) conf = 0.88;
      if (words.length >= 3) conf = 0.93;
      const match = MedicalVocabulary.lookupName(t);
      if (match) conf = Math.max(conf, match.confidence);
    }

    // === Latin text — single word ===
    if (!hasArabic && words.length === 1) {
      const w = words[0];
      // Database lookup first — most reliable signal (case insensitive)
      const match = MedicalVocabulary.lookupName(w);
      if (match && match.confidence >= 0.7) {
        conf = Math.max(conf, match.confidence);
      }
      // Capitalized word not in medical dictionary (Title Case)
      if (/^[A-Z][a-z]{2,20}$/.test(w) && !match) {
        conf = Math.max(conf, 0.48);
      }
      // ALL CAPS word — PaddleOCR often outputs names in caps
      // Only treat as name if DB match or if it's long enough to not be a medical abbrev
      if (/^[A-Z]{3,}$/.test(w)) {
        if (match && match.confidence >= 0.7) conf = Math.max(conf, match.confidence);
        else if (w.length >= 5 && !MedicalVocabulary.MEDICAL_TERMS[w]) conf = Math.max(conf, 0.42);
      }
      // "Al-" prefix = almost certainly a family name
      if (/^Al[- ]?[A-Z]/i.test(w)) conf = Math.max(conf, 0.82);
      // All lowercase but in name database
      if (/^[a-z]{3,}$/.test(w) && match && match.confidence >= 0.8) {
        conf = Math.max(conf, 0.75);
      }
    }

    // === Latin text — multi-word ===
    if (!hasArabic && words.length >= 2) {
      // Any two+ words starting with uppercase letter
      const capWords = words.filter(w => /^[A-Z]/.test(w)).length;
      if (capWords >= 2) conf = Math.max(conf, 0.82);
      // "Firstname Al-Lastname" pattern (any case)
      if (/\bAl[- ]?/i.test(t)) conf = Math.max(conf, 0.88);
      // Three+ words with capitals
      if (words.length >= 3 && capWords >= 2) conf = Math.max(conf, 0.90);
      // ALL CAPS multi-word — PaddleOCR outputs "AHMED AL-MUTAIRI" in caps
      if (words.every(w => /^[A-Z]/.test(w))) conf = Math.max(conf, 0.80);
      // Database-backed: any word matches a known name
      const match = MedicalVocabulary.lookupName(t);
      if (match && match.confidence >= 0.7) conf = Math.max(conf, match.confidence);
      // All lowercase multi-word but database match
      if (match && match.confidence >= 0.8 && words.every(w => /^[a-z]/.test(w))) {
        conf = Math.max(conf, 0.78);
      }
      // Mixed/any-case multi-word phrases with only letters — likely a name
      if (words.length >= 2 && words.every(w => /^[a-zA-Z]{2,}$/.test(w)) && !MedicalVocabulary.correctTerm(t, 0)) {
        conf = Math.max(conf, 0.65);
      }
    }

    const diagnosisEvidence = collectDiagnosisEvidence(t);
    const stronglyClinicalPhrase = diagnosisEvidence.termMatches.length >= 2 ||
      diagnosisEvidence.termMatches.some(match => match.len >= 2) ||
      (diagnosisEvidence.startsWithClinicalTerm && diagnosisEvidence.detailHits > 0) ||
      (diagnosisEvidence.slashLike && diagnosisEvidence.termMatches.length >= 1);
    if (stronglyClinicalPhrase) conf *= 0.12;
    else if (diagnosisEvidence.termMatches.length >= 1 && diagnosisEvidence.detailHits > 0) conf *= 0.28;
    else if (diagnosisEvidence.termMatches.length >= 1) conf *= 0.55;

    // === Penalize if it's a medical term ===
    const medMatch = MedicalVocabulary.correctTerm(t, 0);
    if (medMatch) conf *= 0.25;

    // === Penalize if it looks like a medication ===
    const medName = MedicalVocabulary.correctMedication(t, 0);
    if (medName) conf *= 0.3;

    return { entity: 'NAME', confidence: conf };
  },

  scoreDiagnosis(rawText) {
    const normalized = `${rawText || ''}`.trim();
    const upper = normalized.toUpperCase();
    const tokenCount = tokenizeClinicalPhrase(normalized).length;
    if (this.scoreSheetStatus(normalized).confidence >= 0.74 && tokenCount <= 3 && !/[\/,;+]/.test(normalized)) {
      return { entity: 'DIAGNOSIS', confidence: 0 };
    }
    if (this.scoreWard(normalized).confidence >= 0.88 && tokenCount <= 3 && !/[\/,;+]/.test(normalized)) {
      return { entity: 'DIAGNOSIS', confidence: 0 };
    }
    if (/^[A-Z][a-z]{2,}$/.test(rawText) && !MedicalVocabulary.MEDICAL_TERMS[upper]) {
      return { entity: 'DIAGNOSIS', confidence: 0 };
    }

    const evidence = collectDiagnosisEvidence(rawText);
    const match = MedicalVocabulary.correctTerm(upper, 1);
    if (!match) {
      if (evidence.termMatches.length > 0) {
        const confidence = clamp(
          0.48 +
          (average(evidence.termMatches.map(entry => entry.match.confidence), 0.55) * 0.22) +
          (Math.min(evidence.termMatches.length, 3) * 0.09) +
          (Math.min(evidence.detailHits, 3) * 0.06) +
          (Math.min(evidence.connectorHits, 2) * 0.02) +
          (evidence.startsWithClinicalTerm ? 0.08 : 0) +
          (evidence.slashLike ? 0.07 : 0) +
          (evidence.termMatches.some(entry => entry.len >= 2) ? 0.08 : 0)
        );
        return {
          entity: 'DIAGNOSIS',
          confidence: evidence.termMatches.length >= 2 && (evidence.detailHits > 0 || evidence.slashLike)
            ? Math.max(confidence, 0.82)
            : (evidence.startsWithClinicalTerm && evidence.detailHits > 0)
              ? Math.max(confidence, 0.76)
              : confidence,
          corrected: evidence.corrected || rawText,
          meta: evidence.termMatches[0]?.match?.info || {},
        };
      }

      const tokens = `${rawText || ''}`
        .split(/[\s,;/]+/)
        .map(token => token.trim())
        .filter(Boolean);
      const tokenMatches = tokens
        .map(token => MedicalVocabulary.correctTerm(token.toUpperCase(), 1))
        .filter(Boolean);
      if (tokenMatches.length === 0) return { entity: 'DIAGNOSIS', confidence: 0 };

      const corrected = tokens.map(token => {
        const tokenMatch = MedicalVocabulary.correctTerm(token.toUpperCase(), 1);
        if (!tokenMatch) return token;
        if ((tokenMatch.distance || 0) > 0 && stripForLexicon(token).length <= 5) return token;
        return tokenMatch.term || token;
      }).join(' ');
      const confidence = clamp(0.52 + (average(tokenMatches.map(tokenMatch => tokenMatch.confidence), 0.55) * 0.28) + (Math.min(tokenMatches.length, 3) * 0.05));
      return {
        entity: 'DIAGNOSIS',
        confidence,
        corrected,
        meta: tokenMatches[0]?.info || {},
      };
    }
    if (evidence.termMatches.length > 0 && evidence.corrected && evidence.corrected.length > match.term.length) {
      return {
        entity: 'DIAGNOSIS',
        confidence: clamp((0.62 + match.confidence * 0.28) + (Math.min(evidence.detailHits, 2) * 0.05) + (evidence.termMatches.length >= 2 ? 0.08 : 0)),
        corrected: evidence.corrected,
        meta: match.info,
      };
    }
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
    let conf = 0.55 + match.confidence * 0.45;
    // Penalize fuzzy matches on short words — too many false positives with names
    if (match.distance > 0 && t.length <= 5) conf *= 0.5;
    // Penalize if the word is also a known name — names should win
    const nameMatch = MedicalVocabulary.lookupName(t);
    if (nameMatch && nameMatch.confidence >= 0.7) conf *= 0.3;
    return {
      entity: 'MEDICATION',
      confidence: conf,
      corrected: match.term,
    };
  },

  scoreStatus(upper) {
    const statuses = { 'DNR': 1, 'DNAR': 1, 'FULL CODE': 1, 'COMFORT': 0.9, 'NFR': 0.9 };
    const conf = statuses[upper] || 0;
    return { entity: 'STATUS', confidence: conf, corrected: upper };
  },

  scoreSheetStatus(t) {
    const normalized = `${t || ''}`.trim().replace(/\s+/g, ' ');
    const upper = normalized.toUpperCase();
    // Common ward sheet status terms
    if (/^(?:NEW|ACTIVE|CHRONIC|PENDING|TRANSFER|FOLLOW[- ]?UP|STABLE|UNSTABLE|CRITICAL|IMPROVING|DETERIORATING|WORSENING|RESOLVED|DECEASED|EXPIRED|PALLIAT(?:IVE|ING))$/i.test(upper)) {
      return { entity: 'SHEET_STATUS', confidence: 0.76, corrected: normalized };
    }
    // Discharge / admission / fitness status (from research: MOFD, FFD, EDD, DAMA, AMA)
    if (/^(?:ICU|ER|WARD|HDU|CCU)\s+(?:DISCHARGE|TRANSFER|ADMISSION)$/i.test(upper) ||
        /^(?:DISCHARGE|DISCHARGED|D\/C|DC|DISCH|MOFD|FFD|EDD|DAMA|AMA|LOA)$/i.test(upper) ||
        /^(?:ADMITTED|ADM|ADMISSION|RE-?ADM|READMISSION)$/i.test(upper)) {
      return { entity: 'SHEET_STATUS', confidence: 0.82, corrected: normalized };
    }
    // Ward operational abbreviations (from research: TWOC, NEWS, q\dh, Day \d)
    if (/^(?:NBM|NPO|FOR OT|FOR OR|FOR CATH|FOR ERCP|FOR SCOPE|FOR CT|FOR MRI|FOR ECHO|FOR DIALYSIS|FOR HD|TCI|OBS|BOOKED|PLANNED|ELECTIVE|URGENT|ROUTINE|AWAITING|WAIT|READY|CLEARED|TWOC|NEWS|DNACPR|FIT)$/i.test(upper)) {
      return { entity: 'SHEET_STATUS', confidence: 0.78, corrected: normalized };
    }
    // Transfer terms
    if (/^(?:T\/F|TXF?|TRANSFER|TRANSFERRED|TO ICU|TO HDU|TO WARD|FROM ICU|FROM ER|EX ICU|FROM HDU|ADT)$/i.test(upper)) {
      return { entity: 'SHEET_STATUS', confidence: 0.80, corrected: normalized };
    }
    // Observation frequency (q4h, q2h, q1h)
    if (/^(?:q\d+h?|obs\s+q\d+h?)$/i.test(upper)) {
      return { entity: 'SHEET_STATUS', confidence: 0.72, corrected: normalized };
    }
    // Day number (Day 1, Day 3, D3)
    if (/^(?:day\s*#?\s*\d+|d\d+)$/i.test(upper)) {
      return { entity: 'SHEET_STATUS', confidence: 0.70, corrected: normalized };
    }
    return { entity: 'SHEET_STATUS', confidence: 0 };
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
      if (hasPotentialNameAnchor(row.entities)) score += 0.9;
      if (row.entities.some(entity => resolveAssemblyEntityType(entity) === 'DIAGNOSIS')) score += 0.2;
      if (row.entities.some(entity => ['ASSIGNED_DOCTOR', 'SHEET_STATUS'].includes(resolveAssemblyEntityType(entity)))) score += 0.12;
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
      assignedDoctor: null, sheetStatus: null,
      confidence: 0, warnings: [], flags: [],
      fieldConfidence: {}, rawEntityCount: cluster.length,
    };
    const structureRoles = [...new Set(cluster.map(entity => resolveEntityColumnRole(entity)).filter(Boolean))];
    const sheetContextCount = cluster.filter(entity => entity.meta?.sheetContext).length;
    const projectedColumnCount = cluster.filter(entity => entity.meta?.columnRole).length;

    const names = [];
    const diagnoses = [];
    const medications = [];
    const assignedDoctors = [];
    const sheetStatuses = [];
    const unknowns = [];
    let totalConf = 0, entityCount = 0;

    for (const entity of cluster) {
      totalConf += entity.confidence;
      entityCount++;
      const assemblyEntity = resolveAssemblyEntityType(entity);

      switch (assemblyEntity) {
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
        case 'ASSIGNED_DOCTOR': assignedDoctors.push(entity); break;
        case 'SHEET_STATUS': sheetStatuses.push(entity); break;
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
        case 'MOBILITY':
          if (!patient.mobility || patient.mobility === 'AMBULATORY' || entity.confidence > (patient.fieldConfidence.mobility || 0)) {
            patient.mobility = entity.meta.mobility || entity.corrected;
            patient.fieldConfidence.mobility = entity.confidence;
          }
          break;
        case 'BLOOD_TYPE':
          if (!patient.bloodType || entity.confidence > (patient.fieldConfidence.bloodType || 0)) {
            patient.bloodType = entity.meta.bloodType || entity.corrected;
            patient.fieldConfidence.bloodType = entity.confidence;
          }
          break;
        case 'DOCTOR_TITLE':
          // "Dr." prefix — next NAME entity spatially to the right is the doctor
          const nextName = cluster
            .filter(e => e.entity === 'NAME' && e.box.cx > entity.box.cx && Math.abs(e.box.cy - entity.box.cy) < entity.box.h * 1.5)
            .sort((a, b) => a.box.cx - b.box.cx)[0];
          if (nextName) {
            assignedDoctors.push(nextName);
            // Remove from names to avoid double-counting
            const nameIdx = names.indexOf(nextName);
            if (nameIdx >= 0) names.splice(nameIdx, 1);
          }
          break;
        case 'UNKNOWN': unknowns.push(entity); break;
      }
    }

    // Resolve unknowns by spatial proximity
    const clusterMinX = Math.min(...cluster.map(entity => entity.box.x));
    const clusterMaxX = Math.max(...cluster.map(entity => entity.box.x + entity.box.w));
    const clusterSpan = Math.max(1, clusterMaxX - clusterMinX);
    const clinicalBoundary = Math.min(
      ...cluster
        .filter(entity => ['DIAGNOSIS', 'MEDICATION', 'ASSIGNED_DOCTOR', 'SHEET_STATUS', 'STATUS', 'O2', 'ISOLATION'].includes(resolveAssemblyEntityType(entity)))
        .map(entity => entity.box.x),
      Infinity
    );
    const likelyNameBoundary = Number.isFinite(clinicalBoundary)
      ? (clinicalBoundary - 10)
      : (clusterMinX + (clusterSpan * 0.48));
    const likelyDoctorBoundary = clusterMinX + (clusterSpan * 0.62);

    for (const unk of unknowns) {
      const unknownText = `${unk.corrected || unk.text || ''}`.trim();
      if (
        !patient.bed &&
        /^\d{1,3}(?:\s*-\s*\d{1,3})?$/.test(unknownText) &&
        unk.box.cx <= likelyNameBoundary &&
        (names.length > 0 || diagnoses.length > 0 || assignedDoctors.length > 0 || sheetStatuses.length > 0)
      ) {
        patient.bed = unknownText.replace(/\s+/g, '');
        patient.fieldConfidence.bed = Math.max(patient.fieldConfidence.bed || 0, 0.58);
        continue;
      }

      const likelyNameScore = scoreLikelyNameText(unk.corrected || unk.text);
      if (likelyNameScore >= 0.72 && unk.box.cx <= likelyNameBoundary) {
        names.push({ ...unk, entity: 'NAME', confidence: Math.max(unk.confidence, likelyNameScore) });
        continue;
      }
      if (likelyNameScore >= 0.76 && names.length > 0 && unk.box.cx >= likelyDoctorBoundary) {
        assignedDoctors.push({ ...unk, entity: 'ASSIGNED_DOCTOR', confidence: Math.max(unk.confidence, likelyNameScore) });
        continue;
      }

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
    if (assignedDoctors.length > 0) {
      const sortedDoctors = [...assignedDoctors].sort((a, b) => a.box.cx - b.box.cx);
      patient.assignedDoctor = [...new Set(sortedDoctors.map(e => (e.corrected || e.text).trim()).filter(Boolean))].join(' ');
      patient.fieldConfidence.assignedDoctor = average(assignedDoctors.map(e => e.confidence), 0.45);
    }
    if (sheetStatuses.length > 0) {
      const sortedStatuses = [...sheetStatuses].sort((a, b) => a.box.cx - b.box.cx);
      patient.sheetStatus = [...new Set(sortedStatuses.map(e => (e.corrected || e.text).trim()).filter(Boolean))].join(' ');
      patient.fieldConfidence.sheetStatus = average(sheetStatuses.map(e => e.confidence), 0.45);
    }

    const structuredCore = structureRoles.includes('NAME') && structureRoles.includes('DIAGNOSIS');
    const structuredSupportCount = ['ASSIGNED_DOCTOR', 'SHEET_STATUS', 'WARD', 'BED', 'GENDER', 'AGE_GENDER']
      .filter(role => structureRoles.includes(role)).length;
    const structuredRosterTriplet = structuredCore && projectedColumnCount >= 3 && (patient.assignedDoctor || patient.sheetStatus);
    const sparseStructuredRoster = structuredRosterTriplet && !patient.bed && patient.age == null && !patient.gender && !patient.civilId;
    patient.structureRoles = structureRoles;
    patient.sheetContextCount = sheetContextCount;
    patient.structuredConfidence = clamp(
      (structuredCore ? 0.48 : 0) +
      (Math.min(structuredSupportCount, 4) * 0.08) +
      (Math.min(projectedColumnCount, 6) * 0.035) +
      (Math.min(sheetContextCount, 3) * 0.05) +
      (structuredRosterTriplet ? 0.07 : 0) +
      (sparseStructuredRoster ? 0.04 : 0)
    );

    const baseConfidence = entityCount > 0 ? totalConf / entityCount : 0;
    let structureBonus = 0;
    if (patient.fullName && patient.dx && structuredCore) structureBonus += 0.12;
    if (patient.assignedDoctor && structureRoles.includes('ASSIGNED_DOCTOR')) structureBonus += 0.05;
    if (patient.sheetStatus && structureRoles.includes('SHEET_STATUS')) structureBonus += 0.04;
    if (patient.ward && structureRoles.includes('WARD')) structureBonus += 0.04;
    if (sheetContextCount > 0) structureBonus += Math.min(sheetContextCount, 2) * 0.03;
    if (projectedColumnCount >= 3) structureBonus += 0.05;
    if (structuredRosterTriplet) structureBonus += 0.06;
    if (sparseStructuredRoster) structureBonus += 0.04;

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
      { value: patient.fieldConfidence.assignedDoctor, weight: 0.35 },
      { value: patient.fieldConfidence.sheetStatus, weight: 0.3 },
      { value: patient.structuredConfidence, weight: 1.3 },
    ], baseConfidence) + (Math.min(cluster.length, 6) / 6 * 0.08) + structureBonus);

    // Only drop if truly empty — keep patients with civilId, age, or gender
    if (!patient.fullName && !patient.bed && diagnoses.length === 0 && !patient.civilId && patient.age == null) return null;
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
    const fullText = `${det.text || ''}`.trim();
    const pipeCells = fullText.includes('|')
      ? fullText
        .split('|')
        .map(cell => `${cell || ''}`.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
      : [];
    if (pipeCells.length > 1) {
      const totalChars = Math.max(pipeCells.reduce((sum, cell) => sum + Math.max(cell.length, 1), 0), 1);
      let currentX = det.box.x;

      pipeCells.forEach((cell, index) => {
        const remainingWidth = Math.max((det.box.x + det.box.w) - currentX, det.box.w * 0.12);
        const proportionalWidth = Math.max(det.box.w * (Math.max(cell.length, 1) / totalChars), det.box.w * 0.1, 36);
        const cellWidth = index === pipeCells.length - 1
          ? remainingWidth
          : Math.min(remainingWidth, proportionalWidth);

        result.push({
          text: cell,
          box: {
            x: currentX,
            y: det.box.y,
            w: cellWidth,
            h: det.box.h,
            cx: currentX + (cellWidth / 2),
            cy: det.box.cy,
          },
          confidence: det.confidence,
        });
        currentX += cellWidth;
      });
      continue;
    }

    const simpleTokens = fullText.split(/\s+/).filter(Boolean);
    const preservePhraseCell = (
      simpleTokens.length >= 2 &&
      simpleTokens.length <= 4 &&
      !/\d/.test(fullText) &&
      !/[\\/|,;]+/.test(fullText)
    );
    const preserveClinicalPhraseCell = (
      simpleTokens.length >= 2 &&
      simpleTokens.length <= 6 &&
      EntityRecognizer.scoreDiagnosis(fullText).confidence >= 0.76
    );
    if (
      isHeaderLike(fullText) ||
      EntityRecognizer.scoreWard(fullText).confidence >= 0.72 ||
      EntityRecognizer.scoreSheetStatus(fullText).confidence >= 0.76 ||
      preservePhraseCell ||
      preserveClinicalPhraseCell
    ) {
      result.push(det);
      continue;
    }

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
    const normalizedA = normalizeNameForMerge(a.fullName);
    const normalizedB = normalizeNameForMerge(b.fullName);
    const dist = ocrDistance(normalizedA, normalizedB);
    const minNameLength = Math.min(normalizedA.length, normalizedB.length);
    const multiWordNames = /\s/.test(a.fullName) && /\s/.test(b.fullName);
    const shortSingleTokenPair = !multiWordNames && minNameLength < 8;
    const strictDistance = shortSingleTokenPair ? 1 : 2;
    if (dist <= strictDistance) return true;

    const agesCompatible = a.age == null || b.age == null || Math.abs(a.age - b.age) <= 2;
    const gendersCompatible = !a.gender || !b.gender || a.gender === b.gender;
    const relaxedDistance = shortSingleTokenPair ? 2 : 4;
    if (agesCompatible && gendersCompatible && dist <= relaxedDistance && !shortSingleTokenPair) return true;
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

function scoreLikelyNameText(text) {
  const raw = `${text || ''}`.trim();
  if (!raw || raw.length < 2 || /\d/.test(raw) || isHeaderLike(raw)) return 0;
  if (EntityRecognizer.scoreWard(raw).confidence > 0.72) return 0;
  if (EntityRecognizer.scoreSheetStatus(raw).confidence > 0.76) return 0;
  if (EntityRecognizer.scoreStatus(raw.toUpperCase()).confidence > 0.82) return 0;
  if (EntityRecognizer.scoreO2(raw).confidence > 0.82) return 0;
  if (EntityRecognizer.scoreIsolation(raw.toUpperCase()).confidence > 0.82) return 0;

  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return 0;
  const normalizedWords = words
    .map(word => word.replace(/^[?.]+|[.,;:!?]+$/g, ''))
    .filter(Boolean);
  if (normalizedWords.length !== words.length) return 0;
  if (!normalizedWords.every(word => /^[A-Za-z\u0600-\u06FF][A-Za-z\u0600-\u06FF'’`-]*$/.test(word))) return 0;

  const fullMatch = MedicalVocabulary.lookupName(raw)?.confidence || 0;
  const tokenMatch = Math.max(...normalizedWords.map(word => MedicalVocabulary.lookupName(word)?.confidence || 0), 0);
  const lexiconConfidence = Math.max(fullMatch, tokenMatch);
  const diagnosisEvidence = collectDiagnosisEvidence(raw);

  const clinicalHits = normalizedWords.filter(word =>
    MedicalVocabulary.correctTerm(word, 1) ||
    MedicalVocabulary.correctMedication(word, 1) ||
    EntityRecognizer.scoreWard(word).confidence > 0.72 ||
    EntityRecognizer.scoreSheetStatus(word).confidence > 0.76
  ).length;
  if (clinicalHits >= Math.max(1, Math.ceil(normalizedWords.length / 2)) && lexiconConfidence < 0.7) return 0;
  if (
    diagnosisEvidence.termMatches.length >= 2 ||
    diagnosisEvidence.termMatches.some(match => match.len >= 2) ||
    (diagnosisEvidence.startsWithClinicalTerm && diagnosisEvidence.detailHits > 0)
  ) return 0;

  if (lexiconConfidence >= 0.9) return normalizedWords.length >= 2 ? 0.95 : 0.84;
  if (lexiconConfidence >= 0.78) return normalizedWords.length >= 2 ? 0.88 : 0.78;
  if (/[\u0600-\u06FF]/.test(raw)) return normalizedWords.length >= 2 ? 0.82 : 0.68;
  if (normalizedWords.length >= 2 && normalizedWords.every(word => /^[A-Za-z][A-Za-z'’-]{1,}$/.test(word))) {
    const capitalized = normalizedWords.filter(word => /^[A-Z]/.test(word)).length;
    if (capitalized >= 1 || normalizedWords.every(word => /^[a-z]/.test(word))) return 0.66;
  }
  if (normalizedWords.length === 1 && (/^[A-Z][a-z]{2,20}$/.test(raw) || /^[a-z]{3,20}$/.test(raw))) return 0.52;
  return 0;
}

function hasPotentialNameAnchor(entities) {
  if (!entities.length) return false;
  const minX = Math.min(...entities.map(entity => entity.box.x));
  const maxX = Math.max(...entities.map(entity => entity.box.x + entity.box.w));
  const span = Math.max(1, maxX - minX);

  return entities.some(entity => {
    const assemblyEntity = resolveAssemblyEntityType(entity);
    if (assemblyEntity === 'NAME' || entity.meta?.columnRole === 'NAME') return true;
    const likelyNameScore = scoreLikelyNameText(entity.corrected || entity.text);
    if (likelyNameScore < 0.72) return false;
    return ((entity.box.cx - minX) / span) <= 0.48;
  });
}

function rowIdentityScore(entities) {
  let score = 0;
  if (entities.some(entity => entity.entity === 'BED')) score += 1.2;
  if (entities.some(entity => entity.entity === 'NAME')) score += 1.05;
  if (entities.some(entity => entity.entity === 'AGE_GENDER')) score += 1;
  if (entities.some(entity => entity.entity === 'AGE')) score += 0.3;
  if (entities.some(entity => entity.entity === 'GENDER')) score += 0.25;
  if (entities.some(entity => entity.entity === 'CIVIL_ID')) score += 0.6;
  if (hasPotentialNameAnchor(entities)) score += 0.95;
  if (entities.some(entity => resolveAssemblyEntityType(entity) === 'DIAGNOSIS')) score += 0.2;
  if (entities.some(entity => ['ASSIGNED_DOCTOR', 'SHEET_STATUS'].includes(resolveAssemblyEntityType(entity)))) score += 0.12;
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
  return detectHeaderRole(text);
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
    ASSIGNED_DOCTOR: EntityRecognizer.scoreName.bind(EntityRecognizer),
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
    SHEET_STATUS: EntityRecognizer.scoreSheetStatus.bind(EntityRecognizer),
    WARD: EntityRecognizer.scoreWard.bind(EntityRecognizer),
    CIVIL_ID: EntityRecognizer.scoreCivilId.bind(EntityRecognizer),
  };

  const scorer = scorerMap[role];
  if (!scorer) return { ...entity, meta: { ...(entity.meta || {}), columnRole: role } };

  const projected = role === 'STATUS' || role === 'ALLERGY'
    ? scorer(entity.text.toUpperCase())
    : scorer(entity.text);
  if (role === 'BED' && (!projected || projected.confidence <= 0)) {
    const normalizedBed = `${entity.text || ''}`.trim().toUpperCase().replace(/O/g, '0');
    if (/^\d{1,3}(?:\s*-\s*\d{1,3})?$/.test(normalizedBed)) {
      return {
        ...entity,
        entity: 'BED',
        confidence: clamp(Math.max(entity.confidence, /^\d{1,3}$/.test(normalizedBed) ? 0.56 : 0.82)),
        corrected: normalizedBed.replace(/\s+/g, ''),
        meta: { ...(entity.meta || {}), columnRole: role },
      };
    }
  }
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
  const headerRole = detectHeaderRole(text);
  if (headerRole) return headerRole;

  // Fallback: infer role from content patterns (was unreachable dead code before)
  const cleaned = `${text || ''}`.trim().replace(/[:\-]+$/, '');
  if (/^(?:o2|oxygen|airway|resp|fio2)$/i.test(cleaned)) return 'O2';
  if (/^(?:iso|isolation|precautions?)$/i.test(cleaned)) return 'ISOLATION';
  if (/^(?:mob|mobility|transport)$/i.test(cleaned)) return 'MOBILITY';
  if (/^(?:blood|bt|bg|rh)$/i.test(cleaned)) return 'BLOOD_TYPE';
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
    case 'ASSIGNED_DOCTOR':
      return 'ASSIGNED_DOCTOR';
    case 'SHEET_STATUS':
      return 'SHEET_STATUS';
    case 'WARD':
      return 'WARD';
    case 'CIVIL_ID':
      return 'CIVIL_ID';
    case 'O2':
      return 'O2';
    case 'ISOLATION':
      return 'ISOLATION';
    case 'MOBILITY':
      return 'MOBILITY';
    case 'BLOOD_TYPE':
      return 'BLOOD_TYPE';
    default:
      return null;
  }
}

function resolveAssemblyEntityType(entity) {
  const columnRole = entity.meta?.columnRole;
  if (!columnRole) return entity.entity;

  const projectedEntityType = mapColumnRoleToEntityType(columnRole);
  if (!['NAME', 'DIAGNOSIS', 'MEDICATION', 'ALLERGY', 'STATUS', 'ASSIGNED_DOCTOR', 'SHEET_STATUS', 'WARD', 'O2', 'ISOLATION'].includes(projectedEntityType)) {
    return entity.entity;
  }

  const currentRole = mapEntityToColumnRole(entity.entity);
  if (!currentRole) return projectedEntityType;
  if (currentRole === columnRole) return entity.entity;
  if (entity.entity === 'WARD' && entity.meta?.ward && (entity.confidence || 0) >= 0.72) {
    return 'WARD';
  }

  if (['UNKNOWN', 'NAME', 'DIAGNOSIS', 'MEDICATION', 'WARD'].includes(entity.entity)) {
    return projectedEntityType;
  }

  return entity.entity;
}

function mapColumnRoleToEntityType(role) {
  switch (role) {
    case 'NAME':
      return 'NAME';
    case 'DIAGNOSIS':
      return 'DIAGNOSIS';
    case 'MEDICATION':
      return 'MEDICATION';
    case 'ALLERGY':
      return 'ALLERGY';
    case 'STATUS':
      return 'STATUS';
    case 'ASSIGNED_DOCTOR':
      return 'ASSIGNED_DOCTOR';
    case 'SHEET_STATUS':
      return 'SHEET_STATUS';
    case 'WARD':
      return 'WARD';
    case 'O2':
      return 'O2';
    case 'ISOLATION':
      return 'ISOLATION';
    default:
      return role;
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

  const inferred = bands
    .map(band => {
      const roleWeights = new Map();
      band.entities.forEach(entity => {
        const role = mapEntityToColumnRole(entity.entity);
        if (role) {
          roleWeights.set(role, (roleWeights.get(role) || 0) + Math.max(entity.confidence || 0, 0.2));
        }

        const text = entity.corrected || entity.text || '';
        const likelyNameScore = scoreLikelyNameText(text);
        if (likelyNameScore >= 0.6) {
          roleWeights.set('NAME', (roleWeights.get('NAME') || 0) + likelyNameScore);
        }

        const sheetStatusScore = EntityRecognizer.scoreSheetStatus(text).confidence || 0;
        if (sheetStatusScore >= 0.72) {
          roleWeights.set('SHEET_STATUS', (roleWeights.get('SHEET_STATUS') || 0) + sheetStatusScore);
        }

        const wardScore = EntityRecognizer.scoreWard(text).confidence || 0;
        if (wardScore >= 0.72) {
          roleWeights.set('WARD', (roleWeights.get('WARD') || 0) + wardScore);
        }

        const diagnosisScore = EntityRecognizer.scoreDiagnosis(text).confidence || 0;
        if (diagnosisScore >= 0.5) {
          roleWeights.set('DIAGNOSIS', (roleWeights.get('DIAGNOSIS') || 0) + diagnosisScore);
        }
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

  const nameColumns = inferred.filter(column => column.role === 'NAME');
  if (nameColumns.length > 1) {
    const primaryName = nameColumns[0];
    nameColumns.slice(1).forEach(column => {
      if (column.centerX > (primaryName.centerX + Math.max(90, imageWidth * 0.14))) {
        column.role = 'ASSIGNED_DOCTOR';
      }
    });
  }

  return inferred;
}

function normalizeStructuredColumns(columns) {
  const sorted = [...columns].sort((a, b) => a.centerX - b.centerX);
  const merged = [];

  for (const column of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && previous.role === column.role && Math.abs(previous.centerX - column.centerX) <= 72) {
      previous.centerX = average([previous.centerX, column.centerX], previous.centerX);
      previous.support += column.support || 1;
      previous.confidence = Math.max(previous.confidence || 0, column.confidence || 0);
      continue;
    }
    merged.push({ ...column, support: column.support || 1 });
  }

  return merged;
}

function projectRowsToColumns(rows, columns) {
  const normalizedColumns = normalizeStructuredColumns(columns);
  return rows.map(row => row.map(entity => {
    const nearestColumn = normalizedColumns.reduce((best, column) => {
      if (!best) return column;
      return Math.abs(column.centerX - entity.box.cx) < Math.abs(best.centerX - entity.box.cx) ? column : best;
    }, null);
    return projectEntityByColumnRole(entity, nearestColumn?.role || null);
  }));
}

function resolveEntityColumnRole(entity) {
  return entity.meta?.columnRole || mapEntityToColumnRole(entity.entity);
}

function buildRowText(row) {
  return [...row]
    .sort((a, b) => a.box.cx - b.box.cx)
    .map(entity => entity.corrected || entity.text || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function describeProjectedRow(row) {
  const roles = [];
  const seenRoles = new Set();
  let headerCellCount = 0;
  let leftmost = Infinity;
  const wardContext = extractWardContext(row);
  const rowText = buildRowText(row);

  for (const entity of row) {
    if (entity.entity === 'HEADER' || isHeaderLike(entity.text)) headerCellCount++;

    const role = resolveEntityColumnRole(entity);
    if (role && !seenRoles.has(role)) {
      seenRoles.add(role);
      roles.push(role);
    }

    leftmost = Math.min(leftmost, entity.box.x);
  }

  const hasRole = role => seenRoles.has(role);
  let identityScore = 0;
  if (hasRole('BED')) identityScore += 1.2;
  if (hasRole('CIVIL_ID')) identityScore += 0.9;
  if (hasRole('NAME')) identityScore += 1;
  if (hasRole('AGE_GENDER')) identityScore += 0.85;
  if (hasRole('DIAGNOSIS')) identityScore += 0.45;
  if (hasRole('MEDICATION')) identityScore += 0.35;
  if (hasRole('ALLERGY')) identityScore += 0.25;
  if (hasRole('STATUS')) identityScore += 0.22;
  if (hasRole('O2')) identityScore += 0.2;
  if (hasRole('ISOLATION')) identityScore += 0.2;
  if (hasRole('WARD')) identityScore += 0.12;
  const strongHeaderRow = headerCellCount >= Math.max(2, Math.ceil(row.length * 0.6));
  const strongWardBanner = Boolean(
    wardContext &&
    row.length <= 3 &&
    !row.some(entity => ['BED', 'CIVIL_ID', 'NAME', 'AGE_GENDER', 'AGE', 'GENDER'].includes(resolveAssemblyEntityType(entity)))
  );

  return {
    roles,
    roleCount: roles.length,
    headerCellCount,
    strongHeaderRow,
    strongWardBanner,
    wardContext,
    entityCount: row.length,
    leftmost: Number.isFinite(leftmost) ? leftmost : 0,
    centerY: average(row.map(entity => entity.box.cy), 0),
    hasHardAnchor: hasRole('BED') || hasRole('CIVIL_ID'),
    hasSoftAnchor: hasRole('NAME') || hasRole('AGE_GENDER'),
    hasClinical: roles.some(role => ['DIAGNOSIS', 'MEDICATION', 'ALLERGY', 'STATUS', 'O2', 'ISOLATION'].includes(role)),
    identityScore,
    rowText,
  };
}

function isProjectedSectionRow(profile) {
  if (profile.strongHeaderRow || profile.strongWardBanner) return true;
  if (profile.hasHardAnchor || profile.hasSoftAnchor || profile.hasClinical) return false;
  if (profile.headerCellCount >= Math.max(1, Math.ceil(profile.entityCount / 2))) return true;
  return profile.roleCount > 0 && profile.roles.every(role => ['WARD', 'STATUS', 'SHEET_STATUS', 'O2', 'ISOLATION'].includes(role));
}

function shouldMergeProjectedContinuation(previousProfile, currentProfile, firstColumnX, avgHeight) {
  if (!previousProfile) return false;
  if (currentProfile.hasHardAnchor) return false;

  const yGap = Math.abs(currentProfile.centerY - previousProfile.centerY);
  if (yGap > Math.max(34, avgHeight * 1.75)) return false;

  const onlyContinuationRoles = currentProfile.roleCount > 0 && currentProfile.roles.every(role =>
    ['DIAGNOSIS', 'MEDICATION', 'ALLERGY', 'STATUS', 'SHEET_STATUS', 'ASSIGNED_DOCTOR', 'O2', 'ISOLATION', 'WARD'].includes(role)
  );
  if (onlyContinuationRoles) return true;

  const startsAfterIdentityColumns = currentProfile.leftmost > (firstColumnX + Math.max(28, avgHeight * 1.35));
  if (!currentProfile.hasSoftAnchor && currentProfile.roleCount <= 2 && (currentProfile.hasClinical || startsAfterIdentityColumns)) {
    return true;
  }
  if (currentProfile.roleCount === 1 && currentProfile.roles[0] === 'NAME' && startsAfterIdentityColumns) {
    return true;
  }

  return currentProfile.identityScore < 0.65 && startsAfterIdentityColumns;
}

function extractWardContext(row) {
  const rowText = buildRowText(row);
  const joinedWard = EntityRecognizer.scoreWard(rowText);
  if (joinedWard.confidence >= 0.72) {
    return joinedWard.meta?.ward || joinedWard.corrected || rowText;
  }

  const wardCandidates = row
    .map(entity => {
      const rescored = EntityRecognizer.scoreWard(entity.corrected || entity.text);
      if (rescored.confidence <= 0) return null;
      return {
        confidence: Math.max(entity.confidence || 0, rescored.confidence),
        ward: rescored.meta?.ward || entity.meta?.ward || rescored.corrected || entity.corrected || entity.text,
      };
    })
    .filter(Boolean);
  if (wardCandidates.length === 0) return null;
  const bestWard = wardCandidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
  return bestWard?.ward || null;
}

function extractSheetStatusContext(row) {
  const rowText = buildRowText(row);
  const normalized = normalizeSheetLabel(rowText);
  if (!normalized) return null;

  const explicitStatus = EntityRecognizer.scoreSheetStatus(normalized);
  if (explicitStatus.confidence >= 0.72) {
    return `${explicitStatus.corrected || normalized}`.trim().toUpperCase();
  }

  const contextualMatch = normalized.match(/\b(active|inactive|chronic|new|pending|follow\s*up|stable|unstable|critical|improving|deteriorating|worsening|resolved|deceased|expired|palliative)\b/i);
  if (contextualMatch?.[1]) {
    return contextualMatch[1].replace(/\s+/g, ' ').trim().toUpperCase();
  }

  return null;
}

function extractGenderContext(row) {
  const rowText = buildRowText(row);
  const normalized = normalizeSheetLabel(rowText);
  if (!normalized) return null;

  if (/\bmale\b/i.test(normalized) || /\b(?:\u0630\u0643\u0631|\u0631\u062C\u0644)\b/i.test(normalized)) return 'M';
  if (/\bfemale\b/i.test(normalized) || /\b(?:\u0623\u0646\u062B\u0649|\u0627\u0646\u062B\u0649|\u0627\u0645\u0631\u0623\u0629)\b/i.test(normalized)) return 'F';
  return null;
}

function createWardContextEntity(ward, row) {
  const anchor = row[0]?.box || { x: 0, y: 0, w: 1, h: 1, cx: 0, cy: 0 };
  return {
    text: ward,
    corrected: ward,
    entity: 'WARD',
    confidence: 0.88,
    sourceConfidence: 0.88,
    box: {
      x: anchor.x,
      y: anchor.y,
      w: Math.max(anchor.w, 1),
      h: Math.max(anchor.h, 1),
      cx: anchor.cx,
      cy: anchor.cy,
    },
    meta: { ward, sheetContext: true },
  };
}

function createSheetStatusContextEntity(status, row) {
  const anchor = row[row.length - 1]?.box || row[0]?.box || { x: 0, y: 0, w: 1, h: 1, cx: 0, cy: 0 };
  const normalized = `${status || ''}`.trim().toUpperCase();
  return {
    text: normalized,
    corrected: normalized,
    entity: 'SHEET_STATUS',
    confidence: 0.8,
    sourceConfidence: 0.8,
    box: {
      x: anchor.x,
      y: anchor.y,
      w: Math.max(anchor.w, 1),
      h: Math.max(anchor.h, 1),
      cx: anchor.cx,
      cy: anchor.cy,
    },
    meta: { sheetStatus: normalized, sheetContext: true },
  };
}

function createGenderContextEntity(gender, row) {
  const nameAnchor = row.find(entity => resolveAssemblyEntityType(entity) === 'NAME');
  const anchor = nameAnchor?.box || row[0]?.box || { x: 0, y: 0, w: 1, h: 1, cx: 0, cy: 0 };
  const normalized = `${gender || ''}`.trim().toUpperCase();
  return {
    text: normalized,
    corrected: normalized,
    entity: 'GENDER',
    confidence: 0.78,
    sourceConfidence: 0.78,
    box: {
      x: anchor.x,
      y: anchor.y,
      w: Math.max(anchor.w, 1),
      h: Math.max(anchor.h, 1),
      cx: anchor.cx,
      cy: anchor.cy,
    },
    meta: { gender: normalized, sheetContext: true },
  };
}

function mergeProjectedRows(rows, initialContext = {}) {
  if (rows.length === 0) return [];

  const avgHeight = average(rows.flat().map(entity => entity.box.h), 20);
  const firstColumnX = rows.flat().reduce((minX, entity) => Math.min(minX, entity.box.x), Infinity);
  const merged = [];
  let previousProfile = null;
  let currentWardContext = initialContext?.ward || null;
  let currentSheetStatusContext = initialContext?.sheetStatus || null;
  let currentGenderContext = initialContext?.gender || null;

  for (const row of rows) {
    const explicitWardContext = extractWardContext(row);
    if (explicitWardContext) currentWardContext = explicitWardContext;
    const explicitSheetStatusContext = extractSheetStatusContext(row);
    if (explicitSheetStatusContext) currentSheetStatusContext = explicitSheetStatusContext;
    const explicitGenderContext = extractGenderContext(row);
    if (explicitGenderContext) currentGenderContext = explicitGenderContext;

    const contextualRow = [...row];
    if (currentWardContext && !explicitWardContext && !row.some(entity => resolveAssemblyEntityType(entity) === 'WARD')) {
      contextualRow.push(createWardContextEntity(currentWardContext, row));
    }
    if (
      currentSheetStatusContext &&
      !explicitSheetStatusContext &&
      !row.some(entity => resolveAssemblyEntityType(entity) === 'SHEET_STATUS')
    ) {
      contextualRow.push(createSheetStatusContextEntity(currentSheetStatusContext, row));
    }
    if (
      currentGenderContext &&
      !explicitGenderContext &&
      !row.some(entity => ['GENDER', 'AGE_GENDER'].includes(resolveAssemblyEntityType(entity)))
    ) {
      contextualRow.push(createGenderContextEntity(currentGenderContext, row));
    }
    const profile = describeProjectedRow(contextualRow);
    if (isProjectedSectionRow(profile)) continue;

    if (merged.length > 0 && shouldMergeProjectedContinuation(previousProfile, profile, firstColumnX, avgHeight)) {
      merged[merged.length - 1].push(...contextualRow);
      merged[merged.length - 1].sort((a, b) => a.box.cy - b.box.cy || a.box.cx - b.box.cx);
      previousProfile = describeProjectedRow(merged[merged.length - 1]);
      continue;
    }

    merged.push([...contextualRow]);
    previousProfile = profile;
  }

  return merged;
}

function patientHasStrongIdentity(patient) {
  return Boolean(
    isSparseStructuredRosterPatient(patient) ||
    (patient?.bed && patient?.fullName) ||
    (patient?.civilId && patient?.fullName) ||
    (patient?.fullName && (patient?.age != null || patient?.gender)) ||
    (patient?.fullName && patient?.ward && (patient?.assignedDoctor || patient?.sheetStatus || patient?.dx)) ||
    (
      patient?.fullName &&
      patient?.dx &&
      (
        patient?.assignedDoctor ||
        patient?.sheetStatus ||
        (patient?.structuredConfidence || 0) >= 0.72
      )
    )
  );
}

function patientAddsMissingDetail(existing, incoming) {
  return Boolean(
    (!existing?.fullName && incoming?.fullName) ||
    (!existing?.bed && incoming?.bed) ||
    (existing?.age == null && incoming?.age != null) ||
    (!existing?.gender && incoming?.gender) ||
    (!existing?.civilId && incoming?.civilId) ||
    (!existing?.meds && incoming?.meds) ||
    (!existing?.allergies && incoming?.allergies) ||
    (!existing?.assignedDoctor && incoming?.assignedDoctor) ||
    (!existing?.sheetStatus && incoming?.sheetStatus) ||
    (!existing?.ward && incoming?.ward) ||
    ((!existing?.o2 || existing.o2 === 'NONE') && incoming?.o2 && incoming.o2 !== 'NONE') ||
    ((!existing?.iso || existing.iso === 'NONE') && incoming?.iso && incoming.iso !== 'NONE')
  );
}

const TableHypothesisBuilder = {
  build(entities) {
    const rows = groupEntitiesIntoRows(entities);
    if (rows.length < 2) return null;

    let headerIndex = -1;
    let bestHeaderScore = 0;
    for (let i = 0; i < Math.min(rows.length, 6); i++) {
      const row = rows[i];
      const roleCount = new Set(row.map(entity => resolveColumnRole(entity.text)).filter(Boolean)).size;
      const headerLikeCount = row.filter(entity => isHeaderLike(entity.text)).length;
      const score = (roleCount * 1.5) + (headerLikeCount * 0.35);
      if (roleCount >= 2 && score > bestHeaderScore) {
        bestHeaderScore = score;
        headerIndex = i;
      }
    }
    if (headerIndex === -1) return null;
    if (headerIndex >= rows.length - 1) return null;

    const headerRow = rows[headerIndex];
    const columns = normalizeStructuredColumns(headerRow
      .map(entity => ({
        role: resolveColumnRole(entity.text),
        centerX: entity.box.cx,
        support: 1,
        confidence: entity.confidence || 0.98,
      }))
      .filter(column => column.role));
    if (columns.length < 2) return null;

    const projectedRows = projectRowsToColumns(rows.slice(headerIndex + 1), columns);
    const preHeaderRows = rows.slice(0, headerIndex);
    const initialWardContext = [...preHeaderRows]
      .reverse()
      .map(row => extractWardContext(row))
      .find(Boolean) || null;
    const initialSheetStatusContext = [...preHeaderRows]
      .reverse()
      .map(row => extractSheetStatusContext(row))
      .find(Boolean) || null;
    const initialGenderContext = [...preHeaderRows]
      .reverse()
      .map(row => extractGenderContext(row))
      .find(Boolean) || null;
    const clusters = mergeProjectedRows(projectedRows, {
      ward: initialWardContext,
      sheetStatus: initialSheetStatusContext,
      gender: initialGenderContext,
    });

    if (clusters.length === 0) return null;

    const coverage = new Set(clusters.flat().map(entityFingerprint)).size / Math.max(filterMeaningfulEntities(entities).length, 1);
    return {
      id: 'table-grid',
      clusters,
      structuralScore: clamp(0.9 + (Math.min(columns.length, 6) * 0.01), 0, 0.96),
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

    const projectedClusters = mergeProjectedRows(projectRowsToColumns(rows, columns));

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
    const ranked = [...hypotheses].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.patients.length !== a.patients.length) return b.patients.length - a.patients.length;
      return average(b.patients.map(patient => patient.confidence), 0) - average(a.patients.map(patient => patient.confidence), 0);
    });

    const best = ranked[0] || null;
    if (!best) return null;

    const nearStructured = ranked.find(hypothesis =>
      ['table-grid', 'schema-columns'].includes(hypothesis.id) &&
      ((best.score || 0) - (hypothesis.score || 0)) <= 0.03 &&
      hypothesis.patients.length >= Math.max(1, best.patients.length - 1)
    );

    return nearStructured || best;
  },

  fuse(best, hypotheses) {
    if (!best) return [];
    let merged = [...best.patients];
    const bestIsStructuredSheet = ['table-grid', 'schema-columns'].includes(best.id);

    for (const hypothesis of hypotheses) {
      if (hypothesis.id === best.id) continue;
      const conservativeFusion = (best.score || 0) >= 0.88 && (hypothesis.score || 0) <= (best.score || 0);
      const lessStructuredHypothesis = ['row-bands', 'lane-rows', 'spatial-cluster'].includes(hypothesis.id);
      for (const patient of hypothesis.patients) {
        const index = merged.findIndex(existing => shouldMerge(existing, patient));
        if (index === -1) {
          if (bestIsStructuredSheet && lessStructuredHypothesis) {
            if (!patientHasStrongIdentity(patient) || (patient.confidence || 0) < 0.92) continue;
          }
          if ((patient.confidence || 0) >= 0.55) merged.push(patient);
          continue;
        }

        const existing = merged[index];
        if (
          bestIsStructuredSheet &&
          patientHasStrongIdentity(existing) &&
          !patientAddsMissingDetail(existing, patient)
        ) {
          continue;
        }
        if (bestIsStructuredSheet && lessStructuredHypothesis && patientHasStrongIdentity(existing)) {
          continue;
        }
        if (
          bestIsStructuredSheet &&
          lessStructuredHypothesis &&
          patientHasStrongIdentity(existing) &&
          !patientAddsMissingDetail(existing, patient)
        ) {
          continue;
        }
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
  const isDict = key.endsWith('dict');

  // Check IndexedDB cache first
  const cached = await getCachedModel(key);
  if (cached) {
    // Validate cached data isn't corrupt (HTML error page, empty, etc.)
    if (isDict && typeof cached === 'string' && cached.length > 10 && !cached.startsWith('<!')) return cached;
    if (!isDict && cached instanceof ArrayBuffer && cached.byteLength > 1000) return cached;
    // Corrupt cache entry — clear it and re-fetch
    console.warn(`[OCR] Corrupt cache for ${key}, re-fetching...`);
    try {
      const db = await openModelCache();
      const tx = db.transaction('models', 'readwrite');
      tx.objectStore('models').delete(key);
    } catch {}
  }

  const sources = [
    { label: 'packaged', url },
    ...(fallbackUrl ? [{ label: 'remote', url: fallbackUrl }] : []),
  ];
  let lastError = null;

  for (const source of sources) {
    try {
      onProgress?.(`Loading ${key} (${source.label})...`);
      const response = await fetch(source.url);
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${source.label}`);

      // Validate content-type isn't HTML (error page served instead of binary)
      const ct = response.headers.get('content-type') || '';
      if (!isDict && ct.includes('text/html')) {
        throw new Error(`Got HTML instead of binary for ${key} from ${source.label}`);
      }

      const data = isDict ? await response.text() : await response.arrayBuffer();

      // Validate the fetched data
      if (isDict && (typeof data !== 'string' || data.length < 10 || data.startsWith('<!'))) {
        throw new Error(`Invalid dict data for ${key} from ${source.label}`);
      }
      if (!isDict && (!(data instanceof ArrayBuffer) || data.byteLength < 1000)) {
        throw new Error(`Invalid model data for ${key} from ${source.label} (${data?.byteLength || 0} bytes)`);
      }

      await setCachedModel(key, data);
      return data;
    } catch (error) {
      console.warn(`[OCR] Failed to load ${key} from ${source.label}:`, error.message);
      lastError = error;
    }
  }

  throw new Error(
    `Unable to load OCR asset "${key}". ${lastError?.message || 'No source succeeded.'}`
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
let arabicInitPromise = null;
let detBufferCached = null;

// Fast init — only loads Latin (det 2.4MB + rec 7.5MB). Arabic loads lazily.
async function initContextOCR(onProgress) {
  if (contextOcrRuntime) return contextOcrRuntime;
  if (contextOcrInitPromise) return contextOcrInitPromise;

  contextOcrInitPromise = (async () => {
    onProgress?.('Loading OCR engine...');

    ort.env.wasm.numThreads = Math.min(navigator.hardwareConcurrency || 1, 4);
    ort.env.wasm.simd = true;
    ort.env.wasm.wasmPaths = '/';

    // Only fetch detection + Latin — skips 9MB Arabic download on startup
    const [detBuffer, latinBuffer, latinDictRaw] = await Promise.all([
      fetchModelWithCache(MODEL_URLS.detection, onProgress),
      fetchModelWithCache({
        key: MODEL_URLS.latin.key, url: MODEL_URLS.latin.url,
        fallbackUrl: MODEL_URLS.latin.fallbackUrl,
      }, onProgress),
      fetchModelWithCache({
        key: MODEL_URLS.latin.dictKey, url: MODEL_URLS.latin.dictUrl,
        fallbackUrl: MODEL_URLS.latin.dictFallbackUrl,
      }, onProgress),
    ]);

    detBufferCached = detBuffer;

    onProgress?.('Starting OCR engine...');
    try {
      contextOcrRuntime = {
        latin: await createScriptService(detBuffer, latinBuffer, parseDictionary(latinDictRaw), false),
        arabic: null, // loaded on demand
      };
    } catch (err) {
      contextOcrRuntime = null;
      contextOcrInitPromise = null;
      throw new Error(`OCR engine init failed: ${err.message}. Clear browser data and reload.`);
    }

    return contextOcrRuntime;
  })().catch(err => {
    contextOcrInitPromise = null;
    throw err;
  });

  return contextOcrInitPromise;
}

// Lazy Arabic init — only called when shouldRunArabicAugment() returns true
async function ensureArabicOCR(onProgress) {
  if (contextOcrRuntime?.arabic) return contextOcrRuntime.arabic;
  if (arabicInitPromise) return arabicInitPromise;

  arabicInitPromise = (async () => {
    onProgress?.('Loading Arabic OCR...');
    const [arabicBuffer, arabicDictRaw] = await Promise.all([
      fetchModelWithCache({
        key: MODEL_URLS.arabic.key, url: MODEL_URLS.arabic.url,
        fallbackUrl: MODEL_URLS.arabic.fallbackUrl,
      }, onProgress),
      fetchModelWithCache({
        key: MODEL_URLS.arabic.dictKey, url: MODEL_URLS.arabic.dictUrl,
        fallbackUrl: MODEL_URLS.arabic.dictFallbackUrl,
      }, onProgress),
    ]);

    const detBuffer = detBufferCached || await fetchModelWithCache(MODEL_URLS.detection, onProgress);
    const arabic = await createScriptService(detBuffer, arabicBuffer, parseDictionary(arabicDictRaw), true);
    if (contextOcrRuntime) contextOcrRuntime.arabic = arabic;
    return arabic;
  })().catch(err => {
    arabicInitPromise = null;
    console.warn('[OCR] Arabic init failed:', err.message);
    return null;
  });

  return arabicInitPromise;
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

// ====== CONTEXT-AWARE ENTITY REFINEMENT ======
// Uses spatial neighbors and sequential patterns to fix misclassifications
function refineEntitiesByContext(entities, imageWidth) {
  if (entities.length <= 1) return entities;

  // Sort by reading order (top-to-bottom, left-to-right)
  const sorted = [...entities].sort((a, b) => {
    const rowDiff = Math.abs(a.box.cy - b.box.cy);
    if (rowDiff < Math.max(a.box.h, b.box.h) * 0.6) return a.box.cx - b.box.cx;
    return a.box.cy - b.box.cy;
  });

  // Group into rows for sequential analysis
  const avgHeight = average(sorted.map(e => e.box.h), 20);
  const rows = [];
  for (const entity of sorted) {
    const lastRow = rows[rows.length - 1];
    if (!lastRow || Math.abs(entity.box.cy - lastRow[lastRow.length - 1].box.cy) > avgHeight * 0.7) {
      rows.push([entity]);
    } else {
      lastRow.push(entity);
    }
  }

  // Rule 1: UNKNOWN token immediately after BED → likely NAME
  // Rule 2: UNKNOWN token immediately after NAME → likely continuation of NAME
  // Rule 3: DIAGNOSIS/MEDICATION between two NAME entities on same row → keep as-is (it's clinical)
  // Rule 4: NAME token that's the only one on a row with no BED → keep as NAME but mark for review
  // Rule 5: If a row has BED + UNKNOWN + AGE_GENDER, the UNKNOWN is almost certainly NAME
  for (const row of rows) {
    const meaningful = row.filter(e => e.entity !== 'NOISE' && e.entity !== 'HEADER');
    if (meaningful.length === 0) continue;

    for (let i = 0; i < meaningful.length; i++) {
      const current = meaningful[i];
      const prev = i > 0 ? meaningful[i - 1] : null;
      const next = i < meaningful.length - 1 ? meaningful[i + 1] : null;

      // Rule 1: UNKNOWN after BED → NAME
      if (current.entity === 'UNKNOWN' && prev?.entity === 'BED') {
        const nameCheck = MedicalVocabulary.lookupName(current.text);
        if (!MedicalVocabulary.MEDICAL_TERMS[current.text.toUpperCase()]) {
          current.entity = 'NAME';
          current.confidence = Math.max(current.confidence, nameCheck ? nameCheck.confidence : 0.55);
          current.meta = { ...current.meta, contextRefined: 'after-bed' };
        }
      }

      // Rule 2: UNKNOWN after NAME → likely continuation (family name)
      if (current.entity === 'UNKNOWN' && prev?.entity === 'NAME') {
        if (/^[A-Za-z\u0600-\u06FF]{2,}$/.test(current.text) && !MedicalVocabulary.MEDICAL_TERMS[current.text.toUpperCase()]) {
          current.entity = 'NAME';
          current.confidence = Math.max(current.confidence, 0.52);
          current.meta = { ...current.meta, contextRefined: 'after-name' };
        }
      }

      // Rule 5: UNKNOWN between BED and AGE_GENDER → NAME
      if (current.entity === 'UNKNOWN' && prev?.entity === 'BED' && next?.entity === 'AGE_GENDER') {
        current.entity = 'NAME';
        current.confidence = Math.max(current.confidence, 0.70);
        current.meta = { ...current.meta, contextRefined: 'bed-X-age' };
      }
      if (current.entity === 'UNKNOWN' &&
          meaningful.some(e => e.entity === 'BED') &&
          meaningful.some(e => e.entity === 'AGE_GENDER') &&
          current.box.cx > (meaningful.find(e => e.entity === 'BED')?.box.cx || 0) &&
          current.box.cx < (meaningful.find(e => e.entity === 'AGE_GENDER')?.box.cx || Infinity)) {
        if (/^[A-Za-z\u0600-\u06FF]{2,}$/.test(current.text)) {
          current.entity = 'NAME';
          current.confidence = Math.max(current.confidence, 0.65);
          current.meta = { ...current.meta, contextRefined: 'between-bed-age' };
        }
      }

      // Rule: Low-confidence NAME after DIAGNOSIS → probably more diagnosis text
      if (current.entity === 'NAME' && current.confidence < 0.55 && prev?.entity === 'DIAGNOSIS') {
        if (!MedicalVocabulary.lookupName(current.text)) {
          current.entity = 'DIAGNOSIS';
          current.confidence = prev.confidence * 0.8;
          current.meta = { ...current.meta, contextRefined: 'after-diagnosis' };
        }
      }

      // Rule: MEDICATION entity that's also a strong NAME → keep as NAME if in name column position
      if (current.entity === 'MEDICATION' && current.confidence < 0.7) {
        const nameMatch = MedicalVocabulary.lookupName(current.text);
        if (nameMatch && nameMatch.confidence >= 0.8) {
          // Check if it's in the left third of the image (name column position)
          if (current.box.cx < imageWidth * 0.35) {
            current.entity = 'NAME';
            current.confidence = nameMatch.confidence;
            current.meta = { ...current.meta, contextRefined: 'medication-to-name-by-position' };
          }
        }
      }
    }
  }

  return entities;
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
  const rawEntities = split.map(detection => EntityRecognizer.classify(detection));

  // 3b. Context-aware refinement — use spatial neighbors to fix misclassifications
  const entities = refineEntitiesByContext(rawEntities, imageWidth);
  const entityCount = entities.filter(entity => entity.entity !== 'NOISE' && entity.entity !== 'HEADER').length;
  console.log(`[OCR] Entities: ${entityCount} meaningful out of ${entities.length} total`);
  entities.filter(e => e.entity !== 'NOISE').slice(0, 15).forEach(e =>
    console.log(`[OCR]   "${e.text}" → ${e.entity} (conf=${e.confidence.toFixed(2)})`)
  );
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
  console.log(`[OCR] Final: ${finalized.length} patients, strategy=${bestHypothesis?.id || 'none'}, score=${analysisScore.toFixed(2)}`);
  finalized.forEach((p, i) => console.log(`[OCR]   Patient ${i+1}: "${p.fullName || '?'}" bed=${p.bed || '?'} age=${p.age ?? '?'} dx=${p.dx || '?'} conf=${(p.confidence || 0).toFixed(2)} review=${p.reviewLevel}`));

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
        if ((patient.confidence || 0) >= 0.55) mergedPatients.push(patient);
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
    console.log(`[OCR] Input: ${input.width}x${input.height}, ${input.data.length} bytes (${input.data.length / (input.width * input.height)} channels)`);
    const latinResults = await runtime.latin.recognize(input);
    console.log(`[OCR] Latin results: ${latinResults.length} detections`);
    if (latinResults.length > 0) {
      latinResults.slice(0, 10).forEach((r, i) => console.log(`[OCR]   ${i}: "${r.text}" conf=${r.confidence?.toFixed(2)} box=${JSON.stringify(r.box)}`));
      if (latinResults.length > 10) console.log(`[OCR]   ... and ${latinResults.length - 10} more`);
    }

    onProgress?.(`Analyzing patient structure (${variant.label})...`);
    let candidate = buildPassCandidate(latinResults, variant.canvas, variant.id, {
      backend: 'paddle-latin',
      scripts: ['latin'],
    });

    if (shouldRunArabicAugment(candidate)) {
      const arabic = await ensureArabicOCR(onProgress);
      if (arabic) {
        onProgress?.(`Running Arabic rescue pass (${variant.label})...`);
        const arabicResults = await arabic.recognize(input);
        const fusedResults = fuseRecognitionResults(latinResults, arabicResults);
        const fusedCandidate = buildPassCandidate(fusedResults, variant.canvas, variant.id, {
          backend: 'paddle-dual',
          scripts: ['latin', 'arabic'],
        });
        if (fusedCandidate.qualityScore >= candidate.qualityScore) {
          candidate = fusedCandidate;
        }
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
        const arabic = await ensureArabicOCR(onProgress);
        if (arabic) {
          const arabicResults = await arabic.recognize(input);
          const fusedResults = fuseRecognitionResults(latinResults, arabicResults);
          const fusedCandidate = buildPassCandidate(fusedResults, variant.canvas, variant.id, {
            backend: 'paddle-dual',
            scripts: ['latin', 'arabic'],
          });
          if (fusedCandidate.qualityScore >= candidate.qualityScore) {
            candidate = fusedCandidate;
          }
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
  const patients = best.patients.map(p => {
    // Run brain: infer acuity, predict missing fields, normalize text
    const acuity = inferAcuity(p);
    const predictions = predictMissingFields(p);
    const finalDx = normalizeText(p.dx || predictions.inferredDx || '');

    return {
    ...p,
    dx: finalDx || p.dx || '',
    gender: p.gender || predictions.gender || 'M',
    triage: p.suggestedTriage || acuity.suggestedTriage || 'GREEN',
    mobility: p.suggestedMobility || acuity.suggestedMobility || 'AMBULATORY',
    o2: p.o2 || acuity.suggestedO2 || 'NONE',
    iso: p.iso || acuity.suggestedIso || 'NONE',
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
      acuityScore: acuity.acuityScore,
      acuitySignals: acuity.signals,
    },
  };
  });

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
export { disambiguate, inferAcuity, extractStructuredData, predictMissingFields, normalizeText, validateAgeDiagnosis } from './ocrBrain.js';
