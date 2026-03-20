import React, { useState, useCallback, useMemo } from 'react';
import { colors, fonts } from '../../design/tokens.js';
import { BackIcon, ChevronRight, ChevronLeft, PillIcon, ClockIcon } from '../../design/icons.jsx';
import Timer from '../../shared/Timer.jsx';

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  header: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 16px', background: colors.bg1,
    borderBottom: `1px solid ${colors.border}`,
  },
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', color: colors.text2, padding: '4px' },
  title: { fontSize: '16px', fontWeight: 700, color: colors.text0 },
  progress: {
    display: 'flex', gap: '3px', padding: '8px 16px',
    background: colors.bg1, borderBottom: `1px solid ${colors.border}`,
  },
  progressDot: {
    flex: 1, height: '3px', borderRadius: '2px', transition: 'background 200ms',
  },
  content: { flex: 1, overflow: 'auto', padding: '20px 16px' },
  stepNum: {
    fontSize: '11px', fontWeight: 700, color: colors.blue,
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px',
  },
  stepTitle: { fontSize: '20px', fontWeight: 800, color: colors.text0, lineHeight: 1.2, marginBottom: '12px' },
  stepDesc: { fontSize: '14px', color: colors.text1, lineHeight: 1.5, marginBottom: '20px' },
  medBox: {
    background: colors.purple + '11', border: `1px solid ${colors.purple}33`,
    borderRadius: '10px', padding: '12px', marginBottom: '12px',
    display: 'flex', alignItems: 'flex-start', gap: '10px',
  },
  medDrug: { fontSize: '15px', fontWeight: 800, color: colors.purple },
  medDose: { fontSize: '13px', color: colors.text1, fontFamily: fonts.mono },
  medRoute: { fontSize: '11px', color: colors.text2 },
  warningBox: {
    background: colors.amber + '11', border: `1px solid ${colors.amber}33`,
    borderRadius: '10px', padding: '12px', marginBottom: '12px',
    fontSize: '13px', color: colors.amber,
  },
  optionBtn: {
    width: '100%', padding: '16px', borderRadius: '10px', marginBottom: '8px',
    border: `1px solid ${colors.border}`, background: colors.bg2,
    color: colors.text0, fontSize: '15px', fontWeight: 700,
    cursor: 'pointer', textAlign: 'left', fontFamily: fonts.sans,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    transition: 'all 100ms',
  },
  navRow: {
    display: 'flex', gap: '8px', padding: '12px 16px',
    background: colors.bg1, borderTop: `1px solid ${colors.border}`,
  },
  navBtn: {
    flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
    fontSize: '14px', fontWeight: 700, cursor: 'pointer',
    fontFamily: fonts.sans, display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: '4px', transition: 'all 100ms',
  },
  medTally: {
    background: colors.bg1, borderRadius: '8px', padding: '10px 12px',
    border: `1px solid ${colors.border}`, marginBottom: '16px',
  },
  tallyTitle: { fontSize: '10px', fontWeight: 700, color: colors.text3, textTransform: 'uppercase', marginBottom: '6px' },
  tallyItem: { fontSize: '12px', color: colors.purple, fontFamily: fonts.mono, padding: '2px 0' },
  loopCount: {
    background: colors.blue + '22', borderRadius: '8px', padding: '8px 12px',
    marginBottom: '12px', fontSize: '13px', fontWeight: 700, color: colors.blue,
    textAlign: 'center', fontFamily: fonts.mono,
  },
};

export default function ProtoWalkthrough({ protocol, onBack }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [history, setHistory] = useState([{ stepIdx: 0, time: Date.now() }]);
  const [medsGiven, setMedsGiven] = useState([]);
  const [loopCount, setLoopCount] = useState(0);
  const [showTimer, setShowTimer] = useState(false);

  const step = protocol.steps[stepIdx];
  const totalSteps = protocol.steps.length;

  const goToStep = useCallback((idx, choice) => {
    if (idx < 0 || idx >= totalSteps) return;
    // Detect loops
    if (idx <= stepIdx) setLoopCount(c => c + 1);
    setHistory(h => [...h, { stepIdx: idx, time: Date.now(), choice }]);
    setStepIdx(idx);
  }, [stepIdx, totalSteps]);

  const goBack = useCallback(() => {
    if (history.length <= 1) return;
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);
    setStepIdx(newHistory[newHistory.length - 1].stepIdx);
  }, [history]);

  const addMed = useCallback((med) => {
    setMedsGiven(m => [...m, { ...med, time: new Date().toISOString() }]);
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={onBack}><BackIcon size={20} /></button>
        <div>
          <div style={styles.title}>{protocol.name}</div>
          <div style={{ fontSize: '11px', color: colors.text2 }}>Step {stepIdx + 1} of {totalSteps}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={styles.progress}>
        {protocol.steps.map((_, i) => (
          <div key={i} style={{
            ...styles.progressDot,
            background: i < stepIdx ? colors.blue : i === stepIdx ? colors.blue : colors.bg3,
          }} />
        ))}
      </div>

      <div style={styles.content}>
        {/* Loop counter */}
        {loopCount > 0 && (
          <div style={styles.loopCount}>Cycle {loopCount + 1}</div>
        )}

        {/* Medication tally */}
        {medsGiven.length > 0 && (
          <div style={styles.medTally}>
            <div style={styles.tallyTitle}>Medications Given</div>
            {medsGiven.map((m, i) => (
              <div key={i} style={styles.tallyItem}>
                {m.drug} {m.dose} {m.route} — {new Date(m.time).toLocaleTimeString()}
              </div>
            ))}
          </div>
        )}

        {/* Step content */}
        <div style={styles.stepNum}>Step {stepIdx + 1}</div>
        <div style={styles.stepTitle}>{step.title}</div>
        {step.description && <div style={styles.stepDesc}>{step.description}</div>}

        {/* Warning */}
        {step.warning && <div style={styles.warningBox}>{step.warning}</div>}

        {/* Medication */}
        {step.medication && (
          <div style={styles.medBox}>
            <PillIcon size={20} color={colors.purple} />
            <div>
              <div style={styles.medDrug}>{step.medication.drug}</div>
              <div style={styles.medDose}>{step.medication.dose}</div>
              <div style={styles.medRoute}>{step.medication.route}</div>
              <button
                onClick={() => addMed(step.medication)}
                style={{
                  marginTop: '8px', padding: '6px 14px', borderRadius: '6px',
                  border: `1px solid ${colors.purple}44`, background: colors.purple + '22',
                  color: colors.purple, fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  fontFamily: fonts.sans,
                }}>
                Mark Given
              </button>
            </div>
          </div>
        )}

        {/* Timer */}
        {step.timer && (
          showTimer ? (
            <Timer duration={step.timer} label={step.timerLabel || 'Timer'} autoStart />
          ) : (
            <button onClick={() => setShowTimer(true)} style={{
              ...styles.optionBtn, justifyContent: 'center', gap: '8px',
              background: colors.amber + '11', borderColor: colors.amber + '33', color: colors.amber,
            }}>
              <ClockIcon size={18} color={colors.amber} />
              Start {step.timerLabel || 'Timer'} ({step.timer}s)
            </button>
          )
        )}

        {/* Decision options */}
        {step.options && step.options.map((opt, i) => (
          <button key={i} style={{
            ...styles.optionBtn,
            ...(opt.color ? { borderColor: colors[opt.color] + '44', background: colors[opt.color] + '11', color: colors[opt.color] || colors.text0 } : {}),
          }}
            onClick={() => goToStep(opt.nextStep, opt.label)}
            onPointerDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
            onPointerUp={e => e.currentTarget.style.transform = ''}>
            {opt.label}
            <ChevronRight size={16} />
          </button>
        ))}

        {/* Auto-advance (no options = continue to next) */}
        {!step.options && stepIdx < totalSteps - 1 && (
          <button style={{
            ...styles.optionBtn, justifyContent: 'center',
            background: colors.blue, borderColor: colors.blue, color: '#fff',
          }}
            onClick={() => goToStep(stepIdx + 1)}>
            Continue
            <ChevronRight size={16} color="#fff" />
          </button>
        )}

        {/* End step */}
        {step.isEnd && (
          <div style={{
            textAlign: 'center', padding: '24px',
            background: colors.green + '11', borderRadius: '10px',
            border: `1px solid ${colors.green}33`,
          }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: colors.green }}>Protocol Complete</div>
            <div style={{ fontSize: '12px', color: colors.text2, marginTop: '4px' }}>{step.endMessage || 'Reassess patient and document.'}</div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={styles.navRow}>
        <button style={{
          ...styles.navBtn, background: colors.bg2, color: colors.text2,
          ...(history.length <= 1 ? { opacity: 0.3, pointerEvents: 'none' } : {}),
        }} onClick={goBack}>
          <ChevronLeft size={16} /> Back
        </button>
        <button style={{ ...styles.navBtn, background: colors.bg2, color: colors.text2 }}
          onClick={onBack}>
          Exit Protocol
        </button>
      </div>
    </div>
  );
}
