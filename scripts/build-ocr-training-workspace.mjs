import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const ocrEnginePath = resolve(repoRoot, 'src', 'modules', 'evacuation', 'ocrEngine.js');
const generatedDir = resolve(repoRoot, 'training', 'ocr', 'generated');

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function decodeJsStringLiteral(value) {
  return JSON.parse(`"${value.replace(/"/g, '\\"')}"`);
}

function extractBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start === -1 || end === -1 || end <= start) return '';
  return source.slice(start, end);
}

function extractQuotedStrings(source) {
  return [...source.matchAll(/'((?:\\.|[^'])*)'/g)].map(match => decodeJsStringLiteral(match[1]));
}

function extractMedicalTerms(source) {
  return [...source.matchAll(/'((?:\\.|[^'])*)'\s*:\s*\{/g)].map(match => decodeJsStringLiteral(match[1]));
}

function normalizeToken(text) {
  return `${text || ''}`.replace(/\s+/g, ' ').trim();
}

function buildBeds() {
  const wards = ['A', 'B', 'C', 'D', 'E'];
  const sexes = ['M', 'F'];
  const beds = [];

  for (const ward of wards) {
    for (const sex of sexes) {
      for (let bed = 1; bed <= 32; bed++) {
        beds.push(`${ward}-${sex}-${`${bed}`.padStart(2, '0')}`);
      }
    }
  }

  return beds;
}

function buildPhrases(domain) {
  const latinFirstNames = domain.firstNames.filter(name => !/[\u0600-\u06FF]/.test(name)).slice(0, 120);
  const arabicFirstNames = domain.firstNames.filter(name => /[\u0600-\u06FF]/.test(name)).slice(0, 120);
  const latinFamilyNames = domain.familyNames.filter(name => !/[\u0600-\u06FF]/.test(name)).slice(0, 80);
  const arabicFamilyNames = domain.familyNames.filter(name => /[\u0600-\u06FF]/.test(name)).slice(0, 80);
  const diagnoses = domain.medicalTerms.slice(0, 120);
  const meds = domain.medications.slice(0, 160);
  const beds = domain.beds;
  const rows = [];

  for (let i = 0; i < 220; i++) {
    const age = 18 + (i % 73);
    const gender = i % 2 === 0 ? 'M' : 'F';
    rows.push(`${beds[i % beds.length]} ${latinFirstNames[i % latinFirstNames.length]} ${latinFamilyNames[i % latinFamilyNames.length]} ${age}/${gender} ${diagnoses[i % diagnoses.length]}`);
    rows.push(`${beds[(i + 7) % beds.length]} ${latinFirstNames[(i + 19) % latinFirstNames.length]} ${latinFamilyNames[(i + 23) % latinFamilyNames.length]} ${age}/${gender} ${diagnoses[(i + 13) % diagnoses.length]} ${meds[(i + 17) % meds.length]}`);
    rows.push(`${arabicFirstNames[i % arabicFirstNames.length]} ${arabicFamilyNames[i % arabicFamilyNames.length]}`);
  }

  return [...new Set(rows.map(normalizeToken).filter(Boolean))];
}

function buildCharset(domain) {
  const extra = [
    '-', '/', '\\', ':', '.', ',', '(', ')', '#', '+',
    ' ', 'M', 'F',
  ];
  const chars = new Set();

  const corpus = [
    ...domain.medicalTerms,
    ...domain.medications,
    ...domain.firstNames,
    ...domain.familyNames,
    ...domain.beds,
    ...domain.syntheticRows,
    ...extra,
  ];

  for (const token of corpus) {
    for (const char of `${token}`) {
      if (char === ' ') continue;
      chars.add(char);
    }
  }

  return [...chars].sort((a, b) => a.localeCompare(b));
}

ensureDir(generatedDir);

const source = readFileSync(ocrEnginePath, 'utf8');
const medicalBlock = extractBetween(source, 'MEDICAL_TERMS:', 'MEDICATIONS: new Set([');
const medicationBlock = extractBetween(source, 'MEDICATIONS: new Set([', 'ARABIC_FIRST_NAMES: new Set([');
const firstNamesBlock = extractBetween(source, 'ARABIC_FIRST_NAMES: new Set([', 'FAMILY_NAMES: new Set([');
const familyNamesBlock = extractBetween(source, 'FAMILY_NAMES: new Set([', '// Single-row Levenshtein');

const domain = {
  generatedAt: new Date().toISOString(),
  medicalTerms: [...new Set(extractMedicalTerms(medicalBlock).map(normalizeToken).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
  medications: [...new Set(extractQuotedStrings(medicationBlock).map(normalizeToken).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
  firstNames: [...new Set(extractQuotedStrings(firstNamesBlock).map(normalizeToken).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
  familyNames: [...new Set(extractQuotedStrings(familyNamesBlock).map(normalizeToken).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
  beds: buildBeds(),
  statusTokens: ['NKDA', 'DNR', 'DNAR', 'FULL', 'NFR', 'COMFORT'],
  wardTokens: ['ICU', 'CCU', 'NICU', 'PICU', 'HDU', 'MAU', 'AMU', 'WARD 5', 'WARD 7', 'ER'],
  oxygenTokens: ['RA', 'NC', 'NRB', 'BIPAP', 'VENT', 'HFNC 40L'],
  isolationTokens: ['CONTACT', 'DROPLET', 'AIRBORNE', 'NEUTROPENIC'],
};

domain.syntheticRows = buildPhrases(domain);
const charset = buildCharset(domain);

writeFileSync(resolve(generatedDir, 'medtriage_domain_lexicon.json'), `${JSON.stringify(domain, null, 2)}\n`);
writeFileSync(resolve(generatedDir, 'medtriage_charset.txt'), `${charset.join('\n')}\n`);
writeFileSync(resolve(generatedDir, 'medtriage_corpus.txt'), `${domain.syntheticRows.join('\n')}\n`);

console.log('Built OCR training workspace');
console.log(`  Medical terms: ${domain.medicalTerms.length}`);
console.log(`  Medications:   ${domain.medications.length}`);
console.log(`  First names:   ${domain.firstNames.length}`);
console.log(`  Family names:  ${domain.familyNames.length}`);
console.log(`  Charset chars: ${charset.length}`);
console.log(`  Sample rows:   ${domain.syntheticRows.length}`);
