/* 开发用：校验 pixel art 数据（每行宽度 / 行数是否与声明一致）
 * 运行：node dev/check-art.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const sandbox = {
  devicePixelRatio: 1,
  innerWidth: 360,
  innerHeight: 640,
  console,
  Math,
  Object,
  Array,
  document: {
    createElement() {
      return { width: 0, height: 0, getContext: () => ({ fillRect() {}, fillStyle: '', imageSmoothingEnabled: false }) };
    }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'js/config.js'), 'utf8'), sandbox, { filename: 'config.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'js/art.js'), 'utf8'), sandbox, { filename: 'art.js' });

const CFG = sandbox.CFG;
const def = sandbox.Art.def;
let bad = 0;
let total = 0;

for (const key of Object.keys(def)) {
  const d = def[key];
  total++;
  if (d.art) {
    d.art.forEach((frame, fi) => {
      if (frame.length !== d.h) {
        bad++;
        console.log(`✗ ${key} frame ${fi}: ${frame.length} rows, declared h=${d.h}`);
      }
      frame.forEach((row, ri) => {
        if (row.length !== d.w) {
          bad++;
          console.log(`✗ ${key} frame ${fi} row ${ri}: width ${row.length} != ${d.w}  "${row}"`);
        }
      });
    });
  }
}

const kinds = { pixel: 0, capsule: 0, procedural: 0 };
for (const k of Object.keys(def)) { kinds[def[k].art ? 'pixel' : (def[k].capsule ? 'capsule' : 'procedural')]++; }
console.log(`\nsheets: ${total}  (${JSON.stringify(kinds)})`);
console.log(`design res: ${CFG.W}x${CFG.H}`);
console.log(bad === 0 ? '✓ 全部美术数据尺寸正确' : `✗ 共 ${bad} 处尺寸错误`);
process.exit(bad ? 1 : 0);
