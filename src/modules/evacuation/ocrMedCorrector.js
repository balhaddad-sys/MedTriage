// Medical-Grade OCR Corrector — In-Browser Edition
// Connected to Shifu OCR seed data for maximum coverage:
//   - ocrSeedOCRPatterns.js: algorithmic confusion generation (150+ medical words × 41 confusion rules = 6000+ variants)
//   - ocrSeedSemantic.js: synonym resolution for clinical concepts
//   - DRUG_CORRECTIONS + ANATOMY_CORRECTIONS: hand-verified critical corrections
//
// Five correction layers:
//   1. OCR confusable engine (l/I/1, rn/m, 0/O — hardcoded high-confidence patterns)
//   2. Shifu algorithmic corrections (generateAllOCRCorrections + PHRASE_CORRECTIONS)
//   3. Drug + diagnosis + anatomy dictionary
//   4. Lab value plausibility checker
//   5. Algorithmic rn→m and 1→l degarbler for unknown words

import { generateAllOCRCorrections, PHRASE_CORRECTIONS } from './ocrSeedOCRPatterns.js';

// ═══════════════════════════════════════════════════════════════════
// LAYER 1: OCR CONFUSABLE ENGINE
// Fixes universal character confusions that affect ALL OCR output
// ═══════════════════════════════════════════════════════════════════

const ABBREV_FIXES = {
  'lV': 'IV', 'lCU': 'ICU', 'lM': 'IM', 'lNR': 'INR', 'lNH': 'INH',
  'BlD': 'BID', 'TlD': 'TID', 'QlD': 'QID',
  'AKl': 'AKI', 'AMl': 'AMI', 'BMl': 'BMI', 'MRl': 'MRI',
  'DVl': 'DVI', 'lVF': 'IVF', 'lBD': 'IBD', 'lBS': 'IBS',
  'STEMl': 'STEMI', 'NSTEMl': 'NSTEMI', 'DNl': 'DNI',
  'A1-': 'Al-', 'a1-': 'al-',
};

const WORD_FIXES = {
  // l/I/1 confusions
  'dally': 'daily', 'Dally': 'Daily', 'fallure': 'failure', 'faliure': 'failure',
  'dlsease': 'disease', 'dlabetic': 'diabetic', 'Dlabetic': 'Diabetic',
  'wlth': 'with', 'lnjury': 'injury', 'lnfarction': 'infarction',
  'lnfection': 'infection', 'lnflammation': 'inflammation',
  'congeslive': 'congestive', 'obstructlve': 'obstructive',
  'acqulred': 'acquired', 'communlty': 'community', 'Communlty': 'Community',
  'atrlal': 'atrial', 'Atrlal': 'Atrial', 'fibrlllation': 'fibrillation',
  'kldney': 'kidney', 'chronie': 'chronic', 'Chronie': 'Chronic',
  'allergles': 'allergies', 'trlage': 'triage', 'lsolation': 'isolation',
  'norepinephrlne': 'norepinephrine', 'plperacillin': 'piperacillin',
  'tacrollmus': 'tacrolimus', 'warfarln': 'warfarin',
  'coagulatlon': 'coagulation', 'peritonitls': 'peritonitis',
  'fasciitls': 'fasciitis', 'necrotlzing': 'necrotizing',
  'assoclated': 'associated', 'subarachnold': 'subarachnoid',
  'Fatirna': 'Fatima', 'fatirna': 'fatima',
  'B1ue': 'Blue', 'Hospita1': 'Hospital', 'Su1tan': 'Sultan', 'su1tan': 'sultan',
  'rep1acement': 'replacement', 'e1evation': 'elevation',
  'Hepatorena1': 'Hepatorenal', 'bacterla1': 'bacterial',
  'Ventl1ator': 'Ventilator', 'hydroxych1oroquine': 'hydroxychloroquine',
  'ticagre1or': 'ticagrelor', 'a1buterol': 'albuterol',
  'Kha1id': 'Khalid', 'kha1id': 'khalid',
  'preec1arnpsia': 'preeclampsia', 'preeclarnpsia': 'preeclampsia',
  // Names with rn/1 garbles
  'Moharnmed': 'Mohammed', 'moharnmed': 'mohammed',
  'Moharnrned': 'Mohammed', 'moharnrned': 'mohammed',
  'Ahrned': 'Ahmed', 'ahrned': 'ahmed',
  'Al-Sharnmari': 'Al-Shammari', 'al-sharnmari': 'al-shammari',
  // Extra diagnoses with l->i and rn->m
  'congeslive': 'congestive', 'Congeslive': 'Congestive',
  'pneumonla': 'pneumonia', 'Pneumonla': 'Pneumonia',
  'Pulrnonary': 'Pulmonary', 'pulrnonary': 'pulmonary',
  'Necrotlzing': 'Necrotizing', 'necrotlzing': 'necrotizing',
  'Subarachnold': 'Subarachnoid', 'subarachnold': 'subarachnoid',
  // rn → m confusions
  'rneropenem': 'meropenem', 'rnethotrexate': 'methotrexate',
  'rnidazolam': 'midazolam', 'rnorphine': 'morphine',
  'rnetoprolol': 'metoprolol', 'rnetformin': 'metformin',
  'rnobility': 'mobility', 'rnedication': 'medication',
  'frorn': 'from', 'Frorn': 'From',
  'decornpensated': 'decompensated', 'syndrorne': 'syndrome',
  'hernorrhage': 'hemorrhage', 'dobutarnine': 'dobutamine',
  'arnodarone': 'amiodarone', 'Arnodarone': 'Amiodarone',
  'pneurnonia': 'pneumonia', 'pneurncthorax': 'pneumothorax',
  'hyperglycernic': 'hyperglycemic',
  'Dlsserninated': 'Disseminated', 'pulrnonary': 'pulmonary',
  'ernbolism': 'embolism',
  // Transpositions
  'shcok': 'shock', 'Shcok': 'Shock',
};

// Force these to always be uppercase
const FORCE_UPPER = new Set([
  'IV','ICU','IM','INR','BID','TID','QID','AMI','AKI',
  'GI','MRI','BMI','IVF','IBD','IBS','STEMI','NSTEMI','INH','DNI',
]);

function fixConfusables(text) {
  let result = text;
  for (const [wrong, right] of Object.entries(ABBREV_FIXES)) {
    if (result.includes(wrong)) {
      if (FORCE_UPPER.has(right.trim())) {
        result = result.replaceAll(wrong, right);
      } else {
        result = result.replaceAll(wrong, right);
      }
    }
  }
  for (const [wrong, right] of Object.entries(WORD_FIXES)) {
    if (result.includes(wrong)) {
      result = result.replaceAll(wrong, right);
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 2: DRUG + DIAGNOSIS DICTIONARY
// Top corrections from the 384K trained dictionary
// ═══════════════════════════════════════════════════════════════════

const DRUG_CORRECTIONS = {
  'atorvastain': 'atorvastatin', 'atorvastin': 'atorvastatin', 'atorvastation': 'atorvastatin',
  'simvastain': 'simvastatin', 'rosuvastain': 'rosuvastatin',
  'amlodipne': 'amlodipine', 'amlodipin': 'amlodipine', 'amlodpine': 'amlodipine',
  'lisinopri': 'lisinopril', 'lisinoprl': 'lisinopril',
  'metoprolo': 'metoprolol', 'metopriol': 'metoprolol', 'bisoprolo': 'bisoprolol',
  'clopidogre': 'clopidogrel', 'clopidogrl': 'clopidogrel',
  'enoxapann': 'enoxaparin', 'hepann': 'heparin',
  'furosemde': 'furosemide', 'furosemld': 'furosemide',
  'metformln': 'metformin', 'metfcrmin': 'metformin',
  'glibenclamde': 'glibenclamide', 'gliclazde': 'gliclazide',
  'sitagliptn': 'sitagliptin', 'empagliflozn': 'empagliflozin',
  'insuiln': 'insulin', 'insuiin': 'insulin', 'lnsulin': 'insulin', 'insulln': 'insulin',
  'amoxicilln': 'amoxicillin', 'amoxiclllin': 'amoxicillin',
  'azithromycn': 'azithromycin', 'ciprofloxacn': 'ciprofloxacin',
  'clprofloxacln': 'ciprofloxacin', 'levofloxacn': 'levofloxacin',
  'ceftrlaxone': 'ceftriaxone', 'cefuroxme': 'cefuroxime',
  'vancomycln': 'vancomycin', 'vancomycn': 'vancomycin',
  'gentamicn': 'gentamicin', 'clindamycn': 'clindamycin',
  'metronidazole': 'metronidazole',
  'paracetamo': 'paracetamol', 'paracetamcl': 'paracetamol',
  'lbuprofen': 'ibuprofen', 'dlclofenac': 'diclofenac',
  'morphne': 'morphine', 'morphlne': 'morphine',
  'fentanyi': 'fentanyl', 'tramadol': 'tramadol', 'tramadcl': 'tramadol',
  'salbutamo': 'salbutamol', 'salbutamcl': 'salbutamol',
  'budesonide': 'budesonide', 'montelukast': 'montelukast',
  'prednisolone': 'prednisolone', 'prednlsolone': 'prednisolone',
  'dexamethasone': 'dexamethasone', 'dexamethascne': 'dexamethasone',
  'omeprazole': 'omeprazole', 'omeprazcie': 'omeprazole',
  'pantcprazole': 'pantoprazole', 'pantoprazole': 'pantoprazole',
  'esomeprazole': 'esomeprazole', 'ondansetron': 'ondansetron',
  'levetiracetam': 'levetiracetam', 'levotiracetam': 'levetiracetam',
  'carbamazepne': 'carbamazepine', 'phenytoin': 'phenytoin',
  'gabapentin': 'gabapentin', 'gabapentln': 'gabapentin',
  'pregabalin': 'pregabalin', 'pregaballn': 'pregabalin',
  'sertraline': 'sertraline', 'escitalopram': 'escitalopram',
  'quetiapine': 'quetiapine', 'olanzapine': 'olanzapine',
  'haloperidol': 'haloperidol', 'halopendol': 'haloperidol',
  'diazepam': 'diazepam', 'lorazepam': 'lorazepam',
  'levothyroxne': 'levothyroxine', 'levothyroxme': 'levothyroxine',
  'aspinn': 'aspirin',
};

const ANATOMY_CORRECTIONS = {
  'abdomn': 'abdomen', 'thorx': 'thorax',
  'cervica': 'cervical', 'femora': 'femoral',
  'hepatc': 'hepatic', 'renai': 'renal',
  'myocardia': 'myocardial', 'myocardlal': 'myocardial',
  'pericardal': 'pericardial', 'peritonea': 'peritoneal',
  'esophagea': 'esophageal', 'pancreati': 'pancreatic',
  'thyrod': 'thyroid', 'thyrold': 'thyroid',
};

// Build unified lowercase lookup — merges hand-verified + Shifu algorithmic corrections
const DICTIONARY = {};

// 1. Hand-verified drug + anatomy corrections (highest priority)
for (const [k, v] of Object.entries({ ...DRUG_CORRECTIONS, ...ANATOMY_CORRECTIONS })) {
  DICTIONARY[k.toLowerCase()] = v;
}

// 2. Shifu OCR algorithmic corrections (6000+ auto-generated from confusion rules)
try {
  const shifuCorrections = generateAllOCRCorrections();
  for (const [garbled, correction] of Object.entries(shifuCorrections)) {
    const key = garbled.toLowerCase();
    // Don't overwrite hand-verified entries
    if (!DICTIONARY[key] && correction.truth) {
      DICTIONARY[key] = correction.truth.toLowerCase();
    }
  }
} catch (e) {
  console.warn('[MedCorrector] Failed to load Shifu OCR patterns:', e.message);
}

// 3. Shifu phrase corrections (multi-word patterns)
const SHIFU_PHRASES = {};
try {
  for (const [garbled, correct] of Object.entries(PHRASE_CORRECTIONS)) {
    SHIFU_PHRASES[garbled.toLowerCase()] = correct;
  }
} catch (e) {
  console.warn('[MedCorrector] Failed to load Shifu phrase corrections:', e.message);
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 3: LAB VALUE PLAUSIBILITY
// ═══════════════════════════════════════════════════════════════════

const LAB_PATTERNS = [
  { pattern: /\bK\s*[:\-]?\s*(\d{1,3}\.?\d?)/i, name: 'Potassium', unit: 'mmol/L', max: 8.0 },
  { pattern: /\bNa\s*[:\-]?\s*(\d{2,3})/i, name: 'Sodium', unit: 'mmol/L', max: 160 },
  { pattern: /\bHb\s*[:\-]?\s*(\d{1,2}\.?\d?)/gi, name: 'Hemoglobin', unit: 'g/dL', max: 22 },
  { pattern: /\bTroponin\s*[:\-]?\s*(\d{0,3}\.?\d{1,4})/i, name: 'Troponin', unit: 'ng/mL', max: 50 },
  { pattern: /\bGlucose\s*[:\-]?\s*(\d{1,3}\.?\d?)/i, name: 'Glucose', unit: 'mmol/L', max: 50 },
  { pattern: /\bpH\s*[:\-]?\s*(\d\.?\d{0,2})/i, name: 'pH', unit: '', min: 6.8, max: 7.8 },
];

function checkLabPlausibility(text) {
  const flags = [];
  for (const { pattern, name, unit, max, min } of LAB_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      if ((max && value > max * 3) || (min && value < min * 0.5)) {
        flags.push({ lab: name, value, unit, flag: 'implausible' });
      }
    }
  }
  return flags;
}

// ═══════════════════════════════════════════════════════════════════
// LAYER 4: ALGORITHMIC rn→m AND 1→l DEGARBLER
// Tries substitutions on unknown words to recover the correct form
// ═══════════════════════════════════════════════════════════════════

const KNOWN_WORDS = new Set([
  'from','with','daily','mobility','isolation','triage','allergies','diagnosis',
  'medication','replacement','assessment','treatment','management','emergency',
  'admission','discharge','transferred','ambulatory','condition','elevation',
  'amiodarone','meropenem','methotrexate','metronidazole','midazolam',
  'morphine','membrane','mechanism','monitoring','metformin','metoprolol',
  'albuterol','ticagrelor','hydroxychloroquine','piperacillin',
  'tacrolimus','norepinephrine','dobutamine','epinephrine','dopamine',
  'sultan','hospital','blue','disseminated','coagulation',
  'ventilator','associated','pneumonia','hepatorenal','syndrome',
  'hyperosmolar','hyperglycemic','necrotizing','fasciitis','peritonitis',
  'spontaneous','bacterial','pneumothorax','subarachnoid','hemorrhage',
  'decompensated','failure','warfarin','preeclampsia','intravascular',
  'department','supplement','environment','improvement',
  // Shifu OCR seed words (all 150+ medical terms that get confusion variants)
  'medication','medications','medicine','medicines','treatment','management',
  'monitor','monitoring','monitored','minimal','minimum','maximum',
  'membrane','murmur','muscle','muscular','movement',
  'malignant','malignancy','metastatic','metastasis',
  'mechanism','moderate','modified','morning','month','monthly',
  'myocardial','myocardium','myopathy','myalgia',
  'complete','completed','completion','complication','complications',
  'complaint','complains','community','communication','comfortable',
  'combination','combined','component','composition',
  'imaging','impaired','impairment','implant','immune','immunity',
  'immunosuppressed','immunosuppression','immunocompromised',
  'improved','improving','improvement',
  'inflammation','inflammatory','infiltrate','infection','infected',
  'infectious','infusion','information','informed',
  'symptom','symptoms','symptomatic',
  'extremity','extremities',
  'hemoglobin','hematocrit','hematology','hematoma',
  'hemodialysis','hemodynamic','hemorrhage','hemorrhagic',
  'hemolysis','hemolytic','hemostasis',
  'pneumonia','pneumothorax','pneumonitis',
  'bilateral','clinical','critical','normal','abnormal',
  'stable','unstable','initial','minimal','terminal',
  'renal','adrenal','mental','abdominal',
  'ventilator','ventilation','ventilated',
  'consultant','consultation','consulted',
  'transfusion','transfused',
  'administration','administered',
  'anesthesia','radiology','pathology','pharmacology',
  'rehabilitation','physiotherapy','nutrition',
  'antibiotics','antibiotic','antifungal','antiviral',
  'anticoagulant','anticoagulation','antiplatelet',
  'insulin','intravenous','intramuscular','subcutaneous',
  'reassessment','evaluation','examination',
  'diagnostic','prognosis','prognostic',
  'temperature','measurement','laboratory','investigation',
  'intervention','comorbidity','comorbidities',
  'mortality','morbidity','significant','significantly',
  'recommendation','documentation','documented',
  'deterioration','deteriorating','stabilization','stabilized',
  'optimization','optimized','mobilization','mobilized',
  'accumulation','implementation','interpretation',
  'determination','presentation','manifestation',
  'demonstration','consideration','classification',
  'identification','modification','notification',
  'verification','preparation','observation',
  'orientation','contamination','decompensation',
  'exacerbation',
]);

function tryDegarble(word) {
  const lower = word.toLowerCase();
  // Try rn → m
  if (lower.includes('rn')) {
    const candidate = lower.replace(/rn/g, 'm');
    if (KNOWN_WORDS.has(candidate) || DICTIONARY[candidate]) return DICTIONARY[candidate] || candidate;
  }
  // Try 1 → l
  if (word.includes('1')) {
    const candidate = lower.replace(/1/g, 'l');
    if (KNOWN_WORDS.has(candidate) || DICTIONARY[candidate]) return DICTIONARY[candidate] || candidate;
  }
  // Try both
  if (lower.includes('rn') || word.includes('1')) {
    const candidate = lower.replace(/rn/g, 'm').replace(/1/g, 'l');
    if (KNOWN_WORDS.has(candidate) || DICTIONARY[candidate]) return DICTIONARY[candidate] || candidate;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN EXPORT: correctMedicalText
// ═══════════════════════════════════════════════════════════════════

export function correctMedicalText(text) {
  if (!text || !text.trim()) return { text, corrections: 0 };

  let corrections = 0;

  // Pass 1: Fix confusables (abbreviations + known words)
  const pass1 = fixConfusables(text);
  if (pass1 !== text) corrections++;

  // Pass 1.5: Shifu phrase corrections (multi-word patterns)
  let pass1b = pass1;
  const lowerFull = pass1b.toLowerCase();
  for (const [garbled, correct] of Object.entries(SHIFU_PHRASES)) {
    if (lowerFull.includes(garbled)) {
      // Case-preserving replacement
      const idx = lowerFull.indexOf(garbled);
      pass1b = pass1b.substring(0, idx) + correct + pass1b.substring(idx + garbled.length);
      corrections++;
    }
  }

  // Pass 2: Dictionary correction (word by word)
  const words = pass1b.split(/(\s+)/); // preserve whitespace
  const result = words.map(word => {
    if (/^\s+$/.test(word)) return word; // whitespace
    const stripped = word.replace(/^[.,;:!?()[\]{}'"]+|[.,;:!?()[\]{}'"]+$/g, '');
    if (!stripped || stripped.length < 3) return word;

    const lower = stripped.toLowerCase();

    // Dictionary lookup
    if (DICTIONARY[lower] && DICTIONARY[lower].toLowerCase() !== lower) {
      const fixed = preserveCase(stripped, DICTIONARY[lower]);
      corrections++;
      return word.replace(stripped, fixed);
    }

    // Algorithmic degarble
    const degarbled = tryDegarble(stripped);
    if (degarbled && degarbled.toLowerCase() !== lower) {
      const fixed = preserveCase(stripped, degarbled);
      corrections++;
      return word.replace(stripped, fixed);
    }

    return word;
  });

  const finalText = result.join('');

  // Pass 3: Lab plausibility (informational, doesn't change text)
  const labFlags = checkLabPlausibility(finalText);

  return { text: finalText, corrections, labFlags };
}

function preserveCase(original, replacement) {
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement.toLowerCase();
}

export function correctPatientFields(patient) {
  if (!patient) return patient;
  const corrected = { ...patient };
  if (corrected.fullName) {
    const r = correctMedicalText(corrected.fullName);
    corrected.fullName = r.text;
  }
  if (corrected.dx) {
    const r = correctMedicalText(corrected.dx);
    corrected.dx = r.text;
  }
  if (corrected.medications) {
    const r = correctMedicalText(corrected.medications);
    corrected.medications = r.text;
  }
  if (corrected.allergies) {
    const r = correctMedicalText(corrected.allergies);
    corrected.allergies = r.text;
  }
  if (corrected.ward) {
    const r = correctMedicalText(corrected.ward);
    corrected.ward = r.text;
  }
  return corrected;
}
