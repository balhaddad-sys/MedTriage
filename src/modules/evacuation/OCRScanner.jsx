import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../../app.jsx';
import { colors, fonts, triageColors, triageTextColors } from '../../design/tokens.js';
import Modal from '../../shared/Modal.jsx';
import { CameraIcon, CheckIcon, AlertTriangle } from '../../design/icons.jsx';
import { processPatientListImage } from './ocrEngine.js';
import { logAction } from '../../data/audit.js';

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

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const handleCapture = useCallback(() => {
    fileRef.current?.click();
  }, []);

  // Demo mode — simulate OCR with realistic ward sheet data for testing
  const handleDemo = useCallback(() => {
    const demoPatients = [
      { fullName: 'Ahmed Al-Mutairi', bed: 'E-M-03', age: 67, gender: 'M', dx: 'NSTEMI, DM2, HTN', meds: 'Aspirin, Ticagrelor, Enoxaparin, Metformin', triage: 'RED', mobility: 'STRETCHER', o2: 'NASAL_CANNULA', iso: 'NONE', code: 'FULL', allergies: 'NKDA', bloodType: 'A+', confidence: 0.95, reviewLevel: 'READY' },
      { fullName: 'Fatima Al-Hajri', bed: 'E-F-07', age: 45, gender: 'F', dx: 'CAP, COPD', meds: 'Ceftriaxone, Azithromycin, Salbutamol', triage: 'YELLOW', mobility: 'WHEELCHAIR', o2: 'FACE_MASK', iso: 'DROPLET', code: 'FULL', allergies: 'Penicillin', bloodType: 'O+', confidence: 0.92, reviewLevel: 'READY' },
      { fullName: 'Khaled Al-Enezi', bed: 'E-M-12', age: 78, gender: 'M', dx: 'CVA, AF, CKD3', meds: 'Apixaban, Amlodipine, Atorvastatin', triage: 'RED', mobility: 'STRETCHER', o2: 'NONE', iso: 'NONE', code: 'DNR', allergies: 'Sulfa', bloodType: 'B-', confidence: 0.88, reviewLevel: 'REVIEW', reviewReasons: ['Low name confidence'] },
      { fullName: 'Sara Al-Dosari', bed: 'E-F-02', age: 32, gender: 'F', dx: 'DKA, T1DM', meds: 'Insulin Aspart, Insulin Glargine, KCl', triage: 'RED', mobility: 'AMBULATORY', o2: 'NONE', iso: 'NONE', code: 'FULL', allergies: 'NKDA', bloodType: 'AB+', confidence: 0.96, reviewLevel: 'READY' },
      { fullName: 'Hamad Al-Shammari', bed: 'E-M-09', age: 55, gender: 'M', dx: 'UGIB, CLD', meds: 'Pantoprazole, Octreotide, Lactulose', triage: 'YELLOW', mobility: 'STRETCHER', o2: 'NONE', iso: 'NONE', code: 'FULL', allergies: 'NKDA', bloodType: 'O-', confidence: 0.91, reviewLevel: 'READY' },
      { fullName: 'Noura Al-Kandari', bed: 'E-F-15', age: 63, gender: 'F', dx: 'ADHF, CKD4, DM2', meds: 'Furosemide, Carvedilol, Empagliflozin', triage: 'YELLOW', mobility: 'WHEELCHAIR', o2: 'BIPAP', iso: 'NONE', code: 'FULL', allergies: 'Codeine', bloodType: 'A-', confidence: 0.89, reviewLevel: 'REVIEW', reviewReasons: ['Medication confidence low'] },
    ];
    const demoResult = {
      patients: demoPatients,
      rawText: demoPatients.map(p => `${p.bed} ${p.fullName} ${p.age}/${p.gender} ${p.dx} ${p.meds}`).join('\n'),
      processingTime: 0,
      engine: 'demo-simulation',
      qualityScore: 0.92,
      qualityBand: 'GOOD',
      wordConfidence: 0.91,
      reviewCount: demoPatients.filter(p => p.reviewLevel !== 'READY').length,
    };
    setResult(demoResult);
    setSelectedPatients(new Set(demoResult.patients.map((_, i) => i)));
    setStage('review');
  }, []);

  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setStage('processing');
    setError(null);
    setProgressPct(20);

    try {
      const ocrResult = await processPatientListImage(file, (msg) => {
        setProgress(msg);
        if (msg.includes('Loading')) setProgressPct(30);
        else if (msg.includes('Recognizing')) setProgressPct(55);
        else if (msg.includes('Analyzing')) setProgressPct(82);
      });

      setProgressPct(100);
      setResult(ocrResult);
      setSelectedPatients(new Set(ocrResult.patients.map((_, i) => i)));
      setStage('review');
    } catch (err) {
      setError(err.message || 'OCR processing failed');
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
      patients[idx] = { ...patients[idx], triage };
      return { ...prev, patients };
    });
  }, []);

  const updatePatientField = useCallback((idx, key, value) => {
    setResult(prev => {
      const patients = [...prev.patients];
      const current = patients[idx];
      const next = {
        ...current,
        [key]: key === 'age'
          ? (value === '' ? null : Math.max(0, parseInt(value, 10) || 0))
          : value,
      };
      next.ocrMeta = { ...(current.ocrMeta || {}), manuallyReviewed: true };
      if (current.reviewLevel === 'VERIFY') next.reviewLevel = 'REVIEW';
      patients[idx] = next;
      return { ...prev, patients };
    });
  }, []);

  const handleImport = useCallback(async () => {
    if (!result) return;
    const toImport = result.patients.filter((_, i) => selectedPatients.has(i));
    for (const p of toImport) {
      const patient = {
        ...p,
        ward: (p.ward || auth?.ward?.name || '').trim(),
        fullName: (p.fullName || 'Unknown').trim(),
        bed: (p.bed || '').trim().toUpperCase(),
        dx: (p.dx || '').trim(),
        meds: (p.meds || '').trim(),
        assignedDoctor: (p.assignedDoctor || '').trim(),
        sheetStatus: (p.sheetStatus || '').trim(),
        allergies: (p.allergies || 'NKDA').trim(),
        bloodType: (p.bloodType || '').trim(),
        mobility: p.mobility || 'AMBULATORY',
        o2: p.o2 || 'NONE',
        iso: p.iso || 'NONE',
        ocrMeta: {
          ...(p.ocrMeta || {}),
          importedAt: new Date().toISOString(),
          qualityScore: p.ocrMeta?.qualityScore ?? result.qualityScore,
          reviewLevel: p.reviewLevel,
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
            <button style={{
              background: colors.purple + '22', border: `1px solid ${colors.purple}44`,
              borderRadius: '8px', padding: '10px 16px', color: colors.purple,
              fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: fonts.mono,
            }} onClick={handleDemo}>
              DEMO: Load sample ward sheet
            </button>
            {imageUrl && (
              <img src={imageUrl} style={styles.preview} alt="Captured" />
            )}
            {error && (
              <div style={{ fontSize: '12px', color: colors.red, fontWeight: 600 }}>{error}</div>
            )}
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
                {result.reviewCount > 0 && <span style={styles.metaPill}>{result.reviewCount} need review</span>}
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
                {result.patients.map((p, i) => (
                  <div key={i} style={{
                    ...styles.resultCard,
                    opacity: selectedPatients.has(i) ? 1 : 0.4,
                    borderColor: selectedPatients.has(i) ? colors.blue : colors.border,
                  }} onClick={() => togglePatient(i)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={styles.resultName}>{p.fullName || 'Unknown'}</span>
                        <div style={styles.metaRow}>
                          <span style={{
                            ...styles.reviewBadge,
                            color: REVIEW_STYLES[p.reviewLevel || 'REVIEW'].color,
                            borderColor: REVIEW_STYLES[p.reviewLevel || 'REVIEW'].color + '55',
                            background: REVIEW_STYLES[p.reviewLevel || 'REVIEW'].color + '18',
                          }}>
                            {REVIEW_STYLES[p.reviewLevel || 'REVIEW'].label}
                          </span>
                          <span style={styles.metaPill}>Confidence {Math.round((p.confidence || 0) * 100)}%</span>
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
                        <select style={styles.input}
                          value={p.mobility || 'AMBULATORY'}
                          onChange={e => updatePatientField(i, 'mobility', e.target.value)}>
                          <option value="AMBULATORY">AMBULATORY</option>
                          <option value="WHEELCHAIR">WHEELCHAIR</option>
                          <option value="STRETCHER">STRETCHER</option>
                          <option value="CRITICAL_TRANSPORT">CRITICAL TRANSPORT</option>
                        </select>
                      </label>
                      <label style={styles.fieldGroup}>
                        <span style={styles.fieldLabel}>O2</span>
                        <select style={styles.input}
                          value={p.o2 || 'NONE'}
                          onChange={e => updatePatientField(i, 'o2', e.target.value)}>
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
                        <select style={styles.input}
                          value={p.iso || 'NONE'}
                          onChange={e => updatePatientField(i, 'iso', e.target.value)}>
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
                          style={styles.input}
                          value={p.code || 'FULL'}
                          onChange={e => updatePatientField(i, 'code', e.target.value)}
                        >
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
                ))}

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
