// OCR Deep Seed Data — exhaustive clinical knowledge for progress note interpretation
// Covers: subspecialty medicine, ICU protocols, pharmacology details, Arabic medical,
// physical exam minutiae, scoring systems, social history, discharge planning,
// and thousands of OCR correction patterns.

// ═══════════════════════════════════════════════════════════════════
// SUBSPECIALTY DIAGNOSES — deep clinical terminology
// ═══════════════════════════════════════════════════════════════════

export const DEEP_DIAGNOSES = [
  // ── Cardiology deep ──
  'Dressler syndrome','Takotsubo cardiomyopathy','Brugada syndrome',
  'Long QT syndrome','Short QT syndrome','WPW','Wolff-Parkinson-White',
  'Restrictive cardiomyopathy','Arrhythmogenic RV cardiomyopathy','ARVC',
  'Myocardial bridge','Anomalous coronary artery',
  'Constrictive pericarditis','Cardiac sarcoidosis','Cardiac amyloidosis',
  'Libman-Sacks endocarditis','Marantic endocarditis',
  'Prosthetic valve endocarditis','PVE','Native valve endocarditis','NVE',
  'Type A dissection','Type B dissection','Stanford A','Stanford B','DeBakey',
  'Thoracic aortic aneurysm','TAA','Abdominal aortic aneurysm','AAA',
  'Leriche syndrome','Subclavian steal','Carotid stenosis',
  'Acute limb ischemia','Chronic limb threatening ischemia','CLTI',
  'May-Thurner syndrome','Paget-Schroetter syndrome',
  'Postural orthostatic tachycardia','POTS',
  'Sick sinus syndrome','SSS','Torsades de pointes','TdP',

  // ── Pulmonology deep ──
  'Organizing pneumonia','COP','Cryptogenic organizing pneumonia',
  'Hypersensitivity pneumonitis','HP','Eosinophilic pneumonia',
  'Pulmonary alveolar proteinosis','PAP',
  'Pulmonary hypertension','PAH','CTEPH',
  'Pulmonary Langerhans cell histiocytosis','PLCH',
  'Lymphangioleiomyomatosis','LAM',
  'Goodpasture syndrome','Anti-GBM disease',
  'Granulomatosis with polyangiitis','GPA','Wegener',
  'Eosinophilic granulomatosis with polyangiitis','EGPA','Churg-Strauss',
  'Microscopic polyangiitis','MPA',
  'Sarcoidosis','Berylliosis','Asbestosis','Silicosis','Coal workers pneumoconiosis',
  'Mesothelioma','Pancoast tumor',
  'Massive hemoptysis','Pulmonary AVM','Pulmonary sequestration',
  'Tracheoesophageal fistula','TEF','Bronchopleural fistula',
  'Chylothorax','Hydropneumothorax',

  // ── Nephrology deep ──
  'IgA nephropathy','Berger disease',
  'Membranous nephropathy','Minimal change disease','MCD',
  'Focal segmental glomerulosclerosis','FSGS',
  'Membranoproliferative glomerulonephritis','MPGN',
  'Rapidly progressive glomerulonephritis','RPGN','Crescentic GN',
  'Anti-GBM disease','Lupus nephritis class III','Lupus nephritis class IV',
  'Lupus nephritis class V',
  'Diabetic nephropathy','Hypertensive nephrosclerosis',
  'Renal artery stenosis','RAS','Fibromuscular dysplasia','FMD',
  'Renal vein thrombosis','RVT',
  'Contrast-induced nephropathy','CIN',
  'Rhabdomyolysis','Myoglobinuria','Tumor lysis syndrome','TLS',
  'Hepatorenal syndrome type 1','HRS type 1','HRS type 2',
  'Dialysis disequilibrium syndrome','First-use syndrome',
  'Calciphylaxis','Renal osteodystrophy',
  'ADPKD','Autosomal dominant polycystic kidney disease',
  'Alport syndrome','Thin basement membrane disease',
  'Cast nephropathy','Myeloma kidney',

  // ── GI/Hepatology deep ──
  'Achalasia','Esophageal spasm','Diffuse esophageal spasm',
  'Zenker diverticulum','Mallory-Weiss tear','Boerhaave syndrome',
  'Barrett esophagus','Esophageal adenocarcinoma','Esophageal SCC',
  'Gastroparesis','Dumping syndrome','Marginal ulcer',
  'Celiac disease','Tropical sprue','Whipple disease',
  'Microscopic colitis','Collagenous colitis','Lymphocytic colitis',
  'Ischemic colitis','Pseudomembranous colitis',
  'Toxic megacolon','Volvulus','Sigmoid volvulus','Cecal volvulus',
  'Ogilvie syndrome','Acute colonic pseudo-obstruction',
  'Carcinoid syndrome','Neuroendocrine tumor','NET',
  'GIST','Gastrointestinal stromal tumor',
  'Primary sclerosing cholangitis','PSC',
  'Primary biliary cholangitis','PBC',
  'Autoimmune hepatitis','AIH',
  'Wilson disease','Hemochromatosis','Alpha-1 antitrypsin deficiency',
  'Budd-Chiari syndrome','Portal vein thrombosis','PVT',
  'Hepatopulmonary syndrome','Portopulmonary hypertension',
  'Spontaneous bacterial peritonitis','SBP',
  'Hepatic hydrothorax',
  'Acute liver failure','ALF','Fulminant hepatic failure',
  'Drug-induced liver injury','DILI',
  'Acute fatty liver of pregnancy','AFLP',

  // ── Neurology deep ──
  'Wernicke encephalopathy','Korsakoff syndrome',
  'Normal pressure hydrocephalus','NPH',
  'Idiopathic intracranial hypertension','IIH','Pseudotumor cerebri',
  'Cerebral venous sinus thrombosis','CVST',
  'Cavernous sinus thrombosis',
  'CNS vasculitis','Primary angiitis of CNS','PACNS',
  'Posterior reversible encephalopathy syndrome','PRES',
  'Osmotic demyelination syndrome','ODS','Central pontine myelinolysis','CPM',
  'Progressive multifocal leukoencephalopathy','PML',
  'Creutzfeldt-Jakob disease','CJD','Prion disease',
  'Autoimmune encephalitis','Anti-NMDA receptor encephalitis',
  'Limbic encephalitis','Hashimoto encephalopathy',
  'Neuromyelitis optica','NMO','NMOSD',
  'Transverse myelitis','Acute disseminated encephalomyelitis','ADEM',
  'Chiari malformation','Syringomyelia',
  'Myasthenic crisis','Cholinergic crisis',
  'Lambert-Eaton syndrome','LEMS',
  'Amyotrophic lateral sclerosis','ALS','Motor neuron disease','MND',
  'Huntington disease','Friedreich ataxia','Spinocerebellar ataxia',
  'Trigeminal neuralgia','Bell palsy','Vestibular neuritis',
  'Meniere disease','Benign paroxysmal positional vertigo','BPPV',
  'Complex regional pain syndrome','CRPS',
  'Neuropathic pain','Diabetic neuropathy','Peripheral neuropathy',
  'Carpal tunnel syndrome','CTS','Cubital tunnel syndrome',

  // ── Endocrinology deep ──
  'Pheochromocytoma','Paraganglioma',
  'Primary hyperaldosteronism','Conn syndrome',
  'Cushing disease','Cushing syndrome','Pseudo-Cushing',
  'Addisonian crisis','Adrenal crisis',
  'Myxedema coma','Thyroid storm','Thyrotoxic periodic paralysis',
  'Subacute thyroiditis','De Quervain thyroiditis','Hashimoto thyroiditis',
  'Graves disease','Graves ophthalmopathy',
  'MEN1','MEN2','MEN2A','MEN2B','Multiple endocrine neoplasia',
  'Acromegaly','Prolactinoma','Craniopharyngioma',
  'Diabetes insipidus','DI','Central DI','Nephrogenic DI','SIADH',
  'Hypoparathyroidism','Hyperparathyroidism','Primary HPT','Secondary HPT',
  'Paget disease of bone','Osteomalacia','Rickets',
  'Adrenal incidentaloma','Non-functioning pituitary adenoma',
  'Insulinoma','Glucagonoma','VIPoma','Somatostatinoma',
  'Zollinger-Ellison syndrome','Gastrinoma',
  'Polyglandular autoimmune syndrome',

  // ── Hematology deep ──
  'Aplastic anemia','Myelofibrosis','Essential thrombocythemia','ET',
  'Polycythemia vera','PV',
  'Hemolytic anemia','Warm AIHA','Cold AIHA','Cold agglutinin disease',
  'G6PD deficiency','Hereditary spherocytosis','Hereditary elliptocytosis',
  'Thalassemia major','Thalassemia intermedia','Thalassemia trait',
  'Sickle cell trait','HbSC disease','HbS-beta thal',
  'Paroxysmal nocturnal hemoglobinuria','PNH',
  'Thrombotic thrombocytopenic purpura','TTP',
  'Hemolytic uremic syndrome','HUS','Atypical HUS','aHUS',
  'Heparin-induced thrombocytopenia','HIT','HITT',
  'Immune thrombocytopenic purpura','ITP',
  'Antiphospholipid syndrome','APS','APLS',
  'Factor V Leiden','Protein C deficiency','Protein S deficiency',
  'Antithrombin III deficiency','Prothrombin gene mutation',
  'Von Willebrand disease','VWD','Hemophilia A','Hemophilia B',
  'Acquired hemophilia','Factor VIII inhibitor',
  'Tumor lysis syndrome','TLS',
  'Febrile non-hemolytic transfusion reaction','FNHTR',
  'Transfusion-related acute lung injury','TRALI',
  'Transfusion-associated circulatory overload','TACO',

  // ── Infectious disease deep ──
  'Infective endocarditis','Duke criteria',
  'Prosthetic joint infection','PJI',
  'Vertebral osteomyelitis','Discitis','Epidural abscess',
  'Brain abscess','Subdural empyema',
  'Necrotizing soft tissue infection','NSTI','Fournier gangrene',
  'Clostridium difficile','C. diff recurrence','Fulminant C. diff',
  'MRSA bacteremia','MSSA bacteremia','Coagulase-negative staph','CoNS',
  'VRE','ESBL','CRE','Carbapenem-resistant Enterobacteriaceae',
  'KPC','NDM','OXA-48',
  'Candidemia','Invasive candidiasis','Invasive aspergillosis',
  'Mucormycosis','Zygomycosis',
  'PCP','Pneumocystis pneumonia','Pneumocystis jirovecii',
  'CMV','Cytomegalovirus','CMV viremia','CMV colitis','CMV retinitis',
  'EBV','Epstein-Barr virus','Infectious mononucleosis',
  'HSV','Herpes simplex','HSV encephalitis','HSV keratitis',
  'VZV','Varicella','Herpes zoster','Shingles',
  'Leptospirosis','Q fever','Coxiella','Scrub typhus',
  'Strongyloides','Schistosomiasis','Leishmaniasis',
  'Toxoplasmosis','Cryptococcosis','Histoplasmosis','Coccidioidomycosis',

  // ── Rheumatology deep ──
  'CREST syndrome','Limited scleroderma','Diffuse scleroderma',
  'Mixed connective tissue disease','MCTD',
  'Polymyositis','Inclusion body myositis',
  'Anti-synthetase syndrome','Antisynthetase',
  'Takayasu arteritis','Giant cell arteritis','GCA','Temporal arteritis',
  'Polyarteritis nodosa','PAN',
  'Behcet disease','Behcet syndrome',
  'IgG4-related disease','IgG4-RD',
  'Adult-onset Still disease','AOSD',
  'Reactive arthritis','Reiter syndrome',
  'Crystal arthropathy','CPPD','Pseudogout','Calcium pyrophosphate',
  'Hemochromatosis arthropathy',
  'Sarcoid arthropathy','Whipple arthritis',
  'Lupus cerebritis','Lupus pneumonitis','Lupus pleuritis',
  'Antiphospholipid syndrome','APS','Catastrophic APS','CAPS',
  'Scleroderma renal crisis','SRC',
  'Macrophage activation syndrome','MAS','HLH',
  'Hemophagocytic lymphohistiocytosis','HLH',

  // ── Toxicology ──
  'Acetaminophen overdose','Paracetamol overdose','NAC protocol',
  'Salicylate toxicity','Aspirin overdose',
  'Digoxin toxicity','Digoxin overdose',
  'Beta-blocker overdose','Calcium channel blocker overdose',
  'Tricyclic antidepressant overdose','TCA overdose',
  'Serotonin syndrome','Neuroleptic malignant syndrome','NMS',
  'Malignant hyperthermia','MH',
  'Organophosphate poisoning','Cholinergic toxidrome',
  'Anticholinergic toxidrome','Sympathomimetic toxidrome',
  'Opioid toxidrome','Sedative-hypnotic toxidrome',
  'Alcohol withdrawal','AWS','CIWA','Delirium tremens',
  'Benzodiazepine withdrawal','Opioid withdrawal','COWS',
  'Methanol poisoning','Ethylene glycol poisoning',
  'Carbon monoxide poisoning','CO poisoning','Cyanide poisoning',
  'Iron overdose','Lithium toxicity',

  // ── ICU / Critical Care ──
  'Septic shock','Distributive shock','Cardiogenic shock',
  'Hypovolemic shock','Obstructive shock','Neurogenic shock',
  'Vasoplegic syndrome','SIRS','qSOFA',
  'Acute respiratory distress syndrome','Berlin criteria',
  'Ventilator-associated pneumonia','VAP',
  'Central line-associated bloodstream infection','CLABSI',
  'Catheter-associated urinary tract infection','CAUTI',
  'Ventilator-associated event','VAE',
  'ICU-acquired weakness','ICUAW','Critical illness polyneuropathy','CIP',
  'Critical illness myopathy','CIM',
  'Post-intensive care syndrome','PICS',
  'Refeeding syndrome','Propofol infusion syndrome','PRIS',
  'Abdominal compartment syndrome','ACS',
  'Intra-abdominal hypertension','IAH',
  'Brain death','Brainstem death','Organ donation',
  'Targeted temperature management','TTM','Therapeutic hypothermia',
  'ECMO','VA-ECMO','VV-ECMO',
  'Prone ventilation','Recruitment maneuver',
  'Permissive hypercapnia','Lung-protective ventilation',
  'Liberation from ventilation','Weaning trial','SBT',
  'Spontaneous breathing trial',
  'Rapid sequence intubation','RSI','Difficult airway',
  'Failed intubation','Can\'t intubate can\'t oxygenate','CICO',

  // ── Dermatology ──
  'Stevens-Johnson syndrome','SJS',
  'Toxic epidermal necrolysis','TEN','SJS-TEN overlap',
  'Drug reaction with eosinophilia and systemic symptoms','DRESS',
  'Erythema multiforme','EM',
  'Pemphigus vulgaris','Bullous pemphigoid',
  'Dermatitis herpetiformis','Pyoderma gangrenosum',
  'Erythema nodosum','Sweet syndrome',
  'Calciphylaxis','Warfarin skin necrosis',
  'Necrotizing fasciitis','Fournier gangrene',

  // ── Ophthalmology emergencies ──
  'Acute angle-closure glaucoma','Central retinal artery occlusion','CRAO',
  'Central retinal vein occlusion','CRVO',
  'Retinal detachment','Vitreous hemorrhage',
  'Endophthalmitis','Orbital cellulitis','Preseptal cellulitis',
  'Optic neuritis','Papilledema','Giant cell arteritis',

  // ── ENT emergencies ──
  'Peritonsillar abscess','PTA','Quinsy',
  'Retropharyngeal abscess','Ludwig angina',
  'Epiglottitis','Acute epiglottitis',
  'Epistaxis','Posterior epistaxis',
  'Foreign body airway','Foreign body esophagus',
  'Mastoiditis','Acute otitis media','AOM',
  'Malignant otitis externa','Necrotizing otitis externa',
];

// ═══════════════════════════════════════════════════════════════════
// DEEP MEDICATIONS — subspecialty drugs, infusions, protocols
// ═══════════════════════════════════════════════════════════════════

export const DEEP_MEDICATIONS = [
  // ICU infusions & drips
  'Noradrenaline infusion','Norepinephrine drip','Levophed',
  'Vasopressin infusion','Vasopressin drip',
  'Phenylephrine infusion','Neosynephrine',
  'Epinephrine infusion','Adrenaline drip',
  'Dobutamine infusion','Milrinone infusion','Primacor',
  'Nicardipine drip','Cardene','Clevidipine','Cleviprex',
  'Nitroprusside drip','Nipride',
  'Nitroglycerin infusion','NTG drip',
  'Esmolol drip','Brevibloc',
  'Heparin drip','Heparin infusion','Heparin protocol',
  'Argatroban drip','Bivalirudin drip','Angiomax',
  'Insulin drip','Insulin infusion','DKA protocol',
  'Propofol infusion','Dexmedetomidine infusion','Precedex drip',
  'Fentanyl infusion','Fentanyl drip',
  'Midazolam infusion','Midazolam drip',
  'Ketamine infusion','Ketamine drip',
  'Cisatracurium drip','Nimbex','Rocuronium drip',
  'Alteplase','tPA','Tenecteplase','TNK',
  'Amiodarone loading','Amiodarone maintenance',
  'Magnesium infusion','Potassium infusion','Potassium replacement',
  'Calcium gluconate infusion','Calcium chloride',
  'Sodium bicarbonate drip','Bicarb drip',
  'Hypertonic saline infusion','3% NaCl',
  'Mannitol infusion','Mannitol bolus',
  'Desmopressin','DDAVP',
  'Octreotide infusion','Octreotide drip',
  'Pantoprazole infusion','PPI drip','Pantoprazole drip',
  'N-Acetylcysteine','NAC','NAC protocol','NAC infusion',
  'Fomepizole','Antizol','Ethanol drip',
  'Intralipid','Lipid emulsion','Fat emulsion',
  'Oxytocin infusion','Pitocin',

  // Chemotherapy/Immunotherapy
  'Cisplatin','Carboplatin','Oxaliplatin',
  'Paclitaxel','Docetaxel','Vinblastine','Vincristine',
  'Doxorubicin','Epirubicin','Bleomycin','Etoposide',
  'Irinotecan','Topotecan','Gemcitabine','Capecitabine','5-FU',
  'Fluorouracil','Leucovorin','FOLFOX','FOLFIRI','FOLFIRINOX',
  'Pembrolizumab','Keytruda','Nivolumab','Opdivo',
  'Atezolizumab','Tecentriq','Durvalumab','Imfinzi',
  'Ipilimumab','Yervoy','Bevacizumab','Avastin',
  'Trastuzumab','Herceptin','Cetuximab','Erbitux',
  'Imatinib','Gleevec','Erlotinib','Tarceva','Osimertinib','Tagrisso',
  'Lenalidomide','Revlimid','Bortezomib','Velcade',
  'Ibrutinib','Imbruvica','Venetoclax','Venclexta',

  // Biologics/DMARDs
  'Adalimumab','Humira','Infliximab','Remicade',
  'Etanercept','Enbrel','Golimumab','Simponi',
  'Certolizumab','Cimzia','Ustekinumab','Stelara',
  'Secukinumab','Cosentyx','Ixekizumab','Taltz',
  'Tofacitinib','Xeljanz','Baricitinib','Olumiant',
  'Upadacitinib','Rinvoq',
  'Abatacept','Orencia','Tocilizumab','Actemra',
  'Anakinra','Kineret','Belimumab','Benlysta',
  'Eculizumab','Soliris','Ravulizumab','Ultomiris',

  // Antifungals deep
  'Posaconazole','Noxafil','Isavuconazole','Cresemba',
  'Itraconazole','Sporanox','Anidulafungin','Eraxis',
  'Flucytosine','5-FC',
  'Liposomal amphotericin B','AmBisome',

  // Antivirals deep
  'Foscarnet','Cidofovir','Valganciclovir','Valcyte',
  'Letermovir','Prevymis','Maribavir',
  'Sofosbuvir','Sovaldi','Ledipasvir/Sofosbuvir','Harvoni',
  'Glecaprevir/Pibrentasvir','Mavyret','Velpatasvir/Sofosbuvir','Epclusa',
  'Nirmatrelvir/Ritonavir','Paxlovid','Molnupiravir','Lagevrio',
  'Dolutegravir','Tivicay','Bictegravir','Biktarvy',
  'Emtricitabine','Tenofovir','Truvada','Descovy',

  // Rare/specialized
  'Sugammadex','Bridion',
  'Idarucizumab','Praxbind','Andexanet alfa','Andexxa',
  'Glucagon','Calcium gluconate for hyperK',
  'Dantrolene','MH protocol',
  'Hydroxocobalamin','Cyanokit',
  'Methylene blue',
  'Physostigmine','Pyridostigmine','Mestinon',
  'Neostigmine','Edrophonium','Tensilon',
  'Pralidoxime','2-PAM',
  'Activated charcoal','Whole bowel irrigation',
  'Sodium polystyrene sulfonate','Kayexalate','SPS',
  'Patiromer','Veltassa','Sodium zirconium cyclosilicate','Lokelma',
  'Sevelamer','Renagel','Renvela','Lanthanum','Fosrenol',
  'Cinacalcet','Sensipar','Etelcalcetide','Parsabiv',
  'Tolvaptan','Samsca','Conivaptan','Vaprisol',
  'Demeclocycline',
];

// ═══════════════════════════════════════════════════════════════════
// CLINICAL SCORING SYSTEMS
// ═══════════════════════════════════════════════════════════════════

export const SCORING_SYSTEMS = [
  // General
  'APACHE II','APACHE IV','SOFA','qSOFA','SAPS II','SAPS 3',
  'MODS','Marshall score','LODS',
  'Charlson Comorbidity Index','CCI','Elixhauser',
  'Karnofsky','KPS','ECOG','Performance Status',
  'ASA','ASA class','ASA I','ASA II','ASA III','ASA IV','ASA V',
  'Mallampati','Mallampati I','Mallampati II','Mallampati III','Mallampati IV',
  // Cardiac
  'TIMI score','GRACE score','HEART score',
  'CHA2DS2-VASc','HAS-BLED','CHADS2',
  'Killip class','Killip I','Killip II','Killip III','Killip IV',
  'NYHA','NYHA I','NYHA II','NYHA III','NYHA IV',
  'Framingham criteria',
  // Respiratory
  'CURB-65','CRB-65','PSI','PORT score','Pneumonia Severity Index',
  'BODE index','mMRC','CAT score',
  'Murray Lung Injury Score','Berlin criteria',
  'ROX index','P/F ratio','S/F ratio',
  // GI/Hepatic
  'Child-Pugh','Child-Pugh A','Child-Pugh B','Child-Pugh C',
  'MELD','MELD-Na','MELD 3.0',
  'Ranson criteria','Revised Atlanta','BISAP',
  'Glasgow-Blatchford','Rockall score',
  'Forrest classification',
  // Neuro
  'Glasgow Coma Scale','GCS','Hunt and Hess','Fisher grade',
  'NIHSS','National Institutes of Health Stroke Scale',
  'ABCD2 score','Modified Rankin Scale','mRS',
  'FOUR score','Ramsay sedation scale',
  'RASS','Richmond Agitation Sedation Scale',
  'CAM-ICU','Confusion Assessment Method',
  'CIWA','Clinical Institute Withdrawal Assessment',
  'COWS','Clinical Opiate Withdrawal Scale',
  // Renal
  'KDIGO','RIFLE','AKIN',
  // Hematology
  'Wells score','Geneva score','Revised Geneva',
  'Padua score','Caprini score','VTE risk',
  'DIC score','ISTH DIC score',
  'HIT score','4T score',
  'Bleeding risk score',
  // Trauma
  'ISS','Injury Severity Score','AIS','Abbreviated Injury Scale',
  'RTS','Revised Trauma Score','TRISS',
  'Canadian C-spine rule','NEXUS criteria',
  'Ottawa ankle rules','Ottawa knee rules',
  // Wound/Skin
  'Braden scale','Norton scale','Waterlow score',
  'Wagner classification','University of Texas classification',
  'TBSA','Rule of Nines','Lund-Browder',
  // Nutrition
  'NUTRIC score','NRS-2002','MUST','SGA','Subjective Global Assessment',
  'BMI','Ideal body weight','IBW','Adjusted body weight','ABW',
  // Pain
  'NRS','Numerical Rating Scale','VAS','Visual Analog Scale',
  'Wong-Baker FACES','FLACC','CPOT','BPS','Behavioral Pain Scale',
  // Sepsis
  'Sepsis-3','qSOFA','SOFA score','SIRS criteria',
  'Surviving Sepsis Guidelines','SSC',
  'Hour-1 bundle','Hour-3 bundle',
  'Lactate clearance','MAP target',
];

// ═══════════════════════════════════════════════════════════════════
// ARABIC MEDICAL TERMINOLOGY
// ═══════════════════════════════════════════════════════════════════

export const ARABIC_MEDICAL = [
  // Common symptoms
  'ألم', 'صداع', 'حمى', 'سعال', 'ضيق تنفس', 'غثيان', 'قيء', 'إسهال',
  'إمساك', 'دوخة', 'إغماء', 'تعب', 'ضعف', 'انتفاخ', 'تورم',
  'حكة', 'طفح جلدي', 'نزيف', 'كدمات',
  // Body systems
  'قلب', 'رئة', 'كبد', 'كلية', 'معدة', 'أمعاء', 'دماغ', 'عظام',
  'جلد', 'عين', 'أذن', 'أنف', 'حنجرة', 'مثانة', 'بنكرياس',
  // Common diagnoses in Arabic
  'سكري', 'ضغط', 'ضغط الدم', 'سكر', 'كوليسترول',
  'ربو', 'حساسية', 'التهاب', 'التهاب رئوي', 'جلطة',
  'جلطة قلبية', 'جلطة دماغية', 'فشل كلوي', 'فشل قلبي',
  'سرطان', 'ورم', 'كسر', 'حروق', 'عملية', 'جراحة',
  // Clinical terms
  'فحص', 'تحليل', 'أشعة', 'تشخيص', 'علاج', 'دواء', 'أدوية',
  'حقنة', 'مغذي', 'تنويم', 'خروج', 'تحويل', 'استشارة',
  'عناية مركزة', 'طوارئ', 'عيادة', 'جناح', 'سرير', 'غرفة',
  // Staff
  'طبيب', 'دكتور', 'دكتورة', 'ممرض', 'ممرضة', 'صيدلي', 'صيدلانية',
  'اخصائي', 'استشاري', 'مقيم', 'متدرب',
  // Instructions
  'قبل الأكل', 'بعد الأكل', 'صائم', 'مفطر',
  'مرة يومياً', 'مرتين يومياً', 'ثلاث مرات', 'عند اللزوم',
  'وريدي', 'عضلي', 'تحت الجلد', 'فموي',
];

// ═══════════════════════════════════════════════════════════════════
// SOCIAL HISTORY & DISCHARGE PLANNING VOCABULARY
// ═══════════════════════════════════════════════════════════════════

export const SOCIAL_DISCHARGE = [
  // Social history
  'Smoker','Non-smoker','Ex-smoker','Pack-years','Pack year history',
  'Current smoker','Former smoker','Never smoker',
  'Alcohol','Social drinker','Heavy drinker','Alcohol use disorder','AUD',
  'CAGE','AUDIT','Drinks per week','Units per week',
  'Illicit drugs','IVDU','IV drug use','Cannabis','Marijuana',
  'Cocaine','Amphetamine','Methamphetamine','Heroin','Opioid use disorder',
  'Lives alone','Lives with family','Lives with spouse',
  'Nursing home','Skilled nursing facility','SNF',
  'Assisted living','Group home','Homeless',
  'Independent','Dependent','ADLs','IADLs',
  'Ambulatory at baseline','Wheelchair bound','Bedbound',
  'Home oxygen','Home CPAP','Home BiPAP',
  'Full-time carer','Part-time carer','No carer',
  'Next of kin','NOK','Emergency contact','POA','Power of attorney',
  'Healthcare proxy','Legal guardian',
  'Occupation','Retired','Unemployed','Student','Housewife',
  'Travel history','Contact history','Exposure history',
  'Vaccination history','COVID vaccination','Flu vaccination',
  // Discharge planning
  'Discharge planning','Discharge summary','Discharge medications',
  'Discharge instructions','Follow-up appointments',
  'Home services','Home health','Home nursing','Home PT',
  'DME','Durable medical equipment','Hospital bed','Walker','Wheelchair',
  'Oxygen concentrator','Suction machine',
  'Wound care nurse','Visiting nurse','VNA',
  'Rehabilitation','Inpatient rehab','Outpatient rehab','Subacute rehab',
  'Long-term care','LTC','Long-term acute care','LTAC',
  'Respite care','Hospice','Palliative care referral',
  'Barrier to discharge','Social barrier','Medical barrier',
  'Insurance','Prior authorization','PA','Pre-cert',
  'Transportation','Ambulance transport','Medical transport',
  'Medication reconciliation','Med rec','Teach-back',
  'Return precautions','Red flags','When to return to ED',
  'Activity restrictions','Weight-bearing restrictions','Driving restrictions',
  'Work restrictions','Light duty','Full duty','Off work',
  'Diet instructions','Fluid restriction','Salt restriction',
  'Wound care instructions','Dressing changes at home',
  'Follow-up with PCP','Follow-up with specialist',
  'Lab follow-up','Repeat labs','Outpatient labs',
  'Imaging follow-up','Repeat imaging',
];

// ═══════════════════════════════════════════════════════════════════
// MASSIVE OCR WORD CORRECTIONS — clinical text misreads
// ═══════════════════════════════════════════════════════════════════

export const DEEP_WORD_CORRECTIONS = {
  // m↔rn is THE most common OCR error in medical text
  'rnonth': { truth: 'Month', entity: 'CLINICAL' },
  'rnorning': { truth: 'Morning', entity: 'CLINICAL' },
  'rnalignant': { truth: 'Malignant', entity: 'CLINICAL' },
  'rnalignancy': { truth: 'Malignancy', entity: 'CLINICAL' },
  'rnetastatic': { truth: 'Metastatic', entity: 'CLINICAL' },
  'rnetastasis': { truth: 'Metastasis', entity: 'CLINICAL' },
  'rnechanism': { truth: 'Mechanism', entity: 'CLINICAL' },
  'rnembrane': { truth: 'Membrane', entity: 'CLINICAL' },
  'rninimal': { truth: 'Minimal', entity: 'CLINICAL' },
  'rnixed': { truth: 'Mixed', entity: 'CLINICAL' },
  'rnovement': { truth: 'Movement', entity: 'CLINICAL' },
  'rnurmur': { truth: 'Murmur', entity: 'CLINICAL' },
  'rnuscle': { truth: 'Muscle', entity: 'CLINICAL' },
  'rnuscular': { truth: 'Muscular', entity: 'CLINICAL' },
  'rnucosa': { truth: 'Mucosa', entity: 'CLINICAL' },
  'rnanagement': { truth: 'Management', entity: 'CLINICAL' },
  'rnoderate': { truth: 'Moderate', entity: 'CLINICAL' },
  'rnodified': { truth: 'Modified', entity: 'CLINICAL' },
  'rnyocardial': { truth: 'Myocardial', entity: 'CLINICAL' },
  'cornplete': { truth: 'Complete', entity: 'CLINICAL' },
  'cornplaint': { truth: 'Complaint', entity: 'CLINICAL' },
  'cornplication': { truth: 'Complication', entity: 'CLINICAL' },
  'cornplications': { truth: 'Complications', entity: 'CLINICAL' },
  'cornputed': { truth: 'Computed', entity: 'CLINICAL' },
  'cornmunity': { truth: 'Community', entity: 'CLINICAL' },
  'cornfort': { truth: 'Comfort', entity: 'CLINICAL' },
  'irnaging': { truth: 'Imaging', entity: 'CLINICAL' },
  'irnpaired': { truth: 'Impaired', entity: 'CLINICAL' },
  'irnplant': { truth: 'Implant', entity: 'CLINICAL' },
  'irnmune': { truth: 'Immune', entity: 'CLINICAL' },
  'irnmunity': { truth: 'Immunity', entity: 'CLINICAL' },
  'irnmunosuppressed': { truth: 'Immunosuppressed', entity: 'CLINICAL' },
  'sympton': { truth: 'Symptom', entity: 'CLINICAL' },
  'syrnptom': { truth: 'Symptom', entity: 'CLINICAL' },
  'syrnptoms': { truth: 'Symptoms', entity: 'CLINICAL' },
  'extrernity': { truth: 'Extremity', entity: 'CLINICAL' },
  'extrernities': { truth: 'Extremities', entity: 'CLINICAL' },
  'inflarnnation': { truth: 'Inflammation', entity: 'CLINICAL' },
  'inflarnmation': { truth: 'Inflammation', entity: 'CLINICAL' },
  'inflamrnation': { truth: 'Inflammation', entity: 'CLINICAL' },
  'environrnent': { truth: 'Environment', entity: 'CLINICAL' },

  // l↔1 and I confusion
  '1eft': { truth: 'Left', entity: 'CLINICAL' },
  '1ower': { truth: 'Lower', entity: 'CLINICAL' },
  '1ung': { truth: 'Lung', entity: 'CLINICAL' },
  '1iver': { truth: 'Liver', entity: 'CLINICAL' },
  '1ateral': { truth: 'Lateral', entity: 'CLINICAL' },
  '1imited': { truth: 'Limited', entity: 'CLINICAL' },
  '1aboratory': { truth: 'Laboratory', entity: 'CLINICAL' },
  '1ymphocyte': { truth: 'Lymphocyte', entity: 'CLINICAL' },
  '1ymphocytes': { truth: 'Lymphocytes', entity: 'CLINICAL' },
  'bi1ateral': { truth: 'Bilateral', entity: 'CLINICAL' },
  'b1ood': { truth: 'Blood', entity: 'CLINICAL' },
  'c1ear': { truth: 'Clear', entity: 'CLINICAL' },
  'c1inical': { truth: 'Clinical', entity: 'CLINICAL' },
  'f1uid': { truth: 'Fluid', entity: 'CLINICAL' },
  'p1atelets': { truth: 'Platelets', entity: 'CLINICAL' },
  'p1an': { truth: 'Plan', entity: 'CLINICAL' },
  'p1eural': { truth: 'Pleural', entity: 'CLINICAL' },
  'mu1tiple': { truth: 'Multiple', entity: 'CLINICAL' },
  'resu1ts': { truth: 'Results', entity: 'CLINICAL' },
  'norma1': { truth: 'Normal', entity: 'CLINICAL' },
  'renai': { truth: 'Renal', entity: 'CLINICAL' },
  'hepatorenal': { truth: 'Hepatorenal', entity: 'CLINICAL' },
  'initiai': { truth: 'Initial', entity: 'CLINICAL' },
  'minimai': { truth: 'Minimal', entity: 'CLINICAL' },
  'critica1': { truth: 'Critical', entity: 'CLINICAL' },
  'vita1': { truth: 'Vital', entity: 'CLINICAL' },
  'uri': { truth: 'URI', entity: 'DIAGNOSIS' },
  'utl': { truth: 'UTI', entity: 'DIAGNOSIS' },

  // 0↔O confusion
  'bl00d': { truth: 'Blood', entity: 'CLINICAL' },
  'pr0tein': { truth: 'Protein', entity: 'CLINICAL' },
  'gl0blin': { truth: 'Globlin', entity: 'CLINICAL' },
  'hem0globin': { truth: 'Hemoglobin', entity: 'CLINICAL' },
  'hem0dialysis': { truth: 'Hemodialysis', entity: 'CLINICAL' },
  'hem0rrhage': { truth: 'Hemorrhage', entity: 'CLINICAL' },
  'p0sitive': { truth: 'Positive', entity: 'CLINICAL' },
  'p0or': { truth: 'Poor', entity: 'CLINICAL' },
  'p0st': { truth: 'Post', entity: 'CLINICAL' },
  'pr0gress': { truth: 'Progress', entity: 'CLINICAL' },
  'pr0cedure': { truth: 'Procedure', entity: 'CLINICAL' },
  'appr0priate': { truth: 'Appropriate', entity: 'CLINICAL' },
  'pneum0nia': { truth: 'Pneumonia', entity: 'DIAGNOSIS' },
  'thr0mbosis': { truth: 'Thrombosis', entity: 'DIAGNOSIS' },
  'embO1ism': { truth: 'Embolism', entity: 'DIAGNOSIS' },
};

// ═══════════════════════════════════════════════════════════════════
// LOADER
// ═══════════════════════════════════════════════════════════════════

export function loadDeepSeedData(models) {
  const now = new Date().toISOString();

  // Deep diagnoses
  for (const dx of DEEP_DIAGNOSES) {
    const key = dx.toLowerCase();
    if (!models.diagnoses[key]) {
      models.diagnoses[key] = { count: 2, entity: 'DIAGNOSIS', lastSeen: now, confidence: 0.72, seeded: true };
    }
  }

  // Deep medications
  for (const med of DEEP_MEDICATIONS) {
    const key = med.toLowerCase();
    if (!models.medications[key]) {
      models.medications[key] = { count: 2, entity: 'MEDICATION', lastSeen: now, confidence: 0.72, seeded: true };
    }
  }

  // Scoring systems → diagnoses vocab
  for (const score of SCORING_SYSTEMS) {
    const key = score.toLowerCase();
    if (!models.diagnoses[key]) {
      models.diagnoses[key] = { count: 1, entity: 'SCORING_SYSTEM', lastSeen: now, confidence: 0.70, seeded: true };
    }
  }

  // Arabic medical terms
  for (const term of ARABIC_MEDICAL) {
    const key = term.trim();
    if (key.length < 2) continue;
    if (!models.diagnoses[key]) {
      models.diagnoses[key] = { count: 1, entity: 'ARABIC_CLINICAL', lastSeen: now, confidence: 0.68, seeded: true };
    }
  }

  // Social/discharge vocabulary
  for (const term of SOCIAL_DISCHARGE) {
    const key = term.toLowerCase();
    if (!models.diagnoses[key]) {
      models.diagnoses[key] = { count: 1, entity: 'SOCIAL_DISCHARGE', lastSeen: now, confidence: 0.60, seeded: true };
    }
  }

  // Deep word corrections
  for (const [ocr, correction] of Object.entries(DEEP_WORD_CORRECTIONS)) {
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

  models.deepSeeded = true;
  return models;
}
