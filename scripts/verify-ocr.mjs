import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Bundle ocrEngine.js — mark paddleocr and onnxruntime-web as external
// (we only test the analysis pipeline, not the OCR runtime)
const { analyzeOcrWords } = await import(pathToFileURL(resolve('src/modules/evacuation/ocrEngine.js')).href);

const requiredRuntimeAssets = [
  'public/models/ocr/det.onnx',
  'public/models/ocr/latin-rec.onnx',
  'public/models/ocr/latin-dict.txt',
  'public/models/ocr/arabic-rec.onnx',
  'public/models/ocr/arabic-dict.txt',
];

for (const assetPath of requiredRuntimeAssets) {
  assert.ok(existsSync(resolve(assetPath)), `missing packaged OCR runtime asset: ${assetPath}`);
}

function word(text, x, y, confidence = 92, width = text.length * 10) {
  return {
    text,
    confidence,
    bbox: { x0: x, y0: y, x1: x + width, y1: y + 20 },
  };
}

// Test 1: Single patient line
const singlePatient = analyzeOcrWords([
  word('E-M-03', 10, 10),
  word('Ahmed', 100, 10),
  word('Ali', 170, 10),
  word('67/M', 260, 10),
  word('NSTEM1', 340, 10),
  word('DM2', 430, 10),
], 600, 180);

assert.equal(singlePatient.patients.length, 1, 'expected one patient from single-line row');
assert.equal(singlePatient.patients[0].bed, 'E-M-03');
assert.equal(singlePatient.patients[0].age, 67);
assert.equal(singlePatient.patients[0].gender, 'M');
assert.match(singlePatient.patients[0].fullName, /Ahmed Ali/i);
assert.match(singlePatient.patients[0].dx, /NSTEMI/);

// Test 2: Two patients on separate rows
const twoPatients = analyzeOcrWords([
  word('E-M-03', 10, 10),
  word('Ahmed', 100, 10),
  word('Ali', 170, 10),
  word('67/M', 260, 10),
  word('NSTEMI', 340, 10),
  word('E-M-07', 10, 60),
  word('Fatima', 100, 60),
  word('Hassan', 180, 60),
  word('45/F', 280, 60),
  word('CAP', 350, 60),
], 700, 220);

assert.equal(twoPatients.patients.length, 2, 'expected two patients from two rows');
assert.match(twoPatients.patients[1].fullName, /Fatima Hassan/i);
assert.equal(twoPatients.patients[1].gender, 'F');

// Test 3: Multi-line patient (continuation lines)
const multilinePatient = analyzeOcrWords([
  word('E-M-09', 10, 10),
  word('Mona', 100, 10),
  word('74/F', 180, 10),
  word('CHF', 100, 36),
  word('Furosemide', 170, 36),
], 500, 180);

assert.equal(multilinePatient.patients.length, 1, 'expected continuation lines to stay together');
assert.match(multilinePatient.patients[0].dx, /CHF/);
assert.match(multilinePatient.patients[0].meds, /Furosemide/i);

// Test 4: Table layout with header row should prefer column-aware parsing
const tablePatients = analyzeOcrWords([
  word('Bed', 10, 10, 98, 40),
  word('Name', 120, 10, 98, 50),
  word('Age', 260, 10, 98, 35),
  word('Dx', 340, 10, 98, 30),
  word('Meds', 450, 10, 98, 45),
  word('E-M-11', 10, 48),
  word('Huda', 120, 48),
  word('Saleh', 190, 48),
  word('33/F', 270, 48),
  word('DKA', 340, 48),
  word('Insulin', 450, 48),
  word('E-M-12', 10, 84),
  word('Omar', 120, 84),
  word('Nasser', 190, 84),
  word('58/M', 270, 84),
  word('CAP', 340, 84),
  word('Ceftriax0ne', 450, 84),
], 700, 220);

assert.equal(tablePatients.patients.length, 2, 'expected two patients from a headered table');
assert.ok(tablePatients.hypotheses.some(h => h.id === 'table-grid'), 'expected table-grid hypothesis to be generated');
assert.match(tablePatients.patients[1].meds, /Ceftriaxone/i);

// Test 5: Two-column board should split into lanes instead of merging rows
const lanePatients = analyzeOcrWords([
  word('E-M-01', 20, 10),
  word('Layla', 110, 10),
  word('67/F', 200, 10),
  word('NSTEM1', 290, 10),
  word('E-M-02', 20, 58),
  word('Saad', 110, 58),
  word('45/M', 200, 58),
  word('CHF', 290, 58),
  word('E-M-21', 520, 10),
  word('Noor', 610, 10),
  word('29/F', 700, 10),
  word('UTI', 790, 10),
  word('E-M-22', 520, 58),
  word('Faisal', 610, 58),
  word('72/M', 700, 58),
  word('COPD', 790, 58),
], 980, 220);

assert.equal(lanePatients.patients.length, 4, 'expected lane splitting to recover four patients');
assert.ok(lanePatients.hypotheses.some(h => /lane|spatial/i.test(h.id)), 'expected a lane-aware or spatial hypothesis');
assert.deepEqual(
  lanePatients.patients.map(patient => patient.bed).sort(),
  ['E-M-01', 'E-M-02', 'E-M-21', 'E-M-22'],
  'expected each lane row to remain a distinct patient'
);
assert.equal(lanePatients.patients.find(patient => patient.bed === 'E-M-01')?.age, 67);
assert.match(lanePatients.patients.find(patient => patient.bed === 'E-M-21')?.fullName || '', /Noor/i);
assert.match(lanePatients.patients.find(patient => patient.bed === 'E-M-21')?.dx || '', /UTI/i);

// Test 6: Headerless aligned board should infer columns from repeated x-structure
const inferredColumns = analyzeOcrWords([
  word('E-M-15', 10, 20),
  word('Nora', 110, 20),
  word('Ali', 180, 20),
  word('42/F', 290, 20),
  word('CAP', 380, 20),
  word('Azithr0mycin', 490, 20),
  word('E-M-16', 10, 60),
  word('Saif', 110, 60),
  word('Jaber', 180, 60),
  word('71/M', 290, 60),
  word('CHF', 380, 60),
  word('Fur0semide', 490, 60),
  word('E-M-17', 10, 100),
  word('Mariam', 110, 100),
  word('Saleh', 205, 100),
  word('29/F', 290, 100),
  word('UTI', 380, 100),
  word('Ceftriax0ne', 490, 100),
], 780, 240);

assert.equal(inferredColumns.patients.length, 3, 'expected three patients from a cropped headerless board');
assert.ok(inferredColumns.hypotheses.some(h => h.id === 'schema-columns'), 'expected schema-columns hypothesis to be generated');
assert.match(inferredColumns.patients[0].meds, /Azithromycin/i);
assert.match(inferredColumns.patients[1].meds, /Furosemide/i);
assert.match(inferredColumns.patients[2].meds, /Ceftriaxone/i);

// Test 7: Sheet-style header synonyms should still trigger table parsing
const sheetHeaderSynonyms = analyzeOcrWords([
  word('Patient Name', 120, 10, 98, 90),
  word('Room No', 10, 10, 98, 70),
  word('Age/Sex', 270, 10, 98, 70),
  word('Diagnosis', 380, 10, 98, 85),
  word('Medication', 520, 10, 98, 95),
  word('A-M-01', 10, 50),
  word('Sara', 120, 50),
  word('Yousef', 190, 50),
  word('44/F', 280, 50),
  word('CAP', 380, 50),
  word('Azithromycin', 520, 50),
], 760, 180);

assert.equal(sheetHeaderSynonyms.strategy, 'table-grid', 'expected sheet-style headers to prefer table-grid');
assert.equal(sheetHeaderSynonyms.patients.length, 1, 'expected one patient from a one-row sheet');
assert.match(sheetHeaderSynonyms.patients[0].fullName || '', /Sara Yousef/i);
assert.match(sheetHeaderSynonyms.patients[0].meds || '', /Azithromycin/i);

// Test 8: Wrapped diagnosis/medication rows should stay attached to the same patient
const wrappedTable = analyzeOcrWords([
  word('Bed', 10, 10, 98, 40),
  word('Name', 120, 10, 98, 50),
  word('Age/Sex', 260, 10, 98, 70),
  word('Diagnosis', 360, 10, 98, 85),
  word('Meds', 560, 10, 98, 50),
  word('E-M-21', 10, 52),
  word('Nora', 120, 52),
  word('Ali', 180, 52),
  word('42/F', 270, 52),
  word('Sepsis', 360, 52),
  word('Piperacillin', 560, 52),
  word('shock', 360, 82),
  word('Tazobactam', 560, 82),
  word('E-M-22', 10, 118),
  word('Saif', 120, 118),
  word('Jaber', 180, 118),
  word('71/M', 270, 118),
  word('CHF', 360, 118),
  word('Furosemide', 560, 118),
], 860, 260);

assert.equal(wrappedTable.strategy, 'table-grid', 'expected wrapped table rows to stay in the table-grid path');
assert.equal(wrappedTable.patients.length, 2, 'expected wrapped diagnosis/medication lines to merge into one patient');
assert.match(wrappedTable.patients[0].fullName || '', /Nora Ali/i);
assert.match(wrappedTable.patients[0].dx || '', /SEPSIS/i);
assert.match(wrappedTable.patients[0].dx || '', /shock/i);
assert.match(wrappedTable.patients[0].meds || '', /Piperacillin/i);
assert.match(wrappedTable.patients[0].meds || '', /Tazobactam/i);

// Test 9: Sheet titles above the header should be ignored while preserving columns
const titledSheet = analyzeOcrWords([
  word('Ward Transfer Sheet', 240, 8, 97, 170),
  word('Morning Census', 280, 34, 97, 130),
  word('Room No', 10, 68, 98, 70),
  word('Patient Name', 120, 68, 98, 90),
  word('Age/Sex', 260, 68, 98, 70),
  word('Diagnosis', 360, 68, 98, 80),
  word('Medication', 500, 68, 98, 90),
  word('O2', 650, 68, 98, 25),
  word('Isolation', 720, 68, 98, 70),
  word('E-M-41', 10, 106),
  word('Mona', 120, 106),
  word('Ali', 180, 106),
  word('63/F', 270, 106),
  word('CAP', 360, 106),
  word('Ceftriaxone', 500, 106),
  word('NC', 650, 106),
  word('Droplet', 720, 106),
  word('E-M-42', 10, 142),
  word('Hassan', 120, 142),
  word('45/M', 270, 142),
  word('NSTEMI', 360, 142),
  word('Heparin', 500, 142),
  word('RA', 650, 142),
], 860, 260);

assert.equal(titledSheet.strategy, 'table-grid', 'expected titled sheets to still resolve as table-grid');
assert.equal(titledSheet.patients.length, 2, 'expected two patients from a titled ward sheet');
assert.equal(titledSheet.patients[0].o2, 'NASAL_CANNULA');
assert.equal(titledSheet.patients[0].iso, 'DROPLET');
assert.equal(titledSheet.patients[1].o2, 'NONE');

// Test 10: Spreadsheet-style ward lists should preserve ward bands, repeated headers, doctors, and statuses
const spreadsheetWardSheet = analyzeOcrWords([
  word('Male list (active)', 40, 10, 98, 180),
  word('Room / Ward', 20, 52, 98, 95),
  word('Patient name', 170, 52, 98, 110),
  word('Diagnosis', 410, 52, 98, 90),
  word('Assigned Doctor', 650, 52, 98, 135),
  word('Status', 860, 52, 98, 60),
  word('Ward 20', 470, 84, 97, 80),
  word('1-17', 50, 120),
  word('Nawaf', 200, 120),
  word('Chest infection', 420, 120, 92, 140),
  word('Bader', 700, 120),
  word('16-4', 50, 156),
  word('Hassan', 200, 156),
  word('Hypernatremia/AKI/DVT/CAP', 360, 156, 92, 220),
  word('Noura', 700, 156),
  word('Jamal', 210, 192),
  word('Lvf exacerbation', 420, 192, 92, 160),
  word('New', 870, 192, 92, 40),
  word('Ward 19', 470, 228, 97, 80),
  word('Bader', 200, 264),
  word('Chest infection and UTI', 360, 264, 92, 200),
  word('New', 870, 264, 92, 40),
  word('Ali hussain', 180, 300, 92, 110),
  word('?CVA', 430, 300, 92, 60),
  word('New', 870, 300, 92, 40),
  word('Ahmad alessa', 170, 336, 92, 130),
  word('CVA left MCA occlusion', 380, 336, 92, 200),
  word('ICU discharge', 840, 336, 92, 120),
  word('(Chronic list)', 30, 400, 98, 160),
  word('Patient name', 180, 438, 98, 110),
  word('Diagnosis', 430, 438, 98, 90),
  word('Assigned Doctor', 650, 438, 98, 135),
  word('Status', 860, 438, 98, 60),
  word('Ward 19', 35, 474, 98, 80),
  word('1', 80, 510),
  word('Abdullah', 190, 510),
  word('Urosepsis, hyperNa', 390, 510, 92, 180),
  word('Bader', 700, 510),
  word('Chronic', 850, 510, 92, 70),
], 1000, 620);

assert.equal(spreadsheetWardSheet.strategy, 'table-grid', 'expected spreadsheet-style ward sheets to prefer table-grid');
assert.equal(spreadsheetWardSheet.patients.length, 7, 'expected seven patients from the spreadsheet-style ward sheet');
assert.ok(!spreadsheetWardSheet.patients.some(patient => /patient name|assigned doctor|male list|chronic list/i.test(patient.fullName || '')), 'expected titles and repeated headers to be ignored');

const nawaf = spreadsheetWardSheet.patients.find(patient => /Nawaf/i.test(patient.fullName || ''));
assert.ok(nawaf, 'expected Nawaf row to be parsed');
assert.equal(nawaf.bed, '1-17');
assert.equal(nawaf.ward, 'Ward 20');
assert.equal(nawaf.assignedDoctor, 'Bader');
assert.match(nawaf.dx || '', /Chest infection/i);

const hassan = spreadsheetWardSheet.patients.find(patient => /Hassan/i.test(patient.fullName || ''));
assert.ok(hassan, 'expected Hassan row to be parsed');
assert.equal(hassan.bed, '16-4');
assert.equal(hassan.ward, 'Ward 20');
assert.equal(hassan.assignedDoctor, 'Noura');
assert.match(hassan.dx || '', /Hypernatremia/i);

const jamal = spreadsheetWardSheet.patients.find(patient => /Jamal/i.test(patient.fullName || ''));
assert.ok(jamal, 'expected Jamal row to be parsed');
assert.equal(jamal.ward, 'Ward 20');
assert.equal(jamal.sheetStatus, 'NEW');
assert.match(jamal.dx || '', /Lvf exacerbation/i);

const chronicAbdullah = spreadsheetWardSheet.patients.find(patient => /Abdullah/i.test(patient.fullName || '') && patient.sheetStatus === 'CHRONIC');
assert.ok(chronicAbdullah, 'expected chronic Abdullah row to be parsed');
assert.equal(chronicAbdullah.bed, '1');
assert.equal(chronicAbdullah.ward, 'Ward 19');
assert.equal(chronicAbdullah.assignedDoctor, 'Bader');
assert.match(chronicAbdullah.dx || '', /Urosepsis/i);

console.log('OCR verification passed');
