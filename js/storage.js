// localStorage wrapper with versioning and silent failure (Safari private mode).
(function (global) {
  'use strict';

  const KEY = 'alchemy_save_v1';
  // Bumped from 1 → 2 when the gameplay shifted to the Circle of Binding.
  // Saves below this version are no longer compatible.
  const VERSION = 2;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.version !== VERSION) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ version: VERSION, data }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  global.Storage = { load, save, clear };
})(window);
