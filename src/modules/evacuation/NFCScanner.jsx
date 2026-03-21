import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../../app.jsx';
import { colors, fonts } from '../../design/tokens.js';
import Modal from '../../shared/Modal.jsx';
import { CheckIcon } from '../../design/icons.jsx';
import { scanNFC, validateCivilId, getNfcPlatformInfo } from './nfcReader.js';
import { logAction } from '../../data/audit.js';

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '4px 0' },
  nfcArea: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '14px', padding: '24px 0', width: '100%',
  },
  nfcRing: {
    width: '100px', height: '100px', borderRadius: '50%',
    border: `3px solid ${colors.blue}`, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  nfcRingScanning: { animation: 'nfcPulse 2s ease-in-out infinite' },
  nfcRingDetected: { borderColor: colors.green, animation: 'none' },
  statusText: { fontSize: '14px', fontWeight: 600, color: colors.text0, textAlign: 'center' },
  subText: { fontSize: '12px', color: colors.text3, textAlign: 'center', lineHeight: 1.4 },
  resultCard: {
    width: '100%', padding: '16px', borderRadius: '12px',
    border: `1px solid ${colors.green}44`, background: colors.green + '11',
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  resultRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  resultLabel: { fontSize: '11px', fontWeight: 700, color: colors.text3, textTransform: 'uppercase' },
  resultValue: { fontSize: '14px', fontWeight: 600, color: colors.text0, fontFamily: fonts.mono },
  manualInput: {
    width: '100%', padding: '14px', borderRadius: '10px',
    border: `1px solid ${colors.border}`, background: colors.bg2,
    color: colors.text0, fontSize: '20px', fontFamily: fonts.mono,
    textAlign: 'center', letterSpacing: '3px', outline: 'none',
  },
  btn: {
    width: '100%', height: '48px', border: 'none', borderRadius: '10px',
    fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: fonts.sans,
  },
  btnSmall: {
    width: '100%', height: '40px', border: 'none', borderRadius: '8px',
    fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: fonts.sans,
  },
  errorBox: {
    width: '100%', padding: '10px', borderRadius: '8px',
    background: colors.red + '15', border: `1px solid ${colors.red}33`,
    fontSize: '12px', color: colors.red, fontWeight: 600,
  },
  successBox: {
    width: '100%', padding: '10px', borderRadius: '8px',
    background: colors.green + '15', border: `1px solid ${colors.green}33`,
    fontSize: '13px', color: colors.green, fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: '8px',
  },
  metaBox: {
    width: '100%', padding: '10px', borderRadius: '8px',
    background: colors.bg2, border: `1px solid ${colors.border}`,
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  metaText: { fontSize: '11px', color: colors.text3, fontFamily: fonts.mono, wordBreak: 'break-word' },
  divider: {
    width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
    margin: '4px 0',
  },
  dividerLine: { flex: 1, height: '1px', background: colors.border },
  dividerText: { fontSize: '11px', fontWeight: 700, color: colors.text3, textTransform: 'uppercase' },
};

export default function NFCScanner({ onClose }) {
  const { addPatient, auth } = useApp();
  const nfcInfo = getNfcPlatformInfo();
  const [scanning, setScanning] = useState(false);
  const [nfcData, setNfcData] = useState(null);
  const [scanMeta, setScanMeta] = useState(null);
  const [error, setError] = useState(null);
  const [civilId, setCivilId] = useState('');
  const [civilIdError, setCivilIdError] = useState('');
  const [cardDetected, setCardDetected] = useState(false);
  const abortRef = useRef(null);

  // Start NFC scan if supported
  const startScan = useCallback(async () => {
    if (!nfcInfo.supported) return;
    setScanning(true);
    setError(null);
    setCardDetected(false);
    setScanMeta(null);

    const abort = await scanNFC(
      (data) => {
        setScanning(false);
        setScanMeta(data);
        if (data.civilId) {
          setNfcData(data);
        } else if (data.tagDetected) {
          setCardDetected(true);
        } else {
          setError('NFC tag detected but could not be classified.');
        }
      },
      (err) => {
        setError(err.message);
        setScanning(false);
      },
      () => {}
    );
    abortRef.current = abort;
  }, [nfcInfo.supported]);

  // Auto-start NFC on mount
  useEffect(() => {
    if (nfcInfo.supported) startScan();
    return () => { abortRef.current?.(); };
  }, []);

  const handleValidate = useCallback(() => {
    setCivilIdError('');
    const result = validateCivilId(civilId);
    if (!result.valid) {
      setCivilIdError(result.error);
      return;
    }
    setNfcData({
      ...(scanMeta || {}),
      civilId: result.civilId,
      age: result.age,
      fullName: scanMeta?.fullName || scanMeta?.fullNameArabic || '',
      gender: scanMeta?.gender || '',
      nfcBackend: scanMeta?.nfcBackend || (cardDetected ? 'webnfc' : 'manual'),
      tagDetected: !!scanMeta?.tagDetected || cardDetected,
      needsManualId: false,
    });
  }, [civilId, cardDetected, scanMeta]);

  const handleAddPatient = useCallback(async () => {
    if (!nfcData) return;
    const patient = {
      civilId: nfcData.civilId || '',
      fullName: nfcData.fullName || nfcData.fullNameArabic || '',
      age: nfcData.age,
      gender: nfcData.gender || 'M',
      triage: 'GREEN',
      mobility: 'AMBULATORY',
      o2: 'NONE',
      iso: 'NONE',
      code: 'FULL',
      allergies: 'NKDA',
      dx: '',
      meds: '',
      notes: nfcData.nationality ? `Nationality: ${nfcData.nationality}` : '',
      ward: auth?.ward?.name || '',
      evac: 'IN_WARD',
      nfcScanned: !!nfcData.tagDetected,
      nfcBackend: nfcData.nfcBackend || 'unknown',
      nfcSerial: nfcData.serialNumber || '',
      nfcTagType: nfcData.tagType || '',
      nfcTechTypes: Array.isArray(nfcData.techTypes) ? nfcData.techTypes : [],
      nfcLikelyCivilId: !!nfcData.likelyCivilId,
    };
    const saved = await addPatient(patient);
    await logAction('NFC_IMPORT', 'patient', saved.id, {
      newValue: {
        nfcBackend: patient.nfcBackend,
        nfcSerial: patient.nfcSerial,
        nfcTagType: patient.nfcTagType,
        nfcLikelyCivilId: patient.nfcLikelyCivilId,
      },
    });
    onClose();
  }, [nfcData, addPatient, auth, onClose]);

  // Already got full data from NFC — show result
  if (nfcData) {
    return (
      <Modal title="Civil ID Scanner" onClose={onClose}>
        <div style={styles.container}>
          <div style={styles.resultCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <CheckIcon size={18} color={colors.green} />
              <span style={{ fontSize: '14px', fontWeight: 700, color: colors.green }}>
                Civil ID Verified
              </span>
            </div>
            {nfcData.civilId && (
              <div style={styles.resultRow}>
                <span style={styles.resultLabel}>Civil ID</span>
                <span style={styles.resultValue}>{nfcData.civilId}</span>
              </div>
            )}
            {nfcData.age != null && (
              <div style={styles.resultRow}>
                <span style={styles.resultLabel}>Age</span>
                <span style={styles.resultValue}>{nfcData.age} years</span>
              </div>
            )}
            {nfcData.fullName && (
              <div style={styles.resultRow}>
                <span style={styles.resultLabel}>Name</span>
                <span style={{ ...styles.resultValue, fontFamily: fonts.sans }}>{nfcData.fullName}</span>
              </div>
            )}
            {nfcData.gender && (
              <div style={styles.resultRow}>
                <span style={styles.resultLabel}>Gender</span>
                <span style={styles.resultValue}>{nfcData.gender === 'M' ? 'Male' : 'Female'}</span>
              </div>
            )}
            {nfcData.serialNumber && (
              <div style={styles.resultRow}>
                <span style={styles.resultLabel}>Tag UID</span>
                <span style={{ ...styles.resultValue, fontSize: '12px' }}>{nfcData.serialNumber}</span>
              </div>
            )}
            {nfcData.tagType && (
              <div style={styles.resultRow}>
                <span style={styles.resultLabel}>Tag Type</span>
                <span style={{ ...styles.resultValue, fontSize: '12px' }}>{nfcData.tagType}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button style={{ ...styles.btn, flex: 1, background: colors.bg2, color: colors.text0 }}
              onClick={() => { setNfcData(null); setCivilId(''); setCardDetected(false); if (nfcInfo.supported) startScan(); }}>
              Start Over
            </button>
            <button style={{ ...styles.btn, flex: 1, background: colors.green, color: '#fff' }}
              onClick={handleAddPatient}>
              Add Patient
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Civil ID Scanner" onClose={onClose}>
      <style>{`
        @keyframes nfcPulse {
          0%, 100% { box-shadow: 0 0 0 0 ${colors.blue}44; }
          50% { box-shadow: 0 0 0 20px ${colors.blue}00; }
        }
      `}</style>

      <div style={styles.container}>
        {/* NFC scanning area — only if supported */}
        {nfcInfo.supported && !cardDetected && (
          <div style={styles.nfcArea}>
            <div style={{ ...styles.nfcRing, ...(scanning ? styles.nfcRingScanning : {}) }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={colors.blue} strokeWidth="1.5">
                <path d="M6 8.32a7.43 7.43 0 010 7.36" />
                <path d="M9.46 6.21a11.76 11.76 0 010 11.58" />
                <path d="M12.91 4.1a16.1 16.1 0 010 15.8" />
                <path d="M16.37 2a20.43 20.43 0 010 20" />
              </svg>
            </div>
            <span style={styles.statusText}>
              {scanning ? 'Tap Civil ID on back of phone...' : 'NFC Ready'}
            </span>
            <span style={styles.subText}>{nfcInfo.hint}</span>
            {error && <div style={styles.errorBox}>{error}</div>}
          </div>
        )}

        {/* Card detected via NFC */}
        {cardDetected && (
          <>
            <div style={styles.successBox}>
              <CheckIcon size={16} color={colors.green} />
              {scanMeta?.likelyCivilId ? 'Kuwait Civil ID tag detected.' : 'NFC tag detected.'} Enter Civil ID below.
            </div>
            <div style={styles.metaBox}>
              <span style={styles.metaText}>Backend: {scanMeta?.nfcBackend || 'unknown'}</span>
              {scanMeta?.tagType && <span style={styles.metaText}>Tag type: {scanMeta.tagType}</span>}
              {scanMeta?.serialNumber && <span style={styles.metaText}>UID: {scanMeta.serialNumber}</span>}
              {scanMeta?.techTypes?.length > 0 && (
                <span style={styles.metaText}>Tech: {scanMeta.techTypes.join(', ')}</span>
              )}
            </div>
          </>
        )}

        {/* Divider */}
        {nfcInfo.supported && !cardDetected && (
          <div style={styles.divider}>
            <div style={styles.dividerLine} />
            <span style={styles.dividerText}>or enter manually</span>
            <div style={styles.dividerLine} />
          </div>
        )}

        {/* Civil ID input — ALWAYS visible */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text0 }}>
            {cardDetected ? 'Enter Civil ID from card' : 'Civil ID Number'}
          </span>
          <input
            style={{
              ...styles.manualInput,
              borderColor: cardDetected ? colors.green + '66' : colors.border,
            }}
            placeholder="281234567890"
            value={civilId}
            onChange={e => { setCivilId(e.target.value.replace(/\D/g, '').slice(0, 12)); setCivilIdError(''); }}
            maxLength={12}
            inputMode="numeric"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: colors.text3, fontFamily: fonts.mono }}>
              {civilId.length}/12 digits
            </span>
            {civilId.length === 12 && !civilIdError && (
              <span style={{ fontSize: '11px', color: colors.green, fontWeight: 600 }}>Ready</span>
            )}
          </div>
          {civilIdError && <div style={styles.errorBox}>{civilIdError}</div>}
          <button
            style={{
              ...styles.btn,
              background: civilId.length === 12 ? colors.green : colors.bg2,
              color: civilId.length === 12 ? '#fff' : colors.text3,
            }}
            onClick={handleValidate}
            disabled={civilId.length !== 12}>
            Validate & Add Patient
          </button>
          {nfcInfo.supported && (
            <button
              style={{ ...styles.btnSmall, background: colors.bg2, color: colors.text0 }}
              onClick={() => {
                abortRef.current?.();
                setNfcData(null);
                setCardDetected(false);
                setScanMeta(null);
                setError(null);
                startScan();
              }}>
              Scan Again
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
