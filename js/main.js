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

    Workspace.init();
    Sidebar.init();

    document.getElementById('loading').classList.add('hidden');
  } catch (err) {
    console.error('Failed to boot alchemy:', err);
    const loading = document.getElementById('loading');
    loading.textContent = 'Something went wrong: ' + (err && err.message ? err.message : err);
  }

  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
})();
