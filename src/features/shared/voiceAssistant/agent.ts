import type { Task, CalendarEvent } from '../../../data/types'
import type { ComposerMaterialTool } from '../composerHandoff'
import { inferWorkToolRoute } from '../../../pages/homeRouting'

export type AgentStepKind = 'open_tool' | 'create_task' | 'create_event'

type AgentStepBase = {
  id: string
  kind: AgentStepKind
  title: string
  detail: string
}

export type AgentOpenToolStep = AgentStepBase & {
  kind: 'open_tool'
  featureId: string
  toolLabel: string
  handoffText?: string
  materialTool?: ComposerMaterialTool
}

export type AgentCreateTaskStep = AgentStepBase & {
  kind: 'create_task'
  text: string
  due?: string
}

export type AgentCreateEventStep = AgentStepBase & {
  kind: 'create_event'
  eventTitle: string
  date: string
  time?: string
}

export type AgentStep = AgentOpenToolStep | AgentCreateTaskStep | AgentCreateEventStep

export type AgentPlan = {
  id: string
  request: string
  title: string
  summary: string
  steps: AgentStep[]
  source: 'local' | 'model'
  needsConfirmation: boolean
}

export type AssistantContext = {
  activeTasks: Array<Pick<Task, 'id' | 'text'> & { due?: string }>
  todayEvents: Array<Pick<CalendarEvent, 'id' | 'title' | 'time'>>
  overdueCount: number
  todayKey: string
}

export const AGENT_TOOLS = {
  'work-classroom-pack': '課堂套裝',
  'work-slides': '簡報工作室',
  'work-generate': '教材生成',
  'work-lesson-plan': '備課 / 教案',
  'work-rubric': '評分準則',
  'work-grade-analytics': '成績分析',
  'work-meeting-notes': '會議筆記',
  'work-doc-digest': '文件速讀',
  'work-admin-docs': '行政文件',
  'work-prompt-library': '教學助手',
  'work-transcribe': '錄音轉文字',
  'work-scan': '掃描 PDF',
  search: '全域搜尋',
  calendar: '行事曆',
  'work-tasks': '待辦 / 批改',
} as const

export type AgentToolId = keyof typeof AGENT_TOOLS

const WEEKDAY_INDEX: Record<string, number> = {
  日: 0,
  天: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
}

const CHINESE_DIGIT: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  兩: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
}

function parseSpokenNumber(value: string | undefined): number {
  if (!value) return 0
  if (/^\d+$/.test(value)) return Number(value)
  if (value === '十') return 10
  const [tens, ones] = value.split('十')
  if (value.includes('十')) {
    return (tens ? CHINESE_DIGIT[tens] ?? 0 : 1) * 10 + (ones ? CHINESE_DIGIT[ones] ?? 0 : 0)
  }
  return CHINESE_DIGIT[value] ?? Number.NaN
}

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 12)
}

function stepId(index: number): string {
  return `step-${index + 1}`
}

export function agentPlanId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function stripAssistantWakeWord(input: string): string {
  return input
    .trim()
    .replace(/^(hey\s+)?ezi\s*[,，:：]?\s*/i, '')
    .replace(/^智能助手\s*[,，:：]?\s*/i, '')
    .trim()
}

export function parseNaturalDateTime(
  input: string,
  now = new Date(),
): { date?: string; time?: string } {
  const text = input.trim()
  let date: Date | undefined

  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
  const monthDay = text.match(/(?:(20\d{2})年)?\s*(\d{1,2})月\s*(\d{1,2})[日號]?/)
  if (iso) {
    date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12)
  } else if (monthDay) {
    let year = monthDay[1] ? Number(monthDay[1]) : now.getFullYear()
    const month = Number(monthDay[2]) - 1
    const day = Number(monthDay[3])
    date = new Date(year, month, day, 12)
    if (!monthDay[1] && localDateKey(date) < localDateKey(now)) {
      year += 1
      date = new Date(year, month, day, 12)
    }
  } else if (/(後日|後天)/.test(text)) {
    date = addDays(now, 2)
  } else if (/(聽日|明天|明日)/.test(text)) {
    date = addDays(now, 1)
  } else if (/(今日|今天|本日)/.test(text)) {
    date = addDays(now, 0)
  } else {
    const weekday = text.match(/(下星期|下週|下個星期|本星期|今個星期|今週|星期|週)([日天一二三四五六])/)
    if (weekday) {
      const target = WEEKDAY_INDEX[weekday[2]]
      const prefix = weekday[1]
      let offset: number
      if (/^下/.test(prefix)) {
        offset = 7 - now.getDay() + target
      } else {
        offset = (target - now.getDay() + 7) % 7
        if (offset === 0 && !/^(本星期|今個星期|今週)$/.test(prefix)) offset = 7
      }
      date = addDays(now, offset)
    }
  }

  const numberPattern = '(\\d{1,2}|[零〇一二兩三四五六七八九十]{1,3})'
  const periodMatch = text.match(
    new RegExp(`(凌晨|早上|朝早|上午|中午|下午|傍晚|晚上)\\s*${numberPattern}(?:\\s*[點時:：]\\s*${numberPattern}?\\s*分?)?`),
  )
  const clockMatch = text.match(
    new RegExp(`${numberPattern}\\s*[點時:：]\\s*${numberPattern}?\\s*分?`),
  )
  let time: string | undefined
  if (periodMatch || clockMatch) {
    const period = periodMatch?.[1] ?? ''
    let hour = parseSpokenNumber(periodMatch?.[2] ?? clockMatch?.[1])
    const minute = parseSpokenNumber(periodMatch?.[3] ?? clockMatch?.[2])
    if (/(下午|傍晚|晚上)/.test(period) && hour < 12) hour += 12
    if (/(凌晨|早上|朝早|上午)/.test(period) && hour === 12) hour = 0
    if (period === '中午' && hour < 11) hour += 12
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    }
  }

  return { date: date ? localDateKey(date) : undefined, time }
}

function stripTemporalText(input: string): string {
  return input
    .replace(/\b20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, ' ')
    .replace(/(?:(?:20\d{2})年)?\s*\d{1,2}月\s*\d{1,2}[日號]?/g, ' ')
    .replace(/(今日|今天|本日|聽日|明天|明日|後日|後天)/g, ' ')
    .replace(/(下星期|下週|下個星期|本星期|今個星期|今週|星期|週)[日天一二三四五六]/g, ' ')
    .replace(/(凌晨|早上|朝早|上午|中午|下午|傍晚|晚上)?\s*(?:\d{1,2}|[零〇一二兩三四五六七八九十]{1,3})\s*[點時:：]\s*(?:\d{0,2}|[零〇一二兩三四五六七八九十]{0,3})\s*分?/g, ' ')
    .replace(/\s+前(?=\s|[\u3400-\u9fff])/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function extractTaskText(input: string, fallback: string): string {
  const match = input.match(/(?:提醒我|記得要|新增待辦|加入待辦|加待辦)\s*(.+)$/i)
  let text = stripTemporalText(match?.[1] ?? input)
    .replace(/^(我|要|喺|係)\s*/i, '')
    .replace(/^(前|之前)\s*/i, '')
    .replace(/[。；;]+$/g, '')
    .trim()
  if (/^(完成|搞掂|處理)$/.test(text)) text = ''
  return text || fallback
}

function extractEventTitle(input: string): string {
  return stripTemporalText(input)
    .replace(/^(幫我|請)?\s*(把|將)?\s*/i, '')
    .replace(/\s*(加入|加到|放入|記入|排入)\s*(我的)?\s*(行事曆|日曆|日程|calendar).*$/i, '')
    .replace(/^(行事曆|日曆|日程|calendar)\s*(新增|加入|加|安排)?\s*/i, '')
    .replace(/[。；;]+$/g, '')
    .trim()
}

function classroomPackRequested(text: string): boolean {
  if (/課堂套裝|classroom pack|lesson pack/i.test(text)) return true
  const lesson = /教案|備課|lesson plan/i.test(text)
  const worksheet = /工作紙|練習|worksheet/i.test(text)
  const slides = /簡報|投影片|ppt|powerpoint|slides?/i.test(text)
  return Number(lesson) + Number(worksheet) + Number(slides) >= 3
}

function materialToolFor(text: string): ComposerMaterialTool {
  if (/試卷|exam paper|paper/i.test(text)) return 'paper'
  if (/選擇題|多項選擇|\bmc\b|mcq/i.test(text)) return 'mc'
  if (/個案|case/i.test(text)) return 'case'
  if (/長題|essay|long question/i.test(text)) return 'long'
  if (/短答|short answer/i.test(text)) return 'short'
  return 'worksheet'
}

function addToolStep(
  steps: AgentStep[],
  featureId: AgentToolId,
  input: string,
  options: { materialTool?: ComposerMaterialTool; title?: string } = {},
) {
  if (steps.some((step) => step.kind === 'open_tool' && step.featureId === featureId)) return
  steps.push({
    id: stepId(steps.length),
    kind: 'open_tool',
    title: options.title ?? `準備${AGENT_TOOLS[featureId]}`,
    detail: `帶入你的要求，前往${AGENT_TOOLS[featureId]}繼續`,
    featureId,
    toolLabel: AGENT_TOOLS[featureId],
    handoffText: input,
    materialTool: options.materialTool,
  })
}

export function buildLocalAgentPlan(input: string, now = new Date()): AgentPlan | null {
  const request = stripAssistantWakeWord(input)
  if (!request) return null
  const steps: AgentStep[] = []
  const temporal = parseNaturalDateTime(request, now)
  const wantsTask = /提醒我|記得要|新增待辦|加入待辦|加待辦|todo|to-do/i.test(request)
  const wantsEvent = /行事曆|日曆|加入日程|排入日程|calendar/i.test(request)
  const wantsPack = classroomPackRequested(request)

  if (wantsPack) {
    addToolStep(steps, 'work-classroom-pack', request, { title: '建立完整課堂套裝' })
  } else {
    if (/(整|做|製作|生成|設計|準備|建立|create|make).{0,18}(ppt|powerpoint|簡報|投影片|slides?|deck)/i.test(request)) {
      addToolStep(steps, 'work-slides', request)
    }
    if (/(生成|設計|準備|製作|建立|出).{0,18}(工作紙|小測|試卷|練習題|題目|教材|worksheet|quiz|exam paper)/i.test(request)) {
      addToolStep(steps, 'work-generate', request, { materialTool: materialToolFor(request) })
    }
    if (/(備課|教案|lesson plan|教學計劃)/i.test(request)) {
      addToolStep(steps, 'work-lesson-plan', request)
    }
  }

  if (wantsTask) {
    const fallback = wantsPack ? '完成課堂套裝' : '完成這項工作'
    const taskText = extractTaskText(request, fallback)
    steps.push({
      id: stepId(steps.length),
      kind: 'create_task',
      title: '新增跟進待辦',
      detail: temporal.date ? `${taskText} · ${temporal.date} 前` : taskText,
      text: taskText,
      due: temporal.date,
    })
  }

  if (wantsEvent) {
    const eventTitle = extractEventTitle(request) || '新活動'
    if (temporal.date) {
      steps.push({
        id: stepId(steps.length),
        kind: 'create_event',
        title: '加入行事曆',
        detail: `${temporal.date}${temporal.time ? ` ${temporal.time}` : ''} · ${eventTitle}`,
        eventTitle,
        date: temporal.date,
        time: temporal.time,
      })
    } else {
      addToolStep(steps, 'calendar', eventTitle, { title: '補充活動日期' })
    }
  }

  if (steps.length === 0) {
    const route = inferWorkToolRoute(request)
    if (route && route.featureId !== 'work-voice-assistant' && route.featureId in AGENT_TOOLS) {
      addToolStep(steps, route.featureId as AgentToolId, route.handoffText ?? request, {
        materialTool: route.materialTool,
        title: `開啟${route.label}`,
      })
    }
  }

  if (steps.length === 0) return null
  const mutations = steps.filter((step) => step.kind !== 'open_tool').length
  const needsConfirmation = mutations > 0 || steps.length > 1
  const title = steps.length === 1 ? steps[0].title : `我會分 ${steps.length} 步完成`
  const summary =
    mutations > 0
      ? '我會先建立所需項目，再把其餘工作準備好。'
      : '我已整理好執行次序，確認後便逐步開始。'

  return {
    id: agentPlanId(),
    request,
    title,
    summary,
    steps,
    source: 'local',
    needsConfirmation,
  }
}

export function isBriefingRequest(input: string): boolean {
  return /(今日|今天|今朝).{0,10}(有咩|有什麼|安排|行程|要做|待辦)|我的?(今日)?(安排|行程|待辦)|daily briefing|今日簡報/i.test(
    stripAssistantWakeWord(input),
  )
}

export function buildDailyBriefing(context: AssistantContext): string {
  const taskCount = context.activeTasks.length
  const eventCount = context.todayEvents.length
  const lines = [`今日有 ${taskCount} 項未完成待辦，${eventCount} 個日程。`]

  if (context.overdueCount > 0) lines.push(`其中 ${context.overdueCount} 項已逾期，建議先處理。`)
  if (context.todayEvents.length > 0) {
    lines.push('今日日程：')
    context.todayEvents.slice(0, 4).forEach((event, index) => {
      lines.push(`${index + 1}. ${event.time ? `${event.time} ` : ''}${event.title}`)
    })
  }
  if (context.activeTasks.length > 0) {
    lines.push('優先待辦：')
    context.activeTasks.slice(0, 4).forEach((task, index) => {
      lines.push(`${index + 1}. ${task.text}${task.due ? `（${task.due} 前）` : ''}`)
    })
  }
  if (taskCount === 0 && eventCount === 0) lines.push('目前沒有已記錄的工作，可以先說出今天最想完成的一件事。')
  return lines.join('\n')
}

export function shouldUseModelPlanner(input: string): boolean {
  const text = stripAssistantWakeWord(input)
  return /^(幫我|請|我要|我想|安排|建立|準備|製作|新增|整理|處理)/.test(text) &&
    !/[?？]$/.test(text)
}
