import type { ModeId } from '../../../modes/modes'

// ============================================================
//  內建 prompt 範本庫（跟模式分；用 {{變數}} 佔位）
//  ------------------------------------------------------------
//  插入時若有 {{…}}，UI 會彈表單收集變數再填返入去。
// ============================================================

export interface BuiltinTemplate {
  id: string
  title: string
  body: string
  category: string
}

export const TEMPLATE_VAR_RE = /\{\{\s*([^}]+?)\s*\}\}/g

/** 抽出範本入面所有 {{變數}}（去重、保留次序） */
export function extractVars(body: string): string[] {
  const out: string[] = []
  for (const m of body.matchAll(TEMPLATE_VAR_RE)) {
    const name = m[1].trim()
    if (name && !out.includes(name)) out.push(name)
  }
  return out
}

/** 用 values 填返 {{變數}}；未填嘅留空白 */
export function fillTemplate(body: string, values: Record<string, string>): string {
  return body.replace(TEMPLATE_VAR_RE, (_, raw: string) => {
    const key = raw.trim()
    return (values[key] ?? '').trim()
  })
}

const LEARNING_TEMPLATES: BuiltinTemplate[] = [
  {
    id: 'l-explain',
    category: '理解',
    title: '淺白解釋概念',
    body: '用淺白方式、配合一個生活例子，向初學者解釋以下概念：\n\n{{概念}}',
  },
  {
    id: 'l-eli5',
    category: '理解',
    title: '當我係中學生咁解',
    body: '假設我係中四學生，用比喻同步驟拆解以下內容，再用一句總結：\n\n{{內容}}',
  },
  {
    id: 'l-summary',
    category: '總結',
    title: '總結筆記重點',
    body: '幫我總結以下筆記，輸出：① 3-5 個重點 ② 一句 take-away ③ 2 條可以自測嘅問題。\n\n{{筆記}}',
  },
  {
    id: 'l-compare',
    category: '總結',
    title: '比較兩個概念',
    body: '用表格比較「{{概念 A}}」同「{{概念 B}}」：相同點、不同點、各自適用情況。',
  },
  {
    id: 'l-quiz',
    category: '練習',
    title: '出練習題（連答案）',
    body: '就以下主題出 {{題數}} 條練習題（混合 MC 同短答），每題附答案同簡短解釋：\n\n{{主題}}',
  },
  {
    id: 'l-plan',
    category: '規劃',
    title: '溫習大綱',
    body: '幫我為「{{科目／主題}}」整理一份 {{日數}} 日溫習大綱，每日列明重點同建議時數。',
  },
  {
    id: 'l-feynman',
    category: '練習',
    title: 'Feynman 自測',
    body: '我會用自己嘅話解釋「{{概念}}」，你扮唔識嘅人發問同捉漏洞，最後指出我邊度理解有誤。我嘅解釋：\n\n{{我的解釋}}',
  },
]

const WORK_TEMPLATES: BuiltinTemplate[] = [
  {
    id: 'w-mc',
    category: '出題',
    title: 'BAFS MC 題',
    body: '就 BAFS 課題「{{課題}}」出 {{題數}} 條 MC 題（4 選項），每題附正確答案同每個選項嘅解釋（為何啱／錯）。',
  },
  {
    id: 'w-structured',
    category: '出題',
    title: 'BAFS 結構式問題',
    body: '就「{{課題}}」設計一條 {{分數}} 分結構式問題（分 a/b/c 小題），連參考答案同 marking scheme。',
  },
  {
    id: 'w-lessonplan',
    category: '教學',
    title: '教案大綱',
    body: '幫我寫一份 BAFS 教案大綱：課題「{{課題}}」，共 {{節數}} 節（每節 40 分鐘）。列明學習目標、教學流程、活動同評估方式。',
  },
  {
    id: 'w-activity',
    category: '教學',
    title: '課堂活動設計',
    body: '為課題「{{課題}}」設計一個 {{時間}} 分鐘嘅互動課堂活動，包括目標、步驟、分組安排同總結提問。',
  },
  {
    id: 'w-feedback',
    category: '批改',
    title: '擬批改評語',
    body: '以下係學生對「{{題目}}」嘅答案，請擬一段建設性批改評語（指出優點、不足、改善建議），語氣鼓勵。學生答案：\n\n{{學生答案}}',
  },
  {
    id: 'w-rubric',
    category: '批改',
    title: '評分準則 (rubric)',
    body: '為「{{任務}}」設計一個 {{等級數}} 級評分準則（rubric），列明每級嘅描述同分數範圍。',
  },
  {
    id: 'w-parent',
    category: '溝通',
    title: '家長通訊草稿',
    body: '幫我草擬一段俾家長嘅訊息：關於「{{事項}}」，語氣專業有禮，重點清晰。',
  },
]

export function builtinTemplates(mode: ModeId): BuiltinTemplate[] {
  return mode === 'work' ? WORK_TEMPLATES : LEARNING_TEMPLATES
}
