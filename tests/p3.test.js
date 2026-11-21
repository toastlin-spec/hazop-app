/* P3 瀏覽器測試：node tests/p3.test.js [截圖資料夾] */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const SHOTS = process.argv[2];
let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; console.log('  ✓ ' + msg); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  let lastDialog = '';
  page.on('dialog', d => { lastDialog = d.message(); d.accept(); });
  const shot = async name => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } };
  const go = async (view, title) => { await page.click(`a[href="#${view}"]`); await page.waitForFunction(t => document.querySelector('h1').innerText.startsWith(t), title); };
  const S = () => page.evaluate(() => App.state);
  const tab = async () => { await page.keyboard.press('Tab'); await page.waitForTimeout(30); };

  await page.goto(URL);
  await page.evaluate(() => { App.todayOverride = '2026-11-20'; });
  await page.click('#btn-sample');

  console.log('1. 範例 HAZOP（同 Excel v2：分數 6／8／8／10）');
  await go('hazop', 'HAZOP 工作表');
  ok(await page.locator('.node-tab').count() === 2, '2 個節點分頁');
  ok(await page.locator('.hazop tbody tr').count() === 3, '節點 N1 有 3 列偏離');
  ok(JSON.stringify(await page.locator('.hazop td.score').allInnerTexts()) === '["6","8","8"]', 'N1 分數 6／8／8');
  const s0 = await S();
  await page.click(`[data-key="node-tab:${s0.nodes[1].id}"]`);
  ok(await page.locator('.hazop td.score').innerText() === '10' && await page.locator('.hazop .lvl').innerText() === '高', 'N2 分數 10、等級高');
  await shot('21-hazop');

  console.log('2. 引導字自動帶出偏離');
  await page.click(`[data-key="node-tab:${s0.nodes[0].id}"]`);
  await page.click(`[data-key="node:${s0.nodes[0].id}:add-dev"]`);
  let d = (await S()).deviations.filter(x => x.nodeId === s0.nodes[0].id).at(-1);
  const k = `dev:${d.id}`;
  await page.selectOption(`[data-key="${k}:guideWord"]`, 'NO 無');
  await page.selectOption(`[data-key="${k}:param"]`, '流量');
  ok(await page.locator(`[data-key="${k}:deviation"]`).inputValue() === '無流量', 'NO＋流量 → 無流量');
  await page.selectOption(`[data-key="${k}:guideWord"]`, 'REVERSE 相反');
  ok(await page.locator(`[data-key="${k}:deviation"]`).inputValue() === '逆流', '改 REVERSE → 逆流（自動文字會跟著換）');
  await page.selectOption(`[data-key="${k}:param"]`, '溫度');
  ok(await page.locator(`[data-key="${k}:deviation"]`).inputValue() === '' && await page.locator('.dev-cell .badge.warn').count() === 1, 'REVERSE＋溫度 → 清空並提示「一般不適用」');
  await page.fill(`[data-key="${k}:deviation"]`, '溫度梯度反轉'); await tab();
  await page.selectOption(`[data-key="${k}:guideWord"]`, 'MORE 較多');
  ok(await page.locator(`[data-key="${k}:deviation"]`).inputValue() === '溫度梯度反轉', '手動輸入的偏離不會被覆蓋');

  console.log('3. 風險分數、等級與改善建議連動');
  await page.selectOption(`[data-key="${k}:sev"]`, '5');
  await page.selectOption(`[data-key="${k}:lik"]`, '3');
  d = (await S()).deviations.find(x => x.id === d.id);
  ok(d.severity === 5 && d.likelihood === 3, '嚴重性、可能性存成數字');
  ok(await page.locator(`tr:has([data-key="${k}:sev"]) td.score`).innerText() === '15', '5×3＝15');
  ok(await page.locator(`tr:has([data-key="${k}:sev"]) .lvl`).innerText() === '極高', '15 → 極高');
  const actionsBefore = await page.evaluate(() => App.actionList(App.state).length);
  await page.fill(`[data-key="${k}:recommendation"]`, '增設高溫連鎖跳脫'); await tab();
  ok(await page.evaluate(() => App.actionList(App.state).length) === actionsBefore + 1, '填改善建議後自動列入追蹤');
  await page.fill(`[data-key="${k}:due"]`, '2026-11-01'); await tab();

  console.log('4. 批次加入');
  await page.selectOption(`[data-key="node:${s0.nodes[0].id}:batch-param"]`, '液位');
  const n0 = (await S()).deviations.length;
  await page.click(`[data-key="node:${s0.nodes[0].id}:batch"]`);
  const added = (await S()).deviations.slice(n0).map(x => x.deviation);
  ok(JSON.stringify(added) === '["高液位","低液位","無液位"]', '液位：加入 高液位／低液位／無液位');
  await page.click(`[data-key="node:${s0.nodes[0].id}:batch"]`);
  ok((await S()).deviations.length === n0 + 3, '再按一次不會重複加入');
  await shot('22-hazop-edit');

  console.log('5. 改善建議追蹤（與 HAZOP 同一份資料）');
  await go('actions', '改善建議追蹤');
  const row = page.locator(`tr:has([data-key="act:${d.id}:rec"])`);
  ok(await row.locator('.od').innerText() === '逾期', '預定 11/01 未完成 → 逾期');
  ok(await row.locator('.lvl').innerText() === '極高', '風險等級取自 HAZOP 分數');
  await page.selectOption(`[data-key="act:${d.id}:status"]`, '已完成');
  ok(await row.locator('.badge.warn').innerText() === '請填實際完成日', '已完成但未填實際完成日 → 提示');
  ok((await S()).deviations.find(x => x.id === d.id).status === '已完成', '在追蹤頁改狀態，HAZOP 的資料同步改變');
  await page.fill(`[data-key="act:${d.id}:done"]`, '2026-11-15'); await tab();
  ok(await row.locator('.od').count() === 0, '填實際完成日後不再顯示逾期');
  await page.click('[data-key="act-filter:overdue"]');
  ok(await page.locator('.actions tbody tr').count() === 1 && (await page.locator('.actions tbody tr [data-key$=":source"]').inputValue()) === '檢核表B-1', '篩選「逾期」只剩檢核表B-1');
  await page.click('[data-key="act-filter:all"]');
  await page.selectOption('[data-key="act-sort"]', 'risk');
  ok((await page.locator('.actions tbody tr .lvl, .actions tbody tr select.cell-select.v-高').first().innerText()).trim() === '極高', '依風險排序：極高在最前');
  await page.click('[data-key="act:add"]');
  const a = (await S()).actions.at(-1);
  await page.fill(`[data-key="act:${a.id}:source"]`, '檢核表A-甲醇'); await tab();
  await page.fill(`[data-key="act:${a.id}:rec"]`, '增設洗眼器'); await tab();
  ok((await S()).actions.at(-1).source === '檢核表A-甲醇', '新增其他來源的改善建議');
  await page.click(`tr:has([data-key="act:${d.id}:rec"]) a`);
  await page.waitForFunction(() => document.querySelector('h1').innerText.startsWith('HAZOP'));
  ok(await page.locator('.node-tab.active .nt-no').innerText() === 'N1', '點來源連結跳到對應節點');
  await go('actions', '改善建議追蹤');
  await shot('23-actions');

  console.log('6. 從重大區域建立節點');
  await go('areas', '系統作用危害分析');
  ok(await page.locator(`[data-key="area:${s0.areas[0].id}:goto-node"]`).innerText() === 'HAZOP 節點 2 個 →', '反應區已有 2 個節點');
  await go('inventory', '區域物質存量');
  await page.fill(`[data-key="inv:${s0.inventory[2].id}:q"]`, '3000'); await tab();
  await go('areas', '系統作用危害分析');
  await page.click(`[data-key="area:${s0.areas[1].id}:make-node"]`);
  await page.waitForFunction(() => document.querySelector('h1').innerText.startsWith('HAZOP'));
  const s1 = await S();
  ok(s1.nodes.length === 3 && s1.nodes[2].areaId === s0.areas[1].id && s1.nodes[2].name === '蒸餾區 C-401', '蒸餾區改判重大後一鍵建立節點 N3');
  ok(await page.locator('.node-tab.active .nt-no').innerText() === 'N3', '建立後直接開啟新節點');
  await page.click(`[data-key="node:${s1.nodes[2].id}:team"]`);
  ok((await S()).nodes[2].participants === '陳主任、林工程師、張工程師、李領班、黃工程師', '帶入 HAZOP 小組成員');

  console.log('7. 刪除節點與復原');
  await page.click(`[data-key="node-tab:${s1.nodes[0].id}"]`);
  const devCount = (await S()).deviations.filter(x => x.nodeId === s1.nodes[0].id).length;
  await page.click(`[data-key="node:${s1.nodes[0].id}:del"]`);
  ok(lastDialog.includes(`${devCount} 列偏離`), '刪除前提示連帶刪除的偏離列數');
  ok((await S()).nodes.length === 2 && !(await S()).deviations.some(x => x.nodeId === s1.nodes[0].id), '節點與偏離一併刪除');
  await page.click('#btn-undo');
  ok((await S()).nodes.length === 3 && (await S()).deviations.filter(x => x.nodeId === s1.nodes[0].id).length === devCount, '復原後全部回來');

  console.log('8. 總覽儀表板');
  await go('overview', '專案總覽');
  ok(await page.locator('[data-key="heat:4:2"]').innerText() === '2', '風險矩陣：嚴重性4×可能性2 有 2 列');
  await page.click('[data-key="heat:4:2"]');
  ok(await page.locator('.heat-list li').count() === 2, '點格子列出 2 個偏離');
  ok((await page.locator('.stat.bad .stat-n').innerText()) === '1', '逾期 1 件');
  await shot('24-overview');

  console.log('9. 判定設定連動、存檔還原');
  await go('settings', '判定設定');
  await page.fill('[data-key="set:r-ex"]', '20'); await tab();
  ok(await page.evaluate(() => App.riskLevel(15)) === '高', '極高門檻改 20 → 15 分變「高」');
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => JSON.stringify(App.state));
  await page.reload();
  ok(before === await page.evaluate(() => JSON.stringify(App.state)), '重新整理後 HAZOP 與追蹤資料完整還原');

  ok(errors.length === 0, '沒有 JavaScript 錯誤' + (errors.length ? '：' + errors.join(' | ') : ''));
  console.log(`\n全部通過：${passed} 項`);
  await browser.close();
})().catch(e => { console.error('\n✗ 失敗：', e.message); process.exit(1); });
