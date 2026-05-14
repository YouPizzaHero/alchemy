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
    const saved = Storage.load();
    if (saved && Array.isArray(saved.discovered)) {
      for (const id of saved.discovered) if (state.byId.has(id)) state.discovered.add(id);
    }
    // Always ensure base elements are present.
    for (const el of state.elements) if (el.base) state.discovered.add(el.id);
  }

  function onChange(cb) { state.listeners.add(cb); return () => state.listeners.delete(cb); }
  function emit() { for (const cb of state.listeners) cb(); }

  global.State = {
    state,
    ingestElements,
    discover, isDiscovered,
    resetProgress, loadDiscovered, hydrate, onChange,
  };
})(window);
