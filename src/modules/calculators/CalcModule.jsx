import React, { useState, useMemo } from 'react';
import { colors, fonts } from '../../design/tokens.js';
import { SearchIcon, CalcIcon, ChevronRight, BackIcon } from '../../design/icons.jsx';
import { CALCULATORS, validate, convertUnit } from './CalcEngine.jsx';

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  searchBar: {
    padding: '12px 16px', background: colors.bg1,
    borderBottom: `1px solid ${colors.border}`,
  },
  searchWrap: { position: 'relative' },
  searchInput: {
    width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px',
    border: `1px solid ${colors.border}`, background: colors.bg2,
    color: colors.text0, fontSize: '14px', fontFamily: fonts.sans, outline: 'none',
  },
  list: { flex: 1, overflow: 'auto', padding: '8px 12px' },
  catTitle: {
    fontSize: '11px', fontWeight: 700, color: colors.text3,
    textTransform: 'uppercase', letterSpacing: '0.5px',
    padding: '12px 0 6px',
  },
  calcItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px', borderRadius: '8px', cursor: 'pointer',
    transition: 'background 100ms',
  },
  calcName: { fontSize: '14px', fontWeight: 700, color: colors.text0 },
  calcDesc: { fontSize: '11px', color: colors.text2, marginTop: '2px' },
  // Calculator view
  header: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 16px', background: colors.bg1,
    borderBottom: `1px solid ${colors.border}`,
  },
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', color: colors.text2, padding: '4px' },
  calcTitle: { fontSize: '16px', fontWeight: 700, color: colors.text0 },
  form: { flex: 1, overflow: 'auto', padding: '16px' },
  inputGroup: { marginBottom: '16px' },
  label: { fontSize: '11px', fontWeight: 700, color: colors.text2, marginBottom: '6px', display: 'flex', justifyContent: 'space-between' },
  input: {
    width: '100%', padding: '12px', borderRadius: '8px',
    border: `1px solid ${colors.border}`, background: colors.bg2,
    color: colors.text0, fontSize: '16px', fontFamily: fonts.mono, outline: 'none',
  },
  boolRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 0', borderBottom: `1px solid ${colors.border}08`,
  },
  boolLabel: { fontSize: '13px', color: colors.text1, flex: 1 },
  boolToggle: {
    width: '44px', height: '26px', borderRadius: '13px', border: 'none',
    cursor: 'pointer', position: 'relative', transition: 'background 150ms',
  },
  boolDot: {
    position: 'absolute', top: '3px', width: '20px', height: '20px',
    borderRadius: '50%', background: '#fff', transition: 'left 150ms',
  },
  selectWrap: { position: 'relative' },
  select: {
    width: '100%', padding: '12px', borderRadius: '8px', appearance: 'none',
    border: `1px solid ${colors.border}`, background: colors.bg2,
    color: colors.text0, fontSize: '13px', fontFamily: fonts.sans, outline: 'none',
  },
  result: {
    background: colors.bg1, borderRadius: '12px', padding: '20px',
    textAlign: 'center', marginTop: '16px',
    border: `1px solid ${colors.border}`,
  },
  resultValue: { fontSize: '42px', fontWeight: 800, fontFamily: fonts.mono, lineHeight: 1 },
  resultUnit: { fontSize: '11px', color: colors.text2, fontFamily: fonts.mono, marginTop: '4px' },
  resultInterpret: { fontSize: '13px', fontWeight: 700, marginTop: '8px' },
  citation: { fontSize: '10px', color: colors.text3, marginTop: '12px', fontStyle: 'italic' },
  warning: {
    fontSize: '11px', color: colors.amber, background: colors.amber + '11',
    padding: '4px 8px', borderRadius: '4px', marginTop: '4px',
  },
  error: {
    fontSize: '11px', color: colors.red, marginTop: '4px',
  },
};

const colorMap = { green: colors.green, yellow: colors.yellow, red: colors.red, blue: colors.blue, gray: colors.text3 };

export default function CalcModule() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [values, setValues] = useState({});

  const categories = useMemo(() => {
    const cats = {};
    const list = search
      ? CALCULATORS.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase()) || c.category.toLowerCase().includes(search.toLowerCase()))
      : CALCULATORS;
    list.forEach(c => {
      if (!cats[c.category]) cats[c.category] = [];
      cats[c.category].push(c);
    });
    return cats;
  }, [search]);

  const openCalc = (calc) => {
    setSelected(calc);
    const initial = {};
    calc.inputs.forEach(inp => {
      if (inp.type === 'bool') initial[inp.key] = false;
      else if (inp.type === 'select') initial[inp.key] = inp.options[0];
      else initial[inp.key] = '';
    });
    setValues(initial);
  };

  const setVal = (key, val) => setValues(v => ({ ...v, [key]: val }));

  // Compute result
  const result = useMemo(() => {
    if (!selected) return null;
    const parsed = {};
    let allValid = true;
    for (const inp of selected.inputs) {
      if (inp.type === 'bool') { parsed[inp.key] = values[inp.key]; continue; }
      if (inp.type === 'select') { parsed[inp.key] = values[inp.key]; continue; }
      const v = validate(values[inp.key], inp.bounds);
      if (!v.valid) { allValid = false; continue; }
      parsed[inp.key] = v.value;
    }
    if (!allValid) return null;
    try {
      const val = selected.compute(parsed);
      const interp = selected.interpret(val, parsed);
      return { value: val, interpretation: interp };
    } catch { return null; }
  }, [selected, values]);

  if (selected) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => setSelected(null)}><BackIcon size={20} /></button>
          <div>
            <div style={styles.calcTitle}>{selected.name}</div>
            <div style={{ fontSize: '11px', color: colors.text2 }}>{selected.description}</div>
          </div>
        </div>
        <div style={styles.form}>
          {selected.inputs.map(inp => (
            <div key={inp.key} style={styles.inputGroup}>
              {inp.type === 'bool' ? (
                <div style={styles.boolRow}>
                  <span style={styles.boolLabel}>{inp.label}</span>
                  <button
                    style={{ ...styles.boolToggle, background: values[inp.key] ? colors.blue : colors.bg3 }}
                    onClick={() => setVal(inp.key, !values[inp.key])}>
                    <div style={{ ...styles.boolDot, left: values[inp.key] ? '21px' : '3px' }} />
                  </button>
                </div>
              ) : inp.type === 'select' ? (
                <>
                  <div style={styles.label}><span>{inp.label}</span></div>
                  <select style={styles.select}
                    value={values[inp.key]}
                    onChange={e => setVal(inp.key, e.target.value)}>
                    {inp.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <div style={styles.label}>
                    <span>{inp.label}</span>
                    <span style={{ fontFamily: fonts.mono, fontSize: '10px' }}>{inp.unit}</span>
                  </div>
                  <input style={styles.input}
                    type="number" inputMode="decimal" step="any"
                    placeholder={inp.label}
                    value={values[inp.key]}
                    onChange={e => setVal(inp.key, e.target.value)} />
                  {values[inp.key] && inp.bounds && (() => {
                    const v = validate(values[inp.key], inp.bounds);
                    if (v.error) return <div style={styles.error}>{v.error}</div>;
                    if (v.warning) return <div style={styles.warning}>{v.warning}</div>;
                    return null;
                  })()}
                </>
              )}
            </div>
          ))}

          {result && (
            <div style={styles.result}>
              <div style={{ ...styles.resultValue, color: colorMap[result.interpretation.color] || colors.text0 }}>
                {result.value}
              </div>
              <div style={styles.resultUnit}>{selected.resultUnit}</div>
              <div style={{ ...styles.resultInterpret, color: colorMap[result.interpretation.color] || colors.text1 }}>
                {result.interpretation.label}
              </div>
              <div style={styles.citation}>{selected.citation}</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.searchBar}>
        <div style={styles.searchWrap}>
          <SearchIcon size={16} color={colors.text3}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input style={styles.searchInput}
            placeholder="Search calculators..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div style={styles.list}>
        {Object.entries(categories).map(([cat, calcs]) => (
          <div key={cat}>
            <div style={styles.catTitle}>{cat}</div>
            {calcs.map(c => (
              <div key={c.id} style={styles.calcItem}
                onClick={() => openCalc(c)}
                onPointerEnter={e => e.currentTarget.style.background = colors.bg2}
                onPointerLeave={e => e.currentTarget.style.background = ''}>
                <div>
                  <div style={styles.calcName}>{c.name}</div>
                  <div style={styles.calcDesc}>{c.description}</div>
                </div>
                <ChevronRight size={16} color={colors.text3} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
