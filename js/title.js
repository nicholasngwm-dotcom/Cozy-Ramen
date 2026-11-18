'use strict';
/* Title screen: the ramen stall's front on a fantasy street at dusk, menu planks on a signpost.
   Also draws the in-world scroll panels (settings, how to play, guest book, confirm, pause)
   used from the title and, as an overlay, during play. Everything follows the guests' look:
   1px black outlines, hard cel shading, stepped light. */
const TITLE = (() => {
  const { mk, rect, dot, ell, poly, line, shade, mix, text, textC, textW, setFont } = PX;
  const { wood, plaster, ao, pool, lantern } = SCENE;
  const DK = PX.OUTLINE;
  let H = null;                 // hooks from game.js
  let back = null, logo = null;
  const S = { screen: 'main', sel: 0, t: 0, open: 0, overlay: false, page: 0, pick: 0, slide: [0, 0, 0, 0, 0] };
  let hits = [];
  const puffs = [], sil = {};
  let puffT = 0;
  const ease = p => 1 - (1 - p) * (1 - p);

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
  // White glove pointer. dir -1 points left, 1 points right.
  function glove(g, x, y, dir) {
    g.save(); g.translate(Math.round(x), Math.round(y)); if (dir > 0) g.scale(-1, 1);
    rect(g, -8, -3, 13, 6, DK); rect(g, 3, -6, 14, 13, DK); rect(g, 15, -4, 5, 9, DK);
    rect(g, -7, -2, 12, 4, '#fff6e0'); rect(g, -7, -2, 12, 1, '#ffffff');
    rect(g, 4, -5, 12, 11, '#fff6e0'); rect(g, 4, 3, 12, 3, '#e2d2b2'); rect(g, 4, -5, 12, 1, '#ffffff');
    for (const k of [7, 10, 13]) rect(g, k, -2, 1, 4, '#d2c09c');
    rect(g, 16, -3, 3, 7, '#c8443a'); rect(g, 16, -3, 3, 1, '#e2685c');
    g.restore();
  }
  function post(g, x, y, w, h, c) {
    rect(g, x - 1, y, w + 2, h, DK); rect(g, x, y, w, h, c);
    rect(g, x, y, 2, h, shade(c, 1.3)); rect(g, x + w - 3, y, 3, h, shade(c, 0.65));
  }
  function stones(g, x0, y0, w, h) {
    rect(g, x0, y0, w, h, '#2e2834');
    for (let y = y0, row = 0; y < y0 + h; row++) {
      const sh = 9 + Math.floor(row * 1.2);
      for (let x = x0 - ((row * 13) % 26), i = 0; x < x0 + w; i++) {
        const sw = 20 + Math.floor(SCENE.rnd(row * 31 + i) * 14), v = SCENE.rnd(row * 7 + i * 3), c = shade('#6a6070', 0.86 + v * 0.22);
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

  /* ---------- the static street, built once ---------- */
  function buildBack() {
    const c = mk(VW, VH), g = c.getContext('2d');
    // far mountains and a castle on a hill
    poly(g, [[0, 318], [90, 262], [170, 298], [262, 236], [362, 300], [470, 252], [560, 294], [660, 236], [760, 290], [860, 248], [960, 296], [960, 360], [0, 360]], '#3c3060');
    poly(g, [[0, 318], [90, 262], [100, 270], [20, 318]], '#4c3e72'); poly(g, [[262, 236], [272, 244], [200, 290], [190, 286]], '#4c3e72'); poly(g, [[660, 236], [670, 244], [600, 290], [590, 286]], '#4c3e72');
    poly(g, [[0, 340], [140, 300], [300, 334], [480, 310], [700, 336], [860, 306], [960, 330], [960, 380], [0, 380]], '#2c2448');
    for (const [x, w, h] of [[118, 14, 54], [136, 22, 40], [162, 14, 62], [182, 18, 36]]) {
      rect(g, x, 300 - h, w, h, '#221c3a'); poly(g, [[x - 2, 300 - h], [x + w + 2, 300 - h], [x + w / 2, 300 - h - 14]], '#1c1632');
      dot(g, x + (w >> 1), 300 - h + 10, '#ffcf7a'); if (h > 45) dot(g, x + (w >> 1), 300 - h + 24, '#ffcf7a');
    }
    rect(g, 112, 296, 96, 8, '#221c3a');
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
    // ---- the ramen stall ----
    const L = 296, R = 664;
    plaster(g, L, 210, R - L, 146, '#cdb58a', 41);
    ao(g, L, 210, R - L, 146, 'top', 22, 0.5);
    wood(g, L, 356, R - L, 84, '#5e3f26', 18, true, 43); ao(g, L, 356, R - L, 84, 'top', 8, 0.5);
    rect(g, L, 355, R - L, 2, DK);
    post(g, L - 6, 206, 12, 234, '#7a5230'); post(g, R - 6, 206, 12, 234, '#7a5230');
    // windows either side of the door
    litWindow(g, 322, 268, 64, 58, '#6e4a2c', 4, 3); litWindow(g, 574, 268, 64, 58, '#6e4a2c', 4, 3);
    // doorway with the warm room inside
    rect(g, 406, 248, 148, 194, DK);
    for (let k = 0; k < 8; k++) rect(g, 408, 250 + k * 24, 144, 24, mix('#ffdc96', '#b8642e', k / 7));
    rect(g, 408, 372, 144, 10, '#6e4a2c'); rect(g, 408, 372, 144, 2, '#a57a4c'); rect(g, 408, 382, 144, 58, '#4a2e1a');
    for (const sx of [426, 470, 514]) { rect(g, sx, 392, 18, 6, DK); rect(g, sx + 1, 393, 16, 4, '#8a5a32'); rect(g, sx + 7, 398, 4, 40, DK); }
    ao(g, 408, 250, 144, 190, 'left', 14, 0.35); ao(g, 408, 250, 144, 190, 'right', 18, 0.45);
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
    ao(g, L, 222, R - L, 20, 'top', 12, 0.45);
    // vertical RAMEN board beside the door
    rect(g, 668, 236, 26, 112, DK); rect(g, 669, 237, 24, 110, '#8a2a1a'); rect(g, 669, 237, 3, 110, '#b2402a'); rect(g, 689, 237, 4, 110, '#5e1a10');
    'RAMEN'.split('').forEach((ch, i) => textC(g, ch, 681, 248 + i * 19, '#f6e6c0'));
    rect(g, 666, 230, 30, 6, DK); rect(g, 667, 231, 28, 4, '#4a3226');
    // stone step and the street
    rect(g, 392, 440, 176, 8, DK); rect(g, 393, 441, 174, 6, '#8a8090'); rect(g, 393, 441, 174, 1, '#b0a8b8');
    stones(g, 0, 448, VW, VH - 448);
    rect(g, 0, 440, VW, 8, '#3a3240'); rect(g, 0, 447, VW, 1, DK);
    ao(g, 0, 448, VW, 92, 'top', 18, 0.5);
    pool(g, 480, 470, 240, 54, '#ffb060', 0.06);
    // quest board in front of the inn
    SCENE.contact(g, 186, 448, 56, 5);
    for (const px of [140, 228]) { rect(g, px - 1, 372, 8, 76, DK); rect(g, px, 372, 6, 76, '#5e3f26'); rect(g, px, 372, 2, 76, '#8a623c'); }
    rect(g, 128, 360, 116, 64, DK); wood(g, 129, 361, 114, 62, '#7a5230', 12, false, 71);
    poly(g, [[124, 362], [248, 362], [236, 350], [136, 350]], DK); poly(g, [[127, 361], [245, 361], [234, 352], [138, 352]], '#4a3226');
    setFont(1); textC(g, 'QUESTS', 186, 355, '#f6e6c0'); setFont(2);
    for (const [nx, ny, nw, nh, c] of [[133, 368, 28, 34, '#f1e2bf'], [164, 365, 48, 42, '#f6ecd4'], [215, 370, 24, 30, '#e8d4a8']]) {
      rect(g, nx - 1, ny - 1, nw + 2, nh + 2, DK); rect(g, nx, ny, nw, nh, c); rect(g, nx + nw - 2, ny, 2, nh, shade(c, 0.85));
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
      ell(g, px, 414, 14, 13, DK); ell(g, px, 414, 13, 12, '#3e7a34'); ell(g, px - 3, 410, 8, 7, '#5e9c4a'); ell(g, px - 5, 407, 3, 2, '#8cc46a');
      for (const [fx, fy] of [[-6, 6], [5, -4], [8, 5]]) { dot(g, px + fx, 414 + fy, '#f2a2b8'); dot(g, px + fx + 1, 414 + fy, '#ffd0dc'); }
    }
    pool(g, 354, 452, 90, 22, '#ffb060', 0.05); pool(g, 606, 452, 90, 22, '#ffb060', 0.05);
    return c;
  }

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
    bigText(g, 'COZY RAMEN', 280, 45, 5, '#ffd76a', '#fff2b8');
    rect(g, 106, 108, 348, 26, DK); wood(g, 107, 109, 346, 24, '#6e4a2c', 12, false, 91); rect(g, 107, 109, 346, 1, '#a57a4c');
    textC(g, "AN ADVENTURERS' NOODLE STALL", 280, 116, '#f6e6c0');
    return c;
  }

  /* ---------- live parts of the scene ---------- */
  function sky(g) {
    const bands = [['#151538', 0], ['#1e1c48', 40], ['#2c2458', 80], ['#43306a', 130], ['#6a3c70', 180], ['#9a4a6a', 225], ['#cc6a5a', 265], ['#ea9058', 300]];
    bands.forEach(([c, y], i) => rect(g, 0, y, VW, (bands[i + 1] ? bands[i + 1][1] : 380) - y, c));
    for (let i = 0; i < 70; i++) {
      const x = (i * 137) % VW, y = 4 + (i * 53) % 190;
      if (Math.sin(S.t * 2 + i * 1.7) > -0.2) dot(g, x, y, i % 5 ? '#d8d0f0' : '#fff6d0');
      if (i % 11 === 0 && Math.sin(S.t * 2 + i) > 0.6) { dot(g, x - 1, y, '#8a80b0'); dot(g, x + 1, y, '#8a80b0'); dot(g, x, y - 1, '#8a80b0'); dot(g, x, y + 1, '#8a80b0'); }
    }
    ell(g, 860, 74, 17, 17, '#5a4a80'); ell(g, 860, 74, 15, 15, '#fff2cc'); ell(g, 866, 70, 13, 13, '#f2e2b8'); ell(g, 855, 79, 3, 2, '#e8d4a4'); ell(g, 864, 68, 2, 2, '#e8d4a4');
    for (const [x0, y, w, sp] of [[100, 120, 90, 6], [500, 92, 120, 4], [760, 150, 80, 7]]) {
      const x = ((x0 + S.t * sp) % (VW + 240)) - 120;
      ell(g, x, y, w / 2, 6, '#4a3466'); ell(g, x + 14, y - 5, w / 3, 6, '#56406e'); ell(g, x - 4, y + 2, w / 2 - 6, 3, '#3c2c58');
    }
  }
  function noren(g) {
    for (let k = 0; k < 3; k++) {
      const x = 410 + k * 47, sw = Math.round(Math.sin(S.t * 1.6 + k * 0.9) * 3), y0 = 252, y1 = 318;
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
  function lanterns(g) {
    for (const [x, ph] of [[392, 0], [568, 1.3]]) {
      const sw = Math.round(Math.sin(S.t * 1.8 + ph) * 2);
      pool(g, x + sw, 252, 60, 46, '#ffb060', 0.07);
      lantern(g, x + sw, 232, 12, '#c8443a');
    }
    const f = 0.06 + 0.02 * Math.sin(S.t * 7) * Math.sin(S.t * 3.1);
    pool(g, 354, 297, 54, 44, '#ffcf7a', f); pool(g, 606, 297, 54, 44, '#ffcf7a', f);
  }
  function updateScene(dt) {
    // steam from the chimney and the doorway
    puffT -= dt;
    if (puffT <= 0) {
      puffT = 0.12;
      puffs.push({ type: 'steam', x: 601 + (Math.random() * 10 - 5), y: 108, vx: 6, vy: -18 - Math.random() * 10, life: 2.4, max: 2.4 });
      if (Math.random() < 0.5) puffs.push({ type: 'steam', x: 450 + Math.random() * 60, y: 250, vx: 0, vy: -14, life: 1.4, max: 1.4 });
      if (S.screen === 'main' && Math.random() < 0.6) for (const bx of [104, 456]) puffs.push({ type: 'steam', x: 220 + bx + Math.random() * 16 - 8, y: 60, vx: 0, vy: -16, life: 1.2, max: 1.2 });
    }
    for (const p of puffs) { p.x += (p.vx + Math.sin(S.t * 2 + p.y * 0.1) * 6) * dt; p.y += p.vy * dt; p.life -= dt; }
    for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].life <= 0) puffs.splice(i, 1);
    // a slime hops along the cobbles; a dragon crosses the sky now and then
    const sl = village.slime;
    sl.t += dt;
    const hop = (sl.t % 1.1) / 1.1;                         // one hop every 1.1s: squash, leap, land
    if (hop > 0.25 && hop < 0.75) sl.x += sl.dir * 70 * dt;
    if (sl.x > 650) sl.dir = -1; else if (sl.x < 110) sl.dir = 1;
    const dr = village.dragon;
    if (dr.x === null) { dr.wait -= dt; if (dr.wait <= 0) { dr.dir = Math.random() < 0.5 ? 1 : -1; dr.x = dr.dir > 0 ? -60 : VW + 60; dr.y = 34 + Math.random() * 40; } }
    else { dr.x += dr.dir * 90 * dt; if (dr.x < -80 || dr.x > VW + 80) { dr.x = null; dr.wait = 18 + Math.random() * 14; } }
  }

  /* ---------- village life (all drawn here, so every bit of motion is a real animation) ---------- */
  const village = { slime: { x: 200, dir: 1, t: 0 }, dragon: { x: null, wait: 6, dir: 1, y: 50 } };
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
    const d = village.dragon; if (d.x === null) return;
    const x = Math.round(d.x), y = Math.round(d.y + Math.sin(S.t * 2) * 4), f = d.dir, flap = Math.sin(S.t * 9);
    const c = '#1a1430';
    ell(g, x, y, 11, 4, c);                                   // body
    poly(g, [[x - 10 * f, y], [x - 26 * f, y - 2 + Math.round(flap * 2)], [x - 30 * f, y + 3], [x - 10 * f, y + 3]], c);   // tail
    poly(g, [[x + 9 * f, y - 2], [x + 16 * f, y - 6], [x + 20 * f, y - 4], [x + 15 * f, y], [x + 9 * f, y + 2]], c);         // neck + head
    dot(g, x + 17 * f, y - 5, '#ff8a4a');
    const wy = Math.round(flap * 12);
    poly(g, [[x - 4, y - 2], [x + 4, y - 2], [x + 12 * f, y - 4 - wy], [x - 6 * f, y - 10 - wy]], c);                           // far wing
    poly(g, [[x - 3, y - 1], [x + 5, y - 1], [x - 2 * f, y - 14 - wy], [x - 14 * f, y - 8 - wy]], '#241c40');                   // near wing
  }
  function bunting(g) {
    for (const [x0, y0, x1, y1, seed] of [[96, 202, 290, 216, 0], [670, 216, 852, 202, 3]]) {
      const n = 9, sag = 16;
      let px = x0, py = y0;
      for (let i = 1; i <= 24; i++) {
        const u = i / 24, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * sag;
        line(g, px, py, x, y, '#2a1a14'); px = x; py = y;
      }
      for (let i = 1; i < n; i++) {
        const u = i / n, x = Math.round(x0 + (x1 - x0) * u), y = Math.round(y0 + (y1 - y0) * u + Math.sin(u * Math.PI) * sag);
        const sw = Math.round(Math.sin(S.t * 2.4 + i + seed) * 2), c = ['#c8443a', '#e0b040', '#4e7a9c', '#5e9c4a'][(i + seed) % 4];
        poly(g, [[x - 6, y], [x + 6, y], [x + sw, y + 13]], DK); poly(g, [[x - 5, y + 1], [x + 5, y + 1], [x + sw, y + 11]], c);
        poly(g, [[x - 5, y + 1], [x - 1, y + 1], [x + sw - 1, y + 9]], shade(c, 1.2));
      }
    }
  }
  function streetLamp(g) {
    const x = 276, flick = 0.07 + 0.02 * Math.sin(S.t * 9) * Math.sin(S.t * 4.3);
    pool(g, x, 316, 56, 50, '#ffcf7a', flick); pool(g, x, 448, 50, 10, '#ffcf7a', flick);
    rect(g, x - 2, 312, 5, 136, DK); rect(g, x - 1, 312, 3, 136, '#3a3446'); rect(g, x - 1, 312, 1, 136, '#5a5468');
    rect(g, x - 6, 440, 13, 8, DK); rect(g, x - 5, 441, 11, 6, '#3a3446');
    rect(g, x - 8, 296, 17, 18, DK); rect(g, x - 7, 297, 15, 16, '#ffe2a0'); rect(g, x - 7, 297, 4, 16, '#fff6d0');
    rect(g, x - 1, 297, 3, 16, DK); rect(g, x - 10, 292, 21, 5, DK); rect(g, x - 9, 293, 19, 3, '#3a3446'); poly(g, [[x - 6, 292], [x + 7, 292], [x + 0.5, 285]], DK);
  }
  function cat(g) {
    const x = 524, y = 434, br = Math.round(Math.sin(S.t * 1.6));    // breathing
    ell(g, x, y - 4 - br, 13, 6 + br, DK); ell(g, x, y - 4 - br, 12, 5 + br, '#e2903e'); ell(g, x - 3, y - 6 - br, 7, 2, '#f2b062');
    for (const k of [-6, 0, 6]) rect(g, x + k, y - 9 - br, 2, 3, '#b8682a');
    ell(g, x + 11, y - 7, 6, 5, DK); ell(g, x + 11, y - 7, 5, 4, '#e2903e');
    poly(g, [[x + 7, y - 10], [x + 9, y - 15], [x + 11, y - 10]], DK); poly(g, [[x + 12, y - 10], [x + 14, y - 15], [x + 16, y - 10]], DK);
    poly(g, [[x + 8, y - 10], [x + 9, y - 13], [x + 10, y - 10]], '#e2903e'); poly(g, [[x + 13, y - 10], [x + 14, y - 13], [x + 15, y - 10]], '#e2903e');
    rect(g, x + 9, y - 7, 2, 1, DK); rect(g, x + 13, y - 7, 2, 1, DK);
    const flick = Math.sin(S.t * 0.7) > 0.85 ? Math.round(Math.sin(S.t * 14) * 3) : 0;   // the odd tail flick
    line(g, x - 12, y - 3, x - 20, y - 6 + flick, DK, 3); line(g, x - 12, y - 4, x - 19, y - 6 + flick, '#e2903e', 1);
    if (Math.sin(S.t * 0.9) > 0.3) { const zy = y - 22 - Math.round((S.t * 6) % 8); textC(g, 'Z', x + 20, zy, '#c9b8e0'); }
  }
  function slime(g) {
    const sl = village.slime, hop = (sl.t % 1.1) / 1.1;
    let squash = 0, lift = 0;
    if (hop < 0.25) squash = Math.sin(hop / 0.25 * Math.PI) * 3;                  // crouch
    else if (hop < 0.75) lift = Math.sin((hop - 0.25) / 0.5 * Math.PI) * 14;      // leap
    else squash = Math.sin((hop - 0.75) / 0.25 * Math.PI) * 2;                     // land
    const x = Math.round(sl.x), base = 506, w = Math.round(13 + squash * 1.5), h = Math.round(11 - squash + (lift > 2 ? 2 : 0)), y = Math.round(base - h - lift);
    pool(g, x, base + 1, Math.max(6, 13 - lift / 2), 3, '#0e0a12', 0.25, 2);
    ell(g, x, y + h / 2, w + 1, h / 2 + 1, DK); ell(g, x, y + h / 2, w, h / 2, '#5ec44a');
    ell(g, x - 2, y + h / 2 - 2, w - 4, Math.max(1, h / 2 - 3), '#86e06a'); ell(g, x - 5, y + 3, 3, 2, '#d8ffc0');
    ell(g, x + 3, y + h / 2 + 2, w - 5, 2, '#3e9a34');
    const ex = x + 3 * sl.dir; rect(g, ex - 4, y + h / 2 - 2, 2, 3, DK); rect(g, ex + 2, y + h / 2 - 2, 2, 3, DK);
  }

  /* ---------- menus ---------- */
  const MAIN = () => {
    const save = H.saveInfo();
    return [
      { label: save ? 'CONTINUE: DAY ' + save.day : 'CONTINUE', off: !save, act: () => H.onContinue() },
      { label: 'NEW GAME', act: () => (save ? go('confirm') : H.onNew()) },
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
      { label: 'HINTS', type: 'toggle', get: () => !!st.hints, set: v => { st.hints = v; H.applySettings(); } },
      { label: 'BLINDS', type: 'choice', opts: ['DRAG', 'CLICK'], get: () => (st.blindClick ? 1 : 0), set: v => { st.blindClick = v === 1; H.applySettings(); } },
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
    { label: 'YES, START OVER', act: () => H.onNew() },
    { label: 'NO, GO BACK', act: backOut }
  ];
  const HELP = [
    "WELCOME TO COZY RAMEN, A LITTLE NOODLE STALL FOR WEARY ADVENTURERS.",
    '',
    '1. OPEN UP: TAP THE CLOSED SIGN ON THE SERVING COUNTER. THE SHOP RUNS FROM 9:00 TO 21:00.',
    '2. TAKE ORDERS: WHEN A GUEST CALLS, PULL THE RED CORD ON THEIR BLIND UP AND CHAT. YOU CAN DECLINE ORDERS YOU CANNOT MAKE.',
    "3. COOK: IN THE KITCHEN ADD THE RECIPE'S TARE, THEN ITS BROTH, THEN A READY BASKET OF NOODLES.",
    '4. TOP IT: AT THE TOPPINGS STATION ADD WHAT THE SLIP ASKS FOR, THEN DRAG THE BOWL INTO THE PASS.',
    "5. SERVE: PULL THE GUEST'S BLIND UP AND DROP THE BOWL FROM THE PICKUP SHELF INTO THEIR STALL.",
    '',
    'AT 21:00 THE SHOP CLOSES AND A RECEIPT PRINTS. AT NIGHT, TAP THE SIGN TO SKIP TO MORNING.',
    'SWITCH ROOMS WITH THE TABS OR EDGE ARROWS. IN THE KITCHEN, HOLD A / D OR SCROLL TO LOOK AROUND. ESC PAUSES. YOUR DAY SAVES AT OPENING AND CLOSING.'
  ];
  function wrap(s, maxW) {
    if (!s) return [''];
    const out = []; let cur = '';
    for (const w of s.split(' ')) { const next = (cur + ' ' + w).trim(); if (cur && textW(next) > maxW) { out.push(cur); cur = w; } else cur = next; }
    if (cur) out.push(cur);
    return out;
  }
  function rows() {
    return S.screen === 'main' ? MAIN() : S.screen === 'settings' ? SET() : S.screen === 'pause' ? PAUSE() : S.screen === 'confirm' ? CONFIRM() : [];
  }
  function go(screen) { S.screen = screen; S.sel = 0; S.open = 0; H.sfx.page(); }
  function backOut() {
    H.sfx.back();
    if (S.screen === 'pause') return H.onResume();
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
      info.forEach((s, i) => textC(g, s, rx + 181, y + 246 + i * 16, i === 0 && known ? '#4a3226' : '#6a5038'));
    }
    nav('BACK', rx + 300, backOut);
  }

  /* ---------- frame ---------- */
  function update(dt) {
    S.t += dt; S.open += dt;
    if (!S.overlay) updateScene(dt);
  }
  function draw(g) {
    hits = [];
    if (S.overlay) { g.fillStyle = 'rgba(14,8,20,0.55)'; g.fillRect(0, 0, VW, VH); }
    else {
      if (!back) { back = buildBack(); logo = buildLogo(); }
      sky(g); windmill(g); dragon(g);
      g.drawImage(back, 0, 0);
      noren(g); lanterns(g); bunting(g); streetLamp(g); cat(g); slime(g);
      for (const p of puffs) SCENE.part(g, p);
      // fireflies over the street
      for (let i = 0; i < 7; i++) {
        const fx = (i * 173 + S.t * 14 * (i % 2 ? 1 : -1)) % VW, fy = 380 + Math.sin(S.t * 0.9 + i * 2) * 40 + (i * 23) % 60;
        if (Math.sin(S.t * 3 + i * 1.3) > 0) { dot(g, (fx + VW) % VW, Math.round(fy), '#fff2a0'); pool(g, (fx + VW) % VW, Math.round(fy), 4, 4, '#fff2a0', 0.12, 2); }
      }
      const ly = 16 + Math.round(Math.sin(S.t * 1.2) * 2);
      g.drawImage(logo, 200, ly);
      for (const bx of [104, 456]) ART.smallBowl(g, 200 + bx, ly + 64, { broth: true, noodles: 'perfect', items: ['chashu', 'egg', 'nori', 'scallion'] }, S.t);
    }
    if (S.screen === 'main') drawMain(g);
    else if (S.screen === 'book') drawBook(g);
    else if (S.screen === 'help') {
      const R = scroll(g, VW / 2, 70, 700, 400, 'HOW TO PLAY');
      if (R) {
        let y = R.y + 44;
        for (const para of HELP) for (const l of wrap(para, R.w - 60)) { text(g, l, R.x + 30, y, '#4a3226'); y += para ? 17 : 8; }
        const by = R.y + R.h - 30; textC(g, 'BACK', VW / 2, by, '#8a2a1a'); hits.push({ r: { x: VW / 2 - 40, y: by - 6, w: 80, h: 22 }, fn: backOut });
        glove(g, VW / 2 - 34 + Math.round(Math.sin(S.t * 6) * 2), by + 5, 1);
      }
    } else {
      const list = rows(), title = { settings: 'SETTINGS', pause: 'PAUSED', confirm: 'START A NEW GAME?' }[S.screen];
      const h = 70 + list.length * 34 + (S.screen === 'confirm' || S.screen === 'pause' ? 30 : 0);
      const R = scroll(g, VW / 2, Math.round(VH / 2 - h / 2), S.screen === 'settings' ? 600 : 480, h, title);
      if (R) {
        const extra = S.screen === 'confirm' ? 'YOUR SAVED DAY WILL BE LOST.' : S.screen === 'pause' ? 'YOUR DAY SAVES AT OPENING AND CLOSING.' : '';
        if (extra) textC(g, extra, VW / 2, R.y + 44, '#7a5230');
        drawRows(g, R, list, R.y + (extra ? 74 : 54));
      }
    }
  }
  function drawMain(g) {
    const list = MAIN();
    // signpost
    post(g, 826, 196, 16, 344, '#6e4a2c');
    poly(g, [[820, 198], [848, 198], [834, 184]], DK); poly(g, [[823, 197], [845, 197], [834, 187]], '#4a3226');
    list.forEach((it, i) => {
      const sel = i === S.sel; S.slide[i] += ((sel ? -8 : 0) - S.slide[i]) * 0.25;
      const x0 = 738 + Math.round(S.slide[i]), y = 214 + i * 46, w = 190, hh = 34;
      const pts = [[x0, y + hh / 2], [x0 + 16, y], [x0 + w, y], [x0 + w, y + hh], [x0 + 16, y + hh]];
      poly(g, pts.map(([px, py]) => [px - (px === x0 ? 2 : 0), py + (py === y ? -1 : py === y + hh ? 1 : 0)]), DK);
      g.save(); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const [px, py] of pts.slice(1)) g.lineTo(px, py); g.closePath(); g.clip();
      wood(g, x0, y, w, hh, sel ? '#b07c48' : '#8a5a32', 11, false, 101 + i);
      rect(g, x0, y, w, 1, sel ? '#e6c890' : '#b07c48'); rect(g, x0, y + hh - 2, w, 2, '#4a2e1a');
      g.restore();
      for (const nx of [x0 + 24, x0 + w - 7]) for (const ny of [y + 5, y + hh - 7]) { rect(g, nx - 1, ny - 1, 3, 3, DK); dot(g, nx, ny, sel ? '#ffe08a' : '#e0b040'); }   // brass nails
      rect(g, 832, y + 15, 3, 3, DK); dot(g, 833, y + 16, '#c9a468');
      textC(g, it.label, x0 + w / 2 + 8, y + 12, it.off ? '#6e5a48' : sel ? '#ffe9a0' : '#f6e6c0', DK);
      hits.push({ r: { x: x0, y, w, h: hh }, i, fn: it.off ? () => H.sfx.bad() : it.act });
      if (sel) glove(g, x0 + w + 12 + Math.round(Math.sin(S.t * 6) * 3), y + hh / 2, -1);
    });
    text(g, 'ARROW KEYS + ENTER, OR CLICK', 14, 518, '#c9b8e0');
  }

  /* ---------- input ---------- */
  function move(p) {
    if (!p) return;
    const h = hits.find(h => h.i !== undefined && inR(p, h.r));
    if (h && h.i !== S.sel) { S.sel = h.i; H.sfx.move(); }
    H.cursor(hits.some(h => inR(p, h.r)) ? 'pointer' : 'default');
  }
  function down(p) {
    H.startMusic();
    const h = hits.slice().reverse().find(h => h.fn && inR(p, h.r));
    if (h) { if (h.i !== undefined) S.sel = h.i; if (S.screen === 'main' || !rows()[S.sel] || !rows()[S.sel].type) H.sfx.ok(); h.fn(); }
  }
  function key(k) {
    H.startMusic();
    if (S.screen === 'book') {
      const n = Math.min(PER, GUESTS.length - S.page * PER), pages = Math.ceil(GUESTS.length / PER);
      if (k === 'Escape' || k === 'Backspace') return backOut();
      if (k === 'ArrowRight') { if (S.pick % 5 === 4 || S.pick === n - 1) { if (S.page < pages - 1) { S.page++; S.pick = 0; H.sfx.page(); } } else { S.pick++; H.sfx.move(); } }
      if (k === 'ArrowLeft') { if (S.pick % 5 === 0) { if (S.page > 0) { S.page--; S.pick = 0; H.sfx.page(); } } else { S.pick--; H.sfx.move(); } }
      if (k === 'ArrowDown' && S.pick + 5 < n) { S.pick += 5; H.sfx.move(); }
      if (k === 'ArrowUp' && S.pick >= 5) { S.pick -= 5; H.sfx.move(); }
      return;
    }
    if (S.screen === 'help') { if (['Escape', 'Enter', ' ', 'Backspace'].includes(k)) backOut(); return; }
    const list = rows(), it = list[S.sel];
    if (k === 'ArrowUp') { S.sel = (S.sel + list.length - 1) % list.length; H.sfx.move(); }
    else if (k === 'ArrowDown') { S.sel = (S.sel + 1) % list.length; H.sfx.move(); }
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
  function enter() { S.overlay = false; S.screen = 'main'; S.sel = H.saveInfo() ? 0 : 1; S.open = 0; }
  function openPause(screen) { S.overlay = true; S.screen = screen || 'pause'; S.sel = 0; S.open = 0; }

  return { init, enter, openPause, update, draw, move, down, key };
})();
