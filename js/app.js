/* 主程式：導覽、繪製、快捷鍵 */
(function () {
  const h = App.h;
  App.views = App.views || {};

  const NAV = [
    { group: '專案', items: [['overview', '專案總覽']] },
    { group: '初步危害分析', items: [['checklistA', '檢核表 A　物質危害'], ['checklistB', '檢核表 B　物質相容性'], ['checklistC', '檢核表 C　處理方法'], ['inventory', '區域物質存量'], ['areas', '系統作用判定']] },
    { group: 'HAZOP', items: [['hazop', 'HAZOP 工作表'], ['actions', '改善建議追蹤']] },
    { group: '輸出與設定', items: [['export', '匯出／匯入 Excel'], ['settings', '判定設定'], ['reference', '參考資料']] },
  ];

  function currentView() {
    const v = location.hash.slice(1);
    return (App.views[v] || App.upcoming[v]) ? v : 'overview';
  }

  /* 重新繪製目前畫面，並還原焦點與捲動位置 */
  App.render = function () {
    const main = document.getElementById('main');
    const view = currentView();
    const active = document.activeElement;
    const focusKey = active && active.dataset ? active.dataset.key : null;
    const sel = active && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;
    // 只有同一頁重繪時才保留捲動位置，換頁時從頭開始
    const sameView = App._lastView === view;
    const wrapScroll = sameView ? [...main.querySelectorAll('.table-wrap')].map(w => w.scrollLeft) : [];
    const y = sameView ? main.scrollTop : 0;
    App._lastView = view;

    main.replaceChildren((App.views[view] || App.upcoming[view])());
    renderNav(view);
    renderHeader();

    // 兩層表頭：第二列的固定位置依第一列實際高度
    main.querySelectorAll('.grid thead').forEach(th => {
      if (th.rows.length > 1) th.style.setProperty('--head1', th.rows[0].getBoundingClientRect().height + 'px');
    });
    main.scrollTop = y;
    main.querySelectorAll('.table-wrap').forEach((w, i) => { if (wrapScroll[i]) w.scrollLeft = wrapScroll[i]; });
    if (focusKey) {
      const el = main.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
      if (el) {
        el.focus({ preventScroll: true });
        if (sel && 'setSelectionRange' in el) { try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* 日期欄等不支援 */ } }
      }
    }
  };

  function renderNav(view) {
    const nav = document.getElementById('nav');
    const st = App.stats();
    const pct = s => s.total ? Math.round(s.done / s.total * 100) + '%' : '';
    const as = App.areaSummary(App.state);
    const meta = { checklistA: pct(st.a), checklistB: pct(st.b), checklistC: pct(st.c), inventory: App.state.inventory.length ? App.state.inventory.length + ' 筆' : '',
      hazop: App.state.nodes.length ? App.state.nodes.length + ' 節點' : '',
      actions: (() => { const a = App.actionSummary(App.state); return a.overdue ? `逾期 ${a.overdue}` : a.total ? `${a.done}／${a.total}` : ''; })(),
      areas: as.total ? (as.major ? `重大 ${as.major}` : '') + (as.incomplete ? ` 缺 ${as.incomplete}` : '') || `${as.total} 區` : '' };
    nav.replaceChildren(...NAV.map(g => h('div', { class: 'nav-group' },
      h('div', { class: 'nav-title' }, g.group),
      g.items.map(([id, label]) => h('a', {
        href: '#' + id, class: (id === view ? 'active' : '') + (App.upcoming[id] ? ' later' : ''),
        'aria-current': id === view ? 'page' : undefined,
      }, h('span', null, label), meta[id] ? h('small', null, meta[id]) : App.upcoming[id] ? h('small', null, '開發中') : null)))));
  }

  function renderHeader() {
    const p = App.state;
    document.getElementById('project-name').textContent = p.meta.site || p.meta.process || '未命名專案';
    document.getElementById('file-name').textContent = App.fileName ? App.fileName + (App.dirty ? '（未存檔）' : '（已存檔）') : '尚未存成專案檔';
    document.getElementById('file-name').className = App.dirty ? 'unsaved' : 'saved';
    document.getElementById('btn-undo').disabled = !App.canUndo();
    document.getElementById('sample-banner').hidden = !p.isSample;
    document.title = (p.meta.site ? p.meta.site + '－' : '') + '製程安全評估';
  }
  App.on('changed', renderHeader);
  App.on('undo-changed', () => { const b = document.getElementById('btn-undo'); if (b) b.disabled = !App.canUndo(); });
  App.on('autosaved', () => { document.getElementById('autosave').textContent = '已自動保存 ' + new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }); });
  App.on('autosave-failed', () => { document.getElementById('autosave').textContent = '⚠ 自動保存失敗，請手動存檔'; });

  function bindToolbar() {
    const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
    on('btn-new', () => {
      if (App.dirty && !confirm('目前專案有尚未存成專案檔的變更，確定要開新專案嗎？')) return;
      App.setProject(App.newProject()); location.hash = 'overview'; App.toast('已建立新專案');
    });
    on('btn-open', () => App.openFile());
    on('btn-save', () => App.save());
    on('btn-saveas', () => App.saveAs());
    on('btn-sample', () => {
      if (App.dirty && !confirm('載入範例會取代目前專案，確定嗎？（目前變更尚未存成專案檔）')) return;
      App.setProject(App.sampleProject()); location.hash = 'overview'; App.toast('已載入範例專案');
    });
    on('btn-undo', () => App.undo());
  }

  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); (e.shiftKey ? App.saveAs : App.save)(); }
    // 輸入框內的 Ctrl+Z 交給瀏覽器（復原打字），其他地方復原上一步
    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); App.undo(); }
  });
  window.addEventListener('beforeunload', e => { if (App.dirty) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('hashchange', () => { App.render(); document.getElementById('main').scrollTop = 0; });

  window.addEventListener('DOMContentLoaded', () => {
    bindToolbar();
    if (App.loadAutosave()) {
      if (App.dirty) App.toast('已還原上次的工作內容（瀏覽器自動保存）');
    } else {
      App.state = App.newProject();
    }
    App.render();
  });
})();
