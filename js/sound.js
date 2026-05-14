// Procedural sound effects. All synthesised on the fly with Web Audio so
// the game ships zero audio assets. Sounds are short (<2s), tuned for the
// dark-alchemist atmosphere — chimes, hisses, swells, low thrums.
//
// Mute preference persists in localStorage. The AudioContext is created
// lazily on the first user interaction so we don't trip browser autoplay
// policies.
(function (global) {
  'use strict';

  const KEY_MUTED  = 'alchemy_muted';
  const KEY_VOLUME = 'alchemy_volume';

  let ctx = null;
  let masterGain = null;
  let muted = false;
  let volume = 0.5;

  function init() {
    try { muted  = localStorage.getItem(KEY_MUTED)  === '1'; } catch (e) {}
    try {
      const v = parseFloat(localStorage.getItem(KEY_VOLUME));
      if (!isNaN(v) && v >= 0 && v <= 1) volume = v;
    } catch (e) {}

    // Resume audio context on first user gesture (browsers require this).
    const arm = () => {
      ensureContext();
      document.removeEventListener('pointerdown', arm, true);
      document.removeEventListener('keydown', arm, true);
    };
    document.addEventListener('pointerdown', arm, true);
    document.addEventListener('keydown', arm, true);
  }

  function ensureContext() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    masterGain = ctx.createGain();
    masterGain.gain.value = volume;
    masterGain.connect(ctx.destination);
    return ctx;
  }

  function canPlay() { return !muted && ensureContext() !== null; }

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(KEY_MUTED, muted ? '1' : '0'); } catch (e) {}
  }
  function isMuted() { return muted; }
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (masterGain) masterGain.gain.value = volume;
    try { localStorage.setItem(KEY_VOLUME, String(volume)); } catch (e) {}
  }
  function getVolume() { return volume; }

  // ---- Helpers ------------------------------------------------------------
  // Build a short tone with an attack/decay envelope.
  function tone(freq, dur, opts) {
    if (!canPlay()) return;
    opts = opts || {};
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = opts.type || 'sine';
    if (opts.freqEnd != null) {
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), now + dur);
    } else {
      osc.frequency.value = freq;
    }
    const peak = (opts.peak != null ? opts.peak : 0.3);
    const attack = (opts.attack != null ? opts.attack : 0.008);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0005, now + dur);
    osc.connect(g).connect(masterGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  // Filtered white-noise burst.
  function noise(dur, opts) {
    if (!canPlay()) return;
    opts = opts || {};
    const now = ctx.currentTime;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType || 'bandpass';
    if (opts.freqStart != null && opts.freqEnd != null) {
      filter.frequency.setValueAtTime(opts.freqStart, now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), now + dur);
    } else {
      filter.frequency.value = opts.freq || 1000;
    }
    filter.Q.value = opts.Q || 1;
    const g = ctx.createGain();
    const peak = opts.peak != null ? opts.peak : 0.18;
    const attack = opts.attack != null ? opts.attack : 0.02;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak, now + attack);
    g.gain.linearRampToValueAtTime(0, now + dur);
    src.connect(filter).connect(g).connect(masterGain);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  // ---- Specific sounds ----------------------------------------------------

  // Element settles into a slot — short tonal clink.
  function slotFill() {
    tone(900, 0.18, { type: 'sine', freqEnd: 480, peak: 0.28, attack: 0.004 });
    tone(450, 0.22, { type: 'triangle', peak: 0.12, attack: 0.01 });
  }

  // Channels ignite — rising filtered whoosh.
  function channelIgnite() {
    noise(0.9, { filterType: 'bandpass', freqStart: 200, freqEnd: 2400, Q: 4, peak: 0.18 });
    tone(120, 0.5, { type: 'sine', peak: 0.08, attack: 0.04 });
  }

  // Successful brew — gold chime arpeggio.
  function brewSuccess() {
    if (!canPlay()) return;
    // C major arpeggio (C5 E5 G5 C6) staggered.
    const notes = [523.25, 659.25, 783.99, 1046.5];
    const now = ctx.currentTime;
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const start = now + i * 0.08;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.18, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0005, start + 1.2);
      osc.connect(g).connect(masterGain);
      osc.start(start);
      osc.stop(start + 1.3);
    });
    // Sub-bass thump for body
    tone(80, 1.4, { type: 'sine', peak: 0.16, attack: 0.04 });
  }

  // Failed brew — descending fizzle.
  function brewFail() {
    tone(220, 0.7, { type: 'sawtooth', freqEnd: 55, peak: 0.16, attack: 0.04 });
    noise(0.7, { filterType: 'lowpass', freq: 1200, peak: 0.12, attack: 0.05 });
  }

  // Rank up — celestial swell, big chord.
  function rankUp() {
    if (!canPlay()) return;
    const now = ctx.currentTime;
    const chord = [261.63, 329.63, 392.00, 523.25];   // C major
    chord.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.13, now + 0.4 + i * 0.04);
      g.gain.linearRampToValueAtTime(0, now + 2.2);
      osc.connect(g).connect(masterGain);
      osc.start(now);
      osc.stop(now + 2.3);
    });
    // Bell on top
    tone(1046.5, 1.6, { type: 'triangle', peak: 0.14, attack: 0.02 });
  }

  // Crucible tap — deep thrum.
  function tap() {
    tone(110, 0.32, { type: 'sine', peak: 0.16, attack: 0.018 });
    tone(220, 0.18, { type: 'sine', peak: 0.05, attack: 0.005 });
  }

  // UI click — soft tick.
  function ui() {
    tone(1400, 0.05, { type: 'sine', peak: 0.06, attack: 0.002 });
  }

  global.Sound = {
    init, ensureContext,
    setMuted, isMuted, setVolume, getVolume,
    slotFill, channelIgnite, brewSuccess, brewFail, rankUp, tap, ui,
  };
})(window);
