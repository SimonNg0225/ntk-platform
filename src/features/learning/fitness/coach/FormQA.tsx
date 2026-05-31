import { useEffect, useRef, useState } from 'react'
import { Button, IconButton, Textarea, cx } from '../../../../ui'
import {
  Bot,
  Send,
  Square,
  Trash2,
  CornerDownLeft,
  Sparkles,
} from 'lucide-react'
import { streamChat, type AIModel, type AIMessage } from '../../../../lib/aiClient'
import { useToast } from '../../../../context/ToastContext'

// ============================================================
//  工具二：動作姿勢問答（串流對話）
//  ------------------------------------------------------------
//  system 設定「專業健身教練，安全為先，繁體中文」。
//  streamChat 逐段 yield → 打字效果（pulse cursor）。可中止。
//  純即時對話，唔落地（離開即清）。
// ============================================================

const SYSTEM =
  '你係一位專業健身教練，專長動作技術同運動安全。回答健身動作姿勢問題時：安全永遠擺第一；用繁體中文（可用書面廣東話）；分點講「常見錯誤 → 點解危險 → 點樣改正 → 退階/輔助練習」；具體、實用、簡潔。如果問題涉及痛症或受傷，提醒對方有需要要睇專業醫療人員，唔好當醫療診斷。'

const SUGGESTIONS = [
  '深蹲時膝蓋內扣，點改？',
  '硬舉腰會痠，係咪姿勢錯？',
  '臥推點先唔會傷膊頭？',
  '引體上升做唔到，有咩退階練習？',
]

interface ChatMsg {
  id: string
  role: 'user' | 'model'
  content: string
}

let _seq = 0
function nextId(): string {
  _seq += 1
  return `m${_seq}`
}

export default function FormQA({ model }: { model: AIModel }) {
  const toast = useToast()
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // 自動捲到底
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, streaming])

  // 卸載時中止任何串流
  useEffect(() => () => abortRef.current?.abort(), [])

  async function send(raw: string) {
    const text = raw.trim()
    if (!text || busy) return

    const history: AIMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: text },
    ]
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }])
    setInput('')

    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setStreaming('')

    let full = ''
    try {
      for await (const chunk of streamChat({
        messages: history,
        system: SYSTEM,
        model,
        signal: controller.signal,
      })) {
        full += chunk
        setStreaming(full)
      }
    } catch (e) {
      const err = e as Error
      if (err.name !== 'AbortError') toast.error(err.message || 'AI 出錯，請再試')
    } finally {
      if (full.trim()) {
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: 'model', content: full },
        ])
      }
      setBusy(false)
      setStreaming(null)
      abortRef.current = null
    }
  }

  function clearChat() {
    abortRef.current?.abort()
    setMessages([])
    setStreaming(null)
    setInput('')
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send(input)
    }
  }

  const empty = messages.length === 0 && streaming === null

  return (
    <div className="flex h-[70vh] flex-col gap-3">
      {/* 訊息區 */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-700/80 dark:bg-slate-900/40"
      >
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 px-4 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent" aria-hidden="true">
              <Bot size={32} strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                動作姿勢問答
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                問任何動作技術或安全問題，教練即時答你
              </p>
            </div>
            <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="group flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700 dark:bg-slate-800"
                >
                  <span className="mt-0.5 rounded-lg bg-slate-100 p-1.5 text-slate-400 transition group-hover:bg-accent-soft group-hover:text-accent dark:bg-slate-700" aria-hidden="true">
                    <Sparkles size={14} />
                  </span>
                  <span className="min-w-0 break-words text-xs font-medium text-slate-700 dark:text-slate-200">
                    {s}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <Bubble key={m.id} role={m.role} content={m.content} />
            ))}
            {streaming !== null && (
              <div aria-live="polite" aria-busy={busy}>
                <Bubble role="model" content={streaming} streaming />
              </div>
            )}
          </>
        )}
      </div>

      {/* 輸入區 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
        <Textarea
          rows={2}
          aria-label="向 AI 教練提問動作姿勢問題"
          className="border-0 bg-transparent px-2 py-1 shadow-none focus:ring-0 dark:bg-transparent"
          placeholder="例如：深蹲膝蓋內扣點改？（Enter 送出 · Shift+Enter 換行）"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
        />
        <div className="flex items-center gap-1.5 px-1 pt-1">
          {messages.length > 0 && (
            <IconButton label="清空對話" size="sm" tone="danger" onClick={clearChat}>
              <Trash2 size={16} />
            </IconButton>
          )}
          <div className="flex-1" />
          {busy ? (
            <Button
              variant="secondary"
              size="sm"
              icon={Square}
              onClick={() => abortRef.current?.abort()}
            >
              停止
            </Button>
          ) : (
            <Button
              size="sm"
              iconRight={CornerDownLeft}
              icon={Send}
              onClick={() => void send(input)}
              disabled={!input.trim()}
            >
              送出
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Bubble({
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
    <div className={cx('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={isUser ? 'max-w-[85%]' : 'flex w-full max-w-[90%] items-start gap-2'}>
        {!isUser && (
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent" aria-hidden="true">
            <Bot size={15} />
          </span>
        )}
        <div
          className={
            isUser
              ? 'whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-white'
              : 'min-w-0 flex-1 whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-2.5 text-sm leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
          }
        >
          {content}
          {streaming && (
            <span
              className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-current align-middle"
              aria-hidden="true"
            />
          )}
        </div>
      </div>
    </div>
  )
}
