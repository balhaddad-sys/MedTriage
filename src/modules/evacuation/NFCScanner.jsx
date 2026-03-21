import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../../app.jsx';
import { colors, fonts } from '../../design/tokens.js';
import Modal from '../../shared/Modal.jsx';
import { CheckIcon } from '../../design/icons.jsx';
import { scanNFC, validateCivilId, getNfcPlatformInfo } from './nfcReader.js';
import { logAction } from '../../data/audit.js';

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' },
  nfcArea: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '16px', padding: '32px', width: '100%',
  },
  nfcRing: {
    width: '120px', height: '120px', borderRadius: '50%',
    border: `3px solid ${colors.blue}`, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  nfcRingScanning: {
    animation: 'nfcPulse 2s ease-in-out infinite',
  },
  nfcRingSuccess: {
    borderColor: colors.green,
  },
  statusText: { fontSize: '14px', fontWeight: 600, color: colors.text0, textAlign: 'center' },
  subText: { fontSize: '12px', color: colors.text3, textAlign: 'center' },
  resultCard: {
    width: '100%', padding: '16px', borderRadius: '12px',
    border: `1px solid ${colors.green}44`, background: colors.green + '11',
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  resultRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  resultLabel: { fontSize: '11px', fontWeight: 700, color: colors.text3, textTransform: 'uppercase' },
  resultValue: { fontSize: '14px', fontWeight: 600, color: colors.text0, fontFamily: fonts.mono },
  manualInput: {
    width: '100%', padding: '14px', borderRadius: '10px',
    border: `1px solid ${colors.border}`, background: colors.bg2,
    color: colors.text0, fontSize: '18px', fontFamily: fonts.mono,
    textAlign: 'center', letterSpacing: '2px', outline: 'none',
  },
  btn: {
    width: '100%', height: '48px', border: 'none', borderRadius: '10px',
    fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: fonts.sans,
  },
  tabRow: { display: 'flex', gap: '4px', width: '100%' },
  tab: {
    flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
    fontSize: '12px', fontWeight: 700, cursor: 'pointer',
    fontFamily: fonts.sans, textAlign: 'center',
  },
  errorBox: {
    width: '100%', padding: '12px', borderRadius: '8px',
    background: colors.red + '15', border: `1px solid ${colors.red}33`,
    fontSize: '12px', color: colors.red, fontWeight: 600,
  },
  warningBox: {
    width: '100%', padding: '12px', borderRadius: '8px',
    background: colors.amber + '15', border: `1px solid ${colors.amber}33`,
    fontSize: '12px', color: colors.amber, fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: '8px',
  },
  platformBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '4px 8px', borderRadius: '6px', fontSize: '10px',
    fontWeight: 700, textTransform: 'uppercase',
    background: colors.blue + '15', color: colors.blue,
  },
};

export default function NFCScanner({ onClose, onResult }) {
  const { addPatient, auth } = useApp();
  const nfcInfo = getNfcPlatformInfo();
  const [mode, setMode] = useState(nfcInfo.supported ? 'nfc' : 'manual');
  const [scanning, setScanning] = useState(false);
  const [nfcData, setNfcData] = useState(null);
  const [error, setError] = useState(null);
  const [manualId, setManualId] = useState('');
  const [manualError, setManualError] = useState('');
  const abortRef = useRef(null);

  const startScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    setNfcData(null);

    const abort = await scanNFC(
      (data) => {
        setNfcData(data);
        setScanning(false);
      },
      (err) => {
        setError(err.message);
        setScanning(false);
      },
      () => { /* reading pulse */ }
    );

    abortRef.current = abort;
  }, []);

  useEffect(() => {
    if (mode === 'nfc' && !scanning && !nfcData && !error) {
      startScan();
    }
    return () => { abortRef.current?.(); };
  }, [mode]);

  const handleManualSubmit = useCallback(() => {
    setManualError('');
    const result = validateCivilId(manualId);
    if (!result.valid) {
      setManualError(result.error);
      return;
    }
    setNfcData({
      civilId: result.civilId,
      age: result.age,
      fullName: '',
      gender: '',
      nfcBackend: 'manual',
    });
  }, [manualId]);

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
      nfcScanned: nfcData.nfcBackend !== 'manual',
      nfcBackend: nfcData.nfcBackend || 'unknown',
    };
    const saved = await addPatient(patient);
    await logAction('NFC_IMPORT', 'patient', saved.id);
    onClose();
  }, [nfcData, addPatient, auth, onClose]);

  return (
    <Modal title="Civil ID Scanner" onClose={onClose}>
      <style>{`
        @keyframes nfcPulse {
          0%, 100% { box-shadow: 0 0 0 0 ${colors.blue}44; }
          50% { box-shadow: 0 0 0 20px ${colors.blue}00; }
        }
      `}</style>

      <div style={styles.container}>
        {/* Platform badge */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
          <span style={styles.platformBadge}>
            {nfcInfo.supported ? nfcInfo.label : 'No NFC — Manual Mode'}
          </span>
        </div>

        {/* Mode tabs — always show both when NFC is available */}
        <div style={styles.tabRow}>
          {nfcInfo.supported && (
            <button style={{
              ...styles.tab,
              background: mode === 'nfc' ? colors.blue + '22' : colors.bg2,
              color: mode === 'nfc' ? colors.blue : colors.text3,
            }} onClick={() => { setMode('nfc'); setNfcData(null); setError(null); }}>
              NFC Tap
            </button>
          )}
          <button style={{
            ...styles.tab,
            background: mode === 'manual' ? colors.blue + '22' : colors.bg2,
            color: mode === 'manual' ? colors.blue : colors.text3,
          }} onClick={() => { setMode('manual'); setNfcData(null); setError(null); abortRef.current?.(); setScanning(false); }}>
            Manual Entry
          </button>
        </div>

        {/* NFC Mode */}
        {mode === 'nfc' && !nfcData && (
          <div style={styles.nfcArea}>
            <div style={{ ...styles.nfcRing, ...(scanning ? styles.nfcRingScanning : {}) }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={colors.blue} strokeWidth="1.5">
                <path d="M6 8.32a7.43 7.43 0 010 7.36" />
                <path d="M9.46 6.21a11.76 11.76 0 010 11.58" />
                <path d="M12.91 4.1a16.1 16.1 0 010 15.8" />
                <path d="M16.37 2a20.43 20.43 0 010 20" />
              </svg>
            </div>
            <span style={styles.statusText}>
              {scanning ? nfcInfo.hint : 'Ready to scan'}
            </span>
            <span style={styles.subText}>
              {nfcInfo.backend === 'capacitor'
                ? 'Native NFC — works on iOS and Android'
                : 'Web NFC — Chrome on Android only'}
            </span>
            {error && (
              <>
                <div style={styles.errorBox}>{error}</div>
                <button style={{ ...styles.btn, background: colors.blue, color: '#fff' }}
                  onClick={startScan}>
                  Try Again
                </button>
                <button style={{ ...styles.btn, background: colors.bg2, color: colors.text0 }}
                  onClick={() => { setMode('manual'); abortRef.current?.(); setScanning(false); setError(null); }}>
                  Switch to Manual Entry
                </button>
              </>
            )}
          </div>
        )}

        {/* Manual Mode */}
        {mode === 'manual' && !nfcData && (
          <div style={{ ...styles.nfcArea, gap: '12px' }}>
            <span style={styles.statusText}>Enter Civil ID Number</span>
            <input
              style={styles.manualInput}
              placeholder="281234567890"
              value={manualId}
              onChange={e => { setManualId(e.target.value.replace(/\D/g, '').slice(0, 12)); setManualError(''); }}
              maxLength={12}
              inputMode="numeric"
              autoFocus
            />
            <span style={{ fontSize: '11px', color: colors.text3, fontFamily: fonts.mono }}>
              {manualId.length}/12 digits
            </span>
            {manualError && <div style={styles.errorBox}>{manualError}</div>}
            <button
              style={{ ...styles.btn, background: manualId.length === 12 ? colors.blue : colors.bg2, color: manualId.length === 12 ? '#fff' : colors.text3 }}
              onClick={handleManualSubmit}
              disabled={manualId.length !== 12}>
              Validate
            </button>
          </div>
        )}

        {/* Result display */}
        {nfcData && (
          <>
            <div style={styles.resultCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <CheckIcon size={18} color={colors.green} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: colors.green }}>
                  Civil ID {mode === 'nfc' ? 'Scanned' : 'Validated'}
                </span>
              </div>

              {nfcData.civilId && (
                <div style={styles.resultRow}>
                  <span style={styles.resultLabel}>Civil ID</span>
                  <span style={styles.resultValue}>{nfcData.civilId}</span>
                </div>
              )}
              {nfcData.fullName && (
                <div style={styles.resultRow}>
                  <span style={styles.resultLabel}>Name</span>
                  <span style={{ ...styles.resultValue, fontFamily: fonts.sans }}>{nfcData.fullName}</span>
                </div>
              )}
              {nfcData.fullNameArabic && nfcData.fullNameArabic !== nfcData.fullName && (
                <div style={styles.resultRow}>
                  <span style={styles.resultLabel}>Name (AR)</span>
                  <span style={{ ...styles.resultValue, fontFamily: fonts.sans, direction: 'rtl' }}>{nfcData.fullNameArabic}</span>
                </div>
              )}
              {nfcData.age != null && (
                <div style={styles.resultRow}>
                  <span style={styles.resultLabel}>Age</span>
                  <span style={styles.resultValue}>{nfcData.age}</span>
                </div>
              )}
              {nfcData.gender && (
                <div style={styles.resultRow}>
                  <span style={styles.resultLabel}>Gender</span>
                  <span style={styles.resultValue}>{nfcData.gender}</span>
                </div>
              )}
              {nfcData.nationality && (
                <div style={styles.resultRow}>
                  <span style={styles.resultLabel}>Nationality</span>
                  <span style={styles.resultValue}>{nfcData.nationality}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <button style={{ ...styles.btn, flex: 1, background: colors.bg2, color: colors.text0 }}
                onClick={() => { setNfcData(null); setManualId(''); }}>
                {mode === 'nfc' ? 'Rescan' : 'Re-enter'}
              </button>
              <button style={{ ...styles.btn, flex: 1, background: colors.green, color: '#fff' }}
                onClick={handleAddPatient}>
                Add Patient
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
