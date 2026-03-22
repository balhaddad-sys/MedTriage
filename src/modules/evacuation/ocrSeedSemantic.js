// OCR Semantic Intelligence — teaches the engine to INTERPRET, not just read
//
// This is the brain that understands meaning:
//   "HTN" = "Hypertension" = "High blood pressure" = "Elevated BP" = "ضغط الدم"
//   "SOB" = "Shortness of breath" = "Dyspnea" = "Breathless" = "ضيق تنفس"
//   "on 2L NC" → patient is on supplemental oxygen
//   "day 5 Tazocin" → active antibiotic therapy, implies infection
//
// Three layers:
//   1. SYNONYM_MAP — groups of terms that mean the same clinical concept
//   2. INFERENCE_RULES — contextual patterns that imply clinical state
//   3. COLLOQUIAL_MAP — informal/patient language → formal terminology

// ═══════════════════════════════════════════════════════════════════
// SYNONYM MAP — every clinical concept with ALL its representations
// Key = canonical concept ID, Value = all synonyms/abbreviations/variants
// ═══════════════════════════════════════════════════════════════════

export const SYNONYM_MAP = {
  // ── CARDIOVASCULAR ──
  hypertension: [
    'HTN','Hypertension','HBP','High blood pressure','Elevated BP',
    'Elevated blood pressure','BP high','Hypertensive',
    'Essential hypertension','Primary hypertension','Secondary hypertension',
    'Htn','htn','h/t','H/T','raised BP','raised blood pressure',
    'ضغط','ضغط الدم','ارتفاع ضغط الدم','ضغط عالي',
  ],
  hypotension: [
    'Hypotension','Low BP','Low blood pressure','Hypotensive',
    'BP low','Hemodynamically unstable','Shock','انخفاض ضغط الدم',
  ],
  myocardial_infarction: [
    'MI','Myocardial infarction','Heart attack','AMI','Acute MI',
    'Acute myocardial infarction','STEMI','NSTEMI','Non-STEMI',
    'ST elevation MI','Non-ST elevation MI',
    'Myocardial ischemia','Cardiac ischemia','Coronary event',
    'ACS','Acute coronary syndrome','Unstable angina','UA',
    'جلطة','جلطة قلبية','احتشاء عضلة القلب','ذبحة صدرية',
  ],
  heart_failure: [
    'CHF','HF','Heart failure','Congestive heart failure',
    'ADHF','Acute decompensated heart failure',
    'Decompensated HF','Decompensated heart failure',
    'HFrEF','HFpEF','HFmrEF',
    'Heart failure with reduced EF','Heart failure with preserved EF',
    'Left heart failure','Right heart failure','Biventricular failure',
    'Cardiac failure','Pump failure','Low EF',
    'Fluid overload','Volume overload','Pulmonary edema',
    'فشل قلبي','قصور القلب','ضعف عضلة القلب',
  ],
  atrial_fibrillation: [
    'AF','AFib','A.fib','A-fib','Atrial fibrillation',
    'Atrial fib','A fib','Afib','a.fib','a-fib',
    'PAF','Paroxysmal AF','Paroxysmal atrial fibrillation',
    'Persistent AF','Permanent AF','Chronic AF',
    'AF with RVR','Rapid AF','Uncontrolled AF',
    'رجفان أذيني',
  ],
  dvt_pe: [
    'DVT','Deep vein thrombosis','Deep venous thrombosis',
    'VTE','Venous thromboembolism',
    'PE','Pulmonary embolism','Pulmonary embolus',
    'Blood clot','Thrombosis','Thrombus','Clot',
    'LE DVT','Lower extremity DVT','Upper extremity DVT',
    'Submassive PE','Massive PE','Saddle PE',
    'جلطة رئوية','تخثر وريدي',
  ],

  // ── RESPIRATORY ──
  pneumonia: [
    'PNA','Pneumonia','Lung infection',
    'CAP','Community acquired pneumonia','Community-acquired pneumonia',
    'HAP','Hospital acquired pneumonia','Hospital-acquired pneumonia',
    'VAP','Ventilator associated pneumonia','Ventilator-associated pneumonia',
    'Aspiration pneumonia','Aspiration PNA',
    'Lobar pneumonia','Bilateral pneumonia',
    'Walking pneumonia','Atypical pneumonia',
    'Lower respiratory tract infection','LRTI',
    'التهاب رئوي','ذات الرئة','التهاب الرئة',
  ],
  copd: [
    'COPD','Chronic obstructive pulmonary disease',
    'AECOPD','Acute exacerbation of COPD','COPD exacerbation',
    'COPD flare','COPD flare-up',
    'Chronic bronchitis','Emphysema',
    'Chronic airways disease','CAD','Chronic lung disease','CLD',
    'Obstructive airways disease','OAD',
    'انسداد رئوي مزمن',
  ],
  asthma: [
    'Asthma','Bronchial asthma','Asthma exacerbation',
    'Acute asthma','Asthma attack','Asthma flare',
    'Status asthmaticus','Severe acute asthma',
    'Reactive airway disease','RAD',
    'Bronchospasm','Wheezy','Wheezing',
    'ربو','ربو شعبي',
  ],
  respiratory_failure: [
    'Respiratory failure','Resp failure','RF',
    'Acute respiratory failure','ARF',
    'Chronic respiratory failure','CRF',
    'Type 1 respiratory failure','Type 2 respiratory failure',
    'Hypoxic respiratory failure','Hypercapnic respiratory failure',
    'Hypoxemia','Hypoxia','Desaturation','Desats',
    'ARDS','Acute respiratory distress syndrome',
    'فشل تنفسي','قصور تنفسي',
  ],
  shortness_of_breath: [
    'SOB','Shortness of breath','Dyspnea','Dyspnoea',
    'Breathless','Breathlessness','Difficulty breathing',
    'Air hunger','Can\'t breathe','Winded','Short of breath',
    'DOE','Dyspnea on exertion',
    'PND','Paroxysmal nocturnal dyspnea',
    'Orthopnea','Orthopnoea',
    'Tachypnea','Tachypnoea','Rapid breathing',
    'ضيق تنفس','ضيق في التنفس','صعوبة في التنفس',
  ],

  // ── RENAL ──
  acute_kidney_injury: [
    'AKI','Acute kidney injury','Acute renal failure','ARF',
    'Acute renal insufficiency','Rising creatinine',
    'Rising Cr','Cr bump','Creatinine elevation',
    'Prerenal AKI','Intrinsic AKI','Postrenal AKI',
    'ATN','Acute tubular necrosis',
    'AKI on CKD','Acute on chronic renal failure',
    'Oliguric','Anuric','Oliguria','Anuria',
    'فشل كلوي حاد','قصور كلوي حاد',
  ],
  chronic_kidney_disease: [
    'CKD','Chronic kidney disease','Chronic renal disease',
    'Chronic renal failure','CRF','Chronic renal insufficiency',
    'CKD 1','CKD 2','CKD 3','CKD 3A','CKD 3B','CKD 4','CKD 5',
    'CKD stage 3','CKD stage 4','CKD stage 5',
    'ESRD','ESKD','End stage renal disease','End stage kidney disease',
    'On dialysis','On HD','On PD',
    'Dialysis dependent','Renal replacement therapy','RRT',
    'فشل كلوي مزمن','قصور كلوي مزمن','غسيل كلى',
  ],
  uti: [
    'UTI','Urinary tract infection','Urine infection',
    'Cystitis','Bladder infection','Lower UTI',
    'Pyelonephritis','Pyelo','Upper UTI','Kidney infection',
    'Urosepsis','Complicated UTI','cUTI',
    'Uncomplicated UTI','Simple UTI',
    'CAUTI','Catheter associated UTI','Catheter-associated UTI',
    'التهاب مسالك بولية','التهاب المثانة','التهاب الكلى',
  ],

  // ── GI ──
  gi_bleed: [
    'GIB','GI bleed','Gastrointestinal bleed','GI bleeding',
    'UGIB','Upper GI bleed','Upper GI bleeding',
    'LGIB','Lower GI bleed','Lower GI bleeding',
    'Hematemesis','Haematemesis','Vomiting blood','Coffee ground emesis',
    'Melena','Black stools','Black tarry stools','Dark stools',
    'Hematochezia','Haematochezia','Bright red blood per rectum','BRBPR',
    'Bloody stool','Rectal bleeding','PR bleeding',
    'نزيف هضمي','تقيؤ دم','براز أسود',
  ],
  liver_disease: [
    'CLD','Chronic liver disease','Liver disease',
    'Cirrhosis','Liver cirrhosis','Hepatic cirrhosis',
    'Decompensated cirrhosis','Decompensated liver disease',
    'Compensated cirrhosis',
    'Portal hypertension','Portal HTN',
    'Hepatic encephalopathy','HE','Encephalopathy',
    'Ascites','Tense ascites','Refractory ascites',
    'SBP','Spontaneous bacterial peritonitis',
    'Variceal bleed','Esophageal varices','Variceal hemorrhage',
    'Hepatorenal syndrome','HRS',
    'NASH','NAFLD','Fatty liver','Steatosis','Steatohepatitis',
    'تليف الكبد','تشمع الكبد','فشل كبدي',
  ],

  // ── ENDOCRINE ──
  diabetes: [
    'DM','Diabetes','Diabetes mellitus',
    'DM1','DM2','T1DM','T2DM','IDDM','NIDDM',
    'Type 1 diabetes','Type 2 diabetes','Type 1 DM','Type 2 DM',
    'Insulin dependent','Non-insulin dependent',
    'Diabetic','Uncontrolled diabetes','Poorly controlled diabetes',
    'Brittle diabetes','New onset diabetes','NODM',
    'Gestational diabetes','GDM',
    'Pre-diabetes','Pre-diabetic','Impaired glucose tolerance','IGT',
    'Impaired fasting glucose','IFG',
    'سكري','مرض السكر','سكر الدم','داء السكري',
  ],
  dka: [
    'DKA','Diabetic ketoacidosis','Ketoacidosis',
    'Diabetic ketosis','Ketosis',
    'حماض كيتوني سكري',
  ],
  hyperglycemia: [
    'Hyperglycemia','Hyperglycaemia','High blood sugar','High glucose',
    'Elevated glucose','Elevated blood sugar','Sugar high',
    'BGL high','BS high','CBG high',
    'Uncontrolled sugars','Uncontrolled glucose',
    'ارتفاع السكر',
  ],
  hypoglycemia: [
    'Hypoglycemia','Hypoglycaemia','Low blood sugar','Low glucose',
    'Sugar low','Hypo','Hypoglycemic episode',
    'انخفاض السكر',
  ],

  // ── NEURO ──
  stroke: [
    'CVA','Stroke','Cerebrovascular accident',
    'Ischemic stroke','Ischaemic stroke',
    'Hemorrhagic stroke','Haemorrhagic stroke',
    'Embolic stroke','Thrombotic stroke','Lacunar stroke',
    'TIA','Transient ischemic attack','Mini stroke',
    'Brain attack','Cerebral infarction','Cerebral infarct',
    'MCA stroke','PCA stroke','ACA stroke',
    'Basilar stroke','Brainstem stroke','Cerebellar stroke',
    'جلطة دماغية','سكتة دماغية','جلطة بالمخ',
  ],
  seizure: [
    'Seizure','Seizures','Convulsion','Convulsions',
    'Fit','Fits','Episode','Epileptic episode',
    'Tonic-clonic','Grand mal','Petit mal','Absence seizure',
    'Focal seizure','Partial seizure','Complex partial',
    'Status epilepticus','SE','Breakthrough seizure',
    'New onset seizure','First seizure','Febrile seizure',
    'تشنج','نوبة صرع','صرع',
  ],
  altered_mental_status: [
    'AMS','Altered mental status','Altered consciousness',
    'Altered LOC','Decreased LOC',
    'Confusion','Confused','Disorientation','Disoriented',
    'Delirium','Delirious','Encephalopathy','Encephalopathic',
    'Obtunded','Stuporous','Lethargic','Somnolent',
    'Unresponsive','Comatose','Coma',
    'Not alert','Not oriented','Incoherent',
    'Agitation','Agitated','Restless','Sundowning',
    'اضطراب الوعي','تشوش ذهني','غيبوبة',
  ],

  // ── INFECTIOUS ──
  sepsis: [
    'Sepsis','Severe sepsis','Septic shock','Septicemia','Septicaemia',
    'Bacteremia','Bacteraemia','Blood stream infection','BSI',
    'SIRS','Systemic inflammatory response',
    'Urosepsis','Biliary sepsis','Abdominal sepsis',
    'Source of sepsis','Sepsis source','Focus of infection',
    'تسمم الدم','إنتان',
  ],
  cellulitis: [
    'Cellulitis','Skin infection','Soft tissue infection',
    'SSTI','Skin and soft tissue infection',
    'Erysipelas','Abscess','Skin abscess',
    'Wound infection','Surgical site infection','SSI',
    'Infected wound','Purulent','Purulence',
    'التهاب النسيج الخلوي','التهاب الجلد',
  ],

  // ── PAIN ──
  chest_pain: [
    'Chest pain','CP','Chest tightness','Chest pressure',
    'Chest discomfort','Substernal chest pain',
    'Precordial pain','Retrosternal pain',
    'Pleuritic chest pain','Pleurisy','Pleuritic pain',
    'Musculoskeletal chest pain','MSK chest pain',
    'Atypical chest pain','Typical chest pain',
    'ألم في الصدر','ألم صدري',
  ],
  abdominal_pain: [
    'Abdominal pain','Abd pain','Belly pain','Stomach pain',
    'Tummy pain','Epigastric pain','Epigastric discomfort',
    'RUQ pain','RLQ pain','LUQ pain','LLQ pain',
    'Periumbilical pain','Suprapubic pain','Flank pain',
    'Diffuse abdominal pain','Generalized abd pain',
    'Crampy','Cramping','Colicky','Colic',
    'Tenderness','Guarding','Rebound','Peritoneal signs',
    'Acute abdomen','Surgical abdomen',
    'ألم بطني','ألم في البطن','مغص',
  ],
  headache: [
    'Headache','HA','H/A','Head ache','Cephalalgia',
    'Migraine','Tension headache','Tension type headache','TTH',
    'Cluster headache','Thunderclap headache',
    'Occipital headache','Frontal headache','Temporal headache',
    'Worst headache of life','Severe headache',
    'صداع','ألم في الرأس',
  ],

  // ── SYMPTOMS ──
  nausea_vomiting: [
    'N/V','N&V','Nausea','Vomiting','Emesis',
    'Nausea and vomiting','Nausea/vomiting',
    'Feeling sick','Sick to stomach','Queasy',
    'Retching','Dry heaving',
    'Coffee ground emesis','CGE','Bilious emesis',
    'Hematemesis','Bloody vomit',
    'غثيان','قيء','تقيؤ','استفراغ',
  ],
  diarrhea: [
    'Diarrhea','Diarrhoea','Loose stools','Watery stools',
    'Loose BM','Frequent BM','Increased stool frequency',
    'Bloody diarrhea','Mucoid diarrhea',
    'C. diff diarrhea','Infectious diarrhea',
    'إسهال','إسهال مائي',
  ],
  fever: [
    'Fever','Febrile','Temp','Temperature','Pyrexia',
    'Febrile illness','Fever of unknown origin','FUO',
    'Low grade fever','High grade fever','Spiking fever',
    'Tmax','T max','Temp max',
    'Afebrile','No fever','Apyrexial',
    'Chills','Rigors','Night sweats',
    'حمى','حرارة','سخونة','ارتفاع الحرارة',
  ],
  edema: [
    'Edema','Oedema','Swelling','Swollen',
    'Peripheral edema','Peripheral oedema',
    'LE edema','Lower extremity edema','Leg swelling',
    'Bilateral LE edema','Bilateral leg edema',
    'Pedal edema','Ankle edema','Pretibial edema',
    'Pitting edema','Non-pitting edema',
    '1+ edema','2+ edema','3+ edema','4+ edema',
    'Trace edema','Mild edema','Moderate edema','Severe edema',
    'Anasarca','Generalized edema','Total body edema',
    'Pulmonary edema','Flash pulmonary edema',
    'Cerebral edema','Brain swelling',
    'تورم','انتفاخ','وذمة',
  ],
  cough: [
    'Cough','Coughing','Productive cough','Dry cough',
    'Wet cough','Non-productive cough',
    'Chronic cough','Persistent cough','New cough',
    'Hemoptysis','Haemoptysis','Coughing blood',
    'Blood-tinged sputum','Bloody sputum',
    'Sputum production','Purulent sputum','Green sputum',
    'Yellow sputum','White sputum','Mucoid sputum',
    'سعال','كحة',
  ],

  // ── PHYSICAL EXAM FINDINGS ──
  normal_exam: [
    'NAD','No acute distress','Comfortable','Appears well',
    'In no distress','No distress','Not in distress',
    'WNL','Within normal limits','Unremarkable','Normal',
    'Benign exam','Non-focal exam',
  ],
  clear_lungs: [
    'CTAB','CTA','Clear to auscultation','Clear to auscultation bilaterally',
    'Clear bilaterally','Clear bilateral','Lungs clear',
    'Clear lung fields','No adventitious sounds',
    'No crackles','No rales','No rhonchi','No wheezes',
    'Good air entry','Good air entry bilaterally','Equal air entry',
    'Normal breath sounds','Vesicular breath sounds',
  ],
  abnormal_lungs: [
    'Crackles','Rales','Crepitations','Coarse crackles','Fine crackles',
    'Bibasilar crackles','Bilateral crackles','Basilar crackles',
    'Rhonchi','Wheezing','Wheeze','Expiratory wheeze',
    'Inspiratory crackles','Expiratory rhonchi',
    'Decreased breath sounds','Diminished breath sounds','Reduced air entry',
    'Absent breath sounds','No air entry',
    'Bronchial breathing','Tubular breathing',
    'Dullness to percussion','Stony dull',
    'Pleural rub','Friction rub',
    'Stridor','Inspiratory stridor','Expiratory stridor',
  ],
  normal_heart: [
    'RRR','Regular rate and rhythm','S1 S2','S1S2','Normal S1 S2',
    'No murmur','No murmurs','No gallop','No rub',
    'No murmur rub gallop','No MRG','No m/r/g',
    'Regular rhythm','Normal heart sounds',
    'NSR','Normal sinus rhythm','Sinus rhythm',
  ],
  normal_abdomen: [
    'NTND','S/NT/ND','Soft non-tender non-distended',
    'Soft','Non-tender','Non-distended','Nontender','Nondistended',
    'Soft and non-tender','Soft NT ND',
    'BS+','BS present','Bowel sounds present','Active bowel sounds',
    'Normoactive bowel sounds','Normal bowel sounds',
    'No organomegaly','No hepatosplenomegaly','No HSM',
    'No masses','No guarding','No rebound','No rigidity',
    'No peritoneal signs','Benign abdomen',
  ],

  // ── STATUS / TRAJECTORY ──
  stable: [
    'Stable','Clinically stable','Hemodynamically stable','HD stable',
    'Vitally stable','VS stable','Vitals stable',
    'Medically stable','Condition stable',
    'Status quo','No change','Unchanged',
    'مستقر','حالة مستقرة',
  ],
  improving: [
    'Improving','Improved','Better','Getting better',
    'Clinically improving','Clinically improved',
    'Trending better','Trending down','On the mend',
    'Responding to treatment','Good response',
    'Interval improvement','Shows improvement',
    'Recovery','Recovering',
    'تحسن','يتحسن','حالة متحسنة',
  ],
  worsening: [
    'Worsening','Worse','Deteriorating','Declining',
    'Clinically worsening','Clinically deteriorating',
    'Trending worse','Trending up','Decompensating',
    'Not responding','Poor response','Failing',
    'Interval worsening','No improvement',
    'تدهور','يتدهور','حالة متدهورة',
  ],

  // ── OXYGEN / VENTILATION ──
  room_air: [
    'RA','Room air','On RA','On room air',
    'No supplemental O2','No O2','Off O2',
    'Self-ventilating on air','SVOA',
  ],
  nasal_cannula: [
    'NC','Nasal cannula','Nasal prongs','NP',
    'On NC','On nasal cannula','Low flow O2',
    'On 1L','On 2L','On 3L','On 4L','On 5L','On 6L',
    '1L NC','2L NC','3L NC','4L NC','5L NC','6L NC',
    '1 liter','2 liters','3 liters','4 liters',
    'O2 via NC','O2 via nasal cannula',
  ],
  face_mask: [
    'FM','Face mask','Simple mask','SM',
    'Hudson mask','O2 mask',
    'Venturi mask','Venturi','Venti mask',
    'FiO2 28%','FiO2 35%','FiO2 40%','FiO2 50%','FiO2 60%',
  ],
  non_rebreather: [
    'NRB','Non-rebreather','Non-rebreather mask',
    'Non rebreather','NRB mask','High flow O2',
    'On 10L','On 15L','10L NRB','15L NRB',
  ],
  mechanical_ventilation: [
    'Intubated','Ventilated','On ventilator','On vent',
    'Mechanically ventilated','Mechanical ventilation','MV',
    'ETT in situ','ETT in place','Endotracheal tube',
    'SIMV','Assist control','AC','Pressure support','PS',
    'Pressure control','PC','Volume control','VC',
    'PEEP','FiO2','Tidal volume','TV','Rate',
    'Ventilator settings','Vent settings',
    'على جهاز التنفس','تنفس صناعي',
  ],

  // ── CODE STATUS ──
  full_code: [
    'Full code','Full resuscitation','For resuscitation',
    'For CPR','CPR yes','Resuscitate',
    'Code status: full','إنعاش كامل',
  ],
  dnr: [
    'DNR','Do not resuscitate','DNAR','Do not attempt resuscitation',
    'AND','Allow natural death','NFR','Not for resuscitation',
    'No CPR','No code','No resuscitation',
    'DNR/DNI','DNI','Do not intubate',
    'Comfort care','Comfort measures only','CMO',
    'Palliative','Palliative care','Hospice',
    'عدم الإنعاش','رعاية تلطيفية',
  ],

  // ── MOBILITY ──
  ambulatory: [
    'Ambulatory','Ambulating','Walking','Walks',
    'Ambulant','Mobile','Independent mobility',
    'Walks independently','Ambulates independently',
    'Walks with assistance','Walks with aid',
    'يمشي','متحرك',
  ],
  bedbound: [
    'Bedbound','Bed-bound','Bed bound','Bedridden',
    'Bed rest','Bedrest','Immobile','Immobilized',
    'Unable to ambulate','Cannot walk','Non-ambulatory',
    'طريح الفراش',
  ],
  wheelchair: [
    'Wheelchair','W/C','WC','Wheel chair',
    'Wheelchair bound','In wheelchair',
    'Mobilizes in wheelchair','W/C dependent',
    'كرسي متحرك',
  ],
  stretcher: [
    'Stretcher','Litter','Gurney','Trolley',
    'Stretcher bound','Requires stretcher',
    'Non-ambulatory','Transport by stretcher',
    'نقالة',
  ],
};

// ═══════════════════════════════════════════════════════════════════
// INFERENCE RULES — contextual patterns that imply clinical state
// If OCR reads this pattern → infer this clinical meaning
// ═══════════════════════════════════════════════════════════════════

export const INFERENCE_RULES = [
  // Oxygen status inference
  { pattern: /on\s+(\d+)\s*L/i, infers: 'supplemental_oxygen', extract: 'flow_rate' },
  { pattern: /on\s+(NC|nasal\s*cannula)/i, infers: 'nasal_cannula' },
  { pattern: /on\s+(NRB|non.?rebreather)/i, infers: 'non_rebreather' },
  { pattern: /on\s+(HFNC|high\s*flow)/i, infers: 'high_flow' },
  { pattern: /on\s+(vent|ventilator)/i, infers: 'mechanical_ventilation' },
  { pattern: /on\s+(BiPAP|CPAP|NIV)/i, infers: 'noninvasive_ventilation' },
  { pattern: /on\s+RA|room\s*air/i, infers: 'room_air' },
  { pattern: /FiO2\s*(\d+)/i, infers: 'supplemental_oxygen', extract: 'fio2' },
  { pattern: /SpO2\s*(\d+)/i, infers: 'oxygen_saturation', extract: 'spo2' },
  { pattern: /sats?\s*(\d+)/i, infers: 'oxygen_saturation', extract: 'spo2' },

  // Antibiotic inference → active infection
  { pattern: /day\s*(\d+)\s*(of\s+)?(\w+)/i, infers: 'active_treatment', extract: 'day_drug' },
  { pattern: /D(\d+)\s+(\w+)/i, infers: 'active_treatment', extract: 'day_drug' },
  { pattern: /started\s+on\s+(\w+)/i, infers: 'new_treatment' },
  { pattern: /completed\s+(\d+)\s*days?\s*(of\s+)?(\w+)/i, infers: 'completed_course' },

  // Vital sign inference
  { pattern: /BP\s*(\d+)\s*[\/\\]\s*(\d+)/i, infers: 'blood_pressure', extract: 'bp' },
  { pattern: /HR\s*(\d+)/i, infers: 'heart_rate', extract: 'hr' },
  { pattern: /RR\s*(\d+)/i, infers: 'respiratory_rate', extract: 'rr' },
  { pattern: /T(?:emp)?\s*(\d+\.?\d*)/i, infers: 'temperature', extract: 'temp' },
  { pattern: /GCS\s*(\d+)/i, infers: 'consciousness_level', extract: 'gcs' },

  // Lab value inference
  { pattern: /Hb\s*(\d+\.?\d*)/i, infers: 'hemoglobin', extract: 'value' },
  { pattern: /WBC\s*(\d+\.?\d*)/i, infers: 'white_cell_count', extract: 'value' },
  { pattern: /Cr\s*(\d+\.?\d*)/i, infers: 'creatinine', extract: 'value' },
  { pattern: /K\s*(\d+\.?\d*)/i, infers: 'potassium', extract: 'value' },
  { pattern: /Na\s*(\d+)/i, infers: 'sodium', extract: 'value' },
  { pattern: /lactate\s*(\d+\.?\d*)/i, infers: 'lactate', extract: 'value' },
  { pattern: /trop(?:onin)?\s*(\d+\.?\d*)/i, infers: 'troponin', extract: 'value' },
  { pattern: /INR\s*(\d+\.?\d*)/i, infers: 'inr', extract: 'value' },
  { pattern: /pH\s*(\d+\.?\d*)/i, infers: 'acid_base', extract: 'ph' },

  // Functional status inference
  { pattern: /independent/i, infers: 'independent' },
  { pattern: /dependent/i, infers: 'dependent' },
  { pattern: /requires\s+assist/i, infers: 'needs_assistance' },
  { pattern: /with\s+(walker|cane|crutch|wheelchair|W\/C)/i, infers: 'assistive_device' },

  // Disposition inference
  { pattern: /for\s+discharge/i, infers: 'discharge_planned' },
  { pattern: /plan.*discharge/i, infers: 'discharge_planned' },
  { pattern: /medically\s*(fit|ready|optimized|clear)/i, infers: 'medically_fit' },
  { pattern: /barrier.*discharge/i, infers: 'discharge_barrier' },
  { pattern: /pending\s+(social|placement|SNF|rehab)/i, infers: 'awaiting_placement' },

  // Acuity inference
  { pattern: /ICU|critical\s*care|intensive\s*care/i, infers: 'icu_level' },
  { pattern: /step\s*down|intermediate|progressive/i, infers: 'stepdown_level' },
  { pattern: /floor|ward|general/i, infers: 'ward_level' },

  // Diet inference
  { pattern: /NPO|nil\s*(?:per\s*os|by\s*mouth)/i, infers: 'npo' },
  { pattern: /clear\s*liquid/i, infers: 'clear_liquids' },
  { pattern: /regular\s*diet/i, infers: 'regular_diet' },
  { pattern: /diabetic\s*diet/i, infers: 'diabetic_diet' },
  { pattern: /renal\s*diet/i, infers: 'renal_diet' },
  { pattern: /cardiac\s*diet/i, infers: 'cardiac_diet' },
  { pattern: /low\s*salt|low\s*sodium/i, infers: 'low_salt' },
  { pattern: /fluid\s*restrict/i, infers: 'fluid_restriction' },
];

// ═══════════════════════════════════════════════════════════════════
// COLLOQUIAL → FORMAL — patient/nurse informal language
// ═══════════════════════════════════════════════════════════════════

export const COLLOQUIAL_MAP = {
  // Patient language → clinical terms
  'sugar': 'diabetes',
  'sugar disease': 'diabetes',
  'sugar level': 'blood glucose',
  'high sugar': 'hyperglycemia',
  'low sugar': 'hypoglycemia',
  'pressure': 'hypertension',
  'high pressure': 'hypertension',
  'low pressure': 'hypotension',
  'heart attack': 'myocardial infarction',
  'stroke': 'cerebrovascular accident',
  'mini stroke': 'transient ischemic attack',
  'blood clot': 'thrombosis',
  'clot in lung': 'pulmonary embolism',
  'clot in leg': 'deep vein thrombosis',
  'kidney failure': 'renal failure',
  'kidney stones': 'nephrolithiasis',
  'liver failure': 'hepatic failure',
  'lung infection': 'pneumonia',
  'water on lungs': 'pulmonary edema',
  'fluid on lungs': 'pleural effusion',
  'water infection': 'urinary tract infection',
  'urine infection': 'urinary tract infection',
  'blood poisoning': 'sepsis',
  'fits': 'seizures',
  'blackout': 'syncope',
  'passed out': 'syncope',
  'dizzy': 'dizziness',
  'breathing difficulty': 'dyspnea',
  'can\'t breathe': 'dyspnea',
  'short of breath': 'dyspnea',
  'throwing up': 'vomiting',
  'being sick': 'vomiting',
  'the runs': 'diarrhea',
  'belly ache': 'abdominal pain',
  'tummy pain': 'abdominal pain',
  'chest tightness': 'chest pain',
  'funny turn': 'presyncope',
  'fall': 'fall',
  'broken bone': 'fracture',
  'broken hip': 'hip fracture',
  'water pills': 'diuretics',
  'blood thinner': 'anticoagulant',
  'pain killer': 'analgesic',
  'sleeping pills': 'sedative',
  'sugar tablets': 'oral hypoglycemic',
  'puffer': 'inhaler',
  'drip': 'intravenous infusion',
  'jab': 'injection',
  'tube down throat': 'endotracheal intubation',
  'breathing machine': 'ventilator',
  'kidney machine': 'dialysis',
  'scan': 'imaging',
  'blood test': 'laboratory investigation',
  'urine test': 'urinalysis',
  // Arabic colloquial
  'سكر': 'diabetes',
  'ضغط': 'hypertension',
  'كلى': 'renal',
  'قلب': 'cardiac',
  'كبد': 'hepatic',
  'مخ': 'neurological',
  'عظام': 'orthopedic',
  'جراحة': 'surgical',
  'طوارئ': 'emergency',
  'عناية': 'intensive care',
};

// ═══════════════════════════════════════════════════════════════════
// LOADER — injects semantic intelligence into learner models
// ═══════════════════════════════════════════════════════════════════

export function loadSemanticSeedData(models) {
  // Build synonym index — for every term, store its canonical concept
  if (!models.synonymIndex) models.synonymIndex = {};
  for (const [concept, terms] of Object.entries(SYNONYM_MAP)) {
    for (const term of terms) {
      const key = term.toLowerCase().trim();
      if (key.length < 1) continue;
      models.synonymIndex[key] = {
        concept,
        canonical: terms[1] || terms[0], // second entry is usually the formal name
        allTerms: terms.length,
      };
    }
  }

  // Build colloquial index
  if (!models.colloquialIndex) models.colloquialIndex = {};
  for (const [informal, formal] of Object.entries(COLLOQUIAL_MAP)) {
    models.colloquialIndex[informal.toLowerCase()] = formal;
  }

  // Store inference rules as serializable patterns
  if (!models.inferencePatterns) models.inferencePatterns = [];
  models.inferencePatterns = INFERENCE_RULES.map(rule => ({
    pattern: rule.pattern.source,
    flags: rule.pattern.flags,
    infers: rule.infers,
    extract: rule.extract || null,
  }));

  models.semanticSeeded = true;
  return models;
}

// ═══════════════════════════════════════════════════════════════════
// QUERY API — semantic interpretation functions
// ═══════════════════════════════════════════════════════════════════

// Find the canonical concept for any clinical term
export function resolveConceptSynonym(text) {
  if (!text) return null;
  const key = text.toLowerCase().trim();

  // Direct lookup
  const models = _getModels();
  const entry = models?.synonymIndex?.[key];
  if (entry) return entry;

  // Try without common prefixes/suffixes
  const stripped = key.replace(/^(acute|chronic|severe|mild|moderate|bilateral|left|right|upper|lower)\s+/i, '');
  const entry2 = models?.synonymIndex?.[stripped];
  if (entry2) return entry2;

  return null;
}

// Translate colloquial/patient language to formal clinical terms
export function translateColloquial(text) {
  if (!text) return null;
  const models = _getModels();
  const key = text.toLowerCase().trim();
  return models?.colloquialIndex?.[key] || null;
}

// Run inference rules on a text string
export function inferFromText(text) {
  if (!text) return [];
  const results = [];
  for (const rule of INFERENCE_RULES) {
    const match = text.match(rule.pattern);
    if (match) {
      results.push({
        infers: rule.infers,
        extract: rule.extract,
        match: match[0],
        groups: match.slice(1),
      });
    }
  }
  return results;
}

// Check if two terms are synonyms of the same concept
export function areSynonyms(term1, term2) {
  const c1 = resolveConceptSynonym(term1);
  const c2 = resolveConceptSynonym(term2);
  if (!c1 || !c2) return false;
  return c1.concept === c2.concept;
}

// Private: get models (import-safe)
function _getModels() {
  try {
    return JSON.parse(localStorage.getItem('ocr_learned_models') || 'null');
  } catch { return null; }
}
