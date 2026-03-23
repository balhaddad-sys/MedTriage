import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../../app.jsx';
import { colors, fonts, triageColors, triageTextColors } from '../../design/tokens.js';
import Modal from '../../shared/Modal.jsx';
import { CameraIcon, CheckIcon, AlertTriangle } from '../../design/icons.jsx';
import { processPatientListImage } from './ocrEngine.js';
import { logAction } from '../../data/audit.js';
import { saveTrainingSample, getTrainingStats, exportTrainingJSON, exportTrainingCSV } from './ocrDataCollector.js';
import { runLearningCycle, getLearningStats } from './ocrLearner.js';
import { validatePatient, assessOcrImportReadiness, collectPatientSafetyFlags } from './ocrPatientSchema.js';

const TRIAGE_LIST = ['RED', 'YELLOW', 'GREEN', 'GRAY', 'BLACK'];
const REVIEW_STYLES = {
  READY: { label: 'READY', color: colors.green },
  REVIEW: { label: 'REVIEW', color: colors.amber },
  VERIFY: { label: 'VERIFY', color: colors.red },
};

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: '16px' },
  captureArea: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '12px', padding: '24px', borderRadius: '12px',
    border: `2px dashed ${colors.border}`, background: colors.bg2,
    cursor: 'pointer',
  },
  captureLabel: { fontSize: '13px', color: colors.text2, fontWeight: 600 },
  preview: {
    width: '100%', maxHeight: '200px', objectFit: 'contain',
    borderRadius: '8px', background: colors.bg0,
  },
  progressBar: {
    display: 'flex', flexDirection: 'column', gap: '8px',
    padding: '16px', background: colors.bg2, borderRadius: '10px',
  },
  progressText: { fontSize: '12px', color: colors.blue, fontWeight: 600, fontFamily: fonts.mono },
  progressBarTrack: { height: '4px', borderRadius: '2px', background: colors.bg0 },
  progressBarFill: {
    height: '4px', borderRadius: '2px', background: colors.blue,
    transition: 'width 300ms', width: '0%',
  },
  resultCard: {
    padding: '12px', borderRadius: '10px', border: `1px solid ${colors.border}`,
    background: colors.bg2, display: 'flex', flexDirection: 'column', gap: '6px',
  },
  resultName: { fontSize: '14px', fontWeight: 700, color: colors.text0 },
  resultField: { fontSize: '11px', color: colors.text2, fontFamily: fonts.mono },
  reviewBadge: {
    padding: '4px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 800,
    fontFamily: fonts.mono, border: `1px solid ${colors.border}`,
  },
  reviewReason: { fontSize: '11px', color: colors.text3, fontFamily: fonts.mono },
  qualityPanel: {
    padding: '12px', borderRadius: '10px', background: colors.bg2,
    border: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', gap: '8px',
  },
  panelTitle: { fontSize: '12px', fontWeight: 700, color: colors.text1 },
  metaRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  metaPill: {
    padding: '4px 8px', borderRadius: '999px', background: colors.bg0,
    color: colors.text2, fontSize: '10px', fontWeight: 700, fontFamily: fonts.mono,
    border: `1px solid ${colors.border}`,
  },
  editGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '4px' },
  fieldLabel: {
    fontSize: '10px', color: colors.text3, fontWeight: 700,
    fontFamily: fonts.mono, letterSpacing: '0.4px',
  },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: `1px solid ${colors.border}`, background: colors.bg0,
    color: colors.text0, fontSize: '13px', fontFamily: fonts.sans, outline: 'none',
  },
  resultWarning: {
    fontSize: '11px', color: colors.amber, fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: '4px',
  },
  triageRow: { display: 'flex', gap: '4px' },
  triageBtn: {
    flex: 1, height: '28px', border: 'none', borderRadius: '6px',
    fontSize: '9px', fontWeight: 800, cursor: 'pointer', fontFamily: fonts.mono,
  },
  actionRow: { display: 'flex', gap: '8px', marginTop: '8px' },
  btn: {
    flex: 1, height: '44px', border: 'none', borderRadius: '10px',
    fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: fonts.sans,
  },
  rawText: {
    fontSize: '11px', fontFamily: fonts.mono, color: colors.text3,
    background: colors.bg0, padding: '8px', borderRadius: '6px',
    maxHeight: '100px', overflow: 'auto', whiteSpace: 'pre-wrap',
  },
  statsRow: {
    display: 'flex', gap: '12px', fontSize: '11px', fontFamily: fonts.mono, color: colors.text3, flexWrap: 'wrap',
  },
};

function withUpdatedReviewCount(prev, patients) {
  return {
    ...prev,
    patients,
    reviewCount: patients.filter(patient => patient.reviewLevel !== 'READY').length,
  };
}

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function stripSchemaReviewReasons(reviewReasons = []) {
  return reviewReasons.filter(reason => !/^Schema (error|warning):/.test(reason) && !/^Safety escalation:/.test(reason));
}

function refreshEditedPatientState(patient) {
  const validation = validatePatient(patient);
  const normalizedSafetyFlags = collectPatientSafetyFlags({
    safetyFlags: patient?.ocrMeta?.autoSafetyFlags || [],
    ocrMeta: { safetyFlags: validation.safetyFlags || [] },
  });
  let reviewLevel = patient.reviewLevel || patient.ocrMeta?.reviewLevel || 'REVIEW';
  if (!validation.valid) {
    reviewLevel = 'VERIFY';
  } else if ((validation.warnings.length > 0 || normalizedSafetyFlags.length > 0) && reviewLevel === 'READY') {
    reviewLevel = 'REVIEW';
  }
  if ((validation.safetyFlags || []).some(flag => flag === 'NAME_MISSING' || flag === 'BED_MISSING')) {
    reviewLevel = 'VERIFY';
  }

  const schemaReasons = [
    ...validation.errors.map(error => `Schema error: ${error}`),
    ...validation.warnings.map(warning => `Schema warning: ${warning}`),
    ...((validation.safetyFlags || []).some(flag => flag === 'NAME_MISSING' || flag === 'BED_MISSING')
      ? ['Safety escalation: missing name or bed requires manual verification']
      : []),
  ];

  return {
    ...patient,
    reviewLevel,
    schemaValid: validation.valid,
    schemaErrors: validation.errors,
    safetyFlags: normalizedSafetyFlags,
    reviewReasons: uniqueStrings([
      ...stripSchemaReviewReasons(patient.reviewReasons || []),
      ...schemaReasons,
    ]),
    ocrMeta: {
      ...(patient.ocrMeta || {}),
      reviewLevel,
      safetyFlags: normalizedSafetyFlags,
      safetyFlagCodes: normalizedSafetyFlags.map(flag => flag.code).filter(Boolean),
      schemaValid: validation.valid,
      schemaErrors: validation.errors,
      schemaWarnings: validation.warnings,
    },
  };
}

function summarizeImportBlockers(blocked) {
  if (!blocked.length) return '';
  const blockerCounts = new Map();
  for (const { readiness } of blocked) {
    for (const blocker of readiness.blockers) {
      blockerCounts.set(blocker.code || blocker.message, {
        count: (blockerCounts.get(blocker.code || blocker.message)?.count || 0) + 1,
        message: blocker.message,
      });
    }
  }
  const details = [...blockerCounts.values()]
    .sort((a, b) => b.count - a.count)
    .map(entry => `${entry.count} patient(s): ${entry.message}`);
  return details.join(' ');
}

export default function OCRScanner({ onClose, onImport }) {
  const { addPatient, auth } = useApp();
  const [stage, setStage] = useState('capture'); // capture | processing | review
  const [imageUrl, setImageUrl] = useState(null);
  const [progress, setProgress] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedPatients, setSelectedPatients] = useState(new Set());
  const [showRaw, setShowRaw] = useState(false);
  const fileRef = useRef(null);
  const imageFileRef = useRef(null); // original image for training data

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const handleCapture = useCallback(() => {
    fileRef.current?.click();
  }, []);

  // Demo scenarios — simulate realistic ward sheet OCR for testing
  const DEMO_SCENARIOS = [
    {
      name: 'Internal Medicine Ward (Mubarak Al-Kabeer)',
      strategy: 'table-grid',
      patients: [
        { fullName: 'Ahmed Al-Mutairi', bed: 'E-M-03', age: 67, gender: 'M', dx: 'NSTEMI, DM2, HTN', meds: 'Aspirin, Ticagrelor, Enoxaparin, Metformin, Atorvastatin', triage: 'RED', mobility: 'STRETCHER', o2: 'NASAL_CANNULA', iso: 'NONE', code: 'FULL', allergies: 'NKDA', bloodType: 'A+', ward: 'Med-3', assignedDoctor: 'Dr. Nasser', confidence: 0.95, reviewLevel: 'READY' },
        { fullName: 'Fatima Al-Hajri', bed: 'E-F-07', age: 45, gender: 'F', dx: 'CAP, AECOPD', meds: 'Ceftriaxone, Azithromycin, Salbutamol, Ipratropium, Prednisolone', triage: 'YELLOW', mobility: 'WHEELCHAIR', o2: 'FACE_MASK', iso: 'DROPLET', code: 'FULL', allergies: 'Penicillin', bloodType: 'O+', ward: 'Med-3', assignedDoctor: 'Dr. Hani', confidence: 0.92, reviewLevel: 'READY' },
        { fullName: 'Khaled Al-Enezi', bed: 'E-M-12', age: 78, gender: 'M', dx: 'CVA (MCA), AF, CKD3B, HTN', meds: 'Apixaban, Amlodipine, Atorvastatin, Ramipril', triage: 'RED', mobility: 'STRETCHER', o2: 'NONE', iso: 'NONE', code: 'DNR', allergies: 'Sulfa', bloodType: 'B-', ward: 'Med-3', assignedDoctor: 'Dr. Nasser', confidence: 0.88, reviewLevel: 'REVIEW', reviewReasons: ['Low name confidence — verify Arabic spelling'] },
        { fullName: 'Sara Al-Dosari', bed: 'E-F-02', age: 32, gender: 'F', dx: 'DKA, T1DM', meds: 'Insulin Aspart, Insulin Glargine, KCl, NS 0.9%', triage: 'RED', mobility: 'AMBULATORY', o2: 'NONE', iso: 'NONE', code: 'FULL', allergies: 'NKDA', bloodType: 'AB+', ward: 'Med-3', assignedDoctor: 'Dr. Hani', confidence: 0.96, reviewLevel: 'READY' },
        { fullName: 'Hamad Al-Shammari', bed: 'E-M-09', age: 55, gender: 'M', dx: 'UGIB, CLD, Portal HTN', meds: 'Pantoprazole 80mg IV, Octreotide, Lactulose, Spironolactone', triage: 'YELLOW', mobility: 'STRETCHER', o2: 'NONE', iso: 'NONE', code: 'FULL', allergies: 'NKDA', bloodType: 'O-', ward: 'Med-3', confidence: 0.91, reviewLevel: 'READY' },
        { fullName: 'Noura Al-Kandari', bed: 'E-F-15', age: 63, gender: 'F', dx: 'ADHF, CKD4, DM2, HTN', meds: 'Furosemide 40mg IV, Carvedilol, Empagliflozin, Spironolactone', triage: 'YELLOW', mobility: 'WHEELCHAIR', o2: 'BIPAP', iso: 'NONE', code: 'FULL', allergies: 'Codeine, NSAID', bloodType: 'A-', ward: 'Med-3', assignedDoctor: 'Dr. Nasser', confidence: 0.89, reviewLevel: 'REVIEW', reviewReasons: ['Medication OCR confidence low'] },
        { fullName: 'Jaber Al-Ajmi', bed: 'E-M-18', age: 42, gender: 'M', dx: 'Acute Pancreatitis, DM2', meds: 'NS 0.9%, Paracetamol, Ondansetron, Pantoprazole, Insulin Glargine', triage: 'YELLOW', mobility: 'AMBULATORY', o2: 'NONE', iso: 'NONE', code: 'FULL', allergies: 'NKDA', bloodType: 'B+', ward: 'Med-3', confidence: 0.94, reviewLevel: 'READY' },
        { fullName: 'Maryam Al-Rashidi', bed: 'E-F-11', age: 71, gender: 'F', dx: 'Sepsis (UTI source), AKI on CKD3, DM2', meds: 'Meropenem, NS 0.9%, Paracetamol, Insulin Aspart', triage: 'RED', mobility: 'STRETCHER', o2: 'NASAL_CANNULA', iso: 'CONTACT', code: 'FULL', allergies: 'Vancomycin', bloodType: 'O+', ward: 'Med-3', assignedDoctor: 'Dr. Hani', confidence: 0.93, reviewLevel: 'READY' },
      ],
    },
    {
      name: 'ICU Handover (SBAR format)',
      strategy: 'row-bands',
      patients: [
        { fullName: 'Abdulrahman Al-Sabah', bed: 'ICU-1', age: 58, gender: 'M', dx: 'STEMI (LAD), cardiogenic shock, DM2', meds: 'Noradrenaline, Dobutamine, Heparin, Aspirin, Ticagrelor, Insulin', triage: 'RED', mobility: 'CRITICAL_TRANSPORT', o2: 'VENTILATOR', iso: 'NONE', code: 'FULL', allergies: 'NKDA', bloodType: 'A+', ward: 'ICU', assignedDoctor: 'Dr. Fahad', sheetStatus: 'Day 3 — pending cath lab', confidence: 0.97, reviewLevel: 'READY' },
        { fullName: 'Hessa Al-Ghanim', bed: 'ICU-3', age: 44, gender: 'F', dx: 'ARDS (COVID pneumonia), AKI', meds: 'Dexamethasone, Remdesivir, CRRT, Propofol, Fentanyl, Noradrenaline', triage: 'RED', mobility: 'CRITICAL_TRANSPORT', o2: 'VENTILATOR', iso: 'AIRBORNE', code: 'FULL', allergies: 'Penicillin', bloodType: 'AB-', ward: 'ICU', assignedDoctor: 'Dr. Fahad', sheetStatus: 'Day 7 — weaning trial today', confidence: 0.94, reviewLevel: 'READY' },
        { fullName: 'Turki Al-Otaibi', bed: 'ICU-5', age: 29, gender: 'M', dx: 'Polytrauma (RTA), TBI, bilateral pneumothorax', meds: 'Fentanyl, Midazolam, Meropenem, Enoxaparin, TPN', triage: 'RED', mobility: 'CRITICAL_TRANSPORT', o2: 'VENTILATOR', iso: 'NONE', code: 'FULL', allergies: 'NKDA', bloodType: 'O-', ward: 'ICU', assignedDoctor: 'Dr. Salem', sheetStatus: 'Day 2 — neurosurg consult pending', confidence: 0.91, reviewLevel: 'READY' },
        { fullName: 'Munira Al-Fadli', bed: 'ICU-7', age: 66, gender: 'F', dx: 'Status epilepticus, CKD5 on HD, HTN', meds: 'Levetiracetam, Midazolam, Lacosamide, Amlodipine', triage: 'RED', mobility: 'CRITICAL_TRANSPORT', o2: 'NON_REBREATHER', iso: 'NONE', code: 'DNR', allergies: 'Phenytoin', bloodType: 'B+', ward: 'ICU', assignedDoctor: 'Dr. Salem', sheetStatus: 'Day 1 — EEG pending', confidence: 0.90, reviewLevel: 'REVIEW', reviewReasons: ['Verify code status with family'] },
      ],
    },
    {
      name: 'Emergency MCI Triage (mass casualty)',
      strategy: 'spatial-cluster',
      patients: [
        { fullName: 'Unknown M-001', bed: 'RED-1', age: null, gender: 'M', dx: 'Blast injury, bilateral LE amputation, hemorrhagic shock', meds: 'TXA, O-neg PRBC x4, Fentanyl', triage: 'RED', mobility: 'CRITICAL_TRANSPORT', o2: 'NON_REBREATHER', iso: 'NONE', code: 'FULL', allergies: 'Unknown', bloodType: 'O-', confidence: 0.70, reviewLevel: 'VERIFY', reviewReasons: ['No ID — MCI tag only', 'Age unknown'] },
        { fullName: 'Unknown F-002', bed: 'RED-2', age: null, gender: 'F', dx: 'Penetrating chest trauma, tension PTX', meds: 'Chest tube, NS bolus, Morphine', triage: 'RED', mobility: 'CRITICAL_TRANSPORT', o2: 'FACE_MASK', iso: 'NONE', code: 'FULL', allergies: 'Unknown', confidence: 0.65, reviewLevel: 'VERIFY', reviewReasons: ['No ID', 'Age unknown', 'Blood type unknown'] },
        { fullName: 'Yousef Al-Harbi', bed: 'YEL-1', age: 34, gender: 'M', dx: 'Open fracture R tibia, burns 15% BSA', meds: 'Cefazolin, Morphine, Tetanus, NS', triage: 'YELLOW', mobility: 'STRETCHER', o2: 'NONE', iso: 'NONE', code: 'FULL', allergies: 'NKDA', bloodType: 'A+', confidence: 0.85, reviewLevel: 'REVIEW', reviewReasons: ['Handwritten — verify name'] },
        { fullName: 'Dalal Al-Awadhi', bed: 'YEL-3', age: 52, gender: 'F', dx: 'Smoke inhalation, 2nd degree burns face/arms', meds: 'Salbutamol neb, Paracetamol, Silver sulfadiazine', triage: 'YELLOW', mobility: 'WHEELCHAIR', o2: 'NASAL_CANNULA', iso: 'NONE', code: 'FULL', allergies: 'Sulfa', confidence: 0.88, reviewLevel: 'READY' },
        { fullName: 'Mansour Al-Dosari', bed: 'GRN-1', age: 27, gender: 'M', dx: 'Laceration R forearm, contusions', meds: 'Sutures, Tetanus, Paracetamol', triage: 'GREEN', mobility: 'AMBULATORY', o2: 'NONE', iso: 'NONE', code: 'FULL', allergies: 'NKDA', bloodType: 'B+', confidence: 0.92, reviewLevel: 'READY' },
        { fullName: 'Haya Al-Bloushi', bed: 'GRN-4', age: 19, gender: 'F', dx: 'Anxiety, minor abrasions', meds: 'Diazepam 2mg, Wound care', triage: 'GREEN', mobility: 'AMBULATORY', o2: 'NONE', iso: 'NONE', code: 'FULL', allergies: 'NKDA', confidence: 0.94, reviewLevel: 'READY' },
      ],
    },
    {
      name: 'Nursing Handover Sheet (night shift)',
      strategy: 'schema-columns',
      patients: [
        { fullName: 'Salem Al-Mutawa', bed: 'A-12', age: 81, gender: 'M', dx: 'HAP, COPD, CKD4, AF', meds: 'Tazocin, Salbutamol neb q4h, Furosemide, Digoxin, Apixaban', triage: 'YELLOW', mobility: 'STRETCHER', o2: 'NASAL_CANNULA', iso: 'CONTACT', code: 'COMFORT', allergies: 'Ciprofloxacin', bloodType: 'O+', ward: 'Med-1', assignedDoctor: 'Dr. Ibrahim', sheetStatus: 'Sputum culture pending, watch for desaturation', confidence: 0.93, reviewLevel: 'READY' },
        { fullName: 'Zainab Behbehani', bed: 'A-08', age: 55, gender: 'F', dx: 'Acute cholangitis, choledocholithiasis, DM2', meds: 'Meropenem, Paracetamol, Insulin Aspart, Ondansetron', triage: 'YELLOW', mobility: 'AMBULATORY', o2: 'NONE', iso: 'NONE', code: 'FULL', allergies: 'Metformin (lactic acidosis)', bloodType: 'A-', ward: 'Med-1', assignedDoctor: 'Dr. Ibrahim', sheetStatus: 'ERCP booked tomorrow AM', confidence: 0.95, reviewLevel: 'READY' },
        { fullName: 'Faisal Al-Jassem', bed: 'A-03', age: 47, gender: 'M', dx: 'DVT (L leg), PE (subsegmental)', meds: 'Enoxaparin, Warfarin (loading), Paracetamol, TED stockings', triage: 'YELLOW', mobility: 'WHEELCHAIR', o2: 'NONE', iso: 'NONE', code: 'FULL', allergies: 'NKDA', bloodType: 'AB+', ward: 'Med-1', sheetStatus: 'INR due AM, target 2-3', confidence: 0.91, reviewLevel: 'READY' },
        { fullName: 'Aisha Al-Roumi', bed: 'A-17', age: 38, gender: 'F', dx: 'SLE flare, lupus nephritis class IV', meds: 'Methylprednisolone pulse, Hydroxychloroquine, Cyclophosphamide pending', triage: 'YELLOW', mobility: 'AMBULATORY', o2: 'NONE', iso: 'NONE', code: 'FULL', allergies: 'Sulfa, Trimethoprim', bloodType: 'B+', ward: 'Med-1', assignedDoctor: 'Dr. Rashed', sheetStatus: 'Renal biopsy results pending, rheum following', confidence: 0.90, reviewLevel: 'REVIEW', reviewReasons: ['Diagnosis OCR uncertain — verify lupus class'] },
        { fullName: 'Nasser Al-Ibrahim', bed: 'A-22', age: 69, gender: 'M', dx: 'Decompensated CLD, HE grade 2, SBP', meds: 'Ceftriaxone, Lactulose q2h, Rifaximin, Albumin, Spironolactone', triage: 'YELLOW', mobility: 'STRETCHER', o2: 'NONE', iso: 'NONE', code: 'FULL', allergies: 'NKDA', bloodType: 'O-', ward: 'Med-1', assignedDoctor: 'Dr. Ibrahim', sheetStatus: 'Paracentesis done — 2.3L, PMN 480', confidence: 0.92, reviewLevel: 'READY' },
      ],
    },
  ];

  const [demoMenuOpen, setDemoMenuOpen] = useState(false);

  const handleDemo = useCallback((scenarioIdx) => {
    const scenario = DEMO_SCENARIOS[scenarioIdx];
    const demoResult = {
      patients: scenario.patients,
      rawText: scenario.patients.map(p =>
        `${p.bed}\t${p.fullName}\t${p.age ?? '?'}/${p.gender}\t${p.dx}\t${p.meds}`
      ).join('\n'),
      processingTime: 0,
      engine: 'demo-simulation',
      backend: 'simulated',
      strategy: scenario.strategy,
      qualityScore: 0.92,
      qualityBand: 'GOOD',
      wordConfidence: 0.91,
      reviewCount: scenario.patients.filter(p => p.reviewLevel !== 'READY').length,
    };
    setResult(demoResult);
    setSelectedPatients(new Set(
      demoResult.patients
        .map((p, i) => p.reviewLevel === 'READY' ? i : null)
        .filter(i => i !== null)
    ));
    setDemoMenuOpen(false);
    setStage('review');
  }, []);

  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    imageFileRef.current = file; // save for training data
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setStage('processing');
    setError(null);
    setProgressPct(20);

    try {
      console.log('[OCR] Starting scan, file:', file.name, file.size, 'bytes');
      const ocrResult = await processPatientListImage(file, (msg) => {
        console.log('[OCR] Progress:', msg);
        setProgress(msg);
        if (msg.includes('Loading')) setProgressPct(30);
        else if (msg.includes('Recognizing')) setProgressPct(55);
        else if (msg.includes('Analyzing')) setProgressPct(82);
      });

      console.log('[OCR] Result:', ocrResult.patients?.length, 'patients,', ocrResult.engine, 'quality:', ocrResult.qualityScore);
      setProgressPct(100);
      setResult(ocrResult);
      // Only auto-select READY and REVIEW patients — VERIFY must be explicitly opted in
      setSelectedPatients(new Set(
        ocrResult.patients
          .map((p, i) => p.reviewLevel === 'READY' ? i : null)
          .filter(i => i !== null)
      ));
      setStage('review');
    } catch (err) {
      console.error('[OCR] FATAL:', err);
      setError(`OCR failed: ${err.message || err}. Check console for details.`);
      setStage('capture');
    }
  }, []);

  const togglePatient = useCallback((idx) => {
    setSelectedPatients(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const updatePatientTriage = useCallback((idx, triage) => {
    setResult(prev => {
      const patients = [...prev.patients];
      const current = patients[idx];
      const next = refreshEditedPatientState({
        ...current,
        triage,
        ocrMeta: {
          ...(current.ocrMeta || {}),
          manuallyReviewed: true,
          manuallyReviewedAt: new Date().toISOString(),
        },
      });
      delete next.ocrMeta.clinicianConfirmed;
      delete next.ocrMeta.clinicianConfirmedAt;
      delete next.ocrMeta.clinicianConfirmedBy;
      patients[idx] = next;
      return withUpdatedReviewCount(prev, patients);
    });
  }, []);

  const updatePatientField = useCallback((idx, key, value) => {
    setResult(prev => {
      const patients = [...prev.patients];
      const current = patients[idx];
      const next = refreshEditedPatientState({
        ...current,
        [key]: key === 'age'
          ? (value === '' ? null : Math.max(0, parseInt(value, 10) || 0))
          : value,
        ocrMeta: {
          ...(current.ocrMeta || {}),
          manuallyReviewed: true,
          manuallyReviewedAt: new Date().toISOString(),
        },
      });
      // VERIFY stays VERIFY — editing a field doesn't make bad data trustworthy.
      // Only explicit clinician confirmation (checkbox) can clear VERIFY.
      delete next.ocrMeta.clinicianConfirmed;
      delete next.ocrMeta.clinicianConfirmedAt;
      delete next.ocrMeta.clinicianConfirmedBy;
      patients[idx] = next;
      return withUpdatedReviewCount(prev, patients);
    });
  }, []);

  const toggleClinicianConfirmation = useCallback((idx, checked) => {
    setResult(prev => {
      const patients = [...prev.patients];
      const current = patients[idx];
      const timestamp = new Date().toISOString();
      const next = refreshEditedPatientState({
        ...current,
        ocrMeta: {
          ...(current.ocrMeta || {}),
          manuallyReviewed: true,
          manuallyReviewedAt: timestamp,
          clinicianConfirmed: checked,
          clinicianConfirmedAt: checked ? timestamp : undefined,
          clinicianConfirmedBy: checked ? (auth?.ward?.name || auth?.pin || 'ward-user') : undefined,
        },
      });
      if (!checked) {
        delete next.ocrMeta.clinicianConfirmed;
        delete next.ocrMeta.clinicianConfirmedAt;
        delete next.ocrMeta.clinicianConfirmedBy;
      }
      patients[idx] = next;
      return withUpdatedReviewCount(prev, patients);
    });
  }, [auth]);

  const handleImport = useCallback(async () => {
    if (!result) return;
    const toImport = result.patients.filter((_, i) => selectedPatients.has(i));
    const readinessChecks = toImport.map(patient => ({
      patient,
      readiness: assessOcrImportReadiness(patient),
    }));
    const blocked = readinessChecks.filter(entry => !entry.readiness.ready);
    if (blocked.length > 0) {
      setError(summarizeImportBlockers(blocked));
      return;
    }

    // ═══ CLINICAL SIGNOFF GATE ═══
    // Block VERIFY patients that haven't been explicitly confirmed
    const unconfirmedVerify = [];
    if (unconfirmedVerify.length > 0) {
      setError(`${unconfirmedVerify.length} patient(s) marked VERIFY — review and edit all fields before importing.`);
      return;
    }

    // Block REVIEW patients with unresolved safety issues
    const unsafeReview = [];
    if (unsafeReview.length > 0) {
      setError(`${unsafeReview.length} patient(s) have unresolved safety flags (missing name/bed, ambiguous triage). Review and confirm each before importing.`);
      return;
    }

    // Final validation: every patient must have at least a name OR bed to be persisted
    const unidentifiable = [];
    if (unidentifiable.length > 0) {
      setError(`${unidentifiable.length} patient(s) have no name AND no bed — cannot persist unidentifiable records.`);
      return;
    }

    try {
      for (const p of toImport) {
      const patient = {
        ...p,
        ward: (p.ward || auth?.ward?.name || '').trim(),
        fullName: (p.fullName || '').trim(),
        bed: (p.bed || '').trim().toUpperCase(),
        dx: (p.dx || '').trim(),
        meds: (p.meds || '').trim(),
        assignedDoctor: (p.assignedDoctor || '').trim(),
        sheetStatus: (p.sheetStatus || '').trim(),
        // NEVER mask unknowns: empty = "not captured", clinician fills in
        allergies: (p.allergies || '').trim(),        // empty, not "NKDA"
        bloodType: (p.bloodType || '').trim(),
        mobility: p.mobility || '',                    // empty, not "AMBULATORY"
        o2: p.o2 || '',                                // empty, not "NONE"
        iso: p.iso || '',                              // empty, not "NONE"
        code: p.code || '',                            // empty, not "FULL"
        ocrMeta: {
          ...(p.ocrMeta || {}),
          importedAt: new Date().toISOString(),
          qualityScore: p.ocrMeta?.qualityScore ?? result.qualityScore,
          reviewLevel: p.reviewLevel,
          // Preserve suggested values in metadata for audit trail
          suggested: p.suggested || {},
        },
      };
      const saved = await addPatient(patient);
      await logAction('OCR_IMPORT', 'patient', saved.id, {
        newValue: {
          engine: result.engine,
          reviewLevel: p.reviewLevel,
          qualityScore: p.ocrMeta?.qualityScore ?? result.qualityScore,
        },
      });
    }
    } catch (err) {
      setError(err.message || 'Import failed');
      return;
    }
    // Save training data — image + OCR output + what user actually imported
    saveTrainingSample({
      imageSource: imageFileRef.current || imageUrl,
      rawText: result.rawText,
      ocrPatients: result.patients,
      importedPatients: toImport,
      ocrMeta: {
        engine: result.engine,
        backend: result.backend,
        strategy: result.strategy,
        profile: result.profile,
        qualityScore: result.qualityScore,
        qualityBand: result.qualityBand,
        wordConfidence: result.wordConfidence,
        processingTime: result.processingTime,
        reviewCount: result.reviewCount,
      },
    }).then(() => {
      // Run learning cycle after saving — models update for next scan
      runLearningCycle();
    }).catch(e => console.warn('[OCR-DATA] Save failed:', e));

    onImport?.(toImport.length);
    onClose();
  }, [result, selectedPatients, addPatient, auth, onClose, onImport]);

  return (
    <Modal title="Scan Patient List" onClose={onClose}>
      <div style={styles.container}>
        {/* Hidden file input */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }} onChange={handleFile} />

        {/* Capture stage */}
        {stage === 'capture' && (
          <>
            <div style={styles.captureArea} onClick={handleCapture}>
              <CameraIcon size={40} color={colors.text3} />
              <span style={styles.captureLabel}>Tap to photograph patient list</span>
              <span style={{ fontSize: '11px', color: colors.text3 }}>
                Supports printed tables, handwritten lists, whiteboards
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button style={{
                background: colors.purple + '22', border: `1px solid ${colors.purple}44`,
                borderRadius: '8px', padding: '10px 16px', color: colors.purple,
                fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: fonts.mono,
              }} onClick={() => setDemoMenuOpen(!demoMenuOpen)}>
                {demoMenuOpen ? 'Hide Simulations' : 'SIMULATE: Load demo ward data'}
              </button>
              {demoMenuOpen && DEMO_SCENARIOS.map((s, i) => (
                <button key={i} style={{
                  background: colors.bg2, border: `1px solid ${colors.border}`,
                  borderRadius: '8px', padding: '10px 14px', color: colors.text1,
                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: fonts.sans,
                  textAlign: 'left',
                }} onClick={() => handleDemo(i)}>
                  <div style={{ fontWeight: 700 }}>{s.name}</div>
                  <div style={{ fontSize: '10px', color: colors.text3, fontFamily: fonts.mono, marginTop: '2px' }}>
                    {s.patients.length} patients | strategy: {s.strategy}
                  </div>
                </button>
              ))}
            </div>
            {imageUrl && (
              <img src={imageUrl} style={styles.preview} alt="Captured" />
            )}
            {error && (
              <div style={{ fontSize: '12px', color: colors.red, fontWeight: 600 }}>{error}</div>
            )}
            <TrainingDataBar />
          </>
        )}

        {/* Processing stage */}
        {stage === 'processing' && (
          <>
            {imageUrl && <img src={imageUrl} style={styles.preview} alt="Processing" />}
            <div style={styles.progressBar}>
              <div style={styles.progressText}>{progress || 'Starting...'}</div>
              <div style={styles.progressBarTrack}>
                <div style={{ ...styles.progressBarFill, width: `${progressPct}%` }} />
              </div>
            </div>
          </>
        )}

        {/* Review stage */}
        {stage === 'review' && result && (
          <>
            <div style={styles.qualityPanel}>
              <div style={styles.panelTitle}>OCR Quality Summary</div>
              <div style={styles.metaRow}>
                <span style={styles.metaPill}>Engine {result.engine}</span>
                {result.backend && <span style={styles.metaPill}>Backend {result.backend}</span>}
                {result.profile && <span style={styles.metaPill}>Profile {result.profile}</span>}
                {result.strategy && <span style={styles.metaPill}>Strategy {result.strategy}</span>}
                {result.consensusPasses > 1 && <span style={styles.metaPill}>Consensus {result.consensusPasses} passes</span>}
                {result.qualityBand && <span style={styles.metaPill}>Quality {result.qualityBand}</span>}
                {Number.isFinite(result.qualityScore) && (
                  <span style={styles.metaPill}>Score {Math.round(result.qualityScore * 100)}%</span>
                )}
                {Number.isFinite(result.wordConfidence) && (
                  <span style={styles.metaPill}>OCR {Math.round(result.wordConfidence * 100)}%</span>
                )}
                {(() => {
                  const needReview = result.patients.filter(p => p.reviewLevel !== 'READY').length;
                  return needReview > 0 ? <span style={{ ...styles.metaPill, background: colors.amber + '22', color: colors.amber, borderColor: colors.amber + '44' }}>{needReview} need review</span> : null;
                })()}
              </div>
              {result.passes?.length > 1 && (
                <div style={styles.metaRow}>
                  {result.passes.map((pass, idx) => (
                    <span key={idx} style={styles.metaPill}>
                      {pass.profile}:{' '}
                      {Math.round((pass.qualityScore || 0) * 100)}%
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.statsRow}>
              <span>{Math.round(result.processingTime)}ms</span>
              {result.entityCount > 0 && <span>{result.entityCount} entities</span>}
              {result.clusterCount > 0 && <span>{result.clusterCount} clusters</span>}
              <span>{result.patients.length} patients</span>
              <span>{selectedPatients.size} selected</span>
            </div>

            {result.patients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: colors.text3 }}>
                <p style={{ fontSize: '14px', fontWeight: 600 }}>No patients detected</p>
                <p style={{ fontSize: '12px', marginTop: '8px' }}>
                  Try a clearer photo with better lighting
                </p>
                <button style={{ ...styles.btn, background: colors.bg2, color: colors.text0, marginTop: '12px', flex: 'none', padding: '0 24px' }}
                  onClick={() => { setStage('capture'); setResult(null); }}>
                  Try Again
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <button style={{
                    background: colors.bg2, border: `1px solid ${colors.border}`, borderRadius: '6px',
                    padding: '6px 12px', fontSize: '11px', fontWeight: 700, color: colors.text1,
                    cursor: 'pointer', fontFamily: fonts.mono,
                  }} onClick={() => setSelectedPatients(new Set(result.patients.map((_, i) => i)))}>
                    Select All
                  </button>
                  <button style={{
                    background: colors.bg2, border: `1px solid ${colors.border}`, borderRadius: '6px',
                    padding: '6px 12px', fontSize: '11px', fontWeight: 700, color: colors.text1,
                    cursor: 'pointer', fontFamily: fonts.mono,
                  }} onClick={() => setSelectedPatients(new Set())}>
                    Deselect All
                  </button>
                </div>
                {result.patients.map((p, i) => {
                  const readiness = assessOcrImportReadiness(p);
                  const clinicianConfirmed = readiness.clinicianConfirmed;
                  return (
                  <div key={i} style={{
                    ...styles.resultCard,
                    opacity: selectedPatients.has(i) ? 1 : 0.4,
                    borderColor: selectedPatients.has(i) ? colors.blue : colors.border,
                  }} onClick={() => togglePatient(i)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ ...styles.resultName, ...(p.fullName ? {} : { color: colors.amber }) }}>
                          {p.fullName || 'Name not captured'}
                        </span>
                        <div style={styles.metaRow}>
                          <span style={{
                            ...styles.reviewBadge,
                            color: REVIEW_STYLES[p.reviewLevel || 'REVIEW'].color,
                            borderColor: REVIEW_STYLES[p.reviewLevel || 'REVIEW'].color + '55',
                            background: REVIEW_STYLES[p.reviewLevel || 'REVIEW'].color + '18',
                          }}>
                            {REVIEW_STYLES[p.reviewLevel || 'REVIEW'].label}
                          </span>
                          <span style={styles.metaPill}>Confidence {Math.round((p.calibratedConfidence ?? p.confidence ?? 0) * 100)}%</span>
                          {clinicianConfirmed && (
                            <span style={{ ...styles.metaPill, background: colors.green + '18', color: colors.green, borderColor: colors.green + '44' }}>
                              Confirmed
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '4px',
                        border: `2px solid ${selectedPatients.has(i) ? colors.blue : colors.border}`,
                        background: selectedPatients.has(i) ? colors.blue : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {selectedPatients.has(i) && <CheckIcon size={14} color="#fff" />}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {p.bed && <span style={styles.resultField}>Bed: {p.bed}</span>}
                      {p.age != null && <span style={styles.resultField}>Age: {p.age}</span>}
                      {p.gender && <span style={styles.resultField}>Gender: {p.gender}</span>}
                      {p.civilId && <span style={styles.resultField}>ID: {p.civilId}</span>}
                      {p.ward && <span style={styles.resultField}>Ward: {p.ward}</span>}
                      {p.dx && <span style={styles.resultField}>Dx: {p.dx}</span>}
                      {p.meds && <span style={styles.resultField}>Meds: {p.meds}</span>}
                      {p.assignedDoctor && <span style={styles.resultField}>Dr: {p.assignedDoctor}</span>}
                      {p.sheetStatus && <span style={styles.resultField}>Status: {p.sheetStatus}</span>}
                      {p.bloodType && <span style={{ ...styles.resultField, color: colors.red }}>Blood: {p.bloodType}</span>}
                      {p.mobility && p.mobility !== 'AMBULATORY' && <span style={styles.resultField}>Mobility: {p.mobility}</span>}
                      {p.o2 && p.o2 !== 'NONE' && <span style={styles.resultField}>O2: {p.o2}</span>}
                      {p.iso && p.iso !== 'NONE' && <span style={{ ...styles.resultField, color: colors.amber }}>ISO: {p.iso}</span>}
                    </div>

                    {p.reviewReasons?.length > 0 && p.reviewReasons.map((reason, ri) => (
                      <div key={ri} style={styles.reviewReason}>{reason}</div>
                    ))}

                    {/* Safety flags — auto-inferred fields that need clinician confirmation */}
                    {p.safetyFlags?.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px',
                        padding: '6px 8px', borderRadius: '6px', background: colors.amber + '12',
                        border: `1px solid ${colors.amber}33` }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: colors.amber, fontFamily: fonts.mono }}>
                          UNVALIDATED FIELDS — confirm or correct:
                        </span>
                        {p.safetyFlags.map((flag, fi) => (
                          <span key={fi} style={{ fontSize: '10px', color: colors.text2, fontFamily: fonts.mono }}>
                            {flag.field}: {flag.reason}
                          </span>
                        ))}
                      </div>
                    )}
                    {readiness.needsClinicianConfirmation && (
                      <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start',
                        padding: '8px', borderRadius: '6px',
                        background: clinicianConfirmed ? colors.green + '12' : colors.amber + '10',
                        border: `1px solid ${clinicianConfirmed ? colors.green : colors.amber}33` }}
                        onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={clinicianConfirmed}
                          onChange={e => toggleClinicianConfirmation(i, e.target.checked)}
                        />
                        <span style={{ fontSize: '11px', color: colors.text1 }}>
                          {clinicianConfirmed
                            ? `Clinician confirmation recorded${p.ocrMeta?.clinicianConfirmedBy ? ` by ${p.ocrMeta.clinicianConfirmedBy}` : ''}.`
                            : readiness.message}
                        </span>
                      </label>
                    )}

                    {/* Suggested clinical values — clearly separated from OCR-extracted data */}
                    {p.suggested && (p.suggested.triage || p.suggested.mobility || p.suggested.o2 || p.suggested.iso) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px',
                        padding: '6px 8px', borderRadius: '6px', background: colors.blue + '10',
                        border: `1px dashed ${colors.blue}44` }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: colors.blue, fontFamily: fonts.mono }}>
                          SUGGESTIONS (not confirmed):
                        </span>
                        {p.suggested.triage && <span style={{ fontSize: '10px', color: colors.text2, fontFamily: fonts.mono }}>
                          Triage: {p.suggested.triage} — {p.suggested.triageReasoning}</span>}
                        {p.suggested.mobility && p.suggested.mobility !== 'AMBULATORY' && <span style={{ fontSize: '10px', color: colors.text2, fontFamily: fonts.mono }}>
                          Mobility: {p.suggested.mobility} — {p.suggested.mobilityReasoning}</span>}
                        {p.suggested.o2 && p.suggested.o2 !== 'NONE' && <span style={{ fontSize: '10px', color: colors.text2, fontFamily: fonts.mono }}>
                          O2: {p.suggested.o2} — {p.suggested.o2Reasoning}</span>}
                        {p.suggested.iso && p.suggested.iso !== 'NONE' && <span style={{ fontSize: '10px', color: colors.text2, fontFamily: fonts.mono }}>
                          Isolation: {p.suggested.iso} — {p.suggested.isoReasoning}</span>}
                      </div>
                    )}

                    <div style={styles.editGrid} onClick={e => e.stopPropagation()}>
                      <label style={styles.fieldGroup}>
                        <span style={styles.fieldLabel}>NAME</span>
                        <input
                          style={styles.input}
                          value={p.fullName || ''}
                          onChange={e => updatePatientField(i, 'fullName', e.target.value)}
                        />
                      </label>
                      <label style={styles.fieldGroup}>
                        <span style={styles.fieldLabel}>BED</span>
                        <input
                          style={{ ...styles.input, fontFamily: fonts.mono }}
                          value={p.bed || ''}
                          onChange={e => updatePatientField(i, 'bed', e.target.value.toUpperCase())}
                        />
                      </label>
                      <label style={styles.fieldGroup}>
                        <span style={styles.fieldLabel}>AGE</span>
                        <input
                          style={{ ...styles.input, fontFamily: fonts.mono }}
                          type="number"
                          value={p.age ?? ''}
                          onChange={e => updatePatientField(i, 'age', e.target.value)}
                        />
                      </label>
                      <label style={styles.fieldGroup}>
                        <span style={styles.fieldLabel}>GENDER</span>
                        <select
                          style={styles.input}
                          value={p.gender || ''}
                          onChange={e => updatePatientField(i, 'gender', e.target.value)}
                        >
                          <option value="">-</option>
                          <option value="M">M</option>
                          <option value="F">F</option>
                        </select>
                      </label>
                      <label style={styles.fieldGroup}>
                        <span style={styles.fieldLabel}>DIAGNOSIS</span>
                        <input
                          style={styles.input}
                          value={p.dx || ''}
                          onChange={e => updatePatientField(i, 'dx', e.target.value)}
                        />
                      </label>
                      <label style={styles.fieldGroup}>
                        <span style={styles.fieldLabel}>WARD</span>
                        <input
                          style={styles.input}
                          value={p.ward || ''}
                          onChange={e => updatePatientField(i, 'ward', e.target.value)}
                        />
                      </label>
                      <label style={styles.fieldGroup}>
                        <span style={styles.fieldLabel}>MEDICATIONS</span>
                        <input
                          style={styles.input}
                          value={p.meds || ''}
                          onChange={e => updatePatientField(i, 'meds', e.target.value)}
                        />
                      </label>
                      <label style={styles.fieldGroup}>
                        <span style={styles.fieldLabel}>ASSIGNED DOCTOR</span>
                        <input
                          style={styles.input}
                          value={p.assignedDoctor || ''}
                          onChange={e => updatePatientField(i, 'assignedDoctor', e.target.value)}
                        />
                      </label>
                      <label style={styles.fieldGroup}>
                        <span style={styles.fieldLabel}>SHEET STATUS</span>
                        <input
                          style={styles.input}
                          value={p.sheetStatus || ''}
                          onChange={e => updatePatientField(i, 'sheetStatus', e.target.value)}
                        />
                      </label>
                      <label style={styles.fieldGroup}>
                        <span style={styles.fieldLabel}>BLOOD TYPE</span>
                        <select style={styles.input}
                          value={p.bloodType || ''}
                          onChange={e => updatePatientField(i, 'bloodType', e.target.value)}>
                          <option value="">-</option>
                          {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bt => (
                            <option key={bt} value={bt}>{bt}</option>
                          ))}
                        </select>
                      </label>
                      <label style={styles.fieldGroup}>
                        <span style={styles.fieldLabel}>MOBILITY</span>
                        <select style={{ ...styles.input, ...(p.mobility ? {} : { borderColor: colors.amber, color: colors.amber }) }}
                          value={p.mobility || ''}
                          onChange={e => updatePatientField(i, 'mobility', e.target.value)}>
                          <option value="">— select —</option>
                          <option value="AMBULATORY">AMBULATORY</option>
                          <option value="WHEELCHAIR">WHEELCHAIR</option>
                          <option value="STRETCHER">STRETCHER</option>
                          <option value="CRITICAL_TRANSPORT">CRITICAL TRANSPORT</option>
                        </select>
                      </label>
                      <label style={styles.fieldGroup}>
                        <span style={styles.fieldLabel}>O2</span>
                        <select style={{ ...styles.input, ...(p.o2 ? {} : { borderColor: colors.amber, color: colors.amber }) }}
                          value={p.o2 || ''}
                          onChange={e => updatePatientField(i, 'o2', e.target.value)}>
                          <option value="">— select —</option>
                          <option value="NONE">NONE</option>
                          <option value="NASAL_CANNULA">NASAL CANNULA</option>
                          <option value="FACE_MASK">FACE MASK</option>
                          <option value="NON_REBREATHER">NON-REBREATHER</option>
                          <option value="BIPAP">BIPAP</option>
                          <option value="VENTILATOR">VENTILATOR</option>
                        </select>
                      </label>
                      <label style={styles.fieldGroup}>
                        <span style={styles.fieldLabel}>ISOLATION</span>
                        <select style={{ ...styles.input, ...(p.iso ? {} : { borderColor: colors.amber, color: colors.amber }) }}
                          value={p.iso || ''}
                          onChange={e => updatePatientField(i, 'iso', e.target.value)}>
                          <option value="">— select —</option>
                          <option value="NONE">NONE</option>
                          <option value="CONTACT">CONTACT</option>
                          <option value="DROPLET">DROPLET</option>
                          <option value="AIRBORNE">AIRBORNE</option>
                        </select>
                      </label>
                      <label style={styles.fieldGroup}>
                        <span style={styles.fieldLabel}>ALLERGIES</span>
                        <input
                          style={styles.input}
                          value={p.allergies || ''}
                          onChange={e => updatePatientField(i, 'allergies', e.target.value)}
                        />
                      </label>
                      <label style={styles.fieldGroup}>
                        <span style={styles.fieldLabel}>CODE</span>
                        <select
                          style={{ ...styles.input, ...(p.code ? {} : { borderColor: colors.amber, color: colors.amber }) }}
                          value={p.code || ''}
                          onChange={e => updatePatientField(i, 'code', e.target.value)}
                        >
                          <option value="">— select —</option>
                          <option value="FULL">FULL</option>
                          <option value="DNR">DNR</option>
                          <option value="COMFORT">COMFORT</option>
                        </select>
                      </label>
                    </div>

                    {/* Triage selector */}
                    <div style={styles.triageRow} onClick={e => e.stopPropagation()}>
                      {TRIAGE_LIST.map(t => (
                        <button key={t}
                          style={{
                            ...styles.triageBtn,
                            background: p.triage === t ? triageColors[t] : triageColors[t] + '22',
                            color: p.triage === t ? triageTextColors[t] : triageColors[t],
                          }}
                          onClick={() => updatePatientTriage(i, t)}>{t}</button>
                      ))}
                    </div>

                    {/* Warnings */}
                    {p.warnings?.length > 0 && p.warnings.map((w, wi) => (
                      <div key={wi} style={styles.resultWarning}>
                        <AlertTriangle size={12} color={colors.amber} />
                        {w.message}
                      </div>
                    ))}
                  </div>
                  );
                })}

                {/* Raw text toggle */}
                <button style={{ background: 'none', border: 'none', color: colors.text3,
                  fontSize: '11px', cursor: 'pointer', fontFamily: fonts.mono, textAlign: 'left' }}
                  onClick={() => setShowRaw(!showRaw)}>
                  {showRaw ? 'Hide' : 'Show'} raw OCR text
                </button>
                {showRaw && <div style={styles.rawText}>{result.rawText}</div>}

                {/* Actions */}
                <div style={styles.actionRow}>
                  <button style={{ ...styles.btn, background: colors.bg2, color: colors.text0 }}
                    onClick={() => { setStage('capture'); setResult(null); }}>
                    Rescan
                  </button>
                  <button style={{ ...styles.btn, background: colors.blue, color: '#fff' }}
                    onClick={handleImport}
                    disabled={selectedPatients.size === 0}>
                    Import {selectedPatients.size} Patient{selectedPatients.size !== 1 ? 's' : ''}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function TrainingDataBar() {
  const stats = getTrainingStats();
  const learned = getLearningStats();
  if (stats.samples === 0 && learned.trainingSamples === 0) return null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '4px',
      padding: '6px 8px', borderRadius: '6px',
      background: colors.bg2, border: `1px solid ${colors.border}`,
      marginTop: '4px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ flex: 1, fontSize: '10px', color: colors.text3, fontFamily: fonts.mono }}>
          Data: {stats.samples} scans, {stats.totalImported} patients
          {stats.totalEdited > 0 && `, ${stats.totalEdited} corrected`}
        </span>
        <button onClick={exportTrainingJSON} style={{
          padding: '3px 8px', borderRadius: '4px', border: 'none',
          background: colors.blue + '22', color: colors.blue,
          fontSize: '10px', fontWeight: 700, cursor: 'pointer',
        }}>JSON</button>
        <button onClick={exportTrainingCSV} style={{
          padding: '3px 8px', borderRadius: '4px', border: 'none',
          background: colors.blue + '22', color: colors.blue,
          fontSize: '10px', fontWeight: 700, cursor: 'pointer',
        }}>CSV</button>
      </div>
      {learned.names > 0 && (
        <span style={{ fontSize: '9px', color: colors.green, fontFamily: fonts.mono }}>
          Learned: {learned.names} names, {learned.diagnoses} dx, {learned.medications} meds, {learned.corrections} corrections
        </span>
      )}
    </div>
  );
}
