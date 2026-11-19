'use strict';
/* The recipe book: a red leather cookbook built entirely from the game's own data (MENU, TARES, BROTHS, TOPS, STOCK,
   the level road and the live stock in G). Each ramen gets a spread (ingredients | method); each tare, broth, the
   noodles and each topping gets a page. Contents pages list whatever the current search and filters let through.
   PBOOK does the physical book, BOOKFILTER the search slip and tabs; this file only decides what is on the pages. */
const COOKBOOK = (() => {
  const esc = s => BOOKFILTER.esc(s);
  const PER_TOC = 12;
  const SPECIAL = MENU_KEYS_PREMIUM();   // the house specials: the premium bowls
  function MENU_KEYS_PREMIUM() { return Object.keys(MENU).filter(k => MENU[k].tier === 'premium'); }
  const NOTE = {   // a line of book copy for the things that have no menu description of their own
    'tare.miso': 'Fermented soybean paste. Deep, nutty and warming.',
    'tare.shoyu': 'Dark soy sauce tare. Savoury and bold.',
    'tare.shio': 'Salt tare. Clean, bright and simple.',
    'broth.pork': 'Pork bones simmered until the broth turns cloudy and rich.',
    'broth.chicken': 'A clear, golden stock of chicken and aromatics.',
    'broth.dashi': 'Kombu and bonito: light as the sea air.',
    noodle: 'Springy wheat noodles, boiled in a basket.'
  };

  /* ---------- pictures: drawn once into canvases and cached as data URLs ---------- */
  const pic = {};
  function draw(key, w, h, fn) {
    if (!pic[key]) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; fn(g); pic[key] = c.toDataURL(); }
    return pic[key];
  }
  const im = (url, cls = '') => `<img class="px ${cls}" src="${url}" alt="">`;
  const recipeItems = m => Object.entries(m.tops).flatMap(([id, n]) => Array(n).fill(id));
  const bowlURL = k => ART.figURL(k);   // each ramen's picture: its real bowl, printed in ink (ART.figURL)
  function iconURL(id) {
    if (id.startsWith('tare.')) { const t = TARES[id.slice(5)]; return draw(id, 40, 46, g => KITCHEN.spoon(g, 14, 38, true, t.c)); }
    if (id.startsWith('broth.')) { const b = BROTHS[id.slice(6)]; return draw(id, 60, 62, g => KITCHEN.ladle(g, 20, 52, true, 0, [b.c, b.dark, b.light])); }
    if (id === 'noodle') return draw(id, 60, 76, g => KITCHEN.basket(g, 24, 48, true, false, 0));
    if (id === CHILI_OIL) return draw(id, 30, 52, g => KITCHEN.oilBottle(g, 15, 50, 8));
    return draw('top.' + id, 30, 30, g => ART.top(g, id, 15, 15));
  }
  const ico = (id, cls = '') => `<span class="ico ${cls}">${im(iconURL(id), 'ico-img')}</span>`;
  const itemName = id => id === CHILI_OIL ? 'Chili oil' : (id.startsWith('tare.') ? TARES[id.slice(5)].name : id.startsWith('broth.') ? BROTHS[id.slice(6)].name : id === 'noodle' ? 'Noodles' : TOP_NAME[id]);
  const qty = (id, n) => id === CHILI_OIL ? n + ' splash' : (id.startsWith('tare.') ? n + ' spoon' : id.startsWith('broth.') ? n + ' ladle' : id === 'noodle' ? n + ' nest' : 'x' + n);

  /* ---------- the entries: one per thing in the game, built from the data ---------- */
  const ENTRIES = [
    ...Object.keys(MENU).map(k => { const m = MENU[k]; return { id: 'r.' + k, key: k, kind: 'ramen', cats: ['ramen', ...(SPECIAL.includes(k) ? ['special'] : [])], name: m.name, node: m.node, c: m.c,
      uses: { [tareKey(m.tare)]: 1, [brothKey(m.broth)]: 1, ...(m.spicy ? { [CHILI_OIL]: 1 } : {}), noodle: 1, ...m.tops }, on: () => menuOn(k) }; }),
    ...Object.keys(TARES).map(k => ({ id: tareKey(k), key: k, kind: 'tare', cats: ['soups'], name: TARES[k].name, node: TARES[k].node, c: TARES[k].c, uses: { [tareKey(k)]: 1 }, on: () => tareOn(k) })),
    ...Object.keys(BROTHS).map(k => ({ id: brothKey(k), key: k, kind: 'broth', cats: ['soups'], name: BROTHS[k].name, node: BROTHS[k].node, c: BROTHS[k].c, uses: { [brothKey(k)]: 1 }, on: () => brothOn(k) })),
    { id: 'noodle', key: 'noodle', kind: 'noodle', cats: ['noodles'], name: 'Ramen noodles', c: '#f0d890', uses: { noodle: 1 }, on: () => true },
    ...TOPS.map(id => ({ id, key: id, kind: 'top', cats: ['toppings'], name: TOP_NAME[id], node: TOP_NODE[id], c: '#8a6a3a', uses: { [id]: 1 }, on: () => topOn(id) }))
  ];
  const have = id => (window.G && G.stock ? G.stock[id] || 0 : 0);
  // unlocked / locked / can cook now (everything in stock) / missing ingredients (unlocked but short of something)
  function status(e) {
    const on = e.on(), short = Object.keys(e.uses).filter(id => have(id) < e.uses[id]);
    return { unlocked: on, locked: !on, cook: on && !short.length, missing: on && short.length > 0, short };
  }
  const CATS = [{ id: 'all', label: 'All' }, { id: 'ramen', label: 'Ramen' }, { id: 'soups', label: 'Soups' }, { id: 'noodles', label: 'Noodles' }, { id: 'toppings', label: 'Toppings' }, { id: 'special', label: 'Specials' }];
  const STAMPS = [{ id: 'unlocked', label: 'Unlocked' }, { id: 'locked', label: 'Locked' }, { id: 'cook', label: 'Can cook' }, { id: 'missing', label: 'Missing' }];
  const INGREDIENTS = [
    ...Object.keys(TARES).map(k => ({ id: tareKey(k), label: TARES[k].name, group: 'Tare' })),
    ...Object.keys(BROTHS).map(k => ({ id: brothKey(k), label: BROTHS[k].name, group: 'Broth' })),
    { id: 'noodle', label: 'Noodles', group: 'Noodles' },
    ...TOPS.map(id => ({ id, label: TOP_NAME[id], group: 'Toppings' }))
  ];
  // Filters stack: category AND search AND ingredient AND (any of the ticked availability stamps).
  function match(e, st) {
    if (st.cat !== 'all' && !e.cats.includes(st.cat)) return false;
    if (!BOOKFILTER.has(e.name, st.q)) return false;
    if (st.sel && !(st.sel in e.uses)) return false;
    if (st.stamps.size) { const s = status(e); if (![...st.stamps].some(id => s[id])) return false; }
    return true;
  }

  /* ---------- page templates ---------- */
  const num = p => `<span class="cb-num">${p + 1}</span>`;
  const unlockText = node => { const n = nodeFor(node); return n ? `${ROAD_NAME}: <b>${esc(n.place)}</b>, level ${n.level}.` : 'Available from day one.'; };
  function chip(s) {
    if (s.locked) return '<span class="cb-chip lock">Locked</span>';
    if (s.cook) return '<span class="cb-chip ok">Ready to cook</span>';
    return `<span class="cb-chip miss">Missing: ${s.short.map(id => esc(itemName(id).toLowerCase())).join(', ')}</span>`;
  }
  const lockStamp = s => (s.locked ? '<span class="cb-lockstamp">Locked</span>' : '');
  const link = (pageOf, e, label) => (pageOf.has(e.id) ? `<a class="cb-link" data-goto="${pageOf.get(e.id)}">${label}<i>p.${pageOf.get(e.id) + 1}</i></a>` : label);

  function ramenPages(e, p, pageOf) {
    const m = MENU[e.key], s = status(e), ids = Object.keys(e.uses);
    const left = `
      <div class="cb-chap"><i class="cb-dot" style="background:${m.c}"></i>Ramen &middot; ${TIER_NAME[m.tier]}${m.night ? ' &middot; Night only' : ''}${m.cold ? ' &middot; Served cold' : ''}</div>
      ${ART.figure(e.key, 'cb-fig', lockStamp(s))}
      <h3 class="cb-title">${esc(m.name)}</h3>
      <div class="cb-line">${chip(s)}<span class="price">${m.price}G</span></div>
      ${window.G && G.pick === e.key ? '<div class="cb-pick"><span class="pickme">&#9733; Chef\'s pick</span></div>' : window.G && G.menu && G.menu.includes(e.key) ? '<div class="cb-pick"><span class="cb-chip ok">On the menu</span></div>' : ''}
      <table class="cb-ingr"><thead><tr><th colspan="2">Ingredient</th><th>Qty</th><th>Have</th></tr></thead><tbody>
      ${ids.map(id => { const n = e.uses[id], h = have(id); return `<tr class="${h < n ? 'short' : ''}"><td>${ico(id)}</td><td>${link(pageOf, ENTRIES.find(x => x.id === id), esc(itemName(id)))}</td><td class="q">${qty(id, n)}</td><td class="h">${h}</td></tr>`; }).join('')}
      </tbody></table>${num(p)}`;
    const tops = Object.keys(m.tops).map(id => esc(TOP_NAME[id].toLowerCase()) + (m.tops[id] > 1 ? ' x' + m.tops[id] : '')).join(', ');
    const tk = tareKey(m.tare), bk = brothKey(m.broth);
    // the recipe's special steps (optional: they only improve the bowl's grade)
    const steps = [];
    if (m.cold) steps.push('<b>Ice bath</b>: rinse the READY noodles in the ice bath (click it), then click it again to put them in. Served cold, no steam.');
    if (m.tops.emberpep) steps.push(`<b>Ember pepper oil</b>: hold on the bowl to pour ${m.tops.emberpep} swirl${m.tops.emberpep > 1 ? 's' : ''}, then let go.`);
    if (m.tops.mayu) steps.push('<b>Black garlic oil</b>: hold on the bowl to pour one swirl, then let go.');
    if (m.tops.sesame) steps.push('<b>Sesame</b>: hold on the bowl to grind it; let go while it is fine (under a second and a half).');
    if (TORCH_RECIPES.includes(e.key)) { const meat = TORCH_MEATS.find(id => m.tops[id]); steps.push(`<b>Torched ${esc(TOP_NAME[meat].toLowerCase())}</b>: hold on the bowl until it turns golden (about a second).`); }
    if (m.tops.mandrake) steps.push('<b>Mandrake root</b>: it goes in whole; click the bowl to slice it. It squeaks.');
    if (m.tops.butter) steps.push('<b>Butter</b>: it melts as it waits; serve it before it is gone.');
    if (m.strict && steps.length) steps.push('<b>Hiro\'s rule</b>: every touch must be perfect. A fluffed step costs three times as much here.');
    const right = `
      <div class="cb-chap">Method</div>
      <p class="cb-quote">&ldquo;${esc(m.desc)}&rdquo;</p>
      <h4>Stocking up</h4>
      <ul class="cb-prep">
        <li>${ico(tk, 'sm')}<span><b>${esc(TARES[m.tare].name)}</b>: ${packSize(tk)} spoons a jar at Kitsune-ya (${SUPPLY_PRICE[tk]}G).</span></li>
        <li>${ico(bk, 'sm')}<span><b>${esc(BROTHS[m.broth].name)}</b>: ${packSize(bk)} ladles a pack at Kitsune-ya (${SUPPLY_PRICE[bk]}G).</span></li>
        <li>${ico(Object.keys(m.tops)[0], 'sm')}<span><b>Toppings</b>: packs of ${packSize('chashu')} at Kitsune-ya, straight into the bins.</span></li>
      </ul>
      <h4>Cooking</h4>
      <ol class="cb-steps">
        <li>Spoon <b>${esc(TARES[m.tare].short.toLowerCase())} tare</b> into an empty bowl.</li>
        <li>Ladle <b>${esc(BROTHS[m.broth].name.toLowerCase())}</b> over it.</li>${m.spicy ? '<li>Click the <b>chili oil</b> bottle: the broth turns red and spicy.</li>' : ''}
        <li>Boil a nest for <b>${cookTime()}s</b>, then ${m.cold ? 'chill it in the ice bath and put it in' : 'tip the basket in'}.</li>
        <li>Add ${tops}.</li>
        <li>Pass it, then serve it to the guest at the counter.</li>
      </ol>
      ${steps.length ? `<h4>Special touch</h4><ul class="cb-steps cb-touch">${steps.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
      <dl class="cb-facts"><dt>Cook time</dt><dd>${cookTime()}s noodles</dd><dt>Needs</dt><dd>${unlockText(m.node)}</dd></dl>${num(p + 1)}`;
    return [left, right];
  }
  function itemPage(e, p, pageOf) {
    const s = status(e), id = e.id, def = STOCK[id];
    const chap = { tare: 'Soups &middot; Tare', broth: 'Soups &middot; Broth', noodle: 'Noodles', top: 'Toppings' }[e.kind];
    const where = e.kind === 'tare' ? `the ${esc(TARES[e.key].short.toLowerCase())} crock` : e.kind === 'broth' ? `the ${esc(BROTHS[e.key].short.toLowerCase())} pot` : e.kind === 'noodle' ? 'the noodle tray' : 'its topping bin';
    const users = ENTRIES.filter(x => x.kind === 'ramen' && id in x.uses);
    return `
      <div class="cb-chap"><i class="cb-dot" style="background:${e.c}"></i>${chap}</div>
      <h3 class="cb-title">${esc(e.name)}</h3>
      <div class="cb-art">${ico(id, 'big')}${lockStamp(s)}</div>
      <div class="cb-line">${chip(s)}</div>
      <p class="cb-quote">${esc(NOTE[id] || TOP_DESC[id] || '')}</p>
      <dl class="cb-facts">
        <dt>In the kitchen</dt><dd>${have(id)} in ${where}</dd>
        <dt>Restock</dt><dd>${packSize(id)} a pack, ${SUPPLY_PRICE[id]}G at Kitsune-ya</dd>${e.kind === 'top' ? `<dt>As an extra</dt><dd>+${extraPrice(id)}G when a guest asks for more</dd>` : ''}
        ${e.kind === 'noodle' ? `<dt>Boil</dt><dd>${cookTime()}s in a basket; ready noodles never overcook</dd>` : ''}
        <dt>Needs</dt><dd>${unlockText(e.node)}</dd>
      </dl>
      <h4>Used in</h4>
      <ul class="cb-used">${users.map(u => `<li><i class="cb-dot" style="background:${u.c}"></i>${link(pageOf, u, esc(u.name))}</li>`).join('')}</ul>${num(p)}`;
  }
  function mark(e) { const s = status(e); return s.locked ? '<b class="mk lock" title="Locked"></b>' : s.cook ? '<b class="mk ok" title="Ready to cook"></b>' : '<b class="mk miss" title="Missing ingredients"></b>'; }
  function tocPage(list, k, pageOf, p, total, st) {
    const rows = list.slice(k * PER_TOC, (k + 1) * PER_TOC);
    const body = !list.length
      ? `<div class="cb-empty"><p>No recipes match${st.q.trim() ? ` &ldquo;${esc(st.q.trim())}&rdquo;` : ''}.</p><p>Try another word, or clear the filters.</p><button type="button" class="btn" data-act="reset">Clear filters</button></div>`
      : `<ol class="cb-toc">${rows.map(e => `<li data-goto="${pageOf.get(e.id)}">${e.kind === 'ramen' ? `<span class="ico">${im(bowlURL(e.key), 'ico-img')}</span>` : ico(e.id)}<span class="nm">${esc(e.name)}</span><i class="lead"></i><span class="pg">${pageOf.get(e.id) + 1}</span>${mark(e)}</li>`).join('')}</ol>`;
    return `<h3 class="cb-head">Contents${total > 1 ? ` <small>${k + 1}/${total}</small>` : ''}</h3>${body}${num(p)}`;
  }
  function titlePage(list, st, filters) {
    const all = ENTRIES.map(status), on = all.filter(s => s.unlocked).length, cook = all.filter(s => s.cook).length;
    const sum = [];
    if (st.cat !== 'all') sum.push(CATS.find(c => c.id === st.cat).label);
    for (const id of st.stamps) sum.push(STAMPS.find(s => s.id === id).label);
    if (st.sel) sum.push('uses ' + itemName(st.sel).toLowerCase());
    if (st.q.trim()) sum.push('&ldquo;' + esc(st.q.trim()) + '&rdquo;');
    return `
      <div class="cb-titlepage">
        <div class="cb-orn"></div>
        <h2>The Cozy Ramen<br>Cookbook</h2>
        <div class="cb-art">${ART.figure('miso', 'cb-fig-c')}</div>
        <p class="cb-quote">Recipes of the house, kept by the chef.</p>
        <p class="cb-count">${ENTRIES.length} recipes &middot; ${on} unlocked &middot; ${cook} ready to cook</p>
        <p class="cb-filtersum">${filters ? `Showing ${list.length}: ${sum.join(' &middot; ')}` : 'Showing every recipe'}</p>
        <p class="cb-small">Drag any page across the spine to turn it. Turn back past this page to close the book. The bookmarks find a recipe.</p>
        <div class="cb-orn low"></div>
      </div>${num(0)}`;
  }
  const blank = p => `<div class="cb-blank"><div class="cb-orn"></div><p>Notes</p></div>${num(p)}`;
  // A chapter's title page, used where a ramen spread has to start on the next left page anyway.
  const CHAPTER = { ramen: ['Ramen', 'The bowls of the house'], tare: ['Soups', 'Tares and broths'], broth: ['Soups', 'Tares and broths'], noodle: ['Noodles', 'The heart of every bowl'], top: ['Toppings', 'The finishing touches'] };
  const divider = (kind, p) => `<div class="cb-blank cb-divider"><div class="cb-orn"></div><h2>${CHAPTER[kind][0]}</h2><p>${CHAPTER[kind][1]}</p>${kind === 'ramen' ? ART.figure('shoyu', 'cb-fig-c') : ''}<div class="cb-orn"></div></div>${num(p)}`;
  const notesPage = p => `<h3 class="cb-head">Kitchen notes</h3><ul class="cb-tips">
      <li>Click a crock, a pot, a READY basket or a topping bin and it flies into the glowing bowl (click a bowl or press Tab to choose it). Keys 1-9 add the topping in that bin; a recipe's double portion goes in with one click, Shift adds just one. Dragging works too.</li>
      <li>Each slip shows the ramen's name. Lines in green or red are the guest's changes: + adds a topping, &minus; leaves one out.</li>
      <li>Every recipe needs its own tare and broth. Check the name on the crock and the pot.</li>
      <li>Noodles wait in the basket once they are ready, so nothing overcooks.</li>
      <li>If a guest asks for a recommendation, offer the chef's pick: choose it (and the whole menu) at the menu board.</li>
      <li>The kitchen is one long counter: hold A / D or scroll the mouse wheel to look along it.</li>
      <li>Restock at Kitsune-ya, through the staff door at the far left of the serving room, from ${pad(SHOP_HOURS.open)}:00 to ${pad(SHOP_HOURS.close)}:00. Packs go straight into the kitchen; it sells road-unlocked tools too.</li>
      <li>No one is in a hurry here.</li></ul>${num(p)}`;
  const pad = n => String(n).padStart(2, '0');

  // Lay the results out: title, contents, then entries (a ramen's spread always starts on a left page).
  function layout(list, st, filters) {
    const toc = Math.max(1, Math.ceil(list.length / PER_TOC));
    const slots = [], pageOf = new Map();
    let p = 1 + toc, prev = null;
    for (const e of list) {
      if (e.kind === 'ramen' && p % 2) { slots.push({ blank: p, chapter: prev !== 'ramen' ? 'ramen' : null }); p++; }
      prev = e.kind;
      pageOf.set(e.id, p); slots.push({ e, p }); p += e.kind === 'ramen' ? 2 : 1;
    }
    const pages = [titlePage(list, st, filters)];
    for (let k = 0; k < toc; k++) pages.push(tocPage(list, k, pageOf, 1 + k, toc, st));
    for (const sl of slots) {
      if (sl.blank != null) pages.push(sl.chapter ? divider(sl.chapter, sl.blank) : blank(sl.blank));
      else if (sl.e.kind === 'ramen') pages.push(...ramenPages(sl.e, sl.p, pageOf));
      else pages.push(itemPage(sl.e, sl.p, pageOf));
    }
    if (!filters) pages.push(notesPage(pages.length));
    if (pages.length % 2) pages.push(blank(pages.length));
    return pages;
  }

  /* ---------- wiring ---------- */
  let book = null, tb = null, hooks = { sound: () => {}, close: () => {} }, lastSpread = 0, sig = '';
  const run = BOOKFILTER.memo();
  const coverHTML = () => `<div class="pb-cover-art"><div class="pb-cover-frame">
      <div class="pb-cover-title">Cozy Ramen</div>${ART.figure('miso', 'pb-cover-fig')}<div class="pb-cover-sub">Cookbook</div></div></div>`;
  function ensure() {
    if (book) return;
    book = PBOOK.create(document.getElementById('book'), { skin: 'skin-recipe', coverHTML: coverHTML(), sound: n => hooks.sound(n), onBackdrop: () => hooks.close(), requestClose: () => hooks.close(), onSettle: s => { lastSpread = s; } });
    tb = BOOKFILTER.toolbar(book.tabs, book.side, { placeholder: 'Search recipes', tabs: CATS, select: { label: 'Uses', any: 'any ingredient', options: INGREDIENTS }, stamps: STAMPS }, () => rebuild(true));
    book.body.addEventListener('click', e => {
      const go = e.target.closest('[data-goto]');
      if (go && !e.target.closest('.pb-leaf')) { book.flipToSpread(book.spreadOfPage(+go.dataset.goto)); return; }
      if (e.target.closest('[data-act="reset"]')) tb.clear();
    });
  }
  const stateSig = () => (window.G ? JSON.stringify([G.stock, G.owned, G.menu, G.pick]) : '');
  function results() { return run(tb.key() + '#' + sig, () => ENTRIES.filter(e => match(e, tb.state))); }
  function rebuild(fromFilter) {
    const list = results();
    book.setPages(layout(list, tb.state, tb.count() > 0), fromFilter ? 0 : lastSpread);
    tb.sync(list.length, ENTRIES.length);
    if (fromFilter) { lastSpread = 0; hooks.sound('settle'); }
  }
  function open(opt) { ensure(); sig = stateSig(); rebuild(false); book.open(opt); }
  function close(done) { if (book) book.close(done); else if (done) done(); }
  return {
    init: h => { hooks = Object.assign(hooks, h); },
    open, close,
    next: () => book && book.next(), prev: () => book && book.prev(),
    goToSpread: s => { ensure(); lastSpread = s; if (book.isOpen()) book.flipToSpread(s); },
    // for tests: the live filter/toolbar and book state
    get book() { return book; }, get toolbar() { return tb; }, entries: ENTRIES, status, match, results: () => (tb ? results() : [])
  };
})();
