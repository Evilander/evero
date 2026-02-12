/**
 * Patch the process detection code to work on Windows.
 *
 * The original code uses `ps` and `pgrep` (Unix-only).
 * We replace it with a cross-platform version that uses
 * `wmic` on Windows and `ps`/`pgrep` on Unix.
 */

const fs = require('fs');
const path = require('path');

const mainJsPath = path.resolve(__dirname, '../out/main/index.js');
let code = fs.readFileSync(mainJsPath, 'utf-8');

// Find and replace the Unix-only process detection
const searchPattern = 'ps -o args= -p $(pgrep -P ${e}) 2>/dev/null';
const idx = code.indexOf(searchPattern);

if (idx === -1) {
  console.log('Process detection pattern not found - may already be patched.');
  process.exit(0);
}

// Get the surrounding context to build precise replacement
const start = code.lastIndexOf('G.exec(', idx);
const end = code.indexOf(')})})') + 5; // closes: exec callback -> Promise -> method

console.log('Found process detection at index:', idx);

// Replace the entire isClaudeRunningInSession method body
const oldMethod = code.substring(
  code.lastIndexOf('isClaudeRunningInSession', idx),
  code.indexOf('detectMessageFallback', idx)
);

const newMethod = oldMethod.replace(
  /G\.exec\(`ps -o args= -p \$\(pgrep -P \$\{e\}\) 2>\/dev\/null`/,
  'G.exec(process.platform==="win32"?`wmic process where "ParentProcessId=${e}" get CommandLine 2>nul`:`ps -o args= -p $(pgrep -P ${e}) 2>/dev/null`'
);

if (oldMethod === newMethod) {
  console.log('WARNING: Regex replacement did not match. Trying simpler approach...');

  // Simple string replacement
  code = code.replace(
    'ps -o args= -p $(pgrep -P ${e}) 2>/dev/null',
    '${process.platform==="win32"?"wmic process where ParentProcessId="+e+" get CommandLine 2>nul":"ps -o args= -p $(pgrep -P "+e+") 2>/dev/null"}'
  );
} else {
  code = code.replace(oldMethod, newMethod);
}

fs.writeFileSync(mainJsPath, code, 'utf-8');
console.log('Process detection patched for Windows compatibility.');

// Verify
const newCode = fs.readFileSync(mainJsPath, 'utf-8');
if (newCode.includes('wmic') || !newCode.includes('ps -o args=')) {
  console.log('Verification: PASS');
} else {
  console.log('Verification: May need manual review');
}
