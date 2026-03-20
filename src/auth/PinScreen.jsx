import React, { useState, useCallback } from 'react';
import { colors, fonts } from '../design/tokens.js';
import { ShieldIcon, HospitalIcon } from '../design/icons.jsx';

const DEFAULT_WARDS = [
  { id: 'a-male', name: 'A - Male', pin: '1234' },
  { id: 'a-female', name: 'A - Female', pin: '1234' },
  { id: 'b-male', name: 'B - Male', pin: '1234' },
  { id: 'b-female', name: 'B - Female', pin: '1234' },
  { id: 'icu', name: 'ICU', pin: '1234' },
  { id: 'er', name: 'Emergency', pin: '1234' },
  { id: 'ccu', name: 'CCU', pin: '1234' },
  { id: 'nicu', name: 'NICU', pin: '1234' },
];

const ADMIN_PIN = '999999';

const styles = {
  container: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '100%', background: colors.bg0, padding: '24px', gap: '32px',
  },
  logo: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
  },
  title: {
    fontSize: '32px', fontWeight: 800, color: colors.text0, letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '13px', color: colors.text2, textAlign: 'center',
  },
  wardGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px',
    width: '100%', maxWidth: '360px',
  },
  wardBtn: {
    padding: '14px 12px', borderRadius: '8px', border: `1px solid ${colors.border}`,
    background: colors.bg1, color: colors.text1, fontSize: '13px', fontWeight: 600,
    cursor: 'pointer', textAlign: 'center', fontFamily: fonts.sans,
    transition: 'all 150ms',
  },
  wardBtnActive: {
    background: colors.blue + '22', borderColor: colors.blue, color: colors.blue,
  },
  pinSection: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
    width: '100%', maxWidth: '280px',
  },
  pinDots: {
    display: 'flex', gap: '12px',
  },
  dot: {
    width: '14px', height: '14px', borderRadius: '50%',
    border: `2px solid ${colors.border}`, transition: 'all 150ms',
  },
  dotFilled: {
    background: colors.blue, borderColor: colors.blue,
  },
  numpad: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
    width: '100%',
  },
  numBtn: {
    height: '56px', borderRadius: '12px', border: 'none',
    background: colors.bg2, color: colors.text0, fontSize: '22px', fontWeight: 700,
    cursor: 'pointer', fontFamily: fonts.mono, transition: 'all 100ms',
  },
  numBtnPress: {
    transform: 'scale(0.97)',
  },
  error: {
    color: colors.red, fontSize: '13px', fontWeight: 600,
    animation: 'shake 400ms ease-out',
  },
};

export default function PinScreen({ onAuth }) {
  const [selectedWard, setSelectedWard] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleNum = useCallback((num) => {
    setError('');
    const newPin = pin + num;
    if (newPin.length <= 6) {
      setPin(newPin);
      // Auto-submit at 4 digits for ward, 6 for admin
      if (newPin.length === 4 && selectedWard) {
        const ward = DEFAULT_WARDS.find(w => w.id === selectedWard);
        if (ward && ward.pin === newPin) {
          onAuth({ ward: ward, pin: newPin, isAdmin: false });
        } else {
          setError('Incorrect PIN');
          setTimeout(() => setPin(''), 300);
        }
      } else if (newPin.length === 6) {
        if (newPin === ADMIN_PIN) {
          onAuth({ ward: selectedWard ? DEFAULT_WARDS.find(w => w.id === selectedWard) : DEFAULT_WARDS[0], pin: newPin, isAdmin: true });
        } else {
          setError('Incorrect Admin PIN');
          setTimeout(() => setPin(''), 300);
        }
      }
    }
  }, [pin, selectedWard, onAuth]);

  const handleDelete = useCallback(() => {
    setPin(p => p.slice(0, -1));
    setError('');
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.logo}>
        <HospitalIcon size={48} color={colors.red} />
        <div style={styles.title}>MedEvac</div>
        <div style={styles.subtitle}>
          Mubarak Al-Kabeer Hospital<br />
          Patient Evacuation Registry
        </div>
      </div>

      <div style={styles.wardGrid}>
        {DEFAULT_WARDS.map(ward => (
          <button
            key={ward.id}
            style={{ ...styles.wardBtn, ...(selectedWard === ward.id ? styles.wardBtnActive : {}) }}
            onClick={() => { setSelectedWard(ward.id); setPin(''); setError(''); }}
          >
            {ward.name}
          </button>
        ))}
      </div>

      {selectedWard && (
        <div style={styles.pinSection}>
          <div style={{ fontSize: '13px', color: colors.text2, fontWeight: 500 }}>
            Enter Ward PIN (4 digits) or Admin PIN (6 digits)
          </div>
          <div style={styles.pinDots}>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{
                ...styles.dot,
                ...(i < pin.length ? styles.dotFilled : {}),
                ...(i >= 4 ? { borderColor: colors.purple, ...(i < pin.length ? { background: colors.purple } : {}) } : {}),
              }} />
            ))}
          </div>
          {error && <div style={styles.error}>{error}</div>}
          <div style={styles.numpad}>
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} style={styles.numBtn}
                onClick={() => handleNum(String(n))}
                onPointerDown={e => e.target.style.transform = 'scale(0.97)'}
                onPointerUp={e => e.target.style.transform = ''}
              >{n}</button>
            ))}
            <div />
            <button style={styles.numBtn} onClick={() => handleNum('0')}
              onPointerDown={e => e.target.style.transform = 'scale(0.97)'}
              onPointerUp={e => e.target.style.transform = ''}
            >0</button>
            <button style={{ ...styles.numBtn, background: 'transparent', fontSize: '16px' }}
              onClick={handleDelete}>DEL</button>
          </div>
        </div>
      )}
    </div>
  );
}
