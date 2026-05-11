// Library sidebar: filterable, searchable list of discovered elements.
(function (global) {
  'use strict';

  let listEl, searchEl, tabsEl, toggleBtn, libraryEl;
  let activeCategory = 'all';
  let searchQuery = '';

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

    renderTabs();

    searchEl.addEventListener('input', () => {
      searchQuery = searchEl.value.trim().toLowerCase();
      render();
    });

    toggleBtn.addEventListener('click', () => {
      libraryEl.classList.toggle('collapsed');
    });

    State.onChange(render);
    render();
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    for (const cat of CATEGORIES) {
      const b = document.createElement('button');
      b.className = 'cat-tab' + (cat.id === activeCategory ? ' active' : '');
      b.textContent = cat.label;
      b.dataset.cat = cat.id;
      b.addEventListener('click', () => {
        activeCategory = cat.id;
        for (const t of tabsEl.querySelectorAll('.cat-tab')) t.classList.toggle('active', t.dataset.cat === cat.id);
        render();
      });
      tabsEl.appendChild(b);
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

    document.getElementById('discovery-count').textContent =
      State.state.discovered.size + ' / ' + State.state.totalElements + ' discovered';
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
    return t;
  }

  global.Sidebar = { init, render };
})(window);
