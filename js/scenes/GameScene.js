/* =========================================================================
 * PIXEL SHOOTER — GameScene
 * 主玩法：拖拽操控、自动射击、波次生成、道具、Boss 战、屏幕反馈
 * 所有可复用对象都走对象池（Phaser Group + get()），避免运行时 GC 抖动。
 * ========================================================================= */
(function () {
  'use strict';

  var CFG = window.CFG;
  var Bus = window.Bus;
  var D2R = Math.PI / 180;

  function readHi() {
    var v = 0;
    try { v = parseInt(window.localStorage.getItem(CFG.HI_KEY) || '0', 10) || 0; } catch (e) { v = 0; }
    return v;
  }
  function writeHi(v) {
    try { window.localStorage.setItem(CFG.HI_KEY, String(v)); } catch (e) { /* 隐私模式忽略 */ }
  }

  class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    /* ------------------------------------------------------------------ */
    create() {
      var self = this;
      this.W = CFG.W;
      this.H = CFG.H;

      this.run = {
        score: 0,
        hi: readHi(),
        lives: CFG.PLAYER.LIVES,
        bombs: CFG.PLAYER.BOMBS,
        weapon: 1,
        wave: 0,
        kills: 0,
        over: false,
        bossAlive: false
      };
      this.queue = [];
      this.waveClock = 0;
      this.waveActive = false;
      this.waveEndsAt = 0;
      this.plan = null;
      this.boss = null;
      this.paused = false;
      this.listeners = [];
      this.thrustAt = 0;
      this.dragPointer = null;

      this.physics.world.setBounds(0, 0, this.W, this.H);
      this.bg = Art.createBackdrop(this);

      this.createPools();
      this.createPlayer();
      this.createEffects();
      this.createColliders();
      this.createInput();

      this.busOn('hud:request', function () { Bus.emit('hud:sync', self.snapshot()); });
      this.busOn('ui:bomb', function () { self.useBomb(); });
      this.busOn('ui:pause', function () { self.togglePause(); });
      this.busOn('ui:autopause', function () {
        if (!self.paused && !self.run.over) self.togglePause();
      });
      this.events.once('shutdown', this.shutdown, this);

      if (!this.scene.isActive('Hud')) this.scene.launch('Hud');
      this.scene.bringToTop('Hud');

      Synth.startBgm();
      this.time.delayedCall(60, function () { Bus.emit('hud:sync', self.snapshot()); });
      this.startWave(1);
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
      if (this.boss) { this.boss.destroyBoss(); this.boss = null; }
      Synth.stopBgm();
    }

    /* ------------------------------------------------------------------ */
    createPools() {
      this.pBullets = this.physics.add.group({ defaultKey: 'pb1', maxSize: CFG.POOL.P_BULLET });
      this.eBullets = this.physics.add.group({ defaultKey: 'eb_orb', maxSize: CFG.POOL.E_BULLET });
      this.enemies = this.physics.add.group({ classType: Enemy, maxSize: CFG.POOL.ENEMY });
      this.powers = this.physics.add.group({ classType: PowerUp, maxSize: CFG.POOL.POWER });
      this.bosses = this.physics.add.group({ classType: Boss, maxSize: 2 });
      this.explosions = this.add.group({ classType: Phaser.GameObjects.Sprite, maxSize: CFG.POOL.EXPLOSION });
      this.shocks = this.add.group({ classType: Phaser.GameObjects.Sprite, maxSize: 8 });

      // 护盾环
      this.shieldSprite = this.add.sprite(0, 0, 'shield');
      this.shieldSprite.play('shieldSpin');
      this.shieldSprite.setDepth(CFG.DEPTH.FX).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    }

    createPlayer() {
      this.player = new Player(this, this.W / 2, this.H - 70);
      this.physics.add.existing(this.player);
      this.player.initBody();
      this.dragOffX = 0;
      this.dragOffY = -26;
    }

    createEffects() {
      // 火花（受击 / 爆炸）
      this.sparks = this.add.particles(0, 0, 'spark', {
        lifespan: { min: 150, max: 420 },
        speed: { min: 40, max: 210 },
        angle: { min: 0, max: 360 },
        scale: { start: 1, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xffffff, 0xffe66d, 0xffa63d, 0x3ce0ff],
        quantity: 1,
        emitting: false,
        maxParticles: 220,
        blendMode: 'ADD'
      }).setDepth(CFG.DEPTH.PARTICLE);

      // 引擎尾焰
      this.thrust = this.add.particles(0, 0, 'px', {
        lifespan: { min: 140, max: 300 },
        speed: { min: 30, max: 80 },
        angle: { min: 70, max: 110 },
        scale: { start: 1.4, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [0x3ce0ff, 0xffffff, 0x1f8cff],
        quantity: 1,
        emitting: false,
        maxParticles: 90,
        blendMode: 'ADD'
      }).setDepth(CFG.DEPTH.PARTICLE - 1);

      // 烟
      this.smoke = this.add.particles(0, 0, 'px', {
        lifespan: { min: 260, max: 620 },
        speed: { min: 10, max: 55 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.6, end: 0 },
        alpha: { start: 0.45, end: 0 },
        tint: [0x4d5578, 0x2a2f4a, 0xff4d5e],
        quantity: 1,
        emitting: false,
        maxParticles: 70
      }).setDepth(CFG.DEPTH.PARTICLE - 1);
    }

    createColliders() {
      this.physics.add.overlap(this.pBullets, this.enemies, this.onBulletEnemy, null, this);
      this.physics.add.overlap(this.pBullets, this.bosses, this.onBulletBoss, null, this);
      this.physics.add.overlap(this.player, this.eBullets, this.onPlayerHurt, null, this);
      this.physics.add.overlap(this.player, this.enemies, this.onPlayerCrash, null, this);
      this.physics.add.overlap(this.player, this.bosses, this.onPlayerCrash, null, this);
      this.physics.add.overlap(this.player, this.powers, this.onPickup, null, this);
    }

    /* 触屏拖拽：按住任意位置，飞机保持相对手指的偏移跟随 */
    createInput() {
      var self = this;

      this.input.on('pointerdown', function (p) {
        if (self.run.over) return;
        if (CFG.inZones(p.x, p.y)) return;           // 点在 HUD 按钮上：不操控飞机
        if (self.dragPointer !== null && self.dragPointer !== p.id) return;
        self.dragPointer = p.id;
        var ox = self.player.x - p.x;
        var oy = self.player.y - p.y;
        var d = Math.sqrt(ox * ox + oy * oy);
        // 手指离得太远就吸附到机身上方，避免飞机“瞬移”
        if (d > 80 || !self.player.alive) { ox = 0; oy = -26; }
        self.dragOffX = ox;
        self.dragOffY = oy;
        self.dragTarget(p);
      });

      this.input.on('pointermove', function (p) {
        if (self.dragPointer === p.id) self.dragTarget(p);
      });

      var release = function (p) {
        if (self.dragPointer === p.id) self.dragPointer = null;
      };
      this.input.on('pointerup', release);
      this.input.on('pointerupoutside', release);
    }

    dragTarget(p) {
      this.player.setTarget(p.x + this.dragOffX, p.y + this.dragOffY);
    }

    /* ------------------------------------------------------------------ */
    /* 波次编排                                                            */
    /* ------------------------------------------------------------------ */
    currentDiff() { return Waves.diff(Math.max(1, this.run.wave)); }

    startWave(n) {
      if (this.run.over) return;
      this.run.wave = n;
      this.waveActive = true;
      this.waveEndsAt = 0;
      this.waveClock = 0;
      Bus.emit('hud:wave', n);

      var plan = Waves.build(n);
      this.plan = plan;

      if (plan.boss) {
        Bus.emit('hud:banner', { text: 'WARNING !!', color: CFG.UI.RED, time: 1700 });
        Synth.bossWarn();
        Synth.duckBgm(2.4);
        var self = this;
        this.time.delayedCall(1800, function () { self.spawnBoss(plan.bossIndex, plan.bossHp); });
      } else {
        this.queue = plan.events.slice();
        Bus.emit('hud:banner', { text: 'WAVE ' + n, color: CFG.UI.CYAN, time: 1200 });
      }
    }

    completeWave() {
      if (!this.waveActive) return;
      this.waveActive = false;
      var self = this;
      this.time.delayedCall(1300, function () {
        if (!self.run.over) self.startWave(self.run.wave + 1);
      });
    }

    processQueue(delta) {
      if (!this.queue.length) return;
      this.waveClock += delta / 1000;
      while (this.queue.length && this.queue[0].t <= this.waveClock) {
        var ev = this.queue.shift();
        var o = ev.opts;
        if (o.x === undefined) o.x = Phaser.Math.Between(46, this.W - 46);
        o.canShoot = true;
        this.spawnEnemy(ev.kind, o);
      }
    }

    checkWaveClear(time) {
      if (this.plan && this.plan.boss) return;
      if (this.queue.length > 0) return;
      if (this.enemies.countActive(true) > 0) return;
      if (this.boss) return;
      if (!this.waveEndsAt) { this.waveEndsAt = time + 1000; return; }
      if (time >= this.waveEndsAt) { this.waveEndsAt = 0; this.completeWave(); }
    }

    spawnEnemy(type, opts) {
      if (this.run.over) return null;
      var e = this.enemies.get(opts.x, opts.y === undefined ? -20 : opts.y, CFG.ENEMY[type].tex);
      if (!e) return null;               // 池满：丢弃，保护性能
      e.spawn(type, opts);
      return e;
    }

    spawnBoss(index, hp) {
      if (this.run.over) return;
      var boss = this.bosses.get(this.W / 2, -60, 'boss');
      if (!boss) return;
      this.boss = boss;
      boss.spawn(index, hp);
      this.run.bossAlive = true;
      Bus.emit('hud:boss', { hp: boss.hp, maxHp: boss.maxHp, index: index });
      Bus.emit('hud:banner', { text: 'BOSS LV.' + index, color: CFG.UI.PURPLE, time: 1400 });
    }

    /* ------------------------------------------------------------------ */
    /* 射击                                                                */
    /* ------------------------------------------------------------------ */
    aimAngleAt(x, y, speed) {
      var px = this.player && this.player.alive ? this.player.x : this.W / 2;
      var py = this.player && this.player.alive ? this.player.y : this.H;
      return Math.atan2(px - x, py - y) * (180 / Math.PI);
    }

    fire(time) {
      if (time < this.player.nextFire) return;
      var lvl = this.run.weapon;
      var w = CFG.WEAPONS[lvl];
      this.player.nextFire = time + w.rate;

      var straightTex = lvl <= 2 ? 'pb1' : (lvl <= 4 ? 'pb2' : 'pb3');
      var angledTex = lvl >= 6 ? 'pbw2' : 'pbw';
      var sp = CFG.PLAYER.BULLET_SPEED;

      for (var i = 0; i < w.shot.length; i++) {
        var s = w.shot[i];
        var rad = s.a * D2R;
        this.spawnPBullet(
          this.player.x + s.x, this.player.y - 9,
          Math.sin(rad) * sp, -Math.cos(rad) * sp,
          w.dmg, s.a, s.a === 0 ? straightTex : angledTex
        );
      }
      Synth.shoot(lvl);
    }

    spawnPBullet(x, y, vx, vy, dmg, ang, tex) {
      var b = this.pBullets.get(x, y, tex);
      if (!b) return null;
      b.isPB = true;
      b.damage = dmg;
      b.setTexture(tex);
      b.enableBody(true, x, y, true, true);
      b.setDepth(CFG.DEPTH.BULLET);
      b.setBlendMode(Phaser.BlendModes.ADD);
      b.body.setCircle(2, b.width / 2 - 2, b.height / 2 - 2);
      b.setVelocity(vx, vy);
      b.setAngle(ang);
      return b;
    }

    fireEnemyBullet(x, y, angle, tex, speed) {
      if (this.run.over) return null;
      var b = this.eBullets.get(x, y, tex);
      if (!b) return null;
      b.isEB = true;
      b.setTexture(tex);
      b.enableBody(true, x, y, true, true);
      b.setDepth(CFG.DEPTH.BULLET);
      b.setBlendMode(Phaser.BlendModes.ADD);
      var r = tex === 'eb_big' ? 3 : 2;
      b.body.setCircle(r, b.width / 2 - r, b.height / 2 - r);
      var rad = angle * D2R;
      b.setVelocity(Math.sin(rad) * speed, Math.cos(rad) * speed);
      b.setAngle(-angle);
      return b;
    }

    killBullet(b) {
      if (!b || !b.active) return;
      b.disableBody(true, true);
    }

    /* ------------------------------------------------------------------ */
    /* 命中处理                                                            */
    /* ------------------------------------------------------------------ */
    onBulletEnemy(b, e) {
      if (!b.active || !e.active) return;
      var dmg = b.damage || 1;
      this.killBullet(b);
      this.sparks.emitParticleAt(b.x, b.y - 2, 3);
      Synth.hit();
      if (e.damage(dmg)) this.killEnemy(e);
      else e.flash();
    }

    onBulletBoss(b, boss) {
      if (!b.active || !boss.active || boss.dead) return;
      var dmg = b.damage || 1;
      this.killBullet(b);
      this.sparks.emitParticleAt(b.x, b.y - 2, 4);
      Synth.hit();
      if (boss.damage(dmg)) {
        this.bossDeath(boss);
      } else {
        boss.flash();
        Bus.emit('hud:boss', { hp: boss.hp, maxHp: boss.maxHp, index: boss.index });
      }
    }

    killEnemy(e) {
      var type = e.type, x = e.x, y = e.y, score = e.score, drops = e.drops;
      var big = (type === 'large' || type === 'med');
      e.kill();
      this.run.kills++;
      this.addScore(score);
      this.explode(x, y, type === 'large');
      Synth.explosion(type === 'large' ? 0.75 : (type === 'med' ? 0.5 : 0.28));
      if (big) this.cameras.main.shake(90, 0.005);
      if (Math.random() < drops || type === 'large') this.dropPower(x, y);
    }

    onPlayerCrash(pl, obj) {
      if (!pl.active || !obj.active) return;
      if (obj.damage) {
        var dead = obj.damage(99999);
        if (dead && obj.type !== undefined) this.killEnemy(obj);
      }
      this.hurtPlayer();
    }

    onPlayerHurt(pl, b) {
      if (!b.active) return;
      if (pl.shielded) {
        this.killBullet(b);
        this.sparks.emitParticleAt(b.x, b.y, 4);
        this.shieldSprite.setAlpha(0.45);
        return;
      }
      this.killBullet(b);
      this.hurtPlayer();
    }

    hurtPlayer() {
      var now = this.time.now;
      if (!this.player.alive || this.run.over || now < this.player.invulnUntil) return;

      if (this.player.shielded) {
        this.player.shieldUntil = 0;
        this.shieldSprite.setVisible(false);
        Bus.emit('hud:shield', 0);
        this.cameras.main.shake(160, 0.008);
        this.explode(this.player.x, this.player.y, false);
        this.sparks.emitParticleAt(this.player.x, this.player.y, 14);
        Synth.hit();
        this.player.invulnUntil = now + 500;
        return;
      }
      this.loseLife();
    }

    loseLife() {
      var self = this;
      this.run.lives--;
      Bus.emit('hud:lives', this.run.lives);
      Bus.emit('hud:hurt');
      this.player.alive = false;
      this.player.setVisible(false);
      this.player.setVelocity(0, 0);
      this.player.body.enable = false;
      this.explode(this.player.x, this.player.y, true);
      this.smoke.emitParticleAt(this.player.x, this.player.y, 10);
      this.cameras.main.shake(340, 0.018);
      this.cameras.main.flash(200, 255, 40, 40);
      Synth.explosion(0.9);

      if (this.run.lives <= 0) {
        this.gameOver();
        return;
      }
      this.run.weapon = Math.max(1, this.run.weapon - 1);
      Bus.emit('hud:weapon', this.run.weapon);
      this.time.delayedCall(CFG.PLAYER.RESPAWN_DELAY, function () { self.respawn(); });
    }

    respawn() {
      if (this.run.over) return;
      this.player.alive = true;
      this.player.setVisible(true).setAlpha(1);
      this.player.body.enable = true;
      this.player.setPosition(this.W / 2, this.H - 60);
      this.player.setVelocity(0, 0);
      this.player.setTarget(this.W / 2, this.H - 70);
      this.player.invulnUntil = this.time.now + CFG.PLAYER.INVULN;
      this.dragPointer = null;
      this.player.shieldUntil = this.time.now + 1500;
      Bus.emit('hud:shield', this.player.shieldUntil);
      Synth.pickup();
    }

    gameOver() {
      if (this.run.over) return;
      var self = this;
      this.run.over = true;
      this.queue.length = 0;
      this.run.bossAlive = false;
      Synth.stopBgm();
      Synth.gameOver();
      Bus.emit('hud:over');
      this.cameras.main.shake(600, 0.012);
      this.time.delayedCall(1700, function () {
        self.scene.stop('Hud');
        self.scene.start('Over', {
          score: self.run.score, hi: self.run.hi, wave: self.run.wave, kills: self.run.kills
        });
      });
    }
    /* ------------------------------------------------------------------ */
    /* 道具                                                                */
    /* ------------------------------------------------------------------ */
    dropPower(x, y, forceType) {
      var type = forceType;
      if (!type) {
        var w = CFG.POWER.weights, total = 0, i;
        for (i = 0; i < w.length; i++) total += w[i];
        var r = Math.random() * total, acc = 0;
        for (i = 0; i < w.length; i++) {
          acc += w[i];
          if (r <= acc) { type = CFG.POWER.types[i]; break; }
        }
      }
      var p = this.powers.get(x, y, 'power_' + type);
      if (p) p.spawn(type, x, y);
    }

    onPickup(pl, pow) {
      if (!pow.active) return;
      this.collectPower(pow);
    }

    collectPower(p) {
      var type = p.pkind;
      var label = '';
      var color = 0xffffff;
      var self = this;

      switch (type) {
        case 'spread':
          if (this.run.weapon < CFG.PLAYER.MAX_WEAPON) {
            this.run.weapon++;
            Bus.emit('hud:weapon', this.run.weapon);
            label = 'POWER ' + this.run.weapon;
          } else {
            this.addScore(300);
            label = 'SCORE 300';
          }
          color = 0xffe66d;
          break;

        case 'shield':
          this.player.shieldUntil = this.time.now + CFG.PLAYER.SHIELD_TIME;
          Bus.emit('hud:shield', this.player.shieldUntil);
          label = 'SHIELD';
          color = 0x3ce0ff;
          break;

        case 'bomb':
          if (this.run.bombs < CFG.PLAYER.MAX_BOMBS) this.run.bombs++;
          Bus.emit('hud:bombs', this.run.bombs);
          label = 'BOMB +1';
          color = 0xff4d5e;
          break;

        case 'heal':
          if (this.run.lives < CFG.PLAYER.MAX_LIVES) {
            this.run.lives++;
            Bus.emit('hud:lives', this.run.lives);
            label = 'LIFE +1';
          } else {
            this.addScore(500);
            label = 'SCORE 500';
          }
          color = 0x63f28a;
          break;
        default:
          break;
      }

      p.kill();
      this.addScore(CFG.POWER.score);
      Synth.pickup();
      this.sparks.emitParticleAt(p.x, p.y, 8);

      var t = this.add.bitmapText(p.x, p.y - 4, 'pixel', label);
      t.setOrigin(0.5, 1).setTint(color).setDepth(CFG.DEPTH.FX + 2);
      this.tweens.add({
        targets: t, y: t.y - 20, alpha: 0, duration: 750, ease: 'Quad.easeOut',
        onComplete: function () { t.destroy(); }
      });
    }

    /* ------------------------------------------------------------------ */
    /* 炸弹                                                                */
    /* ------------------------------------------------------------------ */
    useBomb() {
      if (this.run.over || this.paused) return;
      if (this.run.bombs <= 0 || !this.player.alive) return;
      this.run.bombs--;
      Bus.emit('hud:bombs', this.run.bombs);
      Synth.bomb();

      this.cameras.main.flash(320, 255, 255, 255);
      this.cameras.main.shake(520, 0.014);
      this.showShock(this.player.x, this.player.y);
      this.smoke.emitParticleAt(this.player.x, this.player.y, 14);

      var i, list;
      list = this.eBullets.getChildren();
      for (i = 0; i < list.length; i++) {
        if (list[i].active) {
          this.sparks.emitParticleAt(list[i].x, list[i].y, 2);
          this.killBullet(list[i]);
        }
      }
      list = this.enemies.getChildren();
      for (i = 0; i < list.length; i++) {
        if (!list[i].active) continue;
        if (list[i].damage(30)) this.killEnemy(list[i]);
      }
      if (this.boss && !this.boss.dead && this.boss.active) {
        if (this.boss.damage(110)) this.bossDeath(this.boss);
        else {
          this.boss.flash();
          Bus.emit('hud:boss', { hp: this.boss.hp, maxHp: this.boss.maxHp, index: this.boss.index });
        }
      }
      this.player.invulnUntil = Math.max(this.player.invulnUntil, this.time.now + 900);
    }

    /* ------------------------------------------------------------------ */
    /* Boss 死亡演出                                                       */
    /* ------------------------------------------------------------------ */
    bossDeath(boss) {
      var self = this;
      boss.die();
      this.run.bossAlive = false;
      Bus.emit('hud:bosshide');
      this.addScore(5000 + (boss.index || 1) * 1500);
      Synth.explosion(1);
      this.cameras.main.flash(340, 255, 160, 60);

      var n = 0;
      this.time.addEvent({
        delay: 120, repeat: 13,
        callback: function () {
          n++;
          self.explode(boss.x + Phaser.Math.Between(-38, 38), boss.y + Phaser.Math.Between(-18, 18), n % 2 === 0);
          Synth.explosion(0.35 + n * 0.04);
          self.cameras.main.shake(110, 0.007);
        }
      });

      this.time.delayedCall(1900, function () {
        self.explode(boss.x, boss.y, true);
        self.explode(boss.x - 22, boss.y + 6, true);
        self.explode(boss.x + 22, boss.y - 6, true);
        self.cameras.main.shake(700, 0.02);
        self.cameras.main.flash(420, 255, 255, 255);
        Synth.explosion(1);
        if (boss.scene) boss.destroyBoss();
        self.boss = null;
        self.dropPower(boss.x - 34, boss.y, 'spread');
        self.dropPower(boss.x + 34, boss.y, Math.random() < 0.5 ? 'shield' : 'heal');
        self.dropPower(boss.x, boss.y + 14, 'bomb');
        Bus.emit('hud:banner', { text: 'BOSS DOWN', color: CFG.UI.GOLD, time: 1500 });
        self.completeWave();
        Synth.startBgm();
      });
    }

    /* ------------------------------------------------------------------ */
    /* 特效                                                                */
    /* ------------------------------------------------------------------ */
    explode(x, y, big) {
      var s = this.explosions.get(x, y, big ? 'exp_big' : 'exp_small');
      if (!s) return;
      s.setTexture(big ? 'exp_big' : 'exp_small');
      s.setActive(true).setVisible(true);
      s.setDepth(CFG.DEPTH.FX);
      s.setBlendMode(big ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
      s.setAngle(Phaser.Math.Between(0, 3) * 90);
      s.setScale(1);
      s.off('animationcomplete');
      s.play(big ? 'expBig' : 'expSmall', true);
      s.once('animationcomplete', function () { s.setActive(false); s.setVisible(false); });
      this.sparks.emitParticleAt(x, y, big ? 12 : 5);
      if (big) this.smoke.emitParticleAt(x, y, 5);
    }

    showShock(x, y) {
      var s = this.shocks.get(x, y, 'shock');
      if (!s) return;
      s.setTexture('shock');
      s.setActive(true).setVisible(true);
      s.setDepth(CFG.DEPTH.FX + 1);
      s.setBlendMode(Phaser.BlendModes.ADD);
      s.setScale(1);
      s.off('animationcomplete');
      s.play('shock', true);
      s.once('animationcomplete', function () { s.setActive(false); s.setVisible(false); });
    }

    addScore(n) {
      this.run.score += n;
      Bus.emit('hud:score', this.run.score);
      if (this.run.score > this.run.hi) {
        this.run.hi = this.run.score;
        writeHi(this.run.hi);
        Bus.emit('hud:hi', this.run.hi);
      }
    }

    /* ------------------------------------------------------------------ */
    /* 每帧                                                                */
    /* ------------------------------------------------------------------ */
    updateGroup(group, time, delta) {
      var list = group.getChildren();
      for (var i = 0; i < list.length; i++) {
        if (list[i].active) list[i].update(time, delta);
      }
    }

    update(time, delta) {
      var dt = delta / 1000;
      this.bg.update(dt, this.run.bossAlive ? 1.8 : 1);

      if (this.run.over) {
        this.updateGroup(this.bosses, time, delta);
        return;
      }

      this.processQueue(delta);
      this.updateGroup(this.enemies, time, delta);
      this.updateGroup(this.powers, time, delta);
      this.updateGroup(this.bosses, time, delta);
      this.player.update(time, delta);

      if (this.player.alive) {
        this.fire(time);
        if (time > this.thrustAt) {
          this.thrustAt = time + 45;
          this.thrust.emitParticleAt(this.player.x, this.player.y + 8, 1);
        }
      }

      // 护盾环
      if (this.player.shielded) {
        var left = this.player.shieldUntil - time;
        this.shieldSprite.setVisible(true);
        this.shieldSprite.setPosition(this.player.x, this.player.y);
        this.shieldSprite.setAlpha(left < 1800 ? 0.35 + 0.5 * Math.abs(Math.sin(time / 90)) : 0.9);
        this.shieldSprite.setAngle(-(time / 18) % 360);
      } else if (this.shieldSprite.visible) {
        this.shieldSprite.setVisible(false);
        Bus.emit('hud:shield', 0);
      }

      this.cullBullets();
      if (this.waveActive) this.checkWaveClear(time);
    }

    cullBullets() {
      var i, b, list = this.pBullets.getChildren();
      for (i = 0; i < list.length; i++) {
        b = list[i];
        if (!b.active) continue;
        if (b.y < -24 || b.y > this.H + 24 || b.x < -24 || b.x > this.W + 24) this.killBullet(b);
      }
      list = this.eBullets.getChildren();
      for (i = 0; i < list.length; i++) {
        b = list[i];
        if (!b.active) continue;
        if (b.y < -24 || b.y > this.H + 24 || b.x < -24 || b.x > this.W + 24) this.killBullet(b);
      }
    }

    /* ------------------------------------------------------------------ */
    togglePause() {
      if (this.run.over) return;
      this.paused = !this.paused;
      if (this.paused) this.scene.pause();
      else this.scene.resume();
      Bus.emit('hud:paused', this.paused);
    }

    snapshot() {
      return {
        score: this.run.score,
        hi: this.run.hi,
        lives: this.run.lives,
        bombs: this.run.bombs,
        weapon: this.run.weapon,
        wave: this.run.wave,
        paused: this.paused,
        shield: this.player && this.player.shielded ? this.player.shieldUntil : 0,
        boss: this.boss && !this.boss.dead ? { hp: this.boss.hp, maxHp: this.boss.maxHp } : null
      };
    }
  }

  window.GameScene = GameScene;
})();
