/* HAZOP 計算測試：node tests/p3.calc.test.js
 * fixtures/excel-hazop.json 是 Excel v2「HAZOP工作表」「改善建議彙整」公式以 LibreOffice 重算的結果。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['js/data.js', 'js/calc.js', 'js/hazop-calc.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx);
const App = ctx.App;
App.isEmpty = v => v === '' || v === null || v === undefined;

let n = 0;
const eq = (a, b, msg) => { assert.deepStrictEqual(JSON.parse(JSON.stringify(a ?? null)), b ?? null, msg); n++; };  // vm 沙箱的陣列原型不同，先序列化

// 1. 與 Excel 交叉比對
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'excel-hazop.json'), 'utf8'));
for (const c of fx.cases) {
  const p = App.newProject(); p.settings.risk = c.risk;
  c.pairs.forEach(([s, l], i) => {
    const d = { severity: s === null ? '' : s, likelihood: l === null ? '' : l };
    const score = App.riskScore(d);
    eq(score, c.scores[i][0], `${c.file} ${s}×${l} 分數`);
    eq(App.riskLevel(score, p), c.scores[i][1], `${c.file} ${s}×${l} 等級`);
  });
  c.dates.forEach(([due, done], i) => eq(App.overdue({ due, doneDate: done }, fx.today), c.overdue[i], `${c.file} 逾期 ${due}/${done}`));
}
console.log(`✓ 與 Excel v2 一致：風險分數與等級 ${fx.cases.length}×${fx.cases[0].pairs.length} 組、逾期判斷 ${fx.cases[0].dates.length} 種情境`);

// 2. 引導字 × 參數
eq(App.autoDeviation('NO 無', '流量'), '無流量', 'NO＋流量');
eq(App.autoDeviation('REVERSE 相反', '壓力'), null, 'REVERSE＋壓力 不適用');
eq(App.autoDeviation('OTHER THAN 除…之外', '程序'), '執行錯誤的動作', 'OTHER THAN＋程序');
eq(App.autoDeviation('', '流量'), '', '未選引導字');
let combos = 0;
for (const g of App.GUIDE_WORDS) for (const prm of Object.keys(App.DEVIATIONS)) if (App.autoDeviation(g, prm)) combos++;
eq(combos, 30, '表 3.2.3-1 共 30 個有意義的組合');

// 3. 範例專案：HAZOP 分數 6／8／8／10、改善建議彙整
const sp = App.sampleProject();
eq(sp.deviations.map(d => App.riskScore(d)), [6, 8, 8, 10], '範例 HAZOP 分數同 Excel');
eq(sp.deviations.map(d => App.riskLevel(App.riskScore(d), sp)), ['中', '中', '中', '高'], '範例 HAZOP 等級');
const list = App.actionList(sp, '2026-11-20');
eq(list.map(x => x.ref), ['HAZOP N1-1', 'HAZOP N1-2', 'HAZOP N1-3', 'HAZOP N2-1', '檢核表B-1'], '彙整清單依節點與列序編號，含其他來源');
eq(list.map(x => x.overdue), ['', '未到期', '', '', '逾期'], '逾期判斷');
const sum = App.actionSummary(sp, '2026-11-20');
eq([sum.total, sum.done, sum.overdue, sum.highOpen], [5, 0, 1, 2], '彙整統計（高風險未完成：N2-1 與檢核表B-1）');
// 改善建議清空就不列入
sp.deviations[0].recommendation = '  ';
eq(App.actionList(sp, '2026-11-20').length, 4, '改善建議空白的偏離不列入追蹤');

console.log(`✓ 全部通過：${n} 項`);
