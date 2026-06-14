import type { SubjectKnowledge } from './types'

// ============================================================
//  數學延伸部分單元一（M1：微積分與統計）
//  Mathematics Extended Part Module 1 (Calculus and Statistics)
//  科目知識檔案 Subject Knowledge Profile
//  ------------------------------------------------------------
//  公開試結構（現行 DSE，M1 只設一份試卷）：
//    唯一試卷（傳統題型，須列步驟）：佔該延伸單元 100%，考試時間 2.5 小時。
//      Section A（約 50 分）：較淺易短題，覆蓋全課程；
//      Section B（約 55 分）：較深、跨課題綜合長題（全卷約 105 分）。
//      M1 / M2 為「數學科延伸部分」二選一選修；數學科分必修部分與延伸部分，
//      合計為一科但分開呈報：延伸單元自成一個科目級別（1–5**），
//      不設選擇題（MC），不設校本評核（SBA）。
//  內容範圍（微積分與統計）：二項式 / 指數與對數函數 / 微分與積分及其應用 /
//      概率分佈（二項、泊松、幾何、常態）/ 抽樣與推斷統計（信賴區間）。
//  批改鐵則（HKEAA marking scheme 慣例）：
//    · 方法分 M（method）— 用啱概念 / 公式 / 求導 / 積分 / 分佈即使
//      最終答案錯，都應酌量畀；
//    · 答案分 A（accuracy）— 視乎前一步啱（follow-through, f.t.）；
//    · 錯一步之後嘅步驟一般唔再畀分（數學係逐步邏輯推導）；
//    · 「r.」= 接受可約成…嘅等價答案；統計題概率 / 機率值通常準確至
//      3–4 位有效數字或小數，中間值唔好過早約簡；
//    · 答案要帶單位 / 按指定形式，定積分上下限、dx、+C 等記法要齊。
//  兩範疇對齊評核大綱：微積分（含基礎二項式）/ 統計（概率與統計推斷）。
//  提煉來源：HKEAA 數學課程及評估指引（延伸部分單元一）/ 評核大綱 +
//  公開 marking scheme 慣例（M / A / f.t. / r.）+ DSE M1 批改知識。
//  版權聲明：本檔只屬衍生指引（準則 / 慣例 / 常見錯誤 / 命令詞 / 等級描述），
//  並無照搬任何 HKEAA 試題原文或官方評卷準則原句；官方考評報告
//  （examiner report）及表現示例可用作逐題校準。
// ============================================================

const M1_PERSONA =
  '你係資深香港中學數學延伸部分單元一（M1：微積分與統計）評卷員，按 DSE Mathematics Extended Part Module 1 標準批改，重視方法分（M）同答案分（A）：選對方法 / 公式 / 求導 / 積分 / 概率分佈即使最終答案錯都應酌量畀 M 分；錯一步之後嘅步驟一般唔再畀分（follow-through 除外）；統計機率值準確至指定有效數字、中間值唔好過早約簡；定積分要寫上下限、+C、dx 等記法，最後答案帶單位 / 按指定形式。'

export const M1: SubjectKnowledge = {
  subject: 'm1',
  label: '數學延伸部分單元一 (M1：微積分與統計)',
  lang: 'zh',
  assessment: {
    papers: [
      '唯一試卷（傳統題型，須列步驟），考試時間 2.5 小時，佔該延伸單元 100%。Section A（約 50 分）較淺易短題、覆蓋全課程；Section B（約 55 分）較深、跨課題綜合長題（全卷約 105 分）。',
    ],
    weightings: 'M1 只設一份試卷，佔該延伸單元 100%，不設校本評核（SBA）。屬數學科延伸部分，與 M2 二選一；數學科分必修部分與延伸部分，合計為一科但分開呈報，延伸單元自成科目級別 1–5**（共七級：1、2、3、4、5、5*、5**）。',
    questionTypes: ['二項式展開 / 求係數', '求極限 / 求導（含乘積、商、鏈式、隱函數）', '導數應用（極值、變化率、曲線描繪）', '不定 / 定積分與積分應用（面積、體積）', '指數 / 對數 / 三角函數的微積分', '條件概率 / 貝氏定理 / 樹形圖', '概率分佈（二項 / 泊松 / 幾何 / 常態）求機率', '統計推斷（抽樣分佈、點估計、信賴區間）', '情境應用題（建立模型 + 詮釋結果）'],
    sba: 'M1 不設校本評核（SBA）。',
  },
  commandWords: [
    { word: '求 / 計算（Find / Evaluate）', meaning: '計出數值或表達式，要列式（先有步驟才有方法分）；定積分要顯示上下限代入。' },
    { word: '由此（Hence）', meaning: '必須用上一題 / 上一步結果作答，唔可另起爐灶重做，否則扣方法分。' },
    { word: '證明 / 試證（Prove / Show that）', meaning: '逐步推導至指定結果，每步有理由；最後一行要扣返要證嘅式，唔可只湊到答案。' },
    { word: '求…的近似值 / 準確至 N 位（Correct to N…）', meaning: '最後一步先約簡；中間數值、機率值保留較多位，避免累積誤差。' },
    { word: '解釋 / 詮釋（Explain / Interpret）', meaning: '用情境語言講出數值意義（如變化率、信賴區間、機率代表咩），唔淨係寫數字。' },
    { word: '描繪 / 草繪（Sketch）', meaning: '畫出曲線大致形狀，標明極值、拐點、漸近線、軸截距等關鍵特徵。' },
    { word: '列出計算 / 步驟（Show your working）', meaning: '要展示推導過程；只寫答案一般得唔到方法分。' },
    { word: '寫成 … 形式（Express in the form）', meaning: '嚴格按指定形式作答（如 a + b ln x、標準化為 Z 分數）。' },
  ],
  levelDescriptors: [
    { level: '高（5–5**）', descriptor: '概念準確、選用方法有效率；求導 / 積分 / 分佈運用嚴謹完整；機率值準確、按指定有效數字；情境詮釋到位；記法（+C、上下限、dx、單位）齊全，表達清晰。' },
    { level: '中（3–4）', descriptor: '大致正確，偶有運算 / 概念失誤；步驟尚清晰但偶有跳步；機率值大致準確但偶漏約簡 / 記法；情境詮釋略嫌簡略。' },
    { level: '低（1–2）', descriptor: '概念 / 方法錯誤較多（如分佈用錯、求導規則混淆）；步驟跳缺難追；機率值多錯、過早約簡；記法 / 單位常漏，少有詮釋。' },
  ],
  strands: [
    // ───────────────── 微積分（含基礎二項式）─────────────────
    {
      key: 'calculus',
      label: '微積分',
      persona: M1_PERSONA,
      areas: [
        {
          key: 'foundation-binomial',
          label: '基礎知識與二項式定理',
          keyConcepts: ['二項式定理（正整數指數）展開 (a + b)ⁿ', '一般項與指定項係數', 'e 的近似與自然指數概念', '函數記法、複合函數', '為微積分作準備的代數操作（指數 / 對數律）'],
          markingConventions: ['用二項式定理列出一般項 C(n,r)aⁿ⁻ʳbʳ 方得 M 分', '求指定項要寫清 r 值的求法', '係數題要分清「項」與「係數」（含符號）', '展開式按升 / 降冪有序排列'],
          commonErrors: ['一般項指數配錯（n−r 與 r 調轉）', '漏負號 / 漏係數內的常數次方（如 (2x)ʳ 漏 2ʳ）', '求係數時連同 x 的次方一齊當答案', '組合數 C(n,r) 計錯', '指定項 r 值取錯（差一）'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '二項式定理 / 一般項設立正確' },
            { criterion: '步驟與運算', max: 4, focus: '逐項展開、組合數無誤' },
            { criterion: '答案準確（含形式）', max: 3, focus: '正確項 / 係數（含符號）' },
            { criterion: '表達 / 標示', max: 2, focus: '升降冪有序、記法清楚' },
          ],
          issueTypes: ['concept', 'calc', 'step', 'method'],
        },
        {
          key: 'limits-differentiation',
          label: '極限與求導',
          keyConcepts: ['導數作為極限 / 變化率的直觀概念', '冪函數求導', '求導法則（乘積、商、鏈式）', '隱函數求導', '指數函數 eˣ 與對數函數 ln x 求導（M1 不含三角函數微積分）', '高階導數（如二階導數判別極值）'],
          markingConventions: ['乘積 / 商 / 鏈式法則要顯示應用過程方得 M 分', '隱函數求導對 y 要乘 dy/dx', 'eˣ、ln x 及其複合函數求導要顯示鏈式步驟', '化簡導數至合理形式'],
          commonErrors: ['鏈式法則漏乘內函數導數', '商法則分子兩項次序 / 符號錯', '隱函數求導漏 dy/dx', 'ln 與指數求導混淆（如 d/dx eˣ vs xⁿ）', '誤用三角函數導數（屬 M2 內容，M1 不考）'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '求導法則選用正確' },
            { criterion: '步驟與運算', max: 4, focus: '逐步求導、follow-through' },
            { criterion: '答案準確（含形式）', max: 3, focus: '正確導數 / 化簡恰當' },
            { criterion: '表達 / 標示', max: 2, focus: '記法（dy/dx）清楚' },
          ],
          issueTypes: ['concept', 'calc', 'step', 'method'],
        },
        {
          key: 'differentiation-applications',
          label: '導數的應用',
          keyConcepts: ['極大 / 極小值（一階 / 二階導數判別）', '增減區間與凹凸 / 拐點', '曲線描繪（漸近線、截距）', '變化率與相關變率（related rates）', '切線與法線方程', '最優化情境應用題'],
          markingConventions: ['求極值要驗證係極大定極小（講明判別準則）', '變化率題要建立變量關係再對時間求導', '最優化要交代定義域 / 端點考慮', '答案要帶單位、按情境詮釋'],
          commonErrors: ['只令 dy/dx = 0 而無判別極大 / 極小', '相關變率漏對 t 求導 / 漏鏈式', '最優化漏驗證係最大 / 最小（端點）', '切線斜率與法線斜率混淆（負倒數）', '漏單位 / 答案無扣返情境'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '極值 / 變率模型正確' },
            { criterion: '步驟與運算', max: 4, focus: '求導、解方程無誤' },
            { criterion: '應用 / 詮釋（含單位）', max: 3, focus: '判別極值、情境意義' },
            { criterion: '表達 / 標示', max: 2, focus: '結論明確、標示清楚' },
          ],
          issueTypes: ['concept', 'calc', 'application', 'unit'],
        },
        {
          key: 'integration',
          label: '積分與其應用',
          keyConcepts: ['不定積分（含 +C）與基本積分公式', '代換積分法（substitution）', '定積分及其幾何意義', '面積（曲線與軸 / 兩曲線之間）', '指數函數 eˣ 與 1/x 的積分（M1 不含三角函數積分）', '積分求總量 / 由變化率還原原函數'],
          markingConventions: ['不定積分必寫常數 +C，否則扣表達 / 答案分', '代換要寫明 u 及 du、並換上下限或還原變量', '定積分要顯示上下限代入相減', '面積題負值要處理（取絕對值 / 分段）'],
          commonErrors: ['不定積分漏 +C', '代換後忘記換上下限（或忘記還原 x）', '定積分上下限代入次序錯（上減下）', '面積題出現負面積未處理', '積分公式與求導公式混淆（如 ∫1/x dx）'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '積分技巧 / 公式選用正確' },
            { criterion: '步驟與運算', max: 4, focus: '代換 / 上下限代入無誤' },
            { criterion: '答案準確（含形式）', max: 3, focus: '正確值 / +C / 面積' },
            { criterion: '表達 / 標示', max: 2, focus: '記法（dx、上下限）齊全' },
          ],
          issueTypes: ['concept', 'calc', 'step', 'equation'],
        },
      ],
    },

    // ───────────────── 統計（概率與統計推斷）─────────────────
    {
      key: 'statistics',
      label: '統計',
      persona: M1_PERSONA,
      areas: [
        {
          key: 'probability',
          label: '概率基礎與條件概率',
          keyConcepts: ['加法 / 乘法律、互斥 vs 獨立、補集', '條件概率 P(A|B)', '貝氏定理（Bayes）', '樹形圖與列舉', '全概率公式', '有放回 vs 無放回'],
          markingConventions: ['條件概率要寫定義式 P(A|B) = P(A∩B)/P(B) 方得 M 分', '貝氏定理 / 全概率要列出各分支機率', '互斥與獨立唔可混用公式', '樹形圖各枝機率相乘、各路徑相加'],
          commonErrors: ['互斥 vs 獨立混淆（用錯加法 / 乘法）', '條件概率分母揀錯（P(B) vs P(A)）', '貝氏定理分母漏全概率（漏某分支）', '有放回 / 無放回搞錯', '補集概率算錯（1 − P 用錯事件）'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '概率模型 / 條件概率正確' },
            { criterion: '步驟與運算', max: 4, focus: '列舉 / 樹形圖完整無誤' },
            { criterion: '答案準確（含詮釋）', max: 3, focus: '正確機率 / 情境意義' },
            { criterion: '表達 / 標示', max: 2, focus: '事件 / 記法清楚' },
          ],
          issueTypes: ['concept', 'calc', 'method', 'step'],
        },
        {
          key: 'discrete-distributions',
          label: '離散概率分佈（二項 / 泊松 / 幾何）',
          keyConcepts: ['離散隨機變量、概率分佈與期望 E(X) / 方差 Var(X)', '二項分佈 B(n, p)', '泊松分佈（均值 λ）', '幾何分佈', '分佈適用條件的判斷', '期望值的線性運算'],
          markingConventions: ['要先說明採用何種分佈及其參數（n, p / λ）方得 M 分', '二項要寫 C(n,r)pʳ(1−p)ⁿ⁻ʳ；泊松要寫 e⁻ᵏ', '「至少 / 最多」要用補集或累加多項', '期望 / 方差用對應公式（二項 np / np(1−p)）'],
          commonErrors: ['分佈用錯（二項當泊松、忽略獨立 / 固定 n 條件）', '二項漏組合數 C(n,r) 或冪次配錯', '「至少一次」未用 1 − P(0)', '泊松 λ 取錯（時間 / 區間比例未調整）', '期望 / 方差公式混淆'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '分佈選擇 / 參數正確' },
            { criterion: '步驟與運算', max: 4, focus: '機率 / 期望計算無誤' },
            { criterion: '答案準確（含有效數字）', max: 3, focus: '正確機率值 / 約簡恰當' },
            { criterion: '表達 / 標示', max: 2, focus: '分佈記法、詮釋清楚' },
          ],
          issueTypes: ['concept', 'calc', 'method', 'data'],
        },
        {
          key: 'normal-distribution',
          label: '常態分佈與標準化',
          keyConcepts: ['常態分佈 N(μ, σ²) 的性質與對稱性', '標準化 Z = (X − μ) / σ', '標準常態表 / 機率區域查算', '逆向問題（由機率求 X 或 μ / σ）', '常態作二項的近似（如涉及）', '對稱與互補機率關係'],
          markingConventions: ['標準化要寫 Z = (X − μ)/σ 並顯示代入方得 M 分', '查表 / 求機率要畫圖或寫清所求區域', '逆向題要由機率反查 Z 再解 X', '機率值準確至指定有效數字'],
          commonErrors: ['標準化公式分母用方差 σ² 而非標準差 σ', '查表區域搞錯（左尾 / 右尾 / 中間）', '對稱性用錯（P(Z < −a) 的處理）', '逆向題 Z 值取錯符號', '過早約簡 Z 致最終機率誤差'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '標準化 / 區域識別正確' },
            { criterion: '步驟與運算', max: 4, focus: '查表 / 代入無誤' },
            { criterion: '答案準確（含有效數字）', max: 3, focus: '正確機率 / X 值' },
            { criterion: '表達 / 標示', max: 2, focus: '圖示 / 區域標示清楚' },
          ],
          issueTypes: ['concept', 'calc', 'step', 'data'],
        },
        {
          key: 'statistical-inference',
          label: '統計推斷（抽樣與信賴區間）',
          keyConcepts: ['抽樣分佈與樣本平均的分佈', '中央極限定理概念', '點估計（樣本平均 / 比例作母數估計）', '無偏估計量', '母平均 / 母比例的信賴區間', '信賴區間的正確詮釋'],
          markingConventions: ['信賴區間要寫公式（如 x̄ ± z·σ/√n）並代入方得 M 分', '要交代用咩臨界值（z 值對應信賴水平）', '結果要按情境詮釋（區間意義，非「真值有 95% 機會」嘅錯誤講法）', '機率 / 區間端點準確至指定有效數字'],
          commonErrors: ['信賴區間漏除以 √n（標準誤誤用 σ）', '臨界 z 值取錯（90% / 95% / 99% 混淆）', '信賴區間詮釋錯（講成母數係隨機）', '點估計與區間估計混淆', '樣本標準差 / 母標準差用錯'],
          rubric: [
            { criterion: '方法 / 概念', max: 5, focus: '抽樣分佈 / 區間公式正確' },
            { criterion: '步驟與運算', max: 4, focus: '臨界值 / 標準誤代入無誤' },
            { criterion: '答案與詮釋', max: 3, focus: '正確區間 + 情境詮釋' },
            { criterion: '表達 / 標示', max: 2, focus: '記法 / 結論清楚' },
          ],
          issueTypes: ['concept', 'calc', 'application', 'data'],
        },
      ],
    },
  ],
  publicResources: [
    { label: 'HKEAA 數學（延伸部分單元一 M1）科目資訊（官方：課程評估 / 樣本試題 / 評核大綱）', url: 'https://www.hkeaa.edu.hk/tc/HKDSE/assessment/subject_information/category_a_subjects/m1/' },
    { label: 'HKEAA 數學 科目資訊總頁（含延伸部分 M1 / M2）', url: 'https://www.hkeaa.edu.hk/en/hkdse/assessment/subject_information/' },
    { label: 'EDB 數學課程及評估指引（中四至中六，含延伸部分 M1）', url: 'https://www.edb.gov.hk/tc/curriculum-development/kla/ma/curr/ss-maths.html' },
    { label: 'DSE Treasure — M1 歷屆試題（按課題分類 + marking）', url: 'https://dsetreasure.com/dse-m1-past-paper/' },
  ],
  source:
    '提煉自 HKEAA 數學課程及評估指引（延伸部分單元一 M1：微積分與統計）/ 評核大綱（唯一試卷佔該延伸單元 100%、考試時間 2.5 小時、Section A + Section B 約 105 分、須列步驟、不設 MC 及 SBA；數學科必修與延伸合計為一科但分開呈報）+ 公開 marking scheme 慣例（方法分 M / 答案分 A / follow-through f.t. / 約簡 r.）+ DSE M1 批改知識。官方考評報告（examiner report）及表現示例可逐題校準常見失分。',
}
