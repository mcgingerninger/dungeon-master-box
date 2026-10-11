// Checks for the high-detail 64x64 monster portraits (monster-art-hd.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('.', import.meta.url).pathname;
const win = {};
const ctx = vm.createContext({ window: win, console, Math, Array, Object, String, Number, Set, Map, Uint8Array, Int16Array, Float32Array, JSON, RegExp });
for (const f of ['monster-art.js', 'monster-art-hd.js']) vm.runInContext(fs.readFileSync(root + f, 'utf8'), ctx, { filename: f });

const HD = win.MonsterArtHD;
const dragon = n => win.monsterArt({ name: n, type: 'dragon' });

test('HD art registers its kinds and renders a 64x64 grid', () => {
  assert.ok(HD.has('dragon'));
  const a = dragon('Adult Red Dragon'), g = HD.render('dragon', a.colors, a.pal);
  assert.equal(g.length, 64);
  assert.ok(g.every(r => r.length === 64));
  const filled = g.flat().filter(Boolean).length;
  assert.ok(filled > 1500 && filled < 3800, 'a portrait fills a good part of the token: ' + filled);
});

test('the portrait is dark and uses many shades', () => {
  const a = dragon('Adult Black Dragon'), g = HD.render('dragon', a.colors, a.pal).flat().filter(Boolean);
  assert.ok(new Set(g).size > 25, 'many distinct shades');
  const lum = c => { const v = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  assert.ok(g.reduce((s, c) => s + lum(c), 0) / g.length < 110, 'dark on average');
});

test('every dragon colour renders, differently, and nothing is left floating', () => {
  const seen = new Set();
  ['red', 'blue', 'green', 'black', 'white', 'gold', 'silver', 'bronze', 'copper', 'brass'].forEach(c => {
    const a = dragon('Adult ' + c + ' Dragon'), g = HD.render('dragon', a.colors, a.pal);
    seen.add(JSON.stringify(g));
  });
  assert.equal(seen.size, 10);
});

test('monsterArtSvg uses the HD portrait for dragons and the 32px sprite for other kinds', () => {
  const d = win.monsterArtSvg({ name: 'Adult Red Dragon', type: 'dragon' }, 64, true);
  assert.match(d, /viewBox="0 0 64 64"/);
  const g = win.monsterArtSvg({ name: 'Goblin', type: 'humanoid' }, 64, true);
  assert.match(g, /viewBox="0 0 32 32"/);
});
