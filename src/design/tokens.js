// MedEvac Design Tokens — Operating Room Monitor Aesthetic
export const colors = {
  // Surfaces
  bg0: '#0A0E14',
  bg1: '#111318',
  bg2: '#191D24',
  bg3: '#22272F',

  // Borders
  border: '#2A2F38',
  borderLight: '#343A45',

  // Text hierarchy
  text0: '#F0F2F5',
  text1: '#C4CAD4',
  text2: '#8892A0',
  text3: '#5C6370',

  // Triage (SALT mapping)
  red: '#EF4444',
  yellow: '#FACC15',
  green: '#22C55E',
  gray: '#6B7280',
  black: '#18181B',

  // Evacuation status
  inWard: '#3B82F6',
  staged: '#A855F7',
  inTransit: '#F59E0B',
  evacuated: '#22C55E',

  // Functional
  blue: '#3B82F6',
  purple: '#A855F7',
  amber: '#F59E0B',
  teal: '#14B8A6',
};

export const triageColors = {
  RED: colors.red,
  YELLOW: colors.yellow,
  GREEN: colors.green,
  GRAY: colors.gray,
  BLACK: colors.black,
};

export const evacColors = {
  IN_WARD: colors.inWard,
  STAGED: colors.staged,
  IN_TRANSIT: colors.inTransit,
  EVACUATED: colors.evacuated,
  RETURNED: colors.amber,
  DECEASED: colors.black,
};

export const triageTextColors = {
  RED: '#FFFFFF',
  YELLOW: '#18181B',
  GREEN: '#FFFFFF',
  GRAY: '#FFFFFF',
  BLACK: '#6B7280',
};

export const fonts = {
  sans: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  mono: "'JetBrains Mono', monospace",
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
};

export const radii = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
};

export const animation = {
  fadeIn: '150ms ease-out',
  slideUp: '200ms ease-out',
  slideDown: '200ms ease-out',
  shake: '400ms ease-out',
};
