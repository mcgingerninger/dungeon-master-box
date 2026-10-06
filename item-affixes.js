// Weapon affixes, part 2: more materials, enchantments and stat prefixes, plus the weapon classes that
// decide which affixes make sense on which base weapon, and a read-aloud description for every affix.
// Loaded before the main script; the monolith appends `ItemAffixData.affixes` to its ITEM_AFFIXES list,
// filters by `bases` (see weaponClassesOf) and writes `looks` into a generated item's description.
// Each affix: { name, appliesTo, minRarity, maxRarity?, bases?, text: magnitude => string }.
// `bases` are weapon classes (below); an affix without `bases` fits any base weapon.
// Weights for every name live in mechanics/data/item-rules-default.js (AFFIX_WEIGHTS). Texts follow the
// Item Rules: damage-only (never an attack-roll modifier), and numeric where possible so they score.
(function () {
  const D = (window.ItemAffixData = window.ItemAffixData || {});

  // ---------------------------------------------------------------- weapon classes
  // melee / ranged are exclusive; the rest describe what the weapon is and is made of.
  const CLASSES = {
    'Dagger': 'blade light thrown melee metal', 'Shortsword': 'blade light melee metal', 'Scimitar': 'blade light melee metal',
    'Longsword': 'blade melee metal', 'Rapier': 'blade light melee metal', 'Greatsword': 'blade heavy melee metal', 'Sickle': 'blade light melee metal',
    'Handaxe': 'axe light thrown melee metal', 'Battleaxe': 'axe melee metal', 'Greataxe': 'axe heavy melee metal',
    'Club': 'blunt light melee wood', 'Mace': 'blunt melee metal', 'Warhammer': 'blunt melee metal', 'Morningstar': 'blunt melee metal',
    'Flail': 'blunt melee metal', 'Maul': 'blunt heavy melee metal', 'War Pick': 'blunt melee metal', 'Quarterstaff': 'staff blunt melee wood',
    'Spear': 'pole thrown melee metal', 'Javelin': 'pole thrown ranged metal', 'Trident': 'pole thrown melee metal',
    'Halberd': 'pole heavy melee metal', 'Glaive': 'pole heavy melee metal', 'Pike': 'pole heavy melee metal',
    'Whip': 'whip light melee',
    'Shortbow': 'ranged bow wood', 'Longbow': 'ranged bow wood', 'Sling': 'ranged sling',
    'Light Crossbow': 'ranged crossbow wood', 'Heavy Crossbow': 'ranged crossbow wood', 'Hand Crossbow': 'ranged crossbow wood'
  };
  D.weaponClassesOf = function (baseName) {
    const s = CLASSES[baseName];
    if (s) return s.split(' ');
    const n = String(baseName || '').toLowerCase();   // unknown bases: guess from the name
    const out = ['melee'];
    if (/bow|sling/.test(n)) return ['ranged', 'wood'];
    if (/sword|blade|dagger|knife|sabre|saber|scimitar|rapier|cutlass|falchion|katana|estoc/.test(n)) out.push('blade', 'metal');
    else if (/axe|hatchet/.test(n)) out.push('axe', 'metal');
    else if (/mace|hammer|maul|flail|star|club|staff|pick/.test(n)) out.push('blunt', 'metal');
    else if (/spear|pike|lance|glaive|halberd|trident|javelin/.test(n)) out.push('pole', 'metal');
    return out;
  };
  D.affixFits = function (affix, baseName) {
    if (!affix.bases || !baseName) return true;
    const cl = D.weaponClassesOf(baseName);
    return affix.bases.some(b => cl.includes(b));
  };

  // ---------------------------------------------------------------- the affixes
  const W = ['weapon'], WA = ['weapon', 'armor'];
  const A = (name, appliesTo, minRarity, bases, text, maxRarity) => Object.assign({ name, appliesTo, minRarity, bases, text }, maxRarity ? { maxRarity } : {});
  const SLAY = (name, minRarity, who) => A(name, W, minRarity, null, m => `+${m}d6 damage against ${who}.`);

  D.affixes = [
    // -- Materials --
    A('Bronze', W, 'common', ['metal'], () => 'No mechanical change — soft, old-fashioned metal that never rusts or corrodes.', 'uncommon'),
    A('Bone', W, 'common', ['melee'], () => 'Weighs half as much as a metal weapon and makes no sound when drawn, sheathed or dropped.', 'rare'),
    A('Obsidian', W, 'common', ['blade', 'axe', 'pole'], () => '+1 to damage rolls — a glassy, razor edge — but brittle: on a natural 1 on the attack roll it chips and loses this bonus until repaired.', 'rare'),
    A('Ironwood', W, 'uncommon', ['wood'], () => "+1 to damage rolls — grown dense as steel, and it can't be burned, rotted or splintered by nonmagical means."),
    A('Heartwood', W, 'uncommon', ['wood'], () => 'While you wield it and are below half your hit points, you regain 1 hit point at the start of each of your turns.'),
    A('Dwarven', W, 'uncommon', ['metal'], () => '+1 to damage rolls, and the weapon cannot be damaged by acid, rust or sundering effects.'),
    A('Elven', W, 'uncommon', ['blade', 'pole', 'ranged'], () => '+1 to damage rolls, and the weapon is light as a feather, weighing half as much as usual.'),
    A('Coldiron', W, 'uncommon', ['metal'], m => `+${m} to damage rolls against fey and fiends — raw, unrefined iron that spirits and devils cannot abide.`),
    A('Meteoric', W, 'rare', ['metal'], m => `+${m} to damage rolls, and the star-metal sheds dim light in a 10-foot radius while the weapon is drawn.`),
    A('Moonsilver', W, 'rare', ['metal'], m => `+${m} to damage rolls against shapechangers, lycanthropes and undead, and it ignores the damage resistance of creatures that resist nonmagical weapons.`),
    A('Sunsteel', W, 'rare', ['metal'], m => `+${m} to damage rolls against undead and creatures of shadow, and on command it sheds bright light in a 20-foot radius.`),
    A('Bloodsteel', W, 'rare', ['metal'], m => `+${m} to damage rolls against creatures at or below half their hit points.`),
    A('Blacksteel', W, 'rare', ['metal'], () => 'A creature hit by this weapon cannot regain hit points until the start of your next turn.'),
    A('Hellforged', W, 'rare', ['metal'], m => `+${m} to damage rolls, and fire damage dealt by this weapon ignores damage resistance. It is always warm to the touch.`),
    A('Shatterglass', W, 'rare', ['blade', 'axe', 'pole'], m => `On a critical hit, shards burst from the weapon, dealing ${m}d4 slashing damage to every other creature within 5 feet of the target.`, 'legendary'),
    A('Orichalcum', W, 'superrare', ['metal'], m => `+${m} to damage rolls, and the weapon can't be broken, dulled or corroded by any means short of divine intervention.`),
    A('Wraithsteel', W, 'superrare', ['metal'], () => 'Its damage is magical and counts as force damage, and it ignores the damage resistance of creatures that resist nonmagical weapons.'),
    A('Celestine', W, 'legendary', ['metal'], m => `+${m}d4 radiant damage on a hit, and once per long rest a hit lets you end one condition affecting you.`),

    // -- Weapon enchantments: damage types --
    A('Thundering', W, 'uncommon', null, m => `+${m}d4 thunder damage on a hit, and the strike can be heard for 300 feet.`),
    A('Corrosive', W, 'uncommon', null, m => `+${m}d4 acid damage on a hit, and nonmagical armor worn by the target takes a permanent -1 penalty to its AC (once per armor).`),
    A('Impact', W, 'uncommon', null, m => `+${m}d4 force damage on a hit.`),
    A('Wasting', W, 'rare', null, m => `+${m}d4 necrotic damage on a hit, and the target can't regain hit points until the start of your next turn.`),
    A('Mindrending', W, 'rare', null, m => `+${m}d4 psychic damage on a hit.`),
    A('Searing', W, 'rare', ['melee'], m => `Deals an extra ${m}d6 fire damage on a critical hit and ignites flammable objects the target carries.`),
    A('Sporing', W, 'uncommon', ['melee'], m => `On a critical hit, spores burst in a 5-foot radius around the target, dealing ${m}d4 poison damage to every creature there.`),
    A('Prismatic', W, 'legendary', null, m => `On each hit, roll a d6: +${m}d4 fire, cold, lightning, acid, poison or radiant damage matching the result.`),
    // -- combat tricks --
    A('Barbed', W, 'common', ['blade', 'axe', 'pole', 'whip'], () => 'On a hit, the target takes 1d4 bleeding damage at the start of its next turn.'),
    A('Cleaving', W, 'common', ['axe', 'heavy'], m => `When you reduce a creature to 0 hit points with it, you deal ${m}d4 damage of the same type to another creature within 5 feet.`),
    A('Brutal', W, 'uncommon', ['heavy', 'blunt', 'axe'], m => `+${m + 1} to damage rolls against creatures that are prone, grappled or restrained.`),
    A('Crushing', W, 'uncommon', ['blunt'], m => `+${m} to damage rolls against constructs, objects and creatures in heavy armor.`),
    A('Dueling', W, 'uncommon', ['light', 'blade'], m => `+${m} to damage rolls when no other creature is within 5 feet of your target.`),
    A('Tactical', W, 'uncommon', null, m => `+${m} to damage rolls when an ally is within 5 feet of the target.`),
    A('Tidal', W, 'uncommon', ['melee'], m => `+${m} to damage rolls, and once per turn you can push a creature you hit 5 feet away from you.`),
    A('Gale', W, 'uncommon', ['blade', 'pole', 'whip'], () => '+1 to damage rolls, and once per turn a creature you hit must succeed on a Strength saving throw or be pushed 10 feet away.'),
    A('Dazzling', W, 'uncommon', null, () => 'On a critical hit, the target is blinded until the end of its next turn.'),
    A('Rending', W, 'uncommon', ['pole', 'blade', 'ranged'], () => 'Once per turn, damage from this weapon ignores damage resistance to its damage type.'),
    A('Seeking', W, 'uncommon', ['ranged', 'thrown'], m => `On a miss, the shot still deals ${m}d4 damage to the target.`),
    A('Returning', W, 'uncommon', ['thrown'], () => 'When thrown, it returns to your hand at the end of your turn if it is within 60 feet.'),
    A('Parrying', W, 'uncommon', ['blade', 'light', 'staff'], () => '+1 Armor Class while you wield it.'),
    A('Quickdraw', W, 'common', null, () => 'You can draw or stow it as part of the same action or movement, without spending your free object interaction.'),
    A('Hushed', W, 'common', ['melee'], () => 'Makes no sound when it strikes, and you have advantage on Stealth checks made while you wield it.'),
    A('Luminous', W, 'common', null, () => 'Sheds bright light in a 20-foot radius on command, and dim light for another 20 feet.'),
    A('Sundering', W, 'rare', ['axe', 'blunt', 'pole'], () => "On a hit, the target's AC drops by 1 until the end of its next turn; the drops stack to a maximum of 3."),
    A('Reaching', W, 'rare', ['pole', 'whip'], () => 'Your reach with this weapon increases by 5 feet.'),
    A('Quaking', W, 'rare', ['blunt', 'axe'], m => `On a critical hit the target is knocked prone and each other creature within 5 feet takes ${m}d6 thunder damage.`),
    A('Berserking', W, 'rare', ['heavy', 'axe', 'blunt'], m => `While you are at half your hit points or fewer, +${m + 1} to damage rolls.`),
    A('Hungering', W, 'rare', null, m => `When you reduce a creature to 0 hit points with it, you regain ${m * 2} hit points.`),
    A('Lucky', W, 'rare', null, () => 'Once per long rest, you can reroll one damage roll made with it and use either result.'),
    A('Executing', W, 'superrare', null, m => `Deals an extra ${m}d8 damage to a creature that is below a quarter of its hit points.`),
    A('Gravitic', W, 'superrare', ['melee'], m => `+${m} to damage rolls, and once per turn you can pull or push a creature you hit up to 10 feet.`),
    A('Soulreaver', W, 'legendary', null, m => `When you reduce a creature to 0 hit points with it, you gain ${m}d8 temporary hit points.`),
    A('Temporal', W, 'legendary', null, () => 'Once per short rest, after rolling damage with this weapon, you can reroll the damage dice and take either result.'),
    // -- slayers --
    SLAY('Beastbane', 'common', 'beasts'), SLAY('Plantbane', 'uncommon', 'plants'), SLAY('Oozebane', 'uncommon', 'oozes'),
    SLAY('Giantbane', 'uncommon', 'giants'), SLAY('Undeadbane', 'uncommon', 'undead'), SLAY('Constructbane', 'uncommon', 'constructs'),
    SLAY('Aberrationbane', 'rare', 'aberrations'), SLAY('Elementalbane', 'rare', 'elementals'), SLAY('Fiendbane', 'rare', 'fiends'),
    SLAY('Dragonbane', 'rare', 'dragons'),

    // -- Stat prefixes (weapon or armor) --
    A('Swift', WA, 'common', null, m => `+${m * 5} Movement Speed.`),
    A('Hale', WA, 'common', null, m => `+${m * 5} Maximum Hit Points.`),
    A('Vigilant', WA, 'common', null, m => `+${m} Initiative.`),
    A('Watchful', WA, 'common', null, m => `+${m} Perception.`),
    A('Lurking', WA, 'common', null, m => `+${m} Stealth.`),
    A('Fearsome', WA, 'common', null, m => `+${m} Intimidation.`),
    A('Persuasive', WA, 'common', null, m => `+${m} Persuasion.`),
    A('Brawny', WA, 'common', null, m => `+${m} Athletics.`),
    A('Agile', WA, 'common', null, m => `+${m} Acrobatics.`),
    A('Learned', WA, 'common', null, m => `+${m} Arcana.`),
    A('Wayfaring', WA, 'common', null, m => `+${m} Survival.`),
    A('Restorative', WA, 'uncommon', null, m => `+${m} Healing Received.`)
  ];

  // ---------------------------------------------------------------- how each affix looks
  // One or two sentences per affix, {w} = the base weapon's name in lower case. `armor` lines are only for
  // affixes that can land on armor. Used by the item description generator.
  const L = D.looks = {};
  const look = (name, weapon, armor) => { L[name] = { weapon, armor: armor || null }; };
  // existing materials and enchantments
  look('Rusty', ['Flaking rust blooms along the {w}, and the edge is more a rumor than a promise.', 'Orange scale has eaten into the {w}; it will still hurt you, but it will not be kind about it.'], ['Rust has eaten at the plates and rivets; every joint complains.']);
  look('Iron', ['Plain dark iron, honestly made, with the faint ring of a good hammer in every line of the {w}.', 'The {w} is unadorned iron, heavy and no-nonsense.'], ['Dark, honest iron; nothing fancy, nothing missing.']);
  look('Steel', ['Well-tempered steel with a bright, even edge; the {w} has clearly been looked after.', 'The {w} holds a clean, grey-white shine that has never quite gone out.'], ['Tempered steel plates, polished to a sober shine.']);
  look('Silvered', ['A thin skin of silver has been worked into the {w}, a pale lustre that turns monsters\' heads.', 'Silver runs in fine inlay through the {w}, cold and bright as moonlit water.']);
  look('Mithral', ['The {w} is lighter than it has any right to be, and the pale metal drinks in the room\'s light.', 'Almost no weight at all: the {w} shimmers silver-blue, and rings like a struck glass.'], ['Impossibly light, shimmering silver-blue mail that moves like cloth.']);
  look('Adamantine', ['Dark, dense adamantine, so hard that the {w}\'s edge seems to cut the light itself.', 'The {w} is a deep, cold grey-blue and utterly without blemish, as if nothing could ever mark it.'], ['Cold grey-blue adamantine plates that no blow has ever dented.']);
  look('Dragonbone', ['The {w} is carved from dragon bone, ivory-yellow and warm to the touch, with a grain like old smoke.', 'Pale, heavy dragonbone forms the {w}; it hums faintly, as though something old were still breathing in it.']);
  look('Voidsteel', ['The {w} drinks light: a black, matte steel with a faint violet undertone and no reflection at all.', 'Voidsteel makes up the {w}, so dark that its edge seems to be missing from the world.']);
  look('Runic', ['Fine runes are etched along the {w} in lines that seem to rearrange when you look away.', 'A line of glowing runes winds around the {w}, silver-blue and quiet.'], ['Fine runes are stitched and etched across it, faintly glowing in the dim.']);
  look('Ancient', ['The {w} is impossibly old, worn smooth by hands that have long since turned to dust.', 'It carries the patina of centuries; whatever age made the {w} did not survive, but the {w} did.'], ['Ancient work, patinated and humming with the weight of old oaths.']);
  look('Sharp', ['The edge of the {w} has been honed to a whisper; paper would part just by looking at it.', 'The {w} is kept wickedly sharp, the bevel mirror-bright.']);
  look('Heavy', ['The {w} is heavier than it ought to be, its weight dragging at the wrist and promising a bruise.', 'Dense and ill-balanced toward the business end, the {w} wants to fall on something.']);
  look('Balanced', ['The {w} sits in the hand as if made for it, balanced so true it feels half its weight.', 'Pick it up and the {w} settles at a point of perfect balance, almost eager.']);
  look('Flaming', ['Heat shimmers off the {w}, and a thread of ember-orange runs along its length.', 'The {w} is warm to the hand, with a flicker of fire licking along the edge.']);
  look('Frost', ['Frost rimes the {w}, and every breath near it turns to mist.', 'The {w} is cold enough to burn bare skin, coated in a fine white fur of ice.']);
  look('Shocking', ['Small blue sparks crawl along the {w}, and the hair on your arm stands up when it is near.', 'A thin lightning-filament runs through the {w}, snapping at nearby metal.']);
  look('Venomous', ['A greenish film coats the {w}, and the smell of bitter almonds clings to it.', 'A dark, oily sheen weeps from the {w}\'s edge, beading in sickly drops.']);
  look('Radiant', ['The {w} gives off a soft, golden glow like early morning light on an old chapel.', 'Gold light moves across the {w} as if the metal remembered a sunrise.']);
  look('Vicious', ['The {w} is built for cruelty: serrated, barbed and ugly, made to leave a bad wound.', 'Everything about the {w} says it was made to do as much damage as possible and not look back.']);
  look('Masterful', ['The {w} is the work of a master: every line deliberate, every joint seamless.', 'There is not a wasted gram on the {w}; it looks like it has never been in a bad hand.']);
  look('Vampiric', ['Dark red threads run through the {w}, and the edge seems to glisten even when it is clean.', 'The {w} is cool and faintly sticky; the metal seems to be waiting to drink.']);
  look('Mighty', ['The {w} seems built for a giant\'s grip, thick in the haft and heavy in the head.'], ['Broad, thick plates that seem built for a giant\'s frame.']);
  look('Nimble', ['The {w} is slender and quick, almost eager to move.'], ['Slim, flexible plates that never drag.']);
  look('Hardy', ['The {w} has been built tough: plain, thick, and unbothered by hard use.'], ['Reinforced at every seam; this has been through worse than you.']);
  look('Brilliant', ['Faint, neat sigils dot the {w}, like marginal notes in an expert\'s hand.'], ['Neat margins of tiny script run along every plate.']);
  look('Wise', ['Quiet, worn grooves mark the {w}\'s grip, as if centuries of patient hands had held it.'], ['Worn smooth in all the right places by patient, careful use.']);
  look('Charismatic', ['The {w} has a subtle, undeniable presence that draws the eye, even in a crowd.'], ['It catches the light just so, and the eye follows it around the room.']);
  // armor-only enchantments
  look('Sturdy', [], ['The plates are thick and deliberately over-built, with reinforcing ribs at every stress point.']);
  look('Warded', [], ['Small warding sigils run along every seam, glowing dimly whenever something dangerous is near.']);
  look('Padded', [], ['Thick quilted padding lines every inch, with a faint, comforting smell of wool and lanolin.']);
  look('Silent', [], ['Every buckle is wrapped in felt and every plate cushioned, so that it moves in perfect silence.']);
  look('Reflective', [], ['The outer surface is polished like a mirror, throwing back every glint of light and the occasional arrow.']);
  look('Grounded', [], ['The soles and joints are broad and low, giving a stance as steady as a standing stone.']);
  // new materials
  look('Bronze', ['A dull gold-brown bronze, soft and green at the seams; the {w} looks like it belongs in a barrow.', 'The {w} is cast in old bronze, warm in tone and quiet in the hand.']);
  look('Bone', ['The {w} is carved from heavy bone, yellow-white and veined, with a surprising lightness.', 'Joints of carved bone, lashed with sinew, make up the {w}; it clicks softly when moved.']);
  look('Obsidian', ['The {w} is volcanic glass, black and glossy, with an edge you can almost see through.', 'Chipped from a single sheet of obsidian, the {w} has the ugly, honest beauty of a broken bottle.']);
  look('Ironwood', ['The {w} is made of dark, close-grained ironwood, as heavy as bone and nearly as hard.', 'Ironwood gives the {w} a dense, oiled gleam, with a grain like flowing water.']);
  look('Heartwood', ['The {w} is carved from the red heart of an old tree and seems faintly warm, like skin.', 'A rich, resinous scent comes off the {w}, and the grain seems to pulse like a slow heartbeat.']);
  look('Dwarven', ['Dwarven craft shows in every join of the {w}: square-cut, runed and built to outlast mountains.', 'The {w} is heavy, plain and impeccably made, with a mason\'s mark stamped near the grip.']);
  look('Elven', ['The {w} is slender and leaf-shaped, with flowing lines that seem to move even at rest.', 'Silver-green filigree curls along the {w}; it is almost too lovely to use.']);
  look('Coldiron', ['Dull grey coldiron makes up the {w}, with a cold, hungry feel that makes the teeth ache.', 'The {w} is a dark, matte, unrefined iron, uneasy to the eye and cold in the hand.']);
  look('Meteoric', ['The {w} is made from fallen star-metal, flecked with tiny sparks that glitter like constellations.', 'Pitted and star-flecked, the {w} gives off a faint, silver-blue glow in darkness.']);
  look('Moonsilver', ['Pale moonsilver runs the length of the {w}, soft as moonlight on a still pond.', 'The {w} shines with a clean, cold, bluish silver that seems to hold its own small moon.']);
  look('Sunsteel', ['The {w} is warm golden steel that catches the light and throws it back brighter than it came.', 'Sunsteel gleams on the {w}, as though a captured dawn were hammered into the metal.']);
  look('Bloodsteel', ['Deep red runs through the {w}\'s steel like veins in marble, and the edge looks permanently wet.', 'The {w} is a dark crimson steel that seems to pulse faintly when held near something living.']);
  look('Blacksteel', ['The {w} is a lightless, blue-black steel with an edge that shows no gleam at all.', 'Blacksteel makes up the {w}, cold and matte, drawing the warmth from the hand that holds it.']);
  look('Hellforged', ['The {w} is soot-black steel veined with dull red, always faintly warm and smelling of sulfur.', 'Cracks of ember-red light run through the {w}\'s dark metal, as if still cooling from the forge.']);
  look('Shatterglass', ['The {w} is faceted, razor-bright glass that splits the light into colored shards.', 'A cloudy, glittering glass forms the {w}, veined with hairline cracks that never seem to widen.']);
  look('Orichalcum', ['A warm, coppery gold sheen lies across the {w}, with a glow that does not come from any lamp.', 'The {w} is rose-gold orichalcum, flawless, and unbothered by anything that ever struck it.']);
  look('Wraithsteel', ['The {w} is a semi-translucent grey, cold as a ghost\'s breath and faintly misty at the edges.', 'You can see the wall right through parts of the {w}, though it feels solid enough in the hand.']);
  look('Celestine', ['The {w} is pale, pearlescent celestine, almost too bright to look at, humming like a held note.', 'White-gold celestine forms the {w}, shining like frost in sunlight and light as a prayer.']);
  // enchantments
  look('Thundering', ['A deep, low rumble thrums through the {w} whenever it moves, and loose items rattle near it.', 'The {w} is scorched with pale blue-white lines like frozen thunderclaps.']);
  look('Corrosive', ['A faint green-yellow smoke curls off the {w}, and the surfaces it touches pit and flake.', 'The {w} is stained with caustic bruises of green and bronze.']);
  look('Impact', ['The {w} seems to shimmer with force, the air around it bending slightly at each swing.', 'The {w}\'s surface is smooth and clear-cut, with a faint blue shiver of pressure around it.']);
  look('Wasting', ['A grey-green pallor clings to the {w}, and flowers wilt where it is carried.', 'The {w} is veined with dull, sickly grey lines like a body gone cold.']);
  look('Mindrending', ['Violet light seems to shift behind the {w}\'s surface, and staring too long brings a faint ringing in the ears.', 'The {w} is marked with thin, spiraling lines that are somehow hard to follow.']);
  look('Searing', ['The {w}\'s edge glows a deep ember-orange, and the air above it shimmers like a road in summer.', 'Soot-black and ember-lined, the {w} smolders gently even when it is still.']);
  look('Sporing', ['Fuzzy patches of pale spores bloom across the {w}, puffing faintly when jostled.', 'Tiny fungal caps dot the {w}, and it smells of damp earth and old basements.']);
  look('Prismatic', ['The {w} splits the light into a slow wheel of colors, shifting as it moves.', 'A rainbow slides across the {w}\'s surface, every angle a different color.']);
  look('Barbed', ['Rows of backswept barbs run along the {w}, made to catch and tear.', 'The {w} is bristling with hooked spurs and cruel little teeth.']);
  look('Cleaving', ['The {w} is built to carry through: a deep, wide profile that looks like it could split a doorframe.', 'Its heavy leading edge on the {w} has the look of something meant to follow through on a swing.']);
  look('Brutal', ['The {w} is thick and unlovely, built to batter things that have already fallen.', 'The {w} bears dents and old stains; it has done a great deal of finishing work.']);
  look('Crushing', ['The head of the {w} is dense and flat-faced, designed to break things rather than cut them.', 'The {w} is so dense that it seems to push the air out of its way.']);
  look('Dueling', ['The {w} is slender and handsome, built for one-on-one work in a ring of watchers.', 'A guard worked like a fencer\'s lace protects the hand on the {w}.']);
  look('Tactical', ['Small tally marks and battle-signals are etched along the {w}, a field commander\'s notes.', 'A little brass whistle and a strip of colored cloth are tied to the {w}\'s grip.']);
  look('Tidal', ['Small beads of seawater cling to the {w} and never quite dry, and it smells of salt.', 'The {w} is polished like sea-glass, with a faint wave pattern in the metal.']);
  look('Gale', ['A faint breeze plays around the {w}, lifting loose hair and the corners of cloaks.', 'The {w} is etched with swirling wind-lines and hums softly in a crosswind.']);
  look('Dazzling', ['The {w} flashes in the light, throwing sharp reflections that jump across the room.', 'A mirror-bright polish makes the {w} painful to look at in direct light.']);
  look('Rending', ['The {w} has a wickedly narrow, purposeful profile built to find the seams in anything.', 'Fine chisel-marks along the {w} suggest a maker obsessed with finding weak points.']);
  look('Seeking', ['A tiny silver eye is etched into the {w}, and it seems to follow whatever you look at.', 'Its sights are fine and bright, as though it had already picked a target.']);
  look('Returning', ['A loop of silver thread is wound around the {w}\'s grip, and it tugs gently toward the hand.', 'The {w} is weighted so that it always seems to want to come back to you.']);
  look('Parrying', ['The {w} has a wide, protective guard, worn bright where blows have glanced off it.', 'Scratches and chips on the {w}\'s guard tell the story of a hundred turned blades.']);
  look('Quickdraw', ['The {w}\'s grip and sheath are smooth and tapered so it leaps from its place at the first touch.', 'The {w} looks as if it is always half-drawn, quiet and ready.']);
  look('Hushed', ['The {w} is wrapped in dark felt and oiled to silence; it never rattles or rings.', 'No ring, no scrape, no whisper: the {w} makes no sound, as if swallowed by the world.']);
  look('Luminous', ['A soft, steady glow shines from a crystal set in the {w}, as warm as a candle flame.', 'The {w} carries a small, bright gem that glows from within, no matter how dark the room.']);
  look('Sundering', ['The {w} is notched and scarred from breaking shields, hinges and the bones of larger things.', 'Heavy and square-faced, the {w} has clearly spent its life breaking things apart.']);
  look('Reaching', ['The {w} is a little longer than it should be, and its haft seems to stretch each time you glance away.', 'Notches along the {w}\'s shaft mark each additional hand\'s width of reach.']);
  look('Quaking', ['The ground seems to shudder faintly around the {w}, and small pebbles skitter on stone nearby.', 'Heavy and rough, the {w} carries a low vibration like a distant avalanche.']);
  look('Berserking', ['The {w}\'s grip is stained dark, wrapped in strips of red cloth, and seems oddly eager.', 'Frenzied scratches and glyphs cover the {w}, as if it had been carved in a rage.']);
  look('Hungering', ['The {w} has a hollow, wanting look, and you get the feeling it is never quite satisfied.', 'A ring of tiny teeth marks the {w}\'s pommel, as though it had been gnawed on while waiting.']);
  look('Lucky', ['A four-leaf clover is inlaid on the {w}\'s grip in tiny green enamel.', 'The {w} carries a pair of tiny gold dice set into the pommel.']);
  look('Executing', ['The {w} has a long, dark, patient look, like something that waits.', 'The {w} is somber, black-edged and utterly without ornament, built for a single final purpose.']);
  look('Gravitic', ['The {w} seems oddly heavy, and small objects drift gently toward it when it is set down.', 'A tiny, warped halo of light bends around the {w}, as if it bent space just a little.']);
  look('Soulreaver', ['Pale blue-green light flickers inside the {w}, like a lantern full of captured whispers.', 'Faint, wispy faces seem to move beneath the {w}\'s polish, and the metal is cold as a tomb.']);
  look('Temporal', ['The {w}\'s edge seems to flicker half a heartbeat behind its own motion, trailing faint afterimages.', 'Tiny gears and a sand-glass motif are worked into the {w}, and it ticks softly when held still.']);
  const SL = (n, who, what) => look(n, [`The {w} is stamped with the mark of a hunter of ${who}, ${what}.`, `A cunning pattern of ${who}-themed carvings marks the {w}, ${what}.`]);
  SL('Beastbane', 'beasts', 'with claw marks etched along the blade'); SL('Plantbane', 'plants', 'with leaf-and-flame scrollwork'); SL('Oozebane', 'oozes', 'its edge coated in a salt-white glaze');
  SL('Giantbane', 'giants', 'with a tiny hanged giant on the pommel'); SL('Undeadbane', 'undead', 'with a sun symbol worked into the guard'); SL('Constructbane', 'constructs', 'with fine gear-cutting marks');
  SL('Aberrationbane', 'aberrations', 'its surface etched with warding eyes'); SL('Elementalbane', 'elementals', 'with the four winds carved in a circle'); SL('Fiendbane', 'fiends', 'with a holy sigil in silver');
  SL('Dragonbane', 'dragons', 'with a fanged skull worked into the hilt');
  // stat prefixes (shared)
  const ST = (n, a, b) => look(n, [a], [b]);
  ST('Swift', 'The {w} is feather-light and sleek, built to move with its wielder rather than against.', 'Light, streamlined and strangely quiet underfoot.');
  ST('Hale', 'The {w} has a red-gold warmth in the grip, and it feels like holding a living hand.', 'There is a flush of warmth along the lining, like a hearth on a cold night.');
  ST('Vigilant', 'A single watchful eye is engraved on the {w}, always facing outward.', 'Studded with small watchful eyes in brass, always facing outward.');
  ST('Watchful', 'The {w} has a polished crystal near the guard that seems to catch every little movement.', 'A tiny crystal lens set at the collar catches every flicker of motion.');
  ST('Lurking', 'The {w} is darkened and wrapped in soft cloth, easy to lose in a shadow.', 'Matte and dark, with muffled buckles that swallow every sound.');
  ST('Fearsome', 'Grinning, snarling faces are carved into the {w}, and children avert their eyes from it.', 'Spiked and snarling, marked with ferocious faces.');
  ST('Persuasive', 'The {w} is handsomely made, inlaid with silver and polished until it gleams like a promise.', 'Beautifully tailored and trimmed, it commands polite attention.');
  ST('Brawny', 'The {w} is thick and blunt, with a wrapped grip that fits a big, strong hand perfectly.', 'Broad, thick plates wrapped in rough leather.');
  ST('Agile', 'The {w} is slim and springy, and wants to dance in the hand.', 'Cut close and supple, with flexible joints that never bind.');
  ST('Learned', 'Tiny, neat symbols and a small book-clasp motif mark the {w}\'s grip.', 'Marginalia and small clasps of silver decorate every seam.');
  ST('Wayfaring', 'The {w} is scuffed by a hundred roads, with a small compass rose inlaid on the pommel.', 'Road-worn, patched and mended, with a compass rose stitched inside.');
  ST('Restorative', 'A pale green glow pulses softly beneath the {w}\'s grip, calming to the touch.', 'A soft green warmth flows through the lining, like a quiet breath.');
})();
