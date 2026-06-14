import type { SubjectKnowledge } from './types'

// ============================================================
//  數學（必修部分）Mathematics Compulsory Part 科目知識檔案
//  ------------------------------------------------------------
//  公開試結構：
//    卷一 Paper 1（65%，2h15m）：傳統長題。Section A(1)（淺，約 35 分）
//      + Section A(2)（約 35 分）+ Section B（較深，約 35 分），須列步驟。
//    卷二 Paper 2（35%，1h15m）：45 條 MC（Section A 30 + Section B 15）。
//  批改鐵則（HKEAA marking scheme 慣例）：
//    · 方法分 M（method）— 用啱概念 / 公式即使答案錯都應畀；
//    · 答案分 A（accuracy）— 視乎前一步啱（follow-through, f.t.）；
//    · 錯一步之後嘅步驟一般唔再畀分（數學係逐步邏輯推導）；
//    · 「r.」= 接受可約成…嘅答案；最後答案要帶單位 / 按指定形式
//      （surd / N 位有效數字），格式 / 單位錯酌量扣表達分。
//  三範疇對齊評核大綱：數與代數 / 度量、圖形與空間 / 數據處理。
//  提煉來源：HKEAA 數學課程及評估指引 / 評核大綱 + 公開 marking scheme
//  慣例（M/A/f.t./r.）+ DSE 數學批改知識。官方考評報告可逐題校準。
// ============================================================

const MATH_PERSONA =
  '你係資深香港中學數學科（必修部分）評卷員，按 DSE Mathematics (Compulsory Part) 標準批改，重視方法分（M）同答案分（A）：方法 / 概念啱，即使最終答案錯都應酌量畀 M 分；錯一步之後嘅步驟一般唔再畀分（follow-through 除外）；最後答案要帶單位 / 按指定形式（surd / N 位有效數字），中間數值唔好過早約簡。'

export const MATH: SubjectKnowledge = {
  subject: 'math',
  label: '數學（必修部分）',
  lang: 'zh',
  assessment: {
    papers: [
      '卷一 Paper 1（65%，2 小時 15 分）：傳統長題，須列步驟。Section A(1)（淺易，約 35 分）+ Section A(2)（約 35 分）+ Section B（較深，約 35 分）。',
      '卷二 Paper 2（35%，1 小時 15 分）：45 條選擇題（Section A 30 條 + Section B 15 條），每題等分。',
    ],
    weightings: '卷一 65% · 卷二 35%。等級 1–5**（七級）。',
    questionTypes: ['化簡 / 求值', '解方程 / 不等式', '證明（幾何 / 三角恒等式）', '應用題（情境 + 列式）', '坐標 / 立體幾何', '統計圖表分析', '概率 / 排列組合', '選擇題（MC）'],
    sba: '數學（必修）無校本評核。',
  },
  commandWords: [
    { word: '解 / 求', meaning: '計出數值或解集，要列式（先有步驟才有方法分）。' },
    { word: '證明 / 試證', meaning: '嚴謹逐步推導，每步要有理由 / 定理；幾何要寫明所用性質。' },
    { word: '由此（Hence）', meaning: '必須用上一題 / 上一步結果作答，唔可另起爐灶重做。' },
    { word: '化簡', meaning: '化到最簡（指數 / 對數 / surd），並按指定形式表達。' },
    { word: '準確至 N 位有效數字 / 小數', meaning: '最後一步先約簡；中間數值保留較多位，避免累積誤差。' },
    { word: '寫成 … 形式（Express in the form）', meaning: '嚴格按指定形式作答（如 a + b√c、(x+h)²+k）。' },
    { word: '列出計算 / 步驟', meaning: '要展示推導過程；只寫答案一般得唔到方法分。' },
  ],
  levelDescriptors: [
    { level: '高（5–5**）', descriptor: '概念準確、方法有效率；步驟完整嚴謹；答案準確、單位 / 指定形式正確；表達清晰、標示清楚。' },
    { level: '中（3–4）', descriptor: '大致正確，偶有運算 / 概念失誤；步驟尚清晰；答案大致準確但偶漏單位 / 約簡不當。' },
    { level: '低（1–2）', descriptor: '概念 / 方法錯誤較多；步驟跳缺難追；答案多錯，格式 / 單位常漏。' },
  ],
  strands: [
    // ───────────────── 數與代數 ─────────────────
    {
      key: 'algebra',
      label: '數與代數',
      persona: MATH_PERSONA,
      areas: [
        {
          key: 'equations-functions',
          label: '方程、不等式與函數圖像',
          keyConcepts: ['二次方程（公式法 / 因式 / 配方）', '判別式與根的性質（根與係數關係）', '聯立方程（一線一二次）', '二次函數圖像（頂點 / 對稱軸 / 極值 / 平移）', '二次不等式（圖像法）'],
          markingConventions: ['用正確方法 / 公式即可得 M 分', '判別式 / 根與係數要列式', '極值要講最大定最小 + 對應 x', '按指定形式（如配方）作答'],
          commonErrors: ['判別式符號 / 條件用錯', '漏負根或重根', '配方 / 頂點公式計錯', '不等式方向搞錯（負數乘除）', '圖像平移方向相反'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '正確方法、公式選用' },
            { criterion: '步驟與運算', max: 4, focus: '逐步無誤、follow-through' },
            { criterion: '答案準確（含形式）', max: 3, focus: '正確值 / 指定形式' },
            { criterion: '表達 / 標示', max: 2, focus: '符號清楚、結論明確' },
          ],
          issueTypes: ['concept', 'calc', 'step', 'equation'],
        },
        {
          key: 'indices-surds-logs',
          label: '指數、對數、多項式與數列',
          keyConcepts: ['指數定律 / 對數定律', 'surd 化簡與有理化', '多項式（餘式定理 / 因式定理 / 長除）', '恒等式', '等差 / 等比數列（通項、求和）'],
          markingConventions: ['化簡逐步、列出所用定律', '按指定形式（a+b√c）作答', '數列要分清項數 n 與公差 / 公比'],
          commonErrors: ['log / 指數定律誤用（log(a+b)）', 'surd 未化到最簡 / 有理化錯', '餘式定理代入值錯', 'AP/GP 公式項數 n 混淆', '等比求和公比 r 條件忽略'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '定律 / 定理運用正確' },
            { criterion: '步驟與運算', max: 4, focus: '化簡逐步無誤' },
            { criterion: '答案準確（含形式）', max: 3, focus: '最簡 / 指定形式' },
            { criterion: '表達 / 標示', max: 2, focus: '步驟清楚' },
          ],
          issueTypes: ['concept', 'calc', 'step', 'method'],
        },
        {
          key: 'variations',
          label: '變分（Variations）',
          keyConcepts: ['正變 y = kx（y ∝ x）', '反變 y = k/x（y ∝ 1/x）', '聯變 z = kxy（多變量）', '部分變 y = k₁ + k₂x（常數項 + 變動項）', '求比例常數 k', '量的倍數變化（x 變 n 倍 → y 點變）'],
          markingConventions: ['先寫出變分式並引入常數 k 方得 M 分', '代入已知條件解 k 要列式', '部分變要設兩項（如 y = a + bx）並用兩組數據聯立解', '答新值要帶單位 / 按指定形式'],
          commonErrors: ['反變當正變（寫成 y = kx 而非 y = k/x）', '聯變漏變量或漏次方（如 z 與 x² 聯變）', '部分變只設一項、唔識設「常數 + 變動」兩項', '倍數變化計錯（如 y ∝ x²，x 變 3 倍應 y 變 9 倍）', '漏寫比例常數 k 當相等'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '變分式 / 常數 k 設立正確' },
            { criterion: '步驟與運算', max: 4, focus: '解 k、代入無誤' },
            { criterion: '答案準確（含形式）', max: 3, focus: '正確新值 / 指定形式' },
            { criterion: '表達 / 標示', max: 2, focus: '步驟清楚' },
          ],
          issueTypes: ['concept', 'calc', 'method', 'step'],
        },
        {
          key: 'percentages-applications',
          label: '百分法的應用',
          keyConcepts: ['單利息 / 複利息（期數 n、複利頻率）', '增長率與折舊（升值 / 貶值）', '連續百分變化（逐期相乘）', '成本 / 售價 / 標價 / 折扣 / 盈虧 / 利潤率', '稅項與簡單財務應用'],
          markingConventions: ['複利公式 A = P(1 + r)ⁿ 要列式、講清 n 同每期利率', '增長後折舊要用啱基數（前一期結果，唔係原值）', '連續百分變化用相乘唔係相加'],
          commonErrors: ['複利息期數 n 算錯（年 / 半年 / 季混淆）', '增長後再折舊用錯基數', '百分變化逐期相加而非相乘', '盈虧分母（成本價 vs 售價）搞錯', '單利當複利（或相反）'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '公式 / 基數選用正確' },
            { criterion: '步驟與運算', max: 4, focus: '逐期計算無誤' },
            { criterion: '答案準確（含單位）', max: 3, focus: '正確金額 / 百分率' },
            { criterion: '表達 / 標示', max: 2, focus: '步驟清楚' },
          ],
          issueTypes: ['concept', 'calc', 'method', 'step'],
        },
      ],
    },

    // ───────────── 度量、圖形與空間（幾何與三角）─────────────
    {
      key: 'geometry',
      label: '度量、圖形與空間',
      persona: MATH_PERSONA,
      areas: [
        {
          key: 'mensuration-coordinate',
          label: '量度與坐標幾何',
          keyConcepts: ['量度的誤差（絕對 / 相對 / 百分誤差）、最大絕對誤差（= 最小刻度一半）與上下限', '立體的面積 / 體積（柱 / 錐 / 球）', '相似立體（長度 / 面積 / 體積比）', '直線（斜率 / 方程 / 距離 / 中點）', '圓的方程（配方求圓心半徑）', '直線與圓相交 / 相切'],
          markingConventions: ['答案要帶單位（cm² / cm³…）', '量度誤差題分清絕對 / 相對 / 百分誤差', '體積 / 面積公式要列出', '圓與直線相交解聯立、考慮判別式（相切 / 兩解 / 無解）'],
          commonErrors: ['漏單位 / 單位錯', '最大絕對誤差誤取整個最小刻度（應為一半）', '相對誤差與百分誤差混淆（百分誤差 = 相對誤差 × 100%）', '相似立體比例（k : k² : k³）混淆', '圓方程配方計錯圓心 / 半徑', '漏第二個交點'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '公式 / 性質選用正確' },
            { criterion: '步驟與運算', max: 4, focus: '逐步無誤' },
            { criterion: '答案準確（含單位）', max: 3, focus: '正確值 + 單位' },
            { criterion: '表達 / 標示', max: 2, focus: '圖示 / 標示清楚' },
          ],
          issueTypes: ['concept', 'calc', 'unit', 'step'],
        },
        {
          key: 'trigonometry',
          label: '三角學（含 2D / 3D 應用）',
          keyConcepts: ['三角比與恒等式', '正弦 / 餘弦定律、三角形面積', '2D / 3D 應用題', '線與面、面與面的夾角', '方位角 / 仰俯角'],
          markingConventions: ['計算機角度模式（degree）要正確', '正弦定律留意歧義情況（鈍角解）', '3D 題要指出 / 標明所求角', '中間值唔好過早約簡'],
          commonErrors: ['計算機模式錯（rad / deg）', '正弦定律歧義漏第二解', '3D 認錯所求夾角', '過早約簡致最終答案誤差', '仰角 / 俯角混淆'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '定律 / 角的識別正確' },
            { criterion: '步驟與運算', max: 4, focus: '逐步無誤、保留精度' },
            { criterion: '答案準確（含形式）', max: 3, focus: '正確值 / 約簡恰當' },
            { criterion: '表達 / 標示', max: 2, focus: '圖示 / 角度標示' },
          ],
          issueTypes: ['concept', 'calc', 'step', 'method'],
        },
        {
          key: 'circle-locus',
          label: '圓的性質與軌跡',
          keyConcepts: ['圓的性質（圓心角 / 圓周角 / 圓內接四邊形 / 切線）', '幾何證明（寫明所用定理）', '軌跡（locus）描述與方程'],
          markingConventions: ['證明每步要列明所用圓的性質 / 定理', '軌跡要描述清楚（點集條件）並可寫出方程', '結論要扣返要證的命題'],
          commonErrors: ['亂用 / 用錯圓的性質', '證明跳步、無寫理由', '切線性質（切線⊥半徑）忽略', '軌跡描述含糊 / 方程錯'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '性質 / 定理選用正確' },
            { criterion: '證明步驟', max: 4, focus: '每步有理由、邏輯連貫' },
            { criterion: '結論 / 軌跡準確', max: 3, focus: '扣命題 / 正確方程' },
            { criterion: '表達 / 標示', max: 2, focus: '符號 / 圖示清楚' },
          ],
          issueTypes: ['concept', 'argument', 'step', 'method'],
        },
      ],
    },

    // ───────────── 數據處理（統計與概率）─────────────
    {
      key: 'stats',
      label: '數據處理',
      persona: MATH_PERSONA,
      areas: [
        {
          key: 'data-dispersion',
          label: '統計圖表與離差',
          keyConcepts: ['集中趨勢（平均數 / 中位數 / 眾數）', '離差（全距 / 四分位距 / 方差 / 標準差）', '盒鬚圖、累積頻率曲線、百分位數', '數據變換對平均 / 標準差的影響', '標準分（standard score）'],
          markingConventions: ['讀圖 / 數據要準確', '數據變換：加常數 vs 乘常數對標準差影響不同', '中位數位置（n 偶數取兩數平均）', '離群值處理講清楚'],
          commonErrors: ['中位數位置算錯（n 偶數）', '加常數誤以為改變標準差（其實不變）', '盒鬚圖五數搞錯', '累積頻率讀錯百分位', '方差 / 標準差公式混淆'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '統計量定義正確' },
            { criterion: '讀圖 / 運算', max: 4, focus: '讀數準確、計算無誤' },
            { criterion: '答案準確', max: 3, focus: '正確值 / 詮釋' },
            { criterion: '表達 / 標示', max: 2, focus: '單位 / 詮釋清楚' },
          ],
          issueTypes: ['concept', 'calc', 'data', 'step'],
        },
        {
          key: 'probability-counting',
          label: '概率與排列組合',
          keyConcepts: ['概率（加法 / 乘法律、互斥 vs 獨立、補集）', '條件概率（列舉情況）', '排列 P(n,r) / 組合 C(n,r)、計數原理', '有放回 vs 無放回'],
          markingConventions: ['列出所有情況 或 用 1−P(補集)', '判斷排列定組合（次序是否重要）', '有放回 / 無放回要分清', '互斥與獨立唔可混用公式'],
          commonErrors: ['互斥 vs 獨立混淆（用錯公式）', '有放回 vs 無放回搞錯', '排列當組合（或相反）', '重複計數 / 漏情況', '補集概率計錯'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '概率 / 計數模型正確' },
            { criterion: '步驟與運算', max: 4, focus: '列舉完整、計算無誤' },
            { criterion: '答案準確', max: 3, focus: '正確概率 / 數值' },
            { criterion: '表達 / 標示', max: 2, focus: '情況列舉清楚' },
          ],
          issueTypes: ['concept', 'calc', 'method', 'step'],
        },
      ],
    },
  ],
  publicResources: [
    { label: 'HKEAA 數學 科目資訊（官方：課程評估 / 樣本試題 / 評核大綱）', url: 'https://www.hkeaa.edu.hk/tc/HKDSE/assessment/subject_information/category_a_subjects/math/' },
    { label: 'HKEAA 數學 評核大綱 Assessment Framework（官方 PDF）', url: 'https://www.hkeaa.edu.hk/DocLibrary/HKDSE/Subject_Information/math/2026hkdse-e-math.pdf' },
    { label: 'DSE Treasure — 數學歷屆試題（按課題分類 + marking）', url: 'https://dsetreasure.com/dse-math-past-paper/' },
    { label: 'notesity — DSE 數學歷年 cut-off / 課題重點', url: 'https://www.notesity.hk/blog/posts/dse-maths-compulsory-part-cut-off-score' },
  ],
  source:
    '提煉自 HKEAA 數學課程及評估指引 / 評核大綱（卷一 65% 長題 + 卷二 35% MC）+ 公開 marking scheme 慣例（方法分 M / 答案分 A / follow-through f.t. / 約簡 r.）+ DSE 數學批改知識。官方考評報告（examiner report）可逐題校準常見失分。',
}
