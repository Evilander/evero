/**
 * Rebrand patch for EveRo v1.0.92-win
 *
 * Renames all "roro" branding to "EveRo" / "evero" in both
 * main process and renderer bundles.
 *
 * Main process patches:
 * 1. userData directory: roro-dev -> evero-dev
 * 2. OAuth redirects: roro://auth/callback -> evero://auth/callback
 * 3. Bot identity name: name:"roro" -> name:"EveRo"
 * 4. Bot avatar path: /roro_icon.png -> /evero_icon.png
 * 5. Protocol handler: setAsDefaultProtocolClient("roro") -> ("evero")
 * 6. Protocol URL matching: roro:// -> evero://
 * 7. Window title: title:"roro" -> title:"EveRo"
 *
 * Renderer patches:
 * 1. Image asset URLs: roro_transparent -> evero_transparent, roro_icon -> evero_icon
 * 2. Alt text: alt:"roro" -> alt:"EveRo"
 * 3. Sender identity: sender:"roro" -> sender:"EveRo"
 * 4. Marketing copy: "roro" -> "EveRo" in DM welcome message
 */

const fs = require('fs');
const path = require('path');

function log(msg) {
  console.log(`[patch-rebrand] ${msg}`);
}

// ============================================================
// PART 1: MAIN PROCESS REBRAND
// ============================================================

const mainJsPath = path.resolve(__dirname, '../out/main/index.js');
let mainCode = fs.readFileSync(mainJsPath, 'utf-8');
const mainOrigLen = mainCode.length;

log('Rebranding main process...');

// 1a: userData directory name
// roro-dev-${e} and roro-dev -> evero-dev-${e} and evero-dev
const udCount = (mainCode.match(/roro-dev/g) || []).length;
mainCode = mainCode.replace(/roro-dev/g, 'evero-dev');
log(`  [1/7] userData directory: roro-dev -> evero-dev (${udCount} occurrences)`);

// 1b: OAuth redirect URLs
// redirectTo:"roro://auth/callback" -> redirectTo:"evero://auth/callback"
const oauthCount = (mainCode.match(/roro:\/\/auth\/callback/g) || []).length;
mainCode = mainCode.replace(/roro:\/\/auth\/callback/g, 'evero://auth/callback');
log(`  [2/7] OAuth redirects: roro://auth/callback -> evero://auth/callback (${oauthCount} occurrences)`);

// 1c: Bot identity name
// name:"roro" -> name:"EveRo"
if (mainCode.includes('name:"roro"')) {
  mainCode = mainCode.replace('name:"roro"', 'name:"EveRo"');
  log('  [3/7] Bot identity: name:"roro" -> name:"EveRo"');
} else {
  log('  [3/7] WARNING: Could not find name:"roro" pattern');
}

// 1d: Bot avatar path
// avatar:"/roro_icon.png" -> avatar:"/evero_icon.png"
if (mainCode.includes('avatar:"/roro_icon.png"')) {
  mainCode = mainCode.replace('avatar:"/roro_icon.png"', 'avatar:"/evero_icon.png"');
  log('  [4/7] Bot avatar: /roro_icon.png -> /evero_icon.png');
} else {
  log('  [4/7] WARNING: Could not find avatar:"/roro_icon.png" pattern');
}

// 1e: Protocol handler registration
// setAsDefaultProtocolClient("roro") -> setAsDefaultProtocolClient("evero")
// Note: patch-windows-improvements.js already injects this, but the original
// code also has it. We catch any remaining instances.
const protCount = (mainCode.match(/setAsDefaultProtocolClient\("roro"\)/g) || []).length;
mainCode = mainCode.replace(/setAsDefaultProtocolClient\("roro"\)/g, 'setAsDefaultProtocolClient("evero")');
log(`  [5/7] Protocol registration: "roro" -> "evero" (${protCount} occurrences)`);

// 1f: Protocol URL matching in open-url and second-instance handlers
// e.startsWith("roro://") -> e.startsWith("evero://")
// a.startsWith("roro://") -> a.startsWith("evero://")
const urlCount = (mainCode.match(/startsWith\("roro:\/\//g) || []).length;
mainCode = mainCode.replace(/startsWith\("roro:\/\//g, 'startsWith("evero://');
log(`  [6/7] Protocol URL matching: roro:// -> evero:// (${urlCount} occurrences)`);

// 1g: Window title
// title:"roro" -> title:"EveRo"
if (mainCode.includes('title:"roro"')) {
  mainCode = mainCode.replace('title:"roro"', 'title:"EveRo"');
  log('  [7/7] Window title: "roro" -> "EveRo"');
} else {
  log('  [7/7] WARNING: Could not find title:"roro" pattern');
}

fs.writeFileSync(mainJsPath, mainCode, 'utf-8');
log(`  Main process rebranded: ${mainOrigLen} -> ${mainCode.length} bytes`);

// ============================================================
// PART 2: RENDERER REBRAND
// ============================================================

const rendererPath = path.resolve(__dirname, '../out/renderer/assets/index-BFJPEAID.js');
let renderCode = fs.readFileSync(rendererPath, 'utf-8');
const renderOrigLen = renderCode.length;

log('');
log('Rebranding renderer...');

// 2a: Image asset URL - roro_transparent
// "roro_transparent-d1cj6xt4.png" -> "evero_transparent-d1cj6xt4.png"
if (renderCode.includes('roro_transparent')) {
  const rtCount = (renderCode.match(/roro_transparent/g) || []).length;
  renderCode = renderCode.replace(/roro_transparent/g, 'evero_transparent');
  log(`  [1/4] Image URL: roro_transparent -> evero_transparent (${rtCount} occurrences)`);
} else {
  log('  [1/4] WARNING: Could not find roro_transparent pattern');
}

// 2b: Image asset URL - roro_icon
// "roro_icon-CWBhGVPN.png" -> "evero_icon-CWBhGVPN.png"
if (renderCode.includes('roro_icon')) {
  const riCount = (renderCode.match(/roro_icon/g) || []).length;
  renderCode = renderCode.replace(/roro_icon/g, 'evero_icon');
  log(`  [2/4] Image URL: roro_icon -> evero_icon (${riCount} occurrences)`);
} else {
  log('  [2/4] WARNING: Could not find roro_icon pattern');
}

// 2c: Alt text and sender identity
// alt:"roro" -> alt:"EveRo"
// sender:"roro" -> sender:"EveRo"
const altCount = (renderCode.match(/alt:"roro"/g) || []).length;
renderCode = renderCode.replace(/alt:"roro"/g, 'alt:"EveRo"');
log(`  [3/4] Alt text: alt:"roro" -> alt:"EveRo" (${altCount} occurrences)`);

const senderCount = (renderCode.match(/sender:"roro"/g) || []).length;
renderCode = renderCode.replace(/sender:"roro"/g, 'sender:"EveRo"');
log(`  [3/4] Sender: sender:"roro" -> sender:"EveRo" (${senderCount} occurrences)`);

// 2d: Marketing copy in DM welcome message
// "At roro, you're the VIP..." -> "At EveRo, you're the VIP..."
// "the direct roro DM" -> "the direct EveRo DM"
// "roro can push an update" -> "EveRo can push an update"
// These are in a contiguous string area, use targeted replacements
if (renderCode.includes('At roro,')) {
  renderCode = renderCode.replace('At roro,', 'At EveRo,');
  log('  [4/4] Marketing copy: "At roro," -> "At EveRo,"');
} else {
  log('  [4/4] WARNING: Could not find "At roro," in marketing copy');
}

if (renderCode.includes('direct roro DM')) {
  renderCode = renderCode.replace('direct roro DM', 'direct EveRo DM');
  log('  [4/4] Marketing copy: "direct roro DM" -> "direct EveRo DM"');
}

if (renderCode.includes('roro can push')) {
  renderCode = renderCode.replace('roro can push', 'EveRo can push');
  log('  [4/4] Marketing copy: "roro can push" -> "EveRo can push"');
}

fs.writeFileSync(rendererPath, renderCode, 'utf-8');
log(`  Renderer rebranded: ${renderOrigLen} -> ${renderCode.length} bytes`);

// ============================================================
// PART 3: RENAME IMAGE FILES
// ============================================================

log('');
log('Renaming image files...');

const renameMap = [
  ['out/renderer/assets/roro_icon-CWBhGVPN.png', 'out/renderer/assets/evero_icon-CWBhGVPN.png'],
  ['out/renderer/assets/roro_transparent-d1cj6xt4.png', 'out/renderer/assets/evero_transparent-d1cj6xt4.png'],
  ['out/renderer/roro_transparent.png', 'out/renderer/evero_transparent.png'],
];

const rootDir = path.resolve(__dirname, '..');
renameMap.forEach(([oldName, newName]) => {
  const oldPath = path.join(rootDir, oldName);
  const newPath = path.join(rootDir, newName);
  if (fs.existsSync(oldPath)) {
    // Copy instead of rename to handle cross-device moves
    fs.copyFileSync(oldPath, newPath);
    fs.unlinkSync(oldPath);
    log(`  Renamed: ${oldName} -> ${newName}`);
  } else if (fs.existsSync(newPath)) {
    log(`  Already renamed: ${newName}`);
  } else {
    log(`  WARNING: File not found: ${oldName}`);
  }
});

// ============================================================
// VERIFICATION
// ============================================================

log('');
log('Verification:');

const verifyMain = fs.readFileSync(mainJsPath, 'utf-8');
const verifyRender = fs.readFileSync(rendererPath, 'utf-8');

const mainChecks = [
  ['userData evero-dev', 'evero-dev'],
  ['OAuth evero://auth/callback', 'evero://auth/callback'],
  ['Bot name EveRo', 'name:"EveRo"'],
  ['Bot avatar evero_icon', 'avatar:"/evero_icon.png"'],
  ['Protocol evero', 'setAsDefaultProtocolClient("evero")'],
  ['Window title EveRo', 'title:"EveRo"'],
  ['No remaining roro-dev', null],  // special: should NOT be found
];

mainChecks.forEach(([name, pattern]) => {
  if (pattern === null) {
    const found = !verifyMain.includes('roro-dev');
    log(`  ${found ? 'PASS' : 'FAIL'} - ${name}`);
  } else {
    const found = verifyMain.includes(pattern);
    log(`  ${found ? 'PASS' : 'FAIL'} - ${name}`);
  }
});

const renderChecks = [
  ['Image evero_transparent', 'evero_transparent'],
  ['Image evero_icon', 'evero_icon'],
  ['Alt text EveRo', 'alt:"EveRo"'],
  ['Sender EveRo', 'sender:"EveRo"'],
  ['Marketing copy EveRo', 'At EveRo,'],
  ['No remaining roro_transparent', null],  // should NOT be found
  ['No remaining roro_icon', null],  // should NOT be found
  ['No remaining sender:"roro"', null],  // should NOT be found
];

renderChecks.forEach(([name, pattern]) => {
  if (pattern === null) {
    // Check for absence - extract the key from the name
    const checkFor = name.replace('No remaining ', '');
    const found = !verifyRender.includes(checkFor);
    log(`  ${found ? 'PASS' : 'FAIL'} - ${name}`);
  } else {
    const found = verifyRender.includes(pattern);
    log(`  ${found ? 'PASS' : 'FAIL'} - ${name}`);
  }
});

// Count any remaining "roro" in main (excluding source code comments and roro-mac paths)
// We only care about actual branding in the minified code
const mainRoroRemaining = (verifyMain.match(/"roro"/g) || []).length;
log(`  Remaining "roro" quoted strings in main: ${mainRoroRemaining}`);

const renderRoroRemaining = [];
let searchPos = 0;
while (true) {
  const idx = verifyRender.indexOf('roro', searchPos);
  if (idx === -1) break;
  // Check if it's a false positive (part of errorOn, mirrorOf, etc.)
  const ctx = verifyRender.substring(Math.max(0, idx - 5), idx + 10);
  if (!/rror[oO]|irror[oO]|rror_/.test(ctx)) {
    renderRoroRemaining.push(`pos ${idx}: ...${ctx}...`);
  }
  searchPos = idx + 4;
}
if (renderRoroRemaining.length > 0) {
  log(`  WARNING: ${renderRoroRemaining.length} potential "roro" remaining in renderer:`);
  renderRoroRemaining.forEach(r => log(`    ${r}`));
} else {
  log('  PASS - No "roro" branding remaining in renderer');
}
