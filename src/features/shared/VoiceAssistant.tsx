import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import {
  ArrowRight,
  AudioLines,
  CalendarDays,
  Check,
  Copy,
  FileAudio,
  ListChecks,
  ListTodo,
  MessageCircle,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useNav } from '../../context/NavContext'
import { useToast } from '../../context/ToastContext'
import { isAIConfigured, streamChat, type AIMessage } from '../../lib/aiClient'
import { useCollection } from '../../lib/store'
import { track, trackOnce } from '../../lib/observability'
import { eventsCol, tasksCol } from '../../data/collections'
import ServiceStatus from '../../components/ServiceStatus'
import { Button, IconButton, Textarea, Tooltip, cx } from '../../ui'
import { writeComposerHandoff } from './composerHandoff'
import { taskMetaCol } from '../work/todo/store'
import AgentPlanPanel, {
  type AgentStepState,
} from './voiceAssistant/AgentPlanPanel'
import {
  buildDailyBriefing,
  buildLocalAgentPlan,
  isBriefingRequest,
  isPlanCancellation,
  isPlanConfirmation,
  shouldUseModelPlanner,
  type AgentOpenToolStep,
  type AgentPlan,
  type AssistantContext,
} from './voiceAssistant/agent'
import { buildModelAgentPlan } from './voiceAssistant/modelPlanner'
import {
  createMutationReceipt,
  executePlatformStep,
  receiptMutationCount,
  receiptSummary,
  undoPlatformMutations,
  type PlatformMutationReceipt,
} from './voiceAssistant/platformExecutor'
import {
  VOICE_LANGUAGES,
  createSpeechQueue,
  speakText,
  stopSpeaking,
  type VoiceLanguage,
} from './voiceAssistant/speech'
import {
  LiveVoiceError,
  type LiveToolCall,
  type LiveTranscriptUpdate,
} from './voiceAssistant/liveVoice'
import { useLiveVoice } from './voiceAssistant/useLiveVoice'
import { useSpeechRecognition } from './voiceAssistant/useSpeechRecognition'

type VoiceTurn = {
  id: string
  role: 'user' | 'model'
  content: string
}

const LANGUAGE_KEY = 'eziteach.voice.language.v1'
const SPEAK_REPLY_KEY = 'eziteach.voice.speakReplies.v1'
const SESSION_KEY = 'eziteach.voice.session.v2'

const EXAMPLES = [
  'Ezi，今日有咩要處理？',
  '將所有未完成待辦標記為完成',
  '準備中二百分比教案、工作紙和簡報，再提醒我星期五前完成',
] as const

const SYSTEM_PROMPT = `你是 Ezi，EziTeach 的智能教學工作助手，服務香港老師。
你的工作不只回答問題，亦要協助使用者釐清目標、判斷下一步和避免遺漏。
請使用清楚自然的繁體中文回答；如果使用者以英文提問，可以用英文回答。
回覆需要適合朗讀：先直接回答，再列出最多五個具體重點。不要使用表格，不要加入冗長開場。
涉及香港課程、評核或政策時，清楚區分一般建議與已核實資料；不確定時提醒老師查核官方來源。
平台操作只能透過畫面上的執行計劃完成。不要把使用者的「係／確認」當成操作結果，也不要聲稱已替使用者完成未實際執行的操作。涉及寫入、刪除、傳送或發布時，必須先取得確認；若沒有實際操作回條，只可說明你能如何協助。`

function readLanguage(): VoiceLanguage {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY)
    if (value === 'zh-HK' || value === 'zh-CN' || value === 'en-HK') return value
  } catch {
    /* ignore */
  }
  return 'zh-HK'
}

function readSpeakReplies(): boolean {
  try {
    return localStorage.getItem(SPEAK_REPLY_KEY) !== '0'
  } catch {
    return true
  }
}

function turnId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function upsertTurn(current: VoiceTurn[], next: VoiceTurn): VoiceTurn[] {
  const index = current.findIndex((turn) => turn.id === next.id)
  if (index < 0) return [...current, next]
  const updated = [...current]
  updated[index] = next
  return updated
}

function readSessionTurns(): VoiceTurn[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((turn): turn is VoiceTurn => {
        if (!turn || typeof turn !== 'object') return false
        const value = turn as Partial<VoiceTurn>
        return (
          typeof value.id === 'string' &&
          (value.role === 'user' || value.role === 'model') &&
          typeof value.content === 'string'
        )
      })
      .slice(-20)
      .map((turn) => ({ ...turn, content: turn.content.slice(0, 12_000) }))
  } catch {
    return []
  }
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return '早晨，今天先處理什麼？'
  if (hour < 18) return '午安，接下來要完成什麼？'
  return '晚上好，還有什麼要處理？'
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export default function VoiceAssistant() {
  const nav = useNav()
  const toast = useToast()
  const tasks = useCollection(tasksCol)
  const taskMetas = useCollection(taskMetaCol)
  const events = useCollection(eventsCol)
  const [language, setLanguage] = useState<VoiceLanguage>(readLanguage)
  const [speakReplies, setSpeakReplies] = useState(readSpeakReplies)
  const [draft, setDraft] = useState('')
  const [interimText, setInterimText] = useState('')
  const [turns, setTurns] = useState<VoiceTurn[]>(readSessionTurns)
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [activePlan, setActivePlan] = useState<AgentPlan | null>(null)
  const [stepStates, setStepStates] = useState<Record<string, AgentStepState>>({})
  const [planCompleted, setPlanCompleted] = useState(false)
  const [planResult, setPlanResult] = useState('')
  const [receipt, setReceipt] = useState<PlatformMutationReceipt | null>(null)
  const transcriptBaseRef = useRef('')
  const speechWasUsedRef = useRef(false)
  const conversationLoopRef = useRef(false)
  const promptHandlerRef = useRef<(prompt: string) => void>(() => {})
  const startListeningRef = useRef<() => void>(() => {})
  const activePlanRef = useRef<AgentPlan | null>(null)
  const executingRef = useRef(false)
  const executePlanRef = useRef<(plan?: AgentPlan) => Promise<unknown>>(async () => ({
    status: 'unavailable',
  }))
  const cancelPlanRef = useRef<() => void>(() => {})
  const abortRef = useRef<AbortController | null>(null)
  const conversationRef = useRef<HTMLDivElement>(null)

  const assistantContext = useMemo<AssistantContext>(() => {
    const todayKey = localDateKey()
    const metaById = new Map(taskMetas.map((meta) => [meta.id, meta]))
    const activeTasks = tasks
      .filter((task) => !task.done)
      .map((task) => ({
        id: task.id,
        text: task.text,
        due: metaById.get(task.id)?.due,
        createdAt: task.createdAt,
      }))
      .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.createdAt.localeCompare(b.createdAt))
      .map(({ id, text, due }) => ({ id, text, due }))
    const completedTasks = tasks
      .filter((task) => task.done)
      .map((task) => ({
        id: task.id,
        text: task.text,
        due: metaById.get(task.id)?.due,
        completedAt: metaById.get(task.id)?.completedAt ?? task.createdAt,
      }))
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .map(({ id, text, due }) => ({ id, text, due }))
    const todayEvents = events
      .filter((event) => event.date === todayKey)
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
      .map(({ id, title, time }) => ({ id, title, time }))
    return {
      activeTasks,
      completedTasks,
      todayEvents,
      todayKey,
      overdueCount: activeTasks.filter((task) => task.due && task.due < todayKey).length,
    }
  }, [events, taskMetas, tasks])

  const liveContext = useMemo(() => {
    const taskLines = assistantContext.activeTasks
      .slice(0, 8)
      .map((task) => `- 待辦：${task.text}${task.due ? `（限期 ${task.due}）` : ''}`)
    const eventLines = assistantContext.todayEvents
      .slice(0, 8)
      .map((event) => `- 今日日程：${event.time ? `${event.time} ` : ''}${event.title}`)
    const completedTaskLines = assistantContext.completedTasks
      .slice(0, 5)
      .map((task) => `- 最近完成：${task.text}`)
    return [
      `今日日期：${assistantContext.todayKey}`,
      `目前有 ${assistantContext.overdueCount} 項逾期工作。`,
      ...taskLines,
      ...eventLines,
      ...completedTaskLines,
    ].join('\n')
  }, [assistantContext])

  const handleLiveTranscript = useCallback((update: LiveTranscriptUpdate) => {
    setTurns((current) =>
      upsertTurn(current, {
        id: update.id,
        role: update.role,
        content: update.text,
      }),
    )
    if (update.role === 'model') {
      setStatusMessage(update.final ? '回覆完成' : '正在回覆…')
    }
  }, [])

  const handleLiveToolCall = useCallback(
    async (call: LiveToolCall) => {
      if (call.name === 'confirm_platform_action') {
        if (!activePlanRef.current) {
          return { status: 'no_pending_action', message: '目前沒有等待確認的操作。' }
        }
        return executePlanRef.current(activePlanRef.current)
      }
      if (call.name === 'cancel_platform_action') {
        if (!activePlanRef.current) {
          return { status: 'no_pending_action', message: '目前沒有等待確認的操作。' }
        }
        cancelPlanRef.current()
        return { status: 'cancelled', message: '已取消，沒有改動平台資料。' }
      }
      if (call.name !== 'prepare_platform_task') {
        return { status: 'unsupported', message: '這項操作暫時未開放。' }
      }
      const request = typeof call.args.request === 'string' ? call.args.request.trim() : ''
      const plan = buildLocalAgentPlan(request, new Date(), assistantContext)
      if (!request || !plan) {
        return { status: 'unsupported', message: '未能配對到可安全執行的平台操作。' }
      }

      const directStep = plan.steps.length === 1 ? plan.steps[0] : null
      if (!plan.needsConfirmation && directStep?.kind === 'open_tool') {
        writeComposerHandoff({
          featureId: directStep.featureId,
          text: directStep.handoffText ?? request,
          materialTool: directStep.materialTool,
        })
        track('voice_tool_opened', {
          destination: directStep.featureId,
          input_mode: 'live-speech',
          source: 'live-agent',
        })
        trackOnce('activation_task_started', {
          source: 'voice-assistant',
          destination: directStep.featureId,
        })
        toast.success(`已打開「${directStep.toolLabel}」並帶入內容`)
        nav.open(directStep.featureId)
        return { status: 'opened', tool: directStep.toolLabel }
      }

      conversationLoopRef.current = false
      activePlanRef.current = plan
      setActivePlan(plan)
      setStepStates(Object.fromEntries(plan.steps.map((step) => [step.id, 'pending'])))
      setPlanCompleted(false)
      setPlanResult('')
      setReceipt(null)
      setStatusMessage('已整理執行計劃，請確認。')
      track('voice_agent_plan_created', {
        source: 'live-model',
        step_count: plan.steps.length,
        needs_confirmation: plan.needsConfirmation,
      })
      return {
        status: 'awaiting_confirmation',
        message: '執行計劃已顯示在畫面，等候使用者確認。',
        title: plan.title,
        summary: plan.summary,
        steps: plan.steps.map((step) => ({ title: step.title, detail: step.detail })),
      }
    },
    [assistantContext, nav, toast],
  )

  const handleLiveError = useCallback((message: string, code?: string) => {
    setStatusMessage(message)
    track('voice_live_session_failed', {
      error_kind: 'live_connection',
      error_code: code ?? 'unknown',
    })
  }, [])

  const liveVoice = useLiveVoice({
    onTranscript: handleLiveTranscript,
    onToolCall: handleLiveToolCall,
    onError: handleLiveError,
  })

  const handleTranscript = useCallback(
    ({ combinedText, interimText: interim }: { combinedText: string; interimText: string }) => {
      speechWasUsedRef.current = true
      setInterimText(interim)
      setDraft([transcriptBaseRef.current, combinedText].filter(Boolean).join(' ').trim())
      setStatusMessage(interim ? '正在聆聽…' : '已轉成文字，可先修改再送出。')
    },
    [],
  )

  const handleRecognitionError = useCallback((message: string) => {
    setStatusMessage(message)
    if (message) track('voice_recognition_failed', { error_kind: 'browser_recognition' })
  }, [])

  const handleUtteranceEnd = useCallback((finalText: string) => {
    const prompt = [transcriptBaseRef.current, finalText].filter(Boolean).join(' ').trim()
    if (!prompt || !conversationLoopRef.current) return
    speechWasUsedRef.current = true
    setDraft(prompt)
    setInterimText('')
    setStatusMessage('已收到，正在回應…')
    window.setTimeout(() => promptHandlerRef.current(prompt), 0)
  }, [])

  const recognition = useSpeechRecognition({
    language,
    onTranscript: handleTranscript,
    onUtteranceEnd: handleUtteranceEnd,
    onError: handleRecognitionError,
  })

  const previewPlan = useMemo(
    () => buildLocalAgentPlan(draft, new Date(), assistantContext),
    [assistantContext, draft],
  )
  const briefingPreview = useMemo(() => isBriefingRequest(draft), [draft])
  const working = busy || planning || executing

  const liveStateLabel =
    liveVoice.status === 'connecting'
      ? '正在連接'
      : liveVoice.status === 'thinking'
        ? '正在理解'
        : liveVoice.status === 'speaking'
          ? '正在回覆'
          : liveVoice.inputMuted
            ? '咪高峰已靜音'
            : '正在聆聽'

  const assistantState = liveVoice.active
    ? liveStateLabel
    : recognition.listening
      ? '正在聆聽'
      : planning
        ? '正在理解'
        : executing
          ? '正在執行'
          : activePlan && !planCompleted
            ? '等待確認'
            : busy
              ? '正在回覆'
              : speaking
                ? '正在朗讀'
                : '待命'

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_KEY, language)
    } catch {
      /* ignore */
    }
  }, [language])

  useEffect(() => {
    try {
      localStorage.setItem(SPEAK_REPLY_KEY, speakReplies ? '1' : '0')
    } catch {
      /* ignore */
    }
    if (!speakReplies) {
      stopSpeaking()
      setSpeaking(false)
    }
    liveVoice.setOutputMuted(!speakReplies)
  }, [liveVoice.setOutputMuted, speakReplies])

  useEffect(() => {
    try {
      if (turns.length > 0) localStorage.setItem(SESSION_KEY, JSON.stringify(turns.slice(-20)))
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
  }, [turns])

  useEffect(() => {
    const area = conversationRef.current
    if (area && (turns.length > 0 || streaming || activePlan)) area.scrollTop = area.scrollHeight
  }, [activePlan, planResult, streaming, turns])

  useEffect(
    () => () => {
      abortRef.current?.abort()
      stopSpeaking()
    },
    [],
  )

  const startListening = (message = '') => {
    conversationLoopRef.current = true
    stopSpeaking()
    setSpeaking(false)
    setStatusMessage(message)
    setInterimText('')
    transcriptBaseRef.current = draft.trim()
    if (recognition.start()) {
      track('voice_listening_started', { language })
      trackOnce('activation_voice_assistant_started', { language })
    }
  }
  startListeningRef.current = () => startListening()

  const startVoiceConversation = async () => {
    stopSpeaking()
    setSpeaking(false)
    setStatusMessage('')
    setInterimText('')
    recognition.abort()

    if (liveVoice.supported) {
      conversationLoopRef.current = false
      try {
        await liveVoice.start(language, liveContext)
        setStatusMessage('即時對話已連線，直接說話即可。')
        track('voice_live_session_started', { language })
        trackOnce('activation_voice_assistant_started', { language, mode: 'live' })
        return
      } catch (error) {
        if (error instanceof LiveVoiceError && error.code === 'cancelled') return
        track('voice_live_session_fallback', {
          error_kind: error instanceof Error ? error.name : 'Error',
          error_code: error instanceof LiveVoiceError ? error.code : 'unknown',
        })
      }
    }

    startListening('即時對話暫時未能連線，已改用逐句語音；講完會自動送出。')
  }

  const toggleListening = () => {
    if (liveVoice.active) {
      liveVoice.stop()
      setStatusMessage('自然對話已結束')
      track('voice_live_session_stopped', { language })
      return
    }
    if (recognition.listening) {
      conversationLoopRef.current = false
      recognition.stop()
      setStatusMessage('已停止聆聽')
      track('voice_listening_stopped', { language, has_transcript: Boolean(draft.trim()) })
    } else {
      void startVoiceConversation()
    }
  }

  const resumeStandardConversation = () => {
    if (!conversationLoopRef.current) return
    window.setTimeout(() => {
      if (conversationLoopRef.current) startListeningRef.current()
    }, 260)
  }

  const readResponse = (text: string, resumeAfter = false) => {
    const started = speakText(text, language, {
      onStart: () => setSpeaking(true),
      onEnd: () => {
        setSpeaking(false)
        if (resumeAfter) resumeStandardConversation()
      },
    })
    if (started) track('voice_response_spoken', { language })
    else if (resumeAfter) resumeStandardConversation()
    else toast.info('此瀏覽器暫時未能朗讀回覆。')
  }

  const relevantContextFor = (prompt: string): string => {
    if (!/(今日|今天|我|待辦|日程|安排|行程|工作)/.test(prompt)) return ''
    const taskLines = assistantContext.activeTasks.slice(0, 6).map((task) => `- 待辦：${task.text}${task.due ? `（${task.due} 前）` : ''}`)
    const eventLines = assistantContext.todayEvents.slice(0, 6).map((event) => `- 日程：${event.time ? `${event.time} ` : ''}${event.title}`)
    return [...taskLines, ...eventLines].join('\n')
  }

  const askAssistant = async (prompt: string, existingConversation?: VoiceTurn[]) => {
    if (!isAIConfigured) {
      setStatusMessage('一般問答服務暫時未連接；任務規劃和平台操作仍可使用。')
      return
    }

    const userTurn: VoiceTurn = { id: turnId(), role: 'user', content: prompt }
    const conversation = existingConversation ?? [...turns, userTurn]
    if (!existingConversation) setTurns(conversation)
    setDraft('')
    setInterimText('')
    setBusy(true)
    setStreaming('')
    setStatusMessage('正在整理回覆…')
    const controller = new AbortController()
    abortRef.current = controller
    const startedAt = Date.now()
    let full = ''
    let aborted = false
    const localContext = relevantContextFor(prompt)
    const spokenInput = speechWasUsedRef.current
    const resumeAfterReply = spokenInput && conversationLoopRef.current
    const speechQueue = speakReplies
      ? createSpeechQueue(language, {
          onStart: () => setSpeaking(true),
          onEnd: () => {
            setSpeaking(false)
            if (resumeAfterReply) resumeStandardConversation()
          },
        })
      : null

    track('voice_assistant_request_started', {
      language,
      input_mode: speechWasUsedRef.current ? 'speech' : 'text',
      prior_turns: Math.max(0, conversation.length - 1),
      uses_local_context: Boolean(localContext),
    })

    try {
      const messages: AIMessage[] = conversation.slice(-10).map((turn) => ({
        role: turn.role,
        content: turn.content,
      }))
      for await (const chunk of streamChat({
        messages,
        system: localContext ? `${SYSTEM_PROMPT}\n\n以下是使用者平台內的相關資料，只可用於今次回答：\n${localContext}` : SYSTEM_PROMPT,
        model: 'gemini-2.5-flash',
        temperature: 0.35,
        signal: controller.signal,
        source: 'voice-assistant',
      })) {
        full += chunk
        setStreaming(full)
        speechQueue?.push(chunk)
      }
    } catch (error) {
      const err = error as Error
      if (err.name === 'AbortError') {
        aborted = true
        track('voice_assistant_request_stopped')
      } else {
        setStatusMessage(err.message || '智能助手暫時未能回答，請稍後再試。')
        track('voice_assistant_response_failed', { error_kind: err.name || 'Error' })
      }
    } finally {
      if (!aborted && full.trim()) {
        const modelTurn: VoiceTurn = { id: turnId(), role: 'model', content: full.trim() }
        setTurns((current) => [...current, modelTurn])
        setStatusMessage('回覆完成')
        track('voice_assistant_response_completed', {
          language,
          latency_ms: Date.now() - startedAt,
          response_chars: full.length,
        })
        trackOnce('activation_voice_response_completed', { language })
        speechQueue?.finish()
        if (!speechQueue && resumeAfterReply) resumeStandardConversation()
      } else {
        speechQueue?.cancel()
      }
      speechWasUsedRef.current = false
      setBusy(false)
      setStreaming('')
      abortRef.current = null
    }
  }

  const showPlan = (plan: AgentPlan, conversation: VoiceTurn[]) => {
    conversationLoopRef.current = false
    setTurns(conversation)
    activePlanRef.current = plan
    setActivePlan(plan)
    setStepStates(Object.fromEntries(plan.steps.map((step) => [step.id, 'pending'])))
    setPlanCompleted(false)
    setPlanResult('')
    setReceipt(null)
    setDraft('')
    setInterimText('')
    setStatusMessage('已整理執行計劃，請確認。')
    track('voice_agent_plan_created', {
      source: plan.source,
      step_count: plan.steps.length,
      needs_confirmation: plan.needsConfirmation,
    })
  }

  const openTool = (step: AgentOpenToolStep) => {
    writeComposerHandoff({
      featureId: step.featureId,
      text: step.handoffText ?? activePlan?.request ?? '',
      materialTool: step.materialTool,
    })
    setStepStates((current) => ({ ...current, [step.id]: 'done' }))
    track('voice_tool_opened', {
      destination: step.featureId,
      input_mode: speechWasUsedRef.current ? 'speech' : 'text',
      source: 'agent-plan',
    })
    trackOnce('activation_task_started', {
      source: 'voice-assistant',
      destination: step.featureId,
    })
    nav.open(step.featureId)
  }

  const executeDirectPlan = (plan: AgentPlan) => {
    const step = plan.steps[0]
    if (!step || step.kind !== 'open_tool') return
    track('voice_agent_plan_created', {
      source: plan.source,
      step_count: 1,
      needs_confirmation: false,
    })
    toast.success(`已打開「${step.toolLabel}」並帶入內容`)
    setDraft('')
    speechWasUsedRef.current = false
    openTool(step)
  }

  const executePlan = async (planOverride?: AgentPlan) => {
    const plan = planOverride ?? activePlanRef.current
    if (!plan) return { status: 'no_pending_action', message: '目前沒有等待確認的操作。' }
    if (executingRef.current) return { status: 'busy', message: '操作仍在執行。' }
    activePlanRef.current = null
    executingRef.current = true
    setExecuting(true)
    setStatusMessage('正在逐步執行…')
    track('voice_agent_plan_confirmed', {
      source: plan.source,
      step_count: plan.steps.length,
    })
    const nextReceipt = createMutationReceipt()
    const summaries: string[] = []
    let failed = false

    for (const step of plan.steps) {
      setStepStates((current) => ({ ...current, [step.id]: 'running' }))
      await pause(120)
      try {
        if (step.kind === 'open_tool') {
          setStepStates((current) => ({ ...current, [step.id]: 'ready' }))
        } else {
          const stepResult = executePlatformStep(step, nextReceipt)
          summaries.push(stepResult.summary)
          setStepStates((current) => ({ ...current, [step.id]: 'done' }))
        }
        track('voice_agent_step_completed', { step_kind: step.kind })
      } catch (error) {
        failed = true
        setStepStates((current) => ({ ...current, [step.id]: 'failed' }))
        track('voice_agent_step_failed', {
          step_kind: step.kind,
          error_kind: (error as Error).name || 'Error',
        })
        break
      }
    }

    const mutationCount = receiptMutationCount(nextReceipt)
    const readyTools = plan.steps.filter((step) => step.kind === 'open_tool').length
    const result = failed
      ? '執行期間遇到問題，未完成的步驟已停止。'
      : [
          ...[...new Set(summaries)],
          readyTools ? `${readyTools} 個工作區已準備好，可以繼續開啟。` : '',
        ]
          .filter(Boolean)
          .join(' ')
    setReceipt(mutationCount ? nextReceipt : null)
    setPlanResult(result || '計劃已完成。')
    setPlanCompleted(true)
    executingRef.current = false
    setExecuting(false)
    setStatusMessage(failed ? '部分步驟未完成' : '執行完成')
    track('voice_agent_plan_completed', {
      success: !failed,
      mutation_count: mutationCount,
      ready_tools: readyTools,
    })
    if (!failed && speakReplies) readResponse(result || '計劃已完成。')
    return {
      status: failed ? 'partial_failure' : 'completed',
      message: result || '計劃已完成。',
      affected: mutationCount,
    }
  }
  executePlanRef.current = executePlan

  const undoPlan = () => {
    if (!activePlan || !receipt) return
    undoPlatformMutations(receipt)
    const mutationIds = new Set(
      activePlan.steps
        .filter((step) => step.kind !== 'open_tool')
        .map((step) => step.id),
    )
    setStepStates((current) =>
      Object.fromEntries(
        Object.entries(current).map(([id, state]) => [id, mutationIds.has(id) ? 'undone' : state]),
      ),
    )
    const undoMessage = receiptSummary(receipt)
    setReceipt(null)
    setPlanResult(undoMessage)
    setStatusMessage('已撤回剛才操作')
    track('voice_agent_plan_undone', {
      mutation_count: receiptMutationCount(receipt),
    })
  }

  const cancelPlan = () => {
    const plan = activePlanRef.current
    if (!plan) return
    track('voice_agent_plan_cancelled', { step_count: plan.steps.length })
    activePlanRef.current = null
    setActivePlan(null)
    setStepStates({})
    setPlanResult('')
    setStatusMessage('已取消，沒有寫入任何資料。')
  }
  cancelPlanRef.current = cancelPlan

  const handlePrompt = async (prompt: string) => {
    if (!prompt || working) return
    const pendingPlan = activePlanRef.current
    if (pendingPlan && !planCompleted && isPlanConfirmation(prompt)) {
      if (liveVoice.active) liveVoice.stop()
      if (recognition.listening) recognition.stop()
      stopSpeaking()
      setSpeaking(false)
      setTurns((current) => [
        ...current,
        { id: turnId(), role: 'user' as const, content: prompt },
      ])
      setDraft('')
      setInterimText('')
      speechWasUsedRef.current = false
      await executePlan(pendingPlan)
      return
    }
    if (pendingPlan && !planCompleted && isPlanCancellation(prompt)) {
      if (liveVoice.active) liveVoice.stop()
      if (recognition.listening) recognition.stop()
      setTurns((current) => [
        ...current,
        { id: turnId(), role: 'user' as const, content: prompt },
      ])
      setDraft('')
      setInterimText('')
      cancelPlan()
      return
    }
    if (liveVoice.active) liveVoice.stop()
    if (recognition.listening) recognition.stop()
    stopSpeaking()
    setSpeaking(false)
    activePlanRef.current = null
    setActivePlan(null)
    setPlanResult('')
    setReceipt(null)

    const inputMode = speechWasUsedRef.current ? 'speech' : 'text'
    if (inputMode === 'text') conversationLoopRef.current = false
    const localPlan = buildLocalAgentPlan(prompt, new Date(), assistantContext)
    const briefing = isBriefingRequest(prompt)
    track('voice_command_submitted', {
      language,
      input_mode: inputMode,
      intent_kind: briefing ? 'briefing' : localPlan ? 'plan' : 'assistant',
      step_count: localPlan?.steps.length ?? 0,
    })

    if (briefing) {
      const answer = buildDailyBriefing(assistantContext)
      const conversation = [
        ...turns,
        { id: turnId(), role: 'user' as const, content: prompt },
        { id: turnId(), role: 'model' as const, content: answer },
      ]
      setTurns(conversation)
      setDraft('')
      setStatusMessage('今日簡報已整理')
      speechWasUsedRef.current = false
      track('voice_context_briefing_opened', {
        task_count: assistantContext.activeTasks.length,
        event_count: assistantContext.todayEvents.length,
      })
      if (speakReplies) readResponse(answer, inputMode === 'speech' && conversationLoopRef.current)
      else if (inputMode === 'speech' && conversationLoopRef.current) resumeStandardConversation()
      return
    }

    const looksComplex = /(並|同時|然後|之後|再|以及|同埋|and)/i.test(prompt)
    const needsModelPlan =
      isAIConfigured &&
      shouldUseModelPlanner(prompt) &&
      (!localPlan || (looksComplex && localPlan.steps.length < 2))

    if (needsModelPlan) {
      const conversation = [
        ...turns,
        { id: turnId(), role: 'user' as const, content: prompt },
      ]
      setTurns(conversation)
      setDraft('')
      setPlanning(true)
      setStatusMessage('正在理解目標和安排次序…')
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const modelPlan = await buildModelAgentPlan(prompt, assistantContext, controller.signal)
        if (modelPlan) {
          showPlan(modelPlan, conversation)
          return
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        track('voice_agent_planner_failed', { error_kind: (error as Error).name || 'Error' })
      } finally {
        setPlanning(false)
        abortRef.current = null
      }
      await askAssistant(prompt, conversation)
      return
    }

    if (localPlan) {
      if (!localPlan.needsConfirmation && localPlan.steps.length === 1) {
        executeDirectPlan(localPlan)
        return
      }
      const conversation = [
        ...turns,
        { id: turnId(), role: 'user' as const, content: prompt },
      ]
      showPlan(localPlan, conversation)
      speechWasUsedRef.current = false
      return
    }

    await askAssistant(prompt)
  }
  promptHandlerRef.current = (prompt) => void handlePrompt(prompt)

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const prompt = draft.trim()
    if (!prompt || working) return
    if (
      activePlanRef.current &&
      !planCompleted &&
      (isPlanConfirmation(prompt) || isPlanCancellation(prompt))
    ) {
      void handlePrompt(prompt)
      return
    }
    if (liveVoice.active && liveVoice.sendText(prompt)) {
      setTurns((current) => [
        ...current,
        { id: turnId(), role: 'user' as const, content: prompt },
      ])
      setDraft('')
      setInterimText('')
      setStatusMessage('正在理解…')
      track('voice_command_submitted', {
        language,
        input_mode: 'live-text',
        intent_kind: 'assistant',
      })
      return
    }
    void handlePrompt(prompt)
  }

  const stopResponse = () => {
    conversationLoopRef.current = false
    abortRef.current?.abort()
    stopSpeaking()
    setSpeaking(false)
    setStatusMessage('已停止')
  }

  const clearSession = () => {
    conversationLoopRef.current = false
    liveVoice.stop()
    recognition.abort()
    abortRef.current?.abort()
    stopSpeaking()
    setTurns([])
    setStreaming('')
    setDraft('')
    setInterimText('')
    setSpeaking(false)
    setPlanning(false)
    executingRef.current = false
    setExecuting(false)
    activePlanRef.current = null
    setActivePlan(null)
    setStepStates({})
    setPlanCompleted(false)
    setPlanResult('')
    setReceipt(null)
    setStatusMessage('已清除今次對話')
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
  }

  const copyResponse = async (turn: VoiceTurn) => {
    try {
      await navigator.clipboard.writeText(turn.content)
      setCopiedId(turn.id)
      window.setTimeout(() => setCopiedId(null), 1600)
      toast.success('已複製回覆')
    } catch {
      toast.error('未能複製，請手動選取文字。')
    }
  }

  const responseInProgress = streaming
    ? { id: 'streaming', role: 'model' as const, content: streaming }
    : null
  const hasConversation =
    turns.length > 0 || Boolean(responseInProgress) || Boolean(activePlan) || Boolean(planResult)
  const confirmsPendingPlan = Boolean(
    activePlan && !planCompleted && isPlanConfirmation(draft),
  )
  const cancelsPendingPlan = Boolean(
    activePlan && !planCompleted && isPlanCancellation(draft),
  )
  const canSubmitWithoutAI = Boolean(
    previewPlan || briefingPreview || confirmsPendingPlan || cancelsPendingPlan,
  )
  const voiceSessionActive = liveVoice.active || recognition.listening
  const voiceInputSupported = liveVoice.supported || recognition.supported
  const submitLabel = confirmsPendingPlan
    ? '確認並執行'
    : cancelsPendingPlan
      ? '取消操作'
      : briefingPreview
        ? '整理今日簡報'
        : previewPlan?.needsConfirmation
          ? '預覽執行計劃'
          : previewPlan?.steps[0]?.kind === 'open_tool'
            ? `開啟${previewPlan.steps[0].toolLabel}`
            : '送出給智能助手'

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-white dark:bg-slate-950">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 dark:border-slate-800 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
            <AudioLines size={20} strokeWidth={1.8} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-950 dark:text-white">
              Ezi 智能助手
            </h1>
            <p className="flex items-center gap-1.5 truncate text-xs text-slate-600 dark:text-slate-300">
              <span
                className={cx(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  assistantState === '待命' ? 'bg-emerald-500' : 'bg-accent',
                )}
              />
              {assistantState}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor="voice-language">
            辨識語言
          </label>
          <select
            id="voice-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value as VoiceLanguage)}
            disabled={voiceSessionActive}
            className="h-11 cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-700 outline-none transition focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {VOICE_LANGUAGES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          {liveVoice.active && (
            <Tooltip label={liveVoice.inputMuted ? '開啟咪高峰' : '暫停咪高峰'}>
              <IconButton
                label={liveVoice.inputMuted ? '開啟咪高峰' : '暫停咪高峰'}
                onClick={() => liveVoice.setInputMuted(!liveVoice.inputMuted)}
              >
                {liveVoice.inputMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </IconButton>
            </Tooltip>
          )}

          <Tooltip label={speakReplies ? '關閉回覆聲音' : '開啟回覆聲音'}>
            <button
              type="button"
              role="switch"
              aria-checked={speakReplies}
              aria-label="回覆聲音"
              onClick={() => setSpeakReplies((value) => !value)}
              className={cx(
                'flex h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                speakReplies
                  ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
              )}
            >
              {speakReplies ? <Volume2 size={18} /> : <VolumeX size={18} />}
              <span className="hidden lg:inline">聲音</span>
            </button>
          </Tooltip>

          <Tooltip label="長錄音轉文字">
            <IconButton label="長錄音轉文字" onClick={() => nav.open('work-transcribe')}>
              <FileAudio size={18} />
            </IconButton>
          </Tooltip>

          <Tooltip label="清除對話">
            <IconButton
              label="清除對話"
              onClick={clearSession}
              disabled={!hasConversation && !draft && !liveVoice.active}
            >
              <RotateCcw size={18} />
            </IconButton>
          </Tooltip>
        </div>
      </header>

      <div
        ref={conversationRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
        aria-live="polite"
      >
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
          {!isAIConfigured && (
            <div className="mb-5">
              <ServiceStatus
                title="延伸問答暫時未連接"
                message="任務規劃、今日簡報及平台操作仍可使用。"
                adminDetails="AI provider is not configured. Check VITE_DEV_AI or Supabase Gemini function settings."
              />
            </div>
          )}

          {!hasConversation ? (
            <div className="flex flex-1 flex-col items-center justify-center py-2 text-center sm:py-7">
              <button
                type="button"
                onClick={toggleListening}
                disabled={!voiceInputSupported}
                aria-label={voiceSessionActive ? '結束語音對話' : '開始即時語音對話'}
                className={cx(
                  'flex h-14 w-14 cursor-pointer items-center justify-center rounded-full text-white shadow-sm transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/25 motion-reduce:transition-none disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700 sm:h-16 sm:w-16',
                  voiceSessionActive
                    ? 'bg-rose-600 hover:bg-rose-700 motion-safe:animate-pulse'
                    : 'bg-accent hover:bg-accent-strong',
                )}
              >
                {voiceSessionActive ? <Square size={22} fill="currentColor" /> : <Mic size={26} />}
              </button>
              <h2 className="mt-3 text-[22px] font-semibold text-slate-950 dark:text-white sm:mt-5 sm:text-[28px]">
                {greeting()}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {liveVoice.active
                  ? '直接說話即可；你插話時，我會立即停下來聽。'
                  : '按一下開始。講完會自動回應，不用再按送出。'}
              </p>

              <div className="mt-4 grid w-full max-w-2xl grid-cols-3 border-y border-slate-200 dark:border-slate-800 sm:mt-6">
                <button
                  type="button"
                  onClick={() => nav.open('work-tasks')}
                  className="flex min-h-16 cursor-pointer items-center justify-center gap-2 border-r border-slate-200 px-2 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 dark:border-slate-800 dark:hover:bg-slate-900 sm:px-3"
                >
                  <ListTodo size={17} className="text-accent" />
                  <span>
                    <strong className="block text-sm font-semibold text-slate-900 dark:text-white">
                      {assistantContext.activeTasks.length} 項
                    </strong>
                    <span className="text-xs text-slate-600 dark:text-slate-300">待處理</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => nav.open('calendar')}
                  className="flex min-h-16 cursor-pointer items-center justify-center gap-2 border-r border-slate-200 px-2 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 dark:border-slate-800 dark:hover:bg-slate-900 sm:px-3"
                >
                  <CalendarDays size={17} className="text-emerald-600" />
                  <span>
                    <strong className="block text-sm font-semibold text-slate-900 dark:text-white">
                      {assistantContext.todayEvents.length} 個
                    </strong>
                    <span className="text-xs text-slate-600 dark:text-slate-300">今日日程</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handlePrompt('Ezi，今日有咩要處理？')}
                  className="flex min-h-16 cursor-pointer items-center justify-center gap-1.5 px-2 py-3 text-xs font-semibold text-accent-strong transition hover:bg-accent-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 dark:text-accent dark:hover:bg-accent/10 sm:px-3 sm:text-sm"
                >
                  今日簡報 <ArrowRight size={16} />
                </button>
              </div>

              <div className="mt-4 hidden w-full max-w-2xl divide-y divide-slate-100 text-left dark:divide-slate-800 sm:block">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setDraft(example)
                      setStatusMessage('已填入指令，可修改後送出。')
                    }}
                    className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-2 py-2.5 text-sm text-slate-600 transition hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-300 dark:hover:text-accent"
                  >
                    <span>{example}</span>
                    <ArrowRight size={15} className="shrink-0 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {turns.map((turn) => (
                <VoiceTurnRow
                  key={turn.id}
                  turn={turn}
                  speaking={speaking}
                  copied={copiedId === turn.id}
                  onCopy={() => void copyResponse(turn)}
                  onSpeak={() => readResponse(turn.content)}
                  onStopSpeaking={() => {
                    stopSpeaking()
                    setSpeaking(false)
                  }}
                />
              ))}
              {activePlan && (
                <AgentPlanPanel
                  plan={activePlan}
                  states={stepStates}
                  executing={executing}
                  completed={planCompleted}
                  canUndo={Boolean(receipt)}
                  onConfirm={() => void executePlan()}
                  onCancel={cancelPlan}
                  onOpenTool={openTool}
                  onUndo={undoPlan}
                />
              )}
              {planResult && (
                <VoiceTurnRow
                  turn={{ id: 'plan-result', role: 'model', content: planResult }}
                  speaking={speaking}
                  copied={false}
                  onCopy={() => {}}
                  onSpeak={() => readResponse(planResult)}
                  onStopSpeaking={() => {
                    stopSpeaking()
                    setSpeaking(false)
                  }}
                />
              )}
              {responseInProgress && (
                <VoiceTurnRow
                  turn={responseInProgress}
                  speaking={false}
                  copied={false}
                  streaming
                  onCopy={() => {}}
                  onSpeak={() => {}}
                  onStopSpeaking={() => {}}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={submit}
        className="shrink-0 border-t border-slate-200/80 bg-white px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 dark:border-slate-800 dark:bg-slate-950 sm:px-5 sm:pb-4"
      >
        <div className="mx-auto w-full max-w-3xl">
          {draft.trim() && (
            <div className="mb-2 flex min-h-8 items-center gap-2 px-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              {briefingPreview ? (
                <>
                  <ListChecks size={14} className="shrink-0 text-accent" />
                  <span>整理你的今日簡報</span>
                </>
              ) : previewPlan ? (
                <>
                  {previewPlan.needsConfirmation ? (
                    <ListChecks size={14} className="shrink-0 text-accent" />
                  ) : (
                    <ArrowRight size={14} className="shrink-0 text-accent" />
                  )}
                  <span className="truncate">
                    {previewPlan.needsConfirmation
                      ? `已理解為 ${previewPlan.steps.length} 步任務，執行前會讓你確認`
                      : `將開啟：${previewPlan.steps[0]?.kind === 'open_tool' ? previewPlan.steps[0].toolLabel : previewPlan.title}`}
                  </span>
                </>
              ) : (
                <>
                  <MessageCircle size={14} className="shrink-0 text-accent" />
                  <span>由 Ezi 智能助手回答</span>
                </>
              )}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2 transition focus-within:border-accent/45 focus-within:bg-white focus-within:ring-2 focus-within:ring-accent/15 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:bg-slate-900">
            <label htmlFor="voice-command" className="sr-only">
              語音逐字稿或文字指令
            </label>
            <Textarea
              id="voice-command"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
                speechWasUsedRef.current = false
                if (!liveVoice.active) conversationLoopRef.current = false
              }}
              readOnly={recognition.listening}
              rows={2}
              placeholder={
                voiceSessionActive
                  ? liveVoice.active
                    ? '直接說話，或在這裡輸入補充'
                    : '正在聆聽…'
                  : '說出目標、問題或要執行的工作'
              }
              className="max-h-28 min-h-[52px] resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus:ring-0 dark:bg-transparent"
            />

            <div className="mt-1 flex items-end justify-between gap-2">
              <div className="min-w-0 flex-1 px-1" aria-live="polite">
                <p
                  className={cx(
                    'truncate text-xs',
                    voiceSessionActive
                      ? 'font-medium text-rose-600 dark:text-rose-400'
                      : 'text-slate-600 dark:text-slate-300',
                  )}
                >
                  {liveVoice.active
                    ? liveStateLabel
                    : recognition.listening
                      ? interimText || '正在聆聽…'
                    : statusMessage || 'Ezi 待命中'}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {draft && !recognition.listening && (
                  <Tooltip label="清除輸入">
                    <IconButton
                      label="清除輸入"
                      onClick={() => {
                        setDraft('')
                        setInterimText('')
                        setStatusMessage('')
                      }}
                    >
                      <X size={18} />
                    </IconButton>
                  </Tooltip>
                )}

                <Tooltip
                  label={
                    voiceInputSupported
                      ? voiceSessionActive
                        ? '結束語音對話'
                        : '開始即時語音對話'
                      : '此瀏覽器不支援語音輸入'
                  }
                >
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={!voiceInputSupported || working}
                    aria-label={voiceSessionActive ? '結束語音對話' : '開始即時語音對話'}
                    className={cx(
                      'flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-40',
                      voiceSessionActive
                        ? 'bg-rose-600 text-white hover:bg-rose-700 motion-safe:animate-pulse'
                        : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:text-accent dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
                    )}
                  >
                    {voiceSessionActive ? <Square size={17} fill="currentColor" /> : <Mic size={19} />}
                  </button>
                </Tooltip>

                {working ? (
                  <Button type="button" variant="secondary" icon={Square} onClick={stopResponse}>
                    停止
                  </Button>
                ) : (
                  <button
                    type="submit"
                    disabled={
                      !draft.trim() ||
                      (!liveVoice.active && !isAIConfigured && !canSubmitWithoutAI)
                    }
                    aria-label={submitLabel}
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-accent text-white shadow-sm transition hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
                  >
                    {confirmsPendingPlan ? (
                      <Check size={18} />
                    ) : cancelsPendingPlan ? (
                      <X size={18} />
                    ) : previewPlan?.needsConfirmation ? (
                      <ListChecks size={18} />
                    ) : previewPlan?.steps[0]?.kind === 'open_tool' ? (
                      <ArrowRight size={19} />
                    ) : (
                      <Send size={18} />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </section>
  )
}

function VoiceTurnRow({
  turn,
  copied,
  speaking,
  streaming = false,
  onCopy,
  onSpeak,
  onStopSpeaking,
}: {
  turn: VoiceTurn
  copied: boolean
  speaking: boolean
  streaming?: boolean
  onCopy: () => void
  onSpeak: () => void
  onStopSpeaking: () => void
}) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-lg bg-accent-soft px-4 py-3 text-[15px] leading-6 text-slate-800 dark:bg-accent/15 dark:text-slate-100 sm:max-w-[78%]">
          {turn.content}
        </div>
      </div>
    )
  }

  return (
    <article className="border-b border-slate-200/70 pb-6 last:border-b-0 dark:border-slate-800">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <AudioLines size={15} className="text-accent" />
        Ezi 智能助手
        {streaming && <span className="font-normal text-slate-500 dark:text-slate-400">正在回覆…</span>}
      </div>
      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-slate-800 dark:text-slate-100">
        {turn.content}
      </p>
      {!streaming && (
        <div className="mt-3 flex items-center gap-1">
          <Tooltip label={copied ? '已複製' : '複製回覆'}>
            <IconButton label={copied ? '已複製' : '複製回覆'} onClick={onCopy}>
              {copied ? <Check size={17} /> : <Copy size={17} />}
            </IconButton>
          </Tooltip>
          <Tooltip label={speaking ? '停止朗讀' : '朗讀回覆'}>
            <IconButton
              label={speaking ? '停止朗讀' : '朗讀回覆'}
              onClick={speaking ? onStopSpeaking : onSpeak}
            >
              {speaking ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </IconButton>
          </Tooltip>
        </div>
      )}
    </article>
  )
}
