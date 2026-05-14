// Manual save slots. The discovered set is also auto-saved on every change
// (via State / Storage), so this module is for *named* checkpoints the player
// can return to and for export/import.
(function (global) {
  'use strict';

  const SLOT_COUNT = 5;
  // Bumped from 1 → 2 when the gameplay shifted to the Circle of Binding.
  // Saves below this version are no longer compatible.
  const SCHEMA_VERSION = 2;
  const KEY_PREFIX = 'alchemy_slot_';

  // --- Storage --------------------------------------------------------------
  function key(n) { return KEY_PREFIX + n; }

  function readSlot(n) {
    try {
      const raw = localStorage.getItem(key(n));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== SCHEMA_VERSION) return null;
      return parsed;
    } catch (e) { return null; }
  }

  function writeSlot(n, data) {
    try {
      localStorage.setItem(key(n), JSON.stringify(data));
      return true;
    } catch (e) { return false; }
  }

  function deleteSlot(n) {
    try { localStorage.removeItem(key(n)); } catch (e) { /* ignore */ }
  }

  // --- Current-state capture / apply ----------------------------------------
  function captureCurrent(name) {
    return {
      version: SCHEMA_VERSION,
      name: (name || '').trim() || defaultName(),
      savedAt: new Date().toISOString(),
      discovered: Array.from(State.state.discovered),
      workspace: Workspace.serialize(),
    };
  }

  function defaultName() {
    const ratio = State.state.discovered.size / Math.max(1, State.state.totalElements);
    const rank = Ranks.forRatio(ratio);
    return rank.title + ' run';
  }

  function applySave(data) {
    if (!data) return false;
    State.loadDiscovered(data.discovered || []);
    Workspace.deserialize(data.workspace || []);
    return true;
  }

  // --- UI -------------------------------------------------------------------
  function init() {
    const openBtn = document.getElementById('btn-saves');
    const modal   = document.getElementById('saves-modal');
    if (!openBtn || !modal) return;

    openBtn.addEventListener('click', () => {
      renderSlots();
      modal.classList.remove('hidden');
    });

    modal.addEventListener('click', (e) => {
      const t = e.target;
      if (t.dataset.close !== undefined) {
        modal.classList.add('hidden');
        return;
      }
      const action = t.dataset.action;
      if (!action) return;
      const slot = Number(t.dataset.slot);

      if (action === 'save')   onSave(slot);
      if (action === 'load')   onLoad(slot);
      if (action === 'delete') onDelete(slot);
      if (action === 'export') onExport();
      if (action === 'import') onImport();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) modal.classList.add('hidden');
    });
  }

  function renderSlots() {
    const list = document.getElementById('saves-list');
    if (!list) return;
    list.innerHTML = '';
    for (let i = 1; i <= SLOT_COUNT; i++) {
      list.appendChild(buildSlot(i, readSlot(i)));
    }
    const msg = document.getElementById('saves-message');
    if (msg) msg.textContent = '';
  }

  function buildSlot(n, data) {
    const row = document.createElement('div');
    row.className = 'save-slot' + (data ? ' filled' : ' empty');

    const meta = document.createElement('div');
    meta.className = 'save-meta';

    const labelRow = document.createElement('div');
    labelRow.className = 'save-label';
    const num = document.createElement('span');
    num.className = 'save-num';
    num.textContent = 'Slot ' + n;
    labelRow.appendChild(num);

    if (data) {
      const name = document.createElement('span');
      name.className = 'save-name';
      name.textContent = data.name || '(unnamed)';
      labelRow.appendChild(name);
    } else {
      const empty = document.createElement('span');
      empty.className = 'save-empty';
      empty.textContent = '— Empty —';
      labelRow.appendChild(empty);
    }
    meta.appendChild(labelRow);

    if (data) {
      const stats = document.createElement('div');
      stats.className = 'save-stats';
      const ratio = (data.discovered || []).length / Math.max(1, State.state.totalElements);
      const rank = Ranks.forRatio(ratio);
      const date = data.savedAt ? new Date(data.savedAt) : null;
      const when = date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
                          date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                        : '';
      stats.textContent = rank.title + ' · ' + (data.discovered || []).length + ' / ' + State.state.totalElements + ' · ' + when;
      meta.appendChild(stats);
    }

    row.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'save-actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = data ? 'Overwrite' : 'Save Here';
    saveBtn.dataset.action = 'save';
    saveBtn.dataset.slot = n;
    actions.appendChild(saveBtn);

    if (data) {
      const loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.textContent = 'Load';
      loadBtn.className = 'primary';
      loadBtn.dataset.action = 'load';
      loadBtn.dataset.slot = n;
      actions.appendChild(loadBtn);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = 'Delete';
      delBtn.className = 'danger-soft';
      delBtn.dataset.action = 'delete';
      delBtn.dataset.slot = n;
      actions.appendChild(delBtn);
    }
    row.appendChild(actions);
    return row;
  }

  function flash(text, kind) {
    const msg = document.getElementById('saves-message');
    if (!msg) return;
    msg.className = 'saves-message' + (kind ? ' ' + kind : '');
    msg.textContent = text;
    clearTimeout(flash._t);
    flash._t = setTimeout(() => { msg.textContent = ''; }, 3000);
  }

  // --- Actions --------------------------------------------------------------
  function onSave(slot) {
    const existing = readSlot(slot);
    let name = existing ? existing.name : defaultName();
    const promptName = window.prompt('Name this save:', name);
    if (promptName === null) return;  // user cancelled
    const data = captureCurrent(promptName);
    if (writeSlot(slot, data)) {
      flash('Saved to slot ' + slot + ': "' + data.name + '"', 'ok');
      renderSlots();
    } else {
      flash('Could not save — storage may be full.', 'err');
    }
  }

  function onLoad(slot) {
    const data = readSlot(slot);
    if (!data) return;
    if (!window.confirm('Load "' + data.name + '"? Your current run will be replaced.')) return;
    if (applySave(data)) {
      flash('Loaded "' + data.name + '".', 'ok');
      renderSlots();
    } else {
      flash('Could not load slot.', 'err');
    }
  }

  function onDelete(slot) {
    const data = readSlot(slot);
    if (!data) return;
    if (!window.confirm('Delete save "' + data.name + '"?')) return;
    deleteSlot(slot);
    flash('Deleted slot ' + slot + '.', 'ok');
    renderSlots();
  }

  async function onExport() {
    const data = captureCurrent('Exported');
    const json = JSON.stringify(data);
    try {
      await navigator.clipboard.writeText(json);
      flash('Copied save JSON to clipboard.', 'ok');
    } catch (e) {
      // Fallback: show in a prompt for manual copy
      window.prompt('Copy this save code:', json);
      flash('Save code shown.', 'ok');
    }
  }

  function onImport() {
    const text = window.prompt('Paste a save code:');
    if (!text) return;
    try {
      const data = JSON.parse(text.trim());
      if (!data || !Array.isArray(data.discovered)) throw new Error('bad shape');
      if (!window.confirm('Replace your current run with imported save?')) return;
      applySave(data);
      flash('Save imported.', 'ok');
      renderSlots();
    } catch (e) {
      flash('That does not look like a save code.', 'err');
    }
  }

  global.Saves = { init };
})(window);
