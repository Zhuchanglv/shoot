/* =========================================================================
 * PIXEL SHOOTER — waves.js
 * 波次编排：每一波返回一串带时间戳的“编队事件”，由 GameScene 执行。
 * 难度随波数递增，每 BOSS_EVERY 波出现 Boss。
 * ========================================================================= */
(function () {
  'use strict';

  var CFG = window.CFG;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rint(a, b) { return Math.floor(rnd(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /** 难度系数包 */
  function diff(wave) {
    var d = CFG.DIFF;
    return {
      hp: 1 + (wave - 1) * d.hpPerWave,
      speed: Math.min(1.9, 1 + (wave - 1) * d.speedPerWave),
      fire: 1 + (wave - 1) * d.firePerWave
    };
  }

  /* ---------------------------------------------------------------------
   * 编队：每个函数返回事件数组 {t, kind, opts}
   * ------------------------------------------------------------------- */
  function row(wave, d) {
    var n = Math.min(7, 3 + Math.floor(wave / 2));
    var gap = (CFG.W - 80) / Math.max(1, n - 1);
    var events = [];
    for (var i = 0; i < n; i++) {
      events.push({ t: 0.35 + i * 0.07, kind: 'small', opts: { x: 40 + gap * i, y: -16, pattern: 'sine', sineAmp: rnd(10, 26), sineFreq: rnd(1.4, 2.6), diff: d } });
    }
    return events;
  }

  function stream(wave, d) {
    var n = Math.min(8, 4 + Math.floor(wave / 2));
    var x = pick([54, CFG.W - 54, CFG.W * 0.5]);
    var events = [];
    for (var i = 0; i < n; i++) {
      events.push({ t: 0.3 + i * 0.22, kind: Math.random() < 0.4 ? 'small2' : 'small', opts: { x: x, y: -16, pattern: 'straight', diff: d } });
    }
    return events;
  }

  function vForm(wave, d) {
    var n = Math.min(7, 3 + Math.floor(wave / 3));
    var events = [];
    for (var i = 0; i < n; i++) {
      var side = i % 2 === 0 ? 1 : -1;
      events.push({
        t: 0.35 + i * 0.12,
        kind: i === 0 ? 'small2' : 'small',
        opts: { x: CFG.W * 0.5 + side * (30 + i * 22), y: -16 - i * 8, pattern: 'converge', targetX: CFG.W * 0.5, diff: d }
      });
    }
    return events;
  }

  function divers(wave, d) {
    var n = Math.min(6, 2 + Math.floor(wave / 3));
    var events = [];
    for (var i = 0; i < n; i++) {
      events.push({ t: 0.35 + i * 0.34, kind: 'small2', opts: { x: rnd(40, CFG.W - 40), y: -16, pattern: 'dive', diff: d } });
    }
    return events;
  }

  function gunners(wave, d) {
    var n = wave >= 8 ? 2 : 1;
    var events = [];
    for (var i = 0; i < n; i++) {
      events.push({
        t: 0.5 + i * 0.7,
        kind: 'med',
        opts: { x: rnd(60, CFG.W - 60), y: -24, pattern: 'turret', holdY: rnd(90, 170), drift: Math.random() < 0.5 ? -1 : 1, diff: d }
      });
    }
    return events;
  }

  function heavies(wave, d) {
    var n = wave >= 12 ? 2 : 1;
    var events = [];
    for (var i = 0; i < n; i++) {
      events.push({ t: 0.6 + i * 1.0, kind: 'large', opts: { x: CFG.W * (0.32 + 0.36 * i), y: -32, pattern: 'heavy', diff: d } });
    }
    return events;
  }

  var FORMATIONS = {
    row: row,
    stream: stream,
    vform: vForm,
    divers: divers,
    gunners: gunners,
    heavies: heavies
  };

  /**
   * 生成一波：返回 {boss:boolean, events:[]}
   */
  function build(wave) {
    var d = diff(wave);

    if (wave % CFG.BOSS_EVERY === 0) {
      var bossIndex = Math.floor(wave / CFG.BOSS_EVERY);
      return { boss: true, bossIndex: bossIndex, bossHp: 320 + (bossIndex - 1) * 220, events: [] };
    }

    // 波数越高，编队越多、越凶
    var pool = ['row', 'stream'];
    if (wave >= 2) pool.push('vform');
    if (wave >= 3) pool.push('divers');
    if (wave >= 4) pool.push('gunners');
    if (wave >= 6) pool.push('heavies');

    var count = Math.min(4, 1 + Math.floor(wave / 2));
    var events = [];
    var t = 0;
    for (var i = 0; i < count; i++) {
      var key = pick(pool);
      // 不连续两次抽同一个
      var tries = 0;
      while (key === events._last && tries < 4) { key = pick(pool); tries++; }
      events._last = key;
      var batch = FORMATIONS[key](wave, d);
      for (var j = 0; j < batch.length; j++) {
        batch[j].t += t;
        events.push(batch[j]);
      }
      t += rnd(2.4, 3.6);
    }
    delete events._last;
    return { boss: false, events: events, duration: t };
  }

  window.Waves = { build: build, diff: diff, FORMATIONS: FORMATIONS };
})();
