// Test which renderer patch breaks ES module parsing
// Copies fresh from mac, applies patches one at a time cumulatively
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const src = 'A:/ai/claude/automation/windowscov/roro-mac/app-extracted/out/renderer/assets/index-BFJPEAID.js';
const dst = 'A:/ai/claude/automation/windowscov/roro-win/out/renderer/assets/index-BFJPEAID.js';
const url = 'file:///A:/ai/claude/automation/windowscov/roro-win/out/renderer/assets/index-BFJPEAID.js';

async function check(label) {
  const lines = fs.readFileSync(dst, 'utf-8').split('\n').length;
  try {
    // Dynamic import with cache bust
    const cacheBust = '?t=' + Date.now();
    await import(url + cacheBust);
    console.log(`${label}: ${lines} lines - OK (runtime)`)
    return true;
  } catch(e) {
    if (e instanceof SyntaxError) {
      console.log(`${label}: ${lines} lines - SYNTAX ERROR: ${e.message}`);
      return false;
    } else {
      console.log(`${label}: ${lines} lines - OK (parse fine, runtime: ${e.message?.substring(0,40)})`);
      return true;
    }
  }
}

// Fresh copy
fs.copyFileSync(src, dst);
await check('Fresh (no patches)');

// Need main process patched for some renderer patches to find anchors
// So let's also keep main fresh and patch it
const mainSrc = 'A:/ai/claude/automation/windowscov/roro-mac/app-extracted/out/main/index.js';
const mainDst = 'A:/ai/claude/automation/windowscov/roro-win/out/main/index.js';

// Build the main process first (patches need it)
// Actually, let's just test renderer patches in isolation

const rendererPatches = [
  ['patch-windows-renderer.js', 'Windows renderer (Ollama UI, keyboard, paths)'],
  ['patch-model-hub.js', 'Model Hub (renderer part only)'],
  ['patch-agent-model-picker.js', 'Agent model picker'],
  ['patch-agent-badges.js', 'Agent badges'],
  ['patch-agent-templates.js', 'Agent templates'],
  ['patch-conversation-export.js', 'Conversation export (renderer part only)'],
  ['patch-color-palette.js', 'Color palette (renderer part only)'],
  ['patch-rebrand.js', 'Rebrand (renderer part only)'],
];

// Apply cumulatively
fs.copyFileSync(src, dst);
for (const [script, label] of rendererPatches) {
  try {
    const mod = path.resolve('A:/ai/claude/automation/windowscov/roro-win/scripts', script);
    // Clear cache
    delete require.cache[require.resolve(mod)];
    require(mod);
  } catch(e) {
    // Some patches may fail when applied alone (missing anchors from earlier patches)
  }
  const ok = await check(`After ${label}`);
  if (!ok) {
    console.log(`\n>>> BROKEN BY: ${script} <<<\n`);
    break;
  }
}
