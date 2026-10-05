// Weapon sprites for item-art.js. Each is drawn in a local frame (u = along the weapon from the handle end,
// v = sideways, +v = down/right) on the 32x32 pixel canvas. Roles: a blade/head metal, b dark metal,
// c edge highlight, f fuller / emissive channel, t trim (guards, caps), h grip/haft wood or leather,
// l dark leather wrap, g gem, w white, k black, r red.
(function () {
  const K = window.ItemKit; if (!K) return;
  const S = window.ItemArtSprites, bez = K.bezier;
  // Frame centred on the canvas for an object of length L along the up-right diagonal.
  const fr = (C, L, dx, dy) => K.frame(C, 16 - 0.3535 * L + (dx || 0), 16 + 0.3535 * L + (dy || 0), -45);
  const wrap = (F, u0, u1, w) => { for (let u = u0 + 0.6; u < u1; u += 1.7) F.line(u, -w, u, w, 'l'); };
  const ball = (F, u, r, role) => F.ell(u, 0, r, r, role || 't');
  // Three-tone blade from a half-width profile [[u, w], ...] ending in a point at tipU, plus a fuller.
  const blade = (F, prof, tipU, fuller) => {
    const band = (f0, f1) => [...prof.map(([u, w]) => [u, f0 * w]), [tipU, 0], ...prof.slice().reverse().map(([u, w]) => [u, f1 * w])];
    F.poly(band(-1, 1), 'a'); F.poly(band(-1, -0.28), 'c'); F.poly(band(0.38, 1), 'b');
    if (fuller !== false) { const u0 = prof[0][0] + 1.4, u1 = tipU - (fuller || 5); if (u1 > u0) F.line(u0, 0.05, u1, 0.05, 'f'); }
  };
  const straight = (u0, u1, w) => [[u0, w], [u1, w]];
  // Three-tone curved blade along a Bezier centre line.
  const curved = (F, pts, widths, fullerN) => {
    F.poly(K.bandPoly(pts, widths, -1, 1), 'a'); F.poly(K.bandPoly(pts, widths, -1, -0.28), 'c'); F.poly(K.bandPoly(pts, widths, 0.4, 1), 'b');
    if (fullerN !== 0) F.poly(K.bandPoly(pts.slice(1, pts.length - (fullerN || 3)), 0.55, -1, 1), 'f');
  };
  const star = (F, u, v, rIn, rOut, n, role, rot) => { const pts = []; for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2 + (rot || 0), r = i % 2 ? rIn : rOut; pts.push([u + r * Math.cos(a), v + r * Math.sin(a)]); } F.poly(pts, role); };
  const guard = (F, u, half, role, tips) => { F.rect(u, u + 1.6, -half, half, role || 't'); if (tips) { F.tri(u, -half, u + 1.6, -half, u + 3.2, -half - 1.4, role || 't'); F.tri(u, half, u + 1.6, half, u + 3.2, half + 1.4, role || 't'); } };
  const grip = (F, u0, u1, w) => { F.rect(u0, u1, -w, w, 'h'); wrap(F, u0, u1, w); };

  // ---------------- swords ----------------
  S.longsword = C => { const F = fr(C, 40); ball(F, 0.8, 1.9); grip(F, 1.8, 9, 1.1); guard(F, 9, 5.4, 't', true); blade(F, straight(10.6, 35, 2.1), 40.5); };
  S.sword = C => { const F = fr(C, 34); F.ell(0.8, 0, 1.6, 1.6, 't'); F.ell(0.8, 0, 0.8, 0.8, 'b'); grip(F, 1.8, 7.5, 1.1); F.rect(7.5, 9, -4.4, 4.4, 't'); F.ell(7.7, -4.4, 1, 1, 't'); F.ell(7.7, 4.4, 1, 1, 't'); blade(F, straight(9, 29, 2.3), 34.5, 4); };
  S.shortsword = C => { const F = fr(C, 30); ball(F, 0.8, 1.6); grip(F, 1.8, 6.5, 1.1); F.rect(6.5, 7.8, -3.6, 3.6, 't'); blade(F, [[7.8, 1.6], [11, 2.5], [17, 3.3], [22, 2.9]], 30.5, 5); };
  S.greatsword = C => { const F = fr(C, 44, 0.4, 0); ball(F, 0.8, 2.1); grip(F, 2, 11.5, 1.3); F.rect(11.5, 13.3, -7, 7, 't'); F.tri(11.5, -7, 13.3, -7, 15.6, -9, 't'); F.tri(11.5, 7, 13.3, 7, 15.6, 9, 't'); F.ell(12.4, 0, 1.4, 2, 'g');
    F.rect(13.3, 17, -2.8, 2.8, 'b'); blade(F, straight(17, 38, 3.7), 44, 6); F.line(18, -1.2, 37, -1.2, 'f'); };
  S.scimitar = C => { const F = fr(C, 38); const p = bez([9, 0], [22, -9], [37, -5], 16), w = p.map((_, i) => { const t = i / 16; return 0.4 + 3.1 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.25); });
    ball(F, 0.8, 1.7); grip(F, 1.8, 7.5, 1.1); F.ell(8.4, 0, 1, 3.6, 't'); curved(F, p, w, 4); };
  S.rapier = C => { const F = fr(C, 42); ball(F, 0.8, 1.5); F.rect(1.6, 8.2, -0.9, 0.9, 'h'); wrap(F, 1.6, 8.2, 0.9);
    K.stroke(C, bez(F.P(8.8, -5), F.P(3, -6.5), F.P(1, -1.2), 8), 't', 1); K.stroke(C, bez(F.P(8.8, 5), F.P(3, 6.5), F.P(1, 1.2), 8), 't', 1);
    F.ell(10, 0, 1.4, 4.4, 't'); F.ell(10, 0, 0.7, 2.6, 'b'); F.line(8.8, -5, 8.8, 5, 't'); blade(F, straight(11, 38, 1.3), 42, 4); };
  S.sabre = C => { const F = fr(C, 38); const p = bez([8.6, 0], [22, -2], [37, -6.5], 14), w = p.map((_, i) => 2.2 - i * 0.12);
    ball(F, 0.8, 1.6); grip(F, 1.8, 7.6, 1.1); K.stroke(C, bez(F.P(8, 2.6), F.P(3, 6.5), F.P(0.8, 1.4), 8), 't', 1); F.rect(7.6, 8.8, -3.4, 3.4, 't'); curved(F, p, w, 3); };
  S.falchion = C => { const F = fr(C, 36); ball(F, 0.8, 1.7); grip(F, 1.8, 7, 1.2); F.rect(7, 8.4, -3.6, 3.6, 't');
    blade(F, [[8.4, 2.1], [22, 2.5], [29, 3.5], [33, 3.4]], 36.5, 4); };
  S.wandblade = C => { const F = fr(C, 38); F.ell(1.4, 0, 2.2, 2.2, 'g'); grip(F, 3.4, 9, 1); F.ell(9.6, 0, 1, 3.4, 't'); const p = bez([10.5, 0], [24, -1.5], [38, 3.5], 14); curved(F, p, p.map((_, i) => 1.9 - i * 0.12), 3); };
  // ---------------- daggers & knives ----------------
  S.dagger = C => { const F = fr(C, 26); ball(F, 0.8, 1.5); grip(F, 1.6, 6.2, 1.1); F.rect(6.2, 7.6, -3.4, 3.4, 't'); blade(F, straight(7.6, 20, 1.9), 26, 4); };
  S.knife = C => { const F = fr(C, 24); F.poly([[0, -1.7], [8, -1.7], [8, 1.7], [0, 1.7]], 'h'); F.line(2, -1.5, 2, 1.5, 'l'); F.line(5, -1.5, 5, 1.5, 'l'); F.rect(8, 9.2, -2, 2, 't');
    const prof = [[9.2, 2.2], [19, 2.2]]; const band = (f0, f1) => [[9.2, f0 * 2.2], [19, f0 * 2.2], [24, 0], [19, f1 * 2.2], [9.2, f1 * 2.2]];
    F.poly(band(-1, 1), 'a'); F.poly(band(-1, -0.3), 'c'); F.poly(band(0.4, 1), 'b'); };
  S.stiletto = C => { const F = fr(C, 30); ball(F, 0.8, 1.3); grip(F, 1.6, 7, 0.9); F.ell(7.8, 0, 0.9, 2.6, 't'); blade(F, straight(8.4, 26, 1.2), 30, false); };
  S.kukri = C => { const F = fr(C, 28); F.rect(0, 7, -1.5, 1.5, 'h'); F.line(2, -1.3, 2, 1.3, 'l'); F.line(4.5, -1.3, 4.5, 1.3, 'l'); F.ell(0.4, 0, 1.2, 1.8, 't'); F.rect(7, 8.4, -2.1, 2.1, 't');
    const p = bez([8.4, 0], [16, 5.2], [28, -1.2], 12), w = p.map((_, i) => { const t = i / 12; return 1.2 + 2.6 * Math.sin(Math.PI * Math.min(1, t * 1.1)) * (1 - t * 0.3); }); curved(F, p, w, 3); };
  S.stake = C => { const F = fr(C, 36); F.poly([[0, -2], [26, -1.5], [36, 0], [26, 1.5], [0, 2]], 'h'); F.line(2, -0.8, 24, -0.5, 'l'); F.line(3, 0.9, 22, 0.6, 'l'); F.poly([[27, -1.2], [36, 0], [27, 1.2]], 'c'); };
  S.sickle = C => { const F = fr(C, 34); ball(F, 0.8, 1.3); grip(F, 1.2, 12, 1.2); const p = K.arcPts(14, -9.5, 9.5, 9.5, 95, 5, 12); curved(F, p, p.map((_, i) => 0.7 + 1.9 * Math.sin(Math.PI * i / 12) + 0.4), 3); F.rect(11.2, 13, -1.6, 1.6, 't'); };
  // ---------------- axes ----------------
  const haft = (F, L, w, wrapTo) => { F.rect(0, L, -w, w, 'h'); wrap(F, 0, wrapTo || L - 8, w); };
  S.handaxe = C => { const F = fr(C, 32); haft(F, 28, 1, 14); ball(F, 0.8, 1.3);
    F.poly([[18, -1.4], [27, -1.4], [28, 1.4], [29.5, 7], [25, 9.2], [20, 7], [18, 1.4]], 'a'); F.poly([[19, 4], [25, 8.6], [28.6, 7.4], [28, 4]], 'c'); F.poly([[18, -1.4], [27, -1.4], [27, -3], [19, -3]], 'b'); F.line(21, 0, 24, 3.4, 'f'); F.rect(17, 19, -1.8, 1.8, 't'); };
  S.battleaxe = C => { const F = fr(C, 38); haft(F, 34, 1.1, 22); ball(F, 0.6, 1.5);
    F.poly([[22, -1.6], [31, -1.6], [33, 1.8], [35, 8], [30, 11], [24, 9], [22, 3]], 'a'); F.poly([[24, 8.4], [30, 10.4], [33.6, 7.6], [32.6, 3]], 'c'); F.poly([[22, -1.6], [31, -1.6], [29, -5.4], [24, -4.4]], 'b'); F.line(24.5, 1.2, 31, 5, 'f'); F.rect(21, 23, -2, 2, 't'); F.tri(31, -1.6, 31, 1.6, 36.5, 0, 'a'); };
  S.greataxe = C => { const F = fr(C, 44); haft(F, 40, 1.2, 26); ball(F, 0.6, 1.8);
    F.rect(27, 33, -2.6, 2.6, 'b'); F.poly([[27, 2.6], [33, 2.6], [36, 7], [35, 10.6], [29, 10.6], [26, 5.6]], 'a'); F.poly([[27, -2.6], [33, -2.6], [36, -7], [35, -10.6], [29, -10.6], [26, -5.6]], 'a');
    F.poly([[29, 10.4], [35, 10.4], [36, 7.2], [34, 8.6]], 'c'); F.poly([[29, -10.4], [35, -10.4], [36, -7.2], [34, -8.6]], 'c'); F.line(29, 4, 33, 7.4, 'f'); F.line(29, -4, 33, -7.4, 'f'); F.rect(25.4, 27, -2.8, 2.8, 't'); F.tri(33, -2, 33, 2, 40.5, 0, 'a'); };
  S.berserkeraxe = C => { const F = fr(C, 44); haft(F, 40, 1.2, 26); ball(F, 0.6, 1.8);
    F.rect(27, 33, -2.6, 2.6, 'b'); F.poly([[27, 2.6], [33, 2.6], [36, 7], [34, 8.4], [36.4, 10], [31, 10.6], [29.4, 12], [27.6, 10], [26, 6]], 'a'); F.poly([[27, -2.6], [33, -2.6], [36, -7], [34, -8.4], [36.4, -10], [31, -10.6], [29.4, -12], [27.6, -10], [26, -6]], 'a');
    F.line(29, 4, 33, 7.2, 'f'); F.line(29, -4, 33, -7.2, 'f'); F.rect(25.4, 27, -2.8, 2.8, 't'); F.tri(33, -2, 33, 2, 40.5, 0, 'b'); };
  S.warpick = C => { const F = fr(C, 36); haft(F, 32, 1.1, 22); ball(F, 0.6, 1.5);
    F.rect(24, 29, -2, 2, 'b'); F.poly(K.stripPoly(bez([26, -1.5], [27, -7], [31, -11], 8), [2, 1.8, 1.6, 1.4, 1.2, 0.9, 0.6, 0.3, 0.1]), 'a'); F.poly([[24.5, 2], [29.5, 2], [30.5, 5.4], [24.5, 5.4]], 'a'); F.rect(24.5, 30.5, 4.2, 5.4, 'c'); F.line(26, -4, 29, -8, 'f'); F.rect(22, 24, -2.4, 2.4, 't'); };
  // ---------------- hammers, maces, flails ----------------
  S.warhammer = C => { const F = fr(C, 38); haft(F, 34, 1.1, 24); ball(F, 0.6, 1.5);
    F.poly([[27, -4.8], [35, -4.8], [35, 4.8], [27, 4.8]], 'a'); F.poly([[27, -4.8], [35, -4.8], [35, -3.2], [27, -3.2]], 'c'); F.poly([[27, 3.2], [35, 3.2], [35, 4.8], [27, 4.8]], 'b'); F.tri(35, -2, 35, 2, 41, 0, 'b'); F.rect(26, 27, -2.4, 2.4, 't'); F.line(29, 0, 34, 0, 'f'); };
  S.maul = C => { const F = fr(C, 42); haft(F, 40, 1.4, 30); ball(F, 0.6, 2);
    F.poly([[28, -6.8], [40, -6.8], [40, 6.8], [28, 6.8]], 'a'); F.rect(28, 29.4, -6.8, 6.8, 'b'); F.rect(38.6, 40, -6.8, 6.8, 'b'); F.poly([[29.4, -6.8], [38.6, -6.8], [38.6, -4.6], [29.4, -4.6]], 'c'); F.poly([[29.4, 4.8], [38.6, 4.8], [38.6, 6.8], [29.4, 6.8]], 'b'); F.line(31, 0, 37, 0, 'f'); F.rect(27, 28.4, -2.8, 2.8, 't'); };
  S.mace = C => { const F = fr(C, 36); haft(F, 27, 1.1, 24); ball(F, 0.6, 1.7);
    star(F, 29, 0, 3.4, 6, 6, 'a', 0.3); F.ell(29, 0, 3.2, 3.2, 'a'); F.ell(29.4, -0.6, 1.6, 1.4, 'c'); F.ell(28.4, 0.8, 1.2, 1.2, 'b'); F.rect(24.4, 26, -2, 2, 't'); };
  S.morningstar = C => { const F = fr(C, 38); haft(F, 28, 1.1, 24); ball(F, 0.6, 1.7);
    star(F, 31, 0, 4.2, 7.4, 8, 'a', 0.2); F.ell(31, 0, 4.2, 4.2, 'a'); F.ell(31.6, -1, 2, 1.8, 'c'); F.ell(30, 1.4, 1.6, 1.6, 'b'); F.rect(26, 27.6, -2, 2, 't'); };
  S.flail = C => { const F = fr(C, 40); haft(F, 12, 1.1, 12); ball(F, 0.6, 1.6); F.rect(12, 13.6, -1.9, 1.9, 't');
    for (let i = 0; i < 4; i++) F.ell(16 + i * 3.2, (i % 2 ? 0.9 : -0.9), 1.9, 1.3, i % 2 ? 'b' : 'a');
    star(F, 33, 0, 4, 6.8, 8, 'a', 0.2); F.ell(33, 0, 4, 4, 'a'); F.ell(33.6, -1, 1.8, 1.6, 'c'); F.ell(32, 1.4, 1.5, 1.5, 'b'); };
  S.whip = C => { const F = fr(C, 38); haft(F, 9, 1.2, 9); ball(F, 0.6, 1.5); F.rect(9, 10.4, -1.7, 1.7, 't');
    const p = [...bez([10, 0], [18, 9], [26, 3], 8), ...bez([26, 3], [34, -4], [34, 6], 8).slice(1)]; F.poly(K.stripPoly(p, p.map((_, i) => 1.25 - i * 0.045)), 'l'); F.poly(K.bandPoly(p.slice(0, 12), p.slice(0, 12).map((_, i) => 1.25 - i * 0.045), -1, -0.2), 'h'); };
  S.club = C => { const F = fr(C, 34); F.poly([[0, -1.3], [10, -1.5], [20, -2.7], [28, -4.4], [33, -3.8], [34, 0], [33, 3.8], [28, 4.4], [20, 2.7], [10, 1.5], [0, 1.3]], 'h');
    F.poly([[10, -1.5], [20, -2.7], [28, -4.4], [33, -3.8], [30, -2.6], [20, -1.4]], 'l'); F.ell(27, -1, 1.5, 1.4, 'l'); F.ell(31, 1.8, 1.2, 1.2, 'l'); F.rect(0, 2, -1.7, 1.7, 'l'); F.line(6, 0.4, 18, 0.8, 'l'); };
  S.censer = C => { const F = fr(C, 38); haft(F, 11, 0.9, 10); ball(F, 0.6, 1.4);
    for (let i = 0; i < 3; i++) F.ell(12.4 + i * 2.6, 0, 1.3, 0.9, i % 2 ? 'b' : 'a');
    F.ell(28, 0, 6.2, 5.6, 't'); F.ell(28, 0, 4.4, 3.9, 'b'); F.rect(23, 33, -0.5, 0.5, 'k'); F.line(24, -2, 32, -2, 'k'); F.line(24, 2, 32, 2, 'k'); F.ell(28, 0, 1.8, 1.8, 'g'); };
  // ---------------- staffs, rods, wands ----------------
  const shaft = (F, L, w, grip) => { F.rect(0, L, -w, w, 'h'); F.line(1, -w * 0.3, L - 1, -w * 0.3, 'l'); if (grip) wrap(F, 6, 16, w); F.rect(0, 1.8, -w - 0.4, w + 0.4, 't'); };
  S.quarterstaff = C => { const F = fr(C, 42); F.rect(0, 42, -1.3, 1.3, 'h'); F.line(1, -0.4, 41, -0.4, 'l'); F.rect(0, 2, -1.8, 1.8, 't'); F.rect(40, 42, -1.8, 1.8, 't'); F.rect(19, 22, -1.8, 1.8, 'l'); };
  S.battlestaff = C => { const F = fr(C, 42); F.rect(0, 38, -1.3, 1.3, 'h'); F.line(1, -0.4, 37, -0.4, 'l'); F.rect(0, 2, -1.8, 1.8, 't'); F.rect(36, 38.4, -1.9, 1.9, 't'); F.poly([[38, -1.4], [42, 0], [38, 1.4]], 'a'); [10, 16, 22].forEach(u => F.rect(u, u + 1.6, -1.9, 1.9, 't')); };
  S.staff = C => { const F = fr(C, 42); shaft(F, 36, 1.2, true);
    F.poly([[33, -1.6], [35, -4.8], [38, -5.6], [41, -4.4], [42, -1.4], [40, -3.2], [37, -3.4], [36, -1.6]], 't'); F.poly([[33, 1.6], [35, 4.8], [38, 5.6], [41, 4.4], [42, 1.4], [40, 3.2], [37, 3.4], [36, 1.6]], 't'); F.ell(38.6, 0, 3.2, 3.2, 'g'); F.ell(37.6, -1, 1.1, 1.1, 'w'); };
  S.staffmoon = C => { const F = fr(C, 42); shaft(F, 34, 1.2, true); const p = K.arcPts(38, 0, 6.4, 6.4, 120, 400, 16); F.poly(K.stripPoly(p, p.map((_, i) => 0.8 + 1.3 * Math.sin(Math.PI * i / 16))), 't'); F.ell(38.4, 0, 2.7, 2.7, 'g'); };
  S.staffserpent = C => { const F = fr(C, 42); shaft(F, 30, 1.2, true); const p = [...bez([30, 0], [34, 4], [36, 0], 6), ...bez([36, 0], [38, -4], [41, -1], 6).slice(1)]; F.poly(K.stripPoly(p, p.map((_, i) => 1.5 - i * 0.04)), 'a'); F.ell(41.4, -1.2, 2.2, 1.7, 'a'); F.poly([[43, -1.6], [45.4, -3.4], [44.6, -1]], 'r'); F.ell(41.8, -2, 0.8, 0.8, 'g'); F.poly(K.bandPoly(p, p.map((_, i) => 1.5 - i * 0.04), -1, -0.3), 'c'); };
  S.stafftree = C => { const F = fr(C, 42); shaft(F, 33, 1.3, true);
    F.poly(K.stripPoly(bez([32, 0], [36, -4], [40, -6], 6), 1.2), 'h'); F.poly(K.stripPoly(bez([32, 0], [36, 4], [40, 6], 6), 1.2), 'h'); F.poly(K.stripPoly(bez([34, 0], [38, 0], [42, 0], 5), 1.1), 'h');
    [[40, -6.4], [42.4, 0], [40, 6.4], [37, -4.4], [37, 4.4]].forEach(([u, v]) => F.ell(u, v, 2.6, 2, 'g')); };
  S.staffflower = C => { const F = fr(C, 42); shaft(F, 33, 1.1, true);
    [[0, -3.4], [3.2, -1.2], [3.2, 2.4], [0, 3.8], [-3.2, 2.4], [-3.2, -1.2]].forEach(([a, b]) => F.ell(38 + b, a, 2.5, 2.5, 'w')); F.ell(38, 0, 2.2, 2.2, 'g'); F.line(33, 0, 36, 0, 'h'); };
  S.staffbird = C => { const F = fr(C, 42); shaft(F, 34, 1.2, true);
    F.ell(37.5, 0, 2.8, 2.2, 'a'); F.ell(40.5, -1.8, 1.9, 1.7, 'a'); F.poly([[42, -2.6], [44.4, -1.8], [42, -1]], 'y'); F.poly([[35, 0], [31, 2.2], [34.8, 2.6]], 'b'); F.ell(40.9, -2.1, 0.7, 0.7, 'k'); F.ell(37, 0.5, 1.8, 1.1, 'c'); };
  S.stafffire = C => { const F = fr(C, 42); shaft(F, 34, 1.2, true);
    F.poly([[33, -1.6], [35.4, -4.6], [38, -4.6], [38, -1.4]], 't'); F.poly([[33, 1.6], [35.4, 4.6], [38, 4.6], [38, 1.4]], 't'); F.ell(39, 0, 4, 4, 'g'); F.ell(38.2, -0.9, 1.6, 1.6, 'w'); };
  S.staffcross = C => { const F = fr(C, 42); shaft(F, 30, 1.2, true); F.rect(30, 42, -1.4, 1.4, 't'); F.rect(34.6, 37.8, -5.4, 5.4, 't'); F.ell(36.2, 0, 1.7, 1.7, 'g'); };
  S.staffskull = C => { const F = fr(C, 42); shaft(F, 34, 1.2, true); F.ell(38.5, 0, 4, 3.5, 'w'); F.rect(35, 39, 1.8, 4.4, 'w'); F.ell(39.6, -1.5, 1.1, 1.1, 'k'); F.ell(39.6, 1.8, 1.1, 1.1, 'k'); F.ell(36.2, 0, 0.9, 0.9, 'g'); };
  S.staffcrystal = C => { const F = fr(C, 42); shaft(F, 34, 1.2, true); F.poly([[34, -2.4], [37, -3.6], [37, 3.6], [34, 2.4]], 't'); F.poly([[36, 0], [39.6, -3.8], [43, 0], [39.6, 3.8]], 'g'); F.line(37, 0, 41.6, 0, 'w'); };
  S.staffinsect = C => { const F = fr(C, 42); shaft(F, 30, 1.2, true); F.ell(36.5, 0, 5.8, 4.6, 'h'); F.line(32, -3, 41, -3, 'l'); F.line(32, 0, 41, 0, 'l'); F.line(32, 3, 41, 3, 'l'); F.ell(38, 1, 1.6, 1.1, 'k'); F.ell(34.4, -1.8, 2, 1.5, 'g'); };
  S.staffheart = C => { const F = fr(C, 42); shaft(F, 33, 1.2, true); F.ell(37.4, -2.5, 2.8, 2.8, 'g'); F.ell(37.4, 2.5, 2.8, 2.8, 'g'); F.poly([[34.2, -4.2], [34.2, 4.2], [43, 0]], 'g'); F.ell(36.4, -2.7, 1, 1, 'w'); };
  S.rod = C => { const F = fr(C, 36); F.rect(0, 30, -1.4, 1.4, 'a'); F.poly([[0, -1.4], [30, -1.4], [30, -0.2], [0, -0.2]], 'c'); F.poly([[0, 0.6], [30, 0.6], [30, 1.4], [0, 1.4]], 'b'); for (let u = 4; u < 28; u += 6) F.rect(u, u + 1.6, -2, 2, 't'); F.rect(0, 2, -2.2, 2.2, 't'); F.ell(33, 0, 3, 3, 'g'); F.ell(32.2, -0.9, 1.1, 1.1, 'w'); };
  S.scepter = C => { const F = fr(C, 38); F.rect(0, 29, -1.3, 1.3, 't'); F.line(1, -0.8, 28, -0.8, 'c'); for (let u = 6; u < 26; u += 8) F.ell(u, 0, 2.2, 2.2, 'g');
    F.poly([[29, -1.8], [31, -4.6], [34, -4.8], [36, -1.6], [36, 1.6], [34, 4.8], [31, 4.6], [29, 1.8]], 't'); F.ell(33, 0, 2.4, 2.4, 'g'); F.ell(0.8, 0, 1.9, 1.9, 't'); };
  S.wand = C => { const F = fr(C, 34); F.poly([[0, -1.4], [27, -0.9], [27, 0.9], [0, 1.4]], 'h'); F.line(1, -0.5, 25, -0.3, 'l'); F.rect(0, 5, -1.8, 1.8, 'l'); F.rect(5, 6.4, -2, 2, 't'); F.rect(27, 29, -1.5, 1.5, 't'); F.ell(31, 0, 2.6, 2.6, 'g'); F.ell(30.2, -0.8, 0.9, 0.9, 'w'); };
  S.wandbone = C => { const F = fr(C, 34); F.poly([[0, -1.6], [6, -1.1], [27, -0.8], [27, 0.8], [6, 1.1], [0, 1.6]], 'w'); F.ell(0.6, -1.1, 1.7, 1.5, 'w'); F.ell(0.6, 1.1, 1.7, 1.5, 'w'); F.line(8, 0, 25, 0, 'b'); F.ell(30, 0, 2.8, 2.8, 'g'); F.rect(27, 28.6, -1.7, 1.7, 't'); };
  // ---------------- polearms & spears ----------------
  const longshaft = (F, L, w) => { F.rect(0, L, -w, w, 'h'); F.line(1, -w * 0.3, L - 1, -w * 0.3, 'l'); F.rect(0, 1.8, -w - 0.5, w + 0.5, 't'); };
  S.spear = C => { const F = fr(C, 44); longshaft(F, 34, 1.1);
    const prof = [[33, 1.2], [36, 2.9], [41, 2.9]]; const band = (f0, f1) => [...prof.map(([u, w]) => [u, f0 * w]), [44, 0], ...prof.slice().reverse().map(([u, w]) => [u, f1 * w])];
    F.poly(band(-1, 1), 'a'); F.poly(band(-1, -0.3), 'c'); F.poly(band(0.4, 1), 'b'); F.line(35, 0, 41, 0, 'f'); F.rect(31, 33, -1.9, 1.9, 'r'); };
  S.javelin = C => { const F = fr(C, 42); F.rect(0, 36, -0.8, 0.8, 'h'); F.line(1, -0.3, 35, -0.3, 'l'); blade(F, [[35, 1], [37, 1.9]], 42, false); F.rect(26, 28, -1.5, 1.5, 'l'); F.rect(0, 1.6, -1.2, 1.2, 't'); };
  S.pike = C => { const F = fr(C, 46); longshaft(F, 40, 1); F.rect(31, 40, -1.9, -1, 'b'); F.rect(31, 40, 1, 1.9, 'b'); blade(F, [[40, 1.6]], 46, false); F.rect(38.6, 40, -2.1, 2.1, 't'); };
  S.glaive = C => { const F = fr(C, 44); longshaft(F, 32, 1.1);
    F.poly([[31, -1.4], [32, -3.4], [38, -4.6], [44, -2.2], [42, -0.8], [33, 1.4]], 'a'); F.poly([[32, -3.4], [38, -4.6], [44, -2.2], [41, -2.6], [37, -3]], 'c'); F.poly([[33, 1.4], [42, -0.8], [41, 0.6], [34, 2]], 'b'); F.line(33, -1.2, 41, -1.6, 'f'); F.rect(30, 32, -2, 2, 't'); };
  S.halberd = C => { const F = fr(C, 44); longshaft(F, 36, 1.1);
    F.poly([[27, 1.2], [30, 3], [36, 7], [41, 5.4], [35, 1.2], [33, 1.2]], 'a'); F.poly([[27, 1.2], [27, 5.6], [31, 9.4], [33, 4.2]], 'a'); F.poly([[30, 3], [36, 7], [41, 5.4], [38, 4.4], [35, 5]], 'c'); blade(F, [[35, 1.3]], 44, false); F.line(32, 3, 38, 5.2, 'f'); F.rect(26, 28, -2, 2, 't'); };
  S.trident = C => { const F = fr(C, 44); longshaft(F, 32, 1.1);
    F.rect(30, 33, -4.8, 4.8, 'a'); F.rect(30, 44, -5.2, -3.8, 'a'); F.rect(30, 44, 3.8, 5.2, 'a'); F.rect(31, 44, -0.7, 0.7, 'a');
    F.tri(44, -5.2, 44, -3.8, 47, -4.5, 'a'); F.tri(44, 3.8, 44, 5.2, 47, 4.5, 'a'); F.tri(44, -0.7, 44, 0.7, 47.4, 0, 'a'); F.tri(38, -3.8, 40.4, -3.8, 38.8, -1.8, 'a'); F.tri(38, 3.8, 40.4, 3.8, 38.8, 1.8, 'a'); F.line(31, -4.6, 43, -4.6, 'c'); F.line(31, 4.6, 43, 4.6, 'b'); };
  S.lance = C => { const F = fr(C, 46); longshaft(F, 40, 1.4); F.ell(6, 0, 3.6, 3.6, 't'); F.ell(6, 0, 1.7, 1.7, 'b'); blade(F, [[38, 1.7]], 46, false); F.poly([[18, -1.4], [30, -4.8], [28, -0.6]], 'r'); F.rect(36.6, 38, -2.6, 2.6, 't'); };
  S.dragonlance = C => { const F = fr(C, 46); longshaft(F, 38, 1.4);
    F.poly([[36, -1.7], [39, -4.8], [43, -2.2], [46, 0], [43, 2.2], [39, 4.8], [36, 1.7]], 'a'); F.poly([[39, -4.8], [43, -2.2], [46, 0], [40, -2]], 'c'); F.line(37.5, 0, 45, 0, 'f'); F.poly([[8, -1.4], [18, -5], [16, -0.4]], 'r'); F.rect(34.6, 36.6, -2.8, 2.8, 't'); };
  // ---------------- ranged ----------------
  S.shortbow = C => { const p = bez([21, 3], [8, 16], [21, 29], 14); C.p(K.stripPoly(p, 1.15), 'h'); C.p(K.bandPoly(p, 1.15, -1, -0.3), 'c');
    C.l(21, 3, 21, 29, 'w'); C.p([[7, 13], [10.4, 13], [10.4, 19], [7, 19]], 'l'); C.p([[20, 2], [23, 3], [22, 5]], 't'); C.p([[20, 30], [23, 29], [22, 27]], 't'); };
  S.longbow = C => { const p = [...bez([22, 2], [14, 5], [10, 12], 8), ...bez([10, 12], [8, 16], [10, 20], 6).slice(1), ...bez([10, 20], [14, 27], [22, 30], 8).slice(1)];
    C.p(K.stripPoly(p, 1.2), 'h'); C.p(K.bandPoly(p, 1.2, -1, -0.25), 'c'); C.p([[8, 13], [11.6, 13], [11.6, 19], [8, 19]], 'l'); C.l(22, 2, 22, 30, 'w'); C.p([[21, 1], [24, 2], [23, 4]], 't'); C.p([[21, 31], [24, 30], [23, 28]], 't'); };
  S.crossbow = C => { const F = K.frame(C, 3, 22, -20);
    F.rect(0, 26, -1.6, 1.6, 'h'); F.line(1, 0, 24, 0, 'l'); F.rect(0, 3, -2.2, 2.2, 'l'); F.rect(21, 25, -2.4, 2.4, 'b');
    const bow = K.bezier(F.P(21, -11), F.P(31, 0), F.P(21, 11), 10); C.p(K.stripPoly(bow, 1.2), 'h'); K.stroke(C, [F.P(21, -11), F.P(24, 0), F.P(21, 11)], 'w', 1);
    blade(F, [[10, 0.9]], 29, false); F.rect(8, 12, -2.4, 2.4, 'b'); F.ell(4, 2.2, 1.2, 1.2, 't'); };
  S.handcrossbow = C => { const F = K.frame(C, 8, 22, -22);
    F.rect(0, 16, -1.4, 1.4, 'h'); F.rect(0, 3, -1.8, 4.2, 'l'); F.rect(12, 16, -1.8, 1.8, 'b');
    const bow = K.bezier(F.P(14, -8), F.P(21, 0), F.P(14, 8), 8); C.p(K.stripPoly(bow, 1.1), 'h'); K.stroke(C, [F.P(14, -8), F.P(16.6, 0), F.P(14, 8)], 'w', 1);
    blade(F, [[5, 0.9]], 23, false); };
  S.heavycrossbow = C => { const F = K.frame(C, 2, 24, -25);
    F.rect(0, 28, -2, 2, 'h'); F.line(1, 0, 26, 0, 'l'); F.rect(0, 5, -2.6, 2.6, 'l'); F.rect(21, 26, -2.8, 2.8, 'b'); F.rect(11, 15, -3.2, 3.2, 'b'); F.ell(13, 0, 1.8, 1.8, 't');
    const bow = K.bezier(F.P(22, -14), F.P(34, 0), F.P(22, 14), 12); C.p(K.stripPoly(bow, 1.4), 'b'); K.stroke(C, [F.P(22, -14), F.P(26, 0), F.P(22, 14)], 'w', 1);
    blade(F, [[14, 1.2]], 31, false); F.ell(22.4, 4.4, 1.6, 2, 't'); };
  S.sling = C => { K.stroke(C, [[8, 5], [9, 10], [16, 14]], 'l', 2); K.stroke(C, [[24, 5], [23, 10], [16, 14]], 'l', 2); C.e(16, 17, 5, 4, 'l'); C.e(16, 17, 3, 2, 'a'); K.stroke(C, [[16, 21], [14, 27]], 'l', 2); C.e(14, 28, 2, 2, 'h'); };
  S.slingstone = C => { C.e(16, 17, 8, 7, 'a'); C.e(14, 15, 3.4, 2.6, 'c'); C.p([[18, 21], [23, 18], [24, 21], [19, 24]], 'b'); };
  const arrow = (C, x, y, deg, L) => { const F = K.frame(C, x, y, deg); F.rect(0, L - 4, -0.55, 0.55, 'h'); blade(F, [[L - 4, 1.5]], L + 1.5, false); F.poly([[0, -2.6], [6, -1], [6, 1], [0, 2.6]], 'r'); F.poly([[2.4, -2.6], [8, -0.6], [8, 0.6], [2.4, 2.6]], 'w'); };
  S.arrows = C => { arrow(C, 6, 26, -50, 28); arrow(C, 9, 28, -50, 28); arrow(C, 12, 29.5, -50, 28); };
  S.arrow = C => arrow(C, 4, 28, -45, 36);
  S.bolts = C => { [[7, 25], [11, 28]].forEach(([x, y]) => { const F = K.frame(C, x, y, -48); F.rect(0, 22, -0.9, 0.9, 'h'); blade(F, [[22, 1.9]], 28, false); F.rect(0, 4, -2, 2, 'l'); F.rect(0, 2.4, -2.5, 2.5, 'b'); }); };
  S.dart = C => { const F = fr(C, 28); F.rect(0, 18, -0.7, 0.7, 'h'); blade(F, [[18, 1.2]], 28, false); F.poly([[0, -3.2], [7, -0.8], [7, 0.8], [0, 3.2]], 'r'); };
  S.shuriken = C => { C.p([[16, 3], [19, 13], [29, 16], [19, 19], [16, 29], [13, 19], [3, 16], [13, 13]], 'a'); C.p([[16, 3], [19, 13], [16, 16]], 'c'); C.e(16, 16, 3.2, 3.2, 'x'); C.e(16, 16, 1.8, 1.8, 'b'); };
  S.cannon = C => { const F = K.frame(C, 6, 24, -30); F.poly([[0, -3.6], [22, -3], [22, 3], [0, 3.6]], 'b'); F.poly([[0, -3.6], [22, -3], [22, -1.2], [0, -1.8]], 'a'); F.rect(20, 24, -4, 4, 'a'); F.ell(0.6, 0, 3, 3, 'a'); F.ell(10, 0, 3, 5.4, 'a'); F.rect(8, 12, -5.6, 5.6, 't'); F.ell(23, 0, 2.2, 2.2, 'k'); F.ell(10, 0, 1.4, 1.4, 'g');
    K.stroke(C, [[10, 25], [7, 30]], 'h', 2); K.stroke(C, [[14, 25], [18, 30]], 'h', 2); };
})();
