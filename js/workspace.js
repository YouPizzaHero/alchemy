// Workspace: drag tiles around, combine on overlap.
// Uses Pointer Events for unified mouse/touch handling.
(function (global) {
  'use strict';

  const TILE_W = 78;
  const TILE_H = 78;

  let surfaceEl, workspaceEl, bannerEl;
  let tiles = [];          // [{id, x, y, el, node}]
  let nextTileNum = 0;
  let banneTimer = null;

  const activePointers = new Map();  // pointerId -> { tile, dx, dy }

  function init() {
    workspaceEl = document.getElementById('workspace');
    surfaceEl   = document.getElementById('workspace-surface');
    bannerEl    = document.getElementById('discovery-banner');

    document.getElementById('btn-clear').addEventListener('click', clear);
    document.getElementById('btn-reset').addEventListener('click', () => {
      if (!confirm('Reset all discovered elements? You will start over with the four base elements.')) return;
      clear();
      State.resetProgress();
    });

    // Catch pointermove/up globally so dragging works even if pointer leaves a tile.
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);

    // Prevent default touch behaviors that would scroll/select.
    workspaceEl.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  }

  function clear() {
    for (const t of tiles) t.node.remove();
    tiles = [];
  }

  // --- Spawning tiles from the library --------------------------------------
  function attachLibraryDragSource(node, elementId) {
    node.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      // Spawn a new tile at the pointer's current position on the workspace.
      const rect = workspaceEl.getBoundingClientRect();
      const x = e.clientX - rect.left - TILE_W / 2;
      const y = e.clientY - rect.top - TILE_H / 2;
      const tile = spawnTile(elementId, x, y);
      if (!tile) return;
      // Begin drag immediately.
      beginDrag(tile, e, TILE_W / 2, TILE_H / 2);
    });
  }

  function spawnTile(elementId, x, y) {
    const el = State.state.byId.get(elementId);
    if (!el) return null;
    const node = document.createElement('div');
    node.className = 'tile';
    node.dataset.tileNum = ++nextTileNum;
    node.appendChild(Icons.buildIcon(el));
    const nm = document.createElement('div');
    nm.className = 'name';
    nm.textContent = el.name;
    node.appendChild(nm);
    node.style.left = clampX(x) + 'px';
    node.style.top  = clampY(y) + 'px';

    const tile = { id: elementId, el, node, x: clampX(x), y: clampY(y) };
    tiles.push(tile);
    surfaceEl.appendChild(node);

    node.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.stopPropagation();
      const rect = node.getBoundingClientRect();
      beginDrag(tile, e, e.clientX - rect.left, e.clientY - rect.top);
    });

    // Double-click / double-tap removes tile.
    let lastTap = 0;
    node.addEventListener('pointerup', (e) => {
      const now = Date.now();
      if (now - lastTap < 350) removeTile(tile);
      lastTap = now;
    });

    return tile;
  }

  function removeTile(tile) {
    tile.node.classList.add('poof');
    setTimeout(() => {
      tile.node.remove();
      tiles = tiles.filter(t => t !== tile);
    }, 320);
  }

  function clampX(x) {
    const w = workspaceEl.clientWidth;
    return Math.max(0, Math.min(w - TILE_W, x));
  }
  function clampY(y) {
    const h = workspaceEl.clientHeight;
    return Math.max(0, Math.min(h - TILE_H, y));
  }

  // --- Drag handling --------------------------------------------------------
  function beginDrag(tile, e, offX, offY) {
    activePointers.set(e.pointerId, { tile, offX, offY });
    tile.node.classList.add('dragging');
    try { tile.node.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }

  function onPointerMove(e) {
    const drag = activePointers.get(e.pointerId);
    if (!drag) return;
    const rect = workspaceEl.getBoundingClientRect();
    const x = clampX(e.clientX - rect.left - drag.offX);
    const y = clampY(e.clientY - rect.top - drag.offY);
    drag.tile.x = x;
    drag.tile.y = y;
    drag.tile.node.style.left = x + 'px';
    drag.tile.node.style.top  = y + 'px';

    // Highlight overlapping target.
    const target = findOverlap(drag.tile);
    for (const t of tiles) if (t !== drag.tile) t.node.classList.toggle('overlapping', t === target);
  }

  function onPointerUp(e) {
    const drag = activePointers.get(e.pointerId);
    if (!drag) return;
    activePointers.delete(e.pointerId);
    drag.tile.node.classList.remove('dragging');
    for (const t of tiles) t.node.classList.remove('overlapping');

    const target = findOverlap(drag.tile);
    if (target) tryCombine(drag.tile, target);
  }

  function findOverlap(tile) {
    let best = null;
    let bestDist = Infinity;
    for (const t of tiles) {
      if (t === tile) continue;
      const dx = (t.x + TILE_W/2) - (tile.x + TILE_W/2);
      const dy = (t.y + TILE_H/2) - (tile.y + TILE_H/2);
      const d = Math.hypot(dx, dy);
      if (d < TILE_W * 0.75 && d < bestDist) { best = t; bestDist = d; }
    }
    return best;
  }

  // --- Combination ----------------------------------------------------------
  function tryCombine(a, b) {
    const resultId = Recipes.combine(a.id, b.id, State.state.recipes);
    if (!resultId) {
      // Miss — shake them apart.
      a.node.classList.add('miss');
      b.node.classList.add('miss');
      setTimeout(() => { a.node.classList.remove('miss'); b.node.classList.remove('miss'); }, 400);
      return;
    }

    // Center where they meet — for the result tile.
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;

    // Sparks at meeting point.
    spawnSparks(cx + TILE_W/2, cy + TILE_H/2);

    // Remove both originals.
    a.node.classList.add('poof');
    b.node.classList.add('poof');
    setTimeout(() => {
      a.node.remove();
      b.node.remove();
      tiles = tiles.filter(t => t !== a && t !== b);

      // Spawn the result, then mark discovered (fires sidebar listeners).
      const wasNew = !State.isDiscovered(resultId);
      spawnTile(resultId, cx, cy);
      State.discover(resultId);
      if (wasNew) showDiscoveryBanner(resultId);
    }, 280);
  }

  function spawnSparks(cx, cy) {
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('div');
      s.className = 'spark';
      const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.3;
      const dist = 30 + Math.random() * 30;
      s.style.left = (cx - 3) + 'px';
      s.style.top  = (cy - 3) + 'px';
      s.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
      surfaceEl.appendChild(s);
      setTimeout(() => s.remove(), 700);
    }
  }

  function showDiscoveryBanner(id) {
    const el = State.state.byId.get(id);
    if (!el) return;
    bannerEl.innerHTML = '<span class="label">Discovered</span><span class="name">' + escapeHtml(el.name) + '</span>';
    bannerEl.classList.remove('hidden');
    // Restart animation by toggling display.
    bannerEl.style.animation = 'none';
    bannerEl.offsetHeight; // reflow
    bannerEl.style.animation = '';
    clearTimeout(banneTimer);
    banneTimer = setTimeout(() => bannerEl.classList.add('hidden'), 2500);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  global.Workspace = { init, clear, attachLibraryDragSource };
})(window);
