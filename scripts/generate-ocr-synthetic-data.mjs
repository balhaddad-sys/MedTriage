import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { requirePythonExecutable, runPython } from './lib/pythonRuntime.mjs';

const repoRoot = process.cwd();
const scriptPath = resolve(repoRoot, 'scripts', 'generate_ocr_synthetic_data.py');
const lexiconPath = resolve(repoRoot, 'training', 'ocr', 'generated', 'medtriage_domain_lexicon.json');
const outputDir = resolve(repoRoot, 'training', 'ocr', 'raw', 'medtriage_synthetic');

if (!existsSync(lexiconPath)) {
  throw new Error('Missing generated lexicon. Run `node scripts/build-ocr-training-workspace.mjs` first.');
}

const python = requirePythonExecutable();
const forwardedArgs = process.argv.slice(2);

runPython([
  scriptPath,
  '--lexicon', lexiconPath,
  '--output', outputDir,
  ...forwardedArgs,
], { python });
