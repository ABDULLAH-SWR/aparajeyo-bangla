import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const srcDir = path.join(rootDir, 'node_modules', 'maplibre-gl', 'dist');
const destDir = path.join(rootDir, 'public', 'maplibre');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const filesToCopy = [
  'maplibre-gl-worker.mjs',
  'maplibre-gl-shared.mjs',
  'maplibre-gl-worker.mjs.map',
  'maplibre-gl-worker-dev.mjs',
  'maplibre-gl-shared-dev.mjs',
  'maplibre-gl-worker-dev.mjs.map'
];

let copied = 0;
for (const file of filesToCopy) {
  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    copied++;
  }
}

console.log(`[copy-maplibre-worker] Copied ${copied} worker files to public/maplibre/`);
