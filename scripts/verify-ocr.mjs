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

// Test 11: Lowercase transliterated patient and doctor names should stay name-like
const lowercaseNamesSheet = analyzeOcrWords([
  word('Patient name', 160, 20, 98, 110),
  word('Diagnosis', 420, 20, 98, 90),
  word('Assigned Doctor', 650, 20, 98, 135),
  word('ali hussain', 170, 60, 92, 110),
  word('CVA left MCA occlusion', 380, 60, 92, 200),
  word('saleh', 700, 60, 92, 60),
  word('ahmad alessa', 170, 96, 92, 130),
  word('Chest infection', 400, 96, 92, 140),
  word('noura', 700, 96, 92, 60),
  word('jamal', 170, 132, 92, 90),
  word('UTI', 420, 132, 92, 40),
  word('zahra', 700, 132, 92, 60),
], 900, 220);

assert.equal(lowercaseNamesSheet.strategy, 'table-grid', 'expected lowercase transliterated sheets to stay in table-grid');
assert.equal(lowercaseNamesSheet.patients.length, 3, 'expected three lowercase transliterated rows');

const aliHussain = lowercaseNamesSheet.patients.find(patient => /ali hussain/i.test(patient.fullName || ''));
assert.ok(aliHussain, 'expected ali hussain to be recognized as a patient name');
assert.equal(aliHussain.assignedDoctor, 'saleh');
assert.match(aliHussain.dx || '', /CVA left MCA occlusion/i);
assert.ok((aliHussain.fieldConfidence?.fullName || 0) >= 0.85, 'expected ali hussain to carry strong name confidence');

const ahmadAlessa = lowercaseNamesSheet.patients.find(patient => /ahmad alessa/i.test(patient.fullName || ''));
assert.ok(ahmadAlessa, 'expected ahmad alessa to be recognized as a patient name');
assert.equal(ahmadAlessa.assignedDoctor, 'noura');
assert.match(ahmadAlessa.dx || '', /Chest infection/i);
assert.ok((ahmadAlessa.fieldConfidence?.fullName || 0) >= 0.85, 'expected ahmad alessa to carry strong name confidence');

const jamalPatient = lowercaseNamesSheet.patients.find(patient => /^jamal$/i.test(patient.fullName || ''));
assert.ok(jamalPatient, 'expected jamal to be recognized as a patient name');
assert.equal(jamalPatient.assignedDoctor, 'zahra');
assert.match(jamalPatient.dx || '', /UTI/i);
assert.ok((jamalPatient.fieldConfidence?.fullName || 0) >= 0.85, 'expected jamal to carry strong name confidence');

// Test 12: Headerless aligned rows should still recover names, diagnoses, doctors, and statuses
const headerlessAlignedRows = analyzeOcrWords([
  word('ali hussain', 160, 40, 92, 110),
  word('CVA left MCA occlusion', 380, 40, 92, 200),
  word('saleh', 700, 40, 92, 60),
  word('new', 850, 40, 92, 40),
  word('ahmad alessa', 160, 76, 92, 130),
  word('Chest infection', 390, 76, 92, 140),
  word('noura', 700, 76, 92, 60),
  word('new', 850, 76, 92, 40),
  word('jamal', 160, 112, 92, 80),
  word('UTI', 420, 112, 92, 40),
  word('zahra', 700, 112, 92, 60),
  word('chronic', 840, 112, 92, 70),
], 940, 180);

assert.ok(['schema-columns', 'table-grid'].includes(headerlessAlignedRows.strategy), 'expected aligned headerless rows to resolve structurally');
assert.equal(headerlessAlignedRows.patients.length, 3, 'expected three patients from headerless aligned rows');

const headerlessAli = headerlessAlignedRows.patients.find(patient => /ali hussain/i.test(patient.fullName || ''));
assert.ok(headerlessAli, 'expected ali hussain to survive without headers');
assert.equal(headerlessAli.assignedDoctor, 'saleh');
assert.equal(headerlessAli.sheetStatus, 'NEW');
assert.match(headerlessAli.dx || '', /CVA left MCA occlusion/i);

const headerlessAhmad = headerlessAlignedRows.patients.find(patient => /ahmad alessa/i.test(patient.fullName || ''));
assert.ok(headerlessAhmad, 'expected ahmad alessa to survive without headers');
assert.equal(headerlessAhmad.assignedDoctor, 'noura');
assert.equal(headerlessAhmad.sheetStatus, 'NEW');
assert.match(headerlessAhmad.dx || '', /Chest infection/i);

const headerlessJamal = headerlessAlignedRows.patients.find(patient => /^jamal$/i.test(patient.fullName || ''));
assert.ok(headerlessJamal, 'expected jamal to survive without headers');
assert.equal(headerlessJamal.assignedDoctor, 'zahra');
assert.equal(headerlessJamal.sheetStatus, 'CHRONIC');
assert.match(headerlessJamal.dx || '', /UTI/i);

// Test 13: ALL CAPS names (PaddleOCR sometimes outputs in uppercase)
const allCapsNames = analyzeOcrWords([
  word('Bed', 10, 10, 98, 40),
  word('Name', 120, 10, 98, 50),
  word('Age', 310, 10, 98, 35),
  word('Dx', 400, 10, 98, 30),
  word('E-M-01', 10, 50),
  word('AHMED', 120, 50),
  word('ALI', 210, 50),
  word('45/M', 310, 50),
  word('NSTEMI', 400, 50),
  word('E-M-02', 10, 90),
  word('FATIMA', 120, 90),
  word('HASSAN', 210, 90),
  word('32/F', 310, 90),
  word('CAP', 400, 90),
  word('E-M-03', 10, 130),
  word('OMAR', 120, 130),
  word('67/M', 310, 130),
  word('CHF', 400, 130),
], 600, 240);

assert.equal(allCapsNames.patients.length, 3, 'expected three patients with ALL CAPS names');
assert.ok(allCapsNames.patients.some(p => /AHMED ALI|ahmed ali/i.test(p.fullName || '')), 'expected AHMED ALI to be detected as name');
assert.ok(allCapsNames.patients.some(p => /FATIMA HASSAN|fatima hassan/i.test(p.fullName || '')), 'expected FATIMA HASSAN to be detected as name');
assert.ok(allCapsNames.patients.some(p => /OMAR/i.test(p.fullName || '')), 'expected OMAR to be detected as name');

// Test 14: Mixed case names without bed numbers (just name + diagnosis)
const namesWithoutBeds = analyzeOcrWords([
  word('Ahmed Al-Mutairi', 10, 20, 92, 160),
  word('NSTEMI', 250, 20),
  word('DM2', 340, 20),
  word('Sara Alessa', 10, 60, 92, 120),
  word('CAP', 250, 60),
  word('Khalid', 10, 100, 92, 70),
  word('DVT', 250, 100),
], 500, 200);

assert.equal(namesWithoutBeds.patients.length, 3, 'expected three patients even without bed numbers');
assert.ok(namesWithoutBeds.patients.some(p => /Ahmed/i.test(p.fullName || '')), 'expected Ahmed to be detected');
assert.ok(namesWithoutBeds.patients.some(p => /Sara/i.test(p.fullName || '')), 'expected Sara to be detected');
assert.ok(namesWithoutBeds.patients.some(p => /Khalid/i.test(p.fullName || '')), 'expected Khalid to be detected');

// Test 15: Short names that could be confused with medical terms
const shortNamesSafe = analyzeOcrWords([
  word('E-M-01', 10, 20),
  word('Ali', 100, 20),
  word('67/M', 200, 20),
  word('AKI', 300, 20),
  word('E-M-02', 10, 60),
  word('Isa', 100, 60),
  word('45/M', 200, 60),
  word('CHF', 300, 60),
  word('E-M-03', 10, 100),
  word('Hind', 100, 100),
  word('32/F', 200, 100),
  word('UTI', 300, 100),
], 500, 200);

assert.equal(shortNamesSafe.patients.length, 3, 'expected three patients with short names');
assert.ok(shortNamesSafe.patients.some(p => /Ali/i.test(p.fullName || '')), 'expected Ali to be a name not confused with medical term');
assert.ok(shortNamesSafe.patients.some(p => /Isa/i.test(p.fullName || '')), 'expected Isa to be a name');
assert.ok(shortNamesSafe.patients.some(p => /Hind/i.test(p.fullName || '')), 'expected Hind to be a name');
// Make sure AKI is a diagnosis not swallowed as a name
assert.ok(shortNamesSafe.patients.find(p => /Ali/i.test(p.fullName || ''))?.dx?.includes('AKI'), 'expected AKI to be diagnosis not name');

// Test 16: Names with "Dr." prefix should detect doctor assignment
const doctorNames = analyzeOcrWords([
  word('Bed', 10, 10, 98, 40),
  word('Name', 120, 10, 98, 50),
  word('Dx', 300, 10, 98, 30),
  word('Doctor', 450, 10, 98, 60),
  word('E-M-05', 10, 50),
  word('Nasser', 120, 50),
  word('COPD', 300, 50),
  word('Dr.', 450, 50),
  word('Fahad', 500, 50),
  word('E-M-06', 10, 90),
  word('Reem', 120, 90),
  word('UTI', 300, 90),
  word('Dr.', 450, 90),
  word('Salem', 500, 90),
], 650, 180);

assert.equal(doctorNames.patients.length, 2, 'expected two patients with doctor names');
assert.ok(doctorNames.patients.some(p => /Nasser/i.test(p.fullName || '')), 'expected Nasser as patient name');
assert.ok(doctorNames.patients.some(p => /Reem/i.test(p.fullName || '')), 'expected Reem as patient name');

// Test 17: Whole-line pipe-delimited roster rows should preserve spreadsheet structure
const pipeDelimitedRows = analyzeOcrWords([
  word('Room / Ward | Patient name | Diagnosis | Assigned Doctor | Status', 20, 10, 98, 720),
  word('10 | ali hussain | CVA left MCA occlusion | Consultant saleh | New', 20, 50, 92, 690),
  word('11 | ahmad alessa | Chest infection | Team noura | Chronic', 20, 88, 92, 650),
], 980, 180);

assert.ok(['table-grid', 'schema-columns', 'row-bands'].includes(pipeDelimitedRows.strategy), 'expected pipe-delimited rows to resolve structurally');
assert.equal(pipeDelimitedRows.patients.length, 2, 'expected two patients from pipe-delimited roster rows');

const pipeAli = pipeDelimitedRows.patients.find(patient => /ali hussain/i.test(patient.fullName || ''));
assert.ok(pipeAli, 'expected ali hussain in pipe-delimited rows');
assert.equal(pipeAli.bed, '10');
assert.match(pipeAli.dx || '', /CVA left MCA occlusion/i);
assert.equal(pipeAli.assignedDoctor, 'saleh');
assert.equal(pipeAli.sheetStatus, 'NEW');

const pipeAhmad = pipeDelimitedRows.patients.find(patient => /ahmad alessa/i.test(patient.fullName || ''));
assert.ok(pipeAhmad, 'expected ahmad alessa in pipe-delimited rows');
assert.equal(pipeAhmad.bed, '11');
assert.match(pipeAhmad.dx || '', /Chest infection/i);
assert.equal(pipeAhmad.assignedDoctor, 'noura');
assert.equal(pipeAhmad.sheetStatus, 'CHRONIC');

// Test 18: Titled doctor cells should normalize down to the doctor name
const titledDoctorCells = analyzeOcrWords([
  word('Patient name', 180, 10, 98, 110),
  word('Diagnosis', 420, 10, 98, 90),
  word('Doctor', 650, 10, 98, 70),
  word('Status', 860, 10, 98, 60),
  word('ali hussain', 180, 52, 92, 120),
  word('CVA left MCA occlusion', 390, 52, 92, 220),
  word('Doctor saleh', 650, 52, 92, 130),
  word('New', 870, 52, 92, 40),
  word('jamal', 180, 90, 92, 80),
  word('UTI', 420, 90, 92, 40),
  word('Consultant noura', 650, 90, 92, 150),
  word('Chronic', 850, 90, 92, 70),
], 980, 170);

assert.equal(titledDoctorCells.patients.length, 2, 'expected titled doctor cells to stay attached to each patient');
const titledAli = titledDoctorCells.patients.find(patient => /ali hussain/i.test(patient.fullName || ''));
assert.ok(titledAli, 'expected ali hussain with titled doctor cell');
assert.equal(titledAli.assignedDoctor, 'saleh');
const titledJamal = titledDoctorCells.patients.find(patient => /^jamal$/i.test(patient.fullName || ''));
assert.ok(titledJamal, 'expected jamal with titled doctor cell');
assert.equal(titledJamal.assignedDoctor, 'noura');

// Test 19: Screenshot-like roster sections should inherit active/chronic status from section titles
const sectionContextRoster = analyzeOcrWords([
  word('Male list (active)', 40, 10, 98, 180),
  word('Room / Ward', 20, 52, 98, 95),
  word('Patient name', 170, 52, 98, 110),
  word('Diagnosis', 410, 52, 98, 90),
  word('Assigned Doctor', 650, 52, 98, 135),
  word('Status', 860, 52, 98, 60),
  word('Ward 19', 470, 84, 97, 80),
  word('Bader', 200, 120, 92, 80),
  word('Chest infection and UTI', 360, 120, 92, 200),
  word('Ali hussain', 180, 156, 92, 110),
  word('?CVA', 430, 156, 92, 60),
  word('Ahmad alessa', 170, 192, 92, 130),
  word('CVA left MCA occlusion', 380, 192, 92, 200),
  word('ICU discharge', 840, 192, 92, 120),
  word('(Chronic list)', 30, 250, 98, 160),
  word('Room / Ward', 20, 288, 98, 95),
  word('Patient name', 170, 288, 98, 110),
  word('Diagnosis', 410, 288, 98, 90),
  word('Assigned Doctor', 650, 288, 98, 135),
  word('Status', 860, 288, 98, 60),
  word('Ward 20', 470, 320, 97, 80),
  word('Mohammad', 190, 356, 92, 110),
  word('UTI, weight loss', 390, 356, 92, 170),
  word('noura', 700, 356, 92, 60),
], 1000, 460);

assert.ok(['table-grid', 'schema-columns', 'row-bands'].includes(sectionContextRoster.strategy), 'expected screenshot-like section roster to stay structural');
assert.equal(sectionContextRoster.patients.length, 4, 'expected four patients from section-context roster');

const sectionBader = sectionContextRoster.patients.find(patient => /^bader$/i.test(patient.fullName || ''));
assert.ok(sectionBader, 'expected Bader row from active section');
assert.equal(sectionBader.ward, 'Ward 19');
assert.equal(sectionBader.sheetStatus, 'ACTIVE');
assert.equal(sectionBader.gender, 'M');
assert.match(sectionBader.dx || '', /Chest infection/i);
assert.match(sectionBader.dx || '', /UTI/i);

const sectionAli = sectionContextRoster.patients.find(patient => /ali hussain/i.test(patient.fullName || ''));
assert.ok(sectionAli, 'expected ali hussain row from active section');
assert.equal(sectionAli.ward, 'Ward 19');
assert.equal(sectionAli.sheetStatus, 'ACTIVE');
assert.equal(sectionAli.gender, 'M');
assert.match(sectionAli.dx || '', /CVA/i);

const sectionAhmad = sectionContextRoster.patients.find(patient => /ahmad alessa/i.test(patient.fullName || ''));
assert.ok(sectionAhmad, 'expected ahmad alessa row with explicit status');
assert.equal(sectionAhmad.ward, 'Ward 19');
assert.equal(sectionAhmad.sheetStatus, 'ICU DISCHARGE');
assert.equal(sectionAhmad.gender, 'M');
assert.match(sectionAhmad.dx || '', /CVA left MCA occlusion/i);

const sectionMohammad = sectionContextRoster.patients.find(patient => /mohammad/i.test(patient.fullName || ''));
assert.ok(sectionMohammad, 'expected chronic-section Mohammad row');
assert.equal(sectionMohammad.ward, 'Ward 20');
assert.equal(sectionMohammad.sheetStatus, 'CHRONIC');
assert.equal(sectionMohammad.assignedDoctor, 'noura');
assert.match(sectionMohammad.dx || '', /UTI/i);
assert.match(sectionMohammad.dx || '', /weight loss/i);

// Test 20: Detail-heavy diagnoses should stay diagnoses instead of being absorbed into names
const detailHeavyDiagnoses = analyzeOcrWords([
  word('Patient name', 180, 10, 98, 110),
  word('Diagnosis', 420, 10, 98, 90),
  word('Assigned Doctor', 650, 10, 98, 135),
  word('Status', 860, 10, 98, 60),
  word('Abdullah', 180, 52, 92, 90),
  word('biliary cholecystitis', 390, 52, 92, 180),
  word('Bazzah', 700, 52, 92, 80),
  word('New', 870, 52, 92, 40),
  word('Raju', 180, 90, 92, 70),
  word('Ischemic stroke', 390, 90, 92, 150),
  word('Zahra', 700, 90, 92, 70),
  word('Chronic', 850, 90, 92, 70),
], 980, 170);

assert.equal(detailHeavyDiagnoses.patients.length, 2, 'expected two patients with detail-heavy diagnoses');
const abdullahDx = detailHeavyDiagnoses.patients.find(patient => /abdullah/i.test(patient.fullName || ''));
assert.ok(abdullahDx, 'expected Abdullah to remain a patient name');
assert.match(abdullahDx.dx || '', /chole/i);
assert.equal(abdullahDx.assignedDoctor, 'Bazzah');
const rajuDx = detailHeavyDiagnoses.patients.find(patient => /raju/i.test(patient.fullName || ''));
assert.ok(rajuDx, 'expected Raju to remain a patient name');
assert.match(rajuDx.dx || '', /stroke/i);
assert.equal(rajuDx.assignedDoctor, 'Zahra');

// Test 21: Female-list sections should infer gender when age/sex is missing
const femaleSectionRoster = analyzeOcrWords([
  word('Female list (active)', 40, 10, 98, 190),
  word('Room / Ward', 20, 52, 98, 95),
  word('Patient name', 170, 52, 98, 110),
  word('Diagnosis', 410, 52, 98, 90),
  word('Assigned Doctor', 650, 52, 98, 135),
  word('Status', 860, 52, 98, 60),
  word('Ward 22', 470, 84, 97, 80),
  word('8', 70, 120, 92, 30),
  word('Fatima Hassan', 180, 120, 92, 150),
  word('Chest infection', 400, 120, 92, 140),
  word('Noura', 700, 120, 92, 60),
  word('Aisha', 190, 156, 92, 90),
  word('UTI, weight loss', 390, 156, 92, 170),
  word('Zahra', 700, 156, 92, 60),
], 980, 240);

assert.ok(['table-grid', 'schema-columns', 'row-bands'].includes(femaleSectionRoster.strategy), 'expected female-list roster to stay structural');
assert.equal(femaleSectionRoster.patients.length, 2, 'expected two patients from female-list roster');
const fatimaSection = femaleSectionRoster.patients.find(patient => /fatima hassan/i.test(patient.fullName || ''));
assert.ok(fatimaSection, 'expected Fatima Hassan from female-list roster');
assert.equal(fatimaSection.gender, 'F');
assert.equal(fatimaSection.sheetStatus, 'ACTIVE');
assert.equal(fatimaSection.ward, 'Ward 22');
const aishaSection = femaleSectionRoster.patients.find(patient => /^aisha$/i.test(patient.fullName || ''));
assert.ok(aishaSection, 'expected Aisha from female-list roster');
assert.equal(aishaSection.gender, 'F');
assert.equal(aishaSection.sheetStatus, 'ACTIVE');
assert.match(aishaSection.dx || '', /weight loss/i);

console.log('OCR verification passed');
