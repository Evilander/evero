const fs = require('fs');
const path = require('path');
const dir = 'A:/ai/windowscov/roro-win/dist';
fs.readdirSync(dir).forEach(f => {
  const s = fs.statSync(path.join(dir, f));
  if (s.isDirectory()) {
    console.log(f.padEnd(45), 'DIR');
  } else {
    console.log(f.padEnd(45), (s.size / 1024 / 1024).toFixed(1), 'MB');
  }
});
