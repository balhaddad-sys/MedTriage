// OCR Seed — Clinical Reasoning Patterns
// Differential diagnoses, clinical decision rules, disposition criteria,
// escalation triggers, admission criteria, discharge criteria,
// handover checklists, order sets, protocol triggers

// ═══════════════════════════════════════════════════════════════════
// DIFFERENTIAL DIAGNOSIS MAPS
// "Patient has X → consider these diagnoses"
// ═══════════════════════════════════════════════════════════════════

export const DIFFERENTIAL_MAPS = {
  chest_pain: {
    emergent: ['STEMI','NSTEMI','Aortic dissection','Tension pneumothorax','Cardiac tamponade','PE','Esophageal rupture'],
    urgent: ['Unstable angina','Pericarditis','Myocarditis','Pneumonia','Pneumothorax','Pleural effusion'],
    common: ['GERD','Costochondritis','Musculoskeletal','Anxiety','Esophageal spasm','Herpes zoster'],
  },
  dyspnea: {
    emergent: ['PE','Tension pneumothorax','Anaphylaxis','Foreign body aspiration','STEMI','Flash pulmonary edema'],
    urgent: ['AECOPD','Acute asthma','Pneumonia','ADHF','Pleural effusion','Pneumothorax','ARDS'],
    common: ['Anxiety','Deconditioning','Anemia','Obesity','Interstitial lung disease','Pericardial effusion'],
  },
  abdominal_pain: {
    emergent: ['Ruptured AAA','Mesenteric ischemia','Perforated viscus','Ectopic pregnancy rupture','Splenic rupture'],
    urgent: ['Appendicitis','Cholecystitis','Pancreatitis','SBO','Diverticulitis','Volvulus','Incarcerated hernia','Cholangitis','Ruptured ovarian cyst'],
    common: ['Gastritis','GERD','Constipation','UTI','IBS','Gastroenteritis','Nephrolithiasis','PUD','Dysmenorrhea'],
  },
  headache: {
    emergent: ['SAH','Meningitis','Intracerebral hemorrhage','Cerebral venous thrombosis','Hypertensive emergency','Temporal arteritis'],
    urgent: ['Subdural hematoma','Brain abscess','Tumor','Idiopathic intracranial hypertension','Acute angle-closure glaucoma'],
    common: ['Tension headache','Migraine','Cluster headache','Sinusitis','Medication overuse','Cervicogenic'],
  },
  syncope: {
    emergent: ['Cardiac arrhythmia','PE','Aortic dissection','Cardiac tamponade','Tension pneumothorax','SAH'],
    urgent: ['Aortic stenosis','HOCM','Brugada','Long QT','ACS','GI bleed'],
    common: ['Vasovagal','Orthostatic hypotension','Dehydration','Medication effect','Situational','Carotid sinus hypersensitivity'],
  },
  altered_mental_status: {
    emergent: ['Hypoglycemia','Stroke','Meningitis','Intracranial hemorrhage','Status epilepticus','Opioid overdose'],
    urgent: ['Sepsis','DKA','HHS','Hyponatremia','Hepatic encephalopathy','Uremia','Thyroid storm','Adrenal crisis','Wernicke'],
    common: ['Delirium','UTI in elderly','Medication effect','Dementia exacerbation','Alcohol intoxication','Sleep deprivation','Constipation in elderly'],
  },
  fever: {
    common_sources: ['Pneumonia','UTI','Cellulitis','Intra-abdominal','Line infection','Surgical site infection','Sinusitis','Pharyngitis'],
    serious: ['Meningitis','Endocarditis','Osteomyelitis','Septic arthritis','Epidural abscess','Necrotizing fasciitis','Septic shock'],
    non_infectious: ['Drug fever','Malignancy','DVT/PE','Transfusion reaction','Autoimmune flare','Thyroid storm','Neuroleptic malignant syndrome','Serotonin syndrome','Adrenal crisis'],
  },
  back_pain: {
    emergent: ['Cauda equina syndrome','Epidural abscess','Aortic dissection','Ruptured AAA','Vertebral fracture with cord compression'],
    urgent: ['Vertebral fracture','Spinal cord compression','Discitis/osteomyelitis','Nephrolithiasis','Pyelonephritis','Epidural hematoma'],
    common: ['Mechanical back pain','Lumbar strain','Disc herniation','Sciatica','Degenerative disc disease','Spinal stenosis','Muscle spasm'],
  },
  leg_swelling: {
    emergent: ['DVT','Compartment syndrome','Necrotizing fasciitis','Phlegmasia cerulea dolens'],
    urgent: ['Cellulitis','Abscess','Fracture','Baker cyst rupture','Acute arterial occlusion'],
    common: ['CHF','CKD','Liver disease','Venous insufficiency','Lymphedema','Medication effect (CCB)','Lipedema','Dependent edema'],
  },
  gi_bleed: {
    upper: ['PUD','Esophageal varices','Mallory-Weiss','Gastritis','Esophagitis','Dieulafoy','AVM','Malignancy','Aortoenteric fistula'],
    lower: ['Diverticular bleed','AVM','Hemorrhoids','Colorectal cancer','IBD','Ischemic colitis','Radiation proctitis','Infectious colitis','Meckel diverticulum'],
  },
  acute_kidney_injury: {
    prerenal: ['Dehydration','Hemorrhage','Sepsis','CHF','Liver failure','NSAIDs','ACEi/ARB','Renal artery stenosis'],
    intrinsic: ['ATN','AIN','Glomerulonephritis','HUS/TTP','Rhabdomyolysis','Contrast nephropathy','Cast nephropathy','Vasculitis'],
    postrenal: ['BPH','Stones','Tumor','Stricture','Neurogenic bladder','Blood clot retention'],
  },
};

// ═══════════════════════════════════════════════════════════════════
// CLINICAL DECISION RULES — when to apply which score
// ═══════════════════════════════════════════════════════════════════

export const DECISION_RULES = {
  'Wells PE': {
    when: 'Suspected pulmonary embolism',
    criteria: ['Clinical signs DVT +3','PE most likely diagnosis +3','HR >100 +1.5','Immobilization/surgery +1.5','Previous DVT/PE +1.5','Hemoptysis +1','Malignancy +1'],
    interpretation: ['<2: Low probability','2-6: Moderate probability','>6: High probability','<4 with negative D-dimer: PE excluded'],
  },
  'PERC Rule': {
    when: 'Low clinical probability PE — can we skip D-dimer?',
    criteria: ['Age <50','HR <100','SpO2 >94%','No unilateral leg swelling','No hemoptysis','No surgery/trauma in 4 weeks','No prior DVT/PE','No estrogen use'],
    interpretation: ['All 8 negative: PE effectively excluded without D-dimer'],
  },
  'HEART Score': {
    when: 'Chest pain — risk stratify for ACS',
    criteria: ['History: highly suspicious +2, moderately +1','ECG: significant ST deviation +2, nonspecific +1','Age: >65 +2, 45-65 +1','Risk factors: >=3 or known CAD +2, 1-2 +1','Troponin: >3x normal +2, 1-3x +1'],
    interpretation: ['0-3: Low risk, consider discharge','4-6: Moderate risk, observe/admit','7-10: High risk, admit/intervene'],
  },
  'CHA2DS2-VASc': {
    when: 'Atrial fibrillation — need for anticoagulation',
    criteria: ['CHF +1','Hypertension +1','Age >=75 +2','Diabetes +1','Stroke/TIA/TE +2','Vascular disease +1','Age 65-74 +1','Sex (female) +1'],
    interpretation: ['0 (male) or 1 (female): No anticoagulation','1 (male) or 2 (female): Consider anticoagulation','>=2 (male) or >=3 (female): Anticoagulate'],
  },
  'HAS-BLED': {
    when: 'Atrial fibrillation on anticoagulation — bleeding risk',
    criteria: ['Hypertension +1','Abnormal renal/liver +1 each','Stroke +1','Bleeding history +1','Labile INR +1','Elderly >65 +1','Drugs/alcohol +1 each'],
    interpretation: ['>=3: High bleeding risk — not a contraindication but closer monitoring needed'],
  },
  'CURB-65': {
    when: 'Community acquired pneumonia — disposition',
    criteria: ['Confusion +1','Urea >7 (BUN>19) +1','RR >=30 +1','BP systolic <90 or diastolic <=60 +1','Age >=65 +1'],
    interpretation: ['0-1: Outpatient','2: Consider admission','3-5: Admit, consider ICU if 4-5'],
  },
  'ABCD2': {
    when: 'TIA — risk of stroke in 2 days',
    criteria: ['Age >=60 +1','BP >=140/90 +1','Clinical: unilateral weakness +2, speech without weakness +1','Duration >=60min +2, 10-59min +1','Diabetes +1'],
    interpretation: ['0-3: Low risk (1%)','4-5: Moderate risk (4%)','6-7: High risk (8%)'],
  },
  'Glasgow-Blatchford': {
    when: 'Upper GI bleed — need for intervention',
    criteria: ['BUN elevated +1-6','Hemoglobin low +1-6','SBP low +1-3','Pulse >=100 +1','Melena +1','Syncope +2','Hepatic disease +2','Cardiac failure +2'],
    interpretation: ['0: Very low risk, consider outpatient','>=1: Admit for endoscopy'],
  },
  'MELD': {
    when: 'Chronic liver disease — severity/transplant listing',
    criteria: ['Bilirubin','INR','Creatinine','Sodium (MELD-Na)','Dialysis within last week'],
    interpretation: ['<10: Low mortality','10-19: Moderate','20-29: High','>=30: Very high mortality'],
  },
  'Child-Pugh': {
    when: 'Cirrhosis — severity classification',
    criteria: ['Bilirubin: <2=1, 2-3=2, >3=3','Albumin: >3.5=1, 2.8-3.5=2, <2.8=3','INR: <1.7=1, 1.7-2.3=2, >2.3=3','Ascites: none=1, mild=2, moderate/severe=3','Encephalopathy: none=1, grade 1-2=2, grade 3-4=3'],
    interpretation: ['Class A (5-6): Well-compensated','Class B (7-9): Significant compromise','Class C (10-15): Decompensated'],
  },
  'Ottawa Ankle': {
    when: 'Ankle injury — need for X-ray',
    criteria: ['Bone tenderness posterior edge distal 6cm lateral malleolus','Bone tenderness posterior edge distal 6cm medial malleolus','Inability to weight bear 4 steps immediately and in ED'],
    interpretation: ['Any positive: X-ray indicated','All negative: X-ray not needed (sensitivity ~98%)'],
  },
  'Canadian C-Spine': {
    when: 'Trauma — need for C-spine imaging',
    criteria: ['High risk: age>=65, dangerous mechanism, paresthesias','Low risk: simple rear-end MVC, sitting in ED, ambulatory, delayed onset neck pain, no midline tenderness','Able to actively rotate neck 45° L and R'],
    interpretation: ['Any high risk factor: Image','All low risk + able to rotate: No imaging needed'],
  },
  'Centor/McIsaac': {
    when: 'Sore throat — bacterial vs viral, need for antibiotics',
    criteria: ['Tonsillar exudates +1','Tender anterior cervical lymphadenopathy +1','Fever >38°C +1','Absence of cough +1','Age 3-14 +1, 15-44 0, >=45 -1'],
    interpretation: ['0-1: No testing or antibiotics','2-3: Rapid strep test','4-5: Empiric antibiotics or test'],
  },
};

// ═══════════════════════════════════════════════════════════════════
// ADMISSION / DISCHARGE / ESCALATION CRITERIA
// ═══════════════════════════════════════════════════════════════════

export const DISPOSITION_CRITERIA = {
  icu_admission: [
    'Mechanical ventilation required','Intubated',
    'Vasopressor support','Hemodynamic instability requiring pressors',
    'GCS <=8','Decreasing GCS','Status epilepticus',
    'STEMI for PCI','Massive PE','Aortic dissection',
    'Active GI hemorrhage with instability',
    'DKA with pH <7.1','Severe metabolic acidosis',
    'Acute liver failure','Fulminant hepatic failure',
    'Post-cardiac arrest','TTM protocol',
    'Severe sepsis/septic shock not responding to floor care',
    'Respiratory failure requiring BiPAP/HFNC with escalating requirements',
    'Continuous infusion of high-risk medication',
    'Post-operative high-risk surgery',
    'Acute coronary syndrome with ongoing ischemia',
    'Massive transfusion protocol activated',
    'Burns >20% TBSA or airway involvement',
    'Polytrauma with ISS >15',
    'Cervical spinal cord injury',
    'Organ donor management',
  ],
  ward_admission: [
    'Requires IV antibiotics','IV medications needed',
    'Acute medical condition requiring monitoring',
    'Surgical condition requiring operation',
    'Unable to maintain PO intake','Dehydration requiring IV fluids',
    'New oxygen requirement','Hypoxia on room air',
    'Acute pain requiring parenteral analgesia',
    'Fall with injury requiring observation',
    'New neurological deficit requiring workup',
    'Social admission — unsafe for discharge',
    'Observation for suspected ACS (serial troponins)',
    'Observation for head injury',
    'Blood transfusion required',
    'Acute psychiatric condition',
    'New-onset atrial fibrillation requiring rate/rhythm control',
    'AECOPD not responding to ED treatment',
    'Pneumonia with CURB-65 >=2',
    'Cellulitis requiring IV antibiotics',
    'GI bleed stable but requiring endoscopy',
    'AKI requiring monitoring',
    'Electrolyte derangement requiring correction',
    'DVT requiring anticoagulation initiation',
  ],
  discharge_criteria: [
    'Medically stable','Afebrile >24 hours',
    'Tolerating PO diet','Adequate PO intake',
    'Pain controlled on oral medications',
    'Ambulatory at baseline','Functional at baseline',
    'Safe environment for discharge','Support at home',
    'Follow-up arranged','PCP follow-up within 1 week',
    'Discharge medications reconciled','Patient educated',
    'Wound care plan established',
    'Home services arranged if needed',
    'Equipment ordered if needed',
    'No pending critical results',
    'Oxygen requirement stable or weaned to baseline',
    'Electrolytes stable','Renal function stable or improving',
    'Mental status at baseline',
    'Safe for oral anticoagulation',
    'Blood glucose controlled',
    'No active bleeding',
    'Infection improving on oral antibiotics',
    'Transportation arranged',
    'Caregiver available if needed',
    'Understands return precautions',
    'Capacity to manage medications',
  ],
  escalation_triggers: [
    'NEWS >=7 or any parameter scoring 3',
    'HR <40 or >130','SBP <90','RR <8 or >25',
    'SpO2 <92% despite O2','New O2 requirement',
    'GCS drop >=2 points','New confusion',
    'Urine output <0.5 mL/kg/hr for 2 hours',
    'New or worsening chest pain',
    'Nurse concerned about patient',
    'Repeated calls to floor for same issue',
    'Lactate >4','New metabolic acidosis',
    'Hemodynamic instability','Hypotension not responding to fluids',
    'New arrhythmia','New atrial fibrillation with RVR',
    'Seizure','Respiratory distress',
    'Massive hematemesis or hematochezia',
    'Anaphylaxis','Stridor',
    'Acute neurological change','New focal deficit',
    'Post-procedure complication',
    'Sepsis not responding to antibiotics/fluids',
    'Blood sugar <40 or >500',
    'Temperature >40°C or <35°C',
    'Acute desaturation event',
    'Fall with head injury',
    'Chest tube malfunction',
    'ETT displacement/obstruction',
    'Central line complication',
  ],
};

// ═══════════════════════════════════════════════════════════════════
// COMMON ORDER SETS — what gets ordered together
// ═══════════════════════════════════════════════════════════════════

export const ORDER_SETS = {
  'Sepsis Bundle': [
    'Blood cultures x2 before antibiotics',
    'Serum lactate',
    'Broad-spectrum antibiotics within 1 hour',
    'NS 30mL/kg IV bolus for hypotension or lactate >=4',
    'Vasopressors if MAP <65 after fluid resuscitation',
    'Repeat lactate if initial >2',
    'CBC, BMP, LFTs, coagulation, procalcitonin',
    'UA and urine culture',
    'CXR',
    'Source-specific cultures as indicated',
  ],
  'ACS/Chest Pain': [
    'Serial troponins (0, 3, 6 hours)',
    'ECG on arrival and with any symptom change',
    'Continuous telemetry',
    'Aspirin 325mg PO (if not already given)',
    'Heparin or enoxaparin',
    'Nitroglycerin SL PRN chest pain',
    'Morphine IV PRN severe pain',
    'CBC, BMP, coagulation',
    'CXR portable',
    'Cardiology consult if troponin positive',
    'NPO if PCI likely',
    'Beta-blocker if no contraindication',
    'Statin high-intensity',
  ],
  'DKA Protocol': [
    'NS 1L bolus then 250-500mL/hr',
    'Insulin drip 0.1 units/kg/hr (after K confirmed >3.3)',
    'Potassium replacement protocol',
    'BMP q2h until gap closed',
    'Hourly blood glucose',
    'Hourly I&O',
    'Bicarbonate if pH <6.9',
    'Phosphate if <1.0',
    'Continuous telemetry',
    'Transition to subQ insulin when eating, gap closed, pH >7.3',
    'Overlap subQ and drip by 2 hours',
  ],
  'Stroke Alert': [
    'CT head STAT without contrast',
    'Blood glucose STAT',
    'CBC, BMP, coagulation, troponin',
    'ECG',
    'NIHSS assessment',
    'Neurology consult',
    'tPA if eligible (within 4.5 hours, no contraindications)',
    'BP management per protocol',
    'Swallow evaluation before PO',
    'CT angiography head and neck',
    'MRI brain if diagnosis uncertain',
    'Aspirin 325mg if not tPA candidate',
    'Continuous monitoring',
    'Strict I&O',
    'HOB 0-30 degrees',
    'Glucose monitoring q6h',
    'DVT prophylaxis (mechanical initially)',
  ],
  'GI Bleed': [
    'NPO','2 large bore IVs (18G or larger)',
    'Type and screen/crossmatch','CBC, BMP, coagulation, LFTs',
    'Transfuse if Hgb <7 (or <8 if cardiac history)',
    'PPI drip: pantoprazole 80mg IV bolus then 8mg/hr',
    'Octreotide if variceal bleed suspected',
    'GI consult for endoscopy',
    'Erythromycin 250mg IV (gastric emptying pre-EGD)',
    'Foley catheter for strict I&O',
    'Continuous monitoring',
    'Massive transfusion protocol if needed',
    'Correct coagulopathy',
    'Hold anticoagulants and antiplatelets',
  ],
  'Alcohol Withdrawal': [
    'CIWA protocol with diazepam or lorazepam',
    'CIWA q1h until score <10 for 24h, then q4h',
    'Thiamine 500mg IV x3 days, then 100mg PO',
    'Folate 1mg PO daily',
    'Multivitamin daily',
    'Banana bag (if indicated)',
    'Magnesium sulfate 2g IV',
    'BMP, Mg, Phos, LFTs, CBC',
    'Continuous telemetry',
    'Seizure precautions',
    'Fall precautions',
    'NPO if actively seizing or severely altered',
    'Consult addiction medicine/psychiatry',
  ],
  'DVT/PE': [
    'Anticoagulation: heparin drip or enoxaparin',
    'CBC, BMP, coagulation baseline',
    'CTPA if PE suspected',
    'US doppler LE if DVT suspected',
    'ECG and troponin',
    'BNP if RV strain',
    'Echo if massive/submassive PE',
    'Thrombolysis if massive PE with hemodynamic instability',
    'IVC filter if anticoagulation contraindicated',
    'Transition to oral anticoagulant',
    'Risk factor assessment',
    'Cancer screening if unprovoked',
    'Duration of anticoagulation plan',
  ],
  'CHF Exacerbation': [
    'Furosemide IV (double home dose or 40mg if new)',
    'Daily weights','Strict I&O','Fluid restriction 1.5L',
    'Low sodium diet','BMP daily (watch K, Cr)',
    'Continuous telemetry','SpO2 monitoring',
    'BNP/NT-proBNP','Echo if no recent',
    'Oxygen to maintain SpO2 >92%',
    'ACEi/ARB if tolerated',
    'Beta-blocker (continue if on, hold if decompensated)',
    'Consider metolazone if diuretic resistant',
    'Cardiology consult if new or refractory',
    'DVT prophylaxis',
    'Assess volume status daily: JVP, edema, lungs, weight',
  ],
  'Pneumonia': [
    'Blood cultures before antibiotics (if admitted)',
    'Sputum culture if productive cough',
    'CBC, BMP, CRP/procalcitonin',
    'CXR PA and lateral',
    'Antibiotics per CURB-65/severity',
    'CAP: ceftriaxone + azithromycin OR levofloxacin',
    'HAP/VAP: piperacillin-tazobactam + vancomycin',
    'Supplemental O2 to maintain SpO2 >92%',
    'Incentive spirometry',
    'VTE prophylaxis',
    'Reassess at 48-72 hours',
    'Switch to PO when improving and tolerating PO',
    'Influenza testing if seasonal',
    'COVID testing if indicated',
    'Legionella and pneumococcal urine antigens if severe',
  ],
};

// ═══════════════════════════════════════════════════════════════════
// CLINICAL PEARLS — subtle patterns the engine should recognize
// ═══════════════════════════════════════════════════════════════════

export const CLINICAL_ASSOCIATIONS = [
  // Drug → common ADR to watch for
  { trigger: 'started vancomycin', watch: ['Trough level','Red man syndrome','AKI','Ototoxicity'] },
  { trigger: 'on heparin drip', watch: ['aPTT q6h','Platelet count daily','HIT (day 5-10)','Bleeding'] },
  { trigger: 'on warfarin', watch: ['INR','Bleeding','Drug interactions','Diet changes'] },
  { trigger: 'started ACEi', watch: ['Cr in 1 week','K in 1 week','Cough','Angioedema'] },
  { trigger: 'on metformin', watch: ['Hold if contrast','Hold if eGFR <30','Lactic acidosis if acutely ill'] },
  { trigger: 'on insulin drip', watch: ['Hourly glucose','K q2-4h','Transition plan'] },
  { trigger: 'on TPN', watch: ['Daily glucose','Weekly LFTs','Electrolytes daily','Line infection'] },
  { trigger: 'on steroids', watch: ['Blood glucose','Mood changes','Insomnia','GI prophylaxis','Adrenal suppression if >7 days'] },
  { trigger: 'post-tPA', watch: ['Neuro checks q15min x2h','BP <180/105','No antiplatelets/anticoagulants x24h','Bleeding'] },
  { trigger: 'new tracheostomy', watch: ['Cuff pressure','Suctioning','Stay sutures','First change day 7-10','Emergency equipment at bedside'] },
  { trigger: 'post-thoracentesis', watch: ['CXR post-procedure','Re-expansion pulmonary edema','Pneumothorax','Output amount'] },
  { trigger: 'on CRRT', watch: ['Electrolytes q6h','Ionized calcium','Citrate if regional anticoagulation','Filter life','Access function'] },
  { trigger: 'blood transfusion', watch: ['Vitals q15min first unit','Transfusion reaction','TACO','TRALI','Febrile reaction'] },
  { trigger: 'new central line', watch: ['CXR for position','Pneumothorax','Line day','Daily necessity assessment','CLABSI bundle'] },
  { trigger: 'post-LP', watch: ['Post-LP headache','CSF leak','Epidural hematoma if coagulopathic','Results follow-up'] },
  { trigger: 'foley placed', watch: ['Daily necessity assessment','CAUTI prevention','Output monitoring','Removal criteria'] },

  // Diagnosis → anticipate complications
  { trigger: 'acute pancreatitis', watch: ['SIRS/organ failure at 48h','Necrosis on CT day 3-5','Fluid third-spacing','Hypocalcemia','Refeeding'] },
  { trigger: 'cirrhosis admitted', watch: ['SBP (ascitic tap)','Variceal bleed','HE','HRS','Electrolytes','Coagulopathy','Nutrition'] },
  { trigger: 'sickle cell crisis', watch: ['Acute chest syndrome','Splenic sequestration','Aplastic crisis','Stroke','Priapism'] },
  { trigger: 'new AF', watch: ['Rate vs rhythm control','Anticoagulation (CHA2DS2-VASc)','Thyroid function','Echo','Underlying cause'] },
  { trigger: 'suicidal ideation', watch: ['1:1 observation','Safety plan','Remove sharps/ligatures','Psychiatric consult','Capacity assessment'] },
];

export function loadClinicalReasoningSeedData(models) {
  const now = new Date().toISOString();

  // Differential diagnosis terms
  for (const [presentation, ddx] of Object.entries(DIFFERENTIAL_MAPS)) {
    for (const category of Object.values(ddx)) {
      for (const dx of category) {
        const key = dx.toLowerCase();
        if (!models.diagnoses[key]) {
          models.diagnoses[key] = { count: 2, entity: 'DIAGNOSIS', lastSeen: now, confidence: 0.72, seeded: true };
        }
      }
    }
  }

  // Decision rule terms
  for (const [ruleName, rule] of Object.entries(DECISION_RULES)) {
    const key = ruleName.toLowerCase();
    if (!models.diagnoses[key]) {
      models.diagnoses[key] = { count: 2, entity: 'DECISION_RULE', lastSeen: now, confidence: 0.78, seeded: true };
    }
    for (const criterion of (rule.criteria || [])) {
      const ck = criterion.toLowerCase().replace(/\+\d+/g, '').trim();
      if (ck.length >= 3 && !models.diagnoses[ck]) {
        models.diagnoses[ck] = { count: 1, entity: 'CLINICAL_CRITERION', lastSeen: now, confidence: 0.55, seeded: true };
      }
    }
  }

  // Disposition criteria
  for (const criteria of Object.values(DISPOSITION_CRITERIA)) {
    for (const criterion of criteria) {
      const key = criterion.toLowerCase();
      if (key.length >= 3 && !models.diagnoses[key]) {
        models.diagnoses[key] = { count: 1, entity: 'DISPOSITION', lastSeen: now, confidence: 0.58, seeded: true };
      }
    }
  }

  // Order set terms
  for (const orders of Object.values(ORDER_SETS)) {
    for (const order of orders) {
      const key = order.toLowerCase();
      if (key.length >= 3 && !models.diagnoses[key]) {
        models.diagnoses[key] = { count: 1, entity: 'ORDER', lastSeen: now, confidence: 0.55, seeded: true };
      }
    }
  }

  // Clinical association terms
  for (const assoc of CLINICAL_ASSOCIATIONS) {
    const trigKey = assoc.trigger.toLowerCase();
    if (!models.diagnoses[trigKey]) {
      models.diagnoses[trigKey] = { count: 1, entity: 'CLINICAL_TRIGGER', lastSeen: now, confidence: 0.60, seeded: true };
    }
    for (const watch of assoc.watch) {
      const wk = watch.toLowerCase();
      if (wk.length >= 3 && !models.diagnoses[wk]) {
        models.diagnoses[wk] = { count: 1, entity: 'CLINICAL_WATCH', lastSeen: now, confidence: 0.55, seeded: true };
      }
    }
  }

  models.clinicalReasoningSeeded = true;
  return models;
}
