import argparse
import json
import os
import random
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

try:
    import arabic_reshaper
    from bidi.algorithm import get_display

    HAVE_ARABIC_SHAPER = True
except Exception:
    HAVE_ARABIC_SHAPER = False


def load_json(path: Path):
    with path.open('r', encoding='utf-8') as handle:
        return json.load(handle)


def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def normalize_text(text: str) -> str:
    return ' '.join(f'{text or ""}'.split()).strip()


def has_arabic(text: str) -> bool:
    return any('\u0600' <= char <= '\u06FF' for char in text)


def detect_language(text: str) -> str:
    if has_arabic(text):
        only_arabic = all(has_arabic(char) or char.isspace() or char in '/()-' for char in text)
        return 'arabic' if only_arabic else 'mixed'
    return 'latin'


def shape_text(text: str) -> str:
    if not HAVE_ARABIC_SHAPER or not has_arabic(text):
        return text
    return get_display(arabic_reshaper.reshape(text))


def find_fonts():
    fonts_dir = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts'
    candidates = [
        'arial.ttf',
        'arialbd.ttf',
        'calibri.ttf',
        'calibrib.ttf',
        'cambria.ttc',
        'georgia.ttf',
        'segoeui.ttf',
        'tahoma.ttf',
        'trebuc.ttf',
        'times.ttf',
        'verdana.ttf',
    ]
    return [fonts_dir / name for name in candidates if (fonts_dir / name).exists()]


def choose_font(fonts, size):
    for font_path in random.sample(fonts, k=len(fonts)):
        try:
            return ImageFont.truetype(str(font_path), size=size)
        except Exception:
            continue
    return ImageFont.load_default()


def choose(items, index: int, step: int = 0):
    return items[(index + step) % len(items)]


def apply_case_variant(text: str, family: str = 'generic') -> str:
    if has_arabic(text):
        return text

    if family == 'patient':
        variant = random.choices(['original', 'lower', 'title'], weights=[0.28, 0.57, 0.15], k=1)[0]
    elif family == 'doctor':
        variant = random.choices(['original', 'lower'], weights=[0.22, 0.78], k=1)[0]
    elif family == 'status':
        variant = random.choices(['original', 'title', 'upper'], weights=[0.62, 0.23, 0.15], k=1)[0]
    elif family == 'ward':
        variant = random.choices(['original', 'lower'], weights=[0.78, 0.22], k=1)[0]
    else:
        variant = random.choices(['original', 'lower', 'title'], weights=[0.58, 0.22, 0.20], k=1)[0]

    if variant == 'lower':
        return text.lower()
    if variant == 'upper':
        return text.upper()
    if variant == 'title':
        return ' '.join(
            token if token.upper() in {'ICU', 'ER', 'CCU', 'NICU', 'PICU', 'HDU', 'MAU', 'AMU', 'O2'} else token[:1].upper() + token[1:].lower()
            for token in text.split()
        )
    return text


def build_cell_sample(text: str, kind: str):
    normalized = normalize_text(text)
    return {
        'text': normalized,
        'cells': [normalized],
        'layout': 'cell',
        'kind': kind,
        'language': detect_language(normalized),
    }


def build_line_sample(text: str, kind: str):
    normalized = normalize_text(text)
    return {
        'text': normalized,
        'cells': [normalized],
        'layout': 'line',
        'kind': kind,
        'language': detect_language(normalized),
    }


def build_banner_sample(text: str, kind: str):
    normalized = normalize_text(text)
    return {
        'text': normalized,
        'cells': [normalized],
        'layout': 'banner',
        'kind': kind,
        'language': detect_language(normalized),
    }


def build_row_sample(cells, kind: str, preserve_empty: bool = False):
    normalized_cells = [normalize_text(cell) for cell in cells]
    clean_cells = [cell for cell in normalized_cells if cell]
    joined = normalize_text(' '.join(clean_cells))
    return {
        'text': joined,
        'cells': normalized_cells if preserve_empty else clean_cells,
        'layout': 'spreadsheet',
        'kind': kind,
        'language': detect_language(joined),
    }


def build_delimited_line_sample(cells, separator: str, kind: str):
    clean_cells = [normalize_text(cell) for cell in cells if normalize_text(cell)]
    joined = f' {separator} '.join(clean_cells)
    return {
        'text': normalize_text(joined),
        'cells': clean_cells,
        'layout': 'line',
        'kind': kind,
        'language': detect_language(joined),
    }


def build_sheet_block_sample(rows, kind: str):
    normalized_rows = []
    flat_cells = []

    for row in rows:
        if isinstance(row, dict):
            row_cells = [normalize_text(cell) for cell in row.get('cells', [])]
            row_text = normalize_text(row.get('text') or ' '.join(cell for cell in row_cells if cell))
        elif isinstance(row, (list, tuple)):
            row_cells = [normalize_text(cell) for cell in row]
            row_text = normalize_text(' '.join(cell for cell in row_cells if cell))
        else:
            row_text = normalize_text(row)
            row_cells = [row_text] if row_text else []

        if not row_text:
            continue

        normalized_rows.append({
            'text': row_text,
            'cells': row_cells,
        })
        flat_cells.extend([cell for cell in row_cells if cell])

    joined = normalize_text(' '.join(row['text'] for row in normalized_rows))
    return {
        'text': joined,
        'cells': flat_cells,
        'rows': normalized_rows,
        'layout': 'sheet-block',
        'kind': kind,
        'language': detect_language(joined),
    }


def split_name_for_wrap(name: str):
    tokens = [token for token in normalize_text(name).split() if token]
    if not tokens:
        return '', ''
    if len(tokens) == 1:
        token = tokens[0]
        if len(token) >= 8:
            pivot = max(3, len(token) // 2)
            return token[:pivot], token[pivot:]
        return token, token
    return tokens[0], ' '.join(tokens[1:])


SHEET_TITLE_RE = re.compile(r'ward transfer sheet|morning census|evening census|night census|bed board|unit census|daily census|ward handover|overnight handover|daily transfer list|er census|admission board|weekend census', re.I)
SECTION_TITLE_RE = re.compile(r'male list|female list|chronic list|acute list|transfer list|active patients|unassigned list|observation list|stepdown list|pending review', re.I)
HEADER_ROW_RE = re.compile(r'patient name|pt name|assigned doctor|assigned dr|consultant name|assigned consultant|primary team|responsible doctor|doctor|status|diagnosis|medication|medications|meds|medication notes|plan / notes|room', re.I)
WARD_BANNER_RE = re.compile(r'^(?:ward \d+|icu|ccu|nicu|picu|hdu|mau|amu|er(?:/unassigned)?|er unassigned|observation|holding|medical ward|surgical ward)$', re.I)


def pick_render_style(sample):
    layout = sample['layout']
    kind = sample['kind']

    if layout == 'spreadsheet':
        options = ['clean-sheet', 'washed-grid', 'banded-sheet', 'tight-crop', 'clipped-grid', 'dense-sheet']
        weights = [0.17, 0.20, 0.17, 0.16, 0.15, 0.15]
        if 'header' in kind:
            options = ['clean-sheet', 'washed-grid', 'tight-crop', 'clipped-grid']
            weights = [0.24, 0.34, 0.22, 0.20]
    elif layout == 'sheet-block':
        options = ['merged-sheet', 'phone-capture', 'faded-block', 'dense-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block', 'glare-block', 'shadow-block', 'title-clipped-block']
        weights = [0.14, 0.13, 0.12, 0.12, 0.09, 0.09, 0.07, 0.07, 0.07, 0.05, 0.05]
    elif layout == 'banner':
        options = ['clean-banner', 'soft-banner', 'tight-banner']
        weights = [0.42, 0.34, 0.24]
    else:
        options = ['clean-line', 'soft-scan', 'low-ink', 'tight-line', 'dense-line']
        weights = [0.23, 0.24, 0.19, 0.17, 0.17]

    return random.choices(options, weights=weights, k=1)[0]


def classify_difficulty(style: str) -> str:
    if style in {'washed-grid', 'tight-crop', 'tight-line', 'tight-banner', 'low-ink', 'clipped-grid', 'dense-sheet', 'dense-line', 'phone-capture', 'dense-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block', 'glare-block', 'title-clipped-block'}:
        return 'hard'
    if style in {'banded-sheet', 'soft-scan', 'soft-banner', 'merged-sheet', 'faded-block', 'shadow-block'}:
        return 'medium'
    return 'easy'


def add_scan_lines(canvas, strength: int = 10):
    draw = ImageDraw.Draw(canvas)
    step = random.randint(8, 14)
    for y in range(random.randint(0, 3), canvas.height, step):
        shade = max(205, 245 - strength - random.randint(0, 10))
        draw.line((0, y, canvas.width, y), fill=(shade, shade, shade), width=1)
    return canvas


def add_speckle_noise(canvas, density: float = 0.0025):
    draw = ImageDraw.Draw(canvas)
    count = max(6, int(canvas.width * canvas.height * density))
    for _ in range(count):
        x = random.randint(0, max(0, canvas.width - 1))
        y = random.randint(0, max(0, canvas.height - 1))
        shade = random.randint(170, 236)
        draw.point((x, y), fill=(shade, shade, shade))
    return canvas


def add_glare_band(canvas, alpha: float = 0.16):
    overlay = Image.new('RGB', canvas.size, color=(255, 255, 255))
    draw = ImageDraw.Draw(overlay)
    width = canvas.width
    height = canvas.height
    band_top = random.randint(0, max(8, height // 6))
    band_height = random.randint(max(20, height // 8), max(28, height // 3))
    left = random.randint(width // 4, max(width // 4 + 1, width // 2))
    right = width - random.randint(0, max(8, width // 12))
    draw.rectangle((left, band_top, right, min(height, band_top + band_height)), fill=(255, 252, 244))
    return Image.blend(canvas, overlay, alpha)


def add_margin_shadow(canvas, alpha: float = 0.12):
    overlay = Image.new('RGB', canvas.size, color=(255, 255, 255))
    draw = ImageDraw.Draw(overlay)
    width = canvas.width
    height = canvas.height
    side = random.choice(['left', 'right'])
    band_width = random.randint(max(18, width // 18), max(28, width // 10))
    shade = random.randint(188, 214)
    if side == 'left':
        draw.rectangle((0, 0, band_width, height), fill=(shade, shade, shade))
    else:
        draw.rectangle((width - band_width, 0, width, height), fill=(shade, shade, shade))
    return Image.blend(canvas, overlay, alpha)


def crop_and_pad(canvas, max_trim_x: int = 10, max_trim_y: int = 6):
    left = random.randint(0, min(max_trim_x, max(1, canvas.width // 12)))
    right = random.randint(0, min(max_trim_x, max(1, canvas.width // 12)))
    top = random.randint(0, min(max_trim_y, max(1, canvas.height // 8)))
    bottom = random.randint(0, min(max_trim_y, max(1, canvas.height // 8)))
    cropped = canvas.crop((left, top, max(left + 1, canvas.width - right), max(top + 1, canvas.height - bottom)))
    padded = Image.new('RGB', canvas.size, color=(255, 255, 255))
    paste_x = max(0, (canvas.width - cropped.width) // 2 + random.randint(-2, 2))
    paste_y = max(0, (canvas.height - cropped.height) // 2 + random.randint(-1, 1))
    padded.paste(cropped, (paste_x, paste_y))
    return padded


def crop_one_side(canvas, side: str, max_trim_x: int = 28, max_trim_y: int = 10):
    left = random.randint(0, min(6, max(1, canvas.width // 18)))
    right = random.randint(0, min(6, max(1, canvas.width // 18)))
    if side == 'left':
        left = random.randint(max_trim_x // 2, min(max_trim_x, max(8, canvas.width // 8)))
    else:
        right = random.randint(max_trim_x // 2, min(max_trim_x, max(8, canvas.width // 8)))
    top = random.randint(0, min(max_trim_y, max(1, canvas.height // 10)))
    bottom = random.randint(0, min(max_trim_y, max(1, canvas.height // 10)))
    cropped = canvas.crop((left, top, max(left + 1, canvas.width - right), max(top + 1, canvas.height - bottom)))
    padded = Image.new('RGB', canvas.size, color=(255, 255, 255))
    if side == 'left':
        paste_x = 0
    else:
        paste_x = max(0, canvas.width - cropped.width)
    paste_y = max(0, (canvas.height - cropped.height) // 2 + random.randint(-2, 2))
    padded.paste(cropped, (paste_x, paste_y))
    return padded


def crop_vertical_side(canvas, side: str, max_trim_y: int = 30, max_trim_x: int = 10):
    left = random.randint(0, min(max_trim_x, max(1, canvas.width // 16)))
    right = random.randint(0, min(max_trim_x, max(1, canvas.width // 16)))
    top = random.randint(0, min(6, max(1, canvas.height // 14)))
    bottom = random.randint(0, min(6, max(1, canvas.height // 14)))
    if side == 'top':
        top = random.randint(max_trim_y // 2, min(max_trim_y, max(10, canvas.height // 7)))
    else:
        bottom = random.randint(max_trim_y // 2, min(max_trim_y, max(10, canvas.height // 7)))
    cropped = canvas.crop((left, top, max(left + 1, canvas.width - right), max(top + 1, canvas.height - bottom)))
    padded = Image.new('RGB', canvas.size, color=(255, 255, 255))
    paste_x = max(0, (canvas.width - cropped.width) // 2 + random.randint(-2, 2))
    paste_y = 0 if side == 'top' else max(0, canvas.height - cropped.height)
    padded.paste(cropped, (paste_x, paste_y))
    return padded


def build_samples(domain, count):
    latin_first = [item for item in domain['firstNames'] if not has_arabic(item)]
    roster_names = domain.get('rosterNames') or latin_first
    doctor_names = domain.get('doctorNames') or latin_first
    arabic_roster = [item for item in roster_names if has_arabic(item)]

    beds = domain['beds']
    room_ward_tokens = domain.get('roomWardTokens') or beds
    numeric_room_tokens = [token for token in room_ward_tokens if token.isdigit()] or room_ward_tokens
    diagnoses = domain['medicalTerms']
    medications = domain['medications']
    ward_tokens = domain.get('wardTokens') or ['Ward 5', 'ICU', 'ER/Unassigned']
    section_titles = domain.get('sectionTitles') or ['Male list (active)', 'Chronic list']
    sheet_titles = domain.get('sheetTitles') or ['Ward Transfer Sheet', 'Morning Census']
    sheet_headers = domain.get('sheetHeaders') or ['Room / Ward', 'Patient name', 'Diagnosis', 'Assigned Doctor', 'Status']
    sheet_header_rows = domain.get('sheetHeaderRows') or ['Room / Ward Patient name Diagnosis Assigned Doctor Status']
    sheet_statuses = domain.get('sheetStatuses') or ['New', 'Chronic', 'ICU discharge']
    detail_diagnoses = domain.get('detailDiagnosisPhrases') or ['CVA left MCA occlusion', 'Ischemic stroke', 'UTI, weight loss']
    doctor_titles = domain.get('doctorTitles') or ['Dr', 'Dr.', 'Consultant', 'Team']
    room_headers = ['Room / Ward', 'Ward / Room', 'Room No', 'Ward / Bed']
    patient_headers = ['Patient name', 'Patient Name', 'Pt Name']
    diagnosis_headers = ['Diagnosis', 'Dx']
    medication_headers = ['Medication', 'Medications', 'Meds', 'Medication / Notes', 'Medication Notes', 'Plan / Notes']
    doctor_headers = ['Assigned Doctor', 'Assigned Dr', 'Consultant Name', 'Assigned Consultant', 'Doctor', 'Primary Team', 'Responsible Doctor']
    status_headers = ['Status', 'List Status', 'Category', 'Disposition']
    active_sections = [item for item in section_titles if re.search(r'active|acute|pending', item, re.I)] or section_titles
    chronic_sections = [item for item in section_titles if re.search(r'chronic', item, re.I)] or section_titles
    transfer_sections = [item for item in section_titles if re.search(r'transfer|unassigned|observation|stepdown', item, re.I)] or section_titles

    sample_types = [
        'patient_name',
        'patient_name',
        'patient_name',
        'patient_name',
        'doctor_name',
        'doctor_name',
        'doctor_name',
        'doctor_titled',
        'room_cell',
        'room_cell',
        'ward_banner',
        'section_banner',
        'sheet_title',
        'status_banner',
        'status_cell',
        'status_cell',
        'header_cell',
        'header_cell',
        'diagnosis',
        'detail_diagnosis',
        'detail_diagnosis',
        'medication',
        'row_spreadsheet',
        'row_spreadsheet',
        'row_spreadsheet',
        'row_spreadsheet',
        'row_detail_spreadsheet',
        'row_headerless',
        'row_headerless',
        'row_sparse',
        'row_doctorless',
        'row_statusless',
        'row_room_number_roster',
        'ward_inline_roster_row',
        'ward_pipe_row',
        'title_section_header_row',
        'header_alias_row',
        'doctor_ward_status_row',
        'sheet_section_block',
        'multi_section_census_block',
        'medication_handover_block',
        'overnight_handover_block',
        'active_chronic_sheet_block',
        'roomless_status_mix_block',
        'medication_continuation_block',
        'unassigned_transfer_block',
        'ward_round_block',
        'mixed_language_block',
        'repeated_header_block',
        'wrapped_diagnosis_block',
        'stacked_ward_block',
        'split_name_block',
        'partial_header_block',
        'title_header_row',
        'section_status_row',
        'doctor_status_row',
        'numeric_pipe_row',
        'row_room_name',
        'row_room_status',
        'row_name_dx',
        'row_pipe',
        'row_pipe',
        'section_context_row',
        'section_pipe_row',
        'header_pipe_row',
        'section_header_row',
        'row_bed_age',
        'header_row',
        'name_arabic',
    ]

    cycle = []
    for index in range(count):
        if index % len(sample_types) == 0:
            cycle = sample_types[:]
            random.shuffle(cycle)

        age = 18 + (index % 75)
        gender = 'M' if index % 2 == 0 else 'F'
        patient_name = apply_case_variant(choose(roster_names, index, 7), 'patient')
        doctor_name = apply_case_variant(choose(doctor_names, index, 19), 'doctor')
        doctor_title = choose(doctor_titles, index, 37)
        room = choose(room_ward_tokens, index, 3)
        numeric_room = choose(numeric_room_tokens, index, 47)
        room_alt = choose(room_ward_tokens, index, 83)
        room_third = choose(room_ward_tokens, index, 97)
        bed = choose(beds, index, 11)
        ward = apply_case_variant(choose(ward_tokens, index, 5), 'ward')
        diagnosis = choose(diagnoses, index, 13)
        detail_diagnosis = choose(detail_diagnoses, index, 41)
        diagnosis_alt = choose(diagnoses, index, 53)
        detail_diagnosis_alt = choose(detail_diagnoses, index, 59)
        detail_diagnosis_third = choose(detail_diagnoses, index, 89)
        medication = choose(medications, index, 17)
        medication_alt = choose(medications, index, 157)
        medication_third = choose(medications, index, 179)
        status = apply_case_variant(choose(sheet_statuses, index, 23), 'status')
        status_alt = apply_case_variant(choose(sheet_statuses, index, 29), 'status')
        status_third = apply_case_variant(choose(sheet_statuses, index, 97), 'status')
        section_title = choose(section_titles, index, 2)
        section_title_alt = choose(section_titles, index, 149)
        section_title_third = choose(section_titles, index, 151)
        active_section = choose(active_sections, index, 211)
        chronic_section = choose(chronic_sections, index, 223)
        transfer_section = choose(transfer_sections, index, 227)
        sheet_title = choose(sheet_titles, index, 43)
        header = choose(sheet_headers, index, 29)
        header_row = choose(sheet_header_rows, index, 31)
        room_header = choose(room_headers, index, 59)
        patient_header = choose(patient_headers, index, 61)
        diagnosis_header = choose(diagnosis_headers, index, 67)
        medication_header = choose(medication_headers, index, 69)
        doctor_header = choose(doctor_headers, index, 71)
        status_header = choose(status_headers, index, 73)
        patient_name_alt = apply_case_variant(choose(roster_names, index, 79), 'patient')
        patient_name_third = apply_case_variant(choose(roster_names, index, 91), 'patient')
        patient_name_fourth = apply_case_variant(choose(roster_names, index, 137), 'patient')
        doctor_name_alt = apply_case_variant(choose(doctor_names, index, 101), 'doctor')
        doctor_name_third = apply_case_variant(choose(doctor_names, index, 113), 'doctor')
        doctor_title_alt = choose(doctor_titles, index, 127)
        doctor_title_third = choose(doctor_titles, index, 131)
        ward_alt = apply_case_variant(choose(ward_tokens, index, 141), 'ward')
        ward_third = apply_case_variant(choose(ward_tokens, index, 173), 'ward')
        arabic_name = choose(arabic_roster, index, 31) if arabic_roster else patient_name
        patient_name_head, patient_name_tail = split_name_for_wrap(patient_name)
        patient_name_alt_head, patient_name_alt_tail = split_name_for_wrap(patient_name_alt)
        sample_type = cycle[index % len(sample_types)]

        if sample_type == 'patient_name':
            sample = build_cell_sample(patient_name, 'patient-name')
        elif sample_type == 'doctor_name':
            sample = build_cell_sample(doctor_name, 'doctor-name')
        elif sample_type == 'doctor_titled':
            sample = build_cell_sample(f"{doctor_title} {doctor_name}", 'doctor-titled')
        elif sample_type == 'room_cell':
            sample = build_cell_sample(room, 'room-cell')
        elif sample_type == 'ward_banner':
            sample = build_banner_sample(ward, 'ward-banner')
        elif sample_type == 'section_banner':
            sample = build_banner_sample(section_title, 'section-banner')
        elif sample_type == 'sheet_title':
            sample = build_banner_sample(sheet_title, 'sheet-title')
        elif sample_type == 'status_banner':
            sample = build_banner_sample(status, 'status-banner')
        elif sample_type == 'status_cell':
            sample = build_cell_sample(status, 'status-cell')
        elif sample_type == 'header_cell':
            sample = build_cell_sample(header, 'header-cell')
        elif sample_type == 'diagnosis':
            sample = build_line_sample(diagnosis, 'diagnosis')
        elif sample_type == 'detail_diagnosis':
            sample = build_line_sample(detail_diagnosis, 'detail-diagnosis')
        elif sample_type == 'medication':
            sample = build_line_sample(medication, 'medication')
        elif sample_type == 'row_spreadsheet':
            sample = build_row_sample([room, patient_name, diagnosis, doctor_name, status], 'spreadsheet-row')
        elif sample_type == 'row_detail_spreadsheet':
            sample = build_row_sample([room, patient_name, detail_diagnosis, f"{doctor_title} {doctor_name}", status], 'detail-spreadsheet-row')
        elif sample_type == 'row_headerless':
            sample = build_row_sample([patient_name, diagnosis, doctor_name, status], 'headerless-row')
        elif sample_type == 'row_sparse':
            sample = build_row_sample([room, patient_name, detail_diagnosis, '', ''], 'sparse-spreadsheet-row', preserve_empty=True)
        elif sample_type == 'row_doctorless':
            sample = build_row_sample([room, patient_name, detail_diagnosis, '', status], 'doctorless-row', preserve_empty=True)
        elif sample_type == 'row_statusless':
            sample = build_row_sample([room, patient_name, detail_diagnosis, doctor_name, ''], 'statusless-row', preserve_empty=True)
        elif sample_type == 'row_room_number_roster':
            sample = build_row_sample([numeric_room, patient_name, detail_diagnosis, f"{doctor_title} {doctor_name}", status], 'room-number-roster-row')
        elif sample_type == 'ward_inline_roster_row':
            sample = build_line_sample(f"{ward} {numeric_room} {patient_name} {detail_diagnosis} {doctor_title} {doctor_name} {status}", 'ward-inline-roster-row')
        elif sample_type == 'ward_pipe_row':
            sample = build_delimited_line_sample([ward, numeric_room, patient_name, detail_diagnosis, f"{doctor_title} {doctor_name}", status], '|', 'ward-pipe-row')
        elif sample_type == 'title_section_header_row':
            sample = build_line_sample(f"{sheet_title} {section_title} {header_row}", 'title-section-header-row')
        elif sample_type == 'header_alias_row':
            sample = build_row_sample([room_header, patient_header, diagnosis_header, doctor_header, status_header], 'header-alias-row')
        elif sample_type == 'doctor_ward_status_row':
            sample = build_line_sample(f"{doctor_title} {doctor_name} {ward} {status}", 'doctor-ward-status-row')
        elif sample_type == 'sheet_section_block':
            sample = build_sheet_block_sample([
                sheet_title,
                section_title,
                [room_header, patient_header, diagnosis_header, doctor_header, status_header],
                ward,
                [numeric_room, patient_name, detail_diagnosis, f"{doctor_title} {doctor_name}", status],
                [room_alt, patient_name_alt, detail_diagnosis_alt, f"{doctor_title_alt} {doctor_name_alt}", status_alt],
            ], 'sheet-section-block')
        elif sample_type == 'multi_section_census_block':
            sample = build_sheet_block_sample([
                sheet_title,
                section_title,
                [room_header, patient_header, diagnosis_header, medication_header, doctor_header, status_header],
                ward,
                [numeric_room, patient_name, detail_diagnosis, medication, f"{doctor_title} {doctor_name}", status],
                [room_alt, patient_name_alt, detail_diagnosis_alt, medication_alt, f"{doctor_title_alt} {doctor_name_alt}", status_alt],
                section_title_alt,
                [room_header, patient_header, diagnosis_header, medication_header, doctor_header, status_header],
                ward_alt,
                [room_third, patient_name_third, detail_diagnosis_third, medication_third, f"{doctor_title_third} {doctor_name_third}", status_third],
                [numeric_room, patient_name_fourth, diagnosis_alt, medication, '', status],
            ], 'multi-section-census-block')
        elif sample_type == 'medication_handover_block':
            sample = build_sheet_block_sample([
                sheet_title,
                section_title,
                [room_header, patient_header, diagnosis_header, medication_header, doctor_header, status_header],
                ward,
                [numeric_room, patient_name, detail_diagnosis, medication, f"{doctor_title} {doctor_name}", status],
                ['', '', '', medication_alt, '', ''],
                [room_alt, patient_name_alt, detail_diagnosis_alt, medication_third, f"{doctor_title_alt} {doctor_name_alt}", status_alt],
                [room_third, patient_name_third, diagnosis_alt, medication, f"{doctor_title_third} {doctor_name_third}", status_third],
            ], 'medication-handover-block')
        elif sample_type == 'overnight_handover_block':
            sample = build_sheet_block_sample([
                sheet_title,
                section_title,
                [room_header, patient_header, diagnosis_header, doctor_header, status_header],
                ward,
                [numeric_room, patient_name, detail_diagnosis, f"{doctor_title} {doctor_name}", status],
                ['', '', detail_diagnosis_alt, '', ''],
                [room_header, patient_header, diagnosis_header, doctor_header, status_header],
                ward_alt,
                [room_alt, patient_name_head, detail_diagnosis_third, f"{doctor_title_alt} {doctor_name_alt}", status_alt],
                ['', patient_name_tail, '', '', ''],
                section_title_third,
                ward_third,
                [room_third, patient_name_fourth, diagnosis_alt, f"{doctor_title_third} {doctor_name_third}", status_third],
            ], 'overnight-handover-block')
        elif sample_type == 'active_chronic_sheet_block':
            sample = build_sheet_block_sample([
                sheet_title,
                active_section,
                [room_header, patient_header, diagnosis_header, doctor_header, status_header],
                ward,
                [numeric_room, patient_name, detail_diagnosis, f"{doctor_title} {doctor_name}", 'Active'],
                [room_alt, patient_name_alt, detail_diagnosis_alt, f"{doctor_title_alt} {doctor_name_alt}", 'New'],
                chronic_section,
                [room_header, patient_header, diagnosis_header, doctor_header, status_header],
                ward_alt,
                [room_third, patient_name_third, detail_diagnosis_third, f"{doctor_title_third} {doctor_name_third}", 'Chronic'],
                [numeric_room, patient_name_fourth, diagnosis_alt, '', 'Chronic'],
            ], 'active-chronic-sheet-block')
        elif sample_type == 'roomless_status_mix_block':
            sample = build_sheet_block_sample([
                sheet_title,
                section_title,
                [room_header, patient_header, diagnosis_header, doctor_header, status_header],
                ward,
                [numeric_room, patient_name, detail_diagnosis, f"{doctor_title} {doctor_name}", status],
                ['', patient_name_alt, detail_diagnosis_alt, '', status_alt],
                ['', patient_name_third, detail_diagnosis_third, f"{doctor_title_alt} {doctor_name_alt}", status_third],
                [room_alt, patient_name_fourth, diagnosis_alt, '', ''],
            ], 'roomless-status-mix-block')
        elif sample_type == 'medication_continuation_block':
            sample = build_sheet_block_sample([
                sheet_title,
                active_section,
                [room_header, patient_header, diagnosis_header, medication_header, doctor_header, status_header],
                ward,
                [numeric_room, patient_name, detail_diagnosis, medication, f"{doctor_title} {doctor_name}", status],
                ['', '', '', medication_alt, '', status_alt],
                [room_alt, patient_name_alt, detail_diagnosis_alt, medication_third, f"{doctor_title_alt} {doctor_name_alt}", status_third],
                ['', '', '', medication, '', ''],
                [room_third, patient_name_third, diagnosis_alt, medication_alt, '', status],
            ], 'medication-continuation-block')
        elif sample_type == 'unassigned_transfer_block':
            sample = build_sheet_block_sample([
                sheet_title,
                transfer_section,
                [room_header, patient_header, diagnosis_header, doctor_header, status_header],
                'ER/Unassigned',
                [numeric_room, patient_name, detail_diagnosis, f"{doctor_title} {doctor_name}", 'Review'],
                ['', patient_name_alt, detail_diagnosis_alt, '', 'Awaiting bed'],
                [room_alt, patient_name_third, detail_diagnosis_third, f"{doctor_title_alt} {doctor_name_alt}", 'Transferred'],
            ], 'unassigned-transfer-block')
        elif sample_type == 'ward_round_block':
            sample = build_sheet_block_sample([
                section_title,
                [room_header, patient_header, diagnosis_header, doctor_header, status_header],
                ward,
                [room, patient_name, diagnosis, f"{doctor_title} {doctor_name}", status],
                [room_alt, patient_name_alt, detail_diagnosis_alt, '', status_alt],
                [room_third, patient_name_third, detail_diagnosis_third, f"{doctor_title_third} {doctor_name_third}", ''],
            ], 'ward-round-block')
        elif sample_type == 'mixed_language_block':
            sample = build_sheet_block_sample([
                section_title,
                [room_header, patient_header, diagnosis_header, doctor_header, status_header],
                ward,
                [numeric_room, arabic_name, detail_diagnosis, f"{doctor_title} {doctor_name}", status],
                [room_alt, patient_name_alt, detail_diagnosis_alt, f"{doctor_title_alt} {doctor_name_alt}", status_alt],
            ], 'mixed-language-block')
        elif sample_type == 'repeated_header_block':
            sample = build_sheet_block_sample([
                sheet_title,
                [room_header, patient_header, diagnosis_header, doctor_header, status_header],
                ward,
                [numeric_room, patient_name, detail_diagnosis, f"{doctor_title} {doctor_name}", status],
                [room_header, patient_header, diagnosis_header, doctor_header, status_header],
                [room_alt, patient_name_alt, diagnosis_alt, f"{doctor_title_alt} {doctor_name_alt}", status_third],
            ], 'repeated-header-block')
        elif sample_type == 'wrapped_diagnosis_block':
            wrapped_first = normalize_text(detail_diagnosis.replace('/', ' / ').replace(',', ' , '))
            wrapped_parts = wrapped_first.split()
            split_at = min(max(2, len(wrapped_parts) // 2), max(2, len(wrapped_parts) - 1))
            diagnosis_part_one = ' '.join(wrapped_parts[:split_at])
            diagnosis_part_two = ' '.join(wrapped_parts[split_at:])
            sample = build_sheet_block_sample([
                sheet_title,
                section_title,
                [room_header, patient_header, diagnosis_header, doctor_header, status_header],
                ward,
                [numeric_room, patient_name, diagnosis_part_one, f"{doctor_title} {doctor_name}", status],
                ['', '', diagnosis_part_two, '', ''],
                [room_alt, patient_name_alt, detail_diagnosis_alt, f"{doctor_title_alt} {doctor_name_alt}", status_alt],
            ], 'wrapped-diagnosis-block')
        elif sample_type == 'stacked_ward_block':
            sample = build_sheet_block_sample([
                section_title,
                [room_header, patient_header, diagnosis_header, doctor_header, status_header],
                ward,
                [numeric_room, patient_name, detail_diagnosis, f"{doctor_title} {doctor_name}", status],
                ward_alt,
                [room_alt, patient_name_alt, detail_diagnosis_alt, '', status_alt],
                [room_third, patient_name_third, detail_diagnosis_third, f"{doctor_title_third} {doctor_name_third}", status_third],
            ], 'stacked-ward-block')
        elif sample_type == 'split_name_block':
            sample = build_sheet_block_sample([
                sheet_title,
                section_title,
                [room_header, patient_header, diagnosis_header, doctor_header, status_header],
                ward,
                [numeric_room, patient_name_head, detail_diagnosis, f"{doctor_title} {doctor_name}", status],
                ['', patient_name_tail, '', '', ''],
                [room_alt, patient_name_alt_head, detail_diagnosis_alt, f"{doctor_title_alt} {doctor_name_alt}", status_alt],
                ['', patient_name_alt_tail, '', '', ''],
            ], 'split-name-block')
        elif sample_type == 'partial_header_block':
            partial_header_cells = [patient_header, diagnosis_header, doctor_header, status_header] if index % 2 == 0 else [room_header, patient_header, diagnosis_header, doctor_header]
            trailing_status = status_alt if len(partial_header_cells) == 4 and partial_header_cells[0] == patient_header else ''
            sample = build_sheet_block_sample([
                sheet_title,
                section_title,
                partial_header_cells,
                ward,
                [patient_name, detail_diagnosis, f"{doctor_title} {doctor_name}", status] if partial_header_cells[0] == patient_header else [numeric_room, patient_name, detail_diagnosis, f"{doctor_title} {doctor_name}"],
                [patient_name_fourth, diagnosis_alt, f"{doctor_title_alt} {doctor_name_alt}", trailing_status] if partial_header_cells[0] == patient_header else [room_alt, patient_name_fourth, diagnosis_alt, f"{doctor_title_alt} {doctor_name_alt}"],
            ], 'partial-header-block')
        elif sample_type == 'title_header_row':
            sample = build_line_sample(f"{sheet_title} {header_row}", 'title-header-row')
        elif sample_type == 'section_status_row':
            sample = build_line_sample(f"{section_title} {ward} {status}", 'section-status-row')
        elif sample_type == 'doctor_status_row':
            sample = build_line_sample(f"{doctor_title} {doctor_name} {status}", 'doctor-status-row')
        elif sample_type == 'numeric_pipe_row':
            sample = build_delimited_line_sample([numeric_room, patient_name, detail_diagnosis, f"{doctor_title} {doctor_name}", status], '|', 'numeric-pipe-row')
        elif sample_type == 'row_room_name':
            sample = build_row_sample([room, patient_name], 'room-name-row')
        elif sample_type == 'row_room_status':
            sample = build_row_sample([room, patient_name, status], 'room-status-row')
        elif sample_type == 'row_name_dx':
            sample = build_row_sample([patient_name, diagnosis, medication], 'name-dx-row')
        elif sample_type == 'row_pipe':
            sample = build_delimited_line_sample([room, patient_name, diagnosis, f"{doctor_title} {doctor_name}", status], '|', 'pipe-row')
        elif sample_type == 'section_context_row':
            sample = build_line_sample(f"{section_title} {ward}", 'section-context-row')
        elif sample_type == 'section_pipe_row':
            sample = build_delimited_line_sample([section_title, ward, patient_name, detail_diagnosis, status], '|', 'section-pipe-row')
        elif sample_type == 'header_pipe_row':
            sample = build_line_sample('Room / Ward | Patient name | Diagnosis | Assigned Doctor | Status', 'header-pipe-row')
        elif sample_type == 'section_header_row':
            sample = build_line_sample(f"{section_title} {header_row}", 'section-header-row')
        elif sample_type == 'row_bed_age':
            sample = build_line_sample(f"{bed} {patient_name} {age}/{gender} {diagnosis}", 'bed-age-row')
        elif sample_type == 'header_row':
            sample = build_row_sample(['Room / Ward', 'Patient name', 'Diagnosis', 'Assigned Doctor', 'Status'], 'header-row')
        else:
            sample = build_cell_sample(arabic_name, 'arabic-name')

        sample['split'] = 'train' if index < count * 0.9 else ('val' if index < count * 0.97 else 'test')
        yield sample


def measure_text(draw, text, font):
    rendered = shape_text(text)
    bbox = draw.textbbox((0, 0), rendered, font=font)
    return rendered, bbox


def make_canvas(width, height, background):
    return Image.new('RGB', (width, height), color=background)


def draw_centered_text(draw, bounds, text, font, fill):
    rendered, bbox = measure_text(draw, text, font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = bounds[0] + max(8, (bounds[2] - bounds[0] - text_width) // 2 - bbox[0])
    y = bounds[1] + max(6, (bounds[3] - bounds[1] - text_height) // 2 - bbox[1])
    draw.text((x, y), rendered, font=font, fill=fill)


def render_text_line(sample, fonts, style: str):
    font_size = random.randint(24, 40)
    if style in {'soft-scan', 'tight-line'}:
        font_size = random.randint(22, 36)
    elif style == 'dense-line':
        font_size = random.randint(20, 32)
    font = choose_font(fonts, font_size)
    probe = make_canvas(1800, 140, (255, 255, 255))
    probe_draw = ImageDraw.Draw(probe)
    rendered, bbox = measure_text(probe_draw, sample['text'], font)
    width = max(180, bbox[2] - bbox[0] + 40)
    height = max(68, bbox[3] - bbox[1] + 30)

    backgrounds = {
        'patient-name': (252, 252, 252),
        'doctor-name': (246, 250, 246),
        'doctor-titled': (244, 249, 244),
        'header-cell': (222, 238, 218),
        'status-cell': (255, 248, 225),
        'header-pipe-row': (222, 238, 218),
        'section-context-row': (231, 241, 250),
        'section-pipe-row': (234, 244, 251),
        'room-cell': (249, 249, 249),
    }
    background = backgrounds.get(sample['kind'], (248, 248, 248))
    if style in {'soft-scan', 'soft-banner'}:
        background = tuple(min(255, channel + 3) for channel in background)
    elif style == 'low-ink':
        background = tuple(min(255, channel + 6) for channel in background)
    canvas = make_canvas(width, height, background)
    draw = ImageDraw.Draw(canvas)
    x = 18 if style != 'dense-line' else 10
    y = max(8, (height - (bbox[3] - bbox[1])) // 2 - bbox[1])
    ink_range = (0, 28)
    if style == 'soft-scan':
        ink_range = (18, 48)
    elif style == 'low-ink':
        ink_range = (46, 82)
    elif style == 'dense-line':
        ink_range = (8, 40)
    draw.text((x + random.randint(-1, 1), y + random.randint(-1, 1)), rendered, font=font, fill=(random.randint(*ink_range),) * 3)

    if sample['layout'] == 'cell':
        draw.rectangle((0, 0, width - 1, height - 1), outline=(194, 201, 194), width=1)

    return canvas


def render_banner(sample, fonts, style: str):
    font_size = random.randint(24, 38)
    if style == 'tight-banner':
        font_size = random.randint(22, 34)
    font = choose_font(fonts, font_size)
    probe = make_canvas(1800, 140, (255, 255, 255))
    probe_draw = ImageDraw.Draw(probe)
    _, bbox = measure_text(probe_draw, sample['text'], font)
    width = max(420, bbox[2] - bbox[0] + 72)
    height = max(70, bbox[3] - bbox[1] + 34)

    background = (214, 240, 214) if sample['kind'] == 'ward-banner' else (214, 227, 245)
    if sample['kind'] == 'sheet-title':
        background = (246, 236, 205)
    if sample['kind'] == 'status-banner':
        background = status_fill(sample['text'])
    if style == 'soft-banner':
        background = tuple(min(255, channel + 5) for channel in background)
    canvas = make_canvas(width, height, background)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, width - 1, height - 1), outline=(174, 191, 174), width=1)
    draw_centered_text(draw, (0, 0, width, height), sample['text'], font, (18, 72, 18) if sample['kind'] != 'status-banner' else (90, 35, 20))
    return canvas


def status_fill(status: str):
    upper = status.upper()
    if 'NEW' in upper:
        return (255, 235, 156)
    if 'CHRONIC' in upper:
        return (220, 230, 250)
    if 'DISCHARGE' in upper:
        return (248, 214, 214)
    return (245, 245, 245)


def status_text_fill(status: str):
    upper = (status or '').upper()
    if 'NEW' in upper:
        return (182, 34, 34)
    if 'DISCHARGE' in upper:
        return (196, 30, 58)
    if 'CHRONIC' in upper:
        return (32, 62, 122)
    if 'PENDING' in upper or 'TRANSFER' in upper:
        return (166, 90, 18)
    return (66, 66, 66)


def column_widths(count: int):
    if count == 6:
        return [118, 248, 360, 292, 212, 166]
    if count == 5:
        return [120, 270, 420, 220, 180]
    if count == 4:
        return [320, 430, 220, 180]
    if count == 3:
        return [320, 460, 240]
    if count == 2:
        return [180, 520]
    return [640]


def scale_widths(count: int, target_width: int):
    base = column_widths(count) if count <= 5 else [max(96, target_width // max(1, count))] * count
    total = max(1, sum(base))
    scaled = [max(72, int(width * target_width / total)) for width in base]
    scaled[-1] += target_width - sum(scaled)
    return scaled


def row_kind_for_block(row):
    text = row['text']
    if SHEET_TITLE_RE.search(text):
        return 'title'
    if SECTION_TITLE_RE.search(text):
        return 'section'
    if HEADER_ROW_RE.search(text) and len(row.get('cells') or []) > 1:
        return 'header'
    if HEADER_ROW_RE.search(text):
        return 'header'
    if WARD_BANNER_RE.match(text):
        return 'ward'
    return 'patient'


def render_sheet_block(sample, fonts, style: str):
    rows = sample.get('rows') or [{'text': sample['text'], 'cells': sample.get('cells') or [sample['text']]}]
    canvas_width = random.randint(1020, 1180)
    if style in {'dense-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block'}:
        canvas_width = random.randint(920, 1040)
    elif style == 'phone-capture':
        canvas_width = random.randint(980, 1100)

    margin_x = 18 if style not in {'dense-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block'} else 12
    margin_y = 14 if style not in {'dense-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block'} else 10
    inner_width = canvas_width - (margin_x * 2)
    title_font = choose_font(fonts, random.randint(24, 34) if style not in {'dense-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block'} else random.randint(20, 28))
    band_font = choose_font(fonts, random.randint(22, 30) if style not in {'dense-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block'} else random.randint(18, 25))
    header_font = choose_font(fonts, random.randint(19, 25) if style not in {'dense-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block'} else random.randint(16, 22))
    body_font = choose_font(fonts, random.randint(18, 24) if style not in {'dense-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block'} else random.randint(15, 20))

    row_specs = []
    total_height = margin_y
    for row in rows:
        kind = row_kind_for_block(row)
        if kind == 'title':
            row_height = random.randint(48, 62) if style not in {'dense-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block'} else random.randint(40, 50)
            font = title_font
        elif kind in {'section', 'ward', 'header'}:
            row_height = random.randint(40, 54) if style not in {'dense-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block'} else random.randint(34, 44)
            font = band_font if kind in {'section', 'ward'} else header_font
        else:
            row_height = random.randint(36, 48) if style not in {'dense-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block'} else random.randint(30, 40)
            font = body_font

        row_specs.append({
            'row': row,
            'kind': kind,
            'font': font,
            'height': row_height,
        })
        total_height += row_height

    total_height += margin_y

    background = (252, 252, 250)
    if style == 'merged-sheet':
        background = (248, 249, 246)
    elif style == 'faded-block':
        background = (250, 250, 248)
    elif style in {'dense-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block'}:
        background = (247, 247, 245)

    canvas = make_canvas(canvas_width, total_height, background)
    draw = ImageDraw.Draw(canvas)

    y = margin_y
    for idx, spec in enumerate(row_specs):
        row = spec['row']
        kind = spec['kind']
        font = spec['font']
        height = spec['height']
        bounds = (margin_x, y, canvas_width - margin_x, y + height)

        fill = (255, 255, 255)
        outline = (214, 218, 214)
        if kind == 'title':
            fill = (247, 238, 209)
            outline = (220, 209, 172)
        elif kind == 'section':
            fill = (211, 236, 210)
            outline = (186, 210, 186)
        elif kind == 'ward':
            fill = (216, 241, 216)
            outline = (186, 210, 186)
        elif kind == 'header':
            fill = (217, 234, 214)
            outline = (192, 210, 188)

        if style == 'faded-block':
            fill = tuple(min(255, channel + 5) for channel in fill)
        elif style == 'merged-sheet' and kind in {'section', 'ward', 'header'}:
            fill = tuple(max(188, channel - 2) for channel in fill)

        draw.rectangle(bounds, fill=fill, outline=outline, width=1)

        cells = row.get('cells') or [row['text']]
        is_grid_row = len(cells) > 1

        if is_grid_row:
            widths = scale_widths(len(cells), inner_width)
            cell_x = margin_x
            for cell_index, cell in enumerate(cells):
                cell_width = widths[cell_index] if cell_index < len(widths) else widths[-1]
                cell_bounds = (cell_x, y, cell_x + cell_width, y + height)

                cell_fill = fill if kind == 'header' else (255, 255, 255)
                if kind == 'patient':
                    if cell_index == len(cells) - 2 and len(cells) >= 4 and cell:
                        palette = [
                            (224, 238, 244),
                            (250, 233, 160),
                            (230, 208, 244),
                            (235, 218, 218),
                        ]
                        cell_fill = palette[(idx + cell_index) % len(palette)]
                    elif cell_index == len(cells) - 1 and cell:
                        cell_fill = (255, 255, 255)

                if style == 'faded-block' and kind != 'patient':
                    cell_fill = tuple(min(255, channel + 3) for channel in cell_fill)
                elif style == 'merged-sheet' and kind == 'patient' and cell_index == 0:
                    cell_fill = (252, 252, 252)

                draw.rectangle(cell_bounds, fill=cell_fill, outline=(214, 218, 214), width=1)
                rendered, bbox = measure_text(draw, cell, font)
                text_y = max(y + 6, y + (height - (bbox[3] - bbox[1])) // 2 - bbox[1])
                text_x = cell_x + (6 if style in {'dense-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block'} else 9) + random.randint(-1, 1)
                ink_fill = (random.randint(0, 34),) * 3
                if kind == 'header':
                    ink_fill = (10, 78, 28)
                elif kind == 'patient' and cell_index == len(cells) - 1:
                    ink_fill = status_text_fill(cell)
                draw.text((text_x, text_y), rendered, font=font, fill=ink_fill)
                cell_x += cell_width
        else:
            rendered, bbox = measure_text(draw, row['text'], font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            if kind == 'ward':
                text_x = margin_x + max(10, (inner_width - text_width) // 2 - bbox[0])
            else:
                text_x = margin_x + (8 if style not in {'dense-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block'} else 6)
            text_y = y + max(6, (height - text_height) // 2 - bbox[1])
            ink_fill = (18, 72, 18) if kind in {'title', 'section', 'ward', 'header'} else (random.randint(0, 34),) * 3
            draw.text((text_x, text_y), rendered, font=font, fill=ink_fill)

        y += height

    if style in {'merged-sheet', 'faded-block', 'dense-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block', 'glare-block', 'shadow-block', 'title-clipped-block'}:
        grid_color = (229, 232, 226) if style != 'merged-sheet' else (220, 225, 218)
        for line_y in range(margin_y + 8, total_height - margin_y, random.randint(12, 18)):
            draw.line((margin_x, line_y, canvas_width - margin_x, line_y), fill=grid_color, width=1)

    return canvas


def render_spreadsheet_row(sample, fonts, style: str):
    cells = sample['cells'] or [sample['text']]
    widths = column_widths(len(cells))
    font_size = random.randint(22, 34)
    if style in {'washed-grid', 'tight-crop', 'clipped-grid'}:
        font_size = random.randint(20, 32)
    elif style == 'dense-sheet':
        font_size = random.randint(18, 28)
    font = choose_font(fonts, font_size)
    height = random.randint(54, 76)
    padding = 14
    if style == 'dense-sheet':
        widths = [max(88, int(width * 0.86)) for width in widths]
        height = random.randint(48, 64)
        padding = 10
    width = sum(widths) + (padding * 2)

    background = (255, 255, 255)
    if sample['kind'] == 'header-row':
        background = (219, 237, 214)
    if style == 'washed-grid':
        background = tuple(min(255, channel + 4) for channel in background)
    elif style == 'banded-sheet':
        background = (250, 251, 248)
    elif style == 'dense-sheet':
        background = (248, 248, 246)

    canvas = make_canvas(width, height, background)
    draw = ImageDraw.Draw(canvas)
    border_color = (198, 205, 198) if style != 'washed-grid' else (214, 219, 214)
    draw.rectangle((0, 0, width - 1, height - 1), outline=border_color, width=1)

    x = padding
    for index, cell in enumerate(cells):
        cell_width = widths[index] if index < len(widths) else widths[-1]
        bounds = (x, 0, x + cell_width, height)

        if sample['kind'] == 'header-row':
            fill = (219, 237, 214)
        elif index == len(cells) - 1 and len(cells) >= 4 and sample['kind'] in {'spreadsheet-row', 'headerless-row', 'detail-spreadsheet-row', 'sparse-spreadsheet-row', 'doctorless-row', 'statusless-row', 'room-number-roster-row'}:
            fill = status_fill(cell)
        elif index == len(cells) - 2 and len(cells) >= 4 and sample['kind'] in {'spreadsheet-row', 'headerless-row', 'detail-spreadsheet-row', 'sparse-spreadsheet-row', 'doctorless-row', 'statusless-row', 'room-number-roster-row'}:
            fill = (219, 236, 241)
        else:
            fill = (255, 255, 255)
        if style == 'washed-grid':
            fill = tuple(min(255, channel + 6) for channel in fill)
        elif style == 'banded-sheet' and sample['kind'] != 'header-row' and index % 2 == 0:
            fill = tuple(max(236, channel - 4) for channel in fill)
        elif style == 'dense-sheet':
            fill = tuple(min(252, channel + 2) for channel in fill)

        draw.rectangle(bounds, fill=fill, outline=(214, 218, 214), width=1)
        rendered, bbox = measure_text(draw, cell, font)
        text_y = max(6, (height - (bbox[3] - bbox[1])) // 2 - bbox[1]) + random.randint(-1, 1)
        text_x = x + (8 if style != 'dense-sheet' else 5) + (random.randint(-2, 2) if style in {'washed-grid', 'banded-sheet', 'tight-crop', 'clipped-grid', 'dense-sheet'} else 0)
        ink_range = (0, 30) if style != 'washed-grid' else (28, 62)
        if style == 'dense-sheet':
            ink_range = (10, 38)
        draw.text((text_x, text_y), rendered, font=font, fill=(random.randint(*ink_range),) * 3)
        x += cell_width

    if style in {'washed-grid', 'banded-sheet', 'dense-sheet'}:
        grid_color = (230, 233, 230) if style == 'washed-grid' else (224, 228, 224)
        for y in range(7, height, random.randint(10, 14)):
            draw.line((padding, y, width - padding, y), fill=grid_color, width=1)

    return canvas


def render_sample(sample, fonts):
    style = sample.get('renderStyle') or pick_render_style(sample)
    sample['renderStyle'] = style
    sample['difficulty'] = classify_difficulty(style)

    if sample['layout'] == 'banner':
        canvas = render_banner(sample, fonts, style)
    elif sample['layout'] == 'sheet-block':
        canvas = render_sheet_block(sample, fonts, style)
    elif sample['layout'] == 'spreadsheet':
        canvas = render_spreadsheet_row(sample, fonts, style)
    else:
        canvas = render_text_line(sample, fonts, style)

    if style in {'soft-scan', 'washed-grid', 'soft-banner', 'clipped-grid', 'phone-capture', 'faded-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block', 'glare-block', 'title-clipped-block'}:
        canvas = ImageEnhance.Contrast(canvas).enhance(random.uniform(0.76, 0.92))
        canvas = ImageEnhance.Brightness(canvas).enhance(random.uniform(1.01, 1.08))
        canvas = ImageEnhance.Sharpness(canvas).enhance(random.uniform(0.55, 0.92))
    elif style == 'low-ink':
        canvas = ImageEnhance.Contrast(canvas).enhance(random.uniform(0.66, 0.84))
        canvas = ImageEnhance.Brightness(canvas).enhance(random.uniform(1.03, 1.10))
        canvas = ImageEnhance.Sharpness(canvas).enhance(random.uniform(0.45, 0.80))
    elif style == 'shadow-block':
        canvas = ImageEnhance.Contrast(canvas).enhance(random.uniform(0.80, 0.95))
        canvas = ImageEnhance.Brightness(canvas).enhance(random.uniform(0.98, 1.04))
        canvas = ImageEnhance.Sharpness(canvas).enhance(random.uniform(0.62, 0.90))
    elif style in {'dense-sheet', 'dense-line', 'dense-block', 'merged-sheet'}:
        canvas = ImageEnhance.Contrast(canvas).enhance(random.uniform(0.84, 0.98))
        canvas = ImageEnhance.Brightness(canvas).enhance(random.uniform(0.98, 1.05))
        canvas = ImageEnhance.Sharpness(canvas).enhance(random.uniform(0.70, 1.00))

    if style in {'washed-grid', 'soft-scan', 'low-ink', 'banded-sheet', 'clipped-grid', 'dense-sheet', 'phone-capture', 'faded-block', 'dense-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block', 'glare-block', 'title-clipped-block'}:
        canvas = add_scan_lines(canvas, strength=14 if style in {'washed-grid', 'low-ink'} else 10)
    if style in {'tight-crop', 'tight-line', 'tight-banner', 'phone-capture'}:
        canvas = crop_and_pad(canvas)
    if style == 'clipped-grid':
        canvas = crop_and_pad(canvas, max_trim_x=16, max_trim_y=8)
    if style == 'left-clipped-block':
        canvas = crop_one_side(canvas, 'left')
    if style == 'right-clipped-block':
        canvas = crop_one_side(canvas, 'right')
    if style == 'top-clipped-block':
        canvas = crop_vertical_side(canvas, 'top')
    if style == 'bottom-clipped-block':
        canvas = crop_vertical_side(canvas, 'bottom')
    if style == 'title-clipped-block':
        canvas = crop_vertical_side(canvas, 'top', max_trim_y=46, max_trim_x=14)
    if style == 'glare-block':
        canvas = add_glare_band(canvas, alpha=random.uniform(0.12, 0.20))
    if style == 'shadow-block':
        canvas = add_margin_shadow(canvas, alpha=random.uniform(0.10, 0.16))
    if style in {'low-ink', 'washed-grid', 'tight-crop', 'clipped-grid', 'dense-line', 'phone-capture', 'faded-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block', 'glare-block', 'title-clipped-block'}:
        canvas = add_speckle_noise(canvas, density=0.0032)

    if random.random() < 0.35:
        blur_cap = 1.2 if style in {'washed-grid', 'soft-scan', 'low-ink', 'clipped-grid', 'phone-capture', 'faded-block', 'left-clipped-block', 'right-clipped-block', 'top-clipped-block', 'bottom-clipped-block', 'glare-block', 'title-clipped-block'} else 0.9
        canvas = canvas.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.0, blur_cap)))

    if random.random() < 0.55:
        angle = random.uniform(-3.4, 3.4) if style in {'phone-capture', 'glare-block'} else random.uniform(-2.5, 2.5)
        canvas = canvas.rotate(angle, expand=True, fillcolor=(255, 255, 255))

    return canvas


def main():
    parser = argparse.ArgumentParser(description='Generate synthetic OCR crops for MedTriage OCR training.')
    parser.add_argument('--lexicon', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--count', type=int, default=3600)
    parser.add_argument('--seed', type=int, default=1337)
    args = parser.parse_args()

    random.seed(args.seed)
    domain = load_json(Path(args.lexicon))
    output_root = Path(args.output)
    images_dir = output_root / 'images'
    ensure_dir(images_dir)

    fonts = find_fonts()
    if not fonts:
        raise RuntimeError('No suitable Windows fonts found for synthetic OCR generation.')

    labels_path = output_root / 'labels.jsonl'
    stats_path = output_root / 'stats.json'
    rows = []
    stats = {
        'seed': args.seed,
        'total': 0,
        'byKind': {},
        'byLayout': {},
        'byStyle': {},
        'byDifficulty': {},
        'byLanguage': {},
        'bySplit': {'train': 0, 'val': 0, 'test': 0},
    }

    for index, sample in enumerate(build_samples(domain, args.count)):
        image = render_sample(sample, fonts)
        image_name = f"sample_{index:05d}.png"
        image_path = images_dir / image_name
        image.save(image_path)

        stats['total'] += 1
        stats['byKind'][sample['kind']] = stats['byKind'].get(sample['kind'], 0) + 1
        stats['byLayout'][sample['layout']] = stats['byLayout'].get(sample['layout'], 0) + 1
        stats['byStyle'][sample['renderStyle']] = stats['byStyle'].get(sample['renderStyle'], 0) + 1
        stats['byDifficulty'][sample['difficulty']] = stats['byDifficulty'].get(sample['difficulty'], 0) + 1
        stats['byLanguage'][sample['language']] = stats['byLanguage'].get(sample['language'], 0) + 1
        stats['bySplit'][sample['split']] = stats['bySplit'].get(sample['split'], 0) + 1

        rows.append(json.dumps({
            'image': f"images/{image_name}",
            'text': sample['text'],
            'cells': sample['cells'],
            'rows': sample.get('rows'),
            'language': sample['language'],
            'layout': sample['layout'],
            'kind': sample['kind'],
            'renderStyle': sample['renderStyle'],
            'difficulty': sample['difficulty'],
            'split': sample['split'],
            'source': 'synthetic-medtriage',
        }, ensure_ascii=False))

    with labels_path.open('w', encoding='utf-8') as handle:
        handle.write('\n'.join(rows) + '\n')
    with stats_path.open('w', encoding='utf-8') as handle:
        handle.write(json.dumps(stats, indent=2, ensure_ascii=False) + '\n')

    print('Generated synthetic OCR dataset')
    print(f'  Images: {len(rows)}')
    print(f'  Seed:   {args.seed}')
    print(f'  Output: {output_root}')


if __name__ == '__main__':
    main()
