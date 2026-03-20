import React, { useMemo } from 'react';
import { useApp } from '../../app.jsx';
import { colors, fonts, triageColors, evacColors } from '../../design/tokens.js';
import Modal from '../../shared/Modal.jsx';

const styles = {
  section: { marginBottom: '24px' },
  sectionTitle: { fontSize: '13px', fontWeight: 700, color: colors.text2, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' },
  stat: {
    background: colors.bg2, borderRadius: '8px', padding: '12px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
  },
  statValue: { fontSize: '24px', fontWeight: 800, fontFamily: fonts.mono },
  statLabel: { fontSize: '9px', fontWeight: 600, color: colors.text3, textTransform: 'uppercase' },
  triageBar: { display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginTop: '8px' },
  wardRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: `1px solid ${colors.border}`,
    fontSize: '13px',
  },
  actionBtn: {
    width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
    fontSize: '14px', fontWeight: 700, cursor: 'pointer',
    fontFamily: fonts.sans, marginBottom: '8px', transition: 'all 100ms',
  },
};

export default function CommandCenter({ onClose }) {
  const { patients, evacActive, setEvacActive, mciMode, setMciMode } = useApp();

  const stats = useMemo(() => {
    const triage = { RED: 0, YELLOW: 0, GREEN: 0, GRAY: 0, BLACK: 0 };
    const evac = { IN_WARD: 0, STAGED: 0, IN_TRANSIT: 0, EVACUATED: 0 };
    const wards = {};

    patients.forEach(p => {
      if (triage[p.triage] !== undefined) triage[p.triage]++;
      if (evac[p.evac] !== undefined) evac[p.evac]++;
      const w = p.ward || 'Unassigned';
      if (!wards[w]) wards[w] = { total: 0, evacuated: 0 };
      wards[w].total++;
      if (p.evac === 'EVACUATED') wards[w].evacuated++;
    });

    return { triage, evac, wards, total: patients.length };
  }, [patients]);

  const evacPct = stats.total > 0 ? Math.round((stats.evac.EVACUATED / stats.total) * 100) : 0;

  return (
    <Modal title="Command Center" onClose={onClose}>
      {/* Census */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Hospital Census</div>
        <div style={styles.statGrid}>
          <div style={styles.stat}>
            <span style={{ ...styles.statValue, color: colors.text0 }}>{stats.total}</span>
            <span style={styles.statLabel}>Total</span>
          </div>
          <div style={styles.stat}>
            <span style={{ ...styles.statValue, color: colors.red }}>{stats.triage.RED}</span>
            <span style={styles.statLabel}>Immediate</span>
          </div>
          <div style={styles.stat}>
            <span style={{ ...styles.statValue, color: colors.yellow }}>{stats.triage.YELLOW}</span>
            <span style={styles.statLabel}>Delayed</span>
          </div>
          <div style={styles.stat}>
            <span style={{ ...styles.statValue, color: colors.green }}>{stats.triage.GREEN}</span>
            <span style={styles.statLabel}>Minor</span>
          </div>
          <div style={styles.stat}>
            <span style={{ ...styles.statValue, color: colors.gray }}>{stats.triage.GRAY}</span>
            <span style={styles.statLabel}>Expectant</span>
          </div>
          <div style={styles.stat}>
            <span style={{ ...styles.statValue, color: '#666' }}>{stats.triage.BLACK}</span>
            <span style={styles.statLabel}>Deceased</span>
          </div>
        </div>
        {stats.total > 0 && (
          <div style={styles.triageBar}>
            {['RED', 'YELLOW', 'GREEN', 'GRAY', 'BLACK'].map(t => (
              stats.triage[t] > 0 ? (
                <div key={t} style={{
                  flex: stats.triage[t],
                  background: triageColors[t],
                }} />
              ) : null
            ))}
          </div>
        )}
      </div>

      {/* Evacuation Progress */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Evacuation Progress</div>
        <div style={styles.statGrid}>
          {Object.entries(stats.evac).map(([status, count]) => (
            <div key={status} style={styles.stat}>
              <span style={{ ...styles.statValue, color: evacColors[status] || colors.text1 }}>{count}</span>
              <span style={styles.statLabel}>{status.replace('_', ' ')}</span>
            </div>
          ))}
          <div style={styles.stat}>
            <span style={{ ...styles.statValue, color: colors.blue }}>{evacPct}%</span>
            <span style={styles.statLabel}>Complete</span>
          </div>
        </div>
        {stats.total > 0 && (
          <div style={{ ...styles.triageBar, marginTop: '8px' }}>
            <div style={{ flex: stats.evac.EVACUATED, background: colors.evacuated }} />
            <div style={{ flex: stats.total - stats.evac.EVACUATED, background: colors.bg3 }} />
          </div>
        )}
      </div>

      {/* Ward breakdown */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>By Ward</div>
        {Object.entries(stats.wards).map(([ward, data]) => (
          <div key={ward} style={styles.wardRow}>
            <span style={{ color: colors.text1, fontWeight: 600 }}>{ward}</span>
            <span style={{ fontFamily: fonts.mono, color: colors.text2, fontSize: '12px' }}>
              {data.evacuated}/{data.total} evac
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Actions</div>
        <button
          style={{ ...styles.actionBtn, background: evacActive ? colors.green + '22' : colors.red + '22', color: evacActive ? colors.green : colors.red }}
          onClick={() => setEvacActive(!evacActive)}
        >
          {evacActive ? 'Deactivate Evacuation' : 'Activate Evacuation'}
        </button>
        <button
          style={{ ...styles.actionBtn, background: mciMode ? colors.amber + '22' : colors.bg2, color: mciMode ? colors.amber : colors.text2 }}
          onClick={() => setMciMode(!mciMode)}
        >
          {mciMode ? 'Deactivate MCI Mode' : 'Activate MCI Mode'}
        </button>
        <button
          style={{ ...styles.actionBtn, background: colors.bg2, color: colors.text2 }}
          onClick={() => {
            const blob = new Blob(
              [JSON.stringify({ patients, exportedAt: new Date().toISOString() }, null, 2)],
              { type: 'application/json' }
            );
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `medevac-export-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export Patient Data (JSON)
        </button>
        <button
          style={{ ...styles.actionBtn, background: colors.bg2, color: colors.text2 }}
          onClick={() => {
            const header = 'Name,Age,Gender,Ward,Bed,Triage,Diagnosis,Evacuation,Mobility,O2,Isolation,Code';
            const rows = patients.map(p =>
              [p.fullName, p.age, p.gender, p.ward, p.bed, p.triage, p.dx, p.evac, p.mobility, p.o2, p.iso, p.code]
                .map(v => `"${(v || '').toString().replace(/"/g, '""')}"`)
                .join(',')
            );
            const csv = [header, ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `medevac-census-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export Ward Census (CSV)
        </button>
      </div>
    </Modal>
  );
}
