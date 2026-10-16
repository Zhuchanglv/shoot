/* =========================================================================
 * PIXEL SHOOTER — BootScene
 * 一次性生成所有贴图（精灵表）+ 位图字体 + 动画，然后进入主菜单。
 * 因为美术是代码生成的，这里没有任何网络加载，启动是“瞬开”。
 * ========================================================================= */
(function () {
  'use strict';

  var CFG = window.CFG;

  class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }

    create() {
      var t0 = (window.performance && performance.now) ? performance.now() : Date.now();

      // 1) 像素美术 -> 精灵表
      var n = Art.buildAll(this);

      // 2) 5x7 位图字体（HUD / 弹字）
      PixelFont.register(this);

      // 3) 动画
      var A = this.anims;
      A.create({ key: 'expSmall', frames: A.generateFrameNumbers('exp_small', { start: 0, end: 5 }), frameRate: 24, repeat: 0 });
      A.create({ key: 'expBig', frames: A.generateFrameNumbers('exp_big', { start: 0, end: 7 }), frameRate: 15, repeat: 0 });
      A.create({ key: 'shock', frames: A.generateFrameNumbers('shock', { start: 0, end: 5 }), frameRate: 12, repeat: 0 });
      A.create({ key: 'shieldSpin', frames: A.generateFrameNumbers('shield', { start: 0, end: 5 }), frameRate: 12, repeat: -1 });
      A.create({ key: 'corePulse', frames: A.generateFrameNumbers('boss_core', { start: 0, end: 5 }), frameRate: 11, repeat: -1 });

      // 4) 音效静音状态（localStorage 记忆）
      var muted = false;
      try { muted = window.localStorage.getItem(CFG.MUTE_KEY) === '1'; } catch (e) { muted = false; }
      Synth.setMuted(muted);

      var ms = Math.round(((window.performance && performance.now) ? performance.now() : Date.now()) - t0);
      // eslint-disable-next-line no-console
      console.log('[boot] ' + n + ' sprite sheets + bitmap font ready in ' + ms + 'ms');

      this.scene.start('Menu');
    }
  }

  window.BootScene = BootScene;
})();
