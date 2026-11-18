'use strict';
/* Shared drawing helpers: textures (wood, plaster), frames, sky, particles, emotes, highlights, night tint. */
const SCENE = (() => {
  const { rect, dot, ell, lathe, poly, line, shade, mix, textC } = PX;
  const DK = PX.OUTLINE;
  const rnd = i => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

  /* The guests are 1px-black-outlined, hard cel-shaded sprites lit from the top left. Everything here follows the
     same rules: 3-4 tone cel steps per surface, dark seams, and stepped (never smooth) shadows and light. */

  // Planks with cel-shaded edges, butt joints, two-tone grain and the odd outlined knot. vertical = boards run up and down.
  function wood(g, x, y, w, h, c, plank = 16, vertical = false, seed = 1) {
    const len = vertical ? h : w, across = vertical ? w : h;
    const R = (a, b, ww, hh, col) => vertical ? rect(g, x + b, y + a, hh, ww, col) : rect(g, x + a, y + b, ww, hh, col);
    const seam = mix(shade(c, 0.45), DK, 0.35);
    for (let p = 0, i = 0; p < across; p += plank, i++) {
      const tone = shade(c, 0.88 + rnd(seed + i) * 0.2), pw = Math.min(plank, across - p);
      R(0, p, len, pw, tone);
      if (pw > 5) { R(0, p, len, 1, shade(tone, 1.2)); R(0, p + 1, len, 1, shade(tone, 1.07)); R(0, p + pw - 2, len, 1, shade(tone, 0.84)); }
      else R(0, p, len, 1, shade(tone, 1.12));
      R(0, p + pw - 1, len, 1, seam);
      for (let k = 0; k < len / 13; k++) {
        const a = Math.floor(rnd(seed * 7 + i * 31 + k) * len), b = p + 2 + Math.floor(rnd(seed * 3 + i * 17 + k * 5) * Math.max(1, pw - 5));
        const L = 8 + Math.floor(rnd(k + i * 7 + seed) * 24);
        R(a, b, L, 1, shade(tone, rnd(k * 3 + i + seed) > 0.25 ? 0.82 : 1.1));
        if (pw > 8 && rnd(k + seed * 2 + i) > 0.55) R(a + 3, Math.min(p + pw - 3, b + 1), Math.max(2, L - 7), 1, shade(tone, 0.9));
      }
      if (len > 70) for (let a = 30 + Math.floor(rnd(seed * 5 + i) * 140); a < len - 12; a += 150 + Math.floor(rnd(seed + i * 3 + a) * 90)) { R(a, p, 1, pw - 1, seam); R(a + 1, p, 1, pw - 1, shade(tone, 1.12)); }
      if (pw > 6 && rnd(seed + i * 13) > 0.72) {
        const a = Math.floor(rnd(seed + i * 5) * (len - 10)) + 5, b = p + (pw >> 1);
        if (vertical) { ell(g, x + b, y + a, 2, 4, shade(tone, 0.62)); ell(g, x + b, y + a, 1, 2, shade(tone, 0.8)); dot(g, x + b, y + a, seam); }
        else { ell(g, x + a, y + b, 4, 2, shade(tone, 0.62)); ell(g, x + a, y + b, 2, 1, shade(tone, 0.8)); dot(g, x + a, y + b, seam); }
      }
    }
  }
  // Mottled lime plaster: speckle in three tones plus faint blotches, clipped to its box.
  function plaster(g, x, y, w, h, c, seed = 3) {
    rect(g, x, y, w, h, c);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    for (let i = 0; i < w * h / 2200; i++) ell(g, x + Math.floor(rnd(seed * 9 + i) * w), y + Math.floor(rnd(seed * 4 + i * 2.3) * h), 7 + (i % 3) * 4, 3 + (i % 2) * 2, shade(c, i % 2 ? 0.96 : 1.03));
    const n = Math.floor(w * h / 36);
    for (let i = 0; i < n; i++) {
      const v = rnd(i + seed);
      rect(g, x + Math.floor(rnd(seed + i) * w), y + Math.floor(rnd(seed * 2 + i * 1.7) * h), i % 3 ? 1 : 2, 1, v > 0.62 ? shade(c, 0.91) : v > 0.3 ? shade(c, 1.05) : shade(c, 0.96));
    }
    g.restore();
  }
  // Glazed subway tiles: each one bevelled (lit top/left, shaded bottom/right) with a glaze glint and the odd stain.
  function tiles(g, x, y, w, h, base = '#ddd0b2') {
    rect(g, x, y, w, h, '#9c8a6c');
    for (let yy = y, row = 0; yy < y + h; yy += 20, row++) {
      for (let xx = x - (row % 2) * 20, col = 0; xx < x + w; xx += 40, col++) {
        const tx = Math.max(x, xx + 1), tw = Math.min(xx + 40, x + w) - tx, th = Math.min(19, y + h - yy - 1);
        if (tw <= 1 || th <= 1) continue;
        const v = rnd(row * 97 + col * 13 + xx * 0.37), tone = shade(base, 0.94 + v * 0.09);
        rect(g, tx, yy + 1, tw, th, tone);
        rect(g, tx, yy + 1, tw, 1, shade(tone, 1.14)); rect(g, tx, yy + 2, 1, th - 1, shade(tone, 1.07));
        rect(g, tx, yy + th, tw, 1, shade(tone, 0.8)); rect(g, tx + tw - 1, yy + 2, 1, th - 1, shade(tone, 0.88));
        if (tw > 12) { rect(g, tx + 3, yy + 3, 7, 1, shade(tone, 1.22)); rect(g, tx + 3, yy + 4, 1, 3, shade(tone, 1.16)); }
        if (v > 0.92 && tw > 24) { rect(g, tx + 12 + Math.floor(v * 97) % 12, yy + 9, 4, 2, shade(tone, 0.84)); dot(g, tx + 13 + Math.floor(v * 97) % 12, yy + 11, shade(tone, 0.88)); }
      }
    }
  }
  // Stepped, dithered shadow that fades away from one edge of a box. side: 'top' | 'bottom' | 'left' | 'right'.
  function ao(g, x, y, w, h, side, size, a = 0.35, c = '#1a0a0e', steps = 4) {
    const horiz = side === 'top' || side === 'bottom';
    const lv = i => Math.ceil((1 - (i + 0.5) / size) * steps);
    const at = i => side === 'top' ? [x, y + i, w, 1] : side === 'bottom' ? [x, y + h - 1 - i, w, 1] : side === 'left' ? [x + i, y, 1, h] : [x + w - 1 - i, y, 1, h];
    for (let i = 0; i < size; i++) {
      const s = lv(i), [rx, ry, rw, rh] = at(i);
      if (s <= 0) break;
      const edge = i + 1 < size && lv(i + 1) !== s;
      g.globalAlpha = a * (edge ? s - 1 : s) / steps;
      if (g.globalAlpha > 0) rect(g, rx, ry, rw, rh, c);
      if (edge) {
        g.globalAlpha = a / steps;
        const n = horiz ? rw : rh;
        for (let k = (i % 2); k < n; k += 2) horiz ? rect(g, rx + k, ry, 1, 1, c) : rect(g, rx, ry + k, 1, 1, c);
      }
    }
    g.globalAlpha = 1;
  }
  // Stepped pool of light (or shadow): concentric ellipses, each step adding a little more.
  function pool(g, cx, cy, rx, ry, c, a = 0.07, steps = 4) {
    g.globalAlpha = a;
    for (let k = 0; k < steps; k++) { const f = 1 - k / steps; ell(g, Math.round(cx), Math.round(cy), Math.round(rx * f), Math.max(1, Math.round(ry * f)), c); }
    g.globalAlpha = 1;
  }
  // Contact shadow that grounds an object on a surface.
  function contact(g, cx, cy, rx, ry) { pool(g, cx, cy, rx, ry, '#1a0a0e', 0.16, 3); }
  function frameRect(g, x, y, w, h, c, t = 6) { // outlined wooden frame around a hole
    rect(g, x - t - 1, y - t - 1, w + 2 * t + 2, h + 2 * t + 2, DK);
    rect(g, x - t, y - t, w + 2 * t, h + 2 * t, c);
    rect(g, x - t, y - t, w + 2 * t, 1, shade(c, 1.25)); rect(g, x - t, y - t, 1, h + 2 * t, shade(c, 1.15));
    rect(g, x - t, y + h + t - 1, w + 2 * t, 1, shade(c, 0.6)); rect(g, x + w + t - 1, y - t, 1, h + 2 * t, shade(c, 0.7));
    rect(g, x - 1, y - 1, w + 2, h + 2, DK);
  }
  function lantern(g, x, y, r, c) {
    rect(g, x - 1, y - 24, 2, 24, '#3a2a22');
    rect(g, x - 9, y - 4, 18, 6, DK); rect(g, x - 8, y - 3, 16, 4, '#3a2a22');
    ell(g, x, y + r + 2, r + 1, Math.round(r * 1.25) + 1, DK); ell(g, x, y + r + 2, r, Math.round(r * 1.25), c);
    ell(g, x + Math.round(r * 0.3), y + r + 2, Math.round(r * 0.6), Math.round(r * 1.2), shade(c, 0.82));
    ell(g, x - Math.round(r * 0.45), y + r, Math.round(r * 0.25), Math.round(r * 0.8), shade(c, 1.25));
    for (let k = -3; k <= 3; k++) { const f = Math.sqrt(1 - (k / 4) ** 2); rect(g, x - Math.round(r * f), y + r + 2 + k * Math.round(r * 0.3), Math.round(2 * r * f), 1, shade(c, 0.7)); }
    const by = y + 2 * r + Math.round(r * 0.5) + 2;
    rect(g, x - 9, by, 18, 6, DK); rect(g, x - 8, by + 1, 16, 4, '#3a2a22');
    rect(g, x - 2, by + 6, 4, 10, '#e0b040'); rect(g, x - 1, by + 6, 1, 10, '#fff0a0');
  }
  // The one label style in the world: a walnut tag with a brass top edge and cream text.
  // c is a hint for the text: reds read as a warning, greens as "ready", 'muted' for inactive things.
  function tagInk(c) {
    if (c === 'muted') return '#a8967a';
    if (!c || c[0] !== '#') return '#f6e6c0';
    const r = parseInt(c.slice(1, 3), 16), gg = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
    if (r > 150 && r > gg * 1.6) return '#ff9a86';
    if (gg > r + 10 && gg > b) return '#b6e37a';
    return '#f6e6c0';
  }
  function tag(g, s, cx, y, c, pad = 12, minW = 0) {
    const w = Math.max(minW, PX.textW(s) + pad), x = Math.round(cx - w / 2);
    rect(g, x - 1, y - 3, w + 2, 20, DK);
    rect(g, x, y - 2, w, 18, PAL.walnut);
    rect(g, x, y - 2, w, 1, '#c9962e'); rect(g, x, y - 1, w, 1, PAL.walnutHi); rect(g, x, y + 15, w, 1, PAL.walnutLo);
    textC(g, s, cx, y + 2, tagInk(c));
  }
  const label = (g, s, cx, y, c) => tag(g, s, cx, y, c);
  // Count chip: a small walnut pill with a brass edge; the number turns red when it runs low (low = 2 or less by default).
  function chip(g, n, cx, y, low = n <= 2) {
    const s = String(n), w = Math.max(20, PX.textW(s) + 10), x = Math.round(cx - w / 2);
    rect(g, x - 1, y - 1, w + 2, 18, DK); rect(g, x, y, w, 16, PAL.walnutLo); rect(g, x, y, w, 1, '#c9962e');
    textC(g, s, cx, y + 2, low ? '#ff8a7a' : '#f6e6c0');
  }

  function sky(g, G, r) {
    const n = G.nightF, d = G.duskF;
    let top = mix('#9fd4e6', '#151a3a', n), bot = mix('#f4ecc8', '#2c3160', n);
    top = mix(top, '#e58a5c', d * 0.45); bot = mix(bot, '#f6b56a', d * 0.7);
    const bands = 8;
    for (let i = 0; i < bands; i++) rect(g, r.x, r.y + Math.floor(i * r.h / bands), r.w, Math.ceil(r.h / bands) + 1, mix(top, bot, i / (bands - 1)));
    // sun by day, moon by night, arcing across the window as the hours pass
    const h = G.hour === undefined ? 12 : G.hour, day = h >= 6 && h < 18, p = day ? (h - 6) / 12 : ((h + 6) % 24) / 12;
    const big = r.w > 300, R = big ? 11 : Math.max(4, Math.round(Math.min(r.w, r.h) / 9));
    const bx = Math.round(r.x + R + 2 + p * (r.w - 2 * R - 4)), by = Math.round(r.y + r.h - R - 2 - Math.sin(p * Math.PI) * (r.h - 2 * R - 6));
    if (day) { ell(g, bx, by, R + 2, R + 2, mix('#fff2a0', bot, 0.5)); ell(g, bx, by, R, R, '#ffe066'); ell(g, bx - 1, by - 1, R - 2, R - 2, '#fff6b8'); }
    else { ell(g, bx, by, R, R, '#fff6d0'); ell(g, bx + Math.ceil(R / 2), by - Math.ceil(R / 3), R - 1, R - 1, mix(top, bot, 0.3)); }
    if (n > 0.3) {
      g.globalAlpha = (n - 0.3) / 0.7;
      for (let i = 0; i < Math.floor(r.w / 14); i++) if (Math.sin(G.t * 1.5 + i * 2.1) > -0.6) dot(g, r.x + (i * 137) % r.w, r.y + 4 + (i * 53) % Math.max(1, r.h - 8), '#fff6d0');
      g.globalAlpha = 1;
    } else {
      for (const [cx0, cy, s] of [[60, 18, 1], [300, 40, 0.7], [470, 22, 0.85]]) {
        if (cx0 > r.w + 40) continue;
        const cx = Math.round(r.x + ((cx0 + G.t * 4 * s) % (r.w + 80)) - 40);
        ell(g, cx, r.y + cy + 2, 26, 6, '#e8eef2'); ell(g, cx, r.y + cy, 24, 6, '#fffaf0'); ell(g, cx + 10, r.y + cy - 6, 14, 7, '#fffaf0'); ell(g, cx - 10, r.y + cy - 3, 10, 5, '#fffaf0');
      }
    }
  }

  // Round wall clock showing the in-game hour, with a tiny sun or moon on the face for AM/PM feel.
  function clock(g, G, cx, cy, r) {
    const h = G.hour === undefined ? 12 : G.hour, night = h < 6 || h >= 18;
    rect(g, cx - 1, cy - r - 8, 2, 7, '#3a2a22');
    ell(g, cx, cy, r + 2, r + 2, DK); ell(g, cx, cy, r + 1, r + 1, '#7a5230'); ell(g, cx - 1, cy - 1, r, r, '#a57a4c');
    ell(g, cx, cy, r - 2, r - 2, DK); ell(g, cx, cy, r - 3, r - 3, '#fff7e4'); ell(g, cx + 1, cy + 1, r - 5, r - 5, '#f4e6c4');
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2, d = r - 6, x = Math.round(cx + Math.sin(a) * d), y = Math.round(cy - Math.cos(a) * d);
      rect(g, x - (k % 3 ? 0 : 1), y - (k % 3 ? 0 : 1), k % 3 ? 1 : 2, k % 3 ? 1 : 2, k % 3 ? '#a08060' : '#4a3226');
    }
    const icon = cy + Math.round(r * 0.4);
    if (night) { ell(g, cx, icon, 2, 2, '#6a78b8'); dot(g, cx + 1, icon - 1, '#f4e6c4'); } else { ell(g, cx, icon, 2, 2, '#f2a22a'); dot(g, cx, icon, '#ffe066'); }
    const ha = (h % 12) / 12 * Math.PI * 2, ma = (h % 1) * Math.PI * 2;
    line(g, cx, cy, cx + Math.sin(ha) * r * 0.45, cy - Math.cos(ha) * r * 0.45, '#4a3226', 2);
    line(g, cx, cy, cx + Math.sin(ma) * r * 0.7, cy - Math.cos(ma) * r * 0.7, '#c8302a', 1);
    rect(g, cx - 1, cy - 1, 3, 3, DK); dot(g, cx, cy, '#e0b040');
  }

  function part(g, p) {
    g.globalAlpha = Math.max(0, Math.min(1, p.life / p.max)) * (p.type === 'steam' ? 0.45 : 1);
    const x = Math.round(p.x), y = Math.round(p.y);
    if (p.type === 'steam') { const r = 2 + Math.round((1 - p.life / p.max) * 4); ell(g, x, y, r, r, '#ffffff'); }
    else if (p.type === 'heart') { ell(g, x - 3, y - 1, 3, 3, '#ef5d7a'); ell(g, x + 3, y - 1, 3, 3, '#ef5d7a'); poly(g, [[x - 6, y], [x + 7, y], [x + 0.5, y + 7]], '#ef5d7a'); dot(g, x - 4, y - 2, '#ffd0da'); }
    else if (p.type === 'coin') { g.globalAlpha = 1; ell(g, x, y, 6, 6, DK); ell(g, x, y, 5, 5, '#e6a91f'); ell(g, x - 1, y - 1, 4, 4, '#ffd23f'); rect(g, x - 1, y - 3, 2, 6, '#c8861a'); dot(g, x - 3, y - 3, '#fff6c0'); }
    else if (p.type === 'spark') { rect(g, x - 2, y, 5, 1, p.c); rect(g, x, y - 2, 1, 5, p.c); dot(g, x, y, '#ffffff'); }
    else rect(g, x, y, 2, 3, p.c || '#bfe6f2');
    g.globalAlpha = 1;
  }

  function emote(g, type, x, y, t) {
    y += Math.round(Math.sin(t * 6) * 2);
    rect(g, x - 13, y - 13, 28, 24, DK); rect(g, x - 12, y - 12, 26, 22, '#fffaf0'); rect(g, x - 3, y + 11, 6, 3, DK); rect(g, x - 2, y + 10, 4, 3, '#fffaf0');
    if (type === 'heart') { for (const ox of [-6, 1]) ell(g, x + ox + 2, y - 3, 4, 4, '#ef5d7a'); poly(g, [[x - 8, y - 2], [x + 10, y - 2], [x + 1, y + 7]], '#ef5d7a'); dot(g, x - 5, y - 5, '#ffd0da'); }
    else if (type === 'sweat') { ell(g, x + 1, y + 2, 5, 5, '#5fb8e6'); poly(g, [[x - 3, y], [x + 5, y], [x + 1, y - 9]], '#5fb8e6'); dot(g, x - 1, y, '#d6f2ff'); }
    else if (type === 'note') { rect(g, x + 2, y - 8, 2, 13, '#4a3226'); ell(g, x - 1, y + 5, 4, 3, '#4a3226'); rect(g, x + 2, y - 8, 7, 3, '#4a3226'); }
    else if (type === 'call') { rect(g, x - 1, y - 9, 4, 12, '#d9342b'); rect(g, x - 1, y + 5, 4, 4, '#d9342b'); }
    else if (type === 'dots') { for (let k = -1; k <= 1; k++) rect(g, x + k * 6 - 1, y, 3, 3, '#4a3226'); }
  }

  // Corner brackets around a rectangle; strong = brighter and thicker.
  function brackets(g, r, c = '#fff6d0', strong = false) {
    const x0 = Math.round(r.x), y0 = Math.round(r.y), x1 = x0 + Math.round(r.w) - 1, y1 = y0 + Math.round(r.h) - 1, L = strong ? 12 : 9, T = strong ? 3 : 2;
    for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      const hx = sx > 0 ? x : x - L + 1, vy = sy > 0 ? y : y - L + 1, hy = sy > 0 ? y : y - T + 1, vx = sx > 0 ? x : x - T + 1;
      rect(g, hx - 1, hy - 1, L + 2, T + 2, DK); rect(g, vx - 1, vy - 1, T + 2, L + 2, DK);
      rect(g, hx, hy, L, T, c); rect(g, vx, vy, T, L, c);
    }
  }

  // Evening and night light. At dusk a warm amber wash; at night real darkness with stepped pools cut out
  // around each lamp [x, y, rx, ry] (lanterns, andon lamps, the hearth), then a soft warm glow added back on top.
  let shadeBuf = null;
  function night(g, G, x0, w, lamps) {
    if (G.duskF > 0.01) { g.fillStyle = `rgba(255,140,60,${0.07 * G.duskF})`; g.fillRect(x0, 0, w, VH); }
    if (G.nightF < 0.01) return;
    const f = G.nightF, flick = 0.94 + 0.06 * Math.sin(G.t * 7.3) * Math.sin(G.t * 3.1);
    if (!shadeBuf || shadeBuf.width < w) shadeBuf = PX.mk(w, VH);
    const s = shadeBuf.getContext('2d');
    s.clearRect(0, 0, shadeBuf.width, VH);
    s.fillStyle = `rgba(14,12,44,${0.62 * f})`; s.fillRect(0, 0, w, VH);
    s.globalCompositeOperation = 'destination-out';
    for (const [x, y, rx, ry] of lamps) for (const k of [1.25, 1, 0.74, 0.5]) ell(s, x - x0, y, Math.round(rx * k * flick), Math.round(ry * k * flick), 'rgba(0,0,0,0.26)');
    s.globalCompositeOperation = 'source-over';
    g.drawImage(shadeBuf, 0, 0, w, VH, x0, 0, w, VH);
    for (const [x, y, rx, ry] of lamps) for (const k of [0.9, 0.6]) ell(g, x, y, Math.round(rx * k * flick), Math.round(ry * k * flick), `rgba(255,180,96,${0.05 * f})`);
  }

  return { wood, plaster, tiles, ao, pool, contact, frameRect, lantern, label, tag, tagInk, chip, sky, clock, part, emote, brackets, night, rnd };
})();
