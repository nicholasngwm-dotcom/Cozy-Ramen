'use strict';
/* The Ramen Road: a hand-drawn pixel map, five screens wide, that the level progression travels along.
   The scenery is painted once into a big off-screen canvas (sky, mountains, the five regions, the road); each frame
   blits the visible slice and adds what moves: clouds, falling petals, water shimmer, lantern glow, neon, waves,
   boats, the stop markers and a little ramen cart that rolls along the road to whichever stop you pick.
   Progress rules live in data.js (STOPS, stopDone, stopReady...); claiming and moving the shop go through hooks. */
const JOURNEY = (() => {
  const { rect, dot, ell, poly, line, mix, shade, textC, textW } = PX;
  const DK = PX.OUTLINE, rnd = SCENE.rnd;
  const RW = VW, MW = REGIONS.length * RW, MH = VH;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const $ = id => document.getElementById(id);
  let hooks = { claim: () => {}, setRegion: () => {}, close: () => {}, sound: () => {} };

  /* ---------- palettes: one per region, blended across the borders ---------- */
  const PAL = [
    { skyT: '#8cc4ea', skyB: '#ffe4ee', far: '#8e9cc4', far2: '#a9b6d6', gr: '#8cc05a', gr2: '#7aae4c', road: '#d2ad74', roadE: '#7a5a34', roadD: '#b48c58' },  // spring morning
    { skyT: '#e8a868', skyB: '#fbe2ae', far: '#7e6a62', far2: '#9a8474', gr: '#6e9a4a', gr2: '#5e8a3e', road: '#bdb7a8', roadE: '#5e5a52', roadD: '#9a9488' },  // golden afternoon, stone
    { skyT: '#5a3a7a', skyB: '#f2925a', far: '#584a6a', far2: '#765a78', gr: '#a08e78', gr2: '#907e6a', road: '#c8ae86', roadE: '#5e4a38', roadD: '#a8906c' },  // dusk, cobbles
    { skyT: '#0c1030', skyB: '#2c2a5c', far: '#181a38', far2: '#22244a', gr: '#3a3a4c', gr2: '#323244', road: '#4a4a58', roadE: '#16161e', roadD: '#e8e8dc' },  // night, asphalt
    { skyT: '#ee7a5e', skyB: '#ffd48c', far: '#7a6a8c', far2: '#9a7a8c', gr: '#e6cf98', gr2: '#d8bc82', road: '#bc9a6e', roadE: '#6e5236', roadD: '#9a7a52' }   // sunset, sand
  ];
  function pal(x, key) {
    const f = clamp(x / RW, 0, REGIONS.length - 0.001), r = Math.floor(f), off = x - r * RW;
    if (off > RW - 90 && r < REGIONS.length - 1) return mix(PAL[r][key], PAL[r + 1][key], (off - (RW - 90)) / 180);
    if (off < 90 && r > 0) return mix(PAL[r - 1][key], PAL[r][key], 0.5 + off / 180);
    return PAL[r][key];
  }
  const horizon = x => Math.round(232 + Math.sin(x * 0.004) * 10 + Math.sin(x * 0.011) * 5);

  /* ---------- the road: a Catmull-Rom curve through every stop ---------- */
  // a region's stops are spread evenly across it, alternating low and high along the road
  const slot = (k, n) => [Math.round(140 + k * (700 / Math.max(1, n - 1))), k % 2 ? 322 : 412];
  const YOFF = [[0, 0, 0, 0, 0], [-10, 16, -14, 10, -6], [8, -8, 10, -12, 6], [-6, 12, -10, 8, -4], [10, -12, 4, 6, -8]];
  const yoff = (r, k) => (YOFF[r][k] !== undefined ? YOFF[r][k] : [6, -10, 12, -6, 8, -12][k % 6]);   // regions with more stops than the table
  const POS = STOPS.map((s, i) => { const r = s.region, k = STOPS.filter((t, j) => j < i && t.region === r).length, n = STOPS.filter(t => t.region === r).length, sl = slot(k, n); return { x: r * RW + sl[0], y: sl[1] + yoff(r, k) }; });
  const CTRL = [{ x: -30, y: 440 }];
  POS.forEach((p, i) => { if (i) { const q = POS[i - 1]; CTRL.push({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 + (i % 2 ? 46 : -46) }); } CTRL.push(p); });
  CTRL.push({ x: MW + 30, y: 360 });
  const PATH = [], NODE_S = [];
  (function sample() {
    let s = 0, prev = null;
    for (let i = 0; i < CTRL.length - 1; i++) {
      const p0 = CTRL[Math.max(0, i - 1)], p1 = CTRL[i], p2 = CTRL[i + 1], p3 = CTRL[Math.min(CTRL.length - 1, i + 2)];
      const n = Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 3);
      for (let j = 0; j < n; j++) {
        const t = j / n, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        const pt = { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) };
        if (prev) s += Math.hypot(pt.x - prev.x, pt.y - prev.y);
        pt.s = s; PATH.push(pt); prev = pt;
        if (j === 0) { const k = POS.indexOf(p1); if (k >= 0) NODE_S[k] = s; }
      }
    }
  })();
  function at(s) {   // point on the road at arc length s, with its direction
    let lo = 0, hi = PATH.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (PATH[m].s < s) lo = m; else hi = m; }
    const a = PATH[lo], b = PATH[hi], t = b.s > a.s ? clamp((s - a.s) / (b.s - a.s), 0, 1) : 0;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: b.x - a.x, dy: b.y - a.y };
  }
  // A coarse grid of cells the road passes near, so scenery is never planted on it.
  const CELL = 12, GW = Math.ceil(MW / CELL), GH = Math.ceil(MH / CELL), busy = new Uint8Array(GW * GH);
  function mark(x, y, r) { for (let gy = Math.max(0, Math.floor((y - r) / CELL)); gy <= Math.min(GH - 1, Math.floor((y + r) / CELL)); gy++) for (let gx = Math.max(0, Math.floor((x - r) / CELL)); gx <= Math.min(GW - 1, Math.floor((x + r) / CELL)); gx++) busy[gy * GW + gx] = 1; }
  for (let i = 0; i < PATH.length; i += 4) mark(PATH[i].x, PATH[i].y, 30);
  POS.forEach(p => mark(p.x, p.y, 36));
  const free = (x, y, r = 14) => { for (let gy = Math.floor((y - r) / CELL); gy <= Math.floor((y + r) / CELL); gy++) for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++) { if (gx < 0 || gy < 0 || gx >= GW || gy >= GH || busy[gy * GW + gx]) return false; } return true; };
  const claimSpot = (x, y, r) => { mark(x, y, r); };

  /* ---------- what moves, recorded while painting ---------- */
  const WATER = [], LANTERNS = [], NEON = [], LAMPS = [];

  /* ---------- painting the map ---------- */
  let map = null;
  function paint() {
    map = document.createElement('canvas'); map.width = MW; map.height = MH;
    const g = map.getContext('2d'); g.imageSmoothingEnabled = false;
    sky(g); mountains(g); ground(g);
    sakura(g); kyoto(g); osaka(g); tokyo(g); coast(g);
    road(g);
    overRoad(g);
  }
  function sky(g) {
    for (let x = 0; x < MW; x += 4) {
      const hz = horizon(x), top = pal(x, 'skyT'), bot = pal(x, 'skyB');
      for (let i = 0; i < 12; i++) rect(g, x, Math.floor(i * hz / 12), 4, Math.ceil(hz / 12) + 1, mix(top, bot, i / 11));
    }
    for (let i = 0; i < 160; i++) { const x = 2880 + rnd(i) * 960, y = rnd(i + 99) * 170; dot(g, Math.round(x), Math.round(y), rnd(i + 7) > 0.7 ? '#fff6d0' : '#a8b0e0'); }   // Tokyo stars
    const sx = 4430, sy = horizon(4430) - 26;   // the setting sun over the coast
    for (let r = 46; r > 0; r -= 6) { g.globalAlpha = 0.12; ell(g, sx, sy, r + 18, r + 18, '#fff0a0'); }
    g.globalAlpha = 1; ell(g, sx, sy, 28, 28, '#ffb050'); ell(g, sx, sy, 24, 24, '#ffd070'); ell(g, sx - 5, sy - 6, 12, 10, '#fff0b0');
    ell(g, 330, 70, 15, 15, '#fff8d0'); ell(g, 330, 70, 12, 12, '#fffbe8');   // morning sun
    ell(g, 3300, 60, 12, 12, '#fff6d0'); ell(g, 3306, 56, 10, 10, '#0c1030');   // Tokyo crescent moon
  }
  function mountains(g) {
    const mt = x => { const r = Math.floor(x / RW); return r === 0 || r === 1 || r === 4 || (r === 2 && x < 2120); };
    for (let x = 0; x < MW; x += 2) {
      if (!mt(x)) continue;
      const hz = horizon(x);
      const h1 = 52 + Math.sin(x * 0.006) * 24 + Math.sin(x * 0.017) * 12, h2 = 26 + Math.sin(x * 0.011 + 2) * 14 + Math.sin(x * 0.031) * 6;
      rect(g, x, hz - h1, 2, h1, pal(x, 'far2')); rect(g, x, hz - h2, 2, h2, pal(x, 'far'));
    }
    // Mount Fuji over the countryside
    const fx = 520, fy = horizon(520);
    poly(g, [[fx - 170, fy], [fx - 22, fy - 128], [fx + 22, fy - 128], [fx + 170, fy]], '#7486b8');
    poly(g, [[fx - 150, fy], [fx - 22, fy - 128], [fx, fy - 128], [fx - 40, fy]], '#8494c4');
    poly(g, [[fx - 58, fy - 84], [fx - 22, fy - 128], [fx + 22, fy - 128], [fx + 58, fy - 84], [fx + 36, fy - 92], [fx + 18, fy - 80], [fx, fy - 94], [fx - 20, fy - 82], [fx - 38, fy - 92]], '#f4f6ff');
    poly(g, [[fx - 58, fy - 84], [fx - 22, fy - 128], [fx - 8, fy - 128], [fx - 30, fy - 88]], '#ffffff');
  }
  function ground(g) {
    for (let x = 0; x < MW; x += 4) {
      const hz = horizon(x), c = pal(x, 'gr'), c2 = pal(x, 'gr2');
      rect(g, x, hz, 4, MH - hz, c);
      for (let y = hz + 4; y < MH; y += 6) if (rnd(x * 7 + y) < 0.28) rect(g, x + (y % 3), y, 2, 1, c2);
      rect(g, x, hz, 4, 2, shade(c, 0.85));
    }
  }
  // small reusable props
  function sakuraTree(g, x, y, s = 1) {
    ell(g, x + 2, y + 3, 16 * s, 4 * s, 'rgba(40,30,20,0.22)');
    rect(g, x - 2, y - 18 * s, 4, 18 * s, DK); rect(g, x - 1, y - 18 * s, 2, 18 * s, '#6a4232');
    line(g, x, y - 14 * s, x - 9 * s, y - 22 * s, '#6a4232'); line(g, x, y - 14 * s, x + 8 * s, y - 24 * s, '#6a4232');
    for (const [dx, dy, r] of [[-10, -26, 10], [8, -28, 11], [0, -34, 11], [-4, -22, 8], [10, -20, 7]]) ell(g, x + dx * s, y + dy * s, r * s + 1, r * s + 1, '#c86a8e');
    for (const [dx, dy, r] of [[-10, -26, 10], [8, -28, 11], [0, -34, 11], [-4, -22, 8], [10, -20, 7]]) ell(g, x + dx * s, y + dy * s, r * s, r * s, '#f2a6c0');
    for (const [dx, dy, r] of [[-12, -29, 5], [5, -32, 6], [-2, -38, 5]]) ell(g, x + dx * s, y + dy * s, r * s, r * s, '#ffd0e0');
  }
  function pine(g, x, y, s = 1, c = '#3e6a3a') {
    rect(g, x - 1, y - 6 * s, 3, 6 * s, '#5a3a2a');
    for (let i = 0; i < 3; i++) { const w = (12 - i * 3) * s, yy = y - 6 * s - i * 7 * s; poly(g, [[x - w, yy], [x + w, yy], [x, yy - 10 * s]], i % 2 ? shade(c, 1.12) : c); }
  }
  function house(g, x, y, w, roof, wall) {   // a small Japanese house: plaster walls, timber, a curved tile roof
    ell(g, x, y + 2, w / 2 + 6, 4, 'rgba(40,30,20,0.25)');
    rect(g, x - w / 2 - 1, y - 21, w + 2, 22, DK); rect(g, x - w / 2, y - 20, w, 20, wall);
    for (const fx of [-w / 2, -w / 6, w / 6, w / 2 - 2]) rect(g, x + fx, y - 20, 2, 20, '#6a4a32');
    rect(g, x - 5, y - 13, 10, 13, '#5a3a2a'); rect(g, x - 4, y - 12, 8, 12, '#e8d8a8');
    poly(g, [[x - w / 2 - 10, y - 19], [x + w / 2 + 10, y - 19], [x + w / 2 - 2, y - 34], [x - w / 2 + 2, y - 34]], DK);
    poly(g, [[x - w / 2 - 8, y - 20], [x + w / 2 + 8, y - 20], [x + w / 2 - 3, y - 33], [x - w / 2 + 3, y - 33]], roof);
    for (let k = y - 30; k < y - 21; k += 3) rect(g, x - w / 2 - 2, k, w + 4, 1, shade(roof, 0.8));
  }
  function stoneLantern(g, x, y) {
    rect(g, x - 5, y - 2, 10, 3, '#7a7a74'); rect(g, x - 2, y - 12, 4, 10, '#8a8a84'); rect(g, x - 5, y - 18, 10, 6, '#9a9a94');
    rect(g, x - 3, y - 16, 6, 3, '#3a3a36'); poly(g, [[x - 8, y - 18], [x + 8, y - 18], [x, y - 25]], '#7a7a74');
  }
  function paperLantern(g, x, y, c = '#d8443a') {
    rect(g, x - 2, y - 7, 4, 2, DK); ell(g, x, y, 4, 6, DK); ell(g, x, y, 3, 5, c); rect(g, x - 3, y - 2, 6, 1, shade(c, 0.7)); rect(g, x - 3, y + 2, 6, 1, shade(c, 0.7)); dot(g, x - 1, y - 2, '#ffd0a0');
    LANTERNS.push({ x, y, c });
  }
  // Try n random spots in a box; plant (up to cap) wherever the ground is free.
  const plantAll = (x0, x1, y0, y1, n, seed, r, fn, cap = Infinity) => { let k = 0; for (let i = 0; i < n && k < cap; i++) { const x = Math.round(x0 + rnd(seed * 1.37 + i * 3.11) * (x1 - x0)), y = Math.round(y0 + rnd(seed * 2.71 + i * 5.73 + 1) * (y1 - y0)); if (free(x, y - r / 2, r)) { fn(x, y, k++); claimSpot(x, y - r / 2, r); } } };

  /* Region 1: Sakura Countryside */
  function sakura(g) {
    // a river from the hills down past the road, with a wooden bridge where they cross
    const rv = y => 690 + Math.sin(y * 0.03) * 16 + (y - 240) * 0.12;
    for (let y = horizon(690); y < MH; y += 2) { const x = Math.round(rv(y)), w = 16 + Math.round((y - 230) * 0.06); rect(g, x - w - 2, y, 2 * w + 4, 2, '#6a8a5a'); rect(g, x - w, y, 2 * w, 2, '#5ab0d8'); rect(g, x - w, y, 3, 2, '#3a8ab8'); if (y % 6 === 0) WATER.push({ x: x - w + 4, y, w: 2 * w - 8 }); mark(x, y, w + 6); }
    // rice paddies: terraces of flooded fields reflecting the sky, planted wherever there is room
    let made = 0;
    for (let i = 0; i < 160 && made < 9; i++) {
      const cols = 2 + Math.floor(rnd(i * 13) * 3), rows = 1 + Math.floor(rnd(i * 17) * 2), W = cols * 30, H = rows * 20;
      const px = Math.round(20 + rnd(i * 7 + 3) * (900 - W)), py = Math.round(262 + rnd(i * 11 + 5) * (500 - 262 - H));
      let ok = true;
      for (let yy = py - 4; yy <= py + H + 4 && ok; yy += 8) for (let xx = px - 4; xx <= px + W + 4; xx += 8) if (!free(xx, yy, 4)) { ok = false; break; }
      if (!ok) continue;
      rect(g, px - 3, py - 3, W + 6, H + 6, '#5e7e34');
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = px + c * 30, y = px % 2 ? py + r * 20 : py + r * 20;
        rect(g, x, y, 28, 18, '#9ad0d8'); rect(g, x, y, 28, 2, '#d0eef4'); rect(g, x, y + 16, 28, 2, '#7ab8c4');
        for (let k = 4; k < 16; k += 4) for (let j = 3; j < 27; j += 5) rect(g, x + j, y + k, 1, 2, '#4a8a3a');
        WATER.push({ x: x + 2, y: y + 9, w: 24 });
      }
      mark(px + W / 2, py + H / 2, Math.max(W, H) / 2 + 8); made++;
    }
    for (const [x, y, w, rf] of [[250, 268, 40, '#7a5a3a'], [560, 262, 34, '#8a6a3a'], [905, 258, 30, '#6a4a32'], [110, 262, 30, '#6a4a32'], [420, 266, 26, '#7a5a3a']]) if (free(x, y - 16, 22)) { house(g, x, y, w, rf, '#f0e6cc'); mark(x, y - 16, 30); }
    plantAll(20, 940, 262, 530, 400, 11, 15, (x, y) => sakuraTree(g, x, y, 0.75 + rnd(x) * 0.45), 34);
    plantAll(20, 940, 248, 300, 120, 41, 9, (x, y) => pine(g, x, y, 0.7, '#4e7a42'), 14);
    plantAll(20, 940, 270, 530, 200, 61, 5, (x, y) => { ell(g, x, y - 3, 5, 4, '#5e9a3e'); ell(g, x - 1, y - 4, 3, 2, '#7ab84e'); }, 40);
  }
  /* Region 2: Kyoto */
  function kyoto(g) {
    const X = RW;
    // five-storey pagoda on the hill
    const px = X + 250, py = horizon(px) + 34;
    rect(g, px - 18, py - 6, 36, 8, '#8a8478');
    for (let i = 0; i < 5; i++) {
      const w = 30 - i * 4, y = py - 6 - i * 22;
      rect(g, px - w / 2 - 1, y - 14, w + 2, 15, DK); rect(g, px - w / 2, y - 13, w, 13, '#b8442e'); rect(g, px - w / 2 + 3, y - 10, w - 6, 6, '#e8d8b0');
      poly(g, [[px - w - 6, y - 12], [px + w + 6, y - 12], [px + w / 2, y - 22], [px - w / 2, y - 22]], DK);
      poly(g, [[px - w - 4, y - 13], [px + w + 4, y - 13], [px + w / 2, y - 21], [px - w / 2, y - 21]], '#3a3438');
      dot(g, px - w - 4, y - 14, '#e0b040'); dot(g, px + w + 3, y - 14, '#e0b040');
    }
    rect(g, px - 1, py - 136, 2, 22, '#e0b040'); for (let k = 0; k < 4; k++) rect(g, px - 3, py - 130 + k * 4, 6, 1, '#e0b040');
    mark(px, py - 60, 50);
    // the golden temple across a pond
    const tx = X + 600, ty = horizon(tx) + 30;
    rect(g, tx - 70, ty + 2, 140, 18, '#5a9ab8'); rect(g, tx - 70, ty + 2, 140, 2, '#9ad0e8'); WATER.push({ x: tx - 66, y: ty + 10, w: 132 });
    for (let i = 0; i < 2; i++) { const w = 46 - i * 12, y = ty - i * 22; rect(g, tx - w / 2 - 1, y - 18, w + 2, 19, DK); rect(g, tx - w / 2, y - 17, w, 17, '#e8b83a'); rect(g, tx - w / 2, y - 17, w, 3, '#fff0a0'); for (let k = -w / 2 + 4; k < w / 2; k += 7) rect(g, tx + k, y - 12, 3, 8, '#a87a1a'); poly(g, [[tx - w / 2 - 12, y - 16], [tx + w / 2 + 12, y - 16], [tx + w / 2 - 4, y - 26], [tx - w / 2 + 4, y - 26]], '#3a3438'); }
    rect(g, tx - 1, ty - 56, 2, 10, '#e0b040');
    mark(tx, ty - 10, 70);
    // bamboo groves
    for (const [bx, n] of [[X + 400, 44], [X + 90, 26], [X + 760, 30], [X + 560, 20]]) for (let i = 0; i < n; i++) {
      const x = bx + Math.round(rnd(bx + i) * 140) - 70, y0 = 290 + Math.round(rnd(bx + i * 3) * 240);
      if (!free(x, y0 - 30, 8)) continue;
      const h = 60 + Math.round(rnd(i + bx) * 50);
      rect(g, x, y0 - h, 3, h, '#4e8a3a'); rect(g, x, y0 - h, 1, h, '#8ac860');
      for (let k = y0 - h + 10; k < y0; k += 14) rect(g, x - 1, k, 5, 1, '#2e5a24');
      for (let k = 0; k < 3; k++) { const ly = y0 - h + 8 + k * 16; line(g, x + 2, ly, x + 9, ly - 4, '#6aaa48'); line(g, x, ly + 4, x - 7, ly, '#6aaa48'); }
      mark(x, y0 - 20, 10);
    }
    house(g, X + 820, 272, 36, '#3a3438', '#efe6d0');
    plantAll(X + 20, X + 940, 280, 520, 120, 71, 12, (x, y) => stoneLantern(g, x, y), 10);
    plantAll(X + 20, X + 940, 300, 520, 120, 91, 16, (x, y) => sakuraTree(g, x, y, 0.8), 8);
    plantAll(X + 20, X + 940, 260, 300, 120, 81, 10, (x, y) => pine(g, x, y, 0.8, '#3a5e34'), 10);
  }
  /* Region 3: Osaka */
  function osaka(g) {
    const X = 2 * RW;
    // the castle on its stone base
    const cx = X + 470, cy = horizon(cx) + 22;
    poly(g, [[cx - 60, cy], [cx + 60, cy], [cx + 46, cy - 26], [cx - 46, cy - 26]], '#8a8478'); for (let k = cy - 24; k < cy; k += 5) rect(g, cx - 56 + (cy - k) / 2, k, 112 - (cy - k), 1, '#6e6a60');
    for (let i = 0; i < 4; i++) {
      const w = 76 - i * 16, y = cy - 26 - i * 22;
      rect(g, cx - w / 2 - 1, y - 16, w + 2, 17, DK); rect(g, cx - w / 2, y - 15, w, 15, '#f4f0e6'); for (let k = -w / 2 + 6; k < w / 2 - 4; k += 9) rect(g, cx + k, y - 11, 4, 5, '#3a3a3a');
      poly(g, [[cx - w / 2 - 12, y - 14], [cx + w / 2 + 12, y - 14], [cx + w / 2 - 2, y - 24], [cx - w / 2 + 2, y - 24]], DK);
      poly(g, [[cx - w / 2 - 10, y - 15], [cx + w / 2 + 10, y - 15], [cx + w / 2 - 3, y - 23], [cx - w / 2 + 3, y - 23]], '#3e8a7a');
      dot(g, cx - w / 2 - 10, y - 16, '#e0b040'); dot(g, cx + w / 2 + 9, y - 16, '#e0b040');
    }
    rect(g, cx - 6, cy - 120, 4, 4, '#e0b040'); rect(g, cx + 3, cy - 120, 4, 4, '#e0b040');
    mark(cx, cy - 40, 70);
    // a street of shops along the back, each with a noren and lanterns
    for (let x = X + 20, i = 0; x < X + 380; i++) {
      const w = 54 + Math.round(rnd(i * 7) * 20), y = horizon(x) + 34;
      house(g, x + w / 2, y, w - 14, ['#3a3438', '#5a3a2a', '#3a4a5a'][i % 3], ['#e8d8b8', '#f0e0c0', '#e0d0b0'][i % 3]);
      rect(g, x + 10, y - 19, w - 20, 7, ['#2f3f78', '#b8302a', '#2f7a3a'][i % 3]); for (let k = x + 13; k < x + w - 10; k += 6) rect(g, k, y - 12, 1, 5, shade(['#2f3f78', '#b8302a', '#2f7a3a'][i % 3], 0.6));
      paperLantern(g, x + 8, y - 16); mark(x + w / 2, y - 16, 34); x += w;
    }
    for (let x = X + 600, i = 0; x < X + 940; i++) {
      const w = 56, y = horizon(x) + 30;
      house(g, x + w / 2, y, w - 16, '#3a3438', '#e8d8b8'); rect(g, x + 12, y - 19, w - 24, 7, ['#e8902a', '#b8302a'][i % 2]); paperLantern(g, x + 10, y - 15, '#e8902a'); mark(x + w / 2, y - 16, 34); x += w;
    }
    // the canal at the bottom, with a little arched bridge
    for (let x = X + 40; x < X + 920; x += 4) { const y = 488 + Math.round(Math.sin(x * 0.02) * 4); rect(g, x, y - 2, 4, 2, '#7a6e5e'); rect(g, x, y, 4, MH - y, '#3a6a8a'); if (x % 24 === 0) WATER.push({ x: x, y: y + 12, w: 18 }); mark(x, y + 10, 16); }
    // food stalls (yatai) and strings of lanterns near the road
    for (let y = 300; y < 486; y += 8) for (let x = X + (y % 16 ? 0 : 8); x < X + RW; x += 16) if (free(x, y, 2)) rect(g, x, y, 12, 1, '#8e7e6a');   // paving stones
    plantAll(X + 30, X + 930, 290, 480, 160, 131, 18, (x, y, i) => {
      ell(g, x, y + 2, 16, 3, 'rgba(30,20,10,0.3)');
      rect(g, x - 13, y - 14, 26, 14, DK); rect(g, x - 12, y - 13, 24, 12, '#8a5a32'); rect(g, x - 12, y - 13, 24, 2, '#b07a48');
      rect(g, x - 12, y - 30, 1, 16, '#3a2a1a'); rect(g, x + 11, y - 30, 1, 16, '#3a2a1a');
      rect(g, x - 15, y - 32, 30, 4, DK); rect(g, x - 14, y - 31, 28, 2, ['#c8443a', '#e8902a', '#2f3f78'][i % 3]);
      rect(g, x - 11, y - 28, 22, 6, ['#2f3f78', '#c8443a', '#f0e6cc'][i % 3]);
      paperLantern(g, x + 15, y - 22, '#e8443a');
    }, 14);
    // big food sign: a takoyaki ball on a post
    const sx = X + 820, sy = 300; if (free(sx, sy, 14)) { rect(g, sx - 1, sy - 10, 3, 34, '#5a3a2a'); ell(g, sx, sy - 18, 13, 13, DK); ell(g, sx, sy - 18, 12, 12, '#c88a3a'); ell(g, sx - 3, sy - 21, 5, 4, '#e8b060'); rect(g, sx - 8, sy - 14, 16, 2, '#4a2a1a'); dot(g, sx + 4, sy - 22, '#5a9a3a'); mark(sx, sy - 10, 18); }
  }
  /* Region 4: Tokyo */
  function tokyo(g) {
    const X = 3 * RW;
    // skyline of towers with lit windows
    for (let x = X - 10, i = 0; x < X + 960; i++) {
      const w = 34 + Math.round(rnd(i * 13) * 40), h = 90 + Math.round(rnd(i * 17) * 130), hz = horizon(x) + 16, c = ['#2a2c4a', '#34365a', '#26283e', '#3a3c62'][i % 4];
      if (Math.abs(x + w / 2 - (X + 540)) < 40) { x += w; continue; }
      rect(g, x, hz - h, w - 2, h, c); rect(g, x, hz - h, 2, h, shade(c, 1.25));
      for (let wy = hz - h + 6; wy < hz - 4; wy += 7) for (let wx = x + 5; wx < x + w - 6; wx += 6) if (rnd(wx * 3 + wy * 7) < 0.42) rect(g, wx, wy, 3, 3, rnd(wx + wy) < 0.8 ? '#ffe08a' : '#9ae0ff');
      if (rnd(i * 5) < 0.55) NEON.push({ x: x + 6, y: hz - h + 20 + Math.round(rnd(i) * (h - 60)), w: Math.min(w - 14, 26), h: 8, c: ['#ff5ad0', '#5ae8ff', '#ffe060', '#ff7a4a'][i % 4], seed: i });
      x += w;
    }
    // the red tower
    const tx = X + 540, base = horizon(tx) + 20;
    for (let y = base; y > base - 210; y -= 2) { const w = Math.round(4 + (base - y) * -0.0 + (y - (base - 210)) * 0.17); const band = Math.floor((base - y) / 26) % 2; rect(g, tx - w, y, 2 * w, 2, band ? '#f4f0e8' : '#e0442a'); }
    for (let y = base - 10; y > base - 200; y -= 13) { const w = Math.round((y - (base - 210)) * 0.17) + 4; line(g, tx - w, y, tx + w, y - 13, '#8a2a1a'); line(g, tx + w, y, tx - w, y - 13, '#8a2a1a'); }
    rect(g, tx - 22, base - 120, 44, 8, '#f4f0e8'); rect(g, tx - 14, base - 168, 28, 6, '#f4f0e8'); rect(g, tx - 1, base - 236, 2, 28, '#e0442a');
    LAMPS.push({ x: tx, y: base - 236, c: '#ff4a3a', blink: true }); mark(tx, base - 60, 40);
    // street lamps along the road (glow at night)
    for (let i = 0; i < PATH.length; i += 30) { const p = PATH[i]; if (p.x < X + 20 || p.x > X + 940) continue; const lx = Math.round(p.x), ly = Math.round(p.y) - 22; if (!free(lx, ly + 8, 4) && (i / 30) % 2) continue; rect(g, lx, ly - 22, 2, 24, '#5a5a6a'); rect(g, lx - 4, ly - 24, 8, 3, '#6a6a7a'); LAMPS.push({ x: lx, y: ly - 21, c: '#ffe8a0' }); }
    plantAll(X + 20, X + 940, 300, 520, 160, 171, 10, (x, y) => { rect(g, x - 1, y - 10, 3, 10, '#4a3a2a'); ell(g, x, y - 14, 7, 7, '#2e5a3a'); ell(g, x - 2, y - 16, 4, 4, '#3e7a4a'); }, 12);
  }
  /* Region 5: Coastal Japan */
  const shore = x => 300 + Math.round(Math.sin(x * 0.006) * 16 + Math.sin(x * 0.017) * 6);
  function coast(g) {
    const X = 4 * RW;
    for (let x = X - 40; x < MW; x += 2) {
      const hz = horizon(x), sh = shore(x), fade = clamp((x - (X - 40)) / 80, 0, 1);
      if (fade <= 0) continue;
      g.globalAlpha = fade;
      for (let y = hz; y < sh; y += 2) rect(g, x, y, 2, 2, mix('#e8906a', '#2a6a9a', clamp((y - hz) / 50, 0, 1)));
      rect(g, x, sh, 2, 3, '#f4e8c8');
      g.globalAlpha = 1;
      if (x % 20 === 0) WATER.push({ x, y: hz + 8 + (x % 3) * 14, w: 12, sea: true });
      mark(x, (hz + sh) / 2, (sh - hz) / 2 + 4);
    }
    // the sun's path on the water
    for (let y = horizon(4430) + 2; y < shore(4430); y += 3) rect(g, 4430 - 14 + (y % 5), y, 28 - (y % 7), 1, '#ffd890');
    // fishing village huts and nets
    for (const [hx, hy] of [[X + 100, 470], [X + 300, 506], [X + 560, 490]]) { if (!free(hx, hy - 14, 24)) continue; house(g, hx, hy, 30, '#5a4a3a', '#d8c8a8'); for (let k = -10; k < 12; k += 4) line(g, hx + 26, hy - 18, hx + 26 + k, hy - 4, '#8a7a5a'); mark(hx, hy - 16, 30); }
    // the lighthouse on its rocks
    const lx = X + 880, ly = shore(lx) + 6;
    ell(g, lx, ly + 4, 34, 12, '#6a665e'); ell(g, lx - 6, ly, 22, 9, '#8a867c');
    poly(g, [[lx - 12, ly], [lx - 8, ly - 92], [lx + 8, ly - 92], [lx + 12, ly]], DK);
    poly(g, [[lx - 11, ly], [lx - 7, ly - 91], [lx + 7, ly - 91], [lx + 11, ly]], '#f4f0e8');
    for (let k = 0; k < 4; k++) rect(g, lx - 10 + k, ly - 18 - k * 22, 20 - 2 * k, 8, '#c8443a');
    rect(g, lx - 9, ly - 104, 18, 12, DK); rect(g, lx - 7, ly - 102, 14, 8, '#ffe680'); poly(g, [[lx - 10, ly - 104], [lx + 10, ly - 104], [lx, ly - 114]], '#c8443a');
    LAMPS.push({ x: lx, y: ly - 98, c: '#fff0a0', beam: true }); mark(lx, ly - 40, 40);
    // a pier into the sea
    const px = X + 700; for (let y = shore(px) - 40; y < shore(px) + 4; y += 3) rect(g, px - 6, y, 12, 2, '#8a6a42');
    plantAll(X + 20, X + 900, 330, 530, 160, 221, 12, (x, y, i) => { rect(g, x, y - 22, 1, 22, '#5a4a3a'); poly(g, [[x - 14, y - 18], [x + 15, y - 18], [x, y - 28]], DK); poly(g, [[x - 12, y - 19], [x + 13, y - 19], [x, y - 27]], i % 2 ? '#e8443a' : '#3a8ad8'); poly(g, [[x - 4, y - 19], [x + 4, y - 19], [x, y - 27]], '#f8f0e0'); ell(g, x + 6, y + 1, 9, 2, 'rgba(60,40,20,0.25)'); }, 8);
    plantAll(X + 20, X + 900, 320, 530, 160, 241, 9, (x, y) => { ell(g, x, y - 3, 8, 5, '#5a5650'); ell(g, x - 2, y - 5, 5, 3, '#7a766e'); }, 12);
    plantAll(X + 20, X + 860, 330, 520, 200, 201, 12, (x, y) => { rect(g, x - 1, y - 18, 3, 18, '#7a5a3a'); for (const a of [-1, 1]) { line(g, x, y - 18, x + a * 12, y - 12, '#3e8a3a'); line(g, x, y - 18, x + a * 9, y - 22, '#4e9a48'); } }, 14);   // palms
  }
  /* the road itself, then what sits on top of it */
  function road(g) {
    for (const p of PATH) { const x = Math.round(p.x), y = Math.round(p.y); rect(g, x - 2, y - 15, 5, 30, pal(x, 'roadE')); }
    for (const p of PATH) { const x = Math.round(p.x), y = Math.round(p.y); rect(g, x - 2, y - 12, 5, 24, pal(x, 'road')); }
    for (let i = 0; i < PATH.length; i++) {
      const p = PATH[i], x = Math.round(p.x), y = Math.round(p.y), r = Math.floor(x / RW);
      if (r === 0 || r === 4) { if (rnd(i) < 0.18) dot(g, x, y - 9 + Math.round(rnd(i * 3) * 18), pal(x, 'roadD')); }                 // dirt and sand
      else if (r === 1) { if (i % 6 === 0) { rect(g, x - 1, y - 11, 3, 10, shade(pal(x, 'road'), 1.08)); rect(g, x - 1, y + 1, 3, 10, shade(pal(x, 'road'), 0.94)); rect(g, x - 1, y, 3, 1, pal(x, 'roadD')); } }   // stone slabs
      else if (r === 2) { if (i % 3 === 0) dot(g, x, y - 10 + (i * 7) % 20, pal(x, 'roadD')); }                                        // cobbles
      else if (r === 3) { if (i % 10 < 5) rect(g, x - 1, y, 3, 2, '#e8e8dc'); }                                                         // lane markings
    }
  }
  function overRoad(g) {
    // countryside: the wooden bridge over the river
    const bi = PATH.findIndex(p => p.x > 660 && p.x < 760 && Math.abs(p.x - (690 + Math.sin(p.y * 0.03) * 16 + (p.y - 240) * 0.12)) < 3);
    if (bi >= 0) for (let k = -16; k <= 16; k += 2) { const p = PATH[clamp(bi + k, 0, PATH.length - 1)], x = Math.round(p.x), y = Math.round(p.y); rect(g, x - 1, y - 13, 3, 26, k % 4 ? '#9a6a3a' : '#7a5230'); dot(g, x, y - 15, '#5a3a22'); dot(g, x, y + 14, '#5a3a22'); }
    // Kyoto: a tunnel of torii gates over the road to the Fushimi stop
    for (let i = 0; i < PATH.length; i += 9) {
      const p = PATH[i]; if (p.x < RW + 40 || p.x > RW + 220) continue;
      const x = Math.round(p.x), y = Math.round(p.y);
      rect(g, x - 1, y - 40, 3, 26, '#a8302a'); rect(g, x - 1, y + 12, 3, 4, '#a8302a');
      rect(g, x - 3, y - 44, 7, 3, '#2a2a2a'); rect(g, x - 2, y - 41, 5, 2, '#c8443a');
    }
    // Gion: strings of lanterns across the road near the landmark
    const gi = POS[STOPS.findIndex(s => s.id === 'kyotoLm')];
    for (let k = -3; k <= 3; k++) paperLantern(g, gi.x - 60 + k * 18 + 60, gi.y - 46 - Math.abs(k) * 2);
    line(g, gi.x - 58, gi.y - 52, gi.x + 58, gi.y - 52, '#3a2a1a');
    // Tokyo: zebra crossings
    for (let i = 0; i < PATH.length; i += 140) { const p = PATH[i]; if (p.x < 3 * RW + 40 || p.x > 4 * RW - 40) continue; for (let k = -9; k <= 9; k += 4) rect(g, Math.round(p.x) - 10, Math.round(p.y) + k, 20, 2, '#e8e8dc'); }
    // coast: boardwalk planks
    for (let i = 0; i < PATH.length; i += 4) { const p = PATH[i]; if (p.x < 4 * RW + 30) continue; rect(g, Math.round(p.x), Math.round(p.y) - 11, 1, 22, '#8a6a42'); }
  }

  /* ---------- live layer ---------- */
  let cam = 0, camT = 0, held = 0, t = 0, raf = 0, last = 0, open = false;
  let cartS = 0, cartTo = 0, cartDir = 1, sel = 0, hover = -1, petals = [], follow = true;   // follow: the camera tracks the cart until the player scrolls
  const CLOUDS = Array.from({ length: 22 }, (_, i) => ({ x: rnd(i * 3) * MW, y: 30 + rnd(i * 5) * 120, s: 0.6 + rnd(i * 7) * 0.8, v: 4 + rnd(i) * 6 }));
  function drawClouds(g) {
    for (const c of CLOUDS) {
      const x = ((c.x + t * c.v) % (MW + 200)) - 100 - cam;
      if (x < -80 || x > VW + 80) continue;
      const wx = x + cam, r = Math.floor(clamp(wx / RW, 0, 4)), col = ['#fffaf4', '#fff4e0', '#f8c8b8', '#3a3c6a', '#ffd8c0'][r];
      if (r === 3) g.globalAlpha = 0.5;
      ell(g, Math.round(x), c.y + 3, 30 * c.s, 7 * c.s, shade(col, 0.9)); ell(g, Math.round(x), c.y, 28 * c.s, 7 * c.s, col); ell(g, Math.round(x + 12 * c.s), c.y - 6 * c.s, 15 * c.s, 8 * c.s, col); ell(g, Math.round(x - 11 * c.s), c.y - 3 * c.s, 11 * c.s, 6 * c.s, col);
      g.globalAlpha = 1;
    }
  }
  function drawLive(g) {
    // water shimmer
    for (const w of WATER) {
      const x = w.x - cam; if (x < -30 || x > VW + 10) continue;
      const k = (t * (w.sea ? 10 : 18) + w.x * 0.37) % (w.w + 10);
      if (k < w.w - 4) { g.globalAlpha = 0.7; rect(g, Math.round(x + k), w.y, w.sea ? 6 : 4, 1, '#eaf8ff'); g.globalAlpha = 1; }
    }
    // boats bobbing on the sea
    for (const [bx0, by, s] of [[4120, 270, 1], [4560, 262, 0.8], [4300, 284, 1.1]]) {
      const bx = bx0 + Math.sin(t * 0.2 + bx0) * 20 - cam, bob = Math.round(Math.sin(t * 1.7 + bx0));
      if (bx < -30 || bx > VW + 30) continue;
      poly(g, [[bx - 14 * s, by + bob], [bx + 14 * s, by + bob], [bx + 9 * s, by + 6 * s + bob], [bx - 9 * s, by + 6 * s + bob]], '#6a3a2a');
      rect(g, Math.round(bx), by - 16 * s + bob, 1, 16 * s, '#3a2a2a'); poly(g, [[bx + 1, by - 15 * s + bob], [bx + 11 * s, by - 2 + bob], [bx + 1, by - 2 + bob]], '#f4ece0');
    }
    // lanterns and lamps glow; neon flickers; the lighthouse sweeps
    for (const l of LANTERNS) { const x = l.x - cam; if (x < -20 || x > VW + 20) continue; g.globalAlpha = 0.16 + 0.07 * Math.sin(t * 3 + l.x); ell(g, Math.round(x), l.y, 10, 10, '#ffb070'); g.globalAlpha = 1; }
    for (const l of LAMPS) {
      const x = l.x - cam; if (x < -120 || x > VW + 120) continue;
      if (l.blink) { if (Math.sin(t * 3) > 0) { ell(g, Math.round(x), l.y, 3, 3, l.c); g.globalAlpha = 0.3; ell(g, Math.round(x), l.y, 7, 7, l.c); g.globalAlpha = 1; } continue; }
      if (l.beam) { const a = Math.sin(t * 0.9); g.globalAlpha = 0.18; poly(g, [[x, l.y], [x + a * 120, l.y - 30], [x + a * 120, l.y + 14]], '#fff6c0'); g.globalAlpha = 1; }
      g.globalAlpha = 0.22 + 0.05 * Math.sin(t * 2 + l.x); ell(g, Math.round(x), l.y + 2, 9, 7, l.c); g.globalAlpha = 1; ell(g, Math.round(x), l.y, 2, 2, l.c);
    }
    for (const n of NEON) {
      const x = n.x - cam; if (x < -40 || x > VW + 10) continue;
      const on = Math.sin(t * 5 + n.seed * 1.7) > -0.8 && Math.sin(t * 23 + n.seed) > -0.95;
      rect(g, Math.round(x) - 1, n.y - 1, n.w + 2, n.h + 2, '#14141e');
      rect(g, Math.round(x), n.y, n.w, n.h, on ? n.c : shade(n.c, 0.35));
      if (on) { g.globalAlpha = 0.2; rect(g, Math.round(x) - 3, n.y - 3, n.w + 6, n.h + 6, n.c); g.globalAlpha = 1; rect(g, Math.round(x) + 2, n.y + 3, n.w - 4, 2, '#ffffff'); }
    }
    // cherry petals drifting over the first two regions
    if (cam < 2 * RW) {
      while (petals.length < 40) petals.push({ x: cam + Math.random() * (VW + 200) - 100, y: -10 - Math.random() * 300, vx: 12 + Math.random() * 16, vy: 18 + Math.random() * 18, ph: Math.random() * 6 });
    }
    for (const p of petals) { const x = p.x - cam; if (p.x < 2 * RW + 80) { rect(g, Math.round(x), Math.round(p.y), 2, 1, '#ffc4d8'); dot(g, Math.round(x) + 1, Math.round(p.y) + 1, '#f08aa8'); } }
  }
  function stepPetals(dt) {
    for (const p of petals) { p.x += (p.vx + Math.sin(t * 2 + p.ph) * 10) * dt; p.y += p.vy * dt; }
    petals = petals.filter(p => p.y < MH + 10 && p.x - cam < VW + 120 && p.x - cam > -140);
  }

  /* ---------- stops and the cart ---------- */
  function stateOf(i) {
    const s = STOPS[i], f = frontierIdx();
    if (stopDone(s)) return 'done';
    if (i === f) return 'open';
    return 'locked';
  }
  const currentIdx = () => { const f = frontierIdx(); return f < 0 ? STOPS.length - 1 : Math.max(0, f - 1); };
  const recipeBowl = k => { const m = MENU[k]; return { tare: m.tare, broth: m.broth, fill: 1, noodles: 'perfect', items: Object.entries(m.tops).flatMap(([id, n]) => Array(n).fill(id)), hide: {} }; };
  // A recipe stop shows what you will get: a little signboard on a post holding the bowl itself, with a NEW badge.
  function recipeSign(g, x, y, s, st) {
    const m = MENU[s.menu], top = y - 76, w = 70, h = 46, bx = x - w / 2, bob = st === 'open' ? Math.round(Math.sin(t * 2.5) * 1.5) : 0;
    if (st === 'locked') g.globalAlpha = 0.7;
    rect(g, x - 1, top + h + bob, 3, y - 14 - (top + h + bob), '#5a3a22');
    rect(g, bx + 3, top + 3 + bob, w, h, 'rgba(20,10,10,0.3)');
    rect(g, bx - 2, top - 2 + bob, w + 4, h + 4, DK); rect(g, bx - 1, top - 1 + bob, w + 2, h + 2, m.c);
    rect(g, bx + 1, top + 1 + bob, w - 2, h - 2, '#fff6e2'); rect(g, bx + 1, top + 1 + bob, w - 2, 3, '#ffffff');
    ART.smallBowl(g, x, top + 26 + bob, recipeBowl(s.menu), t);
    g.globalAlpha = 1;
    // a red NEW tag across the top edge (it gives a little hop while the stop is next)
    const tw = textW('NEW') + 16, hop = st === 'open' && Math.sin(t * 4) > 0.85 ? -2 : 0, ty = top - 12 + bob + hop;
    rect(g, x - tw / 2 - 1, ty - 1, tw + 2, 20, DK); rect(g, x - tw / 2, ty, tw, 18, st === 'locked' ? '#8a8690' : '#e8302a'); rect(g, x - tw / 2, ty, tw, 2, st === 'locked' ? '#aaa6b0' : '#ff7a5a');
    textC(g, 'NEW', x, ty + 4, '#fff6d0');
  }
  function drawStop(g, i) {
    const p = POS[i], x = Math.round(p.x - cam), y = p.y, st = stateOf(i), s = STOPS[i], lm = s.kind === 'landmark' || s.kind === 'start';
    if (x < -60 || x > VW + 60) return;
    const R = lm ? 13 : 11;
    // a recipe still to come shows its signboard and name only when it is next, picked or pointed at (regions hold up to 11 stops)
    const near = st === 'open' || i === sel || i === hover;
    if (s.kind === 'recipe' && st !== 'done' && near) recipeSign(g, x, y, s, st);
    ell(g, x, y + 4, R + 4, 5, 'rgba(20,10,10,0.35)');
    if (st === 'open') { const pulse = 0.5 + 0.5 * Math.sin(t * 4); g.globalAlpha = 0.25 + 0.25 * pulse; ell(g, x, y, R + 8 + pulse * 3, R + 8 + pulse * 3, stopReady(s) ? '#ffe680' : '#fff0c0'); g.globalAlpha = 1; }
    ell(g, x, y, R + 2, R + 2, DK);
    if (st === 'done') { ell(g, x, y, R, R, '#c8302a'); ell(g, x, y, R - 2, R - 2, '#e04a3a'); line(g, x - 5, y, x - 1, y + 4, '#fff4e0'); line(g, x - 1, y + 4, x + 6, y - 4, '#fff4e0'); line(g, x - 5, y + 1, x - 1, y + 5, '#fff4e0'); line(g, x - 1, y + 5, x + 6, y - 3, '#fff4e0'); }
    else if (st === 'open') { ell(g, x, y, R, R, '#e0b040'); ell(g, x, y, R - 3, R - 3, '#fff0c0'); ell(g, x, y, 3, 3, REGIONS[s.region].c); }
    else { ell(g, x, y, R, R, '#5a5660'); ell(g, x, y, R - 2, R - 2, '#6e6a74'); rect(g, x - 4, y - 1, 8, 6, '#2a2830'); rect(g, x - 3, y - 5, 1, 4, '#2a2830'); rect(g, x + 2, y - 5, 1, 4, '#2a2830'); rect(g, x - 3, y - 6, 6, 1, '#2a2830'); }
    if (lm) { rect(g, x + R - 2, y - R - 12, 1, 14, '#3a2a1a'); poly(g, [[x + R - 1, y - R - 12], [x + R + 9, y - R - 9], [x + R - 1, y - R - 6]], st === 'locked' ? '#8a8690' : REGIONS[s.region].c); }
    if (st === 'open' && stopReady(s)) { const b = Math.round(Math.sin(t * 6) * 2); rect(g, x - 2, y - R - 18 + b, 5, 9, DK); rect(g, x - 1, y - R - 17 + b, 3, 7, '#ffe680'); rect(g, x - 2, y - R - 7 + b, 5, 4, DK); rect(g, x - 1, y - R - 6 + b, 3, 2, '#ffe680'); }
    if (i === sel) { const b = Math.round(Math.sin(t * 5) * 2) - (s.kind === 'recipe' && st !== 'done' && near ? 74 : 0); poly(g, [[x - 6, y - R - 26 + b], [x + 6, y - R - 26 + b], [x, y - R - 18 + b]], DK); poly(g, [[x - 4, y - R - 25 + b], [x + 4, y - R - 25 + b], [x, y - R - 20 + b]], '#ffffff'); }
    if (s.kind === 'recipe' && st !== 'done' && near) SCENE.label(g, 'NEW RECIPE: ' + MENU[s.menu].short, x, y + R + 16, st === 'locked' ? 'muted' : MENU[s.menu].c);
    else if (i === sel || i === hover || st === 'open' || i === currentIdx()) SCENE.label(g, s.place.toUpperCase(), x, y + R + 16, st === 'locked' ? 'muted' : undefined);
  }
  function drawCart(g) {
    const p = at(cartS), x = Math.round(p.x - cam), y = Math.round(p.y) - 4;
    if (x < -40 || x > VW + 40) return;
    const moving = Math.abs(cartTo - cartS) > 1, bob = moving ? Math.round(Math.abs(Math.sin(t * 12))) : 0, d = cartDir;
    ell(g, x, y + 10, 18, 4, 'rgba(20,10,10,0.35)');
    const wheel = (wx) => { ell(g, wx, y + 6, 6, 6, DK); ell(g, wx, y + 6, 5, 5, '#8a5a32'); const a = cartS * 0.2; line(g, wx, y + 6, Math.round(wx + Math.cos(a) * 4), Math.round(y + 6 + Math.sin(a) * 4), '#3a2a1a'); };
    rect(g, x - 15, y - 12 - bob, 30, 16, DK); rect(g, x - 14, y - 11 - bob, 28, 14, '#a8743e'); rect(g, x - 14, y - 11 - bob, 28, 2, '#d09858'); for (let k = -10; k < 14; k += 6) rect(g, x + k, y - 9 - bob, 1, 12, '#7a5230');
    rect(g, x - 14, y - 32 - bob, 2, 20, '#5a3a22'); rect(g, x + 12, y - 32 - bob, 2, 20, '#5a3a22');
    rect(g, x - 18, y - 36 - bob, 36, 5, DK); rect(g, x - 17, y - 35 - bob, 34, 3, '#c8302a');
    rect(g, x - 13, y - 31 - bob, 26, 8, '#2f3f78'); for (let k = -9; k < 12; k += 7) rect(g, x + k, y - 31 - bob, 1, 8, '#1a2448'); ell(g, x, y - 27 - bob, 2, 2, '#f4ecd8');
    const lx = x + d * 19; rect(g, lx, y - 30 - bob, 1, 6, '#3a2a1a'); ell(g, lx, y - 21 - bob, 4, 5, DK); ell(g, lx, y - 21 - bob, 3, 4, '#e8443a'); g.globalAlpha = 0.25 + 0.1 * Math.sin(t * 4); ell(g, lx, y - 21 - bob, 9, 9, '#ffb070'); g.globalAlpha = 1;
    line(g, x - d * 15, y - 2 - bob, x - d * 27, y + 2, '#5a3a22');
    wheel(x - 8); wheel(x + 8);
    if (!moving) for (let k = 0; k < 2; k++) { const ph = (t * 0.7 + k * 0.5) % 1; g.globalAlpha = 0.5 * (1 - ph); rect(g, x - 2 + k * 4 + Math.round(Math.sin(ph * 6) * 2), y - 40 - bob - Math.round(ph * 14), 2, 3, '#ffffff'); g.globalAlpha = 1; }
  }
  function regionBanner(g) {   // a hanging signboard at the start of each region, using the game's world label style
    for (let r = 0; r < REGIONS.length; r++) {
      const name = REGIONS[r].name.toUpperCase(), half = textW(name) / 2 + 12, cx = r * RW + 24 + half - cam;
      if (cx < -half - 20 || cx > VW + half) continue;
      const open = regionOpen(r);
      rect(g, Math.round(cx - half + 8), 48, 2, 14, '#3a2a1a'); rect(g, Math.round(cx + half - 10), 48, 2, 14, '#3a2a1a');
      SCENE.label(g, name, Math.round(cx), 72, open ? undefined : 'muted');
      if (r === ((window.G && G.region) || 0)) SCENE.label(g, 'YOUR SHOP', Math.round(cx), 96, '#e0b040');
    }
  }
  function frame() {
    const g = $('map').getContext('2d'); g.imageSmoothingEnabled = false;
    const c = Math.round(cam);
    g.drawImage(map, c, 0, VW, MH, 0, 0, VW, MH);
    drawClouds(g); drawLive(g); regionBanner(g);
    STOPS.forEach((s, i) => drawStop(g, i));
    drawCart(g);
  }

  /* ---------- loop, camera, input ---------- */
  function tick(now) {
    raf = 0; if (!open) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (Math.abs(cartTo - cartS) > 0.5) {
      const d = cartTo - cartS, v = Math.min(Math.abs(d), Math.max(90, Math.min(700, Math.abs(d) * 2.2)) * dt);
      cartS += Math.sign(d) * v; cartDir = Math.sign(d) || cartDir;
      if (follow) camT = at(cartS).x - VW / 2;
    } else cartS = cartTo;
    camT += held * 700 * dt;
    camT = clamp(camT, 0, MW - VW);
    cam += (camT - cam) * Math.min(1, dt * 7);
    stepPetals(dt);
    frame();
    raf = requestAnimationFrame(tick);
  }
  const travelling = () => Math.abs(cartTo - cartS) > 0.5;
  function skip() { if (travelling()) { cartS = cartTo; return true; } return false; }
  function pick(i) {
    sel = i; hooks.sound('tap');
    const st = stateOf(i);
    follow = true;
    if (st !== 'locked') { cartTo = NODE_S[i]; } else camT = POS[i].x - VW / 2;
    card();
  }
  function stopAt(mx, my) { let best = -1, bd = 22; POS.forEach((p, i) => { const d = Math.hypot(p.x - cam - mx, p.y - my); if (d < bd) { bd = d; best = i; } }); return best; }
  function bindInput() {
    const cv = $('map');
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * MH }; };
    let drag = null;
    cv.addEventListener('pointerdown', e => { const p = pos(e); drag = { x: p.x, cam: camT, moved: 0 }; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ } });
    cv.addEventListener('pointermove', e => {
      const p = pos(e);
      if (drag) { drag.moved = Math.max(drag.moved, Math.abs(p.x - drag.x)); if (drag.moved > 4) { follow = false; camT = clamp(drag.cam - (p.x - drag.x), 0, MW - VW); cam = camT; } }
      hover = stopAt(p.x, p.y); cv.style.cursor = drag && drag.moved > 4 ? 'grabbing' : hover >= 0 ? 'pointer' : 'grab';
    });
    cv.addEventListener('pointerup', e => {
      const p = pos(e), d = drag; drag = null;
      if (!d || d.moved > 4) return;
      if (skip()) return;
      const i = stopAt(p.x, p.y); if (i >= 0) pick(i);
    });
    cv.addEventListener('wheel', e => { e.preventDefault(); follow = false; camT = clamp(camT + (e.deltaY || e.deltaX), 0, MW - VW); }, { passive: false });
    window.addEventListener('keydown', e => {
      if (!open || e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft') { held = -1; follow = false; e.preventDefault(); }
      else if (k === 'd' || k === 'arrowright') { held = 1; follow = false; e.preventDefault(); }
      else if (k === ' ' || k === 'enter') { if (!skip() && k === 'enter') { const b = $('jr-card').querySelector('.jr-claim:not(:disabled)'); if (b) b.click(); } e.preventDefault(); }
    });
    window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (['a', 'd', 'arrowleft', 'arrowright'].includes(k)) held = 0; });
  }

  /* ---------- the HTML around the map: header, shop location, the stop card ---------- */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function header() {
    const lv = G.level, maxed = lv >= LEVEL_XP.length, lo = LEVEL_XP[lv - 1], hi = LEVEL_XP[lv] || lo, have = maxed ? 1 : (G.xp - lo) / Math.max(1, hi - lo);
    $('jr-lv').textContent = 'Lv ' + lv; $('jr-xp').style.width = Math.round(100 * clamp(have, 0, 1)) + '%';
    $('jr-xptext').textContent = maxed ? 'Max level' : (hi - G.xp) + ' XP to Lv ' + (lv + 1);
    $('jr-gold').textContent = G.gold + 'G';
    const done = STOPS.filter(stopDone).length;
    $('jr-count').textContent = done + ' / ' + STOPS.length + ' stops';
    $('jr-regions').innerHTML = REGIONS.map((r, i) => {
      const on = regionOpen(i), cur = (G.region || 0) === i;
      return `<button type="button" class="jr-reg${cur ? ' on' : ''}" data-r="${i}" style="--rc:${r.c}"${on ? '' : ' disabled'} title="${on ? (cur ? 'Your shop is here' : 'Move the shop to ' + esc(r.name)) : 'Finish ' + esc(regionEnd(i - 1).place) + ' to unlock'}">${on ? '' : '<i class="lock"></i>'}${esc(r.short)}</button>`;
    }).join('');
    $('jr-regions').querySelectorAll('.jr-reg').forEach(b => { b.onclick = () => { const r = +b.dataset.r; hooks.setRegion(r); camT = clamp(r * RW, 0, MW - VW); header(); }; });
  }
  function card() {
    const s = STOPS[sel], st = stateOf(sel), f = frontierIdx(), el = $('jr-card');
    const kind = { start: 'Start', recipe: 'New recipe', upgrade: 'Upgrade', landmark: 'Landmark' }[s.kind];   // the card's kind line
    let what = '';
    if (s.kind === 'recipe') {
      const m = MENU[s.menu], tops = Object.entries(m.tops).map(([id, n]) => TOP_NAME[id].toLowerCase() + (n > 1 ? ' x' + n : '')).join(', ');
      what = `<span class="jr-new" style="--rc:${m.c}"><span class="jr-ribbon">New recipe</span>${ART.figure(s.menu, 'jr-fig')}`
        + `<span class="jr-dish"><b style="color:${m.c}">${esc(m.name)}</b><small>${esc(TARES[m.tare].name)} &middot; ${esc(BROTHS[m.broth].name.toLowerCase())}</small><small>${esc(tops)}</small>`
        + `${s.also ? `<small class="jr-also">Also unlocks: ${esc(s.also.toLowerCase())}</small>` : ''}<small class="jr-price">Sells for ${m.price}G</small></span></span>`;
    }
    else if (s.kind === 'upgrade') what = `<b>${esc(s.name)}</b><small>${esc(s.desc)}</small><small class="jr-also">Goes on sale at Kitsune-ya, the night shop, for ${s.cost}G.</small>`;
    else if (s.kind === 'landmark') what = `<b>${esc(s.name)}</b>${s.gold ? ` and <b>${s.gold}G</b>` : ''}<small>${esc(s.desc)}</small>`;
    else what = `<small>${esc(s.desc)}</small>`;
    const lvOk = G.level >= s.level, lo = LEVEL_XP[s.level - 1] || 0;
    const req = s.kind === 'start' ? '' : `<div class="jr-req${lvOk ? ' ok' : ''}">Level ${s.level}<span>${lvOk ? 'reached' : (lo - G.xp) + ' XP to go'}</span></div>`;
    let act;
    if (st === 'done') act = `<span class="jr-done">${s.kind === 'start' ? 'Your journey starts here' : 'Unlocked'}</span>`;
    else act = `<span class="jr-lockmsg">Unlocks by itself at level ${s.level}</span>`;
    const goal = '';
    el.innerHTML = `
      <div class="jr-head"><span class="jr-dot" style="background:${REGIONS[s.region].c}"></span><b>${esc(s.place)}</b><span class="jr-tag">${esc(REGIONS[s.region].name)} &middot; ${kind}</span></div>
      <p class="jr-what">${what}</p>${goal}${req}<div class="jr-act">${act}</div>`;

  }

  function openMap() {
    if (!map) { paint(); bindInput(); }
    open = true;
    const cur = currentIdx(), f = frontierIdx();
    cartS = cartTo = NODE_S[cur]; sel = f >= 0 ? f : cur;
    camT = cam = clamp(POS[sel].x - VW / 2, 0, MW - VW);
    header(); card();
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  function close() { open = false; held = 0; if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  function refresh() { if (open) { header(); card(); } }
  return { init: h => { hooks = Object.assign(hooks, h); }, open: openMap, close, refresh, look: x => { camT = cam = clamp(x, 0, MW - VW); }, state: () => ({ cam, camT, cartS, cartTo, sel, open, nodeS: NODE_S.slice(), pos: POS.map(p => ({ ...p })) }) };
})();
