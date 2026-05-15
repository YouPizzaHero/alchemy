// Pizza Hero Gaming splash — extracted from src/splash/pizza-hero-splash.html
// Usage: PizzaHeroSplash.show({ onComplete: () => ... });
(function (global) {
  'use strict';

  const TITLE = 'PIZZA HERO';

  function buildLetters(text) {
    return text.split('').map((ch, i) => {
      const delay = (1.05 + i * 0.05).toFixed(2);
      if (ch === ' ') return '<span class="phs-space" style="animation-delay:' + delay + 's">&nbsp;</span>';
      return '<span style="animation-delay:' + delay + 's">' + ch + '</span>';
    }).join('');
  }

  function show(opts) {
    opts = opts || {};
    const duration    = opts.duration != null ? opts.duration : 3800;
    const skipOnInput = opts.skipOnInput !== false;
    const tagline     = opts.tagline || 'GAMING';
    const onComplete  = opts.onComplete || function () {};

    document.querySelectorAll('.phs-splash').forEach(el => el.remove());

    const splash = document.createElement('div');
    splash.className = 'phs-splash';
    splash.setAttribute('role', 'dialog');
    splash.setAttribute('aria-label', 'Pizza Hero Gaming intro');
    splash.innerHTML =
      '<div class="phs-rays" aria-hidden="true"></div>' +
      '<div class="phs-mark">PHG · MMXXVI</div>' +
      '<div class="phs-shockwave" aria-hidden="true"></div>' +
      '<h1 class="phs-title" aria-label="Pizza Hero">' + buildLetters(TITLE) + '</h1>' +
      '<p class="phs-tagline">' + tagline.split('').join(' ') + '</p>' +
      '<div class="phs-loader" aria-hidden="true"><div class="phs-loader-fill"></div></div>' +
      '<div class="phs-prompt">' + (skipOnInput ? 'Click or Press Any Key' : 'Loading…') + '</div>';
    document.body.appendChild(splash);

    setTimeout(() => splash.classList.add('phs-shake'), 1050);

    const onDismiss = opts.onDismiss || function () {};

    let dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      window.removeEventListener('keydown', onKey);
      splash.removeEventListener('click', onClick);
      splash.classList.add('phs-out');
      // Fire onDismiss the instant the fade-out begins so the caller
      // can cross-fade its next screen in during PHG's 1.1s exit.
      // onComplete still fires after the exit completes.
      try { onDismiss(); } catch (e) { console.error(e); }
      setTimeout(() => {
        splash.remove();
        try { onComplete(); } catch (e) { console.error(e); }
      }, 1100);
    }

    const onKey   = () => skipOnInput && dismiss();
    const onClick = () => skipOnInput && dismiss();

    if (skipOnInput) {
      window.addEventListener('keydown', onKey);
      splash.addEventListener('click', onClick);
    }
    if (duration > 0) setTimeout(dismiss, duration);

    return { dismiss };
  }

  global.PizzaHeroSplash = { show };
})(window);
