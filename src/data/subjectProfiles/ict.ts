import type { SubjectKnowledge } from './types'

// ============================================================
//  資訊及通訊科技（Information and Communication Technology）科目知識檔案
//  ------------------------------------------------------------
//  公開試結構（現行 DSE，category A 選修科）：公開考試佔 80% + 校本評核 SBA 佔 20%。
//    卷一 Paper 1 必修部分（佔全科 40%，2 小時）：
//      · Section A — 選擇題（MC）；
//      · Section B — 短答 / 結構式問題（須列步驟 / 解釋 / 填圖表）。
//      覆蓋必修課題：資訊處理、電腦系統基礎、互聯網及其應用、
//      基本程序編寫概念、資訊系統對社會的影響。
//    卷二 Paper 2 選修部分（佔全科 40%，1.5 小時）：四個選修單元四選一作答——
//      A 數據庫 / B 數據通訊及建網 / C 多媒體製作及網站建構 /
//      D 軟件開發；全為結構式 / 長題。
//    校本評核 SBA（佔全科 20%）：兩個導引習作——(1) 設計與實施、
//      (2) 測試與評估（校內評核，唔喺此 AI 批改範圍，於此檔只作結構說明）。
//  批改慣例（DSE marking scheme 通則，提煉非照搬）：
//    · 概念 / 術語題逐點給分（point-marking），意思啱用詞唔精準酌量；
//    · 演算法 / 程式 / SQL / 流程圖睇邏輯正確（語法寬鬆、可接受偽代碼），
//      但要 follow-through：前一步邏輯啱、後續一致即給方法分；
//    · 計算題（二進 / 十六進 / 容量 / 頻寬 / 解析度）要列式、帶單位；
//    · 「解釋 / 比較」題唔可淨係抄定義，要扣題目情境作答；
//    · 接受中英術語對照（如 RAM / 隨機存取記憶體）。
//  提煉來源：EDB / HKEAA ICT 課程及評估指引 + HKEAA 評核大綱（卷別 /
//  權重 / 題型）+ 公開教學資源對演算法 / 數據庫 / 網絡常見錯誤嘅整理
//  + DSE ICT 批改知識。官方考生表現示例 / 考評報告可逐題校準失分。
//  版權：只提煉成衍生指引（準則 / 慣例 / 常見錯誤 / 命令詞 / 等級描述），
//  絕不照搬 HKEAA 試題原文或官方 marking scheme 原句。
// ============================================================

const ICT_PERSONA =
  '你係資深香港中學資訊及通訊科技（ICT）科評卷員，按 DSE ICT 標準批改：概念 / 術語題逐點給分（意思啱、用詞稍欠都酌量），接受中英術語對照；演算法 / 程式 / SQL / 流程圖睇邏輯正確（語法寬鬆、可接受偽代碼），前一步啱、後續一致就 follow-through 給方法分；計算題（進位制 / 容量 / 頻寬等）要列式並帶單位；「解釋 / 比較」題要扣題目情境，唔可淨係背定義；標出概念混淆、技術 / 邏輯錯誤、術語誤用同離題。'

export const ICT: SubjectKnowledge = {
  subject: 'ict',
  label: '資訊及通訊科技',
  lang: 'zh',
  assessment: {
    papers: [
      '卷一 Paper 1 必修部分（佔全科 40%，2 小時）：Section A 選擇題（MC）+ Section B 短答 / 結構式問題（須列步驟、解釋或填圖 / 表）。覆蓋資訊處理、電腦系統基礎、互聯網及其應用、基本程序編寫概念、資訊系統對社會的影響。',
      '卷二 Paper 2 選修部分（佔全科 40%，1.5 小時）：四個選修單元四選一作答——A 數據庫 / B 數據通訊及建網 / C 多媒體製作及網站建構 / D 軟件開發；全為結構式 / 長題，須展示應用與解難。',
      '校本評核 SBA（佔全科 20%）：兩個導引習作——(1) 設計與實施、(2) 測試與評估（校內評核，唔喺此 AI 批改範圍，於此檔只作結構說明）。',
    ],
    weightings: '公開考試 80%（卷一必修 40% + 卷二選修四選一 40%）· 校本評核 SBA 20%。成績分七級（1、2、3、4、5、5*、5**）。',
    questionTypes: [
      '選擇題（MC，卷一 Section A）',
      '概念 / 術語定義與解釋（短答）',
      '比較 / 區分（如 RAM vs ROM、LAN vs WAN）',
      '計算題（二進 / 十六進轉換、檔案 / 儲存容量、頻寬 / 傳輸時間、解析度）',
      '演算法 / 偽代碼 / 流程圖設計與追蹤（trace table）',
      '程式碼閱讀與除錯（debug）',
      'SQL 查詢與數據庫設計（ERD / 正規化，卷二 A 數據庫）',
      '網絡 / 通訊協定情境題（卷二 B 數據通訊及建網）',
      '多媒體 / 網站建構應用（卷二 C 多媒體製作及網站建構）',
      '軟件開發生命周期與系統分析（卷二 D 軟件開發）',
      '資訊道德 / 私隱 / 法律與社會影響論述',
    ],
    sba: '校本評核佔全科 20%，由兩個導引習作組成：(1) 設計與實施、(2) 測試與評估，由任教老師按校內評核準則評分；唔喺此 AI 批改範圍。',
  },
  commandWords: [
    { word: '描述 / 說明（Describe）', meaning: '具體講出特徵 / 步驟 / 運作，唔可淨係寫個名詞。' },
    { word: '解釋 / 為何（Explain / Why）', meaning: '講出原因 / 因果 / 點解會咁，要有推理而非單純陳述。' },
    { word: '比較 / 區分（Compare / Distinguish）', meaning: '逐點列出相同與不同（如速度 / 揮發性 / 用途），最好成對對照。' },
    { word: '舉例（Give an example）', meaning: '提供切合情境的具體例子（軟件 / 硬件 / 應用），避免空泛。' },
    { word: '計算（Calculate）', meaning: '列出算式與步驟，最後答案要帶單位（bit / byte / KB / Mbps 等）。' },
    { word: '寫出演算法 / 偽代碼（Write an algorithm / pseudocode）', meaning: '用清晰步驟 / 控制結構表達邏輯；語法寬鬆，重點係邏輯正確、輸入輸出明確。' },
    { word: '繪畫 / 完成流程圖（Draw / Complete a flowchart）', meaning: '用正確符號（開始 / 終止、輸入輸出、處理、判斷）並標明流向。' },
    { word: '寫出 SQL 語句（Write an SQL statement）', meaning: '按要求寫 SELECT / WHERE / JOIN 等；欄名 / 表名 / 條件要對應題目數據庫。' },
    { word: '建議 / 評估（Suggest / Evaluate）', meaning: '提出可行方案並衡量利弊 / 適切性，扣題目情境作判斷。' },
  ],
  levelDescriptors: [
    { level: '高（5–5**）', descriptor: '概念 / 術語準確完整；演算法 / SQL / 計算邏輯正確且有效率；能扣情境分析與評估，比較全面；表達清晰、用詞精準。' },
    { level: '中（3–4）', descriptor: '概念大致正確，偶有混淆；技術 / 邏輯大致可行但有小錯（如邊界條件、語法瑕疵）；應用尚算切題但分析略淺；用詞偶欠精準。' },
    { level: '低（1–2）', descriptor: '概念 / 術語錯誤較多；演算法 / 計算邏輯不通或不完整；答非所問或淨係背定義；表達混亂。' },
  ],
  strands: [
    // ───────────── 必修：系統與網絡基礎 ─────────────
    {
      key: 'systems-networks',
      label: '電腦系統與網絡（必修）',
      persona: ICT_PERSONA,
      areas: [
        {
          key: 'data-representation',
          label: '資訊處理與數據表示',
          keyConcepts: [
            '數字系統（二進 / 十進 / 十六進）與互相轉換',
            '數據編碼（ASCII / Unicode、BCD、整數補碼、浮點概念）',
            '位元 / 位元組與容量單位（bit / byte / KB / MB / GB，1 KB = 1024 bytes）',
            '檔案大小估算（點陣圖 = 闊 × 高（像素）× 色深；聲音 = 取樣率 × 位深 × 聲道 × 時長）',
            '數據與資訊的分別、資料壓縮（有損 vs 無損）',
            '邏輯運算（AND / OR / NOT、真值表）',
          ],
          markingConventions: [
            '進位制轉換要列中間步驟，唔可淨寫答案',
            '容量計算要分清 bit 與 byte、1024 與 1000，最後帶單位',
            '檔案大小公式要寫出並代入數值',
            '補碼 / 編碼題接受合理對照表表達',
          ],
          commonErrors: [
            '二進 / 十六進轉換進位錯或漏位',
            'bit 與 byte 混淆（除 8 漏做）',
            '用 1000 當 1024（或相反）致容量答案錯',
            '圖像 / 聲音檔案大小漏乘色深 / 聲道 / 取樣率某項',
            '有損 vs 無損壓縮特性講反',
            '最後答案漏單位',
          ],
          rubric: [
            { criterion: '概念 / 表示法', max: 5, focus: '數字系統 / 編碼 / 單位正確' },
            { criterion: '計算與步驟', max: 5, focus: '轉換 / 容量列式無誤、follow-through' },
            { criterion: '答案準確（含單位）', max: 3, focus: '正確值 + 單位' },
            { criterion: '術語 / 表達', max: 2, focus: '用詞精準、對照清楚' },
          ],
          issueTypes: ['concept', 'calc', 'unit', 'term'],
        },
        {
          key: 'computer-systems',
          label: '電腦系統基礎（硬件 / 軟件 / 作業系統）',
          keyConcepts: [
            '硬件組成（CPU、記憶體層級、輸入 / 輸出、儲存裝置）',
            '記憶體（RAM vs ROM、cache、虛擬記憶體）',
            '系統軟件 vs 應用軟件、作業系統功能（程序 / 記憶體 / 檔案 / 裝置管理）',
            '機器周期（fetch-decode-execute）與匯流排',
            '軟件授權（專有 / 自由 / 開源 / freeware / shareware）',
            '效能因素（時脈、核心數、記憶體容量、儲存類型 SSD vs HDD）',
          ],
          markingConventions: [
            '比較題（RAM vs ROM 等）要逐項對照（揮發性 / 可寫性 / 用途）',
            '硬件 / 軟件分類題要歸類正確並舉切題例子',
            '作業系統功能要講「做咩」與「點解需要」',
            '接受中英術語對照',
          ],
          commonErrors: [
            'RAM / ROM 揮發性與用途講反',
            '系統軟件當應用軟件（如把作業系統當應用程式）',
            '混淆 cache 與 RAM、虛擬記憶體與實體記憶體',
            '機器周期步驟次序錯或漏 decode',
            '軟件授權類型（開源 vs freeware）混淆',
            '比較題只寫單邊、無對照',
          ],
          rubric: [
            { criterion: '概念 / 分類', max: 5, focus: '硬件 / 軟件 / OS 功能正確' },
            { criterion: '比較 / 解釋', max: 5, focus: '逐項對照、因果清楚' },
            { criterion: '應用 / 例子', max: 3, focus: '切題例子、扣情境' },
            { criterion: '術語 / 表達', max: 2, focus: '用詞精準' },
          ],
          issueTypes: ['concept', 'term', 'application', 'content'],
        },
        {
          key: 'internet-networking',
          label: '互聯網及其應用',
          keyConcepts: [
            '網絡類型與拓樸（LAN / WAN、星型 / 匯流排 / 環型）',
            '傳輸媒介與裝置（switch / router / modem、有線 vs 無線）',
            'IP 位址 / domain / DNS、客戶端–伺服器 vs 對等網絡',
            '互聯網服務與協定（HTTP/HTTPS、FTP、SMTP/POP/IMAP）',
            '頻寬 / 傳輸速率與傳輸時間計算',
            '網絡安全（防火牆、加密、認證、惡意軟件 / 釣魚）',
          ],
          markingConventions: [
            '傳輸時間 = 檔案大小 ÷ 頻寬，要統一單位（bit vs byte）再計',
            '協定題要對應正確用途（如收發電郵用 SMTP / POP）',
            '網絡裝置功能要講清在哪一層 / 做咩工作',
            '安全題要扣威脅與對應防護措施',
          ],
          commonErrors: [
            '頻寬計算單位唔統一（Mbps 與 MB 混用、漏除 8）',
            'LAN / WAN 範圍與例子搞錯',
            '協定用途張冠李戴（HTTP 當 FTP、SMTP 當 POP）',
            'switch 與 router 功能混淆',
            'HTTPS / 加密只講「安全」無講機制',
            '對等網絡與客戶端–伺服器分別講唔清',
          ],
          rubric: [
            { criterion: '概念 / 協定', max: 5, focus: '網絡 / 協定 / 裝置正確' },
            { criterion: '計算 / 解釋', max: 5, focus: '傳輸計算列式、機制因果' },
            { criterion: '應用 / 安全', max: 3, focus: '扣情境、威脅對防護' },
            { criterion: '術語 / 表達', max: 2, focus: '用詞精準、單位正確' },
          ],
          issueTypes: ['concept', 'calc', 'term', 'application'],
        },
      ],
    },

    // ───────────── 必修：程序編寫與資訊社群 ─────────────
    {
      key: 'programming-society',
      label: '程序編寫與資訊社群（必修）',
      persona: ICT_PERSONA,
      areas: [
        {
          key: 'algorithms-programming',
          label: '基本程序編寫概念（演算法 / 程式 / 流程圖）',
          keyConcepts: [
            '演算法表達（偽代碼、流程圖、結構化步驟）',
            '控制結構（順序 / 選擇 if-else / 迴圈 while-for）',
            '變數、資料型別、運算子、輸入輸出',
            '陣列 / 串列、常用演算法（求和 / 最大最小、線性搜尋、簡單排序）',
            '程式追蹤（trace table）與除錯（語法 / 邏輯 / 執行期錯誤）',
            '模組化（函數 / 程序、參數）與程式可讀性',
          ],
          markingConventions: [
            '演算法 / 程式睇邏輯正確，語法寬鬆（接受偽代碼 / 常見語言）',
            'follow-through：前段邏輯啱、後段一致就給方法分',
            '迴圈 / 判斷要留意邊界條件與初始化',
            'trace table 要逐步列變數值；流程圖要用正確符號與流向',
            '輸入輸出與終止條件要明確',
          ],
          commonErrors: [
            '迴圈邊界錯（off-by-one、漏初始化累加器）',
            '判斷條件用錯運算子（> vs >=、= vs ==）',
            '無限迴圈（漏更新控制變數）',
            '陣列索引越界或由 1 數起 / 由 0 數起混淆',
            'trace table 漏更新某變數或追蹤次序錯',
            '流程圖判斷符號 / 流向用錯',
            '把語法錯當邏輯錯（反之亦然）誤判錯誤類型',
          ],
          rubric: [
            { criterion: '邏輯 / 演算法', max: 6, focus: '控制結構 / 邏輯正確、可行' },
            { criterion: '步驟 / 追蹤', max: 5, focus: 'trace / 流程完整、follow-through' },
            { criterion: '輸入輸出 / 邊界', max: 3, focus: '初始化、終止、邊界正確' },
            { criterion: '表達 / 可讀性', max: 2, focus: '符號 / 命名清楚' },
          ],
          issueTypes: ['concept', 'method', 'step', 'application'],
        },
        {
          key: 'info-society-impact',
          label: '資訊社群、道德、私隱與社會影響',
          keyConcepts: [
            '資訊素養與資料可靠性評估',
            '知識產權與版權（軟件授權、抄襲、合理使用）',
            '個人資料私隱（收集 / 使用原則、《個人資料（私隱）條例》概念）',
            '電腦罪行與網絡安全道德（黑客、惡意軟件、網絡欺凌）',
            '健康與人體工學（重複性勞損、視力、姿勢）',
            '數碼鴻溝、環保（電子廢物）與資訊系統的社會 / 經濟影響',
          ],
          markingConventions: [
            '論述題要扣具體情境 / 持份者，唔可空泛口號',
            '道德 / 法律題要指出原則與後果，最好正反兼顧',
            '私隱題要連繫收集 / 使用 / 保存的合理做法',
            '舉例要切題（真實技術 / 場景）',
          ],
          commonErrors: [
            '答案空泛、淨係喊口號（如「要小心」）無理據',
            '混淆版權 / 私隱 / 電腦罪行的概念界線',
            '只講單方面好處或壞處、欠多角度',
            '法律 / 條例張冠李戴或亂套',
            '舉例離題或重複同一個例子',
          ],
          rubric: [
            { criterion: '概念 / 原則', max: 5, focus: '道德 / 法律 / 私隱概念正確' },
            { criterion: '論證 / 多角度', max: 6, focus: '扣情境、正反兼顧' },
            { criterion: '舉例 / 應用', max: 4, focus: '切題具體例子' },
            { criterion: '結構 / 表達', max: 2, focus: '組織清楚、用詞恰當' },
          ],
          issueTypes: ['concept', 'argument', 'application', 'term'],
        },
      ],
    },

    // ───────────── 選修部分（卷二，四選一） ─────────────
    {
      key: 'electives',
      label: '選修單元（卷二，四選一）',
      persona: ICT_PERSONA,
      areas: [
        {
          key: 'databases',
          label: 'A 數據庫（設計 / ERD / 正規化 / SQL）',
          keyConcepts: [
            '關聯式模型（表 / 列 / 欄、主鍵 / 外鍵、關係基數）',
            '實體關係圖（ERD）與數據庫設計',
            '正規化（1NF / 2NF / 3NF、消除冗餘與異常）',
            'SQL（SELECT / WHERE / ORDER BY / GROUP BY、JOIN、INSERT / UPDATE / DELETE）',
            '資料完整性（實體 / 參照完整性）與索引概念',
            '數據庫 vs 檔案系統的優點',
          ],
          markingConventions: [
            'SQL 睇邏輯正確：表名 / 欄名 / 條件要對應題目 schema，語法小瑕疵酌量',
            'JOIN 條件與篩選要正確；GROUP BY 與聚合函數配合',
            'ERD 要標明主鍵 / 外鍵與關係基數（1:1 / 1:m / m:n）',
            '正規化要指出違反哪個範式並修正',
          ],
          commonErrors: [
            'SQL 漏 WHERE 條件或條件邏輯錯',
            'JOIN 漏連接條件致笛卡兒積',
            '誤把多值 / 重複組當已正規化',
            '主鍵 / 外鍵指派錯、關係基數標反',
            'GROUP BY 與非聚合欄混用',
            '欄名 / 表名與題目 schema 不符',
          ],
          rubric: [
            { criterion: '數據庫概念 / 設計', max: 5, focus: 'ERD / 鍵 / 正規化正確' },
            { criterion: 'SQL / 邏輯', max: 6, focus: '查詢邏輯正確、對應 schema' },
            { criterion: '應用 / 完整性', max: 4, focus: '完整性 / 情境解難' },
            { criterion: '術語 / 表達', max: 2, focus: '用詞精準' },
          ],
          issueTypes: ['concept', 'method', 'application', 'term'],
        },
        {
          key: 'data-communications',
          label: 'B 數據通訊及建網',
          keyConcepts: [
            '網絡架構與拓樸、OSI / TCP-IP 分層概念',
            '通訊協定與封包交換、定址與路由',
            '傳輸媒介、調變、頻寬 / 傳輸率 / 延遲',
            '無線網絡（Wi-Fi / 行動網絡）與標準',
            '網絡安全（加密、VPN、防火牆、認證）',
            '錯誤偵測 / 更正（同位、檢查碼概念）',
          ],
          markingConventions: [
            '分層 / 協定題要對應正確層次與功能',
            '計算（傳輸率 / 時間 / 封包數）要列式、統一單位',
            '安全機制要講原理而非淨係名詞',
            '情境題要建議切題方案並說明理由',
          ],
          commonErrors: [
            '協定 / 層次對應錯（如把路由放錯層）',
            '頻寬 / 傳輸時間單位混亂（bit vs byte、k vs K）',
            '混淆封包交換與電路交換',
            '加密類型（對稱 vs 非對稱）特性講反',
            '錯誤偵測與更正混為一談',
          ],
          rubric: [
            { criterion: '網絡 / 協定概念', max: 5, focus: '架構 / 分層 / 協定正確' },
            { criterion: '計算 / 機制', max: 6, focus: '計算列式、機制原理清楚' },
            { criterion: '應用 / 安全', max: 4, focus: '扣情境、方案合理' },
            { criterion: '術語 / 表達', max: 2, focus: '用詞精準、單位正確' },
          ],
          issueTypes: ['concept', 'calc', 'application', 'term'],
        },
        {
          key: 'multimedia-web',
          label: 'C 多媒體製作及網站建構',
          keyConcepts: [
            '多媒體元素（文字 / 圖像 / 聲音 / 視像 / 動畫）與檔案格式',
            '影像 / 聲音 / 視像數位化（解析度 / 色深 / 取樣率 / 位元率）與壓縮',
            '向量 vs 點陣圖形特性',
            'HTML / CSS 結構與排版、超連結與媒體嵌入',
            '網站設計原則（可用性、導覽、無障礙、一致性）',
            '版權與授權、檔案大小 / 載入效能取捨',
          ],
          markingConventions: [
            '檔案大小 / 壓縮計算要列式並帶單位',
            '格式選擇題要扣用途（如照片用 JPEG、透明 / 線條用 PNG / 向量）',
            'HTML / CSS 睇結構與標籤用途正確，語法寬鬆',
            '設計題要連繫使用者需求與原則',
          ],
          commonErrors: [
            '向量與點陣特性講反（放大失真）',
            '檔案大小計算漏色深 / 取樣率 / 時長某項',
            '格式選擇與用途不符',
            'HTML 標籤誤用或結構巢狀錯',
            '有損 vs 無損壓縮對品質影響講錯',
            '設計只談美觀、忽略可用性 / 無障礙',
          ],
          rubric: [
            { criterion: '多媒體 / 格式概念', max: 5, focus: '數位化 / 格式 / 壓縮正確' },
            { criterion: '計算 / 技術', max: 6, focus: '大小計算、HTML/CSS 邏輯正確' },
            { criterion: '設計 / 應用', max: 4, focus: '扣使用者需求與原則' },
            { criterion: '術語 / 表達', max: 2, focus: '用詞精準、單位正確' },
          ],
          issueTypes: ['concept', 'calc', 'application', 'term'],
        },
        {
          key: 'software-development',
          label: 'D 軟件開發',
          keyConcepts: [
            '系統開發生命周期（SDLC：分析 / 設計 / 實作 / 測試 / 維護）',
            '系統分析工具（DFD、資料字典、流程 / 結構圖）',
            '程式設計範式與結構化 / 模組化設計',
            '進階程式概念（陣列 / 紀錄、函數與參數、檔案處理、排序 / 搜尋演算法）',
            '測試策略（單元 / 整合、測試數據：正常 / 邊界 / 不正常）與除錯',
            '文件與系統維護（使用者 / 技術文件、維護類型）',
          ],
          markingConventions: [
            '程式 / 演算法睇邏輯正確並 follow-through，語法寬鬆',
            'SDLC 各階段要講「做咩」與「產出」',
            '測試題要設計能覆蓋正常 / 邊界 / 不正常的測試數據',
            'DFD / 結構圖要符號正確、流向合理',
          ],
          commonErrors: [
            'SDLC 階段次序或職能混淆',
            '測試數據只取正常值、漏邊界 / 不正常',
            '排序 / 搜尋演算法邏輯或邊界錯',
            'DFD 符號 / 資料流向用錯',
            '把測試與除錯概念混為一談',
            '函數參數 / 回傳值處理錯',
          ],
          rubric: [
            { criterion: '開發概念 / SDLC', max: 5, focus: '生命周期 / 分析工具正確' },
            { criterion: '程式 / 邏輯', max: 6, focus: '演算法邏輯正確、follow-through' },
            { criterion: '測試 / 應用', max: 4, focus: '測試數據設計、解難' },
            { criterion: '表達 / 文件', max: 2, focus: '符號 / 表達清楚' },
          ],
          issueTypes: ['concept', 'method', 'step', 'application'],
        },
      ],
    },
  ],
  publicResources: [
    { label: 'HKEAA 資訊及通訊科技 科目資訊（官方：課程評估 / 樣本試題 / 評核大綱）', url: 'https://www.hkeaa.edu.hk/en/HKDSE/assessment/subject_information/category_a_subjects/ict/' },
    { label: 'HKEAA HKDSE 科目資訊總頁（如上連結失效可由此入）', url: 'https://www.hkeaa.edu.hk/en/hkdse/assessment/subject_information/' },
    { label: 'EDB 資訊及通訊科技 課程及評估指引（官方課程文件）', url: 'https://www.edb.gov.hk/en/curriculum-development/kla/technology-edu/curriculum-doc/ict/index.html' },
    { label: 'EDB 科技教育學習領域（ICT 課程資源）', url: 'https://www.edb.gov.hk/en/curriculum-development/kla/technology-edu/index.html' },
  ],
  source:
    '提煉自 EDB / HKEAA 資訊及通訊科技課程及評估指引 + HKEAA 評核大綱（公開考試 80%：卷一必修 40% + 卷二選修四選一 40%；校本評核 SBA 20%，含設計與實施、測試與評估兩個導引習作）+ 公開教學資源對演算法 / 數據庫 / 網絡 / 計算題常見錯誤嘅整理 + DSE ICT 批改知識（逐點給分、邏輯 follow-through、計算帶單位、接受中英術語對照）。官方考生表現示例 / 考評報告可逐題校準常見失分。所有材料只提煉成衍生指引，未照搬 HKEAA 試題原文或官方 marking scheme 原句。',
}
