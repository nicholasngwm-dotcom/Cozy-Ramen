'use strict';
/* The guest book: an indigo cloth photo album with the same physical book (PBOOK) and search slip (BOOKFILTER) as the
   cookbook. Contents pages are taped polaroids; every guest has a profile page. Guests not met yet stay silhouettes
   named "???", and searching never reveals their names. */
const GUESTBOOK = (() => {
  const esc = s => BOOKFILTER.esc(s);
  const PER_GRID = 12, TILT = [-2, 1.5, -1, 2, 0.5, -1.5];
  let hooks = { sound: () => {}, close: () => {}, img: () => null, met: () => [], aff: () => ({}) };

  /* ---------- portraits, anchored on each guest's face ----------
     guests.js gives every guest face: [eyeX, eyeY, chinY] in the PNG's own pixels (the point between the eyes, and the
     bottom of the chin; set them with index.html?facetool). The portraits are CSS crops straight from the PNG (copying a
     PNG through a canvas is blocked by browsers when the game runs from local files). Each frame is sized in layout
     units; paint() works the crop out in real screen pixels, so thumbnails can zoom by whole-number factors. Pages are
     drawn on demand, so a MutationObserver paints new frames and a resize repaints them all. */
  const faceOf = gt => gt.face || [gt.ax, Math.round(gt.head + 0.19 * (gt.bottom - gt.head)), Math.round(gt.head + 0.28 * (gt.bottom - gt.head))];
  const unitPx = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 2;
  const clampIn = (v, a, b) => Math.max(a, Math.min(b, v));
  /* Thumbnail (a square T px): the face, eyes to chin * 2.2, fills 45% of the height; the eyes sit 42% from the top,
     centred across. The zoom snaps to a whole number of device pixels per PNG pixel when that is within 25% of the
     ideal (pixels stay square and even). The crop never runs past the PNG: it shifts back inside, and any gap left
     (a PNG smaller than the frame) shows the polaroid's own background. Returns { k, x, y } in CSS px. */
  function thumbCrop(gt, face, T, dpr = window.devicePixelRatio || 1) {
    let k = 0.45 * T / Math.max(1, (face[2] - face[1]) * 2.2);
    const ki = Math.round(k * dpr);
    if (ki >= 1 && Math.abs(ki / (k * dpr) - 1) <= 0.25) k = ki / dpr;
    const W = gt.w * k, H = gt.h * k;
    let x = T / 2 - face[0] * k, y = 0.42 * T - face[1] * k;
    x = W >= T ? clampIn(x, T - W, 0) : clampIn(x, 0, T - W);
    y = H >= T ? clampIn(y, T - H, 0) : clampIn(y, 0, T - H);
    return { k, x: Math.round(x * dpr) / dpr, y: Math.round(y * dpr) / dpr };
  }
  /* Profile portrait (bw x bh px). Every sprite in the pack is cut off across the thighs (gt.bottom is that cut line,
     even where the PNG has empty rows below it), so the cut is placed flush with the frame's bottom edge and the body
     reads as continuing out of the frame. Scale: the head to the cut fills 94% of the height (the head lands about 6%
     below the top). Very wide sprites (wings, big weapons) may scale down so they show up to 2.6 frame-widths, but they
     still sit on the bottom edge, never floating. Then the face is kept inside the frame across. */
  function fullCrop(gt, face, bw, bh, dpr = window.devicePixelRatio || 1) {
    const k = Math.min(0.94 * bh / (gt.bottom - gt.head + 1), (bw * 2.6) / gt.w);
    let x = bw / 2 - gt.ax * k;
    const y = bh - (gt.bottom + 1) * k;
    const half = (face[2] - face[1]) * k * 1.3, fx = face[0] * k + x;
    if (fx - half < 0) x -= fx - half; else if (fx + half > bw) x -= fx + half - bw;
    return { k, x: Math.round(x * dpr) / dpr, y: Math.round(y * dpr) / dpr };
  }
  // A frame: bw x bh layout units; kind 't' (thumbnail) or 'f' (full body). paint() fills in the crop.
  function pic(gt, kind, bw, bh, sil, extra = '') {
    return `<span class="gb-pic${kind === 'f' ? ' full' : ''}${sil ? ' sil' : ''}${extra}" data-g="${gt.id}" data-k="${kind}" data-bw="${bw}" data-bh="${bh}" style="width:calc(${bw} * var(--u));height:calc(${bh} * var(--u))"><i style="background-image:url('assets/guests/${gt.id}.png')"></i></span>`;
  }
  const portrait = (gt, bw, bh, sil) => pic(gt, 't', bw, bh, sil);
  const fullBody = (gt, bw, bh, sil) => pic(gt, 'f', bw, bh, sil);
  // Work out one frame's crop from the live screen scale (face, u: a stand-in anchor and scale, for the face tool).
  function paint(el, face, uOver) {
    const gt = GUESTS.find(g => g.id === el.dataset.g); if (!gt) return;
    const u = uOver || unitPx(), bw = +el.dataset.bw * u, bh = +el.dataset.bh * u, f = face || faceOf(gt);
    const c = el.dataset.k === 'f' ? fullCrop(gt, f, bw, bh) : thumbCrop(gt, f, Math.min(bw, bh));
    const i = el.firstElementChild;
    i.style.backgroundSize = `${(gt.w * c.k).toFixed(3)}px ${(gt.h * c.k).toFixed(3)}px`;
    i.style.backgroundPosition = `${c.x.toFixed(3)}px ${c.y.toFixed(3)}px`;
  }
  const paintAll = root => root.querySelectorAll('.gb-pic[data-g]').forEach(el => paint(el));
  function watchPics(root) {
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches('.gb-pic[data-g]')) paint(n); else paintAll(n); } })
      .observe(root, { childList: true, subtree: true });
    window.addEventListener('resize', () => paintAll(root));
  }

  const TABS = [{ id: 'all', label: 'All' }, { id: 'met', label: 'Met' }, { id: 'unmet', label: 'Not met' }, { id: 'night', label: 'Night owls' }];
  const FAVS = Object.keys(MENU).map(k => ({ id: k, label: MENU[k].name }));
  function match(gt, st, met) {
    const known = met.includes(gt.id);
    if (st.cat === 'met' && !known) return false;
    if (st.cat === 'unmet' && known) return false;
    if (st.cat === 'night' && !gt.taste.night) return false;
    if (st.q.trim() && !(known && (BOOKFILTER.has(gt.name, st.q) || BOOKFILTER.has(gt.title, st.q)))) return false;
    if (st.sel && gt.taste.pref !== st.sel) return false;
    return true;
  }

  const num = p => `<span class="cb-num">${p + 1}</span>`;
  // A profile page: the full-body portrait on the left, who they are on the right.
  function profile(gt, p, met) {
    const known = met.includes(gt.id), P = PERSONA[gt.id] || {}, no = GUESTS.indexOf(gt) + 1;
    const photo = `<div class="profile-photo full${known ? '' : ' unmet'}">${fullBody(gt, 66, 124, !known)}</div>`;
    if (!known) return `
      <div class="gb-chap">Guest No. ${no}</div>
      <div class="gb-profile">${photo}<div class="gb-about">
        <div class="ribbon">???</div>
        <p class="gb-title">Not met yet</p>
      </div></div>
      <p class="gb-quote">Serve them a bowl and this page will fill in.</p>${num(p)}`;
    const pref = gt.taste.pref && MENU[gt.taste.pref], likes = Object.keys(gt.taste.tops || {});
    return `
      <div class="gb-chap">Guest No. ${no}</div>
      <div class="gb-profile">${photo}<div class="gb-about">
        <div class="ribbon">${esc(gt.name)}</div>
        <p class="gb-title">${esc(gt.title)}</p>
        <dl class="gb-facts">
          <dt>Nature</dt><dd>${esc(P.trait || '...')}</dd>
          <dt>Favourite</dt><dd>${pref ? `<i class="dot" style="background:${pref.c}"></i>${esc(pref.name)}` : 'Anything warm'}</dd>
          ${likes.length ? `<dt>Likes</dt><dd>${likes.map(id => (gt.taste.tops[id] ? 'extra ' : 'no ') + esc(TOP_NAME[id].toLowerCase())).join(', ')}</dd>` : ''}
          ${gt.taste.night ? '<dt>Visits</dt><dd>Only at night</dd>' : ''}
          <dt>Affinity</dt><dd>${affRow(gt.id)}</dd>
        </dl>
      </div></div>
      <p class="gb-quote">&ldquo;${esc(gt.hi)}&rdquo;</p>${num(p)}`;
  }
  // Five hearts (ten for Aoi), filled up to the guest's rank, the rank's name, and how far it is to the next one.
  function affRow(id) {
    const R = affRanks(id), pts = (hooks.aff() || {})[id] || 0, l = affLevel(pts, id), next = affNext(pts, id);
    const hearts = R.map((a, i) => `<i class="aff-h${i <= l ? ' on' : ''}"></i>`).join('');
    return `<span class="aff${R.length > 5 ? ' ten' : ''}">${hearts}</span> ${esc(R[l].name)}${next ? `<small class="aff-to">${next - pts} to go</small>` : ''}`;
  }
  function grid(list, k, pageOf, p, total, met, st) {
    const rows = list.slice(k * PER_GRID, (k + 1) * PER_GRID);
    const body = !list.length
      ? `<div class="cb-empty"><p>No guests match${st.q.trim() ? ` &ldquo;${esc(st.q.trim())}&rdquo;` : ''}.</p><button type="button" class="btn" data-act="reset">Clear filters</button></div>`
      : `<ul class="snaps">${rows.map((gt, i) => { const known = met.includes(gt.id); return `<li class="snap${known ? '' : ' unmet'}" data-goto="${pageOf.get(gt.id)}" style="--tilt:${TILT[i % 6]}deg">
          ${portrait(gt, 28, 28, !known)}<span>${known ? esc(gt.name) : '???'}</span></li>`; }).join('')}</ul>`;
    return `<h3 class="gb-head">Visitors${total > 1 ? ` <small>${k + 1}/${total}</small>` : ''}</h3>${body}${num(p)}`;
  }
  function titlePage(list, met, filters) {
    const night = GUESTS.filter(g => g.taste.night && met.includes(g.id)).length;
    return `<div class="gb-titlepage">
        <div class="gb-orn"></div>
        <h2>Guest Book</h2>
        <p class="gb-quote">Everyone who has warmed up at our counter.</p>
        <div class="gb-stamp">${met.length}<small>/ ${GUESTS.length}</small></div>
        <p class="gb-count">guests met &middot; ${night} night owls</p>
        <p class="cb-filtersum">${filters ? `Showing ${list.length} of ${GUESTS.length}` : 'Showing every visitor'}</p>
        <p class="cb-small">Drag any page to turn it. Turn back past this page to close the book.</p>
        <div class="gb-orn low"></div>
      </div>${num(0)}`;
  }
  function layout(list, met, st, filters) {
    const nGrid = Math.max(1, Math.ceil(list.length / PER_GRID)), pageOf = new Map();
    list.forEach((gt, i) => pageOf.set(gt.id, 1 + nGrid + i));
    const pages = [titlePage(list, met, filters)];
    for (let k = 0; k < nGrid; k++) pages.push(grid(list, k, pageOf, 1 + k, nGrid, met, st));
    list.forEach((gt, i) => pages.push(profile(gt, 1 + nGrid + i, met)));
    if (pages.length % 2) pages.push(`<div class="cb-blank"><div class="gb-orn"></div><p>Room for new friends</p></div>${num(pages.length)}`);
    return pages;
  }

  let book = null, tb = null, lastSpread = 0, metNow = [];
  const run = BOOKFILTER.memo();
  const coverHTML = `<div class="pb-cover-art"><div class="pb-cover-frame"><div class="pb-cover-title">Guest Book</div><div class="pb-cover-emb gb-emb"></div><div class="pb-cover-sub">Cozy Ramen</div></div></div>`;
  function ensure() {
    if (book) return;
    watchPics(document.getElementById('guests'));
    book = PBOOK.create(document.getElementById('guests'), { skin: 'skin-album', coverHTML, sound: n => hooks.sound(n), onBackdrop: () => hooks.close(), requestClose: () => hooks.close(), onSettle: s => { lastSpread = s; } });
    tb = BOOKFILTER.toolbar(book.tabs, book.side, { placeholder: 'Search guests', tabs: TABS, select: { label: 'Favourite', any: 'any ramen', options: FAVS }, stamps: [] }, () => rebuild(true));
    book.body.addEventListener('click', e => {
      const go = e.target.closest('[data-goto]');
      if (go && !e.target.closest('.pb-leaf')) { book.flipToSpread(book.spreadOfPage(+go.dataset.goto)); hooks.sound('tap'); return; }
      if (e.target.closest('[data-act="reset"]')) tb.clear();
    });
  }
  const results = () => run(tb.key() + '#' + metNow.join(','), () => GUESTS.filter(gt => match(gt, tb.state, metNow)));
  function rebuild(fromFilter) {
    const list = results();
    book.setPages(layout(list, metNow, tb.state, tb.count() > 0), fromFilter ? 0 : lastSpread);
    tb.sync(list.length, GUESTS.length);
    if (fromFilter) { lastSpread = 0; hooks.sound('settle'); }
  }
  function open(opt) { ensure(); metNow = hooks.met().slice(); rebuild(false); book.open(opt); }
  function close(done) { if (book) book.close(done); else if (done) done(); }
  return {
    init: h => { hooks = Object.assign(hooks, h); }, open, close,
    next: () => book && book.next(), prev: () => book && book.prev(),
    get book() { return book; }, get toolbar() { return tb; }, results: () => (tb ? results() : []),
    // jump to a guest's profile page (screenshots and the face tool)
    // (before the book opens, it simply opens at that spread)
    showGuest: id => {
      ensure(); metNow = hooks.met().slice();
      const list = results(), i = list.findIndex(gt => gt.id === id); if (i < 0) return;
      const s = Math.floor((1 + Math.max(1, Math.ceil(list.length / PER_GRID)) + i) / 2);
      if (book.isOpen()) book.flipToSpread(s); else lastSpread = s;
    },
    // the portrait maths, for the face tool (index.html?facetool)
    pic, paint, faceOf,
    goToSpread: s => { ensure(); if (book.isOpen()) book.flipToSpread(s); else lastSpread = s; }
  };
})();
