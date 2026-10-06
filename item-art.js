// Item art engine. Every item gets a 32x32 shaded pixel icon built from three layers:
//   1. a BASE object (item-art-weapons/armor/misc.js; chosen by item-art-rules.js from name/type),
//   2. a MATERIAL recolour (adamantine, mithral, bone, leather, ...),
//   3. EFFECTS - flames, ice, lightning, drips, holy rays, smoke, vines, wind, a magic circle ... - drawn as
//      connected shapes attached to the object (never loose pixels) plus a tint and a soft glow.
// For generated items the spec is read from the item's modifiers as well as its name, and is stored on the
// item (item.artSpec) when it is generated so the icon stays put.
//   itemArtSpec(item, rarity)  -> { base, material, effects:[ids] }
//   itemArtInner / itemArtSvg  -> SVG markup used by itemPixelIcon()
//   attachItemArt(item)        -> stores item.artSpec (call after generating an item)
//   itemArtBaseSvg(base, {material, effects, rarity}, px) -> for design sheets
// Needs monster-art.js (PixelKit), item-art-kit.js and the sprite files first. Classic script.
(function () {
  const PK = window.PixelKit; if (!PK) return;
  const { Canvas, mix, N } = PK;
  const SPR = window.ItemArtSprites || (window.ItemArtSprites = {});

  // ---------- materials: a main, b shade, c light, t trim ----------
  const MAT = {
    steel: { a: '#a9b3bf', b: '#5b6571', c: '#e8eef5', t: '#c9a84c' }, iron: { a: '#7b838f', b: '#3f454e', c: '#b5bdc8', t: '#a98a3c' },
    rusty: { a: '#8a5a42', b: '#4a2a1c', c: '#b98462', t: '#7a6a3a' }, silver: { a: '#d0d7de', b: '#8791a0', c: '#ffffff', t: '#e6ebf0' },
    mithral: { a: '#cfe4f2', b: '#7d9ab2', c: '#ffffff', t: '#e8f3ff' }, adamantine: { a: '#3d4b69', b: '#1a2236', c: '#86abea', t: '#5f86c9' },
    gold: { a: '#e8c04a', b: '#946f17', c: '#fff1a8', t: '#fff1a8' }, bronze: { a: '#b8793c', b: '#6b3f17', c: '#e4a96d', t: '#d8a24a' },
    copper: { a: '#c4703f', b: '#6e3418', c: '#eaa070', t: '#e0b070' }, brass: { a: '#bfa24a', b: '#6f5f22', c: '#ece08a', t: '#e8d27a' },
    orichalcum: { a: '#d9863f', b: '#8a4217', c: '#ffc27a', t: '#ffd98a' }, obsidian: { a: '#2e2d3f', b: '#0f0f19', c: '#7a78a3', t: '#7a78a3' },
    blacksteel: { a: '#3b3f4d', b: '#15171f', c: '#8a90a8', t: '#8a90a8' }, voidsteel: { a: '#2f2a48', b: '#100c22', c: '#8f7ad8', t: '#8f7ad8' },
    starmetal: { a: '#a9b6d8', b: '#4c5a86', c: '#f2f6ff', t: '#cfe0ff' }, sunsteel: { a: '#f0cf6a', b: '#a8761c', c: '#fff6cc', t: '#fff0b0' },
    celestine: { a: '#eef0ff', b: '#a8aed8', c: '#ffffff', t: '#ffe27a' }, coldforged: { a: '#8fb4d0', b: '#425f7a', c: '#e4f4ff', t: '#bfe0f5' },
    bone: { a: '#e6dcc0', b: '#a69b7b', c: '#fffbe9', t: '#c8bda0' }, dragonbone: { a: '#dcd0b0', b: '#8f8260', c: '#fff6dc', t: '#b89a5a' },
    crystal: { a: '#9fe3f2', b: '#4a9db6', c: '#ffffff', t: '#dff8ff' }, ruby: { a: '#c23a3a', b: '#6e1414', c: '#f08080', t: '#e8c04a' },
    jade: { a: '#2f9c72', b: '#14543c', c: '#7fdcb0', t: '#e8c04a' }, wood: { a: '#8a5a35', b: '#4d2f17', c: '#b88458', t: '#c9a84c' },
    oak: { a: '#9a6a3a', b: '#553317', c: '#c69458', t: '#c9a84c' }, leather: { a: '#8c5a33', b: '#4f301a', c: '#bb8656', t: '#c9a84c' },
    hide: { a: '#7a6a4a', b: '#43391f', c: '#a8966a', t: '#b89a5a' }, cloth: { a: '#5b4aa0', b: '#2c2358', c: '#9b8ae0', t: '#e0c060' },
    scale: { a: '#4f9a5a', b: '#23552d', c: '#8fd49a', t: '#c9a84c' }, ivory: { a: '#e8e0d0', b: '#a89f8a', c: '#ffffff', t: '#c9a84c' },
    glass: { a: '#bfe4ee', b: '#5a8fa0', c: '#ffffff', t: '#c9a84c' }, stone: { a: '#8c8574', b: '#524d41', c: '#bdb6a2', t: '#a9a089' },
    mushcap: { a: '#b8503c', b: '#6a2418', c: '#e8a090', t: '#f4ead0' }, apple: { a: '#c63a2e', b: '#6e1a16', c: '#f08a78', t: '#4f8a3a' },
    cheesey: { a: '#e8bf4a', b: '#a07a1c', c: '#fbe49a', t: '#c9a84c' }, crust: { a: '#c28a4a', b: '#7a4e22', c: '#e6b878', t: '#f4e2b0' }, candy: { a: '#e0529a', b: '#8a2060', c: '#ff9ccb', t: '#6fd0f0' },
    ironwood: { a: '#6a4a30', b: '#33200f', c: '#a07850', t: '#b89a5a' }, heartwood: { a: '#a8503a', b: '#5a2216', c: '#d98a70', t: '#e8c880' },
    coldiron: { a: '#6f7d8a', b: '#343e48', c: '#aebdc9', t: '#8fa6b8' }, moonsilver: { a: '#c8d8f0', b: '#6e84ac', c: '#ffffff', t: '#e8f0ff' },
    bloodsteel: { a: '#8f3a44', b: '#42121a', c: '#d98a92', t: '#c84a58' }, wraithsteel: { a: '#9fb4b0', b: '#4a5c5a', c: '#e2f4f0', t: '#bfe6df' },
    hellforged: { a: '#4a2a2a', b: '#1a0c0c', c: '#c8503a', t: '#ff7a3a' }, shatterglass: { a: '#7fd0d8', b: '#2c6a78', c: '#f0ffff', t: '#c8f4ff' },
    elven: { a: '#d4e0b8', b: '#7e9068', c: '#fbfff0', t: '#e8d28a' }, dwarven: { a: '#8a7458', b: '#463a2a', c: '#c0aa88', t: '#d0a84a' },
    crimsoncloth: { a: '#9c2f3a', b: '#52121b', c: '#d8707a', t: '#e0c060' }, greencloth: { a: '#2f6f55', b: '#133a2a', c: '#6fbf9a', t: '#e0c060' },
    bluecloth: { a: '#3a4f8a', b: '#172044', c: '#7f9ad8', t: '#e0c060' }, greycloth: { a: '#6a6a72', b: '#2f2f36', c: '#b0b0bb', t: '#e0c060' }, linen: { a: '#d8cdb0', b: '#928568', c: '#fffaf0', t: '#c9a84c' },
  };
  const CLOTHS = ['cloth', 'crimsoncloth', 'greencloth', 'bluecloth', 'greycloth', 'linen'];
  const MATERIAL_RULES = [
    ['adamantine', /adamant/], ['mithral', /mithr|mithil/], ['moonsilver', /moonsilver|moon-silver/], ['bloodsteel', /bloodsteel|blood steel/], ['wraithsteel', /wraithsteel|wraith steel/], ['hellforged', /hellforged|hell-forged|infernal steel/], ['shatterglass', /shatterglass|shatter-glass/], ['orichalcum', /orichalc/], ['voidsteel', /voidsteel|void-?touched|void steel/], ['blacksteel', /blacksteel|black steel|nightsteel|gloomforged|umbral steel/],
    ['obsidian', /obsidian/], ['starmetal', /starmetal|starforged|star-?iron|star steel|meteoric/], ['sunsteel', /sunsteel|sun-?forged|sunforged/], ['celestine', /celestine|celestial steel/], ['coldforged', /cold-?forged|frost-?forged|icebound/], ['coldiron', /coldiron|cold iron/], ['heartwood', /heartwood/], ['ironwood', /ironwood/], ['elven', /\belven\b|elvish/], ['dwarven', /\bdwarven\b|dwarf-forged/],
    ['silver', /silver|silvered|silverwrought/], ['gold', /\bgold|golden|gilt|aurum/], ['bronze', /bronze/], ['copper', /copper/], ['brass', /brass/],
    ['dragonbone', /dragonbone|dragon bone/], ['bone', /\bbone|tusk|\bfang\b|antler|horn\b/], ['ivory', /ivory/], ['crystal', /crystal|diamond|quartz|glacial/], ['glass', /\bglass/], ['ruby', /ruby|garnet|infernal|crimson|sanguine/], ['jade', /jade|emerald|viridian/],
    ['scale', /dragon ?scale|dragonhide|scale mail|\bdrake\b/], ['rusty', /rusty|rusted|corroded|cracked|dented|cast-off/], ['iron', /\biron\b|dwarven|ferrous/], ['steel', /\bsteel\b|tempered/],
    ['oak', /oaken|\boak\b|rotwood|\bash\b|yew|wooden|\bwood\b/], ['hide', /\bhide\b|fur\b|pelt/], ['leather', /leather|studded|padded/], ['stone', /stone|marble|clay|porcelain|ceramic/],
  ];
  const hashOf = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const strip = s => String(s || '').replace(/<[^>]+>/g, ' ').toLowerCase();
  function pickMaterial(item, base, hash) {
    const name = strip(item.name);
    const affixes = (item.mods || []).filter(m => m && m.type === 'Affix').map(m => strip(m.name || m.key)).join(' ');
    const R = window.ItemArtRules, pre = R && R.material && R.material(base, name, item);
    if (pre && typeof pre === 'object') return pre;
    if (typeof pre === 'string' && pre[0] === '!') return pre.slice(1);
    for (const [id, re] of MATERIAL_RULES) if (re.test(affixes + ' ' + name)) return id;
    const def = pre || 'steel';
    return def === 'cloth' ? CLOTHS[hash % CLOTHS.length] : def;
  }
  const matColors = m => (typeof m === 'string' ? (MAT[m] || MAT.steel) : m);

  // ---------- effects ----------
  const FX = {
    fire: { color: '#ff8a2a', re: /flam|fire|ember|blaz|inferno|infern|burn|magma|molten|scorch|\bsun\b|phoenix|pyre|cinder|ignit|smolder|ashfall|brimstone|hellfire|pyrotech|torch|incendi|lava|volcan|furnace|hellforged|searing/ },
    frost: { color: '#9fe8ff', re: /frost|\bice\b|icy|\bcold\b|winter|snow|glacier|freez|rime\b|rime-|chill|hoar|icebound|frozen|tundra|boreal|icicle|polar|blizzard/ },
    storm: { color: '#ffe45a', re: /lightning|thunder|storm|shock|spark|tempest|volt|electric|fulmin|galvan/ },
    poison: { color: '#9be25a', re: /poison|venom|toxic|viper|adder|serpent|plague|blight|spider|python|cobra|noxious/ },
    acid: { color: '#c8e84a', re: /\bacid|corros|caustic|dissolv/ },
    holy: { color: '#ffe9a0', re: /holy|radiant|divine|celestial|celestine|angel|sacred|bless|dawn|solar|sunbeam|paladin|righteous|justice|seraph|hallowed|sunblessed|sunward|sunlit|halo|saint|heaven|dawnbring/ },
    shadow: { color: '#8f5fd6', re: /shadow|\bdark|night|umbra|\bvoid|gloom|dusk|abyss|vampir|wraith|ghost|spectral|hollow|tomb|grave|deathly|death|curse|\bbane\b|shade|nether|eclipse|silent scream|deathless/ },
    necrotic: { color: '#6fcf7a', re: /necro|decay|wither|wasting|undead|lich|soulreap|soul-?eat|\brot\b|grave-?touched|unburied|reaper/ },
    blood: { color: '#d93a3a', re: /\bblood|vicious|gore|sanguine|bleed|carnage|savage|slaughter|bloodletting|crimson|wound|life stealing|\bvein/ },
    arcane: { color: '#b98cff', re: /arcane|\brune|runic|runescribed|runeetched|glyph|mystic|astral|psychic|\bmage|archmage|wizard|enchant|sorcer|eldritch|\bspell|force|sigil|wyrdwoven|thoughtwoven|cognizant|oracle|gravitum|gravity|ethereal|resonant|fate|mindrend|\bimpact\b/ },
    nature: { color: '#6fd06f', re: /thorn|\bleaf|nature|verdant|druid|forest|\bwild\b|wildroot|\bvine|\bbark|\bmoss|grove|woodland|bramble|rotwood|petal|flower|primal|feral/ },
    wind: { color: '#cfeaff', re: /\bwind|gale\b|galebound|zephyr|swift|cloud|\bsky|\bair\b|breeze|gust|skyborn|racing|fleetfoot|featherfall|winged|windcaller|wind-runner/ },
    water: { color: '#4aa8e8', re: /tide|tidal|brine|\bsea\b|ocean|deep-?sea|\bwater|\bwave|undertow|coral|aqua|anchor-?forged|kraken|drown/ },
    sonic: { color: '#bfe4ff', re: /echo|sound|bellow|\bsonic|soundbound|chime/ },
    soul: { color: '#7fe8f0', re: /\bsoul(?!-?(?:eat|reap))|soulreaver|\bspirit|banshee|psychopomp/ },
    prism: { color: '#ff9ad8', re: /prism|rainbow|iridescen|chromatic|opalescen/ },
    gravity: { color: '#8f80ff', re: /gravit(?!um)|singularity|event horizon|collapsar/ },
    spore: { color: '#b8c860', re: /spore|sporing|fungal|fungus|mycel|mildew|puffball/ },
    time: { color: '#e8d890', re: /temporal|chrono|\btime\b|hourglass|timeless|aeon|epoch|stasis/ },
    luck: { color: '#ffd75e', re: /\blucky|fortune|\bluck\b|gilt-edged|gambler/ },
  };
  const FX_ORDER = Object.keys(FX);
  const RAR = { common: 0, uncommon: 1, rare: 2, superrare: 3, legendary: 4, celestial: 5 };
  function pickEffects(item, rarity) {
    const nameT = strip(item.name), mods = Array.isArray(item.mods) ? item.mods : [];
    const modNames = mods.map(m => strip(m.name || String(m.key || '').replace(/^[a-z]+:/, ''))).join(' ');
    const modText = mods.map(m => strip(m.text)).join(' '), effText = strip(item.effect).slice(0, 260), descT = strip(item.desc).slice(0, 140);
    const sc = {};
    FX_ORDER.forEach(id => { const re = FX[id].re; let s = 0; if (re.test(nameT)) s += 4; if (re.test(modNames)) s += 4; if (re.test(modText)) s += 2; if (re.test(effText)) s += 1.5; if (re.test(descT)) s += 0.5; if (s) sc[id] = s; });
    const dmg = { sonic: /thunder damage/, fire: /fire damage/, frost: /cold damage/, storm: /lightning damage|thunder damage/, poison: /poison damage/, acid: /acid damage/, holy: /radiant damage/, necrotic: /necrotic damage/, arcane: /force damage|psychic damage/ };
    Object.keys(dmg).forEach(id => { if (dmg[id].test(modText)) sc[id] = (sc[id] || 0) + 3; });
    const tier = RAR[rarity || item.rarity] ?? 0;
    const need = (mods.length || tier >= 2) ? 2 : 3.5;
    const list = Object.keys(sc).filter(id => sc[id] >= need).sort((a, b) => sc[b] - sc[a]).slice(0, 2);
    if (!list.length && (tier >= 1 || /\+\d/.test(nameT) || mods.length || /magic|enchant/.test(effText))) list.push('magic');
    return list;
  }

  // ---------- classification ----------
  function baseKind(item) {
    if (item.artSpec && item.artSpec.base && SPR[item.artSpec.base]) return item.artSpec.base;
    const R = window.ItemArtRules, name = strip(item.name);
    if (R) {
      for (const [b, re, ok] of R.rules) if (SPR[b] && re.test(name) && (!ok || ok(item))) return b;
      const f = R.fallback && R.fallback(item); if (f && SPR[f]) return f;
    }
    return SPR.trinket ? 'trinket' : null;
  }
  const LIQUID_BASES = new Set(['potion', 'elixir', 'tonic', 'vial', 'flask', 'bottle', 'decanter', 'oilflask', 'perfume', 'jug']);
  const LIQUIDS = [[/heal|life|vital|restor|cure|regenerat|mending|revive|panacea/, '#d8343c'], [/strength|giant|growth|enlarge|might|titan|vigor/, '#e0862a'], [/speed|haste|swift|quick|agility/, '#e8e060'], [/fly|flying|levit|gaseous|feather|air\b|cloud/, '#bfe4ff'],
    [/invisib|vanish|shadow-?step|ghost|ethereal/, '#d4e4ee'], [/fire|flame|dragon.s breath|phoenix|alchemist|brimstone|burn/, '#ff6a1a'], [/frost|cold|ice\b|chill|winter/, '#7fd0f0'], [/poison|venom|toxin|antitoxin|antidote|plague|viper/, '#7fcf3a'],
    [/water|breath|sea\b|ocean|tide|swim/, '#3a8ae0'], [/hero|bless|hope|supreme|valor|courage|bravery|divine|holy|radiant/, '#ffd84a'], [/mind|read|comprehen|clairvoy|insight|psychic|thought|possibility|wisdom|intellect/, '#c47cf5'],
    [/dark|night|dusk|shade|void/, '#4a3a7a'], [/climb|spider|earth|stone|clay/, '#a0723a'], [/oil|ointment|grease|slipper/, '#d8c070'], [/sharp|edge|whet/, '#c8d0dc'], [/luck|fortune|chance|fate/, '#5fe08a'], [/love|charm|bewitch|perfume|rose/, '#e87ab4'], [/spirit|whiskey|ale|wine|brandy|drink|wine/, '#c8802a']];
  function liquidOf(item, base) {
    if (!LIQUID_BASES.has(base)) return null;
    const n = strip(item.name) + ' ' + strip(item.desc).slice(0, 80);
    for (const [re, c] of LIQUIDS) if (re.test(n)) return c;
    return ['#d8343c', '#3a8ae0', '#5fc85a', '#c47cf5', '#e8c040', '#40c8c0', '#e07ab0', '#e0862a'][hashOf(item.name) % 8];
  }
  window.itemArtSpec = function (item, rarity) {
    item = item || {};
    const base = baseKind(item); if (!base) return null;
    const h = hashOf(item.name);
    return { base, material: (item.artSpec && item.artSpec.material) || pickMaterial(item, base, h), effects: (item.artSpec && item.artSpec.effects) || pickEffects(item, rarity), liquid: (item.artSpec && item.artSpec.liquid) || liquidOf(item, base) };
  };
  window.attachItemArt = function (item, rarity) { const s = window.itemArtSpec({ ...item, artSpec: null }, rarity || item.rarity); if (s) item.artSpec = { base: s.base, material: s.material, effects: s.effects, liquid: s.liquid }; return item; };

  // ---------- rendering ----------
  const GEM = { common: '#c9a84c', uncommon: '#4caf7d', rare: '#5b9cf6', superrare: '#c47cf5', legendary: '#e8963a', celestial: '#fff2b0' };
  const FIXED = { w: '#efe6d0', k: '#0e0b09', h: '#7a4a26', l: '#4f301a', r: '#b02a2a', y: '#e8c04a', p: '#d9a77f' };
  const NOSHADE = new Set(['k', 'g', 'f', 'x']);
  const seeded = s => { let h = hashOf(s) || 1; return () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return (h % 10000) / 10000; }; };

  const TINT = { soul: 0.3, spore: 0.28, fire: 0.22, frost: 0.38, storm: 0.18, poison: 0.34, acid: 0.34, holy: 0.2, shadow: 0.42, necrotic: 0.4, blood: 0.3, arcane: 0.26, nature: 0.32 };
  function render(spec, rarity, seedKey) {
    const C = Canvas(); (SPR[spec.base])(C);
    const g = C.g;
    const at = (x, y) => (x >= 0 && y >= 0 && x < N && y < N ? g[y][x] : null);
    const mat = matColors(spec.material), tier = RAR[rarity] ?? 0;
    const fxIds = (spec.effects || []).filter(id => FX[id] || id === 'magic');
    const fxColor = fxIds.length ? (FX[fxIds[0]] ? FX[fxIds[0]].color : (GEM[rarity] || '#9fd0ff')) : null;
    const tintable = fxIds.some(id => ['soul', 'spore', 'fire', 'frost', 'storm', 'poison', 'acid', 'holy', 'shadow', 'necrotic', 'blood', 'arcane', 'nature'].includes(id));
    const gemColor = spec.liquid || fxColor || GEM[rarity] || GEM.common;
    const baseColor = r => r === 'a' ? mat.a : r === 'b' ? mat.b : r === 'c' ? mat.c : r === 't' ? mat.t : r === 'g' ? gemColor : r === 'f' ? (fxColor || mix(mat.b, mat.a, 0.3)) : FIXED[r] || mat.a;
    const comp = (x0, y0, test, seen) => { const st = [[x0, y0]], out = []; seen[y0 * N + x0] = 1; while (st.length) { const [x, y] = st.pop(); out.push([x, y]); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if ((dx || dy) && nx >= 0 && ny >= 0 && nx < N && ny < N && !seen[ny * N + nx] && test(nx, ny)) { seen[ny * N + nx] = 1; st.push([nx, ny]); } } } return out; };
    { const seen = new Uint8Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x] && !seen[y * N + x]) { const c = comp(x, y, (a, b) => !!g[b][a], seen); if (c.length < 3) c.forEach(([cx, cy]) => { g[cy][cx] = null; }); } }
    const cells = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const r = g[y][x]; if (!r) continue;
      let col = baseColor(r);
      if (tintable && (r === 'a' || r === 'c' || r === 't')) { const ts = TINT[fxIds.find(i => TINT[i])] || 0.2; col = mix(col, fxColor, r === 'c' ? ts * 1.6 : r === 't' ? 0.12 : ts * 0.6); }
      if (!NOSHADE.has(r)) {
        const up = at(x, y - 1), lf = at(x - 1, y), dn = at(x, y + 1), rt = at(x + 1, y);
        const lit = up !== r || lf !== r, dark = dn !== r || rt !== r;
        if (lit && !dark) col = mix(col, '#ffffff', 0.28); else if (dark && !lit) col = mix(col, '#000000', 0.34); else if (lit && dark) col = mix(col, '#000000', 0.06);
      }
      cells.push({ x, y, c: col });
    }
    const dist = Array.from({ length: N }, () => Array(N).fill(99));
    let q = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x]) { dist[y][x] = 0; q.push([x, y]); }
    for (let d = 1; d <= 5; d++) { const nq = []; q.forEach(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < N && ny < N && dist[ny][nx] > d) { dist[ny][nx] = d; nq.push([nx, ny]); } })); q = nq; }
    const colorAt = new Map(cells.map(c => [c.y * N + c.x, c.c]));
    const outline = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (dist[y][x] === 1) {
      let nb = null; [[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => { const k = (y + dy) * N + (x + dx); if (colorAt.has(k)) { nb = colorAt.get(k); return true; } return false; });
      outline.push({ x, y, c: mix(nb || '#222222', '#050302', 0.78) });
    }
    // ---- effect shapes (always attached to the object) ----
    const rnd = seeded(seedKey + spec.base), fxCells = new Map(), under = [];
    const free = (x, y) => x >= 0 && y >= 0 && x < N && y < N && !g[y][x];
    const putFx = (x, y, c, o) => { if (free(x, y)) fxCells.set(y * N + x, { x, y, c, o }); };
    const edges = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!g[y][x]) { let nx = 0, ny = 0, n = 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { if (at(x + dx, y + dy)) { nx -= dx; ny -= dy; n++; } }); if (n) edges.push({ x, y, nx: Math.sign(nx), ny: Math.sign(ny), n }); }
    let sx = 0, sy = 0, sn = 0; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x]) { sx += x; sy += y; sn++; }
    const cx0 = sn ? sx / sn : 16, cy0 = sn ? sy / sn : 16;
    let axx = 0, axy = 0, ayy = 0; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x]) { axx += (x - cx0) * (x - cx0); axy += (x - cx0) * (y - cy0); ayy += (y - cy0) * (y - cy0); }
    const th = 0.5 * Math.atan2(2 * axy, axx - ayy), ax = Math.cos(th), ay = Math.sin(th);
    // pick n spots spread evenly along the object's long axis (not weighted by perimeter, so a hilt doesn't hog them)
    const spread = (list, n, gap) => { if (!list.length) return []; const pr = e => (e.x - cx0) * ax + (e.y - cy0) * ay; let lo = 1e9, hi = -1e9; list.forEach(e => { const v = pr(e); if (v < lo) lo = v; if (v > hi) hi = v; }); const out = []; for (let i = 0; i < n; i++) { const target = lo + (i + 0.25 + rnd() * 0.5) / n * (hi - lo); let best = null, bd = 1e9; list.forEach(e => { if (out.some(o => Math.hypot(o.x - e.x, o.y - e.y) < gap)) return; const d = Math.abs(pr(e) - target) + rnd() * 1.2; if (d < bd) { bd = d; best = e; } }); if (best) out.push(best); } return out; };
    const count = k => Math.max(1, Math.min(7, Math.round(k + tier * 0.9)));
    const tops = edges.filter(e => e.ny < 0), bottoms = edges.filter(e => e.ny > 0), outward = edges.filter(e => e.nx || e.ny);
    const cellAt = new Map(cells.map(c => [c.y * N + c.x, c]));
    const paint = (x, y, c) => { const e = cellAt.get(Math.round(y) * N + Math.round(x)); if (e) e.c = c; };
    const spriteCells = cells.map(c => [c.x, c.y]);
    const pickCells = (n, test) => { const pool = spriteCells.filter(([x, y]) => !test || test(x, y)); const out = []; for (let i = 0; i < n && pool.length; i++) { const k = Math.floor(rnd() * pool.length); out.push(pool.splice(k, 1)[0]); } return out; };
    const ring1 = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (dist[y][x] === 1) ring1.push({ x, y });
    const inb = (x, y) => x >= 1 && y >= 1 && x <= 30 && y <= 30;
    const fit = (list, len, up) => { const f = list.filter(e => up ? inb(e.x, e.y - len) : inb(e.x + e.nx * len, e.y + e.ny * len)); return f.length >= 2 ? f : list; };
    const plus = (x, y, c0, c1) => { putFx(x, y, c1); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => putFx(x + dx, y + dy, c0)); };
    const wisp = (e, L, w0, cols, rise) => { const ph = rnd() * 6, sgn = rnd() > 0.5 ? 1 : -1; for (let i = 0; i < L; i++) { const t = i / L, x = Math.round(e.x + e.nx * i * 0.5 + Math.sin(i * 0.7 + ph) * (1 + t * 1.6) * sgn), y = Math.round(e.y + (rise ? -i * 0.95 : e.ny * i * 0.9 - i * 0.35)); const hw = Math.max(0, Math.round(w0 * (1 - t))); for (let dx = -hw; dx <= hw; dx++) putFx(x + dx, y, Math.abs(dx) === hw && hw > 0 ? cols[1] : cols[0], 1 - t * 0.35); if (hw === 0 && t < 0.9) putFx(x, y, cols[2] || cols[1], 1 - t * 0.35); } };
    const drip = (e, pal, thick) => { const L = 2 + Math.floor(rnd() * 3) + (tier >= 3 ? 1 : 0); for (let k = 0; k < L; k++) { putFx(e.x, e.y + k, pal[1]); if (thick && k < L - 1) putFx(e.x + 1, e.y + k, pal[0]); } putFx(e.x, e.y + L, pal[2]); putFx(e.x, e.y + L + 1, pal[1]); if (thick) { putFx(e.x + 1, e.y + L, pal[1]); putFx(e.x + 1, e.y + L + 1, pal[0]); } };
    const bubble = (e, pal) => { const cx = e.x, cy = e.y - 2; [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => putFx(cx + dx, cy + dy, dx === -1 && dy === -1 ? pal[2] : pal[1])); };
    const spark = GEM[rarity] || '#ffe27a';
    const noCircle = LIQUID_BASES.has(spec.base) || /^(scroll|ration|mushroom|fruit|cheese|candy|bread|salve|herbs|dust|bead)$/.test(spec.base);
    const FXF = {
      fire() { const cols = ['#b22410', '#ff5a1a', '#ff9a2a', '#ffd04a', '#fff3b0']; spread(fit(tops, 5, true), count(2), 3).forEach(e => { const h = 6 + Math.floor(rnd() * 4) + tier, ph = rnd() * 6; for (let k = 0; k < h; k++) { const t = k / h, hw = t < 0.55 ? 1 : 0, sway = Math.round(Math.sin(k * 0.7 + ph) * 1.6 * t), ci = Math.min(4, Math.floor(t * 4.6)); for (let dx = -hw; dx <= hw; dx++) putFx(e.x + sway + dx, e.y - k, dx === 0 && t > 0.1 && t < 0.7 ? cols[Math.min(4, ci + 1)] : cols[ci]); } }); },
      frost() { ring1.forEach(({ x, y }) => { if ((x * 7 + y * 3) % 5 < 2) putFx(x, y, (x + y) % 3 ? '#e4fbff' : '#a8e4fa'); }); spread(fit(outward, 3), count(1.8), 4).forEach(e => { const L = 5 + Math.floor(rnd() * 4) + (tier >= 3 ? 2 : 0), tilt = rnd() > 0.5 ? 1 : -1; let x = e.x, y = e.y; for (let k = 0; k < L; k++) { const t = k / L; putFx(x, y, t > 0.8 ? '#ffffff' : t > 0.4 ? '#d8f6ff' : '#9fdcf5'); if (t < 0.6) { const sd = e.nx && e.ny ? [e.nx, 0] : [e.ny ? 1 : 0, e.nx ? 1 : 0]; putFx(x + sd[0], y + sd[1], '#4fa8d8'); if (t < 0.3) putFx(x - sd[0], y - sd[1], '#4fa8d8'); } x += e.nx; y += e.ny; if (k % 3 === 2) { x += e.ny ? tilt : 0; y += e.nx ? tilt : 0; } } }); },
      storm() { spread(fit(outward, 4), 2 + Math.floor(tier / 2), 7).forEach(e => { const len = 9 + Math.floor(rnd() * 4); let x = e.x, y = e.y; const px = e.ny, py = e.nx; let z = 1; for (let i = 0; i < len; i++) { putFx(x, y, '#fffbd0'); { const sd = e.nx && e.ny ? [e.nx, 0] : [e.ny ? 1 : 0, e.nx ? 1 : 0]; putFx(x + sd[0], y + sd[1], '#ffd92a'); putFx(x - sd[0], y - sd[1], '#ffd92a'); } x += e.nx; y += e.ny; if (i % 2 === 1) { x += px * z * 2; y += py * z * 2; z = -z; } if (i === 4) { let fx2 = x, fy2 = y; for (let j = 0; j < 4; j++) { fx2 += e.nx + px * z; fy2 += e.ny + py * z; putFx(fx2, fy2, '#ffe45a'); } } } }); },
      poison() { spread(bottoms, count(1.6), 3).forEach(e => drip(e, ['#4d9a22', '#7fcf3a', '#caff7a'], true)); spread(tops, Math.max(1, Math.floor(tier / 1.5) + 1), 5).forEach(e => bubble(e, ['#2f6a12', '#8fdc4a', '#eaffb0'])); pickCells(4 + tier, (x, y) => dist[y][x] === 0).forEach(([x, y]) => paint(x, y, '#5fb82a')); },
      acid() { spread(bottoms, count(1.6), 3).forEach(e => drip(e, ['#8aa21e', '#c8e84a', '#f6ffa0'], true)); spread(tops, 2 + Math.floor(tier / 2), 4).forEach(e => bubble(e, ['#7a8c12', '#d0ec50', '#fbffc0'])); pickCells(4 + tier, () => true).forEach(([x, y]) => paint(x, y, '#2a3008')); },
      blood() { spread(bottoms, count(1.8), 3).forEach(e => drip(e, ['#6e0e0e', '#b32020', '#ff8a8a'], true)); pickCells(5 + tier, () => true).forEach(([x, y]) => paint(x, y, rnd() > 0.5 ? '#8a1414' : '#c42a2a')); },
      water() { spread(bottoms, count(1.8), 3).forEach(e => drip(e, ['#1f6aa8', '#4aa8e8', '#d4f4ff'], true)); spread(tops, 1 + Math.floor(tier / 2), 5).forEach(e => bubble(e, ['#2a7ab8', '#7fc8f4', '#f0fcff'])); },
      holy() { const rays = 6 + Math.min(4, tier); for (let i = 0; i < rays; i++) { const a = (i / rays) * Math.PI * 2 + rnd() * 0.4; let px = cx0, py = cy0; for (let k = 0; k < 80; k++) { px += Math.cos(a) * 0.5; py += Math.sin(a) * 0.5; const xx = Math.round(px), yy = Math.round(py); if (!(xx >= 0 && yy >= 0 && xx < N && yy < N)) break; if (!g[yy][xx]) { const len = 5 + Math.floor(rnd() * 4) + Math.floor(tier / 2); for (let j = 0; j < len; j++) putFx(Math.round(px + Math.cos(a) * j), Math.round(py + Math.sin(a) * j), j < 2 ? '#fffbe0' : j < 5 ? '#ffe27a' : '#ffc84a', j > 5 ? 0.75 : 1); if (i % 3 === 0 && len > 6) plus(Math.round(px + Math.cos(a) * (len + 1)), Math.round(py + Math.sin(a) * (len + 1)), '#ffe27a', '#ffffff'); break; } } } },
      luck() { const rays = 5 + Math.min(3, tier); for (let i = 0; i < rays; i++) { const a = (i / rays) * Math.PI * 2 + rnd() * 0.5; let px = cx0, py = cy0; for (let k = 0; k < 80; k++) { px += Math.cos(a) * 0.5; py += Math.sin(a) * 0.5; const xx = Math.round(px), yy = Math.round(py); if (!(xx >= 0 && yy >= 0 && xx < N && yy < N)) break; if (!g[yy][xx]) { const len = 3 + Math.floor(rnd() * 3); for (let j = 0; j < len; j++) putFx(Math.round(px + Math.cos(a) * j), Math.round(py + Math.sin(a) * j), j % 2 ? '#7fe08a' : '#fff0a0'); plus(Math.round(px + Math.cos(a) * (len + 1)), Math.round(py + Math.sin(a) * (len + 1)), i % 2 ? '#5fd078' : '#ffd84a', '#ffffff'); break; } } } },
      shadow() { spread(fit(edges.filter(e => e.ny >= 0 || e.nx), 6, true), count(1.8), 4).forEach(e => wisp(e, 9 + Math.floor(rnd() * 5) + tier, 2, ['#2a1650', '#6a38b8', '#8f5fd6'], true)); },
      necrotic() { spread(fit(edges.filter(e => e.ny <= 0 || e.nx), 6, true), count(1.6), 4).forEach(e => wisp(e, 8 + Math.floor(rnd() * 5) + tier, 1, ['#2fae4a', '#7fe08a', '#d4ffd0'], true)); pickCells(4 + tier, () => true).forEach(([x, y]) => paint(x, y, '#14331c')); },
      nature() { const used = new Set(); for (let v = 0; v < (tier >= 3 ? 2 : 1) + 1; v++) { const starts = ring1.map(c => c.y * N + c.x).filter(k => !used.has(k)); if (!starts.length) break; let cur = starts[Math.floor(rnd() * starts.length)], pdx = 1, pdy = 0; for (let s = 0; s < 16 + tier * 3; s++) { used.add(cur); const x = cur % N, y = Math.floor(cur / N); putFx(x, y, '#2f7a2f'); if (s % 3 === 2) { const out = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => free(x + dx, y + dy) && dist[y + dy] && dist[y + dy][x + dx] === 2); if (out) { putFx(x + out[0], y + out[1], '#5fbf5f'); putFx(x + out[0] * 2, y + out[1] * 2, '#9fe89f'); putFx(x + out[0] * 2 + out[1], y + out[1] * 2 + out[0], '#5fbf5f'); } } let best = null, bs = -9; [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([dx, dy]) => { const k = (y + dy) * N + (x + dx); if (dist[y + dy] && dist[y + dy][x + dx] === 1 && !used.has(k)) { const sc = dx * pdx + dy * pdy + rnd() * 0.3; if (sc > bs) { bs = sc; best = [k, dx, dy]; } } }); if (!best) break; cur = best[0]; pdx = best[1]; pdy = best[2]; } } pickCells(4 + tier, () => true).forEach(([x, y]) => paint(x, y, rnd() > 0.5 ? '#3f7a3a' : '#6fb85f')); },
      wind(col) { spread(fit(outward, 4), count(1.6), 6).forEach(e => { const L = 10 + Math.floor(rnd() * 4), sg = rnd() > 0.5 ? 1 : -1; for (let i = 0; i < L; i++) { const t = i / L, x = Math.round(e.x + e.nx * i * 0.8 + e.ny * Math.sin(t * 4) * 2.2 * sg), y = Math.round(e.y + e.ny * i * 0.8 + e.nx * Math.sin(t * 4) * 2.2 * sg); putFx(x, y, i < 3 ? '#ffffff' : col, 1 - t * 0.5); { const sd = e.nx && e.ny ? [e.nx, 0] : [e.ny ? 1 : 0, e.nx ? 1 : 0]; if (i < L * 0.6) putFx(x + sd[0], y + sd[1], col, 0.85); if (i < L * 0.3) putFx(x - sd[0], y - sd[1], col, 0.85); } } }); },
      magic() { if (tier < 3) return; const n = tier >= 5 ? 4 : tier >= 4 ? 3 : 2; spread(fit(outward, 4), n, 6).forEach((e, i) => { const len = 2 + (i % 2); for (let j = 0; j < len; j++) putFx(e.x + e.nx * j, e.y + e.ny * j, j ? '#ffffff' : spark); plus(e.x + e.nx * (len + 1), e.y + e.ny * (len + 1), spark, '#ffffff'); }); },
      sonic() { [[12, '#d4f0ff'], [14.6, '#9fd0f0'], [17.2, '#6fa8d8']].forEach(([r, c], ri) => { if (ri > 1 + Math.floor(tier / 2)) return; [0, Math.PI].forEach(base => { for (let a = -0.75; a <= 0.75; a += 0.4 / r * 2) putFx(Math.round(16 + Math.cos(base + a) * r), Math.round(16 + Math.sin(base + a) * r), c); }); }); },
      soul() { spread(fit(edges.filter(e => e.ny <= 0 || e.nx), 6, true), count(1.6), 4).forEach(e => wisp(e, 9 + Math.floor(rnd() * 5) + tier, 1, ['#1a5a74', '#5fc8d8', '#d4faff'], true)); pickCells(3 + tier, () => true).forEach(([x, y]) => paint(x, y, '#2a8090')); },
      prism() { const cols = ['#ff5a7a', '#ffb04a', '#fff06a', '#6ae08a', '#5ab8ff', '#b080ff']; spread(fit(outward, 4), Math.min(6, 3 + Math.floor(tier / 1.5)), 5).forEach((e, i) => { const c = cols[(i + Math.floor(rnd() * 6)) % 6]; plus(e.x + e.nx * 2, e.y + e.ny * 2, c, '#ffffff'); for (let k = 0; k < 2; k++) putFx(e.x + e.nx * (k === 0 ? 1 : 3), e.y + e.ny * (k === 0 ? 1 : 3), c); }); pickCells(4 + tier, () => true).forEach(([x, y], i) => paint(x, y, cols[i % 6])); },
      gravity() { for (let a = 0; a < 360; a += 5) { if ((a % 60) > 38) continue; const r = a < 180 ? 13 : 14.6; const x = Math.round(16 + Math.cos(a * Math.PI / 180) * r), y = Math.round(16 + Math.sin(a * Math.PI / 180) * r); if (free(x, y)) under.push({ x, y, c: a % 120 < 60 ? '#6a58d8' : '#b9a8ff', o: 0.55 }); } spread(fit(outward, 4), 2 + Math.floor(tier / 2), 5).forEach(e => { for (let i = 1; i <= 5; i++) putFx(e.x + e.nx * i, e.y + e.ny * i, i % 2 ? '#b9a8ff' : '#6a58d8', 1 - i * 0.12); }); },
      spore() { spread(fit(tops.concat(outward), 4), 2 + Math.floor(tier / 2), 5).forEach(e => { const c = ['#a8c060', '#e8f0b0']; plus(e.x + e.nx * 2, e.y + e.ny * 2 - 1, c[0], c[1]); putFx(e.x + e.nx * 4, e.y + e.ny * 4 - 2, c[0]); putFx(e.x + e.nx * 4 + 1, e.y + e.ny * 4 - 2, c[1]); putFx(e.x + e.nx * 4, e.y + e.ny * 4 - 3, c[0]); }); pickCells(4 + tier, () => true).forEach(([x, y]) => paint(x, y, '#6a7a2a')); },
      time() { [[13.6, '#e8d890'], [15.2, '#a8903a']].forEach(([r, c], ri) => { if (ri && tier < 2) return; for (let a = 0; a < 360; a += 3) { if (ri === 0 && a % 30 < 4) continue; const x = Math.round(16 + Math.cos(a * Math.PI / 180) * r), y = Math.round(16 + Math.sin(a * Math.PI / 180) * r); if (free(x, y)) under.push({ x, y, c, o: ri ? 0.55 : 0.8 }); } }); [0, 90, 180, 270].forEach(a => { for (let k = 1; k <= 3; k++) { const x = Math.round(16 + Math.cos(a * Math.PI / 180) * (14.6 + k - 0.5)), y = Math.round(16 + Math.sin(a * Math.PI / 180) * (14.6 + k - 0.5)); if (free(x, y)) under.push({ x, y, c: '#e8d890', o: 0.9 }); } }); },
      circle(col, runes) { const r = 14.2; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 16); if (Math.abs(d - r) < 0.55) under.push({ x, y, c: col, o: 0.6 }); else if (Math.abs(d - (r - 2.4)) < 0.4 && tier >= 3) under.push({ x, y, c: col, o: 0.35 }); }
        [[16, 1, 0, 1], [16, 30, 0, -1], [1, 16, 1, 0], [30, 16, -1, 0]].forEach(([x, y, dx, dy]) => { for (let k = 1; k <= 3; k++) under.push({ x: x + dx * k, y: y + dy * k, c: col, o: 0.6 }); });
        if (runes) [90, 210, 330].forEach(a => { const x = Math.round(16 + Math.cos(a * Math.PI / 180) * 14.2), y = Math.round(16 + Math.sin(a * Math.PI / 180) * 14.2); [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => under.push({ x: x + dx, y: y + dy, c: '#ffffff', o: 0.85 })); }); },
    };
    fxIds.forEach(id => {
      if (id === 'fire') FXF.fire(); else if (id === 'frost') FXF.frost(); else if (id === 'storm') FXF.storm();
      else if (id === 'poison') FXF.poison(); else if (id === 'acid') FXF.acid(); else if (id === 'blood') FXF.blood(); else if (id === 'water') FXF.water();
      else if (id === 'holy') FXF.holy(); else if (id === 'luck') FXF.luck();
      else if (id === 'shadow') FXF.shadow(); else if (id === 'necrotic') FXF.necrotic();
      else if (id === 'soul') FXF.soul(); else if (id === 'prism') FXF.prism(); else if (id === 'gravity') FXF.gravity(); else if (id === 'spore') FXF.spore(); else if (id === 'time') FXF.time();
      else if (id === 'nature') FXF.nature(); else if (id === 'wind') FXF.wind('#bfe4ff'); else if (id === 'sonic') FXF.sonic();
      else if (id === 'arcane') { if (!noCircle) FXF.circle('#b98cff', true); } else if (id === 'magic') FXF.magic();
    });
    const glow = [];
    if (fxColor && tier >= 1) { const reach = Math.min(4, 1 + Math.ceil(tier / 2)); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = dist[y][x]; if (d >= 2 && d <= 1 + reach && !fxCells.has(y * N + x)) glow.push({ x, y, c: fxColor, o: d === 2 ? 0.3 : d === 3 ? 0.17 : 0.09 }); } }
    // effect pieces that ended up smaller than 3 connected cells are noise: remove them
    { const test = (x, y) => fxCells.has(y * N + x) || !!g[y][x]; const seen = new Uint8Array(N * N); for (const k of [...fxCells.keys()]) { if (seen[k]) continue; const c = comp(k % N, Math.floor(k / N), test, seen); const hasSprite = c.some(([x, y]) => g[y][x]); const fxN = c.filter(([x, y]) => fxCells.has(y * N + x)).length; if (!hasSprite && fxN < 3) c.forEach(([x, y]) => fxCells.delete(y * N + x)); } }
    return { under: under.concat(glow), outline, cells, fx: [...fxCells.values()] };
  }

  const rectsOf = arr => {
    const rows = {}; arr.forEach(c => { (rows[c.y] = rows[c.y] || []).push(c); });
    let out = '';
    Object.keys(rows).forEach(y => { const row = rows[y].sort((a, b) => a.x - b.x); let i = 0; while (i < row.length) { let j = i + 1; while (j < row.length && row[j].x === row[j - 1].x + 1 && row[j].c === row[i].c && (row[j].o || 1) === (row[i].o || 1)) j++; const o = row[i].o; out += `<rect x="${row[i].x}" y="${y}" width="${j - i}" height="1" fill="${row[i].c}"${o != null && o < 1 ? ` fill-opacity="${o}"` : ''}/>`; i = j; } });
    return out;
  };
  const cache = new Map();
  window.itemArtInner = function (item, rarity) {
    item = item || {};
    const key = `${item.name}|${item.type}|${item.subcategory || ''}|${rarity || item.rarity || ''}|${item.artSpec ? JSON.stringify(item.artSpec) : ''}|${(item.desc || '').slice(0, 50)}|${String(item.effect || '').slice(0, 60)}|${Array.isArray(item.mods) ? item.mods.length + (item.mods[0] ? item.mods[0].key : '') : ''}`;
    if (cache.has(key)) return cache.get(key);
    const spec = window.itemArtSpec(item, rarity);
    let out = null;
    if (spec && SPR[spec.base]) { const r = render(spec, rarity || item.rarity, item.name || ''); out = rectsOf(r.under) + rectsOf(r.outline) + rectsOf(r.cells) + rectsOf(r.fx); }
    if (cache.size > 4000) cache.clear();
    cache.set(key, out); return out;
  };
  window.itemArtSvg = function (item, px, rarity) { const inner = window.itemArtInner(item, rarity); return inner ? `<svg class="pixel-svg item-pixel-icon item-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${px}" height="${px}" shape-rendering="crispEdges" style="image-rendering:pixelated;flex-shrink:0;">${inner}</svg>` : null; };
  window.itemArtBaseSvg = function (base, opts, px) {
    opts = opts || {}; const spec = { base, material: opts.material || 'steel', effects: opts.effects || [], liquid: opts.liquid || null };
    if (!SPR[base]) return null; const r = render(spec, opts.rarity || 'common', opts.seed || base);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${px || 96}" height="${px || 96}" shape-rendering="crispEdges">${rectsOf(r.under) + rectsOf(r.outline) + rectsOf(r.cells) + rectsOf(r.fx)}</svg>`;
  };
  window.ITEM_ART = { MAT, FX, SPR };
})();
