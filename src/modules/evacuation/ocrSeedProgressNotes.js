// OCR Seed Data — Progress Notes, Clinical Documentation, SOAP
// Teaches the OCR engine to interpret handwritten/printed progress notes,
// vital signs, lab values, assessment/plan, nursing notes, and clinical phrases.
//
// This is the "brain" that lets the system understand clinical documentation
// beyond simple patient lists — it can now parse progress notes, consult notes,
// handover sheets, and extract structured patient data from free text.

// ═══════════════════════════════════════════════════════════════════
// SOAP NOTE STRUCTURE — section headers and patterns
// ═══════════════════════════════════════════════════════════════════

export const SOAP_HEADERS = [
  // Standard SOAP
  'S', 'S:', 'Subjective', 'Subjective:', 'HPI', 'HPI:',
  'History of Present Illness', 'Chief Complaint', 'CC', 'CC:',
  'O', 'O:', 'Objective', 'Objective:', 'Exam', 'Exam:',
  'Physical Exam', 'PE', 'PE:', 'Physical Examination',
  'A', 'A:', 'Assessment', 'Assessment:', 'Impression', 'Impression:',
  'A/P', 'A/P:', 'Assessment/Plan', 'Assessment and Plan',
  'P', 'P:', 'Plan', 'Plan:', 'Recommendations',
  // SBAR
  'Situation', 'Background', 'Assessment', 'Recommendation',
  // ISBAR
  'Identify', 'Situation', 'Background', 'Assessment', 'Recommendation',
  // Common section headers
  'PMH', 'PMH:', 'Past Medical History', 'Past History',
  'PSH', 'PSH:', 'Past Surgical History', 'Surgical History',
  'FH', 'FH:', 'Family History', 'Family Hx',
  'SH', 'SH:', 'Social History', 'Social Hx',
  'Medications', 'Meds', 'Meds:', 'Current Medications', 'Home Medications',
  'Allergies', 'Allergies:', 'Drug Allergies', 'NKDA',
  'ROS', 'ROS:', 'Review of Systems',
  'Vitals', 'Vitals:', 'Vital Signs', 'VS', 'VS:',
  'Labs', 'Labs:', 'Laboratory', 'Lab Results', 'Investigations',
  'Imaging', 'Imaging:', 'Radiology', 'XR', 'CT', 'MRI', 'US',
  'Micro', 'Micro:', 'Microbiology', 'Cultures',
  'Consults', 'Consults:', 'Consultations',
  'Problem List', 'Active Problems', 'Problem #1', 'Problem #2',
  'Disposition', 'Dispo', 'Dispo:', 'Discharge Plan',
  'Follow-up', 'F/U', 'Follow up',
  'Code Status', 'Goals of Care', 'GOC',
  // Arabic headers
  'الشكوى', 'التاريخ المرضي', 'الفحص السريري', 'التقييم', 'الخطة',
  'الأدوية', 'الحساسية', 'التحاليل', 'الأشعة',
];

// ═══════════════════════════════════════════════════════════════════
// VITAL SIGNS — patterns, units, normal ranges
// ═══════════════════════════════════════════════════════════════════

export const VITAL_SIGN_PATTERNS = [
  // Temperature
  'Temp', 'T', 'T:', 'Temperature', 'Tmax', 'Tcurrent',
  'afebrile', 'febrile', 'fever', 'hypothermic',
  // Blood pressure
  'BP', 'BP:', 'Blood Pressure', 'SBP', 'DBP', 'MAP',
  'hypertensive', 'hypotensive', 'normotensive',
  // Heart rate
  'HR', 'HR:', 'Heart Rate', 'Pulse', 'P:', 'PR',
  'tachycardic', 'bradycardic', 'regular', 'irregular',
  'sinus rhythm', 'SR', 'NSR', 'normal sinus rhythm',
  // Respiratory rate
  'RR', 'RR:', 'Resp Rate', 'Respiratory Rate', 'Breaths',
  'tachypneic', 'eupneic',
  // Oxygen saturation
  'SpO2', 'O2 Sat', 'SaO2', 'Sat', 'Sats',
  'on RA', 'on room air', 'on NC', 'on NRB', 'on FM',
  'on 2L', 'on 3L', 'on 4L', 'on 5L', 'on 6L', 'on 10L', 'on 15L',
  'FiO2', 'PEEP',
  // Weight/BMI
  'Wt', 'Weight', 'Ht', 'Height', 'BMI',
  // GCS
  'GCS', 'Glasgow', 'E4V5M6', 'GCS 15', 'GCS 14', 'GCS 13',
  'GCS 12', 'GCS 11', 'GCS 10', 'GCS 9', 'GCS 8', 'GCS 7',
  'GCS 6', 'GCS 5', 'GCS 4', 'GCS 3',
  // Pain
  'Pain', 'Pain Score', 'NRS', 'VAS',
  // I&O
  'I/O', 'I&O', 'Input', 'Output', 'UOP', 'Urine Output',
  'Fluid Balance', 'Net', 'Total Intake', 'Total Output',
  // NEWS/MEWS
  'NEWS', 'NEWS2', 'MEWS', 'Early Warning Score',
];

export const VITAL_SIGN_UNITS = [
  '°C', '°F', 'C', 'F', 'degrees',
  'mmHg', 'mm Hg',
  'bpm', 'beats/min', '/min', 'min',
  '%', 'percent',
  'kg', 'lb', 'lbs', 'cm', 'm', 'ft', 'in',
  'L', 'mL', 'ml', 'cc', 'L/min', 'lpm',
  'breaths/min',
];

// ═══════════════════════════════════════════════════════════════════
// LABORATORY VALUES — test names, abbreviations, units
// ═══════════════════════════════════════════════════════════════════

export const LAB_TESTS = [
  // CBC
  'WBC', 'White Blood Cell', 'White Cell Count', 'Leukocytes',
  'RBC', 'Red Blood Cell', 'Erythrocytes',
  'Hgb', 'Hb', 'Hemoglobin', 'Haemoglobin',
  'Hct', 'Hematocrit', 'Haematocrit', 'PCV',
  'Plt', 'Platelets', 'Platelet Count', 'Thrombocytes',
  'MCV', 'MCH', 'MCHC', 'RDW',
  'Neutrophils', 'Neut', 'ANC', 'Absolute Neutrophil Count',
  'Lymphocytes', 'Lymph', 'ALC',
  'Monocytes', 'Mono', 'Eosinophils', 'Eos', 'Basophils', 'Baso',
  'Bands', 'Blasts', 'Reticulocytes', 'Retic',
  // BMP/CMP
  'Na', 'Sodium', 'K', 'Potassium',
  'Cl', 'Chloride', 'CO2', 'Bicarb', 'HCO3', 'Bicarbonate',
  'BUN', 'Blood Urea Nitrogen', 'Urea',
  'Cr', 'Creatinine', 'Creat',
  'Glucose', 'Glu', 'GLU', 'Blood Sugar', 'BS', 'RBS', 'FBS', 'CBG',
  'Ca', 'Calcium', 'iCa', 'Ionized Calcium',
  'Mg', 'Magnesium', 'Phos', 'Phosphate', 'Phosphorus', 'PO4',
  'Albumin', 'Alb', 'Total Protein', 'TP',
  'AG', 'Anion Gap',
  'eGFR', 'GFR', 'Estimated GFR', 'CrCl', 'Creatinine Clearance',
  // LFT
  'AST', 'SGOT', 'ALT', 'SGPT', 'ALP', 'Alk Phos', 'Alkaline Phosphatase',
  'GGT', 'Gamma GT', 'Total Bilirubin', 'T.Bili', 'Direct Bilirubin', 'D.Bili',
  'Indirect Bilirubin', 'Conjugated Bilirubin', 'Unconjugated Bilirubin',
  'LDH', 'Lactate Dehydrogenase',
  // Coagulation
  'PT', 'Prothrombin Time', 'INR', 'International Normalized Ratio',
  'aPTT', 'PTT', 'Partial Thromboplastin Time',
  'Fibrinogen', 'D-dimer', 'D-Dimer', 'FDP',
  'Anti-Xa', 'Heparin Level',
  // Cardiac
  'Troponin', 'Trop', 'TnI', 'TnT', 'hs-TnI', 'hs-TnT', 'High-sensitivity Troponin',
  'CK', 'CPK', 'CK-MB', 'BNP', 'NT-proBNP', 'ProBNP',
  // Inflammatory
  'CRP', 'C-Reactive Protein', 'ESR', 'Sed Rate',
  'Procalcitonin', 'PCT', 'Ferritin', 'LDH',
  // Thyroid
  'TSH', 'Free T4', 'FT4', 'Free T3', 'FT3', 'T3', 'T4',
  // Lipids
  'Total Cholesterol', 'TC', 'LDL', 'HDL', 'Triglycerides', 'TG',
  // Diabetes
  'HbA1c', 'A1c', 'Glycated Hemoglobin', 'Hemoglobin A1c',
  'C-peptide', 'Fasting Glucose', 'OGTT',
  // Renal
  'Urine Analysis', 'UA', 'Urinalysis',
  'Urine Culture', 'U/C', 'UCx',
  'Urine Protein', 'Urine Creatinine', 'PCR', 'ACR',
  '24hr Urine Protein', 'Urine Electrolytes',
  // ABG/VBG
  'ABG', 'Arterial Blood Gas', 'VBG', 'Venous Blood Gas',
  'pH', 'pCO2', 'pO2', 'PaO2', 'PaCO2',
  'HCO3', 'Base Excess', 'BE', 'Lactate', 'Lac',
  'P/F Ratio', 'PaO2/FiO2',
  // Microbiology
  'Blood Culture', 'BCx', 'B/C', 'Blood Cx',
  'Sputum Culture', 'Sputum Cx', 'Sputum Gram Stain',
  'Wound Culture', 'Wound Cx', 'Wound Swab',
  'CSF', 'CSF Analysis', 'LP', 'Lumbar Puncture',
  'Gram Stain', 'AFB', 'AFB Smear', 'AFB Culture',
  'Sensitivity', 'Susceptibility', 'C&S',
  // Tumor markers
  'AFP', 'CEA', 'CA-125', 'CA 19-9', 'CA 15-3', 'PSA',
  'Beta-HCG', 'HCG', 'LDH',
  // Autoimmune
  'ANA', 'Anti-dsDNA', 'Anti-Smith', 'ANCA', 'p-ANCA', 'c-ANCA',
  'Complement C3', 'Complement C4', 'RF', 'Rheumatoid Factor',
  'Anti-CCP', 'Coombs', 'Direct Coombs', 'Indirect Coombs',
  // Misc
  'Ammonia', 'Cortisol', 'ACTH', 'Vitamin D', '25-OH Vitamin D',
  'Vitamin B12', 'Folate', 'Iron', 'TIBC', 'Transferrin Saturation',
  'Haptoglobin', 'Reticulocyte Count',
  'Uric Acid', 'Lipase', 'Amylase',
  'Drug Level', 'Trough', 'Peak', 'Vancomycin Level', 'Digoxin Level',
  'Phenytoin Level', 'Valproic Acid Level', 'Lithium Level',
  'Tacrolimus Level', 'Cyclosporine Level',
];

export const LAB_UNITS = [
  'g/dL', 'g/L', 'mg/dL', 'mg/L', 'mcg/dL', 'mcg/L',
  'mmol/L', 'mEq/L', 'umol/L', 'nmol/L', 'pmol/L',
  'U/L', 'IU/L', 'mIU/L', 'uIU/mL',
  'ng/mL', 'ng/dL', 'ng/L', 'pg/mL',
  'x10^3/uL', 'x10^6/uL', 'x10^9/L', 'x10^12/L',
  'K/uL', 'M/uL', 'cells/uL',
  '%', 'ratio', 'seconds', 'sec', 'mins',
  'mL/min', 'mL/min/1.73m2',
  'mm/hr', 'mg/24hr',
  'positive', 'negative', 'reactive', 'non-reactive',
  'pending', 'in progress', 'final', 'preliminary',
  'normal', 'abnormal', 'critical', 'high', 'low', 'H', 'L', 'HH', 'LL',
];

// ═══════════════════════════════════════════════════════════════════
// CLINICAL PHRASES — common progress note language
// ═══════════════════════════════════════════════════════════════════

export const CLINICAL_PHRASES = [
  // Subjective
  'Patient reports', 'Patient denies', 'Patient complains of',
  'c/o', 'complains of', 'reports', 'denies', 'states',
  'no complaints', 'no new complaints', 'feeling better', 'feeling worse',
  'pain improved', 'pain unchanged', 'pain worsened',
  'nausea', 'vomiting', 'diarrhea', 'constipation',
  'SOB', 'shortness of breath', 'dyspnea', 'orthopnea', 'PND',
  'chest pain', 'CP', 'palpitations', 'dizziness', 'lightheadedness',
  'headache', 'HA', 'blurred vision', 'diplopia',
  'cough', 'productive cough', 'dry cough', 'hemoptysis',
  'abdominal pain', 'abd pain', 'epigastric pain', 'RUQ pain', 'LLQ pain',
  'dysuria', 'frequency', 'urgency', 'hematuria', 'oliguria', 'anuria',
  'edema', 'swelling', 'LE edema', 'bilateral LE edema', 'pedal edema',
  'weakness', 'fatigue', 'malaise', 'lethargy',
  'fever', 'chills', 'rigors', 'night sweats', 'diaphoresis',
  'appetite decreased', 'poor appetite', 'anorexia', 'weight loss',
  'insomnia', 'poor sleep', 'confusion', 'disorientation',
  'fall', 'mechanical fall', 'unwitnessed fall', 'witnessed fall',
  'unable to ambulate', 'difficulty walking', 'gait unsteady',
  // Objective — Physical Exam
  'General', 'Gen', 'NAD', 'no acute distress', 'appears comfortable',
  'alert and oriented', 'A&O', 'A&Ox3', 'A&Ox4', 'AO x 3', 'AO x 4',
  'lethargic but arousable', 'obtunded', 'unresponsive', 'comatose',
  'HEENT', 'Head', 'Eyes', 'Ears', 'Nose', 'Throat', 'Neck',
  'PERRL', 'PERRLA', 'pupils equal round reactive',
  'no JVD', 'JVD present', 'JVP elevated', 'supple', 'no LAD',
  'CV', 'Cardiovascular', 'Heart', 'Cardiac',
  'RRR', 'regular rate and rhythm', 'S1 S2', 'no murmur',
  'murmur', 'systolic murmur', 'diastolic murmur', 'gallop', 'S3', 'S4',
  'Resp', 'Respiratory', 'Lungs', 'Pulmonary', 'Chest',
  'CTAB', 'clear to auscultation bilaterally', 'clear bilaterally',
  'crackles', 'rales', 'rhonchi', 'wheezing', 'wheeze',
  'decreased breath sounds', 'diminished breath sounds',
  'bibasilar crackles', 'bilateral crackles',
  'GI', 'Abdomen', 'Abd', 'Abdominal',
  'soft', 'non-tender', 'non-distended', 'NTND', 'S/NT/ND',
  'tender', 'distended', 'guarding', 'rebound', 'rigidity',
  'BS+', 'bowel sounds present', 'BS absent', 'hypoactive BS', 'hyperactive BS',
  'hepatomegaly', 'splenomegaly', 'ascites',
  'GU', 'Genitourinary', 'Foley in place', 'Foley draining clear urine',
  'MSK', 'Musculoskeletal', 'Extremities', 'Ext',
  'no edema', 'bilateral LE edema', 'pitting edema', '1+ edema', '2+ edema',
  'full ROM', 'limited ROM', 'tenderness', 'swelling', 'warmth', 'erythema',
  'pulses intact', 'pedal pulses palpable', 'DP pulses', 'PT pulses',
  'Neuro', 'Neurological',
  'oriented x3', 'oriented x4', 'CN II-XII intact', 'cranial nerves intact',
  'motor strength 5/5', 'sensation intact', 'reflexes symmetric',
  'Babinski negative', 'no focal deficits', 'no focal neurological deficits',
  'Skin', 'Integumentary', 'Derm',
  'warm and dry', 'cool extremities', 'cyanosis', 'jaundice', 'pallor',
  'rash', 'decubitus', 'pressure ulcer', 'stage I', 'stage II', 'stage III', 'stage IV',
  'wound clean', 'wound healing', 'wound dehiscence', 'erythema around wound',
  'Psych', 'Psychiatric', 'Mood', 'Affect',
  'calm', 'cooperative', 'agitated', 'anxious', 'flat affect', 'appropriate affect',

  // Assessment language
  'likely', 'probable', 'possible', 'suspected', 'confirmed', 'ruled out', 'r/o',
  'consistent with', 'concerning for', 'suggestive of', 'in keeping with',
  'stable', 'improved', 'improving', 'worsening', 'deteriorating', 'unchanged',
  'acute', 'chronic', 'acute on chronic', 'subacute', 'resolving', 'resolved',
  'new onset', 'recurrent', 'exacerbation', 'flare',
  'secondary to', 'due to', 'caused by', 'attributed to', 'related to',
  'complicated by', 'superimposed', 'in the setting of',
  'high risk', 'low risk', 'moderate risk',
  'prognosis poor', 'prognosis guarded', 'prognosis good',
  'clinically stable', 'clinically improving', 'hemodynamically stable',
  'hemodynamically unstable', 'HD stable',

  // Plan language
  'continue', 'continue current management', 'continue antibiotics',
  'start', 'initiate', 'commence', 'begin',
  'stop', 'discontinue', 'D/C', 'hold', 'withhold',
  'increase', 'uptitrate', 'escalate', 'dose increase',
  'decrease', 'downtitrate', 'de-escalate', 'dose reduction', 'taper', 'wean',
  'switch', 'change to', 'transition to', 'convert to',
  'monitor', 'observe', 'watch', 'trend', 'serial', 'repeat',
  'check', 'order', 'send', 'obtain', 'collect',
  'consult', 'refer', 'referral to', 'request consult',
  'discuss with', 'communicated with', 'informed', 'updated',
  'educated', 'counseled', 'advised',
  'discharge when', 'plan for discharge', 'tentative discharge',
  'keep NPO', 'advance diet', 'regular diet', 'soft diet', 'clear liquids',
  'DVT prophylaxis', 'VTE prophylaxis', 'pneumatic boots', 'SCDs',
  'fall precautions', 'seizure precautions', 'aspiration precautions',
  'telemetry', 'continuous monitoring', 'cardiac monitor',
  'strict I&O', 'daily weights', 'blood glucose monitoring', 'FSBS q6h',
  'wound care', 'dressing change', 'wound VAC',
  'PT/OT', 'physical therapy', 'occupational therapy', 'speech therapy',
  'social work', 'case management', 'palliative care consult',
  'family meeting', 'goals of care discussion', 'GOC discussion',
  'code status confirmed', 'remains full code', 'changed to DNR',
  'ICU transfer', 'step down', 'floor transfer',
  'pending results', 'awaiting', 'follow up results',
];

// ═══════════════════════════════════════════════════════════════════
// PROCEDURES & INTERVENTIONS — common in progress notes
// ═══════════════════════════════════════════════════════════════════

export const PROCEDURES = [
  // Lines/Access
  'PIV', 'Peripheral IV', 'Central Line', 'Central Venous Catheter', 'CVC',
  'PICC', 'PICC Line', 'Midline', 'Arterial Line', 'A-line',
  'Triple Lumen', 'Cordis', 'Dialysis Catheter', 'Permacath',
  'Port', 'Port-a-Cath', 'Hickman', 'IO', 'Intraosseous',
  // Airway
  'Intubation', 'Intubated', 'ETT', 'Endotracheal Tube',
  'Extubation', 'Extubated', 'Tracheostomy', 'Trach',
  'LMA', 'Laryngeal Mask', 'Cricothyrotomy',
  'Ventilator', 'Mechanical Ventilation', 'SIMV', 'AC', 'PS', 'CPAP', 'BiPAP',
  'HFNC', 'High Flow Nasal Cannula',
  'Prone positioning', 'Proning',
  // Cardiovascular
  'CPR', 'Defibrillation', 'Cardioversion', 'Pacing', 'Temporary Pacemaker',
  'PCI', 'Percutaneous Coronary Intervention', 'Coronary Angiography',
  'CABG', 'Coronary Artery Bypass', 'Valve Replacement',
  'IABP', 'Intra-Aortic Balloon Pump', 'Impella', 'ECMO',
  'Pericardiocentesis', 'Chest Tube', 'Thoracentesis', 'Thoracostomy',
  // GI
  'NGT', 'Nasogastric Tube', 'NG Tube', 'OGT', 'Orogastric',
  'PEG', 'PEG Tube', 'Gastrostomy', 'NJ Tube', 'Jejunostomy',
  'EGD', 'Esophagogastroduodenoscopy', 'Upper Endoscopy',
  'Colonoscopy', 'Sigmoidoscopy', 'ERCP',
  'Paracentesis', 'Abdominal Tap', 'Ascitic Tap',
  // Renal
  'Hemodialysis', 'HD', 'Peritoneal Dialysis', 'PD',
  'CRRT', 'CVVHD', 'CVVHDF', 'Continuous Renal Replacement',
  'Foley Catheter', 'Foley', 'Urinary Catheter',
  'Suprapubic Catheter', 'SPC', 'Nephrostomy',
  // Neuro
  'Lumbar Puncture', 'LP', 'Spinal Tap',
  'EVD', 'External Ventricular Drain', 'ICP Monitor',
  'EEG', 'Electroencephalogram',
  'CT Head', 'CT Brain', 'MRI Brain',
  // Wound/Surgical
  'Wound Debridement', 'I&D', 'Incision and Drainage',
  'Suturing', 'Staples', 'Wound Closure',
  'Skin Graft', 'Fasciotomy', 'Amputation',
  'Cast', 'Splint', 'Traction', 'ORIF', 'External Fixation',
  // Transfusion
  'Blood Transfusion', 'PRBC Transfusion', 'Platelet Transfusion',
  'FFP Transfusion', 'Cryoprecipitate', 'Exchange Transfusion',
  'Massive Transfusion Protocol', 'MTP',
];

// ═══════════════════════════════════════════════════════════════════
// NURSING OBSERVATIONS & CARE
// ═══════════════════════════════════════════════════════════════════

export const NURSING_TERMS = [
  // Assessment
  'Nursing Assessment', 'Shift Assessment', 'Head-to-Toe',
  'Handover', 'Handoff', 'Shift Report', 'Bedside Report',
  'Focused Assessment', 'Reassessment',
  // Safety
  'Fall Risk', 'High Fall Risk', 'Braden Score', 'Morse Fall Scale',
  'Bed Alarm', 'Chair Alarm', 'Side Rails', 'Restraints',
  'Sitter', '1:1', 'One-to-One', 'Close Observation',
  'Elopement Risk', 'Wandering Risk',
  // Skin/Wound
  'Skin Assessment', 'Intact', 'Breakdown', 'Pressure Injury',
  'Stage I PI', 'Stage II PI', 'DTPI', 'Unstageable',
  'Wound Measurement', 'Wound Bed', 'Granulation', 'Slough', 'Eschar',
  'Exudate', 'Serous', 'Serosanguinous', 'Purulent',
  'Dressing Change', 'Wound Care', 'Wound VAC',
  'Turning Schedule', 'Repositioned', 'Turn Q2H',
  // Nutrition
  'NPO', 'Nothing by Mouth', 'Clear Liquids', 'Full Liquids',
  'Soft Diet', 'Regular Diet', 'Cardiac Diet', 'Renal Diet', 'Diabetic Diet',
  'TPN', 'Total Parenteral Nutrition', 'PPN',
  'Tube Feeding', 'Enteral Feeding', 'Bolus Feeding', 'Continuous Feeding',
  'Calorie Count', 'Dietary Consult', 'Dietitian',
  'Swallow Evaluation', 'Aspiration Risk', 'Thickened Liquids',
  // Elimination
  'Bowel Movement', 'BM', 'Last BM', 'No BM', 'Constipated',
  'Diarrhea', 'Melena', 'Hematochezia', 'Guaiac Positive', 'Guaiac Negative',
  'Foley Output', 'Void', 'Voided', 'Continent', 'Incontinent',
  'Residual', 'PVR', 'Post-Void Residual', 'Bladder Scan',
  'Colostomy', 'Ileostomy', 'Stoma', 'Ostomy Care',
  // Activity/Mobility
  'Bed Rest', 'Bedrest', 'BRP', 'Bathroom Privileges',
  'OOB', 'Out of Bed', 'OOB to Chair', 'Ambulated',
  'Ambulated in Hall', 'Ambulated with Assist', 'Ambulated x1',
  'Walker', 'Cane', 'Crutches', 'Wheelchair',
  'PT Evaluation', 'OT Evaluation', 'PT/OT',
  'Weight Bearing', 'WBAT', 'NWB', 'Non-Weight Bearing',
  'TDWB', 'Touch Down Weight Bearing', 'PWB', 'Partial Weight Bearing',
  // IV/Lines
  'IV Site', 'IV Patent', 'IV Infiltrated', 'IV Discontinued',
  'Saline Lock', 'Hep Lock', 'IV Fluid Running',
  'Site Clean Dry Intact', 'CDI', 'No Redness', 'No Swelling',
  'Dressing CDI', 'Line Day', 'Line Day #', 'Central Line Day',
  // Medications
  'Med Administration', 'Medication Given', 'PRN Given',
  'Medication Held', 'Medication Refused', 'Unable to Take PO',
  'Insulin Coverage', 'Sliding Scale', 'FSBS', 'Finger Stick',
  'Blood Sugar', 'Accucheck', 'Glucometer',
  'PCA', 'Patient Controlled Analgesia', 'Epidural',
  // Communication
  'MD Notified', 'MD Aware', 'Physician Notified', 'Dr. Notified',
  'Rapid Response', 'RRT', 'Code Blue', 'Code Called',
  'Family Updated', 'Family at Bedside', 'Family Conference',
  'Interpreter Used', 'Patient Education', 'Discharge Teaching',
];

// ═══════════════════════════════════════════════════════════════════
// CLINICAL ABBREVIATIONS — massive list for OCR interpretation
// ═══════════════════════════════════════════════════════════════════

export const CLINICAL_ABBREVIATIONS = {
  // Status/Condition
  'NAD': 'No acute distress',
  'WNL': 'Within normal limits',
  'NOS': 'Not otherwise specified',
  'NYD': 'Not yet diagnosed',
  'WDWN': 'Well developed well nourished',
  'AAOx3': 'Alert and oriented x3',
  'AAOx4': 'Alert and oriented x4',
  'AMS': 'Altered mental status',
  'LOC': 'Loss of consciousness',
  'GCS': 'Glasgow Coma Scale',

  // Respiratory
  'SOB': 'Shortness of breath',
  'DOE': 'Dyspnea on exertion',
  'PND': 'Paroxysmal nocturnal dyspnea',
  'CTAB': 'Clear to auscultation bilaterally',
  'CTA': 'Clear to auscultation',
  'CXR': 'Chest X-ray',
  'ABG': 'Arterial blood gas',
  'VBG': 'Venous blood gas',
  'ETT': 'Endotracheal tube',
  'NIPPV': 'Non-invasive positive pressure ventilation',
  'PEEP': 'Positive end-expiratory pressure',
  'FiO2': 'Fraction of inspired oxygen',
  'TV': 'Tidal volume',
  'RR': 'Respiratory rate',
  'MV': 'Minute ventilation',

  // Cardiovascular
  'RRR': 'Regular rate and rhythm',
  'NSR': 'Normal sinus rhythm',
  'LBBB': 'Left bundle branch block',
  'RBBB': 'Right bundle branch block',
  'LVH': 'Left ventricular hypertrophy',
  'RVH': 'Right ventricular hypertrophy',
  'EF': 'Ejection fraction',
  'CO': 'Cardiac output',
  'CI': 'Cardiac index',
  'SVR': 'Systemic vascular resistance',
  'CVP': 'Central venous pressure',
  'JVD': 'Jugular venous distension',
  'JVP': 'Jugular venous pressure',
  'PMI': 'Point of maximal impulse',

  // GI
  'NTND': 'Non-tender non-distended',
  'BS': 'Bowel sounds',
  'NGT': 'Nasogastric tube',
  'TPN': 'Total parenteral nutrition',
  'NPO': 'Nil per os (nothing by mouth)',
  'PO': 'Per os (by mouth)',
  'PR': 'Per rectum',
  'SBO': 'Small bowel obstruction',
  'LBO': 'Large bowel obstruction',
  'RUQ': 'Right upper quadrant',
  'RLQ': 'Right lower quadrant',
  'LUQ': 'Left upper quadrant',
  'LLQ': 'Left lower quadrant',
  'ERCP': 'Endoscopic retrograde cholangiopancreatography',
  'EGD': 'Esophagogastroduodenoscopy',

  // Renal/GU
  'UOP': 'Urine output',
  'BMP': 'Basic metabolic panel',
  'CMP': 'Comprehensive metabolic panel',
  'BUN': 'Blood urea nitrogen',
  'Cr': 'Creatinine',
  'GFR': 'Glomerular filtration rate',
  'RRT': 'Renal replacement therapy',
  'CRRT': 'Continuous renal replacement therapy',
  'HD': 'Hemodialysis',
  'PD': 'Peritoneal dialysis',
  'AKI': 'Acute kidney injury',
  'CKD': 'Chronic kidney disease',
  'ESRD': 'End-stage renal disease',

  // Neuro
  'CN': 'Cranial nerves',
  'DTR': 'Deep tendon reflexes',
  'ROM': 'Range of motion',
  'EEG': 'Electroencephalogram',
  'EMG': 'Electromyography',
  'NCS': 'Nerve conduction study',
  'LP': 'Lumbar puncture',
  'CSF': 'Cerebrospinal fluid',
  'EVD': 'External ventricular drain',
  'ICP': 'Intracranial pressure',
  'CPP': 'Cerebral perfusion pressure',

  // Orders/Admin
  'Rx': 'Prescription/Treatment',
  'Dx': 'Diagnosis',
  'Hx': 'History',
  'Sx': 'Symptoms/Surgery',
  'Tx': 'Treatment/Transplant',
  'Fx': 'Fracture',
  'Bx': 'Biopsy',
  'Cx': 'Culture',
  'Px': 'Prognosis',
  'Mx': 'Management',
  'DDx': 'Differential diagnosis',
  'PMH': 'Past medical history',
  'PSH': 'Past surgical history',
  'FH': 'Family history',
  'SH': 'Social history',
  'HPI': 'History of present illness',
  'ROS': 'Review of systems',
  'PE': 'Physical examination',
  'I&O': 'Intake and output',
  'PRN': 'As needed',
  'QD': 'Every day',
  'QOD': 'Every other day',
  'BID': 'Twice daily',
  'TID': 'Three times daily',
  'QID': 'Four times daily',
  'QHS': 'At bedtime',
  'AC': 'Before meals',
  'PC': 'After meals',
  'STAT': 'Immediately',
  'IV': 'Intravenous',
  'IM': 'Intramuscular',
  'SC': 'Subcutaneous',
  'SL': 'Sublingual',
  'PO': 'By mouth',
  'PR': 'Per rectum',
  'INH': 'Inhaled',
  'TOP': 'Topical',
  'GTT': 'Drops/Drip',
  'D/C': 'Discontinue/Discharge',
  'AMA': 'Against medical advice',
  'DAMA': 'Discharged against medical advice',
  'MOFD': 'Medically optimized for discharge',
  'FFD': 'Fit for discharge',
  'EDD': 'Expected date of discharge',
  'LOA': 'Leave of absence',
  'ADL': 'Activities of daily living',
  'DNR': 'Do not resuscitate',
  'DNAR': 'Do not attempt resuscitation',
  'AND': 'Allow natural death',
  'GOC': 'Goals of care',
  'CMO': 'Comfort measures only',
  'POLST': 'Physician orders for life-sustaining treatment',
};

// ═══════════════════════════════════════════════════════════════════
// IMAGING FINDINGS — radiology report terms
// ═══════════════════════════════════════════════════════════════════

export const IMAGING_TERMS = [
  // Modalities
  'CXR', 'Chest X-ray', 'PA', 'AP', 'Lateral',
  'CT', 'CT scan', 'CT Head', 'CT Chest', 'CT Abdomen', 'CT Pelvis',
  'CTPA', 'CT Pulmonary Angiography', 'CTA',
  'MRI', 'MRI Brain', 'MRI Spine', 'MRI Abdomen',
  'Ultrasound', 'US', 'Doppler', 'ECHO', 'Echocardiogram', 'TTE', 'TEE',
  'V/Q Scan', 'Ventilation Perfusion Scan',
  'PET', 'PET-CT', 'Bone Scan', 'Nuclear Medicine',
  'Fluoroscopy', 'Angiography', 'Catheterization',
  'DEXA', 'Bone Density',
  // Common findings
  'Consolidation', 'Infiltrate', 'Opacity', 'Opacification',
  'Effusion', 'Pleural Effusion', 'Pericardial Effusion',
  'Pneumothorax', 'Hemothorax', 'Atelectasis',
  'Cardiomegaly', 'Pulmonary Edema', 'Congestion', 'Vascular Congestion',
  'Mass', 'Lesion', 'Nodule', 'Lymphadenopathy', 'LAD',
  'Fracture', 'Dislocation', 'Subluxation',
  'Stenosis', 'Occlusion', 'Thrombus', 'Thrombosis',
  'Aneurysm', 'Dissection', 'Hemorrhage', 'Hematoma',
  'Obstruction', 'Ileus', 'Free Air', 'Pneumoperitoneum',
  'Calcification', 'Stone', 'Calculus',
  'Abscess', 'Collection', 'Fluid Collection',
  'Edema', 'Inflammation', 'Enhancement',
  'Midline shift', 'Mass effect', 'Herniation',
  'No acute findings', 'Unremarkable', 'Normal study',
  'Stable', 'Unchanged', 'Interval improvement', 'Interval worsening',
  'New finding', 'Developing', 'Evolving',
  'Recommend correlation', 'Recommend follow-up', 'Clinical correlation advised',
];

// ═══════════════════════════════════════════════════════════════════
// HANDOVER/SIGNOUT PATTERNS — shift change documentation
// ═══════════════════════════════════════════════════════════════════

export const HANDOVER_PATTERNS = [
  // Patient identifiers
  'Bed', 'Room', 'Name', 'Age', 'Sex', 'MRN', 'Civil ID',
  'Admission Date', 'Admitted', 'LOS', 'Length of Stay', 'Day #',
  'Attending', 'Primary Team', 'Consultant', 'Resident', 'Intern',
  // Clinical status
  'Active Issues', 'Active Problems', 'Problem List',
  'Overnight Events', 'Events', 'Significant Events',
  'To Do', 'Action Items', 'Tasks', 'Pending',
  'Anticipatory Guidance', 'If-Then', 'Contingency',
  'Code Status', 'Allergies', 'Weight',
  // Transitions
  'Situation', 'Background', 'Assessment', 'Recommendation',
  'Sign Out', 'Sign-Out', 'Signout', 'Handover', 'Handoff',
  'Cross Cover', 'Cross-Cover', 'Covering',
  'On Call', 'Night Float', 'Day Team', 'Night Team',
  // Nursing specific
  'Report Given', 'Report Received', 'Verbal Orders',
  'Telephone Orders', 'T.O.', 'V.O.',
  'Read Back', 'Verified', 'Cosigned',
];

// ═══════════════════════════════════════════════════════════════════
// OCR-SPECIFIC WORD CORRECTIONS — progress note misreads
// ═══════════════════════════════════════════════════════════════════

export const PROGRESS_NOTE_CORRECTIONS = {
  // Common OCR errors in clinical text
  'patienl': { truth: 'Patient', entity: 'CLINICAL' },
  'patlent': { truth: 'Patient', entity: 'CLINICAL' },
  'patiert': { truth: 'Patient', entity: 'CLINICAL' },
  'denles': { truth: 'Denies', entity: 'CLINICAL' },
  'dernies': { truth: 'Denies', entity: 'CLINICAL' },
  'reporls': { truth: 'Reports', entity: 'CLINICAL' },
  'cornplains': { truth: 'Complains', entity: 'CLINICAL' },
  'rnedication': { truth: 'Medication', entity: 'CLINICAL' },
  'rnedications': { truth: 'Medications', entity: 'CLINICAL' },
  'treatrnent': { truth: 'Treatment', entity: 'CLINICAL' },
  'diagnosls': { truth: 'Diagnosis', entity: 'CLINICAL' },
  'diagnosts': { truth: 'Diagnosis', entity: 'CLINICAL' },
  'assessrnent': { truth: 'Assessment', entity: 'CLINICAL' },
  'exarnination': { truth: 'Examination', entity: 'CLINICAL' },
  'irnproved': { truth: 'Improved', entity: 'CLINICAL' },
  'irnproving': { truth: 'Improving', entity: 'CLINICAL' },
  'worsenling': { truth: 'Worsening', entity: 'CLINICAL' },
  'stabie': { truth: 'Stable', entity: 'CLINICAL' },
  'stab1e': { truth: 'Stable', entity: 'CLINICAL' },
  'normai': { truth: 'Normal', entity: 'CLINICAL' },
  'norrnal': { truth: 'Normal', entity: 'CLINICAL' },
  'abnorrnal': { truth: 'Abnormal', entity: 'CLINICAL' },
  'blateral': { truth: 'Bilateral', entity: 'CLINICAL' },
  'bi1ateral': { truth: 'Bilateral', entity: 'CLINICAL' },
  'discharged': { truth: 'Discharged', entity: 'CLINICAL' },
  'dlscharged': { truth: 'Discharged', entity: 'CLINICAL' },
  'adrnitted': { truth: 'Admitted', entity: 'CLINICAL' },
  'adrnission': { truth: 'Admission', entity: 'CLINICAL' },
  'antibiotlcs': { truth: 'Antibiotics', entity: 'CLINICAL' },
  'antlbiotics': { truth: 'Antibiotics', entity: 'CLINICAL' },
  'lnsulin': { truth: 'Insulin', entity: 'MEDICATION' },
  'insuiln': { truth: 'Insulin', entity: 'MEDICATION' },
  'hernodynamically': { truth: 'Hemodynamically', entity: 'CLINICAL' },
  'hernodialysis': { truth: 'Hemodialysis', entity: 'CLINICAL' },
  'hernoglobin': { truth: 'Hemoglobin', entity: 'CLINICAL' },
  'pneurnonia': { truth: 'Pneumonia', entity: 'DIAGNOSIS' },
  'pneumonla': { truth: 'Pneumonia', entity: 'DIAGNOSIS' },
  'ventllator': { truth: 'Ventilator', entity: 'CLINICAL' },
  'venti1ator': { truth: 'Ventilator', entity: 'CLINICAL' },
  'rnonitoring': { truth: 'Monitoring', entity: 'CLINICAL' },
  'rnonitor': { truth: 'Monitor', entity: 'CLINICAL' },
  'consuitant': { truth: 'Consultant', entity: 'CLINICAL' },
  'consu1tant': { truth: 'Consultant', entity: 'CLINICAL' },
  'transfuslon': { truth: 'Transfusion', entity: 'CLINICAL' },
  'transfusi0n': { truth: 'Transfusion', entity: 'CLINICAL' },
  'lnfection': { truth: 'Infection', entity: 'DIAGNOSIS' },
  'infectlon': { truth: 'Infection', entity: 'DIAGNOSIS' },
  'resplratory': { truth: 'Respiratory', entity: 'CLINICAL' },
  'resp1ratory': { truth: 'Respiratory', entity: 'CLINICAL' },
  'cardlovascular': { truth: 'Cardiovascular', entity: 'CLINICAL' },
  'neuroiogical': { truth: 'Neurological', entity: 'CLINICAL' },
  'abdorninal': { truth: 'Abdominal', entity: 'CLINICAL' },
  'abdornlnal': { truth: 'Abdominal', entity: 'CLINICAL' },
  'rnusculoskeletal': { truth: 'Musculoskeletal', entity: 'CLINICAL' },
  'genitourlnary': { truth: 'Genitourinary', entity: 'CLINICAL' },
  'integurnentary': { truth: 'Integumentary', entity: 'CLINICAL' },
  'psychlatric': { truth: 'Psychiatric', entity: 'CLINICAL' },
  'endocrlne': { truth: 'Endocrine', entity: 'CLINICAL' },
  'hernatology': { truth: 'Hematology', entity: 'CLINICAL' },
  'oncoiogy': { truth: 'Oncology', entity: 'CLINICAL' },
  'nephroiogy': { truth: 'Nephrology', entity: 'CLINICAL' },
  'cardloiogy': { truth: 'Cardiology', entity: 'CLINICAL' },
  'pulmono1ogy': { truth: 'Pulmonology', entity: 'CLINICAL' },
  'gastroentero1ogy': { truth: 'Gastroenterology', entity: 'CLINICAL' },
  'rheumato1ogy': { truth: 'Rheumatology', entity: 'CLINICAL' },
  'infectlous': { truth: 'Infectious', entity: 'CLINICAL' },
  'surglcal': { truth: 'Surgical', entity: 'CLINICAL' },
  'orthopaedlc': { truth: 'Orthopaedic', entity: 'CLINICAL' },
  'obstetrlcs': { truth: 'Obstetrics', entity: 'CLINICAL' },
  'paedlatrics': { truth: 'Paediatrics', entity: 'CLINICAL' },
};

// ═══════════════════════════════════════════════════════════════════
// LOADER — injects progress note vocabulary into learner models
// ═══════════════════════════════════════════════════════════════════

export function loadProgressNoteSeedData(models) {
  const now = new Date().toISOString();

  // Add all clinical phrases as known diagnoses/status terms
  // (the learner uses these for entity boosting)
  const clinicalTerms = [
    ...CLINICAL_PHRASES,
    ...PROCEDURES,
    ...NURSING_TERMS,
    ...IMAGING_TERMS,
    ...HANDOVER_PATTERNS,
    ...VITAL_SIGN_PATTERNS,
    ...LAB_TESTS,
  ];

  for (const term of clinicalTerms) {
    const key = term.toLowerCase();
    if (key.length < 2) continue;
    // Add to diagnoses vocab (clinical context recognition)
    if (!models.diagnoses[key]) {
      models.diagnoses[key] = {
        count: 1,
        entity: 'CLINICAL_TERM',
        lastSeen: now,
        confidence: 0.65,
        seeded: true,
      };
    }
  }

  // Add lab tests specifically
  for (const test of LAB_TESTS) {
    const key = test.toLowerCase();
    if (!models.labTests) models.labTests = {};
    if (!models.labTests[key]) {
      models.labTests[key] = {
        count: 2,
        entity: 'LAB_TEST',
        lastSeen: now,
        confidence: 0.80,
        seeded: true,
      };
    }
  }

  // Add clinical abbreviations
  if (!models.abbreviations) models.abbreviations = {};
  for (const [abbr, full] of Object.entries(CLINICAL_ABBREVIATIONS)) {
    const key = abbr.toLowerCase();
    if (!models.abbreviations[key]) {
      models.abbreviations[key] = {
        expansion: full,
        count: 3,
        confidence: 0.90,
        seeded: true,
      };
    }
  }

  // Add progress note word corrections
  for (const [ocr, correction] of Object.entries(PROGRESS_NOTE_CORRECTIONS)) {
    if (!models.corrections[ocr]) {
      models.corrections[ocr] = {
        truth: correction.truth,
        count: 4,
        entity: correction.entity,
        confidence: 0.90,
        seeded: true,
      };
    }
  }

  // Add SOAP headers as recognized structure markers
  if (!models.structureMarkers) models.structureMarkers = {};
  for (const header of SOAP_HEADERS) {
    const key = header.toLowerCase().replace(/:$/, '');
    if (!models.structureMarkers[key]) {
      models.structureMarkers[key] = {
        type: 'SECTION_HEADER',
        count: 5,
        confidence: 0.85,
        seeded: true,
      };
    }
  }

  // Add lab units for recognition
  if (!models.units) models.units = {};
  const allUnits = [...LAB_UNITS, ...VITAL_SIGN_UNITS];
  for (const unit of allUnits) {
    const key = unit.toLowerCase();
    if (!models.units[key]) {
      models.units[key] = { type: 'UNIT', count: 2, seeded: true };
    }
  }

  models.progressNoteSeeded = true;
  return models;
}
