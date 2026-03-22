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

function uniqueTokens(values) {
  return [...new Set(values.map(normalizeToken).filter(Boolean))];
}

function toLowerIfLatin(text) {
  if (/[\u0600-\u06FF]/.test(text)) return text;
  return text.toLowerCase();
}

function toTitleIfLatin(text) {
  if (/[\u0600-\u06FF]/.test(text)) return text;
  return `${text || ''}`
    .split(/\s+/)
    .filter(Boolean)
    .map(token => {
      if (/^(?:ICU|ER|CCU|NICU|PICU|HDU|MAU|AMU|O2)$/i.test(token)) return token.toUpperCase();
      return `${token[0]?.toUpperCase() || ''}${token.slice(1).toLowerCase()}`;
    })
    .join(' ');
}

function expandAlPrefixVariants(text) {
  const normalized = normalizeToken(text);
  if (!normalized) return [];
  const variants = new Set([normalized]);
  const match = normalized.match(/^Al[- ]?(.*)$/i);
  if (!match || !match[1]) return [...variants];

  const base = normalizeToken(match[1]).replace(/\s+/g, ' ');
  ['Al-', 'Al ', 'Al', 'al-', 'al ', 'al'].forEach(prefix => {
    variants.add(`${prefix}${base}`);
  });

  return [...variants];
}

function expandLatinNameVariants(text) {
  const normalized = normalizeToken(text);
  if (!normalized || /[\u0600-\u06FF]/.test(normalized)) return normalized ? [normalized] : [];

  const variants = new Set([normalized, toLowerIfLatin(normalized), toTitleIfLatin(normalized)]);
  const parts = normalized.split(/\s+/);

  if (parts.length >= 2) {
    const first = parts[0];
    const tail = parts.slice(1).join(' ');
    expandAlPrefixVariants(tail).forEach(variant => {
      variants.add(`${first} ${variant}`);
      variants.add(`${toLowerIfLatin(first)} ${toLowerIfLatin(variant)}`);
    });
  }

  return uniqueTokens([...variants]);
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

function buildRoomWardTokens() {
  const tokens = [];

  for (let room = 1; room <= 24; room++) {
    tokens.push(`${room}`);
    tokens.push(`${room}A`);
    tokens.push(`${room}B`);
  }

  for (let block = 1; block <= 24; block++) {
    for (let bed = 1; bed <= 20; bed += 3) {
      tokens.push(`${block}-${bed}`);
      tokens.push(`${block}/${bed}`);
    }
  }

  return uniqueTokens(tokens);
}

function buildWardTokens() {
  const tokens = [
    'ICU',
    'CCU',
    'NICU',
    'PICU',
    'HDU',
    'MAU',
    'AMU',
    'ER',
    'ER/Unassigned',
    'ER Unassigned',
    'Observation',
    'Holding',
    'Medical Ward',
    'Surgical Ward',
  ];

  for (let ward = 1; ward <= 40; ward++) {
    tokens.push(`Ward ${ward}`);
    tokens.push(`ward ${ward}`);
  }

  return uniqueTokens(tokens);
}

function buildSheetHeaders() {
  return uniqueTokens([
    'Room / Ward',
    'Room/Ward',
    'Ward / Room',
    'Room No',
    'Pt Name',
    'Patient name',
    'Patient Name',
    'Diagnosis',
    'Assigned Doctor',
    'Assigned doctor',
    'Doctor',
    'Consultant',
    'Team',
    'Status',
    'List Status',
    'Age/Sex',
    'Medication',
    'O2',
    'Isolation',
  ]);
}

function buildSheetHeaderRows() {
  return uniqueTokens([
    'Room / Ward Patient name Diagnosis Assigned Doctor Status',
    'Room/Ward Patient Name Diagnosis Assigned Doctor Status',
    'Room / Ward | Patient name | Diagnosis | Assigned Doctor | Status',
    'Room No Patient Name Diagnosis Consultant Status',
    'Room No. Patient Name Diagnosis Assigned Dr Status',
    'Room / Bed Patient name Diagnosis Consultant Status',
    'Ward / Bed Patient Name Diagnosis Assigned Dr List Status',
    'Pt Name Diagnosis Assigned doctor Status',
    'Patient name Diagnosis Assigned Doctor Status',
    'Room / Ward Patient Name Diagnosis Doctor Status',
    'Ward Patient name Diagnosis Assigned Doctor Status',
    'Ward / Room Patient name Diagnosis Team Status',
    'Patient name Diagnosis Status',
  ]);
}

function buildSectionTitles() {
  return uniqueTokens([
    'Male list (active)',
    'Female list (active)',
    'Male list (chronic)',
    'Female list (chronic)',
    'Male list (new)',
    'Female list (new)',
    'Male list active',
    'Female list active',
    'Male list chronic',
    'Female list chronic',
    'Male list pending',
    'Female list pending',
    'Male list transfer',
    'Female list transfer',
    'Active list',
    'Acute list',
    'Transfer list',
    'Male list',
    'Female list',
    'Chronic list',
    'Chronic patients',
    '(Chronic list)',
    'Active patients',
    'Ward census',
  ]);
}

function buildSheetTitles() {
  return uniqueTokens([
    'Ward Transfer Sheet',
    'Morning Census',
    'Daily Ward Board',
    'Ward Census',
    'Transfer List',
    'Ward Board',
    'Evening Census',
    'Night Census',
    'Bed Board',
    'Unit Census',
    'Daily Census',
  ]);
}

function buildDetailDiagnosisPhrases() {
  return uniqueTokens([
    'CVA left MCA occlusion',
    'Ischemic stroke',
    'biliary cholecystitis',
    'UTI, weight loss',
    'Chest infection and UTI',
    'Hypernatremia/AKI/DVT/CAP',
    'Urosepsis, hyperNa',
    'Lvf exacerbation',
    '?CVA',
    'Aspiration pneumonia',
    'Septic shock',
    'Acute urinary retention',
    'GI bleeding',
    'Drug overdose',
    'UTI/AKI',
    'Sepsis, hypotension',
    'CVA with aphasia',
    'Ischemic stroke with aphasia',
    'Biliary sepsis',
    'Chest infection, AKI',
    'NSTEMI, heart failure',
  ]);
}

function buildSheetStatuses() {
  return uniqueTokens([
    'New',
    'Active',
    'Chronic',
    'new',
    'active',
    'chronic',
    'Pending',
    'Transfer',
    'Follow-up',
    'ICU discharge',
    'ER discharge',
    'Ward discharge',
    'Resolved',
    'Deteriorating',
  ]);
}

function buildDoctorTitles() {
  return uniqueTokens([
    'Dr',
    'Dr.',
    'Doctor',
    'Consultant',
    'Team',
    'Registrar',
    'Resident',
    'On-call',
    'Consultant Dr',
    'Team Dr',
  ]);
}

function buildRosterNames(domain) {
  const latinFirstNames = domain.firstNames.filter(name => !/[\u0600-\u06FF]/.test(name)).slice(0, 180);
  const latinFamilyNames = domain.familyNames.filter(name => !/[\u0600-\u06FF]/.test(name)).slice(0, 160);
  const latinTailPool = uniqueTokens([...latinFamilyNames, ...latinFirstNames.filter(name => name.length >= 4)]);
  const arabicFirstNames = domain.firstNames.filter(name => /[\u0600-\u06FF]/.test(name)).slice(0, 120);
  const arabicFamilyNames = domain.familyNames.filter(name => /[\u0600-\u06FF]/.test(name)).slice(0, 120);
  const names = [];

  for (let i = 0; i < 240; i++) {
    const first = latinFirstNames[i % latinFirstNames.length];
    const family = latinFamilyNames[(i * 7 + 11) % latinFamilyNames.length];
    const tail = latinTailPool[(i * 5 + 17) % latinTailPool.length];

    expandLatinNameVariants(first).forEach(name => names.push(name));
    expandLatinNameVariants(`${first} ${family}`).forEach(name => names.push(name));
    expandLatinNameVariants(`${first} ${tail}`).forEach(name => names.push(name));
  }

  for (let i = 0; i < 160; i++) {
    const first = arabicFirstNames[i % arabicFirstNames.length];
    const family = arabicFamilyNames[(i * 3 + 9) % arabicFamilyNames.length];
    names.push(first);
    names.push(`${first} ${family}`);
  }

  return uniqueTokens(names);
}

function buildDoctorNames(domain) {
  const latinFirstNames = domain.firstNames.filter(name => !/[\u0600-\u06FF]/.test(name)).slice(0, 120);
  const latinFamilyNames = domain.familyNames.filter(name => !/[\u0600-\u06FF]/.test(name)).slice(0, 120);
  const doctors = [];

  for (let i = 0; i < 180; i++) {
    const first = latinFirstNames[(i * 3 + 7) % latinFirstNames.length];
    const family = latinFamilyNames[(i * 5 + 13) % latinFamilyNames.length];
    expandLatinNameVariants(first).forEach(name => doctors.push(name));
    expandLatinNameVariants(`${first} ${family}`).forEach(name => doctors.push(name));
  }

  return uniqueTokens(doctors);
}

function buildPhrases(domain) {
  const diagnoses = domain.medicalTerms.slice(0, 160);
  const meds = domain.medications.slice(0, 180);
  const beds = domain.beds.slice(0, 160);
  const roomWardTokens = domain.roomWardTokens;
  const numericRoomTokens = roomWardTokens.filter(token => /^\d+$/.test(token));
  const wardTokens = domain.wardTokens;
  const sheetTitles = domain.sheetTitles;
  const sheetHeaders = domain.sheetHeaders;
  const sheetHeaderRows = domain.sheetHeaderRows;
  const sectionTitles = domain.sectionTitles;
  const sheetStatuses = domain.sheetStatuses;
  const detailDiagnosisPhrases = domain.detailDiagnosisPhrases;
  const rosterNames = domain.rosterNames.slice(0, 260);
  const doctorNames = domain.doctorNames.slice(0, 180);
  const doctorTitles = domain.doctorTitles;
  const rows = [];

  rows.push(...sheetTitles);
  rows.push(...sheetHeaders);
  rows.push(...sheetHeaderRows);
  rows.push(...sectionTitles);
  rows.push(...sheetStatuses);
  rows.push(...roomWardTokens);
  rows.push(...wardTokens);
  rows.push(...detailDiagnosisPhrases);

  for (const name of rosterNames) {
    rows.push(name);
  }

  for (const doctor of doctorNames) {
    rows.push(doctor);
    rows.push(`Dr ${doctor}`);
    rows.push(`Dr. ${doctor}`);
    rows.push(`Consultant ${doctor}`);
    rows.push(`Team ${doctor}`);
  }

  for (let i = 0; i < 420; i++) {
    const age = 18 + (i % 73);
    const gender = i % 2 === 0 ? 'M' : 'F';
    const bed = beds[i % beds.length];
    const room = roomWardTokens[i % roomWardTokens.length];
    const numericRoom = numericRoomTokens[i % Math.max(numericRoomTokens.length, 1)] || room;
    const roomAlt = roomWardTokens[(i * 7 + 19) % roomWardTokens.length];
    const roomThird = roomWardTokens[(i * 11 + 23) % roomWardTokens.length];
    const ward = wardTokens[i % wardTokens.length];
    const wardAlt = wardTokens[(i * 13 + 7) % wardTokens.length];
    const patientName = rosterNames[i % rosterNames.length];
    const patientNameLower = toLowerIfLatin(patientName);
    const patientNameAlt = rosterNames[(i * 5 + 17) % rosterNames.length];
    const patientNameThird = rosterNames[(i * 9 + 31) % rosterNames.length];
    const patientNameParts = patientName.split(/\s+/).filter(Boolean);
    const patientNameHead = patientNameParts[0] || patientName;
    const patientNameTail = patientNameParts.slice(1).join(' ') || patientName;
    const patientNameAltParts = patientNameAlt.split(/\s+/).filter(Boolean);
    const patientNameAltHead = patientNameAltParts[0] || patientNameAlt;
    const patientNameAltTail = patientNameAltParts.slice(1).join(' ') || patientNameAlt;
    const doctor = doctorNames[(i * 3 + 5) % doctorNames.length];
    const doctorLower = toLowerIfLatin(doctor);
    const doctorAlt = doctorNames[(i * 5 + 21) % doctorNames.length];
    const doctorTitleAlt = doctorTitles[(i * 7 + 13) % doctorTitles.length];
    const diagnosis = diagnoses[(i * 5 + 11) % diagnoses.length];
    const detailDiagnosis = detailDiagnosisPhrases[i % detailDiagnosisPhrases.length];
    const detailDiagnosisAlt = detailDiagnosisPhrases[(i * 3 + 7) % detailDiagnosisPhrases.length];
    const detailDiagnosisThird = detailDiagnosisPhrases[(i * 7 + 15) % detailDiagnosisPhrases.length];
    const medication = meds[(i * 7 + 17) % meds.length];
    const status = sheetStatuses[(i * 2 + 3) % sheetStatuses.length];
    const statusAlt = sheetStatuses[(i * 5 + 9) % sheetStatuses.length];
    const statusThird = sheetStatuses[(i * 7 + 11) % sheetStatuses.length];
    const section = sectionTitles[(i * 3 + 1) % sectionTitles.length];
    const sheetTitle = sheetTitles[(i * 7 + 9) % sheetTitles.length];
    const doctorTitle = doctorTitles[(i * 5 + 7) % doctorTitles.length];
    const headerRow = sheetHeaderRows[i % sheetHeaderRows.length];

    rows.push(sheetTitle);
    rows.push(`${sheetTitle} ${section}`);
    rows.push(`${sheetTitle} ${headerRow}`);
    rows.push(`${sheetTitle} ${section} ${headerRow}`);
    rows.push(`${sheetTitle} ${section} ${ward}`);
    rows.push(`${sheetTitle} ${ward} ${headerRow}`);
    rows.push(`${sheetTitle} ${section} ${ward} ${headerRow}`);
    rows.push(`${sheetTitle} ${section} ${ward} ${status}`);
    rows.push(`${bed} ${patientName} ${age}/${gender} ${diagnosis}`);
    rows.push(`${bed} ${patientName} ${age}/${gender} ${diagnosis} ${medication}`);
    rows.push(`${bed} ${patientName} ${detailDiagnosis}`);
    rows.push(`${room} ${patientName}`);
    rows.push(`${room} ${patientName} ${diagnosis}`);
    rows.push(`${room} ${patientName} ${detailDiagnosis}`);
    rows.push(`${room} ${patientName} ${diagnosis} ${doctor} ${status}`);
    rows.push(`${room} ${patientName} ${detailDiagnosis} ${doctor} ${status}`);
    rows.push(`${numericRoom} ${patientName} ${detailDiagnosis} ${doctorTitle} ${doctor} ${status}`);
    rows.push(`${numericRoom} ${patientNameLower} ${detailDiagnosis} ${doctorTitle} ${doctorLower} ${status}`);
    rows.push(`${ward} ${numericRoom} ${patientName} ${detailDiagnosis} ${doctorTitle} ${doctor} ${status}`);
    rows.push(`${room} | ${patientName} | ${diagnosis} | ${doctor} | ${status}`);
    rows.push(`${room} | ${patientName} | ${detailDiagnosis} | ${doctor} | ${status}`);
    rows.push(`${numericRoom} | ${patientName} | ${detailDiagnosis} | ${doctorTitle} ${doctor} | ${status}`);
    rows.push(`${numericRoom} | ${patientNameLower} | ${detailDiagnosis} | ${doctorTitle} ${doctorLower} | ${status}`);
    rows.push(`${room} | ${patientName} | ${diagnosis} | ${doctorTitle} ${doctor} | ${status}`);
    rows.push(`${ward} | ${numericRoom} | ${patientName} | ${detailDiagnosis} | ${doctorTitle} ${doctor} | ${status}`);
    rows.push(`${section} | ${ward} | ${patientName} | ${detailDiagnosis} | ${status}`);
    rows.push(`${doctorTitle} ${doctor} ${status}`);
    rows.push(`${doctorTitle} ${doctor} ${ward} ${status}`);
    rows.push(`${patientName} ${diagnosis} ${doctor} ${status}`);
    rows.push(`${patientName} ${detailDiagnosis} ${doctor} ${status}`);
    rows.push(`${patientNameLower} ${diagnosis} ${doctorLower} ${status}`);
    rows.push(`${patientName} ${diagnosis} ${doctorTitle} ${doctor}`);
    rows.push(`${patientName} ${detailDiagnosis} ${doctorTitle} ${doctor}`);
    rows.push(`${patientName} ${diagnosis} ${medication}`);
    rows.push(`${patientName} ${detailDiagnosis}`);
    rows.push(`${patientName} ${status}`);
    rows.push(`${ward} ${patientName} ${diagnosis}`);
    rows.push(`${section} ${patientName} ${detailDiagnosis}`);
    rows.push(`${section} ${ward}`);
    rows.push(`${section} ${ward} ${status}`);
    rows.push(`${section} ${headerRow}`);
    rows.push(`${section} ${ward} ${headerRow}`);
    rows.push(`${section} ${ward} ${headerRow} ${status}`);
    rows.push(`${sheetTitle} ${section} ${headerRow} ${ward} ${numericRoom} ${patientName} ${detailDiagnosis} ${doctorTitle} ${doctor} ${status} ${roomAlt} ${patientNameAlt} ${detailDiagnosisAlt} ${doctorTitleAlt} ${doctorAlt} ${statusAlt}`);
    rows.push(`${section} ${headerRow} ${ward} ${room} ${patientName} ${diagnosis} ${doctorTitle} ${doctor} ${status} ${roomAlt} ${patientNameAlt} ${detailDiagnosisAlt} ${statusAlt} ${roomThird} ${patientNameThird} ${detailDiagnosisThird} ${statusThird}`);
    rows.push(`${sheetTitle} ${headerRow} ${ward} ${numericRoom} ${patientName} ${detailDiagnosis} ${doctorTitle} ${doctor} ${status} ${headerRow} ${roomAlt} ${patientNameAlt} ${detailDiagnosisAlt} ${doctorTitleAlt} ${doctorAlt} ${statusAlt}`);
    rows.push(`${sheetTitle} ${section} ${headerRow} ${ward} ${numericRoom} ${patientName} ${detailDiagnosis} ${doctorTitle} ${doctor} ${status} ${detailDiagnosisAlt} ${roomAlt} ${patientNameAlt} ${detailDiagnosisThird} ${doctorTitleAlt} ${doctorAlt} ${statusAlt}`);
    rows.push(`${section} ${headerRow} ${ward} ${numericRoom} ${patientName} ${detailDiagnosis} ${doctorTitle} ${doctor} ${status} ${wardAlt} ${roomAlt} ${patientNameAlt} ${detailDiagnosisAlt} ${statusAlt} ${roomThird} ${patientNameThird} ${detailDiagnosisThird} ${doctorTitleAlt} ${doctorAlt} ${statusThird}`);
    rows.push(`${sheetTitle} ${section} ${headerRow} ${ward} ${numericRoom} ${patientNameHead} ${detailDiagnosis} ${doctorTitle} ${doctor} ${status} ${patientNameTail} ${roomAlt} ${patientNameAltHead} ${detailDiagnosisAlt} ${doctorTitleAlt} ${doctorAlt} ${statusAlt} ${patientNameAltTail}`);
    rows.push(`${sheetTitle} ${section} Patient name Diagnosis Assigned Dr ${ward} ${numericRoom} ${patientName} ${detailDiagnosis} ${doctorTitle} ${doctor} ${status} ${patientNameAlt} ${detailDiagnosisAlt} ${doctorTitleAlt} ${doctorAlt}`);
    rows.push(`${sheetTitle} ${section} Room / Ward Patient name Diagnosis Assigned Doctor ${ward} ${numericRoom} ${patientName} ${detailDiagnosis} ${doctorTitle} ${doctor} ${roomAlt} ${patientNameAlt} ${diagnosis}`);
    rows.push(`${sheetHeaders[i % sheetHeaders.length]} ${sheetHeaders[(i + 1) % sheetHeaders.length]}`);
  }

  return uniqueTokens(rows);
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
    ...domain.roomWardTokens,
    ...domain.rosterNames,
    ...domain.doctorNames,
    ...domain.sheetHeaders,
    ...domain.sheetHeaderRows,
    ...domain.sectionTitles,
    ...domain.sheetStatuses,
    ...domain.doctorTitles,
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
  wardTokens: buildWardTokens(),
  oxygenTokens: ['RA', 'NC', 'NRB', 'BIPAP', 'VENT', 'HFNC 40L'],
  isolationTokens: ['CONTACT', 'DROPLET', 'AIRBORNE', 'NEUTROPENIC'],
  roomWardTokens: buildRoomWardTokens(),
  sheetHeaders: buildSheetHeaders(),
  sheetHeaderRows: buildSheetHeaderRows(),
  sectionTitles: buildSectionTitles(),
  sheetTitles: buildSheetTitles(),
  sheetStatuses: buildSheetStatuses(),
  detailDiagnosisPhrases: buildDetailDiagnosisPhrases(),
  doctorTitles: buildDoctorTitles(),
};

domain.rosterNames = buildRosterNames(domain);
domain.doctorNames = buildDoctorNames(domain);
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
console.log(`  Roster names:  ${domain.rosterNames.length}`);
console.log(`  Doctors:       ${domain.doctorNames.length}`);
console.log(`  Charset chars: ${charset.length}`);
console.log(`  Sample rows:   ${domain.syntheticRows.length}`);
