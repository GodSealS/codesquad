#!/usr/bin/env node
/**
 * codesquad — Platform-aware launcher
 *
 * In production (npm install):
 *   1. Check if platform-specific binary exists in dist/
 *   2. If yes → execute it directly
 *   3. If no  → fall back to tsx (dev mode) or dist/index.js
 *
 * Platform binary names:
 *   win32-x64   → codesquad-win.exe
 *   linux-x64   → codesquad-linux
 *   darwin-x64  → codesquad-macos
 *   darwin-arm64 → codesquad-macos-arm
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkgRoot = join(__dirname, '..');

const platform = process.platform;
const arch = process.arch;

// Map platform+arch to binary name
const BINARY_MAP = {
  'win32-x64': 'codesquad-win.exe',
  'linux-x64': 'codesquad-linux',
  'darwin-x64': 'codesquad-macos',
  'darwin-arm64': 'codesquad-macos-arm',
};

const binaryName = BINARY_MAP[`${platform}-${arch}`];
const binaryPath = binaryName ? join(pkgRoot, 'dist', binaryName) : null;
const localBinary = join(pkgRoot, 'dist', `codesquad${platform === 'win32' ? '.exe' : ''}`);

// ── Priority 1: Platform-specific binary (npm install) ──
if (binaryPath && existsSync(binaryPath)) {
  try {
    execSync(`"${binaryPath}" ${process.argv.slice(2).map((a) => `"${a}"`).join(' ')}`, {
      stdio: 'inherit',
    });
  } catch (e) {
    process.exit(e?.status ?? 1);
  }
}
// ── Priority 2: Locally built binary (dev build) ──
else if (existsSync(localBinary)) {
  try {
    execSync(`"${localBinary}" ${process.argv.slice(2).map((a) => `"${a}"`).join(' ')}`, {
      stdio: 'inherit',
    });
  } catch (e) {
    process.exit(e?.status ?? 1);
  }
}
// ── Priority 3: npm package — index.js at package root ──
else if (existsSync(join(pkgRoot, 'index.js'))) {
  import('../index.js')
    .then((m) => m.run())
    .catch((err) => {
      console.error('Failed to load codesquad:', err.message);
      process.exit(1);
    });
}
// ── Priority 4: dist/index.js (dev build with tsc --outDir dist) ──
else if (existsSync(join(pkgRoot, 'dist', 'index.js'))) {
  import('../dist/index.js')
    .then((m) => m.run())
    .catch((err) => {
      console.error('Failed to load codesquad. Did you run `npm run build`?');
      console.error(err);
      process.exit(1);
    });
}
// ── Priority 5: Fallback to tsx dev mode ──
else {
  console.warn('[codesquad] No binary or dist/ found, falling back to tsx dev mode...');
  const child = spawn(
    'npx',
    ['tsx', join(pkgRoot, 'src', 'cli', 'index.ts'), ...process.argv.slice(2)],
    {
      stdio: 'inherit',
      shell: true,
    },
  );
  child.on('exit', (code) => process.exit(code ?? 1));
}
