import React from 'react';

const I = ({ d, size = 20, color = 'currentColor', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

export const HospitalIcon = (props) => <I {...props} d={<>
  <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" />
  <path d="M9 9h1" /><path d="M9 13h1" /><path d="M9 17h1" />
</>} />;

export const PillIcon = (props) => <I {...props} d={<>
  <path d="M10.5 1.5l-8 8a4.95 4.95 0 007 7l8-8a4.95 4.95 0 00-7-7z" />
  <path d="M6.5 10.5l7-7" />
</>} />;

export const CalcIcon = (props) => <I {...props} d={<>
  <rect x="4" y="2" width="16" height="20" rx="2" />
  <path d="M8 6h8" /><path d="M8 10h8" /><path d="M8 14h4" /><path d="M8 18h4" />
</>} />;

export const AlertTriangle = (props) => <I {...props} d={<>
  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  <path d="M12 9v4" /><circle cx="12" cy="17" r="0.5" fill="currentColor" />
</>} />;

export const ChartIcon = (props) => <I {...props} d={<>
  <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
</>} />;

export const ChevronRight = (props) => <I {...props} d="M9 18l6-6-6-6" />;
export const ChevronLeft = (props) => <I {...props} d="M15 18l-6-6 6-6" />;
export const ChevronDown = (props) => <I {...props} d="M6 9l6 6 6-6" />;
export const ChevronUp = (props) => <I {...props} d="M18 15l-6-6-6 6" />;

export const SearchIcon = (props) => <I {...props} d={<>
  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
</>} />;

export const SyringeIcon = (props) => <I {...props} d={<>
  <path d="M18 2l4 4" /><path d="M17 7l-11 11" /><path d="M7.5 20.5L2 22l1.5-5.5" />
  <path d="M15 5l4 4" /><path d="M10 10l4 4" />
</>} />;

export const DropletIcon = (props) => <I {...props} d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />;

export const ShieldIcon = (props) => <I {...props} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />;

export const BedIcon = (props) => <I {...props} d={<>
  <path d="M2 4v16" /><path d="M2 8h18a2 2 0 012 2v10" /><path d="M2 17h20" />
  <path d="M6 8v-2a2 2 0 012-2h0a2 2 0 012 2v2" />
</>} />;

export const TruckIcon = (props) => <I {...props} d={<>
  <path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7V8z" />
  <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
</>} />;

export const WifiIcon = (props) => <I {...props} d={<>
  <path d="M5 12.55a11 11 0 0114.08 0" /><path d="M1.42 9a16 16 0 0121.16 0" />
  <path d="M8.53 16.11a6 6 0 016.95 0" /><circle cx="12" cy="20" r="1" fill="currentColor" />
</>} />;

export const WifiOffIcon = (props) => <I {...props} d={<>
  <path d="M1 1l22 22" /><path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
  <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
  <path d="M10.71 5.05A16 16 0 0122.56 9" /><path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
  <path d="M8.53 16.11a6 6 0 016.95 0" /><circle cx="12" cy="20" r="1" fill="currentColor" />
</>} />;

export const ClockIcon = (props) => <I {...props} d={<>
  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
</>} />;

export const ZapIcon = (props) => <I {...props} d="M13 2L3 14h9l-1 10 10-12h-9l1-10z" />;

export const UserIcon = (props) => <I {...props} d={<>
  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
  <circle cx="12" cy="7" r="4" />
</>} />;

export const CheckIcon = (props) => <I {...props} d="M20 6L9 17l-5-5" />;

export const PlusIcon = (props) => <I {...props} d={<><path d="M12 5v14" /><path d="M5 12h14" /></>} />;

export const XIcon = (props) => <I {...props} d={<><path d="M18 6L6 18" /><path d="M6 6l12 12" /></>} />;

export const BackIcon = (props) => <I {...props} d={<><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></>} />;

export const DeleteIcon = (props) => <I {...props} d={<>
  <path d="M3 6h18" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
</>} />;

export const BoxIcon = (props) => <I {...props} d={<>
  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
  <path d="M3.27 6.96L12 12.01l8.73-5.05" /><path d="M12 22.08V12" />
</>} />;

export const HeartIcon = (props) => <I {...props} d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />;

export const MenuIcon = (props) => <I {...props} d={<>
  <path d="M3 12h18" /><path d="M3 6h18" /><path d="M3 18h18" />
</>} />;

export const SettingsIcon = (props) => <I {...props} d={<>
  <circle cx="12" cy="12" r="3" />
  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
</>} />;

export const ProtocolIcon = (props) => <I {...props} d={<>
  <path d="M9 11l3 3L22 4" />
  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
</>} />;

export const ExportIcon = (props) => <I {...props} d={<>
  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
  <path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
</>} />;

export const CameraIcon = (props) => <I {...props} d={<>
  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
  <circle cx="12" cy="13" r="4" />
</>} />;
