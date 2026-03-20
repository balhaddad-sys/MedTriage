import React, { useState, useMemo, useCallback } from 'react';
import { colors, fonts } from '../../design/tokens.js';
import { SearchIcon, PillIcon, AlertTriangle, ZapIcon } from '../../design/icons.jsx';
import DrugMonograph from './DrugMonograph.jsx';
import InteractionChecker from './InteractionChecker.jsx';
import { DRUG_DATABASE, EMERGENCY_DRUGS } from './drugData.js';

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
  tabs: {
    display: 'flex', background: colors.bg1,
    borderBottom: `1px solid ${colors.border}`,
  },
  tab: {
    flex: 1, padding: '10px', textAlign: 'center', border: 'none',
    background: 'transparent', color: colors.text3, fontSize: '12px',
    fontWeight: 600, cursor: 'pointer', fontFamily: fonts.sans,
    borderBottom: '2px solid transparent', transition: 'all 150ms',
  },
  tabActive: { color: colors.blue, borderBottomColor: colors.blue },
  list: { flex: 1, overflow: 'auto', padding: '8px 12px' },
  drugItem: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px', borderRadius: '8px', cursor: 'pointer',
    transition: 'background 100ms',
  },
  drugIcon: {
    width: '36px', height: '36px', borderRadius: '8px',
    background: colors.purple + '22', display: 'flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  drugName: { fontSize: '14px', fontWeight: 700, color: colors.text0 },
  drugClass: { fontSize: '11px', color: colors.text2 },
  drugWho: {
    fontSize: '9px', fontWeight: 700, color: colors.teal,
    background: colors.teal + '22', padding: '1px 6px', borderRadius: '3px',
    marginLeft: '8px',
  },
  emergencyCard: {
    background: colors.red + '11', border: `1px solid ${colors.red}33`,
    borderRadius: '8px', padding: '12px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '10px',
    marginBottom: '6px', transition: 'background 100ms',
  },
  sectionTitle: {
    fontSize: '11px', fontWeight: 700, color: colors.text3,
    textTransform: 'uppercase', letterSpacing: '0.5px',
    padding: '12px 12px 6px', marginTop: '8px',
  },
};

export default function DrugModule() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [showInteractions, setShowInteractions] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return DRUG_DATABASE;
    const q = search.toLowerCase();
    return DRUG_DATABASE.filter(d =>
      d.genericName.toLowerCase().includes(q) ||
      d.brandNames.some(b => b.toLowerCase().includes(q)) ||
      d.pharmacologicalClass.toLowerCase().includes(q) ||
      d.indications.some(i => i.toLowerCase().includes(q)) ||
      (d.searchTerms || []).some(t => t.toLowerCase().includes(q))
    );
  }, [search]);

  const categories = useMemo(() => {
    const cats = {};
    filtered.forEach(d => {
      const cat = d.pharmacologicalClass || 'Other';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(d);
    });
    return cats;
  }, [filtered]);

  if (selectedDrug) {
    return <DrugMonograph drug={selectedDrug} onBack={() => setSelectedDrug(null)} />;
  }

  if (showInteractions) {
    return <InteractionChecker onBack={() => setShowInteractions(false)} />;
  }

  return (
    <div style={styles.container}>
      <div style={styles.searchBar}>
        <div style={styles.searchWrap}>
          <SearchIcon size={16} color={colors.text3}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input style={styles.searchInput}
            placeholder="Search drugs by name, class, indication..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div style={styles.tabs}>
        {[
          { id: 'all', label: 'All Drugs' },
          { id: 'emergency', label: 'Emergency' },
          { id: 'interactions', label: 'Interactions' },
        ].map(tab => (
          <button key={tab.id}
            style={{ ...styles.tab, ...(activeTab === tab.id ? styles.tabActive : {}) }}
            onClick={() => {
              if (tab.id === 'interactions') { setShowInteractions(true); return; }
              setActiveTab(tab.id);
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={styles.list}>
        {activeTab === 'emergency' && (
          <>
            <div style={styles.sectionTitle}>Emergency Drug Cards</div>
            {EMERGENCY_DRUGS.map(d => (
              <div key={d.id} style={styles.emergencyCard}
                onClick={() => setSelectedDrug(d)}>
                <ZapIcon size={20} color={colors.red} />
                <div>
                  <div style={{ ...styles.drugName, color: colors.red }}>{d.genericName}</div>
                  <div style={styles.drugClass}>{d.emergencyCard?.pearls?.[0] || d.pharmacologicalClass}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {activeTab === 'all' && (
          search ? (
            filtered.map(d => (
              <div key={d.id} style={styles.drugItem}
                onClick={() => setSelectedDrug(d)}
                onPointerEnter={e => e.currentTarget.style.background = colors.bg2}
                onPointerLeave={e => e.currentTarget.style.background = ''}>
                <div style={styles.drugIcon}>
                  <PillIcon size={18} color={colors.purple} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={styles.drugName}>{d.genericName}</span>
                    {d.whoEml && <span style={styles.drugWho}>WHO EML</span>}
                  </div>
                  <div style={styles.drugClass}>
                    {d.brandNames.slice(0, 2).join(', ')} — {d.pharmacologicalClass}
                  </div>
                </div>
              </div>
            ))
          ) : (
            Object.entries(categories).map(([cat, drugs]) => (
              <div key={cat}>
                <div style={styles.sectionTitle}>{cat} ({drugs.length})</div>
                {drugs.map(d => (
                  <div key={d.id} style={styles.drugItem}
                    onClick={() => setSelectedDrug(d)}
                    onPointerEnter={e => e.currentTarget.style.background = colors.bg2}
                    onPointerLeave={e => e.currentTarget.style.background = ''}>
                    <div style={styles.drugIcon}>
                      <PillIcon size={18} color={colors.purple} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={styles.drugName}>{d.genericName}</span>
                        {d.whoEml && <span style={styles.drugWho}>WHO EML</span>}
                      </div>
                      <div style={styles.drugClass}>
                        {d.brandNames.slice(0, 2).join(', ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
