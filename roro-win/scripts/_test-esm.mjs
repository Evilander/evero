// Temporary test: check if renderer JS parses as ES module
try {
  await import('file:///A:/ai/claude/automation/windowscov/roro-win/out/renderer/assets/index-BFJPEAID.js');
  console.log('OK-RUNTIME');
} catch(e) {
  if (e instanceof SyntaxError) {
    console.log('SYNTAX-ERROR: ' + e.message);
  } else {
    console.log('OK-PARSE');  // Runtime error means syntax was fine
  }
}
