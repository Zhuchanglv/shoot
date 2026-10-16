# PIXEL SHOOTER · 像素风纵向射击

一个**手机竖屏优先**的像素风纵向卷轴射击游戏（雷霆战机风格），用 **Phaser 3 + 原生 JavaScript** 实现。
**零外部素材**：所有精灵图、位图字体、音效都在运行时用代码生成，整个项目是纯静态文件，打开即玩。

```
打开 index.html → 拖动屏幕控制飞机 → 自动开火 → 打爆 Boss
```

---

## 目录

- [玩法与特性](#玩法与特性)
- [本地运行](#本地运行)
- [部署到 GitHub Pages](#部署到-github-pages)
- [项目结构](#项目结构)
- [调参与扩展](#调参与扩展)
- [开发工具](#开发工具)
- [实现要点](#实现要点)
- [浏览器支持](#浏览器支持)

---

## 玩法与特性

**操作**
- 手指（或鼠标）按住屏幕任意位置拖动，飞机平滑跟随；松手即停。
- 自动开火，无需点射。点击 HUD 右下角按钮释放**炸弹**。
- 左右不设边界墙，全屏可飞。

**内容**
- **3 种体型 + 4 种敌机**：小机（两色）、中型机、大型重装机，按波次以编队、斜切、俯冲等队形刷新，难度逐波上升（血量 / 速度 / 开火频率）。
- **Boss 战**：每 5 波出现一个 Boss，入场动画 → 三阶段（血量 100% / 66% / 33% 切换）→ 弹幕从扇形、瞄准射击、环形弹幕逐步升级，还会召唤僚机。击杀后有连环爆炸演出与多重掉落。
- **4 种道具**（击落敌机有概率掉落）：
  | 道具 | 效果 |
  | --- | --- |
  | `S` 火力 | 武器升级（最高 6 级：单发 → 双发 → 三发 → 加散射 …） |
  | 护盾 | 7 秒护盾，免疫子弹、撞击时抵消一次 |
  | 炸弹 | 炸弹 +1（上限 5） |
  | 生命 | 生命 +1（满血则加分） |
- **炸弹**：清空全屏敌弹、对全场敌人巨额伤害、全屏白闪 + 震屏。
- **计分 / 最高分**：最高分存 `localStorage`，本地长期保留。

**表现**
- 像素美术全部程序化生成：玩家机、4 种敌机、80×40 双翼旗舰 Boss、子弹、道具胶囊、爆炸 / 冲击波 / 护盾动画、HUD 图标、三层视差星空。
- 5×7 位图字体（`RetroFont`）绘制所有 HUD / 数值 / 横幅。
- 8-bit 音效与 BGM 全部用 **Web Audio** 实时合成：射击、命中、爆炸、拾取、炸弹、警告、游戏结束，并可一键静音（状态本地记忆）。
- 打击反馈：屏幕震动、白/红闪、粒子火花与烟、Boss 阶段切换闪白。

**手机适配 / 性能**
- 竖屏 9:16 为主线：逻辑宽度固定 **360**，高度按屏幕比例计算并夹在 `520 – 900`，`Scale.FIT` + `CENTER_BOTH` 自动铺满，无黑边。
- 禁用缩放 / 双击缩放 / 长按菜单 / 橡皮筋滚动，适配刘海屏安全区（`env(safe-area-inset-*)`）。
- 一键全屏（Android 尝试锁定竖屏；iOS 不支持则静默降级）。
- `pixelArt + roundPixels + CSS image-rendering: pixelated`，放大后依旧锐利。
- 所有可复用对象走**对象池**（子弹 / 敌机 / 道具 / 爆炸），粒子设上限，`group.runChildUpdate=false` 手动统一更新 —— 碰撞与 GC 稳定，长时间游玩不掉帧。
- 切到后台 / 失焦**自动暂停**。

---

## 本地运行

项目是纯静态的，不需要构建步骤。推荐用任意静态服务器（`file://` 直开大多也能跑，但用服务器最稳）：

```bash
# 任选其一，在项目根目录执行
python -m http.server 8000
npx serve .
php -S localhost:8000
```

然后浏览器打开 <http://localhost:8000/>。
开发时可用 `?debug=1` 打开左上角 FPS / 对象数调试浮层：

```
http://localhost:8000/?debug=1
```

---

## 部署到 GitHub Pages

1. 把整个项目推到 GitHub 仓库（`index.html` 必须在仓库根目录）。
2. 仓库 **Settings → Pages**：
   - **Source** 选 `Deploy from a branch`
   - **Branch** 选 `main`，目录选 `/ (root)`，保存。
3. 等约一分钟，访问 `https://<用户名>.github.io/<仓库名>/` 即可。

说明：
- 所有资源路径都是**相对路径**，放在仓库子目录 / 自定义域名下都能正常加载。
- 已包含 `.nojekyll`（避免 Jekyll 处理以 `_` 开头的文件，属常规保险）。
- 无 CDN、无构建、无后端，无需任何环境变量。

---

## 项目结构

```
.
├─ index.html                # 入口：按固定顺序加载脚本 + 横屏提示
├─ .nojekyll                 # GitHub Pages：跳过 Jekyll
├─ manifest.webmanifest      # PWA 清单（全屏、竖屏、图标）
├─ icon.svg                  # 图标
├─ css/style.css             # 手机优先样式：全屏、禁缩放、安全区、像素锐化
├─ vendor/phaser.min.js      # Phaser 3.80（本地内置，无 CDN 依赖）
├─ js/
│  ├─ config.js              # ★ 全局常量 / 数值调参 / 调色板 / HUD 布局 / 事件总线
│  ├─ pixelfont.js           # 5×7 位图字体生成（RetroFont 注册）
│  ├─ audio.js               # Web Audio 8-bit 音效 + BGM（window.Synth）
│  ├─ art.js                 # ★ 全部像素美术的程序化生成（精灵表）
│  ├─ waves.js               # 波次 / 编队 / 难度曲线生成
│  ├─ entities.js            # Player / Enemy / PowerUp / Boss 类
│  ├─ main.js                # Phaser 启动配置 / 全屏 / 音频解锁 / 自适应 / 调试浮层
│  └─ scenes/
│     ├─ BootScene.js        # 生成贴图 + 字体 + 动画，进入菜单（瞬开）
│     ├─ MenuScene.js        # 标题界面
│     ├─ GameScene.js        # ★ 主玩法：输入 / 波次 / 碰撞 / 道具 / Boss / 特效
│     ├─ HudScene.js         # 独立 HUD 场景（不随游戏镜头抖动）
│     └─ GameOverScene.js    # 结算界面
└─ dev/
   ├─ check-art.js           # 校验美术数据（行宽 / 行数）
   └─ sprite-preview.html    # 全部精灵表可视化预览（放大 6×）
```

**架构要点**：HUD 放在独立场景 `Hud`，拥有自己的摄像机，因此震屏 / 闪屏永远只影响游戏画面、不会晃动 UI。跨场景通信统一走全局事件总线 `window.Bus`（`js/config.js` 里创建的 `Phaser.Events.EventEmitter`）。
按钮布局的唯一数据源是 `CFG.HUD()` / `CFG.uiZones()`，HudScene 用它摆放按钮，GameScene 用它屏蔽"点按钮区域"的拖拽，两边不会错位。

---

## 调参与扩展

绝大多数平衡性数值集中在 `js/config.js`，改完刷新即可生效：

| 配置 | 位置 | 说明 |
| --- | --- | --- |
| `CFG.W` / 高度算法 | `computeHeight()` | 逻辑宽度（默认 360）与高度区间 `[520, 900]` |
| `PLAYER` | `CFG.PLAYER` | 拖拽速度、初始生命/炸弹、碰撞半径、无敌时间、护盾时长、子弹速度、武器上限 |
| `ENEMY` | `CFG.ENEMY` | 每种敌机的血量、速度、分数、贴图、判定半径、掉落率 |
| `POWER` | `CFG.POWER` | 道具下落速度、类型与权重 |
| `DIFF` | `CFG.DIFF` | 每波血量 / 速度 / 开火频率增长系数 |
| `BOSS_EVERY` | `CFG.BOSS_EVERY` | 每几波一个 Boss（默认 5） |
| `POOL` | `CFG.POOL` | 各对象池上限（性能 / 内存的平衡旋钮） |
| `WEAPONS` | `CFG.WEAPONS` | 1–6 级武器的射速 / 伤害 / 弹道排布 |
| `PALETTE` | `CFG.PALETTE` | 16 色像素调色板（美术数据里的字符 `'1'`–`'f'` 映射到这些颜色） |
| Boss 弹幕 | `entities.js` 的 `PHASE` | 三个阶段各自的扇形/瞄准/环形/僚机参数 |
| Boss 造型 | `art.js` 的 `bossHalf()` | 程序化生成 40×40 左半，自动镜像为 80×40，改数组即可换外形 |

---

## 开发工具

```bash
# 校验所有像素美术数据的行宽 / 行数是否与声明一致
node dev/check-art.js
```

浏览器打开 `dev/sprite-preview.html` 可查看**全部精灵表**（6× 放大），改完 `art.js` 刷新就能看到效果。

`?debug=1` 会在左上角显示 `FPS / 渲染后端 / 活动对象数 / DPR / 逻辑分辨率 / 活动场景数`。

---

## 实现要点

- **零素材、零 CORS**：所有贴图用 Canvas 现场绘制，再通过 `textures.addSpriteSheet()` 注册为精灵表；音效由振荡器 / 噪声缓冲合成。因此不存在"图挂了""音频被拦"的问题，也便于用代码微调像素。
- **像素字体**：`pixelfont.js` 生成 5×7 位图字模并注册为 `pixelfont`，全大写（字库无小写字形）。
- **运动全部由速度驱动**：Arcade 物理体不用直接改坐标（否则会与物理步长脱节）；对象复用走 `enableBody(true, x, y, true, true)` / `disableBody(true, true)`。
- **弹道约定**：敌弹 `vx = sin(a)·s, vy = cos(a)·s`（`a=0` 表示向下）；玩家弹 `vy = -cos(a)·s`。

---

## 浏览器支持

| 平台 | 情况 |
| --- | --- |
| Android Chrome / Edge | ✅ 推荐，支持全屏 + 尝试锁定竖屏 |
| iOS Safari 15+ | ✅ 可玩；全屏受限时静默降级，可"添加到主屏幕"以全屏运行（PWA 清单已就绪） |
| 桌面 Chrome / Edge / Firefox / Safari | ✅ 可用鼠标拖动游玩（适合调试） |

AudioContext 需用户手势解锁：首次点击 / 触摸时会自动 `resume`，因此第一次触屏即开始有声。

---

如果你要把它做成自己的游戏，最省事的改动路径是：`CFG.PALETTE` 换配色 → `art.js` 换/加造型 → `CFG.ENEMY` / `CFG.WEAPONS` 调平衡 → `waves.js` 编队。祝玩得开心 🚀
