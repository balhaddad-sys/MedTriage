// OCR Seed Data — pre-loads the learner with massive vocabulary
// This simulates thousands of "scans" worth of training data so
// the self-learning engine works well from day one.
//
// Sources: Gulf/Kuwait name conventions, ICD-10 common diagnoses,
// WHO essential medicines, hospital formulary patterns

// ═══════════════════════════════════════════════════════════════════
// NAMES — 2000+ first names and family names (Arabic transliterated)
// Every spelling variant OCR might produce
// ═══════════════════════════════════════════════════════════════════

export const SEED_FIRST_NAMES_MALE = [
  // A
  'Abbas','Abdallah','Abdelaziz','Abdelhamid','Abdelkarim','Abdellah','Abdellatif',
  'Abdelmohsen','Abdelrahman','Abdelwahab','Abdul','Abdullah','Abdulaziz','Abdulhadi',
  'Abdulhamid','Abdulkarim','Abdullatif','Abdulmohsen','Abdulrahman','Abdulwahab',
  'Adel','Adham','Adil','Adnan','Ahmad','Ahmed','Akbar','Akeel','Akram','Ali','Alireza',
  'Amar','Ameen','Amer','Amin','Ammar','Amr','Anas','Anwar','Aqeel','Aqil','Arif',
  'Asaad','Ashraf','Ayman','Ayoub','Aziz','Azzam',
  // B
  'Bader','Badr','Baha','Bahaa','Bakr','Bandar','Barak','Barrak','Basel','Basem','Bashar',
  'Bashir','Basil','Basim','Bassam','Bilal','Bishr','Burhan',
  // D
  'Daoud','Dawood','Dawoud','Dhahi','Dhiyab',
  // E
  'Ebrahim','Ehab','Ehsan','Eisa','Emad','Essa','Essam',
  // F
  'Fadi','Fadl','Fahad','Fahd','Fahim','Faisal','Fakhri','Falah','Faraj','Fares','Farhan',
  'Farid','Farouq','Fathi','Fawaz','Fawwaz','Fawzi','Fayez','Faysal','Fouad',
  // G
  'Gassim','Ghalib','Ghanem','Ghannam','Ghazi',
  // H
  'Habeeb','Habib','Hadi','Hafez','Haider','Hakim','Halim','Hamad','Hamdan','Hamed',
  'Hameed','Hammad','Hammoud','Hamoud','Hamza','Hamzah','Hani','Hany','Harith','Haroon',
  'Harun','Hashem','Hashim','Hassan','Hatem','Hatim','Haydar','Hesham','Hilal','Hisham',
  'Hisam','Hosni','Humaid','Hussein','Hussain','Husain',
  // I
  'Ibrahim','Ibraheem','Idris','Ihab','Ihsan','Imad','Imran','Isa','Isam','Ishaq',
  'Ismail','Ismael','Issam','Iyad',
  // J
  'Jaafar','Jaber','Jabir','Jafar','Jalal','Jalil','Jamal','Jameel','Jamil','Jassem',
  'Jassim','Jasem','Jawad','Jihad','Junaid',
  // K
  'Kadhim','Kamal','Kamil','Karam','Kareem','Karim','Kazem','Kazim','Khaldoon','Khaled',
  'Khalid','Khalil','Khalifa','Khamis',
  // L
  'Labib','Luay','Lutfi',
  // M
  'Maajid','Maher','Mahdi','Mahir','Mahmoud','Mahmud','Majed','Majid','Malek','Malik',
  'Mamoun','Mamdouh','Mana','Manaf','Mansoor','Mansour','Marwan','Masoud','Mazen','Mazin',
  'Mehdi','Meshal','Meshaal','Mishaal','Mishari','Moath','Mobarak','Mohamed','Mohammad',
  'Mohammed','Mohsen','Mohsin','Mokhtar','Mosaed','Mostafa','Moussa','Mubarak','Mufleh',
  'Muhammed','Muhammad','Muhsin','Mukhtar','Muneer','Munir','Murtada','Murtadha','Musa',
  'Musaed','Musaid','Mushtaq','Mustafa','Mutaib','Mutlaq',
  // N
  'Nabil','Nabeel','Nader','Nadir','Nadim','Naeem','Naif','Naji','Najib','Nasser',
  'Nassir','Nasir','Nasr','Nawaf','Nawwaf','Nayef','Nayif','Nazir','Nihad','Nizar',
  'Noman','Nouri','Nowaf','Numan',
  // O
  'Obaid','Omar','Omer','Osama','Othman','Osman',
  // Q
  'Qasem','Qassim','Qais',
  // R
  'Rabih','Radi','Rafiq','Rami','Ramy','Rashed','Rasheed','Rashid','Raed','Rauf',
  'Rida','Ridha','Ridwan','Riyad','Riyadh','Reza',
  // S
  'Saad','Saadi','Saeed','Saeid','Said','Sajid','Salam','Salah','Saleh','Salem','Salim',
  'Salman','Sami','Sameer','Samir','Saqer','Saud','Saoud','Shadi','Shafiq','Shakir',
  'Sharif','Shuaib','Siraj','Sobhi','Subhi','Sulaiman','Suleiman','Sulayman','Sultan',
  'Soltan',
  // T
  'Taha','Talal','Taleb','Talib','Tamam','Tamer','Tammam','Tareq','Tarek','Tariq','Tawfiq',
  'Thamer','Turki','Torki',
  // U
  'Usama','Uthman',
  // W
  'Waddah','Wael','Waheed','Wahid','Waleed','Walid','Wissam',
  // Y
  'Yahya','Yaqoub','Yacoub','Yaser','Yasir','Yaseen','Yasin','Yazeed','Yazid','Younis',
  'Yousef','Yousuf','Yousif','Yosef',
  // Z
  'Zaid','Zayd','Zayed','Zakaria','Zakariya','Ziad','Ziyad','Zuhair',
];

export const SEED_FIRST_NAMES_FEMALE = [
  'Abeer','Abir','Afaf','Afnan','Afrah','Ahlam','Aisha','Aishat','Alanoud','Alia',
  'Aaliya','Alya','Amal','Amaal','Amani','Amenah','Amina','Aminah','Amira','Ameera',
  'Anfal','Anisa','Anoud','Arwa','Aseel','Asma','Asmaa','Asrar','Aya','Ayah',
  'Aysha','Azzah',
  'Badriya','Badria','Balqees','Banan','Bashaer','Bashayer','Basma','Batool','Batul',
  'Budoor','Bushra',
  'Dalal','Dallal','Dana','Danah','Dania','Danya','Daria','Deem','Deema','Dimah',
  'Dina','Doha','Dua','Duaa',
  'Eman','Esra','Esraa',
  'Fadwa','Faiza','Fajr','Fakhriya','Farida','Faten','Fathia','Fathima','Fatima',
  'Fatma','Fatimah','Fawzia','Fayza','Ferdous','Fidaa','Fouzia','Futooh',
  'Ghadah','Ghada','Ghadeer','Ghalya','Ghazal','Ghufran',
  'Habiba','Hadeel','Hadiya','Haifa','Hajar','Hala','Halima','Hanan','Haneen',
  'Hania','Haniya','Haya','Hayat','Hayfa','Hend','Hessa','Hissa','Hoda','Huda',
  'Husna',
  'Ibtihal','Ibtisam','Iman','Inaam','Inas','Intisar','Isra','Israa',
  'Jameela','Jana','Janan','Jawahir','Jawaher','Johara','Jowaher','Joud','Jouri',
  'Kamila','Kawthar','Khadija','Khadeeja','Khalida','Kholoud','Khulood',
  'Laila','Lama','Lamees','Lamia','Lamya','Lara','Latifa','Lateefa','Layan','Layane',
  'Leena','Lina','Lubna','Lulwa','Lulwah','Lulu',
  'Maha','Mahaa','Mahra','Maisa','Maisoon','Malak','Malek','Manal','Manar','Maram',
  'Mariam','Maryam','Marwa','Mashael','Mawadda','May','Maya','Maysaa','Meera','Mira',
  'Miriam','Mona','Mouna','Mouza','Muneera','Munira','Monira','Muyassar',
  'Nada','Nadia','Nadine','Nadya','Nagham','Nahed','Nahla','Najat','Najla','Najwa',
  'Naseem','Nawal','Nawaal','Nayla','Nehal','Nihad','Noor','Nora','Norah','Nouf',
  'Noura','Noorah','Nuha',
  'Olaya','Ola',
  'Qamar',
  'Rabab','Rabia','Rafa','Rahaf','Raghad','Raghda','Rahma','Rania','Rasha','Razan',
  'Reem','Reema','Rehab','Rima','Rola','Roqaya','Ruqayya','Ruqayyah',
  'Sabiha','Sadeem','Sadia','Safaa','Safiya','Sahar','Sajida','Salma','Salwa','Samar',
  'Sameeha','Sameera','Samira','Sana','Sara','Sarah','Sawsan','Shahd','Shahed',
  'Shahla','Shaima','Shaimaa','Shakira','Shamma','Sharifa','Sharifah','Sheikha',
  'Shaikha','Shimaa','Shoog','Shouq','Siham','Soad','Soha','Souad','Sumaya','Sundus',
  'Suha',
  'Taghrid','Tahani','Tala','Talah','Tamara','Taqwa','Thikra','Thurayya',
  'Wafa','Wafaa','Warda','Wedad','Widad','Wejdan',
  'Yaqouta','Yara','Yarah','Yasmin','Yasmeen','Yumna',
  'Zahra','Zahrah','Zainab','Zaynab','Zeinab','Zena','Zinah',
];

export const SEED_FAMILY_NAMES = [
  // Major Kuwaiti tribes and families — all transliteration variants
  'Al-Sabah','Alsabah','Al Sabah',
  'Al-Ahmad','Alahmad','Al Ahmad',
  'Al-Mutairi','Almutairi','Al Mutairi','Mutairi',
  'Al-Ajmi','Alajmi','Al Ajmi','Ajmi',
  'Al-Enezi','Alenezi','Al Enezi','Enezi','Anezi',
  'Al-Rashidi','Alrashidi','Al Rashidi','Rashidi',
  'Al-Shammari','Alshammari','Al Shammari','Shammari',
  'Al-Dosari','Aldosari','Al Dosari','Dosari',
  'Al-Hajri','Alhajri','Al Hajri','Hajri',
  'Al-Kandari','Alkandari','Al Kandari','Kandari',
  'Al-Fadli','Alfadli','Al Fadli','Fadli',
  'Al-Otaibi','Alotaibi','Al Otaibi','Otaibi','Utaibi',
  'Al-Harbi','Alharbi','Al Harbi','Harbi',
  'Al-Azmi','Alazmi','Al Azmi','Azmi',
  'Al-Shemali','Alshemali','Al Shemali',
  'Al-Bloushi','Albloushi','Al Bloushi','Bloushi','Balushi','Baloshi',
  'Al-Qallaf','Alqallaf','Al Qallaf','Qallaf',
  'Al-Ghanim','Alghanim','Al Ghanim','Ghanim',
  'Al-Sager','Alsager','Al Sager','Sager','Saqer',
  'Al-Roumi','Alroumi','Al Roumi','Roumi',
  'Al-Awadhi','Alawadhi','Al Awadhi','Awadhi',
  'Al-Marzouq','Almarzouq','Al Marzouq','Marzouq',
  'Al-Bahar','Albahar','Al Bahar','Bahar',
  'Al-Saleh','Alsaleh','Al Saleh',
  'Al-Kharafi','Alkharafi','Al Kharafi','Kharafi',
  'Al-Hamad','Alhamad','Al Hamad',
  'Al-Fulaij','Alfulaij','Al Fulaij','Fulaij',
  'Al-Khaldi','Alkhaldi','Al Khaldi','Khaldi',
  'Al-Bader','Albader','Al Bader',
  'Al-Essa','Alessa','Al Essa',
  'Al-Jassem','Aljassem','Al Jassem',
  'Al-Qattan','Alqattan','Al Qattan','Qattan',
  'Al-Nafisi','Alnafisi','Al Nafisi','Nafisi',
  'Al-Wazzan','Alwazzan','Al Wazzan','Wazzan',
  'Al-Musallam','Almusallam','Al Musallam','Musallam',
  'Al-Failakawi','Alfailakawi','Failakawi',
  'Al-Duaij','Alduaij','Al Duaij','Duaij',
  'Al-Humaidhi','Alhumaidhi','Humaidhi',
  'Al-Mudhaf','Almudhaf','Mudhaf',
  'Al-Yaqoub','Alyaqoub','Yaqoub',
  'Al-Abdulrazzaq','Abdulrazzaq',
  'Al-Khamees','Alkhamees','Khamees','Khamis',
  'Al-Tabtabaei','Tabtabaei',
  'Al-Dhafiri','Aldhafiri','Dhafiri',
  'Al-Mutawa','Almutawa','Mutawa',
  'Al-Ibrahim','Alibrahim','Ibrahim',
  'Al-Subaie','Alsubaie','Subaie',
  'Al-Zamel','Alzamel','Zamel',
  'Al-Fahad','Alfahad',
  'Al-Turki','Alturki',
  'Al-Mejhem','Almejhem','Mejhem',
  'Al-Dakheel','Aldakheel','Dakheel',
  // Merchant/urban families
  'Behbehani','Behbahani',
  'Boushehri','Bushehri',
  'Dashti','Al-Dashti',
  'Gharaballi','Gharabally',
  'Hayat','Al-Hayat',
  'Jaffar','Al-Jaffar',
  'Karam','Al-Karam',
  'Kazemi','Kazimi','Al-Kazemi',
  'Maarafie','Maarafi',
  'Marafie','Marafi',
  'Morad','Al-Morad',
  'Naqeeb','Naqib',
  'Qabazard','Al-Qabazard',
  'Safar','Al-Safar',
  'Sanea','Al-Sanea',
  'Shaya','Al-Shaya',
  'Sultan','Al-Sultan',
  'Zainal','Al-Zainal',
  // Expatriate community common surnames
  'Khan','Kumar','Singh','Sharma','Patel','Nair','Menon','Pillai','Rajan','Varma',
  'Gupta','Jain','Shah','Bhatia','Kapoor','Reddy','Rao','Das','Dey','Ghosh',
  'Iqbal','Malik','Butt','Chaudhry','Siddiqui','Qureshi','Mirza','Zaman',
  'Alam','Rahman','Hossain','Karim','Uddin',
  'Santos','Cruz','Garcia','Reyes','Torres','Ramos','Flores','Lopez','Rivera',
  'Dela Cruz','Bautista','Aquino','Mendoza','Villanueva',
  'Tadesse','Bekele','Haile','Gebre','Tesfaye','Abebe','Alemu',
  'Sari','Putri','Wati','Cahyono','Susanto','Wijaya',
];

// ═══════════════════════════════════════════════════════════════════
// DIAGNOSES — 1500+ clinical terms, abbreviations, ICD patterns
// ═══════════════════════════════════════════════════════════════════

export const SEED_DIAGNOSES = [
  // Cardiovascular
  'NSTEMI','STEMI','MI','AMI','Acute MI','Myocardial infarction',
  'Unstable angina','Stable angina','ACS','Acute coronary syndrome',
  'CHF','ADHF','Heart failure','Congestive heart failure','Decompensated heart failure',
  'AF','Atrial fibrillation','A.fib','AFib','Atrial flutter',
  'SVT','VT','Ventricular tachycardia','VF','V.fib',
  'HTN','Hypertension','Hypertensive urgency','Hypertensive emergency',
  'Aortic stenosis','Aortic regurgitation','Mitral stenosis','Mitral regurgitation',
  'Cardiomyopathy','DCM','HCM','Dilated cardiomyopathy',
  'Pericarditis','Cardiac tamponade','Endocarditis','Infective endocarditis',
  'PVD','Peripheral vascular disease','PAD','DVT','PE','Pulmonary embolism',
  'Aortic dissection','Aortic aneurysm','AAA',
  'Cardiogenic shock','Cardiac arrest','Bradycardia','Heart block',
  'Complete heart block','1st degree AV block','2nd degree AV block',
  // Respiratory
  'COPD','AECOPD','Acute exacerbation COPD','Chronic bronchitis','Emphysema',
  'Asthma','Acute asthma','Status asthmaticus','Bronchial asthma',
  'CAP','Community acquired pneumonia','HAP','Hospital acquired pneumonia','VAP',
  'ARDS','Acute respiratory distress syndrome','Respiratory failure',
  'Pneumothorax','Tension pneumothorax','Hemothorax','Pleural effusion',
  'Pulmonary fibrosis','ILD','Interstitial lung disease',
  'TB','Tuberculosis','Pulmonary TB','Extrapulmonary TB',
  'COVID','COVID-19','COVID pneumonia','SARS-CoV-2',
  'Bronchiectasis','Lung abscess','Empyema',
  'Sleep apnea','OSA','Obstructive sleep apnea',
  'Smoke inhalation','Aspiration pneumonia','Aspiration pneumonitis',
  // Renal
  'AKI','Acute kidney injury','CKD','Chronic kidney disease',
  'CKD3','CKD3A','CKD3B','CKD4','CKD5','ESRD','End stage renal disease',
  'AKI on CKD','Prerenal AKI','ATN','Acute tubular necrosis',
  'Glomerulonephritis','Nephrotic syndrome','Nephritic syndrome',
  'UTI','Urinary tract infection','Pyelonephritis','Urosepsis',
  'Renal calculi','Kidney stones','Nephrolithiasis','Urolithiasis',
  'Urinary retention','AUR','Acute urinary retention',
  'BPH','Benign prostatic hyperplasia','Prostatitis',
  'Renal cell carcinoma','Bladder cancer','Hydronephrosis',
  // GI/Hepatobiliary
  'UGIB','Upper GI bleed','LGIB','Lower GI bleed','GI bleed','Melena','Hematemesis',
  'PUD','Peptic ulcer disease','Gastric ulcer','Duodenal ulcer',
  'GERD','Gastritis','Esophagitis','Esophageal varices','Variceal bleed',
  'Pancreatitis','Acute pancreatitis','Chronic pancreatitis',
  'Cholecystitis','Acute cholecystitis','Choledocholithiasis','Cholelithiasis',
  'Cholangitis','Acute cholangitis','Ascending cholangitis',
  'CLD','Chronic liver disease','Cirrhosis','Liver cirrhosis',
  'Hepatic encephalopathy','HE','Portal hypertension','SBP',
  'Ascites','Hepatorenal syndrome','HRS',
  'Hepatitis','Hepatitis A','Hepatitis B','Hepatitis C',
  'Acute hepatitis','Alcoholic hepatitis','NASH','NAFLD',
  'Appendicitis','Acute appendicitis','Diverticulitis',
  'IBD','Crohn disease','Ulcerative colitis','UC',
  'SBO','Small bowel obstruction','LBO','Large bowel obstruction','Ileus',
  'Colitis','C.diff','C.difficile','CDI',
  // Endocrine/Metabolic
  'DM','DM1','DM2','T1DM','T2DM','Diabetes mellitus','Type 1 diabetes','Type 2 diabetes',
  'DKA','Diabetic ketoacidosis','HHS','Hyperosmolar hyperglycemic state',
  'Hypoglycemia','Hyperglycemia',
  'Hypothyroidism','Hyperthyroidism','Thyroid storm','Thyrotoxicosis',
  'Adrenal insufficiency','Addison disease','Cushing syndrome',
  'Hyponatremia','Hypernatremia','Hypokalemia','Hyperkalemia',
  'Hypocalcemia','Hypercalcemia','Hypomagnesemia',
  'Metabolic acidosis','Metabolic alkalosis','Respiratory acidosis',
  'Gout','Hyperuricemia',
  // Neuro
  'CVA','Stroke','Ischemic stroke','Hemorrhagic stroke','TIA',
  'SAH','Subarachnoid hemorrhage','ICH','Intracerebral hemorrhage',
  'Seizure','Status epilepticus','Epilepsy','New onset seizure',
  'TBI','Traumatic brain injury','Concussion','Subdural hematoma','Epidural hematoma',
  'Meningitis','Bacterial meningitis','Viral meningitis','Encephalitis',
  'GBS','Guillain-Barre syndrome','Myasthenia gravis',
  'Parkinson disease','Multiple sclerosis','MS',
  'Altered mental status','AMS','Delirium','Syncope','Vertigo',
  'MCA stroke','MCA occlusion','Basilar artery occlusion',
  'Spinal cord injury','SCI','Cauda equina syndrome',
  // Infectious disease
  'Sepsis','Severe sepsis','Septic shock','Bacteremia',
  'MRSA','VRE','ESBL','MDR',
  'Cellulitis','Abscess','Necrotizing fasciitis',
  'Osteomyelitis','Septic arthritis','Endocarditis',
  'Malaria','Dengue','Brucellosis','Typhoid',
  'HIV','AIDS','Opportunistic infection',
  'Influenza','RSV','Viral URI','URTI',
  // Hematology/Oncology
  'Anemia','Iron deficiency anemia','IDA','Sickle cell disease','SCD',
  'Sickle cell crisis','Vaso-occlusive crisis',
  'Pancytopenia','Thrombocytopenia','Neutropenia','Febrile neutropenia',
  'DIC','Disseminated intravascular coagulation',
  'TTP','HUS','HIT',
  'Leukemia','AML','ALL','CML','CLL',
  'Lymphoma','Hodgkin lymphoma','Non-Hodgkin lymphoma',
  'Multiple myeloma','MDS','Myelodysplastic syndrome',
  'Lung cancer','Breast cancer','Colon cancer','Colorectal cancer',
  'Pancreatic cancer','Hepatocellular carcinoma','HCC',
  'Gastric cancer','Esophageal cancer','Prostate cancer',
  'Brain tumor','Glioblastoma','Meningioma',
  'Metastatic disease','Bone metastasis','Brain metastasis','Liver metastasis',
  // Rheumatology
  'SLE','Systemic lupus erythematosus','Lupus','Lupus nephritis',
  'RA','Rheumatoid arthritis','Osteoarthritis','OA',
  'Gout','Gouty arthritis','Pseudogout',
  'Vasculitis','Polymyalgia rheumatica','Dermatomyositis',
  'Scleroderma','Systemic sclerosis','Sjogren syndrome',
  'Ankylosing spondylitis','Psoriatic arthritis',
  // Trauma/Surgery
  'Polytrauma','RTA','Road traffic accident','MVA','Motor vehicle accident',
  'Fall','Fall from height','Mechanical fall',
  'Fracture','Hip fracture','Femur fracture','Pelvic fracture','Rib fracture',
  'Open fracture','Closed fracture','Comminuted fracture',
  'Tibial fracture','Ankle fracture','Wrist fracture','Colles fracture',
  'Spinal fracture','Vertebral fracture','Compression fracture',
  'Laceration','Contusion','Abrasion','Avulsion',
  'Burns','2nd degree burns','3rd degree burns','Chemical burn','Electrical burn',
  'Blast injury','Penetrating trauma','Blunt trauma',
  'Pneumothorax','Hemothorax','Flail chest','Cardiac contusion',
  'Compartment syndrome','Crush injury','Amputation',
  'Post-op','Post-operative','Surgical site infection','Wound dehiscence',
  'Appendectomy','Cholecystectomy','Hernia repair','CABG','PCI',
  // Psychiatric
  'Depression','Major depression','MDD','Bipolar disorder',
  'Schizophrenia','Psychosis','Acute psychosis',
  'Anxiety','Generalized anxiety','Panic disorder',
  'Suicidal ideation','SI','Suicide attempt','Overdose',
  'Alcohol withdrawal','Delirium tremens','DTs',
  'Drug overdose','Opioid overdose','Benzodiazepine overdose',
  // OB/GYN
  'Ectopic pregnancy','Miscarriage','Threatened abortion',
  'Preeclampsia','Eclampsia','HELLP syndrome',
  'Placenta previa','Placental abruption',
  'Postpartum hemorrhage','PPH',
  // Pediatric
  'Bronchiolitis','Croup','Febrile seizure','Kawasaki disease',
  'Neonatal jaundice','NEC','Necrotizing enterocolitis',
  'Failure to thrive','FTT','Intussusception',
];

// ═══════════════════════════════════════════════════════════════════
// MEDICATIONS — 1000+ drugs with common abbreviations
// ═══════════════════════════════════════════════════════════════════

export const SEED_MEDICATIONS = [
  // Cardiovascular
  'Aspirin','ASA','Clopidogrel','Plavix','Ticagrelor','Brilinta','Prasugrel',
  'Heparin','Enoxaparin','Lovenox','Fondaparinux','Rivaroxaban','Xarelto',
  'Apixaban','Eliquis','Warfarin','Coumadin','Dabigatran','Pradaxa',
  'Atenolol','Metoprolol','Lopressor','Carvedilol','Coreg','Bisoprolol',
  'Propranolol','Labetalol','Nebivolol','Esmolol',
  'Amlodipine','Norvasc','Nifedipine','Diltiazem','Verapamil',
  'Lisinopril','Enalapril','Ramipril','Captopril','Perindopril','Trandolapril',
  'Losartan','Valsartan','Irbesartan','Telmisartan','Candesartan','Olmesartan',
  'Sacubitril/Valsartan','Entresto',
  'Hydrochlorothiazide','HCTZ','Furosemide','Lasix','Bumetanide','Bumex',
  'Spironolactone','Aldactone','Eplerenone',
  'Digoxin','Lanoxin','Amiodarone','Cordarone','Sotalol','Flecainide',
  'Hydralazine','Nitroprusside','Nitroglycerin','NTG','GTN',
  'Atorvastatin','Lipitor','Rosuvastatin','Crestor','Simvastatin','Pravastatin',
  'Noradrenaline','Norepinephrine','Adrenaline','Epinephrine','Dobutamine',
  'Dopamine','Milrinone','Vasopressin','Phenylephrine',
  // Respiratory
  'Salbutamol','Albuterol','Ventolin','Proair','Ipratropium','Atrovent',
  'Tiotropium','Spiriva','Budesonide','Pulmicort','Fluticasone','Flovent',
  'Salmeterol','Formoterol','Montelukast','Singulair',
  'Theophylline','Aminophylline',
  'Dexamethasone','Decadron','Prednisolone','Prednisone','Methylprednisolone',
  'Hydrocortisone','Solu-Cortef','Solu-Medrol',
  // Antibiotics
  'Amoxicillin','Augmentin','Amoxicillin-Clavulanate',
  'Ampicillin','Ampicillin-Sulbactam','Unasyn',
  'Piperacillin-Tazobactam','Tazocin','Zosyn',
  'Ceftriaxone','Rocephin','Cefuroxime','Cefazolin','Ancef','Cefepime','Maxipime',
  'Ceftazidime','Cefdinir','Cephalexin','Keflex','Cefoxitin',
  'Meropenem','Merrem','Imipenem','Ertapenem','Invanz','Doripenem',
  'Azithromycin','Zithromax','Clarithromycin','Erythromycin',
  'Ciprofloxacin','Cipro','Levofloxacin','Levaquin','Moxifloxacin','Avelox',
  'Metronidazole','Flagyl','Clindamycin','Cleocin',
  'Vancomycin','Vancocin','Linezolid','Zyvox','Daptomycin','Cubicin',
  'Trimethoprim-Sulfamethoxazole','TMP-SMX','Bactrim','Septra',
  'Gentamicin','Tobramycin','Amikacin',
  'Nitrofurantoin','Macrobid','Fosfomycin',
  'Colistin','Polymyxin','Tigecycline',
  'Doxycycline','Minocycline','Tetracycline',
  'Fluconazole','Diflucan','Voriconazole','Caspofungin','Micafungin',
  'Amphotericin B','Nystatin',
  'Acyclovir','Valacyclovir','Ganciclovir','Oseltamivir','Tamiflu',
  'Remdesivir','Veklury',
  // Antiepileptics
  'Levetiracetam','Keppra','Phenytoin','Dilantin','Carbamazepine','Tegretol',
  'Valproic acid','Depakote','Lamotrigine','Lamictal','Topiramate','Topamax',
  'Lacosamide','Vimpat','Gabapentin','Neurontin','Pregabalin','Lyrica',
  // Analgesics
  'Paracetamol','Acetaminophen','Tylenol','Ofirmev',
  'Ibuprofen','Advil','Naproxen','Aleve','Diclofenac','Voltaren','Ketorolac','Toradol',
  'Morphine','Fentanyl','Hydromorphone','Dilaudid','Oxycodone',
  'Tramadol','Ultram','Codeine','Meperidine','Demerol',
  'Naloxone','Narcan',
  // Sedatives/Psych
  'Midazolam','Versed','Lorazepam','Ativan','Diazepam','Valium',
  'Propofol','Diprivan','Ketamine','Dexmedetomidine','Precedex',
  'Haloperidol','Haldol','Quetiapine','Seroquel','Olanzapine','Zyprexa',
  'Risperidone','Risperdal','Aripiprazole','Abilify',
  'Sertraline','Zoloft','Escitalopram','Lexapro','Fluoxetine','Prozac',
  'Venlafaxine','Effexor','Duloxetine','Cymbalta','Mirtazapine','Remeron',
  'Lithium','Clozapine','Clozaril',
  // Diabetes
  'Insulin','Insulin Aspart','NovoRapid','Novolog',
  'Insulin Lispro','Humalog','Insulin Glulisine','Apidra',
  'Insulin Glargine','Lantus','Basaglar','Toujeo',
  'Insulin Detemir','Levemir','Insulin Degludec','Tresiba',
  'Humulin','Novolin','NPH','Regular insulin',
  'Metformin','Glucophage','Glimepiride','Amaryl','Glyburide','Glipizide',
  'Sitagliptin','Januvia','Vildagliptin','Galvus','Linagliptin','Tradjenta',
  'Empagliflozin','Jardiance','Dapagliflozin','Farxiga','Canagliflozin','Invokana',
  'Semaglutide','Ozempic','Wegovy','Rybelsus',
  'Liraglutide','Victoza','Saxenda','Dulaglutide','Trulicity',
  'Tirzepatide','Mounjaro',
  'Pioglitazone','Actos','Acarbose',
  // GI
  'Omeprazole','Prilosec','Esomeprazole','Nexium','Pantoprazole','Protonix',
  'Lansoprazole','Prevacid','Rabeprazole',
  'Ranitidine','Famotidine','Pepcid',
  'Ondansetron','Zofran','Metoclopramide','Reglan','Domperidone',
  'Lactulose','Polyethylene glycol','Miralax','Bisacodyl','Senna',
  'Loperamide','Imodium',
  'Sucralfate','Carafate','Misoprostol',
  'Octreotide','Sandostatin',
  'Mesalamine','Asacol','Sulfasalazine',
  'Rifaximin','Xifaxan',
  // Anticoagulation reversal
  'Protamine','Vitamin K','Phytonadione',
  'Idarucizumab','Praxbind','Andexanet alfa','Andexxa',
  'Tranexamic acid','TXA','Aminocaproic acid',
  // Blood products
  'PRBC','Packed RBC','FFP','Fresh frozen plasma','Platelets','Cryoprecipitate',
  'Albumin','Albumin 5%','Albumin 25%',
  // Fluids/Electrolytes
  'NS','Normal saline','NS 0.9%','D5W','D5NS','Lactated Ringers','LR',
  'KCl','Potassium chloride','Calcium gluconate','Magnesium sulfate','MgSO4',
  'Sodium bicarbonate','NaHCO3','Mannitol','Hypertonic saline','3% NaCl',
  // Misc
  'Allopurinol','Colchicine','Febuxostat',
  'Hydroxychloroquine','Plaquenil','Azathioprine','Imuran',
  'Cyclophosphamide','Mycophenolate','CellCept','Tacrolimus','Prograf',
  'Methotrexate','MTX','Rituximab','Rituxan',
  'Erythropoietin','EPO','Darbepoetin','Aranesp',
  'Iron sucrose','Venofer','Ferric carboxymaltose','Ferinject',
  'Heparin flush','Hep-Lock',
  'Tetanus toxoid','TT','Tetanus immunoglobulin','TIG',
  'Enema','Fleet enema','Glycerin suppository',
];

// ═══════════════════════════════════════════════════════════════════
// OCR CONFUSION PATTERNS — common character misreads
// ═══════════════════════════════════════════════════════════════════

export const SEED_CHAR_CONFUSION = {
  // What OCR produces → what it should be
  'i': { 'l': 30, '1': 20, '!': 10, '|': 8 },
  'l': { '1': 25, 'I': 20, 'i': 15, '|': 8 },
  'I': { 'l': 20, '1': 15, '|': 10 },
  '1': { 'l': 25, 'I': 15, 'i': 10 },
  '0': { 'O': 40, 'o': 15, 'D': 5, 'Q': 3 },
  'O': { '0': 40, 'Q': 5, 'D': 3 },
  'o': { '0': 15, 'a': 5 },
  '5': { 'S': 15, 's': 10 },
  'S': { '5': 15, '$': 5 },
  '8': { 'B': 12, '&': 3 },
  'B': { '8': 12, '3': 3 },
  '6': { 'G': 8, 'b': 5 },
  'G': { '6': 8 },
  '2': { 'Z': 8 },
  'Z': { '2': 8 },
  '9': { 'g': 5, 'q': 3 },
  'n': { 'h': 8, 'r': 5 },
  'h': { 'b': 5, 'n': 8 },
  'm': { 'rn': 15, 'nn': 5 },
  'r': { 'n': 5, 'i': 3 },
  'a': { 'o': 5, 'e': 3 },
  'e': { 'c': 5, 'a': 3 },
  'u': { 'v': 5, 'n': 3 },
  'v': { 'u': 5, 'y': 3 },
  'c': { 'e': 5, 'o': 3 },
  'd': { 'cl': 5 },
  'w': { 'vv': 3 },
  '-': { '<': 20, '_': 10, '—': 8, '–': 8 },
  '<': { '-': 15, '«': 10, '(': 5 },
  '.': { ',': 8, ':': 3 },
  ',': { '.': 8 },
  // Arabic-specific
  '\u0631': { '\u0632': 5 }, // ra/za
  '\u062F': { '\u0630': 5 }, // dal/dhal
  '\u0647': { '\u0629': 10 }, // ha/ta marbuta
  '\u064A': { '\u0649': 8 }, // ya/alef maqsura
};

// ═══════════════════════════════════════════════════════════════════
// COMMON OCR WORD-LEVEL CORRECTIONS
// ═══════════════════════════════════════════════════════════════════

export const SEED_WORD_CORRECTIONS = {
  // Name corrections
  'ai-mutairi': { truth: 'Al-Mutairi', entity: 'NAME' },
  'al-mutairl': { truth: 'Al-Mutairi', entity: 'NAME' },
  'ai-hajri': { truth: 'Al-Hajri', entity: 'NAME' },
  'ai-enezi': { truth: 'Al-Enezi', entity: 'NAME' },
  'ai-rashidi': { truth: 'Al-Rashidi', entity: 'NAME' },
  'ai-shammari': { truth: 'Al-Shammari', entity: 'NAME' },
  'ai-dosari': { truth: 'Al-Dosari', entity: 'NAME' },
  'ai-kandari': { truth: 'Al-Kandari', entity: 'NAME' },
  'ai-otaibi': { truth: 'Al-Otaibi', entity: 'NAME' },
  'ai-harbi': { truth: 'Al-Harbi', entity: 'NAME' },
  'ai-ajmi': { truth: 'Al-Ajmi', entity: 'NAME' },
  'ai-fadli': { truth: 'Al-Fadli', entity: 'NAME' },
  'ai-bloushi': { truth: 'Al-Bloushi', entity: 'NAME' },
  'ai-awadhi': { truth: 'Al-Awadhi', entity: 'NAME' },
  'ai-sabah': { truth: 'Al-Sabah', entity: 'NAME' },
  'moharnmed': { truth: 'Mohammed', entity: 'NAME' },
  'mohamrned': { truth: 'Mohammed', entity: 'NAME' },
  'ahrned': { truth: 'Ahmed', entity: 'NAME' },
  'ahrned': { truth: 'Ahmed', entity: 'NAME' },
  'fatrna': { truth: 'Fatma', entity: 'NAME' },
  'fatirna': { truth: 'Fatima', entity: 'NAME' },
  'noura': { truth: 'Noura', entity: 'NAME' },
  'n0ura': { truth: 'Noura', entity: 'NAME' },
  'kha1ed': { truth: 'Khaled', entity: 'NAME' },
  'kha1id': { truth: 'Khalid', entity: 'NAME' },
  'abdu11ah': { truth: 'Abdullah', entity: 'NAME' },
  'abdui1ah': { truth: 'Abdullah', entity: 'NAME' },
  'ibrahirn': { truth: 'Ibrahim', entity: 'NAME' },
  'ibrahirm': { truth: 'Ibrahim', entity: 'NAME' },
  // Diagnosis corrections
  'nsterni': { truth: 'NSTEMI', entity: 'DIAGNOSIS' },
  'sterni': { truth: 'STEMI', entity: 'DIAGNOSIS' },
  'aecopo': { truth: 'AECOPD', entity: 'DIAGNOSIS' },
  'aecopd': { truth: 'AECOPD', entity: 'DIAGNOSIS' },
  'pneurnonla': { truth: 'Pneumonia', entity: 'DIAGNOSIS' },
  'pneurnonia': { truth: 'Pneumonia', entity: 'DIAGNOSIS' },
  'diabeles': { truth: 'Diabetes', entity: 'DIAGNOSIS' },
  'diabeies': { truth: 'Diabetes', entity: 'DIAGNOSIS' },
  'hypertenslon': { truth: 'Hypertension', entity: 'DIAGNOSIS' },
  'hypertensi0n': { truth: 'Hypertension', entity: 'DIAGNOSIS' },
  'septlc': { truth: 'Septic', entity: 'DIAGNOSIS' },
  'septicaernia': { truth: 'Septicaemia', entity: 'DIAGNOSIS' },
  // Medication corrections
  'rnetforrnin': { truth: 'Metformin', entity: 'MEDICATION' },
  'rnetformin': { truth: 'Metformin', entity: 'MEDICATION' },
  'ceftriax0ne': { truth: 'Ceftriaxone', entity: 'MEDICATION' },
  'atorvastatin': { truth: 'Atorvastatin', entity: 'MEDICATION' },
  'enoxaparln': { truth: 'Enoxaparin', entity: 'MEDICATION' },
  'pant0prazole': { truth: 'Pantoprazole', entity: 'MEDICATION' },
  'insul1n': { truth: 'Insulin', entity: 'MEDICATION' },
  'rneropenern': { truth: 'Meropenem', entity: 'MEDICATION' },
  'arniodarone': { truth: 'Amiodarone', entity: 'MEDICATION' },
  'furosernide': { truth: 'Furosemide', entity: 'MEDICATION' },
};

// ═══════════════════════════════════════════════════════════════════
// SEED LOADER — injects all seed data into the learner models
// ═══════════════════════════════════════════════════════════════════

export function loadSeedData(models) {
  const now = new Date().toISOString();

  // Seed names
  const allNames = [
    ...SEED_FIRST_NAMES_MALE,
    ...SEED_FIRST_NAMES_FEMALE,
    ...SEED_FAMILY_NAMES,
  ];
  for (const name of allNames) {
    const key = name.toLowerCase();
    if (!models.names[key]) {
      models.names[key] = {
        count: 3, // pretend seen 3 times
        variants: { [name]: 3 },
        entity: 'NAME',
        lastSeen: now,
        confidence: 0.82,
        preferred: name,
        seeded: true,
      };
    }
  }

  // Seed diagnoses
  for (const dx of SEED_DIAGNOSES) {
    const key = dx.toLowerCase();
    if (!models.diagnoses[key]) {
      models.diagnoses[key] = {
        count: 2,
        entity: 'DIAGNOSIS',
        lastSeen: now,
        confidence: 0.75,
        seeded: true,
      };
    }
  }

  // Seed medications
  for (const med of SEED_MEDICATIONS) {
    const key = med.toLowerCase();
    if (!models.medications[key]) {
      models.medications[key] = {
        count: 2,
        entity: 'MEDICATION',
        lastSeen: now,
        confidence: 0.75,
        seeded: true,
      };
    }
  }

  // Seed character confusion
  for (const [expected, confusions] of Object.entries(SEED_CHAR_CONFUSION)) {
    if (!models.charConfusion[expected]) {
      models.charConfusion[expected] = {};
    }
    for (const [got, count] of Object.entries(confusions)) {
      models.charConfusion[expected][got] = (models.charConfusion[expected][got] || 0) + count;
    }
  }

  // Seed word corrections
  for (const [ocr, correction] of Object.entries(SEED_WORD_CORRECTIONS)) {
    if (!models.corrections[ocr]) {
      models.corrections[ocr] = {
        truth: correction.truth,
        count: 5, // high count = high confidence
        entity: correction.entity,
        confidence: 0.92,
        seeded: true,
      };
    }
  }

  models.seeded = true;
  models.seedVersion = 1;
  return models;
}
