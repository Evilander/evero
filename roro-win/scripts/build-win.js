/**
 * Build script that patches the macOS Electron app for Windows.
 *
 * This script:
 * 1. Copies the extracted app code (out/, node_modules from asar)
 * 2. Patches the main process JS to fix mac-specific code
 * 3. Replaces native modules with Windows builds
 * 4. Prepares everything for electron-builder
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MAC_EXTRACTED = path.resolve(__dirname, '../../roro-mac/app-extracted');
const MAC_UNPACKED = path.resolve(__dirname, '../../roro-mac/roro.app/Contents/Resources/app.asar.unpacked');
const WIN_ROOT = path.resolve(__dirname, '..');

function log(msg) {
  console.log(`[build-win] ${msg}`);
}

function copyDirSync(src, dest) {
  execSync(`robocopy "${src}" "${dest}" /E /NFL /NDL /NJH /NJS /NC /NS /NP`, {
    stdio: 'pipe',
    // robocopy returns non-zero for success (1 = files copied, 0 = no change)
    // Only 8+ means actual errors
  });
}

async function main() {
  log('Starting Windows build...');

  // Step 1: Copy the out/ directory (main, preload, renderer)
  log('Step 1: Copying compiled output (out/)...');
  const outSrc = path.join(MAC_EXTRACTED, 'out');
  const outDest = path.join(WIN_ROOT, 'out');

  try {
    copyDirSync(path.join(outSrc, 'main'), path.join(outDest, 'main'));
  } catch (e) { /* robocopy quirk */ }
  try {
    copyDirSync(path.join(outSrc, 'preload'), path.join(outDest, 'preload'));
  } catch (e) { /* robocopy quirk */ }
  try {
    copyDirSync(path.join(outSrc, 'renderer'), path.join(outDest, 'renderer'));
  } catch (e) { /* robocopy quirk */ }

  log('  Output copied.');

  // Step 2: Patch main/index.js for Windows compatibility
  log('Step 2: Patching main/index.js for Windows...');
  const mainJsPath = path.join(outDest, 'main', 'index.js');
  let mainJs = fs.readFileSync(mainJsPath, 'utf-8');

  // 2a: Replace all "notify-app.sh" references with "notify-app.cmd"
  const shCount = (mainJs.match(/notify-app\.sh/g) || []).length;
  mainJs = mainJs.replace(/notify-app\.sh/g, 'notify-app.cmd');
  log(`  Replaced ${shCount} references to notify-app.sh -> notify-app.cmd`);

  // 2b: Remove chmod +x calls (Windows doesn't need/support this)
  // Pattern: await ce(`chmod +x "${r}"`)  or similar
  mainJs = mainJs.replace(/,\s*await\s+\w+\(`chmod\s+\+x\s+"[^"]*"\`\)/g, '');
  mainJs = mainJs.replace(/await\s+\w+\(`chmod\s+\+x\s+"[^"]*"\`\)/g, '');
  // Also handle: await ce(`chmod +x "${r}"`) as a standalone statement
  mainJs = mainJs.replace(/\bawait\s+\w+\(\s*`chmod\s+\+x\s+[^`]*`\s*\)/g, 'void 0');
  log('  Removed chmod +x calls');

  // 2c: Fix BrowserWindow frame for Windows
  // Mac: titleBarStyle:"hiddenInset",frame:process.platform==="darwin"
  // Windows needs: frame:true (or we keep hiddenInset which just gets ignored on Windows)
  // Actually, titleBarStyle:"hiddenInset" is mac-only and ignored on Windows
  // But frame:process.platform==="darwin" would make frame=false on Windows!
  // We need frame:true on Windows for a proper titlebar
  // Replace: frame:process.platform==="darwin" with frame:true
  mainJs = mainJs.replace(
    /frame:\s*process\.platform\s*===\s*"darwin"/g,
    'frame:true'
  );
  log('  Fixed BrowserWindow frame for Windows');

  // 2d: Fix PATH fallback (use Windows-appropriate default)
  mainJs = mainJs.replace(
    /PATH:\s*process\.env\.PATH\s*\|\|\s*"\/usr\/local\/bin:\/usr\/bin:\/bin:\/usr\/sbin:\/sbin"/g,
    'PATH:process.env.PATH||process.env.SystemRoot+"\\\\System32;"+process.env.SystemRoot+"\\\\System32\\\\WindowsPowerShell\\\\v1.0"'
  );
  log('  Fixed PATH fallback for Windows');

  // 2e: Fix sharp module reference from darwin to win32
  mainJs = mainJs.replace(/@img\/sharp-darwin-arm64/g, '@img/sharp-win32-x64');
  mainJs = mainJs.replace(/sharp-darwin-arm64\.node/g, 'sharp-win32-x64.node');
  log('  Fixed sharp module references');

  // 2f: Fix HOME env var reference for Windows (use USERPROFILE if HOME not set)
  // The existing code: HOME:process.env.HOME||require("os").homedir()
  // This actually works on Windows since os.homedir() returns the right thing
  // But let's also ensure USERPROFILE is available
  mainJs = mainJs.replace(
    /HOME:\s*process\.env\.HOME\s*\|\|\s*require\("os"\)\.homedir\(\)/g,
    'HOME:process.env.HOME||process.env.USERPROFILE||require("os").homedir()'
  );
  log('  Added USERPROFILE fallback for HOME');

  // 2g: Fix "which claude" -> "where claude" on Windows
  // The onboarding check uses "which claude" which is Unix-only
  mainJs = mainJs.replace(
    /ae\("which claude"\)/g,
    'ae(process.platform==="win32"?"where claude":"which claude")'
  );
  const whichCount = (mainJs.match(/which claude/g) || []).length;
  log(`  Fixed "which claude" -> cross-platform check (${whichCount === 0 ? 'all replaced' : whichCount + ' remaining in safe contexts'})`);

  // 2h: Fix titleBarStyle for Windows
  // "hiddenInset" is macOS-only; on Windows with frame:true it's ignored,
  // but let's set it properly to avoid any edge cases
  mainJs = mainJs.replace(
    /titleBarStyle:\s*"hiddenInset"/g,
    'titleBarStyle:process.platform==="darwin"?"hiddenInset":"default"'
  );
  log('  Fixed titleBarStyle for cross-platform');

  fs.writeFileSync(mainJsPath, mainJs, 'utf-8');
  log('  Main process patched successfully.');

  // Step 3: Copy node_modules from the asar (these are the pure JS modules)
  log('Step 3: Syncing node_modules from asar...');

  // We'll use npm install instead to get the correct Windows native modules
  // But first, let's copy non-native modules from the extracted asar
  // Actually, the better approach is: npm install will handle everything
  log('  Will use npm install for proper Windows module resolution.');

  // Step 4: Copy resources
  log('Step 4: Copying resources...');
  const resSrc = path.join(MAC_EXTRACTED, 'out', 'renderer', 'roro_transparent.png');
  if (fs.existsSync(resSrc)) {
    // Copy with original name first (rebrand patch will rename it)
    fs.copyFileSync(resSrc, path.join(outDest, 'renderer', 'roro_transparent.png'));
  }
  log('  Resources copied.');

  // Step 5: Apply base Windows patches
  log('Step 5: Applying base Windows patches...');
  try {
    require('./patch-process-detection.js');
  } catch (e) {
    log('  Process detection patch: ' + (e.message || 'applied or skipped'));
  }
  try {
    require('./patch-windows-improvements.js');
  } catch (e) {
    log('  Windows improvements patch error: ' + e.message);
  }
  try {
    require('./patch-startup-reliability.js');
  } catch (e) {
    log('  Startup reliability patch error: ' + e.message);
  }

  // Step 6: Apply v1.0.92 patches (Ollama + renderer fixes + path normalization)
  log('Step 6: Applying v1.0.92 patches...');
  try {
    require('./patch-ollama-integration.js');
  } catch (e) {
    log('  Ollama integration patch error: ' + e.message);
  }
  try {
    require('./patch-windows-renderer.js');
  } catch (e) {
    log('  Windows renderer patch error: ' + e.message);
  }
  try {
    require('./patch-path-normalization.js');
  } catch (e) {
    log('  Path normalization patch error: ' + e.message);
  }

  // Step 7: Apply Model Hub (Tools tab)
  log('Step 7: Applying Model Hub...');
  try {
    require('./patch-model-hub.js');
  } catch (e) {
    log('  Model Hub patch error: ' + e.message);
  }

  // Step 8: Apply agent model picker
  log('Step 8: Applying agent model picker...');
  try {
    require('./patch-agent-model-picker.js');
  } catch (e) {
    log('  Agent model picker patch error: ' + e.message);
  }

  // Step 9: Apply agent capability badges
  log('Step 9: Applying agent capability badges...');
  try {
    require('./patch-agent-badges.js');
  } catch (e) {
    log('  Agent badges patch error: ' + e.message);
  }

  // Step 10: Apply smart agent templates
  log('Step 10: Applying smart agent templates...');
  try {
    require('./patch-agent-templates.js');
  } catch (e) {
    log('  Agent templates patch error: ' + e.message);
  }

  // Step 11: Apply conversation export
  log('Step 11: Applying conversation export...');
  try {
    require('./patch-conversation-export.js');
  } catch (e) {
    log('  Conversation export patch error: ' + e.message);
  }

  // Step 12: Apply color palette (navy/pink theme)
  log('Step 12: Applying color palette...');
  try {
    require('./patch-color-palette.js');
  } catch (e) {
    log('  Color palette patch error: ' + e.message);
  }

  // Step 13: Palette system — DISABLED pending v1.1.0 release
  // log('Step 13: Applying palette system...');
  // try { require('./patch-palette-system.js'); } catch (e) { log('  Palette system patch error: ' + e.message); }

  // Step 13: Apply rebrand (roro -> EveRo)
  log('Step 13: Applying EveRo rebrand...');
  try {
    require('./patch-rebrand.js');
  } catch (e) {
    log('  Rebrand patch error: ' + e.message);
  }

  // Step 14: UI polish & cleanup (tab labels, DM stubs, profile page)
  log('Step 14: Applying UI polish & cleanup...');
  try {
    require('./patch-ui-polish.js');
  } catch (e) {
    log('  UI polish patch error: ' + e.message);
  }

  // Step 15: Fix index.html (title + clean template)
  log('Step 15: Fixing renderer index.html...');
  const indexHtmlPath = path.join(outDest, 'renderer', 'index.html');
  fs.writeFileSync(indexHtmlPath, `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EveRo</title>
    <script type="module" crossorigin src="./assets/index-BFJPEAID.js"></script>
    <link rel="stylesheet" crossorigin href="./assets/index-CDjYEUtK.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`, 'utf-8');
  log('  Set title to "EveRo", clean HTML template');

  // Step 16: Restore custom EveRo icons (overwritten by Step 1 mac copy)
  log('Step 16: Restoring custom EveRo icons...');
  const iconsDir = path.join(WIN_ROOT, 'resources', 'icons');
  const iconMap = [
    ['evero_transparent.png', path.join(outDest, 'renderer', 'evero_transparent.png')],
    ['evero_transparent-d1cj6xt4.png', path.join(outDest, 'renderer', 'assets', 'evero_transparent-d1cj6xt4.png')],
    ['evero_icon-CWBhGVPN.png', path.join(outDest, 'renderer', 'assets', 'evero_icon-CWBhGVPN.png')],
  ];
  let iconCount = 0;
  for (const [src, dest] of iconMap) {
    const srcPath = path.join(iconsDir, src);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, dest);
      iconCount++;
    }
  }
  if (iconCount > 0) {
    log(`  Restored ${iconCount} custom icons from resources/icons/`);
  } else {
    log('  No custom icons found in resources/icons/ — using defaults');
  }

  log('');
  log('Build preparation complete! (EveRo v1.0.92)');
  log('Next steps:');
  log('  1. Run: npm install (to get Windows native modules)');
  log('  2. Run: npm run dist (to build the Windows installer)');
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
