// "Examine": the one place that shows EVERYTHING about an item, opened from any item popup.
//   - hover an item (any screen), then press I  — or Shift+click it
//   - the 🔍 button on a Compendium row
// It reuses the same renderers as the hover popup (buildTooltipHtml's helpers), so nothing disagrees, and adds what a
// popup cannot hold: full scaling maths against YOUR character, what a great hit can do with this weapon (attack margin),
// every effect and hidden power, the quick-reference cards for each spell or creature it mentions, and why it is worth
// what it is (Item Rules weight breakdown). Classic script; everything it calls is a global of the main script.
(function () {
  const E = s => (typeof escapeHtml === 'function' ? escapeHtml(s) : String(s == null ? '' : s));
  const safe = (fn, label) => { try { return fn() || ''; } catch (e) { console.warn('examine:', label, e); return ''; } };
  const fm = n => (typeof fmtMod === 'function' ? fmtMod(n) : (n >= 0 ? '+' + n : String(n)));
  const RAR_NAME = r => (typeof rarityNames !== 'undefined' && rarityNames[r]) || r;

  const CSS = '.ex-wrap{display:grid;grid-template-columns:minmax(0,1fr);gap:.7rem}'
    + '.ex-head{display:flex;gap:.9rem;align-items:center;padding-bottom:.6rem;border-bottom:1px solid var(--border,#444)}'
    + '.ex-head h2{margin:0;font-size:1.25rem}.ex-sub{color:var(--text-dim,#aaa);font-size:.8rem;margin-top:.15rem}'
    + '.ex-chips{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.45rem}.ex-chip{font-size:.75rem;padding:.1rem .5rem;border:1px solid var(--border,#444);border-radius:999px;background:var(--surface2,#1a1a1a)}'
    + '.ex-sec{border:1px solid var(--border,#444);border-radius:4px;background:var(--surface,#141414)}.ex-sec>summary{cursor:pointer;padding:.45rem .7rem;font-weight:600;color:var(--gold,#c9a227);list-style:none}'
    + '.ex-sec>summary::-webkit-details-marker{display:none}.ex-sec>summary::before{content:"▸ ";color:var(--text-dim,#888)}.ex-sec[open]>summary::before{content:"▾ "}'
    + '.ex-body{padding:.2rem .8rem .7rem;font-size:.86rem;line-height:1.5}.ex-body p{margin:.35rem 0}'
    + '.ex-table{width:100%;border-collapse:collapse;font-size:.82rem}.ex-table td,.ex-table th{padding:.2rem .4rem;border-bottom:1px solid var(--border,#333);text-align:left}.ex-table th{color:var(--text-dim,#aaa);font-weight:500}'
    + '.ex-grade{display:inline-block;min-width:1.6rem;text-align:center;font-weight:700;padding:0 .3rem;border:1px solid var(--border,#444);border-radius:3px}'
    + '.ex-note{color:var(--text-dim,#aaa);font-size:.78rem}.ex-mod{margin:.25rem 0;padding-left:.5rem;border-left:2px solid var(--border,#444)}.ex-mod b{color:var(--gold,#c9a227)}'
    + '.ex-eff{display:flex;flex-wrap:wrap;gap:.3rem;margin:.25rem 0}.ex-eff span{font-size:.74rem;padding:.05rem .4rem;border:1px solid var(--border,#444);border-radius:3px}'
    + '.ex-eff.major span{color:#e8963a;border-color:#e8963a}.ex-eff.minor span{color:#7fd0f0;border-color:#7fd0f0}'
    + '.ex-hint{position:fixed;bottom:0;left:0;right:0}'
    + '@media (max-width:700px){.ex-head{flex-wrap:wrap;gap:.5rem}.ex-head h2{font-size:1.1rem;overflow-wrap:anywhere}.ex-sec>summary{min-height:44px;display:flex;align-items:center}.ex-body{padding:.2rem .6rem .7rem;font-size:.92rem;overflow-x:auto}.ex-table{display:block;overflow-x:auto;white-space:nowrap}.ex-table td,.ex-table th{padding:.35rem .5rem}}';
  if (typeof document !== 'undefined' && document.head && !document.getElementById('exStyle')) { const st = document.createElement('style'); st.id = 'exStyle'; st.textContent = CSS; document.head.appendChild(st); }

  const sec = (title, body, open) => (body ? `<details class="ex-sec"${open === false ? '' : ' open'}><summary>${title}</summary><div class="ex-body">${body}</div></details>` : '');
  const chip = t => `<span class="ex-chip">${t}</span>`;

  // ---- header ----
  function headHtml(item, rarity) {
    const weight = item.weight != null ? item.weight : (typeof computeItemWeight === 'function' ? computeItemWeight(item) : null);
    if (!item.classification && typeof classifyItemFull === 'function') classifyItemFull(item, rarity);
    const crumbs = (item.classification || []).map(E).join(' › ');
    const chips = [];
    if (item.dmg) chips.push(chip('⚔ ' + E(item.dmg)));
    if (item.ac) chips.push(chip('🛡 AC ' + E(item.ac)));
    if (item.hp) chips.push(chip('❤ ' + E(item.hp)));
    if (item.gp) chips.push(chip('💰 ' + E(item.gp)));
    chips.push(chip('📦 Slot ' + (item.slotSize || 1)));
    if (weight != null) chips.push(chip('⚖ ' + weight + ' lbs'));
    if (item.charges) chips.push(chip('✦ ' + E(item.charges)));
    if (item.requirement) chips.push(chip('Req: ' + E(item.requirement)));
    if (/requires attunement/i.test(item.effect || '')) chips.push(chip('Attunement'));
    return `<div class="ex-head">${typeof itemPixelIcon === 'function' ? itemPixelIcon(item, 72, rarity) : ''}<div><h2 class="${rarity}">${E(item.name)}</h2><div class="ex-sub">${E(RAR_NAME(rarity))} · ${E(item.type || 'item')}${item.subcategory ? ' · ' + E(item.subcategory) : ''}</div>${crumbs ? `<div class="ex-sub">${crumbs}</div>` : ''}<div class="ex-chips">${chips.join('')}</div></div></div>`;
  }

  // ---- combat: weapons, armor, spell focus ----
  function scalingTable(scaling, mods, label) {
    const parts = computeScalingDamage(scaling, mods).parts;
    const rows = parts.map(p => `<tr><td>${SCALING_STAT_LABEL[p.stat]}</td><td><span class="ex-grade tt-grade-${p.grade}">${p.grade}</span> ×${p.mult}</td><td>${fm(p.mod)}</td><td>${p.value >= 0 ? '+' : ''}${Math.round(p.value * 100) / 100}${p.primary ? ' <span class="ex-note">(main stat, counts even if negative)</span>' : ''}</td></tr>`).join('');
    const total = computeScalingDamage(scaling, mods).total;
    return `<table class="ex-table"><tr><th>Stat</th><th>Grade</th><th>Your modifier</th><th>${label}</th></tr>${rows}</table><p><b>Total from scaling: ${fm(total)}</b> <span class="ex-note">(rounded)</span></p>`;
  }
  function combatHtml(item, rarity) {
    const mods = (() => { try { return currentAbilityMods(); } catch (e) { return null; } })();
    let out = '';
    if (item.type === 'weapon') {
      const sc = inferWeaponScaling(item, rarity);
      out += `<p>Damage = weapon dice <b>${E(item.dmg || '—')}</b> + grade × stat modifier for each stat + weapon bonuses. Scaling only affects damage; hitting uses d20 + proficiency + the weapon's own bonus.</p>`;
      if (mods) out += scalingTable(sc, mods, 'Damage added');
      else out += `<p>${scalingEntries(sc).map(e => `${e.label} <span class="ex-grade tt-grade-${e.grade}">${e.grade}</span>`).join(' ')}</p>`;
      const kindOf = safe(() => weaponScalingKind(item), 'kind');
      if (typeof weaponProficiencyInfo === 'function') {
        const info = weaponProficiencyInfo(item); const prof = safe(() => weaponProficiencyFor(item), 'prof');
        out += `<p>Proficiency: <b>${E(info.label)}</b> (${E(info.category)})${prof && prof.proficient != null ? (prof.proficient ? ' — <b>you are proficient</b>' : ' — you are <b>not</b> proficient') : ''}.</p>`;
      }
      out += marginHtml(item);
      out += focusHtml(item, rarity, mods);
      void kindOf;
    } else if (item.type === 'armor') {
      const sc = inferArmorScaling(item, rarity);
      out += `<p>Armor <b>${E(armorPieceKind(item))}</b>${item.ac ? `, base AC <b>${E(item.ac)}</b>` : ''}. Its grades add to your AC: grade × stat modifier. Across everything you wear, the best grade for each stat counts once.</p>`;
      out += mods ? scalingTable(sc, mods, 'AC added') : `<p>${scalingEntries(sc).map(e => `${e.label} <span class="ex-grade tt-grade-${e.grade}">${e.grade}</span>`).join(' ')}</p>`;
      out += focusHtml(item, rarity, mods);
    } else out += focusHtml(item, rarity, mods);
    return out;
  }
  function focusHtml(item, rarity, mods) {
    const f = inferItemSpellFocus(item, rarity); if (!f) return '';
    const active = itemFocusActive(item);
    const kind = f.buff === 'both' ? 'spell damage + attack' : f.buff === 'attack' ? 'spell attack' : 'spell damage';
    let line = `<p>✦ <b>Spell focus</b>: ${SCALING_STAT_LABEL[f.stat]} <span class="ex-grade tt-grade-${f.grade}">${f.grade}</span> — boosts ${kind} and spell save DC while equipped${active ? '.' : ', but this item casts no spells or deals no damage, so there is nothing to boost.'}</p>`;
    if (mods && active) { const b = computeSpellFocusBonus(f, mods), dc = computeSpellFocusDc(f, mods); line += `<p class="ex-note">With your stats: ${b.damage ? '+' + b.damage + ' spell damage, ' : ''}${b.attack ? '+' + b.attack + ' spell attack, ' : ''}+${dc} save DC.</p>`; }
    return line;
  }
  function marginHtml(item) {
    const A = window.AttackMargin; if (!A) return '';
    const cl = A.attackClassesOf(item.name, { heavy: typeof isTwoHandedWeapon === 'function' ? isTwoHandedWeapon(item) : false });
    const list = k => A.effectOptions(k, cl).map(e => `<span title="${E(e.text)}">${E(e.name)}</span>`).join('');
    return `<p>⚔ <b>Degree of hit</b> (M = d20 + attack − AC): class <b>${E(cl.join(', '))}</b>. A Solid hit earns 1 minor effect, Strong 2 minor, Crushing 1 major + 1 minor, Devastating 2 major.</p>`
      + `<details><summary class="ex-note">Minor effects this weapon can pick (${A.effectOptions('minor', cl).length})</summary><div class="ex-eff minor">${list('minor')}</div></details>`
      + `<details><summary class="ex-note">Major effects this weapon can pick (${A.effectOptions('major', cl).length})</summary><div class="ex-eff major">${list('major')}</div></details>`;
  }

  // ---- effects ----
  function effectsHtml(item, rarity) {
    let out = '';
    // a generated item has no .effect (its effects ARE its modifiers, listed below), so don't print them twice
    const effect = item.effect ? (typeof getItemEffectText === 'function' ? getItemEffectText(item) : item.effect) : '';
    if (effect && !(item.abilities && item.abilities.length)) out += typeof effectBulletsHtml === 'function' ? effectBulletsHtml(effect) : `<p>${E(effect)}</p>`;
    if (item.abilities && item.abilities.length) out += item.abilities.map(a => `<div class="ex-mod"><b>${E(a.name || 'Ability')}</b>${a.uses ? ` <span class="ex-note">(${E(a.uses.max != null ? a.uses.max + '×' : '')} ${E(a.uses.per || '')})</span>` : ''}<br>${E(a.text || a.description || '')}</div>`).join('');
    if (item.mods && item.mods.length) out += item.mods.map(m => `<div class="ex-mod"><b>${E(m.type)}${m.name ? ': ' + E(m.name) : ''}</b><br>${typeof colorizeModifierText === 'function' ? colorizeModifierText(m.text, m.type, true) : E(m.text)}</div>`).join('');
    if (item.unlocks && item.unlocks.length) {
      const gated = typeof isUnlockGatedForItem === 'function' && isUnlockGatedForItem(item) && document.body.classList.contains('role-player');
      out += `<p><b>Hidden powers</b></p>` + item.unlocks.map((u, i) => gated ? '<div class="ex-mod">🔒 Locked — ask your DM.</div>' : `<div class="ex-mod"><b>${E(u.tierLabel || 'Tier ' + (i + 1))}</b>${u.condition ? `<br><span class="ex-note">Condition: ${E(u.condition)}</span>` : ''}<br>${E(u.reward)}</div>`).join('');
    }
    const props = (item.properties || []).map(chip).join('') + (item.tags || []).map(t => chip('#' + E(t))).join('') + (item.interactions || []).map(a => chip('↻ ' + E((typeof INTERACTIONS !== 'undefined' && INTERACTIONS[a] && INTERACTIONS[a].label) || a))).join('');
    if (props) out += `<div class="ex-chips">${props}</div>`;
    return out;
  }
  function descHtml(item) {
    let out = '';
    if (item.desc) out += `<p><i>${E(item.desc)}</i></p>`;
    const paras = item.descParagraphs && item.descParagraphs.length ? item.descParagraphs : null;
    if (paras && typeof renderDescParagraphs === 'function') out += renderDescParagraphs(paras);
    else if (item.flavor && item.flavor !== item.desc) out += `<p>${E(item.flavor).replace(/\n\n/g, '</p><p>')}</p>`;
    return out;
  }
  function refsHtml(item) {
    if (typeof collectItemRefs !== 'function') return '';
    const refs = collectItemRefs(item); if (!refs.length) return '';
    const snaps = new Map(); (item.mods || []).forEach(m => { if (m.summonedMonster && m.summonedMonster.name) snaps.set(m.summonedMonster.name.toLowerCase(), m.summonedMonster); });
    return refs.slice(0, 8).map(r => `<div class="tt-refs">${r.kind === 'spell' ? buildSpellRefHtml(r.name, false) : r.kind === 'table' ? buildTableRefHtml(false) : buildMonsterRefHtml(r.name, false, snaps.get(r.name.toLowerCase()))}</div>`).join('');
  }
  // ---- value: Item Rules weight breakdown ----
  function valueHtml(item, rarity) {
    const IR = window.ItemRules, cfg = typeof getItemRules === 'function' ? getItemRules() : null;
    if (!IR || !cfg) return '';
    const sc = IR.scoreItem(item, cfg);
    const rows = (sc.components || []).map(c => `<tr><td>${E(c.kind)}</td><td>${E(c.label)}</td><td>${c.weight > 0 ? '+' : ''}${c.weight}</td></tr>`).join('');
    const band = cfg.rarityBands && cfg.rarityBands[rarity] ? `${cfg.rarityBands[rarity][0]}–${cfg.rarityBands[rarity][1] >= 1e6 ? '∞' : cfg.rarityBands[rarity][1]}` : '';
    const price = cfg.priceBands && cfg.priceBands[rarity] ? `${cfg.priceBands[rarity][0].toLocaleString()}–${cfg.priceBands[rarity][1].toLocaleString()} gp` : '';
    const viol = safe(() => IR.evaluateItem(item, cfg, { rarity, score: sc }).filter(v => v.severity === 'error').map(v => `<li>${E(v.message || v.rule)}</li>`).join(''), 'viol');
    return `<p>Every modifier has a weight; the total decides the rarity and where the price sits in its band. <b>Total weight ${sc.total}</b>${band ? ` · ${E(RAR_NAME(rarity))} band ${band}` : ''}${price ? ` · price band ${price}` : ''}.</p>`
      + (rows ? `<table class="ex-table"><tr><th>Kind</th><th>Modifier</th><th>Weight</th></tr>${rows}</table>` : '<p class="ex-note">No scored modifiers: this is a plain item.</p>')
      + (viol ? `<p class="ex-note">Item rule notes:</p><ul>${viol}</ul>` : '');
  }
  function sourceHtml(item) {
    const bits = [];
    if (item.merchant) bits.push('Sold by ' + E(item.merchant));
    if (item.sourceMonster) bits.push('Dropped by / made from ' + E(item.sourceMonster));
    if (item.genTags && item.genTags.length) bits.push('Generation tags: ' + item.genTags.map(E).join(', '));
    if (item.mods && item.mods.some(m => m.prefix)) bits.push('Affixes: ' + item.mods.filter(m => m.prefix).map(m => E(m.name)).join(', '));
    bits.push(item.id != null && String(item.id).length > 6 ? 'Generated or saved copy' : 'Catalog item');
    return bits.map(b => `<p>${b}</p>`).join('');
  }

  function examineHtml(item, rarity, key) {
    return `<div class="ex-wrap">${safe(() => headHtml(item, rarity), 'head')}`
      + sec('⚔ Combat and scaling', safe(() => combatHtml(item, rarity), 'combat'))
      + sec('✨ Effects and powers', safe(() => effectsHtml(item, rarity), 'effects'))
      + sec('📜 Description', safe(() => descHtml(item), 'desc'))
      + sec('📖 Quick reference', safe(() => refsHtml(item), 'refs'), false)
      + sec('⚖ Why it is worth this', safe(() => valueHtml(item, rarity), 'value'), false)
      + sec('ℹ Where it comes from', safe(() => sourceHtml(item), 'source'), false)
      + '</div>';
  }

  function open(item, rarity, key) {
    if (!item) return;
    rarity = rarity || item.rarity || 'common';
    const modal = document.getElementById('itemExamineModal'); if (!modal) return;
    document.getElementById('itemExamineBody').innerHTML = examineHtml(item, rarity, key);
    modal.classList.add('open');
    if (typeof hideTokenTooltip === 'function') hideTokenTooltip(true);
  }
  function close() { document.getElementById('itemExamineModal')?.classList.remove('open'); }

  window.examineItem = open; window.closeItemExamine = close;
  window.examineCompendiumItem = function (rarity, i) { const it = window.lootData && lootData[rarity] && lootData[rarity][i]; if (it) open(it, rarity); };
  window.examineHoveredItem = function () { const h = typeof _hoverItem !== 'undefined' ? _hoverItem : null; if (h && h.item) { open(h.item, h.rarity, h.key); return true; } return false; };

  // Keyboard / mouse triggers (only while an item popup is actually showing).
  const tooltipShowing = () => { const t = document.getElementById('itemTooltip'); return !!(t && t.style.display === 'block'); };
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { close(); return; }
    if ((e.key === 'i' || e.key === 'I') && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '') && !(document.activeElement && document.activeElement.isContentEditable) && tooltipShowing()) {
      if (window.examineHoveredItem()) e.preventDefault();
    }
  });
  document.addEventListener('click', e => { if (e.shiftKey && tooltipShowing() && window.examineHoveredItem()) { e.preventDefault(); e.stopPropagation(); } }, true);
  window.ItemExamine = { html: examineHtml, open, close };
})();
