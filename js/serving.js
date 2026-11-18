'use strict';
/* Serving room: eight private stalls behind sudare bamboo blinds, the counter, and our side of it.
   Drawn in local coordinates (0-1920); the caller translates it to world x SL.X0.
   Warm, detailed pixel art: honey hinoki, dark timber, cream plaster, a muted indigo for the shop's cloth.
   Each bay sits on one axis: seat number, pendant lamp, crest, guest, place setting and order ticket all line up
   on the bay's centre. At night the pendant lamps are the light: warm stepped pools with dithered edges. */
const SERVING = (() => {
  const { mk, rect, dot, ell, lathe, poly, line, shade, mix, text, textC, textW } = PX;
  const { wood, plaster, frameRect, lantern, emote, ao, pool, contact } = SCENE;
  const DK = PX.OUTLINE, CY = SL.COUNTER_Y;
  const C = {
    beam: PAL.beam, post: PAL.postWarm, plaster: PAL.plasterWarm, wall: PAL.wallDark, hinoki: '#dcae70',
    indigo: '#3a3f62', indigoLo: '#2a2e4a', indigoHi: '#4a5078',   // muted indigo cloth: warm wood and lamplight lead
    washi: '#fbf6ea', copper: PAL.copper, copperHi: PAL.copperHi, copperLo: PAL.copperLo, brass: PAL.brass, brassLo: PAL.brassLo
  };
  const SW = SL.W, OX = SL.OX, LEFT = SL.LEFT, RIGHT = SL.RIGHT;
  const WIN = { x: LEFT + 12, y: 84, w: RIGHT - LEFT - 24, h: 60 };
  const PORT = { cx: SW - 31, cy: 206, r: 20 };
  const D = SL.DOOR;
  const LAMP_Y = 104;                 // underside of each pendant shade
  const CORD_DX = 72;                 // the blind's pull-cord hangs at the bay's right, clear of the lamp
  const MENU_DX = 58;                 // the menu card stands to the right of the place setting
  const SIGN_X = 1778;                // the OPEN / CLOSED board, under the counter's right end (by the kitchen)
  let back = null, front = null, alley = null, alleyKey = '';

  const SEAT_K = 0.55;
  const seatY = gt => CY + 4 - Math.round((gt.bottom - gt.head) * SEAT_K) - gt.head;
  function silhouette(img) {
    const c = mk(img.width, img.height), g = c.getContext('2d');
    g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#2a1620'; g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function post(g, x, y, w, h, c) {
    rect(g, x - 1, y, w + 2, h, DK);
    rect(g, x, y, w, h, c);
    rect(g, x, y, 2, h, shade(c, 1.3)); rect(g, x + 2, y, 1, h, shade(c, 1.12));
    rect(g, x + w - 4, y, 2, h, shade(c, 0.78)); rect(g, x + w - 2, y, 2, h, shade(c, 0.6));
    for (let k = 14; k < h - 6; k += 37) { rect(g, x + 3, y + k, w - 6, 1, shade(c, 0.86)); rect(g, x + 4, y + k + 6, w - 9, 1, shade(c, 0.9)); }
    for (const [yy, hh] of [[y, 6], [y + h - 8, 8]]) { rect(g, x - 3, yy - 1, w + 6, hh + 2, DK); rect(g, x - 2, yy, w + 4, hh, shade(c, 0.9)); rect(g, x - 2, yy, w + 4, 1, shade(c, 1.25)); rect(g, x - 2, yy + hh - 1, w + 4, 1, shade(c, 0.6)); }
  }
  function crest(g, cx, cy, c = '#e8dcc0') {   // the shop crest: a bowl with chopsticks, in thread
    poly(g, [[cx - 10, cy - 2], [cx + 11, cy - 2], [cx + 6, cy + 6], [cx - 5, cy + 6]], c);
    rect(g, cx - 4, cy + 6, 9, 2, c); line(g, cx - 6, cy - 13, cx + 8, cy - 4, c, 1); line(g, cx - 3, cy - 14, cx + 10, cy - 6, c, 1);
  }
  function shield(g, cx, cy) {
    for (const s of [-1, 1]) {
      line(g, cx - 18 * s, cy - 22, cx + 16 * s, cy + 20, DK, 4); line(g, cx - 18 * s, cy - 22, cx + 16 * s, cy + 20, '#c9d1dd', 2);
      rect(g, cx + 12 * s - 4, cy + 12, 9, 3, DK); rect(g, cx + 12 * s - 3, cy + 13, 7, 1, C.brass);
      line(g, cx + 14 * s, cy + 15, cx + 17 * s, cy + 21, '#6b4a34', 2);
    }
    ell(g, cx, cy, 16, 16, DK); ell(g, cx, cy, 15, 15, '#8a5a32'); ell(g, cx, cy, 12, 12, '#6e4428');
    for (let a = 0; a < 8; a++) dot(g, cx + Math.round(Math.cos(a * Math.PI / 4) * 13), cy + Math.round(Math.sin(a * Math.PI / 4) * 13), C.brass);
    ell(g, cx, cy, 5, 5, DK); ell(g, cx, cy, 4, 4, C.brass); ell(g, cx - 1, cy - 1, 2, 2, '#ffe08a');
  }
  // The quest board: pinned notices and two wanted posters (a red header, a portrait, a reward line).
  function questBoard(g, x, y, w, h) {
    rect(g, x - 1, y - 1, w + 2, h + 2, DK); wood(g, x, y, w, h, '#8a5a32', h, false, 91);
    rect(g, x + 3, y + 3, w - 6, h - 6, DK); rect(g, x + 4, y + 4, w - 8, h - 8, PAL.cork);
    rect(g, x + 4, y + 4, w - 8, 9, '#6e4428'); for (let k = x + 8; k < x + w - 8; k += 4) rect(g, k, y + 8, 2, 1, '#e0b040');   // header plank
    const wanted = (px, py, face) => {
      rect(g, px - 1, py - 1, 20, 28, DK); rect(g, px, py, 18, 26, '#f0e2c0'); rect(g, px, py, 18, 5, '#a8302a'); for (let k = px + 2; k < px + 16; k += 3) rect(g, k, py + 2, 2, 1, '#f0e2c0');
      rect(g, px + 4, py + 7, 10, 10, '#d8c8a0'); ell(g, px + 9, py + 11, 3, 3, face); rect(g, px + 5, py + 14, 8, 3, face);
      rect(g, px + 3, py + 19, 12, 1, '#8a7a5a'); rect(g, px + 5, py + 22, 8, 1, '#c89a2a'); dot(g, px + 9, py, '#c8443a');
    };
    wanted(x + 5, y + 16, '#5a4a4a'); wanted(x + w - 23, y + 20, '#4a3a5a');
    for (const [px, py, pw, ph, col] of [[6, 50, 16, 20, '#f6ecd4'], [24, 54, 16, 16, '#efe0c0'], [8, 76, 30, 14, '#f6ecd4'], [10, 96, 14, 18, '#efe0c0'], [26, 98, 13, 13, '#f6ecd4']]) {
      if (px + pw > w - 4) continue;
      rect(g, x + px - 1, y + py - 1, pw + 2, ph + 2, DK); rect(g, x + px, y + py, pw, ph, col);
      for (let ly = y + py + 4; ly < y + py + ph - 2; ly += 3) rect(g, x + px + 2, ly, pw - 5, 1, '#b8a07a');
      dot(g, x + px + pw / 2, y + py + 1, '#c8443a');
    }
  }

  /* ---------- outside the window: an Edo-style adventurer town ----------
     Tiled roofs, a castle on the hill, the guild's signboard, laundry on a balcony, potted plants, a handcart and rope
     lines of paper lanterns (lit at night). Each road region adds its own touch. */
  function buildAlley(region, night) {
    const w = WIN.w, h = WIN.h, c = mk(w, h), g = c.getContext('2d');
    // sky (day: clear blue with a few clouds; night: deep blue with stars)
    rect(g, 0, 0, w, h, night ? '#1e2040' : '#a8d4ee'); rect(g, 0, 0, w, 12, night ? '#16182e' : '#8cc4e8');
    if (night) for (let k = 0; k < 60; k++) dot(g, Math.floor(SCENE.rnd(k * 5) * w), Math.floor(SCENE.rnd(k * 9) * 20), k % 4 ? '#8a8ab8' : '#e8e8ff');
    else for (const [cx, cy, cw] of [[120, 9, 34], [520, 6, 46], [930, 10, 30], [1310, 7, 40]]) { ell(g, cx, cy, cw, 4, '#ffffff'); ell(g, cx + 10, cy - 3, cw * 0.5, 4, '#ffffff'); rect(g, cx - cw, cy + 3, cw * 2, 1, '#d8ecf8'); }
    // the castle on its hill, far off (pale and low-contrast: background)
    const kx = Math.round(w * 0.56), hillC = night ? '#262a48' : '#9cc0a8', wallC = night ? '#3a3a5a' : '#eef0ee', roofC = night ? '#1a1c30' : '#5a6a80';
    ell(g, kx, 34, 120, 16, hillC);
    rect(g, kx - 22, 16, 44, 14, wallC); rect(g, kx - 14, 8, 28, 9, wallC); rect(g, kx - 8, 2, 16, 7, wallC);
    for (const [ry, rw] of [[15, 30], [7, 20], [1, 12]]) { poly(g, [[kx - rw, ry + 2], [kx - rw + 4, ry - 1], [kx + rw - 4, ry - 1], [kx + rw, ry + 2]], roofC); }
    for (let wx = kx - 16; wx < kx + 16; wx += 8) rect(g, wx, 21, 3, 3, night ? '#ffc870' : '#7a8a9a');
    // town houses: plaster and timber, dark tiled roofs
    const walls = night ? ['#3a2c34', '#463440', '#30262e'] : ['#e8dcc4', '#d8c8a8', '#f0e6d0'], roof = night ? '#1c1a28' : '#5a6070', timber = night ? '#241a20' : '#6a4a32';
    for (let x = 0, k = 0; x < w; k++) {
      const bw = 80 + ((k * 37) % 50), top = 26 + ((k * 13) % 8), wc = walls[k % 3];
      rect(g, x, top, bw, h - top, wc);
      for (let tx = x; tx < x + bw; tx += 26) rect(g, tx, top, 3, h - top, timber);
      rect(g, x, top + 12, bw, 2, timber);
      poly(g, [[x - 6, top + 1], [x + 4, top - 7], [x + bw - 4, top - 7], [x + bw + 6, top + 1]], roof);
      for (let rx = x - 2; rx < x + bw + 4; rx += 5) rect(g, rx, top - 1, 3, 2, night ? '#2a2836' : '#6e7484');
      // a lattice window on each house: lit at night
      const lx = x + 10 + ((k * 17) % (bw - 36));
      rect(g, lx - 1, top + 17, 18, 11, timber); rect(g, lx, top + 18, 16, 9, night ? ((k % 3) ? '#ffc870' : '#2a2030') : '#c8b48a');
      for (let q = lx + 3; q < lx + 16; q += 4) rect(g, q, top + 18, 1, 9, timber);
      // little lives: laundry on a balcony pole, potted plants, a water barrel
      if (k % 4 === 1) { rect(g, x + 8, top + 5, bw - 16, 1, timber); for (const [ox, cc] of [[14, '#f6f0e0'], [30, '#a8c4e0'], [46, '#e8a8a0']]) if (ox < bw - 20) rect(g, x + ox, top + 6, 10, 8, night ? '#4a4050' : cc); }
      if (k % 3 === 2) for (const ox of [6, 16]) { rect(g, x + ox, h - 7, 7, 7, night ? '#3a2a2a' : '#a8502a'); ell(g, x + ox + 3, h - 9, 5, 3, night ? '#2a3a2a' : '#5aa04a'); }
      if (k % 5 === 3) { rect(g, x + bw - 18, h - 12, 12, 12, timber); rect(g, x + bw - 18, h - 9, 12, 1, night ? '#3a2a2a' : '#a07a4a'); }
      if (region === 1) for (let q = x + 6; q < x + bw - 6; q += 4) rect(g, q, top + 30, 2, h - top - 30, timber);   // Kyoto: machiya lattice fronts
      x += bw + 2;
    }
    if (night) { const mx = Math.round(w * 0.86); ell(g, mx, 9, 7, 7, '#f6f0d0'); ell(g, mx + 2, 8, 2, 2, '#d8d0b0'); ell(g, mx - 3, 11, 1, 1, '#d8d0b0'); }   // the moon
    // the guild's crystal lamp on a post: a cool cyan glow at night (dithered), a pale crystal by day
    { const lx = Math.round(w * 0.3) + 50; if (night) for (let y = h - 50; y < h; y += 2) for (let x = lx - 26; x < lx + 28; x += 2) if (((x + y) >> 1) % 2 === 0 && Math.hypot(x - lx, (y - h + 34) * 1.3) < 26) rect(g, x, y, 2, 2, '#2a5a6a');
      rect(g, lx - 1, h - 30, 3, 30, DK); rect(g, lx - 4, h - 40, 9, 11, DK); rect(g, lx - 3, h - 39, 7, 9, night ? '#7af0f0' : '#bfe8ec'); if (night) rect(g, lx - 1, h - 37, 2, 5, '#e8ffff'); rect(g, lx - 5, h - 42, 11, 3, DK); }
    // the adventurers' guild signboard on a bracket: crossed swords over a shield
    const gx = Math.round(w * 0.3);
    rect(g, gx - 2, 18, 40, 2, timber); rect(g, gx + 4, 20, 1, 4, timber); rect(g, gx + 30, 20, 1, 4, timber);
    rect(g, gx, 24, 36, 22, DK); rect(g, gx + 1, 25, 34, 20, night ? '#4a3020' : '#8a5a32'); rect(g, gx + 1, 25, 34, 1, night ? '#5a3a28' : '#b07a4a');
    line(g, gx + 9, 28, gx + 27, 42, night ? '#8a8a9a' : '#e0e4ea'); line(g, gx + 27, 28, gx + 9, 42, night ? '#8a8a9a' : '#e0e4ea');
    ell(g, gx + 18, 35, 5, 6, DK); ell(g, gx + 18, 35, 4, 5, night ? '#7a2a22' : '#c8443a'); dot(g, gx + 18, 35, '#e0b040');
    // a handcart in the street
    const cx0 = Math.round(w * 0.72); rect(g, cx0, h - 14, 34, 4, timber); rect(g, cx0 + 30, h - 22, 3, 10, timber); line(g, cx0 + 34, h - 12, cx0 + 52, h - 18, timber);
    ell(g, cx0 + 8, h - 6, 6, 6, timber); ell(g, cx0 + 8, h - 6, 3, 3, night ? '#2a2030' : walls[0]);
    // rope lines of paper lanterns across the street
    for (let x = 0; x < w; x++) { const t = (x % 400) / 400, y = Math.round(10 + 8 * Math.sin(t * Math.PI)); dot(g, x, y, night ? '#2a2030' : '#6a5a4a'); if (x % 50 === 25) { rect(g, x - 3, y + 1, 7, 9, DK); rect(g, x - 2, y + 2, 5, 7, night ? '#ff8a4a' : '#e8604a'); if (night) rect(g, x - 1, y + 3, 2, 5, '#ffd090'); } }
    // regional touches
    if (region === 0) { line(g, 0, 18, 130, 34, '#5a3a2a', 3); for (const [px, py] of [[34, 23], [72, 18], [96, 33], [118, 35]]) { ell(g, px, py, 4, 4, DK); ell(g, px, py, 3, 3, '#f07a2a'); dot(g, px - 1, py - 1, '#ffb070'); } }   // countryside: persimmons
    if (region === 2) { const nx = Math.round(w * 0.82); rect(g, nx, 14, 18, 40, DK); rect(g, nx + 1, 15, 16, 38, night ? '#8a2a2a' : '#d8443a'); ell(g, nx + 9, 30, 6, 5, '#fff2d8'); }   // Osaka: a big shop banner
    if (region === 3) { const tx = Math.round(w * 0.9); rect(g, tx, 2, 3, h, timber); rect(g, tx + 14, 2, 3, h, timber); for (let y = 10; y < h; y += 10) line(g, tx, y, tx + 16, y + 8, timber); rect(g, tx - 3, 0, 23, 4, roof); }   // Tokyo: a fire watchtower
    if (region === 4) { const sx0 = Math.round(w * 0.42); rect(g, sx0, 30, 50, h - 30, night ? '#2a3a5a' : '#6ab0d0'); rect(g, sx0, 36, 50, 1, night ? '#4a5a7a' : '#c8ecf8'); for (let y = 30; y < 50; y += 4) for (let x = 200; x < 260; x += 4) dot(g, x + (y & 4 ? 2 : 0), y, night ? '#6a5a50' : '#c8a870'); }   // the coast
    return c;
  }

  function buildBack() {
    const c = mk(SW, VH), g = c.getContext('2d');
    wood(g, 0, 0, SW, 30, C.beam, 10, false, 205); rect(g, 0, 29, SW, 2, DK);
    plaster(g, 0, 31, SW, 210, C.plaster, 209);
    ao(g, 0, 31, SW, 210, 'top', 22, 0.45);
    frameRect(g, WIN.x, WIN.y, WIN.w, WIN.h, '#5a3820', 7);
    g.clearRect(WIN.x, WIN.y, WIN.w, WIN.h);
    for (let x = WIN.x + 49; x < WIN.x + WIN.w; x += 50) { rect(g, x - 1, WIN.y, 4, WIN.h, DK); rect(g, x, WIN.y, 2, WIN.h, '#6e4428'); dot(g, x, WIN.y, '#a57a4c'); }
    rect(g, WIN.x, WIN.y + 29, WIN.w, 4, DK); rect(g, WIN.x, WIN.y + 30, WIN.w, 2, '#6e4428');
    rect(g, WIN.x - 8, WIN.y + WIN.h + 7, WIN.w + 16, 2, shade('#5a3820', 0.55));
    ao(g, WIN.x - 8, WIN.y + WIN.h + 9, WIN.w + 16, 10, 'top', 8, 0.3);
    rect(g, 0, 240, SW, 8, DK); rect(g, 0, 241, SW, 6, '#6e4428'); rect(g, 0, 241, SW, 1, '#a57a4c'); rect(g, 0, 246, SW, 1, '#4a2e1a');
    wood(g, 0, 248, SW, 60, '#5a3a22', 24, true, 211);
    ao(g, 0, 248, SW, 60, 'top', 8, 0.5);
    for (let i = 0; i < SL.NSTALL; i++) {
      const sx = SL.stallX(i), x0 = sx + 6, w = SL.STALL_W - 12, top = SL.BLIND_TOP, h = CY - top;
      ao(g, x0, top, w, h, 'left', 22, 0.42); ao(g, x0, top, w, h, 'right', 30, 0.55); ao(g, x0, top, w, h, 'top', 44, 0.5);
    }
    return c;
  }

  /* ---------- the staff door ---------- */
  function buildLeaf() {
    const c = mk(D.w, D.h), g = c.getContext('2d'), w = D.w;
    rect(g, 0, 0, w, D.h, DK); wood(g, 1, 0, w - 2, D.h, '#7a5230', 14, true, 63);
    rect(g, 1, 0, w - 2, 2, '#a57a4c'); ao(g, 0, 0, w, D.h, 'top', 10, 0.35);
    for (const [px, py, pw, ph] of [[10, 52, w - 20, 60], [10, 124, w - 20, 70]]) { rect(g, px - 1, py - 1, pw + 2, ph + 2, '#4a2e1a'); rect(g, px, py, pw, ph, '#6e4428'); rect(g, px, py, pw, 1, '#8a623c'); }
    rect(g, 22, 12, w - 44, 30, DK); rect(g, 23, 13, w - 46, 28, '#1e2440'); rect(g, Math.floor(w / 2) - 1, 13, 2, 28, DK); rect(g, 23, 26, w - 46, 2, DK);
    rect(g, 25, 15, 8, 3, '#5a6890');
    rect(g, w - 20, 112, 8, 14, DK); rect(g, w - 19, 113, 6, 12, C.brass); rect(g, w - 19, 113, 2, 12, C.copperHi);
    for (const hy of [20, D.h - 34]) { rect(g, 1, hy, 5, 14, DK); rect(g, 2, hy + 1, 3, 12, C.brass); }
    return c;
  }
  let leaf = null;
  function doorLeaf(g, G) {
    if (!leaf) leaf = buildLeaf();
    const o = Math.max(0, Math.min(1, G.staffDoor || 0)), sh = G.doorShake > 0 ? Math.round(Math.sin(G.t * 70) * 1.5) : 0;
    if (o < 0.01) { g.drawImage(leaf, D.x + sh, D.y); return; }
    const th = o * 1.3, cs = Math.cos(th), sn = Math.sin(th), wv = D.w * cs, up = 18 * sn, dn = 8 * sn;
    for (let c = 0; c < D.w; c += 2) {
      const u = c / D.w, x = D.x + Math.floor(u * wv), x2 = D.x + Math.ceil((c + 2) / D.w * wv);
      const top = D.y + Math.round(u * up), bot = D.y + D.h - Math.round(u * dn);
      g.drawImage(leaf, c, 0, 2, D.h, x, top, Math.max(1, x2 - x), bot - top);
    }
    for (let y = Math.round(D.y + up); y < D.y + D.h - dn; y += 2) for (let x = D.x + ((y >> 1) & 1); x < D.x + wv; x += 2) if (sn > 0.4 || (x + y) % 4 === 0) dot(g, x, y, '#1a0e14');   // the turned leaf falls into shade (dithered)
    rect(g, Math.round(D.x + wv) - 1, Math.round(D.y + up), 3, Math.round(D.h - up - dn), DK);
  }
  function staffDoor(g) {
    rect(g, D.x - 7, D.y - 7, D.w + 14, D.h + 7, DK); wood(g, D.x - 6, D.y - 6, D.w + 12, D.h + 6, '#4a2e1a', 8, true, 61);
    for (let i = 0; i < 8; i++) rect(g, D.x, D.y + i * 26, D.w, 27, mix('#140e18', '#221a2a', i / 7));
    rect(g, D.x, D.y + D.h - 30, D.w, 30, '#2a2230'); rect(g, D.x, D.y + D.h - 30, D.w, 1, '#3a3040');
    rect(g, D.x + 44, D.y + 40, 40, 56, '#0e0a14'); rect(g, D.x + 46, D.y + 42, 36, 52, '#2a3050'); rect(g, D.x + 63, D.y + 42, 2, 52, '#0e0a14'); rect(g, D.x + 46, D.y + 66, 36, 2, '#0e0a14');
    rect(g, D.x + 48, D.y + 44, 6, 3, '#5a6890');
    const pw = textW('STAFF ONLY') + 14, px = Math.round(D.x + D.w / 2 - pw / 2), py = D.y - 34;
    rect(g, px - 1, py - 1, pw + 2, 22, DK); rect(g, px, py, pw, 20, '#7a1e18'); rect(g, px, py, pw, 1, '#b8302a'); rect(g, px, py + 18, pw, 2, '#4a0e0a');
    dot(g, px + 3, py + 3, C.brass); dot(g, px + pw - 4, py + 3, C.brass);
    textC(g, 'STAFF ONLY', D.x + D.w / 2, py + 4, '#f6e6c0');
  }

  /* ---------- the counter, its skirt and the lower wall ---------- */
  function weave(g, x, y, w, h) {   // muted indigo cloth with a subtle two-tone weave
    rect(g, x, y, w, h, C.indigo);
    for (let yy = y; yy < y + h; yy += 2) for (let xx = x + ((yy - y) & 2 ? 1 : 0); xx < x + w; xx += 4) { dot(g, xx, yy, C.indigoHi); dot(g, xx + 2, yy + 1, C.indigoLo); }
  }
  function stool(g, cx, by, worn) {   // a round wooden stool tucked under the counter
    const top = by - 58;
    ell(g, cx, top + 4, 26, 7, DK); ell(g, cx, top + 3, 25, 6, '#8a5a32'); ell(g, cx - 4, top + 2, 17, 3, '#a8784a');
    if (worn) ell(g, cx + 6, top + 3, 5, 1, '#6e4428');
    rect(g, cx - 25, top + 4, 51, 6, DK); rect(g, cx - 24, top + 4, 49, 5, '#6e4428'); rect(g, cx - 24, top + 4, 49, 1, '#8a5a32');
    for (const lx of [cx - 20, cx + 15]) { rect(g, lx - 1, top + 10, 7, by - top - 10, DK); rect(g, lx, top + 10, 5, by - top - 10, '#5a3a22'); rect(g, lx, top + 10, 1, by - top - 10, '#7a5230'); }
    rect(g, cx - 18, top + 32, 37, 4, DK); rect(g, cx - 17, top + 33, 35, 2, '#5a3a22');
  }
  // Weapons leaning against a stool, leaning left (background-ish props: outlined lightly, lower contrast).
  function lean(g, kind, x, by) {
    if (kind === 'katana') {
      line(g, x, by - 2, x - 10, by - 70, DK, 5); line(g, x, by - 2, x - 10, by - 70, '#2a1a2a', 3); line(g, x - 1, by - 4, x - 10, by - 66, '#4a3a4a', 1);
      line(g, x - 10, by - 70, x - 13, by - 88, DK, 4); line(g, x - 10, by - 70, x - 13, by - 88, '#e8dcc0', 2);
      for (let k = 0; k < 4; k++) dot(g, x - 11 - Math.round(k * 0.6), by - 74 - k * 4, '#5a3a5a');
      rect(g, x - 15, by - 72, 10, 3, DK); rect(g, x - 14, by - 71, 8, 1, '#c9962e');
    } else if (kind === 'spear') {
      line(g, x, by - 2, x - 14, by - 120, DK, 4); line(g, x, by - 2, x - 14, by - 120, '#8a5a32', 2);
      poly(g, [[x - 14, by - 120], [x - 19, by - 134], [x - 11, by - 122]], DK); poly(g, [[x - 14, by - 121], [x - 18, by - 132], [x - 12, by - 122]], '#d8dee8');
      rect(g, x - 16, by - 120, 5, 4, '#c8443a');
    } else {
      line(g, x, by - 2, x + 10, by - 58, DK, 4); line(g, x, by - 2, x + 10, by - 58, '#6e4428', 2);
      poly(g, [[x + 8, by - 52], [x + 22, by - 62], [x + 24, by - 46], [x + 10, by - 46]], DK); poly(g, [[x + 9, by - 51], [x + 21, by - 60], [x + 22, by - 48], [x + 10, by - 47]], '#b8c0cc'); rect(g, x + 20, by - 59, 2, 12, '#e8eef6');
    }
  }
  function umbrellaStand(g, cx, by) {   // a blue-and-white ceramic stand with two staffs and a paper umbrella
    line(g, cx - 6, by - 30, cx - 12, by - 110, DK, 4); line(g, cx - 6, by - 30, cx - 12, by - 110, '#7a5232', 2); ell(g, cx - 12, by - 114, 5, 5, DK); ell(g, cx - 12, by - 114, 4, 4, '#8fd3ff'); dot(g, cx - 13, by - 116, '#ffffff');
    line(g, cx + 4, by - 30, cx + 8, by - 100, DK, 4); line(g, cx + 4, by - 30, cx + 8, by - 100, '#a8784a', 2); for (const d of [-4, 4]) line(g, cx + 8, by - 100, cx + 8 + d, by - 108, '#5a8a3a', 2);
    line(g, cx, by - 30, cx + 2, by - 84, DK, 6); line(g, cx, by - 30, cx + 2, by - 84, '#c8443a', 4); rect(g, cx - 1, by - 86, 5, 3, DK);
    rect(g, cx - 13, by - 32, 27, 32, DK); rect(g, cx - 12, by - 31, 25, 31, '#e8eef4'); rect(g, cx - 12, by - 31, 25, 3, '#ffffff');
    for (let k = 0; k < 4; k++) { rect(g, cx - 10 + k * 6, by - 22, 4, 4, '#3a5a9a'); rect(g, cx - 7 + k * 6, by - 13, 3, 3, '#3a5a9a'); }
    rect(g, cx - 12, by - 4, 25, 2, '#9ab0c8');
  }
  function packs(g, x, by) {   // travel packs with bedrolls, set down by the door
    for (const [ox, w, h, col] of [[0, 34, 30, '#7a6a4a'], [30, 28, 24, '#5a6a4a']]) {
      const px = x + ox, top = by - h;
      rect(g, px - 1, top - 1, w + 2, h + 1, DK); rect(g, px, top, w, h, col); rect(g, px, top, w, 3, shade(col, 1.2)); rect(g, px + w - 4, top, 4, h, shade(col, 0.8));
      rect(g, px + 4, top + 8, w - 8, 10, shade(col, 0.85)); rect(g, px + w / 2 - 2, top + 10, 4, 3, '#c9962e');
      ell(g, px + w / 2, top - 4, w / 2 - 2, 5, DK); ell(g, px + w / 2, top - 4, w / 2 - 3, 4, ox ? '#a85a3a' : '#5a7a9a'); rect(g, px + w / 2 - 1, top - 8, 2, 8, '#3a2a1a');
    }
  }
  function buildFront() {
    const c = mk(SW, VH), g = c.getContext('2d');
    const x0 = LEFT, x1 = RIGHT;
    for (const [x, w, inner] of [[0, x0 - 6, 'right'], [x1 + 6, SW - x1 - 6, 'left']]) {
      wood(g, x, 31, w, CY - 31, C.wall, 20, true, x + 3);
      ao(g, x, 31, w, CY - 31, 'top', 18, 0.5); ao(g, x, 31, w, CY - 31, inner, 12, 0.45);
    }
    staffDoor(g);
    // the round window in the right wall (the alley shows through), framed in the wall's own wood
    ell(g, PORT.cx, PORT.cy, PORT.r + 5, PORT.r + 5, DK); ell(g, PORT.cx, PORT.cy, PORT.r + 4, PORT.r + 4, '#5a3820'); ell(g, PORT.cx - 1, PORT.cy - 1, PORT.r + 2, PORT.r + 2, '#7a5230'); ell(g, PORT.cx + 1, PORT.cy + 1, PORT.r + 1, PORT.r + 1, '#3a2418');
    ell(g, PORT.cx, PORT.cy, PORT.r + 1, PORT.r + 1, DK);
    g.globalCompositeOperation = 'destination-out'; ell(g, PORT.cx, PORT.cy, PORT.r, PORT.r, '#000'); g.globalCompositeOperation = 'source-over';
    rect(g, PORT.cx - 1, PORT.cy - PORT.r, 3, 2 * PORT.r + 1, DK); rect(g, PORT.cx, PORT.cy - PORT.r, 1, 2 * PORT.r + 1, '#5a3820');
    rect(g, PORT.cx - PORT.r, PORT.cy - 1, 2 * PORT.r + 1, 3, DK); rect(g, PORT.cx - PORT.r, PORT.cy, 2 * PORT.r + 1, 1, '#5a3820');
    shield(g, 176, 274);
    questBoard(g, 156, 112, 46, 132);
    for (let i = 0; i < SL.NSTALL; i++) post(g, SL.stallX(i) - 7, SL.BLIND_TOP, 14, CY - SL.BLIND_TOP, C.post);
    post(g, RIGHT - 7, SL.BLIND_TOP, 14, CY - SL.BLIND_TOP, C.post);
    // a little note pinned to one post
    { const nx = SL.stallX(2) - 6, ny = 150; rect(g, nx - 1, ny - 1, 14, 17, DK); rect(g, nx, ny, 12, 15, '#f6ecd4'); for (let ly = ny + 4; ly < ny + 13; ly += 3) rect(g, nx + 2, ly, 7 + (ly % 2), 1, '#8a7a6a'); dot(g, nx + 6, ny + 1, '#c8443a'); }
    // beam with each bay's seat number, centred on the bay
    rect(g, x0 - 12, SL.BEAM_Y - 1, x1 - x0 + 24, 24, DK);
    wood(g, x0 - 11, SL.BEAM_Y, x1 - x0 + 22, 22, C.beam, 11, false, 231);
    rect(g, x0 - 11, SL.BEAM_Y, x1 - x0 + 22, 1, '#8a623c'); rect(g, x0 - 11, SL.BEAM_Y + 19, x1 - x0 + 22, 3, '#2a1a14');
    for (let i = 0; i < SL.NSTALL; i++) {
      const cx = SL.stallCX(i);
      rect(g, cx - 14, SL.BEAM_Y + 1, 29, 20, DK); rect(g, cx - 13, SL.BEAM_Y + 2, 27, 18, '#ecd8ac');
      rect(g, cx - 13, SL.BEAM_Y + 2, 27, 1, '#fff6dc'); rect(g, cx - 13, SL.BEAM_Y + 18, 27, 2, '#bfa478');
      dot(g, cx - 10, SL.BEAM_Y + 5, C.brassLo); dot(g, cx + 10, SL.BEAM_Y + 5, C.brassLo);
      textC(g, String(i + 1), cx, SL.BEAM_Y + 6, '#6a2414');
    }
    // the counter: a thick hinoki slab with a lit top edge and a bevelled lip
    rect(g, 0, CY - 1, SW, VH - CY + 1, DK);
    wood(g, 0, CY, SW, 14, C.hinoki, 7, false, 251);
    rect(g, 0, CY, SW, 1, '#fff0c8'); rect(g, 0, CY + 1, SW, 1, '#f0c88a');
    rect(g, 0, CY + 11, SW, 3, '#a8763e'); rect(g, 0, CY + 14, SW, 2, '#6e4826'); rect(g, 0, CY + 16, SW, 1, DK);
    // the skirt under the lip: muted indigo with a weave, a seam between bays (the crest lives on each valance)
    const NY = CY + 17, NH = 24;
    weave(g, 0, NY, SW, NH); rect(g, 0, NY, SW, 2, C.indigoLo);
    for (let i = 0; i <= SL.NSTALL; i++) { const x = i < SL.NSTALL ? SL.stallX(i) : RIGHT; rect(g, x, NY + 2, 1, NH - 2, C.indigoLo); rect(g, x + 1, NY + 2, 1, NH - 2, C.indigoHi); }
    rect(g, 0, NY + NH, SW, 1, DK);
    // the lower wall: darker raised panels, a brass footrest with scuffs, a stool under every bay, a bag hook or two
    const LY = NY + NH + 1, FR = VH - 40;
    wood(g, 0, LY, SW, VH - LY, '#3e2618', 14, true, 253);
    ao(g, 0, LY, SW, 30, 'top', 16, 0.6);
    for (let i = 0; i < SL.NSTALL; i++) {
      const x = SL.stallX(i) + 10, w = SL.STALL_W - 20;
      rect(g, x, LY + 10, w, FR - LY - 18, '#2e1c12'); rect(g, x + 2, LY + 12, w - 4, FR - LY - 22, '#4a2e1c'); rect(g, x + 2, LY + 12, w - 4, 1, '#5e3c24'); rect(g, x + 2, FR - 11, w - 4, 1, '#2a1a10');
    }
    rect(g, 0, FR - 1, SW, 7, DK); rect(g, 0, FR, SW, 5, '#b8862e'); rect(g, 0, FR, SW, 1, '#f0c868'); rect(g, 0, FR + 4, SW, 1, '#7a5418');
    for (let k = 0; k < 70; k++) { const x = Math.floor(SCENE.rnd(k * 13 + 3) * SW); rect(g, x, FR + 1 + (k % 3), 3 + (k % 4), 1, '#8a6420'); }   // scuffs
    for (let x = 0; x < SW; x += 160) { rect(g, x + 40, FR + 5, 5, VH - FR - 5, DK); rect(g, x + 41, FR + 5, 3, VH - FR - 5, '#7a5418'); }   // rail brackets
    for (let i = 0; i < SL.NSTALL; i++) stool(g, SL.stallCX(i), FR, i % 3 === 1);
    // adventurers' gear: a katana, a spear and an axe leaning on the stools; staffs in the umbrella stand; packs by the door
    lean(g, 'katana', SL.stallCX(0) + 30, FR); lean(g, 'spear', SL.stallCX(2) + 30, FR); lean(g, 'axe', SL.stallCX(3) - 34, FR);
    umbrellaStand(g, 176, FR); packs(g, 60, FR);
    for (const i of [1, 3, 6]) { const hx = SL.stallCX(i) + 70; rect(g, hx - 1, LY + 2, 4, 3, DK); rect(g, hx, LY + 3, 2, 8, C.brass); rect(g, hx, LY + 10, 6, 2, C.brass); rect(g, hx + 4, LY + 7, 2, 4, C.brass); }   // bag hooks
    // the OPEN / CLOSED board hangs from two hooks under the counter's right end, by the kitchen
    for (const hx of [SIGN_X + 20, SIGN_X + 108]) { rect(g, hx - 1, CY + 41, 4, 4, DK); rect(g, hx, CY + 42, 2, 2, C.brass); }
    return c;
  }

  /* ---------- blinds, cords, lamps ---------- */
  const blindLen = down => Math.round(12 + (CY - SL.BLIND_TOP - 12) * down);
  const cordAt = (i, down) => ({ x: SL.stallCX(i) + CORD_DX, y: SL.BLIND_TOP + blindLen(down) + 14 - (i === 0 ? 9 : 0) });
  const downFor = y => Math.max(0, Math.min(1, (y - SL.BLIND_TOP - 26) / (CY - SL.BLIND_TOP - 12)));
  // Sudare bamboo blind: opaque slats with a lit top edge and dark gaps; whatever sits behind shows through the gaps
  // only. A short indigo valance with the bay's crest hides the roll. Bay 1's blind always rests a few slats higher.
  function blind(g, i, down, locked) {
    const x = SL.stallX(i) + 6, w = SL.STALL_W - 12, y0 = SL.BLIND_TOP, len = Math.max(12, blindLen(down) - (i === 0 ? 9 : 0));
    const top = locked ? '#a8906a' : '#e6c47a', base = locked ? '#8a7454' : '#c8a058', gap = locked ? '#2a1c18' : '#3a2214';
    for (let r = 12; r < len; r++) {
      const y = y0 + r, k = r % 3;
      if (k === 2 && r < len - 6) { rect(g, x, y, w, 1, gap); continue; }
      const c = k === 0 ? top : base;
      rect(g, x, y, w, 1, c);
      rect(g, x, y, Math.round(w * 0.2), 1, shade(c, 1.08)); rect(g, x + Math.round(w * 0.74), y, w - Math.round(w * 0.74), 1, shade(c, 0.88));
      rect(g, x + w - 6, y, 6, 1, shade(c, 0.74));
      if ((r * 7) % 17 < 3) rect(g, x + ((r * 37) % (w - 30)), y, 14, 1, shade(c, 0.84));   // bamboo nodes
    }
    rect(g, x - 1, y0, 1, len, DK); rect(g, x + w, y0, 1, len, DK);
    for (const sx of [18, (w >> 1) - 1, w - 20]) {
      rect(g, x + sx, y0 + 12, 2, len - 12, '#5a3416');
      for (let r = 16; r < len; r += 9) { rect(g, x + sx - 1, y0 + r, 4, 2, '#7a4a22'); dot(g, x + sx - 1, y0 + r, '#a8703a'); }
    }
    rect(g, x - 1, y0 + len, w + 2, 6, DK); rect(g, x, y0 + len, w, 4, '#a8803e'); rect(g, x, y0 + len, w, 1, '#e0bd72'); rect(g, x, y0 + len + 3, w, 1, '#6e4e22');
    rect(g, x - 2, y0 - 2, w + 4, 18, DK); rect(g, x - 1, y0 - 1, w + 2, 16, C.indigo); rect(g, x - 1, y0 - 1, w + 2, 2, C.indigoLo);
    for (const s of [w / 3, (2 * w) / 3]) { rect(g, x + Math.round(s), y0 + 4, 1, 11, C.indigoLo); rect(g, x + Math.round(s) + 1, y0 + 4, 1, 11, C.indigoHi); }
    rect(g, x - 1, y0 + 14, w + 2, 1, C.indigoLo);
    crest(g, SL.stallCX(i), y0 + 9);
    return len;
  }
  function drawCord(g, G, i, len) {
    const st = G.stalls[i], x = SL.stallCX(i) + CORD_DX, top = SL.BLIND_TOP + len + 5, y = top + 9;
    rect(g, x - 1, top, 3, y - top - 2, DK); rect(g, x, top, 1, y - top - 2, '#c0392b');
    rect(g, x - 4, y - 3, 9, 9, DK); rect(g, x - 3, y - 2, 7, 7, '#c0392b'); rect(g, x - 3, y - 2, 2, 7, '#e2685c'); rect(g, x + 2, y - 2, 2, 7, '#8f2420');
    rect(g, x - 3, y - 4, 7, 2, C.brass);
    for (let k = -2; k <= 2; k += 2) rect(g, x + k, y + 5, 1, 4, '#a8302a');
    const gu = st.guest;
    if (gu && gu.state === 'call' && st.blind > 0.9) {
      const ay = y - 22 - Math.round(Math.abs(Math.sin(G.t * 5)) * 4);
      poly(g, [[x - 7, ay + 7], [x + 8, ay + 7], [x + 0.5, ay - 2]], DK); poly(g, [[x - 4, ay + 5], [x + 5, ay + 5], [x + 0.5, ay]], '#fff6d0');
      rect(g, x - 2, ay + 7, 5, 6, DK); rect(g, x - 1, ay + 6, 3, 6, '#fff6d0');
    }
  }
  function pendant(g, G, i) {   // a copper pendant lamp, centred over the seat
    const cx0 = SL.stallCX(i), lit = stallOpen(i) && (G.nightF || 0) > 0.05, top = SL.BEAM_Y + 22;
    const x = cx0 + Math.round(Math.sin(G.t * 0.7 + i * 1.9) * 1.2);   // a gentle sway on the cord
    rect(g, cx0, top, 1, 12, '#1a1010'); line(g, cx0, top + 12, x, LAMP_Y - 14, '#1a1010');
    rect(g, x - 3, LAMP_Y - 17, 7, 4, DK); rect(g, x - 2, LAMP_Y - 16, 5, 2, '#5a4030');
    poly(g, [[x - 6, LAMP_Y - 14], [x + 7, LAMP_Y - 14], [x + 16, LAMP_Y], [x - 15, LAMP_Y]], DK);
    poly(g, [[x - 5, LAMP_Y - 13], [x + 6, LAMP_Y - 13], [x + 14, LAMP_Y - 1], [x - 13, LAMP_Y - 1]], '#8a4a24');
    poly(g, [[x - 4, LAMP_Y - 12], [x - 1, LAMP_Y - 12], [x - 6, LAMP_Y - 2], [x - 10, LAMP_Y - 2]], '#c06a34');
    rect(g, x - 14, LAMP_Y - 1, 30, 2, lit ? '#ffd890' : '#4a3020');
    if (lit) { rect(g, x - 5, LAMP_Y + 1, 11, 2, '#fff2c8'); rect(g, x - 2, LAMP_Y + 1, 5, 1, '#ffffff'); }
  }

  /* ---------- the place setting (centred), cup and jar on the left, the clickable menu on the right ---------- */
  const menuRect = i => ({ x: SL.X0 + SL.stallCX(i) + MENU_DX - 2, y: CY - 44, w: 44, h: 46 });
  let menuArt = null;
  function buildMenu() {
    const c = mk(40, 42), g = c.getContext('2d'), mx = 1;
    rect(g, 0, 0, 40, 40, DK); rect(g, mx, 1, 38, 37, '#f6ecd4'); rect(g, mx + 35, 1, 3, 37, '#dccaa4');
    rect(g, mx, 1, 38, 14, '#7a1e18'); rect(g, mx, 1, 38, 1, '#b8302a'); rect(g, mx, 14, 38, 1, '#3e140a');
    poly(g, [[mx + 12, 6], [mx + 26, 6], [mx + 23, 11], [mx + 15, 11]], '#f6e6c0'); line(g, mx + 14, 2, mx + 24, 7, '#f6e6c0', 1);
    rect(g, mx + 4, 19, 6, 5, '#d98a2b'); rect(g, mx + 13, 20, 20, 2, '#b8a07a');
    rect(g, mx + 4, 28, 6, 5, '#c8302a'); rect(g, mx + 13, 29, 20, 2, '#b8a07a');
    rect(g, mx + 1, 35, 34, 2, '#dccaa4');
    return c;
  }
  function setting(g, i) {
    const cx = SL.stallCX(i);
    // the mat and chopsticks on a rest, on the bay's axis
    rect(g, cx - 30, CY - 2, 60, 2, '#a8784a'); rect(g, cx - 30, CY - 2, 60, 1, '#c89a62');
    line(g, cx + 6, CY - 4, cx + 34, CY - 5, DK, 3); line(g, cx + 6, CY - 5, cx + 34, CY - 6, '#e3c07a'); rect(g, cx + 18, CY - 4, 5, 3, '#6a8aa0');
    // water cup (bay 3's is red ceramic)
    const red = i === 2, cup = red ? ['#8a2a22', '#c8443a', '#e8806a'] : ['#7fb0bf', '#a8d2dc', '#e2f6fa'];
    contact(g, cx - 64, CY + 2, 11, 3);
    rect(g, cx - 72, CY - 15, 15, 17, DK); rect(g, cx - 71, CY - 14, 13, 15, cup[1]); rect(g, cx - 71, CY - 14, 13, 4, cup[2]);
    rect(g, cx - 71, CY - 10, 2, 10, cup[2]); rect(g, cx - 62, CY - 10, 3, 10, cup[0]); rect(g, cx - 71, CY - 1, 13, 1, shade(cup[0], 0.8));
    // chopstick jar (bay 4's is half empty)
    contact(g, cx - 42, CY + 2, 10, 3);
    rect(g, cx - 50, CY - 13, 14, 15, DK); rect(g, cx - 49, CY - 12, 12, 13, '#3e2a20'); rect(g, cx - 49, CY - 12, 3, 13, '#5a3e2c'); rect(g, cx - 40, CY - 12, 3, 13, '#2a1a14'); rect(g, cx - 49, CY - 12, 12, 2, '#6b4a34');
    const sticks = i === 3 ? [[-46, -1]] : [[-46, -1], [-42, 1], [-39, 0]];
    for (const [a, b] of sticks) { line(g, cx + a, CY - 12, cx + a + b * 2, CY - 27, DK, 3); line(g, cx + a, CY - 13, cx + a + b * 2, CY - 26, '#e3c07a'); }
    // the menu card (bay 2's leans over a little)
    if (!menuArt) menuArt = buildMenu();
    const mx = cx + MENU_DX;
    contact(g, mx + 20, CY + 1, 22, 3);
    poly(g, [[mx + 4, CY + 1], [mx + 34, CY + 1], [mx + 30, CY - 4], [mx + 8, CY - 4]], DK);
    if (i === 1) for (let r = 0; r < 40; r++) g.drawImage(menuArt, 0, r, 40, 1, mx + Math.floor((40 - r) / 8), CY - 42 + r, 40, 1);
    else g.drawImage(menuArt, mx - 1, CY - 42);
    if (i === 2) { ell(g, mx + 28, CY - 10, 5, 5, DK); ell(g, mx + 28, CY - 10, 4, 4, '#8fd86a'); dot(g, mx + 27, CY - 11, '#d8f6b0'); }   // a sticker on bay 3's menu
  }
  function lockedPlaque(g, i) {
    const cx = SL.stallCX(i);
    line(g, cx - 18, 140, cx, 126, '#5a3416'); line(g, cx + 18, 140, cx, 126, '#5a3416'); rect(g, cx - 2, 124, 4, 4, C.brass);
    rect(g, cx - 25, 139, 50, 40, DK); wood(g, cx - 24, 140, 48, 38, '#8a5a32', 38, false, 40 + i); rect(g, cx - 24, 140, 48, 1, '#c08a52');
    rect(g, cx - 7, 148, 14, 4, DK); rect(g, cx - 7, 148, 4, 9, DK); rect(g, cx + 3, 148, 4, 9, DK); rect(g, cx - 6, 149, 2, 8, '#c9d1dd'); rect(g, cx + 4, 149, 2, 8, '#c9d1dd'); rect(g, cx - 6, 149, 12, 2, '#c9d1dd');
    rect(g, cx - 10, 156, 20, 16, DK); rect(g, cx - 9, 157, 18, 14, C.brass); rect(g, cx - 9, 157, 18, 2, '#ffe08a'); rect(g, cx - 1, 161, 3, 6, DK);
  }

  /* ---------- guests, tickets, the queue, keepsakes ---------- */
  function guestPose(G, i) {
    const st = G.stalls[i], gu = st.guest;
    let a = 1, yo = 0;
    if (gu.state === 'arrive') { const p = Math.min(1, gu.t / 0.8); a = p; yo = Math.round((1 - p) * -18 + Math.sin(p * Math.PI) * 6); }
    else if (gu.state === 'leave') { const p = Math.min(1, gu.t / 0.8); a = 1 - p; yo = -Math.round(p * 20); }
    else if (gu.state === 'eat') yo = Math.round(Math.abs(Math.sin(gu.t * 5)) * 3);
    else if (gu.state === 'pay' && gu.mood === 'happy') yo = -Math.round(Math.abs(Math.sin(gu.t * 9)) * 8 * Math.max(0, 1 - gu.t / 1.2));
    else yo = Math.sin(G.t * 1.6 + i * 2) > 0.5 ? 1 : 0;
    return { a, y: seatY(gu.gt) + yo };
  }
  // behind: the guest in full colour, clipped to the bay. gaps: the guest again, seen only through the blind's gaps
  // (a crisp silhouette when the blind is fully down).
  function drawGuest(g, G, i, len, gaps) {
    const st = G.stalls[i], gu = st.guest;
    if (!gu || !gu.img.complete) return;
    const { a, y } = guestPose(G, i); if (a <= 0) return;
    const x = SL.stallX(i) + 6, w = SL.STALL_W - 12;
    g.save(); g.beginPath();
    if (gaps) { for (let r = 14; r < len - 6; r += 3) g.rect(x, SL.BLIND_TOP + r, w, 1); }
    else g.rect(x, SL.BLIND_TOP, w, CY - SL.BLIND_TOP);
    g.clip(); g.globalAlpha = a;
    g.drawImage(gaps && st.blind >= 0.98 ? gu.sil : gu.img, SL.stallCX(i) - gu.gt.ax, y);
    g.restore(); g.globalAlpha = 1;
  }
  // The order ticket, clipped to the counter's lip on the bay's axis: the number, then the ramen's name.
  function ticket(g, cx, num, m, t) {
    const lines = textW(m.short) > 90 ? m.short.split(' ') : [m.short];
    const w = Math.max(64, ...lines.map(l => textW(l) + 18)), h = 26 + lines.length * 16, x = Math.round(cx - w / 2), y = CY + 22;
    const sway = Math.round(Math.sin(t * 1.4 + cx) * 0.6);
    rect(g, x + 3, y + 3, w, h, 'rgba(20,10,8,0.35)');
    rect(g, x - 1 + sway, y - 1, w + 2, h + 2, DK); rect(g, x + sway, y, w, h, C.washi); rect(g, x + sway, y + h - 3, w, 3, '#e8dcc0');
    rect(g, cx - 7, y - 8, 14, 10, DK); rect(g, cx - 6, y - 7, 12, 8, '#aab4c4'); rect(g, cx - 6, y - 7, 12, 2, '#dfe6ee');   // the clip
    textC(g, '#' + num, cx + sway, y + 6, '#3a2f2a');
    for (let k = 0; k < w - 10; k += 6) rect(g, x + 5 + k + sway, y + 21, 3, 1, '#b8a890');
    lines.forEach((ln, i) => textC(g, ln, cx + sway, y + 26 + i * 16, m.c));
  }
  function frontInfo(g, G, i, len) {
    const st = G.stalls[i], gu = st.guest, cx = SL.stallCX(i);
    drawCord(g, G, i, len);
    if (!gu) return;
    if (gu.state === 'call') emote(g, 'call', cx, 150, G.t * 1.5);
    if (gu.order && (gu.state === 'wait' || gu.state === 'ordering')) ticket(g, cx, gu.num, MENU[gu.order.type], G.t);
    if (gu.state === 'wait') emote(g, 'dots', cx, 150, G.t);
  }
  function drawQueue(g, G) {
    const n = Math.min(G.waiting, maxWait()), bx = OX + 236, by = SL.SHELF_Y - 30, gap = n > 3 ? 15 : 26;
    contact(g, bx + 38, by + 9, 42, 3);
    for (let k = 0; k < n; k++) {
      const fx = bx + 9 + k * gap + (n > 3 ? 0 : 5), bob = Math.sin(G.t * 2 + k * 1.7) > 0.6 ? 1 : 0;
      ell(g, fx, by - 20 + bob, 6, 6, DK); ell(g, fx, by - 20 + bob, 5, 5, '#3a2a36');
      lathe(g, fx, [[by - 13 + bob, 5], [by - 4, 9]], DK); lathe(g, fx, [[by - 12 + bob, 4], [by - 4, 8]], '#3a2a36');
      dot(g, fx - 2, by - 22 + bob, '#5a4a56');
    }
    rect(g, bx - 1, by - 5, 78, 7, DK); wood(g, bx, by - 4, 76, 5, '#8a5a32', 5, false, 97); rect(g, bx, by - 4, 76, 1, '#c08a52');
    for (const lx of [bx + 5, bx + 67]) { rect(g, lx - 1, by + 2, 5, 8, DK); rect(g, lx, by + 2, 3, 7, '#6e4428'); }
  }
  const DECO_X = [0, 1, 2, 3].map(i => SL.stallX(i)).concat(RIGHT);
  function deco(g, G, n, t) {
    const x = DECO_X[n], y = 190, sw = Math.round(Math.sin(t * 1.3 + n) * 1);
    rect(g, x, y - 26, 1, 20, '#5a3a22');
    const cx = x + sw;
    if (n === 0) {
      rect(g, cx - 5, y - 4, 10, 18, DK); rect(g, cx - 4, y - 3, 8, 16, '#8aa848'); rect(g, cx - 4, y + 4, 8, 1, '#5a7a30'); rect(g, cx - 3, y - 3, 2, 16, '#b8d070');
      line(g, cx, y - 4, cx - 7, y - 16, '#5a3a2a'); line(g, cx, y - 4, cx + 6, y - 14, '#5a3a2a');
      for (const [bx, by] of [[-8, -17], [-5, -12], [6, -15], [3, -9], [-2, -15]]) { ell(g, cx + bx, y + by, 2, 2, '#f2a6c0'); dot(g, cx + bx, y + by, '#fff0f6'); }
    } else if (n === 1) {
      rect(g, cx - 3, y - 6, 6, 3, DK); ell(g, cx, y + 6, 7, 10, DK); ell(g, cx, y + 6, 6, 9, '#d8443a'); ell(g, cx - 2, y + 3, 2, 5, '#f07a5a');
      for (const dy of [0, 5, 10]) rect(g, cx - 5, y + 1 + dy, 10, 1, '#9a2a24');
      rect(g, cx - 3, y + 15, 6, 3, DK);
    } else if (n === 2) {
      rect(g, cx - 1, y - 6, 2, 28, DK); rect(g, cx - 7, y - 6, 14, 2, DK);
      rect(g, cx - 6, y - 4, 12, 22, DK); rect(g, cx - 5, y - 3, 10, 20, '#e8902a'); rect(g, cx - 5, y - 3, 10, 3, '#c8443a');
      ell(g, cx, y + 8, 3, 3, '#fff2d8'); dot(g, cx, y + 8, '#c8443a'); rect(g, cx - 5, y + 14, 10, 1, '#fff2d8');
    } else if (n === 3) {
      const on = Math.sin(t * 7 + Math.sin(t * 2.3) * 3) > -0.85;
      rect(g, cx - 9, y - 4, 18, 16, DK); rect(g, cx - 8, y - 3, 16, 14, '#1a1a2a');
      const c1 = on ? '#ff6ad8' : '#7a3a6a', c2 = on ? '#6ae8ff' : '#2a5a6a';
      rect(g, cx - 6, y + 4, 12, 1, c1); line(g, cx - 6, y + 4, cx - 3, y + 8, c1); line(g, cx + 6, y + 4, cx + 3, y + 8, c1); rect(g, cx - 3, y + 8, 6, 1, c1);
      line(g, cx - 2, y + 2, cx + 1, y - 1, c2); line(g, cx + 1, y + 2, cx + 4, y - 1, c2);
    } else {
      ell(g, cx, y + 6, 8, 8, DK); ell(g, cx, y + 6, 7, 7, '#5ab8a8'); ell(g, cx - 2, y + 3, 3, 3, '#a8e8d8'); dot(g, cx - 3, y + 2, '#ffffff');
      for (const d of [-4, 0, 4]) line(g, cx + d, y - 1, cx + d, y + 13, '#c8a870');
      line(g, cx - 7, y + 6, cx + 7, y + 6, '#c8a870');
    }
  }

  /* ---------- night light: warm stepped pools from the lamps, dithered where one step meets the next ----------
     Worked out on a 2px grid and cached; each lamp throws a cone that is brightest on the counter top and fades up the
     blinds, posts block it, and the gaps between bays and the lower wall stay dark. */
  const CELL = 2, LW = SW / CELL, LH = Math.ceil(VH / CELL);
  const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  let darkC = null, warmC = null, lightKey = '';
  function lightLayers(G) {
    const f = G.nightF || 0, open = []; for (let i = 0; i < SL.NSTALL; i++) open.push(stallOpen(i) ? 1 : 0);
    const key = Math.round(f * 16) + ':' + open.join('');
    if (key === lightKey && darkC) return;
    lightKey = key; darkC = darkC || mk(LW, LH); warmC = warmC || mk(LW, LH);
    const dg = darkC.getContext('2d'), wg = warmC.getContext('2d'), di = dg.createImageData(LW, LH), wi = wg.createImageData(LW, LH);
    const posts = []; for (let i = 0; i < SL.NSTALL; i++) posts.push(SL.stallX(i)); posts.push(RIGHT);
    const DARK = [0, 0.3, 0.52, 0.7], WARMA = [0, 0.12, 0.22];
    const CYX = WIN.x + Math.round(WIN.w * 0.3) + 50;   // the guild's crystal lamp outside, seen through the window
    for (let cy = 0; cy < LH; cy++) for (let cx = 0; cx < LW; cx++) {
      const x = cx * CELL + 1, y = cy * CELL + 1;
      let v = 0;
      for (let i = 0; i < SL.NSTALL; i++) {
        if (!open[i]) continue;
        const lx = SL.stallCX(i), dx = Math.abs(x - lx); if (dx > 170) continue;
        let s = 0;
        if (y >= LAMP_Y - 18 && y <= LAMP_Y + 6 && Math.hypot(dx, (y - LAMP_Y + 4) * 1.6) < 20) s = 1.2;
        else if (y > LAMP_Y && y <= CY + 16) {
          const dy = y - LAMP_Y, hw = 10 + dy * 0.6;
          s = Math.max(0, Math.min(1, (hw - dx) / (hw * 0.35 + 3))) * Math.max(0.3, 1 - dy / 300);
          if (y >= CY && y <= CY + 8) s *= 1.7; else if (y < CY) s *= 0.72;
          if (y < CY) for (const px of posts) { if (Math.sign(px - lx) === Math.sign(x - lx) && Math.abs(x - lx) > Math.abs(px - lx) + 7) { s *= Math.abs(x - lx) > Math.abs(px - lx) + 16 ? 0.15 : 0.5; break; } }
        } else if (y > CY + 16) s = (y <= CY + 42 ? 0.22 : 0.08) * Math.max(0, 1 - dx / 100);
        v = Math.max(v, s);
      }
      let red = 0, cyan = 0;
      for (const lx of [176, SW - 34]) { const d = Math.hypot(x - lx, (y - 100) * 1.2); if (d < 90) { red = Math.max(red, 1 - d / 90); v = Math.max(v, 0.7 * (1 - d / 90)); } }
      if (y > WIN.y && y < CY) { const d = Math.hypot((x - CYX) * 0.5, y - WIN.y - WIN.h); if (d < 70) cyan = 1 - d / 70; }
      const b = (BAY[cy & 3][cx & 3] + 0.5) / 16;
      const dark = (1 - Math.min(1, v * 1.1)) * 3 * f, dk = dark - Math.floor(dark), inWin = y >= WIN.y && y < WIN.y + WIN.h, dl = Math.min(inWin ? 1 : 3, dk < 0.4 ? Math.floor(dark) : dk > 0.6 ? Math.ceil(dark) : Math.floor(dark + b));   // the night outside keeps its own colours (only lightly shaded)
      const warm = Math.max(0, v - 0.3) * 3.4 * f, wk = warm - Math.floor(warm), wl = Math.min(2, wk < 0.4 ? Math.floor(warm) : wk > 0.6 ? Math.ceil(warm) : Math.floor(warm + b));
      const p = (cy * LW + cx) * 4;
      di.data[p] = 30; di.data[p + 1] = 18; di.data[p + 2] = 46; di.data[p + 3] = Math.round(DARK[dl] * 255);   // deep plum-indigo shade
      // the key light is lamplight yellow; near the wall lanterns it turns red, and a faint cyan spills in from outside
      const tint = red > 0.35 && red * 0.9 > v - 0.3 ? [255, 96, 70] : [255, 190, 96];
      let a = WARMA[wl];
      if (!a && cyan > 0.3) { tint[0] = 90; tint[1] = 210; tint[2] = 230; a = (cyan > 0.65 ? 0.09 : (BAY[cy & 3][cx & 3] < 8 ? 0.09 : 0)) * f; }
      wi.data[p] = tint[0]; wi.data[p + 1] = tint[1]; wi.data[p + 2] = tint[2]; wi.data[p + 3] = Math.round(a * 255);
    }
    dg.putImageData(di, 0, 0); wg.putImageData(wi, 0, 0);
  }
  /* Daytime: low sun from the left. Hard-edged patches fall across the blinds, the counter and the lower wall, softened
     with a 2px dither at the edges; the noren's slits throw stripes of shade inside each patch. Everything outside
     the patches is tinted a soft lavender (multiplied), so shade is blue-grey rather than brown. */
  const SUN_SLOPE = 0.42;   // how far right a patch drifts per pixel down
  const patchX = (i, y) => SL.stallCX(i) - 20 + (y - 442) * SUN_SLOPE;   // patch centre at height y (it covers each stool)
  let sunC = null, sunWarm = null, sunKey = '';
  function sunLayers(G) {
    const d = 1 - (G.nightF || 0), key = Math.round(d * 12);
    if (key === sunKey && sunC) return;
    sunKey = key; sunC = sunC || mk(LW, LH); sunWarm = sunWarm || mk(LW, LH);
    const sg = sunC.getContext('2d'), wg = sunWarm.getContext('2d'), si = sg.createImageData(LW, LH), wi = wg.createImageData(LW, LH);
    const LAV = [236, 230, 246];
    for (let cy = 0; cy < LH; cy++) for (let cx = 0; cx < LW; cx++) {
      const x = cx * CELL + 1, y = cy * CELL + 1, p = (cy * LW + cx) * 4;
      let inP = 0;
      if (y > WIN.y + WIN.h) for (let i = 0; i < SL.NSTALL; i++) {
        const e = 55 - Math.abs(x - patchX(i, y));                 // distance inside the patch edge
        if (e > 0) { inP = e > 3 ? 1 : ((BAY[cy & 3][cx & 3] + 0.5) / 16 < 0.5 ? 1 : 0); }
        if (inP && y < CY && Math.floor((x - patchX(i, y) + 55) / 22) % 2 === 1 && (x - patchX(i, y) + 55) % 22 < 4) inP = 0;   // noren slits
        if (inP) break;
      }
      const k = d;   // fades in and out with the day
      si.data[p] = Math.round(255 - (255 - (inP ? 255 : LAV[0])) * k); si.data[p + 1] = Math.round(255 - (255 - (inP ? 255 : LAV[1])) * k); si.data[p + 2] = Math.round(255 - (255 - (inP ? 255 : LAV[2])) * k); si.data[p + 3] = 255;
      wi.data[p] = 255; wi.data[p + 1] = 232; wi.data[p + 2] = 180; wi.data[p + 3] = inP ? Math.round((y >= CY && y <= CY + 16 ? 0.2 : y < CY ? 0.1 : 0.13) * 255 * k) : 0;
    }
    sg.putImageData(si, 0, 0); wg.putImageData(wi, 0, 0);
  }
  function sunlight(g, G) {
    if ((G.nightF || 0) > 0.95) return;
    sunLayers(G);
    const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
    g.save(); g.globalCompositeOperation = 'multiply'; g.drawImage(sunC, 0, 0, LW, LH, 0, 0, SW, LH * CELL);
    g.globalCompositeOperation = 'lighter'; g.drawImage(sunWarm, 0, 0, LW, LH, 0, 0, SW, LH * CELL); g.restore();
    g.imageSmoothingEnabled = sm;
    // dust motes drifting slowly in the beams (1px)
    const d = 1 - (G.nightF || 0);
    for (let k = 0; k < 90; k++) {
      const i = k % 4, y = Math.round(170 + ((SCENE.rnd(k * 3) * 260 + G.t * (3 + (k % 5))) % 260)), x = Math.round(patchX(i, y) + (SCENE.rnd(k * 7) - 0.5) * 90 + Math.sin(G.t * 0.6 + k) * 4);
      if (Math.abs(x - patchX(i, y)) > 50) continue;
      g.globalAlpha = 0.55 * d * (0.5 + 0.5 * Math.sin(G.t * 1.3 + k)); rect(g, x, y, 1, 1, '#fff6d8');
    }
    g.globalAlpha = 1;
  }
  // a cat sunning itself on the second bay's stool: slow breathing, an occasional flick of the tail
  function sunCat(g, G) {
    if ((G.nightF || 0) > 0.5) return;
    const cx = SL.stallCX(1), by = VH - 40 - 58 + 1, br = Math.sin(G.t * 1.6) > 0 ? 1 : 0, flick = Math.sin(G.t * 0.7) > 0.93 ? -3 : 0;
    ell(g, cx, by - 7 - br, 20, 8 + br, DK); ell(g, cx, by - 7 - br, 19, 7 + br, '#e8a858'); ell(g, cx - 3, by - 10 - br, 12, 4, '#f6c47a');
    for (let k = -12; k <= 12; k += 6) rect(g, cx + k, by - 12 - br, 2, 4, '#c8843a');   // stripes
    ell(g, cx + 18, by - 12, 8, 7, DK); ell(g, cx + 18, by - 12, 7, 6, '#e8a858');
    poly(g, [[cx + 12, by - 16], [cx + 13, by - 24], [cx + 17, by - 17]], DK); poly(g, [[cx + 19, by - 17], [cx + 23, by - 24], [cx + 24, by - 15]], DK);
    poly(g, [[cx + 13, by - 17], [cx + 14, by - 22], [cx + 16, by - 17]], '#e8a858'); poly(g, [[cx + 20, by - 17], [cx + 22, by - 22], [cx + 23, by - 16]], '#e8a858');
    rect(g, cx + 14, by - 13, 3, 1, DK); rect(g, cx + 20, by - 13, 3, 1, DK); dot(g, cx + 18, by - 10, '#d86a6a');   // sleepy eyes, nose
    line(g, cx - 18, by - 6, cx - 30, by - 2 + flick, DK, 4); line(g, cx - 18, by - 6, cx - 30, by - 2 + flick, '#e8a858', 2);
    if (Math.sin(G.t * 0.9) > 0.6) textC(g, 'z', cx + 30, by - 34 - Math.round((G.t * 6) % 8), '#fff6d0');
  }
  function lighting(g, G) {
    if (G.duskF > 0.01) { g.fillStyle = `rgba(255,140,60,${0.05 * G.duskF})`; g.fillRect(0, 0, SW, VH); }
    if ((G.nightF || 0) < 0.01) return;
    lightLayers(G);
    const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
    g.drawImage(darkC, 0, 0, LW, LH, 0, 0, SW, LH * CELL);
    g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(warmC, 0, 0, LW, LH, 0, 0, SW, LH * CELL); g.restore();
    g.imageSmoothingEnabled = sm;
  }

  function frame(g, G) {
    if (!back) { back = buildBack(); front = buildFront(); }
    const night = (G.nightF || 0) > 0.5, ak = (G.region || 0) + ':' + night;
    if (ak !== alleyKey) { alley = buildAlley(G.region || 0, night); alleyKey = ak; }
    g.drawImage(alley, WIN.x, WIN.y);
    if (G.rain > 0.05) {
      // the wet street: lights from windows and lanterns smear into short reflections along the bottom
      if (night) for (let x = WIN.x + 25; x < WIN.x + WIN.w; x += 50) { g.fillStyle = (x / 50) % 3 < 1 ? '#7a4a3a' : '#5a3a3a'; for (let k = 0; k < 4; k++) g.fillRect(x - 2 + (k & 1), WIN.y + WIN.h - 6 + k, 4, 1); }
      // streaks falling outside, then drops on the glass sliding down
      g.fillStyle = night ? '#5a5a80' : '#d8d0c8';
      for (let k = 0; k < 140 * G.rain; k++) { const x = WIN.x + Math.floor(SCENE.rnd(k * 7) * WIN.w), y = WIN.y + Math.floor((SCENE.rnd(k * 3) * WIN.h + G.t * 120) % WIN.h); g.fillRect(x, y, 1, 4); }
      for (let k = 0; k < 50 * G.rain; k++) {
        const x = WIN.x + Math.floor(SCENE.rnd(k * 11 + 5) * WIN.w), sp = 4 + SCENE.rnd(k) * 10, y = WIN.y + Math.floor((SCENE.rnd(k * 13) * WIN.h + G.t * sp) % WIN.h);
        g.fillStyle = night ? '#8a8ab0' : '#eef4f8'; g.fillRect(x, y, 2, 2); g.fillStyle = night ? '#4a4a6a' : '#c8d4dc'; g.fillRect(x, y - 4, 1, 4);
      }
    }
    g.drawImage(back, 0, 0);
    const lens = [];
    for (let i = 0; i < SL.NSTALL; i++) {
      const st = G.stalls[i], open = stallOpen(i);
      if (open) drawGuest(g, G, i, 0, false);
      if (st.bowl) {
        ART.smallBowl(g, SL.stallCX(i), CY - 18, st.bowl);
        if (st.bowl.broth) for (let k = 0; k < 3; k++) {
          const p = (G.t * 0.6 + k / 3) % 1, wx = SL.stallCX(i) - 8 + k * 8 + Math.round(Math.sin(p * 6 + k) * 2);
          g.globalAlpha = (0.35 + 0.25 * (G.nightF || 0)) * (1 - p); rect(g, wx, CY - 32 - Math.round(p * 26), 2, 4, (G.nightF || 0) > 0.5 ? '#ffe2a0' : '#fff6e6'); g.globalAlpha = 1;
        }
      }
      lens[i] = blind(g, i, open ? st.blind : 1, !open);
      if (open) drawGuest(g, G, i, lens[i], true);
      else lockedPlaque(g, i);
    }
    // the round window shows the same alley
    g.save(); g.beginPath(); g.arc(PORT.cx, PORT.cy, PORT.r, 0, Math.PI * 2); g.clip(); g.drawImage(alley, 300, 0, 60, 60, PORT.cx - 30, PORT.cy - 30, 60, 60); g.restore();
    g.drawImage(front, 0, 0);
    doorLeaf(g, G);
    for (let i = 0; i < SL.NSTALL; i++) { setting(g, i); pendant(g, G, i); }
    for (const st of STOPS) if (st.deco !== undefined && owns(st.id)) deco(g, G, st.deco, G.t);
    for (const [lx, side] of [[176, 0], [SW - 34, 1]]) lantern(g, lx + Math.round(Math.sin(G.t * 1.2 + side * 2) * 1.2), 92, 13, '#c8443a');
    SCENE.clock(g, G, SW - 31, 152, 17);
    if (G.waiting > 0) drawQueue(g, G);
    sunCat(g, G);
    sunlight(g, G);
    lighting(g, G);
    // drawn after the light so they stay readable at night: cords, tickets and speech marks
    for (let i = 0; i < SL.NSTALL; i++) if (stallOpen(i)) frontInfo(g, G, i, lens[i]);
  }

  return { frame, silhouette, seatY, cordAt, downFor, menuRect, DOOR: D, SIGN: { x: SL.X0 + SIGN_X, y: CY + 56, w: 128, h: 44 } };
})();
