// OCR Seed — Complete Laboratory Intelligence
// Every lab test with: full name, abbreviations, units, normal ranges,
// critical values, specimen types, interfering factors, clinical significance

export const COMPLETE_LAB_PANELS = {
  CBC: {
    fullName: 'Complete Blood Count',
    aliases: ['CBC','FBC','Full blood count','Complete blood count','Blood count','Hemogram'],
    tests: {
      'WBC': { aliases: ['White blood cell','White cell count','Leukocytes','WCC','TLC','Total leukocyte count'], unit: 'x10^9/L', normal: '4.0-11.0', critical: '<1.0 or >30.0' },
      'RBC': { aliases: ['Red blood cell','Red cell count','Erythrocytes','RCC'], unit: 'x10^12/L', normal: 'M:4.5-5.5 F:4.0-5.0' },
      'Hemoglobin': { aliases: ['Hgb','Hb','Haemoglobin','HGB'], unit: 'g/dL', normal: 'M:13.5-17.5 F:12.0-16.0', critical: '<7.0 or >20.0' },
      'Hematocrit': { aliases: ['Hct','HCT','PCV','Packed cell volume','Haematocrit'], unit: '%', normal: 'M:40-54 F:36-48' },
      'MCV': { aliases: ['Mean corpuscular volume'], unit: 'fL', normal: '80-100' },
      'MCH': { aliases: ['Mean corpuscular hemoglobin'], unit: 'pg', normal: '27-33' },
      'MCHC': { aliases: ['Mean corpuscular hemoglobin concentration'], unit: 'g/dL', normal: '32-36' },
      'RDW': { aliases: ['Red cell distribution width','RDW-CV','RDW-SD'], unit: '%', normal: '11.5-14.5' },
      'Platelets': { aliases: ['Plt','PLT','Platelet count','Thrombocytes'], unit: 'x10^9/L', normal: '150-400', critical: '<20 or >1000' },
      'MPV': { aliases: ['Mean platelet volume'], unit: 'fL', normal: '7.5-11.5' },
      'Neutrophils': { aliases: ['Neut','Neuts','ANC','Absolute neutrophil count','Polymorphs','PMN','Segs','Segmented neutrophils'], unit: 'x10^9/L', normal: '2.0-7.5' },
      'Lymphocytes': { aliases: ['Lymph','Lymphs','ALC','Absolute lymphocyte count'], unit: 'x10^9/L', normal: '1.0-4.0' },
      'Monocytes': { aliases: ['Mono','Monos','AMC'], unit: 'x10^9/L', normal: '0.2-0.8' },
      'Eosinophils': { aliases: ['Eos','Eosins','AEC'], unit: 'x10^9/L', normal: '0.0-0.5' },
      'Basophils': { aliases: ['Baso','Basos','ABC'], unit: 'x10^9/L', normal: '0.0-0.1' },
      'Bands': { aliases: ['Band neutrophils','Stabs','Immature granulocytes','IG'], unit: '%', normal: '0-5' },
      'Reticulocytes': { aliases: ['Retic','Retic count','Reticulocyte count','Reticulocyte %','Absolute retic'], unit: '%', normal: '0.5-2.5' },
    },
  },
  BMP: {
    fullName: 'Basic Metabolic Panel',
    aliases: ['BMP','Basic metabolic','Chem 7','SMA-7','U&E','Urea and electrolytes','Renal panel','Renal function'],
    tests: {
      'Sodium': { aliases: ['Na','Na+','Serum sodium'], unit: 'mmol/L', normal: '135-145', critical: '<120 or >160' },
      'Potassium': { aliases: ['K','K+','Serum potassium'], unit: 'mmol/L', normal: '3.5-5.0', critical: '<2.5 or >6.5' },
      'Chloride': { aliases: ['Cl','Cl-','Serum chloride'], unit: 'mmol/L', normal: '98-106' },
      'Bicarbonate': { aliases: ['HCO3','CO2','TCO2','Total CO2','Bicarb','Serum bicarb'], unit: 'mmol/L', normal: '22-28', critical: '<10 or >40' },
      'BUN': { aliases: ['Blood urea nitrogen','Urea','Serum urea','SUN'], unit: 'mg/dL', normal: '7-20' },
      'Creatinine': { aliases: ['Cr','Creat','Serum creatinine','SCr'], unit: 'mg/dL', normal: '0.6-1.2', critical: '>10.0' },
      'Glucose': { aliases: ['Glu','GLU','Blood sugar','BS','RBS','FBS','Fasting glucose','Random glucose','CBG','Blood glucose','BGL','Serum glucose'], unit: 'mg/dL', normal: '70-110', critical: '<40 or >500' },
      'Calcium': { aliases: ['Ca','Ca2+','Total calcium','Serum calcium'], unit: 'mg/dL', normal: '8.5-10.5', critical: '<6.0 or >13.0' },
    },
  },
  CMP: {
    fullName: 'Comprehensive Metabolic Panel',
    aliases: ['CMP','Comprehensive metabolic','Chem 14','SMA-14','Metabolic panel'],
    tests: {
      'Total Protein': { aliases: ['TP','Serum protein','Total serum protein'], unit: 'g/dL', normal: '6.0-8.0' },
      'Albumin': { aliases: ['Alb','Serum albumin'], unit: 'g/dL', normal: '3.5-5.0', critical: '<1.5' },
      'Globulin': { aliases: ['Glob','Serum globulin'], unit: 'g/dL', normal: '2.0-3.5' },
      'A/G Ratio': { aliases: ['Albumin/Globulin ratio','AG ratio'], unit: 'ratio', normal: '1.0-2.5' },
      'AST': { aliases: ['SGOT','Aspartate aminotransferase','Aspartate transaminase'], unit: 'U/L', normal: '10-40' },
      'ALT': { aliases: ['SGPT','Alanine aminotransferase','Alanine transaminase'], unit: 'U/L', normal: '7-56' },
      'ALP': { aliases: ['Alk phos','Alkaline phosphatase'], unit: 'U/L', normal: '44-147' },
      'Total Bilirubin': { aliases: ['T.Bili','TB','Total bili','Serum bilirubin'], unit: 'mg/dL', normal: '0.1-1.2', critical: '>15.0 (neonatal)' },
      'Direct Bilirubin': { aliases: ['D.Bili','DB','Conjugated bilirubin','Direct bili'], unit: 'mg/dL', normal: '0.0-0.3' },
      'GGT': { aliases: ['Gamma GT','Gamma-glutamyl transferase','GGTP'], unit: 'U/L', normal: '9-48' },
    },
  },
  COAGULATION: {
    fullName: 'Coagulation Studies',
    aliases: ['Coags','Coagulation','Clotting studies','Clotting profile'],
    tests: {
      'PT': { aliases: ['Prothrombin time','Pro time'], unit: 'seconds', normal: '11-13.5' },
      'INR': { aliases: ['International normalized ratio','International normalised ratio'], unit: 'ratio', normal: '0.9-1.1', critical: '>5.0' },
      'aPTT': { aliases: ['PTT','Partial thromboplastin time','Activated partial thromboplastin time','APTT'], unit: 'seconds', normal: '25-35', critical: '>100' },
      'Fibrinogen': { aliases: ['Factor I','Fibrinogen level'], unit: 'mg/dL', normal: '200-400', critical: '<100' },
      'D-dimer': { aliases: ['D-Dimer','FDP','Fibrin degradation products'], unit: 'ng/mL', normal: '<500' },
      'Thrombin Time': { aliases: ['TT','TCT','Thrombin clotting time'], unit: 'seconds', normal: '14-19' },
      'Anti-Xa': { aliases: ['Heparin level','Anti-factor Xa','Xa level'], unit: 'IU/mL', normal: '0.3-0.7 (therapeutic)' },
      'Bleeding Time': { aliases: ['BT','Ivy bleeding time','Template bleeding time'], unit: 'minutes', normal: '2-9' },
    },
  },
  CARDIAC: {
    fullName: 'Cardiac Markers',
    aliases: ['Cardiac enzymes','Cardiac biomarkers','Troponin panel','ACS panel'],
    tests: {
      'Troponin I': { aliases: ['TnI','Trop I','cTnI','Cardiac troponin I'], unit: 'ng/mL', normal: '<0.04', critical: '>0.1' },
      'Troponin T': { aliases: ['TnT','Trop T','cTnT','Cardiac troponin T'], unit: 'ng/mL', normal: '<0.01' },
      'hs-Troponin': { aliases: ['hs-TnI','hs-TnT','High-sensitivity troponin','High sensitivity troponin'], unit: 'ng/L', normal: '<14 (female) <22 (male)' },
      'CK': { aliases: ['CPK','Creatine kinase','Creatine phosphokinase','Total CK'], unit: 'U/L', normal: 'M:55-170 F:30-135' },
      'CK-MB': { aliases: ['CKMB','CK MB','MB fraction','MB isoenzyme'], unit: 'ng/mL', normal: '<5.0' },
      'BNP': { aliases: ['B-type natriuretic peptide','Brain natriuretic peptide'], unit: 'pg/mL', normal: '<100' },
      'NT-proBNP': { aliases: ['ProBNP','NT proBNP','N-terminal proBNP'], unit: 'pg/mL', normal: '<300 (age <50), <900 (50-75), <1800 (>75)' },
      'Myoglobin': { aliases: ['Serum myoglobin'], unit: 'ng/mL', normal: '<90' },
      'LDH': { aliases: ['Lactate dehydrogenase','LD'], unit: 'U/L', normal: '140-280' },
    },
  },
  ABG: {
    fullName: 'Arterial Blood Gas',
    aliases: ['ABG','Blood gas','Arterial gas','Art gas','VBG','Venous blood gas'],
    tests: {
      'pH': { aliases: ['Arterial pH','Blood pH'], unit: '', normal: '7.35-7.45', critical: '<7.1 or >7.6' },
      'pCO2': { aliases: ['PaCO2','Partial pressure CO2','Carbon dioxide'], unit: 'mmHg', normal: '35-45', critical: '<20 or >70' },
      'pO2': { aliases: ['PaO2','Partial pressure O2','Oxygen tension'], unit: 'mmHg', normal: '80-100', critical: '<60' },
      'HCO3': { aliases: ['Bicarbonate','Actual bicarbonate','Standard bicarbonate'], unit: 'mmol/L', normal: '22-26', critical: '<10' },
      'Base Excess': { aliases: ['BE','Base deficit','BD','Standard base excess','SBE'], unit: 'mmol/L', normal: '-2 to +2' },
      'Lactate': { aliases: ['Lac','Lactic acid','Serum lactate','Blood lactate'], unit: 'mmol/L', normal: '0.5-2.0', critical: '>4.0' },
      'SaO2': { aliases: ['O2 saturation','Arterial saturation','Oxygen saturation'], unit: '%', normal: '95-100' },
      'P/F Ratio': { aliases: ['PaO2/FiO2','PF ratio','Oxygenation index'], unit: 'ratio', normal: '>400' },
      'A-a gradient': { aliases: ['Alveolar-arterial gradient','A-a O2 gradient','AaDO2'], unit: 'mmHg', normal: '<15 (young), increases with age' },
      'Carboxyhemoglobin': { aliases: ['COHb','CO-Hb','Carbon monoxide'], unit: '%', normal: '<3 (non-smoker), <10 (smoker)' },
      'Methemoglobin': { aliases: ['MetHb','Met-Hb'], unit: '%', normal: '<1.5' },
    },
  },
  THYROID: {
    fullName: 'Thyroid Function Tests',
    aliases: ['TFT','Thyroid panel','Thyroid function','Thyroid studies'],
    tests: {
      'TSH': { aliases: ['Thyroid stimulating hormone','Thyrotropin'], unit: 'mIU/L', normal: '0.4-4.0' },
      'Free T4': { aliases: ['FT4','Free thyroxine','Thyroxine free'], unit: 'ng/dL', normal: '0.8-1.8' },
      'Free T3': { aliases: ['FT3','Free triiodothyronine','Triiodothyronine free'], unit: 'pg/mL', normal: '2.3-4.2' },
      'Total T4': { aliases: ['T4','Thyroxine','Serum T4'], unit: 'mcg/dL', normal: '5.0-12.0' },
      'Total T3': { aliases: ['T3','Triiodothyronine','Serum T3'], unit: 'ng/dL', normal: '80-200' },
      'Thyroglobulin': { aliases: ['Tg','Serum thyroglobulin'], unit: 'ng/mL', normal: '<35' },
      'TPO Antibodies': { aliases: ['Anti-TPO','Thyroid peroxidase antibodies','TPOAb'], unit: 'IU/mL', normal: '<35' },
      'TSI': { aliases: ['Thyroid stimulating immunoglobulin','TRAb','TSH receptor antibodies'], unit: '', normal: 'Negative' },
    },
  },
  LIPID: {
    fullName: 'Lipid Panel',
    aliases: ['Lipid profile','Lipids','Cholesterol panel','Fasting lipids'],
    tests: {
      'Total Cholesterol': { aliases: ['TC','Cholesterol','Total chol'], unit: 'mg/dL', normal: '<200' },
      'LDL': { aliases: ['LDL-C','LDL cholesterol','Low density lipoprotein','Bad cholesterol'], unit: 'mg/dL', normal: '<100 (optimal), <130 (near optimal)' },
      'HDL': { aliases: ['HDL-C','HDL cholesterol','High density lipoprotein','Good cholesterol'], unit: 'mg/dL', normal: 'M:>40 F:>50' },
      'Triglycerides': { aliases: ['TG','Trigs','Serum triglycerides'], unit: 'mg/dL', normal: '<150', critical: '>500 (pancreatitis risk)' },
      'VLDL': { aliases: ['VLDL-C','Very low density lipoprotein'], unit: 'mg/dL', normal: '<30' },
      'Non-HDL Cholesterol': { aliases: ['Non-HDL','Non-HDL-C'], unit: 'mg/dL', normal: '<130' },
      'TC/HDL Ratio': { aliases: ['Cholesterol ratio','Atherogenic index'], unit: 'ratio', normal: '<5.0' },
    },
  },
  IRON: {
    fullName: 'Iron Studies',
    aliases: ['Iron panel','Iron profile','Serum iron studies'],
    tests: {
      'Serum Iron': { aliases: ['Iron','Fe','Serum Fe'], unit: 'mcg/dL', normal: '60-170' },
      'TIBC': { aliases: ['Total iron binding capacity','Iron binding capacity'], unit: 'mcg/dL', normal: '250-370' },
      'Transferrin Saturation': { aliases: ['TSAT','Iron saturation','Transferrin sat','%Sat'], unit: '%', normal: '20-50' },
      'Ferritin': { aliases: ['Serum ferritin'], unit: 'ng/mL', normal: 'M:30-400 F:15-150' },
      'Transferrin': { aliases: ['Serum transferrin'], unit: 'mg/dL', normal: '200-360' },
      'Reticulocyte Count': { aliases: ['Retic count','Retics'], unit: '%', normal: '0.5-2.5' },
      'Haptoglobin': { aliases: ['Serum haptoglobin'], unit: 'mg/dL', normal: '30-200' },
    },
  },
  URINALYSIS: {
    fullName: 'Urinalysis',
    aliases: ['UA','Urine analysis','Urine test','Dipstick','Urine dipstick','Midstream urine','MSU','Clean catch'],
    tests: {
      'Color': { aliases: ['Urine color','Colour'], normal: 'Yellow/Amber' },
      'Clarity': { aliases: ['Appearance','Turbidity'], normal: 'Clear' },
      'Specific Gravity': { aliases: ['SG','Sp Gr','Urine SG'], normal: '1.005-1.030' },
      'pH': { aliases: ['Urine pH'], normal: '4.5-8.0' },
      'Protein': { aliases: ['Urine protein','Proteinuria','Albumin urine'], normal: 'Negative' },
      'Glucose': { aliases: ['Urine glucose','Glycosuria','Glucosuria'], normal: 'Negative' },
      'Ketones': { aliases: ['Urine ketones','Ketonuria'], normal: 'Negative' },
      'Blood': { aliases: ['Urine blood','Hematuria','Haematuria','Occult blood'], normal: 'Negative' },
      'Bilirubin': { aliases: ['Urine bilirubin','Bilirubinuria'], normal: 'Negative' },
      'Urobilinogen': { aliases: ['Urine urobilinogen'], normal: '0.2-1.0 mg/dL' },
      'Nitrite': { aliases: ['Urine nitrite','Nitrites'], normal: 'Negative' },
      'Leukocyte Esterase': { aliases: ['LE','Leuk esterase','WBC esterase'], normal: 'Negative' },
      'WBC': { aliases: ['Urine WBC','White cells in urine','Pyuria'], normal: '<5/HPF' },
      'RBC': { aliases: ['Urine RBC','Red cells in urine','Microscopic hematuria'], normal: '<3/HPF' },
      'Bacteria': { aliases: ['Urine bacteria','Bacteriuria'], normal: 'None/Few' },
      'Casts': { aliases: ['Urine casts','Hyaline casts','Granular casts','WBC casts','RBC casts','Waxy casts','Muddy brown casts'], normal: 'None/Rare hyaline' },
      'Crystals': { aliases: ['Urine crystals','Calcium oxalate','Uric acid crystals','Struvite','Triple phosphate'], normal: 'None' },
      'Epithelial Cells': { aliases: ['Squamous epithelial','Transitional epithelial','Renal epithelial'], normal: 'Few squamous' },
    },
  },
  CSF: {
    fullName: 'Cerebrospinal Fluid Analysis',
    aliases: ['CSF','Spinal fluid','LP results','Lumbar puncture results'],
    tests: {
      'Opening Pressure': { aliases: ['OP','CSF pressure','Intracranial pressure'], unit: 'cmH2O', normal: '10-20', critical: '>25' },
      'Appearance': { aliases: ['CSF appearance','Clarity'], normal: 'Clear, colorless' },
      'WBC': { aliases: ['CSF WBC','CSF white cells','Cell count','Pleocytosis'], unit: 'cells/uL', normal: '<5' },
      'RBC': { aliases: ['CSF RBC','CSF red cells'], unit: 'cells/uL', normal: '0' },
      'Protein': { aliases: ['CSF protein','Total protein CSF'], unit: 'mg/dL', normal: '15-45' },
      'Glucose': { aliases: ['CSF glucose','Sugar CSF'], unit: 'mg/dL', normal: '40-70 (or >60% serum)' },
      'Gram Stain': { aliases: ['CSF gram stain','Gram stain'], normal: 'No organisms' },
      'Culture': { aliases: ['CSF culture','CSF Cx'], normal: 'No growth' },
      'Xanthochromia': { aliases: ['CSF xanthochromia','Yellow CSF'], normal: 'Absent' },
      'Oligoclonal Bands': { aliases: ['OCB','CSF OCB','CSF oligoclonal'], normal: 'Absent' },
      'Cytology': { aliases: ['CSF cytology','Malignant cells'], normal: 'No malignant cells' },
    },
  },
};

export const LAB_INTERPRETATION_PATTERNS = {
  // What combinations of abnormal labs suggest
  'Anemia workup': ['Low Hgb','Low Hct','Check MCV','Check reticulocytes','Check iron studies','Check B12/folate'],
  'Microcytic anemia': ['Low MCV','Low iron','Low ferritin','High TIBC','Low TSAT'],
  'Macrocytic anemia': ['High MCV','Check B12','Check folate','Check reticulocytes','Check TFT'],
  'Hemolytic anemia': ['High retic','High LDH','High indirect bili','Low haptoglobin','Positive Coombs'],
  'DIC': ['Low platelets','High PT','High aPTT','Low fibrinogen','High D-dimer','Schistocytes'],
  'Sepsis workup': ['High WBC','Left shift','High CRP','High procalcitonin','High lactate','Blood cultures'],
  'AKI': ['Rising Cr','Rising BUN','High K','Low bicarb','Metabolic acidosis','Low UOP'],
  'Hepatocellular injury': ['High AST','High ALT','AST/ALT ratio','Check hepatitis panel','Check acetaminophen level'],
  'Cholestatic pattern': ['High ALP','High GGT','High direct bili','Check US abdomen','Check MRCP'],
  'DKA': ['High glucose','Low bicarb','High anion gap','Positive ketones','Low pH','Low pCO2'],
  'Metabolic acidosis': ['Low pH','Low bicarb','Low pCO2','Calculate anion gap','Check lactate','Check ketones'],
  'Respiratory acidosis': ['Low pH','High pCO2','High bicarb (if chronic)','Check for COPD/asthma/sedation'],
  'Metabolic alkalosis': ['High pH','High bicarb','High pCO2','Check chloride','Check potassium'],
  'Tumor lysis syndrome': ['High K','High phosphate','High uric acid','Low calcium','High LDH','Rising Cr'],
  'Rhabdomyolysis': ['Very high CK','High myoglobin','High K','High phosphate','Rising Cr','Dark urine'],
  'HIT': ['Falling platelets','50% drop from baseline','4T score','Check anti-PF4 antibody','Check serotonin release assay'],
  'TTP': ['Low platelets','Schistocytes','High LDH','High indirect bili','AKI','Neurological symptoms'],
  'Hypothyroidism': ['High TSH','Low FT4','May have high cholesterol','May have hyponatremia'],
  'Hyperthyroidism': ['Low TSH','High FT4','High FT3','Check TRAb','Check thyroid uptake scan'],
  'Iron deficiency': ['Low ferritin','Low iron','High TIBC','Low TSAT','Low MCV','High RDW'],
  'Acute MI': ['Rising troponin','Dynamic ECG changes','High CK-MB','High myoglobin (early)'],
  'Heart failure': ['High BNP','High NT-proBNP','CXR congestion','Echo EF'],
  'Nephrotic syndrome': ['Heavy proteinuria','Low albumin','Hyperlipidemia','Edema'],
  'Nephritic syndrome': ['Hematuria','RBC casts','Proteinuria','Rising Cr','Hypertension'],
};

export const SPECIMEN_TYPES = [
  'Venous blood','Arterial blood','Capillary blood',
  'Serum','Plasma','Whole blood','EDTA','Citrate','Heparin',
  'Green top','Purple top','Blue top','Red top','Yellow top','Gray top','Gold top',
  'SST','Serum separator tube',
  'Midstream urine','MSU','Clean catch','Catheterized specimen',
  '24-hour urine','Spot urine','First morning urine',
  'Sputum','Induced sputum','BAL','Bronchoalveolar lavage',
  'CSF','Cerebrospinal fluid','Spinal fluid',
  'Pleural fluid','Peritoneal fluid','Ascitic fluid',
  'Pericardial fluid','Synovial fluid','Joint fluid',
  'Stool','Fecal sample','Rectal swab',
  'Wound swab','Wound culture','Tissue sample','Biopsy specimen',
  'Blood culture','Aerobic bottle','Anaerobic bottle',
  'Nasopharyngeal swab','NP swab','Throat swab','Pharyngeal swab',
  'Eye swab','Ear swab','Vaginal swab','Cervical swab','Urethral swab',
  'Bone marrow aspirate','Bone marrow biopsy','Trephine',
  'Peripheral blood smear','Blood film','Thick and thin film',
  'Arterial blood gas','ABG syringe','Heparinized syringe',
  'Dried blood spot','Heel prick','Newborn screening',
  'Frozen section','Fresh tissue','Formalin-fixed',
  'Cytology specimen','Pap smear','FNA','Touch prep',
];

export function loadLabSeedData(models) {
  const now = new Date().toISOString();

  for (const [panelName, panel] of Object.entries(COMPLETE_LAB_PANELS)) {
    // Panel name and aliases
    for (const alias of [panelName, panel.fullName, ...panel.aliases]) {
      const key = alias.toLowerCase();
      if (key.length >= 2 && !models.labTests) models.labTests = {};
      if (models.labTests && !models.labTests[key]) {
        models.labTests[key] = { count: 3, entity: 'LAB_PANEL', lastSeen: now, confidence: 0.85, seeded: true };
      }
      if (!models.diagnoses[key]) {
        models.diagnoses[key] = { count: 1, entity: 'LAB', lastSeen: now, confidence: 0.70, seeded: true };
      }
    }
    // Individual tests and all their aliases
    for (const [testName, test] of Object.entries(panel.tests)) {
      const allNames = [testName, ...(test.aliases || [])];
      for (const name of allNames) {
        const key = name.toLowerCase();
        if (key.length < 2) continue;
        if (models.labTests && !models.labTests[key]) {
          models.labTests[key] = { count: 2, entity: 'LAB_TEST', lastSeen: now, confidence: 0.82, seeded: true, panel: panelName };
        }
        if (!models.diagnoses[key]) {
          models.diagnoses[key] = { count: 1, entity: 'LAB', lastSeen: now, confidence: 0.68, seeded: true };
        }
      }
    }
  }

  // Interpretation patterns
  for (const [pattern, components] of Object.entries(LAB_INTERPRETATION_PATTERNS)) {
    const key = pattern.toLowerCase();
    if (!models.diagnoses[key]) {
      models.diagnoses[key] = { count: 1, entity: 'LAB_PATTERN', lastSeen: now, confidence: 0.65, seeded: true };
    }
    for (const comp of components) {
      const ck = comp.toLowerCase();
      if (ck.length >= 3 && !models.diagnoses[ck]) {
        models.diagnoses[ck] = { count: 1, entity: 'LAB_FINDING', lastSeen: now, confidence: 0.60, seeded: true };
      }
    }
  }

  // Specimen types
  for (const spec of SPECIMEN_TYPES) {
    const key = spec.toLowerCase();
    if (!models.diagnoses[key]) {
      models.diagnoses[key] = { count: 1, entity: 'SPECIMEN', lastSeen: now, confidence: 0.55, seeded: true };
    }
  }

  models.labSeeded = true;
  return models;
}
