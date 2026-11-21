/* 狀態管理：自動保存（瀏覽器）、復原、專案檔開啟／儲存（本機檔案） */
(function () {
  const AUTOSAVE_KEY = 'hazop-app.autosave.v1';
  const UNDO_LIMIT = 50;

  App.state = null;          // 目前專案
  App.fileHandle = null;     // File System Access API 的檔案控制代碼
  App.fileName = '';
  App.dirty = false;         // 有未存到專案檔的變更
  const undoStack = [];
  let pendingSnapshot = null;
  let autosaveTimer = null;

  /* ---------- 自動保存 ---------- */
  function autosaveNow() {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), fileName: App.fileName, dirty: App.dirty, project: App.state }));
      App.emit('autosaved');
    } catch (e) {
      App.emit('autosave-failed', e);
    }
  }
  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(autosaveNow, 400);
  }
  App.loadAutosave = function () {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      App.state = App.migrate(data.project);
      App.fileName = data.fileName || '';
      App.dirty = !!data.dirty;
      return true;
    } catch (e) {
      return false;
    }
  };

  /* ---------- 變更與復原 ---------- */
  // 欄位取得焦點時先記下快照，變更確定（change 事件）時才推入復原堆疊
  App.beginEdit = function () { pendingSnapshot = JSON.stringify(App.state); };
  App.commitEdit = function () {
    if (pendingSnapshot !== null && pendingSnapshot !== JSON.stringify(App.state)) {
      pushUndo(pendingSnapshot);
      markChanged();
    }
    pendingSnapshot = null;
  };
  // 一般變更：先存快照、套用、重新繪製
  App.mutate = function (fn, opts) {
    pushUndo(JSON.stringify(App.state));
    fn(App.state);
    markChanged();
    if (!opts || opts.render !== false) App.render();
  };
  // 文字輸入時即時寫入（不重繪，以免游標跳走）
  App.liveSet = function (obj, key, value) {
    obj[key] = value;
    App.dirty = true;
    scheduleAutosave();
    App.emit('changed');
  };
  function pushUndo(snap) {
    undoStack.push(snap);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    App.emit('undo-changed');
  }
  function markChanged() {
    App.dirty = true;
    scheduleAutosave();
    App.emit('changed');
  }
  App.canUndo = () => undoStack.length > 0;
  App.undo = function () {
    if (!undoStack.length) return;
    App.state = JSON.parse(undoStack.pop());
    markChanged();
    App.emit('undo-changed');
    App.render();
    App.toast('已復原上一步');
  };
  App.clearUndo = function () { undoStack.length = 0; App.emit('undo-changed'); };

  /* ---------- 專案切換 ---------- */
  App.setProject = function (project, fileName, handle) {
    App.state = App.migrate(project);
    App.fileName = fileName || '';
    App.fileHandle = handle || null;
    App.dirty = false;
    App.clearUndo();
    autosaveNow();
    App.render();
  };

  /* 舊版或缺欄位的專案檔補齊預設值 */
  App.migrate = function (p) {
    if (!p || typeof p !== 'object') throw new Error('不是有效的專案資料');
    if (p.schema && p.schema !== App.SCHEMA) throw new Error('專案檔版本不符：' + p.schema);
    const base = App.newProject();
    const out = Object.assign(base, p);
    out.meta = Object.assign(App.newProject().meta, p.meta || {});
    out.settings = Object.assign(JSON.parse(JSON.stringify(App.DEFAULT_SETTINGS)), p.settings || {});
    out.settings.risk = Object.assign({}, App.DEFAULT_SETTINGS.risk, (p.settings || {}).risk || {});
    out.chemicals = (p.chemicals || []).map(c => {
      const n = App.newChemical();
      return Object.assign(n, c, { a: Object.assign(n.a, c.a || {}), c: Object.assign(n.c, c.c || {}) });
    });
    out.compat = (p.compat || []).map(c => Object.assign(App.newCompat(), c));
    out.areas = (p.areas || []).map(a => Object.assign(App.newArea(), a));
    out.inventory = (p.inventory || []).map(r => Object.assign(App.newInventory(), r));
    out.nodes = (p.nodes || []).map(n => Object.assign(App.newNode(), n));
    out.deviations = (p.deviations || []).map(d => Object.assign(App.newDeviation(d.nodeId), d));
    out.actions = (p.actions || []).map(a => Object.assign(App.newAction(), a));
    if (!Array.isArray(p.preDocs)) out.preDocs = base.preDocs;
    ['team', 'customTQ'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
    out.schema = App.SCHEMA;
    return out;
  };

  /* ---------- 專案檔（.hazop.json）---------- */
  const PICKER_TYPES = [{ description: '製程安全評估專案檔', accept: { 'application/json': ['.json'] } }];
  const hasFSA = () => 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;

  App.suggestedName = function () {
    const base = (App.state.meta.site || App.state.meta.process || '未命名專案').replace(/[\\/:*?"<>|]/g, '_');
    return `${base}_製程安全評估.hazop.json`;
  };

  App.openFile = async function () {
    if (App.dirty && !confirm('目前專案有尚未存檔的變更，確定要開啟其他專案嗎？\n（瀏覽器內的自動保存會被取代）')) return;
    try {
      if (hasFSA()) {
        const [handle] = await window.showOpenFilePicker({ types: PICKER_TYPES, multiple: false });
        const file = await handle.getFile();
        loadFromText(await file.text(), file.name, handle);
      } else {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.json,application/json';
        input.onchange = async () => { const f = input.files[0]; if (f) loadFromText(await f.text(), f.name, null); };
        input.click();
      }
    } catch (e) {
      if (e.name !== 'AbortError') App.toast('開啟失敗：' + e.message, 'error');
    }
  };
  function loadFromText(text, name, handle) {
    let data;
    try { data = JSON.parse(text); } catch (e) { App.toast('檔案不是有效的 JSON 格式', 'error'); return; }
    try {
      App.setProject(data, name, handle);
      App.toast('已開啟：' + name);
    } catch (e) {
      App.toast('開啟失敗：' + e.message, 'error');
    }
  }
  App.loadFromText = loadFromText;

  App.save = async function () {
    if (!App.fileHandle) return App.saveAs();
    try {
      await writeHandle(App.fileHandle);
      App.dirty = false; autosaveNow(); App.emit('changed');
      App.toast('已儲存：' + App.fileName);
    } catch (e) {
      App.toast('儲存失敗：' + e.message, 'error');
    }
  };
  App.saveAs = async function () {
    const text = JSON.stringify(App.state, null, 2);
    try {
      if (hasFSA()) {
        const handle = await window.showSaveFilePicker({ suggestedName: App.fileName || App.suggestedName(), types: PICKER_TYPES });
        await writeHandle(handle);
        App.fileHandle = handle; App.fileName = handle.name;
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        a.download = App.fileName || App.suggestedName();
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        App.fileName = a.download;
      }
      App.dirty = false; autosaveNow(); App.emit('changed');
      App.toast('已儲存：' + App.fileName);
    } catch (e) {
      if (e.name !== 'AbortError') App.toast('儲存失敗：' + e.message, 'error');
    }
  };
  async function writeHandle(handle) {
    const w = await handle.createWritable();
    await w.write(JSON.stringify(App.state, null, 2));
    await w.close();
  }

  /* ---------- 簡易事件 ---------- */
  const listeners = {};
  App.on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
  App.emit = (ev, arg) => { (listeners[ev] || []).forEach(fn => fn(arg)); };
})();
