// The Tree of Forging — visualise every discovered element as a node,
// organised by tier (minimum BFS depth from the base elements), with lines
// from each node back to its inputs.
(function (global) {
  'use strict';

  let modalEl, canvasEl;

  function init() {
    modalEl  = document.getElementById('graph-modal');
    canvasEl = document.getElementById('graph-canvas');
    const openBtn = document.getElementById('btn-graph');
    if (!modalEl || !canvasEl || !openBtn) return;

    openBtn.addEventListener('click', () => {
      modalEl.classList.remove('hidden');
      requestAnimationFrame(render);
    });
    modalEl.addEventListener('click', (e) => {
      if (e.target.dataset.close !== undefined) modalEl.classList.add('hidden');
      const node = e.target.closest('[data-graph-id]');
      if (node && window.Lineage) Lineage.open(node.dataset.graphId);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modalEl.classList.contains('hidden')) modalEl.classList.add('hidden');
    });
  }

  // Compute tier (BFS depth from base elements) for each discovered element.
  function computeTiers() {
    const tier = new Map();
    const queue = [];
    for (const el of State.state.elements) {
      if (el.base) { tier.set(el.id, 0); queue.push(el.id); }
    }

    // Build a producer index from the live recipe map + multi-recipes.
    const producerOf = new Map();
    for (const [key, result] of State.state.recipes.entries()) {
      if (!producerOf.has(result)) producerOf.set(result, { inputs: key.split('+') });
    }
    for (const r of window.MULTI_RECIPES_DATA || []) {
      if (!producerOf.has(r.result)) producerOf.set(r.result, { inputs: r.inputs.slice() });
    }

    // BFS-ish: keep relaxing tiers until no element's tier decreases.
    let changed = true;
    let safety = 0;
    while (changed && safety++ < 60) {
      changed = false;
      for (const el of State.state.elements) {
        if (el.base) continue;
        const p = producerOf.get(el.id);
        if (!p) continue;
        let maxIn = -1;
        let allKnown = true;
        for (const inp of p.inputs) {
          if (!tier.has(inp)) { allKnown = false; break; }
          maxIn = Math.max(maxIn, tier.get(inp));
        }
        if (!allKnown) continue;
        const candidate = maxIn + 1;
        if (!tier.has(el.id) || candidate < tier.get(el.id)) {
          tier.set(el.id, candidate);
          changed = true;
        }
      }
    }
    return tier;
  }

  function render() {
    const tiers = computeTiers();
    canvasEl.innerHTML = '';

    // Group discovered elements by tier.
    const byTier = new Map();
    for (const el of State.state.elements) {
      if (!State.isDiscovered(el.id)) continue;
      const t = tiers.has(el.id) ? tiers.get(el.id) : 0;
      if (!byTier.has(t)) byTier.set(t, []);
      byTier.get(t).push(el);
    }
    if (byTier.size === 0) {
      canvasEl.innerHTML = '<div class="graph-empty">Nothing discovered yet.</div>';
      return;
    }

    // Sort each tier's elements by category then name for stable layout.
    for (const [, arr] of byTier) {
      arr.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.name.localeCompare(b.name);
      });
    }

    const tierKeys = [...byTier.keys()].sort((a, b) => a - b);

    // Layout: each tier is a row. Inside the row, nodes are spaced evenly.
    const rowsEl = document.createElement('div');
    rowsEl.className = 'graph-rows';
    for (const t of tierKeys) {
      const row = document.createElement('div');
      row.className = 'graph-row';
      const label = document.createElement('div');
      label.className = 'graph-tier-label';
      label.textContent = 'TIER ' + t;
      row.appendChild(label);
      const items = document.createElement('div');
      items.className = 'graph-items';
      for (const el of byTier.get(t)) {
        const node = document.createElement('button');
        node.className = 'graph-node icon-' + el.category;
        node.dataset.graphId = el.id;
        node.style.setProperty('--tint', el.tint);
        node.title = el.name;
        node.innerHTML = '<span class="graph-node-dot" style="background:' + el.tint + '"></span>' +
                         '<span class="graph-node-name">' + escapeHtml(el.name) + '</span>';
        items.appendChild(node);
      }
      row.appendChild(items);
      rowsEl.appendChild(row);
    }
    canvasEl.appendChild(rowsEl);

    // Stats footer.
    const stats = document.createElement('div');
    stats.className = 'graph-stats';
    stats.textContent = State.state.discovered.size + ' / ' + State.state.totalElements +
      ' discovered · ' + tierKeys.length + ' tiers deep';
    canvasEl.appendChild(stats);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  global.Graph = { init };
})(window);
