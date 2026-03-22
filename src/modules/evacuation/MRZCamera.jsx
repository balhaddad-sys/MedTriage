// Camera Civil ID scanner — reads the 12-digit number from the front of the card
// Uses ML Kit (native) or TextDetector (web) for instant OCR
// Zero typing: point camera at card → number detected → patient added

import { useState, useRef, useCallback, useEffect } from 'react';
import { colors, fonts } from '../../design/tokens.js';
import { captureFrame, captureFrameAsync, recognizeCivilId, hasNativeOcr } from './civilIdCamera.js';
import { parseCivilIdNumber } from './nfcReader.js';

const styles = {
  container: { width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' },
  videoWrap: {
    width: '100%', aspectRatio: '1.586', borderRadius: '12px', overflow: 'hidden',
    position: 'relative', background: '#000',
  },
  video: { width: '100%', height: '100%', objectFit: 'cover' },
  overlay: {
    position: 'absolute', top: '15%', left: '5%', right: '5%', height: '30%',
    border: `2px dashed ${colors.blue}88`, borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  overlayText: {
    color: '#fff', fontSize: '12px', fontWeight: 700, padding: '4px 10px',
    background: 'rgba(0,0,0,0.6)', borderRadius: '6px',
  },
  canvas: { display: 'none' },
  statusText: { fontSize: '13px', fontWeight: 600, color: colors.text0, textAlign: 'center' },
  foundBox: {
    width: '100%', padding: '14px', borderRadius: '12px',
    background: colors.green + '15', border: `2px solid ${colors.green}`,
    textAlign: 'center',
  },
  civilIdText: {
    fontSize: '28px', fontWeight: 800, fontFamily: fonts.mono,
    color: colors.green, letterSpacing: '3px',
  },
  ageText: { fontSize: '14px', color: colors.text0, fontWeight: 600, marginTop: '4px' },
  btn: {
    width: '100%', height: '44px', border: 'none', borderRadius: '10px',
    fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: fonts.sans,
  },
};

export default function CivilIdCameraScanner({ onResult, onCancel, autoStart }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanRef = useRef(null);
  const [status, setStatus] = useState('Starting camera...');
  const [error, setError] = useState(null);
  const [found, setFound] = useState(null); // { civilId, age }
  const [scanning, setScanning] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const bestDataRef = useRef({});

  // Start camera
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus('Point camera at the front of the Civil ID card');
          setScanning(true);
        }
      } catch {
        if (mounted) setError('Camera access denied. Allow camera permission and try again.');
      }
    })();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (scanRef.current) clearInterval(scanRef.current);
    };
  }, []);

  // OCR scan loop
  useEffect(() => {
    if (!scanning || found) return;

    const scan = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const frame = await captureFrameAsync(video, canvas, 0.8);
      if (!frame) return;

      setFrameCount(c => c + 1);

      const result = await recognizeCivilId(frame);
      if (result.found && result.civilId) {
        const parsed = parseCivilIdNumber(result.civilId);
        if (parsed && parsed.age != null) {
          // Accumulate best data across frames — keep scanning for blood type
          const prev = bestDataRef.current;
          bestDataRef.current = {
            civilId: result.civilId,
            age: parsed.age,
            bloodType: result.bloodType || prev.bloodType || '',
            gender: result.gender || prev.gender || '',
            nameEn: result.nameEn || prev.nameEn || '',
            nameAr: result.nameAr || prev.nameAr || '',
            hits: (prev.hits || 0) + 1,
          };
          // Accept after 3 hits (enough frames to accumulate data) OR if blood type found
          const best = bestDataRef.current;
          if (best.hits >= 3 || best.bloodType) {
            setFound(best);
            setScanning(false);
            streamRef.current?.getTracks().forEach(t => t.stop());
            if (scanRef.current) clearInterval(scanRef.current);
          }
        }
      }
    };

    // Scan every 500ms
    scanRef.current = setInterval(scan, 500);
    return () => { if (scanRef.current) clearInterval(scanRef.current); };
  }, [scanning, found, onResult]);

  const [adding, setAdding] = useState(false);

  const handleAdd = useCallback(() => {
    if (!found || adding) return;
    setAdding(true);
    try {
      onResult({
        civilId: found.civilId, age: found.age, source: 'camera',
        bloodType: found.bloodType, gender: found.gender,
        nameEn: found.nameEn, nameAr: found.nameAr,
      });
    } catch (e) {
      console.error('Add patient error:', e);
      setAdding(false);
    }
  }, [found, adding, onResult]);

  if (found) {
    return (
      <div style={styles.container}>
        <div style={styles.foundBox}>
          <div style={styles.civilIdText}>{found.civilId}</div>
          <div style={styles.ageText}>Age: {found.age} years</div>
          {found.bloodType && <div style={styles.ageText}>Blood Type: <strong>{found.bloodType}</strong></div>}
          {found.nameEn && <div style={styles.ageText}>Name: {found.nameEn}</div>}
          {found.nameAr && <div style={{ ...styles.ageText, direction: 'rtl' }}>{found.nameAr}</div>}
          {found.gender && <div style={styles.ageText}>Gender: {found.gender === 'F' ? 'Female' : 'Male'}</div>}
        </div>
        <button
          style={{ ...styles.btn, background: adding ? colors.text3 : colors.green, color: '#fff', height: '56px', fontSize: '18px' }}
          onClick={handleAdd}
          disabled={adding}>
          {adding ? 'Adding...' : 'Add Patient'}
        </button>
        <button
          style={{ ...styles.btn, background: colors.bg2, color: colors.text0 }}
          onClick={() => { setFound(null); setScanning(true); }}>
          Scan Again
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.videoWrap}>
        <video ref={videoRef} style={styles.video} playsInline muted autoPlay />
        <div style={styles.overlay}>
          <span style={styles.overlayText}>
            Civil ID number area
          </span>
        </div>
      </div>
      <canvas ref={canvasRef} style={styles.canvas} />
      <span style={styles.statusText}>
        {error || `${status}${frameCount > 0 ? ` (scanning... ${frameCount})` : ''}`}
      </span>
      <button style={{ ...styles.btn, background: colors.bg2, color: colors.text3 }}
        onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
