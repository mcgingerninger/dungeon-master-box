// Attack narrator data, part 2: physical attacks — natural weapons, held weapons and projectiles.
// Each move is a small bundle of sentence templates (see attack-narrator.js for the token syntax):
//   {Subj} {subj} {They} {their} {aThem} {themself}  the attacker   {v:lunge}  verb agreeing with the attacker
//   {Tgt} {tgt} {tgtPoss} {tThey} {tTheir} {them}   the target     {tv:verb}  verb agreeing with the target   {part}  one of its body parts
//   {act} {Act}                            the attack as a singular noun ("the bite")
//   {limb} {limbs}                         the attacking body part / tool (move specific)
//   {hitv} {wound} {gear} {residue} {env}  from the damage type (attack-narrator-elements.js)
//   {sub} {stuff} {adj}                    substance words of the damage type
//   {pose} {pace} {sizeAdj} {frame}        attacker posture, tempo and bulk
//   {reach} {range}                        distances in words
// windup  what the players see before it lands      motion   the attack in motion
// hit     what happens on a hit                      miss     how it fails to connect
// crit    on a critical hit                          fumble   on a natural 1
(function () {
  const D = (window.AttackNarratorData = window.AttackNarratorData || {});
  D.MOVES = D.MOVES || {};
  const M = D.MOVES;

  // ============================ NATURAL WEAPONS ============================
  M.bite = {
    kind: 'melee', group: 'natural', act: ['the bite', 'the snap of the jaws', 'the lunge'], limb: ['jaws', 'teeth', 'fangs'],
    windup: [
      '{Subj} {v:coil} low, {their} {limb} parted and a thread of saliva stretching between the teeth.',
      '{Subj} {v:rear} back and {v:peel} {their} lips from rows of teeth, a low rumble building in {their} throat.',
      '{Subj} {v:fix} {tgt} with a hungry stare and {v:gape} {their} {limb} wide, breath rolling out hot and foul.',
      '{Subj} {v:drop} {their} head and {v:shift} {their} weight to the back legs, muscles bunching for a lunge.',
      'A wet clicking comes from {their} {limb} as {subj} {v:lean} in, nostrils flaring at the scent of {tgt}.'
    ],
    motion: [
      '{Subj} {v:lunge}, {their} {limb} snapping open and shut on empty air as the distance closes in a blink.',
      'The head whips forward on a snake-quick neck and {subj} {v:clamp} down with a savage, wet clap.',
      '{Subj} {v:spring} in low and fast, {limb} first, all of {their} weight behind the bite.',
      '{Subj} {v:hurl} {themself} forward, jaws gaping, and {v:clamp} down with a crunch that can be heard across the room.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, teeth grinding on armor and bone alike, leaving {wound}.',
      'Teeth sink in and worry at {tgtPoss} {part}; the bite goes deep, leaving {wound}.',
      '{Act} lands with a meaty crunch and {hitv} {tgtPoss} {part}, a quick shake of the head worrying at the wound, leaving {wound}.',
      'The jaws close over {tgtPoss} {part} with a wet crunch; {act} {hitv} and {v:wrench} away, leaving {wound}.'
    ],
    miss: [
      'The jaws clap shut a hand\'s breadth from {tgt}, close enough to feel the heat of the breath and spatter of drool.',
      'Teeth skid off {tgtPoss} armor with a shrill scrape and a spray of saliva.',
      'The snap catches nothing but a mouthful of cloak, and {subj} {v:shake} it free with a snarl.',
      '{Subj} {v:overreach} and the bite closes on empty air with a clack of teeth.'
    ],
    crit: ['The jaws find a gap in the armor and clamp down on something vital, the crunch of it audible across the room.', 'A perfect bite: teeth sink in to the root, and {subj} {v:thrash} {their} head side to side, tearing.'],
    fumble: ['{Subj} {v:snap} at {tgt} and {v:catch} a hard stone wall instead, teeth screeching and eyes watering.', '{Subj} {v:lunge} too far and {v:stumble} past {tgt}, jaws clacking on nothing.']
  };
  M.claw = {
    kind: 'melee', group: 'natural', act: ['the swipe', 'the rake', 'the slash of claws'], limb: ['claws', 'talons', 'hooked claws', 'razor claws'],
    windup: [
      '{Subj} {v:rise} on {their} haunches and {v:spread} {their} {limb}, each one curved like a sickle and gleaming in the light.',
      '{Subj} {v:flex} {their} {limb} slowly and {v:drag} them across stone with a shriek that sets every tooth on edge.',
      '{Subj} {v:circle} {tgt}, {limb} flexing, head low, picking the spot where the first strike will land.',
      '{Subj} {v:draw} an arm back like a drawn bow, {their} {limb} fanned wide and ready to rake.'
    ],
    motion: [
      '{Subj} {v:lash} out in a blur, {limb} raking down in parallel lines that whistle through the air.',
      'One arm sweeps in a flat, vicious arc, claws trailing like a handful of knives.',
      '{Subj} {v:pounce} and {v:rake} with both forelimbs in a flurry of slashes too quick to count.',
      '{Subj} {v:surge} forward, {limb} outstretched, ripping through the air with a sound like tearing silk.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, claws catching and tearing, leaving {wound}.',
      'Claws rip through cloth and skin; {act} {hitv} {tgtPoss} {part} and leaves {wound}.',
      'Four parallel furrows open across {tgtPoss} {part} as {act} {hitv} deep, leaving {wound}.',
      '{Act} catches {tgtPoss} {part} and drags; it {hitv} the straps, leaving {wound}.'
    ],
    miss: [
      'The claws rake the air so close to {tgt} that the wind of them stirs their hair.',
      'The swipe screeches across {tgtPoss} armor, leaving four bright scratches but no wound.',
      'Claws gouge the wall behind {tgt} and plaster rains down in thick pieces.',
      '{Subj} {v:swipe} and {v:find} nothing but empty air as {tgt} slips under the arm.'
    ],
    crit: ['The claws dig in and then rip back, peeling armor away in strips and opening {tgt} from shoulder to hip.', 'A swipe too fast to see lands perfectly, and the follow-through opens {tgtPoss} guard wide.'],
    fumble: ['{Subj} {v:swipe} wildly, claws catching on a pillar and tearing free in a shower of splinters.', '{Subj} {v:overbalance} on the swipe and {v:topple} sideways, claws raking nothing but air.']
  };
  M.talon = {
    kind: 'melee', group: 'natural', act: ['the strike', 'the stoop', 'the clutch of talons'], limb: ['talons', 'hooked claws', 'raptor claws'],
    windup: [
      '{Subj} {v:circle} high above, wings tilting, then {v:fold} them and {v:tuck} {their} {limb} forward.',
      '{Subj} {v:hover} for a heartbeat, {limb} spread wide and gleaming, eyes locked on {tgt}.',
      '{Subj} {v:hunch} and {v:spring} up from the perch, wings flaring as the {limb} dangle in front like bunched hooks.'
    ],
    motion: [
      '{Subj} {v:stoop} in a whistling dive, {limb} hooking forward at the last instant and snatching.',
      '{Subj} {v:sweep} past with a thunder of wings, {limb} raking down in a single, tearing grab.',
      '{Subj} {v:slam} into {tgt} feet-first, {limb} closing like iron fists.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, the {limb} clamping hard and tearing as {subj} {v:beat} away, leaving {wound}.',
      'The {limb} hook in and {act} {hitv} {tgtPoss} {part}, leaving {wound} as {subj} {v:wrench} free.',
      'A thunder of wings and {act} {hitv} {tgtPoss} {part}, {limb} tightening, leaving {wound}.'
    ],
    miss: [
      'The {limb} snap shut on air as {tgt} ducks, and the rush of the wings flings dust everywhere.',
      '{Subj} {v:skim} past, {limb} scoring a pale line on {tgtPoss} armor.',
      'The strike misses by a feather and {subj} {v:wheel} away, screaming, to try again.'
    ],
    crit: ['The talons lock in and haul, nearly pulling {tgt} from {tTheir} feet before {subj} {v:release} {them} in a spray of blood.'],
    fumble: ['{Subj} {v:stoop} and {v:clip} a beam, wheeling away in an explosion of feathers and outrage.']
  };
  M.slam = {
    kind: 'melee', group: 'natural', act: ['the blow', 'the slam', 'the haymaker', 'the pound'], limb: ['fist', 'forearm', 'arm', 'hammer-like fist'],
    windup: [
      '{Subj} {v:raise} a {sizeAdj} {limb} high overhead, knuckles whitening, shoulders bunching with a creak of muscle.',
      '{Subj} {v:plant} {their} feet and {v:coil}, one fist drawn back past the shoulder, {pose}.',
      '{Subj} {v:roll} {their} shoulders and {v:clench} {their} fist, the whole {frame} winding up for one huge swing.',
      '{Subj} {v:lower} {their} head and {v:bear} down, a low grunt escaping as {they} {pv:cock} an arm back.'
    ],
    motion: [
      '{Subj} {v:swing}, the blow descending like a felled tree, air whooping in front of it.',
      'The whole {frame} {v:lurch} forward behind a looping haymaker that crosses the distance faster than something that large should.',
      '{Subj} {v:hammer} down with {their} {limb} in a brutal overhand chop.',
      '{Subj} {v:drive} {their} {limb} in a short, savage straight punch that has the full weight of {their} body behind it.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part} with a flat, heavy crunch, leaving {wound}.',
      '{Act} lands square and {hitv} {tgtPoss} {part}, the impact rolling through armor, leaving {wound}.',
      'A sickening thud as {act} {hitv} {tgtPoss} {part}, leaving {wound} and driving {tgt} back a step.',
      '{Act} {hitv} {tgtPoss} {part} so hard the floor shivers, leaving {wound}.'
    ],
    miss: [
      'The blow whistles past {tgtPoss} head and craters the floor with a crack that shivers every stone.',
      'The fist hammers the wall behind {tgt}, bursting masonry into chunks.',
      '{Subj} {v:swing} and {v:stumble}, {their} {limb} slamming into empty air with a grunt of frustration.',
      'The blow glances off {tgtPoss} shield with a deafening clang that numbs the arm behind it.'
    ],
    crit: ['The blow lands dead center with a crack of breaking bone, lifting {tgt} off {tTheir} feet before dropping {them} in a heap.', 'A perfect, brutal strike that folds {tgt} around the impact and sends {them} sprawling across the floor.'],
    fumble: ['{Subj} {v:swing} so hard that {their} fist buries itself in the floor, and {they} {pv:heave} it free with a roar.', '{Subj} {v:overreach} and {v:crash} into a pillar, shaking dust from the ceiling.']
  };
  M.stomp = {
    kind: 'melee', group: 'natural', act: ['the stomp', 'the kick', 'the trampling blow', 'the hoof-strike'], limb: ['hooves', 'feet', 'heavy feet'],
    windup: [
      '{Subj} {v:rear} high, {limb} pawing the air above {tgt} in a threatening cloud of dust.',
      '{Subj} {v:paw} the ground and {v:snort}, head dipping, the floor shivering with every stamp.',
      '{Subj} {v:lift} a {sizeAdj} foot high and {v:hold} it over {tgt}, shadow falling across {them} like a closing door.',
      '{Subj} {v:wheel} and {v:throw} {their} weight onto the front legs, back legs lifting for a kick.'
    ],
    motion: [
      '{Subj} {v:hammer} {their} {limb} down in a savage, stamping blow that shakes the ground.',
      '{Subj} {v:lash} out with a back-kick that cracks like a whip and flings a plume of dirt.',
      '{Subj} {v:charge}, {their} {limb} pounding the floor in a rolling thunder, and {v:trample} forward.',
      'The huge {limb} descend like a falling boulder, a thudding blow that rattles every loose stone.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part} with a crunch, leaving {wound} and driving {them} down into the dirt.',
      'The {limb} land squarely and {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} {hitv} {tgtPoss} {part}, a bone-deep thud that leaves {wound}.',
      'A crack of impact and {act} {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: [
      'The {limb} slam into the ground a step from {tgt}, cracking flagstones and flinging grit.',
      '{Tgt} rolls out of the way and the stamp shatters the floor where {tThey} were standing.',
      'A kick whistles past {tgtPoss} ear so closely that it tugs at {tTheir} hair.'
    ],
    crit: ['The {limb} land with crushing, trampling force, driving {tgt} into the ground with a crack that echoes.'],
    fumble: ['{Subj} {v:stamp} down and {v:slip}, {their} {limb} skating on loose stone as {they} {pv:sprawl}.']
  };
  M.gore = {
    kind: 'melee', group: 'natural', act: ['the charge', 'the gore', 'the goring thrust', 'the headbutt'], limb: ['horns', 'tusks', 'antlers'],
    windup: [
      '{Subj} {v:lower} {their} head, {limb} sweeping toward {tgt}, and {v:rake} the floor with a hoof.',
      '{Subj} {v:snort} a gout of steam and {v:swing} {their} {limb} from side to side as if choosing a spot.',
      '{Subj} {v:back} up two paces, shaking {their} great head, then {v:set} {their} feet for a rush.',
      '{Subj} {v:tuck} {their} chin and {v:bunch} {their} haunches, {limb} leveled like a pair of spears.'
    ],
    motion: [
      '{Subj} {v:charge}, thundering across the ground with {their} {limb} lowered, a battering ram on legs.',
      '{Subj} {v:hook} {their} head upward in a vicious, sweeping gore.',
      '{Subj} {v:slam} {their} {limb} forward in a short, brutal butt that carries the full weight of {their} body.',
      'The {limb} flash in a fast, savage upward hook, aimed for the soft places beneath the ribs.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, the {limb} punching in and lifting {them} off the ground, leaving {wound}.',
      'The {limb} find their mark and {act} {hitv} {tgtPoss} {part}, leaving {wound} as {subj} {v:toss} {them} aside.',
      '{Act} lands like a battering ram and {hitv} {tgtPoss} {part}, leaving {wound}.',
      'With a crunch, the {limb} sink in and {act} {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: [
      'The {limb} scrape past {tgtPoss} hip and plow a furrow in the wall behind {them}.',
      '{Tgt} sidesteps the rush and the {limb} splinter a doorframe where {tThey} were standing.',
      'The gore catches nothing but cloak and tears it from {tgtPoss} shoulders.'
    ],
    crit: ['The {limb} drive through a gap in {tgtPoss} armor, and {subj} {v:heave} {tgt} off the ground and fling {them} aside like a rag.'],
    fumble: ['{Subj} {v:charge} and {v:bury} {their} {limb} in the wall, wrenching and snorting to pull free.']
  };
  M.tail = {
    kind: 'melee', group: 'natural', act: ['the lash', 'the tail-swipe', 'the sweeping blow', 'the whipping strike'], limb: ['tail', 'long tail', 'spiked tail', 'thick tail'],
    windup: [
      '{Subj}\'s {limb} sweeps slowly across the floor, rasping against the stone, then coils like a spring.',
      'The {limb} lifts behind {subj} and curls like a drawn whip, the tip twitching.',
      '{Subj} {v:swing} {their} head and {v:wind} {their} body, the {limb} whipping around to find a line on {tgt}.',
      'The {limb} thrums against the floor, building a drumbeat of warning blows.'
    ],
    motion: [
      'The {limb} snaps around in a flat, whistling sweep that raises a hiss of dust.',
      '{Subj} {v:spin} and the {limb} lashes out in a wide arc, thick as a mast and just as hard.',
      'The {limb} cracks like a whip and slams in from the side with scything speed.',
      '{Subj} {v:whip} the {limb} forward in a short, vicious jab that comes from nowhere.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part} and sweeps {them} off {tTheir} feet, leaving {wound}.',
      'The {limb} cracks into {tgtPoss} {part}; {act} {hitv} hard, leaving {wound}.',
      '{Act} lands with a flat, meaty slap and {hitv} {tgtPoss} {part}, leaving {wound}.',
      'A crack like a snapped sail as {act} {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: [
      'The {limb} hisses overhead as {tgt} ducks, and smashes a chunk out of the wall.',
      'The sweep rakes the floor beneath {tgtPoss} feet, but {tgt} hops it in time.',
      'The tail cracks past {tgt} and wraps a pillar, scoring the stone with a screech.'
    ],
    crit: ['The tail whips around too fast to dodge and connects with a crack like a thunderclap, hurling {tgt} several feet.'],
    fumble: ['{Subj} {v:whip} {their} {limb} and {v:snare} it on a pillar, tugging and snarling.']
  };
  M.wing = {
    kind: 'melee', group: 'natural', act: ['the buffet', 'the wing-slam', 'the wing blow'], limb: ['wing', 'great wing', 'leathery wing', 'vast wing'],
    windup: [
      '{Subj} {v:unfurl} a {limb}, the membrane snapping taut and blotting out the light.',
      '{Subj} {v:lift} {their} {limb} high and {v:hold} it spread over {tgt} like a falling roof.',
      '{Subj} {v:rise} on a gust of wings, the downdraft hammering {tgt} with dust and grit.'
    ],
    motion: [
      '{Subj} {v:slam} {their} {limb} down in a crushing sweep that cracks like a sail in a gale.',
      'The {limb} swings in a huge, flat buffet that hurls a storm of dust before it.',
      '{Subj} {v:whirl} and the {limb} lashes around like a falling tree.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part} with a crack and a roar of wind, leaving {wound}.',
      'The {limb} crashes into {tgt}; {act} {hitv} {tgtPoss} {part}, leaving {wound} and knocking {them} back.',
      '{Act} lands in a thunderclap of air, and {act} {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {limb} sweeps harmlessly overhead as {tgt} drops flat, the gale of it tugging at {tTheir} clothes.', 'The buffet shatters a pillar behind {tgt} and fills the air with stone dust.'],
    crit: ['The wing smashes down with the force of a toppling wall, flattening {tgt} to the floor.'],
    fumble: ['{Subj} {v:flap} wildly, hits a wall, and {v:recoil} in a cloud of dust.']
  };
  M.sting = {
    kind: 'melee', group: 'natural', act: ['the sting', 'the stab of the stinger', 'the jab', 'the thrust of the barb'], limb: ['stinger', 'barbed stinger', 'poisoned barb', 'needle-sharp spine'],
    windup: [
      'The {limb} curls up and over {subj}\'s back, a bead of venom swelling at its tip.',
      '{Subj} {v:arch} and {v:cock} the {limb} like a drawn spear, droplets of fluid glistening on the point.',
      '{Subj} {v:feint} with the pincers and let the {limb} sway above {their} back, searching.',
      'The {limb} twitches and uncoils with a faint, wet click, aimed at {tgt}.'
    ],
    motion: [
      'The {limb} stabs forward in a blur, the whole body behind the thrust.',
      '{Subj} {v:lash} the {limb} down in a lightning strike, a sprayed bead of venom flying off the tip.',
      'The {limb} drives in like a piston in a short, vicious jab.',
      '{Subj} {v:pounce} and the {limb} snaps forward faster than the eye can follow.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, injecting a bead of venom that burns as it goes in, leaving {wound}.',
      'The {limb} punches through cloth and skin; {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} lands with a dry, popping sound and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {limb} snaps past {tgtPoss} neck and clacks against the wall, a drop of venom hissing on the stone.', 'The sting skids off {tgtPoss} armor, venom dripping harmlessly down the plate.', 'The thrust stabs through the empty space where {tgt} stood and strikes sparks off the floor.'],
    crit: ['The {limb} slides in right through a gap in the armor and discharges a full, burning dose.'],
    fumble: ['{Subj} {v:stab} down and {v:bury} the {limb} in the floor, thrashing to free it.']
  };
  M.tentacle = {
    kind: 'melee', group: 'natural', act: ['the lash', 'the slap', 'the grasp', 'the whipping strike'], limb: ['tentacle', 'tendril', 'pseudopod', 'writhing limb'],
    windup: [
      'A {limb} uncoils from the mass of {subj}, glistening, its tip questing blindly toward {tgt}.',
      'Wet, boneless limbs writhe and ripple as {subj} {v:feel} the air, searching for {tgt}.',
      'A {limb} rears like a serpent, dripping, flexing, tasting the air.',
      '{Subj} {v:draw} a {limb} back in a slow, sinuous curl, taut as a drawn bowstring.'
    ],
    motion: [
      'The {limb} lashes out in a looping, wet crack that stretches across the distance impossibly far.',
      'A {limb} slithers across the floor and then explodes upward from beneath {tgt}.',
      'The {limb} whips around in a blinding arc, the tip cracking like a stockwhip.',
      'The {limb} lunges and tries to wrap, writhing and flexing, the suckers flaring.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, wrapping and squeezing before whipping free, leaving {wound}.',
      'The {limb} lands with a wet slap and {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} catches {tgt} across the {part} and {hitv} deep, leaving {wound} and a slick of slime.'
    ],
    miss: ['The {limb} slaps the floor beside {tgt} with a wet smack and retracts in a ripple of muscle.', 'The strike cracks across a pillar behind {tgt}, flinging slime across the stone.', 'The {limb} snaps shut around empty air and slides back with a sound like a drain.'],
    crit: ['The {limb} lashes in a perfect strike, then clamps and squeezes like a closing fist before flinging {tgt} aside.'],
    fumble: ['The {limb} tangles itself in a knot and spasms, slapping weakly at the floor.']
  };
  M.constrict = {
    kind: 'melee', group: 'natural', act: ['the crushing grip', 'the squeeze', 'the coil', 'the hug'], limb: ['coils', 'arms', 'powerful arms', 'tendrils'],
    windup: [
      '{Subj}\'s {limb} loosen and slither, coils sliding over each other with a sound like wet rope.',
      '{Subj} {v:spread} {their} arms wide in a mockery of an embrace, {limb} flexing, joints popping.',
      'A slow, dreadful tightening: {subj} {v:close} in, {limb} rippling and ready to wrap.',
      '{Subj} {v:lunge} low and {v:reach}, {their} {limb} unfolding to cage {tgt}.'
    ],
    motion: [
      'The {limb} whip around {tgt} in an instant and begin to tighten, each turn pulling harder.',
      '{Subj} {v:envelop} {tgt} in an iron embrace, {their} {limb} cinching like a belt around the chest.',
      'A crushing grip clamps down, slow and relentless, the {limb} ratcheting tighter by the heartbeat.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, ribs creaking and breath wheezing out, leaving {wound}.',
      'The {limb} lock and squeeze; {act} {hitv} {tgtPoss} {part}, leaving {wound} and driving the breath out of {them}.',
      '{Act} tightens until armor groans and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {limb} snap shut on air as {tgt} twists out of reach, leaving only a cold slither of sound.', '{Tgt} slips under the {limb} and out of the coil before it can tighten.', 'The grip closes a heartbeat too late, and {tgt} wrenches free with a gasp.'],
    crit: ['The embrace closes perfectly and tightens with a crack of bone, nearly folding {tgt} in half.'],
    fumble: ['{Subj} {v:coil} too eagerly and {v:knot} {their} own limbs together, thrashing.']
  };
  M.engulf = {
    kind: 'melee', group: 'natural', act: ['the engulfing rush', 'the gulp', 'the smothering surge', 'the swallow'], limb: ['maw', 'body', 'gelatinous bulk', 'throat'],
    windup: [
      '{Subj} {v:gape} impossibly wide, a dark cavern of a {limb} opening over {tgt} with a long, wet stretch.',
      '{Subj} {v:swell} and {v:bulge}, {their} {limb} quivering, rising like a wave about to break.',
      'A yawning, wet darkness opens in {subj}, ribbed and glistening, and the air rushes toward it.',
      '{Subj} {v:surge} up and over, a tide of slick, glistening bulk poised above {tgt}.'
    ],
    motion: [
      '{Subj} {v:lunge} and the {limb} engulfs {tgt} whole in a single, sucking gulp.',
      'The bulk of {subj} crashes down, folding over {tgt} like a wave over a sandcastle.',
      '{Subj} {v:flow} forward and {v:wrap} around {tgt}, the slick, heavy flesh closing like a fist.'
    ],
    hit: [
      '{Act} closes over {tgt}, and {act} {hitv} {tgtPoss} {part} in the darkness, leaving {wound}.',
      '{Tgt} is swallowed in a gulp and {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      'The world goes dark and wet and tight; {act} {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {limb} slams shut on air a heartbeat after {tgt} dives clear, a long string of slime snapping between its edges.', 'The bulk crashes down on the floor beside {tgt}, and a wave of foul fluid splashes across their boots.', '{Tgt} scrabbles clear of the maw by a hair, a slick of mucus whipping past.'],
    crit: ['The engulf is perfect: {tgt} vanishes into the throat in a single gulp, the walls clenching around {them} like a fist.'],
    fumble: ['{Subj} {v:gulp} and {v:swallow} a mouthful of rubble instead, coughing grit in a bubble of slime.']
  };
  M.touch = {
    kind: 'melee', group: 'natural', act: ['the touch', 'the grasp', 'the caress', 'the kiss', 'the drain'], limb: ['hand', 'cold hand', 'skeletal hand', 'bony hand'],
    windup: [
      '{Subj} {v:drift} close, {their} {limb} reaching slowly and almost tenderly toward {tgt}.',
      '{Subj} {v:extend} a {limb}, fingers curled like dry roots, a faint sound of whispering coming from {aThem}.',
      '{Subj} {v:glide} in, silent, the air chilling by degrees as {their} {limb} reaches out.',
      '{Subj} {v:smile} with horrible patience and {v:lift} {their} {limb} toward {tgt}.'
    ],
    motion: [
      '{Subj} {v:lunge} suddenly and {v:grab} {tgt}, {their} {limb} clamping with unnatural strength.',
      'The {limb} brushes {tgtPoss} skin with an almost gentle contact, and something vital begins to pour out.',
      '{Subj} {v:press} {their} {limb} to {tgt}, and the contact lingers a heartbeat too long.',
      'The reaching {limb} closes in a long, silent, certain movement that cannot be avoided without effort.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, a cold, draining contact that leaves {wound}.',
      'Contact is brief and cold: {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      'The {limb} stays on {tgt} an instant too long; {act} {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {limb} brushes {tgtPoss} sleeve and draws back as if singed, empty.', '{Tgt} twists out of reach and the grasping fingers close on cloth.', 'The touch falls an inch short, leaving a smear of frost on {tgtPoss} armor.'],
    crit: ['The touch finds bare skin and lingers, and a long, shuddering chill passes through {tgt} to the marrow.'],
    fumble: ['{Subj} {v:reach} too far and {v:topple} forward, {their} {limb} slapping the floor.']
  };
  M.beak = {
    kind: 'melee', group: 'natural', act: ['the peck', 'the stab of the beak', 'the stab', 'the strike'], limb: ['beak', 'hooked beak', 'bill', 'sharp beak'],
    windup: [
      '{Subj} {v:cock} {their} head, one eye fixed on {tgt}, the {limb} twitching like a drawn dagger.',
      '{Subj} {v:hiss} and {v:mantle} {their} wings, the {limb} opening in a rasping, shrieking cry.',
      '{Subj} {v:bob} {their} head, measuring the distance in short, sharp jerks.'
    ],
    motion: [
      '{Subj} {v:strike} like a lance, head darting out on a lightning neck, the {limb} stabbing in.',
      'The {limb} hammers down in a woodpecker rhythm, three, four, five stabs in a second.',
      'A {limb} jabs forward with a hard, tearing yank.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, the {limb} tearing a strip of flesh free, leaving {wound}.',
      'The {limb} stabs deep; {act} {hitv} {tgtPoss} {part} and leaves {wound}.',
      '{Act} {hitv} {tgtPoss} {part} with a hard, wet jab, leaving {wound}.'
    ],
    miss: ['The {limb} cracks against the floor beside {tgt}, striking sparks off the stone.', 'The stab glances off {tgtPoss} helm with a bright, ringing clang.', '{Tgt} jerks back and the {limb} snaps shut on empty air.'],
    crit: ['The {limb} finds an eye-slit or a gap in the plate and punches deep with a wet, tearing crunch.'],
    fumble: ['{Subj} {v:jab} at {tgt} and {v:drive} {their} {limb} into the stone, squawking in pain and rage.']
  };
  M.pincer = {
    kind: 'melee', group: 'natural', act: ['the pinch', 'the snap of the pincer', 'the clamp', 'the shearing bite'], limb: ['pincers', 'mandibles', 'claws', 'shearing jaws'],
    windup: [
      '{Subj} {v:raise} {their} {limb}, clicking them together with a sound like a pair of shears.',
      '{Subj} {v:scuttle} in sideways, {limb} spread wide and snapping.',
      '{Subj} {v:clack} {their} {limb} in a steady, ugly rhythm as the pale eyes track {tgt}.'
    ],
    motion: [
      'The {limb} snap shut with a scissor-sharp crack and a jolt of chitin on chitin.',
      '{Subj} {v:lunge} sideways, {limb} stabbing forward and clamping like a trap.',
      'The {limb} close like a vise and begin to squeeze.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, the {limb} shearing in and grinding, leaving {wound}.',
      'The {limb} clamp and twist; {act} {hitv} {tgtPoss} {part} and leaves {wound}.',
      '{Act} lands with a crunch of splitting armor and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {limb} clack shut inches from {tgtPoss} throat, the sound ringing off the walls.', 'The claw snaps on {tgtPoss} shield with a bang that rattles the arm behind it.', '{Tgt} jerks back and the {limb} pinch off nothing but cloak.'],
    crit: ['The {limb} lock on and squeeze until something gives with a wet, grinding crack.'],
    fumble: ['{Subj} {v:snap} {their} {limb} shut on a rock and {v:recoil}, clicking in disgust.']
  };
  M.rend = {
    kind: 'melee', group: 'natural', act: ['the flurry', 'the savaging', 'the tearing assault', 'the frenzy'], limb: ['claws and fangs', 'claws', 'teeth and claws', 'limbs'],
    windup: [
      '{Subj} {v:drop} into a crouch, hackles rising, a rumbling growl climbing toward a snarl.',
      '{Subj} {v:rock} back and forth in a frenzied pre-spring wobble, {limb} flexing.',
      '{Subj} {v:go} wide-eyed and still for half a heartbeat, then {v:bunch} like a drawn spring.'
    ],
    motion: [
      '{Subj} {v:explode} into motion, a blur of {limb} tearing and slashing in a savage, rapid flurry.',
      'A whirlwind of strikes: {limb} rake, snap and tear in a blur that is more storm than creature.',
      '{Subj} {v:fall} on {tgt} in a frenzy of {limb}.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part} again and again, leaving {wound}.',
      'It is over in a heartbeat: {act} {hitv} {tgtPoss} {part} from three angles at once, leaving {wound}.',
      'A frenzy of blows lands and {act} {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The flurry tears the air to ribbons around {tgt}, scraping armor but finding no flesh.', 'Claws slash the stone and teeth snap the air as {tgt} weaves clear of the worst.', '{Tgt} drops behind {tTheir} shield and the flurry rains off it, a hammering clangor.'],
    crit: ['The frenzy finds a gap and goes through it, shredding armor and flesh in one continuous, terrible burst.'],
    fumble: ['{Subj} {v:tangle} in {their} own frenzy and {v:crash} into the floor, thrashing.']
  };

  // ============================ HELD WEAPONS ============================
  // 'instr' pools name the weapon; 'wpart' pools name its business end; 'grip' pools describe hands and handles.
  M.blade = {
    kind: 'melee', group: 'weapon', act: ['the cut', 'the slash', 'the stroke', 'the swing'], limb: ['blade', 'sword', 'steel'],
    windup: [
      '{Subj} {v:draw} {their} {instr} back, {wpart} catching the light, {pose}.',
      '{Subj} {v:roll} {their} wrist and {v:let} the {wpart} of the {instr} trace a slow, deliberate circle.',
      '{Subj} {v:slide} into a stance with the {instr} low and ready, {pace}.',
      '{Subj} {v:test} {their} grip on the {instr}, eyes measuring {tgt} from head to boot.',
      '{Subj} {v:raise} the {instr} overhead, {wpart} tilting to catch the light.'
    ],
    motion: [
      '{Subj} {v:step} in and {v:cut}, the {wpart} hissing through the air in a clean, diagonal arc.',
      'The {instr} flashes out in a quick, flicking slash, followed at once by a second, rising stroke.',
      '{Subj} {v:lunge} and {v:sweep} the {instr} around, the strike coming in a flat, whistling line.',
      'Steel sings as the {instr} descends in a looping overhead chop.',
      '{Subj} {v:pivot} and {v:swing}, the {wpart} streaking toward {tgt} in a flash of reflected light.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, the {wpart} biting in and dragging free, leaving {wound}.',
      'The {instr} finds its mark; {act} {hitv} {tgtPoss} {part} and leaves {wound}.',
      'Steel bites through armor and {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} lands with a flat, crunching clang and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {wpart} hisses past {tgtPoss} cheek and rings off a pillar in a shower of sparks.', '{Tgt} parries at the last instant and the blades shriek along each other in a spray of sparks.', 'The stroke slices the air a finger-width from {tgtPoss} throat and finds only a swinging cloak.', 'The {instr} glances off {tgtPoss} armor with a bright, screaming scrape.'],
    crit: ['The {wpart} finds the gap between plates and drives deep, the whole weight of the strike behind it.', 'A flawless, ringing cut that opens {tgtPoss} guard wide and leaves {them} reeling.'],
    fumble: ['The {instr} bites into a beam and sticks, and {subj} {v:wrench} at it with a curse.', '{Subj} {v:overswing}, the {wpart} ringing on stone and jarring {their} wrist.']
  };
  M.shortblade = {
    kind: 'melee', group: 'weapon', act: ['the stab', 'the cut', 'the quick slash', 'the thrust'], limb: ['blade', 'knife', 'dagger'],
    windup: [
      '{Subj} {v:flick} the {instr} from hand to hand, the {wpart} winking, {pace}.',
      '{Subj} {v:slide} close and low, the {instr} held reversed against the forearm, {pose}.',
      '{Subj} {v:drift} in sideways, the {instr} a glint at the edge of sight.',
      '{Subj} {v:crouch}, one hand out, the other hiding the {instr} behind a hip.'
    ],
    motion: [
      'The {instr} flickers out in three quick stabs, almost too fast to follow.',
      '{Subj} {v:dart} in under {tgtPoss} guard and {v:rip} the {wpart} up and across in a short, sharp slash.',
      '{Subj} {v:spin} and the {instr} snaps in a slicing, close-quarters arc.',
      'A blur of motion and the {wpart} stabs in, withdraws, and stabs again.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, the {wpart} slipping between plates, leaving {wound}.',
      'The {instr} slides in with a hiss; {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} lands quick and precise and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {wpart} flicks past {tgtPoss} ribs, close enough to nick the cloth.', '{Tgt} twists and the stab skates off {tTheir} armor with a thin, bright scrape.', 'The thrust stabs air and the {instr} snaps back, ready to try again.'],
    crit: ['The {wpart} slides through a gap and finds something soft and vital, and {subj} {v:twist} it with surgical cruelty.'],
    fumble: ['The {instr} snags on {tgtPoss} cloak and {subj} {v:lose} {their} grip, the blade spinning away across the floor.']
  };
  M.greatblade = {
    kind: 'melee', group: 'weapon', act: ['the great cleave', 'the sweeping cut', 'the heavy stroke', 'the two-handed swing'], limb: ['greatsword', 'broadsword', 'massive blade'],
    windup: [
      '{Subj} {v:plant} {their} feet and {v:haul} the {instr} back over one shoulder with both hands, every muscle winding tight.',
      '{Subj} {v:swing} the {instr} up in a slow, heavy arc, the {wpart} blotting out the light.',
      '{Subj} {v:lift} the {instr} two-handed, the long blade trembling with the strain, {pose}.',
      '{Subj} {v:spin} the {instr} once around {their} head in a rushing, air-splitting hum.'
    ],
    motion: [
      'The {instr} comes around in a wide, flat arc, wide enough to carve a doorframe in two.',
      '{Subj} {v:bring} the {instr} down in a crushing, two-handed chop that splits the air with a roar.',
      '{Subj} {v:step} through the swing, the {wpart} sweeping with an almost lazy, terrible speed.',
      'The {instr} falls like a headsman\'s blade, whistling.'
    ],
    hit: [
      '{Act} cleaves in and {hitv} {tgtPoss} {part}, the {wpart} grinding through armor, leaving {wound}.',
      'The great blade lands with a heavy, ringing crunch; {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} {hitv} {tgtPoss} {part} in a single, thunderous stroke, leaving {wound}.'
    ],
    miss: ['The {instr} whistles past {tgtPoss} head and buries a hand\'s depth into the flagstones, ringing like a bell.', '{Tgt} drops flat and the sweep shaves the air an inch above, flinging up a cold, hissing wind.', 'The stroke splits a pillar behind {tgt} and sends a shower of chips across the floor.'],
    crit: ['The great blade comes down in a perfect, shearing cleave and leaves the armor split like a ripe fruit.'],
    fumble: ['The {instr} bites deep into the floor and sticks, and {subj} {v:heave} at it, face reddening.']
  };
  M.axe = {
    kind: 'melee', group: 'weapon', act: ['the chop', 'the hack', 'the cleaving blow', 'the swing'], limb: ['axe', 'hatchet', 'battleaxe'],
    windup: [
      '{Subj} {v:hoist} the {instr} to one shoulder, the {wpart} gleaming, and {v:grin} like a woodcutter eyeing a tree.',
      '{Subj} {v:spin} the {instr} once in a casual, lethal figure-eight, {pose}.',
      '{Subj} {v:square} up with the {instr} drawn back, the {wpart} hanging like a promise.',
      '{Subj} {v:heft} the {instr} and {v:take} a measured, deliberate half-step forward.'
    ],
    motion: [
      '{Subj} {v:swing}, the {wpart} descending in a short, chopping blur and a rasp of cutting air.',
      'The {instr} sweeps around in a savage side-chop, the {wpart} humming.',
      '{Subj} {v:hammer} the {instr} down with a lumberjack\'s overhand chop.',
      'The {instr} comes in with a flat crunch of weight and wind.'
    ],
    hit: [
      '{Act} bites in and {hitv} {tgtPoss} {part}, the {wpart} lodging before it wrenches free, leaving {wound}.',
      'The {wpart} chops deep; {act} {hitv} {tgtPoss} {part} with a meaty thunk, leaving {wound}.',
      '{Act} lands like a woodsman\'s stroke and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {wpart} bites into a post beside {tgt} with a bang and a shower of splinters.', '{Tgt} throws up a shield and the {instr} lands with a bell-like clang, the shock shuddering through {tTheir} arm.', 'The chop glances off {tgtPoss} armor in a skidding shriek of sparks.'],
    crit: ['The {wpart} comes down just right, biting through armor and burying itself in the flesh beneath with a hideous crunch.'],
    fumble: ['The {instr} sticks fast in a timber beam, and {subj} {v:strain} and {v:curse}, trying to drag it free.']
  };
  M.greataxe = {
    kind: 'melee', group: 'weapon', act: ['the great chop', 'the cleaving blow', 'the heavy hack', 'the crushing swing'], limb: ['greataxe', 'great axe', 'heavy axe'],
    windup: [
      '{Subj} {v:haul} the {instr} up over {their} head with both hands, the {wpart} blotting out the light.',
      '{Subj} {v:roar} and {v:whirl} the {instr} in a rushing circle, the {wpart} humming.',
      '{Subj} {v:plant} {their} feet wide and {v:lean} back, the {instr} balanced for a single, murderous chop.',
      '{Subj} {v:wind} up, shoulders rolling, the {instr} hanging behind {aThem} like a pendulum of doom.'
    ],
    motion: [
      'The {instr} falls in a crushing overhand chop that makes the air itself scream.',
      '{Subj} {v:swing} the {instr} in a sweeping, two-handed arc, the {wpart} blurring.',
      '{Subj} {v:bring} the {wpart} down with the full weight of {their} {frame} behind it.',
      'The {instr} crashes down like a felled tree.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part} in a great, crunching chop, the {wpart} cleaving through, leaving {wound}.',
      'The {instr} lands with a sound like splitting timber; {act} {hitv} {tgtPoss} {part} and leaves {wound}.',
      '{Act} drives the {wpart} in deep and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {wpart} buries itself in the floor beside {tgt}, throwing up stone and splitting a flagstone down the middle.', 'The axe screams past {tgtPoss} ear and shears a pillar in two with a crack like cannon-fire.', '{Tgt} dives aside as the great blade crashes down, shaking the whole room.'],
    crit: ['The great {wpart} falls like a headsman\'s blade, shearing through armor, flesh and bone in one terrible stroke.'],
    fumble: ['The {instr} embeds in the floor to the haft and {subj} {v:strain} to pull it free, bellowing.']
  };
  M.hammer = {
    kind: 'melee', group: 'weapon', act: ['the blow', 'the crushing smash', 'the heavy strike', 'the hammer-fall'], limb: ['hammer', 'maul', 'warhammer'],
    windup: [
      '{Subj} {v:swing} the {instr} up over {their} shoulder, the {wpart} dragging {their} arm back.',
      '{Subj} {v:drop} the {wpart} of the {instr} to the floor with a thud and {v:lean} on it, grinning.',
      '{Subj} {v:heft} the {instr} two-handed and {v:set} {their} stance, {pose}.',
      '{Subj} {v:whirl} the {instr} in a slow, heavy circle, the {wpart} humming like a bell.'
    ],
    motion: [
      '{Subj} {v:slam} the {instr} down in an overhand blow that crosses the distance like a falling anvil.',
      'The {wpart} comes around in a pounding horizontal swing, flat and heavy.',
      '{Subj} {v:smash} the {instr} forward in a short, brutal strike that comes up from the hip.',
      'The {instr} falls with an iron crash.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part} with a booming crunch, the {wpart} leaving {wound}.',
      'The {instr} lands square; {act} {hitv} {tgtPoss} {part} and leaves {wound}.',
      '{Act} rings off armor and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {wpart} craters the floor beside {tgt}, a thunderous boom that shivers the room.', '{Tgt} dodges and the {instr} flattens a table into splinters.', 'The swing shatters a stone bench and showers {tgt} with chips.'],
    crit: ['The {wpart} lands dead on {tgtPoss} helm or breastplate with a bell-toll crash that carries the ringing of bone-breaking.'],
    fumble: ['The {instr} overbalances {subj} and {v:drag} {aThem} stumbling past {tgt}, hammer ringing on the floor.']
  };
  M.club = {
    kind: 'melee', group: 'weapon', act: ['the bash', 'the clubbing blow', 'the thump', 'the smash'], limb: ['club', 'cudgel', 'staff', 'bone club'],
    windup: [
      '{Subj} {v:slap} the {instr} against a palm, a dull thump of promise, {pose}.',
      '{Subj} {v:swing} the {instr} up onto a shoulder, the {wpart} bobbing.',
      '{Subj} {v:choke} up on the {instr} and {v:lick} {their} lips, eyes tracking {tgt}.',
      '{Subj} {v:heft} the {instr} and {v:grunt} like someone about to split a log.'
    ],
    motion: [
      '{Subj} {v:swing} the {instr} in a wild, heavy arc that looks clumsy until it lands.',
      'The {wpart} whips around in a hard, simple bash.',
      '{Subj} {v:smash} the {instr} down in a chopping blow like someone driving a stake.',
      '{Subj} {v:lurch} forward and {v:crack} the {instr} across in a hard, flat swing.'
    ],
    hit: [
      '{Act} cracks into {tgtPoss} {part} and {hitv} deep, leaving {wound}.',
      'The {wpart} thuds home; {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} lands with a meaty crack and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {instr} whistles past {tgtPoss} ear and thumps against the wall, bouncing off with a hollow crack.', 'The swing glances off {tgtPoss} shield with a hollow bong that numbs the arm.', '{Tgt} ducks and the {instr} smashes a jug on a shelf, spraying shards.'],
    crit: ['The {wpart} cracks across {tgtPoss} skull or ribs with a sound like splitting wood, the full weight of the swing behind it.'],
    fumble: ['The {instr} flies out of {subj}\'s hand and clatters across the floor, leaving {aThem} empty-handed and snarling.']
  };
  M.mace = {
    kind: 'melee', group: 'weapon', act: ['the blow', 'the crushing strike', 'the swing', 'the bash'], limb: ['mace', 'morningstar', 'flail', 'spiked club'],
    windup: [
      '{Subj} {v:swing} the {instr} in a slow, easy circle, the {wpart} humming through the air.',
      '{Subj} {v:flex} {their} grip on the {instr}, the {wpart} glinting with old, dark stains.',
      '{Subj} {v:heft} the {instr} high, spikes catching the light, {pose}.',
      '{Subj} {v:advance} with the {instr} cocked back, the {wpart} swaying like a pendulum.'
    ],
    motion: [
      'The {instr} whips around in a hard, hissing swing, the {wpart} leaving a whirl of afterimage.',
      '{Subj} {v:slam} the {instr} in an overhand blow, the {wpart} dropping like a hammer.',
      '{Subj} {v:snap} the {instr} out on a short, savage chain-whip arc.',
      'The {wpart} comes in with a ringing, clanging crash.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, the {wpart} crunching in, leaving {wound}.',
      'The {instr} finds its mark with a bone-crunching clang; {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} crashes into armor, and then through it, and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {wpart} crashes into the wall beside {tgt} in a shower of sparks and chips.', '{Tgt} deflects the swing with a shield and the {instr} rings off it like a gong.', 'The {instr} scrapes along {tgtPoss} pauldron with a shriek and spins away.'],
    crit: ['The {wpart} lands in a spray of ringing sparks, crushing helm and skull in a single, crunching blow.'],
    fumble: ['The chain or haft catches on something and the {instr} jerks back, whipping {subj} across the face.']
  };
  M.staff = {
    kind: 'melee', group: 'weapon', act: ['the strike', 'the sweep', 'the thwack', 'the blow'], limb: ['staff', 'quarterstaff', 'rod', 'scepter'],
    windup: [
      '{Subj} {v:twirl} the {instr} in a whirring blur and {v:come} to rest in a guard, {pose}.',
      '{Subj} {v:plant} the {wpart} of the {instr} on the floor with a hollow knock, eyes on {tgt}.',
      '{Subj} {v:slide} the {instr} through {their} hands, measuring the reach, {pace}.',
      '{Subj} {v:rest} the {instr} across {their} shoulders, then {v:roll} it down into a low, lazy guard.'
    ],
    motion: [
      'The {instr} whips out in a short, jabbing thrust followed by a flat, sweeping blow.',
      '{Subj} {v:spin} the {instr} and {v:crack} it down in a hard, chopping blow.',
      'The {wpart} comes up from below in a rising, rapping strike.',
      '{Subj} {v:rap} out a quick, ringing flurry of three blows.'
    ],
    hit: [
      '{Act} cracks into {tgtPoss} {part} with a hollow, hard thwack, leaving {wound}.',
      'The {wpart} lands with a stinging crack; {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} lands in a tight, ringing rap and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {wpart} whistles past {tgtPoss} ear and raps the stone beside {them} with a bright crack.', '{Tgt} catches the {instr} on a raised forearm and the shock rings up the bone.', 'The thrust skates off {tgtPoss} breastplate with a squeal.'],
    crit: ['The {wpart} lands with an ugly crack right on the point of the jaw or the elbow, with a force far out of proportion to its size.'],
    fumble: ['The {instr} snaps in two against a doorframe, and {subj} {v:stare} at the splintered half in {their} hands.']
  };
  M.spear = {
    kind: 'melee', group: 'weapon', act: ['the thrust', 'the stab', 'the lunge', 'the jab'], limb: ['spear', 'pike', 'trident', 'pitchfork', 'lance'],
    windup: [
      '{Subj} {v:level} the {instr} at {tgt}, the {wpart} steady and glinting, {pose}.',
      '{Subj} {v:slide} {their} grip back along the {instr} and {v:crouch}, the {wpart} steady as a compass needle.',
      '{Subj} {v:set} the butt of the {instr} against the floor and {v:angle} the {wpart} toward {tgt}.',
      '{Subj} {v:shuffle} forward, the {instr} swinging slightly, {wpart} flickering.'
    ],
    motion: [
      '{Subj} {v:lunge}, the {instr} stabbing out in a straight, driving line that gains a body-length in an instant.',
      'The {wpart} jabs three times in quick, rapping succession.',
      '{Subj} {v:drive} the {instr} forward in a flat, shoving thrust with all {their} weight behind it.',
      'The {instr} snaps out and back like a striking snake.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, the {wpart} punching deep, leaving {wound}.',
      'The {wpart} lands with a hard, wet punch; {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} drives in under {tgtPoss} guard and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {wpart} stabs past {tgtPoss} flank so closely that it nicks the fabric, then thuds into the wall.', '{Tgt} knocks the {instr} aside with a shield and the {wpart} drags a line of sparks along the floor.', 'The thrust is quick, but {tgt} twists and it finds only air.'],
    crit: ['The {wpart} finds the gap between breastplate and gorget and drives home, and {subj} {v:lift} {tgt} off the ground with the thrust.'],
    fumble: ['The {wpart} sticks in the wall and the shaft jars back into {subj}\'s ribs.']
  };
  M.polearm = {
    kind: 'melee', group: 'weapon', act: ['the sweep', 'the hooked blow', 'the cleaving swing', 'the thrust'], limb: ['glaive', 'halberd', 'pike', 'scythe'],
    windup: [
      '{Subj} {v:swing} the long {instr} in a wide, slow arc, the {wpart} drawing a ring in the air.',
      '{Subj} {v:brace} the haft against {their} hip and {v:aim} the {wpart} high, the whole length of the weapon quivering.',
      '{Subj} {v:twirl} the {instr} with an ease that makes the long reach seem like nothing.',
      '{Subj} {v:hold} the {instr} out at the end of {their} arms, the {wpart} pinning {tgt} at the far edge of reach.'
    ],
    motion: [
      'The {wpart} sweeps in on a long, curving arc that covers the distance before {tgt} can move.',
      '{Subj} {v:hook} {tgtPoss} guard aside with the {wpart} and {v:rip} the {instr} back, bladed edge raking.',
      '{Subj} {v:chop} the {instr} down in a long, whistling overhand.',
      '{Subj} {v:stab} the {instr} out and {v:wrench} it in a shearing twist.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part} from beyond a sword\'s reach, the {wpart} leaving {wound}.',
      'The {wpart} hooks and rips; {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} lands with the whole length of the shaft behind it and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {wpart} sweeps past {tgt} and cuts a tapestry from its pegs in a shower of dust.', '{Tgt} steps inside the long reach and the haft thumps harmlessly against their shoulder.', 'The chop buries itself in the doorframe above {tgtPoss} head.'],
    crit: ['The {wpart} hooks the guard aside and then slides home along the opening, deep and clean.'],
    fumble: ['The {wpart} catches on a rafter and the haft whips out of {subj}\'s grip, clattering across the floor.']
  };
  M.whip = {
    kind: 'melee', group: 'weapon', act: ['the lash', 'the whipcrack', 'the stinging strike', 'the flick'], limb: ['whip', 'lash', 'chain', 'scourge', 'barbed chain'],
    windup: [
      '{Subj} {v:coil} the {instr} in a loose loop and {v:flick} it, the {wpart} dancing along the floor like a serpent.',
      'The {instr} sways in the air behind {subj}, the tip circling lazily, {pose}.',
      '{Subj} {v:crack} the {instr} once into the air, a warning that rings like a gunshot.',
      '{Subj} {v:draw} the {instr} back in a long, rippling curve, wrist cocked.'
    ],
    motion: [
      'The {instr} snaps forward in a long, singing arc and the {wpart} cracks across the distance with a sound like splitting canvas.',
      'The {wpart} streaks in, coils for a heartbeat and then pulls back with a hard, stinging flick.',
      '{Subj} {v:lash} the {instr} around in a whirling spiral that leaves a trail of cracks in the air.',
      'The {instr} lunges out and snaps back, quicker than a snake.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, the {wpart} biting and wrapping before whipping free, leaving {wound}.',
      'The {instr} cracks home; {act} {hitv} {tgtPoss} {part} with a sharp, searing sting, leaving {wound}.',
      '{Act} lands with a retort like a gunshot and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {wpart} cracks past {tgtPoss} ear with a deafening snap and draws a line of dust from the wall.', '{Tgt} steps inside the lash and the {instr} wraps harmlessly around a pillar.', 'The {instr} snaps against {tgtPoss} shield and slides off with a hissing slither.'],
    crit: ['The {wpart} wraps {tgtPoss} arm and sinks in deep, then yanks {them} off balance with a vicious tug.'],
    fumble: ['The {instr} snags on a hook and cracks back to {subj} like an angry snake.']
  };
  M.shield = {
    kind: 'melee', group: 'weapon', act: ['the bash', 'the shield slam', 'the shove', 'the shield-punch'], limb: ['shield', 'bossed shield', 'spiked shield', 'heavy shield'],
    windup: [
      '{Subj} {v:hunch} behind the {instr} and {v:drive} forward, boots shuffling, {pose}.',
      '{Subj} {v:tuck} {their} shoulder behind the {instr}, the {wpart} thrust out like a battering ram.',
      '{Subj} {v:slam} the {instr} against the floor with a boom of warning.'
    ],
    motion: [
      '{Subj} {v:charge} behind the {instr}, the {wpart} first, slamming forward with the whole body behind it.',
      '{Subj} {v:punch} the {instr} out in a short, hard bash, boss first.',
      'The {instr} sweeps around in a flat, hammering swing that catches {tgt} on the arm.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part} with a thunderous crash, leaving {wound}.',
      'The {wpart} hammers home and {act} {hitv} {tgtPoss} {part}, leaving {wound} and driving {them} back.',
      '{Act} lands with a boom, and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The shield slams a pillar, shuddering with a booming clang as {tgt} jumps away.', '{Tgt} sidesteps and the {instr} bounces off the stone with a hollow bong.', 'The bash glances off {tgtPoss} shoulder and swings wide.'],
    crit: ['The {wpart} lands square, knocking the wind out of {tgt} and driving {them} to the floor.'],
    fumble: ['The {instr} slips and {subj} {v:stumble} forward under the weight of it.']
  };
  M.pick = {
    kind: 'melee', group: 'weapon', act: ['the strike', 'the pick-blow', 'the hooked stab', 'the crack'], limb: ['pick', 'war pick', 'pickaxe', 'sickle', 'scythe'],
    windup: [
      '{Subj} {v:heft} the {instr}, its {wpart} hooked like a talon, and {v:test} the swing.',
      '{Subj} {v:swing} the {instr} up with a grunt, the {wpart} gleaming.',
      '{Subj} {v:crouch} behind the {instr}, the {wpart} angled to punch through armor.'
    ],
    motion: [
      '{Subj} {v:slam} the {instr} down so the {wpart} comes in point-first, like a falling bird of prey.',
      'The {wpart} whips in on a curving arc and drives for the gap in {tgtPoss} armor.',
      '{Subj} {v:hook} the {instr} in a short, brutal swing.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, the {wpart} punching through plate, leaving {wound}.',
      'The {wpart} bites in with a crack; {act} {hitv} {tgtPoss} {part} and leaves {wound}.',
      '{Act} lands in a tight, precise blow that {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {wpart} rings off a pillar beside {tgt} and sends a spray of chips whirling.', '{Tgt} twists and the {instr} skids across {tTheir} breastplate, leaving a long, bright scratch.', 'The swing sinks into a beam and sticks with a thud.'],
    crit: ['The {wpart} punches clean through the plate with a bang like a dropped anvil.'],
    fumble: ['The {wpart} sinks into stone and sticks; {subj} {v:rattle} it back and forth, cursing.']
  };

  // ============================ PROJECTILES ============================
  M.bow = {
    kind: 'ranged', group: 'weapon', act: ['the arrow', 'the shot', 'the volley', 'the arrow-strike'], limb: ['bow', 'longbow', 'shortbow', 'warbow'],
    windup: [
      '{Subj} {v:nock} an arrow and {v:draw} the {instr} to the ear, the string creaking, {pose}.',
      '{Subj} {v:plant} {their} feet, {v:lift} the {instr} and {v:sight} along the shaft, breath held.',
      '{Subj} {v:slide} an arrow from the quiver in a single, practiced motion and {v:settle} the nock on the string.',
      '{Subj} {v:track} {tgt} with the {instr}, the arrowhead drifting with every step they take.'
    ],
    motion: [
      'The string snaps with a flat, ringing thrum and the arrow streaks across {range} in a blur of grey.',
      '{Subj} {v:release}, the {instr} humming, and the arrow crosses the gap with a whispering hiss.',
      'Arrow after arrow leaps from the {instr}, each one chasing the last in a steady, rhythmic whine.',
      'The shot lofts, drops and comes down in a long, whistling curve.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part} with a hard, thudding punch, leaving {wound}.',
      'The shaft quivers where it lands; {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} hits with a wet thunk and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The arrow whispers past {tgtPoss} ear and thuds into the wall behind {them}, humming.', 'The shot skips off {tgtPoss} armor in a spray of sparks and whines away into the dark.', 'The arrow lands a foot short, quivering in the dirt.', 'The arrow tugs at {tgtPoss} cloak and pins it to a post, nothing more.'],
    crit: ['The arrow finds the thin line between helm and gorget, and drops {tgt} like a stone.'],
    fumble: ['The bowstring snaps with a crack like a whip, and the arrow flies wild into the rafters.']
  };
  M.crossbow = {
    kind: 'ranged', group: 'weapon', act: ['the bolt', 'the shot', 'the quarrel', 'the bolt-strike'], limb: ['crossbow', 'heavy crossbow', 'hand crossbow', 'light crossbow'],
    windup: [
      '{Subj} {v:crank} the {instr} with a ratcheting clatter, drop a short, thick bolt into the groove and {v:raise} it to {their} shoulder.',
      '{Subj} {v:steady} the {instr} on {their} forearm, finger curling around the trigger, eyes narrow.',
      '{Subj} {v:seat} a bolt with a click and {v:level} the {instr} at {tgt}.',
      '{Subj} {v:snap} the {instr} up in one smooth motion and {v:sight} down the stock.'
    ],
    motion: [
      'The trigger clacks and the bolt hurls itself across {range} with a flat, vicious whump.',
      'The string slaps the stock and the bolt flies in a blurred, straight line.',
      'A hard, dry crack and the quarrel leaps from the {instr}.',
      'The bolt hisses across the room, flat and fast as a thrown spike.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part} with a thud, leaving {wound}.',
      'The bolt hits like a thrown hammer; {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} punches through armor and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The bolt smacks into the wall by {tgtPoss} head and splinters with a crack.', 'The quarrel whines past {tgtPoss} ear and rings off a pillar.', 'The bolt skims {tgtPoss} shoulder and thuds into a barrel behind {them}.'],
    crit: ['The heavy bolt hits with the force of a mule\'s kick, punching through plate and pinning {tgt} in place.'],
    fumble: ['The latch slips and the bolt falls out of the groove with a pathetic clatter.']
  };
  M.sling = {
    kind: 'ranged', group: 'weapon', act: ['the stone', 'the sling-shot', 'the hurled stone', 'the shot'], limb: ['sling', 'stone', 'lead shot', 'sling-bullet'],
    windup: [
      '{Subj} {v:whirl} the {instr} over {their} head in a rising, whining hum, the loaded pouch a blur.',
      '{Subj} {v:swing} the {instr} in a steady, humming circle, {their} eyes tracking {tgt}.',
      '{Subj} {v:load} a smooth stone into the {instr} and {v:spin} it with a lazy, practiced arm.'
    ],
    motion: [
      '{Subj} {v:release}, and a stone leaps from the {instr} with a vicious whiz.',
      'The pouch snaps open and the stone screams across the distance, faster than the eye can follow.',
      'A hard crack and the shot flicks out of the {instr} like a tiny comet.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part} with a flat, hard crack, leaving {wound}.',
      'The stone strikes with a loud knock; {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} lands hard and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The stone whistles past {tgtPoss} head and cracks a pillar into a spiderweb of fractures.', 'The shot skips off the floor and dings away across the room.', '{Tgt} flinches as a stone whirs past their ear and clatters against the wall.'],
    crit: ['The stone lands right between the eyes, snapping {tgtPoss} head back with a crack like breaking pottery.'],
    fumble: ['The stone escapes too early and flies straight up, dropping harmlessly behind {subj}.']
  };
  M.thrown = {
    kind: 'ranged', group: 'weapon', act: ['the throw', 'the hurled weapon', 'the throw', 'the missile'], limb: ['javelin', 'spear', 'rock', 'boulder', 'dart', 'harpoon'],
    windup: [
      '{Subj} {v:draw} {their} arm back with the {limb}, a long, loose pose like a bowstring being drawn.',
      '{Subj} {v:heft} a {limb} and {v:squint} at {tgt}, rolling {their} shoulder with a pop.',
      '{Subj} {v:take} a running step, a {limb} cocked behind {their} head, {pose}.',
      '{Subj} {v:scoop} up a {limb} and {v:weigh} it, grinning, as if testing a toy.'
    ],
    motion: [
      '{Subj} {v:hurl} the {limb}, and it streaks across {range} in a long, whistling arc.',
      'The throw comes with a grunt, the {limb} spinning end over end across the gap.',
      '{Subj} {v:snap} {their} arm forward and the {limb} leaps away with a hard, flat whip of the wrist.',
      'A heavy, flat throw, and the {limb} drives toward {tgt} like a cannon-shot.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part} with a crunch, leaving {wound}.',
      'The {limb} lands hard; {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} strikes with a thud and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {limb} flies past {tgt} and strikes the wall behind with a crack, throwing chips.', 'The throw skips off the floor and clatters into a corner.', 'The {limb} whistles over {tgtPoss} shoulder and thuds into a pillar.'],
    crit: ['The {limb} flies true and lands with a crunch that carries the force of a catapult shot.'],
    fumble: ['The {limb} slips out of {subj}\'s hand and drops behind them with a dull thud.']
  };
  M.firearm = {
    kind: 'ranged', group: 'weapon', act: ['the shot', 'the blast', 'the discharge', 'the bolt of fire'], limb: ['pistol', 'musket', 'rifle', 'cannon', 'launcher', 'ballista'],
    windup: [
      '{Subj} {v:level} the {instr} and {v:cock} it with a metallic, oily click, a thread of smoke rising from the muzzle.',
      '{Subj} {v:brace} the {instr} against {their} shoulder and {v:squint}, one eye closed, finger tightening.',
      '{Subj} {v:sight} down the {instr}, the muzzle tracking {tgt} like the eye of a snake.'
    ],
    motion: [
      'The {instr} roars, belching smoke and flame, and the shot crosses the distance in a flat, tearing crack.',
      'A deafening bang rattles the room and the projectile punches out of the {instr} in a flash of light.',
      'A hollow whump and the {instr} kicks back, spewing sparks.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part} with a crack, leaving {wound}.',
      'The shot hits like a hammer; {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} slams in and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The shot smashes the wall behind {tgt} in a puff of stone dust and a ringing whine.', 'A fizzing crack and the projectile whizzes past, splitting a post.', 'The blast whines overhead and punches a ragged hole in a banner.'],
    crit: ['The shot slams in dead center, and the shock of it knocks {tgt} off {tTheir} feet.'],
    fumble: ['The {instr} misfires with a flat click and a puff of smoke.']
  };
  M.net = {
    kind: 'ranged', group: 'weapon', act: ['the throw', 'the cast', 'the net', 'the toss'], limb: ['net', 'weighted net', 'snare', 'lasso'],
    windup: [
      '{Subj} {v:swing} a {limb} in slow circles, weights whirring, eyes on {tgt}.',
      '{Subj} {v:unfurl} a {limb} in both hands, the weighted edges chiming softly.',
      '{Subj} {v:spread} the {limb} wide and {v:take} a measured step.'
    ],
    motion: [
      'The {limb} spreads wide in the air, a dark, whirling circle that drops over {tgt}.',
      '{Subj} {v:fling} the {limb} with a whirling cast, the weights spinning out in a ring.',
      'The {limb} hisses through the air and snaps out into a wide, black web.'
    ],
    hit: [
      '{Act} drops over {tgt} and drags, {hitv} {tgtPoss} {part} as it tightens, leaving {wound}.',
      'The {limb} wraps and cinches; {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} tangles {tgtPoss} limbs and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The {limb} flaps open and drops short, a sprawl of cord on the floor.', '{Tgt} twists out from under the edge of the {limb} and it settles on empty ground.', 'The {limb} catches on a pillar and hangs there, twitching.'],
    crit: ['The {limb} drops perfectly and snaps tight, binding {tgt} head to foot.'],
    fumble: ['The {limb} tangles in {subj}\'s own arms and drags {aThem} to a stumble.']
  };
  M.unarmed = {
    kind: 'melee', group: 'natural', act: ['the blow', 'the punch', 'the strike', 'the kick'], limb: ['fist', 'knuckles', 'palm', 'foot'],
    windup: [
      '{Subj} {v:square} up, fists rising, weight rolling onto the balls of {their} feet, {pose}.',
      '{Subj} {v:crack} {their} knuckles and {v:roll} {their} neck, a cold, patient stare fixed on {tgt}.',
      '{Subj} {v:step} in, one hand open and one closed, {pace}.'
    ],
    motion: [
      '{Subj} {v:throw} a hard, straight punch that lands with a sharp crack, then follows up with an elbow.',
      '{Subj} {v:whip} a kick up and around in a blur.',
      '{Subj} {v:close} the distance in a sliding step and {v:drive} a fist at {tgtPoss} ribs.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, a hard, thudding hit that leaves {wound}.',
      'The {limb} lands with a sharp crack and {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} {hitv} {tgtPoss} {part} with a meaty thump, leaving {wound}.'
    ],
    miss: ['The punch whistles past {tgtPoss} jaw and {subj} {v:grunt} in frustration.', '{Tgt} slips the blow and it lands on nothing but air.', 'The kick glances off {tgtPoss} guard with a flat smack.'],
    crit: ['The blow lands perfectly on the point of the chin, and {tgtPoss} head snaps back like a flag in a gale.'],
    fumble: ['{Subj} {v:swing} wildly and {v:stagger}, overbalanced.']
  };
  // generic fallback melee / ranged moves, used when nothing in the name or text says what the attack is
  M.strike = {
    kind: 'melee', group: 'natural', act: ['the blow', 'the strike', 'the attack', 'the assault'], limb: ['weapon', 'limb', 'fist'],
    windup: [
      '{Subj} {v:square} up to {tgt}, shifting {their} weight, {pose}.',
      '{Subj} {v:crouch}, muscles bunching, eyes locked on {tgt}.',
      '{Subj} {v:close} in, {pace}, an obvious intent in every motion.',
      '{Subj} {v:coil} and {v:measure} the distance, {their} attention fixed on {tgt}.'
    ],
    motion: [
      '{Subj} {v:strike}, {pace}, in a blur of motion that crosses the gap in an instant.',
      '{Subj} {v:lunge} and the attack comes in hard and fast.',
      '{Subj} {v:drive} forward in a ferocious, committed blow.',
      'The attack arrives in a rush of wind and violence.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      'The attack lands hard; {act} {hitv} {tgtPoss} {part} and leaves {wound}.',
      '{Act} gets through and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The attack misses by a hair, close enough that {tgt} feels the wind of it.', '{Tgt} slips the attack at the last instant and it spends itself on empty air.', 'The blow glances off {tgtPoss} armor with a bright, scraping sound.'],
    crit: ['The attack lands perfectly, through the gap in {tgtPoss} defense, with terrible effect.'],
    fumble: ['{Subj} {v:overreach} and {v:stumble}, the attack going wide.']
  };
  M.shot = {
    kind: 'ranged', group: 'weapon', act: ['the shot', 'the missile', 'the strike', 'the projectile'], limb: ['weapon', 'launcher'],
    windup: [
      '{Subj} {v:draw} a bead on {tgt}, patient and still, {pose}.',
      '{Subj} {v:take} aim, one eye closed, the {instr} steady.',
      '{Subj} {v:track} {tgt} across the field, waiting for the right instant.'
    ],
    motion: [
      'The shot streaks across {range} in a thin, whistling line.',
      'The missile leaps out and crosses the gap in a heartbeat.',
      'A sharp crack and the projectile is gone, whining toward {tgt}.'
    ],
    hit: [
      '{Act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      'The shot lands with a thud and {act} {hitv} {tgtPoss} {part}, leaving {wound}.',
      '{Act} hits and {hitv} {tgtPoss} {part}, leaving {wound}.'
    ],
    miss: ['The shot hisses past {tgtPoss} ear and thuds into the wall behind {them}.', 'The missile skips off a stone and spins away into the dark.', 'The shot goes wide, ringing off a pillar.'],
    crit: ['The shot lands true, finding the gap in {tgtPoss} defenses, with terrible effect.'],
    fumble: ['{Subj} {v:release} too soon and the shot flies wild.']
  };
})();
