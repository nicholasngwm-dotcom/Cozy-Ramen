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

  // 5x7 proportional pixel font. Each glyph is space-separated rows ('#' = ink); width = row length.
  // Rows 0-6 sit on the baseline, rows 7-8 are lowercase descenders. 1px of spacing follows each glyph.
  const FONT_SRC = {
    A: '.###. #...# #...# ##### #...# #...# #...#', B: '####. #...# #...# ####. #...# #...# ####.',
    C: '.###. #...# #.... #.... #.... #...# .###.', D: '####. #...# #...# #...# #...# #...# ####.',
    E: '##### #.... #.... ####. #.... #.... #####', F: '##### #.... #.... ####. #.... #.... #....',
    G: '.###. #...# #.... #.### #...# #...# .####', H: '#...# #...# #...# ##### #...# #...# #...#',
    I: '### .#. .#. .#. .#. .#. ###', J: '..### ...#. ...#. ...#. ...#. #..#. .##..',
    K: '#...# #..#. #.#.. ##... #.#.. #..#. #...#', L: '#.... #.... #.... #.... #.... #.... #####',
    M: '#...# ##.## #.#.# #.#.# #...# #...# #...#', N: '#...# #...# ##..# #.#.# #..## #...# #...#',
    O: '.###. #...# #...# #...# #...# #...# .###.', P: '####. #...# #...# ####. #.... #.... #....',
    Q: '.###. #...# #...# #...# #.#.# #..#. .##.#', R: '####. #...# #...# ####. #.#.. #..#. #...#',
    S: '.#### #.... #.... .###. ....# ....# ####.', T: '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
    U: '#...# #...# #...# #...# #...# #...# .###.', V: '#...# #...# #...# #...# #...# .#.#. ..#..',
    W: '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.', X: '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
    Y: '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..', Z: '##### ....# ...#. ..#.. .#... #.... #####',
    a: '..... ..... .###. ....# .#### #...# .####', b: '#.... #.... ####. #...# #...# #...# ####.',
    c: '.... .... .### #... #... #... .###', d: '....# ....# .#### #...# #...# #...# .####',
    e: '..... ..... .###. #...# ##### #.... .###.', f: '..## .#.. #### .#.. .#.. .#.. .#..',
    g: '..... ..... .#### #...# #...# #...# .#### ....# .###.', h: '#.... #.... ####. #...# #...# #...# #...#',
    i: '# . # # # # #', j: '..# ... ..# ..# ..# ..# ..# ..# ##.',
    k: '#... #... #..# #.#. ##.. #.#. #..#', l: '#. #. #. #. #. #. .#',
    m: '..... ..... ##.#. #.#.# #.#.# #.#.# #.#.#', n: '..... ..... ####. #...# #...# #...# #...#',
    o: '..... ..... .###. #...# #...# #...# .###.', p: '..... ..... ####. #...# #...# #...# ####. #.... #....',
    q: '..... ..... .#### #...# #...# #...# .#### ....# ....#', r: '.... .... #.## ##.. #... #... #...',
    s: '..... ..... .#### #.... .###. ....# ####.', t: '.#.. .#.. #### .#.. .#.. .#.. ..##',
    u: '..... ..... #...# #...# #...# #...# .####', v: '..... ..... #...# #...# #...# .#.#. ..#..',
    w: '..... ..... #...# #.#.# #.#.# #.#.# .#.#.', x: '..... ..... #...# .#.#. ..#.. .#.#. #...#',
    y: '..... ..... #...# #...# #...# #...# .#### ....# .###.', z: '..... ..... ##### ...#. ..#.. .#... #####',
    0: '.###. #...# #..## #.#.# ##..# #...# .###.', 1: '.#. ##. .#. .#. .#. .#. ###',
    2: '.###. #...# ....# ...#. ..#.. .#... #####', 3: '####. ....# ....# .###. ....# ....# ####.',
    4: '...#. ..##. .#.#. #..#. ##### ...#. ...#.', 5: '##### #.... ####. ....# ....# #...# .###.',
    6: '..##. .#... #.... ####. #...# #...# .###.', 7: '##### ....# ...#. ..#.. .#... .#... .#...',
    8: '.###. #...# #...# .###. #...# #...# .###.', 9: '.###. #...# #...# .#### ....# ...#. .##..',
    ' ': '... ... ... ... ... ... ...', '.': '. . . . . . #', ',': '.. .. .. .. .. .# #.',
    ':': '. . # . . # .', ';': '.. .. .# .. .. .# #.', '!': '# # # # # . #', "'": '# # . . . . .',
    '"': '#.# #.# ... ... ... ... ...', '?': '.###. #...# ....# ...#. ..#.. ..... ..#..',
    '-': '... ... ... ### ... ... ...', '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....',
    '=': '.... .... #### .... #### .... ....', '_': '..... ..... ..... ..... ..... ..... #####',
    '/': '....# ....# ...#. ..#.. .#... #.... #....', '(': '..# .#. #.. #.. #.. .#. ..#', ')': '#.. .#. ..# ..# ..# .#. #..',
    '[': '### #.. #.. #.. #.. #.. ###', ']': '### ..# ..# ..# ..# ..# ###',
    '<': '... ..# .#. #.. .#. ..# ...', '>': '... #.. .#. ..# .#. #.. ...',
    '#': '.#.#. .#.#. ##### .#.#. ##### .#.#. .#.#.', '$': '..#.. .#### #.#.. .###. ..#.# ####. ..#..',
    '%': '##..# ##..# ...#. ..#.. .#... #..## #..##', '&': '.##.. #..#. #.#.. .#... #.#.# #..#. .##.#',
    '*': '..... #.#.# .###. ##### .###. #.#.# .....',
    '’': '.# .# #. .. .. .. ..', '‘': '#. #. .# .. .. .. ..', '`': '#. .# .. .. .. .. ..',
    '“': '#.# #.# .#. ... ... ... ...', '”': '#.# #.# .#. ... ... ... ...',
    '·': '. . . # . . .', '×': '..... ..... #...# .#.#. ..#.. .#.#. #...#',
    '…': '..... ..... ..... ..... ..... ..... #.#.#', '~': '..... ..... .#... #.#.# ...#. ..... .....',
    '@': '.###. #...# #.### #.#.# #.### #.... .####', '|': '# # # # # # #', '\\': '#.... #.... .#... ..#.. ...#. ....# ....#',
    '^': '..#.. .#.#. #...# ..... ..... ..... .....', '{': '..# .#. .#. #.. .#. .#. ..#', '}': '#.. .#. .#. ..# .#. .#. #..',
    '★': '..#.. ..#.. ##### .###. .###. ##.## #...#', '○': '..... .###. #...# #...# #...# .###. .....',
    '–': '.... .... .... #### .... .... ....', '—': '...... ...... ...... ###### ...... ...... ......',
    '→': '..... ...#. ....# ##### ....# ...#. .....', 'é': '...#. ..#.. .###. #...# ##### #.... .###.'
  };
  const FONT = {};
  for (const ch in FONT_SRC) { const rows = FONT_SRC[ch].split(' '); FONT[ch] = { w: rows[0].length, rows }; }
  const glyph = ch => FONT[ch] || FONT[ch.toUpperCase()] || FONT[' '];
  let FS = 2; // font scale: Pixelify Sans is drawn FS * 10 px tall (its pixel grid: crisp only at multiples of 10px)
  let MODE = '';   // 'pixel' forces the bitmap font until the next setFont
  const setFont = (n, mode) => { FS = n; MODE = mode || ''; };
  /* Which font a string gets. The bitmap font above is pixel-perfect at every whole scale, so it draws:
     - everything at FS 1 (small labels), and anything asked for with { font: 'pixel' } or setFont(n, 'pixel');
     - numbers on their own ("12", "08:30", "+16 XP", "Day 3", "Lv 4", "24G", "x2", "#7", "3/5").
     Larger words (FS >= 2) use Pixelify Sans; any digits inside them are still drawn in the bitmap font (see runs). */
  const UNIT = /\b(?:XP|Lv|LV|Lvl|LVL|Day|DAY|G|x|pts?)\b/g;
  const isNum = s => /\d/.test(s) && /^[\s\d+\-x×\/:%.,#$()!?]*$/.test(s.replace(UNIT, '').replace(/(\d)G\b/g, '$1'));
  const NUMRUN = /[+\-#×]?\d[\d.,:\/%]*G?/g;   // a number inside words: "12G", "+16", "3/5", "08:30", "50%"
  const pixelFor = (s, o) => !webfont || (o && o.font === 'pixel') || MODE === 'pixel' || FS === 1 || isNum(s);
  /* The game font is Pixelify Sans (assets/fonts, SIL OFL), drawn hard-edged: each string is rendered once at FS * 10 px
     and cached. Until the font has loaded, the bitmap font stands in for everything.
     Placement matches the bitmap font: y is where the top of a 5-row glyph sat, so capitals start at y - FS and the
     baseline sits at y + 6 * FS (descenders below that). */
  const FAMILY = '"Pixelify Sans"';
  const fpx = () => FS * 10;
  const base = () => Math.round(fpx() * 0.7) - FS;   // baseline below y: capitals start at y - FS
  let webfont = false, mc = null;
  const CACHE = new Map();
  const bitmapW1 = s => { let w = -1; for (const ch of s) w += glyph(ch).w + 1; return Math.max(0, w); };
  const bitmapW = s => bitmapW1(s) * FS;
  function bitmap(g, s, x, y, c) {
    g.fillStyle = c; x = Math.round(x); y = Math.round(y) - FS;
    for (const ch of s) {
      const gl = glyph(ch);
      for (let r = 0; r < gl.rows.length; r++) for (let k = 0; k < gl.w; k++) if (gl.rows[r][k] === '#') g.fillRect(x + k * FS, y + r * FS, FS, FS);
      x += (gl.w + 1) * FS;
    }
  }
  function metrics(s) { mc = mc || document.createElement('canvas').getContext('2d'); mc.font = fpx() + 'px ' + FAMILY; return mc.measureText(s); }
  // Each string is drawn once at a fixed pen position and cached with its real ink extents; textW and text both use
  // those, so centring and label boxes match what is drawn.
  function sprite(s, c) {
    const key = FS + '|' + c + '|' + s;
    let sp = CACHE.get(key); if (sp) return sp;
    if (CACHE.size > 1500) CACHE.clear();
    const size = fpx(), m = metrics(s), PEN = 4 * Math.max(1, Math.ceil(size / 20)) + 4;
    const w = Math.ceil(m.width) + 2 * PEN, h = Math.ceil(size * 1.4), bo = size;
    let col = c, alpha = 255;
    const rgba = /^rgba\(([^)]+)\)/.exec(c);
    if (rgba) { const p = rgba[1].split(','); col = 'rgb(' + p.slice(0, 3).join(',') + ')'; alpha = Math.round(parseFloat(p[3]) * 255); }
    const cv = mk(Math.max(1, w), h), g = cv.getContext('2d');
    g.font = size + 'px ' + FAMILY; g.textBaseline = 'alphabetic'; g.fillStyle = col; g.globalAlpha = alpha / 255;
    if ('fontKerning' in g) g.fontKerning = 'none';
    g.fillText(s, PEN, bo);
    const d = g.getImageData(0, 0, cv.width, h).data;
    let l = cv.width, r = -1;
    for (let x = 0; x < cv.width; x++) for (let y = 0; y < h; y++) if (d[(y * cv.width + x) * 4 + 3] > 60) { if (x < l) l = x; if (x > r) r = x; break; }
    sp = { cv, bo, PEN, adv: Math.round(m.width), l: r < 0 ? PEN : l, w: r < 0 ? 0 : r - l + 1 }; CACHE.set(key, sp);
    return sp;
  }
  // Split a Pixelify string into [text, isNumber] runs, so digits inside words still use the bitmap font.
  function runs(s) {
    const out = []; let i = 0;
    for (const m of s.matchAll(NUMRUN)) { if (m.index > i) out.push([s.slice(i, m.index), false]); out.push([m[0], true]); i = m.index + m[0].length; }
    if (i < s.length) out.push([s.slice(i), false]);
    return out;
  }
  /* Lay out mixed runs from the first ink pixel at x; word runs step by advance width (so spaces count), a number run
     by its glyphs plus the 1px gap. Draws when g is given; returns the width from first to last ink pixel. */
  function mixed(g, rs, x, y, c) {
    const x0 = Math.round(x); let pen = x0, end = x0;
    rs.forEach(([t, num], i) => {
      if (num) { if (g) bitmap(g, t, pen, y, c); end = pen + bitmapW(t); pen = end + FS; return; }
      const sp = sprite(t, c || '#000');
      if (i === 0) pen -= sp.l - sp.PEN;   // so the first ink pixel lands on x
      if (g && t.trim()) g.drawImage(sp.cv, pen - sp.PEN, Math.round(y) + base() - sp.bo);
      if (t.trim()) end = pen - sp.PEN + sp.l + sp.w;
      pen += sp.adv + (/\s$/.test(t) ? 2 * FS : 0);   // Pixelify's space is narrow next to bitmap digits: widen it
    });
    return end - x0;
  }
  function textW(s, o) {
    s = String(s);
    if (pixelFor(s, o)) return bitmapW(s);
    if (!s.trim()) return Math.round(metrics(s).width);
    const rs = runs(s);
    return rs.length === 1 ? sprite(s, '#000').w : mixed(null, rs, 0, 0);
  }
  function text(g, str, x, y, c, o) {
    str = String(str);
    if (pixelFor(str, o)) return bitmap(g, str, x, y, c);
    if (!str.trim()) return;
    const rs = runs(str);
    if (rs.length > 1) return void mixed(g, rs, x, y, c);
    const sp = sprite(str, c); g.drawImage(sp.cv, Math.round(x) - sp.l, Math.round(y) + base() - sp.bo);
  }
  // Load the game font (resolves either way; falls back to the bitmap font if it cannot load).
  function loadFont() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve(false);
    const t = new Promise(r => setTimeout(() => r(false), 4000));
    return Promise.race([document.fonts.load('20px ' + FAMILY).then(() => document.fonts.check('20px ' + FAMILY)), t])
      .then(ok => { if (ok) { webfont = true; CACHE.clear(); } return ok; }, () => false);
  }
  // Line spacing for paragraphs (dialogue bubbles, notes, panels): 1.5 times the font's size.
  const lineH = o => Math.round((pixelFor('a', o) ? 7 * FS : fpx()) * 1.5);
  // Word-wrap s to maxW px, and never past about `chars` characters a line (long lines are hard to read).
  function wrap(s, maxW, chars = 40, o) {
    const lim = Math.min(maxW, Math.round(textW('abcdefghijklmnopqrstuvwxyz', o) / 26 * chars));
    const out = []; let cur = '';
    for (const w of String(s).split(' ')) { const t = cur ? cur + ' ' + w : w; if (cur && textW(t, o) > lim) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur);
    return out.length ? out : [''];
  }
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

  /* HTML numbers. The HUD, store and books are HTML, so their numbers are drawn the same way: each number becomes an
     inline block masked with the bitmap glyphs and painted in the element's own colour (so hover colours still work).
     1 glyph pixel = 1 overlay unit (2 canvas pixels) for HUD-sized text, half a unit for small print. The real text
     stays inside, invisible, for copying and screen readers. A MutationObserver keeps up with HTML the game rewrites. */
  const MASKS = new Map();
  function maskURL(s) {
    let u = MASKS.get(s); if (u) return u;
    const K = 8, cv = mk(Math.max(1, bitmapW1(s)) * K, 9 * K), g = cv.getContext('2d');
    g.fillStyle = '#000'; let x = 0;
    for (const ch of s) {
      const gl = glyph(ch);
      for (let r = 0; r < gl.rows.length; r++) for (let k = 0; k < gl.w; k++) if (gl.rows[r][k] === '#') g.fillRect((x + k) * K, r * K, K, K);
      x += gl.w + 1;
    }
    u = 'url("' + cv.toDataURL() + '")'; MASKS.set(s, u);
    return u;
  }
  function pxSpan(s, small) {
    const sp = document.createElement('span');
    sp.className = 'pxn' + (small ? ' sm' : '');
    sp.textContent = s;
    sp.style.setProperty('--pw', bitmapW1(s));
    sp.style.webkitMaskImage = sp.style.maskImage = maskURL(s);
    return sp;
  }
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION|CANVAS|SVG|TITLE)$/i;
  function pixNode(tn) {
    const el = tn.parentElement, s = tn.nodeValue;
    if (!el || !s || !/\d/.test(s) || el.closest('.pxn,[data-px="off"]') || SKIP.test(el.tagName)) return;
    const u = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 2;
    const small = parseFloat(getComputedStyle(el).fontSize) / u < 6.5;
    const f = document.createDocumentFragment();
    if (isNum(s.trim())) {   // a number on its own: the whole string (with its unit), keeping outer spaces
      const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
      if (lead) f.append(lead);
      f.append(pxSpan(s.trim(), small));
      if (trail) f.append(trail);
    } else {
      let i = 0;
      for (const m of s.matchAll(NUMRUN)) { if (m.index > i) f.append(s.slice(i, m.index)); f.append(pxSpan(m[0], small)); i = m.index + m[0].length; }
      if (i < s.length) f.append(s.slice(i));
    }
    tn.replaceWith(f);
  }
  function walkDOM(n) {
    if (n.nodeType === 3) return pixNode(n);
    if (n.nodeType !== 1 || SKIP.test(n.tagName) || n.classList.contains('pxn')) return;
    for (const k of [...n.childNodes]) walkDOM(k);
  }
  function pixDOM(root) {
    walkDOM(root);
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'characterData') { if (m.target.isConnected) pixNode(m.target); }
        else for (const n of m.addedNodes) if (n.isConnected) walkDOM(n);
      }
    }).observe(root, { childList: true, characterData: true, subtree: true });
  }

  return { mk, rgb, mix, shade, rect, dot, ell, lathe, poly, line, finish, text, textO, textC, textR, textW, setFont, loadFont, lineH, wrap, pixDOM, OUTLINE };
})();
