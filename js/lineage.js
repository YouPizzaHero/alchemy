// Element lineage — tap a discovered element to see what makes it and what
// it makes. Each chip in the panel drills further. Only discovered or
// reachable elements are revealed (no spoilers for what hasn't been found).
(function (global) {
  'use strict';

  let modalEl, contentEl;
  let producers = null;   // elementId -> { kind, inputs }
  let consumers = null;   // elementId -> [{ kind, inputs, result }]

  function init() {
    modalEl   = document.getElementById('lineage-modal');
    contentEl = document.getElementById('lineage-content');
    if (!modalEl) return;

    buildRecipeIndex();

    modalEl.addEventListener('click', (e) => {
      if (e.target.dataset.close !== undefined) { close(); return; }
      const chip = e.target.closest('[data-lineage-id]');
      if (chip) open(chip.dataset.lineageId);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modalEl.classList.contains('hidden')) close();
    });
  }

  function buildRecipeIndex() {
    producers = new Map();
    consumers = new Map();

    // Pair recipes from the live Recipes index.
    for (const [key, result] of State.state.recipes.entries()) {
      const inputs = key.split('+');
      producers.set(result, { kind: 'pair', inputs });
      // Dedupe inputs so a self-pair (e.g. wave + wave) only shows once
      // as a consumer of wave.
      for (const inp of new Set(inputs)) {
        if (!consumers.has(inp)) consumers.set(inp, []);
        consumers.get(inp).push({ kind: 'pair', inputs, result });
      }
    }
    // Multi-input miracle recipes.
    const miracles = window.MULTI_RECIPES_DATA || [];
    for (const r of miracles) {
      producers.set(r.result, { kind: 'multi', inputs: r.inputs.slice() });
      for (const inp of new Set(r.inputs)) {
        if (!consumers.has(inp)) consumers.set(inp, []);
        consumers.get(inp).push({ kind: 'multi', inputs: r.inputs.slice(), result: r.result });
      }
    }
  }

  function open(elementId) {
    if (!modalEl || !producers) return;
    const el = State.state.byId.get(elementId);
    if (!el) return;
    // Don't reveal undiscovered non-base elements (no spoilers).
    if (!el.base && !State.isDiscovered(el.id)) return;

    modalEl.classList.remove('hidden');
    contentEl.innerHTML = renderElement(el);
  }

  function close() {
    if (modalEl) modalEl.classList.add('hidden');
  }

  function renderElement(el) {
    const producer = producers.get(el.id);
    const all = consumers.get(el.id) || [];
    // Only surface consumer recipes when the player has discovered the result.
    // (Otherwise we'd spoil unmade combinations.)
    const knownConsumers = all.filter(r => State.isDiscovered(r.result));

    // Sort consumers by category then name of the result.
    knownConsumers.sort((a, b) => {
      const ea = State.state.byId.get(a.result);
      const eb = State.state.byId.get(b.result);
      if (!ea || !eb) return 0;
      if (ea.category !== eb.category) return ea.category.localeCompare(eb.category);
      return ea.name.localeCompare(eb.name);
    });

    const iconMarkup = '<div class="lineage-icon-wrap" data-icon-for="' + el.id + '"></div>';
    let html =
      '<div class="lineage-head">' +
        iconMarkup +
        '<div class="lineage-head-text">' +
          '<div class="lineage-name">' + escapeHtml(el.name) + '</div>' +
          '<div class="lineage-cat">' + escapeHtml(el.category) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="lineage-sections">' +
        '<section class="lineage-section">' +
          '<h3>Forged from</h3>' +
          (el.base
            ? '<p class="lineage-empty">A primal element. Born of the world itself.</p>'
            : producer
              ? renderRecipe(producer, null)
              : '<p class="lineage-empty">No known producer.</p>') +
        '</section>' +
        '<section class="lineage-section">' +
          '<h3>Forges into</h3>' +
          (knownConsumers.length === 0
            ? '<p class="lineage-empty">You haven\'t used this in a successful brew yet.</p>'
            : knownConsumers.map(r => renderRecipe(r, el.id)).join('')) +
        '</section>' +
      '</div>';

    // Defer icon injection until after innerHTML — icons need DOM not strings.
    requestAnimationFrame(() => {
      for (const slot of contentEl.querySelectorAll('[data-icon-for]')) {
        slot.innerHTML = '';
        const target = State.state.byId.get(slot.dataset.iconFor);
        if (target) slot.appendChild(Icons.buildIcon(target));
      }
    });
    return html;
  }

  function renderRecipe(recipe, focusId) {
    const inputs = recipe.inputs.map(id => renderChip(id, id === focusId)).join(
      '<span class="lineage-plus">+</span>'
    );
    const arrow  = '<span class="lineage-arrow">→</span>';
    const result = recipe.result ? renderChip(recipe.result, false) : '';
    const tag = recipe.kind === 'multi'
      ? '<span class="lineage-tag">' + recipe.inputs.length + '-input</span>'
      : '';
    return '<div class="lineage-recipe">' + inputs + (recipe.result ? arrow + result : '') + tag + '</div>';
  }

  function renderChip(id, isFocus) {
    const el = State.state.byId.get(id);
    if (!el) return '<span class="lineage-chip lineage-chip-unknown">?</span>';
    const known = el.base || State.isDiscovered(id);
    if (!known) {
      return '<span class="lineage-chip lineage-chip-unknown" title="Undiscovered">— ? —</span>';
    }
    // Tint values are concatenated into a CSS attribute, so harden them
    // against breakout. Element ids are slug-shaped today, but escape too
    // in case a future data source ships dirtier ids.
    const cls = 'lineage-chip icon-' + el.category + (isFocus ? ' lineage-chip-focus' : '');
    const safeTint = sanitizeColor(el.tint);
    return '<button class="' + cls + '" data-lineage-id="' + escapeHtml(id) + '" style="--tint:' + safeTint + '">' +
             '<span class="lineage-chip-dot" style="background:' + safeTint + '"></span>' +
             '<span class="lineage-chip-name">' + escapeHtml(el.name) + '</span>' +
           '</button>';
  }

  // Allow only the simple color shapes our data ships (hex, named colors,
  // rgb/rgba/hsl/hsla functions). Reject anything that could carry a
  // closing quote, semicolon, or url(). Falls back to a neutral grey.
  function sanitizeColor(s) {
    s = String(s || '').trim();
    if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
    if (/^[a-zA-Z]+$/.test(s)) return s;
    if (/^(rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s\/]+\s*\)$/.test(s)) return s;
    return '#888';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  global.Lineage = { init, open, close };
})(window);
