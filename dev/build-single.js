'use strict';
/* =========================================================================
 * 开发用：把整个游戏打包成「单个 HTML 文件」。
 *   - 内联 css/style.css、所有 js/、vendor/phaser.min.js
 *   - 图标内联成 data URI（单文件里没有独立文件可引用）
 *   - 去掉 PWA manifest 引用（单文件模式下没有意义，只会在控制台报 404）
 * 输出：dist/pixel-shooter.html —— 可直接双击打开，也能当一个文件发给别人。
 * 运行：node dev/build-single.js
 * ========================================================================= */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readB64 = (rel) => fs.readFileSync(path.join(root, rel)).toString('base64');

let html = read('index.html');

// 1) 图标 -> data URI
const iconUri = 'data:image/svg+xml;base64,' + readB64('icon.svg');
html = html.replace(/[ \t]*<link rel="icon"[^>]*>/,
  '<link rel="icon" href="' + iconUri + '" type="image/svg+xml">');
html = html.replace(/[ \t]*<link rel="apple-touch-icon"[^>]*>/,
  '<link rel="apple-touch-icon" href="' + iconUri + '">');

// 2) 去掉 manifest 引用
html = html.replace(/[ \t]*<link rel="manifest"[^>]*>\r?\n?/, '');

// 3) 内联 CSS
html = html.replace(/[ \t]*<link rel="stylesheet" href="([^"]+)">/g,
  (m, href) => '<style>\n' + read(href).trim() + '\n</style>');

// 4) 内联脚本（保持原顺序，避免 </script> 提前闭合）
html = html.replace(/[ \t]*<script src="([^"]+)"><\/script>/g,
  (m, src) => {
    const code = read(src).replace(/<\/script/gi, '<\\/script');
    return '<script>\n' + code.trim() + '\n</script>';
  });

fs.mkdirSync(dist, { recursive: true });
const out = path.join(dist, 'pixel-shooter.html');
fs.writeFileSync(out, html, 'utf8');

const kb = Math.round(fs.statSync(out).size / 1024);
const leftover = html.match(/(?:src|href)="(?:js|css)\//g);
console.log('输出: ' + out + '  (' + kb + ' KB)');
if (leftover) {
  console.log('仍有未内联的本地引用: ' + leftover.join(', '));
  process.exit(1);
}
console.log('✓ 所有本地引用已内联 —— 单个文件即可独立运行');
