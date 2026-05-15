// Rewarded-ad bridge. On a Capacitor-wrapped build this calls into the
// native AndroidAds interface; on the web it shows a simulated rewarded
// ad so the flow can be tested without a wrapper. Callers pass a single
// callback that fires with `true` on success, `false` on cancel/fail.
//
// PC/Steam builds never invoke this — the caller is responsible for
// hiding any ad-CTA on non-mobile via `GameAds.isMobile()`.
//
// ============================================================
//  MASTER ENABLE FLAG
//  Flip ADS_ENABLED to true ONCE all of the following are ready:
//    1. Google AdMob account approved + payment info accepted.
//    2. Real rewarded ad unit IDs created for Android (and iOS).
//    3. @capacitor-community/admob installed in the wrapper project.
//    4. AdsInterface (Kotlin) bridge exposing window.AndroidAds.showRewarded.
//    5. `__onRewarded(success)` callback wired on the native side.
//  Until then, ADS_ENABLED=false hides the Hint button entirely so
//  testers never see an unfulfilled "Watch ad" promise.
// ============================================================
(function (global) {
  'use strict';

  // Single source of truth. Search the codebase for ADS_ENABLED when
  // turning ads on — there's only this one site to edit.
  const ADS_ENABLED = false;

  // Touch + UA + width detection. Cached after first call so it can't
  // flip mid-session (a dock or external monitor toggle would otherwise
  // race with already-mounted UI state).
  let _isMobileCached = null;
  function isMobile() {
    if (_isMobileCached !== null) return _isMobileCached;
    const ua = navigator.userAgent || '';
    const touch   = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const phoneUA = /Android|iPhone|iPod|iPad|Mobile/i.test(ua);
    const narrow  = window.innerWidth <= 900;
    _isMobileCached = touch && (phoneUA || narrow);
    return _isMobileCached;
  }

  function nativeAvailable() {
    return !!(window.AndroidAds && typeof window.AndroidAds.showRewarded === 'function');
  }

  // showRewarded(callback): callback(success) fires once.
  // On Capacitor builds we wait for window.__onRewarded(success) from the
  // native side. On the web we run the simulation directly.
  function showRewarded(callback) {
    if (nativeAvailable()) {
      window.__onRewarded = (success) => {
        window.__onRewarded = null;
        if (typeof callback === 'function') callback(!!success);
      };
      try { window.AndroidAds.showRewarded(); }
      catch (e) {
        window.__onRewarded = null;
        if (typeof callback === 'function') callback(false);
      }
      return;
    }
    simulateRewardedAd(callback);
  }

  function simulateRewardedAd(callback) {
    let done = false;
    function finish(success) {
      if (done) return;
      done = true;
      clearInterval(interval);
      overlay.remove();
      if (typeof callback === 'function') callback(success);
    }

    const overlay = document.createElement('div');
    overlay.className = 'fake-ad-overlay';
    overlay.innerHTML =
      '<div class="fake-ad-card">' +
        '<div class="fake-ad-label">Simulated rewarded ad</div>' +
        '<div class="fake-ad-art" aria-hidden="true">⚗</div>' +
        '<div class="fake-ad-count">Reward in <span class="fake-ad-num">5</span>s</div>' +
        '<button type="button" class="fake-ad-skip">Cancel</button>' +
      '</div>';
    document.body.appendChild(overlay);
    const numEl = overlay.querySelector('.fake-ad-num');
    let secondsLeft = 5;
    const interval = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0) { finish(true); return; }
      numEl.textContent = secondsLeft;
    }, 1000);
    overlay.querySelector('.fake-ad-skip').addEventListener('click', () => finish(false));
  }

  function adsEnabled() { return ADS_ENABLED; }

  global.GameAds = { isMobile, showRewarded, nativeAvailable, adsEnabled };
})(window);
