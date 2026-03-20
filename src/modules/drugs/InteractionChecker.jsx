import React, { useState, useMemo } from 'react';
import { colors, fonts } from '../../design/tokens.js';
import { BackIcon, PlusIcon, XIcon, AlertTriangle } from '../../design/icons.jsx';
import { DRUG_DATABASE, INTERACTION_PAIRS } from './drugData.js';

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  header: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 16px', background: colors.bg1,
    borderBottom: `1px solid ${colors.border}`,
  },
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', color: colors.text2, padding: '4px' },
  title: { fontSize: '16px', fontWeight: 700, color: colors.text0 },
  content: { flex: 1, overflow: 'auto', padding: '16px' },
  drugList: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' },
  drugPill: {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '6px 10px', borderRadius: '20px',
    background: colors.purple + '22', fontSize: '12px',
    fontWeight: 600, color: colors.purple,
  },
  removeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: colors.purple, padding: '0', display: 'flex',
  },
  addInput: {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: `1px solid ${colors.border}`, background: colors.bg2,
    color: colors.text0, fontSize: '14px', fontFamily: fonts.sans,
    outline: 'none', marginBottom: '8px',
  },
  suggestion: {
    padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
    color: colors.text1, borderBottom: `1px solid ${colors.border}08`,
  },
  checkBtn: {
    width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
    background: colors.blue, color: '#fff', fontSize: '15px',
    fontWeight: 700, cursor: 'pointer', fontFamily: fonts.sans,
    marginTop: '16px',
  },
  resultCard: {
    background: colors.bg2, borderRadius: '8px', padding: '12px',
    marginBottom: '8px',
  },
};

export default function InteractionChecker({ onBack }) {
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null);

  const suggestions = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return DRUG_DATABASE
      .filter(d => d.genericName.toLowerCase().includes(q) && !selected.includes(d.genericName))
      .slice(0, 8);
  }, [search, selected]);

  const addDrug = (name) => {
    if (!selected.includes(name)) {
      setSelected([...selected, name]);
    }
    setSearch('');
    setResults(null);
  };

  const removeDrug = (name) => {
    setSelected(selected.filter(d => d !== name));
    setResults(null);
  };

  const checkInteractions = () => {
    const found = [];
    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < selected.length; j++) {
        const pair = INTERACTION_PAIRS.find(p =>
          (p.drug1.toLowerCase() === selected[i].toLowerCase() && p.drug2.toLowerCase() === selected[j].toLowerCase()) ||
          (p.drug1.toLowerCase() === selected[j].toLowerCase() && p.drug2.toLowerCase() === selected[i].toLowerCase())
        );
        if (pair) found.push(pair);
      }
    }
    found.sort((a, b) => {
      const order = { Contraindicated: 0, Major: 1, Moderate: 2, Minor: 3 };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    });
    setResults(found);
  };

  const severityColor = {
    Contraindicated: colors.red,
    Major: colors.amber,
    Moderate: colors.yellow,
    Minor: colors.text2,
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}><BackIcon size={20} /></button>
        <span style={styles.title}>Interaction Checker</span>
      </div>

      <div style={styles.content}>
        <div style={styles.drugList}>
          {selected.map(d => (
            <div key={d} style={styles.drugPill}>
              {d}
              <button style={styles.removeBtn} onClick={() => removeDrug(d)}>
                <XIcon size={12} />
              </button>
            </div>
          ))}
        </div>

        <input style={styles.addInput}
          placeholder="Add a drug..."
          value={search} onChange={e => setSearch(e.target.value)} />

        {suggestions.map(d => (
          <div key={d.id} style={styles.suggestion}
            onClick={() => addDrug(d.genericName)}
            onPointerEnter={e => e.currentTarget.style.background = colors.bg2}
            onPointerLeave={e => e.currentTarget.style.background = ''}>
            {d.genericName} <span style={{ color: colors.text3 }}>— {d.pharmacologicalClass}</span>
          </div>
        ))}

        {selected.length >= 2 && (
          <button style={styles.checkBtn} onClick={checkInteractions}>
            Check Interactions ({selected.length} drugs)
          </button>
        )}

        {results !== null && (
          <div style={{ marginTop: '20px' }}>
            {results.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '24px', color: colors.green,
                fontSize: '14px', fontWeight: 600,
              }}>
                No interactions found between selected drugs
              </div>
            ) : (
              results.map((r, i) => (
                <div key={i} style={{
                  ...styles.resultCard,
                  borderLeft: `3px solid ${severityColor[r.severity] || colors.text3}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: colors.text0 }}>
                      {r.drug1} + {r.drug2}
                    </span>
                    <span style={{
                      fontSize: '9px', fontWeight: 800, padding: '2px 8px', borderRadius: '3px',
                      background: (severityColor[r.severity] || colors.text3) + '22',
                      color: severityColor[r.severity] || colors.text3,
                    }}>{r.severity}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: colors.text2, marginTop: '6px' }}>{r.mechanism}</div>
                  <div style={{ fontSize: '12px', color: colors.text1, marginTop: '4px' }}>{r.management}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
