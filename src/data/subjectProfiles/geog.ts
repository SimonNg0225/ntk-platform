import type { SubjectKnowledge } from './types'

// ============================================================
//  地理（Geography）科目知識檔案
//  ------------------------------------------------------------
//  公開試結構（DSE Geography, Category A；權重以官方評核大綱為準）：
//    卷一 Paper 1（必修，75%，2 小時 30 分）：
//      · 甲部多項選擇題（MC）+ 乙部必答實地考察為本（field-based）題、
//        技能 / 數據判讀題、結構式問答（structured / data-response）及
//        延伸回應（essay-type）題；
//      · 圍繞必修議題（issue-based）出題，重「過程—成因—影響—管理」邏輯鏈、
//        圖表 / 地圖 / 相片 / 數據判讀，並扣個案 / 實例。
//    卷二 Paper 2（選修，25%，1 小時 15 分）：四個選修單元任修兩個，
//      只作答所修兩單元嘅題（結構式 + 延伸回應 + 技能判讀）。
//  注意：地理科【無校本評核（SBA）——已取消】。實地考察能力改於卷一以
//    「實地考察為本題」筆試形式評核（assessment.sba 已註明）。
//  批改慣例（HKEAA marking 慣例提煉）：
//    · point-based marking — 每個有效論點 / 概念 / 引用數據各計分，論點要「展開」
//      （elaborate）方得分，淨拋名詞唔展開唔計；
//    · data-response 要「引用數字 + 趨勢 / 比較」先得分，淨講「多 / 少」唔夠；
//    · 解釋題要扣返地理過程（process）+ 成因鏈，唔可只描述現象；
//    · 評估 / 議論題要立場 + 多角度 + 個案佐證 + 小結；
//    · 個案 / 實例（named example）要具體（地名 / 數據 / 年份），泛指唔計分；
//    · 地理術語要準確，俗語 / 混淆詞酌量扣表達分。
//  提煉來源：HKEAA 地理課程及評估指引 / 評核大綱（必修議題 + 四選修單元）+
//  公開考評資源（評卷參考慣例：point-marking / data-response / named example）+
//  DSE 地理批改知識。官方考生表現示例 / 考評報告可逐題校準常見失分。
//  版權：僅提煉成衍生指引（準則 / 慣例 / 常見錯誤 / 命令詞 / 等級描述），
//  並無照搬 HKEAA 試題原文或官方評卷參考原句。
// ============================================================

const GEOG_PERSONA =
  '你係資深香港中學地理科（Geography）評卷員，按 DSE Geography 標準批改。重 point-based marking：每個有效論點 / 概念 / 引用數據各計分，論點要展開（成因—過程—影響）方得分，淨拋名詞唔展開唔計；數據題要引用具體數字 + 趨勢 / 比較先得分；解釋題要扣地理過程同成因鏈，唔可淨描述現象；議論 / 評估題要有立場、多角度、扣具體個案（named example：地名 / 數字 / 年份）並有小結；地理術語要準確。'

export const GEOG: SubjectKnowledge = {
  subject: 'geog',
  label: '地理 (Geography)',
  lang: 'zh',
  assessment: {
    papers: [
      '卷一 Paper 1（必修，75%，2 小時 30 分）：甲部多項選擇題（MC）+ 乙部必答題（含實地考察為本題、技能 / 地圖 / 圖表 / 相片 / 數據判讀題、結構式問答及延伸回應（議論 / 評估）題）；圍繞必修議題出題，重「過程—成因—影響—管理」邏輯鏈並扣個案。',
      '卷二 Paper 2（選修，25%，1 小時 15 分）：四個選修單元（動態的地球 / 天氣與氣候 / 運輸發展與管理 / 珠三角區域研究）任修兩個，只作答所修兩個單元嘅題；題型為結構式問答 + 延伸回應 + 技能判讀。',
    ],
    weightings: '卷一（必修）75% · 卷二（選修）25%。地理科無校本評核（SBA 已取消）。等級 1–5**（七級）。',
    questionTypes: [
      '多項選擇題（MC，卷一甲部）',
      '結構式問答（structured / short answer，逐部分計分）',
      '數據判讀（data-response：圖表 / 統計 / 趨勢）',
      '地圖 / 地形圖技能（grid reference / 方位 / 距離 / 剖面 / 坡度）',
      '相片 / 衛星遙感影像判讀',
      '實地考察為本題（field-based：擬定假設 / 方法 / 數據詮釋）',
      '解釋題（地理過程與成因）',
      '延伸回應 / 議論 / 評估題（立場 + 多角度 + 個案）',
      '個案研究應用（named example）',
    ],
    sba: '地理科無校本評核（SBA 已取消）。學生實地考察 / 地理探究（geographical enquiry）能力改於卷一以「實地考察為本題」筆試形式評核。本檔聚焦可批改嘅筆試（卷一 / 卷二）問答與技能判讀部分。',
  },
  commandWords: [
    { word: '描述（Describe）', meaning: '指出特徵 / 分佈 / 趨勢；數據題要引用具體數字、最高 / 最低、變化幅度，唔淨講「多 / 少」。' },
    { word: '解釋 / 說明（Explain / Account for）', meaning: '講清成因與地理過程（process），逐步扣因果鏈，唔可只描述現象。' },
    { word: '比較（Compare）/ 對比（Contrast）', meaning: '逐點講異同（compare 講相同、contrast 講相異），要兩邊對應，唔可各講一段。' },
    { word: '評估 / 評鑑（Evaluate / Assess）', meaning: '衡量利弊 / 成效，用準則 + 證據作判斷，並給出結論立場。' },
    { word: '在何程度上（To what extent）/ 議論（Discuss）', meaning: '表明同意程度，多角度論證、有正反、扣個案，最後有小結。' },
    { word: '建議（Suggest / Recommend）', meaning: '提出可行措施 / 方案並簡述理據（點解可行 / 有效）。' },
    { word: '參考 / 援引（With reference to / Using the data）', meaning: '答案要扣資料 / 圖表 / 地圖作答並引用當中數據，泛論唔扣資料會失分。' },
    { word: '舉例說明（With examples / Named example）', meaning: '須用具體真實個案（地名 / 數字 / 年份），泛指（「某地」「有啲國家」）一般唔計分。' },
    { word: '定義 / 何謂（Define / What is meant by）', meaning: '準確界定地理術語，用學科定義，唔可只舉例代替定義。' },
  ],
  levelDescriptors: [
    { level: '高（5–5**）', descriptor: '概念 / 地理過程準確完整；緊扣題目命令詞作答；論點充分展開、因果鏈清晰；數據 / 圖表判讀準確並引用具體數字；個案具體貼切；術語準確、結構分明。' },
    { level: '中上（4）', descriptor: '概念大致準確，論點多有展開但部分欠深入；能引用資料 / 數據但偶欠比較或趨勢；個案大致恰當；術語尚準確、組織清晰。' },
    { level: '中（2–3）', descriptor: '有相關概念但展開不足、流於描述；數據引用零碎或只講「多 / 少」；個案泛指或不夠具體；偶有概念 / 術語錯誤；組織尚可。' },
    { level: '低（1）', descriptor: '概念 / 過程多錯或離題；只列名詞不展開；忽略資料 / 數據；無個案或舉例錯誤；術語混亂、結構鬆散。' },
  ],
  strands: [
    // ───────────────── 必修部分 Compulsory（卷一）─────────────────
    {
      key: 'compulsory',
      label: '必修議題（卷一）',
      persona: GEOG_PERSONA,
      areas: [
        {
          key: 'hazards-and-water-environments',
          label: '自然災害、河流與海岸環境',
          keyConcepts: [
            '板塊邊界與地震 / 火山成因、災害的成因—影響—應變—管理鏈',
            '熱帶氣旋（風暴）成因、結構與影響',
            '河流作用（侵蝕 / 搬運 / 沉積）與河流地貌（曲流 / 牛軛湖 / 氾濫平原 / 三角洲）',
            '海岸作用與地貌（海蝕 / 沉積；海崖 / 海蝕拱 / 沙咀 / 沙壩）',
            '河流 / 海岸管理（硬性 vs 軟性工程）與可持續性',
          ],
          markingConventions: [
            '解釋災害 / 地貌要扣地理過程（process）逐步講成因，唔可只命名地貌',
            '災害題分清成因（natural / human）、影響（社會 / 經濟 / 環境）、應變與長遠管理',
            '管理措施要評估利弊（硬性工程 vs 軟性工程）',
            '須引用具體個案（如特定地震 / 風暴 / 河段 / 海岸）方得 named-example 分',
          ],
          commonErrors: [
            '只描述地貌外形而無解釋形成過程',
            '混淆侵蝕 / 搬運 / 沉積作用適用嘅河段（上游 vs 下游）',
            '災害影響只列「死人 / 破壞」而唔分社會 / 經濟 / 環境層面',
            '個案泛指（「某次地震」）無地名 / 年份 / 數據',
            '管理題只列措施唔評估成效 / 限制',
          ],
          rubric: [
            { criterion: '概念 / 地理過程', max: 6, focus: '成因—過程鏈準確完整' },
            { criterion: '影響 / 管理分析', max: 6, focus: '分層影響 + 措施評估' },
            { criterion: '個案 / 實例', max: 5, focus: '具體 named example 扣題' },
            { criterion: '術語 / 表達', max: 3, focus: '術語準確、結構清晰' },
          ],
          issueTypes: ['concept', 'application', 'analysis', 'term'],
        },
        {
          key: 'industry-and-city',
          label: '工業區位與可持續城市',
          keyConcepts: [
            '工業區位因素（原料 / 市場 / 勞工 / 交通 / 政策 / 集聚）及其轉變',
            '全球生產與產業轉移、跨國公司與全球化分工',
            '城市化過程、城市內部結構與土地利用',
            '城市問題（擠迫 / 交通 / 房屋 / 環境污染 / 城市更新）',
            '可持續城市規劃（緊湊城市 / 綠色運輸 / 重建活化）',
          ],
          markingConventions: [
            '區位題要解釋因素點影響選址，並講區位點隨時間 / 科技 / 政策轉變',
            '城市問題要扣成因—影響—解決方案，方案要評估可行性',
            '可持續概念要扣經濟 / 社會 / 環境三面平衡',
            '引用具體城市 / 工業區個案（地名 + 特徵）',
          ],
          commonErrors: [
            '只列區位因素唔解釋點樣影響選址',
            '忽略區位因素隨時間轉變（footloose 產業）',
            '城市問題與解決方案脫鈎、方案唔評估成效',
            '「可持續」當口號，無扣三面平衡',
            '個案泛指（「大城市」）無具體地名',
          ],
          rubric: [
            { criterion: '概念 / 區位邏輯', max: 6, focus: '因素如何影響選址 / 轉變' },
            { criterion: '城市問題與規劃分析', max: 6, focus: '成因—影響—方案 + 評估' },
            { criterion: '個案 / 實例', max: 5, focus: '具體城市 / 工業區扣題' },
            { criterion: '術語 / 表達', max: 3, focus: '術語準確、結構清晰' },
          ],
          issueTypes: ['concept', 'application', 'argument', 'term'],
        },
        {
          key: 'forest-food-climate',
          label: '雨林、糧食與全球增溫',
          keyConcepts: [
            '熱帶雨林生態系統（養分循環 / 結構）與砍伐成因及影響',
            '雨林資源管理與可持續利用',
            '農業系統（投入—過程—產出）、糧食供求與饑荒成因',
            '提升糧食供應措施（綠色革命 / 灌溉 / 科技 / 援助）及其限制',
            '全球增溫成因（溫室氣體 / 人為活動）、影響與緩減 / 適應對策',
          ],
          markingConventions: [
            '雨林 / 氣候題要扣自然系統運作（養分循環 / 碳循環）解釋',
            '砍伐 / 增溫影響分環境 / 社會 / 經濟層面，並區分成因（自然 vs 人為）',
            '饑荒題要綜合自然（旱災 / 蟲害）與人為（戰爭 / 分配 / 貧窮）因素',
            '對策要評估成效與限制（如綠色革命負面影響）',
          ],
          commonErrors: [
            '把全球增溫與臭氧層空洞混為一談',
            '雨林砍伐影響只講「無樹」唔扣生態 / 氣候 / 水文連鎖',
            '饑荒只歸因天災、忽略人為 / 分配因素',
            '緩減（mitigation）與適應（adaptation）對策混淆',
            '對策只列措施唔講限制 / 成效',
          ],
          rubric: [
            { criterion: '概念 / 系統過程', max: 6, focus: '生態 / 碳 / 農業系統運作準確' },
            { criterion: '成因 / 影響 / 對策分析', max: 6, focus: '分層 + 緩減 vs 適應 + 評估' },
            { criterion: '數據 / 個案', max: 5, focus: '引用數據 + 具體個案扣題' },
            { criterion: '術語 / 表達', max: 3, focus: '術語準確、結構清晰' },
          ],
          issueTypes: ['concept', 'analysis', 'data', 'term'],
        },
      ],
    },

    // ───────────────── 選修部分 Electives（卷二）─────────────────
    {
      key: 'electives',
      label: '選修單元（卷二）',
      persona: GEOG_PERSONA,
      areas: [
        {
          key: 'dynamic-earth-weather',
          label: '動態的地球 / 天氣與氣候',
          keyConcepts: [
            '板塊構造學說、板塊邊界類型與相關地貌 / 地質作用',
            '岩石循環、風化 / 塊體移動 / 地貌營力',
            '天氣系統（氣壓 / 鋒面 / 氣團）與天氣圖判讀',
            '氣候類型、成因（緯度 / 海陸 / 洋流 / 地形）與氣候圖判讀',
            '微氣候與城市氣候（熱島效應）',
          ],
          markingConventions: [
            '地貌 / 天氣現象要扣營力 / 大氣過程逐步解釋',
            '天氣圖 / 氣候圖題要準確讀數並指出趨勢 / 對比',
            '解釋氣候差異要綜合多個控制因素（唔只一個）',
            '專名 / 過程用詞要準確（如 subduction、frontal uplift）',
          ],
          commonErrors: [
            '混淆建設性 / 破壞性 / 守恆性板塊邊界對應地貌',
            '天氣圖讀錯氣壓 / 鋒面、忽略風向與等壓線關係',
            '解釋氣候只講緯度、漏海陸 / 洋流 / 地形',
            '把風化（weathering）與侵蝕（erosion）混用',
            '熱島效應成因講唔出（建材 / 人為熱 / 通風）',
          ],
          rubric: [
            { criterion: '概念 / 過程', max: 6, focus: '營力 / 大氣過程準確' },
            { criterion: '圖表判讀', max: 6, focus: '讀數準確 + 趨勢 / 對比' },
            { criterion: '解釋 / 個案', max: 5, focus: '多因素解釋 + 實例' },
            { criterion: '術語 / 表達', max: 3, focus: '專名 / 術語準確' },
          ],
          issueTypes: ['concept', 'data', 'application', 'term'],
        },
        {
          key: 'transport-regional',
          label: '運輸發展與管理 / 區域研究（珠三角）',
          keyConcepts: [
            '運輸方式比較與運輸網絡發展、可達性（accessibility）',
            '運輸問題（擠塞 / 污染）與管理措施（公交優先 / 電子道路收費）',
            '區域發展（如珠三角）嘅成因、產業轉型與城市群',
            '區域分工、跨境合作與基礎設施聯通',
            '區域發展帶來嘅環境 / 社會 / 經濟影響與可持續挑戰',
          ],
          markingConventions: [
            '運輸題要比較方式優劣並扣情境（距離 / 貨種 / 成本）',
            '管理措施要評估成效與限制（如收費的公平性）',
            '區域研究要扣真實區域數據 / 政策 / 個案，唔可泛泛而談',
            '影響分析要分層（環境 / 社會 / 經濟）並有正反',
          ],
          commonErrors: [
            '運輸方式比較無扣使用情境（一刀切話某方式最好）',
            '管理措施只列唔評估成效 / 副作用',
            '區域研究無具體數據 / 政策、流於背景描述',
            '只講區域發展好處、忽略負面 / 可持續挑戰',
            '可達性與流動性（mobility）概念混淆',
          ],
          rubric: [
            { criterion: '概念 / 區域邏輯', max: 6, focus: '運輸 / 區域發展概念準確' },
            { criterion: '數據 / 政策判讀', max: 6, focus: '引用數據 / 政策 + 比較' },
            { criterion: '評估 / 個案', max: 5, focus: '成效評估 + 真實區域個案' },
            { criterion: '術語 / 表達', max: 3, focus: '術語準確、結構清晰' },
          ],
          issueTypes: ['concept', 'data', 'argument', 'application'],
        },
      ],
    },

    // ───────────────── 地理探究與技能 ─────────────────
    {
      key: 'skills-enquiry',
      label: '地理探究與技能',
      persona: GEOG_PERSONA,
      areas: [
        {
          key: 'map-graph-skills',
          label: '地圖、圖表與遙感判讀',
          keyConcepts: [
            '地形圖技能（六位 grid reference / 方位 / 直線 / 曲線距離 / 比例尺）',
            '高程與地貌（等高線 / 剖面圖 / 坡度 / 山谷山脊判別）',
            '統計圖表（折線 / 柱狀 / 圓形 / 散點 / 人口金字塔 / 氣候圖）判讀與選用',
            '相片 / 衛星遙感影像判讀（土地利用 / 地貌特徵）',
            '空間分佈描述（趨勢 / 集中 / 異常值）',
          ],
          markingConventions: [
            'grid reference 要六位且 east 先 north；距離要連單位並按比例尺換算',
            '描述圖表要引用具體數字、最高 / 最低、變化幅度與整體趨勢',
            '選圖題要講點解該圖種適合該數據',
            '相片判讀要扣可見證據（features）支持結論',
          ],
          commonErrors: [
            'grid reference 順序倒轉（north 先 east）或位數不足',
            '距離忘記按比例尺換算 / 漏單位',
            '描述圖表只講「上升 / 下降」唔引數字 / 幅度',
            '誤判等高線山谷 vs 山脊、坡度陡緩',
            '相片結論無扣可見證據（純估）',
          ],
          rubric: [
            { criterion: '地圖 / 量度技能', max: 5, focus: 'grid ref / 距離 / 比例尺準確' },
            { criterion: '圖表 / 數據判讀', max: 7, focus: '引用數字 + 趨勢 / 比較' },
            { criterion: '影像 / 分佈描述', max: 5, focus: '扣證據描述空間特徵' },
            { criterion: '術語 / 表達', max: 3, focus: '單位 / 術語準確' },
          ],
          issueTypes: ['data', 'unit', 'analysis', 'term'],
        },
        {
          key: 'fieldwork-enquiry',
          label: '實地考察與地理探究',
          keyConcepts: [
            '地理探究流程（提出問題 / 假設 → 蒐集 → 處理 → 分析 → 結論）',
            '實地數據蒐集方法（樣帶 / 抽樣 / 問卷 / 量度儀器）及其適用性',
            '一手 vs 二手資料、可靠性與限制',
            '數據呈現方式選用與詮釋',
            '評估考察方法的限制與改善建議',
          ],
          markingConventions: [
            '擬定假設要可驗證、扣探究問題',
            '方法題要講方法 + 點解適合 + 局限',
            '分析要扣所收數據作結論，唔可離開數據空談',
            '評估限制要具體（樣本 / 天氣 / 儀器誤差）並提改善',
          ],
          commonErrors: [
            '假設含糊 / 不可驗證',
            '只列方法唔講適用性 / 局限',
            '結論離開實地數據、變成課本背誦',
            '混淆一手與二手資料',
            '評估限制空泛（「時間唔夠」）無扣方法',
          ],
          rubric: [
            { criterion: '探究設計 / 假設', max: 5, focus: '可驗證、扣問題' },
            { criterion: '方法 / 數據處理', max: 6, focus: '方法適切 + 局限' },
            { criterion: '分析 / 結論', max: 6, focus: '扣數據作結 + 評估' },
            { criterion: '術語 / 表達', max: 3, focus: '探究用語準確' },
          ],
          issueTypes: ['method', 'data', 'analysis', 'evidence'],
        },
      ],
    },
  ],
  publicResources: [
    { label: 'HKEAA 地理 科目資訊（官方：課程評估 / 樣本試題 / 考生表現示例）', url: 'https://www.hkeaa.edu.hk/en/HKDSE/assessment/subject_information/category_a_subjects/geog/' },
    { label: 'HKEAA HKDSE 科目資訊總頁（如上連結失效時備用）', url: 'https://www.hkeaa.edu.hk/en/hkdse/assessment/subject_information/' },
    { label: 'EDB 地理科課程及評估指引（中四至中六 Curriculum & Assessment Guide）', url: 'https://www.edb.gov.hk/en/curriculum-development/kla/pshe/references-and-resources/geography/index.html' },
    { label: 'DSE Treasure — 地理歷屆試題（按議題分類）', url: 'https://dsetreasure.com/' },
  ],
  source:
    '提煉自 HKEAA 地理課程及評估指引 / 評核大綱（卷一必修議題 75% + 卷二四選修任修兩個 25%；地理科無 SBA，實地考察改於卷一以實地考察為本題評核）+ 公開考評資源嘅評卷慣例（point-based marking / data-response 引用數據 / named example / 多角度評估）+ DSE 地理批改知識。官方考生表現示例與考評報告可逐題校準常見失分。版權上僅作衍生指引，未照搬試題或評卷參考原文。',
}
