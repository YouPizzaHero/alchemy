// Renders the rank/progress bar in the topbar + xp-style fill below.
(function (global) {
  'use strict';

  let fillEl, rankBadgeEl, rankBarEl, percentEl, countEl;

  function init() {
    fillEl      = document.getElementById('progress-fill');
    rankBadgeEl = document.getElementById('rank-title');
    rankBarEl   = document.getElementById('progress-rank');
    percentEl   = document.getElementById('progress-percent');
    countEl     = document.getElementById('discovery-count');

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
  }

  global.Progress = { init, render };
})(window);
