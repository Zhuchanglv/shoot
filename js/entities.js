/* =========================================================================
 * PIXEL SHOOTER — entities.js
 * 玩家 / 敌机 / 道具 / Boss 的实体类（全部用对象池复用，见 GameScene）
 * ========================================================================= */
(function () {
  'use strict';

  var CFG = window.CFG;
  var D2R = Math.PI / 180;
  var R2D = 180 / Math.PI;

  /* =====================================================================
   * 玩家
   * =================================================================== */
  class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
      super(scene, x, y, 'ship');
      this.setDepth(CFG.DEPTH.PLAYER);
      this.alive = true;
      this.targetX = x;
      this.targetY = y;
      this.nextFire = 0;
      this.invulnUntil = 0;
      this.shieldUntil = 0;
      this.blinkT = 0;
      this.bank = 0;
    }

    initBody() {
      this.body.setCircle(CFG.PLAYER.RADIUS, 13 / 2 - CFG.PLAYER.RADIUS, 14 / 2 - CFG.PLAYER.RADIUS);
      this.body.setCollideWorldBounds(false);
    }

    setTarget(x, y) {
      this.targetX = CFG.clamp(x, 14, CFG.W - 14);
      this.targetY = CFG.clamp(y, 26, CFG.H - 18);
    }

    get shielded() { return this.scene.time.now < this.shieldUntil; }

    /** 拖拽跟随：速度驱动，物理判定与贴图始终同步 */
    update(time, delta) {
      if (!this.alive) { this.setVelocity(0, 0); return; }
      var dx = this.targetX - this.x;
      var dy = this.targetY - this.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        var sp = Math.min(CFG.PLAYER.SPEED, dist * 18);
        this.setVelocity((dx / dist) * sp, (dy / dist) * sp);
      } else {
        this.setVelocity(0, 0);
      }

      // 侧倾视觉反馈
      var want = CFG.clamp(this.body.velocity.x / 420, -1, 1) * 7;
      this.bank += (want - this.bank) * Math.min(1, delta / 90);
      this.setAngle(this.bank);

      // 无敌闪烁
      if (time < this.invulnUntil) {
        this.blinkT += delta;
        this.setAlpha(Math.floor(this.blinkT / 80) % 2 === 0 ? 0.25 : 1);
      } else if (this.alpha !== 1) {
        this.setAlpha(1);
      }
    }
  }

  /* =====================================================================
   * 敌机
   * =================================================================== */
  class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture) {
      super(scene, x, y, texture);
      this.setDepth(CFG.DEPTH.ENEMY);
    }

    spawn(type, o) {
      var base = CFG.ENEMY[type];
      var d = o.diff || { hp: 1, speed: 1, fire: 1 };
      this.type = type;
      this.tex = base.tex;
      this.score = base.score;
      this.maxHp = Math.max(1, Math.round(base.hp * d.hp));
      this.hp = this.maxHp;
      this.speed = base.speed * d.speed;
      this.fireMult = d.fire;
      this.radius = base.r;
      this.drops = base.drops;
      this.pattern = o.pattern || 'straight';
      this.canShoot = o.canShoot !== false;

      this.setTexture(base.tex);
      this.enableBody(true, o.x, o.y, true, true);
      this.setDepth(CFG.DEPTH.ENEMY);
      this.setAlpha(1).setAngle(0).setScale(1).clearTint();
      this.body.setCircle(base.r, this.width / 2 - base.r, this.height / 2 - base.r);

      this.t = 0;
      this.baseX = o.x;
      this.baseY = o.y;
      this.targetX = o.targetX === undefined ? o.x : o.targetX;
      this.holdY = o.holdY || 130;
      this.drift = o.drift || 1;
      this.sineAmp = o.sineAmp || 18;
      this.sineFreq = o.sineFreq || 2;
      this.entered = false;
      this.life = 0;
      this.flashToken = 0;
      this.nextShot = (this.pattern === 'turret' ? 700 : 1200) + Math.random() * 900;

      if (this.pattern === 'straight') this.setVelocity(0, this.speed);
      else if (this.pattern === 'converge') this.setVelocity((this.targetX < o.x ? -1 : 1) * this.speed * 0.75, this.speed);
      else if (this.pattern === 'dive') this.diveInit();
      else this.setVelocity(0, this.speed);
    }

    diveInit() {
      var gs = this.scene;
      var px = gs.player ? gs.player.x : CFG.W / 2;
      var dx = px - this.x;
      var dy = Math.max(120, CFG.H * 0.6 - this.y);
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var sp = this.speed * 1.7;
      this.setVelocity((dx / len) * sp, (dy / len) * sp);
      var a = Math.atan2(this.body.velocity.y, this.body.velocity.x) * R2D - 90;
      this.setAngle(a);
    }

    update(time, delta) {
      var dt = delta / 1000;
      this.t += dt;
      this.life += delta;

      switch (this.pattern) {
        case 'sine':
          this.setVelocity(Math.cos(this.t * this.sineFreq) * this.sineAmp * this.sineFreq, this.speed);
          break;
        case 'converge':
          if (Math.abs(this.x - this.targetX) < 6) this.setVelocity(0, this.speed);
          break;
        case 'dive':
          break;
        case 'turret':
          if (!this.entered) {
            if (this.y >= this.holdY) { this.entered = true; this.setVelocity(this.drift * this.speed * 0.85, 0); }
          } else {
            if (this.x < 26 && this.drift < 0) this.drift = 1;
            if (this.x > CFG.W - 26 && this.drift > 0) this.drift = -1;
            this.setVelocity(this.drift * this.speed * 0.85, Math.sin(this.t * 2) * 12);
            if (this.life > 11000) { this.setVelocity(this.drift * this.speed * 0.5, this.speed); }
          }
          break;
        case 'heavy':
          if (!this.entered) {
            if (this.y >= this.holdY) { this.entered = true; }
            else this.setVelocity(0, this.speed);
          } else {
            if (this.x < 40 && this.drift < 0) this.drift = 1;
            if (this.x > CFG.W - 40 && this.drift > 0) this.drift = -1;
            this.setVelocity(this.drift * this.speed * 0.7, Math.sin(this.t * 1.4) * 10);
            if (this.life > 14000) this.setVelocity(this.drift * this.speed * 0.4, this.speed);
          }
          break;
        default:
          break;
      }

      if (this.canShoot && this.y > 14 && this.y < CFG.H * 0.78) {
        this.nextShot -= delta;
        if (this.nextShot <= 0) this.shoot();
      }

      // 出屏回收
      if (this.y > CFG.H + 40 || this.x < -70 || this.x > CFG.W + 70) this.kill();
    }

    shoot() {
      var gs = this.scene;
      var mult = Math.max(0.55, 1 / Math.max(0.4, this.fireMult));
      if (this.type === 'med') {
        gs.fireEnemyBullet(this.x, this.y + 6, gs.aimAngleAt(this.x, this.y, 190), 'eb_orb', 190);
        this.nextShot = (1700 + Math.random() * 700) * mult;
      } else if (this.type === 'large') {
        var base = gs.aimAngleAt(this.x, this.y, 170);
        for (var i = -1; i <= 1; i++) {
          gs.fireEnemyBullet(this.x, this.y + 8, base + i * 16, 'eb_orb', 170);
        }
        if (this.hp < this.maxHp * 0.5) {
          gs.fireEnemyBullet(this.x, this.y + 8, base, 'eb_big', 145);
        }
        this.nextShot = (2100 + Math.random() * 800) * mult;
      } else {
        if (gs.run.wave >= 4) {
          gs.fireEnemyBullet(this.x, this.y + 5, gs.aimAngleAt(this.x, this.y, 200), 'eb_orb', 200);
        }
        this.nextShot = (2400 + Math.random() * 1100) * mult;
      }
      window.Synth.enemyShoot();
    }

    damage(n) {
      this.hp -= n;
      return this.hp <= 0;
    }

    flash() {
      var token = ++this.flashToken;
      var self = this;
      this.setTintFill(0xffffff);
      this.scene.time.delayedCall(55, function () {
        if (self.flashToken === token) self.clearTint();
      });
    }

    kill() {
      this.flashToken++;
      this.clearTint();
      this.disableBody(true, true);
    }
  }

  /* =====================================================================
   * 道具
   * =================================================================== */
  class PowerUp extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture) {
      super(scene, x, y, texture);
      this.setDepth(CFG.DEPTH.POWER);
    }

    spawn(type, x, y) {
      this.pkind = type;
      this.setTexture('power_' + type);
      this.enableBody(true, x, y, true, true);
      this.setDepth(CFG.DEPTH.POWER);
      this.setAngle(0).setScale(1).setAlpha(1);
      this.body.setCircle(6, 0.5, 0.5);
      this.t = Math.random() * 3;
      this.setVelocity(0, CFG.POWER.FALL);
      return this;
    }

    update(time, delta) {
      this.t += delta / 1000;
      this.setVelocity(Math.sin(this.t * 2.2) * 26, CFG.POWER.FALL);
      this.setScale(1 + Math.sin(this.t * 6) * 0.09);
      if (this.y > CFG.H + 20) this.kill();
    }

    kill() { this.disableBody(true, true); }
  }

  /* =====================================================================
   * Boss
   * =================================================================== */
  var PHASE = {
    1: { spreadN: 5, spreadCd: 1600, aimedN: 3, aimedCd: 2700, radialN: 0, radialCd: 99999, minionCd: 99999, speed: 62 },
    2: { spreadN: 7, spreadCd: 1350, aimedN: 4, aimedCd: 2200, radialN: 10, radialCd: 5400, minionCd: 7600, speed: 82 },
    3: { spreadN: 9, spreadCd: 1080, aimedN: 5, aimedCd: 1750, radialN: 14, radialCd: 3800, minionCd: 9600, speed: 104 }
  };

  class Boss extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture) {
      super(scene, x, y, texture);
    }

    spawn(index, hp) {
      this.index = index;
      this.maxHp = hp;
      this.hp = hp;
      this.dead = false;
      this.state = 'enter';
      this.phase = 1;
      this.phaseLock = 0;
      this.t = 0;
      this.dir = Math.random() < 0.5 ? -1 : 1;
      this.rateMult = Math.max(0.7, 1 - (index - 1) * 0.08);
      this.cd = { spread: 1400, aimed: 2300, radial: 4200, minion: 5200 };
      this.flashToken = 0;

      this.setTexture('boss');
      this.enableBody(true, CFG.W / 2, -60, true, true);
      this.setDepth(CFG.DEPTH.ENEMY);
      this.clearTint().setAlpha(1).setAngle(0).setScale(1);
      this.body.setSize(74, 32);
      this.body.setOffset(3, 2);
      this.setVelocity(0, 70);

      if (!this.core || !this.core.scene) {
        this.core = this.scene.add.sprite(this.x, this.y, 'boss_core');
        this.core.play('corePulse');
        this.core.setDepth(CFG.DEPTH.ENEMY + 1);
      }
      this.core.setVisible(true).setAlpha(1);
      return this;
    }

    update(time, delta) {
      if (this.dead) { this.syncCore(); return; }
      var p = PHASE[this.phase];
      this.t += delta / 1000;

      if (this.state === 'enter') {
        if (this.y >= 96) { this.y = 96; this.state = 'fight'; this.setVelocity(0, 0); }
      } else {
        if (this.x < 62 && this.dir < 0) this.dir = 1;
        if (this.x > CFG.W - 62 && this.dir > 0) this.dir = -1;
        this.setVelocity(this.dir * p.speed, Math.sin(this.t * 1.5) * 14);

        // 阶段切换
        var ratio = this.hp / this.maxHp;
        var want = ratio > 0.66 ? 1 : (ratio > 0.33 ? 2 : 3);
        if (want > this.phase && time > this.phaseLock) {
          this.phase = want;
          this.phaseLock = time + 900;
          this.onPhase();
        }

        // 开火节奏
        var m = this.rateMult;
        this.cd.spread -= delta;
        this.cd.aimed -= delta;
        this.cd.radial -= delta;
        this.cd.minion -= delta;
        if (this.cd.spread <= 0) { this.fireSpread(); this.cd.spread = p.spreadCd * m; }
        if (this.cd.aimed <= 0) { this.fireAimed(); this.cd.aimed = p.aimedCd * m; }
        if (this.cd.radial <= 0 && p.radialN > 0) { this.fireRadial(p.radialN); this.cd.radial = p.radialCd * m; }
        if (this.cd.minion <= 0 && p.minionCd < 90000) { this.spawnMinions(); this.cd.minion = p.minionCd; }
      }
      this.syncCore();
    }

    syncCore() {
      if (!this.core) return;
      this.core.setPosition(this.x, this.y + 2);
      this.core.setVisible(this.visible && this.active);
    }

    onPhase() {
      var gs = this.scene;
      gs.cameras.main.shake(320, 0.010);
      this.setTintFill(0xffffff);
      var self = this;
      gs.time.delayedCall(90, function () { if (!self.dead) self.clearTint(); });
      for (var i = 0; i < 8; i++) {
        gs.explode(this.x + Phaser.Math.Between(-40, 40), this.y + Phaser.Math.Between(-16, 16), false);
      }
      this.fireRadial(this.phase === 3 ? 16 : 12);
      window.Synth.explosion(0.5);
    }

    fireSpread() {
      var gs = this.scene;
      var n = PHASE[this.phase].spreadN;
      var step = 13;
      var start = -(n - 1) / 2 * step;
      for (var i = 0; i < n; i++) {
        gs.fireEnemyBullet(this.x, this.y + 16, start + i * step, 'eb_big', 175);
      }
      window.Synth.enemyShoot();
    }

    fireAimed() {
      var gs = this.scene;
      var n = PHASE[this.phase].aimedN;
      var base = gs.aimAngleAt(this.x, this.y + 12, 205);
      for (var i = 0; i < n; i++) {
        gs.fireEnemyBullet(this.x + (i - (n - 1) / 2) * 16, this.y + 14, base, 'eb_orb', 205);
      }
      window.Synth.enemyShoot();
    }

    fireRadial(n) {
      var gs = this.scene;
      for (var i = 0; i < n; i++) {
        gs.fireEnemyBullet(this.x, this.y + 4, (360 / n) * i, 'eb_orb', 130);
      }
      window.Synth.enemyShoot();
    }

    spawnMinions() {
      var gs = this.scene;
      gs.spawnEnemy('small2', { x: this.x - 52, y: this.y - 6, pattern: 'dive', diff: gs.currentDiff() });
      gs.spawnEnemy('small2', { x: this.x + 52, y: this.y - 6, pattern: 'dive', diff: gs.currentDiff() });
    }

    damage(n) {
      if (this.dead) return false;
      this.hp -= n;
      return this.hp <= 0;
    }

    flash() {
      var token = ++this.flashToken;
      var self = this;
      this.setTintFill(0xffffff);
      this.scene.time.delayedCall(40, function () {
        if (self.flashToken === token && !self.dead) self.clearTint();
      });
    }

    die() {
      this.dead = true;
      this.setActive(false);
      this.setVelocity(0, 0);
      if (this.body) this.body.enable = false;
      this.setTint(0x666666);
    }

    destroyBoss() {
      if (this.core) { this.core.destroy(); this.core = null; }
      this.destroy();
    }
  }

  window.Player = Player;
  window.Enemy = Enemy;
  window.PowerUp = PowerUp;
  window.Boss = Boss;
})();
