import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { findPythonExecutable, requirePythonExecutable, runCommand, runPython } from './lib/pythonRuntime.mjs';

const repoRoot = process.cwd();
const venvDir = resolve(repoRoot, '.venv-ocr');
const venvPython = resolve(venvDir, 'Scripts', 'python.exe');
const withPaddle = process.argv.includes('--with-paddle');

const systemPython = requirePythonExecutable();

if (!existsSync(venvPython)) {
  console.log('Creating OCR training virtual environment...');
  runPython(['-m', 'venv', '.venv-ocr'], { python: systemPython, cwd: repoRoot });
}

const python = findPythonExecutable();
console.log(`Using Python: ${python}`);

console.log('Installing base OCR training dependencies...');
runPython(['-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel'], { python });
runPython(['-m', 'pip', 'install', 'Pillow', 'arabic-reshaper', 'python-bidi'], { python });

if (withPaddle) {
  console.log('Installing PaddlePaddle CPU runtime...');
  runPython([
    '-m', 'pip', 'install',
    'paddlepaddle==3.2.0',
    '-i', 'https://www.paddlepaddle.org.cn/packages/stable/cpu/',
  ], { python });

  const vendorRoot = resolve(repoRoot, 'training', 'ocr', 'vendor', 'PaddleOCR');
  if (!existsSync(vendorRoot)) {
    console.log('Cloning PaddleOCR training repository...');
    runCommand('git', ['clone', 'https://github.com/PaddlePaddle/PaddleOCR.git', vendorRoot], { cwd: repoRoot });
  }

  console.log('Installing PaddleOCR repository requirements...');
  runPython(['-m', 'pip', 'install', '-r', resolve(vendorRoot, 'requirements.txt')], { python });
}

console.log('OCR training stack installation complete');
