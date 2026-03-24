import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../../app.jsx';
import { colors, fonts, triageColors, triageTextColors } from '../../design/tokens.js';
import { EvacTag } from '../../shared/Tag.jsx';
import { ChevronDown, ChevronUp } from '../../design/icons.jsx';
import { logTriageChange, logEvacStatusChange, logAction } from '../../data/audit.js';
import { feedShifuCorrection } from './ocrEngine.js';

const TRIAGE_LIST = ['RED', 'YELLOW', 'GREEN', 'GRAY', 'BLACK'];
const EVAC_FLOW = ['IN_WARD', 'STAGED', 'IN_TRANSIT', 'EVACUATED'];

const styles = {
  card: {
    display: 'flex', borderRadius: '8px', overflow: 'hidden',
    background: colors.bg1, border: `1px solid ${colors.border}`,
    transition: 'all 150ms',
  },
  triageStrip: {
    width: '50px', flexShrink: 0, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '10px', fontWeight: 800, fontFamily: fonts.mono,
    writingMode: 'vertical-rl', textOrientation: 'mixed',
    transition: 'background 100ms',
  },
  body: {
    flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px',
  },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  name: { fontSize: '14px', fontWeight: 800, color: colors.text0, lineHeight: 1.2 },
  ageGender: {
    fontSize: '10px', fontWeight: 500, color: colors.text3,
    fontFamily: fonts.mono, marginLeft: '6px',
  },
  bed: { fontSize: '12px', fontWeight: 600, color: colors.text1, fontFamily: fonts.mono },
  dx: { fontSize: '11px', color: colors.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tags: { display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' },
  expanded: {
    padding: '12px', borderTop: `1px solid ${colors.border}`,
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
  fieldGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
  },
  field: {
    display: 'flex', flexDirection: 'column', gap: '2px',
  },
  fieldLabel: { fontSize: '9px', fontWeight: 700, color: colors.text3, textTransform: 'uppercase', letterSpacing: '0.5px' },
  fieldValue: { fontSize: '12px', color: colors.text1, fontFamily: fonts.mono },
  triageRow: {
    display: 'flex', gap: '4px',
  },
  triageBtn: {
    flex: 1, height: '36px', border: 'none', borderRadius: '6px',
    fontSize: '11px', fontWeight: 800, cursor: 'pointer',
    fontFamily: fonts.mono, transition: 'all 100ms',
  },
  evacTrack: {
    display: 'flex', gap: '4px', alignItems: 'center',
  },
  evacStep: {
    flex: 1, height: '32px', borderRadius: '6px', border: 'none',
    fontSize: '9px', fontWeight: 700, cursor: 'pointer',
    fontFamily: fonts.mono, display: 'flex', alignItems: 'center',
    justifyContent: 'center', transition: 'all 100ms',
  },
};

const tagStyle = (color) => ({
  display: 'inline-flex', padding: '1px 6px', borderRadius: '3px',
  fontSize: '9px', fontWeight: 700, fontFamily: fonts.mono,
  background: color + '22', color: color,
});

// Inline editable field — tap to edit, blur/enter to save
function EditableField({ value, field, patient, onSave, style: fieldStyle, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const inputRef = useRef(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== (value || '').trim()) {
      // Feed the correction into Shifu learning loop
      if (value && patient?.ocrSource) {
        feedShifuCorrection(field, value, trimmed);
      }
      onSave(field, trimmed);
    }
  }, [draft, value, field, patient, onSave]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        style={{
          ...fieldStyle,
          background: colors.bg3, border: `1px solid ${colors.blue}`,
          borderRadius: '4px', padding: '2px 4px', outline: 'none',
          width: '100%',
        }}
        placeholder={placeholder}
        onClick={e => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      style={{ ...fieldStyle, cursor: 'pointer', borderBottom: `1px dashed ${colors.border}` }}
      onClick={e => { e.stopPropagation(); setEditing(true); setDraft(value || ''); }}
      title="Tap to edit"
    >
      {value || <span style={{ color: colors.text3, fontStyle: 'italic' }}>{placeholder || '—'}</span>}
    </span>
  );
}

export default function PatientCard({ patient, forceExpand, onExpanded }) {
  const { updatePatient, removePatient } = useApp();
  const [expanded, setExpanded] = useState(false);

  // Auto-expand when NFC detects this patient
  useEffect(() => {
    if (forceExpand && !expanded) {
      setExpanded(true);
      if (onExpanded) onExpanded();
    }
  }, [forceExpand]);

  const cycleTriage = useCallback(async (e) => {
    e.stopPropagation();
    const idx = TRIAGE_LIST.indexOf(patient.triage);
    const next = TRIAGE_LIST[(idx + 1) % TRIAGE_LIST.length];
    await logTriageChange(patient.id, patient.triage, next);
    updatePatient({ ...patient, triage: next });
  }, [patient, updatePatient]);

  const setTriage = useCallback(async (triage) => {
    if (triage === patient.triage) return;
    await logTriageChange(patient.id, patient.triage, triage);
    updatePatient({ ...patient, triage });
  }, [patient, updatePatient]);

  const advanceEvac = useCallback(async (status) => {
    const curIdx = EVAC_FLOW.indexOf(patient.evac);
    const newIdx = EVAC_FLOW.indexOf(status);
    if (newIdx < curIdx) return; // Monotonic — can only advance
    await logEvacStatusChange(patient.id, patient.evac, status);
    updatePatient({ ...patient, evac: status, evacTime: new Date().toISOString() });
  }, [patient, updatePatient]);

  const saveField = useCallback(async (field, value) => {
    const updated = { ...patient, [field]: value };
    await updatePatient(updated);
    await logAction('EDIT_FIELD', 'patient', patient.id, { field, oldValue: patient[field], newValue: value });
  }, [patient, updatePatient]);

  const p = patient;

  return (
    <div>
      <div style={styles.card} onClick={() => setExpanded(!expanded)}>
        {/* Triage strip */}
        <div
          style={{ ...styles.triageStrip, background: triageColors[p.triage], color: triageTextColors[p.triage] }}
          onClick={cycleTriage}
        >
          {p.triage}
        </div>

        {/* Body */}
        <div style={styles.body}>
          <div style={styles.row}>
            <div>
              <EditableField value={p.fullName} field="fullName" patient={p} onSave={saveField}
                style={{ ...styles.name, ...(p.fullName ? {} : { color: colors.amber }) }}
                placeholder="Tap to add name" />
              <span style={styles.ageGender}>{p.age}{p.gender ? `/${p.gender}` : ''}</span>
            </div>
            {expanded ? <ChevronUp size={16} color={colors.text3} /> : <ChevronDown size={16} color={colors.text3} />}
          </div>
          <div style={styles.row}>
            <EditableField value={p.bed} field="bed" patient={p} onSave={saveField}
              style={{ ...styles.bed, ...(p.bed ? {} : { color: colors.amber }) }}
              placeholder="Bed" />
            <EditableField value={p.dx} field="dx" patient={p} onSave={saveField}
              style={styles.dx} placeholder="Diagnosis" />
          </div>
          <div style={styles.tags}>
            <EvacTag status={p.evac || 'IN_WARD'} />
            {p.o2 && p.o2 !== 'NONE' && <span style={tagStyle(colors.amber)}>O2: {p.o2}</span>}
            {p.iso && p.iso !== 'NONE' && <span style={tagStyle(colors.purple)}>ISO: {p.iso}</span>}
            {p.bloodType && <span style={tagStyle(colors.red)}>{p.bloodType}</span>}
            {p.code && p.code !== 'FULL' && <span style={tagStyle(colors.red)}>{p.code}</span>}
            {p.mobility === 'CRITICAL_TRANSPORT' && <span style={tagStyle(colors.red)}>CRITICAL</span>}
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ ...styles.expanded, background: colors.bg1, borderRadius: '0 0 8px 8px', marginTop: '-1px', border: `1px solid ${colors.border}`, borderTop: 'none' }}>
          <div style={styles.fieldGrid}>
            <div style={styles.field}>
              <span style={styles.fieldLabel}>Civil ID</span>
              <span style={styles.fieldValue}>{p.civilId || '—'}</span>
            </div>
            <div style={styles.field}>
              <span style={styles.fieldLabel}>Blood Type</span>
              <span style={{ ...styles.fieldValue, color: p.bloodType ? colors.red : colors.text3 }}>{p.bloodType || '—'}</span>
            </div>
            <div style={styles.field}>
              <span style={styles.fieldLabel}>Nationality</span>
              <span style={styles.fieldValue}>{p.nationality || '—'}</span>
            </div>
            <div style={styles.field}>
              <span style={styles.fieldLabel}>Code Status</span>
              <span style={{ ...styles.fieldValue, ...(p.code ? {} : { color: colors.amber }) }}>{p.code || '—'}</span>
            </div>
            <div style={styles.field}>
              <span style={styles.fieldLabel}>Mobility</span>
              <span style={{ ...styles.fieldValue, ...(p.mobility ? {} : { color: colors.amber }) }}>{p.mobility || '—'}</span>
            </div>
            <div style={styles.field}>
              <span style={styles.fieldLabel}>O2 Requirement</span>
              <span style={{ ...styles.fieldValue, ...(p.o2 ? {} : { color: colors.amber }) }}>{p.o2 || '—'}</span>
            </div>
            <div style={styles.field}>
              <span style={styles.fieldLabel}>Isolation</span>
              <span style={{ ...styles.fieldValue, ...(p.iso ? {} : { color: colors.amber }) }}>{p.iso || '—'}</span>
            </div>
            <div style={styles.field}>
              <span style={styles.fieldLabel}>Allergies</span>
              <span style={{ ...styles.fieldValue, ...(p.allergies ? {} : { color: colors.amber }) }}>{p.allergies || '—'}</span>
            </div>
            <div style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <span style={styles.fieldLabel}>Medications</span>
              <EditableField value={p.meds} field="meds" patient={p} onSave={saveField}
                style={styles.fieldValue} placeholder="Medications" />
            </div>
            <div style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <span style={styles.fieldLabel}>Notes</span>
              <EditableField value={p.notes} field="notes" patient={p} onSave={saveField}
                style={styles.fieldValue} placeholder="Notes" />
            </div>
          </div>

          {/* Triage quick-set */}
          <div>
            <div style={{ ...styles.fieldLabel, marginBottom: '6px' }}>Triage</div>
            <div style={styles.triageRow}>
              {TRIAGE_LIST.map(t => (
                <button key={t}
                  style={{
                    ...styles.triageBtn,
                    background: p.triage === t ? triageColors[t] : triageColors[t] + '22',
                    color: p.triage === t ? triageTextColors[t] : triageColors[t],
                  }}
                  onClick={() => setTriage(t)}
                >{t}</button>
              ))}
            </div>
          </div>

          {/* Evacuation track */}
          <div>
            <div style={{ ...styles.fieldLabel, marginBottom: '6px' }}>Evacuation</div>
            <div style={styles.evacTrack}>
              {EVAC_FLOW.map((s, i) => {
                const curIdx = EVAC_FLOW.indexOf(p.evac || 'IN_WARD');
                const isPast = i < curIdx;
                const isCurrent = i === curIdx;
                const evacColorMap = { IN_WARD: colors.inWard, STAGED: colors.staged, IN_TRANSIT: colors.inTransit, EVACUATED: colors.evacuated };
                const c = evacColorMap[s];
                return (
                  <button key={s}
                    style={{
                      ...styles.evacStep,
                      background: isCurrent ? c : isPast ? c + '44' : colors.bg3,
                      color: isCurrent ? '#fff' : isPast ? c : colors.text3,
                      border: isCurrent ? `2px solid ${c}` : 'none',
                    }}
                    onClick={() => advanceEvac(s)}
                  >
                    {s.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Delete button */}
          <button
            style={{
              width: '100%', marginTop: '8px', padding: '10px', border: 'none',
              borderRadius: '6px', background: colors.red + '15',
              color: colors.red, fontSize: '12px', fontWeight: 700,
              cursor: 'pointer', fontFamily: fonts.sans,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete patient ${patient.fullName || patient.civilId || 'unknown'}?`)) {
                removePatient(patient.id);
              }
            }}>
            Delete Patient
          </button>
        </div>
      )}
    </div>
  );
}
