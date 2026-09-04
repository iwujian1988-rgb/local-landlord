import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distFile = path.resolve(scriptDir, '..', 'dist', 'taro.js');

if (!fs.existsSync(distFile)) {
  throw new Error(`Missing build output: ${distFile}`);
}

const source = fs.readFileSync(distFile, 'utf8');
const target = '"saveImageToPhotosAlbum",';

if (!source.includes(target)) {
  console.log('Privacy runtime already sanitized.');
  process.exit(0);
}

const result = source.replace(target, '');
fs.writeFileSync(distFile, result, 'utf8');
console.log('Removed unused saveImageToPhotosAlbum API from dist/taro.js.');
