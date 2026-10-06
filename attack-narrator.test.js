// Checks for the attack narrator (attack-narrator*.js): every attack, spell, weapon and ability reads as clean
// prose (no leftover template tokens, doubled words or empty bullets), the output is deterministic, and the
// description follows the mechanics (element, shape, conditions, rolled outcome).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('.', import.meta.url).pathname;
const win = {};
const ctx = vm.createContext({ window: win, console, Math, Array, Object, String, Number, Set, Map, JSON, RegExp, Date });
for (const f of ['attack-narrator-elements.js', 'attack-narrator-moves.js', 'attack-narrator-magic.js', 'attack-narrator-effects.js', 'attack-narrator-lexicon.js', 'attack-narrator-spells.js', 'attack-narrator.js'])
  vm.runInContext(fs.readFileSync(root + f, 'utf8'), ctx, { filename: f });
const AN = win.AttackNarrator;

const att = (type, size, cr, extra) => ({ attacker: { type, size, cr, ...extra } });
const FIXTURE = [
  ['Bite', 'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 15 (2d10 + 4) piercing damage.', att('Dragon', 'Large', '6')],
  ['Claw', 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 2) slashing damage.', att('Beast', 'Medium', '1')],
  ['Longsword', 'Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 8 (1d8 + 4) slashing damage, or 9 (1d10 + 4) slashing damage if used with two hands.', att('Humanoid', 'Medium', '8')],
  ['Shortsword', 'Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) piercing damage, and the target must make a 15 Constitution saving throw, taking 24 (7d6) poison damage on a failed save, or half as much damage on a successful one.', att('Humanoid', 'Medium', '8')],
  ['Rock', 'Ranged Weapon Attack: +11 to hit, range 60/240 ft., one target. Hit: 29 (4d10 + 7) bludgeoning damage.', att('Giant', 'Huge', '9')],
  ['Shortbow', 'Ranged Weapon Attack: +6 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.', att('Humanoid', 'Medium', '2')],
  ['Fire Breath (Recharge 5–6)', 'The dragon exhales fire in a 60-foot cone. Each creature in that area must make a 21 Dexterity saving throw, taking 63 (18d6) fire damage on a failed save, or half as much damage on a successful one.', att('Dragon', 'Huge', '17')],
  ['Cold Breath (Recharge 5–6)', 'The dragon exhales an icy blast of hail in a 15-foot cone. Each creature in that area must make a 12 Constitution saving throw, taking 22 (5d8) cold damage on a failed save, or half as much damage on a successful one.', att('Dragon', 'Medium', '2')],
  ['Frightful Presence', 'Each creature of the dragon\'s choice that is within 120 feet of the dragon and aware of it must succeed on a 20 Wisdom saving throw or become frightened for 1 minute.', att('Dragon', 'Gargantuan', '23')],
  ['Corrupting Touch', 'Melee Spell Attack: +4 to hit, reach 5 ft., one target. Hit: 12 (3d6 + 2) necrotic damage.', att('Undead', 'Medium', '4')],
  ['Tentacle', 'Melee Weapon Attack: +9 to hit, reach 10 ft., one target. Hit: 10 (2d6 + 3) bludgeoning damage. The target is grappled (escape DC 14).', att('Aberration', 'Large', '8')],
  ['Stinger', 'Melee Weapon Attack: +5 to hit, reach 5 ft., one creature. Hit: 5 (1d6 + 2) piercing damage. The target must make a DC 12 Constitution saving throw or be poisoned for 1 minute.', att('Monstrosity', 'Medium', '3')],
  ['Defensive Rebuke', 'If a creature within 5 feet of the norker makes a melee attack against it, the norker can use its reaction to cause 6 piercing damage to it.', att('Humanoid', 'Small', '3')],
  ['Teleport', 'Hutijin uses his Teleport action.', att('Fiend', 'Large', '21')],
  ['Change Shape', 'The dragon magically transforms into any creature that is Medium or Small, while retaining its game statistics.', att('Dragon', 'Gargantuan', '20')],
  ['Call to Attack', 'Up to three allied duergar within 120 feet of this duergar that can hear it can each use their reaction to make one weapon attack.', att('Humanoid', 'Medium', '6')],
  ['Multiattack', 'The dragon makes three attacks: one with its bite and two with its claws.', att('Dragon', 'Large', '10')],
  ['Swallow', 'The remorhaz makes one bite attack against a Medium or smaller creature it is grappling. If the attack hits, that creature takes the bite\'s damage and is swallowed, and the grapple ends.', att('Monstrosity', 'Huge', '11')],
  ['Maul', 'Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 10 (2d6 + 3) bludgeoning damage.', att('Humanoid', 'Medium', '4')],
  ['Rusted blade', 'Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 1d6 damage.', { ...att('Humanoid', 'Medium', '1'), weapon: { name: 'a rusted blade', rarity: 'common' } }],
  ['Crude morningstar', 'Melee Weapon Attack: +14 to hit, reach 5 ft., one target. Hit: 4d10 damage.', { ...att('Humanoid', 'Medium', '9'), weapon: { name: 'a crude morningstar', rarity: 'celestial' } }]
].map(([name, text, c]) => ({ attack: { name, text }, ctx: c }));

const SPELL_FIXTURE = [
  ['Fireball', 'Each target makes a DC 15 Dexterity saving throw, taking (8d6) fire damage on a failed save, or half as much damage on a successful one.'],
  ['Fire Bolt', 'Ranged Spell Attack: +7 to hit, range 120 ft., one target. Hit: 11 (2d10) fire damage.'],
  ['Cone of Cold', 'Cone: 60 ft. Each target makes a DC 15 Constitution saving throw, taking (8d8) cold damage on a failed save, or half as much damage on a successful one.'],
  ['Lightning Bolt', 'Line: 100 ft. Each target makes a DC 15 Dexterity saving throw, taking (8d6) lightning damage on a failed save, or half as much damage on a successful one.'],
  ['Hold Person', 'Casts Hold Person (DC 15 Wisdom save): Choose a humanoid that you can see within range. The target must succeed on a saving throw or be paralyzed for the duration.'],
  ['Misty Step', 'Casts Misty Step: Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see.'],
  ['Cure Wounds', 'Casts Cure Wounds: A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier.'],
  ['Contingency', 'Casts Contingency: Choose a spell of 5th level or lower that you can cast, that has a casting time of 1 action.'],
  ['Wish', 'Casts Wish: Wish is the mightiest spell a mortal creature can cast.'],
  ['Frost Fingers', 'Cone: 15 ft. Each target makes a DC 16 Constitution saving throw, taking (2d8) cold damage on a failed save.'],
  ['Frostbite', 'Each target makes a DC 16 Constitution saving throw, taking (2d6) cold damage on a failed save.']
].map(([name, text]) => ({ attack: { name, text, isSpell: true, source: 'spell' }, ctx: att('Humanoid', 'Medium', '9') }));

const BAD = [/[{}]/, /undefined|NaN|\[object/, /\b(\w{2,}) \1\b/i, / a a | an an |, ,|\. \.|,\./, /leaving \./, /\bthe the\b/i, /leaving a painful wound/];
const flat = r => r.bullets.map(b => b.text).join(' ');

test('every fixture attack narrates cleanly at every detail level', () => {
  for (const f of [...FIXTURE, ...SPELL_FIXTURE]) for (const detail of ['brief', 'standard', 'full']) {
    const r = AN.describe(f.attack, { ...f.ctx, detail });
    assert.ok(!r.error, `${f.attack.name}/${detail}: ${r.error}`);
    assert.ok(!r.missingTokens, `${f.attack.name}/${detail}: missing ${r.missingTokens}`);
    assert.ok(r.bullets.length >= 1, `${f.attack.name}/${detail}: no bullets`);
    for (const b of r.bullets) assert.ok(b.text && b.text.trim().length > 8, `${f.attack.name}/${detail}: empty bullet ${b.label}`);
    const t = flat(r);
    for (const re of BAD) assert.ok(!re.test(t), `${f.attack.name}/${detail}: ${re} in "${(t.match(re) || [''])[0]}"`);
    assert.ok(r.text.includes(r.title) && r.html.includes('an-narr'));
  }
});

test('output is deterministic, and a new take changes it', () => {
  const f = FIXTURE[0];
  const a = AN.describe(f.attack, f.ctx), b = AN.describe(f.attack, f.ctx);
  assert.equal(a.text, b.text);
  const texts = new Set([0, 1, 2, 3, 4].map(v => AN.describe(f.attack, { ...f.ctx, variant: v }).text));
  assert.ok(texts.size >= 3, 'variants should differ');
});

test('complicated attacks become several small bullets, simple ones stay short', () => {
  const find = n => FIXTURE.find(f => f.attack.name === n);
  const venom = AN.describe(find('Shortsword').attack, { ...find('Shortsword').ctx, detail: 'full' });
  assert.ok(venom.bullets.some(b => /poison/i.test(b.label)), 'extra poison damage gets its own bullet');
  const tent = AN.describe(find('Tentacle').attack, find('Tentacle').ctx);
  assert.ok(tent.bullets.some(b => /grappl/i.test(b.label + b.text)), 'grapple is described');
  const sting = AN.describe(find('Stinger').attack, find('Stinger').ctx);
  assert.ok(sting.bullets.some(b => /poison/i.test(b.label)), 'poison rider is described');
  const full = AN.describe(find('Bite').attack, { ...find('Bite').ctx, detail: 'full' });
  assert.ok(full.bullets.some(b => b.kind === 'rules' && /\+7 to hit/.test(b.text) && /2d10 \+ 4 piercing/.test(b.text)));
  assert.ok(full.bullets.some(b => b.kind === 'tip'));
});

test('the description follows the mechanics', () => {
  const f = n => FIXTURE.find(x => x.attack.name.startsWith(n));
  const fire = AN.describe(f('Fire Breath').attack, f('Fire Breath').ctx);
  const cold = AN.describe(f('Cold Breath').attack, f('Cold Breath').ctx);
  assert.equal(fire.element, 'fire'); assert.equal(cold.element, 'cold');
  assert.equal(fire.move, 'breath');
  assert.match(flat(fire), /sixty-foot cone/); assert.match(flat(cold), /fifteen-foot cone/);
  assert.equal(AN.describe(f('Maul').attack, f('Maul').ctx).move, 'hammer');
  assert.equal(AN.describe(f('Rock').attack, f('Rock').ctx).move, 'thrown');
  assert.match(flat(AN.describe(f('Rock').attack, f('Rock').ctx)), /boulder/);
  assert.equal(AN.describe(f('Longsword').attack, f('Longsword').ctx).lethality.total, 8);
  assert.equal(AN.describe(f('Defensive Rebuke').attack, f('Defensive Rebuke').ctx).move, 'strike');
  assert.equal(AN.describe(f('Call to Attack').attack, f('Call to Attack').ctx).move, 'utility');
  assert.equal(AN.describe(f('Swallow').attack, f('Swallow').ctx).move, 'engulf');
});

test('bigger hits read bigger', () => {
  const small = AN.describe({ name: 'Bite', text: 'Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 2 (1d4) piercing damage.' }, att('Beast', 'Small', '0'));
  const huge = AN.describe({ name: 'Bite', text: 'Melee Weapon Attack: +15 to hit, reach 10 ft., one target. Hit: 60 (8d12 + 8) piercing damage.' }, att('Dragon', 'Gargantuan', '20'));
  assert.ok(small.tier < huge.tier);
  assert.notEqual(flat(small), flat(huge));
});

test('chaos weapons use the weapon name and describe their rarity', () => {
  const f = FIXTURE.find(x => x.attack.name === 'Crude morningstar');
  const r = AN.describe(f.attack, f.ctx);
  assert.equal(r.move, 'mace');
  assert.match(flat(r), /crude morningstar/i);
  assert.ok(r.element, 'untyped chaos damage is given a type from the weapon');
  const common = FIXTURE.find(x => x.attack.name === 'Rusted blade');
  assert.notEqual(flat(AN.describe(common.attack, common.ctx)), flat(r));
});

test('named spells have their own read-aloud; unnamed spells follow their kind', () => {
  const g = n => SPELL_FIXTURE.find(x => x.attack.name === n);
  const fireball = AN.describe(g('Fireball').attack, { ...g('Fireball').ctx, detail: 'full' });
  assert.match(flat(fireball), /heat|flame|fire/i);
  assert.equal(fireball.element, 'fire');
  assert.equal(AN.describe(g('Frost Fingers').attack, g('Frost Fingers').ctx).move, 'cone');
  assert.equal(AN.describe(g('Misty Step').attack, g('Misty Step').ctx).move, 'utility');
  const cure = AN.describe(g('Cure Wounds').attack, g('Cure Wounds').ctx);
  assert.match(flat(cure), /heal|wound|warm|glow|light|colour|color/i);
  assert.ok(!/hurl|detonat/i.test(flat(AN.describe(g('Contingency').attack, g('Contingency').ctx))));
  assert.ok(!/leaving a painful wound/.test(flat(AN.describe(g('Hold Person').attack, g('Hold Person').ctx))));
});

test('a rolled result adds a line about what actually happened', () => {
  const f = FIXTURE[0];
  const hit = AN.describe(f.attack, { ...f.ctx, result: { outcome: 'hit', damage: 15 } });
  const miss = AN.describe(f.attack, { ...f.ctx, result: { outcome: 'miss', damage: 0 } });
  const crit = AN.describe(f.attack, { ...f.ctx, result: { outcome: 'crit', damage: 30 } });
  for (const r of [hit, miss, crit]) assert.ok(r.result && r.result.text, 'result line present');
  assert.notEqual(hit.result.text, miss.result.text);
  assert.notEqual(hit.result.text, crit.result.text);
});

test('sequences and whole monsters', () => {
  const seq = AN.describeSequence(FIXTURE.slice(0, 3), { seed: 4 });
  assert.equal(seq.items.length, 3);
  assert.ok(seq.text.length > 100);
  const mon = AN.describeMonster({ name: 'Test', type: 'Dragon', size: 'Large', cr: '5', actions: FIXTURE.slice(0, 4).map(f => f.attack), reactions: [FIXTURE[12].attack], spellcasting: [{ groups: [{ kind: 'will', label: 'At will', spells: ['Fire Bolt', 'Misty Step'] }] }] });
  assert.equal(mon.actions.length, 4); assert.equal(mon.reactions.length, 1); assert.equal(mon.spells.length, 2);
});

test('empty and odd input never throws', () => {
  for (const a of [undefined, {}, { name: '' }, { name: 'X', text: '' }, { name: 'Y', text: '???' }, { name: 'Z', text: 'Hit: 5 damage.' }]) {
    const r = AN.describe(a, {});
    assert.ok(r.bullets.length >= 1 && typeof r.text === 'string');
  }
});
