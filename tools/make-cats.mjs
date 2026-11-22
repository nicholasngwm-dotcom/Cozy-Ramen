// Bakes the shop cats from the RetroCats sheet (tools/art/RetroCatsFree.png, 64px cells) into one strip per coat:
// assets/cats/<id>.png, 64x64 frames: 0-3 grooming, 4-5 meowing (the petted pose), 6-9 asleep, then the side-on poses made
// here (10-17 walk, 18-19 stand, 20 stretch, 21 crouch, 22 leap). Also assets/cats/toys.png: two balls and a food tin.
// Each pose in the sheet is drawn in a different coat, so every source colour is mapped to a role (fur, belly, ears...)
// and each coat paints those roles in its own colours.
// Run: node tools/make-cats.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'tools/art/RetroCatsFree.png');
const OUT = path.join(ROOT, 'assets/cats');

/* ---------- a tiny PNG reader / writer (8-bit RGBA only) ---------- */
function readPNG(file) {
  const d = fs.readFileSync(file); let i = 8, w, h, ct; const idat = [];
  while (i < d.length) {
    const n = d.readUInt32BE(i), t = d.toString('latin1', i + 4, i + 8), c = d.subarray(i + 8, i + 8 + n); i += 12 + n;
    if (t === 'IHDR') { w = c.readUInt32BE(0); h = c.readUInt32BE(4); ct = c[9]; if (c[8] !== 8 || ct !== 6) throw new Error('expected 8-bit RGBA'); }
    else if (t === 'IDAT') idat.push(c);
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), st = w * 4, px = Buffer.alloc(w * h * 4);
  for (let y = 0, p = 0; y < h; y++) {
    const f = raw[p++];
    for (let x = 0; x < st; x++) {
      const a = x >= 4 ? px[y * st + x - 4] : 0, b = y ? px[(y - 1) * st + x] : 0, c = x >= 4 && y ? px[(y - 1) * st + x - 4] : 0;
      let v = raw[p++];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * st + x] = v & 255;
    }
  }
  return { w, h, px };
}
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function writePNG(file, w, h, px) {
  const chunk = (t, data) => { const len = Buffer.alloc(4), tc = Buffer.concat([Buffer.from(t, 'latin1'), data]), cr = Buffer.alloc(4); len.writeUInt32BE(data.length); cr.writeUInt32BE(crc(tc)); return Buffer.concat([len, tc, cr]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}

/* ---------- source colours -> roles, per pose row ---------- */
// fur / furD: coat and its shade; belly / bellyD: chest, paws, muzzle; ear / earL: inner ears, nose, pads;
// out: outline; eye: open eyes; lick: the grooming sparkle; shadow: the little ground shadow; z: the sleep z's; keep: as drawn
const ROLES = [
  { c0: 0, frames: 4, map: { c9ac99: 'fur', c0a18d: 'furD', '362010': 'out', ffffe3: 'belly', eaead3: 'bellyD', db7f7f: 'ear', e19792: 'earL', '76adde': 'blue', '6d9ec9': 'blue' } },
  { c0: 0, frames: 2, map: { e8e8e8: 'fur', dedede: 'furD', ffffff: 'belly', '3c3c3c': 'out', '151515': 'lines', f0abc4: 'ear', ffe0ee: 'earL', '3a5a8d': 'eye' } },
  { c0: 0, frames: 4, map: { '52555a': 'fur', '484b4f': 'furD', '000000': 'out', ffffe3: 'belly', eaead3: 'bellyD', dedec9: 'bellyD', f0f0dc: 'belly', db7f7f: 'ear', e19792: 'earL' } }
];

/* ---------- the coats ---------- */
// stripe: an optional pattern over the fur (not the belly): its colour on the fur and on the fur's shade
const COATS = {
  casper: { fur: 'f6f4f2', furD: 'e2dfdc', belly: 'ffffff', bellyD: 'ecebe8', ear: 'f2a8b8', earL: 'ffd8e2', out: '2a2830', eye: '4a8ac8', stripe: ['34323a', '2a2830'] },   // yours: white with black stripes
  eevee:  { fur: 'd6a466', furD: 'c08c50', belly: 'fff0d4', bellyD: 'efdab4', ear: 'e08a78', earL: 'eea894', out: '3e2412', eye: '6a9a3a', stripe: ['7a4a24', '6a3e1c'] },   // Aoi's: a caramel tabby
  maple:  { fur: '9a5a32', furD: '844a28', belly: 'e8c8a0', bellyD: 'd4b088', ear: 'd8806e', earL: 'e89a88', out: '2e160a', eye: 'd8a030' },   // street: maple-syrup brown
  miso:   { fur: 'eb9a4e', furD: 'd57f36', belly: 'fff1d6', bellyD: 'f0d8b4', ear: 'e98274', earL: 'f4a294', out: '4a2412', eye: 'c8861e' },   // street: ginger
  yuki:   { fur: 'f4f2f8', furD: 'dcdae8', belly: 'ffffff', bellyD: 'e8e6f0', ear: 'f2a8c2', earL: 'ffd8e8', out: '3a3850', eye: '3a6ab8' },   // street: snow-white
  mochi:  { fur: '3a3842', furD: '2c2a34', belly: 'f8f2e0', bellyD: 'e4dcc6', ear: 'd87c82', earL: 'e8969a', out: '0e0c14', eye: 'b8c43a' },   // street: tuxedo
  nori:   { fur: '8c98ac', furD: '78849a', belly: 'b8c2d2', bellyD: 'a4aec0', ear: 'd89aa8', earL: 'e8b4c0', out: '242838', eye: '58b86a' }    // street: blue-grey
};
// Stripes follow each pose: wavy bands across a sitting cat's body (rings round its legs and tail), bands wrapping round
// the curled-up sleeper's back. The faces stay clear but for a tabby's forehead marks. x, y are cell coordinates.
function striped(r, x, y) {
  if (r === 2) return x >= 26 && (x + Math.round(Math.sin(y * 0.45) * 1.5) + 64) % 7 < 2;   // (its head is on the left)
  if (y < 40) return y >= 21 && y < 27 && x % 3 === 0;                                     // forehead marks
  return (y + Math.round(Math.sin(x * 0.55) * 1.2) + 64) % 6 < 2;
}

const hex = s => [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
const src = readPNG(SRC), CELL = 64;
const at = (x, y) => { const i = (y * src.w + x) * 4; return [src.px[i], src.px[i + 1], src.px[i + 2], src.px[i + 3]]; };
const key = p => p.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('');

/* ---------- the side-on poses: a profile cat, drawn here ---------- */
// The sheet has no side view, so frames 10-22 are a profile cat drawn in this file, facing right (cats.js mirrors it for
// left), in the sheet's style: a 1px dark outline, flat fills, the far legs and the underbelly a shade darker, a cream
// chest and paws, pink inner ear and nose. The head and the body are hand-drawn pixel maps below. Each pose places them
// and gives every leg (3px wide, ending in a rounded 4px paw) and the tail (3px thick, an S-curve) its own keyframe,
// so the walk is a real four-beat gait. Frames: 10-17 walk, 18-19 stand, 20 stretch, 21 crouch, 22 leap.
// Map characters: o outline, F fur, D fur shade, B cream, b cream shade, P pink, E eye, W eye glint, . nothing.
const MAPCH = { o: 'out', F: 'fur', D: 'furD', B: 'belly', b: 'bellyD', P: 'ear', E: 'eye', W: 'glint' };
const GROUND = 61;   // the paws' outline row: the sitting frames stand on the same line
// The head in profile, facing right (18 x 15): the near ear a full triangle towards the back, the far ear peeking out
// in front of it (darker), one eye near the front, a muzzle bump with the pink nose at its tip, a whisker pixel.
const HEAD_A = [
  '...o..............',
  '..oPo...o.........',
  '..oPPo.oDo........',
  '.oPPPFooDDo.......',
  '.oFFFFFFFFFoo.....',
  '.oFFFFFFFFFFFo....',
  'oFFFFFFFFFFFFFo...',
  'oFFFFFFFFFooFFFo..',
  'oFFFFFFFFFWEFFFFo.',
  'oFFFFFFFFFEoFFFBBo',
  'oDFFFFFFFFFFFFBBPo',
  '.oDFFFFFFFFFFBBBoo',
  '..oDDFFFFFFFBBBBo.',
  '...ooDDFFFBBBBoo..',
  '.....ooooooooo....'
];
// the same head with the ears swivelled back a little (the second standing frame: it turns its head to listen)
const HEAD_B = [
  '..o...............',
  '.oPo....o.........',
  '.oPPo..oDo........',
  '.oPPPooDDo........',
  '.oFFFFFFFFFoo.....',
  ...HEAD_A.slice(5)
];
// The body, a soft bean (24 x 12): the back gently arched, the rump rounded at the left, the chest rounded and cream at
// the right, the belly a flatter curve with its shade underneath.
const BODY = [
  '.....oooooooooo.........',
  '...ooFFFFFFFFFFoooo.....',
  '..oFFFFFFFFFFFFFFFFoo...',
  '.oFFFFFFFFFFFFFFFFFFFoo.',
  'oFFFFFFFFFFFFFFFFFFFFFFo',
  'oFFFFFFFFFFFFFFFFFFFFBBo',
  'oFFFFFFFFFFFFFFFFFFFBBBo',
  'oDFFFFFFFFFFFFFFFFFBBBBo',
  'oDDFFFFFFFFFFFFFFFDBBBo.',
  '.oDDDDbbbbbbbbbbDDDBBo..',
  '..ooDDbbbbbbbbbbbbDDo...',
  '....oooooooooooooooo....'
];
const inC = (x, y) => x >= 0 && x < CELL && y >= 0 && y < CELL;
// a hand-drawn map onto the grid at (ox, oy); dy(col) shears it (a tilted body), dup repeats columns (a stretched body)
function stamp(grid, map, ox, oy, part, o = {}) {
  const cols = []; for (let c = 0; c < map[0].length; c++) { cols.push(c); if (o.dup && o.dup.includes(c)) cols.push(c); }
  cols.forEach((c, i) => {
    const dy = o.dy ? o.dy(i) : 0;
    for (let r = 0; r < map.length; r++) {
      const ch = map[r][c]; if (!ch || ch === '.') continue;
      const x = ox + i, y = oy + r + dy; if (inC(x, y)) grid[y * CELL + x] = { role: MAPCH[ch], part, lx: c, ly: r };
    }
  });
}
// a free-form part (a leg, the tail) from its fill pixels: outlined all round except where it joins the body (noTop)
function put(grid, fill, noTop = -1) {
  const has = (x, y) => fill.has(x + ',' + y);
  for (const [k] of fill) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (inC(nx, ny) && !has(nx, ny) && ny > noTop) grid[ny * CELL + nx] = { role: 'out' }; }
  }
  for (const [k, v] of fill) { const [x, y] = k.split(',').map(Number); if (inC(x, y)) grid[y * CELL + x] = v; }
}
// One leg: 3px wide from its hip (hx, top) down to a 4px rounded paw, its foot dx ahead of the hip and lifted `lift` px.
// Back legs bend back a pixel at the hock. Far legs are a shade darker.
function leg(grid, l) {
  const fill = new Map(), foot = GROUND - 1 - l.lift, shinEnd = foot - 2, n = Math.max(1, shinEnd - l.top);
  for (let y = l.top; y <= shinEnd; y++) {
    const t = (y - l.top) / n, off = Math.round(l.dx * t) - (l.hind && t > 0.3 && t < 0.8 ? 1 : 0);
    for (let k = 0; k < 3; k++) fill.set((l.hx + off + k) + ',' + y, { role: l.far ? 'furD' : 'fur', part: 'leg', ly: y - l.top });
  }
  for (const [y, x0, w] of [[foot - 1, l.hx + l.dx, 4], [foot, l.hx + l.dx, 4]])
    for (let k = 0; k < w; k++) fill.set((x0 + k) + ',' + y, { role: l.far ? 'bellyD' : 'belly', part: 'paw' });
  put(grid, fill, l.top + 1);
}
// The tail: a 3px brush along a pixel path from the top of the rump, an S-curve with a cream tip.
function tail(grid, path) {
  const fill = new Map();
  path.forEach(([cx, cy], i) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) fill.set((cx + dx) + ',' + (cy + dy), { role: i >= path.length - 2 ? 'belly' : 'fur', part: 'tail', idx: i });
  });
  put(grid, fill);
}
// the tail's S: back from the rump, up, and curling forward at the tip; sway leans the upper half a pixel either way
const TAIL_WALK = [[13, 45], [12, 44], [11, 43], [10, 42], [9, 41], [9, 40], [9, 39], [9, 38], [10, 37], [10, 36], [11, 35], [12, 35]];
const sway = (path, s, from = 5) => path.map(([x, y], i) => [x + (i >= from ? Math.round(s * (i - from + 1) / (path.length - from)) : 0), y]);
const lift = (path, dy) => path.map(([x, y]) => [x, y + dy]);
function pose(o) {
  const grid = new Array(CELL * CELL).fill(null);
  for (let x = 0; x < CELL; x++) for (let y = GROUND; y < CELL; y++) if (((x - 24) / 17) ** 2 + ((y - GROUND - 1) / 1.6) ** 2 <= 1) grid[y * CELL + x] = { role: 'shadow' };   // the ground shadow
  for (const l of o.legs.filter(l => l.far)) leg(grid, l);
  tail(grid, o.tail);
  stamp(grid, BODY, o.body[0], o.body[1], 'body', o.bodyT || {});
  for (const l of o.legs.filter(l => !l.far)) leg(grid, l);
  stamp(grid, o.headMap || HEAD_A, o.head[0], o.head[1], 'head');
  return grid;
}
// where the legs hang from (x of each hip): back legs under the rump, front legs under the chest; far ones 2px further on
const HIP = { BL: 14, BR: 16, FL: 29, FR: 31 };
const L = (k, top, dx, lf = 0) => ({ hx: HIP[k], top, dx, lift: lf, far: k[1] === 'R', hind: k[0] === 'B' });
const SIDE = [];
// The walk: back-left, front-left, back-right, front-right, a quarter cycle (2 frames) apart, so diagonal pairs move
// together. A foot is down for 6 frames, sliding back 1px a frame under the body (the body walks 1px a frame: STRIDE in
// cats.js), then swings forward over 2 frames.
const FOOT = j => j < 6 ? { dx: 3 - j, lift: 0 } : j === 6 ? { dx: 0, lift: 2 } : { dx: 2, lift: 1 };
for (let f = 0; f < 8; f++) {
  const feet = { BL: FOOT((f + 8) % 8), FL: FOOT((f + 6) % 8), BR: FOOT((f + 4) % 8), FR: FOOT((f + 2) % 8) };
  const under = Object.values(feet).filter(q => !q.lift && Math.abs(q.dx) <= 1).length;
  const up = under >= 2 ? 1 : 0;   // two legs under it: the body rides 1px up, and the head dips the other way
  SIDE.push(pose({
    body: [11, 42 - up], head: [30, 34 - (up ? 0 : 1)],
    legs: Object.entries(feet).map(([k, q]) => L(k, 52 - up, q.dx, q.lift)),
    tail: lift(sway(TAIL_WALK, [0, 1, 1, 0, 0, -1, -1, 0][f]), -up)
  }));
}
// stand: all four paws down, the tail up with its tip curled; the second frame turns the head and flicks the tail tip
const TAIL_UP = [[13, 45], [12, 44], [11, 43], [10, 42], [10, 41], [10, 40], [10, 39], [10, 38], [10, 37], [10, 36], [11, 35], [12, 34], [13, 34]];
const STAND_LEGS = [L('BL', 52, 0), L('BR', 52, 1), L('FL', 52, 0), L('FR', 52, 1)];
SIDE.push(pose({ body: [11, 42], head: [30, 34], legs: STAND_LEGS, tail: TAIL_UP }));
SIDE.push(pose({ body: [11, 42], head: [30, 34], headMap: HEAD_B, legs: STAND_LEGS, tail: TAIL_UP.map(([x, y], i) => i >= 10 ? [x - 1, y - 1] : [x, y]) }));
// stretch: front legs reaching forward and low, chest down, rump and tail high
SIDE.push(pose({
  body: [11, 44], bodyT: { dy: c => Math.round((c - 12) * 0.3) }, head: [31, 41],
  legs: [L('BL', 50, 0), L('BR', 50, 1), { hx: 29, top: 53, dx: 7, lift: 0 }, { hx: 31, top: 53, dx: 8, lift: 0, far: true }],
  tail: [[13, 44], [12, 43], [11, 42], [11, 41], [11, 40], [11, 39], [11, 38], [11, 37], [11, 36], [12, 35], [13, 34], [14, 34]]
}));
// crouch: low and flat, legs folded under, head low and forward, rump a touch raised, tail low behind
SIDE.push(pose({
  body: [11, 47], bodyT: { dy: c => c < 8 ? -1 : 0 }, head: [31, 43],
  legs: [L('BL', 56, -1), L('BR', 56, 0), L('FL', 57, 1), L('FR', 57, 2)],
  tail: [[13, 49], [12, 50], [11, 51], [10, 51], [9, 51], [8, 51], [7, 51], [6, 50], [5, 50], [4, 49], [4, 48], [5, 47]]
}));
// leap: stretched long and diagonal (front up), front legs reaching forward, back legs trailing, the tail streaming behind
SIDE.push(pose({
  body: [9, 42], bodyT: { dup: [9, 10, 11, 12], dy: c => Math.round((14 - c) * 0.22) }, head: [32, 33],
  legs: [{ hx: 13, top: 52, dx: -7, lift: 3, hind: true }, { hx: 15, top: 52, dx: -6, lift: 4, far: true, hind: true }, { hx: 31, top: 48, dx: 6, lift: 6 }, { hx: 33, top: 48, dx: 7, lift: 5, far: true }],
  tail: [[12, 47], [11, 47], [10, 47], [9, 47], [8, 46], [7, 46], [6, 46], [5, 45], [4, 45], [3, 44], [2, 43], [2, 42]]
}));

// stripes on the profile: bands across the back running down the sides (not the cream chest or belly), a few short
// marks on the forehead, rings down the tail (the legs stay plain: rings there read as a grid of boxes)
function sideStripe(c) {
  if (c.part === 'body') return c.ly >= 1 && c.ly <= 8 && (c.lx + Math.floor(c.ly / 3)) % 5 < 2;
  if (c.part === 'head') return c.ly >= 4 && c.ly <= 6 && [4, 6, 8].includes(c.lx);
  if (c.part === 'tail') return c.idx % 3 === 1 && c.idx < 10;
  return false;
}

const NF = 10 + SIDE.length, STRIPS = [];
fs.mkdirSync(OUT, { recursive: true });
for (const [id, coat] of Object.entries(COATS)) {
  const W = CELL * NF, px = Buffer.alloc(W * CELL * 4); let f = 0;
  const put = (x, y, rgb, a = 255) => { const i = (y * W + x) * 4; px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; px[i + 3] = a; };
  ROLES.forEach((row, r) => {
    for (let k = 0; k < row.frames; k++, f++) {
      const zs = [];
      for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
        const p = at(k * CELL + x, r * CELL + y); if (!p[3]) continue;
        const role = row.map[key(p)], ox = f * CELL + x;
        if (r === 2 && y < 26) { zs.push([ox, y]); continue; }   // the sleep z's above the cat: lightened below, with an outline
        if (!role) put(ox, y, p);                                  // mouth, pupils: as drawn
        else if (role === 'blue') { if (y >= 56) put(ox, y, hex('2a1a12'), 70); else put(ox, y, hex('fff8e6')); }   // a soft ground shadow; the lick sparkle
        else if (role === 'lines') put(ox, y, hex(coat.out));
        else if (coat.stripe && (role === 'fur' || role === 'furD') && striped(r, x, y)) put(ox, y, hex(coat.stripe[role === 'fur' ? 0 : 1]));
        else put(ox, y, hex(coat[role]));
      }
      // z's: cream with a dark rim so they read on the night street and the pale serving-room wall alike
      const zset = new Set(zs.map(([x, y]) => x + ',' + y));
      for (const [x, y] of zs) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = x + dx, ny = y + dy; if (ny < 0 || zset.has(nx + ',' + ny) || px[(ny * W + nx) * 4 + 3]) continue;
        put(nx, ny, hex('2a1a26'));
      }
      for (const [x, y] of zs) put(x, y, hex('fff6d6'));
    }
  });
  for (const grid of SIDE) {
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      const c = grid[y * CELL + x]; if (!c) continue;
      const ox = f * CELL + x;
      if (c.role === 'shadow') put(ox, y, hex('2a1a12'), 70);
      else if (c.role === 'glint') put(ox, y, hex('fffaf0'));
      else if (coat.stripe && (c.role === 'fur' || c.role === 'furD') && sideStripe(c)) put(ox, y, hex(coat.stripe[c.role === 'fur' ? 0 : 1]));
      else put(ox, y, hex(coat[c.role]));
    }
    f++;
  }
  writePNG(path.join(OUT, id + '.png'), W, CELL, px);
  STRIPS.push(px);
  console.log('cats/' + id + '.png (' + NF + ' frames)');
}

// The contact sheet, tools/cats-preview.png: a row per coat at 4x, the sitting frame first and then the walk beside it,
// then stand, stretch, crouch, leap, and the rest of the sheet's frames, on a light check with a line between cells.
{
  const ORDER = [0, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 1, 2, 3, 4, 5, 6, 7, 8, 9], Z = 4, CW = CELL * Z, W = CW * ORDER.length, H = CW * STRIPS.length;
  const out = Buffer.alloc(W * H * 4), SW = CELL * NF;
  for (let row = 0; row < STRIPS.length; row++) ORDER.forEach((f, col) => {
    for (let y = 0; y < CW; y++) for (let x = 0; x < CW; x++) {
      const sx = f * CELL + Math.floor(x / Z), sy = Math.floor(y / Z), si = (sy * SW + sx) * 4, src = STRIPS[row];
      const edge = x === 0 || y === 0, chk = ((x >> 4) + (y >> 4)) & 1 ? 214 : 226, a = src[si + 3] / 255;
      const bg = edge ? [150, 140, 130] : [chk, chk + 6, chk];
      const o = ((row * CW + y) * W + col * CW + x) * 4;
      for (let k = 0; k < 3; k++) out[o + k] = Math.round(src[si + k] * a + bg[k] * (1 - a));
      out[o + 3] = 255;
    }
  });
  writePNG(path.join(ROOT, 'tools/cats-preview.png'), W, H, out);
  console.log('tools/cats-preview.png');
}

// toys: the red and blue balls and a food tin, each bottom-centred in a 24x24 cell
{
  const T = 24, boxes = [[202, 412, 218, 426], [137, 410, 153, 424], [103, 343, 121, 361]];
  const px = Buffer.alloc(T * boxes.length * T * 4);
  boxes.forEach(([x0, y0, x1, y1], i) => {
    const w = x1 - x0 + 1, h = y1 - y0 + 1, ox = i * T + Math.floor((T - w) / 2), oy = T - h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = at(x0 + x, y0 + y), j = ((oy + y) * T * boxes.length + ox + x) * 4; px[j] = p[0]; px[j + 1] = p[1]; px[j + 2] = p[2]; px[j + 3] = p[3]; }
  });
  writePNG(path.join(OUT, 'toys.png'), T * boxes.length, T, px);
  console.log('cats/toys.png');
}
