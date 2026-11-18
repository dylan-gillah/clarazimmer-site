#!/usr/bin/env node
// Fails the build if any content file points at an image that is not in web/media/.
// Exact-case match, because GitHub's Linux build is case-sensitive even when this Mac is not.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mediaDir = path.join(root, 'media');
const files = new Set(fs.readdirSync(mediaDir));
const sources = [
  ...fs.readdirSync(path.join(root, 'src/content/films')).map((f) => `src/content/films/${f}`),
  ...fs.readdirSync(path.join(root, 'src/data')).map((f) => `src/data/${f}`),
].filter((f) => f.endsWith('.json'));

const missing = [];
let count = 0;
function walk(value, file, trail) {
  if (typeof value === 'string') {
    if (value.startsWith('/media/')) {
      count++;
      if (!files.has(value.slice('/media/'.length))) missing.push(`${file} → ${trail}: ${value}`);
    }
  } else if (Array.isArray(value)) value.forEach((v, i) => walk(v, file, `${trail}[${i}]`));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, file, trail ? `${trail}.${k}` : k);
}
for (const file of sources) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  } catch (e) {
    console.error(`✗ ${file} is not valid JSON: ${e.message}`);
    process.exit(1);
  }
  walk(data, file, '');
}
if (missing.length) {
  console.error(`✗ ${missing.length} image(s) referenced in content are missing from web/media/:`);
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}
console.log(`✓ media check: ${count} image references in ${sources.length} content files, all present in web/media/`);
