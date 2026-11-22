'use strict';
/* Aoi's tutorial. Aoi used to run this stall; she has opened Kitsune-ya across the street, handed the stall to the
   player, and drops by to show them the ropes.
   - The handover (a new save that answered "Yes, please", or REPLAY TUTORIAL): a practice run before Day 1 that is not
     a real day. Nothing saves until it ends, but everything earned or bought carries on. Aoi hands over the stall,
     then walks the player through two guests (the second orders an extra and a removal), watches them cook a third
     alone, fast-forwards to closing time and the receipt, takes them across to Kitsune-ya to restock, shows them the
     HUD back home, and lets the sun come up on Day 1: the CLOSED sign, waiting to be flipped.
     Aoi's portrait slides in at the bottom of the screen with a speech bubble; each step dims the room, outlines what
     to touch next and points at it with the white glove; in the shop, clicks anywhere else do nothing. The steps read
     the game state, so going the wrong way (back to the serving room, binning the bowl) just points you back: there is
     no way to get stuck.
   - Notes: small pinned memos in Aoi's hand, signed with a fox paw. A station note appears once, when the player has
     done nothing useful there for about 8 seconds; day notes (Days 1-4) appear when their moment comes. Seen notes
     are pinned to the How to Play board (title.js).
   - First-use moments: the first special step, region and upgrade of each kind gets one line from Aoi.
   Characters are single static images: Aoi only slides, fades, hops a few pixels on a new line and leans a degree or
   two as she pops in. Feelings are emote icons beside her.
   Progress is saved as G.tut = { step, done, seen, fresh, armDay, forced } (see newState / oldState); handover and
   day0 (the day it hands over to) only live while it runs. */
const TUT = (() => {
  const { rect, dot, ell, poly, text, textW, setFont, mix } = PX;
  const DK = PX.OUTLINE, INK = '#2b4a80', PAW = '#b4483a', MEMO = '#fff3cf';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = p => 1 - (1 - p) * (1 - p) * (1 - p);
  const inR = (p, r) => !!(p && r && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h);
  let H = { R: {}, sfx: {}, settings: {} };   // hooks from game.js

  /* ---------- every note and line ---------- */
  // Notes: pinned memos (under 12 words). st: the pinboard column.
  const NOTES = {
    'n.sign':    { st: 'serving', t: 'Flip the CLOSED sign to open up.' },
    'n.call':    { st: 'serving', t: "Someone's calling! Tap them to take the order." },
    'd.plus':    { st: 'serving', t: 'Plus means add, minus means leave it out.' },
    'd.cancel':  { st: 'serving', t: "Can't make it? Cancel kindly." },
    'n.cook':    { st: 'serving', t: 'Orders are in. The kitchen is through the noren!' },
    'n.serve':   { st: 'serving', t: 'Drag the bowl onto the guest who ordered it.' },
    'd.rush':    { st: 'serving', t: 'Busy day! Perfect bowls earn the best tips.' },
    'n.tare':    { st: 'kitchen', t: 'Tare goes in first. The slip says which.' },
    'n.broth':   { st: 'kitchen', t: 'Now the broth. Click the matching pot.' },
    'n.noodle':  { st: 'kitchen', t: 'Click the noodle tray to start a basket.' },
    'n.ready':   { st: 'kitchen', t: 'Noodles say READY? Click the basket to tip them in.' },
    'n.tops':    { st: 'kitchen', t: 'Click the toppings in, just like the slip says.' },
    'n.extra':   { st: 'kitchen', t: 'Oops, extra? Right-click the bowl to take it off.' },
    'n.pass':    { st: 'kitchen', t: 'All done? Drag the bowl into the pass.' },
    'd.book':    { st: 'kitchen', t: "New recipe? It's in the book." },
    'n.night':   { st: 'evening', t: "Closed for the night! My shop's out the staff door." },
    'd.shop':    { st: 'evening', t: "Running low? I stock everything you'll need." },
    'd.receipt': { st: 'evening', t: 'Not bad for day one! -A' },
    'd.regular': { st: 'evening', t: "They're a regular now! Check your guest book." }
  };
  const GROUPS = [['SERVING', 'serving'], ['KITCHEN', 'kitchen'], ['EVENINGS', 'evening']].map(([name, st]) => ({ name, ids: Object.keys(NOTES).filter(id => NOTES[id].st === st) }));
  // First-use moments: one line from Aoi, the first time each happens. ({meat}: the meat being torched)
  const FIRST = {
    'f.chili':    'Spicy order! Click the chili oil bottle after the broth.',
    'f.ember':    'Ember oil! Hold the bowl and stop on the right swirl.',
    'f.mayu':     'Black garlic oil. Hold the bowl for just one swirl.',
    'f.sesame':   "Fresh sesame! Hold to grind, let go while it's fine.",
    'f.torch':    'Ooh, a torch! Hold it till the {meat} turns golden.',
    'f.mandrake': 'Mandrake root! Click the bowl to slice it. It squeaks.',
    'f.butter':   'Butter melts fast. Get that bowl out quickly!',
    'f.cold':     'Cold ramen! Rinse READY noodles in the ice bath first.',
    'l.up': 'Level up! Each level brings a new recipe, and sometimes a new tool at my shop.',   // the first level-up (after its popup)
    'r.1': 'Lantern City! Older than my tail, and twice as bright.',
    'r.2': 'Canal Market! Everyone here eats on the move.',
    'r.3': 'The Neon Capital! Big city, bigger appetites.',
    'r.4': 'The Ember Coast! Smell that sea air? Dragon country.',
    'u.quick':   'A waiting bench! Now five guests can queue.',
    'u.bins':    'Bulk crates! My packs hold half as much again.',
    'u.stall5':  'Seat five is ready. Room for one more guest!',
    'u.caddy':   'The garnish caddy adds onion and nori for you.',
    'u.boil':    'Hear that boiler roar? Noodles in four seconds now.',
    'u.stall6':  'Seat six! Your counter is filling up nicely.',
    'u.board9':  'A ninth slot on the menu board. Add a dish!',
    'u.tips':    'A lucky cat! Perfect bowls bring bigger tips.',
    'u.stall7':  'Seat seven. Busy nights ahead, chef.',
    'u.stall8':  'All eight seats! The whole counter is yours.',
    'u.board10': 'The grand menu board! Ten dishes, chef.',
    'u.bell':    'The pass bell! Drop a finished bowl on the pass side, or press Space.',
    'u.runner':  'A noodle runner! Ready noodles hop into a bowl with broth.'
  };
  // The handover, in order.
  const LINE = {
    hello: ["Oh, you must be the new chef! Hello! I'm Aoi.", "I ran this little stall for years. Now it's yours. Here are the keys!",
      "I've opened my own shop, Kitsune-ya, right across the street.", "Before your first real day, let's do a practice run."],
    sign: 'Go on, flip the sign. Your shop now.',
    // guest 1: a plain Miso Ramen
    call: 'A guest! Tap them to take the order.',
    ticket: 'Tickets tell you everything they want.',
    cook1: { kitchen: 'To the kitchen!', slip: 'Their order hangs on this rail too. Cook from it.', tare: 'Drag a spoon of miso into the bowl.', broth: 'Now drag the pork broth over it.',
      nest: 'Noodles next. Drag a nest into a basket.', pull: 'When they say READY, drag the basket to the bowl.', tops: 'Chashu, egg, scallion. Drag each one in.',
      pass: 'Drag the bowl into the pass. It goes on your tray.', serve: 'Drag it from your tray to their spot on the counter.',
      eat: "Hear that slurp? Music to a cook's ears.", coins: 'Your first sale! Tap the coins.' },
    // XP, the moment the first bowl earns some
    xp: ['Every bowl earns XP. Make it exactly as ordered for a perfect bowl: more XP and a tip!'],
    // guest 2: extras and removals
    call2: 'Another one! Tap them, chef.',
    extras: ['This one has changes. Plus means add, minus means leave it out.', "Each extra portion goes on their bill. Leaving something out doesn't change the price."],
    cook2: { kitchen: 'Back to the kitchen!', tare: 'Same start: drag the miso in.', broth: 'Now drag the pork broth.', nest: 'Drag the noodles in.', pull: 'Wait for READY, then drag.',
      tops: 'Chashu and two eggs, no scallion. Drag the egg in twice.', pass: 'Spot on. Added too much? Right-click the bowl.', serve: 'Off you go!',
      eat: 'Extras make for happy guests.', coins: 'A bigger bill, thanks to that extra egg!' },
    // guest 3: asks for a bowl from the very end of the Ramen Road (turning a guest away)
    far: ['A traveller from far away! Listen closely to their order.', "If it's something we can't make yet, just say sorry. That's fine."],
    call3: 'Tap them to hear their order.',
    cancel3: "We can't make Dragon's Fire yet! Tap them and cancel kindly.",
    declined: ["That's right. Dragon's Fire is a long way off for us.", 'Turning someone away kindly is fine. No hard feelings.'],
    // guest 4: on your own (the recipe book first, since that is when it is needed)
    bookhint: ['Forget what goes in a bowl? The recipe book has every recipe.'],
    solo: 'Now try one on your own. I will just watch.',
    praise: "Lovely work! You're a natural.",
    // the night
    ff1: 'Lunch and dinner are the busy times. Watch the clock: skipping ahead to 21:00!',
    close: 'After 21:00 the crowds are gone, but the sign stays OPEN for late-night walk-ins until 04:00.',
    ff2: 'Late walk-ins come now and then. Skipping ahead to 04:00...',
    receipt: "At 04:00 the shop fully closes and the day's receipt prints. Fling it away when you're done.",
    // Kitsune-ya
    door: 'My shop opens at 04:00, just as yours closes. Come on over! Out the staff door.',
    street: "Kitsune-ya, right across the street. In you come!",
    shop: ['Welcome to Kitsune-ya! Everything your kitchen needs is here.', "Ingredients run out as you cook, so stock up here. I'm open 04:00 to 15:00."],
    special: ["Every night one thing is 40% off. Look for the red SALE tag."],
    lock: ['Padlocked goods unlock as you earn XP and level up.'],
    restock: name => "Let's top up your toppings. Tap the " + name + '.',
    addcart: 'Pick how many packs, then add them to your cart.',
    payme: "Now pay at the counter. Tap me when you're ready.",
    paybtn: 'Check your cart, then pay.',
    bag: ['It all goes straight into your kitchen bins. No carrying!'],
    leave: "Let's head back to your shop.",
    home: 'Back across the street.',
    // back home: the HUD, then sunrise
    prep: ['From 04:00 to 09:00 the shop rests. Tapping the sign skips ahead to the morning.'],
    level: ['Your XP fills this bar. Each level unlocks new recipes and tools on the Ramen Road.'],
    road: "Tap your level to see the road map. Close it when you're done.",
    menu: ['New recipes join your menu here. You choose which ramen you sell.'],
    quest: ['Each day also brings a small quest for extra gold and XP.'],
    guests: ['Guests you serve go in the guest book. Regulars tip a little more.'],
    sunrise: 'Look, the sun is coming up.',
    ready: ["That's everything! I'll leave notes around if you need them.", "Flip the sign whenever you're ready. Good luck, chef!"]
  };
  // A wrong move during the guided bowl gets a gentle note instead of the usual buzz.
  const GENTLE = [
    [/^Tare goes in first/, 'Miso first, then the broth.'],
    [/^Tare and broth go in before|^Ladle in the broth/, 'Broth before noodles, chef.'],
    [/^Still cooking/, 'Still cooking. Wait for READY.'],
    [/^Click the noodle tray/, 'Noodles go in the boiler first.'],
    [/^Take their order first/, 'Say hello first. Tap the guest.'],
    [/^A bowl needs|^That bowl is not finished/, 'Not finished yet. Noodles first!'],
    [/^Noodles go in before|^Start in the kitchen/, 'Noodles first, then toppings.']
  ];
  const ALL_IDS = [...Object.keys(NOTES), ...Object.keys(FIRST)];

  /* ---------- state ---------- */
  const tut = () => window.G && G.tut;
  const seen = id => { const t = tut(); return !!(t && t.seen && t.seen.includes(id)); };
  const see = id => { const t = tut(); if (t && t.seen && !t.seen.includes(id)) t.seen.push(id); };
  const calm = () => !!H.settings.reduceMotion;
  // Aoi and her notes hide behind any panel or book, and outside the shop, except during the handover, which goes
  // across to Kitsune-ya and talks over the day's receipt.
  const hidden = () => G.mode !== 'play' || !!G.paused || (!!G.ui && !(T.on && G.ui === 'receipt')) || (!!G.where && !T.on);
  const at = id => (id === 'street' || id === 'store' ? G.where === id : !G.where && STATIONS[G.st].id === id);
  const tg = () => G.tutGu;
  function newState(guided) { return { step: guided ? 'hello' : null, done: !guided, seen: [], fresh: true, armDay: 1, handover: !!guided }; }
  function oldState() { return { step: null, done: true, seen: ALL_IDS.slice() }; }   // saves from before the tutorial: no tutorial, every note pinned
  function load(t) { const o = Object.assign({ step: null, done: true, seen: [] }, t); o.seen = Array.isArray(o.seen) ? o.seen.slice() : []; return o; }
  function saveData() { const t = tut(); return t ? { step: t.step, done: t.done, seen: t.seen, fresh: t.fresh, armDay: t.armDay, forced: t.forced } : null; }
  // REPLAY TUTORIAL: the handover comes back at the start of the next day (straight away if the day has not begun),
  // and hands back to that same day when it ends. The notes are unpinned so they can show again; first-use moments
  // already seen stay seen.
  function replay() {
    const t = tut(); if (!t || T.on) return;
    G.tut = { step: 'hello', done: false, seen: t.seen.filter(id => FIRST[id]), fresh: !!t.fresh, armDay: G.shop === 'morning' && !T.on ? G.day : G.day + 1, handover: true };
    T.on = false; T.ev = []; T.stall = null;
  }
  const armed = () => { const t = tut(); return !!(t && !t.done && !T.on); };
  const armedFor = day => armed() && day >= (tut().armDay || 1);

  const T = { on: false, idx: 0, li: 0, aoi: null, pop: false, tgt: null, drag: null, hit: [], gentle: null, ev: [], stall: null, sig: '', calmT: 0, want: null, ffRate: 0, hiEl: null, restock: null, said: {} };

  /* ---------- Aoi: slides in, types her line, slides out ---------- */
  function aoiIn(side) { T.aoi = { side, inT: G.t, out: false, outT: 0, text: '', chars: 0, lineT: G.t, typedAt: 0, emote: null, emoteT: -9 }; }
  function sayLine(s, emote) {
    if (!T.aoi || T.aoi.out) aoiIn(T.aoi && !T.aoi.out ? T.aoi.side : -1);
    const A = T.aoi; A.text = s; A.chars = 0; A.lineT = G.t; A.typedAt = 0;
    if (emote) { A.emote = emote; A.emoteT = G.t; }
  }
  function aoiOut() { if (T.aoi && !T.aoi.out) { T.aoi.out = true; T.aoi.outT = G.t; } }
  const typed = () => !T.aoi || T.aoi.chars >= T.aoi.text.length;
  function finishTyping() { if (T.aoi) { T.aoi.chars = T.aoi.text.length; T.aoi.typedAt = G.t; } }
  function typeOn(dt) {
    const A = T.aoi; if (!A || A.out || typed()) return;
    const before = Math.floor(A.chars);
    A.chars = Math.min(A.text.length, A.chars + dt * [26, 48, 95][H.settings.textSpeed || 0]);
    const now = Math.floor(A.chars);
    if (now !== before && now % 3 === 0 && A.text[now - 1] !== ' ' && H.sfx.blip) H.sfx.blip(600);
    if (typed()) A.typedAt = G.t;
  }

  /* ---------- the handover ---------- */
  const R = new Proxy({}, { get: (o, k) => H.R[k] });
  const bowlAt = s => G.bowls.findIndex(b => b.s >= s);
  const bowlR = k => (k >= 0 ? R.bowl(k) : null);
  const gone = () => { const gu = tg(); return !gu || G.stalls[gu.stall].guest !== gu; };
  const served = () => gone() || ['react', 'eat', 'pay'].includes(tg().state);
  const passed = () => G.pass.length > 0 || served();
  const flying = kind => G.flying.some(f => f.d.kind === kind);
  const coinsLeft = () => { const gu = tg(), st = gu && G.stalls[gu.stall]; return !!(st && st.left > 0 && st.paid); };
  const is = kind => !!tg() && tg().tut === kind;   // the handover's current guest is this one
  const arrived = kind => () => is(kind) && tg().state !== 'arrive';
  const seatT = () => R.seat(tg().stall), ticketT = () => R.ticket(tg().stall);
  // Kitsune-ya and the street (screen coordinates)
  const NS = () => NIGHTSHOP.state();
  const storeR = r => (r ? { x: r.x - NS().cam, y: r.y, w: r.w, h: r.h, screen: true } : null);
  const streetR = r => ({ x: r.x, y: r.y, w: r.w, h: r.h, screen: true });
  const slotR = id => { const s = id && NIGHTSHOP.slots().find(o => o.id === id); return s ? storeR(s.r) : null; };
  const lockedId = () => { const s = NIGHTSHOP.slots().find(o => { const it = NIGHTSHOP.item(o.id); return it && it.kind === 'ing' && !it.on; }); return s ? s.id : null; };
  const paid = () => (NS().paidT || -9) > (T.storeT || 0);
  // One guest's bowl, from the kitchen to the coins. The step is whatever the bowl needs next, so going back to the
  // serving room, or binning the bowl, just points you back.
  function cook(n, L) {
    const seg = 'cook' + n, want = () => (tg() && tg().order ? tg().order.tops : {});
    const have = (b, id) => b.items.filter(x => x === id).length;
    const needs = () => Object.keys(want()).filter(id => rackTops().includes(id));
    return [
      { id: 'kitchen' + n, seg, line: L.kitchen, target: () => R.edge(1), done: () => at('kitchen') || bowlAt(1) >= 0 || passed() },
      // (the first time: the same order on the kitchen's ticket rail; a talk step inside the segment counts as done once read)
      ...(L.slip ? [{ id: 'slip' + n, seg, talk: true, lines: [L.slip], at: 'kitchen', cam: 1, target: () => R.slip(tg()) }] : []),
      // (every cooking step is a drag: the glove slides from what to pick up to where it goes)
      { id: 'tare' + n, seg, line: L.tare, at: 'kitchen', cam: 1, target: () => R.tare('miso'), drag: () => bowlR(G.bowls.findIndex(b => b.s === 0)), done: () => bowlAt(1) >= 0 || passed() },
      { id: 'broth' + n, seg, line: L.broth, at: 'kitchen', cam: 1, target: () => R.pot('pork'), drag: () => bowlR(G.bowls.findIndex(b => b.s === 1)), done: () => bowlAt(2) >= 0 || passed() },
      { id: 'nest' + n, seg, line: L.nest, at: 'kitchen', cam: 1, target: () => R.noodle(), drag: () => R.basket(Math.max(0, G.baskets.findIndex(b => b.t < 0))),
        done: () => G.baskets.some(b => b.t >= 0) || flying('nest') || flying('basket') || bowlAt(3) >= 0 || passed() },
      { id: 'pull' + n, seg, line: L.pull, at: 'kitchen', cam: 1,
        target: () => { let j = G.baskets.findIndex(b => b.t >= cookTime()); if (j < 0) j = Math.max(0, G.baskets.findIndex(b => b.t >= 0)); return R.basket(j); },
        drag: () => (G.baskets.some(b => b.t >= cookTime()) ? bowlR(G.bowls.findIndex(b => b.s === 2)) : null),   // (no slide until the noodles are READY)
        done: () => bowlAt(3) >= 0 || flying('basket') || passed() },
      { id: 'tops' + n, seg, line: L.tops, at: 'kitchen', cam: 1,
        target: () => { const k = bowlAt(3); if (k < 0) return null; const b = G.bowls[k], w = want(); const id = needs().find(t => have(b, t) < w[t] && !G.flying.some(f => f.d.kind === 'top' && f.d.id === t)); return id ? R.bin(id) : null; },
        drag: () => bowlR(bowlAt(3)),
        done: () => { const k = bowlAt(3), w = want(); return (k >= 0 && needs().every(t => have(G.bowls[k], t) >= w[t])) || passed(); } },
      { id: 'pass' + n, seg, line: L.pass, at: 'kitchen', cam: 0, target: () => { const k = bowlAt(3); return k >= 0 ? R.bowl(k) : null; }, drag: () => R.pass(), done: passed },
      { id: 'carry' + n, seg, keep: true, target: () => R.edge(-1), done: () => at('serving') || served() },
      { id: 'serve' + n, seg, line: L.serve, at: 'serving', target: () => R.tray(0), drag: () => R.drop(tg().stall), done: served },
      { id: 'eat' + n, seg, line: L.eat, done: gone },
      { id: 'coins' + n, seg, line: L.coins, emote: 'sparkle', at: 'serving', target: () => R.coins(tg().stall), done: () => gone() && !coinsLeft() }
    ];
  }
  const STEPS = [
    // the handover: the keys, then open up
    { id: 'hello', talk: true, lines: LINE.hello, emotes: ['sparkle', 'heart', null, 'note'] },
    { id: 'sign', line: LINE.sign, at: 'serving', target: () => R.sign(), done: () => G.shop === 'open' },
    // guest 1: a plain Miso Ramen, step by step
    { id: 'arrive', spawn: 'plain', at: 'serving', done: arrived('plain') },
    { id: 'call', line: LINE.call, at: 'serving', target: seatT, done: () => tg().state !== 'call' },
    { id: 'order', done: () => tg().state !== 'ordering' },
    { id: 'ticket', talk: true, lines: [LINE.ticket], at: 'serving', target: ticketT },
    ...cook(1, LINE.cook1),
    { id: 'xp', talk: true, lines: LINE.xp, dom: '#lvl' },   // right after the first +XP pops up
    // guest 2: an extra egg and no scallion (the ticket's + and - lines, and the bill)
    { id: 'arrive2', spawn: 'extra', at: 'serving', done: arrived('extra') },
    { id: 'call2', line: LINE.call2, at: 'serving', target: seatT, done: () => tg().state !== 'call' },
    { id: 'order2', done: () => tg().state !== 'ordering' },
    { id: 'extras', talk: true, lines: LINE.extras, at: 'serving', target: ticketT, note: 'd.plus' },
    ...cook(2, LINE.cook2),
    // guest 3: orders Dragon's Fire, the road's last bowl. The "Sorry, I cannot make that one" button pulses; if they
    // say yes anyway, Aoi has them tap the guest and cancel (the cancel and its confirm button pulse too).
    { id: 'arrive3', spawn: 'decline', at: 'serving', done: arrived('decline') },
    { id: 'far', talk: true, lines: LINE.far, at: 'serving', target: seatT, note: 'd.cancel', noteKeep: ['call3', 'order3', 'cancel3'], enter: () => { if (tg()) tg().tutKind = 'cancel'; } },
    // (the order dialog opens during this step, and the steps wait behind it: so this step already makes "Sorry" pulse)
    { id: 'call3', line: LINE.call3, at: 'serving', target: seatT, dlg: '#dlg-choices .choice:nth-child(2)', done: () => gone() || tg().state !== 'call' },
    { id: 'order3', dlg: '#dlg-choices .choice:nth-child(2)', done: () => gone() || tg().state !== 'ordering' },
    { id: 'cancel3', line: LINE.cancel3, emote: 'sweat', at: 'serving', target: seatT, dlg: '#dlg-choices .choice:nth-child(2)', done: gone },
    { id: 'declined', talk: true, lines: LINE.declined, emotes: ['heart'] },
    // guest 4: on your own (no lock; Aoi steps aside and her notes help if you stall)
    { id: 'bookhint', talk: true, lines: LINE.bookhint, dom: '#btn-book' },
    { id: 'solo', talk: true, lines: [LINE.solo] },
    { id: 'solo3', spawn: 'solo', free: true, done: () => is('solo') && gone() && !coinsLeft() },
    { id: 'praise', talk: true, lines: [LINE.praise], emotes: ['heart'] },
    // the night, fast-forwarded: closing time, late walk-ins, 04:00 and the receipt
    { id: 'ff1', line: LINE.ff1, dom: '#clock', ff: () => H.PHASE + 0.05, done: () => G.shop === 'night' },
    { id: 'close', talk: true, lines: [LINE.close], at: 'serving', target: () => R.sign() },
    { id: 'ff2', line: LINE.ff2, ff: () => H.PHASE * 19 / 12 + 0.05, done: () => !!G.receipt },
    { id: 'receipt', line: LINE.receipt, done: () => !G.receipt },
    // across the street to Kitsune-ya, to restock
    { id: 'door', line: LINE.door, at: 'serving', target: () => R.door(), done: () => !!G.where },
    { id: 'street', line: LINE.street, toward: 'street', target: () => streetR(NIGHTSHOP.SDOOR), done: () => at('store') },
    { id: 'shop', talk: true, lines: LINE.shop, toward: 'store', look: 0, emotes: ['sparkle'],
      enter: () => { T.storeT = G.t; see('d.shop'); T.restock = ['chashu', 'egg', 'scallion', 'noodle'].reduce((a, b) => ((G.stock[b] || 0) < (G.stock[a] || 0) ? b : a)); } },
    { id: 'special', talk: true, lines: LINE.special, toward: 'store', look: 'special', target: () => slotR('special') },
    { id: 'lock', talk: true, lines: LINE.lock, toward: 'store', look: lockedId, target: () => slotR(lockedId()), skip: () => !lockedId() },
    { id: 'restock', seg: 'store', toward: 'store', line: () => LINE.restock(supplyName(T.restock).toLowerCase()), look: () => T.restock, target: () => slotR(T.restock),
      done: () => (NS().ui === 'card' && NS().sel === T.restock) || NS().basket.length > 0 || paid() },
    { id: 'addcart', seg: 'store', toward: 'store', line: LINE.addcart, html: '#ns-card .ns-add', done: () => NS().basket.length > 0 || paid() },
    { id: 'payme', seg: 'store', toward: 'store', line: LINE.payme, look: 0, target: () => storeR(NIGHTSHOP.aoiRect()), done: () => NS().ui === 'talk' || paid() },
    { id: 'paybtn', seg: 'store', toward: 'store', line: LINE.paybtn, html: '#ns-choices .choice:not(.off)', done: () => paid() && NS().ui !== 'receipt' },
    { id: 'bag', talk: true, lines: LINE.bag, toward: 'store' },
    { id: 'leave', line: LINE.leave, toward: 'store', look: 0, target: () => storeR(NIGHTSHOP.DOOR), done: () => !at('store') },
    { id: 'home', line: LINE.home, target: () => streetR(NIGHTSHOP.RDOOR), done: () => !G.where },
    // back home: the quiet hours, the HUD, then sunrise on the first real day
    { id: 'prep', talk: true, lines: LINE.prep, at: 'serving', target: () => R.sign() },
    // levels, then the road they climb, then the menu the new recipes join, then the daily quest that also earns XP
    { id: 'level', talk: true, lines: LINE.level, dom: '#lvl' },
    // the player opens the Ramen Road map themselves (an HTML overlay Aoi cannot talk over); she carries on once it closes
    { id: 'road', line: LINE.road, dom: '#lvl', enter: () => { T.sawRoad = false; }, done: () => T.sawRoad && G.ui !== 'road' },
    { id: 'menu', talk: true, lines: LINE.menu, dom: '#btn-menu' },
    { id: 'quest', talk: true, lines: LINE.quest, dom: '#quest' },
    { id: 'guests', talk: true, lines: LINE.guests, dom: '#btn-guests' },
    { id: 'sunrise', line: LINE.sunrise, ff: () => H.PHASE * 2 - 0.05, done: () => G.time >= H.PHASE * 2 - 0.06 },
    { id: 'ready', talk: true, lines: LINE.ready, emotes: ['heart', 'sparkle'], at: 'serving', target: () => R.sign(), enter: () => { if (H.startDay) H.startDay(); } }
  ];
  const canBegin = () => armedFor(G.day) && G.shop === 'morning' && !hidden() && !G.receipt;
  function begin() {
    T.on = true; T.idx = 0; T.li = 0; T.ev = []; T.stall = null; T.gentle = null; T.want = null; T.restock = null; T.said = {};
    const t = tut(); t.handover = true; t.day0 = G.day;
    if (H.prep) H.prep();   // back to the serving room, a clean kitchen, and enough of each staple
    aoiIn(-1); enter(0);
  }
  function enter(i) {
    T.idx = i; T.li = 0;
    const s = STEPS[i]; if (!s) return finish(false);
    tut().step = s.id;
    if (s.spawn) { G.tutGu = null; T.want = s.spawn; }   // the next guest of the handover sits down
    if (s.enter) s.enter();
    if (s.look !== undefined && G.where === 'store') NIGHTSHOP.look(typeof s.look === 'function' ? s.look() : s.look);
    if (s.ff) T.ffRate = Math.max(0, s.ff() - G.time) / 3;   // fast-forward over about three seconds
    if (s.note) addEv(s.note, () => !(T.on && STEPS[T.idx] && (STEPS[T.idx] === s || (s.noteKeep || []).includes(STEPS[T.idx].id))));
    const line = typeof s.line === 'function' ? s.line() : s.line;
    if (s.free) aoiOut();
    else if (s.lines) sayLine(s.lines[0], s.emotes && s.emotes[0]);
    else if (line) { if (!T.aoi || T.aoi.out || T.aoi.text !== line) sayLine(line, s.emote); }
    else if (!s.keep && T.aoi) { T.aoi.text = ''; T.aoi.chars = 0; }
  }
  const segRange = i => { const sg = STEPS[i].seg; let a = i, b = i; while (a > 0 && STEPS[a - 1].seg === sg) a--; while (b < STEPS.length && STEPS[b].seg === sg) b++; return [a, b]; };
  const passable = s => (s.skip && s.skip()) || (!s.talk && s.done && s.done());
  const segDone = s => (s.talk ? !!T.said[s.id] : s.done());   // (a talk step inside a segment is done once read)
  // Which step the handover is on now: in order, except inside a segment (a guest's bowl, the shopping), where it is
  // whatever the state needs next.
  function current() {
    const s = STEPS[T.idx];
    if (s && s.seg) { const [a, b] = segRange(T.idx); let j = a; while (j < b && segDone(STEPS[j])) j++; return j; }
    let j = T.idx; while (j < STEPS.length && passable(STEPS[j])) j++;
    return j;
  }
  function advance() {
    if (!T.aoi || T.aoi.out) return false;
    if (!typed()) { finishTyping(); return true; }
    if (T.on) {
      const s = STEPS[T.idx];
      if (!s || !s.talk) return true;
      if (s.lines && T.li < s.lines.length - 1) { T.li++; sayLine(s.lines[T.li], s.emotes && s.emotes[T.li]); return true; }
      T.said[s.id] = true;
      enter(T.idx + 1); return true;
    }
    aoiOut(); return true;
  }
  // The end (or Esc and "Yes, skip it"): the handover becomes the first real morning, the CLOSED sign waiting.
  function finish(skipped) {
    const t = tut(); T.on = false; T.tgt = T.drag = null; T.want = null;
    if (G.tutGu) G.tutGu.tut = false;
    G.tutGu = null;
    if (t && t.handover && H.startDay) H.startDay();
    if (t) { t.done = true; t.step = null; t.handover = false; }
    aoiOut();
    if (H.after) H.after(skipped);
  }
  // where to go first, when the step is somewhere else
  function toward(where) {
    if (!where || at(where)) return undefined;
    if (where === 'kitchen') return G.where ? undefined : R.edge(1);
    if (where === 'serving') return G.where === 'store' ? storeR(NIGHTSHOP.DOOR) : G.where === 'street' ? streetR(NIGHTSHOP.RDOOR) : R.edge(-1);
    if (where === 'store') return G.where === 'street' ? streetR(NIGHTSHOP.SDOOR) : at('serving') ? R.door() : R.edge(-1);
    if (where === 'street') return G.where === 'store' ? storeR(NIGHTSHOP.DOOR) : at('serving') ? R.door() : R.edge(-1);
    return undefined;
  }
  function guide(dt) {
    const j = current();
    if (j !== T.idx) enter(j);
    if (!T.on) return;
    const s = STEPS[T.idx];
    if (s.ff) G.time = Math.min(s.ff(), G.time + dt * T.ffRate);
    let tgt = s.dom && H.domRect ? H.domRect(s.dom) : s.target ? s.target() : null, drag = s.drag ? s.drag() : null;
    // keep the camera on what matters: the far left of the serving room; in the kitchen (two screens wide), what to pick
    // up and where it goes (game.js frames them; while something is carried it slides over to where it goes)
    if (!s.free) { G.scam = STATIONS[0].cam; if (s.cam !== undefined && at('kitchen') && H.kcam) G.kcam = H.kcam(tgt, drag); }
    const away = toward(s.toward || s.at);
    if (away !== undefined) { tgt = away; drag = null; }
    T.tgt = scr(tgt); T.drag = scr(drag);
  }
  const scr = r => (r ? (r.screen ? r : { x: r.x - G.cam, y: r.y, w: r.w, h: r.h }) : null);   // world -> screen
  // A pulsing outline on an HTML control (Kitsune-ya's buttons, the HUD) while a step points at it.
  function hi(sel) {
    const el = sel ? document.querySelector(sel) : null;
    if (el === T.hiEl) return;
    if (T.hiEl) T.hiEl.classList.remove('tut-hi');
    T.hiEl = el; if (el) el.classList.add('tut-hi');
  }

  /* ---------- notes ---------- */
  // A station note: shown once, when nothing useful has happened at this station for about 8 seconds.
  function signature() {
    return [G.st, G.shop, G.stalls.map(s => (s.guest ? s.guest.state[0] : '-')).join(''), G.bowls.map(b => b.s + '.' + b.items.length + (b.spicy ? 's' : '')).join(','),
      G.baskets.map(b => (b.t < 0 ? 0 : b.t < cookTime() ? 1 : 2)).join(''), G.pass.length, G.slips.length, G.ice].join('|');
  }
  function stallIds() {
    if (at('serving')) {
      const out = [];
      if (G.shop === 'morning') out.push('n.sign');
      if (G.shop === 'night' && NIGHTSHOP.storeOpen() && !G.stalls.some(s => s.guest)) out.push('n.night');
      if (G.stalls.some(s => s.guest && s.guest.state === 'call')) out.push('n.call');
      if (G.pass.length && G.stalls.some(s => s.guest && s.guest.state === 'wait')) out.push('n.serve');
      if (G.slips.length && !G.pass.length) out.push('n.cook');
      return out;
    }
    if (at('kitchen')) { const ph = H.kPhase ? H.kPhase() : null; return ph ? ['n.' + ph] : []; }
    return [];
  }
  function stallNotes(dt) {
    const sig = signature();
    if (sig !== T.sig) { T.sig = sig; T.calmT = 0; T.stall = null; return; }   // they acted: the note goes away
    T.calmT += dt;
    if (T.stall || T.calmT < 8) return;
    const id = stallIds().find(n => NOTES[n] && !seen(n));
    if (id) { see(id); T.stall = { id, t: 0 }; }
  }
  function anchorOf(id) {
    const c = G.cam, w = (r, dx, dy) => (r ? { x: r.x - c + dx, y: r.y + dy } : null);
    switch (id) {
      case 'n.sign': return w(R.sign(), R.sign().w + 10, -14);
      case 'n.night': return w(R.door(), R.door().w + 8, 50);
      case 'n.call': { const i = G.stalls.findIndex(s => s.guest && s.guest.state === 'call'); return i >= 0 ? w(R.seat(i), R.seat(i).w - 24, 18) : null; }
      case 'n.serve': return { x: 650, y: 432 };
      case 'n.cook': return { x: VW - 252, y: VH / 2 + 34 };
      case 'n.tare': return w(R.tare(TARE_SLOTS[0]), -10, -46);
      case 'n.broth': return w(R.pot(burners().find(Boolean)), 0, -46);
      case 'n.noodle': return w(R.noodle(), -196, 4);
      case 'n.ready': return w(R.basket(0), -204, 0);
      case 'n.tops': return w(R.binAt(0), 0, -46);
      case 'n.extra': return w(R.bowl(0), -20, -56);
      case 'n.pass': return w(R.pass(), R.pass().w + 8, 40);
      case 'd.book': return w(R.book(), 0, -50);
      case 'd.rush': return { x: 16, y: 50 };
      case 'd.regular': { const p = H.guestBtn ? H.guestBtn() : { x: VW - 80, y: 24 }; return { x: p.x - 196, y: p.y + 22 }; }
      case 'd.plus': { const gu = kindGuest('plus'), r = gu && R.ticket(gu.stall); return r ? w(r, r.w + 8, 2) : null; }
      case 'd.cancel': { const gu = kindGuest('cancel'); return gu ? w(R.seat(gu.stall), R.seat(gu.stall).w - 40, 12) : null; }
    }
    return null;
  }
  const kindGuest = k => { const st = G.stalls.find(s => s.guest && s.guest.tutKind === k); return st ? st.guest : null; };
  // Day notes (and other one-off notes): each shows once, at its moment, and goes when its until() says so.
  function addEv(id, until) { if (seen(id) || T.ev.some(e => e.id === id)) return; see(id); T.ev.push({ id, until, t: 0 }); }
  function dayNotes() {
    const t = tut(); if (!t || t.seen === undefined) return;
    const plus = kindGuest('plus');
    if (plus && plus.state === 'wait' && at('serving')) addEv('d.plus', e => { const gu = kindGuest('plus'); return !gu || gu.state !== 'wait' || (e.t > 3 && !at('serving')); });
    const cancel = kindGuest('cancel');
    if (cancel && ['call', 'ordering', 'wait'].includes(cancel.state) && at('serving')) addEv('d.cancel', () => { const gu = kindGuest('cancel'); return !gu || !['call', 'ordering', 'wait'].includes(gu.state); });
    if (Object.keys(MENU).filter(menuOn).length >= 2 && at('kitchen')) addEv('d.book', e => G.ui === 'book' || e.t > 40);
    if (t.fresh && G.day === 4 && G.shop === 'open') addEv('d.rush', e => e.t > 14 || G.stats.served > 0);
  }
  function event(kind) {
    if (kind === 'rankup') addEv('d.regular', e => G.ui === 'guests' || e.t > 16);
  }
  // A gentle word for a wrong move during the guided bowl (instead of the buzz). Returns true if it took the message.
  function gentle(msg) {
    if (!T.on || G.where || !STEPS[T.idx] || STEPS[T.idx].free) return false;   // (cooking on your own: the usual messages)
    const m = GENTLE.find(([re]) => re.test(msg));
    T.gentle = { t: 3.2, text: m ? m[1] : msg };
    if (T.aoi && !T.aoi.out) { T.aoi.emote = 'sweat'; T.aoi.emoteT = G.t; }
    if (H.sfx.paper) H.sfx.paper();
    return true;
  }

  /* ---------- first-use moments ---------- */
  function firstUse() {
    if (T.aoi) return;
    const q = [];
    if (G.level > 1) q.push(['l.up']);   // (once the level-up popup has closed: Aoi stays hidden behind it)
    if (G.region > 0) q.push(['r.' + G.region]);
    for (const id of G.gear || []) q.push(['u.' + id]);
    if (at('kitchen')) {
      for (const b of G.bowls) {
        const fx = b.fx || {};
        if (fx.ember === 'pending') q.push(['f.ember']);
        if (fx.mayu === 'pending') q.push(['f.mayu']);
        if (fx.sesame === 'pending') q.push(['f.sesame']);
        if (fx.torch === 'pending') { const m = TORCH_MEATS.find(id => b.items.includes(id)); q.push(['f.torch', m ? TOP_NAME[m].toLowerCase() : 'meat']); }
        if (fx.mandrake === 'whole') q.push(['f.mandrake']);
        if (b.butterAt !== undefined) q.push(['f.butter']);
      }
      if (G.slips.some(s => MENU[s.order.type].spicy)) q.push(['f.chili']);
      if (G.slips.some(s => MENU[s.order.type].cold)) q.push(['f.cold']);
    }
    const it = q.find(([id]) => FIRST[id] && !seen(id));
    if (!it) return;
    see(it[0]); T.pop = true; aoiIn(-1);
    sayLine(FIRST[it[0]].replace('{meat}', it[1] || 'meat'), it[0][0] === 'f' ? 'q' : 'sparkle');
  }

  /* ---------- update ---------- */
  function update(dt) {
    if (!window.G || G.mode !== 'play' || !tut()) { hi(null); return; }
    if (T.gentle && (T.gentle.t -= dt) <= 0) T.gentle = null;
    if (T.aoi && T.aoi.out && G.t - T.aoi.outT > 0.32) { T.aoi = null; T.pop = false; }
    if (!T.on && canBegin()) begin();
    T.ev = T.ev.filter(e => !e.until(e));   // (checked even behind a book: opening it is what puts some notes away)
    G.tutPulse = T.ev.some(e => e.id === 'd.plus') ? kindGuest('plus') : null;   // the ticket's + and - lines pulse while the note is up
    if (T.on && G.ui === 'road') T.sawRoad = true;   // (the handover's road-map step: they opened it)
    if (hidden()) {   // (behind a guest's dialog, a step can still make one of its answers pulse)
      const s = T.on && STEPS[T.idx];
      hi(s && s.dlg && G.ui === 'dialog' ? s.dlg : null);
      return;
    }
    typeOn(dt);
    for (const e of T.ev) e.t += dt;
    if (T.on) {
      guide(dt);
      const s = T.on && STEPS[T.idx];
      hi(s ? s.html || s.dom || null : null);
      if (s && s.free) { stallNotes(dt); if (T.stall) T.stall.t += dt; }   // cooking alone: notes if you stall
      return;
    }
    hi(null);
    if (T.pop && T.aoi && !T.aoi.out && typed() && G.t - T.aoi.typedAt > 3.6) aoiOut();
    firstUse();
    stallNotes(dt);
    dayNotes();
    if (T.stall) T.stall.t += dt;
  }

  /* ---------- input ---------- */
  function onAoi(p) { return !!(T.aoi && !T.aoi.out && T.hit.some(r => inR(p, r))); }
  // A click (screen coords): Aoi's bubble finishes her line or moves on; during a talk step any click does. True = handled.
  function click(p) {
    if (hidden()) return false;
    if (T.on) { const s = STEPS[T.idx]; if (s && s.talk) { advance(); return true; } }
    if (onAoi(p)) { advance(); return true; }
    return false;
  }
  // The input lock (the handover, in your own shop): clicks outside the highlighted target do nothing (and make no
  // sound). Not while you cook alone, and not at Kitsune-ya (its panels are buttons of their own).
  function blocks(p) {
    if (!T.on || hidden() || G.where) return false;
    const s = STEPS[T.idx]; if (!s || s.talk || s.free) return false;
    const r = T.tgt;
    return !(r && inR(p, { x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 }));
  }
  function key(k) {
    if (hidden() || !T.aoi || T.aoi.out || !T.aoi.text) return false;
    if (k !== 'Enter' && k !== ' ') return false;
    if (T.on && !STEPS[T.idx].talk && typed()) return false;
    advance(); return true;
  }

  /* ---------- drawing ---------- */
  const wrap = (s, maxW) => PX.wrap(s, maxW);   // (about 40 characters a line at most)
  const NOTE_W = 250;   // a note's widest
  // A memo's size for its text (small font, 1.5x line spacing), so layouts can place it before drawing it.
  function noteSize(s, fixedW) {
    setFont(1);
    const lines = wrap(s, (fixedW || NOTE_W) - 30), w = fixedW || Math.min(NOTE_W, Math.max(...lines.map(l => textW(l))) + 32), lh = PX.lineH();
    setFont(2);
    return { lines, w, h: (lines.length - 1) * lh + 28, lh };
  }
  // A memo in Aoi's hand: pale paper, a red pin, blue ink, a little fox paw in the corner. Returns its size.
  function drawNote(g, x, y, s, o = {}) {
    const { lines, w, h, lh } = noteSize(s, o.w);
    setFont(1);
    x = Math.round(x); y = Math.round(y);
    if (o.alpha !== undefined) g.globalAlpha = o.alpha;
    rect(g, x + 3, y + 3, w, h, 'rgba(30,14,10,0.28)');
    rect(g, x - 1, y - 1, w + 2, h + 2, DK); rect(g, x, y, w, h, MEMO); rect(g, x, y + h - 2, w, 2, '#ead8a8');
    poly(g, [[x + w - 8, y], [x + w, y], [x + w, y + 8]], '#e2cf98'); rect(g, x + w - 8, y, 1, 1, DK);   // a folded corner
    lines.forEach((l, i) => text(g, l, x + 9, y + 8 + i * lh, INK));
    paw(g, x + w - 9, y + h - 6);
    ell(g, x + Math.round(w / 2), y + 1, 4, 4, DK); ell(g, x + Math.round(w / 2), y + 1, 3, 3, '#d8402a'); dot(g, x + Math.round(w / 2) - 1, y, '#ff9a7a');   // the pin
    g.globalAlpha = 1; setFont(2);
    return { w, h };
  }
  function paw(g, x, y) { ell(g, x, y, 3, 2, PAW); dot(g, x - 3, y - 4, PAW); dot(g, x, y - 5, PAW); dot(g, x + 3, y - 4, PAW); dot(g, x - 4, y - 2, PAW); }
  // An empty spot on the pinboard: just the pin, and a faint outline where the note will go.
  function blankPin(g, x, y, w, h) {
    for (let k = 0; k < w; k += 6) { rect(g, x + k, y, 3, 1, 'rgba(60,30,10,0.25)'); rect(g, x + k, y + h - 1, 3, 1, 'rgba(60,30,10,0.25)'); }
    for (let k = 0; k < h; k += 6) { rect(g, x, y + k, 1, 3, 'rgba(60,30,10,0.25)'); rect(g, x + w - 1, y + k, 1, 3, 'rgba(60,30,10,0.25)'); }
    const cx = x + Math.round(w / 2); ell(g, cx, y + 1, 4, 4, DK); ell(g, cx, y + 1, 3, 3, '#a89a88'); dot(g, cx - 1, y, '#d8ccbc');
  }
  // The highlight: everything but the target dimmed by 30%, a pulsing outline, and the glove pointing at it (gently
  // bobbing). With a drag target, the glove slides from the target to where it should be dropped.
  function spot(g, r, drag) {
    if (!r) return;
    const t = G.t, x = Math.round(r.x - 4), y = Math.round(r.y - 4), w = Math.round(r.w + 8), h = Math.round(r.h + 8);
    g.fillStyle = 'rgba(14,8,20,0.3)';
    g.fillRect(0, 0, VW, Math.max(0, y)); g.fillRect(0, y + h, VW, Math.max(0, VH - y - h));
    g.fillRect(0, y, Math.max(0, x), h); g.fillRect(x + w, y, Math.max(0, VW - x - w), h);
    const k = 0.5 + 0.5 * Math.sin(t * 5), c = mix('#ffb84a', '#fff6d0', k);
    rect(g, x - 1, y - 1, w + 2, 1, DK); rect(g, x - 1, y + h, w + 2, 1, DK); rect(g, x - 1, y, 1, h, DK); rect(g, x + w, y, 1, h, DK);
    rect(g, x, y, w, 2, c); rect(g, x, y + h - 2, w, 2, c); rect(g, x, y, 2, h, c); rect(g, x + w - 2, y, 2, h, c);
    SCENE.brackets(g, { x: x - 3, y: y - 3, w: w + 6, h: h + 6 }, c, k > 0.5);
    const bob = calm() ? 0 : Math.round(Math.sin(t * 6) * 3);
    if (drag) {
      SCENE.brackets(g, drag, mix('#ffd76a', '#fff6d0', k));
      const u = (t * 0.6) % 1, m = ease(clamp(u / 0.7, 0, 1));
      const ax = x + w / 2, ay = y + h / 2, bx = drag.x + drag.w / 2, by = drag.y + drag.h / 2;
      SCENE.glove(g, ax + (bx - ax) * m + 10, ay + (by - ay) * m - Math.sin(m * Math.PI) * 24, -1);
      return;
    }
    if (r.dom) {   // a HUD control (HTML, drawn over the canvas): the glove points up at it from just below
      // (or, for one near the bottom edge like the quest card, down at it from just above)
      const below = y + h + 40 < VH;
      g.save(); g.translate(Math.round(x + w / 2), below ? y + h + 16 + bob : y - 16 - bob); g.rotate(below ? Math.PI / 2 : -Math.PI / 2); SCENE.glove(g, 0, 0, -1); g.restore();
      return;
    }
    const gy = clamp(y + h / 2, 12, VH - 12);
    if (x + w + 40 < VW) SCENE.glove(g, x + w + 14 + bob, gy, -1); else SCENE.glove(g, x - 14 - bob, gy, 1);
  }
  // Aoi's panel: her portrait (one static image) in a brass frame, a speech bubble beside it, an emote now and then.
  const PW = 96, PH = 96, ZONE_L = { x: 0, y: 372, w: 470, h: 140 }, ZONE_R = { x: VW - 470, y: 372, w: 470, h: 140 };
  const hits = (a, b) => !!(a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
  function drawAoi(g) {
    const A = T.aoi; T.hit = []; T.aoiTop = null; if (!A) return;
    const want = T.on && hits(T.tgt, ZONE_L) && !hits(T.tgt, ZONE_R) ? 1 : -1;   // stay clear of what she points at
    if (want !== A.side && !A.out) { A.side = want; A.inT = G.t; }
    const img = H.img, gt = GUESTS.find(x => x.id === 'aoi');
    const pin = ease(clamp((G.t - A.inT) / 0.3, 0, 1)), pout = A.out ? ease(clamp((G.t - A.outT) / 0.3, 0, 1)) : 0, p = pin * (1 - pout);
    if (p <= 0) return;
    // (at Kitsune-ya's counter its talk panel fills the bottom of the screen: Aoi's tutorial panel moves to the top)
    const top = T.on && G.where === 'store' && NIGHTSHOP.state().ui === 'talk';
    const side = A.side, hx = side < 0 ? 12 : VW - 12 - PW, y = top ? 52 : VH - 44 - PH;
    const x = Math.round(hx + (side < 0 ? -PW - 24 : PW + 24) * (1 - p));
    // on the right she shares the corner with the daily quest card: record how high her panel and bubble reach (in
    // canvas px, without the little hop) so game.js can lift the card above her
    if (side > 0 && !top) {
      const bh0 = A.text ? (wrap(A.text, 380).length - 1) * PX.lineH() + 32 : 0;
      T.aoiTop = Math.min(y - 14, y + PH - bh0 - 6);   // (-14: room for an emote over her frame)
    }
    const lt = G.t - A.lineT, hop = calm() || lt > 0.24 ? 0 : Math.round(Math.sin(lt / 0.24 * Math.PI) * 3);
    const it = G.t - A.inT, tilt = calm() || it > 0.4 ? 0 : (1 - it / 0.4) * 1.5 * (side < 0 ? 1 : -1) * Math.PI / 180;
    g.save(); g.globalAlpha = p;
    g.translate(x + PW / 2, y + PH - hop); g.rotate(tilt); g.translate(-(x + PW / 2), -(y + PH));
    rect(g, x + 3, y + 4, PW, PH, 'rgba(20,8,12,0.35)');
    rect(g, x - 1, y - 1, PW + 2, PH + 2, DK); rect(g, x, y, PW, PH, '#c9962e'); rect(g, x, y, PW, 1, '#ffe08a');
    rect(g, x + 3, y + 3, PW - 6, PH - 6, DK); rect(g, x + 4, y + 4, PW - 8, PH - 8, '#e9d8b4');
    if (img && img.complete && gt) { g.save(); g.beginPath(); g.rect(x + 4, y + 4, PW - 8, PH - 8); g.clip(); g.drawImage(img, gt.ax - 44, Math.max(0, gt.head - 10), 88, 88, x + 4, y + 4, 88, 88); g.restore(); }
    setFont(1); const nw = textW('AOI') + 12; rect(g, x + 6, y + PH - 13, nw + 2, 14, DK); rect(g, x + 7, y + PH - 12, nw, 12, '#8a2a1a'); text(g, 'AOI', x + 13, y + PH - 10, '#fbf2dc'); setFont(2);
    g.restore();
    T.hit.push({ x, y, w: PW, h: PH });
    if (A.emote && G.t - A.emoteT < 1.6 && p > 0.9) SCENE.emote(g, A.emote, side < 0 ? x + PW + 2 : x - 2, y - 6, G.t);
    if (!A.text || p < 0.9) return;
    // the bubble: sized for the whole line, so it does not grow while the words type out
    const lines = wrap(A.text, 380), lh = PX.lineH(), bw = Math.max(...lines.map(l => textW(l))) + 26, bh = (lines.length - 1) * lh + 32;
    const bx = side < 0 ? x + PW + 14 : x - 14 - bw, by = y + PH - bh - 6 - hop;
    rect(g, bx + 3, by + 3, bw, bh, 'rgba(20,8,12,0.3)');
    rect(g, bx - 1, by - 1, bw + 2, bh + 2, DK); rect(g, bx, by, bw, bh, '#fff5e0'); rect(g, bx, by + bh - 2, bw, 2, '#ead9b5');
    const tx = side < 0 ? bx : bx + bw, ty = by + bh - 16, d = side < 0 ? -1 : 1;
    poly(g, [[tx, ty - 7], [tx, ty + 7], [tx + d * 10, ty + 4]], DK); poly(g, [[tx - d, ty - 5], [tx - d, ty + 5], [tx + d * 7, ty + 3]], '#fff5e0');
    let left = Math.floor(A.chars);
    lines.forEach((l, i) => { if (left <= 0) return; text(g, l.slice(0, left), bx + 13, by + 9 + i * lh, '#2a1a26'); left -= l.length + 1; });
    if (typed() && (T.pop || (T.on && STEPS[T.idx] && STEPS[T.idx].talk)) && Math.floor(G.t * 2.5) % 2 === 0) poly(g, [[bx + bw - 16, by + bh - 10], [bx + bw - 8, by + bh - 10], [bx + bw - 12, by + bh - 5]], '#8a2a1a');
    T.hit.push({ x: bx, y: by, w: bw, h: bh });
  }
  function place(a, s) { const { w, h } = noteSize(s); return { x: clamp(a.x, 6, VW - w - 6), y: clamp(a.y, 46, VH - h - 44) }; }
  function draw(g) {
    if (!window.G || G.mode !== 'play' || !tut() || hidden()) { T.hit = []; T.aoiTop = null; return; }
    if (T.on) spot(g, T.tgt, T.drag);
    const notes = T.ev.map(e => [e.id, e.t]).concat(T.stall ? [[T.stall.id, T.stall.t]] : []);
    for (const [id, t] of notes) {
      const a = anchorOf(id); if (!a) continue;
      const p = place(a, NOTES[id].t);
      drawNote(g, p.x, p.y - Math.round((1 - ease(clamp(t / 0.25, 0, 1))) * 6), NOTES[id].t, { alpha: clamp(t / 0.25, 0, 1) });
    }
    if (T.gentle) {
      const r = T.tgt, a = r ? { x: r.x + r.w + 30, y: r.y - 34 } : { x: VW / 2 - 90, y: 120 };
      const p = place(a, T.gentle.text);
      drawNote(g, p.x, p.y, T.gentle.text, { alpha: clamp(T.gentle.t * 3, 0, 1) });
    }
    drawAoi(g);
  }
  // The day-one memo pinned to the corner of the receipt.
  function receiptNote(g, x, y) { drawNote(g, x, y, NOTES['d.receipt'].t, { w: 128 }); }

  function init(h) { H = Object.assign(H, h); }
  // a new game or a continued one: nothing carried over from the last session on screen
  function reset() { hi(null); Object.assign(T, { on: false, idx: 0, li: 0, aoi: null, pop: false, tgt: null, drag: null, hit: [], gentle: null, ev: [], stall: null, sig: '', calmT: 0, want: null, restock: null }); }
  return {
    init, reset, update, draw, click, blocks, key, gentle, event, replay, newState, oldState, load, saveData, armedFor, receiptNote,
    drawNote, noteSize, blankPin, spot, NOTES, GROUPS, ALL_IDS, seen,
    guiding: () => T.on, skip: () => { if (T.on) finish(true); }, armed,
    freeze: () => T.on,                                                                  // the handover is not a real day: its clock only moves when Aoi skips ahead
    holdCoins: i => T.on && !!tg() && tg().stall === i && !!STEPS[T.idx] && /^(eat|coins)\d/.test(STEPS[T.idx].id),   // a guided guest's coins wait to be collected
    wantGuest: () => (T.on && T.want && !G.tutGu ? T.want : null),                     // the handover's next guest: 'plain' | 'extra' | 'decline' | 'solo'
    handover: () => !!(tut() && tut().handover),
    // the daily quest card stays hidden until Aoi has introduced it (or the handover is over or skipped)
    questShown: () => (T.on ? T.idx >= STEPS.findIndex(s => s.id === 'quest') : !tut() || !!tut().done),
    talking: () => !!(T.aoi && !T.aoi.out),
    aoiTop: () => T.aoiTop ?? null,                                                      // top of Aoi's panel + bubble when she is in the bottom-right corner (canvas px), else null
    debug: () => ({ on: T.on, step: T.on && STEPS[T.idx] ? STEPS[T.idx].id : null, tgt: T.tgt, drag: T.drag, text: T.aoi && T.aoi.text, notes: T.ev.map(e => e.id).concat(T.stall ? [T.stall.id] : []) })   // (read-only, for test pages)
  };
})();
