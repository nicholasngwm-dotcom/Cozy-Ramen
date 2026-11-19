'use strict';
/* Food art shared by every page: topping icons, bowls and order slips.
   The look: glossy deep-red bowl, rich amber broth, folded noodle strands, halved jammy eggs, pink chashu rounds.
   Bowls animate: noodle strands wobble, the broth shimmers, toppings drop in with a little bounce. */
const ART = (() => {
  const { mk, rect, dot, ell, lathe, poly, line, shade, mix, text, textC, textW } = PX;
  const DK = PX.OUTLINE;
  const BROTH = '#c8792e', BROTH2 = '#8a4518', BROTH3 = '#efb45e', TARE = '#93451f';
  // Colours for the bowl's actual tare / broth kind (bowls store the kind id; older code may store true).
  const brothPal = b => { const k = BROTHS[b && b.broth] || {}, p = [k.c || BROTH, k.dark || BROTH2, k.light || BROTH3, k.mid || '#b0652a']; return b && b.spicy ? [mix(p[0], '#d0381e', 0.6), mix(p[1], '#7a140c', 0.6), mix(p[2], '#ff8a4a', 0.55), mix(p[3], '#b02818', 0.6)] : p; };   // chili oil turns the broth red
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
      case 'moyashi': // bean sprouts: a tangle of pale stems, little yellow heads
        E(0, 2, 11, 6, 'rgba(120,100,60,0.25)');
        for (let k = 0; k < 9; k++) {
          const x0 = -9 + k * 2.2, x1 = x0 + ((k % 3) - 1) * 5, y0 = 6 - (k % 2) * 2, y1 = -6 + (k % 3) * 2;
          line(g, X(x0), Y(y0), X(x1), Y(y1), DK); line(g, X(x0) + 1, Y(y0), X(x1) + 1, Y(y1), k % 2 ? '#f6f2dc' : '#e8e4c8');
          if (k % 2 === 0) { R(x1, y1 - 1, 2, 2, '#e8d070'); }
        }
        break;
      case 'bokchoy': // a halved baby bok choy: dark leaf, pale ribbed stem
        P([[-10, -8], [2, -11], [10, -4], [6, 6], [-6, 8], [-11, 0]], DK);
        P([[-9, -7], [2, -10], [9, -4], [5, 5], [-6, 7], [-10, 0]], '#3a8a3a');
        P([[-6, -5], [2, -8], [6, -3], [2, 2], [-4, 3]], '#5aae4a');
        R(-1, -7, 1, 12, '#2a6a2a'); R(-5, -3, 8, 1, '#2a6a2a');
        P([[-3, 3], [4, 1], [7, 8], [-1, 10]], DK); P([[-2, 4], [4, 2], [6, 8], [0, 9]], '#e8f0d0'); R(1, 4, 1, 4, '#c8d8a8');
        break;
      case 'kikurage': // wood ear mushroom: dark, wavy, glossy strips
        for (const [ox, oy, rx, ry] of [[-4, -3, 7, 4], [4, 2, 7, 4], [-3, 5, 5, 3]]) { E(ox, oy, rx + 1, ry + 1, DK); E(ox, oy, rx, ry, '#3a2420'); E(ox - 1, oy - 1, rx - 2, Math.max(1, ry - 2), '#5a3a30'); R(ox - rx + 2, oy - 1, 3, 1, '#8a6a5a'); }
        break;
      case 'naruto': // a slice of narutomaki: white fish cake, ridged edge, pink swirl
        E(0, 0, 10, 9, DK); E(0, 0, 9, 8, '#fbf6ee');
        for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; dot(g, X(Math.cos(t) * 9), Y(Math.sin(t) * 8), a % 2 ? '#e8dcd0' : DK); }
        for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 3.2, r = 1 + a * 0.15; R(Math.cos(t) * r, Math.sin(t) * r * 0.9, 1, 1, '#e8608a'); }
        break;
      case 'torichashu': // pale chicken breast slice: a golden seared rim, white-pink meat, grill lines
        E(0, 1, 11, 8, DK);
        E(0, 1, 10, 7, '#b88a5a'); E(0, 0, 10, 7, '#e8c898'); E(-1, -1, 9, 6, '#f8eadc');
        R(-6, -3, 9, 1, '#e0b890'); R(-4, 0, 10, 1, '#e0b890'); R(-7, 3, 9, 1, '#e0b890');
        E(2, 1, 4, 2, '#f6d6cc'); R(-6, -5, 3, 1, '#ffffff');
        break;
      case 'wakame': // soft seaweed ribbons, dark green, glossy
        for (const [ox, oy, w, k] of [[-8, -4, 12, 0], [-2, 1, 13, 1], [-9, 5, 11, 2]]) {
          for (let i = 0; i < w; i++) { const yy = oy + Math.round(Math.sin(i * 0.8 + k) * 1.5); R(ox + i, yy - 1, 1, 4, DK); }
          for (let i = 0; i < w; i++) { const yy = oy + Math.round(Math.sin(i * 0.8 + k) * 1.5); R(ox + i, yy, 1, 2, k === 1 ? '#3a8a4a' : '#2a6a3a'); if (i % 4 === 1) R(ox + i, yy, 1, 1, '#7ac07a'); }
        }
        break;
      case 'benishoga': // pickled red ginger: a heap of bright red shreds
        E(0, 3, 9, 4, 'rgba(160,20,40,0.3)');
        for (let i = 0; i < 11; i++) {
          const x0 = -8 + (i * 5) % 15, y0 = -5 + (i * 7) % 10, sw = ((i * 3) % 5) - 2;
          line(g, X(x0), Y(y0), X(x0 + 4), Y(y0 + sw), DK); line(g, X(x0), Y(y0) - 1, X(x0 + 4), Y(y0 + sw) - 1, i % 3 === 0 ? '#ff7a8a' : i % 2 ? '#e8304a' : '#c81e3a');
        }
        break;
      case 'yuzupeel': // little curls of yellow zest
        for (const [ox, oy] of [[-6, -3], [3, -5], [6, 3], [-3, 4], [0, 0]]) {
          for (let a = 0; a < 7; a++) { const th = a / 7 * Math.PI * 1.4 + ox; const px = ox + Math.cos(th) * 3, py = oy + Math.sin(th) * 2; R(px - 0.5, py - 0.5, 2, 2, DK); }
          for (let a = 0; a < 7; a++) { const th = a / 7 * Math.PI * 1.4 + ox; R(ox + Math.cos(th) * 3, oy + Math.sin(th) * 2, 1, 1, a % 3 ? '#f0c830' : '#fff090'); }
        }
        break;
      case 'minced': // spicy ground pork: red-brown crumbles in a little mound
        E(0, 2, 11, 7, DK); E(0, 2, 10, 6, '#6a2a14'); E(-1, 0, 8, 5, '#8a3a1a');
        for (let i = 0; i < 18; i++) { const px = -8 + (i * 7) % 17, py = -4 + (i * 5) % 9; R(px, py, 2, 2, i % 3 === 0 ? '#c86a3a' : i % 3 === 1 ? '#a84a24' : '#7a2a12'); }
        R(-5, -3, 2, 1, '#e8905a'); R(2, -4, 2, 1, '#e8905a'); R(5, 1, 1, 1, '#ff6a3d'); R(-2, 3, 1, 1, '#ff6a3d');
        break;
      case 'garlicchip': // thin golden fried garlic slices
        for (const [ox, oy] of [[-6, -3], [2, -5], [6, 2], [-2, 3], [-8, 4], [3, 6]]) {
          E(ox, oy, 4, 3, DK); E(ox, oy, 3, 2, '#d8a848'); E(ox - 1, oy - 1, 2, 1, '#fff0b0'); R(ox, oy, 1, 1, '#a8762a');
        }
        break;
      case 'sesame': // toasted sesame seeds: a pale little heap with a few black seeds
        E(0, 3, 9, 4, 'rgba(120,90,50,0.3)');
        for (let i = 0; i < 26; i++) { const px = Math.round(Math.cos(i * 2.4) * (i % 9)), py = Math.round(Math.sin(i * 2.4) * (i % 9) * 0.55); R(px, py, 2, 1, i % 6 === 0 ? '#2a1e1a' : i % 2 ? '#f6e6c0' : '#e0c890'); }
        break;
      case 'aburaage': // a sweet fried tofu pouch: a golden-brown tilted square with a spongy surface
        P([[-10, -6], [7, -10], [11, 5], [-6, 9]], DK);
        P([[-9, -6], [6, -9], [10, 5], [-6, 8]], '#c8843a');
        P([[-8, -5], [5, -8], [6, -4], [-6, -1]], '#e8ac5a');
        for (const [ox, oy] of [[-4, 0], [1, -3], [4, 2], [-1, 4], [6, -2], [-5, 4]]) R(ox, oy, 1, 1, '#a8642a');
        R(-7, -5, 3, 1, '#ffd890');
        break;
      case 'kakuni': // braised pork belly cube: glossy lacquered top, a creamy fat layer, dark meat
        R(-9, -8, 18, 17, DK);
        R(-8, -7, 16, 5, '#8a3014'); R(-8, -7, 16, 1, '#c8602a'); R(-6, -6, 5, 1, '#ffb070');
        R(-8, -2, 16, 3, '#f2dcc0'); R(-8, -2, 16, 1, '#fff2e0');
        R(-8, 1, 16, 7, '#6a2410'); R(-8, 4, 16, 1, '#e8c8a8'); R(4, 1, 4, 7, '#4a180a');
        break;
      case 'shiitake': // two brown mushroom caps, each with a cross cut
        for (const [ox, oy, r] of [[-4, -2, 7], [5, 4, 6]]) {
          E(ox, oy, r + 1, r, DK); E(ox, oy, r, r - 1, '#7a4a2a'); E(ox - 1, oy - 1, r - 2, r - 3, '#9a6438');
          line(g, X(ox - r + 3), Y(oy), X(ox + r - 3), Y(oy), '#f2dcc0'); line(g, X(ox), Y(oy - r + 3), X(ox), Y(oy + r - 3), '#f2dcc0');
          R(ox - r + 2, oy - 2, 2, 1, '#c8904a');
        }
        break;
      case 'clam': // little asari clams, one open to show the meat
        for (const [ox, oy, open] of [[-5, 1, 1], [5, -2, 0], [3, 5, 0]]) {
          E(ox, oy, 6, 4, DK); E(ox, oy, 5, 3, open ? '#f0c8a0' : '#cfc6bc');
          if (open) { E(ox, oy - 3, 5, 2, DK); E(ox, oy - 3, 4, 1, '#d8d0c8'); E(ox + 1, oy, 2, 1, '#e8a080'); }
          else for (let k = -3; k <= 3; k += 2) R(ox + k, oy - 1, 1, 3, '#9a9088');
          R(ox - 3, oy - 1, 2, 1, '#ffffff');
        }
        break;
      case 'shrimp': // a whole cooked shrimp curled in a C, striped orange, a fanned tail
        for (let a = 0; a <= 8; a++) { const th = Math.PI * 0.25 + a / 8 * Math.PI * 1.25, r = 7 - a * 0.25; E(Math.cos(th) * 6, Math.sin(th) * 5, r * 0.55 + 1, r * 0.45 + 1, DK); }
        for (let a = 0; a <= 8; a++) { const th = Math.PI * 0.25 + a / 8 * Math.PI * 1.25, r = 7 - a * 0.25; E(Math.cos(th) * 6, Math.sin(th) * 5, r * 0.55, r * 0.45, a % 2 ? '#ff8a4a' : '#ffb07a'); }
        P([[3, -6], [9, -9], [9, -3]], DK); P([[4, -6], [8, -8], [8, -4]], '#e8502a');
        R(-5, 1, 1, 1, DK);
        break;
      case 'mayu': // black garlic oil, not yet poured: a dark glossy drop
        E(0, 2, 8, 4, DK); E(0, 2, 7, 3, '#2a2024'); E(-2, 1, 3, 1, '#6a5a5a'); R(-1, 0, 1, 1, '#a89a98');
        break;
      case 'sunpetal': // an edible meadow flower: five yellow-pink petals, an amber heart
        for (let k = 0; k < 5; k++) { const th = k / 5 * Math.PI * 2 - Math.PI / 2; E(Math.cos(th) * 5, Math.sin(th) * 4.5, 4, 3, DK); }
        for (let k = 0; k < 5; k++) { const th = k / 5 * Math.PI * 2 - Math.PI / 2; E(Math.cos(th) * 5, Math.sin(th) * 4.5, 3, 2, k % 2 ? '#f8a0b8' : '#ffe070'); }
        E(0, 0, 2, 2, '#e88a2a'); R(-1, -1, 1, 1, '#fff6c0');
        break;
      case 'mandrake': // sliced mandrake root: pale rounds with a darker ring; one still has a tiny worried face
        for (const [ox, oy, face] of [[-5, 2, 0], [4, -2, 1], [5, 5, 0]]) {
          E(ox, oy, 6, 5, DK); E(ox, oy, 5, 4, '#e8dcbc'); E(ox, oy, 3, 2, '#f6eed8');
          if (face) { R(ox - 2, oy - 1, 1, 1, DK); R(ox + 1, oy - 1, 1, 1, DK); R(ox - 1, oy + 1, 2, 1, '#8a5a3a'); }
        }
        break;
      case 'glowcap': // a mushroom that glows: a blue-green cap with bright spots on a pale stem
        R(-2, 0, 5, 8, DK); R(-1, 1, 3, 6, '#e8f0d8');
        E(0, -2, 9, 6, DK); E(0, -2, 8, 5, '#2aa898'); E(-2, -4, 5, 2, '#5ad8c8');
        R(-5, -3, 2, 2, '#c8fff4'); R(2, -5, 2, 1, '#c8fff4'); R(4, -1, 1, 1, '#c8fff4'); R(-1, -1, 1, 1, '#a8fff0');
        break;
      case 'frostleaf': // a cooling herb: an icy blue-green leaf with a white vein and frost specks
        P([[-10, 6], [-6, -4], [2, -10], [10, -8], [6, 2], [-2, 8]], DK);
        P([[-9, 5], [-5, -4], [2, -9], [9, -7], [5, 2], [-2, 7]], '#6ac8d0');
        P([[-9, 5], [-5, -4], [2, -9], [-2, 1]], '#9ae4ea');
        line(g, X(-8), Y(5), X(7), Y(-6), '#e8fbff');
        for (const [ox, oy] of [[-3, -2], [4, -2], [0, 4], [-6, 2]]) R(ox, oy, 1, 1, '#ffffff');
        break;
      case 'emberpep': // a red pepper that keeps smouldering: orange flecks, a green stem, a wisp of heat
        P([[-9, 4], [-4, -3], [4, -6], [9, -5], [5, 1], [-4, 6]], DK);
        P([[-8, 4], [-4, -2], [4, -5], [8, -4], [4, 1], [-4, 5]], '#c8302a');
        P([[-6, 2], [-3, -2], [4, -4], [2, -2]], '#e8503a');
        R(8, -7, 3, 3, DK); R(9, -6, 2, 2, '#4a8a3a');
        for (const [ox, oy] of [[-2, 1], [2, -2], [-5, 3], [5, -3]]) R(ox, oy, 1, 1, '#ffb03a');
        R(-3, -6, 1, 2, '#ffd04a'); R(0, -8, 1, 2, '#ff8a3a');
        break;
      case 'kraken': // thick-cut grilled tentacle: purple-pink rounds, pale suckers, grill char
        for (const [ox, oy, r] of [[-4, 0, 7], [5, 3, 6]]) {
          E(ox, oy, r + 1, r, DK); E(ox, oy, r, r - 1, '#a85a9a'); E(ox, oy, r - 2, r - 3, '#e8c8d8');
          for (let a = 0; a < 6; a++) { const th = a / 6 * Math.PI * 2; R(ox + Math.cos(th) * (r - 1), oy + Math.sin(th) * (r - 2), 1, 1, '#f8d8ec'); }
          R(ox - 2, oy - 1, 3, 1, '#6a2a5a');
        }
        break;
      case 'cockegg': // a halved cockatrice egg: twice the size of a ramen egg, with a molten golden yolk
        E(0, 1, 14, 10, DK);
        E(0, 0, 13, 9, '#b8843a');
        E(0, 0, 12, 8, '#f0d8a8'); E(-1, -1, 11, 7, '#fff8ea');
        E(1, 0, 7, 5, '#c87a0a'); E(1, 0, 6, 4, '#ffb800'); E(2, 1, 3, 2, '#ff9a00');
        R(-1, -3, 4, 1, '#fff07a'); R(-9, -4, 2, 2, '#ffffff'); R(-8, -5, 1, 1, '#ffffff');
        break;
      case 'wyvern': // smoky wyvern chashu: dark red meat, a charred edge, a pale fat swirl
        E(0, 1, 11, 9, DK);
        E(0, 2, 10, 7, '#2a0e0a');
        E(0, 0, 10, 8, '#5a1612'); E(-1, -1, 9, 7, '#8a2a22');
        R(-8, 2, 3, 1, '#1a0806'); R(5, 4, 3, 1, '#1a0806'); R(6, -4, 2, 1, '#1a0806');
        E(0, -1, 6, 4, '#a83a32'); E(-1, -2, 4, 3, '#c85a4a');
        R(-2, -2, 4, 1, '#e8a898'); R(2, -2, 1, 3, '#e8a898'); R(-3, -1, 1, 3, '#e8a898');
        R(-7, -5, 3, 1, '#ff8a5a');
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
    scallion: [[-4, 1, 1], [-8, 7, 1]], chili: [[8, -4, 1], [20, 3, 1]],
    naruto: [[-6, -10, 1], [6, -13, 1]], kikurage: [[-40, -2, 0.95], [-36, 6, 0.95]], moyashi: [[26, 7, 1], [33, -2, 1]], bokchoy: [[-20, -8, 1.05], [-44, 1, 1]],
    torichashu: [[14, -9, 1.2], [28, -6, 1.15]], wyvern: [[14, -9, 1.2], [28, -6, 1.15]], kraken: [[14, -9, 1.15], [28, -6, 1.1]],
    kakuni: [[-4, -11, 1.1], [8, -14, 1.05]], aburaage: [[16, -9, 1.1], [30, -5, 1.05]], shiitake: [[16, -6, 1], [30, -2, 1]], mandrake: [[16, -6, 1.1], [28, -2, 1.05]],
    wakame: [[-40, -2, 1], [-36, 6, 1]], benishoga: [[36, 4, 0.95], [30, 10, 0.9]], yuzupeel: [[6, 10, 0.9], [16, 11, 0.9]], garlicchip: [[4, 10, 0.9], [15, 11, 0.9]],
    minced: [[0, -8, 1.15], [14, -10, 1.05]], sesame: [[-2, 4, 1], [10, 6, 1]], clam: [[-30, 5, 1], [-14, 9, 1]], shrimp: [[30, 4, 1], [38, -4, 1]], mayu: [[-4, 0, 0.8], [6, 2, 0.8]],
    sunpetal: [[-14, -2, 0.95], [-2, -6, 0.9]], glowcap: [[-6, -10, 1], [-30, -12, 0.95]], frostleaf: [[6, -8, 1.05], [-6, -2, 1]], emberpep: [[-6, -6, 0.9], [4, 6, 0.9]],
    cockegg: [[-26, 4, 1.3], [-8, 8, 1.2]]
  };
  const MINI = {
    nori: [[-13, -7, 0.6], [-8, -8, 0.55]], chashu: [[7, -4, 0.55], [13, -3, 0.5]], menma: [[19, 0, 0.45], [17, 3, 0.45]],
    butter: [[9, -1, 0.45], [2, -2, 0.45]], corn: [[2, 3, 0.45], [7, 4, 0.45]], egg: [[-13, 2, 0.55], [-6, 3, 0.55]],
    scallion: [[-1, 0, 0.5], [-4, 3, 0.5]], chili: [[4, -2, 0.5], [10, 1, 0.5]],
    naruto: [[-3, -5, 0.5], [3, -6, 0.5]], kikurage: [[-18, -1, 0.45], [-16, 3, 0.45]], moyashi: [[12, 3, 0.45], [15, -1, 0.45]], bokchoy: [[-9, -4, 0.5], [-19, 1, 0.45]]
  };
  for (const id in SLOT) if (!MINI[id]) MINI[id] = SLOT[id].map(([x, y, sc]) => [Math.round(x * 0.46), Math.round(y * 0.45), Math.round(sc * 46) / 100]);
  const DRAW_ORDER = ['nori', 'wakame', 'bokchoy', 'chashu', 'torichashu', 'wyvern', 'kraken', 'kakuni', 'aburaage', 'shiitake', 'mandrake', 'naruto', 'glowcap', 'menma',
    'kikurage', 'moyashi', 'benishoga', 'frostleaf', 'shrimp', 'clam', 'butter', 'corn', 'garlicchip', 'yuzupeel', 'minced', 'egg', 'cockegg', 'sunpetal', 'scallion', 'sesame',
    'chili', 'emberpep', 'mayu'];

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

  /* ---------- special steps on the bowl (b.fx, set in game.js) ----------
     chiliN / chiliLive: swirls of chili oil poured; torch / torchLive: how far the chashu was seared; egg: 'whole' until
     it is sliced; b.butterAt: when the butter landed (it melts over BUTTER_MELT seconds). */
  const BUTTER_MELT = 45;
  const meltOf = (b, t) => (b.butterAt === undefined ? 0 : Math.max(0, Math.min(1, (t - b.butterAt) / BUTTER_MELT)));
  const OILS = { chili: ['#e8502a', '#ff8a4a'], ember: ['#ff8a1a', '#ffd04a'], mayu: ['#1e1618', '#5a4a4a'] };
  function oilSwirl(g, cx, cy, rx, ry, n, t, kind = 'chili') {   // n rings of oil drifting on the broth (chili red, ember orange, black garlic)
    const oc = OILS[kind];
    for (let k = 0; k < n; k++) {
      const r = 0.35 + k * 0.28, seg = 18 + k * 8;
      for (let a = 0; a < seg; a++) {
        if (a % 3 === 2) continue;
        const th = a / seg * Math.PI * 2 + t * 0.4 + k * 1.3, x = cx + Math.round(Math.cos(th) * rx * r), y = cy + Math.round(Math.sin(th) * ry * r);
        dot(g, x, y, a % 2 ? oc[0] : oc[1]);
      }
    }
  }
  function sear(g, x, y, s, amt) {   // browned (or charred) edges on a chashu slice; amt 0-1 golden, past 1 charred
    if (amt <= 0.05) return;
    const c = amt > 1 ? '#2a140c' : amt > 0.6 ? '#6e3414' : '#a8582a', n = Math.round(10 + 6 * Math.min(1, amt));
    for (let a = 0; a < n; a++) { const th = a / n * Math.PI * 2; dot(g, Math.round(x + Math.cos(th) * 9 * s), Math.round(y + 1 + Math.sin(th) * 7 * s), c); }
    if (amt > 0.6) { dot(g, Math.round(x - 3 * s), Math.round(y - 2 * s), c); dot(g, Math.round(x + 4 * s), Math.round(y + 2 * s), c); }
  }
  function wholeEgg(g, x, y, s) {   // a soy-marinated egg before it is sliced: smooth, tan, glossy
    const E = (dx, dy, rx, ry, c) => ell(g, Math.round(x + dx * s), Math.round(y + dy * s), Math.max(1, Math.round(rx * s)), Math.max(1, Math.round(ry * s)), c);
    E(0, 1, 9, 7, DK); E(0, 0, 8, 6, '#c8925a'); E(-1, -1, 6, 4, '#e2b07a'); E(-3, -3, 2, 1, '#fff2d8');
  }
  // Toppings as the bowl shows them, with any special step applied.
  function wholeCockegg(g, x, y, s) {   // the cockatrice egg before slicing: big, speckled gold-tan
    const E = (dx, dy, rx, ry, c) => ell(g, Math.round(x + dx * s), Math.round(y + dy * s), Math.max(1, Math.round(rx * s)), Math.max(1, Math.round(ry * s)), c);
    E(0, 1, 13, 10, DK); E(0, 0, 12, 9, '#c8a050'); E(-2, -2, 8, 5, '#e8c878'); E(-4, -4, 3, 1, '#fff6d8');
    for (const [dx, dy] of [[4, 2], [-3, 4], [6, -3], [0, -1]]) dot(g, Math.round(x + dx * s), Math.round(y + dy * s), '#8a6a2a');
  }
  function wholeRoot(g, x, y, s) {   // the mandrake root before slicing: a pale root with leaves and a little face
    const E = (dx, dy, rx, ry, c) => ell(g, Math.round(x + dx * s), Math.round(y + dy * s), Math.max(1, Math.round(rx * s)), Math.max(1, Math.round(ry * s)), c);
    for (const [dx, c] of [[-3, '#3a8a3a'], [0, '#5aae4a'], [3, '#3a8a3a']]) line(g, Math.round(x), Math.round(y - 6 * s), Math.round(x + dx * s * 1.5), Math.round(y - 12 * s), c, 2);
    E(0, 0, 6, 8, DK); E(0, 0, 5, 7, '#e2d0a8'); E(-2, -2, 2, 4, '#f6ead0');
    line(g, Math.round(x + 2 * s), Math.round(y + 7 * s), Math.round(x + 4 * s), Math.round(y + 11 * s), '#c8b088');
    dot(g, Math.round(x - 2 * s), Math.round(y - 1 * s), DK); dot(g, Math.round(x + 2 * s), Math.round(y - 1 * s), DK); dot(g, Math.round(x), Math.round(y + 2 * s), '#8a5a3a');
  }
  function groundSesame(g, x, y, s, how) {   // sesame after grinding: a fine pale dusting (coarse: seeds; paste: a brown smear)
    if (how === 'paste') { ell(g, x, y, Math.round(8 * s), Math.round(4 * s), '#8a6a3a'); ell(g, x - 2, y - 1, Math.round(4 * s), Math.round(2 * s), '#a8844a'); return; }
    const n = how === 'coarse' ? 14 : 34;
    for (let i = 0; i < n; i++) { const a = i * 2.39996, r = Math.sqrt(i / n) * 11 * s; dot(g, Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.5), i % 7 === 0 ? '#3a2a22' : i % 2 ? '#f6e6c0' : '#d8c090'); }
  }
  const nightNow = () => (typeof window !== 'undefined' && window.G ? (window.G.nightF || 0) : 0);
  function topFx(g, b, id, x, y, s, t) {
    const fx = b.fx || {};
    if (id === 'egg' && fx.egg === 'whole') return wholeEgg(g, x, y, s);
    if (id === 'cockegg' && fx.cegg === 'whole') return wholeCockegg(g, x, y, s);
    if (id === 'mandrake' && fx.mandrake === 'whole') return wholeRoot(g, x, y, s);
    if (id === 'sesame' && fx.sesame && fx.sesame !== 'pending') return groundSesame(g, x, y, s, fx.sesame);
    if (id === 'mayu' && fx.mayu && fx.mayu !== 'pending') return;   // poured: it is the swirl on the broth now
    if (id === 'glowcap' && nightNow() > 0.3) {   // after dark the cap glows
      const a = 0.25 + 0.1 * Math.sin(t * 2.2 + x);
      g.globalAlpha = a; ell(g, x, y - Math.round(2 * s), Math.round(13 * s), Math.round(9 * s), '#8affea'); g.globalAlpha = 1;
    }
    if (id === 'butter') {
      const m = meltOf(b, t);
      ell(g, x, y + Math.round(5 * s), Math.max(1, Math.round((6 + 8 * m) * s)), Math.max(1, Math.round((2 + m) * s)), '#f8dc78');   // the puddle spreads
      if (m < 1) top(g, 'butter', x, y + Math.round(m * 4 * s), s * (1 - 0.6 * m));
      return;
    }
    top(g, id, x, y, s);
    if (TORCH_MEATS.includes(id)) sear(g, x, y, s, fx.torchLive !== undefined ? fx.torchLive : fx.torch === 'perfect' ? 0.8 : fx.torch === 'charred' ? 1.3 : fx.torch === 'light' ? 0.35 : 0);
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
    const fx = b.fx || {};
    if (b.broth) for (const [k, ox, oy] of [['mayu', 0, 0], ['chili', -4, 2], ['ember', 2, 3]]) {
      const oil = fx[k + 'Live'] !== undefined ? fx[k + 'Live'] : fx[k + 'N'] || 0;
      if (oil) oilSwirl(g, cx + ox, cy + oy, k === 'mayu' ? 40 : 46, k === 'mayu' ? 11 : 13, Math.min(3, oil), t + (k === 'mayu' ? 2 : 0), k);
    }
    if (b.cold && b.broth) for (const [ox, oy, w] of [[-36, -2, 6], [32, 4, 5], [-20, 9, 5], [40, -6, 4]]) {   // ice cubes float on cold ramen
      rect(g, cx + ox - 1, cy + oy - 1, w + 2, w, DK); rect(g, cx + ox, cy + oy, w, w - 2, '#e8fbff'); rect(g, cx + ox, cy + oy, w, 1, '#ffffff'); rect(g, cx + ox + w - 2, cy + oy + 1, 2, w - 3, '#b8e4f4');
    }
    const at = landed(b);
    for (const id of DRAW_ORDER) for (let k = 0; k < Math.min(2, sh[id] || 0); k++) {
      const [ox, oy, s] = SLOT[id][k];
      topFx(g, b, id, cx + ox, cy + oy + dropY(b, at[id] && at[id][k], t), s, t);
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
    const fx = b.fx || {};
    if (b.broth) for (const k of ['mayu', 'chili', 'ember']) if (fx[k + 'N']) oilSwirl(g, cx - 2, cy + 1, 20, 5, Math.min(3, fx[k + 'N']), t, k);
    if (b.cold && b.broth) { rect(g, cx - 18, cy - 1, 3, 2, '#e8fbff'); rect(g, cx + 15, cy + 1, 3, 2, '#e8fbff'); }
    const c = count(b.items);
    for (const id of DRAW_ORDER) for (let k = 0; k < Math.min(2, c[id] || 0); k++) {
      const [ox, oy, s] = MINI[id][k];
      topFx(g, b, id, cx + ox, cy + oy, s, t);
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

  // Ink colours for the printed recipe pictures (the recipe book, its cover and the road card).
  const FIG_INK = '#3b2a22', FIG_PAPER = '#e6d3ad';
  const wash = c => mix(c, FIG_PAPER, 0.4), faint = mix(FIG_INK, FIG_PAPER, 0.55);
  /* The recipe's picture is the real bowl: the same big bowl the kitchen builds (same toppings, same places, the special
     steps done: sliced egg, seared chashu, chili oil), drawn at half size and printed in ink: flat colours under a sepia
     wash, a dark ink outline, steam wisps. So the book always matches the bowl you make. */
  const figCache = {};
  function figURL(type) {
    if (figCache[type]) return figCache[type];
    const m = MENU[type], items = Object.entries(m.tops).flatMap(([id, n]) => Array(n).fill(id));
    const bowl = { s: 3, tare: m.tare, broth: m.broth, fill: 1, noodles: 'perfect', items, hide: {},
      cold: !!m.cold, spicy: !!m.spicy, fx: { egg: 'sliced', cegg: 'sliced', mandrake: 'sliced', sesame: 'perfect', emberN: m.tops.emberpep || undefined,
        mayuN: m.tops.mayu ? 1 : undefined, mayu: m.tops.mayu ? 'done' : undefined, torch: TORCH_RECIPES.includes(type) ? 'perfect' : undefined } };
    // 1. the real bowl, full size
    const big = mk(140, 104), bg = big.getContext('2d'); bg.imageSmoothingEnabled = false;
    bigBowl(bg, 70, 40, bowl, false, 0);
    // 2. half size (averaged, so the toppings stay readable)
    const W = 70, H = 54, c = mk(W, H), g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(big, 0, 0, 140, 104, 0, 2, W, 52);
    // 3. printed in ink: flat, faded colours; dark lines become ink; an ink outline around the whole shape
    const im = g.getImageData(0, 0, W, H), d = im.data, A = new Uint8Array(W * H);
    const ink = [59, 42, 34], paper = [230, 211, 173];
    for (let p = 0; p < W * H; p++) {
      const q = p * 4; A[p] = d[q + 3] > 110 ? 1 : 0;
      if (!A[p]) { d[q + 3] = 0; continue; }
      const r = d[q], gg = d[q + 1], b = d[q + 2], lum = 0.3 * r + 0.59 * gg + 0.11 * b;
      if (lum < 34) { d[q] = ink[0]; d[q + 1] = ink[1]; d[q + 2] = ink[2]; d[q + 3] = 255; continue; }
      const flat = v => Math.min(255, Math.round(v / 32) * 32), grey = (flat(r) + flat(gg) + flat(b)) / 3;
      const col = [flat(r), flat(gg), flat(b)].map(v => v + (grey - v) * 0.12);   // a little less saturated
      for (let k = 0; k < 3; k++) d[q + k] = Math.round(col[k] + (paper[k] - col[k]) * 0.2);   // the sepia wash
      d[q + 3] = 255;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {   // the outline: empty pixels touching the bowl
      const p = y * W + x; if (A[p]) continue;
      if ((x > 0 && A[p - 1]) || (x < W - 1 && A[p + 1]) || (y > 0 && A[p - W]) || (y < H - 1 && A[p + W])) { const q = p * 4; d[q] = ink[0]; d[q + 1] = ink[1]; d[q + 2] = ink[2]; d[q + 3] = 255; }
    }
    g.putImageData(im, 0, 0);
    // 4. steam: three thin, broken ink wisps
    const faintInk = mix(FIG_INK, FIG_PAPER, 0.55);
    for (const [ox, h] of [[-9, 9], [1, 11], [11, 8]]) for (let k = 0; k < h; k++) if (k % 5 !== 4) dot(g, 35 + ox + Math.round(Math.sin(k * 0.55 + ox) * 1.5), 12 - k, faintInk);
    return (figCache[type] = c.toDataURL());
  }
  // A printed figure: the illustration in a thin frame with a caption under it ("Fig. 1 - Miso Ramen"). It is ink on the
  // page, so it cannot be grabbed (drags fall through to the page). cls adds a size / placement class.
  const figNo = type => Object.keys(MENU).indexOf(type) + 1;
  // (spans, not <figure>, so it can sit inside any paragraph or inline element)
  const figure = (type, cls = '', extra = '') => `<span class="ink-fig ${cls}" role="img" aria-label="Fig. ${figNo(type)}: ${MENU[type].name}"><img class="px" src="${figURL(type)}" alt="" draggable="false"><span class="figcap">Fig. ${figNo(type)} &ndash; ${MENU[type].name}</span>${extra}</span>`;

  return { BUTTER_MELT, meltOf, wholeEgg, top, pile, COOKED, RAW, bigBowl, smallBowl, bowlBody, slip, slipRows, slipMods, nameLines, count, shown, BROTH, BROTH2, BROTH3, TARE, SLIP_W, slipH, tareC, brothPal, figURL, figure };
})();
