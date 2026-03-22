// Camera MRZ scanner — reads the 3-line MRZ from the back of a Kuwait Civil ID (TD1)
// Uses ML Kit (native) or TextDetector (web) for OCR, then parses with mrzParser
// Flow: point camera at back of card → MRZ detected → parsed → BAC key ready for NFC

import { useState, useRef, useCallback, useEffect } from 'react';
import { colors, fonts } from '../../design/tokens.js';
import { captureFrameAsync, recognizeMRZ } from './civilIdCamera.js';
import { parseTD1, validateMRZ } from './mrzParser.js';
import { startSession, logFrame, logAccepted, logCorrected, flushSession, getStats, exportAsJSON, exportAsCSV } from './mrzDataCollector.js';

const styles = {
  container: { width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' },
  videoWrap: {
    width: '100%', aspectRatio: '1.586', borderRadius: '12px', overflow: 'hidden',
    position: 'relative', background: '#000',
  },
  video: { width: '100%', height: '100%', objectFit: 'cover' },
  overlay: {
    position: 'absolute', bottom: '8%', left: '5%', right: '5%', height: '35%',
    border: `2px dashed ${colors.amber}88`, borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  overlayText: {
    color: '#fff', fontSize: '11px', fontWeight: 700, padding: '4px 10px',
    background: 'rgba(0,0,0,0.6)', borderRadius: '6px', textAlign: 'center',
    lineHeight: 1.4,
  },
  canvas: { display: 'none' },
  statusText: { fontSize: '13px', fontWeight: 600, color: colors.text0, textAlign: 'center' },
  foundBox: {
    width: '100%', padding: '14px', borderRadius: '12px',
    background: colors.green + '15', border: `2px solid ${colors.green}`,
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  mrzLine: {
    fontSize: '11px', fontWeight: 700, fontFamily: fonts.mono,
    color: colors.green, letterSpacing: '1.5px', wordBreak: 'break-all',
  },
  fieldRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '2px 0',
  },
  fieldLabel: { fontSize: '11px', fontWeight: 700, color: colors.text3, textTransform: 'uppercase' },
  fieldValue: { fontSize: '14px', fontWeight: 600, color: colors.text0 },
  btn: {
    width: '100%', height: '44px', border: 'none', borderRadius: '10px',
    fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: fonts.sans,
  },
  manualWrap: {
    width: '100%', display: 'flex', flexDirection: 'column', gap: '6px',
  },
  textarea: {
    width: '100%', height: '90px', padding: '10px', borderRadius: '8px',
    border: `1px solid ${colors.border}`, background: colors.bg2,
    color: colors.text0, fontSize: '12px', fontFamily: fonts.mono,
    resize: 'none', outline: 'none', letterSpacing: '1px',
  },
};

export default function MRZScannerCamera({ onResult, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanRef = useRef(null);
  const [status, setStatus] = useState('Starting camera...');
  const [error, setError] = useState(null);
  const [found, setFound] = useState(null); // parsed MRZ result
  const [mrzLines, setMrzLines] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [lastOcrText, setLastOcrText] = useState(''); // debug: raw OCR output
  const [bestScores, setBestScores] = useState([0, 0, 0]);
  const bestRef = useRef({ lines: null, score: 0, parsed: null }); // best across frames
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState('');
  const [manualError, setManualError] = useState('');
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionText, setCorrectionText] = useState('');

  // Start data collection session on mount
  useEffect(() => {
    startSession();
    return () => flushSession();
  }, []);

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
          setStatus('Point camera at the BACK of the Civil ID card');
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

  // Warmup: don't start OCR until user has time to position card
  const WARMUP_FRAMES = 5; // skip first ~3 seconds (5 frames × 600ms)

  // OCR scan loop for MRZ — never auto-accepts, only tracks best result
  useEffect(() => {
    if (!scanning || found) return;

    const scan = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      setFrameCount(c => {
        const next = c + 1;
        // During warmup, don't run OCR — just count
        if (next <= WARMUP_FRAMES) {
          setStatus(`Position card... starting scan in ${WARMUP_FRAMES - next + 1}`);
        }
        return next;
      });

      // Skip OCR during warmup
      if (frameCount < WARMUP_FRAMES) return;

      const frame = await captureFrameAsync(video, canvas, 0.85);
      if (!frame) return;

      setStatus('Scanning MRZ...');

      const result = await recognizeMRZ(frame);
      logFrame(result); // collect training data
      if (result.fullText) setLastOcrText(result.fullText);
      if (result.scores) setBestScores(prev =>
        result.scores.map((s, i) => Math.max(s, prev[i] || 0))
      );

      if (result.found && result.lines.length === 3) {
        const parsed = parseTD1(result.lines[0], result.lines[1], result.lines[2]);
        const totalScore = (result.scores || [0,0,0]).reduce((a,b) => a+b, 0);

        // Track best result across frames (never auto-accept)
        if (parsed && parsed.documentNumber && totalScore > bestRef.current.score) {
          bestRef.current = { lines: result.lines, score: totalScore, parsed };
        }
      }
    };

    scanRef.current = setInterval(scan, 600);
    return () => { if (scanRef.current) clearInterval(scanRef.current); };
  }, [scanning, found, frameCount]);

  // Handle manual MRZ entry
  const handleManualParse = useCallback(() => {
    setManualError('');
    const validation = validateMRZ(manualText);
    if (!validation.valid) {
      setManualError(validation.error);
      return;
    }
    const parsed = parseTD1(validation.lines[0], validation.lines[1], validation.lines[2]);
    if (!parsed || !parsed.documentNumber) {
      setManualError('Could not parse MRZ — check the text and try again');
      return;
    }
    setMrzLines(validation.lines);
    setFound(parsed);
    setScanning(false);
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (scanRef.current) clearInterval(scanRef.current);
  }, [manualText]);

  const handleConfirm = useCallback(() => {
    if (!found) return;
    logAccepted(mrzLines, found);
    flushSession();
    onResult(found);
  }, [found, mrzLines, onResult]);

  // Save a manual correction as ground truth
  const handleSaveCorrection = useCallback(() => {
    const validation = validateMRZ(correctionText);
    if (!validation.valid) return;
    const parsed = parseTD1(validation.lines[0], validation.lines[1], validation.lines[2]);
    if (!parsed) return;
    logAccepted(mrzLines, found); // log what OCR gave
    logCorrected(validation.lines, parsed); // log the true value
    flushSession();
    // Use the corrected data instead
    onResult(parsed);
  }, [correctionText, mrzLines, found, onResult]);

  // Result view — MRZ parsed
  if (found) {
    return (
      <div style={styles.container}>
        <div style={styles.foundBox}>
          {mrzLines && mrzLines.map((line, i) => (
            <div key={i} style={styles.mrzLine}>{line}</div>
          ))}
          <div style={{ height: '8px' }} />
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>Name</span>
            <span style={styles.fieldValue}>{found.fullName}</span>
          </div>
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>Doc Number</span>
            <span style={{ ...styles.fieldValue, fontFamily: fonts.mono }}>{found.documentNumber}</span>
          </div>
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>DOB</span>
            <span style={styles.fieldValue}>
              {found.dateOfBirth?.toLocaleDateString()} (age {found.age})
            </span>
          </div>
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>Gender</span>
            <span style={styles.fieldValue}>{found.sex === 'F' ? 'Female' : 'Male'}</span>
          </div>
          <div style={styles.fieldRow}>
            <span style={styles.fieldLabel}>Nationality</span>
            <span style={styles.fieldValue}>{found.nationality || found.issuingState}</span>
          </div>
          {found.errors?.length > 0 && (
            <div style={{ fontSize: '11px', color: colors.amber, marginTop: '4px' }}>
              Warnings: {found.errors.join(', ')}
            </div>
          )}
        </div>
        <button
          style={{ ...styles.btn, background: colors.green, color: '#fff', height: '56px', fontSize: '18px' }}
          onClick={handleConfirm}>
          Use MRZ for Chip Authentication
        </button>

        {/* Correction UI — user can fix misread MRZ for training data */}
        {!showCorrection ? (
          <button
            style={{ ...styles.btn, background: colors.amber + '22', color: colors.amber, height: '38px', fontSize: '12px' }}
            onClick={() => { setShowCorrection(true); setCorrectionText(mrzLines ? mrzLines.join('\n') : ''); }}>
            MRZ wrong? Tap to correct
          </button>
        ) : (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: colors.amber }}>
              Edit the 3 MRZ lines to match the card exactly:
            </span>
            <textarea
              style={styles.textarea}
              value={correctionText}
              onChange={e => setCorrectionText(e.target.value.toUpperCase())}
            />
            <button
              style={{ ...styles.btn, background: colors.amber, color: '#000', height: '40px', fontSize: '13px' }}
              onClick={handleSaveCorrection}>
              Save Correction & Use
            </button>
          </div>
        )}

        <button
          style={{ ...styles.btn, background: colors.bg2, color: colors.text0 }}
          onClick={() => { setFound(null); setMrzLines(null); setShowCorrection(false); setScanning(true); }}>
          Scan Again
        </button>
      </div>
    );
  }

  // Manual entry view
  if (showManual) {
    return (
      <div style={styles.container}>
        <div style={styles.manualWrap}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: colors.text0 }}>
            Type or paste the 3 MRZ lines from the back of the card:
          </span>
          <textarea
            style={styles.textarea}
            placeholder={'IDKWT289012345<<<<<<<<<<<<<\n9001011M3001019KWT<<<<<<<<0\nAL<HADDAD<<BADER<<<<<<<<<<<<'}
            value={manualText}
            onChange={e => { setManualText(e.target.value); setManualError(''); }}
          />
          {manualError && (
            <span style={{ fontSize: '12px', color: colors.red, fontWeight: 600 }}>{manualError}</span>
          )}
          <button
            style={{ ...styles.btn, background: manualText.trim() ? colors.green : colors.bg2, color: manualText.trim() ? '#fff' : colors.text3 }}
            onClick={handleManualParse}
            disabled={!manualText.trim()}>
            Parse MRZ
          </button>
          <button
            style={{ ...styles.btn, background: colors.bg2, color: colors.text0 }}
            onClick={() => setShowManual(false)}>
            Back to Camera
          </button>
        </div>
        <button style={{ ...styles.btn, background: colors.bg2, color: colors.text3 }} onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }

  // Camera scan view
  return (
    <div style={styles.container}>
      <div style={styles.videoWrap}>
        <video ref={videoRef} style={styles.video} playsInline muted autoPlay />
        <div style={styles.overlay}>
          <span style={styles.overlayText}>
            MRZ area (3 lines of text)<br />
            Flip card to BACK side
          </span>
        </div>
      </div>
      <canvas ref={canvasRef} style={styles.canvas} />
      <span style={styles.statusText}>
        {error || `${status}${frameCount > 0 ? ` (scanning... ${frameCount})` : ''}`}
      </span>
      {frameCount > 0 && (
        <div style={{ width: '100%', display: 'flex', gap: '4px', justifyContent: 'center' }}>
          {['Line 1', 'Line 2', 'Line 3'].map((label, i) => (
            <span key={i} style={{
              fontSize: '10px', fontWeight: 700, fontFamily: fonts.mono,
              padding: '2px 6px', borderRadius: '4px',
              background: bestScores[i] >= 0.6 ? colors.green + '22' : colors.bg2,
              color: bestScores[i] >= 0.6 ? colors.green : colors.text3,
            }}>
              {label}: {Math.round(bestScores[i] * 100)}%
            </span>
          ))}
        </div>
      )}
      {lastOcrText && frameCount > 3 && (
        <div style={{
          width: '100%', padding: '6px 8px', borderRadius: '6px',
          background: colors.bg2, border: `1px solid ${colors.border}`,
          fontSize: '9px', fontFamily: fonts.mono, color: colors.text3,
          maxHeight: '60px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {lastOcrText.substring(0, 200)}
        </div>
      )}
      {frameCount > 10 && bestScores[0] < 0.3 && (
        <span style={{ fontSize: '11px', color: colors.amber, fontWeight: 600, textAlign: 'center' }}>
          MRZ not detected — try moving camera closer, ensure back of card is visible
        </span>
      )}
      {bestRef.current.parsed && (
        <button
          style={{ ...styles.btn, background: colors.green, color: '#fff', height: '52px', fontSize: '16px' }}
          onClick={() => {
            const best = bestRef.current;
            setMrzLines(best.lines);
            setFound(best.parsed);
            setScanning(false);
            streamRef.current?.getTracks().forEach(t => t.stop());
            if (scanRef.current) clearInterval(scanRef.current);
          }}>
          Accept MRZ Reading ({Math.round(bestRef.current.score / 3 * 100)}% confidence)
        </button>
      )}
      <button
        style={{ ...styles.btn, background: colors.amber + '22', color: colors.amber }}
        onClick={() => { setScanning(false); streamRef.current?.getTracks().forEach(t => t.stop()); setShowManual(true); }}>
        Type MRZ Manually
      </button>
      <button style={{ ...styles.btn, background: colors.bg2, color: colors.text3 }} onClick={onCancel}>
        Cancel
      </button>
      <TrainingDataBar />
    </div>
  );
}

// Compact bar showing collected training data count + export buttons
function TrainingDataBar() {
  const stats = getStats();
  if (stats.sessions === 0) return null;

  return (
    <div style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: '6px',
      padding: '6px 8px', borderRadius: '6px',
      background: colors.bg2, border: `1px solid ${colors.border}`,
      marginTop: '4px',
    }}>
      <span style={{ flex: 1, fontSize: '10px', color: colors.text3, fontFamily: fonts.mono }}>
        Training: {stats.sessions} scans, {stats.totalFrames} frames
        {stats.withCorrections > 0 && `, ${stats.withCorrections} corrected`}
      </span>
      <button
        onClick={exportAsJSON}
        style={{
          padding: '3px 8px', borderRadius: '4px', border: 'none',
          background: colors.blue + '22', color: colors.blue,
          fontSize: '10px', fontWeight: 700, cursor: 'pointer',
        }}>
        JSON
      </button>
      <button
        onClick={exportAsCSV}
        style={{
          padding: '3px 8px', borderRadius: '4px', border: 'none',
          background: colors.blue + '22', color: colors.blue,
          fontSize: '10px', fontWeight: 700, cursor: 'pointer',
        }}>
        CSV
      </button>
    </div>
  );
}
