// MedEvac Context OCR Engine
// Domain-specific OCR for hospital patient lists
// Uses Tesseract.js for raw OCR + medical context correction pipeline

// ====== LAYER 1: IMAGE PREPROCESSING ======
const ImagePreprocessor = {
  async process(imageSource) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = await this.loadImage(imageSource);

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    // Grayscale + contrast enhancement
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Grayscale
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // Contrast stretch
      const enhanced = Math.min(255, Math.max(0, (gray - 128) * 1.5 + 128));
      data[i] = data[i + 1] = data[i + 2] = enhanced;
    }

    // Adaptive threshold for binarization
    this.adaptiveThreshold(data, canvas.width, canvas.height);

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  },

  adaptiveThreshold(data, width, height, blockSize = 15, C = 10) {
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < gray.length; i++) {
      gray[i] = data[i * 4];
    }

    const half = Math.floor(blockSize / 2);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0, count = 0;
        for (let dy = -half; dy <= half; dy++) {
          for (let dx = -half; dx <= half; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              sum += gray[ny * width + nx];
              count++;
            }
          }
        }
        const threshold = sum / count - C;
        const idx = (y * width + x) * 4;
        const val = gray[y * width + x] > threshold ? 255 : 0;
        data[idx] = data[idx + 1] = data[idx + 2] = val;
      }
    }
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
      // Blob or File
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
      img.onerror = reject;
      if (source instanceof Blob) {
        img.src = URL.createObjectURL(source);
      } else if (typeof source === 'string') {
        img.src = source; // data URL or path
      } else {
        reject(new Error('Unsupported image source'));
      }
    });
  }
};

// ====== LAYER 3b: MEDICAL VOCABULARY ======
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

  correctTerm(rawText, vocabulary, maxDistance = 2) {
    const upper = rawText.toUpperCase().trim();
    if (vocabulary[upper]) return { term: upper, distance: 0, confidence: 1.0 };
    let bestMatch = null, bestDistance = Infinity;
    for (const term of Object.keys(vocabulary)) {
      const dist = this.levenshtein(upper, term);
      if (dist < bestDistance && dist <= maxDistance) {
        bestDistance = dist;
        bestMatch = term;
      }
    }
    if (bestMatch) {
      return { term: bestMatch, distance: bestDistance, confidence: 1 - (bestDistance / Math.max(rawText.length, bestMatch.length)) };
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

  isMedicalTerm(text) {
    const upper = text.toUpperCase().trim();
    if (this.MEDICAL_TERMS[upper]) return true;
    const correction = this.correctTerm(upper, this.MEDICAL_TERMS, 1);
    return correction !== null;
  },
};

// ====== LAYER 3c: SEQUENTIAL CONTEXT PREDICTOR ======
const SequentialContextPredictor = {
  parseLine(text) {
    const tokens = this.tokenize(text);
    const fields = {};
    let state = 'START';
    const diagTokens = [];
    const medTokens = [];

    for (const token of tokens) {
      const classification = this.classifyToken(token, state);
      switch (classification.type) {
        case 'BED':
          fields.bed = token; state = 'AFTER_BED'; break;
        case 'NAME':
          fields.fullName = fields.fullName ? fields.fullName + ' ' + token : token;
          state = 'IN_NAME'; break;
        case 'AGE_GENDER': {
          const match = token.match(/(\d+)\s*[/\\]?\s*([MFmf])/);
          if (match) { fields.age = parseInt(match[1]); fields.gender = match[2].toUpperCase(); }
          state = 'AFTER_AGE'; break;
        }
        case 'AGE': fields.age = parseInt(token); state = 'AFTER_AGE'; break;
        case 'GENDER': fields.gender = token.toUpperCase(); state = 'AFTER_AGE'; break;
        case 'MEDICAL_TERM': diagTokens.push(token); state = 'IN_DIAGNOSIS'; break;
        case 'MEDICATION': medTokens.push(token); state = 'IN_MEDICATIONS'; break;
        default:
          if (state === 'AFTER_BED' || state === 'START') {
            fields.fullName = fields.fullName ? fields.fullName + ' ' + token : token;
            state = 'IN_NAME';
          } else if (state === 'IN_NAME') {
            if (/^\d{1,3}$/.test(token) && parseInt(token) > 0 && parseInt(token) < 130) {
              fields.age = parseInt(token); state = 'AFTER_AGE';
            } else {
              fields.fullName += ' ' + token;
            }
          } else if (state === 'IN_DIAGNOSIS' || state === 'AFTER_AGE') {
            const correction = MedicalVocabulary.correctTerm(token, MedicalVocabulary.MEDICAL_TERMS, 2);
            if (correction) { diagTokens.push(correction.term); state = 'IN_DIAGNOSIS'; }
            else {
              const medCorrection = MedicalVocabulary.correctMedication(token, 3);
              if (medCorrection) { medTokens.push(medCorrection.term); state = 'IN_MEDICATIONS'; }
            }
          }
      }
    }

    if (diagTokens.length > 0) fields.dx = diagTokens.join(', ');
    if (medTokens.length > 0) fields.meds = medTokens.join(', ');
    return fields;
  },

  classifyToken(token, currentState) {
    const clean = token.trim();
    if (/^[A-E]-[MF]-\d{1,2}$/i.test(clean)) return { type: 'BED' };
    if (/^#?\d{1,3}$/.test(clean) && currentState === 'START') return { type: 'BED' };
    if (/^\d{1,3}\s*[/\\]?\s*[MFmf]$/i.test(clean)) return { type: 'AGE_GENDER' };
    if (/^[MFmf]\s*[/\\]?\s*\d{1,3}$/i.test(clean)) return { type: 'AGE_GENDER' };
    if (/^[MFmf]$/.test(clean)) return { type: 'GENDER' };
    const medMatch = MedicalVocabulary.correctTerm(clean, MedicalVocabulary.MEDICAL_TERMS, 1);
    if (medMatch && medMatch.confidence >= 0.8) return { type: 'MEDICAL_TERM' };
    const medName = MedicalVocabulary.correctMedication(clean, 2);
    if (medName && medName.confidence >= 0.7) return { type: 'MEDICATION' };
    if (/[\u0600-\u06FF]/.test(clean) && clean.length >= 2) return { type: 'NAME' };
    if (/^[A-Z][a-z]+$/.test(clean) && (currentState === 'START' || currentState === 'AFTER_BED' || currentState === 'IN_NAME')) {
      return { type: 'NAME' };
    }
    if (/^\d{1,3}$/.test(clean)) {
      const num = parseInt(clean);
      if (num > 0 && num < 130 && (currentState === 'IN_NAME' || currentState === 'AFTER_BED')) return { type: 'AGE' };
    }
    return { type: 'UNKNOWN' };
  },

  tokenize(text) {
    return text.replace(/[,;|]/g, ' ').split(/\s+/).filter(t => t.length > 0);
  },
};

// ====== LAYER 3d: CLINICAL VALIDATOR ======
const ClinicalValidator = {
  validate(patient) {
    const warnings = [];

    if (patient.age != null) {
      if (patient.age < 0 || patient.age > 120) {
        warnings.push({ field: 'age', message: `Age ${patient.age} is implausible`, severity: 'ERROR' });
      }
      if (patient.age < 18 && patient.dx) {
        const adultDx = ['NSTEMI', 'STEMI', 'MI', 'CAD', 'AF', 'COPD', 'AAA'];
        for (const dx of adultDx) {
          if (patient.dx.includes(dx)) {
            warnings.push({ field: 'diagnosis', message: `${dx} is unusual in a ${patient.age}-year-old`, severity: 'WARN' });
          }
        }
      }
    }

    if (patient.gender && patient.dx) {
      const dx = patient.dx.toUpperCase();
      if (patient.gender === 'M' && /\bovarian\b|\bectopic pregnancy\b|\bendometri/i.test(dx)) {
        warnings.push({ field: 'gender', message: 'Female-specific diagnosis listed for male patient', severity: 'ERROR' });
      }
      if (patient.gender === 'F' && /\bprostate\b|\btesticular\b/i.test(dx)) {
        warnings.push({ field: 'gender', message: 'Male-specific diagnosis listed for female patient', severity: 'ERROR' });
      }
    }

    if (patient.meds && patient.dx) {
      if (/METFORMIN/i.test(patient.meds) && /(CKD5|ESRD)/i.test(patient.dx)) {
        warnings.push({ field: 'medications', message: 'Metformin contraindicated in CKD5/ESRD', severity: 'CLINICAL_ALERT' });
      }
      if (/INSULIN|GLARGINE|ASPART|LISPRO/i.test(patient.meds) && !/DM|DIABET|DKA|HHS/i.test(patient.dx)) {
        warnings.push({ field: 'diagnosis', message: 'Insulin prescribed but no diabetes in diagnosis', severity: 'WARN' });
      }
    }

    // Triage auto-suggestion
    if (patient.dx) {
      const dx = patient.dx.toUpperCase();
      if (/STEMI|CARDIAC ARREST|STATUS EPILEPT|ARDS|SEPTIC SHOCK|DKA|CVA|SAH|VF/i.test(dx)) {
        patient.suggestedTriage = 'RED';
      } else if (/NSTEMI|ACS|PE|DVT|AKI|ADHF|CHF|CAP|HAP|AECOPD|UGIB|SEPSIS|SBO/i.test(dx)) {
        patient.suggestedTriage = 'YELLOW';
      } else if (/UTI|CELLULITIS|HTN|DM[12]?$|CKD[1-3]|COPD$|GORD/i.test(dx)) {
        patient.suggestedTriage = 'GREEN';
      }
    }

    // Mobility auto-suggestion
    if (patient.dx) {
      const dx = patient.dx.toUpperCase();
      if (/VENTILAT|INTUBAT|ARDS|CARDIAC ARREST|ICU/i.test(dx)) {
        patient.suggestedMobility = 'CRITICAL_TRANSPORT';
      } else if (/CVA|STROKE|SAH|ICH|FRACTURE|GBS/i.test(dx)) {
        patient.suggestedMobility = 'STRETCHER';
      } else if (/CHF|ADHF|PE|COPD|AECOPD|CAP|O2/i.test(dx)) {
        patient.suggestedMobility = 'WHEELCHAIR';
      } else {
        patient.suggestedMobility = 'AMBULATORY';
      }
    }

    patient.warnings = warnings;
    return patient;
  },
};

// ====== LAYER 3e: ARABIC HANDLER ======
const ArabicHandler = {
  stripHarakat(text) {
    return text.replace(/[\u064B-\u065F\u0670]/g, '');
  },
  normalizeArabic(text) {
    let n = this.stripHarakat(text);
    n = n.replace(/[\u0623\u0625\u0622]/g, '\u0627');
    n = n.replace(/\u0629/g, '\u0647');
    n = n.replace(/\u0649/g, '\u064A');
    return n;
  },
  isRTL(text) {
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    return arabicChars > text.length * 0.3;
  },
};

// ====== TESSERACT LOADER (CDN) ======
let tesseractWorker = null;

async function loadTesseract() {
  if (tesseractWorker) return tesseractWorker;

  // Load Tesseract.js from CDN
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

// ====== SPATIAL LAYOUT ANALYZER ======
function analyzeRawText(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  const patients = [];

  for (const line of lines) {
    const parsed = SequentialContextPredictor.parseLine(line);
    if (parsed.fullName || parsed.bed) {
      const validated = ClinicalValidator.validate(parsed);
      patients.push(validated);
    }
  }

  return patients;
}

// ====== MAIN OCR FUNCTION ======
export async function processPatientListImage(imageSource, onProgress) {
  const startTime = performance.now();
  onProgress?.('Preprocessing image...');

  // Step 1: Preprocess
  let processedCanvas;
  try {
    processedCanvas = await ImagePreprocessor.process(imageSource);
  } catch {
    // If preprocessing fails, use raw image
    processedCanvas = imageSource;
  }

  // Step 2: OCR with Tesseract.js
  onProgress?.('Loading OCR engine...');
  const worker = await loadTesseract();

  onProgress?.('Recognizing text...');
  const { data } = await worker.recognize(processedCanvas);
  const rawText = data.text;

  if (!rawText || rawText.trim().length < 3) {
    return { patients: [], rawText: '', processingTime: performance.now() - startTime, engine: 'tesseract' };
  }

  // Step 3: Apply medical context engine
  onProgress?.('Applying medical context...');
  const patients = analyzeRawText(rawText);

  // Step 4: Set defaults
  for (const p of patients) {
    p.triage = p.suggestedTriage || 'GREEN';
    p.mobility = p.suggestedMobility || 'AMBULATORY';
    p.o2 = 'NONE';
    p.iso = 'NONE';
    p.code = 'FULL';
    p.allergies = 'NKDA';
    p.evac = 'IN_WARD';
    p.ocrImported = true;
  }

  return {
    patients,
    rawText,
    processingTime: performance.now() - startTime,
    engine: 'tesseract',
  };
}

export { MedicalVocabulary, ClinicalValidator, ArabicHandler };
