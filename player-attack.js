// Player attacks on a creature (the opposite of a creature's "Roll Attack" on a player).
// The Attack button on a creature card attacks with whatever is in the MAIN HAND. When more than one real attack is
// possible (two weapons, or a weapon plus damage spells) a tiny chooser pops up with the attack icons from the inventory
// ability bar. Only things that actually deal damage are offered: weapons with damage dice, and spells that damage -
// never items that merely cause an effect. A bow or crossbow is offered only while there is ammunition for it.
//   mode 'player' (connected player): roll it and send it to the DM, who applies the degree of hit.
//   mode 'dm' (DM / solo): the roll is resolved against the creature's AC right here and the damage can be applied in one click.
// The same code also lets the DM make ANOTHER character attack (Battle Field tab): withCharacter(state, fn) runs fn with that
// character's synced sheet, gear, spells and inventory temporarily standing in for the local ones, then puts the DM's own back.
// API: PlayerAttack.options(), PlayerAttack.begin(evt, uid, mode, forceChooser), PlayerAttack.apply(outcome),
//      PlayerAttack.beginFor(evt, { state, who, target, force }), PlayerAttack.withCharacter(state, fn)
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hasDice = item => /\d+\s*d\s*\d+/i.test(String((item && item.dmg) || ''));

  // ---- run code as another character (their synced state stands in for the globals, then everything is put back) ----
  const BLANK_SLOTS = () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 });
  function withCharacter(state, fn) {
    if (!state) return fn();
    const saved = { characterAbilityScores, characterLevel, skillProficiencies, saveProficiencies, playerSlots, characterMaxHp, characterSpeed, activeTimedEffects, feats, achievedUnlocks, characterKnownSpells, characterSpellSlots, characterSpellSlotsUsed, savedGeneratedItems, characterClass, weaponProf, inventoryPlacements };
    try {
      ({
        characterAbilityScores, characterLevel, skillProficiencies, saveProficiencies, playerSlots, characterMaxHp, characterSpeed, activeTimedEffects, feats, achievedUnlocks, characterKnownSpells, characterSpellSlots, characterSpellSlotsUsed, savedGeneratedItems, characterClass, weaponProf, inventoryPlacements,
      } = {
        characterAbilityScores: state.characterAbilityScores || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        characterLevel: state.characterLevel || 1, skillProficiencies: state.skillProficiencies || [], saveProficiencies: state.saveProficiencies || [],
        playerSlots: state.playerSlots || {}, characterMaxHp: state.characterMaxHp != null ? state.characterMaxHp : 10, characterSpeed: state.characterSpeed != null ? state.characterSpeed : 30,
        activeTimedEffects: state.activeTimedEffects || [], feats: state.feats || [], achievedUnlocks: state.achievedUnlocks || [],
        characterKnownSpells: state.characterKnownSpells || [], characterSpellSlots: state.characterSpellSlots || BLANK_SLOTS(), characterSpellSlotsUsed: state.characterSpellSlotsUsed || BLANK_SLOTS(),
        savedGeneratedItems: state.savedGeneratedItems || [], characterClass: state.characterClass || '', weaponProf: state.weaponProf || { categories: [], weapons: [] }, inventoryPlacements: state.inventoryPlacements || {},
      });
      buildTokenIndex();
      return fn();
    } finally {
      ({ characterAbilityScores, characterLevel, skillProficiencies, saveProficiencies, playerSlots, characterMaxHp, characterSpeed, activeTimedEffects, feats, achievedUnlocks, characterKnownSpells, characterSpellSlots, characterSpellSlotsUsed, savedGeneratedItems, characterClass, weaponProf, inventoryPlacements } = saved);
      buildTokenIndex();
    }
  }

  // ---- which spells deal damage? (healing, buffs and utility spells are not attacks) ----
  function spellInfo(name) {
    const known = (characterKnownSpells || []).find(s => s.name === name) || {};
    const full = (window.SpellCompendiumAPI && SpellCompendiumAPI.find && SpellCompendiumAPI.find(name)) || {};
    const raw = { ...known, ...full };
    const json = JSON.stringify(raw.entries || []);
    const plain = String(raw.description || '') + ' ' + json;
    const inflicts = !!(raw.damageInflict && raw.damageInflict.length);
    const dice = /\{@(?:damage|dice) ([^}|]+)/.test(json) || /\b\d+d\d+\b/.test(String(raw.description || ''));
    const healing = !inflicts && /regains?\s+(?:a number of\s+)?hit points|\bheal/i.test(plain);
    const damaging = !healing && (inflicts || (dice && /damage/i.test(plain)));
    return { damaging, level: Number(raw.level != null ? raw.level : known.level || 0), school: (raw.schoolName || known.schoolName || '').toLowerCase(), attack: !!(raw.spellAttack && raw.spellAttack.length) };
  }
  function lowestOpenSlot(level) {
    if (!level) return 0;
    return Object.keys(characterSpellSlots || {}).map(Number).filter(l => l >= level && (characterSpellSlots[l] || 0) > ((characterSpellSlotsUsed || {})[l] || 0)).sort((a, b) => a - b)[0] || null;
  }

  // ---- every real attack this character can make right now, main hand first ----
  function options() {
    buildTokenIndex();
    const out = [], seen = new Set();
    ['weapon1', 'weapon2'].forEach(slotId => {
      const key = playerSlots[slotId], e = key && TOKEN_INDEX[key];
      if (!e || seen.has(key) || !hasDice(e.item)) return;
      seen.add(key);
      const info = window.AmmoData ? availableAmmoFor(e.item) : { kind: null, stacks: [] };
      const noAmmo = !!(info.kind && !info.stacks.length);
      out.push({ id: 'w:' + slotId, kind: 'weapon', slotId, key, item: e.item, rarity: e.rarity, name: e.item.name, sub: (e.item.dmg || '') + (info.kind ? ` · ${info.stacks.reduce((n, x) => n + x.qty, 0)} ${info.kind}s` : ''), mainHand: slotId === 'weapon1', disabled: noAmmo, reason: noAmmo ? `No ${info.kind}s` : '' });
    });
    (characterKnownSpells || []).forEach(sp => {
      const si = spellInfo(sp.name);
      if (!si.damaging) return;
      const slot = lowestOpenSlot(si.level);
      out.push({ id: 's:' + sp.name, kind: 'spell', name: sp.name, spell: sp.name, level: si.level, school: si.school, slot, sub: si.level === 0 ? 'cantrip' : (slot ? `lvl ${slot} slot` : 'no slot'), disabled: si.level > 0 && !slot, reason: 'No open slot' });
    });
    if (!out.some(o => o.kind === 'weapon')) out.push({ id: 'u', kind: 'unarmed', name: 'Unarmed', sub: '1d6 + STR' });
    return out;
  }
  // The weapon used when you just press Attack: main hand, else off hand, else (no weapon) the first usable spell, else fists.
  function defaultOption(opts) {
    return opts.find(o => o.kind === 'weapon' && o.mainHand && !o.disabled) || opts.find(o => o.kind === 'weapon' && !o.disabled) || opts.find(o => o.kind === 'unarmed') || opts.find(o => !o.disabled) || null;
  }

  // ---- tiny chooser ----
  function closeChooser() { const el = document.getElementById('attackChooser'); if (el) el.remove(); document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', onKey, true); }
  function outside(e) { const el = document.getElementById('attackChooser'); if (el && !el.contains(e.target)) closeChooser(); }
  function onKey(e) { if (e.key === 'Escape') closeChooser(); }
  function optionIcon(o) {
    if (o.kind === 'weapon') return itemPixelIcon(o.item, 30, o.rarity);
    if (o.kind === 'spell') { const def = ABILITY_ICONS[o.school] || ABILITY_ICONS.universal; return pixelIconSvg(def, def.colors, 30); }
    return '<span style="font-size:1.5rem;line-height:30px">\u{1F44A}</span>';
  }
  const REG = new Map();
  function showChooser(anchor, opts, pick) {
    closeChooser();
    REG.clear();
    const el = document.createElement('div'); el.id = 'attackChooser'; el.className = 'attack-chooser';
    el.innerHTML = '<div class="ac-title">Attack with…</div><div class="ac-grid">' + opts.map(o => {
      REG.set(o.id, o);
      const hover = o.kind === 'weapon' ? ' ' + itemHoverAttrs(o.item, o.rarity, o.key) : '';
      return `<button type="button" class="ac-opt ${o.kind}${o.disabled ? ' disabled' : ''}" data-id="${esc(o.id)}"${o.disabled ? ' disabled' : ''}${hover} title="${esc(o.name + (o.reason && o.disabled ? ' — ' + o.reason : ''))}">${optionIcon(o)}<span class="ac-name">${esc(o.name.length > 16 ? o.name.slice(0, 15) + '…' : o.name)}</span><span class="ac-sub">${esc(o.disabled ? o.reason : o.sub)}</span></button>`;
    }).join('') + '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', e => { const b = e.target.closest('.ac-opt'); if (!b || b.disabled) return; const o = REG.get(b.dataset.id); closeChooser(); if (typeof hideTokenTooltip === 'function') hideTokenTooltip(true); if (o) pick(o); });
    const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: innerWidth / 2 - 100, bottom: innerHeight / 2, top: innerHeight / 2, width: 0 };
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.max(6, Math.min(innerWidth - w - 6, r.left)) + 'px';
    el.style.top = Math.max(6, (r.bottom + h + 8 > innerHeight ? r.top - h - 6 : r.bottom + 6)) + 'px';
    setTimeout(() => { document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', onKey, true); }, 0);
  }

  // ---- doing the attack ----
  // A target is { name, ac, apply(dmg, log), send? }: apply() writes the result onto the creature, send() hands the roll to a DM.
  let cur = null;   // { roll, label, saveSpell, tgt, who }
  // foreign = another character's state (the DM making them attack): their ammunition and spell slots are not spent here.
  function buildRoll(o, sheet, foreign) {
    if (o.kind === 'weapon') {
      const r = foreign ? rollWeaponWithAmmo(o.item, sheet, o.rarity, { noSpend: true }) : rollWeaponWithAmmo(o.item, sheet, o.rarity);
      if (r) r._label = o.item.name; return r;
    }
    if (o.kind === 'unarmed') { const r = computeUnarmedAttackRoll(sheet); r._label = 'Unarmed'; return r; }
    // spell: spend the slot (your own only), then roll it
    let slot = o.slot || 0;
    if (o.level > 0) {
      slot = lowestOpenSlot(o.level); if (!slot) { flashInvMessage(`No open slot for ${o.name}.`, true); return null; }
      if (!foreign) {
        characterSpellSlotsUsed[slot] = (characterSpellSlotsUsed[slot] || 0) + 1;
        if (typeof renderPlayerSlots === 'function') renderPlayerSlots();
        if (typeof renderSpellbookSlotsGrid === 'function') renderSpellbookSlotsGrid();
        if (typeof renderAbilityBar === 'function') renderAbilityBar();
        if (typeof scheduleSave === 'function') scheduleSave();
      }
    }
    const r = resolveSpellCast(o.name, slot);
    r.slotsLeft = slot ? Math.max(0, (characterSpellSlots[slot] || 0) - (characterSpellSlotsUsed[slot] || 0) - (foreign ? 1 : 0)) : null;
    return { classes: window.AttackMargin ? AttackMargin.attackClassesOf(o.name) : [], d20: r.d20, isCrit: !!r.isCrit, isFumble: !!r.isFumble, toHitMod: r.focusAtk || 0, toHitTotal: r.toHit, dmgTotal: r.total != null && !r.isHealing ? r.total : null, spell: r, _label: o.name, _html: rr => spellCastRollHtml(r) + (r.toHit != null ? attackMarginSectionHtml(rr) : '') };
  }
  // state: null = this character; otherwise another character's synced state
  function run(o, tgt, state, who) {
    const foreign = !!state;
    const roll = withCharacter(state, () => buildRoll(o, computeCharacterSheet(), foreign)); if (!roll) return;
    const sp = roll.spell, saveSpell = !!(sp && sp.dc != null && sp.toHit == null);
    const title = `${o.kind === 'spell' ? '✦' : '⚔'} ${who ? who + ': ' : ''}${o.kind === 'spell' ? 'Cast' : 'Attack'} — ${roll._label} → ${tgt.name}`;
    cur = { tgt, roll, label: roll._label, saveSpell, who: who || (typeof characterName === 'string' && characterName) || 'Your character' };
    if (!tgt.send) {
      if (!saveSpell && tgt.ac != null) applyAttackMargin(roll, tgt.ac);
      const note = saveSpell
        ? `<div class="pa-actions"><button class="loot-save-btn" onclick="PlayerAttack.apply('fail')">✗ Failed the save — full damage</button><button class="loot-save-btn" onclick="PlayerAttack.apply('save')">✓ Saved${sp.halfOnSave ? ' — half damage' : ' — no damage'}</button></div>`
        : `<div class="pa-actions"><button class="loot-save-btn" onclick="PlayerAttack.apply('hit')">⚔ Apply to ${esc(tgt.name)}</button><span class="sheet-chip-empty">AC ${tgt.ac == null ? '?' : tgt.ac}. Pick any effects above first.</span></div>`
          + (foreign && roll.ammo ? `<p class="sheet-chip-empty">Used 1 ${esc(roll.ammo.name)} — remove it from their inventory yourself.</p>` : '');
      showAttackRoll(roll, title, note, !saveSpell && roll.toHitTotal != null);
    } else {
      showAttackRoll(roll, title, '<p class="sheet-chip-empty">Sent to your DM, who knows the target’s AC and applies the result.</p>', false);
      const payload = { monsterUid: tgt.uid, monsterName: tgt.name, weaponName: roll._label, kind: o.kind, d20: roll.d20, toHitTotal: roll.toHitTotal, isCrit: !!roll.isCrit, isFumble: !!roll.isFumble, dmgTotal: roll.dmgTotal };
      if (roll.ammo) payload.ammoName = roll.ammo.name;
      if (sp) { payload.damageType = sp.damageType || ''; if (saveSpell) { payload.toHitTotal = null; payload.dc = sp.dc; payload.saveStat = sp.saveStat; payload.halfOnSave = !!sp.halfOnSave; } }
      if (typeof window.submitBattlefieldAttack !== 'function') return;
      window.submitBattlefieldAttack(payload).catch(() => flashInvMessage('Failed to send the attack to your DM — check your connection.', true));
    }
  }

  // DM / solo: write the result onto the creature and into the log.
  function apply(outcome) {
    if (!cur) return;
    const { tgt, roll, label, saveSpell, who } = cur;
    let dmg = 0, cls = 'miss', title = '', detail = '';
    if (saveSpell) {
      const sp = roll.spell, full = roll.dmgTotal || 0;
      dmg = outcome === 'fail' ? full : (sp.halfOnSave ? Math.floor(full / 2) : 0);
      cls = dmg > 0 ? 'hit' : 'miss'; title = outcome === 'fail' ? `${label}: failed the save` : `${label}: saved`;
      detail = `<strong>${esc(who)}</strong> casts <strong>${esc(label)}</strong> at <strong>${esc(tgt.name)}</strong> — ${esc(sp.saveStat || '')} save DC ${sp.dc}, ${outcome === 'fail' ? 'failed' : 'succeeded'}. ${dmg} damage${sp.damageType ? ' ' + esc(sp.damageType) : ''}.`;
    } else {
      const m = roll.margin, hit = m ? m.hit : !roll.isFumble;
      dmg = hit && roll.dmgTotal != null ? (roll.finalDamage != null ? roll.finalDamage : roll.dmgTotal) : 0;
      cls = roll.isFumble || (m && m.fumble) ? 'miss' : roll.isCrit && hit ? 'crit' : hit ? 'hit' : 'miss';
      const effects = roll.effects && roll.effects.length ? ` Effects: ${roll.effects.map(e => `<strong>${esc(e.name)}</strong> (${esc(e.text)})`).join('; ')}` : '';
      title = roll.isCrit && hit ? `Critical hit! (${m ? m.label : 'Hit'})` : m ? m.label : (hit ? 'Hit' : 'Miss');
      detail = `<strong>${esc(who)}</strong> attacks <strong>${esc(tgt.name)}</strong> with ${esc(label)}${roll.ammo ? ' (' + esc(roll.ammo.name) + ')' : ''} — rolled <strong>${roll.toHitTotal}</strong>${roll.ac != null ? ' vs AC ' + roll.ac : ''}${m ? ` (M ${m.margin >= 0 ? '+' : ''}${m.margin})` : ''}. ${hit ? dmg + ' damage.' : 'No damage.'}${effects}`;
    }
    tgt.apply(dmg, { cls, title: `${who} — ${title}`, detail });
    if (typeof closeWeaponAttackPopup === 'function') closeWeaponAttackPopup();
    cur = null;
  }

  // Which attack: the main-hand weapon straight away; the chooser when there is a real choice (or when forced).
  function pickAndRun(evt, state, who, tgt, force) {
    const opts = withCharacter(state, () => options());
    const usable = opts.filter(o => !o.disabled), weapons = opts.filter(o => o.kind === 'weapon');
    const def = defaultOption(opts);
    const needChooser = force || weapons.length >= 2 || (!weapons.length && usable.some(o => o.kind === 'spell'));
    if (needChooser && opts.length > 1) { showChooser(evt && (evt.currentTarget || evt.target), opts, o => run(o, tgt, state, who)); return; }
    if (!def) { flashInvMessage(weapons.length ? `${weapons[0].reason || 'Cannot attack'} — ${weapons[0].name}.` : 'Nothing to attack with.', true); return; }
    run(def, tgt, state, who);
  }
  // Creature cards (Combat tab = DM/solo, Battlefield tab = connected player).
  function begin(evt, uid, mode, forceChooser) {
    if (evt && evt.stopPropagation) evt.stopPropagation();
    const list = mode === 'dm' ? battleRoster : battlefieldRoster;
    const e = (list || []).find(x => x.uid === uid); if (!e) { flashInvMessage('That creature is gone.', true); return; }
    const name = e.displayName || (e.monster && e.monster.name) || 'the creature';
    const tgt = mode === 'dm'
      ? { name, ac: e.ac != null ? e.ac : (e.monster && e.monster.ac), apply(dmg, log) {
          const en = battleRoster.find(x => x.uid === uid); if (!en) return;
          if (dmg > 0 && !en.defeated) { en.hp = Math.max(0, en.hp - dmg); if (en.hp <= 0) en.defeated = true; }
          battleLog.push({ cls: log.cls, title: log.title, detail: log.detail }); if (battleLog.length > 50) battleLog = battleLog.slice(-50);
          renderCombatRoster(); renderCombatLog();
          if (typeof flashCombatMessage === 'function') flashCombatMessage(dmg > 0 ? `${dmg} damage to ${name}${en.defeated ? ' — defeated!' : ''}.` : 'No damage.');
        } }
      : { name, uid, send: true };
    pickAndRun(evt, null, null, tgt, forceChooser);
  }
  // Anyone: { state, who, target:{name, ac, apply}, force } - used by the Battle Field tab to make a campaign character attack.
  function beginFor(evt, o) { pickAndRun(evt, o.state || null, o.who || null, o.target, !!o.force); }
  // The two buttons that go on a creature card: Attack (main hand) and a small arrow that always opens the chooser.
  function buttonsHtml(uid, mode, label) {
    return `<span class="pa-split"><button class="combat-roll-btn" onclick="PlayerAttack.begin(event,${uid},'${mode}')" title="Attack with your main hand">${label || '⚔ Attack'}</button><button class="combat-roll-btn pa-more" onclick="PlayerAttack.begin(event,${uid},'${mode}',true)" title="Choose a weapon or spell">▾</button></span>`;
  }

  if (!document.getElementById('pa-css')) {
    const st = document.createElement('style'); st.id = 'pa-css';
    st.textContent = `.pa-split{display:inline-flex;gap:2px}.pa-more{padding-left:.5rem;padding-right:.5rem}
.attack-chooser{position:fixed;z-index:1250;background:var(--surface2,#1a1510);border:1px solid var(--gold,#c9a84c);box-shadow:0 6px 24px rgba(0,0,0,.6);padding:.45rem .5rem .55rem;max-width:min(340px,calc(100vw - 12px))}
.ac-title{font-size:.72rem;color:var(--text-dim,#aaa);margin-bottom:.3rem;letter-spacing:.04em;text-transform:uppercase}
.ac-grid{display:flex;flex-wrap:wrap;gap:.35rem}
.ac-opt{display:flex;flex-direction:column;align-items:center;gap:1px;width:78px;min-height:64px;padding:.3rem .2rem;background:var(--surface,#120e0a);border:1px solid var(--border,#3a3025);color:inherit;cursor:pointer;font:inherit}
.ac-opt:hover:not(.disabled){border-color:var(--gold,#c9a84c);background:rgba(201,168,76,.12)}
.ac-opt.disabled{opacity:.45;cursor:not-allowed}
.ac-name{font-size:.72rem;line-height:1.1;text-align:center;overflow-wrap:anywhere}.ac-sub{font-size:.62rem;color:var(--text-dim,#aaa);text-align:center}
.pa-actions{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center;margin-top:.5rem}
@media (max-width:700px){.attack-chooser{left:0!important;right:0;top:auto!important;bottom:0;max-width:none;border-width:2px 0 0;padding:.7rem .7rem calc(.8rem + env(safe-area-inset-bottom));z-index:9000}.ac-opt{width:calc(25% - .3rem);min-height:76px}.ac-grid{gap:.4rem}}`;
    document.head.appendChild(st);
  }
  window.PlayerAttack = { options, defaultOption, begin, beginFor, apply, buttonsHtml, spellInfo, withCharacter };
})();
