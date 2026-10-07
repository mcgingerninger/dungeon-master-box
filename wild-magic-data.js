// The Wild Magic table: what happens when a "Confused (must roll on Wild Magic table each turn)" creature
// starts its turn, or when anything else in the app says "roll on the Wild Magic table".
// An original d100 table (50 entries, two numbers each): about one in five results helps, most are odd or
// mildly bad, and a few are dangerous. "The creature" is whoever is confused (or the caster, if a spell
// surged). Nothing here is tracked automatically — the DM applies the result.
// Window API: WildMagic.table, WildMagic.roll() -> { d100, entry }, WildMagic.lookup(n).
(function () {
  const R = (lo, hi, kind, text) => ({ lo, hi, kind, text });
  // kind: fun | good | bad | danger | odd
  const T = [
    R(1, 2, 'fun', 'Its hair and clothing stand on end and crackle with static for 1 minute.'),
    R(3, 4, 'fun', 'A small illusory animal of the DM\'s choosing trots behind it for 1 minute, then bursts into glitter.'),
    R(5, 6, 'odd', 'It forgets what it was doing: it stands perfectly still and smiles until the end of its turn.'),
    R(7, 8, 'odd', 'It swaps places with the nearest other creature within 30 ft. Neither provokes.'),
    R(9, 10, 'fun', 'It can only speak in rhyme for 1 minute. Verbal spell components still work.'),
    R(11, 12, 'good', 'A shimmering shield of light surrounds it: +2 AC until the start of its next turn.'),
    R(13, 14, 'odd', 'It floats 5 ft. above the ground until the start of its next turn.'),
    R(15, 16, 'odd', 'It moves 15 ft. in a random direction (d8) without provoking, then continues its turn.'),
    R(17, 18, 'good', 'It regains 1d6 hit points as warm light washes over it.'),
    R(19, 20, 'bad', 'Its thoughts jangle: it takes 1d6 psychic damage.'),
    R(21, 22, 'fun', 'Everyone within 10 ft. smells fresh-baked bread for 1 minute. Hungry creatures are distracted.'),
    R(23, 24, 'odd', 'One weapon it carries turns into a harmless bouquet for 1 minute, then changes back.'),
    R(25, 26, 'good', 'It turns invisible until it attacks or until the end of its next turn.'),
    R(27, 28, 'odd', 'It is charmed by the nearest creature (not itself) until the end of its next turn.'),
    R(29, 30, 'bad', 'It must use its action to attack the nearest creature, friend or foe.'),
    R(31, 32, 'bad', 'It is frightened of the nearest creature until the end of its next turn.'),
    R(33, 34, 'odd', 'Gravity wobbles: everything within 10 ft. that is not fastened down rises 5 ft. and drifts for 1 round.'),
    R(35, 36, 'bad', 'A candle-sized flame ignites in its hand. It takes 1 fire damage each turn until it drops what it holds.'),
    R(37, 38, 'bad', 'It sneezes shards of ice: each creature in a 5 ft. cone in front of it takes 1d4 cold damage.'),
    R(39, 40, 'odd', 'It teleports to a random unoccupied space within 20 ft.'),
    R(41, 42, 'good', 'Its speed doubles until the end of its next turn.'),
    R(43, 44, 'bad', 'It is stunned until the end of its next turn.'),
    R(45, 46, 'fun', 'A shower of 2d10 copper coins rains down in a 10 ft. circle around it.'),
    R(47, 48, 'odd', 'An illusory duplicate of it appears and mimics it for 1 round. Attacks against the duplicate have a 50% chance to target it instead.'),
    R(49, 50, 'bad', 'It loses its reaction and its bonus action until the start of its next turn.'),
    R(51, 52, 'fun', 'It begins to hiccup bubbles. Each hiccup is harmless but very loud for 1 minute.'),
    R(53, 54, 'good', 'It gains 2d6 temporary hit points as a burst of vigor hits it.'),
    R(55, 56, 'odd', 'It trades its position with its own shadow: it appears to move up to 10 ft. but arrives exactly where it started.'),
    R(57, 58, 'bad', 'It is blinded until the end of its next turn.'),
    R(59, 60, 'bad', 'The ground at its feet turns to slick glass in a 10 ft. circle. The area is difficult terrain, and creatures that move on it fall prone on a 1-4 on a d6.'),
    R(61, 62, 'fun', 'Its skin takes on a vivid, random colour for 1 hour.'),
    R(63, 64, 'odd', 'It is polymorphed into a random harmless beast (DM\'s choice, CR 0) until the end of its next turn, keeping its mind.'),
    R(65, 66, 'bad', 'A gust knocks it 15 ft. in a random direction (d8); it falls prone at the end of the push.'),
    R(67, 68, 'good', 'It may immediately take one extra action, but it cannot be the Attack action.'),
    R(69, 70, 'bad', 'It takes 2d6 thunder damage as a deafening boom rings from nowhere.'),
    R(71, 72, 'odd', 'It forgets the last minute: it cannot remember what it just did, and spells it was concentrating on end.'),
    R(73, 74, 'bad', 'All creatures within 10 ft. of it take 1d6 lightning damage (DC 12 Dexterity save for half).'),
    R(75, 76, 'good', 'Allies within 30 ft. gain 1d4 on their next attack roll or saving throw.'),
    R(77, 78, 'danger', 'It is paralyzed until the end of its next turn.'),
    R(79, 80, 'danger', 'A burst of raw force strikes it: 3d6 force damage and it is pushed 10 ft.'),
    R(81, 82, 'fun', 'Every creature within 30 ft. giggles uncontrollably. Disadvantage on Stealth checks for 1 minute.'),
    R(83, 84, 'odd', 'It becomes the size of a cat for 1 minute (Tiny): its attacks deal half damage, and it is hard to hit (+2 AC).'),
    R(85, 86, 'danger', 'It is teleported to a random point within 60 ft. in a flash of violet light and takes 2d6 psychic damage.'),
    R(87, 88, 'danger', 'A 20 ft. radius sphere of fire bursts from it: each creature there takes 4d6 fire damage (DC 14 Dexterity save for half).'),
    R(89, 90, 'good', 'A wave of calm washes over every creature within 20 ft.: any Frightened, Charmed or Confused effect on them ends.'),
    R(91, 92, 'odd', 'It is pulled through a thin place and returns after one round; it takes no turn but is not harmed.'),
    R(93, 94, 'danger', 'It is restrained by grasping golden threads (DC 14 Strength to break free) for up to 1 minute.'),
    R(95, 96, 'danger', 'It falls unconscious for 1 round; any damage wakes it.'),
    R(97, 98, 'good', 'A beam of silver light heals the nearest ally within 30 ft. for 4d6 hit points.'),
    R(99, 100, 'danger', 'The surge gets worse: roll twice more and apply both results, ignoring any further 99-100.')
  ];
  const lookup = n => { n = Math.max(1, Math.min(100, Math.round(n))); return T.find(e => n >= e.lo && n <= e.hi); };
  window.WildMagic = {
    table: T, lookup,
    roll(rng) { const d100 = 1 + Math.floor((rng || Math.random)() * 100); return { d100, entry: lookup(d100) }; },
    label: e => (e.lo === e.hi ? String(e.lo).padStart(2, '0') : `${String(e.lo).padStart(2, '0')}–${e.hi === 100 ? '00' : String(e.hi).padStart(2, '0')}`)
  };
})();
