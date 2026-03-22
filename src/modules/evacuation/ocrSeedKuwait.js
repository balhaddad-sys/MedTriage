// OCR Seed — Kuwait/Gulf Hospital Intelligence
// Mubarak Al-Kabeer Hospital specific + MOH Kuwait + Gulf healthcare patterns
// This file teaches the system how Kuwaiti hospitals actually work —
// ward naming, team structures, formulary, local disease patterns,
// Arabic clinical shorthand, handwriting conventions, stamp formats

// ═══════════════════════════════════════════════════════════════════
// KUWAIT HOSPITAL WARD NAMES & BED FORMATS
// ═══════════════════════════════════════════════════════════════════

export const KUWAIT_WARDS = [
  // Mubarak Al-Kabeer Hospital wards
  'Med-1','Med-2','Med-3','Med-4','Med-5','Med-6',
  'Surg-1','Surg-2','Surg-3','Surg-4',
  'Ortho-1','Ortho-2','OB-1','OB-2','GYN-1',
  'Peds-1','Peds-2','NICU','PICU',
  'ICU-1','ICU-2','CCU','HDU','MICU','SICU',
  'ER','ED','Emergency','Casualty',
  'Burns Unit','Burn Ward','Dialysis Unit','Renal Unit',
  'Oncology','Onc','Chemo Unit','BMT',
  'ENT','Ophthalmology','Ophthal','Dermatology','Derm',
  'Neuro Ward','Neurology','Cardiology Ward','Cardio',
  'Respiratory Ward','Chest Ward',
  'Private Ward','VIP Ward','Royal Ward',
  // Other Kuwait hospitals
  'Amiri Hospital','Al-Amiri',
  'Farwaniya Hospital','Al-Farwaniya',
  'Jahra Hospital','Al-Jahra',
  'Adan Hospital','Al-Adan',
  'Sabah Hospital','Al-Sabah',
  'Chest Hospital','Chest Diseases Hospital',
  'Maternity Hospital','NBK Children Hospital',
  'Kuwait Cancer Control Center','KCCC',
  'Ibn Sina Hospital','Physical Medicine',
  'Razi Hospital','Psychiatric Hospital',
  'Jaber Al-Ahmad Hospital',
  // Ward numbering — Kuwait style
  'Ward 1','Ward 2','Ward 3','Ward 4','Ward 5','Ward 6','Ward 7',
  'Ward 8','Ward 9','Ward 10','Ward 11','Ward 12',
  'Ward 13','Ward 14','Ward 15','Ward 16','Ward 17','Ward 18',
  'Ward 19','Ward 20','Ward 21','Ward 22','Ward 23','Ward 24',
  'W1','W2','W3','W4','W5','W6','W7','W8','W9','W10',
  'W11','W12','W13','W14','W15','W16','W17','W18','W19','W20',
  // Floor/Room — Kuwait format: "Floor-Room-Bed" e.g., "4-301-A"
  'Floor 1','Floor 2','Floor 3','Floor 4','Floor 5','Floor 6',
  'Ground Floor','GF','Basement','B1','B2',
  // Arabic ward names
  'جناح الباطنة','جناح الجراحة','جناح العظام',
  'العناية المركزة','الطوارئ','غرفة العمليات',
  'جناح الأطفال','جناح النساء والولادة',
  'وحدة القلب','وحدة الكلى','وحدة الغسيل',
];

export const KUWAIT_BED_FORMATS = [
  // Standard: "Room-Bed" (e.g., "301-A", "415-2")
  // Floor prefix: "4-301-A"
  // Simple: "Bed 5", "B5", "Bed-5"
  // ICU: "ICU-1", "CCU-3", "HDU-2"
  // ER: "ER-Resus-1", "ER-Major-3", "ER-Minor-7"
  // Kuwait style: "E-M-03" (Wing-Gender-Number)
  'A','B','C','D','E', // wings
  'M','F', // gender sections
  'Resus','Resuscitation','Major','Minor','Triage','Obs','Observation',
  'Bay','Cubicle','Trolley','Chair',
  'Isolation','Iso','Side Room','Single Room',
];

// ═══════════════════════════════════════════════════════════════════
// KUWAIT MEDICAL STAFF TITLES & HIERARCHY
// ═══════════════════════════════════════════════════════════════════

export const STAFF_TITLES = [
  // English
  'Consultant','Senior Consultant','Associate Consultant',
  'Specialist','Senior Specialist',
  'Registrar','Senior Registrar',
  'Resident','Senior Resident','Junior Resident',
  'Intern','House Officer','HO','SHO','Senior House Officer',
  'Fellow','Clinical Fellow','Research Fellow',
  'Head of Department','HOD','Chairman','Vice Chairman',
  'Medical Director','Clinical Director',
  'Chief Resident','Chief of Staff',
  'Attending','Attending Physician',
  // Nursing
  'Charge Nurse','Head Nurse','Staff Nurse','Senior Staff Nurse',
  'Nursing Supervisor','Nurse Manager','Nurse Educator',
  'Clinical Nurse Specialist','CNS',
  'Nurse Practitioner','NP',
  'Licensed Practical Nurse','LPN',
  'Nursing Assistant','NA','Healthcare Assistant','HCA',
  'Student Nurse',
  // Allied Health
  'Pharmacist','Clinical Pharmacist','Senior Pharmacist',
  'Physiotherapist','Senior Physiotherapist',
  'Occupational Therapist','Speech Therapist','SLP',
  'Dietitian','Clinical Dietitian','Senior Dietitian',
  'Social Worker','Medical Social Worker',
  'Respiratory Therapist','RT',
  'Radiographer','Sonographer',
  'Lab Technician','Lab Technologist',
  'Phlebotomist',
  // Arabic titles
  'استشاري','أخصائي','أخصائي أول','مقيم','مقيم أول',
  'طبيب امتياز','رئيس القسم','نائب رئيس القسم',
  'ممرض','ممرضة','ممرض مسؤول','مشرف تمريض',
  'صيدلي','صيدلانية','أخصائي تغذية',
  'أخصائي علاج طبيعي','أخصائي اجتماعي',
  // Common abbreviations
  'Dr.','Dr','Prof.','Prof','Assoc. Prof',
  'MRCP','FRCP','FRCPI','MRCS','FRCS',
  'MD','MBBS','MBChB','DO',
  'FACP','FCCP','FACS','FRCOG',
  'ABIM','ABP','ABS',
  'Board Certified','Fellowship Trained',
  'Diploma','DCH','DGO','DA',
];

// ═══════════════════════════════════════════════════════════════════
// GULF-PREVALENT DISEASES — higher incidence in Kuwait/Gulf
// ═══════════════════════════════════════════════════════════════════

export const GULF_DISEASES = [
  // Very high prevalence in Kuwait
  'Type 2 diabetes','T2DM','Obesity','Morbid obesity','Metabolic syndrome',
  'Hypertension','Dyslipidemia','Hyperlipidemia',
  'Coronary artery disease','CAD','Ischemic heart disease','IHD',
  'Non-alcoholic fatty liver disease','NAFLD','NASH',
  'Vitamin D deficiency','Osteoporosis',
  'Chronic kidney disease','Diabetic nephropathy','Diabetic retinopathy',
  'Diabetic neuropathy','Diabetic foot','Charcot foot',
  'Peripheral arterial disease','PAD',
  'Obstructive sleep apnea','OSA',
  // Genetic conditions common in Gulf
  'Sickle cell disease','SCD','Sickle cell trait','SCT',
  'Thalassemia','Beta-thalassemia','Alpha-thalassemia',
  'G6PD deficiency','Favism',
  'Familial Mediterranean fever','FMF',
  'Familial hypercholesterolemia','FH',
  'Consanguinity-related conditions',
  // Regional infections
  'MERS-CoV','MERS','Middle East Respiratory Syndrome',
  'Brucellosis','Cutaneous leishmaniasis','Visceral leishmaniasis',
  'Tuberculosis','TB','Latent TB','LTBI',
  'Hepatitis B','HBV','Hepatitis C','HCV',
  'COVID-19','Long COVID','Post-COVID syndrome',
  // Heat-related
  'Heat exhaustion','Heat stroke','Dehydration',
  'Hyperthermia','Rhabdomyolysis',
  // Lifestyle
  'Shisha-related lung disease','Hookah lung',
  'E-cigarette lung injury','EVALI',
  'Road traffic accident','RTA','High-speed RTA',
  'Construction injury','Fall from height',
  // Common surgical presentations Kuwait
  'Laparoscopic cholecystectomy','Lap chole',
  'Bariatric surgery','Sleeve gastrectomy','Gastric bypass',
  'Diabetic foot amputation','Below knee amputation',
  'AV fistula creation','Dialysis access',
  'Coronary artery bypass','PCI','Cardiac catheterization',
];

// ═══════════════════════════════════════════════════════════════════
// ARABIC CLINICAL SHORTHAND — what Kuwaiti doctors actually write
// ═══════════════════════════════════════════════════════════════════

export const ARABIC_SHORTHAND = {
  // Transliterated Arabic that appears on handwritten notes
  'sakkar': 'Diabetes',
  'sakkar 2': 'Type 2 Diabetes',
  'daght': 'Hypertension',
  'kolesterol': 'Hyperlipidemia',
  'galb': 'Cardiac',
  'kilya': 'Renal',
  'kibid': 'Hepatic',
  'ri2a': 'Lung/Pulmonary',
  'mo5': 'Brain/Neuro',
  'dam': 'Blood',
  'ghasseel': 'Dialysis',
  'tha3lab': 'Alopecia',
  'hasasiya': 'Allergy',
  'iltihab': 'Inflammation/Infection',
  'waram': 'Tumor/Swelling',
  'kasr': 'Fracture',
  '7arara': 'Fever/Temperature',
  'alam': 'Pain',
  'so3al': 'Cough',
  'ishal': 'Diarrhea',
  'imsak': 'Constipation',
  'taqay2o': 'Vomiting',
  'dawkha': 'Dizziness',
  'ighmaa': 'Syncope/Fainting',
  'ta3ab': 'Fatigue',
  'nafas': 'Breathing',
  'deek nafas': 'Shortness of breath',
  'sadr': 'Chest',
  'batn': 'Abdomen',
  'ra2s': 'Head',
  'dahir': 'Back',
  'mafsal': 'Joint',
  'athm': 'Bone',
  'jild': 'Skin',
  '3ain': 'Eye',
  '2uthn': 'Ear',
  'anf': 'Nose',
  'halq': 'Throat',
  'thabee7': 'Slaughter/hemorrhage (colloquial for severe bleeding)',
  'dagt il dam': 'Blood pressure',
  'nisbat il sakkar': 'Blood sugar level',
  'ta7leel': 'Lab test/Analysis',
  'ash3a': 'X-ray/Imaging',
  'amaliya': 'Surgery/Operation',
  'takhder': 'Anesthesia',
  'ghurza': 'Stitch/Suture',
  'jibs': 'Cast/Plaster',
  'ibra': 'Injection/Needle',
  'mughathi': 'IV drip',
  'dawa': 'Medicine/Drug',
  '7abba': 'Tablet/Pill',
  'marhim': 'Ointment/Cream',
  'qatrah': 'Eye drops',
  'bakhakh': 'Inhaler/Spray',
  'ta7weel': 'Transfer/Referral',
  'khorooj': 'Discharge',
  'id5al': 'Admission',
  'tanweem': 'Admission (hospitalization)',
  'isti3jal': 'Emergency/Urgent',
  'mosta3jal': 'Emergency/Urgent',
  'mustashfa': 'Hospital',
  '3iada': 'Clinic',
  'maw3id': 'Appointment',
  'muraja3a': 'Follow-up/Review',
  'taqreer': 'Report',
  'nateeja': 'Result',
  // Common compound phrases
  'iltihab bil ri2a': 'Pneumonia',
  'jalta fil galb': 'Heart attack/MI',
  'jalta fil mo5': 'Stroke/CVA',
  'fashal kilawi': 'Renal failure',
  'fashal qalbi': 'Heart failure',
  'irtifa3 il daght': 'Hypertension',
  'irtifa3 il sakkar': 'Hyperglycemia',
  'inkhifath il sakkar': 'Hypoglycemia',
  'qusoor kilawi': 'CKD',
  'qusoor tanaffusi': 'Respiratory failure',
  'iltihab masalik bawliya': 'UTI',
  'saratan': 'Cancer',
  'khabeeth': 'Malignant',
  'saleem': 'Benign',
  'muzmin': 'Chronic',
  '7aad': 'Acute',
  'musta8ir': 'Stable',
  'mutadahwir': 'Deteriorating',
  'muta7assin': 'Improving',
};

// ═══════════════════════════════════════════════════════════════════
// KUWAIT MOH FORMS & STAMPS — what appears on official documents
// ═══════════════════════════════════════════════════════════════════

export const MOH_PATTERNS = [
  // Stamp text
  'Ministry of Health','MOH','وزارة الصحة',
  'State of Kuwait','دولة الكويت',
  'Kuwait Health','Public Authority',
  'PACI','Public Authority for Civil Information',
  'الهيئة العامة للمعلومات المدنية',
  // Hospital stamps
  'Mubarak Al-Kabeer Hospital','مستشفى مبارك الكبير',
  'Al-Amiri Hospital','مستشفى الأميري',
  'Al-Farwaniya Hospital','مستشفى الفروانية',
  'Al-Jahra Hospital','مستشفى الجهراء',
  'Al-Adan Hospital','مستشفى العدان',
  'Al-Sabah Hospital','مستشفى الصباح',
  'Jaber Al-Ahmad Hospital','مستشفى جابر الأحمد',
  // Form fields
  'Patient Name','اسم المريض',
  'Civil ID','الرقم المدني',
  'File Number','رقم الملف','MRN',
  'Date of Birth','تاريخ الميلاد','DOB',
  'Nationality','الجنسية',
  'Gender','Sex','الجنس',
  'Blood Group','فصيلة الدم',
  'Date of Admission','تاريخ الدخول',
  'Date of Discharge','تاريخ الخروج',
  'Ward','الجناح','القسم',
  'Bed Number','رقم السرير',
  'Attending Physician','الطبيب المعالج',
  'Diagnosis','التشخيص',
  'Signature','التوقيع',
  'Stamp','الختم',
  'Date','التاريخ',
  'Time','الوقت',
  // Order forms
  'Medication Order','أمر الدواء',
  'Laboratory Request','طلب مختبر',
  'Radiology Request','طلب أشعة',
  'Consultation Request','طلب استشارة',
  'Blood Request','طلب دم',
  'Consent Form','نموذج موافقة',
  'Discharge Summary','ملخص الخروج',
  'Death Certificate','شهادة وفاة',
  'Birth Certificate','شهادة ميلاد',
  'Sick Leave','إجازة مرضية',
  'Medical Report','تقرير طبي',
  'Transfer Form','نموذج تحويل',
  'Incident Report','تقرير حادث',
];

// ═══════════════════════════════════════════════════════════════════
// TIME & DATE PATTERNS — Kuwait format
// ═══════════════════════════════════════════════════════════════════

export const TIME_DATE_PATTERNS = [
  // Date formats used in Kuwait
  // DD/MM/YYYY (standard), DD-MM-YYYY, YYYY/MM/DD
  // Hijri dates also appear
  // Time: 24-hour format standard in hospitals
  'AM','PM','am','pm',
  'morning','afternoon','evening','night','overnight',
  'day shift','night shift','evening shift',
  'صباح','مساء','ليل',
  'shift change','handover time',
  'pre-op','intra-op','post-op',
  'Day 0','Day 1','Day 2','Day 3','Day 4','Day 5',
  'Day 6','Day 7','Day 8','Day 9','Day 10',
  'POD 0','POD 1','POD 2','POD 3','POD 4','POD 5',
  'Post-op day','Post-operative day',
  'HD 1','HD 2','HD 3','Hospital day',
  'Admission day','Discharge day',
  'Week 1','Week 2','Month 1',
  'q1h','q2h','q4h','q6h','q8h','q12h','q24h',
  'hourly','every 2 hours','every 4 hours','every 6 hours',
  'every 8 hours','every 12 hours','once daily','twice daily',
  'three times daily','four times daily',
  'before meals','after meals','at bedtime','with meals',
  'on waking','at noon','at midnight',
  'STAT','immediately','urgent','routine','elective',
  'within 1 hour','within 4 hours','within 24 hours',
  'today','tomorrow','yesterday','next week',
  'اليوم','غداً','أمس','الأسبوع القادم',
];

// ═══════════════════════════════════════════════════════════════════
// HANDWRITING RECOGNITION PATTERNS
// Common ways doctors write that confuse OCR
// ═══════════════════════════════════════════════════════════════════

export const HANDWRITING_CORRECTIONS = {
  // Doctor handwriting → what they meant
  // Slashed zeros and ones
  'Ø': '0', 'ø': '0',
  // Common scrawl patterns
  'pt': 'patient',
  'pts': 'patients',
  'hx': 'history',
  'sx': 'symptoms',
  'tx': 'treatment',
  'rx': 'prescription',
  'dx': 'diagnosis',
  'fx': 'fracture',
  'bx': 'biopsy',
  'cx': 'culture',
  'ix': 'investigations',
  'mx': 'management',
  'nx': 'nursing',
  'ox': 'oxygen',
  'ax': 'assessment',
  'ex': 'examination',
  'gx': 'gravida',
  'px': 'prognosis',
  // Symbols doctors use
  '→': 'leads to',
  '←': 'due to',
  '↑': 'increased',
  '↓': 'decreased',
  '↔': 'unchanged',
  '∆': 'change',
  '±': 'with or without',
  '~': 'approximately',
  '>': 'greater than',
  '<': 'less than',
  '>>': 'much greater than',
  '<<': 'much less than',
  '+': 'positive',
  '-': 'negative',
  '++': 'strongly positive',
  '+++': 'very strongly positive',
  '+/-': 'equivocal',
  'c̄': 'with',
  's̄': 'without',
  'p̄': 'after',
  'ā': 'before',
  // Numbers that look like letters
  'l': '1',  // in numeric contexts
  'O': '0',  // in numeric contexts
  'S': '5',  // in numeric contexts
  'Z': '2',  // in numeric contexts
  // Common misspellings in hurried writing
  'recurrance': 'recurrence',
  'occurrance': 'occurrence',
  'seperate': 'separate',
  'definately': 'definitely',
  'necessarry': 'necessary',
  'accomodation': 'accommodation',
  'referal': 'referral',
  'referall': 'referral',
  'transfered': 'transferred',
  'occured': 'occurred',
  'recieved': 'received',
  'acheived': 'achieved',
  'concious': 'conscious',
  'unconciuos': 'unconscious',
  'diarrhoea': 'diarrhea',
  'haemorrhage': 'hemorrhage',
  'oedema': 'edema',
  'anaemia': 'anemia',
  'paediatric': 'pediatric',
  'orthopaedic': 'orthopedic',
  'gynaecology': 'gynecology',
  'oesophagus': 'esophagus',
  'foetus': 'fetus',
  'colour': 'color',
  'honour': 'honor',
  'favour': 'favor',
  'behaviour': 'behavior',
  'programme': 'program',
  'centre': 'center',
  'litre': 'liter',
  'metre': 'meter',
  'fibre': 'fiber',
  'defence': 'defense',
  'licence': 'license',
  'practise': 'practice',
  'organise': 'organize',
  'recognise': 'recognize',
  'specialise': 'specialize',
  'hospitalise': 'hospitalize',
  'stabilise': 'stabilize',
  'optimise': 'optimize',
  'mobilise': 'mobilize',
  'catheterise': 'catheterize',
  'cauterise': 'cauterize',
  'anaesthetist': 'anesthesiologist',
  'anaesthesia': 'anesthesia',
};

// ═══════════════════════════════════════════════════════════════════
// LOADER
// ═══════════════════════════════════════════════════════════════════

export function loadKuwaitSeedData(models) {
  const now = new Date().toISOString();

  // Kuwait wards
  for (const ward of KUWAIT_WARDS) {
    const key = ward.toLowerCase ? ward.toLowerCase() : ward;
    if (!models.wards) models.wards = {};
    if (!models.wards[key]) {
      models.wards[key] = { count: 3, entity: 'WARD', lastSeen: now, seeded: true };
    }
    // Also add to diagnoses for general recognition
    if (!models.diagnoses[key]) {
      models.diagnoses[key] = { count: 1, entity: 'WARD', lastSeen: now, confidence: 0.70, seeded: true };
    }
  }

  // Staff titles
  for (const title of STAFF_TITLES) {
    const key = title.toLowerCase();
    if (!models.doctors) models.doctors = {};
    if (!models.doctors[key]) {
      models.doctors[key] = { count: 1, entity: 'STAFF_TITLE', lastSeen: now, seeded: true };
    }
  }

  // Gulf diseases
  for (const dx of GULF_DISEASES) {
    const key = dx.toLowerCase();
    if (!models.diagnoses[key]) {
      models.diagnoses[key] = { count: 3, entity: 'DIAGNOSIS', lastSeen: now, confidence: 0.78, seeded: true };
    }
  }

  // Arabic shorthand → corrections
  for (const [shorthand, meaning] of Object.entries(ARABIC_SHORTHAND)) {
    if (!models.corrections[shorthand]) {
      models.corrections[shorthand] = {
        truth: meaning, count: 3, entity: 'CLINICAL', confidence: 0.82, seeded: true,
      };
    }
    // Also add to colloquial index if semantic models exist
    if (models.colloquialIndex) {
      models.colloquialIndex[shorthand] = meaning;
    }
  }

  // MOH patterns
  for (const pattern of MOH_PATTERNS) {
    const key = pattern.toLowerCase ? pattern.toLowerCase() : pattern;
    if (key.length >= 2 && !models.diagnoses[key]) {
      models.diagnoses[key] = { count: 1, entity: 'FORM_FIELD', lastSeen: now, confidence: 0.55, seeded: true };
    }
  }

  // Time/date patterns
  for (const pattern of TIME_DATE_PATTERNS) {
    const key = pattern.toLowerCase();
    if (key.length >= 2 && !models.diagnoses[key]) {
      models.diagnoses[key] = { count: 1, entity: 'TEMPORAL', lastSeen: now, confidence: 0.50, seeded: true };
    }
  }

  // Handwriting corrections
  for (const [wrong, right] of Object.entries(HANDWRITING_CORRECTIONS)) {
    if (wrong.length >= 2 && !models.corrections[wrong]) {
      models.corrections[wrong] = {
        truth: right, count: 2, entity: 'CLINICAL', confidence: 0.78, seeded: true,
      };
    }
  }

  models.kuwaitSeeded = true;
  return models;
}
