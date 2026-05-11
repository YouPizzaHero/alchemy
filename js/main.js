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
  }

  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
})();
