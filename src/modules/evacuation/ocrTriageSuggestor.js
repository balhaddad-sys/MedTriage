// OCR Triage Suggestor — Decoupled Clinical Decision Support
//
// Medical-grade requirement: Triage suggestions must be clearly separated
// from OCR text recognition. They are SUGGESTIONS, not decisions.
//
// This module:
//   1. Takes structured patient data (from OCR or manual entry)
//   2. Produces triage/mobility/O2 SUGGESTIONS with confidence + reasoning
//   3. Every suggestion is flagged as "UNVALIDATED" until clinician confirms
//   4. Reasoning is transparent (which rules fired, which signals matched)
//   5. Keeps audit trail of suggestion vs final clinician decision
//
// IMPORTANT: This module does NOT auto-assign triage. It only suggests.
// The UI must require explicit clinician confirmation.

import { logCorrection } from './ocrAuditLog.js';

// Severity rules — each returns { triage, confidence, signal, rule }
const TRIAGE_RULES = [
  // RED — Immediately life-threatening
  {
    id: 'RED_STEMI',
    pattern: /\bSTEMI\b(?!.*\bNSTEMI\b)/i,
    field: 'dx',
    triage: 'RED',
    confidence: 0.95,
    signal: 'ST-elevation MI requires emergent cath lab',
    category: 'cardiac',
  },
  {
    id: 'RED_CARDIAC_ARREST',
    pattern: /CARDIAC ARREST|VF\b|PULSELESS/i,
    field: 'dx',
    triage: 'RED',
    confidence: 0.98,
    signal: 'Cardiac arrest / pulseless rhythm',
    category: 'cardiac',
  },
  {
    id: 'RED_STATUS_EPILEPTICUS',
    pattern: /STATUS EPILEPT/i,
    field: 'dx',
    triage: 'RED',
    confidence: 0.95,
    signal: 'Status epilepticus — prolonged seizure activity',
    category: 'neuro',
  },
  {
    id: 'RED_ARDS',
    pattern: /\bARDS\b/i,
    field: 'dx',
    triage: 'RED',
    confidence: 0.93,
    signal: 'Acute respiratory distress syndrome',
    category: 'respiratory',
  },
  {
    id: 'RED_SEPTIC_SHOCK',
    pattern: /SEPTIC SHOCK/i,
    field: 'dx',
    triage: 'RED',
    confidence: 0.96,
    signal: 'Septic shock — hemodynamic instability',
    category: 'infectious',
  },
  {
    id: 'RED_DKA',
    pattern: /\bDKA\b|DIABETIC KETOACIDOSIS/i,
    field: 'dx',
    triage: 'RED',
    confidence: 0.92,
    signal: 'DKA — metabolic emergency',
    category: 'endocrine',
  },
  {
    id: 'RED_CVA',
    pattern: /\bCVA\b|HEMORRHAGIC STROKE|ISCHEMIC STROKE|\bSAH\b/i,
    field: 'dx',
    triage: 'RED',
    confidence: 0.94,
    signal: 'Acute cerebrovascular event',
    category: 'neuro',
  },
  {
    id: 'RED_MENINGITIS',
    pattern: /MENINGITIS|ENCEPHALITIS/i,
    field: 'dx',
    triage: 'RED',
    confidence: 0.93,
    signal: 'CNS infection — urgent treatment needed',
    category: 'infectious',
  },
  {
    id: 'RED_DIC',
    pattern: /\bDIC\b|DISSEMINATED INTRAVASCULAR/i,
    field: 'dx',
    triage: 'RED',
    confidence: 0.94,
    signal: 'DIC — coagulopathy emergency',
    category: 'hematology',
  },
  {
    id: 'RED_OVERDOSE',
    pattern: /OVERDOSE|\bOD\b(?!\s*[a-z])/i,
    field: 'dx',
    triage: 'RED',
    confidence: 0.90,
    signal: 'Overdose / poisoning',
    category: 'toxicology',
  },
  {
    id: 'RED_GI_VARICEAL',
    pattern: /VARICES|VARICEAL/i,
    field: 'dx',
    triage: 'RED',
    confidence: 0.91,
    signal: 'Variceal bleeding — high mortality risk',
    category: 'gi',
  },
  {
    id: 'RED_RESP_FAILURE',
    pattern: /RESP(?:IRATORY)? FAILURE|TYPE [12] RF/i,
    field: 'dx',
    triage: 'RED',
    confidence: 0.92,
    signal: 'Respiratory failure',
    category: 'respiratory',
  },
  {
    id: 'RED_ECLAMPSIA',
    pattern: /\bECLAMPSIA\b(?!PRE)/i,
    field: 'dx',
    triage: 'RED',
    confidence: 0.95,
    signal: 'Eclampsia — obstetric emergency',
    category: 'obstetric',
  },
  {
    id: 'RED_PPH',
    pattern: /\bPPH\b|POSTPARTUM (?:H[AE]EMORRHAGE|BLEED)/i,
    field: 'dx',
    triage: 'RED',
    confidence: 0.95,
    signal: 'Postpartum hemorrhage',
    category: 'obstetric',
  },

  // YELLOW — Urgent but not immediately life-threatening
  {
    id: 'YELLOW_NSTEMI',
    pattern: /\bNSTEMI\b|ACS/i,
    field: 'dx',
    triage: 'YELLOW',
    confidence: 0.90,
    signal: 'Acute coronary syndrome (non-ST elevation)',
    category: 'cardiac',
  },
  {
    id: 'YELLOW_PE',
    pattern: /(?<![A-Za-z0-9])\bPE\b(?![A-Za-z0-9])|PULMONARY EMBOLISM/i,
    field: 'dx',
    triage: 'YELLOW',
    confidence: 0.88,
    signal: 'Pulmonary embolism',
    category: 'respiratory',
  },
  {
    id: 'YELLOW_AKI',
    pattern: /\bAKI\b|ACUTE KIDNEY INJURY/i,
    field: 'dx',
    triage: 'YELLOW',
    confidence: 0.87,
    signal: 'Acute kidney injury',
    category: 'renal',
  },
  {
    id: 'YELLOW_SEPSIS',
    pattern: /\bSEPSIS\b(?!\s*SHOCK)/i,
    field: 'dx',
    triage: 'YELLOW',
    confidence: 0.88,
    signal: 'Sepsis (without shock)',
    category: 'infectious',
  },
  {
    id: 'YELLOW_ADHF',
    pattern: /\bADHF\b|DECOMPENSATED/i,
    field: 'dx',
    triage: 'YELLOW',
    confidence: 0.87,
    signal: 'Acute decompensated heart failure',
    category: 'cardiac',
  },
  {
    id: 'YELLOW_CAP',
    pattern: /\bCAP\b(?!\w)|COMMUNITY ACQUIRED PNEUMONIA/i,
    field: 'dx',
    triage: 'YELLOW',
    confidence: 0.82,
    signal: 'Community acquired pneumonia',
    category: 'respiratory',
  },
  {
    id: 'YELLOW_UGIB',
    pattern: /\bUGIB\b|UPPER GI BLEED/i,
    field: 'dx',
    triage: 'YELLOW',
    confidence: 0.88,
    signal: 'Upper GI bleeding',
    category: 'gi',
  },
  {
    id: 'YELLOW_SBO',
    pattern: /\bSBO\b|SMALL BOWEL OBSTRUCTION/i,
    field: 'dx',
    triage: 'YELLOW',
    confidence: 0.85,
    signal: 'Small bowel obstruction',
    category: 'gi',
  },
  {
    id: 'YELLOW_DVT',
    pattern: /\bDVT\b|DEEP VEIN THROMBOSIS/i,
    field: 'dx',
    triage: 'YELLOW',
    confidence: 0.82,
    signal: 'Deep vein thrombosis',
    category: 'vascular',
  },
  {
    id: 'YELLOW_AECOPD',
    pattern: /AECOPD|EXACERBATION.*COPD|COPD.*EXACERBATION/i,
    field: 'dx',
    triage: 'YELLOW',
    confidence: 0.83,
    signal: 'COPD exacerbation',
    category: 'respiratory',
  },
  {
    id: 'YELLOW_SEIZURE',
    pattern: /\bSEIZURE\b(?!.*STATUS)/i,
    field: 'dx',
    triage: 'YELLOW',
    confidence: 0.80,
    signal: 'Seizure (non-status)',
    category: 'neuro',
  },
  {
    id: 'YELLOW_PANCREATITIS',
    pattern: /PANCREATITIS/i,
    field: 'dx',
    triage: 'YELLOW',
    confidence: 0.82,
    signal: 'Acute pancreatitis',
    category: 'gi',
  },
  {
    id: 'RED_CHOLANGITIS',
    pattern: /CHOLANGITIS/i,
    field: 'dx',
    triage: 'RED',
    confidence: 0.88,
    signal: 'Ascending cholangitis — biliary sepsis risk',
    category: 'gi',
  },

  // GREEN — Stable / chronic
  {
    id: 'GREEN_UTI',
    pattern: /\bUTI\b|URINARY TRACT INFECTION/i,
    field: 'dx',
    triage: 'GREEN',
    confidence: 0.85,
    signal: 'Urinary tract infection (uncomplicated)',
    category: 'infectious',
  },
  {
    id: 'GREEN_HTN',
    pattern: /\bHTN\b(?!.*CRISIS)(?!.*MALIGNANT)/i,
    field: 'dx',
    triage: 'GREEN',
    confidence: 0.88,
    signal: 'Hypertension (stable)',
    category: 'cardiac',
  },
  {
    id: 'GREEN_DM',
    pattern: /\bDM[12]?\b(?!.*DKA)(?!.*HHS)/i,
    field: 'dx',
    triage: 'GREEN',
    confidence: 0.85,
    signal: 'Diabetes mellitus (stable)',
    category: 'endocrine',
  },
  {
    id: 'GREEN_CKD_EARLY',
    pattern: /\bCKD[1-3]\b(?!.*AKI)/i,
    field: 'dx',
    triage: 'GREEN',
    confidence: 0.83,
    signal: 'Chronic kidney disease (early stage)',
    category: 'renal',
  },
  {
    id: 'GREEN_CELLULITIS',
    pattern: /CELLULITIS/i,
    field: 'dx',
    triage: 'GREEN',
    confidence: 0.82,
    signal: 'Cellulitis',
    category: 'infectious',
  },
];

// Mobility rules
const MOBILITY_RULES = [
  {
    id: 'MOB_CRITICAL',
    pattern: /VENTILAT|INTUBAT|ARDS|CARDIAC ARREST|ETT/i,
    field: 'dx',
    mobility: 'CRITICAL_TRANSPORT',
    confidence: 0.95,
    signal: 'Ventilated / intubated patient',
  },
  {
    id: 'MOB_CRITICAL_O2',
    check: (p) => (p.o2 || '').toUpperCase() === 'VENTILATOR',
    mobility: 'CRITICAL_TRANSPORT',
    confidence: 0.95,
    signal: 'On mechanical ventilation',
  },
  {
    id: 'MOB_STRETCHER',
    pattern: /CVA|STROKE|SAH|ICH|FRACTURE|GBS|NOF|SDH|EDH|POST.?OP|PARAPL|QUADRI/i,
    field: 'dx',
    mobility: 'STRETCHER',
    confidence: 0.88,
    signal: 'Immobilized / post-operative / neurological deficit',
  },
  {
    id: 'MOB_WHEELCHAIR',
    pattern: /CHF|ADHF|PE|COPD|AECOPD|CAP/i,
    field: 'dx',
    mobility: 'WHEELCHAIR',
    confidence: 0.80,
    signal: 'Reduced exercise tolerance',
  },
  {
    id: 'MOB_WHEELCHAIR_O2',
    check: (p) => ['BIPAP', 'NON_REBREATHER'].includes((p.o2 || '').toUpperCase()),
    mobility: 'WHEELCHAIR',
    confidence: 0.85,
    signal: 'On respiratory support',
  },
];

// O2 suggestion rules
const O2_RULES = [
  {
    id: 'O2_VENT',
    pattern: /VENTILAT|INTUBAT|ARDS|ETT/i,
    field: 'dx',
    o2: 'VENTILATOR',
    confidence: 0.95,
    signal: 'Mechanical ventilation indicated',
  },
  {
    id: 'O2_BIPAP',
    pattern: /BIPAP|CPAP|NIV|TYPE 2 RF/i,
    field: 'dx',
    o2: 'BIPAP',
    confidence: 0.88,
    signal: 'Non-invasive ventilation',
  },
  {
    id: 'O2_NRB',
    pattern: /SEVERE.*PNEUMONIA|ARDS|RESP(?:IRATORY)? FAILURE/i,
    field: 'dx',
    o2: 'NON_REBREATHER',
    confidence: 0.82,
    signal: 'Severe respiratory compromise',
  },
  {
    id: 'O2_NASAL',
    pattern: /CAP|AECOPD|CHF|ADHF|SEPSIS|PNEUMONIA/i,
    field: 'dx',
    o2: 'NASAL_CANNULA',
    confidence: 0.72,
    signal: 'Supplemental oxygen likely needed',
  },
];

// Isolation suggestion rules
const ISOLATION_RULES = [
  {
    id: 'ISO_AIRBORNE',
    pattern: /\bTB\b|TUBERCULOSIS|COVID.*PNEUMONIA|MEASLES|VARICELLA/i,
    field: 'dx',
    iso: 'AIRBORNE',
    confidence: 0.90,
    signal: 'Airborne precautions — respiratory pathogen',
  },
  {
    id: 'ISO_DROPLET',
    pattern: /INFLUENZA|COVID(?!.*PNEUMONIA)|MENINGOCOCCAL/i,
    field: 'dx',
    iso: 'DROPLET',
    confidence: 0.85,
    signal: 'Droplet precautions',
  },
  {
    id: 'ISO_CONTACT',
    pattern: /MRSA|VRE|ESBL|CRE|CDI|C\.?\s*DIFF/i,
    field: 'dx',
    iso: 'CONTACT',
    confidence: 0.88,
    signal: 'Contact precautions — MDR organism',
  },
];

// Generate triage suggestion for a patient
export function suggestTriage(patient) {
  const dx = (patient.dx || '').toUpperCase();
  if (!dx) {
    return {
      triage: null,
      confidence: 0,
      status: 'UNVALIDATED',
      rules: [],
      reasoning: 'No diagnosis available for triage assessment',
      requiresClinicianConfirmation: true,
    };
  }

  const matchedRules = [];
  for (const rule of TRIAGE_RULES) {
    if (rule.pattern && rule.pattern.test(dx)) {
      matchedRules.push({
        ruleId: rule.id,
        triage: rule.triage,
        confidence: rule.confidence,
        signal: rule.signal,
        category: rule.category,
      });
    }
  }

  if (matchedRules.length === 0) {
    return {
      triage: null,
      confidence: 0,
      status: 'UNVALIDATED',
      rules: [],
      reasoning: 'No matching triage rules — clinician must assign manually',
      requiresClinicianConfirmation: true,
    };
  }

  // Pick highest severity
  const PRIORITY = { RED: 3, YELLOW: 2, GREEN: 1 };
  matchedRules.sort((a, b) => (PRIORITY[b.triage] || 0) - (PRIORITY[a.triage] || 0));
  const best = matchedRules[0];

  return {
    triage: best.triage,
    confidence: best.confidence,
    status: 'UNVALIDATED',
    rules: matchedRules,
    reasoning: `Suggested ${best.triage} based on: ${matchedRules.map(r => r.signal).join('; ')}`,
    requiresClinicianConfirmation: true,
    conflictingSignals: matchedRules.filter(r => r.triage !== best.triage).length > 0,
  };
}

// Generate mobility suggestion
export function suggestMobility(patient) {
  const dx = (patient.dx || '').toUpperCase();
  const matchedRules = [];

  for (const rule of MOBILITY_RULES) {
    if (rule.check && rule.check(patient)) {
      matchedRules.push({ ruleId: rule.id, mobility: rule.mobility, confidence: rule.confidence, signal: rule.signal });
    } else if (rule.pattern && rule.pattern.test(dx)) {
      matchedRules.push({ ruleId: rule.id, mobility: rule.mobility, confidence: rule.confidence, signal: rule.signal });
    }
  }

  if (matchedRules.length === 0) {
    return {
      mobility: null,  // null = not assessed, NOT "ambulatory"
      confidence: 0,
      status: 'UNVALIDATED',
      rules: [],
      reasoning: 'No mobility assessment possible — no matching conditions',
      requiresClinicianConfirmation: true,
    };
  }

  const PRIORITY = { CRITICAL_TRANSPORT: 3, STRETCHER: 2, WHEELCHAIR: 1, AMBULATORY: 0 };
  matchedRules.sort((a, b) => (PRIORITY[b.mobility] || 0) - (PRIORITY[a.mobility] || 0));

  return {
    mobility: matchedRules[0].mobility,
    confidence: matchedRules[0].confidence,
    status: 'UNVALIDATED',
    rules: matchedRules,
    reasoning: `Suggested ${matchedRules[0].mobility}: ${matchedRules[0].signal}`,
    requiresClinicianConfirmation: true,
  };
}

// Generate O2 suggestion
export function suggestO2(patient) {
  const dx = (patient.dx || '').toUpperCase();
  const matchedRules = [];

  for (const rule of O2_RULES) {
    if (rule.pattern.test(dx)) {
      matchedRules.push({ ruleId: rule.id, o2: rule.o2, confidence: rule.confidence, signal: rule.signal });
    }
  }

  if (matchedRules.length === 0) {
    return { o2: null, confidence: 0, status: 'UNVALIDATED', rules: [], reasoning: 'No O2 assessment possible — no matching conditions', requiresClinicianConfirmation: true };
  }

  const PRIORITY = { VENTILATOR: 4, BIPAP: 3, NON_REBREATHER: 2, FACE_MASK: 1, NASAL_CANNULA: 0 };
  matchedRules.sort((a, b) => (PRIORITY[b.o2] || 0) - (PRIORITY[a.o2] || 0));

  return {
    o2: matchedRules[0].o2,
    confidence: matchedRules[0].confidence,
    status: 'UNVALIDATED',
    rules: matchedRules,
    reasoning: matchedRules[0].signal,
    requiresClinicianConfirmation: true,
  };
}

// Generate isolation suggestion
export function suggestIsolation(patient) {
  const dx = (patient.dx || '').toUpperCase();
  const matchedRules = [];

  for (const rule of ISOLATION_RULES) {
    if (rule.pattern.test(dx)) {
      matchedRules.push({ ruleId: rule.id, iso: rule.iso, confidence: rule.confidence, signal: rule.signal });
    }
  }

  if (matchedRules.length === 0) {
    return { iso: null, confidence: 0, status: 'UNVALIDATED', rules: [], reasoning: 'No isolation assessment possible — no matching conditions', requiresClinicianConfirmation: true };
  }

  const PRIORITY = { AIRBORNE: 3, DROPLET: 2, CONTACT: 1 };
  matchedRules.sort((a, b) => (PRIORITY[b.iso] || 0) - (PRIORITY[a.iso] || 0));

  return {
    iso: matchedRules[0].iso,
    confidence: matchedRules[0].confidence,
    status: 'UNVALIDATED',
    rules: matchedRules,
    reasoning: matchedRules[0].signal,
    requiresClinicianConfirmation: true,
  };
}

// Full clinical suggestion bundle
export function suggestClinicalParameters(patient) {
  const triage = suggestTriage(patient);
  const mobility = suggestMobility(patient);
  const o2 = suggestO2(patient);
  const isolation = suggestIsolation(patient);

  return {
    triage,
    mobility,
    o2,
    isolation,
    allUnvalidated: true,
    requiresClinicianConfirmation: true,
    safetyNotice: 'All clinical suggestions are UNVALIDATED and require clinician confirmation before use in patient care decisions.',
  };
}

// Record when clinician confirms/changes a suggestion (for audit + calibration)
export async function recordTriageDecision(transactionId, patientIndex, { suggested, confirmed, field, confirmedBy }) {
  await logCorrection({
    transactionId,
    patientIndex,
    field: `suggestion_${field}`,
    ocrValue: suggested,
    correctedValue: confirmed,
    correctedBy: confirmedBy || 'clinician',
  });
}
