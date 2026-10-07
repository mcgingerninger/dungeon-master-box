// Ammunition: arrows (bows) and bolts (crossbows) as their own stackable items (up to 999 per stack).
// A bow or crossbow is just the weapon; every shot spends one piece of matching ammunition from the inventory.
// Ammunition is built from two parts that stack:
//   head   - the material it is tipped with (flint, steel, silver, adamantine, starmetal ...): a flat damage bonus
//   effect - an enchantment or trick (flaming, barbed, net, seeking ...): extra damage dice, a to-hit bonus and/or a rider
// plus a handful of hand-made legendary and celestial pieces. Every item carries a machine-readable `ammo` block that the
// attack code reads, and a plain `effect` line that players read.
// Window API: AmmoData.items (array of catalog items), AmmoData.byRarity(r), AmmoData.kindFor(weapon), AmmoData.STACK_MAX,
//             AmmoData.stats(item) -> { flat, dice[], atk, riders[] }, AmmoData.describe(item)
(function () {
  const STACK_MAX = 999;
  const KINDS = {
    arrow: { noun: 'Arrow', plural: 'arrows', launcher: 'bow', weight: 0.05, art: 'arrow' },
    bolt: { noun: 'Bolt', plural: 'bolts', launcher: 'crossbow', weight: 0.075, art: 'bolt' },
  };
  const RARITIES = ['common', 'uncommon', 'rare', 'legendary', 'celestial'];
  const rank = r => RARITIES.indexOf(r);
  // Typical bundle found in loot / sold at once (min, max). Bigger finds the plainer the ammunition.
  const BUNDLE = { common: [20, 40], uncommon: [10, 20], rare: [5, 12], legendary: [2, 5], celestial: [1, 3] };
  // Price of ONE piece (a stack is priced per piece x quantity).
  const GP = { common: 0.1, uncommon: 0.8, rare: 5, legendary: 50, celestial: 300 };

  // ---- heads: the material (a flat bonus to damage, plus what it is good against) ----
  // flat: damage added on a hit; label used as the name prefix
  const HEADS = [
    { id: 'flint', label: 'Flint', rarity: 'common', flat: 0, text: 'A chipped flint head. Cheap and reliable.', trait: '' },
    { id: 'iron', label: 'Iron', rarity: 'common', flat: 0, text: 'A plain forged iron head.', trait: '' },
    { id: 'bone', label: 'Bone', rarity: 'common', flat: 0, text: 'A carved bone head that makes almost no noise in flight.', trait: 'Silent: loosing it does not reveal your position by sound.' },
    { id: 'steel', label: 'Steel', rarity: 'uncommon', flat: 1, text: 'A hardened steel head that bites deep.', trait: '' },
    { id: 'silver', label: 'Silvered', rarity: 'uncommon', flat: 1, text: 'A silvered head that sears things weak to silver.', trait: 'Silvered: counts as silver against creatures vulnerable to it, and ignores resistance to nonmagical weapons from lycanthropes and devils.' },
    { id: 'obsidian', label: 'Obsidian', rarity: 'uncommon', flat: 1, dice: '1d4', type: 'slashing', text: 'A glassy volcanic head with a razor edge. It shatters on impact.', trait: 'Shatters: leaves a bleeding wound. The target takes 1 more damage at the start of its next turn.' },
    { id: 'mithral', label: 'Mithral', rarity: 'rare', flat: 2, text: 'A mithral head, light as a feather and sharper than steel.', trait: 'Weightless flight: +1 to the attack roll.', atk: 1 },
    { id: 'adamantine', label: 'Adamantine', rarity: 'rare', flat: 3, text: 'A black adamantine head that punches through anything.', trait: 'Armour-breaker: ignores resistance to piercing damage and treats nonmagical armour as 2 AC lower.', atk: 2 },
    { id: 'dragonbone', label: 'Dragonbone', rarity: 'legendary', flat: 4, dice: '1d6', type: 'fire', text: 'A head carved from the fang of an elder dragon. It is always warm.', trait: 'Embers: the wound smoulders and ignites loose flammables near the target.' },
    { id: 'starmetal', label: 'Starmetal', rarity: 'celestial', flat: 6, dice: '1d8', type: 'radiant', text: 'A head of fallen star-iron that hums like a struck bell.', trait: 'Star-struck: counts as magical, radiant and silvered.', atk: 2 },
  ];

  // ---- effects: enchantments and tricks ----
  // dice/type: extra damage dice. rider: what else happens. atk: bonus to the attack roll. save: { stat, dc } for the rider.
  const EFFECTS = [
    { id: 'whistling', label: 'Whistling', rarity: 'common', text: 'A hollow shaft that shrieks in flight.', rider: 'The shriek draws attention: the target and creatures within 10 ft. of it hear exactly where it came from.' },
    { id: 'barbed', label: 'Barbed', rarity: 'uncommon', dice: '1d4', type: 'piercing', text: 'A head with swept-back barbs that cannot be pulled free cleanly.', rider: 'Bleeding: the target takes 1d4 damage at the start of each of its turns until it or an ally spends an action pulling it out.' },
    { id: 'armorpiercing', label: 'Bodkin', rarity: 'uncommon', atk: 2, text: 'A needle-thin head made to find the gap in armour.', rider: 'Treat the target as 2 AC lower. Has no effect on creatures with no armour.' },
    { id: 'tracking', label: 'Tracking', rarity: 'uncommon', text: 'A head wrapped with a pinch of scented moss.', rider: 'Marks the target for 1 hour: the shooter always knows its direction and distance, and has advantage on Survival checks to follow it.' },
    { id: 'smoke', label: 'Smoke', rarity: 'uncommon', text: 'A hollow head packed with smoke powder.', rider: 'On impact a 10 ft. cloud of smoke fills the area: heavily obscured for 1 minute (or until a strong wind).' },
    { id: 'net', label: 'Snare', rarity: 'uncommon', text: 'A head that unfolds into a weighted net on impact.', rider: 'No damage dice. The target is restrained (Strength DC 12 to escape) for up to 1 minute.', save: { stat: 'STR', dc: 12 }, noDamage: true },
    { id: 'flaming', label: 'Flaming', rarity: 'rare', dice: '1d6', type: 'fire', text: 'Wrapped in oil-soaked cord that ignites as it is loosed.', rider: 'Sets loose flammable objects the target carries alight.' },
    { id: 'frost', label: 'Frost', rarity: 'rare', dice: '1d6', type: 'cold', text: 'Cold to the touch and rimed with frost.', rider: 'The target\'s speed is halved until the start of the shooter\'s next turn.' },
    { id: 'shock', label: 'Shocking', rarity: 'rare', dice: '1d6', type: 'lightning', text: 'A copper head that crackles with static.', rider: 'The target cannot take reactions until the start of its next turn.' },
    { id: 'venom', label: 'Venomed', rarity: 'rare', dice: '1d6', type: 'poison', text: 'Slick with a thick green venom.', rider: 'The target must succeed on a DC 13 Constitution save or be poisoned for 1 minute (repeat the save at the end of each of its turns).', save: { stat: 'CON', dc: 13 } },
    { id: 'acid', label: 'Corrosive', rarity: 'rare', dice: '1d6', type: 'acid', text: 'A glass-tipped head holding a hissing acid.', rider: 'The acid eats at armour: the target has -1 AC until it spends an action wiping the acid off (stacks up to -3).' },
    { id: 'thunder', label: 'Thunderous', rarity: 'rare', dice: '1d6', type: 'thunder', text: 'The head cracks like a whip on impact.', rider: 'The target is pushed 10 ft. away from the shooter (Strength DC 13 negates).', save: { stat: 'STR', dc: 13 } },
    { id: 'radiant', label: 'Sunlit', rarity: 'rare', dice: '1d8', type: 'radiant', text: 'Etched with a sun glyph that glows white-gold.', rider: 'Sheds bright light 10 ft. around the target for 1 minute and outlines it: invisible creatures are revealed.' },
    { id: 'necrotic', label: 'Gravetouched', rarity: 'rare', dice: '1d8', type: 'necrotic', text: 'Black as old grave soil, cold as the tomb.', rider: 'The target cannot regain hit points until the start of the shooter\'s next turn.' },
    { id: 'seeking', label: 'Seeking', rarity: 'rare', text: 'Fletched with a feather that always turns to its mark.', rider: 'If the shot misses, the shooter may reroll the attack roll once. Keep the second result.', atk: 1 },
    { id: 'explosive', label: 'Blasting', rarity: 'rare', dice: '2d6', type: 'fire', text: 'A fat clay head packed with fire-powder.', rider: 'Explodes on impact: every creature within 5 ft. of the target takes 2d6 fire damage (Dexterity DC 14 for half). The target takes the damage on a hit as well.', save: { stat: 'DEX', dc: 14 }, area: 5 },
    { id: 'slayer_beast', label: 'Beast-Bane', rarity: 'rare', dice: '2d6', type: 'piercing', text: 'Scored with hunters\' marks.', rider: 'Deals an extra 2d6 damage to beasts.', versus: 'beast' },
    { id: 'slayer_undead', label: 'Grave-Bane', rarity: 'rare', dice: '2d6', type: 'radiant', text: 'Inscribed with a prayer for the dead.', rider: 'Deals an extra 2d6 radiant damage to undead.', versus: 'undead' },
  ];
  // Effects that combine with a premium head into a named item (the rest only exist on a plain head).
  const COMBO_EFFECTS = ['flaming', 'frost', 'shock', 'venom', 'acid', 'thunder', 'radiant', 'necrotic', 'seeking', 'explosive', 'barbed', 'armorpiercing'];
  const COMBO_HEADS = ['silver', 'obsidian', 'mithral', 'adamantine', 'dragonbone', 'starmetal'];

  // ---- hand-made legendary and celestial pieces ----
  const SPECIAL = [
    { name: 'Wyrmslayer', rarity: 'legendary', head: 'dragonbone', dice: '3d6', type: 'piercing', versus: 'dragon', text: 'Forged from the shattered tooth of a slain wyrm, it still remembers who killed it.', rider: 'Deals an extra 3d6 piercing damage to dragons and drakes, and ignores their damage resistances.' },
    { name: 'Stormcaller', rarity: 'legendary', head: 'mithral', dice: '2d6', type: 'lightning', text: 'A mithral shaft lashed with a thread of captured lightning.', rider: 'Lightning leaps to up to two other creatures within 15 ft. of the target, who each take 2d6 lightning damage (Dexterity DC 15 for half).', save: { stat: 'DEX', dc: 15 }, area: 15 },
    { name: 'Phoenix', rarity: 'legendary', head: 'dragonbone', dice: '2d8', type: 'fire', text: 'Fletched with a feather that never finished burning.', rider: 'Bursts into a 10 ft. radius flare of fire: 2d8 fire damage to every creature there (Dexterity DC 15 for half). If it kills the target, the shooter regains 1d8 hit points.', save: { stat: 'DEX', dc: 15 }, area: 10 },
    { name: 'Banshee', rarity: 'legendary', head: 'bone', dice: '2d6', type: 'necrotic', text: 'It wails the whole way down range.', rider: 'The target must succeed on a DC 15 Wisdom save or be frightened for 1 minute. Creatures that cannot hear are immune.', save: { stat: 'WIS', dc: 15 } },
    { name: 'Quicksilver', rarity: 'legendary', head: 'silver', atk: 3, dice: '2d6', type: 'piercing', text: 'A liquid-silver head that bends toward gaps in cover.', rider: 'Ignores half and three-quarters cover. The target counts as 4 AC lower.' },
    { name: 'Earthshaker', rarity: 'legendary', head: 'adamantine', dice: '2d8', type: 'force', text: 'A dense cylinder of adamantine that strikes like a siege weapon.', rider: 'Knocks the target prone (Strength DC 15 negates) and pushes it 15 ft.', save: { stat: 'STR', dc: 15 } },
    { name: 'Starfall', rarity: 'celestial', head: 'starmetal', dice: '4d8', type: 'radiant', text: 'It leaves the bow dark and lands as a falling star.', rider: 'A column of white fire strikes a 10 ft. radius around the target: 4d8 radiant damage to every creature there (Dexterity DC 17 for half). Undead and fiends have disadvantage on the save.', save: { stat: 'DEX', dc: 17 }, area: 10 },
    { name: 'Oblivion', rarity: 'celestial', head: 'starmetal', dice: '6d8', type: 'necrotic', text: 'The air around it forgets how to be air.', rider: 'A target reduced to 30 hit points or fewer by this damage dies instantly. Cannot be raised without a Wish.' },
    { name: 'Judgement', rarity: 'celestial', head: 'starmetal', atk: 5, dice: '3d10', type: 'radiant', text: 'It does not miss the guilty.', rider: 'Always strikes true against fiends, undead and creatures that attacked the shooter\'s allies this round: the shot automatically hits and deals maximum damage on its dice.' },
    { name: 'World-Tree', rarity: 'celestial', head: 'mithral', dice: '3d8', type: 'piercing', text: 'Grown, not made, from a branch of something older than the gods.', rider: 'Roots erupt around the target: restrained (Strength DC 17 to break free) and the area in 15 ft. becomes difficult terrain for 1 minute. The shooter regains the damage dealt, up to 20 hit points.', save: { stat: 'STR', dc: 17 }, area: 15 },
  ];

  // ---- builders ----
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const headById = id => HEADS.find(h => h.id === id);
  const effectById = id => EFFECTS.find(e => e.id === id);
  const bump = r => RARITIES[Math.min(RARITIES.length - 1, rank(r) + 1)];
  const gpText = (r, kind, extra) => { const n = Math.max(0.05, Math.round((GP[r] || 0.1) * (extra || 1) * 100) / 100); return n + ' gp'; };

  function makeItem(kind, parts) {
    const K = KINDS[kind];
    const head = parts.head ? headById(parts.head) : null;
    const eff = parts.effect ? effectById(parts.effect) : null;
    const sp = parts.special || null;
    // rarity: the higher of its parts; a premium head + a magical effect together step up one tier
    let rarity = sp ? sp.rarity : 'common';
    if (!sp) {
      rarity = rank(head ? head.rarity : 'common') >= rank(eff ? eff.rarity : 'common') ? (head ? head.rarity : 'common') : eff.rarity;
      if (head && eff && rank(head.rarity) === 2 && rank(eff.rarity) >= 2) rarity = bump(rarity);
    }
    const dice = [];
    let flat = head ? head.flat : 0, atk = 0;
    const riders = [];
    const notes = [];
    if (head && head.dice) dice.push({ dice: head.dice, type: head.type });
    if (head && head.atk) atk += head.atk;
    if (head && head.trait) riders.push(head.trait);
    if (eff) { if (eff.dice && !eff.noDamage) dice.push({ dice: eff.dice, type: eff.type, versus: eff.versus || null }); if (eff.atk) atk += eff.atk; riders.push(eff.rider); }
    if (sp) { if (sp.dice) dice.push({ dice: sp.dice, type: sp.type, versus: sp.versus || null }); if (sp.atk) atk += sp.atk; riders.push(sp.rider); }
    if (sp) flat += (headById(sp.head) || {}).flat || 0;
    const save = (eff && eff.save) || (sp && sp.save) || null;
    const name = sp ? `${sp.name} ${K.noun}` : (eff && head ? `${eff.label} ${head.label} ${K.noun}` : eff ? `${eff.label} ${K.noun}` : head ? `${head.label} ${K.noun}` : K.noun);
    const lines = [];
    if (flat) lines.push(`+${flat} damage`);
    dice.forEach(d => lines.push(`+${d.dice} ${d.type}${d.versus ? ' vs ' + d.versus + 's' : ''}`));
    if (atk) lines.push(`+${atk} to hit`);
    const rule = lines.join(', ');
    const desc = [sp ? sp.text : '', head && !sp ? head.text : '', eff && !sp ? eff.text : ''].filter(Boolean).join(' ');
    const effect = [`Ammunition for ${K.launcher}s: spends one ${K.noun.toLowerCase()} per shot.`, rule ? `On a hit: ${rule}.` : '', ...riders].filter(Boolean).join(' ');
    const mult = (head ? 1 + head.flat * 0.4 : 1);
    const bundle = BUNDLE[rarity];
    return {
      name, desc: desc || `A plain ${K.noun.toLowerCase()} for a ${K.launcher}.`, type: 'misc', subcategory: 'ammo', slotSize: 1, icon: K.art,
      gp: gpText(rarity, kind, mult), effect, weight: K.weight, stackMax: STACK_MAX, bundle: bundle.slice(), ammoKind: kind, rarity,
      ammo: { kind, flat, dice, atk, riders, save, headId: parts.head || (sp && sp.head) || null, effectId: parts.effect || null, special: sp ? sp.name : null },
    };
  }

  const items = [];
  Object.keys(KINDS).forEach(kind => {
    items.push(makeItem(kind, {}));                                           // plain
    HEADS.forEach(h => items.push(makeItem(kind, { head: h.id })));           // single head
    EFFECTS.forEach(e => items.push(makeItem(kind, { effect: e.id })));       // single effect on an ordinary head
    COMBO_HEADS.forEach(h => COMBO_EFFECTS.forEach(e => items.push(makeItem(kind, { head: h, effect: e }))));
    SPECIAL.forEach(s => items.push(makeItem(kind, { special: s })));
  });
  // drop duplicates that two routes produced (e.g. a head-only item is also named after its head)
  const seen = new Set();
  const catalog = items.filter(it => { const k = it.name; if (seen.has(k)) return false; seen.add(k); return true; });

  const byRarity = r => catalog.filter(i => i.rarity === r);
  // Which ammunition a launcher takes: crossbows take bolts, bows (and longbows etc.) take arrows, slings/hand-launchers take none.
  function kindFor(weapon) {
    if (!weapon) return null;
    const text = ((weapon.name || '') + ' ' + (weapon.effect || '') + ' ' + (weapon.desc || '')).toLowerCase();
    const name = String(weapon.name || '').toLowerCase();
    if (/(?:needs? no|does not need|requires? no|never needs?|without)\s+(?:any\s+)?(?:ammunition|arrows|bolts|ammo)|creates? (?:its own|arrows|bolts)|conjures? (?:its own )?(?:arrows|bolts)|produces? (?:its own )?(?:arrows|bolts)|fires? (?:its own )?(?:arrows|bolts) of/.test(text)) return null;
    if (/crossbow/.test(name)) return 'bolt';
    if (/(?:long|short|great|composite|recurve|war|hunting|oath|horn)?bow\b/.test(name) && !/\b(?:elbow|rainbow|bowl|bowie|bowler)\b/.test(name)) return 'arrow';
    return null;
  }
  function stats(item) {
    const a = item && item.ammo;
    if (!a) return { flat: 0, dice: [], atk: 0, riders: [], save: null };
    return { flat: a.flat || 0, dice: (a.dice || []).slice(), atk: a.atk || 0, riders: (a.riders || []).slice(), save: a.save || null };
  }
  const isAmmo = item => !!(item && (item.subcategory === 'ammo' || item.ammoKind));
  const stackMaxOf = item => (item && item.stackMax) || (isAmmo(item) ? STACK_MAX : 1);
  function rollBundle(item, rng) {
    const b = item && item.bundle; if (!b) return 1;
    const r = rng || Math.random;
    return b[0] + Math.floor(r() * (b[1] - b[0] + 1));
  }
  window.AmmoData = { STACK_MAX, KINDS, HEADS, EFFECTS, items: catalog, byRarity, kindFor, stats, isAmmo, stackMaxOf, rollBundle, makeItem };
})();
