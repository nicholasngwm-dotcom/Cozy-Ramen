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

/* The Japan road. The journey runs through five regions. It is XP only: the moment you reach a stop's level
   (XP from serving and daily quests) it unlocks on its own. Recipe stops add a ramen, upgrade stops put a tool on
   sale at Kitsune-ya, landmark stops give gold and a decoration for the shop. Finishing a region's landmark opens
   the next region, where you can move the shop. (cost = the tool's price at the night shop, for upgrade stops.)
   ids of the recipe/upgrade stops are the unlock ids the rest of the game checks with owns().
   LEVEL_XP[i] = total XP needed to reach level i + 1. */
const LEVEL_XP = [0, 50, 120, 210, 320, 450, 600, 780, 980, 1200, 1450, 1730];
const REGIONS = [
  { id: 'sakura', name: 'Sakura Countryside', short: 'Sakura', c: '#e88aa8' },
  { id: 'kyoto',  name: 'Kyoto',              short: 'Kyoto',  c: '#c8443a' },
  { id: 'osaka',  name: 'Osaka',              short: 'Osaka',  c: '#e8902a' },
  { id: 'tokyo',  name: 'Tokyo',              short: 'Tokyo',  c: '#c060e0' },
  { id: 'coast',  name: 'Coastal Japan',      short: 'Coast',  c: '#3a9ab8' }
];
// goal kinds: served / perfect (bowls, lifetime), sold (bowls of one ramen), met (guests), bestDay (gold in one day), days
const STOPS = [
  { id: 'home',     region: 0, level: 1,  cost: 0,   kind: 'start',   place: 'Hanami Village', name: 'Your first shop', desc: 'Where the journey begins: a little ramen stall under the cherry trees.' },
  { id: 'spicy',    region: 0, level: 2,  cost: 40,  kind: 'recipe',  place: 'Chili Farm', menu: 'spicy', name: 'Spicy Miso', also: 'Chili topping' },
  { id: 'quick',    region: 0, level: 3,  cost: 60,  kind: 'upgrade', place: 'Rice Terraces', name: 'Waiting Bench', desc: 'Up to five guests wait in line instead of three.' },
  { id: 'sakuraLm', region: 0, level: 3,  cost: 0,   kind: 'landmark', place: 'Cherry Blossom Hill', name: 'Sakura branch', deco: 0, gold: 60, desc: 'A sprig of blossom for the shop, and the road to Kyoto.' },
  { id: 'shoyu',    region: 1, level: 4,  cost: 100, kind: 'recipe',  place: 'Fushimi Gates', menu: 'shoyu', name: 'Shoyu Ramen', also: 'Shoyu tare, tori broth' },
  { id: 'bins',     region: 1, level: 5,  cost: 120, kind: 'upgrade', place: 'Bamboo Grove', name: 'Bulk Crates', desc: 'Every pack from Kitsune-ya holds half as much again.' },
  { id: 'stall5',   region: 1, level: 5,  cost: 150, kind: 'upgrade', place: 'Nishiki Market', name: 'Stall 5', desc: 'Opens a fifth stall: room for one more guest.' },
  { id: 'shio',     region: 1, level: 6,  cost: 150, kind: 'recipe',  place: 'Golden Temple', menu: 'shio', name: 'Shio Ramen', also: 'Shio tare' },
  { id: 'kyotoLm',  region: 1, level: 6,  cost: 0,   kind: 'landmark', place: 'Gion Lantern Street', name: 'Red paper lantern', deco: 1, gold: 120, desc: 'A Gion lantern for the shop, and the road to Osaka.' },
  { id: 'tonkotsu', region: 2, level: 7,  cost: 180, kind: 'recipe',  place: 'Dotonbori Canal', menu: 'tonkotsu', name: 'Tonkotsu' },
  { id: 'boil',     region: 2, level: 8,  cost: 200, kind: 'upgrade', place: 'Kuromon Market', name: 'Fast Boil', desc: 'Noodles cook in 4 seconds instead of 6.' },
  { id: 'stall6',   region: 2, level: 8,  cost: 220, kind: 'upgrade', place: 'Shinsekai', name: 'Stall 6', desc: 'Opens a sixth stall: room for one more guest.' },
  { id: 'butter',   region: 2, level: 9,  cost: 240, kind: 'recipe',  place: 'Street Food Alley', menu: 'butter', name: 'Butter Corn Miso', also: 'Corn and butter toppings' },
  { id: 'osakaLm',  region: 2, level: 9,  cost: 0,   kind: 'landmark', place: 'Osaka Castle', name: 'Food stall banner', deco: 2, gold: 160, desc: 'A street-food banner for the shop, and the road to Tokyo.' },
  { id: 'tips',     region: 3, level: 10, cost: 260, kind: 'upgrade', place: 'Shibuya Crossing', name: 'Generous Tips', desc: 'Perfect bowls earn 3G more in tips.' },
  { id: 'akibaLm',  region: 3, level: 10, cost: 0,   kind: 'landmark', place: 'Electric Town', name: 'Arcade prize', gold: 150, desc: 'A bag of arcade tokens, cashed in for gold.' },
  { id: 'stall7',   region: 3, level: 10, cost: 300, kind: 'upgrade', place: 'Asakusa', name: 'Stall 7', desc: 'Opens a seventh stall: room for one more guest.' },
  { id: 'dashi',    region: 3, level: 11, cost: 300, kind: 'recipe',  place: 'Fish Market', menu: 'seaside', name: 'Seaside Dashi', also: 'Dashi broth' },
  { id: 'tokyoLm',  region: 3, level: 11, cost: 0,   kind: 'landmark', place: 'Tokyo Tower', name: 'Neon ramen sign', deco: 3, gold: 200, desc: 'A buzzing neon sign for the shop, and the road to the coast.' },
  { id: 'dragon',   region: 4, level: 12, cost: 380, kind: 'recipe',  place: 'Fire Festival', menu: 'dragon', name: "Dragon's Fire" },
  { id: 'stall8',   region: 4, level: 12, cost: 400, kind: 'upgrade', place: 'Kamakura', name: 'Stall 8', desc: 'Opens the eighth and last stall.' },
  { id: 'harborLm', region: 4, level: 12, cost: 0,   kind: 'landmark', place: 'Fishing Harbour', name: 'Fisher\u2019s thanks', gold: 250, desc: 'The harbour cooks pay you a visit, and their respects.' },
  { id: 'lightLm',  region: 4, level: 12, cost: 0,   kind: 'landmark', place: 'Lighthouse Point', name: 'Lighthouse lamp', gold: 300, desc: 'The keeper trades a lamp for a bowl.' },
  { id: 'endLm',    region: 4, level: 12, cost: 0,   kind: 'landmark', place: 'Journey\u2019s End', name: 'Glass fishing float', deco: 4, gold: 500, desc: 'The end of the road: a glass float for the shop, and a famous name across Japan.' }
];
const NODES = STOPS.filter(s => s.kind === 'recipe' || s.kind === 'upgrade');   // the stops that unlock something in the shop

// What the player owns right now (reads the live game state; safe to call before it exists).
const owns = id => !id || !!(typeof window !== 'undefined' && window.G && G.owned && G.owned.includes(id));
const menuOn = k => owns(MENU[k].node), tareOn = k => owns(TARES[k].node), brothOn = k => owns(BROTHS[k].node), topOn = id => owns(TOP_NODE[id]);
const nodeFor = id => STOPS.find(n => n.id === id);
const levelFor = node => (nodeFor(node) || { level: 1 }).level;   // the level a locked thing opens at
// Road progress (reads the live game state).
const stopDone = s => s.kind === 'start' || owns(s.id);
const frontierIdx = () => STOPS.findIndex(s => !stopDone(s));     // the next stop on the road; -1 once the journey is complete
const regionEnd = r => STOPS.filter(s => s.region === r).pop();
const regionOpen = r => r === 0 || STOPS.some(s => s.region === r && s.kind !== 'start' && stopDone(s)) || stopDone(regionEnd(r - 1));
const goalHave = g => {
  if (!g || typeof window === 'undefined' || !window.G) return 0;
  const L = G.life || {};
  if (g.k === 'served') return L.served || 0;
  if (g.k === 'perfect') return L.perfect || 0;
  if (g.k === 'sold') return (L.sold || {})[g.type] || 0;
  if (g.k === 'met') return (G.met || []).length;
  if (g.k === 'bestDay') return Math.max(L.bestDay || 0, (G.stats && G.stats.earned) || 0);
  if (g.k === 'days') return L.days || 0;
  return 0;
};
const goalText = g => !g ? '' : g.k === 'served' ? `Serve ${g.n} bowls` : g.k === 'perfect' ? `Serve ${g.n} perfect bowls`
  : g.k === 'sold' ? `Serve ${g.n} ${MENU[g.type].name}` : g.k === 'met' ? `Meet ${g.n} different guests`
  : g.k === 'bestDay' ? `Earn ${g.n}G in one day` : `Run the shop for ${g.n} days`;
// The next stop unlocks as soon as its level is reached.
const stopReady = s => { const i = STOPS.indexOf(s); return i === frontierIdx() && !!window.G && G.level >= s.level; };

const EXTRA_PRICE = 2;
const TOPS = ['chashu', 'egg', 'nori', 'scallion', 'menma', 'chili', 'corn', 'butter'];
const TOP_NAME = { chashu: 'Chashu', egg: 'Ramen egg', nori: 'Nori', scallion: 'Spring onion', menma: 'Bamboo shoots', chili: 'Chili', corn: 'Corn', butter: 'Butter' };
// Names short enough for a 90px bin label and an order slip line.
const TOP_SHORT = { chashu: 'CHASHU', egg: 'EGG', nori: 'NORI', scallion: 'SCALLION', menma: 'BAMBOO', chili: 'CHILI', corn: 'CORN', butter: 'BUTTER' };
const TOP_DESC = {
  chashu: 'Slow-braised pork belly', egg: 'Soft egg marinated in soy', nori: 'Toasted seaweed sheet', scallion: 'Fresh sliced spring onion',
  menma: 'Seasoned bamboo shoots', chili: 'Fiery chili threads', corn: 'Sweet butter corn', butter: 'A melting pat of butter'
};

// add: portions in one pack bought at Kitsune-ya (cap / time are left over from kitchen prep and no longer used)
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
const MAX_PASS = 4;

/* Stock comes from Aoi's night supply shop across the street (js/nightshop.js), open SHOP_HOURS after closing:
   a pack bought there goes straight into the kitchen's bin, crock, pot or noodle tray (packSize portions, no cap).
   SUPPLY_PRICE: gold per pack. Equipment is the Japan road's upgrade stops: the road unlocks them, the shop sells them
   (for the stop's cost), and they only work once bought (G.gear). */
const SHOP_HOURS = { open: 21, close: 5 };
const SUPPLY_IDS = ['noodle', ...TOPS, ...Object.keys(TARES).map(tareKey), ...Object.keys(BROTHS).map(brothKey)];
const SUPPLY_PRICE = { noodle: 4, chashu: 5, egg: 4, nori: 2, scallion: 2, menma: 3, chili: 3, corn: 3, butter: 4 };
for (const k in TARES) SUPPLY_PRICE[tareKey(k)] = 4;
for (const k in BROTHS) SUPPLY_PRICE[brothKey(k)] = 6;
const supplyName = id => id === 'noodle' ? 'Fresh noodles' : TOP_NAME[id] || (id.startsWith('tare.') ? TARES[id.slice(5)].name : BROTHS[id.slice(6)].name);
const supplyOn = id => id === 'noodle' || (TOPS.includes(id) ? topOn(id) : id.startsWith('tare.') ? tareOn(id.slice(5)) : brothOn(id.slice(6)));
const supplyNode = id => TOP_NODE[id] || (id.startsWith('tare.') ? TARES[id.slice(5)].node : id.startsWith('broth.') ? BROTHS[id.slice(6)].node : null);
const GEAR = NODES.filter(s => s.kind === 'upgrade').map(s => s.id);
const gearOn = id => owns(id) && !!(typeof window !== 'undefined' && window.G && G.gear && G.gear.includes(id));
const claimCost = s => 0;   // the road costs nothing: XP unlocks it (upgrades are then bought at the night shop)
// values the equipment changes (once bought)
const packSize = id => Math.round(STOCK[id].add * (gearOn('bins') ? 1.5 : 1));   // portions in one pack from the shop
const cookTime = () => (gearOn('boil') ? 4 : 6);   // seconds until noodles are ready; ready noodles never overcook
const maxWait = () => (gearOn('quick') ? 5 : 3);   // guests who will queue for a stall
const perfectTip = () => (gearOn('tips') ? 7 : 4);
// Stalls 1-4 are always open; stalls 5-8 open once bought at Kitsune-ya (after the road unlocks them).
const stallOpen = i => i < 4 || gearOn('stall' + (i + 1));

// Two stations, both wide pages you pan along between cam and camMax (hold A / D or use the mouse wheel):
// the serving room (stalls 1-4 at the right, 5-8 and the staff door to the left) and the kitchen (toppings, then the cooking line).
const STATIONS = [
  { id: 'serving', name: 'Serving', cam: -960, camMax: 0 },
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

// Serving room: two screens wide (local x 0-1920, drawn at world x -960). Stalls 1-4 fill the right half, where the
// room always was (world 0-960); stalls 5-8 continue to the left, and the staff door is on the far left wall.
const SL = {
  X0: -960, W: 1920, OX: 960, BEAM_Y: 40, BLIND_TOP: 62, COUNTER_Y: 300, NSTALL: 8, STALL_W: 206,
  stallX: i => (i < 4 ? 1028 + 206 * i : 1028 - 206 * (i - 3)),
  stallCX: i => SL.stallX(i) + 103,
  LEFT: 1028 - 206 * 4, RIGHT: 1028 + 206 * 4,       // the outer edges of the stall row
  DOOR: { x: 40, y: 92, w: 112, h: 208 },             // the staff door (local)
  SHELF_Y: 470, pickX: i => 1620 - 120 * i
};
