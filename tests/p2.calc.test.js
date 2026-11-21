/* 判定計算與 Excel 範本 v2 交叉比對：node tests/p2.calc.test.js
 * fixtures/excel-crosscheck.json 是同一批隨機案例寫進 Excel v2、以 LibreOffice 重算後的結果。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, console };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['js/data.js', 'js/calc.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx);
const App = ctx.App;
App.isEmpty = v => v === '' || v === null || v === undefined;   // ui.js 內的同名函式

const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'excel-crosscheck.json'), 'utf8'));
let checked = 0; const fails = [];
const close = (a, b) => Math.abs(a - b) < 1e-7;

for (const c of fx.cases) {
  const p = App.newProject();
  Object.assign(p.settings, c.settings);
  const ids = {};
  p.areas = c.areas.map(a => { const n = Object.assign(App.newArea(), a); ids[a.name] = n.id; return n; });
  p.inventory = c.inventory.map(r => Object.assign(App.newInventory(ids[r.area]), { substance: r.substance, qKg: r.qKg, conc: r.conc }));
  p.areas.forEach((a, i) => {
    const got = App.calcArea(a, p);
    const exp = c.expected[i];
    const ratio = got.ratioDP === null ? '' : (got.ratioDP === Infinity ? '∞' : got.ratioDP);
    const cmp = [
      ['Q', got.Q, exp.Q === '' ? 0 : exp.Q], ['Σq/TQ', got.sum, exp.sum === '' ? 0 : exp.sum], ['max', got.max, exp.max === '' ? 0 : exp.max],
      ['①', got.c1, exp.c1], ['⑤', got.c5, exp.c5], ['壓力比', ratio, exp.ratio],
      ['成立條件', got.triggers.join(''), exp.triggers], ['缺漏', got.missing.join('、'), exp.missing], ['判定', got.result, exp.result],
    ];
    for (const [name, g, e] of cmp) {
      checked++;
      const same = (typeof g === 'number' && typeof e === 'number') ? close(g, e) : g === e;
      if (!same) fails.push(`${c.file} ${a.name} ${name}：App=${JSON.stringify(g)} Excel=${JSON.stringify(e)}`);
    }
  });
}
const n = fx.cases.reduce((s, c) => s + c.areas.length, 0);
if (fails.length) { console.log(fails.slice(0, 30).join('\n')); console.log(`\n✗ ${fails.length} 項不一致（共 ${checked} 項）`); process.exit(1); }
console.log(`✓ ${fx.cases.length} 組設定 × ${n / fx.cases.length} 區＝${n} 個區域、${checked} 個欄位，App 與 Excel v2 結果完全一致`);
