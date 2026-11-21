/* 匯出／匯入 Excel 畫面 */
(function () {
  const h = App.h;
  App.ui = App.ui || {};

  App.views.export = function () {
    const p = App.state;
    const sum = App.areaSummary(p);
    const acts = App.actionList(p);
    const sheets = [
      ['使用說明', '專案資訊、HAZOP 小組、事前資料、圖例與注意事項'],
      ['判定設定', '所有門檻；修改後各表公式自動套用'],
      ['檢核表 A／B／C', `${p.chemicals.length} 種化學品、${p.compat.length} 組相容性配對；註解自動編號`],
      ['區域物質存量', `${p.inventory.length} 筆；純物質量、TQ、q／TQ 為公式`],
      ['系統作用危害分析', `${sum.total} 區（重大 ${sum.major}、資料不完整 ${sum.incomplete}）；①～⑦判定為公式`],
      ['HAZOP-N1、N2…', `${p.nodes.length} 個節點各一張（表 3.2.3-2 格式，各有表頭）、${p.deviations.length} 列偏離`],
      ['改善建議彙整', `${acts.length} 項；HAZOP 來源以公式連到 HAZOP 工作表，逾期為公式`],
      ['引導字對照表、TQ法定限量表', '參考資料；風險矩陣顏色依判定設定'],
    ];
    const rep = App.lastImport;
    return h('div', null,
      App.pageHeader('匯出／匯入 Excel', '匯出的 Excel 與「製程安全評估範本_HAZOP_v2.xlsx」相同版面，保留公式、下拉選單與顏色；在 Excel 裡繼續修改，結果仍會自動計算。'),
      h('div', { class: 'two-col' },
        h('section', { class: 'card' },
          h('h2', null, '匯出 Excel'),
          h('table', { class: 'grid compact' },
            h('thead', null, h('tr', null, h('th', null, '工作表'), h('th', null, '內容'))),
            h('tbody', null, sheets.map(([a, b]) => h('tr', null, h('td', null, a), h('td', null, b))))),
          h('p', { class: 'hint' }, '列數依資料自動延伸，並保留空白黃底列可在 Excel 續填（檢核表 20 列、存量 60 列、區域 20 列、每節點 30 列）。灰底範例列不會匯出。'),
          h('button', { type: 'button', class: 'btn primary big', dataset: { key: 'io:export' }, onclick: () => App.exportXlsx() }, '⬇ 匯出 Excel…')),
        h('section', { class: 'card' },
          h('h2', null, '從 Excel 匯入'),
          h('p', { class: 'hint' }, '可匯入：原始範本（v1）、修正版範本 v2、本 App 匯出的檔案。匯入會建立新專案並取代目前內容（可先「儲存」目前專案）。'),
          h('ul', { class: 'io-notes' },
            h('li', null, '檢核表 A、C 同名的化學品會合併為同一筆；「註1、註2…」對應到下方註解區的說明。'),
            h('li', null, 'HAZOP 依「節點」欄分成不同節點；改善建議彙整中來源為 HAZOP 的項目會併回對應的列。'),
            h('li', null, '原始範本的 Q／TQ 是直接填數字，App 改由區域物質存量計算，原值會記在區域備註，請補填存量。')),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!App.ui.includeExamples, dataset: { key: 'io:examples' },
            onchange: e => { App.ui.includeExamples = e.target.checked; } }), '也匯入灰底範例列（虛構教學數據，通常不需要）'),
          h('button', { type: 'button', class: 'btn primary big', dataset: { key: 'io:import' }, onclick: () => App.importXlsx({ includeExamples: !!App.ui.includeExamples }) }, '⬆ 從 Excel 匯入…'),
          rep ? h('div', { class: 'import-report' },
            h('b', null, `上次匯入：${rep.file}（${rep.at}）`),
            h('ul', null, rep.report.map(t => h('li', { class: t.startsWith('⚠') ? 'warn' : '' }, t)))) : null)));
  };
})();
