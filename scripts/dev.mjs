import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync, cpSync } from 'fs';
import { join } from 'path';

const outdir = 'dist';
if (!existsSync(outdir)) mkdirSync(outdir, { recursive: true });

// Copy public files
const publicDir = 'public';
if (existsSync(publicDir)) {
  for (const file of readdirSync(publicDir)) {
    cpSync(join(publicDir, file), join(outdir, file), { recursive: true });
  }
}

// Copy data files
const dataDir = 'data';
const dataOut = join(outdir, 'data');
if (existsSync(dataDir)) {
  if (!existsSync(dataOut)) mkdirSync(dataOut, { recursive: true });
  for (const file of readdirSync(dataDir)) {
    copyFileSync(join(dataDir, file), join(dataOut, file));
  }
}

const ctx = await esbuild.context({
  entryPoints: ['src/index.jsx'],
  bundle: true,
  outfile: join(outdir, 'app.js'),
  format: 'esm',
  jsx: 'automatic',
  jsxImportSource: 'react',
  define: {
    'process.env.NODE_ENV': '"development"',
  },
  loader: {
    '.jsx': 'jsx',
    '.js': 'js',
    '.json': 'json',
  },
  sourcemap: true,
});

const { host, port } = await ctx.serve({
  servedir: outdir,
  port: 3000,
});

console.log(`Dev server running at http://localhost:${port}`);
