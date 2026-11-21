'use strict';
/* Face tool (index.html?facetool): a dev page for setting each guest's face anchor, face: [eyeX, eyeY, chinY] in
   guests.js, which the guest book crops its portraits around.
   Each guest PNG is shown large on its pixel grid. Click 1 sets the point between the eyes, click 2 the bottom of the
   chin; then it moves on to the next guest. The right side previews the guest book's thumbnail (in a 960 x 540 window
   and full screen) and profile portrait, using the guest book's own crop code. Arrow keys go back and forward.
   Work in progress is kept in this browser (localStorage), so a reload carries on. "Copy guests.js" copies the whole
   file with every face filled in: paste it over js/guests.js. Values start from guests.js (best guesses until fixed). */
const FACETOOL = (() => {
  const KEY = 'cozy.facetool';
  const $ = s => document.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let S = { faces: {}, done: [] }, i = 0, step = 0, K = 1, imgs = {}, hover = null;

  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.faces) S = { faces: s.faces, done: s.done || [] }; } catch (e) { /* (private window) */ }
    for (const gt of GUESTS) if (!S.faces[gt.id]) S.faces[gt.id] = (gt.face || GUESTBOOK.faceOf(gt)).slice();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* (private window) */ } }
  const gt = () => GUESTS[i];
  const face = () => S.faces[gt().id];

  function build() {
    document.body.className = 'facetool';
    document.body.innerHTML = `
      <div class="ft">
        <header class="ft-bar">
          <b class="ft-name"></b><span class="ft-title"></span>
          <span class="ft-count"></span>
          <span class="grow"></span>
          <button type="button" data-act="prev">&larr; Back</button>
          <button type="button" data-act="next">Next &rarr;</button>
          <button type="button" data-act="reset">Undo this guest</button>
          <button type="button" data-act="copy" class="ft-copy">Copy guests.js</button>
        </header>
        <p class="ft-help"></p>
        <main class="ft-main">
          <div class="ft-stage"><canvas class="ft-cv"></canvas></div>
          <aside class="ft-side">
            <h3>Thumbnail</h3>
            <div class="ft-row"><figure style="--u:2px"><div class="ft-snap"></div><figcaption>960 x 540</figcaption></figure>
              <figure style="--u:4px"><div class="ft-snap"></div><figcaption>Full screen (1920)</figcaption></figure></div>
            <h3>Profile</h3>
            <figure style="--u:2px"><div class="ft-prof"></div></figure>
            <p class="ft-vals"></p>
          </aside>
        </main>
        <textarea class="ft-out" readonly hidden></textarea>
      </div>`;
    document.addEventListener('click', e => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      ({ prev: () => go(i - 1), next: () => go(i + 1), reset: reset, copy: copy })[b.dataset.act]();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { go(i - 1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { go(i + 1); e.preventDefault(); }
      if (e.key === 'Backspace' || e.key === 'Escape') { if (step) { step = 0; render(); } }
    });
    const cv = $('.ft-cv');
    cv.addEventListener('mousemove', e => { hover = at(e); draw(); });
    cv.addEventListener('mouseleave', () => { hover = null; draw(); });
    cv.addEventListener('click', e => {
      const p = at(e), f = face(), id = gt().id;
      if (step === 0) { f[0] = p.x; f[1] = p.y; if (f[2] <= f[1]) f[2] = f[1] + 8; step = 1; save(); render(); return; }
      f[2] = Math.max(f[1] + 2, p.y);
      if (!S.done.includes(id)) S.done.push(id);
      step = 0; save(); render();
      setTimeout(() => { if (gt().id === id) go(i + 1); }, 350);   // a moment to see the result, then the next guest
    });
    window.addEventListener('resize', () => render());
  }
  // canvas position -> PNG pixel
  function at(e) {
    const r = e.target.getBoundingClientRect();
    return { x: clamp(Math.floor((e.clientX - r.left) / K), 0, gt().w - 1), y: clamp(Math.floor((e.clientY - r.top) / K), 0, gt().h - 1) };
  }
  function go(n) { i = (n + GUESTS.length) % GUESTS.length; step = 0; render(); }
  function reset() {
    const g = gt(); S.faces[g.id] = (g.face || GUESTBOOK.faceOf(g)).slice(); S.done = S.done.filter(id => id !== g.id); step = 0; save(); render();
  }

  function draw() {
    const g = gt(), im = imgs[g.id], cv = $('.ft-cv'), c = cv.getContext('2d'), f = face();
    const box = $('.ft-stage').getBoundingClientRect();
    K = clamp(Math.floor(Math.min((box.width - 8) / g.w, (box.height - 8) / g.h)), 1, 8);
    cv.width = g.w * K; cv.height = g.h * K;
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#e9d8b4'; c.fillRect(0, 0, cv.width, cv.height);
    if (im && im.complete) c.drawImage(im, 0, 0, cv.width, cv.height);
    if (K >= 4) {   // the pixel grid
      c.fillStyle = 'rgba(40, 20, 40, 0.18)';
      for (let x = 0; x <= g.w; x++) c.fillRect(x * K, 0, 1, cv.height);
      for (let y = 0; y <= g.h; y++) c.fillRect(0, y * K, cv.width, 1);
    }
    const done = S.done.includes(g.id);
    // the thumbnail's crop square, as it would be at full screen (dashed)
    const T = 28 * 4, k = 0.45 * T / Math.max(1, (f[2] - f[1]) * 2.2), side = T / k;
    c.setLineDash([K * 2, K * 2]); c.strokeStyle = 'rgba(255, 255, 255, 0.8)'; c.lineWidth = 2;
    c.strokeRect((f[0] - side / 2) * K, (f[1] - side * 0.42) * K, side * K, side * K); c.setLineDash([]);
    // eye point and chin line (solid once set, dashed while still a guess)
    const ink = done ? '#00e0ff' : 'rgba(0, 224, 255, 0.6)', chin = done ? '#ff40ff' : 'rgba(255, 64, 255, 0.6)';
    const ex = (f[0] + 0.5) * K, ey = (f[1] + 0.5) * K;
    c.fillStyle = ink; c.fillRect(ex - 10 * K / 2, ey - 1, 10 * K, 3); c.fillRect(ex - 1, ey - 10 * K / 2, 3, 10 * K);
    c.fillStyle = chin; const hw = (f[2] - f[1]) * 1.2 * K; c.fillRect(ex - hw, (f[2] + 1) * K - 1, hw * 2, 3);
    if (hover) {   // where the click would land
      c.strokeStyle = step ? '#ff40ff' : '#00e0ff'; c.lineWidth = 2;
      if (step) { c.beginPath(); c.moveTo(0, (hover.y + 1) * K); c.lineTo(cv.width, (hover.y + 1) * K); c.stroke(); }
      else c.strokeRect(hover.x * K, hover.y * K, K, K);
    }
  }
  function render() {
    const g = gt(), f = face();
    $('.ft-name').textContent = (i + 1) + '. ' + g.name;
    $('.ft-title').textContent = g.title + (S.done.includes(g.id) ? ' (set)' : ' (best guess)');
    $('.ft-count').textContent = S.done.length + '/' + GUESTS.length + ' done';
    $('.ft-help').textContent = step === 0
      ? 'Click 1: the point between the eyes.  (Arrow keys: back / next)'
      : 'Click 2: the bottom of the chin.  (Esc: start this guest again)';
    $('.ft-vals').textContent = 'face: [' + f.join(', ') + ']';
    document.querySelectorAll('.ft-snap').forEach(el => { el.innerHTML = GUESTBOOK.pic(g, 't', 28, 28, false); });
    $('.ft-prof').innerHTML = GUESTBOOK.pic(g, 'f', 66, 124, false);
    document.querySelectorAll('.ft-side figure').forEach(fig => {
      const u = parseFloat(fig.style.getPropertyValue('--u'));
      fig.querySelectorAll('.gb-pic').forEach(el => GUESTBOOK.paint(el, f, u));
    });
    draw();
  }

  // guests.js, rebuilt with every face filled in (same layout as the file: one guest a line)
  const ser = v => Array.isArray(v) ? '[' + v.map(ser).join(', ') + ']'
    : v && typeof v === 'object' ? '{' + Object.entries(v).map(([k, x]) => k + ': ' + ser(x)).join(',') + '}'
    : typeof v === 'string' ? "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'" : String(v);
  function withFace(g) {   // face goes right after bottom, as in the file
    const o = {};
    for (const [k, v] of Object.entries(g)) { if (k === 'face') continue; o[k] = v; if (k === 'bottom') o.face = S.faces[g.id]; }
    return o;
  }
  const HEADER = `'use strict';
/* Guest roster. Portraits are in assets/guests/ (from the RPG Fantasy Girls packs).
   ax = x of the body centre inside the image, top / bottom = first and last non-empty rows, head = top of the head.
   face = [eyeX, eyeY, chinY]: the point between the eyes and the bottom of the chin, in the PNG's pixels. The guest book
   crops its portraits around it. Set them with index.html?facetool (it copies a new guests.js, ready to paste).
   taste: pref = favourite bowl, tops = topping counts that differ from the standard bowl (they must still differ from the trimmed recipes), night = only visits at night.
   To add a guest, drop a PNG in assets/guests/ and add a line here. */
`;
  async function copy() {
    let head = HEADER;
    try { const t = await (await fetch('js/guests.js', { cache: 'no-store' })).text(); const k = t.indexOf('const GUESTS = ['); if (k > 0) head = t.slice(0, k).replace(/\r\n/g, '\n'); } catch (e) { /* (local files: use the built-in header) */ }
    const js = head + 'const GUESTS = [\n' + GUESTS.map(g => '  ' + ser(withFace(g))).join(',\n') + '\n];\n';
    const out = $('.ft-out'); out.hidden = false; out.value = js;
    let ok = false;
    try { await navigator.clipboard.writeText(js); ok = true; } catch (e) { out.select(); try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } }
    const b = $('.ft-copy'); b.textContent = ok ? 'Copied! Paste over js/guests.js' : 'Select the text below and copy it';
    setTimeout(() => { b.textContent = 'Copy guests.js'; }, 3000);
  }

  function start() {
    load(); build();
    for (const g of GUESTS) { const im = new Image(); im.onload = () => { if (g === gt()) draw(); }; im.src = 'assets/guests/' + g.id + '.png'; imgs[g.id] = im; }
    const first = GUESTS.findIndex(g => !S.done.includes(g.id));   // carry on with the first guest not set yet
    go(first < 0 ? 0 : first);
  }
  return { start };
})();
