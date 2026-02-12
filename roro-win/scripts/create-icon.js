/**
 * Create a Windows .ico file from the app's PNG icon.
 *
 * ICO format: Multiple BMP images packed together.
 * We'll create a simple 256x256 ICO by wrapping the PNG data.
 */

const fs = require('fs');
const path = require('path');

// ICO file format: https://en.wikipedia.org/wiki/ICO_(file_format)
// For simplicity, we'll embed the PNG directly in the ICO container
// (PNG-in-ICO is supported since Windows Vista)

function createIcoFromPng(pngPath, icoPath) {
  const pngData = fs.readFileSync(pngPath);

  // Parse PNG header to get dimensions
  // PNG signature: 8 bytes, then IHDR chunk
  const width = pngData.readUInt32BE(16);
  const height = pngData.readUInt32BE(20);

  console.log(`PNG: ${width}x${height}, ${pngData.length} bytes`);

  // ICO Header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // Reserved
  header.writeUInt16LE(1, 2);      // Type: 1 = ICO
  header.writeUInt16LE(1, 4);      // Number of images: 1

  // ICO Directory Entry: 16 bytes
  const entry = Buffer.alloc(16);
  entry.writeUInt8(width >= 256 ? 0 : width, 0);    // Width (0 = 256)
  entry.writeUInt8(height >= 256 ? 0 : height, 1);   // Height (0 = 256)
  entry.writeUInt8(0, 2);          // Color palette
  entry.writeUInt8(0, 3);          // Reserved
  entry.writeUInt16LE(1, 4);       // Color planes
  entry.writeUInt16LE(32, 6);      // Bits per pixel
  entry.writeUInt32LE(pngData.length, 8);  // Image size
  entry.writeUInt32LE(22, 12);     // Offset to image data (6 + 16 = 22)

  const ico = Buffer.concat([header, entry, pngData]);
  fs.writeFileSync(icoPath, ico);
  console.log(`Created ICO: ${icoPath} (${ico.length} bytes)`);
}

// Find the best source PNG
const pngSources = [
  path.resolve(__dirname, '../out/renderer/assets/roro_icon-CWBhGVPN.png'),
  path.resolve(__dirname, '../out/renderer/roro_transparent.png'),
  path.resolve(__dirname, '../../roro-mac/app-extracted/out/renderer/assets/roro_icon-CWBhGVPN.png'),
  path.resolve(__dirname, '../../roro-mac/app-extracted/out/renderer/roro_transparent.png'),
];

let srcPng = null;
for (const p of pngSources) {
  if (fs.existsSync(p)) {
    srcPng = p;
    break;
  }
}

if (!srcPng) {
  console.error('No PNG icon found!');
  process.exit(1);
}

const destIco = path.resolve(__dirname, '../resources/icon.ico');
fs.mkdirSync(path.dirname(destIco), { recursive: true });
createIcoFromPng(srcPng, destIco);
