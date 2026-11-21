/* P1 自動測試：node tests/p1.test.js [截圖資料夾]
 * 以 file:// 開啟 index.html，模擬實際操作並檢查結果。 */
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
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  const shot = async name => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } };
  const state = () => page.evaluate(() => App.state);
  const go = async (view, title) => { await page.click(`a[href="#${view}"]`); await page.waitForFunction(t => document.querySelector('h1').innerText.startsWith(t), title); };

  console.log('1. 初次開啟');
  await page.goto(URL);
  ok(await page.locator('h1').innerText() === '專案總覽', '預設顯示專案總覽');
  ok((await state()).chemicals.length === 0, '新專案沒有化學品');

  console.log('2. 載入範例');
  await page.click('#btn-sample');
  ok(await page.locator('#sample-banner').isVisible(), '顯示範例專案提示');
  ok((await state()).chemicals.length === 5, '範例有 5 種化學品');
  await shot('01-overview');

  console.log('3. 檢核表 A');
  await go('checklistA', '檢核表 A');
  ok((await page.locator('h1').innerText()).startsWith('檢核表 A'), '切到檢核表 A');
  const s0 = await state();
  const pid = s0.chemicals[2].id; // 環氧丙烷
  ok(await page.locator(`[data-key="A:${pid}:name"]`).locator('xpath=..').locator('.badge').innerText() === '附表一 TQ 10,000', '環氧丙烷顯示附表一 TQ');
  ok(await page.locator(`[data-key="A:${s0.chemicals[0].id}:name"]`).locator('xpath=..').locator('.badge').count() === 0, '甲醇不顯示 TQ（非附表物質）');
  // 切換鈕：空 → 有 → 無 → 空
  const tog = `[data-key="A:${pid}:other"]`;
  await page.click(tog); ok((await state()).chemicals[2].a.other === '有', '點一下變「有」');
  await page.click(tog); ok((await state()).chemicals[2].a.other === '無', '再點變「無」');
  ok(await page.evaluate(() => document.activeElement.dataset.key) === `A:${pid}:other`, '重繪後焦點留在原按鈕');
  await page.keyboard.press('Space'); ok((await state()).chemicals[2].a.other === '', '空白鍵再切回空白');
  // 空白設為無
  await page.click(`[data-key="A:${pid}:fillno"]`);
  ok(Object.entries((await state()).chemicals[2].a).filter(([k]) => k !== 'reactivity').every(([, v]) => v), '「空白設為無」補齊危害欄');
  // 下拉
  await page.selectOption(`[data-key="A:${pid}:reactivity"]`, '自反應性');
  await page.selectOption(`[data-key="A:${pid}:pot"]`, '重大');
  ok((await state()).chemicals[2].aPotential === '重大', '選潛在性');
  // 數字欄：千分位、非數字
  await page.fill(`[data-key="A:${pid}:prod"]`, '1,500');
  await page.keyboard.press('Tab');
  ok((await state()).chemicals[2].productionKg === 1500, '數字欄接受千分位');
  await page.fill(`[data-key="A:${pid}:prod"]`, 'abc');
  ok(await page.locator(`[data-key="A:${pid}:prod"]`).evaluate(e => e.classList.contains('invalid')), '非數字標紅');
  await page.fill(`[data-key="A:${pid}:prod"]`, '1500'); await page.keyboard.press('Tab');
  // Tab 後焦點應移到下一欄而不是消失
  await page.fill(`[data-key="A:${pid}:stock"]`, '6000');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(50);
  ok(await page.evaluate(() => document.activeElement.dataset.key) === `A:${pid}:prod`, 'Tab 鍵移到下一欄後焦點保留');
  // 註解自動編號
  await page.fill(`[data-key="A:${pid}:note"]`, '環氧丙烷沸點低、易揮發。'); await page.keyboard.press('Tab');
  await page.waitForTimeout(50);
  const noteNos = await page.locator('.note-no').allInnerTexts();
  ok(JSON.stringify(noteNos) === JSON.stringify(['註1', '註2', '註3']), '註解依列順序自動編號 註1～註3');
  await shot('02-checklistA');

  console.log('4. 新增、移動、刪除、復原');
  await page.click('[data-key="A:add"]');
  ok((await state()).chemicals.length === 6, '新增化學品');
  const newId = (await state()).chemicals[5].id;
  await page.fill(`[data-key="A:${newId}:name"]`, '氯'); await page.keyboard.press('Tab');
  await page.waitForTimeout(50);
  ok(await page.locator(`[data-key="A:${newId}:name"]`).locator('xpath=..').locator('.badge').innerText() === '附表二 TQ 5,000', '輸入「氯」顯示附表二 TQ');
  await page.click(`[data-key="A:${newId}:up"]`);
  ok((await state()).chemicals[4].id === newId, '上移');
  await page.locator(`[data-key="A:${newId}:up"]`).locator('xpath=../button[3]').click();
  ok((await state()).chemicals.length === 5, '刪除（確認後）');
  await page.click('#btn-undo');
  ok((await state()).chemicals.length === 6 && (await state()).chemicals[4].id === newId, '復原刪除');

  console.log('5. 檢核表 C 共用化學品');
  await go('checklistC', '檢核表 C');
  ok(await page.locator(`[data-key="C:${newId}:name"]`).inputValue() === '氯', 'A 新增的化學品出現在 C');
  const t = `[data-key="C:${newId}:storage"]`;
  await page.click(t); await page.click(t); await page.click(t);
  ok((await state()).chemicals[4].c.storage === '不適用', 'C 的切換有「不適用」');
  ok(await page.locator(`[data-key="C:${pid}:total"]`).getAttribute('placeholder') === '7,500 kg', '總量留白時提示庫存＋生產量');
  await shot('03-checklistC');

  console.log('6. 檢核表 B');
  await go('checklistB', '檢核表 B');
  await page.click('[data-key="B:add"]');
  const bid = (await state()).compat[2].id;
  await page.fill(`[data-key="B:${bid}:sub1"]`, '環氧丙烷');
  await page.fill(`[data-key="B:${bid}:sub2"]`, '碳鋼');
  await page.selectOption(`[data-key="B:${bid}:scenario"]`, '正常接觸');
  ok((await state()).compat[2].sub1 === '環氧丙烷' && (await state()).compat[2].scenario === '正常接觸', '新增相容性配對');
  await shot('04-checklistB');

  console.log('7. 設定與參考資料');
  await go('settings', '判定設定');
  ok(await page.locator('[data-key="set:multiMode:sum"]').isChecked(), '多物質預設「加總」');
  ok(await page.locator('[data-key="set:dpBasis:gauge"]').isChecked(), '壓差預設「錶壓」');
  ok(await page.locator('[data-key="set:qtq"]').inputValue() === '20', 'Q／TQ 顯示 20');
  await page.fill('[data-key="set:r-hi"]', '8'); await page.keyboard.press('Tab');
  await page.waitForTimeout(50);
  ok(await page.locator('.matrix td.v-高').first().innerText() === '8', '改「高」門檻為 8，矩陣 8 變橙色');
  await shot('05-settings');
  await go('reference', '參考資料');
  ok(await page.locator('.ref tbody tr').count() >= 8 + 5 + 49, '參考資料含引導字表、方法、TQ 49 項');
  await shot('06-reference');

  console.log('8. 自動保存與重新整理');
  await page.waitForTimeout(600);
  const before = await state();
  await page.reload();
  const after = await state();
  ok(JSON.stringify(before) === JSON.stringify(after), '重新整理後內容完整還原');
  ok(after.settings.risk.high === 8, '設定也一併還原');

  console.log('9. 專案檔另存與開啟（無檔案 API 時改用下載）');
  await page.evaluate(() => { delete window.showSaveFilePicker; delete window.showOpenFilePicker; });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-saveas')]);
  // 無頭 Chromium 會把中文下載檔名回報成 "download"（實際瀏覽器正常），因此直接檢查 App 給的檔名
  ok(await page.evaluate(() => App.suggestedName()) === '範例化工廠 第一廠區_製程安全評估.hazop.json', '檔名依場所命名');
  const savedPath = path.join(require('os').tmpdir(), 'p1-test.hazop.json');
  await dl.saveAs(savedPath);
  const saved = JSON.parse(fs.readFileSync(savedPath, 'utf8'));
  ok(saved.schema === 'hazop-app/1' && saved.chemicals.length === 6, '存出的專案檔內容正確');
  ok((await page.locator('#file-name').innerText()).includes('已存檔'), '存檔後顯示已存檔');
  await page.click('#btn-new');
  ok((await state()).chemicals.length === 0, '新專案清空');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('#btn-open')]);
  await chooser.setFiles(savedPath);
  await page.waitForTimeout(200);
  ok((await state()).chemicals.length === 6 && (await state()).chemicals[4].name === '氯', '開啟專案檔還原資料');
  await page.evaluate(() => App.loadFromText('{"schema":"other/9"}', 'bad.json', null));
  ok(await page.locator('.toast.error').last().innerText() === '開啟失敗：專案檔版本不符：other/9', '版本不符的檔案會拒絕');
  ok((await state()).chemicals.length === 6, '拒絕後資料不變');

  console.log('10. 手機寬度');
  await page.setViewportSize({ width: 390, height: 844 });
  await go('overview', '專案總覽');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  ok(!overflow, '手機寬度沒有整頁橫向捲動');
  await shot('07-mobile');

  ok(errors.length === 0, '沒有 JavaScript 錯誤' + (errors.length ? '：' + errors.join(' | ') : ''));
  console.log(`\n全部通過：${passed} 項`);
  await browser.close();
})().catch(e => { console.error('\n✗ 失敗：', e.message); process.exit(1); });
