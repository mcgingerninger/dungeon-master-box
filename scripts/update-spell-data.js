// Refreshes the bundled spell data (data/spells/2014 and data/spells/2024) from the 5etools
// mirrors the app used to fetch at runtime. Run: node scripts/update-spell-data.js
// Needs internet access; the app itself no longer does (it reads these files).
import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCES = {
  2014: 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-2014-src/main/data/spells/',
  2024: 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/spells/',
};
const get = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.text(); };

for (const [year, root] of Object.entries(SOURCES)) {
  const dir = path.join(import.meta.dirname, '..', 'data', 'spells', year);
  await fs.mkdir(dir, { recursive: true });
  const indexText = await get(root + 'index.json');
  const files = Object.values(JSON.parse(indexText));
  const texts = await Promise.all(files.map(f => get(root + f)));
  // Only write once everything downloaded, so a failed refresh never leaves a half-updated set.
  await fs.writeFile(path.join(dir, 'index.json'), indexText);
  await Promise.all(files.map((f, i) => fs.writeFile(path.join(dir, f), texts[i])));
  const count = texts.reduce((n, t) => n + (JSON.parse(t).spell || []).length, 0);
  console.log(`${year}: ${files.length} source files, ${count} spells`);
}
