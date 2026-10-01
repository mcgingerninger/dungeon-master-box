// Reprices every item in loot-data.js (and marks untradeable NPC signature weapons in
// npc-data.js) so gp value scales with rarity tier AND with how strong the item actually is.
// Run: node scripts/rebalance-gp.js          (rewrites the two data files in place)
//      node scripts/rebalance-gp.js --dry    (prints the before/after summary only)
//
// Rules (see docs/GP_PRICING.md for the full rationale):
//  - Each rarity tier has a price band; no item may ever exceed GP_HARD_CAP (100,000 gp), and
//    a Rare item may never exceed 1,000 gp.
//  - Within a tier, an item's position in its band = 60% power score (damage, AC, bonuses,
//    charges, number of effects...) + 40% where its previous hand-set price ranked.
//  - Items not meant to be traded (quest items, unique/campaign items that had no price) get
//    the cost "Unknown" instead of a number.
//  - Common-tier gear (rope, torches, rations...) and treasure chests keep their existing,
//    already-sensible prices (only clamped down to the tier ceiling).
import fs from 'node:fs';
import path from 'node:path';

export const GP_HARD_CAP = 100000;
export const UNKNOWN_GP = 'Unknown';
export const GP_BANDS = {
  common:    [0.01, 50],
  uncommon:  [25, 300],
  rare:      [150, 1000],
  superrare: [1000, 10000],
  legendary: [8000, 50000],
  celestial: [30000, 100000],
};

const UNIT = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };
// "150 gp", "1.5k gp", "5 sp" -> gold-piece number; anything else ("—", "Unknown", "") -> null.
export function parseGp(str) {
  if (str == null) return null;
  const m = String(str).replace(/,/g, '').trim().match(/^([\d.]+)\s*(k)?\s*(cp|sp|ep|gp|pp)?\b/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (!Number.isFinite(v)) return null;
  return v * (m[2] ? 1000 : 1) * UNIT[(m[3] || 'gp').toLowerCase()];
}

const NICE = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10];
export function niceGp(v) {
  if (v < 1) return Math.round(v * 100) / 100;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  let best = e;
  for (const c of NICE) if (Math.abs(c * e - v) < Math.abs(best - v)) best = c * e;
  return best;
}

function avgDice(s) {
  const m = String(s || '').match(/(\d+)d(\d+)\s*([+-]\s*\d+)?/);
  return m ? (+m[1]) * ((+m[2] + 1) / 2) + (m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0) : 0;
}

// Rough "how strong is this item" score, built only from stats the item actually carries.
export function powerScore(i) {
  const t = (i.effect || '') + ' ' + (i.mods || []).map(m => m.text).join(' ');
  let s = 0;
  if (i.type === 'weapon') s += avgDice(i.dmg) * 1.2;
  if (i.type === 'armor') s += (parseFloat(i.ac) || 0) * 1.5;
  const bonus = t.match(/\+(\d)\s*(?:bonus\s*)?to (?:attack|AC|hit)/i) || t.match(/\+(\d) (?:weapon|armor|shield)/i);
  if (bonus) s += +bonus[1] * 5;
  s += Math.min(parseInt(i.charges, 10) || 0, 20) * 0.6;
  s += (i.mods || []).length * 2 + (i.abilities || []).length * 2 + (i.unlocks || []).length * 3;
  s += (t.match(/[.;]\s+[A-Z0-9]/g) || []).length * 1.5;
  s += (t.match(/resistance|immun|advantage|extra damage|additional \d+d\d+|\d+d\d+/gi) || []).length * 1.5;
  const scroll = (i.name || '').match(/Spell Scroll.*\((\d+)(?:st|nd|rd|th) Level\)/i);
  if (scroll) s += +scroll[1] * 3;
  if (i.type === 'companion') s += 3;
  if (i.type === 'consumable') s *= 0.4; // single-use
  return s;
}

const isChest = i => !!i.chestRarity || /open to find a haul/i.test(i.effect || '');
// Real D&D artifacts / relics: tradable in no sensible campaign, so no price even though the
// item has no "—" in the source.
const ARTIFACT_NAME = /\(.*Artifact\)|\bVecna\b|\bOrcus\b|\bMoonblade\b/i;
// An item gets "Unknown" when it was never meant to be bought or sold:
//  - quest items and documents (letters, maps, notes...), at any tier
//  - artifacts/relics
//  - any item that already had no price and is a story/unique piece: everything in the common,
//    rare, legendary and celestial tiers (those are authored props and named campaign items).
//  Unpriced ordinary magic items in Uncommon/Super Rare (a Wand of Smiles, an Iron Flask) are
//  normal tradable goods that simply never had a price, so they get one from their power.
export function isUntradeable(i, tier) {
  if (i.type === 'questitem' || i.type === 'document') return true;
  if (ARTIFACT_NAME.test(i.name || '')) return true;
  if (parseGp(i.gp) !== null) return false;
  return !(tier === 'uncommon' || tier === 'superrare');
}
const fmt = v => `${v} gp`;

function ranks(vals) {
  const idx = vals.map((v, k) => [v, k]).sort((a, b) => a[0] - b[0]);
  const out = new Array(vals.length);
  idx.forEach(([, k], pos) => { out[k] = pos / (vals.length - 1 || 1); });
  return out;
}

// Returns Map<item, newGpString> for one tier's item array.
export function priceTier(tier, items) {
  const [lo, hi] = GP_BANDS[tier];
  const result = new Map();
  const toPrice = [];
  for (const i of items) {
    if (isUntradeable(i, tier)) { result.set(i, UNKNOWN_GP); continue; }
    const old = parseGp(i.gp);
    if (tier === 'common' || isChest(i)) {
      result.set(i, old > hi ? fmt(hi) : i.gp); // keep mundane/chest prices, just never above the tier ceiling
      continue;
    }
    toPrice.push(i);
  }
  const pr = ranks(toPrice.map(powerScore));
  const withOld = toPrice.filter(i => parseGp(i.gp) !== null);
  const grByItem = new Map(ranks(withOld.map(i => parseGp(i.gp))).map((r, k) => [withOld[k], r]));
  toPrice.forEach((i, k) => {
    const q = grByItem.has(i) ? 0.6 * pr[k] + 0.4 * grByItem.get(i) : pr[k];
    const v = Math.min(hi, Math.max(lo, niceGp(lo * Math.pow(hi / lo, q))));
    result.set(i, fmt(v));
  });
  return result;
}

const TIER_HEADER = /^\s{2}(common|uncommon|rare|superrare|legendary|celestial): \[/;
const ITEM_LINE = /^\s*\{\s*"?name"?\s*:\s*"((?:[^"\\]|\\.)*)"/;
const GP_FIELD = /(\bgp"?\s*:\s*)"[^"]*"/;

export function rewriteLootDataSource(src) {
  const lootData = new Function(src + '; return lootData')();
  const priced = {};
  for (const [tier, items] of Object.entries(lootData)) priced[tier] = priceTier(tier, items);
  const cursor = {};
  let tier = null;
  const out = src.split('\n').map(line => {
    const th = line.match(TIER_HEADER);
    if (th) { tier = th[1]; cursor[tier] = 0; return line; }
    if (!tier || !ITEM_LINE.test(line)) return line;
    const item = lootData[tier][cursor[tier]++];
    const name = JSON.parse('"' + line.match(ITEM_LINE)[1] + '"');
    if (!item || item.name !== name) throw new Error(`loot-data.js line/item mismatch in ${tier}: "${name}" vs "${item && item.name}"`);
    const gp = priced[tier].get(item);
    if (GP_FIELD.test(line)) return line.replace(GP_FIELD, (_, k) => `${k}"${gp}"`);
    // No gp field in the source at all: insert one right after the type field.
    return line.replace(/((?:\btype|"type")\s*:\s*"[^"]*")/, (m) => `${m},${/"type"/.test(m) ? '"gp"' : 'gp'}:"${gp}"`);
  });
  return { text: out.join('\n'), lootData, priced };
}

export function summarize(lootData, priceOf) {
  const rows = {};
  for (const [tier, items] of Object.entries(lootData)) {
    const v = items.map(i => parseGp(priceOf(i, tier))).filter(x => x !== null).sort((a, b) => a - b);
    const q = f => v[Math.floor(f * (v.length - 1))];
    rows[tier] = { items: items.length, unknown: items.length - v.length, min: v[0], median: q(0.5), p90: q(0.9), max: v.at(-1) };
  }
  return rows;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const root = path.join(import.meta.dirname, '..');
  const lootPath = path.join(root, 'loot-data.js');
  const src = fs.readFileSync(lootPath, 'utf8');
  const { text, lootData, priced } = rewriteLootDataSource(src);
  console.log('BEFORE'); console.table(summarize(lootData, i => i.gp));
  console.log('AFTER'); console.table(summarize(lootData, (i, t) => priced[t].get(i)));
  if (!process.argv.includes('--dry')) {
    fs.writeFileSync(lootPath, text);
    // NPC signature weapons: unique to specific characters, never for sale.
    const npcPath = path.join(root, 'npc-data.js');
    const npc = fs.readFileSync(npcPath, 'utf8');
    fs.writeFileSync(npcPath, npc.replace(/gp:\s*"—"/g, `gp: "${UNKNOWN_GP}"`));
    console.log('Wrote loot-data.js and npc-data.js');
  }
}
