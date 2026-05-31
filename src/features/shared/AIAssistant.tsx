import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useMode } from '../../context/ModeContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  streamChat,
  isAIConfigured,
  type AIModel,
  type AIMessage,
} from '../../lib/aiClient'
import {
  aiThreadsCol,
  aiMessagesCol,
  notesCol,
  meetingNotesCol,
  journalCol,
} from '../../data/collections'
import type { AiMessage } from '../../data/types'
import { useCollection } from '../../lib/store'
import type { ModeId } from '../../modes/modes'
import {
  Button,
  IconButton,
  Input,
  Select,
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
      '你係「NTK 學習平台」嘅 AI 學習夥伴，協助一位自學者。請用繁體中文回答（可以用書面廣東話）。風格：精簡、有條理、有重點，適當用列點同例子。如果問題太模糊，先簡短澄清再答。可以用 Markdown（標題、列點、表格、程式碼區塊）令答案更清楚。',
    greeting: '我係你嘅學習夥伴',
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

  const cfg = MODE_AI[mode]

  // ── 共用 source of truth ──
  const allThreads = useCollection(aiThreadsCol)
  const allMessages = useCollection(aiMessagesCol)
  const allMeta = useCollection(threadMetaCol)
  const customTemplates = useCollection(promptTemplatesCol)

  // 旁掛 meta 快查
  const metaMap = useMemo(() => {
    const m = new Map<string, ThreadMeta>()
    for (const x of allMeta) m.set(x.id, x)
    return m
  }, [allMeta])

  // ── 本地 UI 狀態 ──
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [search, setSearch] = useState('')

  // 預設模型 / 人格（未進入特定對話時用；之後寫入該 thread meta）
  const [draftModel, setDraftModel] = useState<AIModel>('gemini-2.5-flash')
  const [draftPersona, setDraftPersona] = useState<PersonaId>('default')
  const [draftTemp, setDraftTemp] = useState(0.7)
  const [draftContexts, setDraftContexts] = useState<ContextRef[]>([])

  // modal flags
  const [templateOpen, setTemplateOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

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
    setInput('')
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
        if (err.name !== 'AbortError') toast.error(err.message || 'AI 出錯')
      } finally {
        if (full.trim()) {
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
      setInput('')
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

  // ── thread 操作 ──
  function newConversation() {
    abortRef.current?.abort()
    setCurrentThreadId(null)
    setStreaming(null)
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function selectThread(id: string) {
    abortRef.current?.abort()
    setStreaming(null)
    setCurrentThreadId(id)
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

  function applyText(text: string) {
    setInput(text)
    setTimeout(() => {
      inputRef.current?.focus()
      const el = inputRef.current
      if (el) el.selectionStart = el.selectionEnd = el.value.length
    }, 0)
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

  function onInputKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send(input)
    }
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

  // ── 守門 ──
  if (!isAIConfigured) {
    return (
      <EmptyState
        icon={Bot}
        title="AI 助手未啟用"
        hint="要設定好 Supabase 並部署 gemini Edge Function 先用到。步驟見 docs/SETUP.md。"
      />
    )
  }
  if (!user) {
    return (
      <EmptyState
        icon={Lock}
        title="請先登入先可以用 AI 助手"
        hint="喺左下角用 Google 登入後就用得。"
      />
    )
  }

  const personaLabel = personaById(activePersona).label
  const modelShort = MODELS.find((m) => m.id === activeModel)?.short ?? activeModel
  const inputWords = approxWords(input)

  return (
    <div className="flex h-[78vh] gap-3">
      {/* ───────── 側欄：對話清單 ───────── */}
      {sidebarOpen && (
        <aside className="hidden w-64 shrink-0 flex-col rounded-2xl border border-slate-200/80 bg-white dark:border-slate-700/70 dark:bg-slate-800/60 sm:flex">
          <div className="space-y-2 border-b border-slate-200/70 p-2.5 dark:border-slate-700/60">
            <Button fullWidth size="sm" icon={MessageSquarePlus} onClick={newConversation}>
              新對話
            </Button>
            <Input
              icon={Search}
              className="py-1.5 text-xs"
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
                        count={allMessages.filter((m) => m.threadId === t.id).length}
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
                        count={allMessages.filter((m) => m.threadId === t.id).length}
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

          <Select
            className="w-auto py-1.5 text-xs"
            value={activeModel}
            onChange={(e) => setModel(e.target.value as AIModel)}
            aria-label="選擇模型"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>

          {/* 人格 */}
          <Menu
            align="start"
            trigger={
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                <Sparkles size={13} /> {personaLabel}
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
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 dark:border-slate-700 dark:bg-slate-800">
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
              <span className="w-6 tabular-nums text-[11px] text-slate-500">{activeTemp.toFixed(1)}</span>
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
              <span className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700">
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
          className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-700/80 dark:bg-slate-900/40"
        >
          {messages.length === 0 && streaming === null ? (
            <Welcome
              greeting={cfg.greeting}
              tagline={cfg.tagline}
              templates={builtinTemplates(mode).slice(0, 6)}
              onPick={(t) => {
                // 有變數就行範本庫表單流程；冇就直接填入
                if (t.body.includes('{{')) setTemplateOpen(true)
                else applyText(t.body)
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
                />
              ))}
              {streaming !== null && (
                <MessageBubble
                  msg={{ id: '__stream', threadId: '', role: 'model', content: streaming, createdAt: '' }}
                  streaming
                  isLast
                  canRegen={false}
                  onCopy={() => {}}
                  onRegen={() => {}}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              )}
            </>
          )}
        </div>

        {/* 上下文 chip 列（有就顯示） */}
        {activeContexts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <span className="text-[11px] text-slate-400">上下文：</span>
            {activeContexts.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent-strong dark:bg-accent/15 dark:text-accent"
              >
                <FileText size={11} />
                <span className="max-w-[10rem] truncate">{c.title}</span>
                <button
                  onClick={() => setContexts(activeContexts.filter((x) => x.id !== c.id))}
                  className="ml-0.5 rounded-full hover:bg-black/10"
                  aria-label="移除"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* 輸入區 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
          <Textarea
            ref={inputRef}
            rows={2}
            className="border-0 bg-transparent px-2 py-1 shadow-none focus:ring-0 dark:bg-transparent"
            placeholder={`打你想問嘅嘢…（Enter 送出 · Shift+Enter 換行 · ${MOD}/ 範本）`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onInputKeyDown}
            disabled={busy}
          />
          <div className="flex items-center gap-1.5 px-1 pt-1">
            <Tooltip label={`範本庫（${MOD}/）`}>
              <IconButton label="範本庫" size="sm" onClick={() => setTemplateOpen(true)}>
                <Library size={16} />
              </IconButton>
            </Tooltip>
            <Tooltip label="連結上下文">
              <IconButton label="上下文" size="sm" active={activeContexts.length > 0} onClick={() => setContextOpen(true)}>
                <Paperclip size={16} />
              </IconButton>
            </Tooltip>
            {input.trim() && (
              <span className="text-[11px] tabular-nums text-slate-400">
                {inputWords} 字 · ~{approxTokens(input)} tokens
              </span>
            )}
            <div className="flex-1" />
            {busy ? (
              <Button variant="secondary" size="sm" icon={Square} onClick={() => abortRef.current?.abort()}>
                停止
              </Button>
            ) : (
              <Button size="sm" iconRight={CornerDownLeft} onClick={() => void send(input)} disabled={!input.trim()}>
                送出
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ───────── Modals ───────── */}
      <TemplateLibrary
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        mode={mode}
        custom={customTemplates}
        onUse={(text) => {
          applyText(text)
          setTemplateOpen(false)
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
      onClick={onClick}
      className={cx(
        'group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition',
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
            <span className="rounded p-0.5 text-slate-400 hover:bg-black/5 hover:text-slate-600 dark:hover:bg-white/10">
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
    <div className="flex h-full flex-col items-center justify-center gap-5 px-4 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
        <Bot size={32} strokeWidth={1.75} />
      </span>
      <div>
        <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">{greeting}</p>
        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">{tagline}</p>
      </div>
      <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => onPick(t)}
            className="group flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
          >
            <span className="mt-0.5 rounded-lg bg-slate-100 p-1.5 text-slate-400 transition group-hover:bg-accent-soft group-hover:text-accent dark:bg-slate-700">
              <Sparkles size={14} />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">{t.title}</span>
              <span className="mt-0.5 block truncate text-[11px] text-slate-400">{t.category}</span>
            </span>
          </button>
        ))}
      </div>
      <button
        onClick={onOpenLibrary}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
      >
        <Library size={14} /> 睇晒全部範本
      </button>
    </div>
  )
}

function MessageBubble({
  msg,
  streaming,
  isLast,
  canRegen,
  onCopy,
  onRegen,
  onEdit,
  onDelete,
}: {
  msg: AiMessage
  streaming?: boolean
  isLast: boolean
  canRegen: boolean
  onCopy: () => void
  onRegen: () => void
  onEdit: (text: string) => void
  onDelete: () => void
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
        <div className="w-full max-w-[85%] space-y-2 rounded-2xl border border-accent/40 bg-white p-2 dark:bg-slate-800">
          <Textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
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

  return (
    <div className={cx('group flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      <div className={isUser ? 'flex items-start gap-2' : 'flex w-full items-start gap-2'}>
        {!isUser && (
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
            <Bot size={15} />
          </span>
        )}
        <div
          className={
            isUser
              ? 'max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-white'
              : 'min-w-0 max-w-full rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-2.5 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
          }
        >
          {isUser ? (
            msg.content
          ) : (
            <>
              <Markdown text={msg.content} />
              {streaming && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-current align-middle" />
              )}
            </>
          )}
        </div>
      </div>

      {/* 行動列 */}
      {!streaming && (
        <div
          className={cx(
            'flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100',
            isUser ? 'pr-1' : 'pl-9',
          )}
        >
          <Tooltip label={copied ? '已複製' : '複製'}>
            <IconButton label="複製" size="sm" onClick={doCopy}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </IconButton>
          </Tooltip>
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

// ───────── 範本庫 Modal ─────────
function TemplateLibrary({
  open,
  onClose,
  mode,
  custom,
  onUse,
  toast,
  confirm,
}: {
  open: boolean
  onClose: () => void
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
            className="flex-1 py-1.5 text-xs"
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
  const notes = useCollection(notesCol)
  const meetings = useCollection(meetingNotesCol)
  const journals = useCollection(journalCol)
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
          <Input icon={Search} className="flex-1 py-1.5 text-xs" placeholder="搜尋…" value={q} onChange={(e) => setQ(e.target.value)} />
        )}
      </div>

      <div className="max-h-[46vh] space-y-1.5 overflow-y-auto">
        {tab === 'note' &&
          (notes.length === 0 ? (
            <EmptyState icon={StickyNote} title="未有筆記" />
          ) : (
            notes
              .filter((n) => filt(n.content))
              .map((n) => (
                <ContextItem
                  key={n.id}
                  selected={has(n.id)}
                  title={n.content.split('\n')[0].slice(0, 40) || '（空白筆記）'}
                  preview={n.content}
                  onToggle={() => toggle({ id: n.id, kind: 'note', title: n.content.split('\n')[0].slice(0, 40) || '筆記', content: n.content })}
                />
              ))
          ))}

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
              .filter((j) => filt(j.content))
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
                <button onClick={() => onChange(current.filter((x) => x.id !== c.id))} aria-label="移除">
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
    <Modal open={open} onClose={onClose} title={`用量統計 · ${mode === 'work' ? '工作' : '學習'}模式`} size="lg">
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
            className="flex-1 bg-transparent py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
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
