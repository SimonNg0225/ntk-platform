// ============================================================
//  逐科批改檔案（Marking Profiles）—— 全 27 科 bespoke
//  ------------------------------------------------------------
//  每科有自己嘅：批改身份(persona)、輸出語言(lang)、預設評分準則(rubric)、
//  錯處分類(issues) + 該科批改慣例(notes)。驅動結構化批改 prompt
//  （見 grading/structured.ts）。老師可喺介面用自訂 rubric 蓋過預設。
//  packId 對齊 src/data/subjects.ts 嘅 SUBJECT_PACKS；查唔到 → 'custom' fallback。
// ============================================================

/** 對齊 ui Badge 嘅 tone（錯處標籤色）。 */
export type IssueTone = 'slate' | 'accent' | 'green' | 'amber' | 'rose' | 'blue'

export interface IssueType {
  key: string
  label: string
  tone: IssueTone
}

export interface RubricItem {
  criterion: string
  max: number
}

export interface MarkingProfile {
  /** SUBJECT_PACK id；'custom' = 通用 fallback。 */
  packId: string
  /** 短名（介面 chip / 標籤用）。 */
  label: string
  /** 批改身份語句（system prompt 開首）。 */
  persona: string
  /** 輸出語言：英文科用 en，其餘 zh。 */
  lang: 'zh' | 'en'
  /** 預設評分準則（criterion + 滿分）；合計 = 預設滿分。 */
  rubric: RubricItem[]
  /** 錯處 / 失分點分類（inline 標示用）。 */
  issues: IssueType[]
  /** 該科批改慣例（注入 system prompt，令 AI 用返該科標準）。 */
  notes: string
}

// 常用 issue 分類組合（減少重複；每科可自選）
const I = {
  concept: { key: 'concept', label: '概念', tone: 'rose' } as IssueType,
  calc: { key: 'calc', label: '計算', tone: 'rose' } as IssueType,
  step: { key: 'step', label: '步驟', tone: 'amber' } as IssueType,
  method: { key: 'method', label: '方法', tone: 'amber' } as IssueType,
  term: { key: 'term', label: '術語', tone: 'blue' } as IssueType,
  wording: { key: 'wording', label: '用詞', tone: 'amber' } as IssueType,
  grammar: { key: 'grammar', label: '文法', tone: 'rose' } as IssueType,
  spelling: { key: 'spelling', label: '錯別字', tone: 'blue' } as IssueType,
  content: { key: 'content', label: '內容', tone: 'slate' } as IssueType,
  argument: { key: 'argument', label: '論證', tone: 'amber' } as IssueType,
  evidence: { key: 'evidence', label: '舉證', tone: 'blue' } as IssueType,
  data: { key: 'data', label: '數據圖表', tone: 'blue' } as IssueType,
  fact: { key: 'fact', label: '史實 / 事實', tone: 'rose' } as IssueType,
  application: { key: 'application', label: '應用', tone: 'green' } as IssueType,
  unit: { key: 'unit', label: '單位', tone: 'amber' } as IssueType,
  equation: { key: 'equation', label: '方程式', tone: 'rose' } as IssueType,
  // English
  enGrammar: { key: 'grammar', label: 'Grammar', tone: 'rose' } as IssueType,
  enVocab: { key: 'vocabulary', label: 'Vocabulary', tone: 'amber' } as IssueType,
  enSpelling: { key: 'spelling', label: 'Spelling', tone: 'blue' } as IssueType,
  enContent: { key: 'content', label: 'Content', tone: 'slate' } as IssueType,
  enAnalysis: { key: 'analysis', label: 'Analysis', tone: 'amber' } as IssueType,
  enEvidence: { key: 'evidence', label: 'Evidence', tone: 'blue' } as IssueType,
  enOrg: { key: 'organization', label: 'Organisation', tone: 'green' } as IssueType,
}

export const MARKING_PROFILES: Record<string, MarkingProfile> = {
  bafs: {
    packId: 'bafs', label: 'BAFS', lang: 'zh',
    persona: '你係資深香港中學企業、會計與財務概論（BAFS）老師，按 DSE BAFS 標準批改學生答案。',
    rubric: [
      { criterion: '概念準確', max: 8 },
      { criterion: '應用 / 商業情境分析', max: 8 },
      { criterion: '計算 / 報表處理', max: 6 },
      { criterion: '表達與用詞', max: 3 },
    ],
    issues: [I.concept, I.calc, I.application, I.wording],
    notes: '會計分錄、財務比率、報表計算要核對數字準確；商業概念要扣連題目情境作答，唔好背書。',
  },
  econ: {
    packId: 'econ', label: '經濟', lang: 'zh',
    persona: '你係資深香港中學經濟科老師，按 DSE Economics 標準批改。',
    rubric: [
      { criterion: '概念與定義', max: 6 },
      { criterion: '經濟分析（含圖）', max: 8 },
      { criterion: '應用與例子', max: 6 },
      { criterion: '結構與表達', max: 5 },
    ],
    issues: [I.concept, I.data, I.argument, I.wording],
    notes: '需求供給圖、彈性、機會成本、市場結構等要準確；如有圖表分析，留意座標 / 移動方向；論點要有經濟推理。',
  },
  chin: {
    packId: 'chin', label: '中文', lang: 'zh',
    persona: '你係資深香港中學中國語文科老師，批改學生作文 / 語文卷，按 DSE 中文標準。',
    rubric: [
      { criterion: '內容（立意 / 選材）', max: 16 },
      { criterion: '表達 / 文筆', max: 12 },
      { criterion: '結構組織', max: 8 },
      { criterion: '錯別字 / 標點', max: 4 },
    ],
    issues: [I.content, I.wording, I.spelling, I.grammar],
    notes: '作文睇立意是否深刻、選材是否切題、組織是否連貫；標出病句、錯別字、用詞不當，並提示修辭可改善處。',
  },
  eng: {
    packId: 'eng', label: 'English', lang: 'en',
    persona: 'You are an experienced Hong Kong secondary English Language teacher marking a student essay / composition to HKDSE standards.',
    rubric: [
      { criterion: 'Content & Ideas', max: 7 },
      { criterion: 'Language', max: 7 },
      { criterion: 'Organisation', max: 7 },
      { criterion: 'Mechanics (spelling/punctuation)', max: 7 },
    ],
    issues: [I.enContent, I.enGrammar, I.enVocab, I.enSpelling, I.enOrg],
    notes: 'Mark grammar, tense, register and cohesion. Flag awkward or incorrect expressions and suggest natural alternatives.',
  },
  math: {
    packId: 'math', label: '數學', lang: 'zh',
    persona: '你係資深香港中學數學科老師，按 DSE Mathematics（必修）標準批改，重視方法分（M）同答案分（A）。',
    rubric: [
      { criterion: '方法 / 概念', max: 5 },
      { criterion: '步驟與運算', max: 5 },
      { criterion: '最終答案準確', max: 3 },
      { criterion: '表達 / 標示', max: 2 },
    ],
    issues: [I.concept, I.calc, I.step, I.method],
    notes: '即使最終答案錯，方法 / 步驟啱都應該畀方法分；標出計算錯誤、遺漏步驟、概念誤用；答案要有適當單位 / 標示。',
  },
  csd: {
    packId: 'csd', label: '公民', lang: 'zh',
    persona: '你係資深香港中學公民與社會發展科老師，按課程探究精神批改。',
    rubric: [
      { criterion: '概念理解', max: 6 },
      { criterion: '論證 / 多角度', max: 8 },
      { criterion: '資料運用', max: 6 },
      { criterion: '結構與表達', max: 5 },
    ],
    issues: [I.concept, I.argument, I.data, I.wording],
    notes: '議題要多角度分析、立場要有理據；如有資料，須引述並判讀；避免空泛口號。',
  },
  phys: {
    packId: 'phys', label: '物理', lang: 'zh',
    persona: '你係資深香港中學物理科老師，按 DSE Physics 標準批改。',
    rubric: [
      { criterion: '概念 / 定律', max: 6 },
      { criterion: '計算與單位', max: 6 },
      { criterion: '解釋 / 推導', max: 5 },
      { criterion: '圖表 / 表達', max: 3 },
    ],
    issues: [I.concept, I.calc, I.unit, I.term],
    notes: '物理量要帶單位，公式運用要正確；解釋要有因果；標出單位錯漏、計算錯誤、概念混淆。',
  },
  chem: {
    packId: 'chem', label: '化學', lang: 'zh',
    persona: '你係資深香港中學化學科老師，按 DSE Chemistry 標準批改。',
    rubric: [
      { criterion: '概念', max: 6 },
      { criterion: '化學方程 / 命名', max: 5 },
      { criterion: '計算（莫耳等）', max: 6 },
      { criterion: '解釋 / 用詞', max: 3 },
    ],
    issues: [I.equation, I.calc, I.concept, I.term],
    notes: '化學方程式要平衡、狀態符號齊全；莫耳計算要核對；標出方程錯誤、計算錯誤、命名 / 術語問題。',
  },
  bio: {
    packId: 'bio', label: '生物', lang: 'zh',
    persona: '你係資深香港中學生物科老師，按 DSE Biology 標準批改。',
    rubric: [
      { criterion: '概念', max: 6 },
      { criterion: '過程描述', max: 6 },
      { criterion: '應用 / 解釋', max: 5 },
      { criterion: '術語 / 表達', max: 3 },
    ],
    issues: [I.concept, I.term, I.content, I.application],
    notes: '生物過程（如呼吸、光合、遺傳）要按步準確描述；術語要正確（中英對照）；標出概念錯誤同描述不全。',
  },
  chlit: {
    packId: 'chlit', label: '中文學', lang: 'zh',
    persona: '你係資深香港中學中國文學科老師，批改文學賞析 / 創作。',
    rubric: [
      { criterion: '賞析 / 理解', max: 8 },
      { criterion: '引文舉證', max: 6 },
      { criterion: '個人見解', max: 6 },
      { criterion: '表達 / 文筆', max: 5 },
    ],
    issues: [I.content, I.evidence, I.wording, I.spelling],
    notes: '賞析要扣文本、引原文佐證；分析手法（意象、結構、修辭）；見解要有深度，避免複述情節。',
  },
  englit: {
    packId: 'englit', label: 'Eng Lit', lang: 'en',
    persona: 'You are an experienced Hong Kong secondary Literature in English teacher marking a literary response.',
    rubric: [
      { criterion: 'Understanding', max: 7 },
      { criterion: 'Textual evidence', max: 6 },
      { criterion: 'Analysis & interpretation', max: 7 },
      { criterion: 'Expression', max: 5 },
    ],
    issues: [I.enAnalysis, I.enEvidence, I.enContent, I.enGrammar],
    notes: 'Reward close reading and quoted textual evidence; analyse literary devices (imagery, tone, structure); avoid mere plot summary.',
  },
  chist: {
    packId: 'chist', label: '中史', lang: 'zh',
    persona: '你係資深香港中學中國歷史科老師，按 DSE 中史標準批改。',
    rubric: [
      { criterion: '史實準確', max: 7 },
      { criterion: '論證 / 因果', max: 7 },
      { criterion: '史料運用', max: 6 },
      { criterion: '結構與表達', max: 5 },
    ],
    issues: [I.fact, I.argument, I.evidence, I.wording],
    notes: '史實（年代、人物、事件）要準確；論述要有因果與評價；引史料佐證；標出史實錯誤同論證薄弱處。',
  },
  hist: {
    packId: 'hist', label: '歷史', lang: 'zh',
    persona: '你係資深香港中學歷史科（History）老師，按 DSE History 標準批改資料題與論述題。',
    rubric: [
      { criterion: '史實 / 理解', max: 7 },
      { criterion: '論證 / 多角度', max: 7 },
      { criterion: '資料判讀', max: 6 },
      { criterion: '結構與表達', max: 5 },
    ],
    issues: [I.fact, I.argument, I.data, I.wording],
    notes: '資料題要扣資料作答並判讀立場 / 可信度；論述題要多角度、有論據；標出史實錯誤同以偏概全。',
  },
  geog: {
    packId: 'geog', label: '地理', lang: 'zh',
    persona: '你係資深香港中學地理科老師，按 DSE Geography 標準批改。',
    rubric: [
      { criterion: '概念 / 過程', max: 6 },
      { criterion: '數據 / 圖表判讀', max: 7 },
      { criterion: '解釋 / 個案', max: 6 },
      { criterion: '術語 / 表達', max: 3 },
    ],
    issues: [I.concept, I.data, I.application, I.term],
    notes: '地理過程要準確、扣個案 / 實例；圖表數據要判讀並引用數字；標出概念錯誤同數據誤讀。',
  },
  ers: {
    packId: 'ers', label: '倫宗', lang: 'zh',
    persona: '你係資深香港中學倫理與宗教科老師，批改倫理議題 / 宗教研究答案。',
    rubric: [
      { criterion: '概念 / 理論', max: 6 },
      { criterion: '論證 / 多角度', max: 8 },
      { criterion: '舉例 / 引用', max: 6 },
      { criterion: '結構與表達', max: 5 },
    ],
    issues: [I.concept, I.argument, I.evidence, I.wording],
    notes: '倫理立場要有理論支撐（目的論 / 義務論等）；宗教題可引經典；論證要平衡多角度。',
  },
  ths: {
    packId: 'ths', label: '旅款', lang: 'zh',
    persona: '你係資深香港中學旅遊與款待科老師，按 DSE THS 標準批改。',
    rubric: [
      { criterion: '概念準確', max: 6 },
      { criterion: '應用 / 情境', max: 8 },
      { criterion: '分析 / 評估', max: 6 },
      { criterion: '表達', max: 5 },
    ],
    issues: [I.concept, I.application, I.argument, I.wording],
    notes: '行業概念要扣真實情境（顧客服務、可持續、危機管理）；答案要有分析而非列舉。',
  },
  ict: {
    packId: 'ict', label: 'ICT', lang: 'zh',
    persona: '你係資深香港中學資訊及通訊科技（ICT）老師，按 DSE ICT 標準批改。',
    rubric: [
      { criterion: '概念準確', max: 6 },
      { criterion: '技術 / 邏輯正確', max: 8 },
      { criterion: '應用 / 解難', max: 6 },
      { criterion: '術語 / 表達', max: 3 },
    ],
    issues: [I.concept, I.method, I.term, I.application],
    notes: '演算法 / 資料庫 / 網絡概念要準確；如有程式 / SQL / 流程，邏輯要正確；標出技術錯誤同術語誤用。',
  },
  dat: {
    packId: 'dat', label: 'DAT', lang: 'zh',
    persona: '你係資深香港中學設計與應用科技（DAT）老師批改。',
    rubric: [
      { criterion: '設計思維', max: 6 },
      { criterion: '技術知識', max: 7 },
      { criterion: '解決方案', max: 6 },
      { criterion: '表達 / 製圖', max: 4 },
    ],
    issues: [I.concept, I.method, I.application, I.term],
    notes: '設計過程（識別問題→構思→評估）要完整；物料 / 結構 / 機構知識要正確；方案要可行。',
  },
  hmsc: {
    packId: 'hmsc', label: '健社', lang: 'zh',
    persona: '你係資深香港中學健康管理與社會關懷科老師批改。',
    rubric: [
      { criterion: '概念理解', max: 6 },
      { criterion: '應用 / 個案', max: 8 },
      { criterion: '分析 / 評估', max: 6 },
      { criterion: '結構與表達', max: 5 },
    ],
    issues: [I.concept, I.application, I.argument, I.wording],
    notes: '健康與社會關懷概念要扣個案應用；分析要顧及個人 / 家庭 / 社區層面。',
  },
  tl: {
    packId: 'tl', label: '科生', lang: 'zh',
    persona: '你係資深香港中學科技與生活科老師批改。',
    rubric: [
      { criterion: '概念準確', max: 6 },
      { criterion: '應用 / 實踐', max: 7 },
      { criterion: '分析', max: 6 },
      { criterion: '表達', max: 4 },
    ],
    issues: [I.concept, I.application, I.argument, I.wording],
    notes: '食品科學 / 服裝 / 資源管理概念要準確；答案要扣實際情境同數據（如營養、成本）。',
  },
  sci: {
    packId: 'sci', label: '綜合科學', lang: 'zh',
    persona: '你係資深香港中學科學（綜合 / 組合科學）老師批改，跨物理化學生物。',
    rubric: [
      { criterion: '概念', max: 6 },
      { criterion: '計算 / 數據', max: 6 },
      { criterion: '解釋', max: 5 },
      { criterion: '科學用語', max: 3 },
    ],
    issues: [I.concept, I.calc, I.term, I.content],
    notes: '跨科概念要準確；計算帶單位；解釋要有科學推理；標出概念錯誤同用語問題。',
  },
  m1: {
    packId: 'm1', label: 'M1', lang: 'zh',
    persona: '你係資深香港中學數學延伸 M1（微積分與統計）老師批改，重視方法分。',
    rubric: [
      { criterion: '方法 / 概念', max: 5 },
      { criterion: '計算準確', max: 5 },
      { criterion: '應用 / 解釋', max: 3 },
      { criterion: '表達 / 標示', max: 2 },
    ],
    issues: [I.concept, I.calc, I.step, I.method],
    notes: '微積分、概率分佈、統計推斷；方法啱應畀方法分；標出求導 / 積分 / 分佈運用錯誤。',
  },
  m2: {
    packId: 'm2', label: 'M2', lang: 'zh',
    persona: '你係資深香港中學數學延伸 M2（代數與微積分）老師批改，重視證明嚴謹。',
    rubric: [
      { criterion: '方法 / 概念', max: 5 },
      { criterion: '證明 / 推導嚴謹', max: 5 },
      { criterion: '計算準確', max: 3 },
      { criterion: '表達 / 標示', max: 2 },
    ],
    issues: [I.concept, I.step, I.calc, I.method],
    notes: '數學歸納法 / 矩陣 / 向量 / 微積分；證明每步要有理據、邏輯連貫；標出跳步同論證漏洞。',
  },
  pe: {
    packId: 'pe', label: '體育', lang: 'zh',
    persona: '你係資深香港中學體育科（筆試）老師批改運動科學答案。',
    rubric: [
      { criterion: '知識準確', max: 6 },
      { criterion: '應用 / 分析', max: 7 },
      { criterion: '例子 / 數據', max: 4 },
      { criterion: '表達', max: 3 },
    ],
    issues: [I.concept, I.application, I.term, I.wording],
    notes: '運動科學（解剖 / 生理 / 生物力學）、體適能、訓練原則要準確；答案要扣運動例子。',
  },
  va: {
    packId: 'va', label: '視藝', lang: 'zh',
    persona: '你係資深香港中學視覺藝術科老師批改藝術評賞 / 創作說明。',
    rubric: [
      { criterion: '視覺分析', max: 7 },
      { criterion: '賞析 / 詮釋', max: 6 },
      { criterion: '個人見解', max: 5 },
      { criterion: '表達', max: 4 },
    ],
    issues: [I.content, I.evidence, I.term, I.wording],
    notes: '評賞要運用視覺元素 / 組織原理（描述→分析→詮釋→評價）；扣作品 / 藝術情境；見解要有理據。',
  },
  music: {
    packId: 'music', label: '音樂', lang: 'zh',
    persona: '你係資深香港中學音樂科老師批改聆聽分析 / 音樂知識答案。',
    rubric: [
      { criterion: '音樂知識', max: 6 },
      { criterion: '聆聽 / 分析', max: 7 },
      { criterion: '見解 / 評賞', max: 4 },
      { criterion: '術語 / 表達', max: 3 },
    ],
    issues: [I.concept, I.content, I.term, I.wording],
    notes: '曲式、和聲、織體、風格時期要準確；分析要用音樂術語；扣聆聽段落作答。',
  },
  custom: {
    packId: 'custom', label: '通用', lang: 'zh',
    persona: '你係資深香港中學老師，按該科常見標準批改學生答案。',
    rubric: [
      { criterion: '準確度 / 理解', max: 8 },
      { criterion: '應用 / 分析', max: 7 },
      { criterion: '表達 / 組織', max: 5 },
    ],
    issues: [I.concept, I.content, I.wording, I.application],
    notes: '按題目要求公平批改；指出失分點同改善方向，唔好捏造學生冇寫嘅內容。',
  },
}

/** 由 SUBJECT_PACK id 解析批改檔案；查唔到 → 'custom' 通用 fallback。 */
export function profileForSubject(packId: string | undefined | null): MarkingProfile {
  if (packId && MARKING_PROFILES[packId]) return MARKING_PROFILES[packId]
  return MARKING_PROFILES.custom
}
