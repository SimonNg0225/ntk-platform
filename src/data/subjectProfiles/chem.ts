import type { SubjectKnowledge } from './types'

// ============================================================
//  化學（Chemistry）科目知識檔案
//  ------------------------------------------------------------
//  公開試結構（現行 DSE）：
//    卷一 Paper 1（必修，2 小時 30 分，佔科總分 60%）：
//      甲部 Section A 選擇題（MC，佔總分 18%）+ 乙部 Section B 結構式 / 短答 /
//      長題（佔總分 42%；須列步驟、寫平衡方程、做莫耳計算同解釋）。
//    卷二 Paper 2（選修，1 小時，佔科總分 20%）：三個選修單元
//      （工業化學 Industrial Chemistry / 物料化學 Materials Chemistry /
//       分析化學 Analytical Chemistry）三選二作答，每單元結構 / 長題。
//    校本評核 SBA（佔科總分 20%）：校內實驗報告 / 技能評估（唔喺此 AI 批改範圍，
//      但實驗設計 / 數據處理 / 公平試驗等可批改部分喺 strand 內處理）。
//  批改鐵則（HKEAA marking scheme 慣例，提煉非照搬）：
//    · 化學方程式必須平衡、帶狀態符號 (s)(l)(g)(aq)；離子方程式要消去旁觀離子；
//    · 莫耳計算逐步畀方法分（substitution / working），最後答案要帶單位、按指定
//      有效數字；中間數值唔好過早約簡（follow-through 可酌情）；
//    · 解釋題要有因果鏈 + 正確化學術語（如 nucleophile / electrophilic addition /
//      delocalised electrons），口語化 / 含糊描述扣分；
//    · 命名按 IUPAC（halogenoalkane / -oic acid…），中英對照；式量 / 結構式要清楚。
//  範疇對齊官方課程必修 12 主題 + 選修部分。
//  提煉來源：HKEAA 化學課程及評估指引 / 評核大綱 + 公開 marking scheme 慣例
//  （平衡方程 / 狀態符號 / mole working / IUPAC 命名）+ DSE 化學批改知識。
//  官方表現示例（sample performance）/ 考評報告可逐題校準常見失分。
//  版權：只提煉成衍生批改指引，未照搬任何 HKEAA 試題原文或官方評分細則原句。
// ============================================================

const CHEM_PERSONA =
  '你係資深香港中學化學科評卷員，按 DSE Chemistry 標準批改：化學方程式要平衡、帶齊狀態符號 (s)(l)(g)(aq)，離子方程式要消去旁觀離子；莫耳 / 計算題逐步畀方法分（用啱公式 / 代入即使最終答案錯都酌量畀分），最後答案要帶單位、按指定有效數字，中間數值唔好過早約簡；解釋題要有因果鏈同正確術語，口語化或含糊描述要扣分；命名按 IUPAC（中英對照）。標出方程錯誤、計算 / 單位失誤、概念混淆、術語不當。'

export const CHEM: SubjectKnowledge = {
  subject: 'chem',
  label: '化學',
  lang: 'zh',
  assessment: {
    papers: [
      '卷一 Paper 1（必修，2 小時 30 分，佔科總分 60%）：甲部 Section A 選擇題（MC，每題等分，佔總分 18%）+ 乙部 Section B 結構式 / 短答 / 長題（佔總分 42%），須列步驟、寫平衡方程、做莫耳計算同解釋。',
      '卷二 Paper 2（選修，1 小時，佔科總分 20%）：三個選修單元——工業化學 Industrial Chemistry、物料化學 Materials Chemistry、分析化學 Analytical Chemistry——三選二作答，每單元結構 / 長題。',
      '校本評核 SBA（佔科總分 20%）：校內實驗報告與實驗技能評估（校內評，唔喺此 AI 批改範圍）；惟實驗設計、數據處理、公平試驗、誤差分析等筆試可批改部分喺相關範疇處理。',
    ],
    weightings: '卷一（必修）60%（甲部 MC 18% + 乙部 42%）· 卷二（選修，三選二）20% · 校本評核 SBA 20%。等級 1–5**（七級）。',
    questionTypes: [
      '選擇題（MC，卷一甲部 Section A）',
      '寫 / 平衡化學方程式（含狀態符號、離子方程式）',
      '莫耳 / 濃度 / 產率 / 滴定計算',
      '解釋題（趨勢 / 反應機理 / 鍵結與性質因果）',
      'IUPAC 命名與結構式 / 同分異構',
      '實驗設計與觀察 / 數據表分析（公平試驗、誤差）',
      '能量圖 / 反應曲線繪畫與詮釋',
      '選修單元結構 / 長題（卷二）',
    ],
    sba: '校本評核 SBA 佔科總分 20%（校內實驗報告 / 技能評估，校內評，唔喺 AI 批改範圍）。',
  },
  commandWords: [
    { word: '寫出 / 平衡方程式（Write / Balance）', meaning: '寫出平衡化學方程式並補齊狀態符號 (s)(l)(g)(aq)；指定時要寫離子方程式（消去旁觀離子）。' },
    { word: '計算（Calculate）', meaning: '列出公式與代入步驟（先有 working 才有方法分），最後答案要帶單位、按指定有效數字。' },
    { word: '解釋（Explain）', meaning: '講清因果機制（點解會咁），用正確化學原理 / 術語，唔可淨係描述現象。' },
    { word: '描述（Describe）', meaning: '具體講出觀察到嘅現象 / 步驟（顏色、沉澱、氣體、放熱等），唔使解釋成因。' },
    { word: '推斷 / 鑑定（Deduce / Identify）', meaning: '據所給數據 / 測試結果推出物質身份或結論，並列出依據（如焰色、沉澱顏色）。' },
    { word: '繪畫（Draw / Sketch）', meaning: '畫出結構式 / 能量圖 / 裝置圖，標示清楚（軸 / 標籤 / 鍵 / 孤對電子）。' },
    { word: '比較（Compare）', meaning: '同時點出相同與不同之處（如反應性、沸點），逐點對應並講原因。' },
    { word: '建議（Suggest）', meaning: '據化學原理提出合理方法 / 試劑 / 解釋，並簡述理由。' },
    { word: '指出（State / Give）', meaning: '直接寫出答案（如試劑、條件、產物），毋須詳細解釋。' },
  ],
  levelDescriptors: [
    { level: '高（5–5**）', descriptor: '概念準確完整，因果解釋嚴謹；方程平衡、狀態符號齊、離子式正確；計算逐步無誤、單位 / 有效數字恰當；命名與術語準確，表達清晰。' },
    { level: '中（3–4）', descriptor: '大致正確，偶有概念 / 運算失誤或漏狀態符號；解釋有因果但欠深度；計算大致準確但偶漏單位 / 約簡不當；術語多數正確。' },
    { level: '低（1–2）', descriptor: '概念 / 機制錯誤較多；方程未平衡或漏狀態符號；計算步驟跳缺、單位常漏；解釋含糊或口語化，術語誤用。' },
  ],
  strands: [
    // ───────────── 物質的微觀世界與化學鍵 / 計量 ─────────────
    {
      key: 'matter-bonding',
      label: '物質、原子結構、鍵結與化學計量',
      persona: CHEM_PERSONA,
      areas: [
        {
          key: 'atomic-structure-periodicity',
          label: '原子結構、週期律與化學鍵',
          keyConcepts: ['原子結構（質子 / 中子 / 電子、同位素、相對原子質量）', '電子排布與週期表趨勢（原子半徑、電負性、金屬性）', '離子鍵 / 共價鍵 / 金屬鍵與配位鍵', '分子形狀與極性（八隅體、孤對電子）', '分子間力（范德華力 / 氫鍵）與物理性質（沸點、溶解度）', '巨型 / 簡單分子 / 離子晶體結構與導電性'],
          markingConventions: ['解釋性質（沸點 / 導電 / 溶解度）要連繫鍵結 / 結構 / 粒子間作用力', '畫電子點交叉圖要正確標明共用 / 孤對電子', '趨勢題要講粒子層面原因（核電荷、屏蔽、半徑）唔可只講「因為喺週期表」', '同位素質子數同、中子數異，化學性質相同'],
          commonErrors: ['混淆分子間力斷裂與共價鍵斷裂（解釋熔沸點時誤講「打斷共價鍵」）', '氫鍵條件搞錯（誤以為任何含 H 都有氫鍵）', '電子點圖漏孤對電子或電子數不符', '誤以為離子化合物熔融 / 固態都導電（固態不導電）', '極性 / 非極性判斷錯（漏看分子對稱性）', '相對原子質量當質量數'],
          rubric: [
            { criterion: '概念 / 結構與鍵結', max: 6, focus: '鍵結類型、結構、粒子間力辨識正確' },
            { criterion: '解釋 / 因果', max: 4, focus: '性質連繫結構、粒子層面原因' },
            { criterion: '圖示 / 標示', max: 3, focus: '電子點圖 / 結構標示清楚' },
            { criterion: '術語 / 表達', max: 2, focus: '術語準確、表達清晰' },
          ],
          issueTypes: ['concept', 'term', 'analysis', 'argument'],
        },
        {
          key: 'mole-stoichiometry',
          label: '化學計量（莫耳、方程式與計算）',
          keyConcepts: ['莫耳概念與阿佛加德羅常數', '相對分子 / 式量、莫耳質量', '濃度（mol dm⁻³）、氣體體積（莫耳體積）', '由方程式作化學計量計算（限量試劑、過量）', '產率（理論 / 實際 / 百分產率）與原子經濟', '經驗式 / 分子式由數據求出'],
          markingConventions: ['計算逐步列出（n = m/M、c = n/V…），用啱公式即得方法分', '方程式必須平衡先可作 mole ratio 計算', '最後答案帶單位（mol / g / dm³ / mol dm⁻³）、按指定有效數字', '限量試劑要明確判斷並以其作計算依據', '中間數值唔好過早約簡（避免累積誤差）'],
          commonErrors: ['方程未平衡就用係數作莫耳比', '單位混亂（cm³ 與 dm³、g 與 mol 換算錯）', '濃度公式體積用錯單位（cm³ 未轉 dm³）', '限量試劑判斷錯、用過量試劑算產物', '百分產率分母用錯（理論值算錯）', '有效數字 / 漏單位', '相對式量計算漏某原子或原子數'],
          rubric: [
            { criterion: '方法 / 公式選用', max: 6, focus: '正確公式、莫耳關係' },
            { criterion: '步驟與運算', max: 5, focus: '逐步無誤、follow-through' },
            { criterion: '答案準確（單位 / 有效數字）', max: 4, focus: '正確值 + 單位 + 約簡恰當' },
            { criterion: '方程 / 表達', max: 2, focus: '方程平衡、列式清楚' },
          ],
          issueTypes: ['calc', 'unit', 'equation', 'step'],
        },
        {
          key: 'earth-sea-atmosphere',
          label: '地球物質（海洋、大氣與礦物）',
          keyConcepts: ['海水中的離子與鹽（氯化鈉的電解產物 / 用途）', '大氣成分與氮 / 氧 / 二氧化碳的化學', '從海水 / 礦物提取物質（蒸發、結晶、電解）', '硬水與軟水、水質與處理', '碳酸鹽（石灰石）受熱分解與用途'],
          markingConventions: ['提取 / 分離過程要寫對方法（電解 / 蒸發結晶）並配方程式', '工業 / 環境題要連繫化學原理而非常識描述', '寫產物要齊狀態符號', '電解海水 / 鹽水題要分清電極產物（陽極 Cl₂、陰極 H₂）'],
          commonErrors: ['電解食鹽水陰陽極產物對調', '碳酸鹽分解產物寫錯（漏 CO₂ 或寫錯氧化物）', '混淆物理分離（蒸發）與化學變化', '硬水成因（Ca²⁺ / Mg²⁺）講唔清', '方程漏狀態符號'],
          rubric: [
            { criterion: '概念 / 過程', max: 6, focus: '提取 / 反應原理正確' },
            { criterion: '方程式', max: 5, focus: '平衡 + 狀態符號 + 產物正確' },
            { criterion: '解釋 / 應用', max: 3, focus: '連繫化學原理' },
            { criterion: '術語 / 表達', max: 2, focus: '用詞準確' },
          ],
          issueTypes: ['concept', 'equation', 'term', 'application'],
        },
      ],
    },

    // ───────────── 反應類型：金屬、酸鹼鹽、氧化還原 ─────────────
    {
      key: 'reactions',
      label: '化學反應（金屬、酸鹼鹽、氧化還原與電化學）',
      persona: CHEM_PERSONA,
      areas: [
        {
          key: 'metals-reactivity',
          label: '金屬反應性與提取',
          keyConcepts: ['金屬活性序與置換反應', '金屬與水 / 酸 / 氧氣的反應', '由礦石提取金屬（加熱 / 碳還原 / 電解）與活性關係', '金屬的腐蝕（鐵生鏽條件）與防鏽', '合金與金屬用途'],
          markingConventions: ['置換反應要符合活性序（活潑置換較不活潑）', '提取方法要對應金屬活性（活潑用電解、中等用碳還原）', '生鏽要同時有水與氧氣，答條件要齊', '反應方程要平衡、帶狀態符號'],
          commonErrors: ['活性序排錯致置換方向錯', '提取方法與金屬活性不配（活潑金屬誤用碳還原）', '生鏽只講水或只講氧氣（條件不全）', '金屬與酸反應產物寫錯（漏 H₂）', '混淆腐蝕與一般氧化'],
          rubric: [
            { criterion: '概念 / 活性序', max: 6, focus: '活性次序、反應可行性' },
            { criterion: '方程式', max: 5, focus: '平衡 + 狀態符號 + 產物' },
            { criterion: '解釋 / 應用', max: 3, focus: '提取 / 防鏽原理' },
            { criterion: '術語 / 表達', max: 2, focus: '用詞準確' },
          ],
          issueTypes: ['concept', 'equation', 'application', 'term'],
        },
        {
          key: 'acids-bases-salts',
          label: '酸、鹼、鹽與滴定',
          keyConcepts: ['酸鹼定義、強弱酸鹼與 pH', '中和反應與鹽的製備（可溶 / 不可溶鹽方法）', '酸與金屬 / 碳酸鹽 / 鹼的反應', '酸鹼滴定（指示劑、終點、計算濃度）', '離子方程式（中和、沉澱）'],
          markingConventions: ['滴定計算要用平衡方程的莫耳比，答案帶單位 / 有效數字', '寫離子方程式要消去旁觀離子並平衡電荷', '強弱酸區別要講電離程度（不是濃度）', '製鹽方法按鹽的溶解度選對途徑', '指示劑選擇要配合滴定類型'],
          commonErrors: ['混淆「強 / 弱」與「濃 / 稀」', '滴定計算莫耳比用錯（如二元酸）', '離子方程式未消旁觀離子或電荷不守恆', '製不可溶鹽誤用中和而非沉澱', '指示劑變色與終點概念混淆', '滴定體積單位 cm³ / dm³ 換算錯'],
          rubric: [
            { criterion: '概念 / 反應類型', max: 6, focus: '酸鹼 / 製鹽 / 滴定原理' },
            { criterion: '計算 / 方程', max: 5, focus: '莫耳比、平衡、離子方程' },
            { criterion: '答案準確（單位 / 有效數字）', max: 4, focus: '正確濃度 + 單位' },
            { criterion: '術語 / 表達', max: 2, focus: '用詞準確' },
          ],
          issueTypes: ['concept', 'equation', 'calc', 'unit'],
        },
        {
          key: 'redox-electrochem',
          label: '氧化還原、化學電池與電解',
          keyConcepts: ['氧化還原（電子轉移、氧化數變化）', '氧化劑 / 還原劑與半反應式', '化學電池（電極、電動勢、能量轉換）', '電解（電極反應、電解產物預測、電鍍 / 提純）', '法拉第電量與電解計算'],
          markingConventions: ['半反應式要平衡電荷與原子（補 H⁺ / H₂O / e⁻）', '氧化還原要指明氧化數升降 / 電子得失', '電解產物預測要考慮離子放電優先序', '電解計算要連繫電量（Q = It）與莫耳電子', '陽極氧化、陰極還原要分清'],
          commonErrors: ['半反應式電荷不守恆或漏電子', '氧化 / 還原定義對調（失電子是氧化）', '電解陰陽極產物 / 反應對調', '放電優先序判斷錯（濃度 / 位置因素忽略）', '電池正負極與電子流向搞錯', '電解計算漏電子莫耳數或電量單位'],
          rubric: [
            { criterion: '概念 / 氧化還原', max: 6, focus: '電子轉移、氧化數、半反應' },
            { criterion: '方程 / 電極反應', max: 5, focus: '半反應平衡、產物正確' },
            { criterion: '計算', max: 4, focus: '電量 / 莫耳電子計算' },
            { criterion: '術語 / 表達', max: 2, focus: '用詞準確' },
          ],
          issueTypes: ['concept', 'equation', 'calc', 'term'],
        },
      ],
    },

    // ───────────── 反應速率、能量與平衡 ─────────────
    {
      key: 'rate-energy',
      label: '化學反應速率、能量與平衡',
      persona: CHEM_PERSONA,
      areas: [
        {
          key: 'rate-of-reaction',
          label: '反應速率與碰撞理論',
          keyConcepts: ['影響速率的因素（濃度 / 溫度 / 表面積 / 催化劑）', '碰撞理論與活化能', '能量分布曲線（Maxwell–Boltzmann）與催化劑作用', '速率測量方法與速率—時間曲線', '催化劑（均相 / 非均相）原理'],
          markingConventions: ['解釋速率變化要連繫「有效碰撞頻率」或「活化能」', '催化劑作用要講「降低活化能、提供另一途徑」（不被消耗）', '能量分布曲線題要正確標軸並比較超過活化能的粒子比例', '速率曲線斜率與反應快慢的關係要對'],
          commonErrors: ['只講「碰撞多咗」而無提「有效碰撞 / 活化能」', '誤以為催化劑改變平衡位置或產率（只加快達平衡）', '溫度影響只講「粒子郁快啲」而漏能量因素', '能量分布曲線軸標錯或催化後新活化能線畫錯', '混淆速率與產量'],
          rubric: [
            { criterion: '概念 / 碰撞理論', max: 6, focus: '速率因素、活化能、有效碰撞' },
            { criterion: '解釋 / 因果', max: 4, focus: '因素如何影響速率' },
            { criterion: '圖示 / 數據', max: 3, focus: '能量曲線 / 速率曲線詮釋' },
            { criterion: '術語 / 表達', max: 2, focus: '用詞準確' },
          ],
          issueTypes: ['concept', 'argument', 'data', 'term'],
        },
        {
          key: 'energetics',
          label: '化學能量學（焓變與能量圖）',
          keyConcepts: ['放熱 / 吸熱反應與 ΔH 符號', '反應進程能量圖（反應物 / 產物 / 活化能 / ΔH）', '鍵能與 ΔH 估算（斷鍵吸熱、成鍵放熱）', '中和熱 / 燃燒熱 / 溶解熱的量度與計算', '量熱計算（q = mcΔT）'],
          markingConventions: ['放熱 ΔH 為負、吸熱為正，符號要齊', '量熱計算用 q = mcΔT，再換算每莫耳的 ΔH', '能量圖要正確標 ΔH（反應物與產物能階差）同活化能', '鍵能法：ΔH = Σ斷鍵 − Σ成鍵，方向唔好倒轉'],
          commonErrors: ['ΔH 符號漏 / 倒轉（放熱寫成正）', '量熱計算用錯質量（用溶質而非溶液質量）', '鍵能法斷鍵 / 成鍵方向倒轉', '能量圖活化能與 ΔH 標示混亂', '單位漏（kJ mol⁻¹）或每莫耳未換算'],
          rubric: [
            { criterion: '概念 / 焓變', max: 6, focus: '吸放熱、ΔH 符號、能量圖' },
            { criterion: '計算', max: 5, focus: 'q = mcΔT、鍵能法、每莫耳換算' },
            { criterion: '答案準確（單位 / 符號）', max: 3, focus: '正確值 + 單位 + 符號' },
            { criterion: '圖示 / 表達', max: 2, focus: '能量圖標示清楚' },
          ],
          issueTypes: ['concept', 'calc', 'unit', 'data'],
        },
      ],
    },

    // ───────────── 有機化學 ─────────────
    {
      key: 'organic',
      label: '有機化學（碳化合物、官能基與反應）',
      persona: CHEM_PERSONA,
      areas: [
        {
          key: 'hydrocarbons-functional',
          label: '碳氫化合物、官能基與命名',
          keyConcepts: ['烷 / 烯 / 炔與官能基（鹵代烴、醇、醛 / 酮、羧酸、酯）', 'IUPAC 命名與結構式 / 簡化結構式', '同系物與通式、物理性質趨勢', '同分異構（結構異構、順反 / 幾何異構）', '由官能基推性質與反應類型'],
          markingConventions: ['命名按 IUPAC（主鏈最長、編號最低位、官能基後綴正確）', '結構式要畫齊鍵 / 原子，官能基清楚', '同分異構要結構不同而分子式相同，畫出不同結構', '官能基辨識要對應正確反應 / 測試'],
          commonErrors: ['命名主鏈選錯 / 編號方向錯 / 後綴錯（-ol / -al / -oic acid 混淆）', '結構式漏氫或鍵數不符（碳價非四）', '同分異構畫成同一結構或改咗分子式', '官能基認錯（醛 vs 酮、醇 vs 醚）', '通式記錯（烯 CₙH₂ₙ 等）'],
          rubric: [
            { criterion: '概念 / 官能基辨識', max: 6, focus: '官能基、同系物、異構辨識' },
            { criterion: '命名 / 結構式', max: 5, focus: 'IUPAC 命名、結構正確' },
            { criterion: '性質 / 應用', max: 3, focus: '由結構推性質' },
            { criterion: '術語 / 表達', max: 2, focus: '用詞準確' },
          ],
          issueTypes: ['concept', 'term', 'equation', 'analysis'],
        },
        {
          key: 'organic-reactions',
          label: '有機反應與機理',
          keyConcepts: ['取代反應（烷烴 / 鹵代烴）', '加成反應（烯烴：與 Br₂ / H₂ / HX / H₂O）', '氧化（醇→醛 / 酮 / 羧酸）與酯化', '反應條件與試劑（催化劑、UV、濃硫酸等）', '聚合反應（加成聚合）與單體 / 重複單元'],
          markingConventions: ['反應方程要平衡、寫對產物與條件 / 試劑', '機理 / 反應類型要正名（addition / substitution / oxidation）', '氧化醇要分清一級→醛 / 羧酸、二級→酮', '聚合題要畫對重複單元（方括號 + n）', '加成 / 取代條件唔可混（UV vs 催化劑）'],
          commonErrors: ['加成 vs 取代混淆（烯誤寫取代）', '氧化產物分級錯（二級醇誤寫成羧酸）', '漏反應條件 / 試劑（如濃 H₂SO₄、UV）', '聚合重複單元漏方括號 / n 或鍵畫錯', '酯化漏水 / 產物寫錯', '方程未平衡'],
          rubric: [
            { criterion: '概念 / 反應類型', max: 6, focus: '反應類型、條件、機理辨識' },
            { criterion: '方程 / 產物', max: 5, focus: '產物正確、平衡、條件齊' },
            { criterion: '應用 / 聚合', max: 3, focus: '重複單元 / 用途' },
            { criterion: '術語 / 表達', max: 2, focus: '用詞準確' },
          ],
          issueTypes: ['concept', 'equation', 'method', 'term'],
        },
      ],
    },
  ],
  publicResources: [
    { label: 'HKEAA 化學 科目資訊（官方：課程評估 / 樣本試題 / 表現示例）', url: 'https://www.hkeaa.edu.hk/en/HKDSE/assessment/subject_information/category_a_subjects/chem/' },
    { label: 'HKEAA HKDSE 科目資訊總頁（如分頁網址有變可由此進入）', url: 'https://www.hkeaa.edu.hk/en/hkdse/assessment/subject_information/' },
    { label: 'EDB 化學課程及評估指引（中四至中六，課程文件）', url: 'https://www.edb.gov.hk/en/curriculum-development/kla/science-edu/curriculum-doc.html' },
    { label: 'DSE Treasure — 化學歷屆試題（按課題分類 + marking 參考）', url: 'https://dsetreasure.com/dse-chem-past-paper/' },
  ],
  source:
    '提煉自 HKEAA 化學課程及評估指引 / 評核大綱（卷一必修 60%：甲部 MC 18% + 乙部 42% + 卷二選修三選二 20% + 校本評核 SBA 20%）+ 公開 marking scheme 慣例（方程平衡 / 狀態符號 / 離子方程式 / mole working / IUPAC 命名 / ΔH 符號）+ DSE 化學批改知識。官方表現示例（sample performance）與考評報告可逐題校準常見失分。內容只為衍生批改指引，未照搬任何試題原文或官方評分細則原句。',
}
