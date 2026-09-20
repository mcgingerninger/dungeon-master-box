// ===================== TRAPS & HAZARDS LIBRARY DATA =====================
// Backing data for the Compendium's Traps & Hazards sub-tab (see renderTrapsCompendium in the
// main file) and the DM's "Apply Trap to Player" tool. Split into its own file the same way
// loot-data.js/puzzle-data.js are — pure content, no logic, loaded via a plain <script src>
// before the main file's own script block runs.
//
// Original content written for this project (not transcribed from any published sourcebook) --
// covers the same functional territory as classic dungeon trap/hazard archetypes (a pressure-
// plate dart trap, a collapsing floor, a poison gas cloud) with each entry's own specific name,
// trigger, and flavor.
//
// One shape, used by both TRAP_LIBRARY (triggered, mechanical or magical devices) and
// HAZARD_LIBRARY (passive/ambient environmental dangers):
//   {
//     name: "Short Name",
//     tier: "setback" | "dangerous" | "deadly",   // rough severity, for picking one at a glance
//     trigger: "what sets it off (traps) or how a creature encounters it (hazards)",
//     description: "read-aloud/DM-facing text describing what happens",
//     saveAbility: "DEX"|"CON"|"WIS"|"STR"|"INT"|"CHA"|null,   // null = no save, effect is automatic
//     saveDC: number|null,
//     damage: "NdN"|null,        // total damage dice, e.g. "2d10" — null if the entry deals no damage
//     damageType: "piercing"|"bludgeoning"|"fire"|... |null,
//     condition: "Poisoned"|"Restrained"|"Prone"|"Blinded"|"Unconscious"|null,  // on a failed save (or always, if saveAbility is null)
//     conditionDuration: "1 minute"|"until cured"|... |null,   // null = lasts until day roll (see applyTrapEffectToState)
//     note: "DM guidance — detection/disarm DC, half-damage-on-save wording, follow-up complications",
//   }
//
// `description`/`note` are free text for reading at the table; `saveAbility`/`saveDC`/`damage`/
// `damageType`/`condition`/`conditionDuration` are the structured fields the Apply-to-Player tool
// actually reads — kept as real fields rather than re-parsed out of the prose, since this data is
// authored fresh rather than lifted from an existing stat-block format worth reusing a parser for.

const TRAP_LIBRARY = [
  {
    name: "Whispering Dart Plate",
    tier: "setback",
    trigger: "Stepping on a discolored floor tile releases a puff of chalky dust and triggers a spring-loaded dart battery in the nearest wall.",
    description: "A faint click precedes a hiss of dust from the tile underfoot. A cluster of darts snaps out of a wall panel at knee height.",
    saveAbility: "DEX", saveDC: 12, damage: "1d4", damageType: "piercing", condition: null, conditionDuration: null,
    note: "Perception DC 12 to spot the discolored tile before stepping on it; Investigation DC 12 on the wall panel finds the dart battery. Thieves' Tools DC 12 disarms it. Half damage on a successful save.",
  },
  {
    name: "Groaning Floor Panel",
    tier: "setback",
    trigger: "Weight on a section of rotten or deliberately weakened flooring causes it to give way.",
    description: "The floorboard groans, splinters, and drops out from underfoot, dumping whoever's standing on it into the crawlspace below.",
    saveAbility: "DEX", saveDC: 11, damage: "1d6", damageType: "bludgeoning", condition: "Prone", conditionDuration: "1 round",
    note: "A successful save means the creature catches the edge and scrambles back, taking no damage and staying upright. On a fail, they drop through, take the damage, and land Prone. Perception DC 13 to notice the panel is unsound before it gives.",
  },
  {
    name: "Screaming Ward Glyph",
    tier: "setback",
    trigger: "A rune scratched into a doorframe or floor activates when crossed by anyone who doesn't speak the ward's command phrase aloud first.",
    description: "The glyph flares violet and shrieks a single ear-splitting note that carries for hundreds of feet.",
    saveAbility: null, saveDC: null, damage: null, damageType: null, condition: null, conditionDuration: null,
    note: "No damage — this is an alarm trap. Anything nearby that might respond to the noise (guards, a monster, the dungeon's owner) is alerted to the party's location and approximate numbers. Arcana DC 13 identifies the glyph as a ward before triggering it; a successful DC 13 Intelligence (Arcana) check while examining it reveals the command phrase scrawled nearby in a hidden notch.",
  },
  {
    name: "Sootneedle Lock",
    tier: "setback",
    trigger: "Picking the lock on the warded chest/door without first disarming the needle mechanism inside the keyhole.",
    description: "A thin needle jabs out of the lock mechanism and retracts almost too fast to see, leaving a bead of dark fluid on the fingertip.",
    saveAbility: "CON", saveDC: 12, damage: "1d4", damageType: "poison", condition: "Poisoned", conditionDuration: "1 hour",
    note: "Triggers automatically on a failed Thieves' Tools check to pick the lock (no separate save to trigger it, just the save above to resist the poison). A successful Perception DC 14 check beforehand spots the needle's tip in the keyhole.",
  },
  {
    name: "Wickerframe Collapse",
    tier: "dangerous",
    trigger: "A section of tunnel ceiling braced with rotten wooden supports gives way when disturbed (loud noise, a support beam struck, excess weight).",
    description: "Dust sifts down first, then the supports crack all at once and a section of ceiling comes down in a roar of stone and timber.",
    saveAbility: "DEX", saveDC: 14, damage: "3d10", damageType: "bludgeoning", condition: "Restrained", conditionDuration: "until cured",
    note: "A creature that fails is buried in rubble (Restrained) until freed with a DC 14 Strength check (by itself or an ally) or the rubble is cleared. Half damage and no Restrained condition on a successful save. Investigation DC 13 on the support beams beforehand reveals they're rotten.",
  },
  {
    name: "Flooded Vault Seal",
    tier: "dangerous",
    trigger: "Unsealing a watertight door/hatch that was holding back an adjoining flooded chamber.",
    description: "The seal breaks with a groan and a wall of cold water bursts through, filling the chamber in seconds.",
    saveAbility: "STR", saveDC: 13, damage: "2d6", damageType: "bludgeoning", condition: "Prone", conditionDuration: "1 round",
    note: "A failed save means the creature is swept off its feet and slammed against the nearest wall or obstruction; a success means they brace and stay upright, taking no damage. Once the initial surge passes, the chamber remains flooded (see the Flooded Chamber hazard) until drained.",
  },
  {
    name: "Emberbrand Rune Line",
    tier: "dangerous",
    trigger: "Crossing a painted or carved line of runes without a matching sigil (worn, spoken, or drawn on the crosser).",
    description: "The runes ignite in sequence with a crackling hiss, and a wall of flame erupts along the entire line.",
    saveAbility: "DEX", saveDC: 14, damage: "4d6", damageType: "fire", condition: null, conditionDuration: null,
    note: "Half damage on a successful save. The flame wall persists for 1 round after triggering, meaning a creature moving back across it a second time in the same round takes the damage again. Arcana DC 14 identifies the rune sequence and what sigil would disarm it.",
  },
  {
    name: "Sablesting Cloud Vent",
    tier: "dangerous",
    trigger: "Disturbing a pressure-sensitive vent hidden in a wall or ceiling releases a cloud of fine toxic powder into the room.",
    description: "A soft hiss from a hidden vent fills the air with a shimmering dark haze that stings the eyes and throat.",
    saveAbility: "CON", saveDC: 13, damage: "2d8", damageType: "poison", condition: "Poisoned", conditionDuration: "10 minutes",
    note: "The cloud fills a 15-foot cube and lingers for 1 minute unless dispersed by a strong wind. Every creature that starts its turn in the cloud must save again. Half damage and no Poisoned condition on a successful save.",
  },
  {
    name: "Gravebind Snare",
    tier: "dangerous",
    trigger: "Stepping past a hidden tripwire triggers a weighted net rigged in the rafters above.",
    description: "A heavy net drops from the shadows overhead, weighted at the corners with iron shot, and cinches tight on landing.",
    saveAbility: "DEX", saveDC: 13, damage: null, damageType: null, condition: "Restrained", conditionDuration: "until cured",
    note: "A restrained creature (or an adjacent ally) can break free with a DC 13 Strength check, or the net can be cut apart (AC 10, 5 hit points). Perception DC 13 spots the tripwire; a rogue or similarly trained character can also feel it out with a Investigation check while moving carefully.",
  },
  {
    name: "Corpsecandle Trigger",
    tier: "deadly",
    trigger: "Removing an item from an altar, sarcophagus, or shrine without first neutralizing the ward woven into it.",
    description: "The candles ringing the altar all gutter to black simultaneously, and a wave of graveyard cold rolls outward.",
    saveAbility: "CON", saveDC: 16, damage: "6d8", damageType: "necrotic", condition: null, conditionDuration: null,
    note: "Half damage on a successful save. A creature reduced to 0 hit points by this trap dies instantly rather than falling unconscious, per the ward's design — flag this clearly to the table before it resolves. Religion or Arcana DC 15 identifies the ward and the correct rite/offering to neutralize it.",
  },
  {
    name: "Chokedust Furnace Vent",
    tier: "deadly",
    trigger: "Opening a sealed furnace door or grate releases superheated ash and smoke built up inside.",
    description: "The seal breaks and a gout of searing ash and smoke roars out, choking the chamber in seconds.",
    saveAbility: "CON", saveDC: 15, damage: "5d6", damageType: "fire", condition: "Blinded", conditionDuration: "1 minute",
    note: "Half damage and no Blinded condition on a successful save. The smoke fills a 20-foot cube and doesn't disperse for several minutes without a strong draft, so anyone who lingers or re-enters saves again.",
  },
  {
    name: "Sundering Pendulum",
    tier: "deadly",
    trigger: "A hidden mechanism releases a massive scything blade that sweeps a long corridor when the party is roughly in the middle of it.",
    description: "A grinding chain overhead is the only warning before an enormous curved blade swings the width of the hall at chest height.",
    saveAbility: "DEX", saveDC: 15, damage: "6d10", damageType: "slashing", condition: null, conditionDuration: null,
    note: "Half damage on a successful save. The blade resets and swings again every 3 rounds until the mechanism (usually a gear cluster in an alcove partway down the corridor) is jammed or destroyed (AC 15, 20 hit points). Perception DC 15 to notice the ceiling track before the first swing.",
  },
  {
    name: "Tongue-Binding Ward",
    tier: "setback",
    trigger: "Speaking a knowingly false statement aloud while within a warded courtroom, shrine, or bargaining circle.",
    description: "The moment the lie leaves their lips, the liar's throat seizes shut mid-word, as if the air itself refused to carry it.",
    saveAbility: "CHA", saveDC: 13, damage: null, damageType: null, condition: "Silenced", conditionDuration: "1 minute",
    note: "No damage — purely a social/interrogation trap. A successful save means the ward strains against the lie but doesn't quite catch it (visibly, to anyone watching closely — Insight DC 13 notices the moment of resistance). Arcana or Religion DC 13 identifies the ward's presence beforehand from the telltale circle inscribed underfoot.",
  },
  {
    name: "Vain Glass",
    tier: "setback",
    trigger: "Looking into an enchanted mirror or polished surface and speaking a compliment to one's own reflection.",
    description: "The glass warms and flatters back, and for a long moment it's genuinely difficult to look away from oneself.",
    saveAbility: "CHA", saveDC: 12, damage: null, damageType: null, condition: "-2 Perception (Self-Absorbed)", conditionDuration: "10 minutes",
    note: "No damage. Meant as a comedic or narrative complication (missing something important happening nearby) rather than a threat. Insight DC 12 beforehand senses something's slightly off about how the mirror responds. A creature immune to being charmed automatically succeeds.",
  },
  {
    name: "Court of Flushed Faces",
    tier: "dangerous",
    trigger: "Attempting to deceive someone while standing within a noble court, inquisitor's chamber, or negotiation hall warded against dishonesty.",
    description: "Nothing dramatic happens — no flash, no sound — but the liar's face visibly flushes and their voice catches just enough for anyone paying attention to notice.",
    saveAbility: "CHA", saveDC: 14, damage: null, damageType: null, condition: "-3 Persuasion and -3 Deception (Visibly Caught Lying)", conditionDuration: "1 hour",
    note: "No damage — the cost is entirely social. Every witness present (Insight DC 10, easy, since the ward does most of the work) clocks the tell, and word of it tends to travel exactly as far as it's inconvenient for the party. Arcana DC 14 identifies the ward beforehand from the room's subtle inlay pattern.",
  },
  {
    name: "The Debt Collector's Mark",
    tier: "setback",
    trigger: "Cheating at a warded game of chance, or reneging on a bargain sealed in the presence of the mark's owner (a guild, a fence, a black-market broker).",
    description: "Nothing visible happens at the time. Later, in dim light, a faint brand becomes visible on the back of the offender's hand — one only certain people know to look for.",
    saveAbility: null, saveDC: null, damage: null, damageType: null, condition: "Marked for Collection", conditionDuration: "until cured",
    note: "No save, no damage — this is a pure plot-hook trap. The mark is invisible in normal light (Investigation DC 15 or a detect magic spell reveals it) but instantly recognizable to anyone connected to whoever set it, who can use it to locate the marked creature at the DM's convenience. Removing it requires either paying the debt in full or a Remove Curse-equivalent effect.",
  },
];

const HAZARD_LIBRARY = [
  {
    name: "Grasping Bog",
    tier: "setback",
    trigger: "Wading or walking into an unstable patch of wet mud or bog without testing the ground first.",
    description: "The ground gives way underfoot into thick, sucking mud that clings to boots and cloth alike.",
    saveAbility: "STR", saveDC: 11, damage: null, damageType: null, condition: "Restrained", conditionDuration: "until cured",
    note: "A restrained creature can attempt the same check again on its turn to escape, or an ally can help pull it free with a DC 11 Strength check of their own. No damage — this is purely a mobility hazard, useful for slowing a chase or forcing a hard choice under pressure.",
  },
  {
    name: "Sunblind Salt Flat",
    tier: "setback",
    trigger: "Prolonged travel across an open expanse of pale salt flat or glacier under direct sun, without eye protection.",
    description: "Glare off the pale ground builds to a painful white blur that doesn't fade even with eyes closed.",
    saveAbility: "CON", saveDC: 12, damage: null, damageType: null, condition: "Blinded", conditionDuration: "1 hour",
    note: "Save required once per hour of exposure. Simple eye protection (a strip of dark cloth, smoked lenses) grants advantage on the save or negates it outright at the DM's discretion.",
  },
  {
    name: "Sourroot Thicket",
    tier: "setback",
    trigger: "Brushing against or harvesting a patch of innocuous-looking thornless shrub whose sap is a mild contact irritant.",
    description: "The leaves release a sour-smelling sap on contact that raises an itching welt within moments.",
    saveAbility: "CON", saveDC: 10, damage: "1d4", damageType: "poison", condition: null, conditionDuration: null,
    note: "Nature DC 12 identifies the plant on sight and avoids the reaction entirely when foraging or clearing it. Minor, meant as an annoyance/resource cost rather than a real threat — good for wilderness travel color.",
  },
  {
    name: "Flooded Chamber",
    tier: "dangerous",
    trigger: "Fighting, casting, or moving carelessly while submerged or waist-deep in a flooded room or tunnel.",
    description: "Cold water fills the chamber to chest height or higher, slowing every movement to a dragging wade.",
    saveAbility: null, saveDC: null, damage: null, damageType: null, condition: null, conditionDuration: null,
    note: "No save or damage on its own — difficult terrain, and any creature without a swim speed that ends its turn fully submerged must hold its breath or begin suffocating per normal drowning rules. Fire damage types are halved for anything submerged; lightning damage against a group standing in the water should hit everyone in it, not just the original target.",
  },
  {
    name: "Whiteout Crevasse Field",
    tier: "dangerous",
    trigger: "Crossing broken glacier or crumbling cliffside terrain, especially in poor visibility.",
    description: "What looks like solid ground gives way into a hidden crevasse or rockslide the moment weight settles on it.",
    saveAbility: "DEX", saveDC: 13, damage: "3d6", damageType: "bludgeoning", condition: "Restrained", conditionDuration: "until cured",
    note: "A failed save drops the creature partway into the crevasse/rubble (Restrained, freed with a DC 13 Strength check by itself or an ally); a success means they scramble back to solid ground, taking no damage. Survival DC 13 while route-finding lets the party avoid the worst of the field entirely.",
  },
  {
    name: "Miasma Hollow",
    tier: "dangerous",
    trigger: "Lingering in a low-lying pocket of stagnant, spore-thick air — an old cistern, a swamp hollow, an unventilated crypt.",
    description: "The air here sits heavy and faintly luminous with drifting spores that catch in the throat.",
    saveAbility: "CON", saveDC: 13, damage: "2d6", damageType: "poison", condition: "Poisoned", conditionDuration: "1 hour",
    note: "Save required once per 10 minutes spent in the hollow, not just once on entry — this is meant to pressure a party into not resting or lingering here. Half damage and no Poisoned condition on a success. A strong wind or fire burning through the area clears it out.",
  },
  {
    name: "Thundering Rockslide Slope",
    tier: "deadly",
    trigger: "A loud noise, a poorly placed foothold, or a deliberate trigger destabilizes a steep slope of loose scree above a path.",
    description: "A groan from the mountainside is the only warning before tons of loose rock let go all at once.",
    saveAbility: "DEX", saveDC: 15, damage: "6d6", damageType: "bludgeoning", condition: "Prone", conditionDuration: "1 round",
    note: "Half damage and no Prone on a success. Anyone caught directly underneath rather than at the slide's edge should face this at disadvantage or with an additional damage die, at the DM's discretion — this entry assumes a creature with at least some room to scramble clear.",
  },
  {
    name: "Blackdamp Shaft",
    tier: "deadly",
    trigger: "Descending into a deep mine shaft or sealed tunnel where breathable air has been displaced by heavier, inert gas pooling at the bottom.",
    description: "A torch carried into the lower shaft gutters and dies; a moment later, so does the strength in the legs of whoever's carrying it.",
    saveAbility: "CON", saveDC: 14, damage: null, damageType: null, condition: "Unconscious", conditionDuration: "until cured",
    note: "No damage on its own, but an unconscious creature left in the gas begins suffocating per normal rules and needs to be physically dragged out to recover — this is meant to be a real emergency, not a background tax. A carried flame dying unexpectedly is the players' warning sign before anyone needs to roll.",
  },
  {
    name: "Poisoned Toast",
    tier: "setback",
    trigger: "Drinking from a shared cup or joining a ceremonial toast at a gathering where a rival has had the opportunity to tamper with it beforehand.",
    description: "The drink tastes fine going down. It's only a few moments later, mid-sentence in front of everyone, that the room starts to feel a little too warm and the words stop coming out right.",
    saveAbility: "CON", saveDC: 12, damage: null, damageType: null, condition: "-3 Charisma (Slurred and Hiccupping)", conditionDuration: "10 minutes",
    note: "No damage — the cost is entirely social, in front of exactly the people it's least convenient to embarrass yourself in front of. Investigation DC 13 beforehand, if someone thinks to check the cup, spots the tampering. Perception DC 14 during the toast itself might catch the tamperer's hand.",
  },
  {
    name: "A Room That Remembers",
    tier: "setback",
    trigger: "Speaking indiscreetly, gossiping, or sharing a secret aloud in a crowded tavern, salon, or market square with the wrong ears nearby.",
    description: "Nothing supernatural here — just a room full of people with nothing better to do than listen, remember, and repeat.",
    saveAbility: null, saveDC: null, damage: null, damageType: null, condition: null, conditionDuration: null,
    note: "No save, no damage, no condition — this is a pure DM-pacing hazard, not a mechanical one. Whatever's said indiscreetly here should resurface later, exaggerated and attributed to the party by name, at a moment of the DM's choosing. A quiet corner, a hushed voice, or an actual Stealth/Deception check to cover a conversation avoids it entirely.",
  },
];
