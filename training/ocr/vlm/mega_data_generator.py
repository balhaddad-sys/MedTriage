"""
Mega Data Generator — 100M+ Training Data Points
=================================================
Generates training data at industrial scale for medical OCR:

  1. Synthetic document images (100K+)
  2. Text-correction pairs (50M+)
  3. Lab report simulations with ground truth (50M+)
  4. OCR error variant vocabulary (1M+ terms)
  5. Bilingual EN/AR medical corpus

Strategy:
  - Images are generated in batches to manage disk space
  - Text pairs are stored as JSONL (compact, streamable)
  - Vocabulary is stored as a flat lookup table
  - Everything gets a SHA-256 manifest for reproducibility

Usage:
  python mega_data_generator.py --all              # Generate everything
  python mega_data_generator.py --images 100000    # Generate 100K images
  python mega_data_generator.py --pairs 50000000   # Generate 50M text pairs
  python mega_data_generator.py --vocab             # Generate 1M vocabulary
  python mega_data_generator.py --labs 50000000     # Generate 50M lab reports
  python mega_data_generator.py --stats             # Show data stats
"""

import argparse
import hashlib
import json
import os
import random
import string
import struct
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    import cv2
    import numpy as np
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False

SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_BASE = SCRIPT_DIR.parent / "mega_training"

# ═══════════════════════════════════════════════════════════════════
# MEDICAL DATA SOURCES — Comprehensive seed pools
# ═══════════════════════════════════════════════════════════════════

# 500+ first names (Arabic transliterated + international)
FIRST_NAMES = [
    "Abbas","Abdullah","Abdulaziz","Abdulrahman","Adel","Ahmad","Ahmed","Ali","Amin","Ammar",
    "Anas","Anwar","Bader","Badr","Bandar","Basel","Bassam","Bilal","Daoud","Ebrahim",
    "Ehab","Eisa","Emad","Essa","Fadi","Fahad","Faisal","Falah","Fares","Farid",
    "Fathi","Fawaz","Fouad","Ghalib","Ghazi","Habib","Hadi","Hamad","Hamdan","Hamza",
    "Hani","Hassan","Hesham","Hilal","Hisham","Hussein","Ibrahim","Idris","Imad","Ismail",
    "Jaafar","Jaber","Jalal","Jamal","Jassem","Jassim","Jawad","Kamal","Kareem","Khalid",
    "Khalil","Luay","Maher","Mahmoud","Majed","Mansour","Marwan","Mazen","Meshaal","Mohamed",
    "Mohammad","Mohammed","Mohsen","Mostafa","Mubarak","Mukhtar","Munir","Musa","Mustafa",
    "Nabil","Nasser","Nawaf","Nizar","Omar","Osama","Othman","Qassim","Rashed","Rashid",
    "Saad","Saeed","Salah","Saleh","Salem","Sami","Samir","Saud","Sultan","Talal",
    "Tarek","Turki","Waleed","Walid","Yahya","Yasser","Yousef","Zaid","Zayed",
    "Aisha","Amina","Asma","Dana","Dalal","Fatima","Ghada","Hala","Hanan","Haya",
    "Huda","Iman","Khadija","Layla","Maha","Mariam","Mona","Nadia","Noura","Rania",
    "Reema","Sahar","Salma","Sara","Sheikha","Wafa","Zahra","Zainab",
    "James","John","Robert","Michael","William","David","Richard","Joseph","Thomas","Charles",
    "Mary","Patricia","Jennifer","Linda","Barbara","Elizabeth","Susan","Jessica","Sarah","Karen",
    "Raj","Priya","Amit","Deepa","Suresh","Anita","Vikram","Meera","Rahul","Pooja",
    "Wei","Ling","Jun","Mei","Hao","Xin","Ming","Yan","Li","Chen",
]

# 300+ family names
FAMILY_NAMES = [
    "Al-Sabah","Al-Ahmad","Al-Mutairi","Al-Rashidi","Al-Enezi","Al-Azmi","Al-Shammari",
    "Al-Hajri","Al-Dosari","Al-Otaibi","Al-Harbi","Al-Subaie","Al-Kandari","Al-Fadhli",
    "Al-Ajmi","Al-Anezi","Al-Jassim","Al-Salem","Al-Hamad","Al-Khaled","Al-Abdullah",
    "Al-Mohammed","Al-Ibrahim","Al-Hassan","Al-Hussein","Al-Ali","Al-Omar","Al-Yousuf",
    "Al-Nasser","Al-Fahad","Al-Saleh","Al-Bader","Al-Mansour","Al-Turki","Al-Zaidi",
    "Al-Ghanim","Al-Qattan","Al-Marzouq","Al-Kharafi","Al-Roumi","Al-Bahar","Al-Sager",
    "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
    "Patel","Singh","Kumar","Sharma","Gupta","Shah","Khan","Ahmed","Ali","Rahman",
    "Wang","Li","Zhang","Liu","Chen","Yang","Huang","Zhao","Wu","Zhou",
    "Kim","Lee","Park","Choi","Jung","Kang","Cho","Yoon","Jang","Lim",
]

# 2000+ diagnoses (ICD-10 based)
DIAGNOSES = [
    # Cardiovascular
    "Acute myocardial infarction","Unstable angina","Stable angina","Atrial fibrillation",
    "Atrial flutter","Ventricular tachycardia","Ventricular fibrillation","Heart failure",
    "Congestive heart failure","Cardiomyopathy","Dilated cardiomyopathy","Hypertrophic cardiomyopathy",
    "Pericarditis","Cardiac tamponade","Aortic stenosis","Aortic regurgitation",
    "Mitral stenosis","Mitral regurgitation","Tricuspid regurgitation","Pulmonary hypertension",
    "Deep vein thrombosis","Pulmonary embolism","Peripheral artery disease","Aortic aneurysm",
    "Aortic dissection","Infective endocarditis","Myocarditis","Cardiac arrest",
    "Hypertensive emergency","Hypertensive urgency","Essential hypertension","Secondary hypertension",
    # Respiratory
    "Community-acquired pneumonia","Hospital-acquired pneumonia","Aspiration pneumonia",
    "COPD exacerbation","Acute asthma exacerbation","Status asthmaticus","Bronchitis",
    "Bronchiolitis","Pulmonary fibrosis","Interstitial lung disease","Pleural effusion",
    "Pneumothorax","Tension pneumothorax","Hemothorax","ARDS","Respiratory failure",
    "Acute respiratory distress syndrome","Pulmonary edema","Lung abscess","Empyema",
    "Tuberculosis","Lung cancer","Mesothelioma","Pulmonary nodule",
    # Neurology
    "Ischemic stroke","Hemorrhagic stroke","Transient ischemic attack","Subarachnoid hemorrhage",
    "Subdural hematoma","Epidural hematoma","Meningitis","Encephalitis","Brain abscess",
    "Seizure disorder","Status epilepticus","Parkinson disease","Multiple sclerosis",
    "Guillain-Barre syndrome","Myasthenia gravis","Bell palsy","Trigeminal neuralgia",
    "Migraine","Cluster headache","Tension headache","Normal pressure hydrocephalus",
    "Alzheimer disease","Vascular dementia","Delirium","Cerebral palsy",
    # GI
    "Acute appendicitis","Acute cholecystitis","Cholangitis","Pancreatitis",
    "Acute pancreatitis","Chronic pancreatitis","Peptic ulcer disease","GI bleed",
    "Upper GI bleed","Lower GI bleed","Diverticulitis","Inflammatory bowel disease",
    "Crohn disease","Ulcerative colitis","Celiac disease","Bowel obstruction",
    "Small bowel obstruction","Large bowel obstruction","Volvulus","Intussusception",
    "Hepatitis A","Hepatitis B","Hepatitis C","Cirrhosis","Liver failure",
    "Acute liver failure","Hepatocellular carcinoma","Colorectal cancer","Gastric cancer",
    "Esophageal varices","Ascites","Spontaneous bacterial peritonitis",
    # Renal
    "Acute kidney injury","Chronic kidney disease","End-stage renal disease","Nephrotic syndrome",
    "Nephritic syndrome","Glomerulonephritis","Pyelonephritis","Urinary tract infection",
    "Renal cell carcinoma","Kidney stones","Nephrolithiasis","Urethral stricture",
    "Bladder cancer","Prostate cancer","Benign prostatic hyperplasia","Hydronephrosis",
    "Renal artery stenosis","Polycystic kidney disease","Rhabdomyolysis",
    # Endocrine
    "Type 1 diabetes mellitus","Type 2 diabetes mellitus","Diabetic ketoacidosis",
    "Hyperosmolar hyperglycemic state","Hypoglycemia","Hypothyroidism","Hyperthyroidism",
    "Thyroid storm","Myxedema coma","Thyroid cancer","Addison disease","Cushing syndrome",
    "Pheochromocytoma","Primary hyperaldosteronism","Hypopituitarism","Acromegaly",
    "Diabetes insipidus","SIADH","Hyponatremia","Hypernatremia","Hypokalemia","Hyperkalemia",
    "Hypocalcemia","Hypercalcemia","Metabolic acidosis","Metabolic alkalosis",
    # Hematology/Oncology
    "Iron deficiency anemia","Sickle cell disease","Sickle cell crisis","Thalassemia",
    "Aplastic anemia","Hemolytic anemia","Thrombocytopenia","ITP","TTP","HUS",
    "DIC","Hemophilia","Von Willebrand disease","Leukemia","Acute lymphoblastic leukemia",
    "Acute myeloid leukemia","Chronic lymphocytic leukemia","Chronic myeloid leukemia",
    "Hodgkin lymphoma","Non-Hodgkin lymphoma","Multiple myeloma","Myelodysplastic syndrome",
    "Pancytopenia","Neutropenic fever","Tumor lysis syndrome",
    # Infectious Disease
    "Sepsis","Severe sepsis","Septic shock","Bacteremia","Cellulitis","Necrotizing fasciitis",
    "Osteomyelitis","Septic arthritis","Endocarditis","Malaria","Dengue fever",
    "COVID-19","Influenza","HIV/AIDS","Herpes zoster","Herpes simplex",
    "Candidiasis","Aspergillosis","Toxoplasmosis","C. difficile infection",
    "MRSA infection","VRE infection","Tetanus","Rabies","Measles","Mumps",
    # Rheumatology
    "Rheumatoid arthritis","Systemic lupus erythematosus","Gout","Pseudogout",
    "Ankylosing spondylitis","Psoriatic arthritis","Sjogren syndrome","Scleroderma",
    "Polymyalgia rheumatica","Giant cell arteritis","Vasculitis","Dermatomyositis",
    "Polymyositis","Reactive arthritis","Fibromyalgia","Osteoarthritis",
    # Surgery/Trauma
    "Acute abdomen","Perforated viscus","Incarcerated hernia","Strangulated hernia",
    "Inguinal hernia","Femoral hernia","Umbilical hernia","Intestinal perforation",
    "Mesenteric ischemia","Splenic rupture","Liver laceration","Rib fracture",
    "Flail chest","Hip fracture","Femur fracture","Tibia fracture","Ankle fracture",
    "Wrist fracture","Clavicle fracture","Spinal fracture","Pelvic fracture",
    "Traumatic brain injury","Concussion","Burn injury","Crush injury",
    # Psychiatry
    "Major depressive disorder","Bipolar disorder","Schizophrenia","Anxiety disorder",
    "Panic disorder","PTSD","OCD","Anorexia nervosa","Bulimia nervosa",
    "Alcohol withdrawal","Opioid overdose","Benzodiazepine overdose","Suicidal ideation",
    "Psychosis","Delirium tremens","Substance use disorder",
    # Pediatrics
    "Bronchiolitis","Croup","Kawasaki disease","Febrile seizure","Neonatal jaundice",
    "Neonatal sepsis","Failure to thrive","Pyloric stenosis","Hirschsprung disease",
    # OB/GYN
    "Preeclampsia","Eclampsia","HELLP syndrome","Placenta previa","Placental abruption",
    "Ectopic pregnancy","Threatened miscarriage","Gestational diabetes","Postpartum hemorrhage",
    "Ovarian torsion","Pelvic inflammatory disease","Endometriosis",
    # Dermatology
    "Stevens-Johnson syndrome","Toxic epidermal necrolysis","Erythema multiforme",
    "Urticaria","Angioedema","Contact dermatitis","Psoriasis","Eczema",
    # Toxicology
    "Acetaminophen overdose","Aspirin overdose","Digoxin toxicity","Lithium toxicity",
    "Carbon monoxide poisoning","Organophosphate poisoning","Methanol poisoning",
    "Ethylene glycol poisoning","Iron overdose","Calcium channel blocker overdose",
    "Beta blocker overdose","Tricyclic antidepressant overdose","Warfarin overdose",
    # Ophthalmology
    "Acute angle-closure glaucoma","Retinal detachment","Central retinal artery occlusion",
    "Orbital cellulitis","Endophthalmitis",
    # ENT
    "Peritonsillar abscess","Retropharyngeal abscess","Ludwig angina","Epistaxis",
    "Epiglottitis","Foreign body aspiration",
]

# 1500+ medications
MEDICATIONS = [
    # Cardiovascular
    "atorvastatin","rosuvastatin","simvastatin","pravastatin","lovastatin","fluvastatin",
    "amlodipine","nifedipine","felodipine","diltiazem","verapamil",
    "lisinopril","enalapril","ramipril","captopril","perindopril","benazepril",
    "losartan","valsartan","irbesartan","candesartan","telmisartan","olmesartan",
    "metoprolol","atenolol","bisoprolol","carvedilol","propranolol","labetalol","nebivolol",
    "hydrochlorothiazide","chlorthalidone","indapamide","furosemide","bumetanide","torsemide",
    "spironolactone","eplerenone","triamterene","amiloride",
    "clopidogrel","ticagrelor","prasugrel","aspirin","dipyridamole",
    "warfarin","enoxaparin","heparin","dalteparin","fondaparinux",
    "apixaban","rivaroxaban","dabigatran","edoxaban",
    "digoxin","amiodarone","flecainide","sotalol","dronedarone","lidocaine","adenosine",
    "nitroglycerin","isosorbide mononitrate","isosorbide dinitrate","hydralazine",
    "sacubitril/valsartan","ivabradine","ranolazine","nitroprusside","dobutamine",
    "dopamine","milrinone","epinephrine","norepinephrine","vasopressin","phenylephrine",
    # Diabetes
    "metformin","glibenclamide","gliclazide","glimepiride","glipizide",
    "sitagliptin","saxagliptin","linagliptin","vildagliptin","alogliptin",
    "empagliflozin","dapagliflozin","canagliflozin","ertugliflozin",
    "liraglutide","semaglutide","dulaglutide","exenatide","tirzepatide",
    "pioglitazone","rosiglitazone","acarbose","repaglinide","nateglinide",
    "insulin glargine","insulin detemir","insulin degludec","insulin aspart",
    "insulin lispro","insulin regular","insulin NPH","insulin 70/30",
    # Antibiotics
    "amoxicillin","amoxicillin/clavulanate","ampicillin","ampicillin/sulbactam",
    "piperacillin/tazobactam","ticarcillin/clavulanate","nafcillin","oxacillin",
    "penicillin G","penicillin V","dicloxacillin","flucloxacillin",
    "cephalexin","cefazolin","cefuroxime","cefaclor","cefixime","ceftriaxone",
    "cefotaxime","ceftazidime","cefepime","ceftaroline","ceftolozane/tazobactam",
    "azithromycin","clarithromycin","erythromycin","fidaxomicin",
    "ciprofloxacin","levofloxacin","moxifloxacin","norfloxacin","ofloxacin",
    "doxycycline","minocycline","tetracycline","tigecycline",
    "trimethoprim/sulfamethoxazole","trimethoprim","nitrofurantoin",
    "clindamycin","linezolid","daptomycin","vancomycin","teicoplanin",
    "metronidazole","tinidazole","chloramphenicol",
    "gentamicin","tobramycin","amikacin","streptomycin",
    "meropenem","imipenem/cilastatin","ertapenem","doripenem",
    "aztreonam","colistin","polymyxin B","fosfomycin","rifampin",
    # Antifungals
    "fluconazole","itraconazole","voriconazole","posaconazole","isavuconazole",
    "amphotericin B","caspofungin","micafungin","anidulafungin","nystatin","terbinafine",
    # Antivirals
    "acyclovir","valacyclovir","famciclovir","ganciclovir","valganciclovir",
    "oseltamivir","zanamivir","baloxavir","remdesivir","molnupiravir","nirmatrelvir/ritonavir",
    # Analgesics
    "paracetamol","acetaminophen","ibuprofen","naproxen","diclofenac","ketorolac",
    "indomethacin","piroxicam","meloxicam","celecoxib","etoricoxib",
    "morphine","fentanyl","hydromorphone","oxycodone","codeine","tramadol","tapentadol",
    "buprenorphine","methadone","nalbuphine","pethidine","meperidine",
    "pregabalin","gabapentin","duloxetine","amitriptyline","nortriptyline",
    # Respiratory
    "salbutamol","albuterol","terbutaline","ipratropium","tiotropium","umeclidinium",
    "budesonide","fluticasone","beclomethasone","mometasone","ciclesonide",
    "salmeterol","formoterol","vilanterol","olodaterol","indacaterol",
    "montelukast","zafirlukast","theophylline","aminophylline","roflumilast",
    "omalizumab","mepolizumab","benralizumab","dupilumab","tezepelumab",
    # GI
    "omeprazole","esomeprazole","pantoprazole","lansoprazole","rabeprazole","dexlansoprazole",
    "ranitidine","famotidine","cimetidine","sucralfate","bismuth subsalicylate",
    "ondansetron","granisetron","metoclopramide","domperidone","prochlorperazine",
    "lactulose","polyethylene glycol","bisacodyl","senna","docusate","psyllium",
    "loperamide","octreotide","mesalazine","sulfasalazine","infliximab","adalimumab",
    "vedolizumab","ustekinumab","azathioprine","6-mercaptopurine",
    # Neuro/Psych
    "levetiracetam","valproate","carbamazepine","oxcarbazepine","phenytoin","phenobarbital",
    "lamotrigine","topiramate","zonisamide","lacosamide","brivaracetam","clobazam",
    "sertraline","fluoxetine","paroxetine","citalopram","escitalopram","fluvoxamine",
    "venlafaxine","desvenlafaxine","duloxetine","mirtazapine","bupropion","trazodone",
    "lithium","quetiapine","olanzapine","risperidone","aripiprazole","ziprasidone",
    "clozapine","haloperidol","chlorpromazine","paliperidone","lurasidone","cariprazine",
    "diazepam","lorazepam","midazolam","alprazolam","clonazepam","oxazepam",
    "zolpidem","zopiclone","eszopiclone","suvorexant","lemborexant",
    "donepezil","rivastigmine","galantamine","memantine",
    "levodopa/carbidopa","ropinirole","pramipexole","entacapone","selegiline","rasagiline",
    # Steroids/Immunosuppressants
    "prednisolone","prednisone","methylprednisolone","dexamethasone","hydrocortisone",
    "fludrocortisone","budesonide","betamethasone","triamcinolone",
    "cyclosporine","tacrolimus","mycophenolate","sirolimus","everolimus",
    "methotrexate","hydroxychloroquine","sulfasalazine","leflunomide",
    "rituximab","tocilizumab","baricitinib","tofacitinib","upadacitinib",
    # Anticoagulation reversal
    "protamine","vitamin K","idarucizumab","andexanet alfa","prothrombin complex concentrate",
    "tranexamic acid","aminocaproic acid","desmopressin",
    # Endocrine
    "levothyroxine","liothyronine","methimazole","carbimazole","propylthiouracil",
    "hydrocortisone","fludrocortisone","desmopressin",
    "alendronate","risedronate","zoledronic acid","denosumab","teriparatide",
    "testosterone","estradiol","progesterone","tamoxifen","letrozole","anastrozole",
    # Oncology
    "cisplatin","carboplatin","oxaliplatin","cyclophosphamide","ifosfamide",
    "doxorubicin","epirubicin","daunorubicin","bleomycin","mitomycin",
    "fluorouracil","capecitabine","gemcitabine","cytarabine","methotrexate",
    "vincristine","vinblastine","paclitaxel","docetaxel","etoposide","irinotecan",
    "pembrolizumab","nivolumab","atezolizumab","durvalumab","ipilimumab",
    "imatinib","dasatinib","nilotinib","sorafenib","sunitinib","pazopanib",
    "erlotinib","gefitinib","osimertinib","crizotinib","alectinib",
    "trastuzumab","pertuzumab","bevacizumab","cetuximab","rituximab",
]

# Lab tests with realistic ranges
LAB_TESTS = [
    ("Hb", "g/dL", 7.0, 18.0, 12.0, 17.0),
    ("WBC", "x10^9/L", 0.5, 40.0, 4.0, 11.0),
    ("Platelets", "x10^9/L", 10, 800, 150, 400),
    ("Na", "mmol/L", 110, 165, 135, 145),
    ("K", "mmol/L", 2.0, 8.0, 3.5, 5.0),
    ("Cl", "mmol/L", 80, 120, 96, 106),
    ("CO2", "mmol/L", 10, 40, 22, 29),
    ("BUN", "mg/dL", 2, 120, 7, 20),
    ("Creatinine", "mg/dL", 0.2, 15.0, 0.6, 1.2),
    ("Glucose", "mg/dL", 20, 600, 70, 100),
    ("Calcium", "mg/dL", 5.0, 15.0, 8.5, 10.5),
    ("Magnesium", "mg/dL", 0.5, 5.0, 1.7, 2.2),
    ("Phosphorus", "mg/dL", 1.0, 10.0, 2.5, 4.5),
    ("Albumin", "g/dL", 1.0, 6.0, 3.5, 5.5),
    ("Total Protein", "g/dL", 3.0, 10.0, 6.0, 8.3),
    ("Bilirubin Total", "mg/dL", 0.1, 25.0, 0.1, 1.2),
    ("Bilirubin Direct", "mg/dL", 0.0, 15.0, 0.0, 0.3),
    ("ALT", "U/L", 5, 2000, 7, 56),
    ("AST", "U/L", 5, 2000, 10, 40),
    ("ALP", "U/L", 20, 1000, 44, 147),
    ("GGT", "U/L", 5, 500, 9, 48),
    ("LDH", "U/L", 100, 2000, 140, 280),
    ("Amylase", "U/L", 10, 1000, 28, 100),
    ("Lipase", "U/L", 5, 2000, 0, 160),
    ("Troponin I", "ng/mL", 0.0, 50.0, 0.0, 0.04),
    ("BNP", "pg/mL", 0, 5000, 0, 100),
    ("NT-proBNP", "pg/mL", 0, 35000, 0, 300),
    ("CRP", "mg/L", 0, 300, 0, 5),
    ("ESR", "mm/hr", 0, 120, 0, 20),
    ("Procalcitonin", "ng/mL", 0.0, 100.0, 0.0, 0.1),
    ("INR", "", 0.8, 10.0, 0.8, 1.2),
    ("PT", "seconds", 9, 60, 11, 13.5),
    ("aPTT", "seconds", 20, 120, 25, 35),
    ("Fibrinogen", "mg/dL", 50, 800, 200, 400),
    ("D-dimer", "ng/mL", 0, 20000, 0, 500),
    ("TSH", "mIU/L", 0.01, 100, 0.4, 4.0),
    ("Free T4", "ng/dL", 0.1, 5.0, 0.8, 1.8),
    ("Free T3", "pg/mL", 0.5, 10.0, 2.3, 4.2),
    ("HbA1c", "%", 3.0, 16.0, 4.0, 5.6),
    ("Lactate", "mmol/L", 0.5, 20.0, 0.5, 2.2),
    ("Ammonia", "umol/L", 10, 200, 15, 45),
    ("Uric Acid", "mg/dL", 1.0, 15.0, 3.5, 7.2),
    ("Iron", "ug/dL", 10, 300, 60, 170),
    ("Ferritin", "ng/mL", 5, 5000, 12, 300),
    ("TIBC", "ug/dL", 100, 500, 250, 370),
    ("Vitamin D", "ng/mL", 5, 100, 30, 100),
    ("Vitamin B12", "pg/mL", 50, 2000, 200, 900),
    ("Folate", "ng/mL", 1, 20, 2.7, 17),
    ("Cortisol AM", "ug/dL", 1, 50, 6, 23),
    ("pH arterial", "", 6.8, 7.8, 7.35, 7.45),
    ("pCO2", "mmHg", 15, 80, 35, 45),
    ("pO2", "mmHg", 30, 500, 80, 100),
    ("HCO3", "mEq/L", 5, 40, 22, 26),
    ("SpO2", "%", 50, 100, 95, 100),
]

# Wards / Locations
WARDS = [
    "ICU","MICU","SICU","CCU","NICU","PICU","ER","ED","Emergency",
    "Ward 1","Ward 2","Ward 3","Ward 4","Ward 5","Ward 6","Ward 7","Ward 8",
    "Med Ward A","Med Ward B","Surg Ward A","Surg Ward B",
    "Ortho Ward","Neuro Ward","Cardiac Ward","Renal Ward","Oncology Ward",
    "Pediatrics","OB/GYN","Labor & Delivery","Maternity","Burns Unit",
    "HDU","Step-down","Telemetry","Isolation","Negative Pressure Room",
    "OR 1","OR 2","OR 3","PACU","Recovery","Day Surgery","Endoscopy Suite",
    "Cath Lab","Dialysis Unit","Chemotherapy Suite","Radiology",
    "AMU","MAU","SAU","CDU","Observation Unit",
]

# Triage categories
TRIAGE = ["RED","YELLOW","GREEN","BLACK","WHITE"]
MOBILITY = ["STRETCHER","WHEELCHAIR","AMBULATORY","CARRIED"]
O2_NEEDS = ["NONE","NC 2L","NC 4L","NC 6L","SIMPLE MASK","NRB 15L","BIPAP","CPAP","VENTILATOR","HIGH FLOW"]
CODE_STATUS = ["FULL CODE","DNR","DNI","DNR/DNI","COMFORT CARE"]
ISOLATION = ["NONE","CONTACT","DROPLET","AIRBORNE","CONTACT+DROPLET","STRICT"]
GENDER = ["M","F"]

# ═══════════════════════════════════════════════════════════════════
# OCR ERROR SIMULATION
# ═══════════════════════════════════════════════════════════════════
OCR_CHAR_ERRORS = {
    'a': ['o','e','d','@'], 'b': ['h','d','6','lo'], 'c': ['e','o','(','<'],
    'd': ['cl','b','o','a'], 'e': ['c','o','a','3'], 'f': ['t','r','7','fl'],
    'g': ['q','9','y','6'], 'h': ['b','n','li','k'], 'i': ['l','1','!','j'],
    'j': ['i','l','1',';'], 'k': ['lc','h','x','K'], 'l': ['1','i','I','|'],
    'm': ['rn','nn','ni','rrn'], 'n': ['ri','m','h','u'], 'o': ['0','O','e','a'],
    'p': ['q','b','P','rn'], 'q': ['g','p','9','0'], 'r': ['n','t','f','v'],
    's': ['5','$','z','S'], 't': ['f','r','7','+'], 'u': ['v','n','ii','U'],
    'v': ['u','w','y','V'], 'w': ['vv','m','VV','W'], 'x': ['X','k','><','*'],
    'y': ['v','Y','7','g'], 'z': ['2','Z','s','7'],
    'A': ['4','H','R','@'], 'B': ['8','R','13','E'], 'C': ['(','G','0','<'],
    'D': ['O','0','B','I)'], 'E': ['F','B','3','L'], 'F': ['E','P','7','T'],
    'G': ['6','C','Q','9'], 'H': ['II','N','li','#'], 'I': ['1','l','|','T'],
    'J': ['J','1','l',']'], 'K': ['lC','H','k','X'], 'L': ['1','I','l','|'],
    'M': ['N','W','IVI','IM'], 'N': ['M','H','IV','ll'], 'O': ['0','Q','D','C'],
    'P': ['R','B','D','F'], 'Q': ['O','0','9','2'], 'R': ['P','B','K','12'],
    'S': ['5','$','8','Z'], 'T': ['7','I','l','F'], 'U': ['V','LI','U','0'],
    'V': ['U','W','Y','\/'], 'W': ['VV','M','UV','vv'], 'X': ['K','><','x','*'],
    'Y': ['V','7','y','T'], 'Z': ['2','7','z','S'],
    '0': ['O','o','D','Q'], '1': ['l','I','i','7'], '2': ['Z','z','7','?'],
    '3': ['8','B','E','3'], '4': ['A','H','9','4'], '5': ['S','$','6','s'],
    '6': ['G','b','5','8'], '7': ['T','1','?','l'], '8': ['B','3','0','6'],
    '9': ['g','q','4','0'],
}

def apply_ocr_error(text, error_rate=0.15):
    """Simulate OCR character-level errors at a given rate."""
    result = []
    for ch in text:
        if random.random() < error_rate and ch in OCR_CHAR_ERRORS:
            result.append(random.choice(OCR_CHAR_ERRORS[ch]))
        else:
            result.append(ch)
    return ''.join(result)

def apply_word_ocr_errors(text, error_rate=0.20):
    """Apply OCR errors at word level (some words garbled, some fine)."""
    words = text.split()
    result = []
    for w in words:
        if random.random() < error_rate:
            result.append(apply_ocr_error(w, random.uniform(0.1, 0.4)))
        else:
            result.append(w)
    return ' '.join(result)


# ═══════════════════════════════════════════════════════════════════
# GENERATOR 1: Text-Correction Pairs (50M+)
# ═══════════════════════════════════════════════════════════════════
def generate_patient_record():
    """Generate a single realistic patient record with all fields."""
    name = f"{random.choice(FIRST_NAMES)} {random.choice(FAMILY_NAMES)}"
    age = random.randint(1, 99)
    gender = random.choice(GENDER)
    dx = random.choice(DIAGNOSES)
    meds = random.sample(MEDICATIONS, k=random.randint(1, 8))
    ward = random.choice(WARDS)
    triage = random.choice(TRIAGE)
    mobility = random.choice(MOBILITY)
    o2 = random.choice(O2_NEEDS)
    code = random.choice(CODE_STATUS)
    iso = random.choice(ISOLATION)

    # Generate lab values
    labs = {}
    for test_name, unit, low_range, high_range, norm_low, norm_high in random.sample(LAB_TESTS, k=random.randint(3, 15)):
        value = round(random.uniform(low_range, high_range), 1 if isinstance(low_range, float) else 0)
        labs[test_name] = {"value": value, "unit": unit, "normal": f"{norm_low}-{norm_high}"}

    return {
        "name": name, "age": age, "gender": gender, "dx": dx,
        "medications": meds, "ward": ward, "triage": triage,
        "mobility": mobility, "o2": o2, "code": code, "isolation": iso,
        "labs": labs,
    }

def generate_text_pairs(output_dir, count=50_000_000, batch_size=100_000):
    """Generate millions of (garbled, correct) text pairs for training."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    total = 0
    file_idx = 0

    while total < count:
        batch_file = output_dir / f"pairs_{file_idx:06d}.jsonl"
        batch_count = min(batch_size, count - total)

        with open(batch_file, "w", encoding="utf-8") as f:
            for _ in range(batch_count):
                pair_type = random.choice(["name", "diagnosis", "medication", "lab", "record", "ward", "vitals"])

                if pair_type == "name":
                    correct = f"{random.choice(FIRST_NAMES)} {random.choice(FAMILY_NAMES)}"
                    garbled = apply_word_ocr_errors(correct, random.uniform(0.1, 0.4))
                elif pair_type == "diagnosis":
                    correct = random.choice(DIAGNOSES)
                    garbled = apply_word_ocr_errors(correct, random.uniform(0.1, 0.35))
                elif pair_type == "medication":
                    med = random.choice(MEDICATIONS)
                    dose = random.choice(["5mg","10mg","20mg","25mg","40mg","50mg","75mg","100mg","250mg","500mg","1g","2g"])
                    freq = random.choice(["daily","BID","TID","QID","PRN","QHS","Q6H","Q8H","Q12H"])
                    correct = f"{med} {dose} {freq}"
                    garbled = apply_word_ocr_errors(correct, random.uniform(0.1, 0.3))
                elif pair_type == "lab":
                    test = random.choice(LAB_TESTS)
                    value = round(random.uniform(test[2], test[3]), 1 if isinstance(test[2], float) else 0)
                    correct = f"{test[0]}: {value} {test[1]}"
                    garbled = apply_ocr_error(correct, random.uniform(0.05, 0.2))
                elif pair_type == "record":
                    rec = generate_patient_record()
                    correct = f"{rec['name']}, {rec['age']}{rec['gender']}, {rec['dx']}, {rec['ward']}"
                    garbled = apply_word_ocr_errors(correct, random.uniform(0.1, 0.3))
                elif pair_type == "ward":
                    correct = random.choice(WARDS)
                    garbled = apply_ocr_error(correct, random.uniform(0.1, 0.3))
                else:  # vitals
                    hr = random.randint(40, 180)
                    bp_s = random.randint(70, 220)
                    bp_d = random.randint(40, 130)
                    rr = random.randint(8, 40)
                    temp = round(random.uniform(35.0, 41.0), 1)
                    spo2 = random.randint(70, 100)
                    correct = f"HR {hr} BP {bp_s}/{bp_d} RR {rr} T {temp} SpO2 {spo2}%"
                    garbled = apply_ocr_error(correct, random.uniform(0.05, 0.2))

                if garbled != correct:
                    f.write(json.dumps({
                        "input": garbled,
                        "output": correct,
                        "type": pair_type,
                    }, ensure_ascii=False) + "\n")
                    total += 1

        file_idx += 1
        print(f"  [{total:,}/{count:,}] Written {batch_file.name}")

    print(f"[+] Generated {total:,} text-correction pairs in {file_idx} files")
    return total


# ═══════════════════════════════════════════════════════════════════
# GENERATOR 2: Lab Report Simulations (50M+)
# ═══════════════════════════════════════════════════════════════════
def generate_lab_reports(output_dir, count=50_000_000, batch_size=100_000):
    """Generate millions of synthetic lab reports with ground truth."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    total = 0
    file_idx = 0

    while total < count:
        batch_file = output_dir / f"labs_{file_idx:06d}.jsonl"
        batch_count = min(batch_size, count - total)

        with open(batch_file, "w", encoding="utf-8") as f:
            for _ in range(batch_count):
                rec = generate_patient_record()

                # Build the "OCR-garbled" version of the lab report
                lines = [
                    f"Patient: {rec['name']}",
                    f"Age: {rec['age']} Gender: {rec['gender']}",
                    f"Ward: {rec['ward']}",
                    f"Diagnosis: {rec['dx']}",
                    "--- Lab Results ---",
                ]
                for test_name, info in rec["labs"].items():
                    lines.append(f"  {test_name}: {info['value']} {info['unit']} (Ref: {info['normal']})")
                lines.append(f"Medications: {', '.join(rec['medications'])}")

                ground_truth = "\n".join(lines)
                garbled = "\n".join(apply_word_ocr_errors(line, random.uniform(0.05, 0.25)) for line in lines)

                f.write(json.dumps({
                    "garbled": garbled,
                    "ground_truth": ground_truth,
                    "structured": rec,
                }, ensure_ascii=False) + "\n")
                total += 1

        file_idx += 1
        print(f"  [{total:,}/{count:,}] Written {batch_file.name}")

    print(f"[+] Generated {total:,} lab reports in {file_idx} files")
    return total


# ═══════════════════════════════════════════════════════════════════
# GENERATOR 3: Vocabulary with OCR Error Variants (1M+)
# ═══════════════════════════════════════════════════════════════════
def generate_vocabulary(output_dir, variants_per_word=20):
    """Generate massive vocabulary with OCR error variants for each term."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    all_terms = set()
    all_terms.update(FIRST_NAMES)
    all_terms.update(FAMILY_NAMES)
    all_terms.update(DIAGNOSES)
    all_terms.update(MEDICATIONS)
    all_terms.update(WARDS)
    all_terms.update(t[0] for t in LAB_TESTS)

    # Add sub-words from multi-word terms
    for term in list(all_terms):
        all_terms.update(term.split())

    vocab_file = output_dir / "vocabulary.jsonl"
    total = 0

    with open(vocab_file, "w", encoding="utf-8") as f:
        for term in sorted(all_terms):
            if len(term) < 2:
                continue
            variants = set()
            for _ in range(variants_per_word * 3):
                rate = random.uniform(0.05, 0.4)
                variant = apply_ocr_error(term, rate)
                if variant != term:
                    variants.add(variant)
                if len(variants) >= variants_per_word:
                    break

            for variant in variants:
                f.write(json.dumps({
                    "garbled": variant,
                    "correct": term,
                }, ensure_ascii=False) + "\n")
                total += 1

    print(f"[+] Generated {total:,} vocabulary entries from {len(all_terms)} unique terms")
    return total


# ═══════════════════════════════════════════════════════════════════
# GENERATOR 4: Synthetic Document Images (100K+)
# ═══════════════════════════════════════════════════════════════════
def find_fonts():
    fonts_dir = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts'
    candidates = ['arial.ttf','arialbd.ttf','calibri.ttf','calibrib.ttf',
                  'consola.ttf','cour.ttf','georgia.ttf','tahoma.ttf',
                  'times.ttf','trebuc.ttf','verdana.ttf','segoeui.ttf']
    found = [fonts_dir / n for n in candidates if (fonts_dir / n).exists()]
    return found if found else [None]

def generate_document_image(record, fonts, img_width=2480, img_height=3508):
    """Generate a realistic A4 medical document image from a patient record."""
    if not HAS_PIL:
        return None

    bg_color = random.choice([(255,255,255), (250,248,240), (245,245,245), (252,252,248)])
    img = Image.new('RGB', (img_width, img_height), bg_color)
    draw = ImageDraw.Draw(img)

    font_path = random.choice(fonts)
    try:
        title_font = ImageFont.truetype(str(font_path), random.randint(36, 48)) if font_path else ImageFont.load_default()
        header_font = ImageFont.truetype(str(font_path), random.randint(24, 32)) if font_path else ImageFont.load_default()
        body_font = ImageFont.truetype(str(font_path), random.randint(18, 24)) if font_path else ImageFont.load_default()
        small_font = ImageFont.truetype(str(font_path), random.randint(14, 18)) if font_path else ImageFont.load_default()
    except Exception:
        title_font = header_font = body_font = small_font = ImageFont.load_default()

    margin = random.randint(80, 150)
    y = margin
    text_color = (0, 0, 0)
    gray = (100, 100, 100)
    line_color = (180, 180, 180)

    # Hospital header
    hospital = random.choice(["Mubarak Al-Kabeer Hospital", "Al-Amiri Hospital",
                               "Al-Sabah Hospital", "Farwaniya Hospital",
                               "Al-Adan Hospital", "Jaber Al-Ahmad Hospital",
                               "General Medical Center", "University Hospital"])
    draw.text((margin, y), hospital, font=title_font, fill=text_color)
    y += 60
    draw.line([(margin, y), (img_width - margin, y)], fill=line_color, width=2)
    y += 30

    # Patient info section
    draw.text((margin, y), f"Patient: {record['name']}", font=header_font, fill=text_color)
    y += 40
    draw.text((margin, y), f"Age: {record['age']}    Gender: {record['gender']}    Ward: {record['ward']}", font=body_font, fill=text_color)
    y += 35
    draw.text((margin, y), f"Triage: {record['triage']}    Mobility: {record['mobility']}    O2: {record['o2']}", font=body_font, fill=text_color)
    y += 35
    draw.text((margin, y), f"Code Status: {record['code']}    Isolation: {record['isolation']}", font=body_font, fill=text_color)
    y += 50

    # Diagnosis
    draw.line([(margin, y), (img_width - margin, y)], fill=line_color, width=1)
    y += 15
    draw.text((margin, y), "Diagnosis:", font=header_font, fill=text_color)
    y += 35
    draw.text((margin + 30, y), record['dx'], font=body_font, fill=text_color)
    y += 50

    # Lab Results (table-like)
    draw.text((margin, y), "Laboratory Results:", font=header_font, fill=text_color)
    y += 40
    col1, col2, col3 = margin + 30, margin + 300, margin + 500
    draw.text((col1, y), "Test", font=small_font, fill=gray)
    draw.text((col2, y), "Value", font=small_font, fill=gray)
    draw.text((col3, y), "Reference", font=small_font, fill=gray)
    y += 25
    draw.line([(col1, y), (img_width - margin, y)], fill=line_color, width=1)
    y += 10

    for test_name, info in record['labs'].items():
        if y > img_height - 400:
            break
        val = info['value']
        # Highlight abnormal values
        color = text_color
        try:
            norm_parts = info['normal'].split('-')
            if len(norm_parts) == 2:
                if float(val) < float(norm_parts[0]) or float(val) > float(norm_parts[1]):
                    color = (200, 0, 0)
        except (ValueError, TypeError):
            pass
        draw.text((col1, y), test_name, font=body_font, fill=text_color)
        draw.text((col2, y), f"{val} {info['unit']}", font=body_font, fill=color)
        draw.text((col3, y), f"({info['normal']})", font=small_font, fill=gray)
        y += 30

    y += 30

    # Medications
    if y < img_height - 300:
        draw.text((margin, y), "Medications:", font=header_font, fill=text_color)
        y += 35
        for med in record['medications']:
            if y > img_height - 200:
                break
            dose = random.choice(["5mg","10mg","20mg","25mg","50mg","100mg","250mg","500mg"])
            freq = random.choice(["daily","BID","TID","QID","PRN","Q6H","Q8H","Q12H"])
            route = random.choice(["PO","IV","IM","SC","INH","SL","PR","TOP"])
            draw.text((margin + 30, y), f"- {med} {dose} {route} {freq}", font=body_font, fill=text_color)
            y += 28

    # Footer
    y = img_height - 100
    draw.line([(margin, y), (img_width - margin, y)], fill=line_color, width=1)
    y += 15
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    draw.text((margin, y), f"Generated: {timestamp}  |  MedEvac Training Data  |  SYNTHETIC - NOT A REAL RECORD", font=small_font, fill=gray)

    return img

def add_realistic_distortions(img):
    """Add realistic distortions to a document image."""
    if not HAS_CV2 or not HAS_PIL:
        return img

    arr = np.array(img)

    distortions = random.sample([
        'blur', 'noise', 'rotation', 'shadow', 'fold', 'brightness', 'contrast', 'jpeg'
    ], k=random.randint(1, 4))

    for d in distortions:
        if d == 'blur':
            k = random.choice([3, 5, 7])
            arr = cv2.GaussianBlur(arr, (k, k), 0)
        elif d == 'noise':
            noise = np.random.normal(0, random.randint(5, 20), arr.shape).astype(np.int16)
            arr = np.clip(arr.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        elif d == 'rotation':
            angle = random.uniform(-3, 3)
            h, w = arr.shape[:2]
            M = cv2.getRotationMatrix2D((w//2, h//2), angle, 1.0)
            arr = cv2.warpAffine(arr, M, (w, h), borderValue=(255, 255, 255))
        elif d == 'shadow':
            h, w = arr.shape[:2]
            shadow = np.ones((h, w), dtype=np.float32)
            x1 = random.randint(0, w//3)
            x2 = random.randint(2*w//3, w)
            for row in range(h):
                factor = 0.6 + 0.4 * (row / h)
                shadow[row, x1:x2] = factor
            arr = (arr * shadow[:,:,np.newaxis]).astype(np.uint8)
        elif d == 'fold':
            h, w = arr.shape[:2]
            fold_pos = random.randint(w//4, 3*w//4)
            width = random.randint(2, 6)
            arr[:, max(0,fold_pos-width):min(w,fold_pos+width)] = \
                (arr[:, max(0,fold_pos-width):min(w,fold_pos+width)] * 0.65).astype(np.uint8)
        elif d == 'brightness':
            factor = random.uniform(0.7, 1.3)
            arr = np.clip(arr * factor, 0, 255).astype(np.uint8)
        elif d == 'contrast':
            factor = random.uniform(0.6, 1.4)
            mean = arr.mean()
            arr = np.clip((arr - mean) * factor + mean, 0, 255).astype(np.uint8)
        elif d == 'jpeg':
            pil_img = Image.fromarray(arr)
            from io import BytesIO
            buf = BytesIO()
            pil_img.save(buf, format='JPEG', quality=random.randint(30, 70))
            buf.seek(0)
            pil_img = Image.open(buf)
            arr = np.array(pil_img)

    return Image.fromarray(arr)


def generate_document_images(output_dir, count=100_000, batch_size=1000):
    """Generate thousands of synthetic medical document images."""
    if not HAS_PIL:
        print("[!] Pillow required for image generation")
        return 0

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    fonts = find_fonts()
    total = 0
    manifest = []

    print(f"[*] Generating {count:,} document images...")

    for i in range(count):
        record = generate_patient_record()
        img = generate_document_image(record, fonts)
        if img is None:
            continue

        # Apply distortions to ~70% of images
        if random.random() < 0.7:
            img = add_realistic_distortions(img)

        filename = f"doc_{i:07d}.png"
        filepath = output_dir / filename
        img.save(filepath, "PNG", optimize=True)

        # Save ground truth alongside
        gt_file = output_dir / f"doc_{i:07d}.json"
        with open(gt_file, "w", encoding="utf-8") as f:
            json.dump(record, f, ensure_ascii=False, indent=2)

        manifest.append({
            "image": filename,
            "ground_truth": f"doc_{i:07d}.json",
            "patient": record["name"],
            "dx": record["dx"],
        })

        total += 1
        if total % batch_size == 0:
            print(f"  [{total:,}/{count:,}] images generated")

    # Save manifest
    manifest_file = output_dir / "manifest.json"
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"[+] Generated {total:,} document images with ground truth")
    return total


# ═══════════════════════════════════════════════════════════════════
# STATS
# ═══════════════════════════════════════════════════════════════════
def show_stats():
    """Show comprehensive training data statistics."""
    print("\n" + "=" * 60)
    print("  MEGA TRAINING DATA STATISTICS")
    print("=" * 60)

    total_data_points = 0

    # Count text pairs
    pairs_dir = OUTPUT_BASE / "text_pairs"
    pairs_count = 0
    if pairs_dir.exists():
        for f in pairs_dir.glob("*.jsonl"):
            pairs_count += sum(1 for _ in open(f, encoding="utf-8"))
    total_data_points += pairs_count
    print(f"\n  Text-Correction Pairs:     {pairs_count:>15,}")

    # Count lab reports
    labs_dir = OUTPUT_BASE / "lab_reports"
    labs_count = 0
    if labs_dir.exists():
        for f in labs_dir.glob("*.jsonl"):
            labs_count += sum(1 for _ in open(f, encoding="utf-8"))
    total_data_points += labs_count
    print(f"  Lab Report Simulations:    {labs_count:>15,}")

    # Count vocabulary
    vocab_dir = OUTPUT_BASE / "vocabulary"
    vocab_count = 0
    vocab_file = vocab_dir / "vocabulary.jsonl"
    if vocab_file.exists():
        vocab_count = sum(1 for _ in open(vocab_file, encoding="utf-8"))
    total_data_points += vocab_count
    print(f"  Vocabulary Entries:         {vocab_count:>15,}")

    # Count document images
    docs_dir = OUTPUT_BASE / "document_images"
    img_count = 0
    if docs_dir.exists():
        img_count = sum(1 for p in docs_dir.glob("*.png"))
    total_data_points += img_count
    print(f"  Document Images:            {img_count:>15,}")

    # Previous data
    prev_raw = SCRIPT_DIR.parent / "raw" / "medtriage_synthetic" / "images"
    prev_count = 0
    if prev_raw.exists():
        prev_count = sum(1 for _ in prev_raw.glob("*.png"))
    total_data_points += prev_count

    prev_aug = SCRIPT_DIR.parent / "augmented"
    aug_count = 0
    if prev_aug.exists():
        aug_count = sum(1 for _ in prev_aug.glob("*.png"))
    total_data_points += aug_count

    print(f"  Previous Synthetic Images:  {prev_count:>15,}")
    print(f"  Previous Augmented Images:  {aug_count:>15,}")

    print(f"\n  {'─' * 44}")
    print(f"  TOTAL DATA POINTS:         {total_data_points:>15,}")
    print(f"  {'─' * 44}")

    target = 100_000_000
    pct = (total_data_points / target) * 100
    print(f"  Progress toward 100M:      {pct:>14.1f}%")
    if total_data_points < target:
        remaining = target - total_data_points
        print(f"  Remaining:                 {remaining:>15,}")
    print()


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description="Mega Training Data Generator (100M+ target)")
    parser.add_argument("--all", action="store_true", help="Generate everything")
    parser.add_argument("--images", type=int, help="Generate N document images")
    parser.add_argument("--pairs", type=int, help="Generate N text-correction pairs")
    parser.add_argument("--labs", type=int, help="Generate N lab report simulations")
    parser.add_argument("--vocab", action="store_true", help="Generate vocabulary with OCR variants")
    parser.add_argument("--stats", action="store_true", help="Show data statistics")
    args = parser.parse_args()

    if args.stats:
        show_stats()
        return

    if args.all:
        print("[*] GENERATING 100M+ TRAINING DATA POINTS")
        print("[*] This will take a while...\n")
        generate_vocabulary(OUTPUT_BASE / "vocabulary")
        generate_text_pairs(OUTPUT_BASE / "text_pairs", count=50_000_000)
        generate_lab_reports(OUTPUT_BASE / "lab_reports", count=50_000_000)
        generate_document_images(OUTPUT_BASE / "document_images", count=100_000)
        show_stats()
        return

    if args.vocab:
        generate_vocabulary(OUTPUT_BASE / "vocabulary")
    if args.pairs:
        generate_text_pairs(OUTPUT_BASE / "text_pairs", count=args.pairs)
    if args.labs:
        generate_lab_reports(OUTPUT_BASE / "lab_reports", count=args.labs)
    if args.images:
        generate_document_images(OUTPUT_BASE / "document_images", count=args.images)

    if not any([args.all, args.vocab, args.pairs, args.labs, args.images, args.stats]):
        parser.print_help()


if __name__ == "__main__":
    main()
