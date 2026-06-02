import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  Bot,
  Lock,
  Search,
  Send,
  Sparkles,
  Square,
  CornerDownLeft,
  FileSearch,
  AlertTriangle,
  NotebookPen,
  ListTodo,
  Target,
  CalendarDays,
  Quote,
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
//  「問我嘅資料 AI」— 資料偵探 / 查詢台（Inquiry Desk）
//  ------------------------------------------------------------
//  概念：呢個唔係一般 chat，而係一個「data-grounded 查詢台」——
//  AI 淨係根據你嘅卷宗（筆記 / 待辦 / 目標 / 日程 / 日誌）查案、引證作答。
//  落手前先攤開「證據在案」清單（即時數你有幾多份卷宗），令查詢有根有據。
//  收集跨功能資料做 context，經 Supabase Edge Function 問 Gemini。
//  未啟用 / 未登入優雅守門。
// ============================================================

// 範例查詢：撳一下即時立案發問。配一隻 lucide icon 暗示引用邊類卷宗。
const SUGGESTIONS: { text: string; icon: LucideIcon }[] = [
  { text: '我今個星期有咩重要事？', icon: CalendarDays },
  { text: '總結我最近嘅筆記重點', icon: NotebookPen },
  { text: '我仲有咩未完成待辦？', icon: ListTodo },
  { text: '根據我嘅目標，建議下一步點做', icon: Target },
]

const SYSTEM =
  '你係用戶「NTK 平台」嘅私人 AI 助理。下面係佢嘅個人資料摘要，請主要根據呢啲資料（配合常識）用繁體中文（可書面廣東話）扼要、有條理咁回答。如果資料唔夠就照答並提一句。唔好捏造唔存在嘅具體資料。'

// 「證據在案」卷宗類別（配分類色；用嚟向用戶顯示 AI 手上有幾多份資料可查）。
// 純展示用，數法對齊 buildContext() 嘅篩選，令清單係真實 context 預覽。
type EvidenceKind = {
  key: string
  label: string
  icon: LucideIcon
  tint: string
  count: number
}

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
  const notes = useCollection(richNotesCol)
  const tasks = useCollection(tasksCol)

  const [q, setQ] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  // askedQuestion：已送出嘅問題（用嚟喺對話度顯示「你」嗰格），同 q 輸入框分開。
  const [askedQuestion, setAskedQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  // ── 證據在案：即時統計手頭可查嘅卷宗份數（純展示，數法對齊 buildContext）──
  //    依賴 notes / tasks（已訂閱）令新增資料即時反映；其餘 collection 即取即數。
  const evidence = useMemo<EvidenceKind[]>(() => {
    const today = todayKey()
    return [
      {
        key: 'notes',
        label: '筆記',
        icon: NotebookPen,
        tint: 'violet',
        count: notes.filter((n) => !n.trashed).length,
      },
      {
        key: 'tasks',
        label: '待辦',
        icon: ListTodo,
        tint: 'amber',
        count: tasks.filter((t) => !t.done).length,
      },
      {
        key: 'goals',
        label: '目標',
        icon: Target,
        tint: 'rose',
        count: goalsCol.get().length,
      },
      {
        key: 'events',
        label: '日程',
        icon: CalendarDays,
        tint: 'blue',
        count: eventsCol.get().filter((e) => (e.endDate ?? e.date) >= today).length,
      },
    ]
    // notes / tasks 變動時重算；其餘 collection 隨之即取即數。
  }, [notes, tasks])

  const totalFiles = evidence.reduce((s, e) => s + e.count, 0)

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
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ───────── 查詢台 masthead：serif 大標題 + 偵探語氣（自管 header） ───────── */}
      <header className="animate-fade-in-up">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
          <FileSearch size={13} className="shrink-0" />
          查詢台 · Inquiry Desk
        </p>
        <h1 className="mt-1.5 font-serif text-[27px] font-semibold leading-[1.15] tracking-tight text-slate-800 dark:text-slate-100 sm:text-[32px]">
          問我嘅資料 AI
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          開案查問。我淨係根據你<span className="font-medium text-slate-600 dark:text-slate-300">親手記低嘅卷宗</span>
          ——筆記、待辦、目標同日程——引證作答，唔靠估。
        </p>
      </header>

      {/* ───────── 證據在案：手頭卷宗清單（data-grounded 嘅靈魂；落案前先攤開） ───────── */}
      {!started && (
        <section
          aria-label="證據在案"
          className="animate-fade-in-up overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none"
          style={{ animationDelay: '60ms' }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-dashed border-slate-200/80 px-5 py-3 dark:border-slate-700/60">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <FileSearch size={13} className="shrink-0" />
              證據在案
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-accent-strong dark:bg-accent/15 dark:text-accent">
              <span className="tabular-nums slashed-zero">{totalFiles}</span> 份可查
            </span>
          </div>

          {/* 卷宗類別：唔做一排死板等分卡，用 hairline grid + 大數字營造「歸檔」感 */}
          <div className="grid grid-cols-2 gap-px bg-slate-200/60 dark:bg-slate-700/50 sm:grid-cols-4">
            {evidence.map((e) => (
              <EvidenceTile key={e.key} item={e} />
            ))}
          </div>

          {totalFiles === 0 && (
            // 空狀態：有溫度，唔係冷冰冰「無資料」
            <p className="px-5 py-3.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
              卷宗仲係空白嘅。去記低幾條筆記、待辦或者目標，我就有嘢可以幫你查。
            </p>
          )}
        </section>
      )}

      {/* ───────── 查問記錄：你（委託人）/ 案頭（AI 查卷作答），柔和氣泡 ───────── */}
      {started && (
        <div className="space-y-4">
          {/* 你（委託人） */}
          {askedQuestion && (
            <div className="flex animate-fade-in-up justify-end gap-2.5">
              <div className="max-w-[85%]">
                <p className="mb-1 pr-1 text-right text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  你嘅查問
                </p>
                <div className="flex items-start gap-2 rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
                  <Quote size={14} className="mt-0.5 shrink-0 text-white/50" aria-hidden="true" />
                  <span>{askedQuestion}</span>
                </div>
              </div>
            </div>
          )}

          {/* 案頭（AI） */}
          <div className="flex animate-fade-in-up gap-2.5">
            <span
              className={cx(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                isError
                  ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300'
                  : 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
              )}
            >
              {isError ? <AlertTriangle size={16} /> : <FileSearch size={16} />}
            </span>

            <div className="min-w-0 flex-1">
              <p className="mb-1 pl-1 text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {isError ? '查詢台' : '案頭調卷'}
              </p>

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
                    再查一次
                  </Button>
                </div>
              ) : answer === '' && busy ? (
                // 載入：柔和點動 + 偵探語氣（翻緊你嘅卷宗）
                <div
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                  className="inline-flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-slate-200/80 bg-white px-4 py-3.5 dark:border-slate-700/60 dark:bg-slate-800"
                >
                  <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-accent" />
                  <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                    翻緊你嘅卷宗…
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
        </div>
      )}

      {/* ───────── 立案查詢 chips（撳一下即發問）───────── */}
      {(!started || (!busy && !isError)) && (
        <div className={cx(started && 'border-t border-slate-200/70 pt-4 dark:border-slate-700/60')}>
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
            <Search size={12} className="shrink-0" />
            {started ? '繼續追查' : '由呢度開案查問'}
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

      {/* ───────── 查詢單：圓潤、貼底、focus 有 accent 環、送出掣明顯 ───────── */}
      <div className="sticky bottom-3 z-10">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200/80 bg-white/95 p-2 pl-3.5 shadow-md backdrop-blur transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 dark:border-slate-700/60 dark:bg-slate-800/95 dark:shadow-none">
          <Search
            size={17}
            aria-hidden="true"
            className="mb-2.5 shrink-0 text-slate-400 dark:text-slate-500"
          />
          <Textarea
            ref={inputRef}
            rows={1}
            className="max-h-40 min-h-[40px] flex-1 resize-none border-0 bg-transparent px-0 py-2 shadow-none focus:border-0 focus:ring-0 dark:bg-transparent"
            aria-label="向你嘅資料查問"
            placeholder="想查啲咩？例如：我今個星期最緊要做咩？"
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
              查問
            </Button>
          )}
        </div>
        <p className="mt-1.5 hidden items-center justify-center gap-1.5 text-center text-[11px] text-slate-400 dark:text-slate-500 sm:flex">
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft size={11} /> Enter 送出 · Shift + Enter 換行
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
          <span className="inline-flex items-center gap-1">
            <Sparkles size={11} /> 只引用你自己嘅資料
          </span>
        </p>
      </div>
    </div>
  )
}

// ───────── 證據卷宗格（hairline grid · 分類色 icon chip · serif 大數字）─────────
//  分類色（violet/amber/rose/blue）淺底 + 深字 + 深色 /15，全部帶 dark:。
const TILE_TINT: Record<string, { chip: string; num: string }> = {
  violet: {
    chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
    num: 'text-violet-700 dark:text-violet-300',
  },
  amber: {
    chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
    num: 'text-amber-700 dark:text-amber-300',
  },
  rose: {
    chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
    num: 'text-rose-700 dark:text-rose-300',
  },
  blue: {
    chip: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
    num: 'text-blue-700 dark:text-blue-300',
  },
}

function EvidenceTile({ item }: { item: EvidenceKind }) {
  const tint = TILE_TINT[item.tint] ?? TILE_TINT.blue
  const I = item.icon
  const empty = item.count === 0
  return (
    <div className="flex items-center gap-3 bg-white px-4 py-3.5 dark:bg-slate-800">
      <span
        className={cx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          empty ? 'bg-slate-100 text-slate-400 dark:bg-slate-700/60 dark:text-slate-500' : tint.chip,
        )}
      >
        <I size={17} />
      </span>
      <div className="min-w-0">
        <p
          className={cx(
            'font-serif text-[22px] font-semibold leading-none tabular-nums slashed-zero',
            empty ? 'text-slate-300 dark:text-slate-600' : tint.num,
          )}
        >
          {item.count}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
          {item.label}
        </p>
      </div>
    </div>
  )
}
