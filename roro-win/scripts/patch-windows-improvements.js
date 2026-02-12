/**
 * Windows UX improvements for EveRo v1.0.92-win
 *
 * Patches applied:
 * 1. Single-instance lock - prevents multiple EveRo windows / broken cmd.exe spawns
 * 2. Fix protocol handler - remove broken process.argv[1] argument on Windows
 * 3. Auto-launch Claude Code - terminal auto-runs claude with configurable flags
 * 4. Add IPC handler for launch configuration - renderer can set startup flags
 */

const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../out/main/index.js');
let code = fs.readFileSync(mainJsPath, 'utf-8');
const originalLength = code.length;

function log(msg) {
  console.log(`[patch-win-ux] ${msg}`);
}

log('Applying Windows UX improvements...');

// ============================================================
// PATCH 1: Add single-instance lock
// ============================================================
// Prevents multiple app instances. Second launch routes to existing window.
// Insert right before app.whenReady()

const whenReadyIdx = code.indexOf('c.app.whenReady()');
if (whenReadyIdx === -1) {
  log('  ERROR: Could not find app.whenReady() - skipping single-instance patch');
} else {
  const singleInstanceCode = `
const __gotLock=c.app.requestSingleInstanceLock();
if(!__gotLock){c.app.quit()}else{
c.app.on("second-instance",(ev,argv,cwd)=>{
if(k){if(k.isMinimized())k.restore();k.focus()}
const url=argv.find(a=>a.startsWith("evero://"));
if(url&&url.startsWith("evero://auth/callback")){S.handleOAuthCallback(url,k).catch(()=>{})}
})}
`;
  code = code.substring(0, whenReadyIdx) + singleInstanceCode + code.substring(whenReadyIdx);
  log('  [1/4] Added single-instance lock with second-instance handler');
}

// ============================================================
// PATCH 2: Fix protocol handler registration
// ============================================================
// On Windows in dev mode, process.argv[1] is often a file path or garbage.
// The packed app doesn't need extra args. Simplify to always use no-args form.

// Search for original "roro" in mac source, replace with simplified "evero" protocol
const oldProtocol = `process.defaultApp?process.argv.length>=2&&c.app.setAsDefaultProtocolClient("roro",process.execPath,[process.argv[1]]):c.app.setAsDefaultProtocolClient("roro")`;
const newProtocol = `c.app.setAsDefaultProtocolClient("evero")`;

if (code.includes(oldProtocol)) {
  code = code.replace(oldProtocol, newProtocol);
  log('  [2/4] Fixed protocol handler - removed broken argv[1] + rebranded to evero');
} else if (code.includes('setAsDefaultProtocolClient("evero")')) {
  log('  [2/4] Protocol handler already simplified + rebranded - skipping');
} else if (code.includes('setAsDefaultProtocolClient("roro")')) {
  code = code.replace('setAsDefaultProtocolClient("roro")', 'setAsDefaultProtocolClient("evero")');
  log('  [2/4] Protocol handler simplified form found - rebranded to evero');
} else {
  log('  [2/4] WARNING: Could not find protocol handler pattern');
}

// ============================================================
// PATCH 3: Auto-launch Claude Code in terminal
// ============================================================
// After the pty spawns, write a claude command into it.
// We inject code right after the Me.spawn() call that sends a startup command.

// Find the spawn call and the session storage after it
const spawnPattern = 'h=Me.spawn(r,d,{name:"xterm-256color"';
const spawnIdx = code.indexOf(spawnPattern);

if (spawnIdx === -1) {
  log('  [3/4] WARNING: Could not find Me.spawn pattern - skipping auto-launch');
} else {
  // Find the point after the session is stored and event listeners are set up.
  // We need to find where the terminal data listener is added - that's after spawn setup is complete.
  // Look for the onData callback setup after spawn
  const afterSpawnSearch = code.substring(spawnIdx, spawnIdx + 1500);
  const onDataIdx = afterSpawnSearch.indexOf('.onData(');

  if (onDataIdx === -1) {
    log('  [3/4] WARNING: Could not find onData handler after spawn - skipping');
  } else {
    // Find the end of the onData callback registration
    // Pattern: h.onData(d=>{...})  or similar
    let braceCount = 0;
    let searchStart = spawnIdx + onDataIdx;
    let parenStart = code.indexOf('(', searchStart);
    let insertPos = -1;

    // Find closing of onData(...)
    braceCount = 1;
    let pos = parenStart + 1;
    while (pos < code.length && braceCount > 0) {
      if (code[pos] === '(') braceCount++;
      else if (code[pos] === ')') braceCount--;
      pos++;
    }

    // Now we're right after the onData(...) - look for the next comma or semicolon
    // to find a safe insertion point
    while (pos < code.length && code[pos] !== ',' && code[pos] !== ';') pos++;
    insertPos = pos + 1;

    if (insertPos > 0) {
      // Inject auto-launch code. Uses a small delay to let the terminal initialize.
      // Reads launch config from a stored setting, defaults to basic claude launch.
      const autoLaunchCode = `
setTimeout(()=>{
const _lc=this._launchConfig||{};
const _flags=[];
if(_lc.skipPermissions)_flags.push("--dangerously-skip-permissions");
if(_lc.model)_flags.push("--model",_lc.model);
if(_lc.verbose)_flags.push("--verbose");
if(_lc.customFlags)_flags.push(..._lc.customFlags.split(" ").filter(Boolean));
if(_lc.autoLaunch!==false){
const _cmd="claude"+(_flags.length?" "+_flags.join(" "):"")+"\\r";
try{h.write(_cmd)}catch(_e){}
}},800),`;
      code = code.substring(0, insertPos) + autoLaunchCode + code.substring(insertPos);
      log('  [3/4] Added auto-launch Claude Code after terminal spawn');
    } else {
      log('  [3/4] WARNING: Could not find safe insertion point after onData');
    }
  }
}

// ============================================================
// PATCH 4: Add IPC handler for launch configuration
// ============================================================
// Adds a new IPC handler that lets the renderer set launch flags
// before creating a terminal.

const shellHandlerPattern = 'c.ipcMain.handle("shell:openExternal"';
const shellIdx = code.indexOf(shellHandlerPattern);

if (shellIdx === -1) {
  log('  [4/4] WARNING: Could not find shell:openExternal handler - skipping config IPC');
} else {
  const configHandlers = `,
c.ipcMain.handle("launch-config:set",async(ev,cfg)=>{if(z)z._launchConfig=cfg;return{success:!0}}),
c.ipcMain.handle("launch-config:get",async()=>{return{success:!0,config:z?z._launchConfig||{}:{}}}),
c.ipcMain.handle("launch-config:get-defaults",async()=>{return{success:!0,defaults:{autoLaunch:!0,skipPermissions:!1,model:"",verbose:!1,customFlags:""}}})`;

  code = code.substring(0, shellIdx) + configHandlers + ',' + code.substring(shellIdx);
  log('  [4/4] Added launch-config IPC handlers');
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
  ['Single-instance lock', 'requestSingleInstanceLock'],
  ['Second-instance handler', 'second-instance'],
  ['Simplified protocol', 'c.app.setAsDefaultProtocolClient("evero")'],
  ['Auto-launch claude', '_launchConfig'],
  ['Launch config IPC', 'launch-config:set'],
];

log('');
log('Verification:');
checks.forEach(([name, pattern]) => {
  const found = verifyCode.includes(pattern);
  log(`  ${found ? 'PASS' : 'FAIL'} - ${name}`);
});
