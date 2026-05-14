// Library sidebar: filterable, searchable list of discovered elements.
(function (global) {
  'use strict';

  let listEl, searchEl, tabsEl, toggleBtn, libraryEl, filterToggleBtn, ftActiveEl;
  let activeCategory = 'all';
  let searchQuery = '';
  let filtersCollapsed = false;

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

    renderTabs();

    searchEl.addEventListener('input', () => {
      searchQuery = searchEl.value.trim().toLowerCase();
      render();
    });

    toggleBtn.addEventListener('click', () => {
      libraryEl.classList.toggle('collapsed');
    });

    // Restore filter collapse preference.
    try { filtersCollapsed = localStorage.getItem('alchemy_filters_collapsed') === '1'; } catch (e) {}
    applyFilterCollapse();

    filterToggleBtn.addEventListener('click', () => {
      filtersCollapsed = !filtersCollapsed;
      try { localStorage.setItem('alchemy_filters_collapsed', filtersCollapsed ? '1' : '0'); } catch (e) {}
      applyFilterCollapse();
    });

    State.onChange(render);
    render();
  }

  function applyFilterCollapse() {
    libraryEl.classList.toggle('filters-collapsed', filtersCollapsed);
    filterToggleBtn.setAttribute('aria-expanded', filtersCollapsed ? 'false' : 'true');
    updateFilterToggleLabel();
  }

  function updateFilterToggleLabel() {
    if (!ftActiveEl) return;
    if (filtersCollapsed && activeCategory !== 'all') {
      const cat = CATEGORIES.find(c => c.id === activeCategory);
      ftActiveEl.textContent = cat ? cat.label : '';
    } else {
      ftActiveEl.textContent = '';
    }
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    for (const cat of CATEGORIES) {
      const b = document.createElement('button');
      b.className = 'cat-tab' + (cat.id === activeCategory ? ' active' : '');
      b.dataset.cat = cat.id;
      const label = document.createElement('span');
      label.className = 'cat-label';
      label.textContent = cat.label;
      const count = document.createElement('span');
      count.className = 'cat-count';
      count.dataset.cat = cat.id;
      b.appendChild(label);
      b.appendChild(count);
      b.addEventListener('click', () => {
        activeCategory = cat.id;
        for (const t of tabsEl.querySelectorAll('.cat-tab')) t.classList.toggle('active', t.dataset.cat === cat.id);
        updateFilterToggleLabel();
        render();
      });
      tabsEl.appendChild(b);
    }
  }

  function updateTabCounts() {
    const totals = new Map();    // category -> total
    const founds = new Map();    // category -> found
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

  function render() {
    listEl.innerHTML = '';
    const els = State.state.elements.filter(el => {
      if (!State.isDiscovered(el.id)) return false;
      if (activeCategory !== 'all' && el.category !== activeCategory) return false;
      if (searchQuery && !el.name.toLowerCase().includes(searchQuery)) return false;
      return true;
    });

    if (els.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = searchQuery
        ? 'No matches in your grimoire.'
        : 'Nothing here yet. Drag the basic elements out and combine them.';
      listEl.appendChild(empty);
    } else {
      els.sort((a, b) => a.name.localeCompare(b.name));
      for (const el of els) listEl.appendChild(buildLibTile(el));
    }

    updateTabCounts();
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
    // Click (no significant drag) opens the lineage panel. The browser only
    // fires click after a press-release without enough movement to count as
    // a drag, so this naturally cohabits with the drag-source above.
    t.addEventListener('click', (e) => {
      // If a drag-ghost is still around, the player just finished a drag —
      // don't open lineage in that case.
      if (document.querySelector('.drag-ghost')) return;
      if (window.Lineage && Lineage.open) Lineage.open(el.id);
    });
    return t;
  }

  global.Sidebar = { init, render };
})(window);
