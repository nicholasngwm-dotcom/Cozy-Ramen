'use strict';
/* The shop cats: your striped Casper on the serving counter, Aoi's tabby Eevee in Kitsune-ya, and the street's strays.
   Sprites are baked by tools/make-cats.mjs into assets/cats/<coat>.png, 64x64 frames: 0-3 grooming, 4-5 meowing,
   6-9 asleep (the RetroCats sheet), then side-on poses made from it: 10-17 walk, 18-19 stand, 20 stretch, 21 crouch,
   22 leap. assets/cats/toys.png holds two balls and a food tin.

   Each cat lives on one or more surfaces ({ x0, x1, y, cap }: a stretch of counter, floor, pavement or a ledge) and
   runs a little plan of actions: walk somewhere, sit and groom, stand and look about, nap (then stretch), hop up to or
   down from a ledge, chase and pounce on its ball, wander over to greet a friend, nibble from its dish, meow. Its
   personality (COATS) weights what it picks next. It notices your cursor: curious cats come over to be petted, shy ones
   keep their distance, a walking cat you point at stops to look. Tap one to pet it (it meows, one of the recordings in
   assets/sfx, and gives off hearts); tap a ball to roll it, and its owner may give chase.

   A scene makes its cats with CATS.make(coat, x, { surfaces, ... }), links neighbours with CATS.group(cats), tells them
   where the pointer is each frame (c.mouse, in the scene's own coordinates), draws them with CATS.draw (before the
   scene's lighting) and their hearts with CATS.fx (after it). */
// Fallback switch: false keeps the cats to the sheet's own frames (sit, groom, meow, sleep). They never walk: they fade
// out and back in somewhere else on their surface (or another surface) instead, and pounce with the sit and meow frames.
const SIDE_POSES = false;
const CATS = (() => {
  const CELL = 64, F = { groom: 0, meow: 4, sleep: 6, walk: 10, stand: 18, stretch: 20, crouch: 21, leap: 22 };
  const STRIDE = 1;   // px walked per walk frame (tools/make-cats.mjs: a planted paw slides back 1px a frame): no foot slide at any speed
  const WALK = 14;    // px a second at speed 1 (an 8-frame stride every ~0.6s)
  // pitch: how its meow is played; speed: walking pace; then how much it likes each pastime (0: never)
  const COATS = {
    casper: { name: 'Casper', pitch: 1.0,  speed: 1.0,  sleepy: 0.3,  wander: 1.0, play: 1.6, curious: 1.2 },                     // yours: playful, comes to say hello
    eevee:  { name: 'Eevee',  pitch: 1.14, speed: 1.1,  sleepy: 0.3,  wander: 1.0, play: 0.5, curious: 0.8, friend: 1.2, eat: 0.8, grumpy: 1 }, // Aoi's: follows Aoi about, snacks; scratches if you overdo the petting
    maple:  { name: 'Maple',  pitch: 1.06, speed: 0.8,  sleepy: 0.6,  wander: 0.9, social: 1.2, perch: 0.4 },                     // gentle and sociable, a napper
    miso:   { name: 'Miso',   pitch: 1.18, speed: 1.35, sleepy: 0.15, wander: 1.6, social: 0.8, play: 1.4, curious: 1.0, perch: 0.5 }, // never still
    nori:   { name: 'Nori',   pitch: 0.98, speed: 0.9,  sleepy: 0.4,  wander: 0.6, shy: 1, perch: 0.9 },                          // shy: keeps away from your hand
    yuki:   { name: 'Yuki',   pitch: 1.1,  speed: 0.85, sleepy: 0.3,  wander: 0.8, social: 0.6, perch: 1.0 },                     // elegant, likes a high seat
    mochi:  { name: 'Mochi',  pitch: 0.92, speed: 0.9,  sleepy: 1.4,  wander: 0.3, social: 0.3, perch: 0.3, home: 1 }               // lives on the vending machine
  };
  const IMG = {};
  for (const id of Object.keys(COATS)) { const im = new Image(); im.src = 'assets/cats/' + id + '.png'; IMG[id] = im; }
  const TOYS = new Image(); TOYS.src = 'assets/cats/toys.png';
  const MEOWS = [1, 2, 3, 4].map(n => { const a = new Audio('assets/sfx/meow' + n + '.mp3'); a.preload = 'auto'; return a; });
  let H = { muted: () => false, vol: () => 0.8 }, lastMeow = -1;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sign = v => v < 0 ? -1 : 1;
  const pickW = opts => { let s = 0; for (const o of opts) s += o[0]; let r = Math.random() * s; for (const o of opts) { r -= o[0]; if (r <= 0) return o[1]; } return opts[opts.length - 1][1]; };

  /* ---------- meows ---------- */
  // a random recording (never the same twice running), pitched for each cat, cut off gently after a couple of seconds
  // (one recording is a long run of meows); soft: a cat meowing to itself, quieter than one you pet
  function meow(pitch = 1, soft = false) {
    if (H.muted()) return;
    const vol = clamp(H.vol(), 0, 1) * (soft ? 0.28 : 0.7);
    if (vol <= 0) return;
    let k = Math.floor(Math.random() * MEOWS.length);
    if (k === lastMeow) k = (k + 1) % MEOWS.length;
    lastMeow = k;
    try {
      const a = MEOWS[k].cloneNode();
      a.volume = vol; a.preservesPitch = false; a.mozPreservesPitch = false; a.webkitPreservesPitch = false;
      a.playbackRate = pitch * rand(0.94, 1.06);
      const p = a.play(); if (p && p.catch) p.catch(() => {});
      setTimeout(() => {
        const fade = setInterval(() => { a.volume = Math.max(0, a.volume - vol / 6); if (a.volume <= 0.01) { clearInterval(fade); a.pause(); } }, 40);
      }, 1700);
    } catch (e) { /* audio is optional */ }
  }

  /* ---------- making cats ---------- */
  // o.surfaces: where it can be (shared by a scene's cats, so ledges can fill up); o.surf: which one it starts on;
  // o.state: 'sleep' to start asleep; o.toy / o.dish: its ball and food tin (CATS.toy / CATS.dish); o.traits: overrides
  function make(coat, x, o = {}) {
    const c = {
      coat, name: COATS[coat].name, T: Object.assign({}, COATS[coat], o.traits), x, surfaces: o.surfaces, surf: o.surf || 0, y: 0,
      dir: o.dir || (Math.random() < 0.5 ? -1 : 1), act: null, plan: [], t: 0, ph: 0, seed: Math.random() * 5, last: null, now: 0,
      toy: o.toy || null, dish: o.dish || null, peers: [], mouse: null, friendX: null, night: false, plays: 0,
      hearts: [], petT: -9, soundT: -9, curT: rand(3, 8), shyT: 0, greetT: -99, hover: false, hoverOnce: false,
      annoy: 0, sulkT: -99, scratches: []   // (grumpy cats) how fed up it is with petting, sulking until, claw marks on screen
    };
    c.y = c.surfaces[c.surf].y;
    begin(c, o.state === 'sleep' ? { do: 'sleep', dur: rand(10, 25) } : { do: 'sit', dur: rand(2, 6) });
    return c;
  }
  const group = cats => { for (const c of cats) c.peers = cats.filter(o => o !== c); return cats; };
  const surface = c => c.surfaces[c.surf];
  const airborne = c => !!c.act && ((c.act.do === 'jump' && c.t >= 0.2 && c.t < 0.2 + c.act.air) || (c.act.do === 'pounce' && c.t >= c.act.wait));
  const busy = c => !c.act || ['jump', 'pounce', 'meow', 'blink', 'swipe'].includes(c.act.do);
  const onSurf = (c, j) => c.surf === j || (c.act && (c.act.do === 'jump' || c.act.do === 'blink') && c.act.to === j) || c.plan.some(a => a.do === 'jump' && a.to === j);

  function begin(c, a) {
    if (!SIDE_POSES) {   // no walking frames: walks and hops become a fade out and back in at the destination
      if (a.do === 'walk') a = { do: 'blink', tx: a.tx };
      else if (a.do === 'jump') a = { do: 'blink', tx: a.tx, to: a.to };
      else if (a.do === 'stand') a = { do: 'sit', dur: a.dur };
      else if (a.do === 'stretch') a = { do: 'sit', dur: 0.6 };
    }
    c.act = a; c.t = 0;
    if (a.do === 'jump') { a.x0 = c.x; a.y0 = c.y; a.y1 = c.surfaces[a.to].y; a.air = 0.38 + Math.abs(a.y1 - a.y0) / 380; }
    if (a.do === 'pounce') { a.x0 = c.x; a.tx = clamp(c.x + c.dir * 18, surface(c).x0, surface(c).x1); a.wait = rand(0.5, 0.9); }
  }
  function interrupt(c, plan) { c.plan = plan.slice(1); begin(c, plan[0]); }
  // the next action: instant ones (turning round, a greeting) happen on the spot
  function next(c) {
    const was = c.act && c.act.do;
    c.act = null;
    if (!c.plan.length) {
      if (was === 'sleep') c.plan = [{ do: 'stretch', dur: 1.2 }, { do: 'stand', dur: rand(1, 2.5) }];   // waking up: a long stretch first
      else c.plan = decide(c);
    }
    for (let guard = 0; guard < 8 && c.plan.length; guard++) {
      const a = c.plan.shift();
      if (a.do === 'face') { if (a.dir) c.dir = a.dir; continue; }
      if (a.do === 'greet') { greetNow(c, a.peer); continue; }
      begin(c, a); return;
    }
    begin(c, { do: 'sit', dur: rand(2, 5) });
  }

  /* ---------- choosing what to do ---------- */
  // somewhere to wander to on its surface, clear of the other cats there
  function spot(c, near = null) {
    const s = surface(c); let best = null, bestD = -1;
    for (let i = 0; i < 10; i++) {
      const x = near === null ? rand(s.x0, s.x1) : clamp(near + rand(-40, 40), s.x0, s.x1);
      if (Math.abs(x - c.x) < 30 && i < 9) continue;
      let d = 999;
      for (const o of c.peers) if (o.surf === c.surf) d = Math.min(d, Math.abs(o.x - x), o.act && o.act.do === 'walk' ? Math.abs(o.act.tx - x) : 999);
      if (d >= 42) return x;
      if (d > bestD) { bestD = d; best = x; }
    }
    return best === null ? c.x : best;
  }
  const idlePlan = () => [Math.random() < 0.55 ? { do: 'sit', dur: rand(3, 8) } : { do: 'stand', dur: rand(2, 5) }];
  function decide(c) {
    const T = c.T, s = surface(c), opts = [], add = (w, fn) => { if (w > 0) opts.push([w, fn]); };
    add(1, () => [{ do: 'sit', dur: rand(4, 10) }]);
    add(0.7, () => [{ do: 'stand', dur: rand(2, 5) }]);
    add((T.sleepy || 0) * (c.night ? 1.3 : 1), () => [{ do: 'sleep', dur: rand(10, 22) }]);
    if (s.x1 - s.x0 > 60) add((T.wander || 0) * 1.3, () => [{ do: 'walk', tx: spot(c) }, ...idlePlan()]);
    if (c.toy && c.toy.surf === c.surf && T.play) add(T.play * (c.plays > 0 && c.plays < 4 ? 2.5 : 1), () => chase(c));
    if (T.social) { const p = pal(c); if (p) add(T.social, () => greet(c, p)); }
    if (c.friendX !== null && T.friend) add(T.friend, () => [{ do: 'walk', tx: clamp(c.friendX + rand(-30, 30), s.x0, s.x1) }, { do: 'sit', dur: rand(4, 9) }]);
    if (c.dish && c.dish.surf === c.surf && T.eat) add(T.eat * 0.6, () => { const side = c.x < c.dish.x ? -1 : 1; return [{ do: 'walk', tx: clamp(c.dish.x + side * 20, s.x0, s.x1) }, { do: 'face', dir: -side }, { do: 'eat', dur: rand(4, 7) }]; });
    // ledges: hop up to one with room, or back down; a cat with a home ledge goes back to it
    c.surfaces.forEach((t, j) => {
      if (j === c.surf || !(T.perch || T.home !== undefined)) return;
      if (c.peers.filter(o => onSurf(o, j)).length >= (t.cap || 1)) return;
      const w = j === T.home ? 2.5 : c.surf === T.home ? 0.2 : j === 0 ? 0.9 : (T.perch || 0) * 0.5;
      add(w, () => hop(c, j));
    });
    add(0.12, () => [{ do: 'meow', dur: 1.3, soft: true }]);
    if (!(c.toy && c.toy.surf === c.surf)) c.plays = 0;
    return pickW(opts)();
  }
  function hop(c, j) {
    const s = surface(c), t = c.surfaces[j];
    const land = j === 0 ? clamp(c.x + sign(rand(-1, 1)) * 34, t.x0, t.x1) : rand(t.x0, t.x1);
    const launch = clamp(land + (c.x < land ? -30 : 30), s.x0, s.x1);
    return [{ do: 'walk', tx: launch }, { do: 'face', dir: land === launch ? c.dir : sign(land - launch) }, { do: 'jump', to: j, tx: land }, ...idlePlan()];
  }
  // play: trot round behind the ball, crouch, wiggle, pounce
  function chase(c) {
    const b = c.toy, s = surface(c), side = c.x < b.x ? 1 : -1, tx = clamp(b.x - side * 24, s.x0, s.x1);
    c.plays++;
    return [{ do: 'walk', tx, run: Math.abs(tx - c.x) > 50 }, { do: 'face', dir: side }, { do: 'pounce' }, { do: 'stand', dur: rand(0.4, 1) }];
  }
  // a friend on the same surface, sitting or standing about, not greeted lately
  function pal(c) {
    const ok = c.peers.filter(o => o.surf === c.surf && o.act && (o.act.do === 'sit' || o.act.do === 'stand') && o.now - o.greetT > 25 && Math.abs(o.x - c.x) > 44);
    return ok.length && c.now - c.greetT > 25 ? ok[Math.floor(Math.random() * ok.length)] : null;
  }
  function greet(c, p) {
    const s = surface(c), side = c.x < p.x ? 1 : -1;
    return [{ do: 'walk', tx: clamp(p.x - side * 30, s.x0, s.x1) }, { do: 'face', dir: side }, { do: 'greet', peer: p }, { do: 'stand', dur: 3 }, { do: 'sit', dur: rand(3, 6) }];
  }
  function greetNow(c, p) {
    if (!p || p.surf !== c.surf || Math.abs(p.x - c.x) > 50 || busy(p) || (p.act && p.act.do === 'sleep')) return;
    p.dir = sign(c.x - p.x); interrupt(p, [{ do: 'stand', dur: 3.2 }, { do: 'sit', dur: rand(3, 6) }]);
    c.greetT = p.greetT = c.now;
    c.hearts.push({ x: (c.x + p.x) / 2, y: c.y - 40, vx: 0, vy: 20, k: 0, life: 1.6 });
  }

  /* ---------- each frame ---------- */
  function senses(c, dt) {
    const m = c.mouse, a = c.act;
    if (!c.hover) c.hoverOnce = false;
    if (!a || busy(c) || a.do === 'sleep') return;
    if (c.hover && a.do === 'walk' && !a.run && !c.T.shy && !c.hoverOnce) { c.hoverOnce = true; interrupt(c, [{ do: 'stand', dur: 1.8 }]); return; }   // you point at it: it stops to look
    if (!m) return;
    const dx = m.x - c.x, near = m.y > c.y - 130 && m.y < c.y + 40, s = surface(c);
    if ((c.T.shy || c.now < c.sulkT) && near && Math.abs(dx) < 70 && c.now > c.shyT) {   // too close (or still sulking): off it goes
      c.shyT = c.now + 2.5;
      const away = clamp(c.x - sign(dx) * rand(130, 220), s.x0, s.x1);
      if (Math.abs(away - c.x) > 20) interrupt(c, [{ do: 'walk', tx: away, run: true }, { do: 'sit', dur: rand(3, 6) }]);
      return;
    }
    if (c.T.curious && c.now > c.sulkT && near && Math.abs(dx) > 34 && Math.abs(dx) < 170 && c.now > c.curT && (a.do !== 'walk' || !a.run) && Math.random() < dt * 0.5 * c.T.curious) {   // comes over to say hello
      c.curT = c.now + rand(9, 15);
      interrupt(c, [{ do: 'walk', tx: clamp(m.x - sign(dx) * 22, s.x0, s.x1) }, { do: 'face', dir: sign(dx) }, { do: 'stand', dur: 2.6 }, { do: 'sit', dur: rand(3, 6) }]);
    }
  }
  function step(c, now) {
    const dt = c.last === null ? 0 : clamp(now - c.last, 0, 0.1); c.last = now; c.now = now;
    for (const h of c.hearts) { h.k += dt / h.life; h.x += h.vx * dt; h.y -= h.vy * dt; }
    c.hearts = c.hearts.filter(h => h.k < 1);
    for (const s of c.scratches) s.k += dt / 0.8;
    c.scratches = c.scratches.filter(s => s.k < 1);
    c.annoy = Math.max(0, c.annoy - dt * 0.4);   // patience comes back slowly
    if (!dt) return;
    senses(c, dt);
    const a = c.act; c.t += dt;
    switch (a.do) {
      case 'walk': {
        const v = WALK * c.T.speed * (a.run ? 1.9 : 1), d = a.tx - c.x;
        if (Math.abs(d) <= v * dt) { c.ph += Math.abs(d) / STRIDE; c.x = a.tx; next(c); }
        else { c.dir = sign(d); c.x += c.dir * v * dt; c.ph += v * dt / STRIDE; }
        break;
      }
      case 'blink': {   // (SIDE_POSES off) fade out, move, fade back in
        if (c.t >= 0.45 && !a.moved) { a.moved = true; if (a.to !== undefined) { c.surf = a.to; c.y = surface(c).y; } c.x = a.tx; c.dir = Math.random() < 0.5 ? -1 : 1; }
        if (c.t >= 0.9) next(c);
        break;
      }
      case 'jump': {
        const k = clamp((c.t - 0.2) / a.air, 0, 1);
        if (c.t >= 0.2) { c.x = a.x0 + (a.tx - a.x0) * k; c.y = a.y0 + (a.y1 - a.y0) * k - (14 + Math.max(0, a.y0 - a.y1) * 0.3) * 4 * k * (1 - k); }
        if (k >= 1 && c.surf !== a.to) { c.surf = a.to; c.y = a.y1; }
        if (c.t >= 0.2 + a.air + 0.15) next(c);
        break;
      }
      case 'pounce': {
        const k = clamp((c.t - a.wait) / 0.3, 0, 1);
        if (c.t >= a.wait) { c.x = a.x0 + (a.tx - a.x0) * k; c.y = surface(c).y - Math.sin(k * Math.PI) * 11; }
        if (k >= 1) {
          c.y = surface(c).y;
          const b = c.toy; if (b && b.surf === c.surf && Math.abs(b.x - (c.x + c.dir * 12)) < 18) kick(b, c.dir, rand(70, 150));
          next(c);
        }
        break;
      }
      default: if (c.t >= a.dur) next(c);
    }
  }

  /* ---------- petting ---------- */
  const petting = (c, now = c.now) => now - c.petT < 1.5;   // just petted: hearts still rising
  // A grumpy cat (T.grumpy) puts up with a pet or two; keep going and it may scratch you, hiss, stalk off and sulk for a
  // while (petting a sulking cat only makes it walk away). It warns you first: just one heart instead of three.
  // p: where you tapped (scene coordinates), for the claw marks. Returns 'scratch' or 'snub' so the scene can react.
  function pet(c, now, p) {
    if (airborne(c) || (c.act && c.act.do === 'swipe')) return;
    const asleep = c.act && c.act.do === 'sleep';
    if (c.T.grumpy) {
      c.annoy += asleep ? 2 : 1;   // she really does not like being woken
      const px = p ? p.x : c.x + c.dir * 16, py = p ? p.y : c.y - 30, s = surface(c);
      if (now < c.sulkT) {
        if (now - c.soundT > 0.6) { meow(c.T.pitch * 0.8); c.soundT = now; }
        const away = clamp(c.x - sign(px - c.x) * rand(60, 100), s.x0, s.x1);
        interrupt(c, [{ do: 'walk', tx: away }, { do: 'sit', dur: rand(4, 7) }]);
        return 'snub';
      }
      const over = c.annoy - 2.6;
      if (over > 0 && Math.random() < clamp(over * 0.45 * c.T.grumpy, 0, 0.85)) {
        c.dir = sign(px - c.x);
        const away = clamp(c.x - c.dir * rand(120, 200), s.x0, s.x1);
        interrupt(c, [{ do: 'swipe', dur: 0.55 }, { do: 'walk', tx: away, run: true }, { do: 'sit', dur: rand(5, 9) }]);
        c.sulkT = now + rand(7, 11); c.curT = now + 20; c.annoy = 0; c.soundT = now;
        c.scratches.push({ x: px, y: py, k: 0 });
        if (H.hiss) H.hiss(); else meow(c.T.pitch * 0.7);
        return 'scratch';
      }
    }
    if (c.act && c.act.do === 'pounce') c.y = surface(c).y;   // (caught mid-crouch: a cat in the air cannot be reached)
    interrupt(c, asleep ? [{ do: 'meow', dur: 1.3 }, { do: 'stretch', dur: 1.1 }, { do: 'stand', dur: 1.5 }] : [{ do: 'meow', dur: 1.3 }, { do: 'stand', dur: 2 }]);
    c.petT = now; c.curT = now + 6;
    if (now - c.soundT > 0.6) { meow(c.T.pitch); c.soundT = now; }   // quick taps do not stack meows
    const n = c.T.grumpy && c.annoy > 1.8 ? 1 : 3;   // (a grumpy cat running out of patience: one heart)
    for (let i = 0; i < n; i++) c.hearts.push({ x: c.x + rand(-10, 10), y: c.y - 46 - i * 4, vx: rand(-10, 10), vy: rand(22, 34), k: -i * 0.18, life: 1.3 });
  }

  /* ---------- drawing ---------- */
  function frame(c) {
    const a = c.act, t = c.t;
    if (!SIDE_POSES && a.do === 'pounce') return t < a.wait ? F.groom : F.meow;   // crouch on the sitting frame, spring on the meow
    switch (a.do) {
      case 'walk': return F.walk + Math.floor(c.ph) % 8;
      case 'blink': return F.groom;
      case 'stand': return F.stand + Math.floor((t + c.seed) / 0.75) % 2;   // the tail sways
      case 'sleep': return F.sleep + Math.floor(t * 1.6) % 4;
      case 'meow': return F.meow + Math.floor(t * 9) % 2;
      case 'stretch': return F.stretch;
      case 'eat': return F.groom + Math.floor(t * 8) % 4;
      case 'jump': return t < 0.2 ? F.crouch : t < 0.2 + a.air ? F.leap : F.stand;
      case 'pounce': return t < a.wait ? F.crouch : F.leap;
      case 'swipe': return t < 0.12 ? F.crouch : t < 0.32 ? F.leap : F.stand;   // a quick lunge at your hand
      default: { const ph = (t + c.seed) % 3.2; return ph < 2 ? F.groom + Math.floor(ph * 7) % 4 : F.groom; }   // grooming: a licking burst, then a pause
    }
  }
  // where to tap: the sitting cat, the curled-up sleeper, or the long side-on cat (not one in the air or fading)
  function rect(c) {
    if (airborne(c) || c.act.do === 'blink') return { x: -9999, y: -9999, w: 0, h: 0 };
    const f = frame(c);
    if (f >= F.walk) return { x: c.x - 26, y: c.y - 42, w: 52, h: 44 };
    if (f >= F.sleep) return { x: c.x - 30, y: c.y - 34, w: 60, h: 36 };
    return { x: c.x - 22, y: c.y - 48, w: 44, h: 50 };
  }
  function hit(c, p) { const r = rect(c); return !!p && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h; }

  function draw(g, c, now) {
    step(c, now);
    const im = IMG[c.coat]; if (!im.complete || !im.naturalWidth) return;
    const f = frame(c), sideOn = f >= F.walk;
    const flip = sideOn ? c.dir < 0 : c.dir > 0;   // side-on frames face right; the sitting ones have their tail on the right
    let dx = f === F.meow || f === F.meow + 1 ? 4 : 0;
    if (c.act.do === 'pounce' && c.t < c.act.wait && c.t > c.act.wait - 0.45) dx += Math.floor(c.t * 14) % 2 ? 1 : -1;   // the wiggle before a pounce
    if (c.act.do === 'swipe' && c.t >= 0.12 && c.t < 0.32) dx += 6;   // (side-on frames face their way: +dx is a lunge forward)
    const since = now - c.petT, hop = since < 0.3 ? Math.round(Math.sin(since / 0.3 * Math.PI) * 3) : 0;   // a hop of joy as it is petted
    const x = Math.round(c.x), y = Math.round(c.y) - hop;
    g.save();
    if (c.act.do === 'blink') g.globalAlpha = Math.min(1, Math.abs(c.t - 0.45) / 0.45);
    if (flip) { g.translate(x, 0); g.scale(-1, 1); g.drawImage(im, f * CELL, 0, CELL, CELL, -32 + dx, y - 63, CELL, CELL); }
    else g.drawImage(im, f * CELL, 0, CELL, CELL, x - 32 + dx, y - 63, CELL, CELL);
    g.restore();
  }
  // one frame, for a scene that steers a cat itself (the title screen's village cat): x, y its centre and feet
  function drawFrame(g, coat, f, x, y, flip = false) {
    const im = IMG[coat]; if (!im.complete || !im.naturalWidth) return;
    x = Math.round(x); y = Math.round(y);
    g.save();
    if (flip) { g.translate(x, 0); g.scale(-1, 1); g.drawImage(im, f * CELL, 0, CELL, CELL, -32, y - 63, CELL, CELL); }
    else g.drawImage(im, f * CELL, 0, CELL, CELL, x - 32, y - 63, CELL, CELL);
    g.restore();
  }
  // pixel hearts rising from a petted cat (or two friends greeting), and its name while hovered (o.label)
  const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  function heart(g, x, y) {
    for (let r = 0; r < HEART.length; r++) for (let k = 0; k < 7; k++) if (HEART[r][k] === '#') {
      g.fillStyle = PX.OUTLINE; g.fillRect(x + k - 1, y + r, 3, 1); g.fillRect(x + k, y + r - 1, 1, 3);
    }
    for (let r = 0; r < HEART.length; r++) for (let k = 0; k < 7; k++) if (HEART[r][k] === '#') { g.fillStyle = r === 1 && k === 1 ? '#ffd0dc' : '#ff6f91'; g.fillRect(x + k, y + r, 1, 1); }
  }
  function fx(g, c, o = {}) {
    for (const h of c.hearts) {
      if (h.k < 0) continue;
      g.globalAlpha = Math.min(1, (1 - h.k) * 3);
      heart(g, Math.round(h.x - 3), Math.round(h.y));
    }
    // claw marks where you tapped: three red slashes drawn in quickly, then fading
    for (const s of c.scratches) {
      g.globalAlpha = Math.min(1, (1 - s.k) * 2.5);
      const len = Math.round(16 * Math.min(1, s.k * 7));
      for (const pass of [0, 1]) for (let i = 0; i < 3; i++) for (let j = 0; j < len; j++) {
        const x = Math.round(s.x + 4 + i * 6 - j * 0.6), y = Math.round(s.y - 8 + j + (i === 1 ? -2 : 0));
        if (pass === 0) { g.fillStyle = PX.OUTLINE; g.fillRect(x - 1, y - 1, 3, 3); } else { g.fillStyle = j < 2 || j > len - 3 ? '#ff8a8a' : '#e0303a'; g.fillRect(x, y, 1, 1); }
      }
    }
    g.globalAlpha = 1;
    if (c.act && c.act.do === 'meow' && c.act.soft && !c.played) { c.played = true; meow(c.T.pitch, true); }
    if (!c.act || c.act.do !== 'meow') c.played = false;
    if (o.label && c.hover && !petting(c)) SCENE.label(g, c.name.toUpperCase(), c.x, rect(c).y - 22);   // (out of the hearts' way while petted)
  }

  /* ---------- toys and dishes ---------- */
  // a ball on a surface: kind 0 red, 1 blue; it rolls, slows, and bounces off the ends of its stretch
  const toy = (kind, x, surfaces, surf = 0, x0, x1) => ({ kind, x, surf, y: surfaces[surf].y, x0: x0 === undefined ? surfaces[surf].x0 : x0, x1: x1 === undefined ? surfaces[surf].x1 : x1, vx: 0, rot: 0, last: null });
  function kick(b, dir, v = rand(110, 170)) { b.vx = dir * v; }
  function drawToy(g, b, now) {
    const dt = b.last === null ? 0 : clamp(now - b.last, 0, 0.1); b.last = now;
    if (Math.abs(b.vx) > 2) {
      b.x += b.vx * dt; b.rot += b.vx * dt / 7; b.vx *= Math.exp(-1.5 * dt);
      if (b.x < b.x0) { b.x = b.x0; b.vx = Math.abs(b.vx) * 0.6; } else if (b.x > b.x1) { b.x = b.x1; b.vx = -Math.abs(b.vx) * 0.6; }
    } else b.vx = 0;
    if (!TOYS.complete || !TOYS.naturalWidth) return;
    const q = ((Math.round(b.rot / (Math.PI / 2)) % 4) + 4) % 4;   // quarter turns keep the pixels crisp
    g.save(); g.translate(Math.round(b.x), Math.round(b.y) - 8); g.rotate(q * Math.PI / 2);
    g.drawImage(TOYS, b.kind * 24, 0, 24, 24, -12, -16, 24, 24);
    g.restore();
  }
  const hitToy = (b, p) => !!p && Math.abs(p.x - b.x) < 13 && p.y > b.y - 20 && p.y < b.y + 4;
  // tap a ball: it rolls away from the pointer, and a playful cat nearby (awake, on the same surface) may chase it
  function poke(b, p, cats = []) {
    kick(b, p.x < b.x ? 1 : -1);
    for (const c of cats) if (c.toy === b && c.surf === b.surf && c.act && !busy(c) && c.act.do !== 'sleep' && Math.random() < 0.85) { c.plays = 1; interrupt(c, chase(c)); }
  }
  const dish = (x, surfaces, surf = 0) => ({ x, surf, y: surfaces[surf].y });
  function drawDish(g, d) { if (TOYS.complete && TOYS.naturalWidth) g.drawImage(TOYS, 48, 0, 24, 24, Math.round(d.x) - 12, Math.round(d.y) - 22, 24, 24); }

  return {
    init: h => { H = Object.assign(H, h); },
    make, group, draw, drawFrame, F, SIDE: SIDE_POSES, fx, rect, hit, pet, petting, meow, COATS, sulking: c => c.now < c.sulkT,
    toy, drawToy, hitToy, poke, dish, drawDish
  };
})();
