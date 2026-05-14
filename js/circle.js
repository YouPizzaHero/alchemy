// The Circle of Binding — slot-based combine UI.
// Slots are arranged around a central crucible. When every visible slot
// holds an element, burning ley-lines ignite from each slot toward the
// crucible; the combination resolves and the result rises with its true
// name burning across the top of the board.

(function (global) {
  'use strict';

  const MAX_SLOTS = 5;

  // Slot-count thresholds tied to the rank progression.
  //   2 slots: Initiate / Apprentice (0-15% discovered)
  //   3 slots: Adept / Scholar       (15-50%)
  //   4 slots: Mystic / Sage         (50-90%)
  //   5 slots: Archmage / Demiurge   (90%+)
  const SLOT_COUNT_FOR_RANK = {
    initiate:   2,
    apprentice: 2,
    adept:      3,
    scholar:    3,
    mystic:     4,
    sage:       4,
    archmage:   5,
    demiurge:   5,
  };

  let boardEl, slotsEl, channelsEl, sigilEl, crucibleEl, sparksEl, resultEl, nameEl, subEl, hintEl;
  let slotCount = 2;
  let slots = [];   // { node, x, y, elementId|null }
  let combining = false;
  let revealTimer = null;

  function init() {
    boardEl     = document.getElementById('circle-board');
    slotsEl     = document.getElementById('slots');
    channelsEl  = document.getElementById('channels');
    sigilEl     = document.getElementById('sigil');
    crucibleEl  = document.getElementById('crucible');
    sparksEl    = document.getElementById('sparks');
    resultEl    = document.getElementById('result-emerge');
    nameEl      = document.getElementById('reveal-name');
    subEl       = document.getElementById('reveal-sub');
    hintEl      = document.getElementById('circle-hint');

    rebuildSlots(slotCount);
    window.addEventListener('resize', updateChannels);
    // Recompute after fonts/layout settle on first paint.
    requestAnimationFrame(updateChannels);

    // Tap-to-brew: the crucible becomes clickable when 2+ slots are filled
    // and not all slots are filled (the all-filled case auto-fires already).
    if (crucibleEl) {
      crucibleEl.addEventListener('click', () => {
        if (combining) return;
        const filled = slots.filter(s => s.elementId).length;
        if (filled >= 2) brew();
      });
    }
  }

  // --- Slot geometry --------------------------------------------------------
  function slotPosition(i, count) {
    // i=0 sits at the top; rest distribute clockwise.
    const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
    // For 2 slots, swap to a top/bottom vertical axis (already true at -π/2 + 0 and -π/2 + π).
    const radius = 36;  // % of the smaller dimension
    return {
      xPct: 50 + Math.cos(angle) * radius,
      yPct: 50 + Math.sin(angle) * radius,
    };
  }

  function rebuildSlots(count) {
    slotCount = Math.max(2, Math.min(MAX_SLOTS, count));
    boardEl.setAttribute('data-slot-count', String(slotCount));
    slotsEl.innerHTML = '';
    slots = [];
    for (let i = 0; i < slotCount; i++) {
      slots.push(buildSlot(i));
    }
    updateChannels();
    updateHint();
  }

  function buildSlot(i) {
    const pos = slotPosition(i, slotCount);
    const node = document.createElement('div');
    node.className = 'slot empty';
    node.dataset.slot = String(i);
    node.style.left = pos.xPct + '%';
    node.style.top  = pos.yPct + '%';
    const content = document.createElement('div');
    content.className = 'slot-content';
    node.appendChild(content);
    // Close button to clear the slot.
    const close = document.createElement('button');
    close.className = 'slot-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Clear slot');
    close.textContent = '✕';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      clearSlot(i);
    });
    node.appendChild(close);
    slotsEl.appendChild(node);
    return { node, content, close, elementId: null, x: pos.xPct, y: pos.yPct, animatedAppear: false };
  }

  // --- Channel rendering ----------------------------------------------------
  // Each channel is a path: straight from the slot to the crucible's outer
  // edge, then a clockwise arc around the crucible to the angular position
  // of the next slot. With N slots, the N arcs join end-to-end and trace
  // the full crucible perimeter as the brew ignites.
  function updateChannels() {
    if (!channelsEl) return;
    [...channelsEl.querySelectorAll('path')].forEach(n => n.remove());
    if (slots.length === 0) return;

    const boardRect = boardEl.getBoundingClientRect();
    if (boardRect.width === 0 || boardRect.height === 0) return;
    channelsEl.setAttribute('viewBox', '0 0 ' + boardRect.width + ' ' + boardRect.height);
    channelsEl.setAttribute('preserveAspectRatio', 'none');

    const cx = boardRect.width / 2;
    const cy = boardRect.height / 2;
    // Crucible div is 110px square with a wider glow; arc just outside its visual rim.
    const crucibleR = 55;
    const arcR = crucibleR + 14;

    // Resolve each slot's centre in board-local pixel coordinates.
    const slotCenters = slots.map(s => {
      const r = s.node.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 - boardRect.left,
        y: r.top  + r.height / 2 - boardRect.top,
      };
    });

    for (let i = 0; i < slots.length; i++) {
      const here = slotCenters[i];
      const next = slotCenters[(i + 1) % slotCenters.length];

      const hereAngle = Math.atan2(here.y - cy, here.x - cx);
      const nextAngle = Math.atan2(next.y - cy, next.x - cx);

      // Straight portion stops at the arc-start point (outside the crucible).
      const arcStartX = cx + arcR * Math.cos(hereAngle);
      const arcStartY = cy + arcR * Math.sin(hereAngle);
      const arcEndX   = cx + arcR * Math.cos(nextAngle);
      const arcEndY   = cy + arcR * Math.sin(nextAngle);

      // Sweep-flag 1 = clockwise in SVG (which has y-down).
      // Large-arc-flag 0 since each arc is < 180° (except 2-slot which is exactly 180°,
      // where 0 still produces the right semicircle going clockwise).
      const d = 'M ' + here.x + ' ' + here.y +
                ' L ' + arcStartX + ' ' + arcStartY +
                ' A ' + arcR + ' ' + arcR + ' 0 0 1 ' + arcEndX + ' ' + arcEndY;

      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', d);
      pathEl.setAttribute('class', 'channel-line');
      pathEl.dataset.slot = String(i);
      channelsEl.appendChild(pathEl);

      // Set dasharray = full path length so dashoffset animation reveals it
      // smoothly from the slot end through the arc.
      const len = pathEl.getTotalLength();
      pathEl.style.strokeDasharray = String(len);
      pathEl.style.strokeDashoffset = String(len);
    }
    rebuildSigil(slotCenters, cx, cy);
  }

  // --- Alchemical sigil background ------------------------------------------
  // Each slot count gets a distinct historical/alchemical figure as the
  // workspace's living backdrop. Slots sit on the figure's natural input nodes.
  function rebuildSigil(slotCenters, cx, cy) {
    if (!sigilEl) return;
    const boardRect = boardEl.getBoundingClientRect();
    sigilEl.setAttribute('viewBox', '0 0 ' + boardRect.width + ' ' + boardRect.height);
    sigilEl.setAttribute('preserveAspectRatio', 'none');
    sigilEl.innerHTML = '';

    const ns = 'http://www.w3.org/2000/svg';
    function el(tag, attrs) {
      const node = document.createElementNS(ns, tag);
      for (const k in attrs) node.setAttribute(k, attrs[k]);
      return node;
    }

    // Average radial distance of slots from centre (the "outer ring").
    let avgR = 0;
    for (const s of slotCenters) avgR += Math.hypot(s.x - cx, s.y - cy);
    avgR /= Math.max(1, slotCenters.length);
    const outerR = avgR;
    const midR   = avgR * 0.62;     // mid ring (often used in alchemical figures)
    const innerR = 75;              // tight inner ring around crucible

    // Common 'outer boundary' ring — every sigil has it.
    const outerRing = el('circle', { cx, cy, r: outerR + 6, class: 'sigil-ring sigil-outer' });
    sigilEl.appendChild(outerRing);

    if (slotCount === 2)      buildVesicaPiscis(cx, cy, outerR, slotCenters, el);
    else if (slotCount === 3) buildTriquetra(cx, cy, outerR, midR, slotCenters, el);
    else if (slotCount === 4) buildSquaringCircle(cx, cy, outerR, midR, slotCenters, el);
    else if (slotCount === 5) buildPentacle(cx, cy, outerR, midR, slotCenters, el);

    // Inner ring around the crucible — present on every sigil.
    sigilEl.appendChild(el('circle', { cx, cy, r: innerR, class: 'sigil-ring sigil-inner' }));
  }

  // 2 SLOTS — Vesica Piscis: two overlapping circles, each centred on a slot.
  function buildVesicaPiscis(cx, cy, R, slots, el) {
    const distance = Math.hypot(slots[1].x - slots[0].x, slots[1].y - slots[0].y);
    const r = distance * 0.72;  // classic vesica proportion overlaps through centre
    sigilEl.appendChild(el('circle', { cx: slots[0].x, cy: slots[0].y, r, class: 'sigil-shape' }));
    sigilEl.appendChild(el('circle', { cx: slots[1].x, cy: slots[1].y, r, class: 'sigil-shape' }));
    // Centre axis
    sigilEl.appendChild(el('line', {
      x1: slots[0].x, y1: slots[0].y, x2: slots[1].x, y2: slots[1].y, class: 'sigil-axis'
    }));
  }

  // 3 SLOTS — Triquetra: three interlocking arcs + inscribed triangle.
  function buildTriquetra(cx, cy, outerR, midR, slots, el) {
    // Inscribed triangle through the slot positions
    const tri = 'M ' + slots.map(s => s.x + ' ' + s.y).join(' L ') + ' Z';
    sigilEl.appendChild(el('path', { d: tri, class: 'sigil-shape sigil-poly' }));
    // Three interlocking circles (triquetra arms) — each centred between two slot points
    for (let i = 0; i < slots.length; i++) {
      const a = slots[i];
      const b = slots[(i + 1) % slots.length];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const r = Math.hypot(a.x - mx, a.y - my) * 1.05;
      sigilEl.appendChild(el('circle', { cx: mx, cy: my, r, class: 'sigil-shape sigil-thin' }));
    }
    // Mid ring
    sigilEl.appendChild(el('circle', { cx, cy, r: midR, class: 'sigil-ring sigil-mid' }));
  }

  // 4 SLOTS — Squaring the Circle: triangle → square → circle, the classic
  // alchemical figure for the four-element unity.
  function buildSquaringCircle(cx, cy, outerR, midR, slots, el) {
    // Inscribed square — rotated diamond connecting the 4 cardinal slot points
    const square = 'M ' + slots.map(s => s.x + ' ' + s.y).join(' L ') + ' Z';
    sigilEl.appendChild(el('path', { d: square, class: 'sigil-shape sigil-poly' }));
    // Inner equilateral triangle (point-up) inscribed in mid ring
    const tri = [];
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i / 3) * Math.PI * 2;
      tri.push((cx + midR * Math.cos(a)) + ' ' + (cy + midR * Math.sin(a)));
    }
    sigilEl.appendChild(el('path', { d: 'M ' + tri.join(' L ') + ' Z', class: 'sigil-shape sigil-poly' }));
    // Mid ring (the 'circle' of the figure)
    sigilEl.appendChild(el('circle', { cx, cy, r: midR, class: 'sigil-ring sigil-mid' }));
  }

  // 5 SLOTS — Pentacle: pentagram inscribed in a circle. The classic
  // five-elements sigil. Slots at the 5 outer star points.
  function buildPentacle(cx, cy, outerR, midR, slots, el) {
    // Pentagram by connecting every-other vertex
    const order = [];
    for (let i = 0; i < 5; i++) order.push((i * 2) % 5);
    const points = order.map(i => slots[i].x + ' ' + slots[i].y);
    sigilEl.appendChild(el('path', {
      d: 'M ' + points.join(' L ') + ' Z',
      class: 'sigil-shape sigil-star',
    }));
    // Mid ring (encompasses the pentagram's inner pentagon)
    sigilEl.appendChild(el('circle', { cx, cy, r: midR, class: 'sigil-ring sigil-mid' }));
  }

  // --- Public API -----------------------------------------------------------
  function isSlotAtPoint(clientX, clientY) {
    // Returns the slot index whose center is closest to the point, if within range.
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < slots.length; i++) {
      const r = slots[i].node.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(clientX - cx, clientY - cy);
      if (d < r.width * 0.7 && d < bestDist) {
        best = i;
        bestDist = d;
      }
    }
    return best;
  }

  function previewSlotAt(clientX, clientY) {
    const idx = isSlotAtPoint(clientX, clientY);
    for (let i = 0; i < slots.length; i++) {
      slots[i].node.classList.toggle('drag-over', i === idx);
    }
    return idx;
  }

  function clearSlotHovers() {
    for (const s of slots) s.node.classList.remove('drag-over');
  }

  function tryFillFromDrop(clientX, clientY, elementId) {
    if (combining) return false;
    const idx = isSlotAtPoint(clientX, clientY);
    if (idx < 0) return false;
    if (slots[idx].elementId) return false;  // occupied
    fillSlot(idx, elementId);
    return true;
  }

  function fillSlot(i, elementId) {
    const s = slots[i];
    const el = State.state.byId.get(elementId);
    if (!el) return;
    s.elementId = elementId;
    s.node.classList.remove('empty');
    s.node.classList.add('filled');
    // Restart the fill-pulse animation by reflow
    s.node.style.animation = 'none';
    s.node.offsetHeight;
    s.node.style.animation = '';
    s.content.innerHTML = '';
    const icon = Icons.buildIcon(el);
    icon.classList.add('slot-icon');
    const name = document.createElement('div');
    name.className = 'slot-name';
    name.textContent = el.name;
    s.content.appendChild(icon);
    s.content.appendChild(name);
    fadeHint();
    updateCrucibleReady();
    if (allFilled()) {
      // Brief delay so the player sees their last drop register.
      setTimeout(brew, 280);
    }
  }

  function clearSlot(i) {
    const s = slots[i];
    s.elementId = null;
    s.node.classList.remove('filled');
    s.node.classList.add('empty');
    s.content.innerHTML = '';
    updateCrucibleReady();
  }

  // The crucible glows + becomes clickable once 2+ slots are filled but the
  // board hasn't auto-fired yet. This lets the player brew pair recipes at
  // higher ranks without filling all visible slots.
  function updateCrucibleReady() {
    if (!crucibleEl) return;
    const filled = slots.filter(s => s.elementId).length;
    const ready = filled >= 2 && filled < slots.length && !combining;
    crucibleEl.classList.toggle('ready', ready);
  }

  function clearAllSlots() {
    for (let i = 0; i < slots.length; i++) clearSlot(i);
  }

  function allFilled() {
    return slots.length > 0 && slots.every(s => s.elementId);
  }

  // --- Brewing --------------------------------------------------------------
  function brew() {
    if (combining) return;
    const filledCount = slots.filter(s => s.elementId).length;
    if (filledCount < 2) return;
    combining = true;
    boardEl.classList.add('brewing');
    if (crucibleEl) crucibleEl.classList.remove('ready');

    // 1. Ignite only the channels whose slot is filled. Empty slots stay dark.
    const allPaths = [...channelsEl.querySelectorAll('path')];
    const filledPaths = allPaths.filter(p => {
      const idx = Number(p.dataset.slot);
      return slots[idx] && slots[idx].elementId;
    });
    for (let i = 0; i < filledPaths.length; i++) {
      setTimeout(() => filledPaths[i].classList.add('ignited'), i * 90);
    }

    // 2. After channels finish racing around the crucible, resolve and reveal.
    const channelMs = 1100 + Math.max(0, filledPaths.length - 1) * 90;
    setTimeout(() => resolveCombination(), channelMs);
  }

  function resolveCombination() {
    const ids = slots.map(s => s.elementId).filter(Boolean);
    const result = computeCombination(ids);

    if (!result) {
      onFailure();
      return;
    }
    onSuccess(result);
  }

  function computeCombination(ids) {
    if (ids.length < 2) return null;
    // 2-input: direct recipe lookup.
    if (ids.length === 2) {
      return Recipes.combine(ids[0], ids[1], State.state.recipes);
    }
    // 3+ inputs: try special multi-recipe table first, then fall back to
    // sequential pair resolution (left to right).
    if (typeof MultiRecipes !== 'undefined') {
      const multi = MultiRecipes.combine(ids);
      if (multi) return multi;
    }
    let acc = Recipes.combine(ids[0], ids[1], State.state.recipes);
    if (!acc) return null;
    for (let i = 2; i < ids.length; i++) {
      acc = Recipes.combine(acc, ids[i], State.state.recipes);
      if (!acc) return null;
    }
    return acc;
  }

  function onSuccess(resultId) {
    const el = State.state.byId.get(resultId);
    if (!el) { onFailure(); return; }

    const cRect = crucibleEl.getBoundingClientRect();
    const boardRect = boardEl.getBoundingClientRect();
    const cx = cRect.left + cRect.width / 2 - boardRect.left;
    const cy = cRect.top  + cRect.height / 2 - boardRect.top;

    // CINEMATIC BEAT 1: every sigil line briefly ignites bright gold —
    // the whole inscribed figure pulsing in unison.
    if (sigilEl) {
      sigilEl.classList.add('flash');
      setTimeout(() => sigilEl.classList.remove('flash'), 1500);
    }

    // CINEMATIC BEAT 2: pillar beams fire back out from the crucible toward
    // each slot that contributed to the brew — energy returning to its source.
    const burst = document.createElement('div');
    burst.className = 'success-pillar-burst';
    burst.style.left = cx + 'px';
    burst.style.top  = cy + 'px';

    const boardRect2 = boardEl.getBoundingClientRect();
    const filledSlotCenters = slots
      .filter(s => s.elementId)
      .map(s => {
        const r = s.node.getBoundingClientRect();
        return {
          x: r.left + r.width / 2 - boardRect2.left,
          y: r.top  + r.height / 2 - boardRect2.top,
        };
      });

    for (const sc of filledSlotCenters) {
      // Rotation R for our beam (default extends downward from origin) such
      // that the beam-tip direction (-sin R, cos R) points toward the slot.
      const angleDeg = Math.atan2(cx - sc.x, sc.y - cy) * 180 / Math.PI;
      const beam = document.createElement('div');
      beam.className = 'pillar-beam';
      beam.style.transform = 'rotate(' + angleDeg + 'deg)';
      burst.appendChild(beam);
    }
    sparksEl.appendChild(burst);
    setTimeout(() => burst.remove(), 1800);

    // CINEMATIC BEAT 3: radial shockwave rings expanding outward.
    for (let i = 0; i < 2; i++) {
      const ring = document.createElement('div');
      ring.className = 'success-shockwave';
      ring.style.left = cx + 'px';
      ring.style.top  = cy + 'px';
      ring.style.animationDelay = (i * 200) + 'ms';
      sparksEl.appendChild(ring);
      setTimeout(() => ring.remove(), 1600 + i * 200);
    }

    // Sparks burst from the crucible (existing beat).
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
      const dist  = 80 + Math.random() * 50;
      const s = document.createElement('div');
      s.className = 'sparkle';
      s.style.left = (cx - 2) + 'px';
      s.style.top  = (cy - 2) + 'px';
      s.style.setProperty('--dx', (Math.cos(angle) * dist) + 'px');
      s.style.setProperty('--dy', (Math.sin(angle) * dist) + 'px');
      sparksEl.appendChild(s);
      setTimeout(() => s.remove(), 1000);
    }

    // Result rises from the crucible.
    resultEl.innerHTML = '';
    const icon = Icons.buildIcon(el);
    const name = document.createElement('div');
    name.className = 'result-name';
    name.textContent = el.name;
    resultEl.appendChild(icon);
    resultEl.appendChild(name);
    resultEl.classList.remove('hidden', 'fading');
    void resultEl.offsetWidth;
    resultEl.classList.add('rising');

    // Burn the true name across the top of the board.
    const wasNew = !State.isDiscovered(resultId);
    showName(el.name, wasNew);

    // Mark discovered (fires sidebar + progress listeners).
    State.discover(resultId);

    // Cleanup after the show.
    clearTimeout(revealTimer);
    revealTimer = setTimeout(finishCombination, 3800);
  }

  function onFailure() {
    boardEl.classList.add('fizzling');
    const cRect = crucibleEl.getBoundingClientRect();
    const boardRect = boardEl.getBoundingClientRect();
    const cx = cRect.left + cRect.width / 2 - boardRect.left;
    const cy = cRect.top  + cRect.height / 2 - boardRect.top;

    // 1. Big plume of smoke — 14 puffs at varying sizes, rising and drifting.
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('div');
      s.className = 'smoke';
      const size = 40 + Math.random() * 60;
      s.style.width  = size + 'px';
      s.style.height = size + 'px';
      s.style.left = (cx - size / 2 + (Math.random() - 0.5) * 70) + 'px';
      s.style.top  = (cy - size / 2 + (Math.random() - 0.5) * 30) + 'px';
      s.style.setProperty('--dx', ((Math.random() - 0.5) * 140) + 'px');
      s.style.setProperty('--dy', (-90 - Math.random() * 80) + 'px');
      s.style.setProperty('--end-scale', (1.4 + Math.random() * 1.4).toFixed(2));
      s.style.animationDuration = (1.4 + Math.random() * 0.6).toFixed(2) + 's';
      s.style.animationDelay = (Math.random() * 0.18).toFixed(2) + 's';
      sparksEl.appendChild(s);
      setTimeout(() => s.remove(), 2500);
    }

    // 2. Dark embers — small grey-black flecks scattering outward briefly.
    for (let i = 0; i < 10; i++) {
      const e = document.createElement('div');
      e.className = 'fail-ember';
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
      const dist  = 60 + Math.random() * 70;
      e.style.left = (cx - 3) + 'px';
      e.style.top  = (cy - 3) + 'px';
      e.style.setProperty('--dx', (Math.cos(angle) * dist) + 'px');
      e.style.setProperty('--dy', (Math.sin(angle) * dist) + 'px');
      sparksEl.appendChild(e);
      setTimeout(() => e.remove(), 1200);
    }

    // 3. Shake the filled slots like a flask that just slammed.
    for (const s of slots) if (s.elementId) s.node.classList.add('fail-shake');

    // 4. Slightly stutter the whole board for a beat.
    boardEl.classList.add('fail-jolt');
    setTimeout(() => boardEl.classList.remove('fail-jolt'), 450);

    setTimeout(finishCombination, 1800);
  }

  function finishCombination() {
    // Clear board state.
    boardEl.classList.remove('brewing', 'fizzling', 'fail-jolt');
    for (const path of channelsEl.querySelectorAll('path.ignited')) path.classList.remove('ignited');
    for (const s of slots) s.node.classList.remove('fail-shake');
    resultEl.classList.add('fading');
    setTimeout(() => {
      resultEl.classList.add('hidden');
      resultEl.classList.remove('rising', 'fading');
    }, 600);
    clearAllSlots();
    combining = false;
    updateCrucibleReady();
  }

  // --- Name burn-in --------------------------------------------------------
  function showName(text, isNew) {
    nameEl.textContent = text.toUpperCase();
    nameEl.classList.remove('burning');
    void nameEl.offsetWidth;
    nameEl.classList.add('burning');

    subEl.textContent = isNew ? 'newly discovered' : '';
    subEl.classList.remove('burning');
    void subEl.offsetWidth;
    if (isNew) subEl.classList.add('burning');
  }

  // --- Helpers --------------------------------------------------------------
  function fadeHint() {
    if (!hintEl) return;
    hintEl.classList.add('faded');
  }
  function updateHint() {
    if (!hintEl) return;
    const words = { 2: 'two', 3: 'three', 4: 'four', 5: 'five' };
    hintEl.textContent = 'Drag ' + (words[slotCount] || slotCount) + ' elements into the circle.';
    hintEl.classList.remove('faded');
  }

  function isCombining() { return combining; }

  // --- Rank-driven slot count + unlock cutscene -----------------------------
  function setSlotCountForRank(rankSlug) {
    const target = SLOT_COUNT_FOR_RANK[rankSlug] || 2;
    if (target === slotCount) return false;
    const growing = target > slotCount;
    if (growing) {
      // Defer the slot expansion so the rank-up banner gets a moment to play,
      // then run the cutscene which itself triggers rebuildSlots(target).
      setTimeout(() => playSlotUnlockCutscene(slotCount, target), 1100);
    } else {
      rebuildSlots(target);
    }
    return true;
  }

  function playSlotUnlockCutscene(from, to) {
    const overlay = document.createElement('div');
    overlay.className = 'slot-unlock-cutscene';
    overlay.innerHTML =
      '<div class="suc-rays" aria-hidden="true"></div>' +
      '<div class="suc-glyph" aria-hidden="true">⚗</div>' +
      '<h2 class="suc-title">Your circle widens</h2>' +
      '<p class="suc-subtitle">A new vessel forms — bind <strong>' + to + '</strong> elements at once.</p>' +
      '<div class="suc-preview" aria-hidden="true">' + buildPreviewMarkup(to) + '</div>' +
      '<p class="suc-dismiss">tap anywhere</p>';
    document.body.appendChild(overlay);

    // Reveal preview slots one by one, with the new one(s) flashing in last.
    requestAnimationFrame(() => {
      overlay.classList.add('show');
      const previewSlots = overlay.querySelectorAll('.suc-preview .suc-slot');
      for (let i = 0; i < previewSlots.length; i++) {
        const isNew = i >= from;
        setTimeout(() => {
          previewSlots[i].classList.add('appear');
          if (isNew) previewSlots[i].classList.add('new');
        }, 700 + i * 250);
      }
    });

    function dismiss() {
      overlay.removeEventListener('click', dismiss);
      overlay.classList.add('hide');
      // Once the overlay starts fading, actually grow the live board too.
      rebuildSlots(to);
      // Animate the new slots in on the live board.
      requestAnimationFrame(() => {
        const liveSlots = document.querySelectorAll('#slots .slot');
        for (let i = from; i < liveSlots.length; i++) liveSlots[i].classList.add('appearing');
      });
      setTimeout(() => overlay.remove(), 600);
      // The first time the player reaches Adept (3 slots), introduce the
      // tap-to-brew mechanic with a short lesson.
      if (to === 3 && window.Tutorial && Tutorial.onAdeptUnlocked) {
        Tutorial.onAdeptUnlocked();
      }
    }
    overlay.addEventListener('click', dismiss);
    // Auto-dismiss after 4 seconds so the player doesn't have to interact.
    setTimeout(dismiss, 4200);
  }

  function buildPreviewMarkup(count) {
    let out = '';
    for (let i = 0; i < count; i++) out += '<div class="suc-slot"></div>';
    return out;
  }

  global.Circle = {
    init,
    rebuildSlots,
    setSlotCountForRank,
    previewSlotAt,
    clearSlotHovers,
    tryFillFromDrop,
    isCombining,
  };
})(window);
