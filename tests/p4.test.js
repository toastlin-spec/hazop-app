/* P4 測試：匯出 Excel 以 LibreOffice 重算後與 App 比對、匯出→匯入往返、匯入原始範本。
 * node tests/p4.test.js [工作資料夾]（需要 soffice 與 python3 + openpyxl） */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'index.html');
const WORK = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'p4-'));
fs.mkdirSync(WORK, { recursive: true });
let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; console.log('  ✓ ' + msg); };

/* LibreOffice 重算後，用 openpyxl 讀出指定儲存格 */
function recalcRead(file, cells) {
  const out = path.join(WORK, 'calc');
  execFileSync('soffice', ['--headless', '--calc', '--convert-to', 'xlsx:Calc MS Excel 2007 XML', '--outdir', out, file], { stdio: 'ignore', timeout: 300000 });
  const py = `
import sys, json, openpyxl, datetime
wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
wf = openpyxl.load_workbook(sys.argv[2])
req = json.load(open(sys.argv[3]))
def norm(v):
    if isinstance(v, datetime.datetime): return v.date().isoformat()
    if isinstance(v, float): return round(v, 9)
    return '' if v is None else v
res = {k: norm(wb[s][a].value) for k, (s, a) in req.items()}
errs = [(ws.title, c.coordinate, wb[ws.title][c.coordinate].value) for ws in wf for row in ws.iter_rows() for c in row
        if isinstance(c.value, str) and c.value.startswith('=') and isinstance(wb[ws.title][c.coordinate].value, str) and wb[ws.title][c.coordinate].value.startswith('#')]
nf = sum(1 for ws in wf for row in ws.iter_rows() for c in row if isinstance(c.value, str) and c.value.startswith('='))
print(json.dumps({'values': res, 'errors': errs, 'formulas': nf}, ensure_ascii=False))
`;
  const req = path.join(WORK, 'req.json');
  fs.writeFileSync(req, JSON.stringify(cells));
  return JSON.parse(execFileSync('python3', ['-I', '-c', py, path.join(out, path.basename(file)), file, req], { cwd: os.tmpdir(), encoding: 'utf8', maxBuffer: 1 << 26 }));
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto(URL);
  await page.evaluate(() => { App.todayOverride = new Date().toISOString().slice(0, 10); });

  /* 建立測試專案：範例＋交叉比對案例的 20 個區域＋隨機 HAZOP 列 */
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'excel-crosscheck.json'), 'utf8'));
  await page.evaluate(([c1, c2]) => {
    const build = (c, settings, seed) => {
      const p = App.sampleProject();
      Object.assign(p.settings, settings);
      const ids = {};
      c.areas.forEach(a => { const n = Object.assign(App.newArea(), a); ids[a.name] = n.id; p.areas.push(n); });
      c.inventory.slice(0, 50).forEach(r => p.inventory.push(Object.assign(App.newInventory(ids[r.area]), { substance: r.substance, qKg: r.qKg, conc: r.conc })));
      let x = seed; const rnd = () => (x = (x * 9301 + 49297) % 233280) / 233280;
      const node = Object.assign(App.newNode(p.areas[2]), { name: '測試節點', intent: '測試', meetingDate: '2026-11-01' });
      p.nodes.push(node);
      for (let i = 0; i < 25; i++) {
        const sev = i % 6 === 5 ? '' : 1 + Math.floor(rnd() * 5), lik = i % 7 === 6 ? '' : 1 + Math.floor(rnd() * 5);
        const due = i % 3 === 0 ? '' : `2026-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}`;
        p.deviations.push(Object.assign(App.newDeviation(node.id), { guideWord: App.GUIDE_WORDS[i % 7], param: Object.keys(App.DEVIATIONS)[i % 8], deviation: '偏離' + i,
          cause: '原因' + i, consequence: '後果' + i, safeguards: '防護' + i, severity: sev, likelihood: lik, recommendation: i % 4 === 3 ? '' : '建議' + i,
          owner: '課' + i, due, doneDate: i % 5 === 0 && due ? '2026-06-30' : '', status: App.STATUS[i % 4], remark: i % 2 && i % 4 !== 3 ? '備註' + i : '' }));   // 追蹤備註只出現在有改善建議的列（同 App 操作）
      }
      p.customTQ.push({ zh: '測試指定物質', en: 'Test', formula: 'X', tq: 800 });
      p.inventory.push(Object.assign(App.newInventory(p.areas[3].id), { substance: '測試指定物質', qKg: 200 }));
      return p;
    };
    window.__projects = [
      build(c1, { dpBasis: 'gauge', multiMode: 'sum' }, 7),
      Object.assign(build(c2, { dpBasis: 'absolute', multiMode: 'max', risk: { extreme: 12, high: 8, medium: 3 } }, 11), {}),
    ];
  }, [fx.cases[0], fx.cases[1]]);

  for (let k = 0; k < 2; k++) {
    console.log(`\n${k + 1}. 匯出後以 LibreOffice 重算，與 App 比對（設定組 ${k + 1}）`);
    // App 端的預期值＋要讀的儲存格
    const { b64, expect, cells } = await page.evaluate(async k => {
      const p = window.__projects[k];
      App.state = p;
      const buf = await App.buildWorkbook(p, { cache: false }).xlsx.writeBuffer();
      let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      const expect = {}, cells = {};
      p.areas.forEach((a, i) => {
        const r = App.calcArea(a, p), row = 5 + i, sh = '系統作用危害分析';
        Object.assign(expect, { [`A${i}Q`]: r.Q, [`A${i}sum`]: r.sum, [`A${i}c1`]: r.c1, [`A${i}T`]: r.triggers.join(''), [`A${i}U`]: r.missing.join('、'), [`A${i}V`]: r.result });
        Object.assign(cells, { [`A${i}Q`]: [sh, `C${row}`], [`A${i}sum`]: [sh, `D${row}`], [`A${i}c1`]: [sh, `F${row}`], [`A${i}T`]: [sh, `T${row}`], [`A${i}U`]: [sh, `U${row}`], [`A${i}V`]: [sh, `V${row}`] });
      });
      p.nodes.forEach((n, ni) => p.deviations.filter(d => d.nodeId === n.id).forEach((d, di) => {
        const sc = App.riskScore(d);
        expect[`N${ni}D${di}K`] = sc; expect[`N${ni}D${di}L`] = App.riskLevel(sc, p);
        cells[`N${ni}D${di}K`] = [`HAZOP-N${ni + 1}`, `K${7 + di}`]; cells[`N${ni}D${di}L`] = [`HAZOP-N${ni + 1}`, `L${7 + di}`];
      }));
      App.actionList(p).forEach((x, i) => {
        expect[`M${i}I`] = x.overdue; expect[`M${i}D`] = x.level; expect[`M${i}F`] = x.item.due || '';
        cells[`M${i}I`] = ['改善建議彙整', `I${5 + i}`]; cells[`M${i}D`] = ['改善建議彙整', `D${5 + i}`]; cells[`M${i}F`] = ['改善建議彙整', `F${5 + i}`];
      });
      return { b64: btoa(s), expect, cells };
    }, k);
    const file = path.join(WORK, `export-${k + 1}.xlsx`);
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    const got = recalcRead(file, cells);
    ok(got.errors.length === 0, `${got.formulas} 個公式重算零錯誤` + (got.errors.length ? '：' + JSON.stringify(got.errors.slice(0, 5)) : ''));
    const diffs = Object.keys(expect).filter(key => {
      const e = expect[key], g = got.values[key];
      return typeof e === 'number' && typeof g === 'number' ? Math.abs(e - g) > 1e-7 : e !== g;
    });
    ok(diffs.length === 0, `${Object.keys(expect).length} 個計算欄位（區域判定、HAZOP 分數與等級、逾期）與 App 一致`
      + (diffs.length ? '：' + diffs.slice(0, 8).map(d => `${d} App=${JSON.stringify(expect[d])} Excel=${JSON.stringify(got.values[d])}`).join('; ') : ''));
  }

  console.log('\n3. 匯出 → 匯入往返');
  const rt = await page.evaluate(async () => {
    const norm = p => {
      const id = {}; let n = 0; const m = x => (x ? (id[x] = id[x] || 'id' + (++n)) : '');
      const q = JSON.parse(JSON.stringify(p));
      // 匯出時存量依區域順序排列（同區域內保持原順序），比對前先做相同排序
      const ai = new Map(q.areas.map((a, i) => [a.id, i]));
      q.inventory = q.inventory.map((r, i) => [r, i]).sort((x, y) => ((ai.get(x[0].areaId) ?? 1e9) - (ai.get(y[0].areaId) ?? 1e9)) || x[1] - y[1]).map(x => x[0]);
      ['chemicals', 'compat', 'areas', 'nodes', 'deviations', 'actions', 'team'].forEach(k => q[k].forEach(o => { o.id = m(o.id); }));
      q.inventory.forEach(o => { o.id = ''; o.areaId = m(o.areaId); });
      q.nodes.forEach(o => { o.areaId = m(o.areaId); });
      q.deviations.forEach(o => { o.nodeId = m(o.nodeId); });
      delete q.isSample;
      return q;
    };
    const out = [];
    for (const p of window.__projects) {
      App.state = p;
      const buf = await App.buildWorkbook(p, { cache: true }).xlsx.writeBuffer();
      const { project, report } = await App.importXlsxBuffer(buf, {});
      const a = norm(p), b = norm(project);
      const diffs = [];
      const walk = (x, y, path) => {
        if (typeof x === 'object' && x && typeof y === 'object' && y) {
          new Set([...Object.keys(x), ...Object.keys(y)]).forEach(k => walk(x[k], y[k], path + '.' + k));
        } else if (x !== y) diffs.push(`${path}: ${JSON.stringify(x)} → ${JSON.stringify(y)}`);
      };
      walk(a, b, '');
      out.push({ diffs, report });
    }
    return out;
  });
  rt.forEach((r, i) => ok(r.diffs.length === 0, `設定組 ${i + 1}：匯出再匯入，所有資料完全一致（化學品、檢核表、區域、存量、節點、偏離、改善建議、設定、小組）`
    + (r.diffs.length ? '\n    ' + r.diffs.slice(0, 15).join('\n    ') : '')));

  console.log('\n4. 匯入原始範本（v1）與修正版 v2');
  const tpl = async (name, includeExamples) => page.evaluate(async ([b64, inc]) => {
    const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const { project: p, report } = await App.importXlsxBuffer(u.buffer, { includeExamples: inc });
    App.state = p;
    return { report, chems: p.chemicals.map(c => [c.name, c.a.fire, c.aPotential, c.aNote.slice(0, 6), c.cTotal, c.cPotential]), compat: p.compat.length,
      areas: p.areas.map(a => [a.name, a.P, a.remark]), inv: p.inventory.map(r => [r.substance, r.qKg]),
      nodes: p.nodes.map(n => n.name), devs: p.deviations.map(d => [d.deviation, App.riskScore(d), d.owner, d.due, d.status]), actions: p.actions.length,
      results: p.areas.map(a => App.calcArea(a, p).result) };
  }, [fs.readFileSync(path.join(__dirname, 'fixtures', name)).toString('base64'), includeExamples]);

  const v1 = await tpl('template-v1.xlsx', true);
  ok(JSON.stringify(v1.chems.map(c => c[0])) === '["甲醇","甲苯","液氮","氮氣"]', 'v1：檢核表 A 甲醇、甲苯＋檢核表 C 液氮、氮氣');
  ok(v1.chems[0][3] === '甲醇具易燃性' && v1.chems[2][4] === '2,000 L' && v1.chems[2][5] === '可能', 'v1：註解對應、總量「2,000 L」、潛在性');
  ok(v1.compat === 2, 'v1：檢核表 B 2 組');
  ok(v1.areas.length === 2 && v1.areas[0][2].includes('原範本 Q＝8500、TQ＝20000'), 'v1：舊版 Q／TQ 記在區域備註');
  ok(v1.report.some(t => t.includes('原始範本格式')), 'v1：報告標示原始範本格式並提醒補填');
  ok(JSON.stringify(v1.nodes) === '["T-101→P-101→R-201 甲醇輸送管線","R-201 半批次反應器（夾套冷卻）"]', 'v1：HAZOP 依節點欄分成 2 個節點');
  ok(JSON.stringify(v1.devs.map(d => d[1])) === '[6,8,8,10]', 'v1：HAZOP 分數 6／8／8／10');
  ok(v1.devs[1][2] === '設備課' && v1.devs[1][3] === '2026-12-31' && v1.devs[1][4] === '進行中', 'v1：彙整「HAZOP-2」併回第 2 列（負責人、期限、狀態以彙整表為準）');
  ok(v1.report.some(t => t.includes('1 個欄位在 HAZOP 與彙整表不一致')), 'v1：報告指出 HAZOP 與彙整表狀態不一致（未開始 vs 進行中）');
  ok(v1.actions === 0, 'v1：沒有多出重複的改善建議');
  const v1skip = await tpl('template-v1.xlsx', false);
  ok(v1skip.chems.length === 0 && v1skip.devs.length === 0 && v1skip.report.some(t => /略過 \d+ 列灰底範例列/.test(t)), 'v1：預設略過灰底範例列');

  const v2 = await tpl('template-v2.xlsx', true);
  ok(JSON.stringify(v2.inv) === '[["環氧丙烷",4250],["甲醇",3000],["環氧丙烷",1500]]', 'v2：區域物質存量 3 筆');
  ok(JSON.stringify(v2.results) === '["重大潛在危害","—"]', 'v2：匯入後判定同 Excel（反應區重大、蒸餾區非重大）');

  console.log('\n5. 畫面操作：匯出按鈕與匯入按鈕');
  await page.evaluate(() => { delete window.showSaveFilePicker; });
  await page.click('#btn-sample');
  await page.click('a[href="#export"]');
  await page.waitForFunction(() => document.querySelector('h1').innerText.startsWith('匯出'));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-key="io:export"]')]);
  const dlPath = path.join(WORK, 'ui-export.xlsx');
  await dl.saveAs(dlPath);
  ok(fs.statSync(dlPath).size > 20000, '按「匯出 Excel」產生檔案');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-key="io:import"]')]);
  await chooser.setFiles(path.join(__dirname, 'fixtures', 'template-v1.xlsx'));
  await page.waitForSelector('.import-report');
  ok((await page.locator('.import-report li').allInnerTexts()).some(t => t.includes('略過')), '按「從 Excel 匯入」後顯示匯入報告');
  ok(await page.evaluate(() => App.state.chemicals.length) === 0 && !(await page.evaluate(() => App.state.isSample)), '匯入取代目前專案（範例列已略過）');

  ok(errors.length === 0, '沒有 JavaScript 錯誤' + (errors.length ? '：' + errors.join(' | ') : ''));
  console.log(`\n全部通過：${passed} 項（工作資料夾：${WORK}）`);
  await browser.close();
})().catch(e => { console.error('\n✗ 失敗：', e.message); process.exit(1); });
