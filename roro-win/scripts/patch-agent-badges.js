/**
 * Agent capability badges patch for EveRo v1.0.92-win
 *
 * Adds small visual capability badges to agent cards in the Team sidebar.
 * Badges show at a glance what each agent can do:
 *
 *   Claude agents:  [THINK] [CODE] [TOOLS]
 *   Codex agents:   [CODE]
 *   Ollama agents:  [LOCAL] (+ model name if stored in metadata)
 *
 * Patches applied to renderer:
 * 1. Inject badge elements after model logo in agent card component (s6)
 */

const fs = require('fs');
const path = require('path');

function log(msg) {
  console.log(`[patch-agent-badges] ${msg}`);
}

log('Applying agent capability badges patch...');

const rendererPath = path.resolve(__dirname, '../out/renderer/assets/index-BFJPEAID.js');
let code = fs.readFileSync(rendererPath, 'utf-8');
const origLen = code.length;

// The s6 agent card component has this structure:
//   E.jsxs("div", { className:"flex-1 min-w-0 flex items-center space-x-2", children:[
//     E.jsx("div", { ... children: t.name }),        // agent name
//     E.jsx("img", { src:PH[...], ... className: ... "w-5 h-4 flex-shrink-0" })  // model logo
//   ]}),
//   t.isAwaitingUserOption&&E.jsx("div", ...)         // status indicators
//
// We inject badges between the flex container closing (]}),) and the status indicators

const searchPattern = 'flex-shrink-0"})]}),t.isAwaitingUserOption';

if (!code.includes(searchPattern)) {
  log('  WARNING: Could not find agent card injection point');
  log('  Has flex-shrink-0: ' + code.includes('flex-shrink-0"})'));
  log('  Has isAwaitingUserOption: ' + code.includes('t.isAwaitingUserOption'));
} else {
  // Badge styles - tiny pills that don't take up much sidebar space
  // Using EveRo palette colors
  const badgeBase = 'display:"inline-block",padding:"1px 4px",borderRadius:"3px",fontSize:"8px",fontWeight:"600",letterSpacing:"0.03em",lineHeight:"12px",flexShrink:0';

  const badges = `flex-shrink-0"})]}),` +
    // Badge container - only show on non-mobile widths, uses flex with tiny gap
    `E.jsx("div",{style:{display:"flex",gap:"2px",flexShrink:0,marginLeft:"auto"},children:` +
      // Claude badges: THINK + CODE + TOOLS
      `t.modelLogo==="claude"||!t.modelLogo?E.jsxs(E.Fragment,{children:[` +
        `E.jsx("span",{style:{${badgeBase},background:"#eebbc3",color:"#232946"},children:"THINK"}),` +
        `E.jsx("span",{style:{${badgeBase},background:"#b8c1ec",color:"#232946"},children:"CODE"}),` +
        `E.jsx("span",{style:{${badgeBase},background:"#8892b8",color:"#fffffe"},children:"TOOLS"})` +
      `]}):` +
      // Codex badges: CODE
      `t.modelLogo==="codex"?E.jsx("span",{style:{${badgeBase},background:"#b8c1ec",color:"#232946"},children:"CODE"}):` +
      // Ollama badges: LOCAL
      `t.modelLogo==="ollama"?E.jsx("span",{style:{${badgeBase},background:"#10b981",color:"#fffffe"},children:"LOCAL"}):` +
      // Unknown: nothing
      `null` +
    `}),` +
    `t.isAwaitingUserOption`;

  code = code.replace(searchPattern, badges);
  log('  Injected capability badges into agent card');
}

fs.writeFileSync(rendererPath, code, 'utf-8');
log(`  Renderer: ${origLen} -> ${code.length} bytes`);

// Verification
log('');
log('Verification:');
const verify = fs.readFileSync(rendererPath, 'utf-8');
const checks = [
  ['THINK badge exists', verify.includes('children:"THINK"')],
  ['CODE badge exists', verify.includes('children:"CODE"')],
  ['TOOLS badge exists', verify.includes('children:"TOOLS"')],
  ['LOCAL badge exists', verify.includes('children:"LOCAL"')],
  ['Badge container flex', verify.includes('gap:"2px",flexShrink:0')],
  ['Claude badge conditional', verify.includes('modelLogo==="claude"')],
  ['Ollama badge conditional', verify.includes('modelLogo==="ollama"?E.jsx("span"')],
];

let allPass = true;
checks.forEach(([name, ok]) => {
  if (!ok) allPass = false;
  log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}`);
});

if (allPass) {
  log('  All badge checks passed!');
} else {
  log('  WARNING: Some checks failed!');
}
