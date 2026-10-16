/* =========================================================================
 * PIXEL SHOOTER — MenuScene
 * 标题界面：星空视差 + 像素标题 + 最高分 + 首次触摸解锁音频
 * ========================================================================= */
(function () {
  'use strict';

  var CFG = window.CFG;

  class MenuScene extends Phaser.Scene {
    constructor() { super('Menu'); }

    create() {
      var self = this;
      var W = CFG.W, H = CFG.H;
      this.starting = false;

      // 兜底：从任何状态回到菜单都确保 HUD 已关闭
      this.scene.stop('Hud');

      this.bg = Art.createBackdrop(this);

      // ---------- 装饰：几架敌机缓缓飞过 ----------
      var deco = [
        { tex: 'e_small', x: 54, y: -20, s: 1, v: 42, a: 0 },
        { tex: 'e_small2', x: 300, y: -70, s: 1, v: 56, a: 0 },
        { tex: 'e_med', x: 96, y: -140, s: 1, v: 30, a: 0 },
        { tex: 'e_large', x: 268, y: -230, s: 1, v: 20, a: 0 }
      ];
      this.deco = [];
      for (var i = 0; i < deco.length; i++) {
        var d = deco[i];
        var sp = this.add.image(d.x, d.y, d.tex).setAlpha(0.85);
        sp.v = d.v;
        this.deco.push(sp);
      }

      // ---------- 标题 ----------
      var ty = Math.round(H * 0.15);
      this.add.bitmapText(W / 2 + 3, ty + 3, 'pixel', 'PIXEL').setScale(6).setOrigin(0.5).setTint(0x12003a);
      var t1 = this.add.bitmapText(W / 2, ty, 'pixel', 'PIXEL').setScale(6).setOrigin(0.5).setTint(0xffffff);
      this.add.bitmapText(W / 2 + 3, ty + 51, 'pixel', 'SHOOTER').setScale(6).setOrigin(0.5).setTint(0x12003a);
      var t2 = this.add.bitmapText(W / 2, ty + 48, 'pixel', 'SHOOTER').setScale(6).setOrigin(0.5).setTint(0x3ce0ff);
      this.tweens.add({ targets: [t1, t2], y: '+=4', duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      // ---------- 玩家机 ----------
      this.ship = this.add.image(W / 2, H * 0.47, 'ship').setScale(3);
      this.tweens.add({ targets: this.ship, y: H * 0.47 + 12, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

      this.thrust = this.add.particles(0, 0, 'px', {
        lifespan: { min: 240, max: 460 },
        speed: { min: 40, max: 100 },
        angle: { min: 70, max: 110 },
        scale: { start: 3, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint: [0x3ce0ff, 0xffffff, 0x1f8cff],
        frequency: 55,
        quantity: 1,
        maxParticles: 40,
        blendMode: 'ADD'
      }).setDepth(-1);

      // ---------- 提示 ----------
      var start = this.add.bitmapText(W / 2, H * 0.63, 'pixel', 'TAP TO START').setScale(2).setOrigin(0.5).setTint(0xffe66d);
      this.tweens.add({ targets: start, alpha: 0.25, duration: 620, yoyo: true, repeat: -1 });

      this.add.bitmapText(W / 2, H * 0.70, 'pixel', 'DRAG TO MOVE  /  AUTO FIRE').setOrigin(0.5).setTint(0x8f9bc4);
      this.add.bitmapText(W / 2, H * 0.74, 'pixel', 'GRAB THE S CUBES TO POWER UP').setOrigin(0.5).setTint(0x4d5578);

      var hi = 0;
      try { hi = parseInt(window.localStorage.getItem(CFG.HI_KEY) || '0', 10) || 0; } catch (e) { hi = 0; }
      this.hiText = this.add.bitmapText(W / 2, H * 0.80, 'pixel', 'HI SCORE ' + hi).setScale(1).setOrigin(0.5).setTint(0x63f28a);

      this.add.bitmapText(W / 2, H - 14, 'pixel', 'PHASER 3  /  PIXEL ART BY CODE  /  V1.0').setOrigin(0.5).setTint(0x2a2f4a);

      // ---------- 右上按钮：全屏 / 音效 ----------
      var L = CFG.HUD();
      this.makeBtn(L.full.x, L.full.y, 'icon_full', function () { toggleFullscreen(); });
      this.sndBtn = this.makeBtn(L.sound.x, L.sound.y, Synth.isMuted() ? 'icon_snd_off' : 'icon_snd_on', function () {
        var m = !Synth.isMuted();
        Synth.setMuted(m);
        try { window.localStorage.setItem(CFG.MUTE_KEY, m ? '1' : '0'); } catch (e) { }
        self.sndBtn.setTexture(m ? 'icon_snd_off' : 'icon_snd_on');
        if (!m) { Synth.unlock(); Synth.pickup(); }
      });

      // ---------- 开始 ----------
      this.input.on('pointerdown', function (p) {
        if (CFG.inZones(p.x, p.y)) return;
        self.startGame();
      });
      this.input.keyboard.on('keydown-SPACE', function () { self.startGame(); });
      this.input.keyboard.on('keydown-ENTER', function () { self.startGame(); });
    }

    makeBtn(x, y, tex, onClick) {
      var img = this.add.image(x, y, tex).setScale(2).setInteractive({ useHandCursor: true });
      img.on('pointerdown', onClick);
      return img;
    }

    startGame() {
      if (this.starting) return;
      this.starting = true;
      Synth.unlock();
      Synth.pickup();
      this.cameras.main.flash(180, 40, 160, 255);
      var self = this;
      this.time.delayedCall(160, function () { self.scene.start('Game'); });
    }

    update(time, delta) {
      var dt = delta / 1000;
      this.bg.update(dt, 0.55);
      for (var i = 0; i < this.deco.length; i++) {
        var d = this.deco[i];
        d.y += d.v * dt;
        if (d.y > CFG.H + 40) d.y = -40;
      }
      if (this.thrust) this.thrust.setPosition(this.ship.x, this.ship.y + 22);
    }
  }

  window.MenuScene = MenuScene;
})();
