// 🧪 Battle Field (test tab). A drag-and-drop field where the DM places monsters and players as
// tokens, hovers a token for its info, selects monster(s) and clicks a player to roll their attacks.
// Everything is reused from the Combat tab, nothing re-implemented: monsterDatabase (+ the shared
// loader), buildBattleEntry (rolled HP, AC, variants, traits), buildMonsterTooltipHtml (hover info),
// battleParseAttack / battleRollDamage (attack + damage parsing and dice) and the connected-players
// roster. Classic script: it shares the monolith's globals and is wired up from the tab markup.
(function () {
  const bt = { tokens: [], selected: new Set(), nextId: 1, customPlayers: [], drag: null, last: null };
  window.btState = bt; // exposed for tests

  // ---------- styles ----------
  const style = document.createElement('style');
  style.textContent = `
    .bt-wrap { display:grid; grid-template-columns:300px 1fr; gap:0.8rem; align-items:start; }
    @media (max-width:800px) { .bt-wrap { grid-template-columns:1fr; } }
    .bt-side { background:var(--surface); border:1px solid var(--border); padding:0.6rem; max-height:78vh; overflow:auto; }
    .bt-side h4 { color:var(--gold); margin:0.6rem 0 0.3rem; font-size:0.95rem; letter-spacing:0.05em; }
    .bt-side h4:first-child { margin-top:0; }
    .bt-search { width:100%; box-sizing:border-box; background:var(--bg); border:1px solid var(--border); color:var(--text); padding:0.35rem 0.5rem; font-family:inherit; margin-bottom:0.3rem; }
    .bt-chip { display:flex; justify-content:space-between; gap:0.4rem; padding:0.25rem 0.45rem; margin-bottom:0.2rem; background:var(--bg); border:1px solid var(--border); cursor:grab; font-size:0.85rem; user-select:none; }
    .bt-chip:hover { border-color:var(--gold); }
    .bt-chip small { color:var(--text-dim); white-space:nowrap; }
    .bt-chip.player { border-left:3px solid #4caf7d; }
    .bt-chip.monster { border-left:3px solid #a83232; }
    .bt-addrow { display:flex; gap:0.25rem; margin-top:0.3rem; }
    .bt-addrow input { width:100%; min-width:0; background:var(--bg); border:1px solid var(--border); color:var(--text); padding:0.25rem; font-family:inherit; }
    .bt-field { position:relative; height:76vh; min-height:480px; border:2px solid var(--border); overflow:hidden;
      background-color:#1c1712; background-image:linear-gradient(rgba(255,255,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.05) 1px,transparent 1px); background-size:48px 48px; }
    .bt-field.over { border-color:var(--gold); }
    .bt-empty { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:var(--text-dim); text-align:center; padding:2rem; pointer-events:none; }
    .bt-token { position:absolute; width:120px; transform:translate(-50%,-34px); text-align:center; cursor:pointer; user-select:none; touch-action:none; }
    .bt-token .disc { position:relative; width:60px; height:60px; margin:0 auto; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.9rem; line-height:1;
      background:radial-gradient(circle at 35% 30%, var(--bt-hi), var(--bt-lo)); border:4px solid var(--bt-ring); box-shadow:0 3px 8px rgba(0,0,0,0.7), inset 0 0 8px rgba(0,0,0,0.5); }
    .bt-token.monster { --bt-hi:#b84444; --bt-lo:#4a1414; --bt-ring:#2b0d0d; }
    .bt-token.player { --bt-hi:#3fae78; --bt-lo:#12402a; --bt-ring:#0b2a1b; }
    .bt-token.t-uncommon .disc { border-color:#4caf7d; } .bt-token.t-rare .disc { border-color:#5b9cf6; }
    .bt-token.t-superrare .disc { border-color:#c47cf5; } .bt-token.t-legendary .disc { border-color:#e8963a; }
    .bt-token.selected .disc { box-shadow:0 0 0 3px var(--gold), 0 0 16px var(--gold); }
    .bt-token.target-ready.player .disc { box-shadow:0 0 0 3px #e8d060, 0 0 14px #e8d060; animation:btPulse 1.2s infinite; }
    @keyframes btPulse { 50% { box-shadow:0 0 0 5px #e8d060, 0 0 20px #e8d060; } }
    .bt-token.dead { opacity:0.45; filter:grayscale(1); }
    .bt-token .lbl { display:inline-block; max-width:116px; margin-top:4px; padding:1px 7px; background:rgba(10,8,6,0.82); border:1px solid var(--border); border-radius:9px; font-size:0.72rem; color:var(--text); line-height:1.25; }
    .bt-token .bar { position:relative; height:14px; width:84px; margin:3px auto 0; background:#000; border:1px solid #000; border-radius:6px; overflow:hidden; }
    .bt-token .bar i { position:absolute; inset:0 auto 0 0; background:#4caf7d; }
    .bt-token .bar span { position:relative; display:block; font-size:0.62rem; line-height:14px; color:#fff; text-shadow:0 0 2px #000; }
    .bt-token .ac { position:absolute; top:-2px; left:14px; min-width:20px; padding:0 3px; font-size:0.65rem; background:#1a1a22; border:1px solid #888; border-radius:8px; color:#dfe6ff; line-height:15px; }
    .bt-token .x { position:absolute; top:-4px; right:14px; display:none; background:#000; color:#fff; border:1px solid #888; border-radius:50%; font-size:0.7rem; line-height:1; width:18px; height:18px; cursor:pointer; padding:0; }
    .bt-token:hover .x { display:block; }
    .bt-sec { margin-top:0.35rem; padding-top:0.3rem; border-top:1px solid var(--border); font-size:0.8rem; }
    .bt-sec b { color:var(--gold); }
    .bt-pos { color:#4caf7d; } .bt-neg { color:#e05252; }
    .bt-hint { color:var(--text-dim); font-size:0.85rem; margin:0.2rem 0 0.5rem; }
    .bt-hint b { color:var(--gold); }
    .bt-bar { display:flex; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.4rem; align-items:center; }
    .bt-atk { border:1px solid var(--border); padding:0.4rem 0.6rem; margin-bottom:0.6rem; background:var(--bg); }
    .bt-atk h5 { margin:0 0 0.3rem; color:var(--gold); font-size:0.95rem; }
    .bt-atk .sub { margin:0.4rem 0 0 0.6rem; padding-left:0.6rem; border-left:2px solid var(--border); }
    .bt-hit { color:#4caf7d; } .bt-miss { color:#e05252; } .bt-crit { color:#f7d774; font-weight:bold; }
    .bt-note { color:var(--text-dim); font-size:0.8rem; }
  `;
  document.head.appendChild(style);

  const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
  const fmt = n => (n >= 0 ? '+' : '') + n;

  // ---------- roster sources ----------
  function playerSources() {
    const out = [];
    const online = (typeof connectedPlayers !== 'undefined' ? connectedPlayers : []).filter(p => p.role === 'player');
    online.forEach(p => out.push({ key: 'net:' + p.uid, uid: p.uid, name: p.username || 'Player', ac: p.ac != null ? p.ac : 10, hp: p.currentHp != null ? p.currentHp : 10, maxHp: p.maxHp != null ? p.maxHp : (p.currentHp != null ? p.currentHp : 10) }));
    try {
      const sh = computeCharacterSheet();
      out.push({ key: 'me', name: (typeof characterName !== 'undefined' && characterName) || 'My character', ac: sh.ac.total, hp: characterCurrentHp, maxHp: sh.maxHp.total });
    } catch (e) { /* sheet not ready */ }
    bt.customPlayers.forEach(p => out.push(p));
    return out;
  }
  function monsterMatches(q) {
    const db = (typeof monsterDatabase !== 'undefined' ? monsterDatabase : []);
    const s = q.toLowerCase().trim();
    return db.filter(m => !s || m.name.toLowerCase().includes(s)).slice(0, 60);
  }

  // ---------- side panel ----------
  window.btRenderSide = function () {
    const side = document.getElementById('btSide'); if (!side) return;
    const q = (document.getElementById('btMonsterSearch') || {}).value || '';
    const keep = document.activeElement && document.activeElement.id;
    const ms = monsterMatches(q);
    const players = playerSources();
    const loaded = typeof monsterDatabaseLoaded !== 'undefined' && monsterDatabaseLoaded;
    side.innerHTML = `
      <h4>👹 Monsters</h4>
      <input id="btMonsterSearch" class="bt-search" placeholder="Search monsters…" value="${esc(q)}" oninput="btRenderMonsterList()">
      <div id="btMonsterList"></div>
      <h4>🧑 Players</h4>
      <div id="btPlayerList">${players.map(p => `<div class="bt-chip player" draggable="true" data-bt="player" data-key="${esc(p.key)}"><span>${esc(p.name)}</span><small>AC ${p.ac} · HP ${p.hp}/${p.maxHp}</small></div>`).join('')}</div>
      <div class="bt-addrow"><input id="btNewName" placeholder="Name"><input id="btNewAc" type="number" placeholder="AC" style="max-width:3.5rem"><input id="btNewHp" type="number" placeholder="HP" style="max-width:3.5rem"><button class="action-btn" onclick="btAddCustomPlayer()">＋</button></div>
      <div class="bt-note" style="margin-top:0.3rem">Drag onto the field. Add a quick test player above.</div>`;
    btRenderMonsterList();
    if (!loaded) document.getElementById('btMonsterList').innerHTML = '<div class="bt-note">Loading monsters…</div>';
    if (keep) { const el = document.getElementById(keep); if (el && el.focus) { el.focus(); if (el.setSelectionRange && el.value) el.setSelectionRange(el.value.length, el.value.length); } }
  };
  window.btRenderMonsterList = function () {
    const box = document.getElementById('btMonsterList'); if (!box) return;
    const q = (document.getElementById('btMonsterSearch') || {}).value || '';
    box.innerHTML = monsterMatches(q).map(m => `<div class="bt-chip monster" draggable="true" data-bt="monster" data-key="${esc(m.name)}"><span>${esc(m.name)}</span><small>CR ${esc(m.cr)} · AC ${esc(m.ac)}</small></div>`).join('') || '<div class="bt-note">No matches.</div>';
  };
  window.btAddCustomPlayer = function () {
    const name = document.getElementById('btNewName').value.trim() || 'Test player';
    const ac = parseInt(document.getElementById('btNewAc').value, 10) || 14;
    const hp = parseInt(document.getElementById('btNewHp').value, 10) || 30;
    bt.customPlayers.push({ key: 'custom:' + (bt.nextId++), name, ac, hp, maxHp: hp });
    btRenderSide();
  };

  // ---------- tokens ----------
  function makeToken(kind, key, x, y) {
    if (kind === 'monster') {
      const monster = monsterDatabase.find(m => m.name === key); if (!monster) return null;
      const entry = buildBattleEntry(monster);
      return { id: bt.nextId++, kind, x, y, name: entry.displayName || monster.name, ac: entry.ac, hp: entry.hp, maxHp: entry.maxHp, entry, monster };
    }
    const p = playerSources().find(s => s.key === key); if (!p) return null;
    return { id: bt.nextId++, kind, x, y, name: p.name, ac: p.ac, hp: p.hp, maxHp: p.maxHp, uid: p.uid, srcKey: p.key };
  }
  window.btRenderField = function () {
    const f = document.getElementById('btField'); if (!f) return;
    const ready = [...bt.selected].length > 0;
    f.innerHTML = (bt.tokens.length ? '' : '<div class="bt-empty">Drag monsters and players from the left onto the field.</div>') + bt.tokens.map(t => {
      const pct = Math.max(0, Math.min(100, Math.round((t.hp / Math.max(1, t.maxHp)) * 100)));
      const tier = t.entry && t.entry.variant ? t.entry.variant.tier : '';
      const cls = ['bt-token', t.kind, tier ? 't-' + tier : '', bt.selected.has(t.id) ? 'selected' : '', ready && t.kind === 'player' ? 'target-ready' : '', t.hp <= 0 ? 'dead' : ''].join(' ');
      const icon = t.kind === 'player' ? '🛡️' : monsterIcon(t.monster);
      return `<div class="${cls}" data-id="${t.id}" style="left:${t.x}px;top:${t.y}px"><button class="x" data-x="${t.id}" title="Remove">×</button><span class="ac" title="Armor Class">🛡${t.ac == null ? '—' : t.ac}</span><div class="disc">${icon}</div><div class="lbl">${esc(t.name)}</div><div class="bar"><i style="width:${pct}%"></i><span>${t.hp}/${t.maxHp}</span></div></div>`;
    }).join('');
    const hint = document.getElementById('btHint');
    if (hint) hint.innerHTML = bt.selected.size
      ? `<b>${bt.selected.size}</b> monster${bt.selected.size > 1 ? 's' : ''} selected — <b>left-click a player</b> to roll the attack${bt.selected.size > 1 ? 's' : ''}. Right-click monsters to add/remove.`
      : '<b>Left-click</b> a monster to select it, <b>right-click</b> monsters to select several, then <b>left-click a player</b> to roll the attack. Hover a token for its info.';
  };


  // ---------- token look ----------
  const TYPE_ICONS = [[/dragon|drake|wyrm/i, '🐉'], [/undead|skeleton|zombie|ghoul|wight|wraith|vampire|lich/i, '💀'], [/fiend|devil|demon/i, '😈'], [/celestial|angel/i, '👼'],
    [/elemental/i, '🌪️'], [/fey|sprite|pixie/i, '🧚'], [/giant|ogre|troll/i, '🪨'], [/ooze|slime|jelly/i, '🟢'], [/plant|treant|myconid/i, '🌿'], [/construct|golem/i, '⚙️'],
    [/aberration|beholder|mind flayer|illithid/i, '👁️'], [/beast|wolf|bear|boar|cat|lion|tiger|snake|spider|rat|bat|bird|hawk|eagle|crocodile|shark|ape|dog/i, '🐺'], [/monstrosity|chimera|griffon|hydra|owlbear|wyvern|manticore/i, '🦂'], [/humanoid|human|elf|dwarf|orc|goblin|gnoll|kobold|bandit|cultist|guard/i, '🧍']];
  function monsterIcon(m) { const hay = `${m.type || ''} ${m.name || ''}`; const hit = TYPE_ICONS.find(([re]) => re.test(hay)); return hit ? hit[1] : '👹'; }

  // ---------- everything the creature was rolled with ----------
  const pctDelta = (mult) => { const d = Math.round((mult - 1) * 100); return d === 0 ? '' : (d > 0 ? '+' : '') + d + '%'; };
  const signed = n => (n > 0 ? '+' : '') + n;
  const cls = n => (n > 0 ? 'bt-pos' : n < 0 ? 'bt-neg' : '');
  function modifiersHtml(t) {
    const e = t.entry, v = e.variant, out = [];
    const base = parseInt(t.monster.ac, 10);
    if (v) {
      const bits = [];
      if (v.hpMult !== 1) bits.push(`<span class="${cls(v.hpMult - 1)}">HP ${pctDelta(v.hpMult)}</span>`);
      if (v.acDelta) bits.push(`<span class="${cls(v.acDelta)}">AC ${signed(v.acDelta)}</span>`);
      if (v.atkDelta) bits.push(`<span class="${cls(v.atkDelta)}">attacks ${signed(v.atkDelta)} to hit</span>`);
      if (v.dmgMult !== 1) bits.push(`<span class="${cls(v.dmgMult - 1)}">damage ${pctDelta(v.dmgMult)}</span>`);
      out.push(`<div class="bt-sec"><b>Variant — ${esc(v.label)}</b> <span style="color:${(typeof rarityColors !== 'undefined' && rarityColors[v.tier]) || '#aaa'}">(${esc(v.tier)})</span><div>${bits.join(' · ') || 'no stat change'}</div></div>`);
    }
    (e.traits || []).forEach(tr => {
      const lines = (tr.lines || []).map(l => `<span class="${l.positive ? 'bt-pos' : 'bt-neg'}">${esc(l.text)}</span>`).join(', ');
      const desc = (typeof GEN !== 'undefined' && GEN.effectDescriptions && GEN.effectDescriptions[tr.name]) || '';
      out.push(`<div class="bt-sec"><b>Trait — ${esc(tr.name)}</b><div>${lines || '<span class="bt-note">no stat lines</span>'}</div>${desc ? `<div class="bt-note">${esc(desc)}</div>` : ''}</div>`);
    });
    if ((e.statLines || []).length) out.push(`<div class="bt-sec"><b>Net stat changes</b><div>${e.statLines.map(l => `<span class="${l.positive ? 'bt-pos' : 'bt-neg'}">${esc(l.text)}</span>`).join(', ')}</div></div>`);
    (e.chaosGearList || []).forEach(g => out.push(`<div class="bt-sec"><b>Chaos gear (${esc(g.rarity)})</b><div>${esc(String(g.label).replace(/<[^>]+>/g, ''))}</div></div>`));
    const nums = [];
    if (Number.isFinite(base) && e.ac != null && e.ac !== base) nums.push(`AC ${base} → <b>${e.ac}</b>`);
    if (e.hpRoll && e.hpRoll.dice) nums.push(`HP rolled ${esc(e.hpRoll.dice)} = ${e.hpRoll.total}${e.hp !== e.hpRoll.total ? ` → <b>${e.maxHp}</b> with modifiers` : ''}`);
    if (e.atkMod) nums.push(`attack rolls ${signed(e.atkMod)}`);
    if (e.dmgMult && e.dmgMult !== 1) nums.push(`damage ×${e.dmgMult.toFixed(2).replace(/\.?0+$/, '')}`);
    out.push(`<div class="bt-sec"><b>Rolled stats</b><div>❤ ${t.hp}/${t.maxHp} HP · 🛡 AC ${t.ac == null ? '—' : t.ac}${nums.length ? '<br>' + nums.join(' · ') : ''}</div></div>`);
    if (!v && !(e.traits || []).length && !(e.chaosGearList || []).length) out.push('<div class="bt-sec bt-note">No variant, traits or chaos gear — a plain creature.</div>');
    return out.join('');
  }

  // ---------- hover info ----------
  function showTip(evt, t) {
    const tt = document.getElementById('itemTooltip'); if (!tt) return;
    if (t.kind === 'monster') {
      tt.innerHTML = `<div class="tt-header" style="margin-bottom:0.3rem">${esc(t.name)}</div>`
        + buildMonsterTooltipHtml(t.monster).replace(/<div class="tt-header"[\s\S]*?<\/div>/, '')
        + modifiersHtml(t)
        + ((t.monster.actions || []).length ? `<div class="bt-sec"><b>Actions</b> ${(t.monster.actions || []).map(a => esc(a.name)).join(', ')}</div>` : '');
    } else {
      tt.innerHTML = `<div class="tt-header">${esc(t.name)}</div><div class="tt-rarity">Player</div><div class="tt-stats"><span>🛡 AC ${t.ac}</span><span>❤ ${t.hp}/${t.maxHp}</span></div>`;
    }
    tt.style.display = 'block';
    if (typeof moveTokenTooltip === 'function') moveTokenTooltip(evt);
  }
  const hideTip = () => { if (typeof hideTokenTooltip === 'function') hideTokenTooltip(); };

  // ---------- attack rolling ----------
  const isAttackish = a => { const p = battleParseAttack(a.text || ''); return p.toHit !== null || p.damageClauses.length > 0 || p.saveDC !== null; };
  const isMulti = a => /multiattack/i.test(a.name || '');
  // One action -> a roll record: d20 vs AC when it has a to-hit; dice for every damage clause.
  function rollAction(action, target, entry) {
    const { toHit, damageClauses, saveDC } = battleParseAttack(action.text || '');
    const atkMod = entry.atkMod || 0, mult = entry.dmgMult || 1;
    const r = { name: action.name, text: action.text, saveDC, toHit: null, d20: null, total: null, ac: target.ac, outcome: 'info', clauses: [], damage: 0, needsSave: false };
    let crit = false, hit = true;
    if (toHit !== null) {
      r.d20 = rn(1, 20); crit = r.d20 === 20;
      r.toHit = toHit + atkMod; r.total = r.d20 + r.toHit;
      hit = r.d20 !== 1 && (crit || r.total >= target.ac);
      r.outcome = r.d20 === 1 ? 'fumble' : crit ? 'crit' : hit ? 'hit' : 'miss';
    } else if (saveDC !== null) { r.needsSave = true; r.outcome = 'save'; }
    if (hit && damageClauses.length) {
      r.clauses = damageClauses.map(c => ({ type: c.type, dice: c.dice, roll: battleRollDamage(c.dice, crit) })).filter(c => c.roll);
      const base = r.clauses.reduce((n, c) => n + c.roll.total, 0);
      r.damage = r.clauses.length ? Math.max(1, Math.round(base * mult)) : 0;
      r.mult = mult;
    }
    return r;
  }
  // A monster's turn against a target. Multiattack is never rolled itself: it triggers two other
  // attacks that are NOT multiattacks.
  function rollMonster(token, target) {
    const m = token.monster, actions = (m.actions || []).filter(a => isAttackish(a) || isMulti(a));
    const result = { token, target, attacks: [], multi: false, note: '' };
    if (!actions.some(a => !isMulti(a))) { result.note = 'This creature has no attack action to roll.'; return result; }
    const picked = ri(actions);
    if (isMulti(picked)) {
      const singles = actions.filter(a => !isMulti(a) && isAttackish(a));
      result.multi = true; result.multiAction = picked;
      if (!singles.length) { result.note = 'Multiattack, but no other attack to roll.'; return result; }
      const first = ri(singles), rest = singles.filter(a => a !== first);
      const second = rest.length ? ri(rest) : first;
      [first, second].forEach(a => result.attacks.push(rollAction(a, target, token.entry)));
    } else result.attacks.push(rollAction(picked, target, token.entry));
    return result;
  }
  function attackHtml(a, idx, gi) {
    const head = a.toHit !== null
      ? `d20 <b>${a.d20}</b> ${fmt(a.toHit)} = <b>${a.total}</b> vs AC ${a.ac} → <span class="bt-${a.outcome === 'fumble' ? 'miss' : a.outcome}">${{ crit: 'Critical hit!', hit: 'Hit', miss: 'Miss', fumble: 'Critical miss' }[a.outcome]}</span>`
      : a.saveDC !== null ? `Target makes a <b>DC ${a.saveDC}</b> save <label class="bt-note"><input type="checkbox" checked onchange="btToggleSave(${gi},${idx},this.checked)"> failed</label>` : '<span class="bt-note">No attack roll — read the effect.</span>';
    const dmg = a.clauses.length
      ? a.clauses.map(c => `<div class="weapon-attack-line"><span>${esc(c.dice)}${c.type ? ' ' + esc(c.type) : ''}${a.outcome === 'crit' ? ' (doubled)' : ''}</span><span>${c.roll.rolls.join(' + ')}${c.roll.mod ? (c.roll.mod > 0 ? ' + ' : ' − ') + Math.abs(c.roll.mod) : ''} = <b>${c.roll.total}</b></span></div>`).join('')
        + (a.mult && a.mult !== 1 ? `<div class="weapon-attack-line"><span>Variant damage ×${a.mult.toFixed(2).replace(/\.?0+$/, '')}</span><span></span></div>` : '')
        + `<div class="weapon-attack-total" style="font-size:1.05rem;margin:0.3rem 0 0">Damage: <span id="btDmg-${gi}-${idx}">${a.outcome === 'save' ? (a.failed === false ? 0 : a.damage) : a.damage}</span>${a.outcome === 'save' ? ' <span class="bt-note">(if failed)</span>' : ''}</div>`
      : '';
    return `<div class="sub"><b>${esc(a.name)}</b><div>${head}</div>${dmg}</div>`;
  }
  function popupHtml(groups) {
    let grand = 0;
    const body = groups.map((g, gi) => {
      const sub = g.attacks.reduce((n, a) => n + (a.outcome === 'save' && a.failed === false ? 0 : a.damage), 0);
      grand += sub;
      return `<div class="bt-atk"><h5>${esc(g.token.name)} → ${esc(g.target.name)}</h5>
        ${g.multi ? `<div class="bt-note">Multiattack — rolling two other attacks (never another Multiattack).</div>` : ''}
        ${g.note ? `<div class="bt-note">${esc(g.note)}</div>` : ''}
        ${g.attacks.map((a, i) => attackHtml(a, i, gi)).join('')}
        <div class="weapon-attack-line" style="margin-top:0.3rem"><span>Subtotal</span><span id="btSub-${gi}">${sub}</span></div></div>`;
    }).join('');
    return body + `<div class="weapon-attack-total">Total damage to ${esc(groups[0].target.name)}: <span id="btGrand">${grand}</span></div>
      <div class="bt-bar" style="justify-content:center"><button class="action-btn" onclick="btApplyDamage()">💥 Apply damage</button><button class="action-btn" onclick="btReroll()">🎲 Reroll</button><button class="action-btn" onclick="btClosePopup()">Close</button></div>`;
  }
  function recalc() {
    if (!bt.last) return;
    let grand = 0;
    bt.last.groups.forEach((g, gi) => {
      let sub = 0;
      g.attacks.forEach((a, i) => {
        const v = a.outcome === 'save' && a.failed === false ? 0 : a.damage;
        sub += v; const el = document.getElementById(`btDmg-${gi}-${i}`); if (el) el.textContent = v;
      });
      grand += sub; const s = document.getElementById('btSub-' + gi); if (s) s.textContent = sub;
    });
    const el = document.getElementById('btGrand'); if (el) el.textContent = grand;
    bt.last.total = grand;
  }
  window.btToggleSave = function (gi, i, ok) { bt.last.groups[gi].attacks[i].failed = ok; recalc(); };
  function open(groups, targetToken, applied) {
    bt.last = { groups, targetToken, total: 0, applied: !!applied, monsters: groups.map(g => g.token) };
    document.getElementById('btAttackBody').innerHTML = popupHtml(groups);
    document.getElementById('btAttackTitle').textContent = `⚔ ${groups.length > 1 ? groups.length + ' monsters' : groups[0].token.name} attack${groups.length > 1 ? '' : 's'} ${targetToken.name}`;
    document.getElementById('btAttackModal').classList.add('open');
    recalc();
  }
  function attackTarget(target) {
    const attackers = bt.tokens.filter(t => bt.selected.has(t.id) && t.hp > 0);
    if (!attackers.length) return;
    open(attackers.map(t => rollMonster(t, target)), target);
  }
  window.btReroll = function () { if (!bt.last) return; const tgt = bt.last.targetToken; open(bt.last.monsters.map(t => rollMonster(t, tgt)), tgt); };
  window.btClosePopup = function () { document.getElementById('btAttackModal').classList.remove('open'); };
  window.btApplyDamage = function () {
    if (!bt.last || bt.last.applied) return;
    const t = bt.last.targetToken, dmg = bt.last.total || 0;
    t.hp = Math.max(0, t.hp - dmg);
    if (t.uid && typeof window.applyHpDeltaToPlayer === 'function') window.applyHpDeltaToPlayer(t.uid, -dmg);
    if (t.srcKey === 'me' && typeof characterCurrentHp !== 'undefined') { characterCurrentHp = Math.max(0, characterCurrentHp - dmg); if (typeof scheduleSave === 'function') scheduleSave(); }
    bt.last.applied = true; btClosePopup(); bt.selected.clear(); btRenderField();
  };

  // ---------- interactions ----------
  function fieldPoint(evt) { const r = document.getElementById('btField').getBoundingClientRect(); return { x: Math.max(30, Math.min(r.width - 30, evt.clientX - r.left)), y: Math.max(30, Math.min(r.height - 40, evt.clientY - r.top)) }; }
  function tokenOf(el) { const n = el.closest && el.closest('.bt-token'); return n ? bt.tokens.find(t => String(t.id) === n.dataset.id) : null; }
  window.btInit = function () {
    const f = document.getElementById('btField'); if (!f || f._btWired) return; f._btWired = true;
    // sidebar drag sources
    document.getElementById('btSide').addEventListener('dragstart', e => { const c = e.target.closest('[data-bt]'); if (!c) return; e.dataTransfer.setData('text/bt', JSON.stringify({ kind: c.dataset.bt, key: c.dataset.key })); e.dataTransfer.effectAllowed = 'copy'; hideTip(); });
    f.addEventListener('dragover', e => { e.preventDefault(); f.classList.add('over'); });
    f.addEventListener('dragleave', () => f.classList.remove('over'));
    f.addEventListener('drop', e => {
      e.preventDefault(); f.classList.remove('over');
      let d; try { d = JSON.parse(e.dataTransfer.getData('text/bt')); } catch (er) { return; }
      const p = fieldPoint(e), t = makeToken(d.kind, d.key, p.x, p.y);
      if (t) { bt.tokens.push(t); btRenderField(); }
    });
    // hover info
    f.addEventListener('mouseover', e => { const t = tokenOf(e.target); if (t && !bt.drag) showTip(e, t); });
    f.addEventListener('mousemove', e => { const t = tokenOf(e.target); if (t && !bt.drag) { const tt = document.getElementById('itemTooltip'); if (tt && tt.style.display === 'block' && typeof moveTokenTooltip === 'function') moveTokenTooltip(e); } else hideTip(); });
    f.addEventListener('mouseleave', hideTip);
    // right-click = multi-select monsters
    f.addEventListener('contextmenu', e => {
      e.preventDefault();
      const t = tokenOf(e.target);
      if (t && t.kind === 'monster' && t.hp > 0) { bt.selected.has(t.id) ? bt.selected.delete(t.id) : bt.selected.add(t.id); btRenderField(); }
    });
    // left button: drag to move, click to select / attack
    f.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (e.target.dataset && e.target.dataset.x) { bt.tokens = bt.tokens.filter(t => String(t.id) !== e.target.dataset.x); bt.selected.delete(+e.target.dataset.x); btRenderField(); return; }
      const t = tokenOf(e.target); if (!t) return;
      bt.drag = { t, sx: e.clientX, sy: e.clientY, moved: false }; hideTip(); e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      const d = bt.drag; if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
      d.moved = true; const p = fieldPoint(e); d.t.x = p.x; d.t.y = p.y;
      const el = document.querySelector(`.bt-token[data-id="${d.t.id}"]`); if (el) { el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; }
    });
    document.addEventListener('mouseup', e => {
      const d = bt.drag; if (!d) return; bt.drag = null;
      if (d.moved) return;
      const t = d.t;
      if (t.kind === 'monster') {
        if (t.hp <= 0) return;
        if (bt.selected.size === 1 && bt.selected.has(t.id)) bt.selected.clear(); else { bt.selected.clear(); bt.selected.add(t.id); }
        btRenderField();
      } else if (bt.selected.size) attackTarget(t);
    });
  };
  window.btClear = function () { bt.tokens = []; bt.selected.clear(); btRenderField(); };
  window.btHealAll = function () { bt.tokens.forEach(t => { t.hp = t.maxHp; }); btRenderField(); };
  window.btOnShow = function () {
    btInit(); btRenderSide(); btRenderField();
    if (typeof loadMonsterDatabase === 'function') loadMonsterDatabase(false).then(() => btRenderSide());
  };
  // expose the pure-ish pieces for tests
  window.btRollMonster = rollMonster;
  window.btAttackTarget = attackTarget;
})();
