/* 常數與參考資料（來源：製程安全評估範本 v2、勞動檢查法施行細則附表一／二 112-12-07 版） */
window.App = window.App || {};

App.SCHEMA = 'hazop-app/1';
App.views = {};

App.STATES = ['固態', '液態', '氣態'];
App.POTENTIAL = ['重大', '可能', '無'];
App.REACTIVITY = ['安定', '不安定', '禁水性', '氧化性', '自反應性'];

/* 檢核表 A：物質危害（欄位分組同 Excel 表頭） */
App.A_GROUPS = [
  { label: '火災爆炸之危害', items: [['fire', '火災'], ['explosion', '爆炸'], ['static', '靜電']] },
  { label: '反應性／安定性', items: [['reactivity', '反應性／安定性']], select: true },
  { label: '毒性危害', items: [['acute', '急性'], ['chronic', '慢性']] },
  { label: '其他健康之危害', items: [['asphyxia', '窒息'], ['corrosive', '腐蝕性'], ['burn', '燙傷／凍傷'],
    ['mutagenic', '致突變性'], ['odor', '臭味'], ['other', '其他']] },
];
App.A_TOGGLES = App.A_GROUPS.filter(g => !g.select).flatMap(g => g.items.map(i => i[0]));

/* 檢核表 C：處理方法 */
App.C_ITEMS = [['storage', '儲存條件'], ['layout', '工廠區域配置'], ['gasVent', '氣體分級排放'], ['liquidDrain', '液體排放'],
  ['noise', '噪音'], ['qc', '品質控制'], ['emergency', '應變設施'], ['utility', '公用程序'], ['regulation', '法規標準']];

/* 檢核表 B：物質相容性 */
App.SCENARIOS = ['正常接觸', '異常接觸', '混料錯誤', '洩漏接觸', '維修誤接'];
App.MATERIALS = ['SS304', 'SS316', '碳鋼', '鑄鐵', '鋁', '銅', '人造橡膠', '尼龍', 'PTFE', '玻璃襯裡', 'HDPE', 'PVC'];

App.TEAM_ROLES = ['工作小組長', '技術秘書', '設計及方法工程師', '現場操作工程師', '維修工程師', '儀表工程師', '機械工程師', '工安人員', '製程設計單位代表', '其他'];
App.PRE_DOCS = ['製程流程圖（PFD）', '管線儀表圖（P&ID）', '質能平衡圖', '製程設計規範', '操作手冊／程序', '物質安全資料表（SDS）',
  '機械設備規格明細', '維修紀錄', '工廠配置圖', '緊急應變程序', '意外事故報告書', '預防損失標準'];

/* 判定設定預設值（2026-11-20 定案：多物質＝加總、壓差＝錶壓） */
App.DEFAULT_SETTINGS = {
  qtq: 0.2, multiMode: 'sum', pHigh: 20, vacuum: 500, unstablePsig: 10, dpFactor: 4, dpBasis: 'gauge', atm: 1.0332,
  risk: { extreme: 15, high: 10, medium: 5 },
};
App.PSI_TO_KGCM2 = 0.0703070;

/* HAZOP 引導字 × 製程參數（報告書表 3.2.3-1） */
App.GUIDE_WORDS = ['MORE 較多', 'LESS 較少', 'NO 無', 'REVERSE 相反', 'PART OF 只有部分', 'AS WELL AS 不僅…又', 'OTHER THAN 除…之外'];
App.DEVIATIONS = {
  '流量': ['高流量', '低流量', '無流量', '逆流', '—', '—', '—'],
  '壓力': ['高壓', '低壓', '真空', '—', '—', '—', '—'],
  '溫度': ['高溫', '低溫', '—', '—', '—', '—', '—'],
  '液位': ['高液位', '低液位', '無液位', '—', '—', '—', '—'],
  '成分': ['—', '—', '—', '—', '錯誤組成', '雜質', '錯誤物質'],
  '反應': ['高反應', '低反應', '無反應', '—', '—', '副反應', '錯誤反應'],
  '時間': ['時間太長', '時間太短', '動作未執行', '—', '—', '—', '—'],
  '程序': ['動作太晚', '動作太早', '程序缺失', '未依照順序', '部分動作未執行', '執行額外的動作', '執行錯誤的動作'],
};
App.SEVERITY = ['1 輕微', '2 輕度', '3 中度', '4 重大', '5 災難性'];
App.LIKELIHOOD = ['1 極不可能', '2 不太可能', '3 可能', '4 很可能', '5 幾乎確定'];
App.HAZOP_STEPS = [
  'a. 選擇一節點', 'b. 解釋此一節點的設計目的', 'c. 選擇一製程參數', 'd. 選擇一引導字用在製程參數上以發展出有意義的製程偏離',
  'e. 列出偏離可能的原因', 'f. 檢驗與偏離相關的後果', 'g. 辨識既存的防護措施', 'h. 決定後果嚴重性等級', 'i. 決定後果可能性等級',
  'j. 依風險評估矩陣對應出風險等級', 'k. 評估風險的可接受性', 'l. 依風險等級提出改善建議',
  'm. 重複所有引導字（步驟 d）', 'n. 重複所有製程參數（步驟 c）', 'o. 重複所有節點（步驟 a）',
];
App.METHODS = [
  ['檢核表 Checklist', '災害規模小、災害型態相同、操作程序較不複雜者，如批次生產工廠', '不需太多訓練，容易使用，可集中特定項目，適用設計或操作任一階段', '需周全的檢核表；易遺漏表外危害；較難稽核完整性'],
  ['如果-結果分析 What-If', '災害規模小、型態相同、程序較不複雜者；檢討設備設計及操作問題', '適用任一階段；可檢討非製程事項；訓練需求低；幕僚作業少', '高度依賴引導者經驗；易遺漏危害；較難稽核完整性'],
  ['危害與可操作性分析 HAZOP', '災害規模大小不一、型態不同、發生地點多處且操作程序複雜者，如化工製程單元', '表格化系統化；地毯式檢討減少遺漏；可供保養規劃及 SOP 參考；適用複雜及新製程；廣泛應用於石化及化工業', '花費時間人力多；過程繁複；可能產生無重要性之分析事件；屬定性分析；無法作多種組合原因分析'],
  ['故障樹分析 FTA', '災害規模甚鉅且災害型態單一者，如大型儲槽單元', '邏輯推理呈現失效途徑；兼具定性定量及重要性排序；可作多重組合原因分析；範圍含人為、設備、環境', '組件失誤率資料不易取得；耗時；定量需電腦輔助；頂端事件設定不當則結果不完全；建樹需高度技巧'],
  ['失誤模式與影響分析 FMEA', '災害規模大小不一、型態不同、地點多處，操作程序較不複雜者，如機械性或物理性操作', '適於不複雜系統設備零件分析；表格化系統化；設計變更時更新容易；必要時可作嚴重度排序', '對象僅限硬體，未納入人為及環境因素；僅限單一失誤模式；無法直接顯現根本原因'],
];

/* 勞動檢查法施行細則 附表一（危險物）、附表二（有害物）：[中文, 英文, 化學式, TQ kg] */
App.TQ_TABLE = [
  ...[
    ['過氧化丁酮', 'Methyl ethyl ketone peroxide', 'C8H16O4', 2000], ['過氧化二苯甲醯', 'Dibenzoyl peroxide', 'C14H10O4', 3000],
    ['環氧丙烷', 'Propylene oxide', 'C3H6O', 10000], ['環氧乙烷', 'Ethylene oxide', 'C2H4O', 5000],
    ['二硫化碳', 'Carbon disulphide', 'CS2', 5000], ['乙炔', 'Acetylene', 'C2H2', 5000], ['氫氣', 'Hydrogen', 'H2', 5000],
    ['過氧化氫', 'Hydrogen peroxide', 'H2O2', 5000], ['矽甲烷', 'Silane', 'SiH4', 50], ['硝化乙二醇', 'Nitroglycol', 'C2H4(NO3)2', 1000],
    ['硝化甘油', 'Nitroglycerin', 'C3H5(NO3)3', 1000], ['硝化纖維（含氮量大於 12.6%）', 'Nitrocellulose', 'C6H7O2(NO3)3', 10000],
    ['三硝基苯', 'Trinitrobenzene', 'C6H3(NO2)3', 5000], ['三硝基甲苯', 'Trinitrotoluene', 'C6H2CH3(NO2)3', 5000],
    ['三硝基酚', 'Trinitrophenol', 'C6H2OH(NO2)3', 5000], ['過醋酸', 'Peracetic acid', 'CH3COOOH', 5000],
    ['氯酸鈉', 'Sodium chlorate', 'NaClO3', 25000], ['雷汞', 'Mercury fulminate', 'Hg(CNO)2', 1000], ['疊氮化鉛', 'Lead azide', 'Pb(N3)2', 5000],
    ['史蒂芬酸鉛', 'Triphenyl lead', '', 5000], ['丙烯腈', 'Acrylonitrile', 'C3H3N', 20000], ['重氮硝基酚', 'Diazodinitrophenol', '', 1000],
  ].map(r => ({ annex: '附表一 危險物', zh: r[0], en: r[1], formula: r[2], tq: r[3] })),
  ...[
    ['黃磷火柴', 'Yellow phosphorus match', '', 1], ['含苯膠糊', 'Glue that contains benzene', '', 1],
    ['二氯聯苯胺及其鹽類', 'Dichlorobenzidine and its salts', 'C12H10Cl2N2', 10], ['α-萘胺及其鹽類', 'α-Naphthylamine and its salts', 'C10H9N', 10],
    ['鄰-二甲基聯苯胺及其鹽類', 'O-Tolidine and its salts', 'C14H16N2', 10], ['二甲氧基聯苯胺及其鹽類', 'Dianisidine and its salts', 'C14H16N2O2', 10],
    ['鈹及其化合物', 'Beryllium and its compounds', 'Be', 10], ['四羰化鎳', 'Nickel carbonyl', 'C4O4Ni', 100], ['β-丙內酯', 'β-Propiolactone', 'C3H4O2', 100],
    ['氯', 'Chlorine', 'Cl2', 5000], ['氰化氫', 'Hydrogen cyanide', 'HCN', 1000], ['次乙亞胺', 'Ethyleneimine', 'C2H5N', 500],
    ['磷化氫', 'Phosphine', 'PH3', 50], ['異氰酸甲酯', 'Methyl isocyanate', 'C2H3NO', 300], ['氟化氫', 'Hydrogen fluoride', 'HF', 1000],
    ['四甲基鉛', 'Tetramethyl lead', 'Pb(CH3)4', 1000], ['四乙基鉛', 'Tetraethyl lead', 'Pb(C2H5)4', 5000], ['氨', 'Ammonia', 'NH3', 50000],
    ['氯化氫', 'Hydrogen chloride', 'HCl', 5000], ['二氧化硫', 'Sulfur dioxide', 'SO2', 1000], ['光氣', 'Phosgene', 'COCl2', 100],
    ['甲醛', 'Formaldehyde', 'CH2O', 5000], ['丙烯醛', 'Acrolein', 'C3H4O', 150], ['臭氧', 'Ozone', 'O3', 100],
    ['砷化氫', 'Arsine', 'AsH3', 50], ['溴', 'Bromine', 'Br2', 1000], ['溴甲烷', 'Methyl bromide', 'CH3Br', 2000],
  ].map(r => ({ annex: '附表二 有害物', zh: r[0], en: r[1], formula: r[2], tq: r[3] })),
];

/* 依名稱查 TQ：先查附表，再查專案自訂的「其他指定公告」 */
App.lookupTQ = function (name, project) {
  const n = (name || '').trim();
  if (!n) return null;
  const hit = App.TQ_TABLE.find(t => t.zh === n);
  if (hit) return hit;
  const custom = ((project && project.customTQ) || []).find(t => (t.zh || '').trim() === n && Number(t.tq) > 0);
  return custom ? { annex: '其他指定公告', zh: custom.zh, en: custom.en || '', formula: custom.formula || '', tq: Number(custom.tq) } : null;
};

/* 新的空白專案 */
App.newProject = function () {
  return {
    schema: App.SCHEMA,
    isSample: false,
    meta: { site: '', process: '', date: new Date().toISOString().slice(0, 10), author: '', remark: '' },
    team: [],
    preDocs: App.PRE_DOCS.map(name => ({ name, ready: false, note: '' })),
    settings: JSON.parse(JSON.stringify(App.DEFAULT_SETTINGS)),
    customTQ: [],
    chemicals: [],
    compat: [],
    // 第 2～3 階段會使用
    areas: [], inventory: [], nodes: [], deviations: [], actions: [],
  };
};

App.newChemical = function () {
  const a = {}; App.A_TOGGLES.forEach(k => { a[k] = ''; }); a.reactivity = '';
  const c = {}; App.C_ITEMS.forEach(([k]) => { c[k] = ''; });
  return { id: App.uid(), name: '', state: '', stockKg: '', productionKg: '', a, aPotential: '', aNote: '', c, cTotal: '', cPotential: '', cNote: '' };
};
App.newCompat = function () {
  return { id: App.uid(), sub1: '', sub2: '', scenario: '', consequence: '', potential: '', note: '', remark: '' };
};

App.uid = function () {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
};

/* 範例專案（虛構教學數據，取自 Excel 範本的範例列） */
App.sampleProject = function () {
  const p = App.newProject();
  p.isSample = true;
  p.meta = { site: '範例化工廠 第一廠區', process: '聚醚多元醇聚合製程（範例）', date: '2026-11-20', author: '王小明（範例）', remark: '虛構教學數據，不可作為實際評估結果' };
  p.team = [
    { id: App.uid(), name: '陳主任', role: '工作小組長', unit: '製造部' },
    { id: App.uid(), name: '林工程師', role: '技術秘書', unit: '工安室' },
    { id: App.uid(), name: '張工程師', role: '設計及方法工程師', unit: '製程課' },
    { id: App.uid(), name: '李領班', role: '現場操作工程師', unit: '生產課' },
    { id: App.uid(), name: '黃工程師', role: '儀表工程師', unit: '儀電課' },
  ];
  p.preDocs.forEach((d, i) => { d.ready = i < 7; });
  const mk = (o) => Object.assign(App.newChemical(), o);
  const A = (s) => { const v = s.split(''); const o = {}; App.A_TOGGLES.forEach((k, i) => { o[k] = v[i] === '1' ? '有' : v[i] === '0' ? '無' : ''; }); return o; };
  const C = (s) => { const v = s.split(''); const o = {}; App.C_ITEMS.forEach(([k], i) => { o[k] = v[i] === '1' ? '有' : v[i] === '0' ? '無' : v[i] === 'n' ? '不適用' : ''; }); return o; };
  // A 欄位順序：火災 爆炸 靜電 急性 慢性 窒息 腐蝕性 燙傷 致突變 臭味 其他
  p.chemicals = [
    mk({ name: '甲醇', state: '液態', stockKg: 5000, productionKg: 2000, a: { ...A('11111000010'), reactivity: '安定' }, aPotential: '重大',
      aNote: '甲醇具易燃性及毒性，誤食可致失明；作業場所應備洗眼器及緊急沖淋設備，嚴禁明火。' }),
    mk({ name: '甲苯', state: '液態', stockKg: 8000, productionKg: 3000, a: { ...A('11111000010'), reactivity: '安定' }, aPotential: '重大',
      aNote: '甲苯蒸氣與空氣可形成爆炸性混合物；儲槽區應劃分防爆區域，電氣設備須符合防爆等級。' }),
    mk({ name: '環氧丙烷', state: '液態', stockKg: 6000, productionKg: '', a: { ...A('111110000'), reactivity: '' }, aPotential: '' }),
    mk({ name: '液氮', state: '液態', cTotal: '2,000 L', c: C('111001111'), cPotential: '可能',
      cNote: '液氮有凍傷危害，現場作業人員需穿戴適當個人防護具；氮氣、液氮有窒息危害，應備完善之局限空間作業管制程序。' }),
    mk({ name: '氮氣', state: '氣態', cTotal: '500 m³', c: C('111001111'), cPotential: '可能',
      cNote: '氮氣純度要符合產品品質需求規範；氮氣洩漏之緊急應變需穿戴自給式呼吸器（SCBA）、攜帶氧氣偵測器。' }),
  ];
  p.compat = [
    Object.assign(App.newCompat(), { sub1: '氧氣／液氧', sub2: '鑄鐵、人造橡膠、尼龍', scenario: '異常接觸', consequence: '氧氣接觸可燃性材質有燃燒、爆炸之虞，不可使用上述材質',
      potential: '重大', note: '氧氣、液氧不可使用鑄鐵、人造橡膠、尼龍等可燃性材質。', remark: '氧氣管路材質須審查' }),
    Object.assign(App.newCompat(), { sub1: '氫氣', sub2: '氧氣', scenario: '洩漏接觸', consequence: '氫氧混合達爆炸範圍，遇火源爆炸',
      potential: '重大', note: '氫氣應與氧氣隔離，儲存及使用區域應保持安全距離並有明顯標示。', remark: '氫氣與氧氣應隔離存放' }),
  ];
  // 區域物質存量與系統作用判定（同 Excel 範本 v2 範例：反應區 42.5% 判重大、蒸餾區 15% 判非重大）
  const r1 = Object.assign(App.newArea(), { name: '反應區 R-201（聚合反應）', exo: '是', reactionType: '聚合', lel: '否', unstable: '否', T: 120, AIT: 385,
    flammableGas: '否', P: 5, pUp: 8, pDown: 2, remark: 'Q／TQ＝42.5%（環氧丙烷）、高放熱聚合反應、上游≧4×下游' });
  const r2 = Object.assign(App.newArea(), { name: '蒸餾區 C-401', exo: '否', lel: '否', unstable: '否', T: 95, AIT: 250,
    flammableGas: '否', P: 1.2, pUp: 3, pDown: 1.5, remark: 'Q／TQ＝15%，各項條件皆未達門檻' });
  p.areas = [r1, r2];
  p.inventory = [
    Object.assign(App.newInventory(r1.id), { substance: '環氧丙烷', location: 'R-201 反應器＋進料管線', qKg: 4250, conc: 100 }),
    Object.assign(App.newInventory(r1.id), { substance: '甲醇', location: 'T-101 甲醇進料槽', qKg: 3000, conc: 100, remark: '甲醇不在附表，不計入 Q' }),
    Object.assign(App.newInventory(r2.id), { substance: '環氧丙烷', location: 'C-401 塔底＋迴流槽', qKg: 1500, conc: 100 }),
  ];
  // HAZOP（同 Excel 範本 v2 範例列：分數 6／8／8／10）
  const n1 = Object.assign(App.newNode(r1), { name: 'T-101→P-101→R-201 甲醇輸送管線', process: p.meta.process, lineNo: 'P-101、2"-PL-1012', intent: '以 2 m³/h 將甲醇由 T-101 送入 R-201，操作壓力 5 kg/cm²G',
    pid: 'P&ID-201', meetingDate: '2026-11-20', chair: '陳主任', recorder: '林工程師', participants: '張工程師、李領班、黃工程師' });
  const n2 = Object.assign(App.newNode(r1), { name: 'R-201 半批次反應器（夾套冷卻）', process: p.meta.process, lineNo: 'R-201、P-301', intent: '維持反應溫度 120°C，以夾套冷卻水移除反應熱',
    pid: 'P&ID-202', meetingDate: '2026-11-20', chair: '陳主任', recorder: '林工程師', participants: '張工程師、李領班、黃工程師' });
  p.nodes = [n1, n2];
  const dv = (node, o) => Object.assign(App.newDeviation(node.id), o);
  p.deviations = [
    dv(n1, { guideWord: 'NO 無', param: '流量', deviation: '無流量', cause: '泵 P-101 跳脫', consequence: '進料中斷，反應不完全，產品不合格', safeguards: '低流量警報',
      severity: 2, likelihood: 3, recommendation: '確認進料中斷時反應器本身仍安全', status: '未開始' }),
    dv(n1, { guideWord: 'NO 無', param: '流量', deviation: '無流量', cause: '出料閥維修後未開啟', consequence: '泵空轉過熱，密封失效，甲醇洩漏起火', safeguards: '無',
      severity: 4, likelihood: 2, recommendation: '增設最小流量管線或低流量泵跳脫；將閥位確認納入重開車檢查表', owner: '設備課', due: '2026-12-31', status: '進行中' }),
    dv(n1, { guideWord: 'MORE 較多', param: '壓力', deviation: '高壓', cause: '泵關死揚程高於管線設計壓力', consequence: '法蘭洩漏，火災爆炸危害', safeguards: '安全閥洩至儲槽',
      severity: 4, likelihood: 2, recommendation: '確認安全閥尺寸足以應付此情境', status: '未開始' }),
    dv(n2, { guideWord: 'NO 無', param: '流量', deviation: '無冷卻', cause: '冷卻水泵故障', consequence: '熱量無法移除，溫度上升，失控反應，超壓，槽體破裂', safeguards: '高溫警報',
      severity: 5, likelihood: 2, recommendation: '增設高溫進料跳脫獨立安全功能，以 LOPA 決定 SIL 等級', status: '未開始' }),
  ];
  p.actions = [
    Object.assign(App.newAction(), { source: '檢核表B-1', recommendation: '審查氧氣管路材質，汰換鑄鐵、人造橡膠、尼龍等可燃性材質', level: '高',
      owner: '工務課', due: '2026-10-31', status: '進行中', remark: '範例：預定日已過且未填實際完成日，顯示「逾期」' }),
  ];
  return p;
};
