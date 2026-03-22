"""
Medical Terminology Corrector
=============================
Auto-fixes common OCR errors in medical text using:
  1. Drug name dictionary (WHO essential medicines + Kuwait formulary)
  2. Anatomy dictionary (body parts, organs, systems)
  3. Lab value patterns (recognizes "K 5.2" as Potassium, not garbled text)
  4. Clinical abbreviation expander
  5. Live learning from human corrections

This runs 100% locally — no API calls, no data leaves your machine.
"""

import json
import re
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent


# ═══════════════════════════════════════════════════════════════════
# DRUG NAME CORRECTIONS
# Common OCR misreads for frequently prescribed medications
# ═══════════════════════════════════════════════════════════════════
DRUG_CORRECTIONS = {
    # Cardiovascular
    "atorvastain": "atorvastatin", "atorvastin": "atorvastatin",
    "atorvastation": "atorvastatin", "atorvastatan": "atorvastatin",
    "simvastain": "simvastatin", "simvastin": "simvastatin",
    "rosuvastain": "rosuvastatin", "rosuvastin": "rosuvastatin",
    "amlodipne": "amlodipine", "amlodipin": "amlodipine",
    "amlodpine": "amlodipine", "amlodopine": "amlodipine",
    "lisinopri": "lisinopril", "lisinoprl": "lisinopril",
    "lisinopnl": "lisinopril", "lisinoprll": "lisinopril",
    "losartan": "losartan", "Iosartan": "losartan",
    "valsatan": "valsartan", "valsarten": "valsartan",
    "metoprolo": "metoprolol", "metopriol": "metoprolol",
    "metoprolal": "metoprolol", "metoprclol": "metoprolol",
    "bisoprolo": "bisoprolol", "bisoprclol": "bisoprolol",
    "clopidogre": "clopidogrel", "clopidogrl": "clopidogrel",
    "clopidoqrel": "clopidogrel", "clcpidogrel": "clopidogrel",
    "warfann": "warfarin", "warfann": "warfarin",
    "enoxapann": "enoxaparin", "enoxapann": "enoxaparin",
    "hepann": "heparin", "hepann": "heparin",
    "digoxm": "digoxin", "digoxln": "digoxin",
    "furosemde": "furosemide", "furosemde": "furosemide",
    "furosemld": "furosemide", "furcosemide": "furosemide",
    "hydrochlorothiazde": "hydrochlorothiazide",
    "spironolactone": "spironolactone",
    "nifedipne": "nifedipine", "nifedlpine": "nifedipine",
    "diltiazem": "diltiazem", "dlltiazem": "diltiazem",
    "nitroglycenn": "nitroglycerin", "nitroglycern": "nitroglycerin",

    # Diabetes
    "metformin": "metformin", "metformln": "metformin",
    "metfcrmin": "metformin", "metformn": "metformin",
    "glibenclamde": "glibenclamide", "gllbenclamide": "glibenclamide",
    "gliclazde": "gliclazide", "gllclazide": "gliclazide",
    "sitagliptn": "sitagliptin", "sitagliptln": "sitagliptin",
    "empagliflozn": "empagliflozin", "empagliflozln": "empagliflozin",
    "dapagliflozn": "dapagliflozin", "dapagliflozln": "dapagliflozin",
    "pioglitazone": "pioglitazone", "pioglltazone": "pioglitazone",
    "insuiln": "insulin", "insuiin": "insulin", "lnsulin": "insulin",
    "insulln": "insulin",

    # Antibiotics
    "amoxicilln": "amoxicillin", "amoxiclllin": "amoxicillin",
    "amoxicllin": "amoxicillin", "amcxicillin": "amoxicillin",
    "augmentin": "augmentin", "augmentln": "augmentin",
    "azithromycn": "azithromycin", "azithrcmycin": "azithromycin",
    "ciprofloxacn": "ciprofloxacin", "ciprcfloxacin": "ciprofloxacin",
    "levofloxacn": "levofloxacin", "levofioxacin": "levofloxacin",
    "moxifloxacn": "moxifloxacin", "moxlfioxacin": "moxifloxacin",
    "ceftriaxone": "ceftriaxone", "ceftrlaxone": "ceftriaxone",
    "cefuroxme": "cefuroxime", "cefurcxime": "cefuroxime",
    "meropenem": "meropenem", "mercpenem": "meropenem",
    "piperacilln": "piperacillin", "plperacillin": "piperacillin",
    "tazobactam": "tazobactam", "tazcbactam": "tazobactam",
    "vancomycn": "vancomycin", "vancomycln": "vancomycin",
    "gentamicn": "gentamicin", "gentamlcin": "gentamicin",
    "clindamycn": "clindamycin", "cllndamycin": "clindamycin",
    "metronidazole": "metronidazole", "metrcnidazole": "metronidazole",
    "trimethopnm": "trimethoprim", "trimethoprm": "trimethoprim",
    "sulfamethoxazole": "sulfamethoxazole",
    "doxycycllne": "doxycycline", "doxycyclne": "doxycycline",
    "fluconazole": "fluconazole", "fluconazole": "fluconazole",

    # Analgesics / NSAIDs
    "paracetamo": "paracetamol", "paracetamcl": "paracetamol",
    "acetaminophen": "acetaminophen", "acetaminophn": "acetaminophen",
    "ibuprofen": "ibuprofen", "lbuprofen": "ibuprofen",
    "diclofenac": "diclofenac", "dlclofenac": "diclofenac",
    "naproxen": "naproxen", "naproxn": "naproxen",
    "tramadol": "tramadol", "tramadcl": "tramadol",
    "morphne": "morphine", "morphlne": "morphine",
    "fentanyi": "fentanyl", "fentanvl": "fentanyl",
    "oxycodone": "oxycodone", "oxycodcne": "oxycodone",
    "codene": "codeine", "codene": "codeine",
    "ketorolac": "ketorolac", "ketcrolac": "ketorolac",

    # Respiratory
    "salbutamo": "salbutamol", "salbutamcl": "salbutamol",
    "ipratropum": "ipratropium", "iprotropium": "ipratropium",
    "budesonide": "budesonide", "budescnide": "budesonide",
    "fluticasone": "fluticasone", "fluticascne": "fluticasone",
    "montelukast": "montelukast", "mcntelukast": "montelukast",
    "theophyllne": "theophylline", "theophy1line": "theophylline",
    "prednisolone": "prednisolone", "prednlsolone": "prednisolone",
    "prednisone": "prednisone", "prednlsone": "prednisone",
    "dexamethasone": "dexamethasone", "dexamethascne": "dexamethasone",
    "methylprednisolone": "methylprednisolone",

    # GI
    "omeprazole": "omeprazole", "omeprazcie": "omeprazole",
    "pantoprazole": "pantoprazole", "pantcprazole": "pantoprazole",
    "esomeprazole": "esomeprazole", "esomeprazcie": "esomeprazole",
    "ranitidne": "ranitidine", "ranitldine": "ranitidine",
    "ondansetron": "ondansetron", "cndansetron": "ondansetron",
    "metoclopramde": "metoclopramide", "metoclopramld": "metoclopramide",
    "lactulose": "lactulose", "lactuicse": "lactulose",
    "loperamde": "loperamide", "lcperamide": "loperamide",
    "mesalazne": "mesalazine", "mesalazlne": "mesalazine",

    # Neuro / Psych
    "levetiracetam": "levetiracetam", "levetlracetam": "levetiracetam",
    "carbamazepne": "carbamazepine", "carbamazeplne": "carbamazepine",
    "phenytoin": "phenytoin", "phenytcin": "phenytoin",
    "valproate": "valproate", "valprclate": "valproate",
    "gabapentin": "gabapentin", "gabapentln": "gabapentin",
    "pregabalin": "pregabalin", "pregaballn": "pregabalin",
    "sertraline": "sertraline", "sertralme": "sertraline",
    "escitalopram": "escitalopram", "escltalopram": "escitalopram",
    "fluoxetine": "fluoxetine", "fluoxetme": "fluoxetine",
    "quetiapine": "quetiapine", "quetiaplne": "quetiapine",
    "olanzapine": "olanzapine", "olanzaplne": "olanzapine",
    "risperidone": "risperidone", "rlsperidone": "risperidone",
    "haloperidol": "haloperidol", "halopendol": "haloperidol",
    "diazepam": "diazepam", "dlazepam": "diazepam",
    "lorazepam": "lorazepam", "lcrazepam": "lorazepam",
    "midazolam": "midazolam", "mldazolam": "midazolam",
    "donepezil": "donepezil", "dcnepezil": "donepezil",

    # Endocrine
    "levothyroxne": "levothyroxine", "levothyroxme": "levothyroxine",
    "carbimazole": "carbimazole", "carblmazole": "carbimazole",
    "propylthiouracil": "propylthiouracil",
}

# ═══════════════════════════════════════════════════════════════════
# ANATOMY / CLINICAL CORRECTIONS
# ═══════════════════════════════════════════════════════════════════
ANATOMY_CORRECTIONS = {
    "abdomn": "abdomen", "abdcmen": "abdomen",
    "thorx": "thorax", "thcrax": "thorax",
    "cervica": "cervical", "cervlcal": "cervical",
    "lumbar": "lumbar", "iumber": "lumbar",
    "femora": "femoral", "femcral": "femoral",
    "hepatc": "hepatic", "hepatlc": "hepatic",
    "renai": "renal", "renai": "renal",
    "pulmonary": "pulmonary", "puimonary": "pulmonary",
    "myocardia": "myocardial", "myocardlal": "myocardial",
    "pericardal": "pericardial", "perlcardial": "pericardial",
    "mediastina": "mediastinal", "mediastlnal": "mediastinal",
    "peritonea": "peritoneal", "perltoneal": "peritoneal",
    "tracheai": "tracheal", "tracheal": "tracheal",
    "esophagea": "esophageal", "esophageai": "esophageal",
    "duodena": "duodenal", "duodenai": "duodenal",
    "ileai": "ileal", "lleai": "ileal",
    "coloni": "colonic", "colonlc": "colonic",
    "pancreati": "pancreatic", "pancreatlc": "pancreatic",
    "spleni": "splenic", "splenlc": "splenic",
    "thyrod": "thyroid", "thyrold": "thyroid",
    "adrenai": "adrenal", "adrenai": "adrenal",
    "pitutary": "pituitary", "pitultary": "pituitary",
    "hypothalami": "hypothalamic", "hypothalamlc": "hypothalamic",
}

# ═══════════════════════════════════════════════════════════════════
# LAB VALUE PATTERNS
# ═══════════════════════════════════════════════════════════════════
LAB_PATTERNS = [
    # Pattern -> (lab_name, unit, normal_range_low, normal_range_high)
    (r"\bHb\s*[:\-]?\s*(\d{1,2}\.?\d?)", "Hemoglobin", "g/dL", 12.0, 17.0),
    (r"\bWBC\s*[:\-]?\s*(\d{1,3}\.?\d?)", "WBC", "x10^9/L", 4.0, 11.0),
    (r"\bPlt\s*[:\-]?\s*(\d{2,4})", "Platelets", "x10^9/L", 150, 400),
    (r"\bNa\s*[:\-]?\s*(\d{2,3})", "Sodium", "mmol/L", 135, 145),
    (r"\bK\s*[:\-]?\s*(\d\.?\d?)", "Potassium", "mmol/L", 3.5, 5.0),
    (r"\bCr\s*[:\-]?\s*(\d{1,4}\.?\d?)", "Creatinine", "umol/L", 60, 115),
    (r"\bGlucose\s*[:\-]?\s*(\d{1,3}\.?\d?)", "Glucose", "mmol/L", 3.9, 6.1),
    (r"\bINR\s*[:\-]?\s*(\d\.?\d{0,2})", "INR", "", 0.8, 1.2),
    (r"\bCRP\s*[:\-]?\s*(\d{1,3}\.?\d?)", "CRP", "mg/L", 0, 5),
    (r"\bTSH\s*[:\-]?\s*(\d{1,2}\.?\d{0,2})", "TSH", "mIU/L", 0.4, 4.0),
    (r"\bHbA1c\s*[:\-]?\s*(\d{1,2}\.?\d?)", "HbA1c", "%", 4.0, 5.6),
    (r"\bAlbumin\s*[:\-]?\s*(\d{1,2}\.?\d?)", "Albumin", "g/dL", 3.5, 5.5),
    (r"\bBilirubin\s*[:\-]?\s*(\d{1,3}\.?\d?)", "Bilirubin", "umol/L", 3, 21),
    (r"\bALT\s*[:\-]?\s*(\d{1,4})", "ALT", "U/L", 7, 56),
    (r"\bAST\s*[:\-]?\s*(\d{1,4})", "AST", "U/L", 10, 40),
    (r"\bALP\s*[:\-]?\s*(\d{1,4})", "ALP", "U/L", 44, 147),
    (r"\bTroponin\s*[:\-]?\s*(\d{0,2}\.?\d{1,4})", "Troponin", "ng/mL", 0, 0.04),
    (r"\bBNP\s*[:\-]?\s*(\d{1,5})", "BNP", "pg/mL", 0, 100),
    (r"\bLactate\s*[:\-]?\s*(\d{1,2}\.?\d?)", "Lactate", "mmol/L", 0.5, 2.2),
]

# Common OCR char-swap patterns
CHAR_SWAPS = [
    ("l", "1"), ("1", "l"), ("I", "l"), ("0", "O"), ("O", "0"),
    ("rn", "m"), ("cl", "d"), ("ii", "u"), ("vv", "w"),
]


class MedTermCorrector:
    """Corrects OCR errors in medical text using dictionary + pattern matching."""

    def __init__(self):
        # Build unified lookup (lowercase -> correct)
        self.dictionary = {}
        for src, dst in {**DRUG_CORRECTIONS, **ANATOMY_CORRECTIONS}.items():
            self.dictionary[src.lower()] = dst

        # Load any previously learned corrections
        self.learned_path = SCRIPT_DIR / "learned_corrections.json"
        self.learned = {}
        if self.learned_path.exists():
            try:
                self.learned = json.loads(self.learned_path.read_text(encoding="utf-8"))
                self.dictionary.update(self.learned)
            except (json.JSONDecodeError, OSError):
                pass

    def correct(self, text):
        """
        Correct medical terminology in text.
        Returns (corrected_text, list_of_corrections).
        """
        if not text or not text.strip():
            return text, []

        corrections = []
        words = text.split()
        result = []

        for word in words:
            stripped = word.strip(".,;:!?()[]{}\"'")
            lower = stripped.lower()

            # Direct dictionary match
            if lower in self.dictionary:
                fixed = self.dictionary[lower]
                # Preserve original casing style
                if stripped[0].isupper() and len(stripped) > 1:
                    fixed = fixed[0].upper() + fixed[1:]
                if stripped.isupper():
                    fixed = fixed.upper()
                if fixed.lower() != lower:
                    corrections.append({"original": stripped, "corrected": fixed, "method": "dictionary"})
                result.append(word.replace(stripped, fixed))
            else:
                # Try fuzzy char-swap correction
                candidate = self._try_char_swaps(lower)
                if candidate and candidate != lower:
                    fixed = candidate
                    if stripped[0].isupper() and len(stripped) > 1:
                        fixed = fixed[0].upper() + fixed[1:]
                    corrections.append({"original": stripped, "corrected": fixed, "method": "char_swap"})
                    result.append(word.replace(stripped, fixed))
                else:
                    result.append(word)

        corrected_text = " ".join(result)

        # Lab value validation
        lab_flags = self._check_lab_values(corrected_text)
        corrections.extend(lab_flags)

        return corrected_text, corrections

    def _try_char_swaps(self, word):
        """Try common OCR character swaps to find a dictionary match."""
        for old_char, new_char in CHAR_SWAPS:
            if old_char in word:
                candidate = word.replace(old_char, new_char)
                if candidate in self.dictionary:
                    return self.dictionary[candidate]
        return None

    def _check_lab_values(self, text):
        """Flag impossible lab values (likely OCR errors in digits)."""
        flags = []
        for pattern, name, unit, low, high in LAB_PATTERNS:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                try:
                    value = float(match.group(1))
                    # Flag if value is wildly out of range (>5x normal)
                    if value > high * 5 or (low > 0 and value < low * 0.1):
                        flags.append({
                            "original": match.group(0),
                            "corrected": match.group(0),
                            "method": "lab_value_flag",
                            "detail": f"{name} = {value} {unit} is physiologically implausible "
                                      f"(normal: {low}-{high} {unit})",
                        })
                except (ValueError, IndexError):
                    pass
        return flags

    def learn(self, wrong_text, correct_text):
        """Add a new correction from human review."""
        key = wrong_text.strip().lower()
        val = correct_text.strip()
        if key and val and key != val.lower():
            self.learned[key] = val
            self.dictionary[key] = val
            # Persist
            try:
                self.learned_path.write_text(
                    json.dumps(self.learned, indent=2, ensure_ascii=False),
                    encoding="utf-8",
                )
            except OSError:
                pass
