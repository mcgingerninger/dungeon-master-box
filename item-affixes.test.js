// Checks for the weapon affix data (item-affixes.js): every affix has a weight, a description line and text that
// obeys the Item Rules; the class filters keep materials and tricks on weapons they make sense for.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { AFFIX_WEIGHTS, DEFAULT_ITEM_RULES } from './mechanics/data/item-rules-default.js';
import { scoreText } from './mechanics/engine/items/item-rules.js';

const root = new URL('.', import.meta.url).pathname;
const win = {};
vm.runInContext(fs.readFileSync(root + 'item-affixes.js', 'utf8'), vm.createContext({ window: win, console, Object, Array, String, Number, Math }), { filename: 'item-affixes.js' });
const D = win.ItemAffixData;
const html = fs.readFileSync(root + 'dungeon_loot_wheel_v104_spell_details.html', 'utf8');
const RARITIES = ['common', 'uncommon', 'rare', 'superrare', 'legendary', 'celestial'];
const CLASSES = new Set('blade axe blunt pole whip staff ranged bow sling crossbow melee metal wood light heavy thrown'.split(' '));
const baseWeapons = [...html.slice(html.indexOf('const WEAPON_BASE_TYPES'), html.indexOf('];', html.indexOf('const WEAPON_BASE_TYPES'))).matchAll(/name: '([^']+)'/g)].map(m => m[1]);
const existing = [...html.slice(html.indexOf('const ITEM_AFFIXES = ['), html.indexOf('];', html.indexOf('const ITEM_AFFIXES = ['))).matchAll(/\{ name: '([^']+)'/g)].map(m => m[1]);

test('base weapon list is read and every base has classes', () => {
  assert.ok(baseWeapons.length >= 31);
  for (const w of baseWeapons) { const c = D.weaponClassesOf(w); assert.ok(c.includes('melee') !== c.includes('ranged'), w); c.forEach(x => assert.ok(CLASSES.has(x), `${w}: ${x}`)); }
  assert.ok(D.weaponClassesOf('Longbow').includes('wood') && D.weaponClassesOf('Longsword').includes('metal'));
  assert.ok(D.weaponClassesOf('Mystery Falchion').includes('blade'), 'unknown names are guessed');
});

test('every new affix is well formed, weighted and described', () => {
  const names = new Set(existing);
  assert.ok(D.affixes.length >= 60, `got ${D.affixes.length}`);
  for (const a of D.affixes) {
    assert.ok(!names.has(a.name), `duplicate ${a.name}`); names.add(a.name);
    assert.ok(a.appliesTo.every(c => c === 'weapon' || c === 'armor') && a.appliesTo.length);
    assert.ok(RARITIES.includes(a.minRarity) && (!a.maxRarity || RARITIES.indexOf(a.maxRarity) >= RARITIES.indexOf(a.minRarity)), a.name);
    (a.bases || []).forEach(b => assert.ok(CLASSES.has(b), `${a.name}: class ${b}`));
    assert.ok(typeof AFFIX_WEIGHTS[a.name] === 'number', `${a.name} has no weight in AFFIX_WEIGHTS`);
    const lk = D.looks[a.name]; assert.ok(lk && lk.weapon.length >= 1, `${a.name} has no weapon description`);
    if (a.appliesTo.includes('armor')) assert.ok(lk.armor && lk.armor.length, `${a.name} has no armor description`);
    lk.weapon.concat(lk.armor || []).forEach(l => assert.ok(l.length > 20 && !/undefined|\[object/.test(l), `${a.name}: ${l}`));
    for (let m = 1; m <= 4; m++) {
      const t = a.text(m); assert.ok(typeof t === 'string' && t.length > 8 && !/undefined|NaN|\{/.test(t), `${a.name}@${m}: ${t}`);
      const sc = scoreText(t, DEFAULT_ITEM_RULES);
      assert.ok(Number.isFinite(sc.total), `${a.name}@${m} score`);
      assert.ok(!sc.components.some(c => c.touches === 'attack'), `${a.name}@${m} modifies attack rolls`);
      assert.ok(!/to attack rolls|to hit\b|attack bonus/i.test(t), `${a.name}: attack-roll wording`);
    }
    // it must fit at least one real base weapon (when it applies to weapons)
    if (a.appliesTo.includes('weapon')) assert.ok(baseWeapons.some(b => D.affixFits(a, b)), `${a.name} fits no base weapon`);
  }
  // every weapon affix that already existed also has a description line
  for (const n of existing) assert.ok(D.looks[n], `existing affix ${n} lacks a description`);
});

test('class filters keep affixes on sensible weapons', () => {
  const get = n => D.affixes.find(a => a.name === n);
  assert.ok(D.affixFits(get('Ironwood'), 'Longbow') && !D.affixFits(get('Ironwood'), 'Longsword'));
  assert.ok(D.affixFits(get('Moonsilver'), 'Longsword') && !D.affixFits(get('Moonsilver'), 'Shortbow'));
  assert.ok(D.affixFits(get('Seeking'), 'Light Crossbow') && D.affixFits(get('Seeking'), 'Javelin') && !D.affixFits(get('Seeking'), 'Greatsword'));
  assert.ok(D.affixFits(get('Returning'), 'Handaxe') && !D.affixFits(get('Returning'), 'Longsword'));
  assert.ok(D.affixFits(get('Crushing'), 'Maul') && !D.affixFits(get('Crushing'), 'Rapier'));
  assert.ok(D.affixFits(get('Reaching'), 'Whip') && D.affixFits(get('Reaching'), 'Halberd') && !D.affixFits(get('Reaching'), 'Dagger'));
  assert.ok(D.affixFits(get('Thundering'), 'Sling'), 'unrestricted affixes fit anything');
});

test('every rarity has a deep affix pool for every base weapon', () => {
  const all = [...D.affixes];
  for (const r of RARITIES) for (const w of baseWeapons) {
    const pool = all.filter(a => a.appliesTo.includes('weapon') && RARITIES.indexOf(a.minRarity) <= RARITIES.indexOf(r) && (!a.maxRarity || RARITIES.indexOf(a.maxRarity) >= RARITIES.indexOf(r)) && D.affixFits(a, w));
    assert.ok(pool.length >= 8, `${r} ${w}: only ${pool.length} new affixes`);
  }
});

test('the monolith hooks the new data in', () => {
  assert.match(html, /<script src="item-affixes.js"><\/script>/);
  assert.match(html, /ITEM_AFFIXES\.push\(\.\.\.window\.ItemAffixData\.affixes\)/);
  assert.match(html, /rollItemAffixes\(cat, rarity, baseName\)/);
  // each exclusive group name is a real affix
  const all = new Set([...existing, ...D.affixes.map(a => a.name)]);
  const grp = html.slice(html.indexOf('const AFFIX_EXCLUSIVE_GROUPS'), html.indexOf('];', html.indexOf('const AFFIX_EXCLUSIVE_GROUPS')));
  for (const m of grp.matchAll(/'([A-Za-z]+)'/g)) assert.ok(all.has(m[1]), `exclusive group names an unknown affix: ${m[1]}`);
});
