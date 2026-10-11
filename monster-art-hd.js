// High-detail monster token art: 64x64 pixel portraits that are LIT, not just filled. Every part of a creature is drawn as a
// rounded solid (a height field), the whole picture is lit from the upper left with a cold rim light from behind, contact
// shadows fall between overlapping parts, and each material (scales, horn, belly plates, teeth...) has its own colour ramp and
// surface texture. The result is quantised to a few shades per material with a light dither so it still reads as pixel art.
// Dark and moody on purpose. monster-art.js calls MonsterArtHD.render(kind, palette) for every kind listed in MonsterArtHD.kinds
// and falls back to its original 32x32 drawing for the rest. Classic script, no dependencies. See docs/MONSTER_ART.md.
(function () {
  const N = 64;
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const toHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, k) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * k)); };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5);

  // ---- geometry helpers ----
  // Catmull-Rom through the points, so a handful of control points make a smooth organic outline.
  function spline(pts, closed, seg) {
    seg = seg || 7; const out = [], n = pts.length;
    const P = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let s = 0; s < seg; s++) {
        const t = s / seg, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
      }
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  }
  function inPoly(poly, x, y) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  // A tapered curved stroke (a horn, a spine, a claw): width goes from w0 at the first point to w1 at the last.
  function stroke(pts, w0, w1) {
    const sp = spline(pts, false, 6), L = [], R = [];
    sp.forEach((p, i) => {
      const a = sp[Math.max(0, i - 1)], b = sp[Math.min(sp.length - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const w = (w0 + (w1 - w0) * (i / (sp.length - 1))) / 2;
      L.push([p[0] - dy * w, p[1] + dx * w]); R.push([p[0] + dy * w, p[1] - dx * w]);
    });
    return L.concat(R.reverse());
  }
  const mirrorX = pts => pts.map(([x, y]) => [N - x, y]);

  // ---- the lit canvas ----
  // Everything is drawn on the full 64x64 plan, then pulled in slightly (FIT) so the whole subject sits inside the round token.
  const FIT = { s: 0.88, dx: 0, dy: 1.5 };
  const tf = ([x, y]) => [32 + (x - 32) * FIT.s + FIT.dx, 32 + (y - 32) * FIT.s + FIT.dy];
  function Scene(materials) {
    const H = new Float32Array(N * N), M = new Int16Array(N * N).fill(-1), Tx = new Float32Array(N * N), Ac = new Float32Array(N * N);
    const idx = (x, y) => y * N + x;
    // chamfer distance inside a mask (pixels from the nearest outside pixel)
    function distance(mask) {
      const INF = 1e4, d = new Float32Array(N * N);
      for (let i = 0; i < N * N; i++) d[i] = mask[i] ? INF : 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = idx(x, y); if (!d[i]) continue; let v = d[i]; if (x > 0) v = Math.min(v, d[i - 1] + 1); if (y > 0) v = Math.min(v, d[i - N] + 1); if (x > 0 && y > 0) v = Math.min(v, d[i - N - 1] + 1.4); if (x < N - 1 && y > 0) v = Math.min(v, d[i - N + 1] + 1.4); d[i] = v; }
      for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) { const i = idx(x, y); if (!d[i]) continue; let v = d[i]; if (x < N - 1) v = Math.min(v, d[i + 1] + 1); if (y < N - 1) v = Math.min(v, d[i + N] + 1); if (x < N - 1 && y < N - 1) v = Math.min(v, d[i + N + 1] + 1.4); if (x > 0 && y < N - 1) v = Math.min(v, d[i + N - 1] + 1.4); d[i] = v; }
      // a pixel on the shape's edge has distance 1 (its neighbour outside is 0)
      return d;
    }
    const api = {
      H, M, Tx, Ac,
      // Fill a polygon (array of [x,y]) with material `mat`. opts: height (dome height), round (px over which the edge rolls
      // off), lift (sit on top of whatever is already there, default true), z (extra base height), tex (texture scale offset).
      poly(pts, mat, o) {
        o = o || {};
        pts = pts.map(tf);
        const mask = new Uint8Array(N * N);
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (inPoly(pts, x + 0.5, y + 0.5)) mask[idx(x, y)] = 1;
        return api._fill(mask, mat, o);
      },
      ellipse(cx, cy, rx, ry, mat, o, rot) {
        o = o || {}; const c = Math.cos(rot || 0), s = Math.sin(rot || 0);
        [cx, cy] = tf([cx, cy]); rx *= FIT.s; ry *= FIT.s;
        const mask = new Uint8Array(N * N);
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry;
          if (u * u + v * v <= 1) mask[idx(x, y)] = 1;
        }
        return api._fill(mask, mat, o);
      },
      _fill(mask, mat, o) {
        const d = distance(mask), round = o.round || 5, height = o.height != null ? o.height : 6, lift = o.lift !== false;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
          const i = idx(x, y); if (!mask[i]) continue;
          const t = Math.min(1, d[i] / round), prof = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
          const base = lift && M[i] >= 0 ? H[i] : 0;
          H[i] = base + (o.z || 0) + height * prof;
          M[i] = mat; Tx[i] = o.tex || 0; Ac[i] = o.accent || 0;
        }
        return api;
      },
      // single pixels / small flat marks, drawn after lighting (eyes, teeth glints) — returned via `marks`
      // light the creature gives off (a glowing eye, a lit mouth) tints the pixels around it
      halos: [],
      halo(x, y, r, color, k) { const [hx, hy] = tf([x, y]); api.halos.push([hx, hy, r * FIT.s, color, k]); return api; },
    };
    return api;
  }

  // ---- shading ----
  function shade(S, materials, env) {
    const { H, M, Tx } = S, out = Array.from({ length: N }, () => Array(N).fill(null));
    const L = (() => { const v = [-0.55, -0.62, 0.56], n = Math.hypot(...v); return v.map(a => a / n); })();
    const h = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? 0 : H[y * N + x]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, mi = M[i]; if (mi < 0) continue;
      const mat = materials[mi];
      const gx = (h(x + 1, y) - h(x - 1, y)) * 0.5, gy = (h(x, y + 1) - h(x, y - 1)) * 0.5;
      let nx = -gx * mat.bump, ny = -gy * mat.bump, nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      let I;
      if (mat.emit != null) I = mat.emit;
      else {
        const lam = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
        I = env.ambient + (1 - env.ambient) * lam * env.key;
        // cold rim light from behind-right on the edges that face away from the key light
        const rim = Math.pow(1 - nz, 1.6) * Math.max(0, nx * 0.7 + ny * 0.55);
        I += rim * env.rim * mat.rim;
        // contact shadow: something taller sits just up-left of this pixel
        let occ = 0;
        for (let k = 1; k <= 3; k++) { const dz = h(x - k, y - k) - H[i]; if (dz > k * 1.1) occ = Math.max(occ, Math.min(1, (dz - k * 1.1) / 4)); }
        I -= occ * 0.42;
        // glossy highlight
        if (mat.spec) { const hv = [L[0], L[1], L[2] + 1], hn = Math.hypot(...hv); const sd = Math.max(0, (nx * hv[0] + ny * hv[1] + nz * hv[2]) / hn); I += Math.pow(sd, mat.specPow || 24) * mat.spec; }
        // surface texture
        if (mat.tex === 'scale') I += scaleTex(x, y, Tx[i]) * mat.texAmp;
        else if (mat.tex === 'plate') I += plateTex(x, y) * mat.texAmp;
        else if (mat.tex === 'ridge') I += ridgeTex(x, y, nx, ny) * mat.texAmp;
        else if (mat.tex === 'grain') I += (hash(x, y) - 0.5) * mat.texAmp;
      }
      if (mat.emit == null) I = Math.pow(Math.max(0, I), env.gamma) + (mat.shift || 0);
      I += BAYER[(y & 3) * 4 + (x & 3)] * env.dither * (mat.dither != null ? mat.dither : 1) / mat.ramp.length;
      const r = mat.ramp, k = Math.max(0, Math.min(r.length - 1, Math.floor(I * r.length)));
      out[y][x] = r[k];
    }
    return out;
  }
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  // Reptile hide: a worley (nearest-point) pattern of ~6px cells. Each cell gets its own tone, a bright upper-left lip and a dark
  // seam where two cells meet, so a flat area reads as irregular scales rather than a printed grid.
  function scaleTex(x, y, off) {
    const sz = 6 + (off || 0), gx = Math.floor(x / sz), gy = Math.floor(y / sz);
    let d1 = 1e9, d2 = 1e9, bx = 0, by = 0, bid = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = gx + i, cy = gy + j, px = (cx + 0.2 + hash(cx, cy) * 0.6) * sz, py = (cy + 0.2 + hash(cy + 7, cx + 3) * 0.6) * sz;
      const d = Math.hypot(x + 0.5 - px, (y + 0.5 - py) * 1.1);
      if (d < d1) { d2 = d1; d1 = d; bx = px; by = py; bid = hash(cx * 3 + 1, cy * 5 + 2); } else if (d < d2) d2 = d;
    }
    const seam = d2 - d1 < 1.05 ? -0.42 : 0;
    const lip = -((x + 0.5 - bx) + (y + 0.5 - by)) * 0.05;
    return seam + lip + (bid - 0.5) * 0.3;
  }
  const plateTex = (x, y) => (y % 4 === 0 ? -0.5 : y % 4 === 1 ? 0.12 : 0) + (hash(x >> 2, y >> 2) - 0.5) * 0.08;
  const ridgeTex = (x, y, nx, ny) => ((x + y * 2) % 5 === 0 ? -0.35 : 0.05);

  // ---- materials from a palette: a(body) b(shade) c(light) e(glow) ----
  const METALS = new Set(['gold', 'silver', 'bronze', 'copper', 'brass', 'steel']);
  function ramp(base, dark, light, n, darkMood) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      let c = t < 0.5 ? mix(mix(dark, '#050407', 0.55), dark, t * 2) : mix(dark, base, (t - 0.5) * 2 * 0.9);
      if (t > 0.78) c = mix(c, light, (t - 0.78) / 0.22 * 0.85);
      out.push(mix(c, '#06050a', darkMood));
    }
    return out;
  }
  function makeMaterials(pal, name) {
    const metal = METALS.has(name), mood = metal ? 0.22 : 0.3;
    const scaleRamp = ramp(pal.a, pal.b, pal.c, 6, mood);
    const belly = mix(pal.c, '#d9c79a', 0.5), bellyDark = mix(pal.b, '#6b5a3a', 0.5);
    const horn = mix(pal.b, '#2a241d', 0.55), hornLight = mix(pal.c, '#b8a98a', 0.55);
    const mem = mix(pal.b, '#14101a', 0.35), memLight = mix(pal.a, '#2a1f33', 0.35);
    return {
      scale: { ramp: scaleRamp, bump: 2.3, rim: 1, tex: 'scale', texAmp: metal ? 0.55 : 0.7, spec: metal ? 0.5 : 0.1, specPow: metal ? 14 : 30 },
      scaleDark: { ramp: ramp(mix(pal.a, pal.b, 0.55), pal.b, mix(pal.a, pal.c, 0.3), 6, mood + 0.08), bump: 2.3, rim: 1, tex: 'scale', texAmp: 0.6, spec: 0.05 },
      belly: { ramp: ramp(belly, bellyDark, mix(belly, '#fff4d8', 0.5), 6, mood - 0.06), bump: 0.9, rim: 0.6, tex: 'plate', texAmp: 0.55 },
      horn: { ramp: ramp(hornLight, horn, mix(hornLight, '#ffffff', 0.25), 6, 0.05), bump: 1.4, rim: 1.1, tex: 'ridge', texAmp: 0.5, spec: 0.28, specPow: 18 },
      membrane: { ramp: ramp(memLight, mem, mix(memLight, pal.c, 0.3), 5, 0.12), bump: 0.7, rim: 0.8, tex: 'grain', texAmp: 0.16 },
      mouth: { ramp: ['#060203', '#1a0508', '#3b0a0d', mix('#6a1414', pal.e, 0.12), mix('#a02a1c', pal.e, 0.2)], bump: 0, rim: 0, dither: 0.3, shift: -0.2 },
      tooth: { ramp: ['#8a8068', '#cfc4a6', '#f1e8d2', '#ffffff'], bump: 1.8, rim: 0, emit: 0.62, dither: 0.2 },
      socket: { ramp: ramp('#1a120d', '#050404', '#33261d', 3, 0), bump: 1, rim: 0.3 },
      glow: { ramp: [mix(pal.e, '#000', 0.45), mix(pal.e, '#000', 0.2), pal.e, mix(pal.e, '#fff', 0.55)], bump: 2.4, rim: 0, emit: 0.55, dither: 0.15 },
      pupil: { ramp: ['#080503', '#080503'], bump: 0, rim: 0, emit: 0.5 },
      nostril: { ramp: ['#060405', '#120b0b'], bump: 0, rim: 0, emit: 0.2 },
    };
  }

  // ---- the drawings: coordinates on the 64x64 grid, creature facing right ----
  const DRAW = {};
  DRAW.dragon = (S, m, pal) => {
    const ids = {}; Object.keys(m).forEach((k, i) => { ids[k] = i; });
    const sc = ids.scale, scd = ids.scaleDark, bel = ids.belly, hor = ids.horn, mou = ids.mouth, too = ids.tooth, sock = ids.socket, glo = ids.glow, pup = ids.pupil, nos = ids.nostril;
    const fang = (x, y, len, up, w) => S.poly([[x - (w || 2), y], [x + (w || 2), y], [x + 0.3, y + (up ? -len : len)]], too, { height: 2, round: 1.2, z: 1 });
    // far horn and mane spines, behind everything (darker, smaller)
    S.poly(stroke([[22, 15], [15, 6], [8, 3], [2, 7]], 6, 0.7), hor, { height: 4, round: 3 });
    [[14, 30, 3, 20], [11, 36, 1, 28], [10, 43, 1, 36], [11, 50, 3, 45], [19, 24, 10, 12]].forEach(([x, y, tx, ty]) => S.poly(stroke([[x + 4, y], [(x + 4 + tx) / 2 - 1, (y + ty) / 2 - 1], [tx, ty]], 5, 0.6), hor, { height: 3.5, round: 2.5 }));
    // neck from under the jaw to the bottom edge, with belly plates down the throat
    S.poly(spline([[16, 32], [9, 42], [8, 54], [10, 66], [34, 66], [38, 54], [42, 44], [40, 36]], true, 6), sc, { height: 14, round: 11 });
    S.poly(spline([[34, 66], [38, 54], [42, 44], [40, 38], [35, 42], [33, 52], [27, 66]], true, 5), bel, { height: 4, round: 3.5, z: 1.2 });
    // cranium
    S.ellipse(29, 26, 16, 13, sc, { height: 17, round: 13 }, -0.15);
    // snout
    S.poly(spline([[34, 14], [47, 15], [58, 21], [64, 27], [63, 34], [50, 35], [34, 36]], true, 5), sc, { height: 12, round: 8 });
    // nose ridge bumps
    S.poly(stroke([[52, 18], [55, 15], [58, 15]], 3.6, 0.8), hor, { height: 2.4, round: 1.8, z: 3 });
    // open mouth: dark interior first, then the lower jaw drawn over its lower half
    S.poly(spline([[36, 34], [62, 34], [61, 48], [44, 50], [34, 45]], true, 4), mou, { height: 1, round: 2, lift: false });
    S.poly(spline([[32, 47], [48, 47], [61, 46], [60, 51], [52, 56], [40, 57], [31, 52]], true, 5), scd, { height: 10, round: 7, z: 1 });
    // heavy brow ridge shading the eye
    S.poly(spline([[27, 16], [36, 13], [46, 17], [44, 21], [36, 19.5], [29, 22]], true, 4), scd, { height: 5, round: 2.6, z: 2.5 });
    // main horn sweeping back from the brow
    S.poly(stroke([[28, 15], [20, 7], [11, 5], [3, 11]], 8, 0.8), hor, { height: 6, round: 3.6, z: 3.5 });
    // jaw-hinge spike
    S.poly(stroke([[31, 42], [25, 47], [19, 48]], 6, 0.7), hor, { height: 4, round: 2.4, z: 2.5 });
    // eye
    S.ellipse(38.5, 23, 4.2, 3, sock, { height: 2, round: 2, z: 1 }, 0.25);
    S.ellipse(38.8, 23, 3, 2.1, glo, { height: 1, round: 1, z: 1 }, 0.25);
    S.poly([[38.2, 21.2], [39.4, 21.2], [39.4, 24.8], [38.2, 24.8]], pup, { height: 0, round: 1, z: 1 });
    S.halo(40, 23, 8, pal.e, 0.4); S.halo(50, 42, 16, '#b02a1a', 0.2);
    // nostril
    S.ellipse(59.5, 25, 1.8, 1.2, nos, { height: 0, round: 1 }, 0.3);
    // fangs
    [[41, 34.5, 5.5], [49, 35, 7], [57, 35, 4.4]].forEach(([x, y, l]) => fang(x, y, l, false));
    [[45, 47.5, 5], [54, 47, 4.4]].forEach(([x, y, l]) => fang(x, y, l, true));
  };

  const cache = {};
  const ENV = { ambient: 0.12, key: 1.05, rim: 0.6, dither: 0.55, gamma: 1.32 };
  function render(kind, pal, palName) {
    const key = kind + '|' + (palName || '') + '|' + pal.a;
    if (cache[key]) return cache[key];
    const mats = makeMaterials(pal, palName);
    const S = Scene();
    DRAW[kind](S, mats, pal);
    const grid = shade(S, Object.values(mats), ENV);
    S.halos.forEach(([hx, hy, r, color, k]) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const c = grid[y][x]; if (!c) continue; const d = Math.hypot(x + 0.5 - hx, y + 0.5 - hy); if (d < r) grid[y][x] = mix(c, color, k * (1 - d / r)); } });
    // 1px dark outline around the silhouette, a little warmer-darker where it faces the light
    const OL = '#07050a', filled = (x, y) => x >= 0 && y >= 0 && x < N && y < N && grid[y][x];
    const out = grid.map(r => r.slice());
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!grid[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => filled(x + dx, y + dy))) out[y][x] = OL;
    return (cache[key] = out);
  }
  window.MonsterArtHD = { N, kinds: Object.keys(DRAW), has: k => !!DRAW[k], render, _mix: mix };
})();
