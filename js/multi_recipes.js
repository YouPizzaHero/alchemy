// Hand-authored multi-input "miracle" recipes. These are matched FIRST
// when the circle has 3, 4, or 5 elements; if no match, the sequential
// pairwise resolver takes over. Each recipe is order-insensitive.
(function (global) {
  'use strict';

  let map = null;
  let skipped = 0;

  function key(ids) { return [...ids].sort().join('+'); }

  function init(arr, byId) {
    map = new Map();
    skipped = 0;
    if (!Array.isArray(arr)) return;
    for (const r of arr) {
      if (!r || !Array.isArray(r.inputs) || !r.result) { skipped++; continue; }
      if (r.inputs.length < 3 || r.inputs.length > 5) { skipped++; continue; }
      // Validate ids exist in the element catalog when a lookup map is supplied.
      if (byId) {
        let ok = byId.has(r.result);
        for (const id of r.inputs) if (!byId.has(id)) { ok = false; break; }
        if (!ok) { skipped++; continue; }
      }
      map.set(key(r.inputs), r.result);
    }
    if (skipped) console.warn('[multi_recipes] skipped', skipped, 'invalid entries');
  }

  function combine(ids) {
    if (!map || !Array.isArray(ids) || ids.length < 3 || ids.length > 5) return null;
    return map.get(key(ids)) || null;
  }

  function size() { return map ? map.size : 0; }

  global.MultiRecipes = { init, combine, size };
})(window);
