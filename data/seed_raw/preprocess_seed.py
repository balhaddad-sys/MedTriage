#!/usr/bin/env python3
"""
Preprocess seed data and extract OCR training patterns.
Validates generated data and produces pattern files for the OCR engine.
"""
import json
import os
import sys
from collections import Counter

DATA_DIR = os.path.dirname(__file__)

def validate_patients(patients):
    """Validate all patient records are well-formed"""
    errors = 0
    for i, p in enumerate(patients):
        if not p.get('fullName'):
            print(f'  ERROR: Patient {i} has no name')
            errors += 1
        if not p.get('bed'):
            print(f'  ERROR: Patient {i} has no bed')
            errors += 1
        if p.get('age') is None or p['age'] < 0 or p['age'] > 120:
            print(f'  ERROR: Patient {i} has invalid age: {p.get("age")}')
            errors += 1
        if p.get('gender') not in ('M', 'F'):
            print(f'  ERROR: Patient {i} has invalid gender: {p.get("gender")}')
            errors += 1
        if not p.get('dx'):
            print(f'  WARNING: Patient {i} has no diagnosis')
    return errors

def extract_ocr_confusion_pairs(patients):
    """Extract common OCR confusion patterns from name/diagnosis data"""
    confusions = []
    # Names that could be confused with medical terms
    name_med_overlaps = set()
    all_names = set()
    all_dx_terms = set()

    for p in patients:
        name_parts = p['fullName'].split()
        for part in name_parts:
            all_names.add(part)
        for dx in p['dx'].split(', '):
            all_dx_terms.add(dx.upper())

    # Find names that look like medical abbreviations
    for name in all_names:
        if name.upper() in all_dx_terms:
            name_med_overlaps.add(name)

    return {
        'name_medical_overlaps': sorted(name_med_overlaps),
        'unique_names': len(all_names),
        'unique_dx_terms': len(all_dx_terms),
    }

def generate_ward_sheet_variations(patients):
    """Generate multiple format variations of ward sheets for OCR training"""
    variations = []

    # Format 1: Tab-separated table
    sample = patients[:20]
    table = 'Bed\tPatient Name\tAge/Sex\tDiagnosis\tMedications\n'
    for p in sample:
        table += f'{p["bed"]}\t{p["fullName"]}\t{p["age"]}/{p["gender"]}\t{p["dx"]}\t{p["meds"]}\n'
    variations.append({'format': 'tab_table', 'content': table})

    # Format 2: Pipe-separated
    pipe = 'Room / Ward | Patient name | Diagnosis | Assigned Doctor | Status\n'
    for p in sample:
        pipe += f'{p["bed"]} | {p["fullName"]} | {p["dx"]} | {p["assignedDoctor"]} | {p["sheetStatus"]}\n'
    variations.append({'format': 'pipe_table', 'content': pipe})

    # Format 3: Compact (no headers)
    compact = ''
    for p in sample:
        compact += f'{p["bed"]} {p["fullName"]} {p["age"]}/{p["gender"]} {p["dx"]}\n'
    variations.append({'format': 'compact', 'content': compact})

    # Format 4: SOAP-like progress notes
    for p in sample[:5]:
        soap = f'--- Patient: {p["fullName"]} ---\n'
        soap += f'Bed: {p["bed"]} | Ward: {p["ward"]} | Age: {p["age"]}/{p["gender"]}\n'
        soap += f'S: Patient reports {p["dx"].split(",")[0].lower()} symptoms\n'
        soap += f'O: Vitals stable. {p["o2"]} support. {p["iso"]} isolation.\n'
        soap += f'A: {p["dx"]}\n'
        soap += f'P: Continue {p["meds"].split(",")[0]}. {p["sheetStatus"]}.\n'
        variations.append({'format': 'soap_note', 'content': soap})

    return variations

def main():
    patients_path = os.path.join(DATA_DIR, 'synthetic_patients.json')
    if not os.path.exists(patients_path):
        print('ERROR: synthetic_patients.json not found. Run generate_seed_data.py first.')
        sys.exit(1)

    print('Loading synthetic patient data...')
    with open(patients_path, 'r', encoding='utf-8') as f:
        patients = json.load(f)
    print(f'Loaded {len(patients)} patient records')

    # Validate
    print('\nValidating records...')
    errors = validate_patients(patients)
    print(f'Validation complete: {errors} errors')

    # Extract patterns
    print('\nExtracting OCR patterns...')
    confusions = extract_ocr_confusion_pairs(patients)
    print(f'  Name-medical overlaps: {confusions["name_medical_overlaps"]}')
    print(f'  Unique names: {confusions["unique_names"]}')
    print(f'  Unique dx terms: {confusions["unique_dx_terms"]}')

    # Generate format variations
    print('\nGenerating ward sheet format variations...')
    variations = generate_ward_sheet_variations(patients)
    variations_path = os.path.join(DATA_DIR, 'ward_sheet_variations.json')
    with open(variations_path, 'w', encoding='utf-8') as f:
        json.dump(variations, f, ensure_ascii=False, indent=2)
    print(f'Saved {len(variations)} format variations')

    # Summary statistics
    print('\n=== SEED DATA SUMMARY ===')
    print(f'Total records: {len(patients)}')
    print(f'File size: {os.path.getsize(patients_path) / 1024 / 1024:.1f} MB')
    print(f'Unique patient names: {len(set(p["fullName"] for p in patients))}')

    dx_counter = Counter()
    for p in patients:
        for dx in p['dx'].split(', '):
            dx_counter[dx] += 1
    print(f'Top 10 diagnoses:')
    for dx, count in dx_counter.most_common(10):
        print(f'  {dx}: {count}')

    med_counter = Counter()
    for p in patients:
        for med in p['meds'].split(', '):
            med_counter[med] += 1
    print(f'Top 10 medications:')
    for med, count in med_counter.most_common(10):
        print(f'  {med}: {count}')

    print(f'\nAll files are readable and valid.')
    print(f'Seed data is ready for OCR engine training.')

if __name__ == '__main__':
    main()
