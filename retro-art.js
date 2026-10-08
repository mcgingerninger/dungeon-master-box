// Retro dungeon pixel art for the Store (merchant portraits + stalls), Map Builder (terrain tiles, walls, doors) and Journey
// (scene backdrops + event glyphs). Everything is hand-placed SVG <rect>s (no images, no canvas), drawn with hard outlines, three-step
// shading and the same warm stone-and-torch palette as the token art.
// Window API: RetroArt.merchantPortrait(key, px), RetroArt.merchantStall(key), RetroArt.terrainDefs(prefix, cellPx),
//             RetroArt.terrainFill(prefix, key), RetroArt.wallSvg(...), RetroArt.doorSvg(...),
//             RetroArt.journeyBackdrop(key, animated), RetroArt.journeyOverlay(key), RetroArt.TERRAIN (extra terrains)
(function () {
  const R = (x, y, w, h, c, extra) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"${extra || ''}/>`;
  // Seeded random so tiles and scenes are identical every time they are drawn.
  const rng = seed => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

  // ASCII sprite: each row is centred in `width` columns; '.' is transparent; letters index `pal`. Horizontal runs of one colour merge.
  function sprite(rows, pal, width, ox, oy) {
    width = width || 16; ox = ox || 0; oy = oy || 0;
    let out = '';
    rows.forEach((raw, y) => {
      if (raw == null) return;
      const pad = Math.floor((width - raw.length) / 2);
      const row = '.'.repeat(Math.max(0, pad)) + raw;
      let x = 0;
      while (x < row.length) {
        const ch = row[x];
        if (ch === '.' || !pal[ch]) { x++; continue; }
        let n = 1; while (x + n < row.length && row[x + n] === ch) n++;
        out += R(ox + x, oy + y, n, 1, pal[ch]);
        x += n;
      }
    });
    return out;
  }
  // place a small sprite exactly (no centring) at a column offset
  function spriteAt(rows, pal, ox, oy) {
    let out = '';
    rows.forEach((row, y) => { let x = 0; while (x < row.length) { const ch = row[x]; if (ch === '.' || !pal[ch]) { x++; continue; } let n = 1; while (x + n < row.length && row[x + n] === ch) n++; out += R(ox + x, oy + y, n, 1, pal[ch]); x += n; } });
    return out;
  }

  // ================================================================== MERCHANTS
  // A bust is a head (headwear + face) on shoulders. Face rows are shared; headwear and body vary.
  // k outline, s skin, S skin shade, e eye, m mouth, H/h headwear + highlight, C/c/d clothes + highlight + shade, B beard/hair, g gold, w white.
  const FACE = ['ssssss', 'sesses', 'ssSSss', 'sSmmSs', 'sSSSSs'];
  const faceRows = (beard) => beard ? ['ssssss', 'sesses', 'sBBBBs', 'BBmmBB', 'sBBBBs'] : FACE;
  const HEAD = {
    hood: (f) => ['kkkkkkkk', 'kHHHHHHHHk', 'kHHhhHHHHHHk', 'kHkkkkkkkkHk', 'kHk' + f[0] + 'kHk', 'kHk' + f[1] + 'kHk', 'kHk' + f[2] + 'kHk', 'kHk' + f[3] + 'kHk', 'kk' + 'k' + f[4] + 'kkk'],
    hat: (f) => ['kkkk', 'kHHHHk', 'kHhhHHk', 'kkkkkkkkkkkkkk', 'kHHHHHHHHHHHHk', 'kkkk' + f[0] + 'kkkk', 'kBk' + f[1] + 'kBk', 'kk' + 'k' + f[2] + 'kkk', 'kk' + 'k' + f[3] + 'kkk'].map((r, i) => i === 8 ? 'kk' + 'k' + f[3] + 'kkk' : r),
    cap: (f) => ['kkkkkk', 'kHHHHHHk', 'kHhhHHHHk', 'kHHHHHHHHk', 'kk' + f[0] + 'kk', 'ksk' + f[1] + 'ksk', 'kk' + 'k' + f[2] + 'kkk', 'kk' + 'k' + f[3] + 'kkk', 'kk' + 'k' + f[4] + 'kkk'],
    wiz: (f) => ['gk', 'kHHk', 'kHhHHk', 'kHHHHHHk', 'kkkkkkkkkkkk', 'kHkk' + f[0] + 'kkHk', 'kBk' + f[1] + 'kBk', 'kBBk' + f[2] + 'kBBk', 'kBBBk' + f[3] + 'kBBBk'].map((r) => r),
  };
  const BODY = {
    robe: ['kCCCCCsCCCCCCk', 'kCcCCCCCCCCcCk', 'kCCCCCcCCCCCCk', 'kdCCCCCCCCCCdk', 'kddCCCCCCCCddk', 'kkkkkkkkkkkkkk'],
    apron: ['kCCCCCsCCCCCCk', 'kCcCCwwwwCCcCk', 'kCCCwwwwwwCCCk', 'kdCCwwwwwwCCdk', 'kddCwwwwwwCddk', 'kkkkkkkkkkkkkk'],
    leather: ['kCCCCCsCCCCCCk', 'kCcCgCCCCgCcCk', 'kCCCCCCCCCCCCk', 'kdCCCCgggCCCdk', 'kddCCCCgCCCddk', 'kkkkkkkkkkkkkk'],
    plate: ['kCCCCCsCCCCCCk', 'kCccCCCCCCccCk', 'kCCCCCggCCCCCk', 'kdCCCCggCCCCdk', 'kddCCCCCCCCddk', 'kkkkkkkkkkkkkk'],
  };
  const PORTRAITS = {
    alchemist: { head: 'hood', body: 'robe', beard: false, pal: { H: '#2f7a4c', h: '#4fae74', C: '#2f6a46', c: '#4a9a68', d: '#1d4530' }, acc: 'potion' },
    blacksmith: { head: 'cap', body: 'apron', beard: true, pal: { H: '#4a4a52', h: '#6a6a74', B: '#4a2e18', C: '#6a4a2a', c: '#8a6a3c', d: '#3a2812', w: '#8a6a3c' }, acc: 'hammer' },
    mage: { head: 'wiz', body: 'robe', beard: true, pal: { H: '#6a3fb0', h: '#9a6ae0', B: '#e8e4f0', C: '#4a2f8a', c: '#6a4ab8', d: '#2f1f5a', g: '#ffd24a' }, acc: 'staff' },
    trader: { head: 'hat', body: 'leather', beard: true, pal: { H: '#a8702e', h: '#d09a4a', B: '#6a3f1c', C: '#7a4f2a', c: '#9a6a3a', d: '#4a2e16', g: '#e8c050' }, acc: 'pack' },
    animaltamer: { head: 'hat', body: 'leather', beard: false, pal: { H: '#7a8a3c', h: '#a8ba5a', B: '#7a4a22', C: '#4a6a3a', c: '#6a8a4a', d: '#2f4526', g: '#c9a84c' }, acc: 'bird' },
    fleshmancer: { head: 'hood', body: 'apron', beard: false, pal: { H: '#3a1418', h: '#6a2a30', C: '#4a1c20', c: '#6a2a30', d: '#2a0c10', w: '#c8b8a0', s: '#c9b8a8', S: '#9a8878', m: '#6a2a2a' }, acc: 'stitch' },
    bountyhunter: { head: 'hat', body: 'leather', beard: true, pal: { H: '#3a2c1c', h: '#5a4630', B: '#2a1c10', C: '#3a3028', c: '#5a4c3c', d: '#201810', g: '#c9a84c' }, acc: 'crossbow' },
    monstermangler: { head: 'cap', body: 'plate', beard: false, pal: { H: '#8a2a1a', h: '#c04a2a', C: '#5a5a62', c: '#8a8a94', d: '#3a3a42', g: '#e8963a' }, acc: 'goggles' },
  };
  const ACC = {
    potion: { rows: ['.kkk.', '.kgk.', 'kGGGk', 'kGgGk', 'kGGGk', '.kkk.'], pal: { G: '#7de88a', g: '#d8ffe0', k: '#14100c' }, x: 0, y: 9 },
    hammer: { rows: ['kkkkk', 'kHHHk', 'kHhHk', 'kkwkk', '..w..', '..w..'], pal: { H: '#8a8a94', h: '#c0c0cc', w: '#6a4a2a', k: '#14100c' }, x: 11, y: 8 },
    staff: { rows: ['.kk.', 'kPPk', 'kPpk', '.kk.', '.wk.', '.wk.', '.wk.'], pal: { P: '#7de7ff', p: '#e8ffff', w: '#7a4a22', k: '#14100c' }, x: 12, y: 7 },
    pack: { rows: ['.kkkk.', 'kPPPPk', 'kPppPk', 'kPPPPk', 'kkkkkk'], pal: { P: '#8a5a2a', p: '#c08a46', k: '#14100c' }, x: 0, y: 10 },
    bird: { rows: ['.kkk', 'kBBk', 'kBeBkk', 'kBBBYk', '.kkk'], pal: { B: '#d8a050', e: '#14100c', Y: '#ffd24a', k: '#14100c' }, x: 10, y: 8 },
    stitch: { rows: ['e.e.e'], pal: { e: '#14100c' }, x: 5, y: 5 },
    crossbow: { rows: ['k.....k', '.k...k.', '..kkk..', '..kwk..', '..kwk..'], pal: { w: '#8a5a2a', k: '#14100c' }, x: 5, y: 10 },
    goggles: { rows: ['kLLkkLLk'], pal: { L: '#7de7ff', k: '#14100c' }, x: 4, y: 4 },
  };
  function portraitBody(key) {
    const P = PORTRAITS[key]; if (!P) return '';
    const pal = Object.assign({ k: '#14100c', s: '#eebd8e', S: '#c88e60', e: '#1a1410', m: '#a0583a', g: '#e8c050', w: '#f0e8d4' }, P.pal);
    const rows = HEAD[P.head](faceRows(P.beard)).concat(BODY[P.body]);
    let svg = sprite(rows, pal, 16, 0, 1);
    const a = ACC[P.acc];
    if (a) svg += spriteAt(a.rows, Object.assign({}, a.pal), a.x, a.y);
    return svg;
  }
  function merchantPortrait(key, px) {
    const px2 = px || 56;
    return `<svg class="pixel-svg" viewBox="0 0 16 17" width="${px2}" height="${px2 * 17 / 16}" shape-rendering="crispEdges" style="image-rendering:pixelated;">${portraitBody(key)}</svg>`;
  }
  // The stall behind the merchant: a brick wall, shelves of goods and a counter, 48x24.
  const STALL_GOODS = {
    alchemist: (r) => [0, 1, 2, 3, 4].map(i => R(4 + i * 4 + (i > 2 ? 18 : 0), 6, 2, 3, ['#7de88a', '#e05a5a', '#6aa0ff', '#c47cf5', '#ffd24a'][i]) + R(5 + i * 4 + (i > 2 ? 18 : 0), 5, 0.01, 0.01, '#000')).join(''),
    blacksmith: () => R(5, 4, 1, 8, '#9a9aa4') + R(5, 3, 1, 1, '#c0c0cc') + R(8, 5, 4, 1, '#6a6a74') + R(37, 4, 6, 3, '#5a5a62') + R(36, 7, 8, 1, '#3a3a42'),
    mage: () => R(6, 4, 5, 6, '#5a2fa0') + R(7, 5, 3, 1, '#ffd24a') + R(36, 4, 3, 3, '#7de7ff') + R(37, 3, 1, 1, '#ffffff'),
    trader: () => R(5, 5, 4, 4, '#a8702e') + R(11, 6, 3, 3, '#8a5a2a') + R(35, 5, 3, 4, '#c08a46') + R(39, 6, 3, 3, '#a8702e'),
    animaltamer: () => R(5, 4, 5, 6, '#6a6a72') + R(6, 5, 1, 4, '#2a2a30') + R(8, 5, 1, 4, '#2a2a30') + R(37, 6, 5, 4, '#6a5028'),
    fleshmancer: () => R(5, 5, 3, 5, '#c8b8a0') + R(9, 6, 3, 4, '#8a1a1a') + R(37, 4, 4, 6, '#3a1418') + R(38, 5, 2, 1, '#c8b8a0'),
    bountyhunter: () => R(5, 4, 5, 6, '#e8dcc8') + R(6, 5, 3, 1, '#8a1a1a') + R(37, 5, 5, 4, '#c9a84c'),
    monstermangler: () => R(5, 5, 6, 4, '#5a5a62') + R(36, 4, 6, 6, '#8a2a1a') + R(37, 5, 4, 1, '#e8963a'),
  };
  function merchantStall(key, px) {
    const W = 48, H = 24, rnd = rng(key.length * 97 + 5);
    let bricks = R(0, 0, W, H, '#0e0b0c');
    for (let r = 0; r < 4; r++) for (let c = -1; c < 7; c++) { const x = c * 8 + (r % 2 ? 4 : 0); bricks += R(x + 1, r * 4 + 1, 6, 2, ['#1f1b1e', '#241f23', '#1a171b'][Math.floor(rnd() * 3)]) + R(x + 1, r * 4 + 1, 6, 1, '#2f292d'); }
    const shelf = R(2, 10, 44, 2, '#4a3218') + R(2, 10, 44, 1, '#6b4a30') + R(2, 11, 44, 1, '#2a1a10');
    const goods = (STALL_GOODS[key] || (() => ''))(rnd);
    const torch = [2, 44].map(x => R(x, 1, 2, 3, '#ff9d2a') + R(x, 2, 2, 1, '#ffd24a') + R(x, 4, 2, 4, '#5a3a1c')).join('');
    const counter = R(0, 18, W, 6, '#4a3218') + R(0, 18, W, 1, '#8a6238') + R(0, 19, W, 1, '#6b4a30') + R(0, 22, W, 2, '#2a1a10') + [4, 12, 20, 28, 36, 44].map(x => R(x, 20, 1, 2, '#3a2814')).join('');
    const body = `<g>${bricks}${shelf}${goods}${torch}</g><g transform="translate(16 2)">${portraitBody(key)}</g>${counter}`;
    const w = px || 192;
    return `<svg class="pixel-svg stall-svg" viewBox="0 0 ${W} ${H}" width="${w}" height="${w * H / W}" shape-rendering="crispEdges" style="image-rendering:pixelated;">${body}</svg>`;
  }


  // ================================================================== MAP BUILDER: terrain tiles, walls, doors
  // 16x16 tiles, drawn once per terrain and repeated by an SVG <pattern> per map (so cells stay cheap). Each tile has a base colour,
  // a light edge, a dark edge and a few seeded speckles so a field of the same terrain still reads as stone, not as a flat colour.
  const T = {};
  const speckle = (r, n, cols, w, h, maxw) => { let o = ''; for (let i = 0; i < n; i++) o += R(Math.floor(r() * (w - 1)), Math.floor(r() * (h - 1)), 1 + Math.floor(r() * (maxw || 2)), 1, cols[Math.floor(r() * cols.length)]); return o; };
  T.floor = () => { const r = rng(11); let o = R(0, 0, 16, 16, '#5d5040');            // mortar
    [[0, 0, 7, 7], [8, 0, 8, 7], [0, 8, 4, 8], [5, 8, 7, 8], [13, 8, 3, 8]].forEach(([x, y, w, h], i) => { const base = ['#8a7960', '#807058', '#928068'][i % 3];
      o += R(x + 1, y + 1, w - 1, h - 1, base) + R(x + 1, y + 1, w - 1, 1, '#a8967c') + R(x + 1, y + 1, 1, h - 1, '#a08e74') + R(x + 1, y + h - 1, w - 1, 1, '#6a5a46'); });
    return o + speckle(r, 10, ['#6e5e48', '#9a8870', '#7a6a52'], 16, 16, 1); };
  T.dirt = () => { const r = rng(21); return R(0, 0, 16, 16, '#6b4a30') + speckle(r, 26, ['#5a3d26', '#7d5a3b', '#4a3220', '#8a6644'], 16, 16, 2) + R(3, 4, 2, 1, '#8c8a86') + R(11, 10, 2, 2, '#7a7874') + R(11, 10, 2, 1, '#9c9a96'); };
  T.grass = () => { const r = rng(31); let o = R(0, 0, 16, 16, '#3f6b34') + speckle(r, 18, ['#355c2c', '#4a7a3e', '#2f5026'], 16, 16, 2);
    [[2, 3], [9, 2], [5, 9], [12, 12], [1, 13]].forEach(([x, y]) => { o += R(x, y, 1, 3, '#5a8f48') + R(x + 1, y + 1, 1, 2, '#6aa456') + R(x - 1, y + 1, 1, 2, '#2f5026'); }); return o; };
  T.water = () => { const r = rng(41); let o = R(0, 0, 16, 16, '#2b5470') + speckle(r, 12, ['#234a63', '#2f5d7a'], 16, 16, 3);
    [[1, 3, 5], [9, 7, 5], [3, 12, 6], [11, 1, 4]].forEach(([x, y, w]) => { o += R(x, y, w, 1, '#5a98bc') + R(x + 1, y + 1, w - 2, 1, '#3e7094'); }); return o; };
  T.wood = () => { const r = rng(51); let o = R(0, 0, 16, 16, '#7a5230');
    [0, 4, 8, 12].forEach((y, i) => { o += R(0, y, 16, 3, ['#7a5230', '#845a36', '#6e4a2a', '#7e5632'][i]) + R(0, y, 16, 1, '#966a40') + R(0, y + 3, 16, 1, '#3a2412'); });
    o += R(3, 1, 1, 1, '#2a1a0e') + R(12, 5, 1, 1, '#2a1a0e') + R(5, 9, 1, 1, '#2a1a0e') + R(10, 13, 1, 1, '#2a1a0e'); return o + speckle(r, 10, ['#5a3a1e', '#8e6238'], 16, 16, 3); };
  T.stone = () => { const r = rng(61); let o = R(0, 0, 16, 16, '#5a5a5e');
    [[0, 0, 8, 6], [8, 0, 8, 8], [0, 6, 6, 10], [6, 8, 10, 8]].forEach(([x, y, w, h], i) => { o += R(x, y, w, h, ['#6e6e72', '#78787c', '#66666a', '#707074'][i]) + R(x, y, w, 1, '#92929a') + R(x, y, 1, h, '#8a8a92') + R(x + w - 1, y, 1, h, '#42424a') + R(x, y + h - 1, w, 1, '#42424a'); });
    return o + speckle(r, 8, ['#4a4a50', '#8a8a90'], 16, 16, 2); };
  T.sand = () => { const r = rng(71); let o = R(0, 0, 16, 16, '#c9a86a') + speckle(r, 22, ['#dcc080', '#b89658', '#d2b072'], 16, 16, 2);
    [[1, 4, 6], [8, 9, 6], [3, 13, 5]].forEach(([x, y, w]) => { o += R(x, y, w, 1, '#b08c50') + R(x + 1, y - 1, w - 2, 1, '#e0c484'); }); return o; };
  T.lava = () => { const r = rng(81); let o = R(0, 0, 16, 16, '#3a120a');
    [[0, 3, 7, 3], [8, 1, 8, 4], [2, 9, 8, 4], [10, 10, 6, 5]].forEach(([x, y, w, h]) => { o += R(x, y, w, h, '#c8420e') + R(x + 1, y + 1, w - 2, h - 2, '#ff7a1a') + R(x + 2, y + 1, Math.max(1, w - 4), 1, '#ffd24a'); });
    return o + speckle(r, 8, ['#5a1a0a', '#2a0c06'], 16, 16, 2); };
  T.cobble = () => { const r = rng(91); let o = R(0, 0, 16, 16, '#3e362e');
    [[1, 1, 6, 4], [8, 1, 7, 5], [0, 6, 5, 4], [6, 7, 6, 4], [13, 7, 3, 4], [2, 11, 7, 4], [10, 12, 6, 3]].forEach(([x, y, w, h], i) => { o += R(x, y, w, h, ['#7a6e60', '#6e6256', '#84786a'][i % 3]) + R(x, y, w, 1, '#a09484') + R(x, y + h - 1, w, 1, '#544a3e'); });
    return o + speckle(r, 6, ['#5a5044'], 16, 16, 1); };
  T.carpet = () => { let o = R(0, 0, 16, 16, '#7a2a2a') + R(0, 0, 16, 1, '#c9a84c') + R(0, 15, 16, 1, '#c9a84c') + R(0, 0, 1, 16, '#c9a84c') + R(15, 0, 1, 16, '#c9a84c') + R(2, 2, 12, 12, '#8e3434');
    o += R(7, 3, 2, 2, '#c9a84c') + R(6, 5, 4, 2, '#c9a84c') + R(7, 7, 2, 2, '#e8c860') + R(6, 9, 4, 2, '#c9a84c') + R(7, 11, 2, 2, '#c9a84c'); return o + R(3, 3, 1, 1, '#a24040') + R(12, 12, 1, 1, '#a24040') + R(12, 3, 1, 1, '#a24040') + R(3, 12, 1, 1, '#a24040'); };
  T.moss = () => { const r = rng(101); let o = T.floor();
    [[1, 1, 5, 3], [9, 5, 6, 4], [2, 10, 6, 4]].forEach(([x, y, w, h]) => { o += R(x, y, w, h, '#3f6b34') + R(x + 1, y, w - 2, 1, '#5a9448') + R(x, y + h - 1, w, 1, '#2a4a22'); }); return o + speckle(r, 6, ['#2f5026'], 16, 16, 1); };
  T.ice = () => { const r = rng(111); let o = R(0, 0, 16, 16, '#86c0da') + speckle(r, 14, ['#a8d8ee', '#6aa8c8'], 16, 16, 3);
    o += R(2, 3, 5, 1, '#e8f8ff') + R(3, 4, 3, 1, '#c8ecf8') + R(9, 10, 5, 1, '#e8f8ff') + R(0, 8, 1, 6, '#5a96b8') + R(6, 13, 4, 1, '#5a96b8'); return o; };
  T.snow = () => { const r = rng(121); return R(0, 0, 16, 16, '#dfe9f2') + speckle(r, 18, ['#f8fcff', '#c0d0e0', '#ffffff'], 16, 16, 2) + R(3, 6, 4, 1, '#b4c6d8') + R(10, 12, 4, 1, '#b4c6d8'); };
  T.void = () => { const r = rng(131); return R(0, 0, 16, 16, '#15100b') + speckle(r, 4, ['#1c1610', '#100c08'], 16, 16, 2); };
  // extra terrains the Map Builder palette gains (key -> label + thumbnail colour)
  const TERRAIN = {
    lava: { label: 'Lava', color: '#c8420e' }, cobble: { label: 'Cobblestone', color: '#7a6e60' }, carpet: { label: 'Carpet', color: '#7a2a2a' },
    moss: { label: 'Mossy Floor', color: '#5a7a48' }, ice: { label: 'Ice', color: '#86c0da' }, snow: { label: 'Snow', color: '#dfe9f2' },
  };
  function terrainDefs(prefix, cellPx) {
    const k = cellPx / 16;
    return '<defs>' + Object.keys(T).map(key => `<pattern id="${prefix}-${key}" patternUnits="userSpaceOnUse" width="${cellPx}" height="${cellPx}"><g transform="scale(${k})">${T[key]()}</g></pattern>`).join('') + '</defs>';
  }
  const terrainFill = (prefix, key) => (T[key] ? `url(#${prefix}-${key})` : null);
  // A wall between two cells: dark outline, stone body, brick joints and a lit top edge. (x1,y1)-(x2,y2) in pixels, horizontal or vertical.
  function wallSvg(x1, y1, x2, y2, cellPx) {
    const t = Math.max(6, Math.round(cellPx * .42)), brick = Math.max(4, Math.round(cellPx * .3));
    const line = (w, c, extra) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}"${extra || ''} shape-rendering="crispEdges"/>`;
    return line(t + 4, '#0a0706') + line(t + 2, '#2a2420') + line(t - 1, '#7a6e5c') + line(Math.max(1, t - 4), '#968a76', '') + `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4a4036" stroke-width="${Math.max(1, t - 1)}" stroke-dasharray="1 ${brick}" shape-rendering="crispEdges"/>` + line(1, '#d2c8b4');
  }
  // A door in a wall: wooden slab with iron bands and a stud, set into the wall line between 1/3 and 2/3.
  function doorSvg(x1, y1, x2, y2, cellPx) {
    const t = Math.max(8, Math.round(cellPx * .48));
    const lx = (a, b, f) => a + (b - a) * f;
    const ax = lx(x1, x2, .3), ay = lx(y1, y2, .3), bx = lx(x1, x2, .7), by = lx(y1, y2, .7);
    const L = (w, c, f1, f2) => `<line x1="${lx(ax, bx, f1)}" y1="${lx(ay, by, f1)}" x2="${lx(ax, bx, f2)}" y2="${lx(ay, by, f2)}" stroke="${c}" stroke-width="${w}" shape-rendering="crispEdges"/>`;
    return L(t + 2, '#0e0a08', 0, 1) + L(t, '#7a4a22', 0, 1) + L(t - 3, '#9a6a36', 0, 1) + L(t, '#3a3a42', .08, .14) + L(t, '#3a3a42', .86, .92) + L(3, '#e8c050', .48, .52);
  }
  // swatch sheet used by the contact-sheet test
  // a 16x16 tile as a data-URI image, for the palette buttons
  const terrainSwatch = key => T[key] ? 'url("data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">' + T[key]() + '</svg>') + '")' : null;
  function terrainSheet() { return `<svg width="900" height="180">${terrainDefs('ts', 48)}${Object.keys(T).map((k, i) => `<rect x="${i * 56}" y="10" width="48" height="48" fill="url(#ts-${k})"/>`).join('')}${wallSvg(10, 100, 300, 100, 48)}${doorSvg(320, 100, 520, 100, 48)}</svg>`; }


  // ================================================================== JOURNEY: scene backdrops (64x40) and event glyphs (24x24)
  const FB = ' style="transform-box:fill-box;transform-origin:center"';
  // dithered vertical gradient: horizontal bands of `cols`, with a checkerboard row where two bands meet
  function sky(cols, h, w) {
    w = w || 64; let o = ''; const bh = h / cols.length;
    cols.forEach((c, i) => { const y0 = Math.round(i * bh), y1 = Math.round((i + 1) * bh); o += R(0, y0, w, y1 - y0, c);
      if (i < cols.length - 1) { const nc = cols[i + 1]; for (let x = 0; x < w; x += 2) o += R(x + (y1 % 2), y1 - 1, 1, 1, nc); } });
    return o;
  }
  // stepped (pixel) triangle: apex at (cx, baseY - hgt), widening by `slope` per row, light left edge, shaded right edge
  function peak(cx, baseY, hgt, slope, c, hi, lo, cap, capH) {
    let o = '';
    for (let i = 0; i < hgt; i++) { const half = Math.round((i + 1) * slope), y = baseY - hgt + i, x = cx - half, w = half * 2 + 1;
      o += R(x, y, w, 1, c); if (hi) o += R(x, y, Math.min(2, w), 1, hi); if (lo) o += R(x + w - Math.min(3, Math.ceil(w / 4)), y, Math.min(3, Math.ceil(w / 4)), 1, lo);
      if (cap && i < (capH || 4)) o += R(x + (i < 2 ? 0 : 1), y, w - (i < 2 ? 0 : 2), 1, cap); }
    return o;
  }
  const pine = (x, by, h, c, hi, trunk) => { let o = R(x, by - 2, 2, 2, trunk || '#2a1a10'); for (let i = 0; i < h; i++) { const y = by - 2 - i * 1; const w = Math.max(1, Math.round((h - i) * 0.9) + 1); o += R(x + 1 - Math.floor(w / 2), y - 1, w, 1, i % 3 === 2 ? hi : c); } return o; };
  const cloudPx = (x, y, c, sh) => R(x + 2, y, 6, 1, c) + R(x, y + 1, 11, 2, c) + R(x + 1, y + 3, 9, 1, sh || c);
  const win = (x, y, on) => R(x, y, 2, 2, on ? '#ffd24a' : '#1a1620') + (on ? R(x, y, 2, 1, '#fff0a0') : '');
  const SCENES = {
    countryside: (a) => {
      let o = sky(['#5a3a78', '#8a4a7a', '#c8607a', '#f08a5a', '#ffb870'], 26);
      o += R(46, 14, 6, 6, '#ffe08a') + R(47, 13, 4, 1, '#ffe08a') + R(47, 20, 4, 1, '#ffe08a') + R(48, 15, 2, 2, '#fff6c8');
      o += `<g class="journey-anim-cloud">${cloudPx(6, 5, '#e8a0b0', '#c87898')}</g><g class="journey-anim-cloud" style="animation-delay:-4s">${cloudPx(34, 9, '#f0b0a0', '#d08a88')}</g>`;
      o += peak(14, 28, 12, 1.8, '#6a4a7a', '#8a6a9a', '#4a2f5a') + peak(50, 28, 9, 2.2, '#6a4a7a', '#8a6a9a', '#4a2f5a');
      o += R(0, 26, 64, 14, '#4a7a3a') + R(0, 26, 64, 1, '#7ab050');
      for (let x = 0; x < 64; x += 3) o += R(x, 27 + (x % 4 === 0 ? 1 : 0), 1, 1, '#5e9448');
      o += R(0, 33, 64, 7, '#6a5030') + R(0, 33, 64, 1, '#8a6c44') + R(0, 36, 64, 1, '#563e24'); for (let x = 2; x < 64; x += 7) o += R(x, 36, 3, 1, '#7a5e3a');
      o += R(44, 17, 4, 10, '#8a6a4a') + R(44, 17, 1, 10, '#a88a64') + R(47, 17, 1, 10, '#5a4028') + R(45, 22, 2, 5, '#3a2818') + R(44, 16, 4, 1, '#5a4028');
      o += `<g class="journey-anim-windmill" style="transform-origin:46px 15px;">${R(45, 8, 2, 7, '#e8dcc8')}${R(45, 16, 2, 6, '#e8dcc8')}${R(39, 14, 6, 2, '#e8dcc8')}${R(47, 14, 6, 2, '#e8dcc8')}${R(45, 14, 2, 2, '#6a4a30')}${R(45, 8, 1, 7, '#fff4dc')}</g>`;
      o += R(8, 28, 12, 7, '#a86a4a') + R(8, 28, 12, 1, '#c88a64') + R(8, 34, 12, 1, '#7a4a30') + peak(14, 28, 5, 1.9, '#7a3a2a', '#a05a40', '#5a2a1e') + win(10, 30, true) + R(15, 30, 3, 5, '#3a2818') + R(17, 32, 1, 1, '#e8c050');
      o += R(24, 31, 1, 4, '#5a4028') + R(28, 31, 1, 4, '#5a4028') + R(32, 31, 1, 4, '#5a4028') + R(24, 32, 9, 1, '#7a5e3a') + R(24, 34, 9, 1, '#7a5e3a');
      return o;
    },
    forest: (a) => {
      let o = sky(['#0e1a2a', '#14283a', '#1c3a3a', '#24483a'], 24);
      o += R(8, 5, 5, 5, '#e8e8c8') + R(9, 4, 3, 1, '#e8e8c8') + R(9, 10, 3, 1, '#e8e8c8') + R(10, 6, 2, 2, '#c8c8a0');
      [[3, 8, 10], [18, 6, 13], [33, 9, 9], [47, 7, 12], [58, 10, 9]].forEach(([x, h, w], i) => { o += pine(x + 4, 26, h + 6, '#1a3a2c', '#24503a', '#1a1410'); });
      o += R(0, 24, 64, 16, '#1c3224') + R(0, 24, 64, 1, '#2c4a34');
      [[6, 36, 14], [24, 36, 17], [42, 36, 15], [55, 36, 12]].forEach(([x, by, h]) => { o += R(x, by - h, 3, h, '#2a1c12') + R(x, by - h, 1, h, '#4a3220') + pine(x + 1, by - h + 4, 14, '#12281c', '#1c3a2a', '#12281c'); });
      for (let x = 1; x < 64; x += 5) o += R(x, 37 + (x % 3), 2, 2, '#2f5a38') + R(x, 37 + (x % 3), 2, 1, '#4a8a50');
      o += R(0, 38, 64, 2, '#12201a');
      [[16, 20], [34, 16], [45, 24], [24, 27], [54, 19]].forEach(([x, y], i) => { o += `<g class="journey-anim-firefly" style="animation-delay:-${(i * 0.6).toFixed(1)}s">${R(x, y, 1, 1, '#f0f070')}${R(x - 1, y, 1, 1, 'rgba(240,240,112,.35)')}${R(x + 1, y, 1, 1, 'rgba(240,240,112,.35)')}</g>`; });
      return o;
    },
    mountains: (a) => {
      let o = sky(['#2a2a5a', '#4a4a8a', '#8a6aa0', '#d88a9a', '#f4b08a'], 28);
      o += `<g class="journey-anim-cloud" style="animation-duration:14s">${cloudPx(4, 6, '#d8a0b8', '#b880a0')}</g><g class="journey-anim-cloud" style="animation-duration:16s;animation-delay:-5s">${cloudPx(40, 4, '#e8b0b8', '#c890a8')}</g>`;
      o += peak(10, 34, 20, 1.15, '#5a5a8a', '#7a7aaa', '#3a3a62', '#f0f4ff', 6) + peak(32, 34, 28, 1.05, '#4a4a78', '#6a6a9a', '#2e2e52', '#f8fbff', 8) + peak(54, 34, 22, 1.2, '#5a5a8a', '#7a7aaa', '#3a3a62', '#f0f4ff', 6);
      o += R(0, 33, 64, 7, '#2a3a2a') + R(0, 33, 64, 1, '#3a5a3a');
      [[3, 14], [10, 11], [49, 12], [57, 15], [60, 10]].forEach(([x, h]) => { o += pine(x, 38, h, '#183a24', '#245a34'); });
      o += R(0, 38, 64, 2, '#10201a');
      return o;
    },
    swamp: (a) => {
      let o = sky(['#243228', '#2e4234', '#3a5240', '#4a6650'], 22);
      o += `<g class="journey-anim-fog">${R(-10, 18, 40, 3, 'rgba(200,220,200,.22)')}</g><g class="journey-anim-fog" style="animation-delay:-6s;animation-direction:reverse">${R(34, 22, 40, 3, 'rgba(200,220,200,.18)')}</g>`;
      [[10, 24, 16], [30, 24, 20], [50, 24, 14]].forEach(([x, by, h]) => { o += R(x, by - h, 2, h, '#1a1612') + R(x - 4, by - h + 3, 5, 1, '#1a1612') + R(x + 2, by - h + 6, 5, 1, '#1a1612') + R(x - 3, by - h + 2, 1, 2, '#1a1612') + R(x + 6, by - h + 5, 1, 2, '#1a1612'); });
      o += R(0, 24, 64, 16, '#1e3028') + R(0, 24, 64, 1, '#4a6a54');
      for (let y = 26; y < 40; y += 3) for (let x = (y % 2) * 3; x < 64; x += 7) o += R(x, y, 4, 1, '#2e4a3a');
      o += R(0, 30, 14, 3, '#3a4a2a') + R(0, 30, 14, 1, '#5a7a3a') + R(46, 33, 18, 3, '#3a4a2a') + R(46, 33, 18, 1, '#5a7a3a');
      [[8, 28], [58, 31]].forEach(([x, y]) => { o += R(x, y - 5, 1, 5, '#5a4028') + R(x, y - 7, 1, 2, '#3a2418') + R(x - 1, y - 8, 3, 1, '#3a2418'); });
      [[20, 34], [40, 32], [52, 36]].forEach(([x, y], i) => { o += `<g class="journey-anim-bubble" style="animation-delay:-${(i * 1.3).toFixed(1)}s">${R(x, y, 1, 1, '#8ab08a')}${R(x, y - 1, 1, 1, '#b8d8b8')}</g>`; });
      o += `<g class="journey-anim-firefly" style="animation-delay:-0.7s">${R(24, 22, 1, 1, '#a8f0a8')}${R(23, 22, 1, 1, 'rgba(168,240,168,.35)')}</g><g class="journey-anim-firefly" style="animation-delay:-1.9s">${R(44, 26, 1, 1, '#a8f0a8')}</g>`;
      return o;
    },
    desert: (a) => {
      let o = sky(['#a84a3a', '#d8703a', '#f0a050', '#f8c878', '#fce0a0'], 26);
      o += `<g class="journey-anim-sun"${FB}>${R(48, 8, 8, 8, '#ffe070')}${R(49, 7, 6, 1, '#ffe070')}${R(49, 16, 6, 1, '#ffe070')}${R(50, 9, 3, 3, '#fff8d0')}</g>`;
      o += R(14, 16, 2, 1, '#8a5a3a') + peak(18, 28, 10, 1, '#b0683a', '#d08a50', '#8a4a2a') + R(9, 27, 18, 1, '#8a4a2a');
      o += R(0, 24, 64, 16, '#e0a860'); o += `<g class="journey-anim-shimmer">${R(0, 24, 64, 3, 'rgba(255,255,255,.10)')}</g>`;
      o += peak(14, 40, 14, 3.4, '#d89a50', '#f0b868', '#b87a38') + peak(46, 40, 11, 4.4, '#c98a44', '#e8a85c', '#a86a30');
      for (let x = 2; x < 64; x += 4) o += R(x, 31 + (x % 5), 2, 1, '#e8b870');
      o += R(56, 30, 2, 8, '#3a6a3a') + R(54, 32, 2, 1, '#3a6a3a') + R(54, 31, 1, 2, '#3a6a3a') + R(58, 34, 2, 1, '#3a6a3a') + R(59, 33, 1, 2, '#3a6a3a') + R(56, 30, 1, 8, '#5a9a52');
      o += R(5, 36, 3, 2, '#e8e0c8') + R(4, 37, 1, 1, '#e8e0c8') + R(7, 38, 2, 1, '#c8c0a8');
      return o;
    },
    city: (a) => {
      let o = sky(['#0e1228', '#1a2040', '#2e3258', '#4a4470'], 24);
      [[4, 3], [14, 8], [26, 4], [40, 6], [52, 3], [58, 9]].forEach(([x, y]) => { o += R(x, y, 1, 1, '#f0f0ff'); });
      o += R(50, 4, 5, 5, '#f0ecd0') + R(51, 3, 3, 1, '#f0ecd0') + R(51, 9, 3, 1, '#f0ecd0') + R(52, 5, 2, 2, '#d0c8a8');
      o += `<g class="journey-anim-cloud">${cloudPx(8, 6, '#3a3a60', '#2e2e50')}</g>`;
      const bld = (x, y, w, h, c, hi, roof) => R(x, y, w, h, c) + R(x, y, 1, h, hi) + R(x + w - 1, y, 1, h, '#12101c') + (roof ? peak(x + Math.floor(w / 2), y, Math.ceil(w / 2) + 1, 1, roof[0], roof[1], roof[2]) : '');
      o += bld(2, 16, 10, 16, '#3a3248', '#5a4e6a', ['#241a2a', '#3a2e44', '#150f1a']) + bld(14, 20, 8, 12, '#46384c', '#66566e', ['#2e1e2a', '#4a3844', '#1a1018']);
      o += bld(25, 10, 12, 22, '#322a40', '#524862') + R(24, 8, 14, 2, '#241a2a') + R(26, 6, 2, 2, '#241a2a') + R(30, 6, 2, 2, '#241a2a') + R(34, 6, 2, 2, '#241a2a') + R(31, 0, 1, 6, '#2a2018') + R(32, 0, 4, 3, '#a02020');
      o += bld(40, 17, 9, 15, '#3a3248', '#5a4e6a', ['#241a2a', '#3a2e44', '#150f1a']) + bld(51, 13, 11, 19, '#46384c', '#66566e', ['#2e1e2a', '#4a3844', '#1a1018']);
      [[5, 19], [8, 19], [5, 24], [16, 23], [28, 13], [32, 17], [28, 22], [32, 26], [43, 21], [54, 17], [58, 17], [54, 23]].forEach(([x, y], i) => { o += win(x, y, (i * 7) % 5 !== 0); });
      o += R(0, 32, 64, 8, '#4a4044') + R(0, 32, 64, 1, '#6a5e60'); for (let x = 0; x < 64; x += 6) o += R(x + (x % 12 ? 2 : 0), 35, 4, 1, '#5e5256') + R(x, 38, 4, 1, '#3a3034');
      [[20, 34], [46, 34]].forEach(([x, y], i) => { o += R(x, y - 6, 1, 6, '#3a2a1c') + `<g class="journey-anim-torch-flame"${FB} style="animation-delay:-${i * 0.3}s">${R(x - 1, y - 9, 3, 3, '#ff9d2a')}${R(x, y - 10, 1, 1, '#ffd24a')}${R(x, y - 8, 1, 2, '#fff0a0')}</g>`; });
      return o;
    },
    underground: (a) => {
      let o = R(0, 0, 64, 40, '#0c0a10');
      for (let y = 0; y < 40; y += 4) for (let x = (y % 8) * 2; x < 64; x += 16) o += R(x, y, 6, 2, '#14111a') + R(x, y, 6, 1, '#1e1a26');
      [[2, 12], [12, 8], [22, 14], [34, 9], [44, 13], [56, 10]].forEach(([x, h]) => { for (let i = 0; i < h; i++) { const w = Math.max(1, Math.round((h - i) / 2.2)); o += R(x - Math.floor(w / 2), i, w, 1, '#2c2834') + R(x - Math.floor(w / 2), i, 1, 1, '#44404e') + R(x - Math.floor(w / 2) + w - 1, i, 1, 1, '#1a1620'); } });
      o += R(0, 0, 64, 2, '#1e1a26');
      o += R(0, 34, 64, 6, '#1c1820') + R(0, 34, 64, 1, '#3a3442'); for (let x = 1; x < 64; x += 5) o += R(x, 36 + (x % 3), 3, 1, '#2a2630');
      o += R(10, 30, 16, 4, '#162a3a') + R(10, 30, 16, 1, '#2e5a74') + R(12, 31, 4, 1, '#4a86a8') + R(18, 32, 5, 1, '#3a6a88');
      [[12, 26], [50, 26]].forEach(([x, y], i) => { o += R(x, y - 2, 2, 10, '#4a3826') + R(x, y - 2, 1, 10, '#6a5238') + R(x - 1, y - 4, 4, 2, '#3a3a42') + `<g class="journey-anim-torch-flame"${FB} style="animation-delay:-${i * 0.4}s">${R(x - 1, y - 8, 4, 4, '#ff7a1a')}${R(x, y - 10, 2, 2, '#ff9d2a')}${R(x, y - 8, 2, 3, '#ffd24a')}</g>`; });
      [[34, 33], [40, 34], [44, 33]].forEach(([x, y], i) => { o += R(x, y - 2, 1, 2, '#c8b890') + R(x - 1, y - 4, 3, 2, ['#7de7ff', '#c47cf5', '#7de8a0'][i]) + R(x, y - 4, 1, 1, '#ffffff'); });
      return o;
    },
  };
  function journeyBackdrop(key, animated) {
    const cls = animated ? '' : ' journey-thumb';
    const fn = SCENES[key] || SCENES.underground;
    return `<svg class="journey-scene${cls}" viewBox="0 0 64 40" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">${fn(animated)}</svg>`;
  }
  // 24x24 glyphs shown over the stage after a roll. Outlined and shaded; animation classes are the app's existing ones.
  const OV_PAL = { k: '#14100c', w: '#f0eadc', g: '#a0a8b0', G: '#6a7078', y: '#ffd24a', Y: '#c98a1e', r: '#e05252', R: '#8a1a1a', b: '#5b9cf6', B: '#2e5aa8', p: '#c47cf5', P: '#6a3fa0', c: '#7de7ff', C: '#2e8aa8', n: '#7a4a22', N: '#4a2e14', o: '#ff9d2a' };
  const OV = {
    combat: { cls: 'journey-anim-shake', rows: ['k..............k', 'kk............kk', '.kk..........kk.', '..kk........kk..', '...kwk......kwk...'.slice(0, 14), '....kwk....kwk.', '.....kwk..kwk..', '......kwkkwk...', '.......kwwk....', '......kyykk....', '.....kyYk.kk...', '....knyk..kk...', '...knk.........'].map(r => r) },
  };
  const glyph = (rows, pal, cls) => `<svg class="journey-overlay-svg ${cls || ''}" viewBox="0 0 24 24" shape-rendering="crispEdges">${sprite(rows, pal, 24, 0, 4)}</svg>`;
  const OVERLAYS = {
    combat: () => glyph(['kk..........kk', 'kwk........kwk', '.kwk......kwk.', '..kwk....kwk..', '...kwk..kwk...', '....kwkkwk....', '.....kwwk.....', '....kkyykk....', '...kyYkkYyk...', '....kkk.kkk...', '...knk...knk..', '..knk.....knk.'], OV_PAL, 'journey-anim-shake'),
    social: () => glyph(['.kkkkkkkkkkkkk.', 'kwwwwwwwwwwwwwk', 'kwkkwwkkwwkkwwk', 'kwkkwwkkwwkkwwk', 'kwwwwwwwwwwwwwk', '.kkkkwwkkkkkkk.', '....kwkk.......', '.....kk........'], Object.assign({}, OV_PAL), 'journey-anim-bob'),
    weather: () => `<svg class="journey-overlay-svg" viewBox="0 0 24 24" shape-rendering="crispEdges">${sprite(['..kkkkk.....', '.kggggggk.kk', 'kggwwggggkgk', 'kgggggggggGk', '.kGGGGGGGGk.', '..kkkkkkkk..'], OV_PAL, 24, 0, 3)}${[6, 11, 16].map((x, i) => `<g class="journey-anim-rain" style="animation-delay:-${(i * 0.3).toFixed(1)}s">${R(x, 12, 1, 3, '#5b9cf6')}${R(x, 12, 1, 1, '#a8d0ff')}</g>`).join('')}</svg>`,
    strange: () => glyph(['....kkkkkkkk....', '..kkppppppppkk..', '.kppppkkkkpppk..', 'kppppkcckkppppk.', 'kppppkcckkppppk.', '.kppppkkkkpppk..', '..kkppppppppkk..', '....kkkkkkkk....'].map(r => r.slice(0, 14)), Object.assign({}, OV_PAL), 'journey-anim-pulse'),
    divine: () => glyph(['.....kyk.....', '.....kyk.....', '..k..kyk..k..', '...kkyyykk...', 'kkyyyoooyykk', 'kyyoooooyyyk', 'kkyyyoooyykk', '...kkyyykk...', '..k..kyk..k..', '.....kyk.....', '.....kyk.....'].map(r => r.slice(0, 13)), OV_PAL, 'journey-anim-pulse'),
    hazard: () => glyph(['.....kk.....', '....kyyk....', '....kyyk....', '...kyykyk...', '...kyykyk...', '..kyyykyyk..', '..kyyyyyyk..', '.kyykkkkyyk.', '.kyyykkyyyk.', 'kyyyyyyyyyyk', 'kkkkkkkkkkkk'].map(r => r.slice(0, 12)), OV_PAL, 'journey-anim-flicker'),
    discovery: () => glyph(['.....kk.....', '....kwck....', '...kwcccck..', '..kwccCcck..', '.kwcccCCcck.', '.kwccCCCcck.', '..kkccCCckk.', '....kkCCk...', '.....kkk....'].map(r => r.slice(0, 12)), OV_PAL, 'journey-anim-twinkle'),
    calm: () => glyph(['...kkkk.....', '..kwwwwk.kk.', '.kwwwwwwkwwk', 'kwwwwwwwwwwk', '.kgggggggggk', '..kkkkkkkk..'], OV_PAL, 'journey-anim-cloud-drift'),
  };
  const journeyOverlay = key => (OVERLAYS[key] || OVERLAYS.calm)();

  window.RetroArt = window.RetroArt || {};
  Object.assign(window.RetroArt, { TERRAIN, terrainDefs, terrainFill, wallSvg, doorSvg, terrainSheet, terrainSwatch, journeyBackdrop, journeyOverlay });

  window.RetroArt = Object.assign(window.RetroArt || {}, { R, rng, sprite, spriteAt, merchantPortrait, merchantStall, MERCHANT_KEYS: Object.keys(PORTRAITS) });
})();
