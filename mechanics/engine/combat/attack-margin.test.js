import test from 'node:test';
import assert from 'node:assert/strict';
import * as AM from './attack-margin.js';

const R = (d20, toHit, ac) => AM.resolveAttack({ d20, toHit, ac });

test('margin is d20 + attack mods - AC and picks the tier from the table', () => {
  assert.equal(AM.attackMargin(12, 5, 15), 2);
  const cases = [[-12, 'fumble'], [-10, 'fumble'], [-9, 'miss'], [-5, 'miss'], [-4, 'glancing'], [-1, 'glancing'], [0, 'hit'], [3, 'hit'], [4, 'solid'], [7, 'solid'], [8, 'strong'], [11, 'strong'], [12, 'crushing'], [15, 'crushing'], [16, 'devastating'], [30, 'devastating']];
  for (const [m, id] of cases) assert.equal(AM.tierForMargin(m).id, id, `M=${m}`);
});

test('tier rewards: damage percent and effect counts (solid 1 minor, strong 2 minor, crushing major+minor, devastating 2 major)', () => {
  const t = id => AM.DEFAULTS.tiers.find(x => x.id === id);
  assert.deepEqual([t('glancing').dmgPct, t('hit').dmgPct, t('solid').dmgPct, t('strong').dmgPct, t('crushing').dmgPct, t('devastating').dmgPct], [50, 100, 125, 150, 200, 250]);
  assert.deepEqual(['solid', 'strong', 'crushing', 'devastating'].map(id => [t(id).minor, t(id).major]), [[1, 0], [2, 0], [1, 1], [0, 2]]);
  assert.deepEqual(['fumble', 'miss', 'glancing', 'hit'].map(id => [t(id).minor, t(id).major]), [[0, 0], [0, 0], [0, 0], [0, 0]]);
});

test('natural 1 always fumbles; natural 20 always hits and crits, higher tiers are kept', () => {
  const one = R(1, 30, 5); assert.equal(one.tierId, 'fumble'); assert.equal(one.hit, false); assert.equal(one.fumble, true);
  const twenty = R(20, 0, 40); assert.equal(twenty.hit, true); assert.equal(twenty.crit, true); assert.equal(twenty.tierId, 'hit'); assert.equal(twenty.dmgPct, 100);
  const big = R(20, 10, 10); assert.equal(big.tierId, 'devastating'); assert.equal(big.crit, true);
  assert.equal(R(19, 0, 10).crit, false);
  assert.equal(R(2, 0, 30).tierId, 'fumble'); // margin -28 with no natural 1
});

test('damage scaling: percent of the total, glancing rounds down, a hit always does at least 1, a miss does none', () => {
  assert.equal(AM.scaleDamage(10, R(15, 0, 15)), 10);              // M 0: hit
  assert.equal(AM.scaleDamage(10, R(12, 0, 15)), 5);               // M -3: glancing
  assert.equal(AM.scaleDamage(7, R(12, 0, 15)), 3);                // 3.5 rounds down
  assert.equal(AM.scaleDamage(1, R(12, 0, 15)), 1);                // floor of 0.5 is 0 -> at least 1
  assert.equal(AM.scaleDamage(8, R(19, 0, 15)), 10);               // solid x1.25
  assert.equal(AM.scaleDamage(8, R(15, 9, 15)), 12);               // strong x1.5
  assert.equal(AM.scaleDamage(8, R(15, 13, 15)), 16);              // crushing x2
  assert.equal(AM.scaleDamage(8, R(15, 17, 15)), 20);              // devastating x2.5
  assert.equal(AM.scaleDamage(8, R(10, 0, 18)), 0);                // clean miss
});

test('weapon classes come from the attack name', () => {
  const c = (n, o) => AM.attackClassesOf(n, o);
  assert.ok(c('Rapier +1').includes('blade') && c('Rapier +1').includes('light') && c('Rapier +1').includes('melee'));
  assert.ok(c('Greataxe').includes('axe') && c('Greataxe').includes('heavy'));
  assert.ok(c('Warhammer').includes('blunt'));
  assert.ok(c('Longbow').includes('ranged') && !c('Longbow').includes('melee'));
  assert.ok(c('Glaive').includes('pole') && c('Glaive').includes('heavy'));
  assert.ok(c('Whip').includes('whip'));
  assert.ok(c('Bite').includes('natural') && c('Bite').includes('melee'));
  assert.ok(c('Tentacle').includes('natural'));
  assert.ok(c('Unarmed Strike', { unarmed: true }).includes('unarmed'));
  assert.ok(c('Javelin').includes('thrown'));
  assert.ok(c('Greatsword').includes('blade') && c('Greatsword').includes('heavy'));
});

test('every kind of attack has plenty of minor and major options, and every effect is well formed', () => {
  const sets = [['Longsword'], ['Rapier'], ['Greataxe'], ['Handaxe'], ['Mace'], ['Maul'], ['Quarterstaff'], ['Spear'], ['Halberd'], ['Whip'], ['Longbow'], ['Light Crossbow'], ['Sling'], ['Javelin'], ['Bite'], ['Claw'], ['Slam'], ['Unarmed Strike', { unarmed: true }]];
  for (const [n, o] of sets) {
    const cl = AM.attackClassesOf(n, o);
    assert.ok(AM.effectOptions('minor', cl).length >= 14, `${n} minor: ${AM.effectOptions('minor', cl).length}`);
    assert.ok(AM.effectOptions('major', cl).length >= 12, `${n} major: ${AM.effectOptions('major', cl).length}`);
    assert.ok(AM.effectOptions('fumble', cl).length >= 6, `${n} fumble`);
  }
  const seen = new Set();
  for (const k of ['minor', 'major', 'fumble']) for (const e of AM.DEFAULTS[k]) {
    assert.ok(e.id && e.name && e.text.length > 12, e.id); assert.ok(!seen.has(k + e.id), 'duplicate ' + e.id); seen.add(k + e.id);
  }
  assert.ok(AM.DEFAULTS.minor.length >= 40 && AM.DEFAULTS.major.length >= 30);
});

test('suggested effects match the tier, are distinct and fit the weapon', () => {
  const cl = AM.attackClassesOf('Longbow');
  const dev = AM.suggestEffects(R(15, 17, 15), cl); assert.equal(dev.length, 2); assert.ok(dev.every(e => e.kind === 'major'));
  assert.notEqual(dev[0].id, dev[1].id);
  const cr = AM.suggestEffects(R(15, 13, 15), cl); assert.deepEqual(cr.map(e => e.kind), ['major', 'minor']);
  const st = AM.suggestEffects(R(15, 9, 15), cl); assert.deepEqual(st.map(e => e.kind), ['minor', 'minor']);
  const so = AM.suggestEffects(R(19, 0, 15), cl); assert.deepEqual(so.map(e => e.kind), ['minor']);
  assert.deepEqual(AM.suggestEffects(R(15, 0, 15), cl), []);
  assert.deepEqual(AM.suggestEffects(R(10, 0, 18), cl), []);
  const fu = AM.suggestEffects(R(1, 5, 15), cl); assert.equal(fu.length, 1); assert.equal(fu[0].kind, 'fumble');
  for (let i = 0; i < 200; i++) for (const e of AM.suggestEffects(R(15, 17, 15), cl)) assert.ok(AM.effectOptions('major', cl).some(o => o.id === e.id));
  // a bow never gets "pull the target toward you" and a sword never gets a ranged shot effect
  const sword = AM.effectOptions('minor', AM.attackClassesOf('Longsword')).map(e => e.id);
  assert.ok(!sword.includes('pinning') && !sword.includes('steadyaim') && sword.includes('nick'));
});

test('swapping an effect keeps the slot kind and only accepts fitting options', () => {
  const cl = AM.attackClassesOf('Longsword');
  const picks = AM.suggestEffects(R(15, 13, 15), cl);
  const swapped = AM.swapEffect(picks, 0, 'bleed', cl);
  assert.equal(swapped[0].id, 'bleed'); assert.equal(swapped[0].kind, 'major'); assert.equal(swapped[1].id, picks[1].id);
  assert.equal(AM.swapEffect(picks, 0, 'pinning', cl)[0].id, picks[0].id);
  assert.equal(AM.swapEffect(picks, 0, 'nick', cl)[0].id, picks[0].id); // a minor option cannot fill a major slot
});

test('table rows and tier description', () => {
  const rows = AM.tableRows();
  assert.equal(rows.length, 8); assert.equal(rows[0].range, '≤ -10'); assert.equal(rows[7].range, '≥ 16'); assert.equal(rows[3].range, '0 to 3');
  assert.match(AM.describeTier(R(15, 13, 15)), /Crushing hit — 200% damage, 1 minor, 1 major/);
  assert.equal(AM.describeTier(R(10, 0, 18)), 'Clean miss');
});
