/* 判定設定、參考資料、尚未開發的階段 */
(function () {
  const h = App.h;

  App.views.settings = function () {
    const s = App.state.settings;
    const num = (obj, key, k, label) => App.field(obj, key, { key: 'set:' + k, type: 'number', class: 'num-input', required: true, label });
    const row = (label, input, unit, basis) => h('tr', null, h('th', { scope: 'row' }, label), h('td', null, input), h('td', null, unit), h('td', { class: 'basis' }, basis));
    const pct = h('div', { class: 'inline' }, App.field({ get v() { return typeof s.qtq === 'number' ? Math.round(s.qtq * 1e6) / 1e4 : s.qtq; }, set v(x) { s.qtq = typeof x === 'number' ? x / 100 : x; } }, 'v',
      { key: 'set:qtq', type: 'number', class: 'num-input', label: 'Q／TQ 門檻' }), ' %');
    const radio = (key, opts) => h('div', { class: 'radios' }, opts.map(([v, l]) => h('label', null,
      h('input', { type: 'radio', name: key, value: v, checked: s[key] === v, dataset: { key: `set:${key}:${v}` },
        onchange: () => App.mutate(() => { s[key] = v; }) }), l)));

    const r = s.risk;
    const riskOk = Number(r.extreme) > Number(r.high) && Number(r.high) > Number(r.medium) && Number(r.medium) > 1;
    return h('div', null,
      App.pageHeader('判定設定', '所有判定門檻集中在此，與 Excel 範本 v2 的「判定設定」工作表相同。條件原文引自高雄市《第三章 製程安全評估報告書》第 3-5 頁。',
        h('button', { type: 'button', class: 'btn', dataset: { key: 'set:reset' },
          onclick: () => { if (confirm('將所有設定恢復為預設值？')) App.mutate(st => { st.settings = JSON.parse(JSON.stringify(App.DEFAULT_SETTINGS)); }); } }, '恢復預設值')),
      h('section', { class: 'card' },
        h('h2', null, '系統作用危害分析門檻'),
        h('table', { class: 'grid settings' },
          h('thead', null, h('tr', null, h('th', null, '項目'), h('th', null, '設定值'), h('th', null, '單位'), h('th', null, '依據／說明'))),
          h('tbody', null,
            row('① Q／TQ 門檻', pct, '比例', '原文「Q＞20% TQ」'),
            row('① 多物質計算方式', radio('multiMode', [['sum', '加總 Σ(qᵢ／TQᵢ)'], ['max', '單一最大']]), '',
              '原文未規定。2026-11-20 定案採「加總」（較保守）。'),
            row('④ 熱不安定物質壓力門檻', num(s, 'unstablePsig', 'psig', '熱不安定壓力門檻'), 'psig',
              `原文「…接觸後起反應之物質，P≧10psig」：物質條件與壓力需同時成立。換算 ${(Number(s.unstablePsig) * App.PSI_TO_KGCM2).toFixed(3)} kg/cm²。`),
            row('⑥ 高壓門檻', num(s, 'pHigh', 'phigh', '高壓門檻'), 'kg/cm²', '原文「P≧20 ㎏/㎝²」'),
            row('⑥ 真空門檻', num(s, 'vacuum', 'vac', '真空門檻'), 'mmHg（絕對壓）', '原文「P≦500 ㎜Hg」：最低操作壓力（絕對壓）≦500 即成立。'),
            row('⑦ 壓差倍數', num(s, 'dpFactor', 'dp', '壓差倍數'), '倍', '原文「(上游壓力)≧4(下游壓力)」'),
            row('⑦ 壓差計算基準', radio('dpBasis', [['gauge', '錶壓'], ['absolute', '絕對壓']]), '',
              '原文未指明。2026-11-20 定案採「錶壓」：直接以輸入值比較，下游為 0（常壓）時只要上游＞0 即成立。'),
            row('大氣壓', num(s, 'atm', 'atm', '大氣壓'), 'kg/cm²', '絕對壓換算用（1 atm＝1.0332 kg/cm²）')))),
      h('section', { class: 'card' },
        h('h2', null, 'HAZOP 風險分級 ', riskOk ? null : App.badge('門檻需由高到低遞減', 'bad')),
        h('p', { class: 'hint' }, '風險分數＝嚴重性 × 可能性（1～25）。分級為範本自訂，請依公司風險矩陣調整。'),
        h('table', { class: 'grid settings' },
          h('thead', null, h('tr', null, h('th', null, '等級'), h('th', null, '分數下限（≧）'), h('th', null, ''), h('th', null, '說明'))),
          h('tbody', null,
            row(h('span', { class: 'lvl v-極高' }, '極高'), num(r, 'extreme', 'r-ex', '極高下限'), '', ''),
            row(h('span', { class: 'lvl v-高' }, '高'), num(r, 'high', 'r-hi', '高下限'), '', ''),
            row(h('span', { class: 'lvl v-中' }, '中'), num(r, 'medium', 'r-md', '中下限'), '', '低於此值為「低」'))),
        riskMatrix()));
  };


  function riskMatrix() {
    return h('table', { class: 'matrix' },
      h('thead', null, h('tr', null, h('th', null, '可能性 ＼ 嚴重性'), App.SEVERITY.map(s => h('th', null, s)))),
      h('tbody', null, App.LIKELIHOOD.map((l, li) => h('tr', null, h('th', null, l),
        App.SEVERITY.map((_, si) => { const sc = (li + 1) * (si + 1); return h('td', { class: 'v-' + App.riskLevel(sc) }, sc); })))));
  }

  App.views.reference = function () {
    const p = App.state;
    const customRows = p.customTQ.map((t, i) => h('tr', null,
      h('td', null, '其他指定公告'),
      h('td', null, App.field(t, 'zh', { key: `ctq:${i}:zh`, required: true, label: '中文名稱' })),
      h('td', null, App.field(t, 'en', { key: `ctq:${i}:en`, label: '英文名稱' })),
      h('td', null, App.field(t, 'formula', { key: `ctq:${i}:f`, label: '化學式' })),
      h('td', null, App.field(t, 'tq', { key: `ctq:${i}:tq`, type: 'number', class: 'num-input', required: true, label: 'TQ' })),
      h('td', null, App.rowActions(p.customTQ, i, t.zh, `ctq:${i}`))));
    return h('div', null,
      App.pageHeader('參考資料', '引導字對照表（表 3.2.3-1）、5×5 風險矩陣、HAZOP 執行步驟、方法選用對照、TQ 法定限量表。'),
      h('section', { class: 'card' }, h('h2', null, '表 3.2.3-1 常用之製程偏離參數表'),
        h('p', { class: 'hint' }, '引導字 × 製程參數 → 製程偏離。「—」表示該組合一般不適用或無意義，請依實際製程判斷。'),
        h('div', { class: 'table-wrap' }, h('table', { class: 'grid ref' },
          h('thead', null, h('tr', null, h('th', null, '製程參數 ＼ 引導字'), App.GUIDE_WORDS.map(g => h('th', null, g)))),
          h('tbody', null, Object.entries(App.DEVIATIONS).map(([param, devs]) => h('tr', null, h('th', null, param),
            devs.map(d => h('td', { class: d === '—' ? 'na' : '' }, d)))))))),
      h('div', { class: 'two-col' },
        h('section', { class: 'card' }, h('h2', null, '5 × 5 風險矩陣'), h('p', { class: 'hint' }, '顏色依「判定設定」的風險分級門檻。'), riskMatrix()),
        h('section', { class: 'card' }, h('h2', null, 'HAZOP 執行步驟（報告書 3.2.3 節）'), h('ol', { class: 'steps' }, App.HAZOP_STEPS.map(s => h('li', null, s))))),
      h('section', { class: 'card' }, h('h2', null, '製程安全評估方法選用對照（報告書 3.2.2 節摘要）'),
        h('div', { class: 'table-wrap' }, h('table', { class: 'grid ref' },
          h('thead', null, h('tr', null, ['方法', '建議使用時機', '優點摘要', '缺點摘要'].map(t => h('th', null, t)))),
          h('tbody', null, App.METHODS.map(m => h('tr', null, m.map((c, i) => i ? h('td', null, c) : h('th', null, c)))))))),
      h('section', { class: 'card' }, h('h2', null, 'TQ 法定限量表'),
        h('p', { class: 'hint' }, '勞動檢查法施行細則附表一（危險物）、附表二（有害物），112-12-07 修正版。甲醇、甲苯等未列入的物質無法定限量，不列入 Q／TQ 計算。附表「其他中央主管機關指定公告者」請加在最下方。'),
        h('div', { class: 'table-wrap' }, h('table', { class: 'grid ref' },
          h('thead', null, h('tr', null, ['附表', '中文名稱', '英文名稱', '化學式', 'TQ (kg)', ''].map(t => h('th', null, t)))),
          h('tbody', null,
            App.TQ_TABLE.map(t => h('tr', null, h('td', null, t.annex), h('td', null, t.zh), h('td', null, t.en), h('td', null, t.formula), h('td', { class: 'num' }, t.tq.toLocaleString()), h('td', null))),
            customRows))),
        h('button', { type: 'button', class: 'btn', dataset: { key: 'ctq:add' },
          onclick: () => App.mutate(s => s.customTQ.push({ zh: '', en: '', formula: '', tq: '' })) }, '＋ 新增指定公告物質')));
  };

  /* 後續階段的預留頁 */
  const upcoming = (title, phase, items) => () => h('div', null,
    App.pageHeader(title, ''),
    h('section', { class: 'card placeholder' },
      h('h2', null, `${phase}開發`),
      h('ul', null, items.map(i => h('li', null, i)))));
  App.upcoming = {
  };
})();
