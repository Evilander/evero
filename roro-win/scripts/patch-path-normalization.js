/**
 * Path normalization for EveRo v1.0.92-win
 *
 * Ensures all file paths sent from main process to renderer use forward slashes.
 * This allows the renderer's split("/") calls to work correctly on Windows
 * without needing to patch every occurrence.
 *
 * Patches applied to main/index.js:
 * 1. Normalize filePath in project:file-activity safeSend
 * 2. Normalize paths in project-file-map:load response
 * 3. Normalize paths in project-file-map:get response
 * 4. Normalize paths in recordActivity calls
 */

const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../out/main/index.js');
let code = fs.readFileSync(mainJsPath, 'utf-8');
const originalLength = code.length;

function log(msg) {
  console.log(`[patch-paths] ${msg}`);
}

log('Applying path normalization patches...');

// ============================================================
// PATCH 1: Add a path normalizer helper function
// ============================================================
// Insert a small utility right after the OllamaService class or before `const oe=`

const helperTarget = 'const oe=["';
const helperIdx = code.indexOf(helperTarget);

if (helperIdx === -1) {
  log('  ERROR: Could not find insertion point for path normalizer');
} else {
  const normalizer = `function __normPath(p){return typeof p==="string"?p.replace(/\\\\/g,"/"):p}function __normFileMap(fm){if(!fm)return fm;if(fm.files){const nf=fm.files.map(([k,v])=>[__normPath(k),v]);fm.files=nf}if(fm.agentActivity){const na=fm.agentActivity.map(([k,v])=>[k,v.map(a=>({...a,filePath:__normPath(a.filePath)}))]);fm.agentActivity=na}if(fm.activeFiles){const af=fm.activeFiles.map(([k,v])=>[__normPath(k),v]);fm.activeFiles=af}if(fm.projectPath)fm.projectPath=__normPath(fm.projectPath);return fm}`;
  code = code.substring(0, helperIdx) + normalizer + code.substring(helperIdx);
  log('  [1/4] Inserted path normalizer helpers');
}

// ============================================================
// PATCH 2: Normalize filePath in file-activity safeSend
// ============================================================
// Old: this.safeSend("project:file-activity",{projectId:n,agentId:s.agentId,filePath:m,
// New: this.safeSend("project:file-activity",{projectId:n,agentId:s.agentId,filePath:__normPath(m),

const oldActivity = 'this.safeSend("project:file-activity",{projectId:n,agentId:s.agentId,filePath:m,';
const newActivity = 'this.safeSend("project:file-activity",{projectId:n,agentId:s.agentId,filePath:__normPath(m),';

if (code.includes(oldActivity)) {
  code = code.replace(oldActivity, newActivity);
  log('  [2/4] Normalized filePath in file-activity events');
} else {
  log('  [2/4] WARNING: Could not find file-activity safeSend pattern');
}

// ============================================================
// PATCH 3: Normalize paths in project-file-map:load response
// ============================================================
// Old: return{success:!0,fileMap:{projectId:r.projectId,projectPath:r.projectPath,files:Array.from(r.files.entries()),agentActivity:Array.from(r.age...
// We wrap the response fileMap with __normFileMap

const oldLoadMap = '"project-file-map:load",async(t,s,n)=>{try{const r=await e.loadProject(s,n);return{success:!0,fileMap:{projectId:r.projectId,projectPath:r.projectPath,files:Array.from(r.files.entries()),agentActivity:Array.from(r.age';

if (code.includes(oldLoadMap)) {
  // Find the full return object and wrap it
  const loadIdx = code.indexOf(oldLoadMap);
  // Find the closing of fileMap object - need to find the matching }
  const retStart = code.indexOf('return{success:!0,fileMap:{', loadIdx);
  if (retStart !== -1) {
    const fileMapStart = code.indexOf('fileMap:{', retStart) + 8;
    // Find matching closing brace (start scanning AFTER the opening {)
    let depth = 1;
    let pos = fileMapStart + 1;
    while (pos < code.length && depth > 0) {
      if (code[pos] === '{') depth++;
      else if (code[pos] === '}') depth--;
      pos++;
    }
    // pos is now just after the closing } of the fileMap value
    const fileMapContent = code.substring(fileMapStart, pos);
    const newContent = `__normFileMap(${fileMapContent})`;
    code = code.substring(0, fileMapStart) + newContent + code.substring(pos);
    log('  [3/4] Normalized paths in project-file-map:load response');
  } else {
    log('  [3/4] WARNING: Could not find fileMap return in load handler');
  }
} else {
  log('  [3/4] WARNING: Could not find project-file-map:load pattern');
}

// ============================================================
// PATCH 4: Normalize paths in project-file-map:get response
// ============================================================
// The getSerializableFileMap already returns a serialized object, wrap it

const oldGetMap = 'const n=e.getSerializableFileMap(s);return n?{success:!0,fileMap:n}';
const newGetMap = 'const n=e.getSerializableFileMap(s);return n?{success:!0,fileMap:__normFileMap(n)}';

if (code.includes(oldGetMap)) {
  code = code.replace(oldGetMap, newGetMap);
  log('  [4/4] Normalized paths in project-file-map:get response');
} else {
  log('  [4/4] WARNING: Could not find project-file-map:get pattern');
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
  ['__normPath helper', 'function __normPath(p)'],
  ['__normFileMap helper', 'function __normFileMap(fm)'],
  ['file-activity normalization', 'filePath:__normPath(m)'],
  ['file-map:load normalization', '__normFileMap('],
  ['file-map:get normalization', 'fileMap:__normFileMap(n)'],
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
