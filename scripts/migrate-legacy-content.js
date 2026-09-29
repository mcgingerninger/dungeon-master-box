#!/usr/bin/env node
// One-time developer migration tool: converts dungeon-master-box's existing catalog (loot-data.js)
// into canonical structured items on the V2 mechanics schema (mechanics/engine).
// See docs/V2_MECHANICS_MIGRATION.md for the full plan this implements.
//
// SCOPE (confirmed narrow-start, expanded phase by phase): Phase 1 covered type === 'weapon' and
// type === 'armor' (688 of loot-data.js's 1,243 items). Phase 2 added type === 'consumable' (65
// items). Phase 3 added type === 'misc' (404 items), split between a new 'wondrous' itemType and
// the existing 'tool' itemType (see the Phase 3 comment above migrateMisc for why). Phase 4 adds the
// remaining types — type === 'companion' (68 items, a new 'companion' itemType — pets/mounts) and
// type === 'treasure'/'questitem'/'document' (86 items total, mapped onto the existing 'tool'
// itemType since dungeon-master-box's own data describes them as mechanically inert). Every
// loot-data.js item is now migrated. This script never writes to loot-data.js itself.
//
// THIS IS NOT PART OF THE RUNTIME APP. Run it manually (`node scripts/migrate-legacy-content.js`)
// whenever loot-data.js's migrated-type entries change; it is deterministic (no Math.random
// anywhere in the derivation — computeItemWeight's "randomness" is a stable hash of the item's own
// name, matching the existing app's own convention; a dice-notation charges count is likewise
// resolved with a deterministic hash roll instead of a true random one, flagged when it happens) —
// running it twice against the same source produces byte-identical output. It writes:
//   - mechanics/canonical/items.json   — the canonical structured items (the new runtime source
//     for these items once a later phase wires the app onto it; nothing reads this file today)
//   - mechanics/canonical/migration-report.md  — Section 20/27 report: counts, every ambiguous
//     item found, every material modifier applied, and content-preservation confirmation
//
// REUSE, NOT REINVENTION (confirmed approach): every structured value this script derives comes
// from dungeon-master-box's OWN existing parsing logic — classifyItemHierarchy,
// itemRequiresAttunement, extractStatDeltasFromText, and extractStatSetValuesFromText are imported
// directly from game-engine.js (already a proper ES module). classifySubcategory and
// computeItemWeight are not exported from game-engine.js (they live in the monolith HTML), so
// they're ported verbatim below rather than reimplemented — see PORTED section.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import {
  classifyItemHierarchy,
  itemRequiresAttunement,
  extractStatDeltasFromText,
  extractStatSetValuesFromText,
} from '../game-engine.js';
import { validateItem } from '../mechanics/engine/items/validate-item.js';
import { applyModifierToItem } from '../mechanics/engine/items/modifiers.js';
import { MATERIAL_MODIFIERS } from '../mechanics/data/material-modifiers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ============================== Load loot-data.js without modifying it =======================
// loot-data.js is loaded via <script src> by the live monolith (a classic, non-module script) —
// it deliberately has no `export` statement, and must never gain one, or the live app breaks.
// Loaded here with Node's vm module instead: read as text, executed in an isolated context, and
// the resulting `lootData` global captured — zero changes to the file itself.
function loadLootData() {
  const src = fs.readFileSync(path.join(ROOT, 'loot-data.js'), 'utf8');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'loot-data.js' });
  // `const lootData = ...` is a lexical binding in the context's global scope, not an own
  // property of `sandbox` — a second runInContext call in the SAME context can still read it as
  // an expression's completion value, since context lexical scope persists across calls.
  const lootData = vm.runInContext('lootData', sandbox);
  if (!lootData) throw new Error('loot-data.js did not define `lootData`');
  return lootData;
}

// Same vm-loading technique, same reason: npc-data.js is also a classic (non-module) script the
// live monolith loads via <script src>, with no export statement of its own that must never gain
// one. NPC_WEAPONS is the one piece of npc-data.js that's real item content (the rest — NPC_LIBRARY,
// NPC_COMBAT_DEFS, NPC_CONNECTIONS — is creature/relationship content, not item content, and out of
// this migration's scope; see docs/V2_MECHANICS_MIGRATION.md's "Not yet done" section).
function loadNpcWeapons() {
  const src = fs.readFileSync(path.join(ROOT, 'npc-data.js'), 'utf8');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'npc-data.js' });
  const npcWeapons = vm.runInContext('NPC_WEAPONS', sandbox);
  if (!npcWeapons) throw new Error('npc-data.js did not define `NPC_WEAPONS`');
  return npcWeapons;
}

// ============================== PORTED verbatim from the monolith =============================
// Not exported by game-engine.js — copied here rather than reimplemented, per the confirmed
// "reuse existing parsers" approach. Source: dungeon_loot_wheel_v102_spell_details.html.

function classifySubcategory(name, type, rarity, desc) {
  const n = (name || '').toLowerCase();
  if (type === 'armor') {
    if (/shield/.test(n)) return 'offhand';
    if (/helm|crown|circlet|hood|diadem|tiara|coronet|headband|\bcap\b/.test(n)) return 'head';
    if (/goggles|lens|spectacles|monocle|eyepatch|blindfold|veil|\bmask\b/.test(n)) return 'facewear';
    if (/cloak|cape|mantle|wings/.test(n)) return 'cloak';
    if (/belt|girdle|sash/.test(n)) return 'belt';
    if (/boots|sandals|slippers/.test(n)) return 'boots';
    if (/leggings|pants|greaves/.test(n)) return 'leggings';
    if (/gauntlet|glove|bracer|handwrap/.test(n)) return 'handwear';
    if (desc) {
      const d = desc.toLowerCase();
      if (/\bcape\b/.test(d)) return 'cloak';
      if (/\bhood\b/.test(d)) return 'head';
      if (/\bmask\b/.test(d)) return 'facewear';
      if (/gauntlet|glove|bracer|handwrap/.test(d)) return 'handwear';
      if (/boots|sandals|slippers/.test(d)) return 'boots';
      if (/leggings|pants|greaves/.test(d)) return 'leggings';
      if (/belt|girdle|sash/.test(d)) return 'belt';
    }
    return 'chest';
  }
  if (type === 'weapon') {
    if (/hand crossbow/.test(n)) return 'onehanded';
    if (/bow\b|crossbow|\bpike\b|halberd|glaive|trident|\bspear\b|warhammer|great.?axe|great.?sword|great.?club|maul\b|zweihander|polearm|lance\b/.test(n)) return 'twohanded';
    return 'onehanded';
  }
  if (type === 'consumable') {
    if (/scroll/.test(n)) return 'scroll';
    if (/potion|draught|elixir|tonic|\bvial\b|\boil\b|philter|\bbrew\b/.test(n)) return 'potion';
    if (/bomb|grenade|flask|\bdart\b|\bdust\b|powder/.test(n)) return 'throwable';
    return 'food';
  }
  if (type === 'misc') {
    if (/\bring\b/.test(n)) return 'ring';
    if (/amulet|necklace|pendant|periapt|\btorc\b|gorget|holy symbol|talisman|locket|brooch|medallion/.test(n)) return 'amulet';
    return miscTierSubcategory(rarity);
  }
  if (type === 'treasure') {
    if (/\bgem\b|ruby|quartz|sapphire|emerald|diamond|opal|topaz|garnet/.test(n)) return 'gem';
    if (/crown|scepter|circlet|tiara|regalia/.test(n)) return 'regalia';
    if (/necklace|bracelet|earring|jewel/.test(n)) return 'jewelry';
    if (/statue|painting|sculpture|tapestry/.test(n)) return 'art';
    if (/\bbar\b|ingot/.test(n)) return 'currencybar';
    return 'currency';
  }
  if (type === 'questitem') {
    if (/\bkey\b/.test(n)) return 'key';
    if (/sigil|seal|pass\b|token/.test(n)) return 'accesstoken';
    if (/rune|puzzle|mechanism|\bsymbol\b/.test(n)) return 'puzzleobject';
    return 'questobject';
  }
  if (type === 'document') {
    if (/journal|diary/.test(n)) return 'journal';
    if (/letter/.test(n)) return 'letter';
    if (/\bmap\b/.test(n)) return 'map';
    if (/recipe|blueprint|formula|contract|decree/.test(n)) return 'formula';
    return 'book';
  }
  if (type === 'companion') {
    if (/mount|steed|charger|warhorse|destrier|palfrey|pony/.test(n)) return 'mount';
    return 'pet';
  }
  return '';
}

// Ported verbatim — buckets any non-ring/amulet misc item into one of three subcategories by
// rarity tier instead of one flat bucket. Unknown/missing rarity falls back to Common Misc rather
// than guessing.
function miscTierSubcategory(rarity) {
  if (rarity === 'rare' || rarity === 'superrare') return 'rareMisc';
  if (rarity === 'legendary' || rarity === 'celestial') return 'wondrousMisc';
  return 'commonMisc';
}

// Full verbatim table (dungeon_loot_wheel_v102_spell_details.html) — only the weapon/armor entries
// were needed for Phase 1; potion/scroll/food/throwable are used starting with Phase 2
// (consumables). Ported in full now rather than patched piecemeal, to keep this a genuine verbatim
// copy of the source rather than a hand-picked subset.
const WEIGHT_RANGE_BY_SUBCATEGORY = {
  head: [1, 4], facewear: [0.2, 1], chest: [6, 40], cloak: [1, 3], belt: [0.5, 2],
  boots: [1, 4], leggings: [2, 8], handwear: [0.5, 2], offhand: [4, 12],
  onehanded: [1, 8], twohanded: [6, 20],
  potion: [0.5, 1.5], scroll: [0.02, 0.1], food: [0.3, 3], throwable: [0.5, 2],
  ring: [0.05, 0.3], amulet: [0.2, 1], charm: [0.1, 2], commonMisc: [0.1, 2], rareMisc: [0.1, 2.5], wondrousMisc: [0.1, 3],
  pet: [0, 0], mount: [0, 0],
  arm: [4, 15], hand: [1, 4], leg: [5, 18], foot: [1, 4],
  eye: [0.1, 1], ear: [0.1, 1], finger: [0.1, 0.5], heart: [0.3, 1.5], tongue: [0.2, 1],
  monsterpart: [0.2, 12],
  journal: [0.5, 2], letter: [0.02, 0.2], map: [0.05, 0.5], book: [1, 5], formula: [0.05, 0.5],
  gem: [0.02, 0.3], jewelry: [0.1, 1], art: [5, 25], currency: [0.1, 2], currencybar: [1, 10], regalia: [0.5, 3],
  key: [0.05, 0.5], accesstoken: [0.02, 0.3], puzzleobject: [0.2, 3], questobject: [0.2, 5],
};
const HEAVY_WEAPON_KEYWORDS = /massive|giant'?s|titan|colossal|great.?axe|great.?sword|great.?club|maul|warhammer|zweihander|bonecrusher|earthbreaker|juggernaut|siege/i;
const HEAVY_WEAPON_RANGE = [15, 50];

function hashItemName(str) {
  let h = 0;
  const s = String(str || 'item');
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

function computeItemWeight(item, subcategory) {
  const sub = subcategory || classifySubcategory(item.name, item.type, item.rarity, item.desc);
  let range = WEIGHT_RANGE_BY_SUBCATEGORY[sub];
  if (!range) return 0;
  if (item.type === 'weapon') {
    const text = ((item.name || '') + ' ' + (item.desc || '') + ' ' + (item.effect || '')).toLowerCase();
    if ((item.slotSize || 1) >= 3 || HEAVY_WEAPON_KEYWORDS.test(text)) range = HEAVY_WEAPON_RANGE;
  }
  const t = (hashItemName(item.name) % 1000) / 1000;
  let w = range[0] + t * (range[1] - range[0]);
  if (w >= 10) w = Math.round(w);
  else if (w >= 1) w = Math.round(w * 2) / 2;
  else w = Math.round(w * 20) / 20;
  return w;
}

// Same regex shapes as computeWeaponAttackRoll/parseWeaponEffectBonuses (monolith HTML,
// dungeon_loot_wheel_v102_spell_details.html) — reused so this migration's flat attack/damage
// bonus and bonus-elemental-dice extraction matches the live app's own current behavior exactly.
function parseWeaponEffectBonuses(effect) {
  const t = String(effect || '');
  let atkBonus = 0, dmgBonus = 0;
  const guardSrc = '\\b(?!\\s*(when|while|with|made|only))';
  const comboMatch = t.match(new RegExp('\\+(\\d+)\\s+to (?:all )?attack and damage rolls' + guardSrc, 'i'));
  if (comboMatch) {
    atkBonus += parseInt(comboMatch[1], 10);
    dmgBonus += parseInt(comboMatch[1], 10);
  } else {
    const atkMatch = t.match(new RegExp('\\+(\\d+)\\s+to attack rolls' + guardSrc, 'i'));
    if (atkMatch) atkBonus += parseInt(atkMatch[1], 10);
    const dmgMatch = t.match(new RegExp('\\+(\\d+)\\s+to damage rolls' + guardSrc, 'i'));
    if (dmgMatch) dmgBonus += parseInt(dmgMatch[1], 10);
  }
  const bonusDiceClauses = [];
  const bonusDiceRe = /(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+([a-z]+)?\s*damage/gi;
  let dm;
  while ((dm = bonusDiceRe.exec(t)) !== null) {
    bonusDiceClauses.push({ dice: dm[1].replace(/\s+/g, ''), type: (dm[2] || '').toLowerCase() });
  }
  return { atkBonus, dmgBonus, bonusDiceClauses };
}

// ============================== NEW: weapon damage-type / proficiency-category derivation ======
// Legacy dungeon-master-box has NO base damage-type or simple/martial-proficiency concept for
// weapons at all — confirmed by reading computeWeaponAttackRoll directly: it rolls item.dmg with
// no damage type anywhere in the mundane-weapon attack path (damage type only ever appears via
// elemental-damage text riders, parsed above, or in monster stat-block prose). V2's schema
// requires both, so this migration derives them from the same name-matching vocabulary
// classifyItemHierarchy's own weapon branch already uses (game-engine.js), refined further where
// that branch's classification leaf isn't precise enough (e.g. "Polearm" covers both slashing
// glaives/halberds and piercing pikes/lances) — mirroring the SAME cascade order and keyword
// choices, not inventing a new taxonomy. Standard 5e PHB weapon table facts (e.g. "a dagger deals
// piercing damage," "a shortsword is martial"), not guesses. Returns weaponCategory: null when no
// pattern matches with confidence — the migration script flags these rather than defaulting them.
function deriveWeaponMechanics(name) {
  const n = (name || '').toLowerCase();
  // [regex, damageType, weaponCategory]
  // NOTE on word boundaries: this catalog frequently smashes a base weapon word onto a prefix
  // with no space ("Battleaxe", "Quarterstaff", "Dragonlance", "Oathbow", "Moonblade") — the same
  // thing classifySubcategory's own comment already documents fixing for bow/lance/maul ("dropped
  // their LEADING \b, kept the trailing one... this catalog names bows/mauls as one smashed-
  // together word"). Applied consistently below for every suffix-style base weapon keyword rather
  // than only the three classifySubcategory happened to need, since this is brand-new derivation
  // logic (not a change to any existing behavior) and getting common weapons like Battleaxe/
  // Quarterstaff wrong would undermine confidence in the rest of the migration.
  const rules = [
    [/\bclaw/, 'slashing', null], [/\bbite\b|\bfang|\btooth\b|\btusk/, 'piercing', null],
    [/\btalon/, 'slashing', null], [/\bhorn\b/, 'piercing', null], [/\btail\b/, 'bludgeoning', null],
    [/\bsting/, 'piercing', null], [/\bslam\b|\bmaw\b|\bram\b/, 'bludgeoning', null],
    [/sling\b/, 'bludgeoning', 'simple'], [/blowgun/, 'piercing', 'martial'],
    [/hand crossbow/, 'piercing', 'martial'], [/heavy crossbow/, 'piercing', 'martial'],
    [/crossbow/, 'piercing', 'simple'],
    [/throwing knife|throwing dagger/, 'piercing', 'simple'], [/throwing axe/, 'slashing', 'simple'],
    [/javelin/, 'piercing', 'simple'], [/shuriken/, 'piercing', 'martial'],
    [/longbow|greatbow/, 'piercing', 'martial'], [/shortbow|bow\b/, 'piercing', 'simple'],
    [/whip\b/, 'slashing', 'martial'], [/\bchain\b(?!\s*mail)/, 'bludgeoning', 'martial'],
    [/morningstar/, 'piercing', 'martial'], [/kusarigama/, 'slashing', 'martial'],
    [/kukri/, 'slashing', 'simple'],
    [/great.?sword|zweihander/, 'slashing', 'martial'], [/great.?axe/, 'slashing', 'martial'],
    [/great.?club|great.?hammer|maul\b/, 'bludgeoning', 'martial'],
    [/halberd|glaive/, 'slashing', 'martial'], [/pike\b|lance\b/, 'piercing', 'martial'],
    [/polearm/, 'piercing', 'martial'],
    [/staff\b/, 'bludgeoning', 'simple'],
    [/rapier/, 'piercing', 'martial'], [/scimitar|saber|falchion/, 'slashing', 'martial'],
    [/shortsword/, 'piercing', 'martial'],
    [/dagger|knife\b|dirk|stiletto/, 'piercing', 'simple'],
    [/light hammer/, 'bludgeoning', 'simple'], [/hand ?axe/, 'slashing', 'simple'],
    [/war pick|pick\b/, 'piercing', 'martial'], [/hammer/, 'bludgeoning', 'martial'],
    [/axe\b|hatchet/, 'slashing', 'martial'],
    [/greatclub/, 'bludgeoning', 'simple'], [/mace\b/, 'bludgeoning', 'simple'],
    [/flail\b/, 'bludgeoning', 'martial'], [/club\b/, 'bludgeoning', 'simple'],
    [/sickle\b/, 'slashing', 'simple'],
    [/trident/, 'piercing', 'martial'], [/spear|pike\b/, 'piercing', 'simple'],
    [/sword|blade\b/, 'slashing', 'martial'],
  ];
  for (const [re, damageType, weaponCategory] of rules) {
    if (re.test(n)) return { damageType, weaponCategory };
  }
  return { damageType: null, weaponCategory: null };
}

function deriveWeaponProperties(name, effect, subcategory) {
  const props = [];
  if (/finesse/i.test(effect || '')) props.push('finesse');
  if (subcategory === 'twohanded') props.push('two-handed');
  if (/thrown|throwing/i.test(name || '')) props.push('thrown');
  if (/versatile/i.test(effect || '')) props.push('versatile');
  if (/\bammunition\b/i.test(effect || '') || /\bbow\b|crossbow|\bsling\b/i.test(name || '')) props.push('ammunition');
  if (/\breach\b/i.test(effect || '')) props.push('reach');
  return props;
}

// ============================== Stat name mapping (legacy full name -> V2 StatModifier key) ====
// extractStatDeltasFromText/extractStatSetValuesFromText (game-engine.js) return the SAME closed
// vocabulary already used by dungeon-master-box's own SHEET_STAT_ALIASES/ABILITY_NAMES — every key
// they can possibly produce is covered below, so nothing falls through as "unrecognized" in
// practice. 'Saving Throws' (a flat bonus to ALL six saves at once in the legacy engine) has no
// single V2 equivalent — expanded here into six explicit save_<abbr> entries rather than dropped,
// so the resulting mechanics are equivalent, just explicit instead of implicit.
const STAT_NAME_MAP = {
  'Strength': 'str', 'Dexterity': 'dex', 'Constitution': 'con',
  'Intelligence': 'int', 'Wisdom': 'wis', 'Charisma': 'cha',
  'Maximum Hit Points': 'hp_max', 'Armor Class': 'ac', 'Movement Speed': 'speed',
};
const SAVE_ABBRS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function toStatModifiers(deltas) {
  const mods = [];
  for (const { stat, amount } of deltas) {
    if (stat === 'Saving Throws') {
      for (const abbr of SAVE_ABBRS) mods.push({ stat: `save_${abbr}`, value: amount });
    } else if (STAT_NAME_MAP[stat]) {
      mods.push({ stat: STAT_NAME_MAP[stat], value: amount });
    } else {
      // Exact skill name (SKILL_ABILITY_MAP) — V2's StatModifier vocabulary accepts these verbatim.
      mods.push({ stat, value: amount });
    }
  }
  return mods;
}

// Set-value overrides ("Strength set to 29") don't have a direct StatModifier equivalent (a
// StatModifier is always additive) — flagged as ambiguous rather than silently approximated,
// since "raise to at least N, but never lower" is a different mechanic than "+N".
function findSetValueOverrides(effect) {
  return extractStatSetValuesFromText(effect || '');
}

// ============================== Residual-mechanical-language scan (Section 27) =================
// After extracting every bonus this script knows how to recognize, scan what's LEFT of the effect
// text for language suggesting more mechanical content this migration didn't capture — conditional
// riders ("while mounted"), resistances, advantage/disadvantage, rerolls, extra attacks, and other
// D&D mechanical vocabulary. Doesn't block the item from being migrated (its confirmed mechanics
// and full original flavorText are preserved regardless) — just flags it for a human to review,
// per Section 27's "don't silently guess, report explicitly" rule.
const RESIDUAL_MECHANICAL_PATTERN = /\bresist(ance)?\b|\bimmune\b|\bimmunity\b|\badvantage\b|\bdisadvantage\b|\breroll\b|\bextra attack\b|\bregenerat|\bteleport\b|\binvisib|\bfly speed\b|\bdarkvision\b|\btruesight\b|\bcritical hit\b|\bonce per turn\b|\bwhile mounted\b|\bwhen (fired|thrown|worn)\b|spell attack|\bsave dc\b|\bconcentration\b/i;

function scanResidualLanguage(effect, consumedSpans) {
  if (!effect) return false;
  let remaining = effect;
  for (const span of consumedSpans) {
    if (span) remaining = remaining.replace(span, ' ');
  }
  return RESIDUAL_MECHANICAL_PATTERN.test(remaining);
}

// ============================== Material detection + application ===============================
const MATERIAL_PATTERNS = {
  silvered: /silvered/i,
  mithral: /mithral/i,
  adamantine: /adamantine/i,
  masterwork: /masterwork/i,
};

function applyMaterialModifiers(item, name, desc, effect) {
  const text = `${name} ${desc || ''} ${effect || ''}`;
  const appliedNames = [];
  let current = item;
  for (const [key, pattern] of Object.entries(MATERIAL_PATTERNS)) {
    if (!pattern.test(text)) continue;
    const modifier = MATERIAL_MODIFIERS[key];
    if (!modifier.appliesTo.includes(current.itemType)) continue; // e.g. silvered armor: no rule for it, skip
    const applied = applyModifierToItem({ ...current, name: item.name }, modifier);
    if (applied) {
      // Keep the item's real migrated name; only take the mechanical changes + appliedModifiers
      // tag from applyModifierToItem, not its cosmetic "{base} (Material)" renaming — the original
      // catalog item's own authored name (which usually already says "Mithral"/"Adamantine" etc.
      // in-line) is the content-authority name and must not be altered by this migration.
      current = { ...applied, name: current.name };
      appliedNames.push(modifier.name);
    }
  }
  return { item: current, appliedNames };
}

// ============================== ID generation ===================================================
function slugify(name) {
  return String(name).toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function makeIdGenerator() {
  const seen = new Map();
  return function nextId(name) {
    const base = slugify(name) || 'item';
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };
}

// ============================== Per-item migration ==============================================
function migrateWeapon(item, tier, index, nextId, ambiguous, fixes) {
  const name = item.name;
  const desc = item.desc || '';
  const effect = item.effect || '';
  const subcategory = classifySubcategory(name, 'weapon', tier, desc);
  const classification = classifyItemHierarchy({ ...item, subcategory }, tier);

  const dmgMatch = /^\s*(\d+)d(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i.exec(String(item.dmg || ''));
  if (!dmgMatch) {
    ambiguous.push({ name, tier, reason: 'no parseable weapon.dmg dice notation — excluded from this migration pass', legacyDmg: item.dmg ?? null });
    return null;
  }
  const dmgEmbeddedMod = dmgMatch[3] ? parseInt(dmgMatch[3] + dmgMatch[4], 10) : 0;
  const damageDice = `${dmgMatch[1]}d${dmgMatch[2]}`; // base dice only — any embedded flat
  // modifier (e.g. "1d8+1" on a "+1" catalog weapon) is reconciled against parseWeaponEffectBonuses'
  // dmgBonus below rather than kept in the dice string, since dungeon-master-box's OWN
  // computeWeaponAttackRoll sums a dmg-field-embedded modifier AND a redundant "+1 to attack and
  // damage rolls" effect-text phrase independently today — a real, already-live double-counting
  // bug (confirmed directly against loot-data.js's "Longsword +1": dmg:"1d8+1" +
  // effect:"+1 to attack and damage rolls..."), not something to faithfully reproduce (Section 19:
  // "differences must be investigated before the old behavior is replaced" — this one was, and the
  // double-count isn't the intended design, the redundant phrasing is just how it was authored).

  const { damageType, weaponCategory } = deriveWeaponMechanics(name);
  if (!damageType) {
    ambiguous.push({ name, tier, reason: 'could not determine damage type from name — defaulted to bludgeoning (5e\'s generic/improvised fallback), needs manual review', classification });
  }
  if (!weaponCategory) {
    ambiguous.push({ name, tier, reason: 'could not determine simple/martial proficiency category from name — left unset', classification });
  }

  const { atkBonus, dmgBonus: textDmgBonus, bonusDiceClauses } = parseWeaponEffectBonuses(effect);
  let dmgBonus = textDmgBonus;
  if (dmgEmbeddedMod && textDmgBonus && dmgEmbeddedMod !== textDmgBonus) {
    // Genuinely conflicting numbers (not just redundant phrasing of the same bonus) — don't guess
    // which one is authoritative, flag it and prefer the structured dmg field.
    ambiguous.push({ name, tier, reason: `weapon.dmg's embedded modifier (${dmgEmbeddedMod >= 0 ? '+' : ''}${dmgEmbeddedMod}) does not match the effect text's "+N to damage rolls" (+${textDmgBonus}) — used the dmg field's value, needs manual review`, effect, legacyDmg: item.dmg });
    dmgBonus = dmgEmbeddedMod;
  } else if (dmgEmbeddedMod) {
    // Either textDmgBonus was 0 (bonus only ever existed in the dice string) or it matched exactly
    // (the common "1d8+1" + "+1 to attack and damage rolls" redundant-phrasing case) — either way
    // the embedded modifier is the single source of truth; never add textDmgBonus on top of it.
    dmgBonus = dmgEmbeddedMod;
    if (textDmgBonus === dmgEmbeddedMod) {
      fixes.push({ name, tier, kind: 'double-counted damage bonus', detail: `weapon.dmg ("${item.dmg}") and effect text both expressed the same +${dmgEmbeddedMod} damage bonus; dungeon-master-box's live computeWeaponAttackRoll sums both independently today (a real double-count) — this migration applies it once.` });
    }
  }

  const deltas = extractStatDeltasFromText(effect);
  const setOverrides = findSetValueOverrides(effect);
  if (setOverrides.length) {
    ambiguous.push({ name, tier, reason: `effect text sets an absolute ability score ("${setOverrides.map(o => `${o.stat} to ${o.value}`).join(', ')}") — no direct StatModifier equivalent (StatModifier is always additive), needs manual review`, effect });
  }

  const passive = toStatModifiers(deltas);
  if (atkBonus) passive.push({ stat: 'attackRoll', value: atkBonus });
  if (dmgBonus) passive.push({ stat: 'damageRoll', value: dmgBonus });

  const properties = deriveWeaponProperties(name, effect, subcategory);
  if (subcategory === 'onehanded' && /versatile/i.test(effect)) {
    // versatileDice not derivable from free text with confidence beyond the base die; flagged.
    ambiguous.push({ name, tier, reason: 'effect text mentions "versatile" but no reliable versatileDice could be derived — property recorded, versatileDice omitted', effect });
  }

  let weapon = {
    damageDice,
    damageType: damageType || 'bludgeoning',
    ...(weaponCategory ? { weaponCategory } : {}),
    ...(properties.length ? { properties } : {}),
    ...(bonusDiceClauses.length ? { bonusDamage: bonusDiceClauses.map(c => ({ dice: c.dice, type: c.type || 'force' })) } : {}),
  };

  let canonical = {
    id: nextId(name),
    name,
    itemType: 'weapon',
    rarity: tier,
    weight: computeItemWeight(item, subcategory),
    ...(item.gp && item.gp !== '—' ? { value: item.gp } : {}),
    ...(desc ? { flavorText: desc } : {}),
    ...(itemRequiresAttunement(item) ? { requiresAttunement: true } : {}),
    weapon,
    ...(passive.length ? { passive } : {}),
    ...(item.unlocks ? { narrative: { unlocks: item.unlocks } } : {}),
    legacySource: { tier, index, name },
  };

  const materialResult = applyMaterialModifiers(canonical, name, desc, effect);
  canonical = materialResult.item;

  if (scanResidualLanguage(effect, [
    atkBonus ? /\+\d+\s+to (?:all )?attack/i.exec(effect)?.[0] : null,
    dmgBonus ? /\+\d+\s+to damage rolls/i.exec(effect)?.[0] : null,
    ...bonusDiceClauses.map(c => new RegExp(c.dice.replace(/([+*?^$.()|[\]{}])/g, '\\$1')).exec(effect)?.[0]),
  ])) {
    ambiguous.push({ name, tier, reason: 'effect text contains mechanical-sounding language beyond what this migration extracts (resistance/advantage/reroll/conditional riders/etc.) — review effect text manually', effect });
  }

  return canonical;
}

function migrateArmor(item, tier, index, nextId, ambiguous, fixes) {
  const name = item.name;
  const desc = item.desc || '';
  const effect = item.effect || '';
  const subcategory = classifySubcategory(name, 'armor', tier, desc);
  const classification = classifyItemHierarchy({ ...item, subcategory }, tier);

  // classifySubcategory (verbatim-ported, kept byte-identical — its armor branch was only ever
  // validated as a WEIGHT-bucketing helper in the original app, never as a source of mechanical
  // truth) has no "shield synonym" pattern beyond the literal word "shield", and no neck-item
  // pattern at all in its armor branch (only its misc branch recognizes amulets) — so a "Buckler"
  // or an "Amulet of Natural Armor" both fall through to its 'chest' catch-all. That was harmless
  // in the original app (subcategory never fed AC math there, only weight), but THIS migration
  // reuses subcategory to decide isBodySlot/additive/slot below, which are real mechanics — left
  // uncorrected, these items would migrate as non-additive body armor, replacing a player's AC
  // with a flat 1 or 2 instead of adding it on top, a real regression from live behavior. Corrected
  // here with a narrow, additional name check (not by editing the verbatim-ported function itself)
  // — mirrors the classifiedAsWondrous correction already used the same way in migrateMisc.
  const isShieldByName = subcategory === 'chest' && /buckler|\btarge\b|pavise/i.test(name);
  const isNeckByName = subcategory === 'chest' && /amulet|necklace|pendant|periapt|\btorc\b|gorget|holy symbol|talisman|locket|brooch|medallion/i.test(name);
  if (isShieldByName || isNeckByName) {
    ambiguous.push({ name, tier, reason: `classifySubcategory's armor branch has no pattern for this name and defaulted it to 'chest' (body armor) — corrected to '${isShieldByName ? 'offhand (shield)' : 'amulet (neck)'}' by name, needs a one-time confirmation`, legacySubcategory: subcategory });
  }
  const effectiveSlotCategory = isShieldByName ? 'offhand' : isNeckByName ? 'amulet' : subcategory;

  const acMatch = /^\s*([+-]?)(\d+)\s*$/.exec(String(item.ac ?? ''));
  if (!acMatch) {
    ambiguous.push({ name, tier, reason: 'no parseable armor.ac value — excluded from this migration pass', legacyAc: item.ac ?? null });
    return null;
  }
  const acValue = parseInt(acMatch[2], 10);
  const isBodySlot = effectiveSlotCategory === 'chest';
  const additive = !isBodySlot;

  const SLOT_MAP = { offhand: 'shield', head: 'helmet', facewear: 'facewear', cloak: 'cloak', belt: 'beltwaist', boots: 'boots', leggings: 'leggings', handwear: 'handwear', chest: 'chest', amulet: 'amulet' };
  const slot = SLOT_MAP[effectiveSlotCategory] || 'chest';

  // Only the BODY armor slot ('chest') ever has its armorType actually read for mechanics
  // (addsDexMod/dexModCap in mechanics/engine/character/equipment.js's computeEquippedArmorClass —
  // every other slot, additive by definition, contributes only its flat baseAC regardless of
  // armorType). So only a genuine body-armor item with an unresolved weight class is worth
  // flagging as ambiguous; for every additive accessory slot (offhand/head/handwear/boots/
  // leggings/cloak/facewear/beltwaist) armorType is cosmetic only — best-effort from
  // classification when available, a harmless 'light' placeholder otherwise, never flagged.
  let armorType;
  if (effectiveSlotCategory === 'offhand') {
    armorType = 'shield';
  } else if (isBodySlot) {
    const leaf = classification[1]; // 'Heavy Armor'|'Medium Armor'|'Light Armor'|'Exotic Material'
    if (leaf === 'Heavy Armor') armorType = 'heavy';
    else if (leaf === 'Medium Armor') armorType = 'medium';
    else if (leaf === 'Light Armor') armorType = 'light';
    else {
      armorType = 'medium';
      ambiguous.push({ name, tier, reason: `could not determine body armor's weight class from name/desc (classified as "${classification.join(' > ')}") — defaulted to medium, needs manual review`, classification });
    }
  } else {
    const leaf = classification[1];
    armorType = leaf === 'Heavy Armor' ? 'heavy' : leaf === 'Medium Armor' ? 'medium' : 'light';
  }

  const addsDexMod = armorType !== 'heavy';
  const dexModCap = armorType === 'medium' ? 2 : undefined;

  const strengthMatch = /requires?\s+(\d+)\s+strength/i.exec(effect) || /strength requirement of\s+(\d+)/i.exec(effect);
  const strengthRequirement = strengthMatch ? parseInt(strengthMatch[1], 10) : undefined;
  const stealthDisadvantage = /stealth disadvantage|disadvantage on (?:\w+\s+)?stealth/i.test(effect) || undefined;
  // Stealth disadvantage / Strength requirement are body-armor-only 5e concepts — only worth
  // flagging for the actual chest slot, not a cosmetically-'heavy' accessory piece.
  if (isBodySlot && armorType === 'heavy' && stealthDisadvantage === undefined) {
    ambiguous.push({ name, tier, reason: 'heavy body armor with no explicit stealth-disadvantage language in its effect text — left unset rather than assumed, needs manual review', effect });
  }
  if (isBodySlot && armorType === 'heavy' && strengthRequirement === undefined) {
    ambiguous.push({ name, tier, reason: 'heavy body armor with no explicit Strength-requirement language in its effect text — left unset rather than assumed, needs manual review', effect });
  }

  const deltas = extractStatDeltasFromText(effect);
  const setOverrides = findSetValueOverrides(effect);
  if (setOverrides.length) {
    ambiguous.push({ name, tier, reason: `effect text sets an absolute ability score ("${setOverrides.map(o => `${o.stat} to ${o.value}`).join(', ')}") — no direct StatModifier equivalent, needs manual review`, effect });
  }
  const passive = toStatModifiers(deltas);
  // A "+N AC" text rider beyond the item's own structured ac field (a legacy convention seen on
  // some accessory items whose flavor grants a bonus on top of their base slot value) stacks as an
  // extra 'ac' passive source, matching the live app's own additive layering — NOT double-counted
  // against acValue itself, which came from the item's dedicated `ac` field, a different source.

  let armor = {
    armorType, baseAC: acValue, addsDexMod,
    ...(dexModCap ? { dexModCap } : {}),
    slot,
    ...(strengthRequirement !== undefined ? { strengthRequirement } : {}),
    ...(stealthDisadvantage ? { stealthDisadvantage: true } : {}),
    ...(additive ? { additive: true } : {}),
  };

  let canonical = {
    id: nextId(name),
    name,
    itemType: 'armor',
    rarity: tier,
    weight: computeItemWeight(item, effectiveSlotCategory),
    ...(item.gp && item.gp !== '—' ? { value: item.gp } : {}),
    ...(desc ? { flavorText: desc } : {}),
    ...(itemRequiresAttunement(item) ? { requiresAttunement: true } : {}),
    armor,
    ...(passive.length ? { passive } : {}),
    ...(item.unlocks ? { narrative: { unlocks: item.unlocks } } : {}),
    legacySource: { tier, index, name },
  };

  const materialResult = applyMaterialModifiers(canonical, name, desc, effect);
  canonical = materialResult.item;

  if (scanResidualLanguage(effect, [])) {
    ambiguous.push({ name, tier, reason: 'effect text contains mechanical-sounding language beyond what this migration extracts (resistance/advantage/reroll/conditional riders/etc.) — review effect text manually', effect });
  }

  return canonical;
}

// ============================== Consumables (Phase 2) ============================================
// Consumables are meaningfully messier than weapons/armor: most legacy entries have no `charges`
// field at all, and `effect` text is frequently branching/conditional prose (skill checks, saving
// throws, multi-clause "if X then Y, else Z" descriptions) that V2's OnUseEffect — a single
// {kind, healDice|damageDice+damageType|statMods, durationMs} shape — was never designed to
// represent. Rather than force-fitting that complexity into a kind it doesn't fit (Section 27:
// "do not invent a new mechanic merely to eliminate the warning"), this migration extracts ONLY
// what it can do with real confidence — a clean heal from a dice-notation `item.hp` field — and
// falls back to a flagged, mechanically-inert 'utility' effect (full original text preserved in
// flavorText) for everything else. This is intentionally narrower mechanical coverage than
// weapons/armor got; buff/debuff extraction from effect text and multi-effect items (e.g. a potion
// that both heals AND buffs simultaneously, which OnUseEffect's single-kind-per-entry shape can't
// represent as one effect) are explicitly left for a later phase — see docs/V2_MECHANICS_MIGRATION.md.

const CONSUMABLE_SUBCATEGORY_MAP = { potion: 'potion', scroll: 'scroll', food: 'food', throwable: 'thrown' };
const TOPICAL_PATTERN = /salve|ointment|balm|unguent/i;
const WOUND_APPLICATION_PATTERN = /appl(?:y|ied|ying)\s+(?:to|over)\s+(?:a\s+)?(?:wound|skin)/i;
const COATING_PATTERN = /^oil of|weapon (?:oil|coating)|coat(?:ed|ing)?\s+(?:a\s+|your\s+)?(?:weapon|blade)|appl(?:y|ied|ying)?.*(?:to a weapon|to your weapon|over.*blade)/i;

function deriveConsumableCategory(name, effect, subcategory) {
  const base = CONSUMABLE_SUBCATEGORY_MAP[subcategory] || 'other';
  // A clear topical/coating naming signal overrides classifySubcategory's coarse legacy bucket
  // (which has no topical/coating concept at all and falls back to 'food' for anything that isn't
  // obviously a potion/scroll/throwable — e.g. "Tinned Salve" would otherwise land in 'food').
  // Only ever overrides scroll/food/other buckets in practice, never 'thrown' — a coating/topical
  // item is never also a thrown weapon in this catalog.
  if (COATING_PATTERN.test(name) || COATING_PATTERN.test(effect || '')) return 'coating';
  if (TOPICAL_PATTERN.test(name) || WOUND_APPLICATION_PATTERN.test(effect || '')) return 'topical';
  return base;
}

// Legacy's own charges pipeline (ensureChargeFormat/rollChargeDiceText, monolith HTML) rolls a
// dice-notation charge count ONCE, the first time the item is touched, using true Math.random —
// and that roll becomes the item's fixed live count from then on. This migration needs the SAME
// "roll once, then fixed" outcome but must stay deterministic across runs (a hard requirement for
// this script), so it seeds that one-time roll from hashItemName instead of Math.random — the same
// deterministic-hash convention computeItemWeight already uses for exactly this reason. Every item
// whose charges required this substitution is flagged in the report for transparency, not hidden.
function resolveConsumableUses(charges, name, ambiguous, tier) {
  if (!charges) return { max: 1, note: null };
  const flat = /^\s*(\d+)\s*$/.exec(String(charges));
  if (flat) return { max: parseInt(flat[1], 10), note: null };
  const perPeriod = /^\s*(\d+)\s*\/\s*\w+/.exec(String(charges)); // e.g. "1/week"
  if (perPeriod) {
    ambiguous.push({ name, tier, reason: `charges "${charges}" implies a periodic refill (no V2 recharge concept for consumables) — used the flat count (${perPeriod[1]}) with no refill, matching dungeon-master-box's own current charge-counting behavior (it doesn't enforce the refill period either), needs manual review if refill matters`, charges });
    return { max: parseInt(perPeriod[1], 10), note: 'periodic' };
  }
  const diceMatch = /(\d+)\s*d\s*(\d+)\s*([+-]\s*\d+)?/i.exec(String(charges));
  if (diceMatch) {
    const n = parseInt(diceMatch[1], 10), sides = parseInt(diceMatch[2], 10);
    const mod = diceMatch[3] ? parseInt(diceMatch[3].replace(/\s+/g, ''), 10) : 0;
    // Deterministic stand-in for legacy's one-time random roll — see function comment.
    const roll = (hashItemName(name + ':charges') % sides) + 1;
    const total = Math.max(1, n * roll + mod); // n*roll is an approximation of an n-die sum, not a
    // true sum of n independent dice — acceptable for a one-time flavor quantity (how many
    // applications/beads an item has), not a live gameplay roll; flagged below regardless.
    ambiguous.push({ name, tier, reason: `charges "${charges}" is dice notation — legacy rolls this once with true randomness on first use; this migration rolled it once deterministically instead (result: ${total}) to keep the migration itself reproducible, needs manual review/reroll if the exact starting count matters`, charges });
    return { max: total, note: 'dice' };
  }
  const useWord = /^\s*(\d+)\s*use/i.exec(String(charges));
  if (useWord) return { max: parseInt(useWord[1], 10), note: null };
  return { max: 1, note: 'unparsed' };
}

function migrateConsumable(item, tier, index, nextId, ambiguous, fixes) {
  const name = item.name;
  const desc = item.desc || '';
  const effect = item.effect || '';
  const subcategory = classifySubcategory(name, 'consumable', tier, desc);
  const consumableCategory = deriveConsumableCategory(name, effect, subcategory);

  const { max: usesMax, note: usesNote } = resolveConsumableUses(item.charges, name, ambiguous, tier);
  if (usesNote === 'unparsed' && item.charges) {
    ambiguous.push({ name, tier, reason: `charges "${item.charges}" could not be parsed as a flat count, dice notation, or "N/period" — defaulted to 1 use, needs manual review`, charges: item.charges });
  }

  let effects = [];
  const healDiceMatch = /^\s*(\d+)d(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i.exec(String(item.hp || ''));
  if (item.hp && healDiceMatch) {
    const mod = healDiceMatch[3] ? `${healDiceMatch[3]}${healDiceMatch[4]}` : '';
    effects.push({ kind: 'heal', healDice: `${healDiceMatch[1]}d${healDiceMatch[2]}${mod}` });
  } else if (item.hp) {
    // "10 temp HP", "Full HP" — not dice notation; OnUseEffect's heal kind only adds healDice to
    // currentHp capped at maxHp, which can't represent temporary HP or "restore to full" (both real,
    // distinct 5e mechanics). Flagged rather than approximated as a plain heal (a plain heal of an
    // arbitrary die would misrepresent "full HP", and temp HP stacking has its own rules a simple
    // additive heal would get wrong).
    ambiguous.push({ name, tier, reason: `item.hp ("${item.hp}") is not plain dice notation (temporary HP or a full-heal phrasing) — OnUseEffect's heal kind can't represent this correctly, left as a utility placeholder, needs a schema extension or manual handling`, hp: item.hp });
    effects.push({ kind: 'utility' });
  } else {
    effects.push({ kind: 'utility' });
  }

  if (scanResidualLanguage(effect, [])) {
    ambiguous.push({ name, tier, reason: 'effect text contains mechanical-sounding language (damage/save/condition/duration) this migration does not yet extract into a structured effect — full text preserved in flavorText, needs manual review', effect });
  }

  const canonical = {
    id: nextId(name),
    name,
    itemType: 'consumable',
    rarity: tier,
    weight: computeItemWeight(item, subcategory),
    ...(item.gp && item.gp !== '—' ? { value: item.gp } : {}),
    ...(desc ? { flavorText: desc } : {}),
    ...(itemRequiresAttunement(item) ? { requiresAttunement: true } : {}),
    consumable: { consumableCategory, effects, uses: { max: usesMax }, usesLeft: usesMax },
    ...(item.unlocks ? { narrative: { unlocks: item.unlocks } } : {}),
    legacySource: { tier, index, name },
  };

  return canonical;
}

// ============================== Misc -> wondrous/tool split (Phase 3) ============================
// `type === 'misc'` is dungeon-master-box's largest and most heterogeneous bucket (404 items):
// everything from a plain torch or coil of rope to a legendary cloak with three tiers of Hidden
// Power. There is no single existing itemType this maps onto, so this migration adds a new one —
// `wondrous` (item-schema.js) — for anything with a real magical identity (a body slot, a passive
// bonus, or attunement), and routes everything else onto the EXISTING `tool` itemType rather than
// inventing a second new type for "misc gear with no mechanics" (a torch and a set of thieves'
// tools are both just mundane equipment; V2's own ToolData doc comment already anticipated an
// open-ended, free-form toolCategory for exactly this).
//
// classifySubcategory's own misc branch only ever returns 'ring'/'amulet'/a rarity-tier bucket — it
// has no concept of cloak/boots/gauntlets/etc. for non-armor-typed items at all. The REAL per-slot
// detection for those lives in classifyItemHierarchy's ungated accessory cascade (the same
// /\bboots\b|slippers|sandals/ etc. checks that run for any item regardless of `type`), which is
// reused here rather than re-derived.

const ACCESSORY_LEAF_TO_WONDROUS_SLOT = {
  Ring: 'ring', Neck: 'amulet', Back: 'cloak', Waist: 'beltwaist',
  Feet: 'boots', Hands: 'handwear', Head: 'helmet', Face: 'facewear',
};

function deriveWondrousSlot(classification) {
  if (classification[0] !== 'Accessory') return null;
  return ACCESSORY_LEAF_TO_WONDROUS_SLOT[classification[1]] || null;
}

// Tool>X>Y classifications get toolCategory = slugified Y (e.g. Tool>Thieves' Tools>Lockpicks ->
// 'lockpicks'); anything that didn't classify under the Tool branch at all (most commonly
// Miscellaneous>Unknown>Unidentified Object — a narrative-only item with no clean category, e.g. a
// piece of quest evidence mis-typed as misc in the source data) gets a disclosed generic fallback
// rather than an invented specific one.
// "Tool > X > Y" (e.g. Thieves' Tools > Lockpicks) and "Miscellaneous > X > Y" (e.g. Adventuring
// Gear > Container, Household > Cookware) are BOTH legitimate, informative classifications for
// mundane gear — classifyItemHierarchy's cascade routes "Waterskin"/"Sack"/"Iron Pot" through the
// Miscellaneous branch, not the Tool branch, and that's correct, not a sign of a problem. Only a
// genuinely uninformative placement (the literal "Unidentified Object" catch-all, or landing
// somewhere unexpected like Key/Quest Object/Treasure/Document/an unmatched Accessory) means this
// migration couldn't confidently categorize the item at all.
function deriveToolCategory(classification) {
  if (classification[0] === 'Tool' || classification[0] === 'Miscellaneous') {
    return slugify(classification[classification.length - 1]);
  }
  return 'adventuring-gear';
}

function isUninformativeToolClassification(classification) {
  if (classification[0] !== 'Tool' && classification[0] !== 'Miscellaneous') return true;
  return classification[classification.length - 1] === 'Unidentified Object';
}

function migrateMisc(item, tier, index, nextId, ambiguous, fixes) {
  const name = item.name;
  const desc = item.desc || '';
  const effect = item.effect || '';
  const subcategory = classifySubcategory(name, 'misc', tier, desc);
  const classification = classifyItemHierarchy({ ...item, subcategory }, tier);

  const requiresAttunement = itemRequiresAttunement(item);
  const deltas = extractStatDeltasFromText(effect);
  const setOverrides = findSetValueOverrides(effect);
  if (setOverrides.length) {
    ambiguous.push({ name, tier, reason: `effect text sets an absolute ability score ("${setOverrides.map(o => `${o.stat} to ${o.value}`).join(', ')}") — no direct StatModifier equivalent, needs manual review`, effect });
  }
  const passive = toStatModifiers(deltas);
  const wondrousSlot = deriveWondrousSlot(classification);

  // classifyItemHierarchy's own magic-detection heuristic (any non-common item with effect text
  // matching a magic keyword, or any non-common item with effect text at all) already identifies
  // "Miscellaneous > Wondrous Item > *" independently of anything checked below — reused here
  // rather than re-deriving "is this magical" from scratch. Without it, a magical trinket with no
  // slot/attunement/stat-bonus/charges (its power is purely narrative/DM-adjudicated) would
  // otherwise be misclassified as mundane 'tool' gear.
  const classifiedAsWondrous = classification[0] === 'Miscellaneous' && classification[1] === 'Wondrous Item';
  const isWondrous = !!wondrousSlot || requiresAttunement || passive.length > 0 || !!item.charges || classifiedAsWondrous;
  if (item.abilities && item.abilities.length) {
    ambiguous.push({ name, tier, reason: `item has a structured legacy "abilities" entry (${item.abilities.map(a => a.name).join(', ')}) this migration does not yet convert into a V2 Ability — full text preserved in flavorText/effect, needs manual review`, abilities: item.abilities });
  }
  if (item.charges && !wondrousSlot) {
    ambiguous.push({ name, tier, reason: `has a charged ability (charges "${item.charges}") with no confidently-extractable structured effect — no OnUseEffect built, migrated as a wondrous item with no abilities[] entry, needs manual review`, charges: item.charges });
  }

  if (scanResidualLanguage(effect, [])) {
    ambiguous.push({ name, tier, reason: 'effect text contains mechanical-sounding language beyond a plain "+N stat" bonus this migration does not yet extract into a structured effect — full text preserved in flavorText, needs manual review', effect });
  }

  const base = {
    id: nextId(name),
    name,
    rarity: tier,
    weight: computeItemWeight(item, subcategory),
    ...(item.gp && item.gp !== '—' ? { value: item.gp } : {}),
    ...(desc ? { flavorText: desc } : {}),
    ...(requiresAttunement ? { requiresAttunement: true } : {}),
    ...(item.unlocks ? { narrative: { unlocks: item.unlocks } } : {}),
    legacySource: { tier, index, name },
  };

  if (isWondrous) {
    return { ...base, itemType: 'wondrous', wondrous: wondrousSlot ? { slot: wondrousSlot } : {}, ...(passive.length ? { passive } : {}) };
  }
  if (isUninformativeToolClassification(classification)) {
    ambiguous.push({ name, tier, reason: `no accessory slot, attunement, stat bonus, or recognized category found at all (classified as "${classification.join(' > ')}") — migrated as a generic tool with no real mechanical identity; may actually be quest/document/treasure content mis-scoped into this migration's misc-item pass, needs manual review`, classification });
  }
  // Note: passive is never non-empty here — a non-empty passive already forces isWondrous above.
  return { ...base, itemType: 'tool', tool: { toolCategory: deriveToolCategory(classification) } };
}

// ============================== Companions (Phase 4) ==============================================
// Pets and mounts are a genuinely distinct concept from every other item type migrated so far —
// summoned/ridden, never equipped to a body slot. Mounts commonly carry real mechanics (their own
// AC, one or more movement speeds, a flat "+N to attack rolls made while mounted" granted to their
// RIDER) that pets mostly don't (mostly narrative advantage-granting effects, e.g. "Advantage on
// Wisdom (Perception) checks..." — preserved as flavorText, not force-fit into a StatModifier).

function extractSpeeds(effect) {
  const t = effect || '';
  const flyMatch = /fly speed\s+(\d+)\s*ft/i.exec(t);
  const swimMatch = /swim speed\s+(\d+)\s*ft/i.exec(t);
  const climbMatch = /climb speed\s+(\d+)\s*ft/i.exec(t);
  // Negative lookbehind so the base "Speed N ft." doesn't also match inside "Fly speed N ft.".
  const baseMatch = /(?<!fly |swim |climb )\bspeed\s+(\d+)\s*ft/i.exec(t);
  const out = {};
  if (baseMatch) out.speed = parseInt(baseMatch[1], 10);
  if (flyMatch) out.flySpeed = parseInt(flyMatch[1], 10);
  if (swimMatch) out.swimSpeed = parseInt(swimMatch[1], 10);
  if (climbMatch) out.climbSpeed = parseInt(climbMatch[1], 10);
  return out;
}

function migrateCompanion(item, tier, index, nextId, ambiguous, fixes) {
  const name = item.name;
  const desc = item.desc || '';
  const effect = item.effect || '';
  const companionType = item.subcategory === 'mount' ? 'mount' : item.subcategory === 'pet' ? 'pet' : classifySubcategory(name, 'companion', tier, desc);

  const acMatch = /^\s*(\d+)\s*$/.exec(String(item.ac ?? ''));
  if (item.ac && !acMatch) {
    ambiguous.push({ name, tier, reason: `companion.ac ("${item.ac}") is not a plain number — left unset`, legacyAc: item.ac });
  }
  const speeds = extractSpeeds(effect);

  const requiresAttunement = itemRequiresAttunement(item);
  const deltas = extractStatDeltasFromText(effect);
  const setOverrides = findSetValueOverrides(effect);
  if (setOverrides.length) {
    ambiguous.push({ name, tier, reason: `effect text sets an absolute ability score ("${setOverrides.map(o => `${o.stat} to ${o.value}`).join(', ')}") — no direct StatModifier equivalent, needs manual review`, effect });
  }
  const passive = toStatModifiers(deltas);
  const mountedAttackMatch = /\+(\d+)\s+to attack rolls\b/i.exec(effect);
  if (mountedAttackMatch) passive.push({ stat: 'attackRoll', value: parseInt(mountedAttackMatch[1], 10) });

  if (scanResidualLanguage(effect, [])) {
    ambiguous.push({ name, tier, reason: 'effect text contains mechanical-sounding language (per-rest/per-day abilities, conditional riders, etc.) beyond AC/speed/a mounted attack bonus this migration extracts — full text preserved in flavorText, needs manual review', effect });
  }

  const companion = {
    companionType,
    ...(acMatch ? { ac: parseInt(acMatch[1], 10) } : {}),
    ...speeds,
  };

  return {
    id: nextId(name),
    name,
    itemType: 'companion',
    rarity: tier,
    weight: computeItemWeight(item, companionType),
    ...(item.gp && item.gp !== '—' ? { value: item.gp } : {}),
    ...(desc ? { flavorText: desc } : {}),
    ...(requiresAttunement ? { requiresAttunement: true } : {}),
    companion,
    ...(passive.length ? { passive } : {}),
    ...(item.unlocks ? { narrative: { unlocks: item.unlocks } } : {}),
    legacySource: { tier, index, name },
  };
}

// ============================== Treasure / quest item / document (Phase 4) =========================
// dungeon-master-box's own data describes every item in these three types as mechanically inert
// ("Pure currency — no mechanical effect, just spendable wealth", "GM determines what lock this key
// fits", "GM discretion on relevance") — there is no numeric mechanic to extract, so these map onto
// the EXISTING 'tool' itemType (identity/content/category, nothing more) rather than getting their
// own new type each for only a handful of items apiece. `classifyItemHierarchy` already has a
// dedicated, correct branch for each of these three legacy `type` values (unlike misc's cruder
// cascade), so unlike migrateMisc's deriveToolCategory this trusts that classification directly
// rather than treating an unfamiliar top-level branch as a red flag.
function narrativeToolCategory(classification) {
  return slugify(classification[classification.length - 1]);
}

function migrateNarrativeTool(item, tier, index, nextId, ambiguous, fixes) {
  const name = item.name;
  const desc = item.desc || '';
  const effect = item.effect || '';
  const subcategory = classifySubcategory(name, item.type, tier, desc);
  const classification = classifyItemHierarchy({ ...item, subcategory }, tier);

  // Matches the old engine's own INTERACTIONS table, which grants quest_item/turn_in to every
  // questitem automatically and unlock additionally to key-subcategory ones — synthesized here
  // since (unlike some document entries) questitem entries in the source never author
  // extraInteractions explicitly themselves.
  const extraInteractions = item.extraInteractions
    ? [...item.extraInteractions]
    : item.type === 'questitem'
      ? (subcategory === 'key' ? ['unlock', 'quest_item', 'turn_in'] : ['quest_item', 'turn_in'])
      : [];
  // No residual-language ambiguity scan here, unlike every other migrator: dungeon-master-box's own
  // data explicitly describes every item of these three types as mechanically inert/GM-adjudicated
  // ("no mechanical effect", "GM determines..."), so narrative-sounding effect text is the EXPECTED
  // shape for this content, not a sign this migration missed something — flagging every single one
  // would be noise, not signal.

  return {
    id: nextId(name),
    name,
    itemType: 'tool',
    rarity: tier,
    weight: computeItemWeight(item, subcategory),
    ...(item.gp && item.gp !== '—' ? { value: item.gp } : {}),
    ...(desc ? { flavorText: desc } : {}),
    tool: { toolCategory: narrativeToolCategory(classification) },
    ...(extraInteractions.length ? { extraInteractions } : {}),
    ...(item.unlocks ? { narrative: { unlocks: item.unlocks } } : {}),
    legacySource: { tier, index, name },
  };
}

// ============================== NPC signature weapons (Phase 6) ====================================
// npc-data.js's NPC_WEAPONS (8 items) is the one piece of item content outside loot-data.js, and the
// ONE place in the entire catalog already using a structured `abilities[]` pattern (a real
// {id,name,kind,uses:{max,recharge},usesLeft} shape) rather than the free-text `charges` string
// everything else in this catalog uses. Each entry is otherwise shaped IDENTICALLY to a loot-data.js
// entry (same name/desc/type/slotSize/gp/dmg/effect fields), so this reuses migrateWeapon/
// migrateMisc directly rather than re-deriving weapon/armor mechanics a second time.
//
// npc-data.js has no rarity/tier field at all for these (they're narrative NPC gear, not part of
// the tiered loot table) — every entry is assigned a placeholder tier of 'rare' (matching their
// actual power level: +2 attack/damage, attunement, once-per-rest abilities, consistent with
// loot-data.js's own rare-tier items), disclosed here and in the report rather than silently
// invented. This is a uniform, deliberate placeholder — not a per-item ambiguity needing review the
// way an unresolved weapon damage type would be.
const NPC_WEAPON_TIER = 'rare';
const LEGACY_RECHARGE_MAP = { longRest: 'long_rest', shortRest: 'short_rest', dawn: 'dawn', turn: 'charges' };

function convertNpcAbility(legacyAbility, itemName, ambiguous) {
  const kind = legacyAbility.kind === 'spell' ? 'spell' : 'active_effect';
  const legacyRecharge = legacyAbility.uses?.recharge;
  const recharge = LEGACY_RECHARGE_MAP[legacyRecharge] || 'long_rest';
  if (!LEGACY_RECHARGE_MAP[legacyRecharge]) {
    ambiguous.push({ name: itemName, tier: NPC_WEAPON_TIER, reason: `ability "${legacyAbility.name}" has an unrecognized recharge type "${legacyRecharge}" — defaulted to long_rest, needs manual review`, ability: legacyAbility });
  }
  // effectText is free prose ("Force one creature within 30 ft. to make a DC 16 Wisdom save or be
  // compelled..."), same honest-gap situation as consumable effect text — preserved verbatim as
  // `description` rather than force-fit into a structured OnUseEffect kind it doesn't cleanly match.
  ambiguous.push({ name: itemName, tier: NPC_WEAPON_TIER, reason: `ability "${legacyAbility.name}"'s effect ("${legacyAbility.effectText}") is preserved as description text only — real uses/recharge were extracted, but the mechanical effect itself was not reduced to a structured OnUseEffect, needs manual review if it must actually resolve automatically`, ability: legacyAbility });
  return {
    id: legacyAbility.id,
    name: legacyAbility.name,
    kind,
    description: legacyAbility.effectText,
    effect: { kind: 'utility' },
    uses: { max: legacyAbility.uses.max, recharge },
    usesLeft: legacyAbility.usesLeft ?? legacyAbility.uses.max,
  };
}

function migrateNpcWeapon(item, index, nextId, ambiguous, fixes) {
  const migrator = item.type === 'weapon' ? migrateWeapon : item.type === 'misc' ? migrateMisc : null;
  if (!migrator) {
    ambiguous.push({ name: item.name, tier: NPC_WEAPON_TIER, reason: `NPC_WEAPONS entry has legacy type "${item.type}", which this migration doesn't handle for npc-data.js — excluded from this pass`, legacyType: item.type });
    return null;
  }
  const canonical = migrator(item, NPC_WEAPON_TIER, index, nextId, ambiguous, fixes);
  if (!canonical) return null;
  if (item.abilities && item.abilities.length) {
    // Only weapon/armor/wondrous may carry an `abilities` facet (validate-item.js's RULES) — guard
    // rather than let a future misc-classification edge case (this item resolving to plain 'tool')
    // produce an item that fails validation.
    if (['weapon', 'armor', 'wondrous'].includes(canonical.itemType)) {
      canonical.abilities = item.abilities.map(a => convertNpcAbility(a, item.name, ambiguous));
    } else {
      ambiguous.push({ name: item.name, tier: NPC_WEAPON_TIER, reason: `item has legacy structured abilities but migrated as itemType "${canonical.itemType}", which cannot carry an abilities facet — abilities dropped, needs manual review`, abilities: item.abilities });
    }
  }
  canonical.legacySource = { tier: NPC_WEAPON_TIER, index, name: item.name, source: 'npc-data.js:NPC_WEAPONS' };
  return canonical;
}

// ============================== Main =============================================================
function main() {
  const lootData = loadLootData();
  const nextId = makeIdGenerator();
  const ambiguous = [];
  const fixes = [];
  const canonicalItems = [];
  const materialsSummary = {};
  let excludedCount = 0;
  const counts = { weapon: 0, armor: 0, consumable: 0, misc: 0, companion: 0, treasure: 0, questitem: 0, document: 0 };
  const MIGRATORS = {
    weapon: migrateWeapon, armor: migrateArmor, consumable: migrateConsumable, misc: migrateMisc,
    companion: migrateCompanion, treasure: migrateNarrativeTool, questitem: migrateNarrativeTool, document: migrateNarrativeTool,
  };

  for (const tier of Object.keys(lootData)) {
    lootData[tier].forEach((item, index) => {
      const migrator = MIGRATORS[item.type];
      if (!migrator) return;
      counts[item.type]++;
      const result = migrator(item, tier, index, nextId, ambiguous, fixes);
      if (!result) { excludedCount++; return; }
      canonicalItems.push(result);
      for (const modId of result.appliedModifiers || []) {
        materialsSummary[modId] = (materialsSummary[modId] || 0) + 1;
      }
    });
  }

  // npc-data.js's NPC_WEAPONS — the one item content outside loot-data.js (Phase 6).
  const npcWeapons = loadNpcWeapons();
  counts.npcWeapon = 0;
  npcWeapons.forEach((item, index) => {
    counts.npcWeapon++;
    const result = migrateNpcWeapon(item, index, nextId, ambiguous, fixes);
    if (!result) { excludedCount++; return; }
    canonicalItems.push(result);
  });

  // Validate every canonical item before writing anything.
  const invalid = [];
  for (const item of canonicalItems) {
    const { valid, errors } = validateItem(item);
    if (!valid) invalid.push({ name: item.name, legacySource: item.legacySource, errors });
  }
  if (invalid.length) {
    console.error(`${invalid.length} canonical item(s) failed validation — aborting write:`);
    for (const v of invalid) console.error(`  - ${v.name} (${v.legacySource.tier}): ${v.errors.join('; ')}`);
    process.exit(1);
  }

  const outDir = path.join(ROOT, 'mechanics', 'canonical');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'items.json'),
    JSON.stringify(canonicalItems, null, 2) + '\n',
  );

  const byTier = {};
  for (const item of canonicalItems) byTier[item.rarity] = (byTier[item.rarity] || 0) + 1;
  const ambiguousByReason = {};
  for (const a of ambiguous) {
    const key = a.reason.split(' — ')[0].split(' (')[0];
    (ambiguousByReason[key] = ambiguousByReason[key] || []).push(a);
  }

  const report = buildReport({ lootData, counts, canonicalItems, excludedCount, ambiguous, ambiguousByReason, byTier, materialsSummary, fixes, npcWeaponCount: npcWeapons.length });
  fs.writeFileSync(path.join(outDir, 'migration-report.md'), report);

  const legacyTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`Migrated ${canonicalItems.length}/${legacyTotal} items.`);
  console.log(`  ${Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(', ')}, excluded: ${excludedCount}`);
  console.log(`  ambiguous flags raised: ${ambiguous.length}`);
  console.log(`  bugs found and fixed: ${fixes.length}`);
  console.log(`  material modifiers applied: ${JSON.stringify(materialsSummary)}`);
  console.log(`Wrote mechanics/canonical/items.json and mechanics/canonical/migration-report.md`);
}

function buildReport({ lootData, counts, canonicalItems, excludedCount, ambiguous, ambiguousByReason, byTier, materialsSummary, fixes, npcWeaponCount }) {
  const totalLegacyItems = Object.values(lootData).reduce((s, arr) => s + arr.length, 0) + npcWeaponCount;
  const lines = [];
  lines.push('# V2 Mechanics Migration Report — Phases 1-6 (all loot-data.js items + monster-part system + npc-data.js NPC_WEAPONS)');
  lines.push('');
  lines.push(`Generated by \`scripts/migrate-legacy-content.js\`. Source: \`loot-data.js\`/\`npc-data.js\` (untouched — this script never writes to either).`);
  lines.push('');
  lines.push('## Content preservation (Section 20)');
  lines.push('');
  lines.push(`- Legacy catalog total (loot-data.js + npc-data.js's NPC_WEAPONS): ${totalLegacyItems} items — every item is now migrated`);
  lines.push(`- Legacy weapon items: ${counts.weapon}`);
  lines.push(`- Legacy armor items: ${counts.armor}`);
  lines.push(`- Legacy consumable items: ${counts.consumable}`);
  lines.push(`- Legacy misc items: ${counts.misc} (split into the new \`wondrous\` and existing \`tool\` itemTypes — see "Misc -> wondrous/tool split" below)`);
  lines.push(`- Legacy companion items: ${counts.companion} (new \`companion\` itemType — pets/mounts)`);
  lines.push(`- npc-data.js NPC_WEAPONS: ${npcWeaponCount} (placeholder rarity "rare" — this file has no tier field; structured legacy abilities[] converted to real V2 Ability records)`);
  lines.push(`- Legacy treasure items: ${counts.treasure} (existing \`tool\` itemType — mechanically inert by the source data's own description)`);
  lines.push(`- Legacy quest items: ${counts.questitem} (existing \`tool\` itemType, tagged with quest_item/turn_in/unlock interactions)`);
  lines.push(`- Legacy document items: ${counts.document} (existing \`tool\` itemType)`);
  lines.push(`- Migrated to canonical structured items: ${canonicalItems.length}`);
  lines.push(`- Excluded this pass (no parseable base dmg/ac/hp — see "Excluded items" below): ${excludedCount}`);
  lines.push(`- Added: 0 — Removed: 0 — Renamed: 0 (every migrated item keeps its exact original \`name\`)`);
  lines.push(`- Changed: authored content (name/desc/gp/rarity) copied verbatim; only the MECHANICAL representation changed, as intended. See "Ambiguous / needs review" for anything not migrated with full confidence.`);
  lines.push('');
  lines.push('### By rarity tier');
  for (const tier of Object.keys(lootData)) {
    lines.push(`- ${tier}: ${byTier[tier] || 0} migrated`);
  }
  lines.push('');
  lines.push('## Material modifiers applied (Section 10/11 — new mechanics, confirmed scope)');
  lines.push('');
  if (Object.keys(materialsSummary).length === 0) {
    lines.push('None of the migrated weapon/armor items matched a material keyword (silvered/mithral/adamantine/masterwork) in name/desc/effect.');
  } else {
    for (const [modId, count] of Object.entries(materialsSummary)) {
      lines.push(`- \`${modId}\`: applied to ${count} item(s)`);
    }
  }
  lines.push('');
  lines.push('## Misc -> wondrous/tool split (Section 8 — new itemType for legacy-only content)');
  lines.push('');
  const wondrousCount = canonicalItems.filter(i => i.itemType === 'wondrous').length;
  const toolCount = canonicalItems.filter(i => i.itemType === 'tool').length;
  const wondrousWithSlot = canonicalItems.filter(i => i.itemType === 'wondrous' && i.wondrous.slot).length;
  lines.push(`- Migrated as \`wondrous\` (has a body slot, requires attunement, grants a stat bonus, or carries a charged ability): ${wondrousCount} (${wondrousWithSlot} of those have an equip slot; the rest are carried/attuned trinkets with no slot)`);
  lines.push(`- Migrated as \`tool\` (no magical identity found — mundane gear): ${toolCount}`);
  lines.push('');
  lines.push('## Bugs found in the live app and fixed during migration (Section 19/29)');
  lines.push('');
  lines.push('Differences from current live behavior were investigated before being carried into the canonical data, per Section 19. Every one found so far is the same class of issue: a weapon\'s `dmg` field has an enhancement bonus baked into its dice notation (e.g. `"1d8+1"`) AND its `effect` text separately states the same bonus ("+1 to attack and damage rolls") — dungeon-master-box\'s own `computeWeaponAttackRoll` sums both independently today, silently dealing +1 more damage than a "+1 weapon" should. This migration applies the bonus once (base dice + one passive `damageRoll` modifier).');
  lines.push('');
  if (fixes.length === 0) {
    lines.push('None found.');
  } else {
    for (const f of fixes) lines.push(`- **${f.name}** (${f.tier}) — ${f.kind}: ${f.detail}`);
  }
  lines.push('');
  lines.push('## Excluded items (no parseable base mechanic — not deleted, still in loot-data.js unchanged)');
  lines.push('');
  const excluded = ambiguous.filter(a => a.reason.includes('excluded from this migration pass'));
  if (excluded.length === 0) {
    lines.push('None.');
  } else {
    for (const e of excluded) lines.push(`- **${e.name}** (${e.tier}): ${e.reason}`);
  }
  lines.push('');
  lines.push(`## Ambiguous / needs review (Section 27) — ${ambiguous.length - excluded.length} item(s)`);
  lines.push('');
  lines.push('These items WERE migrated with their best-effort derived mechanics (nothing below blocks migration), but each needs a human look before being treated as fully authoritative:');
  lines.push('');
  for (const [reasonKey, items] of Object.entries(ambiguousByReason)) {
    const nonExcluded = items.filter(i => !i.reason.includes('excluded from this migration pass'));
    if (!nonExcluded.length) continue;
    lines.push(`### ${reasonKey} (${nonExcluded.length})`);
    for (const item of nonExcluded) {
      lines.push(`- **${item.name}** (${item.tier}): ${item.reason}`);
    }
    lines.push('');
  }
  lines.push('## Not yet migrated (explicitly out of scope so far, not lost)');
  lines.push('');
  lines.push('Every `loot-data.js` item type is now migrated (Phases 1-4). Everything else in the repository is untouched and remains exactly as authored: reference-data.js, npc-data.js, journey-data.js, puzzle-data.js, trap-data.js, cult-data.js, and monster/spell data (fetched live from the 5etools mirror, never stored locally). See docs/V2_MECHANICS_MIGRATION.md for the planned follow-up phases.');
  lines.push('');
  return lines.join('\n');
}

// Only run when executed directly (`node scripts/migrate-legacy-content.js`) — importing this
// module from a test file must not trigger a full migration run + file writes as a side effect.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  loadLootData, loadNpcWeapons, classifySubcategory, computeItemWeight, hashItemName, parseWeaponEffectBonuses,
  deriveWeaponMechanics, deriveWeaponProperties, toStatModifiers, findSetValueOverrides,
  scanResidualLanguage, applyMaterialModifiers, slugify, makeIdGenerator,
  deriveConsumableCategory, resolveConsumableUses,
  deriveWondrousSlot, deriveToolCategory, extractSpeeds, narrativeToolCategory,
  convertNpcAbility,
  migrateWeapon, migrateArmor, migrateConsumable, migrateMisc, migrateCompanion, migrateNarrativeTool, migrateNpcWeapon, main,
};
