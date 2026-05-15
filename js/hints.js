// Hint system: the player burns a rewarded ad to reveal both inputs of
// an undiscovered recipe whose ingredients are already in their library.
// The result remains hidden — the player still discovers what they make.
//
// Steam / desktop builds (where ads aren't shown) hide the Hint button
// entirely; Tree + Lineage remain the offline-friendly research paths.
//
// Hint targeting rules:
//   1. Result must NOT already be discovered.
//   2. Every input must already be in the player's library — so they
//      can immediately act on the hint.
//   3. Recipe arity must fit the current Circle (no hinting a 5-input
//      miracle at an Apprentice who only has 2 slots).
//   4. Prefer the lowest-arity match (pair before quartet) so the
//      player isn't pushed toward an unreachable brew.
//   5. Don't re-hint the same recipe in one session.
(function (global) {
  'use strict';

  let modalEl, contentEl, buttonEl;
  const shownThisSession = new Set();

  function init() {
    buttonEl  = document.getElementById('btn-hint');
    modalEl   = document.getElementById('hint-modal');
    contentEl = document.getElementById('hint-content');
    if (!buttonEl || !modalEl) return;

    // Hide the Hint button unless BOTH conditions are met:
    //   1. We're on a mobile/wrapped build (so ads can actually serve).
    //   2. The ADS_ENABLED master flag in ads.js is true.
    // Until AdMob is fully provisioned, ADS_ENABLED stays false and the
    // button disappears — testers don't see a non-functional "Watch ad"
    // promise. Flipping the flag in ads.js turns the whole feature back on.
    if (!window.GameAds || !GameAds.isMobile() || !GameAds.adsEnabled()) {
      buttonEl.classList.add('hidden');
      return;
    }

    buttonEl.addEventListener('click', openModal);
    modalEl.addEventListener('click', (e) => {
      if (e.target.dataset.close !== undefined) { close(); return; }
      if (e.target.classList.contains('hint-watch')) requestHint();
      if (e.target.classList.contains('hint-retry')) renderPrompt();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modalEl.classList.contains('hidden')) close();
    });
  }

  function openModal() { modalEl.classList.remove('hidden'); renderPrompt(); }
  function close()     { modalEl.classList.add('hidden'); }

  // --- States the modal can be in ------------------------------------------
  function renderPrompt() {
    contentEl.innerHTML = '';
    if (!pickCandidate()) {
      appendPara(contentEl, 'hint-flavor',
        'The flame is quiet. Every union you can presently form has already been forged. Discover more elements to summon a new whisper.');
      return;
    }
    appendPara(contentEl, 'hint-flavor',
      'The crucible hums. A union waits to be forged — its shape, just beyond the smoke. Bid the flame speak, and it will name the elements you must bind.');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hint-watch';
    btn.textContent = 'Watch ad · reveal a hint';
    contentEl.appendChild(btn);
    appendPara(contentEl, 'hint-fine',
      'A short rewarded ad will play. The flame keeps no count of your favors.');
  }

  function renderAdFailed() {
    contentEl.innerHTML = '';
    appendPara(contentEl, 'hint-flavor',
      'The flame guttered. No vision came through. Try again, and the smoke may part.');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hint-retry';
    btn.textContent = 'Try again';
    contentEl.appendChild(btn);
  }

  function renderRevealed(candidate) {
    contentEl.innerHTML = '';
    appendPara(contentEl, 'hint-flavor hint-revealed',
      candidate.inputs.length === 2
        ? 'The smoke parts, and two names burn through:'
        : 'The smoke parts, and ' + numberWord(candidate.inputs.length) + ' names burn through:');

    const recipe = document.createElement('div');
    recipe.className = 'hint-recipe';
    for (let i = 0; i < candidate.inputs.length; i++) {
      if (i > 0) {
        const plus = document.createElement('span');
        plus.className = 'hint-plus';
        plus.textContent = '+';
        recipe.appendChild(plus);
      }
      recipe.appendChild(buildChip(candidate.inputs[i]));
    }
    const arrow = document.createElement('span');
    arrow.className = 'hint-arrow';
    arrow.textContent = '→';
    recipe.appendChild(arrow);
    const mystery = document.createElement('span');
    mystery.className = 'hint-mystery';
    mystery.textContent = '???';
    recipe.appendChild(mystery);
    contentEl.appendChild(recipe);

    appendPara(contentEl, 'hint-fine',
      'Bind them in the Circle to learn what they forge.');

    const begin = document.createElement('button');
    begin.type = 'button';
    begin.className = 'hint-begin';
    begin.dataset.close = '';
    begin.textContent = 'To the Circle';
    contentEl.appendChild(begin);
  }

  // --- Ad request ---------------------------------------------------------
  function requestHint() {
    const candidate = pickCandidate();
    if (!candidate) { renderPrompt(); return; }
    if (!window.GameAds) return;
    GameAds.showRewarded((success) => {
      if (!success) { renderAdFailed(); return; }
      shownThisSession.add(candidate.key);
      renderRevealed(candidate);
    });
  }

  // --- Candidate selection ------------------------------------------------
  function currentSlotCount() {
    const board = document.getElementById('circle-board');
    const n = parseInt(board && board.dataset.slotCount, 10);
    return Number.isFinite(n) && n >= 2 ? n : 2;
  }

  function pickCandidate() {
    const haves = State.state.discovered;
    const maxArity = currentSlotCount();
    const candidates = [];

    // Pair recipes (arity 2).
    if (maxArity >= 2) {
      for (const [k, result] of State.state.recipes.entries()) {
        if (State.isDiscovered(result)) continue;
        if (shownThisSession.has(k)) continue;
        const inputs = k.split('+');
        if (inputs.every(id => haves.has(id))) {
          candidates.push({ key: k, inputs, result, arity: 2 });
        }
      }
    }

    // Multi-input recipes (arity 3-5).
    const multi = window.MULTI_RECIPES_DATA || [];
    for (const r of multi) {
      if (!Array.isArray(r.inputs)) continue;
      if (r.inputs.length > maxArity) continue;
      if (State.isDiscovered(r.result)) continue;
      const mkey = 'm:' + [...r.inputs].sort().join('+');
      if (shownThisSession.has(mkey)) continue;
      if (r.inputs.every(id => haves.has(id))) {
        candidates.push({ key: mkey, inputs: r.inputs.slice(), result: r.result, arity: r.inputs.length });
      }
    }

    if (candidates.length === 0) return null;
    // Prefer lowest arity; randomize within ties so the same recipe
    // isn't always the first hint offered.
    let minArity = Infinity;
    for (const c of candidates) if (c.arity < minArity) minArity = c.arity;
    const pool = candidates.filter(c => c.arity === minArity);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // --- DOM helpers --------------------------------------------------------
  function buildChip(id) {
    const el = State.state.byId.get(id);
    const chip = document.createElement('span');
    if (!el) { chip.className = 'hint-chip hint-chip-unknown'; chip.textContent = '?'; return chip; }
    chip.className = 'hint-chip icon-' + el.category;
    chip.style.setProperty('--tint', el.tint);
    const dot = document.createElement('span');
    dot.className = 'hint-chip-dot';
    const name = document.createElement('span');
    name.className = 'hint-chip-name';
    name.textContent = el.name;
    chip.appendChild(dot);
    chip.appendChild(name);
    return chip;
  }

  function appendPara(parent, cls, text) {
    const p = document.createElement('p');
    p.className = cls;
    p.textContent = text;
    parent.appendChild(p);
    return p;
  }

  function numberWord(n) {
    return ({ 2: 'two', 3: 'three', 4: 'four', 5: 'five' })[n] || String(n);
  }

  global.Hints = { init };
})(window);
