/* 匯出 Excel：版面與公式同「製程安全評估範本_HAZOP_v2.xlsx」，列數依資料自動延伸。
 * 使用 vendor/exceljs.min.js（MIT 授權）。 */
(function () {
  const FONT = '微軟正黑體';
  const COLOR = { navy: 'FF1F3864', blue: 'FF2E75B6', need: 'FFFFF2CC', calc: 'FFDDEBF7', ink: 'FF262626', ink2: 'FF595959', meta: 'FF1F4E79', line: 'FFBFBFBF' };
  const fill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const thin = { style: 'thin', color: { argb: COLOR.line } };
  const BORDER = { top: thin, left: thin, bottom: thin, right: thin };
  const STYLES = {
    title: { font: { name: FONT, size: 16, bold: true, color: { argb: 'FFFFFFFF' } }, fill: fill(COLOR.navy), alignment: { vertical: 'middle' } },
    desc: { font: { name: FONT, size: 10, color: { argb: COLOR.ink2 } }, alignment: { wrapText: true, vertical: 'top' } },
    label: { font: { name: FONT, size: 11, bold: true, color: { argb: COLOR.ink } }, alignment: { vertical: 'middle' } },
    section: { font: { name: FONT, size: 12, bold: true, color: { argb: COLOR.navy } }, alignment: { vertical: 'middle' } },
    meta: { font: { name: FONT, size: 11, color: { argb: COLOR.meta } }, fill: fill(COLOR.need), border: BORDER, alignment: { vertical: 'middle', wrapText: true } },
    head: { font: { name: FONT, size: 11, bold: true, color: { argb: 'FFFFFFFF' } }, fill: fill(COLOR.blue), border: BORDER, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
    need: { font: { name: FONT, size: 11, color: { argb: COLOR.meta } }, fill: fill(COLOR.need), border: BORDER, alignment: { vertical: 'middle', wrapText: true } },
    data: { font: { name: FONT, size: 11, color: { argb: COLOR.ink } }, border: BORDER, alignment: { vertical: 'middle', wrapText: true } },
    calc: { font: { name: FONT, size: 11, color: { argb: COLOR.ink } }, fill: fill(COLOR.calc), border: BORDER, alignment: { vertical: 'middle', wrapText: true } },
    idx: { font: { name: FONT, size: 11, color: { argb: COLOR.ink } }, border: BORDER, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
    note: { font: { name: FONT, size: 10, color: { argb: COLOR.ink2 } }, border: BORDER, alignment: { vertical: 'middle', wrapText: true } },
  };
  const RED = { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } }, font: { color: { argb: 'FF9C0006' }, bold: true } };
  const ORG = { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFF8CBAD' } }, font: { color: { argb: 'FF843C0C' }, bold: true } };
  const YEL = { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFEB9C' } } };
  const GRN = { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFC6EFCE' } } };

  const E = v => v === '' || v === null || v === undefined;
  const col = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const toDate = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : (s || null); };
  const sheetRef = name => `'${name.replace(/'/g, "''")}'!`;

  /* 寫入儲存格：kind 為樣式；input 類欄位有值用白底、空白用黃底（待填） */
  function put(ws, addr, value, kind, opts = {}) {
    const c = ws.getCell(addr);
    if (value !== undefined && value !== null && value !== '') c.value = value;
    let k = kind;
    if (kind === 'input') k = E(value) ? 'need' : 'data';
    const s = STYLES[k];
    c.font = s.font; if (s.fill) c.fill = s.fill; if (s.border) c.border = s.border;
    c.alignment = Object.assign({}, s.alignment, opts.align || {});
    if (opts.numFmt) c.numFmt = opts.numFmt;
    return c;
  }
  /* 公式儲存格；cache 為 App 算出的值（Excel 受保護的檢視模式下也看得到） */
  function formula(ws, addr, f, cache, ctx, opts) {
    const v = { formula: f };
    if (ctx.cache && cache !== undefined) v.result = cache;
    return put(ws, addr, v, 'calc', opts);
  }
  function list(ws, range, items, opts = {}) {
    const [a, b] = range.split(':');
    const m1 = /([A-Z]+)(\d+)/.exec(a), m2 = /([A-Z]+)(\d+)/.exec(b || a);
    const c1 = colNum(m1[1]), c2 = colNum(m2[1]);
    for (let c = c1; c <= c2; c++) for (let r = +m1[2]; r <= +m2[2]; r++) {
      ws.getCell(col(c) + r).dataValidation = {
        type: 'list', allowBlank: true, formulae: [opts.ref || `"${items.join(',')}"`],
        showErrorMessage: true, errorStyle: opts.warning ? 'warning' : 'stop',
        errorTitle: '輸入值不在選單中', error: opts.warning ? '此值不在選單中，確定要使用自訂值嗎？' : '請從下拉選單選擇。',
      };
    }
  }
  const colNum = s => s.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  function cf(ws, ref, rules) {
    ws.addConditionalFormatting({ ref, rules: rules.map((r, i) => ({ type: 'expression', priority: i + 1, formulae: [r[0]], style: r[1], stopIfTrue: !!r[2] })) });
  }
  function widths(ws, w) { Object.entries(w).forEach(([c, v]) => { ws.getColumn(c).width = v; }); }
  function header(ws, title, desc, last, meta) {
    ws.mergeCells(`A1:${last}1`); put(ws, 'A1', title, 'title'); ws.getRow(1).height = 32;
    ws.mergeCells(`A2:${last}2`); put(ws, 'A2', desc, 'desc'); ws.getRow(2).height = 44;
    if (meta) {
      [['A3', '場所：'], ['E3', '日期：'], ['I3', '填表人：']].forEach(([a, t]) => put(ws, a, t, 'label'));
      [['B3:D3', meta.site], ['F3:H3', meta.date], ['J3:L3', meta.author]].forEach(([rng, v]) => {
        ws.mergeCells(rng); put(ws, rng.split(':')[0], E(v) ? '〔待填〕' : v, 'meta');
      });
      ws.getRow(3).height = 22;
    }
  }
  function page(ws, titleRows, freeze) {
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: titleRows };
    if (freeze) ws.views = [{ state: 'frozen', xSplit: freeze[0], ySplit: freeze[1] }];
  }
  const noteNos = (rows, key) => { const m = {}; let n = 0; rows.forEach(r => { if (!E((r[key] || '').trim())) m[r.id] = '註' + (++n); }); return m; };
  function notesBlock(ws, startRow, last, title, rows, key, nos) {
    ws.mergeCells(`A${startRow}:${last}${startRow}`); put(ws, `A${startRow}`, title, 'note');
    ws.getCell(`A${startRow}`).font = { name: FONT, size: 10, bold: true, color: { argb: COLOR.ink } };
    let r = startRow + 1;
    const withNotes = rows.filter(x => nos[x.id]);
    const lines = withNotes.map(x => `${nos[x.id]}：${x[key].trim()}`);
    for (let i = withNotes.length + 1; lines.length < Math.max(withNotes.length + 2, 5); i++) lines.push(`註${i}：`);
    lines.forEach(t => { ws.mergeCells(`A${r}:${last}${r}`); put(ws, `A${r}`, t, 'note'); ws.getRow(r).height = 22; r++; });
    return r;
  }

  /* ======================================================================= */
  App.buildWorkbook = function (p, options = {}) {
    const ctx = { cache: options.cache !== false };
    const wb = new ExcelJS.Workbook();
    wb.creator = '製程安全評估 App'; wb.created = new Date();
    wb.calcProperties.fullCalcOnLoad = true;
    const today = App.today();
    const S = sheetRef('判定設定');

    /* ---------- 使用說明 ---------- */
    const us = wb.addWorksheet('使用說明');
    widths(us, { A: 24, B: 60, C: 34 });
    us.mergeCells('A1:C1'); put(us, 'A1', '化工廠製程安全評估 — 初步危害分析 × HAZOP', 'title'); us.getRow(1).height = 32;
    us.mergeCells('A2:C2'); put(us, 'A2', '依據：高雄市政府《第三章 製程安全評估報告書》（危險性工作場所製程安全評估）｜HAZOP 方法：IEC 61882｜由「製程安全評估 App」匯出', 'desc');
    let r = 4;
    const section = t => { put(us, `A${r}`, t, 'section'); us.getRow(r).height = 24; r++; };
    const kv = (k, v) => { put(us, `A${r}`, k, 'label'); us.mergeCells(`B${r}:C${r}`); put(us, `B${r}`, E(v) ? '' : v, 'input'); r++; };
    // 合併 A:C 約可放 55 個中文字一行；依實際換行數估列高
    const para = t => {
      us.mergeCells(`A${r}:C${r}`); put(us, `A${r}`, t, 'desc');
      const lines = t.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 55)), 0);
      us.getRow(r).height = Math.max(30, 15 * lines + 8); r++;
    };
    section('【專案資訊】');
    kv('場所', p.meta.site); kv('製程／操作程序名稱', p.meta.process); kv('評估日期', p.meta.date); kv('填表人', p.meta.author); kv('備註', p.meta.remark);
    r++; section('【評估流程】');
    para('1. 檢核表 A／B／C：本質危害分析（物質危害、相容性、處理方法）\n2. 區域物質存量 → 系統作用危害分析：填各區危險物／有害物存量，自動算 Q／TQ，再依①～⑦條件判定重大潛在危害區域\n3. HAZOP（每個節點一張工作表）：以引導字逐節點分析偏離、原因、後果、防護與改善建議\n4. 改善建議彙整：追蹤負責人、期限與辦理情形；HAZOP 來源的建議以公式連到 HAZOP 工作表，只需在 HAZOP 修改');
    r++; section('【圖例】');
    para('黃底儲存格：待填寫欄位。\n淺藍底儲存格：公式自動計算，請勿手動填寫。\n有下拉箭頭的儲存格：請從選單選擇（反應類型、物質名稱可自訂）。\n判定結果：紅底＝重大潛在危害；橙底＝資料不完整。');
    r++; section('【注意事項】');
    para('1. 判定門檻在「判定設定」工作表，條件原文引自報告書第 3-5 頁；多物質 Q／TQ 算法、壓差錶壓／絕對壓基準原文未規定，請確認設定值。\n2. 風險等級分級為自訂，請依公司風險矩陣調整「判定設定」。\n3. 正式 HAZOP 須由跨領域小組執行，本表不能取代合格團隊的實地評估。\n4. 非附表物質（如甲醇、甲苯）無法定限量，不列入 Q／TQ 計算。');
    r++; section('【HAZOP 小組】');
    ['姓名', '職責', '單位'].forEach((t, i) => put(us, `${col(i + 1)}${r}`, t, 'head')); r++;
    (p.team.length ? p.team : [{ name: '', role: '', unit: '' }]).forEach(t => { put(us, `A${r}`, t.name, 'input'); put(us, `B${r}`, t.role, 'input'); put(us, `C${r}`, t.unit, 'input'); r++; });
    r++; section('【HAZOP 事前資料】');
    ['資料', '已備妥', '版本／備註'].forEach((t, i) => put(us, `${col(i + 1)}${r}`, t, 'head')); r++;
    p.preDocs.forEach(d => { put(us, `A${r}`, d.name, 'data'); put(us, `B${r}`, d.ready ? '是' : '否', 'idx'); put(us, `C${r}`, d.note, 'input'); list(us, `B${r}`, ['是', '否']); r++; });
    r++; section('【匯出資訊】');
    kv('匯出時間', new Date().toLocaleString('zh-TW', { hour12: false })); kv('專案格式', App.SCHEMA);
    us.pageSetup = { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

    /* ---------- 判定設定 ---------- */
    const st = p.settings;
    const cfg = wb.addWorksheet('判定設定');
    widths(cfg, { A: 26, B: 12, C: 16, D: 80 });
    header(cfg, '判定設定：門檻與分級參數', '本表集中管理所有判定門檻。黃底為可調整的設定值，修改後「系統作用危害分析」「HAZOP」「引導字對照表」會自動套用。「依據」欄引述高雄市《第三章 製程安全評估報告書》第 3-5 頁原文。', 'D');
    ['項目', '設定值', '單位', '依據／說明'].forEach((t, i) => put(cfg, `${col(i + 1)}4`, t, 'head'));
    const cfgRows = [
      ['Q／TQ 門檻', st.qtq, '比例', '原文「Q＞20% TQ」', '0%'],
      ['多物質 Q／TQ 計算方式', st.multiMode === 'max' ? '單一最大' : '加總', '加總／單一最大', '原文未規定。「加總」＝Σ(qᵢ／TQᵢ)，較保守；「單一最大」＝取區內比值最大的單一物質。'],
      ['高壓門檻（P）', st.pHigh, 'kg/cm²', '原文「P≧20 ㎏/㎝²」'],
      ['真空門檻（P）', st.vacuum, 'mmHg（絕對壓）', '原文「P≦500 ㎜Hg」：最低操作壓力（絕對壓）≦500 mmHg 即符合。'],
      ['熱不安定物質之壓力門檻', st.unstablePsig, 'psig', '原文「具有在 100℃以下熱不安定性，或與一般物質…接觸後起反應之物質，P≧10psig」：物質條件與壓力條件需同時成立。'],
      ['　└ 換算為 kg/cm²', null, 'kg/cm²', '1 psi＝0.0703070 kg/cm²（公式自動換算）', '0.000'],
      ['壓差倍數', st.dpFactor, '倍', '原文「(上游壓力)≧4(下游壓力)」：以「上游≧4×下游」判定。'],
      ['壓差計算基準', st.dpBasis === 'absolute' ? '絕對壓' : '錶壓', '錶壓／絕對壓', '原文未指明。選「錶壓」直接以輸入值比較；選「絕對壓」時上下游各加一大氣壓再比較（輸入值一律填錶壓）。'],
      ['大氣壓', st.atm, 'kg/cm²', '絕對壓換算用（1 atm＝1.0332 kg/cm²）', '0.0000'],
    ];
    cfgRows.forEach(([k, v, u, note, fmt], i) => {
      const rr = 5 + i;
      put(cfg, `A${rr}`, k, 'data'); put(cfg, `C${rr}`, u, 'idx'); put(cfg, `D${rr}`, note, 'data');
      if (rr === 10) formula(cfg, 'B10', 'B9*0.0703070', st.unstablePsig * 0.0703070, ctx, { numFmt: fmt });
      else put(cfg, `B${rr}`, v, 'need', { numFmt: fmt });
      cfg.getRow(rr).height = 40;
    });
    list(cfg, 'B6', ['加總', '單一最大']); list(cfg, 'B12', ['錶壓', '絕對壓']);
    cfg.mergeCells('A15:D15'); put(cfg, 'A15', '風險分級（HAZOP 風險分數＝嚴重性×可能性）', 'label');
    ['等級', '分數下限（≧）', '', '說明'].forEach((t, i) => put(cfg, `${col(i + 1)}16`, t, 'head'));
    [['極高', st.risk.extreme, '本範本自訂，請依公司風險矩陣調整'], ['高', st.risk.high, '同上'], ['中', st.risk.medium, '同上；低於此值為「低」']].forEach(([k, v, n], i) => {
      put(cfg, `A${17 + i}`, k, 'idx'); put(cfg, `B${17 + i}`, v, 'need'); put(cfg, `C${17 + i}`, '', 'idx'); put(cfg, `D${17 + i}`, n, 'data');
    });
    cfg.views = [{ state: 'frozen', ySplit: 4 }];
    cfg.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    const QTQ = `${S}$B$5`, MODE = `${S}$B$6`, PHI = `${S}$B$7`, VAC = `${S}$B$8`, P10 = `${S}$B$10`, KDP = `${S}$B$11`, BASIS = `${S}$B$12`, ATM = `${S}$B$13`;
    const R_EX = `${S}$B$17`, R_HI = `${S}$B$18`, R_MD = `${S}$B$19`;

    /* ---------- 檢核表 A ---------- */
    const chems = p.chemicals;
    const A = wb.addWorksheet('檢核表A-物質危害');
    header(A, '檢核表 A：物質危害檢核表', '檢討化學物質的易燃性、安定性、毒性及健康危害。危害欄請填「有」或「無」；危害之潛在性請選「重大／可能／無」，並在下方註解區補充說明。', 'S', p.meta);
    widths(A, { A: 6, B: 16, C: 8, D: 12, E: 12, F: 7, G: 7, H: 7, I: 11, J: 7, K: 7, L: 7, M: 8, N: 10, O: 10, P: 7, Q: 7, R: 11, S: 11 });
    [['A4:A5', '項次'], ['B4:B5', '品名'], ['C4:C5', '狀態'], ['D4:E4', '總量'], ['F4:H4', '火災爆炸之危害'], ['I4:I5', '反應性／安定性'], ['J4:K4', '毒性危害'], ['L4:Q4', '其他健康之危害'], ['R4:R5', '危害之潛在性'], ['S4:S5', '參考註解號數']]
      .forEach(([rng, t]) => { A.mergeCells(rng); put(A, rng.split(':')[0], t, 'head'); });
    ['庫存量 (kg)', '生產量 (kg)', '火災', '爆炸', '靜電'].forEach((t, i) => put(A, `${col(4 + i)}5`, t, 'head'));
    ['急性', '慢性', '窒息', '腐蝕性', '燙傷／凍傷', '致突變性', '臭味', '其他'].forEach((t, i) => put(A, `${col(10 + i)}5`, t, 'head'));
    ['A4', 'B4', 'C4', 'I4', 'R4', 'S4'].forEach(a => put(A, a.replace('4', '5'), undefined, 'head'));
    A.getRow(4).height = 22; A.getRow(5).height = 32;
    const aNos = noteNos(chems, 'aNote');
    const nA = Math.max(chems.length, 20);
    const togColsA = { F: 'fire', G: 'explosion', H: 'static', J: 'acute', K: 'chronic', L: 'asphyxia', M: 'corrosive', N: 'burn', O: 'mutagenic', P: 'odor', Q: 'other' };
    for (let i = 0; i < nA; i++) {
      const rr = 6 + i, c = chems[i] || null;
      put(A, `A${rr}`, i + 1, 'idx');
      put(A, `B${rr}`, c ? c.name : '', 'input'); put(A, `C${rr}`, c ? c.state : '', 'input');
      put(A, `D${rr}`, c ? c.stockKg : '', 'input', { numFmt: '#,##0.##' }); put(A, `E${rr}`, c ? c.productionKg : '', 'input', { numFmt: '#,##0.##' });
      Object.entries(togColsA).forEach(([cl, k]) => put(A, `${cl}${rr}`, c ? c.a[k] : '', 'input', { align: { horizontal: 'center' } }));
      put(A, `I${rr}`, c ? c.a.reactivity : '', 'input'); put(A, `R${rr}`, c ? c.aPotential : '', 'input', { align: { horizontal: 'center' } });
      put(A, `S${rr}`, c ? aNos[c.id] : '', 'input', { align: { horizontal: 'center' } });
      A.getRow(rr).height = 24;
    }
    const lA = 5 + nA;
    list(A, `C6:C${lA}`, App.STATES); list(A, `F6:H${lA}`, ['有', '無']); list(A, `J6:Q${lA}`, ['有', '無']);
    list(A, `I6:I${lA}`, App.REACTIVITY); list(A, `R6:R${lA}`, App.POTENTIAL);
    cf(A, `R6:R${lA}`, [['R6="重大"', RED], ['R6="可能"', ORG]]);
    notesBlock(A, lA + 2, 'S', '註解（請依實際危害補充）', chems, 'aNote', aNos);
    page(A, '1:5', [3, 5]);

    /* ---------- 檢核表 B ---------- */
    const B = wb.addWorksheet('檢核表B-物質相容性');
    header(B, '檢核表 B：物質相容性檢核表', '檢討化學品與化學品、化學品與設備結構材質之間，在製程中不正常接觸時是否會發生化學反應。材質例：SS304、SS316、碳鋼、鑄鐵、鋁、人造橡膠、尼龍、PTFE。', 'H', p.meta);
    widths(B, { A: 6, B: 18, C: 20, D: 14, E: 42, F: 11, G: 11, H: 24, I: 8, J: 10, K: 10, L: 10 });
    ['項次', '物質一', '物質二／結構材質', '接觸情境', '可能反應／後果', '危害之潛在性', '參考註解號數', '備註'].forEach((t, i) => put(B, `${col(i + 1)}4`, t, 'head'));
    const bNos = noteNos(p.compat, 'note');
    const nB = Math.max(p.compat.length, 20);
    for (let i = 0; i < nB; i++) {
      const rr = 5 + i, x = p.compat[i] || null;
      put(B, `A${rr}`, i + 1, 'idx');
      [['B', 'sub1'], ['C', 'sub2'], ['D', 'scenario'], ['E', 'consequence'], ['F', 'potential'], ['H', 'remark']].forEach(([cl, k]) => put(B, `${cl}${rr}`, x ? x[k] : '', 'input'));
      put(B, `G${rr}`, x ? bNos[x.id] : '', 'input', { align: { horizontal: 'center' } });
      B.getRow(rr).height = 30;
    }
    const lB = 4 + nB;
    list(B, `D5:D${lB}`, App.SCENARIOS); list(B, `F5:F${lB}`, App.POTENTIAL);
    cf(B, `F5:F${lB}`, [['F5="重大"', RED], ['F5="可能"', ORG]]);
    notesBlock(B, lB + 2, 'H', '註解', p.compat, 'note', bNos);
    page(B, '1:4', [0, 4]);

    /* ---------- 檢核表 C ---------- */
    const C = wb.addWorksheet('檢核表C-處理方法');
    header(C, '檢核表 C：處理方法檢核表', '考慮化學物質危害對裝置／製程系統設計的可能需求。各設計需求欄請填「有」（有此需求／已設置）、「無」或「不適用」。', 'O', p.meta);
    widths(C, { A: 6, B: 14, C: 8, D: 12, E: 11, F: 12, G: 12, H: 11, I: 8, J: 11, K: 11, L: 11, M: 11, N: 11, O: 11 });
    ['項次', '品名', '狀態', '總量', ...App.C_ITEMS.map(x => x[1]), '危害之潛在性', '參考註解號數'].forEach((t, i) => put(C, `${col(i + 1)}4`, t, 'head'));
    C.getRow(4).height = 32;
    const cNos = noteNos(chems, 'cNote');
    for (let i = 0; i < nA; i++) {
      const rr = 5 + i, c = chems[i] || null;
      put(C, `A${rr}`, i + 1, 'idx');
      put(C, `B${rr}`, c ? c.name : '', 'input'); put(C, `C${rr}`, c ? c.state : '', 'input');
      let total = c ? c.cTotal : '';
      if (c && E(total) && [c.stockKg, c.productionKg].some(App.isNum)) total = `${App.fmtNum((Number(c.stockKg) || 0) + (Number(c.productionKg) || 0))} kg`;
      put(C, `D${rr}`, total, 'input');
      App.C_ITEMS.forEach(([k], j) => put(C, `${col(5 + j)}${rr}`, c ? c.c[k] : '', 'input', { align: { horizontal: 'center' } }));
      put(C, `N${rr}`, c ? c.cPotential : '', 'input', { align: { horizontal: 'center' } });
      put(C, `O${rr}`, c ? cNos[c.id] : '', 'input', { align: { horizontal: 'center' } });
      C.getRow(rr).height = 24;
    }
    const lC = 4 + nA;
    list(C, `C5:C${lC}`, App.STATES); list(C, `E5:M${lC}`, ['有', '無', '不適用']); list(C, `N5:N${lC}`, App.POTENTIAL);
    cf(C, `N5:N${lC}`, [['N5="重大"', RED], ['N5="可能"', ORG]]);
    notesBlock(C, lC + 2, 'O', '註解', chems, 'cNote', cNos);
    page(C, '1:4', [2, 4]);

    /* ---------- 系統作用危害分析、區域物質存量、TQ 表（三者互相參照，先決定範圍） ---------- */
    const areaOrder = new Map(p.areas.map((a, i) => [a.id, i]));
    const inv = p.inventory.slice().sort((x, y) => (areaOrder.has(x.areaId) ? areaOrder.get(x.areaId) : 1e9) - (areaOrder.has(y.areaId) ? areaOrder.get(y.areaId) : 1e9));
    const nI = Math.max(inv.length, 60), I1 = 5, I2 = 4 + nI;
    const nS = Math.max(p.areas.length, 20), S1 = 5, S2 = 4 + nS;
    const T1 = 5, T2 = 4 + App.TQ_TABLE.length + p.customTQ.length + 10;
    const INV = sheetRef('區域物質存量'), TQS = sheetRef('TQ法定限量表'), SYS = sheetRef('系統作用危害分析');
    const TQ_NAME = `${TQS}$C$${T1}:$C$${T2}`, TQ_VAL = `${TQS}$F$${T1}:$F$${T2}`, TQ_TAG = `${TQS}$B$${T1}:$B$${T2}`;

    const iv = wb.addWorksheet('區域物質存量');
    header(iv, '區域物質存量：各製程區域 Q／TQ 自動計算', '逐列填入各區域塔槽、管線中瞬間可能出現之最大存量。物質名稱可從選單選附表物質，也可輸入非附表物質（標示「非附表物質」且不計入 Q）。濃度留白視為 100%；數量依濃度換算為純物質。製程區域請先在「系統作用危害分析」B 欄建立。', 'K', p.meta);
    widths(iv, { A: 6, B: 24, C: 20, D: 20, E: 14, F: 10, G: 14, H: 14, I: 11, J: 10, K: 30 });
    ['項次', '製程區域', '物質名稱', '設備／位置', '最大存量 q (kg)', '濃度 (%)', '純物質量 (kg)', '附表類別', 'TQ (kg)', 'q／TQ', '備註'].forEach((t, i) => put(iv, `${col(i + 1)}4`, t, 'head'));
    iv.getRow(4).height = 36;
    const areaName = id => { const a = p.areas.find(x => x.id === id); return a ? a.name : ''; };
    for (let i = 0; i < nI; i++) {
      const rr = I1 + i, x = inv[i] || null;
      const c = x ? App.calcInventory(x, p) : null;
      put(iv, `A${rr}`, i + 1, 'idx');
      put(iv, `B${rr}`, x ? areaName(x.areaId) : '', 'input'); put(iv, `C${rr}`, x ? x.substance : '', 'input'); put(iv, `D${rr}`, x ? x.location : '', 'input');
      put(iv, `E${rr}`, x ? x.qKg : '', 'input', { numFmt: '#,##0.##' }); put(iv, `F${rr}`, x ? x.conc : '', 'input', { numFmt: '0.##' });
      formula(iv, `G${rr}`, `IF(OR(C${rr}="",NOT(ISNUMBER(E${rr}))),"",E${rr}*IF(ISNUMBER(F${rr}),F${rr},100)/100)`, c && c.pure !== null ? c.pure : '', ctx, { numFmt: '#,##0.##' });
      formula(iv, `H${rr}`, `IF(C${rr}="","",IFERROR(INDEX(${TQ_TAG},MATCH(C${rr},${TQ_NAME},0)),"非附表物質"))`, x && !E(x.substance) ? (c.tq ? c.tq.annex : '非附表物質') : '', ctx);
      formula(iv, `I${rr}`, `IF(C${rr}="","",IFERROR(INDEX(${TQ_VAL},MATCH(C${rr},${TQ_NAME},0)),"—"))`, x && !E(x.substance) ? (c.tq ? c.tq.tq : '—') : '', ctx, { numFmt: '#,##0' });
      formula(iv, `J${rr}`, `IF(AND(ISNUMBER(G${rr}),ISNUMBER(I${rr})),IF(I${rr}>0,G${rr}/I${rr},0),0)`, c ? c.ratio : 0, ctx, { numFmt: '0.0%;-0.0%;""' });
      put(iv, `K${rr}`, x ? x.remark : '', 'input');
    }
    list(iv, `B${I1}:B${I2}`, null, { ref: `${SYS}$B$${S1}:$B$${S2}` });
    list(iv, `C${I1}:C${I2}`, null, { ref: TQ_NAME, warning: true });
    cf(iv, `H${I1}:H${I2}`, [[`H${I1}="非附表物質"`, YEL]]);
    page(iv, '1:4', [2, 4]);

    const sw = wb.addWorksheet('系統作用危害分析');
    header(sw, '系統作用危害分析：重大潛在危害區域判定', '依製程實務劃分各系統／單元，逐區檢核。符合下列①～⑦任一條件即列為重大潛在危害區域（門檻見「判定設定」）。Q 由「區域物質存量」自動彙算。判定結果：有條件成立 →「重大潛在危害」；無條件成立但有欄位未填 →「資料不完整」；全部填妥且皆未成立 →「—」。壓力一律填錶壓。', 'W', p.meta);
    const heads = ['項次', '製程區域／系統單元', 'Q (kg)\n附表物質純量合計', 'Σ q／TQ', '最大單一\nq／TQ', '①\nQ＞20% TQ？', '②\n高放熱反應', '反應類型', '③\n組成在\nLEL～UEL\n間或附近', '④\n100°C以下熱不安定／\n與空氣、水反應之物質',
      'T (°C)\n最大操作溫度', 'A.I.T. (°C)\n自燃溫度', '易燃性氣體', '⑤\nT＞A.I.T.\n或易燃性氣體', 'P (kg/cm²G)\n最大操作壓力', '最低操作壓力\n(mmHg abs)\n非真空留白', '上游壓力\n(kg/cm²G)', '下游壓力\n(kg/cm²G)', '上游／下游\n壓力比', '成立條件', '缺漏欄位', '判定結果', '備註'];
    heads.forEach((t, i) => put(sw, `${col(i + 1)}4`, t, 'head'));
    sw.getRow(4).height = 92;
    widths(sw, { A: 6, B: 22, C: 13, D: 9, E: 10, F: 10, G: 9, H: 11, I: 11, J: 16, K: 11, L: 11, M: 9, N: 11, O: 12, P: 13, Q: 10, R: 10, S: 10, T: 11, U: 22, V: 13, W: 28 });
    const INVB = `${INV}$B$${I1}:$B$${I2}`, INVG = `${INV}$G$${I1}:$G$${I2}`, INVI = `${INV}$I$${I1}:$I$${I2}`, INVJ = `${INV}$J$${I1}:$J$${I2}`;
    for (let i = 0; i < nS; i++) {
      const rr = S1 + i, a = p.areas[i] || null;
      const res = a ? App.calcArea(a, p) : null;
      const adj = `IF(${BASIS}="絕對壓",${ATM},0)`;
      put(sw, `A${rr}`, i + 1, 'idx');
      const inputs = { B: 'name', G: 'exo', H: 'reactionType', I: 'lel', J: 'unstable', K: 'T', L: 'AIT', M: 'flammableGas', O: 'P', P: 'vacuum', Q: 'pUp', R: 'pDown', W: 'remark' };
      Object.entries(inputs).forEach(([cl, k]) => put(sw, `${cl}${rr}`, a ? a[k] : '', 'input'));
      const blank = !a || E(a.name);
      formula(sw, `C${rr}`, `IF(B${rr}="","",SUMIFS(${INVG},${INVB},B${rr},${INVI},">0"))`, blank ? '' : res.Q, ctx, { numFmt: '#,##0.##' });
      formula(sw, `D${rr}`, `IF(B${rr}="","",SUMIF(${INVB},B${rr},${INVJ}))`, blank ? '' : res.sum, ctx, { numFmt: '0.0%' });
      formula(sw, `E${rr}`, `IF(B${rr}="","",SUMPRODUCT(MAX((${INVB}=B${rr})*${INVJ})))`, blank ? '' : res.max, ctx, { numFmt: '0.0%' });
      formula(sw, `F${rr}`, `IF(B${rr}="","",IF(COUNTIFS(${INVB},B${rr},${INVI},">0")=0,"不適用",IF(IF(${MODE}="單一最大",E${rr},D${rr})>${QTQ},"是","否")))`, blank ? '' : res.c1, ctx, { align: { horizontal: 'center' } });
      formula(sw, `N${rr}`, `IF(B${rr}="","",IF(M${rr}="是","是",IF(OR(NOT(ISNUMBER(K${rr})),NOT(ISNUMBER(L${rr}))),"",IF(K${rr}>L${rr},"是","否"))))`, blank ? '' : res.c5, ctx, { align: { horizontal: 'center' } });
      formula(sw, `S${rr}`, `IF(OR(B${rr}="",NOT(ISNUMBER(Q${rr})),NOT(ISNUMBER(R${rr}))),"",IF(R${rr}+${adj}<=0,"∞",(Q${rr}+${adj})/(R${rr}+${adj})))`,
        blank || res.ratioDP === null ? '' : (res.ratioDP === Infinity ? '∞' : res.ratioDP), ctx, { numFmt: '0.00' });
      formula(sw, `T${rr}`, `IF(B${rr}="","",IF(F${rr}="是","①","")&IF(G${rr}="是","②","")&IF(I${rr}="是","③","")`
        + `&IF(AND(J${rr}="是",ISNUMBER(O${rr})),IF(O${rr}>=${P10},"④",""),"")&IF(N${rr}="是","⑤","")`
        + `&IF(OR(AND(ISNUMBER(O${rr}),O${rr}>=${PHI}),AND(ISNUMBER(P${rr}),P${rr}<=${VAC})),"⑥","")`
        + `&IF(AND(ISNUMBER(Q${rr}),ISNUMBER(R${rr})),IF(Q${rr}+${adj}>=${KDP}*(R${rr}+${adj}),"⑦",""),""))`, blank ? '' : res.triggers.join(''), ctx);
      formula(sw, `U${rr}`, `IF(B${rr}="","",MID(IF(COUNTIF(${INVB},B${rr})=0,"、存量表未填","")`
        + `&IF(G${rr}="","、高放熱","")&IF(I${rr}="","、LEL～UEL","")&IF(J${rr}="","、熱不安定","")`
        + `&IF(AND(M${rr}<>"是",OR(NOT(ISNUMBER(K${rr})),NOT(ISNUMBER(L${rr})))),"、T／A.I.T.","")&IF(M${rr}="","、易燃性氣體","")`
        + `&IF(NOT(ISNUMBER(O${rr})),"、最大操作壓力","")&IF(OR(NOT(ISNUMBER(Q${rr})),NOT(ISNUMBER(R${rr}))),"、上下游壓力",""),2,200))`, blank ? '' : res.missing.join('、'), ctx);
      formula(sw, `V${rr}`, `IF(B${rr}="","",IF(T${rr}<>"","重大潛在危害",IF(U${rr}<>"","資料不完整","—")))`, blank ? '' : res.result, ctx, { align: { horizontal: 'center' } });
      sw.getRow(rr).height = 26;
    }
    ['G', 'I', 'J', 'M'].forEach(cl => list(sw, `${cl}${S1}:${cl}${S2}`, ['是', '否']));
    list(sw, `H${S1}:H${S2}`, ['氧化', '硝化', '鹵化', '有機金屬化', '偶氮化', '氫化', '裂解/熱分解', '聚合', '磺化', '縮合', '其他'], { warning: true });
    cf(sw, `V${S1}:V${S2}`, [[`V${S1}="重大潛在危害"`, RED], [`V${S1}="資料不完整"`, ORG]]);
    let nr = S2 + 2;
    [
      '判定條件原文（高雄市《第三章 製程安全評估報告書》第 3-5 頁）',
      '① Q＞20% TQ。　② 高放熱反應：氧化、硝化、鹵化、有機金屬化、偶氮化、氫化、裂解/熱分解、聚合、磺化、縮合反應等。　③ 製程中之組成在爆炸下限（LEL）以上，爆炸上限（UEL）以下，或濃度在此範圍附近者。',
      '④ 具有在 100℃以下熱不安定性，或與一般物質，如空氣、水、其他可能污染物接觸後起反應之物質，P≧10psig。　⑤ T＞A.I.T.或為易燃性氣體。　⑥ P≧20 ㎏/㎝² 或 P≦500 ㎜Hg。　⑦ 製程中有明顯之高低壓差，ΔP；(上游壓力)≧4(下游壓力)。',
      '符號：Q＝製程區域中瞬間可能出現之危險物或有害物的最大量（kg）；TQ＝勞動檢查法施行細則附表一危險物或附表二有害物的法定限量；T＝最大操作溫度；A.I.T.＝自燃溫度；P＝最大操作壓力；ΔP＝上下游操作壓差。',
      '除上述判定模式外，亦可採用蒙氏指數（Mond Index）、陶氏火災爆炸指數（Dow F&EI）或化學暴露指數（CEI）等國際危害分析方法。',
    ].forEach(t => { sw.mergeCells(`A${nr}:W${nr}`); put(sw, `A${nr}`, t, 'note'); sw.getRow(nr).height = 34; nr++; });
    page(sw, '1:4', [2, 4]);

    /* ---------- HAZOP（每個節點一張） ---------- */
    const nodes = p.nodes.length ? p.nodes : [null];
    const hazopRow = {};   // 偏離 id → [工作表名, 列號]
    nodes.forEach((node, ni) => {
      const name = node ? `HAZOP-N${ni + 1}` : 'HAZOP工作表';
      const hz = wb.addWorksheet(name);
      const rows = node ? p.deviations.filter(d => d.nodeId === node.id) : [];
      hz.mergeCells('A1:P1'); put(hz, 'A1', `危害與可操作性分析（HAZOP）工作表${node ? `　節點 N${ni + 1}` : ''}`, 'title'); hz.getRow(1).height = 32;
      hz.mergeCells('A2:P2'); put(hz, 'A2', '依報告書表 3.2.3-2 格式。風險分數＝嚴重性×可能性；等級門檻在「判定設定」工作表調整。', 'desc');
      const m = node || {};
      [['A3', '製程／操作程序名稱：', 'B3:D3', m.process], ['E3', '節點描述：', 'F3:H3', m.name], ['I3', '管線設備編號：', 'J3:L3', m.lineNo],
        ['A4', '設計目的：', 'B4:D4', m.intent], ['E4', '圖號 (P&ID)：', 'F4:H4', m.pid], ['I4', '會議日期：', 'J4:L4', m.meetingDate],
        ['A5', '主持人：', 'B5:D5', m.chair], ['E5', '記錄：', 'F5:H5', m.recorder], ['I5', '參與人員：', 'J5:L5', m.participants]]
        .forEach(([la, lt, rng, v]) => { put(hz, la, lt, 'label'); hz.getCell(la).alignment = { vertical: 'middle', wrapText: true }; hz.mergeCells(rng); put(hz, rng.split(':')[0], E(v) ? '〔待填〕' : v, 'meta'); });
      const area = node ? p.areas.find(a => a.id === node.areaId) : null;
      put(hz, 'M3', '所屬區域：', 'label'); hz.mergeCells('N3:P3'); put(hz, 'N3', area ? area.name : '', 'meta');
      [3, 4, 5].forEach(x => { hz.getRow(x).height = 30; });
      ['項次', '節點', '引導字', '製程參數', '製程偏離', '可能原因', '可能危害／後果', '現有防護措施', '嚴重性\n(1-5)', '可能性\n(1-5)', '風險分數', '風險等級', '改善建議', '負責人', '完成期限', '追蹤狀態']
        .forEach((t, i) => put(hz, `${col(i + 1)}6`, t, 'head'));
      hz.getRow(6).height = 36;
      widths(hz, { A: 12, B: 22, C: 13, D: 10, E: 13, F: 26, G: 30, H: 24, I: 9, J: 9, K: 9, L: 9, M: 30, N: 11, O: 12, P: 10 });
      const n = Math.max(rows.length, 30);
      for (let i = 0; i < n; i++) {
        const rr = 7 + i, d = rows[i] || null;
        if (d) hazopRow[d.id] = [name, rr];
        put(hz, `A${rr}`, i + 1, 'idx');
        put(hz, `B${rr}`, d ? node.name : '', 'input');
        [['C', 'guideWord'], ['D', 'param'], ['E', 'deviation'], ['F', 'cause'], ['G', 'consequence'], ['H', 'safeguards'], ['M', 'recommendation'], ['N', 'owner'], ['P', 'status']]
          .forEach(([cl, k]) => put(hz, `${cl}${rr}`, d ? d[k] : '', 'input'));
        put(hz, `I${rr}`, d ? d.severity : '', 'input', { align: { horizontal: 'center' } });
        put(hz, `J${rr}`, d ? d.likelihood : '', 'input', { align: { horizontal: 'center' } });
        put(hz, `O${rr}`, d ? toDate(d.due) : '', 'input', { numFmt: 'yyyy-mm-dd' });
        const score = d ? App.riskScore(d) : '';
        formula(hz, `K${rr}`, `IF(OR(I${rr}="",J${rr}=""),"",I${rr}*J${rr})`, score, ctx, { align: { horizontal: 'center' } });
        formula(hz, `L${rr}`, `IF(K${rr}="","",IF(K${rr}>=${R_EX},"極高",IF(K${rr}>=${R_HI},"高",IF(K${rr}>=${R_MD},"中","低"))))`, d ? App.riskLevel(score, p) : '', ctx, { align: { horizontal: 'center' } });
        hz.getRow(rr).height = 30;
      }
      const l = 6 + n;
      list(hz, `C7:C${l}`, App.GUIDE_WORDS); list(hz, `D7:D${l}`, Object.keys(App.DEVIATIONS));
      list(hz, `I7:J${l}`, ['1', '2', '3', '4', '5']); list(hz, `P7:P${l}`, App.STATUS);
      cf(hz, `L7:L${l}`, [['L7="極高"', RED], ['L7="高"', ORG], ['L7="中"', YEL], ['L7="低"', GRN]]);
      page(hz, '1:6', [2, 6]);
    });

    /* ---------- 改善建議彙整 ---------- */
    const acts = App.actionList(p, today);
    const im = wb.addWorksheet('改善建議彙整');
    header(im, '改善建議彙整表', '彙整初步危害分析與 HAZOP 的改善建議，追蹤至結案。HAZOP 來源的改善建議、風險等級、負責人、期限與辦理情形以公式連到各 HAZOP 工作表（淺藍底），請在 HAZOP 工作表修改；實際完成日與備註在本表填寫。', 'J', p.meta);
    widths(im, { A: 6, B: 18, C: 46, D: 10, E: 18, F: 13, G: 13, H: 10, I: 10, J: 26, K: 10, L: 10 });
    ['項次', '來源\n(HAZOP 節點-項次／檢核表)', '改善建議', '風險等級', '負責單位／負責人', '預定完成日', '實際完成日', '辦理情形', '是否逾期', '備註'].forEach((t, i) => put(im, `${col(i + 1)}4`, t, 'head'));
    im.getRow(4).height = 52;
    const nM = Math.max(acts.length, 20);
    for (let i = 0; i < nM; i++) {
      const rr = 5 + i, x = acts[i] || null, it = x ? x.item : {};
      put(im, `A${rr}`, i + 1, 'idx');
      put(im, `B${rr}`, x ? x.ref : '', 'input');
      if (x && x.kind === 'hazop') {
        const [hn, hr] = hazopRow[it.id];
        const ref = sheetRef(hn);
        const link = (cl, src, cache, opts) => formula(im, `${cl}${rr}`, `IF(${ref}${src}${hr}="","",${ref}${src}${hr})`, cache, ctx, opts);
        link('C', 'M', it.recommendation); link('D', 'L', x.level, { align: { horizontal: 'center' } }); link('E', 'N', it.owner);
        link('F', 'O', E(it.due) ? '' : toDate(it.due), { numFmt: 'yyyy-mm-dd' }); link('H', 'P', it.status, { align: { horizontal: 'center' } });
      } else {
        put(im, `C${rr}`, it.recommendation, 'input'); put(im, `D${rr}`, it.level, 'input', { align: { horizontal: 'center' } });
        put(im, `E${rr}`, it.owner, 'input'); put(im, `F${rr}`, toDate(it.due), 'input', { numFmt: 'yyyy-mm-dd' });
        put(im, `H${rr}`, it.status, 'input', { align: { horizontal: 'center' } });
      }
      put(im, `G${rr}`, x ? toDate(it.doneDate) : '', 'input', { numFmt: 'yyyy-mm-dd' });
      formula(im, `I${rr}`, `IF(OR(F${rr}="",G${rr}<>""),"",IF(TODAY()>F${rr},"逾期","未到期"))`, x ? x.overdue : '', ctx, { align: { horizontal: 'center' } });
      put(im, `J${rr}`, x ? it.remark : '', 'input');
      im.getRow(rr).height = 30;
    }
    const lM = 4 + nM;
    for (let rr = 5; rr <= lM; rr++) {
      const x = acts[rr - 5];
      if (!x || x.kind !== 'hazop') { list(im, `D${rr}`, App.RISK_LEVELS); list(im, `H${rr}`, App.STATUS); }
    }
    cf(im, `D5:D${lM}`, [['D5="極高"', RED], ['D5="高"', ORG], ['D5="中"', YEL], ['D5="低"', GRN]]);
    cf(im, `I5:I${lM}`, [['I5="逾期"', RED]]);
    page(im, '1:4', [0, 4]);

    /* ---------- 引導字對照表 ---------- */
    const gw = wb.addWorksheet('引導字對照表');
    widths(gw, { A: 14, B: 20, C: 20, D: 20, E: 20, F: 20, G: 20, H: 20 });
    gw.mergeCells('A1:H1'); put(gw, 'A1', '表 3.2.3-1 常用之製程偏離參數表（依報告書重建）', 'title'); gw.getRow(1).height = 30;
    gw.mergeCells('A2:H2'); put(gw, 'A2', '引導字 × 製程參數 → 製程偏離。「—」表示該組合一般不適用或無意義，請依實際製程判斷。', 'desc');
    put(gw, 'A3', '製程參數 \\ 引導字', 'head'); App.GUIDE_WORDS.forEach((g, i) => put(gw, `${col(2 + i)}3`, g, 'head'));
    Object.entries(App.DEVIATIONS).forEach(([prm, devs], i) => {
      put(gw, `A${4 + i}`, prm, 'head'); devs.forEach((d, j) => put(gw, `${col(2 + j)}${4 + i}`, d, 'idx'));
    });
    gw.mergeCells('A14:H14'); put(gw, 'A14', '5 × 5 風險矩陣（風險分數＝嚴重性 × 可能性；分級門檻在「判定設定」調整，顏色會自動更新）', 'head');
    put(gw, 'A15', '可能性 \\ 嚴重性', 'head'); App.SEVERITY.forEach((s, i) => put(gw, `${col(2 + i)}15`, s, 'head'));
    App.LIKELIHOOD.forEach((l, li) => {
      put(gw, `A${16 + li}`, l, 'head');
      App.SEVERITY.forEach((_, si) => put(gw, `${col(2 + si)}${16 + li}`, (li + 1) * (si + 1), 'idx'));
    });
    cf(gw, 'B16:F20', [[`B16>=${R_EX}`, RED, true], [`B16>=${R_HI}`, ORG, true], [`B16>=${R_MD}`, YEL, true], [`B16<${R_MD}`, GRN, true]]);
    gw.mergeCells('A21:F21');
    formula(gw, 'A21', `"分級（依「判定設定」）：1–"&(${R_MD}-1)&" 低（綠）｜"&${R_MD}&"–"&(${R_HI}-1)&" 中（黃）｜"&${R_HI}&"–"&(${R_EX}-1)&" 高（橙）｜"&${R_EX}&"–25 極高（紅）"`,
      `分級（依「判定設定」）：1–${st.risk.medium - 1} 低（綠）｜${st.risk.medium}–${st.risk.high - 1} 中（黃）｜${st.risk.high}–${st.risk.extreme - 1} 高（橙）｜${st.risk.extreme}–25 極高（紅）`, ctx);
    gw.mergeCells('A23:H23'); put(gw, 'A23', 'HAZOP 執行步驟（報告書 3.2.3 節）', 'head');
    [App.HAZOP_STEPS.slice(0, 4), App.HAZOP_STEPS.slice(4, 9), App.HAZOP_STEPS.slice(9, 12), App.HAZOP_STEPS.slice(12)].forEach((s, i) => {
      gw.mergeCells(`A${24 + i}:H${24 + i}`); put(gw, `A${24 + i}`, s.join('。  ') + '。', 'note'); gw.getRow(24 + i).height = 22;
    });
    gw.mergeCells('A29:H29'); put(gw, 'A29', '製程安全評估方法選用對照（報告書 3.2.2 節摘要）', 'head');
    put(gw, 'A30', '方法', 'head');
    [['B30:C30', '建議使用時機'], ['D30:E30', '優點摘要'], ['F30:H30', '缺點摘要']].forEach(([rng, t]) => { gw.mergeCells(rng); put(gw, rng.split(':')[0], t, 'head'); });
    App.METHODS.forEach((m, i) => {
      const rr = 31 + i;
      put(gw, `A${rr}`, m[0], 'idx');
      [['B', 'C', m[1]], ['D', 'E', m[2]], ['F', 'H', m[3]]].forEach(([a, b, t]) => { gw.mergeCells(`${a}${rr}:${b}${rr}`); put(gw, `${a}${rr}`, t, 'data'); });
      gw.getRow(rr).height = 48;
    });
    gw.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

    /* ---------- TQ 法定限量表 ---------- */
    const tq = wb.addWorksheet('TQ法定限量表');
    header(tq, 'TQ 法定限量表（勞動檢查法施行細則附表一、附表二）', '資料來源：全國法規資料庫「勞動檢查法施行細則」（112 年 12 月 7 日修正）附表一、附表二。名稱以附表中文名稱認定；未列入的物質無法定限量，不列入 Q／TQ 計算。附表另有「其他中央主管機關指定公告者」，請補在下方黃底列。', 'G');
    tq.getRow(2).height = 58;
    widths(tq, { A: 6, B: 14, C: 28, D: 32, E: 16, F: 16, G: 36 });
    ['項次', '附表', '中文名稱', '英文名稱', '化學式', 'TQ 法定限量 (kg)', '備註'].forEach((t, i) => put(tq, `${col(i + 1)}4`, t, 'head'));
    let tr = T1;
    App.TQ_TABLE.forEach(t => {
      put(tq, `A${tr}`, tr - 4, 'idx'); put(tq, `B${tr}`, t.annex, 'idx'); put(tq, `C${tr}`, t.zh, 'idx'); put(tq, `D${tr}`, t.en, 'idx');
      put(tq, `E${tr}`, t.formula, 'idx'); put(tq, `F${tr}`, t.tq, 'idx', { numFmt: '#,##0' }); put(tq, `G${tr}`, '', 'idx'); tr++;
    });
    p.customTQ.forEach(t => {
      put(tq, `A${tr}`, tr - 4, 'idx'); put(tq, `B${tr}`, '其他指定公告', 'data');
      put(tq, `C${tr}`, t.zh, 'input'); put(tq, `D${tr}`, t.en, 'input'); put(tq, `E${tr}`, t.formula, 'input'); put(tq, `F${tr}`, t.tq, 'input', { numFmt: '#,##0' }); put(tq, `G${tr}`, '', 'input'); tr++;
    });
    while (tr <= T2) {
      put(tq, `A${tr}`, tr - 4, 'idx'); put(tq, `B${tr}`, '其他指定公告', 'need');
      ['C', 'D', 'E', 'F', 'G'].forEach(cl => put(tq, `${cl}${tr}`, '', 'need')); tr++;
    }
    tq.views = [{ state: 'frozen', ySplit: 4 }];
    tq.pageSetup = { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:4' };
    return wb;
  };

  /* 匯出並存檔 */
  App.exportXlsx = async function () {
    if (typeof ExcelJS === 'undefined') { App.toast('找不到 Excel 元件（vendor/exceljs.min.js），請確認 App 資料夾完整', 'error'); return; }
    const p = App.state;
    const name = `${(p.meta.site || p.meta.process || '未命名專案').replace(/[\\/:*?"<>|]/g, '_')}_製程安全評估_${App.today()}.xlsx`;
    try {
      const buf = await App.buildWorkbook(p, { cache: true }).xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      if ('showSaveFilePicker' in window) {
        const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Excel 活頁簿', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }] });
        const w = await handle.createWritable(); await w.write(blob); await w.close();
        App.toast('已匯出：' + handle.name);
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        App.toast('已匯出：' + name);
      }
    } catch (e) {
      if (e.name !== 'AbortError') App.toast('匯出失敗：' + e.message, 'error');
    }
  };
})();
