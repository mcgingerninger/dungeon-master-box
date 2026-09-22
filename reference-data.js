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
//   Deities:              { name, title, rank: 'major'|'minor'|'unique', pantheon, parent, powerTier,
//                           alignment, domains: [...], symbol, portfolio, dogma, boon: { name, effect } }
//   Gifts & Rewards:      { name, type: 'Boon'|'Blessing'|'Gift', trigger, benefit, drawback }
//   Vehicles:             { name, category, size, speed, ac, hp, damageThreshold, crew, cargo, cost, description }
//
// Deities are organized into pantheons: each pantheon has exactly one 'major' deity (pantheon
// field names the pantheon, parent is null) and several 'minor' deities that serve it (pantheon
// matches the major's, parent names the major deity by its own `name`). Deities with rank
// 'unique' stand alone -- not part of any hierarchy, pantheon is always "Unique Deities", parent
// is always null. powerTier ('celestial' > 'legendary' > 'superrare', or omitted for ordinary
// deities) drives the Reference tab's badge color and is reserved for the biggest, most
// cosmic-scale entries -- same rarity-tier vocabulary the rest of the app already uses for items,
// reused here so "this deity is a big deal" reads consistently across the whole compendium.
// `boon` is the mechanical benefit a devoted follower/cleric of that deity can call on; major
// deities get something genuinely powerful, minors get one narrow trick, uniques land in between.

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
    vector: "Inhaling smoke or ash from a fire that consumed something touched by demonic corruption — a cursed tome, a fiend's remains, ground where a dark ritual was performed.",
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
  {
    name: "Foxfire Delirium",
    vector: "Breathing spores from a rare luminous fungus found deep in old, untouched forest.",
    saveAbility: "WIS", saveDC: 12,
    onset: "1 hour after exposure.",
    effect: "The creature's skin develops faint luminescent patches that glow like dim foxfire, impossible to conceal without magic, and it has disadvantage on Wisdom saving throws against illusions (the fungus seems to make the mind more suggestible to shifting light). At the end of each long rest, it repeats the save — success ends the disease, failure brightens the glow (now shedding dim light in a 5-ft radius) and widens the disadvantage to all Wisdom saving throws.",
    cure: "A successful DC 13 Nature check identifying and applying a poultice of crushed nightshade root ends the disease within an hour. Lesser restoration also works.",
  },
  {
    name: "Barrow Fatigue",
    vector: "Prolonged contact with freshly disturbed grave soil, or sleeping within an old barrow overnight.",
    saveAbility: "CON", saveDC: 13,
    onset: "By the following dawn.",
    effect: "The creature wakes each morning as though it hadn't rested at all — a long rest grants none of its normal benefits (no HP or Hit Dice recovery, no reduction to exhaustion) while infected, though the rest still counts toward any other requirement to have slept. The disease doesn't worsen on its own beyond this.",
    cure: "A successful DC 14 Religion check performed at dawn, burying a handful of the same grave soil elsewhere with proper rites, ends the disease. Remove curse also works.",
  },
  {
    name: "Ratking's Kiss",
    vector: "A bite from a diseased rat, especially ones found in large infested colonies.",
    saveAbility: "CON", saveDC: 11,
    onset: "1d4 hours after the bite.",
    effect: "The creature is gripped by a crawling paranoia that something is watching it from just out of sight; it has disadvantage on Wisdom (Insight) checks, and can't willingly enter a confined space it hasn't already personally inspected without first succeeding on a DC 12 Wisdom saving throw. At the end of each long rest, it repeats the disease's save; three cumulative failures (not necessarily consecutive) make the paranoia bad enough that even trusted allies are occasionally suspected.",
    cure: "A successful DC 12 Medicine check paired with a full day of rest in genuine isolation (no other creatures present) breaks the paranoia's hold and ends the disease. Calm emotions suppresses the symptoms for its duration but doesn't cure it.",
  },
  {
    name: "Stonelung",
    vector: "Prolonged exposure to fine rock dust in an active quarry or a poorly ventilated mine.",
    saveAbility: "CON", saveDC: 12,
    onset: "Cumulative — the save is repeated after each full day of continued exposure, not made just once.",
    effect: "On a failed save, the creature's walking speed is reduced by 5 feet as its breathing grows labored, and it has disadvantage on Constitution saving throws to maintain concentration while moving. This stacks with each additional failed save (to a minimum speed of 5 feet), but the reduction fully resets after 3 cumulative days spent away from the dust, whether or not the disease has been cured.",
    cure: "A successful DC 13 Medicine check paired with a week entirely away from rock dust ends the disease outright. Lesser restoration also works immediately.",
  },
  {
    name: "Tideglass Fever",
    vector: "Contact with seawater or brine near a site where something fiendish or demonic was once bound, drowned, or banished.",
    saveAbility: "CON", saveDC: 13,
    onset: "1d6 hours after exposure.",
    effect: "The creature's skin takes on a faint translucent sheen and turns brittle rather than tough, granting it vulnerability to bludgeoning damage while infected. At the end of each long rest, it repeats the save — success ends the disease, failure makes a fine network of hairline cracks visible across the skin (cosmetic only, but impossible to hide without magic).",
    cure: "A successful DC 14 Medicine check flushing the affliction with an hour of fresh, non-salt water ends the disease. Greater restoration also works.",
  },
  {
    name: "Widow's Hunger",
    vector: "Surviving a bite from a giant spider or similar venomous creature without receiving the full dose — a near-miss.",
    saveAbility: "CON", saveDC: 12,
    onset: "1 day after exposure.",
    effect: "The creature develops an intense, oddly specific craving (the DM picks something plausible — raw meat, sugar, a particular herb) that grows harder to ignore with each passing day. Going more than 24 hours without indulging it imposes disadvantage on all ability checks until the craving is satisfied. This is a behavioral effect rather than a physical one — no hit points are lost, but the compulsion is real and involuntary.",
    cure: "A successful DC 13 Wisdom (Medicine or Insight) check from another creature, talking the sufferer through withdrawal, combined with 3 full days without indulging the craving, ends it for good. Lesser restoration also works immediately.",
  },
  {
    name: "Emberpox",
    vector: "Exposure to ash and cinders from a fire that burned something magically volatile.",
    saveAbility: "CON", saveDC: 13,
    onset: "1d4 hours after exposure.",
    effect: "Small blistering welts spread across exposed skin, and the creature gains vulnerability to fire damage while infected. At the end of each long rest, it repeats the save; failure spreads the welts further and adds disadvantage on Constitution saving throws made to maintain concentration.",
    cure: "A successful DC 14 Medicine check applying a cold-natured soothing salve twice daily for 2 days ends the disease. Lesser restoration also works.",
  },
  {
    name: "Gravehush",
    vector: "Spending time in a space recently occupied by an undead creature strong enough to leave a lingering necrotic taint, or a space where a demonic ritual left a similar mark (DM's discretion on which).",
    saveAbility: "WIS", saveDC: 14,
    onset: "Immediate — the save is made at the moment of exposure.",
    effect: "On a failed save, the creature can no longer regain hit points from any source except a long rest, as if its body has forgotten how to mend on its own between rests. It also finds its own voice unsettling to hear — speaking for more than a minute at a stretch requires a DC 10 Wisdom saving throw or the creature falls silent, unable to continue, for the rest of the scene.",
    cure: "A successful DC 15 Religion check performed as part of a proper rite of the dead (requiring holy water and an hour of uninterrupted ritual) ends the disease. Remove curse also works, despite this being a mundane-seeming illness rather than a curse.",
  },
  {
    name: "Ivyrot",
    vector: "Contact with a patch of cursed, fast-growing ivy found near old ruins.",
    saveAbility: "CON", saveDC: 11,
    onset: "1d4 hours after exposure.",
    effect: "Thin green veins spread visibly beneath the skin from the point of contact, and the creature has disadvantage on Strength checks and Strength saving throws while infected — the vines sap physical vigor rather than damage it outright. If the creature ends a turn adjacent to fresh soil or living plant matter without having treated the wound, roll a d20 at the start of its next turn; on a 1, the vines take root and it becomes Restrained until it succeeds on a DC 11 Strength check (using its action) to tear free.",
    cure: "A successful DC 12 Nature check carefully burning the affected area clean (dealing no damage if done properly) ends the disease immediately. Lesser restoration also works.",
  },
  {
    name: "Nightbloom Fever",
    vector: "Inhaling pollen from a nightbloom flower, which releases its spores only in complete darkness.",
    saveAbility: "WIS", saveDC: 13,
    onset: "Immediate.",
    effect: "On a failed save, the creature must succeed on a DC 12 Wisdom saving throw at the start of each of its turns while in an area of darkness or dim light, or fall unconscious for 1 minute (or until it takes damage, or another creature uses an action to wake it) — an obvious complication for anyone infected who needs to travel or fight at night.",
    cure: "A successful DC 13 Medicine check performed in bright light (natural sunlight works fastest) purges the pollen from the creature's system within an hour. Lesser restoration also works immediately.",
  },
  {
    name: "Coinsickness",
    vector: "Extended, direct contact with a hoard that's been cursed or magically tainted — not every hoard carries it, at the DM's discretion.",
    saveAbility: "WIS", saveDC: 13,
    onset: "1 day after exposure.",
    effect: "The creature becomes unable to willingly part with money or valuables already in its possession. Spending gold, giving away treasure, or even loaning an item requires succeeding on a DC 12 Wisdom saving throw first; failure means it simply can't go through with it this turn, though it can try again later. This has no effect on money or valuables the creature doesn't yet own.",
    cure: "A successful DC 14 Wisdom (Insight or Persuasion) check from another creature, talking the sufferer through the compulsion over the course of a long rest, ends it. Calm emotions suppresses the compulsion for its duration but doesn't cure the disease.",
  },
  {
    name: "Weeping Chalk",
    vector: "Breathing fine white dust in a chalk quarry or a cave with heavy mineral deposits.",
    saveAbility: "CON", saveDC: 11,
    onset: "1d6 hours after exposure.",
    effect: "The creature's eyes and throat dry out persistently; it has disadvantage on Charisma (Persuasion, Deception, and Intimidation) checks that rely on speech, and needs to drink twice its normal daily water to avoid the effects of thirst. Resolves on its own after 3 days if left untreated.",
    cure: "A successful DC 10 Medicine check, or a full day spent somewhere humid (near open water, a bathhouse, and the like), ends the disease immediately rather than waiting out its natural course.",
  },
  {
    name: "Frostbite Rot",
    vector: "Extended exposure to unnaturally cold, magically tainted ice or snow.",
    saveAbility: "CON", saveDC: 14,
    onset: "1d4 hours after exposure.",
    effect: "The affected extremity (a hand or foot, decided narratively) takes on a grayish, numb cast, and the creature has disadvantage on Dexterity checks and attack rolls made using that extremity. At the end of each long rest, it repeats the save; three cumulative failures (not necessarily consecutive) make the numbness permanent without magical healing, though it stops worsening beyond that point.",
    cure: "A successful DC 15 Medicine check slowly rewarming the extremity over the course of an hour cures the disease if caught before 3 cumulative failures. Lesser restoration cures it at any stage.",
  },
  {
    name: "Saltmarsh Wasting",
    vector: "Drinking brackish marsh water in a desperate situation, or prolonged exposure to marsh air.",
    saveAbility: "CON", saveDC: 12,
    onset: "1d4 days after exposure.",
    effect: "The creature's appetite fades to almost nothing — it needs only a quarter of the normal food to avoid starvation, but also gains none of the usual benefit of a full, hearty meal (spells like goodberry still work as normal; a mundane meal's ordinary fringe benefits don't). It also gains one level of exhaustion that can't be removed by rest alone while the disease persists.",
    cure: "A successful DC 13 Medicine check paired with a full day of rest and access to fresh, non-marsh food and water ends the disease. Lesser restoration also works.",
  },
  {
    name: "Wyrmscale Fever",
    vector: "Extended proximity to a dragon's lair, particularly the shed scales and musk that accumulate there.",
    saveAbility: "CON", saveDC: 14,
    onset: "1d6 hours after exposure.",
    effect: "Small, hard, scale-like patches erupt across the creature's skin — dramatic to look at, mechanically negligible — and it has disadvantage on saving throws against being frightened by dragons or draconic creatures specifically, as some instinctive part of it now recognizes exactly what it should fear. At the end of each long rest, it repeats the save; success ends the disease.",
    cure: "A successful DC 15 Arcana or Nature check, recognizing the affliction's draconic origin and treating it with an alchemical reagent that counters draconic magic, ends the disease within an hour. Greater restoration also works.",
  },
  {
    name: "Chorus Fever",
    vector: "A contagious airborne illness that spreads easily through crowded taverns, festivals, or ships.",
    saveAbility: "CON", saveDC: 10,
    onset: "1d4 days after exposure.",
    effect: "The creature involuntarily hums, whistles, or mutters snatches of melody whenever it isn't actively concentrating on staying quiet, imposing disadvantage on Dexterity (Stealth) checks that depend on silence. Any creature that spends an hour in close proximity to an infected creature must succeed on a DC 10 Constitution saving throw or contract the disease as well.",
    cure: "A successful DC 11 Medicine check, or 3 days of natural recovery, ends the disease. It's rarely dangerous, mostly just extremely inconvenient at exactly the wrong moments.",
  },
  {
    name: "Doldrum Malaise",
    vector: "Weeks becalmed at sea, or extended exposure to a stretch of unnaturally still, dead air.",
    saveAbility: "WIS", saveDC: 12,
    onset: "Gradual — the save is repeated once per week of continued exposure, not made just once.",
    effect: "On a failed save, the creature sinks into a deep apathy: it has disadvantage on initiative rolls and can't take reactions, as if perpetually a half-step behind its own life. This doesn't impair actions once its turn actually starts — only its ability to react to what's happening around it.",
    cure: "A successful DC 13 Wisdom (Medicine or Insight) check paired with a genuine change of circumstance (leaving the becalmed area or the equivalent) over the course of a long rest ends the disease. Lesser restoration also works.",
  },
  {
    name: "Thistledown Cough",
    vector: "Breathing thistledown spores that drift heavily through certain meadows in late summer.",
    saveAbility: "CON", saveDC: 10,
    onset: "Immediate.",
    effect: "The creature suffers fits of sneezing and coughing at inopportune moments. At the start of combat, and whenever it tries to cast a spell with a verbal component, roll a d6; on a 1, the fit ruins the attempt this time only (the spell fails, or the creature loses its first action of combat). Resolves on its own after 2 days.",
    cure: "A successful DC 10 Medicine check, or a dose of any mundane cough remedy (availability at the DM's discretion), ends the disease immediately.",
  },
  {
    name: "Cindermark",
    vector: "A wound from a weapon, trap, or creature wreathed in unnatural fire — the kind fiends and their servants sometimes wield, burning colder or hungrier than it should. Not every fire wound carries this risk; the DM decides when a particular flame felt wrong enough to matter.",
    saveAbility: "CON", saveDC: 13,
    onset: "Immediate.",
    effect: "A faint ember-orange mark forms at the wound site and glows visibly (shedding dim light in a 5-ft radius) in complete darkness, giving the creature disadvantage on Dexterity (Stealth) checks made in darkness specifically. It deals no ongoing damage of its own.",
    cure: "A successful DC 14 Medicine check treating the mark directly with cold water or a cold-natured remedy over 10 minutes ends the disease. Lesser restoration also works.",
  },
  {
    name: "Bogwater Palsy",
    vector: "Drinking or prolonged skin contact with stagnant bog water, especially where certain fungi grow.",
    saveAbility: "CON", saveDC: 12,
    onset: "1d6 hours after exposure.",
    effect: "The creature's hands develop a persistent tremor. It has disadvantage on Dexterity (Sleight of Hand) checks and on attack rolls made with weapons that have the finesse or light property, though larger, steadier weapons are unaffected. At the end of each long rest, it repeats the save; success ends the disease.",
    cure: "A successful DC 13 Medicine check, with an hour of treatment using clean water and a steadying herbal tonic, ends the disease. Lesser restoration also works.",
  },
  {
    name: "Deepcrawl Fever",
    vector: "Extended time spent in the Underdark or similarly deep, sunless places, particularly around certain phosphorescent fungi.",
    saveAbility: "CON", saveDC: 13,
    onset: "1d4 days after exposure.",
    effect: "The creature's eyes become highly sensitive; while infected it has disadvantage on attack rolls and Wisdom (Perception) checks relying on sight whenever it's in bright light, though its vision in darkness (including darkvision, if it has any) is unaffected. Resolves on its own after a week if left untreated.",
    cure: "A successful DC 12 Medicine check, or several consecutive days spent entirely away from bright light, lets the eyes recover and ends the disease immediately rather than waiting out its natural course.",
  },
  {
    name: "Loomrot",
    vector: "Handling cloth or thread spun by something not entirely natural — a witch's spinning wheel, a haunted loom, thread pulled from a source better left alone.",
    saveAbility: "WIS", saveDC: 12,
    onset: "1d4 hours after exposure.",
    effect: "The creature becomes compelled to keep its hands busy — fidgeting, plucking at loose threads, braiding whatever's on hand — and has disadvantage on Wisdom (Perception) checks whenever its hands are otherwise idle. Keeping its hands genuinely occupied with some other task removes the disadvantage for as long as that lasts.",
    cure: "A successful DC 13 Arcana check identifying and unraveling the curse's specific thread-pattern (requires examining a sample of the source cloth) ends the disease. Remove curse also works.",
  },
  {
    name: "Hollowmourn Grief",
    vector: "Witnessing a specific and deeply traumatic death (DM's discretion on the trigger) — this affliction is psychosomatic/magical in nature, not a physical contagion at all.",
    saveAbility: "WIS", saveDC: 14,
    onset: "Immediate.",
    effect: "On a failed save, the creature has disadvantage on death saving throws for as long as the disease persists — grief has made it, in some real sense, less inclined to keep fighting for its own life. At the end of each long rest, it repeats the save; success ends the disease.",
    cure: "A successful DC 13 Wisdom (Insight or Medicine) check from another creature who helps the sufferer properly grieve (requires a genuine scene of roleplay, not just a die roll) ends the disease. Greater restoration also works without the roleplay requirement.",
  },
  {
    name: "Rustbite",
    vector: "A deep wound from a heavily corroded weapon or a rusted trap mechanism.",
    saveAbility: "CON", saveDC: 12,
    onset: "1d4 hours after exposure.",
    effect: "The wound refuses to close cleanly; the creature can't regain hit points from spending Hit Dice during a short rest while infected, though long rests still function normally. At the end of each long rest, it repeats the save; success ends the disease.",
    cure: "A successful DC 13 Medicine check thoroughly cleaning the wound with a proper antiseptic (alcohol, vinegar, or the equivalent) ends the disease. Lesser restoration also works.",
  },
];

const DEITY_LIBRARY = [
  // ── Unique Deities — stand alone, no pantheon hierarchy. The original 12, retrofitted with
  // rank/pantheon/boon fields; flavor text (title/alignment/domains/symbol/portfolio/dogma)
  // is unchanged from before this pantheon system existed.
  { name: "Corvain", title: "The Iron Reveille", rank: "unique", pantheon: "Unique Deities", parent: null, alignment: "Lawful Neutral", domains: ["War", "Order"], symbol: "A single upright spear crossed by a horizontal banner-pole.", portfolio: "Discipline, fair warfare, the honor of a kept oath even to an enemy.", dogma: "Victory without discipline is luck, and luck is not worth worshipping. Every battle is a covenant between combatants, and to break its unspoken terms — striking the fallen, betraying a truce — is the only true sin Corvain recognizes.",
    boon: { name: "The Kept Oath", effect: "Once per long rest, the creature can grant itself advantage on its next attack roll against a creature that broke a truce, surrender, or oath earlier in the current scene." } },
  { name: "Meridel", title: "The Long Harvest", rank: "unique", pantheon: "Unique Deities", parent: null, alignment: "Neutral Good", domains: ["Life", "Nature"], symbol: "A wheat sheaf bound with a green ribbon.", portfolio: "Agriculture, patience, the slow reward of tended things.", dogma: "Nothing worth having grows overnight. Tend what's been given to you — a field, a child, a friendship, a wound — and trust the harvest will come when it comes, not when you demand it.",
    boon: { name: "The Long Harvest's Patience", effect: "Once per long rest, the creature can spend 10 minutes tending a wound to grant a creature advantage on its next Hit Die roll during a short rest." } },
  { name: "Ashkarai", title: "The Unspoken Toll", rank: "unique", pantheon: "Unique Deities", parent: null, alignment: "True Neutral", domains: ["Death"], symbol: "An hourglass with no sand visible on either side.", portfolio: "Death as balance rather than punishment or reward, the fairness of an ending that comes for everyone alike.", dogma: "Grief is not owed an explanation. Death asks nothing of the living except that they let it finish its work — no rites can bribe it, and no crime can be punished by withholding it.",
    boon: { name: "The Unspoken Toll's Grace", effect: "Once per long rest, the creature can grant a dying creature (making death saving throws) advantage on its next death saving throw, without touching it." } },
  { name: "Tessaly", title: "The Open Door", rank: "unique", pantheon: "Unique Deities", parent: null, alignment: "Chaotic Good", domains: ["Trickery", "Freedom"], symbol: "A door standing open with no wall around it.", portfolio: "Escape, reinvention, the right to walk away from a life that no longer fits.", dogma: "No vow outlives the person who swore it against their own will. Help the trapped find their door — a debtor, a prisoner, a soul stuck in a role they never chose — even if the help looks like theft or trickery to the ones holding the leash.",
    boon: { name: "The Open Door's Passage", effect: "Once per long rest, the creature can automatically succeed on one check made to escape restraints, a grapple, or a locked mundane door or cage." } },
  { name: "Borrum", title: "The Waking Anvil", rank: "unique", pantheon: "Unique Deities", parent: null, alignment: "Neutral Good", domains: ["Forge", "Knowledge"], symbol: "A hammer resting head-down atop an anvil.", portfolio: "Craftsmanship, invention, the dignity of skilled labor.", dogma: "A thing made well outlives the maker's name, and that's the only immortality worth wanting. Teach your craft freely; a guarded secret dies with you, but a taught one lives in every hand it passes through.",
    boon: { name: "The Waking Anvil's Craft", effect: "Once per long rest, the creature can repair a single nonmagical broken or damaged object to full working condition over 10 minutes, without needing tools it doesn't already have." } },
  { name: "Nyseira", title: "The Drowned Verse", rank: "unique", pantheon: "Unique Deities", parent: null, alignment: "Chaotic Neutral", domains: ["Tempest", "Trickery"], symbol: "A broken ship's wheel half-submerged in wave patterns.", portfolio: "Storms, the sea's indifference, songs sung to survive a crossing.", dogma: "The sea owes no one safe passage, and pretending otherwise is how sailors drown. Respect it, bargain with it if you must, but never mistake its calm moods for mercy.",
    boon: { name: "The Drowned Verse's Warning", effect: "Once per long rest, the creature can sense the general nature of an approaching storm or major weather shift up to 24 hours before it arrives." } },
  { name: "Ophelin", title: "The Quiet Lantern", rank: "unique", pantheon: "Unique Deities", parent: null, alignment: "Lawful Good", domains: ["Light", "Life"], symbol: "A single lantern with no visible flame, glowing from within.", portfolio: "Healing, vigilance, the comfort of a light left on for someone lost.", dogma: "Tend the wounded before you judge how they got wounded. A lantern doesn't ask who's approaching before it lights their way home.",
    boon: { name: "The Quiet Lantern's Comfort", effect: "Once per long rest, the creature can touch a dying creature to stabilize it automatically, and end one of the target's levels of exhaustion." } },
  { name: "Vantrek", title: "The Long Debt", rank: "unique", pantheon: "Unique Deities", parent: null, alignment: "Lawful Evil", domains: ["War", "Trickery"], symbol: "A ledger book bound shut with a chain.", portfolio: "Conquest justified as commerce, the belief that every loss is a debt someone eventually pays.", dogma: "Mercy is an unpaid invoice. Take what you can hold, keep careful records of what you're owed, and never forget that everyone who ever wronged you is, functionally, in your debt until settled.",
    boon: { name: "The Long Debt's Claim", effect: "Once per long rest, the creature can mark one creature that has wronged it; it has advantage on the next Intimidation check it makes against the marked creature within 24 hours." } },
  { name: "Ilyandra", title: "The First Question", rank: "unique", pantheon: "Unique Deities", parent: null, alignment: "Neutral", domains: ["Knowledge", "Arcana"], symbol: "An open eye with a spiral iris.", portfolio: "Curiosity, the pursuit of forbidden or dangerous knowledge, the price of understanding.", dogma: "Every answer creates two new questions, and that is the engine of the world, not a flaw in it. No knowledge is inherently forbidden — only inherently costly — and the cost is always worth weighing, never worth refusing outright.",
    boon: { name: "The First Question's Insight", effect: "Once per long rest, the creature can ask a single question of an object, ruin, or magical phenomenon and receive a hazy but true impression of its origin or purpose." } },
  { name: "Ovoth", title: "The Patient Root", rank: "unique", pantheon: "Unique Deities", parent: null, alignment: "True Neutral", domains: ["Nature", "Death"], symbol: "A tree root breaking through a cracked skull-shaped stone.", portfolio: "Decay as renewal, the forest reclaiming what civilization abandons.", dogma: "Nothing is wasted that returns to the ground. Ruins are not tragedies, they are gardens that haven't finished growing yet, and it is not your place to mourn a city the way the root that splits its foundation does not mourn it either.",
    boon: { name: "The Patient Root's Reclamation", effect: "Once per long rest, the creature can cause plant growth to rapidly overtake a small nonmagical structure or area (roughly 10 ft. cubed) over the course of 1 minute, without harming any creature." } },
  { name: "Cassavel", title: "The Bright Wager", rank: "unique", pantheon: "Unique Deities", parent: null, alignment: "Chaotic Neutral", domains: ["Trickery", "Luck"], symbol: "A coin frozen mid-flip, showing neither face.", portfolio: "Risk, fortune both good and ruinous, the thrill of an uncertain outcome.", dogma: "A sure thing is a wasted life. Bet on something — a stranger's honesty, a long shot in battle, your own untested skill — because the moment before the outcome lands is the only moment anyone's ever truly alive in.",
    boon: { name: "The Bright Wager's Nerve", effect: "Once per long rest, before making an ability check, attack roll, or saving throw, the creature can choose to reroll and must use the new result, even if it's worse." } },
  { name: "Halvenna", title: "The Steady Hearth", rank: "unique", pantheon: "Unique Deities", parent: null, alignment: "Lawful Good", domains: ["Life", "Order"], symbol: "A hearth-fire framed by a square doorway.", portfolio: "Home, community, the quiet virtue of showing up for people day after day.", dogma: "Heroism that only shows up for the dramatic moment is worth less than the neighbor who shows up every single unremarkable day. Build something that outlasts the crisis that made you build it.",
    boon: { name: "The Steady Hearth's Welcome", effect: "Once per long rest, the creature can grant itself and up to five other creatures the full benefits of a short rest in 10 minutes instead of 1 hour, so long as all are somewhere the creature considers home or genuinely safe." } },
  { name: "Nem", title: "The Unwritten", rank: "unique", pantheon: "Unique Deities", parent: null, powerTier: "legendary", alignment: "True Neutral", domains: ["Mystery", "Fate"], symbol: "A blank page, edges burnt, center untouched.", portfolio: "Whatever hasn't happened yet. Not fate as destiny — fate as the simple, vast fact that the future hasn't been written, and something has to not-write it until it's time.",
    dogma: "Every other god has a story people tell about them; Nem has none that agree with each other, and Nem has never once corrected any of them. Some traditions hold Nem is the youngest god, born the first moment anyone wondered what happens next. Others hold Nem is older than the concept of gods entirely, and every other deity is just a chapter it hasn't decided whether to write yet. Its faithful — vanishingly few, deliberately so — don't proselytize, because a religion that convinces too many people stops being a mystery, and Nem has no use for a cult that understands itself.",
    boon: { name: "An Unwritten Page", effect: "Once per long rest, the creature can ask the DM one yes-or-no question about an event that hasn't happened yet and receive a true answer — but the act of asking makes that outcome no longer certain, even if it seemed inevitable a moment before." } },

  // ── The Elemental Concord — one primordial major deity, four elemental minors who each
  // answer to it directly.
  { name: "Aetherion", title: "the First Breath", rank: "major", pantheon: "The Elemental Concord", parent: null, powerTier: "celestial", alignment: "True Neutral", domains: ["Creation", "Elements", "Order"], symbol: "Four interlocking rings of flame, water, stone, and wind around a single empty center.", portfolio: "The first act of creation, the moment undifferentiated potential became fire and flood and stone and sky. Aetherion is less a personality than a principle — the four elemental courts all answer to it, though it rarely speaks through anything but them.",
    dogma: "Before there were gods with names, there was one breath, and it split four ways rather than stay whole — this is the first and only story Aetherion's faithful agree on without argument. Nothing in the world is purely one element; a flame needs air, a river needs stone to hold its shape, and a mortal soul is no different, built from all four in proportions no priest has ever fully mapped. To worship Aetherion directly, rather than one of its four courts, is to refuse the comfort of a single answer and instead hold the whole unresolved tension of creation at once — which is why Aetherion has fewer devoted clergy than any of its own children, and why the ones it does have are taken uncommonly seriously.",
    boon: { name: "Breath of the First Making", effect: "Once per long rest, as an action, the creature can call on Aetherion to grant itself resistance to one damage type of its choice — acid, cold, fire, lightning, or thunder — until the end of its next long rest. Only one instance can be active at a time." } },
  { name: "Ignira", title: "the Ember Crown", rank: "minor", pantheon: "The Elemental Concord", parent: "Aetherion", alignment: "Chaotic Neutral", domains: ["Fire", "War"], symbol: "A crown of stylized flame, worn on nothing, floating above an empty throne.", portfolio: "Wildfire, forge-heat, the fury that burns a field clean so something new can grow.", dogma: "Ignira's clergy keep one creed, three words long: let it burn. Everything else — the eulogies, the rebuilding — comes after, and comes easier, once the old wood is actually gone.",
    boon: { name: "Ember Crown's Favor", effect: "Once per short rest, the creature can add 1d4 to a single fire damage roll it makes, after seeing the result." } },
  { name: "Nimbriel", title: "the Tidewrit", rank: "minor", pantheon: "The Elemental Concord", parent: "Aetherion", alignment: "Neutral Good", domains: ["Water", "Life"], symbol: "A single wave frozen mid-break, inked like a line of handwriting.", portfolio: "Rivers, rainfall, the way water remembers every shape it's ever been poured into.", dogma: "Ask a Nimbriel priest for a blessing and they'll ask you a question first: what are you trying to forget? Water doesn't forget anything — not a flood, not a debt, not the dead it's taken — and neither will they, on your behalf, no matter how badly you want them to.",
    boon: { name: "Tidewrit's Memory", effect: "Once per long rest, the creature can cast the water breathing spell on itself without expending a spell slot." } },
  { name: "Kordreth", title: "the Bedrock Voice", rank: "minor", pantheon: "The Elemental Concord", parent: "Aetherion", alignment: "Lawful Neutral", domains: ["Earth", "Order"], symbol: "A single unbroken stone pillar, no carving, no ornament.", portfolio: "Mountains, foundations, the patience of things that don't move.", dogma: "A Kordreth temple takes generations to finish, on purpose. Ambition builds fast and forgets fast; Kordreth's clergy would rather still be laying foundation stones long after everyone who started the project is dead, and call that a job well done.",
    boon: { name: "Bedrock's Patience", effect: "Once per long rest, the creature can gain resistance to bludgeoning, piercing, and slashing damage from nonmagical attacks for 1 minute." } },
  { name: "Zephyrine", title: "the Skysong", rank: "minor", pantheon: "The Elemental Concord", parent: "Aetherion", alignment: "Chaotic Good", domains: ["Air", "Trickery"], symbol: "A single feather caught mid-fall, never shown landing.", portfolio: "Wind, flight, the freedom of never staying anywhere long enough to be owned by it.", dogma: "Zephyrine's faithful don't plan routes so much as abandon them the moment something better shows up. Ask one for directions and they'll just shrug — the wind hasn't decided yet, and neither have they.",
    boon: { name: "Skysong's Lift", effect: "Once per long rest, the creature can reduce its falling damage from a single fall to 0, and land on its feet instead of prone." } },

  // ── The Court of Sin — one corrupting major deity (the Hollow Throne, seated in rotation by
  // whichever excess currently holds it) and its seven minors, one per deadly sin.
  { name: "Malvorath", title: "the Hollow Throne", rank: "major", pantheon: "The Court of Sin", parent: null, powerTier: "superrare", alignment: "Neutral Evil", domains: ["Corruption", "Trickery"], symbol: "An empty throne with seven shallow grooves worn into its arms, one per hand that's gripped it.", portfolio: "Corruption as inheritance rather than event — the seven faces (Pride, Greed, Lust, Envy, Gluttony, Wrath, Sloth) that sit the Hollow Throne in rotation, each ruling until its own excess consumes even itself, then ceding the seat to the next.",
    dogma: "There has never been a soul the Hollow Throne couldn't eventually seat, because every soul, examined closely enough, already favors one of the seven grooves worn into its arms. Malvorath doesn't tempt so much as recognize — it finds the excess a mortal already secretly wanted and simply stops asking them to feel bad about wanting it. Its clergy don't preach devotion to Malvorath directly; they preach devotion to whichever of the Seven a given follower already resembles, because the Throne itself has no face of its own to worship, only an absence shaped exactly like whoever sits down in it next.",
    boon: { name: "The Hollow Invitation", effect: "Once per long rest, the creature can grant itself advantage on one Charisma (Deception or Intimidation) check by openly naming, out loud, the specific excess driving its current action. Anyone who hears the admission remembers it exactly, word for word, indefinitely." } },
  { name: "Superbion", title: "Mask of Pride", rank: "minor", pantheon: "The Court of Sin", parent: "Malvorath", alignment: "Lawful Evil", domains: ["Pride", "Trickery"], symbol: "A gilded mask with no eye-holes.", portfolio: "The certainty of being right that survives every piece of contrary evidence.", dogma: "Watch a Superbion follower lose an argument sometime — it's genuinely instructive. They'll concede no point, offer no apology, and somehow walk away looking like they won anyway.",
    boon: { name: "Unbowed Certainty", effect: "Once per long rest, the creature can grant itself advantage on a saving throw against being frightened or charmed, so long as it loudly asserts it isn't afraid first." } },
  { name: "Avaricia", title: "the Gilded Maw", rank: "minor", pantheon: "The Court of Sin", parent: "Malvorath", alignment: "Neutral Evil", domains: ["Greed", "Trade"], symbol: "An open mouth lined with coins instead of teeth.", portfolio: "The itch that having enough never actually scratches.", dogma: "There's no ledger entry in Avaricia's temples marked 'enough' — the column just keeps going, because her faithful have never once reached the bottom of a page and decided to stop there.",
    boon: { name: "The Maw's Appetite", effect: "Once per long rest, when the creature successfully steals, loots, or is paid, it can gain 1d4 temporary hit points, lasting until its next long rest." } },
  { name: "Lysvane", title: "the Velvet Ache", rank: "minor", pantheon: "The Court of Sin", parent: "Malvorath", alignment: "Chaotic Evil", domains: ["Lust", "Trickery"], symbol: "A single rose, thorns filed sharp rather than removed.", portfolio: "Wanting as a weapon, charm as a leash.", dogma: "Lysvane's faithful make wonderful company and terrible creditors, and the two are related: to them, wanting someone and owning someone are the same sentence, just punctuated differently.",
    boon: { name: "Velvet Hook", effect: "Once per long rest, the creature can grant itself advantage on a single Charisma (Persuasion) check made against a creature it has physically touched within the last minute." } },
  { name: "Inviderus", title: "the Jealous Eye", rank: "minor", pantheon: "The Court of Sin", parent: "Malvorath", alignment: "Neutral Evil", domains: ["Envy", "Knowledge"], symbol: "A single lidless eye reflected in a shard of broken glass.", portfolio: "The specific grief of watching someone else have the thing you wanted first.", dogma: "Ask any Inviderus follower what a rival owns and they'll tell you to the coin — not out of generosity with attention, but because they've never once stopped tallying who has more than they do.",
    boon: { name: "The Jealous Eye's Sight", effect: "Once per long rest, the creature can study a magic item another creature is wearing or wielding within 30 feet and learn one of its properties, as though it had briefly worn the item itself." } },
  { name: "Glutonnix", title: "the Endless Table", rank: "minor", pantheon: "The Court of Sin", parent: "Malvorath", alignment: "Chaotic Evil", domains: ["Gluttony", "Excess"], symbol: "A banquet table set for one, stretching further than the eye can follow.", portfolio: "Consumption that never reaches satisfaction, only bigger hunger.", dogma: "Glutonnix throws a wonderful party and is a nightmare to invite anywhere else — there's no such concept as 'too much' at the Endless Table, only 'not yet.'",
    boon: { name: "The Endless Table's Gift", effect: "Once per long rest, the creature can eat or drink something and immediately gain the benefit of a short rest's worth of Hit Dice recovery, without needing an hour or spending any Hit Dice." } },
  { name: "Wrathikar", title: "the Red Hour", rank: "minor", pantheon: "The Court of Sin", parent: "Malvorath", alignment: "Chaotic Evil", domains: ["Wrath", "War"], symbol: "A sundial with only one hour marked, in red.", portfolio: "The hour where reasons stop mattering and only the hitting does.", dogma: "Wrathikar's faithful pick fights fast and drop them just as fast. Anger held too long curdles into something weaker, by their theology — so the only honest thing to do with it is spend it immediately and move on.",
    boon: { name: "The Red Hour's Fury", effect: "Once per long rest, when the creature takes damage, it can use its reaction to gain advantage on its next attack roll before the end of its next turn." } },
  { name: "Torporel", title: "the Long Yawn", rank: "minor", pantheon: "The Court of Sin", parent: "Malvorath", alignment: "Neutral Evil", domains: ["Sloth", "Apathy"], symbol: "An hourglass laid on its side, sand not moving.", portfolio: "The comfort of letting a problem stay somebody else's.", dogma: "Torporel's whole creed fits on a shrug: wait long enough, and it becomes somebody else's emergency. Infuriatingly, his faithful are right about this more often than anyone would like to admit.",
    boon: { name: "The Long Yawn's Patience", effect: "Once per long rest, the creature can treat a failed ability check as though it simply hadn't attempted the task at all — no consequence for the failed attempt occurs, but it also gains no benefit and can't retry until circumstances meaningfully change." } },

  // ── The Deep Wardens — one nature-spanning major deity (the World-Root, the connected system
  // underneath every wild place) and five minors, each tending one face of it directly.
  { name: "Sylvethrane", title: "the World-Root", rank: "major", pantheon: "The Deep Wardens", parent: null, powerTier: "legendary", alignment: "True Neutral", domains: ["Nature", "Life", "Protection"], symbol: "A single root system, drawn as if seen from below the ground, spreading past the frame.", portfolio: "The wild world in its entirety — not any one forest or sea, but the whole connected root system underneath all of them. The Deep Wardens (sea, forest, mountain, frost, desert) are its furthest-reaching branches, each tending one face of it directly.",
    dogma: "Cut down one tree and the World-Root barely notices; cut down the idea that the forest belongs to no one, and Sylvethrane notices everything at once, through every warden that answers to it. It does not love mortals and does not hate them — it extends the same patience to a civilization as to a glacier, which is to say: it will absolutely outlast both, and feels no particular urgency about which outlasts the other first. Its clergy are rare, usually former wardens' faithful who came to understand their patron sea or forest as one limb of something far larger, and they speak of Sylvethrane the way old sailors speak of the ocean itself — with a respect that has nothing sentimental left in it.",
    boon: { name: "Root-Deep Ward", effect: "Once per long rest, the creature can cast the speak with animals and speak with plants spells (as innate spells, no components) and gains advantage on Wisdom (Survival) checks for 1 hour afterward." } },
  { name: "Maerdyn", title: "the Deep Current", rank: "minor", pantheon: "The Deep Wardens", parent: "Sylvethrane", alignment: "Chaotic Neutral", domains: ["Ocean", "Tempest"], symbol: "A single unbroken wave curling into a spiral, never breaking.", portfolio: "The deep ocean beyond any coastline's claim — what lives, hunts, and is lost down there.", dogma: "The shallows belong to sailors; the deep belongs to Maerdyn, and it does not consider these the same domain. What goes down rarely asks to come back up, and Maerdyn's faithful don't pretend otherwise to comfort the grieving.",
    boon: { name: "Current's Pull", effect: "Once per long rest, the creature gains a swimming speed equal to its walking speed for 10 minutes, and can breathe underwater for the same duration." } },
  { name: "Thaelor", title: "the Green Silence", rank: "minor", pantheon: "The Deep Wardens", parent: "Sylvethrane", alignment: "Neutral Good", domains: ["Forest", "Life"], symbol: "A single unbroken canopy of leaves, no trunk visible beneath it.", portfolio: "Old forests, the particular quiet of a place that predates every road leading to it.", dogma: "A forest doesn't need visitors to justify existing, and Thaelor's clergy extend the same courtesy to people — you don't owe usefulness to anyone just for taking up space. Walk quietly, and the Green Silence tends not to mind you.",
    boon: { name: "The Green Silence's Cover", effect: "Once per long rest, the creature can become invisible while remaining perfectly still in natural forest terrain, for up to 10 minutes or until it moves, attacks, or casts a spell." } },
  { name: "Korrigast", title: "the Stone Sentinel", rank: "minor", pantheon: "The Deep Wardens", parent: "Sylvethrane", alignment: "Lawful Neutral", domains: ["Mountain", "Protection"], symbol: "A single watchtower carved from and indistinguishable from the peak it stands on.", portfolio: "High places, the particular loneliness of standing guard where almost nothing ever comes to threaten.", dogma: "Most watches end in nothing happening, and Korrigast's faithful consider that the actual victory, not a disappointment. A guard who's bored for forty years and alert for the one night it mattered did the job perfectly.",
    boon: { name: "Sentinel's Vigil", effect: "Once per long rest, the creature can't be surprised for the next 8 hours, and has advantage on the first Wisdom (Perception) check it makes in that time." } },
  { name: "Yselda", title: "the White Hush", rank: "minor", pantheon: "The Deep Wardens", parent: "Sylvethrane", alignment: "True Neutral", domains: ["Frost", "Death"], symbol: "A single set of footprints in snow, filling back in behind the walker.", portfolio: "Winter as an honest ending rather than a cruelty — the world going quiet and still on its own schedule.", dogma: "The frost isn't punishing anyone; it simply doesn't make exceptions. Yselda's faithful find this more comforting than cruel — a fair cold is better than an unfair warmth.",
    boon: { name: "The White Hush's Stillness", effect: "Once per long rest, the creature gains resistance to cold damage for 1 hour, and doesn't need to make Constitution saving throws to avoid exhaustion from cold environmental extremes during that time." } },
  { name: "Rakhet", title: "the Sand Mourner", rank: "minor", pantheon: "The Deep Wardens", parent: "Sylvethrane", alignment: "True Neutral", domains: ["Desert", "Endurance"], symbol: "A single dune, mid-shift, half-collapsed.", portfolio: "The desert's slow grief for everything it used to be before it was a desert.", dogma: "Every desert was something else first, and Rakhet remembers all of them, which is why its faithful never mock a wasteland — they know what it cost to become one. Endure what you can't yet change.",
    boon: { name: "Mourner's Endurance", effect: "Once per long rest, the creature doesn't need to eat, drink, or sleep for the next 24 hours, and gains resistance to fire damage during that time." } },
];

// Original content -- see this file's header. "Supernatural gifts and rewards" beyond the SRD is
// specific-sourcebook material (a boon granted at a cost, usually tied to a traumatic or
// transformative event); written fresh here in the same spirit rather than copied.
const GIFT_LIBRARY = [
  // ── Gifts — the original 10, unchanged apart from an added type tag. A costly boon tied to a
  // single traumatic or transformative event; always a real drawback attached.
  { name: "The Fed Grave", type: "Gift", trigger: "A creature that spent a full night alone in a graveyard during a storm, and chose of its own will to stay until dawn, earns this.", benefit: "Once per long rest, the creature can touch a dying creature (0 hp, failing death saves) to stabilize it automatically and grant it 1 hit point.", drawback: "The recipient can now sense the exact location of every corpse within 100 feet, awake or asleep, and cannot turn this sensing off." },
  { name: "The Borrowed Second", type: "Gift", trigger: "Survive a fall or blow that should have killed you outright, through pure chance rather than skill, and this follows.", benefit: "Once per long rest, when the creature would be reduced to 0 hit points, it can instead drop to 1 hit point.", drawback: "Each time this triggers, the creature loses a random, specific short-term memory (something from the last week) — not chosen by the player, determined by the DM." },
  { name: "The Unclosing Wound", type: "Gift", trigger: "Bear a fatal injury meant for someone else, willingly, and live — that's what calls this down.", benefit: "The creature's Constitution score increases by 1 (to a maximum of 22), reflecting a body that has learned, at cost, how to endure.", drawback: "A specific old wound never fully closes and reopens under stress — whenever the creature drops below half its hit point maximum in combat, it takes 1 additional point of damage from the reopening, once per combat." },
  { name: "The Listening Debt", type: "Gift", trigger: "Keep a costly promise to a dying stranger with nothing to gain from it, and something answers.", benefit: "The creature can cast speak with dead once per long rest without expending a spell slot.", drawback: "Every corpse the creature speaks with this way leaves behind a fragment of unfinished business that follows the creature as a nagging compulsion until addressed — the DM decides what, and it's never trivial." },
  { name: "The Split Reflection", type: "Gift", trigger: "Look directly into a scrying pool, mirror, or still water controlled by something genuinely otherworldly, and don't look away — this is what's left afterward.", benefit: "Once per long rest, the creature can cast see invisibility on itself without expending a spell slot.", drawback: "The creature's reflection now moves a half-second out of sync with its actual body, visible to anyone who looks closely (a passive Perception 15 or better notices without being told to look)." },
  { name: "The Weight Forgiven", type: "Gift", trigger: "A creature that forgave someone — sincerely, without coercion, for something that actually did lasting harm — carries this ever after.", benefit: "The creature has advantage on saving throws against being frightened.", drawback: "The creature can no longer hold a grudge even when it consciously wants to — any anger it tries to nurse fades within 24 hours regardless of the provocation, which can read as unsettling detachment to people who expect a normal reaction." },
  { name: "The Counted Breath", type: "Gift", trigger: "Drown, get revived, and remember the in-between clearly: that's the price of admission.", benefit: "The creature can hold its breath for twice the normal duration, and automatically stabilizes if reduced to 0 hit points while underwater.", drawback: "The creature has recurring, vivid dreams of drowning several times a week, and waking from one always costs it the benefit of a short rest that night (it can still take the rest, but gains none of its normal benefits) unless someone else is present while it sleeps." },
  { name: "The Given Name", type: "Gift", trigger: "Learn the true, secret name of something old and powerful, and choose not to use it — the restraint itself gets rewarded.", benefit: "Once per long rest, the creature can force one creature within 30 feet to have disadvantage on its next saving throw, by speaking a fragment of the true name it carries.", drawback: "Whatever the creature learned the name from now knows this creature's own true name in return, and can always find them if it chooses to look." },
  { name: "The Late Harvest", type: "Gift", trigger: "Give away food or resources you desperately needed to someone who needed them more, expecting to die for it, and don't — this is what's left of that gamble.", benefit: "The creature no longer needs to eat, though it can still choose to for pleasure or social reasons, and is immune to the effects of starvation.", drawback: "The creature can no longer taste anything with real intensity — food is simply texture and temperature to it now, and it knows exactly what it gave up." },
  { name: "The Last Word", type: "Gift", trigger: "Be present at the true, final death of something ancient — not merely old, something that had actually earned the word — and speak to it with respect instead of fear.", benefit: "Once per long rest, the creature can reroll one failed saving throw.", drawback: "The creature occasionally speaks a sentence in a language it doesn't know, at seemingly random moments, always something the dying ancient thing might plausibly have wanted said — the DM decides the content and timing." },

  // ── Boons — smaller than a Gift, usually tied to a specific, repeatable kind of act rather
  // than a single unique trauma; several echo the pantheon above without requiring the recipient
  // to actually worship that deity. Drawback is present but milder than a Gift's.
  { name: "Ember-Touched", type: "Boon", trigger: "Carry a flame — lantern, torch, campfire ember — through a night that should have put it out, and the flame remembers.", benefit: "Once per short rest, the creature can ignite a small unattended flammable object with a touch, no action required beyond the touch itself.", drawback: "The creature's body runs slightly warm to the touch now, noticeable to anyone who shakes its hand or embraces it." },
  { name: "Tideborn", type: "Boon", trigger: "Born during a storm at sea, or nearly drowned as a child and pulled back by someone who refused to let go — either origin qualifies.", benefit: "The creature can hold its breath for triple the normal duration and always knows which direction leads to the nearest large body of water.", drawback: "The creature feels a persistent, mild unease on dry land more than a day's travel from any water source." },
  { name: "Stonebound", type: "Boon", trigger: "A full year spent working stone — mason, miner, sculptor, doesn't matter which — without complaint, leaves its mark.", benefit: "The creature has advantage on checks made to determine whether stone or earthen structures are stable, and can always tell true stone from an illusion or construct mimicking it.", drawback: "The creature moves 5 feet slower than normal whenever it isn't touching natural earth or stone." },
  { name: "Windcaught", type: "Boon", trigger: "Jump or fall from a great height and survive by trusting the wind instead of fighting it.", benefit: "The creature takes no damage from the first 20 feet of any fall.", drawback: "The creature is unusually vulnerable to strong wind effects — it has disadvantage on Strength saving throws made specifically against being moved or knocked prone by wind." },
  { name: "The Seventh Groove", type: "Boon", trigger: "Indulge fully, once, in one of the seven deadly excesses — a single unforgettable act — and live with what it cost instead of hiding from it. Call it granted, or call it inflicted; the recipients rarely agree on which.", benefit: "Once per long rest, the creature can grant itself advantage on one ability check directly related to its chosen excess (Intimidation for Wrath, Persuasion for Lust, Sleight of Hand for Greed, and so on — DM's discretion).", drawback: "Other creatures who share the same excess recognize it in the creature almost immediately, for better or worse." },
  { name: "Root-Marked", type: "Boon", trigger: "Plant something. Come back years later, specifically to see what it grew into. That's the whole ritual.", benefit: "The creature can communicate simple concepts and emotions with normal plants and trees, though they can't answer with anything more sophisticated than they'd naturally express.", drawback: "The creature feels genuine, undramatic grief whenever it witnesses natural forest being burned or clear-cut, distracting enough to impose disadvantage on its next check unless it takes a moment to acknowledge the loss first." },
  { name: "Deep-Kept", type: "Boon", trigger: "Lost at sea, and chose not to panic — drifted for days until rescue or shore found you instead.", benefit: "The creature always knows its approximate depth and distance from the nearest shore or surface while in open water.", drawback: "The creature sleeps poorly on solid ground, and doesn't gain the full benefit of a long rest unless it spends at least part of the night near open water, or dreams that it did." },
  { name: "Frostwoken", type: "Boon", trigger: "Buried in snow or ice for far longer than anyone should survive, and walked away from it.", benefit: "The creature is immune to the effects of extreme cold as a natural hazard (not to cold damage from attacks or spells), and doesn't require extra protection to avoid exhaustion in cold climates.", drawback: "The creature's body temperature runs low enough that mundane thermometers and some magical detection read it as unusually, sometimes alarmingly, cold — occasionally mistaken for undead by the overly cautious." },
  { name: "Ashen Bargain", type: "Boon", trigger: "Strike a real, informed bargain with something demonic or fiendish, and hold up your exact end — no more, no less.", benefit: "Once per long rest, the creature can ask a question of the DM about a creature's true nature — is it lying, is it what it appears to be, does it mean harm — and receive a single true word or short phrase in answer.", drawback: "The creature is now recognizably marked to other fiends and demonically attuned creatures as someone who's made a bargain before, which occasionally invites unwanted attention or offers." },
  { name: "Sandwalker's Patience", type: "Boon", trigger: "Cross a genuinely dangerous stretch of wasteland or desert alone, on foot, having made peace with the real chance you wouldn't.", benefit: "The creature needs only half the normal food and water to avoid the effects of hunger and thirst.", drawback: "The creature has grown so accustomed to discomfort that it has disadvantage on Wisdom (Insight) checks made to recognize when it's pushing itself dangerously past its own limits." },

  // ── Blessings — the gentlest tier, granted for virtuous or devotional acts rather than trauma.
  // Drawbacks here are mild responsibilities or narrow limitations, not curses — a few carry none
  // at all, which is itself part of the point of a Blessing as distinct from a Gift.
  { name: "Blessing of the Kept Word", type: "Blessing", trigger: "A promise kept at real personal cost — when breaking it would have been easy, and no one would ever have known.", benefit: "The creature's word is subtly, magically binding in a small way — once per long rest, a promise it makes aloud grants the listener advantage on their next Insight check to determine if the creature is being truthful about anything else.", drawback: "The creature has disadvantage on Deception checks made against anyone it has ever made a promise to, even a small one." },
  { name: "Blessing of the Open Hand", type: "Blessing", trigger: "Give freely to a stranger, more than once, expecting nothing back.", benefit: "Once per long rest, the creature can share the benefit of its own short rest's Hit Dice recovery with another creature within 5 feet, without spending an extra Hit Die of its own.", drawback: "None of real consequence — the creature simply finds it a little harder than most to turn away a genuine request for help." },
  { name: "Blessing of the Steady Watch", type: "Blessing", trigger: "Stand guard alone through an entire dangerous night, and never once abandon the post.", benefit: "The creature only needs 4 hours of sleep to gain the full benefit of a long rest.", drawback: "The creature finds it noticeably harder to relax or fully rest in unfamiliar or unsecured locations, at the DM's discretion in especially tense scenes." },
  { name: "Blessing of the First Light", type: "Blessing", trigger: "Help someone find their way out of true darkness — literal or otherwise — and want nothing for it.", benefit: "The creature sheds dim light in a 5-foot radius whenever it chooses to, at will, as a free action.", drawback: "The creature cannot willingly extinguish this light while genuinely frightened, making it harder to hide in the dark during moments of real fear." },
  { name: "Blessing of the Unbroken Line", type: "Blessing", trigger: "Carry on a family's or mentor's tradition faithfully, even when it costs your own ambitions something real.", benefit: "The creature has advantage on checks made using any skill or tool proficiency it learned directly from a parent, mentor, or predecessor.", drawback: "The creature has disadvantage on checks made to act directly against the wishes or legacy of that same parent, mentor, or predecessor, even when it knows it's the right call." },
  { name: "Blessing of the Quiet Grief", type: "Blessing", trigger: "Mourn a real loss all the way through — no numbing it, no rushing past it — and come out the other side intact.", benefit: "The creature has advantage on saving throws against being frightened, charmed, or forced to relive a traumatic memory by magical means.", drawback: "The creature occasionally (rare, DM's discretion) feels the full weight of that old grief again, unprompted, distracting enough to cost it its next reaction." },
  { name: "Blessing of the Mended Bridge", type: "Blessing", trigger: "Repair a relationship you actually broke, through real effort and not just an apology.", benefit: "Once per long rest, the creature can grant advantage to another creature's next Persuasion or Insight check, so long as the creature is actively helping in that conversation.", drawback: "The creature has disadvantage on Deception checks made against anyone it's reconciled with this way, permanently." },
  { name: "Blessing of the Long Watch's End", type: "Blessing", trigger: "Finally set down a duty or vigil carried for years, and trust someone else to pick it up.", benefit: "The creature no longer suffers disadvantage from a single specific source of exhaustion the DM designates as tied to its old duty, representing a genuine weight lifted.", drawback: "The creature occasionally feels a pang of doubt about having let go, which the DM can invoke once to impose disadvantage on a single check at a dramatically appropriate moment." },
  { name: "Blessing of the Shared Meal", type: "Blessing", trigger: "Feed a genuine enemy at your own table, under a truce neither side breaks.", benefit: "The creature and anyone who shares a meal with it in good faith gain advantage on their next Wisdom (Insight) check made against each other, for the next 24 hours.", drawback: "The creature has disadvantage on the same Insight checks against anyone it has ever broken bread with under false pretenses." },
  { name: "Blessing of the Second Chance", type: "Blessing", trigger: "Forgive yourself, genuinely, for a real failure — not denying it happened, not punishing yourself forever for it either.", benefit: "Once per long rest, the creature can reroll a failed ability check and take the better result.", drawback: "None — this blessing, unusually, asks nothing back. Its faithful consider that the entire point." },
];

// Original content -- see this file's header. Feats beyond the SRD's bare ability-score-
// improvement rule are PHB/sourcebook content, not SRD; written fresh here. Effect text follows
// the same "+N Stat"/"+N Skill" phrasing the rest of the app already scans for (equipped-item
// effects, active timed effects) so a selected feat's numeric bonus is picked up automatically by
// the character sheet -- see FEAT_LIBRARY's consumers in the main file (toggleFeat, the
// computeCharacterSheetFor call sites that fold selected feats' text into the same
// addActiveEffectDeltas pass equipped gear already goes through).
const FEAT_LIBRARY = [
  { name: "Battle-Hardened Reflexes", description: "+1 Dexterity. You have advantage on initiative rolls." },
  { name: "Iron Constitution", description: "+1 Constitution. You have advantage on saving throws against poison, and resistance to poison damage." },
  { name: "Keen Senses", description: "+2 Perception. You can't be surprised while conscious, unless you're incapacitated." },
  { name: "Silver Tongue", description: "+1 Charisma. You have advantage on Persuasion checks against a creature that has never met you before." },
  { name: "Unshakeable Resolve", description: "+2 to saving throws against being frightened. Once per long rest, you can end the frightened condition on yourself as a bonus action." },
  { name: "Warded Mind", description: "+1 Wisdom. You have resistance to psychic damage, and advantage on saving throws against being charmed." },
  { name: "Scarred Survivor", description: "+1 Constitution. Once per long rest, when an attack would reduce you to 0 hit points but not kill you outright, you can choose to drop to 1 hit point instead." },
  { name: "Diplomat's Instinct", description: "+2 Insight. Once per short rest, you can tell with certainty whether a creature you can see is being deliberately deceptive in what it's currently saying." },
  { name: "Hardened Grip", description: "+1 Strength. You have advantage on checks and saving throws made to avoid being disarmed, grappled, or shoved." },
  { name: "Lucky Break", description: "Once per long rest, when you fail a saving throw, you can reroll it and must use the new result." },
  { name: "Swift Runner", description: "Your walking speed increases by 10 feet. Difficult terrain no longer costs you extra movement when you Dash." },
  { name: "Steady Aim", description: "If you haven't moved yet on your turn, your first attack roll that turn has advantage." },
  { name: "Arcane Aptitude", description: "+1 Intelligence. You learn one cantrip of your choice from any spell list (DM's discretion on how it's cast if your character has no other spellcasting)." },
  { name: "Precise Striker", description: "Choose one weapon type you're proficient with. You have a +1 bonus to attack rolls made with that weapon type." },
  { name: "Battlefield Coordinator", description: "Once per combat as a bonus action, you can direct up to two allies within 30 feet who can hear you; each gains a +2 bonus to their next initiative-order action's attack roll or ability check." },
  { name: "Painstaking Tracker", description: "+2 Survival. You can follow tracks at a normal travel pace without disadvantage, and you always know roughly how old a trail is." },
  { name: "Sure-Footed Climber", description: "+1 Strength. You have advantage on Strength (Athletics) checks made to climb, and difficult terrain from ice, rubble, or loose ground never slows your climbing speed." },
  { name: "Practiced Liar", description: "+2 Deception. A creature must succeed on a Wisdom (Insight) check contested by your Deception check to see through one of your lies, even if they had no prior reason to be suspicious of you." },
  { name: "Forged Papers", description: "+1 Charisma. You have advantage on checks made to pass yourself off as someone else when presenting false documents, credentials, or a cover identity." },
  { name: "Field Medic", description: "+2 Medicine. When you use a healer's kit to stabilize a dying creature, they also regain 1 hit point, and stabilizing them only costs you a bonus action instead of an action." },
  { name: "Deep Lungs", description: "+1 Constitution. You can hold your breath for twice as long as normal, and you gain one additional round before you start suffocating." },
  { name: "Cat's Grace", description: "+2 Acrobatics. You take no damage from a fall of 20 feet or less, and only half damage from any fall beyond that." },
  { name: "Scholar's Memory", description: "+2 to one skill of your choice among History, Arcana, Religion, or Nature. Once per long rest, you can recall a genuinely useful fact about a place, creature, or object without needing to roll for it." },
  { name: "Beast Whisperer", description: "+2 Animal Handling. Beasts start friendly toward you unless you've given them a reason not to be, and you can communicate simple ideas to them through gesture and tone alone." },
  { name: "Shadow Step", description: "+1 Dexterity. You have advantage on Dexterity (Stealth) checks made while in dim light or darkness." },
  { name: "Iron Stomach", description: "+1 Constitution. You have advantage on saving throws against disease, and spoiled food or bad water can't make you sick." },
  { name: "Quartermaster's Eye", description: "+2 Investigation. You always know the exact number of charges, rounds, or uses remaining on any item you're carrying, and you have advantage on checks to appraise an item's real worth." },
  { name: "Counterspell Instinct", description: "You have advantage on Intelligence, Wisdom, and Charisma saving throws against spells, provided you're aware a spell is being cast." },
  { name: "Ritual Scholar", description: "Once per long rest, you can cast a 1st-level spell with the ritual tag (DM's choice of an appropriate spell) as a ritual without expending a spell slot, even if you don't otherwise have ritual casting." },
  { name: "Sharpened Instincts", description: "+1 Wisdom. You add your proficiency bonus to initiative rolls, in addition to your Dexterity modifier." },
  { name: "Bulwark Stance", description: "+1 Constitution. While you haven't moved on your turn, you have resistance to bludgeoning, piercing, and slashing damage from attacks made by a creature you can see." },
  { name: "Second Wind's Edge", description: "Once per short rest, when you reduce a creature to 0 hit points, you can immediately move up to half your speed without provoking opportunity attacks." },
  { name: "Merchant's Instinct", description: "+2 Persuasion. You always get the best honest price a merchant is willing to offer, and you have advantage on checks made to haggle one down further." },
  { name: "Rally Cry", description: "Once per long rest as an action, you shout a rallying word — up to three allies within 30 feet who can hear you gain advantage on the next saving throw they make within 1 minute." },
  { name: "Hunter's Focus", description: "+1 Wisdom. When you hit the same creature with a second attack on your turn, that attack deals an extra 1d4 damage of the weapon's type." },
  { name: "Escape Artist", description: "+2 Acrobatics. You have advantage on checks and saving throws made to escape a grapple or restraint, and doing so doesn't cost you any of your movement." },
  { name: "Whisper Network", description: "+1 Charisma. In any settlement you've spent at least a day in, you can find a rumor or a person willing to talk, given an hour and a few coins for drinks." },
  { name: "Stone-Cold Nerves", description: "+2 to saving throws against being stunned or paralyzed." },
  { name: "Arcane Ward", description: "+1 Intelligence. Once per long rest, when you take damage, you can reduce it by an amount equal to your Intelligence modifier plus your proficiency bonus, as a shimmering ward briefly flares around you." },
  { name: "Efficient Traveler", description: "Your presence never slows your party's overland travel pace, and your group can go twice as long as normal before running low on rations or needing to forage." },
  { name: "Duelist's Reflex", description: "+1 Dexterity. Once per turn, when a creature you can see misses you with a melee attack, you can use your reaction to make a melee attack against them." },
  { name: "Grim Determination", description: "When you roll a 1 on a death saving throw, it counts as a single failure instead of two." },
  { name: "Silver Sight", description: "+1 Wisdom. You gain darkvision out to 60 feet; if you already have darkvision, its range increases by 30 feet instead." },
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

// Original content -- see this file's header. The mechanical summary of each "Fragment of
// Suffering" legendary/celestial item (full flavor text and unlock tiers live on the items
// themselves in loot-data.js) -- this is the quick-reference version: what it grants, what it
// costs, at a glance, without having to open each item's own card.
const FRAGMENT_LIBRARY = [
  { name: "Fragment of Grief", emotion: "Grief", rarity: "Celestial", benefit: "+3 Wisdom while attuned. Once per long rest, cast Revivify on a dying creature within 30 ft. for free, restoring half its hit point maximum instead of just 1 HP.", drawback: "On finishing a long rest, DC 14 Wisdom save or regain no Hit Dice from that rest at all." },
  { name: "Fragment of Rage", emotion: "Rage", rarity: "Celestial", benefit: "+3 Strength while attuned. Once per turn on a melee hit, deal an extra 3d6 damage.", drawback: "Below half HP, cannot willingly end your turn without attacking or advancing on the nearest enemy." },
  { name: "Fragment of Dread", emotion: "Fear", rarity: "Celestial", benefit: "+3 Charisma while attuned. Once per short rest, Frighten every creature of your choice within 30 ft. (DC 16 Wisdom) — failing by 5+ also drops their weapon and forces a flee next turn.", drawback: "Once per day, a secret DC 14 Wisdom save or you must spend your next turn fleeing the nearest threat, real or not." },
  { name: "Fragment of Envy", emotion: "Envy", rarity: "Celestial", benefit: "+3 Dexterity while attuned. Once per long rest, force a reroll of any attack roll, check, or save within 30 ft. (including your own) and assign the better result to whichever roll you choose.", drawback: "Disadvantage on Persuasion checks toward anyone you believe is wealthier, more accomplished, or more envied than you." },
  { name: "Fragment of Despair", emotion: "Despair", rarity: "Celestial", benefit: "+3 Constitution while attuned. Resistance to all damage while below half HP.", drawback: "Whenever a nearby ally drops to 0 HP, DC 16 Wisdom save or become Poisoned until your next turn ends." },
  { name: "Fragment of Ecstasy", emotion: "Ecstasy", rarity: "Celestial", benefit: "+3 Charisma while attuned. Once per long rest, cast Mass Cure Wounds for free.", drawback: "Cannot willingly harm a creature that isn't currently attacking you or an ally." },
  { name: "Fragment of Guilt", emotion: "Guilt", rarity: "Celestial", benefit: "+3 Wisdom while attuned. Once per day, turn a failed save into a success by passing it to a nearby ally instead.", drawback: "Knowingly harming an innocent grants a level of Exhaustion no rest can remove — only atonement can." },
  { name: "Fragment of the Hollow", emotion: "Emotional Void", rarity: "Celestial", benefit: "+3 to saves against Charmed/Frightened/Possessed while attuned. Immune to divination detection; once per long rest, become fully unreadable for 1 minute (advantage on Deception, immune to intent/emotion-revealing effects).", drawback: "Immune to morale-based buffs (Bardic Inspiration and the like); disadvantage on Charisma checks requiring genuine emotion." },
];
