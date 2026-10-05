// Drawing helpers for item-art*.js. Everything here works on the PixelKit canvas from monster-art.js.
//   ItemKit.frame(C, ox, oy, deg)  - a rotated local coordinate system for long objects (weapons): u runs
//                                    from the handle end (0) toward the tip, v is sideways (+v = down/right).
//   ItemKit.pattern(C, pts, fn)    - fill a polygon with a per-pixel role pattern (chain mail, scales, studs...).
//   ItemKit.arc / ItemKit.curve    - strokes and variable-width strips along curves.
(function () {
  const kit = window.PixelKit;
  if (!kit) return;
  const N = kit.N;
  const inPoly = (pts, px, py) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) c = !c; } return c; };
  const put = (C, x, y, r) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < N && y < N) C.g[y][x] = r === 'x' ? null : r; };

  // Polygon outline of a strip that follows a centre polyline with a half-width at each point.
  function stripPoly(pts, widths) {
    const L = [], R = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const w = Array.isArray(widths) ? widths[i] : widths;
      L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]); R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
    }
    return L.concat(R.reverse());
  }
  // Points along a quadratic Bezier.
  function bezier(p0, p1, p2, n) { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; out.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]); } return out; }
  function arcPts(cx, cy, rx, ry, a0, a1, n) { const out = []; for (let i = 0; i <= n; i++) { const t = (a0 + (a1 - a0) * i / n) * Math.PI / 180; out.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); } return out; }

  function frame(C, ox, oy, deg) {
    const a = (deg == null ? -45 : deg) * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
    const P = (u, v) => [ox + u * ux + v * vx, oy + u * uy + v * vy];
    const F = {
      P,
      poly(pts, role) { C.p(pts.map(([u, v]) => P(u, v)), role); return F; },
      rect(u0, u1, v0, v1, role) { return F.poly([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], role); },
      line(u0, v0, u1, v1, role, w) { const [x0, y0] = P(u0, v0), [x1, y1] = P(u1, v1); C.l(x0, y0, x1, y1, role, w || 1); return F; },
      ell(u, v, ru, rv, role, n) { const pts = [], k = n || 16; for (let i = 0; i < k; i++) { const t = i / k * 2 * Math.PI; pts.push([u + ru * Math.cos(t), v + rv * Math.sin(t)]); } return F.poly(pts, role); },
      strip(pts, widths, role) { return F.poly(stripPoly(pts, widths), role); },
      tri(u0, v0, u1, v1, u2, v2, role) { return F.poly([[u0, v0], [u1, v1], [u2, v2]], role); },
      dot(u, v, role) { const [x, y] = P(u, v); put(C, x, y, role); return F; },
    };
    return F;
  }
  // Fill polygon cells with fn(x, y) -> role | null.
  function pattern(C, pts, fn) {
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(N - 1, Math.ceil(Math.max(...ys))); y++)
      for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(N - 1, Math.ceil(Math.max(...xs))); x++)
        if (inPoly(pts, x + 0.5, y + 0.5)) { const r = fn(x, y); if (r) C.g[y][x] = r === 'x' ? null : r; }
  }
  // Stroke through points with the canvas line brush.
  function stroke(C, pts, role, w) { for (let i = 0; i < pts.length - 1; i++) C.l(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], role, w || 1); }
  // Band of a strip between fractions f0..f1 of its half-width (f=-1 is the -v edge, +1 the +v edge).
  function bandPoly(pts, widths, f0, f1) {
    const A = [], B = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const w = Array.isArray(widths) ? widths[i] : widths, nx = -dy, ny = dx;
      A.push([pts[i][0] + nx * w * f0, pts[i][1] + ny * w * f0]); B.push([pts[i][0] + nx * w * f1, pts[i][1] + ny * w * f1]);
    }
    return A.concat(B.reverse());
  }
  window.ItemKit = { frame, pattern, stroke, stripPoly, bandPoly, bezier, arcPts, inPoly, put, N };
  window.ItemArtSprites = window.ItemArtSprites || {};
})();
