// 🧪 Battle Field (test tab). A drag-and-drop field where the DM places monsters and players as
// tokens, hovers a token for its info, selects monster(s) and clicks a player to roll their attacks.
// Everything is reused from the Combat tab, nothing re-implemented: monsterDatabase (+ the shared
// loader), buildBattleEntry (rolled HP, AC, variants, traits), buildMonsterTooltipHtml (hover info),
// battleParseAttack / battleRollDamage (attack + damage parsing and dice) and the connected-players
// roster. Classic script: it shares the monolith's globals and is wired up from the tab markup.
(function () {
  const bt = { tokens: [], selected: new Set(), selectedPlayer: null, nextId: 1, customPlayers: [], drag: null, last: null, lastResult: '' };
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
    .bt-token { position:absolute; width:136px; transform:translate(-50%,-34px); text-align:center; cursor:pointer; user-select:none; touch-action:none; }
    .bt-token .disc { position:relative; width:60px; height:60px; margin:0 auto; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.9rem; line-height:1;
      background:radial-gradient(circle at 35% 30%, var(--bt-hi), var(--bt-lo)); border:4px solid var(--bt-ring); box-shadow:0 3px 8px rgba(0,0,0,0.7), inset 0 0 8px rgba(0,0,0,0.5); }
    .bt-token.monster { --bt-hi:#b84444; --bt-lo:#4a1414; --bt-ring:#2b0d0d; }
    .bt-token.monster .disc { background:none; border:none; box-shadow:none; width:76px; height:76px; } .bt-token.monster .disc svg { display:block; filter:drop-shadow(0 2px 3px rgba(0,0,0,0.7)); }
    .bt-token.monster.selected .disc svg { filter:drop-shadow(0 0 4px var(--gold)) drop-shadow(0 0 8px var(--gold)) !important; }
    .bt-token.monster.t-uncommon .disc svg { filter:drop-shadow(0 0 3px #4caf7d); } .bt-token.monster.t-rare .disc svg { filter:drop-shadow(0 0 3px #5b9cf6); } .bt-token.monster.t-superrare .disc svg { filter:drop-shadow(0 0 3px #c47cf5); } .bt-token.monster.t-legendary .disc svg { filter:drop-shadow(0 0 4px #e8963a); }
    .bt-chip .art { width:22px; height:22px; flex:0 0 auto; margin-right:0.35rem; } .bt-chip .art svg { display:block; }
    .bt-token.player { --bt-hi:#3fae78; --bt-lo:#12402a; --bt-ring:#0b2a1b; }
    .bt-token.t-uncommon .disc { border-color:#4caf7d; } .bt-token.t-rare .disc { border-color:#5b9cf6; }
    .bt-token.t-superrare .disc { border-color:#c47cf5; } .bt-token.t-legendary .disc { border-color:#e8963a; }
    .bt-token.selected .disc { box-shadow:0 0 0 3px var(--gold), 0 0 16px var(--gold); }
    .bt-token.target-ready.player .disc { box-shadow:0 0 0 3px #e8d060, 0 0 14px #e8d060; animation:btPulse 1.2s infinite; }
    @keyframes btPulse { 50% { box-shadow:0 0 0 5px #e8d060, 0 0 20px #e8d060; } }
    .bt-token.dead { opacity:0.45; filter:grayscale(1); }
    .bt-token .lbl { display:inline-block; max-width:132px; white-space:normal; overflow-wrap:anywhere; margin-top:4px; padding:1px 7px; background:rgba(10,8,6,0.82); border:1px solid var(--border); border-radius:9px; font-size:0.72rem; color:var(--text); line-height:1.25; }
    .bt-token .bar { position:relative; height:14px; flex:1 1 auto; width:auto; min-width:60px; max-width:84px; margin:0; background:#000; border:1px solid #000; border-radius:6px; overflow:hidden; }
    .bt-token .bar i { position:absolute; inset:0 auto 0 0; background:#4caf7d; }
    .bt-token .bar span { position:relative; display:block; font-size:0.62rem; line-height:14px; color:#fff; text-shadow:0 0 2px #000; }
    .bt-token .ac { position:static; flex:0 0 auto; min-width:20px; padding:0 3px; font-size:0.65rem; background:#1a1a22; border:1px solid #888; border-radius:8px; color:#dfe6ff; line-height:15px; }
    .bt-token .x { position:absolute; top:-6px; right:6px; z-index:5; display:none; background:#000; color:#fff; border:1px solid #888; border-radius:50%; font-size:0.7rem; line-height:1; width:18px; height:18px; cursor:pointer; padding:0; }
    .bt-token:hover .x { display:block; }
    .bt-sec { margin-top:0.35rem; padding-top:0.3rem; border-top:1px solid var(--border); font-size:0.8rem; }
    .bt-sec b { color:var(--gold); }
    .bt-pos { color:#4caf7d; } .bt-neg { color:#e05252; }
    .bt-sliders { gap:1.2rem; } .bt-sliders label { color:var(--text-dim); font-size:0.85rem; }
    .bt-hint { color:var(--text-dim); font-size:0.85rem; margin:0.2rem 0 0.5rem; }
    .bt-hint b { color:var(--gold); }
    .bt-bar { display:flex; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.4rem; align-items:center; }
    .bt-atk { border:1px solid var(--border); padding:0.4rem 0.6rem; margin-bottom:0.6rem; background:var(--bg); }
    .bt-atk h5 { margin:0 0 0.3rem; color:var(--gold); font-size:0.95rem; }
    .bt-atk .sub { margin:0.4rem 0 0 0.6rem; padding-left:0.6rem; border-left:2px solid var(--border); }
    .bt-hit { color:#4caf7d; } .bt-miss { color:#e05252; } .bt-crit { color:#f7d774; font-weight:bold; }
    .bt-note { color:var(--text-dim); font-size:0.8rem; }
    .bt-token.player.p-selected .disc { box-shadow:0 0 0 3px #6fd07f, 0 0 16px #6fd07f; }
    .bt-token.monster.attackable .disc svg, .bt-token.monster.attackable .disc { filter:drop-shadow(0 0 5px #e05252); cursor:crosshair; }
    .bt-token .lv { position:static; flex:0 0 auto; min-width:20px; padding:0 4px; font-size:0.62rem; background:#12301e; border:1px solid #4caf7d; border-radius:8px; color:#bfeccd; line-height:15px; }
    /* The disc, the info row and the name never overlap: the stats (AC / level / HP) sit in their own row under the art. */
    .bt-token .disc { z-index:1; }
    .bt-token .stats { display:flex; align-items:center; justify-content:center; gap:4px; margin-top:5px; position:relative; z-index:2; }
    .bt-token .lbl { margin-top:5px; position:relative; z-index:2; }
    .bt-ctl { display:none; position:fixed; z-index:1200; width:min(580px, 96vw); max-height:84vh; overflow:auto; background:var(--surface); border:2px solid var(--gold); box-shadow:0 10px 36px rgba(0,0,0,0.75); padding:0.5rem 0.6rem 0.6rem; }
    .bt-ctl.open { display:block; }
    .bt-ctl-head { display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.4rem; color:var(--gold); font-size:0.8rem; letter-spacing:0.06em; text-transform:uppercase; }
    .bt-ctl-head button { background:#000; color:#fff; border:1px solid #888; width:26px; height:26px; cursor:pointer; line-height:1; }
    .bt-ctl .combat-card { margin:0; }
    .bt-ctl .bt-player-ctl label { display:flex; justify-content:space-between; gap:0.6rem; margin:0.3rem 0; align-items:center; }
    .bt-ctl .bt-player-ctl input[type=number] { width:5rem; background:var(--bg); border:1px solid var(--border); color:var(--text); padding:0.25rem; font-family:inherit; }
    @media (max-width:800px) { .bt-ctl { left:0 !important; right:0 !important; top:auto !important; bottom:0 !important; width:100vw; max-height:78vh; border-width:2px 0 0; } }
    .combat-roster-details { margin-top:0.4rem; } .combat-roster-details > summary { cursor:pointer; color:var(--gold); margin-bottom:0.5rem; }
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
    box.innerHTML = monsterMatches(q).map(m => `<div class="bt-chip monster" draggable="true" data-bt="monster" data-key="${esc(m.name)}"><span style="display:flex;align-items:center"><span class="art">${typeof monsterArtSvg === 'function' ? monsterArtSvg(m, 22, true) : ''}</span>${esc(m.name)}</span><small>CR ${esc(m.cr)} · AC ${esc(m.ac)}</small></div>`).join('') || '<div class="bt-note">No matches.</div>';
  };
  window.btAddCustomPlayer = function () {
    const name = document.getElementById('btNewName').value.trim() || 'Test player';
    const ac = parseInt(document.getElementById('btNewAc').value, 10) || 14;
    const hp = parseInt(document.getElementById('btNewHp').value, 10) || 30;
    bt.customPlayers.push({ key: 'custom:' + (bt.nextId++), name, ac, hp, maxHp: hp });
    btRenderSide();
  };

  // ---------- tokens ----------
  const sliderOpts = () => undefined;   // buildBattleEntry reads the Combat tab's own Variant / Chaos sliders when given no options
  // A monster token is a VIEW of a roster entry (battleRoster, the same list the old Combat tab used): HP, AC, name, defeated
  // state, loot and attacks all live on the entry, so the board, the control panel, the shared player view and saves never disagree.
  function bindMonsterToken(tok) {
    Object.defineProperties(tok, {
      hp: { enumerable: true, get() { return tok.entry.hp; }, set(v) { tok.entry.hp = v; if (v <= 0) tok.entry.defeated = true; } },
      maxHp: { enumerable: true, get() { return tok.entry.maxHp; } },
      ac: { enumerable: true, get() { return tok.entry.ac; } },
      name: { enumerable: true, get() { return tok.entry.displayName || tok.monster.name; } },
    });
    return tok;
  }
  const FIELD_COL_W = 156, FIELD_ROW_H = 176;
  function autoSpot() {
    const f = document.getElementById('btField'), w = (f && f.clientWidth) || 800;
    const cols = Math.max(1, Math.floor((w - 40) / FIELD_COL_W));
    const used = new Set(bt.tokens.map(t => Math.round((t.x - 80) / FIELD_COL_W) + ',' + Math.round((t.y - 70) / FIELD_ROW_H)));
    for (let i = 0; i < 400; i++) { const c = i % cols, r = Math.floor(i / cols); if (!used.has(c + ',' + r)) return { x: 80 + c * FIELD_COL_W, y: 70 + r * FIELD_ROW_H }; }
    return { x: 80, y: 70 };
  }
  function syncFromRoster() {
    const roster = (typeof battleRoster !== 'undefined' ? battleRoster : []);
    const byUid = new Map(roster.map(e => [e.uid, e]));
    bt.tokens = bt.tokens.filter(t => t.kind !== 'monster' || byUid.has(t.entry.uid));
    roster.forEach(e => {
      const tok = bt.tokens.find(t => t.kind === 'monster' && t.entry.uid === e.uid);
      if (tok) { tok.entry = e; return; }
      const spot = e.bfX != null ? { x: e.bfX, y: e.bfY } : autoSpot();
      const monster = e.monster || { name: e.displayName || 'Creature', type: '' };
      bt.tokens.push(bindMonsterToken({ id: bt.nextId++, kind: 'monster', x: spot.x, y: spot.y, entry: e, monster }));
    });
  }
  function makeToken(kind, key, x, y) {
    if (kind === 'monster') {
      const monster = monsterDatabase.find(m => m.name === key); if (!monster) return null;
      const entry = buildBattleEntry(monster, sliderOpts());
      entry.bfX = x; entry.bfY = y;
      battleRoster.push(entry);
      syncFromRoster();
      if (typeof renderCombatRoster === 'function') renderCombatRoster();
      return null;   // the roster owns the token now (syncFromRoster created it); nothing else to push
    }
    const p = playerSources().find(s => s.key === key); if (!p) return null;
    const tok = { id: bt.nextId++, kind, x, y, name: p.name, ac: p.ac, hp: p.hp, maxHp: p.maxHp, uid: p.uid, srcKey: p.key };
    loadStats(tok);
    return tok;
  }
  // ---------- campaign characters: their real stats ----------
  // A campaign member's full sheet (abilities, level, gear, spells) lives in their synced state. The DM can load it one player at a
  // time (the same subscription the Players tab uses); the token then shows the character's real AC, HP, level and class.
  function fetchState(uid) {
    return new Promise(resolve => {
      if (typeof viewedPlayerUid !== 'undefined' && viewedPlayerUid === uid && viewedPlayerState) return resolve(viewedPlayerState);
      if (typeof selectViewedPlayer !== 'function' || typeof window.startViewedPlayerListener !== 'function') return resolve(null);
      const orig = window.applyViewedPlayerState; let done = false;
      const finish = st => { if (done) return; done = true; clearTimeout(timer); window.applyViewedPlayerState = orig; resolve(st); };
      const timer = setTimeout(() => finish(null), 6000);
      window.applyViewedPlayerState = function (u, state) { orig.apply(this, arguments); if (u === uid && state) finish(state); };
      if (viewedPlayerUid === uid) { viewedPlayerUid = null; }   // force a fresh subscription
      selectViewedPlayer(uid);
    });
  }
  function sheetOf(state) { return window.PlayerAttack ? PlayerAttack.withCharacter(state, () => computeCharacterSheet()) : null; }
  function loadStats(tok) {
    if (!tok.uid) { if (tok.srcKey === 'me') { try { applySheet(tok, null); } catch (e) {} } return Promise.resolve(); }
    return fetchState(tok.uid).then(state => { if (!state) return; tok.state = state; applySheet(tok, state); btRenderField(); btRenderSide(); });
  }
  function applySheet(tok, state) {
    const sh = sheetOf(state); if (!sh) return;
    tok.sheet = { abilities: Object.fromEntries(Object.entries(sh.abilities).map(([k, v]) => [k, v.total])), level: state ? (state.characterLevel || 1) : characterLevel, cls: state ? (state.characterClass || '') : (typeof characterClass !== 'undefined' ? characterClass : ''), prof: sh.profBonus, speed: sh.speed && sh.speed.total };
    tok.ac = sh.ac.total; tok.maxHp = sh.maxHp.total;
    if (tok.hp > tok.maxHp) tok.hp = tok.maxHp;
  }
  window.btRenderField = function () {
    const f = document.getElementById('btField'); if (!f) return;
    syncFromRoster();
    const ready = [...bt.selected].length > 0;
    f.innerHTML = (bt.tokens.length ? '' : '<div class="bt-empty">Drag monsters and players from the left onto the field, or add creatures with the search above.</div>') + bt.tokens.map(t => {
      const pct = Math.max(0, Math.min(100, Math.round((t.hp / Math.max(1, t.maxHp)) * 100)));
      const tier = t.entry && t.entry.variant ? t.entry.variant.tier : '';
      const dead = t.hp <= 0 || (t.entry && t.entry.defeated);
      const cls = ['bt-token', t.kind, tier ? 't-' + tier : '', bt.selected.has(t.id) ? 'selected' : '', ready && t.kind === 'player' ? 'target-ready' : '', bt.selectedPlayer === t.id ? 'p-selected' : '', bt.selectedPlayer && t.kind === 'monster' && !dead ? 'attackable' : '', dead ? 'dead' : ''].join(' ');
      const icon = t.kind === 'player' ? '🛡️' : (typeof monsterArtSvg === 'function' ? monsterArtSvg(t.monster, 76, true) : monsterIcon(t.monster));
      const stats = `<span class="ac" title="Armor Class">🛡 ${t.ac == null ? '—' : t.ac}</span>${t.sheet ? `<span class="lv" title="${esc((t.sheet.cls || 'Character') + ' level ' + t.sheet.level)}">L${t.sheet.level}</span>` : ''}<span class="bar" title="Hit points"><i style="width:${pct}%"></i><span>${t.hp}/${t.maxHp}</span></span>`;
      return `<div class="${cls}" data-id="${t.id}" style="left:${t.x}px;top:${t.y}px"><button class="x" data-x="${t.id}" title="Remove">×</button><div class="disc">${icon}</div><div class="lbl">${esc(t.name)}</div><div class="stats">${stats}</div></div>`;
    }).join('');
    const hint = document.getElementById('btHint');
    const sp = bt.tokens.find(t => t.id === bt.selectedPlayer);
    if (hint) hint.innerHTML = (bt.selected.size
      ? `<b>${bt.selected.size}</b> monster${bt.selected.size > 1 ? 's' : ''} selected — <b>left-click a player</b> to roll the attack${bt.selected.size > 1 ? 's' : ''}. <b>Shift/Ctrl-click</b> monsters to add or remove.`
      : sp ? `<b>${esc(sp.name)}</b> is ready — <b>left-click a monster</b> to attack it with their main hand (a small chooser appears when they have several weapons or damage spells). Click ${esc(sp.name)} again to cancel.`
      : '<b>Left-click</b> a monster to select it, <b>Shift/Ctrl-click</b> to select several, then <b>left-click a player</b> to roll the attack. Or <b>left-click a player</b> first, then a monster. <b>Right-click</b> (or press and hold) any token for its controls. Hover for info.')
      + (bt.lastResult ? `<div class="bt-note" style="margin-top:0.25rem">${bt.lastResult}</div>` : '');
  };
  // Called by the Combat tab whenever the roster changes (HP slider, defeat, add/remove, loot...): redraw the board and keep an open panel current.
  window.btAfterRosterChange = function () {
    if (bt.drag) return;
    if (!document.getElementById('btField')) return;
    btRenderField(); refreshPanel();
  };
  const alive = t => t.hp > 0 && !(t.entry && t.entry.defeated);
  const defeatCheck = t => { if (t.entry && t.entry.hp <= 0) t.entry.defeated = true; };
  function damageMonster(t, dmg) {
    if (!t.entry) return;
    if (dmg > 0) t.entry.hp = Math.max(0, t.entry.hp - dmg);
    defeatCheck(t);
    if (typeof renderCombatRoster === 'function') renderCombatRoster(); else btRenderField();
  }

  // ---------- right-click control panel ----------
  // A monster's panel is exactly its roster card (HP slider and nudges, AC, traits, Roll Attack, defeat / loot / reveal, remove); a
  // player's is a small stat editor. It re-renders whenever the roster changes so nothing in it is ever stale.
  function panelEl() { return document.getElementById('btControlPanel'); }
  function panelHtml(t) {
    if (t.kind === 'monster') {
      if (!t.entry || typeof combatCardHtml !== 'function') return '<div class="bt-note">No controls for this token.</div>';
      const card = combatCardHtml(t.entry, 'dm').replace(new RegExp('id="combatHpNum' + t.entry.uid + '"', 'g'), 'id="combatHpNumPanel' + t.entry.uid + '"');
      return `<div class="bt-ctl-head"><span>Creature controls</span><button onclick="btClosePanel()" title="Close">×</button></div>${card}`;
    }
    const sh = t.sheet;
    return `<div class="bt-ctl-head"><span>${esc(t.name)}</span><button onclick="btClosePanel()" title="Close">×</button></div>
      <div class="bt-player-ctl">${sh ? `<div class="bt-note">${esc((sh.cls || 'Character') + ' · level ' + sh.level)}</div>` : ''}
      <label>Armor Class <input type="number" value="${t.ac == null ? '' : t.ac}" onchange="btSetPlayerStat(${t.id},'ac',this.value)"></label>
      <label>Current HP <input type="number" value="${t.hp}" onchange="btSetPlayerStat(${t.id},'hp',this.value)"></label>
      <label>Max HP <input type="number" value="${t.maxHp}" onchange="btSetPlayerStat(${t.id},'maxHp',this.value)"></label>
      <div class="bt-bar"><button class="action-btn" onclick="btRemoveToken(${t.id})">🗑 Remove from field</button></div></div>`;
  }
  function refreshPanel() {
    const el = panelEl(); if (!el || !el.classList.contains('open') || bt.panelTokenId == null) return;
    if (el.contains(document.activeElement) && /^(SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;   // never close a dropdown the DM has open
    const t = bt.tokens.find(x => x.id === bt.panelTokenId);
    if (!t) { btClosePanel(); return; }
    const top = el.scrollTop; el.innerHTML = panelHtml(t); el.scrollTop = top;
  }
  function openPanel(t, evt) {
    const el = panelEl(); if (!el) return;
    bt.panelTokenId = t.id; hideTip();
    el.innerHTML = panelHtml(t); el.classList.add('open');
    const vw = window.innerWidth, vh = window.innerHeight, w = Math.min(580, vw * 0.96);
    let x = (evt && evt.clientX != null ? evt.clientX : vw / 2) + 14, y = (evt && evt.clientY != null ? evt.clientY : vh / 2) - 20;
    x = Math.max(8, Math.min(vw - w - 8, x)); y = Math.max(8, Math.min(vh - Math.min(el.offsetHeight, vh * 0.84) - 8, y));
    el.style.left = x + 'px'; el.style.top = y + 'px'; el.scrollTop = 0;
  }
  window.btClosePanel = function () { const el = panelEl(); if (el) el.classList.remove('open'); bt.panelTokenId = null; };
  window.btSetPlayerStat = function (id, key, v) {
    const t = bt.tokens.find(x => x.id === id); if (!t) return;
    const n = parseInt(v, 10); if (!Number.isFinite(n)) return;
    t[key] = key === 'hp' ? Math.max(0, Math.min(t.maxHp, n)) : Math.max(0, n);
    if (t.hp > t.maxHp) t.hp = t.maxHp;
    btRenderField();
  };
  window.btRemoveToken = function (id) {
    const t = bt.tokens.find(x => x.id === id); if (!t) return;
    if (t.kind === 'monster' && t.entry && typeof removeFromBattle === 'function') { bt.tokens = bt.tokens.filter(x => x.id !== id); bt.selected.delete(id); btClosePanel(); removeFromBattle(t.entry.uid); return; }
    bt.tokens = bt.tokens.filter(x => x.id !== id); bt.selected.delete(id); if (bt.selectedPlayer === id) bt.selectedPlayer = null;
    btClosePanel(); btRenderField();
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
        + (() => { const sc = t.monster.spellcasting || []; if (!sc.length) return ''; const st = spellState(t);
            return sc.map(b => `<div class="bt-sec"><b>${esc(b.name)}</b> <span class="bt-note">DC ${b.dc} · ${fmt(b.toHit)} to hit</span>${b.groups.map(g => `<div>${esc(g.label)}: ${g.spells.map(n => { const k = n.toLowerCase(); const left = g.kind === 'daily' ? ` (${st.daily[k]} left)` : ''; return esc(n) + left; }).join(', ')}${g.kind === 'slots' ? ` <span class="bt-note">(${st.slots[g.level]} left)</span>` : ''}</div>`).join('')}</div>`).join(''); })()
        + (() => { const gear = (t.entry.chaosGearList || []).map(g => g.spellAction ? `${g.spellAction.name} ✦` : g.weaponAction ? `${g.weaponAction.name} ⚔` : '').filter(Boolean);
            const all = [...(t.monster.actions || []).map(a => esc(a.name)), ...gear.map(esc)];
            return all.length ? `<div class="bt-sec"><b>Actions</b> ${all.join(', ')}</div>` : ''; })();
    } else {
      const sh = t.sheet, ab = sh ? Object.entries(sh.abilities).map(([k, v]) => `<span>${k.toUpperCase()} ${v}</span>`).join('') : '';
      tt.innerHTML = `<div class="tt-header">${esc(t.name)}</div><div class="tt-rarity">${sh ? esc((sh.cls || 'Character') + ' · level ' + sh.level) : 'Player'}</div><div class="tt-stats"><span>🛡 AC ${t.ac}</span><span>❤ ${t.hp}/${t.maxHp}</span>${sh && sh.speed ? `<span>👟 ${sh.speed} ft</span>` : ''}</div>${ab ? `<div class="tt-stats" style="margin-top:0.2rem">${ab}</div>` : ''}${t.uid && !sh ? '<div class="bt-note">Loading their sheet…</div>' : ''}`;
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
    const r = { name: action.name, text: action.text, source: action.source, useNote: action.useNote, utility: !!action.utility, saveDC, toHit: null, d20: null, total: null, ac: target.ac, outcome: 'info', clauses: [], damage: 0, needsSave: false };
    let crit = false, hit = true;
    const AM = window.AttackMargin;
    if (toHit !== null) {
      r.d20 = rn(1, 20); crit = r.d20 === 20;
      r.toHit = toHit + atkMod; r.total = r.d20 + r.toHit;
      if (AM) {
        // Degree of hit (docs/ATTACK_MARGIN.md): M = d20 + attack mods - AC -> tier -> damage % and effects.
        r.margin = AM.resolveAttack({ d20: r.d20, toHit: r.toHit, ac: target.ac });
        r.classes = AM.attackClassesOf(action.name || '');
        r.effects = AM.suggestEffects(r.margin, r.classes);
        hit = r.margin.hit; crit = r.margin.crit;
        r.outcome = r.margin.fumble ? 'fumble' : crit ? 'crit' : hit ? 'hit' : 'miss';
      } else {
        hit = r.d20 !== 1 && (crit || r.total >= target.ac);
        r.outcome = r.d20 === 1 ? 'fumble' : crit ? 'crit' : hit ? 'hit' : 'miss';
      }
    } else if (saveDC !== null) { r.needsSave = true; r.outcome = 'save'; }
    if (hit && damageClauses.length) {
      r.clauses = damageClauses.map(c => ({ type: c.type, dice: c.dice, roll: battleRollDamage(c.dice, crit) })).filter(c => c.roll);
      const base = r.clauses.reduce((n, c) => n + c.roll.total, 0);
      r.damage = r.clauses.length ? Math.max(1, Math.round(base * mult)) : 0;
      r.mult = mult;
      if (r.margin && r.clauses.length) { r.preMargin = r.damage; r.damage = AM.scaleDamage(r.damage, r.margin); }
    }
    return r;
  }
  // ---------- stat-block spellcasting ----------
  // monster.spellcasting (parsed from the stat block, see monsterParseSpellcasting) lists spells as
  // at-will, N/day or slot-limited. Each offensive spell becomes a real action built from the spell
  // compendium (its own dice, damage type, save or attack roll) using the block's own save DC /
  // spell attack bonus. Uses are tracked per token and spent when a spell is rolled.
  function spellState(token) {
    if (token.spellState) return token.spellState;
    const st = { slots: {}, daily: {} };
    (token.monster.spellcasting || []).forEach(b => b.groups.forEach(g => {
      if (g.kind === 'slots') st.slots[g.level] = (st.slots[g.level] || 0) + (g.slots || 1);
      if (g.kind === 'daily') g.spells.forEach(n => { st.daily[n.toLowerCase()] = g.uses; });
    }));
    return (token.spellState = st);
  }
  function crOf(m) { const t = String(m.cr || '0'); return t.includes('/') ? (+t.split('/')[0]) / (+t.split('/')[1]) : (parseFloat(t) || 0); }
  function spellActions(token) {
    const out = [], st = spellState(token);
    token.spellCache = token.spellCache || {};
    (token.monster.spellcasting || []).forEach(b => b.groups.forEach(g => g.spells.forEach(name => {
      const key = name.toLowerCase();
      if (g.kind === 'daily' && !(st.daily[key] > 0)) return;
      if (g.kind === 'slots' && !(st.slots[g.level] > 0)) return;
      let act = token.spellCache[key];
      if (act === undefined) act = token.spellCache[key] = buildChaosSpellAction(name, 0, { toHit: b.toHit, dc: b.dc, strict: true, casterLevel: Math.ceil(crOf(token.monster)) });
      if (!act || (act.utility && !/(saving throw|DC \d+)/.test(act.text + ' ') || act.utility && !/paraly|charm|frighten|blind|stun|restrain|incapacit|asleep|sleep|poison|prone|slow|deafen|banish|command|fear|hold|dominat|entangle|confus/i.test(act.text))) return; // only offensive spells
      const note = g.kind === 'will' ? 'at will' : g.kind === 'daily' ? `${g.label}, ${st.daily[key] - 1} left after` : `level ${g.level} slot, ${st.slots[g.level] - 1} left after`;
      out.push({ ...act, source: 'spell', origin: 'statblock', useNote: note, consume: () => { if (g.kind === 'daily') st.daily[key]--; if (g.kind === 'slots') st.slots[g.level]--; } });
    })));
    return out;
  }
  window.btSpellActions = spellActions;

  // A monster's turn against a target. Multiattack is never rolled itself: it triggers two other
  // attacks that are NOT multiattacks.
  function rollMonster(token, target) {
    const m = token.monster;
    // Everything the creature can do: its own attacks, plus each piece of chaos gear that grants an
    // action — a wielded weapon is a weapon attack, a learned spell is a real spell action.
    const gear = (token.entry.chaosGearList || []).map(g => g.kind === 'spell' ? g.spellAction && { ...g.spellAction, source: 'spell' } : g.kind === 'weapon' ? g.weaponAction && { ...g.weaponAction, source: 'weapon' } : null).filter(Boolean);
    const actions = [...(m.actions || []).filter(a => isAttackish(a) || isMulti(a)), ...gear, ...spellActions(token)];
    const result = { token, target, attacks: [], multi: false, note: '' };
    if (!actions.some(a => !isMulti(a))) { result.note = 'This creature has no attack action to roll.'; return result; }
    const picked = ri(actions);
    if (picked.consume) picked.consume();
    if (isMulti(picked)) {
      const singles = actions.filter(a => !isMulti(a) && (isAttackish(a) || a.utility));
      result.multi = true; result.multiAction = picked;
      if (!singles.length) { result.note = 'Multiattack, but no other attack to roll.'; return result; }
      const first = ri(singles), rest = singles.filter(a => a !== first);
      const second = rest.length ? ri(rest) : first;
      [first, second].forEach(a => { if (a.consume) a.consume(); result.attacks.push(rollAction(a, target, token.entry)); });
    } else result.attacks.push(rollAction(picked, target, token.entry));
    return result;
  }
  function attackHtml(a, idx, gi) {
    const head = a.toHit !== null
      ? (a.margin && window.AttackMarginUI
          ? (AttackMarginUI.bind(a, () => { document.getElementById('btAttackBody').innerHTML = popupHtml(bt.last.groups); recalc(); }),
             `d20 <b>${a.d20}</b> ${fmt(a.toHit)} = <b>${a.total}</b> vs AC ${a.ac}` + AttackMarginUI.html(a, a.preMargin != null && a.margin.dmgPct !== 100 ? `<div class="am-calc">Damage ${a.preMargin} × ${a.margin.dmgPct}% → <b>${a.damage}</b></div>` : ''))
          : `d20 <b>${a.d20}</b> ${fmt(a.toHit)} = <b>${a.total}</b> vs AC ${a.ac} → <span class="bt-${a.outcome === 'fumble' ? 'miss' : a.outcome}">${{ crit: 'Critical hit!', hit: 'Hit', miss: 'Miss', fumble: 'Critical miss' }[a.outcome]}</span>`)
      : a.saveDC !== null ? `Target makes a <b>DC ${a.saveDC}</b> save <label class="bt-note"><input type="checkbox" checked onchange="btToggleSave(${gi},${idx},this.checked)"> failed</label>` : `<span class="bt-note">${a.utility ? esc(a.text) : 'No attack roll — read the effect.'}</span>`;
    const dmg = a.clauses.length
      ? a.clauses.map(c => `<div class="weapon-attack-line"><span>${esc(c.dice)}${c.type ? ' ' + esc(c.type) : ''}${a.outcome === 'crit' ? ' (doubled)' : ''}</span><span>${c.roll.rolls.join(' + ')}${c.roll.mod ? (c.roll.mod > 0 ? ' + ' : ' − ') + Math.abs(c.roll.mod) : ''} = <b>${c.roll.total}</b></span></div>`).join('')
        + (a.mult && a.mult !== 1 ? `<div class="weapon-attack-line"><span>Variant damage ×${a.mult.toFixed(2).replace(/\.?0+$/, '')}</span><span></span></div>` : '')
        + `<div class="weapon-attack-total" style="font-size:1.05rem;margin:0.3rem 0 0">Damage: <span id="btDmg-${gi}-${idx}">${a.outcome === 'save' ? (a.failed === false ? 0 : a.damage) : a.damage}</span>${a.outcome === 'save' ? ' <span class="bt-note">(if failed)</span>' : ''}</div>`
      : '';
    const narr = window.AttackNarrator ? `<div class="an-tools"><button class="action-btn" onclick="btDescribe(${gi},${idx})">📖 Describe</button><span id="btNarrBtns-${gi}-${idx}"></span></div><div id="btNarr-${gi}-${idx}">${a.narr && a.narr.open ? narrHtml(gi, idx, a) : ''}</div>` : '';
    return `<div class="sub"><b>${esc(a.name)}</b>${a.source === 'spell' ? ` <span class="bt-note">✦ spell (${a.useNote ? esc(a.useNote) : 'chaos gear'})</span>` : a.source === 'weapon' ? ' <span class="bt-note">⚔ wielded weapon (chaos gear)</span>' : ''}<div>${head}</div>${dmg}${narr}</div>`;
  }
  // ---------- narration (attack-narrator.js) ----------
  // Turns a rolled attack into a few short, DM-readable paragraphs: what it looks like, what a hit
  // does, how it misses, plus the real rolled outcome. Everything is deterministic per (attack, take).
  function narrCtx(gi, a, detail) {
    const g = bt.last.groups[gi], t = g.token, m = t.monster;
    const gear = (t.entry.chaosGearList || []).find(x => (x.weaponAction && x.weaponAction.name === a.name) || (x.spellAction && x.spellAction.name === a.name));
    return {
      attacker: { name: m.name, type: m.type, size: m.size, cr: m.cr, str: m.str, dex: m.dex, traits: m.traits },
      entry: t.entry, target: { name: g.target.name },
      result: { outcome: a.outcome, damage: a.damage, failed: a.failed },
      weapon: gear && gear.kind === 'weapon' ? { name: gear.name, rarity: gear.rarity } : null,
      detail: detail || 'standard', variant: (a.narr && a.narr.take) || 0, seed: t.id || 0,
    };
  }
  function narrHtml(gi, idx, a) {
    try {
      const r = window.AttackNarrator.describe({ name: a.name, text: a.text, source: a.source, isSpell: a.source === 'spell' }, narrCtx(gi, a, a.narr.detail));
      return r.html + `<div class="an-tools"><button class="action-btn" onclick="btDescribeTake(${gi},${idx})">🔄 Another take</button><button class="action-btn" onclick="btDescribeDetail(${gi},${idx})">${a.narr.detail === 'full' ? '➖ Shorter' : '➕ Full detail'}</button><button class="action-btn" onclick="btDescribeCopy(${gi},${idx})">📋 Copy</button></div>`;
    } catch (e) { return `<div class="bt-note">Could not describe this attack.</div>`; }
  }
  const narrRefresh = (gi, i) => { const a = bt.last.groups[gi].attacks[i], el = document.getElementById(`btNarr-${gi}-${i}`); if (el) el.innerHTML = a.narr && a.narr.open ? narrHtml(gi, i, a) : ''; };
  window.btDescribe = function (gi, i) { const a = bt.last.groups[gi].attacks[i]; a.narr = a.narr || { open: false, take: 0, detail: 'standard' }; a.narr.open = !a.narr.open; narrRefresh(gi, i); };
  window.btDescribeTake = function (gi, i) { const a = bt.last.groups[gi].attacks[i]; a.narr.take++; narrRefresh(gi, i); };
  window.btDescribeDetail = function (gi, i) { const a = bt.last.groups[gi].attacks[i]; a.narr.detail = a.narr.detail === 'full' ? 'standard' : 'full'; narrRefresh(gi, i); };
  window.btDescribeCopy = function (gi, i) {
    const a = bt.last.groups[gi].attacks[i];
    const r = window.AttackNarrator.describe({ name: a.name, text: a.text, source: a.source, isSpell: a.source === 'spell' }, narrCtx(gi, a, a.narr.detail));
    if (navigator.clipboard) navigator.clipboard.writeText(r.text).catch(() => {});
  };
  window.btDescribeTurn = function (gi) {
    const el = document.getElementById('btTurn-' + gi); if (!el) return;
    if (el.innerHTML) { el.innerHTML = ''; return; }
    const g = bt.last.groups[gi];
    const seq = window.AttackNarrator.describeSequence(g.attacks.map((a, i) => ({ attack: { name: a.name, text: a.text, source: a.source, isSpell: a.source === 'spell' }, ctx: narrCtx(gi, a, 'brief') })), { seed: g.token.id || 0 });
    el.innerHTML = `<div class="an-narr"><div class="an-head"><b>${esc(seq.title)}</b></div><div>${esc(seq.text)}</div></div>`;
  };
  function popupHtml(groups) {
    let grand = 0;
    const body = groups.map((g, gi) => {
      const sub = g.attacks.reduce((n, a) => n + (a.outcome === 'save' && a.failed === false ? 0 : a.damage), 0);
      grand += sub;
      return `<div class="bt-atk"><h5>${esc(g.token.name)} → ${esc(g.target.name)}</h5>
        ${g.multi ? `<div class="bt-note">Multiattack — rolling two other attacks (never another Multiattack).</div>${window.AttackNarrator ? `<div class="an-tools"><button class="action-btn" onclick="btDescribeTurn(${gi})">📖 Describe the whole turn</button></div><div id="btTurn-${gi}"></div>` : ''}` : ''}
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
  window.btToggleSave = function (gi, i, ok) { const a = bt.last.groups[gi].attacks[i]; a.failed = ok; recalc(); if (a.narr && a.narr.open) narrRefresh(gi, i); };
  function open(groups, targetToken, applied) {
    bt.last = { groups, targetToken, total: 0, applied: !!applied, monsters: groups.map(g => g.token) };
    document.getElementById('btAttackBody').innerHTML = popupHtml(groups);
    document.getElementById('btAttackTitle').textContent = `⚔ ${groups.length > 1 ? groups.length + ' monsters' : groups[0].token.name} attack${groups.length > 1 ? '' : 's'} ${targetToken.name}`;
    document.getElementById('btAttackModal').classList.add('open');
    recalc();
  }
  function attackTarget(target) {
    const attackers = bt.tokens.filter(t => bt.selected.has(t.id) && alive(t));
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
      if (t) bt.tokens.push(t);
      btRenderField();
    });
    // hover info
    f.addEventListener('mouseover', e => { const t = tokenOf(e.target); if (t && !bt.drag) showTip(e, t); });
    f.addEventListener('mousemove', e => { const t = tokenOf(e.target); if (t && !bt.drag) { const tt = document.getElementById('itemTooltip'); if (tt && tt.style.display === 'block' && typeof moveTokenTooltip === 'function') moveTokenTooltip(e); } else hideTip(); });
    f.addEventListener('mouseleave', hideTip);
    // right-click (or press and hold on a touch screen) = that token's control panel
    f.addEventListener('contextmenu', e => {
      e.preventDefault();
      const t = tokenOf(e.target);
      if (t) openPanel(t, e); else btClosePanel();
    });
    let pressTimer = null;
    f.addEventListener('touchstart', e => { const t = tokenOf(e.target); if (!t || e.touches.length !== 1) return; const tc = e.touches[0]; pressTimer = setTimeout(() => { pressTimer = null; bt.drag = null; openPanel(t, { clientX: tc.clientX, clientY: tc.clientY }); }, 550); }, { passive: true });
    ['touchmove', 'touchend', 'touchcancel'].forEach(n => f.addEventListener(n, () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } }, { passive: true }));
    document.addEventListener('mousedown', e => { const p = panelEl(); if (p && p.classList.contains('open') && !p.contains(e.target) && e.button === 0) btClosePanel(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') btClosePanel(); });
    // left button: drag to move, click to select / attack
    f.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (e.target.dataset && e.target.dataset.x) { btRemoveToken(+e.target.dataset.x); return; }
      const t = tokenOf(e.target); if (!t) return;
      bt.drag = { t, sx: e.clientX, sy: e.clientY, moved: false, multi: e.shiftKey || e.ctrlKey || e.metaKey }; hideTip(); e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      const d = bt.drag; if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return;
      d.moved = true; const p = fieldPoint(e); d.t.x = p.x; d.t.y = p.y;
      const el = document.querySelector(`.bt-token[data-id="${d.t.id}"]`); if (el) { el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; }
    });
    document.addEventListener('mouseup', e => {
      const d = bt.drag; if (!d) return; bt.drag = null;
      if (d.moved) { if (d.t.kind === 'monster' && d.t.entry) { d.t.entry.bfX = d.t.x; d.t.entry.bfY = d.t.y; if (typeof scheduleSave === 'function') scheduleSave(); } return; }
      const t = d.t;
      if (t.kind === 'monster') {
        if (!alive(t)) return;
        if (d.multi) { bt.selected.has(t.id) ? bt.selected.delete(t.id) : bt.selected.add(t.id); btRenderField(); return; }
        if (bt.selectedPlayer) { playerAttacks(bt.tokens.find(x => x.id === bt.selectedPlayer), t); return; }
        if (bt.selected.size === 1 && bt.selected.has(t.id)) bt.selected.clear(); else { bt.selected.clear(); bt.selected.add(t.id); }
        btRenderField();
      } else if (bt.selected.size) attackTarget(t);
      else { bt.selectedPlayer = bt.selectedPlayer === t.id ? null : t.id; btRenderField(); }
    });
  };
  // A campaign character attacks a monster: their own gear and spells (PlayerAttack), resolved against the monster's AC.
  async function playerAttacks(pt, mt) {
    if (!pt || !mt || !alive(mt)) return;
    if (!window.PlayerAttack) return;
    const anchor = document.querySelector(`.bt-token[data-id="${mt.id}"]`);
    let state = null;
    if (pt.uid) {
      bt.lastResult = `Loading ${esc(pt.name)}’s sheet…`; btRenderField();
      state = pt.state = await fetchState(pt.uid);
      if (!state) { bt.lastResult = `Could not load ${esc(pt.name)}’s character — try again.`; btRenderField(); return; }
      applySheet(pt, state);
    } else if (pt.srcKey !== 'me') state = {};   // a quick test player has no gear: unarmed strikes
    bt.lastResult = '';
    PlayerAttack.beginFor({ currentTarget: anchor }, { state, who: pt.name, target: { name: mt.name, ac: mt.ac, apply(dmg, log) {
      bt.lastResult = `${log.detail}${mt.hp - Math.max(0, dmg) <= 0 ? ' <b>Defeated!</b>' : ''}`;
      damageMonster(mt, dmg);   // updates the roster entry (HP, defeated), saves and re-renders; the attacker stays ready for the next target
    } } });
  }
  window.btRerollAll = function () {
    bt.tokens.filter(t => t.kind === 'monster').forEach(t => {
      const entry = buildBattleEntry(t.monster, sliderOpts());
      entry.uid = t.entry.uid; entry.bfX = t.x; entry.bfY = t.y;   // same slot in the roster, freshly rolled
      const i = battleRoster.findIndex(e => e.uid === t.entry.uid); if (i >= 0) battleRoster[i] = entry;
      t.entry = entry; delete t.spellState; delete t.spellCache;
    });
    if (typeof renderCombatRoster === 'function') renderCombatRoster(); else btRenderField();
  };
  window.btClear = function () {
    if (battleRoster.length && !confirm('Remove every creature from the battle (including their rolled loot)?')) return;
    bt.tokens = []; bt.selected.clear(); bt.selectedPlayer = null; bt.lastResult = ''; btClosePanel();
    if (typeof clearBattleRoster === 'function') clearBattleRoster(); else btRenderField();
  };
  window.btHealAll = function () {
    bt.tokens.forEach(t => { if (t.kind === 'monster') { t.entry.hp = t.entry.maxHp; t.entry.defeated = false; delete t.spellState; } else t.hp = t.maxHp; });
    if (typeof renderCombatRoster === 'function') renderCombatRoster(); else btRenderField();
  };
  window.btOnShow = function () {
    btInit(); btRenderSide(); btRenderField();   // btRenderField also pulls every roster creature onto the board
    if (typeof loadMonsterDatabase === 'function') loadMonsterDatabase(false).then(() => btRenderSide());
  };
  // expose the pure-ish pieces for tests
  window.btRollMonster = rollMonster;
  window.btAttackTarget = attackTarget;
})();
