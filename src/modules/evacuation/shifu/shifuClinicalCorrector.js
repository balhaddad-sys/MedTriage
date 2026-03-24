/**
 * Shifu Clinical Corrector
 * 
 * The main post-OCR processing module.
 * Takes raw OCR output from ANY engine (Tesseract, Google Vision, etc.)
 * and applies:
 *   1. Digraph corrections (rn → m, cl → d)
 *   2. Word-level vocabulary matching with OCR-weighted distance
 *   3. Context-aware boosting (column type, previous words)
 *   4. Safety flags (lab ranges, medication ambiguity)
 * 
 * Returns corrected text with per-word confidence and safety annotations.
 * 
 * SAFETY PRINCIPLE: Never silently override. Flag uncertainty.
 * A wrong confident answer is infinitely worse than "please verify."
 */

import { fixDigraphs, getConfusionCost } from './shifuConfusionModel.js';
import { buildWordSet, getColumnVocabulary, VOCABULARY } from './shifuVocabulary.js';
import { runSafetyChecks } from './shifuSafetyFlags.js';

const ALL_WORDS = buildWordSet();
const PRESERVED_SEPARATORS = /^(?:\s+|\/+|[,;|&()+:])+$/;

/**
 * Correct a single word against the clinical vocabulary.
 * 
 * @param {string} rawWord - The OCR output word
 * @param {object} options
 * @param {string} options.columnType - Column context ('diagnosis', 'patient', 'doctor', etc.)
 * @param {string[]} options.previousWords - Words already read (for context)
 * @param {number} options.maxDistance - Maximum edit distance to accept (default: word length * 0.5)
 * @returns {object} { original, corrected, confidence, flag, candidates }
 */
export function correctWord(rawWord, options = {}) {
  const { prefix, core, suffix } = splitAffixes(rawWord);
  const word = core.trim();
  if (!word) {
    return { original: rawWord, corrected: rawWord, confidence: 0, flag: 'empty', candidates: [] };
  }

  const wordLower = word.toLowerCase();

  // Pure number — pass through (safety checks happen separately)
  if (/^[\d.,/\-:]+$/.test(word)) {
    return { original: rawWord, corrected: rawWord, confidence: 0.8, flag: 'number', candidates: [] };
  }

  // Exact match in vocabulary
  if (ALL_WORDS.has(wordLower)) {
    return {
      original: rawWord,
      corrected: `${prefix}${preserveCase(word, wordLower)}${suffix}`,
      confidence: 0.95,
      flag: 'exact',
      candidates: [],
    };
  }

  // Apply digraph corrections first
  const digraphFixed = fixDigraphs(wordLower);
  if (digraphFixed !== wordLower && ALL_WORDS.has(digraphFixed)) {
    return {
      original: rawWord,
      corrected: `${prefix}${preserveCase(word, digraphFixed)}${suffix}`,
      confidence: 0.85,
      flag: 'digraph_corrected',
      candidates: [{ word: digraphFixed, distance: 0.3 }],
    };
  }

  // Fuzzy match with OCR-weighted distance
  const maxDist = options.maxDistance ?? Math.max(word.length * 0.5, 2.0);
  const contextWords = options.columnType ? getColumnVocabulary(options.columnType) : ALL_WORDS;
  const candidatePools = buildCandidatePools(options.columnType, contextWords);
  const topCandidates = findTopCandidates({
    wordLower,
    candidatePools,
    contextWords,
    maxDist,
    currentContext: options.currentContext,
    columnType: options.columnType,
  });

  if (topCandidates.length === 0) {
    return { original: rawWord, corrected: rawWord, confidence: 0, flag: 'unknown', candidates: [] };
  }

  const top = topCandidates[0];
  const margin = topCandidates.length > 1 ? top.score - topCandidates[1].score : top.score;

  // Confidence and flag
  let confidence = top.score;
  let flag;

  // Check medication ambiguity
  const meds = new Set(VOCABULARY.medications.map(m => m.toLowerCase()));
  const topIsMed = meds.has(top.word);
  const secondIsMed = topCandidates.length > 1 && meds.has(topCandidates[1].word);

  if (topIsMed && secondIsMed && margin < 0.2) {
    flag = 'DANGER_medication_ambiguity';
    confidence = Math.min(confidence, 0.3);
  } else if (confidence > 0.8 && margin > 0.15) {
    flag = 'high_confidence';
  } else if (confidence > 0.5) {
    flag = 'corrected_verify';
  } else {
    flag = 'low_confidence';
  }

  const correctedCore = flag === 'low_confidence'
    ? word
    : preserveCase(word, top.word);

  return {
    original: rawWord,
    corrected: `${prefix}${correctedCore}${suffix}`,
    confidence,
    flag,
    candidates: topCandidates.slice(0, 3).map(c => ({
      word: c.word,
      distance: Math.round(c.distance * 100) / 100,
      contextBoosted: c.contextBoosted,
    })),
  };
}

/**
 * Process a full line of OCR text.
 * 
 * @param {string} ocrText - Raw OCR output
 * @param {object} options
 * @param {string} options.columnType - Column context
 * @returns {object} { input, output, words, safetyFlags, avgConfidence }
 */
export function correctLine(ocrText, options = {}) {
  const rawWords = tokenizeForCorrection(ocrText);
  const results = [];
  const previousWords = [];
  const outputSegments = [];

  for (const rawWord of rawWords) {
    if (PRESERVED_SEPARATORS.test(rawWord)) {
      outputSegments.push(rawWord);
      continue;
    }

    const result = correctWord(rawWord, {
      ...options,
      previousWords,
    });
    results.push(result);
    previousWords.push(result.corrected);
    outputSegments.push(result.corrected);
  }

  // Run safety checks
  const safetyFlags = runSafetyChecks(results);

  const avgConfidence = results.length > 0
    ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    : 0;
  const hasLowConfidenceWords = results.some(r => r.flag === 'low_confidence');
  const hasUnknownWords = results.some(r => r.flag === 'unknown');

  return {
    input: ocrText,
    output: outputSegments.join(''),
    words: results,
    safetyFlags,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    hasLowConfidenceWords,
    hasUnknownWords,
    hasWarnings: safetyFlags.some(f => f.severity === 'warning'),
    hasDangers: safetyFlags.some(f => f.severity === 'danger'),
  };
}

/**
 * Process a full table row (multiple columns).
 * Each column gets its own context for vocabulary boosting.
 * 
 * @param {object} row - { Room: "12-3", Patient: "mneer", Diagnosis: "cVa", ... }
 * @returns {object} Corrected row with per-field annotations
 */
export function correctTableRow(row) {
  const corrected = {};
  const allFlags = [];

  for (const [columnName, cellText] of Object.entries(row)) {
    if (!cellText || typeof cellText !== 'string') {
      corrected[columnName] = { input: cellText, output: cellText, words: [], safetyFlags: [] };
      continue;
    }

    const result = correctLine(cellText, { columnType: columnName });
    corrected[columnName] = result;

    // Collect all safety flags with column context
    for (const flag of result.safetyFlags) {
      allFlags.push({ column: columnName, ...flag });
    }
  }

  return {
    corrected,
    safetyFlags: allFlags,
    hasDangers: allFlags.some(f => f.severity === 'danger'),
    hasWarnings: allFlags.some(f => f.severity === 'warning'),
  };
}

// === Utilities ===

/**
 * Preserve the capitalization pattern of the original word
 * when applying the correction.
 */
function preserveCase(original, corrected) {
  if (!original || !corrected) return corrected;

  // All uppercase
  if (original === original.toUpperCase() && original.length > 1) {
    return corrected.toUpperCase();
  }

  // Title case
  if (original[0] === original[0].toUpperCase() && original.slice(1) === original.slice(1).toLowerCase()) {
    return corrected.charAt(0).toUpperCase() + corrected.slice(1).toLowerCase();
  }

  // All lowercase
  if (original === original.toLowerCase()) {
    return corrected.toLowerCase();
  }

  // Mixed or unknown — return as-is from vocabulary
  return corrected;
}

/**
 * Quick confidence check — is this OCR output trustworthy?
 * Returns 'accept', 'verify', or 'reject'.
 */
export function assessConfidence(correctionResult) {
  if (correctionResult.hasDangers) return 'reject';
  if (correctionResult.hasWarnings || correctionResult.hasLowConfidenceWords || correctionResult.hasUnknownWords) {
    return 'verify';
  }
  if (correctionResult.avgConfidence > 0.7) return 'accept';
  if (correctionResult.avgConfidence > 0.4) return 'verify';
  return 'reject';
}

function buildCandidatePools(columnType, contextWords) {
  if (!columnType || contextWords === ALL_WORDS) {
    return [ALL_WORDS];
  }
  if (isContextOnlyColumn(columnType)) {
    return [contextWords];
  }
  return [contextWords, ALL_WORDS];
}

function findTopCandidates({ wordLower, candidatePools, contextWords, maxDist, currentContext, columnType }) {
  for (const pool of candidatePools) {
    const candidates = [];

    for (const vocabWord of pool) {
      if (Math.abs(vocabWord.length - wordLower.length) > 3) continue;

      const dist = adaptiveWeightedDistance(wordLower, vocabWord);
      if (dist > maxDist) continue;

      let totalBoost = contextWords.has(vocabWord) ? 0.4 : 0;

      const lenRatio = Math.min(wordLower.length, vocabWord.length) /
        Math.max(wordLower.length, vocabWord.length);
      const rawScore = Math.max(0, 1.0 - (dist - totalBoost) / Math.max(wordLower.length, 3));
      const score = Math.min(1, rawScore) * lenRatio;

      candidates.push({
        word: vocabWord,
        distance: dist,
        score,
        contextBoosted: totalBoost > 0.4,
      });
    }

    candidates.sort((a, b) => b.score - a.score);
    if (candidates.length > 0) {
      return candidates.slice(0, 5);
    }
  }

  return [];
}

function adaptiveWeightedDistance(str1, str2) {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const matrix = Array.from({ length: s1.length + 1 }, (_, i) => {
    const row = new Array(s2.length + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const subCost = getConfusionCost(s1[i - 1], s2[j - 1]);
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + subCost,
      );
    }
  }

  return matrix[s1.length][s2.length];
}

function isContextOnlyColumn(columnType) {
  const type = `${columnType || ''}`.toLowerCase();
  return (
    type.includes('patient') ||
    type.includes('name') ||
    type.includes('doctor') ||
    type.includes('assign') ||
    type.includes('status') ||
    type.includes('evacuation') ||
    type.includes('room') ||
    type.includes('ward') ||
    type.includes('bed')
  );
}

function tokenizeForCorrection(text) {
  return `${text || ''}`.split(/(\s+|\/+|[,;|&()+:])/).filter(segment => segment.length > 0);
}

function splitAffixes(rawWord) {
  const text = `${rawWord || ''}`;
  let start = 0;
  let end = text.length;

  while (start < end && isWrapperPunctuation(text[start])) start++;
  while (end > start && isWrapperPunctuation(text[end - 1])) end--;

  return {
    prefix: text.slice(0, start),
    core: text.slice(start, end),
    suffix: text.slice(end),
  };
}

function isWrapperPunctuation(char) {
  return /[?!.,;[\]{}"'`]/.test(char);
}
