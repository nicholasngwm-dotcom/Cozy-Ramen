'use strict';
/* Toppings + kitchen, one continuous counter in local x 0-KL.W (the caller translates it to world x KL.X0).
   Toppings view shows local x 0-960, kitchen view shows 560-1520; both see the topping boxes and the bowl mat.
   Art direction: a lantern-lit adventurers' ramen-ya. Warm plaster between dark timber posts, a hinoki counter,
   lacquered topping boxes, glazed tare crocks, copper stock pots on a brick hearth and a copper-banded noodle boiler.
   One light logic: paper lanterns and the hearth fire are warm key lights; corners fall off into soft shade. */
const KITCHEN = (() => {
  const { mk, rect, dot, ell, lathe, poly, line, shade, mix, text, textC, textW } = PX;
  const { wood, plaster, frameRect, lantern, label, sky, ao, pool, contact, rnd, tag, tagInk } = SCENE;
  const DK = PX.OUTLINE, W = KL.W;
  const C = {   // every colour here comes from the shared palette (PAL in ui.js)
    beam: PAL.beam, beamHi: PAL.beamHi, post: PAL.post, plaster: PAL.plaster, hinoki: '#dcae70', panel: PAL.panel,
    brick: PAL.brick, mortar: PAL.mortar, stone: PAL.stone, stoneLo: PAL.stoneLo, stoneHi: PAL.stoneHi,
    copper: PAL.copper, copperHi: PAL.copperHi, copperLo: PAL.copperLo, copperDk: PAL.copperDk,
    iron: PAL.iron, ironHi: PAL.ironHi, lacquer: PAL.lacquerBlack, lacquerRed: PAL.lacquerDeep, indigo: PAL.indigo, indigoLo: PAL.indigoLo
  };
  const WIN = { x: 976, y: 150, w: 104, h: 84 };
  const COOK_X = 1124;                          // brick backsplash + hood start here
  const HEARTH = { x: 1126, x1: 1368, y: 392, y1: 504 };
  const LANTERNS = [[238, 56, 11, '#c8443a'], [404, 46, 10, '#e8a040'], [1060, 46, 10, '#c8443a']];
  let back = null;

  // A vertical cylinder in cel steps (lit left, dark right). tones: [rim-left, highlight, light, base, shade, rim-right]
  function cyl(g, cx, y0, rx, h, t) {
    for (let x = -rx; x <= rx; x++) {
      const k = x / rx;
      rect(g, cx + x, y0, 1, h, k < -0.82 ? t[0] : k < -0.55 ? t[1] : k < -0.35 ? t[2] : k > 0.82 ? t[5] : k > 0.45 ? t[4] : t[3]);
    }
    rect(g, cx - rx - 1, y0, 1, h + 1, DK); rect(g, cx + rx + 1, y0, 1, h + 1, DK); rect(g, cx - rx - 1, y0 + h, 2 * rx + 3, 1, DK);
  }
  const COPPER = [C.copperLo, C.copperHi, '#e09a58', C.copper, C.copperLo, C.copperDk];
  const IRON = ['#2a2428', '#6e6468', '#524a4e', C.iron, '#2e282c', '#1e1a1e'];

  // Running-bond bricks with mortar lines, a lit top edge per brick and the odd darker one.
  function bricks(g, x, y, w, h, base = C.brick) {
    rect(g, x, y, w, h, C.mortar);
    for (let yy = y, row = 0; yy < y + h; yy += 10, row++) {
      for (let xx = x - (row % 2) * 12, col = 0; xx < x + w; xx += 24, col++) {
        const bx = Math.max(x, xx + 1), bw = Math.min(xx + 23, x + w) - bx, bh = Math.min(9, y + h - yy - 1);
        if (bw <= 1 || bh <= 1) continue;
        const v = rnd(row * 37 + col * 11 + x), tone = shade(base, 0.84 + v * 0.26);
        rect(g, bx, yy + 1, bw, bh, tone); rect(g, bx, yy + 1, bw, 1, shade(tone, 1.18)); rect(g, bx, yy + bh, bw, 1, shade(tone, 0.8));
        if (v > 0.85 && bw > 8) dot(g, bx + 4 + Math.floor(v * 31) % Math.max(1, bw - 8), yy + 4, shade(tone, 0.7));
      }
    }
  }
  // Dark timber post or beam with a lit edge and a shaded edge.
  function timber(g, x, y, w, h, vertical = true) {
    rect(g, x - 1, y, w + 2, h, DK); wood(g, x, y, w, h, C.post, vertical ? w : h, vertical, x + y);
    if (vertical) { rect(g, x, y, 1, h, C.beamHi); rect(g, x + w - 2, y, 2, h, shade(C.post, 0.7)); }
    else { rect(g, x, y, w, 1, C.beamHi); rect(g, x, y + h - 2, w, 2, shade(C.post, 0.7)); }
  }
  // Bowl seen side-on, for the stacks on shelves. by = bottom y.
  function sideBowl(g, cx, by, c, band) {
    poly(g, [[cx - 22, by - 12], [cx + 22, by - 12], [cx + 14, by], [cx - 14, by]], DK);
    poly(g, [[cx - 21, by - 11], [cx + 21, by - 11], [cx + 13, by - 1], [cx - 13, by - 1]], c);
    rect(g, cx - 21, by - 12, 42, 2, shade(c, 1.18));
    if (band) rect(g, cx - 17, by - 7, 34, 2, band);
    rect(g, cx - 16, by - 9, 3, 5, shade(c, 1.35)); rect(g, cx + 9, by - 9, 4, 7, shade(c, 0.8));
    rect(g, cx - 8, by, 16, 1, DK);
  }
  function stack(g, cx, by, n, c, band) { for (let i = 0; i < n; i++) sideBowl(g, cx, by - i * 7, c, band); }
  // A small potion-style bottle (the RPG touch on the windowsill and spice shelf).
  function bottle(g, x, by, c, tall = 16) {
    rect(g, x - 5, by - tall, 11, tall, DK); rect(g, x - 4, by - tall + 1, 9, tall - 2, c);
    rect(g, x - 2, by - tall - 5, 5, 6, DK); rect(g, x - 1, by - tall - 4, 3, 4, '#c9b48a'); rect(g, x - 2, by - tall - 7, 5, 3, '#8a5a32');
    rect(g, x - 3, by - tall + 3, 2, tall - 7, shade(c, 1.45)); rect(g, x + 2, by - tall + 2, 2, tall - 4, shade(c, 0.7));
    rect(g, x - 4, by - tall / 2 - 2, 9, 4, '#f6e6c0'); dot(g, x, by - tall / 2, shade(c, 0.6));
  }
  // Brass padlock (marks a slot that is not unlocked yet).
  function lock(g, x, y) {
    rect(g, x - 3, y - 6, 7, 2, DK); rect(g, x - 4, y - 5, 2, 5, DK); rect(g, x + 3, y - 5, 2, 5, DK);
    rect(g, x - 3, y - 5, 1, 4, '#c9962e'); rect(g, x + 3, y - 5, 1, 4, '#c9962e'); rect(g, x - 2, y - 6, 5, 1, '#c9962e');
    rect(g, x - 6, y - 1, 13, 10, DK); rect(g, x - 5, y, 11, 8, '#e0b040'); rect(g, x - 5, y, 11, 2, '#ffe08a'); rect(g, x - 5, y + 6, 11, 2, '#9a6a22');
    rect(g, x, y + 2, 1, 4, DK);
  }

  function hood(g, x0, x1) {
    const top = 31, lip = 136;
    ao(g, x0, lip + 2, x1 - x0, 44, 'top', 30, 0.5);
    poly(g, [[x0 + 30, top], [x1, top], [x1, lip], [x0, lip]], DK);
    poly(g, [[x0 + 31, top], [x1, top], [x1, lip - 1], [x0 + 1, lip - 1]], C.plaster);
    plaster(g, x0 + 32, top, x1 - x0 - 32, lip - top - 18, C.plaster, 41);
    poly(g, [[x0 + 31, top], [x0 + 36, top], [x0 + 6, lip - 18], [x0 + 1, lip - 18]], '#fff4dc');   // lit slanted edge
    for (let x = x0 + 70; x < x1; x += 110) timber(g, x, top, 8, lip - top - 18);               // timber ribs
    rect(g, x0, lip - 18, x1 - x0, 18, DK);                                                     // copper band
    for (let x = x0 + 1; x < x1; x++) { const k = (x - x0) % 40; rect(g, x, lip - 17, 1, 16, k < 2 ? C.copperDk : k < 8 ? C.copperHi : C.copper); }
    rect(g, x0 + 1, lip - 17, x1 - x0 - 1, 1, C.copperHi); rect(g, x0 + 1, lip - 3, x1 - x0 - 1, 2, C.copperLo);
    for (let x = x0 + 20; x < x1; x += 40) { dot(g, x, lip - 9, C.copperDk); dot(g, x - 1, lip - 10, C.copperHi); }
    rect(g, x0 + 4, lip + 1, x1 - x0 - 8, 6, '#2a2226');
    for (let x = x0 + 54; x < x1 - 20; x += 110) { rect(g, x - 9, lip + 1, 18, 4, '#ffe7a8'); rect(g, x - 7, lip + 1, 14, 2, '#fffbe6'); pool(g, x, lip + 90, 80, 70, '#ffe2a0', 0.04); }
  }

  function buildBack() {
    const c = mk(W, VH), g = c.getContext('2d');
    // ceiling beam
    wood(g, 0, 0, W, 30, C.beam, 10, false, 305); rect(g, 0, 29, W, 2, DK);
    // warm plaster walls, brick behind the cooking line
    plaster(g, 0, 31, COOK_X, 269, C.plaster, 7);
    bricks(g, COOK_X, 140, W - COOK_X, 160);
    plaster(g, COOK_X, 31, W - COOK_X, 110, C.plaster, 9);
    // wainscot: dark wooden panels along the bottom of the prep wall
    rect(g, 0, 246, COOK_X, 1, DK); wood(g, 0, 247, COOK_X, 53, C.panel, 53, false, 17);
    for (let x = 28; x < COOK_X; x += 56) { rect(g, x, 250, 1, 48, shade(C.panel, 0.65)); rect(g, x + 1, 250, 1, 48, shade(C.panel, 1.2)); }
    rect(g, 0, 247, COOK_X, 2, shade(C.panel, 1.25));
    // timber posts frame each section
    for (const x of [228, 554, 952, COOK_X - 6]) timber(g, x, 31, 10, 269);
    timber(g, 0, 31, W, 8, false);
    ao(g, 0, 39, W, 261, 'top', 26, 0.45);
    ao(g, 0, 31, W, 269, 'bottom', 22, 0.35);
    // light: window spill and the lantern pools on the wall
    pool(g, WIN.x + WIN.w / 2, 290, 150, 80, '#fff2c8', 0.06);
    for (const [lx, ly] of LANTERNS) pool(g, lx, ly + 40, 90, 70, '#ffc070', 0.07);
    // ticket rail (slips are drawn on top by the game): a lacquered wooden rail on brass pegs
    ao(g, 250, 42, 1250, 10, 'top', 8, 0.35);
    rect(g, 250, 32, 1250, 10, DK); wood(g, 251, 33, 1248, 8, '#7a3a24', 8, false, 3); rect(g, 251, 33, 1248, 1, '#b05a38');
    for (let x = 280; x < 1500; x += 160) { rect(g, x - 2, 31, 5, 12, DK); rect(g, x - 1, 32, 3, 10, '#e0b040'); }
    // lattice window over the tare crocks, with potion bottles and herbs on the sill
    frameRect(g, WIN.x, WIN.y, WIN.w, WIN.h, '#6e4a2c', 6);
    g.clearRect(WIN.x, WIN.y, WIN.w, WIN.h);
    for (let k = 1; k < 4; k++) rect(g, WIN.x + Math.round(WIN.w * k / 4) - 1, WIN.y, 2, WIN.h, '#6e4a2c');
    rect(g, WIN.x, WIN.y + WIN.h / 2 - 1, WIN.w, 2, '#6e4a2c');
    rect(g, WIN.x - 10, WIN.y + WIN.h + 6, WIN.w + 20, 6, DK); wood(g, WIN.x - 9, WIN.y + WIN.h + 7, WIN.w + 18, 4, '#8a623c', 4, false, 313);
    bottle(g, WIN.x + 6, WIN.y + WIN.h + 6, '#c8443a', 14); bottle(g, WIN.x + 22, WIN.y + WIN.h + 6, '#4aa86a', 18); bottle(g, WIN.x + 96, WIN.y + WIN.h + 6, '#5a7ad8', 12);
    for (let k = 0; k < 5; k++) { const hx = WIN.x + 40 + k * 7; line(g, hx, WIN.y - 8, hx + (k % 2 ? 2 : -2), WIN.y + 18, '#5a7a3a', 2); dot(g, hx, WIN.y + 18, '#7aa04a'); }
    rect(g, WIN.x + 36, WIN.y - 10, 34, 3, DK); rect(g, WIN.x + 37, WIN.y - 9, 32, 1, '#c9a468');
    // prep wall: a hinoki shelf of clean bowls with a beckoning cat at the end (the cat's paw is animated in frame())
    ao(g, 252, 272, 296, 10, 'top', 8, 0.4);
    stack(g, 284, 266, 5, '#f2ede2', '#3f6fa8'); stack(g, 334, 266, 4, '#f2ede2', '#3f6fa8'); stack(g, 386, 266, 5, '#b8302a', '#e8c070');
    stack(g, 438, 266, 3, '#2e2a2e', '#c9a468');
    rect(g, 252, 266, 296, 6, DK); wood(g, 253, 267, 294, 4, C.hinoki, 4, false, 23); rect(g, 253, 267, 294, 1, '#f6d9a0');
    for (const bx of [270, 530]) poly(g, [[bx - 3, 272], [bx + 4, 272], [bx + 4, 286]], DK);
    // hood over the hearth and boiler
    hood(g, COOK_X, W);
    // brick shelf above the boiler for the noodle tray
    const N = KL.NOODLE;
    rect(g, N.x - 22, N.y + N.h, N.w + 40, 7, DK); wood(g, N.x - 21, N.y + N.h + 1, N.w + 38, 5, C.hinoki, 5, false, 31); rect(g, N.x - 21, N.y + N.h + 1, N.w + 38, 1, '#f6d9a0');
    for (const bx of [N.x - 12, N.x + N.w + 8]) poly(g, [[bx - 3, N.y + N.h + 7], [bx + 4, N.y + N.h + 7], [bx + 4, N.y + N.h + 22]], DK);
    ao(g, N.x - 21, N.y + N.h + 7, N.w + 38, 10, 'top', 8, 0.35);
    // hanging utensils on a rail between hood and hearth
    rect(g, 1150, 150, 190, 4, DK); rect(g, 1151, 151, 188, 2, '#e0b040');
    const hang = (x, len, draw) => { rect(g, x, 154, 1, len, DK); draw(x, 154 + len); };
    hang(1170, 18, (x, y) => { ell(g, x, y + 7, 8, 7, DK); ell(g, x, y + 7, 7, 6, C.copper); ell(g, x - 2, y + 5, 3, 2, C.copperHi); });
    hang(1206, 26, (x, y) => { rect(g, x - 1, y, 3, 10, DK); ell(g, x, y + 14, 6, 5, DK); ell(g, x, y + 14, 5, 4, '#c9a468'); });
    hang(1240, 14, (x, y) => { lathe(g, x, [[y, 9], [y + 16, 6]], DK); lathe(g, x, [[y + 1, 8], [y + 15, 5]], '#b58a52'); for (let k = -6; k <= 6; k += 3) rect(g, x + k, y + 2, 1, 12, '#7a5432'); });
    hang(1276, 22, (x, y) => { ell(g, x, y + 8, 8, 8, DK); ell(g, x, y + 8, 7, 7, C.iron); ell(g, x - 2, y + 6, 3, 3, C.ironHi); });
    hang(1310, 16, (x, y) => { rect(g, x - 6, y, 13, 22, DK); rect(g, x - 5, y + 1, 11, 20, '#dfe6ee'); rect(g, x - 5, y + 1, 3, 20, '#ffffff'); rect(g, x - 2, y - 4, 5, 5, '#6b4a34'); });
    // pass window to the serving room (its little noren curtains are the shop's indigo)
    const P = KL.PASS;
    ao(g, P.x + P.w + 9, P.y - 8, 14, P.h + 16, 'left', 12, 0.4);
    frameRect(g, P.x, P.y, P.w, P.h, '#5a3820', 8);
    // through the window: the warm, dim serving room (a glimpse of the counter and two paper lanterns)
    rect(g, P.x, P.y, P.w, P.h, '#3a2620');
    rect(g, P.x, P.y + 118, P.w, 40, '#2a1a14'); rect(g, P.x, P.y + 118, P.w, 2, '#5a3a24');   // the dark wainscot beyond the counter
    for (const lx of [P.x + 44, P.x + P.w - 44]) {
      rect(g, lx, P.y + 46, 1, 28, '#1a1010');
      ell(g, lx, P.y + 88, 10, 12, '#1a1010'); ell(g, lx, P.y + 88, 9, 11, '#d8a050'); ell(g, lx - 1, P.y + 87, 5, 7, '#ffe0a0');
      rect(g, lx - 5, P.y + 75, 11, 3, '#1a1010'); rect(g, lx - 5, P.y + 99, 11, 3, '#1a1010');
    }
    rect(g, P.x, P.y + 158, P.w, 18, '#8a6a42'); rect(g, P.x, P.y + 158, P.w, 1, '#c8985c');   // the counter top
    for (let k = 0; k < 3; k++) {
      const x = P.x + 2 + k * 54; rect(g, x, P.y, 52, 46, C.indigo); rect(g, x + 44, P.y, 8, 46, C.indigoLo); rect(g, x, P.y, 52, 5, '#1a2244');
      poly(g, [[x + 16, P.y + 25], [x + 37, P.y + 25], [x + 32, P.y + 34], [x + 21, P.y + 34]], '#e8dcc0');   // bowl crest
      rect(g, x + 22, P.y + 34, 9, 2, '#e8dcc0'); line(g, x + 20, P.y + 14, x + 34, P.y + 23, '#e8dcc0', 1); line(g, x + 23, P.y + 13, x + 36, P.y + 21, '#e8dcc0', 1);
    }
    // the sill: a thick hinoki ledge, and a lacquered serving tray waiting on it (bowls go on the tray)
    const SY = P.y + 176;
    rect(g, P.x - 10, SY - 1, P.w + 20, 70, DK); wood(g, P.x - 9, SY, P.w + 18, 68, '#e8c08a', 17, false, 177); rect(g, P.x - 9, SY, P.w + 18, 2, '#fff0cf'); rect(g, P.x - 9, SY + 66, P.w + 18, 2, '#a8763e');
    tray(g, P.x + P.w / 2, SY + 34, 150, 62);
    // the order-up bell on the corner of the sill
    const bx = P.x + P.w + 2, by = SY - 2;
    ell(g, bx, by, 9, 3, DK); ell(g, bx, by - 1, 8, 2, '#8a6a42'); lathe(g, bx, [[by - 12, 2], [by - 9, 6], [by - 3, 8]], DK); lathe(g, bx, [[by - 11, 1], [by - 9, 5], [by - 3, 7]], PAL.brass); rect(g, bx - 3, by - 9, 2, 5, '#ffe08a'); rect(g, bx - 1, by - 15, 2, 3, DK);
    // menu board on the prep wall: one row per ramen on the menu today (the board is rebuilt when a recipe unlocks)
    const dishes = ((window.G && G.menu) || ['miso']).filter(k => MENU[k]), rows = Math.ceil(dishes.length / 2);
    const MBX = 598, MBY = 40, MBW = 346, MBH = 30 + rows * 14 + 16;
    rect(g, MBX + 40, MBY - 10, 2, 10, DK); rect(g, MBX + MBW - 42, MBY - 10, 2, 10, DK);
    rect(g, MBX - 1, MBY - 1, MBW + 2, MBH + 2, DK); wood(g, MBX, MBY, MBW, MBH, '#6e4428', MBH, false, 77);
    rect(g, MBX + 4, MBY + 4, MBW - 8, MBH - 8, DK); rect(g, MBX + 5, MBY + 5, MBW - 10, MBH - 10, '#3a2418');
    for (const [nx, ny] of [[MBX + 2, MBY + 2], [MBX + MBW - 3, MBY + 2], [MBX + 2, MBY + MBH - 3], [MBX + MBW - 3, MBY + MBH - 3]]) dot(g, nx, ny, '#e0b040');
    textC(g, 'MENU', MBX + MBW / 2, MBY + 10, '#ffe08a');
    rect(g, MBX + 20, MBY + 26, MBW - 40, 1, '#7a5230');
    PX.setFont(1);
    dishes.forEach((k, i) => {
      const m = MENU[k], x = MBX + 14 + (i % 2) * 168, y = MBY + 30 + Math.floor(i / 2) * 14;
      rect(g, x, y + 3, 5, 5, m.c); text(g, m.name.toUpperCase().slice(0, 18), x + 9, y, '#f6e6c0');
      const pr = m.price + 'G'; text(g, pr, x + 158 - textW(pr), y, '#ffb87a');
    });
    { const ps = rackTops().filter(topOn).map(extraPrice), lo = Math.min(...ps), hi = Math.max(...ps);
      textC(g, ps.length ? 'EXTRA TOPPINGS +' + lo + (hi > lo ? '-' + hi : '') + 'G EACH' : 'EXTRA TOPPINGS', MBX + MBW / 2, MBY + MBH - 14, '#c9a468'); }
    PX.setFont(2);
    // hinoki counter along the whole strip
    rect(g, 0, 299, W, 2, DK);
    wood(g, 0, 301, W, 239, C.hinoki, 26, false, 309);
    rect(g, 0, 301, W, 1, '#fff0c8'); rect(g, 0, 302, W, 2, '#f0c88a');
    ao(g, 0, 304, W, 236, 'top', 22, 0.4);
    ao(g, 0, 304, W, 236, 'bottom', 70, 0.35);
    for (const [lx] of LANTERNS) pool(g, lx, 360, 120, 40, '#fff2c8', 0.06);
    // stepped hinoki shelf for the lacquered topping boxes, with a dark name rail above each row
    const UX = 566, UW = 388;
    ao(g, UX - 6, 372, UW + 12, 12, 'top', 10, 0.5);
    rect(g, UX - 1, 159, UW + 2, 72, DK); wood(g, UX, 160, UW, 70, '#a87a44', 23, false, 49);
    rect(g, UX - 1, 229, UW + 2, 72, DK); wood(g, UX, 230, UW, 70, '#b8864e', 23, false, 51);
    rect(g, UX - 1, 299, UW + 2, 72, DK); wood(g, UX, 300, UW, 70, C.hinoki, 30, false, 53);
    rect(g, UX, 300, UW, 1, '#fff0c8'); rect(g, UX, 368, UW, 4, '#8a5a32');
    for (const y of [162, 232, 302]) { rect(g, UX + 3, y, UW - 6, 18, C.lacquer); rect(g, UX + 3, y, UW - 6, 1, '#5a3a32'); rect(g, UX + 3, y + 17, UW - 6, 1, C.lacquerRed); }
    for (const x of [UX, UX + UW - 6]) { rect(g, x, 160, 6, 212, '#6e4a2c'); rect(g, x, 160, 1, 212, '#9a6a3a'); }
    // bamboo mat for the two bowls
    const M = KL.MAT;
    ao(g, M.x - 4, M.y + M.h, M.w + 8, 8, 'top', 6, 0.45);
    rect(g, M.x, M.y, M.w, M.h, DK); rect(g, M.x + 1, M.y + 1, M.w - 2, M.h - 2, '#c4cf8e');
    for (let y = M.y + 3; y < M.y + M.h - 2; y += 6) { rect(g, M.x + 1, y, M.w - 2, 2, '#a8b86e'); rect(g, M.x + 1, y + 2, M.w - 2, 1, '#dae4aa'); }
    for (const x of [M.x + 24, M.x + 124, M.x + 224]) rect(g, x, M.y + 1, 2, M.h - 2, '#86985a');
    contact(g, 598, 494, 26, 5); stack(g, 598, 494, 4, '#b8302a', '#e8c070');
    // prep corner: a cutting board with a knife and sliced scallion, and a caddy of potion-style condiments
    contact(g, 118, 488, 76, 6);
    rect(g, 44, 444, 148, 42, DK); wood(g, 45, 445, 146, 40, '#e8c48a', 40, false, 71); rect(g, 45, 445, 146, 1, '#fff0c8'); rect(g, 45, 482, 146, 3, '#b8864e');
    rect(g, 70, 456, 54, 6, DK); rect(g, 71, 457, 52, 4, '#dfe6ee'); rect(g, 71, 457, 52, 1, '#ffffff'); rect(g, 124, 455, 22, 8, DK); rect(g, 125, 456, 20, 6, '#3a2a22');
    ART.top(g, 'scallion', 160, 468, 0.9);
    contact(g, 236, 500, 30, 4);
    rect(g, 206, 486, 60, 14, DK); wood(g, 207, 487, 58, 12, '#8a5a32', 12, false, 73);
    bottle(g, 218, 488, '#3a1e14', 18); bottle(g, 236, 488, '#c8443a', 14); bottle(g, 254, 488, '#d8a030', 16);
    // brick hearth under the broth pots: a stone slab top, three arched fire mouths (fire is animated in frame())
    const H = HEARTH;
    contact(g, (H.x + H.x1) / 2, H.y1 + 4, (H.x1 - H.x) / 2 + 8, 7);
    rect(g, H.x - 1, H.y - 1, H.x1 - H.x + 2, H.y1 - H.y + 2, DK);
    bricks(g, H.x, H.y + 10, H.x1 - H.x, H.y1 - H.y - 10, '#b05e40');
    rect(g, H.x - 4, H.y - 2, H.x1 - H.x + 8, 12, DK); rect(g, H.x - 3, H.y - 1, H.x1 - H.x + 6, 10, C.stone);
    rect(g, H.x - 3, H.y - 1, H.x1 - H.x + 6, 2, C.stoneHi); rect(g, H.x - 3, H.y + 7, H.x1 - H.x + 6, 2, C.stoneLo);
    for (let i = 0; i < BROTH_SLOTS.length; i++) {
      const fx = KL.pot(i).cx, my = H.y + 26;
      ell(g, fx, my + 2, 16, 10, DK); rect(g, fx - 16, my + 2, 33, 34, DK);
      ell(g, fx, my + 2, 14, 8, '#1a0e0c'); rect(g, fx - 14, my + 2, 29, 32, '#1a0e0c');
      for (let k = -16; k <= 16; k += 8) { rect(g, fx + k, my - 6 + Math.abs(k) / 3, 4, 3, C.stoneHi); }   // voussoir stones
    }
    rect(g, H.x, H.y1 - 10, H.x1 - H.x, 10, C.stoneLo); rect(g, H.x, H.y1 - 10, H.x1 - H.x, 1, C.stone);
    const B = KL.BOIL, BK = KL.BOOK, TR = KL.TRASH;
    contact(g, B.cx, B.cy + 152, B.rx + 12, 9);
    contact(g, TR.x + 23, TR.y + TR.h, 26, 5); contact(g, BK.x + 58, BK.y + 76, 34, 4);
    for (let i = 0; i < TARE_SLOTS.length; i++) { const T = KL.tare(i); contact(g, T.cx, T.y + 54, 22, 4); }
    return c;
  }

  /* ---------- liquids: shaded surfaces, highlights, bubbles and steam ----------
     t[0] is the thin darker line where the liquid meets the pot wall; t[1..4] run from the shaded rim to the lit middle.
     Light comes from the upper left (the lanterns), so highlights sit up-left of centre. */
  const LIQ = {
    pork:    { t: ['#6e5236', '#a2805a', '#c0a074', '#d6ba8e', '#e4cca2'], hi: '#f8ecd2', look: 'cloudy' },   // opaque, warm beige, fat droplets
    chicken: { t: ['#7e5a1c', '#b0822a', '#cc9e3c', '#e0b652', '#ecc86a'], hi: '#fff4c4', look: 'clear' },
    dashi:   { t: ['#56391c', '#826038', '#a07c4c', '#b69462', '#c8a878'], hi: '#f6e2b0', look: 'clear' },
    miso:    { t: ['#664024', '#885e38', '#9c7046', '#ac8052', '#b88c5e'], hi: null, look: 'matte' },        // thick, matte, no sharp glints
    shoyu:   { t: ['#120604', '#22100a', '#30180e', '#3c2014', '#48281a'], hi: '#c89a78', look: 'glossy' },
    shio:    { t: ['#928670', '#b0a48a', '#c6baa0', '#d6ccb4', '#e2dac6'], hi: '#ffffff', look: 'clear' },
    dragon:  { t: ['#4a0e0a', '#6e1a12', '#8e2a1a', '#a83a22', '#c04a2a'], hi: '#ffb070', look: 'glossy' },                // deep red-amber, a fiery shimmer
    spirit:  { t: ['#7a8a80', '#9aaa9e', '#b4c4b8', '#c8d6cc', '#dce8e0'], hi: '#ffffff', look: 'clear', sparks: true },   // pale, with sparks drifting in it
    water:   { t: ['#304a56', '#4a6874', '#668692', '#82a0aa', '#9cb8c0'], hi: '#eef8fa', look: 'boil' }      // clear blue-grey, foamy middle
  };
  const BAYER = [[0, 2], [3, 1]];
  const surfCache = {};
  function surface(key, rx, ry) {   // the static shaded surface, cached per liquid and size (no outline: the pot rim is the edge)
    const id = key + rx + 'x' + ry; if (surfCache[id]) return surfCache[id];
    const L = LIQ[key], c = mk(2 * rx + 1, 2 * ry + 1), g = c.getContext('2d');
    const inside = (x, y) => (x / (rx + 0.5)) ** 2 + (y / (ry + 0.5)) ** 2 <= 1;
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      if (!inside(x, y)) continue;
      let col;
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) col = L.t[0];
      else {
        const dx = x / rx, dy = y / ry, d = Math.sqrt(dx * dx + dy * dy);
        let v = 1 - d - (dy < 0 ? -dy * 0.22 : 0);                    // the far wall shades the back of the surface more
        if (L.look === 'boil') v += Math.max(0, 0.35 - d) * 0.8;       // lighter, foamy middle
        const b = (BAYER[(y + ry) & 1][(x + rx) & 1] + 0.5) / 4 - 0.5;
        col = L.t[1 + Math.max(0, Math.min(3, Math.floor(v * 3.4 + b * 0.7)))];
      }
      g.fillStyle = col; g.fillRect(x + rx, y + ry, 1, 1);
    }
    if (L.look === 'matte') for (let k = 0; k < 10; k++) {   // a little body texture, no shine
      const a = rnd(k * 5 + 1) * Math.PI * 2, r = Math.sqrt(rnd(k * 9 + 2)) * 0.6;
      g.fillStyle = k % 2 ? L.t[2] : L.t[4]; g.fillRect(Math.round(rx + Math.cos(a) * r * rx), Math.round(ry + Math.sin(a) * r * ry), 2, 1);
    }
    return (surfCache[id] = c);
  }
  // A point inside the surface from two 0..1 numbers (kept away from the edge by m).
  const spot = (cx, cy, rx, ry, u, v, m = 0.75) => { const a = u * Math.PI * 2, r = Math.sqrt(v) * m; return [Math.round(cx + Math.cos(a) * r * rx), Math.round(cy + Math.sin(a) * r * ry)]; };
  // boil: 0 still (crocks), 1 gentle simmer (pots over the fire), 2 rolling boil (the noodle boiler)
  function liquid(g, key, cx, cy, rx, ry, t, boil, seed = 0) {
    const L = LIQ[key];
    g.drawImage(surface(key, rx, ry), cx - rx, cy - ry);
    const fr = Math.floor(t * 2.6 + seed) % 4;                      // slow 4-frame shimmer
    if (L.look === 'cloudy') {                                       // fat droplets drifting on the broth, catching the light
      for (let k = 0; k < 6; k++) {
        const [x, y] = spot(cx, cy, rx, ry, rnd(seed * 17 + k * 3), rnd(seed * 23 + k * 7), 0.7);
        const xx = x + Math.round(Math.sin(t * 0.35 + k * 1.7) * 1.5);
        rect(g, xx, y, k % 3 ? 2 : 3, 1, L.t[4]); if ((k + fr) % 3 !== 0) dot(g, xx, y, L.hi);
      }
    }
    if (L.hi && L.look !== 'cloudy') {                                // a short curved streak up-left, and a couple of bright pixels
      const sx = Math.round(cx - rx * 0.42) + (fr === 1 || fr === 3 ? 1 : 0), sy = Math.round(cy - ry * 0.4), n = fr === 2 ? 3 : 5;
      for (let i = 0; i < n; i++) dot(g, sx + i, sy + (i === 0 || i === n - 1 ? 1 : 0), i === 2 ? L.hi : mix(L.hi, L.t[4], 0.35));
      if (fr < 2) { dot(g, Math.round(cx - rx * 0.12), Math.round(cy - ry * 0.62), L.hi); dot(g, Math.round(cx - rx * 0.12) + 2, Math.round(cy - ry * 0.62), mix(L.hi, L.t[4], 0.5)); }
    } else if (L.look === 'cloudy') {                                 // a soft, wide sheen on the opaque broth
      const sx = Math.round(cx - rx * 0.4), sy = Math.round(cy - ry * 0.42);
      rect(g, sx + (fr & 1), sy, 4, 1, mix(L.hi, L.t[4], 0.5)); if (fr !== 2) dot(g, sx + 1 + (fr & 1), sy, L.hi);
    }
    if (L.sparks) for (let k = 0; k < 5; k++) {                       // spirit dashi: little sparks drifting over the surface
      const [x, y] = spot(cx, cy, rx, ry, (rnd(seed * 7 + k) + t * 0.05 * (k % 2 ? 1 : -1) + 1) % 1, rnd(seed * 11 + k * 3), 0.7);
      if ((Math.floor(t * 3) + k) % 3) dot(g, x, y - Math.round(Math.sin(t * 2 + k) * 1.5), k % 2 ? '#bff6ff' : '#fff6c8');
    }
    if (boil === 2) {                                                 // foam churning in the middle
      const ff = Math.floor(t * 9);
      for (let k = 0; k < 14; k++) { const [x, y] = spot(cx, cy, rx, ry, rnd(ff * 31 + k * 5), rnd(ff * 17 + k * 11), 0.32); rect(g, x, y, k % 3 ? 1 : 2, 1, k % 2 ? '#d6e6ea' : '#f4fbfc'); }
    }
    if (boil) {                                                       // bubbles rise, swell and pop, then appear somewhere new
      const nB = boil === 2 ? 16 : 2, rate = boil === 2 ? 1.6 : 0.32, m = boil === 2 ? 0.8 : 0.6;
      for (let k = 0; k < nB; k++) {
        const cyc = t * rate * (0.8 + rnd(k * 3 + seed) * 0.4) + k * 0.618 + seed, n = Math.floor(cyc), p = cyc - n;
        const [x, y] = spot(cx, cy, rx, ry, rnd(n * 13 + k * 7 + seed), rnd(n * 29 + k * 3 + seed), m);
        if (p < 0.72) {
          const r = p < 0.3 ? 1 : 2, lite = boil === 2 ? '#c4dce2' : L.t[4];
          rect(g, x - r + 1, y, 2 * r - 1 || 1, 1, lite); dot(g, x - r + 1, y - (r > 1 ? 1 : 0), boil === 2 ? '#ffffff' : mix(L.hi || L.t[4], L.t[4], 0.4));
          if (r > 1) dot(g, x + r - 1, y + 1, L.t[1]);
        } else if (p < 0.84) {                                        // pop: a tiny ring for a frame or two
          const c = boil === 2 ? '#e6f4f6' : L.t[4];
          dot(g, x - 2, y, c); dot(g, x + 2, y, c); dot(g, x, y - 1, c); dot(g, x, y + 1, c);
        }
      }
    }
  }
  // A small ripple ring where something breaks the surface; it slowly breathes.
  function ripple(g, x, y, t, seed, lite, dark) {
    const r = 3 + Math.round((Math.sin(t * 2.4 + seed) + 1) * 0.8);
    for (let a = 0; a < 12; a++) { const th = a / 12 * Math.PI * 2; dot(g, Math.round(x + Math.cos(th) * r), Math.round(y + Math.sin(th) * r * 0.4), th > Math.PI ? lite : dark); }
  }
  // Steam wisps: thin trails that rise, sway and fade as they climb.
  function steam(g, cx, y0, spread, t, n, a = 0.5, h = 60, seed = 0) {
    for (let k = 0; k < n; k++) {
      const p = (t * (0.22 + rnd(seed + k) * 0.1) + k / n + rnd(seed * 7 + k)) % 1;
      const ox = (rnd(seed * 3 + k * 5) - 0.5) * 2 * spread;
      for (let j = 0; j < 4; j++) {
        const q = p - j * 0.035; if (q <= 0) continue;
        const y = Math.round(y0 - q * h), x = Math.round(cx + ox + Math.sin(t * 1.4 + k * 2.1 + q * 5) * 5 * q);
        g.globalAlpha = a * (1 - q) * Math.min(1, q / 0.12) * (1 - j * 0.22);
        rect(g, x, y, j ? 1 : 2, 2, '#f4f0ea');
      }
    }
    g.globalAlpha = 1;
  }
  // A lacquered serving tray seen from slightly above: a red-black rim, a darker inner floor, a lit near edge.
  function tray(g, cx, cy, w, h) {
    const x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
    rect(g, x + 3, y + h, w - 6, 3, 'rgba(30,14,10,0.35)');
    rect(g, x, y, w, h, DK); rect(g, x + 1, y + 1, w - 2, h - 2, '#7a2018'); rect(g, x + 1, y + 1, w - 2, 2, '#a83a2a');
    rect(g, x + 6, y + 6, w - 12, h - 12, '#3a1210'); rect(g, x + 6, y + 6, w - 12, 2, '#2a0c0a'); rect(g, x + 6, y + h - 8, w - 12, 2, '#5a1c16');
    rect(g, x + 1, y + h - 4, w - 2, 3, '#5a1410'); rect(g, x + 1, y + h - 4, w - 2, 1, '#c8503a');
    for (const hx of [x + 4, x + w - 14]) rect(g, hx, y + 2, 10, 2, '#d8a050');   // gold-leaf corners
  }
  const bar = (g, x, y, w, p, c) => { const f = Math.round(w * Math.max(0, Math.min(1, p))); rect(g, x - 1, y - 1, w + 2, 8, DK); rect(g, x, y, w, 6, '#4a3f4a'); rect(g, x, y, f, 6, c); rect(g, x, y, f, 2, shade(c, 1.3)); };
  const plus = (g, x, y) => { ell(g, x, y + 1, 10, 10, 'rgba(20,8,12,0.4)'); ell(g, x, y, 10, 10, DK); ell(g, x, y, 9, 9, '#3d8a3a'); ell(g, x - 1, y - 1, 8, 8, '#6fbf4a'); rect(g, x - 5, y - 1, 11, 3, '#ffffff'); rect(g, x - 1, y - 5, 3, 11, '#ffffff'); };
  function badge() {}   // (restocking happens at Kitsune-ya now: no buttons in the kitchen)
  const countC = n => n > 2 ? '#4a3226' : '#c8302a';
  const held = (G, kind, type) => G.drag && G.drag.kind === kind && G.drag.type === type;
  const plate = (g, s, cx, y, c) => tag(g, s, cx, y, c, 8, 40);
  const chip = SCENE.chip;

  /* ---------- tools (also drawn at the cursor while dragging) ---------- */
  // Hinoki spoon for tare: a pale wooden bowl and handle with a lacquered tip.
  function spoon(g, x, y, full, c = ART.TARE) {
    line(g, x + 4, y - 4, x + 18, y - 32, DK, 5); line(g, x + 5, y - 4, x + 19, y - 32, '#d8b07a', 3); line(g, x + 5, y - 5, x + 19, y - 33, '#f2d6a2', 1);
    line(g, x + 16, y - 27, x + 18, y - 32, '#7a1e18', 3);
    ell(g, x, y, 9, 6, DK); ell(g, x, y, 8, 5, '#d8b07a'); ell(g, x - 1, y - 1, 6, 3, '#b8864e');
    if (full) { ell(g, x, y - 1, 6, 4, c); ell(g, x - 2, y - 2, 2, 1, shade(c, 1.4)); }
  }
  // Copper ladle on a wooden handle.
  function ladle(g, x, y, full, t, pal = [ART.BROTH, ART.BROTH2, ART.BROTH3]) {
    line(g, x + 6, y - 4, x + 14, y - 18, DK, 4); line(g, x + 7, y - 4, x + 15, y - 18, PAL.copper, 2);
    line(g, x + 14, y - 18, x + 30, y - 46, DK, 5); line(g, x + 15, y - 18, x + 31, y - 46, '#9a6a3a', 3); line(g, x + 15, y - 19, x + 31, y - 47, '#c08a52', 1);
    ell(g, x, y, 15, 9, DK); ell(g, x, y, 14, 8, PAL.copper); ell(g, x - 3, y - 2, 8, 3, PAL.copperHi); ell(g, x + 6, y + 3, 6, 3, PAL.copperLo);
    if (full) { ell(g, x, y - 1, 12, 6, pal[0]); ell(g, x - 4, y - 3, 4, 1, pal[2]); if (Math.sin(t * 12) > 0) rect(g, x + 3, y + 9, 2, 4, pal[0]); }
    else ell(g, x, y - 1, 12, 6, PAL.copperDk);
  }
  // Tebo noodle basket: woven mesh, a brass rim and a wooden handle.
  function basket(g, x, y, noodles, wet, t) {
    line(g, x + 12, y - 4, x + 28, y - 42, DK, 5); line(g, x + 13, y - 4, x + 29, y - 42, '#9a6a3a', 3); line(g, x + 13, y - 5, x + 29, y - 43, '#c08a52', 1);
    lathe(g, x, [[y, 20], [y + 20, 13]], DK); lathe(g, x, [[y + 1, 19], [y + 19, 12]], '#8a7a62');
    for (let k = -15; k <= 15; k += 4) rect(g, x + k, y + 3, 1, 15 - Math.round(Math.abs(k) / 4), '#5e5246');
    for (let r = 5; r < 19; r += 4) rect(g, x - 18 + Math.round(r / 3), y + r, 36 - Math.round(r / 1.5), 1, '#5e5246');
    ell(g, x, y, 21, 8, DK); ell(g, x, y, 20, 7, PAL.brass); ell(g, x, y, 18, 5, '#4a4038'); rect(g, x - 14, y - 6, 10, 1, PAL.brassHi);
    if (noodles) { ell(g, x, y, 15, 4, '#d8bd6a'); ell(g, x - 1, y - 1, 13, 3, '#f6e19a'); for (let k = -12; k <= 12; k += 3) dot(g, x + k, y + Math.round(Math.sin(k) * 1.5), '#c9a856'); }
    if (wet) for (let k = 0; k < 3; k++) { const dy = ((t * 60 + k * 9) % 26); rect(g, x - 8 + k * 8, y + 20 + dy, 2, 4, '#9fd2e6'); }
  }

  // Noodles hanging from a grip at (x, y): some loose ends, some loops draped between two points.
  // swing (-1..1) makes them trail behind the hand; they wave and lag so the bundle feels heavy and wet.
  function dangle(g, x, y, ends, loops, spread, len, t, swing, pal, drip) {
    const paths = [], r = k => ((k * 0.6180339) % 1);
    for (let j = 0; j < loops; j++) {
      const x1 = x - spread / 2 + Math.round(r(j + 3) * spread * 0.6), w = 10 + Math.round(r(j + 7) * 8), d = Math.round(len * (0.22 + r(j + 1) * 0.25)), pts = [];
      const N = w + 2 * d;
      for (let k = 0; k <= N; k++) {
        const s = k / N, sag = Math.sin(s * Math.PI);
        pts.push([Math.round(x1 + w * s + swing * d * sag * 0.9 + Math.sin(t * 4 + j) * sag), Math.round(y + d * sag * (1 - Math.abs(swing) * 0.2))]);
      }
      paths.push({ pts, loop: true });
    }
    for (let i = 0; i < ends; i++) {
      const u = ends > 1 ? i / (ends - 1) - 0.5 : 0, ox = x + Math.round(u * spread), L = Math.round(len * (0.55 + r(i + 11) * 0.65)), pts = [];
      for (let k = 0; k <= L; k++) {
        const q = k / L;
        pts.push([Math.round(ox + u * k * 0.3 + swing * k * (0.55 + 0.45 * q) + Math.sin(k * 0.2 + t * 4.5 + i * 1.9) * 1.4 * q), y + Math.round(k * (1 - Math.abs(swing) * 0.25))]);
      }
      paths.push({ pts, tip: true });
    }
    // outline pass first, so overlapping strands read as one bundle; then the strands themselves
    for (const P of paths) { for (const [px, py] of P.pts) P.loop ? rect(g, px - 1, py - 1, 4, 3, DK) : (dot(g, px - 1, py, DK), dot(g, px + 2, py, DK)); if (P.tip) { const [px, py] = P.pts[P.pts.length - 1]; rect(g, px - 1, py + 1, 4, 1, DK); } }
    for (const P of paths) P.pts.forEach(([px, py], k) => { dot(g, px, py, k % 7 === 2 ? pal[0] : pal[1]); dot(g, px + 1, py, pal[2]); });
    if (drip) paths.forEach((P, i) => { if (!P.tip || i % 2) return; const [px, py] = P.pts[P.pts.length - 1], dd = (t * 55 + i * 13) % 20; rect(g, px, py + 3 + Math.round(dd), 1, 2, '#9fd2e6'); });
  }
  // A raw nest held in the hand: a pinched bundle on top, loose strands hanging below.
  function heldNest(g, x, y, t, swing) {
    dangle(g, x, y + 3, 5, 2, 16, 24, t, swing, ART.RAW, false);
    ell(g, x, y, 11, 6, DK); ART.pile(g, x, y, 10, 5, 0, 5, ART.RAW);
  }
  // The READY basket in the hand: cooked noodles drape over the front of the rim and drip.
  function heldBasket(g, x, y, t, swing) {
    basket(g, x, y, true, true, t);
    dangle(g, x - 1, y + 2, 6, 2, 28, 22, t, swing, ART.COOKED, true);
  }



  /* ---------- living details ---------- */
  function fire(g, cx, by, w, h, t, seed) {   // stepped flame tongues rising from by
    for (let k = 0; k < 6; k++) {
      const fx = cx - w / 2 + 2 + Math.round(k * (w - 4) / 5), fh = Math.round(h * (0.45 + 0.55 * Math.abs(Math.sin(t * 7 + k * 1.9 + seed))));
      rect(g, fx - 2, by - fh, 5, fh, '#e8541e'); rect(g, fx - 1, by - Math.round(fh * 0.75), 3, Math.round(fh * 0.75), '#ffa030');
      rect(g, fx, by - Math.round(fh * 0.4), 1, Math.round(fh * 0.4), '#fff0a0');
    }
    rect(g, cx - w / 2, by - 2, w, 2, '#ffcf60');
  }
  function glow(g, cx, cy, rx, ry, t, seed, a = 0.08) {
    const f = 0.8 + 0.2 * Math.sin(t * 9 + seed) * Math.sin(t * 5.3 + seed * 2);
    pool(g, cx, cy, rx, ry, '#ffb050', a * f, 4);
  }
  function maneki(g, x, by, t) {   // beckoning cat on the bowl shelf; the raised paw waves
    const wave = Math.round((Math.sin(t * 3) + 1) * 1.5);
    ell(g, x, by - 9, 9, 9, DK); ell(g, x, by - 9, 8, 8, '#fbf6ea');
    ell(g, x, by - 22, 8, 7, DK); ell(g, x, by - 22, 7, 6, '#fbf6ea');
    poly(g, [[x - 7, by - 26], [x - 6, by - 33], [x - 2, by - 28]], DK); poly(g, [[x + 7, by - 26], [x + 6, by - 33], [x + 2, by - 28]], DK);
    dot(g, x - 6, by - 29, '#e8a0a0'); dot(g, x + 6, by - 29, '#e8a0a0');
    rect(g, x - 4, by - 23, 2, 1, DK); rect(g, x + 3, by - 23, 2, 1, DK); dot(g, x, by - 20, '#e87a7a');
    rect(g, x - 7, by - 16, 15, 2, '#c8302a'); ell(g, x, by - 13, 2, 2, DK); dot(g, x, by - 13, '#ffd76a');
    rect(g, x + 7, by - 20 - wave, 5, 9, DK); rect(g, x + 8, by - 19 - wave, 3, 7, '#fbf6ea');           // waving paw
    ell(g, x - 3, by - 6, 3, 2, '#f0e6d4'); ell(g, x + 4, by - 3, 2, 1, '#e8a040');
  }

  function drawNoodles(g, G) {
    const N = KL.NOODLE, n = G.stock.noodle;
    rect(g, N.x - 1, N.y - 1, N.w + 2, N.h + 2, DK); wood(g, N.x, N.y, N.w, N.h, '#b58148', 10, false, 321);
    rect(g, N.x, N.y, N.w, 1, '#e6b878');
    rect(g, N.x + 4, N.y + 4, N.w - 8, N.h - 8, DK); rect(g, N.x + 5, N.y + 5, N.w - 10, N.h - 10, '#e9cf9c');
    const shown = Math.min(6, Math.ceil(n / 2));
    for (let k = 0; k < shown; k++) ART.top(g, 'noodle', N.x + 20 + (k % 3) * 26, N.y + 14 + Math.floor(k / 3) * 12, 0.8);
    label(g, 'NOODLES', N.x + N.w / 2, N.y - 22);
    chip(g, n, N.x + 16, N.y + N.h - 8);
    badge(g, G, 'noodle');
  }

  function drawBoiler(g, G) {
    const B = KL.BOIL, cx = B.cx, cy = B.cy, rx = B.rx;
    // stone base with a fire mouth, copper-banded tank on top
    rect(g, cx - rx - 6, cy + 106, 2 * rx + 13, 47, DK); rect(g, cx - rx - 5, cy + 107, 2 * rx + 11, 45, C.stone);
    for (let y = cy + 107; y < cy + 152; y += 11) for (let x = cx - rx - 5 + ((y / 11) % 2) * 9; x < cx + rx + 6; x += 18) { rect(g, x, y, 1, 10, C.stoneLo); rect(g, x + 1, y, 1, 10, C.stoneHi); }
    rect(g, cx - rx - 5, cy + 107, 2 * rx + 11, 2, C.stoneHi);
    rect(g, cx - 24, cy + 118, 48, 30, DK); ell(g, cx, cy + 118, 24, 8, DK); rect(g, cx - 22, cy + 118, 44, 29, '#1a0e0c'); ell(g, cx, cy + 118, 22, 6, '#1a0e0c');
    fire(g, cx, cy + 146, 40, 22, G.t, 3);
    glow(g, cx, cy + 156, 60, 12, G.t, 3, 0.1);
    cyl(g, cx, cy, rx, 108, COPPER);
    for (const by of [cy + 12, cy + 96]) { rect(g, cx - rx, by, 2 * rx + 1, 4, C.copperDk); rect(g, cx - rx, by, 2 * rx + 1, 1, C.copperHi); }
    for (let x = cx - rx + 8; x < cx + rx; x += 14) { dot(g, x, cy + 14, C.copperHi); dot(g, x, cy + 98, C.copperHi); }
    label(g, 'BOILER', cx, cy + 50);
    ell(g, cx, cy, rx + 1, 19, DK); ell(g, cx, cy, rx, 18, C.copperHi); ell(g, cx, cy + 1, rx - 3, 15, C.copperLo);
    ell(g, cx, cy + 1, rx - 3, 15, '#5a2a14');                                     // the inner wall, in shadow
    liquid(g, 'water', cx, cy + 2, rx - 5, 12, G.t, 2, 5);
    KL.basketX.forEach((bx, j) => {
      const b = G.baskets[j];
      if (G.drag && G.drag.kind === 'basket' && G.drag.j === j) return;   // lifted out: just water
      const by = cy + 1;
      // the basket sits under the surface: its rim and mesh show through the water, tinted by it
      if (b.t >= 0) {   // the noodle nest, seen through the water
        const ready = b.t >= cookTime(), c = mix(ready ? '#f6e19a' : '#fff3c9', '#82a0aa', 0.45), cd = shade(c, 0.86);
        for (let r = -2; r <= 2; r++) { const w = 11 - Math.abs(r) * 2; rect(g, bx - w, by + r, 2 * w, 1, (r + j) & 1 ? c : cd); }
      }
      for (let a = 0; a < 64; a++) { const th = a / 64 * Math.PI * 2; if (th < Math.PI) continue; dot(g, Math.round(bx + Math.cos(th) * 17), Math.round(by + Math.sin(th) * 5), '#7c8a6a'); }   // far side of the rim, just under the surface
      // the handle rises out of the water, with a small ripple ring where it breaks the surface
      const hx = bx + 14, hy = by - 3;
      ripple(g, hx, hy, G.t, j * 2, '#a6c0c8', '#d6e6ea');
      line(g, hx, hy, bx + 28, by - 44, DK, 5); line(g, hx + 1, hy, bx + 29, by - 44, '#9a6a3a', 3); line(g, hx + 1, hy - 1, bx + 29, by - 45, '#c08a52', 1);
      if (b.t >= 0) {
        const ready = b.t >= cookTime();
        if (ready) {
          const yy = cy - 70 - (j % 2) * 22 + Math.round(Math.sin(G.t * 4 + j) * 3);
          rect(g, bx - 33, yy - 1, 66, 18, DK); rect(g, bx - 32, yy, 64, 16, '#3d8a3a'); rect(g, bx - 32, yy, 64, 2, '#8fd86a');
          textC(g, 'READY', bx + 1, yy + 3, '#ffffff');
          poly(g, [[bx - 5, yy + 17], [bx + 6, yy + 17], [bx + 0.5, yy + 22]], DK);
        } else bar(g, bx - 20, cy - 62 - (j % 2) * 12, 40, b.t / cookTime(), '#f2a22a');
      }
    });
    steam(g, cx, cy - 6, rx - 16, G.t, 9, 0.55, 74, 3);   // a rolling boil: plenty of steam
  }

  // Copper stock pots on the brick hearth, one per BROTH_SLOTS entry. A locked slot has a lidded pot over a cold mouth.
  function drawPots(g, G) {
    BROTH_SLOTS.forEach((kind, i) => {
      const P = KL.pot(i), cx = P.cx, cy = P.cy, rx = P.rx, def = kind && BROTHS[kind], id = kind && brothKey(kind), n = kind ? G.stock[id] : 0;
      const my = HEARTH.y + 26;
      if (def && brothOn(kind)) { fire(g, cx, my + 34, 24, 22, G.t, i * 2.1); glow(g, cx, HEARTH.y1 + 6, 28, 9, G.t, i, 0.12); }
      else for (let k = -12; k <= 12; k += 5) rect(g, cx + k, my + 31, 3, 2, '#4a3a36');
      for (const s of [-1, 1]) { rect(g, cx + s * (rx + 5) - 4, cy + 12, 9, 12, DK); rect(g, cx + s * (rx + 5) - 3, cy + 13, 7, 10, C.iron); rect(g, cx + s * (rx + 5) - 3, cy + 13, 7, 2, C.ironHi); }
      cyl(g, cx, cy, rx, 56, COPPER);
      rect(g, cx - rx, cy + 46, 2 * rx + 1, 3, C.copperDk); rect(g, cx - rx, cy + 46, 2 * rx + 1, 1, C.copperHi);
      if (!def || !brothOn(kind)) {
        ell(g, cx, cy, rx + 2, 11, DK); ell(g, cx, cy, rx + 1, 10, C.copper); ell(g, cx - 4, cy - 2, rx - 8, 6, C.copperHi);
        ell(g, cx, cy - 4, 6, 3, DK); ell(g, cx, cy - 5, 5, 2, C.iron);
        lock(g, cx, cy + 24);
        return;
      }
      ell(g, cx, cy, rx + 1, 12, DK); ell(g, cx, cy, rx, 11, C.copperHi); ell(g, cx, cy + 1, rx - 4, 8, '#5a2a14');
      if (n > 0) { liquid(g, kind, cx, cy + 2, rx - 5, 6, G.t, 1, i * 3 + 1); steam(g, cx, cy - 4, Math.max(4, rx - 12), G.t, 3, 0.35, 48, i * 11 + 2); }
      if (n > 0 && kind === 'spirit') pool(g, cx, cy - 4, rx + 10, 16, '#c8f4ff', 0.06 + 0.04 * Math.sin(G.t * 2), 3);
      else ell(g, cx, cy + 2, rx - 5, 6, '#3a2a22');
      if (!held(G, 'broth', kind)) {
        const L = LIQ[kind] || LIQ.pork, hx = cx + Math.round(rx * 0.4), hy = cy + 1;
        if (n > 0) ripple(g, hx, hy, G.t, i, L.t[3], L.t[4]);
        const ex = cx + Math.round(rx * 0.75), tx = cx + Math.round(rx * 1.3);
        line(g, hx, hy, ex, cy - 16, DK, 4); line(g, hx + 1, hy, ex + 1, cy - 16, PAL.copper, 2);
        line(g, ex, cy - 16, tx, cy - 40, DK, 5); line(g, ex + 1, cy - 16, tx + 1, cy - 40, '#9a6a3a', 3); line(g, ex + 1, cy - 17, tx + 1, cy - 41, '#c08a52', 1);
      }
      PX.setFont(1); tag(g, def.short, cx, cy + 18, undefined, 6, 2 * rx - 2); PX.setFont(2);
      chip(g, n, cx, cy + 37);
      badge(g, G, id);
    });
  }

  // The chili oil bottle: a tall red glass bottle with a cork and a paper label (x = centre, by = bottom).
  function oilBottle(g, x, by, w = 10, held) {
    const h = Math.round(w * 3.6);
    rect(g, x - w - 1, by - h - 1, 2 * w + 2, h + 2, DK); rect(g, x - w, by - h, 2 * w, h, '#a8241e'); rect(g, x - w, by - h, 3, h, '#e85a4a'); rect(g, x + w - 4, by - h, 4, h, '#6e1410');
    rect(g, x - 4, by - h - 9, 9, 10, DK); rect(g, x - 3, by - h - 8, 7, 8, '#c8402a'); rect(g, x - 4, by - h - 13, 9, 5, DK); rect(g, x - 3, by - h - 12, 7, 3, '#b8864e');
    rect(g, x - w, by - Math.round(h * 0.62), 2 * w, Math.round(h * 0.32), '#f1e2bf'); rect(g, x - w, by - Math.round(h * 0.62), 2 * w, 1, '#ffffff');
    for (const k of [-4, 0, 4]) { line(g, x + k, by - Math.round(h * 0.36), x + k + 2, by - Math.round(h * 0.56), '#c8302a', 1); }
    if (held) for (let k = 0; k < 2; k++) rect(g, x - 1, by - h - 14 - k * 3, 2, 2, '#d8402a');
  }
  function drawOil(g, G) {
    if (!chiliOilOn()) return;
    const O = KL.OIL, n = G.stock[CHILI_OIL] || 0;
    contact(g, O.cx, O.by + 2, 16, 3);
    if (!(G.drag && G.drag.kind === 'oil')) oilBottle(g, O.cx, O.by, 10);
    label(g, 'CHILI OIL', O.cx, O.by - 64);
    chip(g, n, O.cx + 24, O.by - 24);
  }

  /* The ice bath (once a cold recipe is learned): a hinoki tub of ice water on the counter. Chilled nests wait in it
     (G.ice, two at most) until they go into a bowl. */
  function drawIce(g, G) {
    if (!iceOn()) return;
    const I = KL.ICE, cx = I.cx, cy = I.cy, rx = I.rx;
    contact(g, cx, cy + 40, rx + 6, 5);
    lathe(g, cx, [[cy, rx + 1], [cy + 36, rx - 5]], DK); lathe(g, cx, [[cy + 1, rx], [cy + 35, rx - 6]], '#c8925a');
    for (let k = -rx + 6; k < rx - 4; k += 8) rect(g, cx + k, cy + 3, 1, 31, '#a8723a');
    rect(g, cx - rx + 2, cy + 4, 4, 28, '#e8b880');
    for (const hy of [cy + 9, cy + 27]) { rect(g, cx - rx, hy, 2 * rx + 1, 3, DK); rect(g, cx - rx + 1, hy, 2 * rx - 1, 1, PAL.brass); }
    ell(g, cx, cy, rx + 1, 10, DK); ell(g, cx, cy, rx, 9, '#e8b880'); ell(g, cx, cy + 1, rx - 4, 7, '#7a5232');
    liquid(g, 'water', cx, cy + 1, rx - 6, 6, G.t * 0.4, 0, 9);
    for (const [ox, oy, w] of [[-22, -1, 7], [16, 2, 6], [-4, 4, 5], [26, -2, 5], [-30, 3, 4]]) {   // ice cubes bobbing
      const by = cy + oy + Math.round(Math.sin(G.t * 1.6 + ox) * 0.8);
      rect(g, cx + ox - 1, by - 1, w + 2, w, DK); rect(g, cx + ox, by, w, w - 2, '#e8fbff'); rect(g, cx + ox, by, w, 1, '#ffffff'); rect(g, cx + ox + w - 2, by + 1, 2, w - 3, '#b8e4f4');
    }
    for (let k = 0; k < G.ice; k++) { const nx = cx - 12 + k * 22; ell(g, nx, cy + 1, 10, 4, '#7aa8b8'); ART.pile(g, nx, cy, 9, 3, G.t * 0.3, 3, ['#ffffff', '#e8f0e0', '#9ab8c0', '#b8d0d0']); }
    if (G.ice > 0 && Math.sin(G.t * 3) > 0) for (let k = 0; k < 3; k++) dot(g, cx - 30 + k * 30, cy - 12 - (k % 2) * 3, '#e8fbff');   // a cold sparkle
    label(g, 'ICE BATH', cx, cy + 46);
    if (G.ice > 0) chip(g, G.ice, cx + rx + 4, cy - 14);
  }

  // Glazed tare crocks, one per TARE_SLOTS entry. A locked slot is wrapped in indigo cloth.
  function drawTares(g, G) {
    TARE_SLOTS.forEach((kind, i) => {
      const T = KL.tare(i), cx = T.cx, y = T.y, def = kind && TARES[kind], id = kind && tareKey(kind), n = kind ? G.stock[id] : 0;
      lathe(g, cx, [[y + 4, 15], [y + 14, 21], [y + 44, 21], [y + 52, 15]], DK);
      lathe(g, cx, [[y + 5, 14], [y + 14, 20], [y + 44, 20], [y + 51, 14]], '#6a3a24');
      lathe(g, cx + 8, [[y + 8, 4], [y + 14, 7], [y + 44, 7], [y + 50, 4]], '#4a2618');
      lathe(g, cx, [[y + 5, 14], [y + 13, 20], [y + 17, 20]], '#e8dcc0');                       // cream drip glaze
      for (const [dx, dl] of [[-14, 6], [-7, 9], [0, 5], [6, 8], [13, 4]]) rect(g, cx + dx, y + 17, 3, dl, '#e8dcc0');
      rect(g, cx - 15, y + 20, 2, 18, '#9a6a4a');
      if (!def || !tareOn(kind)) {   // locked: wrapped in cloth, tied with string, padlocked
        lathe(g, cx, [[y - 4, 10], [y + 4, 22], [y + 22, 23]], DK);
        lathe(g, cx, [[y - 3, 9], [y + 4, 21], [y + 21, 22]], C.indigo);
        for (const dx of [-12, -4, 6, 14]) line(g, cx + dx, y + 2, cx + dx * 1.15, y + 20, C.indigoLo, 1);
        rect(g, cx - 21, y + 14, 43, 2, '#c9a468');
        lock(g, cx, y + 28);
        return;
      }
      ell(g, cx, y + 4, 15, 5, DK); ell(g, cx, y + 4, 14, 4, '#3a2016');
      if (n > 0) liquid(g, kind, cx, y + 5, 12, 3, G.t, 0, i * 5 + 7); else ell(g, cx, y + 5, 12, 3, '#2a1a12');
      if (!held(G, 'tare', kind)) {   // the wooden spoon stands in the tare: only its handle shows
        const L = LIQ[kind], hx = cx + 6, hy = y + 4;
        if (n > 0) { if (L.look === 'matte') { dot(g, hx - 2, hy + 1, L.t[1]); dot(g, hx + 2, hy + 1, L.t[4]); } else ripple(g, hx, hy + 1, G.t, i * 3, L.t[3], L.t[4]); }
        line(g, hx, hy, cx + 22, y - 28, DK, 5); line(g, hx + 1, hy, cx + 23, y - 28, '#d8b07a', 3); line(g, hx + 1, hy - 1, cx + 23, y - 29, '#f2d6a2', 1);
        line(g, cx + 20, y - 23, cx + 22, y - 28, '#7a1e18', 3);
      }
      chip(g, n, cx, y + 26);
      plate(g, def.short, cx, y + 62);
      badge(g, G, id);
    });
  }

  function drawBook(g, G) {
    const B = KL.BOOK, x = B.x, dt = G.t - (G.bookPut == null ? -9 : G.bookPut);
    rect(g, x + 46, B.y + 60, 24, 16, DK); wood(g, x + 47, B.y + 61, 22, 14, '#6b4a34', 14, false, 9);
    if (G.bookOut) { label(g, 'RECIPES', x + B.w / 2, B.y + 80); return; }   // picked up: only the stand is left
    const y = B.y - (dt < 0.6 ? Math.round(Math.abs(Math.sin(dt * 15)) * Math.exp(-dt * 7) * 5) : 0);
    // The cookbook itself, lying open at the Miso Ramen spread: the same red leather, bookmark tabs, cream pages and
    // printed layout as the book that opens (a framed ink figure, not an in-game bowl).
    const M = x + B.w / 2, INK = '#4a3226', RED = '#a8302a', RULE = '#d8c4a0';
    // the bookmark tabs peeking out of the top and the right edge, behind the pages
    [['#8a5a32', 14], ['#c8443a', 26], ['#e8902a', 38], ['#6a8a3a', 50], ['#2f8a5a', 62], ['#8a4ab0', 74]].forEach(([c, tx]) => { rect(g, x + tx - 1, y - 6, 10, 8, DK); rect(g, x + tx, y - 5, 8, 7, c); });
    [['#3a7ab0', 8], ['#8a8a90', 20], ['#4a9a4a', 32], ['#e0802a', 44]].forEach(([c, ty]) => { rect(g, x + B.w - 4, y + ty - 1, 9, 10, DK); rect(g, x + B.w - 3, y + ty, 7, 8, c); });
    // red leather cover with gold corners, then the two pages
    poly(g, [[x - 3, y + 67], [x + B.w + 3, y + 67], [x + B.w - 5, y - 3], [x + 5, y - 3]], DK);
    poly(g, [[x - 2, y + 66], [x + B.w + 2, y + 66], [x + B.w - 6, y - 2], [x + 6, y - 2]], '#8a2a22');
    for (const [cx, cy, sx] of [[x - 1, y + 63, 1], [x + B.w - 2, y + 63, -1], [x + 6, y - 1, 1], [x + B.w - 9, y - 1, -1]]) rect(g, cx, cy, 4, 3, PAL.brass);
    poly(g, [[x + 2, y + 62], [M, y + 65], [M, y + 2], [x + 9, y + 1]], '#fbf2dc');
    poly(g, [[M, y + 65], [x + B.w - 2, y + 62], [x + B.w - 9, y + 1], [M, y + 2]], '#f6ead0');
    rect(g, M - 2, y + 2, 1, 63, '#d8c4a0'); rect(g, M - 1, y + 2, 2, 63, '#c9b48a'); rect(g, M + 1, y + 2, 1, 63, '#e0d0b0');   // the spine's shadow
    // left page: the chapter rule, the title, a small framed ink figure, the ingredient rows
    rect(g, x + 12, y + 5, 3, 3, '#d98a2b'); rect(g, x + 17, y + 6, 12, 1, '#9a7a4a'); rect(g, x + 11, y + 9, 44, 1, RULE);
    rect(g, x + 12, y + 13, 18, 2, RED); rect(g, x + 12, y + 17, 12, 2, RED);
    rect(g, x + 12, y + 22, 11, 3, '#2f7a3a'); rect(g, x + 25, y + 22, 5, 2, '#c8302a');
    { const fx = x + 34, fy = y + 11;   // the figure: a thin frame, a tiny sepia bowl in ink, a caption line
      rect(g, fx - 1, fy - 1, 22, 19, '#b8a07a'); rect(g, fx, fy, 20, 17, '#f1e4c6'); rect(g, fx + 1, fy + 1, 18, 15, '#7a6248'); rect(g, fx + 2, fy + 2, 16, 13, '#f1e4c6');
      const bx = fx + 10, by = fy + 7;
      for (let k = 0; k < 3; k++) dot(g, bx - 3 + k * 3, by - 4 + (k % 2), '#b8a890');
      lathe(g, bx, [[by, 7], [by + 5, 4]], '#3b2a22'); lathe(g, bx, [[by + 1, 6], [by + 4, 3]], '#c8806a');
      rect(g, bx - 7, by - 1, 15, 2, '#3b2a22'); rect(g, bx - 6, by - 1, 13, 1, '#d8a87a'); dot(g, bx - 3, by - 1, '#fff6e6'); dot(g, bx + 2, by - 1, '#e8b0a0');
      rect(g, fx + 5, fy + 14, 10, 1, '#9a8a70'); }
    for (let k = 0; k < 5; k++) { const ry = y + 34 + k * 6; rect(g, x + 12, ry, 3, 3, ['#93451f', '#c8792e', '#f0cc78', '#d07068', '#ec8a1c'][k]); rect(g, x + 17, ry + 1, 16 + (k * 7) % 9, 1, INK); rect(g, x + 48, ry + 1, 5, 1, '#2f7a3a'); rect(g, x + 11, ry + 4, 44, 1, RULE); }
    // right page: METHOD, the quote, the numbered red steps
    rect(g, M + 7, y + 6, 12, 1, '#9a7a4a'); rect(g, M + 7, y + 9, 44, 1, RULE);
    rect(g, M + 9, y + 13, 38, 1, '#8a7a62'); rect(g, M + 14, y + 16, 28, 1, '#8a7a62');
    rect(g, M + 7, y + 21, 14, 2, RED); rect(g, M + 7, y + 24, 44, 1, RULE);
    for (let k = 0; k < 5; k++) { const ry = y + 28 + k * 7; rect(g, M + 7, ry, 4, 4, RED); dot(g, M + 8, ry + 1, '#f6e6c0'); rect(g, M + 13, ry + 1, 20 + (k * 11) % 16, 1, INK); }
    // page numbers, and the red ribbon laid across the right page
    dot(g, x + 13, y + 61, '#9a7a4a'); dot(g, x + B.w - 13, y + 61, '#9a7a4a');
    rect(g, M + 34, y - 4, 5, 30, DK); rect(g, M + 35, y - 4, 3, 30, '#b8302a'); poly(g, [[M + 34, y + 26], [M + 39, y + 26], [M + 36.5, y + 22]], '#f6ead0');
    label(g, 'RECIPES', x + B.w / 2, B.y + 80);
  }

  function drawTrash(g) {   // a lidded wooden bucket with iron hoops
    const T = KL.TRASH, cx = T.x + 23;
    lathe(g, cx, [[T.y + 8, 22], [T.y + T.h, 18]], DK); lathe(g, cx, [[T.y + 9, 21], [T.y + T.h - 1, 17]], '#9a6a3a');
    for (let k = -15; k <= 15; k += 6) rect(g, cx + k, T.y + 10, 1, T.h - 12, '#6e4a2c');
    rect(g, cx - 18, T.y + 12, 4, T.h - 16, '#c08a52');
    for (const hy of [T.y + 18, T.y + T.h - 10]) { rect(g, cx - 21, hy, 42, 3, DK); rect(g, cx - 20, hy, 40, 1, C.ironHi); }
    rect(g, T.x - 3, T.y + 2, T.w + 6, 9, DK); wood(g, T.x - 2, T.y + 3, T.w + 4, 6, '#b58148', 6, false, 41); rect(g, T.x - 2, T.y + 3, T.w + 4, 1, '#e6b878');
    rect(g, cx - 6, T.y - 2, 12, 5, DK); rect(g, cx - 5, T.y - 1, 10, 3, '#6e4a2c');
  }

  // No step labels under the bowls: how to cook lives in the recipe book, not on the counter.
  function drawBowls(g, G) {
    KL.bowlX.forEach((bx, k) => {
      const b = G.bowls[k];
      if (b === G.dragBowl) return;
      if (k === G.activeShown) {   // the active bowl (clicks go into it): a soft warm glow on the mat and a dotted gold ring
        pool(g, bx, KL.BOWL_Y + 34, 66, 28, '#fff6c8', 0.75, 5);
        const on = Math.sin(G.t * 3) > -0.3;
        for (let a = 0; a < 64; a++) { if (a % 2) continue; const th = a / 64 * Math.PI * 2; rect(g, Math.round(bx + Math.cos(th) * 60), Math.round(KL.BOWL_Y + 36 + Math.sin(th) * 26), 2, 2, on ? '#ffd76a' : '#e0b040'); }
      }
      ART.bigBowl(g, bx + Math.round((1 - Math.min(1, b.age / 0.25)) * 40), KL.BOWL_Y, b, false, G.t);
    });
  }

  // One lacquered topping box: name on the dark rail above, food in the wooden well, count chip and "+" along the bottom.
  const PILE = [[11, 15], [23, 11], [34, 16], [16, 26], [29, 26]];
  function drawBin(g, G, k, id) {
    const b = KL.bin(k), { x, y, w, h } = b;
    if (!id) {   // a free bin: an empty lacquered well
      rect(g, x - 1, y - 1, w + 2, h + 2, DK); rect(g, x, y, w, h, C.lacquer); rect(g, x + 3, y + 3, w - 6, h - 6, DK); rect(g, x + 4, y + 4, w - 8, h - 8, '#4a2e1c');
      return;
    }
    const n = G.stock[id], job = G.jobs.find(j => j.id === id);
    PX.setFont(1); textC(g, TOP_SHORT[id], x + w / 2, y - (k % 2 ? 11 : 20), topOn(id) ? '#f6e6c0' : '#8a7a68'); PX.setFont(2);   // names alternate between two lines on the rail
    if (!topOn(id)) {
      rect(g, x - 1, y - 1, w + 2, h + 2, DK); rect(g, x, y, w, h, C.indigo);
      for (let fx = x + 8; fx < x + w; fx += 12) { rect(g, fx, y + 2, 1, h - 4, C.indigoLo); rect(g, fx + 1, y + 2, 1, h - 4, '#4a5c9a'); }
      rect(g, x, y + h - 6, w, 2, '#c9a468');
      lock(g, x + w / 2, y + h / 2 - 6);
      return;
    }
    rect(g, x - 1, y - 1, w + 2, h + 2, DK); rect(g, x, y, w, h, C.lacquer); rect(g, x, y, w, 1, '#5a3a32');
    rect(g, x + 2, y + 2, w - 4, h - 4, C.lacquerRed); rect(g, x + 3, y + 3, w - 6, h - 6, DK);
    rect(g, x + 4, y + 4, w - 8, h - 8, '#5a3a22'); rect(g, x + 4, y + 4, w - 8, 3, '#3e2616');
    const shown = Math.min(5, Math.ceil(n / 2));
    for (let i = 0; i < shown; i++) ART.top(g, id, x + PILE[i][0], y + PILE[i][1], 0.72);
    chip(g, n, x + 11, y + h - 20);
    if (job) {
      const ky = y - 6 + Math.round(Math.abs(Math.sin(job.t * 12)) * 14);
      rect(g, x + 40, ky - 1, 10, 26, DK); rect(g, x + 41, ky, 8, 24, '#dfe6ee'); rect(g, x + 41, ky, 2, 24, '#ffffff'); rect(g, x + 47, ky, 2, 24, '#aab4c4');
      rect(g, x + 39, ky - 12, 12, 12, DK); rect(g, x + 40, ky - 11, 10, 10, '#6b4a34'); rect(g, x + 40, ky - 11, 3, 10, '#8a623c');
    }
    badge(g, G, id);
  }

  function frame(g, G) {
    if (!back) back = buildBack();
    sky(g, G, WIN); SCENE.view(g, G, WIN, G.region || 0);
    g.drawImage(back, 0, 0);
    for (const [lx, ly, r, c] of LANTERNS) lantern(g, lx + Math.round(Math.sin(G.t * 1.3 + lx) * 1.2), ly, r, c);
    maneki(g, 506, 266, G.t);
    G.pass.forEach((b, i) => { if (b !== G.dragBowl) { const [x, y] = KL.passPos(i), s = Math.min(1, b.age / 0.25); ART.smallBowl(g, x + Math.round((1 - s) * 60), y, b); } });
    SCENE.clock(g, G, 1250, 84, 16);
    drawNoodles(g, G); drawBoiler(g, G); drawPots(g, G); drawTares(g, G); drawIce(g, G); drawOil(g, G); drawBook(g, G); drawTrash(g);
    const rack = rackTops();
    for (let k = 0; k < RACK; k++) drawBin(g, G, k, rack[k]);
    PX.setFont(1);
    for (let k = 0; k < Math.min(9, rack.length); k++) {   // each bin's number key (1-9), a small tag on its top-left corner
      const { x, y } = KL.bin(k);
      rect(g, x - 4, y - 4, 12, 12, DK); rect(g, x - 3, y - 3, 10, 10, '#f6e6c0'); rect(g, x - 3, y + 5, 10, 2, '#d8c8a0');
      textC(g, String(k + 1), x + 2, y - 4, '#4a3226');
    }
    PX.setFont(2);
    drawBowls(g, G);
    glow(g, (HEARTH.x + HEARTH.x1) / 2, 300, 200, 110, G.t, 1, 0.035);   // the hearth warms the whole cooking line
    SCENE.night(g, G, 0, W, [[1240, 420, 180, 120], [1440, 470, 110, 70], [760, 340, 240, 150], [134, 200, 110, 120],
      ...LANTERNS.map(([x, y]) => [x, y + 30, 90, 80]), [344, 400, 110, 80]]);
  }

  const refresh = () => { back = null; };
  return { frame, spoon, ladle, basket, heldNest, heldBasket, sideBowl, refresh, oilBottle };
})();
