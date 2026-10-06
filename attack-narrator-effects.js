// Attack narrator data, part 4: what an attack does beyond damage (conditions, grabs, pushes, drains...),
// plus the scales used to size an attack up: damage tiers, area sizes, creature size, family, role and variant.
// Every condition entry has: re (detect in the attack text), label, feel (sentences the DM can read when the
// effect lands, {tgt} is the target), dm (a one-line rules reminder) and clear (how it normally ends, generic).
(function () {
  const D = (window.AttackNarratorData = window.AttackNarratorData || {});

  // ------------------------------------------------------------------ conditions & effects
  D.CONDITIONS = [
    { id: 'paralyzed', re: /\bparalyz|\bparalysis\b|can't move|held in place|rigid/i, label: 'Paralysis',
      feel: ['{Tgt} locks up mid-motion, every muscle gone rigid, eyes wide and fixed. The body will not obey, though the mind is racing.', 'Strength drains out of {tgtPoss} limbs as a dead, humming numbness spreads from the point of contact. {Tgt} can only stare, frozen.', 'A creeping, cold stillness runs down {tgtPoss} arms and legs; they stop, and {tgt} can feel the floor but cannot move toward it.', '{Tgt} stiffens like a statue, jaw clenched, breath coming in shallow, helpless sips.'],
      dm: 'Paralysis: the target cannot move or act; attacks against it have advantage and close hits are critical.', clear: 'It wears off with time or a successful save at the end of the target\'s turn.' },
    { id: 'stunned', re: /\bstun(?:ned)?\b|stunning|dazed|senseless/i, label: 'Stun',
      feel: ['{Tgt}\'s eyes lose focus; the world spins and tilts, and for a moment {tThey} can only sway where {tThey} stand.', 'A flat, ringing shock rolls through {tgtPoss} head, and the world goes white and slow; {tgt} can barely stay upright.', '{Tgt} reels, blinking, the whole battlefield a smear of color and noise.'],
      dm: 'Stun: the target is incapacitated, cannot move, and can barely speak.', clear: 'It passes in a heartbeat or two, or on a successful save.' },
    { id: 'frightened', re: /frighten|terrif|\bfear\b|dread|panic|\bscare|horrif|terror/i, label: 'Fear',
      feel: ['A cold wave of animal terror crashes through {tgt}; every instinct says run, and {tgtPoss} hands shake on their weapon.', '{Tgt} feels the world narrow to the thing in front of them, mouth dry, heart slamming, legs wanting only to carry them away.', 'Something ancient and primitive in {tgtPoss} chest screams that this cannot be fought, and {tThey} start to back away.', 'Cold sweat prickles on {tgtPoss} neck, and a whisper of dread slithers up the spine and sits behind the eyes.'],
      dm: 'Frightened: disadvantage on checks and attacks while the source is in sight; cannot willingly move closer.', clear: 'It ends on a successful save, when the source is out of sight, or when the duration expires.' },
    { id: 'charmed', re: /charm|enthrall|beguil|bewitch|befriend|enchant|compel|dominat|enslave|under the .{0,20} control|mind control/i, label: 'Charm',
      feel: ['A warm, honeyed haze settles over {tgtPoss} thoughts; the creature in front of {tgt} suddenly seems like the best friend {tThey} ever had.', '{Tgt}\'s weapon drifts down as a dreamy calm replaces the rage, and the urge to please grows quietly irresistible.', 'The edges of {tgtPoss} will blur and soften until every suggestion sounds reasonable and every enemy a friend.', '{Tgt} smiles, slack and warm, as if remembering a pleasant thing; the fight seems very far away.'],
      dm: 'Charmed: the target regards the source as a friendly acquaintance and cannot attack it; the source has advantage on social checks.', clear: 'It ends on damage, a successful save, or when the effect expires.' },
    { id: 'poisoned', re: /\bpoison(?:ed)?\b(?! damage)|\bpoisoning\b|toxin|venom(?:ous)?\b(?! damage)/i, label: 'Poisoned',
      feel: ['A hot, wet nausea blooms in {tgtPoss} gut and the edges of {tgtPoss} vision swim as the toxin works through the blood.', '{Tgt} sweats and shudders, skin gone clammy and pale, a metallic taste on the tongue.', 'Veins stand out dark and branching against the skin, and every breath is a strain.', 'A rolling, greasy dizziness grips {tgt}; the hands tremble and aim goes wild.'],
      dm: 'Poisoned: disadvantage on attack rolls and ability checks.', clear: 'It fades as the toxin is purged, on a successful save, or when the duration expires.' },
    { id: 'blinded', re: /\bblind(?:ed|ing)?\b|sightless|\bdazzl|go blind/i, label: 'Blindness',
      feel: ['The world goes dark, or white, or both, and {tgt} claws at {tgtPoss} eyes as the afterimages swim.', '{Tgt} can see nothing but swimming color; the battle is only noise and heat and movement now.', 'A sudden, total blankness: {tgtPoss} eyes still open, but there is nothing left to see.'],
      dm: 'Blinded: the target cannot see; attack rolls against it have advantage and its own have disadvantage.', clear: 'Vision returns with time or a successful save.' },
    { id: 'deafened', re: /\bdeaf(?:ened|ening)?\b/i, label: 'Deafness',
      feel: ['A high whine drowns every other sound and {tgt}\'s ears start to bleed; the fight becomes a silent, muffled blur.', 'All sound drops away as if wrapped in wool, and {tgt} can feel footsteps rather than hear them.'],
      dm: 'Deafened: the target cannot hear and fails checks that rely on hearing.', clear: 'Hearing returns with time.' },
    { id: 'restrained', re: /\brestrain(?:ed|s|ing)?\b|\bpinned\b|stuck fast|\bsnared\b|\bheld fast\b/i, label: 'Restrained',
      feel: ['{Tgt}\'s limbs are bound tight, held firm against every twist and strain; each pull only tightens it.', 'The grip locks and {tgt} cannot move, breath coming in short, frantic gasps.', '{Tgt} is pinned in place, arms trapped, shoulders straining against something that does not give.'],
      dm: 'Restrained: speed 0; attack rolls against the target have advantage and its own have disadvantage.', clear: 'It ends when the target breaks free (usually a Strength check) or the source lets go.' },
    { id: 'grappled', re: /\bgrapple[ds]?\b|escape dc|seized|clutched|\bheld\b|gripped|clamp/i, label: 'Grapple',
      feel: ['A crushing grip clamps around {tgt}, hauling {them} in; {tThey} can feel every finger, claw or coil closing like iron.', '{Tgt} is caught and held; the grip is relentless and the thing that holds {them} does not tire.', 'Something strong closes on {tgt}\'s body and will not let go, no matter how {tThey} twist.'],
      dm: 'Grappled: the target\'s speed becomes 0; it can try to escape with a check against the stated DC.', clear: 'It ends when the grappler is incapacitated, moved away, or the target escapes.' },
    { id: 'prone', re: /\bprone\b|knocked down|knocks? .{0,20}down|bowled over|toppled|\bsweeps? .{0,12}feet|thrown to the ground|slammed to the ground/i, label: 'Knocked prone',
      feel: ['The impact sweeps {tgt}\'s feet out from under {them} and drops {them} flat on the ground, breath driven out in a grunt.', '{Tgt} is bowled off {tgtPoss} feet and hits the floor hard, armor clattering.', 'The ground comes up fast; {tgt} lands in a heap, scrambling to get a leg under {them}.'],
      dm: 'Prone: the target is on the ground; melee attackers have advantage and ranged attackers disadvantage; standing costs half its movement.', clear: 'It ends when the target stands up.' },
    { id: 'push', re: /pushed|shoved|hurled|\bflung\b|thrown (?:up to )?\d+|knocked back|forced back|\bpush(?:es)?\b/i, label: 'Knockback',
      feel: ['The force hurls {tgt} backward in a long, helpless skid, boots scraping, until something stops {them}.', '{Tgt} is picked up and thrown clear, feet trailing, crashing down several paces away.', 'A shove of staggering power sends {tgt} flying across the room.'],
      dm: 'Forced movement: slide the target the stated distance; it may collide with walls or hazards.', clear: 'Instant.' },
    { id: 'pull', re: /\bpulled\b|dragged|yanked|hauled|drawn (?:up to )?\d+|\bpulls?\b .{0,16}toward|drags?\b/i, label: 'Pulled in',
      feel: ['A hard yank drags {tgt} forward, boots skidding, straight into reach.', '{Tgt} is hauled across the floor like a hooked fish and brought up short in front of the attacker.'],
      dm: 'Forced movement: move the target toward the attacker by the stated distance.', clear: 'Instant.' },
    { id: 'swallowed', re: /swallow|swallowed|gulp(?:ed)?/i, label: 'Swallowed',
      feel: ['{Tgt} is gulped down in a wet, rushing dark, the walls of the gullet closing around {them} like muscle around a fist; the air stinks of rot.', 'Slick, hot darkness takes {tgt} whole; the world shrinks to a ribbed throat and a dull, pounding heartbeat.'],
      dm: 'Swallowed: the target is blinded and restrained, has total cover from outside, and takes digestive damage each turn.', clear: 'It ends when the target is expelled or the creature dies.' },
    { id: 'engulfed', re: /engulf|smother|envelop|absorb(?:ed)?|dissolved?/i, label: 'Engulfed',
      feel: ['{Tgt} vanishes into the creature\'s body, buried in cold, gelid flesh that presses on every side.', 'The slick mass folds over {tgt} and tightens, the world turning to a muffled, clinging dark.'],
      dm: 'Engulfed: the target is restrained inside the creature and cannot breathe; it takes ongoing damage each turn.', clear: 'It ends when the target escapes or the creature is destroyed.' },
    { id: 'sleep', re: /fall asleep|falls asleep|unconscious|knocked out|\bsleep\b|lulled|slumber|torpor|dormant/i, label: 'Sleep',
      feel: ['A deep, honeyed drowsiness crashes over {tgt}; the eyelids droop, the knees buckle, and {tThey} fold to the ground.', '{Tgt} sags where {tThey} stand and drifts off, breath slowing and eyes unfocused.', 'The fight goes quiet and distant as {tgt} drops, utterly asleep.'],
      dm: 'Unconscious: the target is helpless, drops what it holds and falls prone; damage or a shake awakens it.', clear: 'It ends when the target takes damage or is woken.' },
    { id: 'petrified', re: /petrif|turn(?:s|ed)? to stone|stone statue|calcif|turned into stone|stiffens and hardens/i, label: 'Petrification',
      feel: ['A creeping grey spreads over {tgt}\'s skin, stiffening joints and silencing the heart; the limbs lock and the color drains from the flesh until only stone is left.', '{Tgt}\'s movements slow and grind, flesh paling to rough, heavy rock, until the last flicker of life is a pair of wide eyes in a statue.'],
      dm: 'Petrified: the target becomes stone, incapacitated and unaware; it has resistance to all damage.', clear: 'It can be reversed by greater restoration or similar magic.' },
    { id: 'incapacitated', re: /incapacitat/i, label: 'Incapacitated',
      feel: ['{Tgt} sags, hands going slack, unable to do anything but weakly stay on {tgtPoss} feet.', 'All the fight goes out of {tgt} as strength and focus leave in the same breath.'],
      dm: 'Incapacitated: the target cannot take actions or reactions.', clear: 'It wears off with time or a successful save.' },
    { id: 'slowed', re: /\bslow(?:ed|s|ing)?\b|speed (?:is )?(?:halved|reduced)|sluggish|lethargy|slog/i, label: 'Slow',
      feel: ['The world seems to thicken around {tgt}; every motion becomes a wade through honey.', '{Tgt}\'s limbs grow heavy and each step takes an effort that should not be needed.'],
      dm: 'Slowed: speed is halved, and the target has a penalty to AC and Dexterity saves and cannot take reactions.', clear: 'It ends on a successful save or when the duration expires.' },
    { id: 'exhaustion', re: /exhaust|weari|weakness|fatigue|drained of strength|enervat|weaken/i, label: 'Weakening',
      feel: ['A bone-deep weariness drags at {tgt}; arms like lead, knees trembling, every breath a labor.', '{Tgt} feels strength drain away as though through a hole in the soul, leaving only a heavy, aching hollow.'],
      dm: 'Weakening: apply the stated penalty (exhaustion or reduced ability) until it is cured or rested off.', clear: 'It usually requires a long rest or restorative magic.' },
    { id: 'drain', re: /hit point maximum|max(?:imum)? hit points|life force|drains? .{0,16}(?:life|vitality|strength)|score (?:is )?reduced|reduces? .{0,18}score|\bage[sd]?\b|levels? of exhaustion/i, label: 'Life drain',
      feel: ['The wound feels cold and hollow, as if something fundamental has been siphoned out of {tgt} and will not return soon.', 'A hollow ache settles behind {tgtPoss} breastbone: something in {tgt} has been taken, quietly and thoroughly.', '{Tgt}\'s skin pales and hair greys at the temples as the vitality flows out in a slow, cold tide.'],
      dm: 'Drain: the target\'s hit point maximum (or an ability score) is reduced until restored.', clear: 'It is restored only by greater restoration or similar magic, or by a long rest if the text says so.' },
    { id: 'heal', re: /regains? (?:\d+ \(.+?\) )?hit points|regain(?:s)? .{0,16}hit points|heals? (?:itself|the)|temporary hit points|gains? .{0,12}hit points/i, label: 'Heals the attacker',
      feel: ['As the wound opens, color floods back into the attacker; it drinks in {tgtPoss} life and gleams, healthier than before.', 'The attacker visibly improves as it feeds: torn flesh knitting, eyes brightening, breath easing.'],
      dm: 'Life steal: the attacker recovers the stated hit points.', clear: 'Instant.' },
    { id: 'disease', re: /\bdisease\b|plague|infection|\bsick(?:ened|ening)?\b|\bfever|rot(?:ting)? (?:grip|touch)|\bmummy rot|lycanthropy|\bblight/i, label: 'Disease',
      feel: ['The wound sours quickly; a hot, itching fever sets in, and a foul smell hangs about the bandages.', 'A creeping sickness crawls up the limb: veins darken and a cold sweat breaks out at once.'],
      dm: 'Disease: the target contracts the stated illness; effects begin as described.', clear: 'It requires treatment, remove disease or a series of successful saves.' },
    { id: 'curse', re: /\bcurse[ds]?\b|\bhex(?:ed)?\b|cursing|\bdoomed\b|\bmarked\b|bane\b/i, label: 'Curse',
      feel: ['A cold, black thread settles around {tgt}, a taste of ash and an ugly, lingering feeling of being watched by something patient.', '{Tgt} feels the curse slide into place like a shackle clicking shut; the world dims a little at the edges.'],
      dm: 'Curse: the target suffers the stated lasting penalty until remove curse or similar magic.', clear: 'Remove curse, a successful save at the stated interval, or the casting creature\'s death.' },
    { id: 'burning', re: /catches? fire|sets? .{0,24}on fire|ignite[ds]?|\bburning\b|\bignit|\bflammable|on fire/i, label: 'Burning',
      feel: ['{Tgt}\'s clothes catch and flare, and flames lick up an arm; {tThey} slap at them, screaming through gritted teeth.', 'A tongue of fire crawls up {tgtPoss} cloak and clings, stubborn and hungry, until {tThey} can smother it.'],
      dm: 'Burning: the target takes ongoing fire damage until a creature uses its action to put the fire out.', clear: 'It ends when the fire is smothered or doused.' },
    { id: 'frozen', re: /\bfrozen\b|freez(?:e|es|ing) .{0,16}solid|encased in ice|ice (?:slows|stasis)|\bfrostbite\b/i, label: 'Frozen',
      feel: ['Ice crackles up {tgtPoss} legs and locks the joints; every movement becomes a grinding, brittle effort.', '{Tgt} is rimmed in frost from boot to throat, breath crystalizing in the air, limbs moving as if through frozen mud.'],
      dm: 'Frozen: speed is reduced or the target is restrained until the ice is broken.', clear: 'Fire, force or time breaks the ice.' },
    { id: 'disarm', re: /disarm|drops? (?:what|whatever|anything) it|drop(?:s|ping)? (?:its|their|the) |wrench(?:es)? .{0,20}from/i, label: 'Disarm',
      feel: ['A sharp wrench and a flare of pain, and {tgtPoss} weapon spins out of numb fingers across the floor.', '{Tgt}\'s grip fails under the blow and {tgtPoss} weapon clatters away.'],
      dm: 'Disarm: the target drops what it is holding.', clear: 'Instant; the item must be picked up again.' },
    { id: 'banish', re: /banish|plane shift|sent (?:to|into)|to another plane|imprison|whisk(?:ed)? away|sealed away|dimensional/i, label: 'Banishment',
      feel: ['The world folds and {tgt} is simply gone, plucked out of the room like a card from a deck and sent somewhere cold and distant.', 'A rip in the air, a flash of unnatural color, and {tgt} is jerked out of sight, leaving an empty place on the floor.'],
      dm: 'Banishment: the target is removed from the battlefield to another place or plane for the stated duration.', clear: 'It ends when the duration expires or the condition is met.' },
    { id: 'silenced', re: /silenc|can't (?:speak|cast)|\bmuted?\b|gagged|unable to speak/i, label: 'Silence',
      feel: ['All sound is sucked from {tgt}\'s throat; {tThey} open {tTheir} mouth, and nothing comes out.', 'A heavy hush settles over {tgt} and the word on {tTheir} lips dies unspoken.'],
      dm: 'Silenced: the target cannot speak or cast spells with verbal components.', clear: 'It ends when the duration expires.' },
    { id: 'confused', re: /confus|madness|insan|hallucin|bewilder|disorient|delirium|dazed|babbl|mind (?:addled|scrambled)/i, label: 'Confusion',
      feel: ['The world rearranges itself: allies look like enemies and the walls seem to breathe; {tgt} stumbles, uncertain of every step.', '{Tgt}\'s thoughts scatter like startled birds, and a flood of nonsense fills the gaps.', 'A buzzing, swimming fog crowds {tgtPoss} mind; the edges of reality seem to slide away.'],
      dm: 'Confusion: the target acts erratically per the stated rules and may attack or flee at random.', clear: 'It ends on a successful save or when the duration expires.' },
    { id: 'invisible_target', re: /\bglow(?:s|ing)?\b|faerie fire|outlin|reveal/i, label: 'Outlined',
      feel: ['Motes of light cling to {tgt}, outlining {them} in vivid detail for any watching eye.'],
      dm: 'Outlined: the target cannot benefit from invisibility or concealment while the effect lasts.', clear: 'It ends with the duration.' },
    { id: 'teleported', re: /teleport(?:ed|s)? (?:the )?(?:target|it|them)|swap places|translocat/i, label: 'Teleported',
      feel: ['A lurch, a flash, and {tgt} is somewhere else entirely, head spinning.'],
      dm: 'Teleported: the target is moved to a new location chosen by the attacker (or random).', clear: 'Instant.' },
    { id: 'drown', re: /drown|waterlogged|can't breathe|suffocat|choke|choking|asphyxi/i, label: 'Suffocation',
      feel: ['The air is gone from {tgtPoss} lungs and no more will come; {tgt} claws at {tgtPoss} throat as the world dims.', '{Tgt} gags and heaves, chest burning, every gasp finding nothing.'],
      dm: 'Suffocation: the target cannot breathe and begins to suffocate per the usual rules.', clear: 'It ends when breathing is possible again.' },
    { id: 'bleed', re: /\bbleed(?:ing)?\b|blood loss|hemorrhag|ongoing damage|damage at the start of (?:each of )?its turns?|at the start of each of the target's turns/i, label: 'Ongoing damage',
      feel: ['The wound will not close: {tgt} bleeds steadily, dark drops falling with every step.', 'Pain keeps coming in slow, steady beats as the injury keeps tearing itself wider.'],
      dm: 'Ongoing damage: the target takes the stated damage at the start of each of its turns until it is treated or the effect ends.', clear: 'It ends with a successful check, healing or the duration.' }
  ];

  // ------------------------------------------------------------------ area shapes
  D.AREAS = {
    cone: { name: 'cone', phrase: 'a {n}-foot cone', scale: { 15: 'about as broad at the far end as a hallway', 30: 'wide enough to swallow a doorway and a half-dozen people with it', 60: 'a full-width wedge that fills a room', 90: 'a sweeping wedge that covers most of the field' } },
    line: { name: 'line', phrase: 'a {n}-foot line', scale: { 30: 'a straight, narrow lane across the room', 60: 'a lance of ruin that crosses the whole battlefield', 100: 'a hundred-foot avenue of devastation' } },
    radius: { name: 'burst', phrase: 'a {n}-foot-radius burst', scale: { 10: 'about the size of a small cottage room', 20: 'roughly a large hall', 30: 'a wide courtyard\'s worth', 60: 'a hall-spanning sphere that leaves nothing out' } },
    sphere: { name: 'sphere', phrase: 'a {n}-foot-radius sphere', scale: { 10: 'about the size of a small cottage room', 20: 'roughly a large hall', 30: 'a wide courtyard\'s worth', 60: 'a hall-spanning sphere that leaves nothing out' } },
    cube: { name: 'cube', phrase: 'a {n}-foot cube', scale: { 10: 'a tight, close box', 20: 'a room-sized block', 30: 'a large chamber\'s worth', 60: 'a hall-sized block of violence' } },
    cylinder: { name: 'column', phrase: 'a {n}-foot-radius column', scale: { 10: 'a pillar of power', 20: 'a wide column from floor to ceiling', 30: 'a broad column that rises into the sky' } },
    emanation: { name: 'emanation', phrase: 'a {n}-foot ring', scale: { 10: 'a close, tight ring', 30: 'a wide halo around the source', 60: 'an enormous ring that fills the space' } },
    around: { name: 'ring', phrase: 'a {n}-foot ring', scale: { 5: 'a point-blank ring', 10: 'a close ring', 30: 'a wide ring', 60: 'a huge ring' } }
  };
  D.NUMWORDS = { 5: 'five', 10: 'ten', 15: 'fifteen', 20: 'twenty', 25: 'twenty-five', 30: 'thirty', 40: 'forty', 45: 'forty-five', 50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety', 100: 'one hundred', 120: 'one hundred and twenty', 150: 'one hundred and fifty', 200: 'two hundred', 300: 'three hundred', 500: 'five hundred' };

  // ------------------------------------------------------------------ damage tiers
  // Average damage of the whole attack decides the tier; spell level and creature CR can raise it.
  D.SEVERITY = ['mild', 'notable', 'serious', 'severe', 'dire', 'catastrophic'];
  D.COND_ELEMENT = { frightened: 'psychic', charmed: 'psychic', poisoned: 'poison', paralyzed: 'necrotic', stunned: 'psychic', sleep: 'psychic', blinded: 'radiant', deafened: 'thunder', petrified: 'force', banish: 'force', slowed: 'cold', confused: 'psychic', silenced: 'force', curse: 'necrotic', disease: 'poison', drain: 'necrotic', exhaustion: 'necrotic', burning: 'fire', frozen: 'cold', swallowed: 'acid', engulfed: 'acid', drown: 'cold' };
  D.COND_TIER = { paralyzed: 4, petrified: 5, banish: 5, stunned: 3, sleep: 4, charmed: 3, frightened: 2, blinded: 2, restrained: 2, grappled: 1, poisoned: 2, prone: 1, push: 1, pull: 1, drain: 3, heal: 2, disease: 3, curse: 3, burning: 2, frozen: 3, slowed: 2, exhaustion: 2, confused: 3, silenced: 2, disarm: 1, deafened: 1, incapacitated: 3, swallowed: 4, engulfed: 4, drown: 4, bleed: 2, teleported: 1, invisible_target: 0 };
  D.NO_DAMAGE = {
    hit: ['It finds its mark and holds.', 'It lands true, and there is no mistaking that it has taken hold.', 'It connects cleanly, and that is enough.'],
    fail: ['{Tgt} cannot shake it off; it takes hold quietly and completely.', 'It finds {tgt} and settles in.', 'The effect lands on {tgt}, and there is no mistaking it.'],
    resist: ['{Tgt} shakes it off, jaw tight, and the effect fades like a bad dream.', '{Tgt} grits their teeth and holds on to themselves; it passes.', 'The effect breaks against {tgtPoss} resolve and falls away.'],
    area: ['Every creature that fails to shake it off feels it settle in and take hold.', 'It sweeps over the area, and everyone it touches is affected.', 'Those who cannot resist are held fast by it.']
  };
  D.TIERS = [
    { id: 0, name: 'trivial', max: 4, pow: ['a feeble', 'a glancing', 'a half-hearted', 'a weak'], mag: ['small', 'mild', 'minor'], tag: 'a nuisance' },
    { id: 1, name: 'light', max: 11, pow: ['a stinging', 'a sharp', 'a solid', 'a quick'], mag: ['sharp', 'stinging', 'modest'], tag: 'a painful hit' },
    { id: 2, name: 'solid', max: 22, pow: ['a heavy', 'a punishing', 'a vicious', 'a hard'], mag: ['heavy', 'vicious', 'serious'], tag: 'a serious wound' },
    { id: 3, name: 'heavy', max: 40, pow: ['a brutal', 'a savage', 'a crushing', 'a ruinous'], mag: ['brutal', 'savage', 'grievous'], tag: 'a grievous blow' },
    { id: 4, name: 'brutal', max: 70, pow: ['a devastating', 'a monstrous', 'a shattering', 'a thunderous'], mag: ['devastating', 'monstrous', 'ruinous'], tag: 'a devastating strike' },
    { id: 5, name: 'cataclysmic', max: 9999, pow: ['a cataclysmic', 'an apocalyptic', 'a world-breaking', 'a titanic'], mag: ['cataclysmic', 'apocalyptic', 'titanic'], tag: 'a cataclysm' }
  ];
  // How much a typical adventurer can take, by character level. Used for the "what this means" line.
  D.HP_BY_LEVEL = [0, 11, 19, 27, 36, 45, 53, 62, 70, 78, 87, 96, 105, 113, 122, 131, 139, 148, 157, 166, 175];
  D.BENCHMARKS = [
    { hp: 4, who: 'a commoner' }, { hp: 11, who: 'a town guard' }, { hp: 27, who: 'a seasoned soldier' }, { hp: 55, who: 'a veteran adventurer' }, { hp: 95, who: 'a champion' }, { hp: 150, who: 'a hero of legend' }
  ];
  // fraction of an average adventurer's hit points taken by one hit
  D.LETHALITY = [
    { max: 0.08, text: ['barely a scratch to a hardy adventurer — more insult than injury', 'a nuisance a trained fighter will shrug off', 'noticeable, but only just'] },
    { max: 0.2, text: ['a painful hit that an adventurer can absorb for several rounds', 'enough to sting and be remembered, not enough to slow anyone down', 'a clear wound, though far from dangerous on its own'] },
    { max: 0.35, text: ['a serious injury; an adventurer feels it and starts looking for cover', 'about a quarter of a seasoned adventurer\'s strength gone in a single blow', 'a wound that changes how a fighter moves for the rest of the fight'] },
    { max: 0.55, text: ['a heavy wound that leaves an adventurer reeling, nearly half their strength in one blow', 'crippling: two of these in a row will drop most seasoned fighters', 'a blow that makes the whole party stop and look'] },
    { max: 0.8, text: ['a ruinous hit that leaves an adventurer on the brink', 'almost certain to take a seasoned adventurer from healthy to barely standing', 'the kind of hit that ends fights, and sometimes lives'] },
    { max: 1.0, text: ['near-fatal: even a veteran is left hanging by a thread', 'close to a killing stroke for an adventurer of this level', 'enough to nearly drop even the toughest adventurer outright'] },
    { max: 9e9, text: ['lethal: enough to drop an adventurer of this level outright on a clean hit', 'almost certain death for a direct hit on an average adventurer', 'a killing blow for anyone not exceptionally hardy'] }
  ];

  // ------------------------------------------------------------------ creature size, family and role
  D.SIZES = {
    Tiny: { adj: ['tiny', 'scrabbling', 'bird-sized', 'minuscule'], frame: ['tiny frame', 'little body'], flair: ['{They} {pv:be} small, but quick and mean.', 'Being tiny makes {aThem} harder to catch and harder to ignore.'] },
    Small: { adj: ['small', 'wiry', 'quick', 'scrappy'], frame: ['wiry frame', 'compact body'], flair: ['{They} {pv:be} small enough to dart between legs and quick enough to vanish before anyone can hit back.'] },
    Medium: { adj: ['practiced', 'sturdy', 'steady', 'muscular'], frame: ['sturdy frame', 'solid body', 'frame'], flair: [] },
    Large: { adj: ['heavy', 'looming', 'powerful', 'oversized'], frame: ['heavy frame', 'broad body', 'powerful body'], flair: ['{Their} bulk makes the floor shiver underfoot.', '{They} {pv:tower} over the party, every move a statement of weight.'] },
    Huge: { adj: ['massive', 'enormous', 'house-sized', 'towering'], frame: ['massive frame', 'immense bulk', 'vast body'], flair: ['The ground shudders with every motion and the room feels suddenly too small.', 'The sheer scale of it blots out the light.', 'Dust sifts from the ceiling as {their} mass moves.'] },
    Gargantuan: { adj: ['gargantuan', 'mountainous', 'colossal', 'earth-shaking'], frame: ['colossal frame', 'mountainous bulk', 'titanic body'], flair: ['The attack is so large that it seems less like a creature\'s than like weather — slow, enormous and unavoidable.', 'The earth itself trembles with every motion, and the scale of it defies sense.', 'The horror of it is the sheer size: this is the kind of thing that ends towns.'] }
  };
  D.FAMILIES = {
    beast: { nouns: ['the beast', 'the creature', 'the animal', 'the predator'], air: ['There is nothing clever here, only hunger and instinct sharpened over a lifetime.', '{They} {pv:move} with the unthinking confidence of an animal that has killed before.'] },
    humanoid: { nouns: ['the attacker', 'the combatant', 'the fighter', 'the warrior'], air: ['It is trained, practiced violence.', 'There is skill in the way {they} {pv:move} and the way {they} {pv:judge} distance and openings.'], pronoun: 'they' },
    dragon: { nouns: ['the dragon', 'the wyrm', 'the great beast'], air: ['Scales flash and ancient eyes burn with disdain.', 'Everything about the creature speaks of a mind older than the room, and cruel with the confidence of age.'] },
    undead: { nouns: ['the undead thing', 'the horror', 'the dead thing', 'the revenant'], air: ['The smell of old graves clings to everything {they} {pv:do}.', '{Their} motions are wrong: too still, then too sudden, as if a cold hand were pulling the strings.'] },
    fiend: { nouns: ['the fiend', 'the infernal creature', 'the horror from below', 'the demon'], air: ['Brimstone and a sour, cruel pleasure ride in {their} wake.', 'The air curdles and a faint snarl of many voices underlies every move.'] },
    celestial: { nouns: ['the celestial', 'the radiant being', 'the winged guardian'], air: ['Every gesture has a terrible, unhurried grace.', 'A cold, bright dignity radiates from the figure, impossible to look at for long.'] },
    construct: { nouns: ['the construct', 'the machine', 'the automaton', 'the animated thing'], air: ['The motion has the unfeeling precision of something that was built, not born.', 'Gears whir, stone grinds and metal clanks; the thing never tires and never doubts.'] },
    elemental: { nouns: ['the elemental', 'the raw force', 'the living storm', 'the elemental thing'], air: ['It is less a creature than a piece of the world given a will.', 'The air hums with the element that makes it up.'] },
    fey: { nouns: ['the fey creature', 'the trickster', 'the otherworldly being', 'the strange being'], air: ['There is a sly, glittering delight in everything {they} {pv:do}.', '{Their} movements are lovely and wrong, as if the rules of the world applied only loosely.'] },
    giant: { nouns: ['the giant', 'the colossus', 'the brute', 'the towering figure'], air: ['The fight is waged like clearing furniture, with a casual and total contempt.', 'The ground shakes with every step and the swing of the arms is all weight.'] },
    monstrosity: { nouns: ['the monster', 'the monstrosity', 'the abomination', 'the thing'], air: ['It is a creature that should not exist, built from the wrong pieces and wholly at home in its violence.', 'Something about the anatomy resists the eye; the body moves in ways it should not.'] },
    ooze: { nouns: ['the ooze', 'the slime', 'the glistening mass', 'the amorphous thing'], air: ['A wet, slopping sound accompanies every motion, and a shining trail is left behind.', 'There is no face and no mind to speak of, only appetite given shape.'] },
    plant: { nouns: ['the plant creature', 'the living growth', 'the thing of root and bark', 'the green horror'], air: ['The thing creaks and rustles with the slow patience of something that has never needed to hurry.', 'Leaves, bark and fibrous cords shift with every motion, smelling of sap and damp earth.'] },
    aberration: { nouns: ['the aberration', 'the alien thing', 'the abomination', 'the wrongness'], air: ['The geometry is subtly wrong, and the eye keeps trying to rearrange it into something sane.', 'A faint, nauseating dissonance clings to the thing, as though space itself resented the presence.'] },
    swarm: { nouns: ['the swarm', 'the writhing mass', 'the seething cloud', 'the horde'], air: ['There is not one creature here but hundreds, moving as one dreadful will.', 'The noise is the worst part: a dry, rising rustle and click, like rain on a tin roof.'] }
  };
  // posture (participial phrases), tempo (adverbial phrases) and tone, by role
  D.ROLES = {
    brute: { pose: ['shoulders hunched and breath huffing', 'muscles standing out in thick cords', 'weight sunk low and heavy', 'neck bulging with effort'], pace: ['with brutal economy', 'with ponderous, certain force', 'in a single, heavy, deliberate motion', 'with no finesse at all, only force'] },
    skirmisher: { pose: ['light on the balls of the feet', 'weaving from side to side', 'head low and eyes darting', 'one step from being somewhere else'], pace: ['in a darting blur', 'quick as a snake', 'with practiced, flickering speed', 'before the eye can settle'] },
    ambusher: { pose: ['half in shadow', 'perfectly still, then suddenly not', 'rising out of cover with a hiss', 'low and patient'], pace: ['without a sound', 'from the blind side', 'in a sudden, silent rush', 'with the patience of a cat'] },
    caster: { pose: ['hands shaping the air', 'lips moving around unheard syllables', 'eyes gone distant and bright', 'one hand raised in a spiraling gesture'], pace: ['with precise, flowing gestures', 'in a calm and measured cadence', 'with the economy of long practice', 'and a patient, assured intensity'] },
    archer: { pose: ['one eye closed, breath held', 'weight settled into a steady stance', 'perfectly still but for the tracking eye', 'a long, patient line from shoulder to target'], pace: ['with unhurried precision', 'smoothly, like a practiced routine', 'with a hunter\'s patience', 'in one fluid draw and loose'] },
    soldier: { pose: ['shield high and feet planted', 'in a disciplined stance', 'braced like a wall', 'eyes steady behind a visor'], pace: ['with drilled precision', 'in practiced, efficient motion', 'with grim professionalism', 'without wasted movement'] },
    swarm: { pose: ['rippling and boiling as one body', 'tight and humming', 'a living tide of limbs'], pace: ['in a rolling, scrabbling rush', 'all at once', 'in a dozen directions at the same instant'] },
    horror: { pose: ['joints bending the wrong way', 'head tilted at an angle no neck should allow', 'mouth too wide for its face', 'perfectly still and watching'], pace: ['with a wrongness that crawls under the skin', 'in jerks and glides that do not match', 'with a calm that is somehow worse than frenzy', 'as though the attack had already happened'] },
    guardian: { pose: ['planted and immovable', 'a wall of armor and resolve', 'weight settled like a monument', 'feet rooted to the stone'], pace: ['without haste and without mercy', 'with an unstoppable, grinding certainty', 'in a slow and inevitable arc', 'as if it had all the time in the world'] },
    leader: { pose: ['chin high and eyes cold', 'a hand resting on a weapon with practiced ease', 'standing apart and watching', 'calm amid the chaos'], pace: ['with cold, commanding authority', 'in a smooth, confident motion', 'with a leader\'s unhurried certainty'] }
  };

  // ------------------------------------------------------------------ variants, traits and magic weapons
  D.VARIANT_LINES = {
    up: ['This is no ordinary specimen: the blow carries unusual weight and menace.', 'Whatever made this one different has made it hit harder than it should.', 'There is something extra in the strike — a violence beyond what the build would explain.'],
    down: ['This one is a weaker, scrappier specimen, and the attack shows it.', 'Whatever is wrong with this creature has left the blow a little slower and softer than the real thing.', 'It swings like something half-starved or half-broken.']
  };
  D.AURAS = { // rarity of a wielded weapon or item => what the players see of its magic
    common: [],
    uncommon: ['A faint shimmer runs along the weapon, like heat haze, and fades.', 'A soft hum and the faintest glint of unnatural light touch the edge.'],
    rare: ['Runes flicker faintly along the weapon, glowing like coals when it swings.', 'A visible aura clings to the weapon, a thin, pulsing line of light that trails every movement.'],
    superrare: ['Bright runes burn along the weapon and a low, ringing note follows every motion.', 'Power crackles around the weapon and leaves hanging streaks of color in the air.'],
    legendary: ['The weapon blazes with its own light, shedding sparks, a deep hum rattling the teeth of everyone near.', 'The very air bends around the weapon, and the sound of its passing is a long, rising chord.'],
    celestial: ['The weapon shines like a captured star, throwing hard-edged shadows, and its song fills the room like a struck cathedral bell.', 'Reality itself seems to bow around the weapon; light, sound and time stutter at its passing.']
  };
  // adjectives found in attack and weapon names ("Rusted blade", "Serrated Sword", "Furious Bite")
  D.ADJECTIVES = [
    { re: /\brust(?:y|ed)\b/i, flair: ['Flakes of rust shower with every motion, and the edge is as likely to tear as to cut.', 'The pitted, rust-scabbed metal looks neglected, and far more likely to infect than to kill cleanly.'] },
    { re: /\b(?:jagged|serrated|notched|barbed|spiked|toothed)\b/i, flair: ['The edge is notched and ragged, made to catch and tear on the way out.', 'Barbs and teeth along the weapon snag and rip as it comes free.'] },
    { re: /\b(?:wicked|cruel|vicious|cruel)\b/i, flair: ['There is something cruel in the weapon\'s lines, as if it were designed to hurt for its own sake.'] },
    { re: /\bstolen\b/i, flair: ['It is a fine weapon in the wrong hands, and the wielder handles it with a grudging, thief\'s care.'] },
    { re: /\bheavy\b/i, flair: ['The sheer weight of it drags the arm down and then adds ferocity to the swing.'] },
    { re: /\bcrude\b/i, flair: ['The weapon is a crude, lopsided thing, but the weight behind it makes up for what it lacks in grace.'] },
    { re: /\bbone\b/i, flair: ['The weapon is carved from yellowed bone, creaking and rattling with every swing.'] },
    { re: /\b(?:furious|savage|frenzied|rampag|berserk|raging|rabid)\w*/i, flair: ['It comes in a rage, with no thought for defense.', 'The attack is unthinking fury, all muscle and teeth and noise.'] },
    { re: /\b(?:vampiric|leeching|blood|sanguine|feeding)\b/i, flair: ['A faint red glow answers every drop of blood, as though the attack were drinking.'] },
    { re: /\b(?:silver|silvered)\b/i, flair: ['Pale silver flashes cold and clean, and the metal seems to loathe the dark.'] },
    { re: /\b(?:iron|steel|adamantine|mithral)\b/i, flair: ['The metal rings, hard and bright, with no give in it at all.'] },
    { re: /\b(?:giant|great|greater|mighty|massive|colossal)\b/i, flair: ['Everything about it is oversized, and the force it carries is out of all proportion to what the eye expects.'] },
    { re: /\b(?:soul|spirit|ghost|spectral|phantom|phantasmal)\b/i, flair: ['A cold, pale glow outlines it, and a thin keening rises from the air as it moves.'] },
    { re: /\b(?:shadow|umbral|gloom|night)\b/i, flair: ['It trails darkness, edges blurring into smoke.'] },
    { re: /\b(?:infernal|hellish|hellfire|demonic|fiendish|baleful)\b/i, flair: ['A dull red light seeps from its seams and a smell of brimstone clings to it.'] },
    { re: /\b(?:divine|holy|radiant|sacred|celestial|blessed|righteous)\b/i, flair: ['A clean golden shimmer clings to it, and a faint chord sings in the air.'] },
    { re: /\b(?:cursed|accursed|profane|unholy|vile|foul|dread|dreadful)\b/i, flair: ['The air around it feels foul, as though the attack carried a stain that would not wash out.'] },
    { re: /\b(?:thunderous|shocking|lightning|storm|electric)\b/i, flair: ['Static crawls over it, and every sound it makes is a snap and a crackle.'] },
    { re: /\b(?:frost|frozen|icy|ice|rime|glacial)\b/i, flair: ['Frost feathers across it and every motion leaves a wake of cold, sparkling mist.'] },
    { re: /\b(?:flaming|fiery|burning|blazing|molten|searing)\b/i, flair: ['Flame licks along it and the air above ripples with heat.'] },
    { re: /\b(?:venomous|poisoned|toxic|noxious|plague)\b/i, flair: ['A greenish sheen glistens along it, and the smell is sweet and wrong.'] },
    { re: /\b(?:crushing|pounding|bone-?breaking)\b/i, flair: ['It is the kind of attack you hear before you feel it.'] },
    { re: /\b(?:unerring|true|piercing|keen|razor)\w*/i, flair: ['It moves with an eerie, certain accuracy, as if the target were already doomed.'] },
    { re: /\+\s?[123]\b|\b(?:magic|magical|enchanted|runic|arcane)\b/i, flair: ['Faint runes glimmer along it with every motion, and the air hums.'] },
    { re: /\b(?:silent|quiet|whispering|muffled)\b/i, flair: ['It makes no sound at all, which is somehow worse.'] },
    { re: /\b(?:twin|paired|double|dual|flurry|barrage|volley|storm of)\b/i, flair: ['It comes in a pair, or a blur of many, each blow chasing the one before.'] },
    { re: /\b(?:ancient|elder|old|primeval)\b/i, flair: ['There is great age in the attack, a patience that has outlasted kingdoms.'] }
  ];
  // creature types that tend to leave a specific mark on an attack
  D.TYPE_FLAIR = {
    undead: ['A graveyard chill clings to the wound, and the smell of old earth lingers.'],
    fiend: ['The wound smokes faintly, and a smell of sulfur and cruelty hangs in the air.'],
    celestial: ['A pure, clean light clings to the wound, almost beautiful in its precision.'],
    fey: ['The wound shimmers faintly, glittering like frost in the sun, and no one is quite sure how it was done.'],
    aberration: ['The wound is wrong in a way that is hard to look at: edges that do not match, angles that should not be.'],
    construct: ['The wound is clean and mechanical, with no malice in it at all.'],
    ooze: ['The wound is slick and burning, coated with a clinging, translucent slime.'],
    plant: ['Green sap and bits of bark mix with the blood, and tiny fibrous threads trail from the wound.'],
    elemental: ['The wound is a pure, elemental scar, marked by the raw force that made it.'],
    dragon: ['The wound is vast and unmistakable, the signature of something truly ancient.'],
    giant: ['The wound is out of all proportion to the weapon, the force of a falling tree.']
  };
  D.TYPE_FLAIR_SMALL = {
    dragon: ['The wound has a sharp, draconic neatness: a small creature, but with an old, proud cruelty in it.'],
    giant: ['The wound is rougher than a blade would leave it, the mark of a clumsy, heavy hand.']
  };
  // reaction beats, by tier: what everyone else in the scene does
  D.CROWD = [
    ['Nobody pays it much mind.', 'A grunt, a wince; the fight goes on.'],
    ['A few heads turn at the sound.', 'Allies flinch in sympathy.'],
    ['The party stiffens; this one hurt to watch.', 'A sharp intake of breath rolls through the room.'],
    ['Conversation stops. Everyone in earshot knows how bad that was.', 'Allies surge forward or shrink back; the room has changed.'],
    ['A hush falls. The sound of the attack seems to go on echoing long after it ends.', 'Even the enemy hesitates, as if surprised at the result.'],
    ['The silence afterward is total. The air has a taste, the ground a tremor, and no one is quite sure how they are still standing.', 'It will be remembered, whatever else happens, for a very long time.']
  ];
  D.TELLS = [ // how a DM can foreshadow the attack in one line before rolling
    'Tell the table what {subj} is about to do before they roll — the threat is half of it.',
    'Describe the wind-up first and give the players a beat to react before the dice come out.',
    'Let the telegraph land, then roll; it reads better when the players see it coming.',
    'Read the wind-up, pause, then resolve it. Silence makes the dice louder.'
  ];
})();
