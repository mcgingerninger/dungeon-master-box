// Attack narrator data, part 3: breath, gaze, rays, bursts, sound, sprays, clouds, auras, curses and other
// magical or supernatural attacks, plus the non-damaging abilities a monster can use in place of an attack.
// Extra tokens available here: {areaPhrase} ("a thirty-foot cone"), {shape}, {gather} (the element's gathering
// clause), {glow} {sound} {feel} {smell}, {sub} {stuff} {adj}, {wound}, {residue}, {env}.
// A move supplies: windup, motion, effect (what the area/target sees), fail (a failed save or a hit), miss/resist.
(function () {
  const D = (window.AttackNarratorData = window.AttackNarratorData || {});
  D.MOVES = D.MOVES || {};
  const M = D.MOVES;

  M.breath = {
    kind: 'area', group: 'magic', act: ['the breath', 'the blast', 'the exhalation', 'the torrent'], limb: ['jaws', 'maw', 'throat'],
    windup: [
      '{Subj} {v:draw} in a vast, shuddering breath, the chest swelling and the throat beginning to glow from within.',
      '{Subj} {v:rear} back, {their} {limb} gaping, and the air rushes toward {aThem} as if the room were inhaling. {gather}',
      '{Subj} {v:lower} {their} head and {v:flare} {their} throat; a deep, hollow sound rolls up from within, rising in pitch.',
      '{Subj} {v:tilt} {their} head skyward and {v:swell}, something terrible gathering behind the teeth. {gather}',
      'The {sizeAdj} chest heaves once, twice, and then locks, a bright light spilling between {their} teeth.'
    ],
    motion: [
      '{Subj} {v:exhale}, and {areaPhrase} of {adj} {stuff} erupts from {their} {limb}, with {sound}.',
      'The breath bursts out as {areaPhrase} of {adj} {stuff}, flattening everything in its path.',
      '{Subj} {v:unleash} it: {areaPhrase} of {adj} {stuff} sheets outward; {glow}.',
      'With a tearing roar, {areaPhrase} of {adj} {stuff} gouts from {their} maw; {glow}.'
    ],
    effect: [
      'Everything in the {shape} is bathed in it: {feel}, and {glow}.',
      'The {shape} fills in a heartbeat. There is {sound}, and then comes {feel}.',
      'For one long instant nothing in the {shape} can be seen clearly, only {sub} and {feel}.'
    ],
    fail: [
      '{Tgt} is caught square in the {shape}; {sub} {hitv} {tgtPoss} body, leaving {wound}.',
      '{Tgt} has nowhere to go: the breath {hitv} {them}, leaving {wound}.',
      'The {adj} {stuff} washes over {tgt} and {hitv} {them}, finding every gap, leaving {wound}.'
    ],
    miss: ['The breath washes past {tgt} and slams the far wall; {glow}.', 'The torrent roars by {tgt} on one side, and {glow}.']
  };
  M.gaze = {
    kind: 'single', group: 'magic', act: ['the gaze', 'the glare', 'the stare', 'the baleful look'], limb: ['eyes', 'eye', 'gaze', 'glowing eyes'],
    windup: [
      '{Subj}\'s {limb} flare with a cold, awful light as {their} attention locks onto {tgt}.',
      'A silence falls: {subj} {v:turn} {their} head and the whole room seems to tilt under the weight of that stare.',
      '{Subj} {v:hold} {tgtPoss} eyes with an unblinking, bottomless stare, pupils widening until nothing else is left.',
      'The air tightens as {subj} {v:look} at {tgt}, and {sub} seems to spill behind the stare like a second shadow.'
    ],
    motion: [
      'The {limb} burn and {sub} lances across the gap; {glow}.',
      'The gaze lands like a hand on the back of the neck, and with it comes {feel}.',
      'A beam of {adj} {stuff} leaps between {tgt} and the {limb}, humming like a plucked wire.',
      'The stare pours out, silent and enormous, and everything in its direct line falters.'
    ],
    effect: ['The light in the room bends toward the stare.', 'Everyone who can see it feels the pressure behind their eyes.', 'No sound at all accompanies it, which makes it worse.'],
    fail: [
      '{Tgt} cannot look away; the stare sinks in and {hitv} {tgtPoss} mind and body alike, leaving {wound}.',
      'The gaze takes hold and {hitv} {tgt}, leaving {wound}.',
      '{Tgt} meets the stare and is struck by {feel}.'
    ],
    miss: ['{Tgt} tears their eyes aside and the gaze breaks over {them} like a cold wave, leaving only a pounding in the skull.', 'The stare slides off {tgt}, who has shut their eyes just in time.']
  };
  M.ray = {
    kind: 'ranged', group: 'magic', act: ['the ray', 'the bolt', 'the beam', 'the lance'], limb: ['palm', 'eye', 'fingertip', 'staff', 'outstretched hand'],
    windup: [
      '{Subj} {v:raise} a {limb}, and {sub} gathers there, brightening and bending the air around it. {gather}',
      '{Subj} {v:point} at {tgt}; a thin point of {adj} {stuff} swells at the end of {their} {limb}.',
      '{Subj} {v:track} {tgt} with an unwavering {limb} as {sub} tightens into a thin, bright line.',
      '{gather} {Subj} {v:level} a {limb} and the whole effect narrows to a single, shining point.'
    ],
    motion: [
      '{Subj} {v:loose} {sub} in a straight, hissing line across {range}, with {sound}.',
      'A lance of {adj} {stuff} leaps from {their} {limb}, crossing the gap in a single, silent heartbeat; {glow}.',
      'The ray tears across the distance in a blink, {sound}.',
      '{Subj} {v:snap} {their} {limb} forward and a beam of {stuff} stabs out, bright as a struck match.'
    ],
    hit: [
      'The ray strikes {tgt} square and {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} hits with {sound}, and {hitv} {tgtPoss} {part}, leaving {wound}.',
      'It lands with a flash and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The ray sizzles past {tgtPoss} head and strikes the wall behind them; {glow}.', 'The beam snaps by {tgt} with {sound} and splashes harmlessly on stone.', 'The bolt whines past {tgtPoss} shoulder, so close that {tgt} can feel {feel}.'],
    crit: ['The ray lands exactly right, an unerring hit that burns clear through every defense.'],
    fumble: ['The beam wavers and sputters in {subj}\'s hand and fizzles into a shower of sparks.']
  };
  M.orb = {
    kind: 'area', group: 'magic', act: ['the orb', 'the bolt', 'the blast', 'the missile'], limb: ['palm', 'hands', 'staff', 'fingertips'],
    windup: [
      '{Subj} {v:cup} {their} {limb}, and {sub} swells into a glowing sphere that bends the light around it. {gather}',
      '{Subj} {v:sweep} {their} {limb} in a slow arc and a mote of {adj} {stuff} swells and spins.',
      '{gather} {Subj} {v:cradle} the growing glow, face lit from beneath.',
      '{Subj} {v:whisper} a few words, and a bead of {stuff} ignites, hungry and brightening with every syllable.'
    ],
    motion: [
      '{Subj} {v:hurl} it. The orb streaks across {range}, {sound}, and bursts where it lands.',
      'The sphere rockets away in a trailing streak of {stuff}; {glow}. It detonates on impact.',
      'With a sweeping throw, {subj} {v:send} the orb arcing across the room, trailing sparks.',
      'It leaves {their} {limb} with a shriek and strikes with a flash, blooming into {areaPhrase} of {adj} {stuff}.'
    ],
    effect: [
      'It blooms in an instant into {areaPhrase} of {adj} {stuff}, {glow}, with {sound}.',
      'The detonation blossoms into {areaPhrase}: {sub}, {feel}.',
      'A heartbeat of silence, and then the sphere unfolds into {areaPhrase} of {adj} {stuff}.'
    ],
    fail: ['{Tgt} is caught full in the blast; {sub} {hitv} {them}, leaving {wound}.', 'The explosion swallows {tgt} whole, and {sub} {hitv} {tgtPoss} body, leaving {wound}.'],
    miss: ['The orb sails past {tgt} and detonates against the far wall, throwing {sub} across the stone.', 'The blast goes off a few feet wide of {tgt}, and {tgt} can feel {feel}.']
  };
  M.burst = {
    kind: 'area', group: 'magic', act: ['the burst', 'the nova', 'the pulse', 'the eruption'], limb: ['body', 'hands', 'core', 'chest'],
    windup: [
      '{Subj} {v:go} very still, and {sub} begins to bleed out of {their} {limb}, pulsing in slow, deliberate beats. {gather}',
      '{Subj} {v:clench} {their} fists and curl inward; {glow}, and the air tightens around {aThem}.',
      'A glow swells under {subj}\'s skin and cracks of {adj} {stuff} appear in {their} {limb}.',
      '{Subj} {v:drop} to a crouch, then {v:shoot} upward with arms flung wide.'
    ],
    motion: [
      '{Subj} {v:detonate}. {areaPhrase} of {adj} {stuff} erupts outward in a ring, with {sound}.',
      'It bursts from {their} {limb} in every direction at once: {areaPhrase} of {adj} {stuff}; {glow}.',
      'A ring of {adj} {stuff} slams outward in an expanding shell, with {sound}.'
    ],
    effect: ['The shockwave sweeps across everything in range: {feel}.', 'For an instant every creature caught inside is lit in {adj} silhouette.', 'The ring rolls out and keeps rolling, with {sound}.'],
    fail: ['{Tgt} is caught inside the ring; {sub} {hitv} {them}, leaving {wound}.', 'The burst rolls over {tgt} and {hitv} {them}, layer after layer, leaving {wound}.'],
    miss: ['The ring of {stuff} breaks around {tgt} as they find a gap, and the edge of it only scuffs them.']
  };
  M.cone = {
    kind: 'area', group: 'magic', act: ['the cone', 'the fan', 'the spreading blast', 'the sweep'], limb: ['hands', 'palms', 'fingertips', 'open hands'],
    windup: [
      '{Subj} {v:thrust} both {limb} forward, fingers spread wide, and the air in front of {aThem} begins to shimmer. {gather}',
      '{Subj} {v:draw} {their} {limb} together at the chest, and something gathers between them, tight and humming.',
      '{Subj} {v:brace} one foot back, palms out, and a rising note builds in the air.',
      'With a low word, {subj} {v:fan} {their} fingers open like the spokes of a wheel; {glow}.'
    ],
    motion: [
      '{areaPhrase} of {adj} {stuff} sweeps out from {their} {limb}, widening as it goes, with {sound}.',
      '{Subj} {v:sweep} {their} arms out and the spell fans away from {aThem} in a spreading wedge; {glow}.',
      'It leaves {their} {limb} in a rush and spreads: {areaPhrase} of {adj} {stuff}, thin at the source and wide at the far edge.',
      'The magic blasts forward in a fan, with {sound}; {glow}.'
    ],
    effect: ['The edges of the fan are as sharp as if drawn with a rule.', 'Anything standing in the wedge is lit and shaken as it passes.', 'It fades from the point outward, the last of it licking at the far edge.'],
    fail: ['{Tgt} is caught in the sweep; {sub} {hitv} {them}, leaving {wound}.', 'There is no stepping aside: the cone {hitv} {tgt} full on, leaving {wound}.', 'The blast washes over {tgt}, and {sub} {hitv} {them}, leaving {wound}.'],
    miss: ['{Tgt} throws {themself} sideways and only the edge of the cone clips {them}.', '{Tgt} ducks behind cover and the fan breaks over it, spilling around the sides.', '{Tgt} grits {tTheir} teeth, braces, and the worst of it passes through without finding a grip.'],
    resist: ['{Tgt} ducks low and takes only the edge of the cone.']
  };

  M.wave = {
    kind: 'area', group: 'magic', act: ['the wave', 'the cry', 'the roar', 'the scream'], limb: ['throat', 'lungs', 'mouth', 'voice'],
    windup: [
      '{Subj} {v:fill} {their} lungs until the whole {frame} swells, and {their} jaw drops wide on the first rumbling note.',
      '{Subj} {v:throw} back {their} head and the air seems to quiver in front of {their} {limb} as a rising sound begins.',
      'A high, quavering note starts up from {subj}, climbing steadily and making teeth ache.',
      '{Subj} {v:open} {their} mouth, and for a moment there is no sound at all, only a pressure in the ears.'
    ],
    motion: [
      '{Subj} {v:release} {areaPhrase} of {adj} {stuff}: {sound}.',
      'The scream rolls out in a visible ripple through the air, and everything in range shudders.',
      'The sound slams out in all directions; {glow}.',
      'A single, shattering cry; every window and goblet nearby rings, and {sound}.'
    ],
    effect: ['The noise crawls into the chest and the teeth and down the spine.', 'Echoes bounce back and layer on top of each other until the sound is almost solid.', 'For a long moment it is the only thing in the world.'],
    fail: ['{Tgt} is caught in the wave; it {hitv} {them}, leaving {wound}.', 'The sound hammers {tgt}, and it {hitv} {them}, leaving {wound}.'],
    miss: ['{Tgt} clamps their ears and braces; the sound rolls over {them} like surf over a rock.']
  };
  M.spray = {
    kind: 'area', group: 'magic', act: ['the spray', 'the gout', 'the jet', 'the spit'], limb: ['maw', 'mouth', 'gland', 'throat', 'spout'],
    windup: [
      '{Subj} {v:hunch} and {v:gurgle}, {their} {limb} bulging, a bitter reek preceding it. {gather}',
      '{Subj} {v:swell} and {v:strain}, throat working, as a dribble of {stuff} slides over {their} lip.',
      '{Subj} {v:rear} back and {v:suck} in a wet breath, cheeks bulging with something that glistens.',
      'A heavy, slopping sound gathers in {subj}\'s throat and {their} {limb} flushes a sickly color.'
    ],
    motion: [
      '{Subj} {v:spit}: {areaPhrase} of {adj} {stuff} arcs through the air with {sound}.',
      'A stream of {adj} {stuff} jets from {their} {limb} and fans out, spattering.',
      '{Subj} {v:retch} and {areaPhrase} of {adj} {stuff} slaps across the space; {glow}.',
      'The jet hisses out in a long, glittering line and breaks into spray.'
    ],
    effect: ['Droplets pepper the floor and anything standing nearby.', 'The {stuff} sticks and spreads, and {feel} follows.', 'It spatters in a wide fan, and the air fills with {smell}.'],
    fail: ['{Tgt} takes the spray full in the {part}; {sub} {hitv} {them}, leaving {wound}.', 'The jet catches {tgt} and {hitv} {tgtPoss} {part}, leaving {wound}.'],
    miss: ['The spray patters across the floor beside {tgt}, hissing as it eats pits into the stone.', 'A wild jet arcs by {tgtPoss} head and splashes on the wall.']
  };
  M.cloud = {
    kind: 'area', group: 'magic', act: ['the cloud', 'the mist', 'the haze', 'the gas'], limb: ['body', 'pores', 'vents', 'gland', 'spore-sacs'],
    windup: [
      '{Subj} {v:shudder}, and {their} {limb} swell and begin to leak a thin, strange haze. {gather}',
      'A low hiss starts from {subj} and a pale, creeping vapor spills out around {aThem}.',
      '{Subj} {v:flex}, and a shimmering cloud of fine {stuff} puffs from {their} {limb}.',
      '{Subj} {v:shake} {themself} and a heavy haze billows outward in lazy swirls.'
    ],
    motion: [
      '{areaPhrase} of {adj} {stuff} billows out, thick as wool and drifting slowly.',
      'The cloud expands into {areaPhrase}; {glow}.',
      'Tendrils of {adj} {stuff} curl along the floor and rise to meet each other, closing into a smothering cloud.'
    ],
    effect: ['It clings to skin, to cloth, to breath. Everything in the cloud is faintly blurred.', 'The cloud lingers, drifting with the slightest draft and slow to disperse.', 'Sound is muffled inside it and the nose fills with {smell}.'],
    fail: ['{Tgt} inhales a lungful before they know it; the cloud {hitv} {them}, leaving {wound}.', 'The cloud closes around {tgt} and {hitv} {them}, leaving {wound}.'],
    miss: ['{Tgt} holds their breath and pushes through the thinnest edge of the cloud, coughing but clear-headed.']
  };
  M.aura = {
    kind: 'area', group: 'magic', act: ['the presence', 'the aura', 'the dread', 'the visage'], limb: ['face', 'form', 'shadow', 'gaze'],
    windup: [
      '{Subj} {v:straighten} to {their} full height, and the temperature seems to drop. A dreadful quiet crowds in around {aThem}.',
      'Something about {subj} shifts, and the air thickens with a crawling unease that has no obvious source.',
      '{Subj}\'s {limb} seems to lengthen and darken, and the light around {aThem} dims in sympathy.',
      '{Subj} {v:stand} still, and a growing pressure rolls out from {aThem} like the shadow of a cloud.'
    ],
    motion: [
      'The dread swells outward in {areaPhrase}, a soundless, slow tide of {adj} {stuff}.',
      'It spreads like cold water, spilling into {areaPhrase}, and {glow}.',
      'The aura flares and ripples through {areaPhrase}: {feel}.'
    ],
    effect: ['Every creature in range feels the weight of it: breath short, mouths dry, the old animal urge to run.', 'Conversation dies. Even the bravest hand shakes.', 'The effect is subtle and total, and no one escapes the first touch of it.'],
    fail: ['{Tgt} feels it settle into the bones; {sub} {hitv} {tgtPoss} nerve, leaving {wound}.', 'The dread takes hold of {tgt}, who feels {feel}.'],
    miss: ['{Tgt} grits their teeth and stands firm as the dread washes past, shaking but unbowed.']
  };
  M.hex = {
    kind: 'single', group: 'magic', act: ['the curse', 'the compulsion', 'the command', 'the charm'], limb: ['voice', 'words', 'eyes', 'hand'],
    windup: [
      '{Subj} {v:speak} in a low, deliberate voice, and the words seem to crawl under the skin. {gather}',
      '{Subj} {v:trace} a slow sign in the air with one finger, and the shape lingers there, smoldering.',
      '{Subj} {v:smile} gently and {v:murmur} something that cannot be quite heard.',
      '{Subj} {v:lock} {tgtPoss} gaze with a calm, certain attention that feels like being weighed.'
    ],
    motion: [
      'The words land like a weight; {sub} settles over {tgt}; {glow}.',
      'The sign flares, {sound}, and a thread of {stuff} snaps across the space between them.',
      'A single word falls like a hammer-blow, and the air quivers around {tgt}.',
      'The effect is quiet and absolute, and {tgt} feels {feel}.'
    ],
    effect: ['The air seems to hold its breath.', 'A faint shimmer marks the bond between caster and target.', 'There is no sound of the working, only the sense that something has been done.'],
    fail: ['{Tgt} feels it take hold; {sub} {hitv} {tgtPoss} will, leaving {wound}.', 'The working sinks in and {hitv} {tgt}, leaving {wound}.'],
    miss: ['{Tgt} shakes {tTheir} head and the compulsion slides off like water from oiled leather.']
  };
  M.drain = {
    kind: 'melee', group: 'magic', act: ['the drain', 'the feeding', 'the leech', 'the kiss'], limb: ['hands', 'mouth', 'fingers', 'tendrils'],
    windup: [
      '{Subj} {v:lean} in, {their} {limb} outstretched and trembling with hunger.',
      '{Subj} {v:fasten} a hungry stare on {tgt}, and the air between them grows cold and thin.',
      '{Subj} {v:glide} close, reaching with an almost lover\'s tenderness.',
      '{Subj} {v:reach} out and shadows leak along the floor toward {tgt}.'
    ],
    motion: [
      'Contact. A cold current pours from {tgt} into {subj}, visible as a thin, pale shimmer.',
      '{Subj} {v:feed}, and {tgtPoss} warmth drains out in a slow, steady flow.',
      'The drain is silent and total, like water running out of a bath.',
      'A thin thread of color slips from {tgt} to {aThem}, and {subj} {v:shudder} with satisfaction.'
    ],
    hit: ['{Act} {hitv} {tgtPoss} {part}, leaving {wound} and a feeling of something precious stolen.', 'The drain {hitv} {tgt}, leaving {wound}.'],
    miss: ['{Tgt} jerks away and the hungry {limb} close on cold air.', 'The touch falls short, and {tgt} feels only a faint, wrong tug on their breath.'],
    crit: ['The drain locks on and does not let go; {tgt} feels life itself being pulled out through the skin.'],
    fumble: ['The hunger overreaches and {subj} {v:stagger}, sputtering.']
  };
  M.entangle = {
    kind: 'area', group: 'magic', act: ['the snare', 'the entangling mass', 'the grasping web', 'the clutch'], limb: ['web', 'roots', 'vines', 'strands', 'net'],
    windup: [
      '{Subj} {v:flick} {their} wrists and sticky strands shoot from {aThem} toward {tgt}.',
      'The ground ripples and thin roots break through the floor, quivering and searching.',
      '{Subj} {v:spin} a thread between {their} {limb} and {v:cast} it, a glistening web unfolding in the air.',
      'A shiver runs through the nearby plants as vines lift, sway and turn toward {tgt}.'
    ],
    motion: [
      '{areaPhrase} of {adj} {stuff} lashes out and tangles, thick and sticky, with a wet snap.',
      'Strands fly across the gap and cling wherever they touch, pulling tight with a thrum.',
      'The {limb} burst from the ground and coil around everything in reach.',
      'The webbing spreads in a heartbeat, glittering and tough as rope.'
    ],
    effect: ['It clings. The more anyone struggles, the tighter it holds.', 'The snare is thick as a hawser and elastic enough to give and spring back.', 'It stretches taut and hums.'],
    fail: ['{Tgt} is caught fast; the {limb} wrap {them} and {hitv} {tgtPoss} limbs, leaving {wound}.', 'The mass pins {tgt} where {tThey} stand, binding arms and legs.'],
    miss: ['{Tgt} tears through the first strands, ripping free in a spatter of sticky threads.']
  };
  M.summon = {
    kind: 'utility', group: 'magic', act: ['the summoning', 'the call', 'the conjuring', 'the rite'], limb: ['voice', 'hands', 'words'],
    windup: [
      '{Subj} {v:raise} both hands, and the air in front of {aThem} splits like old canvas, light and shadow leaking through.',
      '{Subj} {v:chant} three words in a language that makes the ears ache, and the floor beneath begins to crack.',
      '{Subj} {v:call} out a name that should not be spoken aloud, and the room answers with a deep, trembling groan.',
      '{Subj} {v:trace} a circle of {stuff} in the air, and it hangs there, widening, with something moving behind it.'
    ],
    motion: [
      'The rift widens and something steps out, shaking itself like a wet dog.',
      'The summons answers: figures coalesce in {adj} {stuff} and take shape one at a time.',
      'The floor bulges and splits, and the thing it was holding down climbs out with a groan.',
      'A flare of light, a ripple in the air, and the summoned arrive in a rush of wind and smell.'
    ],
    effect: ['The newcomers look around, then turn on the nearest living thing.', 'The air smells of ozone, old stone and something worse.', 'There is a heartbeat of silence before they move.'],
    fail: ['Something lands beside {tgt} and lunges.', 'The summoned fall on {tgt} with a single, hungry cry.'],
    miss: ['The summoned spill into the room and look for something to break.']
  };

  // ---------------- non-damaging abilities (used in place of an attack) ----------------
  // Each has a regex for name+text, a few sentences for the DM to read, and a short mechanical note.
  D.UTILITY = [
    { id: 'shapechange', re: /alter self|disguise self|change shape|shapechange|shapeshift|polymorph|hybrid form|mist form|wild shape|transform|assume|bat form|wolf form/i, lines: ['{Subj} {v:shudder}, and the outline of {aThem} blurs; bones pop and slide, flesh ripples like water, and a different shape rises from the old one.', 'There is a wet, creaking sound as {subj} {v:fold} and {v:swell} into a new form, edges melting and re-forming.', 'A ripple runs over {subj} like a gust over a pond, and by the time it settles {they} {pv:be} something else entirely.', 'Skin flows, joints reverse, and {subj} {v:slip} from one body into another with a long, sliding exhale.'], tip: 'The new shape keeps the creature\'s mind but may change its senses, size and speed.' },
    { id: 'teleport', re: /teleport|misty|step|jump|blink|vanish|disappear|phase|translocat|shadow jump|dimension/i, lines: ['{Subj} {v:vanish} with a soft pop of displaced air, leaving only a smear of {stuff} and a gust of cold.', 'The air folds around {subj}; {glow}, a breath of wind, and {they} {pv:be} simply gone.', '{Subj} {v:flicker} like a candle in a draft, {v:fade} to a silhouette of {stuff}, and {v:reappear} somewhere else, already moving.', 'A swirl of shadow or mist takes {subj} and spits {aThem} out in a new spot with a faint, sucking pop.'], tip: 'Say where it re-appears and let the party react to the new threat angle.' },
    { id: 'invisible', re: /invisib|unseen|cloak|veil|ethereal|etherealness|hide|stealth|shroud/i, lines: ['{Subj} {v:fade}, outline thinning to a shimmer, and then there is only a faint disturbance where {they} {pv:was}.', 'The air bends around {subj} and {they} {pv:slip} out of sight, leaving only footprints in the dust and the sound of breathing.', '{Subj} {v:step} sideways out of the world, and the space where {they} stood simply looks empty.'], tip: 'The creature is still there; faint clues (footprints, disturbed dust, a shimmer) betray it.' },
    { id: 'charm', re: /charm|beguil|enthral|befriend|allure|seduc|compel|suggest|command|dominat|enslave|mind control|possess|hypno/i, lines: ['{Subj}\'s voice drops to something soft and sweet, and the words begin to sound like the most reasonable thing in the world.', 'A warm, honeyed calm settles over the room as {subj} {v:speak}; the urge to agree is almost physical.', '{Subj} {v:meet} {tgtPoss} eyes with a warm, bottomless smile, and every reason to resist slides quietly out of reach.'], tip: 'A charmed creature regards the speaker as a trusted friend; it does not know it has been charmed.' },
    { id: 'summon', re: /summon|conjure|animate|spawn|reinforc|bring forth|minion|swarm|spawn|children of the night|ice wolves/i, lines: ['{Subj} {v:call} out, and the room answers: shapes unfold from {adj} {stuff} and gather, hissing and eager.', 'A sharp whistle, a barked command, {glow}, and fresh combatants pour into the fight.', 'The floor ripples and something climbs out, shaking off cobwebs and old dust.'], tip: 'Describe where the new arrivals appear and which targets they favor.' },
    { id: 'enlarge', re: /enlarge|grow|growth|reduce|shrink|expand|inflate|swell/i, lines: ['{Subj} {v:flex} and grow, muscles bulging, armor creaking and stretching as {their} outline swells to a size that blots out the light.', 'Bones crack and stretch, flesh swells, and in a heartbeat {subj} {v:tower} over where {they} {pv:was} standing.'], tip: 'Describe the new silhouette and how much more of the room it fills.' },
    { id: 'haste', re: /haste|speed|dash|sprint|rush|quick|swift|fast|surge|adrenaline|bloody rampage|rampage|frenzy|berserk/i, lines: ['{Subj} {v:blur}; every movement comes a fraction too fast, trails of afterimage smearing the air behind {aThem}.', 'A wild, red light flares in {their} eyes, and {subj} {v:move} with a speed that seems to skip heartbeats.', '{Subj} {v:bolt} forward, so fast the ground cracks under {their} feet.'], tip: 'Fast creatures act faster and cover ground; make it feel blurry.' },
    { id: 'defense', re: /parry|riposte|deflect|dodge|shield|ward|defend|block|rebuff|reflect|counter|absorb|mirror|barrier|armor|endurance|stand firm|unyielding|rebuke/i, lines: ['{Subj} {v:turn} the blow aside in a ringing, practiced motion, and steel (or something like it) screams along steel.', 'At the last instant, {subj} {v:twist}, and the blow strikes something that was not quite where {tgt} thought it was.', 'A shimmer of {stuff} springs into being around {subj} and the incoming attack splashes against it like rain on glass.', '{Subj} {v:snap} up a guard and the attack slides off with a high, scraping note.'], tip: 'A defensive move: the attack lands on a ward, parry or reflex instead.' },
    { id: 'heal', re: /regenerat|heal|restore|mend|revive|recover|rejuvenat|drink|feed on|consume|devour|absorb/i, lines: ['Wounds knit with a faint hiss of steam as {subj} {v:draw} on a hidden reservoir of vigor, color flooding back into {their} body.', 'Torn flesh crawls shut in a heartbeat, and {subj} {v:straighten}, wounds closing like mouths.', '{Subj} {v:shudder} as new strength pours in, bruises fading and edges knitting.'], tip: 'The creature recovers; describe it visibly so the party knows to finish it quickly.' },
    { id: 'detect', re: /detect|sense|see|read|know|sight|scry|divin|portent|insight|heart sight|read thoughts|telepath|link|probe/i, lines: ['{Subj} {v:tilt} {their} head as though listening to something that is not there, and a thin, strange light moves behind {their} eyes.', '{Subj} {v:go} very still, and the party has the unmistakable sense of being weighed, read and catalogued.', 'A faint shimmer passes over the party, and a smile spreads across {subj}\'s face, as if something has been learned.'], tip: 'A sensing ability: the creature gains information. Describe the tell, not the result.' },
    { id: 'leadership', re: /call to|allied|leadership|rally|call to honor|command|inspire|bolster|tactics|battle cry|war cry|honor/i, lines: ['{Subj} {v:throw} back {their} head and {v:bellow} an order, and every ally within hearing tightens their grip and surges forward.', 'A sharp, ringing call cuts through the din; the creature\'s allies straighten, weapons rising in unison.', '{Subj} {v:raise} a fist and a roar goes up, hot and unified, as morale surges.'], tip: 'An allied buff: describe the rallying moment and the faces of the enemy troops.' },
    { id: 'terrain', re: /earth|ground|move|burrow|tremor|quake|stone|mud|rolling|hills|ice|wall|stasis|spike|sinkhole|collapse|avalanche|geyser/i, lines: ['The ground heaves and groans as {subj} {v:shape} the terrain, stone and soil flowing like thick water.', 'Cracks run across the floor and the walls shudder; the battlefield itself seems to shift.', 'A deep rumble starts below the feet and the very shape of the room begins to change.'], tip: 'Describe how the terrain changes: new walls, difficult ground, new cover.' },
    { id: 'curse', re: /curse|hex|doom|bane|blight|mark|plague|infect|disease|rot|decay|infest|ooze|woe|despair|sorrow/i, lines: ['{Subj} {v:point} one cold finger and speak a single, soft syllable. {tgt} feels something cold settle in the bones.', 'A fine thread of {stuff} unspools toward {tgt} and slips beneath the skin; the world seems a little darker, a little colder.', '{Subj} {v:mutter} a litany of misfortune, and the words stay in the air, ringing like a bell that has been struck wrong.'], tip: 'A lingering effect: describe what changes for the afflicted, not what the caster did.' },
    { id: 'break', re: /break|shatter|destroy|negate|dispel|quench|nullify|antimagic|silence|counterspell|spell reflection|mimic|mimicry|steal|swallow magic/i, lines: ['{Subj} {v:slice} a hand through the air and the working in progress unravels, threads of {stuff} falling away like cut cobwebs.', 'A pulse of cold force sweeps out, and every glowing rune within reach gutters and goes dark.', 'Magic dies on the air with a long, sighing hiss.'], tip: 'A magic-countering ability: describe the spell dissolving.' },
    { id: 'escape', re: /escape|flee|retreat|slip|withdraw|burrow|dart|disengage|cunning|nimble|run|scurry|swim|fly/i, lines: ['{Subj} {v:slip} away in a sudden burst of motion, disengaging in a blur before a hand can reach.', '{Subj} {v:twist} aside, vault a table and are already racing for another angle of attack.'], tip: 'A movement ability: describe where the creature goes and what it leaves behind.' },
    { id: 'generic', re: /.*/, lines: ['{Subj} {v:gather} {themself}, and for a moment the whole room seems to turn to look. Something is about to change.', '{Subj} {v:draw} on something deep and strange, and the air shivers with {sub}.', 'A flicker, {glow}, and {sound}; the ability takes effect in an instant.'], tip: 'A special ability: describe the visible tell and let the mechanics speak for themselves.' }
  ];
})();
