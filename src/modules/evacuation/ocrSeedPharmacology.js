// OCR Seed — Deep Pharmacology Intelligence
// Drug classes, mechanisms, interactions, contraindications, dosing rules,
// IV compatibility, high-alert medications, look-alike/sound-alike,
// pregnancy categories, renal/hepatic dosing adjustments

export const DRUG_CLASSES = {
  // Each class: drugs in it, what it treats, key side effects
  'ACE Inhibitors': {
    drugs: ['Lisinopril','Enalapril','Ramipril','Captopril','Perindopril','Trandolapril','Benazepril','Fosinopril','Quinapril'],
    treats: ['HTN','CHF','Diabetic nephropathy','Post-MI','CKD'],
    sideEffects: ['Dry cough','Hyperkalemia','Angioedema','AKI','Hypotension'],
    contraindications: ['Pregnancy','Bilateral RAS','Angioedema history','K>5.5'],
  },
  'ARBs': {
    drugs: ['Losartan','Valsartan','Irbesartan','Telmisartan','Candesartan','Olmesartan','Azilsartan'],
    treats: ['HTN','CHF','Diabetic nephropathy','ACEi intolerance'],
    sideEffects: ['Hyperkalemia','AKI','Hypotension','Dizziness'],
    contraindications: ['Pregnancy','Bilateral RAS','K>5.5'],
  },
  'Beta Blockers': {
    drugs: ['Metoprolol','Atenolol','Carvedilol','Bisoprolol','Propranolol','Labetalol','Nebivolol','Esmolol','Sotalol','Nadolol'],
    treats: ['HTN','CHF','AF','Post-MI','Angina','Migraine','Tremor','Thyrotoxicosis'],
    sideEffects: ['Bradycardia','Hypotension','Fatigue','Bronchospasm','Masking hypoglycemia'],
    contraindications: ['Severe bradycardia','Decompensated HF','Severe asthma','2nd/3rd degree AV block'],
  },
  'Calcium Channel Blockers': {
    drugs: ['Amlodipine','Nifedipine','Felodipine','Diltiazem','Verapamil','Nicardipine','Clevidipine'],
    treats: ['HTN','Angina','AF','SVT','Raynaud','Migraine'],
    sideEffects: ['Peripheral edema','Constipation','Bradycardia','Flushing','Headache'],
  },
  'Diuretics - Loop': {
    drugs: ['Furosemide','Bumetanide','Torsemide','Ethacrynic acid'],
    treats: ['CHF','Pulmonary edema','Fluid overload','CKD','Nephrotic syndrome','Ascites'],
    sideEffects: ['Hypokalemia','Hyponatremia','Hypomagnesemia','Ototoxicity','Dehydration','AKI','Gout'],
  },
  'Diuretics - Thiazide': {
    drugs: ['Hydrochlorothiazide','HCTZ','Chlorthalidone','Indapamide','Metolazone'],
    treats: ['HTN','CHF','Edema','Nephrolithiasis','Diabetes insipidus'],
    sideEffects: ['Hypokalemia','Hyponatremia','Hyperuricemia','Hyperglycemia','Hypercalcemia'],
  },
  'Diuretics - Potassium Sparing': {
    drugs: ['Spironolactone','Eplerenone','Amiloride','Triamterene'],
    treats: ['CHF','Ascites','Hyperaldosteronism','Hypokalemia'],
    sideEffects: ['Hyperkalemia','Gynecomastia','Breast tenderness','AKI'],
  },
  'Statins': {
    drugs: ['Atorvastatin','Rosuvastatin','Simvastatin','Pravastatin','Fluvastatin','Pitavastatin','Lovastatin'],
    treats: ['Hyperlipidemia','CAD prevention','Stroke prevention','ACS'],
    sideEffects: ['Myalgia','Rhabdomyolysis','Elevated LFTs','Diabetes risk'],
  },
  'Anticoagulants - Heparins': {
    drugs: ['Unfractionated heparin','UFH','Enoxaparin','Dalteparin','Tinzaparin','Fondaparinux'],
    treats: ['DVT','PE','ACS','AF','Mechanical valve','VTE prophylaxis'],
    sideEffects: ['Bleeding','HIT','Osteoporosis','Hyperkalemia'],
    monitoring: ['aPTT','Anti-Xa','Platelet count','Signs of bleeding'],
  },
  'DOACs': {
    drugs: ['Apixaban','Rivaroxaban','Edoxaban','Dabigatran'],
    treats: ['AF','DVT','PE','VTE prophylaxis'],
    sideEffects: ['Bleeding','GI upset'],
    contraindications: ['Mechanical valve','Severe CKD','Active bleeding','Antiphospholipid syndrome'],
  },
  'Antiplatelets': {
    drugs: ['Aspirin','Clopidogrel','Prasugrel','Ticagrelor','Cangrelor','Dipyridamole','Cilostazol'],
    treats: ['ACS','Post-PCI','Post-CABG','Stroke prevention','PAD'],
    sideEffects: ['Bleeding','GI ulceration','Dyspnea (Ticagrelor)','Headache'],
  },
  'Insulins': {
    drugs: ['Insulin Aspart','Insulin Lispro','Insulin Glulisine','Regular Insulin','Insulin Glargine','Insulin Detemir','Insulin Degludec','NPH','Premixed 70/30'],
    treats: ['T1DM','T2DM','DKA','HHS','Hyperkalemia','Gestational DM'],
    sideEffects: ['Hypoglycemia','Weight gain','Lipodystrophy','Hypokalemia'],
  },
  'Oral Hypoglycemics': {
    drugs: ['Metformin','Glimepiride','Glipizide','Glyburide','Sitagliptin','Linagliptin','Saxagliptin','Pioglitazone','Acarbose'],
    treats: ['T2DM','Pre-diabetes','PCOS (metformin)'],
    sideEffects: ['GI upset','Hypoglycemia (SU)','Lactic acidosis (metformin)','Weight gain'],
  },
  'SGLT2 Inhibitors': {
    drugs: ['Empagliflozin','Dapagliflozin','Canagliflozin','Ertugliflozin'],
    treats: ['T2DM','CHF','CKD'],
    sideEffects: ['UTI','Genital mycosis','DKA (euglycemic)','Volume depletion','Fournier gangrene'],
  },
  'GLP-1 Agonists': {
    drugs: ['Semaglutide','Liraglutide','Dulaglutide','Exenatide','Tirzepatide'],
    treats: ['T2DM','Obesity','Weight management'],
    sideEffects: ['Nausea','Vomiting','Pancreatitis risk','Thyroid C-cell tumors'],
  },
  'PPIs': {
    drugs: ['Omeprazole','Esomeprazole','Pantoprazole','Lansoprazole','Rabeprazole','Dexlansoprazole'],
    treats: ['GERD','PUD','GI bleed','H. pylori','Stress ulcer prophylaxis','Zollinger-Ellison'],
    sideEffects: ['C. diff risk','Hypomagnesemia','B12 deficiency','Osteoporosis','AIN'],
  },
  'Opioids': {
    drugs: ['Morphine','Fentanyl','Hydromorphone','Oxycodone','Hydrocodone','Codeine','Tramadol','Meperidine','Methadone','Buprenorphine'],
    treats: ['Severe pain','Post-operative pain','Cancer pain','Palliative care'],
    sideEffects: ['Respiratory depression','Sedation','Constipation','Nausea','Pruritus','Dependence','Urinary retention'],
    monitoring: ['Pain score','Sedation','Respiratory rate','Bowel function'],
  },
  'Benzodiazepines': {
    drugs: ['Midazolam','Lorazepam','Diazepam','Alprazolam','Clonazepam','Chlordiazepoxide','Clorazepate','Oxazepam','Temazepam'],
    treats: ['Anxiety','Seizures','Alcohol withdrawal','Insomnia','Procedural sedation','Status epilepticus'],
    sideEffects: ['Sedation','Respiratory depression','Dependence','Paradoxical agitation','Falls'],
  },
  'Antiepileptics': {
    drugs: ['Levetiracetam','Phenytoin','Carbamazepine','Valproic acid','Lamotrigine','Topiramate','Lacosamide','Gabapentin','Pregabalin','Oxcarbazepine','Zonisamide','Brivaracetam','Clobazam','Perampanel'],
    treats: ['Epilepsy','Seizures','Neuropathic pain','Migraine','Bipolar','Status epilepticus'],
    sideEffects: ['Sedation','Dizziness','Ataxia','Rash (SJS)','Hepatotoxicity','Teratogenicity'],
  },
  'Cephalosporins': {
    drugs: ['Cefazolin','Cephalexin','Cefuroxime','Cefoxitin','Ceftriaxone','Cefotaxime','Ceftazidime','Cefepime','Ceftaroline','Ceftolozane-tazobactam','Ceftazidime-avibactam','Cefiderocol'],
    treats: ['Cellulitis','UTI','Pneumonia','Meningitis','Surgical prophylaxis','Sepsis'],
    sideEffects: ['Allergy','C. diff','Biliary sludge (ceftriaxone)','Seizures (high dose)'],
    generations: ['1st gen: cefazolin, cephalexin','2nd gen: cefuroxime, cefoxitin','3rd gen: ceftriaxone, ceftazidime','4th gen: cefepime','5th gen: ceftaroline'],
  },
  'Carbapenems': {
    drugs: ['Meropenem','Imipenem-cilastatin','Ertapenem','Doripenem'],
    treats: ['Severe/MDR infections','Sepsis','Meningitis','Intra-abdominal','Hospital-acquired pneumonia'],
    sideEffects: ['Seizures (imipenem)','C. diff','Allergy','Resistance selection'],
  },
  'Fluoroquinolones': {
    drugs: ['Ciprofloxacin','Levofloxacin','Moxifloxacin','Ofloxacin','Norfloxacin','Delafloxacin'],
    treats: ['UTI','Pneumonia','Sinusitis','Intra-abdominal','Bone/joint infection'],
    sideEffects: ['Tendon rupture','QT prolongation','C. diff','Aortic dissection','Peripheral neuropathy','Dysglycemia'],
    blackBoxWarning: ['Tendinitis','Tendon rupture','Peripheral neuropathy','CNS effects','Myasthenia gravis exacerbation'],
  },
  'Vasopressors': {
    drugs: ['Norepinephrine','Epinephrine','Vasopressin','Phenylephrine','Dopamine','Dobutamine','Milrinone'],
    treats: ['Septic shock','Cardiogenic shock','Anaphylaxis','Cardiac arrest','Distributive shock'],
    sideEffects: ['Tachycardia','Arrhythmia','Peripheral ischemia','Digital necrosis','Extravasation injury'],
    monitoring: ['MAP','HR','UOP','Lactate','Peripheral perfusion','Extravasation'],
  },
  'Antiemetics': {
    drugs: ['Ondansetron','Metoclopramide','Prochlorperazine','Promethazine','Domperidone','Granisetron','Palonosetron','Aprepitant','Dexamethasone','Scopolamine','Dimenhydrinate','Cyclizine'],
    treats: ['Nausea','Vomiting','PONV','Chemotherapy-induced','Gastroparesis','Motion sickness'],
    sideEffects: ['QT prolongation (ondansetron)','EPS (metoclopramide)','Sedation','Constipation','Headache'],
  },
  'Corticosteroids': {
    drugs: ['Dexamethasone','Methylprednisolone','Prednisolone','Prednisone','Hydrocortisone','Betamethasone','Budesonide','Fludrocortisone','Triamcinolone'],
    treats: ['Inflammation','Autoimmune','Asthma','COPD','Allergic reaction','Adrenal insufficiency','Cerebral edema','Croup','Spinal cord injury'],
    sideEffects: ['Hyperglycemia','Immunosuppression','Osteoporosis','Adrenal suppression','Weight gain','Mood changes','GI bleed','Insomnia','Myopathy'],
  },
};

export const HIGH_ALERT_MEDICATIONS = [
  'Insulin','Heparin','Warfarin','Opioids','Neuromuscular blocking agents',
  'Chemotherapy','Concentrated electrolytes','Potassium chloride',
  'Magnesium sulfate','Sodium chloride >0.9%','Hypertonic saline',
  'Epinephrine','Norepinephrine','Vasopressin','Nitroprusside',
  'Methotrexate','Colchicine','Digoxin','Amiodarone',
  'Propofol','Ketamine','Succinylcholine','Rocuronium',
  'Alteplase','Tenecteplase','Streptokinase',
  'Oxytocin','Magnesium sulfate (OB)',
  'Promethazine IV','Vincristine (NEVER intrathecal)',
  'Intrathecal medications','Epidural medications',
  'Total parenteral nutrition','TPN',
  'Dialysis solutions','Cardioplegia solutions',
  'Radiocontrast agents',
];

export const LOOK_ALIKE_SOUND_ALIKE = [
  ['Hydroxyzine','Hydralazine'],
  ['Celebrex','Celexa','Cerebyx'],
  ['Clonidine','Klonopin','Clonazepam'],
  ['Daunorubicin','Doxorubicin'],
  ['Epinephrine','Ephedrine'],
  ['Fentanyl','Sufentanil'],
  ['Glipizide','Glyburide'],
  ['Humalog','Humulin'],
  ['Insulin Aspart','Insulin Regular'],
  ['Lamictal','Lamisil','Lomotil'],
  ['Metformin','Metronidazole'],
  ['Morphine','Hydromorphone'],
  ['NovoLog','Novolin'],
  ['Oxycodone','OxyContin','Oxybutynin'],
  ['Prednisone','Prednisolone','Methylprednisolone'],
  ['Propranolol','Propofol'],
  ['Risperidone','Ropinirole'],
  ['Sertraline','Cetirizine'],
  ['Tramadol','Trazodone','Toradol'],
  ['Vancomycin','Vecuronium'],
  ['Vincristine','Vinblastine'],
  ['Zantac','Zyrtec','Zyprexa','Zofran'],
  ['Losartan','Lorazepam'],
  ['Furosemide','Torsemide'],
  ['Atenolol','Albuterol'],
  ['Metoprolol tartrate','Metoprolol succinate'],
  ['Insulin Glargine','Insulin Detemir'],
];

export const DRUG_INTERACTIONS_CRITICAL = [
  { drugs: ['Warfarin','NSAID'], risk: 'Major bleeding', severity: 'critical' },
  { drugs: ['Warfarin','Fluconazole'], risk: 'Elevated INR, bleeding', severity: 'critical' },
  { drugs: ['ACEi','K-sparing diuretic'], risk: 'Hyperkalemia', severity: 'major' },
  { drugs: ['ACEi','ARB'], risk: 'Hyperkalemia, AKI', severity: 'critical' },
  { drugs: ['Metformin','Contrast'], risk: 'Lactic acidosis', severity: 'major' },
  { drugs: ['SSRI','MAOi'], risk: 'Serotonin syndrome', severity: 'critical' },
  { drugs: ['SSRI','Tramadol'], risk: 'Serotonin syndrome', severity: 'major' },
  { drugs: ['Simvastatin','Amiodarone'], risk: 'Rhabdomyolysis', severity: 'major' },
  { drugs: ['Digoxin','Amiodarone'], risk: 'Digoxin toxicity', severity: 'major' },
  { drugs: ['QT-prolonging agents','QT-prolonging agents'], risk: 'Torsades de Pointes', severity: 'critical' },
  { drugs: ['Potassium','ACEi'], risk: 'Hyperkalemia', severity: 'major' },
  { drugs: ['Lithium','NSAID'], risk: 'Lithium toxicity', severity: 'major' },
  { drugs: ['Lithium','ACEi'], risk: 'Lithium toxicity', severity: 'major' },
  { drugs: ['Carbamazepine','Erythromycin'], risk: 'Carbamazepine toxicity', severity: 'major' },
  { drugs: ['Clopidogrel','PPI'], risk: 'Reduced antiplatelet effect', severity: 'moderate' },
  { drugs: ['Fluoroquinolone','Corticosteroid'], risk: 'Tendon rupture', severity: 'major' },
  { drugs: ['Methotrexate','TMP-SMX'], risk: 'Pancytopenia', severity: 'critical' },
  { drugs: ['Azathioprine','Allopurinol'], risk: 'Myelosuppression', severity: 'critical' },
  { drugs: ['Clozapine','Carbamazepine'], risk: 'Agranulocytosis', severity: 'critical' },
  { drugs: ['Ergotamine','Macrolide'], risk: 'Ergotism/vasospasm', severity: 'critical' },
];

export const RENAL_DOSE_ADJUSTMENTS = {
  'Enoxaparin': 'CrCl <30: reduce to 1mg/kg daily (not BID)',
  'Metformin': 'eGFR <30: contraindicated. eGFR 30-45: reduce dose. eGFR >45: OK',
  'Gabapentin': 'CrCl 30-59: max 300mg TID. CrCl 15-29: max 300mg daily. CrCl <15: max 300mg QOD',
  'Vancomycin': 'Monitor trough. AUC/MIC-based dosing. Adjust for CrCl',
  'Meropenem': 'CrCl 26-50: q12h. CrCl 10-25: half dose q12h. CrCl <10: half dose q24h',
  'Levofloxacin': 'CrCl 20-49: 250-500mg q24h. CrCl <20: 250-500mg q48h',
  'Acyclovir': 'CrCl 25-50: q12h. CrCl 10-25: q24h. CrCl <10: half dose q24h',
  'Digoxin': 'Reduce dose 50% if CrCl <50. Monitor level',
  'Allopurinol': 'CrCl <20: max 100mg/day',
  'Colchicine': 'CrCl <30: reduce dose. Dialysis: avoid',
  'Dabigatran': 'CrCl 30-50: 150mg BID. CrCl 15-30: 75mg BID. CrCl <15: avoid',
  'Apixaban': 'Cr >1.5 + age >80 or wt <60: 2.5mg BID. Dialysis: 5mg BID (per trial)',
  'DOACs': 'Avoid all DOACs if CrCl <15 (except apixaban per trial)',
  'Morphine': 'CrCl <30: reduce dose 50%, extend interval. Active metabolites accumulate',
  'Codeine': 'CrCl <30: avoid. Active metabolite M6G accumulates',
  'Pregabalin': 'CrCl 30-60: reduce 50%. CrCl 15-30: reduce 75%. CrCl <15: reduce further',
  'TMP-SMX': 'CrCl 15-30: half dose. CrCl <15: avoid',
  'Nitrofurantoin': 'CrCl <30: avoid (ineffective and toxic)',
  'Spironolactone': 'CrCl <30: use with extreme caution, risk of hyperkalemia',
};

export const HEPATIC_DOSE_ADJUSTMENTS = {
  'Acetaminophen': 'Max 2g/day in liver disease. Avoid if acute liver failure',
  'Metformin': 'Avoid in severe hepatic impairment (lactic acidosis risk)',
  'Statins': 'Avoid in active liver disease. Check LFTs before and after starting',
  'Methotrexate': 'Contraindicated in significant hepatic impairment',
  'Azathioprine': 'Reduce dose in hepatic impairment',
  'Valproic acid': 'Contraindicated in severe hepatic disease. Hepatotoxic',
  'Rifampin': 'Monitor LFTs closely. Hepatotoxic. Avoid if pre-existing liver disease',
  'Isoniazid': 'Monitor LFTs monthly. Risk increases with age and alcohol',
  'Ketoconazole': 'Avoid in liver disease. Hepatotoxic',
  'Opioids': 'Reduce dose and extend interval. Risk of encephalopathy',
  'Benzodiazepines': 'Use short-acting (lorazepam, oxazepam). Avoid long-acting. Risk of encephalopathy',
  'Warfarin': 'Increased sensitivity. Start with lower dose. Monitor INR more frequently',
  'NSAIDs': 'Avoid in cirrhosis. Risk of GI bleed, renal failure, fluid retention',
};

export function loadPharmacologySeedData(models) {
  const now = new Date().toISOString();

  // Add all drugs from all classes
  for (const [className, classData] of Object.entries(DRUG_CLASSES)) {
    // Class name
    const classKey = className.toLowerCase();
    if (!models.medications[classKey]) {
      models.medications[classKey] = { count: 2, entity: 'DRUG_CLASS', lastSeen: now, confidence: 0.80, seeded: true };
    }
    // Individual drugs
    for (const drug of classData.drugs) {
      const key = drug.toLowerCase();
      if (!models.medications[key]) {
        models.medications[key] = { count: 3, entity: 'MEDICATION', lastSeen: now, confidence: 0.85, seeded: true, drugClass: className };
      }
    }
    // Conditions treated
    for (const condition of (classData.treats || [])) {
      const key = condition.toLowerCase();
      if (!models.diagnoses[key]) {
        models.diagnoses[key] = { count: 1, entity: 'DIAGNOSIS', lastSeen: now, confidence: 0.70, seeded: true };
      }
    }
    // Side effects
    for (const se of (classData.sideEffects || [])) {
      const key = se.toLowerCase();
      if (!models.diagnoses[key]) {
        models.diagnoses[key] = { count: 1, entity: 'SIDE_EFFECT', lastSeen: now, confidence: 0.65, seeded: true };
      }
    }
  }

  // High-alert medications
  for (const med of HIGH_ALERT_MEDICATIONS) {
    const key = med.toLowerCase();
    if (!models.medications[key]) {
      models.medications[key] = { count: 2, entity: 'HIGH_ALERT_MED', lastSeen: now, confidence: 0.90, seeded: true };
    }
  }

  // Look-alike sound-alike pairs → corrections
  for (const group of LOOK_ALIKE_SOUND_ALIKE) {
    for (const drug of group) {
      const key = drug.toLowerCase();
      if (!models.medications[key]) {
        models.medications[key] = { count: 2, entity: 'LASA_MED', lastSeen: now, confidence: 0.82, seeded: true, lasaGroup: group };
      }
    }
  }

  // Renal/hepatic adjustment terms
  const adjustmentTerms = [...Object.keys(RENAL_DOSE_ADJUSTMENTS), ...Object.keys(HEPATIC_DOSE_ADJUSTMENTS)];
  for (const term of adjustmentTerms) {
    const key = term.toLowerCase();
    if (!models.medications[key]) {
      models.medications[key] = { count: 1, entity: 'MEDICATION', lastSeen: now, confidence: 0.75, seeded: true };
    }
  }

  models.pharmacologySeeded = true;
  return models;
}
