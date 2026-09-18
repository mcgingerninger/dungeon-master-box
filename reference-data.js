// ===================== REFERENCE LIBRARY DATA =====================
// Backing data for the Compendium's References sub-tab (see renderReferenceCompendium in the
// main file). Split into its own file the same way loot-data.js/puzzle-data.js/trap-data.js/
// cult-data.js are — pure content, no logic, loaded via a plain <script src> before the main
// file's own script runs.
//
// Five categories, two different sourcing rules (see this project's own README/session notes on
// content sourcing — SRD-licensed rules text is free to use closely; anything from a specific
// non-SRD sourcebook is written as original content covering the same functional ground instead):
//   - ACTIONS_LIBRARY / CONDITIONS_LIBRARY: core 5e SRD rules text (combat actions, conditions) --
//     this is exactly the kind of baseline rules content the SRD's open license exists for, so
//     these closely match the standard rules rather than being reworded.
//   - DISEASE_LIBRARY / DEITY_LIBRARY / GIFT_LIBRARY / VEHICLE_LIBRARY: original content. Diseases,
//     named deities/pantheons, "supernatural gift" boons, and vehicle stat blocks beyond the SRD's
//     bare mechanics are all specific-sourcebook material, not SRD -- written fresh here, same
//     approach as trap-data.js/cult-data.js: same functional territory (a wasting plague, a
//     war-god's portfolio, a boon with a cost, a sailing ship's stat block), original specifics.
//
// Shapes:
//   Actions/Conditions:  { name, description }
//   Diseases:            { name, vector, saveAbility, saveDC, onset, effect, cure }
//   Deities:              { name, title, alignment, domains: [...], symbol, portfolio, dogma }
//   Gifts & Rewards:      { name, trigger, benefit, drawback }
//   Vehicles:             { name, category, size, speed, ac, hp, damageThreshold, crew, cargo, cost, description }

const ACTIONS_LIBRARY = [
  { name: "Attack", description: "Make one melee or ranged attack with a weapon or an unarmed strike. Some features (like Extra Attack) let a character attack more than once with this action." },
  { name: "Cast a Spell", description: "Cast a spell with a casting time of 1 action. Most spells that deal damage or alter the battlefield fall in this category." },
  { name: "Dash", description: "Gain extra movement equal to your speed for the current turn, after applying any modifiers to your speed." },
  { name: "Disengage", description: "Your movement doesn't provoke opportunity attacks for the rest of the turn." },
  { name: "Dodge", description: "Until the start of your next turn, any attack roll made against you has disadvantage if you can see the attacker, and you make Dexterity saving throws with advantage. You lose this benefit if you're incapacitated or your speed drops to 0." },
  { name: "Help", description: "Give another creature advantage on its next ability check to complete a task, or on its next attack roll against a creature within 5 feet of you, provided you aren't incapacitated and (for the attack case) the target of the help isn't already incapacitated." },
  { name: "Hide", description: "Make a Dexterity (Stealth) check in an attempt to hide, following the normal rules for hiding — you can't hide from a creature that can see you clearly." },
  { name: "Ready", description: "Choose a trigger and an action (or movement) you'll take in response, then act with your reaction when the trigger occurs before the start of your next turn. Casting a spell this way still requires concentration to hold if applicable." },
  { name: "Search", description: "Devote your attention to finding something — make a Wisdom (Perception) or Intelligence (Investigation) check as appropriate to what you're looking for." },
  { name: "Use an Object", description: "Interact with a second object, or use an object that requires your action to operate (this is the catch-all for any object interaction beyond the one free item interaction already allowed on your turn)." },
  { name: "Grapple (Special Attack)", description: "In place of an attack, try to grab a creature no more than one size larger than you: contest your Athletics against the target's Athletics or Acrobatics. Success grapples the target (its speed becomes 0 and it can't benefit from bonuses to speed) until the grapple ends." },
  { name: "Shove (Special Attack)", description: "In place of an attack, try to push a creature no more than one size larger than you: contest your Athletics against the target's Athletics or Acrobatics. Success either knocks it prone or pushes it 5 feet away, your choice." },
];

const CONDITIONS_LIBRARY = [
  { name: "Blinded", description: "Can't see and automatically fails any check that requires sight. Attack rolls against the creature have advantage, and its own attack rolls have disadvantage." },
  { name: "Charmed", description: "Can't attack the charmer or target it with harmful abilities or magical effects. The charmer has advantage on any ability check to interact socially with the creature." },
  { name: "Deafened", description: "Can't hear and automatically fails any check that requires hearing." },
  { name: "Exhaustion", description: "A cumulative condition tracked in levels (1-6). Each level imposes a worsening penalty — from disadvantage on ability checks at level 1, up to death at level 6. Finishing a long rest reduces a creature's exhaustion level by 1, provided it has also had food and drink." },
  { name: "Frightened", description: "Has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight, and can't willingly move closer to the source of its fear." },
  { name: "Grappled", description: "Speed becomes 0 and can't benefit from any bonus to speed. The condition ends if the grappler is incapacitated, or if an effect removes the grappled creature from the grappler's reach." },
  { name: "Incapacitated", description: "Can't take actions or reactions." },
  { name: "Invisible", description: "Impossible to see without special sense or magic, and is heavily obscured for the purpose of hiding. Attack rolls against the creature have disadvantage, and its own attack rolls have advantage." },
  { name: "Paralyzed", description: "Incapacitated and can't move or speak. Automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage, and any hit that lands is a critical hit if the attacker is within 5 feet." },
  { name: "Petrified", description: "Transformed, along with any nonmagical objects it's wearing or carrying, into a solid inanimate substance (usually stone). Weight increases by a factor of ten, and it ceases aging. Incapacitated, can't move or speak, and is unaware of its surroundings. Attack rolls against it have advantage, it automatically fails Strength and Dexterity saves, has resistance to all damage, and is immune to poison and disease (though an existing poison/disease is only suspended, not cured)." },
  { name: "Poisoned", description: "Has disadvantage on attack rolls and ability checks." },
  { name: "Prone", description: "Can only crawl unless it stands up (using half its movement). Has disadvantage on attack rolls. An attack roll against the creature has advantage if the attacker is within 5 feet, otherwise disadvantage." },
  { name: "Restrained", description: "Speed becomes 0 and can't benefit from any bonus to speed. Attack rolls against the creature have advantage, its own attack rolls have disadvantage, and it has disadvantage on Dexterity saving throws." },
  { name: "Stunned", description: "Incapacitated, can't move, and can speak only falteringly. Automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage." },
  { name: "Unconscious", description: "Incapacitated, can't move or speak, and is unaware of its surroundings. Drops whatever it's holding and falls prone. Automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage, and any hit that lands is a critical hit if the attacker is within 5 feet." },
];

// Original content -- see this file's header. Diseases beyond the SRD's bare "poisoned" condition
// are sourcebook material; these are written fresh to cover the same functional ground (a slow
// wasting illness, a mind-clouding fever, a contact-spread rot).
const DISEASE_LIBRARY = [
  {
    name: "Marshgrip Fever",
    vector: "Exposure to stagnant swamp water, or a bite from a creature that carries it.",
    saveAbility: "CON", saveDC: 12,
    onset: "1d4 days after exposure.",
    effect: "The creature gains one level of exhaustion, and its hit point maximum is reduced by 1d6 for as long as the disease persists. At the end of each long rest, the creature repeats the saving throw — success ends the disease, failure worsens it by another exhaustion level (to a maximum of 4 from this disease alone).",
    cure: "A successful DC 15 Medicine check with an hour of dedicated treatment and a source of clean water and heat grants advantage on the creature's next saving throw. A lesser restoration spell (or better) ends the disease outright.",
  },
  {
    name: "Hollow Whisper Rot",
    vector: "Prolonged contact with an already-infected creature's open wounds, or lingering too long near certain undead.",
    saveAbility: "CON", saveDC: 13,
    onset: "Immediate — the save is made at the moment of exposure.",
    effect: "On a failed save, the creature's skin pales and cracks like old parchment, and it has disadvantage on Charisma checks and saving throws while infected. At the end of each long rest, it repeats the save; three cumulative failures (not necessarily consecutive) cause the creature to begin whispering fragments of a voice that isn't its own whenever it sleeps, audible to anyone nearby.",
    cure: "A successful DC 14 Religion check while performing a rite of cleansing (requiring holy water or a similar consecrated material) ends the disease. Remove curse also works, despite this being a mundane-seeming illness rather than a curse.",
  },
  {
    name: "Graywater Cough",
    vector: "Breathing air near heavily polluted or magically tainted water for an extended period.",
    saveAbility: "CON", saveDC: 11,
    onset: "1d6 hours after exposure.",
    effect: "The creature suffers a persistent, wracking cough. While infected, it has disadvantage on Stealth checks and Constitution saving throws to maintain concentration. Speed is also halved. The disease resolves on its own after 1d4 days if untreated, but see cure below for accelerating that.",
    cure: "A successful DC 12 Medicine check, or a full day of complete rest away from the source of the pollution, ends the disease immediately rather than waiting out its natural course.",
  },
  {
    name: "The Long Sleep",
    vector: "A rare affliction, usually magical in origin — a cursed item, a hag's touch, spore exposure from a specific fungus.",
    saveAbility: "WIS", saveDC: 15,
    onset: "1 minute after exposure.",
    effect: "On a failed save, the creature falls into a deep, unnatural sleep for 8 hours, during which it can't be woken by normal means (though a greater restoration spell or similar strong magic rouses it immediately). While asleep this way, the creature is unconscious and vulnerable as normal, but doesn't require food, water, or normal sleep for the duration.",
    cure: "This is a one-time effect rather than an ongoing disease — once the sleep ends naturally or is magically interrupted, the creature is unaffected unless exposed again.",
  },
  {
    name: "Ashlung Blight",
    vector: "Inhaling smoke or ash from a fire that was burning something magically corrupted.",
    saveAbility: "CON", saveDC: 13,
    onset: "Immediate.",
    effect: "On a failed save, the creature's lungs take on a faint gray cast visible under bright light, and it has disadvantage on Constitution saving throws to avoid the effects of exhaustion. At the end of each long rest, it repeats the save; failure means it gains one level of exhaustion that can't be removed by rest alone while the blight persists.",
    cure: "A successful DC 14 Medicine check paired with a day spent breathing clean, open air (no confined spaces) ends the disease. Lesser restoration also works.",
  },
  {
    name: "Wanderer's Bloat",
    vector: "Drinking untreated water while traveling through unfamiliar or magically unstable terrain.",
    saveAbility: "CON", saveDC: 10,
    onset: "1d4 hours after exposure.",
    effect: "The creature suffers cramping and nausea; it has disadvantage on all attack rolls and ability checks that use Strength or Dexterity while infected, and can't benefit from a short rest's normal hit die recovery. Resolves on its own after 1 day.",
    cure: "A successful DC 10 Medicine check or a dose of any restorative food/drink item (even a mundane one, at the DM's discretion) ends the disease immediately.",
  },
];

const DEITY_LIBRARY = [
  { name: "Corvain", title: "The Iron Reveille", alignment: "Lawful Neutral", domains: ["War", "Order"], symbol: "A single upright spear crossed by a horizontal banner-pole.", portfolio: "Discipline, fair warfare, the honor of a kept oath even to an enemy.", dogma: "Victory without discipline is luck, and luck is not worth worshipping. Every battle is a covenant between combatants, and to break its unspoken terms — striking the fallen, betraying a truce — is the only true sin Corvain recognizes." },
  { name: "Meridel", title: "The Long Harvest", alignment: "Neutral Good", domains: ["Life", "Nature"], symbol: "A wheat sheaf bound with a green ribbon.", portfolio: "Agriculture, patience, the slow reward of tended things.", dogma: "Nothing worth having grows overnight. Tend what's been given to you — a field, a child, a friendship, a wound — and trust the harvest will come when it comes, not when you demand it." },
  { name: "Ashkarai", title: "The Unspoken Toll", alignment: "True Neutral", domains: ["Death"], symbol: "An hourglass with no sand visible on either side.", portfolio: "Death as balance rather than punishment or reward, the fairness of an ending that comes for everyone alike.", dogma: "Grief is not owed an explanation. Death asks nothing of the living except that they let it finish its work — no rites can bribe it, and no crime can be punished by withholding it." },
  { name: "Tessaly", title: "The Open Door", alignment: "Chaotic Good", domains: ["Trickery", "Freedom"], symbol: "A door standing open with no wall around it.", portfolio: "Escape, reinvention, the right to walk away from a life that no longer fits.", dogma: "No vow outlives the person who swore it against their own will. Help the trapped find their door — a debtor, a prisoner, a soul stuck in a role they never chose — even if the help looks like theft or trickery to the ones holding the leash." },
  { name: "Borrum", title: "The Waking Anvil", alignment: "Neutral Good", domains: ["Forge", "Knowledge"], symbol: "A hammer resting head-down atop an anvil.", portfolio: "Craftsmanship, invention, the dignity of skilled labor.", dogma: "A thing made well outlives the maker's name, and that's the only immortality worth wanting. Teach your craft freely; a guarded secret dies with you, but a taught one lives in every hand it passes through." },
  { name: "Nyseira", title: "The Drowned Verse", alignment: "Chaotic Neutral", domains: ["Tempest", "Trickery"], symbol: "A broken ship's wheel half-submerged in wave patterns.", portfolio: "Storms, the sea's indifference, songs sung to survive a crossing.", dogma: "The sea owes no one safe passage, and pretending otherwise is how sailors drown. Respect it, bargain with it if you must, but never mistake its calm moods for mercy." },
  { name: "Ophelin", title: "The Quiet Lantern", alignment: "Lawful Good", domains: ["Light", "Life"], symbol: "A single lantern with no visible flame, glowing from within.", portfolio: "Healing, vigilance, the comfort of a light left on for someone lost.", dogma: "Tend the wounded before you judge how they got wounded. A lantern doesn't ask who's approaching before it lights their way home." },
  { name: "Vantrek", title: "The Long Debt", alignment: "Lawful Evil", domains: ["War", "Trickery"], symbol: "A ledger book bound shut with a chain.", portfolio: "Conquest justified as commerce, the belief that every loss is a debt someone eventually pays.", dogma: "Mercy is an unpaid invoice. Take what you can hold, keep careful records of what you're owed, and never forget that everyone who ever wronged you is, functionally, in your debt until settled." },
  { name: "Ilyandra", title: "The First Question", alignment: "Neutral", domains: ["Knowledge", "Arcana"], symbol: "An open eye with a spiral iris.", portfolio: "Curiosity, the pursuit of forbidden or dangerous knowledge, the price of understanding.", dogma: "Every answer creates two new questions, and that is the engine of the world, not a flaw in it. No knowledge is inherently forbidden — only inherently costly — and the cost is always worth weighing, never worth refusing outright." },
  { name: "Ovoth", title: "The Patient Root", alignment: "True Neutral", domains: ["Nature", "Death"], symbol: "A tree root breaking through a cracked skull-shaped stone.", portfolio: "Decay as renewal, the forest reclaiming what civilization abandons.", dogma: "Nothing is wasted that returns to the ground. Ruins are not tragedies, they are gardens that haven't finished growing yet, and it is not your place to mourn a city the way the root that splits its foundation does not mourn it either." },
  { name: "Cassavel", title: "The Bright Wager", alignment: "Chaotic Neutral", domains: ["Trickery", "Luck"], symbol: "A coin frozen mid-flip, showing neither face.", portfolio: "Risk, fortune both good and ruinous, the thrill of an uncertain outcome.", dogma: "A sure thing is a wasted life. Bet on something — a stranger's honesty, a long shot in battle, your own untested skill — because the moment before the outcome lands is the only moment anyone's ever truly alive in." },
  { name: "Halvenna", title: "The Steady Hearth", alignment: "Lawful Good", domains: ["Life", "Order"], symbol: "A hearth-fire framed by a square doorway.", portfolio: "Home, community, the quiet virtue of showing up for people day after day.", dogma: "Heroism that only shows up for the dramatic moment is worth less than the neighbor who shows up every single unremarkable day. Build something that outlasts the crisis that made you build it." },
];

// Original content -- see this file's header. "Supernatural gifts and rewards" beyond the SRD is
// specific-sourcebook material (a boon granted at a cost, usually tied to a traumatic or
// transformative event); written fresh here in the same spirit rather than copied.
const GIFT_LIBRARY = [
  { name: "The Fed Grave", trigger: "Granted to a creature that spent a full night alone in a graveyard during a storm and chose, of its own will, to stay until dawn.", benefit: "Once per long rest, the creature can touch a dying creature (0 hp, failing death saves) to stabilize it automatically and grant it 1 hit point.", drawback: "The recipient can now sense the exact location of every corpse within 100 feet, awake or asleep, and cannot turn this sensing off." },
  { name: "The Borrowed Second", trigger: "Granted to a creature that survived a fall or blow that should have killed it outright, through pure chance rather than skill.", benefit: "Once per long rest, when the creature would be reduced to 0 hit points, it can instead drop to 1 hit point.", drawback: "Each time this triggers, the creature loses a random, specific short-term memory (something from the last week) — not chosen by the player, determined by the DM." },
  { name: "The Unclosing Wound", trigger: "Granted to a creature that willingly bore a fatal injury meant for someone else and survived.", benefit: "The creature's Constitution score increases by 1 (to a maximum of 22), reflecting a body that has learned, at cost, how to endure.", drawback: "A specific old wound never fully closes and reopens under stress — whenever the creature drops below half its hit point maximum in combat, it takes 1 additional point of damage from the reopening, once per combat." },
  { name: "The Listening Debt", trigger: "Granted to a creature that kept a genuine, costly promise to a dying stranger with nothing to gain from keeping it.", benefit: "The creature can cast speak with dead once per long rest without expending a spell slot.", drawback: "Every corpse the creature speaks with this way leaves behind a fragment of unfinished business that follows the creature as a nagging compulsion until addressed — the DM decides what, and it's never trivial." },
  { name: "The Split Reflection", trigger: "Granted to a creature that looked directly into a scrying pool, mirror, or still water controlled by something genuinely otherworldly, and didn't look away.", benefit: "Once per long rest, the creature can cast see invisibility on itself without expending a spell slot.", drawback: "The creature's reflection now moves a half-second out of sync with its actual body, visible to anyone who looks closely (a passive Perception 15 or better notices without being told to look)." },
  { name: "The Weight Forgiven", trigger: "Granted to a creature that forgave, sincerely and without coercion, someone who had done it serious and lasting harm.", benefit: "The creature has advantage on saving throws against being frightened.", drawback: "The creature can no longer hold a grudge even when it consciously wants to — any anger it tries to nurse fades within 24 hours regardless of the provocation, which can read as unsettling detachment to people who expect a normal reaction." },
  { name: "The Counted Breath", trigger: "Granted to a creature that drowned and was revived, and remembers the in-between clearly.", benefit: "The creature can hold its breath for twice the normal duration, and automatically stabilizes if reduced to 0 hit points while underwater.", drawback: "The creature has recurring, vivid dreams of drowning several times a week, and waking from one always costs it the benefit of a short rest that night (it can still take the rest, but gains none of its normal benefits) unless someone else is present while it sleeps." },
  { name: "The Given Name", trigger: "Granted to a creature that learned the true, secret name of something old and powerful and chose not to use it for personal gain.", benefit: "Once per long rest, the creature can force one creature within 30 feet to have disadvantage on its next saving throw, by speaking a fragment of the true name it carries.", drawback: "Whatever the creature learned the name from now knows this creature's own true name in return, and can always find them if it chooses to look." },
  { name: "The Late Harvest", trigger: "Granted to a creature that gave away food or resources it desperately needed to someone who needed it more, expecting to die as a result, and didn't.", benefit: "The creature no longer needs to eat, though it can still choose to for pleasure or social reasons, and is immune to the effects of starvation.", drawback: "The creature can no longer taste anything with real intensity — food is simply texture and temperature to it now, and it knows exactly what it gave up." },
  { name: "The Last Word", trigger: "Granted to a creature present at the true, final death of something ancient (not merely old — something that had genuinely earned the word 'ancient'), who spoke to it with respect rather than fear.", benefit: "Once per long rest, the creature can reroll one failed saving throw.", drawback: "The creature occasionally speaks a sentence in a language it doesn't know, at seemingly random moments, always something the dying ancient thing might plausibly have wanted said — the DM decides the content and timing." },
];

// Original content -- see this file's header. Vehicle stat blocks beyond generic mundane objects
// are DMG-style content, not SRD; written fresh here.
const VEHICLE_LIBRARY = [
  { name: "Rowboat", category: "Water", size: "Medium", speed: "1.5 mph", ac: 11, hp: 50, damageThreshold: null, crew: "1 (up to 3 passengers)", cargo: "200 lbs.", cost: "50 gp", description: "A simple wooden rowboat, oar-powered. No sail, no meaningful cargo capacity beyond passengers and personal gear." },
  { name: "Keelboat", category: "Water", size: "Huge", speed: "1 mph (poled/rowed), 2 mph (sailed with favorable wind)", ac: 15, hp: 100, damageThreshold: null, crew: "1 (up to 10 passengers)", cargo: "3/4 ton", description: "A flat-bottomed river vessel, poled in shallow water and sailed where the channel's deep enough. The workhorse of river trade routes." },
  { name: "Sailing Ship", category: "Water", size: "Gargantuan", speed: "2 mph", ac: 15, hp: 300, damageThreshold: 15, crew: "20 (up to 20 passengers)", cargo: "100 tons", description: "A three-masted ocean-going vessel built for cargo and long voyages, lightly armed at best. Damage below its threshold is deflected outright, reflecting its solid ocean-going construction." },
  { name: "Warship", category: "Water", size: "Gargantuan", speed: "2.5 mph", ac: 15, hp: 400, damageThreshold: 15, crew: "60 (up to 60 passengers)", cargo: "10 tons", description: "A purpose-built naval vessel mounting ballistae along both rails, faster and more heavily crewed than a merchant sailing ship at the cost of cargo space." },
  { name: "Wagon", category: "Land", size: "Large", speed: "20 ft. (roughly walking pace, terrain permitting)", ac: 11, hp: 40, damageThreshold: null, crew: "1 (up to 2 passengers on the bench)", cargo: "4,000 lbs.", description: "A sturdy two-axle cargo wagon, drawn by a two- or four-horse team. The standard choice for overland trade caravans." },
  { name: "Carriage", category: "Land", size: "Large", speed: "25 ft.", ac: 11, hp: 30, damageThreshold: null, crew: "1 driver (up to 6 passengers in comfort)", cargo: "500 lbs.", description: "An enclosed, sprung-suspension passenger vehicle — considerably more comfortable than a wagon, and considerably less useful for hauling freight." },
  { name: "Chariot", category: "Land", size: "Medium", speed: "40 ft.", ac: 13, hp: 20, damageThreshold: null, crew: "1 driver (1 passenger who can fight from the platform)", cargo: "100 lbs.", description: "A light, fast, two-wheeled combat platform drawn by a pair of horses. Fragile compared to a wagon, but far faster and built to let a passenger fight while moving." },
  { name: "River Barge", category: "Water", size: "Gargantuan", speed: "1 mph (towed or poled)", ac: 15, hp: 150, damageThreshold: 10, crew: "4 (up to 8 passengers)", cargo: "15 tons", description: "A flat, low-draft cargo hauler with no independent propulsion of its own — towed from the bank by draft animals or another vessel, or poled by its crew in slow water." },
  { name: "Skyrunner Balloon", category: "Air", size: "Huge", speed: "3 mph (wind-assisted, pilot-steerable within limits)", ac: 12, hp: 80, damageThreshold: null, crew: "1 (up to 3 passengers)", cargo: "300 lbs.", description: "A hot-air balloon with a reinforced wicker gondola and a small enchanted brazier for reliable lift — slow, vulnerable to strong winds, but the cheapest way to get a small party genuinely airborne." },
  { name: "Windcutter Skiff", category: "Air", size: "Large", speed: "6 mph", ac: 14, hp: 120, damageThreshold: 5, crew: "2 (up to 6 passengers)", cargo: "1 ton", description: "A rigid-hulled airship kept aloft by a set of enchanted levitation crystals along its keel, sailed with conventional canvas for propulsion. Rare and expensive, but a genuine aerial vehicle rather than a slow drifting balloon." },
];
