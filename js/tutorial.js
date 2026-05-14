// Light-touch tutorial system. Two flows:
//   1. First-run: introduces the library → circle → crucible loop.
//   2. Adept-unlock: introduces tap-to-brew for partial combos at 3 slots.
// Each is shown at most once per browser (localStorage flag).
(function (global) {
  'use strict';

  const SEEN_FIRST = 'alchemy_tutorial_first';
  const SEEN_ADEPT = 'alchemy_tutorial_adept';

  let activeOverlay = null;

  function hasSeen(key) {
    try { return localStorage.getItem(key) === '1'; } catch (e) { return false; }
  }
  function markSeen(key) {
    try { localStorage.setItem(key, '1'); } catch (e) { /* ignore */ }
  }

  function maybeStartFirstRun() {
    if (hasSeen(SEEN_FIRST)) return;
    showSteps([
      {
        title: 'Welcome to the Circle',
        body: 'Drag elements from your library on the side — Water, Fire, Earth, Air — and drop each one into an empty slot in the Circle of Binding.',
        target: '#library-list',
        side: 'left',
      },
      {
        title: 'Fill every slot',
        body: 'When all slots in the circle are full, the channels ignite, race around the crucible, and forge a new element. The result\'s name burns across the board.',
        target: '#crucible',
        side: 'bottom',
      },
      {
        title: 'Discover everything',
        body: 'There are 190 elements hidden inside the four bases. Some can only be forged in the larger circles you\'ll unlock as you rise in rank. Start with Water + Water.',
        target: null,
      },
    ], () => markSeen(SEEN_FIRST));
  }

  function onAdeptUnlocked() {
    if (hasSeen(SEEN_ADEPT)) return;
    // Wait for the rank-up cutscene to fully clear before showing.
    setTimeout(() => {
      showSteps([
        {
          title: 'Pairs still work',
          body: 'Your circle holds three slots now — but the smaller brews still matter. Fill any two slots and then tap the glowing crucible at the centre to fire the attempt.',
          target: '#crucible',
          side: 'bottom',
        },
      ], () => markSeen(SEEN_ADEPT));
    }, 500);
  }

  // ---- Step renderer --------------------------------------------------
  function showSteps(steps, onComplete) {
    let i = 0;
    function cleanup() {
      if (activeOverlay) { activeOverlay.remove(); activeOverlay = null; }
      if (onComplete) onComplete();
    }
    function advance() {
      i++;
      if (i >= steps.length) { cleanup(); return; }
      render();
    }
    function render() {
      renderStep(steps[i], i, steps.length, advance, cleanup);
    }
    render();
  }

  function renderStep(step, idx, total, onNext, onSkip) {
    if (activeOverlay) activeOverlay.remove();

    const overlay = document.createElement('div');
    overlay.className = 'tutorial-overlay';
    activeOverlay = overlay;

    // Highlight ring around the target (if any)
    let targetRect = null;
    if (step.target) {
      const t = document.querySelector(step.target);
      if (t) {
        targetRect = t.getBoundingClientRect();
        const ring = document.createElement('div');
        ring.className = 'tutorial-highlight';
        const pad = 12;
        ring.style.left   = (targetRect.left - pad) + 'px';
        ring.style.top    = (targetRect.top  - pad) + 'px';
        ring.style.width  = (targetRect.width  + pad * 2) + 'px';
        ring.style.height = (targetRect.height + pad * 2) + 'px';
        overlay.appendChild(ring);
      }
    }

    // Tooltip card
    const card = document.createElement('div');
    card.className = 'tutorial-card';
    const isLast = idx === total - 1;
    card.innerHTML =
      '<div class="tutorial-step-counter">Step ' + (idx + 1) + ' of ' + total + '</div>' +
      '<h3 class="tutorial-title">' + step.title + '</h3>' +
      '<p class="tutorial-body">' + step.body + '</p>' +
      '<div class="tutorial-actions">' +
        '<button type="button" class="tutorial-skip">' + (isLast ? 'Close' : 'Skip') + '</button>' +
        '<button type="button" class="tutorial-next">' + (isLast ? 'Begin' : 'Next') + '</button>' +
      '</div>';
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Position the card relative to the target (or centred).
    const cardRect = card.getBoundingClientRect();
    if (targetRect) {
      let cx, cy;
      const side = step.side || 'bottom';
      if (side === 'left') {
        cx = targetRect.left - cardRect.width - 24;
        cy = targetRect.top + targetRect.height / 2 - cardRect.height / 2;
        if (cx < 20) { cx = targetRect.right + 24; }
      } else if (side === 'right') {
        cx = targetRect.right + 24;
        cy = targetRect.top + targetRect.height / 2 - cardRect.height / 2;
      } else if (side === 'top') {
        cx = targetRect.left + targetRect.width / 2 - cardRect.width / 2;
        cy = targetRect.top - cardRect.height - 24;
      } else {  // bottom
        cx = targetRect.left + targetRect.width / 2 - cardRect.width / 2;
        cy = targetRect.bottom + 24;
      }
      // Clamp into viewport.
      cx = Math.max(16, Math.min(window.innerWidth  - cardRect.width  - 16, cx));
      cy = Math.max(16, Math.min(window.innerHeight - cardRect.height - 16, cy));
      card.style.left = cx + 'px';
      card.style.top  = cy + 'px';
    } else {
      // No target → centre on the board (not the whole viewport, which
      // would skew toward the library on the side).
      card.style.left = 'calc(50% + var(--board-offset-x, 0px))';
      card.style.top  = 'calc(50% + var(--board-offset-y, 0px))';
      card.style.transform = 'translate(-50%, -50%)';
    }

    card.querySelector('.tutorial-next').addEventListener('click', onNext);
    card.querySelector('.tutorial-skip').addEventListener('click', onSkip);
  }

  global.Tutorial = { maybeStartFirstRun, onAdeptUnlocked };
})(window);
