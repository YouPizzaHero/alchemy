// Renders the rank/progress bar in the topbar + xp-style fill below.
(function (global) {
  'use strict';

  let fillEl, rankBadgeEl, rankBarEl, percentEl, countEl, workspaceEl;
  let lastTheme = null;
  let lastRankTitle = null;

  function init() {
    fillEl       = document.getElementById('progress-fill');
    rankBadgeEl  = document.getElementById('rank-title');
    rankBarEl    = document.getElementById('progress-rank');
    percentEl    = document.getElementById('progress-percent');
    countEl      = document.getElementById('discovery-count');
    workspaceEl  = document.getElementById('workspace');

    State.onChange(render);
    render();
  }

  function render() {
    const total = State.state.totalElements || 1;
    const found = State.state.discovered.size;
    const ratio = Math.min(1, found / total);
    const pct = Math.round(ratio * 100);
    const rank = Ranks.forRatio(ratio);

    fillEl.style.width = (ratio * 100) + '%';
    rankBadgeEl.textContent = rank.title;
    rankBarEl.textContent = rank.title;
    percentEl.textContent = pct + '%';
    countEl.textContent = found + ' / ' + total;

    // Apply the rank's theme to the workspace.
    if (workspaceEl && rank.theme !== lastTheme) {
      for (const t of Ranks.THEMES) workspaceEl.classList.remove('theme-' + t);
      workspaceEl.classList.add('theme-' + rank.theme);
      lastTheme = rank.theme;
    }

    // Sync the Circle's slot count with the current rank. The Circle decides
    // whether this is a change and runs the unlock cutscene itself.
    if (window.Circle && Circle.setSlotCountForRank) {
      Circle.setSlotCountForRank(rank.theme);
    }

    // Show a rank-up banner the first time a new rank is reached
    // (but not on initial page load, when lastRankTitle is null).
    if (lastRankTitle !== null && rank.title !== lastRankTitle) {
      showRankUpBanner(rank);
    }
    lastRankTitle = rank.title;
  }

  function showRankUpBanner(rank) {
    if (window.Sound) Sound.rankUp();
    const banner = document.createElement('div');
    banner.className = 'rank-up-banner';
    // role=status + aria-live=polite makes screen readers announce the new
    // rank without the user having to navigate to the banner.
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    const label = document.createElement('div');
    label.className = 'rank-up-label';
    label.textContent = 'Rank Achieved';
    const title = document.createElement('div');
    title.className = 'rank-up-title';
    title.textContent = rank.title;
    const flavor = document.createElement('div');
    flavor.className = 'rank-up-flavor';
    flavor.textContent = rank.flavor || '';
    banner.appendChild(label);
    banner.appendChild(title);
    banner.appendChild(flavor);
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 4200);
  }

  global.Progress = { init, render };
})(window);
