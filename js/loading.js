'use strict';
/* The loading screen: the game's emblem and name, and a bowl of ramen that fills as the game loads. The broth rises
   while the font loads, then the noodles go in and the toppings drop in one by one as the guests' portraits arrive.
   The bowl fills no faster than about 1.6s, so it can be seen even when everything is cached. Once it is full and
   steaming, "TAP TO START" (a click, a tap or any key); that first tap also lets the browser play sound.
   It runs its own little loop before the game starts, and swallows input while it is up. (game.js: LOADING.run) */
const LOADING = (() => {
  const { rect, dot, text, textW, setFont } = PX;
  const DK = PX.OUTLINE;
  const TOPS_IN = ['chashu', 'egg', 'nori', 'scallion', 'menma'];
  const FONT_SHARE = 0.3;   // the font is the broth (the first 30%); the portraits are the noodles and toppings
  const S = { t: 0, shown: 0, ready: false, readyAt: 0, out: -1, bowl: { s: 3, tare: 'miso', broth: 'pork', fill: 0, noodles: null, items: [], itemT: [], hide: {}, fx: {} }, steam: [] };
  let emb = null, bowlC = null;

  // what the bowl looks like at a given progress (0-1)
  function fillBowl(p) {
    const b = S.bowl;
    b.fill = Math.min(1, p / FONT_SHARE);
    if (p >= FONT_SHARE + 0.06 && !b.noodles) { b.noodles = 'perfect'; b.nT = S.t; }
    const want = p < FONT_SHARE + 0.12 ? 0 : Math.min(TOPS_IN.length, 1 + Math.floor((p - FONT_SHARE - 0.12) / (1 - FONT_SHARE - 0.12) * TOPS_IN.length));
    while (b.items.length < want) { b.items.push(TOPS_IN[b.items.length]); b.itemT.push(S.t); }
  }
  // the words under the bowl: what is loading right now (following the bowl, not racing ahead of it)
  function label(n) {
    if (S.ready) return null;
    if (S.shown < FONT_SHARE) return 'Warming the broth...';
    return 'Seating guests ' + Math.min(n, Math.round((S.shown - FONT_SHARE) / (1 - FONT_SHARE) * n)) + ' / ' + n;
  }
  function bigText(g, s, cx, y, fs, fill) {   // outlined title lettering (as on the title screen)
    setFont(fs);
    const x = Math.round(cx - textW(s) / 2);
    text(g, s, x + 3, y + 4, 'rgba(20,8,12,0.45)');
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]]) text(g, s, x + dx, y + dy, DK);
    text(g, s, x, y, fill);
    setFont(2);
  }
  function centre(g, s, cx, y, c) { const x = Math.round(cx - textW(s) / 2); text(g, s, x, y, c); }

  function draw(g, n) {
    g.imageSmoothingEnabled = false;
    // a warm, dark room with a lamp glowing behind the bowl
    rect(g, 0, 0, VW, VH, '#1e1220');
    SCENE.pool(g, VW / 2, 330, 300, 170, '#ffb060', 0.05, 5);
    SCENE.pool(g, VW / 2, 120, 160, 110, '#ffd27a', 0.04, 4);
    // the emblem, drawn at 1x and shown at 2x so it stays crisp
    emb = emb || PX.mk(72, 72); const eg = emb.getContext('2d');
    eg.clearRect(0, 0, 72, 72); SCENE.emblem(eg, 36, 38, 1, S.t);
    g.drawImage(emb, VW / 2 - 72, 34, 144, 144);
    bigText(g, 'COZY RAMEN', VW / 2, 196, 5, '#ffd76a');
    setFont(2); PX.textC(g, "An Adventurers' Noodle Stall", VW / 2, 252, '#e6d2ac', DK);
    // the bowl, also at 2x
    bowlC = bowlC || PX.mk(140, 104); const bg = bowlC.getContext('2d');
    bg.clearRect(0, 0, 140, 104); ART.bigBowl(bg, 70, 34, S.bowl, false, S.t);
    g.drawImage(bowlC, VW / 2 - 140, 262, 280, 208);
    // steam once it is full
    for (const p of S.steam) { g.globalAlpha = Math.max(0, p.life / p.max) * 0.5; const r = 3 + Math.round((1 - p.life / p.max) * 7); PX.ell(g, Math.round(p.x), Math.round(p.y), r, r, '#ffffff'); }
    g.globalAlpha = 1;
    const l = label(n);
    if (l) PX.textC(g, l, VW / 2, 486, '#c9b8a0', DK);
    else if (Math.floor((S.t - S.readyAt) * 2) % 2 === 0) bigText(g, 'TAP TO START', VW / 2, 482, 3, '#ffe9a0');
    if (S.out >= 0) { g.fillStyle = 'rgba(10,6,16,' + Math.min(1, S.out / 0.45).toFixed(3) + ')'; g.fillRect(0, 0, VW, VH); }
  }

  /* run(canvas, progress, onTap, onDone): progress() returns { p: 0-1, n: guests to load, done: bool }. onTap runs
     inside the player's first tap (so sound can start); onDone runs once the screen has faded out. */
  function run(canvas, progress, onTap, onDone) {
    const g = canvas.getContext('2d');
    let prev = performance.now(), finished = false;
    const tap = e => {
      e.preventDefault(); e.stopPropagation();
      if (!S.ready || S.out >= 0) return;
      S.out = 0; try { onTap(); } catch (err) { /* sound is optional */ }
    };
    const key = e => { if (e.key && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) tap(e); else e.stopPropagation(); };
    window.addEventListener('pointerdown', tap, true);
    window.addEventListener('keydown', key, true);
    canvas.style.cursor = 'default';
    const frame = now => {
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      S.t += dt;
      const pr = progress();
      S.shown = Math.min(pr.p, S.shown + dt / 1.6);   // fills no faster than in 1.6s
      fillBowl(S.shown);
      if (!S.ready && pr.done && S.shown >= 1) { S.ready = true; S.readyAt = S.t; canvas.style.cursor = 'pointer'; }
      if (S.ready && Math.random() < dt * 9) S.steam.push({ x: VW / 2 + (Math.random() - 0.5) * 160, y: 316, vy: -30 - Math.random() * 20, life: 1.6, max: 1.6 });
      for (const p of S.steam) { p.y += p.vy * dt; p.x += Math.sin(S.t * 2 + p.y * 0.05) * dt * 10; p.life -= dt; }
      S.steam = S.steam.filter(p => p.life > 0);
      if (S.out >= 0) S.out += dt;
      draw(g, pr.n);
      if (S.out >= 0.5 && !finished) {
        finished = true;
        window.removeEventListener('pointerdown', tap, true); window.removeEventListener('keydown', key, true);
        canvas.style.cursor = 'default';
        onDone();
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  return { run };
})();
