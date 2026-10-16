/* =========================================================================
 * PIXEL SHOOTER — HudScene
 * 独立场景 = 独立摄像机，屏幕震动/闪光只影响 GameScene，HUD 永远稳定。
 * 与 GameScene 通过全局事件总线 Bus 通信（事件名见 README）。
 * ========================================================================= */
(function () {
  'use strict';

  var CFG = window.CFG;
  var Bus = window.Bus;

  class HudScene extends Phaser.Scene {
    constructor() { super('Hud'); }

    create() {
      var self = this;
      var W = CFG.W, H = CFG.H, L = CFG.HUD();
      this.objs = [];
      this.hearts = [];
      this.shieldUntil = 0;
      this.shieldTotal = CFG.PLAYER.SHIELD_TIME;
      this.listeners = [];

      // ---------- 顶部：分数 / 最高分 / 波数 ----------
      this.scoreText = this.add.bitmapText(6, 5, 'pixel', 'SCORE 0').setScale(2).setTint(0xffffff);
      this.hiText = this.add.bitmapText(6, 24, 'pixel', 'HI 0').setTint(0x8f9bc4);
      this.waveText = this.add.bitmapText(6, 34, 'pixel', 'WAVE 1').setTint(0x3ce0ff);
      this.objs.push(this.scoreText, this.hiText, this.waveText);

      // ---------- 右上：全屏 / 音效 / 暂停 ----------
      this.btnFull = this.makeBtn(L.full.x, L.full.y, 'icon_full', function () { toggleFullscreen(); });
      this.btnSound = this.makeBtn(L.sound.x, L.sound.y, Synth.isMuted() ? 'icon_snd_off' : 'icon_snd_on', function () {
        var m = !Synth.isMuted();
        Synth.setMuted(m);
        try { window.localStorage.setItem(CFG.MUTE_KEY, m ? '1' : '0'); } catch (e) { }
        self.btnSound.setTexture(m ? 'icon_snd_off' : 'icon_snd_on');
      });
      this.btnPause = this.makeBtn(L.pause.x, L.pause.y, 'icon_pause', function () { Bus.emit('ui:pause'); });

      // ---------- Boss 血条 ----------
      this.bossGroup = [];
      this.bossBarBg = this.add.rectangle(20, 46, W - 40, 9, 0x0d1020, 0.85).setOrigin(0, 0).setStrokeStyle(1, 0xc471ff, 0.9);
      this.bossBar = this.add.rectangle(21, 47, W - 42, 7, 0xff4d5e).setOrigin(0, 0);
      this.bossLabel = this.add.bitmapText(W / 2, 45, 'pixel', 'BOSS').setOrigin(0.5, 1).setTint(0xc471ff);
      this.bossGroup.push(this.bossBarBg, this.bossBar, this.bossLabel);
      this.setBossVisible(false);

      // ---------- 左下：生命 ----------
      this.setLives(CFG.PLAYER.LIVES);

      // ---------- 中下：武器等级 / 护盾 ----------
      this.ticks = [];
      for (var i = 0; i < CFG.PLAYER.MAX_WEAPON; i++) {
        this.ticks.push(this.add.rectangle(100 + i * 24, H - 11, 20, 6, 0x2a2f4a).setOrigin(0, 0).setStrokeStyle(1, 0x4d5578));
      }
      this.objs = this.objs.concat(this.ticks);
      this.shieldBar = this.add.rectangle(100, H - 19, 1, 4, 0x3ce0ff).setOrigin(0, 0).setVisible(false);
      this.setWeapon(1);

      // ---------- 右下：炸弹按钮 ----------
      this.bombBtn = this.add.image(L.bomb.x, L.bomb.y, 'btn_round').setInteractive({ useHandCursor: true });
      this.bombIco = this.add.image(L.bomb.x, L.bomb.y - 1, 'icon_bomb').setScale(1.4);
      this.bombText = this.add.bitmapText(L.bomb.x + 13, L.bomb.y + 15, 'pixel', '0').setOrigin(0.5, 1).setTint(0xffe66d);
      this.objs.push(this.bombBtn, this.bombIco, this.bombText);
      this.bombBtn.on('pointerdown', function () {
        self.tweens.add({ targets: [self.bombBtn, self.bombIco], scale: 0.86, duration: 70, yoyo: true });
        Bus.emit('ui:bomb');
      });

      // ---------- 受击红屏 ----------
      this.vignette = this.add.rectangle(0, 0, W, H, 0xff0033, 0).setOrigin(0, 0);

      // ---------- 暂停遮罩 ----------
      this.pauseLayer = this.add.container(0, 0).setVisible(false);
      var dim = this.add.rectangle(0, 0, W, H, 0x05060f, 0.78).setOrigin(0, 0).setInteractive();
      var pTxt = this.add.bitmapText(W / 2, H / 2 - 30, 'pixel', 'PAUSED').setScale(4).setOrigin(0.5).setTint(0xffffff);
      var pTip = this.add.bitmapText(W / 2, H / 2 + 20, 'pixel', 'TAP TO RESUME').setOrigin(0.5).setTint(0x3ce0ff);
      this.pauseLayer.add([dim, pTxt, pTip]);
      this.tweens.add({ targets: pTip, alpha: 0.25, duration: 620, yoyo: true, repeat: -1 });
      dim.on('pointerdown', function () { Bus.emit('ui:pause'); });
      this.resumeBtn = this.makeBtn(W / 2, H / 2 + 62, 'icon_play', function () { Bus.emit('ui:pause'); });
      this.resumeBtn.setVisible(false);

      // ---------- 事件 ----------
      this.busOn('hud:sync', function (s) {
        self.setScore(s.score);
        self.setHi(s.hi);
        self.setWave(s.wave);
        self.setLives(s.lives);
        self.setBombs(s.bombs);
        self.setWeapon(s.weapon);
        self.shieldUntil = s.shield || 0;
        if (s.boss) { self.setBossVisible(true); self.setBossHp(s.boss.hp, s.boss.maxHp); }
        else self.setBossVisible(false);
        self.setPaused(s.paused);
      });
      this.busOn('hud:score', function (v) { self.setScore(v); });
      this.busOn('hud:hi', function (v) { self.setHi(v); });
      this.busOn('hud:wave', function (v) { self.setWave(v); });
      this.busOn('hud:lives', function (v) { self.setLives(v); });
      this.busOn('hud:bombs', function (v) { self.setBombs(v); });
      this.busOn('hud:weapon', function (v) { self.setWeapon(v); });
      this.busOn('hud:shield', function (until) { self.shieldUntil = until || 0; });
      this.busOn('hud:boss', function (b) { self.setBossVisible(true); self.setBossHp(b.hp, b.maxHp); });
      this.busOn('hud:bosshide', function () { self.setBossVisible(false); });
      this.busOn('hud:banner', function (b) { self.showBanner(b); });
      this.busOn('hud:hurt', function () { self.flashHurt(); });
      this.busOn('hud:paused', function (v) { self.setPaused(v); });
      this.busOn('hud:over', function () { self.pauseLayer.setVisible(false); self.resumeBtn.setVisible(false); });

      this.events.once('shutdown', this.shutdown, this);
      Bus.emit('hud:request');
    }

    busOn(evt, fn) {
      Bus.on(evt, fn, this);
      this.listeners.push({ e: evt, f: fn });
    }

    shutdown() {
      for (var i = 0; i < this.listeners.length; i++) {
        Bus.off(this.listeners[i].e, this.listeners[i].f, this);
      }
      this.listeners.length = 0;
    }

    makeBtn(x, y, tex, onClick) {
      var self = this;
      var img = this.add.image(x, y, tex).setScale(2).setInteractive({ useHandCursor: true });
      img.on('pointerdown', function () {
        self.tweens.add({ targets: img, scale: 1.7, duration: 60, yoyo: true });
        onClick();
      });
      this.objs.push(img);
      return img;
    }

    /* ---------------------- 数值刷新 ---------------------- */
    setScore(v) { this.scoreText.setText('SCORE ' + v); }
    setHi(v) { this.hiText.setText('HI ' + v); }
    setWave(v) { if (v > 0) this.waveText.setText('WAVE ' + v); }

    setLives(n) {
      var need = Math.max(n, this.hearts.length);
      for (var i = 0; i < need; i++) {
        if (!this.hearts[i]) {
          var img = this.add.image(8 + i * 19, CFG.H - 26, 'life').setOrigin(0, 0).setScale(2);
          this.hearts.push(img);
          this.objs.push(img);
        }
      }
      for (var j = 0; j < this.hearts.length; j++) this.hearts[j].setVisible(j < n);
    }

    setBombs(n) {
      this.bombText.setText(String(n));
      this.bombIco.setAlpha(n > 0 ? 1 : 0.35);
    }

    setWeapon(lvl) {
      for (var i = 0; i < this.ticks.length; i++) {
        var on = i < lvl;
        this.ticks[i].setFillStyle(on ? (lvl >= CFG.PLAYER.MAX_WEAPON ? 0xff4d5e : 0x3ce0ff) : 0x2a2f4a);
      }
    }

    setBossVisible(v) {
      for (var i = 0; i < this.bossGroup.length; i++) this.bossGroup[i].setVisible(v);
    }

    setBossHp(hp, maxHp) {
      var ratio = CFG.clamp(hp / maxHp, 0, 1);
      this.bossBar.width = Math.max(1, (CFG.W - 42) * ratio);
      this.bossBar.setFillStyle(ratio > 0.55 ? 0xff4d5e : (ratio > 0.28 ? 0xffa63d : 0xffe66d));
    }

    setPaused(v) {
      this.pauseLayer.setVisible(v);
      this.resumeBtn.setVisible(v);
    }

    showBanner(b) {
      var t = this.add.bitmapText(CFG.W / 2, CFG.H * 0.33, 'pixel', b.text).setScale(3).setOrigin(0.5);
      t.setTint(b.color === CFG.UI.RED ? 0xff4d5e : (b.color === CFG.UI.GOLD ? 0xffe66d : (b.color === CFG.UI.PURPLE ? 0xc471ff : 0x3ce0ff)));
      t.setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, scale: 3.2, duration: 140, ease: 'Back.easeOut' });
      this.tweens.add({
        targets: t, alpha: 0, y: t.y - 14, delay: b.time || 1000, duration: 320,
        onComplete: function () { t.destroy(); }
      });
    }

    flashHurt() {
      this.vignette.setAlpha(0.5);
      this.tweens.add({ targets: this.vignette, alpha: 0, duration: 260, ease: 'Quad.easeOut' });
    }

    update() {
      // 护盾条随时间衰减
      var left = this.shieldUntil - this.time.now;
      if (left > 0) {
        this.shieldBar.setVisible(true);
        this.shieldBar.width = Math.max(1, 140 * (left / this.shieldTotal));
        this.shieldBar.setFillStyle(left < 1800 ? 0xffe66d : 0x3ce0ff);
      } else if (this.shieldBar.visible) {
        this.shieldBar.setVisible(false);
      }
    }
  }

  window.HudScene = HudScene;
})();
