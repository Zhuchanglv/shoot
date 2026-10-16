/* =========================================================================
 * PIXEL SHOOTER — GameOverScene
 * 结算界面：成绩统计 + 最高分记录 + 重来 / 返回菜单
 * ========================================================================= */
(function () {
  'use strict';

  var CFG = window.CFG;

  class GameOverScene extends Phaser.Scene {
    constructor() { super('Over'); }

    init(data) {
      this.data2 = data || { score: 0, hi: 0, wave: 1, kills: 0 };
      this.locked = true;
    }

    create() {
      var self = this;
      var W = CFG.W, H = CFG.H;
      var d = this.data2;

      // 兜底：任何路径进入结算界面都保证 HUD 已关闭（不会残留在上层）
      this.scene.stop('Hud');

      this.bg = Art.createBackdrop(this);
      this.add.rectangle(0, 0, W, H, 0x05060f, 0.55).setOrigin(0, 0);

      var isRecord = d.score > 0 && d.score >= d.hi;
      var title = this.add.bitmapText(W / 2, H * 0.18, 'pixel', 'GAME OVER').setScale(4).setOrigin(0.5);
      title.setTint(0xff4d5e);
      this.tweens.add({ targets: title, scale: 4.2, duration: 300, yoyo: true, ease: 'Quad.easeOut' });

      if (isRecord) {
        var rec = this.add.bitmapText(W / 2, H * 0.26, 'pixel', 'NEW RECORD !').setScale(2).setOrigin(0.5).setTint(0xffe66d);
        this.tweens.add({ targets: rec, alpha: 0.35, duration: 520, yoyo: true, repeat: -1 });
      }

      var lines = [
        ['SCORE', d.score],
        ['HI SCORE', Math.max(d.hi, d.score)],
        ['WAVE', d.wave],
        ['KILLS', d.kills]
      ];
      var y0 = H * (isRecord ? 0.35 : 0.32);
      for (var i = 0; i < lines.length; i++) {
        var y = y0 + i * 26;
        this.add.bitmapText(W / 2 - 12, y, 'pixel', lines[i][0]).setScale(2).setOrigin(1, 0.5).setTint(0x8f9bc4);
        this.add.bitmapText(W / 2 + 12, y, 'pixel', String(lines[i][1])).setScale(2).setOrigin(0, 0.5).setTint(0xffffff);
      }

      // 奖励一枚小彩蛋：打过 Boss 就闪一下
      this.add.image(W / 2, H * 0.55, 'e_large').setScale(2).setAlpha(0.25).setAngle(180);

      this.makeButton(W / 2, H * 0.66, 'RETRY', 0x3ce0ff, function () { self.retry(); });
      this.makeButton(W / 2, H * 0.75, 'MENU', 0x8f9bc4, function () { self.toMenu(); });

      this.add.bitmapText(W / 2, H - 18, 'pixel', 'TAP RETRY TO FLY AGAIN').setOrigin(0.5).setTint(0x4d5578);

      this.input.keyboard.on('keydown-SPACE', function () { self.retry(); });
      this.input.keyboard.on('keydown-ENTER', function () { self.retry(); });
      this.input.keyboard.on('keydown-ESC', function () { self.toMenu(); });

      this.time.delayedCall(600, function () { self.locked = false; });
    }

    makeButton(x, y, label, color, cb) {
      var t = this.add.bitmapText(x, y, 'pixel', label).setScale(3).setOrigin(0.5).setTint(color);
      var w = Math.max(140, t.width + 36);
      var bg = this.add.rectangle(x, y, w, 34, 0x0d1020, 0.9).setStrokeStyle(2, color, 0.9);
      bg.setInteractive({ useHandCursor: true });
      this.children.bringToTop(t);
      var self = this;
      bg.on('pointerdown', function () {
        if (self.locked) return;
        self.tweens.add({ targets: bg, scaleX: 0.94, scaleY: 0.9, duration: 70, yoyo: true });
        window.Synth.pickup();
        cb();
      });
    }

    retry() {
      if (this.locked) return;
      this.locked = true;
      this.scene.stop('Hud');
      this.scene.start('Game');
    }

    toMenu() {
      if (this.locked) return;
      this.locked = true;
      this.scene.stop('Hud');
      this.scene.start('Menu');
    }

    update(time, delta) {
      this.bg.update(delta / 1000, 0.8);
    }
  }

  window.GameOverScene = GameOverScene;
})();
