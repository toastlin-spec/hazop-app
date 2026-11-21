/* 區域物質存量、系統作用危害分析（重大潛在危害區域判定） */
(function () {
  const h = App.h;
  const pct = v => (v * 100).toFixed(1) + '%';
  const REACTIONS = ['氧化', '硝化', '鹵化', '有機金屬化', '偶氮化', '氫化', '裂解/熱分解', '聚合', '磺化', '縮合', '其他'];
  const YN = ['是', '否'];

  function addAreaBtn(key) {
    return h('button', { type: 'button', class: 'btn primary', dataset: { key },
      onclick: () => App.mutate(s => s.areas.push(App.newArea())) }, '＋ 新增製程區域');
  }
  function deleteArea(i) {
    const p = App.state, a = p.areas[i];
    const n = p.inventory.filter(r => r.areaId === a.id).length;
    const msg = `確定刪除區域「${a.name || '未命名'}」？` + (n ? `\n此區域的 ${n} 筆物質存量會一併刪除。` : '') + '\n（可用「復原」救回）';
    if (confirm(msg)) App.mutate(s => { s.areas.splice(i, 1); s.inventory = s.inventory.filter(r => r.areaId !== a.id); });
  }
  function areaActions(i, key) {
    const list = App.state.areas;
    const move = d => App.mutate(() => { const [it] = list.splice(i, 1); list.splice(i + d, 0, it); });
    return h('div', { class: 'row-actions' },
      h('button', { type: 'button', class: 'icon-btn', title: '上移', 'aria-label': '上移', disabled: i === 0, onclick: () => move(-1), dataset: { key: key + ':up' } }, '↑'),
      h('button', { type: 'button', class: 'icon-btn', title: '下移', 'aria-label': '下移', disabled: i === list.length - 1, onclick: () => move(1), dataset: { key: key + ':down' } }, '↓'),
      h('button', { type: 'button', class: 'icon-btn danger', title: '刪除區域', 'aria-label': '刪除區域', onclick: () => deleteArea(i), dataset: { key: key + ':del' } }, '✕'));
  }
  const dupNames = () => {
    const seen = {}, dup = new Set();
    App.state.areas.forEach(a => { const n = (a.name || '').trim(); if (n) { if (seen[n]) dup.add(n); seen[n] = 1; } });
    return dup;
  };
  function nodeLink(a, result) {
    const nodes = App.state.nodes.filter(n => n.areaId === a.id);
    if (nodes.length) return h('a', { href: '#hazop', class: 'small-link', dataset: { key: `area:${a.id}:goto-node` }, onclick: e => { e.preventDefault(); App.gotoNode(nodes[0].id); } }, `HAZOP 節點 ${nodes.length} 個 →`);
    if (result !== '重大潛在危害') return null;
    return h('button', { type: 'button', class: 'link-btn', dataset: { key: `area:${a.id}:make-node` }, onclick: () => App.createNodeFromArea(a) }, '＋ 建立 HAZOP 節點');
  }
  const resultBadge = r => h('span', { class: 'result ' + (r === '重大潛在危害' ? 'r-major' : r === '資料不完整' ? 'r-incomplete' : 'r-ok') }, r);
  const calc = (content, cls) => h('td', { class: 'calc ' + (cls || '') }, content);
  const ynCalc = v => calc(v ? h('span', { class: 'yn yn-' + v }, v) : '', 'center');

  /* ---------------- 區域物質存量 ---------------- */
  App.views.inventory = function () {
    const p = App.state;
    const names = [...new Set([...App.TQ_TABLE.map(t => t.zh), ...p.customTQ.map(t => t.zh).filter(Boolean), ...p.chemicals.map(c => c.name).filter(Boolean)])];
    const areaIds = new Set(p.areas.map(a => a.id));
    const orphans = p.inventory.filter(r => !areaIds.has(r.areaId));

    const cards = p.areas.map((a, ai) => {
      const res = App.calcArea(a, p);
      const rows = p.inventory.filter(r => r.areaId === a.id);
      return h('section', { class: 'card area-card' },
        h('div', { class: 'area-head' },
          h('span', { class: 'area-no' }, ai + 1),
          App.field(a, 'name', { key: `inv-area:${a.id}:name`, required: true, placeholder: '區域名稱，例：反應區 R-201', label: '區域名稱', class: 'area-name' }),
          h('div', { class: 'area-sum' },
            h('span', null, 'Q＝', h('b', null, App.fmtNum(res.Q)), ' kg'),
            h('span', null, 'Σq／TQ＝', h('b', null, pct(res.sum))),
            h('span', null, '最大單一＝', h('b', null, pct(res.max))),
            h('span', null, '① ', res.c1 === '是' ? App.badge('Q＞' + pct(p.settings.qtq).replace('.0', '') + ' TQ', 'bad') : App.badge(res.c1, res.c1 === '否' ? 'ok' : '')))),
        h('div', { class: 'table-wrap flat' }, h('table', { class: 'grid inv' },
          h('thead', null, h('tr', null, ['物質名稱', '設備／位置', '最大存量 q (kg)', '濃度 (%)', '純物質量 (kg)', '附表類別', 'TQ (kg)', 'q／TQ', '備註', ''].map(t => h('th', null, t)))),
          h('tbody', null, rows.length ? rows.map(r => invRow(r, p)) : h('tr', null, h('td', { colspan: 10, class: 'empty' }, '尚無物質存量'))))),
        h('div', { class: 'area-tools' },
          h('button', { type: 'button', class: 'btn', dataset: { key: `inv-add:${a.id}` },
            onclick: () => App.mutate(s => s.inventory.push(App.newInventory(a.id))) }, '＋ 新增物質'),
          p.chemicals.length ? h('select', { class: 'cell-select quick-add', 'aria-label': '從化學品清冊加入', dataset: { key: `inv-quick:${a.id}` },
            onchange: e => { const v = e.target.value; if (v) App.mutate(s => s.inventory.push(Object.assign(App.newInventory(a.id), { substance: v }))); } },
          h('option', { value: '' }, '從化學品清冊加入…'), p.chemicals.filter(c => c.name).map(c => h('option', { value: c.name }, c.name))) : null));
    });

    const orphanCard = orphans.length ? h('section', { class: 'card area-card' },
      h('h2', null, '未指定區域 ', App.badge(orphans.length + ' 筆', 'warn')),
      h('p', { class: 'hint' }, '這些存量沒有對應的區域，請選擇區域或刪除。不會計入任何區域的 Q。'),
      h('div', { class: 'table-wrap flat' }, h('table', { class: 'grid inv' },
        h('thead', null, h('tr', null, ['區域', '物質名稱', '最大存量 q (kg)', ''].map(t => h('th', null, t)))),
        h('tbody', null, orphans.map(r => h('tr', null,
          h('td', null, h('select', { class: 'cell-select need', 'aria-label': '指定區域', onchange: e => App.mutate(() => { r.areaId = e.target.value; }) },
            h('option', { value: '' }, '選擇區域…'), p.areas.map(a => h('option', { value: a.id }, a.name || '（未命名）')))),
          h('td', null, r.substance), h('td', { class: 'num' }, App.fmtNum(r.qKg)),
          h('td', null, h('button', { type: 'button', class: 'icon-btn danger', 'aria-label': '刪除', onclick: () => App.mutate(s => { s.inventory = s.inventory.filter(x => x !== r); }) }, '✕')))))))) : null;

    return h('div', null,
      App.pageHeader('區域物質存量', '逐區填入塔槽、管線中瞬間可能出現的最大存量。品名在勞動檢查法施行細則附表一／附表二內才計入 Q；濃度留白視為 100%，依濃度換算為純物質量。',
        addAreaBtn('inv:add-area')),
      h('datalist', { id: 'inv-names' }, names.map(n => h('option', { value: n }))),
      cards.length ? cards : h('section', { class: 'card' }, h('p', { class: 'empty-msg' }, '尚無製程區域。請先按「＋ 新增製程區域」，例如反應區、蒸餾區、萃取區、分離區。')),
      orphanCard);
  };

  function invRow(r, p) {
    const c = App.calcInventory(r, p);
    const k = `inv:${r.id}`;
    return h('tr', null,
      h('td', null, App.field(r, 'substance', { key: k + ':sub', required: true, list: 'inv-names', label: '物質名稱' })),
      h('td', null, App.field(r, 'location', { key: k + ':loc', placeholder: '例：R-201＋進料管線', label: '設備／位置' })),
      h('td', null, App.field(r, 'qKg', { key: k + ':q', type: 'number', class: 'num-input', required: true, label: '最大存量' })),
      h('td', null, App.field(r, 'conc', { key: k + ':conc', type: 'number', class: 'num-input', placeholder: '100', label: '濃度' })),
      calc(c.pure === null ? '' : App.fmtNum(c.pure), 'num-r'),
      calc(App.isEmpty(r.substance) ? '' : (c.tq ? h('span', { class: 'nowrap' }, c.tq.annex) : h('span', { class: 'non-annex' }, '非附表物質'))),
      calc(c.tq ? c.tq.tq.toLocaleString() : (App.isEmpty(r.substance) ? '' : '—'), 'num-r'),
      calc(c.ratio ? pct(c.ratio) : '', 'num-r'),
      h('td', null, App.field(r, 'remark', { key: k + ':remark', label: '備註' })),
      h('td', null, h('button', { type: 'button', class: 'icon-btn danger', title: '刪除', 'aria-label': '刪除', dataset: { key: k + ':del' },
        onclick: () => { if (confirm(`確定刪除「${r.substance || '此列'}」？`)) App.mutate(s => { s.inventory = s.inventory.filter(x => x.id !== r.id); }); } }, '✕')));
  }

  /* ---------------- 系統作用危害分析 ---------------- */
  App.views.areas = function () {
    const p = App.state, s = p.settings;
    const sum = App.areaSummary(p);
    const dup = dupNames();
    const heads = [
      ['項次', 'sticky-col1'], ['製程區域／系統單元', 'sticky-col2'], ['判定結果'], ['成立條件'], ['缺漏欄位'], ['Q (kg)\n附表物質純量'], ['Σ q／TQ'], ['最大單一\nq／TQ'], ['①\nQ＞TQ門檻'],
      ['②\n高放熱反應'], ['反應類型'], ['③\nLEL～UEL\n間或附近'], ['④\n熱不安定／\n與空氣、水反應'],
      ['T (°C)\n最大操作溫度'], ['A.I.T. (°C)\n自燃溫度'], ['易燃性\n氣體'], ['⑤\nT＞A.I.T.\n或易燃氣體'],
      ['P (kg/cm²G)\n最大操作壓力'], ['最低操作壓力\n(mmHg abs)\n非真空留白'], ['上游壓力\n(kg/cm²G)'], ['下游壓力\n(kg/cm²G)'], ['上游／下游\n壓力比'],
      ['備註'], [''],
    ];
    const rows = p.areas.map((a, i) => {
      const r = App.calcArea(a, p);
      const k = `area:${a.id}`;
      const name = (a.name || '').trim();
      return h('tr', { class: 'row-' + (r.result === '重大潛在危害' ? 'major' : r.result === '資料不完整' ? 'incomplete' : 'ok') },
        h('td', { class: 'num sticky-col1' }, i + 1),
        h('td', { class: 'sticky-col2' }, h('div', { class: 'name-cell' },
          App.field(a, 'name', { key: k + ':name', required: true, label: '區域名稱' }),
          dup.has(name) ? App.badge('名稱重複', 'warn') : null,
          h('a', { href: '#inventory', class: 'small-link' }, `存量 ${r.rows} 筆`))),
        calc(h('div', { class: 'result-cell' }, resultBadge(r.result), nodeLink(a, r.result))),
        calc(h('span', { class: 'triggers' }, r.triggers.map(t => h('span', { class: 'trig', title: App.CONDITIONS[t] }, t)))),
        calc(r.missing.length ? h('span', { class: 'missing' }, r.missing.join('、')) : ''),
        calc(App.fmtNum(r.Q), 'num-r'), calc(pct(r.sum), 'num-r'), calc(pct(r.max), 'num-r'), ynCalc(r.c1),
        h('td', null, App.select(a, 'exo', YN, { key: k + ':exo', required: true, label: '高放熱反應' })),
        h('td', null, App.field(a, 'reactionType', { key: k + ':rt', list: 'reaction-types', label: '反應類型' })),
        h('td', null, App.select(a, 'lel', YN, { key: k + ':lel', required: true, label: 'LEL～UEL' })),
        h('td', null, App.select(a, 'unstable', YN, { key: k + ':unstable', required: true, label: '熱不安定' })),
        h('td', null, App.field(a, 'T', { key: k + ':T', type: 'number', class: 'num-input', required: a.flammableGas !== '是', label: '最大操作溫度' })),
        h('td', null, App.field(a, 'AIT', { key: k + ':AIT', type: 'number', class: 'num-input', required: a.flammableGas !== '是', label: '自燃溫度' })),
        h('td', null, App.select(a, 'flammableGas', YN, { key: k + ':fg', required: true, label: '易燃性氣體' })),
        ynCalc(r.c5),
        h('td', null, App.field(a, 'P', { key: k + ':P', type: 'number', class: 'num-input', required: true, label: '最大操作壓力' })),
        h('td', null, App.field(a, 'vacuum', { key: k + ':vac', type: 'number', class: 'num-input', label: '最低操作壓力' })),
        h('td', null, App.field(a, 'pUp', { key: k + ':up', type: 'number', class: 'num-input', required: true, label: '上游壓力' })),
        h('td', null, App.field(a, 'pDown', { key: k + ':down', type: 'number', class: 'num-input', required: true, label: '下游壓力' })),
        calc(r.ratioDP === null ? '' : r.ratioDP === Infinity ? '∞' : r.ratioDP.toFixed(2), 'num-r'),
        h('td', null, App.field(a, 'remark', { key: k + ':remark', multiline: true, label: '備註' })),
        h('td', null, areaActions(i, k)));
    });

    const adj = s.dpBasis === 'absolute' ? '（絕對壓）' : '（錶壓）';
    const legend = [
      ['①', `Q＞${pct(s.qtq).replace('.0', '')} TQ（多物質：${s.multiMode === 'max' ? '單一最大' : '加總 Σqᵢ／TQᵢ'}；非附表物質不計）`],
      ['②', '高放熱反應：氧化、硝化、鹵化、有機金屬化、偶氮化、氫化、裂解/熱分解、聚合、磺化、縮合反應等'],
      ['③', '製程中之組成在爆炸下限（LEL）以上，爆炸上限（UEL）以下，或濃度在此範圍附近者'],
      ['④', `具有在 100℃以下熱不安定性，或與空氣、水、其他可能污染物接觸後起反應之物質，且 P≧${s.unstablePsig} psig（${(s.unstablePsig * App.PSI_TO_KGCM2).toFixed(3)} kg/cm²）`],
      ['⑤', 'T＞A.I.T. 或為易燃性氣體'],
      ['⑥', `P≧${s.pHigh} kg/cm² 或 最低操作壓力≦${s.vacuum} mmHg（絕對壓）`],
      ['⑦', `上游壓力≧${s.dpFactor}×下游壓力${adj}`],
    ];
    return h('div', null,
      App.pageHeader('系統作用危害分析', '符合①～⑦任一條件即列為重大潛在危害區域。Q 由「區域物質存量」自動彙算；壓力一律填錶壓。判定規則與 Excel 範本 v2 相同。',
        h('div', { class: 'summary-chips' },
          h('span', { class: 'chip r-major' }, `重大潛在危害 ${sum.major}`),
          h('span', { class: 'chip r-incomplete' }, `資料不完整 ${sum.incomplete}`),
          h('span', { class: 'chip r-ok' }, `非重大 ${sum.ok}`)),
        addAreaBtn('area:add')),
      h('datalist', { id: 'reaction-types' }, REACTIONS.map(r => h('option', { value: r }))),
      h('div', { class: 'table-wrap' }, h('table', { class: 'grid sheet areas' },
        h('thead', null, h('tr', null, heads.map(([t, cls]) => h('th', { class: (cls || '') + ' ml' }, t)))),
        h('tbody', null, rows.length ? rows : h('tr', null, h('td', { colspan: heads.length, class: 'empty' }, '尚無製程區域，請按「＋ 新增製程區域」'))))),
      h('section', { class: 'card cond-legend' },
        h('h2', null, '判定條件（依「判定設定」）'),
        h('ul', null, legend.map(([n, t]) => h('li', null, h('b', null, n), ' ', t))),
        h('p', { class: 'hint' }, '原文：高雄市《第三章 製程安全評估報告書》第 3-5 頁。判定結果：有條件成立 → 重大潛在危害；無條件成立但有欄位未填 → 資料不完整；全部填妥且皆未成立 → —。')));
  };
})();
