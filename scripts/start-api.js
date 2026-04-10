/**
 * start-api.js
 * Cross-platform script to auto-setup Python .venv and start FastAPI (uvicorn).
 * Works on both Windows (dev) and Linux (Render deploy).
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.join(__dirname, '..');
const isWin = process.platform === 'win32';
const venvDir = path.join(rootDir, '.venv');
const binDir = path.join(venvDir, isWin ? 'Scripts' : 'bin');
const pythonExe = path.join(binDir, isWin ? 'python.exe' : 'python');
const pipExe = path.join(binDir, isWin ? 'pip.exe' : 'pip');
const apiDir = path.join(rootDir, 'server', 'api');
const reqFile = path.join(apiDir, 'requirements.txt');

// ── Helper: Tìm Python system command ──
// Trên Windows, thử `py -3` (py launcher) trước, rồi `python`, `python3`
// Trên Linux/macOS, thử `python3` trước, rồi `python`
function findSystemPython() {
  const candidates = isWin
    ? ['py -3.12', 'py -3.11', 'py -3.10', 'python', 'python3']
    : ['python3.12', 'python3.11', 'python3.10', 'python3', 'python'];

  for (const cmd of candidates) {
    try {
      const version = execSync(`${cmd} --version`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      // Đảm bảo phiên bản >= 3.10
      const match = version.match(/Python (\d+)\.(\d+)/);
      if (match) {
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        if (major === 3 && minor >= 10) {
          console.log(`   Found: ${cmd} → ${version}`);
          return cmd;
        } else {
          console.log(`   Skipping ${cmd} (${version}) — cần Python >= 3.10`);
        }
      }
    } catch {
      // command không tồn tại, thử cái tiếp theo
    }
  }
  return null;
}

// ══════════════════════════════════════════════════════════
// Step 1: Create .venv if python.exe doesn't exist inside it
// ══════════════════════════════════════════════════════════
if (!fs.existsSync(pythonExe)) {
  console.log('🐍 Python virtual environment not found, creating .venv...');

  const pyCmd = findSystemPython();
  if (!pyCmd) {
    console.error('❌ Không tìm thấy Python >= 3.10 trên hệ thống.');
    console.error('   Vui lòng cài đặt Python >= 3.10 từ https://www.python.org/downloads/');
    console.error('   (Trên Windows, hãy chọn "Add Python to PATH" khi cài đặt)');
    process.exit(1);
  }

  try {
    console.log(`   Creating venv with: ${pyCmd} -m venv .venv`);
    execSync(`${pyCmd} -m venv "${venvDir}"`, {
      cwd: rootDir,
      stdio: 'inherit',
    });
  } catch (err) {
    console.error('❌ Không thể tạo virtual environment:', err.message);
    process.exit(1);
  }

  // Verify venv was actually created correctly
  if (!fs.existsSync(pythonExe)) {
    console.error('❌ Virtual environment được tạo nhưng python.exe không tồn tại.');
    console.error(`   Kiểm tra thư mục: ${binDir}`);
    console.error('   Có thể Python trên máy là Windows Store stub.');
    console.error('   Hãy cài Python thật từ https://www.python.org/downloads/');

    // Cleanup invalid venv
    try {
      fs.rmSync(venvDir, { recursive: true, force: true });
    } catch { /* ignore */ }

    process.exit(1);
  }

  console.log('✅ Virtual environment created successfully');
}

// ══════════════════════════════════════════════════════════
// Step 2: Install requirements if needed
// ══════════════════════════════════════════════════════════
// Uses a marker file to track when requirements were last installed,
// so we skip re-installation if requirements.txt hasn't changed.
const markerFile = path.join(venvDir, '.requirements_installed');
const reqMtime = fs.statSync(reqFile).mtimeMs;
let needsInstall = true;

if (fs.existsSync(markerFile)) {
  try {
    const markerMtime = parseFloat(fs.readFileSync(markerFile, 'utf-8'));
    if (markerMtime >= reqMtime) {
      needsInstall = false;
    }
  } catch {
    // marker file corrupted, re-install
  }
}

if (needsInstall) {
  console.log('📦 Installing Python dependencies (this may take a while on first run)...');
  try {
    execSync(`"${pipExe}" install -r "${reqFile}"`, {
      cwd: rootDir,
      stdio: 'inherit',
    });
    fs.writeFileSync(markerFile, String(Date.now()));
    console.log('✅ Python dependencies installed successfully');
  } catch (err) {
    console.error('⚠️  Warning: Could not install some dependencies.');
    console.error('   Hãy thử cài thủ công:');
    console.error(`   "${pipExe}" install -r "${reqFile}"`);
    // Không exit — vẫn thử start server, có thể deps đã có sẵn
  }
}

// ══════════════════════════════════════════════════════════
// Step 3: Start uvicorn
// ══════════════════════════════════════════════════════════
console.log('🚀 Starting AI API server on http://localhost:8000 ...');

const proc = spawn(pythonExe, [
  '-m', 'uvicorn', 'main:app',
  '--reload',
  '--host', '0.0.0.0',
  '--port', '8000',
], {
  cwd: apiDir,
  stdio: 'inherit',
  env: { ...process.env },
});

proc.on('error', (err) => {
  console.error('❌ Failed to start AI API server:', err.message);
  process.exit(1);
});

proc.on('close', (code) => {
  process.exit(code || 0);
});
