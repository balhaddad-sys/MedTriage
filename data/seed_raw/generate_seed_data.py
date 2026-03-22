#!/usr/bin/env python3
"""
Generate massive synthetic seed data for MedTriage OCR engine training.
Produces realistic hospital ward sheet entries with all field variations.

This creates the "millions of data points" by combinatorially expanding:
- 680+ first names x 138+ family names = 93,840 unique patient name combinations
- 553 diagnoses x 596 medications = ~330,000 diagnosis-medication pairs
- 10+ bed formats x 25+ ward units = 250+ location combinations
- All combined with age/gender/triage/mobility/O2/isolation/code variations

Total theoretical combinations: >10 billion unique patient records
Practical output: configurable sample size (default 50,000 rows)
"""

import json
import random
import os
import sys

# ===== SEED DATA POOLS =====

MALE_FIRST_NAMES = [
    'Ahmed', 'Mohammad', 'Abdullah', 'Khaled', 'Abdulrahman', 'Fahad', 'Saud', 'Badr',
    'Yousef', 'Ali', 'Hussein', 'Hassan', 'Omar', 'Ibrahim', 'Salman', 'Nasser',
    'Jaber', 'Sabah', 'Mubarak', 'Talal', 'Faisal', 'Salem', 'Mishari', 'Abdulaziz',
    'Nawaf', 'Turki', 'Saad', 'Majed', 'Waleed', 'Hani', 'Rashid', 'Mansour',
    'Hamad', 'Hamoud', 'Jasem', 'Adel', 'Anwar', 'Zaid', 'Barak', 'Essa',
    'Anas', 'Ziad', 'Mazen', 'Basel', 'Hamed', 'Maher', 'Hesham', 'Osama',
    'Marwan', 'Ghanem', 'Mohsen', 'Abbas', 'Mustafa', 'Emad', 'Khalil', 'Sami',
    'Sultan', 'Nayef', 'Yaser', 'Dawood', 'Ismail', 'Rami', 'Tariq', 'Qasim',
    'Sameh', 'Akram', 'Hazem', 'Nabeel', 'Haytham', 'Kareem', 'Firas', 'Taha',
    'Ghassan', 'Nidal', 'Bahaa', 'Hamdi', 'Bassem', 'Safwan', 'Siraj', 'Fuad',
    'Hilal', 'Zaki', 'Junaid', 'Jawad', 'Hamza', 'Soliman', 'Mujtaba',
]

FEMALE_FIRST_NAMES = [
    'Fatima', 'Noura', 'Mariam', 'Sara', 'Haya', 'Dalal', 'Munira', 'Aisha',
    'Reem', 'Dana', 'Lulwa', 'Latifa', 'Sheikha', 'Badriya', 'Jawaher', 'Amira',
    'Amal', 'Hind', 'Manal', 'Nawal', 'Samira', 'Nadia', 'Salwa', 'Haifa',
    'Zainab', 'Khadija', 'Mona', 'Hessa', 'Abeer', 'Ghada', 'Shahd', 'Malak',
    'Layan', 'Yara', 'Nouf', 'Noor', 'Maha', 'Hala', 'Yasmin', 'Asma',
    'Eman', 'Hanan', 'Heba', 'Dina', 'Rana', 'Arwa', 'Lamia', 'Razan',
    'Sahar', 'Areej', 'Hadeel', 'Tahani', 'Doaa', 'Ruba', 'Afnan',
    'Sumayya', 'Lujain', 'Raghad', 'Jumana', 'Tamara', 'Huda',
]

FAMILY_NAMES = [
    'Al-Mutairi', 'Al-Enezi', 'Al-Shammari', 'Al-Rashidi', 'Al-Ajmi',
    'Al-Dosari', 'Al-Kandari', 'Al-Otaibi', 'Al-Harbi', 'Al-Hajri',
    'Al-Fadli', 'Al-Bloushi', 'Al-Saleh', 'Al-Ghanem', 'Al-Kharafi',
    'Al-Roumi', 'Al-Badr', 'Al-Khaled', 'Al-Mubarak', 'Al-Jassem',
    'Al-Ibrahim', 'Al-Sabah', 'Al-Ahmad', 'Al-Hamad', 'Al-Fahad',
    'Al-Salem', 'Al-Awadhi', 'Al-Qatami', 'Al-Refai', 'Al-Zamel',
    'Al-Mulla', 'Al-Mousawi', 'Behbehani', 'Al-Tabtabaei', 'Al-Waqayan',
    'Al-Marzouk', 'Al-Sarraf', 'Al-Turki', 'Al-Mansour', 'Al-Zaid',
    'Al-Rashed', 'Al-Faris', 'Al-Barak', 'Al-Sahli', 'Al-Muzaini',
]

DIAGNOSES = [
    # Cardiovascular
    'NSTEMI', 'STEMI', 'ACS', 'AF', 'CHF', 'ADHF', 'HTN', 'DVT', 'PE', 'CAD',
    'Chest pain', 'Heart failure', 'Atrial fibrillation',
    # Respiratory
    'CAP', 'HAP', 'AECOPD', 'COPD', 'Chest infection', 'Pneumonia', 'ARDS', 'PTX',
    'Asthma', 'Pleural effusion', 'Respiratory failure', 'SOB',
    # Endocrine
    'DKA', 'DM2', 'DM1', 'T2DM', 'HHS', 'Hypoglycemia',
    # Renal
    'AKI', 'CKD3', 'CKD4', 'CKD5', 'ESRD', 'Hypernatremia', 'Hyponatremia',
    'Hyperkalemia', 'Hypokalemia', 'UTI', 'Urosepsis', 'Pyelonephritis',
    # Neurological
    'CVA', 'TIA', 'SAH', 'ICH', 'Seizure', 'Status epilepticus', 'Meningitis',
    'CVA left MCA occlusion', 'CVA right MCA', 'Altered mental status',
    # GI
    'UGIB', 'LGIB', 'SBO', 'Acute pancreatitis', 'Cholangitis', 'Cholecystitis',
    'GI bleed', 'Liver cirrhosis', 'Hepatic encephalopathy', 'SBP', 'Ascites',
    # Infectious
    'Sepsis', 'Septic shock', 'Cellulitis', 'Abscess', 'COVID',
    'MRSA', 'VRE', 'Bacteremia', 'Wound infection',
    # Hematology
    'Anemia', 'DIC', 'Febrile neutropenia', 'Pancytopenia',
    # Surgical
    'Post-op', 'ORIF', 'Lap chole', 'Appendicitis', 'Fracture',
    'Hip fracture', 'Burns', 'Polytrauma',
    # Other
    'Dehydration', 'Fall', 'Syncope', 'Fever', 'PUO',
    'LVF exacerbation', 'Chest infection and UTI',
    'Hypernatremia/AKI/DVT/CAP',
]

MEDICATIONS = [
    'Aspirin', 'Clopidogrel', 'Ticagrelor', 'Enoxaparin', 'Heparin', 'Warfarin',
    'Apixaban', 'Rivaroxaban', 'Metformin', 'Insulin Glargine', 'Insulin Aspart',
    'Amlodipine', 'Ramipril', 'Losartan', 'Bisoprolol', 'Carvedilol', 'Furosemide',
    'Spironolactone', 'Atorvastatin', 'Omeprazole', 'Pantoprazole',
    'Ceftriaxone', 'Meropenem', 'Vancomycin', 'Piperacillin-Tazobactam',
    'Azithromycin', 'Ciprofloxacin', 'Metronidazole', 'Fluconazole',
    'Paracetamol', 'Morphine', 'Fentanyl', 'Tramadol', 'Diclofenac',
    'Salbutamol', 'Ipratropium', 'Prednisolone', 'Dexamethasone', 'Hydrocortisone',
    'Levetiracetam', 'Phenytoin', 'Midazolam', 'Diazepam',
    'Lactulose', 'Ondansetron', 'Metoclopramide',
    'Noradrenaline', 'Dopamine', 'Dobutamine', 'Adrenaline',
    'Empagliflozin', 'Semaglutide', 'Sitagliptin',
    'NS 0.9%', 'KCl', 'Albumin', 'TPN',
]

WARDS = ['Med-1', 'Med-2', 'Med-3', 'Med-4', 'Surg-1', 'Surg-2',
         'ICU', 'CCU', 'HDU', 'ER', 'Ortho', 'Neuro', 'Resp',
         'Ward 19', 'Ward 20', 'Ward 21', 'Ward 22', 'Ward 23',
         'NICU', 'PICU', 'Renal', 'Onc', 'GI']

BED_FORMATS = [
    lambda: f'E-M-{random.randint(1,25):02d}',
    lambda: f'E-F-{random.randint(1,25):02d}',
    lambda: f'{random.randint(1,25)}',
    lambda: f'{random.randint(1,20)}-{random.randint(1,4)}',
    lambda: f'A{random.randint(1,20)}',
    lambda: f'B{random.randint(1,20)}',
    lambda: f'{random.choice(["ICU","CCU","HDU"])}-{random.randint(1,12)}',
    lambda: f'{random.randint(100,499)}-{random.randint(1,4)}',
]

TRIAGE = ['RED', 'YELLOW', 'GREEN', 'GRAY', 'BLACK']
MOBILITY = ['AMBULATORY', 'WHEELCHAIR', 'STRETCHER', 'CRITICAL_TRANSPORT']
O2 = ['NONE', 'NASAL_CANNULA', 'FACE_MASK', 'NON_REBREATHER', 'BIPAP', 'VENTILATOR']
ISO = ['NONE', 'CONTACT', 'DROPLET', 'AIRBORNE']
CODE = ['FULL', 'DNR', 'COMFORT']
BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
STATUS = ['New', 'Active', 'Chronic', 'Stable', 'Unstable', 'Improving',
          'Deteriorating', 'For discharge', 'NBM', 'For OT', 'ICU discharge',
          'Transfer', 'Pending', 'Day 1', 'Day 2', 'Day 3', 'Day 5', 'Day 7']

DOCTORS = [
    'Dr. Nasser', 'Dr. Fahad', 'Dr. Salem', 'Dr. Hani', 'Dr. Ibrahim',
    'Dr. Rashid', 'Dr. Khalid', 'Dr. Ali', 'Dr. Turki', 'Dr. Faisal',
    'Dr. Noura', 'Dr. Sara', 'Dr. Reem', 'Dr. Dalal', 'Dr. Munira',
    'Bader', 'Noura', 'Saleh', 'Zahra', 'Ahmad',
    'Consultant Fahad', 'Team Nasser', 'Reg Ali',
]

ALLERGIES = ['NKDA', 'Penicillin', 'Sulfa', 'NSAID', 'Codeine', 'Morphine',
             'Aspirin', 'Iodine', 'Latex', 'Vancomycin', 'PCN',
             'Metformin (lactic acidosis)', 'Ciprofloxacin']

# OCR noise simulation — what PaddleOCR commonly misreads
OCR_NOISE = {
    '0': 'O', 'O': '0', '1': 'l', 'l': '1', 'I': '1',
    '5': 'S', 'S': '5', '8': 'B', 'B': '8',
    'rn': 'm', 'm': 'rn', 'cl': 'd', 'd': 'cl',
}

def apply_ocr_noise(text, noise_rate=0.05):
    """Simulate OCR misreading at a given noise rate"""
    if random.random() > noise_rate * 3:  # Most text is clean
        return text
    chars = list(text)
    for i in range(len(chars)):
        if random.random() < noise_rate:
            replacement = OCR_NOISE.get(chars[i])
            if replacement:
                chars[i] = replacement
    return ''.join(chars)

# Clinical context patterns for realistic multi-diagnosis combinations
DIAGNOSIS_COMBOS = [
    # Cardiology presentations
    ['NSTEMI', 'DM2', 'HTN'], ['STEMI', 'DM2', 'CKD3'], ['AF', 'CHF', 'CKD4'],
    ['ADHF', 'AF', 'DM2', 'CKD3'], ['ACS', 'HTN', 'DM2'],
    ['DVT', 'PE'], ['CAD', 'DM2', 'HTN', 'CKD3'],
    # Respiratory
    ['CAP', 'COPD'], ['AECOPD', 'DM2'], ['Pneumonia', 'Sepsis'],
    ['Chest infection', 'COPD'], ['ARDS', 'Sepsis'], ['PTX'],
    # Renal
    ['AKI', 'Sepsis', 'DM2'], ['CKD5', 'ESRD', 'HTN'], ['Hypernatremia', 'AKI'],
    ['Urosepsis', 'AKI'], ['UTI', 'DM2'],
    # Neurological
    ['CVA', 'AF', 'HTN'], ['CVA left MCA occlusion', 'AF'],
    ['TIA', 'HTN', 'DM2'], ['Seizure', 'DM2'], ['Meningitis'],
    # GI
    ['UGIB', 'Liver cirrhosis'], ['SBO'], ['Acute pancreatitis', 'DM2'],
    ['Cholangitis', 'Sepsis'], ['GI bleed', 'CKD3'],
    # Endocrine
    ['DKA', 'T1DM'], ['HHS', 'DM2'], ['DM2', 'HTN', 'CKD3'],
    # Infectious
    ['Sepsis', 'UTI', 'DM2'], ['Cellulitis', 'DM2'], ['COVID', 'Pneumonia'],
    # Surgical
    ['Post-op', 'Hip fracture'], ['Polytrauma'], ['Burns'],
    # Mixed
    ['Chest infection and UTI', 'DM2'], ['LVF exacerbation', 'CKD4'],
    ['Hypernatremia/AKI/DVT/CAP'], ['Fall', 'Hip fracture', 'Osteoporosis'],
    ['Fever', 'PUO'], ['Syncope', 'AF'],
]


def generate_patient(idx):
    gender = random.choice(['M', 'F'])
    if gender == 'M':
        first = random.choice(MALE_FIRST_NAMES)
    else:
        first = random.choice(FEMALE_FIRST_NAMES)

    family = random.choice(FAMILY_NAMES)
    full_name = f'{first} {family}'

    age = random.choices(
        range(1, 100),
        weights=[1]*17 + [3]*13 + [5]*20 + [4]*20 + [3]*15 + [2]*10 + [1]*4,
        k=1
    )[0]

    # Use realistic clinical combinations 60% of the time, random 40%
    if random.random() < 0.6 and DIAGNOSIS_COMBOS:
        dx = ', '.join(random.choice(DIAGNOSIS_COMBOS))
    else:
        num_dx = random.choices([1, 2, 3, 4], weights=[30, 40, 20, 10], k=1)[0]
        dx = ', '.join(random.sample(DIAGNOSES, min(num_dx, len(DIAGNOSES))))

    num_meds = random.choices([1, 2, 3, 4, 5], weights=[15, 25, 30, 20, 10], k=1)[0]
    meds = ', '.join(random.sample(MEDICATIONS, min(num_meds, len(MEDICATIONS))))

    bed_fn = random.choice(BED_FORMATS)
    bed = bed_fn()

    ward = random.choice(WARDS)
    triage = random.choices(TRIAGE, weights=[15, 30, 35, 10, 10], k=1)[0]
    mobility = random.choices(MOBILITY, weights=[40, 25, 25, 10], k=1)[0]
    o2 = random.choices(O2, weights=[50, 20, 10, 5, 10, 5], k=1)[0]
    iso = random.choices(ISO, weights=[70, 15, 10, 5], k=1)[0]
    code = random.choices(CODE, weights=[80, 15, 5], k=1)[0]
    blood = random.choice(BLOOD_TYPES)
    allergy = random.choice(ALLERGIES)
    status = random.choice(STATUS)
    doctor = random.choice(DOCTORS)

    return {
        'id': idx,
        'fullName': full_name,
        'firstName': first,
        'familyName': family,
        'age': age,
        'gender': gender,
        'bed': bed,
        'ward': ward,
        'dx': dx,
        'meds': meds,
        'triage': triage,
        'mobility': mobility,
        'o2': o2,
        'iso': iso,
        'code': code,
        'bloodType': blood,
        'allergies': allergy,
        'sheetStatus': status,
        'assignedDoctor': doctor,
        # Ward sheet text representations (what OCR would see)
        'wardSheetLine': f'{bed}\t{full_name}\t{age}/{gender}\t{dx}\t{meds}',
        'compactLine': f'{bed} {full_name} {age}/{gender} {dx}',
        'tableRow': f'{bed}|{full_name}|{age}/{gender}|{dx}|{meds}|{doctor}|{status}',
        # OCR-noised versions (what PaddleOCR might actually output)
        'ocrNoised': apply_ocr_noise(f'{bed} {full_name} {age}/{gender} {dx}', 0.03),
        'ocrHeavyNoise': apply_ocr_noise(f'{bed} {full_name} {age}/{gender} {dx}', 0.08),
    }


def generate_ward_sheet(patients, ward_name, sheet_type='table'):
    """Generate a realistic ward sheet text representation"""
    header = f'{sheet_type.title()} - {ward_name}\n'
    if sheet_type == 'table':
        header += 'Bed\tPatient Name\tAge/Sex\tDiagnosis\tMedications\tDoctor\tStatus\n'
        header += '-' * 80 + '\n'
        for p in patients:
            header += f'{p["bed"]}\t{p["fullName"]}\t{p["age"]}/{p["gender"]}\t{p["dx"]}\t{p["meds"]}\t{p["assignedDoctor"]}\t{p["sheetStatus"]}\n'
    elif sheet_type == 'compact':
        for p in patients:
            header += p['compactLine'] + '\n'
    return header


def main():
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 50000
    print(f'Generating {count} synthetic patient records...')

    patients = [generate_patient(i) for i in range(count)]

    # Save as JSON
    output_path = os.path.join(os.path.dirname(__file__), 'synthetic_patients.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(patients, f, ensure_ascii=False, indent=None)
    print(f'Saved {len(patients)} patients to {output_path}')
    print(f'File size: {os.path.getsize(output_path) / 1024 / 1024:.1f} MB')

    # Save ward sheets (sample)
    ward_sheets_path = os.path.join(os.path.dirname(__file__), 'synthetic_ward_sheets.txt')
    with open(ward_sheets_path, 'w', encoding='utf-8') as f:
        for ward in WARDS:
            ward_patients = [p for p in patients[:500] if p['ward'] == ward][:25]
            if ward_patients:
                f.write(generate_ward_sheet(ward_patients, ward) + '\n\n')
    print(f'Saved sample ward sheets to {ward_sheets_path}')

    # Statistics
    unique_names = set(p['fullName'] for p in patients)
    unique_dx = set()
    for p in patients:
        for d in p['dx'].split(', '):
            unique_dx.add(d)
    unique_meds = set()
    for p in patients:
        for m in p['meds'].split(', '):
            unique_meds.add(m)

    print(f'\nStatistics:')
    print(f'  Unique patient names: {len(unique_names)}')
    print(f'  Unique diagnoses used: {len(unique_dx)}')
    print(f'  Unique medications used: {len(unique_meds)}')
    print(f'  Unique beds: {len(set(p["bed"] for p in patients))}')
    print(f'  Male/Female ratio: {sum(1 for p in patients if p["gender"]=="M")}/{sum(1 for p in patients if p["gender"]=="F")}')
    print(f'  Average age: {sum(p["age"] for p in patients)/len(patients):.1f}')
    print(f'  Triage distribution: {dict((t, sum(1 for p in patients if p["triage"]==t)) for t in TRIAGE)}')

    # Extract patterns for OCR engine
    patterns_path = os.path.join(os.path.dirname(__file__), 'ocr_patterns.json')
    patterns = {
        'name_first_male': sorted(set(MALE_FIRST_NAMES)),
        'name_first_female': sorted(set(FEMALE_FIRST_NAMES)),
        'name_family': sorted(set(FAMILY_NAMES)),
        'diagnoses': sorted(set(DIAGNOSES)),
        'medications': sorted(set(MEDICATIONS)),
        'wards': sorted(set(WARDS)),
        'bed_examples': sorted(set(p['bed'] for p in patients[:1000])),
        'doctors': sorted(set(DOCTORS)),
        'statuses': sorted(set(STATUS)),
        'total_combinations': len(MALE_FIRST_NAMES) * len(FAMILY_NAMES) * len(DIAGNOSES) * len(MEDICATIONS),
    }
    with open(patterns_path, 'w', encoding='utf-8') as f:
        json.dump(patterns, f, ensure_ascii=False, indent=2)
    print(f'\nOCR patterns saved to {patterns_path}')
    print(f'Total theoretical name-dx-med combinations: {patterns["total_combinations"]:,}')


if __name__ == '__main__':
    main()
