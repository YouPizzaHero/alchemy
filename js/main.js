// Bootstrap: load embedded data, hydrate state, mount UI.
(function () {
  'use strict';

  // ---------- Migration: legacy (pre-Circle) saves ----------
  // The gameplay shifted to the Circle of Binding in v2 of the save schema.
  // Any save from the old free-form workspace era is no longer compatible.
  // Detect, wipe, and show an apology modal.
  const legacyKeys = detectLegacySaves();
  if (legacyKeys.length > 0) {
    for (const k of legacyKeys) {
      try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
    }
    // The modal is shown after the rest of the UI mounts so it sits over
    // a freshly-reset game state.
    setTimeout(showLegacySavesModal, 200);
  }

  function detectLegacySaves() {
    const found = [];
    function isOld(rawJson) {
      try {
        const parsed = JSON.parse(rawJson);
        if (!parsed) return false;
        // Auto-save format: { version, data }
        if (typeof parsed.version === 'number' && parsed.version < 2) return true;
        // Slot save format: { version, name, savedAt, ... }
        if (parsed.version != null && parsed.version < 2) return true;
        return false;
      } catch (e) { return false; }
    }
    try {
      const autoRaw = localStorage.getItem('alchemy_save_v1');
      if (autoRaw && isOld(autoRaw)) found.push('alchemy_save_v1');
      for (let i = 1; i <= 5; i++) {
        const key = 'alchemy_slot_' + i;
        const raw = localStorage.getItem(key);
        if (raw && isOld(raw)) found.push(key);
      }
    } catch (e) { /* ignore — localStorage may be blocked */ }
    return found;
  }

  function showLegacySavesModal() {
    const modal = document.getElementById('legacy-saves-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    // Both dismiss paths (click + key) must remove BOTH listeners; previously
    // the key handler self-removed independently, which let one listener
    // outlive its modal forever when the player used the other path first.
    function dismiss() {
      modal.classList.add('hidden');
      modal.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    }
    function onClick(e) {
      if (e.target.dataset.close !== undefined || e.target.classList.contains('legacy-ok')) dismiss();
    }
    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Enter') dismiss();
    }
    modal.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
  }

  try {
    const elements = window.ELEMENTS_DATA;
    const recipes  = window.RECIPES_DATA;
    if (!Array.isArray(elements) || !Array.isArray(recipes)) {
      throw new Error('Data scripts did not load (ELEMENTS_DATA / RECIPES_DATA missing).');
    }

    State.ingestElements(elements);
    State.state.recipes = Recipes.ingest(recipes, State.state.byId);
    if (typeof MultiRecipes !== 'undefined') {
      MultiRecipes.init(window.MULTI_RECIPES_DATA, State.state.byId);
    }
    State.hydrate();

    Settings.init();
    // Circle MUST initialise before Progress: Progress.render runs once
    // during init and calls Circle.setSlotCountForRank, which may need
    // to rebuild the slots immediately when the saved rank already
    // granted a wider circle. If Circle isn't ready yet, boardEl is
    // undefined and rebuildSlots crashes on setAttribute.
    Circle.init();
    Progress.init();
    Workspace.init();
    Sidebar.init();
    Saves.init();
    if (typeof Lineage !== 'undefined')     Lineage.init();
    if (typeof Graph   !== 'undefined')     Graph.init();
    if (typeof Hints   !== 'undefined')     Hints.init();
    if (typeof Seasons !== 'undefined')     Seasons.init();
    if (typeof Sound   !== 'undefined')     Sound.init();
    if (typeof TitleScreen !== 'undefined') TitleScreen.init();
    initAboutModal();
    initBoardOffset();
    initRotatePrompt();

    document.getElementById('loading').classList.add('hidden');

    // Stage transitions on first load:
    //   1. Pizza Hero Gaming splash plays on top (highest z-index),
    //      with the title screen already mounted behind it (opaque
    //      backdrop, but its foreground content held at opacity:0).
    //   2. When the player dismisses the PHG splash, the splash begins
    //      its 560ms fade-out AND we trigger the title's content
    //      fade-in via `revealContent()` — they cross-fade.
    //   3. Tapping "Enter the Circle" fades the title screen out and
    //      triggers the first-run tutorial (if not seen) once any
    //      legacy-saves modal is closed.
    if (typeof TitleScreen !== 'undefined') {
      TitleScreen.show(onTitleEntered);
    } else {
      // Defensive: if the title screen isn't available, fall through
      // to the old behavior so the player isn't stranded.
      onTitleEntered();
    }

    if (typeof PizzaHeroSplash !== 'undefined') {
      PizzaHeroSplash.show({
        tagline: 'GAMING',
        // onComplete fires AFTER the PHG splash has fully faded out
        // (vs. onDismiss which fires when the fade-out begins). Using
        // onComplete gives a deliberate "fade to black, then fade in
        // the title" sequence instead of a cross-fade.
        onComplete: () => {
          if (typeof TitleScreen === 'undefined') return;
          // Short breath in the dark before the title blooms in. Adds
          // a beat that feels cinematic; tune this between 300-800ms.
          setTimeout(() => TitleScreen.revealContent(), 450);
        },
      });
    } else if (typeof TitleScreen !== 'undefined') {
      // No splash module — just reveal the title content immediately.
      TitleScreen.revealContent();
    }

    function onTitleEntered() {
      const legacyModal = document.getElementById('legacy-saves-modal');
      const legacyOpen = legacyModal && !legacyModal.classList.contains('hidden');
      if (legacyOpen) {
        const once = (e) => {
          if (e.target.dataset.close === undefined && !e.target.classList.contains('legacy-ok')) return;
          legacyModal.removeEventListener('click', once);
          setTimeout(() => Tutorial.maybeStartFirstRun && Tutorial.maybeStartFirstRun(), 400);
        };
        legacyModal.addEventListener('click', once);
      } else {
        // Small delay so the title-screen exit animation finishes before
        // the tutorial's first highlight ring tries to find its target.
        setTimeout(() => Tutorial.maybeStartFirstRun && Tutorial.maybeStartFirstRun(), 300);
      }
    }
  } catch (err) {
    console.error('Failed to boot alchemy:', err);
    const loading = document.getElementById('loading');
    loading.textContent = 'Something went wrong: ' + (err && err.message ? err.message : err);
  }

  // Computes the offset from viewport-centre to workspace-centre and exposes
  // it as CSS variables --board-offset-x / --board-offset-y. Modals, the
  // rank-up banner, and tutorial centred cards use these to land in the
  // middle of the board rather than the middle of the full window
  // (which would otherwise be skewed toward the library).
  function initBoardOffset() {
    function update() {
      const ws = document.getElementById('workspace');
      if (!ws) return;
      const r = ws.getBoundingClientRect();
      const ox = (r.left + r.width  / 2) - window.innerWidth  / 2;
      const oy = (r.top  + r.height / 2) - window.innerHeight / 2;
      document.documentElement.style.setProperty('--board-offset-x', ox + 'px');
      document.documentElement.style.setProperty('--board-offset-y', oy + 'px');
    }
    update();
    window.addEventListener('resize', update);
    // Library width can change via Settings — recompute after a beat.
    document.getElementById('btn-settings')?.addEventListener('click', () => {
      setTimeout(update, 400);
    });
  }

  // JS-driven rotate-prompt detection. iOS Safari sometimes doesn't
  // re-evaluate CSS orientation media queries after a real rotation,
  // so we check actual viewport dimensions on every event that might
  // signal a layout change. matchMedia('(orientation: portrait)')
  // covers what the OS-level rotation event misses.
  function initRotatePrompt() {
    function update() {
      // Treat 'phone-sized + portrait' as 'show the prompt'. The width
      // ceiling keeps tablets and desktops from ever seeing it.
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isPortraitPhone = w <= 900 && h > w;
      document.body.classList.toggle('show-rotate-prompt', isPortraitPhone);
    }
    update();
    window.addEventListener('resize',            update);
    window.addEventListener('orientationchange', update);
    window.addEventListener('focus',             update);
    document.addEventListener('visibilitychange', update);
    // matchMedia fires on the OS-level orientation change even when iOS
    // Safari delays its resize/orientationchange events.
    try {
      const mq = window.matchMedia('(orientation: portrait)');
      if (mq && mq.addEventListener) mq.addEventListener('change', update);
      else if (mq && mq.addListener) mq.addListener(update);  // older Safari
    } catch (e) { /* ignore — matchMedia missing */ }
  }

  function initAboutModal() {
    const modal = document.getElementById('about-modal');
    const openBtn = document.getElementById('btn-about');
    if (!modal || !openBtn) return;
    openBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    modal.addEventListener('click', (e) => {
      if (e.target.dataset.close !== undefined) modal.classList.add('hidden');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) modal.classList.add('hidden');
    });
    const exitBtn = document.getElementById('btn-exit');
    if (exitBtn) exitBtn.addEventListener('click', exitGame);
  }

  function exitGame() {
    // Wrapped Capacitor app — close the native app.
    try {
      const cap = window.Capacitor;
      if (cap && cap.Plugins && cap.Plugins.App && typeof cap.Plugins.App.exitApp === 'function') {
        cap.Plugins.App.exitApp();
        return;
      }
    } catch (e) { /* fall through */ }
    // Browser — close the tab (works for script-opened windows / PWAs).
    try { window.close(); } catch (e) { /* ignore */ }
  }

  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
})();
