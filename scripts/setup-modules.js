/**
 * Setup script that:
 * 1. Copies all pure-JS node_modules from the extracted asar
 * 2. Copies node-pty (already has win32 prebuilds)
 * 3. Copies claude-agent-sdk (already has win32 ripgrep)
 * 4. Installs Windows-specific native modules (better-sqlite3, sharp)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MAC_EXTRACTED = path.resolve(__dirname, '../../roro-mac/app-extracted');
const MAC_UNPACKED = path.resolve(__dirname, '../../roro-mac/roro.app/Contents/Resources/app.asar.unpacked');
const WIN_ROOT = path.resolve(__dirname, '..');

function log(msg) {
  console.log(`[setup-modules] ${msg}`);
}

function robocopy(src, dest) {
  try {
    execSync(`robocopy "${src}" "${dest}" /E /NFL /NDL /NJH /NJS /NC /NS /NP`, {
      stdio: 'pipe',
    });
  } catch (e) {
    // robocopy returns 1 on success (files copied), only 8+ is error
    if (e.status >= 8) throw e;
  }
}

function main() {
  const winModules = path.join(WIN_ROOT, 'node_modules');

  // Step 1: Copy all node_modules from extracted asar
  // These are mostly pure JS modules that work cross-platform
  log('Step 1: Copying pure JS node_modules from asar...');

  // The extracted asar has a flat structure where many modules are at the root level
  // alongside the standard node_modules directory
  const asarRoot = MAC_EXTRACTED;

  // First, copy the proper node_modules directory
  const asarNodeModules = path.join(asarRoot, 'node_modules');
  if (fs.existsSync(asarNodeModules)) {
    robocopy(asarNodeModules, winModules);
    log('  Copied node_modules from asar.');
  }

  // Also copy the top-level modules that are outside node_modules
  // These are hoisted dependencies in the asar
  const entries = fs.readdirSync(asarRoot);
  const skipDirs = new Set(['node_modules', 'out', 'resources', 'hooks']);
  const skipFiles = new Set(['package.json']);

  for (const entry of entries) {
    if (skipDirs.has(entry) || skipFiles.has(entry)) continue;
    const srcPath = path.join(asarRoot, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      const destPath = path.join(winModules, entry);
      robocopy(srcPath, destPath);
    }
  }
  log('  Copied hoisted modules.');

  // Step 2: Copy node-pty with its win32 prebuilds from unpacked
  log('Step 2: Copying node-pty (has win32 prebuilds)...');
  const nodePtySrc = path.join(MAC_UNPACKED, 'node_modules', 'node-pty');
  const nodePtyDest = path.join(winModules, 'node-pty');
  robocopy(nodePtySrc, nodePtyDest);
  log('  node-pty copied (includes win32-x64 prebuilds).');

  // Step 3: Copy claude-agent-sdk with win32 ripgrep
  log('Step 3: Copying @anthropic-ai/claude-agent-sdk...');
  const sdkSrc = path.join(MAC_UNPACKED, 'node_modules', '@anthropic-ai');
  const sdkDest = path.join(winModules, '@anthropic-ai');
  robocopy(sdkSrc, sdkDest);
  log('  claude-agent-sdk copied (includes x64-win32 ripgrep).');

  // Step 4: Handle better-sqlite3
  // The mac .node file won't work on Windows
  // We need to install the Windows version
  log('Step 4: Setting up better-sqlite3 for Windows...');
  const bsqlSrc = path.join(MAC_UNPACKED, 'node_modules', 'better-sqlite3');
  const bsqlDest = path.join(winModules, 'better-sqlite3');

  // Copy the JS parts from the mac unpacked
  robocopy(bsqlSrc, bsqlDest);

  // Now we need to rebuild the native addon for Windows
  // Use electron-rebuild or prebuild-install
  log('  better-sqlite3 JS copied, native addon needs rebuild (see Step 6).');

  // Step 5: Handle sharp - install Windows version
  log('Step 5: Setting up sharp for Windows...');
  // Remove the darwin-specific sharp modules
  const sharpDarwinDir = path.join(winModules, '@img', 'sharp-darwin-arm64');
  const sharpLibvipsDarwin = path.join(winModules, '@img', 'sharp-libvips-darwin-arm64');
  if (fs.existsSync(sharpDarwinDir)) {
    fs.rmSync(sharpDarwinDir, { recursive: true, force: true });
    log('  Removed @img/sharp-darwin-arm64');
  }
  if (fs.existsSync(sharpLibvipsDarwin)) {
    fs.rmSync(sharpLibvipsDarwin, { recursive: true, force: true });
    log('  Removed @img/sharp-libvips-darwin-arm64');
  }
  log('  Sharp darwin modules removed, Windows modules need install (see Step 6).');

  // Step 6: Install Windows-specific native modules
  log('Step 6: Installing Windows native modules...');
  log('  Installing @img/sharp-win32-x64...');
  try {
    execSync('npm install @img/sharp-win32-x64@0.33.5 --no-save --no-package-lock', {
      cwd: WIN_ROOT,
      stdio: 'inherit',
    });
    log('  sharp-win32-x64 installed.');
  } catch (e) {
    log('  WARNING: sharp-win32-x64 install failed - app may work without image processing');
  }

  // Rebuild better-sqlite3 for Windows using electron headers
  log('  Rebuilding better-sqlite3 for Windows + Electron...');
  try {
    // Get electron version
    const electronPkg = require(path.join(WIN_ROOT, 'node_modules', 'electron', 'package.json'));
    const electronVersion = electronPkg.version;
    log(`  Electron version: ${electronVersion}`);

    execSync(
      `npx electron-rebuild -f -w better-sqlite3 -v ${electronVersion}`,
      {
        cwd: WIN_ROOT,
        stdio: 'inherit',
        env: {
          ...process.env,
          npm_config_runtime: 'electron',
          npm_config_target: electronVersion,
          npm_config_disturl: 'https://electronjs.org/headers',
        },
      }
    );
    log('  better-sqlite3 rebuilt for Electron/Windows.');
  } catch (e) {
    log('  WARNING: electron-rebuild failed for better-sqlite3. Trying prebuild-install...');
    try {
      execSync(
        `npx prebuild-install -r electron --platform win32 --arch x64`,
        {
          cwd: path.join(winModules, 'better-sqlite3'),
          stdio: 'inherit',
        }
      );
      log('  better-sqlite3 prebuild installed.');
    } catch (e2) {
      log('  ERROR: Could not build better-sqlite3 for Windows.');
      log('  You may need to install Visual Studio Build Tools and run:');
      log('  npx electron-rebuild -f -w better-sqlite3');
    }
  }

  log('');
  log('Module setup complete!');
  log('Run: npm run dist  (to build the Windows installer)');
}

main();
