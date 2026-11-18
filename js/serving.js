'use strict';
/* Serving room: four private stalls behind sudare bamboo blinds, the warming shelf on our side of the counter.
   Drawn in local coordinates (0-960); the caller translates it to world x SL.X0.
   Same look as the kitchen: dark timber posts, warm plaster, hinoki counter, the shop's indigo noren, brass trims.
   RPG touches: a shield and crossed swords on the wall, a quest board, and order tickets pinned up like quest notices. */
const SERVING = (() => {
  const { mk, rect, dot, ell, lathe, poly, line, shade, mix, text, textC, textW } = PX;
  const { wood, plaster, frameRect, lantern, sky, emote, ao, pool, contact, tag, chip } = SCENE;
  const DK = PX.OUTLINE, CY = SL.COUNTER_Y;
  const C = {   // every colour here comes from the shared palette (PAL in ui.js)
    beam: PAL.beam, post: PAL.postWarm, plaster: PAL.plasterWarm, wall: PAL.wallDark, hinoki: '#dcae70',
    indigo: PAL.indigo, indigoLo: PAL.indigoLo, indigoHi: PAL.indigoHi, washi: '#fbf6ea', cork: PAL.cork,
    copper: PAL.copper, copperHi: PAL.copperHi, copperLo: PAL.copperLo, brass: PAL.brass, brassLo: PAL.brassLo
  };
  const WIN = { x: 80, y: 84, w: 800, h: 60 };
  const PORT = { cx: 31, cy: 206, r: 20 };   // round window in the left wall
  const PORT_R = { x: PORT.cx - PORT.r, y: PORT.cy - PORT.r, w: 2 * PORT.r, h: 2 * PORT.r };
  const BOARD_Y = CY + 48, BOARD_H = 84, BOARD_W = 120;   // quest-notice board under each stall
  let back = null, front = null;

  const SEAT_K = 0.55; // share of the body shown above the counter
  const seatY = gt => CY + 4 - Math.round((gt.bottom - gt.head) * SEAT_K) - gt.head;

  function silhouette(img) {
    const c = mk(img.width, img.height), g = c.getContext('2d');
    g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#1c0f16'; g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // Cel-shaded timber post: lit left edge, body, shade, dark right edge, with a cap and a foot.
  function post(g, x, y, w, h, c) {
    rect(g, x - 1, y, w + 2, h, DK);
    rect(g, x, y, w, h, c);
    rect(g, x, y, 2, h, shade(c, 1.3)); rect(g, x + 2, y, 1, h, shade(c, 1.12));
    rect(g, x + w - 4, y, 2, h, shade(c, 0.78)); rect(g, x + w - 2, y, 2, h, shade(c, 0.6));
    for (let k = 14; k < h - 6; k += 37) { rect(g, x + 3, y + k, w - 6, 1, shade(c, 0.86)); rect(g, x + 4, y + k + 6, w - 9, 1, shade(c, 0.9)); }
    for (const [yy, hh] of [[y, 6], [y + h - 8, 8]]) { rect(g, x - 3, yy - 1, w + 6, hh + 2, DK); rect(g, x - 2, yy, w + 4, hh, shade(c, 0.9)); rect(g, x - 2, yy, w + 4, 1, shade(c, 1.25)); rect(g, x - 2, yy + hh - 1, w + 4, 1, shade(c, 0.6)); }
  }
  // The shop crest: a bowl with chopsticks, in cream on indigo cloth.
  function crest(g, cx, cy, c = '#e8dcc0') {
    poly(g, [[cx - 10, cy - 2], [cx + 11, cy - 2], [cx + 6, cy + 6], [cx - 5, cy + 6]], c);
    rect(g, cx - 4, cy + 6, 9, 2, c); line(g, cx - 6, cy - 13, cx + 8, cy - 4, c, 1); line(g, cx - 3, cy - 14, cx + 10, cy - 6, c, 1);
  }
  function shield(g, cx, cy) {   // round buckler over two crossed swords
    for (const s of [-1, 1]) {
      line(g, cx - 18 * s, cy - 22, cx + 16 * s, cy + 20, DK, 4); line(g, cx - 18 * s, cy - 22, cx + 16 * s, cy + 20, '#c9d1dd', 2);
      rect(g, cx + 12 * s - 4, cy + 12, 9, 3, DK); rect(g, cx + 12 * s - 3, cy + 13, 7, 1, C.brass);
      line(g, cx + 14 * s, cy + 15, cx + 17 * s, cy + 21, '#6b4a34', 2);
    }
    ell(g, cx, cy, 16, 16, DK); ell(g, cx, cy, 15, 15, '#8a5a32'); ell(g, cx, cy, 12, 12, '#6e4428');
    for (let a = 0; a < 8; a++) dot(g, cx + Math.round(Math.cos(a * Math.PI / 4) * 13), cy + Math.round(Math.sin(a * Math.PI / 4) * 13), C.brass);
    ell(g, cx, cy, 5, 5, DK); ell(g, cx, cy, 4, 4, C.brass); ell(g, cx - 1, cy - 1, 2, 2, '#ffe08a');
  }
  function questBoard(g, x, y, w, h) {
    rect(g, x - 1, y - 1, w + 2, h + 2, DK); wood(g, x, y, w, h, '#8a5a32', h, false, 91);
    rect(g, x + 3, y + 3, w - 6, h - 6, DK); rect(g, x + 4, y + 4, w - 8, h - 8, C.cork);
    for (const [px, py, pw, ph, col] of [[6, 7, 14, 18, '#f6ecd4'], [22, 9, 14, 14, '#efe0c0'], [10, 26, 18, 12, '#f6ecd4']]) {
      rect(g, x + px - 1, y + py - 1, pw + 2, ph + 2, DK); rect(g, x + px, y + py, pw, ph, col);
      for (let ly = y + py + 4; ly < y + py + ph - 2; ly += 3) rect(g, x + px + 2, ly, pw - 5, 1, '#b8a07a');
      dot(g, x + px + pw / 2, y + py + 1, '#c8443a');
    }
  }

  function buildBack() {
    const c = mk(VW, VH), g = c.getContext('2d');
    wood(g, 0, 0, VW, 30, C.beam, 10, false, 205); rect(g, 0, 29, VW, 2, DK);
    plaster(g, 0, 31, VW, 210, C.plaster, 209);
    ao(g, 0, 31, VW, 210, 'top', 22, 0.45);
    // long lattice window behind the stalls (only seen when a blind is up)
    frameRect(g, WIN.x, WIN.y, WIN.w, WIN.h, '#5a3820', 7);
    g.clearRect(WIN.x, WIN.y, WIN.w, WIN.h);
    for (let x = WIN.x + 49; x < WIN.x + WIN.w; x += 50) { rect(g, x - 1, WIN.y, 4, WIN.h, DK); rect(g, x, WIN.y, 2, WIN.h, '#6e4428'); dot(g, x, WIN.y, '#a57a4c'); }
    rect(g, WIN.x, WIN.y + 29, WIN.w, 4, DK); rect(g, WIN.x, WIN.y + 30, WIN.w, 2, '#6e4428');
    rect(g, WIN.x - 8, WIN.y + WIN.h + 7, WIN.w + 16, 2, shade('#5a3820', 0.55));
    ao(g, WIN.x - 8, WIN.y + WIN.h + 9, WIN.w + 16, 10, 'top', 8, 0.3);
    // chair rail and dark wainscot inside the stalls
    rect(g, 0, 240, VW, 8, DK); rect(g, 0, 241, VW, 6, '#6e4428'); rect(g, 0, 241, VW, 1, '#a57a4c'); rect(g, 0, 246, VW, 1, '#4a2e1a');
    wood(g, 0, 248, VW, 60, '#5a3a22', 24, true, 211);
    ao(g, 0, 248, VW, 60, 'top', 8, 0.5);
    for (let i = 0; i < SL.NSTALL; i++) {
      const sx = SL.stallX(i), cx = SL.stallCX(i), x0 = sx + 6, w = SL.STALL_W - 12, top = SL.BLIND_TOP, h = CY - top;
      // booth interior: the posts and the blind roll throw stepped shadow, so a guest sits *inside* the stall
      ao(g, x0, top, w, h, 'left', 22, 0.42);
      ao(g, x0, top, w, h, 'right', 30, 0.55);
      ao(g, x0, top, w, h, 'top', 44, 0.5);
      // andon paper lamp and its warm pool of light
      const lx = cx + 60, ly = 168;
      pool(g, lx + 9, ly + 14, 70, 56, '#ffcf7a', 0.07);
      rect(g, lx - 1, ly - 1, 20, 28, DK); rect(g, lx, ly, 18, 26, '#f6dfa8');
      rect(g, lx + 1, ly + 3, 4, 20, '#fff6da'); rect(g, lx + 13, ly + 3, 4, 20, '#dcbc7c');
      for (let k = ly + 9; k < ly + 22; k += 6) rect(g, lx, k, 18, 1, '#dcbc7c');
      rect(g, lx - 2, ly - 2, 22, 4, DK); rect(g, lx - 1, ly - 1, 20, 2, '#6e4428'); rect(g, lx - 2, ly + 24, 22, 4, DK); rect(g, lx - 1, ly + 25, 20, 2, '#6e4428');
    }
    return c;
  }

  function buildFront() {
    const c = mk(VW, VH), g = c.getContext('2d');
    const x0 = SL.stallX(0), x1 = SL.stallX(SL.NSTALL);
    // side walls (the screen edges also hold the station arrows)
    for (const [x, w, inner] of [[0, x0 - 6, 'right'], [x1 + 6, VW - x1 - 6, 'left']]) {
      wood(g, x, 31, w, CY - 31, C.wall, 20, true, x + 3);
      ao(g, x, 31, w, CY - 31, 'top', 18, 0.5);
      ao(g, x, 31, w, CY - 31, inner, 12, 0.45);
    }
    pool(g, 34, 118, 64, 72, '#ffb060', 0.07); pool(g, VW - 34, 118, 64, 72, '#ffb060', 0.07);
    // round window: frame, then punch the glass out so the sky drawn behind shows through
    ell(g, PORT.cx, PORT.cy, PORT.r + 5, PORT.r + 5, DK); ell(g, PORT.cx, PORT.cy, PORT.r + 4, PORT.r + 4, '#6e4428'); ell(g, PORT.cx - 1, PORT.cy - 1, PORT.r + 2, PORT.r + 2, '#a57a4c'); ell(g, PORT.cx + 1, PORT.cy + 1, PORT.r + 1, PORT.r + 1, '#4a2e1a');
    ell(g, PORT.cx, PORT.cy, PORT.r + 1, PORT.r + 1, DK);
    g.globalCompositeOperation = 'destination-out'; ell(g, PORT.cx, PORT.cy, PORT.r, PORT.r, '#000'); g.globalCompositeOperation = 'source-over';
    rect(g, PORT.cx - 1, PORT.cy - PORT.r, 3, 2 * PORT.r + 1, DK); rect(g, PORT.cx, PORT.cy - PORT.r, 1, 2 * PORT.r + 1, '#6e4428');
    rect(g, PORT.cx - PORT.r, PORT.cy - 1, 2 * PORT.r + 1, 3, DK); rect(g, PORT.cx - PORT.r, PORT.cy, 2 * PORT.r + 1, 1, '#6e4428');
    // adventurers' corner: a shield over crossed swords on the left wall, a quest board on the right wall
    shield(g, 31, 266);
    questBoard(g, VW - 54, 196, 46, 44);
    // stall posts
    for (let i = 0; i <= SL.NSTALL; i++) post(g, SL.stallX(i) - 7, SL.BLIND_TOP, 14, CY - SL.BLIND_TOP, C.post);
    // beam with seat plaques (cream wood, brass nails)
    rect(g, x0 - 12, SL.BEAM_Y - 1, x1 - x0 + 24, 24, DK);
    wood(g, x0 - 11, SL.BEAM_Y, x1 - x0 + 22, 22, C.beam, 11, false, 231);
    rect(g, x0 - 11, SL.BEAM_Y, x1 - x0 + 22, 1, '#8a623c'); rect(g, x0 - 11, SL.BEAM_Y + 19, x1 - x0 + 22, 3, '#2a1a14');
    for (let i = 0; i < SL.NSTALL; i++) {
      const cx = SL.stallCX(i);
      rect(g, cx - 15, SL.BEAM_Y + 1, 30, 20, DK); rect(g, cx - 14, SL.BEAM_Y + 2, 28, 18, '#ecd8ac');
      rect(g, cx - 14, SL.BEAM_Y + 2, 28, 1, '#fff6dc'); rect(g, cx - 14, SL.BEAM_Y + 18, 28, 2, '#bfa478');
      dot(g, cx - 11, SL.BEAM_Y + 5, C.brassLo); dot(g, cx + 10, SL.BEAM_Y + 5, C.brassLo);
      textC(g, String(i + 1), cx + 1, SL.BEAM_Y + 6, '#6a2414');
    }
    // counter: thick hinoki slab with a lit top edge and a bevelled front lip
    rect(g, 0, CY - 1, VW, VH - CY + 1, DK);
    wood(g, 0, CY, VW, 14, C.hinoki, 7, false, 251);
    rect(g, 0, CY, VW, 1, '#fff0c8'); rect(g, 0, CY + 1, VW, 1, '#f0c88a');
    rect(g, 0, CY + 11, VW, 3, '#a8763e'); rect(g, 0, CY + 14, VW, 2, '#6e4826'); rect(g, 0, CY + 16, VW, 1, DK);
    // indigo noren skirt under the lip, split into panels, a cream crest on each stall
    const NY = CY + 17, NH = 24;
    rect(g, 0, NY, VW, NH, C.indigo);
    for (let x = 0; x < VW; x += 3) rect(g, x, NY, 1, NH, (x / 3) % 2 ? C.indigo : shade(C.indigo, 0.94));
    rect(g, 0, NY, VW, 2, C.indigoLo);
    for (let x = 68; x < VW; x += 103) { rect(g, x, NY + 4, 1, NH - 4, C.indigoLo); rect(g, x + 1, NY + 4, 1, NH - 4, C.indigoHi); }
    for (let i = 0; i < SL.NSTALL; i++) crest(g, SL.stallCX(i) - 54, NY + 12);   // off-centre, clear of the pull-cord
    rect(g, 0, NY + NH, VW, 1, DK);
    // below it: dark vertical slats (koshi) on our side of the counter
    const LY = NY + NH + 1;
    wood(g, 0, LY, VW, VH - LY, '#4e3220', 12, true, 253);
    for (let x = 6; x < VW; x += 12) { rect(g, x, LY, 1, VH - LY, '#2e1c12'); rect(g, x + 1, LY, 1, VH - LY, '#6e4a2c'); }
    ao(g, 0, LY, VW, 40, 'top', 18, 0.6);
    ao(g, 0, LY, VW, VH - LY, 'bottom', 46, 0.35);
    for (let i = 0; i < SL.NSTALL; i++) {
      const sx = SL.stallX(i), cx = SL.stallCX(i);
      // quest-notice board for this stall's ticket
      const bx = cx - BOARD_W / 2, BW = BOARD_W;
      ao(g, bx + 4, BOARD_Y + BOARD_H + 1, BW, 8, 'top', 6, 0.45);
      rect(g, bx - 1, BOARD_Y - 1, BW + 2, BOARD_H + 2, DK); wood(g, bx, BOARD_Y, BW, BOARD_H, '#7a5232', BOARD_H, false, 280 + i);
      rect(g, bx, BOARD_Y, BW, 1, '#a8784a');
      rect(g, bx + 4, BOARD_Y + 4, BW - 8, BOARD_H - 8, DK); rect(g, bx + 5, BOARD_Y + 5, BW - 10, BOARD_H - 10, C.cork);
      for (let k = 0; k < 18; k++) dot(g, bx + 8 + Math.floor(SCENE.rnd(i * 31 + k) * (BW - 16)), BOARD_Y + 8 + Math.floor(SCENE.rnd(i * 17 + k * 3) * (BOARD_H - 16)), shade(C.cork, 0.82));
      for (const [nx, ny] of [[bx + 2, BOARD_Y + 2], [bx + BW - 3, BOARD_Y + 2], [bx + 2, BOARD_Y + BOARD_H - 3], [bx + BW - 3, BOARD_Y + BOARD_H - 3]]) { dot(g, nx, ny, C.brass); }
      // water cup and chopstick jar on the counter
      contact(g, sx + 26, CY + 2, 11, 3); contact(g, sx + 45, CY + 2, 10, 3);
      rect(g, sx + 18, CY - 15, 15, 17, DK); rect(g, sx + 19, CY - 14, 13, 15, '#a8d2dc'); rect(g, sx + 19, CY - 14, 13, 4, '#e2f6fa');
      rect(g, sx + 19, CY - 10, 2, 10, '#d4eef4'); rect(g, sx + 28, CY - 10, 3, 10, '#7fb0bf'); rect(g, sx + 19, CY - 1, 13, 1, '#6a98a8');
      rect(g, sx + 38, CY - 13, 14, 15, DK); rect(g, sx + 39, CY - 12, 12, 13, '#3e2a20'); rect(g, sx + 39, CY - 12, 3, 13, '#5a3e2c'); rect(g, sx + 48, CY - 12, 3, 13, '#2a1a14'); rect(g, sx + 39, CY - 12, 12, 2, '#6b4a34');
      for (const [a, b] of [[42, -1], [46, 1], [49, 0]]) { line(g, sx + a, CY - 12, sx + a + b * 2, CY - 27, DK, 3); line(g, sx + a, CY - 13, sx + a + b * 2, CY - 26, '#e3c07a'); }
      // menu card standing on the counter: a lacquer header with the bowl crest, two dishes listed
      const mx = sx + SL.STALL_W - 56;
      contact(g, mx + 20, CY + 1, 22, 3);
      poly(g, [[mx + 4, CY + 1], [mx + 34, CY + 1], [mx + 30, CY - 4], [mx + 8, CY - 4]], DK);
      rect(g, mx - 1, CY - 41, 40, 39, DK); rect(g, mx, CY - 40, 38, 37, '#f6ecd4'); rect(g, mx + 35, CY - 40, 3, 37, '#dccaa4');
      rect(g, mx, CY - 40, 38, 14, '#7a1e18'); rect(g, mx, CY - 40, 38, 1, '#b8302a'); rect(g, mx, CY - 27, 38, 1, '#3e140a');
      poly(g, [[mx + 12, CY - 35], [mx + 26, CY - 35], [mx + 23, CY - 30], [mx + 15, CY - 30]], '#f6e6c0'); line(g, mx + 14, CY - 39, mx + 24, CY - 34, '#f6e6c0', 1);
      rect(g, mx + 4, CY - 22, 6, 5, MENU.miso.c); rect(g, mx + 13, CY - 21, 20, 2, '#b8a07a');
      rect(g, mx + 4, CY - 13, 6, 5, MENU.spicy.c); rect(g, mx + 13, CY - 12, 20, 2, '#b8a07a');
      rect(g, mx + 1, CY - 6, 34, 2, '#dccaa4');
    }
    // copper-topped warming shelf on our side, with brass rail posts
    const Y = SL.SHELF_Y;
    ao(g, 181, Y + 22, 578, 14, 'top', 12, 0.55);
    rect(g, 180, Y - 1, 580, 24, DK);
    wood(g, 181, Y + 6, 578, 16, C.hinoki, 16, false, 271);
    for (let x = 181; x < 759; x++) { const k = (x - 181) % 48; rect(g, x, Y, 1, 6, k < 2 ? C.copperLo : k < 10 ? C.copperHi : C.copper); }
    rect(g, 181, Y, 578, 1, C.copperHi); rect(g, 181, Y + 5, 578, 1, C.copperLo); rect(g, 181, Y + 20, 578, 2, '#6e4826');
    for (const px of [184, 752]) { rect(g, px - 1, Y - 16, 6, 18, DK); rect(g, px, Y - 15, 4, 16, C.brass); rect(g, px, Y - 15, 1, 16, '#ffe08a'); }
    rect(g, 184, Y - 17, 572, 3, DK); rect(g, 185, Y - 16, 570, 1, C.brass);
    tag(g, 'PICKUP', 822, Y + 4);
    return c;
  }

  // Sudare bamboo blind. down: 0 = rolled up, 1 = fully down. Fine slats with gaps let the silhouette show through;
  // a short indigo noren valance with the shop crest hides the roll at the top.
  function blind(g, x, w, down) {
    const y0 = SL.BLIND_TOP, len = Math.round(12 + (CY - y0 - 12) * down);
    for (let r = 0; r < len; r++) {
      const y = y0 + r;
      if (r > 12 && r % 3 === 2 && r < len - 6) { g.globalAlpha = 0.55; rect(g, x, y, w, 1, '#2a160a'); g.globalAlpha = 1; continue; }
      const k = r % 3, base = k === 0 ? '#dcbc72' : '#c49c56';
      g.globalAlpha = r > 12 ? 0.95 : 1;
      rect(g, x, y, w, 1, base);
      rect(g, x, y, Math.round(w * 0.2), 1, shade(base, 1.1)); rect(g, x + Math.round(w * 0.74), y, w - Math.round(w * 0.74), 1, shade(base, 0.86));
      rect(g, x + w - 6, y, 6, 1, shade(base, 0.72));
      if ((r * 7) % 17 < 3) rect(g, x + ((r * 37) % (w - 30)), y, 14, 1, shade(base, 0.82));   // bamboo nodes
      g.globalAlpha = 1;
    }
    rect(g, x - 1, y0, 1, len, DK); rect(g, x + w, y0, 1, len, DK);
    for (const sx of [18, (w >> 1) - 1, w - 20]) {   // binding cords with knots
      rect(g, x + sx, y0, 2, len, '#5a3416');
      for (let r = 16; r < len; r += 9) { rect(g, x + sx - 1, y0 + r, 4, 2, '#7a4a22'); dot(g, x + sx - 1, y0 + r, '#a8703a'); }
    }
    // bottom pole
    rect(g, x - 1, y0 + len, w + 2, 6, DK); rect(g, x, y0 + len, w, 4, '#a8803e'); rect(g, x, y0 + len, w, 1, '#e0bd72'); rect(g, x, y0 + len + 3, w, 1, '#6e4e22');
    // noren valance over the roll
    rect(g, x - 2, y0 - 2, w + 4, 18, DK); rect(g, x - 1, y0 - 1, w + 2, 16, C.indigo); rect(g, x - 1, y0 - 1, w + 2, 2, C.indigoLo);
    for (const s of [w / 3, (2 * w) / 3]) { rect(g, x + Math.round(s), y0 + 4, 1, 11, C.indigoLo); rect(g, x + Math.round(s) + 1, y0 + 4, 1, 11, C.indigoHi); }
    rect(g, x - 1, y0 + 14, w + 2, 1, C.indigoLo);
    crest(g, x + Math.round(w / 2), y0 + 9);
  }

  function drawGuest(g, G, i) {
    const st = G.stalls[i], gu = st.guest;
    if (!gu || !gu.img.complete) return;
    const sx = SL.stallX(i), cx = SL.stallCX(i);
    let a = 1, yo = 0;
    if (gu.state === 'arrive') { const p = Math.min(1, gu.t / 0.8); a = p; yo = Math.round((1 - p) * -18 + Math.sin(p * Math.PI) * 6); }
    else if (gu.state === 'leave') { const p = Math.min(1, gu.t / 0.8); a = 1 - p; yo = -Math.round(p * 20); }
    else if (gu.state === 'eat') yo = Math.round(Math.abs(Math.sin(gu.t * 5)) * 3);
    else if (gu.state === 'pay' && gu.mood === 'happy') yo = -Math.round(Math.abs(Math.sin(gu.t * 9)) * 8 * Math.max(0, 1 - gu.t / 1.2));
    else yo = Math.sin(G.t * 1.6 + i * 2) > 0.5 ? 1 : 0;
    if (a <= 0) return;
    const y = seatY(gu.gt) + yo;
    g.save(); g.beginPath(); g.rect(sx + 6, SL.BLIND_TOP, SL.STALL_W - 12, CY - SL.BLIND_TOP); g.clip();
    if (st.blind >= 0.98) { g.globalAlpha = a * 0.75; g.drawImage(gu.sil, cx - gu.gt.ax, y); }
    else { g.globalAlpha = a; g.drawImage(gu.img, cx - gu.gt.ax, y); }
    g.restore(); g.globalAlpha = 1;
  }

  // Where the red pull-cord tassel hangs for a stall, given how far down its blind is (local coords).
  const blindLen = down => Math.round(12 + (CY - SL.BLIND_TOP - 12) * down);
  const cordAt = (i, down) => ({ x: SL.stallCX(i), y: SL.BLIND_TOP + blindLen(down) + 14 });
  const downFor = y => Math.max(0, Math.min(1, (y - SL.BLIND_TOP - 26) / (CY - SL.BLIND_TOP - 12)));
  function drawCord(g, G, i) {
    const st = G.stalls[i], { x, y } = cordAt(i, st.blind), top = SL.BLIND_TOP + blindLen(st.blind) + 5;
    rect(g, x - 1, top, 3, y - top - 2, DK); rect(g, x, top, 1, y - top - 2, '#c0392b');
    rect(g, x - 4, y - 3, 9, 9, DK); rect(g, x - 3, y - 2, 7, 7, '#c0392b'); rect(g, x - 3, y - 2, 2, 7, '#e2685c'); rect(g, x + 2, y - 2, 2, 7, '#8f2420');
    rect(g, x - 3, y - 4, 7, 2, C.brass);
    for (let k = -2; k <= 2; k += 2) rect(g, x + k, y + 5, 1, 4, '#a8302a');
    const gu = st.guest;
    if (gu && gu.state === 'call' && st.blind > 0.9) {   // bobbing arrow: pull me up
      const ay = y - 22 - Math.round(Math.abs(Math.sin(G.t * 5)) * 4);
      poly(g, [[x - 7, ay + 7], [x + 8, ay + 7], [x + 0.5, ay - 2]], DK); poly(g, [[x - 4, ay + 5], [x + 5, ay + 5], [x + 0.5, ay]], '#fff6d0');
      rect(g, x - 2, ay + 7, 5, 6, DK); rect(g, x - 1, ay + 6, 3, 6, '#fff6d0');
    }
  }

  // The stall's order, pinned to its board like a quest notice: the number and the ramen's name (text only).
  function notice(g, cx, num, m, t) {
    const lines = textW(m.short) > 96 ? m.short.split(' ') : [m.short];
    const w = 104, h = 36 + lines.length * 16, x = cx - w / 2, y = BOARD_Y + 6, sway = Math.round(Math.sin(t * 1.4 + cx) * 0.6);
    rect(g, x + 3, y + 3, w, h, 'rgba(40,20,10,0.3)');
    rect(g, x - 1 + sway, y - 1, w + 2, h + 2, DK); rect(g, x + sway, y, w, h, C.washi); rect(g, x + sway, y + h - 3, w, 3, '#e8dcc0');
    ell(g, cx + sway, y + 2, 3, 3, DK); ell(g, cx + sway, y + 2, 2, 2, '#c8443a'); dot(g, cx - 1 + sway, y + 1, '#ff9a86');
    textC(g, '#' + num, cx + sway, y + 9, '#3a2f2a');
    for (let k = 0; k < w - 10; k += 6) rect(g, x + 5 + k + sway, y + 25, 3, 1, '#b8a890');
    lines.forEach((ln, i) => textC(g, ln, cx + sway, y + 31 + i * 16, m.c));
  }

  function drawFrontInfo(g, G, i) {
    const st = G.stalls[i], gu = st.guest, cx = SL.stallCX(i);
    drawCord(g, G, i);
    if (!gu) return;
    if (gu.state === 'call') {
      emote(g, 'call', cx, 150, G.t * 1.5);
      const p = 0.5 + 0.5 * Math.sin(G.t * 4);
      g.globalAlpha = 0.25 + 0.25 * p; rect(g, SL.stallX(i) + 6, SL.BLIND_TOP, SL.STALL_W - 12, CY - SL.BLIND_TOP, '#fff3c0'); g.globalAlpha = 1;
    }
    if (gu.order && (gu.state === 'wait' || gu.state === 'ordering')) notice(g, cx, gu.num, MENU[gu.order.type], G.t);
    if (gu.state === 'wait') emote(g, 'dots', cx, 150, G.t);
  }

  // Guests waiting for a stall sit on a little bench between the first two boards: one figure per guest (at most MAX_WAIT).
  function drawQueue(g, G) {
    const n = Math.min(G.waiting, MAX_WAIT), bx = 236, by = SL.SHELF_Y - 30;
    contact(g, bx + 38, by + 9, 42, 3);
    for (let k = 0; k < n; k++) {
      const fx = bx + 14 + k * 26, bob = Math.sin(G.t * 2 + k * 1.7) > 0.6 ? 1 : 0;
      ell(g, fx, by - 20 + bob, 6, 6, DK); ell(g, fx, by - 20 + bob, 5, 5, '#3a2a36');
      lathe(g, fx, [[by - 13 + bob, 5], [by - 4, 9]], DK); lathe(g, fx, [[by - 12 + bob, 4], [by - 4, 8]], '#3a2a36');
      dot(g, fx - 2, by - 22 + bob, '#5a4a56');
    }
    rect(g, bx - 1, by - 5, 78, 7, DK); wood(g, bx, by - 4, 76, 5, '#8a5a32', 5, false, 97); rect(g, bx, by - 4, 76, 1, '#c08a52');
    for (const lx of [bx + 5, bx + 67]) { rect(g, lx - 1, by + 2, 5, 8, DK); rect(g, lx, by + 2, 3, 7, '#6e4428'); }
  }

  function frame(g, G) {
    if (!back) { back = buildBack(); front = buildFront(); }
    sky(g, G, WIN);
    g.drawImage(back, 0, 0);
    for (let i = 0; i < SL.NSTALL; i++) {
      const st = G.stalls[i];
      drawGuest(g, G, i);
      if (st.bowl) {
        ART.smallBowl(g, SL.stallCX(i), CY - 18, st.bowl);
        if (st.bowl.broth) for (let k = 0; k < 3; k++) {   // a few wisps of steam over a served bowl
          const p = (G.t * 0.6 + k / 3) % 1, wx = SL.stallCX(i) - 8 + k * 8 + Math.round(Math.sin(p * 6 + k) * 2);
          g.globalAlpha = 0.35 * (1 - p); rect(g, wx, CY - 32 - Math.round(p * 26), 2, 4, '#fff6e6'); g.globalAlpha = 1;
        }
      }
      blind(g, SL.stallX(i) + 6, SL.STALL_W - 12, st.blind);
    }
    sky(g, G, PORT_R);
    g.drawImage(front, 0, 0);
    for (const [lx, side] of [[34, 0], [VW - 34, 1]]) lantern(g, lx + Math.round(Math.sin(G.t * 1.2 + side * 2) * 1.2), 92, 13, '#c8443a');
    SCENE.clock(g, G, VW - 31, 152, 17);
    for (let i = 0; i < SL.NSTALL; i++) drawFrontInfo(g, G, i);
    G.pass.forEach((b, i) => {
      if (b === G.dragBowl) return;
      const s = Math.min(1, b.age / 0.25), px = SL.pickX(i);
      pool(g, px, SL.SHELF_Y + 2, 34, 6, '#ffb050', 0.12 + 0.04 * Math.sin(G.t * 4 + i));
      ART.smallBowl(g, px, SL.SHELF_Y - 6 - Math.round((1 - s) * 12), b);
    });
    if (G.waiting > 0) drawQueue(g, G);
    SCENE.night(g, G, 0, VW, [[34, 120, 70, 70], [VW - 34, 120, 70, 70], [480, 300, 420, 120], ...[0, 1, 2, 3].map(i => [SL.stallCX(i) + 69, 182, 60, 50])]);
  }

  return { frame, silhouette, seatY, cordAt, downFor };
})();
