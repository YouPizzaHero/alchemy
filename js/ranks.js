// Rank tiers based on % of elements discovered.
(function (global) {
  'use strict';

  const TIERS = [
    { min: 0.00, title: 'Initiate',   theme: 'initiate',
      flavor: 'A chiseled stone slab. Cold, plain, waiting.' },
    { min: 0.05, title: 'Apprentice', theme: 'apprentice',
      flavor: 'A worn workbench. Ink stains map your first attempts.' },
    { min: 0.15, title: 'Adept',      theme: 'adept',
      flavor: 'An aged grimoire page with faint mercurial runes.' },
    { min: 0.30, title: 'Scholar',    theme: 'scholar',
      flavor: 'A burgundy library tome trimmed in gilt.' },
    { min: 0.50, title: 'Mystic',     theme: 'mystic',
      flavor: 'A celestial chart of constellations and ley-lines.' },
    { min: 0.70, title: 'Sage',       theme: 'sage',
      flavor: 'A glowing summoning circle inscribed with sigils.' },
    { min: 0.90, title: 'Archmage',   theme: 'archmage',
      flavor: 'The cosmic loom — stardust and threads of fate.' },
    { min: 1.00, title: 'Demiurge',   theme: 'demiurge',
      flavor: 'The forge of creation itself.' },
  ];

  const THEMES = TIERS.map(t => t.theme);

  function forRatio(r) {
    let pick = TIERS[0];
    for (const t of TIERS) if (r >= t.min) pick = t;
    return pick;
  }

  global.Ranks = { TIERS, THEMES, forRatio };
})(window);
