// Monster token art: hand-made pixel sprites, one per creature kind, recoloured into variants.
// Every sprite is drawn as the LEFT HALF of a front-facing portrait (8 columns) and mirrored, so
// it is always symmetric and cheap to author. Characters: . clear, o outline, a body, b shade,
// c light, e glow/eye, w white (bone, teeth, claws), k black, r red, y gold.
// monsterArt(monster) picks a sprite + palette from the creature's type and name;
// monsterArtSvg(monster, px) returns an inline SVG token face. Classic script, no dependencies.
(function () {
  const SPRITES = {
    dragon: [
      'o.......', 'co......', 'cbo.....', '.cbo.ooo', '..obooaa', '..oaaaaa', '.oaaaaaa', 'oaakeaaa',
      'oaaaaaaa', '.oaaaaaa', '..oaabaa', '..oaaaaa', '...owaww', '....oooo',
    ],
    skull: [
      '....oooo', '..ooaaaa', '.oaaaaaa', '.oaaaaaa', '.oakkkaa', '.oakekaa', '.oakkkaa', '.oaaaaab',
      '..oaaabk', '..oaaaaa', '...oaaaa', '...owkwk', '...oaaaa', '....oooo',
    ],
    ghost: [
      '....oooo', '..oocccc', '.occcccc', '.occcccc', '.occkkcc', '.occkekc', '.occkkcc', '.occcccc',
      '.occcckk', '.occcccc', '.ocacccc', '.oacacacc', '.o.oaoao', '.....o.o',
    ],
    zombie: [
      '...ooooo', '..obbbbb', '.obaaaaa', '.obaaaaa', '.obwwkaa', '.obwekaa', '.obaaaaa', '.obaabaa',
      '.obaaaab', '..obakkk', '..obaaaa', '...obkwk', '....obaa', '.....ooo',
    ],
    vampire: [
      'o.......', 'oo..oooo', 'obooobbb', 'obbbbbbb', '.obaaaaa', '.oaaaaaa', '.oakekaa', '.oaaaaaa',
      '.oaaaaab', '..oaaaaa', '..oarrra', '..owraraw', '...owaaa', '....oooo',
    ],
    lich: [
      '..y.y.y.', '..yyyyyy', '...ooooo', '..ooaaaa', '.oaaaaaa', '.oakkkaa', '.oakekaa', '.oakkkaa',
      '.oaaaaab', '..oaaabk', '..oaaaaa', '...owkwk', '....oaaa', '.....ooo',
    ],
    demon: [
      'o.......', 'oo......', 'obo..ooo', '.obooaaa', '..oaaaaa', '.oaaaaaa', '.oakeeaa', '.oaakkaa',
      '.oaaaaaa', '.oaabaaa', '..oaaaaa', '..owkwkwk', '...owwwww', '....oooo',
    ],
    angel: [
      '...yyyyy', '..y.....', '..y.oooo', 'cc.ooaaa', 'ccooaaaa', 'cccoaaaa', 'ccooakea', '.coaaaaa',
      '..oaaaaa', '..oaabaa', '...oaaaa', '...obbbb', '....oooo', '........',
    ],
    flame: [
      '.......o', '......oy', '.....oyy', '....oyyy', '...ooyyy', '..oorrry', '.orryyyy', '.orrykky',
      '.orryyyy', '.orrryyy', '.orrrryy', '..orrrrr', '...oorrr', '.....ooo',
    ],
    water: [
      '........', '.......o', '......oc', '.....occ', '....occc', '...oaccc', '..oaaccc', '.oaaaccc',
      '.oaakecc', '.oaaaacc', '.oaaaacc', '..oaaaaa', '...ooaaa', '.....ooo',
    ],
    wind: [
      '...ooooo', '.ooocccc', 'occccccc', 'occcccca', 'ocaakeca', 'occcccca', 'occccckk', '.occcckk', '..occcca', '...ooooo',
    ],
    rock: [
      '...ooooo', '..obbbaa', '.obaaaaa', '.obaacaa', '.obaaaaa', '.obkkaaa', '.obkekaa', '.obaaaaa',
      '.obabbaa', '.obaaaaa', '..obaaaa', '..obbaab', '...obbbb', '....oooo',
    ],
    fey: [
      'o......o', 'oo....oo', 'ocoooooo', '.ocaaaaa', '..oaaaaa', '.oaaaaaa', '.oakeaaa', '.oaaaaaa',
      '..oaaabb', '..oaaaaa', '...oarra', '...ooaaa', '..ccoooo', '.cccc...',
    ],
    giant: [
      '..oooooo', '.obbbbbb', 'obaaaaaa', 'obaaaaaa', 'obbbaaaa', 'obakkaaa', 'obakeaaa', 'obaaaaaa',
      'obaaabaa', 'obaaaaaa', '.obwaaaa', '.obwwaaa', '..obaaaa', '...ooooo',
    ],
    ooze: [
      '........', '.....ooo', '...ooacc', '..oaaaac', '.oaaacca', '.oaaaaaa', '.oakeaka', '.oaaaaaa',
      '.oaaaaaa', 'oaaabaaa', 'oaabbaaa', 'oaaaaaab', '.ooaaaaa', '...ooooo',
    ],
    plant: [
      '..o.oo..', '.oao.oao', '.oaooaao', 'oaaaaaao', '.ooaaaao', '..obbbbb', '.obbkkbb', '.obbkebb',
      '.obbbbbb', '..obbbbb', '...obbbb', '...obbbb', '..ooobbb', '.....ooo',
    ],
    construct: [
      '...ooooo', '..occccc', '.occcccc', '.ocbbbbb', '.ocbkkkk', '.ocbkeee', '.ocbbbbb', '.occcccc',
      '.oc.coco', '.oc.oooo', '.occcccc', '..ocbbbb', '...ooooo', '........',
    ],
    eye: [
      '....oooo', '..ooaaaa', '.oaaaaaa', '.oaaccww', '.oacwwww', 'oacwwkee', 'oacwkeee', 'oacwwkee',
      '.oacwwww', '.oaacwww', '..oaaaaa', '..oo.ooa', '.o.o.o.o', '.o..o..o',
    ],
    wolf: [
      '.o....o.', '.oo..oo.', '.ooooooo', '.oaaaaaa', '.oaaaaaa', '.oakeaaa', '.oaaaaaa', '..oaaaaa',
      '..oaaaaa', '...oaaww', '...ocaaa', '....ooww', '....oowk', '.....ooo',
    ],
    bear: [
      '.oo.....', 'oaao.ooo', 'oaaooaaa', '.oaaaaaa', '.oaaaaaa', '.oaakaaa', '.oaaaaaa', '..oaaccc',
      '..oaaccc', '..oacckk', '...oaccc', '...obwww', '....oooo', '........',
    ],
    spider: [
      'o.......', '.o....oo', '..o.ooaa', 'o.ooaaaa', '.oaaekek', 'o.oaaaaa', '..oaabaa', '.o.oaaaa',
      'o..owwaa', '....oowo', '....o.oo', '........',
    ],
    snake: [
      '...ooooo', '..oaaaaa', '.oaaaaab', '.oaaaaab', '.oaaekaa', '.oaaaaaa', '..oaaaaa', '...oaaaa',
      '....oaaa', '.....oaa', '...o..oa', '..oao.oa', '...ooooo', '........',
    ],
    bird: [
      '....ooo.', '...oaaao', '..oaaaaa', '.oaaaakk', '.oaaakek', '.oaaaaaa', '.oaaawww', '..oyyyyy',
      '..oyyyyy', '...oyyyy', '....oyyy', '....oayy', '...oaaaa', '..oo.ooa',
    ],
    bat: [
      '.o....oo', 'oao..oao', 'oaaooaao', 'oaaaaaaa', 'oaaekaaa', 'oaaaaaaa', '.oaaaaaa', '.oaabaaa',
      '..oakwaw', '..oaaaaa', '...oaaaa', '....oooo', '........', '........',
    ],
    claw: [
      '..oo..oo', '.oaao.oa', '.oaao.oa', '.oaaoooa', '.oaaaaaa', '.oaaaaaa', '..oaaaaa', '..oakeaa',
      '.oaaaaaa', '.oabwbwb', '.oabwbwb', '..oabwbw', '...ooooo', '........',
    ],
    scorpion: [
      '.......o', '......ob', 'oo....ob', 'oaoo..ob', 'oaaoo.oa', '.oaaooaa', '.oaaaaaa', '.oakeaea',
      '.oaaaaaa', 'oaaabbaa', 'oo.oaaaa', '...oaaaa', '....oooo',
    ],
    goblin: [
      '........', 'oo..oooo', 'oaooobbb', 'oaaabbbb', '.oaaaaaa', '.oaaaaaa', '.oaakeaa', '.oaaaaaa',
      '..oaaabb', '..oaaaaa', '..oawawa', '...oaaaa', '....oooo', '........',
    ],
    orc: [
      '...ooooo', '..oobbbb', '.obaaaaa', '.obaaaaa', '.obbbaaa', '.obakeaa', '.obaaaaa', '.obaaabb',
      '..obaaaa', '..owwaaa', '.owoaaaa', '.owooaaa', '..ooobbb', '........',
    ],
    hood: [
      '....oooo', '..ooobbb', '.obbbbbb', '.obbbbbb', '.obbkkkk', '.obkaaaa', '.obkaekk', '.obkaaaa',
      '.obkaaab', '.obbkaaa', '.obbbkkk', '..obbbbb', '...obbbb', '....oooo',
    ],
    mage: [
      '.......o', '......ob', '.....obb', '....obbb', '...obbbb', '..obbbbb', 'oobbbbbb', 'obyyyyyy',
      '.oaaaaaa', '.oakeaaa', '.oaaaaaa', '..oaaaaa', '..owwwww', '...owwww',
    ],
    knight: [
      '....oooo', '...occcc', '..occccc', '..occbbb', '..occbkk', '..occbkk', '..occccc', '..occcbb',
      '..ocbkbk', '..ocbkbk', '..occcbb', '..occccc', '...occcc', '....oooo',
    ],
  };

  // ---- palettes: [body, shade, light, glow, white] ----
  const P = (a, b, c, e, w) => ({ a, b, c, e, w: w || '#f2ead7' });
  const PAL = {
    red: P('#c0392b', '#7a1f16', '#e8685a', '#ffd34d'), blue: P('#2f6fcf', '#183a7a', '#6aa3f0', '#e8f6ff'), green: P('#3f9a4a', '#1f5a28', '#79cf84', '#f4ff6a'),
    black: P('#3a3f4a', '#171a21', '#6c7585', '#7dff9a'), white: P('#dfe9f2', '#9fb3c4', '#ffffff', '#46d3ff'), gold: P('#d8aa2b', '#8a6612', '#ffe27a', '#fff6c0'),
    silver: P('#b9c3cf', '#79848f', '#eef3f8', '#9fe0ff'), bronze: P('#b5763a', '#6b3f17', '#e0a266', '#ffe08a'), copper: P('#c06c3d', '#6e3418', '#e69a6c', '#9fffd0'),
    brass: P('#bfa24a', '#6f5f22', '#e6d58a', '#ffe7a8'), purple: P('#7d4ac8', '#43257d', '#b48af0', '#ffe27a'), teal: P('#2e9c97', '#16615d', '#6fd6d0', '#fff2a8'),
    bone: P('#e6dcc0', '#a89d7d', '#fffbe9', '#ff5a3c'), ash: P('#9aa3a8', '#5f666b', '#d1d8dc', '#8cf0ff'), rot: P('#7c9a5a', '#44582d', '#a9c58a', '#ffe36a'),
    pale: P('#cdbfd8', '#8c7a9a', '#f0e8f7', '#c24dff'), ember: P('#e8631d', '#9c2e08', '#ffb347', '#fff1a0'), sea: P('#2a8bd0', '#14507d', '#6fc4f5', '#e0f8ff'),
    sky: P('#9fd0ee', '#5f93b8', '#e4f4ff', '#ffffff'), stone: P('#8c8574', '#524d41', '#bdb6a2', '#ff9d3a'), moss: P('#5f8f3c', '#33501e', '#93c46a', '#fff29a'),
    flesh: P('#d6a27e', '#8f5f43', '#f1c8a8', '#2b6cff'), brown: P('#8a5a35', '#4d2f17', '#b88458', '#ffd97a'), grey: P('#8d8f96', '#52545c', '#c3c5cc', '#ffd34d'),
    pink: P('#d96fa6', '#8e3a68', '#f4a9cb', '#fff2a8'), jade: P('#2f8f6a', '#17543d', '#6fd1a8', '#fffbb0'), steel: P('#7f8a99', '#454e5b', '#b6c0cd', '#ff7a3a'), orc: P('#5f8a3a', '#34501a', '#8fbb62', '#ffd34d'),
    gob: P('#78a53e', '#436620', '#a8d36a', '#ffe14d'), night: P('#2b2a4a', '#13122a', '#5b59a0', '#b8a6ff'), blood: P('#7b1230', '#3d0618', '#c23a5c', '#ff6a6a'),
  };
  const BG = { // token background tint per palette family
    dragon: '#3a1a14', undead: '#1d2420', fiend: '#33100f', celestial: '#2e2a1a', elemental: '#14232f', fey: '#2a1a33', giant: '#2a2418', ooze: '#16281a',
    plant: '#15281a', construct: '#1d2127', aberration: '#241530', beast: '#2a2118', monstrosity: '#2a1a1a', humanoid: '#1f2330',
  };

  // ---- pick sprite + palette from the creature ----
  const T = (hay, re) => re.test(hay);
  function pick(m) {
    const name = String(m.name || ''), type = String(m.type || '');
    const hay = `${name} ${type}`.toLowerCase(), t = type.toLowerCase(), n = name.toLowerCase();
    const has = re => re.test(hay), isT = re => re.test(t);
    // dragons: chromatic / metallic by name
    if (isT(/dragon/) || /\bdragon|wyrm|drake|wyvern|dracolich/.test(n)) {
      const col = [['black', /black/], ['blue', /blue/], ['green', /green/], ['red', /red/], ['white', /white/], ['gold', /gold/], ['silver', /silver/], ['bronze', /bronze/], ['copper', /copper/], ['brass', /brass/], ['purple', /shadow|amethyst|sapphire|emerald|crystal/]].find(([, re]) => re.test(n));
      return { kind: 'dragon', pal: col ? col[0] : (/wyvern|drake/.test(n) ? 'moss' : 'teal'), label: 'Dragon' };
    }
    if (isT(/undead/) || /skeleton|zombie|ghoul|ghast|wight|wraith|specter|spectre|ghost|banshee|vampire|lich|mummy|revenant|shadow|poltergeist|phantom|flameskull|ghoul|bone/.test(n)) {
      if (/lich|dracolich|archlich/.test(n)) return { kind: 'lich', pal: 'bone', label: 'Lich' };
      if (/vampire/.test(n)) return { kind: 'vampire', pal: 'pale', label: 'Vampire' };
      if (/ghost|wraith|specter|spectre|banshee|shadow|phantom|poltergeist|spirit/.test(n)) return { kind: 'ghost', pal: /shadow/.test(n) ? 'night' : /banshee/.test(n) ? 'pale' : 'ash', label: 'Spirit' };
      if (/zombie|ghoul|ghast|mummy|revenant|wight|corpse/.test(n)) return { kind: 'zombie', pal: /mummy/.test(n) ? 'bone' : /ghast|ghoul/.test(n) ? 'ash' : 'rot', label: 'Walking dead' };
      return { kind: 'skull', pal: /flameskull/.test(n) ? 'ember' : 'bone', label: 'Skeleton' };
    }
    if (isT(/fiend/) || /demon|devil|imp\b|quasit|balor|succubus|incubus|hellhound|nightmare|rakshasa|yugoloth|dretch|vrock|hezrou|glabrezu|nalfeshnee|marilith|pit fiend|cambion|barbed|bearded|horned/.test(n))
      return { kind: 'demon', pal: /devil|imp|pit fiend|barbed|bearded|horned|cambion/.test(n) ? 'blood' : /quasit|dretch/.test(n) ? 'purple' : 'red', label: 'Fiend' };
    if (isT(/celestial/) || /angel|couatl|unicorn|pegasus|deva|planetar|solar|empyrean/.test(n)) return { kind: 'angel', pal: /deva|planetar|solar/.test(n) ? 'gold' : 'white', label: 'Celestial' };
    if (isT(/elemental/) || /elemental|salamander|azer|efreeti|djinni|genie|mephit|xorn|gargoyle|magmin|water weird|air|earth|fire|water/.test(n)) {
      if (/fire|flame|magma|magmin|efreeti|salamander|azer|ember|lava|magmin|steam/.test(n)) return { kind: 'flame', pal: 'ember', label: 'Fire elemental' };
      if (/water|ice|frost|cold|rain|sea|ocean|tide|marid|water weird/.test(n)) return { kind: 'water', pal: /ice|frost|cold/.test(n) ? 'white' : 'sea', label: 'Water elemental' };
      if (/air|wind|storm|djinni|cloud|vapor|dust/.test(n)) return { kind: 'wind', pal: 'sky', label: 'Air elemental' };
      return { kind: 'rock', pal: 'stone', label: 'Earth elemental' };
    }
    if (isT(/fey/) || /sprite|pixie|dryad|satyr|nymph|hag|eladrin|boggle|redcap|blink dog|green hag|sea hag|night hag|faerie|fairy|brownie|korred/.test(n)) return { kind: 'fey', pal: /hag/.test(n) ? 'moss' : /night/.test(n) ? 'night' : /dryad|satyr|nymph/.test(n) ? 'jade' : 'pink', label: 'Fey' };
    if (isT(/giant/) || /ogre|troll|\b(hill|frost|fire|stone|cloud|storm|mountain|fomorian) giant|ettin|cyclops|\boni\b|goliath/.test(n)) return { kind: 'giant', pal: /troll/.test(n) ? 'moss' : /frost|ice/.test(n) ? 'white' : /fire/.test(n) ? 'ember' : /hill|ogre/.test(n) ? 'brown' : /stone/.test(n) ? 'stone' : 'flesh', label: 'Giant' };
    if (isT(/ooze/) || /ooze|pudding|jelly|slime|gelatinous|cube/.test(n)) return { kind: 'ooze', pal: /black/.test(n) ? 'black' : /ochre|yellow/.test(n) ? 'gold' : /gray|grey/.test(n) ? 'grey' : /gelatinous|cube/.test(n) ? 'teal' : 'green', label: 'Ooze' };
    if (isT(/plant/) || /treant|shambling|myconid|blight|vine|tree|fungus|mushroom|shrieker|violet|thorn/.test(n)) return { kind: 'plant', pal: /myconid|fungus|mushroom|violet|shrieker/.test(n) ? 'purple' : 'moss', label: 'Plant' };
    if (isT(/construct/) || /golem|animated|armor|homunculus|scarecrow|shield guardian|helmed|modron|gear|clockwork|automaton/.test(n)) return { kind: 'construct', pal: /flesh/.test(n) ? 'rot' : /iron|steel|helmed|armor/.test(n) ? 'steel' : /clay|stone/.test(n) ? 'stone' : /bone/.test(n) ? 'bone' : /gold|bronze/.test(n) ? 'bronze' : 'grey', label: 'Construct' };
    if (isT(/aberration/) || /beholder|mind flayer|illithid|aboleth|gibbering|mouther|chuul|cloaker|umber|otyugh|eye|spectator|grell|nothic|intellect|kuo-toa|gauth/.test(n)) return { kind: 'eye', pal: /mind flayer|illithid|aboleth|kuo/.test(n) ? 'purple' : /nothic|gauth|beholder|eye|spectator/.test(n) ? 'jade' : 'night', label: 'Aberration' };
    if (isT(/beast/) || /wolf|dog|jackal|hyena|bear|spider|snake|serpent|viper|python|cobra|bat|rat|boar|lion|tiger|panther|cat|eagle|hawk|owl|raven|crow|bird|vulture|scorpion|crab|centipede|insect|wasp|bee|ape|horse|elk|deer|goat|ram|shark|crocodile|lizard|toad|frog|badger|weasel|mastiff|swarm|fish|octopus|squid|whale|elephant|mammoth|rhinoceros|camel|donkey|mule|pony|boar|worm|beetle|ant|mantis|stirge/.test(n)) {
      if (/spider|tarantula|arachn/.test(n)) return { kind: 'spider', pal: /phase|giant wolf/.test(n) ? 'purple' : /giant/.test(n) ? 'brown' : 'black', label: 'Spider' };
      if (/snake|serpent|viper|python|cobra|naga|lizard|basilisk|crocodile|salamander|worm/.test(n)) return { kind: 'snake', pal: /cobra|poison|venom|viper/.test(n) ? 'green' : /python|constrictor/.test(n) ? 'brown' : 'jade', label: 'Reptile' };
      if (/bat|stirge|bee|wasp|insect|swarm|mosquito|fly\b/.test(n)) return { kind: 'bat', pal: /stirge|insect|wasp|bee/.test(n) ? 'brown' : 'night', label: 'Flyer' };
      if (/eagle|hawk|owl|raven|crow|bird|vulture|roc|falcon|griffon|hippogriff|peryton/.test(n)) return { kind: 'bird', pal: /raven|crow/.test(n) ? 'black' : /owl/.test(n) ? 'brown' : /eagle|hawk|griffon|roc/.test(n) ? 'bronze' : 'grey', label: 'Bird' };
      if (/bear|ape|baboon|mammoth|elephant|rhinoceros|boar|gorilla|sloth/.test(n)) return { kind: 'bear', pal: /polar|white|ice/.test(n) ? 'white' : /black/.test(n) ? 'black' : /boar|ape/.test(n) ? 'grey' : 'brown', label: 'Brute beast' };
      if (/scorpion|crab|centipede|beetle|ant\b|mantis|lobster|chuul/.test(n)) return { kind: 'scorpion', pal: /giant|scorpion/.test(n) ? 'bronze' : 'rot', label: 'Crawler' };
      return { kind: 'wolf', pal: /dire|winter|ice|white/.test(n) ? 'white' : /black|panther|night/.test(n) ? 'black' : /lion|tiger|cat|leopard/.test(n) ? 'gold' : /wolf|dog|jackal|hyena|mastiff/.test(n) ? 'grey' : 'brown', label: 'Beast' };
    }
    if (isT(/monstrosity/) || /owlbear|manticore|chimera|hydra|basilisk|medusa|mimic|harpy|bulette|carrion|cockatrice|displacer|gorgon|griffon|kraken|lamia|minotaur|ankheg|behir|roper|rust monster|worg|yeti|tarrasque|wyvern|sphinx|trapper|umber|winter wolf|hook horror|darkmantle|death dog/.test(n)) {
      if (/scorpion|ankheg|rust monster|umber|bulette|carrion|hook/.test(n)) return { kind: 'scorpion', pal: 'rot', label: 'Monstrosity' };
      if (/harpy|griffon|owlbear|manticore|peryton/.test(n)) return { kind: 'bird', pal: 'brown', label: 'Monstrosity' };
      if (/hydra|medusa|lamia|basilisk|cockatrice/.test(n)) return { kind: 'snake', pal: 'jade', label: 'Monstrosity' };
      return { kind: 'claw', pal: /yeti|winter/.test(n) ? 'white' : /chimera|manticore|sphinx|minotaur/.test(n) ? 'bronze' : 'purple', label: 'Monstrosity' };
    }
    // humanoids and anything else
    if (/goblin|hobgoblin|bugbear|kobold|gnoll|lizardfolk|troglodyte|yuan-ti|merfolk|sahuagin|kuo/.test(n)) return { kind: /kobold|lizardfolk|troglodyte|yuan|sahuagin/.test(n) ? 'snake' : 'goblin', pal: /hobgoblin/.test(n) ? 'red' : /bugbear/.test(n) ? 'brown' : /kobold/.test(n) ? 'copper' : /gnoll/.test(n) ? 'gold' : /lizardfolk|troglodyte/.test(n) ? 'jade' : 'gob', label: 'Goblinoid' };
    if (/orc|half-orc|ogre|uruk/.test(n)) return { kind: 'orc', pal: 'orc', label: 'Orc' };
    if (/mage|wizard|sorcerer|warlock|witch|archmage|priest|acolyte|cultist|necromancer|druid|illusionist|enchanter|conjurer|diviner|evoker|shaman|cleric/.test(n)) return { kind: 'mage', pal: /necromancer|cultist|warlock/.test(n) ? 'night' : /druid|shaman/.test(n) ? 'moss' : /priest|cleric|acolyte/.test(n) ? 'gold' : 'blue', label: 'Caster' };
    if (/knight|guard|soldier|veteran|captain|commander|champion|gladiator|warrior|paladin|swashbuckler|berserker|marshal|sentinel|legionnaire|general|lord|noble/.test(n)) return { kind: 'knight', pal: /noble|lord/.test(n) ? 'gold' : 'steel', label: 'Soldier' };
    if (/bandit|thug|assassin|spy|scout|thief|rogue|cutpurse|brigand|pirate|smuggler|ranger|hunter|poacher|outlaw|mercenary|drow|duergar|spy/.test(n)) return { kind: 'hood', pal: /drow/.test(n) ? 'night' : /assassin/.test(n) ? 'black' : 'brown', label: 'Rogue' };
    return { kind: 'hood', pal: 'grey', label: 'Humanoid' };
  }
  const FAMILY = { dragon: 'dragon', skull: 'undead', ghost: 'undead', zombie: 'undead', vampire: 'undead', lich: 'undead', demon: 'fiend', angel: 'celestial', flame: 'elemental', water: 'elemental', wind: 'elemental', rock: 'elemental',
    fey: 'fey', giant: 'giant', ooze: 'ooze', plant: 'plant', construct: 'construct', eye: 'aberration', wolf: 'beast', bear: 'beast', spider: 'beast', snake: 'beast', bird: 'beast', bat: 'beast', claw: 'monstrosity', scorpion: 'monstrosity',
    goblin: 'humanoid', orc: 'humanoid', hood: 'humanoid', mage: 'humanoid', knight: 'humanoid' };

  function spriteRows(kind) {
    const half = SPRITES[kind] || SPRITES.hood;
    // trim empty rows, then centre vertically in 16 rows
    let rows = half.map(r => (r + '........').slice(0, 8));
    while (rows.length && /^\.+$/.test(rows[0])) rows.shift();
    while (rows.length && /^\.+$/.test(rows[rows.length - 1])) rows.pop();
    const top = Math.floor((16 - rows.length) / 2);
    const full = rows.map(r => r + r.split('').reverse().join(''));
    return { full, top };
  }
  window.monsterArt = function (m) { const p = pick(m || {}); return { ...p, family: FAMILY[p.kind] || 'humanoid', colors: PAL[p.pal] || PAL.grey }; };
  // Inline SVG for a token face. `circle` clips it into a round token with a tinted background.
  window.monsterArtSvg = function (m, px, circle) {
    const art = window.monsterArt(m), { full, top } = spriteRows(art.kind), c = art.colors;
    const col = { a: c.a, b: c.b, c: c.c, e: c.e, w: c.w, o: '#0d0a08', k: '#0d0a08', r: '#d83a3a', y: '#f2c94c' };
    let rects = '';
    full.forEach((row, y) => {
      let x = 0;
      while (x < 16) {
        const ch = row[x];
        if (ch === '.' || !col[ch]) { x++; continue; }
        let run = 1; while (x + run < 16 && row[x + run] === ch) run++;
        rects += `<rect x="${x}" y="${y + top}" width="${run}" height="1" fill="${col[ch]}"/>`;
        x += run;
      }
    });
    const bg = BG[art.family] || '#1f1f1f';
    const id = 'ma' + Math.random().toString(36).slice(2, 7);
    return `<svg class="monster-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="${px}" height="${px}" shape-rendering="crispEdges" role="img" aria-label="${art.label}">`
      + (circle ? `<defs><radialGradient id="${id}" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="${c.b}" stop-opacity="0.55"/><stop offset="1" stop-color="${bg}"/></radialGradient></defs><circle cx="8" cy="8" r="8" fill="url(#${id})"/>` : '')
      + rects + '</svg>';
  };
  window.MONSTER_ART_KINDS = Object.keys(SPRITES);
})();
