// Shared display for the attack margin system (mechanics/engine/combat/attack-margin.js, docs/ATTACK_MARGIN.md):
// the "M = d20 + mods - AC" line, the tier, the damage percent and a picker for each minor / major effect.
// Classic script (window.AttackMarginUI). A roll that wants the UI carries
//   { margin: <resolveAttack result>, classes: [...], effects: [{kind,id,name,text}], d20, toHit, ac }
// AttackMarginUI.bind(roll, rerender) gives it an id; AttackMarginUI.html(roll) renders; amPick(id, i, optionId)
// swaps one effect and calls rerender() so the host popup redraws itself.
(function () {
  const reg = new Map(); let next = 1;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fm = n => (n >= 0 ? '+' : '−') + Math.abs(n);
  const AM = () => window.AttackMargin;

  const CSS = '.am-box{margin:.4rem 0;padding:.4rem .55rem;border-left:3px solid var(--gold,#c9a227);background:rgba(201,162,39,.07);font-size:.85rem}'
    + '.am-head{display:flex;flex-wrap:wrap;gap:.5rem;align-items:baseline}.am-head b{font-size:1rem}'
    + '.am-m{font-family:monospace;color:var(--gold,#c9a227)}.am-pct{color:var(--text-dim,#aaa)}'
    + '.am-calc{color:var(--text-dim,#aaa);font-size:.78rem;margin:.1rem 0 .3rem}'
    + '.am-eff{margin:.3rem 0}.am-kind{display:inline-block;min-width:3.4rem;font-size:.68rem;text-transform:uppercase;letter-spacing:.05em;padding:.05rem .35rem;border:1px solid var(--border,#444);border-radius:3px;margin-right:.3rem}'
    + '.am-kind.major{color:#e8963a;border-color:#e8963a}.am-kind.minor{color:#7fd0f0;border-color:#7fd0f0}.am-kind.fumble{color:#e06060;border-color:#e06060}'
    + '.am-eff select{max-width:70%;font-size:.8rem;background:var(--bg,#111);color:inherit;border:1px solid var(--border,#444)}'
    + '.am-text{margin:.15rem 0 0 .2rem;color:var(--text-dim,#bbb);font-size:.8rem}'
    + '.am-tier-miss,.am-tier-fumble{border-left-color:#c04040;background:rgba(192,64,64,.08)}.am-tier-glancing{border-left-color:#888}'
    + '.am-tier-crushing,.am-tier-devastating{border-left-color:#e8963a;background:rgba(232,150,58,.1)}'
    + '.am-ac{display:inline-flex;gap:.35rem;align-items:center;margin:.25rem 0}.am-ac input{width:4.5rem}';
  if (typeof document !== 'undefined' && document.head && !document.getElementById('amStyle')) { const st = document.createElement('style'); st.id = 'amStyle'; st.textContent = CSS; document.head.appendChild(st); }

  function bind(roll, rerender) { if (!roll._amId) roll._amId = next++; roll._amRerender = rerender; reg.set(roll._amId, roll); return roll._amId; }

  function effectsHtml(roll) {
    const A = AM(); const picks = roll.effects || [];
    return picks.map((e, i) => {
      const opts = A.effectOptions(e.kind, roll.classes);
      return `<div class="am-eff"><span class="am-kind ${e.kind}">${e.kind === 'fumble' ? 'Mishap' : e.kind}</span>`
        + `<select onchange="amPick(${roll._amId},${i},this.value)">${opts.map(o => `<option value="${o.id}"${o.id === e.id ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select>`
        + `<div class="am-text">${esc(e.text)}</div></div>`;
    }).join('');
  }
  // roll.margin must be set. `damageLine` is optional extra HTML shown under the tier (e.g. base -> final damage).
  function html(roll, damageLine) {
    const A = AM(); const m = roll.margin; if (!A || !m) return '';
    const calc = roll.d20 != null ? `d20 ${roll.d20} ${fm(roll.toHit != null ? roll.toHit : (roll.toHitMod || 0))} − AC ${roll.ac} = ${fm(m.margin)}${m.forced ? ` (${m.forced})` : ''}` : '';
    const pct = m.hit ? `${m.dmgPct}% damage` : 'no damage';
    return `<div class="am-box am-tier-${m.tierId}"><div class="am-head"><b>${esc(m.label)}${m.crit ? ' · CRIT (dice doubled)' : ''}</b><span class="am-m">M ${fm(m.margin)}</span><span class="am-pct">${pct}${m.minor ? ' · ' + m.minor + ' minor' : ''}${m.major ? ' · ' + m.major + ' major' : ''}</span></div>`
      + (calc ? `<div class="am-calc">${esc(calc)}</div>` : '') + (damageLine || '') + effectsHtml(roll) + '</div>';
  }
  window.amPick = function (id, index, optionId) {
    const roll = reg.get(id); if (!roll) return;
    roll.effects = AM().swapEffect(roll.effects, index, optionId, roll.classes);
    if (typeof roll._amRerender === 'function') roll._amRerender();
  };
  window.AttackMarginUI = { bind, html, effectsHtml, esc };
})();
