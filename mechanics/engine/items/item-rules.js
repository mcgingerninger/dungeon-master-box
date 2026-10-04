// The Item Rules engine — scores items by modifier weight, derives rarity and gp value from that
// weight, and checks every item against the DM's rules. Pure functions, no DOM: used by the app (via
// the window bridge in the monolith's module script), the catalog fixer and the tests.
// Config shape and defaults: mechanics/data/item-rules-default.js. Overview: docs/ITEM_RULES.md.
import { DEFAULT_ITEM_RULES, GP_HARD_CAP } from '../../data/item-rules-default.js';

export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'superrare', 'legendary', 'celestial'];

// ---------- config ----------
export function cloneRules(cfg) { return JSON.parse(JSON.stringify(cfg || DEFAULT_ITEM_RULES, (k, v) => (v === Infinity ? 1e9 : v))); }
// Deep-merge a (possibly partial) saved/imported config over the defaults. Unknown keys are dropped
// and malformed numbers fall back to the default, so a hand-edited JSON file can't break generation.
export function mergeItemRules(override, base = DEFAULT_ITEM_RULES) {
  const out = cloneRules(base);
  if (!override || typeof override !== 'object') return out;
  const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const mergeNumMap = (target, src) => { if (src && typeof src === 'object') Object.keys(src).forEach(k => { target[k] = num(src[k], target[k]); }); };
  const w = override.weights || {};
  ['scalar', 'conditions', 'inflict', 'drawbacks', 'affixes', 'kinds', 'activation'].forEach(g => { if (w[g]) { out.weights[g] = out.weights[g] || {}; mergeNumMap(out.weights[g], w[g]); } });
  if (override.rarityBands) RARITY_ORDER.forEach(r => { const b = override.rarityBands[r]; if (Array.isArray(b) && b.length === 2) out.rarityBands[r] = [num(b[0], out.rarityBands[r][0]), num(b[1], out.rarityBands[r][1])]; });
  if (override.priceBands) RARITY_ORDER.forEach(r => { const b = override.priceBands[r]; if (Array.isArray(b) && b.length === 2) out.priceBands[r] = [num(b[0], out.priceBands[r][0]), Math.min(GP_HARD_CAP, num(b[1], out.priceBands[r][1]))]; });
  if (Array.isArray(override.rules)) override.rules.forEach(r => {
    const t = out.rules.find(x => x.id === (r && r.id));
    if (!t) return;
    if (typeof r.enabled === 'boolean') t.enabled = r.enabled;
    if (r.severity === 'error' || r.severity === 'warn') t.severity = r.severity;
    if (r.params && typeof r.params === 'object') Object.keys(t.params).forEach(k => { if (Array.isArray(t.params[k])) { if (Array.isArray(r.params[k])) t.params[k] = r.params[k].map(String); } else t.params[k] = num(r.params[k], t.params[k]); });
  });
  return out;
}
export function ruleOf(cfg, id) { return (cfg.rules || []).find(r => r.id === id); }

// ---------- text helpers ----------
const ENTITIES = { '&quot;': '"', '&#39;': "'", '&apos;': "'", '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
export function plainText(s) {
  return String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/&(?:quot|#39|apos|amp|lt|gt|nbsp);/g, m => ENTITIES[m]).replace(/[−–]/g, '-').replace(/\s+/g, ' ').trim();
}
const avgDice = s => { const m = String(s).match(/(\d+)d(\d+)/); return m ? (+m[1]) * ((+m[2] + 1) / 2) : 0; };
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ALIASES = { 'AC': 'Armor Class', 'Max HP': 'Maximum Hit Points', 'Hit Points': 'Maximum Hit Points', 'Speed': 'Movement Speed', 'Initiative': 'Initiative', 'Saves': 'Saving Throws' };

// Clause = one sentence-ish unit. Splits on ". " and ";" but keeps decimals/dice intact.
function clauses(text) { return text.split(/(?<=[.;])\s+(?=[A-Z0-9"'+-])/).map(s => s.trim()).filter(Boolean); }

function activationFactor(clause, act) {
  const temporary = /\bfor\s+(?:\d+|an?|one)\s*(?:minute|hour|day|round)s?\b/i.test(clause) || /\b\d+\s*[×x]\s*per\b|\bonce per\b|\busable\b|\bper (?:long|short) rest\b|\bper day\b|\bas an action\b|\bas a bonus action\b|\bexpend\b/i.test(clause);
  if (!temporary) return 1;
  const um = clause.match(/(\d+)\s*[×x]\s*per/i);
  const uses = um ? parseInt(um[1], 10) : 1;
  let bonus = 0;
  for (const [re, b] of ACTIVATION_DURATIONS) if (re.test(clause)) bonus = Math.max(bonus, b);
  return Math.min(act.cap, act.base + act.perExtraUse * (uses - 1) + bonus);
}
// duration bonuses live in code (RegExp doesn't serialize to JSON) — tuned with the same intent as the
// config's activation block.
const ACTIVATION_DURATIONS = [[/\b(?:1|one) minute\b/i, 0], [/\b(?:5|10) minutes\b/i, 0.05], [/\b(?:30 minutes|1 hour|one hour)\b/i, 0.1], [/\b(?:2|4|8) hours\b/i, 0.2], [/\b24 hours\b|\b1 day\b/i, 0.3]];

const ATTACK_STATS = ['Attack Bonus', 'Attack Rolls', 'Spell Attack'];

// -> { components:[{ kind, label, weight, touches?, stat?, amount? }], total, good, bad }
export function scoreText(rawText, cfg = DEFAULT_ITEM_RULES, hints = {}) {
  const text = plainText(rawText);
  const W = cfg.weights;
  const comps = [];
  const push = (c) => { if (c.weight) comps.push(c); return c; };
  const scalarNames = Object.keys(W.scalar).sort((a, b) => b.length - a.length);
  const scalarRe = new RegExp('([+-]\\s?\\d+(?:\\.\\d+)?)\\s+(?:bonus\\s+)?(?:to\\s+)?(?:your\\s+)?(' + scalarNames.map(escRe).join('|') + '|AC|Max HP)\\b', 'gi');
  const condNames = Object.keys(W.conditions).sort((a, b) => b.length - a.length);

  for (const clause of clauses(text)) {
    const factor = activationFactor(clause, W.activation);
    const offensive = /\binflicts?\b|\bon one target\b|\bon a hit\b|\btarget'?s?\b.*\b(?:takes?|must)\b|\bcreatures? (?:in|within)\b/i.test(clause) && !/\bthe bearer (?:suffers|is)\b/i.test(clause);
    const selfHarm = /\bthe bearer suffers\b|\bwhile attuned,? the bearer suffers\b|\bcursed\b|\bcannot remove\b/i.test(clause);
    const toAllies = /\bgrant\b[^.]*\b(?:allies|ally)\b|\bwilling allies?\b/i.test(clause);
    const startCount = comps.length;
    let consumed = clause;

    // 1) "+N Stat" / "-N Stat"
    scalarRe.lastIndex = 0; let m;
    const seenStats = new Set();   // "+3 AC (… total +5 AC from this shield)" is one boost stated twice
    while ((m = scalarRe.exec(clause)) !== null) {
      const amount = parseFloat(m[1].replace(/\s/g, ''));
      let stat = m[2]; stat = ALIASES[stat] || Object.keys(W.scalar).find(k => k.toLowerCase() === stat.toLowerCase()) || stat;
      // "+5 to Dexterity (Sleight of Hand) checks" is a check bonus, not a +5 to the Dexterity score
      if (/^(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)$/.test(stat) && /^\s*(?:\([^)]*\)\s*)?checks?\b/i.test(clause.slice(m.index + m[0].length))) {
        push({ kind: 'skill', stat: 'Skill Checks', amount, label: `${amount > 0 ? '+' : ''}${amount} ${stat} checks`, weight: round(amount * (W.scalar['Skill Checks'] ?? 0.4) * factor * (amount < 0 ? -W.activation.penaltyFactor : 1)) });
        consumed = consumed.replace(m[0], ' ');
        continue;
      }
      if (seenStats.has(stat)) continue;
      seenStats.add(stat);
      const per = W.scalar[stat] != null ? W.scalar[stat] : 0.5;
      let w = Math.abs(amount) * per;
      const touches = ATTACK_STATS.includes(stat) ? 'attack' : undefined;
      if (amount < 0) {
        if (offensive && !selfHarm) w = w * 0.5 * factor;           // a penalty you put on an enemy
        else w = -w * W.activation.penaltyFactor * (factor < 1 ? factor : 1);
      } else {
        w = w * factor * (toAllies ? W.activation.alliesFactor : 1);
      }
      push({ kind: 'stat', stat, amount, label: `${amount > 0 ? '+' : ''}${amount} ${stat}`, weight: round(w), touches });
      consumed = consumed.replace(m[0], ' ');
    }
    // 1b) weapon-style phrases: "+N to attack and damage rolls", "+N to damage rolls", "+N to attack rolls"
    let am;
    const bothRe = /([+-]\d+)\s+(?:bonus\s+)?to\s+attack\s+and\s+damage(?:\s+rolls?)?|([+-]\d+)\s+attack\s+and\s+damage/gi;
    while ((am = bothRe.exec(clause)) !== null) {
      const n = parseInt(am[1] || am[2], 10);
      push({ kind: 'stat', stat: 'Attack Rolls', amount: n, label: `${n > 0 ? '+' : ''}${n} to attack rolls`, weight: round(n * (W.scalar['Attack Rolls'] ?? 1) * factor), touches: 'attack' });
      push({ kind: 'stat', stat: 'Damage Dealt', amount: n, label: `${n > 0 ? '+' : ''}${n} to damage rolls`, weight: round(n * (W.scalar['Damage Dealt'] ?? 1.2) * factor) });
      consumed = consumed.replace(am[0], ' ');
    }
    const atkRe = /([+-]\d+)\s+(?:bonus\s+)?to\s+(?:all\s+)?attack(?:\s+rolls?)?\b(?!\s+and\s+damage)|([+-]\d+)\s+to\s+hit\b/gi;
    while ((am = atkRe.exec(consumed)) !== null) {
      const n = parseInt(am[1] || am[2], 10);
      push({ kind: 'stat', stat: 'Attack Rolls', amount: n, label: `${n > 0 ? '+' : ''}${n} to attack rolls`, weight: round((n > 0 ? 1 : -W.activation.penaltyFactor) * Math.abs(n) * (W.scalar['Attack Rolls'] ?? 1) * factor), touches: 'attack' });
      consumed = consumed.replace(am[0], ' ');
    }
    const dmgRe = /([+-]\d+)\s+(?:bonus\s+)?to\s+(?:all\s+)?damage(?:\s+rolls?)?\b/gi;
    while ((am = dmgRe.exec(consumed)) !== null) {
      const n = parseInt(am[1], 10);
      push({ kind: 'stat', stat: 'Damage Dealt', amount: n, label: `${n > 0 ? '+' : ''}${n} to damage rolls`, weight: round((n > 0 ? 1 : -W.activation.penaltyFactor) * Math.abs(n) * (W.scalar['Damage Dealt'] ?? 1.2) * factor) });
      consumed = consumed.replace(am[0], ' ');
    }
    // 1c) "+N to <Skill> checks"
    const skillRe = /([+-]\d+)\s+(?:bonus\s+)?(?:to\s+)?(?:\w+\s+)?\(?(?:[A-Z][a-z]+(?:\s+of\s+Hand)?)\)?\s+checks?\b/g;
    // (skills are in W.scalar and handled by scalarRe when written "+1 Stealth"; "to ... checks" prose scores as a generic clause)

    // 2) named beneficial conditions
    for (const name of condNames) {
      if (clause.includes(name) && !selfHarm) push({ kind: 'condition', label: name, weight: round(W.conditions[name] * factor * (toAllies ? W.activation.alliesFactor : 1)) });
    }
    // 2b) generic resistance / immunity / advantage the named list didn't cover
    const named = condNames.filter(n => clause.includes(n));
    const generic = (re, key, label) => { const hits = clause.match(re) || []; const covered = named.filter(n => new RegExp(label, 'i').test(n)).length; for (let i = 0; i < Math.max(0, hits.length - covered); i++) push({ kind: 'condition', label: `${label}`, weight: round(W.kinds[key] * factor) }); };
    if (!selfHarm && !offensive) {
      generic(/\bresistance to\b|\bresistant to\b|\bresist\b/gi, 'resistance', 'Resistance');
      generic(/\bimmun(?:e|ity) to\b|\bimmune\b/gi, 'immunity', 'Immunity');
      generic(/\badvantage on\b|\bhave advantage\b/gi, 'advantageClause', 'Advantage');
    }
    // 3) inflicted conditions (offensive) and drawbacks (self-harm)
    if (offensive && /\binflicts?\b/i.test(clause)) {
      const inflict = Object.keys(W.inflict).sort((a, b) => b.length - a.length).find(k => new RegExp('\\b' + escRe(k) + '\\b', 'i').test(clause));
      push({ kind: 'inflict', label: `inflicts ${inflict || 'a condition'}`, weight: round((inflict ? W.inflict[inflict] : 2.5) * factor) });
    }
    if (selfHarm) {
      const dk = Object.keys(W.drawbacks).sort((a, b) => b.length - a.length).find(k => clause.toLowerCase().includes(k.toLowerCase()));
      push({ kind: 'drawback', label: dk || 'a curse', weight: dk ? W.drawbacks[dk] : -1.5 });
    }
    // 4) extra damage dice
    const diceRe = /(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+(?:extra\s+)?([a-z]+)?\s*damage\b/gi;
    while ((m = diceRe.exec(clause)) !== null) {
      if (/\bsave\b|\btakes?\b|\bfor half\b/i.test(clause.slice(Math.max(0, m.index - 40), m.index)) && !/extra|additional|\+/.test(clause.slice(Math.max(0, m.index - 12), m.index + m[0].length))) continue;
      push({ kind: 'damage', label: `${m[1].replace(/\s/g, '')} ${m[2] || ''} damage`.replace(/\s+/g, ' '), weight: round(avgDice(m[1]) * W.kinds.extraDamageDicePerAvg * (/\bonce per turn\b|\bon a (?:hit|critical hit)\b/i.test(clause) ? 1 : factor)) });
    }
    // 5) proficiency bonus, spell grants, charges, flight, summon/transform
    let pm; const profRe = /\+(\d+)\s+(?:to\s+)?(?:your\s+)?proficiency bonus/gi;
    while ((pm = profRe.exec(clause)) !== null) push({ kind: 'proficiency', stat: 'Proficiency Bonus', amount: +pm[1], label: `+${pm[1]} proficiency bonus`, weight: round(+pm[1] * W.kinds.proficiencyPerPoint) });
    const spellRe = /(?:cast|casts)\s+([A-Z][A-Za-z' ]+?)(?:\s*\(|\.|,|\s+(?:once|as|at|without|using|with))/g; let sm; let spells = 0;
    while ((sm = spellRe.exec(clause)) !== null) { spells++; push({ kind: 'spell', label: `cast ${sm[1].trim()}`, weight: round(W.kinds.spellGrant * factor) }); }
    if (!spells) { const list = clause.match(/\b[A-Z][a-z']+(?: [A-Za-z']+){0,3}\s+\((\d)\)/g) || []; if (/^spells?:/i.test(clause) || list.length > 1) list.forEach(l => push({ kind: 'spell', label: l, weight: round(W.kinds.spellGrant * 0.5) })); }
    const cm = clause.match(/\b(\d+)\s+charges?\b/i); if (cm) push({ kind: 'charges', label: `${cm[1]} charges`, weight: round(Math.min(+cm[1], 20) * W.kinds.chargePerCharge) });
    if (/\b(?:fly(?:ing)? speed|you can fly|gain a fly)\b/i.test(clause) && !/Fly Speed \(feet\)/.test(clause)) push({ kind: 'flight', label: 'flight', weight: W.kinds.flight });
    if (/\bsummons?\b|\bconjure/i.test(clause) && !offensive) push({ kind: 'summon', label: 'summons a creature', weight: round(W.kinds.summon * factor) });
    if (/\btransforms? into\b|\bbecomes? an?\b/i.test(clause)) push({ kind: 'transform', label: 'transforms the bearer', weight: round(W.kinds.transform * factor) });
    if (/Grants the ability to use\b/i.test(clause)) push({ kind: 'monsterSkill', label: 'monster ability', weight: round(W.kinds.monsterSkill * factor) });
    // 5b) catalog-style effects the numeric patterns above can't see
    const setStat = clause.match(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)(?: score)?\s+(?:becomes|is set to|set to|changes to)\s+(\d+)/i) || clause.match(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) score of (\d+)\b/i);
    if (setStat && +setStat[2] > 10) push({ kind: 'stat', stat: setStat[1], amount: Math.floor((+setStat[2] - 10) / 2), label: `${setStat[1]} set to ${setStat[2]}`, weight: round(((+setStat[2] - 10) / 2) * (W.scalar[setStat[1]] || 1)) });
    const spd = clause.match(/(?:walking |movement )?speed (?:increases|is increased) by (\d+) (?:feet|ft)/i) || clause.match(/\+(\d+) (?:feet|ft\.?) (?:of )?(?:walking |movement )?speed/i);
    if (spd) push({ kind: 'stat', stat: 'Movement Speed', amount: +spd[1], label: `+${spd[1]} ft. speed`, weight: round(+spd[1] * (W.scalar['Movement Speed'] || 0.08) * factor) });
    const saveOrBe = clause.match(/\bsave or (?:be|become|is|are)\s+(?:also\s+)?(\w+)/i);
    if (saveOrBe && !selfHarm) { const k = Object.keys(W.inflict).find(x => x.toLowerCase() === saveOrBe[1].toLowerCase()); push({ kind: 'inflict', label: `save or be ${saveOrBe[1]}`, weight: round((k ? W.inflict[k] : 2) * factor) }); }
    if (/\b(?:invisible|invisibility)\b/i.test(clause) && !offensive) push({ kind: 'utility', label: 'invisibility', weight: round(3 * factor) });
    if (/\b(?:truesight|blindsight)\b/i.test(clause) && !/Truesight \(30 feet\)|Blindsight \(30 feet\)/.test(clause)) push({ kind: 'utility', label: 'truesight/blindsight', weight: round(3 * factor) });
    if (/\b(?:teleport|plane shift|dimension door|misty step|etherealness)\b/i.test(clause)) push({ kind: 'utility', label: 'teleportation', weight: round(3 * factor) });
    const heal = clause.match(/\b(?:regain|restores?|heals?)\b[^.]*?(\d+d\d+)/i);
    if (heal) push({ kind: 'healing', label: `heals ${heal[1]}`, weight: round(avgDice(heal[1]) * 0.25 * factor) });
    // 6) a clause that earned nothing above still says something — small generic weight, capped later
    if (comps.length === startCount && clause.length > 25 && !/^(?:requires attunement|an? )/i.test(clause) && !/^requires attunement/i.test(clause)) {
      push({ kind: 'clause', label: clause.slice(0, 50), weight: W.kinds.genericClause });
    }
  }
  // cap the generic-clause bucket
  let generic = 0;
  const capped = comps.filter(c => { if (c.kind !== 'clause') return true; generic += c.weight; return generic <= W.kinds.genericClauseCap; });
  const total = round(capped.reduce((n, c) => n + c.weight, 0));
  return { components: capped, total, good: round(capped.filter(c => c.weight > 0).reduce((n, c) => n + c.weight, 0)), bad: round(capped.filter(c => c.weight < 0).reduce((n, c) => n + c.weight, 0)) };
}
const round = n => Math.round(n * 100) / 100;

// Score a whole item: structured mods when it has them (generated items, limbs), otherwise its
// effect text (catalog items). Never both — many items carry the same text in both places.
export function scoreItem(item, cfg = DEFAULT_ITEM_RULES) {
  const comps = [];
  if (item && Array.isArray(item.mods) && item.mods.length) {
    item.mods.forEach(mod => {
      const text = mod.text || '';
      const r = scoreText(text, cfg);
      let parts = r.components;
      const name = mod.name || (mod.key && mod.key.replace(/^affix:/, ''));
      const aw = cfg.weights.affixes && name != null ? cfg.weights.affixes[name] : undefined;
      if (mod.type === 'Affix' || mod.prefix) {
        // numeric affixes ("+2 to damage rolls") score from their text; the rest by name
        if (!parts.some(c => c.kind !== 'clause') && aw != null) parts = [{ kind: 'affix', label: name, weight: aw }];
        else if (aw != null && aw < 0 && !parts.some(c => c.weight < 0)) parts = [...parts, { kind: 'affix', label: name, weight: aw }];
      }
      if (mod.type === 'Summon' && !parts.some(c => c.kind === 'summon')) parts = [...parts, { kind: 'summon', label: 'summons a creature', weight: cfg.weights.kinds.summon }];
      if (mod.type === 'Transform' && !parts.some(c => c.kind === 'transform')) parts = [...parts, { kind: 'transform', label: 'transforms the bearer', weight: cfg.weights.kinds.transform }];
      if (mod.type === 'Power/Spell' && !parts.some(c => c.kind === 'spell')) parts = [...parts, { kind: 'spell', label: 'spell', weight: cfg.weights.kinds.spellGrant }];
      parts.forEach(c => comps.push({ ...c, mod: mod.type || '' }));
    });
  } else if (item) {
    scoreText(item.effect || '', cfg).components.forEach(c => comps.push(c));
  }
  if (item && /^Spell Scroll/i.test(item.name || '') && !comps.length) {
    const lv = (String(item.name).match(/\((\d+)(?:st|nd|rd|th) Level\)/i) || [])[1];
    if (lv) comps.push({ kind: 'spell', label: `level ${lv} spell scroll`, weight: round(+lv * 0.6) });
  }
  if (item && Array.isArray(item.unlocks)) item.unlocks.forEach(() => comps.push({ kind: 'unlock', label: 'hidden power tier', weight: cfg.weights.kinds.unlockTier }));
  // charges stored on the item rather than in its text
  if (item && item.charges && !comps.some(c => c.kind === 'charges')) {
    const n = parseInt(String(item.charges), 10);
    if (n > 1 && item.type !== 'consumable') comps.push({ kind: 'charges', label: `${n} charges`, weight: round(Math.min(n, 20) * cfg.weights.kinds.chargePerCharge) });
  }
  const total = round(comps.reduce((n, c) => n + c.weight, 0));
  return { components: comps, total, good: round(comps.filter(c => c.weight > 0).reduce((n, c) => n + c.weight, 0)), bad: round(comps.filter(c => c.weight < 0).reduce((n, c) => n + c.weight, 0)) };
}

// ---------- rarity + price from weight ----------
export function rarityForWeight(total, cfg = DEFAULT_ITEM_RULES) {
  const bands = cfg.rarityBands;
  let pick = 'common';
  for (const r of RARITY_ORDER) { if (total >= bands[r][0]) pick = r; }
  return pick;
}
function niceGp(v) {
  if (v < 1) return Math.round(v * 100) / 100;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  let best = e;
  [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10].forEach(c => { if (Math.abs(c * e - v) < Math.abs(best - v)) best = c * e; });
  return best;
}
// Where the weight sits inside its rarity's band picks the gp inside that rarity's price band.
export function priceForWeight(total, rarity, cfg = DEFAULT_ITEM_RULES) {
  const r = rarity || rarityForWeight(total, cfg);
  const [wl, wh] = cfg.rarityBands[r];
  const span = wh >= 1e8 ? Math.max(6, wl * 0.5) : (wh - wl) || 1;
  const pos = Math.max(0, Math.min(1, (total - wl) / span));
  const [pl, ph] = cfg.priceBands[r];
  const v = pl * Math.pow(ph / pl, pos);
  return Math.min(GP_HARD_CAP, ph, Math.max(pl, niceGp(v)));
}
export function parseGp(str) {
  if (str == null) return null;
  const m = String(str).replace(/,/g, '').trim().match(/^([\d.]+)\s*(k)?\s*(cp|sp|ep|gp|pp)?\b/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return Number.isFinite(v) ? v * (m[2] ? 1000 : 1) * ({ cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 }[(m[3] || 'gp').toLowerCase()]) : null;
}

// ---------- rules ----------
// opts: { rarity, exempt:Set<ruleId> | true, score } — `exempt: true` skips rarity/price rules for
// items whose rarity/price is authored on purpose (chests, quest items, unique campaign pieces).
export function evaluateItem(item, cfg = DEFAULT_ITEM_RULES, opts = {}) {
  const out = [];
  const score = opts.score || scoreItem(item, cfg);
  const rarity = opts.rarity || item.rarity;
  const comps = score.components;
  const skipValue = opts.exempt === true || (opts.exempt instanceof Set && opts.exempt.has('value'));
  const add = (rule, message) => out.push({ rule: rule.id, severity: rule.severity, label: rule.label, message });
  const exempted = new Set(Array.isArray(item.rulesExempt) ? item.rulesExempt : []);   // an item can list rules it is deliberately allowed to break
  const on = id => { const r = ruleOf(cfg, id); return r && r.enabled && !exempted.has(id) ? r : null; };
  let r;
  if ((r = on('no-attack-roll-modifiers'))) {
    const forb = new Set((r.params.forbiddenStats || []).map(s => s.toLowerCase()));
    const hit = comps.find(c => c.touches === 'attack' || (c.stat && forb.has(String(c.stat).toLowerCase()) && c.kind === 'stat'));
    if (hit) add(r, `modifies attack rolls (${hit.label})`);
  }
  if ((r = on('no-only-bad-modifiers'))) {
    if (comps.some(c => c.weight < 0) && score.good < r.params.minBenefit) add(r, `has drawbacks but no real benefit (good ${score.good}, bad ${score.bad})`);
    else if (comps.length && !comps.some(c => c.weight > 0)) add(r, 'every modifier is a drawback');
  }
  if ((r = on('max-modifiers-by-rarity')) && rarity) {
    const cap = r.params[rarity];
    const count = Array.isArray(item.mods) && item.mods.length ? item.mods.length
      : comps.filter(c => c.kind !== 'clause' && c.kind !== 'charges' && c.kind !== 'spell').length + (comps.some(c => c.kind === 'spell') ? 1 : 0);
    if (cap != null && count > cap) add(r, `${count} modifiers on a ${rarity} item (max ${cap})`);
  }
  if ((r = on('no-duplicate-stat-boost'))) {
    const seen = new Set();
    for (const c of comps) { if (c.kind === 'stat' && c.weight > 0 && c.stat) { if (seen.has(c.stat)) { add(r, `boosts ${c.stat} more than once`); break; } seen.add(c.stat); } }
  }
  if ((r = on('proficiency-boost-cap'))) {
    const n = comps.filter(c => c.kind === 'proficiency').reduce((s, c) => s + c.amount, 0);
    if (n > r.params.max) add(r, `+${n} proficiency bonus (max +${r.params.max})`);
  }
  if (!skipValue) {
    if ((r = on('rarity-matches-weight')) && rarity) {
      const want = rarityForWeight(score.total, cfg);
      const d = Math.abs(RARITY_ORDER.indexOf(want) - RARITY_ORDER.indexOf(rarity));
      if (d > r.params.tolerance) add(r, `weight ${score.total} belongs to ${want}, item is ${rarity}`);
    }
    const gp = parseGp(item.gp);
    if ((r = on('price-matches-weight')) && gp != null && rarity && score.total > 0) {
      const want = priceForWeight(score.total, rarity, cfg);
      if (want > 0 && Math.abs(gp - want) / want * 100 > r.params.tolerancePct) add(r, `${item.gp} but weight ${score.total} is worth ${want} gp`);
    }
  }
  if ((r = on('price-caps'))) {
    const gp = parseGp(item.gp);
    if (gp != null && gp > r.params.hardCap) add(r, `${item.gp} is above the ${r.params.hardCap} gp cap`);
    if (gp != null && rarity === 'rare' && gp > r.params.rareCap) add(r, `${item.gp} is above the ${r.params.rareCap} gp Rare cap`);
  }
  return out;
}
