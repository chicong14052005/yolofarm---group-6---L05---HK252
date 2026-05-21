const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const apiDir = path.join(rootDir, 'server', 'AI_feature');
const reqFile = path.join(apiDir, 'requirements.txt');
const serverEnvFile = path.join(rootDir, 'server', '.env');
const isWin = process.platform === 'win32';
const venvDir = path.join(rootDir, '.venv');
const binDir = path.join(venvDir, isWin ? 'Scripts' : 'bin');
const pythonExe = path.join(binDir, isWin ? 'python.exe' : 'python');
const pipExe = path.join(binDir, isWin ? 'pip.exe' : 'pip');

function readEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) {
    return env;
  }

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: options.stdio || ['pipe', 'pipe', 'pipe'],
  });
}

function findSystemPython() {
  const candidates = isWin
    ? [
        ['py', ['-3.12']],
        ['py', ['-3.11']],
        ['py', ['-3.10']],
        ['python', []],
        ['python3', []],
      ]
    : [
        ['python3.12', []],
        ['python3.11', []],
        ['python3.10', []],
        ['python3', []],
        ['python', []],
      ];

  for (const [command, baseArgs] of candidates) {
    try {
      const version = run(command, [...baseArgs, '--version']).trim();
      const match = version.match(/Python (\d+)\.(\d+)/);
      if (!match) {
        continue;
      }

      const major = Number(match[1]);
      const minor = Number(match[2]);
      if (major === 3 && minor >= 10 && minor <= 12) {
        console.log(`[api] Found Python: ${command} ${baseArgs.join(' ')} -> ${version}`);
        return { command, args: baseArgs };
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

if (!fs.existsSync(reqFile)) {
  console.error(`[api] Missing requirements file: ${reqFile}`);
  process.exit(1);
}

if (!fs.existsSync(pythonExe)) {
  const systemPython = findSystemPython();
  if (!systemPython) {
    console.error('[api] Python 3.10-3.12 is required for the AI API.');
    process.exit(1);
  }

  console.log('[api] Creating Python virtual environment...');
  try {
    run(systemPython.command, [...systemPython.args, '-m', 'venv', venvDir], { stdio: 'inherit' });
  } catch (error) {
    console.error(`[api] Cannot create virtual environment: ${error.message}`);
    process.exit(1);
  }
}

const markerFile = path.join(venvDir, '.ai_feature_requirements_installed');
const reqMtime = fs.statSync(reqFile).mtimeMs;
let needsInstall = true;

if (fs.existsSync(markerFile)) {
  const markerMtime = Number(fs.readFileSync(markerFile, 'utf8'));
  needsInstall = !Number.isFinite(markerMtime) || markerMtime < reqMtime;
}

if (needsInstall) {
  console.log('[api] Installing Python dependencies for AI features...');
  try {
    run(pipExe, ['install', '-r', reqFile], { stdio: 'inherit' });
    fs.writeFileSync(markerFile, String(Date.now()));
  } catch (error) {
    console.error(`[api] Dependency installation failed: ${error.message}`);
    process.exit(1);
  }
}

console.log('[api] Starting unified FastAPI AI server on http://localhost:8000 ...');

const proc = spawn(
  pythonExe,
  ['-m', 'uvicorn', 'main:app', '--reload', '--host', '0.0.0.0', '--port', '8000'],
  {
    cwd: apiDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...readEnv(serverEnvFile),
      PYTHONUNBUFFERED: '1',
    },
  }
);

proc.on('error', (error) => {
  console.error(`[api] Failed to start AI API server: ${error.message}`);
  process.exit(1);
});

proc.on('close', (code) => {
  process.exit(code || 0);
});
