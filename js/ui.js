/* 畫面元件：h() 建立元素、各種可編輯欄位、提示訊息 */
(function () {
  App.h = function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    appendChildren(el, children);
    return el;
  };
  function appendChildren(el, children) {
    for (const c of children) {
      if (c === null || c === undefined || c === false) continue;
      if (Array.isArray(c)) appendChildren(el, c);
      else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }
  const h = App.h;

  const isEmpty = v => v === '' || v === null || v === undefined;
  App.isEmpty = isEmpty;

  /* 文字／數字欄位：輸入時即時寫入，離開欄位時才記入復原並重繪 */
  App.field = function (obj, key, opts = {}) {
    const type = opts.type || 'text';
    const tag = opts.multiline ? 'textarea' : 'input';
    const el = h(tag, {
      class: 'cell-input' + (opts.required && isEmpty(obj[key]) ? ' need' : '') + (opts.class ? ' ' + opts.class : ''),
      type: opts.multiline ? undefined : (type === 'number' ? 'text' : type),
      inputmode: type === 'number' ? 'decimal' : undefined,
      placeholder: opts.placeholder || '',
      list: opts.list,
      rows: opts.multiline ? 1 : undefined,
      'aria-label': opts.label,
      dataset: { key: opts.key || '' },
    });
    el.value = isEmpty(obj[key]) ? '' : obj[key];
    el.addEventListener('focus', () => App.beginEdit());
    el.addEventListener('input', () => {
      let v = el.value;
      if (type === 'number') {
        const t = v.replace(/,/g, '').trim();
        v = t === '' ? '' : (isFinite(Number(t)) ? Number(t) : v);
        el.classList.toggle('invalid', typeof v === 'string' && v !== '');
      }
      App.liveSet(obj, key, v);
      if (opts.multiline) autoGrow(el);
    });
    el.addEventListener('change', () => { App.commitEdit(); setTimeout(App.render, 0); });
    if (opts.multiline) requestAnimationFrame(() => autoGrow(el));
    return el;
  };
  function autoGrow(el) { el.style.height = 'auto'; el.style.height = Math.max(el.scrollHeight, 30) + 'px'; }

  /* 下拉選單 */
  App.select = function (obj, key, options, opts = {}) {
    const el = h('select', {
      class: 'cell-select' + (opts.required && isEmpty(obj[key]) ? ' need' : '') + (opts.colorize ? ' v-' + (obj[key] || 'empty') : ''),
      'aria-label': opts.label, dataset: { key: opts.key || '' },
    },
    h('option', { value: '' }, opts.placeholder || '—'),
    options.map(o => h('option', { value: o, selected: obj[key] === o }, o)));
    el.addEventListener('change', () => App.mutate(() => { obj[key] = el.value; }));
    return el;
  };

  /* 點一下循環切換（空 → 有 → 無 → [不適用] → 空），鍵盤可用空白鍵 */
  App.toggle = function (obj, key, cycle, opts = {}) {
    const v = obj[key] || '';
    const el = h('button', {
      type: 'button', class: 'tog v-' + (v || 'empty') + (opts.tone ? ' tone-' + opts.tone : ''),
      title: (opts.label || '') + '（點擊切換：' + cycle.join(' → ') + ' → 空白）',
      'aria-label': (opts.label || '') + '：' + (v || '未填'), dataset: { key: opts.key || '' },
    }, v || '　');
    el.addEventListener('click', () => {
      const i = cycle.indexOf(v);
      const next = i === -1 ? cycle[0] : (i + 1 < cycle.length ? cycle[i + 1] : '');
      App.mutate(() => { obj[key] = next; });
    });
    return el;
  };

  /* 列操作按鈕（上移、下移、刪除） */
  App.rowActions = function (list, index, label, key) {
    const move = (d) => App.mutate(() => { const [it] = list.splice(index, 1); list.splice(index + d, 0, it); });
    return h('div', { class: 'row-actions' },
      h('button', { type: 'button', class: 'icon-btn', title: '上移', 'aria-label': '上移', disabled: index === 0, onclick: () => move(-1), dataset: { key: key + ':up' } }, '↑'),
      h('button', { type: 'button', class: 'icon-btn', title: '下移', 'aria-label': '下移', disabled: index === list.length - 1, onclick: () => move(1), dataset: { key: key + ':down' } }, '↓'),
      h('button', {
        type: 'button', class: 'icon-btn danger', title: '刪除', 'aria-label': '刪除',
        onclick: () => { if (confirm(`確定刪除「${label || '此列'}」？（可用「復原」救回）`)) App.mutate(() => list.splice(index, 1)); },
      }, '✕'));
  };

  App.badge = (text, tone) => h('span', { class: 'badge ' + (tone || '') }, text);

  App.pageHeader = function (title, desc, ...actions) {
    return h('div', { class: 'page-head' },
      h('div', null, h('h1', null, title), desc ? h('p', { class: 'desc' }, desc) : null),
      actions.length ? h('div', { class: 'page-actions' }, actions) : null);
  };

  App.progress = function (done, total) {
    const pct = total ? Math.round(done / total * 100) : 0;
    return h('div', { class: 'progress', title: `${done}／${total} 欄已填` },
      h('div', { class: 'bar' }, h('div', { class: 'fill' + (pct === 100 ? ' full' : ''), style: { width: pct + '%' } })),
      h('span', null, total ? `${pct}%（${done}／${total}）` : '尚無資料'));
  };

  /* 提示訊息 */
  App.toast = function (msg, kind) {
    const box = document.getElementById('toasts');
    const t = h('div', { class: 'toast ' + (kind || ''), role: 'status' }, msg);
    box.appendChild(t);
    setTimeout(() => t.classList.add('hide'), kind === 'error' ? 5000 : 2200);
    setTimeout(() => t.remove(), kind === 'error' ? 5600 : 2800);
  };

  App.fmtNum = v => (isEmpty(v) || isNaN(Number(v))) ? (v || '') : Number(v).toLocaleString('zh-TW', { maximumFractionDigits: 2 });
})();
