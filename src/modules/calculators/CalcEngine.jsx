// Calculator Engine — input validation, unit conversion, computation, interpretation

export const BOUNDS = {
  creatinine: { hard: [0.05, 40], soft: [0.2, 15], unit: 'mg/dL' },
  creatinine_umol: { hard: [4, 3540], soft: [18, 1326], unit: 'umol/L' },
  weight: { hard: [0.3, 400], soft: [2, 250], unit: 'kg' },
  age: { hard: [0, 130], soft: [0, 110], unit: 'years' },
  heartRate: { hard: [0, 400], soft: [20, 250], unit: 'bpm' },
  sodium: { hard: [80, 200], soft: [110, 170], unit: 'mEq/L' },
  potassium: { hard: [0.5, 15], soft: [2.0, 8.0], unit: 'mEq/L' },
  glucose: { hard: [1, 2000], soft: [20, 800], unit: 'mg/dL' },
  glucose_mmol: { hard: [0.05, 111], soft: [1.1, 44.4], unit: 'mmol/L' },
  height: { hard: [20, 280], soft: [40, 230], unit: 'cm' },
  systolic: { hard: [30, 350], soft: [60, 260], unit: 'mmHg' },
  diastolic: { hard: [10, 250], soft: [30, 160], unit: 'mmHg' },
  pH: { hard: [6.5, 8.0], soft: [6.8, 7.8], unit: '' },
  pCO2: { hard: [5, 150], soft: [10, 120], unit: 'mmHg' },
  HCO3: { hard: [1, 60], soft: [3, 50], unit: 'mEq/L' },
  albumin: { hard: [0.5, 7], soft: [1.0, 6.0], unit: 'g/dL' },
  calcium: { hard: [3, 20], soft: [5, 16], unit: 'mg/dL' },
  bilirubin: { hard: [0.01, 60], soft: [0.1, 40], unit: 'mg/dL' },
  inr: { hard: [0.5, 20], soft: [0.8, 10], unit: '' },
  qtInterval: { hard: [100, 800], soft: [200, 700], unit: 'ms' },
  pao2: { hard: [10, 700], soft: [20, 600], unit: 'mmHg' },
  fio2: { hard: [0.21, 1.0], soft: [0.21, 1.0], unit: '' },
  urea: { hard: [0.5, 100], soft: [1, 60], unit: 'mmol/L' },
  bun: { hard: [1, 280], soft: [3, 170], unit: 'mg/dL' },
  chloride: { hard: [60, 150], soft: [80, 130], unit: 'mEq/L' },
  platelets: { hard: [1, 2000], soft: [5, 1000], unit: 'x10^9/L' },
};

export function validate(value, boundsKey) {
  if (value === '' || value === null || value === undefined) return { valid: false };
  const num = parseFloat(value);
  if (isNaN(num)) return { valid: false, error: 'Enter a number' };
  const b = BOUNDS[boundsKey];
  if (!b) return { valid: true, value: num };
  if (num < b.hard[0] || num > b.hard[1]) return { valid: false, error: `Must be ${b.hard[0]}-${b.hard[1]} ${b.unit}` };
  if (num < b.soft[0] || num > b.soft[1]) return { valid: true, value: num, warning: `Unusual: ${num} ${b.unit}` };
  return { valid: true, value: num };
}

// Unit conversions
export const conversions = {
  creatinine: { from: 'umol/L', to: 'mg/dL', factor: 1 / 88.4 },
  glucose: { from: 'mmol/L', to: 'mg/dL', factor: 18.018 },
  bun: { from: 'mmol/L', to: 'mg/dL', factor: 2.801 },
  calcium: { from: 'mmol/L', to: 'mg/dL', factor: 4.005 },
  bilirubin: { from: 'umol/L', to: 'mg/dL', factor: 1 / 17.1 },
};

export function convertUnit(value, type, fromSI = true) {
  const c = conversions[type];
  if (!c) return value;
  return fromSI ? value * c.factor : value / c.factor;
}

// ====== CALCULATOR DEFINITIONS ======

export const CALCULATORS = [
  {
    id: 'ckd-epi-2021', name: 'CKD-EPI 2021', category: 'Renal',
    description: 'eGFR by CKD-EPI 2021 (race-free)',
    citation: 'Inker LA, et al. NEJM 2021;385:1737-1749',
    inputs: [
      { key: 'creatinine', label: 'Serum Creatinine', unit: 'mg/dL', altUnit: 'umol/L', bounds: 'creatinine' },
      { key: 'age', label: 'Age', unit: 'years', bounds: 'age' },
      { key: 'gender', label: 'Gender', type: 'select', options: ['Female', 'Male'] },
    ],
    compute: ({ creatinine, age, gender }) => {
      const isFemale = gender === 'Female';
      const k = isFemale ? 0.7 : 0.9;
      const a = isFemale ? -0.241 : -0.302;
      const sCr = creatinine;
      const min = Math.min(sCr / k, 1);
      const max = Math.max(sCr / k, 1);
      let eGFR = 142 * Math.pow(min, a) * Math.pow(max, -1.200) * Math.pow(0.9938, age);
      if (isFemale) eGFR *= 1.012;
      return Math.round(eGFR);
    },
    interpret: (val) => {
      if (val >= 90) return { label: 'Normal (G1)', color: 'green' };
      if (val >= 60) return { label: 'Mild decrease (G2)', color: 'green' };
      if (val >= 45) return { label: 'Mild-Moderate (G3a)', color: 'yellow' };
      if (val >= 30) return { label: 'Moderate-Severe (G3b)', color: 'yellow' };
      if (val >= 15) return { label: 'Severe decrease (G4)', color: 'red' };
      return { label: 'Kidney failure (G5)', color: 'red' };
    },
    resultUnit: 'mL/min/1.73m2',
  },
  {
    id: 'cockcroft-gault', name: 'Cockcroft-Gault', category: 'Renal',
    description: 'Creatinine clearance estimation',
    citation: 'Cockcroft DW, Gault MH. Nephron 1976;16:31-41',
    inputs: [
      { key: 'creatinine', label: 'Serum Creatinine', unit: 'mg/dL', altUnit: 'umol/L', bounds: 'creatinine' },
      { key: 'age', label: 'Age', unit: 'years', bounds: 'age' },
      { key: 'weight', label: 'Weight', unit: 'kg', bounds: 'weight' },
      { key: 'gender', label: 'Gender', type: 'select', options: ['Female', 'Male'] },
    ],
    compute: ({ creatinine, age, weight, gender }) => {
      let result = ((140 - age) * weight) / (72 * creatinine);
      if (gender === 'Female') result *= 0.85;
      return Math.round(result);
    },
    interpret: (val) => {
      if (val > 90) return { label: 'Normal', color: 'green' };
      if (val > 60) return { label: 'Mild impairment', color: 'green' };
      if (val > 30) return { label: 'Moderate impairment', color: 'yellow' };
      if (val > 15) return { label: 'Severe impairment', color: 'red' };
      return { label: 'Kidney failure', color: 'red' };
    },
    resultUnit: 'mL/min',
  },
  {
    id: 'cha2ds2-vasc', name: 'CHA2DS2-VASc', category: 'Cardiology',
    description: 'Stroke risk in atrial fibrillation',
    citation: 'Lip GY, et al. Chest 2010;137:263-272',
    inputs: [
      { key: 'chf', label: 'CHF / LV dysfunction', type: 'bool' },
      { key: 'htn', label: 'Hypertension', type: 'bool' },
      { key: 'age75', label: 'Age >= 75', type: 'bool' },
      { key: 'dm', label: 'Diabetes', type: 'bool' },
      { key: 'stroke', label: 'Stroke/TIA/Thromboembolism', type: 'bool' },
      { key: 'vascular', label: 'Vascular disease (MI, PAD, aortic plaque)', type: 'bool' },
      { key: 'age65', label: 'Age 65-74', type: 'bool' },
      { key: 'female', label: 'Female sex', type: 'bool' },
    ],
    compute: (v) => {
      return (v.chf ? 1 : 0) + (v.htn ? 1 : 0) + (v.age75 ? 2 : 0) + (v.dm ? 1 : 0) +
        (v.stroke ? 2 : 0) + (v.vascular ? 1 : 0) + (v.age65 ? 1 : 0) + (v.female ? 1 : 0);
    },
    interpret: (val) => {
      if (val === 0) return { label: 'Low risk — no anticoagulation', color: 'green' };
      if (val === 1) return { label: 'Low-moderate — consider anticoagulation', color: 'yellow' };
      return { label: 'Moderate-high — anticoagulation recommended', color: 'red' };
    },
    resultUnit: 'points',
  },
  {
    id: 'has-bled', name: 'HAS-BLED', category: 'Cardiology',
    description: 'Bleeding risk on anticoagulation',
    citation: 'Pisters R, et al. Chest 2010;138:1093-1100',
    inputs: [
      { key: 'htn', label: 'Hypertension (uncontrolled, >160)', type: 'bool' },
      { key: 'renal', label: 'Renal disease (dialysis, transplant, Cr>2.26)', type: 'bool' },
      { key: 'liver', label: 'Liver disease (cirrhosis, bilirubin>2x, AST/ALT>3x)', type: 'bool' },
      { key: 'stroke', label: 'Stroke history', type: 'bool' },
      { key: 'bleeding', label: 'Prior major bleeding or predisposition', type: 'bool' },
      { key: 'inr', label: 'Labile INR (TTR<60%)', type: 'bool' },
      { key: 'age', label: 'Age > 65', type: 'bool' },
      { key: 'drugs', label: 'Drugs (antiplatelets, NSAIDs)', type: 'bool' },
      { key: 'alcohol', label: 'Alcohol (>=8 drinks/week)', type: 'bool' },
    ],
    compute: (v) => Object.values(v).filter(Boolean).length,
    interpret: (val) => {
      if (val <= 1) return { label: 'Low risk', color: 'green' };
      if (val === 2) return { label: 'Moderate risk', color: 'yellow' };
      return { label: 'High risk — caution with anticoagulation', color: 'red' };
    },
    resultUnit: 'points',
  },
  {
    id: 'wells-pe', name: 'Wells PE', category: 'Cardiology',
    description: 'Pulmonary embolism probability',
    citation: 'Wells PS, et al. Thromb Haemost 2000;83:416-420',
    inputs: [
      { key: 'dvt', label: 'Clinical signs/symptoms of DVT', type: 'bool' },
      { key: 'alternative', label: 'PE is #1 diagnosis or equally likely', type: 'bool' },
      { key: 'hr', label: 'Heart rate > 100', type: 'bool' },
      { key: 'immobilization', label: 'Immobilization/surgery in past 4 weeks', type: 'bool' },
      { key: 'prior', label: 'Previous DVT/PE', type: 'bool' },
      { key: 'hemoptysis', label: 'Hemoptysis', type: 'bool' },
      { key: 'malignancy', label: 'Malignancy (treatment within 6mo or palliative)', type: 'bool' },
    ],
    compute: (v) => (v.dvt ? 3 : 0) + (v.alternative ? 3 : 0) + (v.hr ? 1.5 : 0) + (v.immobilization ? 1.5 : 0) + (v.prior ? 1.5 : 0) + (v.hemoptysis ? 1 : 0) + (v.malignancy ? 1 : 0),
    interpret: (val) => {
      if (val <= 1) return { label: 'Low probability (1.3% PE)', color: 'green' };
      if (val <= 4) return { label: 'Moderate probability (16.2% PE)', color: 'yellow' };
      return { label: 'High probability (37.5% PE)', color: 'red' };
    },
    resultUnit: 'points',
  },
  {
    id: 'wells-dvt', name: 'Wells DVT', category: 'Cardiology',
    description: 'Deep vein thrombosis probability',
    citation: 'Wells PS, et al. NEJM 2003;349:1227-1235',
    inputs: [
      { key: 'cancer', label: 'Active cancer', type: 'bool' },
      { key: 'paralysis', label: 'Paralysis/paresis/immobilization of LE', type: 'bool' },
      { key: 'bedridden', label: 'Bedridden >3 days or major surgery <12wks', type: 'bool' },
      { key: 'tenderness', label: 'Localized tenderness along deep veins', type: 'bool' },
      { key: 'swelling', label: 'Entire leg swollen', type: 'bool' },
      { key: 'calf', label: 'Calf swelling >3cm vs other leg', type: 'bool' },
      { key: 'pitting', label: 'Pitting oedema (symptomatic leg)', type: 'bool' },
      { key: 'collateral', label: 'Collateral superficial veins', type: 'bool' },
      { key: 'previous', label: 'Previously documented DVT', type: 'bool' },
      { key: 'alternative', label: 'Alternative diagnosis equally likely', type: 'bool' },
    ],
    compute: (v) => (v.cancer?1:0)+(v.paralysis?1:0)+(v.bedridden?1:0)+(v.tenderness?1:0)+(v.swelling?1:0)+(v.calf?1:0)+(v.pitting?1:0)+(v.collateral?1:0)+(v.previous?1:0)+(v.alternative?-2:0),
    interpret: (val) => {
      if (val <= 0) return { label: 'Low probability (5% DVT)', color: 'green' };
      if (val <= 2) return { label: 'Moderate probability (17% DVT)', color: 'yellow' };
      return { label: 'High probability (53% DVT)', color: 'red' };
    },
    resultUnit: 'points',
  },
  {
    id: 'gcs', name: 'Glasgow Coma Scale', category: 'Neurology',
    description: 'Level of consciousness assessment',
    citation: 'Teasdale G, Jennett B. Lancet 1974;2:81-84',
    inputs: [
      { key: 'eye', label: 'Eye Opening', type: 'select', options: ['4 - Spontaneous', '3 - To voice', '2 - To pain', '1 - None'] },
      { key: 'verbal', label: 'Verbal Response', type: 'select', options: ['5 - Oriented', '4 - Confused', '3 - Inappropriate words', '2 - Incomprehensible', '1 - None'] },
      { key: 'motor', label: 'Motor Response', type: 'select', options: ['6 - Obeys commands', '5 - Localizes pain', '4 - Withdrawal', '3 - Abnormal flexion', '2 - Extension', '1 - None'] },
    ],
    compute: ({ eye, verbal, motor }) => {
      return parseInt(eye) + parseInt(verbal) + parseInt(motor);
    },
    interpret: (val) => {
      if (val >= 13) return { label: 'Mild brain injury', color: 'green' };
      if (val >= 9) return { label: 'Moderate brain injury', color: 'yellow' };
      if (val >= 3) return { label: 'Severe brain injury', color: 'red' };
      return { label: 'Invalid', color: 'gray' };
    },
    resultUnit: '/15',
  },
  {
    id: 'sofa', name: 'SOFA Score', category: 'ICU / Critical Care',
    description: 'Sequential Organ Failure Assessment',
    citation: 'Vincent JL, et al. Intensive Care Med 1996;22:707-710',
    inputs: [
      { key: 'resp', label: 'PaO2/FiO2', type: 'select', options: ['0 - >= 400', '1 - < 400', '2 - < 300', '3 - < 200 (ventilated)', '4 - < 100 (ventilated)'] },
      { key: 'coag', label: 'Platelets (x10^3/uL)', type: 'select', options: ['0 - >= 150', '1 - < 150', '2 - < 100', '3 - < 50', '4 - < 20'] },
      { key: 'liver', label: 'Bilirubin (mg/dL)', type: 'select', options: ['0 - < 1.2', '1 - 1.2-1.9', '2 - 2.0-5.9', '3 - 6.0-11.9', '4 - >= 12.0'] },
      { key: 'cardio', label: 'Cardiovascular', type: 'select', options: ['0 - MAP >= 70', '1 - MAP < 70', '2 - Dopa <= 5 or dobutamine', '3 - Dopa > 5 or epi/norepi <= 0.1', '4 - Dopa > 15 or epi/norepi > 0.1'] },
      { key: 'cns', label: 'GCS', type: 'select', options: ['0 - 15', '1 - 13-14', '2 - 10-12', '3 - 6-9', '4 - < 6'] },
      { key: 'renal', label: 'Creatinine / Urine output', type: 'select', options: ['0 - Cr < 1.2', '1 - Cr 1.2-1.9', '2 - Cr 2.0-3.4', '3 - Cr 3.5-4.9 or UO < 500mL/d', '4 - Cr >= 5.0 or UO < 200mL/d'] },
    ],
    compute: (v) => Object.values(v).reduce((s, val) => s + parseInt(val), 0),
    interpret: (val) => {
      if (val <= 1) return { label: 'Mortality < 3%', color: 'green' };
      if (val <= 6) return { label: 'Mortality < 10%', color: 'yellow' };
      if (val <= 10) return { label: 'Mortality 15-20%', color: 'yellow' };
      if (val <= 14) return { label: 'Mortality 40-50%', color: 'red' };
      return { label: 'Mortality > 80%', color: 'red' };
    },
    resultUnit: 'points',
  },
  {
    id: 'qsofa', name: 'qSOFA', category: 'ICU / Critical Care',
    description: 'Quick SOFA for sepsis screening',
    citation: 'Seymour CW, et al. JAMA 2016;315:762-774',
    inputs: [
      { key: 'sbp', label: 'Systolic BP <= 100 mmHg', type: 'bool' },
      { key: 'rr', label: 'Respiratory Rate >= 22', type: 'bool' },
      { key: 'gcs', label: 'Altered mentation (GCS < 15)', type: 'bool' },
    ],
    compute: (v) => (v.sbp?1:0) + (v.rr?1:0) + (v.gcs?1:0),
    interpret: (val) => {
      if (val < 2) return { label: 'Low risk — not qSOFA positive', color: 'green' };
      return { label: 'qSOFA positive — assess for organ dysfunction', color: 'red' };
    },
    resultUnit: '/3',
  },
  {
    id: 'anion-gap', name: 'Anion Gap', category: 'General / Metabolic',
    description: 'Serum anion gap calculation',
    citation: 'Kraut JA, Madias NE. NEJM 2007;356:1045-1056',
    inputs: [
      { key: 'sodium', label: 'Sodium', unit: 'mEq/L', bounds: 'sodium' },
      { key: 'chloride', label: 'Chloride', unit: 'mEq/L', bounds: 'chloride' },
      { key: 'bicarb', label: 'Bicarbonate', unit: 'mEq/L', bounds: 'HCO3' },
    ],
    compute: ({ sodium, chloride, bicarb }) => Math.round(sodium - chloride - bicarb),
    interpret: (val) => {
      if (val < 8) return { label: 'Low — consider low albumin', color: 'yellow' };
      if (val <= 12) return { label: 'Normal anion gap', color: 'green' };
      if (val <= 20) return { label: 'Elevated — mild HAGMA', color: 'yellow' };
      return { label: 'High anion gap metabolic acidosis', color: 'red' };
    },
    resultUnit: 'mEq/L',
  },
  {
    id: 'corrected-calcium', name: 'Corrected Calcium', category: 'General / Metabolic',
    description: 'Calcium corrected for albumin',
    citation: 'Payne RB, et al. BMJ 1973;4:643-646',
    inputs: [
      { key: 'calcium', label: 'Total Calcium', unit: 'mg/dL', bounds: 'calcium' },
      { key: 'albumin', label: 'Serum Albumin', unit: 'g/dL', bounds: 'albumin' },
    ],
    compute: ({ calcium, albumin }) => (calcium + 0.8 * (4.0 - albumin)).toFixed(1),
    interpret: (val) => {
      const v = parseFloat(val);
      if (v < 8.5) return { label: 'Hypocalcaemia', color: 'red' };
      if (v <= 10.5) return { label: 'Normal', color: 'green' };
      return { label: 'Hypercalcaemia', color: 'red' };
    },
    resultUnit: 'mg/dL',
  },
  {
    id: 'corrected-na', name: 'Corrected Sodium', category: 'General / Metabolic',
    description: 'Sodium corrected for hyperglycaemia',
    citation: 'Hillier TA, et al. Am J Med 1999;106:399-403',
    inputs: [
      { key: 'sodium', label: 'Measured Sodium', unit: 'mEq/L', bounds: 'sodium' },
      { key: 'glucose', label: 'Glucose', unit: 'mg/dL', altUnit: 'mmol/L', bounds: 'glucose' },
    ],
    compute: ({ sodium, glucose }) => (sodium + 2.4 * ((glucose - 100) / 100)).toFixed(1),
    interpret: (val) => {
      const v = parseFloat(val);
      if (v < 135) return { label: 'Hyponatraemia', color: 'yellow' };
      if (v <= 145) return { label: 'Normal', color: 'green' };
      return { label: 'Hypernatraemia', color: 'yellow' };
    },
    resultUnit: 'mEq/L',
  },
  {
    id: 'map', name: 'Mean Arterial Pressure', category: 'Cardiology',
    description: 'MAP = DBP + 1/3(SBP - DBP)',
    citation: 'Standard clinical calculation',
    inputs: [
      { key: 'systolic', label: 'Systolic BP', unit: 'mmHg', bounds: 'systolic' },
      { key: 'diastolic', label: 'Diastolic BP', unit: 'mmHg', bounds: 'diastolic' },
    ],
    compute: ({ systolic, diastolic }) => Math.round(diastolic + (systolic - diastolic) / 3),
    interpret: (val) => {
      if (val < 60) return { label: 'Hypotensive — organ perfusion at risk', color: 'red' };
      if (val < 65) return { label: 'Low — minimum for perfusion', color: 'yellow' };
      if (val <= 100) return { label: 'Normal', color: 'green' };
      return { label: 'Elevated', color: 'yellow' };
    },
    resultUnit: 'mmHg',
  },
  {
    id: 'bmi', name: 'BMI', category: 'General / Metabolic',
    description: 'Body Mass Index',
    citation: 'WHO classification',
    inputs: [
      { key: 'weight', label: 'Weight', unit: 'kg', bounds: 'weight' },
      { key: 'height', label: 'Height', unit: 'cm', bounds: 'height' },
    ],
    compute: ({ weight, height }) => (weight / ((height / 100) ** 2)).toFixed(1),
    interpret: (val) => {
      const v = parseFloat(val);
      if (v < 18.5) return { label: 'Underweight', color: 'yellow' };
      if (v < 25) return { label: 'Normal', color: 'green' };
      if (v < 30) return { label: 'Overweight', color: 'yellow' };
      return { label: 'Obese', color: 'red' };
    },
    resultUnit: 'kg/m2',
  },
  {
    id: 'bsa', name: 'BSA (Mosteller)', category: 'General / Metabolic',
    description: 'Body Surface Area',
    citation: 'Mosteller RD. NEJM 1987;317:1098',
    inputs: [
      { key: 'weight', label: 'Weight', unit: 'kg', bounds: 'weight' },
      { key: 'height', label: 'Height', unit: 'cm', bounds: 'height' },
    ],
    compute: ({ weight, height }) => Math.sqrt((height * weight) / 3600).toFixed(2),
    interpret: (val) => ({ label: `BSA = ${val} m2`, color: 'blue' }),
    resultUnit: 'm2',
  },
  {
    id: 'aa-gradient', name: 'A-a Gradient', category: 'General / Metabolic',
    description: 'Alveolar-arterial oxygen gradient',
    citation: 'Standard clinical calculation',
    inputs: [
      { key: 'age', label: 'Age', unit: 'years', bounds: 'age' },
      { key: 'pao2', label: 'PaO2', unit: 'mmHg', bounds: 'pao2' },
      { key: 'paco2', label: 'PaCO2', unit: 'mmHg', bounds: 'pCO2' },
      { key: 'fio2', label: 'FiO2 (0.21-1.0)', unit: '', bounds: 'fio2' },
    ],
    compute: ({ age, pao2, paco2, fio2 }) => {
      const pAtm = 760; const pH2O = 47;
      const pAO2 = fio2 * (pAtm - pH2O) - (paco2 / 0.8);
      const gradient = pAO2 - pao2;
      return Math.round(gradient);
    },
    interpret: (val, inputs) => {
      const expected = (parseFloat(inputs?.age) || 25) / 4 + 4;
      if (val <= expected + 5) return { label: `Normal (expected ~${Math.round(expected)})`, color: 'green' };
      return { label: `Elevated (expected ~${Math.round(expected)})`, color: 'red' };
    },
    resultUnit: 'mmHg',
  },
];
