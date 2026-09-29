// Shadow-mode validation (Phase 13, docs/V2_MECHANICS_MIGRATION.md): for every migrated item,
// independently recompute what the OLD live regex path (extractStatDeltasFromText/
// parseWeaponEffectBonuses/a raw .hp read) would produce from the item's still-present legacy
// .effect/.ac/.dmg/.hp fields, and compare it against what the NEW canonical bridge
// (canonicalPassiveDeltas/canonicalAcContribution/canonicalWeaponAttackData/
// canonicalConsumableHealDice, all in game-engine.js) actually produces from __canonical. Any
// disagreement is either a documented, intentional fix (the weapon/armor double-count dedup) or a
// genuine bug this migration hasn't caught yet — this script tells the two apart automatically
// instead of trusting that by argument alone.
//
// Run with: node scripts/validate-migration-bridge.js
// Exits non-zero (and prints every UNEXPECTED finding) if anything doesn't match a known-safe
// pattern. A clean run is not proof of correctness beyond what it checks, but every migrated
// item's stat/AC/weapon-attack/consumable-heal bridge gets checked against its own real data,
// not a hand-picked sample.

import fs from 'node:fs';
import path from 'node:path';
import {
  extractStatDeltasFromText, canonicalPassiveDeltas, canonicalAcContribution,
  canonicalWeaponAttackData, canonicalConsumableHealDice,
} from '../game-engine.js';
import { loadLootData, parseWeaponEffectBonuses } from './migrate-legacy-content.js';

const ROOT = path.join(import.meta.dirname, '..');
const canonicalItems = JSON.parse(fs.readFileSync(path.join(ROOT, 'mechanics', 'canonical', 'items.json'), 'utf8'));
const lootData = loadLootData();

const unexpected = [];
const expectedFixes = { armorAcDedup: 0, weaponDamageDedup: 0 };
let checked = 0;

function findLegacyItem(canonical) {
  const src = canonical.legacySource;
  if (!src || src.source === 'npc-data.js:NPC_WEAPONS') return null;
  const arr = lootData[src.tier];
  if (!arr) return null;
  const byIndex = arr[src.index];
  if (byIndex && byIndex.name === src.name) return byIndex;
  return arr.find(it => it.name === src.name) || null;
}

// Groups a stat-delta array the same way collectEquippedStatBreakdown would fold entries from a
// single item into the shared breakdown: one amount per stat key (an item can't list the same
// stat twice in real content, but sum defensively rather than assume).
function sumByStat(deltas) {
  const out = {};
  for (const { stat, amount } of deltas) out[stat] = (out[stat] || 0) + amount;
  return out;
}

function compareStatDeltas(canonical, legacy, findings) {
  const oldDeltas = extractStatDeltasFromText(legacy.effect);
  const newDeltas = canonicalPassiveDeltas(canonical);
  const oldByStat = sumByStat(oldDeltas);
  const newByStat = sumByStat(newDeltas);
  const allStats = new Set([...Object.keys(oldByStat), ...Object.keys(newByStat)]);

  for (const stat of allStats) {
    const oldVal = oldByStat[stat] || 0;
    const newVal = newByStat[stat] || 0;
    if (oldVal === newVal) continue;

    // Documented, intentional divergence #1: an armor item's own effect text restates its ac
    // field in prose (e.g. "+1 AC" on a +1 shield) — migrateArmor deduped that redundant passive
    // entry at migration time (see docs/V2_MECHANICS_MIGRATION.md's Phase 7 bug writeup). Confirm
    // it's genuinely that pattern (old's 'Armor Class' value exactly equals this item's own
    // structured armor.baseAC) before accepting the divergence as expected.
    if (stat === 'Armor Class' && canonical.armor && oldVal === canonical.armor.baseAC && newVal === 0) {
      expectedFixes.armorAcDedup++;
      continue;
    }
    // Documented, intentional divergence #2 (Phase 13): a SECOND, differing "+N Armor Class"
    // match that's purely an informational running-total recap, not a real extra bonus (e.g.
    // "Shield of the Unbroken Line": "+3 AC (on top of standard shield bonus — total +5 AC from
    // this shield)"). migrateArmor drops any remaining 'ac' passive entry when the effect text
    // explicitly says "total" — confirm that same condition holds before accepting newVal === 0.
    if (stat === 'Armor Class' && newVal === 0 && /\btotal\b/i.test(legacy.effect || '')) {
      expectedFixes.armorAcTotalRecapDrop = (expectedFixes.armorAcTotalRecapDrop || 0) + 1;
      continue;
    }
    findings.push({ kind: 'stat-delta-mismatch', stat, oldVal, newVal });
  }
}

function compareAc(canonical, legacy, findings) {
  if (canonical.itemType !== 'armor') return;
  const rawAc = String(legacy.ac || '').trim();
  const m = /^\s*([+-]?)(\d+)\s*$/.exec(rawAc);
  if (!m) { findings.push({ kind: 'ac-unparseable', rawAc }); return; }
  const oldContribution = canonical.armor.additive ? { flatAmount: parseInt(m[2], 10) } : { replaceBase: parseInt(m[2], 10) };
  const newContribution = canonicalAcContribution(canonical);
  if (JSON.stringify(oldContribution) !== JSON.stringify(newContribution)) {
    findings.push({ kind: 'ac-contribution-mismatch', oldContribution, newContribution });
  }
}

function compareWeaponAttack(canonical, legacy, findings) {
  if (canonical.itemType !== 'weapon') return;
  const dmgMatch = String(legacy.dmg || '').match(/^\s*(\d+)d(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i);
  const dmgEmbeddedMod = dmgMatch && dmgMatch[3] ? parseInt(dmgMatch[3] + dmgMatch[4], 10) : 0;
  const { atkBonus: oldAtkBonus, dmgBonus: textDmgBonus } = parseWeaponEffectBonuses(legacy.effect);
  // Mirrors the OLD LIVE (pre-fix) computeWeaponAttackRoll exactly: sums the dice-embedded
  // modifier AND the text-derived damage bonus independently, with no reconciliation at all —
  // this is deliberately the buggy behavior, so the comparison below can tell "matches the
  // documented fix" apart from "something else changed."
  const oldLiveDmgBonus = dmgEmbeddedMod + textDmgBonus;
  const bridged = canonicalWeaponAttackData(canonical);

  if (oldAtkBonus !== bridged.atkBonus) {
    // Documented, intentional divergence (Phase 13): a genuine name-tagged "Masterwork" weapon
    // (e.g. "Masterwork Longsword") gets a real +1 attackRoll from the materials system — new game
    // design with no prior live behavior to preserve (see mechanics/data/material-modifiers.js's
    // own header) — on TOP of whatever the old regex path already found. This also surfaced a
    // real, separate live bug while validating it: parseWeaponEffectBonuses's guard clause
    // (excluding "when/while/with/made/only" right after "to attack rolls") means the live app
    // ALSO fails to parse "+1 to attack rolls only (not damage)" at all (oldAtkBonus ends up 0)
    // even though that phrasing is an unconditional bonus, not a conditional one the guard was
    // meant to exclude — a pre-existing gap this migration doesn't fix in the live regex path
    // itself, only bypasses for the item's own real mechanic via the materials system instead.
    if (/masterwork/i.test(legacy.name) && bridged.atkBonus === oldAtkBonus + 1) {
      expectedFixes.masterworkAttackBonus = (expectedFixes.masterworkAttackBonus || 0) + 1;
    } else {
      findings.push({ kind: 'attack-bonus-mismatch', oldAtkBonus, newAtkBonus: bridged.atkBonus });
    }
  }
  if (oldLiveDmgBonus === bridged.dmgBonus) return; // no double-count in this item; must agree exactly
  // Documented fix: old dmg field's embedded modifier and the text bonus were the SAME number
  // (redundant phrasing) — migrateWeapon applies it once. Confirm the fixed value truly is "one
  // copy of the redundant number," not just "different."
  if (dmgEmbeddedMod && dmgEmbeddedMod === textDmgBonus && bridged.dmgBonus === dmgEmbeddedMod) {
    expectedFixes.weaponDamageDedup++;
    return;
  }
  findings.push({ kind: 'damage-bonus-mismatch', oldLiveDmgBonus, newDmgBonus: bridged.dmgBonus, dmgEmbeddedMod, textDmgBonus });
}

function compareConsumableHeal(canonical, legacy, findings) {
  if (canonical.itemType !== 'consumable') return;
  const oldHp = String(legacy.hp || '').trim();
  const oldIsDiceFormula = /\d+\s*d\s*\d+/i.test(oldHp);
  const newHealDice = canonicalConsumableHealDice(canonical);
  if (oldIsDiceFormula && !newHealDice) {
    findings.push({ kind: 'consumable-heal-dropped', oldHp });
  } else if (oldIsDiceFormula && newHealDice && newHealDice.replace(/\s+/g, '') !== oldHp.replace(/\s+/g, '')) {
    findings.push({ kind: 'consumable-heal-value-mismatch', oldHp, newHealDice });
  } else if (!oldIsDiceFormula && newHealDice) {
    findings.push({ kind: 'consumable-heal-invented', oldHp, newHealDice });
  }
}

for (const canonical of canonicalItems) {
  const legacy = findLegacyItem(canonical);
  if (!legacy) continue; // npc-data.js items, or anything not traceable back 1:1 — out of scope here
  checked++;
  const findings = [];
  compareStatDeltas(canonical, legacy, findings);
  compareAc(canonical, legacy, findings);
  compareWeaponAttack(canonical, legacy, findings);
  compareConsumableHeal(canonical, legacy, findings);
  if (findings.length) unexpected.push({ name: canonical.name, tier: canonical.rarity, itemType: canonical.itemType, findings });
}

console.log(`Checked ${checked} migrated items against the live regex path they replace.`);
console.log(`Expected, documented fixes/additions confirmed: ${expectedFixes.armorAcDedup} armor AC dedup, ${expectedFixes.weaponDamageDedup} weapon damage dedup, ${expectedFixes.armorAcTotalRecapDrop || 0} AC "total" recap drop, ${expectedFixes.masterworkAttackBonus || 0} masterwork attackRoll addition.`);
if (unexpected.length) {
  console.log(`\n${unexpected.length} item(s) with UNEXPECTED divergence between old and new:`);
  for (const u of unexpected) {
    console.log(`  - ${u.name} (${u.tier} ${u.itemType}): ${JSON.stringify(u.findings)}`);
  }
  process.exit(1);
} else {
  console.log('\nNo unexpected divergences. Every migrated item\'s bridge either matches the old path exactly, or matches one of this script\'s documented, intentional divergence categories.');
}
