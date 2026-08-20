import { complete, type AIModel } from '../../../lib/aiClient'
import { extractJsonObject } from '../../../lib/aiJson'
import type { Deck } from '../../../lib/export/types'
import { parseLessonGen, type LessonGen } from '../lessonPlanner/lessonAi'
import { parseDrafts, type GenDraft, type GenKind } from '../materialGen/engine'
import { parseDeck } from '../slides/slidePrompts'

export interface ClassroomPackInput {
  topic: string
  subjectName?: string
  className?: string
  durationMin: number
  curriculumBasis: string
  referenceText?: string
}

export interface ClassroomPackGeneration {
  lesson: LessonGen
  questions: GenDraft[]
  deck: Deck
  curriculumAlignment: string[]
  sourceSummary: string
}

const QUESTION_KINDS = new Set<GenKind>(['mc', 'short', 'long', 'case'])

function cleanLines(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit)
}

export function buildClassroomPackSystem(input: ClassroomPackInput): string {
  const subject = input.subjectName?.trim() || '老師任教科目'
  const classLine = input.className?.trim() ? `對象：${input.className.trim()}。` : ''
  const sourceRule = input.referenceText?.trim()
    ? '課程對應只可根據老師提供的參考資料及已知通用概念，不要虛構頁碼、文件編號或官方字句。'
    : '老師沒有提供外部參考資料；課程對應只可作概括建議，禁止虛構課程文件名稱、編號、頁碼或引文。'

  return [
    `你是香港學校的課程設計助手。任教科目：${subject}。${classLine}`,
    `請圍繞同一組學習目標，建立一套約 ${input.durationMin} 分鐘、可以直接編輯的課堂成果：教案、工作紙及簡報大綱。`,
    `課程依據：${input.curriculumBasis}。${sourceRule}`,
    '三份成果必須互相一致：工作紙要評估教案目標，簡報要配合教案流程，不要各自生成無關內容。',
    '只輸出一個 JSON 物件，不要 markdown 或解釋文字：',
    '{',
    '  "lesson": {',
    '    "objectives": "2-4 項可評估學習目標，用 1. 2. 3. 分點",',
    '    "phases": [{"label":"環節名","minutes":10,"detail":"老師與學生的具體活動"}],',
    '    "materials": ["具體教材"],',
    '    "activities": "主要課堂活動摘要"',
    '  },',
    '  "worksheet": {',
    '    "questions": [',
    '      {"type":"mc","stem":"題幹","options":["A","B","C","D"],"answerIndex":0,"marks":1},',
    '      {"type":"short","stem":"短答題","answer":"參考答案及評分要點","marks":3}',
    '    ]',
    '  },',
    '  "presentation": {',
    '    "title":"簡報標題","subtitle":"科目／班別","coverImageQuery":"1-4 English words",',
    '    "slides":[{"title":"結論先行短標題","bullets":["3-5 個短要點"],"notes":"老師講解提示","takeaway":"一句重點（選填）"}]',
    '  },',
    '  "curriculum": {',
    '    "alignment":["這套成果如何對應課程依據，2-4 點"],',
    '    "sourceSummary":"清楚說明使用了老師資料，或沒有外部來源、只屬概括建議"',
    '  }',
    '}',
    '內容規則：',
    '- 全部使用繁體中文，貼合香港課堂，但不要假裝引用未提供的官方原文。',
    `- 教案 phases 4-6 個，分鐘總和約 ${input.durationMin} 分鐘。`,
    '- 工作紙共 6-8 題，至少 3 題 MC 及 3 題短答；每題附答案及分數。',
    '- 簡報 6-8 版，由導入、核心概念、例子／活動、練習到總結；每版只講一個焦點。',
    '- 所有 AI 建議都保留給老師覆核，不要在 JSON 內宣稱已獲官方認證。',
  ].join('\n')
}

export function buildClassroomPackUserMessage(input: ClassroomPackInput): string {
  const lines = [`課題：${input.topic.trim()}`]
  if (input.className?.trim()) lines.push(`班別／年級：${input.className.trim()}`)
  if (input.referenceText?.trim()) {
    lines.push(`老師提供的參考資料：\n${input.referenceText.trim()}`)
  }
  return lines.join('\n\n')
}

export function parseClassroomPack(
  raw: string,
  fallbackTitle: string,
): ClassroomPackGeneration {
  const root = extractJsonObject<Record<string, unknown>>(raw)
  if (!root || typeof root !== 'object') {
    throw new Error('生成結果格式不完整，請再試一次。')
  }

  const lesson = parseLessonGen(JSON.stringify(root.lesson ?? {}))

  const worksheet =
    root.worksheet && typeof root.worksheet === 'object'
      ? (root.worksheet as Record<string, unknown>)
      : {}
  const questionRows = Array.isArray(worksheet.questions) ? worksheet.questions : []
  const questions: GenDraft[] = []
  for (const row of questionRows) {
    if (!row || typeof row !== 'object') continue
    const rec = row as Record<string, unknown>
    const kind = typeof rec.type === 'string' ? (rec.type.toLowerCase() as GenKind) : 'short'
    if (!QUESTION_KINDS.has(kind)) continue
    const parsed = parseDrafts(kind, [rec])[0]
    if (parsed) questions.push(parsed)
    if (questions.length >= 10) break
  }
  if (questions.length < 6) {
    throw new Error('工作紙題目不足，請補充課題資料後再試。')
  }

  const deck = parseDeck(JSON.stringify(root.presentation ?? {}), fallbackTitle)
  if (deck.slides.length < 5) {
    throw new Error('簡報頁數不足，請補充課題資料後再試。')
  }
  const curriculum =
    root.curriculum && typeof root.curriculum === 'object'
      ? (root.curriculum as Record<string, unknown>)
      : {}
  const curriculumAlignment = cleanLines(curriculum.alignment, 6)
  const sourceSummary =
    typeof curriculum.sourceSummary === 'string' && curriculum.sourceSummary.trim()
      ? curriculum.sourceSummary.trim().slice(0, 500)
      : '沒有外部來源；課程對應屬 AI 概括建議，待老師確認。'

  return { lesson, questions, deck, curriculumAlignment, sourceSummary }
}

export async function generateClassroomPack(
  input: ClassroomPackInput,
  model: AIModel = 'gemini-2.5-flash',
): Promise<ClassroomPackGeneration> {
  const raw = await complete({
    system: buildClassroomPackSystem(input),
    messages: [{ role: 'user', content: buildClassroomPackUserMessage(input) }],
    model,
    temperature: 0.45,
    source: 'classroom-pack',
  })
  return parseClassroomPack(raw, input.topic)
}
