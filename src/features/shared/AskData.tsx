import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  Bot,
  Lock,
  Search,
  Send,
  Sparkles,
  Square,
  CornerDownLeft,
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
import { BRAND_NAME } from '../../lib/brand'
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
import {
  Button,
  EmptyState,
  Textarea,
  FeatureGuide,
  type FeatureGuideStep,
  PageHero,
  cx,
} from '../../ui'
import CreditMeter from '../../components/CreditMeter'

// ============================================================
//  「問我嘅資料 AI」— 用你自己嘅資料嚟問 AI
//  ------------------------------------------------------------
//  AI 淨係根據你親手記低嘅資料（筆記 / 待辦 / 目標 / 日程 / 日誌）作答，
//  唔靠估、唔捏造。發問前先攤開「可參考資料」清單，等你知佢手頭有啲咩。
//  收集跨功能資料做 context，經 Supabase Edge Function 問 Gemini。
//  未啟用 / 未登入優雅守門。
//  ※ 本檔只負責呈現層；資料流 / collection 讀寫 / API 一律不變。
// ============================================================

// 教學引導：教用家「點用」呢個功能（2–4 步，FeatureGuide 只取頭 4 步）。
const GUIDE_STEPS: FeatureGuideStep[] = [
  {
    title: '揀條問題或者自己打',
    desc: '撳下面嘅範例問題即刻問，或者喺底部輸入框打你想知嘅嘢。',
  },
  {
    title: 'AI 翻你嘅資料作答',
    desc: '佢只會睇你記低嘅筆記、待辦、目標同日程，唔會捏造其他資料。',
  },
  {
    title: '追問落去',
    desc: '答完可以再撳範例或者繼續打，一步步問深入啲。',
  },
]

// 範例問題：撳一下即刻發問。配一隻 lucide icon 暗示會參考邊類資料。
const SUGGESTIONS: { text: string; icon: LucideIcon }[] = [
  { text: '我今個星期有咩重要事？', icon: CalendarDays },
  { text: '總結我最近嘅筆記重點', icon: NotebookPen },
  { text: '我仲有咩未完成待辦？', icon: ListTodo },
  { text: '根據我嘅目標，建議下一步點做', icon: Target },
]

const SYSTEM =
  `你係用戶「${BRAND_NAME}」嘅私人 AI 助理。下面係佢嘅個人資料摘要，請主要根據呢啲資料（配合常識）用繁體中文（可書面廣東話）扼要、有條理咁回答。如果資料唔夠就照答並提一句。唔好捏造唔存在嘅具體資料。`

// 「可參考資料」類別（配語意色；向用戶顯示 AI 手上有幾多份資料可查）。
// 純展示用，數法對齊 buildContext() 嘅篩選，令清單係真實 context 預覽。
type EvidenceKind = {
  key: string
  label: string
  icon: LucideIcon
  /** 語意 tone（對齊 WorkDashboard TONE map） */
  tone: 'violet' | 'amber' | 'rose' | 'sky'
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
        tone: 'violet',
        count: notes.filter((n) => !n.trashed).length,
      },
      {
        key: 'tasks',
        label: '待辦',
        icon: ListTodo,
        tone: 'amber',
        count: tasks.filter((t) => !t.done).length,
      },
      {
        key: 'goals',
        label: '目標',
        icon: Target,
        tone: 'rose',
        count: goalsCol.get().length,
      },
      {
        key: 'events',
        label: '日程',
        icon: CalendarDays,
        tone: 'sky',
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
        hint="此工作區尚未啟用 AI 功能。請聯絡管理員或支援團隊完成設定。"
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
        source: 'ask-data',
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
    <div className="space-y-5">
      {/* ───────── Masthead：共用 PageHero（accent hero） ───────── */}
      <PageHero
        guideKey="ask-data"
        icon={Sparkles}
        kicker="AI · Ask Your Data"
        title="問我嘅資料 AI"
        description="只根據你記低嘅筆記、待辦、目標同日程作答，唔靠估。"
      />

      {/* ───────── 教學引導：點用呢個功能 ───────── */}
      <FeatureGuide
        storageKey="ask-data"
        title="問我嘅資料 AI 點用？"
        steps={GUIDE_STEPS}
      />

      {/* ───────── 可參考資料：手頭資料份數（發問前先攤開，等用家知 AI 睇緊咩） ───────── */}
      {!started && (
        <section aria-label="可參考資料" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
              <Search size={14} className="shrink-0 text-slate-400" />
              可參考資料
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-accent-strong dark:bg-accent/15 dark:text-accent">
              <span className="tabular-nums slashed-zero">{totalFiles}</span> 份可查
            </span>
          </div>

          {totalFiles === 0 ? (
            // 引導式空狀態：icon + 標題 + 提示 + CTA 直接跳去下一步
            <EmptyState
              icon={NotebookPen}
              title="仲未有資料可以參考"
              hint="去記低幾條筆記、待辦或者目標，AI 就有嘢可以幫你查。你亦可以直接喺下面問問題。"
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  icon={Send}
                  onClick={() => inputRef.current?.focus()}
                >
                  直接問問題
                </Button>
              }
            />
          ) : (
            // 資料類別：統計磚（對齊 dashboard StatTile 樣式）
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {evidence.map((e) => (
                <EvidenceTile key={e.key} item={e} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ───────── 對話：你 / AI（柔和氣泡，跟 dashboard 色階） ───────── */}
      {started && (
        <div className="space-y-4">
          {/* 你嘅問題 */}
          {askedQuestion && (
            <div className="flex justify-end gap-2.5">
              <div className="max-w-[85%]">
                <p className="mb-1 pr-1 text-right text-xs font-medium text-slate-400 dark:text-slate-500">
                  你
                </p>
                <div className="rounded-2xl bg-accent px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
                  {askedQuestion}
                </div>
              </div>
            </div>
          )}

          {/* AI 回答 */}
          <div className="flex gap-2.5">
            <span
              className={cx(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                isError
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300'
                  : 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
              )}
            >
              {isError ? <AlertTriangle size={16} /> : <Sparkles size={16} />}
            </span>

            <div className="min-w-0 flex-1">
              <p className="mb-1 pl-1 text-xs font-medium text-slate-400 dark:text-slate-500">
                AI 助理
              </p>

              {isError ? (
                <div className="max-w-[85%] rounded-2xl border border-rose-200/70 bg-rose-50/70 px-4 py-3 dark:border-rose-500/30 dark:bg-rose-500/10">
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
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none"
                >
                  <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-accent" />
                  <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                    翻緊你嘅資料…
                  </span>
                </div>
              ) : (
                <div
                  role="status"
                  aria-live="polite"
                  aria-busy={busy}
                  className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-200 dark:shadow-none"
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

      {/* ───────── 範例問題（撳一下即發問）───────── */}
      {(!started || (!busy && !isError)) && (
        <div className={cx(started && 'border-t border-slate-200 pt-4 dark:border-slate-700')}>
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
            <Sparkles size={12} className="shrink-0" />
            {started ? '繼續問落去' : '試下問呢啲'}
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.text}
                type="button"
                onClick={() => void ask(s.text)}
                disabled={busy}
                className="group inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3.5 text-xs text-slate-600 transition duration-200 hover:border-accent/40 hover:bg-accent-soft/50 hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-300 dark:shadow-none dark:hover:border-accent/40 dark:hover:bg-accent/10 dark:hover:text-accent"
              >
                <s.icon size={13} className="text-slate-400 transition group-hover:text-accent" />
                {s.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ───────── 輸入框：圓潤、貼底、focus 有 accent 環、送出掣明顯 ───────── */}
      <div className="sticky bottom-3 z-10">
        <div className="mb-1.5 flex justify-end px-1">
          <CreditMeter source="ask-data" />
        </div>
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200/80 bg-white/95 p-2 pl-3.5 shadow-md backdrop-blur transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/40 dark:border-slate-700/60 dark:bg-slate-800/95 dark:shadow-none">
          <Search
            size={17}
            aria-hidden="true"
            className="mb-2.5 shrink-0 text-slate-400 dark:text-slate-500"
          />
          <Textarea
            ref={inputRef}
            rows={1}
            className="max-h-40 min-h-11 flex-1 resize-none border-0 bg-transparent px-0 py-2 shadow-none focus:border-0 focus:ring-0 dark:bg-transparent"
            aria-label="問你嘅資料"
            placeholder="想問啲咩？例如：我今個星期最緊要做咩？"
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
        <p className="mt-1.5 hidden items-center justify-center gap-1.5 text-center text-xs text-slate-400 dark:text-slate-500 sm:flex">
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

// ───────── 資料統計磚（純展示卡，對齊 dashboard StatTile：tone chip + 大數字）─────────
//  TONE map 嚴格照 WorkDashboard：chip 底+icon 字 / val 數字字 兩組，全部帶 dark:。
const TONE: Record<
  EvidenceKind['tone'],
  { chip: string; val: string }
> = {
  violet: {
    chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
    val: 'text-violet-500',
  },
  amber: {
    chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
    val: 'text-amber-500',
  },
  rose: {
    chip: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
    val: 'text-rose-500',
  },
  sky: {
    chip: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
    val: 'text-sky-500',
  },
}

function EvidenceTile({ item }: { item: EvidenceKind }) {
  const tone = TONE[item.tone]
  const I = item.icon
  const empty = item.count === 0
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
          {item.label}
        </p>
        <span
          className={cx(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
            empty
              ? 'bg-slate-100 text-slate-400 dark:bg-slate-700/60 dark:text-slate-500'
              : tone.chip,
          )}
        >
          <I size={16} />
        </span>
      </div>
      <p
        className={cx(
          'mt-3 text-3xl font-semibold tabular-nums slashed-zero',
          empty ? 'text-slate-300 dark:text-slate-600' : tone.val,
        )}
      >
        {item.count}
      </p>
    </div>
  )
}
