/**
 * Windows renderer patches for EveRo v1.0.92-win
 *
 * Patches applied to renderer/assets/index-BFJPEAID.js:
 * 1. Add Ollama logo to logo maps (PH and zY)
 * 2. Fix modelLogo alt text to include Ollama
 * 3. Fix keyboard shortcuts (metaKey → ctrlKey||metaKey)
 * 4. Fix path splitting for Windows (split("/") → split(/[/\\]/) in file contexts)
 * 5. Fix hardcoded "Claude" assistant name in chat
 * 6. Add "Ollama" button to model logo selector
 */

const fs = require('fs');
const path = require('path');

const rendererPath = path.resolve(__dirname, '../out/renderer/assets/index-BFJPEAID.js');
let code = fs.readFileSync(rendererPath, 'utf-8');
const originalLength = code.length;

function log(msg) {
  console.log(`[patch-renderer] ${msg}`);
}

// Ollama llama SVG as base64 data URI (simple llama silhouette icon)
const OLLAMA_LOGO = 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.5 2 6 4.5 6 7.5c0 1.5.5 2.8 1.3 3.8-.2.5-.3 1-.3 1.7v5.5c0 1.4 1.1 2.5 2.5 2.5h1c1.4 0 2.5-1.1 2.5-2.5V16h-2v2.5c0 .3-.2.5-.5.5h-1c-.3 0-.5-.2-.5-.5V13c0-.8.3-1.5.8-2 .5-.4.7-1.1.5-1.7C9.5 8.5 8 7.5 8 6c0-2.2 1.8-4 4-4s4 1.8 4 4c0 1.5-1.5 2.5-2.3 3.3-.2.6 0 1.3.5 1.7.5.5.8 1.2.8 2v5.5c0 .3-.2.5-.5.5h-1c-.3 0-.5-.2-.5-.5V16h-2v2.5c0 1.4 1.1 2.5 2.5 2.5h1c1.4 0 2.5-1.1 2.5-2.5V13c0-.7-.1-1.2-.3-1.7C17.5 10.3 18 9 18 7.5 18 4.5 15.5 2 12 2zm-1 5a1 1 0 100 2 1 1 0 000-2zm2 0a1 1 0 100 2 1 1 0 000-2z"/></svg>`).toString('base64');

log('Applying Windows renderer patches...');

// ============================================================
// PATCH 1: Add Ollama logo to both logo maps
// ============================================================

const oldPH = 'PH={claude:zw,codex:jw}';
const newPH = `PH={claude:zw,codex:jw,ollama:"${OLLAMA_LOGO}"}`;

if (code.includes(oldPH)) {
  code = code.replace(oldPH, newPH);
  log('  [1a/6] Added Ollama logo to PH map');
} else {
  log('  [1a/6] WARNING: Could not find PH logo map');
}

const oldzY = 'const zY={claude:zw,codex:jw};';
const newzY = `const zY={claude:zw,codex:jw,ollama:"${OLLAMA_LOGO}"};`;

if (code.includes(oldzY)) {
  code = code.replace(oldzY, newzY);
  log('  [1b/6] Added Ollama logo to zY map');
} else {
  log('  [1b/6] WARNING: Could not find zY logo map');
}

// ============================================================
// PATCH 2: Fix modelLogo alt text to include Ollama
// ============================================================
// Old: alt:t.modelLogo==="codex"?"Codex":"Claude"
// New: alt:t.modelLogo==="codex"?"Codex":t.modelLogo==="ollama"?"Ollama":"Claude"
// Apply to all variable prefixes (t., s., etc.)

const oldAlt1 = 'alt:t.modelLogo==="codex"?"Codex":"Claude"';
const newAlt1 = 'alt:t.modelLogo==="codex"?"Codex":t.modelLogo==="ollama"?"Ollama":"Claude"';

if (code.includes(oldAlt1)) {
  code = code.replace(oldAlt1, newAlt1);
  log('  [2a/6] Fixed alt text (t. prefix)');
} else {
  log('  [2a/6] WARNING: Could not find alt text pattern (t.)');
}

const oldAlt2 = 'alt:s.modelLogo==="codex"?"Codex":"Claude"';
const newAlt2 = 'alt:s.modelLogo==="codex"?"Codex":s.modelLogo==="ollama"?"Ollama":"Claude"';

if (code.includes(oldAlt2)) {
  code = code.replace(oldAlt2, newAlt2);
  log('  [2b/6] Fixed alt text (s. prefix)');
} else {
  log('  [2b/6] WARNING: Could not find alt text pattern (s.)');
}

// Also fix className sizing for ollama (use same size as claude)
const oldClass1 = 'className:t.modelLogo==="codex"?"w-4 h-4 flex-shrink-0":"w-5 h-4 flex-shrink-0"';
const newClass1 = 'className:t.modelLogo==="codex"?"w-4 h-4 flex-shrink-0":t.modelLogo==="ollama"?"w-5 h-5 flex-shrink-0":"w-5 h-4 flex-shrink-0"';

if (code.includes(oldClass1)) {
  code = code.replace(oldClass1, newClass1);
  log('  [2c/6] Fixed logo size class (t. prefix)');
}

const oldClass2 = 'className:s.modelLogo==="codex"?"w-4 h-4 flex-shrink-0":"w-5 h-4 flex-shrink-0"';
const newClass2 = 'className:s.modelLogo==="codex"?"w-4 h-4 flex-shrink-0":s.modelLogo==="ollama"?"w-5 h-5 flex-shrink-0":"w-5 h-4 flex-shrink-0"';

if (code.includes(oldClass2)) {
  code = code.replace(oldClass2, newClass2);
  log('  [2d/6] Fixed logo size class (s. prefix)');
}

// ============================================================
// PATCH 3: Fix keyboard shortcuts for Windows
// ============================================================
// Cmd+L → Ctrl+L or Cmd+L (both work)
// Cmd+Backspace → Ctrl+Backspace or Cmd+Backspace

const oldKeyL = 'k.metaKey&&k.key==="l"&&(k.preventDefault()';
const newKeyL = '(k.metaKey||k.ctrlKey)&&k.key==="l"&&(k.preventDefault()';

if (code.includes(oldKeyL)) {
  code = code.replace(oldKeyL, newKeyL);
  log('  [3a/6] Fixed Cmd+L → Ctrl+L/Cmd+L keyboard shortcut');
} else {
  log('  [3a/6] WARNING: Could not find Cmd+L shortcut pattern');
}

const oldKeyBackspace = 'U.metaKey&&U.key==="Backspace"?(U.preventDefault()';
const newKeyBackspace = '(U.metaKey||U.ctrlKey)&&U.key==="Backspace"?(U.preventDefault()';

if (code.includes(oldKeyBackspace)) {
  code = code.replace(oldKeyBackspace, newKeyBackspace);
  log('  [3b/6] Fixed Cmd+Backspace → Ctrl+Backspace/Cmd+Backspace shortcut');
} else {
  log('  [3b/6] WARNING: Could not find Cmd+Backspace shortcut pattern');
}

// ============================================================
// PATCH 4: Fix path splitting for Windows
// ============================================================
// Only replace .split("/") in file-path contexts (not in URL or generic string splitting)
// We target specific patterns that we know are file paths

// Pattern 1: Filename extraction - file:ie.split("/").pop()
const oldSplit1 = 'file:ie.split("/").pop()';
const newSplit1 = 'file:ie.split(/[\\/\\\\]/).pop()';
if (code.includes(oldSplit1)) {
  code = code.replace(oldSplit1, newSplit1);
  log('  [4a/6] Fixed file path split (file map)');
}

// Pattern 2: const St=ie.split("/").pop()||ie
const oldSplit2 = 'const St=ie.split("/").pop()||ie';
const newSplit2 = 'const St=ie.split(/[\\/\\\\]/).pop()||ie';
if (code.includes(oldSplit2)) {
  code = code.replace(oldSplit2, newSplit2);
  log('  [4b/6] Fixed file path split (St variable)');
}

// Pattern 3: const Xt=je.split("/").pop()||je
const oldSplit3 = 'const Xt=je.split("/").pop()||je';
const newSplit3 = 'const Xt=je.split(/[\\/\\\\]/).pop()||je';
if (code.includes(oldSplit3)) {
  code = code.replace(oldSplit3, newSplit3);
  log('  [4c/6] Fixed file path split (Xt variable)');
}

// Pattern 4: Directory grouping - .split("/"),ie=ee.length (context: path depth)
const oldSplit4 = ':he.slice(i.length+1):he).split("/")';
const newSplit4 = ':he.slice(i.length+1):he).split(/[\\/\\\\]/)';
if (code.includes(oldSplit4)) {
  code = code.replace(oldSplit4, newSplit4);
  log('  [4d/6] Fixed directory grouping split');
}

// Pattern 5: Path truncation function - const n=t.split("/");if(n.length<=2)
const oldSplit5 = 'const n=t.split("/");if(n.length<=2)return t;const i=n[0],r=n.slice(-2).join("/")';
const newSplit5 = 'const n=t.split(/[\\/\\\\]/);if(n.length<=2)return t;const i=n[0],r=n.slice(-2).join("/")';
if (code.includes(oldSplit5)) {
  code = code.replace(oldSplit5, newSplit5);
  log('  [4e/6] Fixed path truncation function split');
}

// Pattern 6: File header display - const b=t.split("/");return b[b.length-1]
const oldSplit6 = 'const b=t.split("/");return b[b.length-1]},[t])';
const newSplit6 = 'const b=t.split(/[\\/\\\\]/);return b[b.length-1]},[t])';
if (code.includes(oldSplit6)) {
  code = code.replace(oldSplit6, newSplit6);
  log('  [4f/6] Fixed file header display split');
}

// Pattern 7: Breadcrumb path - t.split("/").filter(Boolean).slice(-3)
const oldSplit7 = 'return t.split("/").filter(Boolean).slice(-3).join("/")';
const newSplit7 = 'return t.split(/[\\/\\\\]/).filter(Boolean).slice(-3).join("/")';
if (code.includes(oldSplit7)) {
  code = code.replace(oldSplit7, newSplit7);
  log('  [4g/6] Fixed breadcrumb path split');
}

// Pattern 8: Remaining path split in same function
const oldSplit8 = 'const v=b.split("/").filter(Boolean)';
const newSplit8 = 'const v=b.split(/[\\/\\\\]/).filter(Boolean)';
if (code.includes(oldSplit8)) {
  code = code.replace(oldSplit8, newSplit8);
  log('  [4h/6] Fixed remaining path split');
}

// ============================================================
// PATCH 5: Fix hardcoded "Claude" assistant name
// ============================================================
// Make chat message headers show model-appropriate name
// We can't easily make this dynamic without more context, so we make the
// "[Claude]" event prefix generic and leave "Claude" in the chat header
// (users will see which agent they're talking to from the agent name)

const oldEventPrefix = 'content:`[Claude] ${Q.eventType}`';
const newEventPrefix = 'content:`[Hook] ${Q.eventType}`';
if (code.includes(oldEventPrefix)) {
  code = code.replace(oldEventPrefix, newEventPrefix);
  log('  [5/6] Changed event prefix from [Claude] to [Hook]');
} else {
  log('  [5/6] WARNING: Could not find [Claude] event prefix');
}

// ============================================================
// PATCH 6: Add "Ollama" button to model logo selector
// ============================================================
// Find the Codex button end and insert an Ollama button after it

const codexButtonEnd = `children:[E.jsx("img",{src:jw,alt:"Codex",className:"w-4 h-4"}),E.jsx("span",{className:"text-sm text-dark-text-primary",children:"Codex"})]})`;

const ollamaButton = `,E.jsxs("button",{onClick:()=>p("ollama"),className:\`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-colors \${d==="ollama"?"bg-dark-hover border-[#a855f7]/50 ring-1 ring-[#a855f7]/30":"border-dark-border hover:bg-dark-hover"}\`,children:[E.jsx("img",{src:"${OLLAMA_LOGO}",alt:"Ollama",className:"w-5 h-5"}),E.jsx("span",{className:"text-sm text-dark-text-primary",children:"Ollama"})]})`;

if (code.includes(codexButtonEnd)) {
  // codexButtonEnd ends with ]}) — close children array, close props, close E.jsxs call
  // We append ollamaButton (starts with comma) as a sibling in the parent array
  code = code.replace(codexButtonEnd, codexButtonEnd + ollamaButton);
  log('  [6/6] Added Ollama button to model selector');
} else {
  log('  [6/6] WARNING: Could not find Codex button end pattern');
}

// ============================================================
// Write patched file
// ============================================================
fs.writeFileSync(rendererPath, code, 'utf-8');

const newLength = code.length;
log('');
log(`Patching complete. File size: ${originalLength} -> ${newLength} bytes (+${newLength - originalLength})`);

// Verify patches
const verifyCode = fs.readFileSync(rendererPath, 'utf-8');
const checks = [
  ['Ollama in PH logo map', 'PH={claude:zw,codex:jw,ollama:"data:image/svg'],
  ['Ollama in zY logo map', 'zY={claude:zw,codex:jw,ollama:"data:image/svg'],
  ['Alt text with Ollama (t.)', 'modelLogo==="ollama"?"Ollama":"Claude"'],
  ['Ctrl+L shortcut', '(k.metaKey||k.ctrlKey)&&k.key==="l"'],
  ['Ctrl+Backspace shortcut', '(U.metaKey||U.ctrlKey)&&U.key==="Backspace"'],
  ['Path split regex', 'split(/[\\/\\\\]/)'],
  ['Hook event prefix', '[Hook]'],
  ['Ollama model selector button', 'onClick:()=>p("ollama")'],
];

log('');
log('Verification:');
let allPass = true;
checks.forEach(([name, pattern]) => {
  const found = verifyCode.includes(pattern);
  if (!found) allPass = false;
  log(`  ${found ? 'PASS' : 'FAIL'} - ${name}`);
});

if (!allPass) {
  log('');
  log('WARNING: Some patches may not have applied correctly!');
}
