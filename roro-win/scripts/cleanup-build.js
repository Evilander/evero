/**
 * Clean up unnecessary files from node_modules before packaging.
 * Removes dev-only files, mac/linux-only binaries, docs, tests, etc.
 * to reduce the final package size.
 */

const fs = require('fs');
const path = require('path');

const WIN_ROOT = path.resolve(__dirname, '..');
const NODE_MODULES = path.join(WIN_ROOT, 'node_modules');

let removedCount = 0;
let removedBytes = 0;

function rmrf(p) {
  try {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      fs.rmSync(p, { recursive: true, force: true });
    } else {
      fs.unlinkSync(p);
    }
    removedBytes += stat.size || 0;
    removedCount++;
  } catch (e) {
    // Ignore
  }
}

function walkAndClean(dir, depth = 0) {
  if (depth > 6) return; // Don't recurse too deep
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (e) {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (e) {
      continue;
    }

    // Remove mac/linux-only native binaries
    if (stat.isDirectory()) {
      if (entry === 'darwin-arm64' || entry === 'darwin-x64' ||
          entry === 'linux-x64' || entry === 'linux-arm64' ||
          entry === 'arm64-darwin' || entry === 'x64-darwin' ||
          entry === 'arm64-linux' || entry === 'x64-linux' ||
          entry === 'win32-arm64') {  // We only target x64
        console.log(`  Removing non-x64-win: ${path.relative(WIN_ROOT, fullPath)}`);
        rmrf(fullPath);
        continue;
      }
    }

    // Remove common unnecessary files/dirs from node_modules
    if (stat.isDirectory() && (
      entry === '__tests__' || entry === 'test' || entry === 'tests' ||
      entry === 'example' || entry === 'examples' ||
      entry === '.github' || entry === '.vscode' ||
      entry === 'docs' || entry === 'doc'
    )) {
      // Only remove test dirs inside node_modules packages (not at root level)
      if (fullPath.includes('node_modules')) {
        rmrf(fullPath);
        continue;
      }
    }

    // Remove unnecessary files
    if (!stat.isDirectory()) {
      const lowerEntry = entry.toLowerCase();
      if (
        lowerEntry === '.npmignore' ||
        lowerEntry === '.eslintrc' ||
        lowerEntry === '.eslintrc.js' ||
        lowerEntry === '.eslintrc.json' ||
        lowerEntry === '.prettierrc' ||
        lowerEntry === '.prettierrc.js' ||
        lowerEntry === '.babelrc' ||
        lowerEntry === 'tsconfig.json' ||
        lowerEntry === 'tsconfig.build.json' ||
        lowerEntry === '.editorconfig' ||
        lowerEntry === '.travis.yml' ||
        lowerEntry === 'appveyor.yml' ||
        lowerEntry === 'changelog.md' ||
        lowerEntry === 'history.md' ||
        lowerEntry === 'contributing.md' ||
        lowerEntry === '.ds_store' ||
        lowerEntry === 'thumbs.db' ||
        lowerEntry.endsWith('.map') ||  // Source maps
        lowerEntry.endsWith('.ts') && !lowerEntry.endsWith('.d.ts') // TypeScript source (keep .d.ts)
      ) {
        if (fullPath.includes('node_modules')) {
          rmrf(fullPath);
          continue;
        }
      }
    }

    // Recurse into directories
    if (stat.isDirectory()) {
      walkAndClean(fullPath, depth + 1);
    }
  }
}

console.log('[cleanup] Starting build cleanup...');

// 1. Remove devDependencies from node_modules (they get included by npm)
const devDeps = ['electron', 'electron-builder', '@electron/rebuild', 'app-builder-bin',
  'app-builder-lib', 'builder-util', 'builder-util-runtime', 'dmg-builder',
  'electron-publish', 'electron-winstaller', 'node-gyp', '@electron/osx-sign',
  '@electron/notarize', '@electron/universal', 'postject', '7zip-bin'];

console.log('[cleanup] Removing devDependencies from node_modules...');
for (const dep of devDeps) {
  const depPath = path.join(NODE_MODULES, dep);
  if (fs.existsSync(depPath)) {
    const stat = fs.statSync(depPath);
    if (stat.isDirectory()) {
      console.log(`  Removing dev dep: ${dep}`);
      rmrf(depPath);
    }
  }
}

// 2. Walk and clean unnecessary platform files
console.log('[cleanup] Removing platform-specific and unnecessary files...');
walkAndClean(NODE_MODULES);

// 3. Remove .bin directory (symlinks to dev tools)
const binDir = path.join(NODE_MODULES, '.bin');
if (fs.existsSync(binDir)) {
  console.log('  Removing node_modules/.bin');
  rmrf(binDir);
}

console.log(`[cleanup] Done. Removed ${removedCount} items.`);
