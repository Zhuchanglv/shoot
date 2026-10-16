/* =========================================================================
 * PIXEL SHOOTER — art.js
 * 全部像素美术在运行时用 Canvas 生成并注册为「精灵表」（sprite sheet），
 * 因此项目零外部素材、零 CORS 问题，可直接静态部署。
 *
 *  - Art.def        : 原始美术数据（像素行 / 程序化绘制函数）
 *  - Art.buildAll   : 在 BootScene 里一次性生成所有贴图
 *  - Art.renderPreview : 给 dev/sprite-preview.html 用的预览渲染
 * ========================================================================= */
(function () {
  'use strict';

  var CFG = window.CFG;
  var PAL = CFG.PALETTE;

  var rep = function (c, n) { return n > 0 ? new Array(n + 1).join(c) : ''; };
  /** 半宽行拼接：hr(4,'.', 3,'e') -> '....eee'（左右镜像后得到对称的 Boss 外壳） */
  var hr = function () {
    var s = '';
    for (var i = 0; i < arguments.length; i += 2) { s += rep(arguments[i + 1], arguments[i]); }
    return s;
  };

  /* =====================================================================
   * 1. 玩家 / 敌机 / Boss
   * =================================================================== */
  var SHIP = [
    '......9......',
    '.....999.....',
    '.....949.....',
    '....99499....',
    '....99499....',
    '...a99999a...',
    '..aa99999aa..',
    '..aa49994aa..',
    '.baa99999aab.',
    'bbaa99999aabb',
    'bbbaa999aabbb',
    '..baa999aab..',
    '...aa999aa...',
    '....a999a....'
  ];

  var E_SMALL = [
    '...5...5...',
    '..55...55..',
    '.555555555.',
    '55555555555',
    '.555585555.',
    '..5555555..',
    '...55555...',
    '....555....',
    '.....5.....'
  ];

  var E_SMALL2 = [
    '...c...c...',
    '..cc...cc..',
    '.ccccccccc.',
    'ccccccccccc',
    '.cccc4cccc.',
    '..ccccccc..',
    '...ccccc...',
    '....ccc....',
    '.....d.....'
  ];

  var E_MED = [
    '.....e...e.....',
    '....eee.eee....',
    '...eeeeeeeee...',
    '..eeefeeefeee..',
    '.eeeeeeffeeeee.',
    'eefeeeeefeeefee',
    '.eeeee4f4eeeee.',
    '..eeeeeeeeeee..',
    '...eeeeeeeee...',
    '....e.eee.e....',
    '......e.e......',
    '.......e.......',
    '......f.f......'
  ];

  var E_LARGE = [
    '.....c.........c.....',
    '....ccc.......ccc....',
    '...ccccc.....ccccc...',
    '..ccccccccccccccccc..',
    'ccccccccccccccccccccc',
    'ccdcccccccccccccccdcc',
    'ccddcccccccccccccddcc',
    'ccddcccccccccccccddcc',
    'cccdcccccc2ccccccdccc',
    'cccddccccc4ccccccddcc',
    'ccccddccccccccccddccc',
    'ccccc.ddcccccccdd.ccc',
    'ccccccccccccccccccccc',
    'c.ccccccccccccccccc.c',
    '...ccccc.ccc.ccccc...',
    '....ccc...c...ccc....'
  ];

  // Boss 外壳：程序化生成左半（40x40），随后左右镜像成 80x40。
  // 采用「左上光源」自动描边：朝上的边高光 '3'、朝下的边暗影 '1'，
  // 中央为明亮的脊线，因而深色背景上剪影清晰（不再是一团灰）。
  function bossHalf() {
    var W = 40, H = 40, x, y;
    // 机身左边界（每行最左列；0 = 最宽）
    var FUS = [
      28, 26, 24, 22, 21, 20, 20, 20, 20, 20,
      20, 20, 20, 20, 20, 20, 20, 20, 20, 20,
      20, 20, 20, 20, 20, 21, 22, 23, 24, 25,
      26, 27, 28, 29, 30, 31, 32, 32, 33, 34
    ];
    // 机翼左边界（缺省 = 该行无机翼）；后掠翼造型
    var WING = {
      9: 16, 10: 10, 11: 6, 12: 3, 13: 1, 14: 0, 15: 0,
      16: 0, 17: 0, 18: 0, 19: 2, 20: 6
    };
    var g = [];
    for (y = 0; y < H; y++) {
      g.push([]);
      for (x = 0; x < W; x++) { g[y].push('.'); }
    }
    function put(x, y, c) { if (x >= 0 && x < W && y >= 0 && y < H) { g[y][x] = c; } }
    function solid(x, y) { return x >= 0 && x < W && y >= 0 && y < H && g[y][x] !== '.'; }
    function onHull(x, y, c) { if (solid(x, y)) { g[y][x] = c; } }

    // 1) 机身 + 机翼填充
    for (y = 0; y < H; y++) {
      var w0 = WING[y] === undefined ? FUS[y] : WING[y];
      var x0 = FUS[y] < w0 ? FUS[y] : w0;
      for (x = x0; x < W; x++) { g[y][x] = '2'; }
    }
    // 2) 左上光源自动描边（第 39 列与镜像相连，不算边缘）
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        if (!solid(x, y)) continue;
        if (!solid(x, y - 1)) g[y][x] = '3';
        else if (!solid(x, y + 1)) g[y][x] = '1';
        else if (!solid(x - 1, y)) g[y][x] = '3';
        else if (!solid(x + 1, y) && x < W - 1) g[y][x] = '1';
      }
    }
    // 3) 中央脊线
    for (y = 4; y <= 38; y++) { onHull(37, y, '1'); onHull(38, y, '3'); onHull(39, y, '3'); }
    // 4) 尾部引擎：喷焰 + 喷口
    for (y = 0; y <= 1; y++) { for (x = 30; x <= 34; x++) { onHull(x, y, '7'); } }
    for (x = 31; x <= 33; x++) { onHull(x, 0, '8'); }
    onHull(32, 1, '8'); onHull(33, 1, '8');
    for (x = 30; x <= 34; x++) { onHull(x, 2, '0'); onHull(x, 3, '0'); }
    onHull(29, 2, '1'); onHull(29, 3, '1'); onHull(35, 2, '1'); onHull(35, 3, '1');
    // 5) 翼下引擎舱（紫）与翼尖（红）
    for (y = 13; y <= 18; y++) {
      onHull(6, y, '1'); onHull(7, y, 'f'); onHull(8, y, 'e');
      onHull(9, y, 'e'); onHull(10, y, 'f'); onHull(11, y, '1');
    }
    for (x = 7; x <= 10; x++) { onHull(x, 13, (x === 8 || x === 9) ? '8' : 'e'); onHull(x, 18, '0'); }
    for (y = 14; y <= 18; y++) { onHull(0, y, '5'); onHull(1, y, '5'); onHull(2, y, '6'); onHull(3, y, '1'); }
    // 6) 装甲分缝 + 机首红色标识
    for (x = 30; x <= 35; x++) { onHull(x, 8, '1'); }
    for (x = 27; x <= 34; x++) { onHull(x, 12, '1'); }
    onHull(34, 30, '5'); onHull(34, 31, '5'); onHull(35, 30, '6');
    // 7) 中央反应堆核心（青蓝发光）
    for (y = 13; y <= 30; y++) {
      for (x = 30; x <= 39; x++) {
        if (!solid(x, y)) continue;
        var dx = x - 39, dy = y - 21.5;
        var r = Math.sqrt(dx * dx + dy * dy);
        if (r <= 1.8) put(x, y, '4');
        else if (r <= 3.0) put(x, y, '9');
        else if (r <= 4.3) put(x, y, 'a');
        else if (r <= 5.3) put(x, y, '1');
      }
    }
    return g.map(function (row) { return row.join(''); });
  }

  // 左右镜像
  function mirror(rows) {
    return rows.map(function (r) {
      var out = '';
      for (var i = r.length - 1; i >= 0; i--) { out += r.charAt(i); }
      return r + out;
    });
  }

  var BOSS = mirror(bossHalf()); // 80 x 40

  /* =====================================================================
   * 2. 子弹 / 道具胶囊 / 图标
   * =================================================================== */
  var BULLET_A = [ // 3x9 主武器子弹（A=外圈色, B=芯色）
    '.A.',
    '.B.',
    'BAB',
    'BAB',
    'BAB',
    'BAB',
    'BAB',
    '.A.',
    '.A.'
  ];

  var BULLET_W = [ // 5x11 侧翼散弹
    '..A..',
    '.BAB.',
    'AABAA',
    'AABAA',
    'AABAA',
    'AABAA',
    'AABAA',
    'AABAA',
    '.BAB.',
    '..A..',
    '..A..'
  ];

  var EB_ORB = [
    '.AAA.',
    'ABBBA',
    'AB8BA',
    'ABBBA',
    '.AAA.'
  ];

  var EB_BIG = [
    '..AAA..',
    '.AABAA.',
    'AAB4BAA',
    'AB444BA',
    'AAB4BAA',
    '.AABAA.',
    '..AAA..'
  ];

  var EB_BEAM = [
    '.AAA.',
    'AB8BA',
    'AB8BA',
    'AB8BA',
    'AB8BA',
    'AB8BA',
    'AB8BA',
    'AB8BA',
    'AB8BA',
    'AB8BA',
    '.AAA.'
  ];

  // 道具胶囊上的符号（7x7 掩码）
  var SYM = {
    spread: ['...7...', '..777..', '.77777.', '7777777', '...7...', '...7...', '...7...'],
    shield: ['..777..', '.77777.', '7777777', '7777777', '.77777.', '..777..', '...7...'],
    bomb:   ['...7...', '..77...', '.77777.', '7777777', '7777777', '.77777.', '..777..'],
    heal:   ['...7...', '...7...', '.77777.', '7777777', '.77777.', '...7...', '...7...']
  };

  var LIFE = [
    '.AA...AA.',
    'AAAA.AAAA',
    'AAAAAAAAA',
    'AAAAAAAAA',
    '.AAAAAAA.',
    '..AAAAA..',
    '...AAA...',
    '....A....'
  ];

  var ICON_BOMB = [
    '.....8.....',
    '....888....',
    '....888....',
    '..5555555..',
    '.555555555.',
    '55555555555',
    '55566666555',
    '55665556555',
    '55566666555',
    '.555555555.',
    '..5555555..'
  ];

  var ICON_HEART = LIFE;

  var ICON_SND_ON = [
    '...4.......',
    '..44...4...',
    '.444..4.4..',
    '4444.4...4.',
    '4444.4...4.',
    '4444.4...4.',
    '.444..4.4..',
    '..44...4...',
    '...4.......'
  ];

  var ICON_SND_OFF = [
    '...4.......',
    '..44.......',
    '.444..6..6.',
    '4444...66..',
    '4444...66..',
    '4444..6..6.',
    '.444.......',
    '..44.......',
    '...4.......'
  ];

  var ICON_FULL = [
    '333.....333',
    '3.........3',
    '3.........3',
    '...........',
    '...........',
    '...........',
    '3.........3',
    '3.........3',
    '333.....333'
  ];

  var ICON_PAUSE = [
    '..44...44..',
    '..44...44..',
    '..44...44..',
    '..44...44..',
    '..44...44..',
    '..44...44..',
    '..44...44..',
    '..44...44..'
  ];

  var ICON_PLAY = [
    '..44.......',
    '..4444.....',
    '..444444...',
    '..44444444.',
    '..44444444.',
    '..44444444.',
    '..444444...',
    '..4444.....',
    '..44.......'
  ];

  /* =====================================================================
   * 3. 程序化绘制（爆炸 / 星空 / 护盾 / 冲击波）
   * =================================================================== */
  // 固定种子随机，保证每次生成一致
  var seed = 1337;
  function rand() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }
  function resetSeed(s) { seed = s || 1337; }

  function put(ctx, x, y, w, h, color, alpha) {
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  }

  /** 像素爆炸帧：t=0 起爆 -> t=1 熄灭 */
  function explosionFrame(ctx, ox, oy, w, h, i, n, big) {
    var cx = ox + w / 2 - 0.5;
    var cy = oy + h / 2 - 0.5;
    var t = i / (n - 1);
    var maxR = (w / 2) - 1;
    var r = maxR * Math.pow(t, 0.55);
    var dots = big ? 26 : 16;
    var s = big ? 2 : 1;
    var colors = ['#ffffff', '#ffe66d', '#ffa63d', '#ff4d5e', '#a01230'];
    // 中心白闪
    if (t < 0.35) {
      var cs = Math.round((1 - t / 0.35) * (big ? 6 : 3));
      put(ctx, cx - cs / 2, cy - cs / 2, cs, cs, '#ffffff', 1);
    }
    var fade = 1 - t;
    for (var d = 0; d < dots; d++) {
      var a = (d / dots) * Math.PI * 2 + rand() * 0.5;
      var rr = r * (0.75 + rand() * 0.35);
      var px = Math.round(cx + Math.cos(a) * rr - s / 2);
      var py = Math.round(cy + Math.sin(a) * rr - s / 2);
      if (px < ox || py < oy || px > ox + w - s || py > oy + h - s) continue;
      var ci = Math.min(4, Math.floor(t * 4 + rand() * 1.6));
      put(ctx, px, py, s, s, colors[ci], Math.min(1, fade + 0.25));
    }
    // 内圈补一些像素，让爆炸更“实”
    if (t > 0.1) {
      for (var e = 0; e < (big ? 10 : 6); e++) {
        var a2 = rand() * Math.PI * 2;
        var r2 = r * rand() * 0.8;
        var qx = Math.round(cx + Math.cos(a2) * r2);
        var qy = Math.round(cy + Math.sin(a2) * r2);
        put(ctx, qx, qy, s, s, colors[2 + Math.floor(rand() * 2)], Math.min(1, fade));
      }
    }
  }

  /** 像素圆环（护盾 / 冲击波） */
  function ringFrame(ctx, ox, oy, w, h, i, n, color, dash, thickness, grow) {
    var cx = ox + w / 2 - 0.5;
    var cy = oy + h / 2 - 0.5;
    var t = i / n;
    var maxR = (w / 2) - 1;
    var r = grow ? maxR * (0.15 + 0.85 * t) : maxR;
    var steps = Math.max(24, Math.round(Math.PI * 2 * r));
    var alpha = grow ? (1 - t) : 0.85;
    for (var k = 0; k < steps; k++) {
      if (dash && (k % dash) > dash - 2) continue;
      var a = (k / steps) * Math.PI * 2 + (grow ? 0 : t * 0.5);
      var x = Math.round(cx + Math.cos(a) * r);
      var y = Math.round(cy + Math.sin(a) * r);
      if (x < ox || y < oy || x >= ox + w || y >= oy + h) continue;
      put(ctx, x, y, thickness, thickness, color, alpha);
    }
  }

  /** Boss 核心：脉动反应堆 */
  function coreFrame(ctx, ox, oy, w, h, i, n) {
    var cx = ox + w / 2 - 0.5;
    var cy = oy + h / 2 - 0.5;
    var pulse = 0.5 + 0.5 * Math.sin((i / n) * Math.PI * 2);
    var rings = [
      { r: 7.4, c: '#6c2bd9' },
      { r: 6.0, c: '#c471ff' },
      { r: 4.6, c: '#ff4d5e' },
      { r: 3.2, c: '#ffa63d' },
      { r: 1.6 + pulse * 1.4, c: '#ffe66d' }
    ];
    for (var R = 0; R < rings.length; R++) {
      var ring = rings[R];
      var steps = Math.round(Math.PI * 2 * ring.r * 1.5);
      for (var k = 0; k < steps; k++) {
        var a = (k / steps) * Math.PI * 2;
        var x = Math.round(cx + Math.cos(a) * ring.r);
        var y = Math.round(cy + Math.sin(a) * ring.r);
        if (x < ox || y < oy || x >= ox + w || y >= oy + h) continue;
        put(ctx, x, y, 1, 1, ring.c, 1);
      }
    }
    put(ctx, Math.round(cx), Math.round(cy), 2, 2, '#ffffff', 0.6 + pulse * 0.4);
  }

  /** 星空层（带边缘留白，滚动时看不到接缝） */
  function starLayer(w, h, opts) {
    return function (ctx, ox, oy) {
      // 星云（仅远景）
      if (opts.nebula) {
        var cols = ['#6c2bd9', '#0d3a91', '#a01230'];
        for (var b = 0; b < opts.nebula; b++) {
          var bx = ox + 40 + rand() * (w - 80);
          var by = oy + 60 + rand() * (h - 120);
          var br = 60 + rand() * 90;
          var col = cols[b % cols.length];
          for (var i = 0; i < 220; i++) {
            var a = rand() * Math.PI * 2;
            var rr = br * Math.pow(rand(), 0.6);
            var x = Math.round(bx + Math.cos(a) * rr);
            var y = Math.round(by + Math.sin(a) * rr);
            if (x < ox || y < oy || x >= ox + w || y >= oy + h) continue;
            put(ctx, x, y, 3, 3, col, 0.05 + rand() * 0.06);
          }
        }
      }
      // 星星
      for (var s = 0; s < opts.count; s++) {
        var size = opts.sizes[Math.floor(rand() * opts.sizes.length)];
        // 8px 留白，避免滚动换行时出现被切断的星星
        var sx = ox + 8 + Math.floor(rand() * (w - 16 - size));
        var sy = oy + 8 + Math.floor(rand() * (h - 16 - size));
        put(ctx, sx, sy, size, size, opts.colors[Math.floor(rand() * opts.colors.length)], opts.alpha);
      }
    };
  }

  /* =====================================================================
   * 4. 定义表
   * =================================================================== */
  function sheetArt(w, h, frames) { return { w: w, h: h, art: frames }; }
  function sheetProc(w, h, count, proc) { return { w: w, h: h, count: count, proc: proc }; }

  var def = {
    // ---- 单位 ----
    ship: sheetArt(13, 14, [SHIP]),
    e_small: sheetArt(11, 9, [E_SMALL]),
    e_small2: sheetArt(11, 9, [E_SMALL2]),
    e_med: sheetArt(15, 13, [E_MED]),
    e_large: sheetArt(21, 16, [E_LARGE]),
    boss: sheetArt(80, 40, [BOSS]),
    boss_core: sheetProc(16, 16, 6, coreFrame),

    // ---- 子弹 ----
    pb1: { w: 3, h: 9, art: [BULLET_A], palette: { A: '#1f8cff', B: '#ffffff' } },
    pb2: { w: 3, h: 9, art: [BULLET_A], palette: { A: '#ffe66d', B: '#ffffff' } },
    pb3: { w: 3, h: 9, art: [BULLET_A], palette: { A: '#c471ff', B: '#ffffff' } },
    pbw: { w: 5, h: 11, art: [BULLET_W], palette: { A: '#1f8cff', B: '#ffffff' } },
    pbw2: { w: 5, h: 11, art: [BULLET_W], palette: { A: '#ff4d5e', B: '#ffffff' } },
    eb_orb: { w: 5, h: 5, art: [EB_ORB], palette: { A: '#ff4d5e', B: '#a01230' } },
    eb_big: { w: 7, h: 7, art: [EB_BIG], palette: { A: '#c471ff', B: '#6c2bd9' } },
    eb_beam: { w: 5, h: 11, art: [EB_BEAM], palette: { A: '#ff4d5e', B: '#a01230' } },

    // ---- 特效 ----
    exp_small: sheetProc(18, 18, 6, function (c, x, y, w, h, i, n) { explosionFrame(c, x, y, w, h, i, n, false); }),
    exp_big: sheetProc(40, 40, 8, function (c, x, y, w, h, i, n) { explosionFrame(c, x, y, w, h, i, n, true); }),
    shock: sheetProc(96, 96, 6, function (c, x, y, w, h, i, n) { ringFrame(c, x, y, w, h, i, n, '#3ce0ff', 5, 2, true); }),
    shield: sheetProc(27, 27, 6, function (c, x, y, w, h, i, n) { ringFrame(c, x, y, w, h, i, n, '#3ce0ff', 3, 1, false); }),
    px: sheetArt(2, 2, [['44', '44']]),
    spark: sheetArt(3, 3, [['.4.', '444', '.4.']]),
    ring: sheetArt(3, 3, [['.4.', '4.4', '.4.']]),

    // ---- 道具 ----
    power_spread: { w: 13, h: 13, capsule: 'spread', edge: '#ff8c1a', body: '#3a2200' },
    power_shield: { w: 13, h: 13, capsule: 'shield', edge: '#3ce0ff', body: '#002b3a' },
    power_bomb: { w: 13, h: 13, capsule: 'bomb', edge: '#ff4d5e', body: '#3a0008' },
    power_heal: { w: 13, h: 13, capsule: 'heal', edge: '#63f28a', body: '#003318' },

    // ---- HUD ----
    btn_round: sheetProc(34, 34, 1, function (ctx, ox, oy) {
      for (var y = 0; y < 34; y++) {
        for (var x = 0; x < 34; x++) {
          var dx = x - 16.5, dy = y - 16.5;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d > 16.5) continue;
          var col = '#0d1020', alpha = 0.72;
          if (d > 15) { col = '#3ce0ff'; alpha = 0.95; }
          else if (d > 12.5) { col = '#1f2a45'; alpha = 0.9; }
          put(ctx, ox + x, oy + y, 1, 1, col, alpha);
        }
      }
    }),
    life: { w: 9, h: 8, art: [LIFE], palette: { A: '#ff4d5e' } },
    icon_bomb: { w: 11, h: 11, art: [ICON_BOMB], palette: { 5: '#ff4d5e', 6: '#a01230', 8: '#ffe66d' } },
    icon_snd_on: sheetArt(11, 9, [ICON_SND_ON]),
    icon_snd_off: sheetArt(11, 9, [ICON_SND_OFF]),
    icon_full: sheetArt(11, 9, [ICON_FULL]),
    icon_pause: sheetArt(11, 8, [ICON_PAUSE]),
    icon_play: sheetArt(11, 9, [ICON_PLAY]),

    // ---- 背景 ----
    bg_far: sheetProc(CFG.W, CFG.H, 1, starLayer(CFG.W, CFG.H, {
      count: 90, sizes: [1], colors: ['#4d5578', '#2a2f4a', '#8f9bc4'], alpha: 0.9, nebula: 3
    })),
    bg_mid: sheetProc(CFG.W, CFG.H, 1, starLayer(CFG.W, CFG.H, {
      count: 55, sizes: [1, 1, 2], colors: ['#8f9bc4', '#ffffff', '#3ce0ff'], alpha: 0.75
    })),
    bg_near: sheetProc(CFG.W, CFG.H, 1, starLayer(CFG.W, CFG.H, {
      count: 22, sizes: [2, 2, 3], colors: ['#ffffff', '#ffe66d'], alpha: 0.95
    }))
  };

  /* =====================================================================
   * 5. 绘制工具
   * =================================================================== */
  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function drawPixelRows(ctx, rows, ox, oy, paletteOverride) {
    var pal = paletteOverride || PAL;
    for (var y = 0; y < rows.length; y++) {
      var row = rows[y];
      for (var x = 0; x < row.length; x++) {
        var col = pal[row.charAt(x)];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }

  /** 道具胶囊：圆角方块 + 符号 */
  function drawCapsule(ctx, ox, oy, w, h, key, def2) {
    var edge = def2.edge;
    var body = def2.body;
    var i, j;
    for (i = 0; i < w; i++) {
      for (j = 0; j < h; j++) {
        var dx = Math.min(i, w - 1 - i);
        var dy = Math.min(j, h - 1 - j);
        var corner = dx + dy;
        if (corner < 2) continue;
        var isEdge = (dx <= 1 || dy <= 1 || dx + dy <= 3);
        // 4 角切掉
        if (dx < 2 && dy < 2 && corner < 3) continue;
        ctx.fillStyle = isEdge ? edge : body;
        ctx.fillRect(ox + i, oy + j, 1, 1);
      }
    }
    var sym = SYM[def2.capsule];
    var sx = ox + Math.floor((w - 7) / 2);
    var sy = oy + Math.floor((h - 7) / 2);
    for (j = 0; j < sym.length; j++) {
      for (i = 0; i < sym[j].length; i++) {
        if (sym[j].charAt(i) !== '7') continue;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx + i, sy + j, 1, 1);
      }
    }
  }

  /** 把 def 渲染到 ctx 的 (ox,oy) 位置，供预览页复用 */
  function renderDef(ctx, name, ox, oy, frame) {
    var d = def[name];
    if (!d) return 0;
    if (d.art) {
      var rows = d.art[frame || 0];
      if (rows) drawPixelRows(ctx, rows, ox, oy, d.palette);
      return rows ? rows.length : 0;
    }
    if (d.capsule) {
      drawCapsule(ctx, ox, oy, d.w, d.h, name, d);
      return d.h;
    }
    if (d.proc) {
      resetSeed(1337);
      d.proc(ctx, ox, oy, d.w, d.h, frame || 0, d.count);
      return d.h;
    }
    return 0;
  }

  /** 生成精灵表并注册到 Phaser */
  function registerSheet(scene, key, d) {
    var frames = d.art ? d.art.length : (d.count || 1);
    var canvas = makeCanvas(d.w * frames, d.h);
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    resetSeed(1337);
    if (d.art) {
      for (var i = 0; i < d.art.length; i++) { drawPixelRows(ctx, d.art[i], i * d.w, 0, d.palette); }
    } else if (d.capsule) {
      for (var k = 0; k < frames; k++) { drawCapsule(ctx, k * d.w, 0, d.w, d.h, key, d); }
    } else if (d.proc) {
      for (var p = 0; p < frames; p++) { d.proc(ctx, p * d.w, 0, d.w, d.h, p, frames); }
    }
    var tex = scene.textures.addSpriteSheet(key, canvas, { frameWidth: d.w, frameHeight: d.h });
    if (!tex) { console.error('[art] failed to register sheet:', key); }
    return tex;
  }

  function buildAll(scene) {
    var count = 0;
    for (var key in def) {
      if (!Object.prototype.hasOwnProperty.call(def, key)) continue;
      registerSheet(scene, key, def[key]);
      count++;
    }
    return count;
  }

  /** 星空视差背景（3 层不同速度），返回带 update 的对象 */
  function createBackdrop(scene) {
    var far = scene.add.tileSprite(0, 0, CFG.W, CFG.H, 'bg_far').setOrigin(0, 0).setDepth(CFG.DEPTH.BG_FAR);
    var mid = scene.add.tileSprite(0, 0, CFG.W, CFG.H, 'bg_mid').setOrigin(0, 0).setDepth(CFG.DEPTH.BG_MID);
    var near = scene.add.tileSprite(0, 0, CFG.W, CFG.H, 'bg_near').setOrigin(0, 0).setDepth(CFG.DEPTH.BG_NEAR);
    var layers = [{ s: far, v: 16 }, { s: mid, v: 38 }, { s: near, v: 76 }];
    return {
      sprites: [far, mid, near],
      /** dt 秒；boost 为倍速（Boss 战时背景加速） */
      update: function (dt, boost) {
        var b = boost || 1;
        for (var i = 0; i < layers.length; i++) {
          layers[i].s.tilePositionY -= layers[i].v * b * dt;
        }
      },
      destroy: function () {
        for (var i = 0; i < layers.length; i++) layers[i].s.destroy();
      }
    };
  }

  window.Art = {
    def: def,
    buildAll: buildAll,
    renderDef: renderDef,
    drawPixelRows: drawPixelRows,
    createBackdrop: createBackdrop,
    mirror: mirror,
    hr: hr,
    rep: rep
  };
})();
