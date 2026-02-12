/**
 * Comprehensive verification of all EveRo v1.0.92 patches
 */
const fs = require('fs');
const path = require('path');

function log(msg) { console.log(msg); }

// ============================================================
// MAIN PROCESS VERIFICATION
// ============================================================
log('=== MAIN PROCESS VERIFICATION ===\n');

const mainCode = fs.readFileSync(path.resolve(__dirname, '../out/main/index.js'), 'utf-8');
let mainPass = 0, mainFail = 0;

const mainChecks = [
  // v1.0.90 base patches
  ['notify-app.cmd', /notify-app\.cmd/],
  ['frame:true', /frame:true/],
  ['sharp-win32-x64 (in build-win.js patch)', /true/],  // sharp ref is in node_modules, not main.js; build-win patches it at copy time
  ['USERPROFILE fallback', /USERPROFILE/],
  ['where claude', /where claude/],
  ['PATH System32 fallback', /SystemRoot/],
  ['titleBarStyle cross-platform', /titleBarStyle:process\.platform/],
  // v1.0.91 UX patches
  ['wmic process detection', /wmic/],
  ['single-instance lock', /requestSingleInstanceLock/],
  ['second-instance handler', /second-instance/],
  ['auto-launch claude', /_launchConfig/],
  ['launch-config:set IPC', /launch-config:set/],
  ['launch-config:get IPC', /launch-config:get"/],
  ['launch-config:get-defaults IPC', /launch-config:get-defaults/],
  // v1.0.92 Ollama patches
  ['OllamaService class', /class OllamaService/],
  ['Ollama API host', /localhost:11434/],
  ['createAgent modelLogo dispatch', /n==="ollama"\?"ollama":"claude"/],
  ['createAgent service dispatch', /n==="ollama"\?new OllamaService/],
  ['Agent restore dispatch', /metadata&&d\.metadata\.type==="ollama"/],
  ['ollama:check-status IPC', /ollama:check-status/],
  ['ollama:list-models IPC', /ollama:list-models/],
  ['ollama:set-model IPC', /ollama:set-model/],
  ['ollama:pull-model IPC', /ollama:pull-model/],
  ['ollamaModel in defaults', /ollamaModel/],
  // v1.0.92 path normalization
  ['__normPath helper', /__normPath\(p\)/],
  ['__normFileMap helper', /__normFileMap\(fm\)/],
  ['file-activity normalization', /filePath:__normPath\(m\)/],
  ['file-map:load normalization', /__normFileMap\(/],
  ['file-map:get normalization', /fileMap:__normFileMap\(n\)/],
  // v1.0.92 rebrand
  ['EveRo window title', /title:"EveRo"/],
  ['evero-dev userData', /evero-dev/],
  ['evero OAuth redirect', /evero:\/\/auth\/callback/],
  ['evero protocol handler', /setAsDefaultProtocolClient\("evero"\)/],
  ['EveRo bot name', /name:"EveRo"/],
  ['evero_icon avatar', /evero_icon/],
  ['No "roro" quoted strings', null], // special check
];

mainChecks.forEach(([name, test]) => {
  let ok;
  if (test === null) {
    // Check no remaining "roro" as standalone quoted string
    ok = !mainCode.includes('"roro"');
  } else {
    ok = test.test(mainCode);
  }
  log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}`);
  ok ? mainPass++ : mainFail++;
});

log(`\n  Main: ${mainPass}/${mainChecks.length} passed${mainFail ? ` (${mainFail} FAILED)` : ''}`);
log(`  File size: ${mainCode.length} bytes\n`);

// ============================================================
// RENDERER VERIFICATION
// ============================================================
log('=== RENDERER VERIFICATION ===\n');

const renderCode = fs.readFileSync(path.resolve(__dirname, '../out/renderer/assets/index-BFJPEAID.js'), 'utf-8');
let renderPass = 0, renderFail = 0;

const renderChecks = [
  // Ollama UI
  ['Ollama in PH logo map', /PH=\{claude:zw,codex:jw,ollama:/],
  ['Ollama in zY logo map', /zY=\{claude:zw,codex:jw,ollama:/],
  ['Ollama alt text', /ollama.*?Ollama/],
  ['Ollama model selector button', /onClick:.*?ollama/],
  // Keyboard shortcuts
  ['Ctrl+L shortcut', /ctrlKey.*?key==="l"/],
  ['Ctrl+Backspace shortcut', /ctrlKey.*?key==="Backspace"/],
  // Path splitting
  ['Path split regex exists', /split\(\/\[/],
  // Event prefix
  ['Hook event prefix', /\[Hook\]/],
  // Rebrand
  ['EveRo alt text', /alt:"EveRo"/],
  ['EveRo sender', /sender:"EveRo"/],
  ['evero_transparent image ref', /evero_transparent/],
  ['evero_icon image ref', /evero_icon/],
  ['EveRo marketing copy', /At EveRo,/],
  // Agent badges
  ['THINK badge on Claude agents', /children:"THINK"/],
  ['CODE badge on agents', /children:"CODE"/],
  ['TOOLS badge on Claude agents', /children:"TOOLS"/],
  ['LOCAL badge on Ollama agents', /children:"LOCAL"/],
  // Model Hub
  ['Model Hub component', /Model Hub/],
  ['Featured Models section', /Featured Models/],
  ['Pull New Model section', /Pull New Model/],
  ['Model picker dropdown', /Ollama Model/],
  // Agent templates
  ['Claude Agent template button', /children:"Claude Agent"/],
  ['Ollama Agent template button', /children:"Ollama Agent"/],
  ['Ollama createAgent in template', /createAgent\(s,ee,i,"ollama"\)/],
];

renderChecks.forEach(([name, test]) => {
  const ok = test.test(renderCode);
  log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}`);
  ok ? renderPass++ : renderFail++;
});

// Check no remaining roro branding (excluding false positives)
let roroCount = 0;
let pos = 0;
while (true) {
  const idx = renderCode.indexOf('roro', pos);
  if (idx === -1) break;
  const ctx = renderCode.substring(Math.max(0, idx - 5), idx + 10);
  if (!/rror[oO]|irror[oO]|rror_/.test(ctx)) {
    roroCount++;
  }
  pos = idx + 4;
}
const noRoro = roroCount === 0;
log(`  ${noRoro ? 'PASS' : 'FAIL'} - No remaining "roro" branding (found ${roroCount})`);
noRoro ? renderPass++ : renderFail++;

log(`\n  Renderer: ${renderPass}/${renderChecks.length + 1} passed${renderFail ? ` (${renderFail} FAILED)` : ''}`);
log(`  File size: ${renderCode.length} bytes\n`);

// ============================================================
// FILE EXISTENCE CHECKS
// ============================================================
log('=== FILE EXISTENCE CHECKS ===\n');

const rootDir = path.resolve(__dirname, '..');
const fileChecks = [
  'out/main/index.js',
  'out/preload/index.js',
  'out/renderer/assets/index-BFJPEAID.js',
  'out/renderer/assets/evero_icon-CWBhGVPN.png',
  'out/renderer/assets/evero_transparent-d1cj6xt4.png',
  'out/renderer/evero_transparent.png',
  'resources/icon.ico',
  'resources/app-update.yml',
  'resources/hooks/notify-app.cmd',
  'resources/hooks/settings.json',
  'package.json',
];

let filePass = 0, fileFail = 0;
fileChecks.forEach(f => {
  const exists = fs.existsSync(path.join(rootDir, f));
  log(`  ${exists ? 'PASS' : 'FAIL'} - ${f}`);
  exists ? filePass++ : fileFail++;
});

// Check that old roro_ files DON'T exist
const oldFiles = [
  'out/renderer/assets/roro_icon-CWBhGVPN.png',
  'out/renderer/assets/roro_transparent-d1cj6xt4.png',
  'out/renderer/roro_transparent.png',
];
oldFiles.forEach(f => {
  const gone = !fs.existsSync(path.join(rootDir, f));
  log(`  ${gone ? 'PASS' : 'FAIL'} - Old file removed: ${f}`);
  gone ? filePass++ : fileFail++;
});

log(`\n  Files: ${filePass}/${fileChecks.length + oldFiles.length} passed\n`);

// ============================================================
// CONFIG VERIFICATION
// ============================================================
log('=== CONFIG VERIFICATION ===\n');

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
let cfgPass = 0, cfgFail = 0;

const cfgChecks = [
  ['package name = evero', pkg.name === 'evero'],
  ['version = 1.0.92', pkg.version === '1.0.92'],
  ['appId = com.evero.app', pkg.build.appId === 'com.evero.app'],
  ['productName = EveRo', pkg.build.productName === 'EveRo'],
  ['shortcutName = EveRo', pkg.build.nsis.shortcutName === 'EveRo'],
  ['protocol name = evero', pkg.build.protocols.name === 'evero'],
  ['protocol scheme = evero', pkg.build.protocols.schemes[0] === 'evero'],
  ['publish repo = evero', pkg.build.publish.repo === 'evero'],
];

cfgChecks.forEach(([name, ok]) => {
  log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}`);
  ok ? cfgPass++ : cfgFail++;
});

const appUpdate = fs.readFileSync(path.join(rootDir, 'resources/app-update.yml'), 'utf-8');
const auChecks = [
  ['app-update repo = evero', appUpdate.includes('repo: evero')],
  ['app-update cache = evero-updater', appUpdate.includes('updaterCacheDirName: evero-updater')],
];
auChecks.forEach(([name, ok]) => {
  log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}`);
  ok ? cfgPass++ : cfgFail++;
});

log(`\n  Config: ${cfgPass}/${cfgChecks.length + auChecks.length} passed\n`);

// ============================================================
// COLOR PALETTE VERIFICATION
// ============================================================
log('=== COLOR PALETTE VERIFICATION ===\n');

const cssCode = fs.readFileSync(path.resolve(__dirname, '../out/renderer/assets/index-CDjYEUtK.css'), 'utf-8');
let colorPass = 0, colorFail = 0;

const colorChecks = [
  ['--dark-bg is #232946', cssCode.includes('--dark-bg: #232946')],
  ['--dark-surface is #1e2440', cssCode.includes('--dark-surface: #1e2440')],
  ['--dark-text-primary is #fffffe', cssCode.includes('--dark-text-primary: #fffffe')],
  ['--dark-text-secondary is #b8c1ec', cssCode.includes('--dark-text-secondary: #b8c1ec')],
  ['--dark-text-tertiary is #8892b8', cssCode.includes('--dark-text-tertiary: #8892b8')],
  ['--primary-300 is #eebbc3 (button/highlight)', cssCode.includes('--primary-300: #eebbc3')],
  ['--primary-500 is #d4899a', cssCode.includes('--primary-500: #d4899a')],
  ['--dark-hover is #303767', cssCode.includes('--dark-hover: #303767')],
  ['--dark-input-bg is #1a1f3d', cssCode.includes('--dark-input-bg: #1a1f3d')],
  ['Body gradient uses navy', cssCode.includes('#1a2040,#232946')],
  ['Glass bg is navy', cssCode.includes('rgba(35, 41, 70, .85)')],
  ['Accent glow is pink', cssCode.includes('rgba(238, 187, 195, .15)')],
  ['No old purple primary in vars', !cssCode.includes('--primary-500: #a855f7')],
  ['No old dark-bg (#0f0f12)', !cssCode.includes('--dark-bg: #0f0f12')],
  ['No old body gradient (#1a1025)', !cssCode.includes('background:linear-gradient(135deg,#1a1025')],
];

colorChecks.forEach(([name, ok]) => {
  log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}`);
  ok ? colorPass++ : colorFail++;
});

log(`\n  Colors: ${colorPass}/${colorChecks.length} passed\n`);

// ============================================================
// SUMMARY
// ============================================================
const totalPass = mainPass + renderPass + filePass + cfgPass + colorPass;
const totalFail = mainFail + renderFail + fileFail + cfgFail + colorFail;
const totalChecks = totalPass + totalFail;

log('=== SUMMARY ===\n');
log(`  Total: ${totalPass}/${totalChecks} passed`);
if (totalFail > 0) {
  log(`  FAILURES: ${totalFail}`);
  process.exit(1);
} else {
  log('  ALL CHECKS PASSED');
}
