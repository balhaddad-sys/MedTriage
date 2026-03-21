import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { requirePythonExecutable, runPython } from './lib/pythonRuntime.mjs';

const repoRoot = process.cwd();
const python = requirePythonExecutable();
const vendorRoot = resolve(repoRoot, 'training', 'ocr', 'vendor', 'PaddleOCR');
const trainScript = resolve(vendorRoot, 'tools', 'train.py');
const preparedRoot = resolve(repoRoot, 'training', 'ocr', 'prepared', 'paddle', 'rec');
const charsetPath = resolve(repoRoot, 'training', 'ocr', 'generated', 'medtriage_charset.txt');
const trainLabels = resolve(preparedRoot, 'train.txt');
const evalLabels = resolve(preparedRoot, 'val.txt');
const saveDir = resolve(repoRoot, 'training', 'ocr', 'checkpoints', 'rec');
const configArg = process.argv.find(arg => arg.startsWith('--config='))?.split('=')[1];

const defaultConfig = resolve(vendorRoot, 'configs', 'rec', 'PP-OCRv3', 'multi_language', 'arabic_PP-OCRv3_rec.yml');
const configPath = configArg ? resolve(repoRoot, configArg) : defaultConfig;

if (!existsSync(trainScript)) {
  throw new Error('PaddleOCR repo not found. Run `node scripts/install-ocr-training-stack.mjs --with-paddle` first.');
}
if (!existsSync(trainLabels) || !existsSync(evalLabels)) {
  throw new Error('Prepared training labels not found. Run `node scripts/prepare-ocr-training-data.mjs` first.');
}
if (!existsSync(configPath)) {
  throw new Error(`Training config not found: ${configPath}`);
}

const forwardedArgs = process.argv.slice(2).filter(arg =>
  !arg.startsWith('--config=') &&
  !arg.startsWith('--epochs=') &&
  arg !== '--gpu'
);
const useGpu = process.argv.includes('--gpu');
const epochs = process.argv.find(arg => arg.startsWith('--epochs='))?.split('=')[1] || '20';
const overrides = [
  `Global.use_gpu=${useGpu ? 'true' : 'false'}`,
  `Global.epoch_num=${epochs}`,
  `Global.character_dict_path=${charsetPath.replace(/\\/g, '/')}`,
  'Global.use_space_char=true',
  `Global.save_model_dir=${saveDir.replace(/\\/g, '/')}`,
  `Train.dataset.data_dir=${preparedRoot.replace(/\\/g, '/')}`,
  `Train.dataset.label_file_list=['${trainLabels.replace(/\\/g, '/')}']`,
  `Eval.dataset.data_dir=${preparedRoot.replace(/\\/g, '/')}`,
  `Eval.dataset.label_file_list=['${evalLabels.replace(/\\/g, '/')}']`,
];

console.log(`Training config: ${configPath}`);
console.log(`Epochs: ${epochs}`);
console.log(`Device: ${useGpu ? 'GPU' : 'CPU'}`);

runPython([
  trainScript,
  '-c', configPath,
  '-o',
  ...overrides,
  ...forwardedArgs,
], {
  python,
  cwd: vendorRoot,
  env: { ...process.env, PYTHONUTF8: '1' },
});
