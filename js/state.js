// In-memory game state. Persisted bits: discovered set.
(function (global) {
  'use strict';

  const state = {
    elements: [],                   // array of element defs from elements.json
    byId: new Map(),                // id -> element
    recipes: new Map(),             // canonicalKey -> resultId
    discovered: new Set(),          // set of element ids known to player
    totalElements: 0,
    listeners: new Set(),
  };

  function ingestElements(arr) {
    state.elements = arr;
    state.byId = new Map(arr.map(e => [e.id, e]));
    state.totalElements = arr.length;
  }

  function discover(id) {
    if (!state.byId.has(id)) return false;
    if (state.discovered.has(id)) return false;
    state.discovered.add(id);
    persist();
    emit();
    return true;
  }

  function isDiscovered(id) { return state.discovered.has(id); }

  function resetProgress() {
    state.discovered = new Set();
    // re-seed base elements
    for (const el of state.elements) if (el.base) state.discovered.add(el.id);
    Storage.save(serialize());
    emit();
  }

  // Replace the entire discovered set with the given array of ids.
  // Used when loading a saved game. Persists and emits afterwards.
  function loadDiscovered(ids) {
    state.discovered = new Set();
    for (const el of state.elements) if (el.base) state.discovered.add(el.id);
    if (Array.isArray(ids)) {
      for (const id of ids) if (state.byId.has(id)) state.discovered.add(id);
    }
    Storage.save(serialize());
    emit();
  }

  function persist() { Storage.save(serialize()); }
  function serialize() {
    return { discovered: Array.from(state.discovered) };
  }
  function hydrate() {
    // Order matters: a JS Set preserves insertion order, and Array.from
    // walks it in that order. The sidebar uses this to drive "most
    // recent" sorting (later position = more recently discovered).
    // So we add the bases FIRST (they should always anchor the start
    // of the order), then layer saved discoveries on top. The Set
    // dedupes — a base id present in the save is ignored, not moved.
    for (const el of state.elements) if (el.base) state.discovered.add(el.id);
    const saved = Storage.load();
    if (saved && Array.isArray(saved.discovered)) {
      for (const id of saved.discovered) if (state.byId.has(id)) state.discovered.add(id);
    }
  }

  // Index of a discovered element in the player's history. 0 = the
  // first discovery (typically water), higher = more recent. Returns
  // -1 for elements not yet discovered. Used by the sidebar's
  // "Recent" sort mode.
  function discoveryIndex(id) {
    let i = 0;
    for (const x of state.discovered) {
      if (x === id) return i;
      i++;
    }
    return -1;
  }

  function onChange(cb) { state.listeners.add(cb); return () => state.listeners.delete(cb); }
  function emit() { for (const cb of state.listeners) cb(); }

  global.State = {
    state,
    ingestElements,
    discover, isDiscovered, discoveryIndex,
    resetProgress, loadDiscovered, hydrate, onChange,
  };
})(window);
