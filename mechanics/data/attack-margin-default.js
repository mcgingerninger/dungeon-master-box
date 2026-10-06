// The margin table: how well an attack hit decides how much damage it does and what else happens.
//
//   M = d20 + attack modifiers - defender AC
//
// M picks a tier (below). Each tier says whether it hits, what percent of the normal damage it deals, and
// how many MINOR and MAJOR effects the attacker earns. A natural 20 is always a hit (at least the "Hit" tier)
// and doubles the damage dice on top of the tier's percentage; a natural 1 is always a fumble.
// Effects are options the attacker picks from (filtered by the weapon class); the lists are at the bottom.
// Plain JSON-able data so the DM panel can edit/export it later; docs/ATTACK_MARGIN.md explains it.

export const MARGIN_TIERS = [
  { id: 'fumble',      label: 'Fumble',        max: -10,           hit: false, dmgPct: 0,   minor: 0, major: 0, fumble: true },
  { id: 'miss',        label: 'Clean miss',    min: -9, max: -5,   hit: false, dmgPct: 0,   minor: 0, major: 0 },
  { id: 'glancing',    label: 'Glancing blow', min: -4, max: -1,   hit: true,  dmgPct: 50,  minor: 0, major: 0, round: 'down' },
  { id: 'hit',         label: 'Hit',           min: 0,  max: 3,    hit: true,  dmgPct: 100, minor: 0, major: 0 },
  { id: 'solid',       label: 'Solid hit',     min: 4,  max: 7,    hit: true,  dmgPct: 125, minor: 1, major: 0 },
  { id: 'strong',      label: 'Strong hit',    min: 8,  max: 11,   hit: true,  dmgPct: 150, minor: 2, major: 0 },
  { id: 'crushing',    label: 'Crushing hit',  min: 12, max: 15,   hit: true,  dmgPct: 200, minor: 1, major: 1 },
  { id: 'devastating', label: 'Devastating',   min: 16,           hit: true,  dmgPct: 250, minor: 0, major: 2 },
];

// Weapon classes an effect can be limited to. Every attack also counts as 'melee' or 'ranged'.
//   blade axe blunt pole whip staff natural heavy light thrown ranged melee unarmed
// An effect with no `classes` is open to everything.
const E = (id, name, text, classes) => (classes ? { id, name, text, classes } : { id, name, text });

export const MINOR_EFFECTS = [
  E('shove', 'Shove', 'Push the target 5 ft. directly away from you.'),
  E('mark', 'Mark', 'Your next attack against the target before the end of your next turn gets +2 to its margin (M).'),
  E('expose', 'Expose', "The target's AC is 1 lower until the end of your next turn."),
  E('offbalance', 'Off-balance', "The target's speed is reduced by 10 ft. until the end of its next turn."),
  E('rattle', 'Rattle', 'The target has -2 to its next saving throw.'),
  E('distract', 'Distract', "The target can't take reactions until the start of its next turn."),
  E('press', 'Press the advantage', 'Move up to 5 ft. toward or around the target without provoking.'),
  E('taunt', 'Draw the eye', 'The target has disadvantage on attacks against anyone but you until the end of its next turn.'),
  E('opening', 'Open a gap', 'An ally within 30 ft. may move 10 ft. without provoking.'),
  E('steady', 'Steady yourself', 'Gain temporary hit points equal to your proficiency bonus.'),
  E('strength', 'Show strength', "The target can't willingly move closer to you until the end of its next turn."),
  E('breakfocus', 'Break focus', 'The target has disadvantage on its next Concentration check.'),
  E('weakspot', 'Find the weak spot', "An ally's next attack against the target this round gets +1 to its margin."),
  E('quicken', 'Quicken', 'You may swap or stow one held item for free.'),
  // blades
  E('nick', 'Bleeding nick', 'The target takes 1d4 damage at the start of its next turn.', ['blade', 'axe', 'pole', 'natural', 'ranged']),
  E('slipguard', 'Slip the guard', "The target drops one item it is holding that isn't its main weapon.", ['blade', 'whip', 'light']),
  E('guarded', 'Guarded stance', 'You gain +1 AC until the start of your next turn.', ['blade', 'pole', 'staff', 'light']),
  E('cutcloak', 'Cut the cloth', "The target's speed is reduced by 10 ft. and it can't take the Dash action until the end of its next turn.", ['blade', 'axe']),
  E('skirmish', 'Skirmish', 'After the attack, move up to 10 ft. without provoking.', ['light', 'blade', 'natural', 'whip']),
  // axes and heavy weapons
  E('hookshield', 'Hook the shield', "The target's shield bonus doesn't apply to your next attack against it.", ['axe']),
  E('chip', 'Chip armor', "The target's AC is 1 lower for the rest of the encounter (stacks to -2).", ['axe', 'heavy', 'blunt']),
  E('followthrough', 'Follow-through', 'Deal 1d6 damage to another creature adjacent to the target.', ['heavy', 'axe']),
  E('overwhelm', 'Overwhelm', "The target's next attack against you has -2 to its margin.", ['heavy', 'blunt']),
  // blunt
  E('ringing', 'Ringing blow', 'The target is deafened until the end of its next turn.', ['blunt', 'heavy']),
  E('winded', 'Winded', "The target can't use bonus actions until the end of its next turn.", ['blunt', 'natural', 'unarmed']),
  E('dent', 'Dent the guard', "The target's next attack roll has -2 to its margin.", ['blunt', 'staff', 'unarmed']),
  E('jolt', 'Jolt', "The target can't benefit from advantage on its next attack roll.", ['blunt', 'staff', 'unarmed']),
  // polearms and reach
  E('bay', 'Keep at bay', "The target can't move closer to you until the end of its next turn.", ['pole', 'whip']),
  E('hookdrag', 'Hook and drag', 'Pull the target 5 ft. toward you.', ['pole', 'whip']),
  E('tripline', 'Trip line', "The target's speed is halved until the end of its next turn.", ['pole', 'whip', 'staff']),
  // whips
  E('lashhand', 'Lash the hand', 'The target drops one held item (its choice).', ['whip']),
  E('snag', 'Snag', "The target's speed is reduced by 15 ft. until the end of its next turn.", ['whip']),
  // ranged
  E('pinning', 'Pinning shot', "The target's speed is reduced by 10 ft. until the end of its next turn.", ['ranged']),
  E('suppress', 'Suppressive shot', 'The target has disadvantage on ranged attacks until the end of its next turn.', ['ranged']),
  E('steadyaim', 'Steady aim', 'Your next ranged attack against the target ignores cover.', ['ranged']),
  E('tracer', 'Tracer', "The target can't hide from you until the end of the encounter.", ['ranged']),
  E('ricochet', 'Ricochet', 'The missile glances onward: another creature within 5 ft. of the target takes 1d4 damage.', ['thrown', 'ranged']),
  // natural weapons
  E('worry', 'Savage worry', "The target's speed is reduced by 10 ft. as you hold on until the start of your next turn.", ['natural']),
  E('rake', 'Raking wound', 'The target takes 1d4 damage at the start of its next turn.', ['natural', 'unarmed']),
  E('snarl', 'Snarl', "The target has -2 to its margin on its next attack (it flinches).", ['natural']),
  E('grapplehold', 'Latch on', 'You gain advantage on your next attempt to grapple or shove the target.', ['natural', 'unarmed']),
];

export const MAJOR_EFFECTS = [
  E('prone', 'Knock prone', 'The target falls prone.', ['melee']),
  E('stun', 'Stun', 'The target is stunned until the end of its next turn.', ['blunt', 'heavy', 'staff', 'unarmed', 'natural']),
  E('blind', 'Blinding strike', 'The target is blinded until the end of its next turn.'),
  E('terrify', 'Terrify', 'The target is frightened of you until the end of its next turn.'),
  E('shatterfocus', 'Shatter focus', 'The target immediately loses concentration on any spell.'),
  E('rally', 'Dominate the field', 'All allies within 30 ft. get +2 to their margin against the target until the start of your next turn.'),
  E('savage', 'Savage display', 'Enemies within 15 ft. of you have disadvantage on their next attack.'),
  E('maximize', 'Vital strike', 'Treat every weapon damage die on this hit as its maximum (add the difference to the damage).'),
  E('swap', 'Disrupt the line', 'Swap places with the target; neither provokes.', ['melee']),
  E('bleed', 'Open wound', 'The target bleeds for 1d6 damage at the start of each of its turns for 3 rounds (a Medicine check or any healing stops it).', ['blade', 'axe', 'pole', 'natural', 'ranged']),
  E('disarm', 'Disarm', 'The target drops its weapon; it lands 10 ft. away.', ['blade', 'whip', 'axe', 'pole', 'light']),
  E('hamstring', 'Hamstring', "The target's speed is 0 until the end of its next turn, then halved for 1 minute.", ['blade', 'pole', 'axe', 'ranged']),
  E('woundhealing', 'Wither the wound', "The target can't regain hit points for 3 rounds.", ['blade', 'natural', 'ranged', 'pole']),
  E('lockdown', 'Lock down', "The target can't take reactions and has disadvantage on Dexterity saves until the end of its next turn.", ['whip', 'pole', 'blade']),
  E('finishing', 'Finishing opening', 'If the target is at a quarter of its hit points or fewer, it drops to 0 hit points (stable if you wish).', ['blade', 'axe', 'pole', 'ranged', 'natural']),
  E('cripplearm', 'Cripple the arm', "The target's attacks have -2 to their margin and it can't use two-handed weapons until the end of the encounter.", ['blade', 'blunt', 'axe']),
  E('cleave', 'Cleave', 'Immediately make one extra weapon attack against a different creature within reach.', ['axe', 'blade', 'heavy', 'blunt']),
  E('pierce', 'Pierce through', 'The strike carries on and hits another creature behind the target for half damage.', ['ranged', 'pole']),
  E('breakarmor', 'Shatter armor', "The target's AC is 2 lower for the rest of the encounter.", ['axe', 'blunt', 'heavy', 'pole']),
  E('sunder', 'Sunder', "The target's weapon deals -2 damage until repaired or the encounter ends.", ['axe', 'blunt', 'heavy']),
  E('knockback', 'Heavy blow', 'Push the target 15 ft.; if it hits a wall or another creature it falls prone.', ['blunt', 'heavy', 'pole', 'staff']),
  E('daze', 'Daze', 'On its next turn the target can take an action or move, not both.', ['blunt', 'heavy', 'staff', 'natural', 'unarmed']),
  E('rattleskull', 'Rattled skull', 'The target is confused (acts at random) until the end of its next turn.', ['blunt', 'heavy', 'staff']),
  E('concussive', 'Concussive crack', "The target is deafened and can't take reactions until the start of its next turn.", ['blunt', 'natural', 'unarmed']),
  E('pin', 'Pin', 'The target is restrained until it uses its action to break free.', ['ranged', 'pole', 'whip']),
  E('snare', 'Snare', "The target's speed is 0 and its AC is 2 lower until it uses its action to break free.", ['ranged', 'whip']),
  E('seize', 'Seize', 'The target is grappled (escape DC 8 + your proficiency bonus + your STR modifier).', ['natural', 'whip', 'heavy', 'unarmed']),
  E('trample', 'Trample', "Move through the target's space; it is knocked prone and takes 1d6 damage.", ['natural', 'heavy']),
  E('overbear', 'Overbear', 'The target falls prone and is pushed 5 ft.', ['natural', 'heavy', 'unarmed']),
  E('feed', 'Feed on the blow', 'You regain hit points equal to twice your proficiency bonus.', ['natural', 'blade']),
  E('whirl', 'Whirl', 'Every other enemy within 5 ft. of you takes half the damage you just dealt.', ['axe', 'heavy', 'blade']),
  E('ripost', 'Opening for a riposte', 'You may immediately make one opportunity attack against the target.', ['blade', 'pole', 'light']),
];

export const FUMBLE_EFFECTS = [
  E('slip', 'Slips from the grip', 'You drop your weapon (or lose your aim); picking it up costs half your movement.', ['melee']),
  E('offbalance', 'Off-balance', "You can't take reactions until the start of your next turn."),
  E('overextend', 'Overextended', 'Attacks against you have +2 to their margin until the start of your next turn.'),
  E('stuck', 'Stuck fast', 'The weapon wedges in something; freeing it takes your next action.', ['melee']),
  E('jam', 'Jam or misfire', 'The weapon jams, the string frays or the sling tangles; fix it as an action before using it again.', ['ranged']),
  E('stumble', 'Stumble', 'You fall prone.'),
  E('wasted', 'Wasted breath', 'You lose your bonus action this turn.'),
  E('noise', 'Loud mistake', 'Everything within 60 ft. hears the clatter.'),
  E('freeswing', 'Free opening', 'The target may make one opportunity attack against you.'),
  E('pulled', 'Pulled muscle', 'You have -2 to your margin on your next attack.'),
  E('friendly', 'Strike wide', 'An ally within 5 ft. of the target takes half your normal damage (if there is one); otherwise you stumble.', ['melee']),
];

export const DEFAULT_ATTACK_MARGIN = { tiers: MARGIN_TIERS, minor: MINOR_EFFECTS, major: MAJOR_EFFECTS, fumble: FUMBLE_EFFECTS };
