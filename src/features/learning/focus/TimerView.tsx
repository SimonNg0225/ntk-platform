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
    document.title = running ? `${fmtClock(secondsLeft)} · ${meta.label}` : 'NTK Platform'
    return () => {
      document.title = 'NTK Platform'
    }
  }, [secondsLeft, running, phase])

  // 倒數到 0
  useEffect(() => {
    if (running && secondsLeft === 0) finishPhase(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, secondsLeft])

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

  return (
    <div className="mx-auto max-w-md space-y-4">
      {/* ── 計時主卡（沉穩 premium 焦點面）── */}
      <section
        className={cx(
          'relative overflow-hidden rounded-3xl border bg-white px-5 pb-6 pt-5 shadow-xs transition-colors duration-500 dark:bg-slate-800',
          running && phase === 'focus'
            ? 'border-accent/30 dark:border-accent/30'
            : 'border-slate-200/80 dark:border-slate-700/60',
        )}
      >
        {/* 運行時的柔和光暈 */}
        {running && (
          <div
            className="pointer-events-none absolute left-1/2 top-24 h-56 w-56 -translate-x-1/2 rounded-full opacity-30 blur-3xl transition-opacity duration-700"
            style={{ backgroundColor: ringColor }}
          />
        )}

        {/* 階段切換（手動 focus / short / long） */}
        <div className="relative flex justify-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900/50">
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
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50',
                  on
                    ? 'bg-white text-slate-800 shadow-xs dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400',
                )}
              >
                <m.icon size={15} />
                {m.label}
              </button>
            )
          })}
        </div>

        {/* 計時圈 */}
        <div className="relative mx-auto mt-6 flex h-64 w-64 items-center justify-center">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" className="stroke-slate-100 dark:stroke-slate-700/70" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={ringColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 45}
              strokeDashoffset={2 * Math.PI * 45 * (1 - pct / 100)}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="text-center">
            <p className={cx('flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider', meta.tone)}>
              <PhaseIcon size={13} />
              {meta.label}
              {running && <span className="ml-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
            </p>
            <p
              role="timer"
              aria-label={`${meta.label}剩餘 ${fmtClock(secondsLeft)}`}
              className="mt-1.5 text-[3.75rem] font-bold leading-none tabular-nums slashed-zero text-slate-800 dark:text-slate-100"
            >
              {fmtClock(secondsLeft)}
            </p>
            {phase === 'focus' && (
              <p className="mt-2 text-xs tabular-nums text-slate-400">
                第 {completedFocus + 1} 節 · 距長休息還有{' '}
                {settings.longBreakEvery - (completedFocus % settings.longBreakEvery)} 節
              </p>
            )}
          </div>
        </div>

        {/* 主控制 */}
        <div className="relative mt-6 flex items-center justify-center gap-4">
          <Tooltip label="重設（R）">
            <IconButton label="重設" onClick={reset}>
              <RotateCcw size={20} />
            </IconButton>
          </Tooltip>

          <Button size="lg" onClick={toggle} icon={running ? Pause : Play} className="min-w-[8.5rem] rounded-full shadow-md shadow-accent/25">
            {running ? '暫停' : startRef.current !== null ? '繼續' : '開始'}
          </Button>

          <Tooltip label="跳過（S）">
            <IconButton label="跳過" onClick={() => finishPhase(false)}>
              <SkipForward size={20} />
            </IconButton>
          </Tooltip>
        </div>

        {/* 預設長度（停止時可調，運行時隱藏以保持沉穩） */}
        {!running && (
          <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">時長</span>
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
                    'rounded-full px-3 py-1 text-xs font-medium tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    on
                      ? 'bg-accent text-white shadow-sm dark:shadow-none'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-600',
                  )}
                >
                  {p.focus}/{p.short}
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* 專注時：任務 + 專案 + 標籤（似溫和的「依家做緊咩」卡，唔似死表單） */}
      {phase === 'focus' && (
        <div className="space-y-2.5 rounded-2xl border border-slate-200/80 bg-white p-3.5 dark:border-slate-700/60 dark:bg-slate-800">
          <div className="flex gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="而家專注緊咩？（選填）"
              className="flex-1"
            />
            <Select
              value={projectId ?? ''}
              onChange={(e) => setProjectId(e.target.value || undefined)}
              className="w-28 shrink-0"
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
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                aria-label={`移除標籤 #${t}`}
                onClick={() => setTags(tags.filter((x) => x !== t))}
                className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-strong transition hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-accent/15 dark:text-accent"
              >
                #{t}
                <span aria-hidden="true" className="text-accent/60">×</span>
              </button>
            ))}
            <div className="relative">
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
                className="h-7 w-28 py-0 text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* 專注時：分心打點 + 提示音切換 + 捷徑 */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        {phase === 'focus' && (
          <button
            type="button"
            onClick={addInterruption}
            aria-label={`記錄分心，目前 ${interruptions} 次`}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 transition hover:border-slate-300 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:text-slate-200"
          >
            <AlertCircle size={14} />
            分心 <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{interruptions}</span>
          </button>
        )}
        <button
          type="button"
          aria-pressed={settings.chimeSound}
          aria-label={settings.chimeSound ? '完成鈴聲：開（點擊關閉）' : '完成鈴聲：關（點擊開啟）'}
          onClick={() => patchSettings({ chimeSound: !settings.chimeSound })}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white px-3 py-1.5 transition hover:border-slate-300 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:text-slate-200"
        >
          {settings.chimeSound ? <Volume2 size={14} /> : <VolumeX size={14} />}
          鈴聲{settings.chimeSound ? '開' : '關'}
        </button>
        <span className="hidden w-full items-center justify-center gap-1 pt-1 sm:inline-flex sm:w-auto sm:pt-0">
          <Kbd>Space</Kbd> 開始/暫停 · <Kbd>R</Kbd> 重設 · <Kbd>S</Kbd> 跳過
        </span>
      </div>

      {/* 今日目標進度條 */}
      {goal > 0 && (
        <div
          className={cx(
            'rounded-2xl border p-4 transition-colors',
            todayDone >= goal
              ? 'border-emerald-300/60 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10'
              : 'border-slate-200/80 bg-white dark:border-slate-700/60 dark:bg-slate-800',
          )}
        >
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
              <Target size={14} className={todayDone >= goal ? 'text-emerald-500' : 'text-accent'} />
              今日目標
            </span>
            <span className="tabular-nums text-slate-500 dark:text-slate-400">
              {todayDone} / {goal} 節{todayDone >= goal && ' 🎉'}
            </span>
          </div>
          <ProgressBar
            value={(todayDone / goal) * 100}
            tone={todayDone >= goal ? 'green' : 'accent'}
          />
        </div>
      )}

      {/* 完成評分 modal */}
      <Modal
        open={!!review}
        onClose={() => setReview(null)}
        title="呢節點啊？"
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
