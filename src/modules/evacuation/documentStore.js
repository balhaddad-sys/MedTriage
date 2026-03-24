/**
 * Document Store
 * ==============
 *
 * Persistent storage for scanned documents + per-document learning stats.
 * Uses IndexedDB via the shared storage engine.
 *
 * Each document record tracks:
 *   - Original image (as base64 thumbnail for preview)
 *   - OCR raw text + corrected text
 *   - Shifu learning stats: corrections made, accuracy delta, confusion pairs found
 *   - Timestamps and metadata
 *
 * This feeds the Document Library UI and provides training data
 * for the Shifu learning engine to improve over time.
 */

const DB_NAME = 'medevac-docs-v1';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

let dbPromise = null;

function openDocDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('ward', 'ward');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function docTx(mode, fn) {
  const db = await openDocDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, mode);
    const store = t.objectStore(STORE_NAME);
    const result = fn(store);
    const timeout = setTimeout(() => reject(new Error('Transaction timeout')), 15000);
    t.oncomplete = () => {
      clearTimeout(timeout);
      resolve(result instanceof IDBRequest ? result.result : undefined);
    };
    t.onerror = () => { clearTimeout(timeout); reject(t.error); };
    t.onabort = () => { clearTimeout(timeout); reject(new Error('Transaction aborted')); };
    if (result instanceof IDBRequest) { result.onsuccess = () => {}; }
  });
}

// ====== DOCUMENT CRUD ======

/**
 * Save a scanned document with its OCR results and learning metadata.
 *
 * @param {object} doc - Document record
 * @param {string} doc.id - Unique ID (crypto.randomUUID())
 * @param {string} doc.thumbnail - Base64-encoded image thumbnail (resized to ~200px)
 * @param {string} doc.rawText - Raw OCR output text
 * @param {object[]} doc.patients - Extracted patient records from this scan
 * @param {string} doc.ward - Ward identifier
 * @param {object} doc.learningStats - Per-document Shifu learning stats
 */
export async function saveDocument(doc) {
  doc.modifiedAt = new Date().toISOString();
  if (!doc.createdAt) doc.createdAt = doc.modifiedAt;
  if (!doc.learningStats) {
    doc.learningStats = {
      correctionsApplied: 0,
      fieldsVerified: 0,
      fieldsEdited: 0,
      confusionPairsFound: [],
      accuracyScore: null,
      learnedWords: [],
    };
  }
  await docTx('readwrite', s => s.put(doc));
  return doc;
}

/**
 * Get a single document by ID.
 */
export async function getDocument(id) {
  return docTx('readonly', s => s.get(id));
}

/**
 * Get all documents, sorted by creation date (newest first).
 */
export async function getAllDocuments() {
  const docs = await docTx('readonly', s => s.getAll());
  return (docs || []).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

/**
 * Delete a document by ID.
 */
export async function deleteDocument(id) {
  await docTx('readwrite', s => s.delete(id));
}

/**
 * Update learning stats for a document after nurse review.
 *
 * @param {string} docId - Document ID
 * @param {object} statsUpdate - Partial stats to merge
 */
export async function updateDocumentLearning(docId, statsUpdate) {
  const doc = await getDocument(docId);
  if (!doc) return null;

  doc.learningStats = {
    ...doc.learningStats,
    ...statsUpdate,
    lastLearnedAt: new Date().toISOString(),
  };
  doc.modifiedAt = new Date().toISOString();

  await docTx('readwrite', s => s.put(doc));
  return doc;
}

/**
 * Record a correction event on a specific document.
 * Increments counters and tracks confusion pairs found.
 */
export async function recordDocumentCorrection(docId, { fieldsEdited = 0, fieldsVerified = 0, confusionPairs = [], learnedWords = [] }) {
  const doc = await getDocument(docId);
  if (!doc) return null;

  const stats = doc.learningStats || {};
  stats.correctionsApplied = (stats.correctionsApplied || 0) + 1;
  stats.fieldsEdited = (stats.fieldsEdited || 0) + fieldsEdited;
  stats.fieldsVerified = (stats.fieldsVerified || 0) + fieldsVerified;
  stats.lastLearnedAt = new Date().toISOString();

  // Merge confusion pairs (deduplicate)
  const existingPairs = new Set((stats.confusionPairsFound || []).map(p => p.pair || p));
  for (const pair of confusionPairs) {
    const key = pair.pair || pair;
    if (!existingPairs.has(key)) {
      stats.confusionPairsFound = [...(stats.confusionPairsFound || []), pair];
      existingPairs.add(key);
    }
  }

  // Merge learned words (deduplicate)
  const existingWords = new Set((stats.learnedWords || []).map(w => w.word || w));
  for (const word of learnedWords) {
    const key = word.word || word;
    if (!existingWords.has(key)) {
      stats.learnedWords = [...(stats.learnedWords || []), word];
      existingWords.add(key);
    }
  }

  // Calculate accuracy: verified / (verified + edited)
  const total = stats.fieldsVerified + stats.fieldsEdited;
  stats.accuracyScore = total > 0 ? Math.round((stats.fieldsVerified / total) * 100) : null;

  doc.learningStats = stats;
  doc.modifiedAt = new Date().toISOString();

  await docTx('readwrite', s => s.put(doc));
  return doc;
}

/**
 * Get aggregate learning stats across all documents.
 */
export async function getAggregateStats() {
  const docs = await getAllDocuments();

  const stats = {
    totalDocuments: docs.length,
    totalCorrections: 0,
    totalFieldsVerified: 0,
    totalFieldsEdited: 0,
    overallAccuracy: null,
    totalPatients: 0,
    uniqueConfusionPairs: new Set(),
    uniqueLearnedWords: new Set(),
    oldestDoc: null,
    newestDoc: null,
  };

  for (const doc of docs) {
    const ls = doc.learningStats || {};
    stats.totalCorrections += ls.correctionsApplied || 0;
    stats.totalFieldsVerified += ls.fieldsVerified || 0;
    stats.totalFieldsEdited += ls.fieldsEdited || 0;
    stats.totalPatients += (doc.patients || []).length;

    for (const p of (ls.confusionPairsFound || [])) {
      stats.uniqueConfusionPairs.add(p.pair || p);
    }
    for (const w of (ls.learnedWords || [])) {
      stats.uniqueLearnedWords.add(w.word || w);
    }

    if (!stats.oldestDoc || (doc.createdAt || '') < stats.oldestDoc) {
      stats.oldestDoc = doc.createdAt;
    }
    if (!stats.newestDoc || (doc.createdAt || '') > stats.newestDoc) {
      stats.newestDoc = doc.createdAt;
    }
  }

  const totalFields = stats.totalFieldsVerified + stats.totalFieldsEdited;
  stats.overallAccuracy = totalFields > 0
    ? Math.round((stats.totalFieldsVerified / totalFields) * 100)
    : null;

  stats.uniqueConfusionPairs = stats.uniqueConfusionPairs.size;
  stats.uniqueLearnedWords = stats.uniqueLearnedWords.size;

  return stats;
}

/**
 * Generate a thumbnail from an image file.
 * Resizes to max 200px on longest side for efficient storage.
 */
export function generateThumbnail(imageFile) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 200;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = () => resolve(null);
      img.src = reader.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(imageFile);
  });
}
