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
  socket:           { cat: 'Modification', label: 'Socket',            default: it => ['weapon', 'armor'].includes(it.type) },
  repair:           { cat: 'Modification', label: 'Repair',            default: it => ['weapon', 'armor'].includes(it.type) },
  spell_focus:      { cat: 'Magic',       label: 'Spell Focus',        default: it => /spellcasting focus|holy symbol|arcane focus|druidic focus/i.test(it.effect || '') },
  ritual_component: { cat: 'Magic',       label: 'Ritual Component',   default: it => it.type === 'craftable' && RITUAL_PARTS.has(it.partType) },
  summon_component: { cat: 'Magic',       label: 'Summoning Component', default: it => it.type === 'craftable' && SUMMON_PARTS.has(it.partType) },
  monster_material: { cat: 'Monster',     label: 'Monster Material',   default: it => it.type === 'craftable' && it.subcategory === 'monsterpart' },
  fleshmancer_input:{ cat: 'Monster',     label: 'Fleshmancer Input',  default: it => it.type === 'craftable' && FLESHMANCER_PARTS.has(it.partType) },
  trophy:           { cat: 'Monster',     label: 'Trophy',             default: it => it.type === 'craftable' && TROPHY_PARTS.has(it.partType) },
  salvage:          { cat: 'Processing',  label: 'Salvage',            default: it => ['weapon', 'armor'].includes(it.type) },
  harvest:          { cat: 'Processing',  label: 'Harvest',            default: it => it.type !== 'craftable' && (it.classification || [])[0] === 'Material' },
  consume:          { cat: 'Consumable',  label: 'Consume',            default: it => it.type === 'consumable' && ['potion', 'food'].includes(it.subcategory) },
  apply:            { cat: 'Consumable',  label: 'Apply',              default: it => it.type === 'consumable' && /\boil\b|ointment|salve|balm/i.test(it.name || '') },
  crumble:          { cat: 'Consumable',  label: 'Crumbles When Spent', default: it => it.type === 'consumable' && !!it.charges },
  throw:            { cat: 'Combat',      label: 'Throw',              default: it => it.subcategory === 'throwable' },
  weapon_coating:   { cat: 'Combat',      label: 'Weapon Coating',     default: it => it.type === 'consumable' && /poison/i.test(it.name || '') },
  place:            { cat: 'World',       label: 'Place',              default: it => /\btrap\b|\btotem\b|\bward\b|\bbanner\b|\bbeacon\b/i.test(it.name || '') },
  unlock:           { cat: 'World',       label: 'Unlock',             default: it => it.type === 'questitem' && it.subcategory === 'key' },
  quest_item:       { cat: 'Quest',       label: 'Quest Item',         default: it => it.type === 'questitem' },
  turn_in:          { cat: 'Quest',       label: 'Turn-In',            default: it => it.type === 'questitem' },
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
  if (/\bcrate\b|\bchest\b|\bbarrel\b|\bcontainer\b/.test(n)) return ['Miscellaneous','Household','Container'];
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
  if (/\bfire\b|flame|burn|ember/.test(text)) props.push('Fire');
  if (/\bcold\b|frost|ice\b/.test(text)) props.push('Cold');
  if (/lightning|thunder|shock/.test(text)) props.push('Lightning');
  if (/poison|venom|toxic/.test(text)) props.push('Poison');
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
  if (/king|queen|royal|noble|crown|throne/.test(text)) tags.add('royal');
  if (/ancient|primordial|elder/.test(text)) tags.add('ancient');
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
export const SHEET_STAT_ALIASES = { 'Max HP': 'Maximum Hit Points', 'Max Hit Points': 'Maximum Hit Points' };

export function proficiencyBonusForLevel(level) {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}
export function abilityModifier(score) { return Math.floor((score - 10) / 2); }
export function fmtMod(n) { return (n >= 0 ? '+' : '') + n; }

let _sheetStatVocabRegex = null;
export function extractStatDeltasFromText(text) {
  if (!text) return [];
  if (!_sheetStatVocabRegex) {
    const names = new Set([...Object.values(ABILITY_NAMES), 'Maximum Hit Points', 'Saving Throws', ...Object.keys(SKILL_ABILITY_MAP), ...Object.keys(SHEET_STAT_ALIASES)]);
    const alt = [...names].sort((a, b) => b.length - a.length).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    _sheetStatVocabRegex = new RegExp(`([+-]\\d+)\\s+(${alt})\\b`, 'g');
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

export function collectEquippedStatBreakdown(slots, resolveItem) {
  const breakdown = {};
  uniqueEquippedSlotEntries(slots).forEach(([slotId, key]) => {
    const entry = resolveItem(key);
    if (!entry) return;
    extractStatDeltasFromText(entry.item.effect).forEach(({ stat, amount }) => {
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
    extractStatSetValuesFromText(entry.item.effect).forEach(({ stat, value }) => {
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

export function collectEquippedAcBreakdown(slots, resolveItem) {
  let base = 10, baseSource = null;
  const flatSources = [];
  uniqueEquippedSlotEntries(slots).forEach(([slotId, key]) => {
    const entry = resolveItem(key);
    if (!entry) return;
    const raw = String(entry.item.ac || '').trim();
    if (!raw) return;
    if (slotId === 'armor' && /^\d+$/.test(raw)) { base = parseInt(raw, 10); baseSource = entry.item.name; return; }
    const m = /^([+-]\d+)$/.exec(raw);
    if (m) flatSources.push({ itemName: entry.item.name, amount: parseInt(m[1], 10) });
  });
  return { base, baseSource, flatSources };
}

export function computeCharacterSheetFor(abilityScores, level, skillProfs, saveProfs, slots, resolveItem, baseMaxHp, activeEffects) {
  const breakdown = addActiveEffectDeltas(collectEquippedStatBreakdown(slots, resolveItem), activeEffects);
  const setOverrides = collectStatSetOverrides(slots, resolveItem, activeEffects);
  const abilities = {};
  Object.keys(ABILITY_NAMES).forEach(abbr => {
    const full = ABILITY_NAMES[abbr];
    const base = abilityScores[abbr] != null ? abilityScores[abbr] : 10;
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
  const profBonus = proficiencyBonusForLevel(level || 1);
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
  const baseSourceEntry = acField.baseSource ? [{ itemName: acField.baseSource, amount: acField.base - 10, isBaseOverride: true }] : [];
  const viaDex = dex.modDelta ? dex.sources.map(s => ({ itemName: s.itemName, amount: s.amount, viaAbility: 'Dexterity' })) : [];
  const acFlatTotal = sumBreakdown(acField.flatSources);
  const acSources = [...baseSourceEntry, ...acField.flatSources, ...viaDex];
  const acTotal = acField.base + dex.mod + acFlatTotal;
  const acNet = (acField.base - 10) + acFlatTotal + dex.modDelta;
  const ac = { total: acTotal, sources: acSources, status: statusFor(acNet), tooltip: describeStatSources(acSources) };
  const maxHpSources = breakdown['Maximum Hit Points'] || [];
  const maxHpBonus = sumBreakdown(maxHpSources);
  const base = baseMaxHp != null ? baseMaxHp : 0;
  const maxHp = { base, bonus: maxHpBonus, total: base + maxHpBonus, sources: maxHpSources, status: statusFor(maxHpBonus), tooltip: describeStatSources(maxHpSources) };
  return { abilities, profBonus, saves, skills, ac, maxHp };
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
