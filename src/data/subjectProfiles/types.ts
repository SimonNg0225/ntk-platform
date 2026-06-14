// ============================================================
//  科目知識檔案（Subject Knowledge Profile）— 型別
//  ------------------------------------------------------------
//  逐科「度身定制」批改 / 教學嘅單一真相來源。比 grading/markingProfiles
//  嘅 generic 版豐富：分學習範疇（strand）、逐課題範疇（area）有自己嘅
//  核心概念 / 批改慣例 / 常見錯誤 / 評分準則。
//  詳見 docs/subject-profiles.md。
// ============================================================

export interface AreaRubricItem {
  criterion: string
  max: number
  /** 呢個準則睇咩（畀 AI 批改指引）。 */
  focus: string
}

/** 一個課題範疇（topic area）嘅批改檔案。 */
export interface AreaProfile {
  key: string
  label: string
  /** 呢範疇要考嘅核心概念。 */
  keyConcepts: string[]
  /** 呢範疇點批改（方法分 / 答案分 / 格式 / 可接受答案…）。 */
  markingConventions: string[]
  /** 考生喺呢範疇最常見嘅失分 / 錯誤。 */
  commonErrors: string[]
  /** 建議評分準則。 */
  rubric: AreaRubricItem[]
  /** 呢範疇用嘅錯處分類 key（對齊 grading/markingProfiles 嘅 issue keys）。 */
  issueTypes: string[]
}

/** 一個學習範疇（strand），例如 BAFS 嘅 會計 / 商業管理。 */
export interface StrandProfile {
  key: string
  label: string
  /** 批改身份語句（system prompt 開首）。 */
  persona: string
  areas: AreaProfile[]
}

/** 一科嘅完整知識檔案。 */
export interface SubjectKnowledge {
  /** SUBJECT_PACK id。 */
  subject: string
  label: string
  lang: 'zh' | 'en'
  assessment: {
    papers: string[]
    weightings: string
    questionTypes: string[]
    sba: string
  }
  /** DSE 常用命令詞（答題動詞）+ 含意。 */
  commandWords: { word: string; meaning: string }[]
  /** 等級描述（答題質素層級）。 */
  levelDescriptors: { level: string; descriptor: string }[]
  strands: StrandProfile[]
  /** 公開參考資源（官方 + 非官方；畀老師延伸 / 校準）。 */
  publicResources?: { label: string; url: string }[]
  /** 出處 / 提煉來源註明。 */
  source: string
}
