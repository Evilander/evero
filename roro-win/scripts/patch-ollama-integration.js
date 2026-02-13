/**
 * Ollama integration for EveRo v1.0.92-win
 *
 * Patches applied to main/index.js:
 * 1. Insert OllamaService class (same interface as ee / Claude service)
 * 2. Modify createAgent to dispatch Ollama vs Claude based on agent type
 * 3. Modify initializeProjectAgents restore to use saved metadata type
 * 4. Add IPC handlers: ollama:list-models, ollama:check-status, ollama:set-model, ollama:pull-model
 * 5. Extend launch-config defaults with ollamaModel field
 */

const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../out/main/index.js');
let code = fs.readFileSync(mainJsPath, 'utf-8');
const originalLength = code.length;

function log(msg) {
  console.log(`[patch-ollama] ${msg}`);
}

log('Applying Ollama integration patches...');

// ============================================================
// PATCH 1: Insert OllamaService class before `new ee;const oe=`
// ============================================================
// The OllamaService implements the same interface as ee (Claude service):
//   setWorkingDirectory, setMainWindow, restoreState, initializeSession,
//   sendMessage, getMessages, getSessionId, clearMessages

const ollamaServiceClass = `
class OllamaService{
constructor(modelName){
this.messages=[];
this.currentSessionId=null;
this.workingDirectory=process.cwd();
this.mainWindow=null;
this.modelName=modelName||"llama3.2";
this.ollamaHost="http://localhost:11434";
this.conversationHistory=[];
}
setWorkingDirectory(dir){this.workingDirectory=dir}
setMainWindow(win){this.mainWindow=win}
restoreState(msgs,sessionId){this.messages=msgs;this.currentSessionId=sessionId;
this.conversationHistory=msgs.filter(m=>m.role==="user"||m.role==="assistant").map(m=>({role:m.role,content:m.content}));
}
async initializeSession(){
if(this.currentSessionId)return this.currentSessionId;
this.currentSessionId="ollama-"+Date.now()+"-"+Math.random().toString(36).slice(2,8);
return this.currentSessionId;
}
getMessages(){return this.messages}
getSessionId(){return this.currentSessionId}
clearMessages(){this.messages=[];this.currentSessionId=null;this.conversationHistory=[];}
async sendMessage(prompt,streamCallback){
if(!this.currentSessionId)await this.initializeSession();
const userMsg={id:Date.now().toString(),role:"user",content:prompt,timestamp:Date.now()};
this.messages.push(userMsg);
this.conversationHistory.push({role:"user",content:prompt});
streamCallback?.({type:"session_start",sessionId:this.currentSessionId});
let fullResponse="";
try{
const http=require("http");
const postData=JSON.stringify({
model:this.modelName,
messages:this.conversationHistory,
stream:true
});
const url=new URL(this.ollamaHost+"/api/chat");
await new Promise((resolve,reject)=>{
const req=http.request({hostname:url.hostname,port:url.port,path:url.pathname,method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(postData)}},res=>{
let buf="";
res.on("data",chunk=>{
buf+=chunk.toString();
const lines=buf.split("\\n");
buf=lines.pop()||"";
for(const line of lines){
if(!line.trim())continue;
try{
const j=JSON.parse(line);
if(j.message&&j.message.content){
fullResponse+=j.message.content;
streamCallback?.({type:"message",content:j.message.content});
}
if(j.done){
resolve();
}
}catch(pe){}
}
});
res.on("end",()=>{resolve()});
res.on("error",reject);
});
req.on("error",reject);
req.write(postData);
req.end();
});
}catch(err){
const errMsg="[Ollama Error] "+((err&&err.message)?err.message:"Connection failed. Is Ollama running? (ollama serve)");
fullResponse=errMsg;
streamCallback?.({type:"message",content:errMsg});
}
const assistantMsg={id:(Date.now()+1).toString(),role:"assistant",content:fullResponse,timestamp:Date.now()};
this.messages.push(assistantMsg);
this.conversationHistory.push({role:"assistant",content:fullResponse});
streamCallback?.({type:"done"});
return fullResponse;
}
}
`;

const insertTarget = 'new ee;const oe=';
const insertIdx = code.indexOf(insertTarget);

if (insertIdx === -1) {
  log('  ERROR: Could not find insertion point for OllamaService class');
} else {
  code = code.substring(0, insertIdx) + ollamaServiceClass + insertTarget + code.substring(insertIdx + insertTarget.length);
  log('  [1/5] Inserted OllamaService class');
}

// ============================================================
// PATCH 2: Modify createAgent to dispatch based on type
// ============================================================
// Old: modelLogo:"claude",...},g=new ee;g.setWorkingDirectory(s)
// New: modelLogo:n==="ollama"?"ollama":"claude",...},g=n==="ollama"?new OllamaService(r):new ee;g.setWorkingDirectory(s)

const oldCreateLogo = 'modelLogo:"claude",hasSession:!1';
const newCreateLogo = 'modelLogo:n==="ollama"?"ollama":"claude",hasSession:!1';

if (code.includes(oldCreateLogo)) {
  code = code.replace(oldCreateLogo, newCreateLogo);
  log('  [2a/5] Patched createAgent modelLogo dispatch');
} else {
  log('  [2a/5] WARNING: Could not find modelLogo in createAgent');
}

const oldCreateService = 'hasUnreadNotification:!1},g=new ee;g.setWorkingDirectory(s),g.initializeSession()';
const newCreateService = 'hasUnreadNotification:!1},g=n==="ollama"?new OllamaService(r):new ee;g.setWorkingDirectory(s),g.initializeSession()';

if (code.includes(oldCreateService)) {
  code = code.replace(oldCreateService, newCreateService);
  log('  [2b/5] Patched createAgent service dispatch');
} else {
  log('  [2b/5] WARNING: Could not find new ee in createAgent');
}

// ============================================================
// PATCH 3: Modify initializeProjectAgents restore loop
// ============================================================
// Old: const g=new ee;g.setWorkingDirectory(t),g.restoreState(d.messages,d.sessionId)
// New: const g=d.metadata&&d.metadata.type==="ollama"?new OllamaService(d.metadata.modelName):new ee;

const oldRestore = 'for(const d of r.agents){const g=new ee;g.setWorkingDirectory(t),g.restoreState(d.messages,d.sessionId)';
const newRestore = 'for(const d of r.agents){const g=(d.metadata&&d.metadata.type==="ollama")?new OllamaService(d.metadata.modelName):new ee;g.setWorkingDirectory(t),g.restoreState(d.messages,d.sessionId)';

if (code.includes(oldRestore)) {
  code = code.replace(oldRestore, newRestore);
  log('  [3/5] Patched initializeProjectAgents restore dispatch');
} else {
  log('  [3/5] WARNING: Could not find restore loop pattern');
}

// ============================================================
// PATCH 4: Add Ollama IPC handlers
// ============================================================
// Insert before shell:openExternal handler

const shellHandler = 'c.ipcMain.handle("shell:openExternal"';
const shellIdx = code.indexOf(shellHandler);

if (shellIdx === -1) {
  log('  [4/5] ERROR: Could not find shell:openExternal handler');
} else {
  const ollamaHandlers = `
c.ipcMain.handle("ollama:check-status",async()=>{
try{
const http=require("http");
return await new Promise((resolve)=>{
const req=http.get("http://localhost:11434/",res=>{
let d="";res.on("data",c=>d+=c);
res.on("end",()=>resolve({success:!0,running:!0,response:d}));
});
req.on("error",()=>resolve({success:!0,running:!1}));
req.setTimeout(3000,()=>{req.destroy();resolve({success:!0,running:!1})});
});
}catch(err){return{success:!1,error:err.message}}
}),
c.ipcMain.handle("ollama:list-models",async()=>{
try{
const http=require("http");
return await new Promise((resolve,reject)=>{
const req=http.get("http://localhost:11434/api/tags",res=>{
let d="";res.on("data",c=>d+=c);
res.on("end",()=>{try{const j=JSON.parse(d);resolve({success:!0,models:j.models||[]})}catch(e){resolve({success:!1,error:"Invalid response"})}});
});
req.on("error",e=>resolve({success:!1,error:e.message}));
req.setTimeout(5000,()=>{req.destroy();resolve({success:!1,error:"Timeout"})});
});
}catch(err){return{success:!1,error:err.message}}
}),
c.ipcMain.handle("ollama:set-model",async(ev,projectId,agentId,modelName)=>{
try{
if(!z)return{success:!1,error:"Agent registry not ready"};
const agent=z.getAgent(projectId,agentId);
if(!agent)return{success:!1,error:"Agent not found"};
if(agent instanceof OllamaService){agent.modelName=modelName;return{success:!0}}
return{success:!1,error:"Agent is not an Ollama agent"}
}catch(err){return{success:!1,error:err.message}}
}),
c.ipcMain.handle("ollama:pull-model",async(ev,modelName)=>{
try{
const http=require("http");
const postData=JSON.stringify({name:modelName,stream:false});
return await new Promise((resolve,reject)=>{
const req=http.request({hostname:"localhost",port:11434,path:"/api/pull",method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(postData)}},res=>{
let d="";res.on("data",c=>d+=c);
res.on("end",()=>{try{resolve({success:!0,result:JSON.parse(d)})}catch{resolve({success:!0,result:d})}});
});
req.on("error",e=>resolve({success:!1,error:e.message}));
req.setTimeout(300000,()=>{req.destroy();resolve({success:!1,error:"Timeout (5min)"})});
req.write(postData);
req.end();
});
}catch(err){return{success:!1,error:err.message}}
}),`;

  code = code.substring(0, shellIdx) + ollamaHandlers + code.substring(shellIdx);
  log('  [4/5] Added Ollama IPC handlers (check-status, list-models, set-model, pull-model)');
}

// ============================================================
// PATCH 5: Extend launch-config defaults with ollamaModel
// ============================================================

const oldDefaults = 'defaults:{autoLaunch:!1,skipPermissions:!1,model:"",verbose:!1,customFlags:""}';
const newDefaults = 'defaults:{autoLaunch:!1,skipPermissions:!1,model:"",verbose:!1,customFlags:"",ollamaModel:"llama3.2"}';

if (code.includes(oldDefaults)) {
  code = code.replace(oldDefaults, newDefaults);
  log('  [5/5] Extended launch-config defaults with ollamaModel');
} else {
  log('  [5/5] WARNING: Could not find launch-config defaults');
}

// ============================================================
// Write patched file
// ============================================================
fs.writeFileSync(mainJsPath, code, 'utf-8');

const newLength = code.length;
log('');
log(`Patching complete. File size: ${originalLength} -> ${newLength} bytes (+${newLength - originalLength})`);

// Verify patches
const verifyCode = fs.readFileSync(mainJsPath, 'utf-8');
const checks = [
  ['OllamaService class', 'class OllamaService{'],
  ['Ollama API chat endpoint', '/api/chat'],
  ['createAgent modelLogo dispatch', 'n==="ollama"?"ollama":"claude"'],
  ['createAgent service dispatch', 'n==="ollama"?new OllamaService(r):new ee'],
  ['Restore dispatch', 'd.metadata.type==="ollama"'],
  ['ollama:check-status IPC', 'ollama:check-status'],
  ['ollama:list-models IPC', 'ollama:list-models'],
  ['ollama:set-model IPC', 'ollama:set-model'],
  ['ollama:pull-model IPC', 'ollama:pull-model'],
  ['launch-config ollamaModel', 'ollamaModel:"llama3.2"'],
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
