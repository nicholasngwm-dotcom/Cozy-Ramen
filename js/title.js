'use strict';
/* Title screen: the ramen stall's front on a fantasy street, menu planks on a signpost.
   The scene reflects the save: closed and dusty with no save; open with guests on the stools, the chef ladling,
   passers-by, the save's province, decor and upgrades, and the time of the last save (dusk or night).
   Layers, back to front: sky (live), far mountains and the castle/road/province layer (cached, with a little mouse
   parallax), the street (cached `back`, rebuilt when the title state changes), live details, foreground props and a
   framing branch (cached, parallax), the logo (cached banner, live letters), the signpost menu.
   Also draws the in-world scroll panels (settings, how to play, guest book, confirm, pause) used from the title and,
   as an overlay, during play. Everything follows the guests' look: 1px black outlines, hard cel shading, stepped light.
   ?title=new|early|mid|late|night shows each state with fake save data (CONTINUE still uses the real save). */
const TITLE = (() => {
  const { mk, rect, dot, ell, poly, line, shade, mix, text, textC, textW, setFont } = PX;
  const { wood, plaster, ao, pool, lantern } = SCENE;
  const DK = PX.OUTLINE, rnd = SCENE.rnd;
  let H = null;                 // hooks from game.js
  let back = null, logo = null, far1 = null, far2 = null, props = null, branch = null, letters = null;
  const S = { screen: 'main', sel: 0, t: 0, open: 0, overlay: false, page: 0, pick: 0, slide: [0, 0, 0, 0, 0],
    intro: 99, mx: 0, my: 0, px: 0, py: 0, ang: [0, 0, 0, 0, 0], vel: [0, 0, 0, 0, 0], gust: 0 };
  let hits = [];
  const puffs = [], sil = {};
  let puffT = 0;
  const ease = p => 1 - (1 - p) * (1 - p);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const calm = () => !!(H && H.settings && H.settings.reduceMotion);

  /* ---------- the title state: from the save (or a forced test state) ---------- */
  const FORCED = (() => { try { return new URLSearchParams(location.search).get('title'); } catch (e) { return null; } })();
  const upto = lv => STOPS.filter(s => s.kind !== 'start' && s.level <= lv).map(s => s.id);
  const firstMet = n => GUESTS.slice(0, n).map(g => g.id);
  const FAKE = {
    new: () => null,
    early: () => ({ day: 7, gold: 120, level: 3, region: 0, owned: upto(3), gear: [], met: firstMet(6), aoiMet: false, night: false }),
    mid: () => ({ day: 40, gold: 640, level: 13, region: 2, owned: upto(13), gear: ['quick', 'bins', 'stall5', 'caddy', 'boil', 'stall6'], met: firstMet(16), aoiMet: true, night: false }),
    late: () => ({ day: 95, gold: 2380, level: MAX_LEVEL, region: 4, owned: upto(MAX_LEVEL), gear: GEAR.slice(), met: GUESTS.map(g => g.id), aoiMet: true, night: false }),
    night: () => ({ day: 30, gold: 410, level: 11, region: 1, owned: upto(11), gear: ['quick', 'bins', 'stall5', 'caddy'], met: firstMet(10), aoiMet: true, night: true })
  };
  let fake;
  const forced = () => !!(FORCED && FAKE[FORCED]);
  const saveInfo = () => { if (forced()) { if (fake === undefined) fake = FAKE[FORCED](); return fake; } return H.saveInfo(); };
  const metIds = () => (forced() ? ((saveInfo() || {}).met || []) : H.met());
  let TS = { open: false, region: 0, night: false, deco: [], gear: [], kits: 0, sign: 0, cat: false, plant: false, dragon: false, aoi: false, day: 0, gold: null, weather: null };
  function readState() {
    const s = saveInfo(), owned = s && Array.isArray(s.owned) ? s.owned : [];
    let region = s && Number.isInteger(s.region) ? s.region : null;
    if (s && region === null) { const rs = STOPS.filter(st => owned.includes(st.id)).map(st => st.region); region = rs.length ? Math.max(...rs) : 0; }   // older saves: how far along the road
    region = clamp(region || 0, 0, REGIONS.length - 1);
    const gear = s && Array.isArray(s.gear) ? s.gear : [], day = s ? s.day || 1 : 0, r = rnd(day * 13.7 + 3.1);
    TS = { open: !!s, region, night: !!(s && s.night), gear,
      deco: STOPS.filter(st => st.deco !== undefined && owned.includes(st.id)).map(st => st.deco),
      kits: gear.filter(id => /^stall/.test(id)).length, sign: gear.includes('board10') ? 2 : gear.includes('board9') ? 1 : 0,
      cat: gear.includes('tips'), plant: gear.includes('caddy'), dragon: owned.includes('dragon'), aoi: !!(s && s.aoiMet),
      day, gold: s && typeof s.gold === 'number' ? s.gold : null,
      weather: !s ? null : r < 0.18 ? 'rain' : r < 0.28 && region !== 4 ? 'snow' : null };   // the same day always has the same weather
    back = far1 = far2 = props = branch = null;
    seatGuests(); walkers.length = 0; walkT = rand(3, 6); EV.cur = null; EV.wait = rand(20, 40);
    Object.assign(village.dragon, { x: null, wait: 6, mode: 'fly', t: 0 });
  }
  const tag = () => {   // the CONTINUE plank's line: what the save holds
    const s = saveInfo(); if (!s) return '';
    const parts = [];
    if (s.day) parts.push('DAY ' + s.day);
    parts.push(REGIONS[TS.region].name.toUpperCase());
    if (typeof s.gold === 'number') parts.push(s.gold + 'G');
    return parts.join(' · ');
  };

  /* ---------- small drawing helpers ---------- */
  function bigText(g, s, cx, y, fs, fill, hi) {
    setFont(fs);
    const w = textW(s), x = Math.round(cx - w / 2);
    text(g, s, x + 3, y + 4, 'rgba(20,8,12,0.45)');
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]]) text(g, s, x + dx, y + dy, DK);
    text(g, s, x, y, fill);
    if (hi) { g.save(); g.beginPath(); g.rect(x - 2, y - fs - 2, w + 4, fs * 3); g.clip(); text(g, s, x, y, hi); g.restore(); }
    setFont(2);
  }
  const glove = SCENE.glove;   // the white glove pointer (shared with Aoi's tutorial)
  function post(g, x, y, w, h, c) {
    rect(g, x - 1, y, w + 2, h, DK); rect(g, x, y, w, h, c);
    rect(g, x, y, 2, h, shade(c, 1.3)); rect(g, x + w - 3, y, 3, h, shade(c, 0.65));
  }
  function stones(g, x0, y0, w, h) {
    rect(g, x0, y0, w, h, '#2e2834');
    for (let y = y0, row = 0; y < y0 + h; row++) {
      const sh = 9 + Math.floor(row * 1.2);
      for (let x = x0 - ((row * 13) % 26), i = 0; x < x0 + w; i++) {
        const sw = 20 + Math.floor(rnd(row * 31 + i) * 14), v = rnd(row * 7 + i * 3), c = shade('#6a6070', 0.86 + v * 0.22);
        rect(g, x + 1, y + 1, sw - 2, sh - 2, c); rect(g, x + 2, y + 1, sw - 4, 1, shade(c, 1.2)); rect(g, x + 1, y + 2, 1, sh - 4, shade(c, 1.1));
        rect(g, x + 2, y + sh - 2, sw - 4, 1, shade(c, 0.72)); rect(g, x + sw - 2, y + 2, 1, sh - 4, shade(c, 0.8));
        x += sw;
      }
      y += sh;
    }
  }
  function litWindow(g, x, y, w, h, frame, cols = 2, rows = 2) {
    SCENE.frameRect(g, x, y, w, h, frame, 4);
    for (let k = 0; k < 5; k++) rect(g, x, y + Math.floor(k * h / 5), w, Math.ceil(h / 5) + 1, mix('#ffe2a0', '#e8903e', k / 4));
    for (let c = 1; c < cols; c++) rect(g, x + Math.round(c * w / cols) - 1, y, 2, h, DK);
    for (let r = 1; r < rows; r++) rect(g, x, y + Math.round(r * h / rows) - 1, w, 2, DK);
  }
  // A stepped (hard-edged, not blurred) pool of light: a few nested ellipses, each a little brighter.
  function stepped(g, cx, cy, rx, ry, c, a, n = 4) {
    g.globalAlpha = a;
    for (let k = 0; k < n; k++) { const f = 1 - k / n; ell(g, Math.round(cx), Math.round(cy), Math.round(rx * f), Math.max(1, Math.round(ry * f)), c); }
    g.globalAlpha = 1;
  }
  function shutter(g, x, y, w, h) {   // closed wooden window shutters
    rect(g, x - 1, y - 1, w + 2, h + 2, DK);
    for (let k = 0; k < w; k += 8) { rect(g, x + k, y, 7, h, k % 16 ? '#6e4a2c' : '#7a5232'); rect(g, x + k, y, 1, h, '#9a6a3a'); }
    rect(g, x + w / 2 - 1, y, 2, h, DK);
    for (const by of [y + 8, y + h - 12]) { rect(g, x, by, w, 4, DK); rect(g, x + 1, by + 1, w - 2, 2, '#4a3226'); }
  }

  /* ---------- far layers (cached; drawn with a little mouse parallax) ---------- */
  const FARW = VW + 24;
  function buildFar1() {   // distant mountains with snow caps, peeking over the neighbours' roofs
    const c = mk(FARW, 260), g = c.getContext('2d'), n = TS.night;
    const base = n ? '#251f42' : '#42346a', lit = n ? '#2e2852' : '#54447e', snow = n ? '#8a86b8' : '#dac6e2', snowLo = n ? '#6a6898' : '#b8a2c8';
    const P = [[0, 168], [46, 132], [96, 152], [160, 108], [222, 146], [300, 122], [380, 150], [470, 116], [560, 148], [650, 120], [730, 150], [800, 104], [868, 140], [930, 118], [FARW, 150]];
    poly(g, [...P, [FARW, 260], [0, 260]], base);
    for (let k = 1; k < P.length - 1; k++) {
      const [x, y] = P[k], [lx, ly] = P[k - 1];
      poly(g, [[x, y], [x + (lx - x) * 0.7, y + (ly - y) * 0.7], [x - 2, y + (ly - y) * 0.7 + 10]], lit);           // the lit (left) face
      poly(g, [[x, y], [x - 9, y + 11], [x - 4, y + 8], [x, y + 12], [x + 4, y + 8], [x + 9, y + 11]], snow);        // snow cap
      rect(g, x - 1, y + 2, 1, 6, snowLo);
    }
    return c;
  }
  function buildFar2() {   // nearer hills; the castle, the Long Road, and the province's own skyline
    const c = mk(FARW, 260), g = c.getContext('2d'), n = TS.night, R = TS.region;
    const hill = n ? '#1d1934' : '#32284e', hill2 = n ? '#24203e' : '#3b305e', win = '#ffcf7a', dark = n ? '#141026' : '#211b3a';
    poly(g, [[0, 260], [0, 176], [70, 164], [150, 172], [240, 158], [330, 172], [470, 162], [620, 174], [720, 160], [820, 168], [900, 154], [FARW, 164], [FARW, 260]], hill2);
    if (R === 4) {   // Ember Coast: the sea to the horizon, a lighthouse on its rock
      rect(g, 0, 172, FARW, 88, n ? '#1c2a4a' : '#3a5a8a');
      for (let y = 174; y < 200; y += 3) for (let x = (y * 37) % 23; x < FARW; x += 23 + (y % 7)) rect(g, x, y, 6 + (x % 5), 1, n ? '#2c4a72' : '#6a8ac0');
      rect(g, 0, 172, FARW, 1, n ? '#3a5a8a' : '#c8b0d0');
      poly(g, [[840, 200], [858, 184], [912, 182], [930, 200]], dark);
      const lx = 886;
      poly(g, [[lx - 9, 184], [lx + 9, 184], [lx + 6, 114], [lx - 6, 114]], DK);
      for (let y = 115; y < 184; y += 12) poly(g, [[lx - 8 + (y - 115) * -0.04, y], [lx + 8 + (y - 115) * 0.04, y], [lx + 8, y + 6], [lx - 8, y + 6]], y % 24 === 19 ? '#c8443a' : '#e8dcc0');
      rect(g, lx - 9, 104, 18, 11, DK); rect(g, lx - 8, 105, 16, 9, '#ffe2a0'); poly(g, [[lx - 10, 104], [lx + 10, 104], [lx, 96]], DK);
    } else {
      poly(g, [[0, 260], [0, 186], [120, 180], [260, 190], [460, 182], [700, 190], [850, 178], [FARW, 186], [FARW, 260]], hill);
      // the Long Road: a pale path winding over the right-hand hills to the horizon
      const pts = []; for (let k = 0; k <= 24; k++) { const u = k / 24; pts.push([FARW - u * 190 + Math.sin(u * 7) * 18 * (1 - u), 200 - u * 40, 7 * (1 - u) + 1]); }
      for (let k = 0; k < pts.length - 1; k++) { const [x0, y0, w0] = pts[k], [x1, y1, w1] = pts[k + 1]; poly(g, [[x0 - w0, y0], [x0 + w0, y0], [x1 + w1, y1], [x1 - w1, y1]], n ? '#4a4060' : '#8a7a8a'); }
      for (let k = 2; k < pts.length - 2; k += 4) dot(g, Math.round(pts[k][0] + pts[k][2] + 2), Math.round(pts[k][1] - 2), win);   // lamp posts along it
      if (R === 3) {   // Neon Capital: towers with lit windows on both sides
        for (const [x0, x1] of [[0, 250], [700, FARW]]) for (let x = x0, i = 0; x < x1; i++) {
          const w = 18 + Math.floor(rnd(x * 3.1) * 22), h = 30 + Math.floor(rnd(x * 7.7) * 60);
          rect(g, x, 196 - h, w, h, i % 2 ? dark : '#2a2244');
          for (let wy = 196 - h + 5; wy < 192; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 5) if (rnd(wx * 1.3 + wy * 7.1) > 0.45) rect(g, wx, wy, 2, 3, ['#ffcf7a', '#ff8ad8', '#8ae0ff'][(wx + wy) % 3]);
          if (rnd(x) > 0.75) { rect(g, x + w / 2, 196 - h - 12, 1, 12, dark); dot(g, x + w / 2, 196 - h - 13, '#ff5a5a'); }
          x += w + 2;
        }
      } else {   // the castle on its hill
        for (const [x, w, h] of [[62, 16, 66], [82, 24, 50], [110, 18, 76], [132, 26, 46], [162, 16, 58]]) {
          rect(g, x, 186 - h, w, h, dark); poly(g, [[x - 3, 186 - h], [x + w + 3, 186 - h], [x + w / 2, 186 - h - 16]], n ? '#100c20' : '#1a1430');
          dot(g, x + (w >> 1), 186 - h + 10, win); if (h > 52) dot(g, x + (w >> 1), 186 - h + 26, win);
          rect(g, x + w / 2, 186 - h - 24, 1, 8, dark); rect(g, x + w / 2 + 1, 186 - h - 24, 5, 3, '#c8443a');
        }
        rect(g, 56, 176, 130, 10, dark);
      }
      if (R === 0) for (let k = 0; k < 14; k++) {   // Blossom Vale: a few blossom trees scattered on the hills, small with distance
        const x = Math.round((k < 7 ? 8 + rnd(k * 3.3) * 230 : 712 + rnd(k * 5.1) * 240)), y = 174 + Math.round(rnd(k * 7.7) * 12), r = 3 + Math.round(rnd(k * 1.9) * 3);
        rect(g, x, y, 1, r + 2, dark); ell(g, x, y - 1, r + 1, r, n ? '#6a4060' : '#b86a8a'); ell(g, x - 1, y - 2, r, Math.max(1, r - 1), n ? '#7a4a6a' : '#d88aa8'); dot(g, x - 2, y - 3, n ? '#9a5a80' : '#f2b8cc');
      }
      if (R === 1) {   // Lantern City: a pagoda with lit eaves
        const px = 790;
        for (let k = 0; k < 5; k++) { const y = 188 - k * 16, w = 30 - k * 4; rect(g, px - w / 2 + 4, y - 12, w - 8, 12, dark); poly(g, [[px - w / 2 - 4, y - 10], [px + w / 2 + 4, y - 10], [px + w / 2 - 2, y - 15], [px - w / 2 + 2, y - 15]], n ? '#100c20' : '#1a1430'); dot(g, px - w / 2 + 6, y - 6, win); dot(g, px + w / 2 - 7, y - 6, win); }
        rect(g, px, 92, 1, 14, dark);
      }
      if (R === 2) {   // Canal Market: the canal winding through the hills, an arched bridge over it
        for (let k = 0; k < 20; k++) { const u = k / 20, x = 720 + u * 260, y = 184 + Math.sin(u * 5) * 3; rect(g, Math.round(x), Math.round(y), 14, 4, n ? '#2c4a72' : '#5a7ab0'); dot(g, Math.round(x) + 4, Math.round(y) + 1, '#c8d8f0'); }
        for (let a = 0; a <= 20; a++) { const th = Math.PI * a / 20; dot(g, Math.round(860 + Math.cos(th) * 16), Math.round(186 - Math.sin(th) * 9), n ? '#4a4060' : '#9a8a9a'); }
        rect(g, 842, 177, 36, 2, n ? '#4a4060' : '#9a8a9a');
      }
    }
    return c;
  }

  /* ---------- the street, built once per title state ---------- */
  function buildBack() {
    const c = mk(VW, VH), g = c.getContext('2d'), O = TS.open, R = TS.region;
    // neighbours: an inn on the left, a tool shop on the right
    for (const [x0, w, wall, roof] of [[-10, 272, '#5a4846', '#2c2840'], [700, 270, '#55484e', '#2a2a40']]) {
      poly(g, [[x0 - 14, 238], [x0 + w + 14, 238], [x0 + w - 20, 196], [x0 + 20, 196]], DK);
      poly(g, [[x0 - 12, 236], [x0 + w + 12, 236], [x0 + w - 21, 198], [x0 + 21, 198]], roof);
      for (let y = 202; y < 236; y += 6) rect(g, x0 + 18 - (y - 198) * 0.8, y, w - 36 + (y - 198) * 1.6, 1, shade(roof, 0.75));
      plaster(g, x0, 238, w, 202, wall, x0 + 50);
      ao(g, x0, 238, w, 202, 'top', 18, 0.5);
      rect(g, x0, 238, w, 1, DK);
    }
    litWindow(g, 40, 270, 60, 50, '#4a3226'); litWindow(g, 150, 270, 60, 50, '#4a3226');
    litWindow(g, 740, 270, 60, 50, '#4a3226'); litWindow(g, 850, 270, 60, 50, '#4a3226', 3, 2);
    rect(g, 30, 340, 100, 100, DK); wood(g, 31, 341, 98, 99, '#4a3226', 14, true, 61);            // inn door
    rect(g, 820, 340, 90, 100, DK); wood(g, 821, 341, 88, 99, '#3e2c26', 14, true, 63);           // tool shop door
    if (TS.aoi) {   // a slice of Kitsune-ya at the right edge of the street
      const x0 = 914;
      post(g, x0 - 6, 230, 8, 210, '#4a3226');
      plaster(g, x0 + 2, 238, VW - x0, 202, '#e6d2ac', 917); ao(g, x0 + 2, 238, VW - x0, 202, 'top', 14, 0.5);
      poly(g, [[x0 - 8, 238], [VW + 4, 238], [VW + 4, 214], [x0 + 6, 214]], DK); poly(g, [[x0 - 6, 236], [VW + 4, 236], [VW + 4, 216], [x0 + 7, 216]], '#2f3f78');
      rect(g, x0 + 4, 248, 40, 22, DK); rect(g, x0 + 5, 249, 38, 20, '#5a3a22'); setFont(1); textC(g, 'FOX', x0 + 24, 254, '#ffe08a'); setFont(2);
      rect(g, x0 + 8, 346, 44, 94, DK);
      for (let k = 0; k < 6; k++) rect(g, x0 + 9, 347 + k * 16, 42, 16, mix('#ffe2a0', '#c8783a', k / 5));
      for (let k = 0; k < 2; k++) { const nx = x0 + 9 + k * 21; rect(g, nx, 347, 20, 14, '#2f6ab0'); rect(g, nx, 347, 20, 2, '#1e4a80'); }
      ell(g, x0 + 30, 354, 4, 4, '#fbf6ea'); ell(g, x0 + 32, 353, 3, 3, '#2f6ab0');
    }
    // ---- the ramen stall ----
    const L = 296, Rr = 664;
    plaster(g, L, 210, Rr - L, 146, '#cdb58a', 41);
    ao(g, L, 210, Rr - L, 146, 'top', 22, 0.5);
    wood(g, L, 356, Rr - L, 84, '#5e3f26', 18, true, 43); ao(g, L, 356, Rr - L, 84, 'top', 8, 0.5);
    rect(g, L, 355, Rr - L, 2, DK);
    post(g, L - 6, 206, 12, 234, '#7a5230'); post(g, Rr - 6, 206, 12, 234, '#7a5230');
    // windows either side of the door (shuttered while the stall is for rent)
    if (O) { litWindow(g, 322, 268, 64, 58, '#6e4a2c', 4, 3); litWindow(g, 574, 268, 64, 58, '#6e4a2c', 4, 3); }
    else {
      SCENE.frameRect(g, 322, 268, 64, 58, '#6e4a2c', 4); SCENE.frameRect(g, 574, 268, 64, 58, '#6e4a2c', 4);
      shutter(g, 322, 268, 64, 58); shutter(g, 574, 268, 64, 58);
      // the For Rent note pinned to the left shutter
      rect(g, 331, 279, 46, 36, DK); rect(g, 332, 280, 44, 34, '#f1e2bf'); rect(g, 372, 280, 4, 34, '#d8c49a');
      setFont(1); textC(g, 'FOR', 354, 284, '#8a2a1a'); textC(g, 'RENT', 354, 296, '#8a2a1a'); setFont(2);
      rect(g, 338, 309, 30, 1, '#b8a07a'); rect(g, 353, 281, 3, 3, '#c8443a');
    }
    // doorway: the warm room inside (or a dark, empty one)
    rect(g, 406, 248, 148, 194, DK);
    if (O) {
      for (let k = 0; k < 8; k++) rect(g, 408, 250 + k * 24, 144, 24, mix('#ffdc96', '#b8642e', k / 7));
      rect(g, 408, 372, 144, 10, '#6e4a2c'); rect(g, 408, 372, 144, 2, '#a57a4c'); rect(g, 408, 382, 144, 58, '#4a2e1a');
      for (const sx of [426, 470, 514]) { rect(g, sx, 392, 18, 6, DK); rect(g, sx + 1, 393, 16, 4, '#8a5a32'); rect(g, sx + 7, 398, 4, 40, DK); }
      ao(g, 408, 250, 144, 190, 'left', 14, 0.35); ao(g, 408, 250, 144, 190, 'right', 18, 0.45);
    } else {
      for (let k = 0; k < 8; k++) rect(g, 408, 250 + k * 24, 144, 24, mix('#4a3a3a', '#1e1618', k / 7));
      rect(g, 408, 372, 144, 10, '#3a2a22'); rect(g, 408, 372, 144, 2, '#5a4232'); rect(g, 408, 382, 144, 58, '#221614');
      // stools stacked upside down on the counter
      for (const [sx, k] of [[428, 0], [484, 0], [492, 1]]) {
        const y = 366 - k * 14;
        rect(g, sx, y, 22, 6, DK); rect(g, sx + 1, y + 1, 20, 4, '#5a3a22');
        for (const lx of [sx + 3, sx + 15]) { rect(g, lx, y - 12, 4, 12, DK); rect(g, lx + 1, y - 12, 2, 12, '#4a2e1a'); }
      }
      // a pale shaft of light falling through the doorway
      g.globalAlpha = 0.08; poly(g, [[440, 250], [480, 250], [540, 440], [470, 440]], '#fff2d0'); g.globalAlpha = 0.06; poly(g, [[450, 250], [470, 250], [520, 440], [490, 440]], '#fff2d0'); g.globalAlpha = 1;
      ao(g, 408, 250, 144, 190, 'left', 14, 0.45); ao(g, 408, 250, 144, 190, 'right', 18, 0.55);
      // the noren rolled up and tied under the beam
      rect(g, 404, 250, 152, 12, DK); rect(g, 405, 251, 150, 10, '#2f3f78'); rect(g, 405, 251, 150, 3, '#41539a'); rect(g, 405, 258, 150, 2, '#24315f');
      for (const tx of [430, 530]) { rect(g, tx, 249, 3, 14, '#e8dcc0'); rect(g, tx - 1, 262, 5, 4, '#e8dcc0'); }
    }
    // roof: blue tiles with upturned eaves and a ridge
    poly(g, [[250, 212], [710, 212], [654, 150], [306, 150]], DK);
    poly(g, [[253, 210], [707, 210], [652, 152], [308, 152]], '#3e3a5a');
    for (let y = 156; y < 210; y += 6) { const k = (y - 150) / 60; rect(g, 306 - k * 54, y, 348 + k * 108, 1, '#2a2644'); rect(g, 306 - k * 54, y + 1, 348 + k * 108, 1, '#5a5680'); }
    for (let x = 320; x < 650; x += 14) line(g, x, 153, 480 + (x - 480) * 1.17, 209, '#34304e');
    poly(g, [[236, 214], [256, 206], [262, 212]], DK); poly(g, [[724, 214], [704, 206], [698, 212]], DK);
    rect(g, 300, 142, 360, 10, DK); rect(g, 301, 143, 358, 8, '#2e2a46'); rect(g, 301, 143, 358, 2, '#5a5680');
    for (const ex of [296, 650]) { rect(g, ex, 134, 14, 18, DK); rect(g, ex + 1, 135, 12, 16, '#2e2a46'); rect(g, ex + 1, 135, 12, 2, '#6a6690'); }
    rect(g, 590, 112, 22, 32, DK); rect(g, 591, 113, 20, 31, '#5a4a52'); rect(g, 591, 113, 4, 31, '#7a6a72'); rect(g, 588, 110, 26, 6, DK); rect(g, 589, 111, 24, 4, '#4a3a42');
    // beam under the eaves
    rect(g, 284, 210, 392, 12, DK); wood(g, 285, 211, 390, 10, '#4a3226', 10, false, 47); rect(g, 285, 211, 390, 1, '#8a623c');
    ao(g, L, 222, Rr - L, 20, 'top', 12, 0.45);
    // vertical RAMEN board beside the door (gold trim and a medallion with the menu board upgrades)
    const tr = TS.sign ? '#e0b040' : DK;
    rect(g, 668, 236, 26, 112, DK); if (TS.sign) { rect(g, 667, 235, 28, 114, '#e0b040'); rect(g, 668, 236, 26, 112, DK); }
    rect(g, 669, 237, 24, 110, '#8a2a1a'); rect(g, 669, 237, 3, 110, '#b2402a'); rect(g, 689, 237, 4, 110, '#5e1a10');
    'RAMEN'.split('').forEach((ch, i) => textC(g, ch, 681, 248 + i * 19, '#f6e6c0'));
    rect(g, 666, 230, 30, 6, DK); rect(g, 667, 231, 28, 4, TS.sign ? '#c9962e' : '#4a3226');
    if (TS.sign === 2) { ell(g, 681, 352, 7, 7, DK); ell(g, 681, 352, 6, 6, '#e0b040'); ell(g, 680, 351, 3, 3, '#ffe08a'); }
    void tr;
    // ---- decor and upgrades on the stall front ----
    if (TS.deco.includes(0)) {   // a blossom branch arching over the left window
      line(g, 300, 262, 330, 250, '#3a2420', 3); line(g, 330, 250, 372, 256, '#3a2420', 2); line(g, 350, 252, 366, 242, '#3a2420', 1);
      for (const [bx, by] of [[308, 258], [320, 252], [334, 248], [346, 252], [358, 250], [370, 255], [362, 242], [326, 246]]) { ell(g, bx, by, 4, 3, '#d88aa8'); ell(g, bx - 1, by - 1, 2, 1, '#ffd0dc'); dot(g, bx, by, '#c85a7a'); }
    }
    if (TS.deco.includes(2)) {   // a street-food banner (nobori) on its pole by the lamp
      rect(g, 246, 290, 3, 156, DK); rect(g, 247, 290, 1, 156, '#8a623c');
      rect(g, 249, 296, 18, 84, DK); rect(g, 250, 297, 16, 82, '#c8443a'); rect(g, 250, 297, 16, 6, '#e8dcc0'); rect(g, 250, 373, 16, 6, '#e8dcc0');
      setFont(1); 'RAMEN'.split('').forEach((ch, i) => textC(g, ch, 258, 307 + i * 13, '#fff2d8')); setFont(2);
    }
    if (TS.deco.includes(4)) {   // a glass fishing float in its rope net, under the right eave
      rect(g, 640, 222, 1, 16, '#3a2a22'); ell(g, 640, 246, 9, 9, DK); ell(g, 640, 246, 8, 8, '#4aa88a'); ell(g, 637, 243, 3, 3, '#a8f0d8');
      for (const k of [-5, 0, 5]) line(g, 640 + k, 238, 640 + k, 254, '#c8b088'); line(g, 632, 246, 648, 246, '#c8b088');
    }
    if (TS.cat && O) {   // the lucky cat in the left window
      const cx = 338, by = 325;
      ell(g, cx, by - 6, 7, 6, DK); ell(g, cx, by - 6, 6, 5, '#fbf6ea'); ell(g, cx, by - 15, 6, 5, DK); ell(g, cx, by - 15, 5, 4, '#fbf6ea');
      rect(g, cx - 4, by - 11, 9, 2, '#c8302a'); dot(g, cx - 2, by - 16, DK); dot(g, cx + 2, by - 16, DK); rect(g, cx + 5, by - 21, 3, 6, DK); rect(g, cx + 6, by - 20, 1, 4, '#fbf6ea');
    }
    if (TS.plant) {   // a herb planter on the right window sill
      rect(g, 574, 326, 64, 8, DK); rect(g, 575, 327, 62, 6, '#8a5a32'); rect(g, 575, 327, 62, 1, '#b07c48');
      for (let k = 0; k < 9; k++) { const hx = 579 + k * 7; line(g, hx, 326, hx + (k % 2 ? 2 : -2), 318 - (k % 3) * 2, '#3e7a34', 2); dot(g, hx + (k % 2 ? 2 : -2), 317 - (k % 3) * 2, '#8cc46a'); }
    }
    if (TS.deco.includes(3)) { rect(g, 438, 225, 84, 20, DK); rect(g, 439, 226, 82, 18, '#1a1426'); }   // the neon sign's backing board (the tubes glow live)
    if (R === 3) { rect(g, 104, 252, 30, 70, DK); rect(g, 105, 253, 28, 68, '#1a1426'); }   // Neon Capital: the inn's neon sign board
    // stone step and the street
    rect(g, 392, 440, 176, 8, DK); rect(g, 393, 441, 174, 6, '#8a8090'); rect(g, 393, 441, 174, 1, '#b0a8b8');
    stones(g, 0, 448, VW, VH - 448);
    rect(g, 0, 440, VW, 8, '#3a3240'); rect(g, 0, 447, VW, 1, DK);
    ao(g, 0, 448, VW, 92, 'top', 18, 0.5);
    if (R === 2) {   // Canal Market: the street runs along a canal
      rect(g, 0, 518, VW, 5, DK); rect(g, 0, 519, VW, 3, '#9a92a2'); rect(g, 0, 519, VW, 1, '#c8c0d0');
      rect(g, 0, 523, VW, VH - 523, '#2a4468'); for (let y = 526; y < VH; y += 4) for (let x = (y * 13) % 31; x < VW; x += 31) rect(g, x, y, 10, 1, '#3a5a88');
    }
    if (O) {   // the warm doorway light spills out over the cobbles in a stepped pool
      stepped(g, 480, 456, 170, 34, '#ffb060', 0.05, 4);
      stepped(g, 480, 452, 90, 16, '#ffd090', 0.05, 3);
      pool(g, 354, 452, 90, 22, '#ffb060', 0.05); pool(g, 606, 452, 90, 22, '#ffb060', 0.05);
    }
    // quest board in front of the inn
    SCENE.contact(g, 186, 448, 56, 5);
    for (const px of [140, 228]) { rect(g, px - 1, 372, 8, 76, DK); rect(g, px, 372, 6, 76, '#5e3f26'); rect(g, px, 372, 2, 76, '#8a623c'); }
    rect(g, 128, 360, 116, 64, DK); wood(g, 129, 361, 114, 62, '#7a5230', 12, false, 71);
    poly(g, [[124, 362], [248, 362], [236, 350], [136, 350]], DK); poly(g, [[127, 361], [245, 361], [234, 352], [138, 352]], '#4a3226');
    setFont(1); textC(g, 'QUESTS', 186, 355, '#f6e6c0'); setFont(2);
    for (const [nx, ny, nw, nh, cc] of [[133, 368, 28, 34, '#f1e2bf'], [164, 365, 48, 42, '#f6ecd4'], [215, 370, 24, 30, '#e8d4a8']]) {
      rect(g, nx - 1, ny - 1, nw + 2, nh + 2, DK); rect(g, nx, ny, nw, nh, cc); rect(g, nx + nw - 2, ny, 2, nh, shade(cc, 0.85));
      for (let ly = ny + 12; ly < ny + nh - 3; ly += 4) rect(g, nx + 3, ly, nw - 8, 1, '#b8a07a');
      rect(g, nx + nw / 2 - 1, ny + 1, 3, 3, '#c8443a');
    }
    setFont(1); textC(g, 'WANTED', 188, 371, '#8a2a1a'); setFont(2); ell(g, 188, 390, 7, 5, DK); ell(g, 188, 390, 6, 4, '#5ec44a'); rect(g, 185, 389, 1, 2, DK); rect(g, 190, 389, 1, 2, DK); rect(g, 170, 398, 36, 1, '#b8a07a'); rect(g, 176, 402, 24, 1, '#b8a07a');
    // barrels by the lamp
    for (const [bx, by] of [[250, 418], [292, 422]]) {
      SCENE.contact(g, bx, by + 28, 16, 3);
      rect(g, bx - 13, by - 1, 26, 30, DK); rect(g, bx - 12, by, 24, 28, '#8a5a32');
      rect(g, bx - 12, by, 5, 28, '#b07c48'); rect(g, bx + 6, by, 6, 28, '#5e3a1e');
      for (const hy of [by + 5, by + 21]) { rect(g, bx - 13, hy, 26, 3, DK); rect(g, bx - 12, hy, 24, 1, '#7b8494'); }
      ell(g, bx, by, 12, 3, DK); ell(g, bx, by, 11, 2, '#6e4a2c');
    }
    // potted shrubs either side of the door
    for (const px of [378, 582]) {
      SCENE.contact(g, px, 446, 14, 3);
      poly(g, [[px - 11, 426], [px + 11, 426], [px + 8, 446], [px - 8, 446]], DK); poly(g, [[px - 10, 427], [px + 10, 427], [px + 7, 445], [px - 7, 445]], '#a8582e');
      rect(g, px - 10, 427, 20, 3, '#c8744a');
      ell(g, px, 414, 14, 13, DK); ell(g, px, 414, 13, 12, O ? '#3e7a34' : '#5a6a3a'); ell(g, px - 3, 410, 8, 7, O ? '#5e9c4a' : '#6e7a4a'); ell(g, px - 5, 407, 3, 2, O ? '#8cc46a' : '#8a9060');
      if (O) for (const [fx, fy] of [[-6, 6], [5, -4], [8, 5]]) { dot(g, px + fx, 414 + fy, '#f2a2b8'); dot(g, px + fx + 1, 414 + fy, '#ffd0dc'); }
    }
    // Lantern City: the strings the extra lanterns hang from
    if (R === 1) for (const [x0, y0, x1, y1] of LSTRINGS) { let px = x0, py = y0; for (let i = 1; i <= 20; i++) { const u = i / 20, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * 10; line(g, px, py, x, y, '#2a1a14'); px = x; py = y; } }
    return c;
  }
  const LSTRINGS = [[12, 250, 244, 262], [716, 262, 905, 250]];

  /* ---------- foreground: props on the cobbles and a framing branch (cached) ---------- */
  function buildProps() {
    const c = mk(VW + 20, VH), g = c.getContext('2d'), o = 10;
    // a parked delivery cart in front of the inn
    { const x = 30 + o, y = 498;
      SCENE.contact(g, x + 44, y, 50, 5);
      rect(g, x + 2, y - 30, 80, 18, DK); wood(g, x + 3, y - 29, 78, 16, '#9a6a3a', 16, false, 501); rect(g, x + 3, y - 29, 78, 1, '#c89058');
      for (const [sx, c2] of [[x + 8, '#c8b088'], [x + 26, '#b8a078']]) { ell(g, sx + 8, y - 36, 10, 8, DK); ell(g, sx + 8, y - 36, 9, 7, c2); rect(g, sx + 5, y - 44, 6, 3, shade(c2, 0.8)); }
      rect(g, x + 46, y - 46, 26, 17, DK); wood(g, x + 47, y - 45, 24, 15, '#b8864e', 15, false, 503); rect(g, x + 50, y - 40, 18, 5, '#f1e2bf');
      line(g, x + 82, y - 24, x + 112, y - 10, DK, 4); line(g, x + 82, y - 25, x + 112, y - 11, '#7a5232', 2);
      ell(g, x + 40, y - 9, 11, 11, DK); ell(g, x + 40, y - 9, 10, 10, '#6e4a2c'); ell(g, x + 40, y - 9, 7, 7, '#4a3226');
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI; line(g, x + 40 - Math.cos(a) * 7, y - 9 - Math.sin(a) * 7, x + 40 + Math.cos(a) * 7, y - 9 + Math.sin(a) * 7, '#8a623c'); }
      ell(g, x + 40, y - 9, 2, 2, '#c9a468');
    }
    // a crate of cabbages by the quest board
    { const x = 150 + o, y = 500;
      SCENE.contact(g, x + 22, y, 26, 4);
      for (const [cx, cy] of [[x + 9, y - 26], [x + 22, y - 28], [x + 34, y - 25], [x + 15, y - 31], [x + 29, y - 32]]) { ell(g, cx, cy, 8, 7, DK); ell(g, cx, cy, 7, 6, '#6aa84a'); ell(g, cx - 2, cy - 2, 4, 3, '#a8d878'); line(g, cx, cy - 5, cx, cy + 4, '#4a8a3a'); }
      rect(g, x, y - 22, 44, 22, DK); wood(g, x + 1, y - 21, 42, 20, '#a8784a', 10, false, 505); rect(g, x + 1, y - 12, 42, 2, '#6e4a2c'); rect(g, x + 1, y - 21, 42, 1, '#d0a070');
    }
    // a sword and a round shield leaning on a barrel, in front of the tool shop
    { const x = 720 + o, y = 502;
      SCENE.contact(g, x, y, 22, 4);
      rect(g, x - 15, y - 34, 30, 34, DK); rect(g, x - 14, y - 33, 28, 32, '#8a5a32'); rect(g, x - 14, y - 33, 6, 32, '#b07c48'); rect(g, x + 7, y - 33, 7, 32, '#5e3a1e');
      for (const hy of [y - 28, y - 9]) { rect(g, x - 15, hy, 30, 3, DK); rect(g, x - 14, hy, 28, 1, '#7b8494'); }
      ell(g, x, y - 34, 14, 4, DK); ell(g, x, y - 34, 13, 3, '#6e4a2c');
      line(g, x + 18, y, x + 6, y - 50, DK, 5); line(g, x + 18, y, x + 6, y - 50, '#c8d0dc', 3); line(g, x + 17, y - 1, x + 6, y - 49, '#ffffff', 1);
      rect(g, x + 1, y - 40, 14, 3, DK); rect(g, x + 2, y - 39, 12, 1, '#c9962e'); line(g, x + 7, y - 40, x + 4, y - 52, '#6b4a34', 3);
      ell(g, x - 16, y - 18, 14, 15, DK); ell(g, x - 16, y - 18, 13, 14, '#4e7a9c'); ell(g, x - 16, y - 18, 9, 10, '#c8443a'); ell(g, x - 16, y - 18, 4, 4, '#e0b040'); ell(g, x - 20, y - 23, 3, 2, '#8ab0d0');
    }
    return c;
  }
  function buildBranch() {   // a branch or a hanging lantern cutting into the top-left corner, slightly darker than the scene
    const c = mk(260, 190), g = c.getContext('2d'), R = TS.region, d = 0.82;
    const twig = (x0, y0, x1, y1, w) => { line(g, x0, y0, x1, y1, DK, w + 2); line(g, x0, y0, x1, y1, shade('#4a2e22', d), w); };
    if (R === 1 || R === 3) {   // a big paper lantern on its cord
      rect(g, 70, 0, 2, 70, DK); rect(g, 52, 64, 38, 8, DK); rect(g, 53, 65, 36, 6, shade('#3a2a22', d));
      ell(g, 71, 102, 27, 32, DK); ell(g, 71, 102, 26, 31, shade(R === 3 ? '#d84a8a' : '#c8443a', d)); ell(g, 78, 102, 15, 30, shade(R === 3 ? '#b03a70' : '#a8342c', d)); ell(g, 61, 96, 6, 20, shade('#ff8a7a', d));
      for (let k = -3; k <= 3; k++) rect(g, 71 - Math.round(26 * Math.sqrt(1 - (k / 4) ** 2)), 102 + k * 8, Math.round(52 * Math.sqrt(1 - (k / 4) ** 2)), 1, shade('#7a1e18', d));
      rect(g, 52, 132, 38, 8, DK); rect(g, 53, 133, 36, 6, shade('#3a2a22', d)); rect(g, 68, 140, 6, 18, shade('#e0b040', d));
      setFont(3); textC(g, R === 3 ? '★' : '○', 71, 94, shade('#fff0c0', d)); setFont(2);
      return c;
    }
    twig(-10, 18, 120, 52, 7); twig(60, 36, 150, 30, 4); twig(110, 48, 190, 86, 4); twig(40, 30, 80, 80, 3); twig(150, 30, 200, 20, 2);
    const leaf = R === 0 ? [['#d88aa8', '#f2b8cc', '#ffe0ea'], 5, 4] : R === 2 ? [['#c84a2a', '#e8803a', '#f8b060'], 6, 4] : [['#2a5a3a', '#3e7a4a', '#5a9a5a'], 7, 2];
    const spots = [[20, 12], [44, 26], [70, 20], [96, 40], [124, 34], [148, 24], [176, 18], [196, 78], [168, 70], [132, 56], [84, 62], [62, 78], [100, 22], [30, 40], [188, 50]];
    for (const [x, y] of spots) {
      if (R === 4) { for (let k = -3; k <= 3; k++) line(g, x, y, x + k * 3, y + 9, shade(leaf[0][k & 1 ? 1 : 0], d), 1); continue; }   // pine needles
      ell(g, x, y, leaf[1] + 1, leaf[2] + 1, DK); ell(g, x, y, leaf[1], leaf[2], shade(leaf[0][0], d)); ell(g, x - 1, y - 1, leaf[1] - 2, Math.max(1, leaf[2] - 2), shade(leaf[0][1], d)); dot(g, x - 2, y - 2, shade(leaf[0][2], d));
    }
    return c;
  }

  /* ---------- the logo: a cached banner, letters that bob, steam from the bowls ---------- */
  const TITLE_TXT = 'COZY RAMEN';
  function buildLogo() {
    const c = mk(560, 150), g = c.getContext('2d');
    const B = [[40, 26], [520, 26], [500, 62], [520, 98], [40, 98], [60, 62]];
    poly(g, [[22, 34], [70, 34], [70, 100], [22, 100], [40, 67]], DK); poly(g, [[538, 34], [490, 34], [490, 100], [538, 100], [520, 67]], DK);
    poly(g, [[25, 36], [70, 36], [70, 98], [25, 98], [42, 67]], '#6e1a14'); poly(g, [[535, 36], [490, 36], [490, 98], [535, 98], [518, 67]], '#6e1a14');
    poly(g, B.map(([x, y]) => [x + (x < 280 ? -2 : 2), y + (y < 62 ? -2 : y > 62 ? 2 : 0)]), DK);
    poly(g, B, '#a8302a');
    poly(g, [[44, 28], [516, 28], [512, 36], [48, 36]], '#c8483a');
    poly(g, [[48, 90], [512, 90], [516, 96], [44, 96]], '#7a1e18');
    rect(g, 70, 31, 420, 2, '#e0b040'); rect(g, 70, 91, 420, 2, '#e0b040');
    SCENE.emblem(g, 280, 22, 0.56);   // the game's emblem (a bowl of ramen on a brass medallion) in the banner's centre
    rect(g, 106, 108, 348, 26, DK); wood(g, 107, 109, 346, 24, '#6e4a2c', 12, false, 91); rect(g, 107, 109, 346, 1, '#a57a4c');
    textC(g, "An Adventurers' Noodle Stall", 280, 116, '#f6e6c0');
    // each title letter on its own little canvas, placed where the whole word would put it
    setFont(5); const total = textW(TITLE_TXT), x0 = 280 - total / 2;
    letters = [...TITLE_TXT].map((ch, i) => {
      if (ch === ' ') return null;
      const lc = mk(70, 80), lg = lc.getContext('2d'); bigText(lg, ch, 35, 14, 5, '#ffd76a', '#fff2b8'); setFont(5);
      const cx = x0 + textW(TITLE_TXT.slice(0, i + 1)) - textW(ch) / 2;   // right edge of the word so far, less half this letter
      return { c: lc, x: Math.round(cx - 35), y: 45 - 14 };
    });
    setFont(2);
    return c;
  }
  function drawLogo(g) {
    const ly = 16 + (calm() ? 0 : Math.round(Math.sin(S.t * 1.2) * 2));
    g.drawImage(logo, 200, ly);
    letters.forEach((L, i) => { if (L) g.drawImage(L.c, 200 + L.x, ly + L.y + (calm() ? 0 : Math.round(Math.sin(S.t * 1.7 + i * 0.55) * 1.6))); });
    for (const bx of [104, 456]) ART.smallBowl(g, 200 + bx, ly + 64, { broth: true, noodles: 'perfect', items: ['chashu', 'egg', 'nori', 'scallion'] }, S.t);
    return ly;
  }

  /* ---------- guests at the stall: their portraits shrunk onto the stall's pixel grid ----------
     Each block keeps its most common colour (so edges stay crisp), then a 1px outline goes round the shape. Seen
     from behind, the face is covered with the hair colour. */
  const sprCache = {};
  const DKRGB = [parseInt(DK.slice(1, 3), 16), parseInt(DK.slice(3, 5), 16), parseInt(DK.slice(5, 7), 16)];
  function shrink(id, backView) {
    const key = id + (backView ? ':b' : ':f'); if (key in sprCache) return sprCache[key];
    const gt = GUESTS.find(x => x.id === id), img = H.IMG[id];
    if (!gt || !img || !img.naturalWidth) return null;
    const Hs = gt.bottom - gt.head, sc = 62 / Hs, iw = img.naturalWidth, ih = img.naturalHeight;
    const x0 = Math.max(0, Math.round(gt.ax - 0.32 * Hs)), x1 = Math.min(iw, Math.round(gt.ax + 0.32 * Hs));
    const y0 = Math.max(0, gt.head - 2), y1 = Math.min(ih, gt.head + Math.round(Hs * (backView ? 0.53 : 1)) + 1);
    const W = Math.max(1, Math.round((x1 - x0) * sc)), Hh = Math.max(1, Math.round((y1 - y0) * sc));
    let data;
    try { const cv = mk(iw, ih), cg = cv.getContext('2d'); cg.drawImage(img, 0, 0); data = cg.getImageData(0, 0, iw, ih).data; }
    catch (e) { return (sprCache[key] = null); }   // (an image the browser will not let us read: no seated guest)
    const out = new Uint8ClampedArray(W * Hh * 4);
    for (let oy = 0; oy < Hh; oy++) for (let ox = 0; ox < W; ox++) {
      const sx0 = Math.floor(x0 + ox / sc), sx1 = Math.max(sx0 + 1, Math.floor(x0 + (ox + 1) / sc)), sy0 = Math.floor(y0 + oy / sc), sy1 = Math.max(sy0 + 1, Math.floor(y0 + (oy + 1) / sc));
      const cnt = new Map(); let tr = 0, tot = 0;
      for (let sy = sy0; sy < sy1 && sy < ih; sy++) for (let sx = sx0; sx < sx1 && sx < iw; sx++) {
        const q = (sy * iw + sx) * 4; tot++;
        if (data[q + 3] < 128) { tr++; continue; }
        const k = ((data[q] >> 4) << 8) | ((data[q + 1] >> 4) << 4) | (data[q + 2] >> 4), e = cnt.get(k);
        if (e) e.n++; else cnt.set(k, { n: 1, q });
      }
      if (!tot || tr * 2 >= tot) continue;
      let best = null; for (const e of cnt.values()) if (!best || e.n > best.n) best = e;
      const p = (oy * W + ox) * 4; out[p] = data[best.q]; out[p + 1] = data[best.q + 1]; out[p + 2] = data[best.q + 2]; out[p + 3] = 255;
    }
    const ax = (gt.ax - x0) * sc;
    const nk = Math.round((gt.head + Hs * 0.19 - y0) * sc);   // the neck row
    if (backView) {   // seen from behind: the head is all hair, the body the back of the clothes (two cel tones)
      const opq = (x, y) => x >= 0 && y >= 0 && x < W && y < Hh && out[(y * W + x) * 4 + 3] > 0;
      const edge = (x, y) => !opq(x - 1, y) || !opq(x + 1, y) || !opq(x, y - 1) || !opq(x, y + 1);
      const mode = (y0r, y1r, ok) => { const cnt = new Map(); for (let y = y0r; y < y1r; y++) for (let x = 0; x < W; x++) { const p = (y * W + x) * 4; if (!out[p + 3] || !ok(out[p], out[p + 1], out[p + 2])) continue; const k = out[p] << 16 | out[p + 1] << 8 | out[p + 2]; cnt.set(k, (cnt.get(k) || 0) + 1); } let bk = -1, bn = 0; for (const [k, n] of cnt) if (n > bn) { bn = n; bk = k; } return bk; };
      const skin = (r, g2, b2) => r > 150 && r > g2 && g2 > b2 && r - b2 > 35 && r - b2 < 140;
      const dark = (r, g2, b2) => r + g2 + b2 < 90;
      let hair = mode(0, Math.min(4, Hh), (r, g2, b2) => !skin(r, g2, b2) && !dark(r, g2, b2)); if (hair < 0) hair = 0x3a2a22;
      let cloth = mode(nk + 2, Hh, (r, g2, b2) => !skin(r, g2, b2) && !dark(r, g2, b2)); if (cloth < 0) cloth = 0x4a3a5a;
      const tone = (k, m) => [Math.min(255, Math.round((k >> 16) * m)), Math.min(255, Math.round(((k >> 8) & 255) * m)), Math.min(255, Math.round((k & 255) * m))];
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        if (!opq(x, y) || edge(x, y)) continue;
        const p = (y * W + x) * 4, head = y < nk, k = head ? hair : cloth;
        const m = head ? (y < 3 && x < ax ? 1.22 : x > ax + 2 ? 0.84 : 1) : (x > ax + W * 0.12 ? 0.8 : x < ax - W * 0.2 ? 1.12 : 1);
        if (!head && skin(out[p], out[p + 1], out[p + 2]) && Math.abs(x - ax) > W * 0.28) continue;   // bare arms at the sides stay
        const c = tone(k, m); out[p] = c[0]; out[p + 1] = c[1]; out[p + 2] = c[2];
      }
    }
    // the outline, on a canvas one pixel bigger all round
    const cw = W + 2, ch = Hh + 2, c = mk(cw, ch), g = c.getContext('2d'), im = g.createImageData(cw, ch), d = im.data;
    const op = (x, y) => x >= 0 && y >= 0 && x < W && y < Hh && out[(y * W + x) * 4 + 3] > 0;
    for (let y = -1; y <= Hh; y++) for (let x = -1; x <= W; x++) {
      const p = ((y + 1) * cw + x + 1) * 4;
      if (op(x, y)) { const s = (y * W + x) * 4; d[p] = out[s]; d[p + 1] = out[s + 1]; d[p + 2] = out[s + 2]; d[p + 3] = 255; }
      else if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) { d[p] = DKRGB[0]; d[p + 1] = DKRGB[1]; d[p + 2] = DKRGB[2]; d[p + 3] = 255; }
    }
    g.putImageData(im, 0, 0);
    // the legs' colour: the commonest colour around the knees in the full portrait
    const lc = new Map();
    for (let sy = Math.round(gt.head + Hs * 0.72); sy < Math.round(gt.head + Hs * 0.86); sy++) for (let sx = Math.round(gt.ax - 6); sx < gt.ax + 6; sx++) {
      const q = (sy * iw + sx) * 4; if (data[q + 3] < 128) continue; const k = ((data[q] >> 4) << 8) | ((data[q + 1] >> 4) << 4) | (data[q + 2] >> 4); const e = lc.get(k); if (e) e.n++; else lc.set(k, { n: 1, q });
    }
    let lb = null; for (const e of lc.values()) if (!lb || e.n > lb.n) lb = e;
    const leg = lb ? '#' + [0, 1, 2].map(k => data[lb.q + k].toString(16).padStart(2, '0')).join('') : '#4a3a5a';
    return (sprCache[key] = { c, w: cw, h: ch, ax: Math.round(ax) + 1, neck: nk + 1, leg });
  }

  const STOOLS = [435, 479, 523], SEAT_Y = 393;
  let seats = [null, null, null];
  const newSeat = (id, a) => ({ id, a, fade: 0, ph: Math.random() * 6, slurp: rand(3, 8), slurpT: -1, turn: rand(4, 10), turnT: -1, turnDir: 1, toast: -1 });
  const guestPool = () => metIds().filter(id => H.IMG[id] && GUESTS.some(g => g.id === id) && id !== 'aoi');
  function seatGuests() {
    seats = [null, null, null]; if (!TS.open) return;
    const pool = shuffle(guestPool()), n = Math.min(pool.length, Math.random() < 0.5 ? 2 : 3), order = shuffle([0, 1, 2]);
    for (let k = 0; k < n; k++) seats[order[k]] = newSeat(pool[k], 1);
  }
  function updateSeats(dt) {
    seats.forEach((s, i) => {
      if (!s) return;
      if (s.fade) { s.a = clamp(s.a + s.fade * dt / 0.6, 0, 1); if (s.a <= 0 && s.fade < 0) { seats[i] = null; return; } if (s.a >= 1) s.fade = 0; }
      s.slurp -= dt; if (s.slurp <= 0 && s.slurpT < 0) { s.slurpT = 0; s.slurp = rand(5, 9); }
      if (s.slurpT >= 0) { const was = s.slurpT; s.slurpT += dt; if (was < 0.6 && s.slurpT >= 0.6) puffs.push({ type: 'steam', x: STOOLS[i] + rand(-4, 4), y: 350, vx: 0, vy: -12, life: 1, max: 1 }); if (s.slurpT > 1.2) s.slurpT = -1; }
      s.turn -= dt; if (s.turn <= 0 && s.turnT < 0) { s.turnT = 0; s.turn = rand(6, 12); const nb = [i - 1, i + 1].filter(j => seats[j]); s.turnDir = nb.length ? Math.sign(STOOLS[pick(nb)] - STOOLS[i]) : pick([-1, 1]); }
      if (s.turnT >= 0) { s.turnT += dt; if (s.turnT > 1.6) s.turnT = -1; }
      if (s.toast >= 0) { s.toast += dt; if (s.toast > 2.6) s.toast = -1; }
    });
  }
  function drawSeat(g, i) {
    const s = seats[i]; if (!s) return; const spr = shrink(s.id, true); if (!spr) return;
    const cx = STOOLS[i], lean = s.slurpT >= 0 ? Math.round(Math.sin(Math.min(1, s.slurpT / 1.2) * Math.PI) * 2) : 0;
    const turn = s.turnT >= 0 ? s.turnDir * (s.turnT < 0.2 || s.turnT > 1.4 ? 1 : 2) : 0;
    g.globalAlpha = s.a;
    const sw = Math.sin(S.t * 2.4 + s.ph);   // legs swinging under the stool
    for (const k of [-1, 1]) {
      const lx = cx + k * 4, fy = SEAT_Y + 10 + Math.round(sw * k * 1.5);
      rect(g, lx - 2, SEAT_Y, 5, fy - SEAT_Y, DK); rect(g, lx - 1, SEAT_Y, 3, fy - SEAT_Y - 1, spr.leg);
      rect(g, lx - 2, fy - 1, 5, 4, DK); rect(g, lx - 1, fy, 3, 2, '#3a2a22');
    }
    const x = Math.round(cx - spr.ax), y = SEAT_Y - spr.h + 3 - lean;
    g.drawImage(spr.c, 0, spr.neck, spr.w, spr.h - spr.neck, x, y + spr.neck, spr.w, spr.h - spr.neck);   // body
    g.drawImage(spr.c, 0, 0, spr.w, spr.neck, x + turn, y + (lean ? 1 : 0), spr.w, spr.neck);           // head (turns, dips to slurp)
    if (s.toast >= 0) {   // raising the bowl to the camera
      const up = Math.round(Math.sin(Math.min(1, s.toast / 0.4) * Math.PI / 2) * 10) - (s.toast > 2.2 ? Math.round((s.toast - 2.2) * 25) : 0);
      const bx = cx, by = y - 2 - up;
      line(g, cx - 6, y + spr.neck + 4, bx - 7, by + 4, DK, 4); line(g, cx + 6, y + spr.neck + 4, bx + 7, by + 4, DK, 4);
      ART.smallBowl(g, bx, by, { broth: true, noodles: 'perfect', items: ['chashu', 'egg'] }, S.t);
      if (s.toast > 0.4 && s.toast < 2.2 && Math.sin(S.t * 10) > 0) { dot(g, bx - 16, by - 10, '#fff6c0'); dot(g, bx + 18, by - 6, '#fff6c0'); rect(g, bx + 17, by - 9, 3, 1, '#fff6c0'); }
    }
    g.globalAlpha = 1;
  }
  // The chef behind the counter, ladling broth from the pot, steam rising.
  function chef(g) {
    const x = 500, f = Math.floor(S.t * 3) % 4, ay = [0, -3, -6, -3][f];
    g.save(); g.beginPath(); g.rect(408, 300, 144, 72); g.clip();
    rect(g, x - 10, 341, 21, 34, DK); rect(g, x - 9, 342, 19, 33, '#2f3f78'); rect(g, x - 6, 345, 13, 30, '#f2ece0'); rect(g, x - 6, 345, 13, 1, '#ffffff'); rect(g, x + 4, 345, 3, 30, '#d8d0c0');
    rect(g, x - 2, 340, 5, 3, '#e8b890');
    ell(g, x, 331, 8, 8, DK); ell(g, x, 331, 7, 7, '#f0c8a0'); ell(g, x - 2, 329, 3, 2, '#ffe0c0');
    rect(g, x - 7, 322, 15, 5, '#3a2a22'); rect(g, x - 8, 326, 17, 3, DK); rect(g, x - 7, 326, 15, 2, '#f6f0e4'); rect(g, x + 7, 325, 3, 2, '#f6f0e4');
    rect(g, x - 4, 331, 2, 2, DK); rect(g, x + 3, 331, 2, 2, DK); rect(g, x - 1, 335, 3, 1, '#a8604a');
    line(g, x - 8, 345, x - 12, 362, DK, 5); line(g, x - 8, 345, x - 12, 362, '#2f3f78', 3);   // the other arm resting
    const hx = x + 18, hy = 350 + ay;
    line(g, x + 8, 345, hx, hy, DK, 5); line(g, x + 8, 345, hx, hy, '#2f3f78', 3); rect(g, hx - 1, hy - 1, 3, 3, '#f0c8a0');
    line(g, hx, hy, hx + 16, hy + 12, DK, 3); line(g, hx, hy, hx + 16, hy + 12, '#c9962e', 1);   // the ladle
    ell(g, hx + 18, hy + 14, 4, 3, DK); ell(g, hx + 18, hy + 13, 3, 2, '#b87a3a');
    g.restore();
    // the stock pot on the counter, steaming
    rect(g, 528, 354, 22, 18, DK); rect(g, 529, 355, 20, 17, '#b87a3a'); rect(g, 529, 355, 4, 17, '#e09a58'); rect(g, 545, 355, 4, 17, '#7a4a22');
    ell(g, 539, 355, 12, 4, DK); ell(g, 539, 355, 11, 3, '#e09a58'); ell(g, 539, 356, 9, 2, '#c8792e');
  }

  /* ---------- people walking along the street ---------- */
  const PAL = [
    { skin: '#f0c8a0', hair: '#3a2a22', top: '#5a7a3a', legs: '#4a3a2a', boot: '#2a1a14' }, { skin: '#c89070', hair: '#1a1418', top: '#8a3a3a', legs: '#3a3a4a', boot: '#2a1a14' },
    { skin: '#f6d8b8', hair: '#c88a3a', top: '#3a5a8a', legs: '#5a4a3a', boot: '#3a2a1a' }, { skin: '#e0b088', hair: '#8a2a1a', top: '#6a4a7a', legs: '#2a2a3a', boot: '#1a1418' },
    { skin: '#a8705a', hair: '#e8e0d0', top: '#8a6a3a', legs: '#4a3a3a', boot: '#2a1a14' }
  ];
  const walkers = [];
  let walkT = 4;
  const WALK_Y = 474;
  function person(g, x, fy, dir, ph, o) {
    const f = dir, sw = Math.sin(ph), bob = Math.round(Math.abs(Math.cos(ph)) * 1.2), top = fy - 44 + bob, hip = fy - 15 + bob;
    const leg = (s, c) => { const fx = x + Math.round(s * 6 * f); line(g, x, hip, fx, fy - 2, DK, 6); line(g, x, hip, fx, fy - 2, c, 4); rect(g, fx - 3 + f, fy - 3, 7, 4, DK); rect(g, fx - 2 + f, fy - 3, 5, 2, o.boot); };
    if (o.cape) poly(g, [[x - 2 * f, top + 13], [x - 6 * f, top + 13], [x - (11 + Math.round(sw * 2)) * f, top + 38], [x - 2 * f, top + 36]], o.cape);
    leg(-sw, shade(o.legs, 0.75));
    if (o.pack) { rect(g, x - f * 13 - (f < 0 ? 0 : 0) - 1, top + 14, 9, 16, DK); rect(g, x - f * 13, top + 15, 7, 14, o.pack); rect(g, x - f * 13, top + 15, 7, 3, shade(o.pack, 1.2)); if (o.roll) { rect(g, x - f * 13 - 1, top + 11, 9, 5, DK); rect(g, x - f * 13, top + 12, 7, 3, o.roll); } }
    if (o.shield) { ell(g, x - f * 9, top + 24, 7, 9, DK); ell(g, x - f * 9, top + 24, 6, 8, o.shield); ell(g, x - f * 9, top + 24, 2, 2, '#e0b040'); }
    leg(sw, o.legs);
    rect(g, x - 7, top + 12, 14, 21, DK); rect(g, x - 6, top + 13, 12, 19, o.top); rect(g, x + (f > 0 ? 2 : -6), top + 13, 4, 19, shade(o.top, 0.8));
    if (o.apron) rect(g, x - 5 + f, top + 18, 9, 14, o.apron);
    rect(g, x - 6, top + 26, 12, 2, o.belt || '#3a2a1a');
    if (o.armor) { rect(g, x - 6, top + 13, 12, 3, shade(o.top, 1.3)); rect(g, x - 1, top + 16, 2, 10, shade(o.top, 1.25)); }
    const hy = top + 6;
    ell(g, x, hy, 7, 7, DK); ell(g, x, hy, 6, 6, o.skin);
    if (o.hat !== 'helm') { ell(g, x - f * 2, hy - 2, 6, 4, o.hair); rect(g, x - f * 6 - (f > 0 ? 0 : 1), hy - 2, 3, 7, o.hair); }
    dot(g, x + f * 3, hy, DK);
    if (o.hat === 'helm') { ell(g, x, hy - 1, 7, 7, DK); ell(g, x, hy - 1, 6, 6, '#a8b0bc'); rect(g, x - 1 + f * 2, hy - 1, 5, 2, DK); ell(g, x - 2, hy - 4, 2, 2, '#e0e6ee'); if (o.plume) { poly(g, [[x, hy - 7], [x - f * 4, hy - 14], [x - f * 12 - Math.round(sw * 2) * f, hy - 9], [x - f * 4, hy - 6]], DK); poly(g, [[x, hy - 7], [x - f * 4, hy - 13], [x - f * 10 - Math.round(sw * 2) * f, hy - 9], [x - f * 4, hy - 7]], o.plume); } }
    else if (o.hat === 'hood') { ell(g, x - f, hy - 1, 8, 8, DK); ell(g, x - f, hy - 1, 7, 7, o.cape || o.top); ell(g, x + f * 2, hy + 1, 4, 5, o.skin); dot(g, x + f * 3, hy, DK); }
    else if (o.hat === 'wizard') { poly(g, [[x - 9, hy - 3], [x + 9, hy - 3], [x - f * 6, hy - 20]], DK); poly(g, [[x - 8, hy - 4], [x + 8, hy - 4], [x - f * 5, hy - 18]], o.hatc || '#3a3a7a'); rect(g, x - 9, hy - 4, 18, 2, '#e0b040'); }
    else if (o.hat === 'cap') { rect(g, x - 7, hy - 8, 13, 5, DK); rect(g, x - 6, hy - 7, 11, 3, o.hatc || '#8a3a2a'); rect(g, x + (f > 0 ? 4 : -9), hy - 4, 6, 2, DK); }
    const hx = x + Math.round(-sw * 5 * f), hyy = top + 29;
    line(g, x + f, top + 15, hx, hyy, DK, 5); line(g, x + f, top + 15, hx, hyy, shade(o.top, 1.12), 3); rect(g, hx - 1, hyy - 1, 3, 3, o.skin);
    if (o.torch) {
      const tx = hx + 3 * f, ty = hyy - 15;
      line(g, hx, hyy, tx, ty, DK, 4); line(g, hx, hyy, tx, ty, '#7a5232', 2);
      const fl = Math.sin(S.t * 13 + x) > 0 ? 1 : 0;
      pool(g, tx, ty - 3, 30, 26, '#ffb050', 0.08, 3);
      ell(g, tx, ty - 3 - fl, 4, 5 + fl, DK); ell(g, tx, ty - 3 - fl, 3, 4 + fl, '#ff8a2a'); ell(g, tx, ty - 2, 2, 2, '#ffe08a');
    }
    if (o.staff) { line(g, hx, hyy + 8, hx + 2 * f, top - 6, DK, 4); line(g, hx, hyy + 8, hx + 2 * f, top - 6, '#8a623c', 2); ell(g, hx + 2 * f, top - 8, 3, 3, o.gem || '#8ad8ff'); }
    if (o.sword) { line(g, x - f * 3, hip - 2, x - f * 14, hip + 9, DK, 4); line(g, x - f * 3, hip - 2, x - f * 14, hip + 9, '#c8d0dc', 2); }
  }
  function cart(g, x, fy, dir, dist) {   // a merchant's handcart, pushed ahead
    const cx = x + dir * 30, wr = 9;
    line(g, x + dir * 6, fy - 22, cx - dir * 14, fy - 20, DK, 4); line(g, x + dir * 6, fy - 22, cx - dir * 14, fy - 20, '#7a5232', 2);
    rect(g, cx - 18, fy - 32, 36, 16, DK); wood(g, cx - 17, fy - 31, 34, 14, '#9a6a3a', 14, false, 77); rect(g, cx - 17, fy - 31, 34, 1, '#c89058');
    for (const [ox, c2] of [[-10, '#c8443a'], [-2, '#e0b040'], [6, '#6aa84a'], [12, '#c8443a']]) { ell(g, cx + ox, fy - 35, 4, 4, DK); ell(g, cx + ox, fy - 35, 3, 3, c2); }
    rect(g, cx - 4, fy - 46, 14, 12, DK); rect(g, cx - 3, fy - 45, 12, 10, '#c8b088');
    ell(g, cx, fy - wr, wr, wr, DK); ell(g, cx, fy - wr, wr - 1, wr - 1, '#6e4a2c'); ell(g, cx, fy - wr, wr - 3, wr - 3, '#4a3226');
    for (let k = 0; k < 3; k++) { const a = dist / wr * dir + k * Math.PI / 3; line(g, Math.round(cx - Math.cos(a) * 6), Math.round(fy - wr - Math.sin(a) * 6), Math.round(cx + Math.cos(a) * 6), Math.round(fy - wr + Math.sin(a) * 6), '#8a623c'); }
  }
  const WALKERS = {
    party: () => { const p = pick(PAL), q = pick(PAL), r = pick(PAL); return [
      { ...p, top: '#7a5a3a', pack: '#8a5a32', roll: '#c8443a', sword: true },
      { ...q, top: '#3a3a7a', hat: 'wizard', hatc: '#3a3a7a', torch: true, cape: '#2a2a5a' },
      { ...r, top: '#4a6a3a', hat: 'hood', cape: '#3a5a2a', staff: true, gem: '#8affb0', pack: '#6e4a2c' }]; },
    knight: () => [{ ...pick(PAL), top: '#8a929e', armor: true, hat: 'helm', plume: '#c8443a', shield: '#4e7a9c', sword: true, legs: '#6a7280', boot: '#3a3a44' }],
    merchant: () => [{ ...pick(PAL), top: '#a87a4a', apron: '#e8dcc0', hat: 'cap', hatc: '#5a7a3a' }],
    traveller: () => [{ ...pick(PAL), top: '#6a5a4a', hat: 'hood', cape: '#5a4a3a', staff: true, gem: '#e0b040', pack: '#8a5a32', roll: '#5a7a9a' }]
  };
  function spawnWalker(type, opts = {}) {
    const dir = opts.dir || (Math.random() < 0.5 ? 1 : -1);
    walkers.push({ type, people: WALKERS[type](), dir, x: opts.x !== undefined ? opts.x : dir > 0 ? -80 : VW + 80, d: 0, y: WALK_Y, a: opts.a === undefined ? 1 : opts.a,
      state: opts.state || 'walk', t: 0, stop: !!opts.stop, speed: type === 'merchant' ? 32 : 40 + Math.random() * 8 });
  }
  function updateWalkers(dt) {
    walkT -= dt;
    if (walkT <= 0) {
      walkT = rand(15, 30);
      const stop = TS.open && Math.random() < 1 / 3;
      spawnWalker(stop ? pick(['knight', 'traveller']) : pick(['party', 'knight', 'merchant', 'traveller']), { stop });
    }
    for (const w of walkers) {
      w.t += dt;
      if (w.state === 'walk') {
        const step = w.dir * w.speed * dt; w.x += step; w.d += Math.abs(step);
        if (w.stop && Math.abs(w.x - 480) < 3) { w.state = 'enter'; w.t = 0; }
      } else if (w.state === 'enter') {   // steps up into the stall and fades into the warm room
        w.y = WALK_Y - Math.min(1, w.t / 0.8) * 22; w.a = 1 - Math.min(1, w.t / 0.8);
        if (w.t >= 0.8) { w.done = true; swapGuest(-w.dir); }
      } else if (w.state === 'exit') {   // a guest who got up, stepping out of the door
        w.y = WALK_Y - 22 + Math.min(1, w.t / 0.8) * 22; w.a = Math.min(1, w.t / 0.8);
        if (w.t >= 0.8) { w.state = 'walk'; w.t = 0; }
      }
      if (w.x < -140 || w.x > VW + 140) w.done = true;
    }
    for (let i = walkers.length - 1; i >= 0; i--) if (walkers[i].done) walkers.splice(i, 1);
  }
  // Someone came in: a seated guest gets up and walks off the other way, and a new one takes the stool.
  function swapGuest(outDir) {
    const taken = seats.map((s, i) => (s ? i : -1)).filter(i => i >= 0), free = seats.map((s, i) => (s ? -1 : i)).filter(i => i >= 0);
    const seated = seats.filter(Boolean).map(s => s.id), pool = guestPool().filter(id => !seated.includes(id));
    let idx = free.length ? pick(free) : -1;
    if (taken.length && (!free.length || Math.random() < 0.7)) {
      const out = pick(taken); seats[out].fade = -1;
      setTimeout(() => spawnWalker('traveller', { x: 480, dir: outDir, state: 'exit', a: 0 }), 500);
      idx = out;
    }
    if (idx < 0 || !pool.length) return;
    const id = pick(pool);
    setTimeout(() => { if (!seats[idx]) seats[idx] = newSeat(id, 0), seats[idx].fade = 1; }, 1300);
  }
  function drawWalkers(g) {
    for (const w of walkers) {
      g.globalAlpha = w.a;
      w.people.forEach((o, k) => {
        const x = Math.round(w.x - w.dir * k * 26), ph = (w.d + k * 7) / 6;
        if (w.type === 'merchant') cart(g, x, Math.round(w.y), w.dir, w.d);
        person(g, x, Math.round(w.y), w.dir, w.state === 'walk' ? ph : 0, o);
      });
      g.globalAlpha = 1;
    }
  }

  /* ---------- sky, weather and the province's live details ---------- */
  function sky(g) {
    const N = TS.night;
    const bands = N ? [['#0a0a22', 0], ['#0e0e2c', 40], ['#141436', 80], ['#1a1a42', 130], ['#20204a', 180], ['#262650', 225], ['#2c2a56', 265], ['#322e5c', 300]]
      : [['#151538', 0], ['#1e1c48', 40], ['#2c2458', 80], ['#43306a', 130], ['#6a3c70', 180], ['#9a4a6a', 225], ['#cc6a5a', 265], ['#ea9058', 300]];
    bands.forEach(([c, y], i) => rect(g, 0, y, VW, (bands[i + 1] ? bands[i + 1][1] : 380) - y, c));
    for (let i = 0; i < (N ? 120 : 70); i++) {
      const x = (i * 137) % VW, y = 4 + (i * 53) % (N ? 230 : 190);
      if (Math.sin(S.t * 2 + i * 1.7) > -0.2) dot(g, x, y, i % 5 ? '#d8d0f0' : '#fff6d0');
      if (i % 11 === 0 && Math.sin(S.t * 2 + i) > 0.6) { dot(g, x - 1, y, '#8a80b0'); dot(g, x + 1, y, '#8a80b0'); dot(g, x, y - 1, '#8a80b0'); dot(g, x, y + 1, '#8a80b0'); }
    }
    if (N) stepped(g, 860, 74, 40, 40, '#fff2cc', 0.05, 3);
    ell(g, 860, 74, 17, 17, '#5a4a80'); ell(g, 860, 74, 15, 15, '#fff2cc'); ell(g, 866, 70, 13, 13, '#f2e2b8'); ell(g, 855, 79, 3, 2, '#e8d4a4'); ell(g, 864, 68, 2, 2, '#e8d4a4');
    // soft cloud bands drifting slowly
    for (const [y, w, sp, c] of [[96, 340, 3, N ? '#1a1a40' : '#4a3468'], [128, 260, 5, N ? '#1e1e46' : '#6a4072'], [160, 420, 2, N ? '#222250' : '#a85a6e']]) {
      for (let k = 0; k < 3; k++) { const x = ((k * 420 + S.t * sp) % (VW + w)) - w; rect(g, Math.round(x), y, w, 2, c); rect(g, Math.round(x) + 30, y - 2, w - 80, 2, c); rect(g, Math.round(x) + 60, y + 2, w - 140, 1, c); }
    }
    for (const [x0, y, w, sp] of [[100, 120, 90, 6], [500, 92, 120, 4], [760, 150, 80, 7]]) {
      const x = ((x0 + S.t * sp) % (VW + 240)) - 120;
      ell(g, x, y, w / 2, 6, N ? '#1c1c44' : '#4a3466'); ell(g, x + 14, y - 5, w / 3, 6, N ? '#22224c' : '#56406e'); ell(g, x - 4, y + 2, w / 2 - 6, 3, N ? '#16163a' : '#3c2c58');
    }
    if (EV.cur && EV.cur.kind === 'star') {   // a shooting star
      const p = EV.cur.t / EV.cur.dur, x = 80 + p * 520, y = 30 + p * 90;
      for (let k = 0; k < 14; k++) { g.globalAlpha = (1 - k / 14) * (1 - p * 0.6); rect(g, Math.round(x - k * 5), Math.round(y - k * 0.9), 3, 1, k ? '#d8d0f0' : '#ffffff'); }
      g.globalAlpha = 1;
    }
  }
  function weather(g) {
    if (TS.weather === 'rain') {
      g.fillStyle = 'rgba(190,210,250,0.5)';
      for (let i = 0; i < 80; i++) { const x = (rnd(i) * (VW + 60) + S.t * 60) % (VW + 60) - 30, y = (rnd(i * 3.3) * VH + S.t * 420) % VH; g.fillRect(Math.round(x), Math.round(y), 1, 6); }
    } else if (TS.weather === 'snow') {
      for (let i = 0; i < 60; i++) { const x = (rnd(i) * VW + Math.sin(S.t * 0.8 + i) * 12 + S.t * 8) % VW, y = (rnd(i * 2.1) * VH + S.t * (20 + (i % 3) * 8)) % VH; rect(g, Math.round(x), Math.round(y), i % 4 ? 1 : 2, i % 4 ? 1 : 2, '#f6f2ff'); }
    }
  }
  function regionLive(g) {
    const R = TS.region, t = S.t, gx = 1 + S.gust * 4;
    if (R === 0) for (let i = 0; i < 22; i++) {   // drifting petals
      const x = ((i * 97 + t * (18 + S.gust * 80) + Math.sin(t + i) * 10) % (VW + 40)) - 20, y = ((i * 53 + t * (14 + (i % 4) * 3)) % 560) - 20;
      rect(g, Math.round(x), Math.round(y), 2, 2, i % 3 ? '#f2b8cc' : '#ffe0ea'); if (i % 2) dot(g, Math.round(x) + 2, Math.round(y) + 1, '#d88aa8');
    }
    if (R === 1) for (const [x0, y0, x1, y1] of LSTRINGS) for (let k = 1; k < 6; k++) {   // extra paper lanterns on strings
      const u = k / 6, x = Math.round(x0 + (x1 - x0) * u + Math.sin(t * 1.5 + k) * gx), y = Math.round(y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * 10);
      if (lit(x)) pool(g, x, y + 10, 18, 14, '#ffb060', 0.07);
      ell(g, x, y + 9, 6, 8, DK); ell(g, x, y + 9, 5, 7, lit(x) ? (k % 2 ? '#c8443a' : '#e0b040') : '#5a3a3a'); ell(g, x - 2, y + 7, 1, 3, lit(x) ? '#ffd0a0' : '#6a4a4a'); rect(g, x - 3, y, 7, 2, DK); rect(g, x - 3, y + 16, 7, 2, DK);
    }
    if (R === 2) for (const [px, base] of [[60, 196], [210, 196], [760, 196], [880, 196]]) {   // market flags on the rooftops
      rect(g, px - 1, base - 46, 3, 46, DK); rect(g, px, base - 46, 1, 46, '#8a623c');
      const fl = Math.round(Math.sin(t * 3 + px) * 2 * gx), c = ['#c8443a', '#e0b040', '#4e7a9c', '#5e9c4a'][(px / 10) % 4 | 0];
      poly(g, [[px + 1, base - 45], [px + 26, base - 40 + fl], [px + 1, base - 33]], DK); poly(g, [[px + 2, base - 44], [px + 23, base - 40 + fl], [px + 2, base - 34]], c);
    }
    if (R === 2) for (let i = 0; i < 12; i++) { const x = ((i * 83 + t * 10) % (VW + 20)) - 10; rect(g, Math.round(x), 527 + (i % 4) * 3, 6, 1, '#7a9ad0'); }   // the canal's shimmer
    if (R === 3) {   // the inn's neon sign, and the glow of the city
      const on = Math.sin(t * 9) > -0.85 || Math.sin(t * 2.3) > 0;
      if (on) pool(g, 119, 287, 40, 50, '#ff5ab8', 0.08, 3);
      setFont(1); 'NOODLE'.split('').forEach((ch, i) => textC(g, ch, 119, 256 + i * 11, on ? '#ff8ad8' : '#5a2a4a')); setFont(2);
    }
    if (R === 4) {   // gulls over the sea, and the lighthouse beam
      for (let k = 0; k < 3; k++) {
        const x = ((k * 330 + t * (16 + k * 4)) % (VW + 60)) - 30, y = 120 + k * 22 + Math.sin(t * 0.8 + k) * 6, fl = Math.sin(t * 6 + k) > 0 ? 2 : 0;
        line(g, Math.round(x) - 5, Math.round(y) - fl, Math.round(x), Math.round(y), '#e8e8f0'); line(g, Math.round(x), Math.round(y), Math.round(x) + 5, Math.round(y) - fl, '#e8e8f0');
      }
      const a = t * 0.9, s = Math.cos(a);
      if (s > 0) { g.globalAlpha = 0.12 * s; const dx = Math.sin(a) * 260; poly(g, [[886 + S.px * 3, 108], [886 + dx + S.px * 3, 92], [886 + dx + S.px * 3, 124]], '#fff2c0'); g.globalAlpha = 1; }
    }
  }

  /* ---------- lanterns: lit one by one, left to right, as the title opens ---------- */
  const lit = x => TS.open && S.intro > 0.3 + (x / VW) * 1.0;
  function lanternList() {
    const L = [[392, 232, 12, '#c8443a'], [568, 232, 12, '#c8443a']];
    if (TS.deco.includes(1)) L.push([322, 226, 10, '#e0b040']);
    for (const x of [314, 342, 618, 646].slice(0, TS.kits)) L.push([x, 228, 6, '#c8443a']);
    return L;
  }
  function lanterns(g) {
    const nightK = TS.night ? 1.7 : 1;
    for (const [x, y, r, c] of lanternList()) {
      const sw = Math.round(Math.sin(S.t * 1.8 + x) * (2 + S.gust * 4)), on = lit(x);
      if (on) pool(g, x + sw, y + 20, 60 * r / 12, 46 * r / 12, '#ffb060', 0.07 * nightK);
      lantern(g, x + sw, y, r, on ? c : '#5a3a3a');
    }
    if (TS.open) { const f = (0.06 + 0.02 * Math.sin(S.t * 7) * Math.sin(S.t * 3.1)) * (TS.night ? 1.5 : 1); pool(g, 354, 297, 54, 44, '#ffcf7a', f); pool(g, 606, 297, 54, 44, '#ffcf7a', f); }
    if (TS.deco.includes(3)) {   // the neon ramen sign above the door
      const on = lit(480) && (Math.sin(S.t * 7) > -0.9 || Math.sin(S.t * 1.7) > 0.2);
      if (on) pool(g, 480, 235, 70, 22, '#ff5ab8', 0.08, 3);
      setFont(1); textC(g, 'RAMEN', 480, 230, on ? '#ff9ae0' : '#4a2a44'); setFont(2);
    }
  }
  function streetLamp(g) {
    const x = 276, on = lit(x) || (!TS.open && S.intro > 0.3), flick = (0.07 + 0.02 * Math.sin(S.t * 9) * Math.sin(S.t * 4.3)) * (TS.night ? 1.5 : 1);
    if (on) { pool(g, x, 316, 56, 50, '#ffcf7a', flick); pool(g, x, 448, 50, 10, '#ffcf7a', flick); }
    rect(g, x - 2, 312, 5, 136, DK); rect(g, x - 1, 312, 3, 136, '#3a3446'); rect(g, x - 1, 312, 1, 136, '#5a5468');
    rect(g, x - 6, 440, 13, 8, DK); rect(g, x - 5, 441, 11, 6, '#3a3446');
    rect(g, x - 8, 296, 17, 18, DK); rect(g, x - 7, 297, 15, 16, on ? '#ffe2a0' : '#6a6070'); rect(g, x - 7, 297, 4, 16, on ? '#fff6d0' : '#7a7080');
    rect(g, x - 1, 297, 3, 16, DK); rect(g, x - 10, 292, 21, 5, DK); rect(g, x - 9, 293, 19, 3, '#3a3446'); poly(g, [[x - 6, 292], [x + 7, 292], [x + 0.5, 285]], DK);
  }
  function noren(g) {
    if (!TS.open) return;
    for (let k = 0; k < 3; k++) {
      const x = 410 + k * 47, sw = Math.round(Math.sin(S.t * (1.6 + S.gust * 5) + k * 0.9) * (3 + S.gust * 9)), y0 = 252, y1 = 318;
      poly(g, [[x - 1, y0], [x + 45, y0], [x + 45 + sw, y1 + 1], [x - 1 + sw, y1 + 1]], DK);
      poly(g, [[x, y0], [x + 44, y0], [x + 44 + sw, y1], [x + sw, y1]], '#2f3f78');
      poly(g, [[x, y0], [x + 6, y0], [x + 6 + sw, y1], [x + sw, y1]], '#41539a');
      poly(g, [[x + 36, y0], [x + 44, y0], [x + 44 + sw, y1], [x + 36 + sw, y1]], '#24315f');
      rect(g, x + sw, y1 - 4, 44, 2, '#e8dcc0');
      if (k === 1) {   // crest: a white circle with a little bowl and chopsticks
        const cx = x + 22 + Math.round(sw / 2), cy = 286;
        ell(g, cx, cy, 14, 14, '#e8dcc0'); ell(g, cx, cy, 12, 12, '#f6ecd4');
        poly(g, [[cx - 9, cy - 1], [cx + 9, cy - 1], [cx + 5, cy + 7], [cx - 5, cy + 7]], '#2f3f78');
        rect(g, cx - 9, cy - 2, 18, 2, '#2f3f78');
        line(g, cx + 2, cy - 3, cx + 8, cy - 10, '#2f3f78', 2); line(g, cx + 5, cy - 3, cx + 11, cy - 9, '#2f3f78', 2);
        for (const s of [-4, 0, 4]) { const yy = cy - 6 - Math.round(Math.abs(Math.sin(S.t * 2 + s)) * 2); rect(g, cx + s - 1, yy, 1, 3, '#2f3f78'); }
      }
    }
    rect(g, 406, 248, 148, 5, DK); rect(g, 407, 249, 146, 3, '#6e4a2c');
  }
  function bunting(g) {
    for (const [x0, y0, x1, y1, seed] of [[96, 202, 290, 216, 0], [670, 216, 852, 202, 3]]) {
      const n = 9, sag = 16;
      let px = x0, py = y0;
      for (let i = 1; i <= 24; i++) { const u = i / 24, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * sag; line(g, px, py, x, y, '#2a1a14'); px = x; py = y; }
      for (let i = 1; i < n; i++) {
        const u = i / n, x = Math.round(x0 + (x1 - x0) * u), y = Math.round(y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * sag);
        const sw = Math.round(Math.sin(S.t * (2.4 + S.gust * 8) + i + seed) * (2 + S.gust * 6)), c = ['#c8443a', '#e0b040', '#4e7a9c', '#5e9c4a'][(i + seed) % 4];
        poly(g, [[x - 6, y], [x + 6, y], [x + sw, y + 13]], DK); poly(g, [[x - 5, y + 1], [x + 5, y + 1], [x + sw, y + 11]], c);
        poly(g, [[x - 5, y + 1], [x - 1, y + 1], [x + sw - 1, y + 9]], shade(c, 1.2));
      }
    }
  }
  function puddle(g, ox) {   // reflects the doorway glow and the lanterns; a ripple now and then (often in the rain)
    const x = 600 + ox, y = 508;
    ell(g, x, y, 34, 6, '#22202e'); ell(g, x, y - 1, 32, 4, '#2c2a3c');
    if (TS.open) { g.globalAlpha = 0.45; rect(g, x - 18, y - 3, 10, 6, '#ffb060'); rect(g, x - 16, y - 2, 6, 4, '#ffdc96'); g.globalAlpha = 1; if (lit(568)) { dot(g, x + 8, y - 2, '#ff9a7a'); dot(g, x + 9, y - 1, '#c8443a'); } }
    dot(g, x - 22, y - 3, '#8a88a8'); rect(g, x + 14, y - 4, 6, 1, '#4a4860');
    const period = TS.weather === 'rain' ? 0.7 : 4.5, p = (S.t % period) / Math.min(1.2, period);
    if (p < 1) { const r = 3 + p * 14; g.globalAlpha = 1 - p; for (let a = 0; a < 16; a++) { const th = a / 16 * Math.PI * 2; dot(g, Math.round(x + 6 + Math.cos(th) * r), Math.round(y + Math.sin(th) * r * 0.25), '#a8a8c8'); } g.globalAlpha = 1; }
  }
  function dust(g) {   // specks drifting in the closed doorway's shaft of light
    for (let i = 0; i < 14; i++) { const x = 450 + ((i * 37 + S.t * 3) % 80) + Math.sin(S.t * 0.7 + i) * 4, y = 260 + ((i * 53 + S.t * 6) % 170); g.globalAlpha = 0.5 + 0.5 * Math.sin(S.t * 2 + i); dot(g, Math.round(x), Math.round(y), '#fff2d0'); }
    g.globalAlpha = 1;
  }
  function aoi(g) {   // Aoi waves from Kitsune-ya's door every so often
    if (!TS.aoi) return;
    const cyc = S.t % 13, a = cyc < 0.4 ? cyc / 0.4 : cyc < 3 ? 1 : cyc < 3.4 ? (3.4 - cyc) / 0.4 : 0;
    if (a <= 0) return;
    const spr = shrink('aoi', false); if (!spr) return;
    const x = 944, by = 441;
    g.save(); g.beginPath(); g.rect(923, 361, 42, 79); g.clip(); g.globalAlpha = a;
    g.drawImage(spr.c, Math.round(x - spr.ax), by - spr.h);
    const hx = x + 10 + Math.round(Math.sin(S.t * 12) * 3), hy = by - spr.h + 20;
    rect(g, hx - 2, hy - 2, 5, 5, DK); rect(g, hx - 1, hy - 1, 3, 3, '#f6d8c0');
    g.restore();
  }

  /* ---------- the slime, the cat, the dragon, the windmill ---------- */
  const village = { slime: { x: 200, dir: 1, t: 0 }, cat: { x: 524, y: 434, run: 0 }, dragon: { x: null, wait: 6, dir: 1, y: 50, mode: 'fly', t: 0 } };
  const ROOST = [150, 186];   // where the dragon curls up: on the inn's roof
  function updateVillage(dt) {
    const sl = village.slime, chase = EV.cur && EV.cur.kind === 'chase' ? EV.cur : null;
    sl.t += dt * (chase && chase.t > 0.4 && chase.t < 4 ? 2.2 : 1);
    const hop = (sl.t % 1.1) / 1.1;
    if (hop > 0.25 && hop < 0.75) sl.x += sl.dir * 70 * dt * (chase && chase.t > 0.4 && chase.t < 4 ? 1.6 : 1);
    if (sl.x > 650) sl.dir = -1; else if (sl.x < 110) sl.dir = 1;
    const ct = village.cat, px = ct.x;
    if (chase && CATS.SIDE) {   // the cat wakes, chases the slime along the street, then strolls back to its step (it needs the walk frames)
      if (chase.t < 0.4) { ct.run = 0; }
      else if (chase.t < 4) { const tx = sl.x - sl.dir * 34; ct.x += clamp(tx - ct.x, -150 * dt, 150 * dt); ct.y += (500 - ct.y) * Math.min(1, dt * 6); ct.run += dt; ct.face = Math.sign(tx - ct.x) || ct.face || 1; }
      else { ct.x += clamp(524 - ct.x, -90 * dt, 90 * dt); ct.y += (434 - ct.y) * Math.min(1, dt * 3); ct.run += dt; ct.face = Math.sign(524 - ct.x) || 1; }
    } else { ct.x = 524; ct.y = 434; ct.run = 0; }
    ct.dist = (ct.dist || 0) + Math.abs(ct.x - px);   // (his paws step with the distance run)
    const dr = village.dragon;
    if (dr.x === null) {
      dr.wait -= dt;
      if (dr.wait <= 0) {
        dr.dir = Math.random() < 0.5 ? 1 : -1; dr.x = dr.dir > 0 ? -60 : VW + 60; dr.y = 34 + Math.random() * 40; dr.t = 0;
        dr.mode = TS.dragon && Math.random() < 0.5 ? 'land' : 'fly';   // late game: sometimes it comes down to sleep on the roof
        if (dr.mode === 'land') { dr.dir = 1; dr.x = -60; dr.sx = dr.x; dr.sy = dr.y; }
      }
    } else if (dr.mode === 'fly') { dr.x += dr.dir * 90 * dt; if (dr.x < -80 || dr.x > VW + 80) { dr.x = null; dr.wait = 18 + Math.random() * 14; } }
    else if (dr.mode === 'land') { dr.t += dt; const p = Math.min(1, dr.t / 3.2), e = 1 - (1 - p) ** 2; dr.x = dr.sx + (ROOST[0] - dr.sx) * e; dr.y = dr.sy + (ROOST[1] - 8 - dr.sy) * e; if (p >= 1) { dr.mode = 'sleep'; dr.t = 0; dr.nap = rand(22, 34); } }
    else if (dr.mode === 'sleep') { dr.t += dt; if (dr.t > dr.nap) { dr.mode = 'off'; dr.t = 0; dr.dir = -1; } }
    else if (dr.mode === 'off') { dr.t += dt; dr.x -= 100 * dt; dr.y -= 40 * dt; if (dr.x < -80) { dr.x = null; dr.mode = 'fly'; dr.wait = 30 + Math.random() * 20; } }
  }
  function windmill(g) {
    const cx = 916, cy = 168;
    poly(g, [[cx - 9, 214], [cx + 9, 214], [cx + 5, cy], [cx - 5, cy]], '#241e3c');
    poly(g, [[cx - 7, cy + 2], [cx + 7, cy + 2], [cx, cy - 8]], '#1c1632');
    dot(g, cx, cy + 16, '#ffcf7a');
    for (let k = 0; k < 4; k++) {
      const a = S.t * 0.8 + k * Math.PI / 2, ex = cx + Math.cos(a) * 26, ey = cy + Math.sin(a) * 26;
      line(g, cx, cy, ex, ey, '#241e3c', 2);
      const nx = -Math.sin(a) * 5, ny = Math.cos(a) * 5;
      poly(g, [[cx + Math.cos(a) * 8, cy + Math.sin(a) * 8], [ex, ey], [ex + nx, ey + ny], [cx + Math.cos(a) * 8 + nx, cy + Math.sin(a) * 8 + ny]], '#2c2648');
    }
    rect(g, cx - 1, cy - 1, 3, 3, '#1c1632');
  }
  function dragon(g) {
    const d = village.dragon; if (d.x === null || d.mode === 'sleep') return;
    const x = Math.round(d.x), y = Math.round(d.y + Math.sin(S.t * 2) * 4), f = d.dir, flap = Math.sin(S.t * 9), c = '#1a1430';
    ell(g, x, y, 11, 4, c);
    poly(g, [[x - 10 * f, y], [x - 26 * f, y - 2 + Math.round(flap * 2)], [x - 30 * f, y + 3], [x - 10 * f, y + 3]], c);
    poly(g, [[x + 9 * f, y - 2], [x + 16 * f, y - 6], [x + 20 * f, y - 4], [x + 15 * f, y], [x + 9 * f, y + 2]], c);
    dot(g, x + 17 * f, y - 5, '#ff8a4a');
    const wy = Math.round(flap * 12);
    poly(g, [[x - 4, y - 2], [x + 4, y - 2], [x + 12 * f, y - 4 - wy], [x - 6 * f, y - 10 - wy]], c);
    poly(g, [[x - 3, y - 1], [x + 5, y - 1], [x - 2 * f, y - 14 - wy], [x - 14 * f, y - 8 - wy]], '#241c40');
  }
  function sleepingDragon(g) {   // curled up on the inn's roof, breathing slowly, the odd Z drifting up
    const d = village.dragon; if (d.mode !== 'sleep') return;
    const [x, by] = ROOST, br = Math.round(Math.sin(S.t * 1.2) * 1), body = '#4a3470', belly = '#8a6a9a', lo = '#2e2050';
    poly(g, [[x - 26, by], [x - 40, by - 4], [x - 46, by - 10], [x - 40, by - 8], [x - 30, by - 4]], DK);                   // tail tip
    ell(g, x, by - 8 - br, 25, 11 + br, DK); ell(g, x, by - 8 - br, 24, 10 + br, body); ell(g, x - 4, by - 4 - br, 18, 5, belly); ell(g, x + 6, by - 13 - br, 14, 4, lo);
    poly(g, [[x - 10, by - 16 - br], [x + 6, by - 26 - br], [x + 16, by - 14 - br]], DK); poly(g, [[x - 7, by - 16 - br], [x + 6, by - 24 - br], [x + 13, by - 15 - br]], lo);   // the folded wing
    ell(g, x + 25, by - 7, 9, 6, DK); ell(g, x + 25, by - 7, 8, 5, body); rect(g, x + 26, by - 8, 4, 1, DK);                        // the head resting, eyes shut
    poly(g, [[x + 22, by - 12], [x + 20, by - 18], [x + 25, by - 12]], DK); poly(g, [[x + 28, by - 12], [x + 28, by - 18], [x + 31, by - 11]], DK);   // horns
    for (const k of [-12, -4, 4]) poly(g, [[x + k, by - 18 - br], [x + k + 3, by - 22 - br], [x + k + 6, by - 18 - br]], DK);                        // spines
    if (Math.sin(S.t * 0.9) > -0.2) { const zy = by - 28 - Math.round((S.t * 6) % 10); textC(g, 'Z', x + 36, zy, '#c9b8e0'); }
  }
  // Casper (js/cats.js) asleep on the shop's doorstep; when the slime bounces by he wakes and gives chase, then strolls back
  function cat(g) {
    const ct = village.cat;
    if (ct.run > 0) CATS.drawFrame(g, 'casper', CATS.F.walk + Math.floor(ct.dist / 4) % 8, ct.x, ct.y + 1, (ct.face || 1) < 0);
    else CATS.drawFrame(g, 'casper', CATS.F.sleep + Math.floor(S.t * 1.6) % 4, 524, 436);
  }

  function slime(g) {
    const sl = village.slime, hop = (sl.t % 1.1) / 1.1;
    let squash = 0, lift = 0;
    if (hop < 0.25) squash = Math.sin(hop / 0.25 * Math.PI) * 3;
    else if (hop < 0.75) lift = Math.sin((hop - 0.25) / 0.5 * Math.PI) * 14;
    else squash = Math.sin((hop - 0.75) / 0.25 * Math.PI) * 2;
    const x = Math.round(sl.x), base = 506, w = Math.round(13 + squash * 1.5), h = Math.round(11 - squash + (lift > 2 ? 2 : 0)), y = Math.round(base - h - lift);
    pool(g, x, base + 1, Math.max(6, 13 - lift / 2), 3, '#0e0a12', 0.25, 2);
    ell(g, x, y + h / 2, w + 1, h / 2 + 1, DK); ell(g, x, y + h / 2, w, h / 2, '#5ec44a');
    ell(g, x - 2, y + h / 2 - 2, w - 4, Math.max(1, h / 2 - 3), '#86e06a'); ell(g, x - 5, y + 3, 3, 2, '#d8ffc0');
    ell(g, x + 3, y + h / 2 + 2, w - 5, 2, '#3e9a34');
    const ex = x + 3 * sl.dir; rect(g, ex - 4, y + h / 2 - 2, 2, 3, DK); rect(g, ex + 2, y + h / 2 - 2, 2, 3, DK);
  }

  /* ---------- small events: at most one at a time, every 20-40 seconds ---------- */
  const EV = { cur: null, wait: 25 };
  function startEvent(kind) {
    const opts = ['star', 'gust', 'chase'];
    if (seats.some(Boolean)) opts.push('toast');
    kind = kind || pick(opts);
    EV.cur = { kind, t: 0, dur: { star: 1.1, gust: 2.8, chase: 6.5, toast: 2.7 }[kind] || 2 };
    if (kind === 'toast') { const s = pick(seats.filter(Boolean)); if (s) s.toast = 0; else EV.cur = null; }
    if (kind === 'gust') for (let i = 0; i < 16; i++) puffs.push({ type: 'leaf', x: -20 - Math.random() * 200, y: 180 + Math.random() * 280, vx: 260 + Math.random() * 120, vy: -20 + Math.random() * 40, life: 3.2, max: 3.2, c: TS.region === 0 ? '#f2b8cc' : TS.region === 2 ? '#e8803a' : '#8cc46a' });
  }
  function updateEvents(dt) {
    if (!EV.cur) { EV.wait -= dt; if (EV.wait <= 0) startEvent(); }
    else { EV.cur.t += dt; if (EV.cur.t >= EV.cur.dur) { EV.cur = null; EV.wait = rand(20, 40); } }
    const gt = EV.cur && EV.cur.kind === 'gust' ? EV.cur.t / EV.cur.dur : -1;
    S.gust = gt < 0 ? 0 : Math.sin(gt * Math.PI);
  }

  function updateScene(dt) {
    // steam from the chimney, the doorway, the chef's pot and the logo's bowls
    puffT -= dt;
    if (puffT <= 0) {
      puffT = 0.12;
      if (TS.open) {
        puffs.push({ type: 'steam', x: 601 + (Math.random() * 10 - 5), y: 108, vx: 6, vy: -18 - Math.random() * 10, life: 2.4, max: 2.4 });
        if (Math.random() < 0.5) puffs.push({ type: 'steam', x: 450 + Math.random() * 60, y: 250, vx: 0, vy: -14, life: 1.4, max: 1.4 });
        if (Math.random() < 0.6) puffs.push({ type: 'steam', x: 539 + Math.random() * 10 - 5, y: 350, vx: 0, vy: -12, life: 1.2, max: 1.2 });
      }
      if (S.screen === 'main' && Math.random() < 0.7) for (const bx of [104, 456]) puffs.push({ type: 'curl', x: 200 + bx + Math.random() * 10 - 5, y: 74, vx: 0, vy: -14, life: 1.4, max: 1.4, ph: Math.random() * 6 });
    }
    for (const p of puffs) {
      if (p.type === 'curl') { p.y += p.vy * dt; p.x += Math.cos(S.t * 4 + p.ph + p.y * 0.2) * 14 * dt; }
      else if (p.type === 'leaf') { p.x += p.vx * dt; p.y += (p.vy + Math.sin(S.t * 5 + p.x * 0.05) * 30) * dt; }
      else { p.x += (p.vx + Math.sin(S.t * 2 + p.y * 0.1) * 6 * (1 + S.gust * 6)) * dt; p.y += p.vy * dt; }
      p.life -= dt;
    }
    for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].life <= 0 || puffs.length > 220) puffs.splice(i, 1);
    updateVillage(dt); updateSeats(dt); updateWalkers(dt); updateEvents(dt);
  }
  function drawPuff(g, p) {
    if (p.type === 'curl') { g.globalAlpha = Math.max(0, p.life / p.max) * 0.55; rect(g, Math.round(p.x), Math.round(p.y), 2, 2, '#ffffff'); rect(g, Math.round(p.x) + 1, Math.round(p.y) - 2, 1, 2, '#ffffff'); g.globalAlpha = 1; }
    else if (p.type === 'leaf') { rect(g, Math.round(p.x), Math.round(p.y), 3, 2, DK); rect(g, Math.round(p.x), Math.round(p.y), 2, 1, p.c); }
    else SCENE.part(g, p);
  }

  /* ---------- menus ---------- */
  const MAIN = () => {
    const save = saveInfo();
    return [
      { label: 'CONTINUE', tag: tag(), off: !save, act: () => H.onContinue() },
      { label: 'NEW GAME', act: () => go(save ? 'confirm' : 'tutask') },
      { label: 'HOW TO PLAY', act: () => go('help') },
      { label: 'SETTINGS', act: () => go('settings') }
    ];
  };
  const SET = () => {
    const st = H.settings;
    return [
      { label: 'MUSIC', type: 'slider', get: () => st.music, set: v => { st.music = v; H.applySettings(); } },
      { label: 'SOUND EFFECTS', type: 'slider', get: () => st.sfx, set: v => { st.sfx = v; H.applySettings(); H.sfx.move(); } },
      { label: 'TEXT SPEED', type: 'choice', opts: ['SLOW', 'NORMAL', 'FAST'], get: () => st.textSpeed, set: v => { st.textSpeed = v; H.applySettings(); } },
      { label: 'FULLSCREEN', type: 'toggle', get: () => !!document.fullscreenElement, set: () => H.toggleFullscreen() },
      { label: 'PIXEL SNAP', type: 'toggle', get: () => st.snap, set: v => { st.snap = v; H.applySettings(); } },
      { label: 'HINTS', type: 'toggle', get: () => H.hintsOn(), set: v => H.setHints(v) },
      { label: 'REDUCE MOTION', type: 'toggle', get: () => !!st.reduceMotion, set: v => { st.reduceMotion = v; H.applySettings(); } },
      // during play: Aoi comes back to walk you through a bowl at the start of the next day
      ...(S.overlay ? [{ label: H.tutArmed() ? 'Tutorial: Aoi is on her way' : 'REPLAY TUTORIAL', act: () => { if (!H.tutArmed()) H.replayTut(); } }] : []),
      { label: 'CREDITS', act: () => go('credits') },
      { label: 'BACK', act: backOut }
    ];
  };
  const PAUSE = () => [
    { label: 'RESUME', act: () => { H.sfx.back(); H.onResume(); } },
    { label: 'SETTINGS', act: () => go('settings') },
    { label: 'HOW TO PLAY', act: () => go('help') },
    { label: 'QUIT TO TITLE', act: () => H.onQuit() }
  ];
  const CONFIRM = () => [
    { label: 'YES, START OVER', act: () => go('tutask') },
    { label: 'NO, GO BACK', act: backOut }
  ];
  // after NEW GAME: Aoi offers to walk the player through their first bowl
  const TUTASK = () => [
    { label: 'YES, PLEASE', act: () => H.onNew(true) },
    { label: "I'VE GOT THIS", act: () => H.onNew(false) }
  ];
  // Esc during the guided bowl
  const SKIPTUT = () => [
    { label: 'NO, KEEP GOING', act: () => { H.sfx.back(); H.onResume(); } },
    { label: 'YES, SKIP IT', act: () => H.onSkipTut() }
  ];
  function wrap(s, maxW) {
    if (!s) return [''];
    const out = []; let cur = '';
    for (const w of s.split(' ')) { const next = (cur + ' ' + w).trim(); if (cur && textW(next) > maxW) { out.push(cur); cur = w; } else cur = next; }
    if (cur) out.push(cur);
    return out;
  }
  function rows() {
    return S.screen === 'main' ? MAIN() : S.screen === 'settings' ? SET() : S.screen === 'pause' ? PAUSE() : S.screen === 'confirm' ? CONFIRM()
      : S.screen === 'tutask' ? TUTASK() : S.screen === 'skiptut' ? SKIPTUT() : [];
  }
  function go(screen) { S.screen = screen; S.sel = 0; S.open = 0; H.sfx.page(); }
  function backOut() {
    H.sfx.back();
    if (S.screen === 'pause' || S.screen === 'skiptut') return H.onResume();
    if (S.screen === 'credits') return go('settings');
    if (S.screen === 'settings' || S.screen === 'help') return go(S.overlay ? 'pause' : 'main');
    go('main');
  }

  /* ---------- scroll panel ---------- */
  function scroll(g, cx, y, w, h, title) {
    const p = ease(Math.min(1, S.open / 0.28)), hh = Math.max(10, Math.round(h * p)), x = Math.round(cx - w / 2);
    rect(g, x + 6, y + 10, w, hh, 'rgba(20,8,12,0.35)');
    rect(g, x - 1, y + 4, w + 2, hh + 2, DK);
    rect(g, x, y + 4, w, hh, '#f1e2bf');
    for (let i = 0; i < w * hh / 90; i++) dot(g, x + Math.floor(SCENE.rnd(i + 5) * w), y + 4 + Math.floor(SCENE.rnd(i * 1.7 + 9) * hh), SCENE.rnd(i) > 0.5 ? '#e4d2aa' : '#f8ecd0');
    rect(g, x, y + 4, 3, hh, '#fbf2dc'); rect(g, x + w - 4, y + 4, 4, hh, '#d8c49a');
    ao(g, x, y + 4, w, hh, 'top', 10, 0.35); ao(g, x, y + 4, w, hh, 'bottom', 10, 0.25);
    for (const ry of [y - 6, y + 4 + hh - 4]) {
      rect(g, x - 18, ry, w + 36, 14, DK); rect(g, x - 17, ry + 1, w + 34, 12, '#7a5230');
      rect(g, x - 17, ry + 2, w + 34, 2, '#b07c48'); rect(g, x - 17, ry + 9, w + 34, 3, '#4a2e1a');
      for (const kx of [x - 22, x + w + 22]) { ell(g, kx, ry + 7, 7, 8, DK); ell(g, kx, ry + 7, 6, 7, '#a8302a'); ell(g, kx - 2, ry + 5, 2, 2, '#e2685c'); }
    }
    if (p < 0.98) return null;
    if (title) { textC(g, title, cx, y + 20, '#8a2a1a'); rect(g, cx - textW(title) / 2 - 10, y + 34, textW(title) + 20, 1, '#c9a468'); }
    return { x, y: y + 4, w, h: hh };
  }
  function drawRows(g, R, list, top, gap = 34) {
    list.forEach((it, i) => {
      const y = top + i * gap, sel = i === S.sel, lx = R.x + 50;
      const col = it.off ? '#a8987a' : sel ? '#8a2a1a' : '#4a3226';
      if (sel) { rect(g, R.x + 24, y - 6, R.w - 48, 24, 'rgba(201,164,104,0.25)'); glove(g, R.x + 34 + Math.round(Math.sin(S.t * 6) * 2), y + 5, 1); }
      text(g, it.label, lx, y, col);
      hits.push({ r: { x: R.x + 20, y: y - 8, w: R.w - 40, h: 28 }, i, fn: it.type ? null : it.act });
      const rx = R.x + R.w - 40;
      if (it.type === 'slider') {
        const v = it.get(), bx = rx - 186;
        btn(g, bx, y - 3, '-', () => it.set(Math.max(0, it.get() - 1)));
        for (let k = 0; k < 10; k++) {
          const px = bx + 26 + k * 13, on = k < v;
          rect(g, px - 1, y - 3, 11, 16, DK); rect(g, px, y - 2, 9, 14, on ? '#c8443a' : '#e4d2aa'); if (on) rect(g, px, y - 2, 9, 3, '#e2685c');
          const kk = k + 1; hits.push({ r: { x: px - 1, y: y - 6, w: 13, h: 22 }, i, fn: () => it.set(kk === it.get() ? kk - 1 : kk) });
        }
        btn(g, bx + 160, y - 3, '+', () => it.set(Math.min(10, it.get() + 1)));
      } else if (it.type === 'choice') {
        let ox = rx;
        for (let k = it.opts.length - 1; k >= 0; k--) {
          const s = it.opts[k], w = textW(s) + 12; ox -= w + 6;
          const on = it.get() === k, kk = k;
          rect(g, ox - 1, y - 4, w + 2, 18, DK); rect(g, ox, y - 3, w, 16, on ? '#4e7a3c' : '#e4d2aa');
          text(g, s, ox + 6, y, on ? '#f6ecd4' : '#7a6248');
          hits.push({ r: { x: ox - 1, y: y - 6, w: w + 2, h: 22 }, i, fn: () => it.set(kk) });
        }
      } else if (it.type === 'toggle') {
        const on = it.get(), w = 54, ox = rx - w;
        rect(g, ox - 1, y - 4, w + 2, 18, DK); rect(g, ox, y - 3, w, 16, on ? '#4e7a3c' : '#8a5a4a');
        textC(g, on ? 'ON' : 'OFF', ox + w / 2, y, '#f6ecd4');
        hits.push({ r: { x: ox - 1, y: y - 6, w: w + 2, h: 22 }, i, fn: () => it.set(!it.get()) });
      }
    });
  }
  function btn(g, x, y, s, fn) {
    rect(g, x - 1, y - 1, 20, 18, DK); rect(g, x, y, 18, 16, '#c9a468'); rect(g, x, y, 18, 2, '#e6c890');
    textC(g, s, x + 9, y + 3, '#4a3226');
    hits.push({ r: { x: x - 2, y: y - 4, w: 22, h: 24 }, fn });
  }

  /* ---------- guest book ---------- */
  const PER = 20;
  function crop(g, gt, sx, sy, w, h, x, y) {
    const img = H.IMG[gt.id]; if (!img || !img.complete) return;
    const met = H.met().includes(gt.id);
    let src = img;
    if (!met) src = sil[gt.id] || (sil[gt.id] = SERVING.silhouette(img));
    g.drawImage(src, sx, sy, w, h, x, y, w, h);
  }
  function drawBook(g) {
    const p = ease(Math.min(1, S.open / 0.28)), x = 100, y = 64, w = 760, h = Math.round(424 * p);
    rect(g, x + 8, y + 10, w, h, 'rgba(20,8,12,0.4)');
    rect(g, x - 1, y - 1, w + 2, h + 2, DK); rect(g, x, y, w, h, '#6e1e18'); rect(g, x, y, w, 2, '#9a3a2a');
    if (p < 0.98) return;
    rect(g, x + 10, y + 10, w - 20, h - 20, DK);
    rect(g, x + 11, y + 11, (w >> 1) - 12, h - 22, '#f6ecd4'); rect(g, x + (w >> 1) + 1, y + 11, (w >> 1) - 12, h - 22, '#efe2c4');
    rect(g, x + (w >> 1) - 2, y + 11, 4, h - 22, '#c9b48a'); ao(g, x + 11, y + 11, (w >> 1) - 12, h - 22, 'right', 14, 0.25); ao(g, x + (w >> 1) + 1, y + 11, (w >> 1) - 12, h - 22, 'left', 14, 0.25);
    const met = H.met(), pages = Math.ceil(GUESTS.length / PER);
    textC(g, 'GUEST BOOK', x + 190, y + 24, '#8a2a1a');
    textC(g, met.length + ' / ' + GUESTS.length + ' MET', x + 190, y + 40, '#7a5230');
    for (let k = 0; k < PER; k++) {
      const gi = S.page * PER + k, gt = GUESTS[gi]; if (!gt) break;
      const cx = x + 40 + (k % 5) * 64, cy = y + 60 + Math.floor(k / 5) * 66, on = k === S.pick;
      rect(g, cx - 2, cy - 2, 60, 60, on ? '#e0b040' : DK); rect(g, cx, cy, 56, 56, met.includes(gt.id) ? '#e9d8b4' : '#b8a888');
      g.save(); g.beginPath(); g.rect(cx, cy, 56, 56); g.clip(); crop(g, gt, gt.ax - 28, Math.max(0, gt.head - 6), 56, 56, cx, cy); g.restore();
      hits.push({ r: { x: cx - 2, y: cy - 2, w: 60, h: 60 }, fn: () => { S.pick = k; H.sfx.move(); } });
    }
    const navY = y + h - 34;
    const nav = (label, nx, fn, off) => { textC(g, label, nx, navY, off ? '#c0b090' : '#7a2f1a'); if (!off) hits.push({ r: { x: nx - textW(label) / 2 - 6, y: navY - 6, w: textW(label) + 12, h: 22 }, fn }); };
    nav('< PREV', x + 70, () => { S.page--; S.pick = 0; H.sfx.page(); }, S.page === 0);
    textC(g, 'PAGE ' + (S.page + 1) + '/' + pages, x + 190, navY, '#7a5230');
    nav('NEXT >', x + 310, () => { S.page++; S.pick = 0; H.sfx.page(); }, S.page >= pages - 1);
    const gt = GUESTS[S.page * PER + S.pick], rx = x + (w >> 1) + 20, known = gt && met.includes(gt.id);
    if (gt) {
      rect(g, rx + 109, y + 26, 144, 174, DK); rect(g, rx + 110, y + 27, 142, 172, known ? '#e9d8b4' : '#b8a888');
      g.save(); g.beginPath(); g.rect(rx + 110, y + 27, 142, 172); g.clip(); crop(g, gt, gt.ax - 71, Math.max(0, gt.head - 8), 142, 172, rx + 110, y + 27); g.restore();
      setFont(3); textC(g, known ? gt.name.toUpperCase() : '???', rx + 181, y + 214, '#8a2a1a'); setFont(2);
      const P = PERSONA[gt.id] || {}, info = known ? [
        gt.title.toUpperCase(), (P.trait || '').toUpperCase(), '',
        'FAVOURITE: ' + (gt.taste.pref ? MENU[gt.taste.pref].name.toUpperCase() : 'ANYTHING'),
        ...(gt.taste.tops ? wrap('LIKES: ' + Object.keys(gt.taste.tops).map(id => (gt.taste.tops[id] ? '' : 'NO ') + TOP_NAME[id].toUpperCase()).join(', '), 38) : []),
        ...(gt.taste.night ? ['ONLY VISITS AT NIGHT'] : [])
      ] : ['NOT MET YET.', '', 'SERVE THEM A BOWL TO', 'ADD THEM TO THE BOOK.'];
      info.forEach((s, i) => textC(g, s, rx + 181, y + 246 + i * 22, i === 0 && known ? '#4a3226' : '#6a5038'));
    }
    nav('BACK', rx + 300, backOut);
  }

  /* ---------- frame ---------- */
  const PLANK_AT = i => 1.0 + i * 0.16;   // when each menu plank swings in during the opening
  function update(dt) {
    S.t += dt; S.open += dt;
    if (S.overlay) return;
    S.intro += dt;
    // the mouse parallax eases towards the pointer (off with reduce motion)
    const tx = calm() ? 0 : S.mx, ty = calm() ? 0 : S.my;
    S.px += (tx - S.px) * Math.min(1, dt * 4); S.py += (ty - S.py) * Math.min(1, dt * 4);
    // the planks swing on their nails: a spring, kicked when the selection changes
    for (let i = 0; i < S.ang.length; i++) {
      const target = !calm() && S.screen === 'main' && i === S.sel ? Math.sin(S.t * 1.8) * 0.02 : 0;
      S.vel[i] += (-70 * (S.ang[i] - target) - 6 * S.vel[i]) * dt; S.ang[i] += S.vel[i] * dt;
      if (calm()) { S.ang[i] = 0; S.vel[i] = 0; }
    }
    updateScene(dt);
  }
  const off = k => [Math.round(S.px * k), Math.round(S.py * k * 0.5)];
  function draw(g) {
    hits = [];
    g.imageSmoothingEnabled = false;
    if (S.overlay) { g.fillStyle = 'rgba(14,8,20,0.55)'; g.fillRect(0, 0, VW, VH); }
    else {
      if (!back) { back = buildBack(); far1 = buildFar1(); far2 = buildFar2(); props = buildProps(); branch = buildBranch(); }
      if (!logo) logo = buildLogo();
      sky(g);
      { const [x, y] = off(2); g.drawImage(far1, -12 + x, y); }
      { const [x, y] = off(3); g.drawImage(far2, -12 + x, y); }
      if (TS.region < 3) windmill(g);
      dragon(g);
      regionLiveFar(g);
      g.drawImage(back, 0, 0);
      if (TS.night) { g.fillStyle = 'rgba(12,14,44,0.24)'; g.fillRect(0, 0, VW, VH); }
      sleepingDragon(g);
      if (TS.open) { chef(g); for (let i = 0; i < 3; i++) drawSeat(g, i); } else dust(g);
      noren(g); lanterns(g); bunting(g); streetLamp(g); aoi(g);
      regionLive(g);
      if (!(village.cat.run > 0)) cat(g);
      drawWalkers(g);
      { const [x, y] = off(5); g.drawImage(props, -10 + x, y); puddle(g, x); }
      if (village.cat.run > 0) cat(g);
      slime(g);
      for (const p of puffs) drawPuff(g, p);
      // fireflies over the street (more, and brighter, at night)
      const nf = TS.night ? 16 : 7;
      for (let i = 0; i < nf; i++) {
        const fx = (i * 173 + S.t * 14 * (i % 2 ? 1 : -1)) % VW, fy = 380 + Math.sin(S.t * 0.9 + i * 2) * 40 + (i * 23) % 60 - (TS.night ? (i % 3) * 60 : 0);
        if (Math.sin(S.t * 3 + i * 1.3) > 0) { dot(g, (fx + VW) % VW, Math.round(fy), '#fff2a0'); pool(g, (fx + VW) % VW, Math.round(fy), 4, 4, '#fff2a0', TS.night ? 0.2 : 0.12, 2); }
      }
      weather(g);
      { const [x, y] = off(6); g.drawImage(branch, x - 6, y - 6); }
      drawLogo(g);
    }
    if (S.screen === 'main') drawMain(g);
    else if (S.screen === 'book') drawBook(g);
    else if (S.screen === 'help') drawPinboard(g);
    else if (S.screen === 'credits') drawCredits(g);
    else {
      const list = rows(), title = { settings: 'SETTINGS', pause: 'PAUSED', confirm: 'Start a new game?', tutask: 'Want Aoi to show you around?', skiptut: "SKIP AOI'S TOUR?" }[S.screen];
      const EXTRA = { confirm: 'Your saved day will be lost.', pause: 'Your day saves at opening and closing.', tutask: 'She ran this stall before you.', skiptut: 'Your first day starts right away.' };
      const h = 70 + list.length * 34 + (EXTRA[S.screen] ? 30 : 0);
      const R = scroll(g, VW / 2, Math.round(VH / 2 - h / 2), S.screen === 'settings' ? 600 : 480, h, title);
      if (R) {
        const extra = EXTRA[S.screen] || '';
        if (extra) textC(g, extra, VW / 2, R.y + 44, '#7a5230');
        drawRows(g, R, list, R.y + (extra ? 74 : 54));
      }
    }
    // the opening: a fade in from the dark
    if (!S.overlay && S.intro < 0.8) { g.fillStyle = 'rgba(10,6,16,' + (1 - S.intro / 0.8).toFixed(3) + ')'; g.fillRect(0, 0, VW, VH); }
  }
  /* How to Play: a corkboard of Aoi's notes, grouped by station. A note is pinned once the player has seen it in play;
     the rest are empty pins. (From the title, the board shows the save's notes.) */
  // One station at a time (tabs, or the left / right keys), two notes to a row, so the notes have room to breathe.
  function drawPinboard(g) {
    const R = scroll(g, VW / 2, 54, 760, 430, 'HOW TO PLAY'); if (!R) return;
    setFont(1); textC(g, "Aoi's notes, pinned as you find them in the shop.", VW / 2, R.y + 36, '#7a5230'); setFont(2);
    const seen = H.tutSeen() || [], bx = R.x + 18, ty = R.y + 52, by = R.y + 82, bw = R.w - 36, bh = R.h - 82 - 40;
    // the tabs: SERVING, KITCHEN, EVENINGS (with how many of each are pinned)
    S.pinTab = clamp(S.pinTab || 0, 0, TUT.GROUPS.length - 1);
    let tx = bx;
    TUT.GROUPS.forEach((grp, c) => {
      const on = c === S.pinTab, got = grp.ids.filter(id => seen.includes(id)).length, lab = grp.name + ' ' + got + '/' + grp.ids.length;
      setFont(1); const tw = textW(lab) + 20;
      rect(g, tx - 1, ty - 1, tw + 2, (on ? 28 : 24) + 2, DK); rect(g, tx, ty, tw, on ? 28 : 24, on ? '#8a2a1a' : '#c9a468'); if (on) rect(g, tx, ty, tw, 2, '#b04a3a');
      text(g, lab, tx + 10, ty + 7, on ? '#fbf2dc' : '#4a3226'); setFont(2);
      hits.push({ r: { x: tx, y: ty, w: tw, h: 26 }, fn: () => { if (S.pinTab !== c) { S.pinTab = c; H.sfx.page(); } } });
      tx += tw + 8;
    });
    rect(g, bx - 4, by - 4, bw + 8, bh + 8, DK); rect(g, bx - 3, by - 3, bw + 6, bh + 6, '#7a5230'); rect(g, bx - 3, by - 3, bw + 6, 1, '#b07c48');   // the frame
    rect(g, bx, by, bw, bh, '#b88a58');
    for (let i = 0; i < bw * bh / 60; i++) dot(g, bx + Math.floor(rnd(i * 3.1 + 2) * bw), by + Math.floor(rnd(i * 1.3 + 7) * bh), rnd(i + 11) > 0.5 ? '#a47648' : '#c89a68');   // cork
    const grp = TUT.GROUPS[S.pinTab], NW = Math.floor((bw - 48) / 2);
    let y = by + 16;
    for (let r = 0; r * 2 < grp.ids.length; r++) {
      const pair = grp.ids.slice(r * 2, r * 2 + 2), hs = pair.map(id => (seen.includes(id) ? TUT.noteSize(TUT.NOTES[id].t, NW).h : 28));
      pair.forEach((id, c) => {
        const x = bx + 16 + c * (NW + 16);
        if (seen.includes(id)) TUT.drawNote(g, x, y, TUT.NOTES[id].t, { w: NW });
        else TUT.blankPin(g, x, y, NW, 28);
      });
      y += Math.max(...hs) + 14;
    }
    const n = Object.keys(TUT.NOTES).filter(id => seen.includes(id)).length;
    setFont(1); text(g, n + ' / ' + Object.keys(TUT.NOTES).length + ' PINNED', bx, R.y + R.h - 26, '#7a5230'); setFont(2);
    const ky = R.y + R.h - 30; textC(g, 'BACK', VW / 2, ky, '#8a2a1a'); hits.push({ r: { x: VW / 2 - 40, y: ky - 6, w: 80, h: 22 }, fn: backOut });
    glove(g, VW / 2 - 34 + Math.round(Math.sin(S.t * 6) * 2), ky + 5, 1);
  }
  /* Credits. */
  const CREDITS = [
    ['Cozy Ramen: An Adventurers\' Noodle Stall', null],
    ['FONT', null],
    ['CozyPixel', "The game's own 5x7 pixel font, drawn for Cozy Ramen."]
  ];
  function drawCredits(g) {
    const R = scroll(g, VW / 2, 110, 560, 300, 'CREDITS'); if (!R) return;
    let y = R.y + 52;
    for (const [head, body] of CREDITS) {
      if (!body) { setFont(head === head.toUpperCase() ? 1 : 2); textC(g, head, VW / 2, y, '#8a2a1a'); setFont(2); y += head === head.toUpperCase() ? 26 : 34; continue; }
      textC(g, head, VW / 2, y, '#4a3226'); y += PX.lineH();
      setFont(1); for (const l of PX.wrap(body, R.w - 80)) { textC(g, l, VW / 2, y, '#7a5230'); y += PX.lineH(); } setFont(2);
      y += 10;
    }
    const ky = R.y + R.h - 30; textC(g, 'BACK', VW / 2, ky, '#8a2a1a'); hits.push({ r: { x: VW / 2 - 40, y: ky - 6, w: 80, h: 22 }, fn: backOut });
    glove(g, VW / 2 - 34 + Math.round(Math.sin(S.t * 6) * 2), ky + 5, 1);
  }
  function regionLiveFar(g) { void g; }   // (far details are cached in far2; the lighthouse beam and gulls draw with the street)
  // A menu plank, drawn once per look into its own canvas so it can swing (rotated with nearest-neighbour, it stays crisp).
  const plankCache = {};
  function plankImg(it, sel) {
    const key = it.label + '|' + (it.tag || '') + '|' + sel + '|' + !!it.off;
    if (plankCache[key]) return plankCache[key];
    const w = 190, hh = 34, P = 4, c = mk(w + P * 2, hh + P * 2), g = c.getContext('2d'), x0 = P, y = P;
    const pts = [[x0, y + hh / 2], [x0 + 16, y], [x0 + w, y], [x0 + w, y + hh], [x0 + 16, y + hh]];
    poly(g, pts.map(([px, py]) => [px - (px === x0 ? 2 : 0), py + (py === y ? -1 : py === y + hh ? 1 : 0)]), DK);
    g.save(); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const [px, py] of pts.slice(1)) g.lineTo(px, py); g.closePath(); g.clip();
    wood(g, x0, y, w, hh, sel ? '#b07c48' : '#8a5a32', 11, false, 101 + it.label.length);
    rect(g, x0, y, w, 1, sel ? '#e6c890' : '#b07c48'); rect(g, x0, y + hh - 2, w, 2, '#4a2e1a');
    if (sel) stepped(g, x0 + w / 2 + 8, y + hh / 2, 74, 13, '#ffd27a', 0.16, 3);   // a little lantern glow behind the text
    g.restore();
    for (const nx of [x0 + 24, x0 + w - 7]) for (const ny of [y + 5, y + hh - 7]) { rect(g, nx - 1, ny - 1, 3, 3, DK); dot(g, nx, ny, sel ? '#ffe08a' : '#e0b040'); }
    const ty = it.tag ? y + 5 : y + 12;
    textC(g, it.label, x0 + w / 2 + 8, ty, it.off ? '#6e5a48' : sel ? '#ffe9a0' : '#f6e6c0', DK);
    if (it.tag) { setFont(1); textC(g, it.tag, x0 + w / 2 + 8, y + 21, it.off ? '#6e5a48' : sel ? '#ffe9a0' : '#e6d2ac'); setFont(2); }
    return (plankCache[key] = c);
  }
  function drawMain(g) {
    const list = MAIN();
    // signpost
    post(g, 826, 196, 16, 344, '#6e4a2c');
    poly(g, [[820, 198], [848, 198], [834, 184]], DK); poly(g, [[823, 197], [845, 197], [834, 187]], '#4a3226');
    list.forEach((it, i) => {
      const sel = i === S.sel; S.slide[i] += ((sel ? -8 : 0) - S.slide[i]) * 0.25;
      const x0 = 738 + Math.round(S.slide[i]), y = 214 + i * 46, w = 190, hh = 34, nx = 833, ny = y + 16;
      const shown = S.intro >= PLANK_AT(i);
      if (shown && dtIntro < PLANK_AT(i)) { S.ang[i] = calm() ? 0 : -1.1; S.vel[i] = 0; }   // it swings in from its nail
      if (!shown) return;
      g.save(); g.translate(nx, ny); g.rotate(S.ang[i]); g.drawImage(plankImg(it, sel), x0 - 4 - nx, y - 4 - ny); g.restore();
      rect(g, nx - 1, ny - 1, 3, 3, DK); dot(g, nx, ny, '#c9a468');
      hits.push({ r: { x: x0, y, w, h: hh }, i, fn: it.off ? () => H.sfx.bad() : it.act });
      if (sel && Math.abs(S.ang[i]) < 0.2) glove(g, x0 + w + 12 + Math.round(Math.sin(S.t * 6) * 3), y + hh / 2, -1);
    });
    dtIntro = S.intro;
    PX.textO(g, 'Arrow keys + Enter, or click', 14, 518, '#c9b8e0');   // (outlined: it sits over the street)
  }
  let dtIntro = 99;

  /* ---------- input ---------- */
  const intro = () => !S.overlay && S.intro < PLANK_AT(3) + 0.3;
  function skipIntro() { S.intro = 99; dtIntro = 99; }
  // a new selection: on the signpost the plank swings and knocks against the post
  function select(i) {
    if (i === S.sel) return;
    if (S.screen === 'main') { S.vel[i] += calm() ? 0 : 1.6; S.vel[S.sel] -= calm() ? 0 : 0.7; (H.sfx.knock || H.sfx.move)(); } else H.sfx.move();
    S.sel = i;
  }
  function move(p) {
    if (!p) return;
    S.mx = clamp(p.x / VW * 2 - 1, -1, 1); S.my = clamp(p.y / VH * 2 - 1, -1, 1);
    const h = hits.find(h => h.i !== undefined && inR(p, h.r));
    if (h && h.i !== S.sel) select(h.i);
    H.cursor(hits.some(h => inR(p, h.r)) ? 'pointer' : 'default');
  }
  function down(p) {
    H.startMusic();
    if (intro()) { skipIntro(); return; }   // a click skips the opening
    const h = hits.slice().reverse().find(h => h.fn && inR(p, h.r));
    if (h) { if (h.i !== undefined) S.sel = h.i; if (S.screen === 'main' || !rows()[S.sel] || !rows()[S.sel].type) H.sfx.ok(); h.fn(); }
  }
  function key(k) {
    H.startMusic();
    if (intro()) { skipIntro(); return; }   // any key skips the opening
    if (S.screen === 'book') {
      const n = Math.min(PER, GUESTS.length - S.page * PER), pages = Math.ceil(GUESTS.length / PER);
      if (k === 'Escape' || k === 'Backspace') return backOut();
      if (k === 'ArrowRight') { if (S.pick % 5 === 4 || S.pick === n - 1) { if (S.page < pages - 1) { S.page++; S.pick = 0; H.sfx.page(); } } else { S.pick++; H.sfx.move(); } }
      if (k === 'ArrowLeft') { if (S.pick % 5 === 0) { if (S.page > 0) { S.page--; S.pick = 0; H.sfx.page(); } } else { S.pick--; H.sfx.move(); } }
      if (k === 'ArrowDown' && S.pick + 5 < n) { S.pick += 5; H.sfx.move(); }
      if (k === 'ArrowUp' && S.pick >= 5) { S.pick -= 5; H.sfx.move(); }
      return;
    }
    if (S.screen === 'help') {   // the pinboard: left / right change the station tab
      if (k === 'ArrowLeft' || k === 'ArrowRight') { S.pinTab = clamp((S.pinTab || 0) + (k === 'ArrowLeft' ? -1 : 1), 0, TUT.GROUPS.length - 1); H.sfx.page(); }
      else if (['Escape', 'Enter', ' ', 'Backspace'].includes(k)) backOut();
      return;
    }
    if (S.screen === 'credits') { if (['Escape', 'Enter', ' ', 'Backspace'].includes(k)) backOut(); return; }
    const list = rows(), it = list[S.sel];
    if (k === 'ArrowUp') select((S.sel + list.length - 1) % list.length);
    else if (k === 'ArrowDown') select((S.sel + 1) % list.length);
    else if ((k === 'ArrowLeft' || k === 'ArrowRight') && it && it.type) {
      const d = k === 'ArrowLeft' ? -1 : 1;
      if (it.type === 'slider') it.set(Math.max(0, Math.min(10, it.get() + d)));
      else if (it.type === 'choice') it.set((it.get() + d + it.opts.length) % it.opts.length);
      else it.set(!it.get());
      H.sfx.move();
    } else if (k === 'Enter' || k === ' ') {
      if (!it) return;
      if (it.type === 'toggle') { it.set(!it.get()); H.sfx.ok(); }
      else if (it.type) return;
      else if (it.off) H.sfx.bad();
      else { H.sfx.ok(); it.act(); }
    } else if (k === 'Escape' || k === 'Backspace') { if (S.screen !== 'main') backOut(); }
  }
  const inR = (p, r) => p && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

  function init(hooks) { H = hooks; }
  function enter() { fake = undefined; readState(); S.overlay = false; S.screen = 'main'; S.sel = saveInfo() ? 0 : 1; S.open = 0; S.intro = 0; dtIntro = 0; S.ang.fill(0); S.vel.fill(0); }
  const debug = { event: k => startEvent(k), state: () => ({ ...TS, seats: seats.map(s => s && s.id), walkers: walkers.length, intro: S.intro }), skip: () => skipIntro(), walker: (t, stop) => spawnWalker(t, { stop, x: stop ? 300 : undefined, dir: 1 }), dragon: m => { Object.assign(village.dragon, { x: ROOST[0], y: ROOST[1] - 8, mode: m || 'sleep', t: 0, nap: 30 }); } };
  function openPause(screen) { S.overlay = true; S.screen = screen || 'pause'; S.sel = 0; S.open = 0; }

  return { init, enter, openPause, update, draw, move, down, key, debug };
})();
