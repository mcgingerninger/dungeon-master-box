// Attack narrator, plain-language layer. Loaded after the vivid data files and BEFORE the engine, it rewrites the wording
// pools in place so a description reads like a DM's quick cue, not a paragraph of prose: short sentences, everyday words,
// action first (what the creature does, what it hits, what the wound is), and generic enough to be woven into the DM's own
// telling. The vivid pools it replaces are kept in git history; nothing in the engine or the data shapes changes.
// Spell-specific hand-written lines (attack-narrator-spells.js) are left as they were.
(function () {
  const D = window.AttackNarratorData; if (!D) return;

  // ---------------------------------------------------------------- creature moves
  // [motion, hit, miss] per move; windup / crit / fumble come from the group defaults below.
  const NAT = {
    bite: ['{Subj} {v:lunge} at {tgt} and {v:bite}.', '{Subj} {v:bite} {tgtPoss} {part}, leaving {wound}.', '{Subj} {v:snap} at {tgt} but the bite misses.'],
    claw: ['{Subj} {v:swipe} at {tgt} with {their} {limb}.', '{Subj} {v:claw} {tgtPoss} {part}, leaving {wound}.', '{Subj} {v:swipe} at {tgt} and {v:miss}.'],
    talon: ['{Subj} {v:strike} at {tgt} with {their} {limb}.', '{Subj} {v:rake} {tgtPoss} {part}, leaving {wound}.', '{Tgt} ducks and the {limb} miss.'],
    slam: ['{Subj} {v:swing} at {tgt}.', '{Subj} {v:slam} into {tgtPoss} {part}, leaving {wound}.', '{Subj} {v:swing} and {v:miss} {tgt}.'],
    stomp: ['{Subj} {v:stomp} at {tgt}.', '{Subj} {v:stomp} on {tgtPoss} {part}, leaving {wound}.', '{Tgt} jumps clear of the stomp.'],
    gore: ['{Subj} {v:charge} {tgt}.', '{Subj} {v:gore} {tgtPoss} {part}, leaving {wound}.', '{Tgt} dodges the charge.'],
    tail: ['{Subj} {v:lash} out with {their} {limb}.', '{Subj} {v:hit} {tgtPoss} {part} with {their} {limb}, leaving {wound}.', '{Tgt} ducks under the {limb}.'],
    wing: ['{Subj} {v:beat} {their} {limb} at {tgt}.', '{Subj} {v:buffet} {tgtPoss} {part}, leaving {wound}.', '{Tgt} dodges the blow.'],
    sting: ['{Subj} {v:jab} at {tgt} with {their} {limb}.', '{Subj} {v:sting} {tgtPoss} {part}, leaving {wound}.', '{Tgt} twists away from the {limb}.'],
    tentacle: ['{Subj} {v:lash} a {limb} at {tgt}.', '{Subj} {v:hit} {tgtPoss} {part} with a {limb}, leaving {wound}.', '{Tgt} dodges the {limb}.'],
    constrict: ['{Subj} {v:wrap} around {tgt}.', '{Subj} {v:squeeze} {tgtPoss} {part}, leaving {wound}.', '{Tgt} slips out before it tightens.'],
    engulf: ['{Subj} {v:lunge} at {tgt} to swallow {them} whole.', '{Subj} {v:swallow} {tgt}, leaving {wound}.', '{Tgt} jumps clear before it can swallow.'],
    touch: ['{Subj} {v:reach} out and {v:touch} {tgt}.', '{Subj} {v:touch} {tgtPoss} {part}, leaving {wound}.', '{Tgt} avoids the touch.'],
    beak: ['{Subj} {v:peck} at {tgt}.', '{Subj} {v:stab} {tgtPoss} {part} with {their} {limb}, leaving {wound}.', '{Tgt} dodges the {limb}.'],
    pincer: ['{Subj} {v:snap} {their} {limb} at {tgt}.', '{Subj} {v:clamp} down on {tgtPoss} {part}, leaving {wound}.', '{Tgt} pulls back from the {limb}.'],
    rend: ['{Subj} {v:attack} {tgt} with {their} {limb}.', '{Subj} {v:tear} at {tgtPoss} {part}, leaving {wound}.', '{Tgt} fights {them} off and takes no damage.'],
    unarmed: ['{Subj} {v:throw} a punch at {tgt}.', '{Subj} {v:hit} {tgtPoss} {part}, leaving {wound}.', '{Tgt} dodges the blow.'],
    strike: ['{Subj} {v:strike} at {tgt}.', '{Subj} {v:hit} {tgtPoss} {part}, leaving {wound}.', '{Tgt} avoids the blow.'],
  };
  const MELEE_W = {
    blade: 'slash', shortblade: 'stab', greatblade: 'cleave', axe: 'chop', greataxe: 'chop', hammer: 'smash', club: 'bash', mace: 'smash', staff: 'strike', spear: 'thrust', polearm: 'sweep', whip: 'lash', shield: 'slam', pick: 'jab',
  };
  const PAST = { slash: 'slash', stab: 'stab', cleave: 'cleave', chop: 'chop', smash: 'smash', bash: 'bash', strike: 'hit', thrust: 'stab', sweep: 'hit', lash: 'lash', slam: 'slam', jab: 'jab' };
  const RANGED = {
    bow: ['{Subj} {v:loose} an arrow from {their} {instr} at {tgt}.', 'The arrow hits {tgtPoss} {part}, leaving {wound}.', 'The arrow misses {tgt}.'],
    crossbow: ['{Subj} {v:fire} a bolt from {their} {instr} at {tgt}.', 'The bolt hits {tgtPoss} {part}, leaving {wound}.', 'The bolt misses {tgt}.'],
    sling: ['{Subj} {v:sling} a stone at {tgt}.', 'The stone hits {tgtPoss} {part}, leaving {wound}.', 'The stone misses {tgt}.'],
    thrown: ['{Subj} {v:throw} a {instr} at {tgt}.', 'The {instr} hits {tgtPoss} {part}, leaving {wound}.', 'The {instr} misses {tgt}.'],
    firearm: ['{Subj} {v:fire} at {tgt}.', 'The shot hits {tgtPoss} {part}, leaving {wound}.', 'The shot misses {tgt}.'],
    net: ['{Subj} {v:throw} a net at {tgt}.', 'The net lands on {tgt}, leaving {wound}.', 'The net misses {tgt}.'],
    shot: ['{Subj} {v:shoot} at {tgt}.', 'The shot hits {tgtPoss} {part}, leaving {wound}.', 'The shot misses {tgt}.'],
  };
  const set = (id, o) => { const m = D.MOVES[id]; if (m) Object.assign(m, o); };
  Object.keys(NAT).forEach(id => {
    const [motion, hit, miss] = NAT[id];
    set(id, {
      windup: ['{Subj} {v:close} in on {tgt}.', '{Subj} {v:line} up {tgt}.'],
      motion: [motion], hit: [hit], miss: [miss],
      crit: ['A clean, hard hit: {subj} {v:land} it squarely on {tgt}.'],
      fumble: ['{Subj} {v:overreach} and {v:stumble}, leaving {themself} open.'],
    });
  });
  Object.keys(MELEE_W).forEach(id => {
    const v = MELEE_W[id];
    set(id, {
      windup: ['{Subj} {v:raise} {their} {instr}.', '{Subj} {v:close} in on {tgt}.'],
      motion: [`{Subj} {v:${v}} at {tgt} with {their} {instr}.`], hit: [`{Subj} {v:${PAST[v]}} {tgtPoss} {part} with {their} {instr}, leaving {wound}.`], miss: ['{Tgt} dodges the blow.', `The ${v} misses {tgt}.`],
      crit: ['A clean, hard hit: the blow lands squarely on {tgt}.'],
      fumble: ['{Subj} {v:overreach} and {v:stumble}, leaving {themself} open.'],
    });
  });
  Object.keys(RANGED).forEach(id => {
    const [motion, hit, miss] = RANGED[id];
    set(id, { windup: ['{Subj} {v:take} aim at {tgt}.', '{Subj} {v:line} up a shot at {tgt}.'], motion: [motion], hit: [hit], miss: [miss], crit: ['A perfect shot: it lands right on target.'], fumble: ['{Subj} {v:fumble} the shot and {v:waste} it.'] });
  });

  // ---------------------------------------------------------------- area / magic moves (short, with the element words the engine fills in)
  const MAGIC = {
    breath: { windup: ['{Subj} {v:take} a deep breath.', '{Subj} {v:rear} back and {v:open} {their} {limb}.'], motion: ['{Subj} {v:breathe} {stuff} in {areaPhrase}.'], effect: ['Everything in the {shape} is hit by it.'], fail: ['{Tgt} is caught in the {shape} and takes it full on, leaving {wound}.'], miss: ['{Tgt} dives clear and takes only part of it.'], crit: ['The breath hits at full strength.'], fumble: ['The breath sputters out.'] },
    gaze: { windup: ['{Subj} {v:turn} {their} {limb} on {tgt}.'], motion: ['{Subj} {v:fix} {tgt} with a {adj} stare.'], effect: ['The stare reaches anyone who can see it.'], fail: ['{Tgt} is hit by the stare, leaving {wound}.'], miss: ['{Tgt} looks away in time.'], crit: ['The stare locks on completely.'], fumble: ['{Subj} {v:lose} focus.'] },
    ray: { windup: ['{Subj} {v:point} at {tgt}.', '{Subj} {v:raise} a {limb} and {v:aim}.'], motion: ['{Subj} {v:fire} a ray of {stuff} at {tgt}.'], hit: ['The ray hits {tgtPoss} {part}, leaving {wound}.'], miss: ['The ray misses {tgt}.'], crit: ['The ray hits dead on.'], fumble: ['The ray goes wide.'] },
    orb: { windup: ['{Subj} {v:gather} {stuff} in {their} {limb}.'], motion: ['{Subj} {v:hurl} a ball of {stuff} at {tgt}.'], effect: ['It bursts in {areaPhrase}.'], fail: ['{Tgt} is caught in the burst, leaving {wound}.'], hit: ['It hits {tgtPoss} {part}, leaving {wound}.'], miss: ['{Tgt} dodges most of the burst.'], crit: ['It hits dead on.'], fumble: ['It fizzles out.'] },
    burst: { windup: ['{Subj} {v:gather} {stuff} around {themself}.'], motion: ['{Subj} {v:release} {stuff} in {areaPhrase}.'], effect: ['Everything close by is hit.'], fail: ['{Tgt} is caught in the burst, leaving {wound}.'], miss: ['{Tgt} dodges most of it.'], crit: ['The burst hits at full strength.'], fumble: ['It fizzles out.'] },
    cone: { windup: ['{Subj} {v:hold} out {their} {limb}.'], motion: ['{Subj} {v:send} out {stuff} in {areaPhrase}.'], effect: ['Everything in the {shape} is hit.'], fail: ['{Tgt} is caught in the {shape}, leaving {wound}.'], miss: ['{Tgt} dodges and takes only part of it.'], crit: ['It hits at full strength.'], fumble: ['It fizzles out.'] },
    wave: { windup: ['{Subj} {v:take} a deep breath.'], motion: ['{Subj} {v:let} out {stuff} in {areaPhrase}.'], effect: ['Everything in range is hit.'], fail: ['{Tgt} is hit by the wave, leaving {wound}.'], miss: ['{Tgt} braces and takes only part of it.'], crit: ['It hits at full strength.'], fumble: ['It dies away.'] },
    spray: { windup: ['{Subj} {v:open} {their} {limb}.'], motion: ['{Subj} {v:spray} {stuff} over the area.'], effect: ['Everything in the {shape} is sprayed.'], fail: ['{Tgt} is sprayed, leaving {wound}.'], miss: ['{Tgt} jumps clear of most of it.'], crit: ['It hits at full strength.'], fumble: ['It dribbles out.'] },
    cloud: { windup: ['{Subj} {v:release} a puff of {stuff}.'], motion: ['A cloud of {stuff} spreads out in {areaPhrase}.'], effect: ['Anyone inside breathes it in.'], fail: ['{Tgt} breathes it in, leaving {wound}.'], miss: ['{Tgt} holds {tThey} breath and gets clear.'], crit: ['The cloud is thick and strong.'], fumble: ['The cloud thins out quickly.'] },
    aura: { windup: ['{Subj} {v:stand} still and {v:project} {their} presence.'], motion: ['Dread spreads out from {subj} in {areaPhrase}.'], effect: ['Everyone nearby feels it.'], fail: ['{Tgt} feels it take hold.'], miss: ['{Tgt} holds firm.'], crit: ['It hits everyone hard.'], fumble: ['It fades away.'] },
    hex: { windup: ['{Subj} {v:speak} a few words at {tgt}.'], motion: ['{Subj} {v:cast} {sub} on {tgt}.'], effect: ['The effect takes hold of the target.'], fail: ['{Tgt} feels it take hold.'], miss: ['{Tgt} shakes it off.'], crit: ['It takes hold completely.'], fumble: ['It fizzles out.'] },
    drain: { windup: ['{Subj} {v:reach} for {tgt}.'], motion: ['{Subj} {v:touch} {tgt} and {v:drain} {them}.'], hit: ['{Subj} {v:drain} {tgtPoss} {part}, leaving {wound}.'], miss: ['{Tgt} pulls away.'], crit: ['It drains a great deal.'], fumble: ['The drain fails.'] },
    entangle: { windup: ['{Subj} {v:send} {stuff} toward {tgt}.'], motion: ['{Subj} {v:reach} for {tgt} with {stuff}.'], effect: ['The {stuff} spreads over the area.'], fail: ['{Tgt} is caught and held.'], miss: ['{Tgt} slips free.'], crit: ['It holds tight.'], fumble: ['It tangles itself up.'] },
    summon: { windup: ['{Subj} {v:call} for help.'], motion: ['Reinforcements appear.'], effect: ['They join the fight.'], fail: ['They attack {tgt}.'], miss: ['They spread out.'], crit: ['More arrive than expected.'], fumble: ['Nothing answers.'] },
  };
  Object.keys(MAGIC).forEach(id => set(id, MAGIC[id]));

  // ---------------------------------------------------------------- who is attacking
  Object.keys(D.FAMILIES || {}).forEach(id => {
    const f = D.FAMILIES[id]; f.nouns = id === 'humanoid' ? ['the attacker'] : ['the creature']; f.air = [];
  });

  // ---------------------------------------------------------------- wounds, by damage type and tier (0 = scratch ... 5 = devastating)
  const WOUND = {
    piercing: ['a small puncture', 'a puncture wound', 'a deep puncture', 'a deep stab wound that bleeds heavily', 'a gaping puncture wound', 'a hole clean through'],
    slashing: ['a shallow cut', 'a cut', 'a deep gash', 'a long, deep gash', 'a terrible gash', 'a gash that nearly cuts through'],
    bludgeoning: ['a bruise', 'a heavy bruise', 'a deep bruise and a cracked bone', 'broken bones', 'crushed bones', 'a crushed, broken body'],
    fire: ['a small burn', 'a blistering burn', 'deep burns', 'severe burns', 'charred skin', 'burns over the whole body'],
    cold: ['a numb, frosty patch', 'frostbite', 'deep frostbite', 'skin gone white with frost', 'frozen flesh', 'a body frozen nearly solid'],
    acid: ['a small acid burn', 'a stinging acid burn', 'deep acid burns', 'flesh eaten away', 'flesh eaten down to the muscle', 'a body half dissolved'],
    lightning: ['a small shock burn', 'a burn from the jolt', 'deep burns and muscle spasms', 'charred burns where it struck', 'a heavy shock that stops the heart for a moment', 'burns across the whole body'],
    thunder: ['ringing ears', 'a rattling blow', 'a heavy blow and ringing ears', 'a punishing blast of sound', 'broken bones', 'a body-shattering blast'],
    force: ['a hard knock', 'a bruising blow', 'a crushing impact', 'broken bones', 'a body-crushing blow', 'a shattering blow'],
    necrotic: ['a cold, grey patch', 'withered skin', 'rotting flesh', 'flesh that withers and blackens', 'badly rotted flesh', 'a body drained and withered'],
    poison: ['a sour sting', 'a sickly sting', 'heavy poisoning', 'severe poisoning', 'violent sickness', 'near-fatal poisoning'],
    psychic: ['a sharp headache', 'a stab of pain behind the eyes', 'a splitting headache and a nosebleed', 'searing pain in the mind', 'bleeding from the nose and ears', 'a mind torn apart'],
    radiant: ['a small burn of light', 'a searing burn', 'deep burns from the light', 'skin blistered by the light', 'scorched skin', 'a body seared with light'],
  };
  const SIMPLE = {
    fire: { sub: ['a blast of fire', 'a burst of flame'], stuff: ['fire', 'flame'], adj: ['hot', 'burning'], hit: ['burns', 'scorches'], glow: ['a flash of fire'], sound: ['a roar of flame'], feel: ['intense heat'], smell: ['smoke'], gather: ['Heat builds in the air.'], gear: ['Armor heats up and scorches.'], residue: ['Smoke rises from the target.'], env: ['Anything flammable nearby catches fire.'], miss: ['The flames hit the floor beside {tgt}.'], dodge: ['{Tgt} jumps clear and is only singed.'] },
    cold: { sub: ['a blast of ice', 'a burst of frost'], stuff: ['ice', 'frost'], adj: ['freezing', 'icy'], hit: ['freezes', 'chills'], glow: ['a flash of pale blue'], sound: ['the crack of ice'], feel: ['biting cold'], smell: ['cold air'], gather: ['The air turns cold.'], gear: ['Frost forms on armor.'], residue: ['Frost clings to the target.'], env: ['Ice spreads across the ground.'], miss: ['The ice shatters on the floor beside {tgt}.'], dodge: ['{Tgt} jumps clear and is only chilled.'] },
    lightning: { sub: ['a bolt of lightning', 'a burst of sparks'], stuff: ['lightning', 'sparks'], adj: ['crackling', 'bright'], hit: ['shocks', 'jolts'], glow: ['a bright flash'], sound: ['a loud crack'], feel: ['a jolt of electricity'], smell: ['burnt air'], gather: ['Sparks crackle in the air.'], gear: ['Metal armor sparks and heats up.'], residue: ['Sparks crawl over the target.'], env: ['The air smells of ozone.'], miss: ['The bolt hits the floor beside {tgt}.'], dodge: ['{Tgt} jumps clear and is only shocked.'] },
    thunder: { sub: ['a blast of sound', 'a shockwave'], stuff: ['sound', 'force'], adj: ['loud', 'booming'], hit: ['blasts', 'slams into'], glow: ['a ripple in the air'], sound: ['a deafening boom'], feel: ['a heavy pressure'], smell: ['dust'], gather: ['The air hums.'], gear: ['Armor rattles.'], residue: ['Ears ring.'], env: ['Loose things nearby rattle.'], miss: ['The blast cracks the floor beside {tgt}.'], dodge: ['{Tgt} braces and takes only part of it.'] },
    acid: { sub: ['a spray of acid', 'a splash of acid'], stuff: ['acid'], adj: ['hissing', 'sizzling'], hit: ['burns', 'splashes'], glow: ['a hiss of vapor'], sound: ['a hiss'], feel: ['a sharp burning'], smell: ['a sharp, sour smell'], gather: ['Acid pools and hisses.'], gear: ['Armor smokes and pits.'], residue: ['Acid keeps burning for a moment.'], env: ['The ground sizzles.'], miss: ['The acid hisses on the floor beside {tgt}.'], dodge: ['{Tgt} jumps clear and is only splashed.'] },
    poison: { sub: ['a cloud of poison', 'a spray of venom'], stuff: ['poison', 'venom'], adj: ['sickly', 'green'], hit: ['poisons', 'stings'], glow: ['a green haze'], sound: ['a hiss'], feel: ['a wave of nausea'], smell: ['a sour smell'], gather: ['A sickly haze builds.'], gear: ['Armor offers little help against it.'], residue: ['The target looks pale and sick.'], env: ['The air smells sour.'], miss: ['The poison misses {tgt}.'], dodge: ['{Tgt} holds on and shakes off most of it.'] },
    necrotic: { sub: ['a wave of dark energy', 'a pulse of decay'], stuff: ['dark energy', 'decay'], adj: ['cold', 'dark'], hit: ['withers', 'drains'], glow: ['a dark shimmer'], sound: ['a low moan'], feel: ['a deep chill'], smell: ['rot'], gather: ['The light dims.'], gear: ['Armor goes cold and brittle.'], residue: ['The target looks gray and drained.'], env: ['Plants nearby wilt.'], miss: ['The dark energy fades beside {tgt}.'], dodge: ['{Tgt} resists most of it.'] },
    radiant: { sub: ['a flash of radiant light', 'a beam of light'], stuff: ['light'], adj: ['bright', 'holy'], hit: ['burns', 'sears'], glow: ['a flash of white light'], sound: ['a ringing tone'], feel: ['a burning glare'], smell: ['hot stone'], gather: ['Light builds in the air.'], gear: ['Metal armor glows hot.'], residue: ['The target is left blinking.'], env: ['Shadows vanish.'], miss: ['The light hits the floor beside {tgt}.'], dodge: ['{Tgt} shields their eyes and takes only part of it.'] },
    psychic: { sub: ['a wave of mental force', 'a psychic blast'], stuff: ['mental force'], adj: ['sharp', 'piercing'], hit: ['stabs at the mind of', 'overwhelms'], glow: ['a faint shimmer'], sound: ['a high whine'], feel: ['pressure in the head'], smell: ['nothing at all'], gather: ['The air feels tight.'], gear: ['Armor does nothing against it.'], residue: ['The target looks dazed.'], env: ['The air feels heavy.'], miss: ['The blast misses {tgt}.'], dodge: ['{Tgt} pushes it out of their mind.'] },
    force: { sub: ['a blast of force', 'a hard shove of force'], stuff: ['force'], adj: ['invisible', 'heavy'], hit: ['slams into', 'hammers'], glow: ['a ripple in the air'], sound: ['a dull thud'], feel: ['a heavy push'], smell: ['dust'], gather: ['The air tightens.'], gear: ['Armor dents.'], residue: ['Dust settles.'], env: ['Loose things are knocked about.'], miss: ['The blast hits the floor beside {tgt}.'], dodge: ['{Tgt} rolls with the blow.'] },
  };
  Object.keys(WOUND).forEach(id => {
    const E = D.ELEMENTS[id]; if (!E) return;
    E.wound = WOUND[id].map(w => [w]);
    if (SIMPLE[id]) Object.assign(E, SIMPLE[id]);
  });
  // physical damage: short armour lines so the gear sentence (full detail only) stays plain
  ['piercing', 'slashing', 'bludgeoning'].forEach(id => {
    const E = D.ELEMENTS[id]; if (!E) return;
    E.gear = id === 'piercing' ? ['The points punch through armor.'] : id === 'slashing' ? ['The edge cuts through armor.'] : ['The blow dents armor.'];
    if (E.gearNatural) E.gearNatural = E.gear;
    E.residue = ['Blood runs from the wound.'];
  });

  // ---------------------------------------------------------------- conditions: what the target is feeling (plain)
  const FEEL = {
    paralyzed: ['{Tgt} freezes in place and can\'t move.'], stunned: ['{Tgt} reels, dazed and unable to act.'], frightened: ['{Tgt} is terrified and wants to get away.'],
    charmed: ['{Tgt} suddenly sees the attacker as a friend.'], poisoned: ['{Tgt} feels sick and weak.'], blinded: ['{Tgt} can\'t see.'], deafened: ['{Tgt} can\'t hear.'],
    restrained: ['{Tgt} is held in place and can\'t move.'], grappled: ['{Tgt} is grabbed and held.'], prone: ['{Tgt} is knocked to the ground.'], push: ['{Tgt} is shoved back.'], pull: ['{Tgt} is pulled closer.'],
    swallowed: ['{Tgt} is swallowed whole.'], engulfed: ['{Tgt} is wrapped up inside the creature.'], sleep: ['{Tgt} falls asleep.'], petrified: ['{Tgt} turns to stone.'], incapacitated: ['{Tgt} can\'t take actions.'],
    slowed: ['{Tgt} is slowed down.'], exhaustion: ['{Tgt} feels weak and tired.'], drain: ['{Tgt} feels something vital drained away.'], heal: ['The attacker heals as it hits.'], disease: ['{Tgt} falls ill.'],
    curse: ['{Tgt} is cursed.'], burning: ['{Tgt} catches fire.'], frozen: ['{Tgt} is slowed by ice.'], disarm: ['{Tgt} drops their weapon.'], banish: ['{Tgt} vanishes from the fight.'], silenced: ['{Tgt} can\'t speak or cast.'],
    confused: ['{Tgt} is confused and acts at random.'], invisible_target: ['{Tgt} is lit up and easy to see.'], teleported: ['{Tgt} is teleported away.'], drown: ['{Tgt} can\'t breathe.'], bleed: ['{Tgt} keeps bleeding.'],
  };
  (D.CONDITIONS || []).forEach(c => { if (FEEL[c.id]) c.feel = FEEL[c.id]; });

  // ---------------------------------------------------------------- how big the hit was
  D.LETHALITY = [
    { max: 0.08, text: ['barely a scratch', 'a minor hit', 'only a small hit'] },
    { max: 0.2, text: ['a painful hit, but not dangerous alone', 'a solid hit that stings', 'a clear wound'] },
    { max: 0.35, text: ['a serious hit', 'a hit that hurts', 'a hit that slows them down'] },
    { max: 0.55, text: ['a heavy hit, nearly half their health', 'a hard hit; two of these are trouble', 'a big hit'] },
    { max: 0.8, text: ['a brutal hit that leaves them near the edge', 'a hit that can take them from healthy to barely standing', 'a very dangerous hit'] },
    { max: 1.0, text: ['a near-fatal hit', 'almost a killing blow', 'enough to nearly drop anyone'] },
    { max: 9e9, text: ['a lethal hit that can drop them outright', 'a killing blow', 'a hit most people don\'t survive'] },
  ];
  D.NO_DAMAGE = Object.assign(D.NO_DAMAGE || {}, {
    hit: ['It lands.', 'It connects.'], fail: ['{Tgt} fails to resist it.', 'It takes hold of {tgt}.'], resist: ['{Tgt} resists it.', '{Tgt} shakes it off.'], area: ['Everyone who fails to resist is affected.', 'Anyone who fails to resist feels it take hold.'],
  });
})();
