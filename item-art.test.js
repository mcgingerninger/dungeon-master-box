// Checks for the pixel item-art engine (item-art*.js): every rule points at a drawn sprite, no sprite or
// effect leaves floating single pixels, items classify to the right base object, and generated items
// pick up art from their modifiers.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('.', import.meta.url).pathname;
const win = {};
const ctx = vm.createContext({ window: win, console, Math, Array, Object, String, Number, Set, Map, Uint8Array, JSON, RegExp });
for (const f of ['monster-art.js', 'item-art-kit.js', 'item-art-weapons.js', 'item-art-armor.js', 'item-art-misc.js', 'item-art-parts.js', 'item-art-rules.js', 'item-art.js'])
  vm.runInContext(fs.readFileSync(root + f, 'utf8'), ctx, { filename: f });

const SPR = win.ItemArtSprites, N = 32;
const baseOf = (name, extra) => win.itemArtSpec({ name, type: 'misc', ...extra }).base;

function components(g) {
  const seen = new Set(), out = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!g[y][x] || seen.has(y * N + x)) continue;
    const st = [[x, y]], c = []; seen.add(y * N + x);
    while (st.length) { const [cx, cy] = st.pop(); c.push([cx, cy]); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = cx + dx, ny = cy + dy; if (nx >= 0 && ny >= 0 && nx < N && ny < N && g[ny][nx] && !seen.has(ny * N + nx)) { seen.add(ny * N + nx); st.push([nx, ny]); } } }
    out.push(c);
  }
  return out;
}

test('every sprite draws something and engine exposes the sprite table', () => {
  assert.ok(Object.keys(SPR).length > 300);
  for (const [name, draw] of Object.entries(SPR)) {
    const C = win.PixelKit.Canvas(); draw(C);
    const n = C.g.flat().filter(Boolean).length;
    assert.ok(n > 20, `${name} is nearly empty (${n} px)`);
  }
});

test('every base named by a classification rule has a sprite', () => {
  const src = fs.readFileSync(root + 'item-art-rules.js', 'utf8');
  const bases = new Set(); let m; const re = /add\((\[[^\]]*\]|'[a-z_]+')/g;
  while ((m = re.exec(src))) (m[1].match(/[a-z_]+/g) || []).forEach(b => bases.add(b));
  for (const b of bases) assert.ok(SPR[b], `no sprite for base "${b}"`);
});

test('classification picks distinct base objects', () => {
  const cases = { 'Longsword +1': 'longsword', 'Steel Dagger': 'dagger', 'Dagger of Venom': 'dagger', 'Greataxe of the Gale': 'greataxe', 'Heavy Crossbow': 'heavycrossbow', 'Shortbow': 'shortbow',
    'Iron Plate Greaves': 'greaves', 'Breastplate of the Racing': 'breastplate', 'Ring of Mind Shielding': 'ring', 'Tower Shield of the Rotwood': 'towershield', 'Adamantine Plate Helm': 'platehelm',
    'Potion of Healing': 'elixir', 'Spell Scroll (3rd Level)': 'scroll', 'Bag of Holding': 'satchel', 'Belt Pouch': 'beltpouch', 'Wand of Fireballs': 'wand', 'Wand of Lightning Bolts': 'wand',
    "Old Marrow's Service Record": 'letter', 'Torch': 'torch', 'Iron Rations (1 day)': 'ration' };
  for (const [name, base] of Object.entries(cases)) {
    const got = baseOf(name);
    if (name === 'Potion of Healing') assert.ok(['potion', 'elixir', 'tonic', 'vial'].includes(got), `${name} -> ${got}`);
    else assert.equal(got, base, `${name} -> ${got}`);
  }
});

test('companions, monster parts and limbs get creature art in the creature colours', () => {
  assert.equal(baseOf('Barn Cat', { type: 'companion' }), 'cat');
  assert.equal(baseOf('Riding Horse', { type: 'companion' }), 'horse');
  assert.equal(baseOf('Pegasus', { type: 'companion' }), 'pegasus');
  const part = { name: 'Red Dragon Fang', type: 'craftable', partType: 'x', anatomicalId: 'fang', sourceMonster: 'Adult Red Dragon', creatureFamily: 'dragon' };
  const spec = win.itemArtSpec(part);
  assert.equal(spec.base, 'fang');
  assert.equal(typeof spec.material, 'object');
  assert.equal(win.itemArtSpec({ name: 'Left Arm of the Ogre', type: 'limb', subcategory: 'arm' }).base, 'limb_arm');
});

test('effects come from the name and modifiers, and mundane items stay plain', () => {
  const eff = it => win.itemArtSpec(it).effects;
  assert.ok(eff({ name: 'Flame Tongue Longsword', type: 'weapon', rarity: 'rare' }).includes('fire'));
  assert.ok(eff({ name: 'Longsword', type: 'weapon', rarity: 'rare', mods: [{ type: 'Affix', name: 'Hoarfrost', text: 'Deals extra cold damage.' }] }).includes('frost'));
  assert.ok(eff({ name: 'Plate Helm', type: 'armor', rarity: 'rare', mods: [{ type: 'Affix', name: 'Voltaic', text: '+1d4 lightning damage' }] }).includes('storm'));
  assert.deepEqual(eff({ name: 'Iron Dagger', type: 'weapon', rarity: 'common' }), []);
  assert.deepEqual(eff({ name: 'Torch', type: 'misc', rarity: 'common' }).filter(e => e !== 'fire'), []);
});

test('material comes from affix names (adamantine plate helmet)', () => {
  const s = win.itemArtSpec({ name: 'Adamantine Plate Helm of the Gale', type: 'armor', rarity: 'rare' });
  assert.equal(s.base, 'platehelm'); assert.equal(s.material, 'adamantine'); assert.ok(s.effects.includes('wind'));
});

test('rendered icons never contain floating fragments (sprites or effects)', () => {
  const effects = ['fire', 'frost', 'storm', 'poison', 'acid', 'holy', 'shadow', 'necrotic', 'blood', 'arcane', 'nature', 'wind', 'water', 'sonic', 'luck', 'magic'];
  const parse = svg => { const g = Array.from({ length: N }, () => Array(N).fill(false)); for (const m of svg.matchAll(/<rect ([^>]*)\/>/g)) { const a = Object.fromEntries([...m[1].matchAll(/([a-z-]+)="([^"]*)"/g)].map(q => [q[1], q[2]])); if (a['fill-opacity'] && +a['fill-opacity'] < 0.6) continue; for (let i = 0; i < +a.width; i++) g[+a.y][+a.x + i] = true; } return g; };
  for (const base of ['longsword', 'dagger', 'greataxe', 'wand', 'platehelm', 'ring', 'cat', 'heartstone', 'potion', 'staffcrystal', 'tome']) for (const fx of effects) for (const rarity of ['rare', 'legendary']) {
    const svg = win.itemArtBaseSvg(base, { material: 'steel', effects: [fx], rarity }, 32); assert.ok(svg, `${base}+${fx}`);
    const small = components(parse(svg)).filter(c => c.length < 3);
    assert.equal(small.length, 0, `${base}+${fx}@${rarity} has ${small.length} fragment(s) smaller than 3 px`);
  }
});

test('explicit artSpec on an item wins', () => {
  const it = { name: 'Plain Stick', type: 'misc', artSpec: { base: 'wand', material: 'gold', effects: ['holy'] } };
  const s = win.itemArtSpec(it); assert.equal(s.base, 'wand'); assert.equal(s.material, 'gold'); assert.deepEqual(s.effects, ['holy']);
  assert.ok(win.itemArtInner(it, 'rare').length > 50);
});

test('every item gets art', () => {
  for (const name of ['', 'Zzyzx', 'Item 12', 'The Unnamed']) for (const type of ['weapon', 'armor', 'consumable', 'misc', 'companion', 'limb', 'document', 'treasure', 'questitem'])
    assert.ok(win.itemArtInner({ name, type }, 'common'), `no art for "${name}" (${type})`);
});
