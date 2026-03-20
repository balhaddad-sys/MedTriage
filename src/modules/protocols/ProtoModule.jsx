import React, { useState, useMemo } from 'react';
import { colors, fonts } from '../../design/tokens.js';
import { SearchIcon, ProtocolIcon, ChevronRight, BackIcon, ZapIcon } from '../../design/icons.jsx';
import ProtoWalkthrough from './ProtoWalkthrough.jsx';
import { PROTOCOLS } from './protoData.js';

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
    textTransform: 'uppercase', letterSpacing: '0.5px', padding: '12px 0 6px',
  },
  protoItem: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px', borderRadius: '8px', cursor: 'pointer',
    transition: 'background 100ms',
  },
  protoIcon: {
    width: '36px', height: '36px', borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  protoName: { fontSize: '14px', fontWeight: 700, color: colors.text0 },
  protoDesc: { fontSize: '11px', color: colors.text2, marginTop: '2px' },
};

const catColors = {
  'ACLS': colors.red,
  'BLS': colors.red,
  'Emergency Medicine': colors.amber,
  'Toxicology': colors.purple,
  'Trauma': colors.red,
};

export default function ProtoModule() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const categories = useMemo(() => {
    const cats = {};
    const list = search
      ? PROTOCOLS.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()))
      : PROTOCOLS;
    list.forEach(p => {
      if (!cats[p.category]) cats[p.category] = [];
      cats[p.category].push(p);
    });
    return cats;
  }, [search]);

  if (selected) {
    return <ProtoWalkthrough protocol={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div style={styles.container}>
      <div style={styles.searchBar}>
        <div style={styles.searchWrap}>
          <SearchIcon size={16} color={colors.text3}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input style={styles.searchInput}
            placeholder="Search protocols..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div style={styles.list}>
        {Object.entries(categories).map(([cat, protos]) => (
          <div key={cat}>
            <div style={styles.catTitle}>{cat}</div>
            {protos.map(p => (
              <div key={p.id} style={styles.protoItem}
                onClick={() => setSelected(p)}
                onPointerEnter={e => e.currentTarget.style.background = colors.bg2}
                onPointerLeave={e => e.currentTarget.style.background = ''}>
                <div style={{ ...styles.protoIcon, background: (catColors[cat] || colors.blue) + '22' }}>
                  {cat.includes('Trauma') ? <ZapIcon size={18} color={catColors[cat] || colors.blue} /> :
                    <ProtocolIcon size={18} color={catColors[cat] || colors.blue} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.protoName}>{p.name}</div>
                  <div style={styles.protoDesc}>{p.description}</div>
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
