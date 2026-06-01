import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Dumbbell,
  Plus,
  Trash2,
  Pencil,
  Activity,
  Flame,
  CalendarDays,
  Trophy,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Calculator,
  type LucideIcon,
} from 'lucide-react'
import {
  Card,
  Button,
  Input,
  Field,
  Modal,
  SegmentedControl,
  EmptyState,
  Badge,
  IconButton,
  Textarea,
  cx,
} from '../../../../ui'
import { useToast } from '../../../../context/ToastContext'
import {
  complete,
  isAIConfigured,
  type AIMessage,
} from '../../../../lib/aiClient'
import { uid, useCollection } from '../../../../lib/store'
import { todayKey, fromKey, WEEKDAY_LABELS } from '../common'
import { workoutCol } from './store'
import type { Workout, Exercise, WorkoutSet } from './types'
import {
  workoutVolume,
  workoutSetCount,
  weeklyVolume,
  weeklySessions,
  avgRpe,
  prByExercise,
  maxRpe,
  sortWorkoutsDesc,
  dailyVolume,
  weeklyTrend,
  volumeTrend,
  daysSinceLastWorkout,
  lastSetOf,
  computePlates,
  formatClock,
  DEFAULT_PLATES_KG,
} from './util'
import { VolumeBars, RpeTrend, fmtVol } from './Charts'

// ============================================================
//  訓練記錄 + 週期化 — 主元件（自足、無 props）
// ============================================================

type PeriodMode = 'days' | 'weeks'

// ───────── 訓練 KPI 磚配色（暖色 bento）─────────
type MetricTone = 'accent' | 'sky' | 'amber' | 'emerald'
const METRIC_TONE: Record<MetricTone, string> = {
  accent: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
}

// 暖色 bento KPI 磚（可選 highlight 主色底 / onClick）
function MetricTile({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone,
  highlight,
  delta,
  onClick,
}: {
  label: string
  value: number | string
  unit?: string
  hint?: string
  icon: LucideIcon
  tone: MetricTone
  highlight?: boolean
  delta?: { value: string; dir: 'up' | 'down' | 'flat' }
  onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { onClick, type: 'button' as const } : {})}
      className={cx(
        'flex flex-col justify-between rounded-3xl border p-4 text-left transition duration-200',
        highlight
          ? 'border-accent/30 bg-accent-soft dark:border-accent/40 dark:bg-accent/15'
          : 'border-slate-200/80 bg-white dark:border-slate-700/60 dark:bg-slate-800',
        onClick &&
          'cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:border-slate-600',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</span>
        <span
          className={cx(
            'flex h-8 w-8 items-center justify-center rounded-xl',
            highlight ? 'bg-accent text-white' : METRIC_TONE[tone],
          )}
        >
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-3">
        <p className="flex items-baseline gap-1">
          <span
            className={cx(
              'text-2xl font-bold tabular-nums slashed-zero',
              highlight ? 'text-accent-strong dark:text-accent' : 'text-slate-800 dark:text-slate-100',
            )}
          >
            {value}
          </span>
          {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
          {delta && delta.dir !== 'flat' && (
            <span
              className={cx(
                'ml-auto text-xs font-semibold tabular-nums',
                delta.dir === 'up' ? 'text-emerald-500' : 'text-rose-500',
              )}
            >
              {delta.dir === 'up' ? '↑' : '↓'} {delta.value}
            </span>
          )}
        </p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
      </div>
    </Tag>
  )
}

// 暖色區塊標題：tone-coloured icon chip + 標題
function SectionHead({
  icon: Icon,
  children,
  desc,
  right,
}: {
  icon: LucideIcon
  children: ReactNode
  desc?: string
  right?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
          <Icon size={15} />
        </span>
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            {children}
          </h2>
          {desc && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{desc}</p>}
        </div>
      </div>
      {right}
    </div>
  )
}

export default function TrainingView() {
  const toast = useToast()
  const workouts = useCollection(workoutCol)

  const [editing, setEditing] = useState<Workout | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [period, setPeriod] = useState<PeriodMode>('days')
  const [confirmDel, setConfirmDel] = useState<Workout | null>(null)
  const [prOpen, setPrOpen] = useState(false)
  const [plateOpen, setPlateOpen] = useState(false)

  // ── 聚合（全部 memo，依賴 workouts）──
  const sorted = useMemo(() => sortWorkoutsDesc(workouts), [workouts])
  const wkVolume = useMemo(() => weeklyVolume(workouts), [workouts])
  const wkSessions = useMemo(() => weeklySessions(workouts), [workouts])
  const wkRpe = useMemo(() => avgRpe(workouts, 7), [workouts])
  const trend = useMemo(() => volumeTrend(workouts), [workouts])
  const sinceLast = useMemo(() => daysSinceLastWorkout(workouts), [workouts])

  const dayBars = useMemo(
    () =>
      dailyVolume(workouts, 7).map((d) => ({
        label: WEEKDAY_LABELS[fromKey(d.key).getDay()],
        volume: d.volume,
      })),
    [workouts],
  )
  const dayRpe = useMemo(
    () =>
      dailyVolume(workouts, 7).map((d) => ({
        label: WEEKDAY_LABELS[fromKey(d.key).getDay()],
        value: avgRpe(workouts, 1, fromKey(d.key)),
      })),
    [workouts],
  )
  const weekTrend = useMemo(() => weeklyTrend(workouts, 8), [workouts])
  const weekBars = useMemo(
    () => weekTrend.map((wk) => ({ label: wk.label, volume: wk.volume })),
    [weekTrend],
  )
  const weekRpe = useMemo(
    () => weekTrend.map((wk) => ({ label: wk.label, value: wk.avgRpe })),
    [weekTrend],
  )

  const prs = useMemo(() => {
    const map = prByExercise(workouts)
    return Array.from(map.entries())
      .map(([name, pr]) => ({ name, ...pr }))
      .sort((a, b) => b.best1RM - a.best1RM)
  }, [workouts])

  const volBars = period === 'days' ? dayBars : weekBars
  const rpePts = period === 'days' ? dayRpe : weekRpe

  // ── 動作 ──
  function openNew() {
    setEditing(null)
    setModalOpen(true)
  }
  function openEdit(w: Workout) {
    setEditing(w)
    setModalOpen(true)
  }
  function handleSave(data: Omit<Workout, 'id' | 'createdAt'>) {
    if (editing) {
      workoutCol.update(editing.id, { ...data })
      toast.success('已更新訓練')
    } else {
      workoutCol.add({ ...data, createdAt: new Date().toISOString() })
      toast.success('已記錄訓練')
    }
    setModalOpen(false)
    setEditing(null)
  }
  function handleDelete(w: Workout) {
    workoutCol.remove(w.id)
    setConfirmDel(null)
    toast.info('已刪除訓練')
  }

  const fatigue: { tone: 'rose' | 'amber' | 'green' | 'slate'; label: string } =
    wkRpe >= 8.5
      ? { tone: 'rose', label: '高疲勞 · 考慮減載' }
      : wkRpe >= 7
        ? { tone: 'amber', label: '中等疲勞' }
        : wkRpe > 0
          ? { tone: 'green', label: '恢復良好' }
          : { tone: 'slate', label: '未有 RPE' }

  return (
    <div className="space-y-5">
      {/* ── 標題列 ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            訓練記錄 · 週期化
          </h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            記低每組重量次數，睇訓練量同疲勞趨勢，追每個動作 PR。
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            icon={Calculator}
            onClick={() => setPlateOpen(true)}
          >
            槓片計算
          </Button>
          <Button icon={Plus} onClick={openNew}>
            記錄訓練
          </Button>
        </div>
      </div>

      {/* ── KPI（暖色 bento）── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          label="本週訓練量"
          value={fmtVol(wkVolume)}
          unit="kg"
          icon={Activity}
          tone="accent"
          highlight
          delta={
            trend.pct !== 0
              ? { value: `${Math.abs(trend.pct)}%`, dir: trend.dir }
              : undefined
          }
          hint="近 7 日總和（reps×kg）"
        />
        <MetricTile
          label="本週次數"
          value={wkSessions}
          unit="次"
          icon={CalendarDays}
          tone="sky"
          hint={sinceLast === null ? '未有記錄' : `距上次 ${sinceLast} 日`}
        />
        <MetricTile
          label="平均 RPE"
          value={wkRpe > 0 ? wkRpe.toFixed(1) : '—'}
          unit={wkRpe > 0 ? '/10' : undefined}
          icon={Flame}
          tone="amber"
          hint="疲勞指標（近 7 日）"
        />
        <MetricTile
          label="動作 PR"
          value={prs.length}
          unit="個"
          icon={Trophy}
          tone="emerald"
          onClick={prs.length > 0 ? () => setPrOpen((v) => !v) : undefined}
          hint={prs.length > 0 ? '點擊睇全部' : '記錄後自動追蹤'}
        />
      </div>

      {/* ── 週期視圖 ── */}
      <Card padded>
        <SectionHead
          icon={Activity}
          desc="訓練量（柱）對疲勞 RPE（線），睇加量定減載。"
          right={
            <SegmentedControl<PeriodMode>
              size="sm"
              value={period}
              onChange={setPeriod}
              options={[
                { id: 'days', label: '近 7 日' },
                { id: 'weeks', label: '近 8 週' },
              ]}
            />
          }
        >
          週期視圖
        </SectionHead>
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Activity size={13} /> 總訓練量（kg）
            </p>
            <VolumeBars bars={volBars} highlightLast />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                <Flame size={13} /> 疲勞走勢（平均 RPE）
              </p>
              <Badge tone={fatigue.tone} dot>
                {fatigue.label}
              </Badge>
            </div>
            <RpeTrend points={rpePts} />
          </div>
        </div>
      </Card>

      {/* ── PR 面板（可摺）── */}
      {prOpen && prs.length > 0 && (
        <Card padded>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Trophy size={15} className="text-amber-500" /> 個人紀錄 (PR)
            </h2>
            <IconButton label="收埋 PR" size="sm" onClick={() => setPrOpen(false)}>
              <ChevronUp size={16} />
            </IconButton>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {prs.map((pr) => (
              <div
                key={pr.name}
                className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-slate-600"
              >
                <span className="min-w-0 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                  {pr.name}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {pr.maxWeight > 0 ? `${fmtVol(pr.maxWeight)}kg` : '自重'}
                  </span>
                  {pr.best1RM > 0 && (
                    <Badge tone="amber">
                      1RM {Math.round(pr.best1RM)}
                    </Badge>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── AI 教練分析（可選，有手動 fallback）── */}
      <CoachInsight workouts={workouts} />

      {/* ── Session 列表 ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <CalendarDays size={15} /> 訓練紀錄
            {sorted.length > 0 && (
              <span className="text-xs font-normal text-slate-400">
                （{sorted.length}）
              </span>
            )}
          </h2>
        </div>
        {sorted.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="未有訓練紀錄"
            hint="撳「記錄訓練」加你第一次練習，之後會自動算訓練量同 PR。"
            action={
              <Button icon={Plus} onClick={openNew}>
                記錄訓練
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {sorted.map((w) => (
              <WorkoutRow
                key={w.id}
                workout={w}
                onEdit={() => openEdit(w)}
                onDelete={() => setConfirmDel(w)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── 新增 / 編輯 Modal ── */}
      {modalOpen && (
        <WorkoutEditor
          initial={editing}
          history={workouts}
          onClose={() => {
            setModalOpen(false)
            setEditing(null)
          }}
          onSave={handleSave}
        />
      )}

      {/* ── 刪除確認 ── */}
      <Modal
        open={confirmDel !== null}
        onClose={() => setConfirmDel(null)}
        title="刪除訓練？"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDel(null)}>
              取消
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => confirmDel && handleDelete(confirmDel)}
            >
              刪除
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          確定刪除「{confirmDel?.title || confirmDel?.date}」？此操作無法復原。
        </p>
      </Modal>

      {/* ── 槓片計算器 ── */}
      <PlateCalculator open={plateOpen} onClose={() => setPlateOpen(false)} />
    </div>
  )
}

// ============================================================
//  組間休息計時器（純前端 setInterval，卸載清 timer）
// ------------------------------------------------------------
//  - 預設秒數可調（加 / 減 15s，常用 60/90/120 快捷）。
//  - 倒數到 0 → onDone（呼叫者出 toast）+ 視覺提示，計時器停。
//  - 卸載 / 關閉一定清 interval（防 React state update on unmounted）。
// ============================================================
const REST_PRESETS = [60, 90, 120, 180] as const

function RestTimer({
  onClose,
  onDone,
  defaultSeconds = 90,
}: {
  onClose: () => void
  onDone: () => void
  defaultSeconds?: number
}) {
  const [duration, setDuration] = useState(defaultSeconds)
  const [remaining, setRemaining] = useState(defaultSeconds)
  const [running, setRunning] = useState(true)
  const [finished, setFinished] = useState(false)
  // 用 ref 攞最新 onDone，避免 effect 因 callback 身份變而重起 interval。
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(id)
          setRunning(false)
          setFinished(true)
          onDoneRef.current()
          return 0
        }
        return r - 1
      })
    }, 1000)
    // 卸載 / running 變更 → 清 timer（鐵則：元件卸載要清）。
    return () => window.clearInterval(id)
  }, [running])

  function reset(toSeconds: number) {
    const s = Math.max(0, Math.floor(toSeconds))
    setDuration(s)
    setRemaining(s)
    setFinished(false)
    setRunning(s > 0)
  }
  function adjust(delta: number) {
    reset(duration + delta)
  }

  const pct = duration > 0 ? Math.max(0, Math.min(100, (remaining / duration) * 100)) : 0

  return (
    <div
      className={cx(
        'mt-3 rounded-xl border p-3 transition-colors',
        finished
          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10'
          : 'border-accent/30 bg-accent-soft/50 dark:border-accent/30 dark:bg-accent/10',
      )}
      role="group"
      aria-label="組間休息計時器"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Timer
            size={16}
            className={finished ? 'text-emerald-600 dark:text-emerald-400' : 'text-accent'}
          />
          <span
            className="text-xl font-bold tabular-nums text-slate-800 dark:text-slate-100"
            aria-live="polite"
          >
            {formatClock(remaining)}
          </span>
          {finished && (
            <Badge tone="green" dot>
              休息完
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton label="減 15 秒" size="sm" onClick={() => adjust(-15)}>
            <span className="text-xs font-semibold tabular-nums">−15</span>
          </IconButton>
          <IconButton label="加 15 秒" size="sm" onClick={() => adjust(15)}>
            <span className="text-xs font-semibold tabular-nums">+15</span>
          </IconButton>
          {finished ? (
            <IconButton
              label="重新計時"
              size="sm"
              onClick={() => reset(duration)}
            >
              <RotateCcw size={15} />
            </IconButton>
          ) : (
            <IconButton
              label={running ? '暫停' : '繼續'}
              size="sm"
              active={running}
              onClick={() => setRunning((v) => !v)}
            >
              {running ? <Pause size={15} /> : <Play size={15} />}
            </IconButton>
          )}
          <IconButton label="關閉計時器" size="sm" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>
      </div>
      {/* 進度條 */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/60 dark:bg-slate-900/50">
        <div
          className={cx(
            'h-full rounded-full transition-[width] duration-1000 ease-linear',
            finished ? 'bg-emerald-500' : 'bg-accent',
          )}
          style={{ width: `${finished ? 100 : pct}%` }}
        />
      </div>
      {/* 常用秒數快捷 */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {REST_PRESETS.map((s) => (
          <button
            key={s}
            onClick={() => reset(s)}
            aria-pressed={duration === s}
            className={cx(
              'rounded-md px-2 py-0.5 text-xs font-medium tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
              duration === s
                ? 'bg-accent text-white'
                : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800',
            )}
          >
            {formatClock(s)}
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================
//  槓片計算器（Modal）：目標總重 → 每邊槓片組合
// ============================================================
function PlateCalculator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [target, setTarget] = useState('100')
  const [bar, setBar] = useState('20')

  const plan = useMemo(() => {
    const t = Number(target)
    const b = Number(bar)
    return computePlates(
      Number.isFinite(t) ? t : 0,
      Number.isFinite(b) && b >= 0 ? b : 20,
      DEFAULT_PLATES_KG,
    )
  }, [target, bar])

  return (
    <Modal open={open} onClose={onClose} size="md" title="槓片計算器">
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          輸入目標總重同空槓重，計每邊要上嘅槓片（{DEFAULT_PLATES_KG.join('／')}
          kg）。
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="目標總重 (kg)" required>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.5"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="100"
              aria-label="目標總重 kg"
            />
          </Field>
          <Field label="空槓重 (kg)" hint="標準 20、女槓 15">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.5"
              value={bar}
              onChange={(e) => setBar(e.target.value)}
              placeholder="20"
              aria-label="空槓重 kg"
            />
          </Field>
        </div>

        {/* 結果 */}
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          {plan.belowBar ? (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              目標低過空槓重（{bar || 0}kg），唔使上片。
            </p>
          ) : plan.perSide.length === 0 ? (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              {Number(target) === Number(bar)
                ? '啱啱好係空槓重，唔使上片。'
                : '湊唔到任何一片（可用槓片太大）。'}
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                每邊（×2）
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {plan.perSide.map((p, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-md bg-accent-soft px-2.5 py-1 text-sm font-semibold tabular-nums text-accent-strong dark:bg-accent/15 dark:text-accent"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400">實際可達</span>
            <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
              {fmtVol(plan.achievableKg)} kg
            </span>
          </div>
          {plan.remainderKg > 0 && (
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-amber-600 dark:text-amber-400">湊唔齊</span>
              <Badge tone="amber">差 {fmtVol(plan.remainderKg)} kg</Badge>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ============================================================
//  Session 列（一次訓練摘要）
// ============================================================
function WorkoutRow({
  workout,
  onEdit,
  onDelete,
}: {
  workout: Workout
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const vol = workoutVolume(workout)
  const setCount = workoutSetCount(workout)
  const rpe = maxRpe(workout)
  const dow = WEEKDAY_LABELS[fromKey(workout.date).getDay()]

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? '收起動作' : '展開動作'}
          aria-expanded={open}
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong transition hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-accent/15 dark:text-accent"
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {workout.title || '訓練'}
            </span>
            <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
              {workout.date}（{dow}）
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">{fmtVol(vol)} kg</Badge>
            <Badge tone="slate">
              {workout.exercises.length} 動作 · {setCount} 組
            </Badge>
            {rpe !== null && (
              <Badge tone={rpe >= 8 ? 'rose' : 'amber'}>RPE {rpe}</Badge>
            )}
          </div>
          {workout.note && !open && (
            <p className="mt-1.5 line-clamp-1 text-xs text-slate-400 dark:text-slate-500">
              {workout.note}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label="編輯訓練" size="sm" onClick={onEdit}>
            <Pencil size={15} />
          </IconButton>
          <IconButton label="刪除訓練" size="sm" tone="danger" onClick={onDelete}>
            <Trash2 size={15} />
          </IconButton>
        </div>
      </div>
      {open && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-800/40">
          <div className="space-y-2.5">
            {workout.exercises.map((ex, i) => (
              <div key={i}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {ex.name || `動作 ${i + 1}`}
                  </span>
                  <span className="text-xs tabular-nums text-slate-400">
                    {fmtVol(
                      ex.sets.reduce(
                        (s, st) => s + (st.reps || 0) * (st.weightKg || 0),
                        0,
                      ),
                    )}{' '}
                    kg
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {ex.sets.map((st, j) => (
                    <span
                      key={j}
                      className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs tabular-nums text-slate-600 ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
                    >
                      {st.reps}×{st.weightKg}kg
                      {typeof st.rpe === 'number' && (
                        <span className="text-amber-500">@{st.rpe}</span>
                      )}
                    </span>
                  ))}
                  {ex.sets.length === 0 && (
                    <span className="text-xs text-slate-400">未填組數</span>
                  )}
                </div>
              </div>
            ))}
            {workout.note && (
              <p className="border-t border-slate-200 pt-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {workout.note}
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

// ============================================================
//  AI 教練分析（可選；未設定 / 失敗都唔阻功能）
// ============================================================
function CoachInsight({ workouts }: { workouts: Workout[] }) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [insight, setInsight] = useState<string | null>(null)

  async function analyze() {
    setLoading(true)
    setInsight(null)
    try {
      const recent = sortWorkoutsDesc(workouts).slice(0, 10)
      const summary = recent
        .map(
          (w) =>
            `${w.date}: ${w.exercises
              .map(
                (e) =>
                  `${e.name}(${e.sets
                    .map(
                      (s) =>
                        `${s.reps}x${s.weightKg}kg${s.rpe ? `@RPE${s.rpe}` : ''}`,
                    )
                    .join(',')})`,
              )
              .join('; ')}`,
        )
        .join('\n')
      const messages: AIMessage[] = [
        {
          role: 'user',
          content:
            '你係一位健身教練。以下係我近期訓練紀錄（日期: 動作(次數x重量kg@RPE)）：\n\n' +
            summary +
            '\n\n用繁體中文（廣東話書面語），俾 2-3 點具體建議：訓練量趨勢、疲勞/恢復、下一步點加量或減載。每點一句，唔好客套，唔好醫療診斷。',
        },
      ]
      const out = await complete({ messages, temperature: 0.6 })
      setInsight(out.trim() || '暫時冇建議，繼續記錄更多訓練先。')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI 分析失敗')
    } finally {
      setLoading(false)
    }
  }

  if (!isAIConfigured) {
    return (
      <Card padded className="border-dashed">
        <div className="flex items-start gap-3">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-slate-400" />
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              AI 教練分析
            </p>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
              需要先設定雲端 AI（見 docs/SETUP.md）。你照樣可以手動睇上面嘅趨勢圖同 PR。
            </p>
          </div>
        </div>
      </Card>
    )
  }

  const canAnalyze = workouts.length > 0

  return (
    <Card padded>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Sparkles size={15} className="text-accent" /> AI 教練分析
        </h2>
        <Button
          size="sm"
          variant="secondary"
          icon={Sparkles}
          loading={loading}
          disabled={!canAnalyze}
          onClick={analyze}
        >
          {insight ? '重新分析' : '分析趨勢'}
        </Button>
      </div>
      {!canAnalyze && (
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          記錄至少一次訓練後即可分析。
        </p>
      )}
      {loading && !insight && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-accent-soft/60 px-3 py-3 text-sm text-slate-500 dark:bg-accent/10 dark:text-slate-300">
          <span className="flex gap-1" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.2s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.1s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
          </span>
          教練分析緊你嘅訓練趨勢…
        </div>
      )}
      {insight && (
        <div className="mt-3 whitespace-pre-wrap rounded-2xl bg-accent-soft/60 p-3.5 text-sm leading-relaxed text-slate-700 dark:bg-accent/10 dark:text-slate-200">
          {insight}
        </div>
      )}
    </Card>
  )
}

// ============================================================
//  訓練編輯器（Modal）：多動作 × 多 set
// ============================================================
interface DraftSet {
  reps: string
  weightKg: string
  rpe: string
}
interface DraftExercise {
  key: string
  name: string
  sets: DraftSet[]
}

function blankSet(): DraftSet {
  return { reps: '', weightKg: '', rpe: '' }
}
function blankExercise(): DraftExercise {
  return { key: uid(), name: '', sets: [blankSet()] }
}

function toDraft(w: Workout | null): {
  date: string
  title: string
  note: string
  exercises: DraftExercise[]
} {
  if (!w)
    return {
      date: todayKey(),
      title: '',
      note: '',
      exercises: [blankExercise()],
    }
  return {
    date: w.date,
    title: w.title ?? '',
    note: w.note ?? '',
    exercises:
      w.exercises.length > 0
        ? w.exercises.map((e) => ({
            key: uid(),
            name: e.name,
            sets:
              e.sets.length > 0
                ? e.sets.map((s) => ({
                    reps: String(s.reps ?? ''),
                    weightKg: String(s.weightKg ?? ''),
                    rpe: s.rpe === undefined ? '' : String(s.rpe),
                  }))
                : [blankSet()],
          }))
        : [blankExercise()],
  }
}

function WorkoutEditor({
  initial,
  history,
  onClose,
  onSave,
}: {
  initial: Workout | null
  history: Workout[]
  onClose: () => void
  onSave: (data: Omit<Workout, 'id' | 'createdAt'>) => void
}) {
  const toast = useToast()
  const start = useMemo(() => toDraft(initial), [initial])
  const [date, setDate] = useState(start.date)
  const [title, setTitle] = useState(start.title)
  const [note, setNote] = useState(start.note)
  const [exercises, setExercises] = useState<DraftExercise[]>(start.exercises)
  // 組間休息計時器（一個編輯器一個，避免多 timer 撞）。
  const [restFor, setRestFor] = useState<string | null>(null)

  // 即時預覽 volume
  const previewVol = useMemo(
    () =>
      exercises.reduce(
        (sum, ex) =>
          sum +
          ex.sets.reduce(
            (s, st) =>
              s + clampNum(st.reps) * clampNum(st.weightKg),
            0,
          ),
        0,
      ),
    [exercises],
  )

  function patchExercise(key: string, patch: Partial<DraftExercise>) {
    setExercises((prev) =>
      prev.map((e) => (e.key === key ? { ...e, ...patch } : e)),
    )
  }
  function patchSet(exKey: string, idx: number, patch: Partial<DraftSet>) {
    setExercises((prev) =>
      prev.map((e) =>
        e.key === exKey
          ? {
              ...e,
              sets: e.sets.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
            }
          : e,
      ),
    )
  }
  function addSet(exKey: string) {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.key !== exKey) return e
        const last = e.sets[e.sets.length - 1]
        // 1) 同動作有上一組 → 帶上一組重量次數（省輸入）。
        // 2) 第一組（未填） → 由歷史搵「上次同名動作」最後一組預填。
        let next: DraftSet
        if (last && (last.reps.trim() !== '' || last.weightKg.trim() !== '')) {
          next = { reps: last.reps, weightKg: last.weightKg, rpe: '' }
        } else {
          const prevSet = lastSetOf(history, e.name)
          next = prevSet
            ? { reps: String(prevSet.reps), weightKg: String(prevSet.weightKg), rpe: '' }
            : blankSet()
        }
        return { ...e, sets: [...e.sets, next] }
      }),
    )
  }

  /** 動作名 blur 時：若第一組仍空白，用上次同名動作最後一組預填（加快記錄）。 */
  function prefillFromHistory(exKey: string) {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.key !== exKey) return e
        const onlySet = e.sets.length === 1 ? e.sets[0] : null
        const empty =
          onlySet && onlySet.reps.trim() === '' && onlySet.weightKg.trim() === ''
        if (!empty) return e
        const prevSet = lastSetOf(history, e.name)
        if (!prevSet) return e
        return {
          ...e,
          sets: [{ reps: String(prevSet.reps), weightKg: String(prevSet.weightKg), rpe: '' }],
        }
      }),
    )
  }
  function removeSet(exKey: string, idx: number) {
    setExercises((prev) =>
      prev.map((e) =>
        e.key === exKey
          ? { ...e, sets: e.sets.filter((_, i) => i !== idx) }
          : e,
      ),
    )
  }
  function addExercise() {
    setExercises((prev) => [...prev, blankExercise()])
  }
  function removeExercise(key: string) {
    setExercises((prev) =>
      prev.length === 1 ? prev : prev.filter((e) => e.key !== key),
    )
  }

  function handleSubmit() {
    if (!date) {
      toast.error('請揀日期')
      return
    }
    // 過濾：有名 + 至少一組有效 set
    const clean: Exercise[] = []
    for (const ex of exercises) {
      const name = ex.name.trim()
      const sets: WorkoutSet[] = []
      for (const s of ex.sets) {
        const reps = clampNum(s.reps)
        const weightKg = clampNum(s.weightKg)
        // 全空（冇 reps 又冇 weight）就跳過
        if (s.reps.trim() === '' && s.weightKg.trim() === '') continue
        const rpeRaw = s.rpe.trim()
        const set: WorkoutSet = { reps, weightKg }
        if (rpeRaw !== '') {
          const r = Math.min(10, Math.max(1, clampNum(s.rpe)))
          set.rpe = r
        }
        sets.push(set)
      }
      if (name === '' && sets.length === 0) continue
      clean.push({ name: name || '動作', sets })
    }
    if (clean.length === 0) {
      toast.error('最少加一個動作同一組')
      return
    }
    onSave({
      date,
      title: title.trim() || undefined,
      note: note.trim() || undefined,
      exercises: clean,
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={initial ? '編輯訓練' : '記錄訓練'}
      footer={
        <>
          <div className="mr-auto text-xs text-slate-400 dark:text-slate-500">
            預計訓練量{' '}
            <span className="font-semibold tabular-nums text-slate-600 dark:text-slate-300">
              {fmtVol(previewVol)} kg
            </span>
          </div>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSubmit}>{initial ? '儲存' : '記錄'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="日期" required>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="標題" hint="例如：推日 · 胸肩三頭">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="（可選）"
            />
          </Field>
        </div>

        {/* 動作清單 */}
        <div className="space-y-3">
          {exercises.map((ex, exIdx) => (
            <div
              key={ex.key}
              className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {exIdx + 1}
                </span>
                <Input
                  value={ex.name}
                  onChange={(e) => patchExercise(ex.key, { name: e.target.value })}
                  onBlur={() => prefillFromHistory(ex.key)}
                  placeholder="動作名（例：槓鈴臥推）"
                  className="flex-1"
                />
                <IconButton
                  label="刪除動作"
                  size="sm"
                  tone="danger"
                  disabled={exercises.length === 1}
                  onClick={() => removeExercise(ex.key)}
                >
                  <X size={16} />
                </IconButton>
              </div>

              {/* set 列 */}
              <div className="mt-2.5 space-y-1.5">
                <div className="grid grid-cols-[1.5rem_1fr_1fr_1fr_1.75rem_1.75rem] items-center gap-1.5 px-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  <span className="text-center">#</span>
                  <span>次數</span>
                  <span>重量 kg</span>
                  <span>RPE</span>
                  <span />
                  <span />
                </div>
                {ex.sets.map((st, setIdx) => (
                  <div
                    key={setIdx}
                    className="grid grid-cols-[1.5rem_1fr_1fr_1fr_1.75rem_1.75rem] items-center gap-1.5"
                  >
                    <span className="text-center text-xs tabular-nums text-slate-400">
                      {setIdx + 1}
                    </span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={st.reps}
                      onChange={(e) =>
                        patchSet(ex.key, setIdx, { reps: e.target.value })
                      }
                      placeholder="8"
                      aria-label={`動作 ${exIdx + 1} 第 ${setIdx + 1} 組次數`}
                      className="min-w-0"
                    />
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.5"
                      value={st.weightKg}
                      onChange={(e) =>
                        patchSet(ex.key, setIdx, { weightKg: e.target.value })
                      }
                      placeholder="60"
                      aria-label={`動作 ${exIdx + 1} 第 ${setIdx + 1} 組重量`}
                      className="min-w-0"
                    />
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={10}
                      value={st.rpe}
                      onChange={(e) =>
                        patchSet(ex.key, setIdx, { rpe: e.target.value })
                      }
                      placeholder="1-10"
                      aria-label={`動作 ${exIdx + 1} 第 ${setIdx + 1} 組 RPE`}
                      className="min-w-0"
                    />
                    <IconButton
                      label="刪除呢組"
                      size="sm"
                      tone="danger"
                      disabled={ex.sets.length === 1}
                      onClick={() => removeSet(ex.key, setIdx)}
                    >
                      <Trash2 size={14} />
                    </IconButton>
                    <IconButton
                      label={`完成第 ${setIdx + 1} 組，開組間休息計時`}
                      size="sm"
                      active={restFor === ex.key}
                      onClick={() => setRestFor(ex.key)}
                    >
                      <Timer size={14} />
                    </IconButton>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => addSet(ex.key)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent transition hover:text-accent-strong focus-visible:outline-none focus-visible:underline"
                >
                  <Plus size={13} /> 加一組
                </button>
                {restFor !== ex.key && (
                  <button
                    onClick={() => setRestFor(ex.key)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-accent focus-visible:outline-none focus-visible:underline dark:text-slate-400"
                  >
                    <Timer size={13} /> 組間休息
                  </button>
                )}
              </div>
              {restFor === ex.key && (
                <RestTimer
                  onClose={() => setRestFor(null)}
                  onDone={() =>
                    toast.success(`休息完！可以練下一組「${ex.name.trim() || '動作'}」`)
                  }
                />
              )}
            </div>
          ))}
        </div>

        <Button
          variant="secondary"
          icon={Plus}
          fullWidth
          onClick={addExercise}
        >
          加動作
        </Button>

        <Field label="備註" hint="（可選）感受、傷患、下次調整…">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例：臥推手感唔錯，下次加 2.5kg"
            rows={2}
          />
        </Field>
      </div>
    </Modal>
  )
}

// 安全解析數字輸入：空 / 非數 / 負 → 0
function clampNum(v: string): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}
