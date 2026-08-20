import { complete } from '../../../lib/aiClient'
import {
  AGENT_TOOLS,
  agentPlanId,
  type AgentPlan,
  type AgentStep,
  type AgentToolId,
} from './agent'

type RawStep = {
  kind?: unknown
  title?: unknown
  detail?: unknown
  featureId?: unknown
  text?: unknown
  due?: unknown
  eventTitle?: unknown
  date?: unknown
  time?: unknown
}

type RawPlan = {
  title?: unknown
  summary?: unknown
  steps?: unknown
}

const TOOL_LIST = Object.entries(AGENT_TOOLS)
  .map(([id, label]) => `${id}: ${label}`)
  .join('\n')

const PLANNER_SYSTEM = `你是 EziTeach 智能助手的任務規劃器。把教師要求拆成最多 5 個安全步驟。
只可以輸出 JSON，不要 Markdown、解釋或 code fence。

JSON 格式：
{"title":"短標題","summary":"一句摘要","steps":[...]}

可用步驟：
1. {"kind":"open_tool","featureId":"白名單 ID","title":"...","detail":"...","text":"帶入工具的要求"}
2. {"kind":"create_task","title":"新增待辦","detail":"...","text":"待辦內容","due":"YYYY-MM-DD，可省略"}
3. {"kind":"create_event","title":"加入行事曆","detail":"...","eventTitle":"活動名稱","date":"YYYY-MM-DD","time":"HH:mm，可省略"}

工具白名單：
${TOOL_LIST}

規則：
- 不可以刪除、傳送訊息、發布、付款或代表使用者作外部承諾。
- 沒有明確日期時，不可建立日程；改用 calendar 工具讓使用者補充。
- 教案、工作紙和簡報同時出現時，優先用 work-classroom-pack。
- 不可聲稱已完成內容生成，open_tool 只是準備並開啟工具。
- 保留使用者原本課題和要求。`

function text(value: unknown, fallback = '', max = 240): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback
}

function validDate(value: unknown): string | undefined {
  const result = text(value, '', 10)
  return /^20\d{2}-\d{2}-\d{2}$/.test(result) ? result : undefined
}

function validTime(value: unknown): string | undefined {
  const result = text(value, '', 5)
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(result) ? result : undefined
}

function parseJson(raw: string): RawPlan | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1)) as RawPlan
  } catch {
    return null
  }
}

function normalizeStep(raw: RawStep, index: number, request: string): AgentStep | null {
  const id = `step-${index + 1}`
  const kind = text(raw.kind, '', 24)
  if (kind === 'open_tool') {
    const featureId = text(raw.featureId, '', 64)
    if (!(featureId in AGENT_TOOLS)) return null
    const toolId = featureId as AgentToolId
    return {
      id,
      kind,
      featureId: toolId,
      toolLabel: AGENT_TOOLS[toolId],
      title: text(raw.title, `開啟${AGENT_TOOLS[toolId]}`, 60),
      detail: text(raw.detail, `帶入要求並前往${AGENT_TOOLS[toolId]}`, 140),
      handoffText: text(raw.text, request, 500),
    }
  }
  if (kind === 'create_task') {
    const taskText = text(raw.text, '', 220)
    if (!taskText) return null
    return {
      id,
      kind,
      title: text(raw.title, '新增待辦', 60),
      detail: text(raw.detail, taskText, 140),
      text: taskText,
      due: validDate(raw.due),
    }
  }
  if (kind === 'create_event') {
    const eventTitle = text(raw.eventTitle, '', 220)
    const date = validDate(raw.date)
    if (!eventTitle || !date) return null
    return {
      id,
      kind,
      title: text(raw.title, '加入行事曆', 60),
      detail: text(raw.detail, eventTitle, 140),
      eventTitle,
      date,
      time: validTime(raw.time),
    }
  }
  return null
}

export async function buildModelAgentPlan(
  request: string,
  contextSummary: string,
  signal?: AbortSignal,
): Promise<AgentPlan | null> {
  const raw = await complete({
    messages: [
      {
        role: 'user',
        content: `現在日期：${new Date().toLocaleDateString('en-CA')}\n平台概況：${contextSummary}\n要求：${request}`,
      },
    ],
    system: PLANNER_SYSTEM,
    model: 'gemini-2.5-flash',
    temperature: 0.1,
    signal,
    source: 'voice-agent-planner',
  })
  const parsed = parseJson(raw)
  if (!parsed || !Array.isArray(parsed.steps)) return null
  const steps = parsed.steps
    .slice(0, 5)
    .map((step, index) => normalizeStep(step as RawStep, index, request))
    .filter((step): step is AgentStep => Boolean(step))
  if (steps.length === 0) return null

  return {
    id: agentPlanId(),
    request,
    title: text(parsed.title, steps.length === 1 ? steps[0].title : `我會分 ${steps.length} 步完成`, 80),
    summary: text(parsed.summary, '我已整理好執行次序。', 180),
    steps,
    source: 'model',
    needsConfirmation: steps.length > 1 || steps.some((step) => step.kind !== 'open_tool'),
  }
}

