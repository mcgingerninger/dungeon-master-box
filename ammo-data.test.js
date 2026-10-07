// Ammunition (ammo-data.js): arrows and bolts are their own stackable items, from plain to celestial.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('.', import.meta.url).pathname;
const win = {};
vm.runInContext(fs.readFileSync(root + 'ammo-data.js', 'utf8'), vm.createContext({ window: win, Math, String, Array, Object }), { filename: 'ammo-data.js' });
const A = win.AmmoData;

test('catalog covers common through celestial with unique names', () => {
  const names = A.items.map(i => i.name);
  assert.equal(new Set(names).size, names.length);
  for (const r of ['common', 'uncommon', 'rare', 'legendary', 'celestial']) assert.ok(A.byRarity(r).length >= 5, r);
  assert.ok(A.items.some(i => i.ammoKind === 'arrow') && A.items.some(i => i.ammoKind === 'bolt'));
});

test('every piece is stackable ammo with a rule block and a plain description', () => {
  for (const i of A.items) {
    assert.equal(i.subcategory, 'ammo'); assert.equal(i.stackMax, 999); assert.equal(A.stackMaxOf(i), 999);
    assert.ok(i.ammo && ['arrow', 'bolt'].includes(i.ammo.kind));
    assert.ok(/Ammunition for (bows|crossbows)/.test(i.effect), i.name);
    assert.ok(i.bundle[0] >= 1 && i.bundle[1] >= i.bundle[0]);
    assert.ok(parseFloat(i.gp) > 0);
  }
});

test('higher tiers hit harder and legendary / celestial carry real effects', () => {
  const dmg = n => { const s = A.stats(A.items.find(i => i.name === n)); return s.flat + s.dice.length; };
  assert.ok(dmg('Steel Arrow') > dmg('Arrow'));
  assert.ok(A.stats(A.items.find(i => i.name === 'Starfall Arrow')).dice.some(d => /^4d8$/.test(d.dice)));
  assert.ok(A.byRarity('celestial').every(i => A.stats(i).dice.length || A.stats(i).atk));
  assert.ok(A.stats(A.items.find(i => i.name === 'Wyrmslayer Arrow')).dice.some(d => d.versus === 'dragon'));
});

test('bows take arrows, crossbows take bolts, other launchers take none', () => {
  assert.equal(A.kindFor({ name: 'Longbow' }), 'arrow');
  assert.equal(A.kindFor({ name: 'Shortbow' }), 'arrow');
  assert.equal(A.kindFor({ name: 'Heavy Crossbow' }), 'bolt');
  assert.equal(A.kindFor({ name: 'Hand Crossbow' }), 'bolt');
  assert.equal(A.kindFor({ name: 'Sling' }), null);
  assert.equal(A.kindFor({ name: 'Longsword' }), null);
  assert.equal(A.kindFor({ name: 'Rainbow Staff' }), null);
  assert.equal(A.kindFor({ name: 'Elven Bow', effect: 'Needs no ammunition: it conjures its own arrows of light.' }), null);
});

test('bundle rolls stay in range', () => {
  const it = A.items.find(i => i.name === 'Arrow');
  for (let k = 0; k < 50; k++) { const n = A.rollBundle(it); assert.ok(n >= it.bundle[0] && n <= it.bundle[1]); }
  assert.equal(A.rollBundle({}), 1);
});
