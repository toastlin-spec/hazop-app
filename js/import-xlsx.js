/* 匯入 Excel：支援原始範本（v1）、修正版範本 v2、本 App 匯出的檔案。
 * 灰底斜體的範例列預設略過；〔待填〕視為空白。回傳 { project, report }。 */
(function () {

  /* 儲存格值 → 字串／數字／日期字串 */
  function val(cell) {
    let v = cell ? cell.value : null;
    if (v === null || v === undefined) return '';
    if (typeof v === 'object' && !(v instanceof Date)) {
      if ('result' in v) v = v.result;
      else if ('formula' in v || 'sharedFormula' in v) return '';
      else if (v.richText) v = v.richText.map(t => t.text).join('');
      else if ('text' in v) v = v.text;
      else if (v.error) return '';
    }
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'string') return v.replace(/〔待填〕/g, '').trim();   // 範本的佔位字視為空白
    return v;
  }
  const num = v => (typeof v === 'number' ? v : (typeof v === 'string' && v !== '' && isFinite(Number(v.replace(/,/g, ''))) ? Number(v.replace(/,/g, '')) : (v === '' ? '' : v)));
  const dateStr = v => {
    if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10); }
    if (typeof v === 'string') { const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(v); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; }
    return v === '' ? '' : String(v);
  };
  /* 範例列：灰底（F2F2F2）且斜體 */
  function isExample(ws, r, c = 2) {
    const cell = ws.getCell(r, c);
    const f = cell.fill && cell.fill.fgColor && cell.fill.fgColor.argb;
    return !!(cell.font && cell.font.italic && f && /F2F2F2$/i.test(f));
  }
  const findSheet = (wb, re) => wb.worksheets.find(ws => re.test(ws.name));
  const pick = (v, allowed) => (allowed.includes(v) ? v : '');

  /* 讀註解區：「註1：說明」 */
  function readNotes(ws, fromRow) {
    const notes = {};
    for (let r = fromRow; r <= ws.rowCount; r++) {
      const t = val(ws.getCell(r, 1));
      const m = typeof t === 'string' && /^(註\s*\d+)\s*[：:]\s*(.*)$/s.exec(t);
      if (m && m[2].trim()) notes[m[1].replace(/\s/g, '')] = m[2].trim();
    }
    return notes;
  }
  /* 資料區結束列：A 欄出現「註解」或非數字項次時停止 */
  function dataEnd(ws, start) {
    let r = start;
    while (r <= ws.rowCount) {
      const a = val(ws.getCell(r, 1));
      if (typeof a === 'string' && /^(註|判定條件|除上述|符號)/.test(a)) break;
      if (a === '' && r > start + 5 && val(ws.getCell(r + 1, 1)) === '' && val(ws.getCell(r, 2)) === '') break;
      r++;
    }
    return r - 1;
  }

  App.parseWorkbook = function (wb, opts = {}) {
    const keepExamples = !!opts.includeExamples;
    const report = [];
    const p = App.newProject();
    let skipped = 0;
    const take = (ws, r, c) => { if (!keepExamples && isExample(ws, r, c)) { skipped++; return false; } return true; };
    const noteOf = (notes, ref) => { const k = String(ref || '').replace(/\s/g, ''); return notes[k] || ''; };

    /* ---- 專案資訊：先讀 App 匯出的「使用說明」，再以檢核表表頭補足 ---- */
    const us = findSheet(wb, /^使用說明$/);
    let hasProjectInfo = false;
    if (us) {
      let section = '';
      for (let r = 1; r <= us.rowCount; r++) {
        const a = val(us.getCell(r, 1)), b = val(us.getCell(r, 2)), c = val(us.getCell(r, 3));
        if (typeof a === 'string' && /^【.+】$/.test(a)) { section = a; continue; }
        if (section === '【專案資訊】') {
          hasProjectInfo = true;
          const map = { '場所': 'site', '製程／操作程序名稱': 'process', '評估日期': 'date', '填表人': 'author', '備註': 'remark' };
          if (map[a]) p.meta[map[a]] = a === '評估日期' ? dateStr(b) : String(b);
        } else if (section === '【HAZOP 小組】' && a !== '姓名' && (a || b || c)) {
          p.team.push({ id: App.uid(), name: String(a), role: pick(b, App.TEAM_ROLES) || (b ? '其他' : ''), unit: String(c) });
        } else if (section === '【HAZOP 事前資料】' && a !== '資料' && a) {
          const d = p.preDocs.find(x => x.name === a);
          if (d) { d.ready = b === '是'; d.note = String(c); }
        }
      }
    }
    const sheetA = findSheet(wb, /^檢核表A/);
    const metaFrom = ws => {
      if (!ws) return;
      const site = val(ws.getCell('B3')), date = val(ws.getCell('F3')), author = val(ws.getCell('J3'));
      if (!p.meta.site && site) p.meta.site = String(site);
      if (date && !hasProjectInfo) p.meta.date = dateStr(date);
      if (!p.meta.author && author) p.meta.author = String(author);
    };
    metaFrom(sheetA);

    /* ---- 判定設定（v2／App 匯出） ---- */
    const cfg = findSheet(wb, /^判定設定$/);
    if (cfg) {
      const n = a => num(val(cfg.getCell(a)));
      const s = p.settings;
      const setNum = (k, a) => { const v = n(a); if (App.isNum(v)) s[k] = v; };
      setNum('qtq', 'B5'); setNum('pHigh', 'B7'); setNum('vacuum', 'B8'); setNum('unstablePsig', 'B9'); setNum('dpFactor', 'B11'); setNum('atm', 'B13');
      s.multiMode = val(cfg.getCell('B6')) === '單一最大' ? 'max' : 'sum';
      s.dpBasis = val(cfg.getCell('B12')) === '絕對壓' ? 'absolute' : 'gauge';
      const rx = n('B17'), rh = n('B18'), rm = n('B19');
      if ([rx, rh, rm].every(App.isNum)) s.risk = { extreme: rx, high: rh, medium: rm };
      report.push('判定設定：已讀入');
    } else report.push('判定設定：檔案中沒有，使用預設值（加總、錶壓、風險 15／10／5）');

    /* ---- 檢核表 A ---- */
    const byName = new Map();
    if (sheetA) {
      const end = dataEnd(sheetA, 6);
      const notes = readNotes(sheetA, end + 1);
      const tog = { F: 'fire', G: 'explosion', H: 'static', J: 'acute', K: 'chronic', L: 'asphyxia', M: 'corrosive', N: 'burn', O: 'mutagenic', P: 'odor', Q: 'other' };
      let n = 0;
      for (let r = 6; r <= end; r++) {
        const name = val(sheetA.getCell(`B${r}`));
        if (name === '' || !take(sheetA, r)) continue;
        const c = App.newChemical();
        c.name = String(name); c.state = pick(val(sheetA.getCell(`C${r}`)), App.STATES);
        c.stockKg = num(val(sheetA.getCell(`D${r}`))); c.productionKg = num(val(sheetA.getCell(`E${r}`)));
        Object.entries(tog).forEach(([cl, k]) => { c.a[k] = pick(val(sheetA.getCell(`${cl}${r}`)), ['有', '無']); });
        c.a.reactivity = pick(val(sheetA.getCell(`I${r}`)), App.REACTIVITY);
        c.aPotential = pick(val(sheetA.getCell(`R${r}`)), App.POTENTIAL);
        c.aNote = noteOf(notes, val(sheetA.getCell(`S${r}`)));
        p.chemicals.push(c); byName.set(c.name, c); n++;
      }
      report.push(`檢核表 A：${n} 種化學品`);
    }

    /* ---- 檢核表 C（同名化學品併入同一筆） ---- */
    const sheetC = findSheet(wb, /^檢核表C/);
    if (sheetC) {
      const end = dataEnd(sheetC, 5);
      const notes = readNotes(sheetC, end + 1);
      let n = 0, merged = 0;
      for (let r = 5; r <= end; r++) {
        const name = val(sheetC.getCell(`B${r}`));
        if (name === '' || !take(sheetC, r)) continue;
        let c = byName.get(String(name));
        if (c) merged++; else { c = App.newChemical(); c.name = String(name); p.chemicals.push(c); byName.set(c.name, c); }
        if (!c.state) c.state = pick(val(sheetC.getCell(`C${r}`)), App.STATES);
        const total = val(sheetC.getCell(`D${r}`));
        const auto = [c.stockKg, c.productionKg].some(App.isNum) ? `${App.fmtNum((Number(c.stockKg) || 0) + (Number(c.productionKg) || 0))} kg` : null;
        c.cTotal = total === '' || String(total) === auto ? '' : String(App.isNum(total) ? App.fmtNum(total) : total);
        App.C_ITEMS.forEach(([k], j) => { c.c[k] = pick(val(sheetC.getCell(r, 5 + j)), ['有', '無', '不適用']); });
        c.cPotential = pick(val(sheetC.getCell(`N${r}`)), App.POTENTIAL);
        c.cNote = noteOf(notes, val(sheetC.getCell(`O${r}`)));
        n++;
      }
      report.push(`檢核表 C：${n} 種（其中 ${merged} 種與檢核表 A 同名，已合併為同一筆）`);
    }

    /* ---- 檢核表 B ---- */
    const sheetB = findSheet(wb, /^檢核表B/);
    if (sheetB) {
      const end = dataEnd(sheetB, 5);
      const notes = readNotes(sheetB, end + 1);
      let n = 0;
      for (let r = 5; r <= end; r++) {
        const s1 = val(sheetB.getCell(`B${r}`)), s2 = val(sheetB.getCell(`C${r}`));
        if ((s1 === '' && s2 === '') || !take(sheetB, r)) continue;
        p.compat.push(Object.assign(App.newCompat(), {
          sub1: String(s1), sub2: String(s2), scenario: pick(val(sheetB.getCell(`D${r}`)), App.SCENARIOS),
          consequence: String(val(sheetB.getCell(`E${r}`))), potential: pick(val(sheetB.getCell(`F${r}`)), App.POTENTIAL),
          note: noteOf(notes, val(sheetB.getCell(`G${r}`))), remark: String(val(sheetB.getCell(`H${r}`))),
        }));
        n++;
      }
      report.push(`檢核表 B：${n} 組相容性配對`);
    }

    /* ---- TQ 法定限量表：其他指定公告 ---- */
    const tqs = findSheet(wb, /^TQ法定限量表$/);
    if (tqs) {
      for (let r = 5; r <= tqs.rowCount; r++) {
        if (val(tqs.getCell(`B${r}`)) !== '其他指定公告') continue;
        const zh = val(tqs.getCell(`C${r}`)), tq = num(val(tqs.getCell(`F${r}`)));
        if (zh !== '') p.customTQ.push({ zh: String(zh), en: String(val(tqs.getCell(`D${r}`))), formula: String(val(tqs.getCell(`E${r}`))), tq });
      }
      if (p.customTQ.length) report.push(`TQ 法定限量表：其他指定公告 ${p.customTQ.length} 項`);
    }

    /* ---- 系統作用危害分析 ---- */
    const sw = findSheet(wb, /^系統作用危害分析$/);
    const areaByName = new Map();
    if (sw) {
      const v1 = /TQ/.test(String(val(sw.getCell('D4')))) && !/Σ/.test(String(val(sw.getCell('D4'))));
      const end = dataEnd(sw, 5);
      let n = 0, v1q = 0;
      const yn = (r, cl) => pick(val(sw.getCell(`${cl}${r}`)), ['是', '否']);
      for (let r = 5; r <= end; r++) {
        const name = val(sw.getCell(`B${r}`));
        if (name === '' || !take(sw, r)) continue;
        const a = App.newArea();
        a.name = String(name);
        a.exo = yn(r, 'G'); a.reactionType = String(val(sw.getCell(`H${r}`))); a.lel = yn(r, 'I'); a.unstable = yn(r, 'J');
        a.T = num(val(sw.getCell(`K${r}`))); a.AIT = num(val(sw.getCell(`L${r}`)));
        if (v1) {
          a.P = num(val(sw.getCell(`N${r}`))); a.pUp = num(val(sw.getCell(`P${r}`))); a.pDown = num(val(sw.getCell(`Q${r}`)));
          const q = val(sw.getCell(`C${r}`)), tq = val(sw.getCell(`D${r}`)), vac = val(sw.getCell(`O${r}`)), rem = val(sw.getCell(`T${r}`));
          const extra = [];
          if (q !== '' || tq !== '') { extra.push(`原範本 Q＝${q}、TQ＝${tq}`); v1q++; }
          if (vac !== '') extra.push(`原範本真空＝${vac} mmHg（定義不同，請改填最低操作壓力）`);
          a.remark = [rem, ...extra].filter(Boolean).join('；');
        } else {
          a.flammableGas = yn(r, 'M'); a.P = num(val(sw.getCell(`O${r}`))); a.vacuum = num(val(sw.getCell(`P${r}`)));
          a.pUp = num(val(sw.getCell(`Q${r}`))); a.pDown = num(val(sw.getCell(`R${r}`))); a.remark = String(val(sw.getCell(`W${r}`)));
        }
        p.areas.push(a); areaByName.set(a.name, a); n++;
      }
      report.push(`系統作用危害分析：${n} 個製程區域` + (v1 ? '（原始範本格式）' : ''));
      if (v1q) report.push(`⚠ 原始範本的 Q／TQ 是直接填數字，App 改由「區域物質存量」計算；原值已記在 ${v1q} 個區域的備註，請補填物質存量`);
      if (v1 && n) report.push('⚠ 原始範本沒有「易燃性氣體」欄，且「真空」定義與報告書原文不同，請在系統作用判定補填');
    }

    /* ---- 區域物質存量 ---- */
    const iv = findSheet(wb, /^區域物質存量$/);
    if (iv) {
      const end = dataEnd(iv, 5);
      let n = 0, orphan = 0;
      for (let r = 5; r <= end; r++) {
        const sub = val(iv.getCell(`C${r}`)), an = val(iv.getCell(`B${r}`));
        if ((sub === '' && an === '') || !take(iv, r)) continue;
        let a = areaByName.get(String(an));
        if (!a && an !== '') { a = Object.assign(App.newArea(), { name: String(an) }); p.areas.push(a); areaByName.set(a.name, a); }
        if (!a) orphan++;
        p.inventory.push(Object.assign(App.newInventory(a ? a.id : ''), {
          substance: String(sub), location: String(val(iv.getCell(`D${r}`))), qKg: num(val(iv.getCell(`E${r}`))),
          conc: num(val(iv.getCell(`F${r}`))), remark: String(val(iv.getCell(`K${r}`))),
        }));
        n++;
      }
      report.push(`區域物質存量：${n} 筆` + (orphan ? `（${orphan} 筆未指定區域）` : ''));
    }

    /* ---- HAZOP（單一工作表或每節點一張） ---- */
    const hzSheets = wb.worksheets.filter(ws => /^HAZOP(工作表|-N\d+)$/.test(ws.name))
      .sort((x, y) => (+(/N(\d+)/.exec(x.name) || [0, 0])[1]) - (+(/N(\d+)/.exec(y.name) || [0, 0])[1]));
    const devByRef = {};    // 「HAZOP-項次」或「HAZOP Nn-k」→ 偏離
    let devCount = 0;
    hzSheets.forEach((hz, si) => {
      const meta = {
        process: val(hz.getCell('B3')), name: val(hz.getCell('F3')), lineNo: val(hz.getCell('J3')), intent: val(hz.getCell('B4')),
        pid: val(hz.getCell('F4')), meetingDate: dateStr(val(hz.getCell('J4'))), chair: val(hz.getCell('B5')), recorder: val(hz.getCell('F5')), participants: val(hz.getCell('J5')),
      };
      const nodesHere = new Map();
      const getNode = nodeName => {
        const key = nodeName || meta.name || `節點 ${p.nodes.length + 1}`;
        if (!nodesHere.has(key)) {
          const n = Object.assign(App.newNode(), meta, { name: String(key) });
          Object.keys(n).forEach(k => { if (typeof n[k] === 'number') n[k] = String(n[k]); });
          const area = areaByName.get(String(val(hz.getCell('N3')))) || areaByName.get(n.name);
          if (area) n.areaId = area.id;
          p.nodes.push(n); nodesHere.set(key, n);
        }
        return nodesHere.get(key);
      };
      const perNode = /-N\d+$/.test(hz.name);
      const end = dataEnd(hz, 7);
      const rowNo = {};
      for (let r = 7; r <= end; r++) {
        const cells = ['C', 'D', 'E', 'F', 'G', 'H', 'M'].map(cl => val(hz.getCell(`${cl}${r}`)));
        if (cells.every(v => v === '') || !take(hz, r, 3)) continue;
        const node = getNode(perNode ? (meta.name || String(val(hz.getCell(`B${r}`)))) : String(val(hz.getCell(`B${r}`))));
        const sv = num(val(hz.getCell(`I${r}`))), lv = num(val(hz.getCell(`J${r}`)));
        const d = Object.assign(App.newDeviation(node.id), {
          guideWord: pick(val(hz.getCell(`C${r}`)), App.GUIDE_WORDS), param: pick(val(hz.getCell(`D${r}`)), Object.keys(App.DEVIATIONS)),
          deviation: String(cells[2]), cause: String(cells[3]), consequence: String(cells[4]), safeguards: String(cells[5]),
          severity: App.isNum(sv) && sv >= 1 && sv <= 5 ? sv : '', likelihood: App.isNum(lv) && lv >= 1 && lv <= 5 ? lv : '',
          recommendation: String(cells[6]), owner: String(val(hz.getCell(`N${r}`))), due: dateStr(val(hz.getCell(`O${r}`))), status: pick(val(hz.getCell(`P${r}`)), App.STATUS),
        });
        p.deviations.push(d); devCount++;
        const item = val(hz.getCell(`A${r}`));
        if (si === 0 && item !== '') devByRef[`HAZOP-${item}`] = d;
        rowNo[node.id] = (rowNo[node.id] || 0) + 1;
      }
    });
    // 依節點順序重新編號（同 App 的 HAZOP Nn-k）
    p.nodes.forEach((n, ni) => p.deviations.filter(d => d.nodeId === n.id).forEach((d, di) => { devByRef[`HAZOP N${ni + 1}-${di + 1}`] = d; }));
    if (hzSheets.length) report.push(`HAZOP：${p.nodes.length} 個節點、${devCount} 列偏離`);

    /* ---- 改善建議彙整：HAZOP 來源併回該列，其餘列為其他來源 ---- */
    const im = findSheet(wb, /^改善建議彙整$/);
    if (im) {
      const end = dataEnd(im, 5);
      let linked = 0, manual = 0, conflicts = 0;
      for (let r = 5; r <= end; r++) {
        const rec = val(im.getCell(`C${r}`)), src = String(val(im.getCell(`B${r}`)));
        const ref = src.replace(/\s+/g, ' ').replace(/^HAZOP\s*-\s*/, 'HAZOP-').trim();
        const d = devByRef[ref] || devByRef[src.trim()];
        // HAZOP 來源的列在 App 匯出檔是公式，未重算時 C 欄可能是空的，仍要併回實際完成日與備註
        if ((rec === '' && !d) || !take(im, r, 3)) continue;
        const owner = String(val(im.getCell(`E${r}`))), due = dateStr(val(im.getCell(`F${r}`))), done = dateStr(val(im.getCell(`G${r}`)));
        const status = pick(val(im.getCell(`H${r}`)), App.STATUS), remark = String(val(im.getCell(`J${r}`)));
        if (d) {
          if (!d.recommendation) d.recommendation = String(rec);
          // 原始範本的狀態等在 HAZOP 與彙整表兩處維護；兩邊都有值且不同時，以追蹤用的彙整表為準
          [['owner', owner], ['due', due], ['status', status]].forEach(([k, v]) => {
            if (v === '') return;
            if (d[k] !== '' && d[k] !== v) conflicts++;
            d[k] = v;
          });
          d.doneDate = done; d.remark = remark; linked++;
        } else {
          p.actions.push(Object.assign(App.newAction(), { source: src, recommendation: String(rec), level: pick(val(im.getCell(`D${r}`)), App.RISK_LEVELS), owner, due, doneDate: done, status, remark }));
          manual++;
        }
      }
      report.push(`改善建議彙整：${linked} 項併入對應的 HAZOP 列、${manual} 項列為其他來源`);
      if (conflicts) report.push(`⚠ 有 ${conflicts} 個欄位在 HAZOP 與彙整表不一致（負責人、期限或狀態），已採用彙整表的值`);
    }
    if (skipped) report.push(`已略過 ${skipped} 列灰底範例列（虛構教學數據）`);
    if (!sheetA && !sheetC && !sw && !hzSheets.length) throw new Error('找不到可辨識的工作表（檢核表、系統作用危害分析、HAZOP）');
    return { project: p, report };
  };

  App.importXlsxBuffer = async function (buffer, opts) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    return App.parseWorkbook(wb, opts);
  };

  App.importXlsx = async function (opts) {
    if (typeof ExcelJS === 'undefined') { App.toast('找不到 Excel 元件（vendor/exceljs.min.js），請確認 App 資料夾完整', 'error'); return; }
    if (App.dirty && !confirm('匯入會取代目前專案，目前專案有尚未存成專案檔的變更，確定嗎？')) return;
    const file = await new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      input.onchange = () => resolve(input.files[0] || null);
      input.click();
    });
    if (!file) return;
    try {
      const { project, report } = await App.importXlsxBuffer(await file.arrayBuffer(), opts);
      App.setProject(project);
      App.lastImport = { file: file.name, report, at: new Date().toLocaleString('zh-TW', { hour12: false }) };
      App.render();
      App.toast('已匯入：' + file.name);
    } catch (e) {
      App.toast('匯入失敗：' + e.message, 'error');
    }
  };
})();
