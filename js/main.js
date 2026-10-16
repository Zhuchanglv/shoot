/* =========================================================================
 * PIXEL SHOOTER — main.js
 * Phaser 启动配置 / 全屏 / 音频解锁 / 自适应 / 调试浮层
 * ========================================================================= */
(function () {
  'use strict';

  var CFG = window.CFG;

  /* ---------------------------------------------------------------------
   * 全屏（含 Android 竖屏锁定尝试；iOS Safari 不支持则静默失败）
   * ------------------------------------------------------------------- */
  function lockPortrait() {
    try {
      if (window.screen && screen.orientation && screen.orientation.lock) {
        var p = screen.orientation.lock('portrait');
        if (p && p.catch) p.catch(function () { });
      }
    } catch (e) { /* ignore */ }
  }

  window.isFullscreen = function () {
    return !!(document.fullscreenElement || document.webkitFullscreenElement ||
      document.mozFullScreenElement || document.msFullscreenElement);
  };

  window.toggleFullscreen = function () {
    var d = document;
    var el = d.documentElement;
    try {
      if (!window.isFullscreen()) {
        var req = el.requestFullscreen || el.webkitRequestFullscreen ||
          el.mozRequestFullScreen || el.msRequestFullscreen;
        if (req) {
          var p = req.call(el);
          if (p && p.then) { p.then(lockPortrait, function () { }); }
          else { window.setTimeout(lockPortrait, 150); }
        } else {
          lockPortrait();   // iOS：无法全屏，至少尝试锁竖屏
        }
      } else {
        var exit = d.exitFullscreen || d.webkitExitFullscreen ||
          d.mozCancelFullScreen || d.msExitFullscreen;
        if (exit) exit.call(d);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[fullscreen] 不可用:', e && e.message);
    }
  };

  /* ---------------------------------------------------------------------
   * 音频解锁：移动端必须由用户手势触发 AudioContext
   * ------------------------------------------------------------------- */
  function unlockAudio() {
    try { Synth.unlock(); } catch (e) { /* ignore */ }
  }
  ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach(function (evt) {
    window.addEventListener(evt, unlockAudio, { passive: true });
  });

  // 切到后台自动暂停（省电 + 避免回来被瞬秒）
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) window.Bus.emit('ui:autopause');
  });
  window.addEventListener('blur', function () { window.Bus.emit('ui:autopause'); });

  // 禁用 iOS 手势缩放 / 双击缩放 / 橡皮筋
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturechange', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });

  /* ---------------------------------------------------------------------
   * Phaser 配置
   * ------------------------------------------------------------------- */
  var config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: CFG.W,
    height: CFG.H,
    backgroundColor: '#05060f',

    // 像素风关键设置：关抗锯齿 + 最近邻采样 + 整数取整，放大后依然锐利
    pixelArt: true,
    antialias: false,
    roundPixels: true,

    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: CFG.W,
      height: CFG.H,
      expandParent: true
    },

    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false, fixedStep: true }
    },

    input: { activePointers: 3, touch: { capture: true } },
    disableContextMenu: true,
    render: { powerPreference: 'high-performance' },
    fps: { min: 30, target: 60 },
    scene: [window.BootScene, window.MenuScene, window.GameScene, window.HudScene, window.GameOverScene]
  };

  var game = new Phaser.Game(config);
  window.game = game;

  // 旋转屏幕 / 尺寸变化后刷新一次缩放
  var refresh = function () { if (game.scale) game.scale.refresh(); };
  window.addEventListener('resize', refresh);
  window.addEventListener('orientationchange', function () { window.setTimeout(refresh, 250); });

  // 清理 Phaser 的 WebGL 上下文（热重载/离开页面时更干净）
  window.addEventListener('beforeunload', function () { try { game.destroy(true); } catch (e) { } });

  /* ---------------------------------------------------------------------
   * ?debug=1 时显示 FPS / 对象数浮层（开发用，默认完全关闭）
   * ------------------------------------------------------------------- */
  if (/[?&]debug=1/.test(window.location.search)) {
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:4px;top:4px;z-index:99;font:10px/14px monospace;color:#3ce0ff;' +
      'background:rgba(5,6,15,.7);padding:4px 6px;pointer-events:none;white-space:pre';
    document.body.appendChild(box);
    window.setInterval(function () {
      var g = window.game;
      var active = 0;
      var keys = ['Game', 'Hud', 'Menu', 'Over'];
      for (var i = 0; i < keys.length; i++) if (g.scene.isActive(keys[i])) active++;
      var gs = g.scene.getScene('Game');
      var objs = 0;
      if (gs && gs.pBullets && g.scene.isActive('Game')) {
        try {
          objs = gs.pBullets.countActive(true) + gs.eBullets.countActive(true) + gs.enemies.countActive(true) +
            gs.powers.countActive(true) + gs.explosions.countActive(true);
        } catch (e) { objs = 0; }   // 场景切换瞬间可能已销毁，忽略
      }
      box.textContent =
        'FPS ' + Math.round(g.loop.actualFps) +
        '\n' + (g.renderer.type === Phaser.WEBGL ? 'WEBGL' : 'CANVAS') +
        '\nOBJ ' + objs +
        '\nDPR ' + CFG.DPR +
        '\n' + CFG.W + 'x' + CFG.H + '\nSCENES ' + active;
    }, 500);
  }
})();
