// Brings the default item catalog (loot-data.js + the NPC signature weapons in npc-data.js) into line
// with the Item Rules (mechanics/data/item-rules-default.js, docs/ITEM_RULES.md):
//   1. No modifier may touch an attack roll — "+N to attack (and damage) rolls" becomes damage only.
//   2. An item's rarity follows its modifier weight: items more than the rule's tolerance away from the
//      rarity their weight earns move to that tier, and an item with more modifiers than its rarity
//      allows moves up to a rarity that does.
//   3. An item's gp value follows its weight inside its rarity's price band.
// Chests, quest items/documents and items with an "Unknown" price (unique campaign pieces) keep their
// authored rarity and price, though rule 1 still applies to them.
//
//   node scripts/enforce-item-rules.js           fix the files in place and write docs/ITEM_RULES_AUDIT.md
//   node scripts/enforce-item-rules.js --dry     only print what would change
//   node scripts/enforce-item-rules.js --audit   only write the audit report
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_ITEM_RULES } from '../mechanics/data/item-rules-default.js';
import { mergeItemRules, scoreItem, evaluateItem, rarityForWeight, priceForWeight, parseGp, ruleOf, RARITY_ORDER, isValueExempt } from '../mechanics/engine/items/item-rules.js';

const root = path.join(import.meta.dirname, '..');
const cfg = mergeItemRules(null);

// ---- rule 1: attack-roll modifiers -> damage ----
export function convertAttackModifiers(text) {
  let t = String(text);
  const hadDamageBonus = /[+-]\d+\s+(?:bonus\s+)?to\s+(?:all\s+)?damage(?:\s+rolls?)?\b/i.test(t.replace(/[+-]\d+\s+(?:bonus\s+)?to\s+attack\s+and\s+damage(?:\s+rolls?)?/gi, ''));
  t = t.replace(/([+-]\d+)\s+(?:bonus\s+)?to\s+attack\s+and\s+damage(?:\s+rolls?)?/gi, '$1 to damage rolls');
  t = t.replace(/([+-]\d+)\s+attack\s+and\s+damage\b/gi, '$1 to damage rolls');
  t = t.replace(/([+-]\d+)\s+(?:to\s+)?attack\s*\/\s*damage(?:\s+rolls?)?/gi, '$1 to damage rolls');
  const attackOnly = /([+-]\d+)\s+(?:bonus\s+)?to\s+(?:all\s+)?(?:spell\s+)?attack(?:\s+rolls?)?\b|([+-]\d+)\s+to\s+hit\b/gi;
  t = t.replace(attackOnly, (m, a, b, off) => {
    const n = a || b;
    if (/spell\s+attack/i.test(m)) return /spell save DC/i.test(t) ? '' : `${n} to spell save DC`;
    return hadDamageBonus ? '' : `${n} to damage rolls`;
  });
  t = t.replace(/([+-]\d+)\s+spell\s+attack\s+bonus\b/gi, (m, n) => (/spell save DC/i.test(t) ? '' : `${n} to spell save DC`));
  t = t.replace(/([+-]\d+)\s+Attack Bonus\b/g, '$1 Damage Dealt');
  // tidy leftovers from removed phrases: ", and ", "and and", " ,", ". .", double spaces
  t = t.replace(/\band\s+and\b/gi, 'and').replace(/\s+,/g, ',').replace(/(?:^|(?<=[.;]))\s*[.;]\s*/g, m => m).replace(/\.\s*\./g, '.').replace(/,\s*\./g, '.').replace(/\band\s*([.;])/g, '$1').replace(/\s{2,}/g, ' ').trim();
  return t;
}

const EFFECT_FIELD = /(\beffect"?\s*:\s*)"((?:[^"\\]|\\.)*)"/;
const NAME_FIELD = /^\s*\{\s*"?name"?\s*:\s*"((?:[^"\\]|\\.)*)"/;
const GP_FIELD = /(\bgp"?\s*:\s*)"[^"]*"/;
const isItemLine = l => NAME_FIELD.test(l);
const isSpecial = isValueExempt;

function load(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }

// ---- the audit report ----
export function auditCatalog(lootData) {
  const byRule = {}; const rows = [];
  let total = 0, clean = 0;
  for (const tier of RARITY_ORDER) {
    for (const i of lootData[tier] || []) {
      total++;
      const v = evaluateItem({ ...i, rarity: tier }, cfg, { exempt: isSpecial(i) });
      if (!v.length) clean++;
      v.forEach(x => { byRule[x.rule] = byRule[x.rule] || { label: x.label, count: 0, examples: [] }; byRule[x.rule].count++; if (byRule[x.rule].examples.length < 8) byRule[x.rule].examples.push(`${tier} · ${i.name}: ${x.message}`); });
    }
  }
  return { total, clean, byRule, rows };
}
function auditMarkdown(report, title) {
  const L = [`# Item rules audit — ${title}`, '', `Checked ${report.total} default catalog items against the rules in \`mechanics/data/item-rules-default.js\`. **${report.clean}** pass every rule.`, ''];
  const entries = Object.entries(report.byRule);
  if (!entries.length) L.push('No violations.');
  else {
    L.push('| Rule | Items breaking it |', '|---|---|');
    entries.forEach(([id, r]) => L.push(`| ${r.label} (\`${id}\`) | ${r.count} |`));
    entries.forEach(([id, r]) => { L.push('', `### ${r.label}`, ''); r.examples.forEach(e => L.push(`- ${e}`)); if (r.count > r.examples.length) L.push(`- …and ${r.count - r.examples.length} more`); });
  }
  L.push('', 'Regenerate with `node scripts/enforce-item-rules.js --audit`.');
  return L.join('\n') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const dry = process.argv.includes('--dry');
  const auditOnly = process.argv.includes('--audit');
  const lootSrc = load('loot-data.js');
  const lootData = new Function(lootSrc + '; return lootData')();
  const before = auditCatalog(lootData);
  if (auditOnly) {
    fs.writeFileSync(path.join(root, 'docs/ITEM_RULES_AUDIT.md'), auditMarkdown(before, 'current state'));
    console.log(`audit: ${before.total} items, ${before.clean} clean`, Object.fromEntries(Object.entries(before.byRule).map(([k, v]) => [k, v.count])));
    process.exit(0);
  }

  // ---- split loot-data.js into tier blocks (an item can span several lines) ----
  const lines = lootSrc.split('\n');
  const blocks = {}; let tier = null; const head = [], tail = []; let seenAny = false;
  const order = [];
  let pending = null, depth = 0, inStr = false;
  const scan = line => { // brace depth change of a line, ignoring braces inside "strings"
    let d = 0;
    for (let k = 0; k < line.length; k++) {
      const c = line[k];
      if (inStr) { if (c === '\\') k++; else if (c === '"') inStr = false; }
      else if (c === '"') inStr = true;
      else if (c === '{') d++;
      else if (c === '}') d--;
    }
    return d;
  };
  lines.forEach(line => {
    if (pending) { pending.push(line); depth += scan(line); if (depth <= 0) { blocks[tier].items.push(pending.join('\n')); pending = null; } return; }
    const th = line.match(/^\s{2}(common|uncommon|rare|superrare|legendary|celestial): \[/);
    if (th) { tier = th[1]; blocks[tier] = { open: line, items: [], other: [] }; order.push(tier); seenAny = true; return; }
    if (tier && /^\s{2}\],?\s*$/.test(line)) { blocks[tier].close = line; tier = null; return; }
    if (!seenAny) { head.push(line); return; }
    if (!tier) { tail.push(line); return; }
    if (isItemLine(line)) { inStr = false; depth = scan(line); if (depth <= 0) blocks[tier].items.push(line); else pending = [line]; }
    else if (/^\s*,\s*$/.test(line)) return;   // a lone comma line is only an item separator; every item gets its own trailing comma below
    else blocks[tier].other.push(line);
  });

  const stats = { converted: 0, moved: [], repriced: 0 };
  const placed = {}; RARITY_ORDER.forEach(r => { placed[r] = []; });
  const keepOrder = [];
  for (const t of order) {
    const block = blocks[t];
    block.items.forEach(line => {
      let l = line;
      const em = l.match(EFFECT_FIELD);
      let effect = em ? em[2] : '';
      const fixed = convertAttackModifiers(effect);
      if (em && fixed !== effect) { l = l.replace(EFFECT_FIELD, (m, k) => `${k}"${fixed}"`); effect = fixed; stats.converted++; }
      const name = JSON.parse('"' + l.match(NAME_FIELD)[1] + '"');
      const item = lootData[t].find(x => x.name === name) || {};
      let decoded = effect;
      try { decoded = JSON.parse('"' + effect + '"'); } catch (e) { /* keep the raw text */ }
      const live = { ...item, effect: decoded };
      let target = t;
      if (!isSpecial(item)) {
        const sc = scoreItem(live, cfg);
        const tol = ruleOf(cfg, 'rarity-matches-weight').params.tolerance;
        const want = rarityForWeight(sc.total, cfg);
        if (Math.abs(RARITY_ORDER.indexOf(want) - RARITY_ORDER.indexOf(t)) > tol) target = want;
        // too many modifiers for the rarity -> the lowest rarity that allows that many
        const capRule = ruleOf(cfg, 'max-modifiers-by-rarity');
        const count = sc.components.filter(c => c.kind !== 'clause' && c.kind !== 'charges' && c.kind !== 'spell').length + (sc.components.some(c => c.kind === 'spell') ? 1 : 0);
        while (capRule.enabled && capRule.params[target] != null && count > capRule.params[target] && RARITY_ORDER.indexOf(target) < RARITY_ORDER.length - 1) target = RARITY_ORDER[RARITY_ORDER.indexOf(target) + 1];
        // price from weight inside the (possibly new) rarity
        const oldGp = parseGp(item.gp);
        if (oldGp !== null && (target !== 'common' || sc.total >= 0.5 || target !== t)) {
          const gp = `${priceForWeight(sc.total, target, cfg)} gp`;
          if (GP_FIELD.test(l) && gp !== item.gp) { l = l.replace(GP_FIELD, (m, k) => `${k}"${gp}"`); stats.repriced++; }
        }
        if (target !== t) stats.moved.push({ name, from: t, to: target, weight: sc.total });
      }
      placed[target].push(l.replace(/,?\s*$/, ','));
    });
  }
  const out = [...head];
  order.forEach(t => {
    out.push(blocks[t].open);
    blocks[t].other.forEach(o => out.push(o));
    placed[t].forEach(l => out.push(l));
    out.push(blocks[t].close || '  ],');
  });
  out.push(...tail);
  const newSrc = out.join('\n');

  // NPC signature weapons live in npc-data.js; same attack-roll rule
  const npcSrc = load('npc-data.js');
  let npcConverted = 0;
  const newNpc = npcSrc.split('\n').map(line => {
    const em = line.match(EFFECT_FIELD);
    if (!em) return line;
    const fixed = convertAttackModifiers(em[2]);
    if (fixed === em[2]) return line;
    npcConverted++;
    return line.replace(EFFECT_FIELD, (m, k) => `${k}"${fixed}"`);
  }).join('\n');

  fs.writeFileSync("/tmp/claude-0/-home-user-dungeon-master-box/4a09cc0f-4820-5498-b473-baff158b25e6/scratchpad/new-loot.js", newSrc);
  const after = auditCatalog(new Function(newSrc + "; return lootData")());
  console.log(`attack modifiers converted: ${stats.converted} catalog + ${npcConverted} NPC weapons; repriced: ${stats.repriced}; moved tiers: ${stats.moved.length}`);
  console.table(Object.fromEntries(Object.entries(after.byRule).map(([k, v]) => [k, v.count])));
  console.log(`clean: ${before.clean}/${before.total} -> ${after.clean}/${after.total}`);
  if (!dry) {
    fs.writeFileSync(path.join(root, 'loot-data.js'), newSrc);
    fs.writeFileSync(path.join(root, 'npc-data.js'), newNpc);
    fs.writeFileSync(path.join(root, 'docs/ITEM_RULES_AUDIT.md'), auditMarkdown(after, 'after enforcement') + (stats.moved.length ? '\n## Items that changed rarity\n\n| Item | From | To | Weight |\n|---|---|---|---|\n' + stats.moved.map(m => `| ${m.name} | ${m.from} | ${m.to} | ${m.weight} |`).join('\n') + '\n' : ''));
    console.log('Wrote loot-data.js, npc-data.js and docs/ITEM_RULES_AUDIT.md — now run `npm run migrate`.');
  }
}
