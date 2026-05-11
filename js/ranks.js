// Rank tiers based on % of elements discovered.
(function (global) {
  'use strict';

  const TIERS = [
    { min: 0.00, title: 'Initiate' },
    { min: 0.05, title: 'Apprentice' },
    { min: 0.15, title: 'Adept' },
    { min: 0.30, title: 'Scholar' },
    { min: 0.50, title: 'Mystic' },
    { min: 0.70, title: 'Sage' },
    { min: 0.90, title: 'Archmage' },
    { min: 1.00, title: 'Demiurge' },
  ];

  function forRatio(r) {
    let pick = TIERS[0];
    for (const t of TIERS) if (r >= t.min) pick = t;
    return pick;
  }

  global.Ranks = { TIERS, forRatio };
})(window);
