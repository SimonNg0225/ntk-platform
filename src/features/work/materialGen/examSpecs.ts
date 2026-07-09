import type { Difficulty } from '../../../data/types'

// ============================================================
//  DSE-style 出題規格
//  ------------------------------------------------------------
//  這層不是儲存官方題目，而是把每科「題目應該怎樣像公開試」的規格
//  寫成可重用資料：生成前先有 blueprint，生成後亦可顯示給老師審題。
// ============================================================

export interface ExamSpec {
  id: string
  label: string
  shortLabel: string
  paperProfile: string
  mcBlueprint: string[]
  distractorRules: string[]
  qualityChecks: string[]
  teacherReviewHint: string
}

const GENERIC_SPEC: ExamSpec = {
  id: 'generic-dse',
  label: 'DSE-style 通用校準',
  shortLabel: 'DSE-style',
  paperProfile:
    '按香港高中公開試風格生成原創題目：先界定考核概念，再用情境、資料或概念辨析檢查學生能否應用，而不是只背定義。',
  mcBlueprint: [
    '每題先在內部決定：考核概念、能力層次、題型、常見錯誤概念。',
    '題幹要清楚、資訊足夠；除非是基礎題，避免只問「以下哪項是定義」。',
    '難題應包含情境、資料判斷、比較或因果推論。',
  ],
  distractorRules: [
    '每個干擾選項要源自合理錯誤概念，不可明顯荒謬。',
    '四個選項語氣、長度和抽象程度要接近，避免正解因文字最長而突出。',
    '必須只有一個最佳答案，避免兩個選項都可辯護。',
  ],
  qualityChecks: [
    '對應所選課題及科目。',
    '答案唯一、選項互斥。',
    '難度與所選層級一致。',
    '附每個選項的對錯原因和課堂跟進建議。',
  ],
  teacherReviewHint: '適合所有科的第一版校準；之後可按科目加入更細的題型規格。',
}

const BAFS_SPEC: ExamSpec = {
  id: 'bafs-dse',
  label: 'BAFS DSE-style 校準',
  shortLabel: 'BAFS',
  paperProfile:
    'BAFS MC 要貼近 Paper 1 compulsory part 的公開試風格：以商業情境、基礎會計處理、個人理財或管理決策檢查學生能否把概念應用到熟悉及新情境。',
  mcBlueprint: [
    '每題先在內部決定：BAFS 課題、考核概念、能力層次、情境類型、常見錯誤概念。',
    '優先使用香港商業處境：中小企、零售、招聘、營銷、融資、財務報表、投資或消費者信貸。',
    '題型要混合：概念辨析、情境應用、會計/理財處理、商業決策判斷、資料或數字解讀。',
    '中等或以上難度要有簡短情境或判斷要求，避免只問術語定義。',
  ],
  distractorRules: [
    '干擾選項要來自 BAFS 常見錯誤：混淆概念、因果倒置、把個案條件忽略、會計處理方向錯誤、管理/營銷策略過度概括。',
    '選項要全部看似合理，不能有一兩個明顯離題答案。',
    '不可複製或改寫官方試題；只生成原創 DSE-style 題目。',
  ],
  qualityChecks: [
    '是否對應 BAFS compulsory / 商業管理 / 會計課題。',
    '是否有唯一最佳答案。',
    '是否能測到應用或判斷，而不是只背誦。',
    '干擾項是否有教學價值，可反映學生常見錯因。',
    '答案解釋是否足以讓老師快速覆核。',
  ],
  teacherReviewHint:
    'BAFS MC 會額外要求商業情境、合理干擾項、選項逐項解釋和跟進建議，幫老師判斷是否真的像 DSE 題。',
}

export function examSpecForSubject(subject?: string): ExamSpec {
  const s = subject?.toLowerCase() ?? ''
  if (
    s.includes('bafs') ||
    s.includes('企會財') ||
    s.includes('會計') ||
    s.includes('商業管理')
  ) {
    return BAFS_SPEC
  }
  return GENERIC_SPEC
}

export function difficultyAbilityHint(difficulty: Difficulty): string {
  if (difficulty === 'easy') return '以概念辨識和直接應用為主，可有少量情境。'
  if (difficulty === 'medium') return '以情境應用、比較和常見錯誤辨析為主。'
  return '加入較陌生情境、資料判斷或決策評估，要求學生排除有迷惑性的干擾項。'
}

export function formatSpecForPrompt(spec: ExamSpec, difficulty: Difficulty): string {
  return [
    `DSE-style 校準：${spec.label}`,
    `試卷/評核定位：${spec.paperProfile}`,
    `難度校準：${difficultyAbilityHint(difficulty)}`,
    '出題藍圖（先在內部完成，不要輸出 blueprint）：',
    ...spec.mcBlueprint.map((x) => `- ${x}`),
    '干擾選項規則：',
    ...spec.distractorRules.map((x) => `- ${x}`),
    '生成後自我檢查：',
    ...spec.qualityChecks.map((x) => `- ${x}`),
  ].join('\n')
}
