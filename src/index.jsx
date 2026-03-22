import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app.jsx';
import { processPatientListImage, preloadOcrModels } from './modules/evacuation/ocrEngine.js';

// Expose OCR engine for headless validation
window.processPatientListImage = processPatientListImage;
window.preloadOcrModels = preloadOcrModels;

// Error boundary for crash protection
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('MedEvac crash:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', background: '#0A0E14',
          color: '#F0F2F5', padding: '32px', textAlign: 'center', gap: '16px',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          <div style={{ fontSize: '48px', color: '#EF4444' }}>!</div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>System Error</h1>
          <p style={{ fontSize: '13px', color: '#8892A0', maxWidth: '300px' }}>
            MedEvac encountered an error. Patient data is safe in local storage.
          </p>
          <button onClick={() => window.location.reload()} style={{
            padding: '12px 32px', borderRadius: '8px', border: 'none',
            background: '#3B82F6', color: '#fff', fontSize: '14px',
            fontWeight: 700, cursor: 'pointer',
          }}>
            Reload Application
          </button>
          <details style={{ fontSize: '11px', color: '#5C6370', maxWidth: '300px' }}>
            <summary>Technical Details</summary>
            <pre style={{ whiteSpace: 'pre-wrap', marginTop: '8px' }}>
              {this.state.error?.toString()}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
