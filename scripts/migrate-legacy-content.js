#!/usr/bin/env node
// One-time developer migration tool: converts dungeon-master-box's existing weapon/armor catalog
// (loot-data.js) into canonical structured items on the V2 mechanics schema (mechanics/engine).
// See docs/V2_MECHANICS_MIGRATION.md for the full plan this implements.
//
// SCOPE (Phase 1, confirmed narrow-start): type === 'weapon' and type === 'armor' entries only
// (688 of loot-data.js's 1,243 items). Every other type (misc/consumable/companion/treasure/
// questitem/document) is untouched and stays exactly as authored in loot-data.js — this script
// never writes to that file. Later migration phases extend this same approach to those types.
//
// THIS IS NOT PART OF THE RUNTIME APP. Run it manually (`node scripts/migrate-legacy-content.js`)
// whenever loot-data.js's weapon/armor entries change; it is deterministic (no Math.random
// anywhere in the derivation — computeItemWeight's "randomness" is a stable hash of the item's own
// name, matching the existing app's own convention) — running it twice against the same source
// produces byte-identical output. It writes:
//   - mechanics/canonical/weapons-armor.json   — the canonical structured items (the new runtime
//     source for these 688 items once a later phase wires the app onto it; nothing reads this file
//     today)
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
  return '';
}

const WEIGHT_RANGE_BY_SUBCATEGORY = {
  head: [1, 4], facewear: [0.2, 1], chest: [6, 40], cloak: [1, 3], belt: [0.5, 2],
  boots: [1, 4], leggings: [2, 8], handwear: [0.5, 2], offhand: [4, 12],
  onehanded: [1, 8], twohanded: [6, 20],
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
    ...(item.gp ? { value: item.gp } : {}),
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

  const acMatch = /^\s*([+-]?)(\d+)\s*$/.exec(String(item.ac ?? ''));
  if (!acMatch) {
    ambiguous.push({ name, tier, reason: 'no parseable armor.ac value — excluded from this migration pass', legacyAc: item.ac ?? null });
    return null;
  }
  const acValue = parseInt(acMatch[2], 10);
  const isBodySlot = subcategory === 'chest';
  const additive = !isBodySlot;

  const SLOT_MAP = { offhand: 'shield', head: 'helmet', facewear: 'facewear', cloak: 'cloak', belt: 'beltwaist', boots: 'boots', leggings: 'leggings', handwear: 'handwear', chest: 'chest' };
  const slot = SLOT_MAP[subcategory] || 'chest';

  // Only the BODY armor slot ('chest') ever has its armorType actually read for mechanics
  // (addsDexMod/dexModCap in mechanics/engine/character/equipment.js's computeEquippedArmorClass —
  // every other slot, additive by definition, contributes only its flat baseAC regardless of
  // armorType). So only a genuine body-armor item with an unresolved weight class is worth
  // flagging as ambiguous; for every additive accessory slot (offhand/head/handwear/boots/
  // leggings/cloak/facewear/beltwaist) armorType is cosmetic only — best-effort from
  // classification when available, a harmless 'light' placeholder otherwise, never flagged.
  let armorType;
  if (subcategory === 'offhand') {
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
    weight: computeItemWeight(item, subcategory),
    ...(item.gp ? { value: item.gp } : {}),
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

// ============================== Main =============================================================
function main() {
  const lootData = loadLootData();
  const nextId = makeIdGenerator();
  const ambiguous = [];
  const fixes = [];
  const canonicalItems = [];
  const materialsSummary = {};
  let excludedCount = 0;
  const counts = { weapon: 0, armor: 0 };

  for (const tier of Object.keys(lootData)) {
    lootData[tier].forEach((item, index) => {
      if (item.type !== 'weapon' && item.type !== 'armor') return;
      counts[item.type]++;
      const result = item.type === 'weapon'
        ? migrateWeapon(item, tier, index, nextId, ambiguous, fixes)
        : migrateArmor(item, tier, index, nextId, ambiguous, fixes);
      if (!result) { excludedCount++; return; }
      canonicalItems.push(result);
      for (const modId of result.appliedModifiers || []) {
        materialsSummary[modId] = (materialsSummary[modId] || 0) + 1;
      }
    });
  }

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
    path.join(outDir, 'weapons-armor.json'),
    JSON.stringify(canonicalItems, null, 2) + '\n',
  );

  const byTier = {};
  for (const item of canonicalItems) byTier[item.rarity] = (byTier[item.rarity] || 0) + 1;
  const ambiguousByReason = {};
  for (const a of ambiguous) {
    const key = a.reason.split(' — ')[0].split(' (')[0];
    (ambiguousByReason[key] = ambiguousByReason[key] || []).push(a);
  }

  const report = buildReport({ lootData, counts, canonicalItems, excludedCount, ambiguous, ambiguousByReason, byTier, materialsSummary, fixes });
  fs.writeFileSync(path.join(outDir, 'migration-report.md'), report);

  console.log(`Migrated ${canonicalItems.length}/${counts.weapon + counts.armor} weapon+armor items.`);
  console.log(`  weapon: ${counts.weapon}, armor: ${counts.armor}, excluded: ${excludedCount}`);
  console.log(`  ambiguous flags raised: ${ambiguous.length}`);
  console.log(`  bugs found and fixed: ${fixes.length}`);
  console.log(`  material modifiers applied: ${JSON.stringify(materialsSummary)}`);
  console.log(`Wrote mechanics/canonical/weapons-armor.json and mechanics/canonical/migration-report.md`);
}

function buildReport({ lootData, counts, canonicalItems, excludedCount, ambiguous, ambiguousByReason, byTier, materialsSummary, fixes }) {
  const totalLegacyItems = Object.values(lootData).reduce((s, arr) => s + arr.length, 0);
  const lines = [];
  lines.push('# V2 Mechanics Migration Report — Phase 1 (weapons + armor)');
  lines.push('');
  lines.push(`Generated by \`scripts/migrate-legacy-content.js\`. Source: \`loot-data.js\` (untouched — this script never writes to it).`);
  lines.push('');
  lines.push('## Content preservation (Section 20)');
  lines.push('');
  lines.push(`- Legacy catalog total (all types, unaffected by this phase): ${totalLegacyItems} items`);
  lines.push(`- Legacy weapon items: ${counts.weapon}`);
  lines.push(`- Legacy armor items: ${counts.armor}`);
  lines.push(`- Migrated to canonical structured items: ${canonicalItems.length}`);
  lines.push(`- Excluded this pass (no parseable base dmg/ac — see "Excluded items" below): ${excludedCount}`);
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
  lines.push('## Not yet migrated (explicitly out of Phase 1 scope, not lost)');
  lines.push('');
  lines.push('Every other legacy content type is untouched by this script and remains exactly as authored: misc/consumable/companion/treasure/questitem/document items (555 of loot-data.js\'s items), reference-data.js, npc-data.js, journey-data.js, puzzle-data.js, trap-data.js, cult-data.js, and monster/spell data (fetched live from the 5etools mirror, never stored locally). See docs/V2_MECHANICS_MIGRATION.md for the planned follow-up phases.');
  lines.push('');
  return lines.join('\n');
}

// Only run when executed directly (`node scripts/migrate-legacy-content.js`) — importing this
// module from a test file must not trigger a full migration run + file writes as a side effect.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  loadLootData, classifySubcategory, computeItemWeight, hashItemName, parseWeaponEffectBonuses,
  deriveWeaponMechanics, deriveWeaponProperties, toStatModifiers, findSetValueOverrides,
  scanResidualLanguage, applyMaterialModifiers, slugify, makeIdGenerator,
  migrateWeapon, migrateArmor, main,
};
