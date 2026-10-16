/* =========================================================================
 * PIXEL SHOOTER — config.js
 * 全局常量 / 数值调参 / 配色。所有场景从这里取值，方便统一改平衡性。
 * ========================================================================= */
(function () {
  'use strict';

  /**
   * 设计分辨率：宽固定 360（像素风基准），高度按屏幕比例算，
   * 这样在 9:16 / 9:19.5 等各种竖屏手机上都不会出现黑边。
   */
  function computeHeight() {
    var vw = Math.max(1, window.innerWidth || 360);
    var vh = Math.max(1, window.innerHeight || 640);
    var h = Math.round(360 * (vh / vw));
    return Math.max(520, Math.min(900, h));
  }

  // 16 色调色板：'x' 为占位（透明），其余为像素美术用色
  var PALETTE = {
    '.': null,          // 透明
    '0': '#05060f',     // 近黑（描边）
    '1': '#2a2f4a',     // 暗铁灰
    '2': '#4d5578',     // 铁灰
    '3': '#8f9bc4',     // 亮铁灰
    '4': '#ffffff',     // 白（高光/驾驶舱）
    '5': '#ff4d5e',     // 红
    '6': '#a01230',     // 暗红
    '7': '#ffa63d',     // 橙（引擎焰）
    '8': '#ffe66d',     // 黄
    '9': '#3ce0ff',     // 青
    'a': '#1f8cff',     // 蓝
    'b': '#0d3a91',     // 深蓝
    'c': '#63f28a',     // 绿
    'd': '#1da84a',     // 深绿
    'e': '#c471ff',     // 紫
    'f': '#6c2bd9'      // 深紫
  };

  var CFG = {
    W: 360,
    H: computeHeight(),
    DPR: window.devicePixelRatio || 1,
    HI_KEY: 'pixelshooter.hi',
    MUTE_KEY: 'pixelshooter.mute',

    PALETTE: PALETTE,

    UI: {
      TEXT: '#ffffff',
      DIM: '#8f9bc4',
      GOLD: '#ffe66d',
      CYAN: '#3ce0ff',
      RED: '#ff4d5e',
      GREEN: '#63f28a',
      PURPLE: '#c471ff'
    },

    // 玩家数值
    PLAYER: {
      SPEED: 620,          // 拖拽跟随的最大速度（px/s）
      LIVES: 3,
      MAX_LIVES: 5,
      BOMBS: 2,
      MAX_BOMBS: 5,
      RADIUS: 5,           // 碰撞判定圆半径（比贴图小，手感更宽容）
      INVULN: 2200,        // 复活无敌时间 ms
      SHIELD_TIME: 7000,   // 护盾持续时间 ms
      RESPAWN_DELAY: 1100,
      BULLET_SPEED: 560,
      MAX_WEAPON: 6
    },

    // 敌机属性表
    ENEMY: {
      small:  { hp: 2,  speed: 118, score: 100, tex: 'e_small',  r: 5,  drops: 0.06 },
      small2: { hp: 2,  speed: 100, score: 120, tex: 'e_small2', r: 5,  drops: 0.08 },
      med:    { hp: 8,  speed: 72,  score: 250, tex: 'e_med',    r: 7,  drops: 0.30 },
      large:  { hp: 22, speed: 46,  score: 700, tex: 'e_large',  r: 10, drops: 1.00 }
    },

    // 道具
    POWER: {
      FALL: 62,
      types: ['spread', 'shield', 'bomb', 'heal'],
      weights: [40, 25, 20, 15],
      score: 50
    },

    // 难度曲线
    DIFF: {
      hpPerWave: 0.13,     // 每波血量乘数增量
      speedPerWave: 0.045, // 每波速度乘数增量
      firePerWave: 0.055   // 每波开火频率增量
    },

    BOSS_EVERY: 5,          // 每 5 波一个 Boss

    // 对象池/性能上限
    POOL: {
      P_BULLET: 220,
      E_BULLET: 420,
      ENEMY: 64,
      POWER: 24,
      EXPLOSION: 48,
      FLASH: 16
    },

    // 深度层
    DEPTH: {
      BG_FAR: 0,
      BG_MID: 1,
      BG_NEAR: 2,
      POWER: 3,
      ENEMY: 4,
      BULLET: 5,
      PLAYER: 6,
      FX: 7,
      PARTICLE: 8
    }
  };

  // 武器等级 -> 发射方式（angle 为相对正上方的偏角，单位度）
  CFG.WEAPONS = [
    null,
    { rate: 170, dmg: 2, shot: [{ x: 0, a: 0 }] },
    { rate: 160, dmg: 2, shot: [{ x: -5, a: 0 }, { x: 5, a: 0 }] },
    { rate: 150, dmg: 2, shot: [{ x: 0, a: 0 }, { x: -7, a: 0 }, { x: 7, a: 0 }] },
    { rate: 145, dmg: 2, shot: [{ x: 0, a: 0 }, { x: -7, a: 0 }, { x: 7, a: 0 }, { x: -9, a: -13 }, { x: 9, a: 13 }] },
    { rate: 135, dmg: 3, shot: [{ x: -4, a: 0 }, { x: 4, a: 0 }, { x: -10, a: 0 }, { x: 10, a: 0 }, { x: -11, a: -16 }, { x: 11, a: 16 }] },
    { rate: 120, dmg: 3, shot: [{ x: 0, a: 0 }, { x: -6, a: 0 }, { x: 6, a: 0 }, { x: -12, a: -10 }, { x: 12, a: 10 }, { x: -14, a: -22 }, { x: 14, a: 22 }] }
  ];

  CFG.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };

  /* --------------------------------------------------------------------
   * HUD 布局（唯一数据源）：GameScene 用它来屏蔽“按钮区域”的拖拽，
   * HudScene 用它来摆放按钮，两边永远一致。
   * ------------------------------------------------------------------ */
  CFG.HUD = function () {
    var W = CFG.W, H = CFG.H;
    return {
      btn: 22,
      full: { x: W - 62, y: 18 },
      sound: { x: W - 38, y: 18 },
      pause: { x: W - 14, y: 18 },
      bomb: { x: W - 28, y: H - 40 },
      bombSize: 34
    };
  };

  /** 触摸屏蔽区（含按钮周围的余量），返回 [{x,y,w,h}] */
  CFG.uiZones = function () {
    var h = CFG.HUD();
    var z = [];
    var pad = 5;
    [h.full, h.sound, h.pause].forEach(function (p) {
      z.push({ x: p.x - 13 - pad, y: p.y - 12 - pad, w: 26 + pad * 2, h: 24 + pad * 2 });
    });
    z.push({ x: h.bomb.x - h.bombSize / 2 - pad, y: h.bomb.y - h.bombSize / 2 - pad, w: h.bombSize + pad * 2, h: h.bombSize + pad * 2 });
    return z;
  };

  CFG.inZones = function (x, y) {
    var z = CFG.uiZones();
    for (var i = 0; i < z.length; i++) {
      if (x >= z[i].x && x <= z[i].x + z[i].w && y >= z[i].y && y <= z[i].y + z[i].h) return true;
    }
    return false;
  };

  /* --------------------------------------------------------------------
   * 全局事件总线（跨场景通信）。定义在这里可以保证最先加载，
   * 场景脚本只需 `var Bus = window.Bus;`
   * ------------------------------------------------------------------ */
  if (!window.Bus) {
    window.Bus = (window.Phaser && window.Phaser.Events)
      ? new Phaser.Events.EventEmitter()
      : { on: function () { }, off: function () { }, emit: function () { } };
  }

  window.CFG = CFG;
})();
