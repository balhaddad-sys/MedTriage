// OCR Brain — Clinical Intelligence Engine
//
// This is NOT a dictionary. This is a reasoning engine that:
//   1. UNDERSTANDS clinical context (what comes before/after matters)
//   2. RESOLVES ambiguity using medical logic (not just string matching)
//   3. PREDICTS missing data from what it already knows
//   4. VALIDATES data against clinical plausibility
//   5. EXTRACTS structured data from unstructured free text
//   6. NORMALIZES equivalent representations to canonical forms
//   7. DETECTS relationships between entities
//   8. INFERS acuity/severity from available signals

// ═══════════════════════════════════════════════════════════════════
// 1. CLINICAL CONTEXT RESOLVER
// "The same word means different things in different contexts"
// ═══════════════════════════════════════════════════════════════════

// Context-dependent disambiguation
const AMBIGUOUS_TERMS = {
  'AF': {
    cardiology: { meaning: 'Atrial fibrillation', entity: 'DIAGNOSIS', confidence: 0.95 },
    respiratory: { meaning: 'Air fluid level', entity: 'FINDING', confidence: 0.70 },
    default: { meaning: 'Atrial fibrillation', entity: 'DIAGNOSIS', confidence: 0.85 },
  },
  'MS': {
    neurology: { meaning: 'Multiple sclerosis', entity: 'DIAGNOSIS', confidence: 0.92 },
    cardiology: { meaning: 'Mitral stenosis', entity: 'DIAGNOSIS', confidence: 0.90 },
    general: { meaning: 'Mental status', entity: 'CLINICAL', confidence: 0.60 },
    default: { meaning: 'Multiple sclerosis', entity: 'DIAGNOSIS', confidence: 0.70 },
  },
  'PD': {
    neurology: { meaning: 'Parkinson disease', entity: 'DIAGNOSIS', confidence: 0.90 },
    nephrology: { meaning: 'Peritoneal dialysis', entity: 'PROCEDURE', confidence: 0.90 },
    default: { meaning: 'Parkinson disease', entity: 'DIAGNOSIS', confidence: 0.65 },
  },
  'ACS': {
    cardiology: { meaning: 'Acute coronary syndrome', entity: 'DIAGNOSIS', confidence: 0.95 },
    surgery: { meaning: 'Abdominal compartment syndrome', entity: 'DIAGNOSIS', confidence: 0.85 },
    default: { meaning: 'Acute coronary syndrome', entity: 'DIAGNOSIS', confidence: 0.85 },
  },
  'PE': {
    pulmonology: { meaning: 'Pulmonary embolism', entity: 'DIAGNOSIS', confidence: 0.92 },
    general: { meaning: 'Physical examination', entity: 'SECTION', confidence: 0.80 },
    default: { meaning: 'Physical examination', entity: 'SECTION', confidence: 0.70 },
  },
  'CHF': {
    default: { meaning: 'Congestive heart failure', entity: 'DIAGNOSIS', confidence: 0.95 },
  },
  'CP': {
    cardiology: { meaning: 'Chest pain', entity: 'SYMPTOM', confidence: 0.90 },
    neurology: { meaning: 'Cerebral palsy', entity: 'DIAGNOSIS', confidence: 0.85 },
    default: { meaning: 'Chest pain', entity: 'SYMPTOM', confidence: 0.75 },
  },
  'HD': {
    nephrology: { meaning: 'Hemodialysis', entity: 'PROCEDURE', confidence: 0.95 },
    general: { meaning: 'Hospital day', entity: 'TEMPORAL', confidence: 0.60 },
    default: { meaning: 'Hemodialysis', entity: 'PROCEDURE', confidence: 0.70 },
  },
  'IVF': {
    emergency: { meaning: 'IV fluids', entity: 'TREATMENT', confidence: 0.90 },
    obstetrics: { meaning: 'In vitro fertilization', entity: 'PROCEDURE', confidence: 0.88 },
    default: { meaning: 'IV fluids', entity: 'TREATMENT', confidence: 0.80 },
  },
  'OD': {
    toxicology: { meaning: 'Overdose', entity: 'DIAGNOSIS', confidence: 0.90 },
    ophthalmology: { meaning: 'Right eye (oculus dexter)', entity: 'LATERALITY', confidence: 0.85 },
    default: { meaning: 'Overdose', entity: 'DIAGNOSIS', confidence: 0.65 },
  },
  'PT': {
    rehabilitation: { meaning: 'Physical therapy', entity: 'SERVICE', confidence: 0.90 },
    hematology: { meaning: 'Prothrombin time', entity: 'LAB', confidence: 0.88 },
    default: { meaning: 'Physical therapy', entity: 'SERVICE', confidence: 0.65 },
  },
  'RF': {
    rheumatology: { meaning: 'Rheumatoid factor', entity: 'LAB', confidence: 0.88 },
    nephrology: { meaning: 'Renal failure', entity: 'DIAGNOSIS', confidence: 0.85 },
    general: { meaning: 'Risk factor', entity: 'CLINICAL', confidence: 0.50 },
    default: { meaning: 'Renal failure', entity: 'DIAGNOSIS', confidence: 0.60 },
  },
  'Mg': {
    lab: { meaning: 'Magnesium', entity: 'LAB', confidence: 0.90 },
    pharmacy: { meaning: 'Milligrams', entity: 'UNIT', confidence: 0.85 },
    default: { meaning: 'Magnesium', entity: 'LAB', confidence: 0.70 },
  },
  'Na': {
    lab: { meaning: 'Sodium', entity: 'LAB', confidence: 0.92 },
    default: { meaning: 'Sodium', entity: 'LAB', confidence: 0.85 },
  },
  'K': {
    lab: { meaning: 'Potassium', entity: 'LAB', confidence: 0.90 },
    default: { meaning: 'Potassium', entity: 'LAB', confidence: 0.80 },
  },
  'Cr': {
    lab: { meaning: 'Creatinine', entity: 'LAB', confidence: 0.92 },
    default: { meaning: 'Creatinine', entity: 'LAB', confidence: 0.85 },
  },
  'BS': {
    gi: { meaning: 'Bowel sounds', entity: 'EXAM', confidence: 0.85 },
    endocrine: { meaning: 'Blood sugar', entity: 'LAB', confidence: 0.85 },
    default: { meaning: 'Blood sugar', entity: 'LAB', confidence: 0.65 },
  },
  'RR': {
    vitals: { meaning: 'Respiratory rate', entity: 'VITAL', confidence: 0.90 },
    cardiology: { meaning: 'Regular rate (and rhythm)', entity: 'EXAM', confidence: 0.75 },
    default: { meaning: 'Respiratory rate', entity: 'VITAL', confidence: 0.80 },
  },
};

// Detect clinical context from surrounding text
const CONTEXT_CLUES = {
  cardiology: [
    'chest pain','cardiac','heart','coronary','troponin','ECG','EKG','echo',
    'cath lab','stent','angiogram','cardiology','arrhythmia','murmur',
    'palpitations','ACS','STEMI','NSTEMI','MI','CHF','HF','AF','EF',
  ],
  pulmonology: [
    'lung','pulmonary','respiratory','breath','oxygen','O2','SpO2',
    'ventilator','intubated','COPD','asthma','pneumonia','CXR','ABG',
    'bronchoscopy','ARDS','pleur',
  ],
  nephrology: [
    'kidney','renal','creatinine','dialysis','HD','CRRT','urine','GFR',
    'electrolyte','potassium','sodium','AKI','CKD','nephr',
  ],
  neurology: [
    'brain','neuro','stroke','CVA','seizure','CT head','MRI brain',
    'GCS','consciousness','focal','weakness','speech','aphasia',
  ],
  gi: [
    'abdom','liver','hepat','GI','bowel','gastro','colon','pancrea',
    'nausea','vomit','diarrhea','melena','endoscop','ERCP',
  ],
  endocrine: [
    'diabetes','DM','insulin','glucose','sugar','A1c','thyroid','TSH',
    'DKA','HHS','endocrin',
  ],
  hematology: [
    'blood','anemia','platelet','WBC','Hgb','coagul','INR','PT','aPTT',
    'transfus','bleeding','clotting',
  ],
  infectious: [
    'infect','sepsis','antibiotic','culture','fever','WBC','CRP',
    'procalcitonin','MRSA','VRE','organism',
  ],
  rheumatology: [
    'joint','arthri','lupus','SLE','autoimmune','rheumat','vasculitis',
    'ANA','complement','ESR','CRP',
  ],
  surgery: [
    'surg','operative','post-op','pre-op','incision','wound','drain',
    'suture','OR','operating',
  ],
  toxicology: [
    'overdose','poison','toxic','ingestion','NAC','charcoal','antidote',
    'drug screen','tox screen','CIWA','COWS',
  ],
  obstetrics: [
    'pregnan','obstet','fetal','trimester','gestation','labor','delivery',
    'postpartum','C-section','contraction',
  ],
  ophthalmology: [
    'eye','vision','visual','pupil','retina','fundus','IOP','slit lamp',
    'ophthalmol',
  ],
  rehabilitation: [
    'PT','OT','rehab','therap','mobility','gait','transfer','ADL',
    'function','strength','ROM','exercise',
  ],
  lab: [
    'lab','result','level','value','normal','elevated','decreased',
    'pending','specimen','sample',
  ],
  vitals: [
    'vital','BP','HR','RR','temp','SpO2','sat','pulse','pressure',
  ],
  pharmacy: [
    'mg','mcg','dose','tablet','capsule','IV','drip','infusion',
    'PRN','daily','BID','TID',
  ],
};

export function detectContext(surroundingText) {
  if (!surroundingText) return 'default';
  const lower = surroundingText.toLowerCase();
  let bestContext = 'default';
  let bestScore = 0;

  for (const [context, clues] of Object.entries(CONTEXT_CLUES)) {
    let score = 0;
    for (const clue of clues) {
      if (lower.includes(clue.toLowerCase())) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestContext = context;
    }
  }
  return bestContext;
}

export function disambiguate(term, surroundingText) {
  const entry = AMBIGUOUS_TERMS[term] || AMBIGUOUS_TERMS[term.toUpperCase()];
  if (!entry) return null;

  const context = detectContext(surroundingText);
  return entry[context] || entry.default || null;
}

// ═══════════════════════════════════════════════════════════════════
// 2. CLINICAL PLAUSIBILITY VALIDATOR
// "Does this data make medical sense?"
// ═══════════════════════════════════════════════════════════════════

const VITAL_RANGES = {
  hr:   { min: 20, max: 250, critLow: 40, critHigh: 180, unit: 'bpm' },
  sbp:  { min: 40, max: 300, critLow: 70, critHigh: 220, unit: 'mmHg' },
  dbp:  { min: 20, max: 200, critLow: 40, critHigh: 130, unit: 'mmHg' },
  rr:   { min: 4, max: 60, critLow: 8, critHigh: 35, unit: '/min' },
  temp: { min: 30, max: 43, critLow: 35, critHigh: 40, unit: '°C' },
  spo2: { min: 40, max: 100, critLow: 88, critHigh: 101, unit: '%' },
  gcs:  { min: 3, max: 15, critLow: 8, critHigh: 16, unit: '' },
};

const LAB_RANGES = {
  wbc:    { min: 0.1, max: 200, low: 4.0, high: 11.0, critLow: 1.0, critHigh: 30.0, unit: 'x10^9/L' },
  hgb:    { min: 2, max: 25, low: 12, high: 17, critLow: 7, critHigh: 20, unit: 'g/dL' },
  plt:    { min: 1, max: 2000, low: 150, high: 400, critLow: 20, critHigh: 1000, unit: 'x10^9/L' },
  na:     { min: 100, max: 180, low: 135, high: 145, critLow: 120, critHigh: 160, unit: 'mmol/L' },
  k:      { min: 1.0, max: 10.0, low: 3.5, high: 5.0, critLow: 2.5, critHigh: 6.5, unit: 'mmol/L' },
  cr:     { min: 0.1, max: 30, low: 0.6, high: 1.2, critLow: 0.3, critHigh: 10, unit: 'mg/dL' },
  glucose:{ min: 10, max: 1000, low: 70, high: 110, critLow: 40, critHigh: 500, unit: 'mg/dL' },
  inr:    { min: 0.5, max: 15, low: 0.9, high: 1.1, critLow: 0.8, critHigh: 5.0, unit: '' },
  lactate:{ min: 0.1, max: 30, low: 0.5, high: 2.0, critLow: 0.3, critHigh: 4.0, unit: 'mmol/L' },
  trop:   { min: 0, max: 500, low: 0, high: 0.04, critLow: 0, critHigh: 0.1, unit: 'ng/mL' },
  ph:     { min: 6.5, max: 8.0, low: 7.35, high: 7.45, critLow: 7.1, critHigh: 7.6, unit: '' },
  pco2:   { min: 10, max: 120, low: 35, high: 45, critLow: 20, critHigh: 70, unit: 'mmHg' },
  po2:    { min: 20, max: 600, low: 80, high: 100, critLow: 60, critHigh: 500, unit: 'mmHg' },
  hco3:   { min: 5, max: 50, low: 22, high: 28, critLow: 10, critHigh: 40, unit: 'mmol/L' },
  bun:    { min: 1, max: 200, low: 7, high: 20, critLow: 2, critHigh: 100, unit: 'mg/dL' },
  albumin:{ min: 0.5, max: 6.0, low: 3.5, high: 5.0, critLow: 1.5, critHigh: 5.5, unit: 'g/dL' },
};

export function validateVital(type, value) {
  const range = VITAL_RANGES[type.toLowerCase()];
  if (!range) return { valid: true, message: 'Unknown vital type' };
  const v = parseFloat(value);
  if (isNaN(v)) return { valid: false, message: 'Not a number' };
  if (v < range.min || v > range.max) return { valid: false, message: `Implausible ${type}: ${v} (expected ${range.min}-${range.max})`, implausible: true };
  if (v < range.critLow) return { valid: true, critical: true, low: true, message: `Critical low ${type}: ${v}` };
  if (v >= range.critHigh) return { valid: true, critical: true, high: true, message: `Critical high ${type}: ${v}` };
  return { valid: true, normal: true };
}

export function validateLab(type, value) {
  const range = LAB_RANGES[type.toLowerCase()];
  if (!range) return { valid: true, message: 'Unknown lab type' };
  const v = parseFloat(value);
  if (isNaN(v)) return { valid: false, message: 'Not a number' };
  if (v < range.min || v > range.max) return { valid: false, message: `Implausible ${type}: ${v}`, implausible: true };
  if (v < range.critLow) return { valid: true, critical: true, low: true, message: `Critical low: ${v} ${range.unit}` };
  if (v > range.critHigh) return { valid: true, critical: true, high: true, message: `Critical high: ${v} ${range.unit}` };
  if (v < range.low) return { valid: true, low: true, message: `Low: ${v} ${range.unit}` };
  if (v > range.high) return { valid: true, high: true, message: `High: ${v} ${range.unit}` };
  return { valid: true, normal: true, message: `Normal: ${v} ${range.unit}` };
}

// Validate age against diagnosis
export function validateAgeDiagnosis(age, diagnosis) {
  if (age == null || !diagnosis) return { valid: true };
  const dx = diagnosis.toLowerCase();

  // Pediatric-only conditions in adults
  if (age > 18) {
    if (/\b(neonatal|newborn|NICU|NEC|RDS surfactant|bronchiolitis|croup|febrile seizure|kawasaki|intussusception)\b/i.test(dx)) {
      return { valid: false, message: `"${diagnosis}" is typically pediatric, patient age is ${age}`, warning: true };
    }
  }
  // Adult conditions in young children
  if (age < 5) {
    if (/\b(STEMI|NSTEMI|MI|DVT|PE|cirrhosis|COPD|lung cancer|prostate)\b/i.test(dx)) {
      return { valid: false, message: `"${diagnosis}" is very unusual in a ${age}-year-old`, warning: true };
    }
  }
  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════════
// 3. ACUITY / SEVERITY INFERRER
// "How sick is this patient based on what we know?"
// ═══════════════════════════════════════════════════════════════════

const ACUITY_SIGNALS = {
  // Each signal contributes to an acuity score (0-1)
  critical_diagnoses: {
    weight: 0.9,
    patterns: [
      /cardiac arrest|code blue|PEA|asystole|V-?fib|pulseless/i,
      /STEMI|massive PE|tension pneumo|aortic dissection/i,
      /septic shock|cardiogenic shock|hemorrhagic shock/i,
      /status epilepticus|brain death|herniation/i,
      /DKA|HHS|thyroid storm|adrenal crisis/i,
      /GI bleed.*massive|massive hemoptysis/i,
      /acute liver failure|fulminant/i,
      /intubat|ventilat|ECMO|vasopressor|pressor/i,
    ],
  },
  high_acuity_diagnoses: {
    weight: 0.7,
    patterns: [
      /NSTEMI|unstable angina|ACS|acute MI|acute coronary/i,
      /PE|DVT|pulmonary embol/i,
      /stroke|CVA|TIA|ICH|SAH/i,
      /sepsis|bacteremia|severe infection/i,
      /ARDS|respiratory failure|respiratory distress/i,
      /AKI|acute kidney|acute renal/i,
      /GI bleed|UGIB|LGIB|hematemesis|melena/i,
      /pancreatitis|cholangitis|SBO|bowel obstruction/i,
      /meningitis|encephalitis/i,
      /DKA|diabetic ketoacidosis/i,
      /overdose|poisoning|ingestion/i,
      /acute abdomen|peritonitis/i,
    ],
  },
  critical_vitals: {
    weight: 0.8,
    check: (data) => {
      if (!data) return false;
      const checks = [
        data.hr && (data.hr < 40 || data.hr > 150),
        data.sbp && data.sbp < 80,
        data.spo2 && data.spo2 < 88,
        data.rr && (data.rr < 8 || data.rr > 35),
        data.gcs && data.gcs <= 8,
        data.temp && (data.temp < 35 || data.temp > 40),
      ];
      return checks.some(Boolean);
    },
  },
  high_acuity_vitals: {
    weight: 0.5,
    check: (data) => {
      if (!data) return false;
      const checks = [
        data.hr && (data.hr < 50 || data.hr > 120),
        data.sbp && (data.sbp < 90 || data.sbp > 180),
        data.spo2 && data.spo2 < 92,
        data.rr && (data.rr < 10 || data.rr > 25),
        data.gcs && data.gcs <= 12,
      ];
      return checks.some(Boolean);
    },
  },
  icu_indicators: {
    weight: 0.85,
    patterns: [
      /ICU|intensive care|critical care|HDU|step-?down/i,
      /ventilator|intubated|ETT|tracheostomy|ECMO/i,
      /vasopressor|noradrenaline|norepinephrine|dopamine.*drip|dobutamine/i,
      /CRRT|continuous.*dialysis|CVVHD/i,
      /arterial line|central line|swan.?ganz|PA catheter/i,
      /1:1|one.?to.?one|continuous monitor/i,
    ],
  },
  o2_indicators: {
    weight: 0.4,
    patterns: [
      /on\s+\d+L|nasal cannula|NC|face mask|NRB|non-?rebreather/i,
      /BiPAP|CPAP|HFNC|high.?flow/i,
      /FiO2\s*(?:[4-9]\d|100)/i, // FiO2 >= 40%
    ],
  },
  mobility_indicators: {
    weight: 0.3,
    patterns: [
      /bedbound|bed.?bound|immobile|paralyz|paraplegia|quadriplegia/i,
      /stretcher|critical.?transport|non-?ambulat/i,
    ],
  },
};

export function inferAcuity(patientData) {
  let score = 0;
  const signals = [];
  const text = [
    patientData.dx || '',
    patientData.notes || '',
    patientData.meds || '',
    patientData.sheetStatus || '',
  ].join(' ');

  for (const [name, signal] of Object.entries(ACUITY_SIGNALS)) {
    if (signal.patterns) {
      for (const pattern of signal.patterns) {
        if (pattern.test(text)) {
          score = Math.max(score, signal.weight);
          signals.push({ signal: name, weight: signal.weight, match: text.match(pattern)?.[0] });
          break;
        }
      }
    }
    if (signal.check && signal.check(patientData.vitals || patientData)) {
      score = Math.max(score, signal.weight);
      signals.push({ signal: name, weight: signal.weight });
    }
  }

  // Map score to triage
  let suggestedTriage;
  if (score >= 0.8) suggestedTriage = 'RED';
  else if (score >= 0.5) suggestedTriage = 'YELLOW';
  else if (score >= 0.2) suggestedTriage = 'GREEN';
  else suggestedTriage = 'GREEN';

  // Map to mobility
  let suggestedMobility = 'AMBULATORY';
  if (/ventilat|intubat|ECMO|vasopressor|critical.?transport/i.test(text)) suggestedMobility = 'CRITICAL_TRANSPORT';
  else if (/stretcher|bedbound|immobile|bed.?bound|paralyz/i.test(text)) suggestedMobility = 'STRETCHER';
  else if (/wheelchair|W\/C|unable.*ambul/i.test(text)) suggestedMobility = 'WHEELCHAIR';

  // O2 requirement
  let suggestedO2 = 'NONE';
  if (/ventilat|intubat|ETT|ECMO/i.test(text)) suggestedO2 = 'VENTILATOR';
  else if (/BiPAP|CPAP|NIV|NIPPV/i.test(text)) suggestedO2 = 'BIPAP';
  else if (/NRB|non.?rebreather|15L|10L/i.test(text)) suggestedO2 = 'NON_REBREATHER';
  else if (/face.?mask|FM|Hudson|Venturi/i.test(text)) suggestedO2 = 'FACE_MASK';
  else if (/nasal.?cannula|NC|\d+L\s*NC|\bon\s+\d+L\b/i.test(text)) suggestedO2 = 'NASAL_CANNULA';
  else if (/HFNC|high.?flow/i.test(text)) suggestedO2 = 'NON_REBREATHER';

  // Isolation
  let suggestedIso = 'NONE';
  if (/airborne|AFB|TB(?:\s|$)|COVID|SARS|N95/i.test(text)) suggestedIso = 'AIRBORNE';
  else if (/droplet|influenza|meningococcal/i.test(text)) suggestedIso = 'DROPLET';
  else if (/contact|MRSA|VRE|C\.?\s*diff|ESBL|CRE|MDR/i.test(text)) suggestedIso = 'CONTACT';

  return {
    acuityScore: score,
    suggestedTriage,
    suggestedMobility,
    suggestedO2,
    suggestedIso,
    signals,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 4. STRUCTURED DATA EXTRACTOR
// "Pull numbers, dates, medications from free text"
// ═══════════════════════════════════════════════════════════════════

export function extractStructuredData(freeText) {
  if (!freeText) return {};
  const result = { vitals: {}, labs: {}, medications: [], lines: [], diet: null, code: null, problems: [] };

  // Vitals
  const bpMatch = freeText.match(/BP\s*[:=]?\s*(\d{2,3})\s*[\/\\]\s*(\d{2,3})/i);
  if (bpMatch) { result.vitals.sbp = parseInt(bpMatch[1]); result.vitals.dbp = parseInt(bpMatch[2]); }

  const hrMatch = freeText.match(/(?:HR|heart\s*rate|pulse)\s*[:=]?\s*(\d{2,3})/i);
  if (hrMatch) result.vitals.hr = parseInt(hrMatch[1]);

  const rrMatch = freeText.match(/(?:RR|resp(?:iratory)?\s*rate)\s*[:=]?\s*(\d{1,2})/i);
  if (rrMatch) result.vitals.rr = parseInt(rrMatch[1]);

  const tempMatch = freeText.match(/(?:temp|T|temperature)\s*[:=]?\s*(\d{2}\.?\d?)/i);
  if (tempMatch) result.vitals.temp = parseFloat(tempMatch[1]);

  const spo2Match = freeText.match(/(?:SpO2|O2\s*sat|sat(?:uration)?|sats?)\s*[:=]?\s*(\d{2,3})\s*%?/i);
  if (spo2Match) result.vitals.spo2 = parseInt(spo2Match[1]);

  const gcsMatch = freeText.match(/GCS\s*[:=]?\s*(\d{1,2})/i);
  if (gcsMatch) result.vitals.gcs = parseInt(gcsMatch[1]);

  // Labs
  const labPatterns = [
    { name: 'wbc', pattern: /(?:WBC|white\s*(?:blood\s*)?(?:cell)?(?:\s*count)?)\s*[:=]?\s*(\d+\.?\d*)/i },
    { name: 'hgb', pattern: /(?:H[bg]|hemoglobin|haemoglobin)\s*[:=]?\s*(\d+\.?\d*)/i },
    { name: 'plt', pattern: /(?:plt|platelet)\s*[:=]?\s*(\d+)/i },
    { name: 'na', pattern: /(?:Na|sodium)\s*[:=]?\s*(\d{2,3})/i },
    { name: 'k', pattern: /(?:K|potassium)\s*[:=]?\s*(\d\.?\d*)/i },
    { name: 'cr', pattern: /(?:Cr|creatinine)\s*[:=]?\s*(\d+\.?\d*)/i },
    { name: 'glucose', pattern: /(?:glucose|glu|BS|blood\s*sugar|CBG|RBS)\s*[:=]?\s*(\d{2,4})/i },
    { name: 'lactate', pattern: /(?:lactate|lac)\s*[:=]?\s*(\d+\.?\d*)/i },
    { name: 'inr', pattern: /INR\s*[:=]?\s*(\d+\.?\d*)/i },
    { name: 'trop', pattern: /(?:trop(?:onin)?|hs-?[Tt]n[IT])\s*[:=]?\s*(\d+\.?\d*)/i },
    { name: 'crp', pattern: /CRP\s*[:=]?\s*(\d+\.?\d*)/i },
    { name: 'ph', pattern: /pH\s*[:=]?\s*(\d\.?\d*)/i },
  ];
  for (const { name, pattern } of labPatterns) {
    const m = freeText.match(pattern);
    if (m) result.labs[name] = parseFloat(m[1]);
  }

  // Code status
  if (/full\s*code|for\s*(?:CPR|resuscitation)/i.test(freeText)) result.code = 'FULL';
  else if (/DNR|DNAR|AND|comfort|CMO|no\s*(?:CPR|code|resuscitation)/i.test(freeText)) result.code = 'DNR';

  // Diet
  if (/NPO|nil\s*(?:per\s*os|by\s*mouth)/i.test(freeText)) result.diet = 'NPO';
  else if (/clear\s*liquid/i.test(freeText)) result.diet = 'CLEAR_LIQUIDS';
  else if (/regular\s*diet/i.test(freeText)) result.diet = 'REGULAR';
  else if (/diabetic\s*diet/i.test(freeText)) result.diet = 'DIABETIC';
  else if (/renal\s*diet/i.test(freeText)) result.diet = 'RENAL';
  else if (/cardiac\s*diet|low\s*(?:salt|sodium)/i.test(freeText)) result.diet = 'CARDIAC';

  // Lines/tubes
  const linePatterns = [
    { pattern: /(?:central\s*line|CVC|triple\s*lumen)/i, type: 'Central Line' },
    { pattern: /PICC/i, type: 'PICC' },
    { pattern: /(?:arterial\s*line|A-?line)/i, type: 'Arterial Line' },
    { pattern: /(?:Foley|urinary\s*catheter)/i, type: 'Foley' },
    { pattern: /(?:NG\s*tube|NGT|nasogastric)/i, type: 'NGT' },
    { pattern: /(?:chest\s*tube|thoracostomy)/i, type: 'Chest Tube' },
    { pattern: /(?:ETT|endotracheal|intubated)/i, type: 'ETT' },
    { pattern: /(?:trach(?:eostomy)?|trach\s*tube)/i, type: 'Tracheostomy' },
    { pattern: /(?:wound\s*VAC|NPWT)/i, type: 'Wound VAC' },
    { pattern: /(?:EVD|external\s*ventricular)/i, type: 'EVD' },
  ];
  for (const { pattern, type } of linePatterns) {
    if (pattern.test(freeText)) result.lines.push(type);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// 5. RELATIONSHIP DETECTOR
// "This medication treats this diagnosis"
// ═══════════════════════════════════════════════════════════════════

const DRUG_DISEASE_ASSOCIATIONS = {
  // Drug → likely diagnosis
  'insulin': ['diabetes', 'DKA', 'HHS', 'hyperglycemia'],
  'metformin': ['diabetes', 'T2DM', 'DM2'],
  'heparin': ['DVT', 'PE', 'ACS', 'AF', 'anticoagulation'],
  'enoxaparin': ['DVT', 'PE', 'ACS', 'VTE prophylaxis'],
  'warfarin': ['AF', 'DVT', 'PE', 'mechanical valve', 'anticoagulation'],
  'apixaban': ['AF', 'DVT', 'PE', 'anticoagulation'],
  'ceftriaxone': ['pneumonia', 'UTI', 'meningitis', 'sepsis', 'infection'],
  'meropenem': ['sepsis', 'severe infection', 'MDR', 'hospital-acquired infection'],
  'vancomycin': ['MRSA', 'C. diff', 'endocarditis', 'meningitis'],
  'metronidazole': ['C. diff', 'anaerobic infection', 'abscess', 'diverticulitis'],
  'furosemide': ['heart failure', 'CHF', 'pulmonary edema', 'fluid overload', 'CKD'],
  'noradrenaline': ['septic shock', 'shock', 'hypotension', 'vasoplegic'],
  'amiodarone': ['AF', 'VT', 'arrhythmia', 'atrial fibrillation'],
  'levetiracetam': ['seizure', 'epilepsy', 'status epilepticus'],
  'pantoprazole': ['GI bleed', 'PUD', 'GERD', 'stress ulcer prophylaxis'],
  'lactulose': ['hepatic encephalopathy', 'constipation', 'CLD'],
  'salbutamol': ['asthma', 'COPD', 'bronchospasm', 'wheezing'],
  'alteplase': ['STEMI', 'ischemic stroke', 'massive PE', 'thrombolysis'],
  'naloxone': ['opioid overdose', 'opioid toxicity'],
  'flumazenil': ['benzodiazepine overdose'],
  'dexamethasone': ['COPD exacerbation', 'croup', 'brain edema', 'COVID', 'inflammation'],
  'octreotide': ['variceal bleed', 'GI bleed', 'carcinoid'],
  'NAC': ['acetaminophen overdose', 'paracetamol overdose'],
};

export function inferDiagnosisFromMedications(medications) {
  if (!medications) return [];
  const meds = medications.toLowerCase();
  const inferred = new Set();

  for (const [drug, diseases] of Object.entries(DRUG_DISEASE_ASSOCIATIONS)) {
    if (meds.includes(drug.toLowerCase())) {
      for (const disease of diseases) inferred.add(disease);
    }
  }
  return [...inferred];
}

// ═══════════════════════════════════════════════════════════════════
// 6. SMART FIELD COMPLETION
// "If I know X, I can predict Y"
// ═══════════════════════════════════════════════════════════════════

export function predictMissingFields(patient) {
  const predictions = {};

  // Gender from name
  if (!patient.gender && patient.fullName) {
    const firstName = patient.fullName.split(/\s+/)[0]?.toLowerCase();
    const FEMALE_NAMES = new Set(['fatima','fatma','noura','nora','sara','sarah','maryam','mariam','haya','dana','reem','aisha','aysha','layla','layan','shahd','dalal','hessa','munira','latifa','sheikha','zainab','khadija','amina','salwa','haifa','abeer','ghada','manal','nawal']);
    const MALE_NAMES = new Set(['ahmed','mohammad','mohammed','abdullah','khaled','khalid','fahad','yousef','ali','hussein','omar','ibrahim','nasser','jaber','faisal','salem','hamad','turki','saad','majid','waleed','hani','rashed','mansour','bader','saud','nawaf','talal','sultan','mubarak']);
    if (FEMALE_NAMES.has(firstName)) predictions.gender = 'F';
    else if (MALE_NAMES.has(firstName)) predictions.gender = 'M';
  }

  // Triage from diagnosis
  if (!patient.triage && patient.dx) {
    const acuity = inferAcuity(patient);
    predictions.suggestedTriage = acuity.suggestedTriage;
    predictions.suggestedMobility = acuity.suggestedMobility;
    predictions.suggestedO2 = acuity.suggestedO2;
    predictions.suggestedIso = acuity.suggestedIso;
  }

  // Infer diagnoses from medications
  if (patient.meds && !patient.dx) {
    const inferred = inferDiagnosisFromMedications(patient.meds);
    if (inferred.length > 0) predictions.inferredDx = inferred.join(', ');
  }

  return predictions;
}

// ═══════════════════════════════════════════════════════════════════
// 7. TEXT NORMALIZER
// "Convert any representation to canonical form"
// ═══════════════════════════════════════════════════════════════════

export function normalizeText(text) {
  if (!text) return '';
  let t = text.trim();

  // Standardize common abbreviation forms
  t = t.replace(/\bH\/?T(?:N)?\b/gi, 'HTN');
  t = t.replace(/\bD\.?M\.?\s*(?:type\s*)?2?\b/gi, 'DM2');
  t = t.replace(/\bD\.?M\.?\s*(?:type\s*)?1\b/gi, 'DM1');
  t = t.replace(/\bC\.?K\.?D\.?\s*(\d)\b/gi, 'CKD$1');
  t = t.replace(/\bA\.?\s*fib\b/gi, 'AF');
  t = t.replace(/\bA\.?\s*flutter\b/gi, 'Atrial flutter');
  t = t.replace(/\bC\.?O\.?P\.?D\.?\b/gi, 'COPD');
  t = t.replace(/\bC\.?H\.?F\.?\b/gi, 'CHF');
  t = t.replace(/\bU\.?T\.?I\.?\b/gi, 'UTI');
  t = t.replace(/\bD\.?V\.?T\.?\b/gi, 'DVT');
  t = t.replace(/\bP\.?E\.?\b/g, 'PE'); // careful not to replace lowercase
  t = t.replace(/\bC\.?V\.?A\.?\b/gi, 'CVA');
  t = t.replace(/\bA\.?K\.?I\.?\b/gi, 'AKI');
  t = t.replace(/\bS\.?O\.?B\.?\b/gi, 'SOB');
  t = t.replace(/\bN\/V\b/gi, 'Nausea/Vomiting');
  t = t.replace(/\bAb(?:d|do)(?:ominal)?\s*pain\b/gi, 'Abdominal pain');
  t = t.replace(/\bN\.?K\.?D\.?A\.?\b/gi, 'NKDA');

  // Standardize separators
  t = t.replace(/\s*[,;]\s*/g, ', ');
  t = t.replace(/\s+/g, ' ');

  return t;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORT ALL BRAIN FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

export {
  AMBIGUOUS_TERMS,
  CONTEXT_CLUES,
  VITAL_RANGES,
  LAB_RANGES,
  DRUG_DISEASE_ASSOCIATIONS,
};
