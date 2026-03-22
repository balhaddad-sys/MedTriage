import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync, cpSync } from 'fs';
import { join } from 'path';

const outdir = 'dist';

// Ensure dist exists
if (!existsSync(outdir)) mkdirSync(outdir, { recursive: true });

// Bundle React app
await esbuild.build({
  entryPoints: ['src/index.jsx'],
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: join(outdir, 'app.js'),
  format: 'esm',
  jsx: 'automatic',
  jsxImportSource: 'react',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  loader: {
    '.jsx': 'jsx',
    '.js': 'js',
    '.json': 'json',
  },
});

// Copy public files
const publicDir = 'public';
if (existsSync(publicDir)) {
  for (const file of readdirSync(publicDir)) {
    const src = join(publicDir, file);
    const dest = join(outdir, file);
    cpSync(src, dest, { recursive: true });
  }
}

// Copy data files into dist
const dataDir = 'data';
const dataOut = join(outdir, 'data');
if (existsSync(dataDir)) {
  if (!existsSync(dataOut)) mkdirSync(dataOut, { recursive: true });
  for (const file of readdirSync(dataDir)) {
    cpSync(join(dataDir, file), join(dataOut, file), { recursive: true });
  }
}

// Copy ONNX Runtime WASM files for PaddleOCR (only the essential ones)
const ortWasmDir = join('node_modules', 'onnxruntime-web', 'dist');
const essentialWasm = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.jsep.mjs',
];
if (existsSync(ortWasmDir)) {
  for (const file of essentialWasm) {
    const src = join(ortWasmDir, file);
    if (existsSync(src)) {
      copyFileSync(src, join(outdir, file));
    }
  }
  console.log('ONNX Runtime WASM files copied to dist/');
}

console.log('Build complete → dist/');
