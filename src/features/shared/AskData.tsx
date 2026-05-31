import { useRef, useState, type KeyboardEvent } from 'react'
import { Bot, Lock, Send, Sparkles, Square } from 'lucide-react'
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
import { Button, Card, EmptyState, Textarea } from '../../ui'

// ============================================================
//  「問我嘅資料」AI — 全域個人助理
//  ------------------------------------------------------------
//  收集用戶跨功能資料（筆記 / 待辦 / 目標 / 日程 / 日誌）做 context，
//  經 Supabase Edge Function 問 Gemini，扼要回答。未啟用 / 未登入優雅守門。
// ============================================================

const SUGGESTIONS = [
  '我今個星期有咩重要事？',
  '總結我最近嘅筆記重點',
  '我仲有咩未完成待辦？',
  '根據我嘅目標，建議下一步點做',
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

  return (
    <div className="space-y-4">
      <Card padded>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <Sparkles size={16} className="text-accent" />
          問任何關於你資料嘅問題
        </div>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          AI 會睇你嘅筆記、待辦、目標、日程同日誌嚟答你。
        </p>
        <div className="mt-3 flex items-end gap-2">
          <Textarea
            ref={inputRef}
            rows={2}
            className="flex-1"
            aria-label="問關於你資料嘅問題"
            placeholder="例如：我今個星期最緊要做咩？（Enter 送出）"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={busy}
          />
          {busy ? (
            <Button variant="secondary" icon={Square} onClick={() => abortRef.current?.abort()}>
              停止
            </Button>
          ) : (
            <Button icon={Send} onClick={() => void ask(q)} disabled={!q.trim()}>
              問
            </Button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void ask(s)}
              disabled={busy}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-accent hover:text-accent disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      {answer !== null && (
        <Card padded>
          <div
            role="status"
            aria-live="polite"
            aria-busy={busy}
            className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 dark:text-slate-100"
          >
            {answer}
            {busy && (
              <span
                aria-hidden="true"
                className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-current align-middle"
              />
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
