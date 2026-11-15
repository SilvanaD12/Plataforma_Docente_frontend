import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const budgetBytes = 200_000;
const dist = new URL('../dist/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('.vite/manifest.json', dist), 'utf8'));
const entryKeys = Object.keys(manifest).filter((key) => manifest[key].isEntry);
if (entryKeys.length === 0) {
  throw new Error('No build entry points found in the Vite manifest.');
}

const visited = new Set();
const scripts = new Set();

function collectInitialScripts(key) {
  if (visited.has(key)) return;
  visited.add(key);
  const chunk = manifest[key];
  if (!chunk) throw new Error(`Missing chunk in Vite manifest: ${key}`);

  if (/\.(?:m?js)$/.test(chunk.file)) scripts.add(chunk.file);
  // Dynamic imports are fetched when their route is opened.
  for (const dependency of chunk.imports ?? []) collectInitialScripts(dependency);
}

for (const key of entryKeys) collectInitialScripts(key);
if (scripts.size === 0) throw new Error('No initial JavaScript found in the Vite manifest.');

let totalBytes = 0;
for (const file of [...scripts].sort()) {
  const compressedBytes = gzipSync(await readFile(new URL(file, dist))).length;
  totalBytes += compressedBytes;
  console.log(`${file}: ${compressedBytes} bytes gzip`);
}

console.log(`Initial JavaScript: ${totalBytes} bytes gzip. Budget: under ${budgetBytes} bytes.`);
if (totalBytes >= budgetBytes) {
  console.error('Initial JavaScript exceeds the bundle budget.');
  process.exitCode = 1;
}
