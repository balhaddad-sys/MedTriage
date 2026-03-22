#!/usr/bin/env python3
"""
Ward Sheet Ground Truth Generator
Generates synthetic ward sheet images + JSON ground truth for OCR validation.

Output format matches ocrValidation.js expectations:
  { imageId, rawText, patients: [{ fullName, bed, age, gender, dx, meds, triage }] }

Usage:
  python scripts/generate-ward-sheet-ground-truth.py --count 500 --output training/ocr/ground-truth
"""

import argparse
import json
import math
import os
import random
import string
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

# ═══════════════════════════════════════════════════════════════
# PATIENT DATA POOLS (Kuwait/Gulf context)
# ═══════════════════════════════════════════════════════════════

MALE_FIRST = [
    'Ahmed','Mohammed','Abdullah','Khaled','Fahad','Nasser','Hamad','Ali','Ibrahim','Salem',
    'Jaber','Turki','Bader','Faisal','Saleh','Omar','Yousef','Mansour','Saud','Meshaal',
    'Abdulrahman','Hani','Waleed','Tariq','Rashid','Marwan','Hassan','Saad','Nawaf','Ziad',
    'Adel','Bashar','Ehab','Majed','Rami','Issam','Kamal','Murad','Wael','Jamal',
]

FEMALE_FIRST = [
    'Fatima','Sara','Noura','Hessa','Maryam','Dalal','Reem','Lulwa','Aseel','Dana',
    'Aisha','Hanan','Nada','Amira','Basma','Ghada','Hayat','Layla','Munira','Zahra',
    'Anfal','Bushra','Dina','Farah','Halima','Iman','Jamila','Khadija','Latifa','Manal',
]

FAMILY = [
    'Al-Mutairi','Al-Hajri','Al-Enezi','Al-Dosari','Al-Shammari','Al-Kandari','Al-Ajmi',
    'Al-Rashidi','Al-Otaibi','Al-Sabah','Al-Ghanim','Al-Fadli','Al-Harbi','Al-Azmi',
    'Al-Subaie','Al-Anazi','Al-Jaber','Al-Khaldi','Al-Deihani','Al-Bader',
    'Al-Salem','Al-Fahad','Al-Hamad','Al-Nasser','Al-Turki','Al-Mansour',
]

DIAGNOSES = [
    'NSTEMI, DM2, HTN','CAP, AECOPD','CVA (MCA), AF','DKA, T1DM','UGIB, CLD',
    'ADHF, CKD4, DM2','Acute Pancreatitis','Sepsis (UTI source), AKI','PE, DVT',
    'SBO','Pneumonia','CHF exacerbation','Cellulitis','UTI','Hyperkalemia, CKD5',
    'GI Bleed','COPD exacerbation','Atrial fibrillation','Diabetic foot','Stroke',
    'Meningitis','Status epilepticus','Hip fracture','Cholangitis','Cirrhosis, ascites',
    'ARDS','Septic shock','Liver failure','Renal failure','Bronchitis',
    'Asthma exacerbation','Anemia, transfusion','Fall, head injury','Chest pain, r/o ACS',
]

MEDICATIONS = [
    'Aspirin, Ticagrelor, Enoxaparin','Ceftriaxone, Azithromycin','Apixaban, Amlodipine',
    'Insulin Aspart, Insulin Glargine','Pantoprazole 80mg IV, Octreotide',
    'Furosemide 40mg IV, Carvedilol','NS 0.9%, Paracetamol, Ondansetron',
    'Meropenem, NS 0.9%','Heparin, Warfarin','Metformin, Atorvastatin',
    'Salbutamol, Ipratropium, Prednisolone','Levetiracetam, Midazolam',
    'Amoxicillin-Clavulanate','Ciprofloxacin','Omeprazole, Sucralfate',
    'Vancomycin, Piperacillin-Tazobactam','Morphine, Paracetamol',
    'Noradrenaline, Dobutamine','Dexamethasone, Remdesivir','KCl, MgSO4',
]

BLOOD_TYPES = ['A+','A-','B+','B-','AB+','AB-','O+','O-']
WARDS = ['Med-3','Med-5','ICU','CCU','Surg-2','Ortho-1','ER','HDU','NICU']
DOCTORS = ['Dr. Nasser','Dr. Hani','Dr. Fahad','Dr. Salem','Dr. Reem','Dr. Ali','Dr. Sara']
TRIAGE = ['RED','YELLOW','GREEN']
MOBILITY = ['AMBULATORY','WHEELCHAIR','STRETCHER','CRITICAL_TRANSPORT']

BED_FORMATS = [
    lambda i, g: f"E-{g}-{i:02d}",
    lambda i, g: f"{random.choice('ABCDE')}-{i}",
    lambda i, g: f"Bed {i}",
    lambda i, g: f"{random.randint(1,5)}{random.choice('AB')}-{i:02d}",
    lambda i, g: f"ICU-{i}",
    lambda i, g: f"Room {random.randint(100,599)}",
]

# ═══════════════════════════════════════════════════════════════
# PATIENT GENERATOR
# ═══════════════════════════════════════════════════════════════

def generate_patient(index):
    gender = random.choice(['M', 'F'])
    first = random.choice(MALE_FIRST if gender == 'M' else FEMALE_FIRST)
    family = random.choice(FAMILY)
    name = f"{first} {family}"
    age = random.choices(
        [random.randint(18, 40), random.randint(41, 65), random.randint(66, 95)],
        weights=[0.2, 0.45, 0.35], k=1
    )[0]
    bed_fmt = random.choice(BED_FORMATS)
    bed = bed_fmt(index + 1, 'M' if gender == 'M' else 'F')
    dx = random.choice(DIAGNOSES)
    meds = random.choice(MEDICATIONS) if random.random() > 0.15 else ''
    blood = random.choice(BLOOD_TYPES) if random.random() > 0.3 else ''
    ward = random.choice(WARDS)
    doctor = random.choice(DOCTORS) if random.random() > 0.2 else ''
    triage = random.choice(TRIAGE)

    return {
        'fullName': name, 'bed': bed, 'age': age, 'gender': gender,
        'dx': dx, 'meds': meds, 'bloodType': blood, 'ward': ward,
        'assignedDoctor': doctor, 'triage': triage,
    }

# ═══════════════════════════════════════════════════════════════
# FONT LOADING
# ═══════════════════════════════════════════════════════════════

def find_fonts():
    fonts_dir = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts'
    candidates = ['arial.ttf','arialbd.ttf','calibri.ttf','consola.ttf',
                  'tahoma.ttf','verdana.ttf','times.ttf','cour.ttf']
    found = [fonts_dir / f for f in candidates if (fonts_dir / f).exists()]
    if not found:
        # Linux fallback
        for d in ['/usr/share/fonts', '/usr/local/share/fonts']:
            for root, _, files in os.walk(d):
                for f in files:
                    if f.endswith('.ttf'):
                        found.append(Path(root) / f)
                        if len(found) >= 5:
                            break
    return found

def load_font(fonts, size, bold=False):
    preferred = [f for f in fonts if ('bd' in f.name.lower() or 'bold' in f.name.lower())] if bold else fonts
    for f in (preferred or fonts):
        try:
            return ImageFont.truetype(str(f), size)
        except Exception:
            continue
    return ImageFont.load_default()

# ═══════════════════════════════════════════════════════════════
# WARD SHEET RENDERING
# ═══════════════════════════════════════════════════════════════

SHEET_STYLES = ['clean-table', 'lined-table', 'whiteboard', 'handwritten-list', 'sparse-list']

def render_ward_sheet(patients, style, fonts, sheet_meta):
    """Render a complete ward sheet image with patients in rows."""
    n = len(patients)
    cols = ['Bed', 'Name', 'Age/Sex', 'Diagnosis', 'Meds', 'Triage']
    col_widths = [90, 200, 70, 250, 250, 70]
    total_w = sum(col_widths) + 40  # margins
    row_h = random.randint(28, 38)
    header_h = 50
    title_h = 40
    img_h = title_h + header_h + (n + 1) * row_h + 30

    # Background
    bg_color = (255, 255, 255)
    if style == 'whiteboard':
        bg_color = (240, 245, 250)
    elif style == 'handwritten-list':
        bg_color = (252, 250, 245)

    img = Image.new('RGB', (total_w, img_h), bg_color)
    draw = ImageDraw.Draw(img)

    title_font = load_font(fonts, random.randint(16, 20), bold=True)
    header_font = load_font(fonts, random.randint(12, 14), bold=True)
    body_font = load_font(fonts, random.randint(11, 13))
    small_font = load_font(fonts, random.randint(9, 11))

    # Title
    title = sheet_meta.get('title', f"{random.choice(WARDS)} Ward Sheet")
    draw.text((20, 10), title, fill=(0, 0, 0), font=title_font)

    # Date
    date_str = f"Date: 2026-03-{random.randint(1,28):02d}"
    draw.text((total_w - 180, 12), date_str, fill=(80, 80, 80), font=small_font)

    raw_lines = [title, date_str]

    # Header row
    y = title_h
    x = 20
    header_bg = (220, 225, 235) if style in ['clean-table', 'lined-table'] else bg_color
    if style in ['clean-table', 'lined-table']:
        draw.rectangle([18, y, total_w - 18, y + header_h - 5], fill=header_bg)

    header_texts = []
    for ci, col in enumerate(cols):
        draw.text((x, y + 8), col, fill=(30, 30, 30), font=header_font)
        header_texts.append(col)
        x += col_widths[ci]
    raw_lines.append('  '.join(header_texts))

    # Grid lines
    if style in ['clean-table', 'lined-table']:
        # Horizontal lines
        for ri in range(n + 2):
            ly = title_h + header_h + ri * row_h - 5
            draw.line([(18, ly), (total_w - 18, ly)], fill=(180, 180, 190), width=1)
        # Vertical lines
        vx = 20
        for cw in col_widths:
            draw.line([(vx - 2, title_h), (vx - 2, title_h + header_h + n * row_h - 5)], fill=(180, 180, 190), width=1)
            vx += cw

    # Patient rows
    y = title_h + header_h
    for pi, patient in enumerate(patients):
        x = 20
        row_color = (0, 0, 0)
        if style == 'whiteboard':
            row_color = random.choice([(0, 0, 0), (0, 0, 120), (120, 0, 0)])
        elif style == 'handwritten-list':
            row_color = (30, 30, 60)

        # Alternating row background
        if style in ['clean-table', 'lined-table'] and pi % 2 == 1:
            draw.rectangle([18, y - 2, total_w - 18, y + row_h - 7], fill=(245, 246, 250))

        row_texts = []

        # Bed
        bed_text = patient['bed']
        draw.text((x, y), bed_text, fill=row_color, font=body_font)
        row_texts.append(bed_text)
        x += col_widths[0]

        # Name
        name_text = patient['fullName']
        if style == 'handwritten-list' and random.random() < 0.3:
            name_text = name_text.lower()
        draw.text((x, y), name_text, fill=row_color, font=body_font)
        row_texts.append(name_text)
        x += col_widths[1]

        # Age/Sex
        age_sex = f"{patient['age']}/{patient['gender']}"
        draw.text((x, y), age_sex, fill=row_color, font=body_font)
        row_texts.append(age_sex)
        x += col_widths[2]

        # Diagnosis
        dx_text = patient['dx']
        # Truncate to fit
        max_dx_chars = col_widths[3] // 7
        if len(dx_text) > max_dx_chars:
            dx_text = dx_text[:max_dx_chars - 2] + '..'
        draw.text((x, y), dx_text, fill=row_color, font=small_font)
        row_texts.append(patient['dx'])  # ground truth keeps full
        x += col_widths[3]

        # Meds
        meds_text = patient.get('meds', '')
        max_med_chars = col_widths[4] // 7
        if len(meds_text) > max_med_chars:
            meds_text = meds_text[:max_med_chars - 2] + '..'
        draw.text((x, y), meds_text, fill=row_color, font=small_font)
        row_texts.append(patient.get('meds', ''))
        x += col_widths[4]

        # Triage
        triage_text = patient.get('triage', '')
        triage_colors = {'RED': (200, 0, 0), 'YELLOW': (180, 140, 0), 'GREEN': (0, 140, 0)}
        tc = triage_colors.get(triage_text, row_color)
        draw.text((x, y), triage_text, fill=tc, font=header_font)
        row_texts.append(triage_text)

        raw_lines.append('  '.join(str(t) for t in row_texts))
        y += row_h

    return img, '\n'.join(raw_lines)


# ═══════════════════════════════════════════════════════════════
# IMAGE DEGRADATION (realistic scan/photo artifacts)
# ═══════════════════════════════════════════════════════════════

def degrade_image(img, difficulty):
    """Apply realistic degradation: noise, blur, rotation, contrast."""
    if difficulty == 'clean':
        return img
    if difficulty in ('scan', 'medium'):
        img = ImageEnhance.Contrast(img).enhance(random.uniform(0.82, 0.96))
        img = ImageEnhance.Brightness(img).enhance(random.uniform(0.97, 1.06))
        if random.random() < 0.4:
            img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.3, 0.8)))
    if difficulty in ('photo', 'hard'):
        img = ImageEnhance.Contrast(img).enhance(random.uniform(0.7, 0.9))
        img = ImageEnhance.Brightness(img).enhance(random.uniform(0.92, 1.1))
        img = ImageEnhance.Sharpness(img).enhance(random.uniform(0.5, 0.85))
        img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.5, 1.3)))
    # Rotation
    if random.random() < 0.4:
        angle = random.uniform(-3, 3)
        img = img.rotate(angle, expand=True, fillcolor=(255, 255, 255))
    # Noise (speckle)
    if difficulty in ('photo', 'hard') and random.random() < 0.5:
        import numpy as np
        arr = np.array(img)
        noise = np.random.randint(-12, 12, arr.shape, dtype=np.int16)
        arr = np.clip(arr.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        img = Image.fromarray(arr)
    return img


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description='Generate ward sheet ground truth for OCR validation')
    parser.add_argument('--count', type=int, default=500, help='Number of ward sheets')
    parser.add_argument('--output', default='training/ocr/ground-truth', help='Output directory')
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--min-patients', type=int, default=3)
    parser.add_argument('--max-patients', type=int, default=12)
    args = parser.parse_args()

    random.seed(args.seed)
    output = Path(args.output)
    images_dir = output / 'images'
    images_dir.mkdir(parents=True, exist_ok=True)

    fonts = find_fonts()
    if not fonts:
        raise RuntimeError('No fonts found')

    ground_truth = []
    difficulties = ['clean', 'scan', 'medium', 'photo', 'hard']
    diff_weights = [0.15, 0.25, 0.25, 0.20, 0.15]

    for i in range(args.count):
        n_patients = random.randint(args.min_patients, args.max_patients)
        patients = [generate_patient(j) for j in range(n_patients)]
        style = random.choice(SHEET_STYLES)
        difficulty = random.choices(difficulties, weights=diff_weights, k=1)[0]
        ward = random.choice(WARDS)

        sheet_meta = {'title': f"{ward} Ward Sheet", 'ward': ward}
        img, raw_text = render_ward_sheet(patients, style, fonts, sheet_meta)
        img = degrade_image(img, difficulty)

        image_name = f"sheet_{i:04d}.png"
        img.save(images_dir / image_name)

        gt_entry = {
            'imageId': f"gt_{i:04d}",
            'imagePath': f"images/{image_name}",
            'rawText': raw_text,
            'patients': patients,
            'metadata': {
                'style': style,
                'difficulty': difficulty,
                'ward': ward,
                'patientCount': n_patients,
                'generator': 'medtriage-ground-truth-v1',
            },
        }
        ground_truth.append(gt_entry)

        if (i + 1) % 50 == 0:
            print(f"  Generated {i + 1}/{args.count} sheets")

    # Save ground truth JSON
    gt_path = output / 'ground_truth.json'
    with open(gt_path, 'w', encoding='utf-8') as f:
        json.dump(ground_truth, f, indent=2, ensure_ascii=False)

    # Stats
    total_patients = sum(len(gt['patients']) for gt in ground_truth)
    by_difficulty = {}
    by_style = {}
    for gt in ground_truth:
        d = gt['metadata']['difficulty']
        s = gt['metadata']['style']
        by_difficulty[d] = by_difficulty.get(d, 0) + 1
        by_style[s] = by_style.get(s, 0) + 1

    stats = {
        'totalSheets': len(ground_truth),
        'totalPatients': total_patients,
        'avgPatientsPerSheet': round(total_patients / len(ground_truth), 1),
        'byDifficulty': by_difficulty,
        'byStyle': by_style,
    }
    with open(output / 'stats.json', 'w') as f:
        json.dump(stats, f, indent=2)

    print(f"\nGround truth dataset generated:")
    print(f"  Sheets:   {len(ground_truth)}")
    print(f"  Patients: {total_patients}")
    print(f"  Output:   {output}")
    print(f"  Styles:   {by_style}")
    print(f"  Difficulty: {by_difficulty}")


if __name__ == '__main__':
    main()
