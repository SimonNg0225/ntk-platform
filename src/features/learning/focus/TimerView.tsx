import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Coffee,
  Brain,
  Volume2,
  VolumeX,
  Hash,
  AlertCircle,
  Check,
  Plus,
  Target,
} from 'lucide-react'
import {
  Button,
  Input,
  Select,
  Modal,
  Field,
  Textarea,
  Badge,
  IconButton,
  Tooltip,
  Kbd,
  ProgressBar,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { focusCol } from '../../../data/collections'
import { focusLogsCol, fmtClock, fmtDuration, todayKey, keyOf } from './store'
import type { FocusKind, FocusLog, FocusProject, FocusSettings, Preset } from './types'
import { PRESETS } from './types'
import { paletteOf } from './charts'

type Phase = FocusKind

const KIND_META: Record<Phase, { label: string; icon: typeof Brain; tone: string }> = {
  focus: { label: '專注', icon: Brain, tone: 'text-accent-strong dark:text-accent' },
  short_break: { label: '短休息', icon: Coffee, tone: 'text-emerald-600 dark:text-emerald-400' },
  long_break: { label: '長休息', icon: Coffee, tone: 'text-amber-600 dark:text-amber-400' },
}

// ───────── 輕量提示音（WebAudio，零依賴零資產）─────────
function playChime(kind: Phase) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ac = new Ctx()
    const seq = kind === 'focus' ? [660, 880, 990] : [880, 660]
    seq.forEach((f, i) => {
      const o = ac.createOscillator()
      const g = ac.createGain()
      o.type = 'sine'
      o.frequency.value = f
      o.connect(g)
      g.connect(ac.destination)
      const t = ac.currentTime + i * 0.16
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32)
      o.start(t)
      o.stop(t + 0.34)
    })
    setTimeout(() => ac.close().catch(() => {}), 1200)
  } catch {
    /* 靜音失敗無傷大雅 */
  }
}
function playTick() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ac = new Ctx()
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = 'square'
    o.frequency.value = 1100
    o.connect(g)
    g.connect(ac.destination)
    g.gain.setValueAtTime(0.06, ac.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.05)
    o.start()
    o.stop(ac.currentTime + 0.06)
    setTimeout(() => ac.close().catch(() => {}), 200)
  } catch {
    /* ignore */
  }
}

export default function TimerView({
  settings,
  logs,
  projects,
  patchSettings,
}: {
  settings: FocusSettings
  logs: FocusLog[]
  projects: FocusProject[]
  patchSettings: (patch: Partial<FocusSettings>) => void
}) {
  const toast = useToast()

  const minutesFor = (k: Phase): number =>
    k === 'focus' ? settings.focusMin : k === 'short_break' ? settings.shortBreakMin : settings.longBreakMin

  const [phase, setPhase] = useState<Phase>('focus')
  const [secondsLeft, setSecondsLeft] = useState(settings.focusMin * 60)
  const [running, setRunning] = useState(false)
  const [label, setLabel] = useState('')
  const [projectId, setProjectId] = useState<string | undefined>(undefined)
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [interruptions, setInterruptions] = useState(0)
  const [completedFocus, setCompletedFocus] = useState(0) // 連續循環內已完成節數（決定何時長休息）
  const startRef = useRef<number | null>(null) // 本節開始時間 ms
  const tick = useRef<number | null>(null)

  // 完成評分 modal
  const [review, setReview] = useState<{ logId: string; planned: number } | null>(null)
  const [rating, setRating] = useState(0)
  const [note, setNote] = useState('')

  const total = minutesFor(phase) * 60
  const pct = total > 0 ? ((total - secondsLeft) / total) * 100 : 0
  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects])
  const proj = activeProjects.find((p) => p.id === projectId)
  const ringColor = phase === 'focus' ? paletteOf(proj?.color).fill : 'var(--accent)'

  // 設定改動 → 若停咗，重設當前節長度
  useEffect(() => {
    if (!running && startRef.current === null) {
      setSecondsLeft(minutesFor(phase) * 60)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.focusMin, settings.shortBreakMin, settings.longBreakMin])

  // 倒數
  useEffect(() => {
    if (!running) return
    tick.current = window.setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => {
      if (tick.current) window.clearInterval(tick.current)
    }
  }, [running])

  // 滴答聲（只喺專注 + 開啟時）
  useEffect(() => {
    if (running && phase === 'focus' && settings.tickSound) playTick()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft])

  // 文件標題顯示倒數（似真 app）
  useEffect(() => {
    const meta = KIND_META[phase]
    document.title = running ? `${fmtClock(secondsLeft)} · ${meta.label}` : 'EziTeach 教學易'
    return () => {
      document.title = 'EziTeach 教學易'
    }
  }, [secondsLeft, running, phase])

  // 倒數到 0
  useEffect(() => {
    // 評分 modal 開住時暫停自動推進：背景倒數停喺 0，待用家儲存／略過
    // （saveReview / onClose 會 setReview(null)）後本 effect 重跑，
    // 嗰刻 running 仍 true、secondsLeft 仍 0，即時補做 finishPhase 完成本節。
    if (review) return
    if (running && secondsLeft === 0) finishPhase(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, secondsLeft, review])

  // 鍵盤捷徑：空白=開始/暫停、R=重設、S=跳過
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (review) return
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      } else if (e.key === 'r' || e.key === 'R') reset()
      else if (e.key === 's' || e.key === 'S') finishPhase(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review, running, phase, secondsLeft])

  function nextBreakKind(): Phase {
    return (completedFocus + 1) % settings.longBreakEvery === 0 ? 'long_break' : 'short_break'
  }

  function toggle() {
    if (!running && startRef.current === null) startRef.current = Date.now()
    setRunning((r) => !r)
  }

  function reset() {
    setRunning(false)
    startRef.current = null
    setInterruptions(0)
    setSecondsLeft(minutesFor(phase) * 60)
  }

  // 結束本節（natural=自然到 0 / false=手動跳過）
  function finishPhase(natural: boolean) {
    setRunning(false)
    const planned = minutesFor(phase)
    const startMs = startRef.current ?? Date.now() - planned * 60000
    const elapsedMin = Math.max(0, Math.round((Date.now() - startMs) / 60000))
    const actual = natural ? planned : Math.min(elapsedMin, planned)
    const completed = natural

    const logBase: Omit<FocusLog, 'id'> = {
      kind: phase,
      startedAt: new Date(startMs).toISOString(),
      endedAt: new Date().toISOString(),
      plannedMin: planned,
      actualMin: actual,
      completed,
      projectId: phase === 'focus' ? projectId : undefined,
      label: phase === 'focus' ? label.trim() || undefined : undefined,
      tags: phase === 'focus' && tags.length ? tags : undefined,
      interruptions: phase === 'focus' ? interruptions : undefined,
    }
    const created = focusLogsCol.add(logBase)

    // 向後相容：完成嘅專注節同步寫共用 focusCol（儀表板 / 匯出可見）
    if (phase === 'focus' && completed) {
      focusCol.add({
        startedAt: logBase.startedAt,
        durationMin: actual,
        label: logBase.label,
        completed: true,
      })
    }

    startRef.current = null
    setInterruptions(0)

    if (phase === 'focus') {
      if (completed) {
        const n = completedFocus + 1
        const nextKind = nextBreakKind()
        setCompletedFocus(n)
        setPhase(nextKind)
        setSecondsLeft(minutesFor(nextKind) * 60)
        if (settings.chimeSound) playChime('focus')
        toast.success(
          nextKind === 'long_break' ? '完成一節！該食個長 break 啦 🌳' : '完成一節專注 🍅',
        )
        // 完成節 → 問評分
        setRating(0)
        setNote('')
        setReview({ logId: created.id, planned })
        if (settings.autoStartBreaks) {
          startRef.current = Date.now()
          setRunning(true)
        }
      } else {
        // 放棄專注：唔轉 phase，重設本節
        setPhase('focus')
        setSecondsLeft(planned * 60)
        toast.info('已記錄一節未完成的專注')
      }
    } else {
      // 休息結束 → 返專注
      setPhase('focus')
      setSecondsLeft(settings.focusMin * 60)
      if (settings.chimeSound) playChime(phase)
      toast.info('休息完，繼續加油 💪')
      if (settings.autoStartFocus) {
        startRef.current = Date.now()
        setRunning(true)
      }
    }
  }

  function saveReview() {
    if (!review) return
    focusLogsCol.update(review.logId, {
      rating: rating || undefined,
      note: note.trim() || undefined,
    })
    setReview(null)
  }

  function addInterruption() {
    setInterruptions((n) => n + 1)
  }

  function addTag() {
    const t = tagDraft.trim().replace(/^#/, '')
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagDraft('')
  }

  function applyPreset(p: Preset) {
    patchSettings({ focusMin: p.focus, shortBreakMin: p.short, longBreakMin: p.long })
    if (!running) {
      const next = phase === 'focus' ? p.focus : phase === 'short_break' ? p.short : p.long
      setSecondsLeft(next * 60)
    }
  }

  // 今日進度（針對全域每日目標）
  const todayDone = logs.filter(
    (l) => l.kind === 'focus' && l.completed && keyOf(l.startedAt) === todayKey(),
  ).length
  const goal = settings.dailyGoal
  const meta = KIND_META[phase]
  const PhaseIcon = meta.icon

  const presetMatch = PRESETS.find(
    (p) =>
      p.focus === settings.focusMin &&
      p.short === settings.shortBreakMin &&
      p.long === settings.longBreakMin,
  )

  const phaseLong = phase === 'long_break'
  const breakLabel = phaseLong ? '長休息' : '短休息'

  return (
    <div className="mx-auto max-w-sm">
      {/* ── 呼吸盤：單一焦點，大量留白，唔包卡邊 ── */}
      <section className="relative flex flex-col items-center">
        {/* 階段切換：低調三選一，似一條安靜的呼吸節律索引 */}
        <div className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 p-1 dark:bg-slate-800/70">
          {(['focus', 'short_break', 'long_break'] as Phase[]).map((k) => {
            const m = KIND_META[k]
            const on = phase === k
            return (
              <button
                key={k}
                type="button"
                disabled={running}
                aria-pressed={on}
                onClick={() => {
                  setPhase(k)
                  startRef.current = null
                  setSecondsLeft(minutesFor(k) * 60)
                }}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60',
                  on
                    ? 'bg-white text-slate-700 shadow-xs dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300',
                )}
              >
                <m.icon size={14} className="shrink-0" />
                {m.label}
              </button>
            )
          })}
        </div>

        {/* 呼吸盤本體：track + 進度環 + 隨運行緩緩呼吸嘅光暈 */}
        <div className="relative mt-10 flex h-72 w-72 items-center justify-center sm:h-80 sm:w-80">
          {/* 呼吸光暈：運行時慢脈動（prefers-reduced-motion 會自動停） */}
          {running && (
            <div
              className="pointer-events-none absolute h-[78%] w-[78%] animate-pulse rounded-full opacity-25 blur-3xl [animation-duration:4s] motion-reduce:animate-none motion-reduce:opacity-20"
              style={{ backgroundColor: ringColor }}
            />
          )}
          {/* 內凹靜謐底盤 */}
          <div className="absolute h-[82%] w-[82%] rounded-full bg-white shadow-[inset_0_1px_3px_rgba(15,23,42,0.05)] ring-1 ring-slate-100 dark:bg-slate-800/70 dark:shadow-none dark:ring-slate-700/50" />

          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              className="stroke-slate-100 dark:stroke-slate-700/60"
              strokeWidth="4"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={ringColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 45}
              strokeDashoffset={2 * Math.PI * 45 * (1 - pct / 100)}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>

          <div className="relative flex flex-col items-center text-center">
            <p className={cx('flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em]', meta.tone)}>
              <PhaseIcon size={12} className="shrink-0" />
              {meta.label}
              {running && (
                <span className="ml-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-duration:2s]" />
              )}
            </p>
            <p
              role="timer"
              aria-label={`${meta.label}剩餘 ${fmtClock(secondsLeft)}`}
              className="mt-3 font-serif text-[4.25rem] font-semibold leading-none tracking-tight tabular-nums slashed-zero text-slate-800 dark:text-slate-50 sm:text-[4.75rem]"
            >
              {fmtClock(secondsLeft)}
            </p>
            <p className="mt-3 h-4 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
              {phase === 'focus'
                ? `第 ${completedFocus + 1} 節 · 距長休息 ${settings.longBreakEvery - (completedFocus % settings.longBreakEvery)} 節`
                : `${breakLabel} · 喘口氣再繼續`}
            </p>
          </div>
        </div>

        {/* 主控制：一個明確 CTA，重設／跳過靜靜陪襯兩側 */}
        <div className="mt-10 flex items-center justify-center gap-5">
          <Tooltip label="重設（R）">
            <IconButton label="重設" onClick={reset}>
              <RotateCcw size={19} />
            </IconButton>
          </Tooltip>

          <Button
            size="lg"
            onClick={toggle}
            icon={running ? Pause : Play}
            className="min-w-[9rem] rounded-full px-7 py-3 text-base shadow-md shadow-accent/25"
          >
            {running ? '暫停' : startRef.current !== null ? '繼續' : '開始'}
          </Button>

          <Tooltip label="跳過（S）">
            <IconButton label="跳過" onClick={() => finishPhase(false)}>
              <SkipForward size={19} />
            </IconButton>
          </Tooltip>
        </div>

        {/* 預設長度（停止時可調，運行時隱藏以保持沉穩） */}
        {!running && (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              時長
            </span>
            {PRESETS.map((p) => {
              const on = presetMatch?.id === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={`預設 ${p.focus} 分專注／${p.short} 分短休息／${p.long} 分長休息`}
                  onClick={() => applyPreset(p)}
                  className={cx(
                    'rounded-full px-3 py-1 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    on
                      ? 'bg-accent text-white shadow-sm dark:shadow-none'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
                  )}
                >
                  {p.focus}/{p.short}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* 專注時：「現在做緊」——一條安靜捕捉欄，唔似死表單 */}
      {phase === 'focus' && (
        <div className="mt-12 space-y-3">
          <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            現在做緊
          </p>
          <div className="flex gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="想專注喺邊件事？（選填）"
              className="flex-1 rounded-xl border-slate-200/80 bg-slate-50/60 text-center shadow-none focus:bg-white dark:border-slate-700/60 dark:bg-slate-800/50 dark:focus:bg-slate-800"
            />
            <Select
              value={projectId ?? ''}
              onChange={(e) => setProjectId(e.target.value || undefined)}
              className="w-28 shrink-0 rounded-xl border-slate-200/80 bg-slate-50/60 shadow-none dark:border-slate-700/60 dark:bg-slate-800/50"
              aria-label="專案"
            >
              <option value="">無專案</option>
              {activeProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon ? `${p.icon} ` : ''}
                  {p.name}
                </option>
              ))}
            </Select>
          </div>

          {/* 標籤 */}
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                aria-label={`移除標籤 #${t}`}
                onClick={() => setTags(tags.filter((x) => x !== t))}
                className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-accent-strong transition hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-accent/15 dark:text-accent"
              >
                #{t}
                <span aria-hidden="true" className="text-accent/60">×</span>
              </button>
            ))}
            <Input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag()
                }
              }}
              icon={Hash}
              placeholder="加標籤"
              className="h-7 w-28 rounded-full border-transparent bg-transparent py-0 text-xs shadow-none hover:bg-slate-50 focus:border-slate-200 focus:bg-white dark:hover:bg-slate-800/60 dark:focus:border-slate-700 dark:focus:bg-slate-800"
            />
          </div>
        </div>
      )}

      {/* 今日目標進度條：一條纖細安靜嘅律動 */}
      {goal > 0 && (
        <div className="mt-10">
          <div className="mb-2 flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              <Target
                size={13}
                className={todayDone >= goal ? 'text-emerald-500' : 'text-accent'}
              />
              今日目標
            </span>
            <span
              className={cx(
                'tabular-nums',
                todayDone >= goal
                  ? 'font-medium text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400',
              )}
            >
              {todayDone} / {goal} 節{todayDone >= goal && ' · 達標 🎉'}
            </span>
          </div>
          <ProgressBar
            value={(todayDone / goal) * 100}
            size="sm"
            tone={todayDone >= goal ? 'green' : 'accent'}
          />
        </div>
      )}

      {/* 安靜頁腳：分心打點 · 鈴聲 · 鍵盤捷徑（弱化，唔搶焦點） */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-slate-400 dark:text-slate-500">
        {phase === 'focus' && (
          <button
            type="button"
            onClick={addInterruption}
            aria-label={`記錄分心，目前 ${interruptions} 次`}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:text-slate-300"
          >
            <AlertCircle size={13} />
            分心{' '}
            <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">
              {interruptions}
            </span>
          </button>
        )}
        <button
          type="button"
          aria-pressed={settings.chimeSound}
          aria-label={settings.chimeSound ? '完成鈴聲：開（點擊關閉）' : '完成鈴聲：關（點擊開啟）'}
          onClick={() => patchSettings({ chimeSound: !settings.chimeSound })}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:text-slate-300"
        >
          {settings.chimeSound ? <Volume2 size={13} /> : <VolumeX size={13} />}
          鈴聲{settings.chimeSound ? '開' : '關'}
        </button>
        <span className="hidden items-center gap-1 sm:inline-flex">
          <Kbd>Space</Kbd> 開始/暫停 · <Kbd>R</Kbd> 重設 · <Kbd>S</Kbd> 跳過
        </span>
      </div>

      {/* 完成評分 modal */}
      <Modal
        open={!!review}
        onClose={() => setReview(null)}
        title="呢一節，感覺點？"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReview(null)}>
              略過
            </Button>
            <Button onClick={saveReview} icon={Check}>
              儲存
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">專注度自評</p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`評 ${n} 分`}
                  aria-pressed={rating === n}
                  onClick={() => setRating(n)}
                  className={cx(
                    'flex h-10 flex-1 items-center justify-center rounded-lg text-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    rating >= n
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600',
                  )}
                >
                  <span aria-hidden="true">{rating >= n ? '★' : '☆'}</span>
                </button>
              ))}
            </div>
          </div>
          <Field label="反思筆記（選填）">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="完成咗啲咩？有咩可以改善？"
              rows={3}
            />
          </Field>
          {review && (
            <Badge tone="accent">
              <Plus size={11} />
              {fmtDuration(review.planned)}已記入今日
            </Badge>
          )}
        </div>
      </Modal>
    </div>
  )
}
