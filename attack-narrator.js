// Attack narrator: turns any attack — a stat-block action, a spell, a weapon swing, a breath weapon — into a few short,
// read-aloud paragraphs for the DM: what the attack looks like, what it does when it lands, and what is left behind.
// Generic on purpose (it says "the beast", never a monster's name) so it can be used anywhere.
//
//   AttackNarrator.describe(attack, ctx)  -> { title, headline, chips, bullets:[{label,text}], result, text, html, ... }
//     attack  { name, text, source?, isSpell?, spellLevel?, rarity?, recharge? }     (a stat-block action or similar)
//     ctx     { attacker:{type,size,cr,name?,str?,dex?}, entry:{variant,traits,dmgMult,atkMod}, target:{name?},
//               result:{outcome,damage,d20,failed}, spell:<raw 5etools spell>, partyLevel, seed, detail }
//   AttackNarrator.describeMonster(monster, ctx) -> narrations for every action, bonus action, reaction, legendary action and spell
//   AttackNarrator.describeSequence(list, ctx)    -> a multiattack read as one flowing exchange
//   AttackNarrator.parse(attack)                  -> the parsed profile (kind, move, damage, save, area, conditions...)
//
// Data lives in attack-narrator-*.js (elements, moves, magic, effects, lexicon, spells) loaded before this file.
(function () {
  const D = window.AttackNarratorData;
  if (!D || !D.MOVES) return;

  // ---------------------------------------------------------------- small utilities
  const hash32 = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const mulberry = seed => { let a = seed >>> 0 || 1; return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const lc1 = s => (s ? s[0].toLowerCase() + s.slice(1) : s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const uniq = a => [...new Set(a)];
  const PHYSICAL = new Set(['slashing', 'piercing', 'bludgeoning']);
  const TYPES = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];
  const SIZE_ORDER = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

  function conj(verb, plural) {
    const irr = D.IRREGULAR && D.IRREGULAR[verb];
    if (irr) return irr[plural ? 1 : 0];
    if (plural) return verb;
    if (/(s|sh|ch|x|z)$/.test(verb)) return verb + 'es';
    if (/[^aeiou]y$/.test(verb)) return verb.slice(0, -1) + 'ies';
    if (/o$/.test(verb)) return verb + 'es';
    return verb + 's';
  }
  function words(n) { n = Math.round(n); return (D.NUMWORDS && D.NUMWORDS[n]) || String(n); }
  function dieAvg(expr) {
    const m = /^(\d+)d(\d+)\s*(?:([+\-−–])\s*(\d+))?$/.exec(String(expr).replace(/\s+/g, ' ').trim());
    if (!m) return null;
    const n = +m[1], s = +m[2], mod = m[3] ? (m[3] === '+' ? +m[4] : -(+m[4])) : 0;
    return { avg: n * (s + 1) / 2 + mod, diceAvg: n * (s + 1) / 2, n, s, mod };
  }
  const cleanName = n => String(n || '').replace(/\([^)]*\)/g, ' ').replace(/[+\-]\d+\b/g, ' ').replace(/\s+\d+\s*$/, ' ').replace(/\s+/g, ' ').trim();

  // ---------------------------------------------------------------- parsing
  const SAVE_RE = /(?:\bDC\s*)?(\d+)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/gi;
  const ABIL = { strength: 'Strength', dexterity: 'Dexterity', constitution: 'Constitution', intelligence: 'Intelligence', wisdom: 'Wisdom', charisma: 'Charisma' };

  function parseDamage(text) {
    const out = [], taken = [];
    const add = (idx, len, avg, dice, type, flat) => {
      if (taken.some(([a, b]) => idx < b && idx + len > a)) return;
      if (/[,;]\s*or\s*(?:\d+\s*)?$/i.test(text.slice(Math.max(0, idx - 12), idx))) return;
      if (/^\s*(?:,\s*)?(?:(?:if|when) (?:used|wielded|held|the weapon is)[^.]{0,30}(?:two hands|one hand)|with (?:shillelagh|two hands))/i.test(text.slice(idx + len, idx + len + 70))) return;
      taken.push([idx, idx + len]);
      const t = type && TYPES.includes(type.toLowerCase()) ? type.toLowerCase() : null;
      const d = dice ? dieAvg(dice) : null;
      const a = avg != null ? +avg : d ? Math.floor(d.avg) : flat != null ? +flat : null;
      if (a == null) return;
      const before = text.slice(Math.max(0, idx - 90), idx).toLowerCase();
      out.push({ idx, avg: a, dice: dice || null, diceAvg: d ? d.diceAvg : 0, type: t, conditional: /saving throw|failed save|on a failure|if the target|if it|if the creature|if you/.test(before.split(/[.!?]/).pop()) , half: /half as much/.test(text.slice(idx, idx + len + 80).toLowerCase()) });
    };
    let m;
    const tyre = '([a-z]+)(?:,? (?:or|and) [a-z]+)?';
    const r1 = new RegExp('(\\d+)\\s*\\(([^)]*?d[^)]*?)\\)\\s*' + tyre + '\\s+damage', 'gi');
    while ((m = r1.exec(text))) add(m.index, m[0].length, m[1], m[2], m[3]);
    const r2 = new RegExp('\\(([^)]*?\\dd[^)]*?)\\)\\s*' + tyre + '\\s+damage', 'gi');
    while ((m = r2.exec(text))) add(m.index, m[0].length, null, m[1], m[2]);
    const r3 = new RegExp('(?<![\\d(])(\\d+d\\d+(?:\\s*[+\\-]\\s*\\d+)?)\\s+' + tyre + '\\s+damage', 'gi');
    while ((m = r3.exec(text))) add(m.index, m[0].length, null, m[1], m[2]);
    const r4 = new RegExp('(?<![\\d(d+\\-])(\\d+)\\s+' + tyre + '\\s+damage', 'gi');
    while ((m = r4.exec(text))) add(m.index, m[0].length, m[1], null, m[2], m[1]);
    return out.sort((a, b) => a.idx - b.idx);
  }
  function parseArea(text, name) {
    let m;
    if ((m = /(?:^|[.\s])(Cone|Line|Radius|Sphere|Cube|Cylinder|Hemisphere|Emanation): ?(\d+) ?(?:ft|feet|foot)/i.exec(text))) { const sh = m[1].toLowerCase(); return { shape: sh === 'hemisphere' ? 'sphere' : sh, size: +m[2] }; }
    if ((m = /(\d+)-foot[- ]cone/i.exec(text))) return { shape: 'cone', size: +m[1] };
    if ((m = /(\d+)[- ]?(?:feet|foot|ft\.?) long(?: and (\d+)[- ]?(?:feet|foot|ft\.?) wide)?/i.exec(text)) && /line|beam|bolt|ray/i.test(text)) return { shape: 'line', size: +m[1], width: m[2] ? +m[2] : null };
    if ((m = /line (\d+) feet long/i.exec(text)) || (m = /(\d+)-foot line/i.exec(text))) return { shape: 'line', size: +m[1] };
    if ((m = /(\d+)-foot[- ]radius sphere/i.exec(text)) || (m = /sphere[^.]{0,30}?(\d+)[- ]?(?:foot|feet)[- ]radius/i.exec(text))) return { shape: 'sphere', size: +m[1] };
    if ((m = /(\d+)-foot[- ]radius(?:,? \d+-foot[- ]tall)? cylinder/i.exec(text)) || (m = /cylinder[^.]{0,40}?(\d+)[- ]?(?:foot|feet)[- ]radius/i.exec(text))) return { shape: 'cylinder', size: +m[1] };
    if ((m = /(\d+)-foot cube/i.exec(text))) return { shape: 'cube', size: +m[1] };
    if ((m = /(\d+)-foot[- ]radius/i.exec(text))) return { shape: 'radius', size: +m[1] };
    if ((m = /(\d+)-foot emanation/i.exec(text))) return { shape: 'emanation', size: +m[1] };
    if ((m = /(?:each|every|all|any) (?:other )?creature(?:s)?(?: that (?:can see|is aware of)[^.]{0,40})? (?:of its choice )?within (\d+) feet/i.exec(text)) || (m = /within (\d+) feet of (?:it|the \w+)[^.]{0,30}(?:must|makes?|takes?)/i.exec(text))) return { shape: 'around', size: +m[1] };
    if (/each creature in (?:that|the) area|creatures? in the area/i.test(text)) return { shape: 'around', size: 20 };
    return null;
  }
  function parseConditions(text) {
    const found = [];
    for (const c of D.CONDITIONS) {
      if (!c.re.test(text)) continue;
      const det = {};
      const dm = /(?:for|lasting) (?:up to )?(\d+) (round|minute|hour|day)s?/i.exec(text);
      if (dm) det.duration = `${dm[1]} ${dm[2]}${+dm[1] === 1 ? '' : 's'}`;
      else if (/until the end of (?:its|the target's|that creature's|their) next turn|until the start of its next turn/i.test(text)) det.duration = 'until the end of its next turn';
      else if (/until (?:the .{0,20} )?(?:escapes?|dies|ends|is freed|is released|stands up)/i.test(text)) det.duration = 'until it ends';
      const esc2 = /escape DC (\d+)/i.exec(text); if (esc2) det.escapeDC = +esc2[1];
      const pm = /(\d+) feet(?: away| toward| in a straight line)?/i.exec(text.slice(Math.max(0, text.search(c.re) - 40), text.search(c.re) + 70));
      if (pm && (c.id === 'push' || c.id === 'pull')) det.feet = +pm[1];
      found.push({ id: c.id, label: c.label, ...det });
    }
    // grapple is stated, not implied, by "held": keep only if the text actually grapples/holds
    return found;
  }
  function parseName(name) {
    const raw = String(name || '');
    const info = { raw, base: cleanName(raw) };
    let m;
    if ((m = /recharge (\d)[–\-](\d)/i.exec(raw)) || (m = /recharge (\d)/i.exec(raw))) info.recharge = m[0].replace(/^recharge /i, '');
    if ((m = /costs (\d) actions?/i.exec(raw))) info.cost = +m[1];
    if ((m = /\((\d+)\/day\)/i.exec(raw))) info.perDay = +m[1];
    if (/recharges after a short or long rest/i.test(raw)) info.rest = true;
    return info;
  }

  const MOVE_BY_ID = D.MOVES;
  const isMeleeMove = id => (MOVE_BY_ID[id] || {}).kind === 'melee';
  const isRangedMove = id => (MOVE_BY_ID[id] || {}).kind === 'ranged';

  const WEAPON_MOVES = new Set(['blade', 'shortblade', 'greatblade', 'axe', 'greataxe', 'hammer', 'club', 'mace', 'shield', 'pick', 'polearm', 'spear', 'whip', 'staff', 'bow', 'crossbow', 'sling', 'net', 'thrown']);
  function pickMoveByName(base, extra) {
    const n = ' ' + base.toLowerCase() + ' ';
    let weaponOnly = false;
    for (const [re, id] of D.MOVE_LEX) {
      if (!re.test(n)) continue;
      if (id === 'WEAPON') { weaponOnly = true; continue; }
      if (weaponOnly && !WEAPON_MOVES.has(id)) continue;
      return id;
    }
    return null;
  }
  function elementFromName(base) {
    const n = base.toLowerCase();
    for (const [re, el] of D.NAME_ELEMENTS) if (re.test(n)) return el;
    return null;
  }

  function parse(attack, ctx) {
    attack = attack || {}; ctx = ctx || {};
    const text = String(attack.text || '').replace(/\s+/g, ' ').trim();
    const nm = parseName(attack.name);
    const p = { name: nm.raw, base: nm.base, recharge: nm.recharge || attack.recharge || null, cost: nm.cost || null, perDay: nm.perDay || null, text };
    // ---- roll kind
    p.melee = /melee (?:weapon|spell) attack|melee or ranged/i.test(text);
    p.ranged = /ranged (?:weapon|spell) attack|melee or ranged/i.test(text);
    p.spellAttack = /(?:melee|ranged|melee or ranged) spell attack/i.test(text);
    let m = /([+\-−–]\d+) to hit/i.exec(text) || /\bto hit,? /i.exec(text); if (m && /^[+\-−–]\d+$/.test(m[1] || '')) p.toHit = +String(m[1]).replace('−', '-').replace('–', '-');
    if ((m = /reach (\d+) ft/i.exec(text))) p.reach = +m[1];
    if ((m = /range (\d+)(?:\/(\d+))? ?(?:ft|feet)/i.exec(text)) || (m = /range of (\d+)(?:\/(\d+))? ?(?:ft|feet)/i.exec(text))) { p.range = +m[1]; p.longRange = m[2] ? +m[2] : null; }
    if ((m = /(\d+)\s*(?:ft|feet)\.? (?:long|range)/i.exec(text)) && !p.range) p.range = +m[1];
    // ---- damage
    p.damage = parseDamage(text);
    if (!p.damage.length && p.toHit != null) { const um = /Hit: (?:(\d+) \()?(\d+d\d+(?:\s*[+\-]\s*\d+)?)\)? damage/i.exec(text); if (um) { const dv = dieAvg(um[2]); p.damage.push({ idx: um.index, avg: um[1] ? +um[1] : Math.floor(dv ? dv.avg : 0), dice: um[2], diceAvg: dv ? dv.diceAvg : 0, type: null, conditional: false, half: false, untyped: true }); } }
    const hitDamage = p.damage.filter(d => !d.conditional);
    const saveDamage = p.damage.filter(d => d.conditional);
    p.hitClauses = hitDamage.length ? hitDamage : (p.melee || p.ranged ? [] : saveDamage);
    p.saveClauses = p.hitClauses === hitDamage ? saveDamage : [];
    if (!p.hitClauses.length && p.damage.length) p.hitClauses = p.damage;
    p.avg = p.hitClauses.reduce((n, d) => n + d.avg, 0);
    p.saveAvg = p.saveClauses.reduce((n, d) => n + d.avg, 0);
    p.diceAvg = p.hitClauses.reduce((n, d) => n + d.diceAvg, 0);
    p.types = uniq(p.damage.map(d => d.type).filter(Boolean));
    p.element = (p.hitClauses.find(d => d.type) || p.damage.find(d => d.type) || {}).type || null;
    p.extraTypes = uniq((p.hitClauses.concat(p.saveClauses)).map(d => d.type).filter(t => t && t !== p.element));
    p.half = p.damage.some(d => d.half) || /half as much/i.test(text);
    // ---- saves
    p.saves = []; SAVE_RE.lastIndex = 0; let sm; while ((sm = SAVE_RE.exec(text))) p.saves.push({ dc: +sm[1], ability: ABIL[sm[2].toLowerCase()] });
    p.save = p.saves[0] || null;
    if (!p.save) { const alt = /saving throw/i.test(text) ? /\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\b[^.]{0,30}saving throw/i.exec(text) : null; if (alt) p.save = { dc: (/DC (\d+)/i.exec(text) || [])[1] ? +(/DC (\d+)/i.exec(text))[1] : null, ability: ABIL[alt[1].toLowerCase()] }; }
    p.area = parseArea(text, p.base);
    if (p.area && p.area.shape === 'around' && !p.save && /reaction|attack against|makes? a (?:melee|ranged)/i.test(text)) p.area = null;
    const spellText = (attack.isSpell || attack.source === 'spell') && /^Casts /i.test(text);
    p.conditions = parseConditions(spellText ? '' : text);
    p.isMulti = /^multiattack/i.test(p.base);
    p.auto = !p.toHit && !p.save && p.damage.length > 0;
    // ---- mechanics kind
    if (p.isMulti) p.kind = 'multi';
    else if (p.toHit != null || p.melee || p.ranged) p.kind = p.melee && !p.ranged ? 'melee' : p.ranged && !p.melee ? 'ranged' : 'melee';
    else if (p.save && (p.area || p.damage.length)) p.kind = p.area ? 'area' : 'single';
    else if (p.save) p.kind = 'single';
    else if (p.damage.length) p.kind = p.area ? 'area' : 'auto';
    else p.kind = 'utility';
    if (p.kind === 'single' && !p.damage.length && !p.toHit && !p.area && /difficult terrain|\bcreates? (?:a|an|the)\b|\bsprouts?\b/i.test(text) && !/\bgaze\b|\btouch\b/i.test(text)) p.kind = 'utility';
    if ((attack.isSpell || attack.source === 'spell') && /^Self\b/i.test(text) && !p.toHit && !p.save) { p.damage = []; p.hitClauses = []; p.saveClauses = []; p.avg = 0; p.saveAvg = 0; p.element = null; p.kind = 'utility'; p.auto = false; p.half = false; }
    if (p.kind === 'utility' && !p.damage.length && !p.save && /\buses? (?:its |his |her |their |the )?[A-Z]/.test(text) && !/\bcasts?\b|\bSpellcasting\b/.test(text)) p.useRef = true;
    if (p.kind === 'utility' && !p.damage.length && !p.save && /\b(?:makes?|can make|uses?|attacks?)\b[^.]{0,40}\battacks?\b|\battacks? with\b|\bmakes? (?:one|a|an|two) .{0,24}attack/i.test(text) && !/\bcasts?\b|\bteleport|\bshape\b|\ballies\b|\ballied\b|\bally\b/i.test(text)) p.ref = true;
    return p;
  }

  const MOVE_TYPE = { bite: 'piercing', claw: 'slashing', talon: 'slashing', slam: 'bludgeoning', stomp: 'bludgeoning', gore: 'piercing', tail: 'bludgeoning', wing: 'bludgeoning', sting: 'piercing', tentacle: 'bludgeoning', constrict: 'bludgeoning', engulf: 'acid', touch: 'necrotic', beak: 'piercing', pincer: 'slashing', rend: 'slashing',
    blade: 'slashing', shortblade: 'piercing', greatblade: 'slashing', axe: 'slashing', greataxe: 'slashing', hammer: 'bludgeoning', club: 'bludgeoning', mace: 'bludgeoning', staff: 'bludgeoning', spear: 'piercing', polearm: 'slashing', whip: 'slashing', shield: 'bludgeoning', pick: 'piercing', bow: 'piercing', crossbow: 'piercing', sling: 'bludgeoning', thrown: 'piercing', firearm: 'piercing', net: 'bludgeoning', unarmed: 'bludgeoning', strike: 'bludgeoning', shot: 'piercing' };
  function fallbackMove(p, famType) {
    const t = p.element;
    const natural = ['beast', 'monstrosity', 'dragon', 'aberration', 'ooze', 'plant', 'elemental', 'giant', 'undead', 'fiend', 'swarm'].includes(famType);
    if (p.kind === 'ranged') return 'shot';
    if (natural) return t === 'piercing' ? 'bite' : t === 'slashing' ? 'claw' : 'slam';
    return t === 'slashing' ? 'blade' : t === 'piercing' ? 'shortblade' : t === 'bludgeoning' ? 'club' : 'strike';
  }
  // ---------------------------------------------------------------- choosing the delivery
  function chooseMove(p, ctx, spellSpec) {
    const id = chooseMoveCore(p, ctx, spellSpec);
    if (!p.element && p.damage.some(d => d.untyped) && (MOVE_TYPE[id] || id)) { p.element = MOVE_TYPE[id] || (MOVE_BY_ID[id] && MOVE_BY_ID[id].group === 'magic' ? 'force' : 'bludgeoning'); p.damage.forEach(d => { if (d.untyped) d.type = p.element; }); }
    return id;
  }
  function chooseMoveCore(p, ctx, spellSpec) {
    let id = spellSpec && spellSpec.move;
    const text = p.text;
    const famType = String((ctx.attacker && ctx.attacker.type) || '').toLowerCase().replace(/\s*\(.*$/, '');
    if (!id) id = pickMoveByName(p.base, '');
    const kind = p.kind;
    if (!id) {
      if (kind === 'melee') id = fallbackMove(p, famType);
      else if (kind === 'ranged') id = 'shot';
      else if (kind === 'area') id = p.area && (p.area.shape === 'cone') ? 'breath' : p.area && p.area.shape === 'line' ? 'ray' : p.area && (p.area.shape === 'around' || p.area.shape === 'emanation') ? 'burst' : 'orb';
      else if (kind === 'single') id = /gaze|stare|sight/i.test(text) ? 'gaze' : /touch/i.test(text) ? 'touch' : /breath|spit|spray/i.test(text) ? 'spray' : 'hex';
      else if (kind === 'auto') id = /bolt|missile|dart|ray|beam/i.test(p.base) ? 'ray' : (['slashing', 'piercing', 'bludgeoning'].includes(p.element) ? 'strike' : 'orb');
      else if (p.ref) id = fallbackMove(Object.assign({}, p, { kind: /bow|sling|javelin|throw|rock|spit/i.test(p.base) ? 'ranged' : 'melee' }), famType);
      else id = 'utility';
    }
    const mv = MOVE_BY_ID[id];
    if (kind === 'utility') {
      if (p.ref && mv && (mv.kind === 'melee' || mv.kind === 'ranged') && mv.group !== 'magic') { p.kind = mv.kind; p.element = p.element || MOVE_TYPE[id] || null; return id; }
      if (mv && mv.group === 'magic' && mv.kind !== 'utility' && id !== 'summon') { p.autoEffect = true; return id; }
      if (p.useRef && mv && (mv.kind === 'melee' || mv.kind === 'ranged')) { p.kind = mv.kind; p.element = p.element || MOVE_TYPE[id] || null; p.ref = true; return id; }
      if (p.ref) { id = fallbackMove(Object.assign({}, p, { kind: 'melee' }), famType); p.kind = 'melee'; p.element = p.element || MOVE_TYPE[id] || null; return id; }
      return 'utility';
    }
    if (!mv) return fallbackMove(p, famType);
    // both melee and ranged are allowed ("Melee or Ranged Weapon Attack"): trust the weapon
    if (p.melee && p.ranged && mv.kind === 'ranged') p.kind = 'ranged';
    // a ranged attack roll cannot be a melee-only move and vice versa
    if (p.kind === 'ranged' && mv.kind === 'melee') return ['gaze', 'hex'].includes(id) ? id : (p.spellAttack ? 'ray' : (mv.group === 'weapon' || mv.group === 'natural' ? 'thrown' : 'shot'));
    if (p.kind === 'melee' && mv.kind === 'ranged' && !p.ranged) return id === 'ray' ? 'touch' : fallbackMove(p, famType);
    if ((p.kind === 'area' || p.kind === 'single') && (mv.kind === 'melee' || mv.kind === 'ranged') && !['hex', 'gaze', 'touch', 'engulf', 'constrict'].includes(id)) {
      return p.area ? 'burst' : (p.save ? (id === 'bite' || id === 'claw' ? id : 'hex') : id);
    }
    if (p.kind === 'melee' && (id === 'aura' || id === 'cloud' || id === 'wave' || id === 'spray')) return id === 'spray' ? 'spray' : fallbackMove(p, famType);
    return id;
  }

  // ---------------------------------------------------------------- spells
  function spellKeyOf(name) { return String(name || '').toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim(); }
  function flattenEntries(e) {
    if (e == null) return '';
    if (typeof e === 'string') return e.replace(/\{@\w+ ([^}|]*)[^}]*\}/g, '$1');
    if (Array.isArray(e)) return e.map(flattenEntries).join(' ');
    if (typeof e === 'object') return flattenEntries(e.entries || e.items || e.entry || '');
    return '';
  }
  function spellSpecFor(attack, ctx, p) {
    const S = D.SPELLS || {};
    const key = spellKeyOf(attack.name);
    let spec = S[key] || null;
    // a stat-block ability that merely shares a spell's name (Teleport, Haste, Charm) is not that spell
    if (spec && spec.kind === 'utility' && !(attack.isSpell || attack.source === 'spell' || ctx.spell || /\bcasts?\b|\bspell\b/i.test(attack.text || ''))) spec = null;
    const raw = ctx.spell || (typeof window !== 'undefined' && window.SpellCompendiumAPI && window.SpellCompendiumAPI.find && (attack.isSpell || attack.source === 'spell') ? window.SpellCompendiumAPI.find(attack.name) : null);
    if (!spec && !raw && !attack.isSpell && attack.source !== 'spell') return null;
    const out = Object.assign({ name: attack.name, level: attack.spellLevel != null ? attack.spellLevel : null }, spec || {});
    if (raw) {
      out.level = out.level != null ? out.level : Number(raw.level != null ? raw.level : 0);
      out.school = out.school || ({ A: 'abjuration', C: 'conjuration', D: 'divination', E: 'enchantment', V: 'evocation', I: 'illusion', N: 'necromancy', T: 'transmutation' }[raw.school] || null);
      if (!out.el && raw.damageInflict && raw.damageInflict[0]) out.el = String(raw.damageInflict[0]).toLowerCase();
      if (!out.shape && raw.areaTags) { const tag = raw.areaTags.find(t => ['C', 'L', 'S', 'N', 'Y', 'H', 'Q', 'R', 'W'].includes(t)); if (tag) out.shape = { C: 'cone', L: 'line', S: 'sphere', N: 'cube', Y: 'cylinder', H: 'sphere', Q: 'cube', R: 'radius', W: 'line' }[tag]; }
      out.concentration = !!(raw.duration && raw.duration.some && raw.duration.some(d => d.concentration));
      if (raw.conditionInflict) out.conditionInflict = raw.conditionInflict.map(String);
      out.desc = flattenEntries(raw.entries).slice(0, 700);
    }
    return out;
  }
  function spellMoveFor(spell, p) {
    // Pick a delivery for a spell with no hand-written entry from what we know about it.
    if (spell.move) return spell.move;
    if (p && p.kind === 'utility' && !p.damage.length && !p.save && !spell.conditionInflict) return 'utility';
    const nm = spell.name || '';
    const byName = pickMoveByName(cleanName(nm), '');
    if (byName && !['strike', 'unarmed', 'bite', 'claw'].includes(byName)) return byName;
    if (p && p.kind === 'ranged') return 'ray';
    if (p && p.kind === 'melee') return 'touch';
    if (p && p.area) return p.area.shape === 'cone' ? 'cone' : p.area.shape === 'line' ? 'ray' : (p.area.shape === 'around' || p.area.shape === 'emanation') ? 'burst' : 'orb';
    if (p && p.save && !p.damage.length) return 'hex';
    return spell.school === 'enchantment' ? 'hex' : spell.school === 'necromancy' ? 'drain' : spell.school === 'conjuration' ? 'summon' : 'orb';
  }

  // ---------------------------------------------------------------- tiers, lethality, party level
  function tierOfAvg(avg) { for (const t of D.TIERS) if (avg <= t.max) return t.id; return 5; }
  function levelFromCR(cr) { const c = typeof cr === 'string' && cr.includes('/') ? (+cr.split('/')[0]) / (+cr.split('/')[1]) : parseFloat(cr); if (!isFinite(c)) return null; if (c < 1) return 1; return clamp(Math.round(c * 0.9 + 1), 1, 20); }

  // ---------------------------------------------------------------- the grammar
  function makeContext(p, ctx, spellSpec, moveId) {
    const att = (ctx.attacker) || {};
    const seed = hash32((p.name || '') + '|' + (p.text || '').slice(0, 160) + '|' + (ctx.seed || 0) + '|' + (ctx.variant || 0));
    const rng = mulberry(seed);
    const memory = {};
    const pick = (arr, key) => {
      if (!arr || !arr.length) return '';
      if (arr.length === 1) return arr[0];
      const used = memory[key || arr] = memory[key || arr] || new Set();
      let idx, tries = 0; do { idx = Math.floor(rng() * arr.length); tries++; } while (used.has(idx) && tries < 12);
      used.add(idx); if (used.size >= arr.length) used.clear();
      return arr[idx];
    };
    const typeStr = String(att.type || '').toLowerCase();
    const famId = ['swarm', 'dragon', 'undead', 'fiend', 'celestial', 'construct', 'elemental', 'fey', 'giant', 'ooze', 'plant', 'aberration', 'monstrosity', 'humanoid', 'beast'].find(f => typeStr.includes(f)) || (att.name && /swarm/i.test(att.name) ? 'swarm' : 'humanoid');
    const fam = D.FAMILIES[famId] || D.FAMILIES.humanoid;
    const size = SIZE_ORDER.includes(att.size) ? att.size : (att.size ? (SIZE_ORDER.find(s => String(att.size).toLowerCase().startsWith(s.toLowerCase())) || 'Medium') : 'Medium');
    const sizeInfo = D.SIZES[size];
    const role = chooseRole(p, att, famId, spellSpec, moveId);
    const roleInfo = D.ROLES[role] || D.ROLES.brute;
    const pron = fam.pronoun === 'they' || ctx.pronouns === 'they' ? 'they' : (ctx.pronouns === 'it' ? 'it' : (fam.pronoun || 'it'));
    // plain wording: call the attacker by its own name when it has one ("the Behir"), else "the creature"
    const namedSubj = att.name && !ctx.weapon ? (/^(?:the|a|an)\s/i.test(att.name) ? att.name : 'the ' + att.name) : null;
    const subj = ctx.subject || namedSubj || (role === 'caster' && famId === 'humanoid' ? pick(['the caster', 'the spellcaster'], 'subj') : pick(fam.nouns, 'subj'));
    const sing = pron === 'they' ? { they: 'they', their: 'their', aThem: 'them', themself: 'themself' } : { they: 'it', their: 'its', aThem: 'it', themself: 'itself' };
    const tgtName = ctx.target && ctx.target.name ? ctx.target.name : 'the target';
    const condEl = (p.conditions.map(c => D.COND_ELEMENT[c.id]).find(Boolean)) || null;
    const el = elementBundle(p.element || (spellSpec && spellSpec.el) || elementFromName(p.base) || condEl || null, moveId, pick, rng);
    const noDmg = !p.avg && !p.saveAvg && !p.ref;
    let tier = tierOfAvg(Math.max(p.avg, p.saveAvg) * ((ctx.entry && ctx.entry.dmgMult) || 1));
    if (noDmg) {
      const dcTier = p.save && p.save.dc ? (p.save.dc <= 11 ? 0 : p.save.dc <= 13 ? 1 : p.save.dc <= 15 ? 2 : p.save.dc <= 18 ? 3 : p.save.dc <= 21 ? 4 : 5) : 1;
      const cTier = p.conditions.length ? Math.max(...p.conditions.map(c => D.COND_TIER[c.id] || 1)) : 1;
      tier = clamp(Math.round((dcTier + cTier) / 2), 0, 5);
    }
    if (spellSpec && spellSpec.level != null && !p.avg && !p.saveAvg) tier = clamp(Math.ceil(spellSpec.level / 2), 0, 5);
    if (spellSpec && spellSpec.level != null) tier = Math.max(tier, clamp(Math.floor(spellSpec.level / 2), 0, 5) - (p.avg || p.saveAvg ? 1 : 0));
    if (p.ref) { const c = parseFloat(String(att.cr || '1').includes('/') ? 0.5 : att.cr) || 1; tier = clamp(Math.round(c / 5) + 1, 1, 4); }
    if (ctx.tier != null) tier = clamp(ctx.tier, 0, 5);
    const cx = { p, ctx, spellSpec, moveId, rng, pick, famId, fam, size, sizeInfo, role, pron, subj, tier, el, missing: [], used: new Set(), tgtName, plural: false, noDmg };
    cx.tokens = {
      subj, they: sing.they, their: sing.their, aThem: sing.aThem, themself: sing.themself,
      tgt: tgtName, tgtPoss: /^the /i.test(tgtName) ? tgtName + '\'s' : tgtName + '\'s', tThey: 'they', tTheir: 'their', them: 'them',
      pose: () => pick(roleInfo.pose, 'pose'), pace: () => pick(roleInfo.pace, 'pace'),
      sizeAdj: () => pick(sizeInfo.adj, 'sizeAdj'), frame: () => pick(sizeInfo.frame, 'frame'),
      part: () => pick(['Gargantuan', 'Huge', 'Large'].includes(size) || p.area ? D.BODY_PARTS_BIG : D.BODY_PARTS, 'part'),
      reach: () => words(p.reach || 5) + ' feet', range: () => (p.range ? words(p.range) + ' feet' : 'the gap'),
      areaPhrase: () => areaPhrase(p, spellSpec, size), shape: () => (p.area ? (D.AREAS[p.area.shape] || D.AREAS.around).name : 'area'),
      pow: () => pick(D.TIERS[tier].pow, 'pow'), mag: () => pick(D.TIERS[tier].mag, 'mag')
    };
    // element tokens, primary and secondary
    Object.assign(cx.tokens, el.tokens(''));
    const el2 = elementBundle(p.extraTypes[0] || null, moveId, pick, rng, 2);
    cx.el2 = el2; Object.assign(cx.tokens, el2.tokens('2'));
    // move-specific tokens (set later per move)
    return cx;
  }
  function chooseRole(p, att, famId, spellSpec, moveId) {
    if (famId === 'swarm') return 'swarm';
    if (spellSpec || ['hex', 'ray', 'orb', 'summon'].includes(moveId) || /spellcast|innate/i.test(JSON.stringify(att.traits || '')) ) return 'caster';
    if (p.kind === 'ranged' && !p.spellAttack) return 'archer';
    if (famId === 'aberration' || famId === 'undead' && moveId === 'aura') return 'horror';
    const str = att.str, dex = att.dex;
    const big = ['Large', 'Huge', 'Gargantuan'].includes(att.size);
    if (/ambush|pounce|surprise|sneak|stealth/i.test(JSON.stringify(att.traits || ''))) return 'ambusher';
    if (famId === 'humanoid' && /shield|longsword|spear|mace|greatsword|halberd/i.test(p.base)) return 'soldier';
    if (famId === 'giant' || big && (str || 0) >= 18) return 'brute';
    if ((dex || 0) > (str || 0) + 2) return 'skirmisher';
    if (famId === 'construct') return 'guardian';
    if (famId === 'dragon') return 'leader';
    return big ? 'brute' : (famId === 'beast' ? 'skirmisher' : 'soldier');
  }
  function areaPhrase(p, spellSpec, size) {
    const a = p.area || (spellSpec && spellSpec.shape ? { shape: spellSpec.shape, size: spellSpec.size || 20 } : null);
    if (!a) return 'a tight, rolling bloom';
    const def = D.AREAS[a.shape] || D.AREAS.around;
    const n = words(a.size || spellSpec && spellSpec.size || 20);
    let s = def.phrase.replace('{n}', n);
    if (a.width && a.shape === 'line') s += `, ${words(a.width)} feet wide`;
    return s;
  }
  function areaScale(p, spellSpec) {
    const a = p.area || (spellSpec && spellSpec.shape ? { shape: spellSpec.shape, size: spellSpec.size || 20 } : null);
    if (!a) return null;
    const def = D.AREAS[a.shape] || D.AREAS.around;
    const keys = Object.keys(def.scale).map(Number).sort((x, y) => x - y);
    let k = keys[0]; for (const kk of keys) if ((a.size || 0) >= kk) k = kk;
    return def.scale[k];
  }
  function areaSentence(p, spellSpec, sc) {
    const a = p.area || (spellSpec && spellSpec.shape ? { shape: spellSpec.shape, size: spellSpec.size || 20 } : null);
    if (!a) return '';
    const n = words(a.size || 20);
    const sh = a.shape;
    if (sh === 'cone') return `The cone reaches ${n} feet: ${sc}.`;
    if (sh === 'line') return `The line stretches ${n} feet: ${sc}.`;
    if (sh === 'cube') return `It fills a ${n}-foot cube: ${sc}.`;
    if (sh === 'around' || sh === 'emanation') return `It reaches ${n} feet out in every direction: ${sc}.`;
    return `It fills a ${n}-foot radius: ${sc}.`;
  }
  function areaChip(p, spellSpec) {
    const a = p.area || (spellSpec && spellSpec.shape ? { shape: spellSpec.shape, size: spellSpec.size || 20 } : null);
    if (!a) return null;
    const sh = a.shape;
    return sh === 'around' || sh === 'emanation' ? `${a.size} ft around` : `${a.size}-ft ${sh === 'sphere' || sh === 'radius' ? 'radius' : sh}`;
  }
  const GENERIC_EL = {
    gather: ['The air tightens and the light seems to bend toward a single point as power builds.', 'Pressure builds in the air with a rising hum, and loose cloth and dust lean toward the source.', 'Something unseen gathers in a held breath; the room goes quiet and strangely sharp.'],
    glow: ['the air shimmers and snaps', 'light bends and the shadows twitch', 'a faint haze rolls through the air'],
    sound: ['a sudden, sharp crack', 'a rising hum that breaks off like a snapped string', 'a hard, ringing note'],
    feel: ['a rolling pressure that squeezes the chest', 'a sudden, heavy strangeness in the air', 'a shudder that runs through the stone underfoot'],
    smell: ['bright ozone and dust', 'the cold, dry smell of old magic', 'scorched air and sweat']
  };
  const PHYS_SUB = {
    slashing: ['a whirling storm of razor-edged shards', 'a rending, blade-bright blast'],
    piercing: ['a hail of needle-sharp spikes', 'a volley of darting spines'],
    bludgeoning: ['a hammering wave of force', 'a pounding, concussive blast']
  };
  function elementBundle(id, moveId, pick, rng, which) {
    const E = D.ELEMENTS[id] || null;
    const magicMove = (MOVE_BY_ID[moveId] || {}).group === 'magic' || ['breath', 'gaze', 'ray', 'orb', 'burst', 'wave', 'spray', 'cloud', 'aura', 'hex', 'drain', 'entangle', 'summon'].includes(moveId);
    return {
      id, E, physical: !!(E && E.physical), magical: !!(E && !E.physical),
      tokens(sfx) {
        const t = {}; const k = n => n + sfx, mk = (n, f) => { t[k(n)] = f; };
        const lst = (key, fallback) => (E && E[key] && E[key].length ? E[key] : fallback);
        const ph = E && E.physical;
        mk('sub', () => ph && magicMove ? pick(PHYS_SUB[id] || PHYS_SUB.bludgeoning, 'sub' + sfx) : pick(lst('sub', ['a surge of pale, shimmering light', 'a swirl of drifting motes']), 'sub' + sfx));
        mk('stuff', () => pick(lst('stuff', ['light', 'motes', 'sparks']), 'stuff' + sfx));
        mk('adj', () => pick(lst('adj', ['pale', 'shimmering', 'faint']), 'adj' + sfx));
        mk('gather', () => pick(lst('gather', GENERIC_EL.gather), 'gather' + sfx));
        mk('glow', () => pick(lst('glow', GENERIC_EL.glow), 'glow' + sfx));
        mk('sound', () => pick(lst('sound', GENERIC_EL.sound), 'sound' + sfx));
        mk('feel', () => pick(lst('feel', GENERIC_EL.feel), 'feel' + sfx));
        mk('smell', () => pick(lst('smell', GENERIC_EL.smell), 'smell' + sfx));
        mk('hitv', () => pick(lst('hit', ['strikes']), 'hitv' + sfx));
        mk('gear', () => pick(lst('gear', ['Armor takes the brunt of it.']), 'gear' + sfx));
        mk('residue', () => pick(lst('residue', ['The air settles slowly.']), 'residue' + sfx));
        mk('env', () => pick(lst('env', ['The area is left scarred.']), 'env' + sfx));
        return t;
      },
      wound(tier) { const w = E && E.wound && E.wound[clamp(tier, 0, 5)]; return w && w.length ? pick(w, 'wound' + (which || '')) : 'a painful wound'; }
    };
  }

  // ---- template expansion
  function expand(tpl, cx, depth) {
    depth = depth || 0;
    return String(tpl).replace(/\{([^{}]+)\}/g, (all, key) => {
      const v = resolve(key, cx);
      if (v == null) { cx.missing.push(key); return ''; }
      return depth < 4 ? expand(v, cx, depth + 1) : String(v);
    });
  }
  function resolve(key, cx) {
    const T = cx.tokens;
    let m;
    if ((m = /^v:(\w+)$/.exec(key))) return conj(m[1], false);
    if ((m = /^pv:(\w+)$/.exec(key))) return conj(m[1], cx.pron === 'they');
    if ((m = /^tv:(\w+)$/.exec(key))) return conj(m[1], false);
    let suffix = null, k = key;
    if (/_lc$/.test(k)) { suffix = 'lc'; k = k.slice(0, -3); }
    let up = false;
    if (!(k in T) && /^[A-Z]/.test(k)) { up = true; k = lc1(k); }
    let v = T[k];
    if (v === undefined) {
      if (k === 'they' || k === 'subj') v = T[k];
    }
    if (v === undefined || v === null) return null;
    v = typeof v === 'function' ? v() : v;
    if (up) v = cap(v);
    if (suffix === 'lc') v = lc1(v);
    return v;
  }
  function polish(s) {
    s = String(s).replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/,{2,}/g, ',').replace(/\.{2,}/g, '.').replace(/\.\s*\./g, '.').replace(/ ,/g, ',').trim();
    s = s.replace(/\b([Aa]) (?=[aeiouAEIOU])(?!uni|use|usu|one|once|eu|ubiq)/g, (m, a) => a + 'n ').replace(/\b([Aa])n (?=(?:uni|use|usu|one\b|once\b|eu|ubiq)\w*)/g, (m, a) => a + ' ');
    s = s.replace(/\b([Aa])n (?=h(?!our|onest|onor|eir))/g, (m, a) => a + ' ');
    s = s.replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
    s = s.replace(/\bthe The\b/g, 'the').replace(/\bThe the\b/g, 'The');
    return cap(s);
  }
  function dedupeTarget(s, cx) {
    const nm = cx && cx.tgtName; if (!nm) return s;
    const re = new RegExp(nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "('s)?(?![A-Za-z])", 'gi');
    return s.split(/(?<=[.!?])\s+/).map(sent => { let n = 0; return sent.replace(re, (m, poss) => (++n > 1 && poss ? 'their' : m)); }).join(' ');
  }
  const T = (cx, tpl) => dedupeTarget(polish(expand(tpl, cx)), cx);
  const firstSentence = s => { const m = /^(.*?[.!?])(\s|$)/.exec(s); return m ? m[1] : s; };

  // ---------------------------------------------------------------- composing
  function weaponInfo(p, moveId, ctx) {
    const W = D.WEAPONS[moveId];
    if (!W) return { instr: null, wpart: null };
    const nm = (ctx.weapon && ctx.weapon.name) || p.base;
    const clean = String(nm).toLowerCase().replace(/^(?:an?|the)\s+/, '').replace(/\s+\+\d+$|^\+\d+\s+/g, '').trim();
    const known = new RegExp(D.MOVE_LEX.filter(([, id]) => id === moveId).map(([re]) => re.source).join('|'), 'i');
    const use = clean && clean.split(' ').length <= 4 && known.test(clean) && !/^(attack|strike|melee attack|weapon attack|unarmed)$/.test(clean);
    return { instr: use ? clean.replace(/\s*\(.*$/, '') : null, wpart: null };
  }
  function nameFlair(cx, nameText) {
    const out = [];
    for (const a of D.ADJECTIVES) if (a.re.test(nameText)) { out.push(cx.pick(a.flair, 'adj-' + a.re.source)); if (out.length >= 2) break; }
    return out;
  }

  function lethality(p, ctx, cx) {
    const total = (p.avg + (p.kind === 'area' || p.kind === 'single' ? p.saveAvg : 0)) * ((ctx.entry && ctx.entry.dmgMult) || 1);
    if (!total) return null;
    const lvl = ctx.partyLevel || levelFromCR(ctx.attacker && ctx.attacker.cr) || null;
    const hp = D.HP_BY_LEVEL[clamp(lvl || 5, 1, 20)];
    const frac = total / hp;
    const row = D.LETHALITY.find(r => frac <= r.max);
    const bench = [...D.BENCHMARKS].reverse().find(b => total >= b.hp);
    const line = cx.pick(row.text, 'leth');
    const pct = Math.round(frac * 100);
    let kills = bench ? `A single clean hit would drop ${bench.who} outright.` : 'It would not trouble anyone who can fight.';
    if (bench && bench.hp >= 95) kills = `A single clean hit would drop ${bench.who} outright.`;
    const crit = (p.kind === 'melee' || p.kind === 'ranged') && p.diceAvg ? Math.round(total + p.diceAvg * ((ctx.entry && ctx.entry.dmgMult) || 1)) : null;
    return { total: Math.round(total), frac, pct, level: lvl, text: cap(line), kills, crit, hp };
  }

  function typeWords(p) { return p.types.length ? p.types.join(' + ') : (p.element || ''); }
  function kindLabel(p, spellSpec, moveId) {
    if (p.spellAttack) return p.melee && !p.ranged ? 'Melee spell attack' : 'Ranged spell attack';
    if (spellSpec) return p.save ? `Spell · ${p.save.ability} save` : 'Spell';
    if (p.kind === 'melee') return /weapon attack/i.test(p.text) ? 'Melee weapon attack' : 'Melee attack';
    if (p.kind === 'ranged') return /weapon attack/i.test(p.text) ? 'Ranged weapon attack' : 'Ranged attack';
    if (p.kind === 'area') return `Area · ${p.save ? p.save.ability + ' save' : 'no save'}`;
    if (p.kind === 'single') return `${p.save ? p.save.ability + ' save' : 'Save'}`;
    if (p.kind === 'auto') return 'Automatic';
    if (p.kind === 'multi') return 'Multiattack';
    return 'Ability';
  }

  function describe(attack, ctx) {
    attack = attack || {}; ctx = ctx || {};
    const detail = ctx.detail || 'standard';
    const p = parse(attack, ctx);
    const spellSpec = spellSpecFor(attack, ctx, p);
    if (spellSpec && spellSpec.conditionInflict && !p.conditions.length) spellSpec.conditionInflict.forEach(n => { const c = D.CONDITIONS.find(x => x.re.test(n)); if (c && !p.conditions.some(q => q.id === c.id)) p.conditions.push({ id: c.id, label: c.label }); });
    let narr;
    try {
      if (p.kind === 'multi') narr = describeMultiattackText(p, ctx);
      else narr = compose(p, ctx, spellSpec, detail);
    } catch (e) {
      narr = { title: attack.name || 'Attack', headline: '', chips: [], bullets: [{ label: 'The attack', text: 'It comes in fast, and the table can feel the weight of it.' }], error: String(e && e.message || e) };
    }
    return finish(narr, p, ctx);
  }

  function compose(p, ctx, spellSpec, detail) {
    // utility abilities and non-damaging spells have their own, simpler shape
    let moveId = chooseMove(p, ctx, spellSpec ? { move: spellSpec.move || spellMoveFor(spellSpec, p) } : null);
    if (spellSpec && !spellSpec.move) moveId = chooseMove(p, ctx, { move: spellMoveFor(spellSpec, p) });
    const cx = makeContext(p, ctx, spellSpec, moveId);
    const bullets = [];
    const add = (label, text, kind) => { if (text) bullets.push({ label, text, kind: kind || 'text' }); };
    const move = MOVE_BY_ID[moveId];
    const labels = (spellSpec && spellSpec.labels) || {};

    // spell with a fully hand-written 'utility' entry, or a non-damaging action
    const kindedSpell = spellSpec && !spellSpec.move && !spellSpec.windup && !p.damage.length && p.toHit == null && spellKindOf(p.base, (spellSpec.desc || '') + ' ' + p.text);
    const utilityLike = (p.kind === 'utility' && !p.autoEffect) || (spellSpec && spellSpec.kind === 'utility') || kindedSpell || (!p.damage.length && !p.save && !p.toHit && p.kind !== 'area' && !p.autoEffect && !p.ref);
    if (utilityLike) return composeUtility(p, ctx, spellSpec, cx, detail);

    const spec = Object.assign({}, move, spellSpec && spellSpec.lines ? spellSpec.lines : {});
    if (spellSpec) ['windup', 'motion', 'effect', 'fail', 'miss', 'hit', 'resist', 'crit', 'fumble'].forEach(k => { if (spellSpec[k]) spec[k] = spellSpec[k]; });
    const W = D.WEAPONS[moveId] || {};
    const wi = weaponInfo(p, moveId, ctx);
    const instr = wi.instr || cx.pick(W.instr || ['weapon'], 'instr');
    const wpart = cx.pick(W.wpart || ['edge'], 'wpart');
    let limbV = cx.pick(spec.limb || ['limb'], 'limbfixed');
    if (moveId === 'thrown') {
      const nm = (ctx.weapon && ctx.weapon.name || p.base || '').toLowerCase();
      const big = ['Huge', 'Gargantuan', 'Large'].includes(ctx.attacker && ctx.attacker.size);
      const t = [[/rock|boulder|stone|hail|glacier|ice|chunk/, big ? 'boulder' : 'rock'], [/javelin/, 'javelin'], [/dart/, 'dart'], [/harpoon/, 'harpoon'], [/spear/, 'spear'], [/axe/, 'axe'], [/dagger|knife/, 'dagger'], [/net/, 'net'], [/bone|skull/, 'bone'], [/spike|quill|thorn/, 'spike']].find(([re]) => re.test(nm));
      if (t) limbV = t[1];
    }
    const actV = cx.pick(spec.act || ['the attack'], 'actfixed');
    Object.assign(cx.tokens, { instr, wpart, limb: limbV, limbs: limbV, act: actV });
    // wound text per tier (primary) and per tier of the extra damage
    const wTier = cx.tier;
    cx.tokens.wound = () => cx.el.wound(wTier);
    const e2avg = p.hitClauses.filter(d => d.type && d.type === p.extraTypes[0]).reduce((n, d) => n + d.avg, 0) || p.saveClauses.filter(d => d.type === p.extraTypes[0]).reduce((n, d) => n + d.avg, 0);
    cx.tokens.wound2 = () => cx.el2.wound(tierOfAvg(e2avg || 4));
    const area = p.kind === 'area';
    const single = p.kind === 'single';
    const attackRoll = p.kind === 'melee' || p.kind === 'ranged';
    const E = cx.el.E;
    const magicalEl = !!(E && !E.physical);

    // 1. wind-up ------------------------------------------------------------
    let wind = T(cx, cx.pick(spec.windup || [], 'windup'));
    const extras = [];
    nameFlair(cx, (p.base + ' ' + (instr || '')).toLowerCase()).forEach(f => extras.push(f));
    if (cx.sizeInfo.flair.length && ['Tiny', 'Small', 'Large', 'Huge', 'Gargantuan'].includes(cx.size) && cx.rng() < 0.55) extras.push(cx.pick(cx.sizeInfo.flair, 'sizeflair'));
    if (cx.fam.air && cx.rng() < 0.3) extras.push(cx.pick(cx.fam.air, 'air'));
    if (ctx.weapon && ctx.weapon.rarity && D.AURAS[ctx.weapon.rarity] && D.AURAS[ctx.weapon.rarity].length) extras.push(cx.pick(D.AURAS[ctx.weapon.rarity], 'aura'));
    if (attack_isMagicWeapon(p, ctx)) extras.push(cx.pick(D.AURAS.rare, 'aura2'));
    const maxExtra = detail === 'full' ? 1 : 0;   // extra scene-setting only on request (Full detail)
    wind = [wind].concat(extras.slice(0, maxExtra).map(x => polish(expand(x, cx)))).join(' ');
    add(labels.windup || (spellSpec ? 'The casting' : area || single ? 'Telegraph' : 'Wind-up'), wind, 'windup');

    // 2. the attack -----------------------------------------------------------
    let motion = T(cx, cx.pick(spec.motion || [], 'motion'));
    if (magicalEl && attackRoll && !spellSpec && moveId !== 'ray' && moveId !== 'orb' && detail === 'full' && cx.rng() < 0.8) motion += ' ' + T(cx, cx.pick(['{Sub} wreathes the attack: {glow}, with {sound}.', 'The strike is wrapped in {sub}; {glow}.', 'As it lands, {glow}, and there is {sound}.'], 'flour'));
    if (p.area || (spellSpec && spellSpec.shape)) {
      const sc = areaScale(p, spellSpec);
      if (sc && (area || spellSpec) && detail === 'full' && cx.rng() < 0.8) motion += ' ' + areaSentence(p, spellSpec, sc);
    }
    add(labels.motion || (spellSpec ? 'The spell' : area || single ? 'The attack' : 'The attack'), motion, 'motion');

    // 3. area effect line
    const effectOnly = !!p.autoEffect;
    if (spec.effect && (area || single || effectOnly)) add(area ? 'Across the area' : 'The effect', T(cx, cx.pick(spec.effect, 'effect')), 'effect');
    else if (effectOnly) add('The effect', T(cx, cx.pick(D.NO_DAMAGE.area, 'nodmg')), 'effect');

    // 4. hit / fail ---------------------------------------------------------
    const hitPool = area || single ? (spec.fail || spec.hit) : spec.hit;
    let hit = cx.noDmg
      ? T(cx, cx.pick(area ? D.NO_DAMAGE.area : single ? D.NO_DAMAGE.fail : D.NO_DAMAGE.hit, 'nodmg'))
      : T(cx, cx.pick(hitPool || ['{Act} {hitv} {tgtPoss} {part}, leaving {wound}.'], 'hit'));
    const hitExtras = [];
    if (!cx.noDmg) { const gp = E && (E.physical && (move && move.group === 'natural') ? E.gearNatural : E.gear); if (gp && cx.rng() < (cx.tier >= 2 ? 0.55 : 0.3)) hitExtras.push(cx.pick(gp, 'gear')); }
    if (!cx.noDmg && E && E.residue && cx.rng() < 0.3) hitExtras.push(cx.pick(E.residue, 'residue'));
    if (!cx.noDmg && D.TYPE_FLAIR[cx.famId] && cx.rng() < 0.2) hitExtras.push(cx.pick((['Tiny', 'Small', 'Medium'].includes(cx.size) && D.TYPE_FLAIR_SMALL[cx.famId]) || D.TYPE_FLAIR[cx.famId], 'typeflair'));
    const maxHit = detail === 'full' ? 1 : 0;
    hit = [hit].concat(hitExtras.slice(0, maxHit).map(x => polish(expand(x, cx)))).join(' ');
    if (!effectOnly) add(area ? 'Caught in it' : single ? 'On a failed save' : 'On a hit', hit, 'hit');

    // 5. extra damage types ---------------------------------------------------
    const extraBullets = [];
    p.extraTypes.slice(0, 2).forEach((t, i) => {
      const bundle = i === 0 ? cx.el2 : elementBundle(t, moveId, cx.pick, cx.rng, 3);
      const sfx = i === 0 ? '2' : '3';
      const c2 = Object.assign({}, cx, { tokens: Object.assign({}, cx.tokens, bundle.tokens('2')) });
      c2.tokens.wound2 = () => bundle.wound(clamp(tierOfAvg(p.hitClauses.concat(p.saveClauses).filter(d => d.type === t).reduce((n, d) => n + d.avg, 0) || 3), 0, 5));
      const pool = (bundle.E && bundle.E.physical)
        ? ['A second force rides in with the blow: {sub2} {hitv2} {tgtPoss} {part} as well, leaving {wound2}.', 'The wound is worsened by {stuff2}; it {hitv2} deeper still, leaving {wound2}.']
        : ['On top of the blow, {sub2} {hitv2} {tgtPoss} {part}, leaving {wound2}.', 'The attack carries {sub2} with it; {glow2}. It {hitv2} {tgtPoss} {part}, leaving {wound2}.', 'A second sting follows the first: {sub2} {hitv2} {them} as well, leaving {wound2}.'];
      const dmg = p.hitClauses.concat(p.saveClauses).filter(d => d.type === t).reduce((n, d) => n + d.avg, 0);
      const label = `Extra ${t} damage`;
      extraBullets.push({ label, text: polish(expand(cx.pick(pool, 'extra'), c2)) + (bundle.E && bundle.E.gear && cx.rng() < 0.35 ? ' ' + polish(expand(cx.pick(bundle.E.gear, 'gear2'), c2)) : ''), kind: 'extra', avg: dmg });
    });
    extraBullets.forEach(b => bullets.push(b));

    // 6. miss / resist -------------------------------------------------------
    let miss;
    if (effectOnly) { /* no hit or resist beat: the effect is the whole story */ }
    else if (area || single) {
      const dodgePool = cx.noDmg ? D.NO_DAMAGE.resist : (E && E.dodge) ? E.dodge : ['{Tgt} manages to resist the worst of it.'];
      miss = T(cx, cx.pick(cx.noDmg ? dodgePool : (spec.resist || spec.miss ? [].concat(spec.resist || [], spec.miss || [], dodgePool) : dodgePool), 'dodge'));
      add(area ? 'Those who resist' : 'On a success', miss + (p.half && p.saveAvg && cx.rng() < 0.6 ? ' Half the force still gets through.' : ''), 'miss');
    } else if (attackRoll) {
      const missPool = (magicalEl && (moveId === 'ray' || moveId === 'orb' || spellSpec) && E.miss) ? E.miss : (spec.miss || ['The attack misses.']);
      miss = T(cx, cx.pick(missPool, 'miss'));
      add('If it misses', miss, 'miss');
    }

    // 7. conditions & riders -------------------------------------------------------
    const condBullets = [];
    const seenCond = new Set();
    const priority = ['paralyzed', 'petrified', 'stunned', 'sleep', 'swallowed', 'engulfed', 'banish', 'charmed', 'frightened', 'blinded', 'restrained', 'grappled', 'poisoned', 'prone', 'push', 'pull', 'drain', 'heal', 'disease', 'curse', 'burning', 'frozen', 'slowed', 'exhaustion', 'confused', 'silenced', 'disarm', 'deafened', 'incapacitated', 'drown', 'bleed', 'invisible_target', 'teleported'];
    let conds = p.conditions.filter(c => c.id).sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id));
    // do not report a condition twice when one implies the other
    if (conds.some(c => c.id === 'swallowed')) conds = conds.filter(c => !['restrained', 'blinded', 'grappled'].includes(c.id) || p.text.match(new RegExp(c.id, 'i')) && false);
    if (conds.some(c => c.id === 'paralyzed')) conds = conds.filter(c => !['incapacitated'].includes(c.id));
    if (conds.some(c => c.id === 'petrified')) conds = conds.filter(c => !['restrained', 'paralyzed', 'incapacitated'].includes(c.id));
    const maxConds = detail === 'brief' ? 1 : detail === 'full' ? 5 : 3;
    conds.slice(0, maxConds).forEach(c => {
      const def = D.CONDITIONS.find(x => x.id === c.id); if (!def || seenCond.has(c.id)) return; seenCond.add(c.id);
      let text = T(cx, cx.pick(def.feel, 'cond-' + c.id));
      condBullets.push({ label: c.label, text, kind: 'condition', cond: c });
    });
    condBullets.forEach(b => bullets.push(b));
    // lethality
    const leth = lethality(p, ctx, cx);
    if (leth && detail !== 'brief') {
      const pctTxt = leth.level ? ` (about ${leth.pct}% of a level-${leth.level} adventurer's hit points)` : '';
      let t = `${leth.text} — roughly ${leth.total} damage${pctTxt}. ${leth.kills}`;
      if (leth.crit && p.kind !== 'area') t += ` On a critical hit, about ${leth.crit}.`;
      add('Weight of the blow', t, 'lethality');
    }
    // variant & traits
    if (detail === 'full' && ctx.entry) {
      const v = ctx.entry.variant, mult = ctx.entry.dmgMult || 1;
      if (mult > 1.05 || (v && v.dmgMult > 1)) add('Mark of the creature', cx.pick(D.VARIANT_LINES.up, 'vup'), 'variant');
      else if (mult < 0.95 || (v && v.dmgMult < 1)) add('Mark of the creature', cx.pick(D.VARIANT_LINES.down, 'vdown'), 'variant');
    }
    // 8. scene dressing (full)
    if (detail === 'full') {
      const scene = [];
      if (E && E.env) scene.push(cx.pick(E.env, 'env'));
      scene.push(cx.pick(D.CROWD[cx.tier], 'crowd'));
      if (E && E.smell && E.sound && cx.rng() < 0.7) scene.push(`Afterward: ${T(cx, '{smell}')} lingers, and ${T(cx, '{sound}')} still echoes in the ears.`);
      add('The scene', scene.map(x => polish(expand(x, cx))).join(' '), 'scene');
    }
    // 9. rules at a glance & DM tip (full)
    if (detail === 'full') {
      const rules = [];
      if (p.save) rules.push(`DC ${p.save.dc != null ? p.save.dc : '?'} ${p.save.ability} save${p.half ? ' (half damage on a success)' : ''}`);
      if (p.toHit != null) rules.push(`${p.toHit >= 0 ? '+' : ''}${p.toHit} to hit${p.reach ? `, reach ${p.reach} ft.` : ''}${p.range ? `, range ${p.range}${p.longRange ? '/' + p.longRange : ''} ft.` : ''}`);
      if (p.hitClauses.length) rules.push('Damage ' + p.hitClauses.map(d => `${d.dice || d.avg}${d.type ? ' ' + d.type : ''}`).join(' + ') + (p.hitClauses.length > 1 || p.hitClauses[0].dice ? ` (avg ${Math.round(p.avg)})` : ''));
      conds.slice(0, 5).forEach(c => { const def = D.CONDITIONS.find(x => x.id === c.id); if (def) rules.push(`${def.label}${c.duration ? ' (' + c.duration + ')' : ''}${c.escapeDC ? ', escape DC ' + c.escapeDC : ''}: ${def.dm}`); });
      if (p.recharge) rules.push(`Recharge ${p.recharge}`);
      if (rules.length) add('Rules at a glance', rules.join(' · '), 'rules');
      add('DM tip', polish(expand(cx.pick(D.TELLS, 'tell'), cx)), 'tip');
    }

    const result = ctx.result ? resultLine(p, ctx, spec, cx, { hit, miss, attackRoll, area, single }) : null;
    const chips = [kindLabel(p, spellSpec, moveId)];
    if (p.types.length) chips.push(p.types.join(' + ')); else if (cx.el.id) chips.push(cx.el.id);
    { const ac = areaChip(p, spellSpec); if (ac) chips.push(ac); }
    if (p.reach) chips.push(`reach ${p.reach} ft`); if (p.range) chips.push(`range ${p.range} ft`);
    if (p.save) chips.push(`DC ${p.save.dc != null ? p.save.dc : '?'} ${p.save.ability.slice(0, 3)}`);
    if (leth) chips.push(`~${leth.total} dmg · ${D.TIERS[cx.tier].name}`); else chips.push(D.SEVERITY[cx.tier]);
    return { title: p.name, bullets, result, chips, tier: cx.tier, moveId, role: cx.role, element: cx.el.id, lethality: leth, cx };
  }
  function attack_isMagicWeapon(p, ctx) { return /\+\d|magic|enchanted|flame tongue|frost brand|vorpal/i.test(p.name) && !(ctx.weapon && ctx.weapon.rarity); }

  function resultLine(p, ctx, spec, cx, parts) {
    const r = ctx.result, o = r.outcome;
    let text = '', label = 'What just happened';
    if (o === 'crit') text = polish(expand(cx.pick(spec.crit || [], 'crit') || '', cx)) + ' ' + parts.hit;
    else if (o === 'hit') text = parts.hit;
    else if (o === 'miss') text = parts.miss;
    else if (o === 'fumble') text = polish(expand(cx.pick(spec.fumble || spec.miss || [], 'fumble'), cx)) || parts.miss;
    else if (o === 'save') text = r.failed === false ? (parts.miss || '') : parts.hit;
    else text = '';
    if (!text) return null;
    if (r.damage != null && o !== 'miss' && o !== 'fumble' && !(o === 'save' && r.failed === false)) text += ` (${r.damage} damage)`;
    return { label, text: text.trim(), outcome: o };
  }

  function spellKindOf(name, desc) {
    const K = D.SPELL_KINDS || [], nm = cleanName(name || '');
    const byName = K.find(k => k.name.test(nm));
    if (byName) return byName;
    return K.find(k => k.desc && k.desc.test(desc || '')) || null;
  }
  function composeUtility(p, ctx, spellSpec, cx, detail) {
    const bullets = [];
    const add = (label, text, kind) => { if (text) bullets.push({ label, text, kind: kind || 'text' }); };
    const hay = (p.base + ' ' + p.text.slice(0, 220)).toLowerCase();
    let lines, tip, id = null;
    let ordered = null;
    if (spellSpec && (spellSpec.windup || spellSpec.motion)) {
      ordered = { windup: spellSpec.windup, motion: spellSpec.motion, effect: spellSpec.effect };
      lines = [].concat(spellSpec.windup || [], spellSpec.motion || []);
      tip = spellSpec.tip;
    } else if (spellSpec && spellSpec.lines && spellSpec.lines.length) { lines = spellSpec.lines; tip = spellSpec.tip; }
    else {
      const byName = D.UTILITY.find(u => u.id !== 'generic' && u.re.test(p.base));
      const byText = byName || D.UTILITY.find(u => u.id !== 'generic' && u.re.test(hay));
      const u = byText || D.UTILITY.find(x => x.id === 'generic');
      id = u.id; lines = u.lines; tip = u.tip;
    }
    // spells with no entry of their own: a kind matched from the name (then the description), else the school
    if (spellSpec && !(spellSpec.windup || spellSpec.motion || spellSpec.lines)) {
      const kind = spellKindOf(p.base, (spellSpec.desc || '') + ' ' + p.text);
      if (kind) { ordered = { windup: kind.windup, effect: kind.effect }; tip = kind.tip; lines = kind.windup; spellSpec = Object.assign({}, spellSpec, { _kind: kind.id }); }
    }
    if (spellSpec && !ordered && !(spellSpec.windup || spellSpec.motion || spellSpec.lines)) {
      const sc = D.SPELL_SCHOOLS && D.SPELL_SCHOOLS[spellSpec.school];
      if (sc && !(cx.p.kind === 'utility' && id && id !== 'generic' && !['heal', 'detect'].includes(id) && false)) { lines = sc.lines; tip = sc.tip; }
    }
    const pickLine = () => cx.pick(lines, 'util');
    const labels = (spellSpec && spellSpec.labels) || {};
    if (ordered) {
      if (ordered.windup) add(labels.windup || 'The casting', T(cx, cx.pick(ordered.windup, 'uw')), 'windup');
      if (ordered.motion) add(labels.motion || 'The spell', T(cx, cx.pick(ordered.motion, 'um')), 'motion');
      if (ordered.effect && detail !== 'brief') add('The effect', T(cx, cx.pick(ordered.effect, 'ue')), 'effect');
    } else {
      add(labels.windup || (spellSpec ? 'The casting' : 'What it looks like'), T(cx, pickLine()), 'windup');
      if (lines.length > 1 && detail !== 'brief' && cx.rng() < 0.6) add(labels.motion || 'Then', T(cx, pickLine()), 'motion');
    }
    // conditions it inflicts
    if (p.save && spellSpec && detail !== 'brief') add('If it takes hold', T(cx, cx.pick(D.NO_DAMAGE.fail, 'nd-fail')), 'hit');
    p.conditions.slice(0, detail === 'full' ? 4 : 2).forEach(c => {
      const def = D.CONDITIONS.find(x => x.id === c.id); if (!def) return;
      add(c.label, T(cx, cx.pick(def.feel, 'cond-' + c.id)), 'condition');
    });
    if (p.save && spellSpec && detail !== 'brief') add('Those who resist', T(cx, cx.pick(D.NO_DAMAGE.resist, 'nd-resist')), 'miss');
    if (p.damage.length) {
      const bundle = cx.el;
      cx.tokens.wound = () => bundle.wound(cx.tier);
      add('If it hurts', T(cx, 'The effect {hitv} {tgtPoss} body, leaving {wound}.'), 'hit');
    }
    if (detail === 'full') {
      const rules = [];
      if (p.save) rules.push(`DC ${p.save.dc != null ? p.save.dc : '?'} ${p.save.ability} save`);
      if (p.recharge) rules.push(`Recharge ${p.recharge}`);
      if (p.perDay) rules.push(`${p.perDay}/day`);
      p.conditions.slice(0, 4).forEach(c => { const def = D.CONDITIONS.find(x => x.id === c.id); if (def) rules.push(`${def.label}${c.duration ? ' (' + c.duration + ')' : ''}: ${def.dm}`); });
      if (rules.length) add('Rules at a glance', rules.join(' · '), 'rules');
      if (tip) add('DM tip', polish(expand(tip, cx)), 'tip');
    }
    const chips = [kindLabel(p, spellSpec, 'utility')];
    if (p.recharge) chips.push(`recharge ${p.recharge}`); if (p.cost) chips.push(`costs ${p.cost} action${p.cost > 1 ? 's' : ''}`); if (p.perDay) chips.push(`${p.perDay}/day`);
    return { title: p.name, bullets, result: null, chips, tier: cx.tier, moveId: 'utility', role: cx.role, element: cx.el.id, cx };
  }

  function describeMultiattackText(p, ctx) {
    const cx = makeContext(p, ctx, null, 'strike');
    const text = p.text;
    const bullets = [];
    const mm = /makes? (\w+) (?:melee |weapon |ranged )?attacks?/i.exec(text);
    const count = mm ? mm[1].toLowerCase() : 'several';
    bullets.push({ label: 'The onslaught', text: polish(expand(cx.pick([
      `{Subj} does not stop at one: ${count} attacks come in rapid, chained succession, each one covering for the last.`,
      `There is no pause. {Subj} {v:flow} from one strike into the next, ${count} attacks in a single, tumbling rush.`,
      `{Subj} {v:attack} again and again — ${count} blows before the target can draw a full breath.`
    ], 'multi'), cx)), kind: 'windup' });
    const parts = [];
    const re = /(?:(one|two|three|four|five|six|seven|eight|nine|ten|\d+) )?(?:with|using) (?:its|their|his|her|the|a|an)? ?([a-z' -]+?)(?=,| and|\.| or|$)/gi; let m;
    while ((m = re.exec(text))) { const w = m[2].trim(); if (w && w.length < 28) parts.push((m[1] ? m[1].toLowerCase() + ' ' : '') + w); }
    if (parts.length) bullets.push({ label: 'The sequence', text: `${parts.slice(0, 4).join(', then ')}.`.replace(/^./, c => c.toUpperCase()), kind: 'text' });
    return { title: p.name, bullets, result: null, chips: ['Multiattack'], tier: cx.tier, moveId: 'multi', role: cx.role, element: null, cx };
  }

  // ---------------------------------------------------------------- finishing, rendering
  function finish(narr, p, ctx) {
    const lead = narr.bullets.length ? narr.bullets : [];
    const detail = ctx.detail || 'standard';
    const brief = (() => {
      const w = lead.find(b => b.kind === 'windup'), h = lead.find(b => b.kind === 'hit'), mo = lead.find(b => b.kind === 'motion');
      return [w && firstSentence(w.text), mo && firstSentence(mo.text), h && firstSentence(h.text)].filter(Boolean).join(' ');
    })();
    const lines = lead.map(b => `• ${b.label}: ${b.text}`);
    if (narr.result) lines.unshift(`★ ${narr.result.label}: ${narr.result.text}`);
    const headline = narr.chips ? narr.chips.join(' · ') : '';
    const text = `${narr.title}${headline ? ' — ' + headline : ''}\n${lines.join('\n')}`;
    const html = `<div class="an-narr"><div class="an-head"><b>${esc(narr.title)}</b>${narr.chips ? narr.chips.map(c => `<span class="an-chip">${esc(c)}</span>`).join('') : ''}</div>`
      + (narr.result ? `<div class="an-result"><b>${esc(narr.result.label)}.</b> ${esc(narr.result.text)}</div>` : '')
      + `<ul class="an-list">${lead.map(b => `<li class="an-${esc(b.kind || 'text')}"><b>${esc(b.label)}.</b> ${esc(b.text)}</li>`).join('')}</ul></div>`;
    const out = { title: narr.title, headline, chips: narr.chips || [], bullets: lead, result: narr.result || null, brief, text, html, tier: narr.tier, move: narr.moveId, role: narr.role, element: narr.element, lethality: narr.lethality || null, profile: p, detail };
    if (narr.error) out.error = narr.error;
    if (narr.cx && narr.cx.missing && narr.cx.missing.length) out.missingTokens = narr.cx.missing.slice();
    return out;
  }

  // a sequence of rolled attacks (a multiattack's two attacks, a full turn) read as one exchange
  function describeSequence(list, ctx) {
    ctx = ctx || {};
    const items = list.map((a, i) => (a && a.bullets ? a : describe(a.attack || a, Object.assign({}, ctx, a.ctx || {}, { seed: (ctx.seed || 0) + i, detail: 'brief' }))));
    const cx = { rng: mulberry(hash32(items.map(n => n.title).join('|') + (ctx.seed || 0))) };
    const pick = arr => arr[Math.floor(cx.rng() * arr.length)];
    const joins = ['Without a pause,', 'Before the echo of that fades,', 'Almost in the same motion,', 'Then,', 'And right behind it,', 'On the heels of the first,'];
    const parts = items.map((n, i) => (i === 0 ? n.brief : `${pick(joins)} ${lc1(n.brief)}`));
    const bullets = items.map((n, i) => ({ label: `${i + 1}. ${n.title}`, text: n.brief, kind: 'text' }));
    return { title: items.map(n => n.title).join(' → '), text: parts.join(' '), bullets, items };
  }

  function describeMonster(monster, ctx) {
    ctx = Object.assign({}, ctx || {});
    const att = { name: monster.name, type: monster.type, size: monster.size, cr: monster.cr, str: monster.str, dex: monster.dex, traits: monster.traits };
    const out = { actions: [], bonus: [], reactions: [], legendary: [], spells: [] };
    const run = (list, key) => (list || []).forEach(a => { out[key].push(describe(a, Object.assign({}, ctx, { attacker: att }))); });
    run(monster.actions, 'actions'); run(monster.bonusActions || monster.bonus, 'bonus'); run(monster.reactions, 'reactions'); run(monster.legendary, 'legendary');
    (monster.spellcasting || []).forEach(b => (b.groups || []).forEach(g => (g.spells || []).forEach(s => {
      out.spells.push(describe({ name: s, text: `Spell cast by the creature (${g.label || g.kind}).`, isSpell: true, source: 'spell' }, Object.assign({}, ctx, { attacker: att })));
    })));
    return out;
  }

  // ---- styles (injected once when a document exists) so every host page gets the same look
  const CSS = '.an-narr{margin:.35rem 0;padding:.4rem .6rem;border-left:3px solid var(--gold,#c9a227);background:rgba(201,162,39,.06);font-size:.85rem;line-height:1.45}'
    + '.an-head{display:flex;flex-wrap:wrap;gap:.35rem;align-items:center;margin-bottom:.3rem}.an-head b{color:var(--gold,#c9a227)}'
    + '.an-chip{font-size:.68rem;padding:.05rem .4rem;border:1px solid var(--border,#444);border-radius:999px;color:var(--text-dim,#aaa)}'
    + '.an-result{margin:.2rem 0 .35rem;padding:.25rem .45rem;background:rgba(201,162,39,.12);border-radius:3px}'
    + '.an-list{margin:0;padding-left:1.1rem}.an-list li{margin:.18rem 0}.an-list li b{color:var(--gold,#c9a227);font-weight:600}'
    + '.an-list li.an-lethality,.an-list li.an-tip{color:var(--text-dim,#aaa);font-style:italic}'
    + '.an-tools{display:flex;gap:.4rem;margin:.3rem 0}.an-tools button{font-size:.75rem;padding:.1rem .5rem;cursor:pointer}';
  if (typeof document !== 'undefined' && document.head && !document.getElementById('anStyle')) { const st = document.createElement('style'); st.id = 'anStyle'; st.textContent = CSS; document.head.appendChild(st); }

  window.AttackNarrator = { describe, describeSequence, describeMonster, parse, version: 1, data: D, _internals: { spellKindOf, chooseMove, makeContext, expand, polish, conj, parseDamage, parseArea, parseConditions, tierOfAvg, lethality } };
})();
