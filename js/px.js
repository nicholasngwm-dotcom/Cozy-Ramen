'use strict';
/* Tiny pixel-art toolkit: every shape is drawn with whole-pixel rectangles,
   then shaded and outlined automatically so all sprites share one look. */
const PX = (() => {
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
  // f < 1 darkens toward a plum shadow, f > 1 lightens toward warm cream
  const shade = (c, f) => f <= 1 ? mix(c, '#1a1024', 1 - f) : mix(c, '#fff6e0', f - 1);

  const rect = (g, x, y, w, h, c) => {
    w = Math.round(w); h = Math.round(h);
    if (w <= 0 || h <= 0) return;
    g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const dot = (g, x, y, c) => rect(g, x, y, 1, 1, c);
  const ell = (g, cx, cy, rx, ry, c) => {
    g.fillStyle = c;
    for (let dy = -ry; dy <= ry; dy++) {
      const t = dy / (ry + 0.5);
      const hw = Math.floor(rx * Math.sqrt(1 - t * t) + 0.5);
      g.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
    }
  };
  // symmetric column of rows: pts = [[y, halfWidth, xOffset?], ...]
  const lathe = (g, cx, pts, c) => {
    g.fillStyle = c;
    for (let i = 0; i < pts.length - 1; i++) {
      const [y0, w0, d0 = 0] = pts[i], [y1, w1, d1 = 0] = pts[i + 1];
      const end = i === pts.length - 2 ? y1 + 1 : y1;
      for (let y = y0; y < end; y++) {
        const t = (y - y0) / Math.max(1, y1 - y0);
        const hw = Math.round(w0 + (w1 - w0) * t), dx = Math.round(d0 + (d1 - d0) * t);
        g.fillRect(cx + dx - hw, y, hw * 2 + 1, 1);
      }
    }
  };
  const poly = (g, pts, c) => {
    g.fillStyle = c;
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const yy = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if (a[1] === b[1]) continue;
        if (yy >= Math.min(a[1], b[1]) && yy < Math.max(a[1], b[1])) xs.push(a[0] + (yy - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const xa = Math.round(xs[i]), xb = Math.round(xs[i + 1]);
        g.fillRect(xa, y, Math.max(1, xb - xa), 1);
      }
    }
  };
  const line = (g, x0, y0, x1, y1, c, th = 1) => {
    g.fillStyle = c;
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      g.fillRect(x0, y0, th, th);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  };

  const OUTLINE = '#120a0e';   // near-black, matching the 1px black outlines on the guest sprites
  // Post-process a layer: rim shading (light from top-left) and a dark outline.
  function finish(c, opts = {}) {
    const outline = opts.outline === undefined ? OUTLINE : opts.outline;
    const shadeOn = opts.shadeOn !== false;
    const W = c.width, H = c.height, g = c.getContext('2d');
    const im = g.getImageData(0, 0, W, H), d = im.data, s = new Uint8ClampedArray(d);
    const A = (x, y) => (y >= H) ? 255 : (x < 0 || y < 0 || x >= W) ? 0 : s[(y * W + x) * 4 + 3];
    const oc = outline ? rgb(outline) : null;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (s[i + 3]) {
        if (!shadeOn) continue;
        let f = 1;
        if (!A(x + 1, y) || !A(x, y + 1)) f = 0.72;
        else if (!A(x + 2, y) || !A(x, y + 2) || !A(x + 1, y + 1)) f = 0.86;
        else if (!A(x - 1, y) || !A(x, y - 1)) f = 1.14;
        if (f < 1) { d[i] = d[i] * f + 26 * (1 - f); d[i + 1] = d[i + 1] * f + 16 * (1 - f); d[i + 2] = d[i + 2] * f + 36 * (1 - f); }
        else if (f > 1) { const t = f - 1; d[i] += (255 - d[i]) * t; d[i + 1] += (246 - d[i + 1]) * t; d[i + 2] += (224 - d[i + 2]) * t; }
      } else if (oc && (A(x + 1, y) || A(x - 1, y) || (y + 1 < H && A(x, y + 1)) || A(x, y - 1))) {
        d[i] = oc[0]; d[i + 1] = oc[1]; d[i + 2] = oc[2]; d[i + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0);
    return c;
  }


  /* ---------- text: the game's one font ----------
     PIXEL_FONT (js/fontdata.js) is a 5x7 pixel font, drawn here with whole-pixel rectangles at a whole-number scale FS
     (1 font pixel = FS canvas pixels). The HTML uses the same glyphs through assets/fonts/CozyPixel.ttf.
       FS 1  tiny labels (shortcut keys, bin labels, small tags)
       FS 2  normal text (dialogue, notes, tickets, HUD, menus)
       FS 3  headings (panel titles, recipe names, profile names)
       FS 4  big titles (region cards, level-up banner)
     Placement: y is the top of a 5-row glyph's old position, so capitals start at y - FS and the baseline row is
     y + 5 * FS (descenders below that). */
  const PF = PIXEL_FONT;
  const FONT = {};
  for (const ch in PF.glyphs) { const rows = PF.glyphs[ch].split(' '); FONT[ch] = { w: rows[0].length, rows }; }
  const glyph = ch => FONT[ch] || FONT[PF.map[ch]] || FONT[ch.toUpperCase()] || FONT['?'];
  let FS = 2;
  const setFont = n => { FS = Math.max(1, Math.round(n)); };   // (whole scales only)
  // o.bold: a fake bold for headings (FS 3+), the glyphs drawn twice, one font pixel apart.
  const bold = o => !!(o && o.bold);
  function textW(s, o) {
    s = String(s); let w = -PF.spacing;
    for (const ch of s) w += glyph(ch).w + PF.spacing;
    return Math.max(0, w + (bold(o) && w > 0 ? 1 : 0)) * FS;
  }
  function text(g, str, x, y, c, o) {
    str = String(str);
    g.fillStyle = c; x = Math.round(x); y = Math.round(y) - FS;
    const b = bold(o) ? 2 : 1;
    for (const ch of str) {
      const gl = glyph(ch);
      for (let r = 0; r < gl.rows.length; r++) for (let k = 0; k < gl.w; k++) if (gl.rows[r][k] === '#') g.fillRect(x + k * FS, y + r * FS, FS * b, FS);
      x += (gl.w + PF.spacing) * FS;
    }
  }
  // The font is part of the game now: nothing to load (kept so callers need not change).
  const loadFont = () => Promise.resolve(true);
  // Line spacing for paragraphs: 11 font pixels (7 rows + 2 descender rows + a 2-pixel gap).
  const lineH = () => (PF.height + PF.descender + 2) * FS;
  // Word-wrap s to maxW px, and never past about `chars` characters a line (long lines are hard to read).
  function wrap(s, maxW, chars = 40, o) {
    const lim = Math.min(maxW, Math.round(textW('abcdefghijklmnopqrstuvwxyz', o) / 26 * chars));
    const out = []; let cur = '';
    for (const w of String(s).split(' ')) { const t = cur ? cur + ' ' + w : w; if (cur && textW(t, o) > lim) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur);
    return out.length ? out : [''];
  }
  // Text over the scene: a dark outline one font pixel wide all round.
  function textO(g, str, x, y, c, oc = OUTLINE, o) {
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) text(g, str, x + ox * FS, y + oy * FS, oc, o);
    text(g, str, x, y, c, o);
  }
  const textC = (g, str, cx, y, c, oc, o) => {
    const x = Math.round(cx - textW(str, o) / 2);
    if (oc) textO(g, str, x, y, c, oc, o); else text(g, str, x, y, c, o);
  };
  // Right-aligned text: its last pixel lands on x - 1 (counts, prices).
  const textR = (g, str, x, y, c, o) => text(g, str, x - textW(str, o), y, c, o);

  return { mk, rgb, mix, shade, rect, dot, ell, lathe, poly, line, finish, text, textO, textC, textR, textW, setFont, loadFont, lineH, wrap, OUTLINE };
})();
