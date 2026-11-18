'use strict';
/* Food art shared by every page: topping icons, bowls and order slips.
   The look: glossy deep-red bowl, rich amber broth, folded noodle strands, halved jammy eggs, pink chashu rounds.
   Bowls animate: noodle strands wobble, the broth shimmers, toppings drop in with a little bounce. */
const ART = (() => {
  const { mk, rect, dot, ell, lathe, poly, line, shade, mix, text, textC, textW } = PX;
  const DK = PX.OUTLINE;
  const BROTH = '#c8792e', BROTH2 = '#8a4518', BROTH3 = '#efb45e', TARE = '#93451f';
  // Colours for the bowl's actual tare / broth kind (bowls store the kind id; older code may store true).
  const brothPal = b => { const k = BROTHS[b && b.broth] || {}; return [k.c || BROTH, k.dark || BROTH2, k.light || BROTH3, k.mid || '#b0652a']; };
  const tareC = b => (TARES[b && b.tare] || {}).c || TARE;
  // Noodle palettes: [highlight, body, shadow under each strand, deep gaps between strands]
  const now = () => (typeof window !== 'undefined' && window.G ? window.G.t : 0);
  const COOKED = ['#fff2bc', '#f0cc78', '#a8702e', '#c18d48'], RAW = ['#fffae0', '#efd99a', '#bf9e56', '#d6ba76'];

  // A loose heap of folded noodle strands inside an ellipse. Each strand is its own wavy line,
  // drawn back to front with a shadow pixel under it, lit where it curves up. t makes them wobble gently.
  function pile(g, cx, cy, rx, ry, t, n, pal = COOKED, th = 1) {
    ell(g, cx, cy, rx, ry, pal[3]);
    for (let i = 0; i < n; i++) {
      const v = -0.82 + 1.64 * (i + 0.5) / n, yc = cy + v * ry;
      const f = 0.13 + ((i * 0.37) % 1) * 0.1, amp = (1.4 + ((i * 0.61) % 1) * 1.6) * (ry / 10 + 0.25), ph = i * 2.3, tilt = (((i * 0.43) % 1) - 0.5) * 0.16;
      const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - v * v))) + 1, wob = Math.sin(t * 1.4 + i * 1.3) * 0.45;
      for (let dx = -hw; dx <= hw; dx++) {
        const y = Math.round(yc + Math.sin(dx * f + ph) * amp + dx * tilt + wob), ex = dx / rx, ey = (y - cy) / ry;
        if (ex * ex + ey * ey > 1) continue;
        const up = Math.cos(dx * f + ph) > 0.35;
        dot(g, cx + dx, y + th, pal[2]);
        for (let k = 0; k < th; k++) dot(g, cx + dx, y + k, k === 0 && up ? pal[0] : pal[1]);
      }
    }
  }

  // Topping icon centred on (x, y). s scales it (1 = about 22px, the size used on trays and slips).
  function top(g, id, x, y, s = 1) {
    const X = v => Math.round(x + v * s), Y = v => Math.round(y + v * s), S = v => Math.max(1, Math.round(v * s));
    const E = (dx, dy, rx, ry, c) => ell(g, X(dx), Y(dy), S(rx), S(ry), c);
    const R = (dx, dy, w, h, c) => rect(g, X(dx), Y(dy), S(w), S(h), c);
    const P = (pts, c) => poly(g, pts.map(([a, b]) => [x + a * s, y + b * s]), c);
    switch (id) {
      case 'chashu': // rolled pork belly slice: charred seared rim, a creamy fat ring, pink meat with a fat spiral
        E(0, 1, 11, 9, DK);
        E(0, 2, 10, 7, '#5e2410');
        E(0, 0, 10, 8, '#a8502c'); E(-1, -1, 9, 7, '#d0784a');
        R(-8, 2, 3, 1, '#5a2010'); R(5, 4, 3, 1, '#5a2010'); R(6, -4, 2, 1, '#6e2c14'); R(-6, -5, 2, 1, '#6e2c14');   // char marks
        E(0, -1, 8, 6, '#f8e2cc'); E(1, 0, 7, 5, '#ecc8a8');
        E(0, -1, 6, 4, '#dc7470'); E(-1, -2, 4, 3, '#f2a098');
        R(-2, -2, 4, 1, '#fbe6d6'); R(2, -2, 1, 3, '#fbe6d6'); R(-3, -1, 1, 3, '#fbe6d6'); R(-2, 2, 4, 1, '#f0c8b0'); R(0, 0, 1, 1, '#fbe6d6');
        R(-7, -5, 3, 1, '#fff2e4'); R(-8, -4, 1, 1, '#fff2e4');
        break;
      case 'egg': // ajitama: soy-marinated rim, glossy white, jammy two-tone yolk
        E(0, 1, 11, 8, DK);
        E(0, 0, 10, 7, '#a8642e');
        E(0, 0, 9, 6, '#e2bc86'); E(-1, -1, 8, 5, '#fff6e6');
        E(1, 0, 5, 4, '#a84e0e'); E(1, 0, 4, 3, '#ec8a1c'); E(2, 1, 2, 1, '#c8501a');
        R(-1, -2, 3, 1, '#ffd27a'); R(-7, -3, 2, 2, '#ffffff'); R(-6, -4, 1, 1, '#ffffff'); R(6, 4, 2, 1, '#c99a68');
        break;
      case 'nori': // toasted seaweed sheet, slightly skewed, with a green sheen and sesame
        P([[-10, -13], [6, -11], [10, 12], [-6, 13]], DK);
        P([[-9, -12], [5, -10], [9, 11], [-5, 12]], '#1c3626');
        P([[-9, -12], [-5, -11.5], [-1, 11.5], [-5, 12]], '#2c5038');
        P([[-4, -11], [-2, -11], [2, 10], [0, 10]], '#3c6a4a');
        R(-5, -4, 11, 1, '#122418'); R(-4, 4, 11, 1, '#122418');
        for (const [ox, oy] of [[3, -7], [-2, 1], [5, 6], [1, -2]]) R(ox, oy, 1, 1, '#f2e6c8');
        R(7, -6, 1, 16, '#0e1c14');
        break;
      case 'scallion': // sliced green onion: hollow rings in two greens, a few white bits
        [[-6, -3, 3], [1, -6, 3], [7, -2, 2], [-2, 3, 3], [5, 5, 3], [-8, 4, 2], [1, 0, 2], [8, 3, 2]].forEach(([ox, oy, r], i) => {
          E(ox, oy, r + 1, r, DK); E(ox, oy, r, r - 1, i % 3 ? '#4fae36' : '#86d256'); E(ox, oy, Math.max(1, r - 1), Math.max(1, r - 2), i % 4 === 3 ? '#f2f6d8' : '#c8ef9a');
          R(ox - r + 1, oy - 1, 1, 1, '#e6fbb8');
        });
        break;
      case 'menma': // soy-braised bamboo shoots: fibrous strips with angled cut ends
        for (const k of [-6, 0, 6]) {
          const yy = -9 + (k === 0 ? 2 : 0);
          R(k - 3, yy, 7, 18, DK); R(k - 2, yy + 1, 5, 16, '#d09a4c');
          R(k - 2, yy + 1, 1, 16, '#f2d08a'); R(k + 1, yy + 1, 1, 16, '#a06a2a');
          R(k, yy + 2, 1, 14, '#b8823a');
          for (let r = 3; r < 16; r += 5) R(k - 1, yy + r, 3, 1, '#e6b86a');
          R(k - 2, yy + 1, 5, 1, '#f6dca0');
        }
        break;
      case 'chili': // fiery threads
        E(0, 3, 9, 4, 'rgba(160,30,20,0.35)');
        for (let i = 0; i < 12; i++) {
          const x0 = -9 + i * 1.6, sw = (i % 3) - 1;
          line(g, X(x0), Y(6), X(x0 + sw * 4), Y(-7 + (i % 2) * 2), i % 3 === 0 ? '#ffb08a' : i % 2 ? '#ff6a3d' : '#c8302a');
        }
        break;
      case 'corn': // sweet kernels with a butter gloss
        E(0, 1, 10, 7, DK); E(0, 1, 9, 6, '#b87810');
        for (const [ox, oy] of [[-7, 0], [-4, -4], [0, -5], [4, -4], [7, 0], [-4, 2], [0, 0], [4, 2], [-2, 5], [2, 5]]) {
          R(ox - 2, oy - 1, 4, 4, '#d0901a'); R(ox - 2, oy - 1, 3, 3, '#ffcf3a'); R(ox - 1, oy, 1, 1, '#fff6c0');
        }
        R(-6, -4, 3, 1, '#fffbe0');
        break;
      case 'butter': // a pat starting to melt into the broth
        E(0, 7, 12, 3, '#e8b83a'); E(-1, 6, 10, 2, '#f8dc78');
        R(-9, -6, 18, 14, DK); R(-8, -5, 16, 12, '#f0d062');
        R(-8, -5, 16, 4, '#fff2a8'); R(-8, -5, 16, 1, '#fffbe0'); R(4, -1, 4, 8, '#d8b448');
        R(3, 6, 4, 4, DK); R(4, 6, 2, 3, '#f0d062');
        R(-6, -4, 4, 1, '#ffffff'); R(-7, 0, 1, 4, '#fff6c0');
        break;
      case 'noodle': // a fresh nest
        E(0, 1, 11, 8, DK);
        E(0, 1, 10, 7, '#a9692c');
        pile(g, x, y, S(9), S(6), 0, Math.max(3, Math.round(7 * s)), RAW);
        R(-5, -4, 2, 1, '#fff8d8');
        break;
    }
  }

  const count = items => { const c = {}; for (const id of items) c[id] = (c[id] || 0) + 1; return c; };
  // counts that should be drawn (toppings still flying through the air are hidden)
  const shown = b => { const c = count(b.items); for (const id in b.hide) c[id] = (c[id] || 0) - b.hide[id]; return c; };

  // Where toppings sit, relative to the rim centre: nori standing at the back left, chashu leaning at the back right,
  // eggs at the front left, noodles swirling in the middle. [x, y, scale]
  const SLOT = {
    nori: [[-30, -16, 1.25], [-19, -19, 1.2]], chashu: [[14, -9, 1.2], [28, -6, 1.15]], menma: [[40, 2, 1], [36, 9, 1]],
    butter: [[18, -2, 0.9], [4, -4, 0.9]], corn: [[4, 10, 0.9], [15, 11, 0.9]], egg: [[-30, 5, 1.15], [-14, 9, 1.15]],
    scallion: [[-4, 1, 1], [-8, 7, 1]], chili: [[8, -4, 1], [20, 3, 1]]
  };
  const MINI = {
    nori: [[-13, -7, 0.6], [-8, -8, 0.55]], chashu: [[7, -4, 0.55], [13, -3, 0.5]], menma: [[19, 0, 0.45], [17, 3, 0.45]],
    butter: [[9, -1, 0.45], [2, -2, 0.45]], corn: [[2, 3, 0.45], [7, 4, 0.45]], egg: [[-13, 2, 0.55], [-6, 3, 0.55]],
    scallion: [[-1, 0, 0.5], [-4, 3, 0.5]], chili: [[4, -2, 0.5], [10, 1, 0.5]]
  };
  const DRAW_ORDER = ['nori', 'chashu', 'menma', 'butter', 'corn', 'egg', 'scallion', 'chili'];

  // Glossy deep-red bowl with a bright rim, a shine stripe and a cool table reflection near the foot.
  // Built once per size and cached, then stamped. cy = rim centre.
  const bodyCache = {};
  function buildBody(rx, ry, depth) {
    const c = mk(2 * rx + 9, 2 * ry + depth + 12), g = c.getContext('2d'), cx = rx + 4, cy = ry + 4;
    const foot = Math.round(rx * 0.5);
    ell(g, cx, cy + depth + 1, Math.round(rx * 0.75), Math.max(2, Math.round(ry * 0.4)), 'rgba(40,10,20,0.28)');
    const half = r => Math.round(foot + (rx - foot) * Math.sqrt(Math.max(0, 1 - Math.pow(r / depth, 2.4))));
    const PAL = ['#ff8a78', '#d8443e', '#b02a36', '#8a1e30', '#64162a', '#420f22', '#2a0a18'];
    for (let r = 0; r <= depth; r++) {
      const w = half(r), y = cy + r;
      rect(g, cx - w - 1, y, 2 * w + 3, 1, DK);
      if (r === depth) continue;
      const v = r / depth;
      for (let x = -w; x <= w; x++) {
        const t = x / w;
        let s = 2.2 + t * 2.1 + v * 1.6;
        if (t > -0.72 && t < -0.5 && v > 0.08 && v < 0.6) s -= 1.5;
        if (r < 2) s -= 0.8;
        let col = PAL[Math.max(0, Math.min(6, Math.round(s)))];
        const q = ((t - 0.2) / 0.5) ** 2 + ((v - 0.76) / 0.13) ** 2;   // cool table reflection, dithered at its edge
        if (q < 1 && (q < 0.6 || (x + r) % 2)) col = t > 0.35 ? '#3e2c48' : '#584462';
        dot(g, cx + x, y, col);
      }
    }
    // gold band with a squared raimon pattern, just under the rim; it darkens with the body on the shaded side
    const rb = ry + Math.max(2, Math.round(depth * 0.08));   // just below the front of the rim
    for (let r = rb; r < rb + 4; r++) {
      const w = half(r) - 1, y = cy + r;
      for (let x = -w; x <= w; x++) {
        const t = x / w, dark = t > 0.45;
        let col;
        if (r === rb || r === rb + 3) col = dark ? '#8a5a20' : '#e0aa48';
        else col = (Math.floor((x + 300) / 3) + r) % 2 ? (dark ? '#a87830' : '#f6d27a') : (dark ? '#4a0e18' : '#7a1a26');
        dot(g, cx + x, y, col);
      }
    }
    rect(g, cx - foot - 1, cy + depth + 1, foot * 2 + 3, 1, DK);
    ell(g, cx, cy, rx + 1, ry + 1, DK); ell(g, cx, cy, rx, ry, '#e2564c');
    ell(g, cx + 1, cy + 1, rx - 1, ry - 1, '#b8323c');
    ell(g, cx, cy + 1, rx - 3, ry - 2, '#3c0e1a'); ell(g, cx, cy + 2, rx - 4, ry - 3, '#5e1824');
    rect(g, cx - Math.round(rx * 0.62), cy - ry + 1, Math.round(rx * 0.42), 1, '#ffb4a2');
    rect(g, cx - rx + 1, cy - 1, 2, 2, '#ff8a78');
    return c;
  }
  function bowlBody(g, cx, cy, rx, ry, depth) {
    const key = rx + ',' + ry + ',' + depth;
    g.drawImage(bodyCache[key] || (bodyCache[key] = buildBody(rx, ry, depth)), Math.round(cx) - rx - 4, Math.round(cy) - ry - 4);
  }

  // Index of each topping in b.items, so we can look up when it landed.
  function landed(b) { const o = {}; b.items.forEach((id, i) => (o[id] = o[id] || []).push(i)); return o; }
  // Drop-in offset: falls for 0.3s, then a small bounce.
  function dropY(b, i, t) {
    const at = b.itemT && b.itemT[i];
    if (at === undefined) return 0;
    const a = t - at;
    if (a >= 0 && a < 0.3) return -Math.round((1 - a / 0.3) ** 2 * 30);
    if (a >= 0.3 && a < 0.45) return -Math.round(Math.sin((a - 0.3) / 0.15 * Math.PI) * 3);
    return 0;
  }

  // The large bowl on the assembly mat. cy is the rim centre.
  function bigBowl(g, cx, cy, b, sel, t) {
    const RX = 56, RY = 18;
    t = t || 0;
    bowlBody(g, cx, cy, RX, RY, 44);
    if (b.tare && !b.broth) { const tc = tareC(b); ell(g, cx, cy + 5, 16, 4, shade(tc, 0.5)); ell(g, cx, cy + 5, 15, 3, tc); ell(g, cx - 4, cy + 4, 7, 1, shade(tc, 1.4)); }
    const sh = shown(b);
    if (b.broth) {
      const [BROTH, BROTH2, BROTH3, MID] = brothPal(b);
      const f = 0.35 + 0.65 * Math.min(1, b.fill);
      const rx = Math.round((RX - 4) * f), ry = Math.max(3, Math.round((RY - 3) * f));
      ell(g, cx, cy + 2, rx, ry, BROTH2); ell(g, cx - 1, cy + 1, Math.max(1, rx - 2), Math.max(1, ry - 2), BROTH);
      ell(g, cx + 6, cy + 3, Math.round(rx * 0.55), Math.max(1, Math.round(ry * 0.45)), MID);
      if (b.fill >= 1) {
        const hx = cx - 26 + Math.round(Math.sin(t * 1.2) * 5);
        ell(g, hx, cy - 3, 10, 1, BROTH3); rect(g, hx - 5, cy - 4, 3, 1, '#ffe2a0');
        [[-38, 0, 2], [-22, 9, 1], [30, -7, 2], [42, 3, 1], [2, 12, 2], [-34, 7, 1], [22, 11, 1], [-8, -10, 1]].forEach(([ox, oy, r], i) => {
          ell(g, cx + ox, cy + oy, r + 1, r, '#e8a050');
          dot(g, cx + ox - 1, cy + oy - 1, Math.sin(t * 2.5 + i * 1.7) > 0.4 ? '#fff4d0' : '#f6c47a');
        });
        if (sh.chili > 0) for (const [ox, oy] of [[-30, 0], [18, -8], [32, 6], [-12, 11], [40, -2], [-42, 4]]) { ell(g, cx + ox, cy + oy, 2, 1, '#c8302a'); dot(g, cx + ox - 1, cy + oy, '#ff7a4a'); }
      }
    }
    if (b.noodles && !b.nHide) {
      const p = b.nT === undefined ? 1 : Math.max(0, Math.min(1, (t - b.nT) / 0.3));
      const rx = Math.round(32 * (0.6 + 0.4 * p)), ry = Math.round(10 * (0.6 + 0.4 * p)), ncx = cx + 6, ncy = cy + 2 - Math.round((1 - p) * 10);
      ell(g, ncx, ncy + 1, rx + 1, ry, '#7a4418');
      pile(g, ncx, ncy, rx, ry, t, 7, COOKED, 2);
    }
    const at = landed(b);
    for (const id of DRAW_ORDER) for (let k = 0; k < Math.min(2, sh[id] || 0); k++) {
      const [ox, oy, s] = SLOT[id][k];
      top(g, id, cx + ox, cy + oy + dropY(b, at[id] && at[id][k], t), s);
    }
    if (sel) {
      const by = cy - 44 + Math.round(Math.sin(t * 5) * 3);
      poly(g, [[cx - 10, by - 2], [cx + 11, by - 2], [cx + 0.5, by + 11]], DK);
      poly(g, [[cx - 7, by], [cx + 8, by], [cx + 0.5, by + 8]], '#ffd76a');
      rect(g, cx - 5, by, 6, 1, '#fff6c8');
    }
  }

  // The small bowl used on the pass, in your hand and on a guest's counter.
  function smallBowl(g, cx, cy, b, t) {
    bowlBody(g, cx, cy, 27, 9, 22);
    if (!b) return;
    t = t === undefined ? now() : t;
    if (b.broth) {
      const [BROTH, BROTH2, BROTH3, MID] = brothPal(b);
      ell(g, cx, cy + 1, 23, 6, BROTH2); ell(g, cx - 1, cy, 21, 5, BROTH); ell(g, cx + 3, cy + 1, 12, 3, MID);
      ell(g, cx - 12 + Math.round(Math.sin(t * 1.2) * 2), cy - 2, 5, 1, BROTH3);
    }
    if (b.noodles) { ell(g, cx + 4, cy + 1, 15, 4, '#7a4418'); pile(g, cx + 3, cy + 1, 14, 4, t, 3); }
    const c = count(b.items);
    for (const id of DRAW_ORDER) for (let k = 0; k < Math.min(2, c[id] || 0); k++) {
      const [ox, oy, s] = MINI[id][k];
      top(g, id, cx + ox, cy + oy, s);
    }
  }

  // Rows shown on an order slip: just the toppings the guest wants (and how many).
  function slipRows(order) {
    return TOPS.filter(id => (order.tops[id] || 0) > 0).map(id => ({ id, want: order.tops[id] }));
  }

  // A printed order ticket, text only like a real kitchen printer slip: the ramen's name, then only the guest's
  // changes to the recipe ("+ EGG", "- SCALLION"). What goes in each ramen lives in the recipe book.
  const SLIP_W = 120, INK = '#3a2f2a', FADED = '#9a8a78';
  const nameLines = m => (textW(m.short) > SLIP_W - 12 ? m.short.split(' ') : [m.short]);
  function slipMods(order) {
    const base = MENU[order.type].tops, out = [];
    for (const id of TOPS) {
      const want = order.tops[id] || 0, had = base[id] || 0;
      if (want > had) out.push({ t: (want - had > 1 ? '+2 ' : '+ ') + TOP_SHORT[id], add: true });
      else if (want < had) out.push({ t: '- ' + TOP_SHORT[id], add: false });
    }
    return out;
  }
  const slipH = order => { const n = nameLines(MENU[order.type]).length, k = slipMods(order).length; return 30 + n * 16 + (k ? 12 + k * 16 : 0) + 10; };
  function dashes(g, x, y, w) { for (let k = 0; k < w; k += 6) rect(g, x + k, y, 3, 1, FADED); }
  // s: { num, stall, order }
  function slip(g, x, y, s) {
    const m = MENU[s.order.type], H = slipH(s.order), names = nameLines(m), mods = slipMods(s.order);
    rect(g, x + 3, y + 3, SLIP_W, H, 'rgba(60,40,30,0.25)');
    rect(g, x - 1, y - 1, SLIP_W + 2, H + 1, DK);
    rect(g, x, y, SLIP_W, H, '#fbf6ea'); rect(g, x + SLIP_W - 2, y, 2, H, '#efe6d2');
    // torn zig-zag bottom edge
    for (let k = 0; k < SLIP_W; k += 8) { poly(g, [[x + k - 1, y + H], [x + k + 9, y + H], [x + k + 4, y + H + 5]], DK); poly(g, [[x + k, y + H - 1], [x + k + 8, y + H - 1], [x + k + 4, y + H + 3]], '#fbf6ea'); }
    // clip
    rect(g, x + SLIP_W / 2 - 9, y - 8, 18, 12, DK); rect(g, x + SLIP_W / 2 - 8, y - 7, 16, 10, '#aab4c4'); rect(g, x + SLIP_W / 2 - 8, y - 7, 16, 2, '#dfe6ee');
    text(g, '#' + s.num, x + 6, y + 9, INK);
    const st = s.stall >= 0 ? 'SEAT ' + (s.stall + 1) : 'LINE';
    text(g, st, x + SLIP_W - 6 - textW(st), y + 9, INK);
    dashes(g, x + 6, y + 22, SLIP_W - 12);
    names.forEach((ln, i) => textC(g, ln, x + SLIP_W / 2, y + 30 + i * 16, m.c));
    if (mods.length) {
      const my = y + 30 + names.length * 16;
      dashes(g, x + 6, my + 2, SLIP_W - 12);
      mods.forEach((md, i) => text(g, md.t, x + 8, my + 10 + i * 16, md.add ? '#2f7a3a' : '#c8302a'));
    }
  }

  return { top, pile, COOKED, RAW, bigBowl, smallBowl, bowlBody, slip, slipRows, slipMods, nameLines, count, shown, BROTH, BROTH2, BROTH3, TARE, SLIP_W, slipH, tareC, brothPal };
})();
