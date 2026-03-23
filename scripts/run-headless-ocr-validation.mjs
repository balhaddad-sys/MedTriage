#!/usr/bin/env node
/**
 * Headless OCR Validation — Puppeteer
 *
 * 1. Builds the app
 * 2. Serves dist/ on localhost
 * 3. Opens headless Chromium
 * 4. Feeds each ground truth image through processPatientListImage()
 * 5. Collects OCR results
 * 6. Runs validation metrics against ground truth
 *
 * Usage:
 *   node scripts/run-headless-ocr-validation.mjs [--limit 50] [--skip-build]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { createServer } from 'http';
import { execSync } from 'child_process';

const GT_DIR = 'training/ocr/ground-truth';
const GT_PATH = join(GT_DIR, 'ground_truth.json');
const RESULTS_PATH = join(GT_DIR, 'ocr_results.json');

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const skipBuild = args.includes('--skip-build');

if (!existsSync(GT_PATH)) {
  console.error('Ground truth not found. Run: python scripts/generate-ward-sheet-ground-truth.py');
  process.exit(1);
}

const gt = JSON.parse(readFileSync(GT_PATH, 'utf-8'));
const samplesToRun = gt.slice(0, Math.min(gt.length, limit));
console.log(`Will process ${samplesToRun.length}/${gt.length} ground truth sheets`);

// Step 1: Build
if (!skipBuild) {
  console.log('\n[1/4] Building app...');
  execSync('node scripts/build.mjs', { stdio: 'inherit' });
} else {
  console.log('\n[1/4] Skipping build (--skip-build)');
}

// Step 2: Serve dist/
console.log('[2/4] Starting local server...');
const distPath = resolve('dist');

const server = createServer((req, res) => {
  let filePath = join(distPath, req.url === '/' ? 'index.html' : req.url);

  // Also serve ground truth images
  if (req.url.startsWith('/gt-images/')) {
    filePath = join(GT_DIR, 'images', req.url.replace('/gt-images/', ''));
  }

  try {
    if (!existsSync(filePath)) {
      // SPA fallback
      filePath = join(distPath, 'index.html');
    }
    const data = readFileSync(filePath);
    const ext = filePath.split('.').pop().toLowerCase();
    const types = { html: 'text/html', js: 'application/javascript', mjs: 'application/javascript', css: 'text/css', png: 'image/png', jpg: 'image/jpeg', json: 'application/json', wasm: 'application/wasm', map: 'application/json' };
    res.writeHead(200, {
      'Content-Type': types[ext] || 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
  }
});

const requestedPort = Number(process.env.OCR_VALIDATION_PORT || 0);
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(requestedPort, resolve);
});
const PORT = server.address()?.port;
console.log(`  Serving on http://localhost:${PORT}`);

let browser = null;

try {
  // Step 3: Launch headless browser
  console.log('[3/4] Launching headless Chromium...');
  const puppeteer = await import('puppeteer');
  // Fresh profile every run — no cached models/dicts from previous runs
  const { mkdtempSync } = await import('fs');
  const { tmpdir } = await import('os');
  const userDataDir = mkdtempSync(join(tmpdir(), 'ocr-validation-'));
  browser = await puppeteer.default.launch({
    headless: 'new',
    protocolTimeout: 600000,
    userDataDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-file-access-from-files',
    ],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(300000); // 5 min — ONNX model download can be slow
  page.setDefaultNavigationTimeout(300000);

  // Clear IndexedDB model cache to ensure fresh dict is loaded
  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle0' });
  await page.evaluate(async () => {
    try {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name && db.name.includes('ocr')) indexedDB.deleteDatabase(db.name);
      }
    } catch {}
  });
  await page.reload({ waitUntil: 'networkidle0' });

  console.log('  Waiting for OCR engine to load...');
  await page.waitForFunction(() => typeof window.__ocrEngineReady !== 'undefined' || document.readyState === 'complete', { timeout: 30000 }).catch(() => {});

  console.log('  Waiting for app bundle to load OCR engine...');
  const loaded = await page.waitForFunction(
    () => typeof window.processPatientListImage === 'function',
    { timeout: 60000 }
  ).then(() => true).catch(() => false);
  if (!loaded) throw new Error('OCR engine did not load within 60s — check build output');
  console.log('  OCR engine loaded successfully');

  console.log('  Preloading OCR models (first run downloads ONNX, ~30-60s)...');
  try {
    await page.evaluate(async () => {
      if (window.preloadOcrModels) window.preloadOcrModels();
      const testCanvas = document.createElement('canvas');
      testCanvas.width = 200; testCanvas.height = 50;
      const ctx = testCanvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 200, 50);
      ctx.fillStyle = '#000'; ctx.font = '20px Arial'; ctx.fillText('test', 10, 35);
      await window.processPatientListImage(testCanvas);
    });
    console.log('  OCR models preloaded and warm');
  } catch (e) {
    console.log(`  Preload warning: ${e.message} — continuing anyway`);
  }

  // Step 4: Process each image
  console.log(`[4/4] Processing ${samplesToRun.length} ward sheets through OCR engine...`);
  const results = [];
  let processed = 0;
  let failed = 0;

  for (const entry of samplesToRun) {
    const imageUrl = `http://localhost:${PORT}/gt-images/${entry.imagePath.replace('images/', '')}`;

    try {
      const ocrResult = await page.evaluate(async (url) => {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
          });
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);

          const result = await window.processPatientListImage(canvas);
          return {
            rawText: result.rawText || '',
            patients: (result.patients || []).map(p => ({
              fullName: p.fullName || '', bed: p.bed || '',
              age: p.age ?? null, gender: p.gender || '',
              dx: p.dx || '', meds: p.meds || '',
              triage: p.triage || '', bloodType: p.bloodType || '',
              ward: p.ward || '',
            })),
            engine: result.engine || 'unknown',
            qualityScore: result.qualityScore || 0,
            processingTime: result.processingTime || 0,
          };
        } catch (e) {
          return { error: e.message, rawText: '', patients: [] };
        }
      }, imageUrl);

      results.push({
        imageId: entry.imageId,
        ...ocrResult,
      });

      processed++;
      if (ocrResult.error) {
        failed++;
        if (failed <= 3) console.log(`  ⚠️  ${entry.imageId}: ${ocrResult.error}`);
      }

      if (processed % 10 === 0) {
        const pct = Math.round(processed / samplesToRun.length * 100);
        console.log(`  ${processed}/${samplesToRun.length} (${pct}%) — ${failed} failed`);
      }
    } catch (err) {
      results.push({ imageId: entry.imageId, error: err.message, rawText: '', patients: [] });
      failed++;
      processed++;
      console.log(`  ⚠️  ${entry.imageId}: ${err.message}`);
    }
  }

  writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
  console.log(`\nOCR results saved to ${RESULTS_PATH}`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Success: ${processed - failed}`);

  if (processed - failed > 0) {
    console.log('\n--- Running validation ---\n');
    try {
      execSync(`node scripts/run-ocr-validation.mjs --with-ocr-results ${RESULTS_PATH}`, { stdio: 'inherit' });
    } catch (error) {
      console.error('\nValidation runner returned a non-zero exit code.');
      if (error?.status != null) console.error(`Exit status: ${error.status}`);
      process.exitCode = 1;
    }
  }

  console.log('\nDone.');
} catch (error) {
  console.error('\nHeadless OCR validation failed:');
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
} finally {
  if (browser) {
    try {
      await browser.close();
    } catch {}
  }
  await new Promise(resolve => server.close(() => resolve()));
}
