/* P2 瀏覽器測試：node tests/p2.test.js [截圖資料夾] */
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
  const shot = async name => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false }); } };
  const go = async (view, title) => { await page.click(`a[href="#${view}"]`); await page.waitForFunction(t => document.querySelector('h1').innerText.startsWith(t), title); };
  const calc = idx => page.evaluate(i => App.calcArea(App.state.areas[i], App.state), idx);
  const fillNum = async (key, v) => { await page.fill(`[data-key="${key}"]`, String(v)); await page.keyboard.press('Tab'); await page.waitForTimeout(30); };

  await page.goto(URL);
  await page.click('#btn-sample');

  console.log('1. 範例結果與 Excel v2 相同');
  await go('areas', '系統作用危害分析');
  ok(await page.locator('.areas tbody tr').count() === 2, '範例有 2 個區域');
  const results = await page.locator('.areas .result').allInnerTexts();
  ok(results[0] === '重大潛在危害' && results[1] === '—', '反應區判重大、蒸餾區判非重大');
  ok((await page.locator('.areas tbody tr').first().locator('.trig').allInnerTexts()).join('') === '①②⑦', '反應區成立 ①②⑦');
  ok(await page.locator('.chip.r-major').first().innerText() === '重大潛在危害 1', '頁首統計重大 1 區');
  await shot('11-areas');

  console.log('2. 區域物質存量');
  await go('inventory', '區域物質存量');
  ok(await page.locator('.area-card').count() === 2, '每個區域一張卡片');
  const sum1 = await page.locator('.area-card').first().locator('.area-sum').innerText();
  ok(sum1.includes('4,250') && sum1.includes('42.5%'), '反應區 Q＝4,250 kg、Σq／TQ＝42.5%');
  ok(await page.locator('.non-annex').first().innerText() === '非附表物質', '甲醇標示非附表物質');
  const p0 = await page.evaluate(() => App.state);
  const distRow = p0.inventory[2].id;
  await fillNum(`inv:${distRow}:q`, 2500);
  ok((await calc(1)).result === '重大潛在危害' && (await calc(1)).triggers.join('') === '①', '蒸餾區改 2,500 kg → 25% 觸發①');
  await fillNum(`inv:${distRow}:conc`, 50);
  ok((await calc(1)).result === '—', '濃度改 50% → 純物質 1,250 kg，回到非重大');
  // 從清冊加入
  await page.selectOption(`[data-key="inv-quick:${p0.areas[1].id}"]`, '甲苯');
  ok((await page.evaluate(() => App.state.inventory.at(-1).substance)) === '甲苯', '從化學品清冊加入甲苯');
  await shot('12-inventory');

  console.log('3. 新增區域：缺漏提示到判定');
  await go('areas', '系統作用危害分析');
  await page.click('[data-key="area:add"]');
  const a3 = (await page.evaluate(() => App.state.areas[2].id));
  const k = `area:${a3}`;
  await page.fill(`[data-key="${k}:name"]`, '萃取區 E-501'); await page.keyboard.press('Tab');
  let r = await calc(2);
  ok(r.result === '資料不完整' && r.missing[0] === '存量表未填', '空白區域判「資料不完整」，不會誤判重大');
  for (const f of ['exo', 'lel', 'unstable', 'fg']) await page.selectOption(`[data-key="${k}:${f}"]`, '否');
  await fillNum(`${k}:T`, 50); await fillNum(`${k}:AIT`, 400); await fillNum(`${k}:P`, 1); await fillNum(`${k}:up`, 2); await fillNum(`${k}:down`, 1);
  r = await calc(2);
  ok(r.result === '資料不完整' && r.missing.join() === '存量表未填', '其他都填了，只剩存量表未填');
  await go('inventory', '區域物質存量');
  await page.click(`[data-key="inv-add:${a3}"]`);
  const inv3 = await page.evaluate(() => App.state.inventory.at(-1).id);
  await page.fill(`[data-key="inv:${inv3}:sub"]`, '甲苯'); await fillNum(`inv:${inv3}:q`, 8000);
  r = await calc(2);
  ok(r.result === '—' && r.c1 === '不適用', '只有非附表物質：① 不適用、判非重大');
  await go('areas', '系統作用危害分析');
  await fillNum(`${k}:vac`, 400);
  ok((await calc(2)).triggers.join('') === '⑥', '最低操作壓力 400 mmHg → ⑥');
  await fillNum(`${k}:vac`, '');
  await page.selectOption(`[data-key="${k}:unstable"]`, '是');
  ok((await calc(2)).triggers.join('') === '④', '熱不安定＝是且 P＝1 kg/cm² ≧ 10 psig（0.703）→ ④');
  await fillNum(`${k}:P`, 0.7);
  ok((await calc(2)).triggers.length === 0, 'P＝0.7 kg/cm² 未達 10 psig → ④ 不成立');
  await page.selectOption(`[data-key="${k}:fg"]`, '是');
  ok((await calc(2)).triggers.join('') === '⑤', '易燃性氣體＝是 → ⑤');

  console.log('4. 判定設定連動');
  await go('settings', '判定設定');
  await page.check('[data-key="set:dpBasis:absolute"]');
  ok((await calc(0)).triggers.join('') === '①②', '改絕對壓：反應區 8／2 不再成立⑦');
  await page.check('[data-key="set:dpBasis:gauge"]');

  console.log('5. 名稱重複、刪除與復原');
  await go('areas', '系統作用危害分析');
  await page.fill(`[data-key="${k}:name"]`, '蒸餾區 C-401'); await page.keyboard.press('Tab'); await page.waitForTimeout(30);
  ok(await page.locator('.badge.warn', { hasText: '名稱重複' }).count() === 2, '區域名稱重複時兩列都提示');
  const invBefore = await page.evaluate(() => App.state.inventory.length);
  await page.click(`[data-key="${k}:del"]`);
  ok(lastDialog.includes('1 筆物質存量會一併刪除'), '刪除前提示連帶刪除的存量筆數');
  ok(await page.evaluate(() => App.state.areas.length) === 2 && await page.evaluate(() => App.state.inventory.length) === invBefore - 1, '區域與其存量一併刪除');
  await page.click('#btn-undo');
  ok(await page.evaluate(() => App.state.areas.length) === 3 && await page.evaluate(() => App.state.inventory.length) === invBefore, '復原後區域與存量都回來');

  console.log('6. 總覽與自動保存');
  await go('overview', '專案總覽');
  ok((await page.locator('.flow .chip.r-major').first().innerText()).startsWith('重大'), '總覽顯示判定統計');
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => JSON.stringify(App.state));
  await page.reload();
  ok(before === await page.evaluate(() => JSON.stringify(App.state)), '重新整理後區域與存量完整還原');

  ok(errors.length === 0, '沒有 JavaScript 錯誤' + (errors.length ? '：' + errors.join(' | ') : ''));
  console.log(`\n全部通過：${passed} 項`);
  await browser.close();
})().catch(e => { console.error('\n✗ 失敗：', e.message); process.exit(1); });
