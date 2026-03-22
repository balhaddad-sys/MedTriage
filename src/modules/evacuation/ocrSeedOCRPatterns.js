// OCR Seed — Systematic OCR error patterns
// Algorithmically generates thousands of corrections from known confusion rules
// Instead of manually listing every word, we apply confusion patterns to
// the entire vocabulary to generate corrections automatically.

// The core OCR confusions from real-world medical document scanning
const CONFUSION_PAIRS = [
  ['m', 'rn'],  // THE #1 medical OCR error
  ['m', 'nn'],
  ['w', 'vv'],
  ['d', 'cl'],
  ['cl', 'd'],
  ['rn', 'm'],
  ['l', '1'],
  ['1', 'l'],
  ['I', 'l'],
  ['l', 'I'],
  ['0', 'O'],
  ['O', '0'],
  ['i', 'l'],
  ['5', 'S'],
  ['S', '5'],
  ['8', 'B'],
  ['B', '8'],
  ['6', 'G'],
  ['G', '6'],
  ['2', 'Z'],
  ['Z', '2'],
  ['n', 'ri'],
  ['ri', 'n'],
  ['h', 'li'],
  ['li', 'h'],
  ['fi', 'fl'],
  ['fl', 'fi'],
  ['tt', 'H'],
  ['ii', 'u'],
  ['u', 'ii'],
  ['rr', 'n'],
  ['vv', 'w'],
  ['nn', 'm'],
];

// High-value medical words to generate confusion variants for
const MEDICAL_WORDS = [
  'medication','medications','medicine','medicines','treatment','management',
  'monitor','monitoring','monitored','minimal','minimum','maximum',
  'membrane','murmur','muscle','muscular','movement','movement',
  'malignant','malignancy','metastatic','metastasis','metastases',
  'mechanism','moderate','modified','morning','month','monthly',
  'myocardial','myocardium','myopathy','myalgia',
  'complete','completed','completion','complication','complications',
  'complaint','complains','community','communication','comfortable',
  'comfort','combination','combined','component','composition',
  'imaging','impaired','impairment','implant','immune','immunity',
  'immunosuppressed','immunosuppression','immunocompromised',
  'improved','improving','improvement',
  'inflammation','inflammatory','infiltrate','infection','infected',
  'infectious','infusion','information','informed',
  'symptom','symptoms','symptomatic',
  'extremity','extremities',
  'environment','environmental',
  'hemoglobin','hemoglobin','hematocrit','hematology','hematoma',
  'hemodialysis','hemodynamic','hemodynamically','hemorrhage','hemorrhagic',
  'hemolysis','hemolytic','hemostasis',
  'pneumonia','pneumothorax','pneumonitis',
  'bilateral','bilaterally',
  'clinical','clinically',
  'critical','critically',
  'normal','normally','abnormal','abnormally',
  'stable','unstable',
  'initial','initially',
  'minimal','minimally',
  'terminal','terminally',
  'renal','adrenal',
  'mental','fundamental',
  'abdominal','nominal',
  'ventilator','ventilation','ventilated',
  'consultant','consultation','consulted',
  'transfusion','transfused',
  'administration','administered',
  'respiratory','respiration',
  'cardiovascular','cerebrovascular',
  'neurological','neurology','neurologist',
  'musculoskeletal','gastrointestinal',
  'genitourinary','integumentary',
  'psychiatric','psychiatry','psychiatrist',
  'endocrine','endocrinology',
  'hematology','hematologist',
  'oncology','oncologist',
  'nephrology','nephrologist',
  'cardiology','cardiologist',
  'pulmonology','pulmonologist',
  'gastroenterology','gastroenterologist',
  'rheumatology','rheumatologist',
  'infectious','dermatology','dermatologist',
  'surgical','surgery','surgeon',
  'orthopaedic','orthopedic','orthopaedics',
  'obstetrics','obstetrician','gynecology','gynecologist',
  'paediatrics','pediatrics','pediatrician',
  'anesthesia','anesthesiology','anesthesiologist',
  'radiology','radiologist','pathology','pathologist',
  'pharmacology','pharmacist','pharmacy',
  'rehabilitation','physiotherapy','physiotherapist',
  'occupational','occupational therapy',
  'nutrition','nutritionist','dietitian',
  'social','social work','social worker',
  'discharge','discharged','admission','admitted',
  'antibiotics','antibiotic','antifungal','antiviral',
  'anticoagulant','anticoagulation','antiplatelet',
  'antihypertensive','antidiabetic','antiepileptic',
  'insulin','intravenous','intramuscular','subcutaneous',
  'assessment','reassessment','evaluation','examination',
  'diagnosis','diagnostic','prognosis','prognostic',
  'temperature','measurement','measurement',
  'laboratory','investigation','investigations',
  'intervention','interventional',
  'comorbidity','comorbidities',
  'mortality','morbidity',
  'significant','significantly',
  'recommendation','recommendations',
  'documentation','documented',
  'communication','communicated',
  'continuation','continued','continuing',
  'deterioration','deteriorating','deteriorated',
  'stabilization','stabilized','stabilizing',
  'optimization','optimized','optimizing',
  'mobilization','mobilized','mobilizing',
  'elimination','eliminated',
  'accumulation','accumulated',
  'administration','administered',
  'implementation','implemented',
  'interpretation','interpreted',
  'determination','determined',
  'presentation','presenting',
  'manifestation','manifesting',
  'demonstration','demonstrated',
  'consideration','considered',
  'classification','classified',
  'identification','identified',
  'modification','modified',
  'notification','notified',
  'verification','verified',
  'preparation','prepared',
  'observation','observed','observing',
  'orientation','oriented','orientated',
  'contamination','contaminated',
  'decompensation','decompensated',
  'exacerbation','exacerbated',
  'commencement','commenced',
];

// Generate all confusion variants for a word
function generateConfusions(word) {
  const corrections = {};
  const lower = word.toLowerCase();

  for (const [from, to] of CONFUSION_PAIRS) {
    let idx = 0;
    while (true) {
      const pos = lower.indexOf(from, idx);
      if (pos === -1) break;
      // Generate the confused version
      const confused = lower.substring(0, pos) + to + lower.substring(pos + from.length);
      if (confused !== lower && confused.length >= 3) {
        corrections[confused] = {
          truth: word.charAt(0).toUpperCase() + word.slice(1),
          entity: 'CLINICAL',
          count: 3,
          confidence: 0.88,
          seeded: true,
          confusionRule: `${from}→${to}`,
        };
      }
      idx = pos + 1;
    }
  }
  return corrections;
}

// Generate all corrections
export function generateAllOCRCorrections() {
  const allCorrections = {};
  for (const word of MEDICAL_WORDS) {
    const confusions = generateConfusions(word);
    Object.assign(allCorrections, confusions);
  }
  return allCorrections;
}

// Common multi-word phrases and their OCR-mangled versions
export const PHRASE_CORRECTIONS = {
  // Exam findings
  'no acute dlstress': 'no acute distress',
  'no acute d1stress': 'no acute distress',
  'c1ear to auscultation': 'clear to auscultation',
  'ciear to auscultation': 'clear to auscultation',
  'c1ear to auscu1tation': 'clear to auscultation',
  'regu1ar rate and rhythm': 'regular rate and rhythm',
  'regular rate and rhythrn': 'regular rate and rhythm',
  'soft non-tender': 'soft non-tender',
  'soft non-lender': 'soft non-tender',
  'bowe1 sounds present': 'bowel sounds present',
  'bowel sounds presenl': 'bowel sounds present',
  'no rnurrnur': 'no murmur',
  'no rnurmur': 'no murmur',
  'no rnurrner': 'no murmur',
  'bilateral 1ower': 'bilateral lower',
  'bi1atera1 lower': 'bilateral lower',
  'decreased breath sounds': 'decreased breath sounds',
  'decreased breaih sounds': 'decreased breath sounds',
  'decreased brealh sounds': 'decreased breath sounds',
  // Common phrases
  'assessrnent and p1an': 'assessment and plan',
  'assessrnent/plan': 'assessment/plan',
  'history of presenl illness': 'history of present illness',
  'history of present i11ness': 'history of present illness',
  'past rnedica1 history': 'past medical history',
  'past rnedical history': 'past medical history',
  'review of systerns': 'review of systems',
  'review of syslems': 'review of systems',
  'physica1 exarnination': 'physical examination',
  'physica1 examination': 'physical examination',
  'physical exarnination': 'physical examination',
  'vita1 signs': 'vital signs',
  'vilal signs': 'vital signs',
  'vital slgns': 'vital signs',
  'rnedication 1ist': 'medication list',
  'rnedication list': 'medication list',
  'medication 1ist': 'medication list',
  'a1lergy list': 'allergy list',
  'allergy 1ist': 'allergy list',
  'fol1ow up': 'follow up',
  'fo11ow up': 'follow up',
  'foilow up': 'follow up',
  'discharge p1an': 'discharge plan',
  'dlscharge plan': 'discharge plan',
  'discharge pian': 'discharge plan',
  'code stalus': 'code status',
  'code slatus': 'code status',
  'goa1s of care': 'goals of care',
  'goais of care': 'goals of care',
  'goals of cere': 'goals of care',
  // Lab values
  'hernoglobin': 'hemoglobin',
  'hernatocrit': 'hematocrit',
  'p1atelets': 'platelets',
  'plateiet count': 'platelet count',
  'white b1ood ce11': 'white blood cell',
  'whlte blood cell': 'white blood cell',
  'creatinine c1earance': 'creatinine clearance',
  'creatinine ciearance': 'creatinine clearance',
  'b1ood culture': 'blood culture',
  'biood culture': 'blood culture',
  'blood cu1ture': 'blood culture',
  'urine cu1ture': 'urine culture',
  'sputurn culture': 'sputum culture',
  'sputum cu1ture': 'sputum culture',
  // Diagnoses
  'acute kidney lnjury': 'acute kidney injury',
  'acute kidney injury': 'acute kidney injury',
  'chronic kidney dlsease': 'chronic kidney disease',
  'chronic kidney d1sease': 'chronic kidney disease',
  'heart fai1ure': 'heart failure',
  'hearl failure': 'heart failure',
  'heart faliure': 'heart failure',
  'respiratory fai1ure': 'respiratory failure',
  'respiratory faiiure': 'respiratory failure',
  'rnyocardial infarction': 'myocardial infarction',
  'myocardia1 infarction': 'myocardial infarction',
  'myocardial lnfarction': 'myocardial infarction',
  'pu1monary ernbolism': 'pulmonary embolism',
  'pu1monary embolism': 'pulmonary embolism',
  'pulmonary ernbolism': 'pulmonary embolism',
  'cerebrovascular accidenl': 'cerebrovascular accident',
  'cerebrovascular accldent': 'cerebrovascular accident',
  'urinary tracl infection': 'urinary tract infection',
  'urinary tract lnfection': 'urinary tract infection',
  'cornrnunity acquired': 'community acquired',
  'cornmunity acquired': 'community acquired',
  'comrnunity acquired': 'community acquired',
  'hospita1 acquired': 'hospital acquired',
  'hospltal acquired': 'hospital acquired',
};

export function loadOCRPatternSeedData(models) {
  // Generate algorithmic corrections
  const generated = generateAllOCRCorrections();
  for (const [ocr, correction] of Object.entries(generated)) {
    if (!models.corrections[ocr]) {
      models.corrections[ocr] = correction;
    }
  }

  // Add phrase corrections
  for (const [ocr, truth] of Object.entries(PHRASE_CORRECTIONS)) {
    if (!models.corrections[ocr]) {
      models.corrections[ocr] = {
        truth,
        entity: 'CLINICAL',
        count: 3,
        confidence: 0.90,
        seeded: true,
      };
    }
  }

  models.ocrPatternsSeeded = true;
  return models;
}
