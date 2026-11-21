/* HAZOP 工作表、改善建議追蹤、總覽用的風險矩陣熱圖 */
(function () {
  const h = App.h;
  App.ui = App.ui || { nodeId: null, actionFilter: 'all', actionSort: 'order', matrixCell: null };

  const levelBadge = lv => lv ? h('span', { class: 'lvl v-' + lv }, lv) : '';
  const calc = (content, cls) => h('td', { class: 'calc ' + (cls || '') }, content);

  /* 數字下拉（嚴重性、可能性存成數字） */
  function numSelect(obj, key, labels, opts) {
    const el = h('select', { class: 'cell-select' + (App.isEmpty(obj[key]) ? ' need' : ''), 'aria-label': opts.label, dataset: { key: opts.key } },
      h('option', { value: '' }, '—'),
      labels.map((l, i) => h('option', { value: i + 1, selected: obj[key] === i + 1, title: l }, String(i + 1))));
    el.addEventListener('change', () => App.mutate(() => { obj[key] = el.value === '' ? '' : Number(el.value); }));
    return el;
  }

  /* 引導字／參數：換選項時，若偏離欄空白或仍是上一次自動帶出的文字，就換成新的偏離 */
  function gwSelect(d, key, options, label) {
    const el = h('select', { class: 'cell-select' + (App.isEmpty(d[key]) ? ' need' : ''), 'aria-label': label, dataset: { key: `dev:${d.id}:${key}` } },
      h('option', { value: '' }, '—'), options.map(o => h('option', { value: o, selected: d[key] === o }, o)));
    el.addEventListener('change', () => App.mutate(() => {
      const prevAuto = App.autoDeviation(d.guideWord, d.param);
      d[key] = el.value;
      if (App.isEmpty(d.deviation) || d.deviation === prevAuto) d.deviation = App.autoDeviation(d.guideWord, d.param) || '';
    }));
    return el;
  }

  function currentNode() {
    const nodes = App.state.nodes;
    if (!nodes.length) return null;
    return nodes.find(n => n.id === App.ui.nodeId) || nodes[0];
  }
  App.gotoNode = function (nodeId) { App.ui.nodeId = nodeId; if (location.hash === '#hazop') App.render(); else location.hash = 'hazop'; };

  App.createNodeFromArea = function (area) {
    const node = App.newNode(area);
    App.mutate(s => { s.nodes.push(node); }, { render: false });
    App.toast(`已建立 HAZOP 節點：${area.name || '未命名區域'}`);
    App.gotoNode(node.id);
  };

  /* ---------------- HAZOP 工作表 ---------------- */
  App.views.hazop = function () {
    const p = App.state;
    const node = currentNode();
    const majors = p.areas.filter(a => App.calcArea(a, p).result === '重大潛在危害');

    const fromArea = h('select', { class: 'cell-select from-area', 'aria-label': '從重大潛在危害區域建立節點', dataset: { key: 'node:from-area' },
      onchange: e => { const a = p.areas.find(x => x.id === e.target.value); if (a) App.createNodeFromArea(a); } },
    h('option', { value: '' }, majors.length ? `從重大潛在危害區域建立…（${majors.length} 區）` : '尚無判為重大的區域'),
    majors.map(a => { const n = p.nodes.filter(x => x.areaId === a.id).length; return h('option', { value: a.id }, `${a.name || '未命名'}${n ? `（已有 ${n} 個節點）` : ''}`); }));

    const tabs = h('div', { class: 'node-tabs', role: 'tablist' }, p.nodes.map((n, i) => {
      const cnt = p.deviations.filter(d => d.nodeId === n.id).length;
      return h('button', { type: 'button', role: 'tab', class: 'node-tab' + (node && n.id === node.id ? ' active' : ''), 'aria-selected': node && n.id === node.id ? 'true' : 'false',
        dataset: { key: `node-tab:${n.id}` }, onclick: () => { App.ui.nodeId = n.id; App.render(); } },
      h('span', { class: 'nt-no' }, 'N' + (i + 1)), h('span', { class: 'nt-name' }, n.name || '未命名節點'), h('small', null, cnt + ' 列'));
    }));

    return h('div', null,
      App.pageHeader('HAZOP 工作表', '依報告書表 3.2.3-2 格式：選節點 → 說明設計目的 → 選製程參數 → 套引導字產生偏離 → 列原因、後果、現有防護 → 評嚴重性與可能性 → 提改善建議。',
        fromArea,
        h('button', { type: 'button', class: 'btn primary', dataset: { key: 'node:add' },
          onclick: () => { const n = App.newNode(); App.mutate(s => s.nodes.push(n), { render: false }); App.gotoNode(n.id); } }, '＋ 新增節點')),
      p.nodes.length ? tabs : null,
      node ? nodePanel(node) : h('section', { class: 'card' }, h('p', { class: 'empty-msg' },
        '尚無 HAZOP 節點。可從上方「從重大潛在危害區域建立」，或按「＋ 新增節點」。系統作用判定為重大的區域，也可以在該頁直接建立節點。')));
  };

  function nodePanel(node) {
    const p = App.state;
    const ni = p.nodes.indexOf(node);
    const k = `node:${node.id}`;
    const rows = p.deviations.filter(d => d.nodeId === node.id);
    const f = (key, label, opts = {}) => h('label', { class: 'form-row' + (opts.wide ? ' wide' : '') }, h('span', null, label),
      App.field(node, key, Object.assign({ key: `${k}:${key}`, label }, opts)));
    const area = p.areas.find(a => a.id === node.areaId);
    const areaRes = area ? App.calcArea(area, p).result : '';

    const header = h('section', { class: 'card node-card' },
      h('div', { class: 'node-title' },
        h('h2', null, `節點 N${ni + 1}`),
        area ? h('span', { class: 'node-area' }, '所屬區域：', h('a', { href: '#areas' }, area.name || '未命名'), ' ', h('span', { class: 'result ' + (areaRes === '重大潛在危害' ? 'r-major' : areaRes === '資料不完整' ? 'r-incomplete' : 'r-ok') }, areaRes)) : null,
        h('div', { class: 'row-actions' },
          h('button', { type: 'button', class: 'icon-btn', title: '節點左移', 'aria-label': '節點左移', disabled: ni === 0, dataset: { key: k + ':left' },
            onclick: () => App.mutate(s => { const [it] = s.nodes.splice(ni, 1); s.nodes.splice(ni - 1, 0, it); }) }, '←'),
          h('button', { type: 'button', class: 'icon-btn', title: '節點右移', 'aria-label': '節點右移', disabled: ni === p.nodes.length - 1, dataset: { key: k + ':right' },
            onclick: () => App.mutate(s => { const [it] = s.nodes.splice(ni, 1); s.nodes.splice(ni + 1, 0, it); }) }, '→'),
          h('button', { type: 'button', class: 'icon-btn danger', title: '刪除節點', 'aria-label': '刪除節點', dataset: { key: k + ':del' },
            onclick: () => {
              if (!confirm(`確定刪除節點 N${ni + 1}「${node.name || '未命名'}」？` + (rows.length ? `\n此節點的 ${rows.length} 列偏離（含改善建議）會一併刪除。` : '') + '\n（可用「復原」救回）')) return;
              App.mutate(s => { s.nodes.splice(ni, 1); s.deviations = s.deviations.filter(d => d.nodeId !== node.id); });
            } }, '✕'))),
      h('div', { class: 'node-grid' },
        f('process', '製程／操作程序名稱'),
        f('name', '節點描述', { required: true, placeholder: '例：T-101→P-101→R-201 進料管線' }),
        f('lineNo', '管線設備編號'),
        f('intent', '設計目的', { required: true, multiline: true, wide: true, placeholder: '例：以 2 m³/h 將甲醇送入 R-201，操作壓力 5 kg/cm²G' }),
        f('pid', '圖號 (P&ID)'),
        f('meetingDate', '會議日期', { type: 'date' }),
        f('chair', '主持人'),
        f('recorder', '記錄'),
        h('label', { class: 'form-row wide' }, h('span', null, '參與人員'),
          h('div', { class: 'with-btn' },
            App.field(node, 'participants', { key: `${k}:participants`, label: '參與人員' }),
            p.team.length ? h('button', { type: 'button', class: 'link-btn', dataset: { key: k + ':team' },
              onclick: () => App.mutate(() => { node.participants = p.team.map(t => t.name).filter(Boolean).join('、'); }) }, '帶入 HAZOP 小組') : null)),
        h('label', { class: 'form-row' }, h('span', null, '所屬區域'),
          h('select', { class: 'cell-select', 'aria-label': '所屬區域', dataset: { key: k + ':area' }, onchange: e => App.mutate(() => { node.areaId = e.target.value; }) },
            h('option', { value: '' }, '（未指定）'), p.areas.map(a => h('option', { value: a.id, selected: a.id === node.areaId }, a.name || '未命名'))))));

    const params = Object.keys(App.DEVIATIONS);
    const body = rows.map((d, i) => devRow(d, i, rows));
    const batchParam = h('select', { class: 'cell-select', 'aria-label': '批次加入的製程參數', dataset: { key: k + ':batch-param' },
      onchange: e => { App.ui.batchParam = e.target.value; } },
    params.map(x => h('option', { value: x, selected: App.ui.batchParam === x }, x)));
    const table = h('section', { class: 'card' },
      h('div', { class: 'table-wrap' }, h('table', { class: 'grid sheet hazop' },
        h('thead', null, h('tr', null, ['項次', '引導字', '製程參數', '製程偏離', '可能原因', '可能危害／後果', '現有防護措施', '嚴重性\n(1-5)', '可能性\n(1-5)', '風險\n分數', '風險\n等級', '改善建議', '負責人', '完成期限', '追蹤狀態', '']
          .map((t, j) => h('th', { class: 'ml' + (j === 0 ? ' sticky-col1' : '') }, t)))),
        h('tbody', null, body.length ? body : h('tr', null, h('td', { colspan: 16, class: 'empty' }, '尚無偏離。按「＋ 新增偏離」，或用右側「批次加入」一次產生某參數的所有偏離。'))))),
      h('div', { class: 'area-tools' },
        h('button', { type: 'button', class: 'btn primary', dataset: { key: k + ':add-dev' }, onclick: () => App.mutate(s => s.deviations.push(App.newDeviation(node.id))) }, '＋ 新增偏離'),
        h('span', { class: 'batch' }, '批次加入：', batchParam,
          h('button', { type: 'button', class: 'btn', dataset: { key: k + ':batch' }, onclick: () => batchAdd(node, batchParam.value) }, '加入此參數的所有偏離'))),
      h('p', { class: 'hint' }, `風險分數＝嚴重性×可能性；等級依「判定設定」：極高≧${p.settings.risk.extreme}、高≧${p.settings.risk.high}、中≧${p.settings.risk.medium}。有填改善建議的列會自動列入「改善建議追蹤」。`));
    return h('div', null, header, table);
  }

  function batchAdd(node, param) {
    const p = App.state;
    const existing = new Set(p.deviations.filter(d => d.nodeId === node.id).map(d => d.guideWord + '|' + d.param));
    const add = App.GUIDE_WORDS.filter(g => App.autoDeviation(g, param) && !existing.has(g + '|' + param));
    if (!add.length) { App.toast(`「${param}」的偏離都已在此節點中`); return; }
    App.mutate(s => add.forEach(g => s.deviations.push(Object.assign(App.newDeviation(node.id), { guideWord: g, param, deviation: App.autoDeviation(g, param) }))));
    App.toast(`已加入「${param}」的 ${add.length} 個偏離`);
  }

  function devRow(d, i, rows) {
    const p = App.state;
    const k = `dev:${d.id}`;
    const score = App.riskScore(d);
    const na = d.guideWord && d.param && App.autoDeviation(d.guideWord, d.param) === null;
    const move = dir => App.mutate(s => {
      const a = s.deviations.indexOf(d), b = s.deviations.indexOf(rows[i + dir]);
      s.deviations[a] = rows[i + dir]; s.deviations[b] = d;
    });
    const ta = (key, label, req) => h('td', { class: 'txt' }, App.field(d, key, { key: `${k}:${key}`, multiline: true, required: req, label }));
    return h('tr', null,
      h('td', { class: 'num sticky-col1' }, i + 1),
      h('td', null, gwSelect(d, 'guideWord', App.GUIDE_WORDS, '引導字')),
      h('td', null, gwSelect(d, 'param', Object.keys(App.DEVIATIONS), '製程參數')),
      h('td', { class: 'dev-cell' }, App.field(d, 'deviation', { key: `${k}:deviation`, required: true, label: '製程偏離' }),
        na ? h('span', { class: 'badge warn', title: '表 3.2.3-1 中此組合標為「—」，請確認是否有意義' }, '一般不適用') : null),
      ta('cause', '可能原因', true), ta('consequence', '可能危害／後果', true), ta('safeguards', '現有防護措施', true),
      h('td', null, numSelect(d, 'severity', App.SEVERITY, { key: `${k}:sev`, label: '嚴重性' })),
      h('td', null, numSelect(d, 'likelihood', App.LIKELIHOOD, { key: `${k}:lik`, label: '可能性' })),
      calc(score, 'center score'),
      calc(levelBadge(App.riskLevel(score)), 'center'),
      ta('recommendation', '改善建議', false),
      h('td', null, App.field(d, 'owner', { key: `${k}:owner`, label: '負責人', class: 'owner-input' })),
      h('td', null, App.field(d, 'due', { key: `${k}:due`, type: 'date', label: '完成期限' })),
      h('td', null, App.select(d, 'status', App.STATUS, { key: `${k}:status`, label: '追蹤狀態' })),
      h('td', null, h('div', { class: 'row-actions' },
        h('button', { type: 'button', class: 'icon-btn', title: '上移', 'aria-label': '上移', disabled: i === 0, onclick: () => move(-1), dataset: { key: k + ':up' } }, '↑'),
        h('button', { type: 'button', class: 'icon-btn', title: '下移', 'aria-label': '下移', disabled: i === rows.length - 1, onclick: () => move(1), dataset: { key: k + ':down' } }, '↓'),
        h('button', { type: 'button', class: 'icon-btn', title: '複製此列', 'aria-label': '複製此列', dataset: { key: k + ':copy' },
          onclick: () => App.mutate(s => { const c = Object.assign(JSON.parse(JSON.stringify(d)), { id: App.uid(), cause: '', consequence: '', safeguards: '', severity: '', likelihood: '', recommendation: '', owner: '', due: '', doneDate: '', status: '', remark: '' }); s.deviations.splice(s.deviations.indexOf(d) + 1, 0, c); }) }, '⧉'),
        h('button', { type: 'button', class: 'icon-btn danger', title: '刪除', 'aria-label': '刪除', dataset: { key: k + ':del' },
          onclick: () => { if (confirm(`確定刪除第 ${i + 1} 列「${d.deviation || '未填偏離'}」？`)) App.mutate(s => { s.deviations = s.deviations.filter(x => x !== d); }); } }, '✕'))));
  }

  /* ---------------- 改善建議追蹤 ---------------- */
  App.views.actions = function () {
    const p = App.state;
    const today = App.today();
    const all = App.actionList(p, today);
    const sum = App.actionSummary(p, today);
    const isDone = x => x.item.status === '已完成' || !App.isEmpty(x.item.doneDate);
    const filters = {
      all: ['全部', () => true],
      open: ['未完成', x => !isDone(x)],
      overdue: ['逾期', x => x.overdue === '逾期'],
      high: ['極高＋高', x => x.level === '極高' || x.level === '高'],
    };
    let list = all.map((x, i) => Object.assign(x, { no: i + 1 })).filter(filters[App.ui.actionFilter] ? filters[App.ui.actionFilter][1] : () => true);
    const rank = { '極高': 0, '高': 1, '中': 2, '低': 3, '': 4 };
    if (App.ui.actionSort === 'risk') list = list.slice().sort((a, b) => rank[a.level] - rank[b.level] || a.no - b.no);
    if (App.ui.actionSort === 'due') list = list.slice().sort((a, b) => (a.item.due || '9999') .localeCompare(b.item.due || '9999') || a.no - b.no);

    const rows = list.map(x => {
      const it = x.item;
      const k = `act:${it.id}`;
      const doneNoDate = it.status === '已完成' && App.isEmpty(it.doneDate);
      return h('tr', { class: x.overdue === '逾期' ? 'row-overdue' : '' },
        h('td', { class: 'num' }, x.no),
        h('td', null, x.kind === 'hazop'
          ? h('div', { class: 'name-cell' }, h('a', { href: '#hazop', dataset: { key: k + ':src' }, onclick: e => { e.preventDefault(); App.gotoNode(x.node.id); } }, x.ref),
            h('small', { class: 'muted' }, x.node.name || ''))
          : App.field(it, 'source', { key: k + ':source', placeholder: '例：檢核表B-1', required: true, label: '來源', class: 'source-input' })),
        h('td', { class: 'txt wide' }, App.field(it, 'recommendation', { key: k + ':rec', multiline: true, required: true, label: '改善建議' })),
        x.kind === 'hazop' ? calc(levelBadge(x.level), 'center')
          : h('td', null, App.select(it, 'level', App.RISK_LEVELS, { key: k + ':level', colorize: true, label: '風險等級' })),
        h('td', null, App.field(it, 'owner', { key: k + ':owner', required: true, label: '負責單位／負責人', class: 'owner-input' })),
        h('td', null, App.field(it, 'due', { key: k + ':due', type: 'date', required: true, label: '預定完成日' })),
        h('td', null, App.field(it, 'doneDate', { key: k + ':done', type: 'date', label: '實際完成日' }), doneNoDate ? h('span', { class: 'badge warn' }, '請填實際完成日') : null),
        h('td', null, App.select(it, 'status', App.STATUS, { key: k + ':status', required: true, label: '辦理情形' })),
        calc(x.overdue ? h('span', { class: 'od od-' + x.overdue }, x.overdue) : '', 'center'),
        h('td', { class: 'txt' }, App.field(it, 'remark', { key: k + ':remark', multiline: true, label: '備註' })),
        h('td', null, x.kind === 'manual'
          ? h('button', { type: 'button', class: 'icon-btn danger', title: '刪除', 'aria-label': '刪除', dataset: { key: k + ':del' },
            onclick: () => { if (confirm('確定刪除這項改善建議？')) App.mutate(s => { s.actions = s.actions.filter(a => a !== it); }); } }, '✕')
          : h('span', { class: 'muted small', title: '來自 HAZOP，請在 HAZOP 工作表刪除或清空改善建議' }, 'HAZOP')));
    });

    return h('div', null,
      App.pageHeader('改善建議追蹤', 'HAZOP 工作表中有填改善建議的列會自動列入，與 HAZOP 是同一份資料，在這裡或 HAZOP 修改都會同步。檢核表或其他來源的建議可另外新增。逾期＝已過預定完成日且未填實際完成日。',
        h('button', { type: 'button', class: 'btn primary', dataset: { key: 'act:add' }, onclick: () => App.mutate(s => s.actions.push(App.newAction())) }, '＋ 新增其他改善建議')),
      h('div', { class: 'toolbar-row' },
        h('div', { class: 'seg', role: 'group', 'aria-label': '篩選' }, Object.entries(filters).map(([key, [label, fn]]) => h('button', {
          type: 'button', class: 'seg-btn' + (App.ui.actionFilter === key ? ' active' : ''), 'aria-pressed': App.ui.actionFilter === key ? 'true' : 'false', dataset: { key: 'act-filter:' + key },
          onclick: () => { App.ui.actionFilter = key; App.render(); } }, `${label} ${all.filter(fn).length}`))),
        h('label', { class: 'sort' }, '排序 ', h('select', { class: 'cell-select', dataset: { key: 'act-sort' }, onchange: e => { App.ui.actionSort = e.target.value; App.render(); } },
          [['order', '依來源順序'], ['risk', '風險高→低'], ['due', '預定日早→晚']].map(([v, l]) => h('option', { value: v, selected: App.ui.actionSort === v }, l)))),
        h('div', { class: 'summary-chips' },
          h('span', { class: 'chip r-ok' }, `已完成 ${sum.done}／${sum.total}`),
          h('span', { class: 'chip ' + (sum.overdue ? 'r-major' : 'r-ok') }, `逾期 ${sum.overdue}`),
          h('span', { class: 'chip ' + (sum.highOpen ? 'r-incomplete' : 'r-ok') }, `高風險未完成 ${sum.highOpen}`))),
      h('div', { class: 'table-wrap' }, h('table', { class: 'grid sheet actions' },
        h('thead', null, h('tr', null, ['項次', '來源', '改善建議', '風險等級', '負責單位／負責人', '預定完成日', '實際完成日', '辦理情形', '是否逾期', '備註', ''].map(t => h('th', null, t)))),
        h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: 11, class: 'empty' }, all.length ? '沒有符合篩選條件的項目' : '尚無改善建議。HAZOP 工作表填寫「改善建議」後會自動出現在這裡。'))))),
      h('p', { class: 'hint' }, `今天：${today}。`));
  };

  /* ---------------- 總覽：HAZOP 風險矩陣熱圖 ---------------- */
  App.riskHeatmap = function () {
    const p = App.state;
    const scored = p.deviations.filter(d => App.isNum(d.severity) && App.isNum(d.likelihood));
    const count = (s, l) => scored.filter(d => d.severity === s && d.likelihood === l).length;
    const sel = App.ui.matrixCell;
    const table = h('table', { class: 'matrix heat' },
      h('thead', null, h('tr', null, h('th', null, '可能性 ＼ 嚴重性'), App.SEVERITY.map(s => h('th', null, s)))),
      h('tbody', null, App.LIKELIHOOD.map((l, li) => h('tr', null, h('th', null, l), App.SEVERITY.map((_, si) => {
        const s = si + 1, lk = li + 1, n = count(s, lk);
        const active = sel && sel[0] === s && sel[1] === lk;
        return h('td', { class: 'v-' + App.riskLevel(s * lk) + (n ? ' has' : '') + (active ? ' sel' : '') },
          n ? h('button', { type: 'button', class: 'cell-btn', title: `嚴重性 ${s} × 可能性 ${lk}：${n} 個偏離`, dataset: { key: `heat:${s}:${lk}` },
            onclick: () => { App.ui.matrixCell = active ? null : [s, lk]; App.render(); } }, n) : h('span', { class: 'zero' }, s * lk));
      })))));
    const list = sel ? scored.filter(d => d.severity === sel[0] && d.likelihood === sel[1]) : [];
    return h('div', null, table,
      sel ? h('div', { class: 'heat-list' },
        h('div', { class: 'heat-list-title' }, `嚴重性 ${sel[0]} × 可能性 ${sel[1]}（${list.length}）`),
        h('ul', null, list.map(d => h('li', null,
          h('a', { href: '#hazop', onclick: e => { e.preventDefault(); App.gotoNode(d.nodeId); } }, App.deviationRef(p, d)),
          ' ', d.deviation || '未填偏離', d.cause ? '：' + d.cause : '')))) : h('p', { class: 'hint' }, scored.length ? '數字為該格的偏離數，點一下可列出明細。' : '尚無已評分的偏離。'));
  };
})();
