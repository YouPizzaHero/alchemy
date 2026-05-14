// Seasonal sigils — adds a thin decorative layer over the workspace at
// specific times of year. The rank sigil and gameplay are untouched; only
// the workspace's frame, palette accents, and background particles change.
(function (global) {
  'use strict';

  // Date ranges (inclusive). Year-agnostic.
  // [startMonth, startDay, endMonth, endDay] — month is 1-indexed.
  const SEASONS = [
    { id: 'halloween', label: 'All Hallows', range: [10, 20, 11, 2 ],
      flavor: 'jack-o\'-lantern at the gate' },
    { id: 'winter',    label: 'Long Night',  range: [12, 15, 1, 5 ],
      flavor: 'snow falls on the circle' },
    { id: 'spring',    label: 'Verdant Hour', range: [3, 18, 4, 7 ],
      flavor: 'new buds bloom at the edge' },
    { id: 'summer',    label: 'Solar Apex',   range: [6, 18, 6, 27 ],
      flavor: 'the sun crowns the alembic' },
  ];

  function inRange(now, range) {
    const m = now.getMonth() + 1, d = now.getDate();
    const [sm, sd, em, ed] = range;
    const startOk = (m > sm) || (m === sm && d >= sd);
    const endOk   = (m < em) || (m === em && d <= ed);
    // Handle ranges that wrap year-end (winter Dec→Jan).
    if (sm > em || (sm === em && sd > ed)) {
      return startOk || endOk;
    }
    return startOk && endOk;
  }

  function current(now) {
    now = now || new Date();
    for (const s of SEASONS) if (inRange(now, s.range)) return s;
    return null;
  }

  function init() {
    const s = current();
    document.body.classList.remove('season-halloween', 'season-winter', 'season-spring', 'season-summer');
    if (s) document.body.classList.add('season-' + s.id);
  }

  // Test helper: temporarily switch to a given season (or null) for previewing.
  function setForcedSeason(id) {
    document.body.classList.remove('season-halloween', 'season-winter', 'season-spring', 'season-summer');
    if (id) document.body.classList.add('season-' + id);
  }

  global.Seasons = { init, current, setForcedSeason, SEASONS };
})(window);
