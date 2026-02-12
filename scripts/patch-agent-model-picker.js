/**
 * Agent model picker patch for EveRo v1.0.92-win
 *
 * Adds a dropdown to select specific Ollama model when creating/editing an agent
 * with the "Ollama" model type selected.
 *
 * Patches applied to renderer:
 * 1. Inject model picker dropdown after Ollama button in agent settings panel
 */

const fs = require('fs');
const path = require('path');

function log(msg) {
  console.log(`[patch-model-picker] ${msg}`);
}

log('Applying agent model picker patch...');

const rendererPath = path.resolve(__dirname, '../out/renderer/assets/index-BFJPEAID.js');
let code = fs.readFileSync(rendererPath, 'utf-8');
const origLen = code.length;

// The Ollama button row ends with: children:"Ollama"})]})]}),
// After that comes: s?.hasSession&&E.jsx...
// We inject our model picker between these two

const insertAfter = 'children:"Ollama"})]})]}),';
const insertBefore = 's?.hasSession&&';

const searchPattern = insertAfter + insertBefore;

if (!code.includes(searchPattern)) {
  log('  WARNING: Could not find injection point (Ollama button + hasSession)');
  log('  Checking for components...');
  log('  Has Ollama button: ' + code.includes('children:"Ollama"})]})'));
  log('  Has s?.hasSession: ' + code.includes('s?.hasSession'));
} else {
  // Inject a model picker component
  // When d (modelLogo state) === "ollama", show a select dropdown
  // The dropdown fetches models from window.electronAPI.ollama.listModels()
  // Uses the GY component's local state - we add a new state variable via IIFE
  //
  // Since we can't easily add React state to the existing component,
  // we inject a self-contained sub-component that manages its own state

  const modelPicker = insertAfter +
    `d==="ollama"&&E.jsx((function(){` +
      `const[models,setModels]=$.useState([]);` +
      `const[selected,setSelected]=$.useState("");` +
      `const[loading,setLoading]=$.useState(true);` +
      `$.useEffect(()=>{` +
        `(async()=>{` +
          `try{` +
            `const r=await window.electronAPI.ollama.listModels();` +
            `if(r&&r.success&&r.models){` +
              `setModels(r.models);` +
              `if(r.models.length>0&&!selected)setSelected(r.models[0].name)` +
            `}` +
          `}catch(e){}` +
          `setLoading(false)` +
        `})()` +
      `},[]);` +
      `$.useEffect(()=>{` +
        `if(selected&&s){` +
          `try{window.electronAPI.agent.updateMetadata(t,e,{ollamaModel:selected}).catch(()=>{})}catch(e){}` +
        `}` +
      `},[selected]);` +
      `return E.jsx("div",{style:{padding:"8px 0"},children:` +
        `loading?E.jsx("div",{style:{color:"#8892b8",fontSize:"12px",padding:"4px 0"},children:"Loading models..."}):` +
        `models.length===0?E.jsx("div",{style:{color:"#ef4444",fontSize:"12px",padding:"4px 0"},children:"No Ollama models found. Install Ollama and pull a model."}):` +
        `E.jsxs("div",{children:[` +
          `E.jsx("label",{style:{color:"#b8c1ec",fontSize:"12px",display:"block",marginBottom:"4px"},children:"Ollama Model"}),` +
          `E.jsx("select",{value:selected,onChange:ev=>setSelected(ev.target.value),style:{width:"100%",padding:"6px 10px",borderRadius:"6px",border:"1px solid #2a3157",background:"#1a1f3d",color:"#fffffe",fontSize:"13px",outline:"none",cursor:"pointer"},children:` +
            `models.map(m=>E.jsx("option",{key:m.name,value:m.name,children:m.name+(m.details?" ("+m.details.parameter_size+")":"")},m.name))` +
          `})` +
        `]})` +
      `})` +
    `})(),{}),` +
    insertBefore;

  code = code.replace(searchPattern, modelPicker);
  log('  Injected model picker dropdown after Ollama button');
}

fs.writeFileSync(rendererPath, code, 'utf-8');
log(`  Renderer: ${origLen} -> ${code.length} bytes`);

// Verification
log('');
log('Verification:');
const verify = fs.readFileSync(rendererPath, 'utf-8');
const checks = [
  ['Model picker component exists', verify.includes('ollamaModel:selected')],
  ['Model list fetch', verify.includes('ollama.listModels()')],
  ['Select dropdown', verify.includes('onChange:ev=>setSelected(ev.target.value)')],
  ['Loading state', verify.includes('Loading models...')],
  ['No models fallback', verify.includes('No Ollama models found')],
  ['Model label', verify.includes('Ollama Model')],
];

let allPass = true;
checks.forEach(([name, ok]) => {
  if (!ok) allPass = false;
  log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}`);
});

if (allPass) {
  log('  All model picker checks passed!');
} else {
  log('  WARNING: Some checks failed!');
}
