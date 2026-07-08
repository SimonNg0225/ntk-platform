import { complete, type AIModel } from '../../../lib/aiClient'
import { extractJsonObject } from '../../../lib/aiJson'

// ============================================================
//  AI 教案生成 — prompt 建構 + 解析（解析部分純函數，可單元測試）
//  ------------------------------------------------------------
//  選擇課題 + 簡填今日教學內容/活動（可選範本骨架）→ AI 出完整教案，
//  落到現有 LessonPlan + PlanMeta（學習目標 / 分段時間 / 教材 / 活動）。
// ============================================================

export interface GenPhase {
  label: string
  minutes: number
  detail: string
}

export interface LessonGen {
  objectives: string
  phases: GenPhase[]
  materials: string[]
  activities: string
}

/** 範本骨架（給 AI 跟住填）—— 來自內建科目範本或用戶範本的 phases。 */
export interface GenSkeleton {
  name: string
  phases: { label: string; minutes: number }[]
}

export interface GenInput {
  subjectName?: string
  topic: string
  /** 老師簡填的今日教學內容 / 活動 */
  brief: string
  /** 班別名（選填，給 AI 知對象） */
  className?: string
  /** 課堂總時長（分鐘，選填） */
  durationMin?: number
  /** 可選範本骨架 */
  skeleton?: GenSkeleton
}

function clamp(s: string, max: number): string {
  const t = s.trim()
  return t.length <= max ? t : t.slice(0, max - 1) + '…'
}

// ───────── Prompt ─────────

export function buildLessonSystem(input: GenInput): string {
  const subjectLine = input.subjectName ? `任教科目：${input.subjectName}。` : ''
  const lines = [
    `你是香港中學教師的備課助手。${subjectLine}根據老師提供的課題及今日教學內容，設計一份完整、可以立即使用的課堂教案。`,
    '只輸出一個 JSON 物件，不要有任何其他文字或 markdown code fence：',
    '{',
    '  "objectives": "學習目標（用 1. 2. 3. 分點，每點具體可評估，2-4 點）",',
    '  "phases": [',
    '    {"label": "環節名（例 引入／講解／課堂活動／鞏固／總結）", "minutes": 分鐘數, "detail": "這個環節老師做什麼、學生做什麼（具體，1-3 句）"}',
    '  ],',
    '  "materials": ["所需教材／工作紙／教具（逐項）"],',
    '  "activities": "課堂主要活動描述（學生點參與，2-4 句）"',
    '}',
    '規則：',
    '- 一律繁體中文（可書面廣東話）。',
    '- 內容要貼香港中學課堂實況、對應課題；具體到老師可以照住教，不要流於空泛。',
    '- objectives 用 1. 2. 3. 分點。',
  ]
  if (input.skeleton && input.skeleton.phases.length > 0) {
    const sk = input.skeleton.phases.map((p) => `${p.label}(${p.minutes}分)`).join(' → ')
    lines.push(
      `- 環節骨架：必須跟住這個分段結構來填內容（環節名同分鐘照用，只填 detail）：${sk}。`,
    )
  } else {
    const dur = input.durationMin ?? 55
    lines.push(
      `- phases 設計 4-6 個環節，分鐘總和約 ${dur} 分鐘（一節課）；環節名用香港課堂慣用語。`,
    )
  }
  lines.push(
    '- materials 列具體教材（簡報 / 工作紙 / 試題 / 教具…），3-6 項。',
    '- 只輸出 JSON。',
  )
  return lines.join('\n')
}

function buildUserMsg(input: GenInput): string {
  const parts = [`課題：${input.topic}`]
  if (input.className) parts.push(`班別：${input.className}`)
  if (input.durationMin) parts.push(`課堂時長：約 ${input.durationMin} 分鐘`)
  if (input.brief.trim()) parts.push(`今日教學內容／活動：${input.brief.trim()}`)
  if (input.skeleton) parts.push(`採用範本：${input.skeleton.name}`)
  return parts.join('\n')
}

// ───────── 解析 ─────────

/** 解析 AI 教案回應；格式不正確 throw。 */
export function parseLessonGen(raw: string): LessonGen {
  const o = extractJsonObject<Record<string, unknown>>(raw)
  if (!o || typeof o !== 'object') throw new Error('AI 回應格式不正確，請再試一次。')

  const objectives = typeof o.objectives === 'string' ? clamp(o.objectives, 600) : ''
  const activities = typeof o.activities === 'string' ? clamp(o.activities, 600) : ''

  const phases: GenPhase[] = []
  if (Array.isArray(o.phases)) {
    for (const p of o.phases) {
      if (!p || typeof p !== 'object') continue
      const r = p as Record<string, unknown>
      const label = typeof r.label === 'string' ? r.label.trim() : ''
      if (!label) continue
      const minRaw = typeof r.minutes === 'number' && isFinite(r.minutes) ? r.minutes : 0
      const minutes = Math.max(0, Math.min(120, Math.round(minRaw)))
      const detail = typeof r.detail === 'string' ? clamp(r.detail, 200) : ''
      phases.push({ label: clamp(label, 20), minutes, detail })
      if (phases.length >= 8) break
    }
  }

  const materials: string[] = []
  if (Array.isArray(o.materials)) {
    for (const m of o.materials) {
      if (typeof m !== 'string') continue
      const t = m.trim()
      if (!t) continue
      materials.push(clamp(t, 60))
      if (materials.length >= 12) break
    }
  }

  if (!objectives && phases.length === 0) {
    throw new Error('AI 出不到教案內容，嘗試換 Pro 或補充今日內容。')
  }

  return { objectives, phases, materials, activities }
}

/** 跑 AI 生成教案。失敗 throw（UI toast）。 */
export async function generateLesson(input: GenInput, model: AIModel): Promise<LessonGen> {
  const raw = await complete({
    system: buildLessonSystem(input),
    messages: [{ role: 'user', content: buildUserMsg(input) }],
    model,
    temperature: 0.5,
    source: 'lessons',
  })
  return parseLessonGen(raw)
}
