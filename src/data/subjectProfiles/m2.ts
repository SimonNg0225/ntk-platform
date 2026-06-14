import type { SubjectKnowledge } from './types'

// ============================================================
//  數學延伸部分單元二（M2：代數與微積分）
//  Mathematics Extended Part Module 2 (Algebra and Calculus) 科目知識檔案
//  ------------------------------------------------------------
//  公開試結構（現行 DSE，M2 只設一份試卷、無分卷、無校本評核）：
//    一份試卷 Paper（100%，2 小時 30 分）：全為傳統題（須列步驟）。
//      · 不分 Section A / B，全卷由一組必答題組成；
//      · 題目由較短 / 基礎到較長 / 較深、跨課題綜合題，難度遞升；
//      · 全卷總分 100；須作答全部題目（無選答）。
//    M2 屬延伸部分（Extended Part），與必修部分（Compulsory Part）分開
//    評級，自成一個科目等級（1–5**）。
//  批改鐵則（HKEAA marking scheme 慣例）：
//    · 方法分 M（method）— 用啱概念 / 公式 / 定理即使最終答案錯都應酌量畀；
//    · 答案分 A（accuracy）— 視乎前一步啱（follow-through, f.t.）；
//    · 證明題每一步要有理據；數學歸納法要齊「基礎步 + 歸納假設 + 歸納步 +
//      結論」四部，缺一扣分；「由此 / Hence」必須沿用上題結果；
//    · 微積分要分清「用定義求導」與「用法則求導」（題目指定用定義就唔可用法則）；
//    · 最後答案要按指定形式（surd / 最簡 / 帶絕對值常數 C）並酌量看表達。
//  本檔三個 strand 對齊官方 M2 課程內容（代數與微積分）：
//    基礎知識與代數（數學歸納法 / 二項式 / 三角 / 指對數與 e）、
//    矩陣行列式與向量、微積分（極限 / 微分 / 積分）。
//  提煉來源：HKEAA M2 數學課程及評估指引 / 評核大綱 + 公開 marking scheme
//  慣例（方法分 M / 答案分 A / 沿用前步 follow-through f.t.）+ DSE M2 批改
//  知識。官方考評報告（examiner report）/ 表現示例可逐題校準常見失分。
//  版權：本檔只屬衍生指引（準則 / 慣例 / 常見錯誤 / 命令詞 / 等級描述），
//  並無照搬 HKEAA 試題原文或官方 marking scheme 原句。
// ============================================================

const M2_PERSONA =
  '你係資深香港中學數學延伸部分單元二（M2：代數與微積分）評卷員，按 DSE Mathematics Extended Part Module 2 標準批改，重視方法分（M）同證明嚴謹：方法 / 概念 / 定理用啱，即使最終答案錯都應酌量畀 M 分；錯一步之後嘅步驟一般唔再畀分（follow-through 除外）；證明題每步要有理據、邏輯連貫，數學歸納法要四部齊全；「由此（Hence）」要沿用上題結果；最後答案要按指定形式（surd / 最簡 / 帶積分常數 C），中間數值唔好過早約簡。'

export const M2: SubjectKnowledge = {
  subject: 'm2',
  label: '數學延伸部分單元二 (M2：代數與微積分)',
  lang: 'zh',
  assessment: {
    papers: [
      '一份試卷 Paper（100%，2 小時 30 分，總分 100）：全為傳統題，須列出步驟。不分 Section A / B，全卷由一組必答題組成（無選答）；題目由較短 / 基礎到較長 / 較深、跨課題綜合，難度大致遞升。',
    ],
    weightings:
      'M2 只設一份試卷，佔該科 100%（無分卷、無校本評核）。屬延伸部分，與必修部分分開評級，自成一個科目等級 1–5**（七級）。',
    questionTypes: [
      '證明（數學歸納法）',
      '二項式定理（求係數 / 展開項）',
      '三角恒等式證明與方程',
      '指數 / 對數與 e 的運算',
      '矩陣與行列式（求逆 / 解線性方程組）',
      '向量（純量積 / 向量積 / 幾何應用）',
      '極限與用定義 / 法則求導',
      '微分應用（極值、變化率、曲線描繪）',
      '不定 / 定積分與面積、體積應用',
    ],
    sba: 'M2 無校本評核（SBA）。',
  },
  commandWords: [
    { word: '證明 / 試證（Prove）', meaning: '嚴謹逐步推導至要證的結論，每步要有理據 / 定理；數學歸納法要四部齊全。' },
    { word: '用數學歸納法證明', meaning: '必須寫「驗證 n=1（基礎步）→ 假設 n=k 成立 → 證 n=k+1 成立 → 下結論」四部，缺一扣分。' },
    { word: '由此 / 據此（Hence）', meaning: '必須沿用上一題 / 上一步結果作答，唔可另起爐灶重做；「Hence or otherwise」則可另法但用上文較穩陣。' },
    { word: '用定義求導 / 由首要原理（from first principles）', meaning: '須用導數極限定義 lim(h→0)[f(x+h)−f(x)]/h，唔可直接套用求導法則。' },
    { word: '求 / 計算（Find / Evaluate）', meaning: '計出值或表達式並列式；積分要寫積分常數 C（不定積分），定積分要代入上下限。' },
    { word: '化簡 / 表示成 … 形式（Simplify / Express in the form）', meaning: '化到最簡並嚴格按指定形式（如 a+b√c、最簡 surd、指定矩陣 / 向量形式）。' },
    { word: '證明 … 收斂 / 求極限（limit）', meaning: '要列出極限過程 / 用啱極限定律，唔可只寫答案；留意 0/0 等不定型要先化簡。' },
    { word: '準確至 N 位有效數字 / 小數', meaning: '最後一步先約簡；中間數值保留較多位，避免累積誤差。' },
  ],
  levelDescriptors: [
    { level: '高（5–5**）', descriptor: '概念 / 定理準確，方法有效率；證明嚴謹完整（歸納法四部齊、每步有理據）；求導 / 積分技巧運用純熟；答案準確、按指定形式；符號與步驟清晰標示。' },
    { level: '中（3–4）', descriptor: '大致正確，偶有運算 / 概念失誤；證明大致成立但偶有跳步或理據不足；求導 / 積分方法尚清晰；答案大致準確但偶漏積分常數 / 約簡不當。' },
    { level: '低（1–2）', descriptor: '概念 / 定理錯誤較多；證明結構殘缺（如歸納法漏步、無寫理據）；求導 / 積分法則誤用；答案多錯，指定形式 / 積分常數常漏。' },
  ],
  strands: [
    // ───────────────── 基礎知識與代數 ─────────────────
    {
      key: 'foundation-algebra',
      label: '基礎知識與代數（歸納法、二項式、三角、指對數）',
      persona: M2_PERSONA,
      areas: [
        {
          key: 'induction-binomial',
          label: '數學歸納法與二項式定理',
          keyConcepts: ['數學歸納法四部（基礎步 / 歸納假設 / 歸納步 / 結論）', '用於整除、求和、不等式命題', '二項式定理 (a+b)ⁿ 展開', '一般項 T(r+1)=C(n,r)aⁿ⁻ʳbʳ', '求指定項 / 係數 / 常數項', '組合符號 C(n,r) 運算'],
          markingConventions: ['歸納法四部要齊全，缺基礎步或結論扣分', '歸納步須明確用上歸納假設（標明「由假設」）方得 M 分', '二項式求項要先寫一般項再代 r', '答案按指定形式（如最簡係數）並列式'],
          commonErrors: ['歸納法漏驗證 n=1（基礎步）或漏寫結論', '歸納步無用到歸納假設、變相重新證一次', '二項式一般項 r 的位置 / 次方數錯（漏 a 的 n−r 次）', '求常數項時 x 的次方設定方程出錯', '組合 C(n,r) 與排列 P(n,r) 混淆'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '歸納法結構 / 二項式定理運用正確' },
            { criterion: '證明 / 步驟嚴謹', max: 5, focus: '四部齊全、用上假設、逐步有理據' },
            { criterion: '答案準確（含形式）', max: 3, focus: '正確項 / 係數、指定形式' },
            { criterion: '表達 / 標示', max: 2, focus: '符號清楚、結論明確' },
          ],
          issueTypes: ['concept', 'step', 'argument', 'calc'],
        },
        {
          key: 'trigonometry',
          label: '三角函數與恒等式',
          keyConcepts: ['弧度制與三角函數定義', '複合角 / 倍角 / 半角公式', '和差化積、積化和差', '三角恒等式證明', '解三角方程（一般解 / 指定範圍）', '三角函數圖像與週期性'],
          markingConventions: ['恒等式證明由一邊推到另一邊（或同化至中間式），唔可兩邊同時運算當證明', '解方程要顧及指定範圍內所有解', '用弧度時答案要用弧度（除非題目要求度數）', '所用公式要列出 / 可辨認'],
          commonErrors: ['恒等式證明「兩邊一齊郁」當作已證（邏輯倒果為因）', '解三角方程漏解（只取主值、漏週期解）', '倍角 / 半角公式記錯（cos2θ 三式選錯）', '弧度與度數混用', '解一般解時漏寫 +2kπ / +nπ 週期項（k, n 為整數）'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '公式選用 / 恒等式策略正確' },
            { criterion: '證明 / 步驟嚴謹', max: 5, focus: '單邊推導、逐步有理據' },
            { criterion: '答案準確（含形式）', max: 3, focus: '完整解集 / 指定形式' },
            { criterion: '表達 / 標示', max: 2, focus: '步驟清楚、單位（弧度 / 度）正確' },
          ],
          issueTypes: ['concept', 'argument', 'calc', 'method'],
        },
        {
          key: 'exp-log',
          label: '指數、對數與 e',
          keyConcepts: ['自然指數 eˣ 與自然對數 ln x', '指數定律 / 對數定律', '換底公式', 'e 的極限定義 lim(1+1/n)ⁿ', '指數 / 對數方程', '指對函數的圖像與性質'],
          markingConventions: ['化簡逐步、列出所用定律', '對數方程要檢查真數 > 0（捨去不合解）', '答案按指定形式（如以 ln 表示 / 最簡）', '涉 e 的極限要列極限過程'],
          commonErrors: ['對數定律誤用（如 ln(a+b)=ln a+ln b）', '指數方程兩邊取 log 時漏項', '對數方程漏檢查定義域、留低不合解', '換底公式用錯', 'e 與一般底數混淆（求導時尤甚）'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '指對定律運用正確' },
            { criterion: '步驟與運算', max: 5, focus: '化簡逐步無誤、定義域檢查' },
            { criterion: '答案準確（含形式）', max: 3, focus: '最簡 / 指定形式、捨不合解' },
            { criterion: '表達 / 標示', max: 2, focus: '步驟清楚' },
          ],
          issueTypes: ['concept', 'calc', 'step', 'method'],
        },
      ],
    },

    // ───────────────── 矩陣與向量 ─────────────────
    {
      key: 'matrices-vectors',
      label: '矩陣、行列式與向量',
      persona: M2_PERSONA,
      areas: [
        {
          key: 'matrices-determinants',
          label: '矩陣、行列式與線性方程組',
          keyConcepts: ['矩陣運算（加 / 減 / 乘 / 純量積）', '矩陣乘法不可交換（AB≠BA）', '行列式（2×2 / 3×3）', '逆矩陣 A⁻¹ = adj(A)/det(A)', '用逆矩陣 / 克萊瑪法則解線性方程組', '可逆條件（det ≠ 0）'],
          markingConventions: ['矩陣乘法要對位相乘、維度要相容', '求逆要先驗 det ≠ 0', '解方程組要寫清用逆矩陣定克萊瑪法則', '答案矩陣 / 解要完整寫出每個分量'],
          commonErrors: ['矩陣乘法當可交換（寫成 AB=BA）', '矩陣乘法對位 / 維度出錯', '行列式（尤 3×3）展開符號錯（+−+ 棋盤格）', '求逆漏除以 det 或 adj(A) 轉置出錯', '無驗 det=0 即話有唯一解'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '矩陣 / 行列式運算規則正確' },
            { criterion: '步驟與運算', max: 5, focus: '對位相乘、行列式 / 求逆逐步無誤' },
            { criterion: '答案準確', max: 3, focus: '正確矩陣 / 完整解' },
            { criterion: '表達 / 標示', max: 2, focus: '分量標示清楚' },
          ],
          issueTypes: ['concept', 'calc', 'method', 'step'],
        },
        {
          key: 'vectors',
          label: '向量及其應用',
          keyConcepts: ['向量的模、單位向量、分量表示（2D / 3D，i j k）', '純量積（dot product）與夾角', '向量積（cross product）與面積 / 法向量', '純量三積（scalar triple product）與平行六面體體積', '向量的線性組合與共線 / 共面', '向量幾何應用（分點、平行四邊形、三角形）'],
          markingConventions: ['純量積 a·b = |a||b|cosθ 求角要列式', '向量積 |a×b| 用於平行四邊形面積 / 三角形面積（取一半）', '證共線 / 共面要寫出線性關係', '答案向量要寫齊分量、模要帶正號'],
          commonErrors: ['純量積與向量積混淆（一個出純量、一個出向量）', '求夾角忘記 cosθ = a·b/(|a||b|)、漏除模', '三角形面積漏乘 ½', '向量積方向 / 右手定則出錯', '位置向量與方向向量混淆'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '純量積 / 向量積選用正確' },
            { criterion: '步驟與運算', max: 5, focus: '分量運算、求模 / 角逐步無誤' },
            { criterion: '答案準確（含形式）', max: 3, focus: '正確向量 / 數值、面積 ½ 不漏' },
            { criterion: '表達 / 標示', max: 2, focus: '向量符號 / 分量清楚' },
          ],
          issueTypes: ['concept', 'calc', 'method', 'step'],
        },
      ],
    },

    // ───────────────── 微積分 ─────────────────
    {
      key: 'calculus',
      label: '微積分（極限、微分、積分）',
      persona: M2_PERSONA,
      areas: [
        {
          key: 'limits-differentiation',
          label: '極限與求導法',
          keyConcepts: ['極限概念與極限定律', '不定型（0/0 等）化簡求極限', '導數定義（首要原理）', '求導法則（和差積商、鏈式法則）', '隱函數 / 參數式求導', '對數求導法、e^x 與 ln x 的導數'],
          markingConventions: ['題目指定「用定義 / 首要原理」就必須用極限定義，唔可用法則', '鏈式 / 積商法則要逐層展開、可辨認', '隱函數求導要對 y 視為 x 的函數（帶 dy/dx）', '中間極限過程要列出'],
          commonErrors: ['題目要求用定義求導但直接套法則（不得分）', '商法則分子次序錯（u′v−uv′ 寫反）', '鏈式法則漏乘內函數導數', '隱函數求導漏 dy/dx', '不定型未化簡即代入得 0/0'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '極限定律 / 求導法則選用正確' },
            { criterion: '步驟與運算', max: 5, focus: '定義 / 法則逐步無誤、保留精度' },
            { criterion: '答案準確（含形式）', max: 3, focus: '正確導數 / 極限、最簡' },
            { criterion: '表達 / 標示', max: 2, focus: 'dy/dx 等符號清楚' },
          ],
          issueTypes: ['concept', 'method', 'calc', 'step'],
        },
        {
          key: 'differentiation-applications',
          label: '導數的應用（極值、變化率、曲線描繪）',
          keyConcepts: ['切線與法線方程', '極大 / 極小值（一階 / 二階導數判別）', '拐點與凹凸性', '單調性（遞增 / 遞減區間）', '相關變化率（related rates）', '曲線描繪（漸近線 / 截距 / 極值）'],
          markingConventions: ['判極值要講清用一階變號定二階導數測試', '要明確指出最大定最小 + 對應 x / y 值', '相關變化率要先建立變量關係再對時間求導', '曲線描繪要標關鍵點 / 漸近線'],
          commonErrors: ['搵到臨界點但無判別最大 / 最小（漏測試）', '二階導數測試結論寫反（f″>0 為極小）', '相關變化率漏對時間 t 求導 / 漏鏈式', '切線與法線斜率關係（負倒數）搞錯', '漸近線（垂直 / 水平）漏求'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '極值 / 變化率方法選用正確' },
            { criterion: '步驟與運算', max: 5, focus: '求導、判別逐步無誤' },
            { criterion: '答案準確（含結論）', max: 3, focus: '正確極值 + 最大 / 最小判定' },
            { criterion: '表達 / 標示', max: 2, focus: '圖示 / 關鍵點標示清楚' },
          ],
          issueTypes: ['concept', 'method', 'calc', 'step'],
        },
        {
          key: 'integration',
          label: '積分及其應用（面積 / 體積）',
          keyConcepts: ['不定積分（基本公式 + 積分常數 C）', '換元積分（substitution）', '分部積分（integration by parts）', '定積分與微積分基本定理', '定積分求面積（曲線與軸 / 曲線間）', '旋轉體體積（繞 x 軸 / y 軸，圓盤法）'],
          markingConventions: ['不定積分必寫積分常數 C，漏寫扣表達 / 答案分', '換元要連同 dx 一齊換、定積分換元要換上下限', '定積分代入上下限相減要寫清', '求面積要視乎曲線在軸上下（取絕對值 / 分段）'],
          commonErrors: ['不定積分漏寫 +C', '換元積分漏換 dx 或定積分漏換上下限', '分部積分 u / dv 選錯致愈積愈複雜', '面積題漏理會曲線在 x 軸下方（負面積）', '微積分基本定理上下限代入次序錯（上減下）'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '積分技巧（換元 / 分部）選用正確' },
            { criterion: '步驟與運算', max: 5, focus: '積分逐步無誤、上下限處理' },
            { criterion: '答案準確（含 C / 單位）', max: 3, focus: '正確積分值、+C 不漏、面積正確' },
            { criterion: '表達 / 標示', max: 2, focus: '步驟清楚、區間標示' },
          ],
          issueTypes: ['concept', 'method', 'calc', 'step'],
        },
      ],
    },
  ],
  publicResources: [
    { label: 'HKEAA 數學（延伸部分 單元二 M2）科目資訊（官方：課程評估 / 樣本試題 / 評核大綱）', url: 'https://www.hkeaa.edu.hk/en/HKDSE/assessment/subject_information/category_a_subjects/m2/' },
    { label: 'HKEAA HKDSE 科目資訊總頁（如上連結失效時查 M2）', url: 'https://www.hkeaa.edu.hk/en/hkdse/assessment/subject_information/' },
    { label: 'EDB 數學教育（延伸部分課程及評估指引 / 學與教資源）', url: 'https://www.edb.gov.hk/en/curriculum-development/kla/ma/index.html' },
    { label: 'DSE Treasure — M2 歷屆試題（按課題分類 + marking）', url: 'https://dsetreasure.com/dse-m2-past-paper/' },
  ],
  source:
    '提煉自 HKEAA M2（數學延伸部分單元二：代數與微積分）課程及評估指引 / 評核大綱（一份試卷 100%、2 小時 30 分、無 SBA、與必修部分分開呈報）+ 公開 marking scheme 慣例（方法分 M / 答案分 A / 沿用前步 follow-through f.t.）+ DSE M2 批改知識（數學歸納法四部、用定義求導、積分常數 C、向量純量積 / 向量積分辨）。官方考評報告（examiner report）與表現示例可逐題校準常見失分。',
}
