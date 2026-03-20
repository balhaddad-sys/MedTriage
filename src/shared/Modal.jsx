import React, { useEffect, useCallback } from 'react';
import { colors } from '../design/tokens.js';
import { XIcon } from '../design/icons.jsx';

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 1000, animation: 'fadeIn 150ms ease-out',
  },
  content: {
    background: colors.bg1, borderRadius: '16px 16px 0 0',
    width: '100%', maxWidth: '500px', maxHeight: '90vh',
    overflow: 'auto', animation: 'slideUp 200ms ease-out',
    paddingBottom: 'env(safe-area-inset-bottom, 0)',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: `1px solid ${colors.border}`,
    position: 'sticky', top: 0, background: colors.bg1, zIndex: 1,
  },
  title: {
    fontSize: '16px', fontWeight: 700, color: colors.text0,
  },
  closeBtn: {
    background: 'none', border: 'none', color: colors.text2,
    cursor: 'pointer', padding: '4px', borderRadius: '6px',
  },
  body: {
    padding: '20px',
  },
};

export default function Modal({ title, children, onClose, noPad }) {
  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose?.();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  return (
    <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
      <div style={styles.content}>
        {title && (
          <div style={styles.header}>
            <span style={styles.title}>{title}</span>
            {onClose && (
              <button style={styles.closeBtn} onClick={onClose}>
                <XIcon size={20} />
              </button>
            )}
          </div>
        )}
        <div style={noPad ? {} : styles.body}>{children}</div>
      </div>
    </div>
  );
}
