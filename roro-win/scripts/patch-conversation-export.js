/**
 * Conversation export patch for EveRo v1.0.92-win
 *
 * Adds an "Export" button to the chat header toolbar that downloads
 * the current conversation as a Markdown file.
 *
 * Patches applied to renderer:
 * 1. Add export button to WY chat header (right side of justify-between container)
 *
 * Also patches preload + main process:
 * 2. Preload: Add conversation.export bridge method
 * 3. Main: Add conversation:export IPC handler (save dialog + file write)
 */

const fs = require('fs');
const path = require('path');

function log(msg) {
  console.log(`[patch-conv-export] ${msg}`);
}

log('Applying conversation export patch...');

// ============================================================
// PART 1: MAIN PROCESS - Add save dialog IPC handler
// ============================================================

const mainJsPath = path.resolve(__dirname, '../out/main/index.js');
let mainCode = fs.readFileSync(mainJsPath, 'utf-8');
const mainOrigLen = mainCode.length;

// Insert before shell:openExternal handler
const shellHandler = 'c.ipcMain.handle("shell:openExternal"';
const shellIdx = mainCode.indexOf(shellHandler);

if (shellIdx === -1) {
  log('  [1/3] WARNING: Could not find shell:openExternal handler');
} else {
  const exportHandler =
    `c.ipcMain.handle("conversation:export",async(ev,content,defaultName)=>{` +
      `try{` +
        `const{dialog:dlg}=require("electron");` +
        `const result=await dlg.showSaveDialog({` +
          `title:"Export Conversation",` +
          `defaultPath:defaultName||"conversation.md",` +
          `filters:[{name:"Markdown",extensions:["md"]},{name:"JSON",extensions:["json"]},{name:"Text",extensions:["txt"]}]` +
        `});` +
        `if(!result.canceled&&result.filePath){` +
          `require("fs").writeFileSync(result.filePath,content,"utf-8");` +
          `return{success:true,path:result.filePath}` +
        `}` +
        `return{success:false,canceled:true}` +
      `}catch(e){return{success:false,error:e.message}}` +
    `}),`;

  mainCode = mainCode.substring(0, shellIdx) + exportHandler + mainCode.substring(shellIdx);
  log('  [1/3] Added conversation:export IPC handler with save dialog');
}

fs.writeFileSync(mainJsPath, mainCode, 'utf-8');
log(`  Main: ${mainOrigLen} -> ${mainCode.length} bytes`);

// ============================================================
// PART 2: PRELOAD - Add conversation export bridge
// ============================================================

const preloadPath = path.resolve(__dirname, '../out/preload/index.js');
let preload = fs.readFileSync(preloadPath, 'utf-8');
const preloadOrigLen = preload.length;

// Add conversation namespace before the closing });
// Find the launchConfig section (added by model-hub patch) and add after it
const lcEnd = 'getDefaults:()=>n.ipcRenderer.invoke("launch-config:get-defaults")}});';

if (preload.includes(lcEnd)) {
  const convBridge = `getDefaults:()=>n.ipcRenderer.invoke("launch-config:get-defaults")},conversation:{export:(content,name)=>n.ipcRenderer.invoke("conversation:export",content,name)}});`;
  preload = preload.replace(lcEnd, convBridge);
  log('  [2/3] Added conversation.export bridge to preload');
} else {
  log('  [2/3] WARNING: Could not find launchConfig end pattern');
}

fs.writeFileSync(preloadPath, preload, 'utf-8');
log(`  Preload: ${preloadOrigLen} -> ${preload.length} bytes`);

// ============================================================
// PART 3: RENDERER - Add export button to chat header
// ============================================================

const rendererPath = path.resolve(__dirname, '../out/renderer/assets/index-BFJPEAID.js');
let renderCode = fs.readFileSync(rendererPath, 'utf-8');
const renderOrigLen = renderCode.length;

// The WY chat component's 60px header:
// E.jsx("div",{className:"flex items-center justify-between px-4 py-3 bg-dark-surface h-[60px]",
//   children:E.jsx("div",{className:"flex items-center space-x-4 ",
//     children:E.jsx(jY,{projectId:t,agentId:e,isLoading:h,onOpenSettings:()=>r?.(),refreshTrigger:s})
//   })
// })
//
// We change E.jsx → E.jsxs and add an export button as the second child

const oldHeader =
  `E.jsx("div",{className:"flex items-center justify-between px-4 py-3 bg-dark-surface h-[60px]",` +
  `children:E.jsx("div",{className:"flex items-center space-x-4 ",` +
  `children:E.jsx(jY,{projectId:t,agentId:e,isLoading:h,onOpenSettings:()=>r?.(),refreshTrigger:s})})})`;

if (!renderCode.includes(oldHeader)) {
  log('  [3/3] WARNING: Could not find chat header pattern');
  log('  Has h-[60px]: ' + renderCode.includes('h-[60px]'));
  log('  Has jY: ' + renderCode.includes('jY,{projectId'));
} else {
  // Export button with dropdown for Markdown/JSON/Copy
  const exportBtn =
    `E.jsx(function(){` +
      `const[showMenu,setMenu]=$.useState(false);` +
      `const doExport=(fmt)=>{` +
        `setMenu(false);` +
        `if(o.length===0)return;` +
        `const date=new Date().toISOString().slice(0,10);` +
        `if(fmt==="md"){` +
          `const md="# Conversation Export\\n\\nDate: "+date+"\\n\\n---\\n\\n"+` +
            `o.map(V=>"## "+(V.role==="user"?"You":"Assistant")+"\\n\\n"+V.content+"\\n").join("\\n---\\n\\n");` +
          `window.electronAPI.conversation.export(md,"conversation-"+date+".md")` +
        `}else if(fmt==="json"){` +
          `const json=JSON.stringify({exported:date,messages:o.map(V=>({role:V.role,content:V.content}))},null,2);` +
          `window.electronAPI.conversation.export(json,"conversation-"+date+".json")` +
        `}else if(fmt==="copy"){` +
          `const text=o.map(V=>(V.role==="user"?"You":"Assistant")+": "+V.content).join("\\n\\n");` +
          `navigator.clipboard.writeText(text)` +
        `}` +
      `};` +
      `return E.jsxs("div",{style:{position:"relative"},children:[` +
        `E.jsx("button",{onClick:()=>setMenu(!showMenu),style:{padding:"4px 10px",borderRadius:"6px",border:"1px solid #2a3157",background:"#1e2440",color:"#b8c1ec",cursor:o.length>0?"pointer":"default",fontSize:"12px",opacity:o.length>0?1:0.4},disabled:o.length===0,title:"Export conversation",children:"Export"}),` +
        `showMenu&&E.jsxs("div",{style:{position:"absolute",right:0,top:"100%",marginTop:"4px",background:"#1e2440",border:"1px solid #2a3157",borderRadius:"8px",padding:"4px",minWidth:"160px",zIndex:100,boxShadow:"0 8px 24px rgba(18,22,41,0.6)"},children:[` +
          `E.jsx("button",{onClick:()=>doExport("md"),style:{display:"block",width:"100%",textAlign:"left",padding:"6px 10px",borderRadius:"4px",border:"none",background:"transparent",color:"#fffffe",cursor:"pointer",fontSize:"12px"},onMouseEnter:ev=>ev.currentTarget.style.background="#2a3157",onMouseLeave:ev=>ev.currentTarget.style.background="transparent",children:"Save as Markdown"}),` +
          `E.jsx("button",{onClick:()=>doExport("json"),style:{display:"block",width:"100%",textAlign:"left",padding:"6px 10px",borderRadius:"4px",border:"none",background:"transparent",color:"#fffffe",cursor:"pointer",fontSize:"12px"},onMouseEnter:ev=>ev.currentTarget.style.background="#2a3157",onMouseLeave:ev=>ev.currentTarget.style.background="transparent",children:"Save as JSON"}),` +
          `E.jsx("div",{style:{height:"1px",background:"#2a3157",margin:"2px 0"}}),` +
          `E.jsx("button",{onClick:()=>doExport("copy"),style:{display:"block",width:"100%",textAlign:"left",padding:"6px 10px",borderRadius:"4px",border:"none",background:"transparent",color:"#fffffe",cursor:"pointer",fontSize:"12px"},onMouseEnter:ev=>ev.currentTarget.style.background="#2a3157",onMouseLeave:ev=>ev.currentTarget.style.background="transparent",children:"Copy to Clipboard"})` +
        `]})` +
      `]})` +
    `},{})`;

  const newHeader =
    `E.jsxs("div",{className:"flex items-center justify-between px-4 py-3 bg-dark-surface h-[60px]",` +
    `children:[E.jsx("div",{className:"flex items-center space-x-4 ",` +
    `children:E.jsx(jY,{projectId:t,agentId:e,isLoading:h,onOpenSettings:()=>r?.(),refreshTrigger:s})}),` +
    exportBtn + `]})`;

  renderCode = renderCode.replace(oldHeader, newHeader);
  log('  [3/3] Added export button with dropdown to chat header');
}

fs.writeFileSync(rendererPath, renderCode, 'utf-8');
log(`  Renderer: ${renderOrigLen} -> ${renderCode.length} bytes`);

// ============================================================
// VERIFICATION
// ============================================================

log('');
log('Verification:');

const vMain = fs.readFileSync(mainJsPath, 'utf-8');
const vPreload = fs.readFileSync(preloadPath, 'utf-8');
const vRender = fs.readFileSync(rendererPath, 'utf-8');

const checks = [
  ['Main: conversation:export handler', vMain.includes('conversation:export')],
  ['Main: showSaveDialog', vMain.includes('showSaveDialog')],
  ['Main: Markdown filter', vMain.includes('Markdown')],
  ['Preload: conversation.export bridge', vPreload.includes('conversation:{export')],
  ['Renderer: Export button', vRender.includes('children:"Export"')],
  ['Renderer: Save as Markdown option', vRender.includes('Save as Markdown')],
  ['Renderer: Save as JSON option', vRender.includes('Save as JSON')],
  ['Renderer: Copy to Clipboard option', vRender.includes('Copy to Clipboard')],
  ['Renderer: navigator.clipboard.writeText', vRender.includes('navigator.clipboard.writeText')],
  ['Renderer: export dropdown menu', vRender.includes('doExport')],
];

let allPass = true;
checks.forEach(([name, ok]) => {
  if (!ok) allPass = false;
  log(`  ${ok ? 'PASS' : 'FAIL'} - ${name}`);
});

if (allPass) {
  log('  All export checks passed!');
} else {
  log('  WARNING: Some checks failed!');
}
