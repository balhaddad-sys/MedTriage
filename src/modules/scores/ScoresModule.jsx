import React, { useState } from 'react';
import { colors, fonts } from '../../design/tokens.js';
import { SearchIcon, ChevronRight, BackIcon } from '../../design/icons.jsx';

// ====== CONVERTERS ======
const STEROID_TABLE = [
  { name: 'Hydrocortisone', factor: 1, unit: 'mg' },
  { name: 'Prednisolone', factor: 4, unit: 'mg' },
  { name: 'Methylprednisolone', factor: 5, unit: 'mg' },
  { name: 'Dexamethasone', factor: 25, unit: 'mg' },
  { name: 'Betamethasone', factor: 25, unit: 'mg' },
];

const OPIOID_TABLE = [
  { name: 'Morphine PO', factor: 1 },
  { name: 'Morphine IV/SC', factor: 3 },
  { name: 'Oxycodone PO', factor: 1.5 },
  { name: 'Codeine PO', factor: 0.15 },
  { name: 'Tramadol PO', factor: 0.2 },
  { name: 'Fentanyl patch (mcg/h)', factor: 2.4, unit: 'mcg/h', note: 'Divide oral morphine eq by 2.4' },
];

// ====== NORMAL LAB VALUES ======
const LAB_RANGES = [
  { category: 'CBC', tests: [
    { name: 'Haemoglobin (M)', range: '130-170', unit: 'g/L' },
    { name: 'Haemoglobin (F)', range: '120-160', unit: 'g/L' },
    { name: 'WBC', range: '4.0-11.0', unit: 'x10^9/L' },
    { name: 'Platelets', range: '150-400', unit: 'x10^9/L' },
    { name: 'Neutrophils', range: '2.0-7.5', unit: 'x10^9/L' },
    { name: 'Lymphocytes', range: '1.5-4.0', unit: 'x10^9/L' },
    { name: 'MCV', range: '80-100', unit: 'fL' },
    { name: 'HCT (M)', range: '0.40-0.54', unit: 'L/L' },
    { name: 'HCT (F)', range: '0.37-0.47', unit: 'L/L' },
  ]},
  { category: 'Basic Metabolic', tests: [
    { name: 'Sodium', range: '135-145', unit: 'mmol/L' },
    { name: 'Potassium', range: '3.5-5.0', unit: 'mmol/L' },
    { name: 'Chloride', range: '98-106', unit: 'mmol/L' },
    { name: 'Bicarbonate', range: '22-28', unit: 'mmol/L' },
    { name: 'Urea', range: '2.5-7.1', unit: 'mmol/L' },
    { name: 'Creatinine', range: '60-110', unit: 'umol/L' },
    { name: 'Glucose (fasting)', range: '3.9-5.6', unit: 'mmol/L' },
    { name: 'Calcium (total)', range: '2.20-2.60', unit: 'mmol/L' },
    { name: 'Magnesium', range: '0.70-1.00', unit: 'mmol/L' },
    { name: 'Phosphate', range: '0.80-1.50', unit: 'mmol/L' },
  ]},
  { category: 'Liver Function', tests: [
    { name: 'ALT', range: '7-56', unit: 'U/L' },
    { name: 'AST', range: '10-40', unit: 'U/L' },
    { name: 'ALP', range: '44-147', unit: 'U/L' },
    { name: 'GGT', range: '9-48', unit: 'U/L' },
    { name: 'Bilirubin (total)', range: '3-17', unit: 'umol/L' },
    { name: 'Albumin', range: '35-50', unit: 'g/L' },
    { name: 'Total Protein', range: '60-80', unit: 'g/L' },
  ]},
  { category: 'Coagulation', tests: [
    { name: 'PT', range: '11-13.5', unit: 'seconds' },
    { name: 'INR', range: '0.9-1.1', unit: '' },
    { name: 'aPTT', range: '25-35', unit: 'seconds' },
    { name: 'Fibrinogen', range: '2.0-4.0', unit: 'g/L' },
    { name: 'D-dimer', range: '<0.50', unit: 'mg/L FEU' },
  ]},
  { category: 'Cardiac', tests: [
    { name: 'Troponin I (hs)', range: '<14', unit: 'ng/L' },
    { name: 'CK', range: '30-200', unit: 'U/L' },
    { name: 'BNP', range: '<100', unit: 'pg/mL' },
    { name: 'NT-proBNP (<75y)', range: '<300', unit: 'pg/mL' },
    { name: 'Lactate', range: '0.5-2.0', unit: 'mmol/L' },
  ]},
  { category: 'Thyroid', tests: [
    { name: 'TSH', range: '0.4-4.0', unit: 'mIU/L' },
    { name: 'Free T4', range: '12-22', unit: 'pmol/L' },
    { name: 'Free T3', range: '3.1-6.8', unit: 'pmol/L' },
  ]},
  { category: 'Blood Gas (Arterial)', tests: [
    { name: 'pH', range: '7.35-7.45', unit: '' },
    { name: 'pCO2', range: '35-45', unit: 'mmHg' },
    { name: 'pO2', range: '80-100', unit: 'mmHg' },
    { name: 'HCO3', range: '22-26', unit: 'mmol/L' },
    { name: 'Base Excess', range: '-2 to +2', unit: 'mmol/L' },
    { name: 'Lactate', range: '<2.0', unit: 'mmol/L' },
  ]},
];

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  tabs: {
    display: 'flex', background: colors.bg1,
    borderBottom: `1px solid ${colors.border}`,
  },
  tab: {
    flex: 1, padding: '10px', textAlign: 'center', border: 'none',
    background: 'transparent', color: colors.text3, fontSize: '11px',
    fontWeight: 600, cursor: 'pointer', fontFamily: fonts.sans,
    borderBottom: '2px solid transparent',
  },
  tabActive: { color: colors.blue, borderBottomColor: colors.blue },
  content: { flex: 1, overflow: 'auto', padding: '16px' },
  section: { marginBottom: '24px' },
  sectionTitle: {
    fontSize: '11px', fontWeight: 700, color: colors.text3,
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px',
  },
  labRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 0', borderBottom: `1px solid ${colors.border}08`,
  },
  labName: { fontSize: '13px', color: colors.text1 },
  labRange: { fontSize: '12px', fontFamily: fonts.mono, color: colors.teal },
  labUnit: { fontSize: '10px', color: colors.text3, marginLeft: '4px' },
  converterCard: {
    background: colors.bg1, borderRadius: '10px', padding: '16px',
    border: `1px solid ${colors.border}`, marginBottom: '16px',
  },
  converterTitle: { fontSize: '14px', fontWeight: 700, color: colors.text0, marginBottom: '12px' },
  convInput: {
    display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px',
  },
  input: {
    flex: 1, padding: '10px', borderRadius: '8px',
    border: `1px solid ${colors.border}`, background: colors.bg2,
    color: colors.text0, fontSize: '14px', fontFamily: fonts.mono, outline: 'none',
  },
  select: {
    padding: '10px', borderRadius: '8px', appearance: 'none',
    border: `1px solid ${colors.border}`, background: colors.bg2,
    color: colors.text0, fontSize: '13px', fontFamily: fonts.sans, outline: 'none',
  },
  resultRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 0', fontSize: '13px',
  },
  resultName: { color: colors.text1 },
  resultValue: { fontFamily: fonts.mono, fontWeight: 700, color: colors.teal },
};

function SteroidConverter() {
  const [dose, setDose] = useState('');
  const [from, setFrom] = useState('Prednisolone');

  const fromSteroid = STEROID_TABLE.find(s => s.name === from);
  const baseEquivalent = dose && fromSteroid ? parseFloat(dose) / fromSteroid.factor : 0;

  return (
    <div style={styles.converterCard}>
      <div style={styles.converterTitle}>Steroid Equivalence</div>
      <div style={styles.convInput}>
        <input style={styles.input} type="number" placeholder="Dose (mg)"
          value={dose} onChange={e => setDose(e.target.value)} />
        <select style={styles.select} value={from} onChange={e => setFrom(e.target.value)}>
          {STEROID_TABLE.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>
      </div>
      {baseEquivalent > 0 && STEROID_TABLE.map(s => (
        <div key={s.name} style={styles.resultRow}>
          <span style={styles.resultName}>{s.name}</span>
          <span style={styles.resultValue}>{(baseEquivalent * s.factor).toFixed(1)} mg</span>
        </div>
      ))}
    </div>
  );
}

function OpioidConverter() {
  const [dose, setDose] = useState('');
  const [from, setFrom] = useState('Morphine PO');

  const fromOpioid = OPIOID_TABLE.find(o => o.name === from);
  const morphineEquivalent = dose && fromOpioid ? parseFloat(dose) * fromOpioid.factor : 0;

  return (
    <div style={styles.converterCard}>
      <div style={styles.converterTitle}>Opioid Equivalence (Oral Morphine Equivalent)</div>
      <div style={styles.convInput}>
        <input style={styles.input} type="number" placeholder="Dose"
          value={dose} onChange={e => setDose(e.target.value)} />
        <select style={styles.select} value={from} onChange={e => setFrom(e.target.value)}>
          {OPIOID_TABLE.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
        </select>
      </div>
      {morphineEquivalent > 0 && (
        <>
          <div style={{
            textAlign: 'center', padding: '12px', marginBottom: '12px',
            background: colors.purple + '11', borderRadius: '8px',
          }}>
            <div style={{ fontSize: '10px', color: colors.text3, textTransform: 'uppercase' }}>Oral Morphine Equivalent</div>
            <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: fonts.mono, color: colors.purple }}>
              {morphineEquivalent.toFixed(1)} mg
            </div>
          </div>
          {OPIOID_TABLE.map(o => (
            <div key={o.name} style={styles.resultRow}>
              <span style={styles.resultName}>{o.name}</span>
              <span style={styles.resultValue}>
                {(morphineEquivalent / o.factor).toFixed(1)} {o.unit || 'mg'}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function ScoresModule() {
  const [activeTab, setActiveTab] = useState('labs');

  return (
    <div style={styles.container}>
      <div style={styles.tabs}>
        {[
          { id: 'labs', label: 'Lab Values' },
          { id: 'steroids', label: 'Steroids' },
          { id: 'opioids', label: 'Opioids' },
        ].map(tab => (
          <button key={tab.id}
            style={{ ...styles.tab, ...(activeTab === tab.id ? styles.tabActive : {}) }}
            onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {activeTab === 'labs' && LAB_RANGES.map(cat => (
          <div key={cat.category} style={styles.section}>
            <div style={styles.sectionTitle}>{cat.category}</div>
            {cat.tests.map(t => (
              <div key={t.name} style={styles.labRow}>
                <span style={styles.labName}>{t.name}</span>
                <span>
                  <span style={styles.labRange}>{t.range}</span>
                  <span style={styles.labUnit}>{t.unit}</span>
                </span>
              </div>
            ))}
          </div>
        ))}

        {activeTab === 'steroids' && <SteroidConverter />}
        {activeTab === 'opioids' && <OpioidConverter />}
      </div>
    </div>
  );
}
