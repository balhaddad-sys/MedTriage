/**
 * Document Library
 * ================
 *
 * UI for managing scanned documents and viewing per-document learning stats.
 * Shows a list of all scanned ward sheets with:
 *   - Thumbnail preview
 *   - Patient count extracted
 *   - Learning stats (accuracy, corrections, confusion pairs discovered)
 *   - Delete capability
 *   - Aggregate stats panel
 */

import React, { useState, useEffect, useCallback } from 'react';
import { colors, fonts } from '../../design/tokens.js';
import { DeleteIcon, SearchIcon, ChevronDown, ChevronUp } from '../../design/icons.jsx';
import { getAllDocuments, deleteDocument, getAggregateStats } from './documentStore.js';

const styles = {
  container: {
    display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  title: {
    fontSize: '15px', fontWeight: 700, color: colors.text0,
  },
  subtitle: {
    fontSize: '11px', color: colors.text3, fontFamily: fonts.mono,
  },
  statsPanel: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
    gap: '8px', padding: '12px', borderRadius: '10px',
    background: colors.bg2, border: `1px solid ${colors.border}`,
  },
  statBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
  },
  statValue: {
    fontSize: '18px', fontWeight: 800, color: colors.blue,
    fontFamily: fonts.mono,
  },
  statLabel: {
    fontSize: '9px', fontWeight: 700, color: colors.text3,
    fontFamily: fonts.mono, textTransform: 'uppercase', textAlign: 'center',
  },
  searchRow: {
    display: 'flex', gap: '8px', alignItems: 'center',
  },
  searchInput: {
    flex: 1, padding: '8px 12px', borderRadius: '8px',
    border: `1px solid ${colors.border}`, background: colors.bg2,
    color: colors.text0, fontSize: '13px', fontFamily: fonts.sans, outline: 'none',
  },
  docCard: {
    display: 'flex', gap: '12px', padding: '12px',
    borderRadius: '10px', border: `1px solid ${colors.border}`,
    background: colors.bg2, cursor: 'pointer', transition: 'background 150ms',
  },
  thumbnail: {
    width: '60px', height: '60px', borderRadius: '8px',
    objectFit: 'cover', background: colors.bg0, flexShrink: 0,
  },
  thumbnailPlaceholder: {
    width: '60px', height: '60px', borderRadius: '8px',
    background: colors.bg0, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '10px', color: colors.text3, fontFamily: fonts.mono,
  },
  docInfo: {
    flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0,
  },
  docTitle: {
    fontSize: '13px', fontWeight: 700, color: colors.text0,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  docMeta: {
    fontSize: '10px', color: colors.text3, fontFamily: fonts.mono,
  },
  docStats: {
    display: 'flex', gap: '8px', flexWrap: 'wrap',
  },
  pill: {
    padding: '2px 6px', borderRadius: '999px', fontSize: '9px',
    fontWeight: 700, fontFamily: fonts.mono, border: `1px solid ${colors.border}`,
  },
  accuracyGood: { background: colors.green + '22', color: colors.green },
  accuracyMed: { background: colors.amber + '22', color: colors.amber },
  accuracyLow: { background: colors.red + '22', color: colors.red },
  accuracyNone: { background: colors.bg0, color: colors.text3 },
  deleteBtn: {
    background: 'none', border: 'none', color: colors.text3,
    cursor: 'pointer', padding: '4px', borderRadius: '6px',
    flexShrink: 0, alignSelf: 'flex-start',
  },
  expandedSection: {
    padding: '12px', marginTop: '4px', borderRadius: '8px',
    background: colors.bg0, border: `1px solid ${colors.border}`,
    display: 'flex', flexDirection: 'column', gap: '8px',
  },
  sectionTitle: {
    fontSize: '11px', fontWeight: 700, color: colors.text1, fontFamily: fonts.mono,
  },
  rawText: {
    fontSize: '10px', fontFamily: fonts.mono, color: colors.text3,
    background: colors.bg2, padding: '8px', borderRadius: '6px',
    maxHeight: '80px', overflow: 'auto', whiteSpace: 'pre-wrap',
  },
  confusionList: {
    display: 'flex', gap: '4px', flexWrap: 'wrap',
  },
  confusionPill: {
    padding: '2px 6px', borderRadius: '4px', fontSize: '9px',
    fontFamily: fonts.mono, background: colors.blue + '15', color: colors.blue,
    border: `1px solid ${colors.blue}33`,
  },
  wordPill: {
    padding: '2px 6px', borderRadius: '4px', fontSize: '9px',
    fontFamily: fonts.mono, background: colors.green + '15', color: colors.green,
    border: `1px solid ${colors.green}33`,
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '48px 24px', gap: '12px',
  },
  emptyText: {
    fontSize: '13px', color: colors.text3, textAlign: 'center',
  },
  confirmOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
  },
  confirmBox: {
    background: colors.bg1, borderRadius: '12px', padding: '24px',
    maxWidth: '320px', width: '90%', display: 'flex', flexDirection: 'column', gap: '16px',
  },
  confirmTitle: { fontSize: '15px', fontWeight: 700, color: colors.text0 },
  confirmText: { fontSize: '12px', color: colors.text2 },
  confirmBtns: { display: 'flex', gap: '8px' },
  confirmBtn: {
    flex: 1, height: '40px', border: 'none', borderRadius: '8px',
    fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: fonts.sans,
  },
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function AccuracyPill({ score }) {
  if (score === null || score === undefined) {
    return <span style={{ ...styles.pill, ...styles.accuracyNone }}>NO DATA</span>;
  }
  const style = score >= 85
    ? styles.accuracyGood
    : score >= 60
      ? styles.accuracyMed
      : styles.accuracyLow;
  return <span style={{ ...styles.pill, ...style }}>{score}% ACC</span>;
}

export default function DocumentLibrary() {
  const [documents, setDocuments] = useState([]);
  const [aggStats, setAggStats] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadDocs = useCallback(async () => {
    try {
      const [docs, stats] = await Promise.all([
        getAllDocuments(),
        getAggregateStats(),
      ]);
      setDocuments(docs);
      setAggStats(stats);
    } catch (err) {
      console.error('[DocLibrary] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteDocument(id);
      setDeleteConfirm(null);
      setExpandedId(null);
      await loadDocs();
    } catch (err) {
      console.error('[DocLibrary] Delete failed:', err);
    }
  }, [loadDocs]);

  const filtered = search.trim()
    ? documents.filter(doc => {
        const q = search.toLowerCase();
        return (doc.ward || '').toLowerCase().includes(q)
          || (doc.rawText || '').toLowerCase().includes(q)
          || (doc.label || '').toLowerCase().includes(q);
      })
    : documents;

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.empty }}>
          <span style={styles.emptyText}>Loading documents...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Document Library</div>
          <div style={styles.subtitle}>
            {documents.length} document{documents.length !== 1 ? 's' : ''} scanned
          </div>
        </div>
      </div>

      {/* Aggregate Stats */}
      {aggStats && aggStats.totalDocuments > 0 && (
        <div style={styles.statsPanel}>
          <div style={styles.statBox}>
            <span style={styles.statValue}>{aggStats.totalDocuments}</span>
            <span style={styles.statLabel}>Documents</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statValue}>{aggStats.totalPatients}</span>
            <span style={styles.statLabel}>Patients</span>
          </div>
          <div style={styles.statBox}>
            <span style={{
              ...styles.statValue,
              color: aggStats.overallAccuracy === null
                ? colors.text3
                : aggStats.overallAccuracy >= 85
                  ? colors.green
                  : aggStats.overallAccuracy >= 60
                    ? colors.amber
                    : colors.red,
            }}>
              {aggStats.overallAccuracy !== null ? `${aggStats.overallAccuracy}%` : '—'}
            </span>
            <span style={styles.statLabel}>Accuracy</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statValue}>{aggStats.totalCorrections}</span>
            <span style={styles.statLabel}>Corrections</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statValue}>{aggStats.uniqueLearnedWords}</span>
            <span style={styles.statLabel}>Words Learned</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statValue}>{aggStats.uniqueConfusionPairs}</span>
            <span style={styles.statLabel}>Confusions</span>
          </div>
        </div>
      )}

      {/* Search */}
      {documents.length > 3 && (
        <div style={styles.searchRow}>
          <SearchIcon size={16} color={colors.text3} />
          <input
            style={styles.searchInput}
            placeholder="Search by ward or content..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Document List */}
      {filtered.length === 0 ? (
        <div style={styles.empty}>
          <span style={{ fontSize: '32px' }}>&#128196;</span>
          <span style={styles.emptyText}>
            {documents.length === 0
              ? 'No documents yet. Scan a ward sheet with the OCR scanner to get started.'
              : 'No documents match your search.'}
          </span>
        </div>
      ) : (
        filtered.map(doc => {
          const isExpanded = expandedId === doc.id;
          const ls = doc.learningStats || {};
          const patientCount = (doc.patients || []).length;

          return (
            <div key={doc.id} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              <div
                style={styles.docCard}
                onClick={() => setExpandedId(isExpanded ? null : doc.id)}
              >
                {/* Thumbnail */}
                {doc.thumbnail ? (
                  <img src={doc.thumbnail} alt="" style={styles.thumbnail} />
                ) : (
                  <div style={styles.thumbnailPlaceholder}>OCR</div>
                )}

                {/* Info */}
                <div style={styles.docInfo}>
                  <div style={styles.docTitle}>
                    {doc.label || `Ward ${doc.ward || '?'} Scan`}
                  </div>
                  <div style={styles.docMeta}>
                    {formatDate(doc.createdAt)}
                    {patientCount > 0 && ` · ${patientCount} patient${patientCount !== 1 ? 's' : ''}`}
                    {ls.correctionsApplied > 0 && ` · ${ls.correctionsApplied} review${ls.correctionsApplied !== 1 ? 's' : ''}`}
                  </div>
                  <div style={styles.docStats}>
                    <AccuracyPill score={ls.accuracyScore} />
                    {ls.fieldsEdited > 0 && (
                      <span style={{ ...styles.pill, background: colors.amber + '15', color: colors.amber }}>
                        {ls.fieldsEdited} edited
                      </span>
                    )}
                    {(ls.learnedWords || []).length > 0 && (
                      <span style={{ ...styles.pill, background: colors.green + '15', color: colors.green }}>
                        +{ls.learnedWords.length} words
                      </span>
                    )}
                  </div>
                </div>

                {/* Expand/Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  {isExpanded ? <ChevronUp size={16} color={colors.text3} /> : <ChevronDown size={16} color={colors.text3} />}
                  <button
                    style={styles.deleteBtn}
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(doc); }}
                    title="Delete document"
                  >
                    <DeleteIcon size={16} color={colors.red} />
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div style={styles.expandedSection}>
                  {/* OCR Raw Text */}
                  {doc.rawText && (
                    <>
                      <div style={styles.sectionTitle}>RAW OCR OUTPUT</div>
                      <div style={styles.rawText}>{doc.rawText}</div>
                    </>
                  )}

                  {/* Learning Stats Detail */}
                  <div style={styles.sectionTitle}>LEARNING STATS</div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '11px', fontFamily: fonts.mono, color: colors.text2 }}>
                    <span>Verified: {ls.fieldsVerified || 0}</span>
                    <span>Edited: {ls.fieldsEdited || 0}</span>
                    <span>Reviews: {ls.correctionsApplied || 0}</span>
                    {ls.lastLearnedAt && <span>Last: {formatDate(ls.lastLearnedAt)}</span>}
                  </div>

                  {/* Confusion Pairs Discovered */}
                  {(ls.confusionPairsFound || []).length > 0 && (
                    <>
                      <div style={styles.sectionTitle}>CONFUSION PAIRS DISCOVERED</div>
                      <div style={styles.confusionList}>
                        {ls.confusionPairsFound.slice(0, 20).map((p, i) => (
                          <span key={i} style={styles.confusionPill}>
                            {typeof p === 'string' ? p : `${p.pair} (${p.count || 1}x)`}
                          </span>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Learned Words */}
                  {(ls.learnedWords || []).length > 0 && (
                    <>
                      <div style={styles.sectionTitle}>WORDS LEARNED</div>
                      <div style={styles.confusionList}>
                        {ls.learnedWords.slice(0, 30).map((w, i) => (
                          <span key={i} style={styles.wordPill}>
                            {typeof w === 'string' ? w : w.word}
                          </span>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Patient Names */}
                  {(doc.patients || []).length > 0 && (
                    <>
                      <div style={styles.sectionTitle}>PATIENTS EXTRACTED</div>
                      <div style={{ fontSize: '11px', fontFamily: fonts.mono, color: colors.text2 }}>
                        {doc.patients.map((p, i) => (
                          <div key={i}>
                            {p.fullName || p.name || '(unnamed)'}
                            {p.bed && ` · Bed ${p.bed}`}
                            {p.triage && ` · ${p.triage}`}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div style={styles.confirmOverlay} onClick={() => setDeleteConfirm(null)}>
          <div style={styles.confirmBox} onClick={e => e.stopPropagation()}>
            <div style={styles.confirmTitle}>Delete Document?</div>
            <div style={styles.confirmText}>
              This will permanently remove "{deleteConfirm.label || `Ward ${deleteConfirm.ward || '?'} Scan`}" and its learning data.
              The Shifu engine retains knowledge already learned from this document.
            </div>
            <div style={styles.confirmBtns}>
              <button
                style={{ ...styles.confirmBtn, background: colors.bg2, color: colors.text1 }}
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                style={{ ...styles.confirmBtn, background: colors.red, color: '#fff' }}
                onClick={() => handleDelete(deleteConfirm.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
