import React, { useState } from 'react';
import { colors, fonts } from '../../design/tokens.js';
import { BackIcon, AlertTriangle, ZapIcon } from '../../design/icons.jsx';

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  header: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 16px', background: colors.bg1,
    borderBottom: `1px solid ${colors.border}`,
  },
  backBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
    color: colors.text2,
  },
  name: { fontSize: '18px', fontWeight: 800, color: colors.text0 },
  brands: { fontSize: '12px', color: colors.text2 },
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
  section: { marginBottom: '20px' },
  sectionTitle: {
    fontSize: '11px', fontWeight: 700, color: colors.text3,
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px',
  },
  item: {
    fontSize: '13px', color: colors.text1, padding: '4px 0',
    borderBottom: `1px solid ${colors.border}08`,
  },
  dosingCard: {
    background: colors.bg2, borderRadius: '8px', padding: '12px',
    marginBottom: '8px',
  },
  dosingLabel: { fontSize: '10px', fontWeight: 700, color: colors.text3, textTransform: 'uppercase' },
  dosingValue: { fontSize: '13px', color: colors.text0, fontFamily: fonts.mono, marginTop: '4px' },
  warningBox: {
    background: colors.amber + '11', border: `1px solid ${colors.amber}33`,
    borderRadius: '8px', padding: '10px 12px', marginBottom: '6px',
    display: 'flex', gap: '8px', alignItems: 'flex-start',
  },
  emergencyCard: {
    background: colors.red + '11', border: `2px solid ${colors.red}44`,
    borderRadius: '12px', padding: '16px',
  },
  emergencyDose: {
    fontSize: '24px', fontWeight: 800, color: colors.red,
    fontFamily: fonts.mono, lineHeight: 1.2,
  },
  emergencyLabel: { fontSize: '10px', fontWeight: 700, color: colors.text3, marginTop: '8px', textTransform: 'uppercase' },
  emergencyValue: { fontSize: '14px', color: colors.text0, fontFamily: fonts.mono },
};

const TABS = ['Dosing', 'Warnings', 'Interactions', 'Info'];

export default function DrugMonograph({ drug, onBack }) {
  const [tab, setTab] = useState(drug.emergencyCard ? 'Emergency' : 'Dosing');
  const tabList = drug.emergencyCard ? ['Emergency', ...TABS] : TABS;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}><BackIcon size={20} /></button>
        <div>
          <div style={styles.name}>{drug.genericName}</div>
          <div style={styles.brands}>
            {drug.brandNames.join(', ')} — {drug.pharmacologicalClass}
          </div>
        </div>
      </div>

      <div style={styles.tabs}>
        {tabList.map(t => (
          <button key={t}
            style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
            onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div style={styles.content}>
        {tab === 'Emergency' && drug.emergencyCard && (
          <div style={styles.emergencyCard}>
            {drug.emergencyCard.cardiacArrestDose && (
              <div style={{ marginBottom: '16px' }}>
                <div style={styles.emergencyLabel}>Cardiac Arrest Dose</div>
                <div style={styles.emergencyDose}>{drug.emergencyCard.cardiacArrestDose}</div>
              </div>
            )}
            {drug.emergencyCard.anaphylaxisDose && (
              <div style={{ marginBottom: '16px' }}>
                <div style={styles.emergencyLabel}>Anaphylaxis Dose</div>
                <div style={styles.emergencyDose}>{drug.emergencyCard.anaphylaxisDose}</div>
              </div>
            )}
            {drug.emergencyCard.infusionRate && (
              <div style={{ marginBottom: '12px' }}>
                <div style={styles.emergencyLabel}>Infusion Rate</div>
                <div style={styles.emergencyValue}>{drug.emergencyCard.infusionRate}</div>
              </div>
            )}
            {drug.emergencyCard.dilutionInstructions && (
              <div style={{ marginBottom: '12px' }}>
                <div style={styles.emergencyLabel}>Dilution</div>
                <div style={styles.emergencyValue}>{drug.emergencyCard.dilutionInstructions}</div>
              </div>
            )}
            {drug.emergencyCard.pearls?.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div style={styles.emergencyLabel}>Clinical Pearls</div>
                {drug.emergencyCard.pearls.map((p, i) => (
                  <div key={i} style={{ ...styles.emergencyValue, fontSize: '12px', marginTop: '4px' }}>
                    {p}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'Dosing' && (
          <div style={styles.section}>
            {drug.dosing.map((d, i) => (
              <div key={i} style={styles.dosingCard}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: colors.blue, marginBottom: '8px' }}>
                  {d.indication}
                </div>
                {d.adult && <><div style={styles.dosingLabel}>Adult</div><div style={styles.dosingValue}>{d.adult}</div></>}
                {d.pediatric && <><div style={{ ...styles.dosingLabel, marginTop: '8px' }}>Pediatric</div><div style={styles.dosingValue}>{d.pediatric}</div></>}
                {d.renalAdjustment && (
                  <div style={{ marginTop: '8px', padding: '6px 8px', background: colors.amber + '11', borderRadius: '6px' }}>
                    <div style={{ ...styles.dosingLabel, color: colors.amber }}>Renal Adjustment</div>
                    <div style={{ ...styles.dosingValue, fontSize: '12px' }}>{d.renalAdjustment}</div>
                  </div>
                )}
                {d.hepaticAdjustment && (
                  <div style={{ marginTop: '8px', padding: '6px 8px', background: colors.amber + '11', borderRadius: '6px' }}>
                    <div style={{ ...styles.dosingLabel, color: colors.amber }}>Hepatic Adjustment</div>
                    <div style={{ ...styles.dosingValue, fontSize: '12px' }}>{d.hepaticAdjustment}</div>
                  </div>
                )}
                {d.maxDose && <div style={{ ...styles.dosingLabel, marginTop: '6px' }}>Max: <span style={{ color: colors.text1 }}>{d.maxDose}</span></div>}
                <div style={{ fontSize: '11px', color: colors.text3, marginTop: '4px' }}>{d.route} — {d.frequency}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Warnings' && (
          <>
            {drug.contraindications?.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Contraindications</div>
                {drug.contraindications.map((c, i) => (
                  <div key={i} style={styles.warningBox}>
                    <AlertTriangle size={14} color={colors.red} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span style={{ fontSize: '12px', color: colors.red }}>{c}</span>
                  </div>
                ))}
              </div>
            )}
            {drug.warnings?.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Warnings</div>
                {drug.warnings.map((w, i) => (
                  <div key={i} style={styles.warningBox}>
                    <AlertTriangle size={14} color={colors.amber} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span style={{ fontSize: '12px', color: colors.amber }}>{w}</span>
                  </div>
                ))}
              </div>
            )}
            {drug.sideEffects && (
              <>
                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Serious Side Effects</div>
                  {drug.sideEffects.serious?.map((s, i) => (
                    <div key={i} style={styles.item}>{s}</div>
                  ))}
                </div>
                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Common Side Effects</div>
                  {drug.sideEffects.common?.map((s, i) => (
                    <div key={i} style={styles.item}>{s}</div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'Interactions' && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Drug Interactions</div>
            {drug.interactions?.length > 0 ? drug.interactions.map((inter, i) => (
              <div key={i} style={{
                ...styles.dosingCard,
                borderLeft: `3px solid ${inter.severity === 'Contraindicated' ? colors.red : inter.severity === 'Major' ? colors.amber : colors.yellow}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: colors.text0 }}>{inter.drug}</span>
                  <span style={{
                    fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '3px',
                    background: inter.severity === 'Contraindicated' ? colors.red + '22' : colors.amber + '22',
                    color: inter.severity === 'Contraindicated' ? colors.red : colors.amber,
                  }}>{inter.severity}</span>
                </div>
                <div style={{ fontSize: '12px', color: colors.text2, marginTop: '4px' }}>{inter.mechanism}</div>
                <div style={{ fontSize: '12px', color: colors.text1, marginTop: '4px' }}>{inter.management}</div>
              </div>
            )) : (
              <div style={{ fontSize: '13px', color: colors.text3, textAlign: 'center', padding: '24px' }}>
                No interactions documented
              </div>
            )}
          </div>
        )}

        {tab === 'Info' && (
          <>
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Indications</div>
              {drug.indications?.map((ind, i) => <div key={i} style={styles.item}>{ind}</div>)}
            </div>
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Formulations</div>
              {drug.formulations?.map((f, i) => <div key={i} style={styles.item}>{f}</div>)}
            </div>
            {drug.atcCode && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>ATC Code</div>
                <div style={{ ...styles.item, fontFamily: fonts.mono }}>{drug.atcCode}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
