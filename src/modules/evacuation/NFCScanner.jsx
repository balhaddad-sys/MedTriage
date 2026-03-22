// Civil ID Scanner — clean step-by-step wizard
// Step 1: NFC tap → detect card UID (if known → show patient, done)
// Step 2: Camera → scan front of card (Civil ID number + blood type)
// Step 3: Camera → scan back of card (MRZ → name, DOB, gender, nationality)
// Step 4: Confirm → save patient

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../../app.jsx';
import { colors, fonts } from '../../design/tokens.js';
import Modal from '../../shared/Modal.jsx';
import { CheckIcon } from '../../design/icons.jsx';
import { scanNFC, getNfcPlatformInfo, findPatientByNfcUid, findExistingPatient, parseCivilIdNumber } from './nfcReader.js';
import { BLOOD_TYPES, getNationalityLabel, parseTD1 } from './mrzParser.js';
import { logAction } from '../../data/audit.js';
import CivilIdCameraScanner from './MRZCamera.jsx';
import MRZScannerCamera from './MRZScannerCamera.jsx';

const s = {
  container: { display: 'flex', flexDirection: 'column', gap: '14px', padding: '4px 0' },
  stepLabel: { fontSize: '11px', fontWeight: 800, color: colors.blue, textTransform: 'uppercase', letterSpacing: '1px' },
  statusText: { fontSize: '15px', fontWeight: 700, color: colors.text0, textAlign: 'center' },
  subText: { fontSize: '12px', color: colors.text3, textAlign: 'center' },
  nfcRing: {
    width: '90px', height: '90px', borderRadius: '50%', margin: '0 auto',
    border: `3px solid ${colors.blue}`, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  nfcRingPulse: { animation: 'nfcPulse 2s ease-in-out infinite' },
  dataCard: {
    width: '100%', padding: '14px', borderRadius: '12px',
    background: colors.green + '11', border: `1px solid ${colors.green}44`,
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  dataRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  dataLabel: { fontSize: '11px', fontWeight: 700, color: colors.text3, textTransform: 'uppercase' },
  dataValue: { fontSize: '14px', fontWeight: 600, color: colors.text0, fontFamily: fonts.mono },
  btn: {
    width: '100%', height: '50px', border: 'none', borderRadius: '10px',
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
};

export default function NFCScanner({ onClose }) {
  const { addPatient, patients, auth } = useApp();
  const nfcInfo = getNfcPlatformInfo();

  // Wizard steps: 'nfc' | 'front' | 'back' | 'confirm' | 'known'
  const [step, setStep] = useState(nfcInfo.supported ? 'nfc' : 'front');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef(null);

  // Collected data
  const [nfcUid, setNfcUid] = useState('');
  const [civilId, setCivilId] = useState('');
  const [age, setAge] = useState(null);
  const [bloodType, setBloodType] = useState('');
  const [gender, setGender] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nationality, setNationality] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [knownPatient, setKnownPatient] = useState(null);

  // Manual Civil ID input
  const [manualId, setManualId] = useState('');

  // ═══ STEP 1: NFC ═══
  useEffect(() => {
    if (step !== 'nfc') return;
    if (!nfcInfo.supported) { setStep('front'); return; }

    setScanning(true);
    setError(null);

    scanNFC(
      (data) => {
        setScanning(false);
        const uid = data.serialNumber || '';
        setNfcUid(uid);

        // Check if known patient
        if (uid) {
          const found = findPatientByNfcUid(patients, uid);
          if (found) {
            setKnownPatient(found);
            setStep('known');
            return;
          }
        }

        // Unknown card → next step (camera front)
        setStep('front');
      },
      (err) => {
        setScanning(false);
        setError(err.message);
      },
      null, null, null,
    ).then(abort => { abortRef.current = abort; });

    return () => { abortRef.current?.(); };
  }, [step]);

  // ═══ STEP 2: Camera Front — Civil ID number + blood type ═══
  const handleFrontResult = useCallback((data) => {
    if (data.civilId) {
      // Check if this Civil ID is already registered
      const existing = findExistingPatient(patients, data.civilId);
      if (existing) {
        // Already registered — show as known patient
        setKnownPatient(existing);
        setStep('known');
        return;
      }
      setCivilId(data.civilId);
      const parsed = parseCivilIdNumber(data.civilId);
      if (parsed) setAge(parsed.age);
    }
    if (data.bloodType) setBloodType(data.bloodType);
    if (data.gender) setGender(data.gender);
    if (data.nameEn) setNameEn(data.nameEn);
    if (data.nameAr) setNameAr(data.nameAr);
    setStep('back');
  }, [patients]);

  // ═══ STEP 3: Camera Back — MRZ → auto-save ═══
  const handleMrzResult = useCallback(async (mrzData) => {
    const finalName = mrzData.fullName || nameEn;
    const finalGender = mrzData.sex || gender;
    const finalNationality = getNationalityLabel(mrzData.nationality) || nationality;
    const finalAge = mrzData.age ?? age;
    const finalCivilId = civilId;

    // Update state for display
    if (finalName) setNameEn(finalName);
    if (finalGender) setGender(finalGender);
    if (finalNationality) setNationality(finalNationality);
    if (mrzData.documentNumber) setDocNumber(mrzData.documentNumber);
    if (finalAge != null) setAge(finalAge);

    // If we have Civil ID, auto-save immediately
    if (finalCivilId && finalCivilId.length === 12) {
      setSaving(true);
      const parsed = parseCivilIdNumber(finalCivilId);
      const patient = {
        civilId: finalCivilId,
        fullName: finalName || '',
        fullNameArabic: nameAr || '',
        age: finalAge ?? parsed?.age ?? null,
        gender: finalGender || 'M',
        triage: 'GREEN',
        mobility: 'AMBULATORY',
        o2: 'NONE',
        iso: 'NONE',
        code: 'FULL',
        allergies: 'NKDA',
        dx: '', meds: '', notes: '',
        nationality: finalNationality || '',
        bloodType: bloodType || '',
        ward: auth?.ward?.name || '',
        evac: 'IN_WARD',
        nfcScanned: !!nfcUid,
        nfcBackend: nfcUid ? 'isodep' : 'camera',
        nfcSerial: nfcUid,
        source: 'mrz-scanner',
      };
      try {
        const saved = await addPatient(patient);
        // Audit log is non-blocking — don't let it break the save
        logAction('MRZ_IMPORT', 'patient', saved.id, {
          newValue: { civilId: finalCivilId, name: finalName, source: 'mrz' },
        }).catch(() => {});
        onClose();
        return;
      } catch (e) {
        console.error('[SAVE] Failed:', e);
        setError('Save failed: ' + (e?.message || 'Unknown error'));
        setSaving(false);
      }
    }

    // Fallback: go to confirm step if no Civil ID
    setStep('confirm');
  }, [nameEn, nameAr, age, gender, nationality, bloodType, civilId, nfcUid, auth, addPatient, onClose]);

  // ═══ STEP 4: Save patient ═══
  const handleSave = useCallback(async () => {
    const finalCivilId = civilId || manualId.replace(/\D/g, '');
    if (!finalCivilId || finalCivilId.length !== 12) {
      setError('Civil ID must be 12 digits');
      return;
    }
    setSaving(true);
    const parsed = parseCivilIdNumber(finalCivilId);
    const patient = {
      civilId: finalCivilId,
      fullName: nameEn,
      fullNameArabic: nameAr,
      age: age ?? parsed?.age ?? null,
      gender: gender || 'M',
      triage: 'GREEN',
      mobility: 'AMBULATORY',
      o2: 'NONE',
      iso: 'NONE',
      code: 'FULL',
      allergies: 'NKDA',
      dx: '', meds: '', notes: '',
      nationality: nationality,
      bloodType: bloodType,
      ward: auth?.ward?.name || '',
      evac: 'IN_WARD',
      nfcScanned: !!nfcUid,
      nfcBackend: nfcUid ? 'isodep' : 'camera',
      nfcSerial: nfcUid,
      source: 'scanner',
    };
    try {
      const saved = await addPatient(patient);
      logAction('SCANNER_IMPORT', 'patient', saved.id, { newValue: { civilId: finalCivilId } }).catch(() => {});
      onClose();
    } catch (e) {
      console.error('[SAVE] Failed:', e);
      setError('Failed to save: ' + (e?.message || 'Unknown error'));
      setSaving(false);
    }
  }, [civilId, manualId, nameEn, nameAr, age, gender, bloodType, nationality, nfcUid, auth, addPatient, onClose]);

  // ═══ KNOWN PATIENT VIEW ═══
  if (step === 'known' && knownPatient) {
    return (
      <Modal title="Patient Found" onClose={onClose}>
        <div style={s.container}>
          <div style={{ ...s.dataCard, borderColor: colors.blue + '44', background: colors.blue + '11' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <CheckIcon size={18} color={colors.blue} />
              <span style={{ fontSize: '15px', fontWeight: 700, color: colors.blue }}>Known Patient</span>
            </div>
            {knownPatient.fullName && <Row label="Name" value={knownPatient.fullName} />}
            {knownPatient.civilId && <Row label="Civil ID" value={knownPatient.civilId} mono />}
            {knownPatient.age != null && <Row label="Age" value={`${knownPatient.age} years`} />}
            {knownPatient.gender && <Row label="Gender" value={knownPatient.gender === 'F' ? 'Female' : 'Male'} />}
            {knownPatient.bloodType && <Row label="Blood Type" value={knownPatient.bloodType} red />}
            <Row label="Triage" value={knownPatient.triage || 'GREEN'} />
            <Row label="Evac" value={(knownPatient.evac || 'IN_WARD').replace('_', ' ')} />
          </div>
          <button style={{ ...s.btn, background: colors.blue, color: '#fff' }} onClick={onClose}>OK</button>
        </div>
      </Modal>
    );
  }

  // ═══ STEP 1: NFC TAP ═══
  if (step === 'nfc') {
    return (
      <Modal title="Step 1: Tap Card" onClose={onClose}>
        <style>{`@keyframes nfcPulse { 0%,100%{box-shadow:0 0 0 0 ${colors.blue}44} 50%{box-shadow:0 0 0 20px ${colors.blue}00} }`}</style>
        <div style={s.container}>
          <div style={{ ...s.nfcRing, ...(scanning ? s.nfcRingPulse : {}) }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={colors.blue} strokeWidth="1.5">
              <path d="M6 8.32a7.43 7.43 0 010 7.36" />
              <path d="M9.46 6.21a11.76 11.76 0 010 11.58" />
              <path d="M12.91 4.1a16.1 16.1 0 010 15.8" />
              <path d="M16.37 2a20.43 20.43 0 010 20" />
            </svg>
          </div>
          <span style={s.statusText}>Hold Civil ID on back of phone</span>
          <span style={s.subText}>Keep it steady for 3 seconds</span>
          {error && <div style={s.errorBox}>{error}</div>}
          <button style={{ ...s.btnSmall, background: colors.bg2, color: colors.text0 }}
            onClick={() => setStep('front')}>
            Skip NFC — use camera only
          </button>
        </div>
      </Modal>
    );
  }

  // ═══ STEP 2: CAMERA FRONT ═══
  if (step === 'front') {
    return (
      <Modal title="Step 2: Scan Front of Card" onClose={onClose}>
        <div style={s.container}>
          <span style={s.stepLabel}>Point camera at FRONT of Civil ID</span>
          <CivilIdCameraScanner
            onResult={handleFrontResult}
            onCancel={() => setStep('back')}
            autoStart
          />
        </div>
      </Modal>
    );
  }

  // ═══ STEP 3: CAMERA BACK (MRZ) ═══
  if (step === 'back') {
    return (
      <Modal title="Step 3: Scan Back of Card" onClose={onClose}>
        <div style={s.container}>
          <span style={s.stepLabel}>Flip card — point camera at BACK (MRZ lines)</span>
          <MRZScannerCamera
            onResult={handleMrzResult}
            onCancel={() => setStep('confirm')}
          />
        </div>
      </Modal>
    );
  }

  // ═══ STEP 4: CONFIRM ═══
  return (
    <Modal title="Step 4: Confirm Patient" onClose={onClose}>
      <div style={s.container}>
        <div style={s.dataCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <CheckIcon size={18} color={colors.green} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: colors.green }}>Patient Data</span>
          </div>
          {civilId && <Row label="Civil ID" value={civilId} mono />}
          {age != null && <Row label="Age" value={`${age} years`} />}
          {nameEn && <Row label="Name" value={nameEn} />}
          {nameAr && <Row label="Arabic" value={nameAr} rtl />}
          {gender && <Row label="Gender" value={gender === 'F' ? 'Female' : 'Male'} />}
          {bloodType && <Row label="Blood Type" value={bloodType} red />}
          {nationality && <Row label="Nationality" value={nationality} />}
          {nfcUid && <Row label="NFC UID" value={nfcUid} mono small />}
        </div>

        {/* Manual Civil ID if camera didn't detect */}
        {!civilId && (
          <div style={{ width: '100%' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text0, marginBottom: '6px', display: 'block' }}>
              Enter Civil ID manually
            </span>
            <input
              style={{
                width: '100%', padding: '14px', borderRadius: '10px',
                border: `1px solid ${colors.border}`, background: colors.bg2,
                color: colors.text0, fontSize: '20px', fontFamily: fonts.mono,
                textAlign: 'center', letterSpacing: '3px', outline: 'none',
              }}
              placeholder="281234567890"
              value={manualId}
              onChange={e => { setManualId(e.target.value.replace(/\D/g, '').slice(0, 12)); setError(null); }}
              maxLength={12}
              inputMode="numeric"
            />
            <span style={{ fontSize: '11px', color: colors.text3, fontFamily: fonts.mono }}>{manualId.length}/12</span>
          </div>
        )}

        {/* Blood type picker if not detected */}
        {!bloodType && (
          <div style={{ width: '100%' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: colors.text3, textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Blood Type</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {BLOOD_TYPES.map(bt => (
                <button key={bt} onClick={() => setBloodType(bloodType === bt ? '' : bt)}
                  style={{
                    padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
                    border: `1px solid ${bloodType === bt ? colors.red : colors.border}`,
                    background: bloodType === bt ? colors.red + '22' : colors.bg2,
                    color: bloodType === bt ? colors.red : colors.text2,
                    fontSize: '12px', fontWeight: 700, fontFamily: fonts.mono,
                  }}>
                  {bt}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div style={s.errorBox}>{error}</div>}

        <button
          style={{ ...s.btn, background: saving ? colors.text3 : colors.green, color: '#fff' }}
          onClick={handleSave}
          disabled={saving}>
          {saving ? 'Saving...' : 'Add Patient'}
        </button>
        <button style={{ ...s.btnSmall, background: colors.bg2, color: colors.text0 }}
          onClick={() => { setStep('front'); setCivilId(''); setBloodType(''); setNameEn(''); setNameAr(''); }}>
          Re-scan
        </button>
      </div>
    </Modal>
  );
}

function Row({ label, value, mono, red, rtl, small }) {
  return (
    <div style={s.dataRow}>
      <span style={s.dataLabel}>{label}</span>
      <span style={{
        ...s.dataValue,
        ...(mono ? {} : { fontFamily: fonts.sans }),
        ...(red ? { color: colors.red, fontWeight: 800, fontSize: '16px' } : {}),
        ...(rtl ? { direction: 'rtl' } : {}),
        ...(small ? { fontSize: '11px' } : {}),
      }}>{value}</span>
    </div>
  );
}
