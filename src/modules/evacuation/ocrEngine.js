// MedEvac OCR Engine v3 — Entity-First Spatial Clustering
// Handles: printed tables, handwritten lists, whiteboards, chaotic mixed layouts
// Architecture: Image → OCR boxes → Entity Recognition → DBSCAN Clustering → Patient Assembly

// ====== IMAGE PREPROCESSING ======
const ImagePreprocessor = {
  async process(imageSource) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = await this.loadImage(imageSource);

    // Downscale large images for performance (max 2000px on longest side)
    const maxDim = 2000;
    let w = img.width, h = img.height;
    if (w > maxDim || h > maxDim) {
      const scale = maxDim / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);

    // Grayscale + contrast enhancement
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const enhanced = Math.min(255, Math.max(0, (gray - 128) * 1.4 + 128));
      data[i] = data[i + 1] = data[i + 2] = enhanced;
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
      img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
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

// ====== MEDICAL VOCABULARY ======
const MedicalVocabulary = {
  MEDICAL_TERMS: {
    // Cardiovascular
    'NSTEMI': { category: 'cardio', severity: 'RED' }, 'STEMI': { category: 'cardio', severity: 'RED' },
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
    // Endocrine
    'DM': { category: 'endo', severity: 'GREEN' }, 'DM1': { category: 'endo', severity: 'GREEN' },
    'DM2': { category: 'endo', severity: 'GREEN' }, 'T1DM': { category: 'endo', severity: 'GREEN' },
    'T2DM': { category: 'endo', severity: 'GREEN' }, 'DKA': { category: 'endo', severity: 'RED' },
    'HHS': { category: 'endo', severity: 'RED' }, 'HONK': { category: 'endo', severity: 'RED' },
    'HYPO': { category: 'endo', severity: 'YELLOW' },
    // Renal
    'CKD': { category: 'renal', severity: 'GREEN' }, 'CKD1': { category: 'renal', severity: 'GREEN' },
    'CKD2': { category: 'renal', severity: 'GREEN' }, 'CKD3': { category: 'renal', severity: 'GREEN' },
    'CKD3A': { category: 'renal', severity: 'GREEN' }, 'CKD3B': { category: 'renal', severity: 'YELLOW' },
    'CKD4': { category: 'renal', severity: 'YELLOW' }, 'CKD5': { category: 'renal', severity: 'RED' },
    'AKI': { category: 'renal', severity: 'RED' }, 'ESRD': { category: 'renal', severity: 'YELLOW' },
    'HD': { category: 'renal', severity: 'YELLOW' },
    // Respiratory
    'COPD': { category: 'resp', severity: 'GREEN' }, 'AECOPD': { category: 'resp', severity: 'YELLOW' },
    'CAP': { category: 'resp', severity: 'YELLOW' }, 'HAP': { category: 'resp', severity: 'YELLOW' },
    'VAP': { category: 'resp', severity: 'RED' }, 'ARDS': { category: 'resp', severity: 'RED' },
    'PTX': { category: 'resp', severity: 'RED' }, 'OSA': { category: 'resp', severity: 'GREEN' },
    'TB': { category: 'resp', severity: 'YELLOW' }, 'ILD': { category: 'resp', severity: 'YELLOW' },
    'LRTI': { category: 'resp', severity: 'YELLOW' },
    // Neurological
    'CVA': { category: 'neuro', severity: 'RED' }, 'TIA': { category: 'neuro', severity: 'YELLOW' },
    'SAH': { category: 'neuro', severity: 'RED' }, 'ICH': { category: 'neuro', severity: 'RED' },
    'SDH': { category: 'neuro', severity: 'RED' }, 'EDH': { category: 'neuro', severity: 'RED' },
    'SE': { category: 'neuro', severity: 'RED' }, 'GBS': { category: 'neuro', severity: 'RED' },
    'MG': { category: 'neuro', severity: 'YELLOW' }, 'MS': { category: 'neuro', severity: 'YELLOW' },
    // GI
    'UGIB': { category: 'gi', severity: 'RED' }, 'LGIB': { category: 'gi', severity: 'YELLOW' },
    'SBO': { category: 'gi', severity: 'YELLOW' }, 'LBO': { category: 'gi', severity: 'YELLOW' },
    'IBD': { category: 'gi', severity: 'YELLOW' }, 'UC': { category: 'gi', severity: 'YELLOW' },
    'CD': { category: 'gi', severity: 'YELLOW' }, 'SBP': { category: 'gi', severity: 'RED' },
    'HE': { category: 'gi', severity: 'YELLOW' }, 'GORD': { category: 'gi', severity: 'GREEN' },
    'PUD': { category: 'gi', severity: 'GREEN' },
    // Infectious
    'UTI': { category: 'infect', severity: 'GREEN' }, 'SEPSIS': { category: 'infect', severity: 'RED' },
    'SIRS': { category: 'infect', severity: 'YELLOW' }, 'MRSA': { category: 'infect', severity: 'YELLOW' },
    'CDI': { category: 'infect', severity: 'YELLOW' }, 'COVID': { category: 'infect', severity: 'YELLOW' },
    // Status
    'NKDA': { category: 'status' }, 'DNR': { category: 'status' }, 'DNAR': { category: 'status' },
    'FULL': { category: 'status' },
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
    const result = { text: t, box, entity: null, confidence: 0, corrected: t, meta: {} };

    if (t.length === 0 || /^[.,;:!?\-\u2013\u2014]+$/.test(t)) {
      result.entity = 'NOISE';
      return result;
    }

    const candidates = [
      this.scoreBed(t),
      this.scoreAgeGender(t),
      this.scoreAge(t),
      this.scoreGender(t),
      this.scoreName(t),
      this.scoreDiagnosis(upper),
      this.scoreMedication(t),
      this.scoreStatus(upper),
      this.scoreAllergy(upper),
    ].filter(c => c.confidence > 0.3);

    if (candidates.length === 0) {
      result.entity = 'UNKNOWN';
      result.confidence = 0.2;
      return result;
    }

    candidates.sort((a, b) => b.confidence - a.confidence);
    const best = candidates[0];
    result.entity = best.entity;
    result.confidence = best.confidence;
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

  scoreName(t) {
    let conf = 0;

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

  scoreDiagnosis(upper) {
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
    const meaningful = entities.filter(e => e.entity !== 'NOISE');
    if (meaningful.length === 0) return [];

    const eps = this.estimateEps(meaningful, imageHeight);
    const clusters = this.dbscan(meaningful, eps, 1);

    // Sort clusters top-to-bottom
    clusters.sort((a, b) => {
      const aY = a.reduce((s, e) => s + e.box.cy, 0) / a.length;
      const bY = b.reduce((s, e) => s + e.box.cy, 0) / b.length;
      return aY - bY;
    });

    return clusters;
  },

  estimateEps(entities, imgH) {
    if (entities.length <= 1) return imgH * 0.1;

    const yCenters = entities.map(e => e.box.cy).sort((a, b) => a - b);
    const gaps = [];
    for (let i = 1; i < yCenters.length; i++) {
      gaps.push(yCenters[i] - yCenters[i - 1]);
    }
    gaps.sort((a, b) => a - b);

    if (gaps.length === 0) return imgH * 0.1;

    const medianGap = gaps[Math.floor(gaps.length / 2)];
    const minEps = imgH * 0.03;
    const maxEps = imgH * 0.15;
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
};

// ====== STEP 3: PATIENT ASSEMBLY ======
const PatientAssembler = {
  assemble(cluster) {
    const patient = {
      fullName: null, age: null, gender: null, bed: null,
      dx: null, meds: null, allergies: null, code: null,
      confidence: 0, warnings: [], flags: [],
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
          if (!patient.bed || entity.confidence > 0.5) patient.bed = entity.corrected;
          break;
        case 'NAME': names.push(entity); break;
        case 'AGE_GENDER':
          patient.age = entity.meta.age;
          patient.gender = entity.meta.gender;
          break;
        case 'AGE':
          if (!patient.age) patient.age = entity.meta.age;
          break;
        case 'GENDER':
          if (!patient.gender) patient.gender = entity.meta.gender;
          break;
        case 'DIAGNOSIS': diagnoses.push(entity.corrected); break;
        case 'MEDICATION': medications.push(entity.corrected); break;
        case 'ALLERGY': patient.allergies = entity.corrected; break;
        case 'STATUS': patient.code = entity.corrected; break;
        case 'UNKNOWN': unknowns.push(entity); break;
      }
    }

    // Resolve unknowns by spatial proximity
    for (const unk of unknowns) {
      const nearName = this.findNearest(unk, cluster.filter(e => e.entity === 'NAME'));
      const nearDx = this.findNearest(unk, cluster.filter(e => e.entity === 'DIAGNOSIS'));

      if (nearName && (!nearDx || nearName.dist < nearDx.dist)) {
        names.push(unk); // Absorb into name
      } else if (nearDx) {
        diagnoses.push(unk.corrected);
      }
    }

    // Assemble name from spatial order
    if (names.length > 0) {
      const isArabic = /[\u0600-\u06FF]/.test(names[0].corrected || names[0].text);
      const sorted = [...names].sort((a, b) =>
        isArabic ? b.box.cx - a.box.cx : a.box.cx - b.box.cx
      );
      patient.fullName = sorted.map(e => e.corrected || e.text).join(' ');
    }

    if (diagnoses.length > 0) patient.dx = [...new Set(diagnoses)].join(', ');
    if (medications.length > 0) patient.meds = [...new Set(medications)].join(', ');
    patient.confidence = entityCount > 0 ? totalConf / entityCount : 0;

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

    // Auto-suggest triage
    if (patient.dx) {
      const dx = patient.dx.toUpperCase();
      if (/STEMI|CARDIAC ARREST|STATUS EPILEPT|ARDS|SEPTIC SHOCK|DKA|CVA|SAH|VF/i.test(dx))
        patient.suggestedTriage = 'RED';
      else if (/NSTEMI|ACS|PE|DVT|AKI|ADHF|CHF|CAP|HAP|AECOPD|UGIB|SEPSIS|SBO/i.test(dx))
        patient.suggestedTriage = 'YELLOW';
      else if (/UTI|CELLULITIS|HTN|DM[12]?$|CKD[1-3]|COPD$|GORD/i.test(dx))
        patient.suggestedTriage = 'GREEN';
    }

    // Auto-suggest mobility
    if (patient.dx) {
      const dx = patient.dx.toUpperCase();
      if (/VENTILAT|INTUBAT|ARDS|CARDIAC ARREST|ICU/i.test(dx))
        patient.suggestedMobility = 'CRITICAL_TRANSPORT';
      else if (/CVA|STROKE|SAH|ICH|FRACTURE|GBS/i.test(dx))
        patient.suggestedMobility = 'STRETCHER';
      else if (/CHF|ADHF|PE|COPD|AECOPD|CAP|O2/i.test(dx))
        patient.suggestedMobility = 'WHEELCHAIR';
      else
        patient.suggestedMobility = 'AMBULATORY';
    }

    patient.warnings = warnings;
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
    const parts = det.text.split(/\s+/).filter(t => t.length > 0);
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
    const dist = MedicalVocabulary.levenshtein(a.fullName.toUpperCase(), b.fullName.toUpperCase());
    if (dist < 3) return true;
  }
  return false;
}

function mergePatients(a, b) {
  return {
    fullName: (a.confidence >= b.confidence ? a.fullName : b.fullName) || a.fullName || b.fullName,
    age: a.age || b.age,
    gender: a.gender || b.gender,
    bed: a.bed || b.bed,
    dx: [a.dx, b.dx].filter(Boolean).join(', '),
    meds: [a.meds, b.meds].filter(Boolean).join(', '),
    allergies: a.allergies || b.allergies || 'NKDA',
    code: a.code || b.code || 'FULL',
    confidence: Math.max(a.confidence, b.confidence),
    warnings: [...(a.warnings || []), ...(b.warnings || [])],
    suggestedTriage: a.suggestedTriage || b.suggestedTriage,
    suggestedMobility: a.suggestedMobility || b.suggestedMobility,
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
    });
  }

  tesseractWorker = await window.Tesseract.createWorker('eng+ara', 1, {
    logger: () => {},
  });

  return tesseractWorker;
}

// ====== v3 PIPELINE: ENTITY-FIRST SPATIAL CLUSTERING ======
function processWithSpatialClustering(words, imageWidth, imageHeight) {
  // 1. Normalize bounding boxes
  const detections = words
    .filter(w => w.text && w.text.trim().length > 0)
    .map(w => ({
      text: w.text.trim(),
      box: normalizeBox(w.bbox || w),
      confidence: w.confidence || 0.5,
    }));

  if (detections.length === 0) return [];

  // 2. Split multi-term detections
  const split = splitDetections(detections);

  // 3. Classify every detection as an entity type
  const entities = split.map(d => EntityRecognizer.classify(d));

  // 4. Spatial clustering — group entities into patients
  const clusters = SpatialClusterer.cluster(entities, imageWidth, imageHeight);

  // 5. Assemble each cluster into a patient record
  const patients = clusters
    .map(cluster => PatientAssembler.assemble(cluster))
    .filter(p => p !== null);

  // 6. Clinical validation
  patients.forEach(p => ClinicalValidator.validate(p));

  // 7. Deduplicate
  return deduplicatePatients(patients);
}

// ====== FALLBACK: LINE-BASED PARSING (for plain text without boxes) ======
function parseFromPlainText(rawText) {
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

  // Run through same entity/clustering pipeline
  const entities = detections.map(d => EntityRecognizer.classify(d));
  const clusters = SpatialClusterer.cluster(entities, 1000, lines.length * lineHeight);
  const patients = clusters
    .map(cluster => PatientAssembler.assemble(cluster))
    .filter(p => p !== null);
  patients.forEach(p => ClinicalValidator.validate(p));
  return deduplicatePatients(patients);
}

// ====== MAIN EXPORT ======
export async function processPatientListImage(imageSource, onProgress) {
  const startTime = performance.now();
  onProgress?.('Preprocessing image...');

  // Step 1: Preprocess
  let processedCanvas;
  try {
    processedCanvas = await ImagePreprocessor.process(imageSource);
  } catch {
    processedCanvas = imageSource;
  }

  // Step 2: OCR with Tesseract.js
  onProgress?.('Loading OCR engine...');
  const worker = await loadTesseract();

  onProgress?.('Recognizing text...');
  const { data } = await worker.recognize(processedCanvas);

  if (!data.text || data.text.trim().length < 3) {
    return { patients: [], rawText: '', processingTime: performance.now() - startTime, engine: 'tesseract-v3', entityCount: 0, clusterCount: 0 };
  }

  // Step 3: v3 Entity-First Pipeline
  onProgress?.('Analyzing entities & clustering...');
  let patients;
  let entityCount = 0;
  let clusterCount = 0;

  // Use word-level bounding boxes if available (Tesseract provides these)
  if (data.words && data.words.length > 0) {
    const words = data.words.filter(w => w.text && w.text.trim().length > 0 && w.confidence > 20);
    const imgW = processedCanvas.width || 1000;
    const imgH = processedCanvas.height || 1000;

    // Normalize and split
    const detections = words.map(w => ({
      text: w.text.trim(),
      box: normalizeBox(w.bbox),
      confidence: w.confidence / 100,
    }));
    const split = splitDetections(detections);
    const entities = split.map(d => EntityRecognizer.classify(d));
    entityCount = entities.filter(e => e.entity !== 'NOISE').length;

    const clusters = SpatialClusterer.cluster(entities, imgW, imgH);
    clusterCount = clusters.length;

    patients = clusters
      .map(cluster => PatientAssembler.assemble(cluster))
      .filter(p => p !== null);
    patients.forEach(p => ClinicalValidator.validate(p));
    patients = deduplicatePatients(patients);
  } else {
    // Fallback: plain text parsing with synthetic positions
    patients = parseFromPlainText(data.text);
    entityCount = patients.length;
    clusterCount = patients.length;
  }

  // Step 4: Set defaults for import
  for (const p of patients) {
    p.triage = p.suggestedTriage || 'GREEN';
    p.mobility = p.suggestedMobility || 'AMBULATORY';
    p.o2 = p.o2 || 'NONE';
    p.iso = p.iso || 'NONE';
    p.code = p.code || 'FULL';
    p.allergies = p.allergies || 'NKDA';
    p.evac = 'IN_WARD';
    p.ocrImported = true;
  }

  return {
    patients,
    rawText: data.text,
    processingTime: performance.now() - startTime,
    engine: 'tesseract-v3',
    entityCount,
    clusterCount,
  };
}

export { MedicalVocabulary, ClinicalValidator };
