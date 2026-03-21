import React, { useState, useMemo, useCallback } from 'react';
import { useApp } from '../../app.jsx';
import { colors, fonts, triageColors, evacColors } from '../../design/tokens.js';
import { PlusIcon, SearchIcon, SettingsIcon, CameraIcon, NfcIcon } from '../../design/icons.jsx';
import PatientCard from './PatientCard.jsx';
import QuickAdd from './QuickAdd.jsx';
import CommandCenter from './CommandCenter.jsx';
import OCRScanner from './OCRScanner.jsx';
import NFCScanner from './NFCScanner.jsx';

const TRIAGE_ORDER = { RED: 0, YELLOW: 1, GREEN: 2, GRAY: 3, BLACK: 4 };

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  searchBar: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '12px 16px', background: colors.bg1,
    borderBottom: `1px solid ${colors.border}`,
  },
  searchInput: {
    flex: 1, background: colors.bg2, border: `1px solid ${colors.border}`,
    borderRadius: '8px', padding: '10px 12px 10px 36px',
    color: colors.text0, fontSize: '14px', fontFamily: fonts.sans,
    outline: 'none',
  },
  triageSummary: {
    display: 'flex', gap: '4px', padding: '8px 16px',
    background: colors.bg0, borderBottom: `1px solid ${colors.border}`,
  },
  triageBtn: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '6px 4px', borderRadius: '6px', border: 'none',
    cursor: 'pointer', fontFamily: fonts.mono, transition: 'all 150ms',
  },
  triageCount: { fontSize: '18px', fontWeight: 800, lineHeight: 1 },
  triageLabel: { fontSize: '9px', fontWeight: 700, marginTop: '2px' },
  list: {
    flex: 1, overflow: 'auto', padding: '8px 12px',
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  fab: {
    position: 'absolute', bottom: '16px', right: '16px',
    width: '56px', height: '56px', borderRadius: '16px',
    background: colors.blue, border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(59,130,246,0.4)',
    zIndex: 10, transition: 'transform 100ms',
  },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', flex: 1, gap: '12px', padding: '48px',
  },
};

export default function EvacModule() {
  const { patients, auth } = useApp();
  const [search, setSearch] = useState('');
  const [triageFilter, setTriageFilter] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showCommand, setShowCommand] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const [showNFC, setShowNFC] = useState(false);

  const triageCounts = useMemo(() => {
    const counts = { RED: 0, YELLOW: 0, GREEN: 0, GRAY: 0, BLACK: 0 };
    patients.forEach(p => { if (counts[p.triage] !== undefined) counts[p.triage]++; });
    return counts;
  }, [patients]);

  const filtered = useMemo(() => {
    let list = [...patients];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.fullName || '').toLowerCase().includes(q) ||
        (p.bed || '').toLowerCase().includes(q) ||
        (p.civilId || '').toLowerCase().includes(q) ||
        (p.dx || '').toLowerCase().includes(q)
      );
    }
    if (triageFilter) {
      list = list.filter(p => p.triage === triageFilter);
    }
    list.sort((a, b) => (TRIAGE_ORDER[a.triage] ?? 5) - (TRIAGE_ORDER[b.triage] ?? 5));
    return list;
  }, [patients, search, triageFilter]);

  const toggleTriageFilter = useCallback((triage) => {
    setTriageFilter(f => f === triage ? null : triage);
  }, []);

  return (
    <div style={styles.container}>
      {/* Search */}
      <div style={styles.searchBar}>
        <div style={{ position: 'relative', flex: 1 }}>
          <SearchIcon size={16} color={colors.text3}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            style={styles.searchInput}
            placeholder="Search name, bed, ID, diagnosis..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button onClick={() => setShowOCR(true)} style={{
          background: colors.bg2, border: `1px solid ${colors.border}`,
          borderRadius: '8px', padding: '10px', cursor: 'pointer',
        }} title="Scan patient list">
          <CameraIcon size={18} color={colors.text2} />
        </button>
        <button onClick={() => setShowNFC(true)} style={{
          background: colors.bg2, border: `1px solid ${colors.border}`,
          borderRadius: '8px', padding: '10px', cursor: 'pointer',
        }} title="Scan Civil ID">
          <NfcIcon size={18} color={colors.text2} />
        </button>
        {auth?.isAdmin && (
          <button onClick={() => setShowCommand(true)} style={{
            background: colors.bg2, border: `1px solid ${colors.border}`,
            borderRadius: '8px', padding: '10px', cursor: 'pointer',
          }}>
            <SettingsIcon size={18} color={colors.text2} />
          </button>
        )}
      </div>

      {/* Triage summary bar */}
      <div style={styles.triageSummary}>
        {['RED', 'YELLOW', 'GREEN', 'GRAY', 'BLACK'].map(t => (
          <button key={t}
            style={{
              ...styles.triageBtn,
              background: triageFilter === t ? triageColors[t] + '33' : 'transparent',
              border: triageFilter === t ? `1px solid ${triageColors[t]}55` : '1px solid transparent',
            }}
            onClick={() => toggleTriageFilter(t)}>
            <span style={{ ...styles.triageCount, color: triageColors[t] }}>
              {triageCounts[t]}
            </span>
            <span style={{ ...styles.triageLabel, color: triageColors[t] }}>
              {t}
            </span>
          </button>
        ))}
      </div>

      {/* Patient list */}
      <div style={styles.list}>
        {filtered.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={{ fontSize: '36px', color: colors.text3 }}>+</span>
            <span style={{ fontSize: '14px', color: colors.text3, fontWeight: 600 }}>
              {patients.length === 0 ? 'No patients registered' : 'No matching patients'}
            </span>
            <span style={{ fontSize: '12px', color: colors.text3 }}>
              Tap + to add a patient
            </span>
          </div>
        ) : (
          filtered.map(p => <PatientCard key={p.id} patient={p} />)
        )}
      </div>

      {/* FAB */}
      <button style={styles.fab} onClick={() => setShowAdd(true)}
        onPointerDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
        onPointerUp={e => e.currentTarget.style.transform = ''}>
        <PlusIcon size={24} color="#fff" />
      </button>

      {/* Modals */}
      {showAdd && <QuickAdd onClose={() => setShowAdd(false)} />}
      {showCommand && <CommandCenter onClose={() => setShowCommand(false)} />}
      {showOCR && <OCRScanner onClose={() => setShowOCR(false)} />}
      {showNFC && <NFCScanner onClose={() => setShowNFC(false)} />}
    </div>
  );
}
