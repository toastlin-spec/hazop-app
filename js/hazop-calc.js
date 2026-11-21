/* HAZOP 與改善建議：資料結構與計算（對應 Excel 範本 v2「HAZOP工作表」「改善建議彙整」公式） */
(function () {
  App.STATUS = ['未開始', '進行中', '已完成', '展延'];
  App.RISK_LEVELS = ['極高', '高', '中', '低'];

  App.newNode = function (area) {
    return {
      id: App.uid(), areaId: area ? area.id : '', name: area ? area.name : '', process: (App.state && App.state.meta.process) || '',
      lineNo: '', intent: '', pid: '', meetingDate: '', chair: '', recorder: '', participants: '',
    };
  };
  App.newDeviation = function (nodeId) {
    return {
      id: App.uid(), nodeId, guideWord: '', param: '', deviation: '', cause: '', consequence: '', safeguards: '',
      severity: '', likelihood: '', recommendation: '', owner: '', due: '', doneDate: '', status: '', remark: '',
    };
  };
  App.newAction = function () {
    return { id: App.uid(), source: '', recommendation: '', level: '', owner: '', due: '', doneDate: '', status: '', remark: '' };
  };

  /* 引導字 × 參數 → 表 3.2.3-1 的偏離文字；「—」回傳 null */
  App.autoDeviation = function (guideWord, param) {
    const gi = App.GUIDE_WORDS.indexOf(guideWord);
    const row = App.DEVIATIONS[param];
    if (gi < 0 || !row) return '';
    return row[gi] === '—' ? null : row[gi];
  };

  /* 風險分數＝嚴重性×可能性（Excel：=IF(OR(I="",J=""),"",I*J)） */
  App.riskScore = function (d) {
    return App.isNum(d.severity) && App.isNum(d.likelihood) ? d.severity * d.likelihood : '';
  };

  /* 今天（本機日期 YYYY-MM-DD）；測試時可設定 App.todayOverride */
  App.today = function () {
    if (App.todayOverride) return App.todayOverride;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  /* 是否逾期（Excel：=IF(OR(F="",G<>""),"",IF(TODAY()>F,"逾期","未到期"))） */
  App.overdue = function (item, today) {
    if (App.isEmpty(item.due) || !App.isEmpty(item.doneDate)) return '';
    return (today || App.today()) > item.due ? '逾期' : '未到期';
  };

  /* 偏離的編號：HAZOP N節點序-列序 */
  App.deviationRef = function (project, d) {
    const ni = project.nodes.findIndex(n => n.id === d.nodeId);
    const rows = project.deviations.filter(x => x.nodeId === d.nodeId);
    return `HAZOP N${ni + 1}-${rows.indexOf(d) + 1}`;
  };

  /* 改善建議彙整：HAZOP 有填改善建議的列＋其他來源的建議（同一份資料，不重複維護） */
  App.actionList = function (project, today) {
    const t = today || App.today();
    const list = [];
    project.nodes.forEach((n, ni) => {
      project.deviations.filter(d => d.nodeId === n.id).forEach((d, di) => {
        if (App.isEmpty((d.recommendation || '').trim())) return;
        list.push({ kind: 'hazop', item: d, node: n, ref: `HAZOP N${ni + 1}-${di + 1}`, level: App.riskLevel(App.riskScore(d), project), overdue: App.overdue(d, t) });
      });
    });
    project.actions.forEach(a => list.push({ kind: 'manual', item: a, ref: a.source || '其他', level: a.level || '', overdue: App.overdue(a, t) }));
    return list;
  };

  App.actionSummary = function (project, today) {
    const list = App.actionList(project, today);
    const done = list.filter(x => x.item.status === '已完成' || !App.isEmpty(x.item.doneDate)).length;
    return {
      total: list.length, done, open: list.length - done,
      overdue: list.filter(x => x.overdue === '逾期').length,
      highOpen: list.filter(x => (x.level === '極高' || x.level === '高') && x.item.status !== '已完成' && App.isEmpty(x.item.doneDate)).length,
    };
  };

  /* 風險等級（依判定設定）。原本在 settings.js，移到這裡讓計算模組可單獨測試 */
  App.riskLevel = function (score, project) {
    const r = (project || App.state || { settings: App.DEFAULT_SETTINGS }).settings.risk;
    if (App.isEmpty(score)) return '';
    return score >= r.extreme ? '極高' : score >= r.high ? '高' : score >= r.medium ? '中' : '低';
  };
})();
