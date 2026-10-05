// Item art: 32x32 shaded pixel icons built from three layers, in the same style as the monster tokens.
//   1. a BASE object chosen from the item's name/type (longsword, plate helmet, potion, ring ...),
//   2. a MATERIAL recolour (adamantine, mithril, bronze, bone, leather, silver ...),
//   3. EFFECTS drawn on top (flames, frost, lightning, poison, holy light, shadow, blood, arcane,
//      nature, wind, or a plain magic glimmer) with strength driven by rarity.
// itemArtSpec(item, rarity) describes what was picked; itemArtSvg(item, px, rarity) returns the
// <svg> or null when the item isn't something we draw (the app's older icon is used then).
// Needs monster-art.js (window.PixelKit) loaded first. Classic script.
(function () {
  const kit = window.PixelKit;
  if (!kit) return;
  const { Canvas, mix, N } = kit;
  const D = {};
  const strip = (C, x1, y1, x2, y2, w, role, tip) => {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, px = -uy * w / 2, py = ux * w / 2;
    const pts = [[x1 + px, y1 + py], [x2 + px, y2 + py], [x2 - px, y2 - py], [x1 - px, y1 - py]];
    if (tip) pts.splice(2, 0, [x2 + ux * tip, y2 + uy * tip]);
    C.p(pts, role);
  };
  // ---------- melee: drawn on the up-right diagonal, handle bottom-left ----------
  D.sword = C => { strip(C, 9, 23, 25, 7, 3.4, 'a', 4); C.l(8.4, 22.4, 24.4, 6.4, 'c'); C.l(10, 22, 23, 9, 'b'); strip(C, 5.5, 19.5, 12.5, 26.5, 2, 't'); strip(C, 9, 23, 5, 27, 2, 'h'); C.e(4, 28, 2, 2, 't'); C.d(9, 23, 'g'); };
  D.greatsword = C => { strip(C, 9, 22, 26, 5, 4.8, 'a', 5); C.l(8, 21, 25, 4, 'c'); C.l(10, 21, 24, 7, 'b'); strip(C, 4.5, 17.5, 13.5, 26.5, 2.4, 't'); strip(C, 9, 22, 4, 27, 2.4, 'h'); C.e(3.5, 28.5, 2.4, 2.4, 't'); C.d(9, 22, 'g'); };
  D.dagger = C => { strip(C, 12, 20, 24, 8, 2.8, 'a', 3.5); C.l(11.5, 19.5, 23.5, 7.5, 'c'); strip(C, 8.5, 16.5, 15.5, 23.5, 2, 't'); strip(C, 12, 20, 8, 24, 2, 'h'); C.e(7, 25.5, 1.8, 1.8, 't'); };
  D.axe = C => { strip(C, 7, 27, 21, 13, 2.2, 'h'); C.p([[16, 9], [22, 3], [29, 6], [29, 15], [23, 17], [20, 13]], 'a'); C.l(22, 4, 29, 8, 'c'); C.l(21, 15, 28, 14, 'b'); C.d(17, 12, 't'); };
  D.greataxe = C => { strip(C, 5, 28, 22, 11, 2.4, 'h'); C.p([[16, 7], [22, 2], [29, 5], [29, 12], [23, 13], [20, 11]], 'a'); C.p([[14, 14], [10, 10], [7, 15], [9, 21], [15, 19]], 'a'); C.l(22, 3, 29, 7, 'c'); C.l(9, 11, 8, 18, 'c'); C.d(17, 12, 't'); C.e(4, 29, 2, 2, 't'); };
  D.hammer = C => { strip(C, 7, 27, 23, 11, 2.2, 'h'); strip(C, 18, 5, 29, 16, 7, 'a'); C.l(19, 4.5, 29, 14.5, 'c'); C.l(20, 8, 27, 15, 'b'); C.d(23, 11, 't'); };
  D.mace = C => { strip(C, 7, 27, 21, 13, 2.2, 'h'); C.e(24, 9, 5.5, 5.5, 'a'); [[24, 2], [24, 16], [17, 9], [31, 9], [19, 4], [29, 4], [19, 14], [29, 14]].forEach(([x, y]) => C.d(x, y, 'c')); C.e(24, 9, 2, 2, 'b'); C.d(21, 13, 't'); };
  D.flail = C => { strip(C, 6, 28, 14, 20, 2.2, 'h'); [[16, 18], [18, 15], [20, 13]].forEach(([x, y]) => C.e(x, y, 1.2, 1.2, 'c')); C.e(25, 8, 5, 5, 'a'); [[25, 1], [25, 15], [18, 8], [32, 8], [20, 3], [30, 3], [20, 13], [30, 13]].forEach(([x, y]) => C.d(x, y, 'c')); C.d(14, 20, 't'); };
  D.club = C => { C.p([[6, 27], [9, 30], [18, 20], [29, 10], [24, 2], [16, 5], [11, 15]], 'h'); C.d(21, 8, 'b'); C.d(18, 13, 'b'); C.d(25, 5, 'b'); C.l(8, 28, 12, 24, 'l'); };
  D.spear = C => { strip(C, 3, 29, 23, 9, 1.8, 'h'); strip(C, 22, 10, 28, 4, 3.6, 'a', 4); C.l(21.5, 9.5, 27.5, 3.5, 'c'); C.l(18, 14, 21, 11, 'l', 2); C.d(7, 25, 'l'); };
  D.polearm = C => { strip(C, 3, 29, 24, 8, 1.8, 'h'); C.p([[19, 12], [14, 6], [20, 3], [27, 9], [23, 13]], 'a'); C.l(15, 6, 21, 3, 'c'); strip(C, 24, 8, 29, 3, 2, 'a', 3); C.d(20, 12, 't'); };
  D.trident = C => { strip(C, 3, 29, 21, 11, 1.8, 'h'); strip(C, 21, 11, 29, 3, 1.4, 'a', 3); strip(C, 20, 12, 24, 4, 1.4, 'a', 3); strip(C, 20, 12, 28, 8, 1.4, 'a', 3); strip(C, 17, 15, 24, 15, 1, 'a'); C.d(21, 11, 't'); };
  D.staff = C => { strip(C, 4, 29, 24, 9, 2, 'h'); C.p([[22, 11], [24, 5], [30, 7], [28, 12], [26, 10]], 't'); C.e(26.5, 7.5, 2.4, 2.4, 'g'); C.d(26, 7, 'w'); C.d(7, 26, 'l'); C.d(11, 22, 'l'); };
  D.wand = C => { strip(C, 8, 25, 23, 10, 1.8, 'h'); C.l(7, 26, 9, 24, 't', 2); C.e(25, 8, 2, 2, 'g'); C.d(25, 7, 'w'); C.d(23, 10, 't'); };
  D.bow = C => { [[22, 3, 13, 5], [13, 5, 8, 11], [8, 11, 7, 17], [7, 17, 9, 23], [9, 23, 15, 28]].forEach(([a, b, c, d]) => C.l(a, b, c, d, 'h', 2)); C.l(22, 3, 15, 28, 'w'); C.l(7, 15, 9, 19, 'l', 2); strip(C, 11, 15, 27, 15, 1, 'h'); C.p([[27, 14], [30, 15], [27, 17]], 'a'); C.p([[11, 13], [9, 15], [11, 17]], 'c'); };
  D.crossbow = C => { strip(C, 4, 21, 24, 21, 4, 'h'); strip(C, 21, 8, 21, 28, 2.4, 'h'); C.l(21, 8, 6, 20, 'w'); C.l(21, 28, 6, 22, 'w'); C.l(8, 21, 28, 21, 'b'); C.p([[27, 19], [31, 21], [27, 23]], 'a'); C.d(8, 19, 't'); };
  D.shield = C => { C.e(16, 16, 13, 13, 'a'); C.e(16, 16, 10, 10, 'b'); C.e(16, 16, 8.5, 8.5, 'a'); C.l(16, 8, 16, 24, 'c'); C.l(8, 16, 24, 16, 'c'); C.e(16, 16, 3.2, 3.2, 't'); C.d(16, 16, 'g'); };
  D.kiteshield = C => { C.p([[5, 4], [27, 4], [27, 15], [16, 30], [5, 15]], 'a'); C.p([[8, 7], [24, 7], [24, 15], [16, 26], [8, 15]], 'b'); C.l(16, 7, 16, 26, 'c'); C.l(8, 14, 24, 14, 'c'); C.e(16, 14, 3, 3, 't'); C.d(16, 14, 'g'); };
  // ---------- armour ----------
  D.helmet = C => { C.p([[7, 7], [16, 3], [25, 7], [26, 17], [24, 27], [19, 29], [13, 29], [8, 27], [6, 17]], 'a'); C.p([[7, 17], [25, 17], [24, 21], [8, 21]], 'k'); C.r(8, 18, 16, 2, 'g'); C.l(16, 3, 16, 17, 'c'); C.l(16, 21, 16, 29, 'b'); [[11, 24], [21, 24], [13, 26], [19, 26]].forEach(([x, y]) => C.d(x, y, 'k')); C.d(8, 8, 't'); C.d(24, 8, 't'); };
  D.crown = C => { C.p([[4, 24], [4, 11], [10, 17], [16, 7], [22, 17], [28, 11], [28, 24]], 't'); C.r(4, 21, 24, 4, 'a'); C.e(16, 14, 2, 2, 'g'); C.e(8, 19, 1.4, 1.4, 'g'); C.e(24, 19, 1.4, 1.4, 'g'); C.d(4, 10, 'w'); C.d(16, 6, 'w'); C.d(28, 10, 'w'); };
  D.chest = C => { C.p([[4, 8], [11, 5], [14, 9], [18, 9], [21, 5], [28, 8], [29, 16], [25, 17], [24, 28], [8, 28], [7, 17], [3, 16]], 'a'); C.p([[13, 5], [19, 5], [18, 10], [14, 10]], 'k'); C.l(16, 10, 16, 28, 'c'); C.l(8, 20, 24, 20, 'b'); C.l(8, 24, 24, 24, 'b'); C.e(4.5, 11, 3, 3, 'b'); C.e(27.5, 11, 3, 3, 'b'); C.d(16, 14, 'g'); C.d(16, 20, 't'); };
  D.leather = C => { C.p([[5, 9], [12, 5], [14, 9], [18, 9], [20, 5], [27, 9], [28, 16], [24, 17], [23, 28], [9, 28], [8, 17], [4, 16]], 'a'); C.p([[13, 5], [19, 5], [18, 10], [14, 10]], 'k'); for (let y = 12; y < 27; y += 3) { C.d(14, y, 'h'); C.d(18, y, 'h'); } C.l(9, 22, 23, 22, 'h'); C.d(16, 22, 't'); C.d(9, 12, 'c'); C.d(23, 12, 'c'); };
  D.robe = C => { C.p([[9, 4], [23, 4], [27, 12], [29, 29], [3, 29], [5, 12]], 'a'); C.p([[13, 4], [19, 4], [16, 12]], 'k'); C.l(16, 12, 16, 29, 'b'); C.r(4, 26, 24, 3, 't'); C.l(10, 17, 22, 17, 'h', 2); C.d(16, 17, 'g'); C.l(6, 14, 4, 26, 'b'); C.l(26, 14, 28, 26, 'b'); };
  D.gauntlet = C => { C.p([[9, 29], [9, 21], [6, 14], [8, 12], [11, 15], [12, 6], [15, 6], [15, 13], [17, 4], [20, 4], [19, 13], [22, 6], [25, 7], [22, 16], [26, 14], [27, 17], [23, 24], [22, 29]], 'a'); C.r(8, 24, 15, 5, 'b'); C.l(11, 24, 21, 24, 'c'); C.d(12, 16, 'b'); C.d(16, 16, 'b'); C.d(20, 16, 'b'); C.e(15, 21, 1.6, 1.6, 'g'); };
  D.boots = C => { C.p([[6, 5], [14, 5], [14, 20], [24, 22], [28, 26], [28, 29], [5, 29], [5, 20]], 'a'); C.r(5, 6, 10, 3, 'b'); C.l(6, 27, 28, 27, 'k'); C.l(6, 14, 14, 14, 'b'); C.d(10, 17, 't'); C.d(10, 20, 't'); C.l(16, 24, 24, 24, 'c'); C.d(9, 7, 'c'); };
  D.cloak = C => { C.p([[8, 3], [24, 3], [28, 14], [30, 29], [16, 26], [2, 29], [4, 14]], 'a'); C.p([[10, 3], [22, 3], [16, 9]], 'b'); C.l(16, 9, 16, 26, 'b'); C.l(9, 12, 7, 27, 'b'); C.l(23, 12, 25, 27, 'b'); C.e(16, 8, 2, 2, 't'); C.d(16, 8, 'g'); };
  // ---------- jewellery ----------
  D.ring = C => { C.e(16, 20, 9, 9, 't'); C.e(16, 20, 6, 6, 'x'); C.e(16, 20, 8, 8, 't'); C.e(16, 20, 5.5, 5.5, 'x'); C.p([[11, 8], [21, 8], [24, 13], [16, 17], [8, 13]], 'g'); C.l(11, 8, 21, 8, 'w'); C.d(13, 11, 'w'); };
  D.amulet = C => { C.l(8, 3, 11, 12, 'a', 1, true); C.l(11, 12, 15, 17, 'a', 1, true); C.p([[16, 15], [22, 20], [22, 27], [16, 30], [10, 27], [10, 20]], 't'); C.p([[16, 18], [20, 21], [20, 26], [16, 28], [12, 26], [12, 21]], 'g'); C.d(14, 21, 'w'); C.d(15, 21, 'w'); };
  // ---------- consumables ----------
  D.potion = C => { C.e(16, 21, 9, 9, 'a'); C.r(13, 7, 6, 8, 'a'); C.e(16, 21, 7, 7, 'g'); C.r(13, 8, 6, 6, 'g'); C.r(13, 4, 6, 4, 'h'); C.r(12, 7, 8, 1, 'w'); C.e(13, 18, 2, 3, 'w'); C.d(19, 25, 'w'); C.d(18, 24, 'w'); C.r(11, 14, 10, 1, 'b'); };
  D.scroll = C => { C.p([[8, 6], [24, 6], [24, 26], [8, 26]], 'w'); C.r(5, 3, 22, 5, 'h'); C.r(5, 25, 22, 5, 'h'); C.e(5, 5.5, 2.5, 3, 'a'); C.e(27, 5.5, 2.5, 3, 'a'); C.e(5, 27.5, 2.5, 3, 'a'); C.e(27, 27.5, 2.5, 3, 'a'); [10, 13, 16, 19, 22].forEach((y, i) => C.l(10, y, i % 2 ? 20 : 22, y, 'k')); C.e(21, 22, 2, 2, 'g'); };
  D.book = C => { C.p([[5, 4], [25, 4], [27, 6], [27, 27], [5, 27]], 'a'); C.r(5, 4, 3, 24, 'b'); C.r(26, 6, 2, 20, 'w'); C.r(11, 9, 12, 12, 't'); C.e(17, 15, 3, 3, 'g'); C.l(11, 24, 23, 24, 't'); C.r(24, 14, 4, 4, 't'); };

  // ---------- classification ----------
  const ICON_BASE = { sword: 'sword', dagger: 'dagger', mace: 'mace', staff: 'staff', potion: 'potion', scroll: 'scroll', armor: 'chest', robe: 'robe', bow: 'bow', axe: 'axe', shield: 'shield', helm: 'helmet', gloves: 'gauntlet', boots: 'boots', cloak: 'cloak', ring: 'ring', amulet: 'amulet', wand: 'wand', book: 'book' };
  function baseKind(item) {
    const n = String(item.name || '').toLowerCase(), t = item.type, sub = item.subcategory || '';
    const has = re => re.test(n);
    // armour words first so "Ring Mail" is not a ring and "Hammer Shield" is not a hammer
    if (has(/ring mail|chain ?mail|\bmail\b|breastplate|cuirass|plate armor|plate armour|\bplate\b|half plate|splint|hauberk|brigandine|scale mail|\barmou?r\b/) && !has(/helm|gauntlet|glove|boots|shield/)) return has(/leather|hide|studded|padded|gambeson|tunic|vest/) ? 'leather' : 'chest';
    if (has(/leather|studded|padded|hide armor|gambeson|jerkin/) && t !== 'weapon' && !has(/boots|gloves|helm|cap|belt|cloak|shield/)) return 'leather';
    if (has(/shield|buckler|aegis|\bwall\b/)) return has(/tower|kite|heater|large|great/) ? 'kiteshield' : 'shield';
    if (has(/crown|circlet|diadem|tiara|coronet|\bhat\b/)) return 'crown';
    if (has(/helm|helmet|\bcap\b|hood|visor|coif|casque|barbute/)) return 'helmet';
    if (has(/gauntlet|\bglove|bracer|gloves|handwrap|mitts?\b|\bfist/)) return 'gauntlet';
    if (has(/boots?\b|greaves|sandals|slippers|shoes|\bsabatons?\b/)) return 'boots';
    if (has(/cloak|cape|mantle|shawl|\bshroud\b/)) return 'cloak';
    if (has(/\brobes?\b|vestment|habit|\bgown\b/)) return 'robe';
    if (has(/\brings?\b/) && !has(/ring mail/)) return 'ring';
    if (has(/amulet|necklace|pendant|periapt|\btorc\b|gorget|medallion|talisman|locket|brooch|choker|\bscarab\b|\bcollar\b/)) return 'amulet';
    if (has(/potion|elixir|philter|draught|tonic|\bvial\b|\boil of|\bantidote|\bbrew\b|\btincture/)) return 'potion';
    if (has(/scroll|parchment/)) return 'scroll';
    if (has(/\btome\b|\bbook\b|grimoire|codex|\bmanual\b|journal|\bspellbook\b/)) return 'book';
    // weapons
    if (has(/greatsword|claymore|zweihander|great sword|executioner/)) return 'greatsword';
    if (has(/dagger|knife|dirk|stiletto|\bkris\b|shiv|kukri|\bkunai\b|\bshuriken\b|\bdart\b/)) return 'dagger';
    if (has(/great ?axe|battle ?axe|double axe|war ?axe/)) return 'greataxe';
    if (has(/axe\b|hatchet|tomahawk|cleaver/)) return 'axe';
    if (has(/war ?hammer|maul|\bhammer\b|mallet|gavel/)) return 'hammer';
    if (has(/morning ?star|\bmace\b|scepter|sceptre/)) return 'mace';
    if (has(/flail|whip|chain/)) return 'flail';
    if (has(/\bclub\b|cudgel|bludgeon|\bcosh\b|baton|truncheon/)) return 'club';
    if (has(/halberd|glaive|poleaxe|pole axe|\bpike\b|guisarme|\bbill\b|voulge|naginata|\blance\b/)) return 'polearm';
    if (has(/trident/)) return 'trident';
    if (has(/spear|javelin|\bpilum\b/)) return 'spear';
    if (has(/crossbow|arbalest|\bbolt\b/)) return 'crossbow';
    if (has(/\bbow\b|longbow|shortbow|\bsling\b/)) return 'bow';
    if (has(/\bwand\b|\brod\b|\bbaton\b/)) return 'wand';
    if (has(/staff|quarterstaff|\bcane\b|\bcrook\b/)) return 'staff';
    if (has(/sword|blade|scimitar|sabre|saber|rapier|cutlass|katana|falchion|\bfoil\b|longsword|shortsword|\bedge\b|brand|tongue/)) return 'sword';
    if (t === 'weapon') {
      // a poetically named weapon ("Moonblade", "Dawnbreaker"): look for the weapon noun in its description
      const d = `${item.desc || ''} ${String(item.effect || '').replace(/<[^>]+>/g, ' ')}`.toLowerCase();
      const W = [['greatsword', /greatsword|claymore/], ['dagger', /dagger|knife|dirk/], ['greataxe', /great ?axe|battle ?axe/], ['axe', /axe\b|hatchet/], ['hammer', /warhammer|hammer|maul/], ['mace', /\bmace\b|morningstar/], ['flail', /flail|whip/],
        ['club', /\bclub\b|cudgel/], ['polearm', /halberd|glaive|\bpike\b|\blance\b/], ['trident', /trident/], ['spear', /spear|javelin/], ['crossbow', /crossbow/], ['bow', /\bbow\b|longbow|shortbow/], ['wand', /\bwand\b|\brod\b/], ['staff', /\bstaff\b|quarterstaff/], ['sword', /sword|blade|scimitar|rapier|saber|sabre/]];
      const hit = W.find(([, re]) => re.test(d));
      return hit ? hit[0] : 'sword';
    }
    if (t === 'armor') return sub === 'shield' ? 'shield' : 'chest';
    if (item.icon && ICON_BASE[item.icon]) return ICON_BASE[item.icon];
    if (t === 'consumable' && /potion/.test(sub)) return 'potion';
    return null;
  }

  // ---------- materials ----------
  const MAT = {
    steel: { a: '#a9b3bf', b: '#5b6571', c: '#e8eef5', t: '#c9a84c' }, adamantine: { a: '#3d4b69', b: '#1a2236', c: '#86abea', t: '#5f86c9' },
    mithral: { a: '#cfe4f2', b: '#7d9ab2', c: '#ffffff', t: '#e8f3ff' }, silver: { a: '#d0d7de', b: '#8791a0', c: '#ffffff', t: '#e6ebf0' },
    gold: { a: '#e8c04a', b: '#946f17', c: '#fff1a8', t: '#fff1a8' }, bronze: { a: '#b8793c', b: '#6b3f17', c: '#e4a96d', t: '#d8a24a' },
    copper: { a: '#c4703f', b: '#6e3418', c: '#eaa070', t: '#e0b070' }, obsidian: { a: '#2e2d3f', b: '#0f0f19', c: '#7a78a3', t: '#7a78a3' },
    bone: { a: '#e6dcc0', b: '#a69b7b', c: '#fffbe9', t: '#c8bda0' }, crystal: { a: '#9fe3f2', b: '#4a9db6', c: '#ffffff', t: '#dff8ff' },
    wood: { a: '#8a5a35', b: '#4d2f17', c: '#b88458', t: '#c9a84c' }, leather: { a: '#8c5a33', b: '#4f301a', c: '#bb8656', t: '#c9a84c' },
    cloth: { a: '#5b4aa0', b: '#2c2358', c: '#9b8ae0', t: '#e0c060' }, scale: { a: '#4f9a5a', b: '#23552d', c: '#8fd49a', t: '#c9a84c' },
    ruby: { a: '#c23a3a', b: '#6e1414', c: '#f08080', t: '#e8c04a' }, jade: { a: '#2f9c72', b: '#14543c', c: '#7fdcb0', t: '#e8c04a' },
    iron: { a: '#7b838f', b: '#3f454e', c: '#b5bdc8', t: '#a98a3c' }, rusty: { a: '#8a5a42', b: '#4a2a1c', c: '#b98462', t: '#7a6a3a' },
  };
  function material(item, base) {
    const n = String(item.name || '').toLowerCase();
    const re = [['adamantine', /adamant/], ['mithral', /mithr|mithil/], ['silver', /silver/], ['gold', /\bgold|golden|aurum/], ['bronze', /bronze/], ['copper', /copper/], ['obsidian', /obsidian|voidsteel|void steel|black iron|nightsteel|umbra|shadowsteel/],
      ['bone', /\bbone|dragonbone|tusk|ivory|\bfang|antler|horn/], ['crystal', /crystal|glass|diamond|quartz|frozen|\bice\b|glacial/], ['ruby', /ruby|crimson|blood|garnet|infernal/], ['jade', /jade|emerald|verdant|viridian/],
      ['scale', /dragon ?scale|scale|dragonhide|drake|lizard/], ['rusty', /rusty|rusted|corroded/], ['iron', /\biron\b|dwarven|ferrous/], ['steel', /steel|tempered|\bmetal\b/]].find(([, r]) => r.test(n));
    if (re) return re[0];
    const wooden = ['staff', 'wand', 'bow', 'crossbow', 'club'].includes(base);
    if (wooden) return 'wood';
    if (['leather', 'boots', 'cloak', 'gauntlet'].includes(base)) return 'leather';
    if (['robe', 'book', 'scroll', 'potion'].includes(base)) return base === 'robe' ? 'cloth' : base === 'scroll' ? 'bone' : base === 'potion' ? 'crystal' : 'leather';
    if (['crown', 'ring', 'amulet'].includes(base)) return 'gold';
    return 'steel';
  }

  // ---------- effects ----------
  const FX = [
    ['fire', /flam|fire|ember|blaze|inferno|infern|burn|magma|molten|scorch|\bsun\b|phoenix|pyre|ignit|cinder|dragon/, '#ff8a2a'],
    ['frost', /frost|\bice\b|icy|\bcold\b|winter|snow|glacier|freez|rime|chill|\bhoar/, '#8fe3ff'],
    ['storm', /lightning|thunder|storm|shock|spark|tempest|volt|\bbolt\b|electric/, '#ffe45a'],
    ['poison', /poison|venom|toxic|acid|viper|plague|\brot\b|serpent|spider|\bwyrm\b/, '#9be25a'],
    ['holy', /holy|radiant|divine|celestial|angel|sacred|blessed|dawn|\blight\b|solar|sunbeam|paladin|righteous|justice|seraph/, '#fff0a0'],
    ['shadow', /shadow|\bdark|night|umbra|\bvoid\b|vampir|necro|death|grim|soul|wraith|ghost|spectral|\bcurse|hollow|tomb|\bbane\b/, '#9a6bdc'],
    ['blood', /\bblood|vicious|gore|sanguine|\bwound|\bbleed|carnage|slaughter|savage/, '#d93a3a'],
    ['arcane', /arcane|\brune|runic|magic|spell|mystic|astral|psychic|mage|wizard|enchant|sorcer|eldritch|\barcana|\bmana\b|force/, '#c58cff'],
    ['nature', /thorn|\bleaf|nature|verdant|druid|forest|\bwild|\bvine|\bbark|\bmoss|\bgrove|\bwood(?:land)?\b|\bpetal/, '#7ed67e'],
    ['wind', /\bwind|gale|\bair\b|zephyr|\bswift|cloud|\bsky\b|feather/, '#d2f0ff'],
  ];
  const RAR = { common: 0, uncommon: 1, rare: 2, superrare: 3, legendary: 4, celestial: 5 };
  function effects(item, rarity) {
    const text = `${item.name || ''} ${(item.desc || '').slice(0, 160)} ${(item.effect || '').replace(/<[^>]+>/g, ' ').slice(0, 220)}`.toLowerCase();
    const nameOnly = String(item.name || '').toLowerCase();
    const found = [];
    FX.forEach(([id, re, color]) => { const inName = re.test(nameOnly), inText = re.test(text); if (inName || inText) found.push({ id, color, score: (inName ? 2 : 0) + (inText ? 1 : 0) }); });
    found.sort((x, y) => y.score - x.score);
    const tier = RAR[rarity || item.rarity] ?? 0;
    const list = found.slice(0, 2);
    if (!list.length && (tier >= 1 || /\+\d|magic|enchant/.test(text))) list.push({ id: 'magic', color: ['#9fd0ff', '#9fd0ff', '#b79aff', '#c58cff', '#ffd75e', '#fff2b0'][tier] || '#9fd0ff', score: 0 });
    return { list, tier };
  }
  const seeded = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; };

  // ---------- render ----------
  const FIXED = { w: '#efe6d0', k: '#0e0b09', h: '#7a4a26', l: '#4f301a', r: '#b02a2a', x: null };
  function render(item, rarity) {
    const base = baseKind(item); if (!base) return null;
    const matId = material(item, base), mat = MAT[matId] || MAT.steel, fx = effects(item, rarity);
    const C = Canvas(); (D[base])(C);
    const hueH = (() => { let h = 0; for (const ch of String(item.name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; })();
    const potionTint = ['#d93a3a', '#3a7fd9', '#3fae5a', '#b04fd9', '#e8943a', '#37c2c2'][hueH % 6];
    const accent = fx.list.length ? fx.list[0].color : base === 'potion' ? potionTint : ({ common: '#c9a84c', uncommon: '#4caf7d', rare: '#5b9cf6', superrare: '#c47cf5', legendary: '#e8963a', celestial: '#fff2b0' }[rarity] || '#c9a84c');
    const colorOf = r => r === 'a' ? mat.a : r === 'b' ? mat.b : r === 'c' ? mat.c : r === 't' ? mat.t : r === 'g' ? accent : FIXED[r] || mat.a;
    const NO = new Set(['k', 'g', 'x']);
    const at = (x, y) => (x >= 0 && y >= 0 && x < N && y < N ? C.g[y][x] : null);
    const cells = []; // {x,y,color,opacity}
    const blend = fx.list.some(f => ['fire', 'frost', 'storm', 'poison', 'holy', 'shadow', 'blood', 'arcane'].includes(f.id)) ? 0.16 : 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const r = C.g[y][x]; if (!r) continue;
      let col = colorOf(r);
      if (blend && (r === 'a' || r === 'c')) col = mix(col, accent, blend);
      if (!NO.has(r)) {
        const up = at(x, y - 1), lf = at(x - 1, y), dn = at(x, y + 1), rt = at(x + 1, y);
        const lit = up !== r || lf !== r, dark = dn !== r || rt !== r;
        if (lit && !dark) col = mix(col, '#ffffff', 0.3); else if (dark && !lit) col = mix(col, '#000000', 0.34); else if (lit && dark) col = mix(col, '#000000', 0.08);
      }
      cells.push({ x, y, c: col });
    }
    // distance field for glow + outline
    const dist = Array.from({ length: N }, () => Array(N).fill(9));
    let q = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (C.g[y][x]) { dist[y][x] = 0; q.push([x, y]); }
    for (let d = 1; d <= 4; d++) { const nq = []; q.forEach(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < N && ny < N && dist[ny][nx] > d) { dist[ny][nx] = d; nq.push([nx, ny]); } })); q = nq; }
    const under = []; // glow behind the item
    const glowStrength = fx.list.length ? Math.min(3, 1 + Math.floor(fx.tier / 2)) : (fx.tier >= 4 ? 2 : 0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = dist[y][x]; if (d >= 2 && d <= 1 + glowStrength) under.push({ x, y, c: accent, o: d === 2 ? 0.34 : d === 3 ? 0.2 : 0.1 }); }
    const outline = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (dist[y][x] === 1) outline.push({ x, y, c: '#0d0a08' });
    // particles
    const rnd = seeded((item.name || '') + base), spots = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (dist[y][x] >= 2 && dist[y][x] <= 4) spots.push([x, y]);
    const part = [];
    const take = () => spots.length ? spots.splice(Math.floor(rnd() * spots.length), 1)[0] : null;
    const count = Math.min(9, 2 + fx.tier * 1.4) | 0;
    (fx.list.length ? fx.list : []).forEach((f, fi) => {
      const n = Math.max(2, Math.round(count / (fi + 1)));
      for (let i = 0; i < n; i++) {
        const s = take(); if (!s) break; const [x, y] = s, col = f.color;
        if (f.id === 'fire') { part.push({ x, y, c: '#ffd34d' }); if (y > 1) part.push({ x, y: y - 1, c: '#ff8a2a' }); if (y > 2 && rnd() > 0.5) part.push({ x, y: y - 2, c: '#d93a1a' }); }
        else if (f.id === 'frost') { part.push({ x, y, c: '#ffffff' }); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { if (dist[y + dy] && dist[y + dy][x + dx] > 1) part.push({ x: x + dx, y: y + dy, c: '#8fe3ff' }); }); }
        else if (f.id === 'storm') { part.push({ x, y, c: '#fff6a8' }); part.push({ x: x + 1, y: y + 1, c: '#ffe45a' }); part.push({ x, y: y + 2, c: '#ffe45a' }); part.push({ x: x + 1, y: y + 3, c: '#fff6a8' }); }
        else if (f.id === 'poison') { part.push({ x, y, c: '#9be25a' }); part.push({ x, y: y + 1, c: '#6fb83a' }); if (rnd() > 0.5) part.push({ x, y: y + 2, c: '#9be25a' }); }
        else if (f.id === 'holy') { part.push({ x, y, c: '#ffffff' }); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => part.push({ x: x + dx, y: y + dy, c: '#ffe27a' })); }
        else if (f.id === 'shadow') { part.push({ x, y, c: '#6a3fb0' }); part.push({ x: x + 1, y: y - 1, c: '#3d2270' }); part.push({ x: x - 1, y: y - 1, c: '#9a6bdc' }); }
        else if (f.id === 'blood') { part.push({ x, y, c: '#d93a3a' }); part.push({ x, y: y + 1, c: '#8e1c1c' }); }
        else if (f.id === 'arcane') { part.push({ x, y, c: '#ffffff' }); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => part.push({ x: x + dx, y: y + dy, c: '#c58cff' })); }
        else if (f.id === 'nature') { part.push({ x, y, c: '#7ed67e' }); part.push({ x: x + 1, y, c: '#3f9a4a' }); part.push({ x, y: y + 1, c: '#3f9a4a' }); }
        else if (f.id === 'wind') { part.push({ x, y, c: '#ffffff' }); part.push({ x: x + 1, y, c: '#d2f0ff' }); part.push({ x: x + 2, y: y + 1, c: '#d2f0ff' }); }
        else { part.push({ x, y, c: '#ffffff' }); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => part.push({ x: x + dx, y: y + dy, c: col })); }
      }
    });
    const kept = part.filter(p => p.x >= 0 && p.y >= 0 && p.x < N && p.y < N && !C.g[p.y][p.x]);
    return { base, matId, fx: fx.list.map(f => f.id), under, outline, cells, kept, accent };
  }
  const rectsOf = (arr, opacity) => {
    const rows = {}; arr.forEach(c => { (rows[c.y] = rows[c.y] || []).push(c); });
    let out = '';
    Object.keys(rows).forEach(y => { const row = rows[y].sort((a, b) => a.x - b.x); let i = 0; while (i < row.length) { let j = i + 1; while (j < row.length && row[j].x === row[j - 1].x + 1 && row[j].c === row[i].c && (row[j].o || 0) === (row[i].o || 0)) j++; const o = row[i].o; out += `<rect x="${row[i].x}" y="${y}" width="${j - i}" height="1" fill="${row[i].c}"${o != null ? ` fill-opacity="${o}"` : ''}/>`; i = j; } });
    return out;
  };
  window.itemArtSpec = function (item, rarity) { const r = render(item, rarity); return r ? { base: r.base, material: r.matId, effects: r.fx } : null; };
  // Returns the inner SVG markup for a 32x32 viewBox (or null if the item has no art here).
  const cache = new Map();
  window.itemArtInner = function (item, rarity) {
    item = item || {};
    const key = `${item.name}|${item.type}|${item.subcategory || ''}|${rarity || item.rarity || ''}|${(item.desc || '').slice(0, 60)}|${String(item.effect || '').slice(0, 80)}`;
    if (cache.has(key)) return cache.get(key);
    const r = render(item, rarity);
    const out = r ? rectsOf(r.under) + rectsOf(r.outline) + rectsOf(r.cells) + rectsOf(r.kept) : null;
    if (cache.size > 3000) cache.clear();
    cache.set(key, out);
    return out;
  };
  window.itemArtSvg = function (item, px, rarity) {
    const inner = window.itemArtInner(item, rarity); if (!inner) return null;
    return `<svg class="pixel-svg item-pixel-icon item-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${px}" height="${px}" shape-rendering="crispEdges" style="image-rendering:pixelated;flex-shrink:0;">${inner}</svg>`;
  };
  window.ITEM_ART_BASES = Object.keys(D);
})();
