const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src', 'dllcall-signatures.json');
const targetDir = path.join(root, 'dist', 'src');
const target = path.join(targetDir, 'dllcall-signatures.json');

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
console.log(`Copied ${path.relative(root, source)} to ${path.relative(root, target)}`);
