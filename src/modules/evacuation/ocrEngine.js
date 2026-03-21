// MedEvac OCR Engine v3 — Entity-First Spatial Clustering
// Handles: printed tables, handwritten lists, whiteboards, chaotic mixed layouts
// Architecture: Image → OCR boxes → Entity Recognition → DBSCAN Clustering → Patient Assembly

// ====== IMAGE PREPROCESSING ======
const ImagePreprocessor = {
  async prepareVariants(imageSource) {
    const baseCanvas = await this.process(imageSource);
    return OCR_PROFILES.map(profile => ({
      ...profile,
      canvas: this.applyProfile(baseCanvas, profile.id),
    }));
  },

  async process(imageSource) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = await this.loadImage(imageSource);

    // Downscale large images for performance (max 2200px on longest side)
    const maxDim = 2200;
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

const OCR_PROFILES = [
  { id: 'source', label: 'Source image' },
  { id: 'balanced', label: 'Balanced cleanup' },
  { id: 'high-contrast', label: 'High contrast' },
];

const REVIEW_PRIORITY = { READY: 0, REVIEW: 1, VERIFY: 2 };
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

  ARABIC_FIRST_NAMES: new Set([
    '\u0623\u062D\u0645\u062F', '\u0645\u062D\u0645\u062F', '\u0639\u0628\u062F\u0627\u0644\u0644\u0647', '\u062E\u0627\u0644\u062F',
    '\u0639\u0628\u062F\u0627\u0644\u0631\u062D\u0645\u0646', '\u0641\u0647\u062F', '\u0633\u0639\u0648\u062F', '\u0628\u062F\u0631',
    '\u064A\u0648\u0633\u0641', '\u0639\u0644\u064A', '\u062D\u0633\u064A\u0646', '\u062D\u0633\u0646', '\u0639\u0645\u0631',
    '\u0625\u0628\u0631\u0627\u0647\u064A\u0645', '\u0633\u0644\u0645\u0627\u0646', '\u0646\u0627\u0635\u0631',
    '\u062C\u0627\u0628\u0631', '\u0635\u0628\u0627\u062D', '\u0645\u0628\u0627\u0631\u0643', '\u0637\u0644\u0627\u0644',
    '\u0641\u064A\u0635\u0644', '\u0633\u0627\u0644\u0645', '\u0645\u0634\u0627\u0631\u064A', '\u0639\u0628\u062F\u0627\u0644\u0639\u0632\u064A\u0632',
    '\u0646\u0648\u0627\u0641', '\u062A\u0631\u0643\u064A', '\u0633\u0639\u062F', '\u0645\u0627\u062C\u062F',
    '\u0648\u0644\u064A\u062F', '\u0647\u0627\u0646\u064A', '\u0631\u0627\u0634\u062F', '\u0645\u0646\u0635\u0648\u0631',
    '\u0641\u0627\u0637\u0645\u0629', '\u0646\u0648\u0631\u0629', '\u0645\u0631\u064A\u0645', '\u0633\u0627\u0631\u0629',
    '\u0647\u064A\u0627', '\u062F\u0644\u0627\u0644', '\u0645\u0646\u064A\u0631\u0629', '\u0639\u0627\u0626\u0634\u0629',
  ]),

  FAMILY_NAMES: new Set([
    '\u0627\u0644\u0635\u0628\u0627\u062D', '\u0627\u0644\u0623\u062D\u0645\u062F', '\u0627\u0644\u0645\u0637\u064A\u0631\u064A',
    '\u0627\u0644\u0639\u0646\u0632\u064A', '\u0627\u0644\u0634\u0645\u0631\u064A', '\u0627\u0644\u0631\u0634\u064A\u062F\u064A',
    '\u0627\u0644\u0639\u062C\u0645\u064A', '\u0627\u0644\u062F\u0648\u0633\u0631\u064A', '\u0627\u0644\u0643\u0646\u062F\u0631\u064A',
    'Al-Sabah', 'Al-Mutairi', 'Al-Enezi', 'Al-Shammari', 'Al-Rashidi',
    'Al-Ajmi', 'Al-Dosari', 'Al-Kandari', 'Al-Atibi', 'Al-Harbi',
    'Al-Hajri', 'Al-Fadli', 'Al-Bloushi', 'Al-Saleh', 'Behbehani',
  ]),

  levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)
        );
      }
    }
    return dp[m][n];
  },

  correctTerm(rawText, maxDistance = 2) {
    const upper = rawText.toUpperCase().trim();
    if (this.MEDICAL_TERMS[upper]) return { term: upper, distance: 0, confidence: 1.0, info: this.MEDICAL_TERMS[upper] };
    let bestMatch = null, bestDistance = Infinity;
    for (const term of Object.keys(this.MEDICAL_TERMS)) {
      const dist = this.levenshtein(upper, term);
      if (dist < bestDistance && dist <= maxDistance) {
        bestDistance = dist;
        bestMatch = term;
      }
    }
    if (bestMatch) {
      return { term: bestMatch, distance: bestDistance, confidence: 1 - (bestDistance / Math.max(rawText.length, bestMatch.length)), info: this.MEDICAL_TERMS[bestMatch] };
    }
    return null;
  },

  correctMedication(rawText, maxDistance = 3) {
    const lower = rawText.toLowerCase().trim();
    let bestMatch = null, bestDistance = Infinity;
    for (const med of this.MEDICATIONS) {
      const dist = this.levenshtein(lower, med.toLowerCase());
      if (dist < bestDistance && dist <= maxDistance) {
        bestDistance = dist;
        bestMatch = med;
      }
    }
    if (bestMatch) {
      return { term: bestMatch, distance: bestDistance, confidence: 1 - (bestDistance / Math.max(rawText.length, bestMatch.length)) };
    }
    return null;
  },

  lookupName(text) {
    // Check against Arabic name databases
    const stripped = text.replace(/[\u064B-\u065F\u0670]/g, '');
    const normalized = stripped.replace(/[\u0623\u0625\u0622]/g, '\u0627').replace(/\u0629/g, '\u0647').replace(/\u0649/g, '\u064A');
    for (const name of this.ARABIC_FIRST_NAMES) {
      const normName = name.replace(/[\u0623\u0625\u0622]/g, '\u0627').replace(/\u0629/g, '\u0647').replace(/\u0649/g, '\u064A');
      if (normName === normalized) return { confidence: 1.0 };
      if (this.levenshtein(normalized, normName) <= 1) return { confidence: 0.8 };
    }
    for (const name of this.FAMILY_NAMES) {
      if (typeof name === 'string') {
        const normName = /[\u0600-\u06FF]/.test(name)
          ? name.replace(/[\u0623\u0625\u0622]/g, '\u0627').replace(/\u0629/g, '\u0647').replace(/\u0649/g, '\u064A')
          : name.toLowerCase();
        const compare = /[\u0600-\u06FF]/.test(text) ? normalized : text.toLowerCase();
        if (normName === compare) return { confidence: 1.0 };
        if (this.levenshtein(compare, normName) <= 1) return { confidence: 0.7 };
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
    if (/^[A-E]-[MF]-\d{1,2}$/i.test(t))
      return { entity: 'BED', confidence: 0.99, corrected: t.toUpperCase() };
    if (/^(?:bed|rm|room|\u0633\u0631\u064A\u0631|\u063A\u0631\u0641\u0629)\s*#?\s*(\d{1,3})/i.test(t))
      return { entity: 'BED', confidence: 0.9, corrected: t };
    if (/^[A-E]\d{1,2}$/i.test(t))
      return { entity: 'BED', confidence: 0.7, corrected: t.toUpperCase() };
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
    const clean = t.replace(/[\s\-]/g, '');
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
  // Tesseract.js word bbox: {x0, y0, x1, y1}
  if (box.x0 !== undefined) {
    const w = box.x1 - box.x0;
    const h = box.y1 - box.y0;
    return { x: box.x0, y: box.y0, w, h, cx: box.x0 + w / 2, cy: box.y0 + h / 2 };
  }
  // Array of 4 corner points (PaddleOCR)
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
    let current = { ...patients[i] };

    for (let j = i + 1; j < patients.length; j++) {
      if (used.has(j)) continue;
      if (shouldMerge(current, patients[j])) {
        current = mergePatients(current, patients[j]);
        used.add(j);
      }
    }
    merged.push(current);
    used.add(i);
  }
  return merged;
}

function shouldMerge(a, b) {
  if (a.bed && b.bed && a.bed === b.bed) return true;
  if (a.fullName && b.fullName) {
    const dist = MedicalVocabulary.levenshtein(normalizeNameForMerge(a.fullName), normalizeNameForMerge(b.fullName));
    if (dist < 3) return true;
  }
  return false;
}

function mergePatients(a, b) {
  const reviewLevel = (REVIEW_PRIORITY[a.reviewLevel] ?? 0) >= (REVIEW_PRIORITY[b.reviewLevel] ?? 0)
    ? a.reviewLevel
    : b.reviewLevel;
  return {
    fullName: (a.confidence >= b.confidence ? a.fullName : b.fullName) || a.fullName || b.fullName,
    age: a.age || b.age,
    gender: a.gender || b.gender,
    bed: a.bed || b.bed,
    dx: mergeListValues(a.dx, b.dx),
    meds: mergeListValues(a.meds, b.meds),
    allergies: a.allergies || b.allergies || 'NKDA',
    code: a.code || b.code || 'FULL',
    confidence: Math.max(a.confidence, b.confidence),
    warnings: dedupeWarnings([...(a.warnings || []), ...(b.warnings || [])]),
    suggestedTriage: a.suggestedTriage || b.suggestedTriage,
    suggestedMobility: a.suggestedMobility || b.suggestedMobility,
    fieldConfidence: { ...(a.fieldConfidence || {}), ...(b.fieldConfidence || {}) },
    rawEntityCount: (a.rawEntityCount || 0) + (b.rawEntityCount || 0),
    reviewLevel,
    reviewReasons: [...new Set([...(a.reviewReasons || []), ...(b.reviewReasons || [])])],
  };
}

// ====== TESSERACT LOADER ======
let tesseractWorker = null;

async function loadTesseract() {
  if (tesseractWorker) return tesseractWorker;

  if (!window.Tesseract) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    }).catch(() => {
      throw new Error('OCR runtime failed to load. Connect once to load the engine or bundle Tesseract locally before deployment.');
    });
  }

  tesseractWorker = await window.Tesseract.createWorker('eng+ara', 1, {
    logger: () => {},
  });

  return tesseractWorker;
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

  if (detections.length === 0) return { patients: [], entityCount: 0, clusterCount: 0, analysisScore: 0 };

  // 2. Split multi-term detections
  const split = splitDetections(detections);

  // 3. Classify every detection as an entity type
  const entities = split.map(d => EntityRecognizer.classify(d));
  const entityCount = entities.filter(e => e.entity !== 'NOISE' && e.entity !== 'HEADER').length;

  // 4. Spatial clustering — group entities into patients
  const clusters = SpatialClusterer.cluster(entities, imageWidth, imageHeight);

  // 5. Assemble each cluster into a patient record
  const patients = clusters
    .map(cluster => PatientAssembler.assemble(cluster))
    .filter(p => p !== null);

  const finalized = finalizePatients(patients);
  const analysisScore = clamp(
    (average(finalized.map(p => p.confidence), 0) * 0.62) +
    ((finalized.filter(p => p.reviewLevel === 'READY').length / Math.max(finalized.length, 1)) * 0.2) +
    (scoreTextDensity(finalized.map(p => [p.fullName, p.bed, p.dx].filter(Boolean).join(' ')).join(' ')) * 0.18)
  );
  return { patients: finalized, entityCount, clusterCount: clusters.length, analysisScore };
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

function buildPassCandidate(data, canvas, profileId) {
  const words = data.words && data.words.length > 0
    ? data.words.filter(w => w.text && w.text.trim().length > 0 && w.confidence > 12)
    : [];
  const analysis = words.length > 0
    ? analyzeOcrWords(words, canvas.width || 1000, canvas.height || 1000)
    : parseFromPlainText(data.text || '');
  const wordConfidence = average(
    words.map(w => Number.isFinite(w.confidence) ? w.confidence / 100 : 0),
    Number.isFinite(data.confidence) ? data.confidence / 100 : 0.4
  );
  const qualityScore = clamp((analysis.analysisScore * 0.62) + (wordConfidence * 0.24) + (scoreTextDensity(data.text || '') * 0.14));
  return {
    profileId,
    rawText: data.text || '',
    wordConfidence,
    qualityScore,
    qualityBand: confidenceBand(qualityScore),
    reviewCount: analysis.patients.filter(p => p.reviewLevel !== 'READY').length,
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

// ====== MAIN EXPORT ======
export async function processPatientListImage(imageSource, onProgress) {
  const startTime = performance.now();
  onProgress?.('Preparing image variants...');

  let variants;
  try {
    variants = await ImagePreprocessor.prepareVariants(imageSource);
  } catch {
    variants = [{ id: 'source', label: 'Source image', canvas: imageSource }];
  }

  onProgress?.('Loading OCR engine...');
  const worker = await loadTesseract();
  const candidates = [];

  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    onProgress?.(`Recognizing text (${variant.label}, pass ${i + 1}/${variants.length})...`);
    const { data } = await worker.recognize(variant.canvas);
    onProgress?.(`Analyzing patient structure (${variant.label})...`);
    const candidate = buildPassCandidate(data, variant.canvas, variant.id);
    candidates.push(candidate);

    const reviewThreshold = Math.ceil(Math.max(candidate.patients.length, 1) * 0.4);
    if (candidate.patients.length > 0 && candidate.qualityScore >= 0.86 && candidate.reviewCount <= reviewThreshold) {
      break;
    }
  }

  const best = pickBestCandidate(candidates);
  if (!best || (!best.rawText.trim() && best.patients.length === 0)) {
    return {
      patients: [],
      rawText: '',
      processingTime: performance.now() - startTime,
      engine: 'tesseract-v3-pro',
      entityCount: 0,
      clusterCount: 0,
      qualityScore: 0,
      qualityBand: 'LOW',
      profile: 'source',
      reviewCount: 0,
      passes: candidates.map(candidate => ({
        profile: candidate.profileId,
        qualityScore: candidate.qualityScore,
        qualityBand: candidate.qualityBand,
        patients: candidate.patients.length,
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
      engine: 'tesseract-v3-pro',
      profile: best.profileId,
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
    engine: 'tesseract-v3-pro',
    entityCount: best.entityCount,
    clusterCount: best.clusterCount,
    qualityScore: best.qualityScore,
    qualityBand: best.qualityBand,
    wordConfidence: best.wordConfidence,
    profile: best.profileId,
    reviewCount: best.reviewCount,
    passes: candidates.map(candidate => ({
      profile: candidate.profileId,
      qualityScore: candidate.qualityScore,
      qualityBand: candidate.qualityBand,
      patients: candidate.patients.length,
      reviewCount: candidate.reviewCount,
    })),
  };
}

export { MedicalVocabulary, ClinicalValidator };
