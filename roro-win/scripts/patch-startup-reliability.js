/**
 * Startup reliability patch for EveRo
 *
 * Fixes: App shows blank/no window when Supabase auth or analytics init hangs.
 * The original code creates the BrowserWindow AFTER awaiting service initialization.
 * If S.initialize() (auth) or y.initialize() (analytics) hangs or throws,
 * the window never appears and the process runs invisibly.
 *
 * Fix: Wrap service inits in try/catch with timeouts so they can't hang forever,
 * but keep me() right before if(k) so IPC handlers register immediately after
 * the window is created (no race condition with renderer).
 */

const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../out/main/index.js');
let code = fs.readFileSync(mainJsPath, 'utf-8');
const origLen = code.length;

function log(msg) { console.log(`[patch-startup-reliability] ${msg}`); }

log('Applying startup reliability patch...');

// Original init sequence:
//   if(A.initialize(), await S.initialize(), await y.initialize(), y.track("app_start"), me(), k){...}
//
// Problem: If S.initialize() or y.initialize() hangs, me() never runs → no window.
//
// Fix: Wrap service inits in try/catch with timeouts, then call me() + if(k) immediately.
// This keeps IPC handler registration right after window creation (no race condition).

const oldInit = 'if(A.initialize(),await S.initialize(),await y.initialize(),y.track("app_start"),me(),k){';
const newInit = 'A.initialize();try{await Promise.race([S.initialize(),new Promise(r=>setTimeout(r,5e3))])}catch(_ie){}try{await Promise.race([y.initialize(),new Promise(r=>setTimeout(r,3e3))]);y.track("app_start")}catch(_ie){}me();if(k){';

if (code.includes(oldInit)) {
  code = code.replace(oldInit, newInit);
  log('  Services wrapped with timeouts (5s auth, 3s analytics)');
  log('  Window creation (me()) runs right before if(k) — no IPC race condition');
} else if (code.includes('A.initialize();try{await Promise.race([S.initialize()')) {
  log('  Startup reliability already applied — skipping');
} else if (code.includes('me();try{A.initialize()')) {
  // Old version of this patch (me() first) — needs replacement
  const oldPatch = 'me();try{A.initialize();await Promise.race([S.initialize(),new Promise(r=>setTimeout(r,5e3))])}catch(_ie){}try{await Promise.race([y.initialize(),new Promise(r=>setTimeout(r,3e3))]);y.track("app_start")}catch(_ie){}if(k){';
  if (code.includes(oldPatch)) {
    code = code.replace(oldPatch, newInit);
    log('  Replaced old patch (me-first) with fixed version (me-last)');
  }
} else {
  log('  WARNING: Init pattern not found');
}

fs.writeFileSync(mainJsPath, code, 'utf-8');
log(`  File: ${origLen} -> ${code.length} bytes`);

// Verify
const verify = fs.readFileSync(mainJsPath, 'utf-8');
const checks = [
  ['Services before window', verify.includes('A.initialize();try{await Promise.race([S.initialize()')],
  ['Auth timeout (5s)', verify.includes('Promise.race([S.initialize()')],
  ['Analytics timeout (3s)', verify.includes('Promise.race([y.initialize()')],
  ['Window right before IPC setup', verify.includes('me();if(k){')],
  ['Error handling', verify.includes('catch(_ie)')],
];

log('');
log('Verification:');
checks.forEach(([name, ok]) => {
  log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}`);
});
