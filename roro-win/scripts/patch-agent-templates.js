/**
 * Smart agent templates patch for EveRo v1.0.92-win
 *
 * Replaces the single "+ New Agent" button with template buttons:
 *   - "+ Claude Agent" (terminal type, uses Claude Code)
 *   - "+ Ollama Agent" (ollama type, uses local Ollama model)
 *
 * Each button creates an agent with the correct type pre-configured,
 * so users don't have to manually switch model type in settings.
 *
 * Patches applied to renderer:
 * 1. Replace New Agent button with template buttons in sidebar (VH component)
 */

const fs = require('fs');
const path = require('path');

function log(msg) {
  console.log(`[patch-agent-templates] ${msg}`);
}

log('Applying smart agent templates patch...');

const rendererPath = path.resolve(__dirname, '../out/renderer/assets/index-BFJPEAID.js');
let code = fs.readFileSync(rendererPath, 'utf-8');
const origLen = code.length;

// The exact "New Agent" button block in VH sidebar component
// Located inside VH's render, where scope vars are:
//   t = agents array, s = projectId, i = projectPath, a = onRefreshAgents
//   se = existing click handler that creates a terminal agent
const oldButton = `E.jsx("div",{className:"px-3 py-2",children:E.jsxs("button",{onClick:se,className:"w-full flex items-center justify-center space-x-2 px-3 py-2 text-sm text-dark-text-tertiary opacity-60 hover:opacity-100 hover:text-dark-text-primary rounded-lg transition-all",children:[E.jsx("span",{className:"text-lg",children:"+"}),E.jsx("span",{children:"New Agent"})]})})`;

if (!code.includes(oldButton)) {
  log('  WARNING: Could not find "New Agent" button pattern');
  log('  Has "New Agent" text: ' + code.includes('"New Agent"'));
  log('  Has onClick:se: ' + code.includes('onClick:se'));
} else {
  // Agent ID computation (same logic as the original `se` handler):
  //   const ne=t.map(re=>{const Me=re.id.match(/-agent-(\d+)$/);return Me?parseInt(Me[1],10):0}).filter(re=>!isNaN(re));
  //   const F=(ne.length>0?Math.max(...ne):0)+1;
  //   const ee=`${s}-agent-${F}`;
  const agentIdLogic =
    `const ne=t.map(re=>{const Me=re.id.match(/-agent-(\\d+)$/);return Me?parseInt(Me[1],10):0}).filter(re=>!isNaN(re));` +
    `const F=(ne.length>0?Math.max(...ne):0)+1;` +
    'const ee=`${s}-agent-${F}`;';

  const newButtons = `E.jsx("div",{className:"px-3 py-2",children:E.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:"3px"},children:[` +
    // Claude Agent button (calls original se handler — creates terminal type)
    `E.jsxs("button",{onClick:se,style:{display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",width:"100%",padding:"6px 12px",borderRadius:"8px",border:"1px solid rgba(238,187,195,0.15)",background:"rgba(238,187,195,0.06)",cursor:"pointer",transition:"all 0.15s",fontSize:"12px",color:"#b8c1ec"},onMouseEnter:ev=>ev.currentTarget.style.background="rgba(238,187,195,0.12)",onMouseLeave:ev=>ev.currentTarget.style.background="rgba(238,187,195,0.06)",children:[` +
      `E.jsx("span",{style:{fontSize:"14px"},children:"+"}),` +
      `E.jsx("span",{children:"Claude Agent"}),` +
      `E.jsx("span",{style:{fontSize:"9px",padding:"1px 4px",borderRadius:"3px",background:"#eebbc3",color:"#232946",fontWeight:"600",marginLeft:"4px"},children:"API"})` +
    `]}),` +
    // Ollama Agent button (creates ollama type)
    `E.jsxs("button",{onClick:async()=>{try{${agentIdLogic}(await window.electronAPI.agent.createAgent(s,ee,i,"ollama")).success&&a?.()}catch(ex){}},style:{display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",width:"100%",padding:"6px 12px",borderRadius:"8px",border:"1px solid rgba(16,185,129,0.15)",background:"rgba(16,185,129,0.06)",cursor:"pointer",transition:"all 0.15s",fontSize:"12px",color:"#b8c1ec"},onMouseEnter:ev=>ev.currentTarget.style.background="rgba(16,185,129,0.12)",onMouseLeave:ev=>ev.currentTarget.style.background="rgba(16,185,129,0.06)",children:[` +
      `E.jsx("span",{style:{fontSize:"14px"},children:"+"}),` +
      `E.jsx("span",{children:"Ollama Agent"}),` +
      `E.jsx("span",{style:{fontSize:"9px",padding:"1px 4px",borderRadius:"3px",background:"#10b981",color:"#fffffe",fontWeight:"600",marginLeft:"4px"},children:"LOCAL"})` +
    `]})` +
  `]})})`;

  code = code.replace(oldButton, newButtons);
  log('  Replaced "New Agent" with template buttons');
}

fs.writeFileSync(rendererPath, code, 'utf-8');
log(`  Renderer: ${origLen} -> ${code.length} bytes`);

// Verification
log('');
log('Verification:');
const verify = fs.readFileSync(rendererPath, 'utf-8');
const checks = [
  ['Claude Agent template button', verify.includes('children:"Claude Agent"')],
  ['Ollama Agent template button', verify.includes('children:"Ollama Agent"')],
  ['API badge on Claude button', verify.includes('children:"API"')],
  ['LOCAL badge on Ollama button', verify.includes('children:"LOCAL"')],
  ['Ollama createAgent call', verify.includes('createAgent(s,ee,i,"ollama")')],
  ['Original se handler preserved', verify.includes('onClick:se')],
  ['No old "New Agent" text', !verify.includes('children:"New Agent"')],
];

let allPass = true;
checks.forEach(([name, ok]) => {
  if (!ok) allPass = false;
  log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}`);
});

if (allPass) {
  log('  All template checks passed!');
} else {
  log('  WARNING: Some checks failed!');
}
