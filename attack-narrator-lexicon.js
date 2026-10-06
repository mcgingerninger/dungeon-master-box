// Attack narrator data, part 5: reading an attack's name and text. Ordered rules map words to the move
// (how the attack is delivered), the damage element and the held weapon. The first matching rule wins, so
// specific words come before general ones. Everything is matched against the lower-cased attack name first and
// then, if that gives nothing, against the stat-block text.
(function () {
  const D = (window.AttackNarratorData = window.AttackNarratorData || {});

  // [regex, moveId]  (moves live in attack-narrator-moves.js / attack-narrator-magic.js)
  D.MOVE_LEX = [
    [/\bspores?\b|\bspore salvo\b|\bpollen\b/, 'cloud'],
    [/\b(?:cloud|storm|thunderous|flaming|icy|fiery) (?:morningstar|club|axe|hammer|sword|blade|spear|staff|maul|mace|flail|dagger|bow|crossbow)\b/, 'WEAPON'],
    // ---- non-damaging and special abilities first (their words are common inside attack names)
    [/\b(?:frightful|dreadful|horrifying|terrifying|divine) (?:presence|dread|aspect|visage)|\bpresence\b|\bvisage\b|\bnimbus\b|\bfireshield\b|\bfire shield\b|\bshield of (?:fire|flame|ice|thorns)\b|\bmalevolent|\bunnerving mask|\bsapping presence|\bhorror\b/, 'aura'],
    // ---- breath
    [/\bbreath(?:e)?\b|\bexhale\b|\bbelch (?:fire|flame)\b|\bfire belch\b|\bflame jet\b/, 'breath'],
    // ---- gaze family
    [/\b(?:gaze|glare|stare|evil eye|eyebite|eye ray|eye rays|glower|glance|eyes? of|sight|stunning gaze|petrifying gaze)\b/, 'gaze'],
    // ---- constrict / swallow / engulf
    [/\bswallow\b|\bengulf\b|\bsmother\b|\benvelop\b|\bgulp\b|\binhale\b|\bdevour\b|\babsorb\b/, 'engulf'],
    [/\bconstrict\b|\bsqueeze\b|\bbear hug\b|\bhug\b|\bembrace\b|\bcoil\b|\bcrushing\b(?! blow)|\bcrush\b|\bsmash grip/, 'constrict'],
    // ---- drain and curse magic
    [/\blife drain\b|\bblood drain\b|\bdrain\b|\bleech\b|\bsiphon\b|\bfeed\b|\bsap\b|\bextract brain\b|\beat memories\b|\bsteal memory\b|\bdevour intellect\b|\bsoul\b.*\b(?:drain|rend|steal)\b|\benergy drain\b|\bstrength drain\b|\bpsychic drain\b|\bessential reduction\b|\bkiss\b/, 'drain'],
    [/\bcurse\b|\bhex\b|\bcharm\b|\bcommand\b|\bsuggest|\bcompel|\benslave\b|\bpossess|\bhypno|\bmesmer|\bdominat|\bspell mimicry\b|\bspell\b|\bword\b(?! of)|\bmind (?:mastery|control|blast)\b|\bpsychic link\b|\bmind poison\b|\bpoison mind\b|\bpacif|\bcalm(?:ing)?\b|\blure\b|\bluring\b|\bforgetfulness\b|\bwhispers\b|\bbewitch|\bfascinat|\benthral/, 'hex'],
    // ---- web / snare
    [/\bweb\b|\bentangl|\bensnare|\broots?\b|\bgrasping\b|\bsnare\b|\bbind(?:ing)?\b|\banimate chains\b|\bsticky\b|\bfilament\b|\bplants?\b/, 'entangle'],
    // ---- summons
    [/\bsummon|\bconjure|\bspawn|\bcall (?:of|the|forth)|\bice wolves|\bchildren of the night|\bswarm of\b|\banimate\b(?! chains)/, 'summon'],
    // ---- area emitters
    [/\bcloud\b(?! (?:morningstar|club|axe|hammer|sword|blade|spear|staff|maul|mace|flail|dagger))|\bmist\b|\bfog\b|\bgas\b|\bspores?\b|\bdust\b|\bsmoke\b|\bhaze\b|\bvapor\b|\bstench\b|\bcinders\b|\bincendiary\b|\binfestation\b|\bplague of\b|\bmiasma\b|\bscale dust\b|\bink cloud\b/, 'cloud'],
    [/\bwail\b|\bscream\b|\bscreech\b|\bshriek\b|\broar\b|\bhowl\b|\bsong\b|\bchirr\b|\btrumpet\b|\bbellow\b|\bhonk\b|\bbaying\b|\bcackle\b|\bbabbl|\bclap\b|\bboom\b|\bmoan\b|\bcry\b|\bdrone\b|\bvoice\b|\bthunderclap\b|\bsonic\b|\bshatter|\bscreaming\b/, 'wave'],
    [/\bspit\b|\bspray\b|\bbelch\b|\bretch\b|\bsquirt\b|\bspew\b|\beject\b|\bvomit\b|\bjet\b|\bsplash\b|\bgout\b|\bacid lash\b|\bsquirt\b/, 'spray'],
    [/\borb\b|\bsphere\b|\bfireball\b|\bglobe\b|\bball\b|\bmeteor\b|\bcomet\b|\bstar\b|\bcrystal flare\b|\bexploding\b|\bexplosive\b|\bgrenade\b|\bbomb\b|\bgeode\b|\bburning hands\b|\bhurl (?:flame|lava)\b|\blava ball\b|\bfire bolt\b|\bmagma\b/, 'orb'],
    [/\bburst\b|\bnova\b|\bpulse\b|\beruption\b|\bflare\b|\bshockwave\b|\bdetonat|\bcorpse burst\b|\bsupernova\b|\bearthquake\b|\bwave of\b|\bvortex\b|\bwhirlwind\b|\bstorm\b|\bhailstorm\b|\bblizzard\b|\bwave\b|\bflurry of (?:cold|ice)\b|\bboiling aura\b|\baura\b|\bsingularity\b|\bpower of\b/, 'burst'],
    [/\bray\b|\brays\b|\bbeam\b|\bbolt\b|\bbolts\b|\blance\b|\blaser\b|\bblast\b|\blightning\b|\bthunderbolt\b|\bacid arrow\b|\bgrave bolt\b|\bdeath ray\b|\bmagic missile\b|\beldritch\b|\bchromatic\b|\bprismatic\b|\bstrike(?! of)|\bjavelin of lightning\b|\bfire lance\b|\bwind javelin\b|\bchill touch\b|\bsoul bolt\b/, 'ray'],
    // ---- touch-style magic (melee, no weapon)
    [/\bshock\b|\btouch\b|\bgrasp\b|\bcaress\b|\bhand of\b|\bfist of\b|\bslam of\b|\bgrip\b|\bpalm\b|\bwithering\b|\bcorrupting\b|\bparalyzing\b|\bpetrifying touch\b|\bshocking\b/, 'touch'],
    // ---- natural weapons
    [/\bsnake hair\b|\bsnakebite\b|\bbites?\b|\bfangs?\b|\bjaws?\b|\bmaw\b|\bsnakebite\b|\bwolf bite\b|\bgrinding jaws\b|\bproboscis\b|\bmandibles?\b(?! shear)|\bchomp\b|\bsnap\b/, 'bite'],
    [/\bthorns?\b|\bsting(?:er|s)?\b|\bbarb(?:ed)? tail\b|\btail (?:sting|spike|spine|stinger)\b|\bspines?\b|\bneedles?\b|\bovipositor\b|\bantennae?\b|\bbarbs?\b|\bspike\b|\barm spike\b/, 'sting'],
    [/\btalons?\b/, 'talon'],
    [/\bforeleg\b|\bclaws?\b|\brake\b|\bswipe\b|\bpaw\b|\bpiercing claw\b|\bwhirlwind of claws\b|\bflailing claws\b/, 'claw'],
    [/\bpincers?\b|\bnip\b|\bsnip\b|\bsheer\b|\bshear\b|\bfoot ?pincer\b/, 'pincer'],
    [/\btentacles?\b|\btendrils?\b|\bpseudopods?\b|\bvines?\b|\blash\b(?=.*(?:acid|water))|\bwater lash\b|\bflail tentacle\b|\bflail of\b|\btongue\b|\bantenna\b|\bwhipping\b/, 'tentacle'],
    [/\bbeaks?\b|\bpeck\b|\bpecks\b|\bbill\b|\begg tooth\b/, 'beak'],
    [/\bwings?\b|\bpinion\b|\bwing attack\b|\bwing gusts?\b|\bbuffet\b/, 'wing'],
    [/\btails?\b|\bserrated tail\b|\bbarbed tail\b|\btail attack\b|\btail slap\b/, 'tail'],
    [/\bhooves?\b|\bhoof\b|\bstomp\b|\bstomping\b|\bkick\b|\btrampl|\bfoot\b|\bstride\b|\bthunderous stomp\b|\bcrushing leap\b|\bflesh-crushing\b|\bbooming step\b|\bearth-shaking\b/, 'stomp'],
    [/\bdrill\b|\bhorns?\b|\btusks?\b|\bantlers?\b|\bgore\b|\bram\b|\bbutt\b|\bheadbutt\b|\bcharge\b|\bgorging charge\b|\berupting horns\b|\bgoring\b/, 'gore'],
    [/\brend\b|\bshred\b|\bflurry\b|\bsavage\b|\brampage\b|\bfrenzy\b|\bmauling\b|\brip\b|\btear\b|\bswarm of bites\b/, 'rend'],
    [/\bslam\b|\bsmash\b|\bbash\b(?! shield)|\bpummel\b|\bpound\b|\bhaymaker\b|\bsquash\b|\bswat\b|\bbody flop\b|\bdrop\b|\bforceful slam\b|\bempowered slam\b|\bdestructive fist\b|\bmassive arm\b|\bfists?\b|\brotting fist\b|\biron fist\b|\bmetal fist\b|\bforce-empowered\b|\bpseudopod slam\b|\bdazzling slam\b|\bunerring slam\b|\benveloping slam\b|\bpsychic slam\b|\bcrash\b/, 'slam'],
    [/\bspiked gauntlet\b|\bgauntlet\b|\bunarmed (?:strike|attack)\b|\bunarmed\b|\bpunch\b|\belbow\b|\bknuckle\b|\bpalm strike\b|\bquivering palm\b|\bslap\b|\bhand\b|\barms?\b(?! of)|\blimb\b|\bflick\b|\bbody\b|\bpoint\b/, 'unarmed'],
    // ---- held weapons (checked after natural words so "Silver Greatsword" still finds greatsword below)
    [/\bgreatswords?\b|\bclaymore\b|\bzweihander\b|\bgreat sword\b|\bbastard sword\b|\bsilver greatsword\b|\bblackrazor\b|\bheartcleaver\b/, 'greatblade'],
    [/\bgreataxes?\b|\bgreat axe\b|\bexecutioner\b|\bberserker axe\b|\bgurt'?s greataxe\b|\bgreataxe \+/, 'greataxe'],
    [/\bhandaxe\b|\bhand axe\b|\bhatchet\b|\bbattleaxe\b|\bbattle axe\b|\baxe\b|\btomahawk\b|\bcleaver\b|\bicy axe\b|\bice axe\b/, 'axe'],
    [/\bwarhammer\b|\bhammer\b|\bmaul\b|\bsledge|\bmallet\b|\bforge hammer\b|\bgavel\b|\bdwarven thrower\b|\bwhelm\b|\bhammer of\b|\bheated maul\b|\bhellish morningstar\b(?!x)/, 'hammer'],
    [/\bgreatclub\b|\bgreat club\b|\bclub\b|\bcudgel\b|\btruncheon\b|\bbat\b|\bbranch\b|\blog\b|\btree club\b|\bbone club\b|\bcrystal club\b|\bstone club\b|\bthundering stone club\b|\bspiked bone club\b|\bheavy club\b|\bgreat tree club\b/, 'club'],
    [/\bmace\b|\bmorningstar\b|\bmorning star\b|\bflail\b|\bscepter\b|\bsceptre\b|\bcenser\b|\bball and chain\b|\bpernach\b|\bskull flail\b|\bchardalyn flail\b|\bfool's scepter\b|\bsearing scepter\b|\bblast scepter\b/, 'mace'],
    [/\bshield bash\b|\bshield charge\b|\bspiked shield\b|\bsticky shield\b|\bshield\b|\bbuckler\b/, 'shield'],
    [/\bwar pick\b|\bpickaxe\b|\bpick\b|\bsickle\b|\bscythe\b|\bhook\b|\bwicked sickle\b|\bice sickle\b|\breaping scythe\b|\bharpoon arm\b/, 'pick'],
    [/\bglaive\b|\bhalberd\b|\bpike\b|\blance\b|\bpoleaxe\b|\bnaginata\b|\bbill\b|\bpartisan\b|\bsilvered pike\b/, 'polearm'],
    [/\bspear\b|\bshortspear\b|\btrident\b|\bfork\b|\bpitchfork\b|\bboar spear\b|\bharpoon\b|\bdeath lance\b|\bshadow spear\b|\bhooked spear\b|\bhooked shortspear\b/, 'spear'],
    [/\bwhip\b|\bscourge\b|\bgarrote\b|\bchain\b|\bspiked chain\b|\bmany-tailed whip\b|\btaskmaster whip\b|\bchain sweep\b|\bchain smash\b|\bbroken chain\b|\blasso\b/, 'whip'],
    [/\bdagger\b|\bknife\b|\bdirk\b|\bstiletto\b|\bkris\b|\bshiv\b|\brazor\b|\bking's knife\b|\binfernal dagger\b|\bphantasmal dagger\b|\bflying dagger\b|\bshadow dagger\b|\bmind-poison dagger\b|\bgolden pin\b|\bneedle\b|\bbroken bottle\b|\bshard\b|\bsplinter\b/, 'shortblade'],
    [/\bstab\b|\bknives\b|\bshortsword\b|\bshort sword\b|\blongsword\b|\blong sword\b|\bscimitar\b|\brapier\b|\bsabre\b|\bsaber\b|\bfalchion\b|\bcutlass\b|\bkatana\b|\bmachete\b|\bsword\b|\bblade\b|\bsilver sword\b|\bshadow sword\b|\blava blade\b|\bmind blade\b|\bsoulblade\b|\bstorm boomerang\b|\blightning blade\b|\bazuredge\b|\bflame tongue\b|\bfane-eater\b|\bmatalotok\b|\bforce blade\b|\bserrated sword\b|\blightning sword\b|\bice longsword\b|\bsword talons\b/, 'blade'],
    [/\bshovel\b|\bskillet\b|\bfrying pan\b|\bquarterstaff\b|\bstaff\b|\brod\b|\bcane\b|\bpole\b|\boar\b|\bstick\b|\bwand\b|\bpincer staff\b|\bblackstaff\b|\bcomet staff\b|\bdemon staff\b|\bbone staff\b|\bspider staff\b|\bprism staff\b|\bflying staff\b|\btentacle rod\b/, 'staff'],
    // ---- projectiles
    [/\bshortbow\b|\blongbow\b|\bbow\b|\bwarbow\b|\bcomposite\b|\bslaying longbow\b|\bradiant bow\b|\boversized longbow\b/, 'bow'],
    [/\bcrossbow\b|\bbolt launcher\b|\barbalest\b|\bballista\b|\brepeating\b|\bturret\b|\bbrass crossbow\b|\bpoisonous pistol\b|\bpistol\b|\bmusket\b|\brifle\b|\blaser pistol\b|\bcannon\b|\blaunchers?\b/, 'crossbow'],
    [/\bsling\b|\bslingshot\b|\bbolas\b|\bstone bolas\b|\bsnowball\b/, 'sling'],
    [/\bnet\b|\bweighted net\b|\bsnare\b/, 'net'],
    [/\bjavelin\b|\bdart\b|\bthrow\b|\bhurl\b|\bfling\b|\bchuck\b|\brock\b|\bboulder\b|\bstone\b|\bhurled\b|\bspit rock\b|\bglacier throw\b|\bsplinter\b|\bhailstone\b|\bicicle\b|\bcrystal dart\b|\bpoisoned dart\b|\bdropped rock\b|\brolling rock\b|\bfang fling\b|\btelekinetic fling\b|\bfling limb\b|\bheated rock\b|\brunic boulder\b|\bhurled stone\b|\bstone avalanche\b|\bboomerang\b/, 'thrown'],
    // ---- generic attacks
    [/\battack\b|\bstrike\b|\bmelee\b|\bweapon\b|\bhit\b|\bbasic\b/, 'strike']
  ];

  // Natural element words in a name, used when the text does not name a damage type (and as extra colour).
  D.NAME_ELEMENTS = [
    [/\b(?:fire|flame|flaming|fiery|blaz|burn|burning|scorch|inferno|ember|cinder|lava|magma|molten|hellfire|brimstone|sear|incendiary|pyre|heat|firebolt|fireball|immolat|flare)\w*/, 'fire'],
    [/\b(?:frost|ice|icy|cold|freez|rime|glacier|polar|hail|blizzard|snow|chill|winter|frozen|glacial)\w*/, 'cold'],
    [/\b(?:lightning|shock|electric|static|arc|voltaic|thunderbolt|spark|jolt|tempest|storm)\w*/, 'lightning'],
    [/\b(?:thunder|sonic|boom|resonan|shatter|clap|roar|scream|wail|howl|screech|shriek|trumpet|honk|babbl|bellow)\w*/, 'thunder'],
    [/\b(?:acid|caustic|corros|vitriol|bile|etch|dissolv)\w*/, 'acid'],
    [/\b(?:poison|venom|toxic|noxious|plague|viper|stench|fetid|snakebite)\w*/, 'poison'],
    [/\b(?:necrotic|rot|decay|wither|grave|death|corpse|blight|soul|vampiric|deathly|life drain|reaping|sepulchral)\w*/, 'necrotic'],
    [/\b(?:radiant|holy|sacred|divine|solar|dawn|smite|celestial|starlight|sun|sunbeam|blinding gleam|justice|righteous)\w*/, 'radiant'],
    [/\b(?:psychic|mind|mental|dream|nightmare|madness|thought|phantasm|brain|mesmer|memory|memories|telepath|hypno)\w*/, 'psychic'],
    [/\b(?:force|telekinetic|kinetic|arcane|eldritch|magic missile|spellfire|energy|singularity|chromatic)\w*/, 'force']
  ];

  // Held weapons: how they are named in the scene and which part of them does the damage.
  D.WEAPONS = {
    shortblade: { instr: ['dagger', 'knife', 'short blade', 'blade'], wpart: ['blade', 'point', 'edge'] },
    blade: { instr: ['sword', 'blade', 'steel'], wpart: ['blade', 'edge', 'steel'] },
    greatblade: { instr: ['greatsword', 'two-handed sword', 'great blade'], wpart: ['blade', 'edge', 'steel'] },
    axe: { instr: ['axe', 'hatchet', 'battle axe'], wpart: ['head', 'blade', 'edge'] },
    greataxe: { instr: ['greataxe', 'great axe', 'double-bladed axe'], wpart: ['head', 'blade', 'edge'] },
    hammer: { instr: ['hammer', 'maul', 'warhammer'], wpart: ['head', 'iron head', 'hammerhead'] },
    club: { instr: ['club', 'cudgel', 'bludgeon'], wpart: ['head', 'knotted end', 'thick end'] },
    mace: { instr: ['mace', 'morningstar', 'flail'], wpart: ['spiked head', 'flanged head', 'iron head'] },
    staff: { instr: ['staff', 'rod', 'quarterstaff'], wpart: ['end', 'tip', 'butt'] },
    spear: { instr: ['spear', 'trident', 'pike'], wpart: ['point', 'head', 'tip'] },
    polearm: { instr: ['polearm', 'glaive', 'halberd'], wpart: ['blade', 'head', 'hooked blade'] },
    whip: { instr: ['whip', 'lash', 'chain'], wpart: ['tip', 'cord', 'end'] },
    shield: { instr: ['shield', 'bossed shield', 'heavy shield'], wpart: ['boss', 'rim', 'face'] },
    pick: { instr: ['pick', 'war pick', 'sickle'], wpart: ['point', 'beak', 'curved blade'] },
    bow: { instr: ['bow', 'longbow', 'shortbow'], wpart: ['arrowhead', 'point'] },
    crossbow: { instr: ['crossbow', 'repeating crossbow', 'heavy crossbow'], wpart: ['bolt', 'quarrel'] },
    sling: { instr: ['sling', 'sling', 'sling'], wpart: ['stone', 'bullet'] },
    thrown: { instr: ['weapon', 'missile', 'javelin'], wpart: ['point', 'head'] },
    firearm: { instr: ['firearm', 'pistol', 'musket'], wpart: ['muzzle', 'barrel'] },
    net: { instr: ['net', 'weighted net'], wpart: ['weights', 'cords'] },
    unarmed: { instr: ['fists', 'hands', 'knuckles'], wpart: ['knuckles', 'fist'] },
    strike: { instr: ['weapon', 'implement', 'limb'], wpart: ['edge', 'head', 'point'] },
    shot: { instr: ['weapon', 'launcher', 'bow'], wpart: ['projectile', 'bolt'] }
  };

  // Body parts of the target that can take a hit
  D.BODY_PARTS = ['shoulder', 'ribs', 'side', 'thigh', 'forearm', 'chest', 'flank', 'hip', 'back', 'calf', 'upper arm', 'collarbone', 'knee', 'gut', 'hand', 'shin'];
  D.BODY_PARTS_BIG = ['chest', 'back', 'side', 'flank', 'shoulder', 'thigh', 'hip', 'ribs']; // used for big, area-like hits

  // Words that mean "this action is an attack roll or a save" even when there is no damage
  D.SPECIAL_TEXT = {
    spitting: /spit|spray|belch|retch|squirt/i,
    breathing: /breath|exhale/i,
    gazing: /gaze|stare|glare|eyes/i,
    roaring: /roar|scream|howl|wail|shriek|screech/i,
    touching: /touch|grasp|grip/i,
    casting: /cast|spell|incant|chant|ritual|magic/i
  };

  // Verbs that conjugate irregularly in {v:...} tokens
  D.IRREGULAR = { be: ['is', 'are'], was: ['was', 'were'], have: ['has', 'have'], do: ['does', 'do'], go: ['goes', 'go'] };
})();
