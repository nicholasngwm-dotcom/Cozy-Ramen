'use strict';
/* Search and filters for the books.
   Logic: case-insensitive partial matching, and a memo so a list is only re-filtered when the filters change.
   UI: everything is part of the book itself. Cloth bookmarks along the top edge pick the category, a small paper
   tag on the top edge holds the search line, a "uses" bookmark holds the ingredient picker, and ribbon bookmarks
   sticking out of the right edge are the availability filters and the reset. A raised bookmark is an active filter. */
const BOOKFILTER = (() => {
  const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const has = (text, query) => { const q = norm(query); return !q || norm(text).includes(q); };
  // Remember the last result: run(key, fn) only calls fn when key differs from the previous call's.
  function memo() { let k = null, v = null; return (key, fn) => (key === k ? v : (k = key, v = fn())); }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* cfg: { placeholder, tabs: [{id, label}], select: {label, any, options: [{id, label, group?}]}, stamps: [{id, label}] }
     onChange(state) runs on every keystroke and click; state = { q, cat, sel, stamps: Set } */
  function toolbar(topEl, sideEl, cfg, onChange) {
    const st = { q: '', cat: cfg.tabs[0].id, sel: '', stamps: new Set() };
    const groups = [];
    for (const op of cfg.select.options) { let g = groups.find(x => x.name === (op.group || '')); if (!g) groups.push(g = { name: op.group || '', items: [] }); g.items.push(op); }
    topEl.innerHTML = `
      <div class="pb-marks">${cfg.tabs.map(t => `<button type="button" class="pb-tab" data-id="${esc(t.id)}">${esc(t.label)}</button>`).join('')}</div>
      <div class="pb-marks pb-marks-r">
        <label class="pb-tab pb-uses" title="${esc(cfg.select.label)}">${esc(cfg.select.label)}<select>
          <option value="">${esc(cfg.select.any)}</option>
          ${groups.map(g => (g.name ? `<optgroup label="${esc(g.name)}">` : '') + g.items.map(op => `<option value="${esc(op.id)}">${esc(op.label)}</option>`).join('') + (g.name ? '</optgroup>' : '')).join('')}
        </select></label>
        <label class="pb-tab pb-search" title="Search by name"><i class="pb-glass"></i><input type="text" spellcheck="false" autocomplete="off" placeholder="${esc(cfg.placeholder)}"><button type="button" class="pb-x" title="Clear search" aria-label="Clear search">&times;</button></label>
      </div>`;
    sideEl.innerHTML = cfg.stamps.map(s => `<button type="button" class="pb-stamp" data-id="${esc(s.id)}" aria-pressed="false">${esc(s.label)}</button>`).join('')
      + `<button type="button" class="pb-reset" title="Reset all filters">Reset</button>`;
    const input = topEl.querySelector('input'), sel = topEl.querySelector('select'), x = topEl.querySelector('.pb-x'), reset = sideEl.querySelector('.pb-reset');
    const fire = () => { sync(); onChange(st); };
    input.addEventListener('input', () => { st.q = input.value; fire(); });
    x.addEventListener('click', () => { input.value = ''; st.q = ''; fire(); input.focus(); });
    sel.addEventListener('change', () => { st.sel = sel.value; fire(); });
    sideEl.querySelectorAll('.pb-stamp').forEach(b => b.addEventListener('click', () => { const id = b.dataset.id; st.stamps.has(id) ? st.stamps.delete(id) : st.stamps.add(id); fire(); }));
    topEl.querySelectorAll('button.pb-tab').forEach(b => b.addEventListener('click', () => { st.cat = b.dataset.id; fire(); }));
    reset.addEventListener('click', () => { clear(); fire(); });
    function clear() { st.q = ''; st.cat = cfg.tabs[0].id; st.sel = ''; st.stamps.clear(); input.value = ''; sel.value = ''; }
    const count = () => (st.q.trim() ? 1 : 0) + (st.cat !== cfg.tabs[0].id ? 1 : 0) + (st.sel ? 1 : 0) + st.stamps.size;
    function sync(shown, total) {
      x.classList.toggle('on', !!st.q);
      input.parentElement.classList.toggle('on', !!st.q.trim());
      sel.parentElement.classList.toggle('on', !!st.sel);
      sideEl.querySelectorAll('.pb-stamp').forEach(b => { const on = st.stamps.has(b.dataset.id); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      topEl.querySelectorAll('button.pb-tab').forEach(b => b.classList.toggle('on', b.dataset.id === st.cat));
      reset.disabled = !count();
      if (shown != null) reset.title = `Reset all filters (${shown} of ${total} shown)`;
    }
    sync();
    return { state: st, key: () => [norm(st.q), st.cat, st.sel, [...st.stamps].sort().join('+')].join('|'), count, sync, clear: () => { clear(); fire(); }, input };
  }

  return { norm, has, memo, esc, toolbar };
})();
