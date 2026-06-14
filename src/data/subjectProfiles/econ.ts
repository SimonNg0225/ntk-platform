import type { SubjectKnowledge } from './types'

// ============================================================
//  經濟 Economics 科目知識檔案
//  ------------------------------------------------------------
//  公開試結構（現行 DSE，無校本評核 SBA）：
//    卷一 Paper 1（30%，1 小時）：選擇題 Multiple Choice，約 35–40 題，
//      涵蓋整個必修課程，每題等分、無倒扣。
//    卷二 Paper 2（70%，2 小時 30 分）：分三部——
//      甲部（Section A）必答短答題（界定概念 + 短分析）；
//      乙部（Section B）結構式 / 資料回應 / 延伸論述題，設選擇（多揀少）；
//      丙部（Section C）選修單元題，只須作答所修單元（單元一 或 單元二）。
//      題目多附資料（文字 / 數據 / 圖表），要求運用經濟分析作答。
//  批改鐵則（HKEAA marking scheme 慣例，提煉成衍生指引）：
//    · 定義 / 概念分要見到準確用詞（如「機會成本＝放棄的最有價值選項」），
//      講對意思但用詞含糊只酌量畀分；
//    · 經濟分析睇推理鏈（cause → effect），唔係淨係講結論；
//    · 圖（D/S、AD/AS、成本曲線等）要有正確座標標籤、曲線移動方向同新均衡，
//      標錯軸 / 郁錯曲線 / 漏標新點會失分；
//    · 計算（彈性、GDP、貨幣乘數、匯率換算等）要列式 + 帶單位 / 正負號 /
//      百分比，方法啱即使數值錯都酌量畀方法分；
//    · 「資料回應」必須扣返題目所附資料 / 情境，背誦無扣連得分有限；
//    · 留意實證（positive）vs 規範（normative）、名義 vs 實質、存量 vs 流量
//      等常混淆對偶概念。
//  選修單元內容歸屬（必須記啱，勿倒轉）：
//    單元一 Elective 1＝壟斷定價行為、價格分歧、反競爭行為及競爭政策；
//    單元二 Elective 2＝貿易理論之延伸、經濟增長與發展。
//  範疇對齊官方課程及評估指引：微觀基礎（A–E）/ 宏觀（F–I）/
//    國際與選修（J + 選修單元）。
//  提煉來源：HKEAA Economics 課程及評估指引 / 評核大綱（卷一 30% MC +
//    卷二 70%：甲部短答 + 乙部結構 / 資料回應 / 延伸 + 丙部選修單元；無 SBA）
//    + 公開 marking scheme 慣例 + DSE 經濟批改知識。官方考評報告 /
//    表現示例可逐題校準常見失分。
//  版權聲明：本檔只屬衍生教學指引（準則 / 慣例 / 常見錯誤 / 命令詞 /
//    等級描述），並無照搬 HKEAA 試題原文或官方評卷參考原句。
// ============================================================

const ECON_PERSONA =
  '你係資深香港中學經濟科評卷員，按 DSE Economics 標準批改。重視：(1) 定義 / 概念要準確用詞，意思啱但用詞含糊只酌量畀分；(2) 經濟分析睇完整推理鏈（cause → effect）而唔係淨係講結論；(3) 圖（D/S、AD/AS、成本曲線）要有正確軸標籤、曲線移動方向同新均衡；(4) 計算要列式、帶單位 / 正負號 / 百分比，方法啱即使數值錯都酌量畀方法分；(5) 資料回應題一定要扣返題目所附資料 / 情境，背書無扣連得分有限。'

export const ECON: SubjectKnowledge = {
  subject: 'econ',
  label: '經濟',
  lang: 'zh',
  assessment: {
    papers: [
      '卷一 Paper 1（30%，1 小時）：選擇題（約 35–40 題），涵蓋整個必修課程，每題等分、無倒扣；考概念辨析、圖表判讀、簡單計算。',
      '卷二 Paper 2（70%，2 小時 30 分）：分三部。甲部（Section A）必答短答題（界定概念 + 短分析）；乙部（Section B）結構式 / 資料回應 / 延伸論述題，設選擇（多揀少）；丙部（Section C）選修單元題。題目多附資料（文字 / 數據 / 圖表），須運用經濟概念與圖解作答。',
      '丙部 選修單元（單元一：壟斷定價、價格分歧、反競爭行為及競爭政策；或 單元二：貿易理論之延伸、經濟增長與發展，二選一）：考生只須作答所修單元。',
    ],
    weightings: '卷一 30%（MC）· 卷二 70%（甲部短答 + 乙部結構 / 資料回應 / 延伸 + 丙部選修單元）。無校本評核（SBA）。等級 1–5**（七級）。',
    questionTypes: [
      '選擇題（概念辨析 / 圖表判讀 / 計算）',
      '定義 / 界定概念（短題）',
      '資料回應題（data-response，扣連所附資料 / 情境）',
      '圖解分析（D/S、AD/AS、成本曲線、市場干預）',
      '計算題（彈性、GDP、物價指數、貨幣乘數、匯率換算）',
      '比較 / 區分（如實證 vs 規範、名義 vs 實質）',
      '延伸論述 / 評論（政策利弊、立場 + 經濟推理）',
    ],
    sba: '經濟科無校本評核（SBA）。',
  },
  commandWords: [
    { word: '界定 / 定義（Define / What is meant by）', meaning: '用準確經濟用詞寫出定義；意思啱但用詞含糊只得部分分，最好附簡例。' },
    { word: '解釋（Explain）', meaning: '講清楚「點解 / 點樣」，展示完整因果推理鏈，唔係淨係陳述結論。' },
    { word: '運用 / 利用圖解（Explain with the aid of a diagram）', meaning: '畫圖 + 文字並用；圖要有正確軸標籤、曲線移動方向同新均衡，圖文要互相對應。' },
    { word: '計算 / 求（Calculate）', meaning: '列出算式再得數值，帶單位 / 正負號 / 百分比；方法啱數值錯仍可得方法分。' },
    { word: '分析（Analyse）', meaning: '拆解情境，逐步用經濟概念推導影響（對價格 / 產量 / 福利 / 市場各方）。' },
    { word: '比較 / 區分（Compare / Distinguish）', meaning: '同時指出異同並逐點對應（如實證 vs 規範、名義 vs 實質、存量 vs 流量）。' },
    { word: '評估 / 評論 / 你是否同意（Evaluate / Discuss / Do you agree）', meaning: '表明立場，兩面權衡利弊並附經濟理據，最後扣返問題作結。' },
    { word: '參考資料（With reference to the data / source）', meaning: '答案必須引用 / 扣連題目所附資料 / 數據 / 情境，純背書無扣連得分有限。' },
    { word: '舉例說明（Give an example / Illustrate）', meaning: '提供切題、具體（最好本港 / 現實）例子去支撐論點，泛例分數有限。' },
  ],
  levelDescriptors: [
    { level: '高（5–5**）', descriptor: '概念定義準確、用詞到位；分析有完整因果推理鏈並扣連資料 / 情境；圖正確（軸標籤、移動方向、新均衡齊全）且圖文呼應；計算列式正確帶單位；評論兩面兼顧、立場清晰有理。' },
    { level: '中（3–4）', descriptor: '概念大致正確、偶有用詞鬆散；分析有推理但偶有跳步或結論先行；圖大致對但偶漏標籤 / 新均衡；計算方法對偶有數值 / 單位失誤；評論略偏單面或扣題不足。' },
    { level: '低（1–2）', descriptor: '概念混淆 / 定義錯漏；分析多為背誦或直接講結論、欠推理；圖標錯軸 / 郁錯曲線 / 漏新點；計算方法錯 / 無列式；甚少扣連資料，立場含糊。' },
  ],
  strands: [
    // ───────────── 微觀經濟基礎（A–E）─────────────
    {
      key: 'micro',
      label: '微觀經濟基礎',
      persona: ECON_PERSONA,
      areas: [
        {
          key: 'basic-concepts-firms',
          label: '基本經濟概念與廠商生產（A、B）',
          keyConcepts: ['稀少性、選擇與機會成本（放棄的最有價值選項）', '三個基本經濟問題（生產甚麼 / 如何生產 / 為誰生產）', '專業化、分工與交換、循環流轉', '實證 vs 規範表述', '生產要素、生產的類型與階段', '短期 vs 長期成本（固定 / 變動 / 邊際 / 平均）、廠商目標', '企業擁有權的類型與比較'],
          markingConventions: ['機會成本要寫「放棄的最有價值（次佳）選項」，唔可寫「所有放棄的選項總和」', '實證 / 規範要逐句判斷並講理由（可否事實驗證 / 含價值判斷）', '成本概念要分清固定 vs 變動、總 vs 平均 vs 邊際', '比較企業擁有權要逐項對應（責任 / 籌資 / 連續性 / 控制）'],
          commonErrors: ['機會成本當成「金錢成本」或「所有放棄選項之和」', '實證 vs 規範判斷錯（見「應該」未必即規範要看語境）', '混淆固定成本與變動成本、平均成本與邊際成本', '長短期分界誤以為「時間長短」而非「有無固定要素」', '分工好處淨係背書、無扣連情境'],
          rubric: [
            { criterion: '概念與定義', max: 6, focus: '用詞準確、辨析清楚' },
            { criterion: '經濟分析', max: 6, focus: '推理鏈完整、扣題' },
            { criterion: '應用與例子', max: 4, focus: '切題具體（本港 / 現實）' },
            { criterion: '結構與表達', max: 2, focus: '條理清楚、用詞恰當' },
          ],
          issueTypes: ['concept', 'term', 'application', 'argument'],
        },
        {
          key: 'demand-supply-elasticity',
          label: '市場、價格與彈性（C）',
          keyConcepts: ['需求 / 供給定律、決定因素', '需求量變動 vs 需求變動（沿線移動 vs 整條移動）', '均衡價格與數量、過剩 / 短缺', '消費者及生產者盈餘、價格的功能', '需求 / 供給的價格彈性、收入彈性、交叉彈性', '彈性與總收益的關係'],
          markingConventions: ['「量變動」用 movement along，「需求 / 供給變動」用 shift，要分清', '圖要標 D / S、P、Q 軸，移動方向同新均衡點齊全', '彈性計算列式（%ΔQ ÷ %ΔP），帶數值並判斷富 / 缺彈性', '盈餘要對應圖中正確面積'],
          commonErrors: ['沿線移動與整條曲線移動混淆（需求量↔需求）', '把影響供給的因素誤當影響需求', '彈性只當斜率、忽略中點 / 百分比計法', '彈性正負號 / 富缺彈性判斷錯', '圖漏標軸 / 新均衡 / 移動箭嘴', '盈餘面積劃錯'],
          rubric: [
            { criterion: '概念與定義', max: 5, focus: '需供 / 彈性定義準確' },
            { criterion: '圖解分析', max: 6, focus: '軸 / 移動 / 新均衡正確' },
            { criterion: '計算（彈性）', max: 4, focus: '列式、數值、判斷正確' },
            { criterion: '結構與表達', max: 3, focus: '圖文呼應、條理清楚' },
          ],
          issueTypes: ['concept', 'data', 'calc', 'analysis'],
        },
        {
          key: 'market-structure-efficiency',
          label: '市場結構、效率、公平與政府（D、E）',
          keyConcepts: ['市場結構（完全競爭 / 壟斷 / 壟斷性競爭 / 寡頭）特徵', '市場干預（價格上限 / 下限、稅 / 補貼、配額）', '效率（資源配置 / 無謂損失 deadweight loss）', '公平（收入分配、堅尼系數概念）', '市場失靈（外部性、公共財、資訊不對稱）與政府角色'],
          markingConventions: ['市場結構要逐特徵對比（廠商數目 / 產品 / 進出 / 訊息 / 價格控制）', '干預題要畫圖標出價格管制線、過剩 / 短缺與無謂損失', '外部性要分正 / 負、講私人 vs 社會成本 / 效益差距', '效率 vs 公平要分清、唔好當同義'],
          commonErrors: ['價格上限 / 下限與其後果（短缺 / 過剩）方向搞反', '把「壟斷」當「只有一間就無競爭壓力」而漏特徵', '正 / 負外部性混淆、漏講社會 vs 私人差距', '無謂損失區域劃錯或完全不畫', '效率與公平概念混用'],
          rubric: [
            { criterion: '概念與定義', max: 5, focus: '結構特徵 / 失靈類型準確' },
            { criterion: '圖解分析', max: 6, focus: '干預 / 無謂損失圖正確' },
            { criterion: '應用與評論', max: 5, focus: '扣題、兩面權衡' },
            { criterion: '結構與表達', max: 2, focus: '條理清楚' },
          ],
          issueTypes: ['concept', 'data', 'argument', 'application'],
        },
      ],
    },

    // ───────────── 宏觀經濟（F–I）─────────────
    {
      key: 'macro',
      label: '宏觀經濟',
      persona: ECON_PERSONA,
      areas: [
        {
          key: 'national-income-adas',
          label: '經濟表現量度與國民收入決定（F、G）',
          keyConcepts: ['GDP / GNI 概念與計法（支出法等）、名義 vs 實質', '物價指數（CPI、GDP 平減指數）、名義 / 實質轉換', '總需求 AD（C + I + G + (X−M)）、總供給 AS', '均衡產出與物價水平的決定', 'AD / AS 變動對產出與物價的影響'],
          markingConventions: ['名義 vs 實質要用物價指數明確調整、列式', 'GDP 計算避免重複計算（只計最終值 / 增加值）', 'AD / AS 圖要標 P（物價水平）、Y（實質產出）軸與移動方向 + 新均衡', '指出對產出 / 物價 / 就業的連帶影響（推理鏈）'],
          commonErrors: ['名義與實質 GDP 混淆、轉換時除錯指數', 'GDP 計算重複計算中間財', '把 AD / AS 圖當微觀 D / S 圖（軸標錯）', 'AD 組成漏項（如漏淨出口）', '只講結論未追到產出 / 物價 / 就業變化'],
          rubric: [
            { criterion: '概念與定義', max: 5, focus: '量度概念 / 名實之分準確' },
            { criterion: '圖解分析（AD/AS）', max: 6, focus: '軸 / 移動 / 新均衡正確' },
            { criterion: '計算（GDP / 指數）', max: 4, focus: '列式、避免重複計、單位' },
            { criterion: '結構與表達', max: 3, focus: '推理鏈完整' },
          ],
          issueTypes: ['concept', 'calc', 'data', 'unit'],
        },
        {
          key: 'money-banking-macro-policy',
          label: '貨幣銀行與宏觀問題政策（H、I）',
          keyConcepts: ['貨幣的功能與定義、貨幣供應（M1/M2/M3 概念）', '銀行功能、存款創造與貨幣乘數', '利率的決定', '經濟波動、通脹 / 通縮、失業（類型）', '財政政策與貨幣政策（工具、傳導、限制）', '香港作為金融中心（聯繫匯率制度下貨幣政策的限制）'],
          markingConventions: ['貨幣乘數 / 存款創造要列式（如 1 ÷ 法定準備率）並帶假設', '通脹要分需求拉動 vs 成本推動，扣連 AD / AS', '失業要分類（摩擦 / 結構 / 循環）對應成因與對策', '政策題要講工具 → 傳導 → 效果 → 限制；提及聯匯對港貨幣政策的約束'],
          commonErrors: ['貨幣乘數公式錯 / 漏現金漏出等假設', '通脹成因（需求 / 成本）判斷錯、無扣 AD/AS', '失業類型張冠李戴、對策不對應', '混淆財政與貨幣政策工具', '忽略香港聯繫匯率下難自主運用貨幣政策'],
          rubric: [
            { criterion: '概念與定義', max: 5, focus: '貨幣 / 政策概念準確' },
            { criterion: '經濟分析', max: 6, focus: '傳導 / 因果鏈完整' },
            { criterion: '計算（乘數等）', max: 4, focus: '列式、假設、數值' },
            { criterion: '應用與評論', max: 3, focus: '扣本港情境、評限制' },
          ],
          issueTypes: ['concept', 'calc', 'argument', 'application'],
        },
      ],
    },

    // ───────────── 國際經濟與選修單元（J + 選修）─────────────
    {
      key: 'international-electives',
      label: '國際經濟與選修單元',
      persona: ECON_PERSONA,
      areas: [
        {
          key: 'trade-finance',
          label: '國際貿易與金融（J）',
          keyConcepts: ['自由貿易的好處、比較優勢概念', '貿易壁壘（關稅 / 配額）及其影響', '國際收支平衡帳（經常 / 資本及金融帳）', '匯率（升 / 貶值）、匯率制度', '匯率變動對進出口 / 物價的影響'],
          markingConventions: ['匯率換算要列式、講清是哪一方升 / 貶值', '關稅 / 配額影響可用圖（國內外價格、進口量）分析', '國際收支要分清借 / 貸方、經常 vs 資本及金融帳', '貿易壁壘評論要兩面（保護 vs 效率損失）'],
          commonErrors: ['匯率升貶方向搞反（本幣升值對出口的影響）', '比較優勢與絕對優勢混淆', '國際收支帳項歸類錯（如把資本流動當經常帳）', '關稅與配額效果混淆', '匯率換算方向 / 單位錯'],
          rubric: [
            { criterion: '概念與定義', max: 5, focus: '貿易 / 匯率概念準確' },
            { criterion: '分析（含圖 / 帳）', max: 6, focus: '推理 / 帳項 / 圖正確' },
            { criterion: '計算（匯率換算）', max: 4, focus: '方向、列式、單位' },
            { criterion: '應用與評論', max: 3, focus: '兩面權衡、扣題' },
          ],
          issueTypes: ['concept', 'calc', 'data', 'unit'],
        },
        {
          key: 'elective-modules',
          label: '選修單元（單元一 壟斷定價 / 競爭政策；單元二 貿易延伸 / 增長發展）',
          keyConcepts: ['單元一（Elective 1）：壟斷定價行為、價格分歧（一 / 二 / 三級）及其成立條件、反競爭行為（如勾結 / 掠奪性定價）、競爭政策', '單元一：壟斷的福利影響（與完全競爭基準比較、無謂損失）', '單元二（Elective 2）：貿易理論之延伸（比較優勢的延伸 / 貿易條件 terms of trade）', '單元二：經濟增長與經濟發展（增長來源；發展涉生活水平 / 質的改善，非單一量化指標）', '單元二：經濟增長 vs 經濟發展之別（量 vs 質）'],
          markingConventions: ['只就考生所修單元批改（單元一 或 單元二），勿把兩單元概念互換', '價格分歧要講成立條件（市場可分隔、可阻轉售、各市場彈性不同）並分級辨析', '壟斷福利分析要與完全競爭基準比較（無謂損失區域）', '增長 vs 發展要分清（量 vs 質 / 生活水平），發展可多面向描述而非淨靠單一指標'],
          commonErrors: ['價格分歧分級辨析錯 / 漏成立條件', '把壟斷福利損失講成「一定對社會有害」而欠分析', '經濟增長與經濟發展概念混用', '把單元一（壟斷 / 競爭政策）與單元二（貿易延伸 / 增長發展）內容倒轉或張冠李戴', '將發展窄化為單一指標、忽略多面向（教育 / 健康 / 收入分配等）'],
          rubric: [
            { criterion: '概念與定義', max: 5, focus: '單元專屬概念準確' },
            { criterion: '經濟分析', max: 6, focus: '比較 / 福利 / 推理完整' },
            { criterion: '應用與評論', max: 5, focus: '扣題、兩面權衡' },
            { criterion: '結構與表達', max: 2, focus: '條理清楚' },
          ],
          issueTypes: ['concept', 'argument', 'analysis', 'application'],
        },
      ],
    },
  ],
  publicResources: [
    { label: 'HKEAA 經濟 科目資訊（官方：課程評估 / 樣本試題 / 表現示例）', url: 'https://www.hkeaa.edu.hk/en/HKDSE/assessment/subject_information/category_a_subjects/econ/' },
    { label: 'HKEAA HKDSE 科目資訊總頁（如分頁網址有變，由此進入經濟科）', url: 'https://www.hkeaa.edu.hk/en/hkdse/assessment/subject_information/' },
    { label: 'EDB 經濟 課程及評估指引（中四至中六，官方）', url: 'https://www.edb.gov.hk/en/curriculum-development/kla/pshe/references-and-resources/economics/index.html' },
    { label: 'DSE Treasure — 經濟歷屆試題（按課題分類 + marking）', url: 'https://dsetreasure.com/dse-econ-past-paper/' },
  ],
  source:
    '提煉自 HKEAA Economics 課程及評估指引 / 評核大綱（卷一 30% MC + 卷二 70%：甲部短答 + 乙部結構 / 資料回應 / 延伸 + 丙部選修單元；必修 A–J + 選修二選一——單元一 壟斷定價 / 競爭政策、單元二 貿易延伸 / 增長發展；無 SBA；等級 1–5**）+ EDB 課程及評估指引 + 公開 marking scheme 慣例（定義用詞 / 完整推理鏈 / 圖解標籤與新均衡 / 計算方法分 / 扣連資料）+ DSE 經濟批改知識。官方考評報告（examiner report）與表現示例（sample performance）可逐題校準常見失分。',
}
