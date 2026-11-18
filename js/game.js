'use strict';
/* Game state, rules, input and the main loop. */
(() => {
  const PHASE = 150;            // seconds for 12 in-game hours: open 09:00-21:00, then night until 09:00
  const RW = 212;               // end-of-day receipt width
  const $ = id => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const inR = (p, r) => p && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
  const params = new URLSearchParams(location.search);

  const IMG = {};
  for (const gt of GUESTS) { const im = new Image(); im.src = 'assets/guests/' + gt.id + '.png'; IMG[gt.id] = im; }

  /* ---------- guest gallery (index.html?gallery) ---------- */
  if (params.has('gallery')) {
    document.body.className = 'gallery';
    document.body.innerHTML = '<div class="grid">' + GUESTS.map(gt => {
      const p = PERSONA[gt.id] || {};
      return `<figure><img src="assets/guests/${gt.id}.png"><figcaption><b>${gt.name}</b> ${gt.title}<br><i>${p.trait || ''}</i><br>${gt.taste.pref || 'any'} ${Object.entries(gt.taste.tops || {}).map(([k, v]) => k + ' x' + v).join(', ')}${gt.taste.night ? ' (night only)' : ''}</figcaption></figure>`;
    }).join('') + '</div>';
    return;
  }

  const newBowl = () => ({ s: 0, tare: false, broth: false, fill: 0, noodles: null, nHide: false, items: [], itemT: [], hide: {}, age: 0 });
  const zeroes = () => Object.fromEntries(Object.keys(MENU).map(k => [k, 0]));
  const newStats = () => ({ served: 0, perfect: 0, earned: 0, sales: 0, tips: 0, declined: 0, sold: zeroes(), rev: zeroes() });
  const fresh = () => ({
    mode: 'title', met: [], level: 1, xp: 0, owned: [], gear: [], where: null, aoiMet: false, region: 0, life: { served: 0, perfect: 0, sold: {}, bestDay: 0, days: 0 },
    t: 0, time: 0, day: 1, gold: 0, paused: false, ui: null, nightF: 0, duskF: 0, rain: 0, wx: null, quest: null,
    shop: 'morning', signT: -9, signWas: 'morning', receipt: null,   // shop: morning (closed, waiting for the sign) | open | night
    st: 0, cam: 0, kcam: 960, scam: 0, pan: 0, edge: 0, edgeSide: 0,
    stalls: Array.from({ length: SL.NSTALL }, () => ({ guest: null, blind: 1, target: 1, bowl: null })),
    waiting: 0, spawnT: 3, seatCD: 0, nextNum: 1,
    slips: [], pass: [], bowls: [newBowl(), newBowl()],
    baskets: [0, 1, 2].map(() => ({ t: -1 })),
    stock: { noodle: 16, ...Object.fromEntries([...Object.keys(TARES).map(tareKey), ...Object.keys(BROTHS).map(brothKey)].map(id => [id, 16])),
             chashu: 14, egg: 14, nori: 14, scallion: 14, menma: 14, chili: 8, corn: 8, butter: 8 },   // enough for the first day; then Kitsune-ya
    jobs: [], parts: [], pops: [],
    drag: null, dragBowl: null, mouse: null, hover: null,
    flash: '', flashT: 0, steamT: 0, stats: newStats()
  });
  const G = fresh();
  window.G = G;

  /* ---------- settings (saved right away) and the day save (at opening and closing) ---------- */
  const SETTINGS_KEY = 'cozyRamen.settings', SAVE_KEY = 'cozyRamen.save.v1';
  const SETTINGS = Object.assign({ music: 6, sfx: 8, textSpeed: 1, snap: true, blindClick: false, hints: false }, (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; } })());
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (e) { /* storage may be blocked */ } }
  // Continue always resumes at the start of a morning: `day` is the morning to resume on.
  function saveGame(day) { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ day, gold: G.gold, stock: G.stock, met: G.met, nextNum: G.nextNum, level: G.level, xp: G.xp, owned: G.owned, quest: G.quest, gear: G.gear, aoiMet: G.aoiMet, region: G.region, life: G.life })); } catch (e) { /* storage may be blocked */ } }
  function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.day ? s : null; } catch (e) { return null; } }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage may be blocked */ } }

  const hour = () => (9 + G.time / PHASE * 12) % 24;
  const isNight = () => { const h = hour(); return h >= 18 || h < 6; };   // evening/night dialogue, night-only guests
  const world = p => p && { x: p.x + G.cam, y: p.y };
  // A guest's own line for a moment (their day/night version first, if they have one), or the generic fallback.
  const NIGHT_FALLBACK = {
    call: ['Excuse me... still open?', 'Hello? Something warm, please.'], wait: ['No rush. The night is long.', 'I will just rest my eyes a moment.'],
    idle: ['*yawns*', 'So quiet at this hour.'], react: ['Ahh, warm. Just what the night needed.'],
    decline: ['Too late for that one? I understand. Good night!', 'No trouble. I should be in bed anyway. Good night!', 'Ah, all right. I will catch you another night.']
  };
  const DECLINE = ['Oh, that is all right. Maybe next time!', 'No worries at all. I will come back another day.', 'I understand. Thanks for being honest!'];
  const line = (gu, key, fallback) => {
    const p = PERSONA[gu.gt.id] || {}, phase = p[isNight() ? 'night' : 'day'];
    const own = (phase && phase[key] && phase[key].length && phase[key]) || (p[key] && p[key].length && p[key]);
    if (own) return pick(own);
    if (isNight() && NIGHT_FALLBACK[key]) fallback = NIGHT_FALLBACK[key];
    return Array.isArray(fallback) ? pick(fallback) : fallback;
  };

  /* ---------- sound ---------- */
  let actx = null, muted = false;
  /* title music: a gentle generated chiptune loop (triangle lead, square bass) */
  const midi = n => 440 * Math.pow(2, (n - 69) / 12), EIGHTH = 60 / 96 / 2;
  const MEL = [76, 79, 81, 79, 76, 74, 72, 74, 76, 79, 81, 84, 81, 79, 76, 0, 74, 76, 79, 76, 74, 72, 69, 72, 74, 76, 74, 72, 72, 0, 0, 0,
               72, 74, 76, 79, 81, 79, 76, 79, 84, 83, 81, 79, 76, 0, 79, 0, 81, 79, 76, 74, 72, 74, 76, 79, 74, 72, 69, 72, 72, 0, 0, 0];
  const BASS = [48, 43, 45, 40, 41, 48, 43, 48, 45, 41, 48, 43, 41, 43, 48, 48];
  let musicTimer = null, musicNext = 0, musicStep = 0, mgain = null;
  function note(f, t0, dur, type, vol) {
    const o = actx.createOscillator(), v = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    v.gain.setValueAtTime(0.0001, t0); v.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); v.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(v); v.connect(mgain); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function scheduleMusic() {
    if (!actx || !mgain) return;
    mgain.gain.value = muted ? 0 : SETTINGS.music / 10 * 0.6;
    while (musicNext < actx.currentTime + 0.3) {
      const i = musicStep % MEL.length, n = MEL[i];
      if (n) note(midi(n), musicNext, 0.3, 'triangle', 0.1);
      if (i % 4 === 0) { note(midi(BASS[(i / 4) % BASS.length]), musicNext, EIGHTH * 3.6, 'square', 0.025); note(midi(BASS[(i / 4) % BASS.length] + 7), musicNext + EIGHTH * 2, EIGHTH * 1.6, 'square', 0.015); }
      musicNext += EIGHTH; musicStep++;
    }
  }
  function music(on) {
    if (on && !musicTimer) {
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        if (actx.state === 'suspended') actx.resume();
        if (!mgain) { mgain = actx.createGain(); mgain.connect(actx.destination); }
        musicNext = actx.currentTime + 0.1; musicStep = 0; musicTimer = setInterval(scheduleMusic, 80);
      } catch (e) { /* audio is optional */ }
    } else if (!on && musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }
  function tone(f, dur, type = 'square', vol = 0.04, to = 0, delay = 0) {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), v = actx.createGain(), t0 = actx.currentTime + delay;
      o.type = type; o.frequency.setValueAtTime(f, t0);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      v.gain.setValueAtTime(Math.max(0.0001, vol * SETTINGS.sfx / 8), t0); v.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(v); v.connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* audio is optional */ }
  }
  function noise(dur, f, vol, delay = 0) {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const n = Math.floor(actx.sampleRate * dur), buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2 * (Math.random() < 0.3 ? 1 : 0.35);
      const src = actx.createBufferSource(), bp = actx.createBiquadFilter(), v = actx.createGain();
      src.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 0.9; v.gain.value = vol * SETTINGS.sfx / 8;
      src.connect(bp); bp.connect(v); v.connect(actx.destination); src.start(actx.currentTime + delay);
    } catch (e) { /* audio is optional */ }
  }
  const SFX = {
    paper: () => { noise(0.09, 3200, 0.5); noise(0.07, 1900, 0.35, 0.06); },
    print: () => { for (let i = 0; i < 10; i++) noise(0.035, 4200, 0.25, i * 0.13); },
    clack: () => { tone(200, 0.06, 'square', 0.05); tone(150, 0.08, 'square', 0.04, 0, 0.09); },
    tap: () => tone(520, 0.05), pick: () => tone(440, 0.05, 'triangle', 0.06, 620), add: () => tone(700, 0.06, 'triangle', 0.07),
    pour: () => tone(330, 0.3, 'sine', 0.08, 160), drop: () => tone(240, 0.12, 'sine', 0.08, 140),
    chop: () => tone(180, 0.04, 'square', 0.05), bad: () => tone(170, 0.16, 'sawtooth', 0.03, 120),
    ding: () => { tone(880, 0.12, 'triangle', 0.07); tone(1320, 0.2, 'triangle', 0.07, 0, 0.1); },
    coin: () => { tone(988, 0.07, 'square', 0.04); tone(1319, 0.16, 'square', 0.04, 0, 0.07); },
    bell: () => { tone(1046, 0.25, 'sine', 0.05); tone(1568, 0.35, 'sine', 0.04, 0, 0.08); },
    blind: () => { for (let i = 0; i < 5; i++) tone(260 + i * 30, 0.04, 'triangle', 0.03, 0, i * 0.05); },
    whoosh: () => tone(300, 0.18, 'triangle', 0.04, 700),
    // the books: a soft lift, a papery thud on landing, the cover's creak and thump, and page swishes
    bookLift: () => { noise(0.12, 900, 0.22); tone(170, 0.14, 'sine', 0.03, 260); },
    bookLand: () => { noise(0.07, 320, 0.7); tone(110, 0.1, 'sine', 0.08, 70); },
    bookDown: () => { noise(0.06, 280, 0.6); tone(100, 0.08, 'sine', 0.07, 65); },
    bookOpen: () => { noise(0.2, 1300, 0.28); noise(0.08, 380, 0.5, 0.2); tone(95, 0.09, 'sine', 0.07, 70, 0.2); },
    bookClose: () => { noise(0.07, 480, 0.65); tone(120, 0.09, 'sine', 0.08, 80); },
    flip: () => { const f = 2100 + Math.random() * 900; noise(0.13, f, 0.32); noise(0.06, f * 0.55, 0.18, 0.09); },
    pageSettle: () => noise(0.04, 1500, 0.12),
    // the night shop: a sliding door, the door chime, the till, a cat
    slide: () => { noise(0.28, 700, 0.3); noise(0.06, 300, 0.4, 0.26); },
    chime: () => { tone(1568, 0.5, 'sine', 0.04); tone(2093, 0.6, 'sine', 0.03, 0, 0.12); tone(1760, 0.7, 'sine', 0.025, 0, 0.26); },
    ring: () => { tone(1320, 0.08, 'square', 0.03, 0, 0.05); tone(2640, 0.3, 'triangle', 0.05, 0, 0.12); noise(0.1, 600, 0.4, 0.02); },
    meow: () => tone(700, 0.3, 'triangle', 0.05, 520),
    blip: pitch => tone((pitch || 620) * (0.94 + Math.random() * 0.12), 0.03, 'square', 0.015)
  };

  /* ---------- feedback helpers ---------- */
  function say(msg) { G.flash = msg; G.flashT = 2.8; SFX.bad(); }
  const pop = (str, x, y, c = '#ffd76a') => G.pops.push({ str, x, y, c, life: 1.2 });
  const spark = (x, y, n, c) => { for (let i = 0; i < n; i++) G.parts.push({ type: 'spark', c, x: x + rand(-20, 20), y: y + rand(-14, 14), vx: rand(-24, 24), vy: rand(-52, -16), life: rand(0.4, 0.9), max: 0.9 }); };
  const splash = (x, y, c, n = 10) => { for (let i = 0; i < n; i++) G.parts.push({ type: 'drop', c, x: x + rand(-24, 24), y: y + rand(-4, 4), vx: rand(-50, 50), vy: rand(-90, -30), life: 0.5, max: 0.5 }); };
  const hearts = (x, y, n) => { for (let i = 0; i < n; i++) G.parts.push({ type: 'heart', x: x + rand(-32, 32), y: y + rand(-12, 12), vx: 0, vy: rand(-36, -16), life: rand(0.8, 1.3), max: 1.3 }); };
  const bubbleT = {};
  function bubble(i, msg) { const el = $('bubble-' + i); el.textContent = msg; el.classList.add('show'); bubbleT[i] = 3.4; }
  let toastT = 0;
  function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); toastT = 3.5; }

  /* ---------- stations ---------- */
  function go(i) {
    i = clamp(i, 0, STATIONS.length - 1);
    if (i === G.st) return;
    G.st = i; SFX.whoosh();
    STATIONS.forEach((s, k) => $('tab-' + s.id).classList.toggle('on', k === i));
  }
  // Where the camera is heading: a station's fixed spot, or the kitchen page's pan position.
  const wide = s => s.camMax !== undefined;   // a station you pan along
  const panKey = () => (STATIONS[G.st].id === 'serving' ? 'scam' : 'kcam');
  const camTarget = () => { const s = STATIONS[G.st]; return wide(s) ? clamp(G[panKey()], s.cam, s.camMax) : s.cam; };
  const panBy = dx => { const s = STATIONS[G.st]; if (wide(s)) G[panKey()] = clamp(G[panKey()] + dx, s.cam, s.camMax); };
  const atPanEnd = side => { const s = STATIONS[G.st], v = clamp(G[panKey()], s.cam, s.camMax); return side < 0 ? v <= s.cam + 1 : v >= s.camMax - 1; };
  const settled = () => Math.abs(G.cam - camTarget()) < 2;

  /* ---------- hit areas (world coordinates) ---------- */
  const K = x => x + KL.X0;   // kitchen-local x -> world x
  const bowlRect = k => ({ x: K(KL.bowlX[k]) - 58, y: KL.BOWL_Y - 26, w: 116, h: 84 });
  const basketRect = j => ({ x: K(KL.basketX[j]) - 24, y: KL.BOIL.cy - 48, w: 48, h: 64 });
  const binRect = k => { const b = KL.bin(k); return { x: K(b.x) - 3, y: b.y - 3, w: b.w + 6, h: b.h + 6 }; };
  const tareRect = i => { const t = KL.tare(i); return { x: K(t.cx) - 22, y: t.y - 30, w: 44, h: 86 }; };
  const potRect = i => { const p = KL.pot(i); return { x: K(p.cx) - p.rx - 4, y: p.cy - 50, w: 2 * p.rx + 8, h: 112 }; };
  const noodleRect = { x: K(KL.NOODLE.x), y: KL.NOODLE.y, w: KL.NOODLE.w, h: KL.NOODLE.h };
  const lockedSay = node => { const n = nodeFor(node); say('Unlocks on the Japan road at ' + (n ? n.place + ', level ' + n.level : 'a later stop') + '.'); };
  const passRect = { x: K(KL.PASS.x), y: KL.PASS.y, w: KL.PASS.w, h: KL.PASS.h };
  const passSlot = i => { const [x, y] = KL.passPos(i); return { x: K(x) - 32, y: y - 14, w: 64, h: 40 }; };
  const pickSlot = i => ({ x: SL.X0 + SL.pickX(i) - 32, y: SL.SHELF_Y - 22, w: 64, h: 44 });
  const shelfRect = { x: SL.X0 + SL.OX + 180, y: SL.SHELF_Y - 40, w: 580, h: 64 };
  const doorRect = { x: SL.X0 + SL.DOOR.x - 6, y: SL.DOOR.y - 36, w: SL.DOOR.w + 12, h: SL.DOOR.h + 36 };   // the staff door
  const lockedStall = i => { const n = nodeFor('stall' + (i + 1)); say(owns(n.id) ? 'Stall ' + (i + 1) + ' is on sale at Kitsune-ya (' + n.cost + 'G).' : 'Stall ' + (i + 1) + ' unlocks on the Japan road at ' + n.place + ', level ' + n.level + '.'); };
  const stallRect = i => ({ x: SL.X0 + SL.stallX(i) + 6, y: SL.BLIND_TOP, w: SL.STALL_W - 12, h: SL.COUNTER_Y - SL.BLIND_TOP + 140 });
  const menuCardRect = i => ({ x: SL.X0 + SL.stallX(i) + SL.STALL_W - 58, y: SL.COUNTER_Y - 40, w: 44, h: 44 });
  const trashRect = { x: K(KL.TRASH.x) - 6, y: KL.TRASH.y - 6, w: KL.TRASH.w + 12, h: KL.TRASH.h + 12 };
  function jobPos(id) { const [x, y] = KL.badge(id); return [K(x), y - 22]; }

  // Things you can pick up. start() returns the drag, or null (after explaining why not).
  function sources() {
    const s = [];
    s.push({ r: noodleRect, start: () => G.stock.noodle > 0 ? { kind: 'nest' } : say('Out of noodles. Kitsune-ya sells more after closing.') });
    TARE_SLOTS.forEach((type, i) => s.push({ r: tareRect(i), start: () => {
      if (!type) return say('This crock is empty for now.');
      if (!tareOn(type)) return lockedSay(TARES[type].node);
      return G.stock[tareKey(type)] > 0 ? { kind: 'tare', type } : say('The ' + TARES[type].name.toLowerCase() + ' crock is empty. Kitsune-ya sells more after closing.');
    } }));
    BROTH_SLOTS.forEach((type, i) => s.push({ r: potRect(i), start: () => {
      if (!type) return say('This pot is empty for now.');
      if (!brothOn(type)) return lockedSay(BROTHS[type].node);
      return G.stock[brothKey(type)] > 0 ? { kind: 'broth', type } : say('The ' + BROTHS[type].name.toLowerCase() + ' pot is empty. Kitsune-ya sells more after closing.');
    } }));
    KL.basketX.forEach((bx, j) => s.push({ r: basketRect(j), start: () => {
      const b = G.baskets[j];
      if (b.t < 0) return say('Drag a noodle nest from the tray above into this basket.');
      if (b.t < cookTime()) return say('Still cooking. They will be ready in a moment.');
      return { kind: 'basket', j };
    } }));
    TOPS.forEach((id, k) => s.push({ r: binRect(k), start: () => !topOn(id) ? lockedSay(TOP_NODE[id]) : G.stock[id] > 0 ? { kind: 'top', id } : say('Out of ' + TOP_NAME[id].toLowerCase() + '. Kitsune-ya sells more after closing.') }));
    KL.bowlX.forEach((bx, k) => s.push({ r: bowlRect(k), start: () => G.bowls[k].s > 0 ? { kind: 'bowl', bowl: G.bowls[k], spot: k } : null }));
    for (let i = 0; i < SL.NSTALL; i++) {
      const gu = G.stalls[i].guest;
      if (stallOpen(i) && gu && (gu.state === 'call' || gu.state === 'wait')) s.push({ r: cordRect(i), cord: true, start: () => ({ kind: 'cord', i }) });
    }
    G.pass.forEach((b, i) => {
      s.push({ r: passSlot(i), start: () => ({ kind: 'bowl', bowl: b, pass: true }) });
      s.push({ r: pickSlot(i), start: () => ({ kind: 'bowl', bowl: b, pass: true }) });
    });
    return s;
  }

  // Where a held item can go. ok() = would be accepted (for highlights); drop() does it or explains why not.
  function targets(d) {
    const t = [];
    if (d.kind === 'nest') KL.basketX.forEach((_, j) => t.push({ r: basketRect(j), ok: () => G.baskets[j].t < 0, drop: () => {
      if (G.baskets[j].t >= 0) return say('That basket is busy. Try an empty one.');
      G.stock.noodle--; G.baskets[j].t = 0; SFX.drop(); splash(K(KL.basketX[j]), KL.BOIL.cy - 4, '#bfe6f2', 8);
    } }));
    if (['tare', 'broth', 'basket', 'top'].includes(d.kind)) KL.bowlX.forEach((bx, k) => t.push({ r: bowlRect(k), ok: () => accepts(G.bowls[k], d), drop: () => addTo(G.bowls[k], k, d) }));
    if (d.kind === 'bowl') {
      KL.bowlX.forEach((bx, k) => t.push({ r: bowlRect(k), ok: () => G.bowls[k].s === 0 && G.bowls[k] !== d.bowl, drop: () => {
        if (G.bowls[k] === d.bowl) return;
        if (G.bowls[k].s > 0) return say('That spot already has a bowl in progress.');
        takeBowl(d); d.bowl.age = 1; G.bowls[k] = d.bowl; SFX.drop();
      } }));
      const canPass = () => !d.pass && d.bowl.s >= 3 && G.pass.length < MAX_PASS;
      const toPass = () => {
        if (d.pass) return;
        if (d.bowl.s < 3) return say('A bowl needs tare, broth and noodles before it goes out.');
        if (G.pass.length >= MAX_PASS) return say('The pass is full. Serve a few bowls first.');
        takeBowl(d); d.bowl.age = 0; G.pass.push(d.bowl); SFX.whoosh(); pop('ORDER UP', K(KL.PASS.x) + 83, KL.PASS.y + 130, '#b6e37a');
      };
      t.push({ r: passRect, ok: canPass, drop: toPass });
      t.push({ r: shelfRect, ok: canPass, drop: toPass });
      for (let i = 0; i < SL.NSTALL; i++) if (stallOpen(i)) t.push({ r: stallRect(i), ok: () => { const st = G.stalls[i], gu = st.guest; return gu && gu.state === 'wait' && st.blind < 0.05 && d.bowl.s >= 3; }, drop: () => serve(i, d) });
      t.push({ r: trashRect, ok: () => true, drop: () => { takeBowl(d); SFX.drop(); pop('BINNED', K(KL.TRASH.x) + 23, KL.TRASH.y - 10, '#c9d1dd'); } });
    }
    return t;
  }
  function takeBowl(d) {   // remove the dragged bowl from where it came from
    if (d.pass) G.pass = G.pass.filter(b => b !== d.bowl);
    else if (d.spot !== undefined && G.bowls[d.spot] === d.bowl) G.bowls[d.spot] = newBowl();
  }
  function accepts(b, d) {
    if (d.kind === 'tare') return b.s === 0;
    if (d.kind === 'broth') return b.s === 1 && recipesFor(b.tare, d.type).length > 0;
    if (d.kind === 'basket') return b.s === 2;
    if (d.kind === 'top') return b.s >= 3 && b.items.filter(x => x === d.id).length < 2 && toppingOk(b, d.id);
    return false;
  }
  function addTo(b, k, d) {
    const bx = K(KL.bowlX[k]), by = KL.BOWL_Y;
    if (d.kind === 'tare') {
      if (b.s > 0) return say('This bowl already has its tare.');
      G.stock[tareKey(d.type)]--; b.s = 1; b.tare = d.type; SFX.add(); splash(bx, by, TARES[d.type].c, 5);
    } else if (d.kind === 'broth') {
      if (b.s < 1) return say('Tare goes in first. Drag a spoon from a tare crock.');
      if (b.s > 1) return say('This bowl already has broth.');
      if (!recipesFor(b.tare, d.type).length) return say("You can't make that. No ramen uses " + TARES[b.tare].name.toLowerCase() + ' with ' + BROTHS[d.type].name.toLowerCase() + '.');
      G.stock[brothKey(d.type)]--; b.s = 2; b.broth = d.type; b.fill = 0; SFX.pour(); splash(bx, by, BROTHS[d.type].c, 12);
    } else if (d.kind === 'basket') {
      if (b.s < 2) return say(b.s < 1 ? 'Tare and broth go in before the noodles.' : 'Ladle in the broth before the noodles.');
      if (b.s > 2) return say('This bowl already has noodles.');
      b.s = 3; b.noodles = 'perfect'; b.nT = G.t; G.baskets[d.j].t = -1; SFX.pour(); splash(bx, by, '#bfe6f2', 10); spark(bx, by - 10, 4, '#fff3c9');
    } else if (d.kind === 'top') {
      if (b.s < 3) return say(b.s < 1 ? 'Start in the kitchen: tare, broth, then noodles.' : 'Noodles go in before the toppings.');
      if (b.items.filter(x => x === d.id).length >= 2) return say('Two portions is the most a bowl can take.');
      if (!toppingOk(b, d.id)) return say("You can't make that. " + TOP_NAME[d.id] + ' does not go in a ' + TARES[b.tare].short.toLowerCase() + ' and ' + BROTHS[b.broth].short.toLowerCase() + ' bowl.');
      G.stock[d.id]--; b.items.push(d.id); (b.itemT = b.itemT || [])[b.items.length - 1] = G.t; SFX.add(); spark(bx, by, 3, '#fff6d0');
    }
  }

  /* ---------- what a bowl is: which ramen it makes, and how it differs from that recipe or an order ---------- */
  const EXTRA_OK = ['scallion', 'egg', 'corn', 'butter', 'chashu', 'menma', 'nori'];   // extras any bowl may take (chili only where its recipe has chili)
  const recipesFor = (tare, broth) => Object.keys(MENU).filter(k => MENU[k].tare === tare && MENU[k].broth === broth && menuOn(k));
  const toppingOk = (b, id) => recipesFor(b.tare, b.broth).some(k => MENU[k].tops[id] || EXTRA_OK.includes(id));
  function identify(b) {   // the closest unlocked recipe for this tare + broth + toppings, or null
    if (!b.tare || !b.broth) return null;
    const c = ART.count(b.items);
    let best = null, bd = Infinity;
    for (const k of recipesFor(b.tare, b.broth)) {
      let d = 0; for (const id of TOPS) d += Math.abs((c[id] || 0) - (MENU[k].tops[id] || 0));
      if (d < bd) { bd = d; best = k; }
    }
    return best && { type: best, tops: c };
  }
  function orderDiff(b, order) {   // what is off, in words; empty when the bowl is exactly what was ordered
    const m = MENU[order.type];
    if (b.tare !== m.tare || b.broth !== m.broth) { const id = identify(b); return ['it should be ' + m.name + (id ? ', not ' + MENU[id.type].name : '')]; }
    const c = ART.count(b.items), out = [];
    for (const id of TOPS) {
      const want = order.tops[id] || 0, has = c[id] || 0, n = TOP_NAME[id].toLowerCase();
      if (has < want) out.push('missing ' + (want - has > 1 ? 'two ' : '') + n);
      else if (has > want) out.push('extra ' + n);
    }
    return out;
  }

  /* ---------- serving ---------- */
  function grade(b, order) {
    const c = ART.count(b.items);
    let q = 1;
    for (const id of TOPS) q -= 0.12 * Math.abs((c[id] || 0) - (order.tops[id] || 0));
    const m = MENU[order.type];
    if (m.tare && b.tare !== m.tare) q -= 0.25;
    if (m.broth && b.broth !== m.broth) q -= 0.25;
    return Math.max(0.1, q);
  }
  function serve(i, d) {
    const st = G.stalls[i], gu = st.guest;
    if (!gu) return say('That stall is empty.');
    if (gu.state === 'call' || gu.state === 'arrive') return say('Take their order first: pull the red cord to raise their blind.');
    if (st.blind > 0.05) return say('Pull the red cord to raise the blind first.');
    if (gu.state !== 'wait') return say('They already have their bowl.');
    if (d.bowl.s < 3) return say('That bowl is not finished yet.');
    const off = orderDiff(d.bowl, gu.order);
    if (off.length) {
      bubble(i, 'That is not what I ordered...');
      return say('That is not what ' + gu.gt.name + ' ordered: ' + off.join(', ') + '.');
    }
    takeBowl(d);
    const q = grade(d.bowl, gu.order), perfect = q > 0.99;
    gu.q = q; gu.sale = Math.round(gu.order.price * q); gu.pay = gu.sale + (perfect ? perfectTip() : 0) + (gu.trusted && perfect ? 3 : 0);
    st.bowl = d.bowl; st.target = 0; gu.state = 'served'; gu.t = 0; gu.keepOpen = Math.random() < 0.5;
    G.slips = G.slips.filter(s => s.guest !== gu);
    SFX.blind();
  }

  function makeOrder(gt, type) {
    const t = gt.taste, menu = Object.keys(MENU).filter(menuOn);
    type = type || (t.pref && menuOn(t.pref) && Math.random() < 0.6 ? t.pref : pick(menu));
    const base = MENU[type].tops, tops = { ...base };
    const vary = Math.min(0.9, 0.35 + 0.15 * (G.day - 1));
    if (t.tops && Math.random() < vary) { for (const id in t.tops) if (topOn(id) && (id !== 'chili' || base.chili)) tops[id] = t.tops[id]; }
    else if (Math.random() < vary * 0.5) {
      const opts = [['scallion', 0], ['egg', 2], ['corn', 1], ['butter', 1], ['chashu', 2], ['menma', 0], ['nori', 2]].filter(([id]) => topOn(id));
      if (opts.length) { const [id, n] = pick(opts); tops[id] = n; }
    }
    let extra = 0;
    for (const id of Object.keys(tops)) { extra += Math.max(0, tops[id] - (base[id] || 0)); if (!tops[id]) delete tops[id]; }
    return { type, tops, price: MENU[type].price + EXTRA_PRICE * extra };
  }
  function mods(order) {
    const base = MENU[order.type].tops, out = [];
    for (const id of TOPS) {
      const want = order.tops[id] || 0, had = base[id] || 0, name = TOP_NAME[id].toLowerCase();
      if (want === 0 && had) out.push('no ' + name);
      else if (want > had) out.push(had ? 'extra ' + name : (want > 1 ? 'double ' : 'some ') + name);
    }
    return out;
  }
  const joinList = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  function seatGuest(i) {
    const used = G.stalls.map(s => s.guest && s.guest.gt.id);
    const pool = GUESTS.filter(gt => !used.includes(gt.id) && (!gt.taste.night || isNight()) && !(gt.id === 'aoi' && G.shop === 'night'));
    const gt = pick(pool);
    const gu = { gt, img: IMG[gt.id], sil: SERVING.silhouette(IMG[gt.id]), stall: i, state: 'arrive', t: 0, mood: null, order: null };
    gu.asksRec = Math.random() < (gt.taste.pref ? 0.25 : 0.55);
    G.stalls[i].guest = gu; G.stalls[i].target = 1;
    return gu;
  }
  // How spread out arrivals are at a given hour (1 = the lunch rush). Quiet mornings, a 12:00-15:00 peak,
  // then it eases off into a slow evening.
  function pace(h) {
    if (h < 11) return 2.6 - (h - 9) * 0.3;          // 09-11: 2.6 -> 2.0
    if (h < 12) return 2.0 - (h - 11) * 0.88;        // 11-12: ramp into the rush
    if (h < 15) return 1.12;                         // 12-15: peak (a touch calmer than it was)
    if (h < 16.5) return 1.12 + (h - 15) * 0.85;     // 15-16:30: easing off
    return 2.4 + (h >= 18 ? 0.4 : 0);                // late afternoon, then a quieter evening
  }
  function updateGuests(dt) {
    G.spawnT -= dt; G.seatCD -= dt;
    const free = () => G.stalls.findIndex((s, i) => !s.guest && stallOpen(i));
    if (G.shop === 'morning') G.spawnT = Math.max(G.spawnT, 3);
    else if (G.shop === 'night') {     // closed, but the odd late-night walk-in knocks (gold only, never on a receipt)
      if (G.spawnT <= 0) { if (free() >= 0) seatGuest(free()); G.spawnT = rand(40, 60); }
    } else if (G.spawnT <= 0) {
      if (free() >= 0 && G.waiting === 0) seatGuest(free());
      else if (G.waiting < maxWait()) G.waiting++;
      G.spawnT = Math.max(6.5, rand(9, 13) - 0.4 * (G.day - 1)) * pace(hour()) / rainBoost();   // rain brings 25% more guests
    }
    if (G.shop === 'open' && G.waiting > 0 && G.seatCD <= 0 && free() >= 0) { G.waiting--; G.seatCD = 2; seatGuest(free()); }
    for (const st of G.stalls) {
      const before = st.blind;
      st.blind = clamp(st.blind + Math.sign(st.target - st.blind) * dt / 0.5, 0, 1);
      if (Math.abs(st.blind - st.target) < 0.01) st.blind = st.target;
      if (before !== st.blind && (st.blind === 0 || st.blind === 1)) SFX.blind();
    }
    G.stalls.forEach((st, i) => {
      const gu = st.guest; if (!gu) return;
      gu.t += dt;
      const held = G.drag && G.drag.kind === 'cord' && G.drag.i === i;
      if (gu.state === 'call' && gu.pendingOrder && st.blind === 0 && !G.ui) { gu.pendingOrder = false; takeOrder(gu); }
      if (gu.state === 'wait' && st.target === 0 && !held && G.ui !== 'dialog') { st.openT = (st.openT || 10) - dt; if (st.openT <= 0) st.target = 1; }
      const cx = SL.X0 + SL.stallCX(i);
      switch (gu.state) {
        case 'arrive':
          if (gu.t > 0.8) { gu.state = 'call'; gu.t = 0; SFX.bell(); }
          break;
        case 'served':
          if (st.blind === 0) { gu.state = 'react'; gu.t = 0; hearts(cx, 160, 2); }
          break;
        case 'react':
          if (gu.t > 1.6) { gu.state = 'eat'; gu.t = 0; if (!gu.keepOpen) st.target = 1; }
          break;
        case 'eat':
          if (Math.random() < dt * 6) G.parts.push({ type: 'steam', x: cx + rand(-30, 30), y: 290, vx: 0, vy: rand(-44, -24), life: rand(0.9, 1.6), max: 1.6 });
          if (Math.random() < dt * 0.9) pop(pick(['SLURP', 'MMM', 'SIP']), cx + rand(-40, 40), 200, '#fff6d0');
          if (gu.t > 6) {
            gu.state = 'pay'; gu.t = 0;
            const perfect = gu.q > 0.99;
            gu.mood = perfect ? 'happy' : gu.q >= 0.6 ? 'ok' : 'sad';
            st.bowl = { broth: false, items: [] };
            const S = G.stats, type = gu.order.type;
            G.gold += gu.pay; S.earned += gu.pay; S.served++; if (perfect) S.perfect++;
            S.sales += gu.sale; S.tips += gu.pay - gu.sale; S.sold[type]++; S.rev[type] += gu.sale;
            const L = G.life; L.served++; if (perfect) L.perfect++; L.sold[type] = (L.sold[type] || 0) + 1;
            if (!G.met.includes(gu.gt.id)) G.met.push(gu.gt.id);
            pop('+' + gu.pay + 'G', cx, 220);
            gainXP(Math.round(6 + 10 * gu.q), cx);
            for (let k = 0; k < 5; k++) G.parts.push({ type: 'coin', x: cx, y: 290, x0: cx + rand(-20, 20), y0: 290, k: -k * 0.12, life: 2, max: 2 });
            if (perfect) { hearts(cx, 170, 6); SFX.ding(); } else SFX.coin();
            bubble(i, perfect ? line(gu, 'yum', gu.gt.yum) : gu.q >= 0.6 ? line(gu, 'meh', ['Close enough. Thank you!', 'Warm and filling.']) : line(gu, 'bad', ['Hm, not quite what I asked for.', 'I will manage. Thanks anyway.']));
          }
          break;
        case 'pay':
          if (gu.t > 2.4) { gu.state = 'closing'; gu.t = 0; st.target = 1; }
          break;
        case 'closing':
          if (st.blind === 1) { gu.state = 'leave'; gu.t = 0; }
          break;
        case 'leave':
          if (gu.t > 0.9) { st.guest = null; st.bowl = null; }
          break;
      }
    });
  }

  /* ---------- dialog ---------- */
  const DLG = { gu: null, steps: [], i: 0, chars: 0, full: '', onEnd: null, pitch: 620 };
  function talk(gu, steps, onEnd) {
    const p = PERSONA[gu.gt.id] || {};
    Object.assign(DLG, { gu, steps, i: 0, onEnd, pitch: p.pitch || 620 });
    const c = $('dlg-face'), g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#e9d8b4'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(gu.img, gu.gt.ax - 56, gu.gt.head - 10, 112, 112, 0, 0, 112, 112);
    $('dlg-name').textContent = gu.gt.name;
    $('dlg-title').textContent = gu.gt.title + (p.trait ? ' · ' + p.trait : '');
    $('dialog').classList.add('show'); G.ui = 'dialog';
    showStep();
  }
  function showStep() {
    while (DLG.i < DLG.steps.length && DLG.steps[DLG.i].skip && DLG.steps[DLG.i].skip()) DLG.i++;
    if (DLG.i >= DLG.steps.length) return endTalk();
    const s = DLG.steps[DLG.i];
    DLG.full = typeof s.text === 'function' ? s.text() : s.text; DLG.chars = 0;
    $('dlg-text').textContent = ''; $('dlg-choices').innerHTML = ''; $('dlg-next').style.visibility = 'hidden';
  }
  const typed = () => DLG.chars >= DLG.full.length;
  function revealChoices() {
    const s = DLG.steps[DLG.i];
    $('dlg-text').textContent = DLG.full;
    if (s.choices) {
      $('dlg-choices').innerHTML = '';
      s.choices.forEach(c => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'choice' + (c.rec ? ' rec' : '');
        b.innerHTML = (c.rec ? '<span class="star">&#9733;</span> ' : '') + c.label;
        b.onpointerdown = e => e.stopPropagation();
        b.onclick = e => { e.stopPropagation(); SFX.tap(); if (c.fn) c.fn(); DLG.i++; showStep(); };
        $('dlg-choices').appendChild(b);
      });
    } else $('dlg-next').style.visibility = 'visible';
  }
  function advance() {
    if (G.ui !== 'dialog') return;
    if (!typed()) { DLG.chars = DLG.full.length; revealChoices(); return; }
    if (DLG.steps[DLG.i].choices) return;
    DLG.i++; showStep();
  }
  function endTalk() { $('dialog').classList.remove('show'); G.ui = null; const f = DLG.onEnd; DLG.onEnd = null; if (f) f(); }
  function updateDialog(dt) {
    if (G.ui !== 'dialog' || typed()) return;
    const before = Math.floor(DLG.chars);
    DLG.chars = Math.min(DLG.full.length, DLG.chars + dt * [26, 48, 95][SETTINGS.textSpeed]);
    const now = Math.floor(DLG.chars);
    if (now !== before) { $('dlg-text').textContent = DLG.full.slice(0, now); if (now % 3 === 0 && DLG.full[now - 1] !== ' ') SFX.blip(DLG.pitch); }
    if (typed()) revealChoices();
  }

  function takeOrder(gu) {
    const gt = gu.gt, p = PERSONA[gt.id] || {}, steps = [];
    gu.state = 'ordering';
    steps.push({ text: line(gu, 'hi', gt.hi) });
    const glance = Math.random() < 0.35 ? line(gu, 'menu', ['*studies the little menu card*', '*runs a finger down the menu card*']) + ' ' : '';
    gu.declined = false;
    // The order line itself carries the confirm / decline choice.
    const answer = [{ label: 'Coming right up!' }, { label: 'Sorry, I cannot make that one', fn: () => { gu.declined = true; } }];
    const modsTpl = () => p.mods ? (Array.isArray(p.mods) ? pick(p.mods) : p.mods) : 'With {mods}, please.';
    const orderText = () => {
      const m = mods(gu.order), dish = 'the ' + MENU[gu.order.type].name;
      const tpl = p.order ? pick(p.order) : 'I will have {dish}.';
      const out = tpl.replace('{dish}', dish) + (m.length ? ' ' + modsTpl().replace('{mods}', joinList(m)) : '');
      return out[0].toUpperCase() + out.slice(1);
    };
    if (gu.asksRec) {
      steps.push({ text: line(gu, 'ask', ['Everything looks good. What would you recommend?', 'I can never decide. What do you suggest, cook?']),
        choices: (() => {
          const others = Object.keys(MENU).filter(k => k !== 'miso' && menuOn(k)), alt = others.length ? pick(others) : null;
          return [{ label: 'Miso Ramen, the chef\'s pick', rec: true, fn: () => { gu.order = makeOrder(gt, 'miso'); gu.trusted = true; } }]
            .concat(alt ? [{ label: MENU[alt].name, fn: () => { gu.order = makeOrder(gt, alt); gu.trusted = false; } }] : []);
        })() });
      steps.push({ text: () => (gu.trusted ? line(gu, 'trust', ['The chef\'s pick? Then miso it is!']) : (MENU[gu.order.type].name + ' it is! I like your style.'))
        + (mods(gu.order).length ? ' ' + modsTpl().replace('{mods}', joinList(mods(gu.order))) : ''), choices: answer });
    } else {
      gu.order = makeOrder(gt);
      steps.push({ text: () => glance + orderText(), choices: answer });
    }
    steps.push({ text: () => line(gu, 'decline', DECLINE), skip: () => !gu.declined });
    talk(gu, steps, () => {
      if (gu.declined) return sendHome(gu);
      gu.num = G.nextNum++; gu.state = 'wait'; gu.t = 0; G.stalls[gu.stall].target = 1;
      G.slips.push({ num: gu.num, guest: gu, order: gu.order, age: 0 });
      SFX.ding();
    });
  }
  // Tapping a waiting guest: a quick chat, with the option to cancel an order you cannot make.
  function checkIn(gu) {
    gu.declined = false;
    talk(gu, [
      { text: line(gu, 'idle', ['I will be right here.', 'No hurry!']),
        choices: [{ label: 'It will be ready soon!' }, { label: 'Sorry, I have to cancel your order', fn: () => { gu.declined = true; } }] },
      { text: () => line(gu, 'decline', DECLINE), skip: () => !gu.declined }
    ], () => { if (gu.declined) sendHome(gu); else G.stalls[gu.stall].openT = 10; });
  }
  // The guest leaves without a bowl: no slip, no pay, no hard feelings.
  function sendHome(gu) {
    G.slips = G.slips.filter(s => s.guest !== gu);
    gu.state = 'closing'; gu.t = 0; G.stalls[gu.stall].target = 1; G.stats.declined++;
    toast(gu.gt.name + ' heads home. No hard feelings.');
  }

  /* ---------- menu and recipe book ---------- */
  const img = (w, h, draw, scale = 1) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); return `<img class="px" style="width:${w * scale}px" src="${c.toDataURL()}" alt="">`; };
  const recipeItems = m => Object.entries(m.tops).flatMap(([id, n]) => Array(n).fill(id));
  const bowlImg = type => img(124, 82, g => ART.bigBowl(g, 62, 26, { s: 3, tare: MENU[type].tare, broth: MENU[type].broth, fill: 1, noodles: 'perfect', items: recipeItems(MENU[type]), hide: {} }, false, 0));
  const topImg = id => img(26, 26, g => ART.top(g, id, 13, 13));
  function buildMenu() {
    const dish = type => { const m = MENU[type]; return `<div class="dish">${bowlImg(type)}<div><h3>${m.name} <span class="price">${m.price}G</span>${m.rec ? ' <span class="pickme">&#9733; Chef\'s pick</span>' : ''}</h3><p>${m.desc}</p><div class="tops">${Object.keys(m.tops).map(id => `<span>${topImg(id)}${TOP_NAME[id]}</span>`).join('')}</div></div></div>`; };
    $('menu-body').innerHTML = `<h2>Menu</h2>${Object.keys(MENU).filter(menuOn).map(dish).join('')}
      <h4>Extra toppings, ${EXTRA_PRICE}G each</h4><div class="tops extras">${TOPS.filter(topOn).map(id => `<span>${topImg(id)}${TOP_NAME[id]}</span>`).join('')}</div>
      <p class="note">Guests read this same menu on the card in every stall.</p>`;
  }
  // Level-road icons are drawn into padded canvases and shown in fixed boxes, so nothing gets cropped.
  const ico = (w, h, draw) => img(w, h, draw).replace('<img class="px"', '<img class="px ico-img"');
  const box = (inner, cls = '') => `<span class="ico ${cls}">${inner}</span>`;

  /* ---------- the two physical books (js/pbook.js): the cookbook and the guest book ---------- */
  const BOOKS = { book: COOKBOOK, guests: GUESTBOOK };
  const bookSound = n => ({ lift: SFX.bookLift, land: SFX.bookLand, open: SFX.bookOpen, close: SFX.bookClose, down: SFX.bookDown, flip: SFX.flip, settle: SFX.pageSettle, tap: SFX.tap }[n] || (() => {}))();
  const metList = () => (G.mode === 'play' ? G.met : ((loadSave() || {}).met || []));
  COOKBOOK.init({ sound: bookSound, close: () => closeUI() });
  GUESTBOOK.init({ sound: bookSound, close: () => closeUI(), img: id => IMG[id], met: metList });
  // Where a book is picked up from: the open cookbook lying on the kitchen counter (when it is on screen), else a HUD button.
  function counterBookRect() {
    const r = canvas.getBoundingClientRect(), k = r.width / VW, B = KL.BOOK, x = K(B.x) - G.cam;
    return x > -B.w && x < VW ? new DOMRect(r.left + x * k, r.top + B.y * k, B.w * k, B.h * k) : null;
  }
  function bookFrom(id, how) {
    if (id === 'book' && how === 'counter' && G.mode === 'play') { const r = counterBookRect(); if (r) return { from: r, counter: true }; }
    const btn = $(id === 'book' ? 'btn-book' : 'btn-guests');
    return { from: G.mode === 'play' && btn ? btn.getBoundingClientRect() : null };
  }
  function openBook(id, how, instant) {
    const o = bookFrom(id, how);
    if (o.counter) G.bookOut = true;
    $(id).classList.add('show'); G.ui = id; G.drag = null; G.dragBowl = null;
    try { BOOKS[id].open({ ...o, instant }); }
    catch (err) {   // never leave the game stuck behind a book that failed to open
      $(id).classList.remove('show'); G.ui = null; G.bookOut = false;
      console.error(err); toast('The ' + (id === 'book' ? 'recipe' : 'guest') + ' book could not be opened.');
    }
  }
  function closeBook(id) {
    BOOKS[id].close(() => {
      $(id).classList.remove('show');
      if (G.bookOut) { G.bookOut = false; G.bookPut = G.t; }   // set back down on the counter with a little bounce
      if (G.ui === id) G.ui = null;
    });
  }
  function openUI(id, how) {
    if (BOOKS[id]) return openBook(id, how);
    if (id === 'menu') buildMenu(); else if (id === 'road') { unlockReached(); JOURNEY.open(); }
    $(id).classList.add('show'); G.ui = id; G.drag = null; G.dragBowl = null; SFX.tap();
  }
  function closeUI() {
    if (BOOKS[G.ui]) return closeBook(G.ui);
    if (G.ui === 'menu' || G.ui === 'road') { if (G.ui === 'road') JOURNEY.close(); $(G.ui).classList.remove('show'); G.ui = null; SFX.tap(); }
  }
  $('menu-close').onclick = closeUI;
  for (const id of ['menu', 'road']) $(id).addEventListener('pointerdown', e => { if (e.target.id === id) closeUI(); });
  $('btn-menu').onclick = () => { if (!G.ui) openUI('menu'); };
  $('btn-book').onclick = () => { if (!G.ui) openUI('book'); };
  $('btn-guests').onclick = () => { if (!G.ui) openUI('guests'); };

  /* ---------- cheat codes (type during play): money, guest, level up ---------- */
  let cheatBuf = '', muteBefore = null;
  function cheat(ch) {
    cheatBuf = (cheatBuf + ch).slice(-12);
    if (cheatBuf.endsWith('money')) {
      if (muteBefore !== null && muted !== muteBefore) $('mute').click();   // undo the M that started the word
      G.gold += 1000; SFX.coin(); toast('Cheat: +1000 gold'); cheatBuf = ''; return true;
    }
    if (cheatBuf.endsWith('guest')) {
      G.met = GUESTS.map(gt => gt.id); SFX.ding(); toast('Cheat: every guest is in the guest book'); cheatBuf = ''; return true;
    }
    // 'morning': the start of the next morning (09:00, sign still CLOSED). 'night': 21:00, closing time.
    if (cheatBuf.endsWith('morning')) {
      if (muteBefore !== null && muted !== muteBefore) $('mute').click();   // undo the M that started the word
      if (G.shop !== 'morning') { G.day++; G.shop = 'morning'; G.signWas = 'morning'; G.signT = G.t; G.waiting = 0; saveGame(G.day); }
      G.time = 0; updateClock(0); SFX.bell(); toast('Cheat: Day ' + G.day + ', 09:00. Flip the sign when you are ready to open.'); cheatBuf = ''; return true;
    }
    if (cheatBuf.endsWith('night')) {
      if (G.shop !== 'night') { if (G.shop === 'morning') G.stats = newStats(); G.time = PHASE; closeShop(); }
      else G.time = PHASE;
      updateClock(0); SFX.bell(); toast('Cheat: 21:00. Closing time; Kitsune-ya is open across the street.'); cheatBuf = ''; return true;
    }
    if (cheatBuf.endsWith('shower')) {
      G.forceRain = G.rain >= 0.5 ? 0 : 1; SFX.whoosh(); toast(G.forceRain ? 'Cheat: here comes the rain' : 'Cheat: the rain clears'); cheatBuf = ''; return true;
    }
    if (cheatBuf.endsWith('level up')) {
      G.level = LEVEL_XP.length; G.xp = LEVEL_XP[LEVEL_XP.length - 1]; G.owned = STOPS.filter(n => n.kind !== 'start').map(n => n.id);
      KITCHEN.refresh(); SFX.bell(); toast('Cheat: max level, the whole Japan road completed'); cheatBuf = ''; return true;
    }
    return false;
  }
  $('lvl').onclick = () => { if (!G.ui && G.mode === 'play') openUI('road'); };
  $('road-close').onclick = closeUI;

  /* ---------- the Japan road (js/journey.js): XP only; every stop up to your level unlocks by itself ---------- */
  const xpFloor = () => LEVEL_XP[G.level - 1], xpNext = () => LEVEL_XP[G.level];
  // lead: text to show before any level-up news (a quest reward, say), in one toast
  function gainXP(n, x, lead = '') {
    G.xp += n; if (x !== undefined) pop('+' + n + ' XP', x, 196, '#9fd8ff');
    const lv0 = G.level;
    while (G.level < LEVEL_XP.length && G.xp >= LEVEL_XP[G.level]) G.level++;
    if (G.level > lv0) {
      SFX.bell();
      const got = unlockReached();
      toast(lead + 'Level ' + G.level + '!' + (got.length ? ' Japan road: ' + got.join(', ') + '.' : ''));
    } else if (lead) toast(lead.trim());
    if (G.ui === 'road') JOURNEY.refresh();
  }
  const claimable = () => [];
  // Unlock one stop (it must be the next on the road and within your level). Returns a short note for the toast.
  function claimStop(id) {
    const n = nodeFor(id), f = frontierIdx();
    if (!n || STOPS.indexOf(n) !== f || !stopReady(n)) return '';
    G.owned.push(id); if (n.gold) G.gold += n.gold;
    KITCHEN.refresh();
    let note = n.kind === 'recipe' ? n.name + ' is on the menu' : n.kind === 'upgrade' ? n.name + ' on sale at Kitsune-ya' : n.place + (n.gold ? ' (+' + n.gold + 'G)' : '');
    const next = STOPS[frontierIdx()];
    if (n.kind === 'landmark' && next && next.region !== n.region && regionOpen(next.region)) { G.region = next.region; note += ', your shop moves to ' + REGIONS[next.region].name; }
    if (frontierIdx() < 0) note += ', the journey is complete';
    return note;
  }
  function unlockReached() {
    const got = [];
    for (let f = frontierIdx(); f >= 0 && stopReady(STOPS[f]); f = frontierIdx()) { const note = claimStop(STOPS[f].id); if (!note) break; got.push(note); }
    if (got.length) { SFX.coin(); SFX.ding(); }
    return got;
  }

  /* ---------- the daily quest: one small goal each day, paid in XP and gold the moment it is done ---------- */
  const seeded = n => { const v = Math.sin(n * 91.345 + 7.77) * 43758.5453; return v - Math.floor(v); };
  function makeQuest(day) {
    const L = G.level, r = k => seeded(day * 13 + k), menus = Object.keys(MENU).filter(menuOn);
    const kinds = ['served', 'sold', 'perfect', 'earn'], k = day === 1 ? 'served' : kinds[Math.floor(r(1) * kinds.length)];
    let q;
    if (k === 'served') q = { k, n: 3 + Math.floor(L * 0.7) + Math.floor(r(2) * 3) };
    else if (k === 'sold') q = { k, type: menus[Math.floor(r(3) * menus.length)], n: 3 + Math.floor(L / 3) + Math.floor(r(2) * 3) };
    else if (k === 'perfect') q = { k, n: 2 + Math.floor(L / 2) + Math.floor(r(2) * 2) };
    else q = { k, n: Math.round((40 + L * 18 + r(2) * 30) / 5) * 5 };
    return Object.assign(q, { day, done: false, xp: 20 + L * 6 + (k === 'perfect' || k === 'earn' ? 10 : 0), gold: 15 + L * 5 });
  }
  const questHave = q => G.shop === 'morning' ? 0 : q.k === 'served' ? G.stats.served : q.k === 'sold' ? G.stats.sold[q.type] || 0 : q.k === 'perfect' ? G.stats.perfect : G.stats.earned;
  const questText = q => q.k === 'served' ? `Serve ${q.n} guests` : q.k === 'sold' ? `Serve ${q.n} ${MENU[q.type].name}` : q.k === 'perfect' ? `Serve ${q.n} perfect bowls` : `Earn ${q.n}G today`;
  function updateQuest() {
    if (G.mode !== 'play') return;
    if (!G.quest || G.quest.day !== G.day) G.quest = makeQuest(G.day);
    const q = G.quest;
    if (!q.done && questHave(q) >= q.n) {
      q.done = true; G.gold += q.gold; SFX.coin(); SFX.ding(); hearts(VW / 2 + G.cam, 120, 6);
      gainXP(q.xp, undefined, 'Daily quest complete! +' + q.xp + ' XP, +' + q.gold + 'G. ');
    }
    const have = Math.min(questHave(q), q.n);
    setText('quest-text', questText(q));
    setText('quest-n', q.done ? 'Done' : have + '/' + q.n);
    setText('quest-reward', '+' + q.xp + ' XP  +' + q.gold + 'G');
    $('quest-fill').style.width = Math.round(100 * (q.done ? 1 : have / q.n)) + '%';
    $('quest').classList.toggle('done', q.done);
  }
  NIGHTSHOP.init({
    sfx: SFX, say, toast, img: IMG.aoi,
    save: () => saveGame(G.shop === 'night' ? G.day + 1 : G.day),
    back: st => { G.where = null; G.drag = null; G.st = st; G.cam = camTarget(); SFX.whoosh(); STATIONS.forEach((s, k) => $('tab-' + s.id).classList.toggle('on', k === st)); }
  });
  JOURNEY.init({
    claim: claimStop, close: () => closeUI(), sound: n => (n === 'tap' ? SFX.tap() : null),
    setRegion: r => { if (!regionOpen(r) || G.region === r) return; G.region = r; SFX.whoosh(); toast('Your shop is now in ' + REGIONS[r].name + '.'); }
  });
  $('dialog').addEventListener('pointerdown', advance);

  /* ---------- clock (mood only) ---------- */
  /* ---------- shop hours: the sign, closing time, the night ---------- */
  function setShop(state) { G.signWas = G.shop; G.shop = state; G.signT = G.t; SFX.clack(); }
  function openShop() {
    if (G.shop === 'night') { G.day++; G.time = 0; }      // skipping the night
    saveGame(G.day);
    setShop('open'); G.stats = newStats(); G.spawnT = 6; SFX.bell();
    toast('Day ' + G.day + ': the shop is open! Guests will start arriving.');
  }
  function closeShop() {
    G.life.bestDay = Math.max(G.life.bestDay, G.stats.earned); G.life.days++;
    setShop('night'); G.waiting = 0; G.spawnT = rand(40, 60);
    makeReceipt();
    saveGame(G.day + 1);
    toast('21:00, closing time. Aoi\'s supply shop across the street is open until 05:00.');
  }
  function flipSign() {
    if (G.shop === 'open') return say('The shop stays open until 21:00.');
    openShop();
  }
  /* ---------- weather: each day may bring one rain spell; while it rains, 25% more guests duck in ---------- */
  const RAIN_CHANCE = 0.35;
  const atHour = h => (h - 9) / 12 * PHASE;   // hour (9-33) -> G.time
  const rainBoost = () => 1 + 0.25 * G.rain;
  function rollWeather() {
    G.wx = { day: G.day, from: -1, to: -1 };
    delete G.forceRain;
    if (G.day > 1 && Math.random() < RAIN_CHANCE) { const h0 = rand(9, 22); G.wx.from = atHour(h0); G.wx.to = atHour(Math.min(32, h0 + rand(2.5, 6))); }
  }
  function updateWeather(dt) {
    if (!G.wx || G.wx.day !== G.day) rollWeather();
    const target = G.forceRain !== undefined ? G.forceRain : (G.time >= G.wx.from && G.time < G.wx.to ? 1 : 0);
    const was = G.rain;
    G.rain = clamp(G.rain + Math.sign(target - G.rain) * dt / 5, 0, 1);
    if (G.mode === 'play' && was < 0.5 && G.rain >= 0.5) toast(G.shop === 'open' ? 'It is starting to rain. Folks will duck in for something warm.' : 'It is starting to rain.');
    else if (G.mode === 'play' && was >= 0.5 && G.rain < 0.5) toast('The rain has stopped.');
  }
  // the sound of rain: looped noise through a soft filter, as loud as the rain is heavy (quieter indoors at Kitsune-ya)
  let rainSrc = null, rainGain = null;
  function rainSound() {
    const want = G.mode === 'play' && !muted ? G.rain * 0.06 * SETTINGS.sfx / 8 * (G.where === 'store' ? 0.45 : 1) : 0;
    if (!actx || (!rainSrc && want <= 0.001)) return;
    try {
      if (!rainSrc) {
        const n = actx.sampleRate * 2, buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        rainSrc = actx.createBufferSource(); rainSrc.buffer = buf; rainSrc.loop = true;
        const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
        const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
        rainGain = actx.createGain(); rainGain.gain.value = 0;
        rainSrc.connect(lp); lp.connect(hp); hp.connect(rainGain); rainGain.connect(actx.destination); rainSrc.start();
      }
      rainGain.gain.value = want;
    } catch (e) { /* audio is optional */ }
  }
  function updateClock(dt) {
    updateWeather(dt);
    const wasEvening = isNight();
    if (G.shop !== 'morning') G.time += dt;                // the clock waits at 09:00 until you open
    if (G.shop === 'open' && G.time >= PHASE) closeShop();
    else if (G.shop === 'night' && G.time >= PHASE * 2) { G.time = 0; G.day++; G.shop = 'morning'; G.signWas = 'morning'; saveGame(G.day); toast('Good morning! Flip the sign when you are ready to open.'); }
    else if (G.shop === 'open' && !wasEvening && isNight()) toast('Evening falls. The night crowd is a quieter bunch.');
    const h = hour(); G.hour = h;
    let f = 0;
    if (h >= 18 && h < 20) f = (h - 18) / 2; else if (h >= 20 || h < 4) f = 1; else if (h >= 4 && h < 6) f = 1 - (h - 4) / 2;
    G.nightF = f; G.duskF = 1 - Math.abs(2 * f - 1);
  }

  /* ---------- update ---------- */
  function tickJobs(dt) {   // prep keeps going in the kitchen even while you are out
    for (const j of G.jobs) {
      j.t += dt;
      if (j.t >= j.dur) { const def = STOCK[j.id]; G.stock[j.id] += def.add; const [x, y] = jobPos(j.id); pop('+' + def.add, x, y, '#b6e37a'); if (!G.where) SFX.ding(); }
      else if (!G.where && TOPS.includes(j.id) && Math.random() < dt * 5) SFX.chop();
    }
    G.jobs = G.jobs.filter(j => j.t < j.dur);
  }
  function update(dt) {
    G.t += dt;
    updateDialog(dt);
    if (G.receipt && !G.ui && !G.paused && G.mode === 'play') { G.ui = 'receipt'; G.drag = null; G.dragBowl = null; G.receipt.t0 = G.t; SFX.print(); }
    if (G.ui === 'receipt') { updateReceipt(dt); return; }
    if (G.paused || G.ui === 'menu' || G.ui === 'book' || G.ui === 'road' || G.ui === 'guests' || G.ui === 'pause') return;
    updateClock(G.where === 'store' ? dt * 0.25 : dt);   // time runs slower while you browse Aoi's shelves
    NIGHTSHOP.update(dt);
    if (G.where) { tickJobs(dt); for (const p of G.pops) p.life -= dt; G.pops = G.pops.filter(p => p.life > 0); if (G.flashT > 0) G.flashT -= dt; return; }
    updateGuests(dt);
    // camera + edge panning
    if (G.pan) panBy(G.pan * PAN_SPEED * dt);
    const target = camTarget();
    G.cam += (target - G.cam) * Math.min(1, dt * (G.pan ? 14 : 7));
    if (Math.abs(target - G.cam) < 1) G.cam = target;
    const paper = G.drag && (G.drag.kind === 'slip' || G.drag.kind === 'receipt');
    const m = G.mouse, side = m && !G.ui && !paper ? (m.x < EDGE && G.st > 0 ? -1 : m.x > VW - EDGE && G.st < STATIONS.length - 1 ? 1 : 0) : 0;
    G.edge = 0;          // hovering an edge only highlights it; a click (or the tabs, or A / D) changes station
    const wm = world(m), busy = side && !G.drag && (clicks().some(c => inR(wm, c.r)) || sources().some(s => inR(wm, s.r)));
    G.edgeSide = busy ? 0 : side;
    if (G.mouse) { const vx = G.lastMX === undefined ? 0 : (G.mouse.x - G.lastMX) / Math.max(dt, 0.001); G.mvx = (G.mvx || 0) * 0.88 + vx * 0.12; G.lastMX = G.mouse.x; }
    updateReceipt(dt);
    if (G.drag && G.drag.kind === 'cord' && G.mouse) { const st = G.stalls[G.drag.i]; st.blind = st.target = SERVING.downFor(G.mouse.y); }
    // kitchen
    for (const b of G.baskets) if (b.t >= 0) { const was = b.t < cookTime(); b.t += dt; if (was && b.t >= cookTime()) SFX.ding(); }
    for (const b of G.bowls) { b.age += dt; if (b.broth && b.fill < 1) b.fill = Math.min(1, b.fill + dt * 2.5); }
    for (const b of G.pass) b.age += dt;
    for (const s of G.slips) s.age += dt;
    tickJobs(dt);
    G.steamT -= dt;
    if (G.steamT <= 0 && G.cam > 480) {
      G.steamT = 0.05;
      const src = [[K(KL.BOIL.cx), KL.BOIL.cy - 8, 60], [K(KL.BOIL.cx), KL.BOIL.cy - 8, 60]];
      BROTH_SLOTS.forEach((type, i) => { if (type && G.stock[brothKey(type)] > 0) { const pt = KL.pot(i); src.push([K(pt.cx), pt.cy - 8, 24]); } });
      G.bowls.forEach((b, k) => { if (b.broth) src.push([K(KL.bowlX[k]), KL.BOWL_Y - 6, 32]); });
      G.baskets.forEach((b, j) => { if (b.t >= cookTime()) src.push([K(KL.basketX[j]), KL.BOIL.cy - 10, 14]); });
      const [x, y, w] = pick(src);
      G.parts.push({ type: 'steam', x: x + rand(-w, w), y, vx: 0, vy: rand(-32, -14), life: rand(0.8, 1.7), max: 1.7 });
    }
    for (const p of G.parts) {
      if (p.type === 'coin') {
        p.k += dt * 1.5; const k = clamp(p.k, 0, 1), e = k * k, tx = G.cam + 868;
        p.x = p.x0 + (tx - p.x0) * e; p.y = p.y0 + (14 - p.y0) * e - Math.sin(k * Math.PI) * 60;
        if (p.k >= 1) p.life = 0;
        continue;
      }
      p.x += (p.vx || 0) * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.type === 'steam') p.x += Math.sin(G.t * 3 + p.y * 0.5) * dt * 8;
      if (p.type === 'drop') p.vy += 320 * dt;
    }
    G.parts = G.parts.filter(p => p.life > 0);
    for (const p of G.pops) { p.y -= 28 * dt; p.life -= dt; }
    G.pops = G.pops.filter(p => p.life > 0);
    if (G.flashT > 0) G.flashT -= dt;
  }

  /* ---------- input ---------- */
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const toScreen = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * VH }; };
  const slipsAlpha = () => clamp(G.cam / 960, 0, 1);
  // Plain clicks: restock buttons, the recipe book, menu cards, stalls.
  function clicks() {
    const c = [];
    c.push({ r: { x: K(KL.BOOK.x) - 4, y: KL.BOOK.y - 4, w: KL.BOOK.w + 8, h: KL.BOOK.h + 30 }, fn: () => openUI('book', 'counter') });
    c.push({ r: signRect, fn: flipSign });
    // the pass is a doorway: walk through it to the serving room (bowls waiting in it are still picked up as usual)
    const wm = world(G.mouse);
    if (!G.pass.some((b, i) => inR(wm, passSlot(i)))) c.push({ r: passRect, fn: () => go(0) });
    c.push({ r: doorRect, fn: () => NIGHTSHOP.enter('street') });
    for (let i = 0; i < SL.NSTALL; i++) {
      if (!stallOpen(i)) { c.push({ r: stallRect(i), fn: () => lockedStall(i) }); continue; }
      c.push({ r: menuCardRect(i), fn: () => openUI('menu') });
      const gu = G.stalls[i].guest;
      if (gu && gu.state === 'wait' && G.stalls[i].blind < 0.05) c.push({ r: stallRect(i), fn: () => checkIn(gu) });
    }
    return c;
  }
  canvas.addEventListener('pointermove', e => { G.mouse = toScreen(e); if (G.mode === 'title' || G.ui === 'pause') TITLE.move(G.mouse); else if (G.where) NIGHTSHOP.move(G.mouse); });
  canvas.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch' && !G.drag) G.mouse = null; });
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (G.mode === 'title' || G.ui === 'pause') return TITLE.down(toScreen(e));
    if (G.ui === 'receipt') {
      const p = toScreen(e), r = G.receipt; G.mouse = p;
      if (r && !r.fly && inR(p, receiptRect())) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ } G.drag = { kind: 'receipt', ox: p.x - r.x, oy: p.y - r.y }; SFX.paper(); }
      return;
    }
    if (G.paused || G.ui) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
    const p = toScreen(e), w = world(p); G.mouse = p;
    if (G.where) return NIGHTSHOP.down(p);
    const rc = G.receipt;
    if (rc && !rc.fly && inR(p, receiptRect())) { G.drag = { kind: 'receipt', ox: p.x - rc.x, oy: p.y - rc.y }; SFX.paper(); return; }
    const sl = slipAt(p);
    if (sl) { G.drag = { kind: 'slip', slip: sl, ox: p.x - sl.x }; G.slips = G.slips.filter(o => o !== sl).concat(sl); SFX.paper(); return; }
    const cord = sources().find(s => s.cord && inR(w, s.r));   // the pull-cord wins over tapping the stall behind it
    if (cord) { if (SETTINGS.blindClick) { toggleBlind(cord.start().i); return; } G.drag = cord.start(); SFX.pick(); return; }
    if (SETTINGS.blindClick) {   // click mode: tapping a closed blind with a guest behind it raises it
      for (let i = 0; i < SL.NSTALL; i++) { const st = G.stalls[i], gu = st.guest; if (gu && st.blind > 0.5 && (gu.state === 'call' || gu.state === 'wait') && inR(w, stallRect(i))) return toggleBlind(i); }
    }
    const c = clicks().find(c => inR(w, c.r));
    if (c) { SFX.tap(); return c.fn(); }
    const s = sources().find(s => inR(w, s.r));
    if (s) {
      const d = s.start();
      if (d) { G.drag = d; G.dragBowl = d.bowl || null; SFX.pick(); }
      return;
    }
    if (p.x < EDGE && G.st > 0) return go(G.st - 1);
    if (p.x > VW - EDGE && G.st < STATIONS.length - 1) return go(G.st + 1);
  });
  canvas.addEventListener('pointerup', e => {
    if (G.where) return NIGHTSHOP.up(toScreen(e));
    if (!G.drag) return;
    const d = G.drag; G.drag = null; G.dragBowl = null;
    if (d.kind === 'slip') { d.slip.x = slipClamp(toScreen(e).x - d.ox); d.slip.settle = G.t; SFX.paper(); return; }
    if (d.kind === 'receipt') return releaseReceipt();
    if (d.kind === 'cord') return releaseCord(d);
    const w = world(toScreen(e));
    const t = targets(d).find(t => inR(w, t.r));
    if (t) t.drop();
  });
  canvas.addEventListener('pointercancel', () => { G.drag = null; G.dragBowl = null; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', e => {
    if (BOOKS[G.ui]) {   // either book (the guest book also opens from the title screen)
      const typing = e.target && e.target.tagName === 'INPUT';
      if (e.key === 'Escape') { e.preventDefault(); closeUI(); }
      else if (!typing && e.key === 'ArrowLeft') { e.preventDefault(); BOOKS[G.ui].prev(); }
      else if (!typing && e.key === 'ArrowRight') { e.preventDefault(); BOOKS[G.ui].next(); }
      return;
    }
    if (G.mode === 'title' || G.ui === 'pause') {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', 'Escape', 'Backspace'].includes(e.key)) e.preventDefault();
      return TITLE.key(e.key);
    }
    if (G.ui === 'receipt') { if ([' ', 'Enter', 'Escape'].includes(e.key) && G.receipt && !G.receipt.fly) { e.preventDefault(); G.receipt.fly = { vx: 0, vy: -1400 }; SFX.paper(); SFX.whoosh(); } return; }
    if (G.ui === 'dialog') { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); } return; }
    if (G.ui === 'menu' || G.ui === 'road') { if (e.key === 'Escape') closeUI(); return; }
    if (G.paused) { if (e.key === 'Enter') $('modal-btn').click(); return; }
    if (G.where && NIGHTSHOP.key(e)) { e.preventDefault(); return; }
    const k = e.key.toLowerCase(), left = k === 'a' || k === 'arrowleft', right = k === 'd' || k === 'arrowright';
    if (k.length === 1 && cheat(k)) return;
    if (G.where) { if (k === 'escape') openPause(); else if (k === 'm') { muteBefore = muted; $('mute').click(); } return; }
    if (left || right) {
      const side = right ? 1 : -1;
      if (!e.repeat && atPanEnd(side) && G.st + side >= 0 && G.st + side < STATIONS.length) { e.preventDefault(); go(G.st + side); }   // at the end of a room: walk on
      else { e.preventDefault(); held[left ? 'l' : 'r'] = true; G.pan = (held.r ? 1 : 0) - (held.l ? 1 : 0); }                         // otherwise pan while held
    }
    else if (k === '1' || k === '2') go(+k - 1);
    else if (k === 'escape') { if (G.drag) { G.drag = null; G.dragBowl = null; } else openPause(); }
    else if (k === 'm') { muteBefore = muted; $('mute').click(); }
  });
  // held A / D keys (for panning the kitchen page)
  const held = { l: false, r: false };
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    NIGHTSHOP.keyup(k);
    if (k === 'a' || k === 'arrowleft') held.l = false; else if (k === 'd' || k === 'arrowright') held.r = false; else return;
    G.pan = (held.r ? 1 : 0) - (held.l ? 1 : 0);
  });
  window.addEventListener('blur', () => { held.l = held.r = false; G.pan = 0; });
  // the mouse wheel pans the kitchen page too
  canvas.addEventListener('wheel', e => {
    if (G.mode === 'play' && !G.ui && G.where) { e.preventDefault(); return NIGHTSHOP.wheel(Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY); }
    if (G.mode !== 'play' || G.ui || !wide(STATIONS[G.st])) return;
    e.preventDefault(); panBy((Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.9);
  }, { passive: false });
  STATIONS.forEach((s, i) => { $('tab-' + s.id).onclick = () => { if (G.where) return NIGHTSHOP.leaveTo(i); go(i); }; });
  $('tab-street').onclick = () => { if (G.mode === 'play' && !G.ui && !G.where) NIGHTSHOP.enter('street'); };
  UI.mount();
  $('mute').onclick = () => {
    muted = !muted; const label = muted ? 'Sound off (M)' : 'Sound on (M)';
    UI.set($('mute'), muted ? 'mute' : 'sound'); $('mute').title = label; $('mute').setAttribute('aria-label', label);
  };
  $('help').onclick = () => { if (!G.ui && G.mode === 'play') { openPause(); TITLE.openPause('help'); } };
  $('pause').onclick = () => { if (!G.ui && G.mode === 'play') openPause(); };

  /* ---------- modal ---------- */
  const HELP = `<h2>How the shop runs</h2>
    <ol>
      <li><b>Serving.</b> Guests slip into a stall behind the bamboo blind. When one calls, pull the red cord on their blind up to chat and take the order. Can't make it? Politely decline. To serve, pull a waiting guest's blind up and drop the bowl in (tap them to chat or cancel).</li>
      <li><b>Kitchen.</b> Drag the tare spoon into a bowl, then the ladle of broth, then a basket of READY noodles.</li>
      <li><b>Toppings.</b> Drag on the toppings from the order slip, then drag the bowl into the pass.</li>
      <li><b>Serve.</b> Drag the bowl from the pickup shelf onto the guest's stall.</li>
    </ol>
    <p>Use the tabs at the bottom or the edge arrows to move between Serving and the Kitchen. In the kitchen, hold A / D (or scroll the mouse wheel) to look left and right, even while carrying something. Nobody is in a hurry.</p>`;
  function modal(html, btn) {
    G.paused = true; G.ui = 'modal';
    $('modal-body').innerHTML = html; $('modal-btn').textContent = btn;
    $('modal').classList.add('show');
  }
  $('modal-btn').onclick = () => { $('modal').classList.remove('show'); G.paused = false; G.ui = null; SFX.tap(); };

  /* ---------- HUD ---------- */
  const DRAG_HINT = {
    nest: 'Drop the noodles into an empty basket in the boiler.', tare: 'Drop the tare into an empty bowl.', broth: 'Pour the broth over a bowl with tare.',
    basket: 'Drop the noodles into a bowl with broth.', top: 'Drop it on a bowl with noodles.',
    bowl: 'Drop it in the pass, on a stall, on an empty bowl spot or in the bin.',
    slip: 'Slide the slip anywhere along the rail.', cord: 'Pull the cord up past halfway to raise the blind, or down to close it.', receipt: 'Fling it away to toss it, or let go to keep reading.'
  };
  function hint() {
    if (G.ui === 'receipt') return 'Closing time! Drag the receipt away (or press Enter) to carry on.';
    if (G.flashT > 0) return G.flash;
    if (G.where) return NIGHTSHOP.hint();
    if (G.drag) return DRAG_HINT[G.drag.kind];
    const id = STATIONS[G.st].id, best = Math.max(...G.bowls.map(b => b.s));
    if (G.shop === 'morning') return id === 'serving' ? 'Tap the CLOSED sign on the counter to open the shop.' : 'The shop is closed. Head to Serving and flip the sign to open.';
    if (G.shop === 'night' && id === 'serving' && !G.stalls.some(s => s.guest)) return 'Closed for the night. Kitsune-ya across the street is open: out through the staff door on the far left. Or tap the sign to skip to morning.';
    if (id === 'serving') {
      if (G.stalls.some(s => s.guest && s.guest.state === 'call')) return SETTINGS.blindClick ? 'A guest is calling. Click their blind to raise it and take the order.' : 'A guest is calling. Pull the red cord on their blind up to take the order.';
      if (G.pass.length && G.stalls.some(s => s.guest && s.guest.state === 'wait')) return 'Drag a bowl from the pickup shelf onto the right stall.';
      if (G.slips.length) return 'Orders are on the ticket rail. Head right to cook.';
      return 'All calm. Guests will call when they are ready to order.';
    }
    if (!G.slips.length && best === 0) return 'No orders yet. Restock at Kitsune-ya after closing, or read the recipe book.';
    if (best >= 3) return 'Noodles are in. Add the toppings, then drag the bowl into the pass on the far left.';
    if (best === 2) return G.baskets.some(b => b.t >= cookTime()) ? 'Drag the READY basket onto the bowl.' : G.baskets.some(b => b.t >= 0) ? 'The noodles are cooking. They will wait for you once ready.' : 'Drag a noodle nest from the tray on the shelf into a basket.';
    if (best === 1) return 'Drag the ladle from the broth pot onto the tare.';
    return 'Drag the spoon from the tare crock into a bowl.';
  }
  const last = {};
  function setText(id, v) { if (last[id] !== v) { last[id] = v; $(id).textContent = v; } }
  function hud(dt) {
    const h = hour(), hh = Math.floor(h), mm = Math.floor((h - hh) * 6) * 10;
    setText('day', 'Day ' + G.day);
    setText('clock', String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'));
    setText('shopstate', G.shop === 'open' ? 'Open' : 'Closed');
    $('shopstate').classList.toggle('open', G.shop === 'open');
    UI.set($('sky'), G.rain >= 0.5 ? 'rain' : isNight() ? 'moon' : 'sun');
    rainSound();
    setText('gold', String(G.gold));
    setText('lvnum', 'Lv ' + G.level);
    $('xpfill').style.width = (G.level >= LEVEL_XP.length ? 100 : Math.round(100 * (G.xp - xpFloor()) / (xpNext() - xpFloor()))) + '%';
    updateQuest();
    const calling = G.stalls.filter(s => s.guest && s.guest.state === 'call').length;
    setText('badge-kitchen', G.slips.length ? String(G.slips.length) : '');
    setText('badge-serving', calling ? '!' : G.pass.length ? String(G.pass.length) : '');
    setText('hint', SETTINGS.hints ? hint() : G.flashT > 0 ? G.flash : '');   // hints are optional (off by default); warnings always show briefly
    $('hint').classList.toggle('warn', G.flashT > 0);
    $('bubbles').style.visibility = !G.where && STATIONS[G.st].id === 'serving' && settled() && G.ui !== 'dialog' ? 'visible' : 'hidden';
    $('tab-street').classList.toggle('gone', !NIGHTSHOP.streetOpen());
    $('tab-street').classList.toggle('on', !!G.where);
    STATIONS.forEach((s, k) => $('tab-' + s.id).classList.toggle('on', !G.where && k === G.st));
    $('nshop').classList.toggle('hide', G.ui === 'pause' || G.mode !== 'play');
    for (let i = 0; i < SL.NSTALL; i++) {
      const el = $('bubble-' + i);
      el.style.left = `calc(${(SL.X0 + SL.stallCX(i) - G.cam) / 2}px * var(--s))`;
      if (bubbleT[i] > 0) { bubbleT[i] -= dt; if (bubbleT[i] <= 0) el.classList.remove('show'); }
    }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('show'); }
    if (G.where) { G.hover = null; G.tip = null; canvas.style.cursor = NIGHTSHOP.cursor(); return; }
    const w = world(G.mouse);
    G.hover = null; let pointer = false;
    const overPaper = G.mouse && (!G.ui || G.ui === 'receipt') && !G.drag && ((G.receipt && !G.receipt.fly && inR(G.mouse, receiptRect())) || (!G.ui && slipAt(G.mouse)));
    if (!G.ui && !G.drag && w && !overPaper) {
      const c = clicks().find(c => inR(w, c.r));
      if (c) { G.hover = c.r; pointer = true; } else { const s = sources().find(s => inR(w, s.r)); if (s) G.hover = s.r; }
    }
    G.tip = !G.ui && !G.drag && w && !overPaper ? bowlAt(w) : null;
    canvas.style.cursor = G.drag ? 'grabbing' : pointer ? 'pointer' : (G.hover || overPaper) ? 'grab' : 'default';
  }

  function bowlAt(w) {   // a started bowl on the mat, or a finished one in the pass / on the pickup shelf
    for (let k = 0; k < KL.bowlX.length; k++) if (G.bowls[k].s > 0 && inR(w, bowlRect(k))) return G.bowls[k];
    for (let i = 0; i < G.pass.length; i++) if (inR(w, passSlot(i)) || inR(w, pickSlot(i))) return G.pass[i];
    return null;
  }
  // A small paper tag beside the pointer: the ramen this bowl makes, then its changes from the recipe (as on a slip).
  function drawTip(g) {
    const b = G.tip;
    if (!b || !G.mouse) return;
    const INK = '#3a2f2a', FADED = '#9a8a78', lines = [];
    if (b.s === 1) lines.push([TARES[b.tare].short + ' TARE', TARES[b.tare].c === '#e6dcc4' ? INK : TARES[b.tare].c], ['NEEDS BROTH', FADED]);
    else if (b.s === 2) lines.push([TARES[b.tare].short + ' + ' + BROTHS[b.broth].short, INK], ['NEEDS NOODLES', FADED]);
    else {
      const id = identify(b);
      if (!id) lines.push(['UNKNOWN BOWL', '#c8302a']);
      else {
        lines.push([MENU[id.type].short, MENU[id.type].c]);
        const mods = ART.slipMods(id);
        for (const md of mods) lines.push([md.t, md.add ? '#2f7a3a' : '#c8302a']);
        if (!mods.length) lines.push(['AS ON THE MENU', FADED]);
      }
    }
    const w = Math.max(...lines.map(l => PX.textW(l[0]))) + 14, h = lines.length * 16 + 4;
    const x = Math.round(Math.min(VW - w - 4, G.mouse.x + 16)), y = Math.round(Math.max(4, Math.min(VH - h - 4, G.mouse.y - h - 6)));
    PX.rect(g, x + 3, y + 3, w, h, 'rgba(40,20,10,0.3)');
    PX.rect(g, x - 1, y - 1, w + 2, h + 2, PX.OUTLINE); PX.rect(g, x, y, w, h, '#fbf6ea'); PX.rect(g, x, y, w, 2, '#e8dcc0');
    lines.forEach(([t, c], i) => PX.text(g, t, x + 7, y + 11 + i * 16, c));
  }

  /* ---------- blinds: pull the red cord ---------- */
  const cordRect = i => { const c = SERVING.cordAt(i, G.stalls[i].blind); return { x: SL.X0 + c.x - 9, y: c.y - 12, w: 18, h: 26 }; };
  // Click mode: open a closed blind (taking the order if the guest is calling), or close an open one.
  function toggleBlind(i) {
    const st = G.stalls[i], gu = st.guest;
    if (st.blind > 0.5) { st.target = 0; SFX.blind(); if (gu && gu.state === 'call') gu.pendingOrder = true; else st.openT = 10; }
    else { st.target = 1; SFX.blind(); if (gu) gu.pendingOrder = false; }
  }
  function releaseCord(d) {
    const st = G.stalls[d.i], gu = st.guest;
    if (st.blind < 0.5) {
      st.target = 0; SFX.blind();
      if (gu && gu.state === 'call') gu.pendingOrder = true;   // the chat starts once the blind is fully up
      else st.openT = 10;
    } else { st.target = 1; if (gu) gu.pendingOrder = false; }
  }

  /* ---------- the open / closed sign (hangs on the serving counter) ---------- */
  const signRect = { x: SL.X0 + SL.OX + 22, y: 424, w: 128, h: 44 };
  function drawSign(g) {
    const S = signRect, cx = S.x + S.w / 2, p = clamp((G.t - G.signT) / 0.45, 0, 1);
    const state = p < 0.5 ? G.signWas : G.shop, open = state === 'open';
    const sc = Math.abs(Math.cos(p * Math.PI)), w = Math.max(2, Math.round(S.w * sc)), x = Math.round(cx - w / 2);
    const swing = Math.round(Math.sin(G.t * 2.2) * (G.shop === 'open' ? 0 : 1));
    PX.line(g, cx, S.y - 14, x + Math.round(w * 0.1), S.y + 1, PX.OUTLINE); PX.line(g, cx, S.y - 14, x + w - Math.round(w * 0.1), S.y + 1, PX.OUTLINE);
    PX.rect(g, cx - 2, S.y - 16, 4, 4, PX.OUTLINE); PX.rect(g, cx - 1, S.y - 15, 2, 2, '#c9a468');
    const y = S.y + swing;
    PX.rect(g, x - 1, y - 1, w + 2, S.h + 2, PX.OUTLINE);
    SCENE.wood(g, x, y, w, S.h, '#8a5a32', 11, false, 77);
    if (sc > 0.35) {
      const inl = open ? '#1e3a20' : '#3e1612';
      PX.rect(g, x + 6, y + 7, w - 12, S.h - 14, PX.OUTLINE); PX.rect(g, x + 7, y + 8, w - 14, S.h - 16, inl); PX.rect(g, x + 7, y + 8, w - 14, 1, PX.shade(inl, 0.6));
      PX.textC(g, open ? 'OPEN' : 'CLOSED', cx, y + 16, open ? '#a6e07a' : '#ff9a86');
    }
    if (G.shop !== 'open' && p >= 1) {
      const bob = Math.round(Math.sin(G.t * 4) * 1.5);
      SCENE.label(g, G.shop === 'night' ? 'TAP: SKIP NIGHT' : 'TAP TO OPEN', cx, S.y + S.h + 5 + bob, '#7a2f1a');
    }
  }

  /* ---------- order slips you can slide along the rail ---------- */
  const SLIP_MAX = VW - EDGE - ART.SLIP_W - 6;
  const slipClamp = x => Math.round(clamp(x, 252, SLIP_MAX));
  function freeSlipX(self) {
    for (let x = 256; x <= SLIP_MAX; x += 128) if (!G.slips.some(o => o !== self && o.x !== undefined && Math.abs(o.x - x) < 60)) return x;
    return 256 + (G.slips.length * 37) % (SLIP_MAX - 256);
  }
  function slipAt(p) {
    if (!p || slipsAlpha() <= 0.5 || G.ui) return null;
    for (let i = G.slips.length - 1; i >= 0; i--) { const s = G.slips[i]; if (s.x !== undefined && inR(p, { x: s.x - 2, y: KL.SLIP_Y - 10, w: ART.SLIP_W + 4, h: ART.slipH(s.order) + 14 })) return s; }
    return null;
  }

  /* ---------- end-of-day receipt: prints at closing, fling it away to toss it ---------- */
  function makeReceipt() {
    const s = G.stats, L = [];
    L.push({ c: 'COZY RAMEN', col: '#8a2a1a' }, { c: 'DAY ' + G.day + ' TOTAL', col: '#7a5230' }, { hr: 1 });
    const soldTypes = Object.keys(MENU).filter(k => s.sold[k] > 0);
    for (const type of soldTypes.length ? soldTypes : ['miso']) L.push({ l: MENU[type].short.split(' ')[0] + ' X' + s.sold[type], r: s.rev[type] + 'G' });
    L.push({ l: 'TIPS', r: s.tips + 'G' }, { hr: 1 }, { l: 'PROFIT', r: (s.sales + s.tips) + 'G', col: '#2f7a3a' }, { hr: 1 });
    L.push({ l: 'BOWLS SOLD', r: String(s.served) }, { l: 'PERFECT', r: String(s.perfect) }, { l: 'TURNED AWAY', r: String(s.declined) }, { hr: 1 });
    L.push({ c: 'THANK YOU!', col: '#8a2a1a' }, { c: 'FLING AWAY TO TOSS', col: '#a8987a' });
    const hx = Math.round(VW / 2 - RW / 2), hy = Math.max(36, Math.round(VH / 2 - (16 + L.length * 17 + 8) / 2));
    G.receipt = { lines: L, x: hx, y: hy, hx, hy, h: 16 + L.length * 17 + 8, t0: G.t, fly: null, px: hx, py: hy, vx: 0, vy: 0 };   // prints once it becomes the active popup
  }
  const receiptRect = () => { const r = G.receipt; return { x: r.x, y: r.y, w: RW, h: r.h }; };
  function updateReceipt(dt) {
    const r = G.receipt; if (!r) return;
    if (r.fly) {
      r.x += r.fly.vx * dt; r.y += r.fly.vy * dt; r.fly.vy += 900 * dt;
      if (r.x > VW + 40 || r.x < -RW - 40 || r.y > VH + 40 || r.y < -r.h - 60) { G.receipt = null; if (G.ui === 'receipt') G.ui = null; }
      return;
    }
    if (G.drag && G.drag.kind === 'receipt' && G.mouse) {
      r.x = G.mouse.x - G.drag.ox; r.y = G.mouse.y - G.drag.oy;
      r.vx = r.vx * 0.6 + (r.x - r.px) / Math.max(dt, 0.001) * 0.4; r.vy = r.vy * 0.6 + (r.y - r.py) / Math.max(dt, 0.001) * 0.4;
    } else { r.x += (r.hx - r.x) * Math.min(1, dt * 10); r.y += (r.hy - r.y) * Math.min(1, dt * 10); }
    r.px = r.x; r.py = r.y;
  }
  function releaseReceipt() {
    const r = G.receipt; if (!r) return;
    const dx = r.x - r.hx, dy = r.y - r.hy, dist = Math.hypot(dx, dy), speed = Math.hypot(r.vx, r.vy);
    if (dist > 80 || speed > 500) {
      const k = speed > 300 ? 1 : 900 / Math.max(1, dist);
      r.fly = { vx: speed > 300 ? r.vx : dx * k, vy: speed > 300 ? r.vy : dy * k };
      SFX.paper(); SFX.whoosh();
    } else SFX.paper();
  }
  function drawReceipt(g) {
    const r = G.receipt; if (!r || G.ui !== 'receipt') return;
    const p = clamp((G.t - r.t0) / 1.4, 0, 1), held = G.drag && G.drag.kind === 'receipt';
    const x = Math.round(r.x), y = Math.round(r.y - (1 - p) * r.h), H = r.h, DK = PX.OUTLINE;
    PX.rect(g, x + (held ? 8 : 4), y + (held ? 8 : 4), RW, H, 'rgba(25,12,10,0.3)');
    PX.rect(g, x - 1, y - 1, RW + 2, H + 1, DK);
    PX.rect(g, x, y, RW, H, '#fbf6ea'); PX.rect(g, x, y, 2, H, '#ffffff'); PX.rect(g, x + RW - 3, y, 3, H, '#ece2cc');
    for (let k = 0; k < 18; k++) PX.rect(g, x + 6 + Math.floor(SCENE.rnd(k * 7) * (RW - 20)), y + 40 + Math.floor(SCENE.rnd(k * 13) * (H - 50)), 6, 1, '#f0e6d2');   // paper fibres
    PX.rect(g, x, y, RW, 27, PAL.lacquerLo); PX.rect(g, x, y, RW, 1, PAL.lacquer); PX.rect(g, x, y + 25, RW, 2, PAL.brassLo);   // lacquer header
    PX.rect(g, x + RW / 2 - 3, y - 4, 7, 7, DK); PX.rect(g, x + RW / 2 - 2, y - 3, 5, 5, PAL.brass); PX.rect(g, x + RW / 2 - 2, y - 3, 2, 2, PAL.brassHi);   // brass pin
    for (let k = 0; k < RW; k += 8) { PX.poly(g, [[x + k - 1, y + H], [x + k + 9, y + H], [x + k + 4, y + H + 5]], DK); PX.poly(g, [[x + k, y + H - 1], [x + k + 8, y + H - 1], [x + k + 4, y + H + 3]], '#fbf6ea'); }
    r.lines.forEach((L, i) => {
      const ly = y + 14 + i * 17;
      if (L.hr) { for (let k = x + 8; k < x + RW - 8; k += 4) PX.rect(g, k, ly + 4, 2, 1, '#c9b892'); return; }
      if (i === 0 && L.c) return PX.textC(g, L.c, x + RW / 2, ly - 4, PAL.cream);   // shop name sits on the header
      if (L.c) return PX.textC(g, L.c, x + RW / 2, ly, L.col || '#4a3226');
      PX.text(g, L.l, x + 10, ly, L.col || '#4a3226');
      PX.text(g, L.r, x + RW - 10 - PX.textW(L.r), ly, L.col || '#4a3226');
    });
  }

  /* ---------- render ---------- */
  // How far held noodles lean: they trail behind the hand, with a little idle sway.
  const swing = () => clamp(-(G.mvx || 0) / 700, -0.8, 0.8) + Math.sin(G.t * 3) * 0.06;
  function drawHeld(g, d, x, y) {
    if (d.kind === 'tare') KITCHEN.spoon(g, x - 4, y + 6, true, TARES[d.type].c);
    else if (d.kind === 'broth') { const b = BROTHS[d.type]; KITCHEN.ladle(g, x - 6, y + 10, true, G.t, [b.c, b.dark, b.light]); }
    else if (d.kind === 'basket') KITCHEN.heldBasket(g, x, y, G.t, swing());
    else if (d.kind === 'nest') KITCHEN.heldNest(g, x, y, G.t, swing());
    else if (d.kind === 'top') { PX.ell(g, x + 3, y + 14, 10, 3, 'rgba(40,20,10,0.25)'); ART.top(g, d.id, x, y); }
    else if (d.kind === 'bowl') { if (d.pass || G.cam < 480) ART.smallBowl(g, x, y - 6, d.bowl); else ART.bigBowl(g, x, y - 10, d.bowl, false, G.t); }
  }
  function render() {
    const cam = Math.round(G.cam);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VW, VH);
    if (G.where) { NIGHTSHOP.draw(ctx); if (G.ui === 'receipt' && G.receipt) { ctx.fillStyle = 'rgba(14,8,20,0.55)'; ctx.fillRect(0, 0, VW, VH); drawReceipt(ctx); } return; }
    ctx.save(); ctx.translate(-cam, 0);
    if (cam < SL.X0 + SL.W) { ctx.save(); ctx.translate(SL.X0, 0); SERVING.frame(ctx, G); ctx.restore(); }
    if (cam + VW > KL.X0) { ctx.save(); ctx.translate(KL.X0, 0); KITCHEN.frame(ctx, G); ctx.restore(); }
    drawSign(ctx);
    const w = world(G.mouse);
    if (G.drag) {
      const pulse = 0.5 + 0.5 * Math.sin(G.t * 8);
      for (const t of targets(G.drag)) if (t.ok()) SCENE.brackets(ctx, t.r, inR(w, t.r) ? '#ffffff' : PX.mix('#ffd76a', '#fff6d0', pulse), inR(w, t.r));
    } else if (G.hover) SCENE.brackets(ctx, G.hover);
    for (const p of G.parts) SCENE.part(ctx, p);
    for (const p of G.pops) { ctx.globalAlpha = Math.min(1, p.life * 2.5); PX.textC(ctx, p.str, p.x, Math.round(p.y), p.c, PX.OUTLINE); }
    ctx.globalAlpha = 1;
    if (G.drag && w) drawHeld(ctx, G.drag, Math.round(w.x), Math.round(w.y));
    ctx.restore();
    // ticket rail (toppings and kitchen)
    const a = slipsAlpha();
    if (a > 0.01) {
      ctx.globalAlpha = a;
      if (!G.slips.length) PX.textC(ctx, 'NO ORDERS YET', 560, 70, '#b7ab90');
      G.slips.forEach(s => {
        if (s.x === undefined) s.x = freeSlipX(s);
        const held = G.drag && G.drag.kind === 'slip' && G.drag.slip === s;
        const drop = Math.round((1 - Math.min(1, s.age / 0.3)) * -60), since = G.t - (s.settle === undefined ? -9 : s.settle);
        let sway = s.age < 1 ? Math.round(Math.sin(s.age * 14) * (1 - s.age) * 4) : 0;
        if (since < 0.8) sway += Math.round(Math.sin(since * 16) * (1 - since / 0.8) * 3);
        const x = held && G.mouse ? slipClamp(G.mouse.x - G.drag.ox) : s.x;
        if (held) PX.rect(ctx, x + 7, KL.SLIP_Y + 4, ART.SLIP_W, ART.slipH(s.order), 'rgba(30,15,10,0.25)');
        ART.slip(ctx, x + sway, KL.SLIP_Y + drop - (held ? 6 : 0), { num: s.num, stall: s.guest.stall, order: s.order });
      });
      ctx.globalAlpha = 1;
    }
    if (G.ui === 'receipt' && G.receipt) { const p = G.receipt.fly ? Math.max(0, 1 - Math.hypot(G.receipt.x - G.receipt.hx, G.receipt.y - G.receipt.hy) / 400) : 1; ctx.fillStyle = `rgba(14,8,20,${0.55 * p})`; ctx.fillRect(0, 0, VW, VH); }
    drawReceipt(ctx);
    // edge arrows
    for (const side of [-1, 1]) {
      const ni = G.st + side;
      if (ni < 0 || ni >= STATIONS.length || G.ui) continue;
      // a round walnut-and-brass button; the station name shows on a tag only while the edge is hovered
      const hot = G.edgeSide === side;
      if (hot) for (let k = 0; k < EDGE; k += 2) { ctx.globalAlpha = 0.3 * (1 - k / EDGE); ctx.fillStyle = '#2a1a26'; ctx.fillRect(side < 0 ? k : VW - k - 2, 0, 2, VH); }
      const cx = side < 0 ? 20 : VW - 20, cy = VH / 2, bob = hot ? Math.round(Math.sin(G.t * 8) * 1.5) * side : 0;
      ctx.globalAlpha = hot ? 1 : 0.8;
      PX.ell(ctx, cx, cy + 2, 13, 13, 'rgba(20,8,12,0.45)');
      PX.ell(ctx, cx, cy, 13, 13, PX.OUTLINE); PX.ell(ctx, cx, cy, 12, 12, hot ? '#ffe08a' : '#e0b040'); PX.ell(ctx, cx, cy, 10, 10, '#5a3a22'); PX.ell(ctx, cx, cy - 2, 8, 6, '#7a5230');
      const ax = cx + bob;
      PX.poly(ctx, side < 0 ? [[ax + 4, cy - 7], [ax - 5, cy], [ax + 4, cy + 7]] : [[ax - 4, cy - 7], [ax + 5, cy], [ax - 4, cy + 7]], '#f6e6c0');
      ctx.globalAlpha = 1;
      if (hot) { const name = STATIONS[ni].name.toUpperCase(), w = PX.textW(name) + 12; SCENE.label(ctx, name, side < 0 ? cx + 18 + w / 2 : cx - 18 - w / 2, cy - 7); }
    }
    drawTip(ctx);
    NIGHTSHOP.draw(ctx);   // only the fade, while heading out to the street
  }

  /* ---------- layout + loop ---------- */
  function fit() {
    let cs = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    if (SETTINGS.snap && cs >= 2) cs = Math.floor(cs);   // fill the window; snap to whole pixels only when there is room for 2x+
    document.documentElement.style.setProperty('--s', cs * 2);
  }
  window.addEventListener('resize', fit); fit();

  let prev = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
    if (G.mode === 'title') { TITLE.update(dt); TITLE.draw(ctx); }
    else {
      update(dt); hud(dt); render();
      if (G.ui === 'pause') { TITLE.update(dt); TITLE.draw(ctx); }
    }
    requestAnimationFrame(loop);
  }

  updateClock(0);

  /* ---------- title screen, new game, continue, pause ---------- */
  function enterTitle() {
    NIGHTSHOP.closePanels(); G.where = null; if (rainGain) rainGain.gain.value = 0;
    G.mode = 'title'; G.ui = null; G.drag = null; G.dragBowl = null; G.paused = false;
    for (const id of ['dialog', 'modal', 'menu']) $(id).classList.remove('show');
    for (const id in BOOKS) if (G.ui === id) closeBook(id);
    document.body.classList.add('title'); TITLE.enter(); music(true);
  }
  function startPlay(msg) {
    G.mode = 'play'; music(false); document.body.classList.remove('title');
    for (let i = 0; i < SL.NSTALL; i++) { $('bubble-' + i).classList.remove('show'); bubbleT[i] = 0; }
    STATIONS.forEach((s, k) => $('tab-' + s.id).classList.toggle('on', k === G.st));
    updateClock(0); canvas.style.cursor = 'default';
    toast(msg);
  }
  function newGame() { clearSave(); NIGHTSHOP.closePanels(); Object.assign(G, fresh()); startPlay('Welcome to Cozy Ramen! Tap the CLOSED sign on the counter to open.'); }
  function continueGame() {
    const s = loadSave(); if (!s) return newGame();
    Object.assign(G, fresh()); G.day = s.day; G.gold = s.gold || 0; G.met = s.met || []; G.nextNum = s.nextNum || 1;
    G.level = s.level || 1; G.xp = s.xp || 0; G.owned = (s.owned || []).filter(id => nodeFor(id));
    G.life = Object.assign(fresh().life, s.life || {}); G.region = regionOpen(s.region || 0) ? s.region || 0 : 0;
    // saves from before the night shop: upgrades already claimed (and paid for) on the road count as bought
    G.gear = (s.gear || G.owned.filter(id => GEAR.includes(id))).filter(id => GEAR.includes(id));
    if (s.pantry) for (const id in s.pantry) if (id in G.stock) G.stock[id] += (s.pantry[id] || 0) * STOCK[id].add;   // saves from the pantry days: packs go in the bins
    G.aoiMet = !!s.aoiMet;
    G.quest = s.quest && s.quest.day === s.day ? s.quest : null;
    unlockReached();   // older saves: stops that were waiting on an objective unlock now
    const st = { ...(s.stock || {}) };
    if ('tare' in st) { st[tareKey('miso')] = st.tare; delete st.tare; }
    if ('broth' in st) { st[brothKey('pork')] = st.broth; delete st.broth; }
    for (const id in st) if (id in G.stock) G.stock[id] = st[id];
    startPlay('Day ' + G.day + '. Good morning! Flip the sign when you are ready to open.');
  }
  function openPause() { G.ui = 'pause'; G.drag = null; G.dragBowl = null; TITLE.openPause(); }
  function applySettings() { saveSettings(); fit(); if (mgain) mgain.gain.value = muted ? 0 : SETTINGS.music / 10 * 0.6; }
  function toggleFullscreen() {
    try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { /* not supported */ }
  }
  TITLE.init({
    IMG, settings: SETTINGS, applySettings, toggleFullscreen,
    openGuests: () => openUI('guests'),
    saveInfo: loadSave, met: () => { const s = G.mode === 'play' ? null : loadSave(); return G.mode === 'play' ? G.met : (s && s.met) || []; },
    onContinue: continueGame, onNew: newGame, onResume: () => { G.ui = null; }, onQuit: enterTitle,
    startMusic: () => { if (G.mode === 'title') music(true); if (actx && actx.state === 'suspended') actx.resume(); },
    cursor: c => { canvas.style.cursor = c; },
    sfx: {
      move: () => tone(660, 0.04, 'square', 0.025), back: () => tone(520, 0.08, 'triangle', 0.05, 330), page: () => SFX.paper(), bad: () => SFX.bad(),
      ok: () => { tone(880, 0.06, 'triangle', 0.06); tone(1320, 0.1, 'triangle', 0.05, 0, 0.05); }
    }
  });

  // ?shot=kitchen|toppings|serving|dialog|night|drag sets up a scene for screenshots
  function shot(kind) {
    $('modal').classList.remove('show'); G.paused = false; G.ui = null; G.shop = 'open'; G.mode = 'play'; document.body.classList.remove('title');
    if (kind === 'night' || kind === 'nightkitchen') G.time = PHASE * 1.3;
    if (kind.includes('rain')) { G.wx = { day: G.day, from: -1, to: -1 }; G.forceRain = 1; G.rain = 1; }
    updateClock(0);
    const full = { ...newBowl(), s: 3, tare: true, broth: true, fill: 1, noodles: 'perfect', items: ['chashu', 'egg', 'nori', 'scallion', 'menma', 'chili'], age: 1 };
    for (let i = 0; i < 4; i++) {
      const gu = seatGuest(i); gu.state = 'wait'; gu.t = 5;
      gu.order = makeOrder(gu.gt); gu.num = G.nextNum++; G.slips.push({ num: gu.num, guest: gu, order: gu.order, age: 1 });
    }
    const g1 = G.stalls[1].guest; g1.state = 'eat'; g1.q = 1; g1.pay = 16; g1.keepOpen = true; G.stalls[1].bowl = { ...full }; G.stalls[1].blind = 0; G.stalls[1].target = 0;
    G.slips = G.slips.filter(s => s.guest !== g1);
    const g3 = G.stalls[3].guest; g3.state = 'call'; G.slips = G.slips.filter(s => s.guest !== g3); g3.order = null;
    G.pass.push({ ...full }, { ...full, items: ['chashu', 'egg', 'nori', 'scallion', 'menma'] });
    G.bowls[0] = { ...full, items: ['chashu', 'egg', 'nori'] };
    G.bowls[1] = { ...newBowl(), s: 2, tare: true, broth: true, fill: 1, age: 1 };
    G.baskets[0].t = 9; G.baskets[2].t = 2;
    G.waiting = 1;
    const at = Math.max(0, STATIONS.findIndex(s => s.id === ({ servingleft: 'serving', dialog: 'serving', night: 'serving', drag: 'kitchen', toppings: 'kitchen', nightkitchen: 'kitchen', rainkitchen: 'kitchen' }[kind] || kind)));
    G.kcam = kind === 'kitchen' || kind === 'nightkitchen' ? STATIONS[1].camMax : STATIONS[1].cam;
    G.scam = kind === 'servingleft' ? STATIONS[0].cam : 0;   // ?shot=servingleft: the far end of the serving room
    G.st = at; G.cam = camTarget(); STATIONS.forEach((s, k) => $('tab-' + s.id).classList.toggle('on', k === at));
    if (kind === 'dialog') { g3.asksRec = true; takeOrder(g3); DLG.i = 1; showStep(); DLG.chars = 999; revealChoices(); }
    if (kind === 'drag') { G.drag = { kind: 'top', id: 'chashu' }; G.mouse = { x: K(KL.bowlX[0]) - G.cam + 10, y: KL.BOWL_Y - 8 }; }
    if (kind.startsWith('book')) { COOKBOOK.goToSpread(+kind.slice(4) || 0); openBook('book', 'counter', true); }   // ?shot=book, book1, book2 ... (spread)
    if (kind === 'guests') openBook('guests', null, true);
    if (kind.startsWith('street') || kind.startsWith('store')) {   // ?shot=street, store, store1..store3 (panned), storecard, storetalk
      G.stalls.forEach(st => { st.guest = null; }); G.slips = []; G.shop = 'night'; G.time = PHASE * 1.08; G.receipt = null; G.gold = 140; updateClock(0);
      G.owned = kind === 'store3' ? STOPS.filter(n => n.kind !== 'start').map(n => n.id) : ['spicy', 'quick']; KITCHEN.refresh();
      NIGHTSHOP.visit(kind.startsWith('street') ? 'street' : 'store', (+kind.slice(5) || 0) * 640);
      if (kind === 'storecard') NIGHTSHOP.inspect('chashu');
      if (kind === 'storelist') NIGHTSHOP.talk('list');
      if (kind === 'streetdawn') { G.time = 256; updateClock(0); }
      if (kind === 'storetalk') { NIGHTSHOP.addToBasket('chashu', 3); NIGHTSHOP.addToBasket('special', 1); NIGHTSHOP.addToBasket('quick', 1); NIGHTSHOP.talk('checkout'); }
    }
    if (kind.startsWith('road')) {   // ?shot=road, road2 (Kyoto, with progress), road4 (the coast)
      const lv = { road: 3, road2: 6, road4: 12 }[kind] || 3, upto = { road: 2, road2: 6, road4: 17 }[kind] || 2;
      G.level = lv; G.xp = LEVEL_XP[lv - 1] + 20; G.gold = 260; G.owned = STOPS.slice(1, upto).map(n => n.id); G.gear = G.owned.filter(id => GEAR.includes(id));
      G.life = { served: 30, perfect: 30, sold: { miso: 9, shoyu: 4 }, bestDay: 90, days: 3 }; G.met = GUESTS.slice(0, 12).map(g => g.id);
      G.region = STOPS[Math.max(0, upto - 1)].region; KITCHEN.refresh(); openUI('road');
    }
  }
  Promise.all([PX.loadFont(), ...Object.values(IMG).map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; }))]).then(() => {
    if (params.has('shot')) shot(params.get('shot')); else enterTitle();
    requestAnimationFrame(loop);
  });
})();
