import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function requireFile(path) {
  if (!existsSync(path)) throw new Error(`Missing required file: ${path}`);
  return readFileSync(path, 'utf8');
}

function requireNonEmptyLines(path) {
  const content = requireFile(path);
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) throw new Error(`Expected non-empty file: ${path}`);
  return lines;
}

const generatedLexiconPath = resolve(repoRoot, 'training', 'ocr', 'generated', 'medtriage_domain_lexicon.json');
const charsetPath = resolve(repoRoot, 'training', 'ocr', 'generated', 'medtriage_charset.txt');
const corpusPath = resolve(repoRoot, 'training', 'ocr', 'generated', 'medtriage_corpus.txt');

const lexicon = JSON.parse(requireFile(generatedLexiconPath));
const charset = requireNonEmptyLines(charsetPath);
const corpus = requireNonEmptyLines(corpusPath);

if (!lexicon.medicalTerms?.length) throw new Error('No medical terms found in generated lexicon');
if (!lexicon.medications?.length) throw new Error('No medications found in generated lexicon');
if (!charset.some(char => /[A-Z]/.test(char))) throw new Error('Charset is missing Latin uppercase characters');
if (!charset.some(char => /[\u0600-\u06FF]/.test(char))) throw new Error('Charset is missing Arabic characters');
if (!corpus.some(line => /[A-Z]-[MF]-\d{2}/.test(line))) throw new Error('Synthetic corpus is missing bed-format rows');

const preparedRoot = resolve(repoRoot, 'training', 'ocr', 'prepared', 'paddle', 'rec');
const trainPath = resolve(preparedRoot, 'train.txt');
if (existsSync(trainPath)) {
  const lines = requireNonEmptyLines(trainPath);
  if (!lines.every(line => line.includes('\t'))) {
    throw new Error('Prepared train.txt contains lines without tab-separated labels');
  }
}

console.log('OCR training workspace verification passed');
console.log(`  Terms:    ${lexicon.medicalTerms.length}`);
console.log(`  Meds:     ${lexicon.medications.length}`);
console.log(`  Charset:  ${charset.length}`);
console.log(`  Corpus:   ${corpus.length}`);
