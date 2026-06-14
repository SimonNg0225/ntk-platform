import type { SubjectKnowledge } from './types'

// ============================================================
//  物理（Physics）科目知識檔案
//  ------------------------------------------------------------
//  公開試結構（現行 DSE Physics）：
//    卷一 Paper 1（必修部分，佔總分 60%，2 小時 30 分）：
//      · 甲部 Section A — 選擇題（MC，佔總分 21%）；
//      · 乙部 Section B — 短答 / 結構式 / 論述題（佔總分 39%；
//        須列式、計算、解釋、繪圖）。
//      · 必修部分五大範疇：熱和氣體 / 力和運動 / 波動 / 電和磁 +
//        放射現象和核能。
//    卷二 Paper 2（選修部分，佔總分 20%，1 小時）：
//      · 四個選修單元 — 天文學與航天科學 / 原子世界 /
//        能量和能量的使用 / 醫學物理學；考生修讀並作答其中兩個。
//    校本評核 SBA（佔總分 20%）：實驗 / 實作技能（校內評，唔喺此 AI
//      批改範圍；於 assessment.sba 註明）。
//  批改鐵則（HKEAA marking scheme 慣例）：
//    · 物理量必帶單位（SI），最後答案按指定有效數字；
//    · 公式 / 定律用啱可得方法分，即使代入或運算有誤；
//    · 計算錯一步可 follow-through（e.c.f. error carried forward）後續步驟；
//    · 解釋題重因果鏈與正確物理術語，唔可只描述現象 / 唔可循環論證；
//    · 圖表題：軸標 + 單位 + 合適比例 + 趨勢線（best-fit）+ 由圖讀梯度 / 截距。
//  三範疇對齊評核大綱（必修核心）：力學與運動 / 熱、波與光 /
//  電磁與近代物理（放射與核能）。
//  提煉來源：HKEAA 物理評核大綱 / 課程及評估指引 + EDB 課程及評估指引 +
//  公開 marking scheme 慣例（方法分 / e.c.f. / 單位與有效數字）+ DSE 物理
//  批改知識。官方考評報告（examiner report）可逐題校準常見失分。
//  版權：以上均為衍生指引，並無照搬 HKEAA 試題原文或官方評分準則原句。
// ============================================================

const PHYS_PERSONA =
  '你係資深香港中學物理科評卷員，按 DSE Physics 標準批改，重視概念 / 定律是否正確、計算與單位是否齊全，以及解釋是否有清晰因果。公式 / 物理原理用啱即使代入或運算有誤都應酌量畀方法分；計算錯一步可 follow-through（e.c.f.）後續步驟；物理量必帶 SI 單位、最後答案按指定有效數字；解釋題要用正確物理術語、講明因果，唔可只描述現象或循環論證。'

export const PHYS: SubjectKnowledge = {
  subject: 'phys',
  label: '物理',
  lang: 'zh',
  assessment: {
    papers: [
      '卷一 Paper 1（必修部分，佔總分 60%，2 小時 30 分）：甲部 Section A 選擇題（MC，佔總分 21%）+ 乙部 Section B 短答 / 結構式 / 論述題（佔總分 39%；須列式、計算、解釋、繪圖 / 讀圖）。涵蓋熱和氣體、力和運動、波動、電和磁、放射現象和核能。',
      '卷二 Paper 2（選修部分，佔總分 20%，1 小時）：四個選修單元（天文學與航天科學 / 原子世界 / 能量和能量的使用 / 醫學物理學），考生修讀並作答其中兩個。',
    ],
    weightings: '卷一 必修 60%（甲部 MC 21% + 乙部 短答 / 結構 / 論述 39%）· 卷二 選修 20% · 校本評核 SBA 20%。等級 1–5**（七級）。（比例 / 時長以官方評核大綱為準。）',
    questionTypes: [
      '選擇題（MC，卷一甲部）',
      '計算題（列式、代入、單位、有效數字）',
      '解釋 / 說明題（因果推理、物理術語）',
      '推導 / 證明（由定律導出關係式）',
      '圖表題（繪圖、讀梯度 / 截距、由圖求物理量）',
      '實驗設計 / 數據分析（誤差、可靠性、改良）',
      '情境應用題（將原理套用於真實情境）',
    ],
    sba: '校本評核 SBA 佔總分 20%，評核實驗 / 實作技能（計劃、操作、觀察記錄、數據處理、結論），由校內評核，唔喺此 AI 批改範圍。',
  },
  commandWords: [
    { word: '計算 / 求（Calculate / Find）', meaning: '列出所用公式、代入數值、寫出運算過程，最後答案要帶 SI 單位及指定有效數字。' },
    { word: '解釋 / 說明（Explain）', meaning: '寫出因果鏈，用正確物理定律 / 術語講「點解」，唔可只描述現象或循環論證。' },
    { word: '描述（Describe）', meaning: '具體講出過程 / 觀察到的現象 / 變化趨勢，要有次序但未必需要因果。' },
    { word: '說出 / 寫出（State）', meaning: '直接寫出定律、定義、數值或結論，無須推導，但要精確。' },
    { word: '推導 / 證明（Show / Derive）', meaning: '由已知定律逐步推出指定關係式，每步要有理據；用「Show」時最後答案已給出，重點係過程。' },
    { word: '畫出 / 繪畫（Sketch / Draw / Plot）', meaning: 'Sketch 重形狀 / 趨勢；Plot / Draw 圖要有軸標、單位、合適比例及最佳擬合線（best-fit）。' },
    { word: '估算（Estimate）', meaning: '用合理假設與近似值計出數量級，要講明所作假設。' },
    { word: '比較（Compare）', meaning: '同時指出相同與不同之處，並以物理量 / 原理支持，唔可只講一邊。' },
    { word: '建議 / 評價（Suggest / Evaluate）', meaning: '提出可行方法 / 改良或就可靠性、誤差作判斷，並用物理理據支持。' },
  ],
  levelDescriptors: [
    { level: '高（5–5**）', descriptor: '概念 / 定律準確；公式選用恰當、代入與運算無誤；物理量帶正確單位及有效數字；解釋因果完整、術語準確；圖表軸標 / 單位 / 趨勢線齊全且讀數準確。' },
    { level: '中（3–4）', descriptor: '大致掌握概念，偶有混淆或運算 / 單位失誤；解釋有因果但欠完整或術語不夠精確；圖表大致正確但偶漏單位 / 趨勢線。' },
    { level: '低（1–2）', descriptor: '概念 / 公式錯誤較多；計算跳步或漏單位；解釋只描述現象 / 循環論證 / 因果錯置；圖表軸標 / 比例 / 讀數多錯。' },
  ],
  strands: [
    // ───────────────── 力學與運動 ─────────────────
    {
      key: 'mechanics',
      label: '力學與運動',
      persona: PHYS_PERSONA,
      areas: [
        {
          key: 'kinematics-dynamics',
          label: '運動學與牛頓定律',
          keyConcepts: ['位移 / 速度 / 加速度與 v–t、s–t 圖（梯度 = 加速度 / 速度，面積 = 位移）', '等加速度運動方程（含自由落體 g）', '牛頓三大運動定律與自由體圖（free-body diagram）', '合力、摩擦力、張力、法向反作用力', '拋體運動（水平 / 豎直分量獨立處理）', '圓周運動（向心加速度 v²/r、向心力）'],
          markingConventions: ['寫出所用定律 / 公式（如 F = ma）可得方法分', '先畫自由體圖、標明各力方向有助評分', '答案帶 SI 單位（m s⁻¹、m s⁻²、N）及指定有效數字', '計算錯一步可 e.c.f. 後續', '向量題要講明方向（正負或方位）'],
          commonErrors: ['將速度與加速度混淆、v–t 圖梯度 / 面積讀錯', '自由體圖漏力或多加「不存在的力」（如把向心力當額外的力）', '拋體題將水平與豎直分量混在一起', '漏單位或單位不一致（cm 與 m 混用）', '誤把作用力與反作用力視作同一物體上的平衡力'],
          rubric: [
            { criterion: '概念 / 定律', max: 6, focus: '定律選用、受力分析正確' },
            { criterion: '計算與單位', max: 6, focus: '代入、運算、SI 單位、有效數字' },
            { criterion: '解釋 / 推導', max: 5, focus: '因果清晰、方向交代' },
            { criterion: '圖表 / 表達', max: 3, focus: '自由體圖 / v–t 圖標示清楚' },
          ],
          issueTypes: ['concept', 'calc', 'unit', 'equation'],
        },
        {
          key: 'work-energy-momentum',
          label: '功、能量、功率與動量',
          keyConcepts: ['功 W = Fs cosθ、功率 P = W/t = Fv', '動能 ½mv²、重力勢能 mgh、能量守恆', '機械能轉換與效率', '動量 p = mv、衝量 = Δp = FΔt', '動量守恆（碰撞 / 爆炸）', '彈性 vs 非彈性碰撞（動能是否守恆）'],
          markingConventions: ['能量題先寫能量守恆 / 轉換關係方得方法分', '動量守恆要定義正方向、寫出碰撞前後總動量', '效率 = 有用輸出 / 總輸入 ×100%，唔可超過 100%', '答案帶單位（J、W、kg m s⁻¹）及有效數字'],
          commonErrors: ['將動量守恆與能量守恆混淆（非彈性碰撞動能不守恆）', '碰撞題漏定方向、向量相加當純量', 'cosθ 漏計或角度取錯（功的定義）', '效率計算分子分母倒轉或超過 100%', '混用 mgh 與 ½mv² 而漏其中一項能量'],
          rubric: [
            { criterion: '概念 / 定律', max: 6, focus: '守恆定律選用正確' },
            { criterion: '計算與單位', max: 6, focus: '能量 / 動量收支、單位' },
            { criterion: '解釋 / 推導', max: 5, focus: '能量轉換、碰撞類型判斷' },
            { criterion: '圖表 / 表達', max: 3, focus: '正方向 / 收支標示清楚' },
          ],
          issueTypes: ['concept', 'calc', 'unit', 'method'],
        },
      ],
    },

    // ───────────────── 熱、波與光 ─────────────────
    {
      key: 'heat-waves',
      label: '熱、波與光',
      persona: PHYS_PERSONA,
      areas: [
        {
          key: 'heat-gases',
          label: '熱和氣體（溫度、熱量與物態變化）',
          keyConcepts: ['溫度與內能、熱平衡', '比熱容 Q = mcΔT、潛熱 Q = ml（熔解 / 汽化）', '物態變化期間溫度不變（能量用於改變分子排列）', '傳導 / 對流 / 輻射', '氣體定律（壓強、體積、溫度，須用絕對溫度 K）', '氣體分子運動論（壓強來自分子碰撞器壁）'],
          markingConventions: ['熱量題先寫 Q = mcΔT 或 Q = ml 可得方法分', '物態變化要分段計算（升溫段 vs 相變段）', '氣體定律溫度必須用開爾文（K），唔可用攝氏', '答案帶單位（J、J kg⁻¹ K⁻¹、K、Pa）'],
          commonErrors: ['物態變化誤以為溫度持續上升（相變期間溫度不變）', '混淆比熱容 c 與潛熱 l、漏其中一段能量', '氣體定律用攝氏溫度代入（應換成 K）', '把熱（heat）與溫度（temperature）當同一概念', '傳導 / 對流 / 輻射機制張冠李戴'],
          rubric: [
            { criterion: '概念 / 定律', max: 6, focus: '熱量 / 相變 / 氣體定律正確' },
            { criterion: '計算與單位', max: 6, focus: '分段計算、K 溫度、單位' },
            { criterion: '解釋 / 推導', max: 5, focus: '分子層面因果解釋' },
            { criterion: '圖表 / 表達', max: 3, focus: '加熱曲線 / 圖表標示' },
          ],
          issueTypes: ['concept', 'calc', 'unit', 'term'],
        },
        {
          key: 'wave-motion-light',
          label: '波動、聲與光',
          keyConcepts: ['波的基本量 v = fλ、週期、振幅、相位', '橫波 / 縱波、波前與射線', '反射、折射（折射率 n = sinθ₁/sinθ₂）、全內反射與臨界角', '繞射與干涉（楊氏雙縫、相長 / 相消條件）', '透鏡成像（薄透鏡公式、放大率、實 / 虛像）', '聲波特性（音調、響度、共鳴）'],
          markingConventions: ['波速 / 折射 / 透鏡題先寫公式並標明符號約定（如實像距正）', '折射要用法線量角、唔可量界面角', '干涉題要寫出路徑差 = nλ（相長）或 (n+½)λ（相消）', '光路圖要畫法線、入射 / 折射 / 反射線及箭頭'],
          commonErrors: ['v = fλ 中混淆頻率與週期', '折射角由界面而非法線量度', '透鏡公式符號約定（實 / 虛像、凹 / 凸）用錯致正負錯', '干涉相長 / 相消條件寫反', '把繞射與折射 / 反射混淆'],
          rubric: [
            { criterion: '概念 / 定律', max: 6, focus: '波模型、折射 / 干涉條件正確' },
            { criterion: '計算與單位', max: 6, focus: '公式代入、符號約定、單位' },
            { criterion: '解釋 / 推導', max: 5, focus: '現象因果（如全內反射）' },
            { criterion: '圖表 / 表達', max: 3, focus: '光路圖 / 波形圖標示準確' },
          ],
          issueTypes: ['concept', 'calc', 'equation', 'unit'],
        },
      ],
    },

    // ───────────── 電磁與近代物理 ─────────────
    {
      key: 'electromagnetism-modern',
      label: '電磁與近代物理',
      persona: PHYS_PERSONA,
      areas: [
        {
          key: 'electricity-circuits',
          label: '電路、電阻與電功率',
          keyConcepts: ['電流、電壓、電阻與歐姆定律 V = IR', '串聯 / 並聯電阻組合與分壓 / 分流', '電功率 P = VI = I²R = V²/R、電能 = Pt', '電動勢（e.m.f.）與內阻、端電壓', '電路圖符號與電流 / 電壓量度（電流表串聯、電壓表並聯）', '家居電力與安全（保險絲、三線插頭、接地、額定值、千瓦時 kWh）'],
          markingConventions: ['先判斷串 / 並聯再寫組合公式可得方法分', '分壓 / 分流要寫出比例關係', 'e.m.f. 題要計內阻壓降（端電壓 = e.m.f. − Ir）', '答案帶單位（A、V、Ω、W、J）及有效數字'],
          commonErrors: ['串並聯電阻公式用反（並聯用 1/R 相加）', '忽略內阻、把端電壓當 e.m.f.', '功率三式選錯（已知量與公式不配）', '分壓 / 分流比例倒轉', '電路圖符號或極性畫錯'],
          rubric: [
            { criterion: '概念 / 定律', max: 6, focus: '歐姆定律、串並聯判斷' },
            { criterion: '計算與單位', max: 6, focus: '組合、分壓 / 分流、單位' },
            { criterion: '解釋 / 推導', max: 5, focus: '內阻 / 功率推理' },
            { criterion: '圖表 / 表達', max: 3, focus: '電路圖符號 / 標示正確' },
          ],
          issueTypes: ['concept', 'calc', 'unit', 'equation'],
        },
        {
          key: 'magnetism-induction',
          label: '磁場、電磁感應與交流電',
          keyConcepts: ['磁場與磁力線、載流導線受力 F = BIL', '左手定則（馬達）/ 右手定則', '電磁感應與法拉第定律（感應 e.m.f. ∝ 磁通量變化率）', '楞次定律（感應電流反抗變化）', '直流馬達 / 發電機原理', '變壓器（Np/Ns = Vp/Vs）與交流電傳輸'],
          markingConventions: ['用定則判斷方向要寫明用邊隻手 / 邊條定則', '感應題要講磁通量變化率（Δ磁通 / Δt）方得分', '楞次定律答案要指出感應電流方向及其「反抗」對象', '變壓器題用匝數比，並講明能量守恆（理想時 VpIp = VsIs）'],
          commonErrors: ['左 / 右手定則用錯（馬達 vs 發電機）', '把磁通量與磁通量變化率混淆（靜止磁鐵無感應）', '楞次定律方向判斷相反', '變壓器匝數比與電壓比倒轉', '誤以為變壓器可改變直流電壓'],
          rubric: [
            { criterion: '概念 / 定律', max: 6, focus: '感應定律、定則運用正確' },
            { criterion: '計算與單位', max: 6, focus: 'F = BIL、匝數比、單位' },
            { criterion: '解釋 / 推導', max: 5, focus: '磁通變化、楞次方向因果' },
            { criterion: '圖表 / 表達', max: 3, focus: '磁場 / 方向圖標示清楚' },
          ],
          issueTypes: ['concept', 'calc', 'unit', 'method'],
        },
        {
          key: 'radioactivity-nuclear',
          label: '放射現象與核能',
          keyConcepts: ['原子核結構、同位素、核子數 / 質子數', 'α / β / γ 衰變的性質、穿透力與電離能力', '核衰變方程（核子數與電荷守恆）', '半衰期與放射性活度（指數衰減）', '質能關係 E = mc²、質量虧損與結合能', '核裂變 / 核聚變、輻射安全'],
          markingConventions: ['衰變方程兩邊核子數與電荷數必須各自守恆', '半衰期題要寫出剩餘比例（½ⁿ）或用衰減關係', '質能題要先算質量虧損 Δm 再乘 c²', '答案帶單位（Bq、年 / 秒、J 或 MeV）及有效數字'],
          commonErrors: ['衰變方程核子數 / 電荷數不守恆', 'α / β / γ 的穿透力與電離能力張冠李戴', '半衰期計算把「次數 n」與時間混淆', '質量虧損方向錯（應為反應物質量 > 產物）', '把核裂變與核聚變定義 / 例子調轉'],
          rubric: [
            { criterion: '概念 / 定律', max: 6, focus: '衰變類型、守恆、半衰期' },
            { criterion: '計算與單位', max: 6, focus: '衰變 / 質能計算、單位' },
            { criterion: '解釋 / 推導', max: 5, focus: '輻射性質、能量來源因果' },
            { criterion: '圖表 / 表達', max: 3, focus: '衰變圖 / 方程式書寫' },
          ],
          issueTypes: ['concept', 'calc', 'unit', 'equation'],
        },
      ],
    },
  ],
  publicResources: [
    { label: 'HKEAA 物理 科目資訊（官方：課程評估 / 樣本試題 / 評核大綱）', url: 'https://www.hkeaa.edu.hk/en/HKDSE/assessment/subject_information/category_a_subjects/phys/' },
    { label: 'HKEAA HKDSE 科目資訊總頁（如分頁網址有變可由此入）', url: 'https://www.hkeaa.edu.hk/en/hkdse/assessment/subject_information/' },
    { label: 'EDB 科學教育 課程文件（含物理 S4–6 課程及評估指引，官方）', url: 'https://www.edb.gov.hk/en/curriculum-development/kla/science-edu/curriculum-documents.html' },
    { label: 'DSE Treasure — 物理歷屆試題（按課題分類 + marking）', url: 'https://dsetreasure.com/dse-physics-past-paper/' },
  ],
  source:
    '提煉自 HKEAA 物理評核大綱 / 課程及評估指引（卷一 必修 60%：甲部 MC 21% + 乙部 短答 / 結構 / 論述 39% · 卷二 選修 20%，四選二 · 校本評核 SBA 20%）+ EDB 科學教育課程及評估指引 + 公開 marking scheme 慣例（方法分 / e.c.f. error carried forward / SI 單位與有效數字）+ DSE 物理批改知識。官方考試報告（examiner report）與表現示例可逐題校準常見失分；以上僅為衍生指引，並無照搬官方試題或評分準則原文。',
}
