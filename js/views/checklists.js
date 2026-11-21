/* 檢核表 A（物質危害）、B（物質相容性）、C（處理方法） */
(function () {
  const h = App.h;

  /* 註解編號：依列順序，有填註解的列自動編為 註1、註2… */
  function noteNumbers(rows, key) {
    const map = {}; let n = 0;
    rows.forEach(r => { if (!App.isEmpty((r[key] || '').trim())) map[r.id] = '註' + (++n); });
    return map;
  }
  function noteCell(row, key, num, k) {
    return h('div', { class: 'note-cell' },
      num ? h('span', { class: 'note-no' }, num) : null,
      App.field(row, key, { key: k, multiline: true, placeholder: '補充說明（自動編註解號）', label: '註解' }));
  }
  function tqBadge(name) {
    const t = App.lookupTQ(name, App.state);
    if (!t) return null;
    return h('span', { class: 'badge info', title: `${t.annex}，法定限量 ${t.tq.toLocaleString()} kg` }, `${t.annex.slice(0, 3)} TQ ${t.tq.toLocaleString()}`);
  }
  function addChemicalBtn(view) {
    return h('button', { type: 'button', class: 'btn primary', dataset: { key: view + ':add' },
      onclick: () => App.mutate(s => s.chemicals.push(App.newChemical())) }, '＋ 新增化學品');
  }
  function deleteChemical(list, i) {
    const c = list[i];
    const hasC = App.C_ITEMS.some(([k]) => !App.isEmpty(c.c[k])) || !App.isEmpty(c.cPotential);
    const hasA = App.A_TOGGLES.some(k => !App.isEmpty(c.a[k])) || !App.isEmpty(c.aPotential);
    const msg = `確定刪除化學品「${c.name || '未命名'}」？` + (hasA && hasC ? '\n此化學品在檢核表 A 和 C 都有資料，會一併刪除。' : '') + '\n（可用「復原」救回）';
    if (confirm(msg)) App.mutate(() => list.splice(i, 1));
  }
  function chemActions(list, i, view) {
    const move = d => App.mutate(() => { const [it] = list.splice(i, 1); list.splice(i + d, 0, it); });
    const id = list[i].id;
    return h('div', { class: 'row-actions' },
      h('button', { type: 'button', class: 'icon-btn', title: '上移', 'aria-label': '上移', disabled: i === 0, onclick: () => move(-1), dataset: { key: `${view}:${id}:up` } }, '↑'),
      h('button', { type: 'button', class: 'icon-btn', title: '下移', 'aria-label': '下移', disabled: i === list.length - 1, onclick: () => move(1), dataset: { key: `${view}:${id}:down` } }, '↓'),
      h('button', { type: 'button', class: 'icon-btn danger', title: '刪除', 'aria-label': '刪除', onclick: () => deleteChemical(list, i) }, '✕'));
  }
  const tqList = () => h('datalist', { id: 'tq-names' }, App.TQ_TABLE.map(t => h('option', { value: t.zh })));

  /* ---------------- 檢核表 A ---------------- */
  App.views.checklistA = function () {
    const p = App.state;
    const notes = noteNumbers(p.chemicals, 'aNote');
    const st = App.stats().a;

    const head1 = h('tr', null,
      // 左側凍結欄的表頭不跨列（Chrome 對跨列的凍結格背景只畫一半），改為上下各一格
      h('th', { class: 'sticky-col1 head-top' }), h('th', { class: 'sticky-col2 head-top' }),
      h('th', { rowspan: 2 }, '狀態'),
      h('th', { colspan: 2 }, '總量'),
      App.A_GROUPS.map(g => h('th', { colspan: g.items.length, rowspan: g.select ? 2 : 1, class: 'grp' }, g.label)),
      h('th', { rowspan: 2 }, '危害之潛在性'), h('th', { rowspan: 2 }, '註解'), h('th', { rowspan: 2 }, ''));
    const head2 = h('tr', null, h('th', { class: 'sticky-col1 head-bottom' }, '項次'), h('th', { class: 'sticky-col2 head-bottom' }, '品名'),
      h('th', null, '庫存量 (kg)'), h('th', null, '生產量 (kg)'),
      App.A_GROUPS.filter(g => !g.select).map(g => g.items.map(([, l]) => h('th', { class: 'vert' }, l))));

    const rows = p.chemicals.map((c, i) => {
      const k = `A:${c.id}`;
      const groupCells = App.A_GROUPS.map(g => g.select
        ? h('td', null, App.select(c.a, 'reactivity', App.REACTIVITY, { key: k + ':reactivity', required: true, label: '反應性／安定性' }))
        : g.items.map(([key, label]) => h('td', { class: 'tog-cell' }, App.toggle(c.a, key, ['有', '無'], { key: `${k}:${key}`, label, tone: 'hazard' }))));
      const blanks = App.A_TOGGLES.filter(key => App.isEmpty(c.a[key])).length;
      return h('tr', null,
        h('td', { class: 'num sticky-col1' }, i + 1),
        h('td', { class: 'sticky-col2' }, h('div', { class: 'name-cell' },
          App.field(c, 'name', { key: k + ':name', required: true, list: 'tq-names', label: '品名' }), tqBadge(c.name))),
        h('td', null, App.select(c, 'state', App.STATES, { key: k + ':state', required: true, label: '狀態' })),
        h('td', null, App.field(c, 'stockKg', { key: k + ':stock', type: 'number', class: 'num-input', label: '庫存量' })),
        h('td', null, App.field(c, 'productionKg', { key: k + ':prod', type: 'number', class: 'num-input', label: '生產量' })),
        groupCells,
        h('td', null, App.select(c, 'aPotential', App.POTENTIAL, { key: k + ':pot', required: true, colorize: true, label: '危害之潛在性' })),
        h('td', { class: 'note-td' }, noteCell(c, 'aNote', notes[c.id], k + ':note')),
        h('td', null, h('div', { class: 'row-tools' },
          chemActions(p.chemicals, i, 'A'),
          blanks ? h('button', { type: 'button', class: 'link-btn', title: '把此列尚未填的危害欄位設為「無」', dataset: { key: k + ':fillno' },
            onclick: () => App.mutate(() => App.A_TOGGLES.forEach(key => { if (App.isEmpty(c.a[key])) c.a[key] = '無'; })) }, `空白設為無（${blanks}）`) : null)));
    });

    return h('div', null,
      App.pageHeader('檢核表 A：物質危害', '檢討化學物質的易燃性、安定性、毒性及健康危害。危害欄點一下切換「有／無」；化學品清冊與檢核表 C 共用，品名只需輸入一次。',
        App.progress(st.done, st.total), addChemicalBtn('A')),
      tqList(),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'grid sheet' }, h('thead', null, head1, head2),
          h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: 22, class: 'empty' }, '尚無化學品，請按「＋ 新增化學品」'))))),
      legend());
  };

  /* ---------------- 檢核表 B ---------------- */
  App.views.checklistB = function () {
    const p = App.state;
    const notes = noteNumbers(p.compat, 'note');
    const st = App.stats().b;
    const names = [...new Set([...p.chemicals.map(c => c.name).filter(Boolean), ...App.MATERIALS])];
    const rows = p.compat.map((r, i) => {
      const k = `B:${r.id}`;
      return h('tr', null,
        h('td', { class: 'num' }, i + 1),
        h('td', null, App.field(r, 'sub1', { key: k + ':sub1', required: true, list: 'compat-names', label: '物質一' })),
        h('td', null, App.field(r, 'sub2', { key: k + ':sub2', required: true, list: 'compat-names', label: '物質二／結構材質' })),
        h('td', null, App.select(r, 'scenario', App.SCENARIOS, { key: k + ':scenario', required: true, label: '接觸情境' })),
        h('td', { class: 'wide' }, App.field(r, 'consequence', { key: k + ':cons', multiline: true, required: true, label: '可能反應／後果' })),
        h('td', null, App.select(r, 'potential', App.POTENTIAL, { key: k + ':pot', required: true, colorize: true, label: '危害之潛在性' })),
        h('td', { class: 'note-td' }, noteCell(r, 'note', notes[r.id], k + ':note')),
        h('td', null, App.field(r, 'remark', { key: k + ':remark', multiline: true, label: '備註' })),
        h('td', null, App.rowActions(p.compat, i, r.sub1 + ' × ' + r.sub2, k)));
    });
    return h('div', null,
      App.pageHeader('檢核表 B：物質相容性', '檢討化學品與化學品、化學品與設備結構材質之間，在製程中不正常接觸時是否會發生化學反應。物質欄可選清冊中的化學品或常見材質，也可自行輸入。',
        App.progress(st.done, st.total),
        h('button', { type: 'button', class: 'btn primary', dataset: { key: 'B:add' }, onclick: () => App.mutate(s => s.compat.push(App.newCompat())) }, '＋ 新增配對')),
      h('datalist', { id: 'compat-names' }, names.map(n => h('option', { value: n }))),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'grid sheet' },
          h('thead', null, h('tr', null, ['項次', '物質一', '物質二／結構材質', '接觸情境', '可能反應／後果', '危害之潛在性', '註解', '備註', ''].map(t => h('th', null, t)))),
          h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: 9, class: 'empty' }, '尚無相容性配對，請按「＋ 新增配對」'))))),
      legend());
  };

  /* ---------------- 檢核表 C ---------------- */
  App.views.checklistC = function () {
    const p = App.state;
    const notes = noteNumbers(p.chemicals, 'cNote');
    const st = App.stats().c;
    const rows = p.chemicals.map((c, i) => {
      const k = `C:${c.id}`;
      const autoTotal = [c.stockKg, c.productionKg].some(v => typeof v === 'number')
        ? (Number(c.stockKg) || 0) + (Number(c.productionKg) || 0) : null;
      return h('tr', null,
        h('td', { class: 'num sticky-col1' }, i + 1),
        h('td', { class: 'sticky-col2' }, App.field(c, 'name', { key: k + ':name', required: true, list: 'tq-names', label: '品名' })),
        h('td', null, App.select(c, 'state', App.STATES, { key: k + ':state', required: true, label: '狀態' })),
        h('td', null, App.field(c, 'cTotal', { key: k + ':total', class: 'total-input', placeholder: autoTotal !== null ? App.fmtNum(autoTotal) + ' kg' : '例：2,000 L', label: '總量' })),
        App.C_ITEMS.map(([key, label]) => h('td', { class: 'tog-cell' }, App.toggle(c.c, key, ['有', '無', '不適用'], { key: `${k}:${key}`, label, tone: 'need' }))),
        h('td', null, App.select(c, 'cPotential', App.POTENTIAL, { key: k + ':pot', required: true, colorize: true, label: '危害之潛在性' })),
        h('td', { class: 'note-td' }, noteCell(c, 'cNote', notes[c.id], k + ':note')),
        h('td', null, chemActions(p.chemicals, i, 'C')));
    });
    return h('div', null,
      App.pageHeader('檢核表 C：處理方法', '考慮化學物質危害對裝置／製程系統設計的可能需求。各欄點一下切換「有（有此需求／已設置）→ 無 → 不適用」。總量留白時，匯出時會用檢核表 A 的庫存量＋生產量。',
        App.progress(st.done, st.total), addChemicalBtn('C')),
      tqList(),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'grid sheet' },
          h('thead', null, h('tr', null,
            h('th', { class: 'sticky-col1' }, '項次'), h('th', { class: 'sticky-col2' }, '品名'), h('th', null, '狀態'), h('th', null, '總量'),
            App.C_ITEMS.map(([, l]) => h('th', { class: 'vert' }, l)),
            h('th', null, '危害之潛在性'), h('th', null, '註解'), h('th', null, ''))),
          h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: 16, class: 'empty' }, '尚無化學品，請按「＋ 新增化學品」'))))),
      legend());
  };

  function legend() {
    return h('div', { class: 'legend' },
      h('span', null, h('i', { class: 'sw need' }), '黃底：待填'),
      h('span', null, h('i', { class: 'sw calc' }), '淺藍：自動計算'),
      h('span', null, h('i', { class: 'sw v-重大' }), '重大'),
      h('span', null, h('i', { class: 'sw v-可能' }), '可能'),
      h('span', null, h('i', { class: 'sw v-無' }), '無'));
  }
})();
