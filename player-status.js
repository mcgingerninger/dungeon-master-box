// Player Status panel: what is active on a character right now (buffs, conditions, transformations, resistances,
// senses, stat changes ...). Renders the plain object built by mechanics/engine/character/player-status.js.
// API: PlayerStatusUI.html(status, {id}) -> html, PlayerStatusUI.mount(el, status, {id}), PlayerStatusUI.tick(root).
// Mobile first: a single column of cards that becomes a grid on wider screens; sections are collapsible and remember
// whether they were open (per panel id) across re-renders.
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const closed = new Set();
  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const remain = ms => (window.PlayerStatus ? PlayerStatus.formatRemaining(ms) : '');

  if (!document.getElementById('ps-css')) {
    const st = document.createElement('style'); st.id = 'ps-css';
    st.textContent = `
    .ps-wrap { font-size:.92rem; }
    .ps-empty { color:var(--muted,#8a8070); font-style:italic; padding:.4rem 0; }
    .ps-summary { display:flex; flex-wrap:wrap; gap:.35rem; margin-bottom:.7rem; }
    .ps-chip { border:1px solid var(--border,#3a3025); background:var(--surface2,#1a1510); padding:.2rem .55rem; border-radius:999px; font-size:.8rem; white-space:nowrap; }
    .ps-chip.buff { border-color:#4a8a4a; color:#9ad89a; } .ps-chip.bad { border-color:#a04040; color:#e89a9a; }
    .ps-chip.form { border-color:#8a5ac0; color:#c8a8f0; } .ps-chip.def { border-color:#4a7ab0; color:#a8c8f0; }
    .ps-sec { border:1px solid var(--border,#3a3025); margin-bottom:.5rem; background:var(--surface2,#1a1510); }
    .ps-sec > summary { cursor:pointer; padding:.55rem .75rem; font-weight:600; list-style:none; display:flex; justify-content:space-between; gap:.5rem; min-height:44px; align-items:center; }
    .ps-sec > summary::-webkit-details-marker { display:none; }
    .ps-sec > summary .n { color:var(--gold,#c9a84c); font-weight:400; }
    .ps-body { padding:.1rem .75rem .7rem; display:grid; grid-template-columns:1fr; gap:.45rem; }
    .ps-card { border-left:3px solid var(--common,#9d9d9d); background:var(--surface,#120e0a); padding:.45rem .6rem; min-width:0; }
    .ps-card.uncommon{border-left-color:var(--uncommon)} .ps-card.rare{border-left-color:var(--rare)} .ps-card.epic{border-left-color:var(--epic)}
    .ps-card.legendary{border-left-color:var(--legendary)} .ps-card.celestial{border-left-color:var(--celestial)}
    .ps-card.bad { border-left-color:#c04a4a; } .ps-card.form { border-left-color:#8a5ac0; }
    .ps-card .nm { font-weight:600; overflow-wrap:anywhere; }
    .ps-card .tm { float:right; color:var(--gold,#c9a84c); font-variant-numeric:tabular-nums; margin-left:.5rem; }
    .ps-card .tx { color:var(--muted,#b0a690); font-size:.84rem; margin-top:.15rem; overflow-wrap:anywhere; }
    .ps-tags { display:flex; flex-wrap:wrap; gap:.3rem; margin-top:.3rem; }
    .ps-tag { background:rgba(201,168,76,.12); border:1px solid rgba(201,168,76,.3); padding:.05rem .4rem; font-size:.76rem; }
    .ps-row { display:flex; flex-wrap:wrap; justify-content:space-between; gap:.2rem .6rem; padding:.2rem 0; border-bottom:1px dashed rgba(255,255,255,.07); }
    .ps-row .src { color:var(--muted,#8a8070); font-size:.78rem; overflow-wrap:anywhere; }
    .ps-pos { color:#9ad89a; } .ps-neg { color:#e89a9a; }
    @media (min-width:700px) { .ps-body.cards { grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); } }
    `;
    document.head.appendChild(st);
  }

  const tags = stats => (stats && stats.length ? `<div class="ps-tags">${stats.map(d => `<span class="ps-tag ${d.amount < 0 ? 'ps-neg' : 'ps-pos'}">${d.amount > 0 ? '+' : ''}${esc(d.amount)} ${esc(d.label || d.stat || d.name || '')}</span>`).join('')}</div>` : '');
  const card = (r, cls) => {
    const tm = r.permanent ? (r.kind === 'timed' ? '<span class="tm">until next day</span>' : '') : `<span class="tm" data-ps-exp="${esc(r.expiresAt || (Date.now() + (r.remainingMs || 0)))}">${esc(remain(r.remainingMs))}</span>`;
    const sub = r.form ? `<div class="tag-line"><span class="ps-tag">Form: ${esc(r.form)}</span></div>` : r.condition ? `<div><span class="ps-tag">${esc(cap(r.condition))}</span></div>` : '';
    return `<div class="ps-card ${esc(cls || r.rarity)}">${tm}<div class="nm">${esc(r.name)}</div>${sub}<div class="tx">${esc(r.text)}</div>${tags(r.stats)}</div>`;
  };
  const sec = (id, key, icon, title, count, inner, cards) => count ? `<details class="ps-sec" data-ps="${key}"${closed.has(id + ':' + key) ? '' : ' open'}><summary><span>${icon} ${esc(title)}</span><span class="n">${count}</span></summary><div class="ps-body${cards ? ' cards' : ''}">${inner}</div></details>` : '';
  const srcs = a => (a && a.length ? `<span class="src">${esc(a.join(', '))}</span>` : '');
  const line = (label, src, cls) => `<div class="ps-row"><span class="${cls || ''}">${label}</span>${srcs(src)}</div>`;

  function html(st, opts) {
    const id = (opts && opts.id) || 'me';
    if (!st || st.empty) return `<div class="ps-wrap" data-ps-id="${esc(id)}"><div class="ps-empty">Nothing is active right now. Potions, powers, conditions and equipped gear with defensive or utility effects will show up here.</div></div>`;
    const c = st.counts, d = st.defenses;
    const chips = [];
    if (c.transformations) chips.push(`<span class="ps-chip form">🐾 ${c.transformations} transformed</span>`);
    if (c.buffs) chips.push(`<span class="ps-chip buff">✨ ${c.buffs} buff${c.buffs > 1 ? 's' : ''}</span>`);
    if (c.debuffs) chips.push(`<span class="ps-chip bad">☠️ ${c.debuffs} condition${c.debuffs > 1 ? 's' : ''}/debuff${c.debuffs > 1 ? 's' : ''}</span>`);
    if (c.resist || c.immune) chips.push(`<span class="ps-chip def">🛡️ ${c.resist} resist · ${c.immune} immune</span>`);
    if (c.vulnerable) chips.push(`<span class="ps-chip bad">💥 ${c.vulnerable} vulnerable</span>`);
    const out = [`<div class="ps-summary">${chips.join('')}</div>`];
    out.push(sec(id, 'form', '🐾', 'Transformations', c.transformations, st.transformations.map(r => card(r, 'form')).join(''), true));
    out.push(sec(id, 'debuffs', '☠️', 'Conditions & debuffs', c.debuffs, st.debuffs.map(r => card(r, 'bad')).join(''), true));
    out.push(sec(id, 'buffs', '✨', 'Buffs', c.buffs, st.buffs.map(r => card(r)).join(''), true));
    out.push(sec(id, 'always', '♾️', 'Feats & hidden powers', c.always, st.always.map(r => card(r)).join(''), true));
    const defRows = [
      ...d.resist.map(r => line(`🛡️ Resist ${esc(r.type)}${r.nonmagical ? ' (nonmagical)' : ''}`, r.sources)),
      ...d.immune.map(r => line(`⛔ Immune: ${esc(r.what)}${r.kind === 'condition' ? ' (condition)' : ''}`, r.sources)),
      ...d.vulnerable.map(r => line(`💥 Vulnerable to ${esc(r.type)}`, r.sources, 'ps-neg')),
      ...d.advantage.map(r => line(`🎯 ${esc(r.text)}`, [r.source], 'ps-pos')),
      ...d.disadvantage.map(r => line(`⚠️ ${esc(r.text)}`, [r.source], 'ps-neg')),
      ...d.restrictions.map(r => line(`🚫 ${esc(r.text)}`, [r.source], 'ps-neg')),
    ];
    out.push(sec(id, 'def', '🛡️', 'Resistances, immunities & advantages', defRows.length, defRows.join('')));
    const utl = [
      ...st.senses.map(s => line(`👁️ ${esc(s.name)} ${s.feet} ft.`, [s.source])),
      ...st.movement.map(s => line(`🏃 ${esc(cap(s.mode))} speed ${s.feet} ft.`, [s.source])),
      ...st.regeneration.map(r => line(`❤️ Regain ${r.hp} HP at the start of each turn`, [r.source], 'ps-pos')),
    ];
    out.push(sec(id, 'utl', '🧭', 'Senses & movement', utl.length, utl.join('')));
    out.push(sec(id, 'stats', '📈', 'Stats currently changed', st.stats.length, st.stats.map(s => line(`${esc(s.label)} <strong class="${s.amount < 0 ? 'ps-neg' : 'ps-pos'}">${s.amount > 0 ? '+' : ''}${esc(s.amount)}</strong>`, s.sources)).join('')));
    return `<div class="ps-wrap" data-ps-id="${esc(id)}">${out.join('')}</div>`;
  }

  function mount(el, st, opts) {
    if (!el) return;
    el.innerHTML = html(st, opts);
    const id = (opts && opts.id) || 'me';
    el.querySelectorAll('details.ps-sec').forEach(d => d.addEventListener('toggle', () => { const k = id + ':' + d.dataset.ps; if (d.open) closed.delete(k); else closed.add(k); }));
  }
  // Per-second countdown refresh without rebuilding the DOM (keeps scroll position, open sections and text selection).
  function tick(root) {
    const now = Date.now();
    (root || document).querySelectorAll('[data-ps-exp]').forEach(el => { el.textContent = remain(Math.max(0, +el.dataset.psExp - now)); });
  }
  window.PlayerStatusUI = { html, mount, tick };
})();
