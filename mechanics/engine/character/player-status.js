// Player status: everything that is active on a character RIGHT NOW, in one place a player can read at a glance.
//   timed effects (potions, activated powers, effects the DM applied), transformations, conditions and debuffs,
//   always-on feats and unlocked hidden powers, resistances / immunities / vulnerabilities / advantages from equipped gear,
//   senses and movement modes, and every stat the gear or an effect is currently changing.
// Pure functions (no DOM): the Inventory tab and the DM's player card both render the result (player-status.js).
// Gear is read through the same text the character sheet already uses (itemMechanicsText), so the two never disagree.
import { itemMechanicsText, uniqueEquippedSlotEntries, extractStatDeltasFromText } from '../../../game-engine.js';

export const DAMAGE_TYPES = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];
export const CONDITION_NAMES = ['blinded', 'charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious', 'exhaustion', 'slowed', 'cursed', 'confused', 'silenced', 'doomed', 'marked', 'compelled', 'fatigued', 'diseased', 'bleeding'];
const OFFENSIVE = /\b(?:target|targets|creature|creatures|enemy|enemies|opponent|attacker|must succeed|saving throw (?:or|to resist))\b/i;
const strip = s => String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const clauses = text => strip(text).split(/(?<=[.;])\s+(?=[A-Z0-9"'+-])/).map(c => c.trim()).filter(Boolean);
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const typesIn = seg => DAMAGE_TYPES.filter(t => new RegExp('\\b' + t + '\\b', 'i').test(seg));

// ---------------------------------------------------------------- gear / effect text -> defensive and utility facts
export function parseDefenses(rawText) {
  const out = { resist: [], immune: [], vulnerable: [], advantage: [], disadvantage: [], senses: [], movement: [], restrictions: [], regeneration: [] };
  for (const clause of clauses(rawText)) {
    const offensive = OFFENSIVE.test(clause) && !/\b(?:you|the bearer|bearer|wearer)\b/i.test(clause) && !/^(?:resistance|immun|advantage)/i.test(clause);
    let m;
    // resistance
    const rr = /\bresist(?:ance|ant)\s+(?:to|against)\s+([^.;]*)/gi;
    while (!offensive && (m = rr.exec(clause))) {
      const seg = m[1], nonmagical = /non-?magical/i.test(seg) || /non-?magical/i.test(clause);
      const list = /\b(?:all|any)\s+damage\b/i.test(seg) ? ['all'] : typesIn(seg);
      list.forEach(t => out.resist.push({ type: t, nonmagical, note: /\b(?:while|when|if|against)\b/i.test(clause) && !/^resistance to /i.test(clause) ? clause : '' }));
    }
    // immunity (damage, conditions, other)
    const ri = /\bimmun(?:e|ity)\s+(?:to|against|from)\s+([^.;]*)/gi;
    while (!offensive && (m = ri.exec(clause))) {
      m[1].split(/,|\band\b|\bor\b/).map(t => t.trim()).filter(Boolean).forEach(tok => {
        const low = tok.toLowerCase().replace(/^(?:the|being|all)\s+/, '').replace(/\s+condition$/, '');
        const dt = typesIn(low);
        if (dt.length && /damage|^\w+$/.test(low) && DAMAGE_TYPES.includes(low.replace(/\s+damage$/, ''))) out.immune.push({ kind: 'damage', what: low.replace(/\s+damage$/, '') });
        else if (CONDITION_NAMES.includes(low) || CONDITION_NAMES.includes(low.replace(/ed$/, 'ed'))) out.immune.push({ kind: 'condition', what: low });
        else if (/^(?:fear|charm|disease|poison|sleep|magical sleep)$/.test(low)) out.immune.push({ kind: 'condition', what: low });
        else out.immune.push({ kind: 'other', what: tok.replace(/^(?:the|being)\s+/i, '') });
      });
    }
    const rc = /\b(?:can(?:not|'t)|cannot)\s+be\s+((?:charmed|frightened|paralyzed|blinded|stunned|poisoned|petrified|surprised|knocked prone|restrained|grappled|silenced|deafened)(?:\s*(?:,|or|and)\s*(?:charmed|frightened|paralyzed|blinded|stunned|poisoned|petrified|surprised|restrained|grappled|silenced|deafened))*)/gi;
    while (!offensive && (m = rc.exec(clause))) m[1].split(/,|\bor\b|\band\b/).map(t => t.trim()).filter(Boolean).forEach(t => out.immune.push({ kind: 'condition', what: t.toLowerCase() }));
    // vulnerability
    const rv = /\bvulnerab(?:le|ility)\s+to\s+([^.;]*)/gi;
    while (!offensive && (m = rv.exec(clause))) typesIn(m[1]).forEach(t => out.vulnerable.push({ type: t }));
    // advantage / disadvantage the bearer has
    if (!offensive && (m = /\badvantage on ([^.;]+)/i.exec(clause)) && !/disadvantage on/i.test(clause.slice(Math.max(0, m.index - 3), m.index + 3))) out.advantage.push({ text: 'Advantage on ' + m[1].trim() });
    if (!offensive && (m = /\bdisadvantage on ([^.;]+)/i.exec(clause))) out.disadvantage.push({ text: 'Disadvantage on ' + m[1].trim() });
    // senses and movement
    const rs = /\b(darkvision|truesight|blindsight|tremorsense)\b[^.;()]{0,25}?\(?(\d+)\s*(?:feet|ft)/gi;
    while ((m = rs.exec(clause))) out.senses.push({ name: cap(m[1].toLowerCase()), feet: +m[2] });
    const rm = /\b(fly(?:ing)?|swim(?:ming)?|climb(?:ing)?|burrow(?:ing)?)\s+speed(?:\s+of)?\s+(\d+)|\b(?:fly|swim|climb|burrow)(?:ing)?\s+(?:of\s+)?(\d+)\s*(?:feet|ft)/gi;
    while (!offensive && (m = rm.exec(clause))) { const mode = (m[1] || m[0]).toLowerCase().replace(/ing$/, '').replace(/^fly$/, 'fly'); out.movement.push({ mode: mode.startsWith('fl') ? 'fly' : mode.startsWith('swim') ? 'swim' : mode.startsWith('climb') ? 'climb' : 'burrow', feet: +(m[2] || m[3]) }); }
    // regeneration
    if (!offensive && (m = /\bregain(?:s)?\s+(\d+)\s+hit points?\s+at the start of (?:each|every|your)\s+turn/i.exec(clause))) out.regeneration.push({ hp: +m[1] });
    // restrictions the bearer suffers
    if (/^(?:the bearer|you|bearer)?\s*(?:can(?:not|'t)|cannot)\b/i.test(clause) && !/\bcan(?:not|'t) be\b/i.test(clause) && !offensive) out.restrictions.push({ text: clause.replace(/\.$/, '') });
  }
  return out;
}

// ---------------------------------------------------------------- timed / always-on effects
export function classifyEffect(text, name) {
  const t = strip(text);
  const form = (/transforms?\s+(?:into|to)\s+(?:an?\s+|the\s+)?([^.,;]+)/i.exec(t) || /\b(?:assumes?|takes?)\s+the\s+form\s+of\s+(?:an?\s+)?([^.,;]+)/i.exec(t) || /\b(?:turns?|becomes?)\s+(?:into\s+)?(?:an?\s+)(?!result)([^.,;]{3,40}?)\s+for\b/i.exec(t) || [])[1];
  const transformation = !!form || /\b(?:polymorph|shape\s*change|wild shape|true form|transformed)\b/i.test(t) || /\b(?:polymorph|shapechange|wild shape)\b/i.test(name || '');
  const negStat = /(?:^|[\s(])-\s?\d+\s+(?:to\s+)?[A-Z]/.test(t) || /\bdisadvantage on\b/i.test(t.replace(/\b(?:target|creature)\b[^.]*disadvantage/i, ''));
  const cond = CONDITION_NAMES.find(c => new RegExp('\\b' + c + '\\b', 'i').test(t) && !/\b(?:immun|cannot be|can't be|ends|removes?|cures?|against|resistan)\w*[^.]{0,40}\b' + c + '\\b/i.test(t) && !new RegExp('(?:immun\\w*|cannot be|removes?|cures?|ends?)[^.]{0,30}\\b' + c, 'i').test(t));
  const harmful = !!cond || negStat || /\b(?:cursed|haunted|drained|weakened|vulnerab\w+ to|loses?\s+\d|takes?\s+\d+d\d+\s+\w+\s+damage at the start)\b/i.test(t);
  const category = transformation ? 'transformation' : harmful ? (cond ? 'condition' : 'debuff') : 'buff';
  return { category, form: form ? strip(form).replace(/^an?\s+/i, '') : null, condition: cond || null };
}
const effectChips = text => {
  const stats = (extractStatDeltasFromText(text) || []).filter(d => d.amount);
  return { stats };
};

// ---------------------------------------------------------------- the whole status
// { sheet, slots, resolveItem, timedEffects, feats:[{name,text}], unlocks:[{name,text}], now }
export function buildPlayerStatus({ sheet, slots, resolveItem, timedEffects, feats, unlocks, now }) {
  now = now || Date.now();
  const defenses = { resist: new Map(), immune: new Map(), vulnerable: new Map(), advantage: [], disadvantage: [], restrictions: [] };
  const senses = new Map(), movement = new Map(), regen = [];
  const addDef = (parsed, source) => {
    parsed.resist.forEach(r => { const k = r.type + (r.nonmagical ? ':nm' : ''); const e = defenses.resist.get(k) || { type: r.type, nonmagical: r.nonmagical, note: '', sources: [] }; if (!e.sources.includes(source)) e.sources.push(source); if (r.note && !e.note) e.note = r.note; defenses.resist.set(k, e); });
    parsed.immune.forEach(r => { const k = r.kind + ':' + r.what; const e = defenses.immune.get(k) || { kind: r.kind, what: r.what, sources: [] }; if (!e.sources.includes(source)) e.sources.push(source); defenses.immune.set(k, e); });
    parsed.vulnerable.forEach(r => { const e = defenses.vulnerable.get(r.type) || { type: r.type, sources: [] }; if (!e.sources.includes(source)) e.sources.push(source); defenses.vulnerable.set(r.type, e); });
    parsed.advantage.forEach(a => { if (!defenses.advantage.some(x => x.text === a.text)) defenses.advantage.push({ text: a.text, source }); });
    parsed.disadvantage.forEach(a => { if (!defenses.disadvantage.some(x => x.text === a.text)) defenses.disadvantage.push({ text: a.text, source }); });
    parsed.restrictions.forEach(a => { if (!defenses.restrictions.some(x => x.text === a.text)) defenses.restrictions.push({ text: a.text, source }); });
    parsed.senses.forEach(s => { const e = senses.get(s.name); if (!e || s.feet > e.feet) senses.set(s.name, { name: s.name, feet: s.feet, source }); });
    parsed.movement.forEach(s => { const e = movement.get(s.mode); if (!e || s.feet > e.feet) movement.set(s.mode, { mode: s.mode, feet: s.feet, source }); });
    parsed.regeneration.forEach(r => regen.push({ hp: r.hp, source }));
  };

  // 1. equipped gear
  const gear = [];
  uniqueEquippedSlotEntries(slots || {}).forEach(([slotId, key]) => {
    const entry = resolveItem ? resolveItem(key) : null; if (!entry) return;
    const text = itemMechanicsText(entry.item);
    gear.push({ slotId, key, name: entry.item.name, rarity: entry.rarity });
    addDef(parseDefenses(text), entry.item.name);
  });

  // 2. timed effects, feats, unlocked hidden powers
  const rows = [];
  (timedEffects || []).forEach(e => {
    const remainingMs = e.permanent ? null : Math.max(0, (e.expiresAt || 0) - now);
    if (!e.permanent && remainingMs <= 0) return;
    const c = classifyEffect(e.text, e.name);
    addDef(parseDefenses(e.text), e.name);
    rows.push({ id: e.id, name: e.name, text: strip(e.text), rarity: e.rarity || 'common', remainingMs, expiresAt: e.permanent ? null : e.expiresAt, permanent: !!e.permanent, kind: 'timed', category: c.category, form: c.form, condition: c.condition, stats: effectChips(e.text).stats });
  });
  (feats || []).forEach(f => { const c = classifyEffect(f.text, f.name); addDef(parseDefenses(f.text), f.name); rows.push({ id: 'feat:' + f.name, name: f.name, text: strip(f.text), rarity: 'common', permanent: true, kind: 'feat', category: c.category === 'buff' ? 'always' : c.category, form: c.form, stats: effectChips(f.text).stats }); });
  (unlocks || []).forEach(u => { const c = classifyEffect(u.text, u.name); addDef(parseDefenses(u.text), u.name); rows.push({ id: 'unlock:' + u.name, name: u.name, text: strip(u.text), rarity: u.rarity || 'common', permanent: true, kind: 'unlock', category: c.category === 'buff' ? 'always' : c.category, form: c.form, stats: effectChips(u.text).stats }); });

  // 3. stat changes the sheet already computed (gear + effects)
  const stats = [];
  const push = (label, amount, sources) => { if (amount) stats.push({ label, amount, sources: [...new Set(sources || [])] }); };
  if (sheet) {
    Object.keys(sheet.abilities || {}).forEach(k => { const a = sheet.abilities[k]; if (a && a.bonus) push(k.toUpperCase(), a.bonus, (a.sources || []).map(s => s.itemName)); });
    if (sheet.ac) { const extra = (sheet.ac.sources || []).filter(s => !s.isBaseOverride && !/^Armor scaling/.test(s.itemName)); const amt = extra.reduce((n, s) => n + (s.amount || 0), 0); push('Armor Class', amt, extra.map(s => s.itemName)); }
    if (sheet.maxHp && sheet.maxHp.bonus) push('Max HP', sheet.maxHp.bonus, (sheet.maxHp.sources || []).map(s => s.itemName));
    if (sheet.speed && sheet.speed.bonus) push('Speed', sheet.speed.bonus, (sheet.speed.sources || []).map(s => s.itemName));
    Object.entries(sheet.otherStats || {}).forEach(([k, v]) => push(k, v.total, (v.sources || []).map(s => s.itemName)));
    if (sheet.profBoost && sheet.profBoost.total) push('Proficiency Bonus', sheet.profBoost.total, (sheet.profBoost.sources || []).map(s => s.itemName));
  }

  const by = c => rows.filter(r => r.category === c).sort((a, b) => (a.remainingMs == null ? 1e15 : a.remainingMs) - (b.remainingMs == null ? 1e15 : b.remainingMs));
  const status = {
    transformations: by('transformation'), buffs: by('buff'), debuffs: by('debuff').concat(by('condition')), always: by('always'),
    defenses: {
      resist: [...defenses.resist.values()], immune: [...defenses.immune.values()], vulnerable: [...defenses.vulnerable.values()],
      advantage: defenses.advantage, disadvantage: defenses.disadvantage, restrictions: defenses.restrictions,
    },
    senses: [...senses.values()], movement: [...movement.values()], regeneration: regen, stats, gear,
  };
  const n = status.defenses;
  status.counts = {
    transformations: status.transformations.length, buffs: status.buffs.length, debuffs: status.debuffs.length, always: status.always.length,
    resist: n.resist.length, immune: n.immune.length, vulnerable: n.vulnerable.length, advantage: n.advantage.length, disadvantage: n.disadvantage.length,
    senses: status.senses.length + status.movement.length, stats: stats.length,
  };
  status.empty = Object.values(status.counts).every(v => !v) && !regen.length && !n.restrictions.length;
  return status;
}

export function formatRemaining(ms) {
  if (ms == null) return 'until next day';
  const s = Math.ceil(ms / 1000); if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`; if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`; return `${s}s`;
}
