// Workspace: library drag-to-slot + reset modal.
// Free-form tile placement and on-board combine were removed when the
// gameplay shifted to the Circle of Binding — the player now drags
// elements from the library into the circle slots instead.
(function (global) {
  'use strict';

  const TILE_W = 78;
  const TILE_H = 78;

  let workspaceEl;

  function init() {
    workspaceEl = document.getElementById('workspace');

    document.getElementById('btn-reset').addEventListener('click', openResetModal);
    initResetModal();

    // 'Clear' wipes the current arrangement of slot contents.
    const clearBtn = document.getElementById('btn-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      if (window.Circle && Circle.rebuildSlots) {
        const count = parseInt(document.getElementById('circle-board').dataset.slotCount || '2', 10);
        Circle.rebuildSlots(count);
      }
    });
  }

  // --- Save/load surface (kept stable for the saves system) -----------------
  function serialize() { return []; }   // slot state isn't persisted yet
  function deserialize() { /* no-op for circle-mode */ }

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
      // Rebuild slots fresh.
      if (window.Circle && Circle.rebuildSlots) {
        Circle.rebuildSlots(2);
      }
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

  // --- Library drag → slot --------------------------------------------------
  // Two interaction models depending on input device. Same intent classifier
  // as before for touch (long-press OR sideways drag = drag, vertical = scroll).
  const LONG_PRESS_MS  = 350;
  const HORIZ_DRAG_PX  = 12;
  const VERT_SCROLL_PX = 6;

  function attachLibraryDragSource(node, elementId) {
    node.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      const isTouch = e.pointerType !== 'mouse';

      if (!isTouch) {
        e.preventDefault();
        beginLibraryDrag(elementId, e.pointerId, e.clientX, e.clientY);
        return;
      }

      const pointerId = e.pointerId;
      const startX = e.clientX, startY = e.clientY;
      const scrollContainer = node.closest('#library-list');
      const initialScroll = scrollContainer ? scrollContainer.scrollTop : 0;
      let mode = null;  // null | 'drag' | 'scroll'

      const longPressTimer = setTimeout(() => {
        if (mode !== null) return;
        mode = 'drag';
        node.classList.add('lib-pressed');
        beginLibraryDrag(elementId, pointerId, startX, startY);
      }, LONG_PRESS_MS);

      function onMove(ev) {
        if (ev.pointerId !== pointerId) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (mode === null) {
          if (Math.abs(dx) > HORIZ_DRAG_PX && Math.abs(dx) > Math.abs(dy) * 1.2) {
            clearTimeout(longPressTimer);
            mode = 'drag';
            node.classList.add('lib-pressed');
            beginLibraryDrag(elementId, pointerId, ev.clientX, ev.clientY);
            return;
          }
          if (Math.abs(dy) > VERT_SCROLL_PX) {
            clearTimeout(longPressTimer);
            mode = 'scroll';
          }
        }
        if (mode === 'scroll' && scrollContainer) {
          scrollContainer.scrollTop = initialScroll - dy;
        }
      }
      function onEnd(ev) {
        if (ev.pointerId !== pointerId) return;
        clearTimeout(longPressTimer);
        node.classList.remove('lib-pressed');
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onEnd);
        document.removeEventListener('pointercancel', onEnd);
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onEnd);
      document.addEventListener('pointercancel', onEnd);
    });
  }

  // Begin the drag-with-ghost flow. On release, try to fill a circle slot;
  // otherwise, just fade the ghost out.
  function beginLibraryDrag(elementId, pointerId, startX, startY) {
    if (window.Circle && Circle.isCombining && Circle.isCombining()) return;
    const el = State.state.byId.get(elementId);
    if (!el) return;

    const ghost = document.createElement('div');
    ghost.className = 'tile drag-ghost';
    ghost.appendChild(Icons.buildIcon(el));
    const nm = document.createElement('div');
    nm.className = 'name';
    nm.textContent = el.name;
    ghost.appendChild(nm);
    document.body.appendChild(ghost);
    positionGhost(startX, startY);

    function positionGhost(cx, cy) {
      ghost.style.left = (cx - TILE_W / 2) + 'px';
      ghost.style.top  = (cy - TILE_H / 2) + 'px';
    }

    function onMove(ev) {
      if (ev.pointerId !== pointerId) return;
      positionGhost(ev.clientX, ev.clientY);
      const idx = window.Circle ? Circle.previewSlotAt(ev.clientX, ev.clientY) : -1;
      ghost.classList.toggle('over-workspace', idx >= 0);
    }

    function onEnd(ev) {
      if (ev.pointerId !== pointerId) return;
      cleanup();
      if (window.Circle) Circle.clearSlotHovers();
      const filled = window.Circle && Circle.tryFillFromDrop(ev.clientX, ev.clientY, elementId);
      if (filled) {
        ghost.remove();
      } else {
        ghost.classList.add('drag-ghost-cancel');
        setTimeout(() => ghost.remove(), 200);
      }
    }

    function cleanup() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onEnd);
      document.removeEventListener('pointercancel', onEnd);
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onEnd);
    document.addEventListener('pointercancel', onEnd);
  }

  global.Workspace = { init, serialize, deserialize, attachLibraryDragSource };
})(window);
