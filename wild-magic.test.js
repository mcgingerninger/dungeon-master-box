// The Wild Magic table (wild-magic-data.js): complete d100 coverage, sane entries, and the app is wired to it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('.', import.meta.url).pathname;
const win = {};
vm.runInContext(fs.readFileSync(root + 'wild-magic-data.js', 'utf8'), vm.createContext({ window: win, Math, String, Array }), { filename: 'wild-magic-data.js' });
const W = win.WildMagic;

test('the table covers 1-100 exactly once', () => {
  const seen = new Map();
  for (const e of W.table) for (let n = e.lo; n <= e.hi; n++) { assert.ok(!seen.has(n), `${n} is covered twice`); seen.set(n, e); }
  for (let n = 1; n <= 100; n++) assert.ok(seen.has(n), `${n} has no entry`);
  assert.equal(W.table.length, 50);
});

test('entries are well formed and the table has a real spread of outcomes', () => {
  const kinds = {};
  for (const e of W.table) { assert.ok(e.text.length > 20, e.text); assert.ok(['fun', 'good', 'bad', 'danger', 'odd'].includes(e.kind), e.kind); kinds[e.kind] = (kinds[e.kind] || 0) + 1; }
  for (const k of ['fun', 'good', 'bad', 'danger', 'odd']) assert.ok(kinds[k] >= 4, `${k}: ${kinds[k]}`);
  assert.equal(new Set(W.table.map(e => e.text)).size, W.table.length, 'duplicate text');
});

test('roll returns a d100 and its entry; lookup clamps', () => {
  for (let i = 0; i < 300; i++) { const r = W.roll(); assert.ok(r.d100 >= 1 && r.d100 <= 100); assert.ok(r.d100 >= r.entry.lo && r.d100 <= r.entry.hi); }
  assert.equal(W.roll(() => 0).d100, 1); assert.equal(W.roll(() => 0.999).d100, 100);
  assert.equal(W.lookup(0), W.lookup(1)); assert.equal(W.lookup(500), W.lookup(100));
  assert.equal(W.label(W.lookup(100)), '99–00');
});

test('the app links the table from item text, the dice roller and the hover reference', () => {
  const html = fs.readFileSync(root + 'dungeon_loot_wheel_v104_spell_details.html', 'utf8');
  assert.match(html, /<script src="wild-magic-data.js"><\/script>/);
  assert.match(html, /id="wildMagicModal"/);
  assert.match(html, /openWildMagic\(\)/);
  assert.match(html, /Wild Magic\(\?: Surge\)\?\(\?: table\)\?/);
  assert.match(html, /kind === 'table' \? buildTableRefHtml\(false\)/);
});
