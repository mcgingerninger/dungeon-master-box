// Which base sprite an item gets, from its name (lower-cased), plus fallbacks and default materials.
// ItemArtRules.rules is an ordered list of [base | [bases...], regex, optional test(item)]; the first
// match wins, and when several bases are listed one is picked by hashing the item's name so a whole
// class of items (every "Shield", every "Helm") still shows variety.
(function () {
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const notPet = it => it.type !== 'companion';
  const R = [];
  const add = (b, re, ok) => R.push([b, re, ok]);

  // ---- named oddities that would otherwise match a broader rule below ----
  add('bedroll', /bedroll/);
  add('horseshoe', /horseshoe/);
  add('shackles', /shackles|manacles|handcuffs/);
  add('tower', /tower|fortress/);
  add('ingot', /beeswax/);
  add('chalk', /sealing wax/);
  add('sash', /scarf|scrap of foreign cloth/, it => !/head/i.test(it.name));
  add('hood', /headscarf/);
  add('chest', /casket/);
  add('journal', /ledger|chronicle/);
  add('poster', /pennant/);
  add('flask', /vessel of|sovereign glue/);
  add('cup', /bowl of/);
  add('urn', /dragon vessel/);
  add('handpart', /hand of vecna/);
  add('eyeball', /eye of vecna/);
  add('orb', /sphere of annihilation/);
  add('statuette', /hollow dragon/);
  add('charm', /scaled ornament/);
  // ---- weapons (specific before general) ----
  add('wandbone', /wand of orcus/);
  add('greatsword', /greatsword|claymore|zweihander|great sword|blackrazor/);
  add('rapier', /rapier/);
  add('scimitar', /scimitar|cutlass/);
  add('sabre', /sabre|saber/);
  add('falchion', /falchion/);
  add('kukri', /kukri/);
  add('wandblade', /wand blade|wandblade/);
  add('stiletto', /stiletto/);
  add('knife', /pocket knife|small knife|\bknife\b/);
  add('dagger', /dagger|\bdirk\b|shiv/);
  add('sickle', /sickle/);
  add('warpick', /war pick|\bpick\b/, notPet);
  add('greataxe', /great ?axe/);
  add('berserkeraxe', /berserker axe/);
  add('battleaxe', /battle ?axe/);
  add('handaxe', /handaxe|hand axe|hatchet|\baxe\b/, notPet);
  add('maul', /\bmaul\b|thornmaul|bonecrusher|hammer of thunderbolts/);
  add('warhammer', /war ?hammer|whelm|\bhammer\b/);
  add('morningstar', /morning ?star/);
  add('scepter', /warlock's scepter|scepter|sceptre/);
  add('mace', /\bmace\b/);
  add('flail', /flail/);
  add('whip', /\bwhip\b/);
  add('club', /\bclub\b/);
  add('dragonlance', /dragonlance/);
  add('halberd', /halberd/);
  add('glaive', /glaive/);
  add('pike', /\bpike\b/);
  add('lance', /\blance\b/);
  add('trident', /trident|\bwave \(/);
  add('javelin', /javelin/);
  add('spear', /\bspear\b/);
  add('heavycrossbow', /heavy crossbow/);
  add('handcrossbow', /hand crossbow/);
  add('crossbow', /crossbow/);
  add('longbow', /longbow|oathbow/);
  add('shortbow', /shortbow|short bow/);
  add('longbow', /\bbow\b/);
  add('slingstone', /sling stone|sling bullet/);
  add('sling', /\bsling\b/);
  add('quiver', /quiver/);
  add('arrow', /arrow of slaying/);
  add('arrows', /arrows?\b|ammunition/);
  add('bolts', /\bbolts?\b/);
  add('dart', /\bdart\b/);
  add('shuriken', /shuriken/);
  add('stake', /wooden stake|\bstake\b/);
  add('cannon', /cannon/);
  add('censer', /censer/);
  add('quarterstaff', /quarterstaff/);
  add('battlestaff', /battle staff/);
  add('staffserpent', /staff of the (adder|python)|staff of (the )?serpent|adder staff/);
  add('stafftree', /staff of (the )?woodlands/);
  add('staffflower', /staff of flowers/);
  add('staffbird', /staff of birdcalls/);
  add('stafffire', /staff of fire|staff of the ember/);
  add('staffcross', /staff of healing/);
  add('staffskull', /staff of withering/);
  add('staffinsect', /staff of swarming/);
  add('staffheart', /staff of charming/);
  add('staffcrystal', /staff of (power|the magi)|staff of the archmage/);
  add('staffmoon', /staff of .*moon|moon staff/);
  add('staff', /\bstaff\b/);
  add('rod', /\brod\b|rod of|immovable rod/);
  add('wand', /\bwand\b/);
  add('longsword', /longsword|long sword|holy avenger|vorpal|nine lives stealer|defender|luck blade|sun blade/);
  add('shortsword', /shortsword|short sword|twin shortswords/);
  add('sword', /\bsword\b|blade|dancing sword|brand\b|tongue\b|sword of/);

  // ---- armour & worn ----
  add('towershield', /tower shield/);
  add('buckler', /buckler/);
  add('spellshield', /spellguard shield|spell shield/);
  add('eyeshield', /animated shield/);
  add('faceshield', /shield of expression/);
  add('kiteshield', /kite shield|aegis of the last stand/);
  add(['roundshield', 'heatershield', 'kiteshield'], /shield|aegis/);
  add('greathelm', /great helm|greathelm/);
  add('platehelm', /plate helm|plate helmet/);
  add('dreadhelm', /dread helm/);
  add('crown', /\bcrown\b/);
  add('circlet', /circlet|diadem|tiara|coronet|headband/);
  add('beakmask', /peregrine mask/);
  add('mask', /\bmask\b/);
  add('goggles', /goggles/);
  add('lenses', /eyes of|ersatz eye|lenses/);
  add('hat', /\bhat\b/);
  add('hood', /\bhood\b/);
  add('coif', /coif/);
  add(['helm', 'platehelm', 'greathelm'], /\bhelm\b|helmet|helm of/);
  add('wings', /wings of/);
  add('tattoo', /tattoo/);
  add('platearmor', /plate armor|plate armour|demon plate|dwarven plate|plate of the|mithral plate$|dragonhide plate|dragon plate|plate armor of/);
  add('halfplate', /half plate/);
  add('splint', /splint/);
  add('chainshirt', /chain shirt/);
  add('chainmail', /chain mail|chainmail|elven chain/);
  add('ringmail', /ring mail/);
  add('scalemail', /scale mail|dragon scale|scalemail/);
  add('breastplate', /breastplate|cuirass/);
  add('studded', /studded leather/);
  add('padded', /padded armor|padded\b/);
  add('hidearmor', /hide armor|hide of|ironhide|dragonhide/);
  add('leather', /leather armor|warcry leather|\bleather\b.*armor|hunter's coat/);
  add('coat', /coat\b|clothes of mending|common clothes|clothes/);
  add('vestments', /vestments/);
  add('robe', /\brobes?\b/);
  add(['platearmor', 'halfplate', 'breastplate', 'chainmail', 'scalemail'], /armor|armour|mithral plate|plate\b/, it => it.type !== 'weapon');
  add('shroud', /shroud/);
  add('cape', /\bcape\b/);
  add('mantle', /mantle/);
  add('cloak', /cloak|cape of/);
  add('sash', /\bsash\b/);
  add('girdle', /girdle/);
  add('belt', /\bbelt\b/);
  add('brooch', /buckle|brooch|clasp/);
  add('gauntlet', /gauntlet/);
  add('bracers', /bracers?/);
  add('gloves', /gloves?\b|handwear|mitt/);
  add('wingedboots', /winged boots|boots of (striding|speed|levitation)/);
  add('greaves', /greaves/);
  add('skates', /skates/);
  add('sandals', /sandals/);
  add('slippers', /slippers|socks/);
  add('boots', /\bboots?\b|spare boot/);
  // ---- jewellery ----
  add('signetring', /signet|seal-ring|sealring/);
  add('bandring', /wedding band|brass ring|\bband\b/);
  add('ring', /\brings?\b/);
  add('locket', /locket/);
  add('medallion', /medallion|periapt of|saint's token/);
  add('torc', /\btorc\b|gorget|choker|collar/);
  add('beads', /prayer beads|\bbeads?\b/, notPet);
  add('necklace', /necklace/);
  add('amulet', /amulet|pendant|talisman|scarab|periapt/);
  add('token', /\btoken\b|sigil|seal\b/);
  // ---- light & tools ----
  add('torch', /torch/);
  add('candle', /candle/);
  add('hoodedlantern', /hooded|lantern, hooded/);
  add('lantern', /lantern/);
  add('brazier', /brazier/);
  add('rope', /\brope\b|ball of twine|twine/);
  add('grapplinghook', /grappling/);
  add('crowbar', /crowbar/);
  add('whetstone', /whetstone/);
  add('spikes', /spikes/);
  add('tinderbox', /tinderbox/);
  add('bell', /\bbell\b|chime/);
  add('whistle', /whistle/);
  add('horn', /\bhorn\b|horn of/);
  add('compass', /compass|orb of direction/);
  add('mirror', /mirror/);
  add('spyglass', /spyglass|telescope|surveying/);
  add('scissors', /scissors/);
  add('sewing', /needle|thread|sewing/);
  add('comb', /\bcomb\b/);
  add('soap', /\bsoap\b/);
  add('thimble', /thimble/);
  add('chalk', /chalk|charcoal pencil|stub of charcoal/);
  add('panpipes', /pipes of|\bpipes\b/);
  add('pipe', /\bpipe\b/);
  add('lute', /lute|instrument of the bards/);
  add('drum', /drum/);
  add('kit', /\bkit\b|thieves' tools|lockpick|climber|surgeon/);
  add('padlock', /padlock|lock of eternal|\block\b/);
  add('key', /\bkeys?\b/);
  add('bandage', /bandage/);
  add('dice', /\bdice\b|\bdie\b/);
  add('cards', /playing cards|deck of playing/);
  add('deck', /deck of|tarokka|runes deck|\bdeck\b/);
  add('knucklebones', /knucklebone/);
  add('board', /game pieces|game board/);
  add('toy', /\btoy\b/);
  add('earhorn', /ear horn/);
  add('fishhook', /fishing|fishhook|iron fishhook/);
  add('snare', /\bsnare\b/);
  add('limb', /prosthetic/);
  add('cane', /\bcane\b/);
  add('ladder', /ladder/);
  add('pole', /\bpole\b/);
  add('ram', /portable ram/);
  add('saddle', /saddle/);
  add('trophy', /trophy|boar's head/);
  add('carpet', /carpet|\brug\b/);
  add('broom', /broom/);
  add('boat', /folding boat/);
  add('hole', /portable hole/);
  add('well', /well of many worlds/);
  add('pocketwatch', /pocketwatch|pocket watch|clockwork/);
  add('hourglass', /hourglass|borrowed time/);
  // ---- containers & drink ----
  add('beltpouch', /belt pouch/);
  add('purse', /purse/);
  add('sack', /\bsack\b/);
  add('pouch', /pouch|trail mix/);
  add('satchel', /bag of|satchel|haversack|backpack|\bbag\b/, it => !/tanglefoot/i.test(it.name));
  add('strongbox', /strongbox|iron-banded chest/);
  add('coffer', /coffer|reliquary/);
  add('chest', /\bchest\b/);
  add('waterskin', /waterskin|canteen/);
  add('oilflask', /flask of oil|oil flask|alchemist's fire/);
  add('flask', /\bflask\b/);
  add('inkbottle', /bottle of ink|ink\b/);
  add('decanter', /decanter/);
  add('jug', /\bjug\b/);
  add('bottle', /bottle|spell bottle/);
  add('perfume', /perfume/);
  add('salve', /salve|ointment|keoghtom|tinned/);
  add('tin', /\btin\b/);
  add('vial', /\bvial\b|antitoxin|antidote|tears of|borrowed/);
  add(['potion', 'elixir', 'tonic'], /potion|elixir|philter|draught|\btonic\b|\bbrew\b|\boil of|solvent|phoenix's breath|thousand faces/);
  add('chalice', /chalice/);
  add('mug', /tankard|\bmug\b/);
  add('cup', /\bcup\b/);
  add('cauldron', /cauldron/);
  add('pot', /\bpot\b|iron pot/);
  add('urn', /\burn\b|ashes/);
  // ---- paper ----
  add('scroll', /scroll/);
  add('map', /\bmap\b/);
  add('decree', /decree|\bpass\b|deed/);
  add('letter', /letter|records|rolls|service record|missing page/);
  add('note', /\bnote\b|receipt|notice/);
  add('poster', /poster|wanted/);
  add('spellbook', /spellbook/);
  add('grimoire', /grimoire|bestiary/);
  add('tome', /\btome\b|manual|codex/);
  add('journal', /journal|notebook|chapbook|almanac|\bbook\b/);
  add('parchment', /parchment|paper/);
  add('tally', /tally/);
  add('quill', /quill/);
  // ---- food ----
  add('ration', /ration|dried fruit|jerky|hardtack/);
  add('mushroom', /mushroom/);
  add('fruit', /fruit|apple/);
  add('cheese', /cheese/);
  add('candy', /candy|sweet/);
  add('bread', /bread|biscuit/);
  add('herbs', /herbs|lavender|pipe weed|bundle/);
  add('dust', /dust of|powdered|pressure capsule|perfume/);
  add('bead', /bead of/);
  // ---- treasure & curios ----
  add('coins', /stack of|handful of mixed|coins/);
  add('coin', /\bcoin\b/);
  add('ingot', /ingot|\bbar of/);
  add('pearl', /pearl/);
  add('gem', /gem|ruby|sapphire|quartz|diamond|emerald|jewel|opal|topaz/);
  add('orb', /orb of|driftglobe|\bglobe\b|crystal ball|orb\b/);
  add('ioun', /ioun/);
  add('cube', /\bcube\b/);
  add('runestone', /rune-carved|puzzle stone|runestone|sending stones|stone of|small painted stone|\bstone\b/);
  add('shard', /shard|fragment/);
  add('idol', /idol/);
  add('figurine', /figurine/);
  add('statue', /statue/);
  add('charm', /charm|lucky|rabbit's foot|lock of hair|pressed flower|carved bone/);


  // ---------------- creature parts, limbs and companions ----------------
  const PART_BY_ID = { heartstone: 'heartstone', soulfragment: 'soulfragment', essence: 'essence', core: 'core', eye: 'eyeball', feather: 'feather', tooth: 'tooth', scale: 'scalepart', wingmembrane: 'wingmem', antler: 'antler', shell: 'shellpart', pelt: 'pelt',
    claw: 'claw', fang: 'fang', talon: 'talon', horn: 'horn', bone: 'bone', tendon: 'tendon', venomsac: 'venomsac', hide: 'hide', blood: 'bloodvial', marrow: 'marrow', wing: 'wing', tail: 'tailpart', tongue: 'tonguepart' };
  const BONY = new Set(['tooth', 'fang', 'tusk', 'claw', 'talon', 'horn', 'antler', 'bone', 'ribbone', 'vertebra', 'jawbone', 'marrow']);
  function partBase(item) {
    const name = String(item.name || '').toLowerCase();
    let id = item.anatomicalId;
    if (!id && item.type === 'craftable') { const m = /(heartstone|soul fragment|essence|core|eye|feather|tooth|scale|wing membrane|antler|shell|carapace|pelt|fur|mane|claw|hand|pincer|tentacle|hoof|tusk|fang|talon|horn|bone|vertebra|jawbone|tendon|venom sac|gland|hide|skin|scalp|blood|marrow|wing|tail|tongue)$/.exec(name); if (m) id = { 'soul fragment': 'soulfragment', 'wing membrane': 'wingmembrane', carapace: 'shell', fur: 'pelt', mane: 'pelt', hand: 'claw', pincer: 'claw', tentacle: 'claw', hoof: 'claw', tusk: 'fang', 'venom sac': 'venomsac', gland: 'venomsac', skin: 'hide', scalp: 'hide', vertebra: 'bone', jawbone: 'bone' }[m[1]] || m[1]; }
    if (!id && !(item.type === 'craftable' && item.partType)) return null;
    let b = PART_BY_ID[id];
    if (id === 'eye' && /compound|faceted|multifaceted|stalked|beadlike/.test(name)) b = 'compoundeye';
    else if (id === 'claw') b = /pincer/.test(name) ? 'pincer' : /tentacle/.test(name) ? 'tentacle' : /hoof/.test(name) ? 'hoof' : /\bhand\b/.test(name) ? 'handpart' : /clawed foot|talon/.test(name) ? 'talon' : 'claw';
    else if (id === 'fang' && /tusk/.test(name)) b = 'tusk';
    else if (id === 'horn') b = /tusk/.test(name) ? 'tusk' : /antler/.test(name) ? 'antler' : 'horn';
    else if (id === 'bone') b = /rib/.test(name) ? 'ribbone' : /vertebra/.test(name) ? 'vertebra' : /jaw/.test(name) ? 'jawbone' : 'bone';
    else if (id === 'hide') b = /scalp|skin/.test(name) ? 'pelt' : 'hide';
    else if (id === 'wing') b = /membran|batlike|leathery/.test(name) ? 'wingmem' : /insect|veined|delicate/.test(name) ? 'insectwing' : 'wing';
    else if (id === 'tail') b = /stinger|barbed|venomous/.test(name) ? 'stingertail' : 'tailpart';
    else if (id === 'tongue') b = /forked|serpent|scaled/.test(name) ? 'forkedtongue' : 'tonguepart';
    return b || null;
  }
  const LIMB_BY = { arm: 'limb_arm', hand: 'limb_hand', leg: 'limb_leg', foot: 'limb_foot', eye: 'limb_eye', ear: 'limb_ear', finger: 'limb_finger', heart: 'limb_heart', tongue: 'limb_tongue' };
  const PET = [
    [/shadow mastiff/, 'shadowhound'], [/mastiff/, 'mastiff'], [/wolf pup|winter wolf|dire wolf|\bwolf\b/, 'wolf'], [/puppy|\bpup\b|blink dog|mutt/, 'pup'], [/displacer/, 'displacer'], [/housecat|\bcat\b/, 'cat'],
    [/displacer/, 'displacer'], [/pigeon|dove/, 'pigeon'], [/songbird/, 'songbird'], [/crow|raven/, 'crow'], [/hawk/, 'hawk'], [/vulture/, 'vulture'], [/\bowl\b/, 'owl'], [/chicken/, 'chicken'], [/duckling/, 'duckling'], [/axe beak/, 'axebeak'], [/phoenix/, 'phoenix'],
    [/mouse/, 'mouse'], [/\brat\b/, 'rat'], [/hedgehog/, 'hedgehog'], [/weasel|ferret/, 'weasel'], [/otter/, 'otter'], [/badger/, 'badger'], [/\bfox\b/, 'fox'],
    [/tortoise|turtle/, 'tortoise'], [/toad|frog/, 'toad'], [/snake|constrictor|serpent/, 'snakepet'], [/lizard/, 'lizard'], [/seahorse/, 'seahorse'], [/crab/, 'crab'], [/beetle/, 'beetle'], [/centipede/, 'centipede'], [/swarm|housefly|\bfly\b/, 'swarm'],
    [/celestial steed|steed of/, 'steedcelestial'], [/pegasus/, 'pegasus'], [/hippogriff/, 'hippogriff'], [/griffon|griffin/, 'griffon'], [/pony/, 'pony'], [/\bmule\b/, 'mule'], [/horse|warhorse|steed/, 'horse'], [/camel/, 'camel'], [/\belk\b/, 'elk'], [/goat/, 'goat'], [/strider/, 'giantstrider'],
    [/faerie dragon/, 'faeriedragon'], [/wyrmling/, 'wyrmling'], [/pseudodragon/, 'pseudodragon'], [/imp\b|quasit/, 'imp'], [/homunculus/, 'homunculus'], [/sprite|pixie/, 'sprite'], [/couatl/, 'couatl'], [/archon/, 'archon'], [/fallen star/, 'starfragment'],
  ];
  const PET_PAL = [
    [/black|shadow|raven|crow|imp\b|quasit/, ['#2c2c36', '#101016', '#585868', '#9a7cff']], [/winter|white|pup bound|phoenix chick/, ['#dfe6ee', '#9aa8b8', '#ffffff', '#7fd0f0']], [/phoenix/, ['#e8631d', '#9c2e08', '#ffd04a', '#fff1a0']],
    [/bronze/, ['#b5763a', '#6b3f17', '#e0a266', '#ffe08a']], [/faerie dragon/, ['#c06cd8', '#7a2f94', '#f0a8ff', '#fff2a8']], [/pseudodragon|couatl/, ['#3f9a6a', '#1f5a3c', '#8fd8a8', '#e8c04a']],
    [/toad|frog|lizard|snake|beetle|crab|strider|centipede/, ['#5f8f3c', '#33501e', '#93c46a', '#fff29a']], [/pegasus|steed|archon|griffon|hippogriff|couatl/, ['#f2eadc', '#b9ad96', '#ffffff', '#e8c04a']],
    [/sprite|pixie/, ['#7fd8c0', '#2f8f78', '#c8fff0', '#ffe27a']], [/mouse|rat|weasel|ferret|badger|hedgehog|otter|fox|goat|mule|horse|pony|camel|elk|mastiff|dog|puppy|cat|owl|hawk|vulture|chicken|pigeon|songbird|duckling|tortoise|wolf/, null],
  ];
  function creatureMat(item, bony) {
    const kit = window.PixelKit, name = String(item.sourceMonster || item.name || '');
    let pal = null;
    if (item.type === 'companion') { const n = name.toLowerCase(); for (const [re, c] of PET_PAL) if (re.test(n) && c) { pal = { a: c[0], b: c[1], c: c[2], e: c[3] }; break; } if (!pal) { const base = ['#8a5a35', '#a0703c', '#8d8f96', '#c8a070', '#6a4a30', '#b88458'][hash(n) % 6]; pal = { a: base, b: kit.mix(base, '#000000', 0.45), c: kit.mix(base, '#ffffff', 0.38), e: '#ffd97a' }; } }
    else if (window.monsterArt) { const a = window.monsterArt({ name: item.sourceMonster || '', type: item.creatureFamily || '' }).colors; pal = { a: a.a, b: a.b, c: a.c, e: a.e }; }
    else pal = { a: '#8a5a35', b: '#4d2f17', c: '#b88458', e: '#ffd97a' };
    if (bony) { const m = kit.mix; return { a: m('#d8cdb0', pal.a, 0.18), b: m('#928568', pal.b, 0.2), c: m('#f4ecd6', pal.c, 0.12), t: pal.a }; }
    return { a: pal.a, b: pal.b, c: pal.c, t: pal.e };
  }
  const SKIN = [['#e0b090', '#9a6a4a', '#f6d2b8'], ['#c68863', '#7a4a30', '#e4aa88'], ['#8a5a3a', '#4a2a18', '#b07c58'], ['#e8c8a8', '#a88060', '#fae6d0'], ['#7a9a5a', '#44582d', '#a9c58a'], ['#b8b0c8', '#6a6480', '#dcd6ec']];

  const FALL_TRINKETS = ['orb', 'gem', 'runestone', 'charm', 'ioun', 'crystal', 'shard', 'medallion'];
  window.ItemArtRules = {
    rules: R.map(([b, re, ok]) => [b, re, ok]),
    fallback(item) { return null; },
    // `rules` entries with an array pick by name hash; resolved in resolve() below
    resolve(item) {
      const name = String(item.name || '').toLowerCase().replace(/<[^>]+>/g, ' ');
      const SPR = window.ItemArtSprites;
      if (item.type === 'companion') { for (const [re, b] of PET) if (re.test(name) && SPR[b]) return b; return ['dog', 'cat', 'horse'][hash(item.name) % 3]; }
      { const pb = partBase(item); if (pb && SPR[pb]) return pb; }
      if (item.type === 'limb') { const sub = LIMB_BY[item.subcategory] || (/\b(arm|hand|leg|foot|eye|ear|finger|heart|tongue)\b/.exec(name) && LIMB_BY[/\b(arm|hand|leg|foot|eye|ear|finger|heart|tongue)\b/.exec(name)[1]]); if (sub && SPR[sub]) return sub; }
      for (const [b, re, ok] of R) {
        if (!re.test(name) || (ok && !ok(item))) continue;
        const pick = Array.isArray(b) ? b[hash(item.name) % b.length] : b;
        if (SPR[pick]) return pick;
      }
      // type-based fallbacks
      const t = item.type, h = hash(item.name);
      if (t === 'weapon') return ['sword', 'longsword', 'shortsword', 'dagger', 'mace', 'handaxe'][h % 6];
      if (t === 'armor') return ['chainmail', 'breastplate', 'scalemail', 'halfplate', 'platearmor'][h % 5];
      if (t === 'consumable') return ['potion', 'elixir', 'tonic', 'vial'][h % 4];
      if (t === 'document') return 'journal';
      return FALL_TRINKETS[h % FALL_TRINKETS.length];
    },
    material(base, name, item) {
      if (item && item.type === 'companion') return creatureMat(item, false);
      if (item && (item.anatomicalId || (item.type === 'craftable' && item.partType))) return creatureMat(item, BONY.has(base));
      if (/^limb_/.test(base)) { const k = SKIN[hash(name) % SKIN.length]; return base === 'limb_heart' ? { a: '#a82a3a', b: '#58101c', c: '#e0707c', t: '#e0707c' } : { a: k[0], b: k[1], c: k[2], t: k[2] }; }
      const D = { mushroom: 'mushcap', fruit: 'apple', cheese: 'cheesey', bread: 'crust', candy: 'candy', herbs: 'greencloth', potion: 'glass', ration: 'crust', scroll: 'linen', dust: 'linen', bead: 'glass', elixir: 'glass', tonic: 'glass', vial: 'glass', flask: 'iron', oilflask: 'glass', bottle: 'glass', decanter: 'glass', perfume: 'glass', orb: 'crystal', crystal: 'crystal', gem: 'ruby', pearl: 'ivory', ring: 'gold', signetring: 'gold', bandring: 'gold', amulet: 'gold', medallion: 'gold', necklace: 'gold', torc: 'gold', locket: 'gold', crown: 'gold', circlet: 'silver', coin: 'gold', coins: 'gold', ingot: 'silver',
        staff: 'oak', quarterstaff: 'oak', battlestaff: 'oak', wand: 'wood', bow: 'wood', longbow: 'wood', shortbow: 'wood', crossbow: 'wood', club: 'oak',
        leather: 'leather', studded: 'leather', boots: 'leather', gloves: 'leather', sandals: 'leather', belt: 'leather', pouch: 'leather', beltpouch: 'leather', purse: 'leather', satchel: 'leather', quiver: 'leather', waterskin: 'leather', coat: 'leather', saddle: 'leather', hidearmor: 'hide', padded: 'linen', sack: 'linen',
        robe: 'cloth', hood: 'cloth', cloak: 'cloth', cape: 'cloth', mantle: 'cloth', vestments: 'linen', sash: 'cloth', slippers: 'cloth', hat: 'cloth', shroud: 'greycloth', carpet: 'cloth', scalemail: 'scale',
        jug: 'stone', urn: 'stone', statue: 'ivory', statuette: 'stone', idol: 'wood', runestone: 'stone' };
      if (/^(mushroom|fruit|cheese|bread|candy|ration|herbs|potion|elixir|tonic|vial|bottle|decanter|oilflask|perfume|bead|dust|scroll)$/.test(base) && D[base]) return '!' + D[base];
      if (D[base]) return D[base];
      if (/^(torch|candle|broom|ladder|rope|toy|tally|pipe|lute|drum|panpipes|cane|ram|trophy|cup|mug)$/.test(base)) return /^(rope)$/.test(base) ? 'hide' : 'wood';
      return 'steel';
    },
  };
  // item-art.js reads rules through this resolver
  window.ItemArtRules.rules = [];
  window.ItemArtRules.fallback = it => window.ItemArtRules.resolve(it);
})();
