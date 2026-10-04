// Guards the gp pricing rules from scripts/rebalance-gp.js against the real, checked-in data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GP_BANDS, GP_HARD_CAP, UNKNOWN_GP, parseGp, rewriteLootDataSource } from './rebalance-gp.js';

const root = path.join(import.meta.dirname, '..');
const lootData = new Function(fs.readFileSync(path.join(root, 'loot-data.js'), 'utf8') + '; return lootData')();

test('no item is ever worth more than the 100k gp hard cap', () => {
  for (const [tier, items] of Object.entries(lootData))
    for (const i of items) {
      const v = parseGp(i.gp);
      assert.ok(v === null || v <= GP_HARD_CAP, `${tier}/${i.name}: ${i.gp}`);
    }
});

test('Rare items are never worth more than 1000 gp', () => {
  for (const i of lootData.rare) {
    const v = parseGp(i.gp);
    assert.ok(v === null || v <= 1000, `${i.name}: ${i.gp}`);
  }
});

test('every priced item stays at or under its tier ceiling', () => {
  for (const [tier, items] of Object.entries(lootData))
    for (const i of items) {
      const v = parseGp(i.gp);
      assert.ok(v === null || v <= GP_BANDS[tier][1], `${tier}/${i.name}: ${i.gp}`);
    }
});

test('every non-numeric price is the explicit "Unknown", never a blank or dash', () => {
  for (const [tier, items] of Object.entries(lootData))
    for (const i of items)
      if (parseGp(i.gp) === null) assert.equal(i.gp, UNKNOWN_GP, `${tier}/${i.name}: ${JSON.stringify(i.gp)}`);
});

test('tier medians rise from Uncommon up to Super Rare', () => {
  const med = t => { const v = lootData[t].map(i => parseGp(i.gp)).filter(x => x !== null).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  assert.ok(med('uncommon') < med('rare') && med('rare') < med('superrare') && med('superrare') < med('legendary'));
});

test('within a tier a heavier item (more modifier weight) never costs less than a lighter one', async () => {
  const { scoreItem, parseGp } = await import('../mechanics/engine/items/item-rules.js');
  for (const tier of ['uncommon', 'rare', 'superrare', 'legendary']) {
    const rows = lootData[tier]
      .filter(i => parseGp(i.gp) !== null && !i.chestRarity && !/open to find a haul/i.test(i.effect || '') && i.type !== 'questitem' && i.type !== 'document')
      .map(i => ({ name: i.name, w: scoreItem(i).total, gp: parseGp(i.gp) }))
      .sort((a, b) => a.w - b.w);
    for (let k = 1; k < rows.length; k++) assert.ok(rows[k].gp >= rows[k - 1].gp, `${tier}: ${rows[k - 1].name} (${rows[k - 1].w}) costs ${rows[k - 1].gp} but ${rows[k].name} (${rows[k].w}) costs ${rows[k].gp}`);
  }
});

test('the repricer output always lands inside the bands, even if re-run on its own output', () => {
  const src = fs.readFileSync(path.join(root, 'loot-data.js'), 'utf8');
  const again = new Function(rewriteLootDataSource(src).text + '; return lootData')();
  for (const [tier, items] of Object.entries(again))
    for (const i of items) {
      const v = parseGp(i.gp);
      assert.ok(v === null || v <= GP_BANDS[tier][1], `${tier}/${i.name}: ${i.gp}`);
    }
});
