import { complete } from '../../../lib/aiClient'
import {
  AGENT_TOOLS,
  agentPlanId,
  type AssistantContext,
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
  taskIds?: unknown
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
4. {"kind":"complete_tasks","title":"完成待辦","detail":"...","taskIds":["只可使用平台概況內的 ID"]}
5. {"kind":"reopen_tasks","title":"重開待辦","detail":"...","taskIds":["只可使用平台概況內的 ID"]}
6. {"kind":"delete_tasks","title":"刪除待辦","detail":"...","taskIds":["只可使用平台概況內的 ID"]}

工具白名單：
${TOOL_LIST}

規則：
- 只可在使用者明確要求刪除待辦時使用 delete_tasks；不可刪除其他資料、傳送訊息、發布、付款或代表使用者作外部承諾。
- taskIds 只可逐字選用平台概況提供的 ID。完成只選未完成待辦；重開只選已完成待辦。
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

function taskIds(value: unknown, allowedIds: Set<string>): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value)]
    .filter((id): id is string => typeof id === 'string' && allowedIds.has(id))
    .slice(0, 50)
}

function normalizeStep(
  raw: RawStep,
  index: number,
  request: string,
  context: AssistantContext,
): AgentStep | null {
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
  if (kind === 'complete_tasks' || kind === 'reopen_tasks' || kind === 'delete_tasks') {
    if (kind === 'delete_tasks' && !/(刪除|刪走|移除|清除|清空|delete)/i.test(request)) return null
    const candidates =
      kind === 'complete_tasks'
        ? context.activeTasks
        : kind === 'reopen_tasks'
          ? context.completedTasks
          : [...context.activeTasks, ...context.completedTasks]
    const ids = taskIds(raw.taskIds, new Set(candidates.map((task) => task.id)))
    if (ids.length === 0) return null
    const defaultTitle =
      kind === 'complete_tasks'
        ? `完成 ${ids.length} 項待辦`
        : kind === 'reopen_tasks'
          ? `重開 ${ids.length} 項待辦`
          : `刪除 ${ids.length} 項待辦`
    return {
      id,
      kind,
      taskIds: ids,
      title: text(raw.title, defaultTitle, 60),
      detail: text(raw.detail, `${ids.length} 項待辦`, 140),
    }
  }
  return null
}

function removeConflictingTaskTargets(steps: AgentStep[]): AgentStep[] {
  const claimedTaskIds = new Set<string>()
  return steps
    .map((step) => {
      if (!('taskIds' in step)) return step
      const ids = step.taskIds.filter((id) => !claimedTaskIds.has(id))
      ids.forEach((id) => claimedTaskIds.add(id))
      return { ...step, taskIds: ids }
    })
    .filter((step) => !('taskIds' in step) || step.taskIds.length > 0)
}

export async function buildModelAgentPlan(
  request: string,
  context: AssistantContext,
  signal?: AbortSignal,
): Promise<AgentPlan | null> {
  const contextSummary = JSON.stringify({
    today: context.todayKey,
    unfinishedTasks: context.activeTasks.slice(0, 50),
    completedTasks: context.completedTasks.slice(0, 50),
    todayEvents: context.todayEvents.slice(0, 30),
  })
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
  const steps = removeConflictingTaskTargets(
    parsed.steps
      .slice(0, 5)
      .map((step, index) => normalizeStep(step as RawStep, index, request, context))
      .filter((step): step is AgentStep => Boolean(step)),
  )
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
