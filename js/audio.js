/*
 * js/audio.js
 * Dependency-free 8-bit / chiptune sound engine for a Phaser 3 mobile game.
 * Classic <script> tag. Defines global `window.Synth` (and a global `var Synth`).
 * No imports, no require, no external files.
 */
var Synth;

(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Module state
  // ---------------------------------------------------------------------------
  var AudioCtxCtor = global.AudioContext || global.webkitAudioContext || null;

  var ctx = null;
  var masterGain = null; // all audio -> destination
  var sfxGain = null;    // sound effects -> master
  var musicGain = null;  // background music -> master
  var noiseBuffer = null;
  var pulseWave = null;      // 25% duty pulse wave (for lead)
  var pulseWaveReady = false;

  var muted = false;

  var MASTER_VOLUME = 1.0;
  var SFX_VOLUME = 1.0;
  var MUSIC_VOLUME = 0.35;

  // Hard cap on simultaneous SFX voices.
  var MAX_VOICES = 24;
  var voices = 0;

  // ---------------------------------------------------------------------------
  // Small utilities
  // ---------------------------------------------------------------------------
  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // Context exists and is producing sound (used for the sequencer).
  function ctxRunning() {
    if (!ctx) return false;
    var st = ctx.state;
    if (st === 'suspended' || st === 'closed') return false;
    return true;
  }

  // Fully ready to play a one-shot SFX: running context and not muted.
  function ready() {
    if (muted) return false;
    return ctxRunning();
  }

  function acquireVoice() {
    if (voices >= MAX_VOICES) return false;
    voices++;
    return true;
  }

  // Release a voice when its source node ends. A safety net prevents the
  // counter from leaking if `onended` never fires.
  function releaseVoice(node) {
    var released = false;
    function done() {
      if (released) return;
      released = true;
      if (voices > 0) voices--;
    }
    try {
      node.onended = done;
    } catch (e) { /* ignore */ }
    try {
      global.setTimeout(done, 3000);
    } catch (e2) { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------
  function createNoiseBuffer() {
    var len = Math.max(1, Math.floor(ctx.sampleRate * 1.0));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  function createPulseWave(duty) {
    // Build a band-limited pulse via Fourier series.
    var n = 32;
    var real = new Float32Array(n);
    var imag = new Float32Array(n);
    for (var i = 1; i < n; i++) {
      imag[i] = (2 / (i * Math.PI)) * Math.sin(Math.PI * i * duty);
    }
    try {
      return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    } catch (e) {
      try {
        return ctx.createPeriodicWave(real, imag);
      } catch (e2) {
        return null;
      }
    }
  }

  function init() {
    if (!AudioCtxCtor) return null;

    if (ctx) {
      if (ctx.state === 'suspended' && ctx.resume) {
        try { ctx.resume(); } catch (e) { /* ignore */ }
      }
      return ctx;
    }

    try {
      ctx = new AudioCtxCtor();
    } catch (e) {
      ctx = null;
      return null;
    }

    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : MASTER_VOLUME;
    masterGain.connect(ctx.destination);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = SFX_VOLUME;
    sfxGain.connect(masterGain);

    musicGain = ctx.createGain();
    musicGain.gain.value = MUSIC_VOLUME;
    musicGain.connect(masterGain);

    noiseBuffer = createNoiseBuffer();

    pulseWave = createPulseWave(0.25); // 25% duty square-ish pulse
    pulseWaveReady = !!pulseWave;

    return ctx;
  }

  function unlock() {
    var c = init();
    if (!c) return;
    try {
      if (c.state === 'suspended' && c.resume) {
        var p = c.resume();
        if (p && typeof p.catch === 'function') {
          p.catch(function () { /* ignore */ });
        }
      }
    } catch (e) { /* ignore */ }
  }

  function setMuted(bool) {
    muted = !!bool;
    if (!masterGain || !ctx) return;
    try {
      var t = ctx.currentTime;
      var g = masterGain.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(muted ? 0 : MASTER_VOLUME, t + 0.02);
    } catch (e) {
      try { masterGain.gain.value = muted ? 0 : MASTER_VOLUME; } catch (e2) { /* ignore */ }
    }
  }

  function isMuted() {
    return muted;
  }

  // ---------------------------------------------------------------------------
  // Node factories
  // ---------------------------------------------------------------------------
  function noiseSource() {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    return src;
  }

  // ---------------------------------------------------------------------------
  // SFX
  // ---------------------------------------------------------------------------

  // Very short laser: pitch sweeps ~1400 -> ~500 Hz. Higher level => higher pitch.
  function shoot(level) {
    if (!ready() || !acquireVoice()) return;
    var t = ctx.currentTime;
    var lv = level || 1;
    if (lv < 1) lv = 1;
    if (lv > 5) lv = 5;
    var hi = 1400 + (lv - 1) * 120;
    var lo = 500 + (lv - 1) * 60;

    var osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(hi, t);
    osc.frequency.exponentialRampToValueAtTime(lo, t + 0.05);

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);

    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + 0.06);
    releaseVoice(osc);
  }

  // Quiet downward blip around 300 Hz.
  function enemyShoot() {
    if (!ready() || !acquireVoice()) return;
    var t = ctx.currentTime;

    var osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.08);

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.04, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + 0.1);
    releaseVoice(osc);
  }

  // Tiny click for a bullet landing on an enemy.
  function hit() {
    if (!ready() || !acquireVoice()) return;
    var t = ctx.currentTime;
    var dur = 0.04;

    var src = noiseSource();
    var filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(2200, t);
    filt.Q.value = 1.0;

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filt);
    filt.connect(g);
    g.connect(sfxGain);
    src.start(t);
    src.stop(t + dur + 0.01);
    releaseVoice(src);
  }

  // Filtered noise burst + (for big ones) a low sine thump.
  // size 0..1 (small enemy .. boss).
  function explosion(size) {
    if (!ready() || !acquireVoice()) return;
    var t = ctx.currentTime;
    var s = (typeof size === 'number') ? size : 0.3;
    if (s < 0) s = 0;
    if (s > 1) s = 1;

    var dur = 0.25 + s * 0.75;

    var src = noiseSource();
    var filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(2000 - s * 900, t);
    filt.frequency.exponentialRampToValueAtTime(120, t + dur);
    filt.Q.value = 0.8;

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25 + s * 0.5, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filt);
    filt.connect(g);
    g.connect(sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
    releaseVoice(src);

    if (s > 0.35 && acquireVoice()) {
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(140 - s * 40, t);
      o.frequency.exponentialRampToValueAtTime(40, t + dur * 0.8);

      var og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.35 * s, t + 0.02);
      og.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.9);

      o.connect(og);
      og.connect(sfxGain);
      o.start(t);
      o.stop(t + dur);
      releaseVoice(o);
    }
  }

  // Cheerful ascending arpeggio, C5 - E5 - G5 (~0.25 s total).
  function pickup() {
    if (!ready() || !acquireVoice()) return;
    var t = ctx.currentTime;
    var seq = [523.25, 659.25, 783.99];
    var step = 0.08;

    var osc = ctx.createOscillator();
    osc.type = 'square';
    for (var i = 0; i < seq.length; i++) {
      osc.frequency.setValueAtTime(seq[i], t + i * step);
    }

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.setValueAtTime(0.12, t + seq.length * step - 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seq.length * step + 0.05);

    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + seq.length * step + 0.07);
    releaseVoice(osc);
  }

  // Dramatic descending sweep + noise, ~0.8 s.
  function bomb() {
    if (!ready() || !acquireVoice()) return;
    var t = ctx.currentTime;
    var dur = 0.8;

    var o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(1200, t);
    o.frequency.exponentialRampToValueAtTime(45, t + dur * 0.85);

    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4000, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + dur);

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    o.connect(lp);
    lp.connect(g);
    g.connect(sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
    releaseVoice(o);

    if (acquireVoice()) {
      var n = noiseSource();
      var nf = ctx.createBiquadFilter();
      nf.type = 'lowpass';
      nf.frequency.setValueAtTime(3000, t);
      nf.frequency.exponentialRampToValueAtTime(200, t + dur);

      var ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t);
      ng.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      n.connect(nf);
      nf.connect(ng);
      ng.connect(sfxGain);
      n.start(t);
      n.stop(t + dur + 0.02);
      releaseVoice(n);
    }
  }

  // Three short low siren beeps.
  function bossWarn() {
    if (!ready() || !acquireVoice()) return;
    var t = ctx.currentTime;
    var beep = 0.2;
    var gap = 0.1;
    var base = 220;

    var osc = ctx.createOscillator();
    osc.type = 'sawtooth';

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);

    for (var i = 0; i < 3; i++) {
      var s = t + i * (beep + gap);
      osc.frequency.setValueAtTime(base, s);
      osc.frequency.linearRampToValueAtTime(base * 1.5, s + beep * 0.5);
      osc.frequency.linearRampToValueAtTime(base, s + beep);

      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.18, s + 0.012);
      g.gain.setValueAtTime(0.18, s + beep - 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, s + beep - 0.005);
    }

    osc.connect(g);
    g.connect(sfxGain);
    var end = t + 3 * (beep + gap) + 0.05;
    osc.start(t);
    osc.stop(end);
    releaseVoice(osc);
  }

  // Descending sad arpeggio then a low tone, ~1.2 s.
  function gameOver() {
    if (!ready() || !acquireVoice()) return;
    var t = ctx.currentTime;
    var seq = [659.25, 587.33, 523.25, 440.00]; // E5 D5 C5 A4
    var step = 0.2;

    var o = ctx.createOscillator();
    o.type = 'triangle';

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);

    for (var i = 0; i < seq.length; i++) {
      var s = t + i * step;
      o.frequency.setValueAtTime(seq[i], s);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.16, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + step * 0.95);
    }

    var lowStart = t + seq.length * step;
    o.frequency.setValueAtTime(110, lowStart);
    g.gain.setValueAtTime(0.0001, lowStart);
    g.gain.exponentialRampToValueAtTime(0.2, lowStart + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, lowStart + 0.35);

    var end = lowStart + 0.4;
    o.connect(g);
    g.connect(sfxGain);
    o.start(t);
    o.stop(end + 0.02);
    releaseVoice(o);
  }

  // ---------------------------------------------------------------------------
  // Background music: 16-step look-ahead sequencer
  // ---------------------------------------------------------------------------
  var BPM = 132;
  var STEPS = 16;

  // Driving square bass (MIDI). A minor: Am - F - G - A.
  var bassSteps = [
    45, 45, 57, 45, // A2 A2 A3 A2
    41, 41, 53, 41, // F2 F2 F3 F2
    43, 43, 55, 43, // G2 G2 G3 G2
    45, 45, 52, 45  // A2 A2 E3 A2
  ];

  // Pulse-wave lead / arpeggio (MIDI), A minor / minor pentatonic flavour.
  var leadSteps = [
    69, 72, 76, 72, // A4 C5 E5 C5
    65, 69, 72, 69, // F4 A4 C5 A4
    67, 71, 74, 71, // G4 B4 D5 B4
    69, 72, 76, 79  // A4 C5 E5 G5
  ];

  var bgm = {
    playing: false,
    timer: null,
    step: 0,
    nextTime: 0,
    stepDur: 0,
    nodes: [] // currently scheduled music sources (pruned on 'ended')
  };

  function trackMusicNode(node) {
    bgm.nodes.push(node);
    node.onended = function () {
      var i = bgm.nodes.indexOf(node);
      if (i >= 0) bgm.nodes.splice(i, 1);
    };
  }

  function scheduleStep(step, t) {
    if (!ctx) return;

    // Bass line.
    var bNote = bassSteps[step];
    if (bNote > 0) {
      var bo = ctx.createOscillator();
      bo.type = 'square';
      bo.frequency.setValueAtTime(midiToFreq(bNote), t);

      var bg = ctx.createGain();
      bg.gain.setValueAtTime(0.0001, t);
      bg.gain.exponentialRampToValueAtTime(0.30, t + 0.008);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + bgm.stepDur * 0.9);

      bo.connect(bg);
      bg.connect(musicGain);
      bo.start(t);
      bo.stop(t + bgm.stepDur);
      trackMusicNode(bo);
    }

    // Pulse-wave lead.
    var lNote = leadSteps[step];
    if (lNote > 0) {
      var lo = ctx.createOscillator();
      if (pulseWaveReady && pulseWave) {
        try { lo.setPeriodicWave(pulseWave); } catch (e) { lo.type = 'square'; }
      } else {
        lo.type = 'square';
      }
      lo.frequency.setValueAtTime(midiToFreq(lNote), t);

      var lg = ctx.createGain();
      lg.gain.setValueAtTime(0.0001, t);
      lg.gain.exponentialRampToValueAtTime(0.13, t + 0.006);
      lg.gain.exponentialRampToValueAtTime(0.0001, t + bgm.stepDur * 0.75);

      lo.connect(lg);
      lg.connect(musicGain);
      lo.start(t);
      lo.stop(t + bgm.stepDur);
      trackMusicNode(lo);
    }

    // Noise hi-hat on every other step.
    if (step % 2 === 1) {
      var h = ctx.createBufferSource();
      h.buffer = noiseBuffer;

      var hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7000;

      var hg = ctx.createGain();
      hg.gain.setValueAtTime(0.0001, t);
      hg.gain.exponentialRampToValueAtTime(0.06, t + 0.002);
      hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);

      h.connect(hp);
      hp.connect(hg);
      hg.connect(musicGain);
      h.start(t);
      h.stop(t + 0.05);
      trackMusicNode(h);
    }
  }

  function scheduler() {
    if (!bgm.playing || !ctx) return;
    var lookahead = 0.1;
    // Guard against runaway loops if the tab was suspended for a long time.
    var guard = 0;
    while (bgm.nextTime < ctx.currentTime + lookahead && guard < 64) {
      scheduleStep(bgm.step, bgm.nextTime);
      bgm.nextTime += bgm.stepDur;
      bgm.step = (bgm.step + 1) % STEPS;
      guard++;
    }
  }

  function startBgm() {
    init();
    if (!ctxRunning()) return;   // no-op when there is no usable context
    if (bgm.playing) return;      // restart-safe: never double-schedule

    bgm.playing = true;
    bgm.step = 0;
    bgm.stepDur = (60 / BPM) / 4; // 16th note
    bgm.nextTime = ctx.currentTime + 0.06;

    try {
      bgm.timer = global.setInterval(scheduler, 25);
    } catch (e) {
      bgm.timer = null;
      bgm.playing = false;
      return;
    }
    scheduler();
  }

  function stopBgm() {
    bgm.playing = false;
    if (bgm.timer !== null) {
      try { global.clearInterval(bgm.timer); } catch (e) { /* ignore */ }
      bgm.timer = null;
    }
    // Silence anything already scheduled.
    var list = bgm.nodes;
    for (var i = 0; i < list.length; i++) {
      try { list[i].stop(); } catch (e2) { /* ignore */ }
    }
    bgm.nodes = [];
  }

  // Temporarily lower the music volume (e.g. during a boss warning).
  function duckBgm(seconds) {
    if (!ctx || !musicGain) return;
    var d = (typeof seconds === 'number' && seconds > 0) ? seconds : 0.8;
    var t = ctx.currentTime;
    var target = MUSIC_VOLUME;
    try {
      var g = musicGain.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(target * 0.25, t + 0.05);
      g.setValueAtTime(target * 0.25, t + d);
      g.linearRampToValueAtTime(target, t + d + 0.25);
    } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  Synth = {
    init: init,
    unlock: unlock,
    setMuted: setMuted,
    isMuted: isMuted,
    shoot: shoot,
    enemyShoot: enemyShoot,
    hit: hit,
    explosion: explosion,
    pickup: pickup,
    bomb: bomb,
    bossWarn: bossWarn,
    gameOver: gameOver,
    startBgm: startBgm,
    stopBgm: stopBgm,
    duckBgm: duckBgm
  };

  global.Synth = Synth;
  if (typeof window !== 'undefined') {
    window.Synth = Synth;
  }
})(typeof window !== 'undefined' ? window : this);
