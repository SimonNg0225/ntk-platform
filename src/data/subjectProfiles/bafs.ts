import type { SubjectKnowledge } from './types'

// ============================================================
//  BAFS（企業、會計與財務概論）科目知識檔案 — 兩個選修範疇
//  ------------------------------------------------------------
//  範疇：必修部分 + 會計學習範疇 + 商業管理學習範疇。
//  提煉來源：HKDSE BAFS 課程及評估指引（2028）、會計／商業管理範疇補充
//  筆記（2025，中英）、Sample Paper（2025）+ DSE BAFS 批改慣例知識。
//  註：2025 Marking Scheme + 考生表現（MS+CP）為掃描檔，未能於本機 OCR；
//  批改慣例 / 常見錯誤先以通用 DSE 知識撰寫，日後有文字版可再校準。
// ============================================================

export const BAFS: SubjectKnowledge = {
  subject: 'bafs',
  label: '企業、會計與財務概論 (BAFS)',
  lang: 'zh',
  assessment: {
    papers: [
      '卷一（必修部分）：選擇題 + 短答 / 結構題，涵蓋商業環境、管理、會計與個人理財基礎',
      '卷二（選修部分）：考生二選一作答 —— 會計學習範疇 或 商業管理學習範疇 嘅結構 / 個案 / 長題',
    ],
    weightings: '公開考試（卷一 + 卷二）+ 校本評核（SBA）；確切比重以官方課程及評估指引為準。',
    questionTypes: ['卷一：選擇題 (MC) + 短答 / 結構題', '卷二 A 部：短題', '卷二 B 部：2–3 條個案分析（約 36 分）', '卷二 C 部：個案 / 論述題（約 20 分）', '會計：計算題（報表 / 比率 / 成本）', '商管：應用 / 評估題'],
    sba: '校本評核（如適用）—— 商業相關專題 / 探究。',
  },
  commandWords: [
    { word: '列出 / State / Identify', meaning: '寫出要點即可，唔使解釋。' },
    { word: '描述 / Describe', meaning: '具體講出特徵 / 過程，唔淨係列點。' },
    { word: '解釋 / Explain', meaning: '講「點解」+ 因果，扣概念。' },
    { word: '區分 / Distinguish', meaning: '逐點對比兩者差異。' },
    { word: '計算 / Calculate', meaning: '列式 + 計算步驟 + 帶單位 / 貨幣，方法分同答案分分開。' },
    { word: '編製 / Prepare', meaning: '依正確會計格式（標題、欄位、次序）編報表 / 帳目。' },
    { word: '分析 / Analyse', meaning: '拆解、扣數據 / 情境，講影響。' },
    { word: '評估 / Evaluate / Justify', meaning: '兩面論證 + 有理據嘅結論 / 建議。' },
    { word: '建議 / Suggest / Recommend', meaning: '提出可行方案並扣個案情境解釋。' },
  ],
  levelDescriptors: [
    { level: '高（5–5**）', descriptor: '概念準確、緊扣題目 / 個案，論證有深度兼兩面兼顧，計算 / 格式正確，用詞專業。' },
    { level: '中（4）', descriptor: '概念大致正確，有應用但深度一般 / 偶有遺漏，計算大致啱但有小錯。' },
    { level: '初（2–3）', descriptor: '只背誦定義、少應用，論證單薄，計算 / 格式多錯。' },
    { level: '低（1）', descriptor: '概念混淆、離題或大量錯誤。' },
  ],
  strands: [
    // ───────────────────── 必修部分 ─────────────────────
    {
      key: 'core',
      label: '必修部分',
      persona: '你係資深香港中學 BAFS 老師，批改必修部分（商業環境 / 管理 / 會計 / 個人理財）答案，按 DSE 標準。',
      areas: [
        {
          key: 'business-env',
          label: '商業環境 Business Environment',
          keyConcepts: ['商業活動形式與擁有權', '商業道德與社會責任 (CSR)', '營商環境（經濟 / 科技 / 法律 / 全球化）', '主要行業與香港經商'],
          markingConventions: ['要扣真實 / 個案情境作答，唔好空泛', '比較類要逐點對比', '評估類要兩面 + 結論'],
          commonErrors: ['只背定義唔應用', 'CSR 與道德混為一談', '忽略持份者多角度'],
          rubric: [
            { criterion: '概念準確', max: 4, focus: '商業環境概念是否正確' },
            { criterion: '應用情境', max: 4, focus: '有冇扣題目 / 個案' },
            { criterion: '論證 / 結構', max: 4, focus: '論點是否有理據、條理' },
          ],
          issueTypes: ['concept', 'application', 'argument', 'wording'],
        },
        {
          key: 'intro-mgmt',
          label: '管理概論 Introduction to Management',
          keyConcepts: ['管理職能（計劃 / 組織 / 領導 / 控制）', '管理層次與技能', '商業功能範疇概覽'],
          markingConventions: ['職能要對應情境舉例', '解釋類講因果'],
          commonErrors: ['混淆管理職能', '答案泛泛唔扣情境'],
          rubric: [
            { criterion: '概念準確', max: 4, focus: '管理概念是否正確' },
            { criterion: '應用', max: 4, focus: '扣情境舉例' },
            { criterion: '表達', max: 3, focus: '條理與用詞' },
          ],
          issueTypes: ['concept', 'application', 'wording'],
        },
        {
          key: 'intro-acct',
          label: '會計概論 Introduction to Accounting',
          keyConcepts: ['會計目的與使用者', '會計原則 / 假設', '會計等式與複式記帳概念'],
          markingConventions: ['原則要對應情境解釋', '會計等式要平衡'],
          commonErrors: ['原則背得出但用錯', '混淆資產 / 負債 / 權益'],
          rubric: [
            { criterion: '概念準確', max: 4, focus: '會計概念 / 原則' },
            { criterion: '應用', max: 4, focus: '扣情境' },
            { criterion: '表達', max: 3, focus: '條理' },
          ],
          issueTypes: ['concept', 'application', 'wording'],
        },
        {
          key: 'personal-finance',
          label: '個人理財基礎 Basics of Personal Financial Management',
          keyConcepts: ['個人理財目標與預算', '時間值與儲蓋 / 投資', '風險與回報、保險', '信貸與借貸'],
          markingConventions: ['計算（利息 / 回報）要列式 + 帶單位', '建議要扣個人情境'],
          commonErrors: ['風險回報關係講反', '忽略時間值', '建議空泛'],
          rubric: [
            { criterion: '概念準確', max: 4, focus: '理財概念' },
            { criterion: '計算 / 應用', max: 4, focus: '計算正確、扣情境' },
            { criterion: '建議論證', max: 3, focus: '建議是否可行有據' },
          ],
          issueTypes: ['concept', 'calc', 'application', 'argument'],
        },
      ],
    },

    // ───────────────────── 會計學習範疇 ─────────────────────
    {
      key: 'accounting',
      label: '會計學習範疇',
      persona: '你係資深香港中學 BAFS 會計範疇評卷員，重視會計格式、方法分同答案分，按 DSE 會計標準批改。',
      areas: [
        {
          key: 'double-entry',
          label: '複式簿記與原始分錄 Double-entry & books of original entry',
          keyConcepts: ['借貸法則', '日記帳 / 特種日記帳', '分類帳與過帳', '試算表'],
          markingConventions: ['借貸方向啱先得分', '過帳 / 結餘方法分獨立計', '試算表借貸平衡'],
          commonErrors: ['借貸方向相反', '漏過帳 / 結餘計錯', '科目名稱錯'],
          rubric: [
            { criterion: '借貸 / 分錄正確', max: 5, focus: '方向、科目、金額' },
            { criterion: '過帳 / 結餘', max: 4, focus: '過帳同結餘方法' },
            { criterion: '格式 / 列示', max: 3, focus: '帳簿格式' },
          ],
          issueTypes: ['concept', 'calc', 'step', 'wording'],
        },
        {
          key: 'financial-statements',
          label: '財務報表（獨資 / 合夥 / 有限公司）Financial statements',
          keyConcepts: ['損益表 / 全面收益表', '財務狀況表（資產負債表）', '折舊三法（直線 / 餘額遞減 / 用量）與資產出售（NBV = 成本 − 累計折舊）', '合夥損益分配', '有限公司權益 / 儲備'],
          markingConventions: ['格式分（標題 / 分類 / 次序）', '項目分類啱（流動 / 非流動）', '帶入正確調整後數', '方法分：用啱公式 / 結構即使數字錯都有分', '前後計算相扣：上一步算錯，後續用啱方法可獲跟帶分 (own figure)'],
          commonErrors: ['流動 / 非流動分類錯', '漏調整（折舊 / 應計 / 預付）', '合夥分配次序錯', '損益表 / 狀況表項目放錯位'],
          rubric: [
            { criterion: '項目分類 / 計算', max: 6, focus: '項目放對、數值正確' },
            { criterion: '報表格式', max: 4, focus: '標題、分類、次序' },
            { criterion: '調整處理', max: 4, focus: '折舊 / 應計 / 預付 / 壞帳' },
          ],
          issueTypes: ['concept', 'calc', 'step', 'wording'],
        },
        {
          key: 'adjustments',
          label: '會計調整與錯誤更正 Adjustments & correction of errors',
          keyConcepts: ['期末調整（折舊 / 應計 / 預付 / 壞帳準備 / 存貨估值）', '銀行對帳表', '資產出售損益', '錯誤類型（補償 / 原則 / 漏記…）', '更正分錄與暫記帳', '對淨利 / 結餘影響'],
          markingConventions: ['更正分錄借貸啱', '影響方向（高估 / 低估）講啱', '暫記帳結平', '銀行對帳：分清未過帳項目 vs 公司簿記錯誤'],
          commonErrors: ['調整方向相反', '混淆影響淨利定狀況表', '漏暫記帳', '誤以為補償 / 原則錯誤試算表查得到', '銀行對帳調整方向搞錯'],
          rubric: [
            { criterion: '調整 / 更正分錄', max: 5, focus: '借貸、金額' },
            { criterion: '影響分析', max: 4, focus: '對淨利 / 結餘影響' },
            { criterion: '表達', max: 3, focus: '列示清楚' },
          ],
          issueTypes: ['concept', 'calc', 'step'],
        },
        {
          key: 'incomplete-records',
          label: '不完整記錄 Incomplete records',
          keyConcepts: ['資本比較法求淨利', '控制帳推算賒銷 / 賒購', '現金 / 銀行對推算', '加成 / 毛利率還原'],
          markingConventions: ['推算步驟清楚，方法分獨立計', '用啱關係式'],
          commonErrors: ['資本期初期末搞亂', '加成 vs 毛利率混淆', '漏資本注入 / 提取'],
          rubric: [
            { criterion: '推算方法', max: 5, focus: '用啱關係式 / 控制帳' },
            { criterion: '計算正確', max: 4, focus: '數值' },
            { criterion: '列示', max: 3, focus: '步驟清楚' },
          ],
          issueTypes: ['concept', 'calc', 'step'],
        },
        {
          key: 'ratios',
          label: '會計比率分析 Ratio analysis',
          keyConcepts: ['盈利能力（毛利率 / 純利率 / ROCE）', '流動性（流動 / 速動比率）', '效率（存貨 / 應收週轉）', '償債 / 資本結構'],
          markingConventions: ['公式啱 + 代入啱 + 帶單位 / 倍數 / 日數', '分析要扣數字趨勢 + 講原因 + 建議', '比較要同基準（去年 / 同業）'],
          commonErrors: ['公式記錯（毛利率用錯分母）', '只計唔分析', '單位錯（次 / 日 / %）', '結論無數據支持'],
          rubric: [
            { criterion: '比率計算', max: 5, focus: '公式、代入、單位' },
            { criterion: '分析 / 詮釋', max: 5, focus: '扣數字講原因' },
            { criterion: '建議 / 結論', max: 3, focus: '有據可行' },
          ],
          issueTypes: ['concept', 'calc', 'application', 'argument'],
        },
        {
          key: 'cost-accounting',
          label: '成本會計 Cost accounting',
          keyConcepts: ['成本分類（直接 / 間接、固定 / 變動）', '邊際 vs 吸納成本法', '本量利分析 (CVP) / 盈虧平衡', '分批 / 分步成本'],
          markingConventions: ['成本分類啱', 'CVP 公式（貢獻邊際 / 平衡點）正確', '單位 / 數量帶清楚', '決策建議扣數'],
          commonErrors: ['固定 / 變動成本分錯', '貢獻邊際計錯', '邊際 vs 吸納存貨估值混淆', '平衡點單位 vs 金額搞亂'],
          rubric: [
            { criterion: '成本分類 / 概念', max: 4, focus: '分類正確' },
            { criterion: '計算（CVP / 成本法）', max: 5, focus: '公式、數值' },
            { criterion: '決策應用', max: 4, focus: '扣數建議' },
          ],
          issueTypes: ['concept', 'calc', 'application'],
        },
        {
          key: 'budgeting',
          label: '預算 Budgeting',
          keyConcepts: ['現金預算', '功能 / 主預算概念', '預算控制與差異概念'],
          markingConventions: ['現金預算收支期數啱（現金基礎）', '期末結餘累計啱'],
          commonErrors: ['用應計而非現金基礎', '時間錯期（賒銷收款月份）', '累計結餘漏帶上期'],
          rubric: [
            { criterion: '預算編製', max: 5, focus: '現金基礎、期數' },
            { criterion: '計算正確', max: 4, focus: '結餘累計' },
            { criterion: '分析 / 建議', max: 3, focus: '解讀預算' },
          ],
          issueTypes: ['concept', 'calc', 'step'],
        },
        {
          key: 'acct-info-decision',
          label: '會計資訊應用與決策 Use of accounting information',
          keyConcepts: ['會計資訊輔助決策', '局限性與非財務因素', '持份者運用報表'],
          markingConventions: ['決策要兼顧財務 + 非財務', '評估兩面 + 結論'],
          commonErrors: ['只睇財務數忽略非財務', '無結論'],
          rubric: [
            { criterion: '概念 / 應用', max: 4, focus: '資訊運用' },
            { criterion: '分析 / 評估', max: 5, focus: '兩面、扣數' },
            { criterion: '結論', max: 3, focus: '有據' },
          ],
          issueTypes: ['concept', 'application', 'argument'],
        },
      ],
    },

    // ───────────────────── 商業管理學習範疇 ─────────────────────
    {
      key: 'bm',
      label: '商業管理學習範疇',
      persona: '你係資深香港中學 BAFS 商業管理範疇評卷員，按 DSE 標準批改。考評一再指出考生最大失分係「背理論但唔扣個案、答得空泛、情境題唔展開」—— 批改時務必檢查答案有冇緊扣題目情境並具體應用，唔可以淨係接受通用論述。',
      areas: [
        {
          key: 'hrm',
          label: '人力資源管理 Human Resources Management',
          keyConcepts: ['人力資源規劃 / 招聘甄選', '培訓與發展', '績效管理與薪酬', '員工關係與激勵理論'],
          markingConventions: ['理論（如 Maslow / Herzberg）要對應情境', '建議扣公司需要', '評估兩面'],
          commonErrors: ['激勵理論背名唔應用', '招聘 vs 甄選混淆', '建議空泛唔扣個案'],
          rubric: [
            { criterion: '概念 / 理論', max: 4, focus: 'HRM 概念準確' },
            { criterion: '應用個案', max: 5, focus: '扣情境' },
            { criterion: '論證 / 評估', max: 4, focus: '兩面 + 結論' },
          ],
          issueTypes: ['concept', 'application', 'argument', 'wording'],
        },
        {
          key: 'marketing',
          label: '市場營銷管理 Marketing Management',
          keyConcepts: ['市場營銷組合 4Ps / 7Ps', '市場區隔、目標、定位 (STP)', '市場研究', '產品生命週期 / 品牌'],
          markingConventions: ['4Ps 要逐 P 扣產品 / 個案', 'STP 概念啱', '建議具體可行'],
          commonErrors: ['4Ps 講得空泛', '混淆區隔基礎', 'promotion 與 advertising 等同'],
          rubric: [
            { criterion: '概念（4Ps / STP）', max: 4, focus: '營銷概念準確' },
            { criterion: '應用個案', max: 5, focus: '扣產品 / 情境' },
            { criterion: '論證 / 建議', max: 4, focus: '具體可行' },
          ],
          issueTypes: ['concept', 'application', 'argument', 'wording'],
        },
        {
          key: 'operations',
          label: '營運管理 Operations Management',
          keyConcepts: ['生產 / 流程與品質管理', '存貨 / 供應鏈', '科技與生產力', '可持續營運'],
          markingConventions: ['概念扣營運情境', '品質 / 存貨方法講啱'],
          commonErrors: ['品質管理概念混淆', '忽略成本 / 效率取捨'],
          rubric: [
            { criterion: '概念準確', max: 4, focus: '營運概念' },
            { criterion: '應用', max: 5, focus: '扣情境' },
            { criterion: '論證', max: 4, focus: '取捨、結論' },
          ],
          issueTypes: ['concept', 'application', 'argument'],
        },
        {
          key: 'financial-mgmt',
          label: '財務管理 Financial Management',
          keyConcepts: ['融資來源（股本 / 債務 / 內部）', '營運資金管理', '投資評估（回本期 / 會計回報率）', '財務報表分析、風險管理'],
          markingConventions: ['融資來源要講利弊扣公司', '投資評估列式 + 比較 + 結論', '比率分析扣決策'],
          commonErrors: ['長短期融資配對錯', '回本期忽略時間值（如題目要求）', '只計唔下結論'],
          rubric: [
            { criterion: '概念 / 計算', max: 5, focus: '融資 / 評估方法正確' },
            { criterion: '分析 / 應用', max: 5, focus: '扣公司情境' },
            { criterion: '建議 / 結論', max: 3, focus: '有據可行' },
          ],
          issueTypes: ['concept', 'calc', 'application', 'argument'],
        },
        {
          key: 'mgmt-ethics',
          label: '管理職能與商業道德 Management functions & business ethics',
          keyConcepts: ['管理職能整合', '領導風格與決策', '商業道德與企業管治', '持份者利益平衡'],
          markingConventions: ['道德題要多角度 + 持份者', '評估兩面 + 立場'],
          commonErrors: ['道德分析一面倒', '忽略持份者', '建議無扣情境'],
          rubric: [
            { criterion: '概念準確', max: 4, focus: '管理 / 道德概念' },
            { criterion: '多角度分析', max: 5, focus: '持份者、兩面' },
            { criterion: '結論 / 立場', max: 3, focus: '有理據' },
          ],
          issueTypes: ['concept', 'argument', 'application', 'wording'],
        },
      ],
    },
  ],
  publicResources: [
    { label: 'HKEAA BAFS 科目資訊（官方：課程 / Sample Paper / 試後簡報）', url: 'https://www.hkeaa.edu.hk/en/HKDSE/assessment/subject_information/category_a_subjects/bafs/' },
    { label: 'HKEAA 試後簡報 2025（marking notes + 考生表現）', url: 'https://www.hkeaa.edu.hk/DocLibrary/HKDSE/Subject_Information/bafs/PowerPoint-BAFS-2025-03-rev.pdf' },
    { label: 'HKEAA 2020 BAFS Level 5 考生範例（官方）', url: 'https://www.hkeaa.edu.hk/DocLibrary/HKDSE/Subject_Information/bafs/2020-Sample-BAFS-Level5-E.pdf' },
    { label: 'DSE Treasure — BAFS 歷屆試題（中英）', url: 'https://dsetreasure.com/dse-bafs-past-paper/' },
    { label: 'PaperPapa — BAFS 歷屆試卷', url: 'https://paperpapa.com/hkdse-2020-bafs-english-paper/' },
    { label: 'thinka.ai — BAFS 課題筆記', url: 'https://www.thinka.ai/en/Senior-Secondary-HKDSE/Business-Accounting-and-Financial-Studies' },
  ],
  source:
    '提煉自 HKDSE BAFS 課程及評估指引(2028)、會計／商業管理範疇補充筆記(2025 中英)、Sample Paper(2025)，+ 公開網上資源（HKEAA 官方頁 / 試後簡報摘要 / DSE Treasure / PaperPapa 等）校準 + DSE BAFS 批改知識。註：HKEAA PDF 受 403 限制未能逐字抓、MS+CP 為掃描檔未 OCR；以搜尋摘要 + 官方頁為主，批改慣例可再以官方文字版校準。',
}
