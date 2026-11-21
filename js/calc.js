/* 系統作用危害分析判定（與 Excel 範本 v2「系統作用危害分析」公式逐條對應）
 *
 * 條件原文（高雄市《第三章 製程安全評估報告書》第 3-5 頁）：
 * ① Q＞20% TQ
 * ② 高放熱反應
 * ③ 製程中之組成在 LEL 以上、UEL 以下，或濃度在此範圍附近
 * ④ 100℃以下熱不安定，或與空氣、水等接觸後起反應之物質，P≧10 psig（兩者同時成立）
 * ⑤ T＞A.I.T. 或為易燃性氣體
 * ⑥ P≧20 kg/cm² 或 P≦500 mmHg（絕對壓）
 * ⑦ (上游壓力)≧4(下游壓力)
 */
(function () {
  const isNum = v => typeof v === 'number' && isFinite(v);
  App.isNum = isNum;

  App.CONDITIONS = {
    '①': 'Q＞20% TQ',
    '②': '高放熱反應',
    '③': '組成在 LEL～UEL 間或附近',
    '④': '100℃以下熱不安定／與空氣、水反應之物質，且 P≧10 psig',
    '⑤': 'T＞A.I.T. 或為易燃性氣體',
    '⑥': 'P≧20 kg/cm² 或 P≦500 mmHg（絕對壓）',
    '⑦': '上游壓力≧4×下游壓力',
  };

  App.newArea = function () {
    return { id: App.uid(), name: '', exo: '', reactionType: '', lel: '', unstable: '', T: '', AIT: '', flammableGas: '', P: '', vacuum: '', pUp: '', pDown: '', remark: '' };
  };
  App.newInventory = function (areaId) {
    return { id: App.uid(), areaId: areaId || '', substance: '', location: '', qKg: '', conc: '', remark: '' };
  };

  /* 存量列：純物質量、附表、TQ、q／TQ */
  App.calcInventory = function (row, project) {
    const tq = App.lookupTQ(row.substance, project);
    const pure = (!App.isEmpty(row.substance) && isNum(row.qKg)) ? row.qKg * (isNum(row.conc) ? row.conc : 100) / 100 : null;
    const ratio = (pure !== null && tq && tq.tq > 0) ? pure / tq.tq : 0;
    return { pure, tq, ratio, inAnnex: !!(tq && tq.tq > 0) };
  };

  /* 區域判定 */
  App.calcArea = function (area, project) {
    const s = project.settings;
    const rows = project.inventory.filter(r => r.areaId === area.id);
    let Q = 0, sum = 0, max = 0, annexRows = 0;
    for (const r of rows) {
      const c = App.calcInventory(r, project);
      if (c.inAnnex) { annexRows++; if (c.pure !== null) Q += c.pure; }
      sum += c.ratio; if (c.ratio > max) max = c.ratio;
    }
    const used = s.multiMode === 'max' ? max : sum;
    const c1 = annexRows === 0 ? '不適用' : (used > s.qtq ? '是' : '否');
    const c5 = area.flammableGas === '是' ? '是' : (isNum(area.T) && isNum(area.AIT) ? (area.T > area.AIT ? '是' : '否') : '');
    const adj = s.dpBasis === 'absolute' ? s.atm : 0;
    const hasDP = isNum(area.pUp) && isNum(area.pDown);
    const ratioDP = hasDP ? ((area.pDown + adj) <= 0 ? Infinity : (area.pUp + adj) / (area.pDown + adj)) : null;

    const met = {
      '①': c1 === '是',
      '②': area.exo === '是',
      '③': area.lel === '是',
      '④': area.unstable === '是' && isNum(area.P) && area.P >= s.unstablePsig * App.PSI_TO_KGCM2,
      '⑤': c5 === '是',
      '⑥': (isNum(area.P) && area.P >= s.pHigh) || (isNum(area.vacuum) && area.vacuum <= s.vacuum),
      '⑦': hasDP && (area.pUp + adj) >= s.dpFactor * (area.pDown + adj),
    };
    const triggers = Object.keys(met).filter(k => met[k]);

    const missing = [];
    if (rows.length === 0) missing.push('存量表未填');
    if (App.isEmpty(area.exo)) missing.push('高放熱');
    if (App.isEmpty(area.lel)) missing.push('LEL～UEL');
    if (App.isEmpty(area.unstable)) missing.push('熱不安定');
    if (area.flammableGas !== '是' && !(isNum(area.T) && isNum(area.AIT))) missing.push('T／A.I.T.');
    if (App.isEmpty(area.flammableGas)) missing.push('易燃性氣體');
    if (!isNum(area.P)) missing.push('最大操作壓力');
    if (!hasDP) missing.push('上下游壓力');

    const result = triggers.length ? '重大潛在危害' : (missing.length ? '資料不完整' : '—');
    return { rows: rows.length, annexRows, Q, sum, max, c1, c5, ratioDP, met, triggers, missing, result };
  };

  /* 全部區域的統計 */
  App.areaSummary = function (project) {
    const out = { total: project.areas.length, major: 0, incomplete: 0, ok: 0 };
    for (const a of project.areas) {
      const r = App.calcArea(a, project).result;
      if (r === '重大潛在危害') out.major++; else if (r === '資料不完整') out.incomplete++; else out.ok++;
    }
    return out;
  };
})();
