'use strict';
/* A physical book. It lifts off wherever it was picked up (the counter, a HUD button), flies over, lands with a small
   bounce, then swings its cover open. Pages turn around the spine and bend as they go: drag a page corner, click it,
   or call next()/prev(). Several pages can be in the air at once for a quick riffle. Grab anywhere on a page to
   turn it; turning back past the first page swings the cover shut, which closes the book.

   Motion is a few damped springs plus eased curves, not a rigid-body simulation:
     flight  f 0..1 (eased), with a lift arc, a tilt off the counter, and a landing bounce
     cover   angle 0..PI on a soft spring that thumps against the table
     leaf    angle 0..PI on a spring (stiffer while a finger holds it), plus a bend spring that makes the outer part
             of the page lag behind in the air or lead when pulled by the corner, and flutter when it lands
   The animation loop only runs while something moves; at rest the book has no transforms, so the pixel text stays crisp.

   The book knows nothing about recipes or guests: the owner hands it an array of page HTML strings (two per spread). */
const PBOOK = (() => {
  const PI = Math.PI, SEG = 3;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const FLY = 0.42;                       // seconds for the flight to or from the table
  const COVER = { k: 64, c: 12.5 };       // cover spring: heavier than a page
  const FREE = { k: 130, c: 16 };         // a page turning on its own
  const HELD = { k: 760, c: 52 };         // a page following a held corner: responsive, with some weight
  const BEND = { k: 210, c: 15 };

  function create(root, o) {
    o = Object.assign({ skin: '', coverHTML: '', sound: () => {}, onBackdrop: () => {}, onSettle: () => {}, requestClose: () => {} }, o);
    root.innerHTML = `
      <div class="pb-stage ${o.skin}">
        <div class="pb-dim"></div>
        <div class="pb-shadow"></div>
        <div class="pb-body">
          <div class="pb-tabs"></div><div class="pb-side"></div>
          <div class="pb-board pb-board-l"></div><div class="pb-board pb-board-r"></div><div class="pb-spine"></div>
          <div class="pb-stack pb-stack-l"></div><div class="pb-stack pb-stack-r"></div>
          <div class="pb-page pb-L"><div class="pb-in side-l"></div></div>
          <div class="pb-page pb-R"><div class="pb-in side-r"></div></div>
          <div class="pb-cast pb-cast-l"></div><div class="pb-cast pb-cast-r"></div>
          <div class="pb-leaves"></div>
          <div class="pb-corner pb-corner-l" title="Previous page"></div>
          <div class="pb-corner pb-corner-r" title="Next page"></div>
          <div class="pb-coverwrap"><div class="pb-cover">
            <div class="pb-face pb-cover-front">${o.coverHTML}</div>
            <div class="pb-face pb-cover-back"><div class="pb-board pb-board-in"></div><div class="pb-page pb-cover-page"><div class="pb-in side-l"></div></div></div>
          </div></div>
        </div>
      </div>`;
    const q = s => root.querySelector(s);
    const stage = q('.pb-stage'), body = q('.pb-body'), dim = q('.pb-dim'), shadow = q('.pb-shadow');
    const L = q('.pb-L'), R = q('.pb-R'), Lin = q('.pb-L .pb-in'), Rin = q('.pb-R .pb-in');
    const leavesEl = q('.pb-leaves'), cover = q('.pb-cover'), coverWrap = q('.pb-coverwrap'), coverIn = q('.pb-cover-page .pb-in');
    const castL = q('.pb-cast-l'), castR = q('.pb-cast-r'), stackL = q('.pb-stack-l'), stackR = q('.pb-stack-r');
    const cornerL = q('.pb-corner-l'), cornerR = q('.pb-corner-r');
    const coverFront = q('.pb-cover-front'), coverBack = q('.pb-cover-back');

    let pages = [], cur = 0, leaves = [], seq = 0;
    let mode = 'closed', f = 0, land = -1, from = null, counter = false, lifted = false, onClosed = null;
    const cv = { a: 0, w: 0, target: 0 };
    let raf = 0, last = 0, riffle = null, shownL = -1, shownR = -1, coverShown = -1, wheelT = 0;
    let coverHeld = false, coverHa = PI, shutCover = false;   // the reader holding the front cover; closing it all the way

    const spreads = () => Math.max(1, Math.ceil(pages.length / 2));
    const U = () => body.offsetWidth / 404;   // one layout unit, in px (the body is 404 units wide)
    const geo = () => ({ W: body.offsetWidth, H: body.offsetHeight, bl: body.offsetLeft, bt: body.offsetTop, spine: R.offsetLeft, pw: R.offsetWidth, ph: R.offsetHeight, pt: R.offsetTop });
    const pageHTML = i => (i >= 0 && i < pages.length ? pages[i] : '');

    /* ---------- what lies flat on each side ---------- */
    function underneath() {
      let li = cur, ri = cur;
      const fw = leaves.filter(l => l.dir > 0), bw = leaves.filter(l => l.dir < 0);
      if (fw.length) { li = Math.min(...fw.map(l => l.from)); ri = Math.max(...fw.map(l => l.from + 1)); }
      if (bw.length) { li = Math.min(...bw.map(l => l.from - 1)); ri = Math.max(...bw.map(l => l.from)); }
      return [li, ri];
    }
    function setStatic(force) {
      const [li, ri] = underneath();
      if (force || li !== shownL) { Lin.innerHTML = pageHTML(2 * li); shownL = li; }
      if (force || ri !== shownR) { Rin.innerHTML = pageHTML(2 * ri + 1); shownR = ri; }
      if (force || (cover.style.display !== 'none' && coverShown !== li)) { coverIn.innerHTML = pageHTML(2 * li); coverShown = li; }
      // the paper stacked under each side thickens as you move through the book
      const n = spreads(), u = U(), lt = Math.round(clamp(li / Math.max(1, n - 1), 0, 1) * 4) + 1, rt = Math.round(clamp((n - 1 - ri) / Math.max(1, n - 1), 0, 1) * 4) + 1;
      const layers = side => k => Array.from({ length: k }, (_, i) => `${side * (i + 1) * u}px ${(i + 1) * u * 0.6}px 0 0 ${i % 2 ? 'var(--pb-edge2)' : 'var(--pb-edge)'}`).concat(`${side * (k + 1) * u}px ${(k + 1) * u * 0.6}px 0 0 var(--pb-edge-ink)`).join(',');
      stackL.style.boxShadow = layers(-1)(lt); stackR.style.boxShadow = layers(1)(rt);
      const a = aim();
      cornerL.classList.toggle('on', true); cornerR.classList.toggle('on', a < spreads() - 1);   // at the first page the left corner is the cover
      cornerL.title = a > 0 ? 'Previous page' : 'Close the book';
    }
    function aim() {
      let a = cur;
      for (const l of leaves) a += l.dir > 0 ? (l.target > PI / 2 ? 1 : 0) : (l.target < PI / 2 ? -1 : 0);
      return a;
    }

    /* ---------- a turning leaf: SEG nested strips, each bent a little further than the last ---------- */
    function makeLeaf(dir, fromSpread) {
      const g = geo(), sw = g.pw / SEG;
      const front = dir > 0 ? pageHTML(2 * fromSpread + 1) : pageHTML(2 * fromSpread - 1);
      const back = dir > 0 ? pageHTML(2 * fromSpread + 2) : pageHTML(2 * fromSpread);
      let inner = '';
      for (let k = SEG - 1; k >= 0; k--) {
        inner = `<div class="pb-seg" style="width:${sw}px;${k ? `left:${sw}px` : 'left:0'}">
          <div class="pb-face pb-front"><div class="pb-in side-r" style="width:${g.pw}px;height:${g.ph}px;left:${-k * sw}px">${front}</div><i class="pb-sh"></i></div>
          <div class="pb-face pb-back"><div class="pb-in side-l" style="width:${g.pw}px;height:${g.ph}px;left:${-(g.pw - (k + 1) * sw)}px">${back}</div><i class="pb-sh"></i></div>
          ${inner}</div>`;
      }
      const holder = document.createElement('div');
      holder.innerHTML = inner;
      const el = holder.firstElementChild; el.classList.add('pb-leaf');
      leavesEl.appendChild(el);
      const segs = [el, ...el.querySelectorAll('.pb-seg')];   // nested, so document order runs spine -> edge
      const leaf = { id: seq++, dir, from: fromSpread, el, segs, shades: segs.map(s => [s.querySelector(':scope > .pb-front > .pb-sh'), s.querySelector(':scope > .pb-back > .pb-sh')]),
        a: dir > 0 ? 0 : PI, w: 0, b: 0, bw: 0, target: dir > 0 ? PI : 0, held: false, ha: 0 };
      leaves.push(leaf);
      return leaf;
    }

    function drawLeaf(l) {
      const bmax = Math.min(l.a, PI - l.a) * 0.45, b = clamp(l.b, -bmax, bmax);
      const rel = [0, b * 0.8, b * 1.2];
      // leaves standing up are drawn over flat ones; flat ones keep the order of a real stack
      l.el.style.zIndex = String(Math.round(2000 - Math.abs(l.a - PI / 2) * 400) * 4 + (l.a < PI / 2 ? -l.id % 4 : l.id % 4));
      let abs = 0;
      l.segs.forEach((s, k) => {
        abs += (k === 0 ? l.a : rel[k]);
        s.style.transform = `rotateY(${-(k === 0 ? l.a : rel[k])}rad)`;
        const t = clamp(abs, 0, PI);
        l.shades[k][0].style.opacity = (0.5 * Math.pow(clamp(t / (PI / 2), 0, 1), 1.6)).toFixed(3);
        l.shades[k][1].style.opacity = (0.45 * Math.pow(clamp((PI - t) / (PI / 2), 0, 1), 1.6)).toFixed(3);
      });
    }
    function settleLeaf(l) {
      const landedLeft = l.a > PI / 2;
      cur = l.dir > 0 ? (landedLeft ? l.from + 1 : l.from) : (landedLeft ? l.from : l.from - 1);
      l.el.remove(); leaves = leaves.filter(x => x !== l);
      setStatic(); o.onSettle(cur);
    }
    function snapLeaves() { for (const l of [...leaves]) { l.a = l.target; settleLeaf(l); } riffle = null; }

    function spawn(dir, held) {
      if (mode !== 'open') return null;
      if (leaves.some(l => l.dir !== dir)) snapLeaves();
      const a = aim();
      if (dir > 0 ? a >= spreads() - 1 : a <= 0) return null;
      if (leaves.length >= 9) { const old = leaves.reduce((m, l) => (l.id < m.id ? l : m)); old.a = old.target; settleLeaf(old); }
      const l = makeLeaf(dir, a);
      l.held = !!held;
      if (!held) { l.w = dir * 2.2; o.sound('flip'); }
      setStatic(); drawLeaf(l); kick();
      return l;
    }

    /* ---------- the loop ---------- */
    function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
    function spring(s, k, c, target, dt) { s.w += (k * (target - s.a) - c * s.w) * dt; s.a += s.w * dt; }
    function tick(now) {
      raf = 0;
      const dt = Math.min(0.034, Math.max(0.001, (now - last) / 1000)); last = now;
      for (let i = 0; i < 2; i++) step(dt / 2);
      render();
      if (busy()) raf = requestAnimationFrame(tick);
    }
    function busy() { return mode === 'opening' || mode === 'closing' || leaves.length > 0 || land >= 0 || !!riffle || coverHeld || (mode === 'open' && cv.a < PI); }
    function step(dt) {
      // book flight and cover
      if (mode === 'opening') {
        if (f < 1) {
          f = Math.min(1, f + dt / FLY);
          if (f === 1) { land = 0; o.sound('land'); if (cv.target !== PI) { cv.target = PI; o.sound('open'); } }
        }
        stepCover(dt);
        if (f === 1 && land < 0 && coverSettled() && cv.a === PI) { mode = 'open'; root.classList.add('pb-open'); setStatic(true); }
      } else if (mode === 'closing') {
        stepCover(dt);
        if (coverSettled()) {
          if (!lifted) { lifted = true; o.sound('lift'); }
          f = Math.max(0, f - dt / FLY);
          if (f === 0) finishClose();
        }
      }
      else if (mode === 'open') {   // the cover held by the reader, or swinging back open after being let go
        if (coverHeld) { spring(cv, HELD.k, HELD.c, coverHa, dt); cv.a = clamp(cv.a, 0, PI); }
        else if (cv.a < PI) stepCover(dt);
      }
      if (land >= 0) { land += dt; if (land > 0.42) land = -1; }
      // riffle: spawn one page at a time, a few hundredths of a second apart
      if (riffle) {
        riffle.t -= dt;
        if (riffle.t <= 0) { const l = spawn(riffle.dir); riffle.n--; riffle.t = 0.055; if (!l || riffle.n <= 0) riffle = null; }
      }
      // pages
      for (const l of [...leaves]) {
        if (l.held) spring(l, HELD.k, HELD.c, l.ha, dt);
        else spring(l, FREE.k, FREE.c, l.target, dt);
        const bt = l.held ? l.dir * 0.55 * Math.sin(l.a) : clamp(-l.w * 0.06, -0.6, 0.6);
        l.bw += (BEND.k * (bt - l.b) - BEND.c * l.bw) * dt; l.b += l.bw * dt;
        if (l.a < 0 || l.a > PI) { const hit = l.w; l.a = clamp(l.a, 0, PI); l.w = -l.w * 0.15; l.bw += hit * 0.12; }   // lands on the stack and flutters
        if (!l.held && Math.abs(l.a - l.target) < 0.008 && Math.abs(l.w) < 0.25 && Math.abs(l.b) < 0.015 && Math.abs(l.bw) < 0.25) { l.a = l.target; settleLeaf(l); o.sound('settle'); }
      }
    }
    function stepCover(dt) {
      const before = cv.a;
      cv.w += (COVER.k * (cv.target - cv.a) - COVER.c * cv.w) * dt; cv.a += cv.w * dt;
      if (cv.a > PI) { cv.a = PI; cv.w = -cv.w * 0.18; }
      if (cv.a < 0) { if (before > 0.02) o.sound('close'); cv.a = 0; cv.w = -cv.w * 0.18; }
      if (coverSettled()) { cv.a = cv.target; cv.w = 0; }
    }
    const coverSettled = () => Math.abs(cv.a - cv.target) < 0.004 && Math.abs(cv.w) < 0.06;

    function render() {
      const g = geo(), u = U(), op = cv.a / PI;
      const e = easeIO(f), arc = Math.sin(PI * f);
      const shift = -(g.spine / 2) * (1 - op);
      const cx = g.bl + g.W / 2, cy = g.bt + g.H / 2;
      const o0 = from || { x: cx, y: g.bt + g.H * 1.6, w: (g.W - g.spine) * 0.35 };
      const s0 = o0.w / (counter ? g.W : g.W - g.spine);
      const vx = lerp(o0.x, cx, e), vy = lerp(o0.y, cy, e);
      const bounce = land >= 0 ? Math.exp(-land * 10) * Math.sin(land * 26) : 0;
      let s = lerp(s0, 1, e) * (1 + 0.05 * arc) * (1 - bounce * 0.008);
      const lift = arc * 22 * u;
      const atRest = f === 1 && land < 0 && op === 1;
      if (atRest) body.style.transform = '';
      else {
        const tx = vx - cx - shift * s, ty = vy - cy - lift + bounce * 2.5 * u;
        const rx = (counter ? 52 : 16) * (1 - e), rz = (counter ? 2 : -7) * (1 - e) + arc * 2.5;
        body.style.transform = `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) rotateX(${rx.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${s.toFixed(4)}) translateX(${shift.toFixed(2)}px)`;
      }
      body.style.opacity = counter ? 1 : clamp(f / 0.12, 0, 1).toFixed(3);
      dim.style.opacity = e.toFixed(3);
      // the shadow stays on the table: it spreads and fades as the book rises
      const wv = g.W - g.spine * (1 - op), ss = s * (1 + arc * 0.08);
      shadow.style.width = wv + 'px'; shadow.style.height = g.H + 'px';
      shadow.style.transform = `translate(${(vx - wv / 2 + lift * 0.35 + 3 * u).toFixed(2)}px,${(vy - g.H / 2 + lift * 0.55 + 4 * u).toFixed(2)}px) scale(${ss.toFixed(4)})`;
      shadow.style.opacity = ((counter ? 1 : clamp(f / 0.12, 0, 1)) * (0.5 - 0.25 * arc)).toFixed(3);
      // cover: hidden once it lies flat on the left (the left page underneath shows the same thing)
      const coverOn = op < 1;
      cover.style.display = coverOn ? '' : 'none';
      if (coverOn) {
        cover.style.transform = `rotateY(${-cv.a}rad)`;
        coverFront.style.setProperty('--sh', (0.55 * Math.pow(clamp(cv.a / (PI / 2), 0, 1), 1.5)).toFixed(3));
        coverBack.style.setProperty('--sh', (0.5 * Math.pow(clamp((PI - cv.a) / (PI / 2), 0, 1), 1.5)).toFixed(3));
        if (coverShown !== shownL) { coverIn.innerHTML = pageHTML(2 * shownL); coverShown = shownL; }
      }
      body.classList.toggle('pb-leftbare', cv.a <= PI / 2);   // before the cover passes upright, the left side is just table
      // pages in flight, and the shadow the highest one throws on the paper below it
      leaves.forEach(drawLeaf);
      let top = null;
      for (const l of leaves) if (!top || Math.sin(l.a) > Math.sin(top.a)) top = l;
      if (top && Math.sin(top.a) > 0.02) {
        const sn = Math.sin(top.a), edge = Math.abs(Math.cos(top.a)) * g.pw, w = (8 + 22 * sn) * u;
        const el = top.a < PI / 2 ? castR : castL, other = el === castR ? castL : castR;
        el.style.opacity = (0.55 * sn).toFixed(3); el.style.width = w.toFixed(1) + 'px';
        el.style.transform = el === castR ? `translateX(${edge.toFixed(1)}px)` : `translateX(${(-edge).toFixed(1)}px)`;
        other.style.opacity = 0;
      } else { castL.style.opacity = 0; castR.style.opacity = 0; }
    }

    /* ---------- open / close ---------- */
    function toStage(rect) {
      if (!rect) return null;
      const sr = stage.getBoundingClientRect();
      return { x: rect.left + rect.width / 2 - sr.left, y: rect.top + rect.height / 2 - sr.top, w: rect.width };
    }
    function open(opt = {}) {
      root.classList.add('pb-on');
      counter = !!opt.counter; lifted = false; onClosed = null; shutCover = false; coverHeld = false;
      if (mode === 'closed') {
        from = toStage(opt.from); setStatic(true);
        f = 0; land = -1; cv.a = cv.target = counter ? PI : 0; cv.w = 0;
        o.sound('lift');
      }
      if (opt.instant) { f = 1; cv.a = cv.target = PI; mode = 'open'; root.classList.add('pb-open'); render(); setStatic(true); return; }
      mode = 'opening';
      render(); kick();
    }
    function close(done) {
      if (mode === 'closed') { if (done) done(); return; }
      onClosed = done || null;
      snapLeaves();
      root.classList.remove('pb-open');
      mode = 'closing'; lifted = false;
      coverHeld = false;
      cv.target = counter && !shutCover ? PI : 0;   // picked up from the counter it goes back down open, unless the reader shut it
      kick();
    }
    function finishClose() {
      mode = 'closed'; f = 0; root.classList.remove('pb-on', 'pb-open');
      body.style.transform = ''; o.sound('down');
      const cb = onClosed; onClosed = null; if (cb) cb();
    }

    /* ---------- pointer: grab anywhere on a page and drag it over the spine (a click on a corner turns it too) ---------- */
    let drag = null, pend = null, eatClick = false;
    function local(e) { const r = body.getBoundingClientRect(), g = geo(), k = r.width / g.W; return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k, g }; }
    function sideAt(e) {   // 1 = over the right page, -1 = over the left page, 0 = elsewhere
      const { x, y, g } = local(e);
      if (y < g.pt || y > g.pt + g.ph) return 0;
      return x >= g.spine && x <= g.spine + g.pw ? 1 : x >= g.spine - g.pw && x < g.spine ? -1 : 0;
    }
    function zone(e) {   // the dog-eared corners, where a plain click turns the page
      const { x, y, g } = local(e), u = U();
      const nearY = y > g.pt && y < g.pt + g.ph && (y < g.pt + 46 * u || y > g.pt + g.ph - 46 * u);
      if (nearY && x > g.spine + g.pw - 24 * u && x < g.spine + g.pw + 6 * u) return 1;
      if (nearY && x < g.spine - g.pw + 24 * u && x > g.spine - g.pw - 6 * u) return -1;
      return 0;
    }
    function angleAt(e) {
      const r = body.getBoundingClientRect(), g = geo(), k = r.width / g.W;
      const u = (e.clientX - (r.left + g.spine * k)) / (g.pw * k);
      return Math.acos(clamp(u, -1, 1));
    }
    const atCover = () => aim() === 0 && !leaves.length;
    function shut() { shutCover = true; coverHeld = false; o.requestClose(); }
    function startDrag(dir, e) {
      if (dir < 0 && atCover()) { coverHeld = true; coverHa = angleAt(e); drag = { cover: true }; }   // the first page: pull the cover over
      else { const l = spawn(dir, true); if (!l) return false; l.ha = angleAt(e); drag = { l }; }
      Object.assign(drag, { lastA: angleAt(e), lastT: performance.now(), vel: 0 });
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      eatClick = true; kick();
      return true;
    }
    stage.addEventListener('pointerdown', e => {
      eatClick = false;
      if (e.target === stage || e.target === dim) { o.onBackdrop(); return; }
      if (mode !== 'open' || drag || e.target.closest('.pb-tabs, .pb-side')) return;
      const side = sideAt(e);
      if (side) pend = { side, x: e.clientX, y: e.clientY, corner: zone(e) === side };
    });
    stage.addEventListener('pointermove', e => {
      if (!drag) stage.style.cursor = mode === 'open' && sideAt(e) && !e.target.closest('[data-goto], [data-act], button, select, input, .pb-tabs, .pb-side, .ink-fig') ? 'grab' : '';   // (a printed figure is ink on the page: no grab cursor of its own, but a drag across it still turns the page)
      if (pend && !drag) {
        const dx = e.clientX - pend.x, dy = e.clientY - pend.y;
        if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
          if ((pend.side > 0 && dx < 0) || (pend.side < 0 && dx > 0)) startDrag(pend.side, e);
          pend = null;
        }
      }
      if (!drag) return;
      const a = angleAt(e), now = performance.now(), dt = Math.max(1, now - drag.lastT) / 1000;
      drag.vel = lerp(drag.vel, (a - drag.lastA) / dt, 0.5); drag.lastA = a; drag.lastT = now;
      if (drag.cover) coverHa = a; else drag.l.ha = a;
      stage.style.cursor = 'grabbing'; kick();
    });
    const release = e => {
      const p = pend; pend = null;
      if (!drag) {   // no drag: a click on a dog-eared corner turns the page (or, at the first page, closes the cover)
        if (p && p.corner && mode === 'open') { if (p.side < 0 && atCover()) shut(); else spawn(p.side); }
        return;
      }
      const v = drag.vel;
      if (drag.cover) {
        coverHeld = false;
        if (cv.a < PI * 0.55 || v < -3) { o.sound('flip'); shut(); } else { cv.target = PI; cv.w = clamp(v, -14, 14); }
      } else {
        const { l } = drag;   // a flick commits the turn even if it has not crossed the spine yet
        l.held = false;
        const commit = l.dir > 0 ? (l.a > PI / 2 || v > 3) && v > -3 : (l.a < PI / 2 || v < -3) && v < 3;
        l.target = commit ? (l.dir > 0 ? PI : 0) : (l.dir > 0 ? 0 : PI);
        l.w = clamp(v, -14, 14);
        o.sound('flip');
      }
      drag = null; stage.style.cursor = ''; setStatic(); kick();
      if (e && e.pointerId != null) { try { stage.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ } }
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);
    stage.addEventListener('click', e => { if (eatClick) { eatClick = false; e.stopPropagation(); e.preventDefault(); } }, true);   // a drag is not a click
    stage.addEventListener('wheel', e => {
      if (mode !== 'open' || e.target.closest('.pb-tabs, .pb-side')) return;
      e.preventDefault();
      const now = performance.now();
      if (now - wheelT < 110) return;
      wheelT = now;
      if (e.deltaY > 0) next(); else if (e.deltaY < 0) prev();
    }, { passive: false });

    /* ---------- the owner's controls ---------- */
    function next() { spawn(1); }
    function prev() { if (mode === 'open' && atCover()) shut(); else spawn(-1); }   // back past the first page: shut the cover
    function flipToSpread(s) {
      s = clamp(s, 0, spreads() - 1);
      if (mode !== 'open') { cur = s; setStatic(true); return; }
      let d = s - aim();
      if (!d) return;
      if (leaves.some(l => l.dir !== Math.sign(d))) { snapLeaves(); d = s - aim(); if (!d) return; }
      if (Math.abs(d) > 7 && !leaves.length) { cur = s - Math.sign(d) * 7; setStatic(); d = s - cur; }
      riffle = { dir: Math.sign(d), n: Math.abs(d), t: 0 };
      kick();
    }
    function setPages(list, spread = 0) {
      snapLeaves();
      pages = list.slice();
      if (pages.length % 2) pages.push('');
      cur = clamp(spread, 0, spreads() - 1);
      setStatic(true);
    }
    function state() { return { mode, cur, aim: aim(), leaves: leaves.length, spreads: spreads(), cover: cv.a, f, angles: leaves.map(l => +l.a.toFixed(3)) }; }
    // Page numbers whose content spills past the paper (or into the page number): for tests and layout checks.
    function overflow() {
      const probe = R.cloneNode(true), pin = probe.firstElementChild, bad = [], u = U();
      probe.style.visibility = 'hidden'; body.appendChild(probe);
      pages.forEach((h, i) => {
        pin.className = 'pb-in ' + (i % 2 ? 'side-r' : 'side-l'); pin.innerHTML = h;
        let bottom = 0;
        for (const c of pin.children) if (!c.classList.contains('cb-num')) bottom = Math.max(bottom, c.offsetTop + c.offsetHeight);
        if (pin.scrollWidth > pin.clientWidth + 1 || bottom > pin.clientHeight - 9 * u) bad.push(i + 1);
      });
      probe.remove();
      return bad;
    }
    return { open, close, next, prev, flipToSpread, setPages, state, overflow, tabs: q('.pb-tabs'), side: q('.pb-side'), stage, body,
      isOpen: () => mode === 'open', spreadOfPage: p => Math.floor(p / 2) };
  }
  return { create };
})();
