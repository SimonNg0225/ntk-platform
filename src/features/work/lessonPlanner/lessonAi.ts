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

export interface PedagogyOption {
  id: string
  label: string
  shortLabel: string
  focus: string
  description: string
  classroomUse: string
  prompt: string
}

export const PEDAGOGY_OPTIONS: PedagogyOption[] = [
  {
    id: 'ai-learning',
    label: '配合 AI 學習元素',
    shortLabel: 'AI 學習',
    focus: '善用 AI 作提問、例子生成、即時回饋或延伸任務',
    description: '把 AI 當成學習工具，而不是只由老師用 AI 備課。',
    classroomUse: '可安排學生用 AI 產生例子、比較答案、修訂初稿，再由老師加入查證、引用和誠信要求。',
    prompt:
      '配合 AI 學習元素：設計一個可安全使用 AI 的學習任務，例如讓學生用 AI 生成例子、比較答案、取得回饋或延伸提問；同時加入老師檢核及學術誠信提醒。',
  },
  {
    id: 'self-regulated-learning',
    label: '自主學習 / SRL',
    shortLabel: '自主學習',
    focus: '讓學生設定目標、監察進度、反思下一步',
    description: 'SRL 是 Self-regulated Learning，重點是讓學生管理自己的學習過程。',
    classroomUse: '在課堂加入個人目標、成功準則、進度檢查和課末反思，讓學生知道下一步如何改善。',
    prompt:
      '自主學習（Self-regulated Learning）：加入學生自訂目標、成功準則、進度檢核及課末反思，讓學生知道自己正在學什麼、學到哪裡、下一步如何改進。',
  },
  {
    id: 'bloom-taxonomy',
    label: 'Bloom Taxonomy',
    shortLabel: 'Bloom',
    focus: '由理解到分析、評鑑、創造，提升高階思維',
    description: 'Bloom Taxonomy 是認知層次框架，由記憶、理解逐步推向分析、評鑑和創造。',
    classroomUse: '把問題設計成不同層次，例如先解釋概念，再比較個案、判斷方案，最後創作或提出建議。',
    prompt:
      'Bloom Taxonomy：學習目標及提問要覆蓋不同認知層次，特別加入分析、評鑑或創造任務，避免只停留在記憶和理解。',
  },
  {
    id: 'udl',
    label: 'UDL 多元學習設計',
    shortLabel: 'UDL',
    focus: '用多種呈現、參與及表達方式照顧差異',
    description: 'UDL 是 Universal Design for Learning，目標是在設計階段已照顧不同學生的需要。',
    classroomUse: '同一內容可用文字、圖像、示範或短片呈現；學生可用口頭、圖表或短答展示理解。',
    prompt:
      'UDL（Universal Design for Learning）：提供多種資料呈現方式、學生參與方式及成果表達方式，讓不同能力及學習偏好的學生都能參與。',
  },
  {
    id: 'differentiated-instruction',
    label: '差異化教學',
    shortLabel: '差異化',
    focus: '設計支援、核心、挑戰三層任務',
    description: '差異化教學是按學生準備度、興趣或學習需要調整任務、支援和挑戰。',
    classroomUse: '同一課題設計支援題、核心題和挑戰題，讓不同能力學生都有合適入口和進階空間。',
    prompt:
      '差異化教學：在活動或工作紙中加入支援、核心、挑戰三層任務，並指出老師如何按學生表現調整提示、分組或延伸要求。',
  },
  {
    id: 'assessment-for-learning',
    label: '促進學習的評估',
    shortLabel: 'AfL',
    focus: '用成功準則、提問、出口票即時調整教學',
    description: 'AfL 是 Assessment for Learning，重點是用評估即時改善學習，而不是只作總結評分。',
    classroomUse: '可加入成功準則、即時提問、同儕互評、出口票，讓老師即時知道學生卡在哪裡。',
    prompt:
      '促進學習的評估（Assessment for Learning）：加入清晰成功準則、關鍵檢核問題、同儕/自評或出口票，並說明老師如何根據回饋即時調整。',
  },
  {
    id: 'inquiry-based-learning',
    label: '探究式學習',
    shortLabel: '探究',
    focus: '由問題、證據、推論帶動學習',
    description: '探究式學習以問題帶動學生搜證、分析和建構結論。',
    classroomUse: '由一條驅動問題開始，安排學生觀察資料、提出假設、比較證據，再用理據回答問題。',
    prompt:
      '探究式學習：以驅動問題開始，安排學生搜集證據、提出假設、比較資料及作出結論，老師負責提供鷹架及追問。',
  },
  {
    id: 'collaborative-learning',
    label: '協作學習',
    shortLabel: '協作',
    focus: '透過角色分工、互教互評提升參與',
    description: '協作學習不是單純分組，而是讓每位學生有清晰角色、責任和互相依賴。',
    classroomUse: '可用 Think-Pair-Share、角色分工、小組匯報、同儕回饋，確保每位學生都有輸出。',
    prompt:
      '協作學習：加入清晰小組角色、互教互評或 Think-Pair-Share，確保每位學生有責任、有輸出、有回饋。',
  },
  {
    id: 'metacognition',
    label: '元認知策略',
    shortLabel: '元認知',
    focus: '引導學生計劃、監察、評估自己的學習',
    description: '元認知是讓學生思考自己如何學習、如何解題、如何修正策略。',
    classroomUse: '在任務前問「我會怎樣做」、任務中問「我卡在哪裡」、任務後問「下次如何改」。',
    prompt:
      '元認知策略：加入「我如何解題／我哪一步卡住／我下次如何改」等思考提示，讓學生在學習過程中計劃、監察及評估。',
  },
  {
    id: 'retrieval-practice',
    label: '提取練習 / 間隔學習',
    shortLabel: '提取練習',
    focus: '用低風險回想、間隔複習鞏固長期記憶',
    description: '提取練習是讓學生主動回想已學內容；間隔學習是隔一段時間再重溫。',
    classroomUse: '可加入低風險小測、三題回想、錯題重做、下堂開首重溫，幫學生把知識留得更久。',
    prompt:
      '提取練習及間隔學習：加入低風險小測、快速回想、錯題回顧或下堂重溫安排，幫助學生鞏固長期記憶。',
  },
]

export function pedagogyOptionsByIds(ids?: string[]): PedagogyOption[] {
  if (!ids?.length) return []
  const wanted = new Set(ids)
  return PEDAGOGY_OPTIONS.filter((o) => wanted.has(o.id))
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
  /** 老師選擇要融入教案的教學理論 / 設計元素 */
  pedagogyIds?: string[]
}

function clamp(s: string, max: number): string {
  const t = s.trim()
  return t.length <= max ? t : t.slice(0, max - 1) + '…'
}

// ───────── Prompt ─────────

export function buildLessonSystem(input: GenInput): string {
  const subjectLine = input.subjectName ? `任教科目：${input.subjectName}。` : ''
  const pedagogy = pedagogyOptionsByIds(input.pedagogyIds)
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
  if (pedagogy.length > 0) {
    lines.push(
      '- 教學設計元素：必須自然融入以下元素；不要只在文字上點名，要具體落在學習目標、教學環節、教材或課堂活動中：',
      ...pedagogy.map((o) => `  · ${o.label}：${o.prompt}`),
      '- 若多個元素同時選用，請整合成一條流暢課堂線，不要把教案變成理論清單。',
    )
  }
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
  const pedagogy = pedagogyOptionsByIds(input.pedagogyIds)
  if (input.className) parts.push(`班別：${input.className}`)
  if (input.durationMin) parts.push(`課堂時長：約 ${input.durationMin} 分鐘`)
  if (input.brief.trim()) parts.push(`今日教學內容／活動：${input.brief.trim()}`)
  if (input.skeleton) parts.push(`採用範本：${input.skeleton.name}`)
  if (pedagogy.length > 0) parts.push(`教學設計元素：${pedagogy.map((o) => o.label).join('、')}`)
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
