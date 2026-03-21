import React, { useState, useCallback } from 'react';
import { useApp } from '../../app.jsx';
import { colors, fonts, triageColors, triageTextColors } from '../../design/tokens.js';
import Modal from '../../shared/Modal.jsx';
import { logAction } from '../../data/audit.js';
import { BLOOD_TYPES } from './mrzParser.js';

const TRIAGE_LIST = ['RED', 'YELLOW', 'GREEN', 'GRAY', 'BLACK'];
const MOBILITY = ['AMBULATORY', 'WHEELCHAIR', 'STRETCHER', 'CRITICAL_TRANSPORT'];
const O2_OPTIONS = ['NONE', 'NASAL_CANNULA', 'FACE_MASK', 'NON_REBREATHER', 'BIPAP', 'VENTILATOR'];
const ISO_OPTIONS = ['NONE', 'CONTACT', 'DROPLET', 'AIRBORNE'];
const CODE_OPTIONS = ['FULL', 'DNR', 'COMFORT'];

const styles = {
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  label: { fontSize: '11px', fontWeight: 700, color: colors.text3, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' },
  input: {
    width: '100%', padding: '12px', borderRadius: '8px',
    border: `1px solid ${colors.border}`, background: colors.bg2,
    color: colors.text0, fontSize: '14px', fontFamily: fonts.sans,
    outline: 'none',
  },
  row: { display: 'flex', gap: '8px' },
  triageRow: { display: 'flex', gap: '6px' },
  triageBtn: {
    flex: 1, height: '46px', border: 'none', borderRadius: '8px',
    fontSize: '12px', fontWeight: 800, cursor: 'pointer',
    fontFamily: fonts.mono, transition: 'all 100ms',
  },
  segmented: { display: 'flex', gap: '4px' },
  segBtn: {
    flex: 1, padding: '8px 4px', borderRadius: '6px',
    border: `1px solid ${colors.border}`, background: colors.bg2,
    color: colors.text2, fontSize: '10px', fontWeight: 700,
    cursor: 'pointer', fontFamily: fonts.mono, textAlign: 'center',
    transition: 'all 100ms',
  },
  segBtnActive: {
    background: colors.blue + '22', borderColor: colors.blue, color: colors.blue,
  },
  submit: {
    width: '100%', height: '48px', border: 'none', borderRadius: '10px',
    fontSize: '15px', fontWeight: 800, cursor: 'pointer',
    fontFamily: fonts.sans, marginTop: '8px', transition: 'all 100ms',
  },
  toggle: {
    background: 'none', border: 'none', color: colors.blue,
    fontSize: '12px', fontWeight: 600, cursor: 'pointer',
    fontFamily: fonts.sans, padding: '4px 0',
  },
};

export default function QuickAdd({ onClose }) {
  const { addPatient, auth, mciMode } = useApp();
  const [fullMode, setFullMode] = useState(false);
  const [form, setForm] = useState({
    triage: 'RED',
    fullName: '',
    bed: '',
    dx: '',
    age: '',
    gender: 'M',
    mobility: 'AMBULATORY',
    o2: 'NONE',
    iso: 'NONE',
    code: 'FULL',
    civilId: '',
    bloodType: '',
    allergies: 'NKDA',
    meds: '',
    notes: '',
    ward: auth?.ward?.name || '',
    evac: 'IN_WARD',
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = useCallback(async () => {
    if (!form.fullName && !mciMode) return;
    const patient = {
      ...form,
      age: form.age ? parseInt(form.age) : null,
      fullName: form.fullName || `MCI-${String(Date.now()).slice(-3)}`,
    };
    await addPatient(patient);
    await logAction('CREATE', 'patient', patient.id);
    onClose();
  }, [form, addPatient, onClose, mciMode]);

  return (
    <Modal title="Add Patient" onClose={onClose}>
      <div style={styles.form}>
        {/* Triage selection FIRST */}
        <div>
          <div style={styles.label}>Triage</div>
          <div style={styles.triageRow}>
            {TRIAGE_LIST.map(t => (
              <button key={t}
                style={{
                  ...styles.triageBtn,
                  background: form.triage === t ? triageColors[t] : triageColors[t] + '22',
                  color: form.triage === t ? triageTextColors[t] : triageColors[t],
                }}
                onClick={() => set('triage', t)}
              >{t}</button>
            ))}
          </div>
        </div>

        {/* Name + Bed side by side */}
        <div style={styles.row}>
          <div style={{ flex: 2 }}>
            <div style={styles.label}>Patient Name</div>
            <input style={styles.input} placeholder="Full name"
              value={form.fullName} onChange={e => set('fullName', e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={styles.label}>Bed</div>
            <input style={styles.input} placeholder="Bed #"
              value={form.bed} onChange={e => set('bed', e.target.value)} />
          </div>
        </div>

        {/* Age + Gender */}
        <div style={styles.row}>
          <div style={{ flex: 1 }}>
            <div style={styles.label}>Age</div>
            <input style={{ ...styles.input, fontFamily: fonts.mono }} placeholder="Age"
              type="number" value={form.age} onChange={e => set('age', e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={styles.label}>Gender</div>
            <div style={styles.segmented}>
              {['M', 'F'].map(g => (
                <button key={g}
                  style={{ ...styles.segBtn, ...(form.gender === g ? styles.segBtnActive : {}) }}
                  onClick={() => set('gender', g)}>{g}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Diagnosis */}
        <div>
          <div style={styles.label}>Diagnosis</div>
          <input style={styles.input} placeholder="Primary diagnosis"
            value={form.dx} onChange={e => set('dx', e.target.value)} />
        </div>

        {/* Mobility */}
        <div>
          <div style={styles.label}>Mobility</div>
          <div style={styles.segmented}>
            {MOBILITY.map(m => (
              <button key={m}
                style={{ ...styles.segBtn, ...(form.mobility === m ? styles.segBtnActive : {}), fontSize: '8px' }}
                onClick={() => set('mobility', m)}>{m.replace('_', ' ')}</button>
            ))}
          </div>
        </div>

        {/* Toggle full mode */}
        {!fullMode ? (
          <button style={styles.toggle} onClick={() => setFullMode(true)}>
            + Show all fields
          </button>
        ) : (
          <>
            <div>
              <div style={styles.label}>O2 Requirement</div>
              <div style={styles.segmented}>
                {O2_OPTIONS.map(o => (
                  <button key={o}
                    style={{ ...styles.segBtn, ...(form.o2 === o ? styles.segBtnActive : {}), fontSize: '8px' }}
                    onClick={() => set('o2', o)}>{o.replace('_', ' ')}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={styles.label}>Isolation</div>
              <div style={styles.segmented}>
                {ISO_OPTIONS.map(i => (
                  <button key={i}
                    style={{ ...styles.segBtn, ...(form.iso === i ? styles.segBtnActive : {}) }}
                    onClick={() => set('iso', i)}>{i}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={styles.label}>Code Status</div>
              <div style={styles.segmented}>
                {CODE_OPTIONS.map(c => (
                  <button key={c}
                    style={{ ...styles.segBtn, ...(form.code === c ? styles.segBtnActive : {}) }}
                    onClick={() => set('code', c)}>{c}</button>
                ))}
              </div>
            </div>
            <div style={styles.row}>
              <div style={{ flex: 1 }}>
                <div style={styles.label}>Civil ID</div>
                <input style={{ ...styles.input, fontFamily: fonts.mono }} placeholder="Civil ID / MRN"
                  value={form.civilId} onChange={e => set('civilId', e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.label}>Allergies</div>
                <input style={styles.input} placeholder="NKDA"
                  value={form.allergies} onChange={e => set('allergies', e.target.value)} />
              </div>
            </div>
            <div>
              <div style={styles.label}>Blood Type</div>
              <div style={styles.segmented}>
                {BLOOD_TYPES.map(bt => (
                  <button key={bt}
                    style={{
                      ...styles.segBtn,
                      ...(form.bloodType === bt ? { background: colors.red + '22', borderColor: colors.red, color: colors.red } : {}),
                      fontSize: '10px',
                    }}
                    onClick={() => set('bloodType', form.bloodType === bt ? '' : bt)}>{bt}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={styles.label}>Medications</div>
              <input style={styles.input} placeholder="Key medications"
                value={form.meds} onChange={e => set('meds', e.target.value)} />
            </div>
            <div>
              <div style={styles.label}>Notes</div>
              <textarea style={{ ...styles.input, minHeight: '60px', resize: 'vertical' }}
                placeholder="Clinical notes"
                value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </>
        )}

        {/* Submit */}
        <button style={{
          ...styles.submit,
          background: triageColors[form.triage],
          color: triageTextColors[form.triage],
        }} onClick={handleSubmit}>
          Add Patient
        </button>
      </div>
    </Modal>
  );
}
