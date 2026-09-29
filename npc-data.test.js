// Regression test for npc-data.js's NPC_LIBRARY/NPC_COMBAT_DEFS reconciliation (see
// docs/NON_ITEM_CONTENT_SCOPE.md). These are two independently-authored sources of truth for the
// same named NPCs: NPC_COMBAT_DEFS is mechanically live (dungeon_loot_wheel_v102_spell_details.html's
// humanNpc()/humanNpcAttack() derive every real, dice-rolled Combat tab stat from it), while
// NPC_LIBRARY's own ac/hp/speed/attacks fields are pure read-aloud flavor text for the NPCs tab,
// never rolled. A full audit found the two had drifted on HP, speed, and most weapon attacks'
// to-hit/damage across 21 of 26 combat-capable NPCs — not a rare edge case, most of the cast — and
// they were reconciled by recomputing NPC_LIBRARY's formula-backed numbers (HP, speed, a weapon's
// own +to-hit and base damage dice) from NPC_COMBAT_DEFS, the same way humanNpc()/humanNpcAttack()
// themselves compute them. Deliberately NOT reconciled, and not checked here either: attack/ability
// NAMES, non-weapon special-ability text (DCs, save effects, flavor — no formula backs these, so
// there's no "correct" answer to enforce), or bonus-damage riders — those are legitimate authorial
// content on both sides, not a drift bug.
//
// This test is the permanent guard against the SAME class of drift recurring silently: it verifies
// NPC_LIBRARY's hp/speed/attack numbers still agree with what NPC_COMBAT_DEFS's own formula would
// produce, for every shared NPC, every time either file is edited. It duplicates
// humanNpc()/humanNpcAttack()'s exact formulas rather than loading the monolith (a ~30,000-line
// browser script with no export statement, not something Node can practically load in a test) —
// same "kept in sync by convention, not by import" pattern this codebase already uses for
// parseWeaponEffectBonuses and other monolith/script-shared logic. If the monolith's own formula
// ever changes, this copy needs updating too.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

function loadNpcData() {
  const src = fs.readFileSync(path.join(ROOT, 'npc-data.js'), 'utf8');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'npc-data.js' });
  return {
    NPC_LIBRARY: vm.runInContext('NPC_LIBRARY', sandbox),
    NPC_COMBAT_DEFS: vm.runInContext('NPC_COMBAT_DEFS', sandbox),
  };
}

// Verbatim copies of dungeon_loot_wheel_v102_spell_details.html's own formulas.
function abilityMod(score) { return Math.floor((score - 10) / 2); }
function crSortValue(cr) {
  if (cr == null || cr === '—') return -1;
  const s = String(cr);
  if (s.includes('/')) { const [a, b] = s.split('/').map(Number); return b ? a / b : 0; }
  return Number(s) || 0;
}
function humanNpcProfBonus(crNum) { return crNum >= 17 ? 6 : crNum >= 13 ? 5 : crNum >= 9 ? 4 : crNum >= 5 ? 3 : 2; }
function humanNpcHp(cfg) {
  const conMod = abilityMod(cfg.con);
  const [n, die] = cfg.hitDice;
  const totalMod = conMod * n;
  const hpAvg = Math.max(1, Math.floor(n * (die + 1) / 2) + totalMod);
  const hpFormula = `${n}d${die}${totalMod ? (totalMod > 0 ? '+' + totalMod : totalMod) : ''}`;
  return `${hpAvg} (${hpFormula})`;
}

const { NPC_LIBRARY, NPC_COMBAT_DEFS } = loadNpcData();
const libByName = new Map(NPC_LIBRARY.map(n => [n.name, n]));

describe('NPC_LIBRARY stays reconciled with NPC_COMBAT_DEFS (the mechanically-live source)', () => {
  NPC_COMBAT_DEFS.forEach(def => {
    test(`${def.name}: hp/speed/weapon-attack numbers agree with NPC_LIBRARY`, () => {
      const lib = libByName.get(def.name);
      assert.ok(lib, `NPC_COMBAT_DEFS has "${def.name}" but NPC_LIBRARY does not`);

      const normalize = s => String(s || '').replace(/\s+/g, '');
      assert.equal(normalize(lib.hp), normalize(humanNpcHp(def)),
        `HP: NPC_LIBRARY "${lib.hp}" vs NPC_COMBAT_DEFS-derived "${humanNpcHp(def)}"`);

      const expectedSpeed = (def.speed || '30 ft.').trim();
      assert.equal((lib.speed || '30 ft.').trim(), expectedSpeed,
        `speed: NPC_LIBRARY "${lib.speed}" vs NPC_COMBAT_DEFS "${def.speed}"`);

      const crNum = crSortValue(def.cr);
      (def.actions || []).forEach(a => {
        if (!a.weapon) return; // non-weapon special ability — no formula backs it, not checked
        const mod = abilityMod(def[a.ability]);
        const toHit = mod + humanNpcProfBonus(crNum);
        const dm = /^(\d+)d(\d+)$/.exec(a.dice);
        const n = dm ? parseInt(dm[1], 10) : 1, die = dm ? parseInt(dm[2], 10) : 6;
        const avg = Math.floor(n * (die + 1) / 2) + mod;
        const modStr = mod > 0 ? '+' + mod : mod < 0 ? String(mod) : '';

        const libAttack = (lib.attacks || []).find(at => at.name && at.name.includes(a.weapon.split(' ')[0]));
        assert.ok(libAttack, `NPC_COMBAT_DEFS action "${a.weapon}" has no matching NPC_LIBRARY attacks[] entry`);
        assert.ok(libAttack.text.includes(`+${toHit} to hit`),
          `"${a.weapon}" to-hit: NPC_LIBRARY text "${libAttack.text}" does not contain expected "+${toHit} to hit"`);
        assert.ok(libAttack.text.includes(`${avg} (${a.dice}${modStr})`),
          `"${a.weapon}" damage: NPC_LIBRARY text "${libAttack.text}" does not contain expected "${avg} (${a.dice}${modStr})"`);
      });
    });
  });
});
