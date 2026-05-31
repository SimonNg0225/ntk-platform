import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useMode } from '../../context/ModeContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { streamChat, isAIConfigured, type AIModel, type AIMessage } from '../../lib/aiClient'
import { aiThreadsCol, aiMessagesCol } from '../../data/collections'
import { useCollection } from '../../lib/store'
import type { ModeId } from '../../modes/modes'
import { Button, Select, Textarea, EmptyState } from '../../ui'
import { Bot, Lock, Plus, Square, Send } from 'lucide-react'

// ============================================================
//  AI 助手 — 跟模式變身嘅對話介面
//  ------------------------------------------------------------
//  學習模式：學習夥伴（解釋 / 總結 / 出練習）
//  工作模式：BAFS 教學助手（出題 / 教案 / 評語）
//  - streaming 打字效果
//  - 對話存入 ai_threads / ai_messages（會跟 Supabase 同步）
// ============================================================

const MODE_AI: Record<
  ModeId,
  { system: string; greeting: string; suggestions: string[] }
> = {
  learning: {
    system:
      '你係「NTK 學習平台」嘅 AI 學習夥伴，協助一位自學者。請用繁體中文回答（可以用書面廣東話）。風格：精簡、有條理、有重點，適當用列點同例子。如果問題太模糊，先簡短澄清再答。',
    greeting: '我係你嘅學習夥伴 👋 想我幫你解釋概念、總結筆記，定係出練習？',
    suggestions: [
      '用淺白方式解釋呢個概念：',
      '幫我總結以下筆記，列出重點：\n\n',
      '就以下主題出 5 條練習題（連答案）：',
      '幫我整理一份溫習大綱：',
    ],
  },
  work: {
    system:
      '你係「NTK 平台」嘅 BAFS（企業、會計與財務概論）教學助手，協助一位香港中學老師。可以幫手出題（連參考答案同評分指引）、寫教案大綱、擬批改評語、設計課堂活動。請用繁體中文，內容貼合香港高中 BAFS 課程，專業、實用、有條理。',
    greeting: '我係你嘅 BAFS 教學助手 💼 想我出題、寫教案，定係擬批改評語？',
    suggestions: [
      '就以下課題出 5 條 MC 題（連答案同解釋）：',
      '幫我寫一份教案大綱（課題 + 節數）：\n\n',
      '幫我擬一段批改評語（貼上學生答案）：\n\n',
      '設計一個課堂活動（課題 + 時間）：',
    ],
  },
}

const MODELS: { id: AIModel; label: string }[] = [
  { id: 'gemini-2.5-flash', label: '⚡ Flash（快）' },
  { id: 'gemini-2.5-pro', label: '🧠 Pro（強）' },
]

export default function AIAssistant() {
  const { mode } = useMode()
  const { user } = useAuth()
  const toast = useToast()

  const cfg = MODE_AI[mode]
  const threads = useCollection(aiThreadsCol)
    .filter((t) => t.mode === mode)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const allMessages = useCollection(aiMessagesCol)

  const [model, setModel] = useState<AIModel>('gemini-2.5-flash')
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const messages = allMessages
    .filter((m) => m.threadId === currentThreadId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  // 切換模式 → 重設返新對話（threads 係按模式分）
  useEffect(() => {
    setCurrentThreadId(null)
    setInput('')
    setStreaming(null)
  }, [mode])

  // 有新訊息 / streaming 時自動捲到底
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, streaming])

  function newConversation() {
    abortRef.current?.abort()
    setCurrentThreadId(null)
    setStreaming(null)
    setInput('')
    inputRef.current?.focus()
  }

  function applySuggestion(text: string) {
    setInput(text)
    inputRef.current?.focus()
  }

  async function send(raw: string) {
    const text = raw.trim()
    if (!text || busy) return

    let threadId = currentThreadId
    if (!threadId) {
      const t = aiThreadsCol.add({
        mode,
        title: text.slice(0, 30),
        createdAt: new Date().toISOString(),
      })
      threadId = t.id
      setCurrentThreadId(t.id)
    }

    aiMessagesCol.add({
      threadId,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    })
    setInput('')

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
        system: cfg.system,
        model,
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
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send(input)
    }
  }

  // ── 未啟用 / 未登入 守門 ──────────────────────────────────
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

  const showWelcome = messages.length === 0 && streaming === null

  return (
    <div className="flex h-[70vh] flex-col gap-3">
      {/* 工具列：model + 對話歷史 + 新對話 */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="w-auto"
          value={model}
          onChange={(e) => setModel(e.target.value as AIModel)}
          aria-label="選擇模型"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>

        {threads.length > 0 && (
          <Select
            className="w-auto max-w-[12rem]"
            value={currentThreadId ?? ''}
            onChange={(e) => setCurrentThreadId(e.target.value || null)}
            aria-label="對話歷史"
          >
            <option value="">（新對話）</option>
            {threads.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </Select>
        )}

        <div className="flex-1" />
        <Button variant="secondary" size="sm" icon={Plus} onClick={newConversation}>
          新對話
        </Button>
      </div>

      {/* 訊息區 */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-700/80 dark:bg-slate-900/40"
      >
        {showWelcome ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
              <Bot size={28} strokeWidth={1.75} />
            </span>
            <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
              {cfg.greeting}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {cfg.suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => applySuggestion(s)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-accent hover:text-accent dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {s.replace(/[:：]\s*$/, '').split('\n')[0]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} content={m.content} />
            ))}
            {streaming !== null && (
              <MessageBubble role="model" content={streaming} streaming />
            )}
          </>
        )}
      </div>

      {/* 輸入區 */}
      <div className="flex items-end gap-2">
        <Textarea
          ref={inputRef}
          rows={2}
          className="flex-1"
          placeholder="打你想問嘅嘢…（Enter 送出，Shift+Enter 換行）"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onInputKeyDown}
          disabled={busy}
        />
        {busy ? (
          <Button
            variant="secondary"
            icon={Square}
            onClick={() => abortRef.current?.abort()}
          >
            停止
          </Button>
        ) : (
          <Button icon={Send} onClick={() => void send(input)} disabled={!input.trim()}>
            送出
          </Button>
        )}
      </div>
    </div>
  )
}

function MessageBubble({
  role,
  content,
  streaming,
}: {
  role: 'user' | 'model'
  content: string
  streaming?: boolean
}) {
  const isUser = role === 'user'
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={
          isUser
            ? 'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-white'
            : 'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
        }
      >
        {content}
        {streaming && (
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-current align-middle" />
        )}
      </div>
    </div>
  )
}
