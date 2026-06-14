import type { SubjectKnowledge } from './types'

// ============================================================
//  公民與社會發展（Citizenship and Social Development, CSD）知識檔案
//  ------------------------------------------------------------
//  2021 中四開科、2024 首屆公開試，取代通識教育科。
//  公開試結構：單一公開卷（2 小時）— 全卷資料回應題（data-response），
//    三大主題各設一條題組（含 MC / 短題目 / 延伸題），全部必答。
//  匯報：只報「達標 / 未達標」兩級（非 1–5** 七級）。
//  無校本評核（SBA）、無獨立專題探究（IES）；設內地考察（必須學習經歷，
//    完成考察報告，但不計入公開試評核）。
//  三大主題：① 「一國兩制」下的香港 ② 改革開放以來的國家
//            ③ 互聯相依的當代世界。
//  提煉來源：EDB / HKEAA 公民與社會發展科課程及評估指引 + 官方樣本試卷
//  + 公開網上資源（AfterSchool / 各補習社對資料回應題技巧、常見錯誤嘅整理）
//  + DSE 公民科批改知識。官方考生示例（達標 sample）可逐題校準。
// ============================================================

const CSD_PERSONA =
  '你係資深香港中學公民與社會發展科評卷員，按 DSE 公民科標準批改：答案必須扣連 / 引述題目資料（標明資料 A / B…），概念準確，論證多角度（持份者 / 政治 / 經濟 / 社會 / 文化），立場清晰有理據；只抄資料無分析、或空談背景知識而唔扣資料，都會失分。'

export const CSD: SubjectKnowledge = {
  subject: 'csd',
  label: '公民與社會發展',
  lang: 'zh',
  assessment: {
    papers: [
      '公開考試：單一試卷（2 小時）— 全卷資料回應題（data-response）。三大主題各設一條資料回應題（題組），題組內含多項選擇題、短題目（約 2–4 分）及延伸 / 短文章式問題（約 6–8 分），全部必答。',
    ],
    weightings: '公開考試 100%（只報「達標 / 未達標」兩級，非 1–5** 七級）。無校本評核（SBA）、無獨立專題探究（IES）。',
    questionTypes: ['多項選擇題（MC，據資料選答）', '短題目（約 2–4 分：描述 / 指出 / 解釋）', '延伸 / 短文章式問題（約 6–8 分：比較 / 分析 / 論證 / 建議 / 「在多大程度上同意」）'],
    sba: '無 SBA。設內地考察（必須學習經歷，完成考察報告，不計公開試分）。',
  },
  commandWords: [
    { word: '描述 / 指出', meaning: '據資料點出特徵 / 趨勢 / 現象，要扣資料，唔使解因由。' },
    { word: '解釋', meaning: '講清因由 / 機制 / 點樣影響，要有邏輯鏈。' },
    { word: '比較', meaning: '逐點對比異同（如兩地 / 兩時期 / 兩持份者）。' },
    { word: '分析', meaning: '拆解現象，扣資料 + 概念，多角度展開。' },
    { word: '建議 / 提出', meaning: '提出可行措施 + 理據，並扣連情境 / 持份者。' },
    { word: '你在多大程度上同意 / 評估', meaning: '要明確表態 + 正反論證 + 有結論，唔可騎牆。' },
    { word: '推斷（從資料）', meaning: '由資料 / 圖表合理推論，推斷必須有資料支持。' },
  ],
  levelDescriptors: [
    { level: '達標（高質）', descriptor: '準確理解並善用資料；概念正確；論點扣資料 + 知識，多角度 / 多持份者；立場清晰、理據充分、有結論。' },
    { level: '達標（基本）', descriptor: '大致理解資料、概念尚可；論點有但發展一般、角度較少；有扣資料但深度淺。' },
    { level: '未達標', descriptor: '誤讀資料 / 概念錯誤；論點空泛或離題；只抄資料無分析、或無立場 / 無結論。' },
  ],
  strands: [
    // ───────────── 資料回應題技巧（通用，預設）─────────────
    {
      key: 'skills',
      label: '資料回應題技巧（通用）',
      persona: CSD_PERSONA,
      areas: [
        {
          key: 'data-interpretation',
          label: '資料解讀與推斷',
          keyConcepts: ['讀圖表 / 數據 / 漫畫 / 文字資料', '比較趨勢、找關係', '由資料合理推斷', '區分事實與意見', '辨識資料立場 / 偏向'],
          markingConventions: ['答案要引述 / 扣資料（標明資料 A / B）', '推斷必須有資料支持', '描述題唔使解因由，但要準確扣數據', '唔可只搬背景知識而唔扣資料'],
          commonErrors: ['照抄資料無分析 / 無詮釋', '推斷無資料支持（自己作）', '誤讀圖表 / 數據（單位 / 趨勢）', '答非設問（問描述去咗解釋）', '混淆事實與意見'],
          rubric: [
            { criterion: '資料運用', max: 4, focus: '準確引述 / 扣資料' },
            { criterion: '概念 / 知識', max: 4, focus: '概念正確、用詞準確' },
            { criterion: '分析 / 推斷', max: 5, focus: '有資料支持、合理' },
            { criterion: '表達 / 條理', max: 3, focus: '分點清楚、緊扣設問' },
          ],
          issueTypes: ['data', 'content', 'evidence', 'wording'],
        },
        {
          key: 'argumentation-stance',
          label: '立場論證與多角度',
          keyConcepts: ['立場明確、有結論', '正反論證 / 駁論', '多角度（政治 / 經濟 / 社會 / 文化 / 環境）與多持份者', '提出可行建議 + 理據', '概念扣連（如可持續發展、法治、全球化）'],
          markingConventions: ['「在多大程度上」要表態 + 兩面 + 結論', '建議要可行並扣情境 / 持份者', '論點要扣資料 + 概念，唔可空講', '多角度比單角度高分'],
          commonErrors: ['無立場 / 騎牆無結論', '單一角度、欠多持份者', '建議離地 / 無理據', '以例代論（舉例無分析）', '論點重複、欠深度'],
          rubric: [
            { criterion: '資料 / 概念運用', max: 4, focus: '扣資料 + 概念準確' },
            { criterion: '論證 / 多角度', max: 6, focus: '正反、多持份者、深度' },
            { criterion: '立場 / 建議 / 結論', max: 3, focus: '清晰、可行、有結論' },
            { criterion: '表達 / 條理', max: 2, focus: '結構清楚' },
          ],
          issueTypes: ['argument', 'content', 'evidence', 'concept'],
        },
      ],
    },

    // ───────────── 主題一：「一國兩制」下的香港 ─────────────
    {
      key: 'hk',
      label: '主題一：「一國兩制」下的香港',
      persona: CSD_PERSONA,
      areas: [
        {
          key: 'hk-otsc',
          label: '「一國兩制」、政治體制與法治',
          keyConcepts: ['「一國兩制」、《憲法》與《基本法》', '香港特區政治體制（行政 / 立法 / 司法）', '法治精神與居民權利義務', '國家安全與香港', '國民身分認同'],
          markingConventions: ['概念（一國兩制 / 法治 / 基本法）要用得準確', '扣連資料 + 香港實況', '涉及制度要講運作 / 關係，唔好背定義'],
          commonErrors: ['一國兩制 / 法治概念講錯或含糊', '只背定義唔扣資料 / 實況', '混淆行政 / 立法 / 司法職能', '身分認同流於口號'],
          rubric: [
            { criterion: '資料運用', max: 4, focus: '扣資料 + 香港實況' },
            { criterion: '概念 / 知識', max: 4, focus: '制度 / 法治概念準確' },
            { criterion: '分析 / 論證', max: 5, focus: '多角度、有深度' },
            { criterion: '表達 / 條理', max: 3, focus: '緊扣設問、分點' },
          ],
          issueTypes: ['concept', 'content', 'data', 'argument'],
        },
        {
          key: 'hk-development',
          label: '香港的發展機遇與挑戰',
          keyConcepts: ['粵港澳大灣區、「一帶一路」機遇', '香港經濟轉型與創科', '民生議題（房屋 / 人口老化 / 醫療）', '青年發展與向上流動', '可持續發展'],
          markingConventions: ['機遇 / 挑戰要扣資料 + 數據', '建議要可行、扣香港情境', '多持份者（政府 / 企業 / 青年）角度'],
          commonErrors: ['機遇 / 挑戰空泛、無扣資料', '建議離地、無持份者考慮', '只講機遇唔講挑戰（或相反）', '數據誤讀'],
          rubric: [
            { criterion: '資料運用', max: 4, focus: '扣資料 / 數據' },
            { criterion: '概念 / 知識', max: 4, focus: '發展概念準確' },
            { criterion: '分析 / 建議', max: 5, focus: '多角度、可行建議' },
            { criterion: '表達 / 條理', max: 3, focus: '結構清楚' },
          ],
          issueTypes: ['data', 'content', 'argument', 'concept'],
        },
        {
          key: 'hk-society-culture',
          label: '香港社會的多元文化特徵',
          keyConcepts: ['香港多元文化與文化共融', '不同族群與社群（少數族裔 / 移民 / 不同宗教）', '中西文化交匯與本土文化', '香港作為國際大都會的身分', '多元文化對社會的積極意義與挑戰（共融 vs 隔閡）'],
          markingConventions: ['多元文化要扣資料 + 香港具體例子（節慶 / 社區 / 政策）', '要有分析（成因 / 影響 / 意義），唔好淨係列現象', '兼顧積極意義同潛在挑戰（如社會共融障礙）'],
          commonErrors: ['把多元文化淪為列舉現象、無分析', '只講好處（共融）忽略挑戰（隔閡 / 歧視）', '無扣香港實況 / 資料', '混淆多元文化與單純國際化'],
          rubric: [
            { criterion: '資料運用', max: 4, focus: '扣資料 + 香港實例' },
            { criterion: '概念 / 知識', max: 4, focus: '多元文化 / 共融概念準確' },
            { criterion: '分析 / 論證', max: 5, focus: '成因 / 影響 / 意義，多角度' },
            { criterion: '表達 / 條理', max: 3, focus: '緊扣設問、分點' },
          ],
          issueTypes: ['concept', 'content', 'argument', 'data'],
        },
      ],
    },

    // ───────────── 主題二：改革開放以來的國家 ─────────────
    {
      key: 'china',
      label: '主題二：改革開放以來的國家',
      persona: CSD_PERSONA,
      areas: [
        {
          key: 'china-reform',
          label: '改革開放的歷程與成就',
          keyConcepts: ['改革開放的背景與歷程', '經濟體制改革（市場化 / 對外開放）', '人民生活與社會變遷', '成就與代價（如區域 / 城鄉差距）'],
          markingConventions: ['史實 / 政策要準確', '扣資料 + 數據講成就 / 影響', '兼顧成就與挑戰'],
          commonErrors: ['史實 / 政策時序錯', '只講成就唔講代價', '數據誤讀 / 無扣資料', '概念（改革 vs 開放）混淆'],
          rubric: [
            { criterion: '資料運用', max: 4, focus: '扣資料 / 數據' },
            { criterion: '概念 / 史實', max: 4, focus: '政策 / 史實準確' },
            { criterion: '分析 / 論證', max: 5, focus: '成就與影響、多角度' },
            { criterion: '表達 / 條理', max: 3, focus: '緊扣設問' },
          ],
          issueTypes: ['fact', 'content', 'data', 'argument'],
        },
        {
          key: 'china-strength',
          label: '國家綜合國力提升與國際地位',
          keyConcepts: ['綜合國力（經濟 / 科技 / 國防 / 文化軟實力）', '科技創新與數字經濟', '國家在國際社會的角色、責任與承擔（參與全球治理 / 聯合國 / 應對環球挑戰），及綜合國力提升帶來的國際地位上升', '可持續發展與環境（雙碳目標）', '國民身分認同、《憲法》《基本法》與國家發展'],
          markingConventions: ['概念（綜合國力 / 軟實力）用得準確', '扣資料 + 國家實況', '多角度（經濟 / 科技 / 環境 / 國際）'],
          commonErrors: ['綜合國力 / 軟實力概念混淆', '只列成就無分析', '只講國內成就忽略國家國際角色與責任', '無扣資料 / 數據', '環境與發展關係講唔清'],
          rubric: [
            { criterion: '資料運用', max: 4, focus: '扣資料 / 數據' },
            { criterion: '概念 / 知識', max: 4, focus: '國力 / 發展概念準確' },
            { criterion: '分析 / 論證', max: 5, focus: '多角度、有深度' },
            { criterion: '表達 / 條理', max: 3, focus: '結構清楚' },
          ],
          issueTypes: ['concept', 'content', 'data', 'argument'],
        },
      ],
    },

    // ───────────── 主題三：互聯相依的當代世界 ─────────────
    {
      key: 'world',
      label: '主題三：互聯相依的當代世界',
      persona: CSD_PERSONA,
      areas: [
        {
          key: 'world-globalization',
          label: '經濟全球化與相互依存',
          keyConcepts: ['經濟全球化（成因 / 影響 / 機遇與挑戰）', '國際分工與跨國企業', '中國與世界的相互依存', '全球化下的文化 / 經濟影響'],
          markingConventions: ['全球化概念要準確、扣資料', '正反影響 + 多持份者（已發展 / 發展中、企業 / 工人）', '相互依存要講雙向關係'],
          commonErrors: ['全球化只講好處或只講壞處', '無扣資料 / 持份者', '混淆全球化與本地化', '只講單向影響忽略相互依存'],
          rubric: [
            { criterion: '資料運用', max: 4, focus: '扣資料 / 數據' },
            { criterion: '概念 / 知識', max: 4, focus: '全球化 / 相互依存概念準確' },
            { criterion: '分析 / 論證', max: 5, focus: '正反、多持份者' },
            { criterion: '表達 / 條理', max: 3, focus: '緊扣設問' },
          ],
          issueTypes: ['concept', 'content', 'argument', 'data'],
        },
        {
          key: 'world-tech',
          label: '科技發展與資訊素養',
          keyConcepts: ['科技發展對生活 / 社會的影響', '資訊素養與媒體素養（假資訊 / 數碼鴻溝）', '科技倫理（私隱 / AI / 監控）', '科技與經濟 / 文化變遷'],
          markingConventions: ['扣資料 + 概念（資訊素養 / 科技倫理）', '正反影響、多持份者（個人 / 企業 / 政府）', '建議要可行'],
          commonErrors: ['科技影響只列現象無分析', '資訊素養 / 媒體素養概念講錯', '只講好處或壞處一面', '無扣資料'],
          rubric: [
            { criterion: '資料運用', max: 4, focus: '扣資料 / 數據' },
            { criterion: '概念 / 知識', max: 4, focus: '科技 / 資訊素養概念準確' },
            { criterion: '分析 / 建議', max: 5, focus: '多角度、可行建議' },
            { criterion: '表達 / 條理', max: 3, focus: '結構清楚' },
          ],
          issueTypes: ['concept', 'content', 'argument', 'data'],
        },
        {
          key: 'world-public-health',
          label: '公共衞生與人類健康',
          keyConcepts: ['傳染病 / 疫情防控', '全球衞生治理與國際合作（如 WHO）', '健康與生活方式', '醫療資源公平 / 可及性', '科技與公共衞生'],
          markingConventions: ['扣資料 + 概念（公共衞生 / 全球合作）', '多角度（個人 / 社會 / 國際）+ 多持份者', '建議要可行、扣情境'],
          commonErrors: ['公共衞生只講醫療、忽略社會 / 國際合作', '只列現象無分析', '無扣資料 / 數據', '混淆公共衞生與個人健康'],
          rubric: [
            { criterion: '資料運用', max: 4, focus: '扣資料 / 數據' },
            { criterion: '概念 / 知識', max: 4, focus: '公共衞生概念準確' },
            { criterion: '分析 / 建議', max: 5, focus: '多角度、可行建議' },
            { criterion: '表達 / 條理', max: 3, focus: '結構清楚' },
          ],
          issueTypes: ['concept', 'content', 'argument', 'data'],
        },
        {
          key: 'world-sustainability',
          label: '可持續發展',
          keyConcepts: ['可持續發展（經濟 / 社會 / 環境三支柱）', '氣候變化與「雙碳」目標', '能源 / 資源與環境保護', '發展與環境的平衡、代際公平'],
          markingConventions: ['三支柱要平衡、唔好淨係講環境', '扣資料 + 概念', '正反 + 多持份者（政府 / 企業 / 公眾 / 國際）'],
          commonErrors: ['可持續發展淪為口號', '只講環境忽略經濟 / 社會支柱', '無扣資料 / 持份者', '建議離地'],
          rubric: [
            { criterion: '資料運用', max: 4, focus: '扣資料 / 數據' },
            { criterion: '概念 / 知識', max: 4, focus: '可持續發展概念準確' },
            { criterion: '分析 / 論證', max: 5, focus: '三支柱、多持份者' },
            { criterion: '表達 / 條理', max: 3, focus: '緊扣設問' },
          ],
          issueTypes: ['concept', 'content', 'argument', 'data'],
        },
      ],
    },
  ],
  publicResources: [
    { label: 'HKEAA 公民與社會發展 科目資訊（官方：評估 / 樣本試卷 / 考生示例）', url: 'https://www.hkeaa.edu.hk/tc/HKDSE/assessment/subject_information/category_a_subjects/cs/' },
    { label: 'HKEAA 公民科 樣本試卷 2024（官方）', url: 'https://www.hkeaa.edu.hk/tc/HKDSE/assessment/subject_information/category_a_subjects/cs/sap/2024.html' },
    { label: 'EDB 公民與社會發展科 課程及評估指引 / 資源', url: 'https://www.edb.gov.hk/tc/curriculum-development/kla/pshe/references-and-resources/civic-and-social-development/index.html' },
    { label: 'AfterSchool — 公民與社會發展科 課題 / 答題技巧整理', url: 'https://afterschool.com.hk/blog/322-dse-%E5%85%AC%E6%B0%91%E5%8F%8A%E7%A4%BE%E6%9C%83%E7%99%BC%E5%B1%95%E7%A7%91/' },
  ],
  source:
    '提煉自 EDB / HKEAA 公民與社會發展科課程及評估指引（單一公開卷、全資料回應題、三大主題、達標 / 未達標兩級、無 SBA / 無 IES、設內地考察）+ 官方樣本試卷 + 公開網上資源（AfterSchool / 各補習社對資料回應題技巧、常見錯誤嘅整理）+ DSE 公民科批改知識。官方考生示例（達標 sample）可逐題校準。',
}
