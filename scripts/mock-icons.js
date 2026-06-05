const fs = require('fs');
const path = require('path');

const iconsDir = path.resolve(__dirname, '../apps/host-agent/src-tauri/icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Write dummy/empty files for Tauri icons to prevent compilation errors
const files = [
  '32x32.png',
  '128x128.png',
  '128x128@2x.png',
  'icon.icns',
  'icon.ico'
];

files.forEach(file => {
  const filePath = path.join(iconsDir, file);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, Buffer.alloc(0));
    console.log(`Created mock icon: ${file}`);
  }
});
