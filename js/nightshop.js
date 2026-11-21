'use strict';
/* Kitsune-ya: Aoi's night supply shop, across the street from the ramen shop.
   After closing (G.shop === 'night') the serving room's left edge leads out to the night street (G.where = 'street'),
   where Aoi's shop is lit from SHOP_HOURS.open to SHOP_HOURS.close. Inside (G.where = 'store') is one wide room you
   pan around (A / D, the wheel, dragging, or the edge arrows): the counter with Aoi, a specials cabinet, the fresh
   cooler, pantry shelves, the tools table, and past them the market annex: a second cooler of newer ingredients and a
   curio cabinet of rare (fantasy) ones. Tap a product to inspect it and put packs in your cart; Aoi takes
   payment at the counter. Everything sold comes from the shared data: SUPPLY_IDS / SUPPLY_PRICE (packs),
   GEAR (the road's upgrade stops). Packs go straight into the kitchen (G.stock); tools into G.gear.
   Tonight's special is one ingredient at 40% off, shown on its own price tag and in the specials cabinet. */
const NIGHTSHOP = (() => {
  const { rect, dot, ell, poly, line, shade, mix, text, textC, textW } = PX;
  const DK = PX.OUTLINE, SW = 3260, FLOOR = 430, CTOP = 378, EDGE = 46;
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const inR = (p, r) => p && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
  const rnd = SCENE.rnd;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  let H = { sfx: {}, say: () => {}, toast: () => {}, save: () => {}, back: () => {}, img: null };

  /* ---------- hours ---------- */
  const hourNow = () => G.hour === undefined ? 0 : G.hour;
  // The street is always there to step out to; Kitsune-ya itself keeps SHOP_HOURS (04:00-15:00, so also during the
  // morning and the lunch service: while you are out, your own shop waits for you).
  const streetOpen = () => G.mode === 'play';
  const inHours = h => (SHOP_HOURS.open < SHOP_HOURS.close ? h >= SHOP_HOURS.open && h < SHOP_HOURS.close : h >= SHOP_HOURS.open || h < SHOP_HOURS.close);
  const storeOpen = () => streetOpen() && inHours(hourNow());
  const pad2 = n => String(n).padStart(2, '0');
  const HOURS = pad2(SHOP_HOURS.open) + ':00-' + pad2(SHOP_HOURS.close) + ':00';

  /* ---------- tonight's stock and the catalogue ---------- */
  const GEAR_INFO = {
    quick: { name: 'Waiting bench',    line: 'A cedar bench for the queue. Up to five guests wait instead of three.' },
    bins:  { name: 'Bulk crates',      line: 'Aoi packs your orders in bulk crates: every pack holds half as much again.' },
    boil:  { name: 'High-flame boiler', line: 'A roaring burner. Noodles in four seconds.' },
    caddy: { name: 'Garnish caddy',    line: 'A little cedar caddy of spring onion and nori: it sprinkles them in with the noodles, as the order asks.' },
    tips:  { name: 'Lucky tip cat',    line: 'A beckoning cat for the counter. Happy guests tip more.' },
    stall5: { name: 'Seat 5 kit', line: 'A stool, a paper lantern and a bamboo blind: opens stall 5 at your counter.' },
    stall6: { name: 'Seat 6 kit', line: 'A stool, a paper lantern and a bamboo blind: opens stall 6 at your counter.' },
    stall7: { name: 'Seat 7 kit', line: 'A stool, a paper lantern and a bamboo blind: opens stall 7 at your counter.' },
    stall8: { name: 'Seat 8 kit', line: 'A stool, a paper lantern and a bamboo blind: opens stall 8, the last one.' },
    board9: { name: 'Menu board plank', line: 'One more plank for the menu board: a ninth dish on your menu.' },
    board10: { name: 'Grand menu board', line: 'A lacquered extension for the menu board: a tenth dish on your menu.' }
  };
  function market() {
    const mday = G.shop === 'night' ? G.day + 1 : G.day;   // (the 04:00-09:00 window already belongs to the coming day)
    if (!G.market || G.market.day !== mday) {
      const left = {}; for (const id of SUPPLY_IDS) left[id] = 8;
      left.crate = 2; left.cockegg = 1;   // cockatrice eggs: one pack (two eggs) a night
      const pool = SUPPLY_IDS.filter(supplyOn);
      G.market = { day: mday, left, special: pool[(mday * 7 + 3) % pool.length] };
    }
    return G.market;
  }
  function descOf(id) {
    if (id === 'noodle') return 'Springy wavy noodles, made fresh this afternoon.';
    if (id === CHILI_OIL) return 'Red chili oil for spicy broths: a splash turns Spicy Miso and Tantanmen red.';
    if (TOP_DESC[id]) return TOP_DESC[id] + '.';
    if (id.startsWith('tare.')) return 'A sealed jar of ' + TARES[id.slice(5)].name.toLowerCase() + ', ready for the crock.';
    return 'Bones and aromatics for a fresh pot of ' + BROTHS[id.slice(6)].name.toLowerCase() + '.';
  }
  const salePrice = p => Math.max(1, Math.round(p * 0.6));
  const real = id => id === 'special' ? market().special : id;   // the cabinet shows tonight's special; buying it buys that ingredient
  const lockPlace = node => { const n = nodeFor(node); return n ? n.place + ' (level ' + n.level + ')' : 'a later stop'; };
  // Item rarity (JRPG-style borders on the icons): everyday staples are common, toppings unlocked on the road are
  // uncommon, the market crate and tonight's special are rare, kitchen tools are epic and stall kits legendary.
  const RARITY = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
  function rarity(it) {
    if (!it) return 0;
    if (it.kind === 'gear') return it.id.startsWith('stall') || it.id.startsWith('board') ? 4 : 3;
    if (it.kind === 'crate' || it.sale) return 2;
    return it.node ? 1 : 0;
  }
  const rare = it => ` rar-${rarity(it)}`;
  function item(id) {
    const M = market();
    if (SUPPLY_IDS.includes(id)) {
      const sale = id === M.special, base = SUPPLY_PRICE[id];
      return { id, kind: 'ing', name: supplyName(id), desc: descOf(id), price: sale ? salePrice(base) : base, full: sale ? base : 0, sale, on: supplyOn(id), node: supplyNode(id),
        unit: packSize(id) + (id === 'noodle' ? ' nests' : ' portions'), left: M.left[id], have: G.stock[id] || 0 };
    }
    if (GEAR.includes(id)) {
      const s = nodeFor(id), bought = G.gear.includes(id);
      return { id, kind: 'gear', name: GEAR_INFO[id].name, desc: GEAR_INFO[id].line, price: s.cost, on: owns(id), node: id, left: bought ? 0 : 1, bought, unit: 'for the kitchen' };
    }
    if (id === 'special') return Object.assign({}, item(M.special), { id, kind: 'special', of: M.special });   // the cabinet's display of tonight's sale
    if (id === 'crate') {
      const tops = TOPS.filter(id => topOn(id) && !FANTASY.includes(id));
      return { id, kind: 'crate', tops, name: 'Market crate', desc: 'A cedar crate with one pack of every everyday topping you can use (' + tops.length + ' packs; rare goods not included).',
        price: Math.round(tops.reduce((a, t) => a + SUPPLY_PRICE[t], 0) * 0.8), on: true, left: M.left.crate, unit: tops.length + ' packs' };
    }
    return null;
  }
  const CATALOGUE = () => [['Specials', [market().special, 'crate']], ['Fresh', TOPS.filter(id => !FANTASY.includes(id))], ['Curios', FANTASY.slice()], ['Pantry', SUPPLY_IDS.filter(id => !TOPS.includes(id))], ['Upgrades', GEAR.slice()]];

  /* ---------- where everything sits in the store (store x 0-SW) ---------- */
  const SLOTS = [];
  SLOTS.push({ id: 'special', x: 720, base: 268 }, { id: 'crate', x: 720, base: 362 });
  const FRESH1 = TOPS.slice(0, 12), FRESH2 = TOPS.filter(id => !FRESH1.includes(id) && !FANTASY.includes(id));
  FRESH1.forEach((id, i) => SLOTS.push({ id, x: 932 + (i % 4) * 94, base: [222, 298, 374][Math.floor(i / 4)] }));
  ['noodle', ...Object.keys(TARES).map(tareKey), CHILI_OIL].forEach((id, i) => SLOTS.push({ id, x: 1346 + i * 74, base: 230, small: true }));
  Object.keys(BROTHS).map(brothKey).forEach((id, i) => SLOTS.push({ id, x: 1344 + i * 74, base: 330, small: true }));
  // the market annex past the umbrella stand: a second cooler (five to a shelf) and the curio cabinet (four to a shelf)
  const ANNEX = { cool: { x: 2280, w: 500 }, curio: { x: 2830, w: 396 } };
  FRESH2.forEach((id, i) => SLOTS.push({ id, x: 2338 + (i % 5) * 96, base: [222, 298, 374][Math.floor(i / 5)] }));
  FANTASY.forEach((id, i) => SLOTS.push({ id, x: 2884 + (i % 4) * 96, base: [262, 362][Math.floor(i / 4)] }));
  const shelfGear = id => id.startsWith('stall') || id.startsWith('board');
  GEAR.filter(id => !shelfGear(id)).forEach((id, i) => SLOTS.push({ id, x: 1806 + i * 86, base: 340 }));   // five kitchen tools on the table
  [...GEAR.filter(id => id.startsWith('stall')), ...GEAR.filter(id => id.startsWith('board'))].forEach((id, i) => SLOTS.push({ id, x: 1798 + i * 72, base: 232, small: true }));
  for (const s of SLOTS) s.r = s.small ? { x: s.x - 33, y: s.base - 54, w: 66, h: 64 } : { x: s.x - 40, y: s.base - 54, w: 80, h: 64 };
  const DOOR = { x: 40, y: 168, w: 120, h: FLOOR - 168 };
  const COUNTER = { x: 222, y: CTOP - 12, w: 350, h: FLOOR - CTOP + 12 };
  const REG = { x: 520, y: CTOP };
  // Things that are not for sale still answer when tapped (Aoi has an opinion about everything).
  const PROPS = [
    { r: { x: 286, y: 60, w: 116, h: 66 }, say: ['That is the shrine to Inari. Bow if you like. The foxes notice.', 'Fresh fried tofu for Inari every night. House rules.'] },
    { r: { x: 1330, y: 384, w: 120, h: 46 }, say: ['Rice for my own supper. Not for sale, sorry.', 'Those sacks are older than you, chef.'] },
    { r: { x: 230, y: 136, w: 40, h: 50 }, say: ['A good month. You keep buying.', 'Full moon on the fifteenth. Busy night.'] },
    { r: { x: 2196, y: 330, w: 40, h: 100 }, say: ['Umbrellas for customers. It always rains when you forget one.'] }
  ];

  /* ---------- state (G.where / G.stock / G.gear live in the game state; this is just the visit) ---------- */
  const S = {
    cam: 0, camT: 0, pan: 0, drag: null, fade: 0, fadeDir: 0, then: null,
    door: 0, doorT: 0, sdoor: 0, sdoorT: 0, rdoor: 0, rdoorT: 0,
    aoi: { x: 400, tx: 400, face: -1, walk: 0, next: 3, hop: 0 }, bubble: null,
    basket: [], ui: null, sel: null, qty: 1, view: 'menu', hover: null, edge: 0, closing: 0, focus: null,
    talk: { full: '', shown: 0 }, parts: [], pops: [], flys: [], cartT: -9, receipt: null, lastSale: null, bagT: -9, ringT: -9, keys: { l: false, r: false }
  };
  const W = p => p && { x: p.x + (G.where === 'store' ? S.cam : 0), y: p.y };

  /* ---------- transitions ---------- */
  function fadeTo(fn) { if (S.fadeDir > 0) return; S.fadeDir = 1; S.then = fn; }
  function enter(where) {
    if (where === 'street') {
      if (!streetOpen()) return H.say('The street can wait until the shop is closed for the night.');
      H.sfx.whoosh && H.sfx.whoosh();
      fadeTo(() => { closePanels(); G.where = 'street'; S.sdoor = S.sdoorT = 0; S.rdoor = S.rdoorT = 0; G.drag = null; });
    } else if (where === 'store') {
      if (!storeOpen()) { H.sfx.bad && H.sfx.bad(); return H.say('Kitsune-ya is closed. Open ' + HOURS + '.'); }
      S.sdoorT = 1; H.sfx.slide();
      setTimeout(() => fadeTo(() => {
        G.where = 'store'; S.cam = S.camT = 0; S.door = 1; S.doorT = 0; S.closing = 0;
        S.aoi.x = S.aoi.tx = 420; S.aoi.face = -1; S.aoi.next = 2.5;
        H.sfx.chime(); greet();
      }), 280);
    }
  }
  function leaveStore() {
    closePanels(); S.doorT = 1; H.sfx.slide(); S.focus = null;
    if (S.basket.length) bubble(AOI.leaveCart());
    setTimeout(() => fadeTo(() => { G.where = 'street'; S.sdoor = 1; S.sdoorT = 0; H.sfx.slide(); }), 300);
  }
  function backHome(st = 0) { closePanels(); fadeTo(() => { G.where = null; H.back(st); }); }

  /* ---------- Aoi ---------- */
  // (what Aoi says warms up with her hearts: js/aoi.js)
  function greet() {
    const tl = H.tutGreet ? H.tutGreet() : null;   // a new save's first visit: Aoi points out a staple to restock (tutorial.js)
    if (tl === '') { G.aoiMet = true; }   // (Aoi's handover: her tutorial panel does the talking)
    else if (tl) { G.aoiMet = true; bubble(tl, 6); focusRestock(); }
    else if (!G.aoiMet) { G.aoiMet = true; bubble('Welcome to Kitsune-ya! I am Aoi. Ingredients, tools, the odd rare thing. Pay me at the counter.'); }
    else { bubble(AOI.greet()); AOI.gain(1, 'visit'); }
    S.aoi.hop = 0.5;
    rescue();
  }
  // Nobody goes out of business on Aoi's watch: if a staple has run dry and you cannot afford it, the first pack is on the house.
  function rescue() {
    if (G.aoiGift === G.day) return;
    const staples = ['noodle', 'chashu', 'egg', 'nori', 'scallion', 'menma', tareKey('miso'), brothKey('pork')];
    const dry = staples.filter(id => (G.stock[id] || 0) <= 0);
    if (!dry.length || G.gold >= Math.min(...dry.map(id => SUPPLY_PRICE[id]))) return;
    G.aoiGift = G.day; for (const id of dry) G.stock[id] = (G.stock[id] || 0) + packSize(id);
    H.save();
    setTimeout(() => bubble('Your kitchen looks bare, chef. A pack of each staple, on the house. Just this once!'), 3800);
  }
  // The tutorial's restock highlight: the staple you have least of, brought into view (it goes once something is in the cart).
  function focusRestock() {
    const id = ['noodle', 'chashu', 'egg', 'scallion'].reduce((a, b) => ((G.stock[b] || 0) < (G.stock[a] || 0) ? b : a));
    const s = SLOTS.find(o => o.id === id); if (!s) return;
    S.focus = id; S.camT = clamp(s.x - VW / 2, 0, SW - VW);
  }
  function bubble(msg, t = 4.2) { S.bubble = { msg, t, max: t }; }
  function updateAoi(dt) {
    const a = S.aoi;
    if (a.hop > 0) a.hop = Math.max(0, a.hop - dt);
    const d = a.tx - a.x;
    if (Math.abs(d) > 1) { const v = Math.sign(d) * Math.min(Math.abs(d), 70 * dt); a.x += v; a.walk += dt; a.face = Math.sign(d); }
    else {
      a.walk = 0; a.next -= dt;
      if (a.next <= 0 && S.ui !== 'talk') {   // potter about behind the counter: tidy the shrine, check the till, look at you
        a.tx = pick([330, 380, 420, 460, REG.x - 20]); a.next = 3 + Math.random() * 5;
      }
      if (!a.walk && S.hover && Math.abs(d) <= 1) a.face = (S.hover.x > a.x ? 1 : -1);
    }
  }

  /* ---------- the basket and paying ---------- */
  const basketN = () => S.basket.reduce((a, b) => a + b.n, 0);
  const basketTotal = () => S.basket.reduce((a, b) => a + item(b.id).price * b.n, 0);
  const inBasket = id => (S.basket.find(b => b.id === id) || { n: 0 }).n;
  function addToBasket(id, n) {
    id = real(id); const it = item(id); if (!it || !it.on || n <= 0) return false;
    const room = it.left - inBasket(id); n = Math.min(n, room);
    if (n <= 0) { H.sfx.bad(); bubble(it.kind === 'gear' ? 'One of those is plenty, chef.' : 'That is all I have of that tonight.'); return false; }
    const b = S.basket.find(b => b.id === id);
    if (b) b.n += n; else S.basket.push({ id, n });
    S.focus = null;
    H.sfx.add();
    const sl = SLOTS.find(q => real(q.id) === id), from = S.ui === 'talk' || !sl ? { x: S.aoi.x, y: CTOP - 60 } : { x: sl.x, y: sl.base - 18 };
    S.flys.push({ id, x: from.x - S.cam, y: from.y, t: 0, n });
    return true;
  }
  function setBasket(id, n) {
    const it = item(id), b = S.basket.find(b => b.id === id); if (!b) return;
    b.n = clamp(n, 0, it.left); S.basket = S.basket.filter(b => b.n > 0);
  }
  function pay() {
    const total = basketTotal();
    if (!S.basket.length || G.gold < total) { H.sfx.bad(); return false; }
    G.gold -= total;
    const M = market(), names = [];
    S.lastSale = { total, purse: G.gold, saved: S.basket.reduce((a, b) => { const it = item(b.id); return a + (it.full ? (it.full - it.price) * b.n : 0); }, 0),
      lines: S.basket.map(b => { const it = item(b.id); return { name: it.name, n: b.n, each: it.price, sale: !!it.sale, gear: it.kind === 'gear' }; }) };
    for (const b of S.basket) {
      const it = item(b.id); names.push(it.name);
      if (it.kind === 'ing') G.stock[b.id] = (G.stock[b.id] || 0) + packSize(b.id) * b.n;
      else if (it.kind === 'crate') for (const t of it.tops) G.stock[t] = (G.stock[t] || 0) + packSize(t) * b.n;
      else if (it.kind === 'gear' && !G.gear.includes(b.id)) { G.gear.push(b.id); H.toast(it.name + ' installed in your kitchen!'); }
      if (it.kind !== 'gear') M.left[b.id] -= b.n;
    }
    S.basket = []; S.bagT = G.t; S.ringT = G.t; S.aoi.hop = 0.5; S.paidT = G.t;
    H.sfx.coin(); H.sfx.ring();
    for (let i = 0; i < 10; i++) S.parts.push({ x: COUNTER.x + 70 + Math.random() * 120, y: CTOP - 8, k: -i * 0.05, x0: 0, y0: 0 });
    S.pops.push({ str: '-' + total + 'G', x: REG.x + 16, y: CTOP - 60, c: '#ffd76a', life: 1.4 });
    AOI.gain(2, 'buy');
    H.save(); H.refresh && H.refresh();
    return names;
  }

  // Kitsune-ya's receipt: a slim washi slip in indigo ink, stamped with Aoi's fox seal. Click (or Enter) to tuck it away.
  function giveReceipt() {
    closePanels(); G.kitsuneNo = (G.kitsuneNo || 41) + 1;
    const hr = G.hour || 0, hh = Math.floor(hr) % 24, mm = Math.floor((hr % 1) * 60);
    S.receipt = { ...S.lastSale, thanks: AOI.receipt(), no: G.kitsuneNo, when: 'DAY ' + G.day + '  ' + pad2(hh) + ':' + pad2(mm), t0: G.t, out: 0, stamped: false };
    S.ui = 'receipt'; S.aoi.tx = REG.x - 20; H.sfx.paper && H.sfx.paper();
  }
  function tuckReceipt() { if (S.receipt && !S.receipt.out) { S.receipt.out = G.t; H.sfx.paper && H.sfx.paper(); } }
  const RCW = 248;
  function receiptRows(r) {
    const rows = [];
    for (const l of r.lines) {
      rows.push({ l: l.name, r: l.each * l.n + 'G' });
      rows.push({ l: (l.gear ? '1 piece' : l.n + (l.n === 1 ? ' pack' : ' packs')) + ' x ' + l.each + 'G', small: true, sale: l.sale });
    }
    return rows;
  }
  function drawReceipt(g) {
    const r = S.receipt; if (!r) return;
    const rows = receiptRows(r), H0 = 76, rowsH = rows.length * 22, H1 = H0 + rowsH + (r.saved ? 18 : 0) + 44 + 88;
    const ap = clamp((G.t - r.t0) / 0.45, 0, 1), ease = 1 - Math.pow(1 - ap, 3);
    const op = r.out ? clamp((G.t - r.out) / 0.45, 0, 1) : 0;
    const x0 = Math.round(VW / 2 - RCW / 2), yRest = Math.max(30, Math.round((VH - H1) / 2) - 6);
    const x = Math.round(x0 + op * op * (CART.x - x0)), y = Math.round(VH + 10 + (yRest - VH - 10) * ease + op * op * (CART.y - yRest)), INK = '#1e3a6a', RED = '#b8302a';
    g.save();
    if (op) { const k = 1 - op * 0.8; g.translate(x + RCW / 2, y); g.scale(k, k); g.translate(-x - RCW / 2, -y); g.globalAlpha = 1 - op * 0.6; }
    if (!op) { g.globalAlpha = ease; g.fillStyle = 'rgba(14,8,20,0.38)'; g.fillRect(0, 0, VW, VH); g.globalAlpha = 1; }
    // paper: torn (deckled) top and bottom edges, washi fibres, a faint red rule down each side
    const edge = (yy, dir) => { for (let k = 0; k < RCW; k += 4) { const d = 1 + Math.floor(rnd(k * 3 + dir * 17) * 4); rect(g, x + k, dir < 0 ? yy - d : yy, 4, d, '#f6eedb'); } };
    rect(g, x + 4, y + 5, RCW, H1, 'rgba(20,10,20,0.3)');
    rect(g, x - 1, y, RCW + 2, H1, DK); rect(g, x, y, RCW, H1, '#f6eedb'); edge(y, -1); edge(y + H1, 1);
    for (let k = 0; k < 30; k++) rect(g, x + 6 + Math.floor(rnd(k * 7 + 3) * (RCW - 18)), y + 8 + Math.floor(rnd(k * 11 + 5) * (H1 - 16)), 2 + Math.floor(rnd(k) * 6), 1, '#ebe0c6');
    rect(g, x + 6, y, 1, H1, '#e8b0a0'); rect(g, x + RCW - 7, y, 1, H1, '#e8b0a0');
    // header: the indigo noren band with the moon crest
    rect(g, x + 10, y + 8, RCW - 20, 30, INK); rect(g, x + 10, y + 8, RCW - 20, 2, '#2f6ab0');
    for (let k = x + 10; k < x + RCW - 10; k += 6) rect(g, k, y + 38, 3, 4, INK);   // noren fringe
    ell(g, x + 26, y + 23, 9, 9, '#fbf6ea'); ell(g, x + 29, y + 20, 6, 6, INK);
    textC(g, 'KITSUNE-YA', x + RCW / 2 + 10, y + 16, '#fbf6ea');
    textC(g, r.when + '   NO.' + String(r.no).padStart(4, '0'), x + RCW / 2, y + 50, '#7a8aa8');
    let yy = y + H0;
    const dots = yy2 => { for (let k = x + 12; k < x + RCW - 12; k += 4) rect(g, k, yy2, 2, 1, '#a8b4cc'); };
    dots(yy - 6);
    for (const row of rows) {
      if (row.small) {
        text(g, row.l, x + 18, yy - 1, '#7a8aa8');
        if (row.sale) { const w = textW('SALE') + 6, sx = x + RCW - 14 - w; rect(g, sx, yy - 4, w, 18, RED); text(g, 'SALE', sx + 3, yy, '#fbf6ea'); }
      } else { text(g, row.l, x + 14, yy, INK); text(g, row.r, x + RCW - 14 - textW(row.r), yy, INK); }
      yy += 22;
    }
    if (r.saved) { text(g, 'YOU SAVED', x + 14, yy + 2, RED); text(g, r.saved + 'G', x + RCW - 14 - textW(r.saved + 'G'), yy + 2, RED); yy += 18; }
    dots(yy + 2); yy += 10;
    text(g, 'TOTAL', x + 14, yy, INK); text(g, r.total + 'G', x + RCW - 14 - textW(r.total + 'G'), yy, INK);
    text(g, 'YOUR PURSE', x + 14, yy + 18, '#7a8aa8'); text(g, r.purse + 'G', x + RCW - 14 - textW(r.purse + 'G'), yy + 18, '#7a8aa8');
    yy += 42; dots(yy - 4);
    // footer: thanks in ink, then the red fox seal, which thumps down a moment after the slip arrives
    textC(g, r.thanks || 'ARIGATOU! COME AGAIN', x + RCW / 2, yy + 4, INK);
    text(g, '- Aoi', x + 18, yy + 30, '#2f6ab0');
    for (const [px, py] of [[x + 30, yy + 54], [x + 46, yy + 62]]) { ell(g, px, py, 4, 3, '#c8d0e0'); for (const [tx, ty] of [[-4, -5], [0, -7], [4, -5]]) ell(g, px + tx, py + ty, 1, 1, '#c8d0e0'); }   // little paw prints
    const st = G.t - r.t0 - 0.8;
    if (st > 0) {
      if (!r.stamped) { r.stamped = true; H.sfx.stamp && H.sfx.stamp(); }
      const k = st < 0.12 ? 1.7 - st / 0.12 * 0.7 : 1, sx = x + RCW - 52, sy = yy + 44;
      g.save(); g.translate(sx, sy); g.rotate(-0.16); g.scale(k, k); g.globalAlpha *= st < 0.12 ? 0.5 + st / 0.24 : 0.92;
      ell(g, 0, 0, 26, 26, RED); ell(g, 0, 0, 23, 23, '#f6eedb'); ell(g, 0, 0, 21, 21, RED);
      poly(g, [[-13, -4], [-11, -18], [-4, -9]], '#f6eedb'); poly(g, [[4, -9], [11, -18], [13, -4]], '#f6eedb');   // fox ears
      ell(g, 0, 2, 12, 10, '#f6eedb'); poly(g, [[-12, 2], [0, 15], [12, 2]], '#f6eedb');
      rect(g, -6, 0, 3, 2, RED); rect(g, 3, 0, 3, 2, RED); rect(g, -1, 8, 2, 2, RED);
      g.restore();
    }
    g.restore();
  }

  /* ---------- the cart: a little rattan handcart in the corner of the screen; click it to take it to Aoi ---------- */
  const CART = { x: VW - 128, y: VH - 92, w: 104, h: 78 };
  function goCheckout() {
    if (!S.basket.length) { H.sfx.bad(); bubble('Your cart is empty, chef. Tap anything on the shelves to have a look.'); return; }
    H.sfx.tap(); S.camT = 0; talk('checkout');
  }
  const atCounter = () => S.ui === 'talk' && (S.view === 'checkout' || S.view === 'confirm');
  function drawCart(g) {
    const hot = S.hover && S.hover.kind === 'cart', bump = G.t - S.cartT < 0.25 ? Math.round(Math.sin((G.t - S.cartT) / 0.25 * Math.PI) * 4) : 0;
    const x = CART.x, y = CART.y - bump, n = basketN();
    // wheels and frame
    for (const wx of [x + 24, x + 80]) { ell(g, wx, y + 70, 8, 8, DK); ell(g, wx, y + 70, 6, 6, '#5a3a22'); ell(g, wx, y + 70, 2, 2, '#c9962e'); }
    rect(g, x + 14, y + 60, 78, 4, DK); rect(g, x + 15, y + 61, 76, 2, '#8a5a32');
    rect(g, x + 88, y + 4, 4, 58, DK); rect(g, x + 89, y + 5, 2, 56, '#a57a4c'); rect(g, x + 84, y + 2, 18, 5, DK); rect(g, x + 85, y + 3, 16, 3, '#c8302a');   // handle
    // goods poking out of the basket (unloaded onto the counter while you check out)
    if (!atCounter()) S.basket.slice(0, 5).forEach((b, i) => { g.save(); g.translate(x + 22 + i * 15, y + 25 - (i % 2) * 4); g.scale(0.5, 0.5); drawItem(g, b.id, 0, 0, 1, false); g.restore(); });
    // the rattan basket
    poly(g, [[x + 4, y + 22], [x + 90, y + 22], [x + 84, y + 60], [x + 10, y + 60]], DK);
    poly(g, [[x + 6, y + 24], [x + 88, y + 24], [x + 83, y + 58], [x + 11, y + 58]], hot ? '#e0aa6a' : '#c8925a');
    for (let k = 0; k < 4; k++) rect(g, x + 8 + k, y + 30 + k * 8, 78 - k * 2, 2, '#a8723a');
    for (let k = 0; k < 9; k++) rect(g, x + 13 + k * 9, y + 25, 2, 32, '#b07c44');
    rect(g, x + 4, y + 21, 86, 3, '#8a5a32');
    // a count badge and the total
    if (n) { ell(g, x + 8, y + 18, 11, 11, DK); ell(g, x + 8, y + 18, 10, 10, '#c8302a'); textC(g, String(n), x + 8, y + 12, '#fbf6ea'); }
    if (n) { const t = basketTotal() + 'G', w = textW(t) + 10; rect(g, x + 47 - w / 2, y + 40, w, 15, DK); rect(g, x + 48 - w / 2, y + 41, w - 2, 13, '#fff5e0'); textC(g, t, x + 47, y + 41, '#5a3a22'); }
  }
  function drawFlys(g) {
    for (const f of S.flys) {
      const e = f.t * f.t * (3 - 2 * f.t), tx = CART.x + 46, ty = CART.y + 30;
      const fx = f.x + (tx - f.x) * e, fy = f.y + (ty - f.y) * e - Math.sin(f.t * Math.PI) * 70, k = 0.9 - 0.4 * e;
      g.save(); g.translate(Math.round(fx), Math.round(fy)); g.scale(k, k); drawItem(g, f.id, 0, 0, 1, false); g.restore();
    }
  }

  /* ---------- HTML: inspect card and the talk / checkout panel ---------- */
  const artPic = {};
  function artURL(id) {
    const key = id;
    if (!artPic[key]) {
      const c = PX.mk(120, 92), g = c.getContext('2d'); g.imageSmoothingEnabled = false;
      g.scale(2, 2); drawItem(g, id, 30, 40, 9, true); artPic[key] = c.toDataURL();
    }
    return artPic[key];
  }
  function closePanels() {
    if (S.ui === 'receipt' && S.receipt) return;
    S.ui = null; S.sel = null;
    for (const id of ['ns-card', 'ns-talk']) { const el = $(id); if (el) el.classList.remove('show'); }
  }
  function inspect(id) {
    id = real(id); const it = item(id); if (!it) return;
    S.ui = 'card'; S.sel = id; S.qty = 1;
    $('ns-talk').classList.remove('show');
    renderCard(); $('ns-card').classList.add('show'); H.sfx.tap();
  }
  function renderCard() {
    const it = item(S.sel), el = $('ns-card'); if (!it) return;
    const room = Math.max(0, it.left - inBasket(it.id)); S.qty = clamp(S.qty, room ? 1 : 0, Math.max(1, room));
    let rows = `<dt>Price</dt><dd>${it.sale ? '<b class="ns-sale">' : ''}${it.price}G${it.sale ? '</b>' : ''}${it.kind === 'gear' ? '' : ' a pack'}${it.full ? ` <s>${it.full}G</s> <span class="ns-saletag">Tonight's special</span>` : ''}</dd>`;
    if (it.kind !== 'gear') rows += `<dt>Pack</dt><dd>${esc(it.unit)}</dd><dt>On the shelf</dt><dd>${it.left > 0 ? it.left + ' left tonight' : 'Sold out'}</dd>`;
    if (it.kind === 'ing') rows += `<dt>In your kitchen</dt><dd>${it.have}</dd>`;
    let act;
    if (!it.on) act = `<p class="ns-lock">Unlocks on the ${ROAD_NAME} at ${esc(lockPlace(it.node))}.</p>`;
    else if (it.bought) act = `<p class="ns-ok">Installed in your kitchen.</p>`;
    else if (!room) act = `<p class="ns-lock">${it.left ? 'All of tonight’s stock is in your cart.' : 'Sold out tonight. Fresh stock tomorrow night.'}</p>`;
    else act = (it.kind === 'gear' ? '' : `<div class="ns-qty"><button type="button" class="btn" data-q="-1" aria-label="One less">&minus;</button><b>${S.qty}</b><button type="button" class="btn" data-q="1" aria-label="One more">+</button><span>= ${S.qty * it.price}G</span></div>`)
      + `<button type="button" class="btn ns-add">Add to cart</button>`;
    const bn = basketN();
    el.innerHTML = `<button type="button" class="ns-x" aria-label="Close">&times;</button>
      <div class="ns-top"><img class="px ns-art${rare(it)}" src="${artURL(it.id)}" alt=""><div><b>${esc(it.name)}</b><span class="ns-rar rar-${rarity(it)}">${RARITY[rarity(it)]}</span><small>${esc(it.desc)}</small></div></div>
      <dl class="ns-facts">${rows}</dl>${act}
      <div class="ns-bk">${bn ? `Cart: ${bn} item${bn === 1 ? '' : 's'}, ${basketTotal()}G` : 'Your cart is empty'}</div>`;
    el.querySelector('.ns-x').onclick = () => { closePanels(); H.sfx.tap(); };
    el.querySelectorAll('[data-q]').forEach(b => { b.onclick = () => { S.qty = clamp(S.qty + +b.dataset.q, 1, room); H.sfx.tap(); renderCard(); }; });
    const add = el.querySelector('.ns-add');
    if (add) add.onclick = () => { if (addToBasket(it.id, it.kind === 'gear' ? 1 : S.qty)) { S.qty = 1; renderCard(); } };
  }
  // The talk panel: Aoi's lines on top, then either choices, her order list (the whole catalogue) or the checkout.
  function say(msg) { S.talk.full = msg; S.talk.shown = 0; }
  // Aoi's heart scenes (js/aoi.js): one line at a time in the talk panel, with your replies as choices
  function startScene(k) { S.scene = { k, steps: AOI.scene(k).slice(), i: 0 }; S.aoi.hop = 0.5; talk('scene'); }
  function sceneStep() { const sc = S.scene, s = sc && sc.steps[sc.i]; return s == null ? null : typeof s === 'string' ? { a: s } : s; }
  function sceneNext(reply) {
    const sc = S.scene; if (!sc) return;
    if (reply) sc.steps.splice(sc.i + 1, 0, reply);   // her answer to what you said comes next
    sc.i++;
    if (sc.i >= sc.steps.length) { AOI.finishScene(sc.k); AOI.gain(2, 'chat'); S.scene = null; S.aoi.hop = 0.5; talk('menu', AOI.menuLine()); return; }
    S.aoi.hop = 0.3; talk('scene');
  }
  function talk(view = 'menu', msg) {
    S.ui = 'talk'; S.view = view; $('ns-card').classList.remove('show');
    S.aoi.tx = view === 'checkout' || view === 'confirm' ? REG.x - 20 : 420;
    if (msg) say(msg);
    else if (view === 'scene') say(sceneStep().a);
    else if (view === 'menu') say(S.basket.length ? 'Ready to pay, chef? Or shall I fetch something from the back?' : AOI.menuLine());
    else if (view === 'list') say('Tell me what you need and I will fetch it.');
    else if (view === 'checkout') say(S.basket.length ? 'Let me see what you have...' : 'Your cart is empty, chef.');
    renderTalk(); $('ns-talk').classList.add('show');
  }
  function renderTalk() {
    const body = $('ns-body'), ch = $('ns-choices'), total = basketTotal();
    let html = '', choices = [];
    if (S.view === 'scene') {
      const s = sceneStep();
      if (s.r) s.r.forEach(([lab, ans]) => choices.push([lab, () => sceneNext(ans), 'heart']));
      else choices.push(['...', () => sceneNext()]);
    } else if (S.view === 'menu') {
      const k = AOI.sceneReady();   // a new heart: she has something to tell you (top of the list, with a heart)
      if (k) choices.push([k === 1 ? 'You seem thoughtful tonight, Aoi.' : 'Is something on your mind, Aoi?', () => startScene(k), 'heart']);
      if (S.basket.length) choices.push(['Pay for my cart (' + total + 'G)', () => talk('checkout')]);
      choices.push(['Could you fetch something?', () => talk('list')]);
      choices.push(["What's the special tonight?", () => { const it = item(market().special); talk('menu', it.left ? 'Tonight it is ' + it.name.toLowerCase() + ', ' + it.price + 'G a pack instead of ' + it.full + 'G. Look for the red SALE tag.' : 'The special is all gone tonight. You have good taste, chef.'); }]);
      if (!k) choices.push([AOI.tier() ? 'Chat with Aoi' : 'Tell me about yourself', () => { AOI.gain(2, 'chat'); S.aoi.hop = 0.3; talk('menu', AOI.chat()); }]);
      choices.push(['Goodbye', () => { closePanels(); bubble(AOI.bye()); H.sfx.tap(); }]);
    } else if (S.view === 'list') {
      html = '<div class="ns-list">' + CATALOGUE().map(([sec, ids]) => `<h4>${sec}</h4>` + ids.map(id => {
        const it = item(id), room = it.left - inBasket(id);
        const why = !it.on ? ROAD_NAME : it.bought ? 'Installed' : room <= 0 ? (it.left ? 'In cart' : 'Sold out') : '';
        return `<div class="ns-row${why ? ' off' : ''}"><img class="px${rare(it)}" src="${artURL(id)}" alt=""><span class="ns-nm">${esc(it.name)}${it.sale ? ' <i class="ns-saletag">Sale</i>' : ''}</span><span class="ns-pr">${it.full ? `<s>${it.full}G</s> ` : ''}${it.price}G</span>`
          + (why ? `<span class="ns-why">${why}</span>` : `<button type="button" class="btn" data-add="${id}">+1</button>`) + '</div>';
      }).join('')).join('') + '</div>';
      choices.push(['Back', () => talk('menu')]);
      if (S.basket.length) choices.push(['Pay (' + total + 'G)', () => talk('checkout')]);
    } else if (S.view === 'checkout') {
      if (S.basket.length) {
        html = '<div class="ns-list">' + S.basket.map(b => { const it = item(b.id); return `<div class="ns-row"><img class="px${rare(it)}" src="${artURL(b.id)}" alt=""><span class="ns-nm">${esc(it.name)}</span>`
          + (it.kind === 'gear' ? '<span class="ns-n">1</span>' : `<button type="button" class="btn" data-dec="${b.id}" aria-label="One less">&minus;</button><span class="ns-n">${b.n}</span><button type="button" class="btn" data-inc="${b.id}" aria-label="One more">+</button>`)
          + `<span class="ns-pr">${it.price * b.n}G</span><button type="button" class="ns-del" data-del="${b.id}" aria-label="Remove">&times;</button></div>`; }).join('')
          + `<div class="ns-total"><span>Total</span><b>${total}G</b></div><div class="ns-total sm"><span>Your purse</span><span>${G.gold}G</span></div></div>`;
        if (G.gold >= total) choices.push(['Pay ' + total + 'G', () => talk('confirm', 'That comes to ' + total + 'G. Shall I wrap it up for you?')]);
        else { choices.push(['Pay ' + total + 'G', null]); if (!S.talk.full.includes('short')) say('Hmm. You are ' + (total - G.gold) + 'G short, chef. Take something out?'); }
      }
      choices.push(['Keep shopping', () => { closePanels(); H.sfx.tap(); }]);
    } else if (S.view === 'confirm') {
      choices.push(['Yes, pay ' + total + 'G', () => { const got = pay(); if (got) giveReceipt(); else talk('checkout'); }]);
      choices.push(['Not yet', () => talk('checkout')]);
    } else if (S.view === 'done') {
      choices.push(['Keep shopping', () => { closePanels(); H.sfx.tap(); }]);
      choices.push(['Goodbye', () => { closePanels(); bubble(AOI.done()); }]);
    }
    body.innerHTML = html;
    ch.innerHTML = choices.map(([t, fn, heart], i) => `<button type="button" class="choice${fn ? '' : ' off'}${heart ? ' heart' : ''}" data-i="${i}"${fn ? '' : ' disabled'}>${heart ? '<i class="aff-h on"></i> ' : ''}${esc(t)}</button>`).join('');
    ch.querySelectorAll('.choice').forEach(b => { const fn = choices[+b.dataset.i][1]; if (fn) b.onclick = () => { H.sfx.tap(); fn(); }; });
    body.querySelectorAll('[data-add]').forEach(b => { b.onclick = () => { addToBasket(b.dataset.add, 1); renderTalk(); }; });
    body.querySelectorAll('[data-inc]').forEach(b => { b.onclick = () => { const id = b.dataset.inc; if (!addToBasket(id, 1)) return; renderTalk(); }; });
    body.querySelectorAll('[data-dec]').forEach(b => { b.onclick = () => { setBasket(b.dataset.dec, inBasket(b.dataset.dec) - 1); H.sfx.tap(); talk('checkout'); }; });
    body.querySelectorAll('[data-del]').forEach(b => { b.onclick = () => { setBasket(b.dataset.del, 0); H.sfx.tap(); talk('checkout'); }; });
  }

  /* ---------- input ---------- */
  function hitStore(w) {
    if (inR(w, DOOR)) return { kind: 'door', x: DOOR.x + DOOR.w / 2, y: DOOR.y - 6, label: 'EXIT TO STREET' };
    const a = S.aoi;
    if (inR(w, { x: a.x - 46, y: 216, w: 92, h: CTOP - 216 }) || inR(w, COUNTER)) return { kind: 'aoi', x: a.x, y: 196, label: S.basket.length ? 'AOI: PAY' : 'AOI' };
    for (const s of SLOTS) if (inR(w, s.r)) {
      const it = item(s.id);
      const lab = !it.on ? 'LOCKED' : it.bought ? 'IN YOUR KITCHEN' : (it.sale ? 'SALE: ' : '') + it.name + ' ' + it.price + 'G';   // (item names as written: long ones read better than in capitals)
      return { kind: 'item', id: real(s.id), x: s.x, y: s.base - 78, r: s.r, label: lab, muted: !it.on || it.bought || it.left <= 0 };
    }
    for (const p of PROPS) if (inR(w, p.r)) return { kind: 'prop', p, x: p.r.x + p.r.w / 2, y: p.r.y - 22, r: p.r };
    return null;
  }
  const RDOOR = { x: 120, y: 222, w: 180, h: 208 }, SDOOR = { x: 762, y: 226, w: 136, h: 204 }, VEND = { x: 410, y: 300, w: 52, h: 130 }, CAT = { x: 412, y: 278, w: 46, h: 24 };
  function hitStreet(w) {
    if (inR(w, RDOOR)) return { kind: 'home', x: RDOOR.x + RDOOR.w / 2, y: RDOOR.y - 26, label: 'COZY RAMEN' };
    if (inR(w, SDOOR)) return { kind: 'shop', x: SDOOR.x + SDOOR.w / 2, y: SDOOR.y - 26, label: storeOpen() ? 'KITSUNE-YA' : 'CLOSED UNTIL ' + pad2(SHOP_HOURS.open) + ':00', muted: !storeOpen() };
    if (inR(w, CAT)) return { kind: 'cat', x: CAT.x + 23, y: CAT.y - 24, label: 'MOCHI' };
    if (inR(w, VEND)) return { kind: 'vend', x: VEND.x + 26, y: VEND.y - 50, label: 'VENDING MACHINE' };
    return null;
  }
  function edgeAt(p) {
    if (G.where !== 'store' || !p || S.ui === 'talk') return 0;
    if (p.x < EDGE && S.camT > 0) return -1;
    if (p.x > VW - EDGE && S.camT < SW - VW) return 1;
    return 0;
  }
  function down(p) {
    if (S.fadeDir) return;
    if (G.where === 'street') {
      const h = hitStreet(p); if (!h) return;
      if (h.kind === 'home') { if (S.rdoorT) return; S.rdoorT = 1; H.sfx.rumble(); setTimeout(() => backHome(0), 420); return; }
      if (h.kind === 'shop') return enter('store');
      if (h.kind === 'cat') { H.sfx.meow(); S.catT = G.t; return; }
      if (h.kind === 'vend') { H.sfx.tap(); return H.say(pick(['Hot corn soup, iced barley tea... and a tiny can of ramen broth. Rude.', 'The machine hums a little tune. Someone left a coin in the slot.'])); }
      return;
    }
    if (S.ui === 'receipt') return tuckReceipt();
    if (inR(p, CART)) return goCheckout();
    if (S.ui === 'talk') { closePanels(); return; }
    const e = edgeAt(p);
    if (e) { S.camT = clamp(S.camT + e * 480, 0, SW - VW); H.sfx.tap(); return; }
    const w = W(p), h = hitStore(w);
    if (h && h.kind === 'door') { H.sfx.tap(); return leaveStore(); }
    if (h && h.kind === 'aoi') { H.sfx.tap(); return talk(S.basket.length ? 'checkout' : 'menu'); }
    if (h && h.kind === 'item') return inspect(h.id);
    if (h && h.kind === 'prop') { H.sfx.tap(); return bubble(pick(h.p.say)); }
    S.drag = { x: p.x, cam: S.camT, moved: false };   // empty space: drag to look around
  }
  function move(p) { if (S.drag && p) { const dx = p.x - S.drag.x; if (Math.abs(dx) > 4) S.drag.moved = true; S.camT = S.cam = clamp(S.drag.cam - dx, 0, SW - VW); } }
  function up() { if (S.drag && !S.drag.moved && S.ui === 'card') closePanels(); S.drag = null; }
  function wheel(d) { if (G.where === 'store') S.camT = clamp(S.camT + d * 0.9, 0, SW - VW); }
  function key(e) {
    const k = e.key.toLowerCase();
    if (S.ui === 'receipt') { if ([' ', 'enter', 'escape'].includes(k)) { tuckReceipt(); return true; } return true; }
    if (k === 'escape') { if (S.ui) { closePanels(); return true; } return false; }
    if (G.where !== 'store' || (e.target && e.target.tagName === 'INPUT')) return false;
    if (k === 'a' || k === 'arrowleft') { S.keys.l = true; return true; }
    if (k === 'd' || k === 'arrowright') { S.keys.r = true; return true; }
    return false;
  }
  function keyup(k) { if (k === 'a' || k === 'arrowleft') S.keys.l = false; if (k === 'd' || k === 'arrowright') S.keys.r = false; }

  /* ---------- update ---------- */
  function update(dt) {
    if (S.fadeDir) {
      S.fade = clamp(S.fade + S.fadeDir * dt / 0.32, 0, 1);
      if (S.fade >= 1 && S.fadeDir > 0) { const fn = S.then; S.then = null; S.fadeDir = -1; if (fn) fn(); }
      else if (S.fade <= 0 && S.fadeDir < 0) S.fadeDir = 0;
    }
    if (!G.where) return;
    if (G.where === 'store' && !storeOpen() && !S.closing && !S.fadeDir) {
      S.closing = 3.2; closePanels(); bubble(AOI.closing(), 3.2); S.aoi.hop = 0.4;
    }
    if (S.closing > 0) { S.closing -= dt; if (S.closing <= 0) leaveStore(); }
    S.door += clamp(S.doorT - S.door, -dt * 3.2, dt * 3.2);
    S.sdoor += clamp(S.sdoorT - S.sdoor, -dt * 3.2, dt * 3.2);
    S.rdoor += clamp(S.rdoorT - S.rdoor, -dt * 2.8, dt * 2.8);
    if (G.where === 'store') {
      const pan = (S.keys.r ? 1 : 0) - (S.keys.l ? 1 : 0);
      if (pan) S.camT = clamp(S.camT + pan * 820 * dt, 0, SW - VW);
      S.cam += (S.camT - S.cam) * Math.min(1, dt * 9); if (Math.abs(S.camT - S.cam) < 0.5) S.cam = S.camT;
      updateAoi(dt);
    }
    if (S.bubble) { S.bubble.t -= dt; if (S.bubble.t <= 0) S.bubble = null; }
    if (S.ui === 'talk' && S.talk.shown < S.talk.full.length) {
      const before = Math.floor(S.talk.shown); S.talk.shown = Math.min(S.talk.full.length, S.talk.shown + dt * 60);
      if (Math.floor(S.talk.shown) !== before && before % 3 === 0) H.sfx.blip(600);
      const el = $('ns-text'); if (el) el.textContent = S.talk.full.slice(0, Math.floor(S.talk.shown));
    } else if (S.ui === 'talk') { const el = $('ns-text'); if (el && el.textContent !== S.talk.full) el.textContent = S.talk.full; }
    for (const f of S.flys) { f.t += dt / 0.55; if (f.t >= 1 && !f.done) { f.done = true; S.cartT = G.t; S.pops.push({ str: '+' + f.n, x: CART.x + CART.w / 2 + S.cam, y: CART.y - 6, c: '#b6e37a', life: 1 }); } }
    S.flys = S.flys.filter(f => f.t < 1);
    if (S.receipt && S.receipt.out && G.t - S.receipt.out > 0.5) { S.receipt = null; S.ui = null; bubble(pick(['Thank you, chef! The bag will be in your kitchen before you are.', 'Pleasure doing business! Keep the receipt for your books.', 'Arigatou! Cook something lovely tonight.'])); }
    for (const p of S.parts) p.k += dt * 1.6;
    S.parts = S.parts.filter(p => p.k < 1);
    for (const p of S.pops) { p.y -= 26 * dt; p.life -= dt; }
    S.pops = S.pops.filter(p => p.life > 0);
    S.hover = G.mouse && !S.drag ? (G.where === 'street' ? hitStreet(G.mouse) : S.ui === 'receipt' ? null : inR(G.mouse, CART) ? { kind: 'cart' } : (edgeAt(G.mouse) ? null : hitStore(W(G.mouse)))) : null;
    S.edge = edgeAt(G.mouse);
  }

  /* ---------- drawing helpers ---------- */
  function post(g, x, y, w, h, c = '#6e4428') {
    rect(g, x - 1, y, w + 2, h, DK); rect(g, x, y, w, h, c);
    rect(g, x, y, 2, h, shade(c, 1.3)); rect(g, x + w - 3, y, 3, h, shade(c, 0.65));
  }
  function border(g, x, y, w, h, c, t = 6) {   // outlined wooden frame around a hole, leaving the inside alone
    for (const [rx, ry, rw, rh] of [[x - t, y - t, w + 2 * t, t], [x - t, y + h, w + 2 * t, t], [x - t, y, t, h], [x + w, y, t, h]]) { rect(g, rx - 1, ry - 1, rw + 2, rh + 2, DK); }
    for (const [rx, ry, rw, rh] of [[x - t, y - t, w + 2 * t, t], [x - t, y + h, w + 2 * t, t], [x - t, y, t, h], [x + w, y, t, h]]) { rect(g, rx, ry, rw, rh, c); rect(g, rx, ry, rw, 1, shade(c, 1.25)); }
    rect(g, x - 1, y - 1, w + 2, 1, DK); rect(g, x - 1, y + h, w + 2, 1, DK); rect(g, x - 1, y, 1, h, DK); rect(g, x + w, y, 1, h, DK);
  }
  function plank(g, x, y, w, h, c) { rect(g, x - 1, y - 1, w + 2, h + 2, DK); rect(g, x, y, w, h, c); rect(g, x, y, w, 1, shade(c, 1.3)); rect(g, x, y + h - 1, w, 1, shade(c, 0.6)); }
  function signBoard(g, s, cx, y, c = '#5a3a22', ink = '#ffe08a') {   // a plank sign hanging from the beam on two strings
    const w = textW(s) + 26, x = Math.round(cx - w / 2);
    line(g, x + 8, 34, x + 8, y, '#2a1a12'); line(g, x + w - 8, 34, x + w - 8, y, '#2a1a12');
    plank(g, x, y, w, 24, c); rect(g, x + 3, y + 3, w - 6, 18, shade(c, 0.85)); textC(g, s, cx, y + 7, ink);
  }
  // A paper price tag on the shelf edge, its text sized to fit. old: the usual price, struck through: a red SALE tag.
  function priceTag(g, x, y, s, c = '#4a3226', bg = '#fbf6ea', old) {
    if (old !== undefined) { c = '#fff6d0'; bg = '#c8302a'; }
    if (old === '-') old = '';   // narrow sale tag: no struck price
    const sale = old !== undefined, ow = old ? textW(old) + 6 : 0, sw = sale ? textW('SALE') + 6 : 0, w = ow + sw + textW(s) + 10, tx = Math.round(x - w / 2), h = 19;
    rect(g, tx - 1, y - 1, w + 2, h + 2, DK); rect(g, tx, y, w, h, bg); rect(g, tx, y, w, 1, shade(bg, 1.25)); rect(g, tx, y + h - 1, w, 1, shade(bg, 0.75));
    let px = tx + 5;
    if (old) { text(g, old, px, y + 4, '#ffb0a0'); rect(g, px - 1, y + 9, textW(old) + 2, 2, '#fff6d0'); px += ow; }
    if (sale) { text(g, 'SALE', px, y + 4, '#ffe08a'); px += sw; }
    text(g, s, px, y + 4, c);
  }
  function lockTag(g, x, y) {   // a small grey tag with a padlock: not on sale until the road gets there
    rect(g, x - 11, y - 1, 22, 21, DK); rect(g, x - 10, y, 20, 19, '#d8ccb6');
    rect(g, x - 4, y + 4, 8, 2, '#6a5e52'); rect(g, x - 4, y + 4, 2, 5, '#6a5e52'); rect(g, x + 2, y + 4, 2, 5, '#6a5e52'); rect(g, x - 6, y + 9, 12, 7, '#6a5e52'); rect(g, x - 1, y + 11, 2, 3, '#d8ccb6');
  }
  function jar(g, x, base, c, lid = '#3a2a22') {
    rect(g, x - 11, base - 30, 22, 30, DK); rect(g, x - 10, base - 29, 20, 28, '#e8dcc6'); rect(g, x - 10, base - 29, 4, 28, '#fff6e6'); rect(g, x + 6, base - 29, 4, 28, '#c8b89e');
    rect(g, x - 10, base - 20, 20, 10, c); rect(g, x - 10, base - 20, 20, 1, shade(c, 1.3)); rect(g, x - 4, base - 18, 8, 6, '#fbf6ea');
    rect(g, x - 12, base - 35, 24, 7, DK); rect(g, x - 11, base - 34, 22, 5, lid); rect(g, x - 11, base - 34, 22, 1, shade(lid, 1.4));
  }
  function tin(g, x, base, c) {
    rect(g, x - 10, base - 28, 20, 28, DK); rect(g, x - 9, base - 27, 18, 26, '#b8c0cc'); rect(g, x - 9, base - 27, 3, 26, '#e8eef6');
    rect(g, x - 9, base - 21, 18, 13, c); rect(g, x - 9, base - 21, 18, 1, shade(c, 1.35)); rect(g, x - 5, base - 17, 10, 5, '#fbf6ea'); rect(g, x - 3, base - 16, 6, 1, shade(c, 0.6)); rect(g, x - 3, base - 14, 4, 1, shade(c, 0.6));
    rect(g, x - 10, base - 29, 20, 2, '#8a929e');
  }
  function nest(g, x, base) {
    ell(g, x, base - 8, 12, 8, DK); ell(g, x, base - 8, 11, 7, '#e8c860'); ell(g, x - 1, base - 9, 8, 5, '#f6dc86');
    for (let k = -8; k <= 8; k += 4) rect(g, x + k, base - 13 + Math.abs(k) / 3, 2, 8, '#c8a040');
    rect(g, x - 3, base - 15, 6, 14, '#c8302a'); rect(g, x - 3, base - 15, 6, 1, '#ff7a6a');
  }
  // One product as it sits on its shelf: base = the shelf surface, n = packs left (fewer shown as it sells), big = the inspect picture.
  function drawItem(g, id, x, base, n, big) {
    const it = item(id), shown = n >= 5 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0;
    if (it.kind === 'ing' || it.kind === 'special') {
      const iid = it.kind === 'special' ? it.of : id;
      if (it.kind === 'special') {   // a lacquer tray on a stand
        rect(g, x - 26, base - 6, 52, 6, DK); rect(g, x - 25, base - 5, 50, 4, '#a01e3a'); rect(g, x - 25, base - 5, 50, 1, '#e05a6a');
        rect(g, x - 12, base - 1, 24, 1, DK);
      }
      const k = big ? 3 : Math.max(shown, it.kind === 'special' && n > 0 ? 1 : 0);
      if (TOPS.includes(iid)) {
        if (it.kind !== 'special') { rect(g, x - 30, base - 7, 60, 7, DK); rect(g, x - 29, base - 6, 58, 5, '#c9d1dd'); rect(g, x - 29, base - 6, 58, 1, '#f2f6fa'); }
        const offs = [[0, -16], [-14, -14], [14, -14]];
        for (let i = 0; i < k; i++) ART.top(g, iid, x + offs[i][0], base + offs[i][1] - (it.kind === 'special' ? 4 : 0), 0.95);
      } else if (iid === 'noodle') { for (let i = 0; i < k; i++) nest(g, x + [0, -16, 16][i], base - (i ? 0 : 1)); }
      else if (iid === CHILI_OIL) { for (let i = 0; i < k; i++) KITCHEN.oilBottle(g, x + [0, -16, 16][i], base, 6); }
      else if (iid.startsWith('tare.')) { for (let i = 0; i < k; i++) jar(g, x + [0, -22, 22][i], base, TARES[iid.slice(5)].c === '#e6dcc4' ? '#b8a888' : TARES[iid.slice(5)].c); }
      else { for (let i = 0; i < k; i++) tin(g, x + [0, -21, 21][i], base, BROTHS[iid.slice(6)].c); }
      return;
    }
    if (it.kind === 'crate') {
      rect(g, x - 26, base - 26, 52, 26, DK); rect(g, x - 25, base - 25, 50, 24, '#c8925a');
      for (const yy of [base - 25, base - 13]) { rect(g, x - 25, yy, 50, 1, '#e8b880'); rect(g, x - 25, yy + 11, 50, 1, '#8a5a32'); }
      if (big || n > 0) { ART.top(g, 'egg', x - 14, base - 28, 0.8); ART.top(g, 'chashu', x + 2, base - 30, 0.8); ART.top(g, 'scallion', x + 16, base - 27, 0.7); ART.top(g, 'nori', x - 2, base - 25, 0.6); }
      rect(g, x - 8, base - 18, 16, 8, '#fbf6ea'); rect(g, x - 6, base - 15, 12, 1, '#c8925a');
      return;
    }
    // equipment
    if (id.startsWith('stall')) {   // seat kit: a paper lantern on a little stand, with the seat number, and a stool
      const n = id.slice(5);
      rect(g, x - 12, base - 50, 3, 50, DK); rect(g, x - 26, base - 52, 20, 4, DK); rect(g, x - 25, base - 51, 18, 2, '#8a5a32');
      rect(g, x - 17, base - 48, 1, 4, DK);
      ell(g, x - 17, base - 32, 11, 13, DK); ell(g, x - 17, base - 32, 10, 12, '#f2e2bc');
      for (const ry of [-8, -4, 0, 4, 8]) { const hw = Math.round(10 * Math.sqrt(1 - (ry / 13) ** 2)); rect(g, x - 17 - hw, base - 32 + ry, hw * 2 + 1, 1, '#c8aa7a'); }
      rect(g, x - 23, base - 45, 13, 3, DK); rect(g, x - 23, base - 20, 13, 3, DK);
      textC(g, n, x - 17, base - 41, '#a8302a');
      ell(g, x + 18, base - 16, 10, 4, DK); ell(g, x + 18, base - 17, 9, 3, '#c8302a'); ell(g, x + 16, base - 18, 4, 1, '#e8604a');
      for (const lx of [x + 11, x + 23]) { rect(g, lx - 1, base - 14, 4, 14, DK); rect(g, lx, base - 14, 2, 14, '#6e4428'); }
    } else if (id.startsWith('board')) {   // menu board upgrade: a small wooden menu plank on a stand, with its slot number
      const n = id.slice(5), big = n === '10';
      rect(g, x - 2, base - 6, 4, 6, DK); rect(g, x - 12, base - 2, 24, 2, DK);
      rect(g, x - 20, base - 40, 40, 34, DK); SCENE.wood(g, x - 19, base - 39, 38, 32, big ? '#3a2418' : '#6e4428', 32, false, 17);
      rect(g, x - 16, base - 36, 32, 26, big ? '#1e140e' : '#2e2018'); if (big) { rect(g, x - 19, base - 39, 38, 1, PAL.brass); rect(g, x - 19, base - 8, 38, 1, PAL.brass); }
      for (let k = 0; k < 3; k++) rect(g, x - 12, base - 32 + k * 6, 14 + (k % 2) * 6, 1, '#d8c8a0');
      textC(g, n, x + 9, base - 30, '#ffd76a');
    } else if (id === 'caddy') {   // garnish caddy: a cedar box of spring onion, nori sheets standing at the back
      for (const [ox, h] of [[-9, 12], [-3, 14], [3, 11]]) { rect(g, x + ox - 1, base - 14 - h, 6, h + 2, DK); rect(g, x + ox, base - 13 - h, 4, h, '#1c3626'); rect(g, x + ox, base - 13 - h, 1, h, '#3c6a4a'); }
      rect(g, x - 15, base - 15, 30, 15, DK); rect(g, x - 14, base - 14, 28, 13, '#c8925a'); rect(g, x - 14, base - 14, 28, 2, '#e8b880'); rect(g, x - 14, base - 3, 28, 2, '#8a5a32');
      for (let k = 0; k < 9; k++) { const gx = x - 11 + (k % 5) * 5, gy = base - 12 + Math.floor(k / 5) * 3; rect(g, gx, gy, 2, 2, k % 3 ? '#5fbf40' : '#c8ef9a'); }
    } else if (id === 'quick') {   // waiting bench: a little cedar bench with a cushion
      rect(g, x - 28, base - 16, 56, 7, DK); rect(g, x - 27, base - 15, 54, 5, '#c8925a'); rect(g, x - 27, base - 15, 54, 1, '#e8b880');
      rect(g, x - 20, base - 19, 18, 4, DK); rect(g, x - 19, base - 18, 16, 2, '#2f6ab0'); rect(g, x + 4, base - 19, 18, 4, DK); rect(g, x + 5, base - 18, 16, 2, '#c8302a');
      for (const lx of [x - 24, x + 20]) { rect(g, lx - 1, base - 9, 6, 9, DK); rect(g, lx, base - 9, 4, 9, '#8a5a32'); }
    } else if (id === 'bins') {   // bulk crates: two stacked cedar crates
      for (const [cx, cy, w, h] of [[x - 26, base - 18, 30, 18], [x + 2, base - 22, 26, 22], [x - 20, base - 32, 24, 14]]) {
        rect(g, cx - 1, cy - 1, w + 2, h + 2, DK); rect(g, cx, cy, w, h, '#c8925a'); rect(g, cx, cy, w, 1, '#e8b880');
        rect(g, cx, cy + Math.floor(h / 2), w, 1, '#8a5a32'); rect(g, cx + 2, cy + 2, 2, h - 4, '#a8723a'); rect(g, cx + w - 4, cy + 2, 2, h - 4, '#a8723a');
      }
      rect(g, x + 8, base - 15, 14, 7, '#fbf6ea'); rect(g, x + 10, base - 12, 10, 1, '#c8302a');
    } else if (id === 'boil') {
      rect(g, x - 24, base - 8, 48, 8, DK); rect(g, x - 23, base - 7, 46, 6, '#3a3a44');
      const fl = Math.round(Math.sin((G.t || 0) * 12) * 1.5);
      for (let k = -16; k <= 16; k += 8) { poly(g, [[x + k - 3, base - 8], [x + k, base - 15 - fl - (k % 16 ? 2 : 0)], [x + k + 3, base - 8]], '#ff9a2a'); rect(g, x + k - 1, base - 11, 2, 3, '#ffe08a'); }
      ell(g, x, base - 30, 22, 6, DK); rect(g, x - 22, base - 30, 44, 18, DK); rect(g, x - 21, base - 30, 42, 17, '#9aa4b2'); rect(g, x - 21, base - 30, 6, 17, '#d8e0ea');
      ell(g, x, base - 31, 21, 5, '#c9d1dd'); ell(g, x, base - 31, 17, 3, '#5a6a7a');
      rect(g, x - 28, base - 27, 7, 3, DK); rect(g, x + 21, base - 27, 7, 3, DK);
    } else if (id === 'tips') {   // maneki-neko beside a glass jar of coins
      const paw = Math.round(Math.sin((G.t || 0) * 4) * 2);
      rect(g, x + 4, base - 22, 22, 22, DK); rect(g, x + 5, base - 21, 20, 20, 'rgba(200,230,255,0.55)'); rect(g, x + 5, base - 9, 20, 8, '#e0b040'); rect(g, x + 7, base - 11, 6, 3, '#ffe08a'); rect(g, x + 5, base - 21, 3, 20, '#ffffff');
      ell(g, x - 12, base - 12, 12, 12, DK); ell(g, x - 12, base - 12, 11, 11, '#fbf6ea'); ell(g, x - 12, base - 27, 10, 9, DK); ell(g, x - 12, base - 27, 9, 8, '#fbf6ea');
      poly(g, [[x - 20, base - 31], [x - 18, base - 39], [x - 14, base - 33]], DK); poly(g, [[x - 10, base - 33], [x - 6, base - 39], [x - 4, base - 31]], DK);
      rect(g, x - 16, base - 28, 2, 2, DK); rect(g, x - 10, base - 28, 2, 2, DK); rect(g, x - 13, base - 25, 2, 1, '#c8302a');
      rect(g, x - 20, base - 19, 16, 3, '#c8302a'); ell(g, x - 12, base - 15, 3, 3, '#e0b040');
      rect(g, x - 4, base - 30 + paw, 6, 12, DK); rect(g, x - 3, base - 29 + paw, 4, 10, '#fbf6ea');
    }
  }

  /* ---------- the store: painted once, plus a foreground layer (counter front, cabinet glass, table front) ---------- */
  let BG = null, FG = null;
  function paintStore() {
    BG = PX.mk(SW, VH); FG = PX.mk(SW, VH);
    const g = BG.getContext('2d'), f = FG.getContext('2d');
    // ceiling, back wall, wainscot, floor
    SCENE.wood(g, 0, 0, SW, 34, '#4a3020', 12, false, 301); rect(g, 0, 33, SW, 2, DK);
    SCENE.plaster(g, 0, 35, SW, 266, '#e6d2ac', 303); SCENE.ao(g, 0, 35, SW, 266, 'top', 24, 0.45);
    rect(g, 0, 300, SW, 6, DK); rect(g, 0, 301, SW, 4, '#6e4428'); rect(g, 0, 301, SW, 1, '#a57a4c');
    SCENE.wood(g, 0, 306, SW, FLOOR - 306, '#5a3a22', 22, true, 307); SCENE.ao(g, 0, 306, SW, 40, 'top', 8, 0.5);
    rect(g, 0, FLOOR - 2, SW, 3, DK); SCENE.wood(g, 0, FLOOR + 1, SW, VH - FLOOR, '#8a6038', 18, false, 309); SCENE.ao(g, 0, FLOOR + 1, SW, 30, 'top', 14, 0.4);
    for (const x of [192, 590, 852, 1286, 1716, 2226]) post(g, x - 6, 35, 12, FLOOR - 35);
    // the doorway: night outside, a street lamp, the frame and a doormat
    for (let i = 0; i < 6; i++) rect(g, DOOR.x, DOOR.y + i * 32, DOOR.w, 33, mix('#1a2050', '#3a3a6a', i / 5));
    rect(g, DOOR.x, FLOOR - 40, DOOR.w, 40, '#2a2a3a'); rect(g, DOOR.x, FLOOR - 40, DOOR.w, 2, '#4a4a5e');
    rect(g, DOOR.x + 86, DOOR.y + 40, 3, FLOOR - 40 - DOOR.y - 40, '#151828'); ell(g, DOOR.x + 87, DOOR.y + 38, 7, 4, '#ffe8a0');
    border(g, DOOR.x, DOOR.y, DOOR.w, DOOR.h, '#6e4428', 8);
    rect(g, DOOR.x - 6, FLOOR + 8, DOOR.w + 12, 10, DK); rect(g, DOOR.x - 5, FLOOR + 9, DOOR.w + 10, 8, '#8a3a2a'); for (let k = 0; k < DOOR.w + 6; k += 6) rect(g, DOOR.x - 3 + k, FLOOR + 11, 3, 4, '#a85040');
    // behind the counter: the Inari shrine shelf, a calendar, shelves of jars, a clock
    plank(g, 280, 118, 128, 8, '#6e4428');
    rect(g, 316, 74, 56, 44, DK); rect(g, 317, 75, 54, 42, '#f2e6cc'); poly(g, [[306, 80], [344, 58], [382, 80]], DK); poly(g, [[309, 79], [344, 61], [379, 79]], '#c8302a');
    rect(g, 330, 88, 28, 30, '#c8302a'); rect(g, 334, 92, 20, 26, '#3a2a22'); rect(g, 341, 84, 6, 6, '#e0b040');
    for (const fx of [296, 392]) { rect(g, fx - 6, 96, 12, 22, DK); rect(g, fx - 5, 97, 10, 20, '#fbf6ea'); poly(g, [[fx - 6, 98], [fx - 4, 88], [fx - 1, 97]], DK); poly(g, [[fx + 1, 97], [fx + 4, 88], [fx + 6, 98]], DK); rect(g, fx - 5, 108, 10, 2, '#c8302a'); }
    rect(g, 232, 138, 36, 46, DK); rect(g, 233, 139, 34, 44, '#fbf6ea'); rect(g, 233, 139, 34, 10, '#c8302a'); for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) rect(g, 236 + c * 6, 153 + r * 7, 4, 4, r === 2 && c === 3 ? '#c8302a' : '#c9b892');
    for (const y of [196, 252]) { plank(g, 412, y, 150, 6, '#6e4428'); for (let i = 0; i < 6; i++) jar(g, 426 + i * 24, y, ['#93451f', '#4a7a9a', '#c8302a', '#6a8a3a', '#c89a18', '#7a3a1a'][(i + y) % 6], '#5a3a22'); }
    ell(g, 500, 120, 20, 20, DK); ell(g, 500, 120, 18, 18, '#6e4428'); ell(g, 500, 120, 15, 15, '#fbf6ea'); rect(g, 499, 108, 2, 13, DK); rect(g, 500, 119, 9, 2, DK);
    // specials cabinet: red velvet back and two glass shelves
    rect(g, 614, 176, 212, 218, DK); rect(g, 616, 178, 208, 214, '#7a1e2a');
    for (let y = 182; y < 390; y += 6) rect(g, 616, y, 208, 1, '#8a2a36');
    SCENE.ao(g, 616, 178, 208, 214, 'top', 18, 0.4);
    for (const y of [268, 362]) { rect(g, 616, y, 208, 4, DK); rect(g, 616, y, 208, 2, '#d8eef6'); }
    for (const lx of [624, 812]) rect(g, lx, 394, 6, FLOOR - 394, DK);
    // the fresh cooler: steel body, a cool lit interior, two shelves
    rect(g, 878, 144, 384, FLOOR - 144, DK); rect(g, 880, 146, 380, FLOOR - 146, '#c9d1dd');
    rect(g, 886, 162, 368, 224, '#e6f2f8'); for (let y = 164; y < 384; y += 8) rect(g, 886, y, 368, 1, '#d6e6ee');
    SCENE.ao(g, 886, 162, 368, 224, 'top', 14, 0.25, '#2a4a6a');
    for (const y of [222, 298, 374]) { rect(g, 886, y, 368, 4, DK); rect(g, 886, y, 368, 2, '#ffffff'); }
    rect(g, 880, 146, 380, 14, '#5a6a7a'); rect(g, 884, 150, 372, 6, '#f2fbff');
    rect(g, 880, 390, 380, FLOOR - 390, '#8a929e'); for (let x = 900; x < 1250; x += 14) rect(g, x, 404, 8, 2, '#5a626e'); for (let x = 900; x < 1250; x += 14) rect(g, x, 412, 8, 2, '#5a626e');
    // pantry shelving
    for (const x of [1306, 1688]) { rect(g, x - 1, 150, 12, FLOOR - 150, DK); rect(g, x, 150, 10, FLOOR - 150, '#7a5230'); rect(g, x, 150, 2, FLOOR - 150, '#a57a4c'); }
    for (const y of [150, 230, 330]) plank(g, 1306, y, 392, 8, '#8a5a32');
    SCENE.ao(g, 1316, 158, 372, 72, 'top', 10, 0.3); SCENE.ao(g, 1316, 238, 372, 92, 'top', 10, 0.3);
    for (let i = 0; i < 3; i++) { const sx = 1342 + i * 38; rect(g, sx - 18, 384 - (i % 2) * 4, 36, 46 + (i % 2) * 4, DK); rect(g, sx - 17, 385 - (i % 2) * 4, 34, 44 + (i % 2) * 4, '#e8dcc0'); rect(g, sx - 17, 385 - (i % 2) * 4, 34, 6, '#c9b892'); rect(g, sx - 8, 400, 16, 12, '#c8302a'); rect(g, sx - 5, 403, 10, 2, '#fbf6ea'); }
    // upgrades: a lacquered back panel framing two tiers: stall kits on the shelf, kitchen tools on the table
    rect(g, 1754, 104, 432, 238, DK); rect(g, 1756, 106, 428, 234, '#5a2a22');
    for (let y = 112; y < 340; y += 8) rect(g, 1756, y, 428, 1, '#62302a');
    SCENE.ao(g, 1756, 106, 428, 234, 'top', 18, 0.45);
    rect(g, 1756, 106, 428, 3, '#c9962e'); rect(g, 1756, 337, 428, 3, '#c9962e');
    plank(g, 1760, 232, 420, 8, '#8a5a32'); SCENE.ao(g, 1760, 240, 420, 24, 'top', 10, 0.3);
    for (const bx of [1772, 2168]) { rect(g, bx - 1, 240, 6, 12, DK); rect(g, bx, 240, 4, 11, '#6e4428'); }
    rect(g, 1760, 340, 420, 6, DK); rect(g, 1760, 340, 420, 4, '#a57a4c');
    // the market annex: a second cooler of newer ingredients, then the curio cabinet of rare goods
    { const A = ANNEX.cool, x0 = A.x, w = A.w;
      rect(g, x0 - 2, 144, w + 4, FLOOR - 144, DK); rect(g, x0, 146, w, FLOOR - 146, '#c9d1dd');
      rect(g, x0 + 6, 162, w - 12, 224, '#e6f2f8'); for (let y = 164; y < 384; y += 8) rect(g, x0 + 6, y, w - 12, 1, '#d6e6ee');
      SCENE.ao(g, x0 + 6, 162, w - 12, 224, 'top', 14, 0.25, '#2a4a6a');
      for (const y of [222, 298, 374]) { rect(g, x0 + 6, y, w - 12, 4, DK); rect(g, x0 + 6, y, w - 12, 2, '#ffffff'); }
      rect(g, x0, 146, w, 14, '#5a6a7a'); rect(g, x0 + 4, 150, w - 8, 6, '#f2fbff');
      rect(g, x0, 390, w, FLOOR - 390, '#8a929e'); for (let x = x0 + 20; x < x0 + w - 10; x += 14) { rect(g, x, 404, 8, 2, '#5a626e'); rect(g, x, 412, 8, 2, '#5a626e'); } }
    { const A = ANNEX.curio, x0 = A.x, w = A.w;   // a carved cabinet: deep violet velvet, glass shelves, brass trim
      rect(g, x0 - 2, 150, w + 4, 252, DK); rect(g, x0, 152, w, 248, '#3a2448');
      for (let y = 156; y < 398; y += 6) rect(g, x0, y, w, 1, '#442a54');
      SCENE.ao(g, x0, 152, w, 248, 'top', 18, 0.45);
      for (const y of [262, 362]) { rect(g, x0, y, w, 4, DK); rect(g, x0, y, w, 2, '#d8eef6'); }
      rect(g, x0, 152, w, 3, '#c9962e'); rect(g, x0, 397, w, 3, '#c9962e');
      for (const lx of [x0 + 10, x0 + w - 16]) rect(g, lx, 400, 6, FLOOR - 400, DK);
      for (let k = 0; k < 7; k++) { const sx = x0 + 30 + k * 56; dot(g, sx, 168 + (k % 2) * 6, '#ffe8a0'); dot(g, sx + 1, 169 + (k % 2) * 6, '#c8a8ff'); } }   // little sparkles
    for (const x of [2252, 2806, 3240]) post(g, x - 6, 35, 12, FLOOR - 35);
    // umbrella stand by the far wall
    rect(g, 2200, 360, 26, 70, DK); rect(g, 2201, 361, 24, 68, '#3a4a6a'); for (const [ux, c] of [[2206, '#c8302a'], [2214, '#e0b040'], [2220, '#2f7a8a']]) { rect(g, ux, 318, 3, 44, DK); poly(g, [[ux - 5, 340], [ux + 1, 318], [ux + 8, 340]], c); }

    // ---- foreground layer ----
    // counter: hinoki top, slatted front, a little fabric skirt
    rect(f, COUNTER.x - 1, CTOP - 5, COUNTER.w + 2, 12, DK); rect(f, COUNTER.x, CTOP - 4, COUNTER.w, 10, '#dcae70'); rect(f, COUNTER.x, CTOP - 4, COUNTER.w, 2, '#f2cc90'); rect(f, COUNTER.x, CTOP + 5, COUNTER.w, 1, '#a87a44');
    rect(f, COUNTER.x + 6, CTOP + 7, COUNTER.w - 12, FLOOR - CTOP - 7, DK); SCENE.wood(f, COUNTER.x + 7, CTOP + 7, COUNTER.w - 14, FLOOR - CTOP - 7, '#6e4428', 14, true, 331);
    rect(f, COUNTER.x + 7, CTOP + 7, COUNTER.w - 14, 18, '#2f3f78'); for (let x = COUNTER.x + 50; x < COUNTER.x + COUNTER.w - 20; x += 64) rect(f, x, CTOP + 7, 2, 18, '#1e2a58');
    for (let k = 0; k < 4; k++) { const cx = COUNTER.x + 40 + k * 90; ell(f, cx, CTOP + 16, 5, 5, '#e8dcc0'); ell(f, cx, CTOP + 16, 3, 3, '#2f3f78'); }
    // cabinet glass and frame
    f.fillStyle = 'rgba(200,236,255,0.16)'; f.fillRect(616, 178, 208, 214);
    for (const [x, y] of [[630, 186], [700, 186], [760, 280]]) { f.fillStyle = 'rgba(255,255,255,0.28)'; for (let k = 0; k < 40; k++) f.fillRect(x + k, y + 40 - k, 3, 1); }
    border(f, 616, 178, 208, 214, '#6e4428', 5); rect(f, 718, 178, 4, 214, '#6e4428');
    // cooler glass: a tinted front with reflections, and the steel frame
    f.fillStyle = 'rgba(190,230,255,0.14)'; f.fillRect(886, 214, 368, 172);
    for (const x of [900, 1010, 1130]) { f.fillStyle = 'rgba(255,255,255,0.3)'; for (let k = 0; k < 60; k++) f.fillRect(x + k, 380 - k * 2, 2, 2); }
    rect(f, 880, 210, 380, 4, '#8a929e'); rect(f, 880, 384, 380, 6, '#8a929e'); rect(f, 880, 384, 380, 1, '#e8eef6');
    for (const x of [880, 1068, 1256]) rect(f, x, 210, 4, 180, '#8a929e');
    { const A = ANNEX.cool;   // the annex cooler's glass front, and the curio cabinet's glass and frame
      f.fillStyle = 'rgba(190,230,255,0.14)'; f.fillRect(A.x + 6, 214, A.w - 12, 172);
      for (const x of [A.x + 30, A.x + 170, A.x + 330]) { f.fillStyle = 'rgba(255,255,255,0.3)'; for (let k = 0; k < 60; k++) f.fillRect(x + k, 380 - k * 2, 2, 2); }
      rect(f, A.x, 210, A.w, 4, '#8a929e'); rect(f, A.x, 384, A.w, 6, '#8a929e'); rect(f, A.x, 384, A.w, 1, '#e8eef6');
      for (const x of [A.x, A.x + A.w / 2 - 2, A.x + A.w - 4]) rect(f, x, 210, 4, 180, '#8a929e');
      const C2 = ANNEX.curio;
      f.fillStyle = 'rgba(220,200,255,0.14)'; f.fillRect(C2.x, 152, C2.w, 248);
      for (const [x, y] of [[C2.x + 20, 170], [C2.x + 220, 280]]) { f.fillStyle = 'rgba(255,255,255,0.26)'; for (let k = 0; k < 40; k++) f.fillRect(x + k, y + 40 - k, 3, 1); }
      border(f, C2.x, 152, C2.w, 248, '#6e4428', 5); rect(f, C2.x + C2.w / 2 - 2, 152, 4, 248, '#6e4428'); }
    // tools table front
    rect(f, 1760, 345, 420, FLOOR - 345, DK); SCENE.wood(f, 1761, 346, 418, FLOOR - 346, '#6e4428', 12, true, 341);
    rect(f, 1761, 346, 418, 4, '#4a2e1a');
  }

  function drawAoi(g) {
    const im = H.img; if (!im || !im.complete) return;
    const a = S.aoi, gt = GUESTS.find(x => x.id === 'aoi');
    const bob = a.walk ? Math.round(Math.abs(Math.sin(a.walk * 9)) * 2) : (Math.sin(G.t * 2) > 0.6 ? 1 : 0);
    const hop = a.hop > 0 ? Math.round(Math.sin((0.5 - a.hop) / 0.5 * Math.PI) * 6) : 0;
    const by = FLOOR - 18 - bob - hop, x = Math.round(a.x);
    g.save();
    if (a.face > 0) { g.translate(x, 0); g.scale(-1, 1); g.drawImage(im, -gt.ax, by - gt.bottom); }
    else g.drawImage(im, x - gt.ax, by - gt.bottom);
    g.restore();
  }
  function drawCounterTop(g) {
    // lucky cat, call bell, the till (rings when you pay), and whatever you are buying
    const paw = Math.round(Math.sin(G.t * 3.5) * 2), cx = 246;
    ell(g, cx, CTOP - 12, 10, 10, DK); ell(g, cx, CTOP - 12, 9, 9, '#fbf6ea'); ell(g, cx, CTOP - 25, 8, 7, DK); ell(g, cx, CTOP - 25, 7, 6, '#fbf6ea');
    poly(g, [[cx - 7, CTOP - 28], [cx - 5, CTOP - 35], [cx - 2, CTOP - 30]], DK); poly(g, [[cx + 2, CTOP - 30], [cx + 5, CTOP - 35], [cx + 7, CTOP - 28]], DK);
    rect(g, cx - 4, CTOP - 26, 2, 2, DK); rect(g, cx + 2, CTOP - 26, 2, 2, DK); rect(g, cx - 7, CTOP - 19, 14, 2, '#c8302a'); ell(g, cx, CTOP - 15, 2, 2, '#e0b040');
    rect(g, cx + 7, CTOP - 30 + paw, 5, 11, DK); rect(g, cx + 8, CTOP - 29 + paw, 3, 9, '#fbf6ea');
    ell(g, 282, CTOP - 6, 8, 3, DK); ell(g, 282, CTOP - 9, 7, 6, '#e0b040'); ell(g, 280, CTOP - 11, 2, 2, '#ffe08a'); rect(g, 281, CTOP - 17, 2, 3, DK);
    const ring = G.t - S.ringT, drawer = ring < 1.2 ? Math.round(Math.min(1, ring * 6) * 10 * (ring < 0.9 ? 1 : (1.2 - ring) / 0.3)) : 0;
    const rx = REG.x;
    rect(g, rx - 4, CTOP - 12 + drawer / 3, 48, 12, DK); rect(g, rx - 3, CTOP - 11 + drawer / 3, 46, 10, '#9a6a22');
    rect(g, rx, CTOP - 42, 40, 32, DK); rect(g, rx + 1, CTOP - 41, 38, 30, '#c9962e'); rect(g, rx + 1, CTOP - 41, 38, 3, '#ffe08a');
    rect(g, rx + 6, CTOP - 54, 28, 14, DK); rect(g, rx + 7, CTOP - 53, 26, 12, '#2a3a2a'); text(g, ring < 2 ? 'OK' : '00', rx + 12, CTOP - 50, '#9fe07a');
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) rect(g, rx + 5 + c * 8, CTOP - 34 + r * 9, 6, 6, '#fbf6ea');
    // the basket on the counter
    if (S.basket.length && atCounter()) {
      const bx = 330, n = S.basket.length;
      S.basket.slice(0, 6).forEach((b, i) => { g.save(); g.translate(bx - 34 + (i % 3) * 22, CTOP - 14 - Math.floor(i / 3) * 8); g.scale(0.5, 0.5); drawItem(g, b.id, 0, 0, 1, false); g.restore(); });
      rect(g, bx - 44, CTOP - 14, 88, 14, DK); rect(g, bx - 43, CTOP - 13, 86, 12, '#c8925a'); for (let k = 0; k < 86; k += 6) rect(g, bx - 43 + k, CTOP - 13, 3, 12, '#a8723a');
      rect(g, bx - 40, CTOP - 30, 3, 18, DK); rect(g, bx + 37, CTOP - 30, 3, 18, DK); rect(g, bx - 40, CTOP - 32, 80, 3, DK);
      if (n > 6) textC(g, '+' + (n - 6), bx, CTOP - 46, '#fff6d0', DK);
    }
    const bag = G.t - S.bagT;   // the wrapped paper bag after paying
    if (bag < 2.4) {
      g.globalAlpha = bag < 2 ? 1 : (2.4 - bag) / 0.4;
      const by = CTOP - Math.round(Math.min(1, bag * 4) * 4);
      rect(g, 316, by - 34, 34, 34, DK); rect(g, 317, by - 33, 32, 33, '#c8a070'); rect(g, 317, by - 33, 32, 4, '#a8804a'); rect(g, 327, by - 22, 12, 10, '#c8302a'); ell(g, 333, by - 17, 3, 3, '#fbf6ea');
      g.globalAlpha = 1;
    }
  }
  function lanterns(g, xs, y, c = '#c8302a') { for (const [i, x] of xs.entries()) SCENE.lantern(g, Math.round(x + Math.sin(G.t * 1.3 + i) * 1.2), y, 12, c); }
  function dim(g, x0, w, lamps, f = 0.58, cool = []) {   // warm indoor night light: dark room, lamp pools cut out
    const buf = dim.buf || (dim.buf = PX.mk(VW, VH)), s = buf.getContext('2d'), flick = 0.95 + 0.05 * Math.sin(G.t * 7.3) * Math.sin(G.t * 3.1);
    s.clearRect(0, 0, VW, VH); s.fillStyle = `rgba(18,22,44,${f})`; s.fillRect(0, 0, VW, VH);
    s.globalCompositeOperation = 'destination-out';
    for (const [x, y, rx, ry] of lamps.concat(cool)) SCENE.soft(s, x - x0, y, rx * 1.3 * flick, ry * 1.3 * flick, 0.95);
    s.globalCompositeOperation = 'source-over';
    g.drawImage(buf, x0, 0);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const [x, y, rx, ry] of lamps) SCENE.soft(g, x, y, rx * 0.9 * flick, ry * 0.9 * flick, 0.08, '255,169,87');
    for (const [x, y, rx, ry] of cool) SCENE.soft(g, x, y, rx * 0.8, ry * 0.8, 0.06, '170,220,255');
    g.restore();
  }
  const LANTERNS = [116, 560, 990, 1160, 1380, 1620, 1830, 2110, 2400, 2660, 2920, 3140];
  function drawStore(g) {
    if (!BG) paintStore();
    const cam = Math.round(S.cam);
    g.save(); g.translate(-cam, 0);
    g.drawImage(BG, cam, 0, VW, VH, cam, 0, VW, VH);
    SCENE.rain(g, G, DOOR, 1, 0.25);   // the weather outside the door
    // sliding door panel (opens to the right, over the wall), with a noren above
    const dx = Math.round(S.door * 104);
    rect(g, DOOR.x + dx - 1, DOOR.y, DOOR.w + 2, DOOR.h, DK); rect(g, DOOR.x + dx, DOOR.y + 1, DOOR.w, DOOR.h - 2, '#7a5230');
    g.fillStyle = 'rgba(190,220,255,0.22)'; g.fillRect(DOOR.x + dx + 8, DOOR.y + 8, DOOR.w - 16, DOOR.h - 60);
    for (let k = 1; k < 3; k++) rect(g, DOOR.x + dx + 8 + k * (DOOR.w - 16) / 3, DOOR.y + 8, 2, DOOR.h - 60, '#7a5230');
    for (let k = 1; k < 5; k++) rect(g, DOOR.x + dx + 8, DOOR.y + 8 + k * (DOOR.h - 60) / 5, DOOR.w - 16, 2, '#7a5230');
    rect(g, DOOR.x + dx + 8, DOOR.y + DOOR.h - 46, DOOR.w - 16, 38, '#5a3a22'); rect(g, DOOR.x + dx + DOOR.w - 18, DOOR.y + 130, 4, 16, '#e0b040');
    const flut = S.door > 0.05 ? Math.sin(G.t * 9) * 3 : Math.sin(G.t * 1.5);
    for (let k = 0; k < 3; k++) { const nx = DOOR.x - 4 + k * 43; poly(g, [[nx, DOOR.y - 8], [nx + 40, DOOR.y - 8], [nx + 40 + flut, DOOR.y + 34], [nx + flut, DOOR.y + 34]], DK); poly(g, [[nx + 1, DOOR.y - 7], [nx + 39, DOOR.y - 7], [nx + 39 + flut, DOOR.y + 32], [nx + 1 + flut, DOOR.y + 32]], '#2f6ab0'); }
    ell(g, DOOR.x + 60, DOOR.y + 12, 8, 8, '#fbf6ea'); ell(g, DOOR.x + 63, DOOR.y + 10, 5, 5, '#2f6ab0');
    drawAoi(g);
    const left = s => { const it = item(s.id); return it.kind === 'gear' ? (it.bought ? 0 : 1) : Math.max(0, it.left - inBasket(s.id)); };
    for (const s of SLOTS) {
      const it = item(s.id), n = left(s);
      if (!it.on) g.globalAlpha = 0.45;
      if (it.kind === 'gear') { if (!it.bought) { if (shelfGear(s.id)) drawItem(g, s.id, s.x, s.base, 1); else { g.save(); g.translate(s.x, s.base); g.scale(1.6, 1.6); drawItem(g, s.id, 0, 0, 1); g.restore(); } } }
      else drawItem(g, s.id, s.x, s.base, n);
      g.globalAlpha = 1;
    }
    g.drawImage(FG, cam, 0, VW, VH, cam, 0, VW, VH);
    for (const s of SLOTS) {   // price tags on the shelf edges, over the glass and table fronts
      const it = item(s.id), n = left(s), ty = it.kind === 'gear' ? s.base + 10 : s.base + 4;
      if (!it.on) lockTag(g, s.x, ty);
      else if (it.bought) priceTag(g, s.x, ty, 'SOLD', '#c8302a');
      else if (n <= 0) priceTag(g, s.x, ty, 'SOLD OUT', '#c8302a');
      else if (it.sale) priceTag(g, s.x, ty, it.price + 'G', '#c8302a', '#ffe9a8', s.id === 'special' ? it.full + 'G' : '-');   // the cooler/shelf tag is narrower: SALE + price
      else priceTag(g, s.x, ty, it.price + 'G');
    }
    drawCounterTop(g);
    signBoard(g, 'CHECKOUT', 396, 44, '#7a1e18'); signBoard(g, 'SPECIALS', 720, 132, '#7a1e18'); signBoard(g, 'FRESH', 1070, 150, '#2f4a6a', '#e8f6ff'); signBoard(g, 'PANTRY', 1497, 108); signBoard(g, 'UPGRADES', 1970, 52, '#7a1e18'); signBoard(g, 'MARKET', 2530, 150, '#2f4a6a', '#e8f6ff'); signBoard(g, 'CURIOS', 3028, 110, '#4a2a5a', '#f0e0ff');
    lanterns(g, LANTERNS, 40);
    dim(g, cam, VW, [[100, 300, 120, 150], [400, 290, 220, 160], [720, 290, 150, 160], [1500, 290, 240, 160], [1970, 300, 260, 160], [3028, 290, 220, 170]].concat(LANTERNS.map(x => [x, 70, 46, 40])), 0.1 + 0.36 * (G.nightF || 0), [[1070, 300, 240, 150], [2530, 300, 270, 150]]);
    // coins flying into the till
    for (const p of S.parts) { if (p.k < 0) continue; const e = p.k * p.k, x = p.x + (REG.x + 20 - p.x) * e, y = p.y + (CTOP - 30 - p.y) * e - Math.sin(p.k * Math.PI) * 50; ell(g, Math.round(x), Math.round(y), 4, 4, DK); ell(g, Math.round(x), Math.round(y), 3, 3, '#ffd76a'); }
    for (const p of S.pops) { g.globalAlpha = Math.min(1, p.life * 2.5); textC(g, p.str, p.x, Math.round(p.y), p.c, DK); }
    g.globalAlpha = 1;
    if (S.hover && S.ui !== 'talk') {
      if (S.hover.r) SCENE.brackets(g, S.hover.r);
      if (S.hover.label) SCENE.label(g, S.hover.label, clamp(S.hover.x, cam + 90, cam + VW - 90), S.hover.y, S.hover.muted ? 'muted' : undefined);
    }
    g.restore();
    if (S.focus && !S.ui) { const s = SLOTS.find(o => o.id === S.focus); if (s) TUT.spot(g, { x: s.r.x - cam, y: s.r.y, w: s.r.w, h: s.r.h }); }   // the tutorial's restock highlight
    g.save(); g.translate(-cam, 0); drawBubble(g, cam); g.restore();
    edges(g);
    if (S.ui !== 'receipt' || (S.receipt && S.receipt.out)) drawCart(g);
    drawFlys(g);
    drawReceipt(g);
    if (S.hover && S.hover.kind === 'cart' && S.ui !== 'talk') SCENE.label(g, basketN() ? 'CART: ' + basketN() + ' ITEM' + (basketN() === 1 ? '' : 'S') + ', ' + basketTotal() + 'G' : 'CART IS EMPTY', CART.x + 20, CART.y - 14);
  }
  function wrap(s, maxW) {
    const out = []; let cur = '';
    for (const w of s.split(' ')) { const t = cur ? cur + ' ' + w : w; if (textW(t) > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); return out;
  }
  function drawBubble(g, cam) {
    const b = S.bubble; if (!b || S.ui === 'talk') return;
    const lines = PX.wrap(b.msg, 330), lh = PX.lineH(), w = Math.max(...lines.map(l => textW(l))) + 20, h = (lines.length - 1) * lh + 28;   // (1.5x line spacing, about 40 characters a line)
    const ax = Math.round(S.aoi.x), x = Math.round(clamp(ax - w / 2, cam + 8, cam + VW - w - 8)), y = 192 - h - Math.round(S.aoi.hop * 4);
    const a = Math.min(1, (b.max - b.t) * 6, b.t * 3); g.globalAlpha = a;
    rect(g, x + 3, y + 3, w, h, 'rgba(20,8,12,0.3)');
    rect(g, x - 1, y - 1, w + 2, h + 2, DK); rect(g, x, y, w, h, '#fff5e0'); rect(g, x, y + h - 2, w, 2, '#ead9b5');
    poly(g, [[ax - 7, y + h], [ax + 7, y + h], [ax, y + h + 10]], DK); poly(g, [[ax - 5, y + h], [ax + 5, y + h], [ax, y + h + 7]], '#fff5e0');
    lines.forEach((l, i) => text(g, l, x + 10, y + 8 + i * lh, '#2a1a26'));
    g.globalAlpha = 1;
  }
  function edges(g) {
    if (S.ui === 'talk') return;
    for (const side of [-1, 1]) {
      if (side < 0 ? S.camT <= 0 : S.camT >= SW - VW) continue;
      const hot = S.edge === side, cx = side < 0 ? 20 : VW - 20, cy = VH / 2, bob = hot ? Math.round(Math.sin(G.t * 8) * 1.5) * side : 0;
      g.globalAlpha = hot ? 1 : 0.8;
      ell(g, cx, cy + 2, 13, 13, 'rgba(20,8,12,0.45)'); ell(g, cx, cy, 13, 13, DK); ell(g, cx, cy, 12, 12, hot ? '#ffe08a' : '#e0b040'); ell(g, cx, cy, 10, 10, '#5a3a22'); ell(g, cx, cy - 2, 8, 6, '#7a5230');
      const ax = cx + bob; poly(g, side < 0 ? [[ax + 4, cy - 7], [ax - 5, cy], [ax + 4, cy + 7]] : [[ax - 4, cy - 7], [ax + 5, cy], [ax - 4, cy + 7]], '#f6e6c0');
      g.globalAlpha = 1;
    }
  }

  /* ---------- the night street ---------- */
  let ST = null;
  function paintStreet() {
    ST = PX.mk(VW, VH); const g = ST.getContext('2d');
    // far rooftops with a few lit windows
    for (let i = 0; i < 16; i++) {
      const x = i * 64 - 10, h = 130 + Math.round(rnd(i * 3) * 90), y = 330 - h, w = 70;
      rect(g, x, y, w, h, i % 2 ? '#262a4a' : '#2c3054'); rect(g, x, y, w, 2, '#3a3e66');
      for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) if (rnd(i * 31 + r * 7 + c) > 0.72) rect(g, x + 8 + c * 15, y + 14 + r * 18, 7, 9, rnd(i + r + c) > 0.5 ? '#f6c870' : '#c8a060');
    }
    // the ramen shop (left): eave, timber front, sign, noren doorway with the warm room inside
    poly(g, [[-20, 160], [20, 116], [380, 116], [420, 160]], DK); poly(g, [[-16, 157], [22, 119], [378, 119], [416, 157]], '#3a3a52');
    for (let x = 0; x < 410; x += 12) rect(g, x, 150, 8, 6, '#2a2a3e');
    rect(g, 0, 160, 400, FLOOR - 160, DK); SCENE.wood(g, 0, 161, 398, FLOOR - 161, '#6e4428', 18, true, 401);
    plank(g, 140, 172, 140, 30, '#3a2a22'); textC(g, 'COZY RAMEN', 210, 182, '#ffe08a');
    rect(g, RDOOR.x, RDOOR.y, RDOOR.w, RDOOR.h, '#f0b060');
    for (let k = 0; k < 4; k++) { rect(g, RDOOR.x + 12 + k * 42, RDOOR.y + 60, 30, 100, '#d8904a'); rect(g, RDOOR.x + 12 + k * 42, RDOOR.y + 60, 30, 6, '#b87a3a'); }
    rect(g, RDOOR.x, RDOOR.y + 150, RDOOR.w, 10, '#a86a30');
    border(g, RDOOR.x, RDOOR.y, RDOOR.w, RDOOR.h, '#5a3a22', 6);
    // Kitsune-ya (right): pale plaster, a tiled eave, a big sign, the shop window and the glass door
    poly(g, [[540, 150], [580, 104], [960, 104], [980, 150]], DK); poly(g, [[544, 147], [582, 107], [960, 107], [976, 147]], '#3a4a6a');
    for (let x = 550; x < 960; x += 12) rect(g, x, 140, 8, 6, '#2a3a5a');
    rect(g, 560, 150, 400, FLOOR - 150, DK); SCENE.plaster(g, 561, 151, 399, 70, '#e6d2ac', 411); SCENE.wood(g, 561, 221, 399, FLOOR - 221, '#5a3a22', 20, true, 413);
    plank(g, 614, 160, 300, 42, '#2a1a12'); rect(g, 618, 164, 292, 34, '#3a2418');
    textC(g, 'KITSUNE-YA', 764, 170, '#ffe08a');
    ell(g, 640, 181, 12, 12, '#fbf6ea'); poly(g, [[630, 174], [633, 162], [638, 172]], '#fbf6ea'); poly(g, [[642, 172], [647, 162], [650, 174]], '#fbf6ea'); rect(g, 634, 180, 3, 2, '#c8302a'); rect(g, 643, 180, 3, 2, '#c8302a');
    ell(g, 888, 181, 12, 12, '#2f6ab0'); poly(g, [[878, 174], [881, 162], [886, 172]], '#2f6ab0'); poly(g, [[890, 172], [895, 162], [898, 174]], '#2f6ab0');
    rect(g, 588, 232, 150, 150, '#f6d090');
    for (const y of [270, 320, 370]) { rect(g, 588, y, 150, 4, '#8a5a32'); for (let i = 0; i < 6; i++) { const c = ['#c8302a', '#e0b040', '#4a7a9a', '#6a8a3a', '#93451f', '#fbf6ea'][(i + y) % 6]; rect(g, 596 + i * 23, y - 16, 14, 16, c); rect(g, 596 + i * 23, y - 16, 14, 2, shade(c, 1.3)); } }
    border(g, 588, 232, 150, 150, '#5a3a22', 6); rect(g, 661, 232, 4, 150, '#5a3a22');
    rect(g, SDOOR.x, SDOOR.y, SDOOR.w, SDOOR.h, '#f6d090'); rect(g, SDOOR.x + 20, SDOOR.y + 80, 50, 124, '#d8a860');
    border(g, SDOOR.x, SDOOR.y, SDOOR.w, SDOOR.h, '#5a3a22', 6);
    // sidewalk, kerb and the road
    rect(g, 0, FLOOR, VW, 30, '#8a8a96'); for (let x = 0; x < VW; x += 40) rect(g, x, FLOOR, 1, 30, '#6a6a78'); rect(g, 0, FLOOR, VW, 2, '#b8b8c4');
    rect(g, 0, FLOOR + 30, VW, 4, '#5a5a66'); rect(g, 0, FLOOR + 34, VW, VH - FLOOR - 34, '#2e2e3a');
    for (let x = 20; x < VW; x += 90) rect(g, x, 496, 46, 4, '#d8d0a0');
    // lamp post and a vending machine
    rect(g, 489, 190, 6, FLOOR - 190, DK); rect(g, 490, 190, 4, FLOOR - 190, '#3a3e4a'); rect(g, 478, 180, 28, 12, DK); rect(g, 479, 181, 26, 10, '#4a4e5a');
    rect(g, VEND.x, VEND.y, VEND.w, VEND.h, DK); rect(g, VEND.x + 1, VEND.y + 1, VEND.w - 2, VEND.h - 2, '#d8303a'); rect(g, VEND.x + 5, VEND.y + 8, VEND.w - 10, 56, '#e8f6ff');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) rect(g, VEND.x + 8 + c * 10, VEND.y + 12 + r * 18, 6, 12, ['#4a7a9a', '#e0b040', '#6a8a3a', '#c8302a'][(r + c) % 4]);
    rect(g, VEND.x + 8, VEND.y + 90, VEND.w - 16, 14, '#2a1a1a'); rect(g, VEND.x + 36, VEND.y + 70, 6, 10, '#2a1a1a');
  }
  function drawStreet(g) {
    if (!ST) paintStreet();
    SCENE.sky(g, G, { x: 0, y: 0, w: VW, h: 340 });
    g.drawImage(ST, 0, 0);
    const open = storeOpen();
    // Cozy Ramen's double doors: lattice and warm glass, parting into the wall on both sides
    const rx = Math.round(S.rdoor * 80), ix = RDOOR.x + 6, iw = RDOOR.w - 12, hw = iw / 2, iy = RDOOR.y + 6, ih = RDOOR.h - 6;
    g.save(); g.beginPath(); g.rect(ix, iy, iw, ih); g.clip();
    for (const px of [ix - rx, ix + hw + rx]) {
      rect(g, px, iy, hw, ih, DK); rect(g, px + 1, iy, hw - 2, ih, '#6e4428');
      g.fillStyle = 'rgba(255,214,140,0.62)'; g.fillRect(px + 8, iy + 46, hw - 16, ih - 96);
      for (let k = 1; k < 3; k++) rect(g, px + 8 + Math.round(k * (hw - 16) / 3), iy + 46, 2, ih - 96, '#6e4428');
      for (let y = iy + 68; y < iy + ih - 52; y += 22) rect(g, px + 8, y, hw - 16, 2, '#6e4428');
      rect(g, px + 8, iy + ih - 44, hw - 16, 36, '#4e3220'); rect(g, px + 8, iy + ih - 44, hw - 16, 2, '#8a623c');
    }
    rect(g, ix + hw - 1 - rx, iy + 110, 2, 20, DK); rect(g, ix + hw + 3 + rx, iy + 110, 2, 20, DK);   // finger pulls
    g.restore();
    const rf = S.rdoor > 0.03 && S.rdoor < 0.97 ? Math.sin(G.t * 10) * 3 : Math.sin(G.t * 1.4) * 1;
    for (let k = 0; k < 4; k++) { const nx = RDOOR.x + k * 45; poly(g, [[nx, RDOOR.y], [nx + 44, RDOOR.y], [nx + 44 + rf, RDOOR.y + 52], [nx + rf, RDOOR.y + 52]], DK); poly(g, [[nx + 1, RDOOR.y + 1], [nx + 43, RDOOR.y + 1], [nx + 43 + rf, RDOOR.y + 50], [nx + 1 + rf, RDOOR.y + 50]], '#2f3f78'); rect(g, nx + 1, RDOOR.y + 1, 42, 4, '#1e2a58'); }
    poly(g, [[200, 240], [222, 240], [217, 248], [205, 248]], '#e8dcc0'); rect(g, 207, 248, 9, 2, '#e8dcc0'); line(g, 204, 228, 218, 237, '#e8dcc0', 1);
    // Kitsune-ya's door slides open; shutters come down outside opening hours
    const dx = Math.round(S.sdoor * 120);
    rect(g, SDOOR.x - 1 + dx, SDOOR.y, SDOOR.w + 2 - dx, SDOOR.h, DK);
    if (SDOOR.w - dx > 4) {
      rect(g, SDOOR.x + dx, SDOOR.y + 1, SDOOR.w - dx, SDOOR.h - 2, '#7a5230'); g.fillStyle = 'rgba(255,230,170,0.35)'; g.fillRect(SDOOR.x + dx + 8, SDOOR.y + 8, Math.max(0, SDOOR.w - dx - 16), SDOOR.h - 60);
      for (let k = 1; k < 5; k++) rect(g, SDOOR.x + dx + 8, SDOOR.y + 8 + k * 29, Math.max(0, SDOOR.w - dx - 16), 2, '#7a5230');
    }
    const flut = Math.sin(G.t * 1.6) * 1.5;
    for (let k = 0; k < 3; k++) { const nx = SDOOR.x - 4 + k * 48; poly(g, [[nx, SDOOR.y - 2], [nx + 46, SDOOR.y - 2], [nx + 46 + flut, SDOOR.y + 40], [nx + flut, SDOOR.y + 40]], DK); poly(g, [[nx + 1, SDOOR.y - 1], [nx + 45, SDOOR.y - 1], [nx + 45 + flut, SDOOR.y + 38], [nx + 1 + flut, SDOOR.y + 38]], '#2f6ab0'); }
    ell(g, SDOOR.x + 68, SDOOR.y + 18, 9, 9, '#fbf6ea'); ell(g, SDOOR.x + 72, SDOOR.y + 15, 6, 6, '#2f6ab0');
    if (!open) {
      for (const [x, y, w, h] of [[588, 232, 150, 150], [SDOOR.x, SDOOR.y, SDOOR.w, SDOOR.h]]) { rect(g, x - 2, y - 2, w + 4, h + 4, DK); rect(g, x, y, w, h, '#8a8e9a'); for (let yy = y + 4; yy < y + h; yy += 6) rect(g, x, yy, w, 2, '#6a6e7a'); }
    }
    // the opening-hours plate by the door
    plank(g, 588, 389, 150, 40, '#2a1a12'); textC(g, open ? 'OPEN' : 'CLOSED', 663, 392, open ? '#a6e07a' : '#ff9a86'); textC(g, HOURS, 663, 410, '#f6e6c0');
    // lanterns, the street lamp, the cat on the vending machine
    lanterns(g, [96, 324], 200);
    for (const [i, x] of [744, 916].entries()) SCENE.lantern(g, Math.round(x + Math.sin(G.t * 1.3 + i) * 1.2), 200, 12, open ? '#c8302a' : '#6a4a4a');
    ell(g, 492, 194, 10, 4, '#ffe8a0');
    const cat = G.t - (S.catT || -9), tail = Math.round(Math.sin(G.t * (cat < 1 ? 14 : 2)) * 3), cx = CAT.x + 22, cy = VEND.y;
    ell(g, cx, cy - 8, 16, 8, DK); ell(g, cx, cy - 8, 15, 7, '#3a3036'); ell(g, cx + 12, cy - 12, 7, 6, DK); ell(g, cx + 12, cy - 12, 6, 5, '#3a3036');
    poly(g, [[cx + 8, cy - 15], [cx + 9, cy - 21], [cx + 12, cy - 16]], DK); poly(g, [[cx + 13, cy - 16], [cx + 16, cy - 21], [cx + 17, cy - 14]], DK);
    if (cat < 1.2) { rect(g, cx + 9, cy - 13, 2, 2, '#ffe08a'); rect(g, cx + 14, cy - 13, 2, 2, '#ffe08a'); } else { rect(g, cx + 9, cy - 12, 3, 1, '#1a1018'); rect(g, cx + 14, cy - 12, 3, 1, '#1a1018'); }
    line(g, cx - 14, cy - 6, cx - 20, cy - 2 + tail, DK, 3); line(g, cx - 14, cy - 6, cx - 20, cy - 2 + tail, '#3a3036', 1);
    if (cat < 1.2) textC(g, 'MRRP', cx, cy - 46 - Math.round(cat * 10), '#fff6d0', DK);
    // lights
    const lamps = [[96, 232, 54, 60], [324, 232, 54, 60], [210, 340, 120, 110], [492, 330, 90, 120], [436, 360, 44, 60]];
    if (open) lamps.push([744, 232, 54, 60], [916, 232, 54, 60], [663, 320, 100, 100], [830, 330, 90, 110]);
    if (G.rain > 0.02) {   // puddles on the road, rain over everything, little splashes on the pavement
      g.globalAlpha = G.rain;
      for (const [px, pw] of [[90, 70], [300, 50], [560, 90], [820, 60]]) { ell(g, px, 486, pw, 6, '#3c4058'); ell(g, px - 8, 485, Math.round(pw * 0.5), 2, '#5a6080'); }
      g.globalAlpha = 1;
      SCENE.rain(g, G, { x: 0, y: 0, w: VW, h: VH }, 1.2, 0.18);
      g.fillStyle = 'rgba(210,225,250,0.7)';
      for (let i = 0; i < Math.round(26 * G.rain); i++) { const ph = (G.t * 3 + rnd(i) * 7) % 1; if (ph < 0.25) { const x = Math.round(rnd(i * 5 + 1) * VW), y = FLOOR + 6 + Math.round(rnd(i * 9) * 90); g.fillRect(x - 2, y - 1, 1, 1); g.fillRect(x + 2, y - 1, 1, 1); g.fillRect(x - 1, y, 3, 1); } }
    }
    SCENE.night(g, G, 0, VW, lamps);
    if (S.hover && S.hover.label) SCENE.label(g, S.hover.label, clamp(S.hover.x, 90, VW - 90), S.hover.y, S.hover.muted ? 'muted' : undefined);
  }

  /* ---------- per frame ---------- */
  function draw(g) {
    if (G.where === 'street') drawStreet(g);
    else if (G.where === 'store') drawStore(g);
    if (S.fade > 0) { g.fillStyle = `rgba(10,6,16,${S.fade})`; g.fillRect(0, 0, VW, VH); }
  }
  function hint() {
    if (G.where === 'street') return storeOpen() ? 'The street. Kitsune-ya is open until ' + pad2(SHOP_HOURS.close) + ':00. Your own door is on the left.' : 'Kitsune-ya is closed. It opens at ' + pad2(SHOP_HOURS.open) + ':00, when your shop has closed for the night.';
    if (S.ui === 'talk') return 'Talking with Aoi.';
    if (S.basket.length) return 'Basket: ' + basketN() + ' item' + (basketN() === 1 ? '' : 's') + ', ' + basketTotal() + 'G. Aoi takes payment at the counter.';
    return 'Tap anything on the shelves to look closer. Hold A / D, scroll or drag to look around.';
  }
  function cursor() {
    if (S.drag && S.drag.moved) return 'grabbing';
    return S.hover || S.edge ? 'pointer' : 'default';
  }
  return {
    init: h => { H = Object.assign(H, h); }, enter, leaveTo: backHome, update, draw, down, move, up, wheel, key, keyup, hint, cursor,
    // jump straight in (for ?shot= screenshots and tests)
    visit: (where, cam = 0) => { G.where = where; S.cam = S.camT = clamp(cam, 0, SW - VW); S.fade = 0; S.fadeDir = 0; S.door = 0; S.doorT = 0; if (where === 'store') { S.aoi.x = S.aoi.tx = 420; greet(); } },
    artURL, streetOpen, storeOpen, item, market, addToBasket, pay, inspect, talk, closePanels, hours: HOURS,
    receipt: () => S.receipt, tuckReceipt, giveReceipt, goCheckout, cart: () => ({ ...CART }),
    setDoors: (r, sd) => { S.rdoor = S.rdoorT = r; S.sdoor = S.sdoorT = sd; },
    state: () => ({ cam: S.cam, camT: S.camT, fade: S.fade, ui: S.ui, view: S.view, sel: S.sel, basket: S.basket.map(b => ({ ...b })), aoi: { ...S.aoi }, bubble: S.bubble && S.bubble.msg, door: S.door, sdoor: S.sdoor, hover: S.hover, closing: S.closing, paidT: S.paidT }),
    // for Aoi's handover (tutorial.js): where she stands (store coordinates), and bringing a shelf (or a store x) into view
    aoiRect: () => ({ x: S.aoi.x - 46, y: 216, w: 92, h: CTOP - 216 }),
    look: v => { const s = typeof v === 'string' ? SLOTS.find(o => o.id === v) : null, x = s ? s.x : typeof v === 'number' ? v : null; if (x !== null) S.camT = clamp(x - VW / 2, 0, SW - VW); },
    slots: () => SLOTS.map(s => ({ id: s.id, x: s.x, base: s.base, r: { ...s.r } })), DOOR, SDOOR, RDOOR, COUNTER
  };
})();
