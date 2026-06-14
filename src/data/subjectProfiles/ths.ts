import type { SubjectKnowledge } from './types'

// ============================================================
//  旅遊與款待 Tourism and Hospitality Studies（THS）科目知識檔案
//  ------------------------------------------------------------
//  公開試結構（現行 DSE，二卷 + 校本評核）：
//    公開考試佔 80%（卷一 + 卷二）+ 校本評核 SBA 佔 20%。
//    卷一 Paper 1（必修部分，佔科目總分 60%，約 2.5 小時）：
//      Section A 資料回應 / 短答（compulsory）+ Section B 結構式 /
//      短文式長題。覆蓋必修課題（業概論 / 客務服務 /
//      旅遊地理 / 安全與危機 / 市場營銷等核心範疇）。
//    卷二 Paper 2（選修部分，佔科目總分 20%，約 1.25 小時）：
//      結構式 / 短文式長題，考選修單元（如可持續旅遊、會展與主題
//      公園、酒店與餐飲營運等）；考生按所選讀單元作答。
//    校本評核 SBA（佔科目總分 20%；前為 30%，已調減至 20%）：
//      專題 / 實地考察報告，校內評核 —— 唔喺此 AI 批改範圍，
//      僅於 assessment 註明。
//  批改要訣（DSE THS 評卷慣例 — 提煉，非照搬官方 marking scheme）：
//    · 行業概念要準確（term），並扣返真實情境 / 持份者（application）；
//    · 高分答案要有分析 / 評估（argument），唔可淨係列舉 / 背誦；
//    · 資料回應題要引用題目提供嘅資料 / 數據作支撐（evidence / data）；
//    · 「建議 / 評估」題要有立場 + 理由 + 多角度衡量先到頂層；
//    · 表達（wording）：分點清晰、用詞專業、緊扣題目所問。
//  範疇對齊評核大綱：必修核心（業概論 + 客務 + 地理 + 市場 + 安全）/
//    選修單元（可持續 + MICE 與主題 + 酒店餐飲）。
//  提煉來源：HKEAA 旅遊與款待 課程及評估指引 / 評核大綱 + EDB 課程指引
//  + 公開行業 / 補習資源 + DSE THS 批改知識。官方考評報告 / 表現示例
//  可逐題校準常見失分。
//  版權：只提煉成衍生指引（準則 / 慣例 / 常見錯誤 / 命令詞 / 等級描述），
//  並無照搬 HKEAA 試題原文或官方 marking scheme 原句。
// ============================================================

const THS_PERSONA =
  '你係資深香港中學旅遊與款待科（Tourism and Hospitality Studies）評卷員，按 DSE THS 標準批改：行業概念要準確並扣返真實情境同持份者；高分答案要有分析 / 評估，唔可淨係列舉或背誦；資料回應題要引用題目提供嘅資料 / 數據作支撐；「建議 / 評估」題要有清晰立場、理由同多角度衡量；用詞要專業、分點清晰、緊扣題目所問。'

export const THS: SubjectKnowledge = {
  subject: 'ths',
  label: '旅遊與款待',
  lang: 'zh',
  assessment: {
    papers: [
      '卷一 Paper 1（必修部分，佔科目總分 60%，約 2.5 小時）：Section A 資料回應 / 短答（必答）+ Section B 結構式 / 短文式長題。覆蓋必修課題：旅遊與款待業概論、客務關係與服務、旅遊地理、安全與危機管理、市場營銷等核心範疇。',
      '卷二 Paper 2（選修部分，佔科目總分 20%，約 1.25 小時）：結構式 / 短文式長題，考選修單元（如可持續旅遊與生態旅遊、會展旅遊與主題公園、酒店營運與餐飲服務等）；考生按所選讀單元作答。',
      '校本評核 SBA（佔科目總分 20%）：專題研習 / 實地考察報告，校內評核 —— 唔喺此 AI 筆試批改範圍，僅作標示。',
    ],
    weightings: '公開考試 80%（卷一必修 60% + 卷二選修 20%）+ 校本評核 SBA 20% = 總分 100%。SBA 比重前為 30%，現已調減至 20%。等級 1–5**（七級）。確切百分比 / SBA 現行安排以 HKEAA 最新評核大綱為準。',
    questionTypes: [
      '短答 / 定義（行業詞彙、概念）',
      '資料回應（圖表 / 個案 / 數據 → 分析）',
      '結構式長題（分項作答、逐點展開）',
      '短文 / 議論式（建議 / 評估 / 比較）',
      '個案研究（情境 → 應用行業概念）',
      '地理 / 目的地題（位置、特色、吸引力）',
    ],
    sba: '校本評核（SBA）佔科目總分 20%（前為 30%，已調減至 20%），為專題研習 / 實地考察報告，校內評核，唔喺此 AI 批改範圍。確切比重 / 現行安排以 HKEAA 最新評核大綱為準。',
  },
  commandWords: [
    { word: '界定 / 何謂（Define / What is）', meaning: '準確寫出行業詞彙 / 概念嘅定義，用專業用語，唔好只舉例代替定義。' },
    { word: '描述（Describe）', meaning: '具體講出特徵 / 過程 / 情況，要有細節，唔止一句帶過。' },
    { word: '解釋（Explain）', meaning: '講清「點解 / 點樣」，要有因果 / 理由，唔止陳述事實。' },
    { word: '舉例說明（Illustrate / Give examples）', meaning: '用真實 / 貼題例子（行業 / 目的地 / 公司）支撐論點，例子要切合情境。' },
    { word: '分析（Analyse）', meaning: '拆解因素 / 影響 / 關係（如對持份者、對行業），唔可淨係列舉。' },
    { word: '比較（Compare / Contrast）', meaning: '逐點列出相同同相異之處，唔好各自分開描述完事。' },
    { word: '建議（Suggest / Recommend）', meaning: '提出可行措施 / 方案並交代理由，要扣返情境 / 對象（顧客 / 企業 / 目的地）。' },
    { word: '評估 / 你是否同意（Evaluate / To what extent）', meaning: '有清晰立場 + 多角度衡量利弊 / 程度，並下判斷，唔可只列一面。' },
    { word: '參考資料（With reference to the source）', meaning: '必須引用題目提供嘅圖表 / 個案 / 數據作支撐，唔可空談。' },
  ],
  levelDescriptors: [
    { level: '高（5–5**）', descriptor: '行業概念準確而全面；緊扣情境 / 持份者並有具體例子；有深入分析 / 評估同清晰立場；引用資料恰當；組織嚴謹、用詞專業。' },
    { level: '中（3–4）', descriptor: '概念大致正確、有一定應用；有解釋但分析未夠深入，部分靠列舉；例子 / 引用資料尚可；組織清晰、用詞合宜。' },
    { level: '低（1–2）', descriptor: '概念含糊或有誤；多屬背誦 / 堆砌而少應用；甚少分析、無明確立場；偏離題目或欠例子；組織鬆散、用詞欠準。' },
    { level: '未達標（U / 0）', descriptor: '答非所問或內容極少；概念嚴重錯誤；無扣情境亦無資料支撐。' },
  ],
  strands: [
    // ───────────────── 必修核心 ─────────────────
    {
      key: 'core',
      label: '必修部分（卷一核心）',
      persona: THS_PERSONA,
      areas: [
        {
          key: 'industry-overview',
          label: '旅遊與款待業概論',
          keyConcepts: [
            '五大行業範疇（住宿 / 餐飲 / 旅遊及相關服務 / 運輸 / 景點與消閒）',
            '旅遊與款待的相互依存（interdependence）',
            '持份者（stakeholders：旅客 / 企業 / 員工 / 政府 / 當地社區）',
            '產品 / 服務特性（無形性、不可分離、易消逝、異質性）',
            '行業對經濟 / 社會 / 文化 / 環境的影響',
            '旅客類型與動機（商務 / 消閒 / MICE / 探親）',
          ],
          markingConventions: [
            '行業範疇要分類清晰、舉行業例子',
            '「相互依存」要講明一環節點樣影響另一環節',
            '影響題要分正 / 負面 + 不同層面（經濟 / 社會 / 環境）',
            '答案要扣返指定持份者角度',
          ],
          commonErrors: [
            '混淆行業範疇（如把景點當住宿）',
            '只列舉影響而無分析 / 無分層面',
            '服務特性背得出卻唔識應用到情境',
            '答影響時漏咗負面 / 漏咗某持份者',
            '用語空泛、無行業例子',
          ],
          rubric: [
            { criterion: '概念 / 行業知識', max: 6, focus: '範疇 / 特性 / 持份者準確' },
            { criterion: '應用 / 情境', max: 5, focus: '扣真實行業例子 / 角度' },
            { criterion: '分析 / 評估', max: 4, focus: '影響分層、相互依存說理' },
            { criterion: '表達 / 組織', max: 3, focus: '分點清晰、用詞專業' },
          ],
          issueTypes: ['concept', 'term', 'application', 'argument'],
        },
        {
          key: 'customer-service',
          label: '客務關係與服務質素',
          keyConcepts: [
            '優質顧客服務（customer service）原則與要素',
            '顧客期望與顧客滿意度、忠誠度',
            '服務質素管理（SERVQUAL 等差距 / 維度概念）',
            '處理顧客投訴與服務補救（service recovery）',
            '服務文化、待客之道與第一印象 / 關鍵時刻',
            '不同顧客需要（無障礙 / 文化差異 / 特殊需求）',
          ],
          markingConventions: [
            '服務原則要扣返具體服務情境作答',
            '投訴處理要有步驟 / 程序 + 補救措施',
            '「建議改善」題要可行、針對問題根源',
            '評估服務質素要用維度 / 準則而非主觀感覺',
          ],
          commonErrors: [
            '只講「對顧客好啲」之類空泛建議',
            '投訴處理欠步驟 / 欠服務補救概念',
            '混淆顧客滿意度與忠誠度',
            '服務質素維度背誦但無應用',
            '無扣情境中顧客的具體需要',
          ],
          rubric: [
            { criterion: '概念 / 服務知識', max: 6, focus: '服務原則 / 質素維度準確' },
            { criterion: '應用 / 情境', max: 6, focus: '措施扣個案、可行針對' },
            { criterion: '分析 / 評估', max: 4, focus: '說理、衡量成效' },
            { criterion: '表達 / 組織', max: 3, focus: '步驟清晰、用詞專業' },
          ],
          issueTypes: ['concept', 'application', 'argument', 'wording'],
        },
        {
          key: 'tourism-geography',
          label: '旅遊地理與目的地',
          keyConcepts: [
            '世界主要旅遊區域 / 目的地與時區概念',
            '目的地吸引力（自然 / 文化 / 人造景點）',
            '推 / 拉因素（push & pull factors）',
            '氣候 / 季節性對旅遊的影響',
            '交通可達性與旅遊路線規劃',
            '目的地生命週期與承載力概念',
          ],
          markingConventions: [
            '目的地題要寫具體位置 / 國家 / 地區',
            '吸引力要分類（自然 / 文化 / 人造）並舉例',
            '推拉因素要分清來源地（push）與目的地（pull）',
            '季節性 / 氣候題要連繫到旅客流量',
          ],
          commonErrors: [
            '目的地位置 / 國家張冠李戴（fact）',
            '推因素與拉因素混淆',
            '吸引力分類不清、無例子',
            '忽略氣候 / 季節對需求的影響',
            '路線規劃無考慮可達性 / 時間',
          ],
          rubric: [
            { criterion: '地理知識準確', max: 6, focus: '位置 / 目的地 / 吸引力正確' },
            { criterion: '應用 / 情境', max: 5, focus: '推拉 / 季節扣旅客行為' },
            { criterion: '分析 / 評估', max: 4, focus: '因素影響說理' },
            { criterion: '表達 / 組織', max: 3, focus: '分類清晰、用詞專業' },
          ],
          issueTypes: ['concept', 'fact', 'application', 'argument'],
        },
        {
          key: 'marketing-safety',
          label: '市場營銷與安全危機管理',
          keyConcepts: [
            '市場營銷組合（7Ps：產品 / 價格 / 地點 / 推廣 / 人員 / 過程 / 實體環境）',
            '市場區隔、目標市場與市場定位（STP）',
            '推廣策略與品牌 / 形象',
            '安全與保安（旅客 / 員工 / 設施安全）',
            '危機管理週期（預防 / 準備 / 應對 / 復原）',
            '風險評估與應變計劃、保險概念',
          ],
          markingConventions: [
            '7Ps 要逐項扣返指定產品 / 企業，唔好淨係背列表',
            'STP 要分清區隔基礎 / 目標 / 定位三步',
            '危機管理要按週期階段分項作答',
            '安全措施要針對情境中具體風險',
          ],
          commonErrors: [
            '7Ps 只列名而無應用到個案',
            '混淆市場區隔與市場定位',
            '危機管理只講「應對」漏咗預防 / 復原',
            '安全措施空泛、唔針對個案風險',
            '推廣策略與其他 P 重疊不分',
          ],
          rubric: [
            { criterion: '概念 / 框架準確', max: 6, focus: '7Ps / STP / 危機週期正確' },
            { criterion: '應用 / 情境', max: 6, focus: '逐項扣企業 / 風險' },
            { criterion: '分析 / 評估', max: 4, focus: '策略成效、措施說理' },
            { criterion: '表達 / 組織', max: 3, focus: '分項清晰、用詞專業' },
          ],
          issueTypes: ['concept', 'term', 'application', 'argument'],
        },
      ],
    },

    // ───────────────── 選修單元 ─────────────────
    {
      key: 'electives',
      label: '選修部分（卷二）',
      persona: THS_PERSONA,
      areas: [
        {
          key: 'sustainable-tourism',
          label: '可持續旅遊與生態旅遊',
          keyConcepts: [
            '可持續發展三支柱（經濟 / 社會 / 環境）',
            '生態旅遊（ecotourism）原則與責任旅遊',
            '過度旅遊（overtourism）與承載力',
            '旅遊對環境 / 社區 / 文化的正負影響',
            '持份者責任與綠色 / 環保措施',
            '社區為本旅遊與文化保育',
          ],
          markingConventions: [
            '可持續題要兼顧三支柱、避免只講環境',
            '措施要可行並扣返指定持份者責任',
            '評估題要衡量利弊 / 短期與長期',
            '引用個案 / 數據支撐論點',
          ],
          commonErrors: [
            '把可持續旅遊窄化為「環保 / 唔污染」',
            '措施空泛、無分持份者角色',
            '只列影響無評估 / 無立場',
            '混淆生態旅遊與一般觀光',
            '忽略資料 / 數據支撐（evidence）',
          ],
          rubric: [
            { criterion: '概念 / 可持續知識', max: 6, focus: '三支柱 / 生態旅遊準確' },
            { criterion: '應用 / 情境', max: 6, focus: '措施扣持份者 / 個案' },
            { criterion: '分析 / 評估', max: 5, focus: '利弊衡量、立場明確' },
            { criterion: '表達 / 組織', max: 3, focus: '論點分明、用詞專業' },
          ],
          issueTypes: ['concept', 'application', 'argument', 'evidence'],
        },
        {
          key: 'mice-attractions',
          label: '會展旅遊（MICE）與主題公園',
          keyConcepts: [
            'MICE 四範疇（Meetings 商務會議 / Incentives 獎勵旅遊 / Conventions 大型會議 / 大會（亦作 Conferences 研討會）/ Exhibitions 展覽）',
            'MICE 對目的地經濟 / 形象的效益',
            '場地 / 設施與接待要求',
            '主題公園 / 景點的營運與遊客體驗管理',
            '排隊 / 人流 / 容量管理與安全',
            '景點吸引力與重遊誘因',
          ],
          markingConventions: [
            'MICE 要分清四範疇、舉貼題例子',
            '效益題要分層面（經濟 / 形象 / 就業）',
            '主題公園題要扣遊客體驗 / 營運實務',
            '人流 / 安全措施要針對情境',
          ],
          commonErrors: [
            'MICE 四範疇混淆或漏項',
            '效益只講「賺錢」無分層面',
            '主題公園答成一般景點、欠營運角度',
            '人流管理措施空泛',
            '無扣個案具體情境',
          ],
          rubric: [
            { criterion: '概念 / 行業知識', max: 6, focus: 'MICE / 景點營運準確' },
            { criterion: '應用 / 情境', max: 6, focus: '措施扣個案 / 遊客體驗' },
            { criterion: '分析 / 評估', max: 4, focus: '效益分層、說理' },
            { criterion: '表達 / 組織', max: 3, focus: '分項清晰、用詞專業' },
          ],
          issueTypes: ['concept', 'term', 'application', 'argument'],
        },
        {
          key: 'hotel-catering',
          label: '酒店營運與餐飲服務',
          keyConcepts: [
            '酒店部門與運作（前堂 / 房務 / 餐飲 / 後勤）',
            '房價 / 入住率 / 收益管理（yield management）概念',
            '餐飲服務形式（餐桌服務 / 自助 / 宴會等）',
            '食物安全與衞生（HACCP 概念）',
            '人手編排與服務流程',
            '賓客體驗與服務質素',
          ],
          markingConventions: [
            '部門 / 服務形式要分類清晰並舉例',
            '收益 / 入住率題如涉計算要列式、帶單位（%）',
            '食物安全要扣具體衞生程序',
            '建議題要可行、針對營運問題',
          ],
          commonErrors: [
            '混淆酒店部門職能',
            '入住率 / 房價 / 收益概念計算或定義錯（calc）',
            '餐飲服務形式分不清',
            '食物安全空泛、欠 HACCP / 程序',
            '建議與情境脫節',
          ],
          rubric: [
            { criterion: '概念 / 營運知識', max: 6, focus: '部門 / 服務 / 衞生準確' },
            { criterion: '應用 / 情境', max: 6, focus: '措施扣營運個案' },
            { criterion: '分析 / 計算正確', max: 4, focus: '收益 / 入住率列式無誤' },
            { criterion: '表達 / 組織', max: 3, focus: '分類清晰、用詞專業' },
          ],
          issueTypes: ['concept', 'application', 'calc', 'argument'],
        },
      ],
    },
  ],
  publicResources: [
    { label: 'HKEAA 旅遊與款待 科目資訊（官方：課程評估 / 樣本試題 / 評核大綱）', url: 'https://www.hkeaa.edu.hk/en/hkdse/assessment/subject_information/' },
    { label: 'HKEAA HKDSE 科目資訊總頁（搜尋 Tourism and Hospitality Studies）', url: 'https://www.hkeaa.edu.hk/en/HKDSE/assessment/subject_information/category_a_subjects/' },
    { label: 'EDB 旅遊與款待 課程及評估指引（官方課程文件）', url: 'https://www.edb.gov.hk/en/curriculum-development/kla/pshe/references-and-resources/tourism-and-hospitality-studies/index.html' },
    { label: 'UNWTO 聯合國世界旅遊組織（可持續旅遊 / 行業趨勢權威資料）', url: 'https://www.unwto.org/' },
    { label: '香港旅遊發展局（HKTB：本地目的地 / 業界數據與營銷個案）', url: 'https://www.discoverhongkong.com/' },
  ],
  source:
    '提煉自 HKEAA 旅遊與款待 課程及評估指引 / 評核大綱（公開試 80%：卷一必修 60% + 卷二選修 20%；校本評核 SBA 20%，前為 30% 已調減）+ EDB 課程指引 + 公開行業 / 補習資源（UNWTO / 旅發局等）+ DSE THS 批改知識。官方考評報告（examiner report）/ 表現示例可逐題校準常見失分。確切比重 / SBA 現行安排以 HKEAA 最新評核大綱為準。',
}
