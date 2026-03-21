import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

function checkPython(candidate) {
  if (!candidate) return false;
  const result = spawnSync(candidate, ['--version'], {
    encoding: 'utf8',
    shell: false,
  });
  return result.status === 0;
}

export function findPythonExecutable() {
  const repoRoot = process.cwd();
  const localAppData = process.env.LOCALAPPDATA || (
    process.env.USERPROFILE
      ? join(process.env.USERPROFILE, 'AppData', 'Local')
      : null
  );
  const candidates = [
    process.env.MEDTRIAGE_PYTHON,
    process.env.PYTHON,
    resolve(repoRoot, '.venv-ocr', 'Scripts', 'python.exe'),
    localAppData
      ? join(localAppData, 'Programs', 'Python', 'Python310', 'python.exe')
      : null,
    localAppData
      ? join(localAppData, 'Programs', 'Python', 'Python311', 'python.exe')
      : null,
    'python',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.endsWith('.exe') && !existsSync(candidate)) continue;
    if (checkPython(candidate)) return candidate;
  }

  return null;
}

export function requirePythonExecutable() {
  const python = findPythonExecutable();
  if (!python) {
    throw new Error(
      'Python runtime not found. Install Python and/or set MEDTRIAGE_PYTHON to a valid python.exe path.'
    );
  }
  return python;
}

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    cwd: options.cwd || process.cwd(),
    env: options.env || process.env,
  });

  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status ?? 'unknown'}`);
  }
}

export function runPython(args, options = {}) {
  const python = options.python || requirePythonExecutable();
  runCommand(python, args, options);
}
