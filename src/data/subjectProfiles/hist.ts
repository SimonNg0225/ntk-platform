import type { SubjectKnowledge } from './types'

// ============================================================
//  歷史（History）科目知識檔案 — DSE History（英文卷，雙語授課）
//  ------------------------------------------------------------
//  公開試結構（現行 HKDSE History）：
//    卷一 Paper 1 資料回應題 Data-Based Questions（DBQ，60%，約 2 小時）：
//      全部必答；每題附多項史料（文字 / 圖表 / 漫畫 / 統計 / 照片），
//      由淺入深（理解 → 比較 → 推論 → 評價 / 立場），須扣資料作答。
//    卷二 Paper 2 論述題 Essay-type Questions（40%，約 1.5 小時）：
//      共 7 條論述題（涵蓋主題甲 / 主題乙），考生選答其中 2 條長篇論述。
//    校本評核 SBA：本科無 SBA；公開試成績全由卷一、卷二筆試決定。
//  課程兩大必修主題：
//    主題甲 二十世紀亞洲的現代化與蛻變 Modernization and Transformation
//      in Twentieth-century Asia（日本、東南亞、中國、香港）；
//    主題乙 二十世紀世界的衝突與合作 Conflicts and Cooperation
//      in Twentieth-century World（兩次大戰、冷戰、國際協作）。
//  批改鐵則（HKEAA DBQ / Essay marking 慣例，提煉為衍生指引）：
//    · 資料題：答案須「扣資料」（quote / refer to source）兼結合史實；
//      只抄資料無詮釋、或只憑己見唔扣資料，均失分；
//      比較題要兩面對照，評估可信 / 立場題要講出處 / 目的 / 偏見。
//    · 論述題用 level marking（分層給分）：高層次 = 直接扣題、持續論證、
//      多角度兼有史實支撐；低層次 = 堆砌史實、敘述為主、欠分析。
//    · 史實（年代 / 人物 / 事件 / 條約）要準確；以偏概全 / 時代錯置要扣。
//  提煉來源：HKEAA History 課程及評估指引 / 評核大綱 + 公開 level-based
//  marking 慣例 + 可靠補充網站對課題 / 答題技巧嘅整理 + DSE History
//  批改知識。官方 Sample Performance / 考評報告可逐題校準。
//  版權：僅提煉為衍生準則 / 慣例 / 常見錯誤 / 命令詞 / 等級描述，
//  並無照搬 HKEAA 試題原文或官方評分準則原句。
// ============================================================

const HIST_PERSONA =
  '你係資深香港中學歷史科（History）評卷員，按 DSE History 標準批改資料回應題（卷一，佔 60%，全部必答）同論述題（卷二，佔 40%，7 題選答 2 題）。資料題要求考生扣返所附史料（引用 / 指出資料點）兼結合史實作答，淨抄資料無詮釋、或唔扣資料只憑己見都會失分；比較題要兩面對照、評估可信度 / 立場題要講出處、目的同偏見。論述題用分層給分（level marking）：直接扣題、持續論證、多角度兼有準確史實支撐先入高層次；堆砌史實、敘述為主、欠分析屬低層次。史實（年代 / 人物 / 事件 / 條約）要準確，標出史實錯誤、以偏概全同論證薄弱處。'

export const HIST: SubjectKnowledge = {
  subject: 'hist',
  label: '歷史 (History)',
  lang: 'zh',
  assessment: {
    papers: [
      '卷一 Paper 1 資料回應題 Data-Based Questions（DBQ，佔全科 60%，約 2 小時）：全部必答。每大題附多項史料（節錄文字、統計圖表、漫畫、照片、地圖），分項由淺入深 — 理解資料、比較資料、結合史實推論、評估資料可信度 / 立場 / 用途，最後常設較開放的小論述。答題須扣返所附資料。',
      '卷二 Paper 2 論述題 Essay-type Questions（佔全科 40%，約 1.5 小時）：全卷共設 7 條論述題，涵蓋主題甲與主題乙，考生自由選答其中 2 條作答長篇論述，考多角度分析、因果評價與史實運用。',
      '校本評核 SBA：本科並無 SBA；公開試成績全部由卷一、卷二兩份筆試組成（60% + 40%）。',
    ],
    weightings: '卷一 資料回應題 60%（全部必答）· 卷二 論述題 40%（7 題選答 2 題）；公開考試合共 100%，無 SBA。成績分七等級 1、2、3、4、5、5*、5**。',
    questionTypes: [
      '資料理解 / 描述（指出資料所示）',
      '資料比較（兩項或以上史料對照）',
      '資料與史實結合（用 own knowledge 補充 / 印證）',
      '資料可信度 / 立場 / 用途評估（出處、目的、偏見）',
      '資料題小論述（程度題 / 同意與否）',
      '論述題（因果、影響、轉變、比較）',
      '評價 / 程度論述題（To what extent / 你是否同意）',
    ],
    sba: '本科無校本評核（SBA）：公開試成績全由卷一（60%）與卷二（40%）兩份筆試決定，本檔聚焦此兩卷之 AI 批改。',
  },
  commandWords: [
    { word: '參考資料 / 根據資料（With reference to the source）', meaning: '答案必須扣返所指定史料：引用或具體指出資料內容，唔可純憑己見離開資料作答。' },
    { word: '比較（Compare）', meaning: '同時點出史料 / 史事之間的相同與不同之處，逐點對照，唔可只講一面。' },
    { word: '解釋 / 說明（Explain / Account for）', meaning: '講清楚「點解」與「點樣」：交代因果、背景與理由，唔止覆述事件。' },
    { word: '在多大程度上（To what extent）', meaning: '作出有程度的判斷：表明同意 / 不同意到甚麼地步，兩面衡量後下結論。' },
    { word: '你是否同意（Do you agree）', meaning: '表明清晰立場並持續論證，兼處理反面觀點，最後扣返題目下判斷。' },
    { word: '評估 / 評價（Assess / Evaluate）', meaning: '按準則（如重要性、影響、可信度）衡量輕重得失，下有根據的判斷，唔止羅列。' },
    { word: '這資料是否可信 / 有用（reliable / useful）', meaning: '從出處、作者目的、立場、偏見、產生時間及用途等角度判斷，唔可單看內容真假。' },
    { word: '描述（Describe）', meaning: '具體交代資料所顯示的情況 / 特徵，扣資料舉證，唔加無據推論。' },
    { word: '分析（Analyse）', meaning: '拆解因素 / 角度，說明彼此關係與相對重要性，唔止並列史實。' },
  ],
  levelDescriptors: [
    { level: '高層次（L3 / 5–5**）', descriptor: '直接扣題、立場清晰；持續而有結構地論證，多角度兼顧並有準確史實支撐；資料題充分扣資料、能比較與評估出處 / 立場；分析深入、有判斷，極少史實錯誤。' },
    { level: '中層次（L2 / 3–4）', descriptor: '大致扣題、有相關史實與部分分析，但論證深度 / 多角度不足，部分段落流於敘述；資料題有引用但詮釋 / 評估較淺；偶有史實或時序失誤。' },
    { level: '低層次（L1 / 1–2）', descriptor: '偏離題目或只堆砌 / 覆述史實，欠分析與立場；資料題抄錄資料而無詮釋或不扣資料；史實錯誤、以偏概全或時代錯置較多，結構鬆散。' },
  ],
  strands: [
    // ───────────── 卷一 資料回應題（DBQ） ─────────────
    {
      key: 'dbq-skills',
      label: '資料回應題與史學技能（卷一）',
      persona: HIST_PERSONA,
      areas: [
        {
          key: 'source-comprehension-comparison',
          label: '史料理解與比較',
          keyConcepts: ['讀懂文字 / 圖表 / 漫畫 / 統計 / 照片等不同史料', '從資料抽取關鍵訊息與隱含意思（漫畫象徵、語氣）', '逐點比較兩項或以上史料的異同', '結合史實（own knowledge）補充或印證資料', '區分資料所述事實與作者意見'],
          markingConventions: ['答案須扣資料：引用片語或明確指出所據的資料部分先得分', '比較題要兩面對照（相同 + 不同），唔可只答一面', '「結合你所知」要補入資料以外的相關史實', '按指定字數 / 分數比重作答，分數高的小題要展開', '漫畫 / 圖像題要解讀象徵與作者立場，唔止描述畫面'],
          commonErrors: ['整段抄錄資料而無詮釋 / 無扣題', '比較題只講其中一項資料、欠對照', '忽略漫畫象徵與語氣、只字面描述', '答案離開資料、純憑己見作答', '誤把作者意見當客觀事實', '無按分數比重，淺題長答、深題敷衍'],
          rubric: [
            { criterion: '資料理解 / 扣資料', max: 6, focus: '準確讀取並引用 / 指出資料' },
            { criterion: '比較 / 結合史實', max: 6, focus: '兩面對照、補入相關史實' },
            { criterion: '詮釋深度', max: 4, focus: '隱含意思、象徵、立場解讀' },
            { criterion: '表達 / 切題', max: 3, focus: '緊扣設問、條理清楚' },
          ],
          issueTypes: ['data', 'fact', 'evidence', 'analysis', 'wording'],
        },
        {
          key: 'source-evaluation',
          label: '史料可信度、立場與用途評估',
          keyConcepts: ['出處分析（作者身份、寫作 / 製作時間、產生情境）', '作者目的、立場與潛在偏見', '可信度（reliability）與有用性（usefulness）之別', '史料相互印證（corroboration）與限制', '一手 / 二手史料的特性與價值'],
          markingConventions: ['評可信度 / 立場要由出處、目的、偏見、時間切入，唔可單憑內容真假', '「是否有用」要連繫設問用途（for what purpose）作答', '有用 ≠ 可信：偏頗史料對研究立場 / 宣傳仍可有用', '判斷要有根據（扣資料線索）並下明確結論', '多項史料題要指出彼此印證或矛盾之處'],
          commonErrors: ['只判斷內容真假、忽略出處與作者目的', '混淆「可信」與「有用」', '空泛標籤（「偏頗所以無用」）而無理據', '無連繫設問所指的用途', '忽略史料產生的時代與情境'],
          rubric: [
            { criterion: '出處 / 目的分析', max: 6, focus: '作者、時間、情境、立場' },
            { criterion: '可信度 / 有用性判斷', max: 6, focus: '扣設問、區分二者' },
            { criterion: '理據 / 扣資料', max: 4, focus: '由資料線索支撐判斷' },
            { criterion: '結論 / 表達', max: 3, focus: '明確、有條理' },
          ],
          issueTypes: ['data', 'evidence', 'argument', 'analysis', 'wording'],
        },
      ],
    },

    // ───────────── 主題甲 二十世紀亞洲的現代化與蛻變 ─────────────
    {
      key: 'theme-a-modernization',
      label: '主題甲：二十世紀亞洲的現代化與蛻變 Modernization and Transformation in Twentieth-century Asia（卷二）',
      persona: HIST_PERSONA,
      areas: [
        {
          key: 'japan-southeast-asia',
          label: '日本與東南亞的現代化',
          keyConcepts: ['明治維新與日本的現代化（政治、經濟、軍事、社會）', '日本由軍國主義到戰後民主與經濟起飛', '東南亞國家的去殖民化與獨立（如印尼、菲律賓、新加坡、馬來西亞）', '東南亞的政治與經濟發展模式', '現代化的推力與阻力、傳統與西化的張力'],
          markingConventions: ['論述題用分層給分：扣題、論證、多角度、史實支撐並重', '比較 / 評估題要兩面衡量後下判斷', '史實（年代、人物、政策、條約）要準確', '舉個案 / 史例支撐論點，唔可空談概念', '緊扣設問所限的範圍（國家 / 時段 / 範疇）'],
          commonErrors: ['只敘述事件經過、欠分析與評價', '以日本或單一國家概括整個東南亞', '年代 / 政策 / 人物史實錯誤', '離開設問時段或範疇', '論點無史例支撐、流於空泛', '以偏概全（單因論）'],
          rubric: [
            { criterion: '史實 / 理解', max: 7, focus: '準確、相關、足夠' },
            { criterion: '論證 / 多角度', max: 7, focus: '扣題、分層、兼顧不同角度' },
            { criterion: '分析 / 評價', max: 5, focus: '因果、比較、有判斷' },
            { criterion: '結構 / 表達', max: 3, focus: '段落清晰、首尾扣題' },
          ],
          issueTypes: ['fact', 'argument', 'analysis', 'evidence', 'wording'],
        },
        {
          key: 'china-modernization',
          label: '中國的現代化歷程',
          keyConcepts: ['晚清改革與辛亥革命', '軍閥、國民政府與抗戰下的建國嘗試', '中華人民共和國成立後的政治運動與經濟路線', '改革開放與經濟現代化', '現代化過程中的延續與轉變（continuity & change）'],
          markingConventions: ['長時段轉變題要顯示延續與轉變、分階段論述', '評價政策 / 運動要兼列成效與代價', '史實（年代、領導人、政策名稱）要準確', '比較不同時期 / 路線要立準則對照', '結論要扣返設問下判斷'],
          commonErrors: ['年代 / 政策名稱 / 領導人張冠李戴', '只講一個時期、未顯長時段轉變', '一面倒褒貶、欠平衡評價', '時代錯置（把後事因素套落前期）', '敘述為主、欠分析與判斷'],
          rubric: [
            { criterion: '史實 / 理解', max: 7, focus: '準確、分階段、相關' },
            { criterion: '論證 / 多角度', max: 7, focus: '延續與轉變、扣題' },
            { criterion: '分析 / 評價', max: 5, focus: '成效與代價、有判斷' },
            { criterion: '結構 / 表達', max: 3, focus: '時序清晰、扣題' },
          ],
          issueTypes: ['fact', 'argument', 'analysis', 'evidence', 'wording'],
        },
        {
          key: 'hong-kong-growth',
          label: '香港的成長與蛻變',
          keyConcepts: ['二十世紀香港的政治、經濟、社會與文化轉變', '由轉口港到工業化再到服務業 / 金融中心', '人口、移民與城市發展', '香港與中國內地、國際的互動', '殖民管治下的社會變遷與身份'],
          markingConventions: ['多範疇轉變題要分政治 / 經濟 / 社會 / 文化論述', '舉香港具體史例（政策、事件、數據趨勢）支撐', '評轉變要講推動因素與影響', '比較不同時期要立準則', '緊扣設問所限範疇與時段'],
          commonErrors: ['泛談「香港進步」而無具體史例', '只講經濟、忽略政治 / 社會 / 文化', '史實 / 時序錯誤', '因果單一、忽略內外因素互動', '離題或範疇不符'],
          rubric: [
            { criterion: '史實 / 理解', max: 7, focus: '具體香港史例、準確' },
            { criterion: '論證 / 多角度', max: 7, focus: '多範疇、扣題' },
            { criterion: '分析 / 評價', max: 5, focus: '因果、影響、判斷' },
            { criterion: '結構 / 表達', max: 3, focus: '分類清晰、扣題' },
          ],
          issueTypes: ['fact', 'argument', 'analysis', 'evidence', 'wording'],
        },
      ],
    },

    // ───────────── 主題乙 二十世紀世界的衝突與合作 ─────────────
    {
      key: 'theme-b-conflict-cooperation',
      label: '主題乙：二十世紀世界的衝突與合作 Conflicts and Cooperation in Twentieth-century World（卷二）',
      persona: HIST_PERSONA,
      areas: [
        {
          key: 'world-wars',
          label: '兩次世界大戰的成因、進程與影響',
          keyConcepts: ['第一次世界大戰的成因（同盟對立、軍備競賽、民族主義、導火線）與後果', '凡爾賽和約與戰間期的不穩', '第二次世界大戰的成因（綏靖、侵略擴張、和約遺患）與影響', '極權主義的興起', '戰爭對國際秩序、社會與科技的影響'],
          markingConventions: ['成因題要分長期 / 短期、結構 / 導火線並衡量輕重', '影響題要分範疇（政治 / 經濟 / 社會 / 國際秩序）', '史實（年份、條約、會議、人物）要準確', '「最重要成因」題要比較各因素、下判斷', '多角度兼顧、避免單因論'],
          commonErrors: ['成因羅列而無比較 / 無分輕重', '單因論（只歸咎一個原因）', '年份 / 條約 / 會議名稱錯誤', '混淆一戰與二戰的成因 / 事件', '影響只講一面、欠分範疇'],
          rubric: [
            { criterion: '史實 / 理解', max: 7, focus: '成因 / 進程 / 影響準確' },
            { criterion: '論證 / 多角度', max: 7, focus: '長短期、分輕重、扣題' },
            { criterion: '分析 / 評價', max: 5, focus: '比較因素、下判斷' },
            { criterion: '結構 / 表達', max: 3, focus: '分類清晰、扣題' },
          ],
          issueTypes: ['fact', 'argument', 'analysis', 'evidence', 'wording'],
        },
        {
          key: 'cold-war',
          label: '冷戰的起源、發展與終結',
          keyConcepts: ['冷戰起源（意識形態對立、戰後勢力範圍、互不信任）', '美蘇對抗的形式（軍備 / 太空競賽、代理戰爭、危機）', '主要事件（柏林危機、古巴導彈危機、韓戰、越戰等）', '緩和（détente）與冷戰終結', '冷戰對世界格局的影響'],
          markingConventions: ['起源題要兼顧美 / 蘇雙方視角與責任之辯', '事件題要扣因果與影響、唔止記述', '史實（年份、危機、領導人、條約）要準確', '評「誰之過」要兩面舉證後下判斷', '緊扣設問時段與焦點'],
          commonErrors: ['單方面歸咎美國或蘇聯、欠雙視角', '事件記述為主、欠因果分析', '混淆事件年份 / 次序', '把熱戰與冷戰概念混淆', '離開設問所限時段 / 事件'],
          rubric: [
            { criterion: '史實 / 理解', max: 7, focus: '起源 / 事件 / 影響準確' },
            { criterion: '論證 / 多角度', max: 7, focus: '雙方視角、扣題' },
            { criterion: '分析 / 評價', max: 5, focus: '因果、責任之辯、判斷' },
            { criterion: '結構 / 表達', max: 3, focus: '時序清晰、扣題' },
          ],
          issueTypes: ['fact', 'argument', 'analysis', 'evidence', 'wording'],
        },
        {
          key: 'international-cooperation',
          label: '國際協作與衝突解決',
          keyConcepts: ['國際聯盟的成立、運作與失敗', '聯合國的角色、機制與局限', '區域與國際組織（如歐盟、東盟）的合作', '集體安全、維和與裁軍', '全球化下的協作與張力'],
          markingConventions: ['評組織成效要兼列成功與局限 / 失敗個案', '比較國聯與聯合國要立準則對照', '史實（成立年份、事件、個案）要準確', '「在多大程度上有效」題要下程度判斷', '舉具體個案支撐評價'],
          commonErrors: ['只講組織宗旨、無評實際成效', '一面倒讚 / 彈、欠平衡', '混淆國聯與聯合國的事件 / 職能', '無具體個案支撐', '離開設問焦點（機制 vs 成效）'],
          rubric: [
            { criterion: '史實 / 理解', max: 7, focus: '組織 / 個案準確' },
            { criterion: '論證 / 多角度', max: 7, focus: '成功與局限、扣題' },
            { criterion: '分析 / 評價', max: 5, focus: '比較、程度判斷' },
            { criterion: '結構 / 表達', max: 3, focus: '條理清晰、扣題' },
          ],
          issueTypes: ['fact', 'argument', 'analysis', 'evidence', 'wording'],
        },
      ],
    },
  ],
  publicResources: [
    { label: 'HKEAA History 科目資訊（官方：課程評估 / 樣本試題 / 表現示例）', url: 'https://www.hkeaa.edu.hk/en/HKDSE/assessment/subject_information/category_a_subjects/hist/' },
    { label: 'HKEAA HKDSE 科目資訊總頁（如上述連結失效時的入口）', url: 'https://www.hkeaa.edu.hk/en/hkdse/assessment/subject_information/' },
    { label: 'EDB 歷史科課程及評估指引（中四至中六，官方課程文件）', url: 'https://www.edb.gov.hk/en/curriculum-development/kla/pshe/references-and-resources/history/index.html' },
    { label: 'EDB 個人、社會及人文教育學習領域（History 課程資源入口）', url: 'https://www.edb.gov.hk/en/curriculum-development/kla/pshe/index.html' },
    { label: 'HKEAA — HKDSE 統計資料（各科分數分佈 / 等級，供校準參考）', url: 'https://www.hkeaa.edu.hk/en/hkdse/assessment/exam_report/' },
  ],
  source:
    '提煉自 HKEAA History 課程及評估指引 / 評核大綱（卷一 資料回應題 60%，全部必答 + 卷二 論述題 40%，7 題選答 2 題；無 SBA；兩大必修主題：主題甲 二十世紀亞洲的現代化與蛻變 Modernization and Transformation、主題乙 二十世紀世界的衝突與合作 Conflicts and Cooperation）+ EDB 歷史科課程文件 + 公開可靠補充資源對課題與答題技巧的整理 + DSE History 批改知識（資料題扣資料與出處評估、論述題分層給分 level marking）。官方 Sample Performance / 考評報告（examiner report）可逐題校準常見失分。所有內容僅為衍生指引，並無照搬 HKEAA 試題原文或官方評分準則原句。',
}
