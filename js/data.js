'use strict';
/* Menu, ingredients and the world layout shared by every other file.
   The screen is 960x540. The world is one long strip: the serving room sits at x 0-960, then
   toppings and kitchen share x 960-2480 (their views overlap on the topping bins and bowl mat). */
const VW = 960, VH = 540;

/* Tares (the seasoning spooned in first) and broths. Every recipe names one of each. The kitchen has a crock or pot
   for each (the *_SLOTS lists). node: the level-road step that unlocks it (none = available from the start).
   short names: 5 letters at most, so they fit the label on a crock or pot. */
const TARES = {
  miso:  { name: 'Miso tare', short: 'MISO', c: '#93451f' },
  shoyu: { name: 'Shoyu tare', short: 'SHOYU', c: '#4a2010', node: 'shoyu' },
  shio:  { name: 'Shio tare', short: 'SHIO', c: '#e6dcc4', node: 'shio' }
};
const BROTHS = {
  pork:    { name: 'Pork bone broth', short: 'PORK', c: '#c8792e', dark: '#8a4518', light: '#efb45e', mid: '#b0652a' },
  chicken: { name: 'Tori (chicken) broth', short: 'TORI', c: '#e8b850', dark: '#a8782a', light: '#fff0b0', mid: '#d0a040', node: 'shoyu' },
  dashi:   { name: 'Dashi broth', short: 'DASHI', c: '#c89a5a', dark: '#7a5a30', light: '#f0d8a0', mid: '#a8804a', node: 'dashi' }
};
const TARE_SLOTS = ['miso', 'shoyu', 'shio'];
const BROTH_SLOTS = ['pork', 'chicken', 'dashi'];
const tareKey = k => 'tare.' + k, brothKey = k => 'broth.' + k;   // their ids in G.stock / STOCK / jobs

/* The eight ramen. short: what the order slip prints (wraps onto two lines at the space).
   node: the level-road step that unlocks the recipe (none = on the menu from day one). */
const MENU = {
  miso:     { name: 'Miso Ramen', short: 'MISO', c: '#d98a2b', price: 12, rec: true, tare: 'miso', broth: 'pork',
              desc: 'Rich, nutty miso broth over springy noodles. Gentle and warming.',
              tops: { chashu: 1, egg: 1, nori: 1, scallion: 1, menma: 1 } },
  spicy:    { name: 'Spicy Miso', short: 'SPICY', c: '#c8302a', price: 14, tare: 'miso', broth: 'pork', node: 'spicy',
              desc: 'Our miso broth with a tangle of fiery chili threads on top.',
              tops: { chashu: 1, egg: 1, nori: 1, scallion: 1, menma: 1, chili: 1 } },
  shoyu:    { name: 'Shoyu Ramen', short: 'SHOYU', c: '#7a3a1a', price: 13, tare: 'shoyu', broth: 'chicken', node: 'shoyu',
              desc: 'Clear chicken broth seasoned with dark soy. A classic.',
              tops: { chashu: 1, egg: 1, nori: 1, menma: 1 } },
  shio:     { name: 'Shio Ramen', short: 'SHIO', c: '#4a7a9a', price: 12, tare: 'shio', broth: 'chicken', node: 'shio',
              desc: 'Light, golden and salty-clean. Lets the noodles shine.',
              tops: { chashu: 1, egg: 1, scallion: 1 } },
  tonkotsu: { name: 'Tonkotsu', short: 'TONKOTSU', c: '#b8905a', price: 15, tare: 'shio', broth: 'pork', node: 'tonkotsu',
              desc: 'Creamy pork bone broth with a double helping of chashu.',
              tops: { chashu: 2, egg: 1, nori: 1, scallion: 1 } },
  butter:   { name: 'Butter Corn Miso', short: 'BUTTER CORN', c: '#c89a18', price: 15, tare: 'miso', broth: 'pork', node: 'butter',
              desc: 'Northern-style miso, sweet corn and a melting pat of butter.',
              tops: { chashu: 1, corn: 1, butter: 1, menma: 1 } },
  seaside:  { name: 'Seaside Dashi', short: 'SEASIDE', c: '#2f7a8a', price: 13, tare: 'shio', broth: 'dashi', node: 'dashi',
              desc: 'Delicate fish and kelp broth from the harbour towns.',
              tops: { egg: 1, nori: 1, scallion: 1 } },
  dragon:   { name: "Dragon's Fire", short: 'DRAGON', c: '#a01e3a', price: 16, tare: 'shoyu', broth: 'pork', node: 'dragon',
              desc: 'Dark soy, rich pork and a double dose of chili. For brave adventurers.',
              tops: { chashu: 1, egg: 1, chili: 2, scallion: 1 } }
};
// Toppings that need a level-road step before they can be stocked and used.
const TOP_NODE = { chili: 'spicy', corn: 'butter', butter: 'butter' };

/* Level road. Serving bowls earns XP; reaching a level opens its step, and the step is then bought with gold.
   LEVEL_XP[i] = total XP needed to reach level i + 1. */
const LEVEL_XP = [0, 50, 120, 210, 320, 450, 600, 780, 980, 1200, 1450, 1730];
const NODES = [
  { id: 'spicy',    level: 2,  cost: 40,  kind: 'recipe',  menu: 'spicy',    name: 'Spicy Miso', also: 'Chili topping' },
  { id: 'quick',    level: 3,  cost: 60,  kind: 'upgrade', name: 'Quick Hands', desc: 'Prep three things at once.' },
  { id: 'shoyu',    level: 4,  cost: 100, kind: 'recipe',  menu: 'shoyu',    name: 'Shoyu Ramen', also: 'Shoyu tare, tori broth' },
  { id: 'bins',     level: 5,  cost: 120, kind: 'upgrade', name: 'Big Bins', desc: 'Every stock holds half as much again.' },
  { id: 'shio',     level: 6,  cost: 150, kind: 'recipe',  menu: 'shio',     name: 'Shio Ramen', also: 'Shio tare' },
  { id: 'tonkotsu', level: 7,  cost: 180, kind: 'recipe',  menu: 'tonkotsu', name: 'Tonkotsu' },
  { id: 'boil',     level: 8,  cost: 200, kind: 'upgrade', name: 'Fast Boil', desc: 'Noodles cook in 4 seconds instead of 6.' },
  { id: 'butter',   level: 9,  cost: 240, kind: 'recipe',  menu: 'butter',   name: 'Butter Corn Miso', also: 'Corn and butter toppings' },
  { id: 'tips',     level: 10, cost: 260, kind: 'upgrade', name: 'Generous Tips', desc: 'Perfect bowls earn 3G more in tips.' },
  { id: 'dashi',    level: 11, cost: 300, kind: 'recipe',  menu: 'seaside',  name: 'Seaside Dashi', also: 'Dashi broth' },
  { id: 'dragon',   level: 12, cost: 380, kind: 'recipe',  menu: 'dragon',   name: "Dragon's Fire" }
];
// What the player owns right now (reads the live game state; safe to call before it exists).
const owns = id => !id || !!(typeof window !== 'undefined' && window.G && G.owned && G.owned.includes(id));
const menuOn = k => owns(MENU[k].node), tareOn = k => owns(TARES[k].node), brothOn = k => owns(BROTHS[k].node), topOn = id => owns(TOP_NODE[id]);
const nodeFor = id => NODES.find(n => n.id === id);
const levelFor = node => (nodeFor(node) || { level: 1 }).level;   // the level a locked thing opens at

const EXTRA_PRICE = 2;
const TOPS = ['chashu', 'egg', 'nori', 'scallion', 'menma', 'chili', 'corn', 'butter'];
const TOP_NAME = { chashu: 'Chashu', egg: 'Ramen egg', nori: 'Nori', scallion: 'Spring onion', menma: 'Bamboo shoots', chili: 'Chili', corn: 'Corn', butter: 'Butter' };
// Names short enough for a 90px bin label and an order slip line.
const TOP_SHORT = { chashu: 'CHASHU', egg: 'EGG', nori: 'NORI', scallion: 'SCALLION', menma: 'BAMBOO', chili: 'CHILI', corn: 'CORN', butter: 'BUTTER' };
const TOP_DESC = {
  chashu: 'Slow-braised pork belly', egg: 'Soft egg marinated in soy', nori: 'Toasted seaweed sheet', scallion: 'Fresh sliced spring onion',
  menma: 'Seasoned bamboo shoots', chili: 'Fiery chili threads', corn: 'Sweet butter corn', butter: 'A melting pat of butter'
};

// cap: most you can hold, add: how much one prep job makes, time: seconds per job
const STOCK = {
  noodle:   { cap: 12, add: 6, time: 6,  label: 'NOODLES' },
  chashu:   { cap: 10, add: 5, time: 6 },
  egg:      { cap: 10, add: 5, time: 7 },
  nori:     { cap: 10, add: 5, time: 4 },
  scallion: { cap: 10, add: 5, time: 4 },
  menma:    { cap: 10, add: 5, time: 4 },
  chili:    { cap: 10, add: 5, time: 4 },
  corn:     { cap: 10, add: 5, time: 4 },
  butter:   { cap: 10, add: 5, time: 4 }
};
for (const k in TARES) STOCK[tareKey(k)] = { cap: 16, add: 8, time: 7, label: TARES[k].short, ...TARES[k].stock };
for (const k in BROTHS) STOCK[brothKey(k)] = { cap: 16, add: 8, time: 12, label: BROTHS[k].short, ...BROTHS[k].stock };
const MAX_PASS = 4, MAX_WAIT = 3;
// values the level-road upgrades change
const capOf = id => Math.round(STOCK[id].cap * (owns('bins') ? 1.5 : 1));
const cookTime = () => (owns('boil') ? 4 : 6);   // seconds until noodles are ready; ready noodles never overcook
const maxJobs = () => (owns('quick') ? 3 : 2);
const perfectTip = () => (owns('tips') ? 7 : 4);

// Two stations. The kitchen is one wide page (toppings on the left, cooking line on the right):
// its camera pans between cam and camMax (hold A / D or use the mouse wheel).
const STATIONS = [
  { id: 'serving', name: 'Serving', cam: 0 },
  { id: 'kitchen', name: 'Kitchen', cam: 960, camMax: 1520 }
];
const PAN_SPEED = 820;    // px per second while A / D is held
const EDGE = 46;          // width of the screen-edge zones that pan to the next station

// Toppings + kitchen (local x 0-1520, drawn at world x 960). Toppings view shows local 0-960, kitchen view 560-1520.
// Left to right: pass, recipe book + bin, topping bins over the bowl mat (seen from both views), tare crocks, broth range, noodle boiler.
const KL = {
  X0: 960, W: 1520,
  PASS: { x: 50, y: 52, w: 166, h: 244 },
  passPos: i => [92 + (i % 2) * 82, 214 + Math.floor(i / 2) * 64],
  BOOK: { x: 286, y: 352, w: 116, h: 74 },
  TRASH: { x: 470, y: 440, w: 46, h: 58 },
  // stepped steel topping unit: two rows of four bins right above the bowls
  bin: k => ({ x: 578 + 92 * (k % 4), y: k < 4 ? 214 : 302, w: 86, h: 58 }),
  MAT: { x: 636, y: 386, w: 248, h: 112 },
  bowlX: [700, 820], BOWL_Y: 420,
  tare: i => ({ cx: 976 + 64 * i, y: 330 }),            // crock i: centre x, rim y
  pot: i => ({ cx: 1170 + 70 * i, cy: 340, rx: 30 }),    // broth pot i on the range
  BOIL: { cx: 1440, cy: 352, rx: 66 }, basketX: [1398, 1440, 1482],
  NOODLE: { x: 1394, y: 226, w: 92, h: 40 },            // tray of noodle nests on the shelf above the boiler
  // where each stock's "+" restock button sits
  badge(id) {
    if (id === 'noodle') return [this.NOODLE.x - 14, this.NOODLE.y + 20];
    const tk = TARE_SLOTS.findIndex(k => k && tareKey(k) === id);
    if (tk >= 0) { const t = this.tare(tk); return [t.cx - 10, t.y - 14]; }
    const bk = BROTH_SLOTS.findIndex(k => k && brothKey(k) === id);
    if (bk >= 0) { const p = this.pot(bk); return [p.cx - 20, p.cy - 26]; }
    const b = this.bin(TOPS.indexOf(id)); return [b.x + b.w - 13, b.y + b.h - 13];
  },
  SLIP_Y: 40
};

// Serving room (local x 0-960, drawn at world x 0); the pickup shelf sits on the kitchen (right) side
const SL = {
  X0: 0, BEAM_Y: 40, BLIND_TOP: 62, COUNTER_Y: 300, NSTALL: 4, STALL_W: 206,
  stallX: i => 68 + 206 * i,
  stallCX: i => 171 + 206 * i,
  SHELF_Y: 470, pickX: i => 660 - 120 * i
};
