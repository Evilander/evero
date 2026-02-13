/**
 * Model Hub patch for EveRo v1.0.92-win
 *
 * Replaces the "Coming soon" placeholder in the Tools tab with a live
 * Model Hub dashboard for managing Ollama models.
 *
 * Patches applied:
 * 1. Preload: Add ollama bridge methods to electronAPI
 * 2. Main process: Add ollama:show-model, ollama:delete-model, ollama:running-models IPC handlers
 * 3. Renderer: Replace "Coming soon" with Model Hub component
 */

const fs = require('fs');
const path = require('path');

function log(msg) {
  console.log(`[patch-model-hub] ${msg}`);
}

log('Applying Model Hub patches...');

// ============================================================
// PART 1: PRELOAD - Add ollama bridge methods
// ============================================================

const preloadPath = path.resolve(__dirname, '../out/preload/index.js');
let preload = fs.readFileSync(preloadPath, 'utf-8');
const preloadOrigLen = preload.length;

// Add ollama namespace to electronAPI, before the closing });
// Find the last method group (channel:) and add after it
const channelEnd = 'unlinkAgent:(e,r,t)=>n.ipcRenderer.invoke("channel:unlinkAgent",e,r,t)}});';

if (preload.includes(channelEnd)) {
  const ollamaBridge = `unlinkAgent:(e,r,t)=>n.ipcRenderer.invoke("channel:unlinkAgent",e,r,t)},ollama:{checkStatus:()=>n.ipcRenderer.invoke("ollama:check-status"),listModels:()=>n.ipcRenderer.invoke("ollama:list-models"),showModel:e=>n.ipcRenderer.invoke("ollama:show-model",e),setModel:(e,r)=>n.ipcRenderer.invoke("ollama:set-model",e,r),pullModel:e=>n.ipcRenderer.invoke("ollama:pull-model",e),deleteModel:e=>n.ipcRenderer.invoke("ollama:delete-model",e),runningModels:()=>n.ipcRenderer.invoke("ollama:running-models")},launchConfig:{set:e=>n.ipcRenderer.invoke("launch-config:set",e),get:()=>n.ipcRenderer.invoke("launch-config:get"),getDefaults:()=>n.ipcRenderer.invoke("launch-config:get-defaults")}});`;
  preload = preload.replace(channelEnd, ollamaBridge);
  log('  [1/3] Added ollama + launchConfig bridge to preload');
} else {
  log('  [1/3] WARNING: Could not find channel bridge end pattern');
}

fs.writeFileSync(preloadPath, preload, 'utf-8');
log(`  Preload: ${preloadOrigLen} -> ${preload.length} bytes`);

// ============================================================
// PART 2: MAIN PROCESS - Add new IPC handlers
// ============================================================

const mainJsPath = path.resolve(__dirname, '../out/main/index.js');
let mainCode = fs.readFileSync(mainJsPath, 'utf-8');
const mainOrigLen = mainCode.length;

// Add ollama:show-model, ollama:delete-model, ollama:running-models
// Insert before shell:openExternal (which is where we already insert ollama handlers)
const shellHandler = 'c.ipcMain.handle("shell:openExternal"';
const shellIdx = mainCode.indexOf(shellHandler);

if (shellIdx === -1) {
  log('  [2/3] WARNING: Could not find shell:openExternal handler');
} else {
  const newHandlers = `c.ipcMain.handle("ollama:show-model",async(ev,modelName)=>{try{const http=require("http");return new Promise((resolve,reject)=>{const body=JSON.stringify({name:modelName});const req=http.request({hostname:"localhost",port:11434,path:"/api/show",method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)}},res=>{let data="";res.on("data",chunk=>data+=chunk);res.on("end",()=>{try{resolve({success:true,model:JSON.parse(data)})}catch(e){resolve({success:false,error:"Invalid response"})}})});req.on("error",e=>resolve({success:false,error:e.message}));req.write(body);req.end()})}catch(e){return{success:false,error:e.message}}}),c.ipcMain.handle("ollama:delete-model",async(ev,modelName)=>{try{const http=require("http");return new Promise((resolve)=>{const body=JSON.stringify({name:modelName});const req=http.request({hostname:"localhost",port:11434,path:"/api/delete",method:"DELETE",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)}},res=>{let data="";res.on("data",chunk=>data+=chunk);res.on("end",()=>resolve({success:res.statusCode===200}))});req.on("error",e=>resolve({success:false,error:e.message}));req.write(body);req.end()})}catch(e){return{success:false,error:e.message}}}),c.ipcMain.handle("ollama:running-models",async()=>{try{const http=require("http");return new Promise((resolve)=>{const req=http.request({hostname:"localhost",port:11434,path:"/api/ps",method:"GET"},res=>{let data="";res.on("data",chunk=>data+=chunk);res.on("end",()=>{try{resolve({success:true,models:JSON.parse(data).models||[]})}catch(e){resolve({success:true,models:[]})}})});req.on("error",e=>resolve({success:false,error:e.message}));req.end()})}catch(e){return{success:false,error:e.message}}}),`;

  mainCode = mainCode.substring(0, shellIdx) + newHandlers + mainCode.substring(shellIdx);
  log('  [2/3] Added ollama:show-model, ollama:delete-model, ollama:running-models IPC handlers');
}

fs.writeFileSync(mainJsPath, mainCode, 'utf-8');
log(`  Main: ${mainOrigLen} -> ${mainCode.length} bytes`);

// ============================================================
// PART 3: RENDERER - Replace "Coming soon" with Model Hub
// ============================================================

const rendererPath = path.resolve(__dirname, '../out/renderer/assets/index-BFJPEAID.js');
let renderCode = fs.readFileSync(rendererPath, 'utf-8');
const renderOrigLen = renderCode.length;

// The exact pattern to replace - the "dms" case with "Coming soon"
const oldDms = `case"dms":return E.jsx("div",{className:"flex-1 flex items-center justify-center bg-dark-surface",children:E.jsxs("div",{className:"text-center",children:[E.jsx("h2",{className:"text-dark-text-primary text-2xl font-semibold mb-2",children:"md"}),E.jsx("p",{className:"text-dark-text-secondary",children:"Coming soon"})]})})`;

if (!renderCode.includes(oldDms)) {
  log('  [3/3] WARNING: Could not find "Coming soon" placeholder pattern');
} else {
  // Build the Model Hub component as a self-contained inline React component
  // Uses window.electronAPI.ollama.* for IPC calls
  // Renders: status indicator, installed models list, pull input, featured models
  const modelHub = `case"dms":return E.jsx(function(){` +
    `const[S,setS]=$.useState(null);` +  // status
    `const[M,setM]=$.useState([]);` +  // models
    `const[R,setR]=$.useState([]);` +  // running models
    `const[P,setP]=$.useState("");` +  // pull input
    `const[L,setL]=$.useState(false);` +  // loading
    `const[D,setD]=$.useState(null);` +  // detail model
    `const[Pm,setPm]=$.useState("");` +  // pull message
    `const refresh=$.useCallback(async()=>{` +
      `setL(true);` +
      `try{` +
        `const st=await window.electronAPI.ollama.checkStatus();` +
        `setS(st);` +
        `if(st&&st.success){` +
          `const ml=await window.electronAPI.ollama.listModels();` +
          `if(ml&&ml.success)setM(ml.models||[]);` +
          `const rm=await window.electronAPI.ollama.runningModels();` +
          `if(rm&&rm.success)setR(rm.models||[]);` +
        `}` +
      `}catch(e){setS({success:false,error:e.message})}` +
      `setL(false);` +
    `},[]);` +
    `$.useEffect(()=>{refresh()},[refresh]);` +
    `const handlePull=async()=>{` +
      `if(!P.trim())return;` +
      `setPm("Pulling "+P.trim()+"...");` +
      `try{` +
        `const r=await window.electronAPI.ollama.pullModel(P.trim());` +
        `setPm(r&&r.success?"Done! Refreshing...":"Error: "+(r&&r.error||"unknown"));` +
        `if(r&&r.success){setTimeout(()=>{refresh();setPm("");setP("")},1000)}` +
        `else{setTimeout(()=>setPm(""),3000)}` +
      `}catch(e){setPm("Error: "+e.message);setTimeout(()=>setPm(""),3000)}` +
    `};` +
    `const handleDelete=async(name)=>{` +
      `if(!confirm("Delete model "+name+"?"))return;` +
      `await window.electronAPI.ollama.deleteModel(name);` +
      `refresh()` +
    `};` +
    `const handleShowDetail=async(name)=>{` +
      `const r=await window.electronAPI.ollama.showModel(name);` +
      `if(r&&r.success)setD({name,...r.model});` +
    `};` +
    `const fmtSize=(b)=>{if(!b)return"?";const gb=b/1e9;return gb>=1?gb.toFixed(1)+"GB":(b/1e6).toFixed(0)+"MB"};` +
    `const capColors={completion:"#8892b8",vision:"#10b981",tools:"#f59e0b",thinking:"#eebbc3",embedding:"#b8c1ec"};` +
    `const featured=[{name:"kimi-k2.5",desc:"Vision + Tools + Thinking",pulls:"59K"},{name:"glm-5",desc:"744B MoE, 40B active",pulls:"7.5K"},{name:"qwen3-coder-next",desc:"Coding specialist",pulls:"67K"},{name:"deepseek-r1",desc:"Chain-of-thought reasoning",pulls:"78M"}];` +
    `return E.jsx("div",{className:"flex-1 flex flex-col bg-dark-surface overflow-y-auto",style:{padding:"24px"},children:E.jsxs("div",{style:{maxWidth:"800px",width:"100%",margin:"0 auto"},children:[` +
      // Header
      `E.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"},children:[` +
        `E.jsx("h2",{style:{fontSize:"20px",fontWeight:"600",color:"#fffffe",margin:0},children:"Model Hub"}),` +
        `E.jsx("button",{onClick:refresh,disabled:L,style:{padding:"6px 14px",borderRadius:"6px",border:"1px solid #2a3157",background:"#1e2440",color:"#b8c1ec",cursor:"pointer",fontSize:"13px"},children:L?"Loading...":"Refresh"})` +
      `]}),` +
      // Status bar
      `E.jsx("div",{style:{padding:"12px 16px",borderRadius:"8px",background:"#1a1f3d",border:"1px solid #1e2440",marginBottom:"16px"},children:E.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"8px"},children:[` +
        `E.jsx("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:S&&S.success?"#10b981":"#ef4444",display:"inline-block"}}),` +
        `E.jsx("span",{style:{color:"#b8c1ec",fontSize:"13px"},children:S&&S.success?"Ollama Connected (localhost:11434)":"Ollama Not Connected"}),` +
        `R.length>0&&E.jsx("span",{style:{color:"#8892b8",fontSize:"12px",marginLeft:"auto"},children:"Running: "+R.map(m=>m.name).join(", ")})` +
      `]})` +
    `}),` +
      // Installed Models
      `E.jsxs("div",{style:{marginBottom:"20px"},children:[` +
        `E.jsx("h3",{style:{fontSize:"14px",fontWeight:"500",color:"#b8c1ec",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.05em"},children:"Installed Models"}),` +
        `M.length===0?E.jsx("div",{style:{padding:"20px",textAlign:"center",color:"#8892b8",fontSize:"13px"},children:S&&S.success?"No models installed. Pull one below!":"Connect to Ollama to see models"}):` +
        `E.jsx("div",{style:{display:"flex",flexDirection:"column",gap:"4px"},children:M.map(m=>` +
          `E.jsxs("div",{key:m.name,style:{display:"flex",alignItems:"center",padding:"10px 14px",borderRadius:"6px",background:"#1a1f3d",border:"1px solid #1e2440",cursor:"pointer",transition:"background 0.15s"},onClick:()=>handleShowDetail(m.name),onMouseEnter:e=>e.currentTarget.style.background="#252c55",onMouseLeave:e=>e.currentTarget.style.background="#1a1f3d",children:[` +
            `E.jsxs("div",{style:{flex:1},children:[` +
              `E.jsx("span",{style:{color:"#fffffe",fontSize:"14px",fontWeight:"500"},children:m.name}),` +
              `E.jsx("span",{style:{color:"#8892b8",fontSize:"12px",marginLeft:"8px"},children:m.details?m.details.parameter_size||"":""}),` +
              `E.jsx("span",{style:{color:"#6b7ead",fontSize:"12px",marginLeft:"8px"},children:fmtSize(m.size)})` +
            `]}),` +
            `m.details&&m.details.quantization_level?E.jsx("span",{style:{color:"#6b7ead",fontSize:"11px",marginRight:"12px",padding:"2px 6px",borderRadius:"3px",background:"#1e2440"},children:m.details.quantization_level}):null,` +
            `E.jsx("button",{onClick:e=>{e.stopPropagation();handleDelete(m.name)},style:{color:"#8892b8",background:"none",border:"none",cursor:"pointer",fontSize:"16px",padding:"4px 8px",borderRadius:"4px"},title:"Delete model",children:"\\u00d7"})` +
          `]})` +
        `)})` +
      `]}),` +
      // Detail Panel
      `D&&E.jsxs("div",{style:{marginBottom:"20px",padding:"16px",borderRadius:"8px",background:"#1a1f3d",border:"1px solid #1e2440"},children:[` +
        `E.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"},children:[` +
          `E.jsx("h3",{style:{fontSize:"16px",fontWeight:"600",color:"#fffffe",margin:0},children:D.name}),` +
          `E.jsx("button",{onClick:()=>setD(null),style:{color:"#8892b8",background:"none",border:"none",cursor:"pointer",fontSize:"18px"},children:"\\u00d7"})` +
        `]}),` +
        `D.details&&E.jsxs("div",{style:{display:"flex",gap:"16px",flexWrap:"wrap",marginBottom:"12px"},children:[` +
          `D.details.parameter_size&&E.jsxs("div",{style:{color:"#b8c1ec",fontSize:"12px"},children:["Params: ",D.details.parameter_size]}),` +
          `D.details.quantization_level&&E.jsxs("div",{style:{color:"#b8c1ec",fontSize:"12px"},children:["Quant: ",D.details.quantization_level]}),` +
          `D.details.family&&E.jsxs("div",{style:{color:"#b8c1ec",fontSize:"12px"},children:["Family: ",D.details.family]})` +
        `]}),` +
        `D.capabilities&&E.jsx("div",{style:{display:"flex",gap:"6px",flexWrap:"wrap"},children:D.capabilities.map(cap=>` +
          `E.jsx("span",{key:cap,style:{padding:"2px 8px",borderRadius:"10px",fontSize:"11px",fontWeight:"500",color:"#fff",background:capColors[cap]||"#8892b8"},children:cap})` +
        `)})` +
      `]}),` +
      // Pull Model
      `E.jsxs("div",{style:{marginBottom:"20px"},children:[` +
        `E.jsx("h3",{style:{fontSize:"14px",fontWeight:"500",color:"#b8c1ec",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.05em"},children:"Pull New Model"}),` +
        `E.jsxs("div",{style:{display:"flex",gap:"8px"},children:[` +
          `E.jsx("input",{value:P,onChange:e=>setP(e.target.value),onKeyDown:e=>e.key==="Enter"&&handlePull(),placeholder:"e.g. kimi-k2.5, glm-5, deepseek-r1",style:{flex:1,padding:"8px 12px",borderRadius:"6px",border:"1px solid #2a3157",background:"#1a1f3d",color:"#fffffe",fontSize:"13px",outline:"none"}}),` +
          `E.jsx("button",{onClick:handlePull,disabled:!P.trim()||!!Pm,style:{padding:"8px 16px",borderRadius:"6px",background:"#eebbc3",color:"#232946",border:"none",cursor:P.trim()&&!Pm?"pointer":"not-allowed",fontSize:"13px",opacity:P.trim()&&!Pm?1:0.5},children:"Pull"})` +
        `]}),` +
        `Pm&&E.jsx("div",{style:{marginTop:"8px",color:"#b8c1ec",fontSize:"12px"},children:Pm})` +
      `]}),` +
      // Featured Models
      `E.jsxs("div",{children:[` +
        `E.jsx("h3",{style:{fontSize:"14px",fontWeight:"500",color:"#b8c1ec",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.05em"},children:"Featured Models"}),` +
        `E.jsx("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:"8px"},children:featured.map(f=>` +
          `E.jsxs("div",{key:f.name,onClick:()=>{setP(f.name)},style:{padding:"12px",borderRadius:"8px",background:"#1a1f3d",border:"1px solid #1e2440",cursor:"pointer",transition:"border-color 0.15s"},onMouseEnter:e=>e.currentTarget.style.borderColor="#eebbc3",onMouseLeave:e=>e.currentTarget.style.borderColor="#1e2440",children:[` +
            `E.jsx("div",{style:{fontSize:"14px",fontWeight:"500",color:"#fffffe",marginBottom:"4px"},children:f.name}),` +
            `E.jsx("div",{style:{fontSize:"11px",color:"#8892b8",marginBottom:"4px"},children:f.desc}),` +
            `E.jsxs("div",{style:{fontSize:"11px",color:"#6b7ead"},children:[f.pulls," pulls"]})` +
          `]})` +
        `)})` +
      `]})` +
    `]})})` +
  `},{})`;

  renderCode = renderCode.replace(oldDms, modelHub);
  log('  [3/3] Replaced "Coming soon" with Model Hub component');
}

fs.writeFileSync(rendererPath, renderCode, 'utf-8');
log(`  Renderer: ${renderOrigLen} -> ${renderCode.length} bytes`);

// ============================================================
// VERIFICATION
// ============================================================

log('');
log('Verification:');

const vPreload = fs.readFileSync(preloadPath, 'utf-8');
const vMain = fs.readFileSync(mainJsPath, 'utf-8');
const vRender = fs.readFileSync(rendererPath, 'utf-8');

const checks = [
  ['Preload: ollama.checkStatus bridge', vPreload.includes('ollama:{checkStatus')],
  ['Preload: ollama.showModel bridge', vPreload.includes('showModel:')],
  ['Preload: ollama.deleteModel bridge', vPreload.includes('deleteModel:')],
  ['Preload: ollama.runningModels bridge', vPreload.includes('runningModels:')],
  ['Preload: launchConfig bridge', vPreload.includes('launchConfig:{')],
  ['Main: ollama:show-model handler', vMain.includes('ollama:show-model')],
  ['Main: ollama:delete-model handler', vMain.includes('ollama:delete-model')],
  ['Main: ollama:running-models handler', vMain.includes('ollama:running-models')],
  ['Main: /api/show endpoint', vMain.includes('/api/show')],
  ['Main: /api/delete endpoint', vMain.includes('/api/delete')],
  ['Main: /api/ps endpoint', vMain.includes('/api/ps')],
  ['Renderer: Model Hub component', vRender.includes('Model Hub')],
  ['Renderer: Featured Models section', vRender.includes('Featured Models')],
  ['Renderer: Pull New Model section', vRender.includes('Pull New Model')],
  ['Renderer: Installed Models section', vRender.includes('Installed Models')],
  ['Renderer: No "Coming soon"', !vRender.includes('Coming soon')],
  ['Renderer: kimi-k2.5 featured', vRender.includes('kimi-k2.5')],
  ['Renderer: capabilities colors', vRender.includes('capColors')],
];

let allPass = true;
checks.forEach(([name, ok]) => {
  if (!ok) allPass = false;
  log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}`);
});

log('');
if (allPass) {
  log('All Model Hub checks passed!');
} else {
  log('WARNING: Some checks failed!');
}
