// Attack narrator data, part 1: what each damage type looks, sounds and feels like.
// Every pool is an array of phrases that the engine picks from (seeded, so the same attack reads the same
// way until the DM asks for another take). Phrases are written so they can be dropped into the sentence
// templates in attack-narrator-moves.js:
//   sub    singular noun phrase for the "stuff" of the attack      "a rope of flame"
//   stuff  mass noun                                               "flame"
//   adj    adjectives for it                                       "searing"
//   gather what happens while a magical form gathers               (full clause)
//   glow / sound / feel / smell   scene dressing clauses           (no final full stop)
//   hit    third-person verbs for contact                          "sears"
//   wound  noun phrases by tier 0-5 ("leaving ...")
//   gear   what it does to armour and clothing                     (full clause)
//   residue / env  what is left behind; what it does to the room   (full clause)
//   miss   what happens where it lands instead of the target       (full clause, {tgt} allowed)
//   dodge  half damage / a successful save                          (full clause, {tgt} allowed)
(function () {
  const D = (window.AttackNarratorData = window.AttackNarratorData || {});
  const T = (...tiers) => tiers; // tier arrays, index 0-5

  D.ELEMENTS = {
    fire: {
      name: 'fire', magic: true,
      sub: ['a rope of living flame', 'a roiling sheet of fire', 'a spear of white-orange fire', 'a rushing wall of flame', 'a tongue of fire', 'a thick curl of burning gas'],
      stuff: ['flame', 'fire', 'heat', 'embers'],
      adj: ['searing', 'roaring', 'blistering', 'white-hot', 'blazing', 'scorching', 'hungry'],
      gather: ['Heat pours into the air as the light grows brighter and angrier, every shadow in the room jumping and twisting.', 'The air is dragged inward toward a core of glowing heat, and the light in the area swells until it hurts to look at.', 'Sparks and motes of ember bloom out of nothing, drifting toward a point that burns hotter by the heartbeat.', 'Warmth becomes heat becomes a dry, pressing swelter, and the air itself seems to catch.'],
      glow: ['the light flares orange and violent', 'shadows lurch across every wall', 'the air shimmers with heat haze', 'everything within sight takes on a molten gold edge'],
      sound: ['a roar like a furnace door thrown open', 'the crackle and hiss of burning air', 'a deep, hungry rush of sound', 'the snapping crack of fire taking hold'],
      feel: ['a wall of heat that dries the eyes and snatches at the breath', 'scalding air that hurts to inhale', 'a blast of heat that blisters bare skin from several feet away'],
      smell: ['the stink of scorched hair and hot metal', 'acrid smoke', 'singed cloth and cooking fat'],
      hit: ['sears', 'scorches', 'chars', 'blisters', 'engulfs', 'sizzles across'],
      wound: T(
        ['a small, angry burn', 'a reddened patch of singed skin', 'a smear of soot and a stinging blister'],
        ['a hand-sized blistering burn', 'singed hair and weeping red skin', 'a painful, shining burn'],
        ['deep burns that blister and split', 'charred patches of cloth and skin fused together', 'angry, weeping burns across the whole limb'],
        ['burns that blacken skin down to raw, glistening flesh', 'armor too hot to touch and flesh cooking beneath it', 'scorched muscle and the smell of cooked meat'],
        ['burns that strip away skin in sheets and leave blackened tissue behind', 'a wound that is more char than flesh, edged in white blisters', 'flesh that roasts where it stands'],
        ['a body-wide immolation that reduces cloth to ash and flesh to blackened ruin', 'burns so deep that bone shows pale through the char', 'a pillar of flame that leaves almost nothing recognizable']
      ),
      gear: ['Armor heats until the straps scorch and the metal is too hot to touch.', 'Leather curls and blackens; padding smolders against the skin beneath.', 'Cloaks and cords catch and flare away in a heartbeat.'],
      residue: ['Scorched cloth smolders and thin curls of smoke rise from the target.', 'Small fires gnaw at anything flammable nearby.', 'The ground ticks and cracks as it cools, scorched black.'],
      env: ['Anything flammable nearby — rope, cloth, oil, dry timber — catches.', 'Torches gutter, then flare; wooden doors and furniture begin to smoke.', 'Stone blackens in a wide splash and the air is hard to breathe for a moment.'],
      miss: ['The flame splashes against the floor beside {tgt}, scorching the stone black.', 'Fire rushes past {tgt} and smears across the wall, leaving a glowing, smoking scar.', 'The heat alone lifts the hair on {tgt}\'s arms as the flame misses by a hand\'s width.'],
      dodge: ['{Tgt} twists clear of the worst of it, the edge of the blaze scorching their back.', '{Tgt} drops and rolls, singed and gasping but still upright.', '{Tgt} throws an arm across their face and takes the glancing heat, not the full burn.']
    },
    cold: {
      name: 'cold', magic: true,
      sub: ['a lance of blue-white ice', 'a spray of hail and frost', 'a freezing mist', 'a spear of jagged ice', 'a rushing gale of rime', 'a shard of living winter'],
      stuff: ['frost', 'ice', 'cold', 'rime'],
      adj: ['freezing', 'bitter', 'numbing', 'glacial', 'biting', 'frost-laden'],
      gather: ['Frost races outward across every surface and the breath of everyone nearby turns to fog as a core of pale blue light condenses.', 'The temperature plunges; moisture in the air crackles into glittering needles that orbit a point of pure cold.', 'A hush falls as the warmth is drawn out of the room, and the air itself seems to thicken and whiten.'],
      glow: ['the light turns pale and bluish', 'ice crystals glitter in the air', 'frost spreads over stone and metal with a sound like cracking glass'],
      sound: ['a thin, rising crystalline whine', 'the sharp tick and crack of freezing water', 'a long, whistling gust like winter wind'],
      feel: ['a cold that steals the breath and stings the teeth', 'a drop in temperature that aches in the bones', 'air so cold it burns the throat'],
      smell: ['the clean, metallic smell of fresh ice', 'sharp, empty winter air', 'a faint tang of frozen stone'],
      hit: ['freezes', 'frosts', 'numbs', 'rimes', 'bites into', 'locks around'],
      wound: T(
        ['a patch of numb, whitened skin', 'a stinging frost-nip', 'a smear of rime that melts into a red mark'],
        ['white, waxy frostbite and stiff fingers', 'skin gone numb and mottled blue', 'a creeping rime that cracks as the target moves'],
        ['deep frostbite that blackens the edges and locks the joints', 'flesh stiff and bloodless under a skin of ice', 'a layer of frost that tears skin when it breaks'],
        ['limbs stiff with ice, skin splitting along the frozen seams', 'frost that reaches into the bone, every movement a grinding ache', 'a body wrapped in cracking ice that burns like fire'],
        ['flesh frozen solid in patches, blackened and brittle', 'ice that forms inside the wound itself and pries it wider', 'a numbness so deep the body forgets which parts are still its own'],
        ['a body flash-frozen to the marrow, ice splintering along every joint', 'flesh crystallizing and cracking like pottery', 'a figure rimed white from head to toe, barely clinging to life']
      ),
      gear: ['Armor stiffens and frosts over, its straps brittle and its joints binding.', 'Metal plates grow so cold they stick to skin; cloth freezes into a board.', 'Water in the target\'s gear crackles into ice.'],
      residue: ['Frost clings to hair, eyelashes and armor, and breath comes out in thick clouds.', 'A slick of ice spreads across the ground, thin and treacherous.', 'The nearest surfaces are furred white with rime.'],
      env: ['Standing water freezes over, and the floor near the impact turns slick with ice.', 'Torchlight shrinks and flames gutter as the cold settles over the area.', 'Frost climbs the nearest walls in feathery, glittering patterns.'],
      miss: ['The cold slams into the ground beside {tgt}, freezing a ring of floor white and slick.', 'Ice hammers into the wall behind {tgt}, locking it in a bloom of frost.', 'A bitter draft rolls over {tgt} as the freezing blast misses, leaving a rime on their sleeve.'],
      dodge: ['{Tgt} throws themselves aside, the edge of the cold rimming one shoulder white.', '{Tgt} grits their teeth and powers through, numbed and shivering but moving.', '{Tgt} ducks low and takes only a stinging fringe of frost.']
    },
    lightning: {
      name: 'lightning', magic: true,
      sub: ['a jagged bolt of lightning', 'a crawling web of blue-white arcs', 'a whip of crackling current', 'a forked spear of electric light', 'a hissing ribbon of lightning'],
      stuff: ['lightning', 'electricity', 'current', 'sparks'],
      adj: ['crackling', 'blinding', 'forking', 'arcing', 'thunderous', 'electric'],
      gather: ['Hair lifts, metal hums and tiny sparks crawl over every blade and buckle as a knot of blue-white light builds with a rising, whining crackle.', 'The air tastes of copper and pennies as static crawls over everything nearby; the pressure builds like the second before a storm breaks.', 'Arcs of light snap between fingers and metal, thickening into a braided cord of electric fire.'],
      glow: ['the area flashes stark white, burning afterimages into the eyes', 'every shadow strobes and jumps', 'blue-white light stabs through every gap and keyhole'],
      sound: ['a cracking tear like the sky ripping open', 'a high buzzing whine and then a thunderclap', 'a snap that rings in the teeth'],
      feel: ['hair standing on end and a prickling that races over the skin', 'a hot, electric stink of ozone that makes the tongue taste of metal', 'a tingling pressure that crawls under the armor'],
      smell: ['sharp ozone', 'scorched metal and singed hair', 'the sweet, burnt smell of a lightning strike'],
      hit: ['arcs through', 'jolts', 'blasts', 'cooks', 'lances through', 'seizes'],
      wound: T(
        ['a tingling jolt and a small star-shaped burn', 'numb fingers and a lingering crackle in the muscles', 'a bright, stinging shock mark'],
        ['a spasming shock and a red, branching burn', 'twitching muscles and a smell of singed hair', 'a hot burn where the current entered and left'],
        ['convulsing muscles and burns where the lightning exited', 'a branching, fern-like scar of burned skin', 'a limb that jerks and will not obey for a moment'],
        ['a body locked rigid in a seizure, smoke rising from burned-through cloth', 'burns where the current tore through armor and out the other side', 'muscles cooked tight and heart stuttering'],
        ['blackened entry and exit wounds and a heart that skips and slams', 'flesh scored with deep, fern-shaped burns from shoulder to boot', 'a body flung off its feet and smoking'],
        ['a figure lit up from the inside, every vein tracing in white fire before they drop', 'a total strike that boils moisture to steam and chars the ground', 'a body thrown yards, wreathed in smoke and barely clinging to life']
      ),
      gear: ['Metal armor sings with current and burns where it touches skin.', 'Buckles and rivets glow and spit sparks; leather scorches around every piece of metal.', 'Anything metal on the target turns searing hot for a moment.'],
      residue: ['Wisps of smoke curl off the target and the hair on every arm nearby stands on end.', 'Small blue arcs crawl across metal for a few seconds, then fade.', 'Burned hair and ozone hang in the air.'],
      env: ['Dry material may ignite, and metal objects nearby spit sparks and hum.', 'Glass and stone near the impact crack; the area is plunged into dazzling afterimages.', 'The thunder rolls on afterward, rattling anything unsecured.'],
      miss: ['The bolt slams into the floor beside {tgt}, splitting stone and leaving a glassy, fern-shaped scar.', 'Lightning rips past {tgt} and cracks into the wall, showering sparks and chips of stone.', 'Static crawls over {tgt}\'s armor and the bolt smashes into something just behind them.'],
      dodge: ['{Tgt} dives aside and only the fringe of the discharge snaps across their armor, jolting them hard but not through.', '{Tgt} slams down into a roll, muscles twitching with the aftershock.', '{Tgt} takes a glancing jolt that sets their teeth buzzing but keeps their feet.']
    },
    thunder: {
      name: 'thunder', magic: true,
      sub: ['a ring of rolling sound', 'a wall of concussive air', 'a bellowing shockwave', 'a pulse of pure noise', 'a thunderclap given shape'],
      stuff: ['thunder', 'sound', 'noise', 'force'],
      adj: ['deafening', 'booming', 'rolling', 'earsplitting', 'bone-shaking'],
      gather: ['Every sound in the room is sucked toward a point of unnatural silence, and the pressure in the air rises until ears begin to ache.', 'The air trembles and goblets, loose tiles and armor plates begin to hum together with a low, mounting drone.', 'A deep note builds somewhere below hearing, rattling teeth and fluttering cloth.'],
      glow: ['dust leaps from every surface', 'the air itself seems to ripple', 'loose items skitter away as the pressure wave expands'],
      sound: ['a crack like a stone cathedral splitting', 'a boom that pounds in the chest', 'a thunderclap that rings in the skull for minutes'],
      feel: ['a blow to the chest and a pressure that squeezes the eardrums', 'a rolling concussion that shakes teeth and loosens grip', 'a hammer-blow of sound that you feel in the bones'],
      smell: ['dust shaken from stone', 'the faint, sharp smell of air displaced too fast', 'broken mortar'],
      hit: ['batters', 'thumps into', 'shakes', 'slams into', 'hammers', 'rattles'],
      wound: T(
        ['ringing ears and a dizzy shake', 'a sharp pressure ache across the chest', 'a dull thud under the ribs'],
        ['bleeding ears and bruised ribs', 'a buzzing head and unsteady legs', 'a deep, shuddering bruise where the shock hit'],
        ['burst blood vessels, a nosebleed and a pounding skull', 'cracked ribs and ears that bleed down the neck', 'teeth rattled loose and a head full of white noise'],
        ['shattered eardrums, broken ribs and a body hurled across the room', 'internal bruising that blooms dark under the skin', 'bones that crack and organs that ache from the concussion'],
        ['a crushing blow that flattens, deafens and breaks in one stroke', 'ruptured eardrums, collapsed lungs and a body shoved yards through the air', 'wet, internal damage and a head that will ring for days'],
        ['a shockwave that pulps what it hits and flattens everything standing nearby', 'a body hurled like a rag with every bone shaken, and nothing but silence in the ears', 'a concussion so total that armor splits and walls crack']
      ),
      gear: ['Armor plates ring and rattle, and loose straps and buckles whip free.', 'Anything fragile on the target — vials, glass, the lenses of a spyglass — shatters.', 'Chainmail sings like a struck bell.'],
      residue: ['A high whine hangs in the ears of everything nearby.', 'Dust drifts down from the ceiling for a long, ringing second.', 'The air is still shivering as the echoes roll away.'],
      env: ['Glass shatters, loose objects scatter and anything unsecured is knocked off shelves.', 'The sound carries for hundreds of feet and will bring attention.', 'Stone cracks and dust sheets down; the noise echoes through every hall.'],
      miss: ['The wave hammers the floor beside {tgt}, cracking flagstones and flinging grit into the air.', 'The thunder cracks past {tgt} and slams into the wall behind them, shaking dust from the ceiling.', 'A deafening boom rolls past {tgt}, close enough to flutter their clothes.'],
      dodge: ['{Tgt} braces and rides the pressure, ears screaming but feet planted.', '{Tgt} drops behind cover and the worst of the boom rolls over them.', '{Tgt} clamps hands over their ears and staggers, deafened but standing.']
    },
    acid: {
      name: 'acid', magic: false,
      sub: ['a glistening spurt of acid', 'a rope of yellow-green slime', 'a hissing spray of caustic liquid', 'a seething wave of corrosive fluid', 'a splatter of smoking acid'],
      stuff: ['acid', 'slime', 'bile', 'fluid'],
      adj: ['caustic', 'corrosive', 'hissing', 'bubbling', 'eating'],
      gather: ['A bitter, biting stink fills the air and a bead of glossy, sickly fluid swells and trembles, ready to burst.', 'Vapor curls up from a pool of something that bubbles and spits against everything it touches.', 'Droplets of green-yellow liquid gather and smoke as they hit the floor, eating small pits in the stone.'],
      glow: ['everything it touches takes on a sickly yellow-green sheen', 'steam curls off wet stone', 'the air itself takes on a bitter shimmer'],
      sound: ['a wet, spitting hiss like fat in a hot pan', 'a bubbling fizz', 'a sickly sizzle as it eats into anything it touches'],
      feel: ['a sharp, nose-wrinkling sting in the throat', 'a prickling on the skin as vapor drifts off', 'a bite in the air that makes eyes water'],
      smell: ['a sour, biting chemical reek', 'the stink of burning vinegar and wet metal', 'acrid, eye-watering fumes'],
      hit: ['eats into', 'splashes across', 'sizzles on', 'etches', 'dissolves', 'burns through'],
      wound: T(
        ['a few angry red pits where droplets landed', 'a stinging, smoking spot on bare skin', 'a smear of blistered, bleached skin'],
        ['a hissing burn that eats through the top layer of skin', 'puckered, stinging acid burns', 'a weeping blister that keeps smoking'],
        ['an acid burn that eats down through skin and into the muscle beneath', 'wet, pitted flesh that bubbles for several seconds', 'skin sloughing away in smoking sheets'],
        ['deep, widening acid wounds that eat into muscle and tendon', 'flesh dissolving at the edges, the burn still spreading', 'an open, steaming wound that keeps getting wider'],
        ['an acid wound that dissolves flesh in front of the target\'s eyes', 'meat eaten down to white bone and gristle in patches', 'a hissing, bubbling crater where flesh used to be'],
        ['flesh melting off in smoking sheets and bone showing slick and pitted', 'a body half dissolved, clothing and skin one steaming mass', 'a figure drenched in a torrent of acid that melts rather than burns']
      ),
      gear: ['Armor straps hiss and part; metal pits and flakes where the acid lands.', 'Leather and cloth dissolve into smoking rags, and plate is eaten into pitted, weakened patches.', 'Steel develops a mottled, corroded sheen almost instantly.'],
      residue: ['Pits and smoking rivulets mark every surface it touched.', 'The acid keeps eating at cloth and leather for several heartbeats after impact.', 'Puddles of corrosive fluid bubble and spit on the floor.'],
      env: ['Stone and metal surfaces pit and smoke; wood chars and softens.', 'Fumes hang in the air, stinging eyes and throats.', 'The floor beneath the splash is eaten into a shallow, hissing crater.'],
      miss: ['The acid splatters across the floor beside {tgt}, eating pits into the stone and sending up sour smoke.', 'A hissing arc of caustic fluid slaps into the wall behind {tgt}, streaming down in smoking runnels.', 'Droplets spatter {tgt}\'s boots, hissing, but the main gout misses.'],
      dodge: ['{Tgt} twists aside and takes only a spattering of stinging droplets across their back.', '{Tgt} rips off a smoking cloak a heartbeat before the acid eats through to skin.', '{Tgt} flinches clear, acid sizzling on armor rather than flesh.']
    },
    poison: {
      name: 'poison', magic: false,
      sub: ['a cloud of sickly green vapor', 'a hissing jet of venom', 'a spray of oily, yellowish poison', 'a coil of noxious gas', 'a bead of dripping toxin'],
      stuff: ['venom', 'poison', 'fumes', 'vapor'],
      adj: ['noxious', 'venomous', 'sickly', 'toxic', 'foul', 'creeping'],
      gather: ['A sweetish, rotten smell seeps into the air as a sickly haze thickens and curls in on itself.', 'Beads of oily liquid gather and drip, tinting everything they touch a poisonous green.', 'A foul vapor seeps from the source, heavy and slow, hugging the ground.'],
      glow: ['everything in the cloud takes on a faint green tinge', 'a greasy haze blurs the view', 'curls of pale vapor drift in lazy spirals'],
      sound: ['a soft, wet hiss', 'a gurgle and a spitting snap', 'a long, whispery exhale'],
      feel: ['a rising nausea and a cold sweat', 'a burning in the nose and throat that makes eyes stream', 'an itch of rising dread in the gut'],
      smell: ['a sweet, cloying rot', 'the reek of a stagnant pond and sour herbs', 'a bitter, almond-like stink'],
      hit: ['seeps into', 'coats', 'injects itself into', 'courses through', 'settles into', 'spreads from'],
      wound: T(
        ['a small, itching welt and a sour taste in the mouth', 'a faint nausea and a pale cast to the skin', 'two beads of blood and a spreading numbness'],
        ['a swelling, discolored puncture and a queasy stomach', 'sweat, shivering and a sour taste', 'veins that darken in thin, branching lines'],
        ['a hot, spreading bruise and burning veins', 'cramping guts and a pounding heart as the toxin takes hold', 'skin the color of old wax and trembling hands'],
        ['veins black as ink and a body wracked with cramps', 'a dose that rolls through the blood like fire', 'convulsions, vomiting and cold, clammy skin'],
        ['a massive dose that blackens the wound and clouds the sight', 'wracking spasms and blood-flecked lips', 'a poison so strong the body seems to curl in on itself'],
        ['a lethal tide of venom that hits the heart like a hammer', 'a body locking up, foam on the lips and sight closing in', 'toxins that turn the blood to slow, burning sludge']
      ),
      gear: ['Fumes seep through armor gaps and settle into padding.', 'Poison clings to clothing and stays active against bare skin for a while.', 'Anything the venom touches takes a faint, greasy green tint.'],
      residue: ['A greasy film of toxin glistens on the target\'s skin.', 'The sickly smell clings to everything nearby.', 'Pale, oily droplets bead along the floor.'],
      env: ['The vapor lingers, heavy and slow, hugging the ground and settling into low corners.', 'Small animals and vermin nearby flee or drop; plants wilt and blacken.', 'Anything left standing in the cloud will keep being poisoned.'],
      miss: ['The venom spatters across the floor beside {tgt}, hissing as it eats into the stone.', 'A cloud of sickly vapor billows past {tgt}, thinning into nothing.', 'A bead of poison sprays {tgt}\'s sleeve and slides off without sinking in.'],
      dodge: ['{Tgt} holds their breath and shoves through the thinnest part of the cloud, coughing but upright.', '{Tgt} reels away, eyes streaming, and only a trace of the toxin takes hold.', '{Tgt} slaps the poison away and fights down a rising wave of nausea.']
    },
    necrotic: {
      name: 'necrotic', magic: true,
      sub: ['a ribbon of grey-black rot', 'a tendril of grave-cold shadow', 'a wave of withering gloom', 'a lash of sickly green-black energy', 'a bolt of draining dark'],
      stuff: ['energy', 'rot', 'shadow', 'gloom'],
      adj: ['withering', 'grave-cold', 'rotting', 'draining', 'sepulchral', 'blighted'],
      gather: ['The light dims as if drained, and a cold, sour stillness gathers around a knot of shadow that seems to swallow warmth and color alike.', 'Plants within reach curl and blacken, candles gutter, and a smell of grave-earth seeps into the room.', 'Shadows lengthen toward a single point, thick and clinging, and the air tastes of old graves.'],
      glow: ['the light dies to a dull, bruised grey', 'colors drain from everything in the path', 'shadows pool and crawl as though alive'],
      sound: ['a thin, hollow moan like wind in an empty crypt', 'a rattle of dry breath', 'a soft, hungry whisper just below hearing'],
      feel: ['a deadening cold that settles into the bones and makes the heart feel slow', 'a dreadful, draining weakness behind the eyes', 'a clammy dread that fills the chest'],
      smell: ['turned earth and old, cold stone', 'the sweet reek of decay', 'dust, bone and rotting cloth'],
      hit: ['withers', 'drains', 'blackens', 'saps', 'rots', 'bleeds the life from'],
      wound: T(
        ['a patch of grey, numb skin and a faint wave of fatigue', 'a chill that settles in the chest', 'a small, cold sore that does not bleed'],
        ['skin gone pale and papery, and a sick weakness in the limbs', 'a deep ache as warmth is leached out of the flesh', 'a grey-veined bruise that spreads slowly'],
        ['flesh that withers and greys, and a pulse that stumbles', 'veins black beneath the skin and strength draining like water', 'a shriveled, cold patch where life was torn out'],
        ['limbs shriveled and ashen, joints aching with an old man\'s pain', 'a gnawing hollow where vitality used to be', 'skin gone brittle and dry, hair turning white'],
        ['flesh blackened and collapsing, the target aging years in a heartbeat', 'organs stalling as the life is ripped out of them', 'a body sinking in on itself, bones showing through paper-dry skin'],
        ['a body withered to a husk as every ounce of life is wrenched away', 'skin and muscle gone to gray ash, the eyes dimming', 'life rushing out in a visible, shuddering cold']
      ),
      gear: ['Armor dulls and tarnishes; cloth rots and falls into threads.', 'Leather cracks and goes brittle, and metal goes gray and spotted.', 'Everything the shadow touches looks centuries old.'],
      residue: ['A grey, dead patch of skin and a smell of grave dirt linger around the wound.', 'Nearby plants and insects shrivel and die.', 'The air stays cold and heavy for a long, quiet moment.'],
      env: ['Plants wither and lights gutter; the area feels hollow and haunted afterward.', 'Frost of a thin, grey kind forms on stone, and small creatures flee.', 'A lingering gloom clings to the area, damping sound and warmth.'],
      miss: ['The dark energy breaks against the floor beside {tgt}, blackening a patch of stone and leaving it cold as a tomb.', 'A shadowy lash cracks past {tgt} and withers the wall behind them, leaving a patch of grey, crumbling plaster.', 'A breath of grave-cold rolls over {tgt}, dimming their torch before passing.'],
      dodge: ['{Tgt} jerks back, and only a glancing chill of the energy touches them, draining the color from their skin.', '{Tgt} fights off the worst of the withering with a gasp, shuddering with the cold.', '{Tgt} stumbles clear, strength sapped but life intact.']
    },
    radiant: {
      name: 'radiant', magic: true,
      sub: ['a lance of pure white-gold light', 'a blaze of searing radiance', 'a spear of dawn', 'a rushing column of golden light', 'a halo-bright flare'],
      stuff: ['radiance', 'light', 'fire', 'sunlight'],
      adj: ['radiant', 'searing', 'blinding', 'brilliant', 'golden', 'merciless'],
      gather: ['Light gathers like a held breath, golden at the edges and pure white at the heart, until every shadow in the room is driven to the walls.', 'The air hums with a clear, high note, and warmth like noon sunlight pours down from nowhere.', 'A halo blooms around the source and brightens, brighter, brighter, until it burns to look at.'],
      glow: ['the whole room blazes with a noon-bright, shadowless light', 'every shadow is driven away', 'colors flare and wash out in dazzling gold'],
      sound: ['a bright, ringing chord like a struck bell', 'a clean, rising shriek of light', 'a hush, and then a pure, pealing note'],
      feel: ['a warmth that turns scorching in a breath', 'light so intense it can be felt against closed eyelids', 'a clean, painful brilliance that strips away cover'],
      smell: ['hot stone and clean, scorched air', 'the faint scent of incense burning', 'ozone and sun-baked dust'],
      hit: ['sears', 'burns', 'blazes through', 'sunders', 'scours', 'lances through'],
      wound: T(
        ['a sunburned flush and spots swimming in the vision', 'a stinging, bright burn across the skin', 'a faint, pale-gold scorch mark'],
        ['a painful, reddened burn and dazzled eyes', 'blistered skin and a headache full of afterimages', 'light-burn that traces the shape of the target\'s armor'],
        ['burns that glow faintly as they heal and eyes streaming with tears', 'radiance that cooks flesh from the inside', 'skin seared clean of everything but a pale, burned outline'],
        ['white-hot burns that go right through armor and leave skin shining', 'flesh scoured raw and eyes seared to a blur', 'a searing line of ruined flesh from shoulder to hip'],
        ['burns that cut deep and burn clean, leaving only white scar-tissue and ruin', 'flesh scoured to pink and white, edges blackened', 'a blast of radiance that leaves a silhouette on the stone behind'],
        ['a body outlined in white fire, burned clean through armor and flesh alike', 'a beam so bright it bleaches color and leaves only ash', 'radiance that turns everything it touches to light and smoke']
      ),
      gear: ['Armor flares bright and almost glows, and polished metal blazes with reflected light.', 'Cloth blackens in a perfect outline of where the light struck.', 'Any darkness-based enchantment or cloak flinches and smokes.'],
      residue: ['Bright spots swim in every eye, and the target\'s skin glows faintly with heat.', 'A scorched outline of the target is left on the wall behind them.', 'Dust motes glitter and fall like golden snow.'],
      env: ['Every shadow in the area vanishes for an instant, and anything light-sensitive recoils.', 'Stone behind the target is scorched into a pale silhouette.', 'The light lingers, softly golden, long after the flare has passed.'],
      miss: ['The light blazes past {tgt} and scorches a perfect, shadowless circle onto the wall.', 'Radiance scours the floor beside {tgt} to a glassy shine.', 'The brilliance is so great that {tgt} can only squint and feel the heat of it sliding away.'],
      dodge: ['{Tgt} snaps their eyes shut and ducks aside, a glancing sunburn blooming along one side.', '{Tgt} turns away from the glare and takes the heat across their back instead of their face.', '{Tgt} stumbles through the blaze with an arm across their eyes, scorched but whole.']
    },
    psychic: {
      name: 'psychic', magic: true,
      sub: ['a pulse of crushing thought', 'a silent, rippling wave of pressure', 'a needle of alien will', 'a shriek that exists only inside the skull', 'a spear of pure mind'],
      stuff: ['force', 'thought', 'pressure'],
      adj: ['maddening', 'piercing', 'invasive', 'whispering', 'inescapable', 'cold'],
      gather: ['The air goes strangely quiet and tight, and a high, almost inaudible whine presses behind the eyes of everyone near.', 'A sourceless whisper rises in the back of the skull, repeating the thing every creature most fears to hear.', 'The world seems to hold its breath as a pressure builds not in the air but in the mind.'],
      glow: ['the air ripples like heat haze over the target\'s head', 'the light seems to warp and breathe', 'for a heartbeat every shadow points the same wrong direction'],
      sound: ['a whisper only the target can hear', 'a rising, wordless scream inside the skull', 'a hum that seems to come from inside the teeth'],
      feel: ['a pressure behind the eyes and the taste of metal', 'a swimming vertigo and a buzzing in the thoughts', 'a cold sense of being looked at from inside'],
      smell: ['a sudden, impossible smell of burning hair', 'copper and ozone', 'the smell of a long-forgotten place'],
      hit: ['stabs into', 'floods', 'cracks open', 'rips through', 'shatters', 'crushes'],
      wound: T(
        ['a stab of pain behind the eyes and a dribble of nosebleed', 'a flash of dizziness and a sour taste in the mouth', 'a ringing headache and a wave of nausea'],
        ['a splitting headache and a trickle of blood from the nose', 'a sharp, disorienting pain and the sense of voices stuttering', 'a lurch of vertigo and trembling hands'],
        ['bleeding from the nose and ears, thoughts scattered like dropped cards', 'a skull-splitting headache and a shaking, hollow dread', 'tears of blood and a mind full of static'],
        ['a mind pummeled until thoughts come apart, blood from both ears', 'screaming white noise, memories skidding past like debris', 'a body dropped to its knees, clutching its head'],
        ['a mind battered to the edge of breaking, blood streaming from nose, ears and eyes', 'a howling blank where thought was', 'a skull full of knives and a will on the verge of snapping'],
        ['a mind scoured of everything but pain and static, the body slumping like a puppet with cut strings', 'an annihilating mental impact that leaves the target drooling and staring at nothing', 'thoughts ripped out by the roots']
      ),
      gear: ['Nothing physical is damaged, but trinkets and charms hum and rattle as if resisting the force.', 'The target\'s armor is untouched, as if the attack passes straight through it.', 'Metal items near the target vibrate in sympathy with a faint, rising whine.'],
      residue: ['A lingering whisper and a ringing in the ears stay long after the pulse is gone.', 'Eyes seem unfocused and the target flinches at sounds that are not there.', 'The room feels watchful and slightly wrong.'],
      env: ['Nothing in the room is physically harmed, but candles gutter and small animals panic.', 'A faint hum lingers and everyone present feels watched.', 'The air feels thin and strange, and every noise sounds a little too close.'],
      miss: ['The pulse breaks over {tgt} like a cold wave and drains away, leaving only an unpleasant ache behind the eyes.', 'Something presses at {tgt}\'s mind and slides off, leaving a bitter taste and a flicker of unease.', 'A whisper tries to crawl under {tgt}\'s thoughts and finds no grip.'],
      dodge: ['{Tgt} clamps down on their thoughts and takes only a ragged edge of the blast, head ringing.', '{Tgt} reels but holds their mind together, blood trickling from one nostril.', '{Tgt} grits their teeth and shoves the pressure back, shaken but themselves.']
    },
    force: {
      name: 'force', magic: true,
      sub: ['a lance of invisible, shimmering force', 'a crushing hammer of solid air', 'a bolt of pure, glowing energy', 'a ripple of raw kinetic force', 'an unseen fist of magic'],
      stuff: ['force', 'power', 'pressure'],
      adj: ['invisible', 'unyielding', 'shimmering', 'crushing', 'unstoppable', 'pure'],
      gather: ['The air thickens and warps like heat haze as pure magic folds in on itself, and everything loose within reach leans toward a single, humming point.', 'A faint violet-white shimmer hardens in the air, the edges bending the light around it like thick glass.', 'A low, sourceless hum builds as unseen force presses in from every side, flattening dust and cloth toward a core of nothing.'],
      glow: ['the air ripples as though made of glass', 'a pale violet shimmer hardens and then snaps', 'loose dust and sparks bend toward the blow'],
      sound: ['a hollow, resonant thump like a giant door slamming', 'a deep, low hum and a sudden crack', 'a bell-like ring as the force strikes'],
      feel: ['a sudden pressure like a hand pushing the whole body', 'a thump that rattles the sternum', 'a shove that comes from nowhere'],
      smell: ['bright ozone and cold metal', 'nothing at all, which feels oddly wrong', 'the dry, empty smell of magic'],
      hit: ['slams into', 'hammers', 'crushes', 'pounds', 'shoves through', 'batters'],
      wound: T(
        ['a sharp, bruising shove and a gasp', 'a dull thump and a rapidly purpling bruise', 'a stagger and a bruise the size of a fist'],
        ['a heavy, bruising blow that drives the breath from the lungs', 'deep, aching bruises in the exact shape of the strike', 'a hammer-blow of invisible force and a stumble'],
        ['cracked ribs and a body lifted off its feet', 'a crushing blow that dents armor and bruises everything beneath it', 'a bone-deep impact that leaves the arm numb'],
        ['broken bones and a body hurled several feet', 'armor crumpled inward like paper and the ribs beneath it with it', 'a dull, heavy crunch and a limp, wrong-angled limb'],
        ['a blow that folds the target in half and hurls them across the room', 'bones snapped like twigs, armor stove in and blood on the lips', 'a body slammed into the wall hard enough to crack stone'],
        ['an annihilating impact that crushes armor, bone and organ at once', 'a body crumpled into a wall, ragged and still', 'a single, total blow that hurls the target like a ragdoll']
      ),
      gear: ['Armor plates dent inward and straps burst; shields crack along the grain.', 'Weapons are knocked from numb fingers and armor is stove in.', 'Everything the force touches is crushed or flung with it.'],
      residue: ['The air shimmers faintly where the force struck, and loose dust hangs frozen for a heartbeat.', 'A circular dent marks the wall behind the target.', 'A faint pulse of violet fades from the air.'],
      env: ['Dust and small objects are blasted away from the impact in a clean ring.', 'Furniture and loose debris tumble across the floor.', 'The echo of the thump rolls out through the room.'],
      miss: ['The force slams into the floor beside {tgt}, scattering dust and cracking stone in a clean circle.', 'An unseen blow passes {tgt} so closely that their cloak snaps and flaps, then hammers the wall behind them.', 'A hollow thump rolls through the air as the strike misses, rattling {tgt}\'s armor.'],
      dodge: ['{Tgt} twists aside, the edge of the force catching their shoulder and spinning them half around.', '{Tgt} rides the shove, skidding but upright.', '{Tgt} tucks and lets the force roll off them, bruised rather than broken.']
    },
    slashing: {
      name: 'slashing', magic: false, physical: true,
      sub: ['a whirling arc of blades', 'a rending sweep of edges'],
      stuff: ['steel', 'edges', 'blades'],
      adj: ['keen', 'wicked', 'razor-sharp', 'rending'],
      hit: ['slashes', 'opens up', 'rips across', 'carves into', 'lays open', 'gashes'],
      wound: T(
        ['a shallow cut and a thin line of red', 'a nick that bleeds more than it hurts', 'a long, shallow graze'],
        ['a clean cut that bleeds freely', 'a long, painful gash across the arm or side', 'a split in the skin that leaks dark blood'],
        ['a deep gash through armor and into the muscle beneath', 'a wide laceration that pours blood down the leg', 'ribbons of cut cloth and a long, gaping wound'],
        ['a grievous slash that nearly lays the limb open to the bone', 'a gash that pulses blood and exposes pale muscle', 'a ragged cut from collarbone to ribs'],
        ['a cleaving wound that parts armor, muscle and rib in one stroke', 'a wound so wide and deep that the target staggers from the sheer shock', 'blood fountaining from a slash that should have severed something'],
        ['a wound that cleaves through armor and bone and nearly severs the limb', 'a body split open from shoulder to hip', 'a killing wound that leaves little to hold the body together']
      ),
      gear: ['Armor is cut through, straps severed and plates scored with bright, fresh scars.', 'Cloth and leather part with a sound like ripping sailcloth.', 'The edge skates off steel, leaving a bright, screaming scratch.'],
      residue: ['A line of bright blood beads and runs.', 'Cut fabric flaps loose around the wound.', 'Spatter on the stone marks the blow.'],
      env: ['Blood spatters the nearest floor in a long, bright arc.', 'Torn cloth and a scatter of broken links litter the ground.', 'The sound of ripping fabric and a sharp gasp is loud in the quiet.'],
      gearNatural: ['Claws shred straps and rake bright furrows across the plate.', 'Leather parts and mail rings fly where the rake tears through.'],
      miss: ['The edge hisses past {tgt} close enough to stir their hair, and bites a long groove in the wall behind them.', 'The swing slices through the space where {tgt} was, and the blade skates off a pillar in a shower of sparks.', 'The cut whistles a finger-width from {tgt}\'s throat and parts only air.'],
      dodge: ['{Tgt} bends back under the stroke, the edge slicing a stripe through their clothes instead of their skin.', '{Tgt} turns the blow with a desperate parry and takes only a shallow cut.', '{Tgt} flinches clear, the strike gashing their arm but missing the bone.']
    },
    piercing: {
      name: 'piercing', magic: false, physical: true,
      sub: ['a stabbing thrust', 'a darting spike'],
      stuff: ['spikes', 'points', 'spines'],
      adj: ['needle-sharp', 'vicious', 'spiking', 'driving'],
      hit: ['punctures', 'drives into', 'skewers', 'stabs into', 'pierces', 'sinks into'],
      wound: T(
        ['a small, deep puncture that bleeds in a thin red thread', 'a prick that smarts and welts', 'a shallow stab and a bead of blood'],
        ['a narrow puncture that bleeds steadily', 'a stab wound that stings and weeps', 'a punched-in hole through cloth and skin'],
        ['a deep puncture that goes through armor and into the muscle beneath', 'a wound that bleeds hard and lodges against bone', 'a ragged hole with blood welling around it'],
        ['a grievous puncture that runs right through the limb', 'a deep wound that bleeds in thick, dark pulses', 'a wound driven in nearly to the hilt'],
        ['a wound that goes clean through armor and flesh and out the other side', 'a pinning wound that pegs the target in place', 'a deep puncture that opens an organ and floods with blood'],
        ['a wound big enough to put a fist through, right through the body', 'a hole punched from front to back', 'a skewering wound that leaves the target barely upright']
      ),
      gear: ['The point punches through a plate or a link and leaves a ragged, bright hole.', 'Armor deflects part of the thrust, but a rivet pops and flies.', 'Leather is perforated like a sieve.'],
      residue: ['A thin line of blood runs from the puncture.', 'Bright droplets spatter the floor.', 'The point leaves a narrow, deep hole in cloth and skin.'],
      env: ['Small, bright drops of blood fall in a neat, precise line.', 'A hiss of indrawn breath and a smell of blood and iron fill the space.', 'The wound is neat and deep, and an ugly little silence follows it.'],
      gearNatural: ['Points punch through leather and grate on plate.', 'Mail rings pop and scatter where the points find purchase.'],
      miss: ['The point stabs past {tgt}\'s ribs by a finger-width and thuds into the wall behind, quivering.', 'The thrust skids off {tgt}\'s armor with a shrill scrape and a bright spark.', 'The attack snaps a hair\'s breadth from {tgt}\'s face and finds only air.'],
      dodge: ['{Tgt} twists, and the point scores a bloody furrow along their ribs instead of sinking in.', '{Tgt} knocks the thrust aside, taking only a shallow stab.', '{Tgt} leaps back, the point tearing a hole in their clothes but barely scratching skin.']
    },
    bludgeoning: {
      name: 'bludgeoning', magic: false, physical: true,
      sub: ['a crushing blow', 'a heavy, pounding strike'],
      stuff: ['force', 'weight', 'blows'],
      adj: ['crushing', 'bone-shaking', 'pulping', 'pounding'],
      hit: ['slams into', 'crunches into', 'batters', 'hammers', 'pounds', 'smashes into'],
      wound: T(
        ['a purpling bruise and a stunned grunt', 'a welt across the ribs and a sharp, bruising knock', 'a sharp, bruising knock'],
        ['a deep, painful bruise and the breath driven from the lungs', 'a swelling lump and a ringing head', 'a heavy bruise that makes the limb hang numb'],
        ['cracked ribs and a winded, staggering body', 'bone-deep bruising and a limb that will not close properly', 'a dented breastplate and the breath driven out of the lungs'],
        ['broken bones and a body bowled over', 'ribs that crack like kindling and a spray of spit and blood', 'crushed armor and the flesh beneath it pulped'],
        ['shattered bone and a body hurled off its feet', 'armor stove in, organs bruised, and a body skidding across the floor', 'a limb bent the wrong way and a crack that echoes'],
        ['armor and ribcage crushed into a single ruin', 'a body smashed down hard enough to crack stone', 'a body broken beyond easy recognition']
      ),
      gear: ['Plate dents inward and straps burst; a helm rings like a bell.', 'Padding offers little and metal armor folds around the blow.', 'Shields splinter and arms go numb.'],
      residue: ['A deep, dark bruise is already blooming.', 'The target\'s breath comes in short, shocked gasps.', 'A lump rises as they watch.'],
      env: ['A flat, heavy crack echoes off the walls and dust sifts down.', 'Dust leaps from the floor and a hollow thud rolls away.', 'Everyone nearby feels the impact through the floor.'],
      gearNatural: ['Armor dents and rings under the blow; padding does little.', 'Plate buckles inward and straps burst under the impact.'],
      miss: ['The blow slams into the floor beside {tgt} with a crack that shivers the flagstones and showers them with grit.', 'The strike whips past {tgt}\'s head, so close the wind of it lifts their hair, and smashes a pillar into rubble.', 'The swing hammers the wall behind {tgt} with a deafening crack.'],
      dodge: ['{Tgt} rolls with the impact and takes it on the shoulder, bruised but unbroken.', '{Tgt} lets the blow glance off their armor, ribs aching but whole.', '{Tgt} staggers, wind knocked out, but stays upright.']
    }
  };

  // Secondary flavours picked up from names ("Lava Wave", "Spider Staff", "Tidal Wave"): they only add colour and
  // never change the damage type. Each has a regex for the attack name/text, a noun for the substance, and short
  // clauses the engine can add as an extra sentence.
  D.FLAVORS = {
    water: { re: /\b(water|tidal|tide|wave|jet|steam|ocean|sea|drown|brine|rain|mist|torrent|geyser|flood)\b/i, noun: 'water', flair: ['A heavy rush of water churns through the air, smelling of brine and cold stone.', 'Spray and foam burst in every direction, slick on the floor and cold on the skin.', 'The attack arrives in a roaring, drenching rush that soaks everything it touches.'] },
    earth: { re: /\b(stone|rock|boulder|earth|crystal|geode|granite|avalanche|quake|rumbl|mud|sand|dust|gravel|spike|lava|magma|hill)\b/i, noun: 'stone', flair: ['Grit and chips of rock spray in every direction, rattling off armor.', 'The ground shudders and the air fills with the grinding rumble of moving stone.', 'Dust billows up in a thick, choking cloud.'] },
    wind: { re: /\b(wind|gale|gust|whirlwind|tempest|storm|air|cyclone|vortex|breeze|screaming)\b/i, noun: 'wind', flair: ['A howling gust tears at cloaks and snatches at weapons.', 'Loose cloth and hair whip sideways and the air screams in the ears.', 'The air itself seems to turn into a rope and lash out.'] },
    shadow: { re: /\b(shadow|gloom|dusk|umbral|dark|night|nightmare|void|black|murk|eclipse)\b/i, noun: 'shadow', flair: ['Shadows thicken and pull toward the strike like iron filings to a magnet.', 'The light dims as if something has drunk it, and every dark corner seems to lean closer.', 'Colors drain away from the edges of the vision.'] },
    blood: { re: /\b(blood|vampiric|crimson|gore|feed|leech|leeching|bloody|bleed|sanguine|hemo)\b/i, noun: 'blood', flair: ['The smell of copper rolls through the air.', 'Droplets of blood hang and then streak toward the strike as if drawn by it.', 'A red haze seems to cling to the edges of the attack.'] },
    bone: { re: /\b(bone|skull|grave|corpse|ghoul|skeletal|ossuary|marrow)\b/i, noun: 'bone', flair: ['Dry bone clatters and rattles with every move.', 'The smell of old graves and dust hangs about it.', 'A dry rattle runs through the strike like a handful of knucklebones.'] },
    hellish: { re: /\b(hell|hellish|infernal|demon|demonic|devil|devilish|abyssal|fiendish|blasphem|brimstone|hellfire|baleful)\b/i, noun: 'hellfire', flair: ['A scent of brimstone and a flicker of red light follow the strike.', 'The air curdles and a distant, many-voiced snarl seems to rise behind it.', 'Dark, cruel runes flicker along the edges of the attack.'] },
    holy: { re: /\b(holy|sacred|divine|celestial|angelic|blessed|sun|solar|dawn|star|starlight|hallowed|righteous|justice|honor)\b/i, noun: 'holy light', flair: ['A faint, clear chime runs through the air like a distant bell.', 'A soft golden glow clings to the strike as though sanctified.', 'The attack is touched by a clean, ringing warmth that feels almost like judgment.'] },
    nature: { re: /\b(vine|root|thorn|bramble|plant|spore|fungal|fungus|mushroom|briar|bloom|petal|leaf|bark|moss|wood|branch|tree|pod)\b/i, noun: 'living plant matter', flair: ['The smell of green growth and wet earth blows through the air.', 'Tendrils and leaves rustle and uncoil with a dry, creeping whisper.', 'Everything organic nearby seems to lean toward the strike.'] },
    metal: { re: /\b(iron|steel|silver|silvered|adamantine|mithral|brass|bronze|chain|chardalyn|clockwork|gear|cog|piston|bolt|rivet)\b/i, noun: 'metal', flair: ['Metal rasps and clanks, bright against the surrounding dark.', 'The cold smell of oil and hot iron comes with it.', 'A shower of sparks and the ring of struck steel accompany every motion.'] },
    web: { re: /\b(web|net|silk|snare|entangl|tangle|bolas|sticky|glue|slime|ooze|mucus|pseudopod)\b/i, noun: 'sticky strands', flair: ['Glistening strands whip out and stick to everything they touch.', 'A thick, wet trail glistens in the light.', 'Everything the strands touch is stuck fast with a sound like peeling tape.'] },
    fear: { re: /\b(dread|dreadful|frightful|terror|terrifying|horror|horrifying|scream|wail|howl|moan|nightmare|visage|mask)\b/i, noun: 'dread', flair: ['An atmosphere of dread settles over the area like a heavy blanket.', 'The air itself seems to flinch, and every instinct screams to flee.', 'The sound crawls under armor and settles in the stomach.'] },
    sound: { re: /\b(roar|howl|wail|scream|shriek|screech|song|chirr|trumpet|bellow|honk|drum|boom|cry|horn|baying)\b/i, noun: 'sound', flair: ['The noise rolls out and fills every corner.', 'It is a sound felt as much in the chest as heard by the ears.', 'The echo takes a long time to die away.'] },
    magic: { re: /\b(arcane|eldritch|mystic|mage|spell|runic|rune|sigil|glyph|chromatic|prismatic|spellfire|energy|magic)\b/i, noun: 'magic', flair: ['Faint runes glimmer in the air around the effect and fade with a soft hum.', 'The smell of ozone and old parchment rolls off it.', 'The air itself seems to crackle with captive magic.'] }
  };
})();
