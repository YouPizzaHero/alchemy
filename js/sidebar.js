// Library sidebar: filterable, searchable, sortable list of discovered
// elements. Three sort modes (alphabetical / most-recent / by category)
// and multi-select category filtering — any combination of categories
// can be active at once; an empty active set means "show all".
(function (global) {
  'use strict';

  // localStorage keys for the player's UI preferences.
  const KEY_SORT     = 'alchemy_sort';        // 'name' | 'recent' | 'category'
  const KEY_CATS     = 'alchemy_active_cats'; // comma-separated category ids
  const KEY_COLLAPSE = 'alchemy_filters_collapsed';

  const SORT_MODES = { name: true, recent: true, category: true };

  let listEl, searchEl, tabsEl, toggleBtn, libraryEl, filterToggleBtn, ftActiveEl, sortBarEl;
  // activeCategories empty ⇒ "All"; non-empty ⇒ show items whose category is in the set.
  const activeCategories = new Set();
  let sortMode = 'name';
  let searchQuery = '';
  let filtersCollapsed = false;

  // Mounted tile cache so a discovery doesn't have to rebuild the whole
  // library: we only insert the new tile and re-sort if needed.
  const tileNodes = new Map();   // elementId -> tile node
  let lastRenderKey = '';        // detects when a full rebuild is needed

  // Category list. 'all' is a special pseudo-tab that clears the
  // multi-select set; it visually highlights when no specific tabs
  // are active. All other tabs toggle inclusion independently.
  const CATEGORIES = [
    { id: 'all',       label: 'All' },
    { id: 'liquid',    label: 'Liquid' },
    { id: 'fire',      label: 'Fire' },
    { id: 'earth',     label: 'Earth' },
    { id: 'air',       label: 'Air' },
    { id: 'plant',     label: 'Plant' },
    { id: 'animal',    label: 'Animal' },
    { id: 'tool',      label: 'Tool' },
    { id: 'structure', label: 'Build' },
    { id: 'mineral',   label: 'Mineral' },
    { id: 'mythic',    label: 'Mythic' },
    { id: 'time',      label: 'Time' },
    { id: 'abstract',  label: 'Idea' },
  ];

  function init() {
    listEl    = document.getElementById('library-list');
    searchEl  = document.getElementById('search');
    tabsEl    = document.getElementById('category-tabs');
    toggleBtn = document.getElementById('btn-library-toggle');
    libraryEl = document.getElementById('library');
    filterToggleBtn = document.getElementById('filter-toggle');
    ftActiveEl      = document.getElementById('ft-active');
    sortBarEl       = document.getElementById('sort-bar');

    // Restore preferences. Quietly fall back to defaults on any error
    // (Safari private mode, deleted keys, malformed values).
    try {
      const s = localStorage.getItem(KEY_SORT);
      if (s && SORT_MODES[s]) sortMode = s;
    } catch (e) {}
    try {
      const c = localStorage.getItem(KEY_CATS);
      if (c) {
        for (const id of c.split(',')) {
          if (id && CATEGORIES.find(x => x.id === id && id !== 'all')) {
            activeCategories.add(id);
          }
        }
      }
    } catch (e) {}
    try { filtersCollapsed = localStorage.getItem(KEY_COLLAPSE) === '1'; } catch (e) {}

    renderTabs();
    renderSortBar();

    searchEl.addEventListener('input', () => {
      searchQuery = searchEl.value.trim().toLowerCase();
      renderFull();
    });

    toggleBtn.addEventListener('click', () => {
      libraryEl.classList.toggle('collapsed');
    });

    applyFilterCollapse();

    filterToggleBtn.addEventListener('click', () => {
      filtersCollapsed = !filtersCollapsed;
      try { localStorage.setItem(KEY_COLLAPSE, filtersCollapsed ? '1' : '0'); } catch (e) {}
      applyFilterCollapse();
    });

    if (sortBarEl) {
      sortBarEl.addEventListener('click', (e) => {
        const opt = e.target.closest('.sort-opt');
        if (!opt || !opt.dataset.sort) return;
        const next = opt.dataset.sort;
        if (!SORT_MODES[next] || next === sortMode) return;
        sortMode = next;
        try { localStorage.setItem(KEY_SORT, sortMode); } catch (e) {}
        applySortButtons();
        renderFull();
      });
    }

    State.onChange(render);
    render();
  }

  function applyFilterCollapse() {
    libraryEl.classList.toggle('filters-collapsed', filtersCollapsed);
    filterToggleBtn.setAttribute('aria-expanded', filtersCollapsed ? 'false' : 'true');
    updateFilterToggleLabel();
  }

  function applySortButtons() {
    if (!sortBarEl) return;
    for (const b of sortBarEl.querySelectorAll('.sort-opt')) {
      b.classList.toggle('active', b.dataset.sort === sortMode);
      b.setAttribute('aria-pressed', b.dataset.sort === sortMode ? 'true' : 'false');
    }
  }

  function updateFilterToggleLabel() {
    if (!ftActiveEl) return;
    if (filtersCollapsed && activeCategories.size > 0) {
      // Show the active tags compactly when collapsed (e.g. "Fire +2").
      const labels = [...activeCategories].map(id => {
        const cat = CATEGORIES.find(c => c.id === id);
        return cat ? cat.label : id;
      });
      if (labels.length === 1) {
        ftActiveEl.textContent = labels[0];
      } else {
        ftActiveEl.textContent = labels[0] + ' +' + (labels.length - 1);
      }
    } else {
      ftActiveEl.textContent = '';
    }
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    for (const cat of CATEGORIES) {
      const b = document.createElement('button');
      b.className = 'cat-tab';
      b.type = 'button';
      b.dataset.cat = cat.id;
      b.setAttribute('role', 'tab');
      const label = document.createElement('span');
      label.className = 'cat-label';
      label.textContent = cat.label;
      const count = document.createElement('span');
      count.className = 'cat-count';
      count.dataset.cat = cat.id;
      b.appendChild(label);
      b.appendChild(count);
      b.addEventListener('click', () => onTabClick(cat.id));
      tabsEl.appendChild(b);
    }
    applyTabActiveStates();
  }

  function onTabClick(id) {
    if (id === 'all') {
      // The 'All' tab just clears the multi-select set. Idempotent —
      // tapping it again is a no-op visually.
      if (activeCategories.size === 0) return;
      activeCategories.clear();
    } else {
      if (activeCategories.has(id)) activeCategories.delete(id);
      else activeCategories.add(id);
    }
    persistActiveCategories();
    applyTabActiveStates();
    updateFilterToggleLabel();
    renderFull();
  }

  function persistActiveCategories() {
    try {
      localStorage.setItem(KEY_CATS, [...activeCategories].join(','));
    } catch (e) {}
  }

  function applyTabActiveStates() {
    for (const t of tabsEl.querySelectorAll('.cat-tab')) {
      const id = t.dataset.cat;
      const active = (id === 'all')
        ? activeCategories.size === 0
        : activeCategories.has(id);
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    }
  }

  function renderSortBar() {
    applySortButtons();
  }

  function updateTabCounts() {
    const totals = new Map();    // category -> total in dataset
    const founds = new Map();    // category -> player has discovered
    let totalAll = 0, foundAll = 0;
    for (const el of State.state.elements) {
      totals.set(el.category, (totals.get(el.category) || 0) + 1);
      totalAll++;
      if (State.isDiscovered(el.id)) {
        founds.set(el.category, (founds.get(el.category) || 0) + 1);
        foundAll++;
      }
    }
    for (const node of tabsEl.querySelectorAll('.cat-count')) {
      const cat = node.dataset.cat;
      if (cat === 'all') {
        node.textContent = foundAll + '/' + totalAll;
      } else {
        const f = founds.get(cat) || 0;
        const t = totals.get(cat) || 0;
        node.textContent = f + '/' + t;
      }
    }
  }

  // Two render paths:
  //   render()      — called on every State change (discovery). Tries to
  //                   insert just the new tile(s); falls back to a full
  //                   rebuild if filters/search/sort changed.
  //   renderFull()  — full rebuild for filter/search/sort/tab changes.
  function render() {
    const visible = filterAndSort();
    const key = renderKey();
    if (key !== lastRenderKey) { renderFull(); return; }

    const present = new Set(tileNodes.keys());
    const needed = visible.filter(el => !present.has(el.id));
    if (needed.length === 0) {
      // Nothing new visible — but the player may have reset (set shrunk).
      // Drop stale nodes; if the list is now empty, fall through to
      // renderFull so the empty-state can paint.
      pruneStaleTiles(visible);
      if (tileNodes.size === 0) { renderFull(); return; }
      updateTabCounts();
      return;
    }
    pruneStaleTiles(visible);
    const empty = listEl.querySelector('.empty-state');
    if (empty) empty.remove();
    // Insert each new tile at its correct sorted slot. `visible` is
    // already sorted by the active mode, so we just look up the
    // immediate successor to place the new tile before it.
    for (const el of needed) {
      const node = buildLibTile(el);
      tileNodes.set(el.id, node);
      const idx = visible.findIndex(v => v.id === el.id);
      const next = visible[idx + 1];
      const ref = next ? tileNodes.get(next.id) : null;
      listEl.insertBefore(node, ref || null);
    }
    updateTabCounts();
  }

  function renderFull() {
    listEl.innerHTML = '';
    tileNodes.clear();
    const els = filterAndSort();
    lastRenderKey = renderKey();

    if (els.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = searchQuery
        ? 'No matches in your grimoire.'
        : activeCategories.size > 0
          ? 'Nothing in those categories yet.'
          : 'Nothing here yet. Drag the basic elements out and combine them.';
      listEl.appendChild(empty);
    } else {
      for (const el of els) {
        const node = buildLibTile(el);
        tileNodes.set(el.id, node);
        listEl.appendChild(node);
      }
    }
    updateTabCounts();
  }

  // Filter respects the multi-select category set + search query, then
  // sort by the active mode. Memoised cheaply via tileNodes for the
  // incremental render() path.
  function filterAndSort() {
    const filtered = State.state.elements.filter(el => {
      if (!State.isDiscovered(el.id)) return false;
      if (activeCategories.size > 0 && !activeCategories.has(el.category)) return false;
      if (searchQuery && !el.name.toLowerCase().includes(searchQuery)) return false;
      return true;
    });
    sortInPlace(filtered);
    return filtered;
  }

  function sortInPlace(arr) {
    if (sortMode === 'recent') {
      // Most recent first. The discovered Set's insertion order is the
      // canonical history; higher index = newer. Snapshot it once into
      // a Map so we don't pay O(n) per comparator call.
      const idx = new Map();
      let i = 0;
      for (const id of State.state.discovered) idx.set(id, i++);
      arr.sort((a, b) => (idx.get(b.id) ?? -1) - (idx.get(a.id) ?? -1));
    } else if (sortMode === 'category') {
      arr.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.name.localeCompare(b.name);
      });
    } else {
      // Default: alphabetical by display name.
      arr.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  function renderKey() {
    // Joining with characters that can't appear in slugs keeps the key
    // unambiguous across all field-combination scenarios.
    return sortMode + '|' + [...activeCategories].sort().join(',') + '|' + searchQuery;
  }

  function pruneStaleTiles(visible) {
    const visibleIds = new Set(visible.map(e => e.id));
    for (const [id, node] of [...tileNodes.entries()]) {
      if (!visibleIds.has(id)) {
        node.remove();
        tileNodes.delete(id);
      }
    }
  }

  function buildLibTile(el) {
    const t = document.createElement('div');
    t.className = 'lib-tile';
    t.dataset.id = el.id;
    t.appendChild(Icons.buildIcon(el));
    const nm = document.createElement('div');
    nm.className = 'name';
    nm.textContent = el.name;
    t.appendChild(nm);
    Workspace.attachLibraryDragSource(t, el.id);
    t.addEventListener('click', (e) => {
      // If a drag-ghost is still around, the player just finished a
      // drag — don't open lineage in that case.
      if (document.querySelector('.drag-ghost')) return;
      if (window.Lineage && Lineage.open) Lineage.open(el.id);
    });
    return t;
  }

  global.Sidebar = { init, render };
})(window);
