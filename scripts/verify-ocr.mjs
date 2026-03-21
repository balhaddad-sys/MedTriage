import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Bundle ocrEngine.js — mark paddleocr and onnxruntime-web as external
// (we only test the analysis pipeline, not the OCR runtime)
const { analyzeOcrWords } = await import(pathToFileURL(resolve('src/modules/evacuation/ocrEngine.js')).href);

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

console.log('OCR verification passed');
