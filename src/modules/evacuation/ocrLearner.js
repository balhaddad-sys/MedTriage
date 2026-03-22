// OCR Self-Learning Engine — learns from collected training data to improve accuracy
//
// Architecture:
//   Training data (ocrDataCollector) → Learning cycle → Learned models → OCR boost
//
// What it learns:
//   1. VOCABULARY: names, diagnoses, medications actually used at this hospital
//   2. CONFUSION: character-level OCR errors (e.g., "I" misread as "l" in names)
//   3. PATTERNS: column layouts, field positions, recurring structures
//   4. CORRECTIONS: specific OCR→truth mappings ("Al-Mutairl" → "Al-Mutairi")
//   5. CONTEXT: which words appear near which entities (e.g., "Dr." before names)
//
// The learner runs periodically and stores its models in localStorage.
// The OCR engine queries the learner for boosted confidence scores and corrections.

import { loadSeedData } from './ocrSeedData.js';
import { loadProgressNoteSeedData } from './ocrSeedProgressNotes.js';

const MODELS_KEY = 'ocr_learned_models';
const TRAINING_KEY = 'ocr_training_data';
const SEED_VERSION = 2; // bump to re-seed (v2: added progress notes)

// ═══════════════════════════════════════════════════════════════════
// LEARNED MODEL — the output of the learning cycle
// ═══════════════════════════════════════════════════════════════════

function loadModels() {
  try {
    let models = JSON.parse(localStorage.getItem(MODELS_KEY) || 'null') || createEmptyModels();
    // Auto-seed on first load or when seed version bumps
    if (!models.seeded || (models.seedVersion || 0) < SEED_VERSION) {
      console.log('[LEARNER] Loading seed data...');
      models = loadSeedData(models);
      models = loadProgressNoteSeedData(models);
      models.seedVersion = SEED_VERSION;
      saveModels(models);
      console.log(`[LEARNER] Seeded: ${Object.keys(models.names).length} names, ${Object.keys(models.diagnoses).length} dx, ${Object.keys(models.medications).length} meds, ${Object.keys(models.abbreviations || {}).length} abbreviations, ${Object.keys(models.labTests || {}).length} lab tests`);
    }
    return models;
  } catch {
    const models = loadSeedData(createEmptyModels());
    return models;
  }
}

function saveModels(models) {
  try {
    models.updatedAt = new Date().toISOString();
    localStorage.setItem(MODELS_KEY, JSON.stringify(models));
  } catch (e) {
    console.warn('[LEARNER] Failed to save models:', e);
  }
}

function createEmptyModels() {
  return {
    version: 1,
    updatedAt: null,
    trainingSamplesUsed: 0,

    // Learned vocabularies — { word: { count, entity, confidence, lastSeen } }
    names: {},
    diagnoses: {},
    medications: {},
    beds: {},
    wards: {},
    doctors: {},

    // Character confusion matrix — { expected: { ocr_got: count } }
    charConfusion: {},

    // Word-level corrections — { ocrText: { truth: string, count: number, entity: string } }
    corrections: {},

    // Field co-occurrence — which entities appear together
    // { entityA: { entityB: count } }
    cooccurrence: {},

    // Layout patterns — learned column structures
    // { hash: { columns: [...], count: number } }
    layouts: {},
  };
}

// ═══════════════════════════════════════════════════════════════════
// LEARNING CYCLE — processes training data and builds models
// ═══════════════════════════════════════════════════════════════════

export function runLearningCycle() {
  const samples = loadTrainingData();
  if (samples.length === 0) return null;

  const models = loadModels();
  const newSamples = samples.slice(models.trainingSamplesUsed);
  if (newSamples.length === 0) return models;

  console.log(`[LEARNER] Processing ${newSamples.length} new samples (${samples.length} total)`);

  for (const sample of newSamples) {
    learnFromSample(models, sample);
  }

  models.trainingSamplesUsed = samples.length;
  computeDerivedScores(models);
  saveModels(models);

  console.log(`[LEARNER] Models updated: ${Object.keys(models.names).length} names, ${Object.keys(models.diagnoses).length} diagnoses, ${Object.keys(models.corrections).length} corrections`);
  return models;
}

function learnFromSample(models, sample) {
  const imported = sample.importedPatients || [];
  const ocr = sample.ocrPatients || [];

  // Learn vocabulary from imported (ground truth) patients
  for (const patient of imported) {
    learnVocabulary(models, patient);
  }

  // Learn corrections by comparing OCR output to imported
  learnCorrections(models, ocr, imported);

  // Learn character-level confusion from raw text vs ground truth
  learnCharConfusion(models, sample);

  // Learn co-occurrence patterns
  learnCooccurrence(models, imported);

  // Learn layout patterns
  if (sample.meta?.strategy) {
    learnLayout(models, sample);
  }
}

// --- Vocabulary Learning ---

function learnVocabulary(models, patient) {
  const now = new Date().toISOString();

  // Names
  if (patient.fullName) {
    const words = patient.fullName.trim().split(/\s+/);
    for (const word of words) {
      const key = word.toLowerCase();
      if (key.length < 2) continue;
      if (!models.names[key]) {
        models.names[key] = { count: 0, variants: {}, entity: 'NAME', lastSeen: now };
      }
      models.names[key].count++;
      models.names[key].lastSeen = now;
      // Track case variants
      models.names[key].variants[word] = (models.names[key].variants[word] || 0) + 1;
    }
  }

  // Diagnoses
  if (patient.dx) {
    const dxKey = patient.dx.trim().toLowerCase();
    if (dxKey.length >= 2) {
      if (!models.diagnoses[dxKey]) {
        models.diagnoses[dxKey] = { count: 0, entity: 'DIAGNOSIS', lastSeen: now };
      }
      models.diagnoses[dxKey].count++;
      models.diagnoses[dxKey].lastSeen = now;
    }
    // Also learn individual clinical terms
    const terms = patient.dx.split(/[,;\/]+/).map(t => t.trim()).filter(Boolean);
    for (const term of terms) {
      const termKey = term.toLowerCase();
      if (termKey.length >= 3 && !models.diagnoses[termKey]) {
        models.diagnoses[termKey] = { count: 0, entity: 'DIAGNOSIS', lastSeen: now };
      }
      if (models.diagnoses[termKey]) models.diagnoses[termKey].count++;
    }
  }

  // Medications
  if (patient.meds) {
    const meds = patient.meds.split(/[,;\/]+/).map(t => t.trim()).filter(Boolean);
    for (const med of meds) {
      const medKey = med.toLowerCase();
      if (medKey.length < 3) continue;
      if (!models.medications[medKey]) {
        models.medications[medKey] = { count: 0, entity: 'MEDICATION', lastSeen: now };
      }
      models.medications[medKey].count++;
    }
  }

  // Beds
  if (patient.bed) {
    const bedKey = patient.bed.trim().toUpperCase();
    if (!models.beds[bedKey]) {
      models.beds[bedKey] = { count: 0, entity: 'BED', lastSeen: now };
    }
    models.beds[bedKey].count++;
  }

  // Wards
  if (patient.ward) {
    const wardKey = patient.ward.trim();
    if (!models.wards[wardKey]) {
      models.wards[wardKey] = { count: 0, entity: 'WARD', lastSeen: now };
    }
    models.wards[wardKey].count++;
  }

  // Doctors
  if (patient.assignedDoctor) {
    const docKey = patient.assignedDoctor.trim().toLowerCase();
    if (!models.doctors[docKey]) {
      models.doctors[docKey] = { count: 0, entity: 'ASSIGNED_DOCTOR', lastSeen: now };
    }
    models.doctors[docKey].count++;
  }
}

// --- Correction Learning ---

function learnCorrections(models, ocrPatients, importedPatients) {
  // Match OCR patients to imported by bed (most reliable key)
  for (const imp of importedPatients) {
    const ocrMatch = ocrPatients.find(o =>
      o.bed && imp.bed && o.bed.replace(/\s/g, '').toUpperCase() === imp.bed.replace(/\s/g, '').toUpperCase()
    );
    if (!ocrMatch) continue;

    // Learn field-level corrections
    learnFieldCorrection(models, ocrMatch.fullName, imp.fullName, 'NAME');
    learnFieldCorrection(models, ocrMatch.dx, imp.dx, 'DIAGNOSIS');
    learnFieldCorrection(models, ocrMatch.meds, imp.meds, 'MEDICATION');
    learnFieldCorrection(models, ocrMatch.assignedDoctor, imp.assignedDoctor, 'ASSIGNED_DOCTOR');
  }
}

function learnFieldCorrection(models, ocrValue, truthValue, entity) {
  if (!ocrValue || !truthValue) return;
  const ocrClean = ocrValue.trim();
  const truthClean = truthValue.trim();
  if (ocrClean === truthClean) return; // no correction needed
  if (ocrClean.toLowerCase() === truthClean.toLowerCase()) return; // just case difference

  const key = ocrClean.toLowerCase();
  if (!models.corrections[key]) {
    models.corrections[key] = { truth: truthClean, count: 0, entity };
  }
  models.corrections[key].count++;
  // Update truth if this correction is seen more
  if (models.corrections[key].truth.toLowerCase() !== truthClean.toLowerCase()) {
    // Keep the most frequent correction
    models.corrections[key].truth = truthClean;
  }
}

// --- Character Confusion Learning ---

function learnCharConfusion(models, sample) {
  const ocr = sample.ocrPatients || [];
  const imported = sample.importedPatients || [];

  for (const imp of imported) {
    const ocrMatch = ocr.find(o =>
      o.bed && imp.bed && o.bed.replace(/\s/g, '').toUpperCase() === imp.bed.replace(/\s/g, '').toUpperCase()
    );
    if (!ocrMatch) continue;

    // Compare name characters
    alignAndLearnChars(models, ocrMatch.fullName || '', imp.fullName || '');
    // Compare diagnosis characters
    alignAndLearnChars(models, ocrMatch.dx || '', imp.dx || '');
  }
}

function alignAndLearnChars(models, ocrText, truthText) {
  if (!ocrText || !truthText) return;
  // Simple character alignment — works for same-length or near-length strings
  const maxLen = Math.min(ocrText.length, truthText.length, 100);
  for (let i = 0; i < maxLen; i++) {
    const ocrChar = ocrText[i];
    const truthChar = truthText[i];
    if (ocrChar === truthChar) continue;

    if (!models.charConfusion[truthChar]) {
      models.charConfusion[truthChar] = {};
    }
    models.charConfusion[truthChar][ocrChar] = (models.charConfusion[truthChar][ocrChar] || 0) + 1;
  }
}

// --- Co-occurrence Learning ---

function learnCooccurrence(models, patients) {
  for (const p of patients) {
    const entities = [];
    if (p.fullName) entities.push('NAME');
    if (p.bed) entities.push('BED');
    if (p.dx) entities.push('DIAGNOSIS');
    if (p.meds) entities.push('MEDICATION');
    if (p.assignedDoctor) entities.push('DOCTOR');
    if (p.bloodType) entities.push('BLOOD_TYPE');

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = entities[i], b = entities[j];
        if (!models.cooccurrence[a]) models.cooccurrence[a] = {};
        models.cooccurrence[a][b] = (models.cooccurrence[a][b] || 0) + 1;
      }
    }
  }
}

// --- Layout Learning ---

function learnLayout(models, sample) {
  const strategy = sample.meta?.strategy || 'unknown';
  if (!models.layouts[strategy]) {
    models.layouts[strategy] = { count: 0, avgPatients: 0, avgQuality: 0 };
  }
  const layout = models.layouts[strategy];
  const n = layout.count;
  layout.count++;
  layout.avgPatients = (layout.avgPatients * n + (sample.importedPatients?.length || 0)) / (n + 1);
  layout.avgQuality = (layout.avgQuality * n + (sample.meta?.qualityScore || 0)) / (n + 1);
}

// --- Derived Scores ---

function computeDerivedScores(models) {
  // Compute confidence for each learned name based on frequency
  for (const [key, data] of Object.entries(models.names)) {
    data.confidence = Math.min(1.0, 0.6 + (data.count * 0.08));
    // Prefer the most common case variant
    if (data.variants) {
      const best = Object.entries(data.variants).sort((a, b) => b[1] - a[1])[0];
      if (best) data.preferred = best[0];
    }
  }

  for (const [key, data] of Object.entries(models.diagnoses)) {
    data.confidence = Math.min(1.0, 0.5 + (data.count * 0.1));
  }

  for (const [key, data] of Object.entries(models.medications)) {
    data.confidence = Math.min(1.0, 0.5 + (data.count * 0.1));
  }

  for (const [key, data] of Object.entries(models.corrections)) {
    data.confidence = Math.min(1.0, 0.7 + (data.count * 0.1));
  }
}

// ═══════════════════════════════════════════════════════════════════
// QUERY API — used by the OCR engine to get learned boosts
// ═══════════════════════════════════════════════════════════════════

let cachedModels = null;

function getModels() {
  if (!cachedModels) cachedModels = loadModels();
  return cachedModels;
}

// Invalidate cache (call after learning cycle)
export function invalidateCache() {
  cachedModels = null;
}

// Look up a word in learned name vocabulary
// Returns { confidence, preferred, count } or null
export function lookupLearnedName(text) {
  const models = getModels();
  if (!text || !models.names) return null;

  const words = text.trim().split(/\s+/);
  let bestConf = 0;
  let bestPreferred = null;

  for (const word of words) {
    const key = word.toLowerCase();
    const entry = models.names[key];
    if (entry && entry.confidence > bestConf) {
      bestConf = entry.confidence;
      bestPreferred = entry.preferred || word;
    }
    // Fuzzy: check 1-edit distance
    if (!entry) {
      for (const [k, v] of Object.entries(models.names)) {
        if (Math.abs(k.length - key.length) > 1) continue;
        if (v.count >= 2 && editDistance(key, k) <= 1) {
          const fuzzyConf = v.confidence * 0.85;
          if (fuzzyConf > bestConf) {
            bestConf = fuzzyConf;
            bestPreferred = v.preferred || k;
          }
        }
      }
    }
  }

  return bestConf > 0 ? { confidence: bestConf, preferred: bestPreferred } : null;
}

// Look up a diagnosis in learned vocabulary
export function lookupLearnedDiagnosis(text) {
  const models = getModels();
  if (!text || !models.diagnoses) return null;

  const key = text.trim().toLowerCase();
  const exact = models.diagnoses[key];
  if (exact) return { confidence: exact.confidence, count: exact.count };

  // Check individual terms
  const terms = key.split(/[,;\/\s]+/).filter(t => t.length >= 3);
  let matches = 0;
  let totalConf = 0;
  for (const term of terms) {
    const entry = models.diagnoses[term];
    if (entry) {
      matches++;
      totalConf += entry.confidence;
    }
  }
  if (matches > 0) {
    return { confidence: (totalConf / matches) * 0.9, count: matches, partial: true };
  }

  return null;
}

// Look up a medication in learned vocabulary
export function lookupLearnedMedication(text) {
  const models = getModels();
  if (!text || !models.medications) return null;

  const key = text.trim().toLowerCase();
  // Exact match
  for (const [k, v] of Object.entries(models.medications)) {
    if (k === key) return { confidence: v.confidence, count: v.count };
    // Fuzzy for meds — OCR often drops/adds a letter
    if (key.length >= 5 && editDistance(key, k) <= 2) {
      return { confidence: v.confidence * 0.8, count: v.count, corrected: k };
    }
  }
  return null;
}

// Get a correction for OCR text (learned from user edits)
export function getLearnedCorrection(ocrText) {
  const models = getModels();
  if (!ocrText || !models.corrections) return null;

  const key = ocrText.trim().toLowerCase();
  const entry = models.corrections[key];
  if (entry && entry.count >= 1) {
    return {
      truth: entry.truth,
      confidence: entry.confidence,
      entity: entry.entity,
      count: entry.count,
    };
  }
  return null;
}

// Check if a bed format has been seen before
export function isKnownBed(text) {
  const models = getModels();
  const key = text.trim().toUpperCase();
  return models.beds?.[key]?.count > 0;
}

// Check if a ward has been seen before
export function isKnownWard(text) {
  const models = getModels();
  const key = text.trim();
  return models.wards?.[key]?.count > 0;
}

// Get character confusion probability — what does OCR typically misread char as?
export function getCharConfusion(expectedChar) {
  const models = getModels();
  const entry = models.charConfusion?.[expectedChar];
  if (!entry) return null;
  return Object.entries(entry)
    .sort((a, b) => b[1] - a[1])
    .map(([char, count]) => ({ char, count }));
}

// Expand a clinical abbreviation
export function expandAbbreviation(text) {
  const models = getModels();
  if (!text || !models.abbreviations) return null;
  const key = text.trim().toLowerCase();
  const entry = models.abbreviations[key];
  if (entry) return { expansion: entry.expansion, confidence: entry.confidence };
  return null;
}

// Check if text is a known lab test
export function isKnownLabTest(text) {
  const models = getModels();
  if (!text || !models.labTests) return null;
  const key = text.trim().toLowerCase();
  const entry = models.labTests[key];
  if (entry) return { confidence: entry.confidence, entity: 'LAB_TEST' };
  return null;
}

// Check if text is a known section header (SOAP, etc.)
export function isStructureMarker(text) {
  const models = getModels();
  if (!text || !models.structureMarkers) return null;
  const key = text.trim().toLowerCase().replace(/:$/, '');
  const entry = models.structureMarkers[key];
  if (entry) return { type: entry.type, confidence: entry.confidence };
  return null;
}

// Check if text is a known unit of measurement
export function isKnownUnit(text) {
  const models = getModels();
  if (!text || !models.units) return false;
  return !!models.units[text.trim().toLowerCase()];
}

// Get overall learning stats
export function getLearningStats() {
  const models = getModels();
  return {
    names: Object.keys(models.names || {}).length,
    diagnoses: Object.keys(models.diagnoses || {}).length,
    medications: Object.keys(models.medications || {}).length,
    corrections: Object.keys(models.corrections || {}).length,
    beds: Object.keys(models.beds || {}).length,
    wards: Object.keys(models.wards || {}).length,
    doctors: Object.keys(models.doctors || {}).length,
    charConfusions: Object.keys(models.charConfusion || {}).length,
    layouts: Object.keys(models.layouts || {}).length,
    abbreviations: Object.keys(models.abbreviations || {}).length,
    labTests: Object.keys(models.labTests || {}).length,
    structureMarkers: Object.keys(models.structureMarkers || {}).length,
    units: Object.keys(models.units || {}).length,
    trainingSamples: models.trainingSamplesUsed || 0,
    updatedAt: models.updatedAt,
  };
}

// ═══════════════════════════════════════════════════════════════════
// BOOST ENTITY SCORING — the main integration point with ocrEngine
// ═══════════════════════════════════════════════════════════════════

// Given an OCR text and its entity classification, return a boosted score
// based on learned data. Returns null if no learned boost applies.
export function boostEntityScore(text, entity, currentConfidence) {
  if (!text) return null;

  // Check for a known correction first
  const correction = getLearnedCorrection(text);
  if (correction && correction.count >= 2) {
    return {
      boostedConfidence: Math.max(currentConfidence, correction.confidence),
      correctedText: correction.truth,
      entity: correction.entity,
      reason: `learned correction (seen ${correction.count}x)`,
    };
  }

  // Entity-specific boosts
  switch (entity) {
    case 'NAME': {
      const nameMatch = lookupLearnedName(text);
      if (nameMatch) {
        return {
          boostedConfidence: Math.max(currentConfidence, nameMatch.confidence),
          correctedText: nameMatch.preferred || text,
          entity: 'NAME',
          reason: `learned name`,
        };
      }
      break;
    }
    case 'DIAGNOSIS': {
      const dxMatch = lookupLearnedDiagnosis(text);
      if (dxMatch) {
        return {
          boostedConfidence: Math.max(currentConfidence, dxMatch.confidence),
          correctedText: text,
          entity: 'DIAGNOSIS',
          reason: `learned diagnosis (${dxMatch.count}x)`,
        };
      }
      break;
    }
    case 'MEDICATION': {
      const medMatch = lookupLearnedMedication(text);
      if (medMatch) {
        return {
          boostedConfidence: Math.max(currentConfidence, medMatch.confidence),
          correctedText: medMatch.corrected || text,
          entity: 'MEDICATION',
          reason: `learned medication (${medMatch.count}x)`,
        };
      }
      break;
    }
    case 'BED': {
      if (isKnownBed(text)) {
        return {
          boostedConfidence: Math.max(currentConfidence, 0.92),
          correctedText: text.trim().toUpperCase(),
          entity: 'BED',
          reason: 'learned bed format',
        };
      }
      break;
    }
  }

  return null;
}

// Attempt to resolve an UNKNOWN entity using learned context
export function resolveUnknownEntity(text) {
  if (!text || text.length < 2) return null;

  // Priority: correction > name > diagnosis > medication > bed > ward
  const correction = getLearnedCorrection(text);
  if (correction && correction.count >= 2) {
    return {
      entity: correction.entity,
      confidence: correction.confidence,
      correctedText: correction.truth,
      reason: 'learned correction',
    };
  }

  const nameMatch = lookupLearnedName(text);
  if (nameMatch && nameMatch.confidence >= 0.7) {
    return {
      entity: 'NAME',
      confidence: nameMatch.confidence,
      correctedText: nameMatch.preferred || text,
      reason: 'learned name',
    };
  }

  const dxMatch = lookupLearnedDiagnosis(text);
  if (dxMatch && dxMatch.confidence >= 0.6) {
    return {
      entity: 'DIAGNOSIS',
      confidence: dxMatch.confidence,
      correctedText: text,
      reason: 'learned diagnosis',
    };
  }

  const medMatch = lookupLearnedMedication(text);
  if (medMatch && medMatch.confidence >= 0.6) {
    return {
      entity: 'MEDICATION',
      confidence: medMatch.confidence,
      correctedText: medMatch.corrected || text,
      reason: 'learned medication',
    };
  }

  if (isKnownBed(text)) {
    return { entity: 'BED', confidence: 0.88, correctedText: text.trim().toUpperCase(), reason: 'learned bed' };
  }

  if (isKnownWard(text)) {
    return { entity: 'WARD', confidence: 0.85, correctedText: text.trim(), reason: 'learned ward' };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════

function editDistance(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[b.length][a.length];
}

function loadTrainingData() {
  try {
    return JSON.parse(localStorage.getItem(TRAINING_KEY) || '[]');
  } catch {
    return [];
  }
}
