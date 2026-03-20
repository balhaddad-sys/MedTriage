import React, { useState, useEffect, useCallback, useRef } from 'react';
import { colors, fonts } from '../design/tokens.js';

export default function Timer({ duration = 120, onComplete, label = 'CPR Timer', autoStart = false }) {
  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(autoStart);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            onComplete?.();
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, remaining, onComplete]);

  const toggle = useCallback(() => {
    if (remaining === 0) {
      setRemaining(duration);
      setRunning(true);
    } else {
      setRunning(r => !r);
    }
  }, [remaining, duration]);

  const reset = useCallback(() => {
    setRemaining(duration);
    setRunning(false);
  }, [duration]);

  const pct = remaining / duration;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timerColor = pct > 0.5 ? colors.green : pct > 0.2 ? colors.amber : colors.red;

  return (
    <div style={{
      background: colors.bg2, borderRadius: '12px', padding: '16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
    }}>
      <div style={{ fontSize: '12px', color: colors.text2, fontWeight: 600 }}>{label}</div>
      <div style={{
        fontSize: '48px', fontWeight: 800, fontFamily: fonts.mono,
        color: timerColor, lineHeight: 1,
      }}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </div>
      <div style={{
        width: '100%', height: '4px', background: colors.bg3, borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct * 100}%`, height: '100%', background: timerColor,
          transition: 'width 1s linear, background 500ms',
        }} />
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={toggle} style={{
          padding: '10px 24px', borderRadius: '8px', border: 'none',
          background: running ? colors.amber : colors.blue,
          color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
          fontFamily: fonts.sans,
        }}>
          {remaining === 0 ? 'Restart' : running ? 'Pause' : 'Start'}
        </button>
        <button onClick={reset} style={{
          padding: '10px 16px', borderRadius: '8px',
          border: `1px solid ${colors.border}`, background: 'transparent',
          color: colors.text2, fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          fontFamily: fonts.sans,
        }}>Reset</button>
      </div>
    </div>
  );
}
