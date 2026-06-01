import { useRef, useState, type KeyboardEvent } from 'react'
import {
  Bot,
  Lock,
  Send,
  Sparkles,
  Square,
  CornerDownLeft,
  User,
  AlertTriangle,
  NotebookPen,
  ListTodo,
  Target,
  CalendarDays,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { streamChat, isAIConfigured, type AIMessage } from '../../lib/aiClient'
import { useAuth } from '../../context/AuthContext'
import { useCollection } from '../../lib/store'
import {
  eventsCol,
  tasksCol,
  goalsCol,
  countdownsCol,
} from '../../data/collections'
import { richNotesCol } from '../learning/notes/store'
import { journalDocsCol } from '../learning/journal/store'
import { healthLogsCol, getGoals as getHealthGoals } from '../learning/health/store'
import { summarize as summarizeHealth } from '../learning/health/util'
import { workoutCol } from '../learning/fitness/training/store'
import { Button, EmptyState, Textarea, cx } from '../../ui'

// ============================================================
//  「問我嘅資料」AI — 全域個人助理
//  ------------------------------------------------------------
//  收集用戶跨功能資料（筆記 / 待辦 / 目標 / 日程 / 日誌）做 context，
//  經 Supabase Edge Function 問 Gemini，扼要回答。未啟用 / 未登入優雅守門。
// ============================================================

// 範例提問：撳一下即時帶入並發問。配一隻 lucide icon 暗示資料來源。
const SUGGESTIONS: { text: string; icon: LucideIcon }[] = [
  { text: '我今個星期有咩重要事？', icon: CalendarDays },
  { text: '總結我最近嘅筆記重點', icon: NotebookPen },
  { text: '我仲有咩未完成待辦？', icon: ListTodo },
  { text: '根據我嘅目標，建議下一步點做', icon: Target },
]

const SYSTEM =
  '你係用戶「NTK 平台」嘅私人 AI 助理。下面係佢嘅個人資料摘要，請主要根據呢啲資料（配合常識）用繁體中文（可書面廣東話）扼要、有條理咁回答。如果資料唔夠就照答並提一句。唔好捏造唔存在嘅具體資料。'

/** 本地時區 YYYY-MM-DD（避開 toISOString 當 UTC 嘅時差） */
function todayKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 由各 collection 砌一段精簡 context（上限約 4000 字） */
function buildContext(): string {
  const today = todayKey()
  const parts: string[] = []

  const notes = richNotesCol
    .get()
    .filter((n) => !n.trashed)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 10)
  if (notes.length)
    parts.push(
      '【最近筆記】\n' +
        notes
          .map((n) => `- ${n.title || n.content.slice(0, 40)}：${n.content.slice(0, 140).replace(/\n/g, ' ')}`)
          .join('\n'),
    )

  const tasks = tasksCol.get().filter((t) => !t.done).slice(0, 20)
  if (tasks.length)
    parts.push('【未完成待辦】\n' + tasks.map((t) => `- ${t.text}`).join('\n'))

  const goals = goalsCol.get()
  if (goals.length)
    parts.push(
      '【個人目標】\n' + goals.map((g) => `- ${g.title}（進度 ${g.progress}%）`).join('\n'),
    )

  const events = eventsCol
    .get()
    .filter((e) => (e.endDate ?? e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 12)
  if (events.length)
    parts.push(
      '【將近活動】\n' +
        events.map((e) => `- ${e.date}${e.time ? ' ' + e.time : ''} ${e.title}`).join('\n'),
    )

  const cds = countdownsCol
    .get()
    .filter((c) => c.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6)
  if (cds.length)
    parts.push('【重要日子】\n' + cds.map((c) => `- ${c.date} ${c.title}`).join('\n'))

  const journal = journalDocsCol
    .get()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
  if (journal.length)
    parts.push(
      '【近期日誌】\n' +
        journal
          .map((j) => `- ${j.date}${j.mood ? ' ' + j.mood : ''}：${j.content.slice(0, 100).replace(/\n/g, ' ')}`)
          .join('\n'),
    )

  const hlogs = healthLogsCol.get()
  if (hlogs.length) {
    const s = summarizeHealth(hlogs, getHealthGoals())
    const bits: string[] = []
    if (s.weightKg != null)
      bits.push(
        `體重 ${s.weightKg.toFixed(1)}kg${s.weightDelta7 != null ? `（近 7 日 ${s.weightDelta7 > 0 ? '+' : ''}${s.weightDelta7.toFixed(1)}）` : ''}`,
      )
    if (s.sleepAvg7 != null) bits.push(`睡眠 7 日均 ${s.sleepAvg7.toFixed(1)} 小時`)
    bits.push(`本週運動 ${s.exerciseWeek} 分鐘`)
    if (s.moodAvg7 != null) bits.push(`心情 7 日均 ${s.moodAvg7.toFixed(1)}/5`)
    if (s.streak > 0) bits.push(`連續記錄 ${s.streak} 日`)
    parts.push('【健康近況】\n' + bits.map((b) => `- ${b}`).join('\n'))
  }

  const workouts = workoutCol
    .get()
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
  if (workouts.length)
    parts.push(
      '【近期訓練】\n' +
        workouts
          .map((w) => `- ${w.date}${w.title ? ' ' + w.title : ''}（${w.exercises.length} 個動作）`)
          .join('\n'),
    )

  return parts.join('\n\n').slice(0, 4000)
}

export default function AskData() {
  const { user } = useAuth()
  // 訂閱令資料更新時 context 反映最新（亦確保 collection 已建立 / 登記）
  useCollection(richNotesCol)
  useCollection(tasksCol)

  const [q, setQ] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  // askedQuestion：已送出嘅問題（用嚟喺對話度顯示「你」嗰格），同 q 輸入框分開。
  const [askedQuestion, setAskedQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  if (!isAIConfigured) {
    return (
      <EmptyState
        icon={Bot}
        title="AI 未啟用"
        hint="要設定好 Supabase 並部署 gemini Edge Function 先用到。步驟見 docs/SETUP.md。"
      />
    )
  }
  if (!user) {
    return (
      <EmptyState
        icon={Lock}
        title="請先登入先可以用 AI"
        hint="喺左下角用 Google 登入後就用得。"
      />
    )
  }

  async function ask(question: string) {
    const text = question.trim()
    if (!text || busy) return
    setQ(text)
    setAskedQuestion(text)
    setBusy(true)
    setAnswer('')
    const controller = new AbortController()
    abortRef.current = controller
    const context = buildContext()
    const messages: AIMessage[] = [
      {
        role: 'user',
        content: `我嘅資料摘要：\n${context || '（暫時未有資料）'}\n\n問題：${text}`,
      },
    ]
    let full = ''
    try {
      for await (const chunk of streamChat({
        messages,
        system: SYSTEM,
        signal: controller.signal,
      })) {
        full += chunk
        setAnswer(full)
      }
    } catch (e) {
      const err = e as Error
      if (err.name !== 'AbortError') setAnswer(`出錯：${err.message}`)
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void ask(q)
    }
  }

  // 渲染期判斷：answer 由 ask() 設成 `出錯：…` 時當錯誤氣泡顯示（唔改邏輯）。
  const isError = answer != null && answer.startsWith('出錯：')
  const errorText = isError ? answer.replace(/^出錯：/, '') : ''
  const started = answer !== null
  const showCaret = busy && !isError

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* ── 歡迎區：柔和漸變，介紹助手做咩 ── */}
      {!started && (
        <section className="hero-gradient relative animate-fade-in-up overflow-hidden rounded-3xl px-6 py-8 text-white shadow-lg shadow-accent/25 sm:px-8 sm:py-9">
          <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 right-24 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
              <Sparkles size={13} /> 私人 AI 助理
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">
              問我關於你嘅一切
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/80">
              我會睇返你嘅筆記、待辦、目標、日程同日誌，幫你扼要解答 ——
              想知有咩重要事、想總結重點，問我就得。
            </p>
          </div>
        </section>
      )}

      {/* ── 對話區：你 / AI 兩格分明，柔和氣泡 ── */}
      {started && (
        <div className="space-y-4">
          {/* 你 */}
          {askedQuestion && (
            <div className="flex animate-fade-in-up justify-end gap-2.5">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
                {askedQuestion}
              </div>
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                <User size={16} />
              </span>
            </div>
          )}

          {/* AI */}
          <div className="flex animate-fade-in-up gap-2.5">
            <span
              className={cx(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                isError
                  ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300'
                  : 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
              )}
            >
              {isError ? <AlertTriangle size={16} /> : <Sparkles size={16} />}
            </span>

            {isError ? (
              <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-rose-200/70 bg-rose-50/70 px-4 py-3 dark:border-rose-500/30 dark:bg-rose-500/10">
                <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
                  唔好意思，啱啱有啲問題
                </p>
                <p className="mt-1 break-words text-xs leading-relaxed text-rose-600/90 dark:text-rose-300/80">
                  {errorText}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => void ask(askedQuestion)}
                >
                  再試一次
                </Button>
              </div>
            ) : answer === '' && busy ? (
              // 載入：柔和點動
              <div
                role="status"
                aria-live="polite"
                aria-busy="true"
                className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-4 py-3.5 dark:border-slate-700/60 dark:bg-slate-800"
              >
                <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-accent" />
                <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                  睇緊你嘅資料…
                </span>
              </div>
            ) : (
              <div
                role="status"
                aria-live="polite"
                aria-busy={busy}
                className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-200 dark:shadow-none"
              >
                {answer}
                {showCaret && (
                  <span
                    aria-hidden="true"
                    className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-accent align-middle"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 範例提問 chips（撳一下即發問）── */}
      {(!started || (!busy && !isError)) && (
        <div className={cx(started && 'border-t border-slate-200/70 pt-4 dark:border-slate-700/60')}>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
            <Sparkles size={12} />
            {started ? '繼續問下去' : '試下問'}
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.text}
                type="button"
                onClick={() => void ask(s.text)}
                disabled={busy}
                className="group inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3.5 py-1.5 text-xs text-slate-600 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent-soft/50 hover:text-accent-strong disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-300 dark:shadow-none dark:hover:border-accent/40 dark:hover:bg-accent/10 dark:hover:text-accent"
              >
                <s.icon size={13} className="text-slate-400 transition group-hover:text-accent" />
                {s.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 輸入區：圓潤、focus 有 accent 環、送出掣明顯 ── */}
      <div className="sticky bottom-3 z-10">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200/80 bg-white/95 p-2 shadow-md backdrop-blur transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 dark:border-slate-700/60 dark:bg-slate-800/95 dark:shadow-none">
          <Textarea
            ref={inputRef}
            rows={1}
            className="max-h-40 min-h-[40px] flex-1 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus:border-0 focus:ring-0 dark:bg-transparent"
            aria-label="問關於你資料嘅問題"
            placeholder="問我啲咩呢？例如：我今個星期最緊要做咩？"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
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
            <Button icon={Send} onClick={() => void ask(q)} disabled={!q.trim()}>
              問
            </Button>
          )}
        </div>
        <p className="mt-1.5 hidden items-center justify-center gap-1 text-center text-[11px] text-slate-400 dark:text-slate-500 sm:flex">
          <CornerDownLeft size={11} /> Enter 送出 · Shift + Enter 換行
        </p>
      </div>
    </div>
  )
}
