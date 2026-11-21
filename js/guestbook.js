'use strict';
/* The guest book: an indigo cloth photo album with the same physical book (PBOOK) and search slip (BOOKFILTER) as the
   cookbook. Contents pages are taped polaroids; every guest has a profile page. Guests not met yet stay silhouettes
   named "???", and searching never reveals their names. */
const GUESTBOOK = (() => {
  const esc = s => BOOKFILTER.esc(s);
  const PER_GRID = 12, TILT = [-2, 1.5, -1, 2, 0.5, -1.5];
  let hooks = { sound: () => {}, close: () => {}, img: () => null, met: () => [], aff: () => ({}) };

  /* A crop of each guest's head and shoulders: [x, y, size] of a square in the PNG's own pixels. The sprites are
     drawn at different scales, so each crop was measured from the sprite's pixels (head band and width), then
     hand-tuned for guests whose weapons widened the measurement.
     A new guest without an entry gets a crop worked out from ax / head / bottom in guests.js. */
  const FACE = {
    annabel: [22, 0, 68], eyvira: [13, 0, 65], iris: [16, 7, 64], leona: [23, 0, 77], lilli: [37, 17, 58], lisara: [18, 11, 62],
    luna: [46, 0, 73], lyriana: [29, 4, 63], nara: [25, 7, 63], yara: [85, 5, 65], angelica: [68, 19, 80], astrid: [66, 46, 84],
    celestia: [2, 0, 76], clara: [28, 0, 85], coco: [52, 12, 95], deerlara: [64, 0, 119], elfina: [26, 0, 74], erica: [37, 0, 96],
    glaire: [41, 0, 70], iguara: [71, 0, 85], imani: [113, 2, 75], kaya: [10, 10, 80], seraphina: [31, 0, 77], tilia: [34, 6, 75],
    naida: [87, 0, 75], kira: [37, 21, 81], mara: [45, 0, 76], misty: [33, 6, 75], morticia: [26, 0, 75], vyra: [101, 20, 80],
    sylva: [77, 0, 66], fae: [67, 18, 85], mortis: [21, 55, 85],
    lucaria: [14, 20, 67], maddy: [51, 4, 80], snailia: [41, 47, 78], ursula: [118, 16, 80], aurora: [113, 43, 61], talia: [50, 77, 64],
    lilith: [102, 6, 66], abyzara: [76, 64, 82], adeline: [44, 13, 71], aurelia: [61, 0, 85], calista: [28, 0, 75], aoi: [44, 12, 72],
    fynja: [48, 22, 78], glacia: [62, 29, 80], rizz: [32, 0, 66], willka: [63, 2, 75], zyra: [82, 28, 80]
  };
  function faceOf(gt) {
    if (FACE[gt.id]) return FACE[gt.id];
    const S = Math.round((gt.bottom - gt.head) * 0.38);
    return [Math.round(gt.ax - S / 2), Math.max(0, gt.top - 2), S];
  }
  /* The portrait is a CSS crop straight from the PNG: copying a PNG through a canvas (toDataURL) is blocked by browsers
     when the game runs from local files. Unmet guests get a CSS silhouette. bw x bh is the frame in layout units. */
  function portrait(gt, bw, bh, sil) {
    const im = hooks.img(gt.id), nw = (im && im.naturalWidth) || gt.w, nh = (im && im.naturalHeight) || gt.h;
    const [x0, y0, S] = faceOf(gt), k = bw / S, u = n => `calc(${(n * k).toFixed(3)} * var(--u))`;
    return `<span class="gb-pic${sil ? ' sil' : ''}" style="width:calc(${bw} * var(--u));height:calc(${bh} * var(--u))"><i style="background-image:url('assets/guests/${gt.id}.png');background-size:${u(nw)} ${u(nh)};background-position:${u(-x0)} ${u(-y0)}"></i></span>`;
  }

  /* The detailed portrait for a profile page: the whole character, top of the head (or hat) to the bottom of the
     sprite, scaled to fit the frame's height and centred on the body. Very wide sprites (big weapons, wings) are
     scaled down to keep most of the width too; anything left over at the sides is trimmed by the frame. */
  function fullBody(gt, bw, bh, sil) {
    const im = hooks.img(gt.id), nw = (im && im.naturalWidth) || gt.w, nh = (im && im.naturalHeight) || gt.h;
    const tall = gt.bottom - gt.top + 1, k = Math.min(bh / tall, (bw * 1.6) / nw);
    const x = bw / 2 - gt.ax * k, y = (bh - tall * k) - gt.top * k, u = n => `calc(${n.toFixed(3)} * var(--u))`;
    return `<span class="gb-pic full${sil ? ' sil' : ''}" style="width:calc(${bw} * var(--u));height:calc(${bh} * var(--u))"><i style="background-image:url('assets/guests/${gt.id}.png');background-size:${u(nw * k)} ${u(nh * k)};background-position:${u(x)} ${u(y)}"></i></span>`;
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
    const photo = `<div class="profile-photo full${known ? '' : ' unmet'}">${fullBody(gt, 74, 146, !known)}</div>`;
    if (!known) return `
      <div class="gb-chap">Guest No. ${no}</div>
      <div class="gb-profile">${photo}<div class="gb-about">
        <div class="ribbon">???</div>
        <p class="gb-title">Not met yet</p>
        <p class="gb-quote">Serve them a bowl and this page will fill in.</p>
      </div></div>${num(p)}`;
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
        <p class="gb-quote">&ldquo;${esc(gt.hi)}&rdquo;</p>
      </div></div>${num(p)}`;
  }
  // Five hearts (filled up to the guest's rank), the rank's name, and how far it is to the next one.
  function affRow(id) {
    const pts = (hooks.aff() || {})[id] || 0, l = affLevel(pts), next = affNext(pts);
    const hearts = AFFINITY.map((a, i) => `<i class="aff-h${i <= l ? ' on' : ''}"></i>`).join('');
    return `<span class="aff">${hearts}</span> ${esc(AFFINITY[l].name)}${next ? ` <small class="aff-to">${next - pts} to go</small>` : ''}`;
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
    get book() { return book; }, get toolbar() { return tb; }, results: () => (tb ? results() : [])
  };
})();
