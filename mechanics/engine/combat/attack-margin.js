// The attack margin engine (data: mechanics/data/attack-margin-default.js, overview: docs/ATTACK_MARGIN.md).
//
//   M = d20 + attack modifiers - defender AC  ->  a tier  ->  damage percent + minor/major effects
//
// Pure functions, no DOM. Used by the player weapon popup, the DM's pending-attack panel, the Combat tab's
// monster attacks and the Battle Field tab, so a hit means the same thing everywhere.
import { DEFAULT_ATTACK_MARGIN } from '../../data/attack-margin-default.js';
import { weaponScalingKind } from '../../../game-engine.js';

export const DEFAULTS = DEFAULT_ATTACK_MARGIN;

export function attackMargin(d20, toHit, ac) { return (d20 | 0) + (toHit | 0) - (ac | 0); }

export function tierForMargin(m, cfg = DEFAULTS) {
  return cfg.tiers.find(t => (t.min == null || m >= t.min) && (t.max == null || m <= t.max)) || cfg.tiers[cfg.tiers.length - 1];
}
const tierById = (id, cfg = DEFAULTS) => cfg.tiers.find(t => t.id === id);

// -> { margin, tier, tierId, label, hit, crit, fumble, dmgPct, minor, major, forced }
// A natural 1 is always a fumble (no hit, no damage). A natural 20 always hits and crits: if the margin alone would
// have been a miss or a glancing blow, it counts as a plain Hit; a higher tier is kept.
export function resolveAttack({ d20, toHit, ac, cfg = DEFAULTS }) {
  const margin = attackMargin(d20, toHit, ac);
  let tier = tierForMargin(margin, cfg), forced = null;
  const crit = d20 === 20;
  if (d20 === 1) { tier = tierById('fumble', cfg); forced = 'natural 1'; }
  else if (crit && !(tier.hit && tier.dmgPct >= 100)) { tier = tierById('hit', cfg); forced = 'natural 20'; }
  return { margin, tier, tierId: tier.id, label: tier.label, hit: !!tier.hit, crit: crit && tier.hit, fumble: !!tier.fumble, dmgPct: tier.dmgPct, minor: tier.minor || 0, major: tier.major || 0, forced };
}

// Normal damage (dice + modifiers, already doubled-dice on a crit) -> damage after the tier. A hit always does at least 1.
export function scaleDamage(total, result) {
  if (!result || !result.hit) return 0;
  const raw = total * result.dmgPct / 100;
  const out = result.tier && result.tier.round === 'down' ? Math.floor(raw) : Math.round(raw);
  return total > 0 ? Math.max(1, out) : 0;
}

// ---------------------------------------------------------------- weapon classes
// What an attack is, so effects can fit it: blade, axe, blunt, pole, whip, staff, ranged, thrown, natural, unarmed, heavy, light,
// plus 'melee' or 'ranged'. `name` is a weapon/attack name ("Rapier +1", "Greataxe", "Bite", "Longbow").
const NATURAL = /\b(bite|claw|talon|slam|gore|tail|tentacle|sting|stinger|fist|hoof|horn|wing|beak|pincer|rake|maul|touch|tendril|spike|ram|tusk|trample|rend|smash|kick|punch|constrict|swallow|engulf)s?\b/i;
const KIND_CLASSES = {
  dagger: ['blade', 'light', 'thrown'], rapier: ['blade', 'light'], lightblade: ['blade', 'light'], sword: ['blade'], sickle: ['blade', 'light'],
  axe: ['axe'], greatweapon: ['heavy'], mace: ['blunt'], hammer: ['blunt'], flail: ['blunt'], club: ['blunt', 'light'], pick: ['blunt'],
  quarterstaff: ['staff', 'blunt'], spear: ['pole', 'thrown'], polearm: ['pole', 'heavy'], whip: ['whip', 'light'],
  bow: ['ranged'], crossbow: ['ranged'], sling: ['ranged'], blowgun: ['ranged'], dart: ['ranged', 'thrown'], thrown: ['ranged', 'thrown'], net: ['ranged'],
  natural: ['natural'], onehanded: [], twohanded: ['heavy'],
};
export function attackClassesOf(name, opts = {}) {
  const n = String(name || '');
  const out = new Set();
  if (opts.unarmed || /\bunarmed|\bfist\b|punch/i.test(n)) { out.add('unarmed'); out.add('natural'); out.add('melee'); return [...out]; }
  const kind = weaponScalingKind({ name: n, desc: '' });
  const weaponish = !NATURAL.test(n) || /sword|axe|mace|hammer|spear|bow|dagger|club|staff|flail|whip|lance|pike|glaive|halberd|scimitar|rapier|javelin|sling|trident/i.test(n);
  if (weaponish) {
    (KIND_CLASSES[kind] || []).forEach(c => out.add(c));
    if (/great.?sword|zweihander|claymore/i.test(n)) out.add('blade');
    if (/great.?axe/i.test(n)) out.add('axe');
    if (/\bmaul\b|great.?hammer|great.?club/i.test(n)) out.add('blunt');
  } else out.add('natural');
  if (!out.size && NATURAL.test(n)) out.add('natural');
  if (opts.heavy) out.add('heavy');
  if (opts.light) out.add('light');
  out.add(out.has('ranged') && !/\bthrown|javelin|dart/i.test(n) ? 'ranged' : (out.has('ranged') ? 'ranged' : 'melee'));
  if (opts.ranged) { out.delete('melee'); out.add('ranged'); }
  return [...out];
}

// ---------------------------------------------------------------- effects
export function effectOptions(kind, classes, cfg = DEFAULTS) {
  const list = kind === 'minor' ? cfg.minor : kind === 'major' ? cfg.major : cfg.fumble;
  const cl = new Set(classes || []);
  return list.filter(e => !e.classes || e.classes.some(c => cl.has(c)));
}
// Default picks for a result: distinct effects, random from the fitting options. -> [{ kind, id, name, text }]
export function suggestEffects(result, classes, rng = Math.random, cfg = DEFAULTS) {
  if (!result) return [];
  const picks = [], used = new Set();
  const take = (kind, n) => {
    const pool = effectOptions(kind, classes, cfg).filter(e => !used.has(e.id));
    for (let i = 0; i < n && pool.length; i++) { const e = pool.splice(Math.floor(rng() * pool.length), 1)[0]; used.add(e.id); picks.push({ kind, id: e.id, name: e.name, text: e.text }); }
  };
  if (result.fumble) { take('fumble', 1); return picks; }
  take('major', result.major || 0);
  take('minor', result.minor || 0);
  return picks;
}
// Replace one pick by option id (keeps the others); unknown ids leave things unchanged.
export function swapEffect(picks, index, id, classes, cfg = DEFAULTS) {
  const cur = picks[index]; if (!cur) return picks;
  const opt = effectOptions(cur.kind, classes, cfg).find(e => e.id === id);
  if (!opt) return picks;
  const out = picks.slice(); out[index] = { kind: cur.kind, id: opt.id, name: opt.name, text: opt.text };
  return out;
}
export function describeTier(result) {
  if (!result) return '';
  const bits = [];
  if (!result.hit) return result.label;
  if (result.dmgPct !== 100) bits.push(`${result.dmgPct}% damage`);
  if (result.minor) bits.push(`${result.minor} minor`);
  if (result.major) bits.push(`${result.major} major`);
  return `${result.label}${bits.length ? ' — ' + bits.join(', ') : ''}`;
}
// The whole table as rows (for docs and the in-app reference).
export function tableRows(cfg = DEFAULTS) {
  return cfg.tiers.map(t => ({ id: t.id, label: t.label, range: t.min == null ? `≤ ${t.max}` : t.max == null ? `≥ ${t.min}` : `${t.min} to ${t.max}`, hit: t.hit, dmgPct: t.dmgPct, minor: t.minor || 0, major: t.major || 0 }));
}
