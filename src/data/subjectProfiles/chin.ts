import type { SubjectKnowledge } from './types'

// ============================================================
//  中國語文（中文）科目知識檔案 — 閱讀 + 寫作
//  ------------------------------------------------------------
//  2024 起公開試改制：取消卷三（聆聽及綜合）、卷四（說話）；
//  只餘 卷一 閱讀（40%）+ 卷二 寫作（45%）+ 校本評核 SBA（15%）。
//  提煉來源：HKEAA 中國語文課程及評估指引 / 評核大綱 + 公開網上資源
//  （AfterSchool / Issac Lo / notesity 等對寫作評分準則、十二篇、常見錯誤嘅整理）
//  + DSE 中文批改知識。批改慣例可再以官方表現示例校準。
// ============================================================

export const CHIN: SubjectKnowledge = {
  subject: 'chin',
  label: '中國語文',
  lang: 'zh',
  assessment: {
    papers: [
      '卷一 閱讀能力（40%）：指定文言經典（十二篇，約佔卷一三成）+ 課外文言 + 白話文，考字詞、語譯、內容理解、寫作手法賞析',
      '卷二 寫作能力（45%）：甲部 實用文 + 乙部 命題作文（記敘 / 抒情 / 描寫 / 說明 / 議論）',
      '校本評核 SBA（15%）：閱讀匯報 / 課業（校內評，唔喺此 AI 批改範圍）',
    ],
    weightings: '卷一閱讀 40% · 卷二寫作 45% · SBA 15%。（2024 起取消卷三聆聽綜合、卷四說話。）',
    questionTypes: ['文言字詞解釋 / 語譯', '指定篇章內容 / 主旨 / 賞析', '白話文閱讀理解（內容 / 手法 / 詞句賞析）', '實用文（書信 / 演講辭 / 建議書 / 啟事…）', '命題作文（記敘 / 抒情 / 描寫 / 說明 / 議論）'],
    sba: '校本評核佔 15%（閱讀 / 課業表現，校內評）。',
  },
  commandWords: [
    { word: '語譯 / 試譯', meaning: '把文言準確譯成白話，要通順、唔可漏意 / 望文生義。' },
    { word: '解釋（字詞）', meaning: '解字義 / 詞義，扣返文中語境。' },
    { word: '賞析', meaning: '指出寫作手法 + 效果 + 所抒情感 / 主旨，唔可淨係抄原文。' },
    { word: '分析', meaning: '拆解、扣文本 / 引文佐證。' },
    { word: '比較', meaning: '逐點對比（如兩篇 / 兩段 / 兩個人物）。' },
    { word: '評價 / 評論', meaning: '有立場 + 理據 + 扣文本。' },
    { word: '試從…說明 / 闡述', meaning: '扣指定角度作答，唔好離開設問範圍。' },
  ],
  levelDescriptors: [
    { level: '上品（高）', descriptor: '立意深刻、內容充實緊扣題目；結構嚴謹、層次分明；文筆流暢、用詞修辭得體；極少錯別字。' },
    { level: '中品', descriptor: '內容切題但深度一般 / 偶有鬆散；結構大致清晰；文句尚通順；偶有錯別字。' },
    { level: '下品', descriptor: '內容單薄或部分離題；結構鬆散；文句欠通；錯別字較多。' },
    { level: '下下品（低）', descriptor: '嚴重離題 / 內容貧乏 / 語句不通 / 錯別字連篇。' },
  ],
  strands: [
    // ───────────────────── 閱讀能力（卷一）─────────────────────
    {
      key: 'reading',
      label: '閱讀能力（卷一）',
      persona: '你係資深香港中學中國語文科閱讀卷評卷員，按 DSE 卷一標準批改：答案要緊扣原文 / 引文，文言重語譯準確，白話重內容理解與手法賞析。',
      areas: [
        {
          key: 'classical-set',
          label: '指定文言經典（十二篇）',
          keyConcepts: [
            '十二篇：論語（論仁/論孝/論君子）、魚我所欲也、逍遙遊（節錄）、勸學（節錄）、廉頗藺相如列傳（節錄）、出師表、師說、始得西山宴遊記、岳陽樓記、六國論',
            '唐詩三首：山居秋暝（王維）、月下獨酌（李白）、登樓（杜甫）',
            '詞三首：念奴嬌·赤壁懷古（蘇軾）、聲聲慢·秋情（李清照）、青玉案·元夕（辛棄疾）',
            '各篇主旨、論證 / 抒情手法、名句、重點字詞',
          ],
          markingConventions: ['字詞解釋 / 語譯要準確扣語境', '內容 / 主旨要引篇章佐證', '賞析要「手法 + 效果 + 情感 / 主旨」三者齊'],
          commonErrors: ['背誦不熟 / 張冠李戴（混淆篇章作者）', '語譯生硬或望文生義', '答賞析只抄原文唔解釋', '主旨講錯 / 流於空泛'],
          rubric: [
            { criterion: '字詞 / 語譯', max: 4, focus: '解釋、語譯準確通順' },
            { criterion: '內容 / 主旨理解', max: 5, focus: '扣篇章、引文佐證' },
            { criterion: '手法賞析', max: 4, focus: '手法 + 效果 + 情感' },
          ],
          issueTypes: ['content', 'wording', 'argument', 'spelling'],
        },
        {
          key: 'classical-unseen',
          label: '課外文言',
          keyConcepts: ['常見實詞 / 虛詞（之乎者也而以於）', '文言句式（判斷 / 被動 / 倒裝 / 省略）', '語譯', '內容 / 人物 / 道理理解'],
          markingConventions: ['語譯要逐字落實再通順', '字詞解釋扣語境', '內容題引文佐證'],
          commonErrors: ['望文生義（以今義解古義）', '語譯漏字 / 增意', '虛詞用法搞錯', '句式誤解致解錯句意'],
          rubric: [
            { criterion: '字詞解釋', max: 4, focus: '實 / 虛詞準確' },
            { criterion: '語譯', max: 5, focus: '落實 + 通順' },
            { criterion: '內容理解', max: 4, focus: '扣原文' },
          ],
          issueTypes: ['content', 'wording', 'grammar'],
        },
        {
          key: 'vernacular',
          label: '白話文閱讀理解',
          keyConcepts: ['內容 / 段意 / 主旨', '寫作手法（記敘 / 描寫 / 抒情 / 說明 / 議論、修辭、結構）', '詞句賞析', '篇章結構與作者情感 / 觀點'],
          markingConventions: ['答案要扣返原文（引 / 撮）', '分點清楚、對應設問分數', '手法題要講「手法 + 文中例子 + 效果」', '賞析唔可抄原文當答案'],
          commonErrors: ['答非所問 / 答唔對設問角度', '離開原文自由發揮', '只抄原文唔分析', '手法講到但無效果 / 無例子', '撮寫過長或抄全句'],
          rubric: [
            { criterion: '內容理解', max: 5, focus: '扣原文、對應設問' },
            { criterion: '手法 / 賞析', max: 5, focus: '手法 + 例子 + 效果' },
            { criterion: '表達 / 條理', max: 3, focus: '分點清楚、用詞準確' },
          ],
          issueTypes: ['content', 'argument', 'wording', 'spelling'],
        },
      ],
    },

    // ───────────────────── 寫作能力（卷二）─────────────────────
    {
      key: 'writing',
      label: '寫作能力（卷二）',
      persona:
        '你係資深香港中學中國語文科寫作卷評卷員，按 DSE 卷二「內容 / 表達 / 結構」分品評分。鐵則：先審題是否緊扣題目（離題嚴重直接降品）；錯別字按 0–1=3分、2–4=2分、5–7=1分、8 個或以上=0 分扣減；標題不當 / 多餘格式 / 欠標題酌量扣 1–2 分。',
      areas: [
        {
          key: 'narrative',
          label: '記敘 / 抒情文',
          keyConcepts: ['審題、立意、選材、佈局', '記敘六要素與詳略', '描寫（人 / 景 / 物）與借景抒情', '真情實感、主題昇華'],
          markingConventions: ['內容（立意 / 選材）權重最高', '緊扣題目 / 情境', '記敘要有詳略、抒情要自然不造作', '結構：開展 / 過渡 / 呼應'],
          commonErrors: ['離題 / 偏離題旨', '記流水帳、缺詳略', '抒情造作 / 喊口號', '選材老套重複', '結構鬆散、虎頭蛇尾'],
          rubric: [
            { criterion: '內容（立意 / 選材）', max: 7, focus: '緊扣題目、立意深、選材切' },
            { criterion: '表達 / 文筆', max: 6, focus: '文句流暢、描寫抒情、修辭' },
            { criterion: '結構組織', max: 4, focus: '層次、過渡、呼應' },
            { criterion: '錯別字 / 標點', max: 3, focus: '按錯別字級扣分' },
          ],
          issueTypes: ['content', 'wording', 'grammar', 'spelling'],
        },
        {
          key: 'argument',
          label: '議論 / 論說文',
          keyConcepts: ['論點、論據、論證', '立論 / 駁論', '舉例 + 分析（以例證理）', '結構：引論 / 本論 / 結論'],
          markingConventions: ['論點要明確扣題', '論據充實多元（事例 / 名言 / 道理）', '論證嚴密：例子後要分析扣回論點', '兼顧反方 / 駁論更佳'],
          commonErrors: ['論點不清 / 中途轉軚', '以例代論（舉例無分析）', '論據單薄 / 老套', '離題 / 答非設問', '結構失衡（重例輕論）'],
          rubric: [
            { criterion: '內容（論點 / 論據）', max: 7, focus: '論點扣題、論據充實' },
            { criterion: '論證 / 表達', max: 6, focus: '以例證理、文句說服力' },
            { criterion: '結構組織', max: 4, focus: '引本結、層次' },
            { criterion: '錯別字 / 標點', max: 3, focus: '按錯別字級扣分' },
          ],
          issueTypes: ['content', 'argument', 'wording', 'spelling'],
        },
        {
          key: 'descriptive-expository',
          label: '描寫 / 說明文',
          keyConcepts: ['描寫：多感官 / 細節 / 順序', '說明：說明方法（舉例 / 比較 / 數據 / 分類）', '客觀準確 vs 生動形象', '條理與順序'],
          markingConventions: ['描寫重生動具體、說明重清晰準確', '順序合理（時 / 空 / 邏輯）', '緊扣對象 / 題目'],
          commonErrors: ['描寫空泛抽象、欠細節', '說明不清 / 條理亂', '描寫變記敘 / 文體不符', '離題'],
          rubric: [
            { criterion: '內容', max: 7, focus: '扣題、具體 / 準確' },
            { criterion: '表達', max: 6, focus: '描寫生動 / 說明清晰' },
            { criterion: '結構組織', max: 4, focus: '順序、條理' },
            { criterion: '錯別字 / 標點', max: 3, focus: '按錯別字級扣分' },
          ],
          issueTypes: ['content', 'wording', 'grammar', 'spelling'],
        },
        {
          key: 'practical',
          label: '實用文（甲部）',
          keyConcepts: ['常見文體：書信 / 演講辭 / 建議書 / 啟事 / 報告 / 便條', '格式（稱呼 / 上下款 / 日期 / 標題）', '語境意識（對象 / 身分 / 場合）', '內容對應任務要求'],
          markingConventions: ['格式分（格式啱晒先得格式分）', '語境語氣要切合對象身分', '內容要完成題目指定任務 / 要點', '欠標題 / 多餘格式按規則扣分'],
          commonErrors: ['格式錯漏（欠稱呼 / 上下款 / 日期）', '語境意識弱（語氣 / 身分唔啱）', '漏做題目要求嘅要點', '加多餘格式 / 標題不當'],
          rubric: [
            { criterion: '格式', max: 4, focus: '稱呼 / 款式 / 標題正確' },
            { criterion: '內容（任務要點）', max: 6, focus: '完成指定要求' },
            { criterion: '語境 / 表達', max: 5, focus: '語氣切合對象、文句通順' },
          ],
          issueTypes: ['content', 'wording', 'spelling', 'grammar'],
        },
      ],
    },
  ],
  publicResources: [
    { label: 'HKEAA 中國語文 科目資訊（官方：課程評估 / 樣本試題 / 表現示例）', url: 'https://www.hkeaa.edu.hk/tc/HKDSE/assessment/subject_information/category_a_subjects/chi_lang/' },
    { label: 'HKEAA 中國語文 表現示例 2024（官方考生示例）', url: 'https://www.hkeaa.edu.hk/tc/HKDSE/assessment/subject_information/category_a_subjects/chi_lang/sp/2024.html' },
    { label: 'AfterSchool — 十二篇範文精讀 / 卷二寫作評分準則', url: 'https://afterschool.com.hk/blog/244-dse-%E4%B8%AD%E6%96%87-%E5%8D%81%E4%BA%8C%E7%AF%87%E7%AF%84%E6%96%87/' },
    { label: 'notesity — 十二篇全文 / 語譯 / 重點分析', url: 'https://www.notesity.hk/pages/%E5%8D%81%E4%BA%8C%E7%AF%87%E7%AF%84%E6%96%87' },
  ],
  source:
    '提煉自 HKEAA 中國語文課程及評估指引 / 評核大綱（2024 改制：只餘卷一閱讀 + 卷二寫作 + SBA）+ 公開網上資源（AfterSchool / Issac Lo / notesity 對寫作評分準則、錯別字扣分、十二篇、常見錯誤嘅整理）+ DSE 中文批改知識。官方 PDF / 表現示例可再用嚟逐題校準。',
}
