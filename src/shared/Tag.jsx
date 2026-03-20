import React from 'react';
import { colors, fonts } from '../design/tokens.js';

const styles = {
  base: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '2px 8px', borderRadius: '4px',
    fontSize: '10px', fontWeight: 700, fontFamily: fonts.mono,
    textTransform: 'uppercase', letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  },
};

export default function Tag({ label, color, bg, icon, style }) {
  return (
    <span style={{
      ...styles.base,
      color: color || colors.text0,
      background: bg || colors.bg3,
      ...style,
    }}>
      {icon}{label}
    </span>
  );
}

export function TriageTag({ triage }) {
  const triageConfig = {
    RED: { bg: colors.red + '33', color: colors.red, label: 'RED' },
    YELLOW: { bg: colors.yellow + '33', color: colors.yellow, label: 'YELLOW' },
    GREEN: { bg: colors.green + '33', color: colors.green, label: 'GREEN' },
    GRAY: { bg: colors.gray + '33', color: colors.gray, label: 'GRAY' },
    BLACK: { bg: colors.black, color: '#666', label: 'BLACK' },
  };
  const c = triageConfig[triage] || triageConfig.GREEN;
  return <Tag label={c.label} color={c.color} bg={c.bg} />;
}

export function EvacTag({ status }) {
  const evacConfig = {
    IN_WARD: { bg: colors.inWard + '33', color: colors.inWard, label: 'IN WARD' },
    STAGED: { bg: colors.staged + '33', color: colors.staged, label: 'STAGED' },
    IN_TRANSIT: { bg: colors.inTransit + '33', color: colors.inTransit, label: 'IN TRANSIT' },
    EVACUATED: { bg: colors.evacuated + '33', color: colors.evacuated, label: 'EVACUATED' },
    RETURNED: { bg: colors.amber + '33', color: colors.amber, label: 'RETURNED' },
    DECEASED: { bg: '#000', color: '#666', label: 'DECEASED' },
  };
  const c = evacConfig[status] || evacConfig.IN_WARD;
  return <Tag label={c.label} color={c.color} bg={c.bg} />;
}
