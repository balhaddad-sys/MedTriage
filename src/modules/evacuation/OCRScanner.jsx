import React, { useState, useRef, useCallback } from 'react';
import { useApp } from '../../app.jsx';
import { colors, fonts, triageColors, triageTextColors } from '../../design/tokens.js';
import Modal from '../../shared/Modal.jsx';
import { CameraIcon, CheckIcon, XIcon, AlertTriangle } from '../../design/icons.jsx';
import { processPatientListImage } from './ocrEngine.js';
import { logAction } from '../../data/audit.js';

const TRIAGE_LIST = ['RED', 'YELLOW', 'GREEN', 'GRAY', 'BLACK'];

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
    display: 'flex', gap: '12px', fontSize: '11px', fontFamily: fonts.mono, color: colors.text3,
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

  const handleCapture = useCallback(() => {
    fileRef.current?.click();
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
        else if (msg.includes('Recognizing')) setProgressPct(50);
        else if (msg.includes('entities') || msg.includes('clustering')) setProgressPct(80);
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

  const handleImport = useCallback(async () => {
    if (!result) return;
    const toImport = result.patients.filter((_, i) => selectedPatients.has(i));
    for (const p of toImport) {
      const patient = {
        ...p,
        ward: auth?.ward?.name || '',
        fullName: p.fullName || 'Unknown',
      };
      await addPatient(patient);
      await logAction('OCR_IMPORT', 'patient', patient.id);
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
            <div style={styles.statsRow}>
              <span>Engine: {result.engine}</span>
              <span>{Math.round(result.processingTime)}ms</span>
              {result.entityCount > 0 && <span>{result.entityCount} entities</span>}
              {result.clusterCount > 0 && <span>{result.clusterCount} clusters</span>}
              <span>{result.patients.length} patients</span>
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
                {result.patients.map((p, i) => (
                  <div key={i} style={{
                    ...styles.resultCard,
                    opacity: selectedPatients.has(i) ? 1 : 0.4,
                    borderColor: selectedPatients.has(i) ? colors.blue : colors.border,
                  }} onClick={() => togglePatient(i)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={styles.resultName}>{p.fullName || 'Unknown'}</span>
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
                      {p.age && <span style={styles.resultField}>Age: {p.age}</span>}
                      {p.gender && <span style={styles.resultField}>Gender: {p.gender}</span>}
                      {p.dx && <span style={styles.resultField}>Dx: {p.dx}</span>}
                      {p.meds && <span style={styles.resultField}>Meds: {p.meds}</span>}
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
