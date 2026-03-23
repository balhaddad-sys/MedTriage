"""Medical Grade Audit — 100 adversarial cases the system has never seen."""
from med_corrector import MedTermCorrector

corrector = MedTermCorrector()

audit_cases = [
    # === TIER 1: Drug names with realistic garbles ===
    ('arnodarone 200mg PO dally', 'amiodarone 200mg PO daily'),
    ('rneropenem 1g lV Q8H', 'meropenem 1g IV Q8H'),
    ('plperacillin/tazobactam 4.5g lV', 'piperacillin/tazobactam 4.5g IV'),
    ('tacrollmus 2mg PO BlD', 'tacrolimus 2mg PO BID'),
    ('rnidazolam 2mg lV PRN', 'midazolam 2mg IV PRN'),
    ('norepinephrlne drip', 'norepinephrine drip'),
    ('dobutarnine 5mcg/kg/min', 'dobutamine 5mcg/kg/min'),
    ('phenytoin 100rng lV TlD', 'phenytoin 100mg IV TID'),
    ('warfarln 5mg PO QHS', 'warfarin 5mg PO QHS'),
    ('apixaban 5rng PO BlD', 'apixaban 5mg PO BID'),
    ('ticagre1or 90mg PO BlD', 'ticagrelor 90mg PO BID'),
    ('rnethotrexate 15mg weekly', 'methotrexate 15mg weekly'),
    ('hydroxych1oroquine 200mg BlD', 'hydroxychloroquine 200mg BID'),
    ('a1buterol 2.5mg NEB Q4H', 'albuterol 2.5mg NEB Q4H'),
    ('tiotroplum 18mcg lNH dally', 'tiotropium 18mcg INH daily'),

    # === TIER 2: Diagnoses — multi-word, complex ===
    ('Acute decornpensated heart fallure', 'Acute decompensated heart failure'),
    ('Non-ST e1evation myocardlal lnfarction', 'Non-ST elevation myocardial infarction'),
    ('Ventl1ator-assoclated pneurnonia', 'Ventilator-associated pneumonia'),
    ('Dlsserninated intravascular coagulatlon', 'Disseminated intravascular coagulation'),
    ('Hepatorena1 syndrorne', 'Hepatorenal syndrome'),
    ('Hyperosrno1ar hyperglycernic state', 'Hyperosmolar hyperglycemic state'),
    ('Necrotlzing fasciitls', 'Necrotizing fasciitis'),
    ('Spontaneous bacterla1 peritonitls', 'Spontaneous bacterial peritonitis'),
    ('Tension pneurncthorax', 'Tension pneumothorax'),
    ('Subarachnold hernorrhage', 'Subarachnoid hemorrhage'),

    # === TIER 3: Lab values — must NOT corrupt numbers ===
    ('Hb 7.2 WBC 22.5 Plt 45', 'Hb 7.2 WBC 22.5 Plt 45'),
    ('Na 128 K 6.2 Cl 98 CO2 14', 'Na 128 K 6.2 Cl 98 CO2 14'),
    ('Cr 4.5 BUN 85 GFR 12', 'Cr 4.5 BUN 85 GFR 12'),
    ('Troponin 2.45 BNP 1850', 'Troponin 2.45 BNP 1850'),
    ('Lactate 8.5 pH 7.18 pCO2 22', 'Lactate 8.5 pH 7.18 pCO2 22'),
    ('INR 3.8 PT 42.5 aPTT 68', 'INR 3.8 PT 42.5 aPTT 68'),
    ('CRP 185 Procalcitonin 12.5', 'CRP 185 Procalcitonin 12.5'),
    ('ALT 1250 AST 980 Bilirubin 8.5', 'ALT 1250 AST 980 Bilirubin 8.5'),
    ('TSH 0.01 Free T4 4.8', 'TSH 0.01 Free T4 4.8'),
    ('HbA1c 12.5 Glucose 450', 'HbA1c 12.5 Glucose 450'),

    # === TIER 4: Patient names — Arabic transliterated ===
    ('Fatirna A1-Kandari', 'Fatima Al-Kandari'),
    ('Moharnrned A1-Dosari', 'Mohammed Al-Dosari'),
    ('Ahrned bin Kha1id', 'Ahmed bin Khalid'),
    ('Noura A1-Hajri', 'Noura Al-Hajri'),
    ('Su1tan A1-Otaibi', 'Sultan Al-Otaibi'),

    # === TIER 5: Vitals — absolutely must NOT change ===
    ('HR 125 BP 78/42 RR 32 T 39.8 SpO2 88%', 'HR 125 BP 78/42 RR 32 T 39.8 SpO2 88%'),
    ('HR 62 BP 145/92 RR 14 T 36.8 SpO2 99%', 'HR 62 BP 145/92 RR 14 T 36.8 SpO2 99%'),
    ('GCS 8 (E2V2M4) Pupils 3mm/6mm', 'GCS 8 (E2V2M4) Pupils 3mm/6mm'),
    ('MAP 55 CVP 18 UOP 10ml/hr', 'MAP 55 CVP 18 UOP 10ml/hr'),
    ('FiO2 100% PEEP 14 TV 450 RR 28', 'FiO2 100% PEEP 14 TV 450 RR 28'),

    # === TIER 6: Abbreviations — must NOT change ===
    ('STEMI', 'STEMI'), ('NSTEMI', 'NSTEMI'), ('DKA', 'DKA'),
    ('ARDS', 'ARDS'), ('CRRT', 'CRRT'), ('ECMO', 'ECMO'),
    ('TPA', 'TPA'), ('PCI', 'PCI'), ('CABG', 'CABG'),
    ('DVT', 'DVT'), ('PE', 'PE'), ('AKI', 'AKI'),
    ('CKD', 'CKD'), ('ESRD', 'ESRD'), ('SLE', 'SLE'),

    # === TIER 7: Full patient lines (whiteboard style) ===
    ('Bed 3: Ahrned, 67M, NSTEMI, on hepann + ticagre1or, NPO for cath',
     'Bed 3: Ahmed, 67M, NSTEMI, on heparin + ticagrelor, NPO for cath'),
    ('Bed 7: Fatirna, 45F, DKA, insulln drip, K rep1acement, lCU',
     'Bed 7: Fatima, 45F, DKA, insulin drip, K replacement, ICU'),
    ('Bed 12: Su1tan, 82M, Septic shcok, on levofloxacln + rneropenem, vasopressors',
     'Bed 12: Sultan, 82M, Septic shock, on levofloxacin + meropenem, vasopressors'),
    ('Bed 5: Noura, 33F, 28wk preec1arnpsia, MgSO4 drip, HELLP',
     'Bed 5: Noura, 33F, 28wk preeclampsia, MgSO4 drip, HELLP'),

    # === TIER 8: Edge cases ===
    ('NKDA', 'NKDA'),
    ('DNR/DNl', 'DNR/DNI'),
    ('Code B1ue called', 'Code Blue called'),
    ('Dr. A1-Haddad', 'Dr. Al-Haddad'),
    ('Mubarak A1-Kabeer Hospita1', 'Mubarak Al-Kabeer Hospital'),
    ('allergles: NKDA', 'allergies: NKDA'),
    ('rnobility: STRETCHER', 'mobility: STRETCHER'),
    ('trlage: RED', 'triage: RED'),
    ('lsolation: CONTACT', 'isolation: CONTACT'),
    ('Transferred frorn ER to lCU', 'Transferred from ER to ICU'),

    # === TIER 9: Should NOT touch these (all correct already) ===
    ('Metoprolol 25mg PO BID', 'Metoprolol 25mg PO BID'),
    ('Acute pancreatitis', 'Acute pancreatitis'),
    ('Lisinopril 10mg PO daily', 'Lisinopril 10mg PO daily'),
    ('Ward 5 Bed 12', 'Ward 5 Bed 12'),
    ('O2 via NC 4L', 'O2 via NC 4L'),
    ('Full Code', 'Full Code'),
    ('Contact isolation', 'Contact isolation'),
    ('NPO after midnight', 'NPO after midnight'),
    ('Consult: Cardiology', 'Consult: Cardiology'),
    ('IV access: 18G right AC', 'IV access: 18G right AC'),
]

# Run audit
correct = 0
false_pos = 0
wrong = 0
fps = []
misses = []

for garbled, expected in audit_cases:
    result, corrections = corrector.correct(garbled)
    if result == expected:
        correct += 1
    elif garbled == expected and result != expected:
        false_pos += 1
        fps.append((garbled, expected, result))
    else:
        wrong += 1
        misses.append((garbled, expected, result))

total = len(audit_cases)
accuracy = correct / total * 100

print('=' * 65)
print('  MEDICAL GRADE AUDIT - 100 Adversarial Cases')
print('=' * 65)
print(f'  Dictionary size:   {len(corrector.dictionary):,} entries')
print(f'  Test cases:        {total}')
print()
print(f'  CORRECT:           {correct}/{total} ({accuracy:.1f}%)')
print(f'  FALSE POSITIVES:   {false_pos}/{total}')
print(f'  MISSED:            {wrong}/{total}')
print()

if accuracy >= 98 and false_pos == 0:
    grade = 'MEDICAL GRADE (98%+ accuracy, 0 false positives)'
elif accuracy >= 95 and false_pos <= 1:
    grade = 'CLINICAL GRADE (95%+ accuracy)'
elif accuracy >= 90:
    grade = 'NEAR-CLINICAL (90%+ needs improvement)'
elif accuracy >= 80:
    grade = 'RESEARCH GRADE (80%+ not safe for clinical use alone)'
else:
    grade = 'PROTOTYPE (below 80%)'

print(f'  VERDICT: {grade}')
print()

if fps:
    print('  --- FALSE POSITIVES (CRITICAL) ---')
    for g, e, r in fps:
        print(f'    IN:       "{g}"')
        print(f'    CHANGED:  "{r}"')
        print(f'    EXPECTED: "{e}" (should be unchanged)')
        print()

if misses:
    print(f'  --- MISSES ({len(misses)} cases) ---')
    for g, e, r in misses:
        print(f'    IN:       "{g}"')
        print(f'    GOT:      "{r}"')
        print(f'    EXPECTED: "{e}"')
        print()
