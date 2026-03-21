import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const tmpDir = mkdtempSync(join(tmpdir(), 'medevac-ocr-'));
const outfile = join(tmpDir, 'ocr-engine.mjs');

writeFileSync(outfile, readFileSync(resolve('src/modules/evacuation/ocrEngine.js'), 'utf8'));

const { analyzeOcrWords } = await import(pathToFileURL(outfile).href);

function word(text, x, y, confidence = 92, width = text.length * 10) {
  return {
    text,
    confidence,
    bbox: { x0: x, y0: y, x1: x + width, y1: y + 20 },
  };
}

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

rmSync(tmpDir, { recursive: true, force: true });
console.log('OCR verification passed');
