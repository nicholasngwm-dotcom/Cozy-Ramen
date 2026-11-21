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
  if (params.has('facetool')) return FACETOOL.start();   // index.html?facetool: the dev page for guest face anchors (js/facetool.js)

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

  const newBowl = () => ({ s: 0, tare: false, broth: false, fill: 0, noodles: null, nHide: false, items: [], itemT: [], hide: {}, age: 0, fx: {} });   // fx: special steps (see "special steps")
  const zeroes = () => Object.fromEntries(Object.keys(MENU).map(k => [k, 0]));
  const newStats = () => ({ served: 0, perfect: 0, earned: 0, sales: 0, tips: 0, declined: 0, sold: zeroes(), rev: zeroes() });
  const fresh = () => ({
    menu: ['miso'], pick: 'miso',   // the menu the shop sells from (in order), and the chef's pick
    mode: 'title', met: [], aff: {}, level: 1, xp: 0, owned: [], gear: [], where: null, aoiMet: false, region: 0,
    aoi: { seen: 0, visit: 0, buy: 0, chat: 0, notes: 0 }, aoiDay: 0,   // Aoi's story (js/aoi.js): scenes seen, tonight's markers, notes left; the day she last ate here life: { served: 0, perfect: 0, sold: {}, bestDay: 0, days: 0 },
    t: 0, time: 0, day: 1, gold: 0, paused: false, ui: null, nightF: 0, duskF: 0, rain: 0, wx: null, quest: null,
    shop: 'morning', signT: -9, signWas: 'morning', receipt: null,   // shop: morning (closed, waiting for the sign) | open | night
    st: 0, cam: -960, kcam: 960, scam: -960, pan: 0, edge: 0, edgeSide: 0,   // the serving room starts at its far left
    stalls: Array.from({ length: SL.NSTALL }, () => ({ guest: null, bowl: null, blind: 1 })),   // the stalls; blind: 1 = down, 0 = rolled up
    walkers: [], ticketZoom: -1,   // guests fading out of their stalls; a ticket shown big
    activeBowl: null, flying: [], hold: null, lvQueue: [],   // lvQueue: level-ups waiting for their celebration popup   // the bowl clicks go into (null: chosen for you); items in flight; a hold step under way
    waiting: 0, spawnT: 3, seatCD: 0, nextNum: 1,
    slips: [], pass: [], bowls: [newBowl(), newBowl()],
    baskets: [0, 1, 2].map(() => ({ t: -1 })),
    ice: 0,   // chilled noodle nests waiting in the ice bath (for cold ramen)
    // enough for the first day (then Kitsune-ya); every topping starts with a little, so a newly unlocked one is ready
    stock: { noodle: 16, ...Object.fromEntries([...Object.keys(TARES).map(tareKey), ...Object.keys(BROTHS).map(brothKey)].map(id => [id, 16])),
             ...Object.fromEntries(TOPS.map(id => [id, 6])), [CHILI_OIL]: 10, chashu: 14, egg: 14, nori: 14, scallion: 14, menma: 14, cockegg: 2 },
    jobs: [], parts: [], pops: [],
    drag: null, dragBowl: null, mouse: null, hover: null,
    flash: '', flashT: 0, steamT: 0, stats: newStats(),
    tut: null, tutGu: null, tutPulse: null   // Aoi's tutorial (js/tutorial.js): its saved progress, the guided bowl's guest, a ticket to pulse
  });
  const G = fresh();
  window.G = G;

  /* ---------- settings (saved right away) and the day save (at opening and closing) ---------- */
  const SETTINGS_KEY = 'cozyRamen.settings', SAVE_KEY = 'cozyRamen.save.v1';
  const SETTINGS = Object.assign({ music: 6, sfx: 8, textSpeed: 1, snap: true, hints: false, reduceMotion: false }, (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; } })());
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(SETTINGS)); } catch (e) { /* storage may be blocked */ } }
  if ('blindClick' in SETTINGS) { delete SETTINGS.blindClick; saveSettings(); }   // an old setting: the blinds now move by themselves
  // Hints are on for days 1-3 of a new save, then off, unless the player set them (hintsUser). Hints already turned on
  // before this rule count as the player's choice.
  if (SETTINGS.hints && !('hintsUser' in SETTINGS)) { SETTINGS.hintsUser = true; saveSettings(); }
  const hintsOn = () => (SETTINGS.hintsUser ? !!SETTINGS.hints : !!(G.mode === 'play' && G.tut && G.tut.fresh && G.day <= 3));
  // (night: the title shows the night scene for a save made after closing)
  // Continue always resumes at the start of a morning: `day` is the morning to resume on.
  // (nothing saves during Aoi's handover: it is not a real day)
  function saveGame(day) { if (G.tut && G.tut.handover) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify({ day, gold: G.gold, stock: G.stock, met: G.met, aff: G.aff, nextNum: G.nextNum, level: G.level, xp: G.xp, owned: G.owned, quest: G.quest, gear: G.gear, aoiMet: G.aoiMet, aoi: G.aoi, region: G.region, life: G.life, menu: G.menu, pick: G.pick, night: G.shop === 'night', tut: TUT.saveData() })); } catch (e) { /* storage may be blocked */ } }
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
    if (gu.gt.id === 'aoi') { const a = AOI.stall(key); if (a) return a; }   // Aoi warms up as her hearts grow
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
    fanfare: () => {   // a bright little level-up fanfare: a rising arpeggio, then a held chord with a sparkle on top
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'square', 0.045, 0, i * 0.09));
      [1046, 1318, 1568].forEach(f => tone(f, 0.7, 'triangle', 0.045, 0, 0.42));
      tone(523, 0.7, 'square', 0.03, 0, 0.42); tone(392, 0.7, 'triangle', 0.04, 0, 0.42);
      [2093, 2637, 3136, 2637, 3520].forEach((f, i) => tone(f, 0.06, 'sine', 0.025, 0, 0.6 + i * 0.07));
      noise(0.5, 6000, 0.05, 0.42);
    },
    ding: () => { tone(880, 0.12, 'triangle', 0.07); tone(1320, 0.2, 'triangle', 0.07, 0, 0.1); },
    coin: () => { tone(988, 0.07, 'square', 0.04); tone(1319, 0.16, 'square', 0.04, 0, 0.07); },
    bell: () => { tone(1046, 0.25, 'sine', 0.05); tone(1568, 0.35, 'sine', 0.04, 0, 0.08); },
    whoosh: () => tone(300, 0.18, 'triangle', 0.04, 700),
    // a sudare bamboo blind: the cord's soft zip, the slats clattering as they wind (or unwind), a wooden knock as it stops
    blindUp: () => { tone(300, 0.14, 'triangle', 0.03, 520); for (let i = 0; i < 12; i++) noise(0.022, 2100 + (i % 3) * 450, 0.26, 0.05 + i * 0.066); noise(0.06, 420, 0.55, 0.9); tone(150, 0.08, 'sine', 0.06, 95, 0.9); },
    blindDown: () => { tone(480, 0.12, 'triangle', 0.025, 300); for (let i = 0; i < 12; i++) noise(0.022, 2700 - (i % 3) * 450, 0.22, 0.04 + i * 0.066); noise(0.08, 300, 0.6, 0.88); tone(120, 0.1, 'sine', 0.07, 80, 0.88); },
    stool: () => { tone(230, 0.07, 'triangle', 0.03, 170); noise(0.05, 520, 0.22, 0.02); },   // a guest settling onto a wooden stool
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
    // the staff door: latch, a hinge creak while it swings, a locked rattle; the shop front's double sliding doors
    latch: () => { tone(1100, 0.025, 'square', 0.035); noise(0.03, 2600, 0.35, 0.01); },
    creak: () => { tone(170, 0.32, 'sawtooth', 0.016, 250, 0.06); tone(240, 0.22, 'sawtooth', 0.012, 190, 0.34); tone(205, 0.16, 'sawtooth', 0.01, 230, 0.52); },
    rattle: () => { for (let i = 0; i < 4; i++) { noise(0.03, 900, 0.5, i * 0.07); tone(150, 0.03, 'square', 0.025, 0, i * 0.07); } },
    stamp: () => { noise(0.05, 260, 0.8); tone(95, 0.09, 'sine', 0.09, 60); },
    rumble: () => { noise(0.36, 420, 0.34); noise(0.3, 900, 0.12, 0.03); noise(0.05, 1300, 0.32, 0.36); tone(130, 0.06, 'square', 0.03, 0, 0.37); },
    blip: pitch => tone((pitch || 620) * (0.94 + Math.random() * 0.12), 0.03, 'square', 0.015)
  };

  /* ---------- feedback helpers ---------- */
  function say(msg) { if (TUT.gentle(msg)) return; G.flash = msg; G.flashT = 2.8; SFX.bad(); }   // (during Aoi's guided bowl: a gentle note instead)
  const pop = (str, x, y, c = '#ffd76a') => G.pops.push({ str, x, y, c, life: 1.2 });
  const spark = (x, y, n, c) => { for (let i = 0; i < n; i++) G.parts.push({ type: 'spark', c, x: x + rand(-20, 20), y: y + rand(-14, 14), vx: rand(-24, 24), vy: rand(-52, -16), life: rand(0.4, 0.9), max: 0.9 }); };
  const splash = (x, y, c, n = 10) => { for (let i = 0; i < n; i++) G.parts.push({ type: 'drop', c, x: x + rand(-24, 24), y: y + rand(-4, 4), vx: rand(-50, 50), vy: rand(-90, -30), life: 0.5, max: 0.5 }); };
  const hearts = (x, y, n) => { for (let i = 0; i < n; i++) G.parts.push({ type: 'heart', x: x + rand(-32, 32), y: y + rand(-12, 12), vx: 0, vy: rand(-36, -16), life: rand(0.8, 1.3), max: 1.3 }); };
  const bubbleT = {};
  function bubble(i, msg) { const el = $('bubble-' + i); el.textContent = msg; el.classList.add('show'); bubbleT[i] = 3.4; }
  let toastT = 0;
  function toast(msg, t = 3.5) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); toastT = t; }
  // Aoi's story (js/aoi.js): a new heart chimes and says so; hearts float up when you are in the shop
  AOI.init({ toast: m => toast(m, 6), ding: () => SFX.ding(), hearts: () => { if (!G.where) hearts(VW / 2 + G.cam, 140, 10); }, save: () => saveGame(G.shop === 'night' ? G.day + 1 : G.day) });

  /* ---------- stations ---------- */
  function go(i) {
    i = clamp(i, 0, STATIONS.length - 1);
    if (i === G.st) return;
    G.st = i; G.rmMenu = null; SFX.whoosh();
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
  const binRect = k => { const b = KL.bin(k); return { x: K(b.x) - 2, y: b.y - 3, w: b.w + 4, h: b.h + 6 }; };
  const binOf = id => rackTops().indexOf(id);   // which rack bin holds a topping (-1: not on the rack today)
  const oilRect = { x: K(KL.OIL.cx) - 14, y: KL.OIL.by - 58, w: 28, h: 62 };
  const iceRect = { x: K(KL.ICE.cx) - KL.ICE.rx - 6, y: KL.ICE.cy - 30, w: 2 * KL.ICE.rx + 12, h: 76 };
  const tareRect = i => { const t = KL.tare(i); return { x: K(t.cx) - 22, y: t.y - 30, w: 44, h: 86 }; };
  const potRect = i => { const p = KL.pot(i); return { x: K(p.cx) - p.rx - 4, y: p.cy - 50, w: 2 * p.rx + 8, h: 112 }; };
  const noodleRect = { x: K(KL.NOODLE.x), y: KL.NOODLE.y, w: KL.NOODLE.w, h: KL.NOODLE.h };
  const lockedSay = node => { const n = nodeFor(node); say('Unlocks on the ' + ROAD_NAME + ' at ' + (n ? n.place + ', level ' + n.level : 'a later stop') + '.'); };
  const passRect = { x: K(KL.PASS.x), y: KL.PASS.y, w: KL.PASS.w, h: KL.PASS.h };
  const passSlot = i => { const [x, y] = KL.passPos(i); return { x: K(x) - 32, y: y - 14, w: 64, h: 40 }; };
  // The tray you carry into the serving room: fixed to the bottom of the screen, bowls in a row (screen coords + cam).
  const TRAY = { x: 330, y: 470, w: 300, h: 40 };
  const carrying = () => !G.where && G.cam < 480;
  const trayPos = i => [TRAY.x + 46 + i * 70, TRAY.y + 14];
  const pickSlot = i => { if (!carrying()) return { x: -9999, y: 0, w: 0, h: 0 }; const [x, y] = trayPos(i); return { x: G.cam + x - 32, y: y - 26, w: 64, h: 44 }; };
  const doorRect = { x: SL.X0 + SL.DOOR.x - 6, y: SL.DOOR.y - 36, w: SL.DOOR.w + 12, h: SL.DOOR.h + 36 };   // the staff door
  // the staff door: locked while the shop is open (it rattles); after closing it swings open onto the night street
  function openStaffDoor() {
    if (!NIGHTSHOP.streetOpen()) { G.doorShake = 0.32; SFX.rattle(); return NIGHTSHOP.enter('street'); }
    if (G.staffT) return;
    G.staffT = 1; SFX.latch(); SFX.creak();
    setTimeout(() => NIGHTSHOP.enter('street'), 560);
  }
  const lockedStall = i => { const n = nodeFor('stall' + (i + 1)); say(owns(n.id) ? 'Seat ' + (i + 1) + ' is on sale at Kitsune-ya (' + n.cost + 'G).' : 'Seat ' + (i + 1) + ' unlocks on the ' + ROAD_NAME + ' at ' + n.place + ', level ' + n.level + '.'); };
  const seatRect = i => SERVING.seatRect(i);       // a seated guest and their bit of counter
  const dropRect = i => SERVING.dropRect(i);       // where a bowl can be dropped for that seat (guest, counter, ticket)
  const trashRect = { x: K(KL.TRASH.x) - 6, y: KL.TRASH.y - 6, w: KL.TRASH.w + 12, h: KL.TRASH.h + 12 };
  const coinRect = i => ({ x: SL.X0 + SL.stallCX(i) + 22, y: SL.COUNTER_Y - 26, w: 36, h: 30 });   // a paid guest's coins on the counter
  const bookRect = { x: K(KL.BOOK.x) - 4, y: KL.BOOK.y - 4, w: KL.BOOK.w + 8, h: KL.BOOK.h + 30 };     // the cookbook lying open on the kitchen counter
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
      if (b.t < 0) return say('Click the noodle tray above (or drag a nest) to fill a basket.');
      if (b.t < cookTime()) return say('Still cooking. They will be ready in a moment.');
      return { kind: 'basket', j };
    } }));
    rackTops().forEach((id, k) => s.push({ r: binRect(k), binId: id, start: () => !topOn(id) ? lockedSay(TOP_NODE[id]) : G.stock[id] > 0 ? { kind: 'top', id } : say('Out of ' + TOP_NAME[id].toLowerCase() + '. Kitsune-ya sells more after closing.') }));
    // the chili oil bottle: makes a bowl's broth spicy
    s.push({ r: oilRect, start: () => !chiliOilOn() ? lockedSay('spicy') : G.stock[CHILI_OIL] > 0 ? { kind: 'oil' } : say('Out of chili oil. Kitsune-ya sells more.') });
    // the ice bath (cold ramen): chilled nests come out like a READY basket; with none chilled, a click chills one
    if (iceOn()) s.push({ r: iceRect, ice: true, start: () => G.ice > 0 ? { kind: 'cold' } : { kind: 'chill' } });
    KL.bowlX.forEach((bx, k) => s.push({ r: bowlRect(k), start: () => G.bowls[k].s > 0 ? { kind: 'bowl', bowl: G.bowls[k], spot: k } : null }));
    G.pass.forEach((b, i) => {
      s.push({ r: passSlot(i), start: () => ({ kind: 'bowl', bowl: b, pass: true }) });
      s.push({ r: pickSlot(i), start: () => ({ kind: 'bowl', bowl: b, pass: true }) });
    });
    return s;
  }

  // Where a held item can go. ok() = would be accepted (for highlights); drop() does it or explains why not.
  function targets(d) {
    const t = [];
    if (d.kind === 'nest') KL.basketX.forEach((_, j) => t.push({ r: basketRect(j), ok: () => G.baskets[j].t < 0, drop: () => nestInto(j) }));
    if (['tare', 'broth', 'basket', 'top', 'cold', 'oil'].includes(d.kind)) KL.bowlX.forEach((bx, k) => t.push({ r: bowlRect(k), ok: () => accepts(G.bowls[k], d), drop: () => addTo(G.bowls[k], k, d) }));
    if (d.kind === 'basket' && iceOn()) t.push({ r: iceRect, ok: () => G.ice < ICE_MAX, drop: () => chill(d.j) });
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
        if (G.pass.length >= MAX_PASS) return say('The tray is full. Serve a few bowls first.');
        takeBowl(d); d.bowl.age = 0; G.pass.push(d.bowl); SFX.drop(); SFX.bell(); pop('ORDER UP', K(KL.PASS.x) + 83, KL.PASS.y + 150, '#b6e37a');
      };
      t.push({ r: passRect, ok: canPass, drop: toPass });
      for (let i = 0; i < SL.NSTALL; i++) if (stallOpen(i)) t.push({ r: dropRect(i), ok: () => { const gu = G.stalls[i].guest; return gu && gu.state === 'wait' && d.bowl.s >= 3; }, drop: () => serve(i, d) });
      t.push({ r: trashRect, ok: () => true, drop: () => { takeBowl(d); SFX.drop(); pop('BINNED', K(KL.TRASH.x) + 23, KL.TRASH.y - 10, '#c9d1dd'); } });
    }
    return t;
  }
  function nestInto(j) {
    if (G.baskets[j].t >= 0) return say('That basket is busy. Try an empty one.');
    if (G.stock.noodle <= 0) return say('Out of noodles. Kitsune-ya sells more after closing.');
    G.stock.noodle--; G.baskets[j].t = 0; SFX.drop(); splash(K(KL.basketX[j]), KL.BOIL.cy - 4, '#bfe6f2', 8);
  }
  /* The ice bath, for cold ramen (Frostleaf Hiyashi): a READY basket rinsed in it leaves a chilled nest in the ice,
     which then goes into a bowl like noodles from a basket. Hot noodles in a cold ramen (or cold ones in a hot ramen)
     cost the bowl its "perfect". It is there once a cold recipe is learned. */
  const ICE_MAX = 2;
  function chill(j) {
    const b = G.baskets[j];
    if (!b || b.t < cookTime()) return say('Only READY noodles go into the ice bath.');
    if (G.ice >= ICE_MAX) return say('The ice bath is full. Put the chilled noodles into a bowl first.');
    b.t = -1; G.ice++; SFX.pour(); splash(K(KL.ICE.cx), KL.ICE.cy - 4, '#d8f4ff', 10); tone(1560, 0.05, 'triangle', 0.04, 0, 0.1); tone(1880, 0.05, 'triangle', 0.035, 0, 0.18);
  }
  // A click on the ice bath with nothing chilled yet: the oldest READY basket goes in (flies there first).
  function chillReady() {
    if (G.ice >= ICE_MAX) return say('The ice bath is full. Put the chilled noodles into a bowl first.');
    const j = G.baskets.findIndex(b => b.t >= cookTime());
    if (j < 0) return say('The ice bath chills READY noodles. Cook a basket first.');
    const d = { kind: 'chillfly', j }; d.t0 = G.baskets[j].t; G.baskets[j].t = -1;
    G.flying.push({ d, from: [K(KL.basketX[j]), KL.BOIL.cy - 30], to: [K(KL.ICE.cx), KL.ICE.cy - 6], t: 0, dur: 0.34 }); SFX.pick();
  }
  function takeBowl(d) {   // remove the dragged bowl from where it came from
    if (d.pass) G.pass = G.pass.filter(b => b !== d.bowl);
    else if (d.spot !== undefined && G.bowls[d.spot] === d.bowl) { G.bowls[d.spot] = newBowl(); if (G.activeBowl === d.spot) G.activeBowl = null; }
  }
  function accepts(b, d) {
    if (d.kind === 'tare') return b.s === 0;
    if (d.kind === 'broth') return b.s === 1 && recipesFor(b.tare, d.type).length > 0;
    if (d.kind === 'basket' || d.kind === 'cold') return b.s === 2;
    if (d.kind === 'oil') return b.s >= 2 && !b.spicy && recipesFor(b.tare, b.broth).some(k => MENU[k].spicy);
    if (d.kind === 'top') return b.s >= 3 && b.items.filter(x => x === d.id).length < 2 && toppingOk(b, d.id);
    return false;
  }
  function addTo(b, k, d) {
    const bx = K(KL.bowlX[k]), by = KL.BOWL_Y;
    if (d.kind === 'tare') {
      if (b.s > 0) return say('This bowl already has its tare.');
      G.stock[tareKey(d.type)]--; b.s = 1; b.tare = d.type; SFX.add(); splash(bx, by, TARES[d.type].c, 5);
    } else if (d.kind === 'broth') {
      if (b.s < 1) return say('Tare goes in first: click a tare crock (or drag its spoon).');
      if (b.s > 1) return say('This bowl already has broth.');
      if (!recipesFor(b.tare, d.type).length) return say("You can't make that. No ramen uses " + TARES[b.tare].name.toLowerCase() + ' with ' + BROTHS[d.type].name.toLowerCase() + '.');
      G.stock[brothKey(d.type)]--; b.s = 2; b.broth = d.type; b.fill = 0; SFX.pour(); splash(bx, by, BROTHS[d.type].c, 12);
    } else if (d.kind === 'basket') {
      if (b.s < 2) return say(b.s < 1 ? 'Tare and broth go in before the noodles.' : 'Ladle in the broth before the noodles.');
      if (b.s > 2) return say('This bowl already has noodles.');
      b.s = 3; b.noodles = 'perfect'; b.nT = G.t; G.baskets[d.j].t = -1; SFX.pour(); splash(bx, by, '#bfe6f2', 10); spark(bx, by - 10, 4, '#fff3c9');
      caddy(b, k);
    } else if (d.kind === 'oil') {
      if (b.s < 2) return say(b.s < 1 ? 'Chili oil goes on the broth: tare and broth first.' : 'Ladle in the broth first, then the chili oil.');
      if (b.spicy) return say('This broth is already spicy.');
      if (!recipesFor(b.tare, b.broth).some(k => MENU[k].spicy)) return say("You can't make that. No spicy ramen uses " + TARES[b.tare].name.toLowerCase() + ' with ' + BROTHS[b.broth].name.toLowerCase() + '.');
      G.stock[CHILI_OIL]--; b.spicy = true; SFX.pour(); splash(bx, by, '#d8402a', 10); noise(0.2, 900, 0.08);
    } else if (d.kind === 'cold') {
      if (b.s < 2) return say(b.s < 1 ? 'Tare and broth go in before the noodles.' : 'Ladle in the broth before the noodles.');
      if (b.s > 2) return say('This bowl already has noodles.');
      if (G.ice <= 0) return say('No chilled noodles in the ice bath.');
      G.ice--; b.s = 3; b.noodles = 'perfect'; b.cold = true; b.nT = G.t; SFX.pour(); splash(bx, by, '#d8f4ff', 10); spark(bx, by - 10, 4, '#e8fbff');
      caddy(b, k);
    } else if (d.kind === 'top') {
      if (b.s < 3) return say(b.s < 1 ? 'Start in the kitchen: tare, broth, then noodles.' : 'Noodles go in before the toppings.');
      if (b.items.filter(x => x === d.id).length >= 2) return say('Two portions is the most a bowl can take.');
      if (!toppingOk(b, d.id)) return say("You can't make that. " + TOP_NAME[d.id] + ' does not go in a ' + TARES[b.tare].short.toLowerCase() + ' and ' + BROTHS[b.broth].short.toLowerCase() + ' bowl.');
      G.stock[d.id]--; b.items.push(d.id); (b.itemT = b.itemT || [])[b.items.length - 1] = G.t; SFX.add(); spark(bx, by, 3, '#fff6d0');
      startStep(b, d.id);
    }
  }

  /* ---------- special steps: short hands-on moments, for quality only (never needed to serve) ----------
     Pours (hold on the bowl, let go at the right number of swirls): chili oil, ember pepper oil (Dragon's Fire), black
     garlic oil (one swirl). Grinding (hold, let go while the sesame is fine). Torching (the meat of Black Garlic, Wyvern,
     Kraken King and Dragon's Fire: hold, let go while it is golden). Slicing (click the bowl): the mandrake root (it
     squeaks). Eggs land already sliced. Butter melts: serve before it is gone. Cold ramen: its
     noodles go through the ice bath. Each result lives on bowl.fx (and bowl.cold) and counts in grade(). */
  const TORCH = TORCH_RECIPES;
  const STEP_PENALTY = 0.06;   // each step not done right costs this much of the grade (enough to miss a "perfect" bowl)
  const POURS = { emberpep: 'ember', mayu: 'mayu' };          // topping -> its pour (fx[key] 'pending', then fx[key + 'N'] swirls). (Chili oil is part of the base: the bottle)
  const POUR_TOP = { chili: 'chili', ember: 'emberpep', mayu: 'mayu' };
  const SLICES = { mandrake: 'mandrake' };        // topping -> its slice (fx[key] 'whole', then 'sliced'); eggs land already sliced
  function startStep(b, id) {
    const fx = b.fx = b.fx || {};
    if (POURS[id] && !fx[POURS[id]]) fx[POURS[id]] = 'pending';
    if (SLICES[id] && !fx[SLICES[id]]) fx[SLICES[id]] = 'whole';
    if (id === 'sesame' && !fx.sesame) fx.sesame = 'pending';
    if (TORCH_MEATS.includes(id) && !fx.torch && recipesFor(b.tare, b.broth).some(k => TORCH.includes(k) && MENU[k].tops[id])) fx.torch = 'pending';
    if (id === 'butter' && b.butterAt === undefined) b.butterAt = G.t;
  }
  const HOLDS = ['chili', 'ember', 'mayu', 'torch', 'sesame'];
  const isPour = k => !!POUR_TOP[k];
  const holdKind = b => { const fx = b.fx || {}; return HOLDS.find(k => fx[k] === 'pending') || null; };
  const swirlsAt = p => (p < 0.15 ? 0 : Math.min(3, Math.floor((p - 0.15) / 0.5) + 1));   // 0.15-0.65s: one swirl, then two, then too much
  const searAt = p => p * 0.77;                                                         // golden from 0.8s, charred after 1.3s
  const grindOf = p => (p < 0.6 ? 'coarse' : p <= 1.2 ? 'perfect' : 'paste');           // fine sesame from 0.6s, paste after 1.2s
  // how many swirls a pour should have: the order slip's portions of that topping (black garlic oil: always one)
  const pourWant = (b, k) => k === 'mayu' ? 1 : (wantOf(b, POUR_TOP[k]) || (identify(b) ? MENU[identify(b).type].tops[POUR_TOP[k]] : 0) || 1);
  function updateHold(dt) {
    const d = G.drag;
    if (!G.hold && d && d.kind === 'bowl' && d.spot !== undefined && d.press && !d.press.moved && G.t - d.press.t0 > 0.12) {
      const kind = holdKind(G.bowls[d.spot]);
      if (kind) { G.hold = { kind, k: d.spot, t: 0, tick: 0 }; d.press.held = true; }
    }
    const h = G.hold; if (!h) return;
    const b = G.bowls[h.k];
    if (!b || !b.fx) { G.hold = null; return; }
    h.t += dt; h.tick -= dt;
    if (isPour(h.kind)) b.fx[h.kind + 'Live'] = swirlsAt(h.t); else if (h.kind === 'torch') b.fx.torchLive = searAt(h.t); else b.fx.sesameLive = h.t;
    if (h.tick <= 0) {
      h.tick = h.kind === 'sesame' ? 0.16 : 0.1;
      if (h.kind === 'chili') noise(0.07, 900, 0.14); else if (h.kind === 'ember') { noise(0.07, 700, 0.15); if (Math.random() < 0.5) noise(0.03, 3200, 0.08); }
      else if (h.kind === 'mayu') noise(0.08, 520, 0.13); else if (h.kind === 'torch') noise(0.09, 2600, 0.12); else noise(0.12, 260, 0.2);   // the pestle grinding
    }
    if (h.t >= 1.8) finishHold();   // every step is over in under two seconds
  }
  function finishHold() {
    const h = G.hold; G.hold = null; if (!h) return;
    const b = G.bowls[h.k], fx = b.fx, bx = K(KL.bowlX[h.k]), by = KL.BOWL_Y;
    if (isPour(h.kind)) {
      const n = swirlsAt(h.t); delete fx[h.kind + 'Live'];
      if (!n) return;   // barely touched: still waiting to be poured
      fx[h.kind + 'N'] = n; fx[h.kind] = 'done';
      if (n === pourWant(b, h.kind)) { SFX.ding(); spark(bx, by - 6, 6, { chili: '#ff8a4a', ember: '#ffb03a', mayu: '#8a7a70' }[h.kind]); } else SFX.tap();
    } else if (h.kind === 'torch') {
      delete fx.torchLive;
      fx.torch = h.t < 0.8 ? 'light' : h.t <= 1.3 ? 'perfect' : 'charred';
      if (fx.torch === 'perfect') { SFX.ding(); spark(bx + 20, by - 8, 6, '#ffd76a'); } else if (fx.torch === 'charred') SFX.bad(); else SFX.tap();
    } else {
      delete fx.sesameLive;
      fx.sesame = grindOf(h.t);
      if (fx.sesame === 'perfect') { SFX.ding(); spark(bx, by - 6, 6, '#f6e6c0'); } else SFX.tap();
    }
  }
  // A click on a bowl slices a whole mandrake root waiting in it.
  function sliceRoot(b, k) {
    const fx = b.fx; if (!fx) return false;
    const key = ['mandrake'].find(s => fx[s] === 'whole'); if (!key) return false;
    fx[key] = 'sliced'; SFX.chop(); setTimeout(() => SFX.chop(), 90);
    if (key === 'mandrake') { tone(1700, 0.09, 'square', 0.04, 2600, 0.04); tone(2100, 0.07, 'square', 0.035, 1500, 0.15); }   // eek!
    spark(K(KL.bowlX[k]) - 22, KL.BOWL_Y + 4, 5, '#f2e6c8');
    return true;
  }

  /* ---------- the Garnish Caddy (an upgrade): spring onion and nori sprinkle in with the noodles ----------
     It follows the oldest order slip for this tare and broth (so "no spring onion" orders get none); with no slip it uses
     the recipe, if only one recipe has this tare and broth. */
  // The order a bowl is being made for: it claims the oldest slip with its tare and broth that no other bowl has claimed.
  function slipFor(b) {
    if (!b.tare || !b.broth) return null;
    const same = o => MENU[o.order.type].tare === b.tare && MENU[o.order.type].broth === b.broth && (!b.spicy || MENU[o.order.type].spicy);
    let s = G.slips.find(o => o.num === b.slipNum && same(o));
    if (!s) { s = G.slips.find(o => same(o) && !G.bowls.some(x => x !== b && x.slipNum === o.num)); b.slipNum = s ? s.num : undefined; }
    return s || null;
  }
  // How many of a topping this bowl should get: from its order slip; with no slip, only if every recipe on this base agrees.
  function wantOf(b, id) {
    const s = slipFor(b); if (s) return s.order.tops[id] || 0;
    const n = baseRecipes(b).map(k => MENU[k].tops[id] || 0).filter(v => v > 0);
    return n.length && n.every(v => v === n[0]) && n.length === baseRecipes(b).length ? n[0] : 0;
  }
  function caddy(b, k) {
    if (!gearOn('caddy')) return;
    const slip = slipFor(b);
    const recs = baseRecipes(b), want = slip ? slip.order.tops : recs.length === 1 ? MENU[recs[0]].tops : null;
    if (!want) return;
    const bx = K(KL.bowlX[k]), by = KL.BOWL_Y; let n = 0;
    for (const id of ['scallion', 'nori']) {
      const need = Math.min(2, want[id] || 0) - b.items.filter(x => x === id).length;
      for (let q = 0; q < need && G.stock[id] > 0 && toppingOk(b, id); q++) { G.stock[id]--; b.items.push(id); b.itemT[b.items.length - 1] = G.t + 0.15 * n; n++; }
    }
    if (!n) return;
    for (let q = 0; q < 14; q++) G.parts.push({ type: 'drop', c: q % 3 ? '#5fbf40' : '#1c3626', x: bx + rand(-34, 34), y: by - 56 + rand(-8, 8), vx: rand(-12, 12), vy: rand(10, 50), life: 0.45, max: 0.45 });
    tone(760, 0.05, 'triangle', 0.05, 0, 0.12); tone(880, 0.05, 'triangle', 0.05, 0, 0.24);
  }

  /* ---------- click to add: everything goes into the active bowl ----------
     The active bowl is the one you last clicked (Tab switches); until you choose, it is the bowl furthest along that can
     take what you clicked. A click sends the item flying there in a short arc; it lands exactly like a dropped one, with
     the same rules and messages (addTo). Dragging still works for everything. */
  const hasActive = () => G.activeBowl !== null && G.activeBowl !== undefined && !!G.bowls[G.activeBowl];
  function autoBowl(d) {
    const order = G.bowls.map((b, k) => k).sort((a, c) => G.bowls[c].s - G.bowls[a].s || a - c);
    if (d) { const ok = order.find(k => accepts(G.bowls[k], d)); if (ok !== undefined) return ok; }
    return order[0];
  }
  const activeIndex = () => (hasActive() ? G.activeBowl : autoBowl(null));
  const targetBowl = d => (hasActive() ? G.activeBowl : autoBowl(d));
  function fromPos(d) {   // where a clicked item starts its flight (world coordinates)
    if (d.kind === 'top') { const b = KL.bin(Math.max(0, binOf(d.id))); return [K(b.x + b.w / 2), b.y + b.h / 2]; }
    if (d.kind === 'cold') return [K(KL.ICE.cx), KL.ICE.cy - 6];
    if (d.kind === 'oil') return [K(KL.OIL.cx), KL.OIL.by - 50];
    if (d.kind === 'tare') { const t = KL.tare(TARE_SLOTS.indexOf(d.type)); return [K(t.cx), t.y - 6]; }
    if (d.kind === 'broth') { const p = KL.pot(BROTH_SLOTS.indexOf(d.type)); return [K(p.cx), p.cy - 24]; }
    if (d.kind === 'basket') return [K(KL.basketX[d.j]), KL.BOIL.cy - 30];
    return [K(KL.NOODLE.x + KL.NOODLE.w / 2), KL.NOODLE.y + KL.NOODLE.h / 2];
  }
  const stockOk = d => d.kind === 'top' ? G.stock[d.id] > 0 : d.kind === 'tare' ? G.stock[tareKey(d.type)] > 0 : d.kind === 'broth' ? G.stock[brothKey(d.type)] > 0 : d.kind === 'cold' ? G.ice > 0 : d.kind === 'oil' ? G.stock[CHILI_OIL] > 0 : true;
  // Click a source: one item (or a recipe's double portion of a topping; Shift for just one) flies into the active bowl.
  function clickAdd(d, single) {
    if (d.kind === 'nest') {   // the noodle tray: a nest into the first empty basket
      const j = G.baskets.findIndex((b, i) => b.t < 0 && !G.flying.some(f => f.d.kind === 'nest' && f.j === i));
      if (j < 0) return say('Every basket is busy. Tip the READY noodles into a bowl first.');
      G.flying.push({ d, j, from: fromPos(d), to: [K(KL.basketX[j]), KL.BOIL.cy - 10], t: 0, dur: 0.3 }); SFX.pick();
      return;
    }
    if (d.kind === 'chill') return chillReady();   // the ice bath with nothing in it: chill the oldest READY basket
    const k = targetBowl(d), b = G.bowls[k];
    if (!accepts(b, d)) return addTo(b, k, d);   // not possible: addTo explains why (and changes nothing)
    let n = 1;
    if (d.kind === 'top' && !single) {   // a double portion in one click, when the order (or every recipe on this base) asks for two
      const want = wantOf(b, d.id), have = b.items.filter(x => x === d.id).length;
      if (want === 2) n = Math.max(1, 2 - have);
    }
    if (d.kind === 'basket') { d.t0 = G.baskets[d.j].t; G.baskets[d.j].t = -1; }   // the basket tips out now; the noodles are in the air
    for (let q = 0; q < n; q++) G.flying.push({ d, k, from: fromPos(d), to: [K(KL.bowlX[k]) + (q ? 10 : 0), KL.BOWL_Y - 4], t: -q * 0.12, dur: 0.34 });
    SFX.pick();
  }
  function land(f) {
    const d = f.d;
    if (d.kind === 'nest') return nestInto(f.j);
    if (d.kind === 'chillfly') { G.baskets[d.j].t = d.t0; return chill(d.j); }
    const b = G.bowls[f.k];
    if (!accepts(b, d)) { if (d.kind === 'basket' && G.baskets[d.j].t < 0) G.baskets[d.j].t = d.t0; return addTo(b, f.k, d); }
    if (!stockOk(d)) return say('That ran out on the way. Kitsune-ya sells more after closing.');
    if (d.kind === 'basket') G.baskets[d.j].t = d.t0;   // (addTo empties it again as the noodles land)
    addTo(b, f.k, d);
    if (d.kind === 'top' && b.itemT) b.itemT[b.items.length - 1] = G.t - 0.3;   // it arrived by air: just the little bounce
  }
  function updateFlying(dt) {
    for (const fl of G.flying) { fl.t += dt; if (fl.t >= fl.dur && !fl.done) { fl.done = true; land(fl); } }
    G.flying = G.flying.filter(fl => !fl.done);
  }
  function drawFlying(g) {
    for (const fl of G.flying) {
      if (fl.t < 0) continue;
      const p = Math.min(1, fl.t / fl.dur), x = Math.round(fl.from[0] + (fl.to[0] - fl.from[0]) * p), y = Math.round(fl.from[1] + (fl.to[1] - fl.from[1]) * p - Math.sin(p * Math.PI) * 60), d = fl.d;
      if (d.kind === 'top') ART.top(g, d.id, x, y, 0.9);
      else if (d.kind === 'tare') { PX.ell(g, x, y, 5, 4, PX.OUTLINE); PX.ell(g, x, y, 4, 3, TARES[d.type].c); }
      else if (d.kind === 'broth') { const c = BROTHS[d.type].c; PX.ell(g, x, y, 6, 4, PX.OUTLINE); PX.ell(g, x, y, 5, 3, c); PX.rect(g, x - 7, y + 4, 2, 2, c); PX.rect(g, x + 6, y + 3, 2, 2, c); }
      else if (d.kind === 'oil') { PX.ell(g, x, y, 5, 4, PX.OUTLINE); PX.ell(g, x, y, 4, 3, '#d8402a'); PX.rect(g, x - 1, y - 2, 2, 1, '#ff9a6a'); }
      else if (d.kind === 'cold') { ART.top(g, 'noodle', x, y, 0.8); PX.rect(g, x - 9, y - 6, 4, 4, '#e8fbff'); PX.rect(g, x + 6, y - 2, 3, 3, '#c8eefc'); }
      else ART.top(g, 'noodle', x, y, 0.8);
    }
  }
  // Little icons over a bowl for the special steps still to do (no words): an oil cruet, a torch, a knife; and while a
  // hold step runs, a bar with its sweet spot.
  function drawCues(g) {
    const R = PX.rect, DK = PX.OUTLINE;
    G.bowls.forEach((b, k) => {
      if (b.s < 3 || b === G.dragBowl) return;
      const fx = b.fx || {}, cues = [];
      for (const p of ['chili', 'ember', 'mayu']) if (fx[p] === 'pending') cues.push(p);
      if (fx.sesame === 'pending') cues.push('grind');
      if (fx.torch === 'pending') cues.push('torch');
      if (fx.mandrake === 'whole') cues.push('knife');
      const bx = K(KL.bowlX[k]);
      cues.forEach((c, i) => {
        const x = bx - (cues.length - 1) * 12 + i * 24, y = KL.BOWL_Y - 34 + Math.round(Math.sin(G.t * 4 + i) * 1.5);
        PX.ell(g, x, y, 10, 10, DK); PX.ell(g, x, y, 9, 9, '#fbf6ea');
        if (c === 'chili' || c === 'ember' || c === 'mayu') {   // an oil cruet in the oil's colour
          const oc = { chili: ['#c8302a', '#ff8a6a'], ember: ['#e8701a', '#ffd04a'], mayu: ['#2a2024', '#7a6a66'] }[c];
          R(g, x - 3, y - 2, 7, 8, DK); R(g, x - 2, y - 1, 5, 6, oc[0]); R(g, x - 1, y - 6, 3, 4, DK); R(g, x, y - 5, 1, 3, '#e8dcc0'); R(g, x - 2, y + 1, 1, 3, oc[1]);
          if (c === 'ember' && G.t * 8 % 2 < 1) R(g, x + 3, y - 6, 2, 2, '#ffb03a');
        } else if (c === 'grind') {   // a suribachi bowl and pestle
          PX.line(g, x + 1, y - 2, x + 5, y - 8, DK, 3); PX.line(g, x + 2, y - 3, x + 5, y - 7, '#c8925a');
          R(g, x - 6, y - 1, 13, 6, DK); R(g, x - 5, y, 11, 4, '#8a5a3a'); R(g, x - 5, y, 11, 1, '#f6e6c0'); R(g, x - 3, y + 5, 7, 1, DK);
        }
        else if (c === 'torch') { R(g, x - 4, y, 9, 5, DK); R(g, x - 3, y + 1, 7, 3, '#8a929e'); R(g, x + 1, y - 5, 3, 5, DK); const fl = G.t * 12 % 2 < 1; R(g, x + 1, y - 8, 3, 3, fl ? '#6ac8ff' : '#ffb04a'); R(g, x + 2, y - 7, 1, 2, '#ffffff'); }
        else { PX.line(g, x - 5, y + 4, x + 4, y - 5, DK, 3); PX.line(g, x - 4, y + 3, x + 3, y - 4, '#dfe6ee'); R(g, x - 6, y + 3, 3, 3, '#6b4a34'); }
      });
      const h = G.hold;
      if (h && h.k === k) {   // the meter: where the sweet spot is, and how far you are
        const x0 = bx - 40, y0 = KL.BOWL_Y + 66, W = 80, max = 1.8;
        R(g, x0 - 1, y0 - 1, W + 2, 7, DK);
        const segs = isPour(h.kind) ? [[0, 0.15, '#6a5a50'], [0.15, 0.65, h.kind === 'mayu' ? '#7a6a66' : '#e8502a'], [0.65, 1.15, h.kind === 'mayu' ? '#4a3a3a' : '#ff8a4a'], [1.15, max, '#3a2418']]
          : h.kind === 'sesame' ? [[0, 0.6, '#c8a878'], [0.6, 1.2, '#f6e6c0'], [1.2, max, '#8a6a4a']] : [[0, 0.8, '#c8a878'], [0.8, 1.3, '#ffd76a'], [1.3, max, '#3a2418']];
        if (isPour(h.kind)) { const wn = pourWant(b, h.kind), a = 0.15 + (wn - 1) * 0.5; R(g, x0 + Math.round(a / max * W), y0 - 2, Math.round(0.5 / max * W), 1, '#ffd76a'); }   // which swirl to stop on
        for (const [a, c2, col] of segs) R(g, x0 + Math.round(a / max * W), y0, Math.round((c2 - a) / max * W), 5, col);
        const mx = x0 + Math.round(Math.min(1, h.t / max) * W); R(g, mx - 1, y0 - 3, 3, 11, DK); R(g, mx, y0 - 2, 1, 9, '#ffffff');
      }
    });
  }
  /* ---------- taking a topping off: right-click a bowl, then pick which topping (one portion goes back in its bin) ---------- */
  const RM = { w: 150, row: 22 };
  function openRemove(k, p) {
    const b = G.bowls[k]; if (!b || b.s < 3) return say('Only toppings come off. Bin the bowl to start again.');
    const c = ART.count(b.items), ids = TOPS.filter(id => c[id] > 0);
    if (!ids.length) return say('This bowl has no toppings to take off.');
    const h = 26 + ids.length * RM.row + 6;
    G.rmMenu = { k, ids, x: clamp(Math.round(p.x + 8), 4, VW - RM.w - 4), y: clamp(Math.round(p.y - h / 2), 40, VH - h - 4), h };
    G.drag = null; G.dragBowl = null; SFX.paper();
  }
  const rmRow = (m, p) => { if (!p || p.x < m.x || p.x >= m.x + RM.w) return -1; const r = Math.floor((p.y - m.y - 26) / RM.row); return p.y >= m.y + 26 && r >= 0 && r < m.ids.length ? r : -1; };
  function removeTopping(k, id) {
    const b = G.bowls[k], i = b.items.lastIndexOf(id); if (i < 0) return;
    b.items.splice(i, 1); if (b.itemT) b.itemT.splice(i, 1); if (b.hide && b.hide[id]) b.hide[id] = Math.max(0, b.hide[id] - 1);
    G.stock[id] = (G.stock[id] || 0) + 1;   // back in its bin
    const fx = b.fx || {}, left = b.items.filter(x => x === id).length;
    if (!left) {   // its special step goes with it
      if (POURS[id]) { const key = POURS[id]; delete fx[key]; delete fx[key + 'N']; delete fx[key + 'Live']; }
      if (SLICES[id]) delete fx[SLICES[id]];
      if (id === 'sesame') { delete fx.sesame; delete fx.sesameLive; }
      if (id === 'butter') { delete b.butterAt; delete fx.butter; }
      if (TORCH_MEATS.includes(id) && !TORCH_MEATS.some(m => b.items.includes(m))) { delete fx.torch; delete fx.torchLive; }
    } else if (POURS[id] && fx[POURS[id]] === 'done') { /* (the oil already poured stays in the broth) */ }
    SFX.drop(); pop('-' + TOP_SHORT[id], K(KL.bowlX[k]), KL.BOWL_Y - 30, '#ffb0a0');
    if (G.hold && G.hold.k === k) G.hold = null;
  }
  function drawRemove(g) {
    const m = G.rmMenu; if (!m) return;
    const b = G.bowls[m.k]; if (!b) { G.rmMenu = null; return; }
    const c = ART.count(b.items), R = PX.rect, hov = rmRow(m, G.mouse);
    R(g, m.x + 3, m.y + 3, RM.w, m.h, 'rgba(40,20,10,0.3)');
    R(g, m.x - 1, m.y - 1, RM.w + 2, m.h + 2, PX.OUTLINE); R(g, m.x, m.y, RM.w, m.h, '#fbf6ea'); R(g, m.x, m.y, RM.w, 2, '#e8dcc0');
    PX.setFont(1); PX.textC(g, 'TAKE OFF WHICH?', m.x + RM.w / 2, m.y + 7, '#8a2a1a'); PX.setFont(2);
    R(g, m.x + 8, m.y + 21, RM.w - 16, 1, '#d8c4a0');
    m.ids.forEach((id, r) => {
      const y = m.y + 26 + r * RM.row;
      if (r === hov) R(g, m.x + 3, y, RM.w - 6, RM.row - 2, 'rgba(201,164,104,0.35)');
      ART.top(g, id, m.x + 16, y + 10, 0.62);
      PX.text(g, TOP_SHORT[id] + (c[id] > 1 ? ' x' + c[id] : ''), m.x + 32, y + 5, r === hov ? '#8a2a1a' : '#4a3226');
    });
  }
  // A press on a source that did not move is a click.
  function clickSource(d, single) {
    if (d.kind === 'bowl') {
      if (d.spot === undefined) return;   // a finished bowl on the tray: nothing to do with a click
      if (!sliceRoot(d.bowl, d.spot)) SFX.tap();
      G.activeBowl = d.spot;
      return;
    }
    // Aoi's handover teaches dragging: there, a click on a crock, pot, tray, basket or bin only reminds you to drag
    // (click-to-add works again once the tutorial is over)
    if (TUT.guiding()) { SFX.tap(); return say(d.kind === 'nest' ? 'Drag a nest from the tray into an empty basket.' : d.kind === 'basket' ? 'Drag the basket over to the bowl.' : 'Drag it into the bowl, chef.'); }
    clickAdd(d, single);
  }

  /* ---------- what a bowl is: which ramen it makes, and how it differs from that recipe or an order ---------- */
  const recipesFor = (tare, broth) => Object.keys(MENU).filter(k => MENU[k].tare === tare && MENU[k].broth === broth && menuOn(k));
  const baseRecipes = b => { const all = recipesFor(b.tare, b.broth), m = all.filter(k => !!MENU[k].spicy === !!b.spicy); return m.length ? m : all; };   // a spicy broth is only ever a spicy ramen
  const toppingOk = (b, id) => recipesFor(b.tare, b.broth).some(k => MENU[k].tops[id] || EXTRA_OK.includes(id));   // (EXTRA_OK: data.js)
  function identify(b) {   // the closest unlocked recipe for this tare + broth + toppings, or null
    if (!b.tare || !b.broth) return null;
    const c = ART.count(b.items);
    let best = null, bd = Infinity;
    for (const k of baseRecipes(b)) {
      let d = 0; for (const id of TOPS) d += Math.abs((c[id] || 0) - (MENU[k].tops[id] || 0));
      if (d < bd) { bd = d; best = k; }
    }
    return best && { type: best, tops: c };
  }
  function orderDiff(b, order) {   // what is off, in words; empty when the bowl is exactly what was ordered
    const m = MENU[order.type];
    if (b.tare !== m.tare || b.broth !== m.broth) { const id = identify(b); return ['it should be ' + m.name + (id ? ', not ' + MENU[id.type].name : '')]; }
    if (!!m.spicy !== !!b.spicy) return [m.spicy ? 'the broth needs chili oil' : 'the broth should not be spicy'];
    const c = ART.count(b.items), out = [];
    for (const id of TOPS) {
      const want = order.tops[id] || 0, has = c[id] || 0, n = TOP_NAME[id].toLowerCase();
      if (has < want) out.push('missing ' + (want - has > 1 ? 'two ' : '') + n);
      else if (has > want) out.push('extra ' + n);
    }
    return out;
  }

  /* ---------- serving ---------- */
  /* The special steps an order calls for, and which were done right. Each: [done right?, a guest's word when it was].
     (Bowls from older saves simply have no fx: their steps count as not done.) */
  function steps(b, order) {
    const c = ART.count(b.items), fx = b.fx || {}, T = order.tops, m = MENU[order.type], out = [];
    if (T.emberpep && c.emberpep) out.push([fx.emberN === T.emberpep, 'Ember oil, perfectly poured. My mouth is on fire. Wonderful!']);
    if (T.mayu && c.mayu) out.push([fx.mayuN === 1, 'That black garlic swirl! So smoky.']);
    if (T.sesame && c.sesame) out.push([fx.sesame === 'perfect', 'Fresh-ground sesame. You can smell it!']);
    if (TORCH.includes(order.type) && TORCH_MEATS.some(id => T[id] && c[id])) out.push([fx.torch === 'perfect', 'Ooh, a perfect sear!']);
    if (T.mandrake && c.mandrake) out.push([fx.mandrake === 'sliced', 'Thin-sliced mandrake. Did it... squeak?']);
    if (T.butter && c.butter) out.push([fx.butter === 'perfect', 'The butter is still melting. Perfect timing!']);
    if (m.cold || b.cold) out.push([!!m.cold === !!b.cold, 'Ice-cold noodles. Exactly what a hot day needs.']);
    return out;
  }
  function grade(b, order) {
    const c = ART.count(b.items);
    let q = 1;
    for (const id of TOPS) q -= 0.12 * Math.abs((c[id] || 0) - (order.tops[id] || 0));
    const m = MENU[order.type];
    if (m.tare && b.tare !== m.tare) q -= 0.25;
    if (m.broth && b.broth !== m.broth) q -= 0.25;
    if (!!m.spicy !== !!b.spicy) q -= 0.25;   // chili oil is part of the base
    // each special step skipped or fluffed costs a little (Hiro's House is strict: three times as much); the wrong
    // noodle temperature costs more
    for (const [ok] of steps(b, order)) if (!ok) q -= STEP_PENALTY * (m.strict ? 3 : 1);
    if (!!m.cold !== !!b.cold) q -= 0.14;
    return Math.max(0.1, q);
  }
  // A guest's word on a step done well (or not), now and then.
  function stepLine(b, order) {
    const fx = b.fx || {}, out = steps(b, order).filter(s => s[0]).map(s => s[1]);
    if (TORCH.includes(order.type) && fx.torch === 'charred') out.push('A little smoky... I like it anyway.');
    if (MENU[order.type].cold && !b.cold) out.push('Hm, cold ramen is usually... cold.');
    if (!MENU[order.type].cold && b.cold) out.push('The noodles are chilled? Brr.');
    if (b.items.includes('glowcap') && isNight()) out.push('The glowcaps are glowing! How pretty.');
    return out.length ? pick(out) : null;
  }
  function serve(i, d) {
    const st = G.stalls[i], gu = st.guest;
    if (!gu) return say('That seat is empty.');
    if (gu.state === 'call' || gu.state === 'arrive') return say('Take their order first: tap the guest to chat.');
    if (gu.state !== 'wait') return say('They already have their bowl.');
    if (d.bowl.s < 3) return say('That bowl is not finished yet.');
    // Any finished bowl is accepted: a wrong one gets a puzzled look and a smaller payment (grade() sets it).
    takeBowl(d);
    if (d.bowl.butterAt !== undefined) (d.bowl.fx = d.bowl.fx || {}).butter = G.t - d.bowl.butterAt < ART.BUTTER_MELT ? 'perfect' : 'melted';   // served before it melted away?
    const off = orderDiff(d.bowl, gu.order), q = grade(d.bowl, gu.order), perfect = q > 0.99;
    gu.q = q; gu.sale = Math.round(gu.order.price * q); gu.pay = gu.sale + (perfect ? perfectTip() + Math.min(4, affLevel(G.aff[gu.gt.id], gu.gt.id)) : 0) + (gu.trusted && perfect ? 3 : 0);
    st.bowl = d.bowl; gu.state = 'react'; gu.t = 0; gu.wrong = off.length > 0;
    G.slips = G.slips.filter(s => s.guest !== gu);
    if (G.ticketZoom === i) G.ticketZoom = -1;
    SFX.drop();
    if (gu.wrong) {
      bubble(i, line(gu, 'wrong', ['Hm? This is not quite what I ordered...', 'Oh. Not what I asked for, but... all right.']));
      say(gu.gt.name + ' got the wrong bowl: ' + off.join(', ') + '.');
    } else {
      hearts(SL.X0 + SL.stallCX(i), 170, 2);
      const sl = stepLine(d.bowl, gu.order);
      if (sl && Math.random() < 0.7) bubble(i, sl); else if (Math.random() < 0.5) bubble(i, line(gu, 'react', ['Ooh, that smells wonderful!', 'Thank you, chef!']));
    }
  }

  /* ---------- the menu: which known recipes the shop sells (up to menuSlots()), in the player's order ---------- */
  // Keep the menu valid: known recipes only, no repeats, no more than the slots, never empty; the chef's pick is on it.
  function fixMenu() {
    const known = Object.keys(MENU).filter(menuOn);
    G.menu = (G.menu || []).filter((k, i, a) => MENU[k] && menuOn(k) && a.indexOf(k) === i).slice(0, menuSlots());
    while (G.menu.length > 1 && menuTops(G.menu).length > RACK) G.menu.pop();   // (older saves) the toppings must fit the rack
    if (!G.menu.length) G.menu = [known.includes('miso') ? 'miso' : known[0]];
    if (!G.menu.includes(G.pick)) G.pick = G.menu[0];
  }
  // A dish off the menu, weighted towards the top (the first dish is ordered about 1.6 times as often as the last).
  // Night-only dishes are never ordered by day (unless nothing else is on the menu); glowing bowls sell better at night.
  const orderable = k => !MENU[k].night || isNight() || G.menu.every(x => MENU[x].night);
  function menuPick() {
    fixMenu();
    const n = G.menu.length, night = isNight();
    const w = G.menu.map((k, i) => !orderable(k) ? 0 : (1 + 0.6 * (n > 1 ? (n - 1 - i) / (n - 1) : 0)) * (night && MENU[k].tops.glowcap ? 1.8 : 1));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < n; i++) { r -= w[i]; if (r <= 0) return G.menu[i]; }
    return G.menu[n - 1];
  }
  function menuChanged() { fixMenu(); KITCHEN.refresh(); }   // the kitchen's menu board is part of its cached wall
  function makeOrder(gt, type) {
    const t = gt.taste;
    type = type || (t.pref && G.menu.includes(t.pref) && orderable(t.pref) && Math.random() < 0.6 ? t.pref : menuPick());
    const m = MENU[type], base = m.tops, tops = { ...base }, rack = rackTops();
    // what this guest may change: an extra only if the kitchen has it on its rack and it suits the bowl (EXTRA_OK, or
    // the recipe already has it); taking one off only if the recipe has it
    const can = (id, n) => n < (base[id] || 0) ? true : rack.includes(id) && topOn(id) && (base[id] || EXTRA_OK.includes(id));
    const vary = G.day === 1 && G.tut && G.tut.fresh ? 0 : Math.min(0.9, 0.35 + 0.15 * (G.day - 1));   // a new save's first day: plain bowls only
    if (t.tops && Math.random() < vary) { for (const id in t.tops) if (can(id, t.tops[id])) tops[id] = t.tops[id]; }
    else if (Math.random() < vary * 0.55) {
      // a random change: often a second portion of something in the bowl, sometimes a new topping, now and then one fewer
      const opts = [...Object.keys(base).filter(id => base[id] === 1 && !SPECIAL_ONE.includes(id)).map(id => [id, 2]),
        ...rack.filter(id => !base[id] && EXTRA_OK.includes(id)).map(id => [id, 1]),
        ...['scallion', 'menma', 'nori'].filter(id => base[id]).map(id => [id, 0])].filter(([id, n]) => can(id, n));
      if (opts.length) { const [id, n] = pick(opts); tops[id] = n; }
    }
    return billed(type, tops);
  }
  // the bill: the bowl's price, plus each extra portion asked for (removals never lower it)
  function billed(type, tops) {
    const m = MENU[type], base = m.tops; let extra = 0;
    tops = { ...tops };
    for (const id of Object.keys(tops)) { extra += Math.max(0, tops[id] - (base[id] || 0)) * extraPrice(id); if (!tops[id]) delete tops[id]; }
    return { type, tops, price: m.price + extra, extra };
  }
  /* Orders Aoi's tutorial sets up: the handover's guests (a plain Miso Ramen; one with an extra egg and no scallion; a
     plain one cooked alone), and on a new save's Day 3 one order for a ramen the shop cannot make yet. (gu.tutKind
     marks them for the notes.) */
  function tutOrder(gu) {
    const T = G.tut; if (!T) return null;
    if (gu.tut === 'extra') { gu.tutKind = 'plus'; return billed('miso', { ...MENU.miso.tops, egg: 2, scallion: 0 }); }
    if (gu.tut === 'decline') { gu.tutKind = 'cancel'; return billed('dragon', MENU.dragon.tops); }   // the very last bowl on the road: one to turn away
    if (gu.tut) return billed('miso', MENU.miso.tops);
    if (!T.fresh || !G.tut.done) return null;
    T.forced = T.forced || {};
    if (G.day === 3 && !T.forced.cancel && !TUT.seen('d.cancel')) {   // (players who did the handover already turned one away)
      const stop = STOPS.find(s => s.kind === 'recipe' && !menuOn(s.menu) && !MENU[s.menu].night);
      if (stop) { T.forced.cancel = true; gu.tutKind = 'cancel'; return billed(stop.menu, MENU[stop.menu].tops); }
    }
    return null;
  }
  // toppings a guest never asks to double (one is the whole point: a single egg to slice, one oil swirl...)
  const SPECIAL_ONE = ['mayu', 'cockegg', 'mandrake', 'sesame', 'sunpetal', 'glowcap', 'frostleaf', 'kraken', 'wyvern', 'emberpep', 'chili', 'butter'];
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
  function seatGuest(i, tut) {
    const used = G.stalls.map(s => s.guest && s.guest.gt.id);
    const pool = GUESTS.filter(gt => !used.includes(gt.id) && (!gt.taste.night || isNight()) && !(gt.id === 'aoi' && (G.shop === 'night' || TUT.guiding() || (G.day === 1 && G.tut && G.tut.fresh))));   // (not Aoi while she is the one showing you around)
    // Aoi drops by once a day at most, and more often the fonder of the chef she grows
    const aoiOk = pool.find(g => g.id === 'aoi') && G.aoiDay !== G.day;
    const gt = aoiOk && Math.random() < AOI.visitChance() ? pool.find(g => g.id === 'aoi') : pick(pool.filter(g => g.id !== 'aoi').length ? pool.filter(g => g.id !== 'aoi') : pool);
    if (gt.id === 'aoi') G.aoiDay = G.day;
    // arrive: the guest fades in behind the lowered blind (a silhouette through the slats), the blind rolls up, they read the menu board, then call
    const gu = { gt, img: IMG[gt.id], stall: i, state: 'arrive', t: 0, mood: null, order: null };
    gu.asksRec = !tut && Math.random() < (gt.taste.pref ? 0.25 : 0.55);
    if (tut) { gu.tut = tut; G.tutGu = gu; }   // one of the handover's guests ('plain', 'extra' or 'solo')
    clearSeat(i);
    G.stalls[i].guest = gu;
    return gu;
  }
  // What a guest left on the counter (their empty bowl and coins) goes away; the coins fly into the till.
  function clearSeat(i) {
    const st = G.stalls[i], cx = SL.X0 + SL.stallCX(i);
    if (st.left > 0 && st.paid) for (let k = 0; k < 5; k++) G.parts.push({ type: 'coin', x: cx + 40, y: SL.COUNTER_Y - 8, x0: cx + 40 + rand(-6, 6), y0: SL.COUNTER_Y - 8, k: -k * 0.12, life: 2, max: 2 });
    st.left = 0; st.paid = false; st.bowl = null;
  }
  // The guest rises and fades out where they sat; the seat is free straight away. A paying guest leaves their empty
  // bowl and coins on the counter for a few seconds (cleared sooner if someone new sits down).
  function leaveSeat(i, paid) {
    const st = G.stalls[i], gu = st.guest; if (!gu) return;
    G.walkers.push({ gt: gu.gt, img: gu.img, x0: SL.stallCX(i), t: 0, bay: i });
    st.holdUp = 0.8;   // the blind waits until they have faded out, then rolls down
    st.guest = null;
    if (paid) { st.left = 3; st.paid = true; } else st.bowl = null;
    if (G.ticketZoom === i) G.ticketZoom = -1;
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
  // Seconds until the next guest. Arrivals are random the way real ones are (an exponential gap: sometimes two close
  // together, sometimes a long lull), around ARRIVE_GAP at the lunch rush and slower at other hours. Every guest still
  // waiting on food stretches the gap, so a busy kitchen gets breathing room; later days get only a little busier.
  const ARRIVE_GAP = 20;   // average gap at the 12:00-15:00 peak (the whole open day is 150s): about 5 guests a day
  function nextArrival() {
    const busy = G.stalls.filter(s => s.guest && ['call', 'ordering', 'wait'].includes(s.guest.state)).length;
    const rush = G.day === 4 && G.tut && G.tut.fresh ? 0.75 : 1;   // a new save's Day 4: a slightly bigger rush (Aoi leaves a note)
    const mean = ARRIVE_GAP * pace(hour()) * Math.max(0.75, 1 - 0.03 * (G.day - 1)) * (1 + 0.45 * busy) / rainBoost() * rush;   // rain brings 25% more guests
    const MAX_GAP = 60;   // never more than a minute without a guest, however quiet the hour or busy the kitchen
    return clamp(-Math.log(1 - Math.random()) * mean, Math.min(MAX_GAP, Math.max(2, mean * 0.08)), Math.min(MAX_GAP, mean * 3.5));   // a wide spread: sometimes two guests a couple of seconds apart, sometimes a long lull
  }
  function updateGuests(dt) {
    G.spawnT -= dt; G.seatCD -= dt;
    const free = () => G.stalls.findIndex((s, i) => !s.guest && stallOpen(i));
    if (TUT.guiding()) {   // Aoi's handover: only her guests, one at a time, at the first free stall
      const kind = TUT.wantGuest();
      if (kind && G.tutWant !== kind) { G.tutWant = kind; G.spawnT = 1.8; }   // they come in a moment after Aoi asks for them
      if (kind && G.shop === 'open' && free() >= 0 && G.spawnT <= 0) seatGuest(free(), kind);
    } else if (G.shop === 'morning') G.spawnT = Math.max(G.spawnT, 3);
    else if (G.shop === 'night') {     // closed, but the odd late-night walk-in knocks until 04:00 (gold only, never on a receipt)
      if (shutHours()) G.spawnT = Math.max(G.spawnT, 3);   // 04:00-09:00: fully closed, nobody comes in
      else if (G.spawnT <= 0) { if (free() >= 0) seatGuest(free()); G.spawnT = rand(40, 60); }
    } else if (G.spawnT <= 0) {
      if (free() >= 0 && G.waiting === 0) seatGuest(free());
      else if (G.waiting < maxWait()) G.waiting++;
      G.spawnT = nextArrival();
    }
    if (G.shop === 'open' && !TUT.guiding() && G.waiting > 0 && G.seatCD <= 0 && free() >= 0) { G.waiting--; G.seatCD = rand(3, 8); seatGuest(free()); }   // the queue sits down unhurried
    G.stalls.forEach((st, i) => {
      const gu = st.guest; if (!gu) return;
      gu.t += dt;
      const cx = SL.X0 + SL.stallCX(i);
      switch (gu.state) {
        case 'arrive': {
          const sat = 2.0;   // faded in (0.9s), the blind rolls up (1.0-1.9s): a look at the menu board, then a call
          if (!gu.creaked && gu.t >= 0.7) { gu.creaked = true; if (!G.where && STATIONS[G.st].id === 'serving') SFX.stool(); }
          if (!gu.menuSaid && gu.t >= sat) { gu.menuSaid = true; bubble(i, line(gu, 'menu', ['*studies the menu board*', '*reads down the menu board*'])); }
          if (gu.t > sat + 2.4) { gu.state = 'call'; gu.t = 0; SFX.bell(); }
          break;
        }
        case 'served':   // (a bowl set down by older code: react straight away)
          gu.state = 'react'; gu.t = 0;
          break;
        case 'react':
          if (gu.t > 1.6) { gu.state = 'eat'; gu.t = 0; }
          break;
        case 'eat':
          if (Math.random() < dt * 6) G.parts.push({ type: 'steam', x: cx + rand(-24, 24), y: SL.COUNTER_Y - 36, vx: 0, vy: rand(-44, -24), life: rand(0.9, 1.6), max: 1.6 });
          if (Math.random() < dt * 0.9) pop(pick(['SLURP', 'MMM', 'SIP']), cx + rand(-40, 40), 230, '#fff6d0');
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
            if (gu.gt.id === 'aoi') {   // Aoi: her own ten hearts (js/aoi.js), and now and then a note under her bowl
              AOI.gain(perfect ? 4 : gu.q >= 0.6 ? 2 : 1);
              const n = AOI.note(); if (n) setTimeout(() => { toast(n, 7); SFX.ding(); }, 2600);
            } else { const id = gu.gt.id, was = affLevel(G.aff[id]); G.aff[id] = (G.aff[id] || 0) + (perfect ? 2 : 1); const now = affLevel(G.aff[id]);
              if (now > was) { hearts(cx, 150, 10); SFX.ding(); toast(gu.gt.name + ' is now a ' + AFFINITY[now].name.toLowerCase() + ' of the shop! (affinity ' + (now + 1) + ')'); TUT.event('rankup'); } }
            pop('+' + gu.pay + 'G', cx, 220);
            gainXP(Math.round(6 + 10 * gu.q), cx);
            if (perfect) { hearts(cx, 170, 6); SFX.ding(); } else SFX.coin();
            bubble(i, perfect ? line(gu, 'yum', gu.gt.yum) : gu.q >= 0.6 ? line(gu, 'meh', ['Close enough. Thank you!', 'Warm and filling.']) : line(gu, 'bad', ['Hm, not quite what I asked for.', 'I will manage. Thanks anyway.']));
          }
          break;
        case 'pay':   // the coins sit on the counter for a beat, then the guest heads out
          if (gu.t > 2.4) leaveSeat(i, true);
          break;
        case 'closing': case 'leave':
          leaveSeat(i, false);
          break;
      }
    });
    // guests fading out, and what they left on the counter
    for (const w of G.walkers) w.t += dt;
    G.walkers = G.walkers.filter(w => w.t < 0.5);
    G.stalls.forEach((st, i) => { if (!st.guest && st.left > 0 && !TUT.holdCoins(i)) { st.left -= dt; if (st.left <= 0) { st.left = 0.001; clearSeat(i); } } });   // (the guided bowl's coins wait to be collected)
    // the blinds: up once a guest has faded in, down again after they have gone (0.9s each way, eased when drawn)
    G.stalls.forEach((st, i) => {
      if (st.blind === undefined) st.blind = 1;
      st.holdUp = Math.max(0, (st.holdUp || 0) - dt);
      const gu = st.guest, up = (gu && !(gu.state === 'arrive' && gu.t < 1.0)) || st.holdUp > 0, target = up ? 0 : 1;
      if (st.blind === target) return;
      const inView = !G.where && STATIONS[G.st].id === 'serving';
      if (inView && (st.blind === 1 || st.blind === 0)) (target === 0 ? SFX.blindUp : SFX.blindDown)();   // it starts to move
      st.blind = clamp(st.blind + Math.sign(target - st.blind) * dt / 0.9, 0, 1);
      if (st.blind === target) st.blindAt = G.t;   // stopped: the rail settles with a bounce
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
    $('dlg-text').textContent = ''; $('dlg-text').classList.toggle('sys', !!s.sys); $('dlg-choices').innerHTML = ''; $('dlg-next').style.visibility = 'hidden';
  }
  const typed = () => DLG.chars >= DLG.full.length;
  function pickChoice(c) { SFX.tap(); if (c.fn) c.fn(); DLG.i++; showStep(); }
  function revealChoices() {
    const s = DLG.steps[DLG.i];
    $('dlg-text').textContent = DLG.full;
    if (s.choices) {
      $('dlg-choices').innerHTML = '';
      s.choices.forEach((c, k) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'choice' + (c.rec ? ' rec' : '') + (k === s.def ? ' def' : '');
        b.innerHTML = (c.rec ? '<span class="star">&#9733;</span> ' : '') + c.label;
        b.onpointerdown = e => e.stopPropagation();
        b.onclick = e => { e.stopPropagation(); pickChoice(c); };
        $('dlg-choices').appendChild(b);
      });
    } else $('dlg-next').style.visibility = 'visible';
  }
  // A step with a default choice (def) takes it on Enter / Space, or on a tap outside the dialog box.
  function pickDefault() {
    const s = DLG.steps[DLG.i];
    if (G.ui !== 'dialog' || !s || !s.choices || s.def === undefined || !typed()) return false;
    pickChoice(s.choices[s.def]); return true;
  }
  function advance(fromKey) {
    if (G.ui !== 'dialog') return;
    if (!typed()) { DLG.chars = DLG.full.length; revealChoices(); return; }
    if (DLG.steps[DLG.i].choices) { if (fromKey === true) pickDefault(); return; }
    DLG.i++; showStep();
  }
  function endTalk() { $('dialog').classList.remove('show'); G.ui = null; const f = DLG.onEnd; DLG.onEnd = null; if (f) f(); }
  function updateDialog(dt) {
    if (G.ui !== 'dialog' || typed()) return;
    const before = Math.floor(DLG.chars);
    DLG.chars = Math.min(DLG.full.length, DLG.chars + dt * [26, 48, 95][SETTINGS.textSpeed]);
    const now = Math.floor(DLG.chars);
    if (now !== before) { $('dlg-text').textContent = DLG.full.slice(0, now); if (now % 3 === 0 && DLG.full[now - 1] !== ' ' && !DLG.steps[DLG.i].sys) SFX.blip(DLG.pitch); }
    if (typed()) revealChoices();
  }

  function takeOrder(gu) {
    const gt = gu.gt, p = PERSONA[gt.id] || {}, steps = [];
    gu.state = 'ordering';
    steps.push({ text: line(gu, 'hi', gt.hi) });
    gu.declined = false;
    const forced = tutOrder(gu);   // (Aoi's tutorial sets up a few orders)
    if (forced) gu.asksRec = false;
    // The order line itself carries the confirm / decline choice (the guided bowl's guest gets just the yes).
    const answer = [{ label: 'Coming right up!' }].concat(gu.tut === 'plain' || gu.tut === 'extra' ? [] : [{ label: 'Sorry, I cannot make that one', fn: () => { gu.declined = true; } }]);   // (the two guided bowls only get the yes)
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
          fixMenu();
          const pk = G.pick, others = G.menu.filter(k => k !== pk), alt = others.length ? pick(others) : null;
          return [{ label: MENU[pk].name + ', the chef\'s pick', rec: true, fn: () => { gu.order = makeOrder(gt, pk); gu.trusted = true; } }]
            .concat(alt ? [{ label: MENU[alt].name, fn: () => { gu.order = makeOrder(gt, alt); gu.trusted = false; } }] : []);
        })() });
      // (guests' own "trust" lines talk about miso, so they are only used while miso is the chef's pick)
      steps.push({ text: () => (gu.trusted ? (gu.order.type === 'miso' ? line(gu, 'trust', ['The chef\'s pick? Then miso it is!']) : 'The chef\'s pick? Then ' + MENU[gu.order.type].name + ' it is!') : (MENU[gu.order.type].name + ' it is! I like your style.'))
        + (mods(gu.order).length ? ' ' + modsTpl().replace('{mods}', joinList(mods(gu.order))) : ''), choices: answer });
    } else {
      gu.order = forced || makeOrder(gt);
      steps.push({ text: () => orderText(), choices: answer });
    }
    steps.push({ text: () => line(gu, 'decline', DECLINE), skip: () => !gu.declined });
    talk(gu, steps, () => {
      if (gu.declined) return sendHome(gu);
      gu.num = G.nextNum++; gu.state = 'wait'; gu.t = 0;   // the ticket goes in the seat's clip and on the kitchen rail
      G.slips.push({ num: gu.num, guest: gu, order: gu.order, age: 0 });
      SFX.ding();
    });
  }
  // Tapping a waiting guest: a quick chat, with the option to cancel an order you cannot make (asked twice: the
  // second step defaults to keeping the order).
  function checkIn(gu) {
    gu.declined = false; gu.askCancel = false;
    const dish = () => MENU[gu.order.type].name;
    talk(gu, [
      { text: line(gu, 'idle', ['I will be right here.', 'No hurry!']),
        choices: [{ label: 'It will be ready soon!' }, { label: 'Sorry, I have to cancel your order', fn: () => { gu.askCancel = true; } }] },
      { sys: true, text: () => `Cancel ${gu.gt.name}'s ${dish()}? They'll leave without paying.`, skip: () => !gu.askCancel, def: 0,
        choices: [{ label: 'Keep the order' }, { label: 'Yes, cancel', fn: () => { gu.declined = true; } }] },
      { text: () => line(gu, 'decline', DECLINE), skip: () => !gu.declined }
    ], () => { gu.askCancel = false; if (gu.declined) sendHome(gu); });
  }
  // The guest leaves without a bowl: no slip, no pay, no hard feelings.
  function sendHome(gu) {
    G.slips = G.slips.filter(s => s.guest !== gu);
    G.stats.declined++;
    if (G.stalls[gu.stall].guest === gu) leaveSeat(gu.stall, false);
    toast(gu.gt.name + ' heads home. No hard feelings.');
  }

  /* ---------- menu and recipe book ---------- */
  const img = (w, h, draw, scale = 1) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); return `<img class="px" style="width:${w * scale}px" src="${c.toDataURL()}" alt="">`; };
  const recipeItems = m => Object.entries(m.tops).flatMap(([id, n]) => Array(n).fill(id));
  const bowlImg = type => img(124, 82, g => ART.bigBowl(g, 62, 26, { s: 3, tare: MENU[type].tare, broth: MENU[type].broth, fill: 1, noodles: 'perfect', items: recipeItems(MENU[type]), hide: {} }, false, 0));
  const topImg = id => img(26, 26, g => ART.top(g, id, 13, 13));
  /* The menu editor (the wall menu board, a stall's menu card or the HUD menu button open it). Top: what the shop sells,
     in order (move a dish up or down, star the chef's pick, take it off). Below: every other recipe you know, to add
     while there is a free slot. The menu always keeps at least one dish. Changes apply to the next orders. */
  function buildMenu() {
    fixMenu();
    const slots = menuSlots(), full = G.menu.length >= slots, last = G.menu.length <= 1;
    const known = Object.keys(MENU).filter(k => menuOn(k) && !G.menu.includes(k)), locked = Object.keys(MENU).filter(k => !menuOn(k)).length;
    const fig = k => `<img class="px mn-fig" src="${ART.figURL(k)}" alt="" draggable="false">`;
    const tops = m => TIER_NAME[m.tier] + ': ' + Object.keys(m.tops).map(id => TOP_NAME[id].toLowerCase() + (m.tops[id] > 1 ? ' x' + m.tops[id] : '')).join(', ') + (m.night ? ' (night only)' : '') + (m.cold ? ' (served cold)' : '');
    const btn = (act, k, label, title, off) => `<button type="button" class="mn-btn mn-${act}" data-act="${act}" data-k="${k}" title="${title}" aria-label="${title}"${off ? ' disabled' : ''}>${label}</button>`;
    const row = (k, i) => { const m = MENU[k], pk = k === G.pick;
      return `<li class="mn-row${pk ? ' pick' : ''}"><span class="mn-num">${i + 1}</span>${fig(k)}<span class="mn-dish"><b style="color:${m.c}">${m.name}</b><small>${tops(m)}</small></span><span class="price">${m.price}G</span>
        ${btn('pick', k, '&#9733;', pk ? 'The chef\'s pick' : 'Make this the chef\'s pick', false)}${btn('up', k, '&#9650;', 'Move up', i === 0)}${btn('down', k, '&#9660;', 'Move down', i === G.menu.length - 1)}${btn('del', k, 'Remove', last ? 'The menu needs at least one dish' : 'Take it off the menu', last)}</li>`; };
    // a dish fits only if the topping rack can hold every topping the menu would then need
    const rackFull = k => menuTops(G.menu.concat(k)).length > RACK;
    const spare = k => { const m = MENU[k], noRoom = !full && rackFull(k);
      return `<li class="mn-row spare">${fig(k)}<span class="mn-dish"><b style="color:${m.c}">${m.name}</b><small>${tops(m)}</small></span><span class="price">${m.price}G</span>${btn('add', k, 'Add', full ? 'The menu is full: remove a dish first' : noRoom ? 'The topping rack is full (' + RACK + ' bins): remove a dish first' : 'Put it on the menu', full || noRoom)}</li>`; };
    $('menu-body').innerHTML = `<h2>Menu <small class="mn-count${full ? ' full' : ''}">${G.menu.length} / ${slots}</small></h2>
      <p class="note">The shop sells these. Dishes near the top are ordered a little more often; the &#9733; dish is what you recommend.</p>
      <ol class="mn-list">${G.menu.map(row).join('')}</ol>
      <h4>Recipes you know${known.length ? '' : ': all on the menu'}</h4>
      ${known.length ? `<ul class="mn-list">${known.map(spare).join('')}</ul>` : ''}
      ${locked ? `<p class="note">${locked} more recipe${locked > 1 ? 's' : ''} to discover on the ${ROAD_NAME}.${slots < MENU_BASE + 2 ? ' Menu board upgrades there add slots.' : ''}</p>` : ''}
      <h4>Extra toppings <small class="mn-count">rack ${menuTops(G.menu).length} / ${RACK}</small></h4>
      <p class="note">A guest who asks for more of a topping pays for each extra portion. What a recipe already has is in its price.</p>
      <div class="tops extras">${rackTops().filter(topOn).map(id => `<span>${topImg(id)}${TOP_NAME[id]} <b class="price">+${extraPrice(id)}G</b></span>`).join('')}</div>`;
  }
  $('menu-body').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const k = b.dataset.k, i = G.menu.indexOf(k), act = b.dataset.act;
    if (act === 'add' && i < 0 && G.menu.length < menuSlots() && menuTops(G.menu.concat(k)).length <= RACK) G.menu.push(k);
    else if (act === 'del' && i >= 0 && G.menu.length > 1) G.menu.splice(i, 1);
    else if (act === 'up' && i > 0) [G.menu[i - 1], G.menu[i]] = [G.menu[i], G.menu[i - 1]];
    else if (act === 'down' && i >= 0 && i < G.menu.length - 1) [G.menu[i + 1], G.menu[i]] = [G.menu[i], G.menu[i + 1]];
    else if (act === 'pick' && i >= 0) G.pick = k;
    else return;
    SFX.tap(); menuChanged(); buildMenu();
  });
  // Level-road icons are drawn into padded canvases and shown in fixed boxes, so nothing gets cropped.
  const ico = (w, h, draw) => img(w, h, draw).replace('<img class="px"', '<img class="px ico-img"');
  const box = (inner, cls = '') => `<span class="ico ${cls}">${inner}</span>`;

  /* ---------- the two physical books (js/pbook.js): the cookbook and the guest book ---------- */
  const BOOKS = { book: COOKBOOK, guests: GUESTBOOK };
  const bookSound = n => ({ lift: SFX.bookLift, land: SFX.bookLand, open: SFX.bookOpen, close: SFX.bookClose, down: SFX.bookDown, flip: SFX.flip, settle: SFX.pageSettle, tap: SFX.tap }[n] || (() => {}))();
  const metList = () => (G.mode === 'play' ? G.met : ((loadSave() || {}).met || []).filter(id => GUESTS.some(gt => gt.id === id)));
  COOKBOOK.init({ sound: bookSound, close: () => closeUI() });
  GUESTBOOK.init({ sound: bookSound, close: () => closeUI(), img: id => IMG[id], met: metList, aff: () => (G.mode === 'play' ? G.aff : ((loadSave() || {}).aff || {})) });
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
      if (G.shop !== 'morning') { finishDay(); G.day++; G.shop = 'morning'; G.signWas = 'morning'; G.signT = G.t; G.waiting = 0; saveGame(G.day); }
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
      G.gear = GEAR.slice(); KITCHEN.refresh(); fixMenu(); SFX.bell(); toast('Cheat: max level, the whole ' + ROAD_NAME + ' completed'); cheatBuf = ''; return true;
    }
    return false;
  }
  $('lvl').onclick = () => { if (!G.ui && G.mode === 'play') openUI('road'); };
  $('road-close').onclick = closeUI;

  /* ---------- the Ramen Road (js/journey.js): XP only; every stop up to your level unlocks by itself ---------- */
  const xpFloor = () => LEVEL_XP[G.level - 1], xpNext = () => LEVEL_XP[G.level];
  // lead: text to show before any level-up news (a quest reward, say), in one toast
  function gainXP(n, x, lead = '') {
    G.xp += n; if (x !== undefined) pop('+' + n + ' XP', x, 196, '#9fd8ff');
    const lv0 = G.level;
    while (G.level < LEVEL_XP.length && G.xp >= LEVEL_XP[G.level]) G.level++;
    if (G.level > lv0) {
      const had = G.owned.slice(), got = unlockReached();
      G.lvQueue.push({ from: lv0, to: G.level, stops: G.owned.filter(id => !had.includes(id)), notes: got });
      if (lead) toast(lead.trim());
    } else if (lead) toast(lead.trim());
    if (G.ui === 'road') JOURNEY.refresh();
  }
  const claimable = () => [];
  /* ---------- the level-up celebration: the game pauses for a popup with a fanfare, a burst of sparks and light rays,
     the new level, and everything the road just unlocked ---------- */
  let lvShownAt = -9;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const iconURL = (draw, w = 26, h = 26) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; draw(g); return c.toDataURL(); };
  function unlockItem(id, i) {
    const s = nodeFor(id); if (!s) return '';
    const chips = [
      ...TOPS.filter(t => TOP_NODE[t] === id).map(t => `<span><img src="${iconURL(g => ART.top(g, t, 13, 13))}" alt="">${esc(TOP_NAME[t])}</span>`),
      ...Object.keys(TARES).filter(k => TARES[k].node === id).map(k => `<span><i style="--c:${TARES[k].c}"></i>${esc(TARES[k].name)}</span>`),
      ...Object.keys(BROTHS).filter(k => BROTHS[k].node === id).map(k => `<span><i style="--c:${BROTHS[k].c}"></i>${esc(BROTHS[k].name)}</span>`)
    ];
    if (id === 'hiyashi') chips.push('<span><i style="--c:#c8eefc"></i>The ice bath</span>');
    let pic = '', kind = '', title = esc(s.name), sub = '';
    if (s.kind === 'recipe') {
      const m = MENU[s.menu];
      pic = `<img src="${ART.figURL(s.menu)}" alt="">`; kind = 'NEW RECIPE \u00b7 ' + TIER_NAME[m.tier].toUpperCase();
      title = `<b><i class="lu-dot" style="--c:${m.c}"></i>${esc(m.name)}</b>`;
      sub = esc(TARES[m.tare].name + ' + ' + BROTHS[m.broth].name.toLowerCase()) + ` \u00b7 ${m.price}G` + (G.menu.includes(s.menu) ? ' \u00b7 on the menu' : ' \u00b7 add it at the menu board');
    } else if (s.kind === 'upgrade') {
      pic = `<img src="${NIGHTSHOP.artURL(id)}" alt="">`; kind = 'NEW UPGRADE'; title = `<b>${esc(s.name)}</b>`;
      sub = esc(s.desc) + ` On sale at Kitsune-ya for ${s.cost}G.`;
    } else {
      pic = `<img src="${iconURL(g => { PX.ell(g, 13, 13, 11, 11, PX.OUTLINE); PX.ell(g, 13, 13, 10, 10, '#e0b040'); PX.ell(g, 12, 12, 7, 7, '#ffe08a'); PX.textC(g, '\u2605', 13, 6, '#9a6a22'); })}" alt="">`;
      kind = 'LANDMARK \u00b7 ' + esc(s.place); title = `<b>${esc(s.name)}</b>`;
      sub = (s.gold ? '+' + s.gold + 'G. ' : '') + esc(s.desc || '');
    }
    return `<li class="lu-item" style="--i:${i}"><span class="lu-pic">${pic}</span><span class="lu-txt"><span class="lu-kind">${kind}</span>${title}<small>${sub}</small>${chips.length ? `<span class="lu-chips">${chips.join('')}</span>` : ''}</span></li>`;
  }
  function showLevelUp(e) {
    G.ui = 'levelup'; G.drag = null; G.dragBowl = null; lvShownAt = G.t;
    const word = 'LEVEL UP!';
    $('lu-banner').innerHTML = [...word].map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
    $('lu-old').textContent = e.from; $('lu-new').textContent = e.to;
    const reg = REGIONS[G.region || 0], next = STOPS[frontierIdx()];
    $('lu-sub').textContent = ROAD_NAME + ' \u00b7 ' + reg.name;
    const items = e.stops.slice(0, 5).map(unlockItem).join('');
    $('lu-list').innerHTML = items || `<li class="lu-none">${next ? 'Next on the road: <b>' + esc(next.name) + '</b> at level ' + next.level + '.' : 'The whole road is yours!'}</li>`;
    $('lu-list').insertAdjacentHTML('beforeend', e.stops.length > 5 ? `<li class="lu-none">...and ${e.stops.length - 5} more on the road map.</li>` : '');
    $('levelup').style.setProperty('--n', Math.min(5, e.stops.length));
    // the burst: sparks and stars flying out from behind the card
    const sp = $('lu-sparks'); sp.innerHTML = '';
    const cols = ['#ffd76a', '#ffe08a', '#fff6d0', '#ff8a6a', '#6fbf4a', '#8ad8ff', '#f8a0b8'];
    for (let k = 0; k < 46; k++) {
      const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 170, el = document.createElement('span');
      el.className = 'lu-spark' + (k % 3 === 0 ? ' star' : '');
      el.style.cssText = `--c:${cols[k % cols.length]};--dx:calc(${Math.round(Math.cos(a) * r)} * var(--u));--dy:calc(${Math.round(Math.sin(a) * r * 0.7)} * var(--u));--r:${Math.round(Math.random() * 360)}deg;--t:${(0.9 + Math.random() * 0.9).toFixed(2)}s;--d:${(Math.random() * 0.35 + (k > 30 ? 0.5 : 0.05)).toFixed(2)}s`;
      sp.appendChild(el);
    }
    const lu = $('levelup'); lu.classList.remove('show'); void lu.offsetWidth; lu.classList.add('show');
    SFX.fanfare();
  }
  function closeLevelUp() {
    $('levelup').classList.remove('show'); $('lu-sparks').innerHTML = '';
    if (G.ui === 'levelup') G.ui = null;
    SFX.tap();
  }
  $('lu-btn').onclick = () => { if (G.t - lvShownAt > 0.6) closeLevelUp(); };
  // Unlock one stop (it must be the next on the road and within your level). Returns a short note for the toast.
  function claimStop(id) {
    const n = nodeFor(id), f = frontierIdx();
    if (!n || STOPS.indexOf(n) !== f || !stopReady(n)) return '';
    G.owned.push(id); if (n.gold) G.gold += n.gold;
    KITCHEN.refresh();
    let note = n.kind === 'upgrade' ? n.name + ' on sale at Kitsune-ya' : n.kind === 'recipe' ? '' : n.place + (n.gold ? ' (+' + n.gold + 'G)' : '');
    if (n.kind === 'recipe') {   // a new recipe goes straight onto the menu if there is a free slot; otherwise the player picks
      fixMenu();
      if (G.menu.length < menuSlots() && !G.menu.includes(n.menu) && menuTops(G.menu.concat(n.menu)).length <= RACK) { G.menu.push(n.menu); note = n.name + ' is on the menu'; }
      else note = n.name + ' learned (the menu is full: swap it in at the menu board)';
      menuChanged();
    }
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
    const L = G.level, r = k => seeded(day * 13 + k), menus = (fixMenu(), G.menu.slice());
    const kinds = ['served', 'sold', 'perfect', 'earn'], k = day === 1 ? 'served' : kinds[Math.floor(r(1) * kinds.length)];
    let q;
    if (k === 'served') q = { k, n: 3 + Math.floor(L * 0.7) + Math.floor(r(2) * 3) };
    else if (k === 'sold') q = { k, type: menus[Math.floor(r(3) * menus.length)], n: 3 + Math.floor(L / 3) + Math.floor(r(2) * 3) };
    else if (k === 'perfect') q = { k, n: 2 + Math.floor(L / 2) + Math.floor(r(2) * 2) };
    else q = { k, n: Math.round((40 + L * 18 + r(2) * 30) / 5) * 5 };
    return Object.assign(q, { day, done: false, xp: 20 + L * 6 + (k === 'perfect' || k === 'earn' ? 10 : 0), gold: 15 + L * 5 });
  }
  const questHave = q => G.shop === 'morning' ? 0 : q.k === 'served' ? G.stats.served : q.k === 'sold' ? G.stats.sold[q.type] || 0 : q.k === 'perfect' ? G.stats.perfect : G.stats.earned;
  // the quest card folds down to a chip from its header; the choice is a per-player convenience, kept in localStorage
  let questShown = '';
  function setQuestMin(min) {
    $('quest').classList.toggle('min', min);
    $('quest-head').setAttribute('aria-expanded', String(!min));
    $('quest-head').title = min ? 'Show quest' : 'Hide quest';
    try { localStorage.setItem('cozyramen.questMin', min ? '1' : '0'); } catch (e) { /* storage blocked: fine */ }
  }
  try { if (localStorage.getItem('cozyramen.questMin') === '1') setQuestMin(true); } catch (e) { /* storage blocked: start open */ }
  $('quest-head').addEventListener('click', () => { setQuestMin(!$('quest').classList.contains('min')); SFX.tap(); });
  $('quest').addEventListener('animationend', () => $('quest').classList.remove('ping'));
  const questText = q => q.k === 'served' ? `Serve ${q.n} guests` : q.k === 'sold' ? `Serve ${q.n} ${MENU[q.type].name}` : q.k === 'perfect' ? `Serve ${q.n} perfect bowls` : `Earn ${q.n}G today`;
  function updateQuest() {
    if (G.mode !== 'play') return;
    if (!G.quest || G.quest.day !== G.day) G.quest = makeQuest(G.day);
    const q = G.quest;
    if (!q.done && !TUT.handover() && questHave(q) >= q.n) {   // (the handover is practice: the quest waits for Day 1)
      q.done = true; G.gold += q.gold; SFX.coin(); SFX.ding(); hearts(VW / 2 + G.cam, 120, 6);
      gainXP(q.xp, undefined, 'Daily quest complete! +' + q.xp + ' XP, +' + q.gold + 'G. ');
    }
    const have = Math.min(questHave(q), q.n), shown = q.done ? 'Done' : have + '/' + q.n, el = $('quest');
    if (el.classList.contains('min') && questShown && questShown !== shown) { el.classList.remove('ping'); void el.offsetWidth; el.classList.add('ping'); }
    questShown = shown;
    setText('quest-text', questText(q));
    setText('quest-n', shown);
    setText('quest-reward', '+' + q.xp + ' XP  +' + q.gold + 'G');
    $('quest-fill').style.width = Math.round(100 * (q.done ? 1 : have / q.n)) + '%';
    $('quest').classList.toggle('done', q.done);
  }
  NIGHTSHOP.init({
    sfx: SFX, say, toast, img: IMG.aoi,
    save: () => saveGame(G.shop === 'night' ? G.day + 1 : G.day),
    // a new save's first visit to Kitsune-ya: Aoi's welcome line (shown once, then pinned to the How to Play board)
    // (a player who skipped the handover has not heard her name yet, so she introduces herself first)
    tutGreet: () => { if (TUT.guiding()) return ''; if (!G.tut || TUT.seen('d.shop')) return null; G.tut.seen.push('d.shop'); return (G.tut.fresh ? "I'm Aoi! I used to run your stall. " : '') + TUT.NOTES['d.shop'].t; },
    back: st => { G.where = null; G.drag = null; G.staffT = G.staffDoor = 0; G.st = st; G.cam = camTarget(); SFX.whoosh(); STATIONS.forEach((s, k) => $('tab-' + s.id).classList.toggle('on', k === st)); }
  });
  JOURNEY.init({
    claim: claimStop, close: () => closeUI(), sound: n => (n === 'tap' ? SFX.tap() : null),
    setRegion: r => { if (!regionOpen(r) || G.region === r) return; G.region = r; SFX.whoosh(); toast('Your shop is now in ' + REGIONS[r].name + '.'); }
  });
  $('dialog').addEventListener('pointerdown', advance);

  /* ---------- Aoi's tutorial (js/tutorial.js): where things are, and what the kitchen needs next ---------- */
  // The step a stalled cook is on (for Aoi's kitchen notes), or null when nothing needs doing.
  function kPhase() {
    if (!G.slips.length) return null;
    for (const b of G.bowls) if (b.s >= 3) { const s = slipFor(b); if (s) { const off = orderDiff(b, s.order); if (!off.length) return 'pass'; if (off.some(o => o.startsWith('extra'))) return 'extra'; } }
    const best = Math.max(...G.bowls.map(b => b.s));
    if (best >= 3) return 'tops';
    if (best === 2) return G.baskets.some(b => b.t >= cookTime()) ? 'ready' : G.baskets.some(b => b.t >= 0) || G.ice > 0 ? null : 'noodle';
    return best === 1 ? 'broth' : 'tare';
  }
  function domSpot(id) {   // an HTML element's centre, in canvas coordinates
    const r = canvas.getBoundingClientRect(), el = $(id).getBoundingClientRect();
    return r.width ? { x: (el.left + el.width / 2 - r.left) / r.width * VW, y: (el.top + el.height / 2 - r.top) / r.height * VH } : { x: VW - 80, y: 24 };
  }
  TUT.init({
    sfx: SFX, settings: SETTINGS, img: IMG.aoi, kPhase, guestBtn: () => domSpot('btn-guests'),
    R: {
      sign: () => signRect, door: () => doorRect, seat: i => seatRect(i), drop: i => dropRect(i), coins: coinRect,
      ticket: i => SERVING.ticketRect(i),
      edge: side => ({ x: side < 0 ? 4 : VW - 44, y: VH / 2 - 24, w: 40, h: 44, screen: true }),   // the edge buttons (screen)
      tare: type => tareRect(Math.max(0, TARE_SLOTS.indexOf(type))), pot: type => potRect(Math.max(0, BROTH_SLOTS.indexOf(type))),
      noodle: () => noodleRect, basket: j => basketRect(j), bin: id => (binOf(id) >= 0 ? binRect(binOf(id)) : null), binAt: k => binRect(k),
      bowl: k => bowlRect(k), pass: () => passRect, tray: i => pickSlot(i), book: () => bookRect,
      slip: gu => { const s = G.slips.find(o => o.guest === gu); return s && s.x !== undefined ? { x: s.x - 2, y: KL.SLIP_Y - 10, w: ART.SLIP_W + 4, h: ART.slipH(s.order) + 14, screen: true } : null; }   // an order slip on the kitchen rail (screen)
    },
    // the guided bowl begins: back to the serving room, a clean kitchen, and enough of each staple for the bowl (Aoi brought some)
    prep: () => {
      go(0); G.scam = STATIONS[0].cam; G.drag = null; G.dragBowl = null; G.rmMenu = null;
      G.bowls = [newBowl(), newBowl()]; G.baskets.forEach(b => { b.t = -1; }); G.pass = []; G.activeBowl = null;
      for (const id of ['noodle', tareKey('miso'), brothKey('pork'), 'chashu', 'egg', 'scallion']) G.stock[id] = Math.max(G.stock[id] || 0, 2);
    },
    after: () => { G.spawnT = rand(4, 8); },
    PHASE,
    domRect: sel => {   // an HTML control's box, in canvas coordinates (the HUD: Aoi points at it from below)
      const el = document.querySelector(sel); if (!el) return null;
      const r = canvas.getBoundingClientRect(), b = el.getBoundingClientRect(); if (!r.width) return null;
      return { x: (b.left - r.left) / r.width * VW, y: (b.top - r.top) / r.height * VH, w: b.width / r.width * VW, h: b.height / r.height * VH, screen: true, dom: true };
    },
    // the end of the handover (or skipping it): the first real morning, with whatever was earned and bought
    startDay: () => {
      const day = (G.tut && G.tut.day0) || G.day;
      NIGHTSHOP.closePanels(); G.where = null; G.receipt = null; if (G.ui === 'receipt') G.ui = null;
      G.stalls.forEach(st => { st.guest = null; st.left = 0; st.paid = false; st.bowl = null; st.blind = 1; st.holdUp = 0; });
      G.walkers = []; G.waiting = 0; G.slips = []; G.pass = []; G.flying = []; G.bowls = [newBowl(), newBowl()]; G.baskets.forEach(b => { b.t = -1; });
      G.drag = null; G.dragBowl = null; G.rmMenu = null; G.activeBowl = null; G.ticketZoom = -1; G.tutGu = null; G.hold = null;
      G.day = day; G.time = 0; G.shop = 'morning'; G.signWas = 'night'; G.signT = G.t; G.dayDone = false; G.stats = newStats(); G.quest = null;
      G.tut.handover = false; G.tut.done = true; G.tut.step = null; delete G.tut.day0;   // (Aoi's last lines play over the morning; the save already counts as handed over)
      go(0); G.scam = STATIONS[0].cam; G.cam = camTarget(); updateClock(0);
      saveGame(day);
    }
  });

  /* ---------- clock (mood only) ---------- */
  /* ---------- shop hours: the sign, closing time, the night ---------- */
  function setShop(state) { G.signWas = G.shop; G.shop = state; G.signT = G.t; SFX.clack(); }
  function openShop() {
    if (G.shop === 'night') { finishDay(); G.day++; G.time = 0; }      // skipping the prep time (04:00-09:00) to the next opening
    saveGame(G.day);
    setShop('open'); G.stats = newStats(); G.dayDone = false; G.spawnT = TUT.guiding() ? 1.5 : rand(4, 10); SFX.bell();   // the first guest of the day, a few seconds after opening
    if (!TUT.guiding()) toast('Day ' + G.day + ': the shop is open! Guests will start arriving.');
  }
  function closeShop() {
    setShop('night'); G.waiting = 0; G.spawnT = rand(40, 60);
    saveGame(G.day + 1);
    if (!TUT.handover()) toast('21:00, closing time. A few late walk-ins until 04:00, then the day\'s receipt. Aoi\'s supply shop across the street opens at 04:00.');
  }
  // The shop fully closes at 04:00: the day is done and its receipt prints (late walk-ins included). Skipping the night
  // before then prints it straight away. Once per day.
  function finishDay() {
    if (G.dayDone) return;
    G.dayDone = true;
    G.life.bestDay = Math.max(G.life.bestDay, G.stats.earned); if (!TUT.handover()) G.life.days++;   // (the handover is not a day)
    makeReceipt();
  }
  // The sign: opens the shop in the morning; after 04:00 it skips the prep time straight to the next opening.
  function flipSign() {
    if (G.shop === 'open') return say('The shop stays open until 21:00.');
    if (lateOpen()) return say('Late walk-ins until 04:00. Then the shop closes and you can skip the prep time.');
    if (G.shop === 'night' && TUT.armedFor(G.day + 1)) {   // REPLAY TUTORIAL: skip to the morning, where Aoi is waiting (she has you flip the sign)
      finishDay(); G.day++; G.time = 0; G.shop = 'morning'; G.signWas = 'night'; G.signT = G.t; SFX.clack(); saveGame(G.day);
      return;
    }
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
  // 04:00 until the 09:00 opening: the shop is fully closed (no late walk-ins; anyone still seated heads home at 04:00).
  const lateOpen = () => G.shop === 'night' && !shutHours();   // 21:00-04:00: the sign stays OPEN for late walk-ins
  const shutHours = () => { const h = hour(); return G.shop !== 'open' && h >= 4 && h < 9; };
  function updateClock(dt) {
    updateWeather(dt);
    const wasEvening = isNight();
    if (G.shop !== 'morning' && !TUT.freeze()) G.time += dt;   // the clock waits at 09:00 until you open (and while Aoi walks you through your first bowl)
    if (G.shop === 'open' && G.time >= PHASE) closeShop();
    else if (G.shop === 'night' && G.time >= PHASE * 2) { G.time = 0; G.day++; G.shop = 'morning'; G.signWas = 'morning'; saveGame(G.day); toast('Good morning! Flip the sign when you are ready to open.'); }
    else if (G.shop === 'open' && !wasEvening && isNight() && !TUT.handover()) toast('Evening falls. The night crowd is a quieter bunch.');
    if (G.shop === 'night' && shutHours() && !G.dayDone) {   // 04:00 (or any time after it, if the clock jumped): lights out for the last walk-ins, once a night
      let n = 0;
      G.stalls.forEach((st, i) => { if (st.guest) { G.slips = G.slips.filter(o => o.guest !== st.guest); leaveSeat(i, false); n++; } });
      G.waiting = 0;
      G.signT = G.t; SFX.clack();   // the sign flips to CLOSED
      if (!TUT.handover()) toast('04:00. The shop is fully closed until morning' + (n ? ': the last guests head home.' : '.'));
      finishDay();
    }
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
  // where the HUD's gold counter sits, in canvas coordinates (coins fly there)
  function goldSpot() {
    const r = canvas.getBoundingClientRect(), el = $('gold').getBoundingClientRect();
    return r.width ? [(el.left + el.width / 2 - r.left) / r.width * VW, (el.top + el.height / 2 - r.top) / r.height * VH] : [200, 54];
  }
  function update(dt) {
    G.t += dt;
    updateDialog(dt);
    TUT.update(dt);
    if (G.receipt && !G.ui && !G.paused && G.mode === 'play' && !G.where) { G.ui = 'receipt'; G.drag = null; G.dragBowl = null; G.receipt.t0 = G.t; SFX.print(); }   // (it waits until you are back from Kitsune-ya)
    if (G.ui === 'receipt') { updateReceipt(dt); return; }
    if (G.lvQueue && G.lvQueue.length && !G.ui && !G.paused && G.mode === 'play' && !G.where && !G.drag && !G.hold) showLevelUp(G.lvQueue.shift());
    if (G.ui === 'levelup') return;
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
    G.edgeSide = edgeBtnAt(m) || (busy ? 0 : side);
    if (G.mouse) { const vx = G.lastMX === undefined ? 0 : (G.mouse.x - G.lastMX) / Math.max(dt, 0.001); G.mvx = (G.mvx || 0) * 0.88 + vx * 0.12; G.lastMX = G.mouse.x; }
    updateReceipt(dt);
    // kitchen
    updateFlying(dt); updateHold(dt); G.activeShown = activeIndex();
    for (const b of G.baskets) if (b.t >= 0) { const was = b.t < cookTime(); b.t += dt; if (was && b.t >= cookTime()) SFX.ding(); }
    for (const b of G.bowls) { b.age += dt; if (b.broth && b.fill < 1) b.fill = Math.min(1, b.fill + dt * 2.5); }
    for (const b of G.pass) b.age += dt;
    for (const s of G.slips) s.age += dt;
    tickJobs(dt);
    G.steamT -= dt;
    if (G.steamT <= 0 && G.cam > 480) {
      G.steamT = 0.05;
      const src = [];   // (pots and the boiler draw their own steam wisps)
      G.bowls.forEach((b, k) => { if (b.broth && !b.cold) src.push([K(KL.bowlX[k]), KL.BOWL_Y - 6, 32]); });   // (cold ramen does not steam)
      const [x, y, w] = src.length ? pick(src) : [0, 0, 0];
      if (src.length) G.parts.push({ type: 'steam', x: x + rand(-w, w), y, vx: 0, vy: rand(-32, -14), life: rand(0.8, 1.7), max: 1.7 });
    }
    const gold = goldSpot();
    for (const p of G.parts) {
      if (p.type === 'coin') {
        p.k += dt * 1.5; const k = clamp(p.k, 0, 1), e = k * k, tx = G.cam + gold[0];
        p.x = p.x0 + (tx - p.x0) * e; p.y = p.y0 + (gold[1] - p.y0) * e - Math.sin(k * Math.PI) * 60;
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
    c.push({ r: bookRect, fn: () => openUI('book', 'counter') });
    c.push({ r: signRect, fn: flipSign });
    // the pass is a doorway: walk through it to the serving room (bowls waiting in it are still picked up as usual)
    const wm = world(G.mouse);
    if (!G.pass.some((b, i) => inR(wm, passSlot(i)))) c.push({ r: passRect, fn: () => go(0) });
    c.push({ r: doorRect, fn: openStaffDoor });
    c.push({ r: SERVING.MENU_RECT, fn: () => openUI('menu') });   // the menu board on the back wall
    c.push({ r: SERVING.KITCHEN_RECT, fn: () => go(STATIONS.findIndex(s => s.id === 'kitchen')) });   // the kitchen doorway, behind its noren
    for (let i = 0; i < SL.NSTALL; i++) {   // coins a guest left on the counter: tap to collect them now
      const st = G.stalls[i];
      if (!st.guest && st.left > 0 && st.paid) c.push({ r: coinRect(i), fn: () => { clearSeat(i); SFX.coin(); } });
    }
    for (let i = 0; i < SL.NSTALL; i++) {
      if (!stallOpen(i)) { c.push({ r: SERVING.lockedRect(i), fn: () => lockedStall(i) }); continue; }
      c.push({ r: SERVING.cardRect(i), fn: () => openUI('menu') });   // the stall's own menu card
      const gu = G.stalls[i].guest;
      if (gu && gu.state === 'call' && G.stalls[i].blind < 0.3) c.push({ r: seatRect(i), fn: () => takeOrder(gu) });        // a calling guest: take the order
      else if (gu && gu.state === 'wait' && G.stalls[i].blind < 0.3) c.push({ r: seatRect(i), fn: () => checkIn(gu) });     // a waiting guest: a chat (or cancel)
    }
    return c;
  }
  canvas.addEventListener('pointermove', e => { G.mouse = toScreen(e);
    const pr = G.drag && G.drag.press;
    if (pr && !pr.moved && !pr.held && Math.hypot(G.mouse.x - pr.x, G.mouse.y - pr.y) > 6) { pr.moved = true; G.dragBowl = G.drag.bowl || null; SFX.pick(); } if (G.mode === 'title' || G.ui === 'pause') TITLE.move(G.mouse); else if (G.where) NIGHTSHOP.move(G.mouse); });
  canvas.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch' && !G.drag) G.mouse = null; });
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (e.button === 2) return;   // right button: the remove menu (contextmenu)
    if (G.rmMenu && G.mode === 'play' && !G.ui) {   // the remove menu is open: pick a topping, or click away to close it
      const p0 = toScreen(e), m = G.rmMenu, r = rmRow(m, p0); G.mouse = p0;
      if (r >= 0) removeTopping(m.k, m.ids[r]); else SFX.tap();
      G.rmMenu = null; return;
    }
    if (G.mode === 'title' || G.ui === 'pause') return TITLE.down(toScreen(e));
    if (G.ui === 'dialog') { pickDefault(); return; }   // a tap outside the dialog box takes its default choice, if it has one
    if (G.ui === 'receipt') {
      const p = toScreen(e), r = G.receipt; G.mouse = p;
      if (r && !r.fly && inR(p, receiptRect())) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ } G.drag = { kind: 'receipt', ox: p.x - r.x, oy: p.y - r.y }; SFX.paper(); }
      return;
    }
    if (G.paused || G.ui) return;
    const p = toScreen(e), w = world(p); G.mouse = p;
    if (TUT.click(p)) return;    // Aoi's bubble (or any click while she is just talking): her next line
    if (TUT.blocks(p)) return;   // the guided first bowl: clicks outside the highlighted target do nothing
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
    if (G.where) return NIGHTSHOP.down(p);
    const rc = G.receipt;
    if (rc && !rc.fly && inR(p, receiptRect())) { G.drag = { kind: 'receipt', ox: p.x - rc.x, oy: p.y - rc.y }; SFX.paper(); return; }
    const sl = slipAt(p);
    if (sl) { G.drag = { kind: 'slip', slip: sl, ox: p.x - sl.x }; G.slips = G.slips.filter(o => o !== sl).concat(sl); SFX.paper(); return; }
    const eb = edgeBtnAt(p);   // the round edge buttons sit on top of the room: they always take the click
    if (eb) return go(G.st + eb);
    const tk = ticketAt(w);   // tapping a seat ticket pins its big version (tap again, or anywhere else, to let go)
    if (tk >= 0) { G.ticketZoom = G.ticketZoom === tk ? -1 : tk; SFX.paper(); return; }
    G.ticketZoom = -1;
    const c = clicks().find(c => inR(w, c.r));
    if (c) { SFX.tap(); return c.fn(); }
    const s = sources().find(s => inR(w, s.r));
    if (s) {
      const d = s.start();
      if (d) { d.press = { x: p.x, y: p.y, t0: G.t, moved: false }; G.drag = d; G.dragBowl = null; }   // a drag once it moves (then the bowl leaves its spot); a click if it does not
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
    if (d.press && !d.press.moved) {   // no drag happened: a click, or the end of a hold step
      if (d.press.held) return finishHold();
      return clickSource(d, e.shiftKey);
    }
    const w = world(toScreen(e));
    const t = targets(d).find(t => inR(w, t.r));
    if (t) t.drop();
  });
  canvas.addEventListener('pointercancel', () => { if (G.hold) finishHold(); G.drag = null; G.dragBowl = null; });
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (G.mode !== 'play' || G.ui || G.paused || G.where) return;
    const p = toScreen(e), w = world(p);
    const k = KL.bowlX.findIndex((bx, i) => inR(w, bowlRect(i)));
    if (k >= 0 && G.bowls[k] !== G.dragBowl) openRemove(k, p); else G.rmMenu = null;
  });
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
    if (G.ui === 'levelup') { if ([' ', 'Enter', 'Escape'].includes(e.key) && G.t - lvShownAt > 0.6) { e.preventDefault(); closeLevelUp(); } return; }
    if (G.ui === 'receipt') { if ([' ', 'Enter', 'Escape'].includes(e.key) && G.receipt && !G.receipt.fly) { e.preventDefault(); G.receipt.fly = { vx: 0, vy: -1400 }; SFX.paper(); SFX.whoosh(); } return; }
    if (G.ui === 'dialog') { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(true); } return; }
    if (G.ui === 'menu' || G.ui === 'road') { if (e.key === 'Escape') closeUI(); return; }
    if (G.paused) { if (e.key === 'Enter') $('modal-btn').click(); return; }
    if (G.where && NIGHTSHOP.key(e)) { e.preventDefault(); return; }
    if (TUT.key(e.key)) { e.preventDefault(); return; }   // Enter / Space: Aoi's next line
    const k = e.key.toLowerCase(), left = k === 'a' || k === 'arrowleft', right = k === 'd' || k === 'arrowright';
    if (k.length === 1 && cheat(k)) return;
    if (TUT.guiding() && !G.where && (/^Digit[0-9]$/.test(e.code) || k === 'tab')) { e.preventDefault(); return; }   // (the guided bowl goes one highlighted thing at a time)
    if (G.where) { if (k === 'escape') openPause(TUT.guiding() ? 'skiptut' : undefined); else if (k === 'm') { muteBefore = muted; $('mute').click(); } return; }
    if (left || right) {
      const side = right ? 1 : -1;
      if (!e.repeat && atPanEnd(side) && G.st + side >= 0 && G.st + side < STATIONS.length) { e.preventDefault(); go(G.st + side); }   // at the end of a room: walk on
      else { e.preventDefault(); held[left ? 'l' : 'r'] = true; G.pan = (held.r ? 1 : 0) - (held.l ? 1 : 0); }                         // otherwise pan while held
    }
    else if (STATIONS[G.st].id === 'kitchen' && /^Digit[1-9]$/.test(e.code)) {   // the topping in bin 1-9, into the active bowl (Shift: just one)
      const id = rackTops()[+e.code.slice(5) - 1], src = id && sources().find(o => o.binId === id);
      if (src) { const d = src.start(); if (d) clickAdd(d, e.shiftKey); }
    }
    else if (STATIONS[G.st].id === 'kitchen' && k === 'tab') { e.preventDefault(); G.activeBowl = (activeIndex() + 1) % G.bowls.length; SFX.tap(); }
    else if (k === '1' || k === '2') go(+k - 1);
    else if (k === 'escape') { if (G.rmMenu) G.rmMenu = null; else if (G.drag) { G.drag = null; G.dragBowl = null; } else if (TUT.guiding()) openPause('skiptut'); else openPause(); }   // (during the guided bowl: skip it, after a confirm)
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
  $('tab-street').onclick = () => { if (G.mode === 'play' && !G.ui && !G.where && !TUT.guiding()) NIGHTSHOP.enter('street'); };
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
      <li><b>Serving.</b> Guests take a stall at the counter, and its bamboo blind rolls up once they sit down. When one calls (a red "!"), tap them to chat and take the order. Can't make it? Politely decline. Tap a waiting guest to chat, or to cancel their order.</li>
      <li><b>Kitchen.</b> Click a tare crock, then a broth pot, then a READY basket: each goes into the glowing bowl. Click a bowl (or press Tab) to choose which. Dragging works too.</li>
      <li><b>Toppings.</b> Click the toppings on the order slip (or press their bin numbers 1-9; Shift adds just one), then drag the bowl into the pass. Some recipes have a special touch: click the chili oil bottle after the broth for spicy ramen; hold on the bowl to pour an oil, grind sesame or torch the meat; click it to slice a mandrake root; right-click it to take a topping off; serve butter before it melts; rinse the noodles for cold ramen in the ice bath.</li>
      <li><b>Serve.</b> Walk into the serving room carrying the tray, and drag the bowl onto the guest's spot at the counter. Their ticket shows the ramen and every change to it. Extra toppings a guest asks for are added to their bill.</li>
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
    basket: 'Drop the noodles into a bowl with broth (or into the ice bath, for cold ramen).', oil: 'Pour the chili oil over a bowl with broth (for spicy ramen).', top: 'Drop it on a bowl with noodles.', cold: 'Drop the chilled noodles into a bowl with broth.', chill: 'Click the ice bath to chill a READY basket.',
    bowl: 'Drop it in the pass, in front of a waiting guest, on an empty bowl spot or in the bin.',
    slip: 'Slide the slip anywhere along the rail.', receipt: 'Fling it away to toss it, or let go to keep reading.'
  };
  function hint() {
    if (G.ui === 'receipt') return 'Closing time! Drag the receipt away (or press Enter) to carry on.';
    if (G.flashT > 0) return G.flash;
    if (G.where) return NIGHTSHOP.hint();
    if (G.drag) return DRAG_HINT[G.drag.kind];
    const id = STATIONS[G.st].id, best = Math.max(...G.bowls.map(b => b.s));
    if (G.shop === 'morning') return id === 'serving' ? 'Tap the CLOSED sign on the counter to open the shop.' : 'The shop is closed. Head to Serving and flip the sign to open.';
    if (G.shop === 'night' && id === 'serving' && !G.stalls.some(s => s.guest)) return NIGHTSHOP.storeOpen() ? (lateOpen() ? 'Late hours: the odd walk-in until 04:00. Kitsune-ya across the street opens at 04:00.' : 'Closed: prep time until 09:00. Kitsune-ya across the street is open: out through the staff door on the far left. Or tap the sign to skip the prep time.') : (lateOpen() ? 'Late hours: the odd walk-in until 04:00. Kitsune-ya across the street opens at 04:00.' : 'Closed: prep time until 09:00. Or tap the sign to skip the prep time.');
    if (id === 'serving') {
      if (G.stalls.some(s => s.guest && s.guest.state === 'call')) return 'A guest is calling. Tap them to take the order.';
      if (G.pass.length && G.stalls.some(s => s.guest && s.guest.state === 'wait')) return 'Drag a bowl from your tray to the guest whose ticket it matches.';
      if (G.slips.length) return 'Orders are on the ticket rail. Head right to cook.';
      return 'All calm. Guests will call when they are ready to order.';
    }
    if (!G.slips.length && best === 0) return 'No orders yet. Restock at Kitsune-ya after closing, or read the recipe book.';
    const ab = G.bowls[activeIndex()], fx = (ab && ab.fx) || {};
    if (fx.ember === 'pending') return 'Hold on the bowl to pour the ember pepper oil. Let go at the right number of swirls.';
    if (fx.mayu === 'pending') return 'Hold on the bowl to pour one swirl of black garlic oil.';
    if (fx.sesame === 'pending') return 'Hold on the bowl to grind the sesame. Let go while it is fine.';
    if (fx.torch === 'pending') return 'Hold on the bowl to torch the meat. Let go while it is golden.';
    if (fx.mandrake === 'whole') return 'Click the bowl to slice the mandrake root. It may squeak.';
    if (best >= 3) return 'Noodles are in. Click the toppings on the slip (keys 1-9, or drag them), then drag the bowl into the pass.';
    if (best >= 2 && G.slips.some(o => MENU[o.order.type].spicy) && G.bowls.some(x => x.s >= 2 && !x.spicy && recipesFor(x.tare, x.broth).some(k => MENU[k].spicy))) return 'Spicy ramen on the rail: click the chili oil bottle to make the broth spicy.';
    if (best === 2 && G.slips.some(o => MENU[o.order.type].cold) && iceOn() && !G.ice) return 'Cold ramen on the rail: rinse READY noodles in the ice bath (click it), then click the ice bath again.';
    if (best === 2) return G.baskets.some(b => b.t >= cookTime()) ? 'Click the READY basket to tip the noodles into the glowing bowl.' : G.baskets.some(b => b.t >= 0) ? 'The noodles are cooking. They will wait for you once ready.' : 'Click the noodle tray to start a basket.';
    if (best === 1) return 'Click the broth pot to ladle broth onto the tare.';
    return 'Click a tare crock: the spoon goes into the glowing bowl. (Dragging works too.)';
  }
  const last = {};
  function setText(id, v) { if (last[id] !== v) { last[id] = v; $(id).textContent = v; } }
  function hud(dt) {
    const h = hour(), hh = Math.floor(h), mm = Math.floor((h - hh) * 6) * 10;
    setText('day', TUT.handover() ? 'Handover' : 'Day ' + G.day);   // (Aoi's practice run is not a numbered day)
    setText('clock', String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'));
    setText('shopstate', G.shop === 'open' || lateOpen() ? 'Open' : 'Closed');
    $('shopstate').classList.toggle('open', G.shop === 'open' || lateOpen());
    UI.set($('sky'), G.rain >= 0.5 ? 'rain' : isNight() ? 'moon' : 'sun');
    rainSound();
    setText('gold', String(G.gold));
    setText('lvnum', 'Lv ' + G.level);
    $('xpfill').style.width = (G.level >= LEVEL_XP.length ? 100 : Math.round(100 * (G.xp - xpFloor()) / (xpNext() - xpFloor()))) + '%';
    updateQuest();
    const calling = G.stalls.filter(s => s.guest && s.guest.state === 'call').length;
    setText('badge-kitchen', G.slips.length ? String(G.slips.length) : '');
    setText('badge-serving', calling ? '!' : G.pass.length ? String(G.pass.length) : '');
    const binTip = G.hoverBin && !G.drag && G.flashT <= 0 ? TOP_NAME[G.hoverBin] + (topOn(G.hoverBin) ? ': ' + G.stock[G.hoverBin] + ' left' : ' (locked)') : '';   // a bin's full name while it is hovered
    setText('hint', TUT.guiding() ? '' : binTip || (hintsOn() ? hint() : G.flashT > 0 ? G.flash : ''));   // hints are optional (on for a new save's first 3 days); warnings always show briefly; quiet while Aoi guides
    $('hint').classList.toggle('warn', G.flashT > 0);
    $('bubbles').style.visibility = !G.where && STATIONS[G.st].id === 'serving' && settled() && G.ui !== 'dialog' ? 'visible' : 'hidden';
    $('tab-street').classList.toggle('gone', !NIGHTSHOP.streetOpen());
    $('tab-street').classList.toggle('on', !!G.where);
    STATIONS.forEach((s, k) => $('tab-' + s.id).classList.toggle('on', !G.where && k === G.st));
    $('nshop').classList.toggle('hide', G.ui === 'pause' || G.mode !== 'play');
    $('quest').classList.toggle('hide', G.mode !== 'play' || !TUT.questShown() || !!G.where || G.ui === 'dialog');   // out of the way of the night street and Aoi's dialogue box
    for (let i = 0; i < SL.NSTALL; i++) {
      const el = $('bubble-' + i);
      el.style.left = `calc(${(SL.X0 + SL.stallCX(i) - G.cam) / 2}px * var(--s))`;
      el.style.top = `calc(${(SERVING.headY(i) - 4) / 2}px * var(--s))`;   // the bubble sits just above this guest's head
      if (bubbleT[i] > 0) { bubbleT[i] -= dt; if (bubbleT[i] <= 0) el.classList.remove('show'); }
    }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('show'); }
    if (G.where) { G.hover = null; G.hoverBin = null; G.tip = null; canvas.style.cursor = NIGHTSHOP.cursor(); return; }
    const w = world(G.mouse);
    G.hover = null; G.hoverBin = null; let pointer = false;
    const overPaper = G.mouse && (!G.ui || G.ui === 'receipt') && !G.drag && ((G.receipt && !G.receipt.fly && inR(G.mouse, receiptRect())) || (!G.ui && slipAt(G.mouse)));
    if (!G.ui && !G.drag && w && !overPaper && !TUT.blocks(G.mouse)) {   // (locked things do not light up during the guided bowl)
      const c = clicks().find(c => inR(w, c.r));
      if (c) { G.hover = c.r; pointer = true; } else { const s = sources().find(s => inR(w, s.r)); if (s) { G.hover = s.r; G.hoverBin = s.binId || null; } }
    }
    G.tip = !G.ui && !G.drag && w && !overPaper ? bowlAt(w) : null;
    canvas.style.cursor = G.drag ? 'grabbing' : pointer ? 'pointer' : (G.hover || overPaper) ? 'grab' : 'default';
  }

  function bowlAt(w) {   // a started bowl on the mat, or a finished one on the tray (in the pass window, or carried)
    for (let k = 0; k < KL.bowlX.length; k++) if (G.bowls[k].s > 0 && inR(w, bowlRect(k))) return G.bowls[k];
    for (let i = 0; i < G.pass.length; i++) if (inR(w, passSlot(i)) || inR(w, pickSlot(i))) return G.pass[i];
    return null;
  }
  // A small paper tag beside the pointer: the ramen this bowl makes, then its changes from the recipe (as on a slip).
  function drawTip(g) {
    const b = G.tip;
    if (!b || !G.mouse) return;
    if (b.s > 0 && !TARES[b.tare]) return;   // (a test bowl without a real tare)
    if (b.s > 1 && !BROTHS[b.broth]) return;
    const INK = '#3a2f2a', FADED = '#9a8a78', lines = [];
    if (b.s === 1) lines.push([TARES[b.tare].short + ' TARE', TARES[b.tare].c === '#e6dcc4' ? INK : TARES[b.tare].c], ['NEEDS BROTH', FADED]);
    else if (b.s === 2) lines.push([TARES[b.tare].short + ' + ' + BROTHS[b.broth].short + (b.spicy ? ' + CHILI OIL' : ''), INK], ['NEEDS NOODLES', FADED]);
    else {
      const id = identify(b);
      if (!id) lines.push(['UNKNOWN BOWL', '#c8302a']);
      else {
        lines.push([MENU[id.type].short, MENU[id.type].c]);
        const mods = ART.slipMods(id);
        for (const md of mods) lines.push([md.t, md.add ? '#2f7a3a' : '#c8302a']);
        if (!mods.length) lines.push(['As on the menu', FADED]);
      }
      if (b.cold) lines.push(['COLD NOODLES', '#2f7aa8']);
    }
    const LH = PX.lineH(), w = Math.max(...lines.map(l => PX.textW(l[0]))) + 20, h = lines.length * LH + 10;   // 10px side and 5px top/bottom padding
    const x = Math.round(Math.min(VW - w - 4, G.mouse.x + 16)), y = Math.round(Math.max(4, Math.min(VH - h - 4, G.mouse.y - h - 6)));
    PX.rect(g, x + 3, y + 3, w, h, 'rgba(40,20,10,0.3)');
    PX.rect(g, x - 1, y - 1, w + 2, h + 2, PX.OUTLINE); PX.rect(g, x, y, w, h, '#fbf6ea'); PX.rect(g, x, y, w, 2, '#e8dcc0');
    lines.forEach(([t, c], i) => PX.text(g, t, x + 10, y + 7 + i * LH, c));
  }

  /* ---------- seat tickets ---------- */
  function ticketAt(w) { for (let i = 0; i < SL.NSTALL; i++) { const r = SERVING.ticketRect(i); if (r && inR(w, r)) return i; } return -1; }

  /* ---------- the open / closed sign (hangs on the serving counter) ---------- */
  const signRect = SERVING.SIGN;   // under the counter's right end, by the kitchen
  function drawSign(g) {
    const S = signRect, cx = S.x + S.w / 2, p = clamp((G.t - G.signT) / 0.45, 0, 1);
    const state = p < 0.5 ? G.signWas : G.shop, open = state === 'open' || (state === 'night' && lateOpen());   // late walk-ins: still OPEN until 04:00
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
    if ((G.shop === 'morning' || (G.shop === 'night' && !lateOpen())) && p >= 1) {   // (no label while late walk-ins keep it OPEN)
      const bob = Math.round(Math.sin(G.t * 4) * 1.5);
      const txt = G.shop === 'night' ? 'Tap: skip prep time' : 'TAP TO OPEN', half = PX.textW(txt) / 2 + 14;
      SCENE.label(g, txt, Math.max(cx, Math.round(G.cam) + half + 4), S.y + S.h + 5 + bob, '#7a2f1a');   // (kept inside the screen)
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
    L.push({ c: 'COZY RAMEN', col: '#8a2a1a' }, { c: TUT.handover() ? 'HANDOVER' : 'DAY ' + G.day + ' TOTAL', col: '#7a5230' }, { hr: 1 });
    const soldTypes = Object.keys(MENU).filter(k => s.sold[k] > 0);
    for (const type of soldTypes.length ? soldTypes : ['miso']) L.push({ l: MENU[type].short.split(' ')[0] + ' X' + s.sold[type], r: s.rev[type] + 'G' });
    L.push({ l: 'TIPS', r: s.tips + 'G' }, { hr: 1 }, { l: 'PROFIT', r: (s.sales + s.tips) + 'G', col: '#2f7a3a' }, { hr: 1 });
    L.push({ l: 'BOWLS SOLD', r: String(s.served) }, { l: 'PERFECT', r: String(s.perfect) }, { l: 'TURNED AWAY', r: String(s.declined) }, { hr: 1 });
    L.push({ c: 'THANK YOU!', col: '#8a2a1a' }, { c: 'Fling away to toss', col: '#a8987a' });
    const hx = Math.round(VW / 2 - RW / 2), hy = Math.max(36, Math.round(VH / 2 - (16 + L.length * 22 + 8) / 2));
    G.receipt = { lines: L, x: hx, y: hy, hx, hy, h: 16 + L.length * 22 + 8, t0: G.t, fly: null, px: hx, py: hy, vx: 0, vy: 0 };   // prints once it becomes the active popup
    if (G.tut && G.tut.fresh && G.day === 1 && !G.tut.handover && !TUT.seen('d.receipt')) { G.receipt.note = true; G.tut.seen.push('d.receipt'); }   // "Not bad for day one! -A"
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
      const ly = y + 14 + i * 22;
      if (L.hr) { for (let k = x + 8; k < x + RW - 8; k += 4) PX.rect(g, k, ly + 4, 2, 1, '#c9b892'); return; }
      if (i === 0 && L.c) return PX.textC(g, L.c, x + RW / 2, ly - 4, PAL.cream);   // shop name sits on the header
      if (L.c) return PX.textC(g, L.c, x + RW / 2, ly, L.col || '#4a3226');
      PX.text(g, L.l, x + 10, ly, L.col || '#4a3226');
      PX.text(g, L.r, x + RW - 10 - PX.textW(L.r), ly, L.col || '#4a3226');
    });
    if (r.note && p >= 1) TUT.receiptNote(g, x + RW - 86, y + 44);   // a new save's first day: Aoi's memo pinned to the corner
  }

  /* ---------- render ---------- */
  // How far held noodles lean: they trail behind the hand, with a little idle sway.
  const swing = () => clamp(-(G.mvx || 0) / 700, -0.8, 0.8) + Math.sin(G.t * 3) * 0.06;
  function drawHeld(g, d, x, y) {
    if (d.kind === 'tare') KITCHEN.spoon(g, x - 4, y + 6, true, TARES[d.type].c);
    else if (d.kind === 'broth') { const b = BROTHS[d.type]; KITCHEN.ladle(g, x - 6, y + 10, true, G.t, [b.c, b.dark, b.light]); }
    else if (d.kind === 'basket') KITCHEN.heldBasket(g, x, y, G.t, swing());
    else if (d.kind === 'nest') KITCHEN.heldNest(g, x, y, G.t, swing());
    else if (d.kind === 'oil') KITCHEN.oilBottle(g, x, y + 20, 9, true);
    else if (d.kind === 'cold') { KITCHEN.heldNest(g, x, y, G.t, swing()); PX.rect(g, x - 10, y - 8, 4, 4, '#e8fbff'); PX.rect(g, x + 7, y - 4, 3, 3, '#c8eefc'); }
    else if (d.kind === 'top') { PX.ell(g, x + 3, y + 14, 10, 3, 'rgba(40,20,10,0.25)'); ART.top(g, d.id, x, y); }
    else if (d.kind === 'bowl') { if (d.pass || G.cam < 480) ART.smallBowl(g, x, y - 6, d.bowl); else ART.bigBowl(g, x, y - 10, d.bowl, false, G.t); }
  }
  // The one button style for clickable things drawn on the canvas: a dark outline, a raised walnut face with a brass
  // rim, a cream arrow; hovered, the face warms up and lifts by 2px.
  // The edge buttons' hit areas (screen coordinates): -1 left, 1 right, 0 neither.
  function edgeBtnAt(p) {
    if (!p || G.ui || G.where) return 0;
    const inBtn = x => p.x >= x - 4 && p.x < x + 36 && p.y >= VH / 2 - 24 && p.y < VH / 2 + 20;
    if (G.st > 0 && inBtn(8)) return -1;
    if (G.st < STATIONS.length - 1 && inBtn(VW - 40)) return 1;
    return 0;
  }
  function edgeButton(g, x, y, hot, dir) {
    const w = 32, h = 40, lift = hot ? 2 : 0, R = PX.rect, DK = PX.OUTLINE;
    R(g, x + 2, y + 4, w, h, 'rgba(20,8,12,0.35)');
    R(g, x, y - lift, w, h, DK); R(g, x + 1, y + 1 - lift, w - 2, h - 2, '#c9962e'); R(g, x + 3, y + 3 - lift, w - 6, h - 6, DK);
    R(g, x + 4, y + 4 - lift, w - 8, h - 8, hot ? '#8a5a32' : '#6e4428'); R(g, x + 4, y + 4 - lift, w - 8, 2, hot ? '#a8784a' : '#8a5a32'); R(g, x + 4, y + h - 6 - lift, w - 8, 2, '#4a2e1a');
    const cx = x + w / 2, cy = y + h / 2 - lift;
    PX.poly(g, dir < 0 ? [[cx + 5, cy - 8], [cx - 6, cy], [cx + 5, cy + 8]] : [[cx - 5, cy - 8], [cx + 6, cy], [cx - 5, cy + 8]], hot ? '#fff6dc' : '#f6e6c0');
  }
  // Your arms holding the serving tray at the bottom of the screen, with the finished bowls on it.
  function drawCarried(g) {
    if (!carrying() || G.mode !== 'play') return;
    const T = TRAY, R = PX.rect, DK = PX.OUTLINE, sway = Math.round(Math.sin(G.t * 2) * 1), y = T.y + sway;
    for (const [ax, dir] of [[T.x - 6, -1], [T.x + T.w - 26, 1]]) {   // the chef's indigo sleeves rising from below, cream cuffs, hands on the rim
      PX.poly(g, [[ax + 3, y + 24], [ax + 29, y + 24], [ax + 33 + dir * 10, VH], [ax - 1 + dir * 10, VH]], DK);
      PX.poly(g, [[ax + 4, y + 25], [ax + 28, y + 25], [ax + 32 + dir * 10, VH], [ax + dir * 10, VH]], '#3a3f62');
      PX.poly(g, [[ax + 4 + (dir < 0 ? 0 : 18), y + 25], [ax + 10 + (dir < 0 ? 0 : 18), y + 25], [ax + 14 + (dir < 0 ? 0 : 18) + dir * 10, VH], [ax + 4 + (dir < 0 ? 0 : 18) + dir * 10, VH]], '#4a5078');
      R(g, ax + 3, y + 19, 26, 7, DK); R(g, ax + 4, y + 20, 24, 5, '#f2ead8'); R(g, ax + 4, y + 24, 24, 1, '#c8bca4');
      R(g, ax + 5, y + 8, 22, 14, DK); R(g, ax + 6, y + 9, 20, 12, '#f0c8a0'); R(g, ax + 6, y + 9, 20, 2, '#ffe0c0'); R(g, ax + 6, y + 19, 20, 2, '#d8a880');
    }
    R(g, T.x + 4, y + T.h, T.w - 8, 4, 'rgba(30,14,10,0.35)');
    R(g, T.x, y, T.w, T.h, DK); R(g, T.x + 1, y + 1, T.w - 2, T.h - 2, '#7a2018'); R(g, T.x + 1, y + 1, T.w - 2, 2, '#a83a2a');
    R(g, T.x + 7, y + 6, T.w - 14, T.h - 14, '#3a1210'); R(g, T.x + 7, y + 6, T.w - 14, 2, '#2a0c0a');
    R(g, T.x + 1, y + T.h - 5, T.w - 2, 4, '#5a1410'); R(g, T.x + 1, y + T.h - 5, T.w - 2, 1, '#c8503a');
    for (const hx of [T.x + 4, T.x + T.w - 16]) R(g, hx, y + 2, 12, 2, '#d8a050');
    // the arms go over the rim, so redraw the hands on top
    for (const ax of [T.x - 6, T.x + T.w - 26]) { R(g, ax + 5, y + 8, 22, 14, DK); R(g, ax + 6, y + 9, 20, 12, '#f0c8a0'); R(g, ax + 6, y + 9, 20, 2, '#ffe0c0'); for (let k = 1; k < 4; k++) R(g, ax + 6 + k * 5, y + 11, 1, 8, '#d8a880'); }
    G.pass.forEach((b, i) => { if (b === G.dragBowl) return; const [x, by] = trayPos(i); ART.smallBowl(g, x, by + sway, b); });
  }
  function render() {
    const cam = Math.round(G.cam);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VW, VH);
    if (G.where) { NIGHTSHOP.draw(ctx); if (G.ui === 'receipt' && G.receipt) { ctx.fillStyle = 'rgba(14,8,20,0.55)'; ctx.fillRect(0, 0, VW, VH); drawReceipt(ctx); } TUT.draw(ctx); return; }   // (Aoi walks you through Kitsune-ya in the handover)
    ctx.save(); ctx.translate(-cam, 0);
    if (cam < SL.X0 + SL.W) { ctx.save(); ctx.translate(SL.X0, 0); SERVING.frame(ctx, G); ctx.restore(); }
    if (cam + VW > KL.X0) { ctx.save(); ctx.translate(KL.X0, 0); KITCHEN.frame(ctx, G); ctx.restore(); }
    drawSign(ctx);
    const w = world(G.mouse);
    ctx.restore(); drawCarried(ctx); if (cam < SL.X0 + SL.W) SERVING.overlay(ctx, G, cam); ctx.save(); ctx.translate(-cam, 0);
    drawCues(ctx); drawFlying(ctx);
    if (G.rmMenu) { ctx.save(); ctx.translate(cam, 0); drawRemove(ctx); ctx.restore(); }
    if (G.drag && !(G.drag.press && !G.drag.press.moved)) {
      const pulse = 0.5 + 0.5 * Math.sin(G.t * 8);
      for (const t of targets(G.drag)) if (t.ok()) SCENE.brackets(ctx, t.r, inR(w, t.r) ? '#ffffff' : PX.mix('#ffd76a', '#fff6d0', pulse), inR(w, t.r));
    } else if (G.hover) SCENE.brackets(ctx, G.hover);
    for (const p of G.parts) SCENE.part(ctx, p);
    for (const p of G.pops) { ctx.globalAlpha = Math.min(1, p.life * 2.5); PX.textC(ctx, p.str, p.x, Math.round(p.y), p.c, PX.OUTLINE); }
    ctx.globalAlpha = 1;
    if (G.drag && w && !(G.drag.press && !G.drag.press.moved)) drawHeld(ctx, G.drag, Math.round(w.x), Math.round(w.y));
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
      edgeButton(ctx, side < 0 ? 8 : VW - 40, VH / 2 - 20, hot, side);
      if (hot) { const name = STATIONS[ni].name.toUpperCase(), w = PX.textW(name) + 12; SCENE.label(ctx, name, side < 0 ? 48 + w / 2 : VW - 48 - w / 2, VH / 2 - 7); }
    }
    drawTip(ctx);
    TUT.draw(ctx);         // Aoi, her highlight and her notes
    NIGHTSHOP.draw(ctx);   // only the fade, while heading out to the street
  }

  /* ---------- layout + loop ---------- */
  function fit() {
    let cs = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    if (SETTINGS.snap && cs >= 2) cs = Math.floor(cs);   // fill the window; snap to whole pixels only when there is room for 2x+
    const root = document.documentElement.style;
    root.setProperty('--s', cs * 2);
    // HTML text sizes: FS k on the canvas is k * cs CSS pixels per font pixel; the web font is 10px per font pixel, so
    // snap to whole multiples of 10px (the font is only crisp on whole pixels). Snap DOWN (with 5% leeway): rounding up
    // made text up to 25% bigger than the boxes it was laid out for, and it ran out of them.
    // Tiny labels (FS 1) are short, so they may grow up to 25% to stay readable.
    for (let k = 1; k <= 4; k++) root.setProperty('--fs' + k, Math.max(1, Math.floor(k * cs * (k === 1 ? 1.25 : 1.05))) * 10 + 'px');
  }
  window.addEventListener('resize', fit); fit();

  let prev = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
    if (G.mode === 'title') { TITLE.update(dt); TITLE.draw(ctx); }
    else {
      update(dt); hud(dt); render();
      G.staffDoor = (G.staffDoor || 0) + clamp((G.staffT || 0) - (G.staffDoor || 0), -dt * 2.4, dt * 2.4);
      if (G.doorShake > 0) G.doorShake -= dt;
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
    G.mode = 'play'; music(false); document.body.classList.remove('title'); TUT.reset();
    for (let i = 0; i < SL.NSTALL; i++) { $('bubble-' + i).classList.remove('show'); bubbleT[i] = 0; }
    STATIONS.forEach((s, k) => $('tab-' + s.id).classList.toggle('on', k === G.st));
    updateClock(0); canvas.style.cursor = 'default';
    if (msg) toast(msg);
  }
  // guided: the player answered "Yes, please" to Aoi's offer to show them around (else "I've got this": notes only)
  function newGame(guided) {
    clearSave(); NIGHTSHOP.closePanels(); Object.assign(G, fresh());
    G.tut = TUT.newState(!!guided); G.aoiMet = true;   // (Aoi handed you the stall: you have met)
    startPlay(guided ? null : 'Welcome to Cozy Ramen! Tap the CLOSED sign on the counter to open.');
  }
  function continueGame() {
    const s = loadSave(); if (!s) return newGame();
    Object.assign(G, fresh()); G.day = s.day; G.gold = s.gold || 0; G.met = (s.met || []).filter(id => GUESTS.some(gt => gt.id === id)); G.nextNum = s.nextNum || 1;
    G.level = s.level || 1; G.xp = s.xp || 0;
    G.xp = Math.max(G.xp, LEVEL_XP[Math.min(G.level, LEVEL_XP.length) - 1]);   // (older saves were on a gentler XP curve: keep their level, start its bar at zero) G.owned = (s.owned || []).filter(id => nodeFor(id));
    G.life = Object.assign(fresh().life, s.life || {}); G.region = regionOpen(s.region || 0) ? s.region || 0 : 0;
    // saves from before the night shop: upgrades already claimed (and paid for) on the road count as bought
    G.gear = (s.gear || G.owned.filter(id => GEAR.includes(id))).filter(id => GEAR.includes(id));
    if (s.pantry) for (const id in s.pantry) if (id in G.stock) G.stock[id] += (s.pantry[id] || 0) * STOCK[id].add;   // saves from the pantry days: packs go in the bins
    G.aoiMet = !!s.aoiMet;
    G.aoi = Object.assign({ seen: 0, visit: 0, buy: 0, chat: 0, notes: 0 }, s.aoi || {});
    // the menu: saves from before the menu editor sell every recipe they had unlocked (up to the menu's slots)
    G.menu = Array.isArray(s.menu) ? s.menu.slice() : Object.keys(MENU).filter(menuOn);
    G.pick = s.pick || 'miso';
    // older builds kept cord fields on each stall (and a save may one day carry them): keep the stalls, drop those fields
    if (Array.isArray(s.stalls)) s.stalls.forEach(o => { if (o) for (const k of ['target', 'openT', 'pendingOrder']) delete o[k]; });
    for (const st of G.stalls) { for (const k of ['target', 'openT', 'pendingOrder']) delete st[k]; st.blind = 1; }
    G.aff = s.aff || {};
    G.quest = s.quest && s.quest.day === s.day ? s.quest : null;
    unlockReached();   // older saves: stops that were waiting on an objective unlock now
    fixMenu();
    const st = { ...(s.stock || {}) };
    if ('tare' in st) { st[tareKey('miso')] = st.tare; delete st.tare; }
    if ('broth' in st) { st[brothKey('pork')] = st.broth; delete st.broth; }
    for (const id in st) if (id in G.stock) G.stock[id] = st[id];
    // Aoi's tutorial: saves from before it never see it (every note counts as pinned); a guided bowl left unfinished starts over this morning
    G.tut = s.tut ? TUT.load(s.tut) : TUT.oldState();
    if (!G.tut.done) G.tut.armDay = Math.min(G.tut.armDay || G.day, G.day);
    startPlay(G.tut.done ? 'Day ' + G.day + '. Good morning! Flip the sign when you are ready to open.' : null);
  }
  function openPause(screen) { G.ui = 'pause'; G.drag = null; G.dragBowl = null; TITLE.openPause(screen); }
  function applySettings() { saveSettings(); fit(); if (mgain) mgain.gain.value = muted ? 0 : SETTINGS.music / 10 * 0.6; }
  function toggleFullscreen() {
    try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { /* not supported */ }
  }
  TITLE.init({
    IMG, settings: SETTINGS, applySettings, toggleFullscreen,
    openGuests: () => openUI('guests'),
    saveInfo: loadSave, met: metList,
    onContinue: continueGame, onNew: newGame, onResume: () => { G.ui = null; }, onQuit: enterTitle,
    // Aoi's tutorial: the hints setting, REPLAY TUTORIAL, skipping the guided bowl, and the notes pinned so far
    hintsOn, setHints: v => { SETTINGS.hints = v; SETTINGS.hintsUser = true; applySettings(); },
    tutArmed: () => G.mode === 'play' && TUT.armed(),
    replayTut: () => { if (G.mode !== 'play' || !G.tut) return; TUT.replay(); toast(G.shop === 'morning' ? 'Aoi is on her way over.' : 'Aoi will drop by first thing tomorrow.'); },
    onSkipTut: () => { TUT.skip(); G.ui = null; },
    tutSeen: () => { if (G.mode === 'play' && G.tut) return G.tut.seen; const s = loadSave(); return s ? (s.tut ? s.tut.seen || [] : TUT.ALL_IDS) : []; },
    startMusic: () => { if (G.mode === 'title') music(true); if (actx && actx.state === 'suspended') actx.resume(); },
    cursor: c => { canvas.style.cursor = c; },
    sfx: {
      move: () => tone(660, 0.04, 'square', 0.025),
      knock: () => { noise(0.04, 700, 0.12); tone(170, 0.07, 'triangle', 0.09, 110); tone(240, 0.04, 'triangle', 0.04, 160, 0.05); },   // a soft wooden knock (the signpost planks)
      back: () => tone(520, 0.08, 'triangle', 0.05, 330), page: () => SFX.paper(), bad: () => SFX.bad(),
      ok: () => { tone(880, 0.06, 'triangle', 0.06); tone(1320, 0.1, 'triangle', 0.05, 0, 0.05); }
    }
  });

  if (params.has('shot')) window.COZY_TEST = { grade, identify, orderDiff, makeOrder, gainXP };   // screenshot/test pages only: rules to check from outside
  // ?shot=kitchen|toppings|serving|dialog|night|drag sets up a scene for screenshots
  function shot(kind) {
    $('modal').classList.remove('show'); G.paused = false; G.ui = null; G.shop = 'open'; G.mode = 'play'; document.body.classList.remove('title');
    document.body.classList.add('shot');   // (screenshot pages: no CSS fades, so a capture shows the finished state)
    if (kind === 'night' || kind === 'nightkitchen') G.time = PHASE * 1.3;
    if (kind.startsWith('evening')) G.time = PHASE * 0.93;
    if (kind === 'kitchenall') { G.owned = STOPS.filter(n => n.kind !== 'start').map(n => n.id); KITCHEN.refresh(); }   // ?shot=kitchenall: every pot and crock unlocked   // ?shot=evening: still open, lamps lit
    if (kind.includes('rain')) { G.wx = { day: G.day, from: -1, to: -1 }; G.forceRain = 1; G.rain = 1; }
    updateClock(0);
    const full = { ...newBowl(), s: 3, tare: true, broth: true, fill: 1, noodles: 'perfect', items: ['chashu', 'egg', 'nori', 'scallion', 'menma', 'chili'], age: 1 };
    for (let i = 0; i < 4; i++) {
      const gu = seatGuest(i); gu.state = 'wait'; gu.t = 5;
      gu.order = makeOrder(gu.gt); gu.num = G.nextNum++; G.slips.push({ num: gu.num, guest: gu, order: gu.order, age: 1 });
    }
    const g1 = G.stalls[1].guest; g1.state = 'eat'; g1.q = 1; g1.pay = 16; G.stalls[1].bowl = { ...full };
    G.slips = G.slips.filter(s => s.guest !== g1);
    const g3 = G.stalls[3].guest; g3.state = 'call'; G.slips = G.slips.filter(s => s.guest !== g3); g3.order = null;
    G.pass.push({ ...full }, { ...full, items: ['chashu', 'egg', 'nori', 'scallion', 'menma'] });
    G.bowls[0] = { ...full, items: ['chashu', 'egg', 'nori'] };
    G.bowls[1] = { ...newBowl(), s: 2, tare: true, broth: true, fill: 1, age: 1 };
    G.baskets[0].t = 9; G.baskets[2].t = 2;
    G.waiting = 1;
    const at = Math.max(0, STATIONS.findIndex(s => s.id === ({ kitchenall: 'kitchen', evening: 'serving', eveningrain: 'serving', servingleft: 'serving', servingleftdoor: 'serving', servingright: 'serving', dialog: 'serving', night: 'serving', drag: 'kitchen', toppings: 'kitchen', nightkitchen: 'kitchen', rainkitchen: 'kitchen' }[kind] || kind)));
    G.kcam = kind === 'kitchen' || kind === 'kitchenall' || kind === 'nightkitchen' ? STATIONS[1].camMax : STATIONS[1].cam;
    G.scam = kind.startsWith('servingright') ? STATIONS[0].camMax : STATIONS[0].cam;   // ?shot=servingright: the far (kitchen) end
    if (kind === 'servingleftdoor') G.staffDoor = G.staffT = 0.5;   // ?shot=servingleft: the far end of the serving room
    G.st = at; G.cam = camTarget(); STATIONS.forEach((s, k) => $('tab-' + s.id).classList.toggle('on', k === at));
    if (kind === 'dialog') { g3.asksRec = true; takeOrder(g3); DLG.i = 1; showStep(); DLG.chars = 999; revealChoices(); }
    if (kind === 'drag') { G.drag = { kind: 'top', id: 'chashu' }; G.mouse = { x: K(KL.bowlX[0]) - G.cam + 10, y: KL.BOWL_Y - 8 }; }
    if (kind.startsWith('book')) { COOKBOOK.goToSpread(+kind.slice(4) || 0); openBook('book', 'counter', true); }   // ?shot=book, book1, book2 ... (spread)
    if (kind === 'guests') openBook('guests', null, true);
    // ?shot=profile (a guest's page, everyone met; profileN for the Nth guest), guests2 (a contents page, everyone met)
    if (kind.startsWith('profile') || kind === 'guests2') {
      G.met = GUESTS.map(gt => gt.id); G.aff = { calista: 9 };
      if (kind === 'guests2') GUESTBOOK.goToSpread(1);
      else GUESTBOOK.showGuest((GUESTS[+kind.slice(7) - 1] || GUESTS.find(gt => gt.id === 'calista')).id);
      openBook('guests', null, true);
    }
    if (kind === 'menu') openUI('menu');   // ?shot=menu: the menu editor
    if (kind === 'levelup') { G.level = 4; showLevelUp({ from: 3, to: 4, stops: ['spicy', 'quick'], notes: [] }); }
    if (kind === 'receipt') { G.stats = { ...G.stats, served: 9, perfect: 6, tips: 14, sales: 118, sold: { miso: 5, shoyu: 4 } }; makeReceipt(); }
    if (kind === 'tut') {   // ?shot=tut: a fresh save's first morning, Aoi walking in
      G.stalls.forEach(st => { st.guest = null; }); G.slips = []; G.pass = []; G.bowls = G.bowls.map(() => newBowl());
      G.shop = 'morning'; G.time = 0; G.tut = TUT.newState(true); updateClock(0);
    }
    if (kind === 'title') enterTitle();
    if (kind.startsWith('title') && kind.length > 5) { enterTitle(); TITLE.openPause(kind.slice(5)); }   // ?shot=titlesettings, titlecredits, titlehelp
    if (kind.startsWith('street') || kind.startsWith('store')) {   // ?shot=street, store, store1..store3 (panned), storecard, storetalk
      G.stalls.forEach(st => { st.guest = null; }); G.slips = []; G.shop = 'night'; G.time = PHASE * 1.08; G.receipt = null; G.gold = 140; updateClock(0);
      G.owned = kind === 'store3' ? STOPS.filter(n => n.kind !== 'start').map(n => n.id) : ['spicy', 'quick']; KITCHEN.refresh();
      NIGHTSHOP.visit(kind.startsWith('street') ? 'street' : 'store', (+kind.slice(5) || 0) * 640);
      if (kind === 'storecard') NIGHTSHOP.inspect('chashu');
      if (kind === 'storelist') NIGHTSHOP.talk('list');
      if (kind === 'storecart') { NIGHTSHOP.addToBasket('chashu', 3); NIGHTSHOP.addToBasket('egg', 2); NIGHTSHOP.addToBasket('special', 1); }
      if (kind === 'storereceipt') { G.gold = 400; NIGHTSHOP.addToBasket('chashu', 3); NIGHTSHOP.addToBasket('special', 1); NIGHTSHOP.addToBasket('quick', 1); if (NIGHTSHOP.pay()) NIGHTSHOP.giveReceipt(); }
      if (kind === 'streetdoor') NIGHTSHOP.setDoors(0.55, 0.5);
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
  // the browser-tab icon: the game's emblem
  try {
    const ic = PX.mk(32, 32), ig = ic.getContext('2d'); SCENE.emblem(ig, 16, 16, 0.56);
    const link = document.querySelector('link[rel="icon"]') || Object.assign(document.createElement('link'), { rel: 'icon' });
    link.type = 'image/png'; link.href = ic.toDataURL(); document.head.appendChild(link);
  } catch (e) { /* the icon is optional */ }

  // Loading: the font, then every guest's portrait. The loading screen (js/loading.js) shows it as a bowl filling up,
  // then waits for a tap (which also unlocks sound), then the title screen. (?shot= test pages skip straight in.)
  let fontDone = false;
  const ready = Promise.all([PX.loadFont().then(() => { fontDone = true; }), ...Object.values(IMG).map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; }))]);
  const imgs = Object.values(IMG);
  if (params.has('shot')) ready.then(() => {
    shot(params.get('shot'));
    // &warm=N: run N seconds of the game first (headless browsers barely tick requestAnimationFrame, so fades and
    // walk-ins would never finish before the capture)
    for (let k = Math.round((+params.get('warm') || 0) * 30); k > 0; k--) { if (G.mode === 'title') TITLE.update(1 / 30); else { update(1 / 30); hud(1 / 30); } }
    prev = performance.now(); requestAnimationFrame(loop);
  });
  else document.body.classList.add('title'), LOADING.run(canvas,   // (the title look hides the HUD while it loads)
    () => { const n = imgs.filter(im => im.complete).length; return { p: (fontDone ? 0.3 : 0) + 0.7 * n / imgs.length, n: imgs.length, done: fontDone && n === imgs.length }; },
    () => music(true),
    () => { enterTitle(); prev = performance.now(); requestAnimationFrame(loop); });
})();
