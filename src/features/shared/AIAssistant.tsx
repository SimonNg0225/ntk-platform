import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useMode } from '../../context/ModeContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { useNav } from '../../context/NavContext'
import {
  streamChat,
  isAIConfigured,
  type AIModel,
  type AIMessage,
} from '../../lib/aiClient'
import {
  aiThreadsCol,
  aiMessagesCol,
  meetingNotesCol,
} from '../../data/collections'
import { richNotesCol, notebooksCol, folderColorOf, type Notebook } from '../learning/notes/store'
import { deriveTitle, snippet } from '../learning/notes/util'
import { journalDocsCol } from '../learning/journal/store'
import type { AiMessage } from '../../data/types'
import { useCollection } from '../../lib/store'
import type { ModeId } from '../../modes/modes'
import {
  Button,
  IconButton,
  Input,
  Textarea,
  Field,
  EmptyState,
  Modal,
  Badge,
  Tooltip,
  Kbd,
  SegmentedControl,
  Menu,
  StatCard,
  SectionTitle,
  Card,
  cx,
} from '../../ui'
import {
  Bot,
  Lock,
  Plus,
  Square,
  Send,
  Search,
  Pin,
  PinOff,
  Trash2,
  Pencil,
  Copy,
  RefreshCw,
  Check,
  PanelLeft,
  Sparkles,
  Paperclip,
  FileText,
  Download,
  BarChart3,
  Command,
  X,
  MessageSquarePlus,
  Archive,
  ArchiveRestore,
  Thermometer,
  ChevronDown,
  CornerDownLeft,
  StickyNote,
  Users,
  BookOpen,
  Library,
} from 'lucide-react'
import {
  threadMetaCol,
  promptTemplatesCol,
  PERSONAS,
  personaById,
} from './aiAssistant/store'
import type { ContextRef, ThreadMeta, PersonaId } from './aiAssistant/types'
import {
  builtinTemplates,
  extractVars,
  fillTemplate,
  type BuiltinTemplate,
} from './aiAssistant/templates'
import {
  approxWords,
  approxTokens,
  groupByTime,
  computeStats,
  conversationToMarkdown,
  downloadText,
  safeFilename,
} from './aiAssistant/util'
import { Markdown } from './aiAssistant/markdown'
import { ActivityBars, RatioBar } from './aiAssistant/charts'

// ============================================================
//  AI 助手 — ChatGPT / Claude 級對話工作枱
//  ------------------------------------------------------------
//  Power features：
//   • 多對話側欄（搜尋 / 時間分組 / 置頂 / 封存 / 重新命名 / 刪除）
//   • Prompt 範本庫（內建 + 自訂，{{變數}} 表單）
//   • 連結筆記 / 會議紀錄 / 日誌 / 自由文字做上下文，注入 system
//   • 每訊息：複製 / 重新生成 / 編輯重發 / 由此刪除
//   • 模型 + 溫度 + 人格（per-conversation 持久化）
//   • 輕量 Markdown 渲染（標題 / 列表 / 表格 / code+複製）
//   • 命令面板（⌘K）+ 全鍵盤操作
//   • 用量統計（活躍圖、用/答比例、streak）+ 匯出 Markdown
//  共用 aiThreadsCol / aiMessagesCol 做 source of truth（唔改），
//  附加 metadata 旁掛喺自家 threadMetaCol。
// ============================================================

const MODE_AI: Record<
  ModeId,
  { system: string; greeting: string; tagline: string }
> = {
  learning: {
    system:
      '你係「NTK 個人平台」嘅 AI 個人助手，協助一位用家。請用繁體中文回答（可以用書面廣東話）。風格：精簡、有條理、有重點，適當用列點同例子。如果問題太模糊，先簡短澄清再答。可以用 Markdown（標題、列點、表格、程式碼區塊）令答案更清楚。',
    greeting: '我係你嘅個人助手',
    tagline: '解釋概念 · 總結筆記 · 出練習 · 規劃溫習',
  },
  work: {
    system:
      '你係「NTK 平台」嘅 BAFS（企業、會計與財務概論）教學助手，協助一位香港中學老師。可以幫手出題（連參考答案同評分指引）、寫教案大綱、擬批改評語、設計課堂活動。請用繁體中文，內容貼合香港高中 BAFS 課程，專業、實用、有條理。可以用 Markdown（標題、列點、表格）令內容更清楚。',
    greeting: '我係你嘅 BAFS 教學助手',
    tagline: '出題 · 寫教案 · 擬評語 · 設計活動',
  },
}

const MODELS: { id: AIModel; label: string; short: string }[] = [
  { id: 'gemini-2.5-flash', label: '⚡ Flash（快）', short: 'Flash' },
  { id: 'gemini-2.5-pro', label: '🧠 Pro（強）', short: 'Pro' },
]

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl'

export default function AIAssistant() {
  const { mode } = useMode()
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const { open: goToFeature } = useNav()

  const cfg = MODE_AI[mode]

  // ── 共用 source of truth ──
  const allThreads = useCollection(aiThreadsCol)
  const allMessages = useCollection(aiMessagesCol)
  const allMeta = useCollection(threadMetaCol)
  const customTemplates = useCollection(promptTemplatesCol)
  const notebooks = useCollection(notebooksCol)

  // 旁掛 meta 快查
  const metaMap = useMemo(() => {
    const m = new Map<string, ThreadMeta>()
    for (const x of allMeta) m.set(x.id, x)
    return m
  }, [allMeta])

  // 每條對話訊息數快查（一次過 groupBy，側欄逐條 O(1) 查，免每 render O(N×M) 全掃）
  const countByThread = useMemo(() => {
    const m = new Map<string, number>()
    for (const msg of allMessages) m.set(msg.threadId, (m.get(msg.threadId) ?? 0) + 1)
    return m
  }, [allMessages])

  // ── 本地 UI 狀態 ──
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null)
  // Composer 自管輸入 state；呢度只用 seed 餵佢（填範本/清空，n 一變先載入）。
  // 打字唔再 setState 喺呢個父組件 → 唔會 re-render 訊息/側欄（連 IME 都唔被打斷）。
  const [seed, setSeed] = useState<{ text: string; n: number }>({ text: '', n: 0 })
  const [streaming, setStreaming] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // 手機（<sm）預設收埋側欄（避免抽屜開頁即遮住內容）；sm 以上維持展開
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 640,
  )
  const [showArchived, setShowArchived] = useState(false)
  const [search, setSearch] = useState('')

  // 預設模型 / 人格（未進入特定對話時用；之後寫入該 thread meta）
  const [draftModel, setDraftModel] = useState<AIModel>('gemini-2.5-flash')
  const [draftPersona, setDraftPersona] = useState<PersonaId>('default')
  const [draftTemp, setDraftTemp] = useState(0.7)
  const [draftContexts, setDraftContexts] = useState<ContextRef[]>([])

  // modal flags
  const [templateOpen, setTemplateOpen] = useState(false)
  // Welcome chip 帶變數時：開範本庫即直接跳去「填寫」表單（唔使再揀多次）
  const [tplInitialFill, setTplInitialFill] = useState<{ title: string; body: string } | null>(null)
  const [contextOpen, setContextOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<string | null>(null)
  // 「加入筆記」目標：要存做筆記嘅 AI 回覆內容（null = 冇開揀筆記本彈窗）
  const [noteFor, setNoteFor] = useState<string | null>(null)
  // Dev-only：跳過 Supabase / 登入 gate 嚟測試 UI（尤其打字 bug）。
  // import.meta.env.DEV 喺 vite build 時為 false → 生產環境永遠睇唔到，亦觸發唔到。
  const [devBypass, setDevBypass] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // 現對話嘅 meta（若有）
  const currentMeta = currentThreadId ? metaMap.get(currentThreadId) : undefined
  const activeModel = currentMeta?.model ?? draftModel
  const activePersona = currentMeta?.persona ?? draftPersona
  const activeTemp = currentMeta?.temperature ?? draftTemp
  const activeContexts = currentMeta?.contexts ?? draftContexts

  // ── threads（按模式 + 封存過濾 + 搜尋 + 置頂排序）──
  const threadsForMode = useMemo(
    () => allThreads.filter((t) => t.mode === mode),
    [allThreads, mode],
  )

  const visibleThreads = useMemo(() => {
    const q = search.trim().toLowerCase()
    return threadsForMode
      .filter((t) => {
        const meta = metaMap.get(t.id)
        if ((meta?.archived ?? false) !== showArchived) return false
        if (!q) return true
        const title = (meta?.customTitle ?? t.title).toLowerCase()
        if (title.includes(q)) return true
        // 搜內文
        return allMessages.some(
          (m) => m.threadId === t.id && m.content.toLowerCase().includes(q),
        )
      })
      .sort((a, b) => {
        const pa = metaMap.get(a.id)?.pinned ? 1 : 0
        const pb = metaMap.get(b.id)?.pinned ? 1 : 0
        if (pa !== pb) return pb - pa
        return b.createdAt.localeCompare(a.createdAt)
      })
  }, [threadsForMode, metaMap, showArchived, search, allMessages])

  const pinned = visibleThreads.filter((t) => metaMap.get(t.id)?.pinned)
  const unpinnedGroups = groupByTime(
    visibleThreads.filter((t) => !metaMap.get(t.id)?.pinned),
  )

  // 現對話訊息
  const messages = useMemo(
    () =>
      allMessages
        .filter((m) => m.threadId === currentThreadId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [allMessages, currentThreadId],
  )

  const threadTitle = currentThreadId
    ? (currentMeta?.customTitle ??
      allThreads.find((t) => t.id === currentThreadId)?.title ??
      '對話')
    : '新對話'

  // 切模式 → 重設
  useEffect(() => {
    setCurrentThreadId(null)
    setSeed((s) => ({ text: '', n: s.n + 1 }))
    setStreaming(null)
    setSearch('')
    setShowArchived(false)
    setDraftContexts([])
  }, [mode])

  // 自動捲到底
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, streaming])

  // ── meta helpers ──
  const patchMeta = useCallback(
    (threadId: string, patch: Partial<ThreadMeta>) => {
      const existing = threadMetaCol.get().find((m) => m.id === threadId)
      if (existing) {
        threadMetaCol.update(threadId, { ...patch, updatedAt: new Date().toISOString() })
      } else {
        threadMetaCol.add({ id: threadId, ...patch, updatedAt: new Date().toISOString() })
      }
    },
    [],
  )

  // ── 組裝完整 system prompt（模式 + 人格 + 上下文）──
  const buildSystem = useCallback(
    (contexts: ContextRef[], persona: PersonaId): string => {
      let sys = cfg.system
      const dir = personaById(persona).directive
      if (dir) sys += `\n\n【語氣要求】${dir}`
      if (contexts.length > 0) {
        const ctxText = contexts
          .map((c, i) => `〔資料 ${i + 1}：${c.title}〕\n${c.content}`)
          .join('\n\n')
        sys += `\n\n以下係用戶提供嘅參考資料，回答時請優先參考、引用、扣連返呢啲內容：\n\n${ctxText}`
      }
      return sys
    },
    [cfg.system],
  )

  // ── 核心：送出 / 串流 ──
  const runCompletion = useCallback(
    async (threadId: string, model: AIModel, persona: PersonaId, temp: number, contexts: ContextRef[]) => {
      const history: AIMessage[] = aiMessagesCol
        .get()
        .filter((m) => m.threadId === threadId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((m) => ({ role: m.role, content: m.content }))

      const controller = new AbortController()
      abortRef.current = controller
      setBusy(true)
      setStreaming('')

      let full = ''
      let aborted = false
      try {
        for await (const chunk of streamChat({
          messages: history,
          system: buildSystem(contexts, persona),
          model,
          temperature: temp,
          signal: controller.signal,
        })) {
          full += chunk
          setStreaming(full)
        }
      } catch (e) {
        const err = e as Error
        if (err.name === 'AbortError') aborted = true
        else toast.error(err.message || 'AI 出錯')
      } finally {
        // 串流被 abort（切對話／開新對話／封存／停止掣）時丟棄半截回覆，
        // 唔好把截斷訊息持久化落 thread（避免殘留半截 AI 訊息 / 資料不一致）。
        if (!aborted && full.trim()) {
          aiMessagesCol.add({
            threadId,
            role: 'model',
            content: full,
            createdAt: new Date().toISOString(),
          })
        }
        setBusy(false)
        setStreaming(null)
        abortRef.current = null
      }
    },
    [buildSystem, toast],
  )

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim()
      if (!text || busy) return

      let threadId = currentThreadId
      let model = activeModel
      let persona = activePersona
      let temp = activeTemp
      let contexts = activeContexts

      if (!threadId) {
        const t = aiThreadsCol.add({
          mode,
          title: text.slice(0, 36),
          createdAt: new Date().toISOString(),
        })
        threadId = t.id
        // 將 draft 設定固化落新 thread
        patchMeta(threadId, {
          model: draftModel,
          persona: draftPersona,
          temperature: draftTemp,
          contexts: draftContexts,
        })
        model = draftModel
        persona = draftPersona
        temp = draftTemp
        contexts = draftContexts
        setCurrentThreadId(threadId)
      }

      aiMessagesCol.add({
        threadId,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      })
      // 輸入框由 Composer 自己清空（佢 submit 後 setText('')）
      await runCompletion(threadId, model, persona, temp, contexts)
    },
    [
      busy,
      currentThreadId,
      activeModel,
      activePersona,
      activeTemp,
      activeContexts,
      mode,
      draftModel,
      draftPersona,
      draftTemp,
      draftContexts,
      patchMeta,
      runCompletion,
    ],
  )

  // 重新生成最後一個 AI 回覆
  const regenerate = useCallback(async () => {
    if (!currentThreadId || busy) return
    const msgs = aiMessagesCol
      .get()
      .filter((m) => m.threadId === currentThreadId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const lastModel = [...msgs].reverse().find((m) => m.role === 'model')
    if (lastModel) aiMessagesCol.remove(lastModel.id)
    await runCompletion(currentThreadId, activeModel, activePersona, activeTemp, activeContexts)
  }, [currentThreadId, busy, runCompletion, activeModel, activePersona, activeTemp, activeContexts])

  // 編輯並重發某條 user 訊息（刪除佢之後嘅所有訊息）
  const editAndResend = useCallback(
    async (msg: AiMessage, newText: string) => {
      if (!currentThreadId) return
      const text = newText.trim()
      if (!text) return
      const msgs = aiMessagesCol
        .get()
        .filter((m) => m.threadId === currentThreadId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      const idx = msgs.findIndex((m) => m.id === msg.id)
      if (idx === -1) return
      // 刪 idx 之後所有
      for (let i = idx; i < msgs.length; i++) aiMessagesCol.remove(msgs[i].id)
      aiMessagesCol.add({
        threadId: currentThreadId,
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      })
      await runCompletion(currentThreadId, activeModel, activePersona, activeTemp, activeContexts)
    },
    [currentThreadId, runCompletion, activeModel, activePersona, activeTemp, activeContexts],
  )

  // 由某條訊息開始往下刪
  const deleteFromHere = useCallback(
    (msg: AiMessage) => {
      if (!currentThreadId) return
      const msgs = aiMessagesCol
        .get()
        .filter((m) => m.threadId === currentThreadId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      const idx = msgs.findIndex((m) => m.id === msg.id)
      if (idx === -1) return
      for (let i = idx; i < msgs.length; i++) aiMessagesCol.remove(msgs[i].id)
    },
    [currentThreadId],
  )

  // 將 AI 回覆內容存做一篇個人筆記（標題由內文首行自動推導）。
  // 對齊 Inbox / 全域搜尋「轉筆記」嘅寫法：寫入 richNotesCol（notes_rich_v2）。
  //  · notebookId：由「揀筆記本」彈窗傳入（null = 未分類）
  //  · 自動加 #AI助手 標籤（來源註記），方便日後喺筆記度篩選
  //  · 成功後彈出帶「檢視」捷徑嘅 toast，撳一下跳去筆記頁
  const saveAsNote = useCallback(
    (content: string, notebookId: string | null) => {
      const text = content.trim()
      if (!text) return
      const now = new Date().toISOString()
      richNotesCol.add({
        title: '',
        content: `${text}\n\n#AI助手`,
        notebookId,
        pinned: false,
        favorite: false,
        archived: false,
        trashed: false,
        color: 'none',
        createdAt: now,
        updatedAt: now,
      })
      toast.success('已加入筆記', { label: '檢視', onClick: () => goToFeature('learning-notes') })
    },
    [toast, goToFeature],
  )

  // 手機（<sm）揀完／開新對話後收埋抽屜，避免遮住對話內容
  function closeSidebarOnMobile() {
    if (typeof window !== 'undefined' && window.innerWidth < 640) setSidebarOpen(false)
  }

  // ── thread 操作 ──
  function newConversation() {
    abortRef.current?.abort()
    setCurrentThreadId(null)
    setStreaming(null)
    setSeed((s) => ({ text: '', n: s.n + 1 })) // Composer 清空 + 自動 focus
    closeSidebarOnMobile()
  }

  function selectThread(id: string) {
    abortRef.current?.abort()
    setStreaming(null)
    setCurrentThreadId(id)
    closeSidebarOnMobile()
  }

  async function deleteThread(id: string) {
    const ok = await confirm({
      title: '刪除呢個對話？',
      message: '對話同所有訊息會永久刪除。',
      tone: 'danger',
      confirmText: '刪除',
    })
    if (!ok) return
    aiMessagesCol.get().filter((m) => m.threadId === id).forEach((m) => aiMessagesCol.remove(m.id))
    aiThreadsCol.remove(id)
    threadMetaCol.remove(id)
    if (currentThreadId === id) newConversation()
    toast.success('已刪除對話')
  }

  function togglePin(id: string) {
    const meta = metaMap.get(id)
    patchMeta(id, { pinned: !meta?.pinned })
  }

  function toggleArchive(id: string) {
    const meta = metaMap.get(id)
    patchMeta(id, { archived: !meta?.archived })
    if (currentThreadId === id) newConversation()
  }

  // 範本 / Welcome chip 填入輸入框：透過 seed 餵畀 Composer（佢會載入 + focus + 游標到尾）
  function applyText(text: string) {
    setSeed((s) => ({ text, n: s.n + 1 }))
  }

  // 改 model / persona / temp：寫返現對話 meta（或 draft）
  function setModel(m: AIModel) {
    if (currentThreadId) patchMeta(currentThreadId, { model: m })
    else setDraftModel(m)
  }
  function setPersona(p: PersonaId) {
    if (currentThreadId) patchMeta(currentThreadId, { persona: p })
    else setDraftPersona(p)
  }
  function setTemp(v: number) {
    if (currentThreadId) patchMeta(currentThreadId, { temperature: v })
    else setDraftTemp(v)
  }
  function setContexts(c: ContextRef[]) {
    if (currentThreadId) patchMeta(currentThreadId, { contexts: c })
    else setDraftContexts(c)
  }

  function exportConversation() {
    if (messages.length === 0) {
      toast.info('呢個對話仲未有內容')
      return
    }
    const md = conversationToMarkdown(threadTitle, messages)
    downloadText(`${safeFilename(threadTitle)}.md`, md)
    toast.success('已匯出 Markdown')
  }

  // ── 全域鍵盤 ──
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      } else if (meta && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setSidebarOpen((v) => !v)
      } else if (meta && e.key === '/') {
        e.preventDefault()
        setTemplateOpen(true)
      } else if (meta && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        newConversation()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 統計
  const stats = useMemo(
    () => computeStats(threadsForMode, allMessages.filter((m) => threadsForMode.some((t) => t.id === m.threadId))),
    [threadsForMode, allMessages],
  )

  // ── Composer handlers：包成 stable refs，畀 React.memo 真正生效 ──
  // 之前係 inline arrow（onSend={(t)=>send(t)}…），每次父組件 render 都產生新 fn ref
  // → memo 失效 → Composer 無謂 re-render（雖然唔影響打字，但 IME / iOS 嗰啲 edge case
  // 可能間接踫上）。而家用 useCallback 鎖住 ref，父組件就算 re-render，Composer props
  // 全部 same-by-shallow，memo 真正擋到。
  const onSendStable = useCallback((t: string) => void send(t), [send])
  const onStopStable = useCallback(() => abortRef.current?.abort(), [])
  const onOpenTemplateStable = useCallback(() => setTemplateOpen(true), [])
  const onOpenContextStable = useCallback(() => setContextOpen(true), [])

  // ── 守門（dev 可一鍵 bypass 嚟測試 UI）──
  if (!isAIConfigured && !devBypass) {
    return (
      <EmptyState
        icon={Bot}
        title="AI 助手未啟用"
        hint="要設定好 Supabase 並部署 gemini Edge Function 先用到。步驟見 docs/SETUP.md。"
        action={
          import.meta.env.DEV ? (
            <Button variant="secondary" size="sm" onClick={() => setDevBypass(true)}>
              🧪 測試模式（dev only · 跳過 Supabase）
            </Button>
          ) : null
        }
      />
    )
  }
  if (!user && !devBypass) {
    return (
      <EmptyState
        icon={Lock}
        title="請先登入先可以用 AI 助手"
        hint="喺左下角用 Google 登入後就用得。"
        action={
          import.meta.env.DEV ? (
            <Button variant="secondary" size="sm" onClick={() => setDevBypass(true)}>
              🧪 測試模式（dev only · 跳過登入）
            </Button>
          ) : null
        }
      />
    )
  }

  const personaLabel = personaById(activePersona).label
  const modelShort = MODELS.find((m) => m.id === activeModel)?.short ?? activeModel

  return (
    <div className="flex h-[78vh] gap-3">
      {/* ───────── 側欄：對話清單（手機=抽屜 overlay；sm+=inline）───────── */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="關閉側欄"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 animate-fade-in bg-slate-900/40 backdrop-blur-sm sm:hidden"
        />
      )}
      {sidebarOpen && (
        <aside className="fixed inset-y-0 left-0 z-40 flex w-64 max-w-[82vw] shrink-0 flex-col border-r border-slate-200/80 bg-white shadow-overlay dark:border-slate-700/70 dark:bg-slate-800 sm:static sm:z-auto sm:max-w-none sm:rounded-2xl sm:border sm:shadow-none sm:dark:bg-slate-800/60">
          <div className="space-y-2 border-b border-slate-200/70 p-2.5 dark:border-slate-700/60">
            <div className="flex items-center justify-between sm:hidden">
              <span className="px-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">對話</span>
              <IconButton label="關閉側欄" size="sm" onClick={() => setSidebarOpen(false)}>
                <X size={16} />
              </IconButton>
            </div>
            <Button fullWidth size="sm" icon={MessageSquarePlus} onClick={newConversation}>
              新對話
            </Button>
            <Input
              icon={Search}
              className="py-1.5 text-base sm:text-xs"
              placeholder="搜尋對話…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-2">
            {visibleThreads.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-slate-400">
                {showArchived ? '冇封存對話' : search ? '搵唔到對話' : '仲未有對話，開始傾啦'}
              </p>
            ) : (
              <>
                {pinned.length > 0 && (
                  <ThreadGroup label="📌 置頂">
                    {pinned.map((t) => (
                      <ThreadRow
                        key={t.id}
                        title={metaMap.get(t.id)?.customTitle ?? t.title}
                        active={t.id === currentThreadId}
                        pinned
                        archived={!!metaMap.get(t.id)?.archived}
                        count={countByThread.get(t.id) ?? 0}
                        onClick={() => selectThread(t.id)}
                        onPin={() => togglePin(t.id)}
                        onArchive={() => toggleArchive(t.id)}
                        onRename={() => setRenameTarget(t.id)}
                        onDelete={() => void deleteThread(t.id)}
                      />
                    ))}
                  </ThreadGroup>
                )}
                {unpinnedGroups.map((g) => (
                  <ThreadGroup key={g.bucket} label={g.bucket}>
                    {g.items.map((t) => (
                      <ThreadRow
                        key={t.id}
                        title={metaMap.get(t.id)?.customTitle ?? t.title}
                        active={t.id === currentThreadId}
                        pinned={false}
                        archived={!!metaMap.get(t.id)?.archived}
                        count={countByThread.get(t.id) ?? 0}
                        onClick={() => selectThread(t.id)}
                        onPin={() => togglePin(t.id)}
                        onArchive={() => toggleArchive(t.id)}
                        onRename={() => setRenameTarget(t.id)}
                        onDelete={() => void deleteThread(t.id)}
                      />
                    ))}
                  </ThreadGroup>
                ))}
              </>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200/70 p-2 dark:border-slate-700/60">
            <button
              type="button"
              aria-pressed={showArchived}
              onClick={() => setShowArchived((v) => !v)}
              className={cx(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition',
                showArchived
                  ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300',
              )}
            >
              <Archive size={13} /> {showArchived ? '返對話' : '封存'}
            </button>
            <button
              type="button"
              onClick={() => setStatsOpen(true)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
            >
              <BarChart3 size={13} /> 統計
            </button>
          </div>
        </aside>
      )}

      {/* ───────── 主對話區 ───────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* 工具列 */}
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip label={`側欄（${MOD}+B）`}>
            <IconButton label="切換側欄" onClick={() => setSidebarOpen((v) => !v)} active={sidebarOpen}>
              <PanelLeft size={18} />
            </IconButton>
          </Tooltip>

          {/* 模型（輕量 segmented，唔似表單 select） */}
          <SegmentedControl
            size="sm"
            value={activeModel}
            onChange={(id) => setModel(id as AIModel)}
            options={MODELS.map((m) => ({ id: m.id, label: m.label }))}
          />

          {/* 人格 */}
          <Menu
            align="start"
            trigger={
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                <Sparkles size={13} className="text-accent" /> {personaLabel}
                <ChevronDown size={12} className="text-slate-400" />
              </span>
            }
            items={PERSONAS.map((p) => ({
              id: p.id,
              label: p.label,
              icon: activePersona === p.id ? Check : undefined,
              onSelect: () => setPersona(p.id),
            }))}
          />

          {/* 溫度 */}
          <Tooltip label="創意度（temperature）">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
              <Thermometer size={13} className="text-slate-400" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={activeTemp}
                onChange={(e) => setTemp(Number(e.target.value))}
                className="h-1 w-16 cursor-pointer accent-accent"
                aria-label="溫度"
              />
              <span className="w-6 tabular-nums text-[11px] font-medium text-slate-500 dark:text-slate-400">{activeTemp.toFixed(1)}</span>
            </span>
          </Tooltip>

          <div className="flex-1" />

          {/* 上下文 */}
          <Tooltip label="連結資料做上下文">
            <Button
              variant="secondary"
              size="sm"
              icon={Paperclip}
              onClick={() => setContextOpen(true)}
            >
              上下文
              {activeContexts.length > 0 && (
                <span className="ml-1 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white tabular-nums">
                  {activeContexts.length}
                </span>
              )}
            </Button>
          </Tooltip>

          <Menu
            trigger={
              <span
                aria-label="更多操作"
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <Command size={16} />
              </span>
            }
            items={[
              { id: 'palette', label: `命令面板  ${MOD}K`, icon: Command, onSelect: () => setPaletteOpen(true) },
              { id: 'tpl', label: `範本庫  ${MOD}/`, icon: Library, onSelect: () => setTemplateOpen(true) },
              { id: 'export', label: '匯出對話 (.md)', icon: Download, onSelect: exportConversation, disabled: !currentThreadId },
              { id: 'stats', label: '用量統計', icon: BarChart3, onSelect: () => setStatsOpen(true) },
            ]}
          />
        </div>

        {/* 對話標題列（有對話時） */}
        {currentThreadId && (
          <div className="flex items-center gap-2 px-1">
            <h2 className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
              {threadTitle}
            </h2>
            <Badge tone="slate">{modelShort}</Badge>
            {activeContexts.length > 0 && (
              <Badge tone="accent" icon={Paperclip}>
                {activeContexts.length} 份資料
              </Badge>
            )}
            <div className="flex-1" />
            <Tooltip label="重新命名">
              <IconButton label="重新命名" size="sm" onClick={() => setRenameTarget(currentThreadId)}>
                <Pencil size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip label="匯出 Markdown">
              <IconButton label="匯出" size="sm" onClick={exportConversation}>
                <Download size={14} />
              </IconButton>
            </Tooltip>
          </div>
        )}

        {/* 訊息區 */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-6 overflow-y-auto rounded-3xl border border-slate-200/70 bg-slate-50/60 p-4 dark:border-slate-700/60 dark:bg-slate-900/30 sm:px-5 sm:py-5"
        >
          {messages.length === 0 && streaming === null ? (
            <Welcome
              greeting={cfg.greeting}
              tagline={cfg.tagline}
              templates={builtinTemplates(mode).slice(0, 6)}
              onPick={(t) => {
                // 帶變數：直接開「填寫」表單（之前係開成個範本庫，要喺度再揀多次先填到）。
                // 冇變數：直接填入 Composer。
                if (t.body.includes('{{')) {
                  setTplInitialFill({ title: t.title, body: t.body })
                  setTemplateOpen(true)
                } else {
                  applyText(t.body)
                }
              }}
              onOpenLibrary={() => setTemplateOpen(true)}
            />
          ) : (
            <>
              {messages.map((m, i) => (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  isLast={i === messages.length - 1}
                  canRegen={!busy && m.role === 'model' && i === messages.length - 1}
                  onCopy={() => {
                    void navigator.clipboard?.writeText(m.content)
                    toast.success('已複製')
                  }}
                  onRegen={() => void regenerate()}
                  onEdit={(text) => void editAndResend(m, text)}
                  onDelete={() => deleteFromHere(m)}
                  onSaveNote={() => setNoteFor(m.content)}
                />
              ))}
              {streaming !== null && (
                <div aria-live="polite" aria-busy={busy}>
                  <MessageBubble
                    msg={{ id: '__stream', threadId: '', role: 'model', content: streaming, createdAt: '' }}
                    streaming
                    isLast
                    canRegen={false}
                    onCopy={() => {}}
                    onRegen={() => {}}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    onSaveNote={() => {}}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* 上下文 chip 列（有就顯示） */}
        {activeContexts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
              <Paperclip size={11} /> 上下文
            </span>
            {activeContexts.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft py-1 pl-2.5 pr-1.5 text-[11px] font-medium text-accent-strong ring-1 ring-inset ring-accent/15 dark:bg-accent/15 dark:text-accent dark:ring-accent/20"
              >
                <FileText size={11} />
                <span className="max-w-[10rem] truncate">{c.title}</span>
                <button
                  type="button"
                  onClick={() => setContexts(activeContexts.filter((x) => x.id !== c.id))}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-accent-strong/70 transition hover:bg-accent/15 hover:text-accent-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 dark:text-accent/70 dark:hover:bg-accent/20 dark:hover:text-accent"
                  aria-label={`移除上下文：${c.title}`}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* 輸入區（貼底）— 獨立 Composer：自管輸入 state，打字完全唔會 re-render 父組件 */}
        {/* 註：handlers 走 stable refs（onSendStable / onStopStable …），令 memo 真正生效。 */}
        <Composer
          seed={seed}
          busy={busy}
          contextCount={activeContexts.length}
          onSend={onSendStable}
          onStop={onStopStable}
          onOpenTemplate={onOpenTemplateStable}
          onOpenContext={onOpenContextStable}
        />
      </div>

      {/* ───────── Modals ───────── */}
      <TemplateLibrary
        open={templateOpen}
        initialFill={tplInitialFill}
        onClose={() => {
          setTemplateOpen(false)
          setTplInitialFill(null)
        }}
        mode={mode}
        custom={customTemplates}
        onUse={(text) => {
          applyText(text)
          setTemplateOpen(false)
          setTplInitialFill(null)
        }}
        toast={toast}
        confirm={confirm}
      />
      <ContextPicker
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        current={activeContexts}
        onChange={setContexts}
        mode={mode}
        toast={toast}
      />
      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} stats={stats} mode={mode} />
      <SaveNoteModal
        open={noteFor !== null}
        content={noteFor ?? ''}
        notebooks={notebooks}
        onClose={() => setNoteFor(null)}
        onSave={(notebookId) => {
          if (noteFor !== null) saveAsNote(noteFor, notebookId)
          setNoteFor(null)
        }}
      />
      <RenameModal
        threadId={renameTarget}
        currentTitle={
          renameTarget
            ? (metaMap.get(renameTarget)?.customTitle ??
              allThreads.find((t) => t.id === renameTarget)?.title ??
              '')
            : ''
        }
        onClose={() => setRenameTarget(null)}
        onSave={(title) => {
          if (renameTarget) patchMeta(renameTarget, { customTitle: title })
          setRenameTarget(null)
        }}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        threads={visibleThreads.map((t) => ({
          id: t.id,
          title: metaMap.get(t.id)?.customTitle ?? t.title,
        }))}
        actions={[
          { id: 'new', label: '開新對話', icon: MessageSquarePlus, run: newConversation },
          { id: 'tpl', label: '開範本庫', icon: Library, run: () => setTemplateOpen(true) },
          { id: 'ctx', label: '連結上下文', icon: Paperclip, run: () => setContextOpen(true) },
          { id: 'stats', label: '用量統計', icon: BarChart3, run: () => setStatsOpen(true) },
          { id: 'export', label: '匯出對話', icon: Download, run: exportConversation },
          { id: 'sidebar', label: '切換側欄', icon: PanelLeft, run: () => setSidebarOpen((v) => !v) },
        ]}
        onSelectThread={(id) => {
          selectThread(id)
          setPaletteOpen(false)
        }}
      />
    </div>
  )
}

// ════════════════════════════════════════════════════════════
//  子元件
// ════════════════════════════════════════════════════════════

// ───────── 輸入區（獨立組件，自管 state）─────────
// 關鍵修復：輸入 state 留喺呢度，打字唔會 re-render 父組件（訊息 / 側欄 / welcome 都唔郁），
// 連中文 IME 組字都唔會被父組件嘅 re-render 打斷（之前每打一字都重 render → 「跳」）。
// seed.n 一變 = 父組件要求載入文字（範本填入 / 開新對話清空 / 切模式）。
const Composer = memo(function Composer({
  seed,
  busy,
  contextCount,
  onSend,
  onStop,
  onOpenTemplate,
  onOpenContext,
}: {
  seed: { text: string; n: number }
  busy: boolean
  contextCount: number
  onSend: (text: string) => void
  onStop: () => void
  onOpenTemplate: () => void
  onOpenContext: () => void
}) {
  // 「完全非受控」輸入區：打字唔會引起任何 React state 改變／re-render。
  // 之前就算抽咗去 Composer，每打一字都仲 setText → Composer subtree（連個 textarea）
  // 重新 render；iOS Safari／中文 IME 喺呢個 subtree 重 render 嗰刻會中斷組字、
  // 收埋鍵盤（「每打一字就彈走輸入法／打唔到字」）。
  // 而家文字 100% 以 DOM（ref.current.value）為準；字數同送出掣狀態用 ref 直接改 DOM，
  // 完全唔行 React state，所以打字途中個 subtree 一次都唔會 re-render。
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const countRef = useRef<HTMLSpanElement | null>(null)
  const sendRef = useRef<HTMLSpanElement | null>(null)

  // 依家嘅輸入內容 → 即時更新「字數」同「送出掣」可否撳（純 DOM，唔 setState）
  const syncUi = () => {
    const v = ref.current?.value ?? ''
    const has = v.trim().length > 0
    if (countRef.current) {
      countRef.current.textContent = has
        ? `${approxWords(v)} 字 · ~${approxTokens(v)} tokens`
        : ''
    }
    if (sendRef.current) {
      sendRef.current.style.opacity = has ? '1' : '0.4'
      sendRef.current.style.pointerEvents = has ? 'auto' : 'none'
    }
  }

  useEffect(() => {
    const el = ref.current
    if (el) el.value = seed.text
    syncUi()
    requestAnimationFrame(() => {
      const node = ref.current
      if (!node) return
      node.focus()
      node.selectionStart = node.selectionEnd = node.value.length
    })
    // 只喺 seed.n（父組件信號）變先載入；唔包 seed.text 入 deps 係刻意。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed.n])

  const submit = () => {
    const el = ref.current
    const t = (el?.value ?? '').trim()
    if (!t || busy) return
    onSend(t)
    if (el) el.value = ''
    syncUi()
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // 中文 IME 組字中（揀緊候選字）唔好攔截 Enter
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="sticky bottom-0 rounded-3xl border border-slate-200/80 bg-white p-2 shadow-sm transition focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/20 dark:border-slate-700/70 dark:bg-slate-800 dark:shadow-none">
      {/* ⚠️ iOS Safari：input/textarea font-size < 16px 會喺 focus 自動放大頁面，
         每次 focus 都引起 viewport zoom → 用戶見到「跳一跳」。所以手機強制 ≥16px。
         desktop (sm:) 先回到原本嘅 13.5px 設計尺寸。 */}
      <Textarea
        ref={ref}
        rows={2}
        className="resize-none border-0 bg-transparent px-2.5 py-1.5 text-[16px] leading-relaxed shadow-none focus:ring-0 sm:text-[13.5px] dark:bg-transparent"
        placeholder={`打你想問嘅嘢…（Enter 送出 · Shift+Enter 換行 · ${MOD}/ 範本）`}
        defaultValue={seed.text}
        onInput={syncUi}
        onKeyDown={onKeyDown}
        disabled={busy}
      />
      <div className="flex items-center gap-1 px-0.5 pt-1">
        <Tooltip label={`範本庫（${MOD}/）`}>
          <IconButton label="範本庫" size="sm" onClick={onOpenTemplate}>
            <Library size={16} />
          </IconButton>
        </Tooltip>
        <Tooltip label="連結上下文">
          <IconButton label="上下文" size="sm" active={contextCount > 0} onClick={onOpenContext}>
            <Paperclip size={16} />
          </IconButton>
        </Tooltip>
        <span
          ref={countRef}
          className="ml-1 text-[11px] tabular-nums text-slate-400 empty:hidden dark:text-slate-500"
        />
        <div className="flex-1" />
        {busy ? (
          <Button variant="secondary" size="sm" icon={Square} onClick={onStop}>
            停止
          </Button>
        ) : (
          <span ref={sendRef} style={{ opacity: 0.4, pointerEvents: 'none' }}>
            <Button size="sm" iconRight={Send} onClick={submit}>
              送出
            </Button>
          </span>
        )}
      </div>
    </div>
  )
})

function ThreadGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function ThreadRow({
  title,
  active,
  pinned,
  archived,
  count,
  onClick,
  onPin,
  onArchive,
  onRename,
  onDelete,
}: {
  title: string
  active: boolean
  pinned: boolean
  archived: boolean
  count: number
  onClick: () => void
  onPin: () => void
  onArchive: () => void
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={active ? 'true' : undefined}
      aria-label={title}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={cx(
        'group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
        active
          ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60',
      )}
    >
      {pinned ? <Pin size={13} className="shrink-0 fill-current" /> : <span className="w-[13px] shrink-0" />}
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <span className="shrink-0 text-[10px] tabular-nums text-slate-400 transition group-hover:hidden">
        {count}
      </span>
      <div
        className="hidden shrink-0 items-center gap-0.5 group-hover:flex"
        onClick={(e) => e.stopPropagation()}
      >
        <Menu
          trigger={
            <span
              aria-label="對話選項"
              className="rounded p-0.5 text-slate-400 hover:bg-black/5 hover:text-slate-600 dark:hover:bg-white/10"
            >
              <ChevronDown size={13} />
            </span>
          }
          items={[
            { id: 'pin', label: pinned ? '取消置頂' : '置頂', icon: pinned ? PinOff : Pin, onSelect: onPin },
            { id: 'rename', label: '重新命名', icon: Pencil, onSelect: onRename },
            { id: 'archive', label: archived ? '取消封存' : '封存', icon: archived ? ArchiveRestore : Archive, onSelect: onArchive },
            { id: 'delete', label: '刪除', icon: Trash2, onSelect: onDelete, tone: 'danger' },
          ]}
        />
      </div>
    </div>
  )
}

function Welcome({
  greeting,
  tagline,
  templates,
  onPick,
  onOpenLibrary,
}: {
  greeting: string
  tagline: string
  templates: BuiltinTemplate[]
  onPick: (t: BuiltinTemplate) => void
  onOpenLibrary: () => void
}) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-6 px-2 py-6 text-center sm:py-8">
      <div className="flex flex-col items-center gap-4">
        <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong shadow-sm shadow-accent/20 dark:bg-accent/15 dark:text-accent dark:shadow-none">
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-accent ring-1 ring-accent/20 dark:bg-slate-800 dark:ring-accent/30">
            <Sparkles size={11} className="fill-current" />
          </span>
          <Bot size={30} strokeWidth={1.75} />
        </span>
        <div className="space-y-2">
          <p className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            你好，{greeting}
          </p>
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            想由邊度開始？揀一個落手位，或者直接打你想問嘅嘢。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
            {tagline.split(/\s*·\s*/).map((part) => (
              <span
                key={part}
                className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              >
                {part}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full">
        <div className="mb-2.5 flex items-center gap-2 px-0.5 text-left">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            試吓問我
          </span>
          <span className="h-px flex-1 bg-slate-200/70 dark:bg-slate-700/60" />
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          {templates.map((t, idx) => {
            const tone = WELCOME_TONES[idx % WELCOME_TONES.length]
            return (
              <button
                key={t.id}
                onClick={() => onPick(t)}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 text-left shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none dark:hover:border-accent/50"
              >
                <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition duration-200 group-hover:scale-105', tone)}>
                  <Sparkles size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">{t.title}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-400 dark:text-slate-500">{t.category}</span>
                </span>
                <CornerDownLeft size={14} className="shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100 dark:text-slate-600" />
              </button>
            )
          })}
        </div>
      </div>

      <button
        onClick={onOpenLibrary}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-accent"
      >
        <Library size={14} /> 睇晒全部範本
      </button>
    </div>
  )
}

// 歡迎區 chip 的分類色（輪流用，避免一式一樣的灰底 grid）
const WELCOME_TONES = [
  'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
  'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
]

function MessageBubble({
  msg,
  streaming,
  isLast,
  canRegen,
  onCopy,
  onRegen,
  onEdit,
  onDelete,
  onSaveNote,
}: {
  msg: AiMessage
  streaming?: boolean
  isLast: boolean
  canRegen: boolean
  onCopy: () => void
  onRegen: () => void
  onEdit: (text: string) => void
  onDelete: () => void
  onSaveNote: () => void
}) {
  const isUser = msg.role === 'user'
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(msg.content)
  const [copied, setCopied] = useState(false)

  const doCopy = () => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  if (editing) {
    return (
      <div className="flex justify-end">
        <div className="w-full max-w-[88%] space-y-2 rounded-2xl border border-accent/40 bg-white p-2.5 shadow-sm ring-1 ring-accent/10 dark:bg-slate-800 dark:shadow-none">
          <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus className="text-sm" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setDraft(msg.content); setEditing(false) }}>
              取消
            </Button>
            <Button size="sm" icon={Send} onClick={() => { setEditing(false); onEdit(draft) }}>
              重發
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const waiting = streaming && msg.content.length === 0

  return (
    <div className={cx('group flex flex-col gap-1.5', isUser ? 'items-end' : 'items-start')}>
      <div className={cx('flex max-w-[88%] items-start gap-2.5', isUser ? 'flex-row-reverse' : 'w-full')}>
        <span
          className={cx(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
            isUser
              ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
              : 'bg-accent-soft text-accent-strong ring-1 ring-accent/15 dark:bg-accent/15 dark:text-accent dark:ring-accent/20',
          )}
        >
          {isUser ? '你' : <Bot size={16} />}
        </span>
        <div className="min-w-0">
          <span
            className={cx(
              'mb-1 block px-1 text-[11px] font-medium text-slate-400 dark:text-slate-500',
              isUser ? 'text-right' : 'text-left',
            )}
          >
            {isUser ? '你' : 'AI 助手'}
          </span>
          <div
            className={
              isUser
                ? 'max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-accent px-4 py-2.5 text-[13.5px] leading-relaxed text-white shadow-sm shadow-accent/20 dark:shadow-none'
                : 'min-w-0 max-w-full overflow-hidden break-words rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-4 py-3 text-slate-700 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-100 dark:shadow-none'
            }
          >
            {isUser ? (
              msg.content
            ) : waiting ? (
              <TypingDots />
            ) : (
              <>
                <Markdown text={msg.content} />
                {streaming && (
                  <span className="ml-0.5 inline-block h-3.5 w-[3px] animate-pulse rounded-full bg-accent align-[-0.1em]" />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 行動列 */}
      {!streaming && (
        <div
          className={cx(
            // 一直可見（觸控裝置冇 hover）：靜止時於桌面淡淡地，hover / 鍵盤聚焦變實
            'flex items-center gap-0.5 opacity-100 transition focus-within:opacity-100 [@media(hover:hover)]:opacity-50 [@media(hover:hover)]:group-hover:opacity-100',
            isUser ? 'pr-1' : 'pl-[42px]',
          )}
        >
          <Tooltip label={copied ? '已複製' : '複製'}>
            <IconButton label="複製" size="sm" onClick={doCopy}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </IconButton>
          </Tooltip>
          {!isUser && (
            <Tooltip label="加入筆記">
              <IconButton label="加入筆記" size="sm" onClick={onSaveNote}>
                <StickyNote size={13} />
              </IconButton>
            </Tooltip>
          )}
          {isUser && (
            <Tooltip label="編輯重發">
              <IconButton label="編輯" size="sm" onClick={() => { setDraft(msg.content); setEditing(true) }}>
                <Pencil size={13} />
              </IconButton>
            </Tooltip>
          )}
          {canRegen && (
            <Tooltip label="重新生成">
              <IconButton label="重新生成" size="sm" onClick={onRegen}>
                <RefreshCw size={13} />
              </IconButton>
            </Tooltip>
          )}
          {isLast && (
            <Tooltip label="由此刪除">
              <IconButton label="刪除" size="sm" tone="danger" onClick={onDelete}>
                <Trash2 size={13} />
              </IconButton>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  )
}

// 等 AI 開始回覆時的柔和「打緊字」點動
function TypingDots() {
  return (
    <span className="flex items-center gap-1.5 py-0.5" aria-label="AI 正在輸入">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 animate-bounce rounded-full bg-accent/50 dark:bg-accent/60"
          style={{ animationDelay: `${i * 0.16}s`, animationDuration: '1s' }}
        />
      ))}
    </span>
  )
}

// ───────── 加入筆記 Modal（揀筆記本後存做個人筆記）─────────
function SaveNoteModal({
  open,
  content,
  notebooks,
  onClose,
  onSave,
}: {
  open: boolean
  content: string
  notebooks: Notebook[]
  onClose: () => void
  onSave: (notebookId: string | null) => void
}) {
  // 預設揀「未分類」；每次開彈窗都重設
  const [nbId, setNbId] = useState<string | null>(null)
  useEffect(() => {
    if (open) setNbId(null)
  }, [open])

  const options: { id: string | null; name: string; color: string }[] = [
    { id: null, name: '未分類', color: 'slate' },
    ...notebooks.map((n) => ({ id: n.id, name: n.name, color: n.color })),
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="加入筆記"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button icon={StickyNote} onClick={() => onSave(nbId)}>
            存入筆記
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">存入邊本筆記</p>
          <div className="flex flex-wrap gap-1.5">
            {options.map((o) => {
              const on = nbId === o.id
              const c = folderColorOf(o.color)
              return (
                <button
                  key={o.id ?? '__none'}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setNbId(o.id)}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    on
                      ? 'border-accent bg-accent-soft text-accent-strong dark:border-accent/50 dark:bg-accent/15 dark:text-accent'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  <span aria-hidden="true" className={cx('h-2 w-2 rounded-full', c.dot)} />
                  {o.name}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            內容預覽 · 會自動加上 <span className="font-semibold text-accent">#AI助手</span> 標籤
          </p>
          <div className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
            {content}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ───────── 範本庫 Modal ─────────
function TemplateLibrary({
  open,
  onClose,
  initialFill,
  mode,
  custom,
  onUse,
  toast,
  confirm,
}: {
  open: boolean
  onClose: () => void
  /** 開庫時若帶此範本（且含變數），直接跳去「填寫」表單，唔使再喺 grid 揀多次。 */
  initialFill?: { title: string; body: string } | null
  mode: ModeId
  custom: import('./aiAssistant/types').PromptTemplate[]
  onUse: (text: string) => void
  toast: ReturnType<typeof useToast>
  confirm: ReturnType<typeof useConfirm>
}) {
  const [tab, setTab] = useState<'builtin' | 'custom'>('builtin')
  const [q, setQ] = useState('')
  const [varFor, setVarFor] = useState<{ title: string; body: string } | null>(null)
  const [varValues, setVarValues] = useState<Record<string, string>>({})

  // 外部要求直接填寫某範本（Welcome chip 帶變數）：開庫即跳「填寫」子畫面。
  // 用 useLayoutEffect 喺 paint 前 set 好 varFor，避免閃一閃 grid。
  useLayoutEffect(() => {
    if (!open || !initialFill) return
    const vars = extractVars(initialFill.body)
    if (vars.length === 0) return
    setVarFor({ title: initialFill.title, body: initialFill.body })
    setVarValues(Object.fromEntries(vars.map((v) => [v, ''])))
    // initialFill 由父組件以 state 持有（穩定 ref），open 切換時先觸發。
  }, [open, initialFill])

  // 新增自訂範本
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')

  const builtins = useMemo(() => {
    const all = builtinTemplates(mode)
    const k = q.trim().toLowerCase()
    return k ? all.filter((t) => (t.title + t.body + t.category).toLowerCase().includes(k)) : all
  }, [mode, q])

  const mine = useMemo(() => {
    const k = q.trim().toLowerCase()
    return custom
      .filter((t) => t.mode === mode || t.mode === 'both')
      .filter((t) => (!k ? true : (t.title + t.body).toLowerCase().includes(k)))
      .sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0))
  }, [custom, mode, q])

  function pick(title: string, body: string, id?: string) {
    if (id) {
      const cur = promptTemplatesCol.get().find((t) => t.id === id)
      promptTemplatesCol.update(id, { uses: (cur?.uses ?? 0) + 1 })
    }
    const vars = extractVars(body)
    if (vars.length > 0) {
      setVarFor({ title, body })
      setVarValues(Object.fromEntries(vars.map((v) => [v, ''])))
    } else {
      onUse(body)
    }
  }

  function saveNew() {
    const t = newTitle.trim()
    const b = newBody.trim()
    if (!t || !b) {
      toast.error('標題同內容都要填')
      return
    }
    promptTemplatesCol.add({
      mode,
      title: t,
      body: b,
      category: '自訂',
      createdAt: new Date().toISOString(),
      uses: 0,
    })
    setNewTitle('')
    setNewBody('')
    setCreating(false)
    toast.success('已加範本')
  }

  async function delTpl(id: string) {
    const ok = await confirm({ title: '刪除呢個範本？', tone: 'danger', confirmText: '刪除' })
    if (ok) {
      promptTemplatesCol.remove(id)
      toast.success('已刪除')
    }
  }

  // 變數填寫子畫面
  if (varFor) {
    const vars = extractVars(varFor.body)
    return (
      <Modal
        open={open}
        onClose={() => { setVarFor(null); onClose() }}
        title={`填寫：${varFor.title}`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setVarFor(null)}>返範本</Button>
            <Button
              icon={Check}
              onClick={() => {
                onUse(fillTemplate(varFor.body, varValues))
                setVarFor(null)
              }}
            >
              插入
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {vars.map((v) => (
            <Field key={v} label={v}>
              {v.length > 6 || /答案|內容|筆記|解釋/.test(v) ? (
                <Textarea
                  rows={3}
                  value={varValues[v] ?? ''}
                  onChange={(e) => setVarValues((p) => ({ ...p, [v]: e.target.value }))}
                />
              ) : (
                <Input
                  value={varValues[v] ?? ''}
                  onChange={(e) => setVarValues((p) => ({ ...p, [v]: e.target.value }))}
                />
              )}
            </Field>
          ))}
          <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
            <span className="font-medium">預覽：</span>
            <p className="mt-1 whitespace-pre-wrap break-words">
              {fillTemplate(varFor.body, varValues) || '（填寫上面欄位）'}
            </p>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Prompt 範本庫" size="lg">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={[
              { id: 'builtin', label: '內建' },
              { id: 'custom', label: `我的 (${mine.length})` },
            ]}
          />
          <Input
            icon={Search}
            className="flex-1 py-1.5 text-base sm:text-xs"
            placeholder="搜尋範本…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {tab === 'builtin' ? (
          <div className="grid max-h-[50vh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
            {builtins.map((t) => (
              <TemplateCard key={t.id} title={t.title} body={t.body} category={t.category} onUse={() => pick(t.title, t.body)} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {creating ? (
              <div className="space-y-2 rounded-xl border border-accent/30 bg-accent-soft/40 p-3 dark:bg-accent/10">
                <Input placeholder="範本標題" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                <Textarea
                  rows={3}
                  placeholder="範本內容（可用 {{變數}} 做佔位，例如：解釋 {{概念}}）"
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>取消</Button>
                  <Button size="sm" icon={Check} onClick={saveNew}>儲存</Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" size="sm" icon={Plus} onClick={() => setCreating(true)}>
                新增自訂範本
              </Button>
            )}

            {mine.length === 0 && !creating ? (
              <EmptyState icon={Library} title="仲未有自訂範本" hint="將你常用嘅 prompt 存起，下次一 click 即用。" />
            ) : (
              <div className="grid max-h-[42vh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                {mine.map((t) => (
                  <TemplateCard
                    key={t.id}
                    title={t.title}
                    body={t.body}
                    category={t.uses ? `用過 ${t.uses} 次` : '自訂'}
                    onUse={() => pick(t.title, t.body, t.id)}
                    onDelete={() => void delTpl(t.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

function TemplateCard({
  title,
  body,
  category,
  onUse,
  onDelete,
}: {
  title: string
  body: string
  category: string
  onUse: () => void
  onDelete?: () => void
}) {
  const hasVars = body.includes('{{')
  return (
    <Card className="group flex flex-col p-3" hover>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
        {onDelete && (
          <IconButton label="刪除" size="sm" tone="danger" onClick={onDelete}>
            <Trash2 size={13} />
          </IconButton>
        )}
      </div>
      <p className="mt-1 line-clamp-2 flex-1 text-xs text-slate-400">{body.replace(/\{\{|\}\}/g, '')}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
          {hasVars && <Badge tone="blue">含變數</Badge>}
          <span>{category}</span>
        </span>
        <Button size="sm" variant="secondary" onClick={onUse}>插入</Button>
      </div>
    </Card>
  )
}

// ───────── 上下文選擇 Modal ─────────
function ContextPicker({
  open,
  onClose,
  current,
  onChange,
  mode,
  toast,
}: {
  open: boolean
  onClose: () => void
  current: ContextRef[]
  onChange: (c: ContextRef[]) => void
  mode: ModeId
  toast: ReturnType<typeof useToast>
}) {
  const notes = useCollection(richNotesCol)
  const meetings = useCollection(meetingNotesCol)
  const journals = useCollection(journalDocsCol)
  const [tab, setTab] = useState<'note' | 'meeting' | 'journal' | 'text'>(
    mode === 'work' ? 'meeting' : 'note',
  )
  const [freeTitle, setFreeTitle] = useState('')
  const [freeBody, setFreeBody] = useState('')
  const [q, setQ] = useState('')

  const has = (id: string) => current.some((c) => c.id === id)
  function toggle(ref: ContextRef) {
    if (has(ref.id)) onChange(current.filter((c) => c.id !== ref.id))
    else onChange([...current, ref])
  }

  function addFree() {
    const b = freeBody.trim()
    if (!b) {
      toast.error('內容唔可以空白')
      return
    }
    onChange([
      ...current,
      { id: `text-${Date.now()}`, kind: 'text', title: freeTitle.trim() || '自由文字', content: b },
    ])
    setFreeTitle('')
    setFreeBody('')
    toast.success('已加上下文')
  }

  const filt = (s: string) => !q.trim() || s.toLowerCase().includes(q.trim().toLowerCase())

  return (
    <Modal open={open} onClose={onClose} title="連結上下文資料" size="lg">
      <p className="mb-3 text-xs text-slate-400">
        揀啲筆記 / 紀錄做參考，AI 回答時會優先扣連呢啲內容。已揀 {current.length} 份。
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          size="sm"
          options={[
            { id: 'note', label: '筆記', icon: StickyNote },
            { id: 'meeting', label: '會議', icon: Users },
            { id: 'journal', label: '日誌', icon: BookOpen },
            { id: 'text', label: '自由文字', icon: Pencil },
          ]}
        />
        {tab !== 'text' && (
          <Input icon={Search} className="flex-1 py-1.5 text-base sm:text-xs" placeholder="搜尋…" value={q} onChange={(e) => setQ(e.target.value)} />
        )}
      </div>

      <div className="max-h-[46vh] space-y-1.5 overflow-y-auto">
        {tab === 'note' &&
          (() => {
            const activeNotes = notes.filter((n) => !n.archived && !n.trashed)
            return activeNotes.length === 0 ? (
              <EmptyState icon={StickyNote} title="未有筆記" />
            ) : (
              activeNotes
                .filter((n) => filt(deriveTitle(n) + n.content))
                .map((n) => {
                  const title = deriveTitle(n)
                  return (
                    <ContextItem
                      key={n.id}
                      selected={has(n.id)}
                      title={title}
                      preview={snippet(n.content) || title}
                      onToggle={() => toggle({ id: n.id, kind: 'note', title, content: n.content })}
                    />
                  )
                })
            )
          })()}

        {tab === 'meeting' &&
          (meetings.length === 0 ? (
            <EmptyState icon={Users} title="未有會議紀錄" />
          ) : (
            meetings
              .filter((m) => filt(m.title + m.content))
              .map((m) => (
                <ContextItem
                  key={m.id}
                  selected={has(m.id)}
                  title={m.title}
                  preview={m.content}
                  onToggle={() => toggle({ id: m.id, kind: 'meeting', title: m.title, content: `${m.title}\n${m.content}` })}
                />
              ))
          ))}

        {tab === 'journal' &&
          (journals.length === 0 ? (
            <EmptyState icon={BookOpen} title="未有日誌" />
          ) : (
            journals
              .filter((j) => filt(`${j.date} ${j.title ?? ''} ${j.content}`))
              .map((j) => (
                <ContextItem
                  key={j.id}
                  selected={has(j.id)}
                  title={`${j.date}${j.mood ? ` · ${j.mood}` : ''}`}
                  preview={j.content}
                  onToggle={() => toggle({ id: j.id, kind: 'journal', title: `日誌 ${j.date}`, content: j.content })}
                />
              ))
          ))}

        {tab === 'text' && (
          <div className="space-y-2">
            <Input placeholder="標題（選填）" value={freeTitle} onChange={(e) => setFreeTitle(e.target.value)} />
            <Textarea rows={5} placeholder="貼上你想 AI 參考嘅文字…" value={freeBody} onChange={(e) => setFreeBody(e.target.value)} />
            <Button size="sm" icon={Plus} onClick={addFree}>加入上下文</Button>
          </div>
        )}
      </div>

      {current.length > 0 && (
        <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
          <p className="mb-1.5 text-[11px] font-medium text-slate-400">已選：</p>
          <div className="flex flex-wrap gap-1.5">
            {current.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent-strong dark:bg-accent/15 dark:text-accent">
                {c.title}
                <button type="button" onClick={() => onChange(current.filter((x) => x.id !== c.id))} aria-label={`移除：${c.title}`}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

function ContextItem({
  selected,
  title,
  preview,
  onToggle,
}: {
  selected: boolean
  title: string
  preview: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cx(
        'flex w-full items-start gap-2 rounded-lg border p-2.5 text-left transition',
        selected
          ? 'border-accent bg-accent-soft dark:border-accent/50 dark:bg-accent/15'
          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600',
      )}
    >
      <span
        className={cx(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
          selected ? 'border-accent bg-accent text-white' : 'border-slate-300 dark:border-slate-600',
        )}
      >
        {selected && <Check size={11} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-400">{preview.replace(/\n/g, ' ').slice(0, 80)}</span>
      </span>
    </button>
  )
}

// ───────── 統計 Modal ─────────
function StatsModal({
  open,
  onClose,
  stats,
  mode,
}: {
  open: boolean
  onClose: () => void
  stats: ReturnType<typeof computeStats>
  mode: ModeId
}) {
  return (
    <Modal open={open} onClose={onClose} title={`用量統計 · ${mode === 'work' ? '工作' : '個人'}模式`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="對話數" value={stats.threads} icon={Bot} />
          <StatCard label="我問" value={stats.userMsgs} hint="條訊息" />
          <StatCard label="AI 答" value={stats.modelMsgs} hint="條訊息" highlight />
          <StatCard
            label="連續活躍"
            value={stats.streak}
            unit="日"
            trend={stats.streak > 0 ? { value: '🔥', dir: 'up' } : undefined}
          />
        </div>

        <Card padded>
          <SectionTitle icon={BarChart3} right={stats.busiestDay ? <span className="text-[11px] text-slate-400">最忙 {stats.busiestDay.label}（{stats.busiestDay.count}）</span> : undefined}>
            近 14 日活躍
          </SectionTitle>
          <ActivityBars data={stats.daily} />
        </Card>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card padded>
            <SectionTitle>我 / AI 訊息比例</SectionTitle>
            <RatioBar user={stats.userMsgs} model={stats.modelMsgs} />
          </Card>
          <Card padded>
            <SectionTitle>其他</SectionTitle>
            <div className="space-y-2 text-sm">
              <Row label="總字數（約）" value={stats.totalWords.toLocaleString()} />
              <Row label="每對話平均訊息" value={String(stats.avgPerThread)} />
            </div>
          </Card>
        </div>
      </div>
    </Modal>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{value}</span>
    </div>
  )
}

// ───────── 重新命名 Modal ─────────
function RenameModal({
  threadId,
  currentTitle,
  onClose,
  onSave,
}: {
  threadId: string | null
  currentTitle: string
  onClose: () => void
  onSave: (title: string) => void
}) {
  const [val, setVal] = useState(currentTitle)
  useEffect(() => setVal(currentTitle), [currentTitle, threadId])
  return (
    <Modal
      open={!!threadId}
      onClose={onClose}
      title="重新命名對話"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button icon={Check} onClick={() => onSave(val.trim() || currentTitle)} disabled={!val.trim()}>
            儲存
          </Button>
        </>
      }
    >
      <Input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSave(val.trim() || currentTitle) }}
        placeholder="對話名稱"
      />
    </Modal>
  )
}

// ───────── 命令面板（⌘K）─────────
function CommandPalette({
  open,
  onClose,
  threads,
  actions,
  onSelectThread,
}: {
  open: boolean
  onClose: () => void
  threads: { id: string; title: string }[]
  actions: { id: string; label: string; icon: import('lucide-react').LucideIcon; run: () => void }[]
  onSelectThread: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setHi(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const k = q.trim().toLowerCase()
  const actItems = actions
    .filter((a) => !k || a.label.toLowerCase().includes(k))
    .map((a) => ({ type: 'action' as const, ...a }))
  const threadItems = threads
    .filter((t) => !k || t.title.toLowerCase().includes(k))
    .slice(0, 8)
    .map((t) => ({ type: 'thread' as const, id: t.id, label: t.title }))
  const flat = [...actItems, ...threadItems]
  const clampedHi = Math.min(hi, Math.max(0, flat.length - 1))

  function run(i: number) {
    const item = flat[i]
    if (!item) return
    if (item.type === 'action') {
      item.run()
      onClose()
    } else {
      onSelectThread(item.id)
    }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg animate-scale-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-overlay dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 dark:border-slate-700">
          <Command size={16} className="text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setHi(0) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, flat.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
              else if (e.key === 'Enter') { e.preventDefault(); run(clampedHi) }
              else if (e.key === 'Escape') onClose()
            }}
            placeholder="搵指令或對話…"
            className="flex-1 bg-transparent py-3 text-base sm:text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {flat.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">搵唔到嘢</p>
          ) : (
            <>
              {actItems.length > 0 && <PaletteLabel>指令</PaletteLabel>}
              {actItems.map((a, i) => (
                <PaletteRow key={a.id} active={i === clampedHi} icon={a.icon} label={a.label} onClick={() => run(i)} onHover={() => setHi(i)} />
              ))}
              {threadItems.length > 0 && <PaletteLabel>對話</PaletteLabel>}
              {threadItems.map((t, i) => {
                const idx = actItems.length + i
                return (
                  <PaletteRow key={t.id} active={idx === clampedHi} icon={MessageSquarePlus} label={t.label} onClick={() => run(idx)} onHover={() => setHi(idx)} />
                )
              })}
            </>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-slate-200 px-3 py-1.5 text-[11px] text-slate-400 dark:border-slate-700">
          <span className="inline-flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> 移動</span>
          <span className="inline-flex items-center gap-1"><Kbd>↵</Kbd> 選擇</span>
        </div>
      </div>
    </div>
  )
}

function PaletteLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{children}</p>
}

function PaletteRow({
  active,
  icon: I,
  label,
  onClick,
  onHover,
}: {
  active: boolean
  icon: import('lucide-react').LucideIcon
  label: string
  onClick: () => void
  onHover: () => void
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      className={cx(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition',
        active ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent' : 'text-slate-600 dark:text-slate-300',
      )}
    >
      <I size={15} className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  )
}
