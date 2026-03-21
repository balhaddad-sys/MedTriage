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
  },
  nfcRingScanning: { animation: 'nfcPulse 2s ease-in-out infinite' },
  nfcRingDetected: { borderColor: colors.green, animation: 'none' },
  statusText: { fontSize: '14px', fontWeight: 600, color: colors.text0, textAlign: 'center' },
  subText: { fontSize: '12px', color: colors.text3, textAlign: 'center' },
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
  successBox: {
    width: '100%', padding: '12px', borderRadius: '8px',
    background: colors.green + '15', border: `1px solid ${colors.green}33`,
    fontSize: '13px', color: colors.green, fontWeight: 600,
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
  // Card detected via NFC but needs manual Civil ID entry (ISO 7816 cards)
  const [cardDetected, setCardDetected] = useState(false);
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  const startScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    setNfcData(null);
    setCardDetected(false);

    const abort = await scanNFC(
      (data) => {
        if (data.needsManualId) {
          // Card tapped but can't read data (ISO 7816 — normal for Civil IDs)
          setCardDetected(true);
          setScanning(false);
          // Auto-focus the Civil ID input after render
          setTimeout(() => inputRef.current?.focus(), 100);
        } else if (data.civilId) {
          // Got full data (Capacitor native or rare NDEF card)
          setNfcData(data);
          setScanning(false);
        } else if (data.tagDetected) {
          // Tag detected but no civil ID in data
          setCardDetected(true);
          setScanning(false);
          setTimeout(() => inputRef.current?.focus(), 100);
        }
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
    if (mode === 'nfc' && !scanning && !nfcData && !error && !cardDetected) {
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
      nfcBackend: cardDetected ? 'webnfc' : 'manual',
      tagDetected: cardDetected,
    });
  }, [manualId, cardDetected]);

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
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span style={styles.platformBadge}>
            {nfcInfo.supported ? nfcInfo.label : 'Manual Mode'}
          </span>
        </div>

        {/* Mode tabs — always show both */}
        <div style={styles.tabRow}>
          <button style={{
            ...styles.tab,
            background: mode === 'nfc' ? colors.blue + '22' : colors.bg2,
            color: mode === 'nfc' ? colors.blue : colors.text3,
          }} onClick={() => { setMode('nfc'); setNfcData(null); setError(null); setCardDetected(false); setManualId(''); }}>
            NFC Tap
          </button>
          <button style={{
            ...styles.tab,
            background: mode === 'manual' ? colors.blue + '22' : colors.bg2,
            color: mode === 'manual' ? colors.blue : colors.text3,
          }} onClick={() => { setMode('manual'); setNfcData(null); setError(null); setCardDetected(false); setManualId(''); abortRef.current?.(); setScanning(false); }}>
            Manual Entry
          </button>
        </div>

        {/* ═══ NFC MODE: Not supported ═══ */}
        {mode === 'nfc' && !nfcInfo.supported && !nfcData && (
          <div style={styles.nfcArea}>
            <div style={{ ...styles.nfcRing, borderColor: colors.amber }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={colors.amber} strokeWidth="1.5">
                <path d="M6 8.32a7.43 7.43 0 010 7.36" />
                <path d="M9.46 6.21a11.76 11.76 0 010 11.58" />
                <path d="M12.91 4.1a16.1 16.1 0 010 15.8" />
                <path d="M16.37 2a20.43 20.43 0 010 20" />
              </svg>
            </div>
            <span style={styles.statusText}>NFC Not Available</span>
            <span style={styles.subText}>
              Web NFC requires Chrome 89+ on Android with NFC hardware
            </span>
            {nfcInfo.diagnostic && (
              <div style={{
                width: '100%', padding: '10px', borderRadius: '8px',
                background: colors.bg2, border: `1px solid ${colors.border}`,
                fontSize: '11px', color: colors.text3, fontFamily: fonts.mono,
                wordBreak: 'break-all',
              }}>
                Reason: {nfcInfo.diagnostic}
              </div>
            )}
            <span style={{ fontSize: '11px', color: colors.text3 }}>
              Try: chrome://flags → search "Web NFC" → Enable → Relaunch
            </span>
            <button style={{ ...styles.btn, background: colors.blue, color: '#fff' }}
              onClick={() => setMode('manual')}>
              Use Manual Entry
            </button>
          </div>
        )}

        {/* ═══ NFC MODE: Scanning ═══ */}
        {mode === 'nfc' && nfcInfo.supported && !nfcData && !cardDetected && (
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
              {scanning ? 'Tap Civil ID card on back of phone...' : 'Ready to scan'}
            </span>
            <span style={styles.subText}>
              Card will be detected, then enter Civil ID number
            </span>
            {error && (
              <>
                <div style={styles.errorBox}>{error}</div>
                <button style={{ ...styles.btn, background: colors.blue, color: '#fff' }}
                  onClick={() => { setError(null); startScan(); }}>
                  Try Again
                </button>
                <button style={{ ...styles.btn, background: colors.bg2, color: colors.text0 }}
                  onClick={() => { setMode('manual'); abortRef.current?.(); setScanning(false); setError(null); }}>
                  Enter Manually Instead
                </button>
              </>
            )}
          </div>
        )}

        {/* ═══ NFC MODE: Card Detected — Enter Civil ID ═══ */}
        {mode === 'nfc' && !nfcData && cardDetected && (
          <div style={{ ...styles.nfcArea, gap: '12px' }}>
            <div style={{ ...styles.nfcRing, ...styles.nfcRingDetected }}>
              <CheckIcon size={40} color={colors.green} />
            </div>
            <div style={styles.successBox}>
              <CheckIcon size={16} color={colors.green} />
              Card detected! Now enter the Civil ID number.
            </div>
            <input
              ref={inputRef}
              style={{
                ...styles.manualInput,
                borderColor: colors.green + '66',
              }}
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
              style={{ ...styles.btn, background: manualId.length === 12 ? colors.green : colors.bg2, color: manualId.length === 12 ? '#fff' : colors.text3 }}
              onClick={handleManualSubmit}
              disabled={manualId.length !== 12}>
              Validate & Add
            </button>
          </div>
        )}

        {/* ═══ MANUAL MODE ═══ */}
        {mode === 'manual' && !nfcData && (
          <div style={{ ...styles.nfcArea, gap: '12px' }}>
            <span style={styles.statusText}>Enter Civil ID Number</span>
            <span style={styles.subText}>
              Type the 12-digit number from the front of the card
            </span>
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

        {/* ═══ RESULT DISPLAY ═══ */}
        {nfcData && (
          <>
            <div style={styles.resultCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <CheckIcon size={18} color={colors.green} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: colors.green }}>
                  Civil ID {nfcData.tagDetected ? 'Scanned' : 'Validated'}
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
                onClick={() => { setNfcData(null); setManualId(''); setCardDetected(false); }}>
                {cardDetected ? 'Rescan' : 'Re-enter'}
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
