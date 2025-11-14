// scripts/extract-keys.mjs
import { globby } from 'globby';
import fs from 'fs/promises';
import path from 'path';

const SRC_DIR = path.resolve('src');
const EN_JSON = path.resolve('src/locales/en.json');

function ensureOrder(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a],[b]) => a.localeCompare(b)));
}

const files = await globby([
  'src/**/*.{js,jsx,ts,tsx}',
  '!src/locales/**',
  '!**/*.d.ts'
]);

const found = new Map(); // key -> defaultText

const TX_REGEX = /tx\(\s*(['"`])(?<def>.*?)\1\s*,\s*(['"`])(?<key>.*?)\3\s*\)/g;

for (const file of files) {
  const code = await fs.readFile(file, 'utf8');
  for (const m of code.matchAll(TX_REGEX)) {
    const key = m.groups?.key?.trim();
    const def = m.groups?.def ?? '';
    if (!key) continue;
    if (!found.has(key)) found.set(key, def);
  }
}

// read existing en.json (if any) and merge
let en = {};
try {
  en = JSON.parse(await fs.readFile(EN_JSON, 'utf8'));
} catch { en = {}; }

// Merge: keep existing overrides, fill missing with defaults
for (const [k, def] of found.entries()) {
  if (!en[k]) en[k] = def || k;
}

// Remove keys no longer used (optional: comment out to keep)
for (const k of Object.keys(en)) {
  if (!found.has(k)) delete en[k];
}

await fs.mkdir(path.dirname(EN_JSON), { recursive: true });
await fs.writeFile(EN_JSON, JSON.stringify(ensureOrder(en), null, 2) + '\n', 'utf8');

console.log(`Extracted ${found.size} keys → updated src/locales/en.json`);
