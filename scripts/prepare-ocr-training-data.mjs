import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const rawRoot = resolve(repoRoot, 'training', 'ocr', 'raw');
const outputRoot = resolve(repoRoot, 'training', 'ocr', 'prepared', 'paddle', 'rec');

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function parseJsonl(path) {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function hashSample(imagePath, text) {
  return createHash('sha1').update(`${imagePath}\n${text}`).digest('hex').slice(0, 16);
}

function normalizeSplit(split, seed) {
  if (['train', 'val', 'test'].includes(split)) return split;
  const bucket = parseInt(seed.slice(0, 2), 16) / 255;
  if (bucket < 0.9) return 'train';
  if (bucket < 0.97) return 'val';
  return 'test';
}

function sanitizeLabel(text) {
  return `${text || ''}`.replace(/\s+/g, ' ').trim();
}

const sources = [
  { id: 'medtriage_manual', labels: resolve(rawRoot, 'medtriage_manual', 'labels.jsonl') },
  { id: 'medtriage_synthetic', labels: resolve(rawRoot, 'medtriage_synthetic', 'labels.jsonl') },
];

rmSync(outputRoot, { recursive: true, force: true });
ensureDir(resolve(outputRoot, 'images'));

const splitLines = { train: [], val: [], test: [] };
const stats = { total: 0, bySource: {}, bySplit: { train: 0, val: 0, test: 0 } };
const seen = new Set();

for (const source of sources) {
  if (!existsSync(source.labels)) continue;

  const entries = parseJsonl(source.labels);
  stats.bySource[source.id] = 0;

  for (const entry of entries) {
    const label = sanitizeLabel(entry.text);
    if (!label) continue;

    const sourceImagePath = resolve(dirname(source.labels), entry.image);
    if (!existsSync(sourceImagePath)) {
      throw new Error(`Missing image referenced by ${source.labels}: ${entry.image}`);
    }

    const hash = hashSample(sourceImagePath, label);
    if (seen.has(hash)) continue;
    seen.add(hash);

    const split = normalizeSplit(entry.split, hash);
    const extension = extname(sourceImagePath) || '.png';
    const relativeImagePath = `images/${source.id}/${hash}${extension}`;
    const destinationDir = resolve(outputRoot, 'images', source.id);
    const destinationPath = resolve(outputRoot, relativeImagePath);

    ensureDir(destinationDir);
    copyFileSync(sourceImagePath, destinationPath);

    splitLines[split].push(`${relativeImagePath.replace(/\\/g, '/')}\t${label}`);
    stats.total += 1;
    stats.bySource[source.id] += 1;
    stats.bySplit[split] += 1;
  }
}

for (const split of ['train', 'val', 'test']) {
  ensureDir(outputRoot);
  writeFileSync(resolve(outputRoot, `${split}.txt`), `${splitLines[split].join('\n')}\n`);
}

writeFileSync(resolve(outputRoot, 'stats.json'), `${JSON.stringify(stats, null, 2)}\n`);

console.log('Prepared PaddleOCR recognition dataset');
console.log(`  Total samples: ${stats.total}`);
console.log(`  Train: ${stats.bySplit.train}`);
console.log(`  Val:   ${stats.bySplit.val}`);
console.log(`  Test:  ${stats.bySplit.test}`);
