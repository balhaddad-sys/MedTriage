import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

// Bundle ocrEngine.js — mark paddleocr and onnxruntime-web as external
// (we only test the analysis pipeline, not the OCR runtime)
const tmpDir = mkdtempSync(join(tmpdir(), 'medevac-ocr-'));
const outfile = join(tmpDir, 'ocr-engine-test.mjs');

// Create stubs for the OCR runtime imports
writeFileSync(join(tmpDir, 'node_modules', 'paddleocr', 'index.mjs').replace(/node_modules[/\\]paddleocr/, ''), '');
const stubPaddle = join(tmpDir, 'paddle-stub.mjs');
const stubOrt = join(tmpDir, 'ort-stub.mjs');
writeFileSync(stubPaddle, 'export class PaddleOcrService { static async createInstance() { return {}; } }');
writeFileSync(stubOrt, 'export const env = { wasm: {} }; export default { env: { wasm: {} } };');

// Use esbuild plugin to redirect imports to stubs
const stubPlugin = {
  name: 'stub-ocr-deps',
  setup(build) {
    build.onResolve({ filter: /^paddleocr$/ }, () => ({ path: stubPaddle }));
    build.onResolve({ filter: /^onnxruntime-web$/ }, () => ({ path: stubOrt }));
  },
};

await esbuild.build({
  entryPoints: ['src/modules/evacuation/ocrEngine.js'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  plugins: [stubPlugin],
  define: { 'process.env.NODE_ENV': '"test"' },
});

const { analyzeOcrWords } = await import(pathToFileURL(outfile).href);

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

rmSync(tmpDir, { recursive: true, force: true });
console.log('OCR verification passed');
