import type { SubjectKnowledge } from './types'

// ============================================================
//  生物（Biology）科目知識檔案 — DSE Biology
//  ------------------------------------------------------------
//  公開試結構（現行 HKDSE Biology；下列三部分合共佔全科 100%）：
//    卷一 Paper 1（必修部分，佔全科 60%；約 2.5 小時）：
//      甲部 Section A 選擇題（MC，36 分）+ 乙部 Section B 短答 / 結構式 /
//      數據題 / 文章理解（共 84 分；論述題主要出現喺乙部長題目，並非常設
//      essay 選答）。考概念理解、實驗與數據詮釋、應用。
//    卷二 Paper 2（選修部分，佔全科 20%；約 1 小時）：
//      四個選修單元（人體與健康 / 應用生態學 / 微生物與人類 / 生物科技）
//      任揀一個單元作答，含結構式短答 + 論述題（essay）。
//    校本評核 SBA（佔全科 20% = 範疇 A 8% + 範疇 B 12%）：實驗技能與
//      報告（校內評核，不在此 AI 筆試批改範圍）。
//  批改鐵則（HKEAA marking scheme 慣例提煉）：
//    · 採「point-marking」：一個正確意思點 = 一分，須答到關鍵字 / 機制先得分；
//    · 術語要準確（中英對照，如 active transport 主動運輸、osmosis 滲透）；
//    · 過程題（呼吸 / 光合 / 神經傳遞 / 遺傳）要按邏輯次序、因果連貫，跳步扣分；
//    · 數據 / 圖表題要引數據作答（quote figures），唔可只講趨勢；
//    · 實驗題要講對照（control）、變量（variable）、可靠性 / 公平測試；
//    · 「ORA」(or reverse argument) — 反向論述同樣接受；
//    · 「AW / accept words」— 接受同義關鍵字；錯誤科學陳述（如「植物只喺夜晚呼吸」）
//      會抵銷該點得分。
//  三範疇對齊課程：細胞與生理過程 / 遺傳、生殖與進化 / 生態、實驗與選修。
//  提煉來源：HKEAA 生物課程及評估指引 / 評核大綱 + 公開 marking scheme 慣例
//  （point-marking / ORA / AW）+ DSE 生物批改知識。官方考評報告（examiner
//  report）/ 表現示例可逐題校準常見失分。
//  版權：以上為衍生指引（準則 / 慣例 / 常見錯誤 / 命令詞 / 等級描述），
//  並無照搬 HKEAA 試題原文或官方 marking scheme 原句。
// ============================================================

const BIO_PERSONA =
  '你係資深香港中學生物科評卷員，按 DSE Biology 標準批改。採 point-marking：一個正確意思點 = 一分，要答到關鍵字 / 機制先得分；術語要準確（中英對照）；生物過程（呼吸 / 光合 / 神經 / 遺傳）要按邏輯次序、因果連貫，跳步或次序錯會失分；數據 / 圖表題要引數據作答；錯誤科學陳述會抵銷該點。接受反向論述（ORA）及同義關鍵字（accept words）。'

export const BIO: SubjectKnowledge = {
  subject: 'bio',
  label: '生物',
  lang: 'zh',
  assessment: {
    papers: [
      '卷一 Paper 1（必修部分，佔全科 60%；約 2.5 小時）：甲部 Section A 選擇題（MC，36 分）+ 乙部 Section B 短答 / 結構式題（84 分），含文章理解、數據 / 圖表詮釋、實驗設計與應用；論述題（essay）主要見於乙部長題目，並非常設選答。',
      '卷二 Paper 2（選修部分，佔全科 20%；約 1 小時）：四個選修單元 —— 人體與健康（Human Physiology: Regulation & Control）/ 應用生態學（Applied Ecology）/ 微生物與人類（Microorganisms & Humans）/ 生物科技（Biotechnology）—— 任揀一個單元作答，含結構式短答 + 論述題（essay）。',
      '校本評核 SBA（佔全科 20% = 範疇 A 8% + 範疇 B 12%）：實驗技能、觀察與實驗報告（校內評核，不在此 AI 筆試批改範圍）。',
    ],
    weightings: '全科總分由三部分組成，合共 100%：卷一（必修）60% + 卷二（選修）20% + 校本評核 SBA 20%（範疇 A 8% + 範疇 B 12%）。成績以七個等級匯報（1、2、3、4、5、5*、5**）。以官方現行評核大綱為準。',
    questionTypes: ['選擇題（MC，卷一甲部）', '結構式 / 短答（point-marking，卷一乙部）', '過程 / 機制描述題', '數據與圖表詮釋', '實驗設計 / 評鑑（對照、變量、可靠性）', '文章理解（comprehension）', '論述（essay，主要見於卷一乙部長題目及卷二選修卷）', '應用 / 解難題'],
  sba: '校本評核 SBA 佔全科 20%（範疇 A 8% + 範疇 B 12%）：實驗技能與報告，由任教老師校內評核；本檔聚焦可批改之筆試部分，SBA 僅作結構說明。',
  },
  commandWords: [
    { word: '描述（Describe）', meaning: '按次序講出特徵 / 過程 / 趨勢；過程題要因果連貫，唔可跳步。' },
    { word: '解釋（Explain）', meaning: '講「點解 / 點樣」，要有生物學原理 / 機制，唔可只陳述現象。' },
    { word: '比較（Compare）', meaning: '同時講相同與不同點，逐點對應（如結構 vs 功能），唔可只講一方。' },
    { word: '說明 / 區別（State / Distinguish）', meaning: 'State 簡短點出答案；Distinguish 要明確指出兩者分別之處。' },
    { word: '計算（Calculate）', meaning: '列式並帶單位（如 % 變化、放大率、呼吸商）；引用數據作答。' },
    { word: '設計 / 評鑑實驗（Design / Evaluate）', meaning: '須講對照組、操控 / 應變 / 控制變量、重複、公平測試與可靠性。' },
    { word: '建議 / 推斷（Suggest / Deduce）', meaning: '據資料作合理生物學推斷；答案要扣緊題目所給數據 / 情境。' },
    { word: '繪圖 / 標示（Draw / Label）', meaning: '線條清晰、比例合理、標示準確（如細胞器、生物分子），標錯名失分。' },
    { word: '舉例說明（Give an example / Illustrate）', meaning: '用具體生物例子支持答案，例子要切合題旨並正確。' },
  ],
  levelDescriptors: [
    { level: '高（5–5**）', descriptor: '概念準確全面、術語正確（中英對照無誤）；過程 / 機制按次序、因果連貫完整；數據 / 圖表題能引數據並準確詮釋；實驗答案能處理對照與變量；應用 / 解難具邏輯。' },
    { level: '中（3–4）', descriptor: '主要概念正確，偶有術語 / 細節失誤；過程描述大致有序但偶漏關鍵步驟；能讀數據但詮釋未盡深入；實驗答案大致到位但對照 / 變量交代不全。' },
    { level: '低（1–2）', descriptor: '概念模糊或有錯誤科學陳述；術語誤用 / 中英混淆；過程跳步、次序亂、因果不清；只講趨勢不引數據；實驗變量 / 對照概念薄弱。' },
  ],
  strands: [
    // ───────────── 細胞與生理過程 ─────────────
    {
      key: 'cell-physiology',
      label: '細胞與生理過程',
      persona: BIO_PERSONA,
      areas: [
        {
          key: 'cell-transport-enzymes',
          label: '細胞結構、物質運輸與酶',
          keyConcepts: ['細胞器結構與功能（粒線體 / 葉綠體 / 核糖體 / 細胞膜）', '擴散、滲透（osmosis）、主動運輸（active transport）之分別', '水勢與細胞在不同溶液中之變化（質壁分離 plasmolysis）', '酶之專一性與「鎖匙模型」', '溫度 / pH / 受質濃度對酶活性之影響', '生命分子（碳水化合物 / 蛋白質 / 脂質）之檢測'],
          markingConventions: ['運輸題要分清是否需要 ATP / 載體蛋白、是否順 / 逆濃度梯度', '滲透題要用「水勢 / 濃度」措辭，唔可只講「水走入細胞」', '酶題要講活性位點（active site）與形狀互補；變性（denature）要連繫高溫 / 極端 pH', '圖表題（酶活性曲線）要引數值描述最適點與下降原因'],
          commonErrors: ['滲透與擴散混淆；將主動運輸當被動', '寫「酶被殺死」（酶非生物，應寫 denatured 變性）', '質壁分離方向搞錯（高濃度外液致水流出）', '溫度過高只講「酶死」唔講活性位點變形', '生命分子檢測試劑 / 顏色變化記錯（如本尼迪試劑、雙縮脲）'],
          rubric: [
            { criterion: '概念 / 術語', max: 6, focus: '結構功能、運輸 / 酶概念與正確術語' },
            { criterion: '過程 / 機制描述', max: 5, focus: '次序、因果、機制完整' },
            { criterion: '數據 / 圖表詮釋', max: 3, focus: '引數據、解釋曲線' },
            { criterion: '表達 / 標示', max: 2, focus: '中英術語、圖示清楚' },
          ],
          issueTypes: ['concept', 'term', 'data', 'content'],
        },
        {
          key: 'human-physiology',
          label: '人體生理（營養、氣體交換、循環、協調）',
          keyConcepts: ['消化與酶（澱粉 / 蛋白質 / 脂質之消化終產物）與吸收（絨毛 villi）', '氣體交換表面之特徵（大表面積 / 薄 / 濕潤 / 充血）', '呼吸作用（有氧 / 無氧）與呼吸 vs 燃燒之別', '血液循環（雙循環 double circulation）、心臟與血管結構功能', '神經協調（反射弧 reflex arc）與內分泌協調（激素）', '恆定（homeostasis）：血糖 / 體溫之負反饋調節'],
          markingConventions: ['呼吸作用切勿與呼吸動作（breathing / ventilation）混為一談', '氣體交換 / 吸收之結構特徵要連繫功能（structure–function）', '協調題要分清神經（快、短暫、電 / 化學）vs 激素（慢、持久、血液運送）', '負反饋題要寫出「偏離 → 偵測 → 矯正 → 回復」完整迴路'],
          commonErrors: ['呼吸作用（respiration）誤作呼吸 / 通氣（breathing）', '只講結構唔連功能（如講絨毛多但唔講增大吸收面積）', '反射弧次序 / 神經元類型（感覺 / 中間 / 運動）搞錯', '激素與酶 / 神經混淆', '負反饋只講一半（漏「回復正常」或漏「偵測器」）'],
          rubric: [
            { criterion: '概念 / 術語', max: 6, focus: '生理系統概念與正確術語' },
            { criterion: '過程 / 機制描述', max: 6, focus: '生理過程次序、結構連功能' },
            { criterion: '應用 / 解釋', max: 4, focus: '情境推理、恆定調節' },
            { criterion: '表達 / 標示', max: 2, focus: '中英術語、流程清楚' },
          ],
          issueTypes: ['concept', 'term', 'application', 'content'],
        },
      ],
    },

    // ───────────── 遺傳、生殖與進化 ─────────────
    {
      key: 'genetics-evolution',
      label: '遺傳、生殖與進化',
      persona: BIO_PERSONA,
      areas: [
        {
          key: 'genetics-inheritance',
          label: '遺傳與變異（含遺傳計算）',
          keyConcepts: ['DNA / 基因 / 染色體 / 等位基因（allele）關係', '減數分裂（meiosis）與變異來源', '單因子遺傳（孟德爾比例 3:1、測交）與遺傳圖譜（genetic diagram）', '顯隱性、共顯性、性連遺傳（sex-linked）', '基因型 vs 表現型；遺傳系譜（pedigree）分析', '突變（mutation）與遺傳病'],
          markingConventions: ['遺傳題要寫齊：親代基因型 → 配子 → 旁氏方格 / 配對 → 子代基因型及表現型比例', '符號要一致並先定義（如 T = 高、t = 矮），大小階分清', '比例題要連繫機率（如 1/4、25%），唔可只寫數目', '系譜題要由表現型反推基因型並講明依據'],
          commonErrors: ['配子只寫一個（漏分離 segregation）或配子帶兩個等位基因', '基因型 / 表現型混淆；大小階用錯致顯隱倒轉', '漏定義符號或前後符號不一致', '性連遺傳漏將基因標於 X 染色體（如 XᴮXᵇ）', '把比例當絕對數目（無視機率本質）'],
          rubric: [
            { criterion: '概念 / 術語', max: 5, focus: '遺傳概念與正確術語' },
            { criterion: '遺傳圖譜 / 步驟', max: 6, focus: '親代→配子→子代完整、符號一致' },
            { criterion: '比例 / 推斷', max: 4, focus: '正確比例 / 機率、系譜推理' },
            { criterion: '表達 / 標示', max: 2, focus: '符號定義、圖譜清楚' },
          ],
          issueTypes: ['concept', 'step', 'term', 'application'],
        },
        {
          key: 'reproduction-evolution',
          label: '生殖、發育與進化',
          keyConcepts: ['有性 vs 無性生殖之優劣（變異 / 適應）', '人類生殖系統與月經週期（激素調控）', '開花植物之傳粉與受精', '達爾文天擇（natural selection）與適應（adaptation）', '進化證據與抗藥性 / 抗生素抗性之天擇例子', '物種形成概念'],
          markingConventions: ['天擇題要寫齊邏輯鏈：變異 → 環境選擇壓力 → 適者較易存活及繁殖 → 有利基因頻率上升', '避免目的論措辭（生物「想 / 為咗」適應）—— 要講「具有利變異者較易存活」', '生殖題分清減數 / 受精在哪階段；激素題連繫週期事件', '比較有性 / 無性要扣「變異 → 適應環境變化」之意義'],
          commonErrors: ['天擇寫成「用進廢退」/ 拉馬克式（後天獲得性狀遺傳）', '目的論：「細菌為咗生存而變異」（變異本已存在，環境只作篩選）', '混淆抗藥性「產生」與「被選擇」', '月經週期激素（FSH / LH / 雌激素 / 黃體酮）作用配錯', '無性生殖優點誤寫「增加變異」'],
          rubric: [
            { criterion: '概念 / 術語', max: 6, focus: '生殖 / 進化概念與正確術語' },
            { criterion: '過程 / 邏輯鏈', max: 6, focus: '天擇邏輯、生殖過程次序' },
            { criterion: '應用 / 解釋', max: 4, focus: '例子切題、避免目的論' },
            { criterion: '表達 / 標示', max: 2, focus: '措辭精準、中英術語' },
          ],
          issueTypes: ['concept', 'argument', 'term', 'application'],
        },
      ],
    },

    // ───────────── 生態、實驗與選修 ─────────────
    {
      key: 'ecology-skills',
      label: '生態、實驗技能與選修',
      persona: BIO_PERSONA,
      areas: [
        {
          key: 'ecology-ecosystems',
          label: '生態系統、能量流動與人類影響',
          keyConcepts: ['食物鏈 / 食物網與營養級（trophic level）', '能量流動與金字塔（能量逐級遞減約 90% 散失）', '碳循環與氮循環', '生態系統中之競爭 / 捕食 / 共生關係', '人類活動之環境影響（污染 / 溫室效應 / 生物多樣性流失）', '取樣方法（樣方 quadrat / 樣線 transect）與種群估算'],
          markingConventions: ['能量題要講「散失」途徑（呼吸作用 / 排泄 / 未被攝食 / 熱能）', '碳 / 氮循環要點出關鍵過程（光合 / 呼吸 / 分解 / 固氮 / 硝化）之名', '取樣題要講隨機取樣、重複、計算種群密度之方法', '環境議題答案要連繫具體生物學機制，唔可只喊口號'],
          commonErrors: ['食物鏈箭頭方向相反（箭頭應指向能量 / 物質流向之捕食者）', '能量「循環」之誤（能量單向流動、會散失；物質才循環）', '營養級數目算錯或生產者 / 消費者混淆', '氮循環各菌（固氮 / 硝化 / 反硝化）作用配錯', '取樣題忽略隨機性與重複，致估算不可靠'],
          rubric: [
            { criterion: '概念 / 術語', max: 6, focus: '生態概念與正確術語' },
            { criterion: '過程 / 循環描述', max: 5, focus: '能量流動 / 物質循環次序' },
            { criterion: '數據 / 應用', max: 3, focus: '取樣估算、環境議題分析' },
            { criterion: '表達 / 標示', max: 2, focus: '箭頭 / 流向、圖示清楚' },
          ],
          issueTypes: ['concept', 'data', 'term', 'application'],
        },
        {
          key: 'experimental-skills',
          label: '實驗設計、數據詮釋與探究技能',
          keyConcepts: ['操控變量 / 應變變量 / 控制變量之辨識', '對照組（control）之設立與作用', '公平測試（fair test）、重複（replication）與可靠性 / 信度', '結果之記錄、製圖與趨勢描述', '結論與限制 / 改進建議', '常見裝置（如呼吸計 respirometer、光合產氧計數）之原理'],
          markingConventions: ['設計題必答對照組與「只改一個變量」之公平測試', '數據題要引具體數值（quote figures）並描述趨勢轉折', '結論須扣返假設 / 題目所問，唔可超出數據作過度推論', '評鑑題要指出限制（樣本少 / 未重複）並提可行改進'],
          commonErrors: ['變量分類混淆（把控制變量當操控變量）', '漏設對照組或對照組設計不當', '只講趨勢「上升 / 下降」唔引數據', '結論過度推論（超出數據範圍）', '改進建議空泛（如只寫「做仔細啲」而非具體步驟）'],
          rubric: [
            { criterion: '實驗設計 / 變量', max: 6, focus: '對照、變量、公平測試' },
            { criterion: '數據詮釋', max: 5, focus: '引數據、描述趨勢' },
            { criterion: '結論 / 評鑑', max: 4, focus: '扣假設、限制與改進' },
            { criterion: '表達 / 標示', max: 2, focus: '圖表 / 單位清楚' },
          ],
          issueTypes: ['method', 'data', 'analysis', 'concept'],
        },
        {
          key: 'electives',
          label: '選修單元（卷二）',
          keyConcepts: ['人體與健康：免疫、疾病與健康風險', '應用生態學：保育、污染與可持續發展', '微生物與人類：微生物分類、發酵、致病與防治', '生物科技：基因工程、PCR、基因改造與倫理', '選修單元之數據 / 個案分析與論述', '科學與社會 / 倫理議題之平衡論證'],
          markingConventions: ['論述題要立場清晰、正反兼顧並用生物學原理支持', '個案 / 數據題要引資料作答，連繫所學原理', '生物科技題術語要準（如限制酶 / 載體 / 質粒 / DNA 連接酶）', '倫理題要持平、有理據，避免純情緒化主張'],
          commonErrors: ['論述只得結論欠論證 / 欠生物學支持', '抗體 / 抗原 / 疫苗概念混淆（主動 vs 被動免疫）', '基因工程步驟次序或工具（酶 / 載體）配錯', '個案題離題或唔引題目資料', '倫理題流於口號、缺正反平衡'],
          rubric: [
            { criterion: '概念 / 術語', max: 6, focus: '選修專題概念與正確術語' },
            { criterion: '論述 / 過程', max: 6, focus: '邏輯論證、步驟次序' },
            { criterion: '應用 / 評議', max: 4, focus: '引資料、平衡論證' },
            { criterion: '表達 / 組織', max: 2, focus: '結構清晰、術語準確' },
          ],
          issueTypes: ['concept', 'argument', 'term', 'application'],
        },
      ],
    },
  ],
  publicResources: [
    { label: 'HKEAA 生物 科目資訊（官方：課程評估 / 樣本試題 / 表現示例）', url: 'https://www.hkeaa.edu.hk/en/HKDSE/assessment/subject_information/category_a_subjects/biology/' },
    { label: 'HKEAA HKDSE 科目資訊總頁（如上連結失效時使用）', url: 'https://www.hkeaa.edu.hk/en/hkdse/assessment/subject_information/' },
    { label: 'EDB 生物課程及評估指引（中四至中六 Curriculum & Assessment Guide）', url: 'https://www.edb.gov.hk/en/curriculum-development/kla/science-edu/curriculum-doc.html' },
    { label: 'DSE Treasure — 生物歷屆試題（按課題分類）', url: 'https://dsetreasure.com/' },
    { label: 'AfterSchool — DSE 生物課題重點 / 答題技巧', url: 'https://www.afterschool.com.hk/' },
  ],
  source:
    '提煉自 HKEAA / EDB 生物課程及評估指引 / 評核大綱（卷一必修 60% + 卷二選修 20% + 校本評核 SBA 20%＝範疇 A 8% + 範疇 B 12%，三者合共 100%）+ 公開 marking scheme 慣例（point-marking / ORA 反向論述 / accept words 同義字 / structure–function）+ DSE 生物批改知識。官方考評報告（examiner report）及表現示例（sample performance）可逐題校準常見失分；現行卷數權重 / 分數分佈 / SBA 比例以 HKEAA 最新評核大綱為準。',
}
