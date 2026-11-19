'use strict';
/* Serving room: one long wooden ramen counter seen from the chef's side, split into eight stalls by timber posts. Each
   stall has a sudare bamboo blind that hangs down while the seat is empty; it rolls up by itself once a guest has sat
   down and rolls back down after they leave, so a seated guest is always in view. Drawn in local coordinates (0-1920); the caller
   translates it to world x SL.X0.
   Warm, detailed pixel art: honey hinoki, dark timber, cream plaster, a muted indigo for the shop's cloth.
   Guests have one pose each, so they never walk on screen: they fade in already seated (the front door's chime, a
   brightening lantern and a stool creak sell the arrival) and fade out where they sat, leaving their coins behind.
   About three quarters of each guest shows above the counter.
   Every seat sits on one axis: paper lantern (with the seat number), guest, stool, bowl spot and ticket clip all line
   up on the seat's centre. At night each lantern lights its own guest; guests are lit separately so their faces always
   stay readable. */
const SERVING = (() => {
  const { mk, rect, dot, ell, lathe, poly, line, shade, mix, text, textC, textW } = PX;
  const { wood, plaster, frameRect, lantern, emote, ao, pool, contact } = SCENE;
  const DK = PX.OUTLINE, CY = SL.COUNTER_Y, BY = SL.BACK_Y;
  const C = {
    beam: PAL.beam, post: PAL.postWarm, plaster: PAL.plasterWarm, wall: PAL.wallDark, hinoki: '#dcae70',
    indigo: '#3a3f62', indigoLo: '#2a2e4a', indigoHi: '#4a5078',   // muted indigo cloth: warm wood and lamplight lead
    washi: '#fbf6ea', copper: PAL.copper, copperHi: PAL.copperHi, copperLo: PAL.copperLo, brass: PAL.brass, brassLo: PAL.brassLo
  };
  const SW = SL.W, OX = SL.OX, LEFT = SL.LEFT, RIGHT = SL.RIGHT;
  const WIN = { x: LEFT + 12, y: 84, w: RIGHT - LEFT - 24, h: 48 };   // the long window over the counter (the alley outside)
  const D = SL.DOOR;
  const KIT = { x: 1815, y: 72, w: 90, h: BY - 72 };                 // the doorway to the kitchen, behind its noren
  const MB = { x: 426, y: 32, w: 294, h: 54 };                       // the menu board on the back wall (between the HUD's two groups, first screen)
  const LAMP_Y = 104;                 // centre of each seat's paper lantern
  const SIGN_X = 30;                  // the OPEN / CLOSED board, under the counter's left end (on the first screen)
  const SIT_IN = 0.9;                 // seconds to fade in (a silhouette behind the slats) and settle onto the stool
  const RISE = 0.5;                   // seconds to rise a little and fade out when leaving
  const SHOW = 0.76;                  // the most of a guest (head to feet) that shows above the counter
  const BLIND_TOP = 138;              // top of each stall's blind valance (just under the lanterns, above the guests' heads)
  const HEAD_MIN = BLIND_TOP + 33;    // no head rises above this: clear of the valance and the rolled-up blind, even mid-hop
  const REDS = [168, 1752];           // the two red wall lanterns (x), by the staff door and by the kitchen
  const PIX = { on: new URLSearchParams(location.search).get('pixeltest') === '1' };   // ?pixeltest=1: guests use their 3x3 world copy
  let back = null, front = null, alley = null, alleyKey = '';

  // Image top of a seated guest. Guests differ in height: each shows up to 76% of themselves, but a tall guest sits lower
  // so their head stays clear of the blind (never less than half of them shows).
  const seatY = gt => { const H = gt.bottom - gt.head, head = Math.min(Math.max(HEAD_MIN, BY - Math.round(H * SHOW)), BY - Math.ceil(H * 0.5)); return head - gt.head; };

  /* ---------- the guests' world copy: each 3x3 block becomes its most common colour (no blurry averaging) ---------- */
  const WORLD = new Map();
  function worldCopy(img) {
    if (WORLD.has(img)) return WORLD.get(img);
    if (!img || !img.complete || !img.naturalWidth) return null;
    const W = img.naturalWidth, H = img.naturalHeight, w = Math.ceil(W / 3), h = Math.ceil(H / 3);
    const sc = mk(W, H).getContext('2d'); sc.drawImage(img, 0, 0);
    const d = sc.getImageData(0, 0, W, H).data, out = mk(w, h), og = out.getContext('2d'), od = og.createImageData(w, h);
    for (let by = 0; by < h; by++) for (let bx = 0; bx < w; bx++) {
      const n = new Map();
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
        const x = bx * 3 + dx, y = by * 3 + dy;
        let k = -1;   // -1: transparent (or off the edge)
        if (x < W && y < H) { const p = (y * W + x) * 4; if (d[p + 3] >= 128) k = (d[p] << 16) | (d[p + 1] << 8) | d[p + 2]; }
        n.set(k, (n.get(k) || 0) + 1);
      }
      let best = -1, bn = 0; for (const [k, c] of n) if (c > bn) { bn = c; best = k; }
      if (best < 0) continue;
      const q = (by * w + bx) * 4; od.data[q] = best >> 16; od.data[q + 1] = (best >> 8) & 255; od.data[q + 2] = best & 255; od.data[q + 3] = 255;
    }
    og.putImageData(od, 0, 0); WORLD.set(img, out);
    return out;
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

  /* ---------- small props: indigo cloth, stowed gear, the umbrella stand, travel packs ---------- */
  function weave(g, x, y, w, h) {   // muted indigo cloth with a subtle two-tone weave
    rect(g, x, y, w, h, C.indigo);
    for (let yy = y; yy < y + h; yy += 2) for (let xx = x + ((yy - y) & 2 ? 1 : 0); xx < x + w; xx += 4) { dot(g, xx, yy, C.indigoHi); dot(g, xx + 2, yy + 1, C.indigoLo); }
  }
  // Weapons leaning against the cabinet, leaning left (background-ish props: outlined lightly, lower contrast).
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

  /* ---------- the back wall: beam, plaster, the long window, wainscot, the stall posts and the kitchen doorway ---------- */
  function noren(g, x, y, w, h, panels) {   // indigo shop curtain: panels with slits, the shop crest on the middle one
    const pw = Math.floor(w / panels);
    rect(g, x - 2, y - 4, w + 4, 5, DK); rect(g, x - 1, y - 3, w + 2, 3, '#6e4428'); rect(g, x - 1, y - 3, w + 2, 1, '#a57a4c');   // the rod
    for (let k = 0; k < panels; k++) {
      const px = x + k * pw, ww = pw - 2;
      rect(g, px - 1, y, ww + 2, h + 1, DK); rect(g, px, y, ww, h, C.indigo);
      rect(g, px + ww - 4, y, 4, h, C.indigoLo); rect(g, px, y, 2, h, C.indigoHi); rect(g, px, y, ww, 4, C.indigoLo);
      for (let yy = y + 6; yy < y + h; yy += 2) for (let xx = px + 3 + (yy & 2 ? 1 : 0); xx < px + ww - 4; xx += 4) dot(g, xx, yy, C.indigoHi);
      if (k === Math.floor(panels / 2)) crest(g, px + Math.round(ww / 2), y + Math.round(h * 0.55));
    }
  }
  function buildBack() {
    const c = mk(SW, VH), g = c.getContext('2d');
    wood(g, 0, 0, SW, 30, C.beam, 10, false, 205); rect(g, 0, 29, SW, 2, DK);
    plaster(g, 0, 31, SW, 210, C.plaster, 209);
    ao(g, 0, 31, SW, 210, 'top', 22, 0.45);
    // the long window: the alley outside shows through the hole
    frameRect(g, WIN.x, WIN.y, WIN.w, WIN.h, '#5a3820', 7);
    g.clearRect(WIN.x, WIN.y, WIN.w, WIN.h);
    for (let x = WIN.x + 59; x < WIN.x + WIN.w - 20; x += 60) { rect(g, x - 1, WIN.y, 4, WIN.h, DK); rect(g, x, WIN.y, 2, WIN.h, '#6e4428'); dot(g, x, WIN.y, '#a57a4c'); }
    rect(g, WIN.x, WIN.y + 23, WIN.w, 4, DK); rect(g, WIN.x, WIN.y + 24, WIN.w, 2, '#6e4428');
    rect(g, WIN.x - 8, WIN.y + WIN.h + 7, WIN.w + 16, 2, shade('#5a3820', 0.55));
    ao(g, WIN.x - 8, WIN.y + WIN.h + 9, WIN.w + 16, 10, 'top', 8, 0.3);
    // wainscot: a rail, then dark panelled wood down to the counter
    rect(g, 0, 240, SW, 8, DK); rect(g, 0, 241, SW, 6, '#6e4428'); rect(g, 0, 241, SW, 1, '#a57a4c'); rect(g, 0, 246, SW, 1, '#4a2e1a');
    wood(g, 0, 248, SW, BY - 248, '#5a3a22', 24, true, 211);
    ao(g, 0, 248, SW, BY - 248, 'top', 8, 0.5);
    for (let x = 30; x < SW; x += 90) { rect(g, x, 254, 1, BY - 256, '#4a2e1a'); rect(g, x + 1, 254, 1, BY - 256, '#6e4a2e'); }
    // the doorway to the kitchen: warm and dim behind its noren
    { const K = KIT;
      rect(g, K.x - 7, K.y - 7, K.w + 14, K.h + 7, DK); wood(g, K.x - 6, K.y - 6, K.w + 12, K.h + 6, '#4a2e1a', 8, true, 71);
      for (let i = 0; i < 8; i++) rect(g, K.x, K.y + i * 27, K.w, 28, mix('#5a3a24', '#2a1a16', i / 7));
      for (const sy of [K.y + 60, K.y + 96]) { rect(g, K.x + 8, sy, K.w - 16, 2, '#7a6a5a'); for (let k = K.x + 12; k < K.x + K.w - 16; k += 14) rect(g, k, sy - 9, 8, 9, k % 28 ? '#8a3a2a' : '#c8b8a0'); }   // a shelf of bowls
      rect(g, K.x, BY - 14, K.w, 14, '#2a1c18');
      noren(g, K.x, K.y, K.w, 70, 3); }
    staffDoor(g);
    questBoard(g, 184, 112, 40, 128);
    for (let i = 0; i < SL.NSTALL; i++) post(g, SL.stallX(i) - 7, 31, 14, BY - 31, C.post);
    post(g, RIGHT - 7, 31, 14, BY - 31, C.post);
    return c;
  }
  function post(g, x, y, w, h, c) {   // a timber stall post with banded ends
    rect(g, x - 1, y, w + 2, h, DK);
    rect(g, x, y, w, h, c);
    rect(g, x, y, 2, h, shade(c, 1.3)); rect(g, x + 2, y, 1, h, shade(c, 1.12));
    rect(g, x + w - 4, y, 2, h, shade(c, 0.78)); rect(g, x + w - 2, y, 2, h, shade(c, 0.6));
    for (let k = 14; k < h - 6; k += 37) { rect(g, x + 3, y + k, w - 6, 1, shade(c, 0.86)); rect(g, x + 4, y + k + 6, w - 9, 1, shade(c, 0.9)); }
    for (const [yy, hh] of [[y + h - 8, 8]]) { rect(g, x - 3, yy - 1, w + 6, hh + 2, DK); rect(g, x - 2, yy, w + 4, hh, shade(c, 0.9)); rect(g, x - 2, yy, w + 4, 1, shade(c, 1.25)); rect(g, x - 2, yy + hh - 1, w + 4, 1, shade(c, 0.6)); }
  }

  /* ---------- the menu board on the back wall: every ramen on the menu, with its price (locked ones are blank) ---------- */
  let board = null, boardKey = '';
  function menuBoard() {
    const on = ((window.G && G.menu) || ['miso']).filter(k => MENU[k]), slots = menuSlots(), pk = window.G && G.pick, key = on.join(',') + '|' + pk + '|' + slots;
    if (board && key === boardKey) return board;
    boardKey = key; board = mk(MB.w + 4, MB.h + 6);
    const g = board.getContext('2d'), w = MB.w, h = MB.h, x = 2, y = 2;
    rect(g, x + 2, y + 3, w, h, 'rgba(30,14,10,0.3)');
    rect(g, x - 1, y - 1, w + 2, h + 2, DK); wood(g, x, y, w, h, '#4a2e1a', h, false, 141);
    rect(g, x + 3, y + 3, w - 6, h - 6, '#2e2018'); rect(g, x + 3, y + 3, w - 6, 1, '#1a120e');
    for (const [cx, cy] of [[x + 2, y + 2], [x + w - 4, y + 2], [x + 2, y + h - 4], [x + w - 4, y + h - 4]]) rect(g, cx, cy, 2, 2, C.brass);
    // three rows of four: a dot of the ramen's colour, its name (no prices: they are on the menu the board opens),
    // a gold star on the chef's pick; free slots are a dashed line, slots not yet bought stay bare
    const cw = (w - 8) / 4;
    PX.setFont(1);
    for (let n = 0; n < 12; n++) {
      const cx = Math.round(x + 4 + (n % 4) * cw), cy = y + 5 + Math.floor(n / 4) * 15, k = on[n];
      if (!k) { if (n < slots) for (let q = 6; q < cw - 10; q += 6) rect(g, cx + q, cy + 7, 3, 1, '#5a4a3a'); continue; }
      const m = MENU[k], name = m.short.split(' ')[0], nw = textW(name);
      if (k === pk) for (const [ax, ay] of [[0, -3], [0, -2], [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0], [0, -1], [-1, 1], [1, 1], [0, 1], [-2, 2], [2, 2]]) dot(g, cx + 3 + ax, cy + 6 + ay, '#ffd76a');   // the chef's pick: a gold star
      else rect(g, cx + 2, cy + 5, 3, 3, m.c);
      text(g, name, cx + 8, cy, '#f2e4c4');
    }
    PX.setFont(2);
    return board;
  }

  /* ---------- the counter, its cloth skirt and the cabinet on our side ---------- */
  function buildFront() {
    const c = mk(SW, VH), g = c.getContext('2d');
    // the counter top: a thick hinoki slab seen a little from above (guests sit beyond its back edge)
    rect(g, 0, BY - 1, SW, 1, DK);
    wood(g, 0, BY, SW, CY - BY, C.hinoki, 9, false, 251);
    rect(g, 0, BY, SW, 2, '#b88a52'); rect(g, 0, BY + 2, SW, 1, '#c8985c');
    for (let k = 0; k < 40; k++) { const x = Math.floor(SCENE.rnd(k * 17 + 5) * SW); rect(g, x, BY + 5 + (k % 9), 8 + (k % 13), 1, '#e8c08a'); }   // grain
    // the front lip, lit along its top edge
    rect(g, 0, CY - 1, SW, VH - CY + 1, DK);
    wood(g, 0, CY, SW, 14, C.hinoki, 7, false, 253);
    rect(g, 0, CY, SW, 1, '#fff0c8'); rect(g, 0, CY + 1, SW, 1, '#f0c88a');
    rect(g, 0, CY + 11, SW, 3, '#a8763e'); rect(g, 0, CY + 14, SW, 2, '#6e4826'); rect(g, 0, CY + 16, SW, 1, DK);
    // under the lip on our side: an indigo cloth hiding the storage, a seam under every seat
    const NY = CY + 17, NH = 24;
    weave(g, 0, NY, SW, NH); rect(g, 0, NY, SW, 2, C.indigoLo);
    for (let i = 0; i <= SL.NSTALL; i++) { const x = i < SL.NSTALL ? SL.stallX(i) : RIGHT; rect(g, x, NY + 2, 1, NH - 2, C.indigoLo); rect(g, x + 1, NY + 2, 1, NH - 2, C.indigoHi); }
    rect(g, 0, NY + NH, SW, 1, DK);
    // the cabinet: dark wood, one open shelf of stacked bowls, cloths and jars (quiet: it is background)
    const LY = NY + NH + 1, SHY = CY + 100, FL = VH - 18;
    wood(g, 0, LY, SW, VH - LY, '#3e2618', 14, true, 255);
    ao(g, 0, LY, SW, 30, 'top', 16, 0.6);
    rect(g, 0, SHY - 52, SW, 52, '#24160e'); ao(g, 0, SHY - 52, SW, 52, 'top', 14, 0.5);
    rect(g, 0, SHY, SW, 6, DK); rect(g, 0, SHY + 1, SW, 4, '#6e4428'); rect(g, 0, SHY + 1, SW, 1, '#8a5a32');
    for (let x = 14, k = 0; x < SW - 40; k++) {
      const r = SCENE.rnd(k * 7 + 3), kind = Math.floor(r * 5);
      if (kind === 0) for (let s = 0; s < 3; s++) { ell(g, x + 14, SHY - 4 - s * 7, 14, 4, DK); ell(g, x + 14, SHY - 5 - s * 7, 13, 3, s === 2 ? '#a8443a' : '#7a2a26'); }   // stacked bowls
      else if (kind === 1) for (let s = 0; s < 3; s++) { rect(g, x, SHY - 7 - s * 7, 28, 7, DK); rect(g, x + 1, SHY - 6 - s * 7, 26, 5, s % 2 ? '#c8bca4' : '#4a5078'); }   // folded cloths
      else if (kind === 2) { rect(g, x + 4, SHY - 26, 18, 26, DK); rect(g, x + 5, SHY - 25, 16, 25, '#6a5a3a'); rect(g, x + 5, SHY - 25, 16, 4, '#8a7a5a'); rect(g, x + 8, SHY - 16, 10, 7, '#c8b890'); }   // jar
      else if (kind === 3) { rect(g, x + 8, SHY - 34, 8, 34, DK); rect(g, x + 9, SHY - 30, 6, 30, '#3a5a4a'); rect(g, x + 10, SHY - 38, 4, 8, DK); rect(g, x + 10, SHY - 22, 4, 8, '#e8dcc0'); }   // a bottle
      x += 46 + Math.floor(SCENE.rnd(k * 11) * 40);
    }
    rect(g, 0, FL, SW, 2, DK); rect(g, 0, FL + 2, SW, VH - FL - 2, '#2a1a10');
    // adventurers' gear stowed under the counter; staffs in the umbrella stand; travel packs by the far wall
    lean(g, 'katana', SL.stallX(0) + 4, FL); lean(g, 'spear', SL.stallX(6) + 10, FL); lean(g, 'axe', SL.stallX(4) + 30, FL);
    umbrellaStand(g, 1720, FL); packs(g, 1780, FL);
    // the OPEN / CLOSED board hangs from two hooks under the counter's right end, by the kitchen
    for (const hx of [SIGN_X + 20, SIGN_X + 108]) { rect(g, hx - 1, CY + 41, 4, 4, DK); rect(g, hx, CY + 42, 2, 2, C.brass); }
    return c;
  }

  /* ---------- each seat: its paper lantern, its stool, the bowl spot and the ticket clip ---------- */
  function seatLamp(g, G, i) {
    const open = stallOpen(i), cx0 = SL.stallCX(i), lit = open && (G.nightF || 0) > 0.05;
    const x = cx0 + Math.round(Math.sin(G.t * 0.7 + i * 1.9) * 1.2), y = LAMP_Y;   // a gentle sway on its string
    rect(g, cx0, 31, 1, 40, '#1a1010'); line(g, cx0, 71, x, y - 20, '#1a1010');
    const gu = open && G.stalls[i].guest, glow = gu && gu.state === 'arrive' ? Math.max(0, 1 - gu.t / 1.4) : 0;   // brightens as a guest sits down
    if (glow > 0.05) for (let yy = y - 26; yy <= y + 26; yy += 2) for (let xx = x - 26; xx <= x + 26; xx += 2) {
      const d = Math.hypot(xx - x, (yy - y) * 0.9); if (d > 17 && d < 17 + 9 * glow && ((xx + yy) >> 1) % 2 === 0) rect(g, xx, yy, 2, 2, '#ffe6a0');
    }
    const bright = lit || glow > 0.3;
    const paper = !open ? '#bfb29a' : bright ? '#ffd890' : '#f2e2bc', rib = !open ? '#9a8c74' : bright ? '#e0a050' : '#c8aa7a';
    rect(g, x - 8, y - 20, 17, 5, DK); rect(g, x - 7, y - 19, 15, 3, '#3a2418');
    ell(g, x, y, 14, 16, DK); ell(g, x, y, 13, 15, paper);
    if (bright) { ell(g, x - 1, y - 1, 9, 11, '#ffeec0'); ell(g, x - 2, y - 2, 5, 7, '#fff8e0'); }
    else ell(g, x + 4, y + 2, 8, 12, shade(paper, 0.92));
    for (const ry of [-10, -5, 0, 5, 10]) { const hw = Math.round(13 * Math.sqrt(1 - (ry / 16) ** 2)); rect(g, x - hw, y + ry, hw * 2 + 1, 1, rib); }
    rect(g, x - 8, y + 15, 17, 5, DK); rect(g, x - 7, y + 16, 15, 3, '#3a2418');
    rect(g, x - 1, y + 20, 3, 4, '#a8302a');   // the tassel
    textC(g, String(i + 1), x, y - 9, !open ? '#8a7c66' : '#a8302a');
  }
  function stoolTop(g, cx) {   // a round stool, only its seat peeking over the counter's back edge
    ell(g, cx, BY - 6, 24, 6, DK); ell(g, cx, BY - 6, 23, 5, '#8a5a32'); ell(g, cx - 4, BY - 7, 15, 2, '#a8784a');
    rect(g, cx - 23, BY - 5, 47, 5, DK); rect(g, cx - 22, BY - 5, 45, 4, '#6e4428');
  }
  // On the counter in front of a seat: a wooden coaster for the bowl, chopsticks on a rest, a water cup, a chopstick holder.
  function setting(g, i) {
    const cx = SL.stallCX(i), y = CY - 3;
    ell(g, cx, y - 1, 30, 4, '#b88a52'); ell(g, cx, y - 2, 28, 3, '#c8985c');
    line(g, cx - 20, y + 1, cx + 16, y, DK, 3); line(g, cx - 20, y, cx + 16, y - 1, '#e3c07a'); rect(g, cx - 4, y - 1, 5, 3, '#6a8aa0');
    const red = i === 2, cup = red ? ['#8a2a22', '#c8443a', '#e8806a'] : ['#7fb0bf', '#a8d2dc', '#e2f6fa'];   // seat 3's cup is red ceramic
    const ux = cx + 68;
    contact(g, ux + 6, CY, 9, 2);
    rect(g, ux - 1, CY - 15, 13, 14, DK); rect(g, ux, CY - 14, 11, 12, cup[1]); rect(g, ux, CY - 14, 11, 3, cup[2]); rect(g, ux + 8, CY - 11, 3, 9, cup[0]);
    const jx = cx - 62;
    contact(g, jx + 6, CY, 9, 2);
    rect(g, jx - 1, CY - 14, 13, 13, DK); rect(g, jx, CY - 13, 11, 11, '#3e2a20'); rect(g, jx, CY - 13, 3, 11, '#5a3e2c'); rect(g, jx, CY - 13, 11, 2, '#6b4a34');
    const sticks = i === 3 ? [[3, -1]] : [[3, -1], [6, 1], [8, 0]];   // seat 4's holder is half empty
    for (const [a, b] of sticks) { line(g, jx + a, CY - 13, jx + a + b * 2, CY - 26, DK, 3); line(g, jx + a, CY - 14, jx + a + b * 2, CY - 25, '#e3c07a'); }
  }
  /* The menu card at each stall: the same little printed card everywhere (a coloured header with the shop's motif,
     cream paper, a coloured row for each ramen on the menu), but every stall's copy is its own: different colours and
     motifs, and each one has been knocked about a bit differently (leaning, a sticker, tape, a folded corner, a ring). */
  const CARD = { dx: 34, w: 30, h: 34 };   // where the card stands, from the stall's centre
  const CARD_LOOK = [
    { hd: '#7a1e18', motif: 'bowl',    lean: 0,  mark: 'sticker' },
    { hd: '#2f3a68', motif: 'sticks',  lean: 1,  mark: null },
    { hd: '#2f5a40', motif: 'steam',   lean: 0,  mark: 'fold' },
    { hd: '#a8641c', motif: 'fish',    lean: 0,  mark: 'tape' },
    { hd: '#5a2a4a', motif: 'flower',  lean: -1, mark: null },
    { hd: '#1e5a62', motif: 'wave',    lean: 0,  mark: 'ring' },
    { hd: '#5a3a22', motif: 'lantern', lean: 0,  mark: 'short' },
    { hd: '#2a2430', motif: 'star',    lean: 0,  mark: 'gold' }
  ];
  const cards = {};
  function buildCard(i, dishes) {
    const L = CARD_LOOK[i % CARD_LOOK.length], w = CARD.w, h = CARD.h - (L.mark === 'short' ? 4 : 0), c = mk(w + 2, h + 2), g = c.getContext('2d');
    const ink = '#f6e6c0', hd = L.hd;
    rect(g, 0, 0, w + 2, h + 2, DK);
    rect(g, 1, 1, w, h, '#f6ecd4'); rect(g, w - 2, 1, 3, h, '#dccaa4');
    if (L.mark === 'gold') { rect(g, 2, 2, w - 2, 1, PAL.brass); rect(g, 2, h - 1, w - 2, 1, PAL.brass); rect(g, 2, 2, 1, h - 2, PAL.brass); rect(g, w - 1, 2, 1, h - 2, PAL.brass); }
    rect(g, 1, 1, w, 11, hd); rect(g, 1, 1, w, 1, shade(hd, 1.35)); rect(g, 1, 11, w, 1, shade(hd, 0.6));
    const mx = 1 + w / 2, my = 6;
    if (L.motif === 'bowl') { poly(g, [[mx - 6, my - 1], [mx + 7, my - 1], [mx + 4, my + 3], [mx - 3, my + 3]], ink); line(g, mx - 3, my - 5, mx + 5, my - 2, ink); }
    else if (L.motif === 'sticks') { line(g, mx - 6, my + 3, mx + 5, my - 4, ink); line(g, mx - 4, my + 4, mx + 7, my - 3, ink); }
    else if (L.motif === 'steam') for (const ox of [-4, 0, 4]) for (let k = 0; k < 7; k++) dot(g, mx + ox + (k % 4 < 2 ? 0 : 1), my - 3 + k, ink);
    else if (L.motif === 'fish') { ell(g, mx - 1, my, 5, 2, ink); poly(g, [[mx + 4, my], [mx + 8, my - 3], [mx + 8, my + 3]], ink); dot(g, mx - 4, my - 1, hd); }
    else if (L.motif === 'flower') { for (const [ox, oy] of [[0, -3], [3, -1], [2, 3], [-2, 3], [-3, -1]]) ell(g, mx + ox, my + oy, 1, 1, '#f2a6c0'); dot(g, mx, my, ink); }
    else if (L.motif === 'wave') for (let k = -7; k <= 7; k++) { dot(g, mx + k, my + Math.round(Math.sin(k * 0.8) * 2), ink); dot(g, mx + k, my + 3 + Math.round(Math.sin(k * 0.8 + 1) * 1), ink); }
    else if (L.motif === 'lantern') { ell(g, mx, my, 3, 4, '#e8604a'); rect(g, mx - 2, my - 5, 5, 1, ink); rect(g, mx - 2, my + 4, 5, 1, ink); }
    else { for (const [a, b2] of [[0, -4], [4, 0], [0, 4], [-4, 0]]) line(g, mx, my, mx + a, my + b2, PAL.brass); dot(g, mx, my, ink); }
    // a coloured row for each ramen on the menu (up to four), then a price line
    dishes.slice(0, 4).forEach((k, n) => { const y = 15 + n * 5; rect(g, 4, y, 4, 3, MENU[k].c); rect(g, 10, y + 1, 9 + ((i + n * 3) % 4) * 2, 1, '#b8a07a'); rect(g, w - 6, y + 1, 3, 1, '#c89a2a'); });
    if (!dishes.length) rect(g, 4, 16, w - 8, 1, '#d8c8a8');
    rect(g, 2, h - 2, w - 3, 1, '#dccaa4');
    if (L.mark === 'sticker') { ell(g, w - 5, h - 7, 3, 3, DK); ell(g, w - 5, h - 7, 2, 2, '#8fd86a'); dot(g, w - 6, h - 8, '#d8f6b0'); }
    if (L.mark === 'fold') { poly(g, [[w - 6, h + 1], [w + 1, h + 1], [w + 1, h - 6]], DK); poly(g, [[w - 5, h], [w, h], [w, h - 5]], '#dccaa4'); }
    if (L.mark === 'tape') { rect(g, mx - 6, 0, 12, 4, 'rgba(240,232,200,0.85)'); rect(g, mx - 6, 0, 12, 1, 'rgba(255,255,240,0.9)'); }
    if (L.mark === 'ring') for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; if (a % 5) dot(g, Math.round(w - 9 + Math.cos(t) * 5), Math.round(h - 9 + Math.sin(t) * 4), '#c8a878'); }
    return c;
  }
  function menuCard(g, i) {
    const dishes = ((window.G && G.menu) || ['miso']).filter(k => MENU[k]), key = i + ':' + dishes.join(',');
    if (!cards[i] || cards[i].key !== key) cards[i] = { key, c: buildCard(i, dishes) };
    const c = cards[i].c, L = CARD_LOOK[i % CARD_LOOK.length], x = SL.stallCX(i) + CARD.dx, y = CY - c.height;
    contact(g, x + c.width / 2, CY, 15, 2);
    poly(g, [[x + 6, CY], [x + c.width - 4, CY], [x + c.width - 7, CY - 4], [x + 9, CY - 4]], DK);   // the little stand behind it
    if (!L.lean) g.drawImage(c, x, y);
    else for (let r = 0; r < c.height; r++) g.drawImage(c, 0, r, c.width, 1, x + L.lean * Math.floor((c.height - r) / 9), y + r, c.width, 1);   // leaning over
  }
  function ticketClip(g, cx) {
    rect(g, cx - 7, CY + 4, 14, 10, DK); rect(g, cx - 6, CY + 5, 12, 8, '#aab4c4'); rect(g, cx - 6, CY + 5, 12, 2, '#dfe6ee'); rect(g, cx - 1, CY + 13, 3, 4, DK);
  }
  // A seat that is not open yet: two stools stacked upside down on the counter and a little "coming soon" board.
  function upturned(g, cx, by) {   // one stool, seat down on by, legs up
    for (const lx of [cx - 18, cx + 13]) { rect(g, lx - 1, by - 40, 7, 34, DK); rect(g, lx, by - 40, 5, 34, '#5a3a22'); rect(g, lx, by - 40, 1, 34, '#7a5230'); }
    rect(g, cx - 17, by - 26, 35, 4, DK); rect(g, cx - 16, by - 25, 33, 2, '#5a3a22');
    rect(g, cx - 24, by - 8, 49, 8, DK); rect(g, cx - 23, by - 7, 47, 6, '#6e4428'); rect(g, cx - 23, by - 7, 47, 1, '#8a5a32');
  }
  // The locked seat's stack sits on the counter, in front of anyone walking behind it, so it is drawn after the guests:
  // built once per seat, then stamped with the room's night shade.
  const lockedArt = {}, lockedLit = {};
  function lockedStamp(g, G, i) {
    const x0 = SL.stallX(i), y0 = CY - 96, f = Math.round((G.nightF || 0) * 8) / 8;
    if (!lockedArt[i]) { const c = mk(SL.STALL_W, 100), cg = c.getContext('2d'); cg.translate(-x0, -y0); lockedSeat(cg, i); lockedArt[i] = c; }
    let src = lockedArt[i];
    if (f > 0) {
      const k = i + ':' + f;
      if (!lockedLit[k]) { const c = mk(SL.STALL_W, 100), cg = c.getContext('2d'); cg.drawImage(src, 0, 0); cg.globalCompositeOperation = 'source-atop'; cg.fillStyle = `rgba(30,18,46,${0.55 * f})`; cg.fillRect(0, 0, c.width, c.height); lockedLit[k] = c; }
      src = lockedLit[k];
    }
    g.drawImage(src, x0, y0);
  }
  function lockedSeat(g, i) {
    const cx = SL.stallCX(i) - 14;
    contact(g, cx, CY - 1, 26, 3);
    upturned(g, cx, CY - 2); upturned(g, cx, CY - 42);
    const sx = SL.stallCX(i) + 30, sy = CY - 36;
    line(g, sx + 4, sy + 30, sx + 10, CY - 2, DK, 2); line(g, sx + 46, sy + 30, sx + 40, CY - 2, DK, 2);
    rect(g, sx - 1, sy - 1, 52, 34, DK); wood(g, sx, sy, 50, 32, '#8a5a32', 32, false, 40 + i); rect(g, sx, sy, 50, 1, '#c08a52');
    rect(g, sx + 3, sy + 3, 44, 26, '#f2e4c4');
    PX.setFont(1); textC(g, 'COMING', sx + 25, sy + 4, '#8a2a1a'); textC(g, 'SOON', sx + 25, sy + 15, '#8a2a1a'); PX.setFont(2);
  }


  /* ---------- guests: walking in, sitting, eating, walking out. Always in view, lit by their own lantern ---------- */
  function poseOf(G, i) {
    const gu = G.stalls[i].guest, gt = gu.gt, cx = SL.stallCX(i), sit = seatY(gt);
    let x = cx, y = sit, a = 1;
    if (gu.state === 'arrive') { const p = Math.min(1, gu.t / SIT_IN); y = sit - Math.round((1 - p) * (1 - p) * 10); a = p; }   // fades in, settling onto the stool
    else if (gu.state === 'call') y = sit - Math.round(Math.abs(Math.sin(G.t * 7)) * 5);   // a little bounce: "over here!"
    else if (gu.state === 'eat') y = sit + [0, 2, 3, 2][Math.floor(gu.t * 2.2) % 4];          // leaning in over the bowl
    else if (gu.state === 'react') {
      y = sit - Math.round(Math.abs(Math.sin(gu.t * 8)) * 4 * Math.max(0, 1 - gu.t / 1.2));
      if (gu.wrong && gu.t < 0.6) x += Math.round(Math.sin(gu.t * 40) * 2);                  // a puzzled shake at the wrong bowl
    }
    else if (gu.state === 'pay' && gu.mood === 'happy') y = sit - Math.round(Math.abs(Math.sin(gu.t * 9)) * 8 * Math.max(0, 1 - gu.t / 1.2));
    else y = sit + (Math.sin(G.t * 1.6 + i * 2) > 0.5 ? 1 : 0);
    return { x, y, a };
  }
  function walkerPose(w) {   // a guest leaving: rises a little from the stool and fades out where they sat
    const p = Math.min(1, w.t / RISE);
    return { x: w.x0, y: seatY(w.gt) - Math.round(p * 6), a: 1 - p };
  }
  // Draw one guest behind the counter. At night they get their own gentle shade and a warm lamplight tint, never the
  // room's full darkness, so a face can always be read.
  let scratch = null;
  function figure(g, G, gt, img, p, bay) {
    if (!img || !img.complete || !img.naturalWidth || p.a <= 0) return;
    const wc = PIX.on ? worldCopy(img) : null, f = G.nightF || 0, W = img.naturalWidth + 3, H = img.naturalHeight + 3;
    let ix = Math.round(p.x - gt.ax), iy = Math.round(p.y);
    if (wc) { ix = Math.round(ix / 3) * 3; iy = Math.round(iy / 3) * 3; }   // the world copy sits on the 3px grid
    g.save(); g.beginPath(); g.rect(SL.stallX(bay) + 7, 0, SL.STALL_W - 14, BY); g.clip(); g.globalAlpha = p.a;
    if (!wc && f <= 0.02) g.drawImage(img, ix, iy);
    else {
      if (!scratch || scratch.width < W || scratch.height < H) scratch = mk(Math.max(W, scratch ? scratch.width : 0), Math.max(H, scratch ? scratch.height : 0));
      const sg = scratch.getContext('2d'); sg.imageSmoothingEnabled = false;
      sg.globalCompositeOperation = 'source-over'; sg.clearRect(0, 0, W, H);
      if (wc) sg.drawImage(wc, 0, 0, wc.width * 3, wc.height * 3); else sg.drawImage(img, 0, 0);
      if (f > 0.02) { sg.globalCompositeOperation = 'source-atop'; sg.fillStyle = `rgba(36,20,48,${0.26 * f})`; sg.fillRect(0, 0, W, H); sg.fillStyle = `rgba(255,186,96,${0.12 * f})`; sg.fillRect(0, 0, W, H); }
      g.drawImage(scratch, 0, 0, W, H, ix, iy, W, H);
    }
    g.restore();
  }
  // Eating: chopsticks lift a tangle of noodles from the bowl, up towards the guest, and back down.
  function slurp(g, cx, headY, t) {
    const k = Math.floor(t * 2.2) % 4, top = CY - 30, hi = Math.min(top - 8, headY + 44), ty = [top, Math.round((top + hi) / 2), hi, Math.round((top + hi) / 2)][k];
    const tx = cx + 6;
    if (k) for (const [ox, len] of [[-2, 10], [0, 13], [2, 9]]) for (let q = 0; q < len; q++) dot(g, tx + ox + (q % 4 < 2 ? 0 : 1), ty + 2 + q, q % 3 ? '#f0cc78' : '#fff2bc');
    for (const ox of [0, 3]) { line(g, tx + ox, ty, tx + 18 + ox, ty - 16, DK, 3); line(g, tx + ox, ty, tx + 18 + ox, ty - 16, '#e3c07a'); }
  }
  function coins(g, cx) {   // the guest's payment, stacked on the counter
    for (let s = 0; s < 3; s++) { ell(g, cx, CY - 5 - s * 3, 7, 3, DK); ell(g, cx, CY - 6 - s * 3, 6, 2, s === 2 ? '#ffd76a' : '#d8a030'); }
    dot(g, cx - 3, CY - 13, '#fff6c8');
  }

  /* ---------- the bamboo blinds: down over an empty stall, rolled up into the valance while a guest is there ----------
     Opaque slats with a lit top edge and dark gaps, three ties, a weighted bottom rail; a short indigo valance with the
     shop crest hides the roll. At night the room's shade is laid over the blind (it hangs in front of the guest). */
  const blindLen = down => Math.round(14 + (BY - BLIND_TOP - 14) * down);
  const ease = t => t * t * (3 - 2 * t);   // the roll starts and ends gently
  // down: 0 = rolled up, 1 = all the way down (linear; eased here). fig: the guest behind it. doneAt: when it last stopped.
  function blind(g, G, i, down, locked, fig, doneAt) {
    const moving = down > 0 && down < 1, d = ease(down);
    const since = doneAt === undefined ? 9 : G.t - doneAt;
    const settle = !moving && since < 0.7 ? Math.round(Math.sin(since * 22) * 4 * Math.exp(-since * 7)) : 0;   // the bottom rail bounces as it stops
    const sway = moving ? Math.round(Math.sin(G.t * 10 + i) * 1.5) : 0;                                     // and swings a little while it moves
    const x = SL.stallX(i) + 7, w = SL.STALL_W - 14, y0 = BLIND_TOP, len = Math.max(14, blindLen(d) + (down >= 1 ? settle : 0));
    const top = locked ? '#a8906a' : '#e6c47a', base = locked ? '#8a7454' : '#c8a058', gap = locked ? '#2a1c18' : '#3a2214';
    const roll = 3 + Math.round(9 * (1 - d));   // the bamboo roll under the valance grows as the blind winds up
    for (let r = 14; r < len; r++) {
      const y = y0 + r, k = r % 3, xs = x + (r > len - 30 ? sway : 0);
      if (k === 2 && r < len - 6) { rect(g, xs, y, w, 1, gap); continue; }
      const c = k === 0 ? top : base;
      rect(g, xs, y, w, 1, c);
      rect(g, xs, y, Math.round(w * 0.2), 1, shade(c, 1.08)); rect(g, xs + Math.round(w * 0.74), y, w - Math.round(w * 0.74), 1, shade(c, 0.88));
      rect(g, xs + w - 6, y, 6, 1, shade(c, 0.74));
      if ((r * 7) % 17 < 3) rect(g, xs + ((r * 37 + i * 11) % (w - 30)), y, 14, 1, shade(c, 0.84));   // bamboo nodes
    }
    // the guest behind the blind shows through the gaps between the slats (fading in or out with them)
    if (fig && fig.img && fig.img.complete && fig.p && fig.p.a > 0 && len > 20) {
      g.save(); g.beginPath();
      for (let r = 14; r < len - 6; r++) if (r % 3 === 2) g.rect(x, y0 + r, w, 1);
      g.clip(); g.globalAlpha = fig.p.a;
      g.drawImage(fig.img, Math.round(fig.p.x - fig.gt.ax), Math.round(fig.p.y));   // their own colours, in thin stripes
      g.restore();
    }
    if (len > 16) {
      rect(g, x - 1, y0 + 14, 1, len - 14, DK); rect(g, x + w, y0 + 14, 1, len - 14, DK);
      for (const sx of [18, (w >> 1) - 1, w - 20]) {
        rect(g, x + sx, y0 + 14, 2, len - 14, '#5a3416');
        for (let r = 18; r < len; r += 9) { rect(g, x + sx - 1, y0 + r, 4, 2, '#7a4a22'); dot(g, x + sx - 1, y0 + r, '#a8703a'); }
      }
    }
    const bx = x + sway, by = y0 + len + (down <= 0 ? settle : 0);
    rect(g, bx - 1, by, w + 2, 6, DK); rect(g, bx, by, w, 4, '#a8803e'); rect(g, bx, by, w, 1, '#e0bd72'); rect(g, bx, by + 3, w, 1, '#6e4e22');
    // the roll, wound up under the valance
    rect(g, x - 1, y0 + 13, w + 2, roll + 2, DK); rect(g, x, y0 + 14, w, roll, base); rect(g, x, y0 + 14, w, 1, shade(top, 1.1));
    if (roll > 4) { rect(g, x, y0 + 14 + roll - 2, w, 2, shade(base, 0.7)); for (let k = x + 10; k < x + w - 6; k += 23) rect(g, k, y0 + 15, 2, roll - 2, shade(base, 0.8)); }
    // the valance over the roll
    rect(g, x - 2, y0 - 2, w + 4, 18, DK); rect(g, x - 1, y0 - 1, w + 2, 16, C.indigo); rect(g, x - 1, y0 - 1, w + 2, 2, C.indigoLo);
    for (const s of [w / 3, (2 * w) / 3]) { rect(g, x + Math.round(s), y0 + 4, 1, 11, C.indigoLo); rect(g, x + Math.round(s) + 1, y0 + 4, 1, 11, C.indigoHi); }
    rect(g, x - 1, y0 + 14, w + 2, 1, C.indigoLo);
    crest(g, SL.stallCX(i), y0 + 9);
    const f = G.nightF || 0, hh = Math.max(len, 14 + roll) + 8;
    if (f > 0.02) {   // the night shade (the lantern above keeps a little warmth on it)
      g.fillStyle = `rgba(30,18,46,${0.42 * f})`; g.fillRect(x - 4, y0 - 2, w + 8, hh);
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,170,80,${0.06 * f})`; g.fillRect(x - 4, y0 - 2, w + 8, hh); g.restore();
    }
  }

  /* ---------- the order ticket in each seat's clip: the ramen, then every change ("+ EGG" green, "- BAMBOO" red) ---------- */
  const INK = '#3a2f2a';
  const tNames = m => (textW(m.short) > 90 ? m.short.split(' ') : [m.short]);
  function ticketBox(i, gu) {
    const m = MENU[gu.order.type], names = tNames(m), mods = ART.slipMods(gu.order);
    const w = Math.max(76, ...names.map(t => textW(t) + 36), ...mods.map(md => textW(md.t) + 36));   // room on the right for a check mark
    const h = 26 + names.length * 16 + (mods.length ? 6 + mods.length * 16 : 0) + 6;
    return { x: Math.round(SL.stallCX(i) - w / 2), y: CY + 22, w, h, names, mods, m };
  }
  // Does the bowl match each ticket line? [the ramen itself (tare, broth, its usual toppings), then each change]
  function ticketChecks(b, order) {
    const m = MENU[order.type], c = ART.count(b.items), base = m.tops;
    const modIds = TOPS.filter(id => (order.tops[id] || 0) !== (base[id] || 0));
    const dish = b.tare === m.tare && b.broth === m.broth && TOPS.every(id => modIds.includes(id) || (c[id] || 0) === (base[id] || 0));
    return [dish, ...modIds.map(id => (c[id] || 0) === (order.tops[id] || 0))];
  }
  function mark(g, x, y, ok) {
    if (ok) { for (const [dx, dy] of [[0, 4], [1, 5], [2, 6], [3, 5], [4, 4], [5, 3], [6, 2], [7, 1], [8, 0]]) { rect(g, x + dx - 1, y + dy - 1, 3, 3, DK); } for (const [dx, dy] of [[0, 4], [1, 5], [2, 6], [3, 5], [4, 4], [5, 3], [6, 2], [7, 1], [8, 0]]) rect(g, x + dx, y + dy, 1, 2, '#3aa04a'); }
    else { for (let k = 0; k < 7; k++) { rect(g, x + k, y + k, 2, 2, '#d8342a'); rect(g, x + 6 - k, y + k, 2, 2, '#d8342a'); } }
  }
  function drawTicket(g, b, gu, sway, checks) {
    const x = b.x + sway, y = b.y, w = b.w, h = b.h;
    rect(g, x + 3, y + 3, w, h, 'rgba(20,10,8,0.35)');
    rect(g, x - 1, y - 1, w + 2, h + 2, DK); rect(g, x, y, w, h, C.washi); rect(g, x, y + h - 3, w, 3, '#e8dcc0');
    textC(g, '#' + gu.num, x + w / 2, y + 5, INK);
    for (let k = 0; k < w - 10; k += 6) rect(g, x + 5 + k, y + 21, 3, 1, '#b8a890');
    b.names.forEach((ln, k) => text(g, ln, x + 9, y + 26 + k * 16, b.m.c));
    const my = y + 26 + b.names.length * 16;
    if (b.mods.length) {
      for (let k = 0; k < w - 10; k += 6) rect(g, x + 5 + k, my + 1, 3, 1, '#b8a890');
      b.mods.forEach((md, k) => text(g, md.t, x + 9, my + 6 + k * 16, md.add ? '#2f7a3a' : '#c8302a'));
    }
    if (checks) {
      mark(g, x + w - 15, y + 30, checks[0]);
      b.mods.forEach((md, k) => mark(g, x + w - 15, my + 10 + k * 16, checks[k + 1]));
    }
  }
  const ticketGuest = (G, i) => { const gu = stallOpen(i) && G.stalls[i].guest; return gu && gu.order && (gu.state === 'wait' || gu.state === 'ordering') && gu.num ? gu : null; };
  const dropLocal = i => ({ x: SL.stallX(i) + 6, y: 150, w: SL.STALL_W - 12, h: CY + 110 - 150 });   // over a seat: guest, counter and ticket
  const inside = (p, r) => p && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
  const localMouse = G => (G.mouse ? { x: G.mouse.x + G.cam - SL.X0, y: G.mouse.y } : null);
  function checksFor(G, i, gu) {   // check marks show while a bowl is dragged over this seat
    const d = G.drag, lm = localMouse(G);
    return d && d.kind === 'bowl' && d.bowl && d.bowl.s >= 3 && inside(lm, dropLocal(i)) ? ticketChecks(d.bowl, gu.order) : null;
  }
  function zoomed(G) {   // the ticket shown big: the one pinned by a tap, else the one under the pointer
    if (G.drag) return -1;
    if (G.ticketZoom >= 0 && ticketGuest(G, G.ticketZoom)) return G.ticketZoom;
    const lm = localMouse(G);
    for (let i = 0; i < SL.NSTALL; i++) { const gu = ticketGuest(G, i); if (gu && inside(lm, ticketBox(i, gu))) return i; }
    return -1;
  }
  // Drawn by the game over everything else (screen coordinates): the zoomed ticket at twice the size.
  function overlay(g, G, cam) {
    const i = zoomed(G); if (i < 0) return;
    const gu = ticketGuest(G, i), b = ticketBox(i, gu), c = mk(b.w + 8, b.h + 8), cg = c.getContext('2d');
    drawTicket(cg, { ...b, x: 2, y: 2 }, gu, 0, null);
    const W = c.width * 2, H = c.height * 2, sx = SL.X0 + SL.stallCX(i) - cam;
    const x = Math.round(Math.max(6, Math.min(VW - W - 6, sx - W / 2))), y = Math.round(Math.max(6, Math.min(VH - H - 6, b.y - 40)));
    const sm = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false; g.drawImage(c, x, y, W, H); g.imageSmoothingEnabled = sm;
  }

  /* ---------- the queue: guests waiting for a stall, on a bench in the lower left, under the sign ---------- */
  function drawQueue(g, G) {
    const n = Math.min(G.waiting, maxWait()), bx = 30, by = VH - 40, gap = n > 3 ? 15 : 26;
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

  const DECO_X = [0, 1, 2, 3, 4].map(i => SL.stallX(i));   // hooks on the posts between stalls 1-4
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

  /* Daytime: low sun from the left. Hard-edged patches fall across the back wall, the counter and the cabinet, softened
     with a 2px dither at the edges; the window bars throw stripes of shade inside each patch. Everything outside
     the patches is tinted a soft lavender (multiplied), so shade is blue-grey rather than brown. */
  const SUN_SLOPE = 0.42;   // how far right a patch drifts per pixel down
  const patchX = (i, y) => SL.stallCX(i) - 20 + (y - 442) * SUN_SLOPE;   // patch centre at height y (one over each seat)
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

  /* ---------- night light: warm stepped pools from the seat lanterns, dithered where one step meets the next ----------
     Worked out on a 2px grid and cached. Each lantern glows, haloes the wall and throws a cone that is brightest on the
     counter top in front of its seat; the cabinet on our side stays dark. (Guests get their own light, see figure().) */
  const CELL = 2, LW = SW / CELL, LH = Math.ceil(VH / CELL);
  const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  let darkC = null, warmC = null, lightKey = '';
  function lightLayers(G) {
    const f = G.nightF || 0, open = []; for (let i = 0; i < SL.NSTALL; i++) open.push(stallOpen(i) ? 1 : 0);
    const key = Math.round(f * 16) + ':' + open.join('');
    if (key === lightKey && darkC) return;
    lightKey = key; darkC = darkC || mk(LW, LH); warmC = warmC || mk(LW, LH);
    const dg = darkC.getContext('2d'), wg = warmC.getContext('2d'), di = dg.createImageData(LW, LH), wi = wg.createImageData(LW, LH);
    const DARK = [0, 0.3, 0.52, 0.7], WARMA = [0, 0.12, 0.22];
    const CYX = WIN.x + Math.round(WIN.w * 0.3) + 50;   // the guild's crystal lamp outside, seen through the window
    for (let cy = 0; cy < LH; cy++) for (let cx = 0; cx < LW; cx++) {
      const x = cx * CELL + 1, y = cy * CELL + 1;
      let v = 0;
      for (let i = 0; i < SL.NSTALL; i++) {
        if (!open[i]) continue;
        const lx = SL.stallCX(i), dx = Math.abs(x - lx); if (dx > 160) continue;
        const dl = Math.hypot(dx, (y - LAMP_Y) * 1.1);
        let s = 0;
        if (dl < 26) s = 1.2;
        else if (y > LAMP_Y && y <= CY + 18) {
          const dy = y - LAMP_Y, hw = 18 + dy * 0.45;
          s = Math.max(0, Math.min(1, (hw - dx) / (hw * 0.4 + 3))) * Math.max(0.35, 1 - dy / 320);
          if (y >= BY - 4 && y <= CY + 16) s *= 1.6;
        }
        else if (y > CY + 18) s = (y <= CY + 44 ? 0.22 : 0.07) * Math.max(0, 1 - dx / 110);
        else if (dl < 70) s = 0.5 * (1 - dl / 70);   // a halo on the wall around the lantern
        v = Math.max(v, s);
      }
      let red = 0, cyan = 0;
      for (const lx of REDS) { const d = Math.hypot(x - lx, (y - 100) * 1.2); if (d < 90) { red = Math.max(red, 1 - d / 90); v = Math.max(v, 0.7 * (1 - d / 90)); } }
      if (x >= KIT.x && x < KIT.x + KIT.w && y >= KIT.y && y < BY) v = Math.max(v, 0.55);   // the kitchen glows through its doorway
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
  // a cat napping in the sun on the counter's far left end: slow breathing, an occasional flick of the tail
  function sunCat(g, G) {
    if ((G.nightF || 0) > 0.5) return;
    const cx = 120, by = CY - 1, br = Math.sin(G.t * 1.6) > 0 ? 1 : 0, flick = Math.sin(G.t * 0.7) > 0.93 ? -3 : 0;
    contact(g, cx, by, 22, 2);
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
    doorLeaf(g, G);
    g.drawImage(menuBoard(), MB.x - 2, MB.y - 2);
    for (let i = 0; i < SL.NSTALL; i++) { if (stallOpen(i)) stoolTop(g, SL.stallCX(i)); seatLamp(g, G, i); }
    for (const st of STOPS) if (st.deco !== undefined && owns(st.id)) deco(g, G, st.deco, G.t);
    REDS.forEach((lx, side) => lantern(g, lx + Math.round(Math.sin(G.t * 1.2 + side * 2) * 1.2), 92, 13, '#c8443a'));
    SCENE.clock(g, G, 204, 56, 17);
    g.drawImage(front, 0, 0);
    for (let i = 0; i < SL.NSTALL; i++) if (stallOpen(i)) ticketClip(g, SL.stallCX(i));
    if (G.waiting > 0) drawQueue(g, G);
    sunCat(g, G);
    sunlight(g, G);
    lighting(g, G);
    // the guests, lit on their own: anyone walking out first (they pass behind the stools), then everyone seated
    for (const w of G.walkers || []) figure(g, G, w.gt, w.img, walkerPose(w), w.bay);
    const poses = [];
    for (let i = 0; i < SL.NSTALL; i++) { const gu = stallOpen(i) && G.stalls[i].guest; if (gu) { poses[i] = poseOf(G, i); figure(g, G, gu.gt, gu.img, poses[i], i); } }
    // the blinds hang in front of the guests (and behind the counter); a guest behind a lowered blind shows through its gaps
    for (let i = 0; i < SL.NSTALL; i++) {
      const st = G.stalls[i], gu = stallOpen(i) && st.guest, w = !gu && (G.walkers || []).find(v => v.bay === i);
      const fig = gu ? { gt: gu.gt, img: gu.img, p: poses[i] } : w ? { gt: w.gt, img: w.img, p: walkerPose(w) } : null;
      blind(g, G, i, stallOpen(i) ? (st.blind === undefined ? 1 : st.blind) : 1, !stallOpen(i), fig, st.blindAt);
    }
    // the counter in front of each seat (drawn over the guests): place setting, bowl, steam, chopsticks, payment
    for (let i = 0; i < SL.NSTALL; i++) {
      if (!stallOpen(i)) { lockedStamp(g, G, i); continue; }
      const st = G.stalls[i], gu = st.guest, cx = SL.stallCX(i);
      setting(g, i); menuCard(g, i);
      if (st.bowl) {
        ART.smallBowl(g, cx, CY - 26, st.bowl);
        if (st.bowl.broth) for (let k = 0; k < 3; k++) {
          const p = (G.t * 0.6 + k / 3) % 1, wx = cx - 8 + k * 8 + Math.round(Math.sin(p * 6 + k) * 2);
          g.globalAlpha = (0.35 + 0.25 * (G.nightF || 0)) * (1 - p); rect(g, wx, CY - 40 - Math.round(p * 26), 2, 4, (G.nightF || 0) > 0.5 ? '#ffe2a0' : '#fff6e6'); g.globalAlpha = 1;
        }
      }
      if (gu && gu.state === 'eat') slurp(g, cx, poses[i].y + gu.gt.head, gu.t);
      if ((gu && gu.state === 'pay') || (!gu && st.left > 0 && st.paid)) coins(g, cx + 40);   // the payment stays a moment after they go
    }
    // speech marks and tickets, readable at any hour
    for (let i = 0; i < SL.NSTALL; i++) {
      const gu = stallOpen(i) && G.stalls[i].guest; if (!gu) continue;
      const cx = SL.stallCX(i), head = poses[i].y + gu.gt.head;
      if (gu.state === 'call') emote(g, 'call', cx, head - 18, G.t * 1.5);
      else if (gu.state === 'wait') emote(g, 'dots', cx, head - 18, G.t);
      const tg = ticketGuest(G, i);
      if (tg) drawTicket(g, ticketBox(i, tg), tg, Math.round(Math.sin(G.t * 1.4 + cx) * 0.6), checksFor(G, i, tg));
    }
  }

  // hit areas, in world coordinates
  const W = r => ({ x: r.x + SL.X0, y: r.y, w: r.w, h: r.h });
  return {
    frame, overlay, seatY, worldCopy, PIX, DOOR: D,
    headY: i => { const gu = window.G && G.stalls[i].guest; return gu ? seatY(gu.gt) + gu.gt.head : HEAD_MIN + 16; },   // where a stall guest's head is
    seatRect: i => W({ x: SL.stallX(i) + 6, y: 150, w: SL.STALL_W - 12, h: CY + 16 - 150 }),   // the guest and their bit of counter
    dropRect: i => W(dropLocal(i)),
    lockedRect: i => W({ x: SL.stallX(i) + 6, y: LAMP_Y - 24, w: SL.STALL_W - 12, h: CY + 40 - LAMP_Y }),
    ticketRect: i => { const gu = ticketGuest(window.G, i); return gu ? W(ticketBox(i, gu)) : null; },
    MENU_RECT: W({ x: MB.x, y: MB.y, w: MB.w, h: MB.h }),
    cardRect: i => W({ x: SL.stallCX(i) + CARD.dx - 4, y: CY - CARD.h - 4, w: CARD.w + 8, h: CARD.h + 6 }),   // the stall's menu card
    KITCHEN_RECT: W({ x: KIT.x - 6, y: KIT.y - 6, w: KIT.w + 12, h: KIT.h + 6 }),   // the noren doorway at the far right: through it to the kitchen
    SIGN: { x: SL.X0 + SIGN_X, y: CY + 56, w: 128, h: 44 }
  };
})();
