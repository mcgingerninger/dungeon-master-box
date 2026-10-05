// Monster token art: procedurally drawn 32x32 pixel portraits, one per creature kind, recoloured into
// variants. Each portrait is built from a few shapes (ellipses, polygons, lines) on a pixel grid, then
// shaded the same way every time (light from the top-left, dark outline) so the whole set reads as one
// hand-made style. monsterArt(monster) picks a kind + palette from the creature's type and name;
// monsterArtSvg(monster, px, framed) returns an inline SVG token. Classic script, no dependencies.
(function () {
  const N = 32;
  // ---- tiny pixel canvas ----
  function Canvas() {
    const g = Array.from({ length: N }, () => Array(N).fill(null));
    const put = (x, y, r) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = r === 'x' ? null : r; };
    const inPoly = (pts, px, py) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; } return c; };
    const mx = x => N - 1 - x;
    const api = {
      g,
      p(pts, r, m) { const run = P => { const xs = P.map(q => q[0]), ys = P.map(q => q[1]); for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) if (inPoly(P, x + 0.5, y + 0.5)) put(x, y, r); }; run(pts); if (m) run(pts.map(([x, y]) => [N - x, y])); return api; },
      e(cx, cy, rx, ry, r, m) { const run = X => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = (x + 0.5 - X) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) put(x, y, r); } }; run(cx); if (m) run(N - cx); return api; },
      r(x, y, w, h, r, m) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { put(x + i, y + j, r); if (m) put(mx(x + i), y + j, r); } return api; },
      d(x, y, r, m) { put(x, y, r); if (m) put(mx(x), y, r); return api; },
      l(x1, y1, x2, y2, r, w, m) { w = w || 1; const run = (a, b, c, d) => { const n = Math.max(Math.abs(c - a), Math.abs(d - b), 1) * 2; for (let i = 0; i <= n; i++) { const x = a + (c - a) * i / n, y = b + (d - b) * i / n; for (let j = 0; j < w; j++) for (let k = 0; k < w; k++) put(x + j - (w - 1) / 2, y + k - (w - 1) / 2, r); } }; run(x1, y1, x2, y2); if (m) run(N - 1 - x1, y1, N - 1 - x2, y2); return api; },
    };
    return api;
  }
  const NOSHADE = new Set(['e', 'k', 'r', 'y', 'x']);
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (h, t, k) => { const a = hex(h), b = hex(t); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join(''); };

  // ---- one drawing per kind ----
  const D = {};
  D.dragon = C => {
    C.p([[0, 31], [2, 24], [6, 17], [11, 14], [18, 17], [20, 31]], 'a');
    C.p([[2, 13], [11, 14], [8, 22], [4, 22]], 'b');
    [[5, 19], [3, 22], [2, 25], [1, 28]].forEach(([x, y]) => C.p([[x, y], [x - 2, y - 1], [x - 1, y + 2]], 'c'));
    C.p([[12, 17], [29, 18], [27, 22], [19, 24], [12, 21]], 'b');
    C.p([[16, 16], [29, 16], [28, 19], [18, 20]], 'r');
    C.e(14, 13, 6, 5, 'a');
    C.p([[14, 9], [24, 10], [30, 13], [30, 16], [14, 17]], 'a');
    C.p([[9, 10], [4, 6], [1, 0], [8, 4], [12, 8]], 'c'); C.p([[13, 8], [11, 2], [10, 0], [15, 6]], 'c');
    C.l(14, 8, 20, 8, 'b'); C.r(16, 9, 3, 2, 'e'); C.d(17, 9, 'k'); C.d(28, 12, 'k'); C.d(26, 12, 'k');
    C.r(20, 16, 1, 3, 'w'); C.r(25, 16, 1, 2, 'w'); C.r(22, 18, 1, 2, 'w'); C.r(27, 18, 1, 1, 'w');
  };
  D.skull = C => {
    C.p([[0, 31], [3, 26], [10, 25], [22, 25], [29, 26], [32, 31]], 'a', false);
    C.l(4, 30, 11, 27, 'b'); C.l(27, 30, 20, 27, 'b');
    C.e(16, 12, 9, 9, 'a'); C.p([[8, 17], [24, 17], [22, 24], [10, 24]], 'a');
    C.e(12, 14, 3, 3, 'k', true); C.r(11, 14, 2, 1, 'e', true); C.p([[15, 17], [17, 17], [16, 20]], 'k');
    C.r(10, 22, 12, 3, 'w'); [12, 14, 16, 18, 20].forEach(x => C.l(x, 22, x, 24, 'k'));
    C.p([[10, 25], [22, 25], [20, 28], [12, 28]], 'a'); C.l(16, 4, 15, 8, 'b'); C.l(15, 8, 17, 10, 'b');
  };
  D.ghost = C => {
    C.p([[8, 10], [24, 10], [27, 24], [24, 29], [21, 26], [18, 30], [15, 26], [11, 30], [8, 26], [5, 29]], 'c');
    C.e(16, 10, 8, 8, 'c'); C.p([[6, 17], [1, 22], [3, 26], [8, 22]], 'c', true);
    C.e(12, 12, 2, 3, 'k', true); C.d(12, 11, 'e', true); C.e(16, 19, 2, 3, 'k');
  };
  D.zombie = C => {
    C.p([[0, 31], [3, 25], [10, 23], [22, 23], [29, 25], [32, 31]], 'b'); C.l(5, 28, 9, 26, 'k'); C.l(24, 29, 27, 27, 'k');
    C.p([[9, 6], [11, 3], [12, 7]], 'b'); C.p([[16, 5], [18, 2], [19, 6]], 'b'); C.p([[21, 6], [24, 4], [23, 8]], 'b');
    C.e(16, 14, 8, 9, 'a'); C.e(21, 10, 3, 3, 'w'); C.l(20, 9, 22, 11, 'k');
    C.e(11, 14, 2, 2, 'w'); C.d(11, 14, 'k'); C.r(19, 14, 3, 2, 'e'); C.d(20, 14, 'k');
    C.p([[11, 20], [21, 20], [20, 23], [12, 23]], 'k'); [12, 14, 17, 19].forEach(x => C.d(x, 20, 'w')); C.l(10, 10, 12, 12, 'b');
  };
  D.vampire = C => {
    C.p([[0, 31], [2, 13], [10, 22], [12, 31]], 'k', true); C.p([[3, 31], [4, 20], [9, 25], [10, 31]], 'r', true);
    C.p([[9, 25], [12, 21], [16, 25], [20, 21], [23, 25], [23, 31], [9, 31]], 'k');
    C.e(16, 13, 7, 8, 'a'); C.p([[8, 12], [9, 5], [16, 3], [23, 5], [24, 12], [21, 8], [16, 11], [11, 8]], 'k');
    C.r(11, 14, 3, 1, 'e', true); C.l(13, 19, 19, 19, 'k'); C.r(14, 19, 1, 3, 'w'); C.r(17, 19, 1, 3, 'w');
  };
  D.lich = C => {
    C.e(16, 17, 14, 14, 'b'); C.e(16, 14, 7, 8, 'a'); C.e(12, 14, 2, 3, 'k', true); C.r(11, 14, 2, 1, 'e', true); C.p([[15, 17], [17, 17], [16, 19]], 'k');
    C.r(11, 20, 10, 2, 'w'); [13, 15, 17, 19].forEach(x => C.l(x, 20, x, 21, 'k'));
    C.p([[8, 8], [9, 1], [12, 6], [16, 0], [20, 6], [23, 1], [24, 8]], 'y'); C.d(16, 3, 'r'); C.d(10, 5, 'e'); C.d(22, 5, 'e');
    C.p([[0, 31], [3, 26], [29, 26], [32, 31]], 'b');
  };
  D.demon = C => {
    C.p([[0, 20], [3, 5], [10, 12], [9, 21], [4, 26]], 'b', true);
    C.p([[10, 10], [5, 4], [2, 0], [10, 6], [12, 9]], 'c', true);
    C.e(16, 17, 8, 9, 'a'); C.p([[8, 13], [16, 17], [24, 13], [24, 15], [16, 19], [8, 15]], 'b');
    C.r(9, 15, 4, 2, 'e', true); C.p([[10, 22], [22, 22], [20, 26], [12, 26]], 'k');
    [11, 13, 15, 17, 19].forEach(x => C.r(x, 22, 1, 2, 'w')); C.r(12, 25, 1, 1, 'w'); C.r(19, 25, 1, 1, 'w'); C.d(15, 20, 'k', true);
  };
  D.angel = C => {
    C.p([[0, 28], [1, 12], [7, 4], [11, 11], [9, 19], [13, 26]], 'w', true); C.l(3, 14, 8, 22, 'c', 1, true); C.l(5, 9, 9, 17, 'c', 1, true);
    C.p([[8, 31], [10, 23], [22, 23], [24, 31]], 'a');
    C.e(16, 15, 7, 8, 'y'); C.e(16, 16, 5, 6, 's'); C.r(13, 15, 2, 1, 'e', true); C.l(14, 20, 18, 20, 'r');
    C.e(16, 3, 7, 2, 'y'); C.e(16, 3, 4, 1, 'x');
  };
  D.flame = C => {
    C.p([[16, 0], [20, 8], [26, 12], [28, 20], [24, 28], [16, 31], [8, 28], [4, 20], [6, 12], [11, 9], [12, 3]], 'r');
    C.p([[16, 6], [21, 13], [24, 20], [21, 26], [16, 28], [11, 26], [8, 20], [11, 13]], 'a'); C.e(16, 21, 6, 6, 'y');
    C.p([[10, 17], [14, 19], [10, 21]], 'k', true); C.p([[12, 24], [20, 24], [19, 26], [17, 25], [16, 26], [15, 25], [13, 26]], 'k'); C.p([[7, 8], [4, 3], [9, 6]], 'a'); C.p([[25, 8], [28, 3], [23, 6]], 'a');
  };
  D.water = C => {
    C.p([[16, 0], [24, 12], [27, 20], [24, 27], [16, 31], [8, 27], [5, 20], [8, 12]], 'a');
    C.e(11, 18, 3, 5, 'c'); C.r(14, 17, 2, 3, 'w', true); C.d(15, 19, 'k', true); C.p([[12, 25], [16, 23], [20, 25], [16, 27]], 'k');
    C.l(7, 26, 12, 28, 'c'); C.l(20, 28, 25, 26, 'c'); C.d(26, 8, 'c'); C.d(4, 12, 'c');
  };
  D.wind = C => {
    C.e(10, 12, 6, 5, 'c'); C.e(18, 10, 7, 6, 'c'); C.e(24, 15, 6, 5, 'c'); C.e(15, 17, 9, 6, 'c');
    C.r(11, 13, 2, 3, 'k'); C.r(18, 13, 2, 3, 'k'); C.d(11, 13, 'e'); C.d(18, 13, 'e'); C.e(15, 20, 2, 2, 'k');
    C.l(10, 24, 20, 26, 'c', 2); C.l(20, 26, 25, 29, 'c', 2); C.l(4, 20, 8, 22, 'c', 2); C.l(26, 8, 30, 6, 'c', 2);
  };
  D.rock = C => {
    C.p([[8, 6], [20, 3], [27, 9], [29, 20], [24, 28], [10, 29], [4, 20], [4, 11]], 'a');
    C.p([[13, 4], [15, 0], [18, 4]], 'c'); C.p([[21, 5], [25, 1], [24, 7]], 'c'); C.p([[7, 9], [5, 3], [11, 7]], 'c');
    C.l(8, 8, 12, 14, 'b'); C.l(22, 22, 26, 17, 'b'); C.l(14, 27, 13, 22, 'b');
    C.r(9, 14, 5, 3, 'e'); C.r(18, 14, 5, 3, 'e'); C.p([[10, 22], [22, 22], [20, 25], [18, 23], [16, 25], [14, 23], [12, 25]], 'k');
  };
  D.fey = C => {
    C.e(8, 10, 6, 8, 'c', true); C.e(9, 22, 4, 6, 'c', true); C.l(4, 6, 10, 14, 'w', 1, true); C.l(6, 22, 11, 19, 'w', 1, true);
    C.p([[11, 14], [6, 10], [11, 18]], 's', true); C.e(16, 15, 5, 6, 's'); C.e(16, 10, 6, 3, 'a'); C.r(13, 15, 2, 2, 'e', true);
    C.l(14, 8, 11, 2, 'k'); C.l(17, 8, 20, 2, 'k'); C.d(11, 1, 'y'); C.d(20, 1, 'y'); C.p([[12, 21], [20, 21], [23, 29], [9, 29]], 'a'); C.l(14, 20, 18, 20, 'r');
  };
  D.giant = C => {
    C.e(16, 17, 11, 11, 's'); C.p([[5, 12], [7, 4], [16, 2], [25, 4], [27, 12], [16, 8]], 'a');
    C.p([[6, 13], [26, 13], [26, 16], [6, 16]], 'b'); C.r(10, 17, 3, 2, 'w', true); C.d(11, 18, 'k', true); C.e(16, 21, 3, 3, 'b');
    C.p([[9, 25], [23, 25], [21, 29], [11, 29]], 'k'); C.r(10, 22, 2, 5, 'w', true); C.r(14, 25, 1, 2, 'w'); C.r(17, 25, 1, 2, 'w');
  };
  D.ooze = C => {
    C.p([[16, 6], [24, 10], [28, 20], [26, 27], [16, 29], [6, 27], [4, 20], [8, 10]], 'a');
    C.e(11, 12, 2, 2, 'c'); C.e(22, 22, 3, 3, 'c'); C.e(8, 22, 2, 2, 'c'); C.r(20, 12, 5, 1, 'w'); C.d(23, 11, 'w');
    C.e(16, 17, 5, 5, 'w'); C.e(16, 17, 2, 3, 'k'); C.d(16, 16, 'e'); C.r(8, 28, 2, 3, 'a'); C.r(22, 28, 2, 3, 'a'); C.d(25, 5, 'c');
  };
  D.plant = C => {
    C.p([[7, 8], [25, 8], [26, 26], [20, 30], [12, 30], [6, 26]], 'b');
    C.l(6, 28, 2, 31, 'b', 2); C.l(26, 28, 30, 31, 'b', 2); C.l(12, 12, 9, 22, 'k'); C.l(20, 10, 22, 20, 'k');
    C.e(8, 6, 5, 4, 'a'); C.e(16, 4, 6, 4, 'a'); C.e(24, 6, 5, 4, 'a'); C.e(10, 25, 3, 2, 'a'); C.e(23, 11, 3, 2, 'a');
    C.r(11, 15, 3, 3, 'e', true); C.p([[12, 22], [20, 22], [19, 27], [13, 27]], 'k'); C.d(16, 10, 'k');
  };
  D.construct = C => {
    C.p([[8, 6], [24, 6], [26, 12], [26, 26], [22, 30], [10, 30], [6, 26], [6, 12]], 'a');
    C.e(16, 3, 4, 3, 'c'); C.d(16, 3, 'k'); C.r(9, 14, 14, 5, 'k'); C.r(10, 15, 12, 3, 'b'); C.e(16, 16, 3, 3, 'e'); C.d(16, 16, 'w');
    C.d(8, 9, 'c', true); C.d(8, 27, 'c', true); C.l(7, 21, 25, 21, 'b'); C.r(11, 23, 10, 4, 'b'); [12, 14, 16, 18, 20].forEach(x => C.d(x, 25, 'k'));
  };
  D.eye = C => {
    C.l(8, 9, 4, 4, 'a', 2, true); C.l(11, 7, 10, 3, 'a', 2, true); C.l(5, 13, 1, 11, 'a', 2, true);
    C.e(4, 3, 2, 2, 'w', true); C.d(4, 3, 'k', true); C.e(10, 2, 2, 2, 'w', true); C.d(10, 2, 'k', true); C.e(1, 10, 2, 2, 'w', true); C.d(1, 10, 'k', true);
    C.e(16, 17, 11, 10, 'a'); C.e(16, 15, 7, 6, 'w'); C.e(16, 15, 4, 4, 'e'); C.r(15, 12, 2, 6, 'k');
    C.p([[8, 23], [24, 23], [22, 28], [10, 28]], 'k'); [10, 12, 14, 16, 18, 20].forEach(x => C.d(x, 23, 'w'));
  };
  D.wolf = C => {
    C.p([[2, 31], [6, 24], [10, 25], [22, 25], [26, 24], [30, 31]], 'b');
    C.p([[7, 14], [7, 2], [14, 9]], 'a', true); C.p([[9, 11], [9, 6], [12, 10]], 'b', true);
    C.e(16, 17, 9, 8, 'a'); C.e(16, 22, 5, 4, 'c'); C.r(15, 20, 3, 2, 'k'); C.l(16, 22, 16, 24, 'k');
    C.p([[10, 15], [14, 16], [10, 18]], 'e', true); C.r(13, 24, 1, 3, 'w'); C.r(18, 24, 1, 3, 'w'); C.l(12, 27, 20, 27, 'k');
  };
  D.bear = C => {
    C.e(6, 7, 4, 4, 'a'); C.e(26, 7, 4, 4, 'a'); C.e(6, 7, 2, 2, 'b'); C.e(26, 7, 2, 2, 'b');
    C.e(16, 17, 11, 10, 'a'); C.e(16, 22, 6, 5, 'c'); C.r(14, 19, 4, 2, 'k'); C.l(16, 21, 16, 24, 'k'); C.l(13, 25, 19, 25, 'k');
    C.r(10, 14, 3, 2, 'k', true); C.d(10, 14, 'e', true); C.r(14, 26, 1, 2, 'w'); C.r(17, 26, 1, 2, 'w');
    C.p([[0, 31], [3, 27], [8, 29], [10, 31]], 'a'); C.p([[32, 31], [29, 27], [24, 29], [22, 31]], 'a');
  };
  D.spider = C => {
    [[12, 10, 5, 4, 2, 10], [12, 12, 3, 10, 1, 18], [12, 14, 3, 17, 2, 25], [13, 16, 5, 22, 5, 30]].forEach(([a, b, c, d, e, f]) => { C.l(a, b, c, d, 'b', 1, true); C.l(c, d, e, f, 'b', 1, true); });
    C.e(16, 21, 6, 8, 'a'); C.p([[16, 15], [19, 21], [16, 27], [13, 21]], 'r'); C.e(16, 11, 5, 5, 'b');
    C.d(13, 9, 'e', true); C.d(15, 8, 'e', true); C.d(14, 11, 'e', true); C.p([[14, 15], [13, 19], [15, 16]], 'w', true);
  };
  D.snake = C => {
    C.e(16, 27, 12, 4, 'a'); C.e(16, 25, 8, 3, 'b'); C.p([[13, 26], [13, 14], [19, 14], [19, 26]], 'a');
    C.p([[8, 12], [16, 4], [24, 12], [21, 20], [16, 22], [11, 20]], 'a'); C.e(16, 14, 3, 3, 'c'); C.e(16, 14, 1, 2, 'k');
    C.e(16, 8, 4, 3, 'a'); C.d(14, 8, 'e'); C.d(18, 8, 'e'); C.l(16, 11, 16, 14, 'r'); C.l(16, 14, 14, 16, 'r'); C.l(16, 14, 18, 16, 'r'); C.l(10, 28, 22, 28, 'c');
  };
  D.bird = C => {
    C.p([[2, 31], [5, 22], [10, 19], [22, 19], [27, 22], [30, 31]], 'a'); [[8, 24], [12, 26], [16, 24], [20, 26], [24, 24]].forEach(([x, y]) => C.l(x - 2, y, x, y + 2, 'b'));
    C.e(16, 12, 8, 9, 'c'); C.p([[10, 8], [14, 10], [10, 12]], 'e', true); C.r(12, 10, 2, 1, 'k', true); C.p([[13, 4], [16, 1], [19, 4]], 'c');
    C.p([[12, 13], [20, 13], [17, 23], [14, 25], [15, 18]], 'y'); C.l(16, 14, 16, 19, 'k'); C.d(14, 14, 'k'); C.d(18, 14, 'k');
  };
  D.bat = C => {
    C.p([[1, 8], [10, 13], [9, 20], [1, 26], [4, 17]], 'b', true); C.l(2, 9, 10, 17, 'a', 1, true); C.l(3, 24, 9, 18, 'a', 1, true);
    C.p([[12, 12], [10, 4], [15, 10]], 'a', true); C.e(16, 17, 5, 6, 'a'); C.r(13, 15, 2, 1, 'e', true); C.r(14, 19, 1, 2, 'w'); C.r(17, 19, 1, 2, 'w'); C.p([[14, 22], [18, 22], [16, 28]], 'b');
  };
  D.scorpion = C => {
    C.l(10, 15, 5, 9, 'a', 2, true); C.p([[3, 11], [3, 3], [9, 7], [7, 10]], 'c', true); C.l(11, 20, 5, 22, 'b', 1, true); C.l(11, 23, 6, 28, 'b', 1, true);
    C.e(16, 18, 6, 8, 'a'); C.l(11, 17, 21, 17, 'b'); C.l(11, 21, 21, 21, 'b'); C.e(16, 12, 3, 3, 'b'); C.d(15, 11, 'e'); C.d(17, 11, 'e');
    C.l(16, 25, 21, 29, 'a', 2); C.l(21, 29, 27, 23, 'a', 2); C.l(27, 23, 26, 14, 'a', 2); C.l(26, 14, 22, 8, 'a', 2); C.p([[20, 8], [24, 4], [25, 10]], 'r');
  };
  D.claw = C => {
    C.p([[6, 12], [3, 3], [9, 9]], 'c', true); C.p([[12, 8], [13, 0], [16, 7]], 'c', true);
    C.e(16, 17, 12, 11, 'a'); C.e(9, 11, 3, 3, 'w'); C.e(16, 8, 3, 3, 'w'); C.e(23, 11, 3, 3, 'w'); C.d(9, 11, 'e'); C.d(16, 8, 'e'); C.d(23, 11, 'e');
    C.p([[5, 17], [27, 17], [25, 29], [7, 29]], 'k'); for (let x = 7; x <= 24; x += 3) { C.p([[x, 17], [x + 2, 17], [x + 1, 21]], 'w'); C.p([[x, 29], [x + 2, 29], [x + 1, 25]], 'w'); } C.e(16, 25, 4, 2, 'r');
  };
  D.goblin = C => {
    C.p([[0, 31], [4, 26], [12, 25], [20, 25], [28, 26], [32, 31]], 'b');
    C.p([[9, 15], [0, 9], [2, 17], [9, 19]], 'a', true); C.p([[8, 15], [3, 11], [4, 16]], 'b', true);
    C.e(16, 17, 8, 8, 'a'); C.p([[8, 13], [16, 5], [24, 13], [24, 14], [8, 14]], 'm'); C.l(8, 13, 24, 13, 'b');
    C.r(11, 16, 3, 2, 'e', true); C.d(12, 16, 'k', true); C.p([[15, 17], [17, 17], [16, 21]], 'b'); C.p([[11, 22], [21, 22], [19, 25], [13, 25]], 'k');
    C.d(12, 22, 'w'); C.d(15, 22, 'w'); C.d(17, 22, 'w'); C.d(20, 22, 'w');
  };
  D.orc = C => {
    C.p([[0, 31], [3, 26], [10, 25], [22, 25], [29, 26], [32, 31]], 'b');
    C.e(16, 17, 11, 9, 'a'); C.p([[10, 9], [16, 1], [22, 9]], 'm'); C.l(10, 9, 22, 9, 'b'); C.p([[5, 13], [27, 13], [27, 16], [5, 16]], 'b');
    C.r(9, 17, 3, 2, 'e', true); C.d(10, 17, 'k', true); C.e(16, 21, 3, 2, 'b'); C.r(9, 20, 2, 6, 'w', true); C.p([[11, 23], [21, 23], [19, 27], [13, 27]], 'k'); C.l(22, 14, 25, 19, 'b');
  };
  D.mage = C => {
    C.e(16, 17, 14, 2, 'a'); C.p([[16, 0], [22, 14], [10, 14]], 'a'); C.r(10, 13, 12, 2, 'y'); C.d(16, 7, 'y'); C.d(13, 10, 'y');
    C.e(16, 20, 6, 5, 's'); C.r(12, 19, 2, 1, 'e', true); C.p([[10, 22], [22, 22], [20, 31], [16, 29], [12, 31]], 'w'); C.l(16, 22, 16, 27, 'c');
    C.r(14, 17, 4, 1, 'k');
  };
  D.knight = C => {
    C.e(16, 3, 4, 4, 'r'); C.p([[16, 1], [20, 6], [12, 6]], 'r');
    C.p([[8, 6], [24, 6], [26, 14], [26, 27], [22, 31], [10, 31], [6, 27], [6, 14]], 'a');
    C.r(9, 14, 14, 2, 'k'); C.r(15, 16, 2, 11, 'k'); C.r(11, 15, 3, 1, 'e'); C.r(18, 15, 3, 1, 'e');
    [19, 21, 23].forEach(y => { C.d(11, y, 'k'); C.d(21, y, 'k'); }); C.d(8, 9, 'c', true); C.d(8, 27, 'c', true);
  };
  D.hood = C => {
    C.p([[16, 2], [26, 9], [28, 20], [26, 31], [6, 31], [4, 20], [6, 9]], 'a'); C.e(16, 17, 7, 8, 'k');
    C.r(11, 16, 3, 1, 'e', true); C.p([[9, 21], [23, 21], [22, 27], [10, 27]], 'b'); C.l(7, 10, 5, 20, 'b'); C.l(25, 10, 27, 20, 'b'); C.l(16, 4, 16, 9, 'b');
  };

  // ---- palettes: [body, shade, light, glow, white] ----
  const P = (a, b, c, e, w) => ({ a, b, c, e, w: w || '#f2ead7' });
  const PAL = {
    red: P('#c0392b', '#7a1f16', '#e8685a', '#ffd34d'), blue: P('#2f6fcf', '#183a7a', '#6aa3f0', '#e8f6ff'), green: P('#3f9a4a', '#1f5a28', '#79cf84', '#f4ff6a'),
    black: P('#3a3f4a', '#171a21', '#6c7585', '#7dff9a'), white: P('#dfe9f2', '#9fb3c4', '#ffffff', '#46d3ff'), gold: P('#d8aa2b', '#8a6612', '#ffe27a', '#fff6c0'),
    silver: P('#b9c3cf', '#79848f', '#eef3f8', '#9fe0ff'), bronze: P('#b5763a', '#6b3f17', '#e0a266', '#ffe08a'), copper: P('#c06c3d', '#6e3418', '#e69a6c', '#9fffd0'),
    brass: P('#bfa24a', '#6f5f22', '#e6d58a', '#ffe7a8'), purple: P('#7d4ac8', '#43257d', '#b48af0', '#ffe27a'), teal: P('#2e9c97', '#16615d', '#6fd6d0', '#fff2a8'),
    bone: P('#e6dcc0', '#a89d7d', '#fffbe9', '#ff5a3c'), ash: P('#9aa3a8', '#5f666b', '#d1d8dc', '#8cf0ff'), rot: P('#7c9a5a', '#44582d', '#a9c58a', '#ffe36a'),
    pale: P('#cdbfd8', '#8c7a9a', '#f0e8f7', '#c24dff'), ember: P('#e8631d', '#9c2e08', '#ffb347', '#fff1a0'), sea: P('#2a8bd0', '#14507d', '#6fc4f5', '#e0f8ff'),
    sky: P('#9fd0ee', '#5f93b8', '#e4f4ff', '#ffffff'), stone: P('#8c8574', '#524d41', '#bdb6a2', '#ff9d3a'), moss: P('#5f8f3c', '#33501e', '#93c46a', '#fff29a'),
    flesh: P('#d6a27e', '#8f5f43', '#f1c8a8', '#2b6cff'), brown: P('#8a5a35', '#4d2f17', '#b88458', '#ffd97a'), grey: P('#8d8f96', '#52545c', '#c3c5cc', '#ffd34d'),
    pink: P('#d96fa6', '#8e3a68', '#f4a9cb', '#fff2a8'), jade: P('#2f8f6a', '#17543d', '#6fd1a8', '#fffbb0'), steel: P('#7f8a99', '#454e5b', '#b6c0cd', '#ff7a3a'), orc: P('#5f8a3a', '#34501a', '#8fbb62', '#ffd34d'),
    gob: P('#78a53e', '#436620', '#a8d36a', '#ffe14d'), night: P('#2b2a4a', '#13122a', '#5b59a0', '#b8a6ff'), blood: P('#7b1230', '#3d0618', '#c23a5c', '#ff6a6a'),
  };
  const BG = { // token background tint per palette family
    dragon: '#3a1a14', undead: '#1d2420', fiend: '#33100f', celestial: '#2e2a1a', elemental: '#14232f', fey: '#2a1a33', giant: '#2a2418', ooze: '#16281a',
    plant: '#15281a', construct: '#1d2127', aberration: '#241530', beast: '#2a2118', monstrosity: '#2a1a1a', humanoid: '#1f2330',
  };

  // ---- pick sprite + palette from the creature ----
  const T = (hay, re) => re.test(hay);
  function pick(m) {
    const name = String(m.name || ''), type = String(m.type || '');
    const hay = `${name} ${type}`.toLowerCase(), t = type.toLowerCase(), n = name.toLowerCase();
    const has = re => re.test(hay), isT = re => re.test(t);
    // dragons: chromatic / metallic by name
    if (isT(/dragon/) || /\bdragon|wyrm|drake|wyvern|dracolich/.test(n)) {
      const col = [['black', /black/], ['blue', /blue/], ['green', /green/], ['red', /red/], ['white', /white/], ['gold', /gold/], ['silver', /silver/], ['bronze', /bronze/], ['copper', /copper/], ['brass', /brass/], ['purple', /shadow|amethyst|sapphire|emerald|crystal/]].find(([, re]) => re.test(n));
      return { kind: 'dragon', pal: col ? col[0] : (/wyvern|drake/.test(n) ? 'moss' : 'teal'), label: 'Dragon' };
    }
    if (isT(/undead/) || /skeleton|zombie|ghoul|ghast|wight|wraith|specter|spectre|ghost|banshee|vampire|lich|mummy|revenant|shadow|poltergeist|phantom|flameskull|ghoul|bone/.test(n)) {
      if (/lich|dracolich|archlich/.test(n)) return { kind: 'lich', pal: 'bone', label: 'Lich' };
      if (/vampire/.test(n)) return { kind: 'vampire', pal: 'pale', label: 'Vampire' };
      if (/ghost|wraith|specter|spectre|banshee|shadow|phantom|poltergeist|spirit/.test(n)) return { kind: 'ghost', pal: /shadow/.test(n) ? 'night' : /banshee/.test(n) ? 'pale' : 'ash', label: 'Spirit' };
      if (/zombie|ghoul|ghast|mummy|revenant|wight|corpse/.test(n)) return { kind: 'zombie', pal: /mummy/.test(n) ? 'bone' : /ghast|ghoul/.test(n) ? 'ash' : 'rot', label: 'Walking dead' };
      return { kind: 'skull', pal: /flameskull/.test(n) ? 'ember' : 'bone', label: 'Skeleton' };
    }
    if (isT(/fiend/) || /demon|devil|imp\b|quasit|balor|succubus|incubus|hellhound|nightmare|rakshasa|yugoloth|dretch|vrock|hezrou|glabrezu|nalfeshnee|marilith|pit fiend|cambion|barbed|bearded|horned/.test(n))
      return { kind: 'demon', pal: /devil|imp|pit fiend|barbed|bearded|horned|cambion/.test(n) ? 'blood' : /quasit|dretch/.test(n) ? 'purple' : 'red', label: 'Fiend' };
    if (isT(/celestial/) || /angel|couatl|unicorn|pegasus|deva|planetar|solar|empyrean/.test(n)) return { kind: 'angel', pal: /deva|planetar|solar/.test(n) ? 'gold' : 'white', label: 'Celestial' };
    if (isT(/elemental/) || /elemental|salamander|azer|efreeti|djinni|genie|mephit|xorn|gargoyle|magmin|water weird|air|earth|fire|water/.test(n)) {
      if (/fire|flame|magma|magmin|efreeti|salamander|azer|ember|lava|magmin|steam/.test(n)) return { kind: 'flame', pal: 'ember', label: 'Fire elemental' };
      if (/water|ice|frost|cold|rain|sea|ocean|tide|marid|water weird/.test(n)) return { kind: 'water', pal: /ice|frost|cold/.test(n) ? 'white' : 'sea', label: 'Water elemental' };
      if (/air|wind|storm|djinni|cloud|vapor|dust/.test(n)) return { kind: 'wind', pal: 'sky', label: 'Air elemental' };
      return { kind: 'rock', pal: 'stone', label: 'Earth elemental' };
    }
    if (isT(/fey/) || /sprite|pixie|dryad|satyr|nymph|hag|eladrin|boggle|redcap|blink dog|green hag|sea hag|night hag|faerie|fairy|brownie|korred/.test(n)) return { kind: 'fey', pal: /hag/.test(n) ? 'moss' : /night/.test(n) ? 'night' : /dryad|satyr|nymph/.test(n) ? 'jade' : 'pink', label: 'Fey' };
    if (isT(/giant/) || /ogre|troll|\b(hill|frost|fire|stone|cloud|storm|mountain|fomorian) giant|ettin|cyclops|\boni\b|goliath/.test(n)) return { kind: 'giant', pal: /troll/.test(n) ? 'moss' : /frost|ice/.test(n) ? 'white' : /fire/.test(n) ? 'ember' : /hill|ogre/.test(n) ? 'brown' : /stone/.test(n) ? 'stone' : 'flesh', label: 'Giant' };
    if (isT(/ooze/) || /ooze|pudding|jelly|slime|gelatinous|cube/.test(n)) return { kind: 'ooze', pal: /black/.test(n) ? 'black' : /ochre|yellow/.test(n) ? 'gold' : /gray|grey/.test(n) ? 'grey' : /gelatinous|cube/.test(n) ? 'teal' : 'green', label: 'Ooze' };
    if (isT(/plant/) || /treant|shambling|myconid|blight|vine|tree|fungus|mushroom|shrieker|violet|thorn/.test(n)) return { kind: 'plant', pal: /myconid|fungus|mushroom|violet|shrieker/.test(n) ? 'purple' : 'moss', label: 'Plant' };
    if (isT(/construct/) || /golem|animated|armor|homunculus|scarecrow|shield guardian|helmed|modron|gear|clockwork|automaton/.test(n)) return { kind: 'construct', pal: /flesh/.test(n) ? 'rot' : /iron|steel|helmed|armor/.test(n) ? 'steel' : /clay|stone/.test(n) ? 'stone' : /bone/.test(n) ? 'bone' : /gold|bronze/.test(n) ? 'bronze' : 'grey', label: 'Construct' };
    if (isT(/aberration/) || /beholder|mind flayer|illithid|aboleth|gibbering|mouther|chuul|cloaker|umber|otyugh|eye|spectator|grell|nothic|intellect|kuo-toa|gauth/.test(n)) return { kind: 'eye', pal: /mind flayer|illithid|aboleth|kuo/.test(n) ? 'purple' : /nothic|gauth|beholder|eye|spectator/.test(n) ? 'jade' : 'night', label: 'Aberration' };
    if (isT(/beast/) || /wolf|dog|jackal|hyena|bear|spider|snake|serpent|viper|python|cobra|bat|rat|boar|lion|tiger|panther|cat|eagle|hawk|owl|raven|crow|bird|vulture|scorpion|crab|centipede|insect|wasp|bee|ape|horse|elk|deer|goat|ram|shark|crocodile|lizard|toad|frog|badger|weasel|mastiff|swarm|fish|octopus|squid|whale|elephant|mammoth|rhinoceros|camel|donkey|mule|pony|boar|worm|beetle|ant|mantis|stirge/.test(n)) {
      if (/spider|tarantula|arachn/.test(n)) return { kind: 'spider', pal: /phase|giant wolf/.test(n) ? 'purple' : /giant/.test(n) ? 'brown' : 'black', label: 'Spider' };
      if (/snake|serpent|viper|python|cobra|naga|lizard|basilisk|crocodile|salamander|worm/.test(n)) return { kind: 'snake', pal: /cobra|poison|venom|viper/.test(n) ? 'green' : /python|constrictor/.test(n) ? 'brown' : 'jade', label: 'Reptile' };
      if (/bat|stirge|bee|wasp|insect|swarm|mosquito|fly\b/.test(n)) return { kind: 'bat', pal: /stirge|insect|wasp|bee/.test(n) ? 'brown' : 'night', label: 'Flyer' };
      if (/eagle|hawk|owl|raven|crow|bird|vulture|roc|falcon|griffon|hippogriff|peryton/.test(n)) return { kind: 'bird', pal: /raven|crow/.test(n) ? 'black' : /owl/.test(n) ? 'brown' : /eagle|hawk|griffon|roc/.test(n) ? 'bronze' : 'grey', label: 'Bird' };
      if (/bear|ape|baboon|mammoth|elephant|rhinoceros|boar|gorilla|sloth/.test(n)) return { kind: 'bear', pal: /polar|white|ice/.test(n) ? 'white' : /black/.test(n) ? 'black' : /boar|ape/.test(n) ? 'grey' : 'brown', label: 'Brute beast' };
      if (/scorpion|crab|centipede|beetle|ant\b|mantis|lobster|chuul/.test(n)) return { kind: 'scorpion', pal: /giant|scorpion/.test(n) ? 'bronze' : 'rot', label: 'Crawler' };
      return { kind: 'wolf', pal: /dire|winter|ice|white/.test(n) ? 'white' : /black|panther|night/.test(n) ? 'black' : /lion|tiger|cat|leopard/.test(n) ? 'gold' : /wolf|dog|jackal|hyena|mastiff/.test(n) ? 'grey' : 'brown', label: 'Beast' };
    }
    if (isT(/monstrosity/) || /owlbear|manticore|chimera|hydra|basilisk|medusa|mimic|harpy|bulette|carrion|cockatrice|displacer|gorgon|griffon|kraken|lamia|minotaur|ankheg|behir|roper|rust monster|worg|yeti|tarrasque|wyvern|sphinx|trapper|umber|winter wolf|hook horror|darkmantle|death dog/.test(n)) {
      if (/scorpion|ankheg|rust monster|umber|bulette|carrion|hook/.test(n)) return { kind: 'scorpion', pal: 'rot', label: 'Monstrosity' };
      if (/harpy|griffon|owlbear|manticore|peryton/.test(n)) return { kind: 'bird', pal: 'brown', label: 'Monstrosity' };
      if (/hydra|medusa|lamia|basilisk|cockatrice/.test(n)) return { kind: 'snake', pal: 'jade', label: 'Monstrosity' };
      return { kind: 'claw', pal: /yeti|winter/.test(n) ? 'white' : /chimera|manticore|sphinx|minotaur/.test(n) ? 'bronze' : 'purple', label: 'Monstrosity' };
    }
    // humanoids and anything else
    if (/goblin|hobgoblin|bugbear|kobold|gnoll|lizardfolk|troglodyte|yuan-ti|merfolk|sahuagin|kuo/.test(n)) return { kind: /kobold|lizardfolk|troglodyte|yuan|sahuagin/.test(n) ? 'snake' : 'goblin', pal: /hobgoblin/.test(n) ? 'red' : /bugbear/.test(n) ? 'brown' : /kobold/.test(n) ? 'copper' : /gnoll/.test(n) ? 'gold' : /lizardfolk|troglodyte/.test(n) ? 'jade' : 'gob', label: 'Goblinoid' };
    if (/orc|half-orc|ogre|uruk/.test(n)) return { kind: 'orc', pal: 'orc', label: 'Orc' };
    if (/mage|wizard|sorcerer|warlock|witch|archmage|priest|acolyte|cultist|necromancer|druid|illusionist|enchanter|conjurer|diviner|evoker|shaman|cleric/.test(n)) return { kind: 'mage', pal: /necromancer|cultist|warlock/.test(n) ? 'night' : /druid|shaman/.test(n) ? 'moss' : /priest|cleric|acolyte/.test(n) ? 'gold' : 'blue', label: 'Caster' };
    if (/knight|guard|soldier|veteran|captain|commander|champion|gladiator|warrior|paladin|swashbuckler|berserker|marshal|sentinel|legionnaire|general|lord|noble/.test(n)) return { kind: 'knight', pal: /noble|lord/.test(n) ? 'gold' : 'steel', label: 'Soldier' };
    if (/bandit|thug|assassin|spy|scout|thief|rogue|cutpurse|brigand|pirate|smuggler|ranger|hunter|poacher|outlaw|mercenary|drow|duergar|spy/.test(n)) return { kind: 'hood', pal: /drow/.test(n) ? 'night' : /assassin/.test(n) ? 'black' : 'brown', label: 'Rogue' };
    return { kind: 'hood', pal: 'grey', label: 'Humanoid' };
  }
  const FAMILY = { dragon: 'dragon', skull: 'undead', ghost: 'undead', zombie: 'undead', vampire: 'undead', lich: 'undead', demon: 'fiend', angel: 'celestial', flame: 'elemental', water: 'elemental', wind: 'elemental', rock: 'elemental',
    fey: 'fey', giant: 'giant', ooze: 'ooze', plant: 'plant', construct: 'construct', eye: 'aberration', wolf: 'beast', bear: 'beast', spider: 'beast', snake: 'beast', bird: 'beast', bat: 'beast', claw: 'monstrosity', scorpion: 'monstrosity',
    goblin: 'humanoid', orc: 'humanoid', hood: 'humanoid', mage: 'humanoid', knight: 'humanoid' };

  // ---- render ----
  const FIXED = { w: '#efe6d0', k: '#0e0b09', r: '#b02a2a', y: '#e8c04a', m: '#8f98a6', s: '#d9a77f', x: null };
  function rasterize(kind, pal) {
    const C = Canvas();
    (D[kind] || D.hood)(C);
    const colorOf = r => (r === 'a' ? pal.a : r === 'b' ? pal.b : r === 'c' ? pal.c : r === 'e' ? pal.e : r === 'w' ? (pal.w || FIXED.w) : FIXED[r] || pal.a);
    const out = Array.from({ length: N }, () => Array(N).fill(null));
    const at = (x, y) => (x >= 0 && y >= 0 && x < N && y < N ? C.g[y][x] : null);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const r = C.g[y][x]; if (!r) continue;
      let col = colorOf(r);
      if (!NOSHADE.has(r)) {
        const up = at(x, y - 1), lf = at(x - 1, y), dn = at(x, y + 1), rt = at(x + 1, y);
        const lit = (up !== r) || (lf !== r), dark = (dn !== r) || (rt !== r);
        if (r === 'w') col = lit && !dark ? mix(col, '#ffffff', 0.35) : dark && !lit ? mix(col, '#7a6f58', 0.35) : col;
        else if (lit && !dark) col = mix(col, '#ffffff', 0.3); else if (dark && !lit) col = mix(col, '#000000', 0.34);
        else if (lit && dark) col = mix(col, '#000000', 0.08);
      }
      out[y][x] = col;
    }
    // 1px dark outline around the whole silhouette
    const OL = '#0d0a08';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!C.g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy))) out[y][x] = OL;
    return out;
  }
  window.monsterArt = function (m) { const p = pick(m || {}); return { ...p, family: FAMILY[p.kind] || 'humanoid', colors: PAL[p.pal] || PAL.grey }; };
  // Inline SVG. `framed` adds the round gold-rimmed token backing used on the Battle Field.
  window.monsterArtSvg = function (m, px, framed) {
    const art = window.monsterArt(m), grid = rasterize(art.kind, art.colors), c = art.colors;
    let rects = '';
    grid.forEach((row, y) => {
      let x = 0;
      while (x < N) {
        const col = row[x]; if (!col) { x++; continue; }
        let run = 1; while (x + run < N && row[x + run] === col) run++;
        rects += `<rect x="${x}" y="${y}" width="${run}" height="1" fill="${col}"/>`;
        x += run;
      }
    });
    const bg = BG[art.family] || '#1f1f1f', id = 'ma' + Math.random().toString(36).slice(2, 7);
    const head = `<svg class="monster-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${px}" height="${px}" shape-rendering="crispEdges" role="img" aria-label="${art.label}">`;
    if (!framed) return head + rects + '</svg>';
    return head + `<defs><radialGradient id="${id}" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="${mix(bg, c.b, 0.45)}"/><stop offset="1" stop-color="${bg}"/></radialGradient><clipPath id="${id}c"><circle cx="16" cy="16" r="14.2"/></clipPath></defs>`
      + `<circle cx="16" cy="16" r="15.4" fill="#2b200f"/><circle cx="16" cy="16" r="14.6" fill="url(#${id})"/><g clip-path="url(#${id}c)">${rects}</g>`
      + `<circle cx="16" cy="16" r="15.4" fill="none" stroke="#c9a84c" stroke-width="1"/><circle cx="16" cy="16" r="14.4" fill="none" stroke="#6b5420" stroke-width="0.6"/></svg>`;
  };
  window.MONSTER_ART_KINDS = Object.keys(D);
})();
