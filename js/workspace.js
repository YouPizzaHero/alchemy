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
    document.getElementById('btn-reset').addEventListener('click', openResetModal);
    initResetModal();

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

  // Serialize the current workspace arrangement so it can be saved.
  function serialize() {
    return tiles.map(t => ({ id: t.id, x: t.x, y: t.y }));
  }

  // Rebuild the workspace from a serialized array. Replaces any current tiles.
  function deserialize(arr) {
    clear();
    if (!Array.isArray(arr)) return;
    for (const t of arr) {
      if (!t || !State.state.byId.has(t.id)) continue;
      spawnTile(t.id, Number(t.x) || 0, Number(t.y) || 0);
    }
  }

  // --- Reset confirmation modal ---------------------------------------------
  function openResetModal() {
    const modal = document.getElementById('reset-modal');
    if (!modal) return;
    showResetStage(1);
    document.getElementById('reset-count').textContent = State.state.discovered.size;
    modal.classList.remove('hidden');
  }

  function showResetStage(n) {
    const modal = document.getElementById('reset-modal');
    if (!modal) return;
    for (const s of modal.querySelectorAll('.reset-stage')) {
      s.classList.toggle('hidden', s.dataset.stage !== String(n));
    }
    if (n === 2) armFinalConfirm();
  }

  function armFinalConfirm() {
    const modal = document.getElementById('reset-modal');
    const btn = modal.querySelector('.reset-confirm');
    btn.disabled = true;
    let secondsLeft = 2;
    const baseLabel = 'Yes, reset everything';
    btn.textContent = baseLabel + ' (' + secondsLeft + ')';
    const interval = setInterval(() => {
      secondsLeft--;
      if (secondsLeft > 0) {
        btn.textContent = baseLabel + ' (' + secondsLeft + ')';
      } else {
        clearInterval(interval);
        btn.disabled = false;
        btn.textContent = baseLabel;
      }
    }, 1000);
    // Store interval so re-arming clears it
    btn._countdown = interval;
  }

  function initResetModal() {
    const modal = document.getElementById('reset-modal');
    if (!modal) return;

    modal.addEventListener('click', (e) => {
      if (e.target.dataset.close !== undefined) closeResetModal();
    });

    modal.querySelector('.reset-next').addEventListener('click', () => showResetStage(2));

    modal.querySelector('.reset-confirm').addEventListener('click', (e) => {
      if (e.currentTarget.disabled) return;
      closeResetModal();
      clear();
      State.resetProgress();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeResetModal();
    });
  }

  function closeResetModal() {
    const modal = document.getElementById('reset-modal');
    if (!modal) return;
    const btn = modal.querySelector('.reset-confirm');
    if (btn && btn._countdown) { clearInterval(btn._countdown); btn._countdown = null; }
    modal.classList.add('hidden');
    showResetStage(1);
  }

  // --- Spawning tiles from the library --------------------------------------
  // On pointerdown, a 'ghost' tile is spawned in a fixed-position layer
  // and follows the pointer smoothly anywhere on screen. On release:
  //   - over the workspace → ghost is committed as a real tile and
  //     immediately checked for a combination target.
  //   - elsewhere (still in library, off-screen, etc.) → ghost is removed
  //     with a quick fade, no tile placed.
  // A tap with no movement is treated as "release in library" → no commit.

  function attachLibraryDragSource(node, elementId) {
    node.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      const pointerId = e.pointerId;
      const el = State.state.byId.get(elementId);
      if (!el) return;

      // Build a ghost tile in document.body (position:fixed) so it can
      // follow the pointer anywhere, including over the library.
      const ghost = document.createElement('div');
      ghost.className = 'tile drag-ghost';
      ghost.appendChild(Icons.buildIcon(el));
      const nm = document.createElement('div');
      nm.className = 'name';
      nm.textContent = el.name;
      ghost.appendChild(nm);
      document.body.appendChild(ghost);
      positionGhost(e.clientX, e.clientY);
      let moved = false;

      function positionGhost(clientX, clientY) {
        ghost.style.left = (clientX - TILE_W / 2) + 'px';
        ghost.style.top  = (clientY - TILE_H / 2) + 'px';
      }

      function onMove(ev) {
        if (ev.pointerId !== pointerId) return;
        moved = true;
        positionGhost(ev.clientX, ev.clientY);
        // Highlight any workspace tile we're hovering, for combine feedback.
        const wsRect = workspaceEl.getBoundingClientRect();
        const localX = ev.clientX - wsRect.left - TILE_W / 2;
        const localY = ev.clientY - wsRect.top  - TILE_H / 2;
        const overWorkspace = ev.clientX >= wsRect.left && ev.clientX <= wsRect.right
                           && ev.clientY >= wsRect.top  && ev.clientY <= wsRect.bottom;
        ghost.classList.toggle('over-workspace', overWorkspace);
        const phantom = { x: localX, y: localY };
        const target = overWorkspace ? findOverlap(phantom) : null;
        for (const t of tiles) t.node.classList.toggle('overlapping', t === target);
      }

      function onEnd(ev) {
        if (ev.pointerId !== pointerId) return;
        cleanup();
        const wsRect = workspaceEl.getBoundingClientRect();
        const overWorkspace = ev.clientX >= wsRect.left && ev.clientX <= wsRect.right
                           && ev.clientY >= wsRect.top  && ev.clientY <= wsRect.bottom;
        for (const t of tiles) t.node.classList.remove('overlapping');

        if (!moved || !overWorkspace) {
          // Cancel: gentle fade-out of the ghost.
          ghost.classList.add('drag-ghost-cancel');
          setTimeout(() => ghost.remove(), 200);
          return;
        }

        // Commit: replace the ghost with a real workspace tile at the
        // workspace-local coordinates.
        const x = ev.clientX - wsRect.left - TILE_W / 2;
        const y = ev.clientY - wsRect.top  - TILE_H / 2;
        const tile = spawnTile(elementId, x, y);
        ghost.remove();
        if (!tile) return;

        // Check for immediate combination if released onto another tile.
        const target = findOverlap(tile);
        if (target) tryCombine(tile, target);
      }

      function cleanup() {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onEnd);
        document.removeEventListener('pointercancel', onEnd);
      }

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onEnd);
      document.addEventListener('pointercancel', onEnd);
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

    const close = document.createElement('button');
    close.className = 'tile-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Remove element');
    close.textContent = '✕';
    node.appendChild(close);

    const tile = { id: elementId, el, node, x: clampX(x), y: clampY(y) };
    tiles.push(tile);
    surfaceEl.appendChild(node);

    node.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target === close) return;  // let the close button handle its own events
      e.stopPropagation();
      const rect = node.getBoundingClientRect();
      beginDrag(tile, e, e.clientX - rect.left, e.clientY - rect.top);
    });

    close.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      removeTile(tile);
    });

    // Double-click / double-tap removes tile. Click events don't fire after
    // a drag, and fire for both mouse and touch on a quick press-release
    // without movement — perfect for our needs.
    const DOUBLE_TAP_MS = 350;
    let lastClickTime = 0;
    node.addEventListener('click', (e) => {
      if (e.target === close) return;
      const now = Date.now();
      if (now - lastClickTime < DOUBLE_TAP_MS) {
        lastClickTime = 0;
        removeTile(tile);
      } else {
        lastClickTime = now;
      }
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

  global.Workspace = { init, clear, attachLibraryDragSource, serialize, deserialize };
})(window);
