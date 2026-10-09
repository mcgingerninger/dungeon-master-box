// ===================== GAME ENGINE =====================
// Dependency-light game-rules module, extracted from the monolithic HTML app in Phase 1 of the
// architecture migration (see docs/MIGRATION_PLAN.md and docs/ARCHITECTURE.md).
//
// Rules for anything living in this file:
//   - No `document`, `window`, or any browser/DOM API of any kind.
//   - No reads of the monolith's mutable globals (character state, combat state, gambling
//     state, etc.) — every function takes its inputs as explicit parameters.
//   - No `localStorage` / persistence of any kind.
//   - Anything that needs randomness accepts an OPTIONAL trailing `rand` parameter, a
//     `() => number in [0,1)` function, defaulting to `Math.random` — so production callers
//     that don't pass one get byte-for-byte the same behavior as before extraction, while
//     tests can pass a seeded/mock generator for deterministic, checkable output.
//   - Functions that mutate an object passed in (e.g. `classifyItemFull` tagging `item`,
//     `applyRouletteAction` tagging `table`) continue to do so — extraction preserves that
//     behavior rather than switching to copy-on-write, which is a real design change and out
//     of scope for this phase.
//
// This file is consumed two ways today:
//   1. In the browser, via a small bridge module (see the inline `<script type="module">`
//      near the top of the main HTML file) that imports everything here and assigns it onto
//      `window`, so the existing monolithic script's plain global function calls
//      (`classifyItemFull(...)`, `battleParseAttack(...)`, etc.) keep working unmodified. This
//      is a temporary migration shim, not the intended final architecture — see
//      docs/ARCHITECTURE.md.
//   2. Directly, via `import` in the Node-based regression tests (`game-engine.test.js`) and,
//      going forward, by whatever Node.js server Phase 3 introduces.

// ===================== ITEM CLASSIFICATION =====================
// Extracted verbatim from the monolith (classifyItemFull and everything it depends on). Pure
// data transformation: reads only the `item` object passed in (name/desc/effect/type/
// subcategory/etc.) plus the fixed keyword tables below, and either returns derived data or
// mutates `item` to cache it — no DOM, no globals, no randomness anywhere in this section.

export function itemRequiresAttunement(item) {
  return /requires attunement/i.test((item && item.effect) || '') || /requires attunement/i.test((item && item.desc) || '');
}

// Monster-part crafting affinities, keyed by MONSTER_PART_TYPES' `key` (see buildMonsterPartItem
// in the main app) — this is what lets a Gargoyle's Hide default to {armor_material, trophy}
// while a Kraken's Claw (themed as a "Tentacle" on aquatic monsters) defaults to
// {weapon_material} instead, entirely from the part's TYPE rather than which monster it came from.
export const WEAPON_MATERIAL_PARTS = new Set(['fang', 'claw', 'horn', 'tail', 'bone', 'talon']);
export const ARMOR_MATERIAL_PARTS  = new Set(['hide', 'horn', 'wing', 'bone', 'shell', 'pelt']);
export const REAGENT_PARTS         = new Set(['eye', 'fang', 'claw', 'venomsac', 'heart', 'tongue']);
export const RITUAL_PARTS          = new Set(['eye', 'horn', 'venomsac', 'heart', 'bone', 'tongue']);
export const SUMMON_PARTS          = new Set(['heart', 'bone']);
export const FLESHMANCER_PARTS     = new Set(['eye', 'heart', 'tongue', 'venomsac', 'claw', 'talon', 'fang', 'horn', 'wing', 'shell', 'bone', 'hide', 'pelt', 'tail']);
export const TROPHY_PARTS          = new Set(['eye', 'hide', 'horn', 'wing', 'tail', 'heart', 'shell', 'pelt', 'talon']);
// Every FLESHMANCER_PARTS type can already be dropped into the Fleshmancer (the "usable there at
// all" gate), but not every one of those makes sense as an actual body graft once you're in it —
// a Venom Sac is a gland and a Bone is raw skeletal material, not a limb a body has a slot for the
// way an Eye, Claw, or Wing plausibly is (PART_TO_LIMB_CATEGORY in the main app already routes
// every OTHER type to a real limb category — eye/tongue/heart/hand/ear/arm/leg). Those two stay
// fully usable everywhere else a monster part already was (reagent, weapon/armor material,
// summoning component) — this only blocks the specific "wear this" action.
export const UNWEARABLE_MONSTER_PARTS = new Set(['venomsac', 'bone']);
export const ARMOR_BODY_SLOT_LABEL = { head:'Head', chest:'Chest', handwear:'Hands', leggings:'Legs', boots:'Feet', facewear:'Head' };

// A centralized "what can this item be used FOR" layer, kept deliberately separate from
// classification (what an item IS) and from properties/tags (what an item HAS). Each action's
// `default` rule reads only type/subcategory/partType/classification/properties/effect-text —
// never the item's specific name.
export const INTERACTIONS = {
  equip:            { cat: 'Equipment',   label: 'Equip',              default: it => ['armor', 'weapon', 'limb', 'companion', 'misc'].includes(it.type) },
  attune:           { cat: 'Equipment',   label: 'Attune',             default: it => itemRequiresAttunement(it) },
  craft_material:   { cat: 'Crafting',    label: 'Crafting Material',  default: it => it.type === 'craftable' || (it.classification || [])[0] === 'Material' },
  weapon_material:  { cat: 'Crafting',    label: 'Weapon Material',    default: it => it.type === 'craftable' && WEAPON_MATERIAL_PARTS.has(it.partType) },
  armor_material:   { cat: 'Crafting',    label: 'Armor Material',     default: it => it.type === 'craftable' && ARMOR_MATERIAL_PARTS.has(it.partType) },
  reagent:          { cat: 'Crafting',    label: 'Reagent',            default: it => (it.type === 'craftable' && REAGENT_PARTS.has(it.partType)) || (it.classification || []).includes('Alchemical') },
  component:        { cat: 'Crafting',    label: 'Component',          default: it => (it.classification || [])[0] === 'Material' && (it.classification || []).includes('Mineral') },
  enchant:          { cat: 'Modification', label: 'Enchant',           default: it => ['weapon', 'armor'].includes(it.type) || (it.type === 'misc' && ['ring', 'amulet'].includes(it.subcategory)) },
  socket:           { cat: 'Modification', label: 'Socket',            default: it => ['weapon', 'armor'].includes(it.type) || (it.type === 'misc' && ['ring', 'amulet'].includes(it.subcategory)) },
  repair:           { cat: 'Modification', label: 'Repair',            default: it => ['weapon', 'armor'].includes(it.type) },
  spell_focus:      { cat: 'Magic',       label: 'Spell Focus',        default: it => /spellcasting focus|holy symbol|arcane focus|druidic focus/i.test(it.effect || '') },
  ritual_component: { cat: 'Magic',       label: 'Ritual Component',   default: it => it.type === 'craftable' && RITUAL_PARTS.has(it.partType) },
  summon_component: { cat: 'Magic',       label: 'Summoning Component', default: it => it.type === 'craftable' && SUMMON_PARTS.has(it.partType) },
  monster_material: { cat: 'Monster',     label: 'Monster Material',   default: it => it.type === 'craftable' && it.subcategory === 'monsterpart' },
  fleshmancer_input:{ cat: 'Monster',     label: 'Fleshmancer Input',  default: it => it.type === 'craftable' && FLESHMANCER_PARTS.has(it.partType) },
  wearable_part:    { cat: 'Monster',     label: 'Wearable Part',      default: it => it.type === 'craftable' && FLESHMANCER_PARTS.has(it.partType) && !UNWEARABLE_MONSTER_PARTS.has(it.partType) },
  unwearable_part:  { cat: 'Monster',     label: 'Not Wearable',       default: it => it.type === 'craftable' && UNWEARABLE_MONSTER_PARTS.has(it.partType) },
  trophy:           { cat: 'Monster',     label: 'Trophy',             default: it => it.type === 'craftable' && TROPHY_PARTS.has(it.partType) },
  salvage:          { cat: 'Processing',  label: 'Salvage',            default: it => ['weapon', 'armor'].includes(it.type) },
  harvest:          { cat: 'Processing',  label: 'Harvest',            default: it => it.type !== 'craftable' && (it.classification || [])[0] === 'Material' },
  consume:          { cat: 'Consumable',  label: 'Consume',            default: it => it.type === 'consumable' && ['potion', 'food'].includes(it.subcategory) },
  // Broadened beyond just topical items (oil/ointment/salve/balm) so any potion/food a bearer
  // could drink themselves (see `consume` above) can also be administered to someone else --
  // e.g. the DM's "Apply to Player" tool feeding a healing potion to a downed ally.
  apply:            { cat: 'Consumable',  label: 'Apply',              default: it => it.type === 'consumable' && (['potion', 'food'].includes(it.subcategory) || /\boil\b|ointment|salve|balm/i.test(it.name || '')) },
  crumble:          { cat: 'Consumable',  label: 'Crumbles When Spent', default: it => it.type === 'consumable' && !!it.charges },
  throw:            { cat: 'Combat',      label: 'Throw',              default: it => it.subcategory === 'throwable' },
  weapon_coating:   { cat: 'Combat',      label: 'Weapon Coating',     default: it => it.type === 'consumable' && /poison/i.test(it.name || '') },
  place:            { cat: 'World',       label: 'Place',              default: it => /\btrap\b|\btotem\b|\bward\b|\bbanner\b|\bbeacon\b/i.test(it.name || '') },
  unlock:           { cat: 'World',       label: 'Unlock',             default: it => it.type === 'questitem' && it.subcategory === 'key' },
  quest_item:       { cat: 'Quest',       label: 'Quest Item',         default: it => it.type === 'questitem' },
  turn_in:          { cat: 'Quest',       label: 'Turn-In',            default: it => it.type === 'questitem' },
  // Deliberately explicit-opt-in only (default always false, never keyword-guessed from
  // name/desc text) — see deriveItemProperties/deriveItemTags's own word-boundary bug fix
  // above for exactly why a "does this text merely mention a chest" regex would be unreliable.
  // Real chest items set item.chestRarity directly (loot-data.js) and are opened via
  // openChestItem (the monolith), which checks that field, not this table, at click time —
  // this entry exists for the Compendium tooltip's Interactions chip, for discoverability.
  open_chest:       { cat: 'World',       label: 'Open',               default: it => false },
};

export function computeItemInteractions(item) {
  const set = new Set();
  for (const action in INTERACTIONS) {
    if (INTERACTIONS[action].default(item)) set.add(action);
  }
  (item.extraInteractions || []).forEach(a => set.add(a));
  (item.blockedInteractions || []).forEach(a => set.delete(a));
  return [...set];
}

export function canInteract(item, action) {
  if (!item || !INTERACTIONS[action]) return false;
  const list = item.interactions || computeItemInteractions(item);
  return list.includes(action);
}

export function classifyItemHierarchy(item, rarity) {
  const n = (item.name || '').toLowerCase();
  const text = n + ' ' + ((item.desc || '') + ' ' + (item.effect || '')).toLowerCase();
  const type = item.type;
  const sub = item.subcategory;

  if (type === 'weapon') {
    const twoHanded = sub === 'twohanded';
    const manufacturedNoun = /sword|blade|rapier|saber|scimitar|falchion|dagger|\bknife\b|dirk|stiletto|\baxe\b|hatchet|\bmace\b|hammer|\bflail\b|\bclub\b|spear|trident|\bpike\b|\bbow\b|crossbow|\bsling\b|blowgun|\bwhip\b|\bchain\b|morningstar|javelin|sickle|\bpick\b|kusarigama|\bnet\b|shuriken|\bstaff\b|glaive|halberd|polearm|\blance\b/;
    if (!manufacturedNoun.test(n)) {
      if (/\bclaw/.test(n)) return ['Weapon','Natural','Claw'];
      if (/\bbite\b|\bfang|\btooth\b|\btusk/.test(n)) return ['Weapon','Natural','Bite'];
      if (/\btalon/.test(n)) return ['Weapon','Natural','Talon'];
      if (/\bhorn\b/.test(n)) return ['Weapon','Natural','Horn'];
      if (/\btail\b/.test(n)) return ['Weapon','Natural','Tail'];
      if (/\bsting/.test(n)) return ['Weapon','Natural','Sting'];
      if (/\bslam\b|\bmaw\b|\bram\b/.test(text)) return ['Weapon','Natural','Slam'];
    }
    if (/\bsling\b/.test(n)) return ['Weapon','Ranged','Exotic','Sling'];
    if (/blowgun/.test(n)) return ['Weapon','Ranged','Exotic','Blowgun'];
    if (/\bnet\b/.test(n)) return ['Weapon','Ranged','Exotic','Net'];
    if (/hand crossbow/.test(n)) return ['Weapon','Ranged','Crossbow','Hand Crossbow'];
    if (/heavy crossbow/.test(n)) return ['Weapon','Ranged','Crossbow','Heavy Crossbow'];
    if (/crossbow/.test(n)) return ['Weapon','Ranged','Crossbow','Light Crossbow'];
    if (/throwing knife|throwing dagger/.test(n)) return ['Weapon','Ranged','Thrown','Throwing Knife'];
    if (/throwing axe/.test(n)) return ['Weapon','Ranged','Thrown','Throwing Axe'];
    if (/javelin/.test(n)) return ['Weapon','Ranged','Thrown','Javelin'];
    if (/shuriken/.test(n)) return ['Weapon','Ranged','Thrown','Shuriken'];
    if (/greatbow/.test(n)) return ['Weapon','Ranged','Bow','Greatbow'];
    if (/longbow/.test(n)) return ['Weapon','Ranged','Bow','Longbow'];
    if (/shortbow|\bbow\b/.test(n)) return ['Weapon','Ranged','Bow','Shortbow'];
    if (/\bwhip\b/.test(n)) return ['Weapon','Melee','Flexible','Whip'];
    if (/\bchain\b(?!\s*mail)/.test(n)) return ['Weapon','Melee','Flexible','Chain'];
    if (/morningstar/.test(n)) return ['Weapon','Melee','Flexible','Morningstar'];
    if (/kusarigama/.test(n)) return ['Weapon','Melee','Flexible','Kusarigama'];
    if (/great.?sword|zweihander/.test(n)) return ['Weapon','Melee','Two-Handed','Greatsword'];
    if (/great.?axe/.test(n)) return ['Weapon','Melee','Two-Handed','Greataxe'];
    if (/great.?club|great.?hammer|\bmaul\b/.test(n)) return ['Weapon','Melee','Two-Handed','Great Hammer'];
    if (/halberd|glaive|\bpike\b|\blance\b|polearm/.test(n)) return ['Weapon','Melee','Two-Handed','Polearm'];
    if (twoHanded && /spear|trident/.test(n)) return ['Weapon','Melee','Two-Handed','Two-Handed Spear'];
    if (/\bstaff\b/.test(n)) return ['Weapon','Melee','Two-Handed','Staff'];
    if (/dagger|\bknife\b|dirk|stiletto/.test(n)) return ['Weapon','Melee','One-Handed','Dagger'];
    if (/\baxe\b|hatchet/.test(n)) return ['Weapon','Melee','One-Handed','Axe'];
    if (/\bmace\b/.test(n)) return ['Weapon','Melee','One-Handed','Mace'];
    if (/\bpick\b/.test(n)) return ['Weapon','Melee','One-Handed','Pick'];
    if (/hammer/.test(n)) return ['Weapon','Melee','One-Handed','Hammer'];
    if (/\bflail\b/.test(n)) return ['Weapon','Melee','One-Handed','Flail'];
    if (/\bclub\b/.test(n)) return ['Weapon','Melee','One-Handed','Club'];
    if (/\bsickle\b/.test(n)) return ['Weapon','Melee','One-Handed','Sickle'];
    if (/spear|trident|\bpike\b/.test(n)) return ['Weapon','Melee','One-Handed','Spear'];
    if (/sword|\bblade\b|rapier|saber|scimitar|falchion/.test(n)) return ['Weapon','Melee','One-Handed','Sword'];
    return ['Weapon','Misc','Unclassified Weapon'];
  }

  if (type === 'limb') {
    const augLeaf = { arm:'Arm', hand:'Hand', finger:'Hand', leg:'Leg', foot:'Leg', eye:'Eye', ear:'Organ', heart:'Organ', tongue:'Organ' };
    return ['Accessory','Augmentation', augLeaf[sub] || 'Other'];
  }

  if (type === 'armor') {
    if (sub === 'cloak') return ['Accessory','Back','Cloak'];
    if (sub === 'belt') return ['Accessory','Waist','Belt'];
    if (sub === 'facewear') {
      if (/mask/.test(n)) return ['Accessory','Face','Mask'];
      if (/goggles|lens|spectacles|monocle/.test(n)) return ['Accessory','Face','Goggles'];
      if (/veil|blindfold/.test(n)) return ['Accessory','Face','Veil'];
    }
    if (sub === 'offhand') {
      if (/tower/.test(n)) return ['Armor','Shield','Tower Shield'];
      if (/kite/.test(n)) return ['Armor','Shield','Kite Shield'];
      if (/buckler/.test(n)) return ['Armor','Shield','Buckler'];
      return ['Armor','Shield','Round Shield'];
    }
    const slotLabel = ARMOR_BODY_SLOT_LABEL[sub] || 'Full Set';
    if (/full plate/.test(n)) return ['Armor','Heavy Armor','Full Plate', slotLabel];
    if (/half.?plate/.test(n)) return ['Armor','Heavy Armor','Half Plate', slotLabel];
    if (/\bplate\b|cuirass|breastplate/.test(n)) return ['Armor','Heavy Armor','Plate', slotLabel];
    if (/splint/.test(n)) return ['Armor','Heavy Armor','Splint', slotLabel];
    if (/banded/.test(n)) return ['Armor','Heavy Armor','Banded', slotLabel];
    if (/ring mail/.test(n)) return ['Armor','Heavy Armor','Ring Mail', slotLabel];
    if (/chain\s*mail|\bchain\b/.test(n)) return ['Armor','Medium Armor','Chain', slotLabel];
    if (/\bscale\b/.test(n)) return ['Armor','Medium Armor','Scale', slotLabel];
    if (/studded/.test(n)) return ['Armor','Medium Armor','Studded', slotLabel];
    if (/brigandine/.test(n)) return ['Armor','Medium Armor','Brigandine', slotLabel];
    if (/lamellar/.test(n)) return ['Armor','Medium Armor','Lamellar', slotLabel];
    if (/\bhide\b/.test(n)) return ['Armor','Light Armor','Hide', slotLabel];
    if (/leather/.test(n)) return ['Armor','Light Armor','Leather', slotLabel];
    if (/\brobe\b|vestment|\bcloth\b/.test(n)) return ['Armor','Light Armor','Cloth', slotLabel];
    if (/padded/.test(n)) return ['Armor','Light Armor','Padded', slotLabel];
    if (/\bsilk\b/.test(n)) return ['Armor','Light Armor','Silk', slotLabel];
    if (/dragon|elemental|obsidian|celestial/.test(text)) return ['Armor','Exotic Material','Dragonscale / Elemental'];
    if (/mithral/.test(text)) return ['Armor','Exotic Material','Mithral'];
    if (/adamantine/.test(text)) return ['Armor','Exotic Material','Adamantine'];
    if (/\bbone\b|chitin|carapace/.test(text)) return ['Armor','Exotic Material','Bone / Chitin'];
    if (/\bbark\b|\bwood\b/.test(text)) return ['Armor','Exotic Material','Bark / Wood'];
    return ['Armor','Exotic Material','Unclassified Material'];
  }

  if (sub === 'ring') return ['Accessory','Ring', /signet/.test(n) ? 'Signet Ring' : 'Magical Ring'];
  if (sub === 'amulet') {
    if (/talisman/.test(n)) return ['Accessory','Neck','Talisman'];
    if (/locket/.test(n)) return ['Accessory','Neck','Locket'];
    if (/brooch/.test(n)) return ['Accessory','Neck','Brooch'];
    if (/medallion/.test(n)) return ['Accessory','Neck','Medallion'];
    if (/pendant/.test(n)) return ['Accessory','Neck','Pendant'];
    if (/necklace/.test(n)) return ['Accessory','Neck','Necklace'];
    return ['Accessory','Neck','Amulet'];
  }
  if (/\bboots\b|\bslippers\b|\bsandals\b|\bsocks?\b/.test(n)) return ['Accessory','Feet','Boots'];
  if (/\bgauntlets\b/.test(n)) return ['Accessory','Hands','Gauntlets'];
  if (/\bbracers\b/.test(n)) return ['Accessory','Hands','Bracers'];
  if (/\bgloves\b/.test(n)) return ['Accessory','Hands','Gloves'];
  if (/\bcape\b/.test(n)) return ['Accessory','Back','Cape'];
  if (/\bmantle\b/.test(n)) return ['Accessory','Back','Mantle'];
  if (/\bcloak\b/.test(n)) return ['Accessory','Back','Cloak'];
  if (/\bbelt\b(?!\s*pouch)|\bgirdle\b|\bsash\b/.test(n)) return ['Accessory','Waist','Belt'];
  if (/\bcirclet\b|\btiara\b|\bcoronet\b/.test(n)) return ['Accessory','Head','Circlet'];
  if (/\bdiadem\b/.test(n)) return ['Accessory','Head','Diadem'];
  if (/\bheadband\b/.test(n)) return ['Accessory','Head','Headband'];
  if (/\bhat\b/.test(n)) return ['Accessory','Head','Hat'];
  if (/\bgoggles\b|\bspectacles\b|\bmonocle\b/.test(n)) return ['Accessory','Face','Goggles'];
  if (/\bears?\b/.test(n)) return ['Accessory','Face','Ear'];
  if (/\beyes?\b/.test(n)) return ['Accessory','Face','Ocular Item'];

  if (type === 'companion') return ['Miscellaneous','Companion', sub === 'pet' ? 'Pet' : 'Mount'];

  if (type === 'document') {
    if (sub === 'journal') return ['Document','Journal','Personal'];
    if (sub === 'letter') return ['Document','Letter', /official|decree|noble|contract/.test(text) ? 'Official' : (/threat/.test(text) ? 'Threat' : 'Personal')];
    if (sub === 'map') return ['Document','Map', /treasure/.test(text) ? 'Treasure Map' : (/dungeon/.test(text) ? 'Dungeon' : 'Region')];
    if (sub === 'formula') return ['Document','Formula', /recipe/.test(text) ? 'Recipe' : (/blueprint/.test(text) ? 'Blueprint' : (/contract|deed/.test(text) ? 'Contract / Deed' : 'Spell Formula'))];
    return ['Document','Book', /history|king|chronicle/.test(text) ? 'History' : (/magic|arcane|spell/.test(text) ? 'Magic' : (/beast|bestiary|creature/.test(text) ? 'Bestiary' : 'Other'))];
  }
  if (type === 'treasure') {
    if (sub === 'gem') return ['Treasure','Gem', /flawless|precious|rare/.test(text) ? 'Precious Gem' : 'Semi-Precious Gem'];
    if (sub === 'regalia') return ['Treasure','Regalia', /crown/.test(n) ? 'Crown' : (/scepter/.test(n) ? 'Scepter' : 'Circlet')];
    if (sub === 'jewelry') return ['Treasure','Jewelry', /necklace/.test(n) ? 'Necklace' : (/bracelet/.test(n) ? 'Bracelet' : (/earring/.test(n) ? 'Earring' : 'Ring'))];
    if (sub === 'art') return ['Treasure','Art', /statue|sculpture/.test(n) ? 'Statue' : (/tapestry/.test(n) ? 'Tapestry' : 'Painting')];
    if (sub === 'currencybar') return ['Treasure','Currency','Bar'];
    return ['Treasure','Currency','Coin'];
  }
  if (type === 'questitem') {
    if (sub === 'key') return ['Key / Quest Object','Key', /magical|enchant/.test(text) ? 'Magical Key' : 'Physical Key'];
    if (sub === 'accesstoken') return ['Key / Quest Object','Access Token', /sigil/.test(n) ? 'Sigil' : (/pass/.test(n) ? 'Pass' : 'Seal')];
    if (sub === 'puzzleobject') return ['Key / Quest Object','Puzzle Object', /rune/.test(n) ? 'Rune' : (/symbol/.test(n) ? 'Symbol' : (/mechanism/.test(n) ? 'Mechanism' : 'Puzzle Piece'))];
    return ['Key / Quest Object','Quest Object', /evidence/.test(text) ? 'Evidence' : (/relic/.test(n) ? 'Relic' : (/deliver/.test(text) ? 'Delivery Object' : 'Artifact'))];
  }

  if (type === 'craftable' && sub === 'monsterpart') {
    const leafByPart = {
      eye:'Organ', heart:'Organ', tongue:'Organ', venomsac:'Venom', shell:'Carapace',
      hide:'Hide', pelt:'Fur', fang:'Fang', claw:'Claw', talon:'Talon', horn:'Horn',
      tail:'Tail', wing:'Wing', bone:'Bone',
    };
    return ['Material','Monster Material', leafByPart[item.partType] || 'Other'];
  }

  if (type === 'consumable') {
    if (sub === 'scroll') return ['Consumable','Scroll', /ritual/.test(text) ? 'Ritual Scroll' : 'Spell Scroll'];
    if (sub === 'potion') {
      if (item.hp) return ['Consumable','Potion','Healing'];
      if (/poison|venom|toxic/.test(text)) return ['Consumable','Potion','Poison'];
      if (/resist/.test(text)) return ['Consumable','Potion','Resistance'];
      if (/transform|shape/.test(text)) return ['Consumable','Potion','Transformation'];
      if (item.mods && item.mods.length) return ['Consumable','Potion','Buff'];
      return ['Consumable','Potion','Utility'];
    }
    if (sub === 'food') {
      if (/magical|enchant/.test(text)) return ['Consumable','Food','Magical Food'];
      if (/meat|beetle|monster/.test(text)) return ['Consumable','Food','Monster Meat'];
      if (/ration/.test(n)) return ['Consumable','Food','Ration'];
      return ['Consumable','Food','Prepared Food'];
    }
    if (sub === 'throwable') {
      if (/dust|powder/.test(n)) return ['Consumable','Throwable', /explosive|blast/.test(text) ? 'Explosive Powder' : 'Alchemical Powder'];
      if (/bomb|grenade/.test(n)) return ['Consumable','Throwable','Bomb'];
      return ['Consumable','Throwable','Utility Throwable'];
    }
    return ['Consumable','Throwable','Utility Throwable'];
  }

  if (/\bwand\b/.test(n)) return ['Tool','Magical','Wand'];
  if (/\brod\b/.test(n)) return ['Tool','Magical','Rod'];
  if (/spellbook|grimoire|component pouch|focus\b/.test(text)) return ['Tool','Magical','Magical Focus'];
  if (/diviner|divination/.test(text)) return ['Tool','Magical','Divination Tool'];
  if (/ritual (tool|kit|dagger|candle)/.test(text)) return ['Tool','Magical','Ritual Tool'];
  if (/\blute\b|\bmusical\b|minstrel|\bdrum\b|\bhorn\b instrument|\bflute\b/.test(n)) return ['Tool','Professional','Musical'];
  if (/padlock|\block\b(?!pick)/.test(n)) return ['Tool','Adventuring','Padlock'];
  if (/lockpick|thieves.? tools/.test(text)) return ['Tool',"Thieves' Tools",'Lockpicks'];
  if (/disguise kit/.test(text)) return ['Tool',"Thieves' Tools",'Disguise Kit'];
  if (/manacles|shackles|restraints?/.test(text)) return ['Tool',"Thieves' Tools",'Manacles / Restraints'];
  if (/grappling hook/.test(n)) return ['Tool','Adventuring','Grappling Hook'];
  if (/\brope\b/.test(n)) return ['Tool','Adventuring','Rope'];
  if (/\btorch\b/.test(n)) return ['Tool','Adventuring','Torch'];
  if (/lantern/.test(n)) return ['Tool','Adventuring','Lantern'];
  if (/crowbar/.test(n)) return ['Tool','Adventuring','Crowbar'];
  if (/climbing (gear|kit)|pitons?/.test(text)) return ['Tool','Adventuring','Climbing Gear'];
  if (/shovel|pickaxe|digging/.test(text)) return ['Tool','Adventuring','Digging Tool'];
  if (/\bbandage/.test(n)) return ['Tool','Medical','Bandage'];
  if (/surgical|surgeon/.test(text)) return ['Tool','Medical','Surgical Tools'];
  if (/medical|healer'?s? kit|diagnos/.test(text)) return ['Tool','Medical', /diagnos/.test(text) ? 'Diagnostic Tools' : 'Medical Kit'];
  if (/herbalis(m|t)/.test(text) && /kit|supplies|satchel|pouch/.test(text)) return ['Tool','Medical','Herbalism Kit'];
  if (/cartograph/.test(text)) return ['Tool','Professional','Cartography'];
  if (/navigat/.test(text)) return ['Tool','Professional','Navigation'];
  if (/\bquill\b|\bwriting\b|calligraphy/.test(text)) return ['Tool','Professional','Writing'];
  if (/cook'?s? (utensils|kit)|culinary/.test(text)) return ['Tool','Professional','Culinary'];
  if (/fishing/.test(text)) return ['Tool','Professional','Fishing'];
  if (/\bthimble\b/.test(n)) return ['Tool','Crafting','Tailoring Tools'];
  if (/enchant(er|ing)/.test(text)) return ['Tool','Crafting','Enchanting Tools'];
  if (/smithing/.test(text)) return ['Tool','Crafting','Smithing Tools'];
  if (/leatherworking/.test(text)) return ['Tool','Crafting','Leatherworking Tools'];
  if (/woodworking/.test(text)) return ['Tool','Crafting','Woodworking Tools'];
  if (/alchemist'?s? (kit|supplies)/.test(text)) return ['Tool','Crafting',"Alchemist's Supplies"];
  if (/tailoring/.test(text)) return ['Tool','Crafting','Tailoring Tools'];
  if (/brewer|brewing/.test(text)) return ['Tool','Crafting','Brewing Supplies'];
  if (/poisoner/.test(text)) return ['Tool','Crafting',"Poisoner's Kit"];
  if (/jewel/.test(text)) return ['Tool','Crafting',"Jeweler's Tools"];
  if (/\btool(s)?\b|\bkit\b|supplies\b/.test(text)) return ['Tool','General Tools','Miscellaneous Tool'];

  if (/\bdust\b|\bpowder\b|\breagent\b|\bsolvent\b|\bcatalyst\b/.test(n) && type === 'misc') {
    if (/\bcatalyst\b/.test(n)) return ['Material','Alchemical','Catalyst'];
    if (/\bsolvent\b/.test(n)) return ['Material','Alchemical','Solvent'];
    return ['Material','Alchemical','Reagent'];
  }
  if (/\bore\b/.test(n)) return ['Material','Mineral','Ore'];
  if (/\bingot\b/.test(n)) return ['Material','Mineral','Ingot'];
  if (/\bgem\b|\bcrystal\b/.test(n) && !item.gp) return ['Material','Mineral','Gem'];
  if (type === 'misc') {
    const finishedGarment = /cloak|sock|shirt|dress|\brobe\b|tunic|\bvest\b|glove|\bhat\b|scarf|trousers|pants|clothes|clothing|bandage/;
    if (!finishedGarment.test(n)) {
      if (/\btimber\b|\blumber\b|\bwood\b/.test(n)) return ['Material','Organic','Wood'];
      if (/\bcloth\b|fabric|\bsilk\b|\blinen\b|\bwool\b/.test(n)) return ['Material','Organic','Cloth / Fabric'];
      if (/leather scrap|hide scrap/.test(n)) return ['Material','Organic','Leather'];
      if (/plant fiber|\bvine\b|\breed\b/.test(n)) return ['Material','Organic','Plant Fiber'];
    }
  }

  if (/\bkey\b/.test(n)) return ['Key / Quest Object','Key', /magical|enchant/.test(text) ? 'Magical Key' : 'Physical Key'];
  if (/\bseal\b|\bsigil\b/.test(n)) return ['Key / Quest Object','Access Token', /seal/.test(n) ? 'Seal' : 'Sigil'];
  if (/relic|artifact/.test(n) && (item.rarity === 'legendary' || item.rarity === 'celestial')) return ['Key / Quest Object','Quest Object','Relic'];

  if (/\bmap\b/.test(n)) return ['Document','Map', /treasure/.test(text) ? 'Treasure Map' : (/dungeon/.test(text) ? 'Dungeon' : 'Region')];
  if (/ledger|journal|diary/.test(n)) return ['Document','Journal','Personal'];
  if (/\bletter\b/.test(n)) return ['Document','Letter', /official|decree|noble|contract/.test(text) ? 'Official' : (/threat/.test(text) ? 'Threat' : 'Personal')];
  if (/recipe|blueprint|formula|contract\b|\bdeed\b/.test(n)) return ['Document','Formula', /recipe/.test(n) ? 'Recipe' : (/blueprint/.test(n) ? 'Blueprint' : (/contract|deed/.test(n) ? 'Contract / Deed' : 'Spell Formula'))];
  if (/tome|grimoire|spellbook|\bbook\b|\bmanual\b/.test(n)) return ['Document','Book', /history|king|chronicle/.test(text) ? 'History' : (/magic|arcane|spell/.test(text) ? 'Magic' : (/beast|bestiary|creature/.test(text) ? 'Bestiary' : 'Other'))];

  if (/crown|scepter|circlet|tiara|regalia/.test(n)) return ['Treasure','Regalia', /crown/.test(n) ? 'Crown' : (/scepter/.test(n) ? 'Scepter' : 'Circlet')];
  if (/pouch of .*(coins|gold|silver|copper)|\bgold\b|\bcoins?\b/.test(n) && !item.effect) return ['Treasure','Currency','Coin'];
  if (/\bgem\b|\bjewel\b/.test(n) && item.gp && !item.effect) return ['Treasure','Gem','Precious Gem'];
  if (/painting|statue|sculpture|tapestry/.test(n)) return ['Treasure','Art', /statue|sculpture/.test(n) ? 'Statue' : (/tapestry/.test(n) ? 'Tapestry' : 'Painting')];

  if (/idol|icon|holy symbol|shrine/.test(text)) return ['Miscellaneous','Religious', /icon/.test(n) ? 'Icon' : (/holy symbol/.test(text) ? 'Religious Object' : 'Idol')];
  if (/trophy|mounted head|taxidermy|stuffed head/.test(text)) return ['Miscellaneous','Trophy', /battle/.test(text) ? 'Battle Trophy' : 'Monster Trophy'];
  if (/figurine/.test(n)) return ['Miscellaneous','Decoration','Figurine'];
  if (/tapestry/.test(n)) return ['Miscellaneous','Decoration','Tapestry'];
  if (/ornament/.test(n)) return ['Miscellaneous','Decoration','Ornament'];
  if (/\bmug\b|\bcup\b|utensil|cutlery|\bplate\b|\bbowl\b/.test(n)) return ['Miscellaneous','Household','Utensil'];
  // "coffer"/"casket"/"strongbox" added alongside chest/crate/barrel/container: found while
  // authoring lootable Chest items under those synonyms ("Sealed Reliquary Coffer", "The
  // Sovereign's Casket") — without them, this check (which runs before the magic-item guess
  // below) missed them entirely, so a mundane container fell through to being classified as a
  // "Wondrous Item" purely for having a non-common rarity and an effect string.
  if (/\bcrate\b|\bchest\b|\bbarrel\b|\bcontainer\b|\bcoffer\b|\bcasket\b|\bstrongbox\b/.test(n)) return ['Miscellaneous','Household','Container'];
  if (/\bchair\b|furniture/.test(text) || (/\btable\b/.test(text) && !/roll (on|a)|\bdmg\b|reference table|\bchart\b/.test(text))) return ['Miscellaneous','Household','Furniture'];
  if (/toy\b|game piece|board game/.test(text)) return ['Miscellaneous','Entertainment','Toy'];
  if (/\bgame\b|\bdice\b|playing cards/.test(text)) return ['Miscellaneous','Entertainment','Game'];
  if (/instrument|\blute\b|\bdrum\b|\bflute\b/.test(text)) return ['Miscellaneous','Entertainment','Instrument'];
  if (type !== 'armor' && /\bcap\b|bonnet|headscarf/.test(n)) return ['Miscellaneous','Clothing','Headwear'];
  if (type !== 'armor' && /mittens/.test(n)) return ['Miscellaneous','Clothing','Handwear'];
  if (type !== 'armor' && /\bscarf\b|\bshirt\b|\btunic\b|\btrousers\b|garment|\bvest\b|\bdress\b|\bclothes\b|\bclothing\b/.test(n)) return ['Miscellaneous','Clothing','Garment'];
  if (/strange|humming|unidentif|inexplicable/.test(text)) return ['Miscellaneous','Unknown','Strange Object'];

  const wcText = n + ' ' + ((item.desc || '') + ' ' + (item.effect || '')).toLowerCase();
  const wcMagicKeyword = /magical|magic\b|enchant|arcane|spell\b|rune|glowing|shimmer|ench\.|attunement|curse|blessed|\bholy\b(?!\s*days?)|\bdivine\b(?!\s*service)|conjure|summon/.test(wcText);
  const wcRarity = rarity || item.rarity;
  const wcIsMagical = wcMagicKeyword || (wcRarity && wcRarity !== 'common' && item.effect);
  if (item.effect && wcIsMagical) {
    if (/\bbag\b|\bhole\b|\bbottle\b|\bflask\b|\bvessel\b|\bwell\b|\bapparatus\b/.test(n)) return ['Miscellaneous','Wondrous Item','Storage / Container'];
    if (/\bchime\b|\bdecanter\b|\bdriftglobe\b|\bram\b|\bfan\b|\bpipes?\b|\bhorn\b|\bcandle\b/.test(n)) return ['Miscellaneous','Wondrous Item','Environmental / Utility'];
    if (/\beye of\b|\bhand of\b|\bsphere\b|\bcube\b|\bscarab\b|\bgem\b|\bcrystal ball\b|\bioun stone\b|\bshard\b|\borb\b/.test(n)) return ['Miscellaneous','Wondrous Item','Relic / Artifact'];
    return ['Miscellaneous','Wondrous Item','Unique Wondrous Item'];
  }
  if (item.effect) {
    if (/\bsack\b|\bpouch\b|\bbackpack\b|\bsatchel\b/.test(n)) return ['Miscellaneous','Adventuring Gear','Container'];
    if (/tinderbox|\bflint\b/.test(n)) return ['Miscellaneous','Adventuring Gear','Fire-Starting'];
    if (/bedroll|\bblanket\b/.test(n)) return ['Miscellaneous','Adventuring Gear','Bedding'];
    if (/whetstone/.test(n)) return ['Miscellaneous','Adventuring Gear','Maintenance'];
    if (/\bmirror\b/.test(n)) return ['Miscellaneous','Adventuring Gear','Mirror'];
    if (/parchment|\bpaper\b/.test(n)) return ['Miscellaneous','Adventuring Gear','Writing Material'];
    if (/\bpot\b|\bpan\b|\bkettle\b/.test(n)) return ['Miscellaneous','Adventuring Gear','Cookware'];
    return ['Miscellaneous','Adventuring Gear','General Gear'];
  }
  return ['Miscellaneous','Unknown','Unidentified Object'];
}

export function deriveItemProperties(item, rarity) {
  const props = [];
  const text = ((item.name || '') + ' ' + (item.desc || '') + ' ' + (item.effect || '')).toLowerCase();
  const r = rarity || item.rarity || 'common';
  if (r === 'rare' || r === 'superrare') props.push('Rare');
  if (r === 'legendary' || r === 'celestial') { props.push('Rare'); props.push('Unique'); }
  const magicKeyword = /magical|magic\b|enchant|arcane|spell\b|rune|glowing|shimmer|ench\.|attunement|curse|blessed|\bholy\b(?!\s*days?)|\bdivine\b(?!\s*service)|conjure|summon/.test(text);
  const magicByRarity = ['weapon', 'armor', 'consumable'].includes(item.type) && r !== 'common' && item.effect;
  if (magicKeyword || magicByRarity) props.push('Magical');
  if (/curse|cursed/.test(text)) props.push('Cursed');
  if (/attunement/.test(text)) props.push('Soulbound');
  if ((item.weight || 0) >= 15) props.push('Heavy');
  if (item.charges === undefined && item.type === 'weapon') props.push('Durable');
  if (/quest|bounty/.test(text)) props.push('Quest Item');
  // Word-boundary fix (found via a direct audit, e.g. a "Tattered Treasure Map"'s "edges
  // burnt" wrongly earning a Fire badge): bare substrings without \b matched fragments of
  // unrelated words — "ice" inside "serviceable"/"device"/"dice"/"twice" (-> Cold), "toxic"
  // inside "intoxicating" (-> Poison). Left unbounded where audited and found correct:
  // Lightning/Necrotic/Radiant/compound dragon-prefixed names elsewhere in this file — those
  // already only match real thematic words, not substring accidents. "burnt"/"burned" are
  // deliberately excluded from Fire's own trigger list (kept: burn/burns/burning) since past-
  // tense "burnt" reads at least as often as physical wear/char ("burnt edges") as active fire.
  if (/\bfire\b|\bflame(s)?\b|\bburn(s|ing)?\b|\bember(s)?\b/.test(text)) props.push('Fire');
  if (/\bcold\b|\bfrost(y|bite)?\b|\bice\b/.test(text)) props.push('Cold');
  if (/lightning|thunder|shock/.test(text)) props.push('Lightning');
  if (/\bpoison(s|ed|ous|ing)?\b|\bvenom(ous)?\b|\btoxic\b/.test(text)) props.push('Poison');
  if (/necrotic|undead|death\b/.test(text)) props.push('Necrotic');
  if (/radiant|\bholy\b(?!\s*days?)|\bdivine\b(?!\s*service)/.test(text)) props.push('Radiant');
  return [...new Set(props)];
}

export function deriveItemTags(item, classification, properties) {
  const tags = new Set();
  const leaf = classification[classification.length - 1];
  if (leaf) tags.add(leaf.toLowerCase().replace(/[^a-z0-9]+/g, ''));
  classification.forEach(seg => tags.add(seg.toLowerCase().replace(/[^a-z0-9]+/g, '')));
  if (item.type === 'weapon' || classification[0] === 'Weapon') tags.add('weapon');
  if (item.type === 'armor' || classification[0] === 'Armor') tags.add('armor');
  if (classification[0] === 'Material') tags.add('crafting');
  if (item.subcategory === 'potion' || item.subcategory === 'throwable') tags.add('alchemy');
  if (item.type === 'craftable') tags.add('crafting');
  properties.forEach(p => { if (['Fire','Cold','Lightning','Poison','Necrotic','Radiant'].includes(p)) tags.add(p.toLowerCase()); });
  const text = ((item.name || '') + ' ' + (item.desc || '')).toLowerCase();
  if (/undead|zombie|skeleton|lich|ghoul|wraith/.test(text)) tags.add('undead');
  // Same word-boundary audit as deriveItemProperties above: bare "king"/"elder" matched
  // fragments of "cooking"/"working"/"marking"/"drinking" and "wielder" respectively — real,
  // confirmed false positives (109 and 13 items across the catalog), not judgment calls.
  // "ancient"/"primordial"/"dragon"/"wyrm" left bare on purpose: audited and found correct,
  // including compound dragon-prefixed item names ("Dragonhide", "Dragonlance") that a strict
  // \bdragon\b boundary would have wrongly excluded.
  if (/\bking(s|dom)?\b|\bqueen(s)?\b|\broyal(ty)?\b|\bnoble(s)?\b|\bcrown(s|ed)?\b|\bthrone(s)?\b/.test(text)) tags.add('royal');
  if (/ancient|primordial|\belder\b/.test(text)) tags.add('ancient');
  if (/dragon|wyrm/.test(text)) tags.add('dragon');
  if (item.sourceMonster) tags.add(item.sourceMonster.toLowerCase().replace(/[^a-z0-9]+/g, ''));
  return [...tags].filter(Boolean);
}

// Runs all three axes and stores them on the item — idempotent (skips items that already have
// a classification) so it's safe to call repeatedly across every code path that constructs an
// item. Mutates and returns `item`, matching the monolith's original behavior exactly.
export function classifyItemFull(item, rarity) {
  if (item.classification) return item;
  item.classification = classifyItemHierarchy(item, rarity);
  item.properties = deriveItemProperties(item, rarity);
  item.tags = deriveItemTags(item, item.classification, item.properties);
  item.interactions = computeItemInteractions(item);
  return item;
}

// ===================== CHARACTER SHEET =====================
// Extracted verbatim. Already designed with injected dependencies in the monolith
// (`resolveItem` callback rather than a hardcoded lookup) — no changes needed to make this pure.

export const ABILITY_NAMES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
export const SKILL_ABILITY_MAP = {
  'Athletics': 'str',
  'Acrobatics': 'dex', 'Sleight of Hand': 'dex', 'Stealth': 'dex',
  'Arcana': 'int', 'History': 'int', 'Investigation': 'int', 'Nature': 'int', 'Religion': 'int',
  'Animal Handling': 'wis', 'Insight': 'wis', 'Medicine': 'wis', 'Perception': 'wis', 'Survival': 'wis',
  'Deception': 'cha', 'Intimidation': 'cha', 'Performance': 'cha', 'Persuasion': 'cha',
};
export const SHEET_STAT_ALIASES = {
  'Max HP': 'Maximum Hit Points', 'Max Hit Points': 'Maximum Hit Points',
  'AC': 'Armor Class', 'Speed': 'Movement Speed',
};

// There is NO built-in proficiency bonus: not by level, not a flat +2. Ticking a skill/save/weapon
// proficiency only marks you as proficient; the number added comes entirely from gear or feats that
// say "+N to your proficiency bonus" (collectProficiencyBoost). The `level` argument is kept so the
// existing call sites don't change.
export const PROFICIENCY_BONUS = 0;
export function proficiencyBonusForLevel(level) {
  return PROFICIENCY_BONUS;
}
// "+1 to your proficiency bonus" on gear or in a feat -> 1 (summed across every match).
export function parseProficiencyBonusBoost(text) {
  let total = 0, m;
  const re = /\+(\d+)\s+(?:to\s+)?(?:your\s+)?proficiency bonus/gi;
  const t = String(text || '').replace(/<[^>]+>/g, ' ');
  while ((m = re.exec(t)) !== null) total += parseInt(m[1], 10);
  return total;
}
// Every "+N to your proficiency bonus" on equipped gear or in an active effect/feat ->
// { total, sources:[{ source, amount }] }. This is the whole proficiency bonus.
export function collectProficiencyBoost(slots, resolveItem, activeEffects) {
  const sources = [];
  const add = (source, text) => { const n = parseProficiencyBonusBoost(text); if (n) sources.push({ source, amount: n }); };
  Object.keys(slots || {}).forEach(slotId => {
    const key = slots[slotId];
    if (!key || sources.some(s => s.key === key)) return;
    const entry = resolveItem(key);
    if (!entry || !entry.item) return;
    const it = entry.item;
    const before = sources.length;
    // Some items carry the same text twice (a flattened `effect` AND the `mods` it came from — Fleshmancer
    // limbs, many generated items), so take the larger of the two readings instead of adding them.
    const n = Math.max(parseProficiencyBonusBoost(it.effect), parseProficiencyBonusBoost((it.mods || []).map(m => m.text).join(' ')));
    if (n) sources.push({ source: it.name, amount: n });
    if (sources.length > before) sources[sources.length - 1].key = key; // the same item in two slots counts once
  });
  (activeEffects || []).forEach(e => { if (e && e.text) add(e.name || 'Active effect', e.text); });
  return { total: sources.reduce((n, s) => n + s.amount, 0), sources: sources.map(({ source, amount }) => ({ source, amount })) };
}
export function abilityModifier(score) { return Math.floor((score - 10) / 2); }
export function fmtMod(n) { return (n >= 0 ? '+' : '') + n; }

// Item stats that have no dedicated sheet field but are still real, numeric, equippable bonuses.
// They are collected into computeCharacterSheetFor(...).otherStats and shown on the sheet under
// "Other bonuses" (Initiative and Spell Save DC also feed the init banner and spell save DCs;
// Damage Dealt feeds weapon damage — see the monolith).
export const OTHER_SHEET_STATS = [
  'Initiative', 'Spell Save DC', 'Damage Dealt', 'Critical Hit Range', 'Spell Slot Level', 'Healing Received', 'Death Saving Throws',
  'Darkvision Range (feet)', 'Tremorsense Range (feet)', 'Telepathy Range (feet)',
  'Fly Speed (feet)', 'Swim Speed (feet)', 'Burrow Speed (feet)', 'Carrying Capacity (lbs)',
];
// Names the generators can roll that have no sheet field of their own (the invented skills like
// "Trap Expertise") are registered here once at startup so a "+N Trap Expertise" bonus is collected
// into otherStats instead of silently ignored.
export function registerCustomSheetStats(names) {
  (names || []).forEach(n => { if (n && !OTHER_SHEET_STATS.includes(n) && !(n in SKILL_ABILITY_MAP) && !Object.values(ABILITY_NAMES).includes(n)) OTHER_SHEET_STATS.push(n); });
  _sheetStatVocabRegex = null;
}
let _sheetStatVocabRegex = null;
export function extractStatDeltasFromText(text) {
  if (!text) return [];
  if (!_sheetStatVocabRegex) {
    const names = new Set([...Object.values(ABILITY_NAMES), 'Maximum Hit Points', 'Saving Throws', 'Armor Class', 'Movement Speed', ...Object.keys(SKILL_ABILITY_MAP), ...Object.keys(SHEET_STAT_ALIASES), ...OTHER_SHEET_STATS]);
    const alt = [...names].sort((a, b) => b.length - a.length).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    _sheetStatVocabRegex = new RegExp(`([+-]\\d+)\\s+(${alt})(?![A-Za-z0-9])`, 'g');
  }
  const plain = String(text).replace(/<[^>]+>/g, ' ');
  const out = [];
  let m;
  _sheetStatVocabRegex.lastIndex = 0;
  while ((m = _sheetStatVocabRegex.exec(plain))) {
    out.push({ stat: SHEET_STAT_ALIASES[m[2]] || m[2], amount: parseInt(m[1], 10) });
  }
  return out;
}

// Real bug found in testing: a Potion of Storm Giant Strength ("Strength set to 29 (Storm
// Giant) for 1 hour. No effect if Strength already 29+.") produced no stat change at all when
// drunk. Two compounding gaps, both fixed here and in computeCharacterSheetFor below: (1) every
// "Belt/Potion of Giant Strength" item (and any other item phrased as an ABSOLUTE score rather
// than a "+N Stat" delta — "Strength score is 27", "Strength score becomes 23", "Strength set to
// 29") was invisible to extractStatDeltasFromText above, which only ever recognizes a leading
// +/- sign; (2) activeTimedEffects (what a consumable's duration actually creates — see
// startTimedEffect in the monolith) was never read by the character sheet computation at all,
// equipped gear only — so even a "+2 Strength" TEMPORARY buff from a potion would have been just
// as inert as this one, not only the absolute-value phrasing. This only ever raises a score
// up to its stated value (never lowers one already higher), matching every one of these items'
// own "no effect if already at or above N" wording.
let _sheetStatSetVocabRegex = null;
export function extractStatSetValuesFromText(text) {
  if (!text) return [];
  if (!_sheetStatSetVocabRegex) {
    const alt = Object.values(ABILITY_NAMES).sort((a, b) => b.length - a.length).join('|');
    _sheetStatSetVocabRegex = new RegExp(`\\b(${alt})\\b(?:\\s+score)?\\s+(?:is|becomes|set to)\\s+(\\d+)`, 'gi');
  }
  const plain = String(text).replace(/<[^>]+>/g, ' ');
  const out = [];
  let m;
  _sheetStatSetVocabRegex.lastIndex = 0;
  while ((m = _sheetStatSetVocabRegex.exec(plain))) {
    // Matches ABILITY_NAMES values case-insensitively but ABILITY_NAMES itself is canonically
    // capitalized ("Strength") — normalize m[1]'s casing back to that canonical form so callers
    // can key off it the same way extractStatDeltasFromText's `stat` field already does.
    const canonical = Object.values(ABILITY_NAMES).find(n => n.toLowerCase() === m[1].toLowerCase()) || m[1];
    out.push({ stat: canonical, value: parseInt(m[2], 10) });
  }
  return out;
}

export function uniqueEquippedSlotEntries(slots) {
  const seen = new Set();
  const out = [];
  Object.keys(slots).forEach(slotId => {
    const key = slots[slotId];
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push([slotId, key]);
  });
  return out;
}

// ===================== MIGRATED-ITEM BRIDGE =====================
// A migrated item (see docs/V2_MECHANICS_MIGRATION.md) carries its passive stat bonuses as a
// structured `passive: [{stat, value}]` array, computed
// ONCE by the migration script from the exact same extractStatDeltasFromText/extractStatSetValuesFromText
// regex this file already runs — so reading `passive` back out here reproduces the live-regex
// result exactly, just from the migration's frozen structured output instead of re-parsing prose
// on every call (the canonical data becomes the runtime source, not a live conversion of it).
// Ability-score keys ('str'..'cha') carry the SAME raw-score-delta convention legacy .effect text
// always meant (e.g. "+2 Strength" -> a 2-point SCORE bump) — not a modifier-delta convention,
// since these numbers were extracted from migrated legacy items, not authored fresh against a
// different spec.
// 'attackRoll'/'damageRoll' are deliberately excluded: those feed weapon-attack math, a separate
// concern from the character sheet (see computeWeaponAttackRoll in the monolith).
const CANONICAL_STAT_TO_BREAKDOWN_LABEL = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
  hp_max: 'Maximum Hit Points', speed: 'Movement Speed', ac: 'Armor Class',
};
const CANONICAL_SAVE_STAT_KEYS = ['save_str', 'save_dex', 'save_con', 'save_int', 'save_wis', 'save_cha'];

// Structured equivalent of extractStatDeltasFromText for a migrated item's canonical `passive`
// array. The migration script only ever emits a "Saving Throws" text delta as all six save_<abbr>
// entries together with an equal value (toStatModifiers in scripts/migrate-legacy-content.js) —
// matching the live app's own single flat "Saving Throws" bucket applied to every save alike (see
// computeCharacterSheetFor below) — so those six are collapsed back into one entry here rather
// than quietly summed six times over.
export function canonicalPassiveDeltas(canonicalItem) {
  const passive = (canonicalItem && canonicalItem.passive) || [];
  const out = [];
  let saveGroup = null;
  passive.forEach(({ stat, value }) => {
    if (CANONICAL_SAVE_STAT_KEYS.includes(stat)) {
      if (!saveGroup) saveGroup = { value, count: 0 };
      if (value === saveGroup.value) saveGroup.count += 1;
      return;
    }
    const label = CANONICAL_STAT_TO_BREAKDOWN_LABEL[stat] || (SKILL_ABILITY_MAP[stat] ? stat : null);
    if (label) out.push({ stat: label, amount: value });
  });
  if (saveGroup && saveGroup.count === CANONICAL_SAVE_STAT_KEYS.length) {
    out.push({ stat: 'Saving Throws', amount: saveGroup.value });
  }
  return out;
}

// Structured equivalent of collectEquippedAcBreakdown's per-item .ac-string parsing, for a
// migrated `armor` item. A non-additive (body-slot) baseAC REPLACES the running base, matching the
// old body-armor convention (a bare unsigned number in the armor slot fully replacing default AC
// 10); an additive baseAC (shield/accessory slot) stacks as a flat bonus, matching the old "+N"
// accessory convention. Returns null for anything without an `armor` facet (a migrated weapon/
// wondrous/companion item's AC-flavored passive, if any, is handled by canonicalPassiveDeltas'
// 'Armor Class' bucket instead — the same secondary text-rider layering the old system already
// does on top of an item's own .ac field).
export function canonicalAcContribution(canonicalItem) {
  const armor = canonicalItem && canonicalItem.armor;
  if (!armor) return null;
  return armor.additive ? { flatAmount: armor.baseAC } : { replaceBase: armor.baseAC };
}

// Structured equivalent of parseWeaponEffectBonuses (dungeon_loot_wheel_v102_spell_details.html)
// for a migrated weapon's canonical `weapon` facet, consumed by that same file's
// computeWeaponAttackRoll. Reads pre-computed atkBonus/dmgBonus/bonusDamage/finesse directly
// instead of regexing .effect — and, unlike the live regex path, can never reproduce
// dungeon-master-box's own confirmed double-counted-damage-bonus bug (see
// docs/V2_MECHANICS_MIGRATION.md): the migration already reconciled a weapon's `dmg` field's
// embedded flat modifier against a redundant "+N to damage rolls" effect-text phrase into a single
// passive `damageRoll` entry (scripts/migrate-legacy-content.js's migrateWeapon), and
// `weapon.damageDice` itself is deliberately the BASE dice only, with no modifier baked in, so
// nothing here can double what a not-yet-migrated item's own live regex path still can.
export function canonicalWeaponAttackData(canonicalItem) {
  const weapon = (canonicalItem && canonicalItem.weapon) || {};
  const passive = (canonicalItem && canonicalItem.passive) || [];
  const atkBonus = passive.filter(m => m.stat === 'attackRoll').reduce((sum, m) => sum + m.value, 0);
  const dmgBonus = passive.filter(m => m.stat === 'damageRoll').reduce((sum, m) => sum + m.value, 0);
  const bonusDiceClauses = (weapon.bonusDamage || []).map(({ dice, type }) => ({ dice, type }));
  const finesse = (weapon.properties || []).includes('finesse');
  return { damageDice: weapon.damageDice || '', atkBonus, dmgBonus, bonusDiceClauses, finesse };
}

// Structured equivalent of applyHealFromItem's item.hp dice-formula read (the monolith), for a
// migrated consumable's canonical `consumable.effects` array. Every one of the migration's 8 real
// `heal`-kind entries carries the exact same dice string dungeon-master-box's own item.hp field
// already had (verified directly against loot-data.js, not assumed) — this only changes WHERE the
// dice string is read from, never what it evaluates to. A migrated consumable with no structured
// heal effect (the "utility" placeholder most consumables get — see
// docs/V2_MECHANICS_MIGRATION.md's "Deliberately not decided here": buff/debuff/temp-HP/"Full HP"
// extraction from consumable text was never attempted) returns null here, same as item.hp already
// produces today for those items (rollDiceFormulaTotal finds no dice pattern in "10 temp HP" or
// "Full HP" either) — no behavior lost or gained beyond the 8 items that resolve identically either way.
export function canonicalConsumableHealDice(canonicalItem) {
  const effects = (canonicalItem && canonicalItem.consumable && canonicalItem.consumable.effects) || [];
  const healEffect = effects.find(e => e.kind === 'heal' && e.healDice);
  return healEffect ? healEffect.healDice : null;
}

// The always-on (passive) text of an item, which is what the sheet reads. A hand-authored catalog
// item carries it in `.effect`. A generated item (Store, Generate Item, wheel modifiers) has no
// `.effect` — its effects live in `mods` — so the passive mods (affixes, traits, self-curses,
// skill aptitudes) are turned into stat-parseable clauses here. Activated mods (a buff you trigger
// "1x per day", a spell, a summon) are NOT passive and are left to the ability bar.
export function passiveModText(mod) {
  if (!mod || !mod.text) return '';
  const plain = String(mod.text).replace(/<[^>]+>/g, ' ');
  if (mod.type === 'Affix' || mod.type === 'Trait') return plain;
  if (mod.type === 'Debuff' && /^\s*While attuned/i.test(plain)) return plain;
  if (mod.type === 'Skill') {
    const skill = String(mod.key || '').replace(/^skill:/, '');
    const n = (plain.match(/\+(\d+)/) || [])[1];
    return skill && n ? `+${n} ${skill}.` : '';
  }
  return '';
}
export function itemMechanicsText(item) {
  if (!item) return '';
  const passive = Array.isArray(item.mods) ? item.mods.map(passiveModText).filter(Boolean).join(' ') : '';
  return [item.effect, passive].filter(Boolean).join(' ');
}
export function collectEquippedStatBreakdown(slots, resolveItem) {
  const breakdown = {};
  uniqueEquippedSlotEntries(slots).forEach(([slotId, key]) => {
    const entry = resolveItem(key);
    if (!entry) return;
    const deltas = entry.item.__canonical
      ? canonicalPassiveDeltas(entry.item.__canonical)
      : extractStatDeltasFromText(itemMechanicsText(entry.item));
    deltas.forEach(({ stat, amount }) => {
      (breakdown[stat] = breakdown[stat] || []).push({ itemName: entry.item.name, amount });
    });
  });
  return breakdown;
}
// Temporary buffs (a potion, a power with a duration — see startTimedEffect in the monolith)
// live in activeTimedEffects, completely separate from equipped gear, but use the exact same
// "+N Stat" effect-text phrasing. Folds their deltas into the same breakdown equipped gear
// produces so a currently-active "+2 Strength" buff shows up in the character sheet exactly
// like a worn item's would — see the module comment on extractStatSetValuesFromText above for
// the real bug this (and its set-value counterpart below) fixes.
export function addActiveEffectDeltas(breakdown, activeEffects) {
  (activeEffects || []).forEach(effect => {
    extractStatDeltasFromText(effect.text).forEach(({ stat, amount }) => {
      (breakdown[stat] = breakdown[stat] || []).push({ itemName: effect.name, amount });
    });
  });
  return breakdown;
}
// Ability scores an item/effect sets to an ABSOLUTE value rather than a delta — "Strength score
// is 27", "Strength set to 29 (Storm Giant) for 1 hour" — collected from both equipped gear and
// active timed effects the same way addActiveEffectDeltas mirrors collectEquippedStatBreakdown.
// Every one of these items is worded "no effect if [stat] already N+", so the caller applies
// this as a floor (Math.max against the already-computed total), never a blind overwrite that
// could lower a score some OTHER source already pushed higher.
export function collectStatSetOverrides(slots, resolveItem, activeEffects) {
  const overrides = {};
  uniqueEquippedSlotEntries(slots).forEach(([slotId, key]) => {
    const entry = resolveItem(key);
    if (!entry) return;
    extractStatSetValuesFromText(itemMechanicsText(entry.item)).forEach(({ stat, value }) => {
      (overrides[stat] = overrides[stat] || []).push({ itemName: entry.item.name, value });
    });
  });
  (activeEffects || []).forEach(effect => {
    extractStatSetValuesFromText(effect.text).forEach(({ stat, value }) => {
      (overrides[stat] = overrides[stat] || []).push({ itemName: effect.name, value });
    });
  });
  return overrides;
}
export function sumBreakdown(sources) { return (sources || []).reduce((a, s) => a + s.amount, 0); }
export function statusFor(net) { return net > 0 ? 'buff' : net < 0 ? 'debuff' : ''; }
export function describeStatSources(sources) {
  return (sources || []).map(s => s.isBaseOverride
    ? `${s.itemName} (base ${s.amount + 10})`
    : `${s.itemName} (${fmtMod(s.amount)}${s.viaAbility ? ' ' + s.viaAbility : ''})`
  ).join(', ');
}

// `bodyArmorStyle` is the equipped body armor's weight class ('light'/'medium'/'heavy'), read
// from a canonical item's already-computed `armor.armorType` (migrateArmor sets this on every
// migrated armor item, but nothing previously read it back out — see effectiveDexModForArmorStyle
// below) or a legacy item's own `armorStyle` field (added going forward — see loot-data.js's armor
// rebalance). null when no body armor is equipped, or an equipped legacy item predates that field
// — both cases keep today's behavior (full, uncapped Dex mod) rather than assuming a weight class.
// ---- Armor AC sanity ----------------------------------------------------------------------------
// Body armor REPLACES the unarmoured base of 10, so its number must be above 10 or wearing it makes you worse off. Many catalogue and
// generated pieces were authored with values of 5-10 (a leather armor "AC 6"), and helmets with body-armor-sized numbers (a helm "AC 13").
// These helpers give every piece a believable value from what it IS (name) and how rare it is, and never LOWER an authored value.
export const BODY_ARMOR_BASE_AC = [
  [/half[- ]?plate/, 15], [/\bplate\b|plate armor|full plate/, 18], [/splint/, 17], [/chain ?mail|hauberk/, 16], [/ring ?mail/, 14], [/scale/, 14],
  [/breastplate|cuirass|brigandine|lamellar/, 14], [/chain shirt|chain/, 13], [/studded/, 12], [/hide/, 12], [/padded|gambeson|quilted/, 11], [/leather|jerkin|vest|tunic|coat/, 11],
  [/robe|vestment|cassock/, 11],
];
export const BODY_RARITY_AC_BONUS = { common: 0, uncommon: 1, rare: 2, superrare: 3, legendary: 4, celestial: 5 };
export const ACCESSORY_BASE_AC = [[/great helm|war helm|full helm/, 2], [/helm|helmet|cap\b|crown|circlet|coif|diadem|tiara/, 1], [/bracer|vambrace/, 2], [/gauntlet|glove/, 1], [/greave/, 2], [/boot|sandal/, 1], [/cloak|cape|mantle/, 1], [/belt|girdle|sash/, 1]];
export const ACCESSORY_RARITY_AC_BONUS = { common: 0, uncommon: 0, rare: 0, superrare: 1, legendary: 1, celestial: 2 };
export function isShieldName(name) { return /\b(shield|buckler)\b/i.test(name || ''); }
function tableValue(table, name) { const n = String(name || '').toLowerCase(); const hit = table.find(([re]) => re.test(n)); return hit ? hit[1] : null; }
export function bodyArmorBaseFromName(name) { return tableValue(BODY_ARMOR_BASE_AC, name); }
export function normalizedBodyArmorAc(item, rarity) {
  const raw = parseInt(String((item && item.ac) == null ? '' : item.ac).trim(), 10);
  const base = bodyArmorBaseFromName(item && item.name);
  const r = rarity || (item && item.rarity) || 'common';
  const b = base != null ? base : 11;
  // An authored value of 11 or more stays exactly as written (anything above 10 is a real improvement on no armor); a value of 10 or
  // less (a leather armor "AC 6") would make the wearer WORSE off, so it is rebuilt from the piece's name and rarity.
  if (Number.isFinite(raw) && raw >= 11) return raw;
  return b + (BODY_RARITY_AC_BONUS[r] || 0);
}
// A non-body piece (helm, bracers, boots ...) adds a small flat bonus; a bare number on it is NOT a base value.
export function normalizedAccessoryAc(item, rarity) {
  const base = tableValue(ACCESSORY_BASE_AC, item && item.name);
  const r = rarity || (item && item.rarity) || 'common';
  return (base != null ? base : 1) + (ACCESSORY_RARITY_AC_BONUS[r] || 0);
}
export function collectEquippedAcBreakdown(slots, resolveItem) {
  let base = 10, baseSource = null, bodyArmorStyle = null;
  const flatSources = [], armorPieces = [];
  uniqueEquippedSlotEntries(slots).forEach(([slotId, key]) => {
    const entry = resolveItem(key);
    if (!entry) return;
    if (slotId === 'armor' || entry.item.type === 'armor' || (entry.item.__canonical && entry.item.__canonical.armor)) armorPieces.push({ item: entry.item, rarity: entry.rarity || entry.item.rarity });
    if (entry.item.__canonical) {
      const contribution = canonicalAcContribution(entry.item.__canonical);
      if (!contribution) return;
      if (contribution.replaceBase != null && slotId === 'armor' && !isShieldName(entry.item.name)) {
        base = normalizedBodyArmorAc({ name: entry.item.name, ac: String(contribution.replaceBase) }, entry.rarity || entry.item.rarity); baseSource = entry.item.name;
        bodyArmorStyle = entry.item.__canonical.armor.armorType || null;
      }
      else if (contribution.replaceBase != null) flatSources.push({ itemName: entry.item.name, amount: normalizedAccessoryAc(entry.item, entry.rarity) });
      else flatSources.push({ itemName: entry.item.name, amount: contribution.flatAmount });
      return;
    }
    const raw = String(entry.item.ac || '').trim();
    if (!raw) return;
    if (slotId === 'armor' && /^\d+$/.test(raw) && !isShieldName(entry.item.name)) {
      base = normalizedBodyArmorAc(entry.item, entry.rarity); baseSource = entry.item.name;
      bodyArmorStyle = entry.item.armorStyle || null;
      return;
    }
    if (/^\d+$/.test(raw)) { flatSources.push({ itemName: entry.item.name, amount: normalizedAccessoryAc(entry.item, entry.rarity) }); return; }
    const m = /^([+-]\d+)$/.exec(raw);
    if (m) flatSources.push({ itemName: entry.item.name, amount: parseInt(m[1], 10) });
  });
  return { base, baseSource, flatSources, bodyArmorStyle, armorPieces };
}
// Standard 5e Dex-mod-by-armor-weight rule, never previously applied live (armorType/addsDexMod/
// dexModCap were computed by migrateArmor and stored on every canonical armor item, but nothing in
// this file or the monolith ever read them back out — confirmed by a full-repo grep before this fix
// — so Dex was added to AC unconditionally and uncapped for every armor weight, heavy included).
// Light: full Dex mod. Medium: capped at +2. Heavy: none. No body armor equipped, or a legacy item
// with no armorStyle field yet, passes `style` as null and keeps the prior uncapped behavior.
export function effectiveDexModForArmorStyle(style, dexMod) {
  if (style === 'heavy') return 0;
  if (style === 'medium') return Math.min(dexMod, 2);
  return dexMod;
}

export function computeCharacterSheetFor(abilityScores, level, skillProfs, saveProfs, slots, resolveItem, baseMaxHp, baseSpeed, activeEffects) {
  const breakdown = addActiveEffectDeltas(collectEquippedStatBreakdown(slots, resolveItem), activeEffects);
  const setOverrides = collectStatSetOverrides(slots, resolveItem, activeEffects);
  const abilities = {};
  Object.keys(ABILITY_NAMES).forEach(abbr => {
    const full = ABILITY_NAMES[abbr];
    let base = abilityScores[abbr] != null ? abilityScores[abbr] : 10;
    // A rerolled-scores effect (Fragment of Pride) replaces the character's own base score outright;
    // gear and other effects still stack on top of the rolled value.
    (activeEffects || []).forEach(e => { if (e && e.baseOverride && e.baseOverride[abbr] != null) base = e.baseOverride[abbr]; });
    let sources = breakdown[full] || [];
    let total = base + sumBreakdown(sources);
    // A set-value item/effect ("Strength set to 29") only ever raises the score up to its
    // stated value, matching its own "no effect if already N+" wording — never applied if the
    // current total (base + every "+N" source already summed) is already at or above it.
    const winningOverride = (setOverrides[full] || []).reduce((best, o) => (!best || o.value > best.value) ? o : best, null);
    if (winningOverride && winningOverride.value > total) {
      total = winningOverride.value;
      sources = [...sources, { itemName: winningOverride.itemName, amount: winningOverride.value - 10, isBaseOverride: true }];
    }
    const bonus = total - base;
    const mod = abilityModifier(total);
    const modDelta = mod - abilityModifier(base);
    abilities[abbr] = { base, bonus, total, mod, modDelta, sources, status: statusFor(bonus), tooltip: describeStatSources(sources) };
  });
  const profBoost = collectProficiencyBoost(slots, resolveItem, activeEffects);
  const profBonus = proficiencyBonusForLevel(level || 1) + profBoost.total;
  const saveFlatSources = breakdown['Saving Throws'] || [];
  const saveFlatTotal = sumBreakdown(saveFlatSources);
  const saves = {};
  Object.keys(ABILITY_NAMES).forEach(abbr => {
    const a = abilities[abbr];
    const full = ABILITY_NAMES[abbr];
    const proficient = (saveProfs || []).includes(full);
    const total = a.mod + (proficient ? profBonus : 0) + saveFlatTotal;
    const viaAbility = a.modDelta ? a.sources.map(s => ({ itemName: s.itemName, amount: s.amount, viaAbility: full })) : [];
    const sources = [...viaAbility, ...saveFlatSources];
    saves[abbr] = { total, sources, status: statusFor(a.modDelta + saveFlatTotal), tooltip: describeStatSources(sources) };
  });
  const skills = {};
  Object.keys(SKILL_ABILITY_MAP).forEach(skill => {
    const abbr = SKILL_ABILITY_MAP[skill];
    const a = abilities[abbr];
    const proficient = (skillProfs || []).includes(skill);
    const directSources = breakdown[skill] || [];
    const directTotal = sumBreakdown(directSources);
    const total = a.mod + (proficient ? profBonus : 0) + directTotal;
    const viaAbility = a.modDelta ? a.sources.map(s => ({ itemName: s.itemName, amount: s.amount, viaAbility: ABILITY_NAMES[abbr] })) : [];
    const sources = [...viaAbility, ...directSources];
    skills[skill] = { total, sources, status: statusFor(a.modDelta + directTotal), tooltip: describeStatSources(sources) };
  });
  const acField = collectEquippedAcBreakdown(slots, resolveItem);
  const dex = abilities.dex;
  const armorScaling = computeArmorScalingAc(acField.armorPieces, Object.fromEntries(SCALING_STATS.map(k => [k, abilities[k].mod])));
  const effectiveDexMod = armorScaling.total;
  const baseSourceEntry = acField.baseSource ? [{ itemName: acField.baseSource, amount: acField.base - 10, isBaseOverride: true }] : [];
  const viaDex = armorScaling.total ? [{ itemName: 'Armor scaling (' + formatScaling(armorScaling.scaling).split(' · ').slice(0, 3).join(' · ') + ')', amount: armorScaling.total }] : [];
  const acFlatTotal = sumBreakdown(acField.flatSources);
  // Text-driven "+N Armor Class" sources -- e.g. a named trait like Vanguard, or a DM-attached
  // modifier -- layer on top of the item's own .ac field the same way a temporary buff already
  // layers on top of equipped gear, rather than requiring every AC source to live in one field.
  const acTextSources = breakdown['Armor Class'] || [];
  const acTextTotal = sumBreakdown(acTextSources);
  const acSources = [...baseSourceEntry, ...acField.flatSources, ...viaDex, ...acTextSources];
  // effectiveDexMod (not the raw dex.mod) so heavy/medium body armor actually caps/zeroes the Dex
  // contribution to AC per standard rules (see effectiveDexModForArmorStyle) -- everywhere else
  // dex.mod is used unchanged (skills, saves, etc.), since the weight-class cap is AC-specific.
  const acTotal = acField.base + effectiveDexMod + acFlatTotal + acTextTotal;
  const acNet = (acField.base - 10) + acFlatTotal + dex.modDelta + acTextTotal;
  const ac = { total: acTotal, sources: acSources, status: statusFor(acNet), tooltip: describeStatSources(acSources) };
  const maxHpSources = breakdown['Maximum Hit Points'] || [];
  const maxHpBonus = sumBreakdown(maxHpSources);
  const base = baseMaxHp != null ? baseMaxHp : 0;
  const maxHp = { base, bonus: maxHpBonus, total: base + maxHpBonus, sources: maxHpSources, status: statusFor(maxHpBonus), tooltip: describeStatSources(maxHpSources) };
  // Movement speed: same "+N Movement Speed" text-delta shape as everything else here (a named
  // trait, a mount, a curse) folded onto a base the player/DM sets directly, same relationship
  // Max HP already has to its own base.
  const speedSources = breakdown['Movement Speed'] || [];
  const speedBonus = sumBreakdown(speedSources);
  const speedBase = baseSpeed != null ? baseSpeed : 30;
  const speed = { base: speedBase, bonus: speedBonus, total: speedBase + speedBonus, sources: speedSources, status: statusFor(speedBonus), tooltip: describeStatSources(speedSources) };
  const otherStats = {};
  OTHER_SHEET_STATS.forEach(name => {
    const sources = breakdown[name] || [];
    const total = sumBreakdown(sources);
    otherStats[name] = { total, sources, status: statusFor(total), tooltip: describeStatSources(sources) };
  });
  return { abilities, profBonus, profBoost, saves, skills, ac, maxHp, speed, otherStats };
}

// ===================== BATTLE =====================

// Pulls "+N to hit", every damage-dice clause (with its damage type), and a save DC out of an
// already-cleaned action/trait text block. Pure text parsing, no dependencies.
export function battleParseAttack(text) {
  const t = text || '';
  const hitMatch = t.match(/([+-]\d+)\s*to hit/i);
  const toHit = hitMatch ? parseInt(hitMatch[1], 10) : null;
  const damageClauses = [];
  const dmgRe = /\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)\s*([a-z]+)?/gi;
  let dm;
  while ((dm = dmgRe.exec(t)) !== null) {
    damageClauses.push({ dice: dm[1].replace(/\s+/g, ''), type: (dm[2] || '').toLowerCase() });
  }
  const dcMatch = t.match(/DC\s*(\d+)/i);
  const saveDC = dcMatch ? parseInt(dcMatch[1], 10) : null;
  return { toHit, damageClauses, saveDC };
}

// Standard 5e crit rule: double the dice, add the flat modifier once. `rand` defaults to
// Math.random so existing callers see identical behavior; tests can inject a seeded generator.
export function battleRollDamage(diceExpr, crit, rand = Math.random) {
  const m = diceExpr.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10), sides = parseInt(m[2], 10);
  const mod = m[3] ? parseInt(m[3], 10) : 0;
  const count = crit ? n * 2 : n;
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(Math.floor(rand() * sides) + 1);
  return { rolls, mod, total: rolls.reduce((a, b) => a + b, 0) + mod };
}

// Used when an attack has no parseable "to hit" — grades effectiveness straight off the raw d20.
export function battleEffectivenessLabel(roll) {
  if (roll === 20) return { label: 'Devastating', cls: 'crit' };
  if (roll >= 15) return { label: 'Strong', cls: 'hit' };
  if (roll >= 10) return { label: 'Moderate', cls: 'hit' };
  if (roll >= 2) return { label: 'Weak', cls: 'miss' };
  return { label: 'Critical Failure', cls: 'miss' };
}

// ===================== SHARED RANDOM HELPERS =====================
// Same behavior as the monolith's rn()/ri(), with an optional injectable random source
// (defaults to Math.random, so default behavior is unchanged).
export function rn(min, max, rand = Math.random) { return Math.floor(rand() * (max - min + 1)) + min; }
export function ri(arr, rand = Math.random) { return arr[Math.floor(rand() * arr.length)]; }
export function weightedPickFromObject(weights, rand = Math.random) {
  const entries = Object.entries(weights);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (!total) return entries.length ? entries[0][0] : 'common';
  let r = rand() * total;
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return entries[0][0];
}

// ===================== GAMBLING: ROULETTE =====================
export const ROULETTE_WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
export const ROULETTE_RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
export const ROULETTE_OUTSIDE_BETS = [
  { type:'red', label:'Red' }, { type:'black', label:'Black' },
  { type:'even', label:'Even' }, { type:'odd', label:'Odd' },
  { type:'low', label:'1–18' }, { type:'high', label:'19–36' },
  { type:'dozen1', label:'1st 12' }, { type:'dozen2', label:'2nd 12' }, { type:'dozen3', label:'3rd 12' },
];

export function rouletteColor(n) { return n === 0 ? 'green' : (ROULETTE_RED_NUMBERS.has(n) ? 'red' : 'black'); }
// TOTAL-return multipliers (stake included), not "X to 1" profit odds.
export function rouletteMultiplier(bet, number) {
  const color = rouletteColor(number);
  switch (bet.betType) {
    case 'straight': return Number(bet.betValue) === number ? 36 : 0;
    case 'red': case 'black': return color === bet.betType ? 2 : 0;
    case 'even': return number !== 0 && number % 2 === 0 ? 2 : 0;
    case 'odd': return number % 2 === 1 ? 2 : 0;
    case 'low': return number >= 1 && number <= 18 ? 2 : 0;
    case 'high': return number >= 19 && number <= 36 ? 2 : 0;
    case 'dozen1': return number >= 1 && number <= 12 ? 3 : 0;
    case 'dozen2': return number >= 13 && number <= 24 ? 3 : 0;
    case 'dozen3': return number >= 25 && number <= 36 ? 3 : 0;
    default: return 0;
  }
}
export function newRouletteTable() { return { phase: 'betting', bets: {}, lastResult: null, roundCounter: 0 }; }
// One live bet per player per round, and bets are final once placed — no clear/cancel.
export function applyRouletteAction(table, action) {
  if (action.type === 'place_bet') {
    if (table.phase !== 'betting' || table.bets[action.playerUid]) return;
    table.bets[action.playerUid] = { username: action.playerUsername, amount: action.amount, betType: action.betType, betValue: action.betValue };
  }
}
// Extracted from the monolith's spinRouletteWheel — the pure resolution core (draw a number,
// compute payouts), with the DOM/global-state/render/push side effects left behind in the
// monolith's thin wrapper. Mutates and returns `table`, matching the original's behavior.
export function resolveRouletteSpin(table, rand = Math.random) {
  const number = ri(ROULETTE_WHEEL_ORDER, rand); // drawn the way a physical wheel actually lands, not numerically
  const color = rouletteColor(number);
  const betsSnapshot = table.bets;
  const payouts = {};
  Object.entries(betsSnapshot).forEach(([uid, bet]) => {
    const mult = rouletteMultiplier(bet, number);
    if (mult > 0) payouts[uid] = Math.round(bet.amount * mult * 100) / 100;
  });
  table.roundCounter = (table.roundCounter || 0) + 1;
  table.lastResult = { roundId: table.roundCounter, number, color, bets: betsSnapshot, payouts };
  table.bets = {};
  table.phase = 'result';
  return table;
}

// ===================== GAMBLING: BLACKJACK =====================
export const CARD_SUITS = ['♠','♥','♦','♣'];
export const CARD_RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

export function freshShuffledDeck(rand = Math.random) {
  const deck = [];
  CARD_SUITS.forEach(s => CARD_RANKS.forEach(r => deck.push({ r, s })));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
export function cardValue(card) {
  if (card.r === 'A') return 11;
  if (card.r === 'J' || card.r === 'Q' || card.r === 'K') return 10;
  return parseInt(card.r, 10);
}
// Every ace counts as 11 first, then downgrades to 1 one at a time while the hand is still bust
// and still holds an ace left to downgrade — the standard soft/hard-hand rule.
export function blackjackHandValue(cards) {
  let total = cards.reduce((sum, c) => sum + cardValue(c), 0);
  let aces = cards.filter(c => c.r === 'A').length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}
export function isBlackjackHand(cards) { return cards.length === 2 && blackjackHandValue(cards) === 21; }
export function newBlackjackTable() {
  return { phase: 'betting', deck: [], dealerHand: [], players: {}, lastResult: null, roundCounter: 0 };
}
export function applyBlackjackAction(table, action) {
  const uid = action.playerUid;
  if (action.type === 'place_bet') {
    if (table.phase !== 'betting' || table.players[uid]) return;
    table.players[uid] = { username: action.playerUsername, bet: action.amount, hand: [], status: 'betting' };
    return;
  }
  if (action.type === 'hit') {
    const p = table.players[uid];
    if (!p || table.phase !== 'playing' || p.status !== 'playing') return;
    p.hand.push(table.deck.pop());
    if (blackjackHandValue(p.hand) > 21) p.status = 'bust';
    return;
  }
  if (action.type === 'stand') {
    const p = table.players[uid];
    if (!p || table.phase !== 'playing' || p.status !== 'playing') return;
    p.status = 'stand';
  }
}
export function blackjackAllDone(table) { return Object.values(table.players).every(p => p.status !== 'playing'); }
// Extracted from the monolith's blackjackDeal — pure shuffle-and-deal core.
export function resolveBlackjackDeal(table, rand = Math.random) {
  table.deck = freshShuffledDeck(rand);
  table.dealerHand = [table.deck.pop(), table.deck.pop()];
  Object.values(table.players).forEach(p => {
    p.hand = [table.deck.pop(), table.deck.pop()];
    p.status = isBlackjackHand(p.hand) ? 'blackjack' : 'playing';
  });
  table.phase = 'playing';
  return table;
}
// Extracted from the monolith's blackjackDealerPlay — pure dealer-AI + outcome-resolution core.
export function resolveBlackjackDealerPlay(table) {
  const anyLive = Object.values(table.players).some(p => p.status === 'stand' || p.status === 'blackjack');
  if (anyLive) { while (blackjackHandValue(table.dealerHand) < 17) table.dealerHand.push(table.deck.pop()); }
  const dealerTotal = blackjackHandValue(table.dealerHand);
  const dealerBJ = isBlackjackHand(table.dealerHand);
  const dealerBust = dealerTotal > 21;
  const outcomes = {}, payouts = {};
  Object.entries(table.players).forEach(([uid, p]) => {
    const total = blackjackHandValue(p.hand);
    let result, mult;
    if (p.status === 'bust') { result = 'lose'; mult = 0; }
    else if (p.status === 'blackjack' && dealerBJ) { result = 'push'; mult = 1; }
    else if (p.status === 'blackjack') { result = 'blackjack'; mult = 2.5; }
    else if (dealerBJ) { result = 'lose'; mult = 0; }
    else if (dealerBust) { result = 'win'; mult = 2; }
    else if (total > dealerTotal) { result = 'win'; mult = 2; }
    else if (total === dealerTotal) { result = 'push'; mult = 1; }
    else { result = 'lose'; mult = 0; }
    outcomes[uid] = { result, total };
    if (mult > 0) payouts[uid] = Math.round(p.bet * mult * 100) / 100;
  });
  table.roundCounter = (table.roundCounter || 0) + 1;
  table.lastResult = { roundId: table.roundCounter, dealerHand: table.dealerHand.slice(), dealerTotal, outcomes, payouts };
  table.phase = 'result';
  return table;
}

// ===================== GAMBLING: SLOTS =====================
// Dungeon-themed reel symbols, weighted rarer-symbol-pays-more. "triple" is a TOTAL-return
// multiplier (stake included), matching Roulette/Blackjack's own convention.
export const SLOTS_SYMBOLS = [
  { key:'potion',  icon:'🧪', weight:30, triple:3 },
  { key:'gold',    icon:'💰', weight:25, triple:5 },
  { key:'weapon',  icon:'⚔️', weight:20, triple:10 },
  { key:'gem',     icon:'💎', weight:15, triple:20 },
  { key:'monster', icon:'👹', weight:10, triple:50 },
];
export function newSlotsTable() { return { results: [], roundCounter: 0 }; }
// Already fully self-contained — the whole spin resolves in one step (no separate dealer
// phase), so this was already dependency-free in the monolith with no split needed.
export function applySlotsAction(table, action, rand = Math.random) {
  if (action.type !== 'spin') return;
  const weights = {}; SLOTS_SYMBOLS.forEach(s => { weights[s.key] = s.weight; });
  const reels = [weightedPickFromObject(weights, rand), weightedPickFromObject(weights, rand), weightedPickFromObject(weights, rand)];
  const counts = {};
  reels.forEach(r => { counts[r] = (counts[r] || 0) + 1; });
  const maxCount = Math.max(...Object.values(counts));
  let mult = 0;
  if (maxCount === 3) mult = (SLOTS_SYMBOLS.find(s => s.key === reels[0]) || {}).triple || 0;
  else if (maxCount === 2) mult = 1; // any matching pair: consolation stake-back, not a real win
  const payout = mult > 0 ? Math.round(action.amount * mult * 100) / 100 : 0;
  table.roundCounter = (table.roundCounter || 0) + 1;
  table.results = table.results || [];
  table.results.unshift({
    roundId: table.roundCounter, uid: action.playerUid, username: action.playerUsername,
    reels, amount: action.amount, mult, payouts: payout ? { [action.playerUid]: payout } : {},
  });
  if (table.results.length > 20) table.results.length = 20;
}

// ===================== GAMBLING: FIVE-CARD POKER =====================
// Video-poker-style five-card draw. Reuses freshShuffledDeck/CARD_SUITS/CARD_RANKS from
// Blackjack above rather than a second deck implementation.
export const POKER_RANK_ORDER = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
export const POKER_PAYOUTS = {
  royalFlush: 250, straightFlush: 50, fourKind: 25, fullHouse: 9, flush: 6,
  straight: 4, threeKind: 3, twoPair: 2, jacksOrBetter: 1, lowPair: 0, highCard: 0,
};
export function pokerRankValue(r) { return POKER_RANK_ORDER.indexOf(r); }
// Standard Jacks-or-Better video poker rules: a pair below Jacks pays nothing.
export function evaluatePokerHand(cards) {
  const values = cards.map(c => pokerRankValue(c.r)).sort((a, b) => a - b);
  const isFlush = cards.every(c => c.s === cards[0].s);
  let isStraight = values.every((v, i) => i === 0 || v === values[i - 1] + 1);
  if (!isStraight && values.join(',') === '0,1,2,3,12') isStraight = true; // wheel: A-2-3-4-5
  const counts = {};
  cards.forEach(c => { counts[c.r] = (counts[c.r] || 0) + 1; });
  const countValues = Object.values(counts).sort((a, b) => b - a);
  if (isStraight && isFlush && values[0] === pokerRankValue('10')) return { rank: 'royalFlush', label: 'Royal Flush' };
  if (isStraight && isFlush) return { rank: 'straightFlush', label: 'Straight Flush' };
  if (countValues[0] === 4) return { rank: 'fourKind', label: 'Four of a Kind' };
  if (countValues[0] === 3 && countValues[1] === 2) return { rank: 'fullHouse', label: 'Full House' };
  if (isFlush) return { rank: 'flush', label: 'Flush' };
  if (isStraight) return { rank: 'straight', label: 'Straight' };
  if (countValues[0] === 3) return { rank: 'threeKind', label: 'Three of a Kind' };
  if (countValues[0] === 2 && countValues[1] === 2) return { rank: 'twoPair', label: 'Two Pair' };
  if (countValues[0] === 2) {
    const pairRank = Object.keys(counts).find(r => counts[r] === 2);
    return ['J','Q','K','A'].includes(pairRank) ? { rank: 'jacksOrBetter', label: 'Jacks or Better' } : { rank: 'lowPair', label: `Pair of ${pairRank}s` };
  }
  return { rank: 'highCard', label: 'High Card' };
}
// ===================== LONG REST / "SIMULATE A DAY" =====================
// The DM's "Simulate a Day" action needs to run identically in two places: the browser (the
// DM's own local character, and the solo/offline path when nobody's connected) and the server
// (server/websocket.js, applied directly to every player's PERSISTED row so it reaches players
// who aren't even currently connected — the same reason hp_delta/gift_item mutate stored state
// server-side rather than only pushing to a live socket). Kept here, dependency-free, so both
// callers share one implementation instead of two copies drifting apart.
const DAILY_DICE_CHARGE_RE = /(\d+)\s*d\s*(\d+)\s*([+-]\s*\d+)?/i;
const DAILY_FLAT_CHARGE_RE = /\d+/;

// Only "Xd Y" / "X/day" / "X per day" / "X per long rest" charge text recharges here — a "1 use"
// potion or "7" days of rations never comes back just because a day passed; those stay spent
// until actually replaced, exactly like today.
export function isPerDayCharge(chargesText) {
  return /\/\s*day\b|per\s+day|per\s+long\s+rest|\/\s*long\s+rest/i.test(String(chargesText || ''));
}

// Same "reset the whole string back to its pristine template, re-rolling if the template itself
// is dice notation" behavior as the monolith's own refillItemCharges (the manual drag-to-refill
// action) — this is that function's rand-injectable, DOM-free twin, gated to per-day items only.
// Mutates and returns `item`, matching this file's existing mutate-in-place convention (e.g.
// classifyItemFull).
export function refillDailyItemCharges(item, rand = Math.random) {
  if (!item || !item.charges) return item;
  const template = item.chargesFormat != null ? item.chargesFormat : item.charges;
  if (!isPerDayCharge(template) || !DAILY_FLAT_CHARGE_RE.test(template)) return item;
  if (item.chargesFormat === undefined) item.chargesFormat = item.charges;
  const m = DAILY_DICE_CHARGE_RE.exec(template);
  if (m) {
    const n = parseInt(m[1], 10), sides = parseInt(m[2], 10);
    const mod = m[3] ? parseInt(m[3].replace(/\s+/g, ''), 10) : 0;
    let total = mod;
    for (let i = 0; i < n; i++) total += rn(1, sides, rand);
    item.charges = template.slice(0, m.index) + Math.max(0, total) + template.slice(m.index + m[0].length);
  } else {
    item.charges = template;
  }
  return item;
}

// Resets every structured item.abilities[].usesLeft back to its uses.max for 'longRest'/
// 'shortRest' recharge types -- 'never' (narrative-only, no auto-refill) and 'turn' (resets on
// the caster's own next turn, not tracked by this app's manual/DM-adjudicated combat) are left
// untouched. Mutates and returns `item`, matching refillDailyItemCharges's own convention.
export function refillAbilityUses(item) {
  if (!item || !item.abilities || !item.abilities.length) return item;
  item.abilities.forEach(a => {
    if (a.uses && (a.uses.recharge === 'longRest' || a.uses.recharge === 'shortRest' || a.uses.recharge === 'day')) {
      a.usesLeft = a.uses.max;
    }
  });
  return item;
}

// A long rest for one player's persisted state: full HP, every temporary effect ends, death
// save counters clear, every per-day-charged item in savedGeneratedItems recharges (plus any
// structured item.abilities uses), and spell slot usage resets to zero. Returns a NEW state
// object (the one exception, per this file's convention, is each item object inside
// savedGeneratedItems, which is mutated in place like every other item-mutating function here).
export function applyLongRestToPlayerState(state, rand = Math.random) {
  if (!state) return state;
  const maxHp = typeof state.characterMaxHpEffective === 'number' ? state.characterMaxHpEffective
    : (typeof state.characterMaxHp === 'number' ? state.characterMaxHp : state.characterCurrentHp);
  const savedGeneratedItems = (state.savedGeneratedItems || []).map(it => refillAbilityUses(refillDailyItemCharges({ ...it }, rand)));
  const characterSpellSlotsUsed = state.characterSpellSlotsUsed
    ? Object.fromEntries(Object.keys(state.characterSpellSlotsUsed).map(lvl => [lvl, 0]))
    : state.characterSpellSlotsUsed;
  return {
    ...state,
    characterCurrentHp: maxHp != null ? maxHp : state.characterCurrentHp,
    activeTimedEffects: [],
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,
    savedGeneratedItems,
    characterSpellSlotsUsed,
  };
}

// ===================== ITEM EFFECT APPLICATION =====================
// Single source of truth for "what happens when this item's effect text is triggered" -- built
// for the DM's "Apply to Player" tool (server/websocket.js), which must work even when the
// target isn't connected, so it can't call into the browser-only handleItemActivation flow the
// monolith's own right-click-to-use path already has. NOT exported: `parseDurationMs`/
// `DURATION_UNIT_SECONDS`/`rollDiceFormulaTotal` below are deliberately private (unlike
// everything else in this file) because the monolith already declares its own globals with these
// exact names, and every export here gets auto-bridged onto `window` -- exporting these would
// silently clobber the monolith's own copies depending on script load order. Only the one new
// function callers actually need, `applyItemEffectToState`, is public.
const ITEM_EFFECT_DURATION_UNIT_SECONDS = { round: 6, rounds: 6, minute: 60, minutes: 60, min: 60, hour: 3600, hours: 3600, day: 86400, days: 86400 };
function parseItemEffectDurationMs(text) {
  if (!text) return null;
  const m = /(\d+)\s*(round|rounds|minute|minutes|min|hour|hours|day|days)\b/i.exec(text);
  if (!m) return null;
  const seconds = ITEM_EFFECT_DURATION_UNIT_SECONDS[m[2].toLowerCase()];
  if (!seconds) return null;
  return parseInt(m[1], 10) * seconds * 1000;
}
const ITEM_EFFECT_HP_DICE_RE = /(\d+)\s*d\s*(\d+)\s*([+-]\s*\d+)?/i;
function rollItemEffectDiceTotal(text, rand) {
  const m = ITEM_EFFECT_HP_DICE_RE.exec(String(text || ''));
  if (!m) return null;
  const n = parseInt(m[1], 10), sides = parseInt(m[2], 10);
  const mod = m[3] ? parseInt(m[3].replace(/\s+/g, ''), 10) : 0;
  let total = mod;
  for (let i = 0; i < n; i++) total += rn(1, sides, rand);
  return total;
}
// Applies one item's effect (an item.hp heal, plus a timed/permanent stat buff parsed from its
// effect text) onto a plain state object, returning a NEW state -- same immutable-state
// convention as applyLongRestToPlayerState. A day-or-longer duration is flagged `permanent: true`
// instead of getting a real expiresAt, so it lasts until the next Simulate a Day / day roll (the
// monolith's real-time prune skips permanent entries) rather than a wall-clock countdown --
// sub-day durations behave exactly like every other timed effect already does.
export function applyItemEffectToState(state, item, rand = Math.random) {
  if (!state || !item) return state;
  const maxHp = typeof state.characterMaxHpEffective === 'number' ? state.characterMaxHpEffective
    : (typeof state.characterMaxHp === 'number' ? state.characterMaxHp : undefined);
  let characterCurrentHp = state.characterCurrentHp;
  if (item.hp) {
    const rolled = rollItemEffectDiceTotal(item.hp, rand);
    if (rolled != null) {
      const healed = (typeof characterCurrentHp === 'number' ? characterCurrentHp : 0) + Math.max(0, rolled);
      characterCurrentHp = maxHp != null ? Math.min(healed, maxHp) : healed;
    }
  }
  const text = String(item.effect || item.desc || '').replace(/<[^>]+>/g, ' ');
  const durationMs = parseItemEffectDurationMs(text);
  let activeTimedEffects = state.activeTimedEffects;
  if (durationMs) {
    const permanent = durationMs >= ITEM_EFFECT_DURATION_UNIT_SECONDS.day * 1000;
    const entry = {
      id: 'aeff' + Date.now() + '_' + Math.floor(rand() * 1e6),
      key: item.id || item.key || item.name,
      name: item.name,
      rarity: item.rarity,
      text,
      startedAt: Date.now(),
      permanent,
    };
    if (!permanent) { entry.durationMs = durationMs; entry.expiresAt = Date.now() + durationMs; }
    activeTimedEffects = [...(state.activeTimedEffects || []), entry];
  }
  return { ...state, characterCurrentHp, activeTimedEffects };
}

// Applies a trap/hazard's mechanical effect (damage and/or a condition, from trap-data.js's own
// structured fields -- see that file's header) directly to a state object, for the DM's "Apply
// Trap to Player" tool -- the same "must work even if the target is offline" need
// applyItemEffectToState fills for items, just subtracting HP instead of healing it. Reads
// already-structured saveAbility/saveDC/damage/condition fields rather than parsing them out of
// prose, since this data is authored fresh rather than lifted from an existing stat-block format
// worth reusing a text parser for. `saved` reflects a saving throw the DM has already resolved at
// the table (or true for an effect with no save at all) -- standard 5e-style half-damage-and-no-
// condition-on-a-save, matching every entry's own note text.
export function applyTrapEffectToState(state, trap, saved, rand = Math.random) {
  if (!state || !trap) return state;
  const maxHp = typeof state.characterMaxHpEffective === 'number' ? state.characterMaxHpEffective
    : (typeof state.characterMaxHp === 'number' ? state.characterMaxHp : undefined);
  let characterCurrentHp = state.characterCurrentHp;
  if (trap.damage) {
    const rolled = rollItemEffectDiceTotal(trap.damage, rand);
    if (rolled != null) {
      const dealt = saved ? Math.floor(rolled / 2) : rolled;
      const current = typeof characterCurrentHp === 'number' ? characterCurrentHp : 0;
      characterCurrentHp = Math.max(0, current - Math.max(0, dealt));
    }
  }
  let activeTimedEffects = state.activeTimedEffects;
  if (trap.condition && !saved) {
    const durationMs = trap.conditionDuration ? parseItemEffectDurationMs(trap.conditionDuration) : null;
    const permanent = !durationMs || durationMs >= ITEM_EFFECT_DURATION_UNIT_SECONDS.day * 1000;
    const entry = {
      id: 'aeff' + Date.now() + '_' + Math.floor(rand() * 1e6),
      key: trap.name,
      name: trap.name,
      text: `${trap.condition}${trap.conditionDuration ? ' (' + trap.conditionDuration + ')' : ''} — from ${trap.name}`,
      startedAt: Date.now(),
      permanent,
    };
    if (!permanent) { entry.durationMs = durationMs; entry.expiresAt = Date.now() + durationMs; }
    activeTimedEffects = [...(state.activeTimedEffects || []), entry];
  }
  return { ...state, characterCurrentHp, activeTimedEffects };
}

export function newPokerTable() { return { hands: {}, results: [], roundCounter: 0 }; }
// Already fully self-contained (deal + draw both resolve entirely within this function) — no
// split needed, unlike Roulette/Blackjack.
export function applyPokerAction(table, action, rand = Math.random) {
  const uid = action.playerUid;
  if (action.type === 'deal') {
    if (table.hands[uid]) return; // already mid-hand
    const deck = freshShuffledDeck(rand);
    table.hands[uid] = { username: action.playerUsername, bet: action.amount, hand: [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()], deck };
    return;
  }
  if (action.type === 'draw') {
    const h = table.hands[uid];
    if (!h) return;
    const held = new Set(action.heldIndexes || []);
    for (let i = 0; i < 5; i++) { if (!held.has(i)) h.hand[i] = h.deck.pop(); }
    const evalResult = evaluatePokerHand(h.hand);
    const mult = POKER_PAYOUTS[evalResult.rank] || 0;
    const payout = mult > 0 ? Math.round(h.bet * mult * 100) / 100 : 0;
    table.roundCounter = (table.roundCounter || 0) + 1;
    table.results = table.results || [];
    table.results.unshift({
      roundId: table.roundCounter, uid, username: h.username, hand: h.hand.slice(),
      handLabel: evalResult.label, amount: h.bet, mult, payouts: payout ? { [uid]: payout } : {},
    });
    if (table.results.length > 20) table.results.length = 20;
    delete table.hands[uid];
  }
}


// ===================== WEAPON STAT SCALING =====================
// Souls-style weapon scaling: instead of every weapon adding "your Strength modifier" to damage,
// each weapon carries a letter grade per stat ({ str:'B', dex:'D' }) and adds
// grade-multiplier × that stat's modifier. Scaling affects DAMAGE only — the to-hit roll stays a
// plain 5e ability check (see weaponToHitStat), so AC math is untouched.
//
// A weapon's grades come from, in order: an authored `item.scaling` object (always wins), else the
// default for its weapon kind (weaponScalingKind -> WEAPON_SCALING_BY_KIND), nudged up by rarity.
// Spell-focus staves/wands additionally carry a spell focus (inferSpellFocus) that buffs spell
// damage and/or spell attack rolls, separate from their melee scaling.
export const SCALING_GRADE_ORDER = ['E', 'D', 'C', 'B', 'A', 'S'];
export const SCALING_GRADE_MULT = { S: 1.25, A: 1, B: 0.75, C: 0.5, D: 0.25, E: 0.1 };
export const SCALING_STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const SCALING_STAT_LABEL = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
const PHYSICAL_STATS = ['str', 'dex'];

export const WEAPON_SCALING_BY_KIND = {
  dagger:      { dex: 'B', str: 'D' },
  rapier:      { dex: 'A', str: 'D' },
  lightblade:  { dex: 'B', str: 'C' },   // shortsword, scimitar, sabre, wand blade
  sword:       { str: 'B', dex: 'D' },
  axe:         { str: 'B', dex: 'D' },
  mace:        { str: 'B', dex: 'E' },
  hammer:      { str: 'B', dex: 'E' },
  flail:       { str: 'B', dex: 'D' },
  club:        { str: 'C', dex: 'D' },
  pick:        { str: 'B', dex: 'D' },
  sickle:      { dex: 'C', str: 'C' },
  spear:       { str: 'C', dex: 'C' },
  quarterstaff:{ str: 'C', dex: 'D' },
  polearm:     { str: 'B', dex: 'C' },
  greatweapon: { str: 'A', dex: 'E' },   // greatsword, greataxe, maul, greatclub
  whip:        { dex: 'A', str: 'E' },
  bow:         { dex: 'A', str: 'E' },
  crossbow:    { dex: 'B', str: 'D' },
  sling:       { dex: 'B', str: 'D' },
  blowgun:     { dex: 'A' },
  dart:        { dex: 'A', str: 'E' },
  thrown:      { dex: 'B', str: 'C' },   // throwing knives/axes, shuriken, javelins
  net:         { str: 'C' },
  natural:     { str: 'B', dex: 'D' },
  onehanded:   { str: 'B', dex: 'D' },   // fallbacks when the name says nothing
  twohanded:   { str: 'A', dex: 'E' },
};

// Name keywords -> kind, first match wins. Deliberately independent of classifyItemHierarchy's
// breadcrumb, which misses plenty of real weapons (handaxe, battleaxe, quarterstaff, kukri...).
const WEAPON_KIND_RULES = [
  [/great.?sword|zweihander|great.?axe|great.?club|great.?hammer|\bmaul\b/, 'greatweapon'],
  [/halberd|glaive|\bpike\b|\blance\b|dragonlance|polearm|bardiche|\bscythe\b/, 'polearm'],
  [/crossbow/, 'crossbow'],
  [/bow\b|\barrows?\b|\bquiver\b/, 'bow'],
  [/\bsling\b|bullet/, 'sling'],
  [/blowgun/, 'blowgun'],
  [/\bdarts?\b/, 'dart'],
  [/throwing|shuriken|javelin|chakram/, 'thrown'],
  [/\bnet\b/, 'net'],
  [/\bwhip\b|\bchain\b(?!\s*mail)|kusarigama|\blash\b/, 'whip'],
  [/rapier|\bestoc\b/, 'rapier'],
  [/dagger|\bknife\b|dirk|stiletto|kukri|\bkris\b|\bshiv\b|\bkatar\b|\bsai\b/, 'dagger'],
  [/wand blade|short.?sword|scimitar|\bsabre\b|\bsaber\b|cutlass|\bkatana\b|shamshir/, 'lightblade'],
  [/quarterstaff|battle staff|\bstaff\b|\bcane\b|\bbo\b/, 'quarterstaff'],
  [/morningstar|\bflail\b/, 'flail'],
  [/battle.?axe|hand.?axe|\baxe\b|hatchet|tomahawk|\bcleaver\b/, 'axe'],
  [/\bmace\b|hammer|\bmallet\b|\bcensor\b/, 'hammer'],
  [/\bclub\b|cudgel|truncheon|\bbaton\b/, 'club'],
  [/\bpick\b|\bpickaxe\b/, 'pick'],
  [/\bsickle\b/, 'sickle'],
  [/spear|trident|\bfork\b/, 'spear'],
  [/sword|blade\b|falchion|claymore|broadsword|\bedge\b/, 'sword'],
  [/\bclaw|\bfang|\bbite\b|\btalon|\bhorn\b|\btail\b|\bsting/, 'natural'],
];
export function weaponScalingKind(item) {
  const n = String((item && item.name) || '').toLowerCase();
  for (const [re, kind] of WEAPON_KIND_RULES) if (re.test(n)) return kind;
  // Named uniques ("Frosthowl", "The Last Word") say nothing in their name — their description
  // usually does ("a greataxe forged from..."): take whichever weapon word appears first.
  const desc = String((item && item.desc) || '').toLowerCase();
  let best = null;
  for (const [re, kind] of WEAPON_KIND_RULES) {
    const m = re.exec(desc);
    if (m && (!best || m.index < best.index)) best = { index: m.index, kind };
  }
  if (best) return best.kind;
  return ((item && item.slotSize) >= 2 || (item && item.subcategory) === 'twohanded') ? 'twohanded' : 'onehanded';
}
function gradeIdx(g) { return SCALING_GRADE_ORDER.indexOf(g); }
function boostGrade(g, steps) { return SCALING_GRADE_ORDER[Math.min(SCALING_GRADE_ORDER.length - 1, Math.max(0, gradeIdx(g) + steps))]; }
// Keeps only valid stat -> grade pairs (so a typo in authored data can never break an attack roll).
export function normalizeScaling(raw) {
  const out = {};
  if (raw && typeof raw === 'object') {
    SCALING_STATS.forEach(s => { const g = String(raw[s] || '').toUpperCase(); if (SCALING_GRADE_MULT[g] != null) out[s] = g; });
  }
  return out;
}
// Highest-multiplier stat first (ties keep SCALING_STATS order).
function scalingStatsByStrength(scaling) {
  return SCALING_STATS.filter(s => scaling[s]).sort((a, b) => SCALING_GRADE_MULT[scaling[b]] - SCALING_GRADE_MULT[scaling[a]]);
}
// Every weapon scales with every ability: a stat the weapon has no real affinity for is simply rank E
// (a greatclub still has INT scaling, it is just E). Filling the gaps here means tooltips, the attack
// popup and the damage maths all see all six.
export function withAllScalingStats(scaling) {
  const out = { ...scaling };
  SCALING_STATS.forEach(s => { if (!out[s]) out[s] = 'E'; });
  return out;
}
export function inferWeaponScaling(item, rarity) {
  return withAllScalingStats(inferWeaponScalingRaw(item, rarity));
}
function inferWeaponScalingRaw(item, rarity) {
  const authored = normalizeScaling(item && item.scaling);
  if (Object.keys(authored).length) return authored;
  const r = rarity || (item && item.rarity) || 'common';
  const scaling = { ...WEAPON_SCALING_BY_KIND[weaponScalingKind(item)] };
  // A finesse weapon is at least decent with Dexterity whatever its kind says.
  if (/finesse/i.test((item && item.effect) || '') && (!scaling.dex || gradeIdx(scaling.dex) < gradeIdx('B'))) scaling.dex = 'B';
  // Better weapons scale better: Super Rare lifts the main stat a grade, Legendary/Celestial lift
  // the two best.
  const order = scalingStatsByStrength(scaling);
  const steps = r === 'superrare' ? 1 : (r === 'legendary' || r === 'celestial') ? 1 : 0;
  if (steps) order.slice(0, (r === 'superrare') ? 1 : 2).forEach(s => { scaling[s] = boostGrade(scaling[s], steps); });
  return scaling;
}
// scaling + { str:+3, dex:+1, ... } (ability MODIFIERS) -> the damage bonus and a per-stat breakdown.
// The primary (best-graded) stat counts at its signed value, so a weak primary stat still hurts;
// every other stat can only ever add.
export function computeScalingDamage(scaling, mods) {
  const order = scalingStatsByStrength(scaling);
  const parts = order.map((stat, i) => {
    const mult = SCALING_GRADE_MULT[scaling[stat]];
    const mod = (mods && mods[stat]) || 0;
    const raw = mult * mod;
    return { stat, grade: scaling[stat], mult, mod, value: i === 0 ? raw : Math.max(0, raw), primary: i === 0 };
  });
  return { total: Math.round(parts.reduce((s, p) => s + p.value, 0)), parts };
}
// Which physical ability the to-hit roll uses: the best modifier among Str/Dex stats the weapon
// grades C or better (so a spear, graded evenly, uses whichever is higher); if neither is graded
// C+, the better-graded one.
export function weaponToHitStat(scaling, mods) {
  const phys = PHYSICAL_STATS.filter(s => scaling[s]);
  if (!phys.length) return { stat: 'str', mod: (mods && mods.str) || 0 };
  const good = phys.filter(s => SCALING_GRADE_MULT[scaling[s]] >= SCALING_GRADE_MULT.C);
  const pool = good.length ? good : [phys.sort((a, b) => SCALING_GRADE_MULT[scaling[b]] - SCALING_GRADE_MULT[scaling[a]])[0]];
  const best = pool.reduce((b, s) => (((mods && mods[s]) || 0) > ((mods && mods[b]) || 0) ? s : b), pool[0]);
  return { stat: best, mod: (mods && mods[best]) || 0 };
}
// [{ stat:'str', label:'STR', grade:'B' }, ...] strongest first — what tooltips render as chips.
export function scalingEntries(scaling) {
  return scalingStatsByStrength(scaling).map(stat => ({ stat, label: SCALING_STAT_LABEL[stat], grade: scaling[stat] }));
}
export function formatScaling(scaling) {
  return scalingStatsByStrength(scaling).map(s => `${SCALING_STAT_LABEL[s]} ${scaling[s]}`).join(' · ');
}

// ---- Spell-focus staves, wands and rods ----
const FOCUS_NAME = /\b(staff|wand|rod|scepter|sceptre|orb|codex|grimoire)\b/i;
const NOT_A_FOCUS = /battle staff|quarterstaff|wand blade|\bcane\b/i;
export function isSpellFocusWeapon(item) {
  if (!item || item.type !== 'weapon') return false;
  if (item.spellFocus && typeof item.spellFocus === 'object') return true;
  const n = item.name || '';
  return FOCUS_NAME.test(n) && !NOT_A_FOCUS.test(n) && /charges?|spells?\b|cast|cantrip|spell attack/i.test(item.effect || '');
}
const CLASS_STAT = { wizard: 'int', artificer: 'int', cleric: 'wis', druid: 'wis', ranger: 'wis', paladin: 'wis', monk: 'wis', bard: 'cha', sorcerer: 'cha', warlock: 'cha' };
const FOCUS_GRADE_BY_RARITY = { common: 'C', uncommon: 'C', rare: 'B', superrare: 'A', legendary: 'S', celestial: 'S' };
const FOCUS_ATTACK_BY_RARITY = { common: 1, uncommon: 1, rare: 2, superrare: 2, legendary: 3, celestial: 3 };
function nameHash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function inferFocusStat(item) {
  const text = ((item.name || '') + ' ' + (item.effect || '') + ' ' + (item.desc || '')).toLowerCase();
  const m = text.match(/attunement[^()]*\(([^)]*)\)/) || text.match(/attunement by an? ([^.]*)/);
  if (m) {
    const votes = {};
    Object.keys(CLASS_STAT).forEach(c => { if (m[1].includes(c)) votes[CLASS_STAT[c]] = (votes[CLASS_STAT[c]] || 0) + 1; });
    const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    if (ranked.length) return ranked[0][0];
  }
  if (/holy|radiant|divine|sacred|woodland|verdant|nature|heal|restor|cleric|druid/.test(text)) return 'wis';
  if (/charm|warlock|pact|eldritch|infernal|bard|sorcer|fey|soul|blood/.test(text)) return 'cha';
  return 'int';
}
// -> { stat, grade, buff:'damage'|'attack'|'both', attackBonus } or null for a non-focus weapon.
// `buff` varies staff to staff: authored (item.spellFocus.buff), else read from the effect text
// ("+3 to spell attack rolls"), else a stable pick by name so the same staff is always the same.
export function inferSpellFocus(item, rarity) {
  if (!isSpellFocusWeapon(item)) return null;
  const r = rarity || item.rarity || 'common';
  const authored = (item.spellFocus && typeof item.spellFocus === 'object') ? item.spellFocus : {};
  const text = item.effect || '';
  const stat = SCALING_STATS.includes(authored.stat) ? authored.stat : inferFocusStat(item);
  const grade = SCALING_GRADE_MULT[authored.grade] != null ? authored.grade : (FOCUS_GRADE_BY_RARITY[r] || 'C');
  const textAttack = text.match(/\+(\d+)\s+to\s+spell\s+attack/i);
  let buff = ['damage', 'attack', 'both'].includes(authored.buff) ? authored.buff : null;
  if (!buff) {
    if (textAttack && /spell damage/i.test(text)) buff = 'both';
    else if (textAttack) buff = 'attack';
    else if (/spell damage/i.test(text)) buff = 'damage';
    else {
      const pool = (r === 'common' || r === 'uncommon') ? ['damage', 'attack'] : ['damage', 'attack', 'both'];
      buff = pool[nameHash(item.name) % pool.length];
    }
  }
  const attackBonus = Number.isFinite(authored.attackBonus) ? authored.attackBonus
    : textAttack ? parseInt(textAttack[1], 10) : (FOCUS_ATTACK_BY_RARITY[r] || 1);
  return { stat, grade, buff, attackBonus };
}
// focus + ability modifiers -> the actual numbers to add to a spell: { damage, attack }.
export function computeSpellFocusBonus(focus, mods) {
  if (!focus) return { damage: 0, attack: 0 };
  const scaled = Math.max(0, Math.round(SCALING_GRADE_MULT[focus.grade] * ((mods && mods[focus.stat]) || 0)));
  if (focus.buff === 'damage') return { damage: scaled, attack: 0 };
  if (focus.buff === 'attack') return { damage: 0, attack: focus.attackBonus };
  return { damage: Math.round(scaled / 2), attack: Math.ceil(focus.attackBonus / 2) };
}


// ---- Armor scaling -----------------------------------------------------------------------------
// Armor carries the same letter grades per stat as a weapon, and they add to AC instead of damage:
// the bonus is grade-multiplier x stat modifier (the best-graded stat counts at its signed value, the
// rest only add), summed over every equipped armor piece's BEST grade per stat — so a gauntlet with
// DEX A improves heavy armor's DEX, but ten pieces never stack the same modifier ten times.
// This replaces the old hard-coded "light = full Dex, medium = Dex capped at +2, heavy = none":
// light armor is DEX A, medium DEX C (a +4 Dex still gives +2), heavy STR C with DEX E. No body armor at
// all counts as DEX A (unarmored: 10 + Dex, as before). An authored `item.scaling` always wins.
export const ARMOR_SCALING_BY_KIND = {
  light:   { dex: 'A' },
  medium:  { dex: 'C', str: 'D', con: 'D' },
  heavy:   { str: 'C', con: 'D', dex: 'E' },
  shield:  { str: 'C', con: 'D' },
  helm:    { con: 'C', wis: 'D' },
  gloves:  { dex: 'C', str: 'D' },
  boots:   { dex: 'C', con: 'D' },
  cloak:   { dex: 'D', cha: 'D' },
  belt:    { con: 'C', str: 'D' },
  other:   { con: 'D' },
};
const BODY_STYLE_RULES = [
  [/half.?plate|breastplate|scale mail|chain shirt|hide|brigandine|lamellar|cuirass/, 'medium'],
  [/plate|splint|chain mail|ring mail|full harness|\bharness\b/, 'heavy'],
  [/padded|leather|studded|robe|vestment|cloth|silk|gambeson|jerkin|tunic|garb/, 'light'],
];
export function armorPieceKind(item) {
  const n = String((item && item.name) || '').toLowerCase();
  const sub = String((item && item.subcategory) || '').toLowerCase();
  const style = String((item && (item.armorStyle || (item.__canonical && item.__canonical.armor && item.__canonical.armor.armorType))) || '').toLowerCase();
  if (/shield|buckler/.test(n) || sub === 'offhand') return 'shield';
  if (/helm|helmet|\bcap\b|coif|crown|circlet|hood|visor|mask|\bhat\b/.test(n) || sub === 'head' || sub === 'facewear') return 'helm';
  if (/gauntlet|glove|bracer|vambrace|mitt/.test(n) || sub === 'handwear') return 'gloves';
  if (/boot|greave|shoe|sandal|sabaton|legging|\bleg guards?\b/.test(n) || sub === 'boots' || sub === 'leggings') return 'boots';
  if (/cloak|cape|mantle|shawl/.test(n) || sub === 'cloak') return 'cloak';
  if (/\bbelt\b|girdle|sash|\bwaist/.test(n) || sub === 'belt') return 'belt';
  if (['light', 'medium', 'heavy'].includes(style)) return style;
  for (const [re, kind] of BODY_STYLE_RULES) if (re.test(n)) return kind;
  return sub === 'chest' || /armor|mail|plate|harness|vest|robe/.test(n) ? 'light' : 'other';
}
const CASTER_ARMOR = /attunement[^.]*\b(wizard|sorcerer|warlock|cleric|druid|bard|paladin|ranger|artificer|monk)\b|\bspellcast|spell attack|cantrip|\bcast\b/i;
export function inferArmorScaling(item, rarity) {
  const authored = normalizeScaling(item && item.scaling);
  if (Object.keys(authored).length) return withAllScalingStats(authored);
  const r = rarity || (item && item.rarity) || 'common';
  const scaling = { ...ARMOR_SCALING_BY_KIND[armorPieceKind(item)] };
  // Magical armor made for casters leans on the caster's stat as well.
  const text = ((item && item.effect) || '') + ' ' + ((item && item.desc) || '');
  if (CASTER_ARMOR.test(text)) { const st = inferFocusStat(item); if (!scaling[st] || gradeIdx(scaling[st]) < gradeIdx('C')) scaling[st] = 'C'; }
  const order = scalingStatsByStrength(scaling);
  const steps = (r === 'superrare' || r === 'legendary' || r === 'celestial') ? 1 : 0;
  if (steps) order.slice(0, r === 'superrare' ? 1 : 2).forEach(st => { scaling[st] = boostGrade(scaling[st], steps); });
  return withAllScalingStats(scaling);
}
// pieces: [{ item, rarity }] of everything equipped that is armor. -> { scaling (merged), total, parts }
export function computeArmorScalingAc(pieces, mods) {
  const merged = {};
  const hasBody = (pieces || []).some(p => ['light', 'medium', 'heavy'].includes(armorPieceKind(p.item)));
  const sources = (pieces || []).map(p => inferArmorScaling(p.item, p.rarity));
  if (!hasBody) sources.push({ dex: 'A' });   // unarmored: 10 + Dex
  sources.forEach(sc => SCALING_STATS.forEach(st => { if (sc[st] && (!merged[st] || gradeIdx(sc[st]) > gradeIdx(merged[st]))) merged[st] = sc[st]; }));
  const scaling = withAllScalingStats(merged);
  const r = computeScalingDamage(scaling, mods);
  return { scaling, total: r.total, parts: r.parts };
}

// ---- Spell focus on any magical item ------------------------------------------------------------
// Staves, wands and rods already carry a focus (above). Every other magical item — rings, cloaks,
// amulets, armor, trinkets — gets one too: a casting stat and a grade (one lower than a real focus),
// shown on its tooltip. A focus only ADDS when its item casts spells or deals damage
// (itemFocusActive); for a plain ring of protection it is shown but idle.
const MAGIC_TEXT = /\bcast(?:s|ing)?\b|spell|cantrip|charges?\b|attunement|magical?\b|radiant|necrotic|psychic|force damage|fire damage|cold damage|lightning|thunder|poison damage|acid damage/i;
const NOT_MAGICAL_TYPES = new Set(['consumable', 'craftable', 'document', 'chest', 'monsterpart', 'companion']);
export function isMagicalItem(item) {
  if (!item || NOT_MAGICAL_TYPES.has(item.type)) return false;
  if (item.type === 'weapon') return isSpellFocusWeapon(item);
  if (item.spellFocus && typeof item.spellFocus === 'object') return true;
  const rarity = item.rarity || 'common';
  const text = (item.effect || '') + ' ' + (Array.isArray(item.mods) ? item.mods.map(m => m.text || '').join(' ') : '');
  return (rarity !== 'common') || (Array.isArray(item.mods) && item.mods.length > 0) || MAGIC_TEXT.test(text);
}
export function itemFocusActive(item) {
  if (!item) return false;
  if (item.type === 'weapon') return isSpellFocusWeapon(item);
  const text = (item.effect || '') + ' ' + (Array.isArray(item.mods) ? item.mods.map(m => (m.type || '') + ' ' + (m.text || '')).join(' ') : '');
  return /\bcast(?:s|ing)?\b|spell|cantrip|grants the ability to cast|spell attack|spell save|\d+d\d+\s+(?:fire|cold|lightning|thunder|poison|acid|necrotic|radiant|psychic|force)\s+damage/i.test(text);
}
const NON_FOCUS_GRADE = { common: 'D', uncommon: 'D', rare: 'C', superrare: 'B', legendary: 'A', celestial: 'A' };
// A staff/wand's own focus, else the casting-stat focus of any other magical item, else null.
export function inferItemSpellFocus(item, rarity) {
  const own = inferSpellFocus(item, rarity);
  if (own) return own;
  if (!isMagicalItem(item)) return null;
  const r = rarity || item.rarity || 'common';
  const authored = (item.spellFocus && typeof item.spellFocus === 'object') ? item.spellFocus : {};
  const stat = SCALING_STATS.includes(authored.stat) ? authored.stat : inferFocusStat(item);
  const grade = SCALING_GRADE_MULT[authored.grade] != null ? authored.grade : (NON_FOCUS_GRADE[r] || 'D');
  return { stat, grade, buff: 'damage', attackBonus: 0 };
}
// Spell save DC that a focus adds: half of the scaled stat modifier (rounded), never negative.
export function computeSpellFocusDc(focus, mods) {
  if (!focus) return 0;
  return Math.max(0, Math.round(SCALING_GRADE_MULT[focus.grade] * ((mods && mods[focus.stat]) || 0) / 2));
}

// ===================== WEAPON PROFICIENCY =====================
// A weapon attack only adds the proficiency bonus if the character is PROFICIENT with that weapon.
// Proficiency comes from four places: the class (5e class tables, matched from the free-text Class
// field), what the player ticks on the Character Sheet, equipped gear/feats whose text grants it
// ("Proficiency with longbows and shortbows"), or the weapon itself. Being proficient only matters
// numerically if something raises the proficiency bonus (collectProficiencyBoost) — there is no
// built-in +2 — and an unset sheet is proficient with nothing.
const SIMPLE = 'simple', MARTIAL = 'martial';
// [name regex (lowercase), id, label, category] — first match wins, so specific names come before
// generic ones ("greatclub" before "club", "battleaxe" before "axe").
export const WEAPON_PROFICIENCY_TABLE = [
  [/great.?club/, 'greatclub', 'Greatclub', SIMPLE],
  [/light hammer/, 'light hammer', 'Light hammer', SIMPLE],
  [/war.?hammer|great.?hammer|\bmaul\b/, 'warhammer', 'Warhammer', MARTIAL],
  [/hand crossbow/, 'hand crossbow', 'Hand crossbow', MARTIAL],
  [/heavy crossbow/, 'heavy crossbow', 'Heavy crossbow', MARTIAL],
  [/crossbow/, 'light crossbow', 'Light crossbow', SIMPLE],
  [/long.?bow|great.?bow/, 'longbow', 'Longbow', MARTIAL],
  [/short.?bow/, 'shortbow', 'Shortbow', SIMPLE],
  [/\bsling\b/, 'sling', 'Sling', SIMPLE],
  [/\bdarts?\b/, 'dart', 'Dart', SIMPLE],
  [/javelin/, 'javelin', 'Javelin', SIMPLE],
  [/dagger|\bknife\b|dirk|stiletto|kukri|\bshiv\b/, 'dagger', 'Dagger', SIMPLE],
  [/hand.?axe|hatchet|tomahawk/, 'handaxe', 'Handaxe', SIMPLE],
  [/great.?axe/, 'greataxe', 'Greataxe', MARTIAL],
  [/battle.?axe|\baxe\b/, 'battleaxe', 'Battleaxe', MARTIAL],
  [/morningstar/, 'morningstar', 'Morningstar', MARTIAL],
  [/\bflail\b/, 'flail', 'Flail', MARTIAL],
  [/\bmace\b/, 'mace', 'Mace', SIMPLE],
  [/\bclub\b|cudgel|truncheon/, 'club', 'Club', SIMPLE],
  [/quarterstaff|battle staff|\bstaff\b/, 'quarterstaff', 'Quarterstaff', SIMPLE],
  [/\bsickle\b/, 'sickle', 'Sickle', SIMPLE],
  [/\bspear\b|\bspears\b/, 'spear', 'Spear', SIMPLE],
  [/trident/, 'trident', 'Trident', MARTIAL],
  [/halberd/, 'halberd', 'Halberd', MARTIAL],
  [/glaive/, 'glaive', 'Glaive', MARTIAL],
  [/\bpike\b/, 'pike', 'Pike', MARTIAL],
  [/\blance\b|dragonlance/, 'lance', 'Lance', MARTIAL],
  [/\bwhip\b/, 'whip', 'Whip', MARTIAL],
  [/blowgun/, 'blowgun', 'Blowgun', MARTIAL],
  [/\bnet\b/, 'net', 'Net', MARTIAL],
  [/\bpick\b/, 'war pick', 'War pick', MARTIAL],
  [/rapier/, 'rapier', 'Rapier', MARTIAL],
  [/scimitar/, 'scimitar', 'Scimitar', MARTIAL],
  [/short.?sword|wand blade/, 'shortsword', 'Shortsword', MARTIAL],
  [/great.?sword|zweihander/, 'greatsword', 'Greatsword', MARTIAL],
  [/long.?sword|sword|blade\b/, 'longsword', 'Longsword', MARTIAL],
  [/\b(wand|rod|scepter|sceptre|orb)\b/, 'wand', 'Wand / rod', SIMPLE],
];
export const WEAPON_PROFICIENCY_IDS = WEAPON_PROFICIENCY_TABLE.map(([, id, label, category]) => ({ id, label, category }))
  .filter((w, i, a) => a.findIndex(x => x.id === w.id) === i);

function matchWeaponProficiencyName(name) {
  const n = String(name || '').toLowerCase();
  for (const [re, id, label, category] of WEAPON_PROFICIENCY_TABLE) if (re.test(n)) return { id, label, category };
  return null;
}
// -> { id, label, category:'simple'|'martial'|'natural' } for any weapon item. Natural weapons
// (claws, fangs, grafted limbs) are always proficient; an authored item.weaponCategory wins;
// anything else unrecognizable is treated as martial (a custom weapon is not a "simple" one).
export function weaponProficiencyInfo(item) {
  const authored = item && String(item.weaponCategory || '').toLowerCase();
  const found = matchWeaponProficiencyName(item && item.name) || { id: 'other', label: 'Other weapon', category: MARTIAL };
  if (authored === SIMPLE || authored === MARTIAL || authored === 'natural') return { ...found, category: authored };
  if (!matchWeaponProficiencyName(item && item.name) && /\b(claw|fang|bite|talon|horn|tail|sting|slam|maw)s?\b/i.test((item && item.name) || '')) return { id: 'natural', label: 'Natural weapon', category: 'natural' };
  return found;
}

const BOTH = [SIMPLE, MARTIAL];
export const CLASS_WEAPON_PROFICIENCY = {
  artificer: { categories: [SIMPLE] },
  barbarian: { categories: BOTH },
  bard:      { categories: [SIMPLE], weapons: ['hand crossbow', 'longsword', 'rapier', 'shortsword'] },
  cleric:    { categories: [SIMPLE] },
  druid:     { weapons: ['club', 'dagger', 'dart', 'javelin', 'mace', 'quarterstaff', 'scimitar', 'sickle', 'sling', 'spear'] },
  fighter:   { categories: BOTH },
  monk:      { categories: [SIMPLE], weapons: ['shortsword'] },
  paladin:   { categories: BOTH },
  ranger:    { categories: BOTH },
  rogue:     { categories: [SIMPLE], weapons: ['hand crossbow', 'longsword', 'rapier', 'shortsword'] },
  sorcerer:  { weapons: ['dagger', 'dart', 'sling', 'quarterstaff', 'light crossbow'] },
  warlock:   { categories: [SIMPLE] },
  wizard:    { weapons: ['dagger', 'dart', 'sling', 'quarterstaff', 'light crossbow'] },
};
// "Fighter", "Rogue / Wizard", "Battle Smith Artificer" -> union of every class name found in it.
export function classWeaponProficiencies(classText) {
  const text = String(classText || '').toLowerCase();
  const out = { categories: new Set(), weapons: new Set(), classes: [] };
  Object.entries(CLASS_WEAPON_PROFICIENCY).forEach(([cls, p]) => {
    if (!new RegExp('\\b' + cls + 's?\\b').test(text)) return;
    out.classes.push(cls);
    (p.categories || []).forEach(c => out.categories.add(c));
    (p.weapons || []).forEach(w => out.weapons.add(w));
  });
  return out;
}

// Reads weapon-proficiency grants out of free text (gear effect text, feat descriptions):
// "Proficiency with longbows and shortbows", "You gain proficiency with martial weapons",
// "proficient with all weapons". -> { all, categories:[], weapons:[] }
export function parseWeaponProficiencyGrants(text) {
  const out = { all: false, categories: [], weapons: [] };
  const t = String(text || '').replace(/<[^>]+>/g, ' ');
  const re = /proficien(?:cy|t)\s+(?:with|in)\s+([^.;()]*)/gi;
  let m;
  while ((m = re.exec(t)) !== null) {
    const seg = m[1].toLowerCase();
    if (/\b(all|every|any)\s+(?:kinds? of\s+)?weapons?\b/.test(seg)) out.all = true;
    if (/\bsimple\b/.test(seg)) out.categories.push(SIMPLE);
    if (/\bmartial\b/.test(seg)) out.categories.push(MARTIAL);
    seg.split(/,|\band\b|\bor\b/).forEach(part => {
      const p = part.trim().replace(/^(?:the|a|an)\s+/, '').replace(/(?<=[a-z])s$/, '');
      if (!p || /\b(simple|martial)\b/.test(p) || /\bweapons?$/.test(p)) return;
      const hit = matchWeaponProficiencyName(p);
      if (hit && p.length > 2) out.weapons.push(hit.id);
    });
  }
  return out;
}
// ctx: { classText, manual:{ categories:[], weapons:[] }, grants:[{ source, all, categories, weapons }] }
// -> { proficient, via, detail, info, classes }
export function weaponProficiencyCheck(item, ctx = {}) {
  const info = weaponProficiencyInfo(item);
  const cls = classWeaponProficiencies(ctx.classText);
  const manual = ctx.manual || {};
  const grants = ctx.grants || [];
  const base = { info, classes: cls.classes };
  if (info.category === 'natural') return { ...base, proficient: true, via: 'natural', detail: 'Natural weapons need no training.' };
  if (cls.categories.has(info.category) || cls.weapons.has(info.id)) {
    return { ...base, proficient: true, via: 'class', detail: `${cls.classes.map(c => c[0].toUpperCase() + c.slice(1)).join('/')} ${cls.categories.has(info.category) ? 'is proficient with ' + info.category + ' weapons' : 'is proficient with ' + info.label.toLowerCase() + 's'}.` };
  }
  if ((manual.categories || []).includes(info.category) || (manual.weapons || []).includes(info.id)) {
    return { ...base, proficient: true, via: 'manual', detail: `You marked ${(manual.weapons || []).includes(info.id) ? info.label.toLowerCase() + 's' : info.category + ' weapons'} as proficient on the Character Sheet.` };
  }
  const g = grants.find(x => x.all || (x.categories || []).includes(info.category) || (x.weapons || []).includes(info.id));
  if (g) return { ...base, proficient: true, via: 'gear', source: g.source, detail: `${g.source} grants proficiency with ${g.all ? 'all weapons' : (g.categories || []).includes(info.category) ? info.category + ' weapons' : info.label.toLowerCase() + 's'}.` };
  return { ...base, proficient: false, via: 'none', detail: `Not proficient with ${info.label.toLowerCase()}s (${info.category}).` };
}
