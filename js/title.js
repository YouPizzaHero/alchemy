// Title screen — sits above the workspace on first load. Player chooses
// to enter; we then fade out and (if it's a first run) trigger the
// tutorial. Settings + About open their existing modals from here so the
// player can configure before committing to a session.
//
// Z-index sits below the Pizza Hero Gaming splash, so the splash plays
// on top first and dismisses, revealing the title screen waiting behind.
(function (global) {
  'use strict';

  let titleEl, enterBtn, welcomeEl, settingsBtn, aboutBtn;
  let onEnterCallback = null;

  function init() {
    titleEl     = document.getElementById('title-screen');
    if (!titleEl) return;
    enterBtn    = document.getElementById('title-enter');
    welcomeEl   = document.getElementById('title-welcome');
    settingsBtn = document.getElementById('title-settings');
    aboutBtn    = document.getElementById('title-about');

    if (enterBtn)    enterBtn.addEventListener('click', dismiss);
    if (settingsBtn) settingsBtn.addEventListener('click', () => openModal('settings-modal'));
    if (aboutBtn)    aboutBtn.addEventListener('click',    () => openModal('about-modal'));

    // Enter / Space accept the primary CTA, but only when no modal is
    // open on top (so Settings → Esc → still on title screen → space
    // doesn't accidentally enter).
    document.addEventListener('keydown', (e) => {
      if (titleEl.classList.contains('hidden')) return;
      if (anyModalOpen()) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dismiss();
      }
    });

    spawnEmbers();
  }

  // Two-step entrance so we can cross-fade with the Pizza Hero Gaming
  // splash: show() mounts the title screen with an opaque dark backdrop
  // but the foreground content stays at opacity:0. revealContent() then
  // adds .visible to fade the title text in. The caller drives the
  // timing — typically wiring it to PHG's onDismiss callback so the
  // title blooms in as the splash fades out.
  function show(onEnter) {
    if (!titleEl) return;
    onEnterCallback = onEnter || null;
    updateWelcome();
    titleEl.classList.remove('hidden', 'leaving', 'visible');
  }

  function revealContent() {
    if (!titleEl) return;
    // Defer one frame so the CSS transition actually fires from the
    // current (opacity:0) state.
    requestAnimationFrame(() => titleEl.classList.add('visible'));
  }

  function updateWelcome() {
    if (!welcomeEl || !window.State) return;
    welcomeEl.innerHTML = '';
    const total = State.state.totalElements || 1;
    const found = State.state.discovered.size;
    // A "fresh save" has only the 4 base elements auto-seeded. Anything
    // beyond that means the player has actually been making things.
    const startedJourney = found > 4;
    if (!startedJourney) {
      const line = document.createElement('span');
      line.className = 'title-welcome-line';
      line.textContent = 'Your circle is empty. Begin the Work.';
      welcomeEl.appendChild(line);
      return;
    }
    const ratio = found / total;
    const rank  = window.Ranks ? Ranks.forRatio(ratio) : { title: 'Initiate' };
    const line  = document.createElement('span');
    line.className = 'title-welcome-line';
    line.textContent = 'Welcome back, ' + rank.title + '.';
    const stats = document.createElement('span');
    stats.className = 'title-welcome-stats';
    stats.textContent = found + ' / ' + total + ' discovered';
    welcomeEl.appendChild(line);
    welcomeEl.appendChild(stats);
  }

  function dismiss() {
    if (!titleEl || titleEl.classList.contains('hidden')) return;
    titleEl.classList.add('leaving');
    // Match the CSS leaving transition (1s for the cinematic dissolve).
    setTimeout(() => {
      titleEl.classList.add('hidden');
      titleEl.classList.remove('leaving', 'visible');
      if (typeof onEnterCallback === 'function') {
        const cb = onEnterCallback;
        onEnterCallback = null;
        cb();
      }
    }, 1000);
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('hidden');
  }

  function anyModalOpen() {
    return !!document.querySelector('.modal:not(.hidden)');
  }

  // Drift up ~18 ember particles behind the title text. Pure CSS once
  // we set the per-particle variables.
  function spawnEmbers() {
    const container = titleEl.querySelector('.title-embers');
    if (!container) return;
    for (let i = 0; i < 18; i++) {
      const e = document.createElement('div');
      e.className = 'title-ember';
      e.style.left = (Math.random() * 100) + '%';
      e.style.setProperty('--dur',   (8 + Math.random() * 8).toFixed(1) + 's');
      e.style.setProperty('--delay', (Math.random() * -16).toFixed(1) + 's');
      e.style.setProperty('--drift', ((Math.random() - 0.5) * 60).toFixed(0) + 'px');
      e.style.setProperty('--size',  (3 + Math.random() * 5).toFixed(1) + 'px');
      container.appendChild(e);
    }
  }

  global.TitleScreen = { init, show, revealContent, dismiss };
})(window);
