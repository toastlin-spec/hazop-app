/* 專案總覽：基本資料、HAZOP 小組、事前資料、各表完成度 */
(function () {
  const h = App.h;

  App.views.overview = function () {
    const p = App.state;
    const m = p.meta;
    const st = App.stats();

    const metaForm = h('section', { class: 'card' },
      h('h2', null, '專案基本資料'),
      h('div', { class: 'form-grid' },
        formRow('場所', App.field(m, 'site', { key: 'meta:site', required: true, placeholder: '例：○○化工 第一廠區', label: '場所' })),
        formRow('製程／操作程序名稱', App.field(m, 'process', { key: 'meta:process', placeholder: '例：聚合製程', label: '製程名稱' })),
        formRow('評估日期', App.field(m, 'date', { key: 'meta:date', type: 'date', label: '評估日期' })),
        formRow('填表人', App.field(m, 'author', { key: 'meta:author', required: true, label: '填表人' })),
        formRow('備註', App.field(m, 'remark', { key: 'meta:remark', multiline: true, label: '備註' }))));

    const progress = h('section', { class: 'card' },
      h('h2', null, '評估流程與完成度'),
      h('ol', { class: 'flow' },
        flowItem('1', '檢核表 A：物質危害', 'checklistA', st.a),
        flowItem('2', '檢核表 B：物質相容性', 'checklistB', st.b),
        flowItem('3', '檢核表 C：處理方法', 'checklistC', st.c),
        flowItem('4', '區域物質存量', 'inventory', st.inv),
        flowItem('5', '系統作用危害分析', 'areas', null, null, areaChips()),
        flowItem('6', 'HAZOP 工作表', 'hazop', null, null, h('span', { class: 'phase' }, `${p.nodes.length} 個節點 · ${p.deviations.length} 列偏離`)),
        flowItem('7', '改善建議追蹤', 'actions', null, null, actionChips()),
        flowItem('8', '匯出 Excel 報告', 'export', null, '範本 v2 版面，含公式')));

    const teamRows = p.team.map((t, i) => h('tr', null,
      h('td', { class: 'num' }, i + 1),
      h('td', null, App.field(t, 'name', { key: `team:${t.id}:name`, required: true, label: '姓名' })),
      h('td', null, App.select(t, 'role', App.TEAM_ROLES, { key: `team:${t.id}:role`, label: '職責' })),
      h('td', null, App.field(t, 'unit', { key: `team:${t.id}:unit`, label: '單位' })),
      h('td', null, App.rowActions(p.team, i, t.name, `team:${t.id}`))));
    const team = h('section', { class: 'card' },
      h('h2', null, 'HAZOP 小組 ', App.badge(`${p.team.length} 人`, p.team.length >= 5 && p.team.length <= 7 ? 'ok' : 'warn')),
      h('p', { class: 'hint' }, '建議 5～7 人：設計及方法工程師、現場操作工程師、維修工程師、儀表工程師、機械工程師、工安人員、工作小組長及技術秘書；情況許可應邀請製程設計單位派員參與。'),
      h('table', { class: 'grid compact' },
        h('thead', null, h('tr', null, h('th', null, '項次'), h('th', null, '姓名'), h('th', null, '職責'), h('th', null, '單位'), h('th', null, ''))),
        h('tbody', null, teamRows.length ? teamRows : h('tr', null, h('td', { colspan: 5, class: 'empty' }, '尚未加入成員')))),
      h('button', { type: 'button', class: 'btn', dataset: { key: 'team:add' },
        onclick: () => App.mutate(s => s.team.push({ id: App.uid(), name: '', role: '', unit: '' })) }, '＋ 新增成員'));

    const readyCount = p.preDocs.filter(d => d.ready).length;
    const docs = h('section', { class: 'card' },
      h('h2', null, 'HAZOP 事前資料 ', App.badge(`${readyCount}／${p.preDocs.length} 已備妥`, readyCount === p.preDocs.length ? 'ok' : 'warn')),
      h('table', { class: 'grid compact' },
        h('thead', null, h('tr', null, h('th', null, '已備妥'), h('th', null, '資料'), h('th', null, '版本／備註'))),
        h('tbody', null, p.preDocs.map((d, i) => h('tr', null,
          h('td', { class: 'center' }, h('input', { type: 'checkbox', checked: d.ready, 'aria-label': d.name, dataset: { key: `doc:${i}` },
            onchange: e => App.mutate(() => { d.ready = e.target.checked; }) })),
          h('td', null, d.name),
          h('td', null, App.field(d, 'note', { key: `doc:${i}:note`, placeholder: '例：Rev.3 2026-10', label: d.name + ' 備註' })))))));

    return h('div', null,
      App.pageHeader('專案總覽', '危險性工作場所製程安全評估：初步危害分析（檢核表 A／B／C、系統作用危害分析）× HAZOP。'),
      h('div', { class: 'two-col' }, metaForm, progress),
      h('div', { class: 'two-col' },
        h('section', { class: 'card' }, h('h2', null, 'HAZOP 風險矩陣 ', App.badge(`${p.deviations.filter(d => App.isNum(d.severity) && App.isNum(d.likelihood)).length} 列已評分`)), App.riskHeatmap()),
        h('section', { class: 'card' }, h('h2', null, '改善建議狀況'), actionPanel())),
      h('div', { class: 'two-col' }, team, docs));
  };

  function actionPanel() {
    const p = App.state, t = App.today();
    const s = App.actionSummary(p, t);
    const list = App.actionList(p, t);
    const lv = ['極高', '高', '中', '低'].map(l => [l, list.filter(x => x.level === l).length, list.filter(x => x.level === l && x.item.status !== '已完成' && App.isEmpty(x.item.doneDate)).length]);
    const overdue = list.filter(x => x.overdue === '逾期');
    return h('div', null,
      h('div', { class: 'stat-row' },
        stat('改善建議', s.total), stat('已完成', s.done), stat('未完成', s.open), stat('逾期', s.overdue, s.overdue ? 'bad' : '')),
      h('table', { class: 'grid compact' },
        h('thead', null, h('tr', null, h('th', null, '風險等級'), h('th', null, '件數'), h('th', null, '未完成'))),
        h('tbody', null, lv.map(([l, n, o]) => h('tr', null, h('td', null, h('span', { class: 'lvl v-' + l }, l)), h('td', { class: 'center' }, n), h('td', { class: 'center' }, o))))),
      overdue.length ? h('div', { class: 'overdue-box' }, h('b', null, '逾期項目'),
        h('ul', null, overdue.map(x => h('li', null, h('a', { href: '#actions' }, x.ref), `　${x.item.recommendation}（預定 ${x.item.due}，${x.item.owner || '未指定負責人'}）`)))) : null);
  }
  function stat(label, n, tone) {
    return h('div', { class: 'stat ' + (tone || '') }, h('div', { class: 'stat-n' }, n), h('div', { class: 'stat-l' }, label));
  }
  function formRow(label, input) {
    return h('label', { class: 'form-row' }, h('span', null, label), input);
  }
  function actionChips() {
    const s = App.actionSummary(App.state);
    if (!s.total) return h('span', { class: 'phase' }, '尚無改善建議');
    return h('span', { class: 'summary-chips small' },
      h('span', { class: 'chip r-ok' }, `完成 ${s.done}／${s.total}`), s.overdue ? h('span', { class: 'chip r-major' }, `逾期 ${s.overdue}`) : null,
      s.highOpen ? h('span', { class: 'chip r-incomplete' }, `高風險未完成 ${s.highOpen}`) : null);
  }
  function areaChips() {
    const s = App.areaSummary(App.state);
    if (!s.total) return h('span', { class: 'phase' }, '尚無區域');
    return h('span', { class: 'summary-chips small' },
      h('span', { class: 'chip r-major' }, `重大 ${s.major}`), h('span', { class: 'chip r-incomplete' }, `缺資料 ${s.incomplete}`), h('span', { class: 'chip r-ok' }, `非重大 ${s.ok}`));
  }
  function flowItem(no, label, view, stat, phase, extra) {
    const avail = !!App.views[view];
    return h('li', { class: avail ? '' : 'disabled' },
      h('span', { class: 'step' }, no),
      avail ? h('a', { href: '#' + view }, label) : h('span', null, label),
      extra || (stat ? App.progress(stat.done, stat.total) : h('span', { class: 'phase' }, phase)));
  }

  /* 各檢核表完成度：計算應填欄位 */
  App.stats = function () {
    const p = App.state;
    let aDone = 0, aTotal = 0, cDone = 0, cTotal = 0, bDone = 0, bTotal = 0;
    for (const c of p.chemicals) {
      const aFields = [c.name, c.state, c.a.reactivity, c.aPotential, ...App.A_TOGGLES.map(k => c.a[k])];
      aTotal += aFields.length; aDone += aFields.filter(v => !App.isEmpty(v)).length;
      const cFields = [c.name, c.state, c.cPotential, ...App.C_ITEMS.map(([k]) => c.c[k])];
      cTotal += cFields.length; cDone += cFields.filter(v => !App.isEmpty(v)).length;
    }
    for (const r of p.compat) {
      const f = [r.sub1, r.sub2, r.scenario, r.consequence, r.potential];
      bTotal += f.length; bDone += f.filter(v => !App.isEmpty(v)).length;
    }
    let iDone = 0, iTotal = 0;
    for (const r of p.inventory) { const f = [r.substance, r.qKg]; iTotal += f.length; iDone += f.filter(v => !App.isEmpty(v)).length; }
    return { a: { done: aDone, total: aTotal }, b: { done: bDone, total: bTotal }, c: { done: cDone, total: cTotal }, inv: { done: iDone, total: iTotal } };
  };
})();
