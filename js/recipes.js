// Recipe index: build a Map<canonicalKey, resultId>. Order-insensitive.
(function (global) {
  'use strict';

  function key(a, b) {
    return a < b ? a + '+' + b : b + '+' + a;
  }

  function ingest(recipes, byId) {
    const map = new Map();
    let skipped = 0;
    for (const r of recipes) {
      if (!r || !r.a || !r.b || !r.result) { skipped++; continue; }
      if (!byId.has(r.a) || !byId.has(r.b) || !byId.has(r.result)) { skipped++; continue; }
      const k = key(r.a, r.b);
      if (map.has(k)) continue; // first definition wins
      map.set(k, r.result);
    }
    if (skipped) console.warn('[recipes] skipped', skipped, 'invalid entries');
    return map;
  }

  function combine(a, b, map) {
    return map.get(key(a, b)) || null;
  }

  global.Recipes = { ingest, combine, key };
})(window);
