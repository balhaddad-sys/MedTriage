import assert from 'node:assert/strict';

import {
  getConfusionCost,
  ocrWeightedDistance,
  correctLine,
  correctTableRow,
  assessConfidence,
  checkLabRange,
} from './index.js';

let passed = 0;
let failed = 0;

function check(message, fn) {
  try {
    fn();
    passed++;
    console.log(`  OK  ${message}`);
  } catch (error) {
    failed++;
    console.log(`  FAIL ${message}`);
    console.log(`      ${error.message}`);
  }
}

console.log('\n=== SHIFU SMOKE TESTS ===\n');

console.log('Confusion Model:');
check('O/0 confusion cost = 0.1', () => assert.equal(getConfusionCost('O', '0'), 0.1));
check('l/1 confusion cost = 0.2', () => assert.equal(getConfusionCost('l', '1'), 0.2));
check('A/Z default cost = 1.0', () => assert.equal(getConfusionCost('A', 'Z'), 1.0));
check('same char cost = 0.0', () => assert.equal(getConfusionCost('a', 'a'), 0.0));

console.log('\nWeighted Distance:');
check('exact match = 0', () => assert.equal(ocrWeightedDistance('potassium', 'potassium'), 0));
check('single missing letter stays close', () => assert.ok(ocrWeightedDistance('potasium', 'potassium') < 1.5));
check('O vs 0 stays cheap', () => assert.ok(ocrWeightedDistance('O', '0') < 0.2));
check('unrelated words stay far apart', () => assert.ok(ocrWeightedDistance('cat', 'dog') > 2.5));

console.log('\nClinical Corrections:');
check('Hasan -> Hassan', () => {
  const result = correctLine('Hasan', { columnType: 'Patient' });
  assert.equal(result.output, 'Hassan');
  assert.equal(assessConfidence(result), 'accept');
});
check('Abdulah -> Abdullah', () => {
  const result = correctLine('Abdulah', { columnType: 'Patient' });
  assert.equal(result.output, 'Abdullah');
});
check('Chst infecfion -> Chest infection', () => {
  const result = correctLine('Chst infecfion', { columnType: 'Diagnosis' });
  assert.equal(result.output, 'Chest infection');
});
check('CVA typo stays clinically sensible', () => {
  const result = correctLine('CVA left MCA occlsuion', { columnType: 'Diagnosis' });
  assert.equal(result.output, 'CVA left MCA occlusion');
});
check('status "New" is preserved', () => {
  const result = correctLine('New', { columnType: 'Status' });
  assert.equal(result.output, 'New');
  assert.equal(assessConfidence(result), 'accept');
});
check('slash-delimited diagnosis stays intact', () => {
  const result = correctLine('Hypernatremia/AKI/DVT/CAP', { columnType: 'Diagnosis' });
  assert.equal(result.output, 'Hypernatremia/AKI/DVT/CAP');
  assert.equal(assessConfidence(result), 'accept');
});
check('connector words stay stable inside diagnoses', () => {
  const result = correctLine('Chest infection and UTI', { columnType: 'Diagnosis' });
  assert.equal(result.output, 'Chest infection and UTI');
});
check('doctor title stays attached', () => {
  const result = correctLine('Dr Saleh', { columnType: 'Doctor' });
  assert.equal(result.output, 'Dr Saleh');
});

console.log('\nLab Range Checking:');
check('K+ 4.5 is in range', () => assert.equal(checkLabRange('Potassium', '4.5').status, 'in_range'));
check('K+ 45 is out of range', () => assert.equal(checkLabRange('Potassium', '45').status, 'OUT_OF_RANGE'));
check('K+ 45 suggests 4.5', () => assert.deepEqual(checkLabRange('Potassium', '45').alternatives, [4.5]));
check('HbA1c 71 suggests 7.1', () => assert.deepEqual(checkLabRange('HbA1c', '71').alternatives, [7.1]));

console.log('\nTable Rows:');
check('row correction preserves status and slash diagnoses', () => {
  const row = correctTableRow({
    Room: '16-4',
    Patient: 'Hasan',
    Diagnosis: 'Hypernatremia/AKI/DVT/CAP',
    Doctor: 'Noura',
    Status: 'New',
  });
  assert.equal(row.corrected.Patient.output, 'Hassan');
  assert.equal(row.corrected.Diagnosis.output, 'Hypernatremia/AKI/DVT/CAP');
  assert.equal(row.corrected.Status.output, 'New');
});

console.log(`\n${'='.repeat(40)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}\n`);

if (failed > 0) process.exit(1);
