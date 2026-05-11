// Bootstrap: load embedded data, hydrate state, mount UI.
(function () {
  'use strict';

  try {
    const elements = window.ELEMENTS_DATA;
    const recipes  = window.RECIPES_DATA;
    if (!Array.isArray(elements) || !Array.isArray(recipes)) {
      throw new Error('Data scripts did not load (ELEMENTS_DATA / RECIPES_DATA missing).');
    }

    State.ingestElements(elements);
    State.state.recipes = Recipes.ingest(recipes, State.state.byId);
    State.hydrate();

    Settings.init();
    Progress.init();
    Workspace.init();
    Sidebar.init();
    Saves.init();
    initAboutModal();

    document.getElementById('loading').classList.add('hidden');

    if (typeof PizzaHeroSplash !== 'undefined') {
      PizzaHeroSplash.show({ tagline: 'GAMING' });
    }
  } catch (err) {
    console.error('Failed to boot alchemy:', err);
    const loading = document.getElementById('loading');
    loading.textContent = 'Something went wrong: ' + (err && err.message ? err.message : err);
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
    if (!window.confirm('Exit the game? Your discoveries are saved automatically.')) return;
    // 1. Capacitor / wrapped app — close the native app
    try {
      const cap = window.Capacitor;
      if (cap && cap.Plugins && cap.Plugins.App && typeof cap.Plugins.App.exitApp === 'function') {
        cap.Plugins.App.exitApp();
        return;
      }
    } catch (e) { /* fall through */ }

    // 2. Browser — try to close the tab (only works for script-opened windows)
    try { window.close(); } catch (e) { /* ignore */ }

    // 3. Fallback — replace the screen with a 'curtain close' so the player
    //    can manually close the tab.
    const overlay = document.getElementById('exit-overlay');
    if (overlay) overlay.classList.remove('hidden');
  }

  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
})();
