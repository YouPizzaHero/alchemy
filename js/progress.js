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

    // Show a rank-up banner the first time a new rank is reached
    // (but not on initial page load, when lastRankTitle is null).
    if (lastRankTitle !== null && rank.title !== lastRankTitle) {
      showRankUpBanner(rank);
    }
    lastRankTitle = rank.title;
  }

  function showRankUpBanner(rank) {
    const banner = document.createElement('div');
    banner.className = 'rank-up-banner';
    banner.innerHTML =
      '<div class="rank-up-label">Rank Achieved</div>' +
      '<div class="rank-up-title">' + rank.title + '</div>' +
      '<div class="rank-up-flavor">' + (rank.flavor || '') + '</div>';
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 4200);
  }

  global.Progress = { init, render };
})(window);
