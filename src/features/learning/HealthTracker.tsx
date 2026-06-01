import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Minus,
  Target,
  Flame,
  Scale,
  Moon,
  Dumbbell,
  Droplet,
  Smile,
  TrendingDown,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react'
import { Card, Button, Input, Field, Modal, SegmentedControl, EmptyState, cx } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useHealthLogs, useHealthGoals, logDay, saveGoals } from './health/store'
import { MOOD_EMOJI } from './health/types'
import type { HealthGoals } from './health/types'
import { byDate, todayKey, seriesOf, summarize, recentDays, WEEKDAY_LABELS, fromKey } from './health/util'
import { LineTrend, WeekBars, GoalRing } from './health/Charts'

type Range = '14' | '30'

// 指標磚色調（淺底深字 + 深色 /15，跟設計系統分類色）
type Tone = 'accent' | 'indigo' | 'emerald' | 'amber' | 'sky' | 'rose'
const TONE_CHIP: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
}

// ───────── 指標磚（bento 風：tone icon chip + 大數字 + 趨勢 / 達標）─────────
function MetricTile({
  icon: Icon,
  tone,
  label,
  value,
  unit,
  hint,
  highlight,
  trend,
  progress,
}: {
  icon: LucideIcon
  tone: Tone
  label: string
  value: string | number
  unit?: string
  hint?: string
  highlight?: boolean
  trend?: { dir: 'up' | 'down' | 'flat'; value: string }
  progress?: number
}) {
  return (
    <div
      className={cx(
        'flex flex-col justify-between rounded-3xl border p-4 transition duration-200',
        highlight
          ? 'border-accent/30 bg-accent-soft/60 dark:border-accent/40 dark:bg-accent/10'
          : 'border-slate-200/80 bg-white shadow-xs hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none dark:hover:border-slate-600',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</span>
        <span className={cx('flex h-8 w-8 items-center justify-center rounded-xl', TONE_CHIP[tone])}>
          <Icon size={16} aria-hidden="true" />
        </span>
      </div>
      <div className="mt-2">
        <p className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100">
            {value}
          </span>
          {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
          {trend && trend.dir !== 'flat' && (
            <span
              className={cx(
                'ml-auto inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums',
                trend.dir === 'up' ? 'text-emerald-500' : 'text-rose-500',
              )}
            >
              {trend.dir === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {trend.value}
            </span>
          )}
        </p>
        {progress != null && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
            <div
              className={cx(
                'h-full rounded-full transition-all duration-500',
                progress >= 100 ? 'bg-emerald-500' : 'bg-accent',
              )}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
        {hint && <p className="mt-1 truncate text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
      </div>
    </div>
  )
}

export default function HealthTracker() {
  const logs = useHealthLogs()
  const goals = useHealthGoals()
  const toast = useToast()
  // today 由定時器推動：長開唔 reload 嘅 PWA 過咗午夜亦會跟住換日（每分鐘 tick，跟其餘畫面慣例）
  const [today, setToday] = useState(() => todayKey())
  const [range, setRange] = useState<Range>('14')
  const [goalsOpen, setGoalsOpen] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      setToday((prev) => {
        const next = todayKey()
        return next === prev ? prev : next
      })
    }, 60000)
    return () => clearInterval(id)
  }, [])

  const todayLog = useMemo(() => byDate(logs).get(today), [logs, today])
  const summary = useMemo(() => summarize(logs, goals), [logs, goals])

  // 體重 / 睡眠 / 備註用本地草稿，blur 先寫（打字順暢）；換日重置。
  const [draft, setDraft] = useState({ weight: '', sleep: '', note: '' })
  useEffect(() => {
    const l = byDate(logs).get(today)
    setDraft({
      weight: l?.weightKg != null ? String(l.weightKg) : '',
      sleep: l?.sleepHrs != null ? String(l.sleepHrs) : '',
      note: l?.note ?? '',
    })
    // 只喺換日時重置，避免覆蓋打字中內容
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today])

  // 寫入永遠用即時計算嘅日期 key，避免 stale closure 把資料寫落舊日（跨午夜安全）
  const set = (patch: Partial<Parameters<typeof logDay>[1]>) => logDay(todayKey(), patch)

  const commitNum = (raw: string, key: 'weightKg' | 'sleepHrs', max: number) => {
    if (raw.trim() === '') return
    const n = parseFloat(raw)
    if (!(Number.isFinite(n) && n > 0 && n <= max)) return
    if (key === 'weightKg') set({ weightKg: n })
    else set({ sleepHrs: n })
  }

  const days = range === '14' ? 14 : 30
  const exerciseWeek = useMemo(
    () =>
      recentDays(7).map((d) => ({
        label: WEEKDAY_LABELS[fromKey(d).getDay()],
        value: byDate(logs).get(d)?.exerciseMin ?? 0,
        highlight: d === today,
      })),
    [logs, today],
  )

  const hasAny = logs.length > 0

  return (
    <div className="space-y-5">
      {/* ── 今日記錄 ── */}
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
              <Flame size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">今日記錄</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">記低今日身體狀態</p>
            </div>
            {summary.streak > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20">
                <Flame size={12} aria-hidden="true" /> 連續 {summary.streak} 日
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" icon={Target} onClick={() => setGoalsOpen(true)}>
            目標
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* 體重 */}
          <Field label="體重（kg）">
            <Input
              type="number"
              inputMode="decimal"
              icon={Scale}
              placeholder="例如 70.5"
              value={draft.weight}
              max={400}
              onChange={(e) => setDraft((d) => ({ ...d, weight: e.target.value }))}
              onBlur={() => commitNum(draft.weight, 'weightKg', 400)}
            />
          </Field>
          {/* 睡眠 */}
          <Field label="睡眠（小時）">
            <Input
              type="number"
              inputMode="decimal"
              icon={Moon}
              placeholder="例如 7.5"
              value={draft.sleep}
              max={24}
              step={0.5}
              onChange={(e) => setDraft((d) => ({ ...d, sleep: e.target.value }))}
              onBlur={() => commitNum(draft.sleep, 'sleepHrs', 24)}
            />
          </Field>
        </div>

        {/* 運動 + 飲水 stepper */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Stepper
            icon={Dumbbell}
            tone="emerald"
            label="運動"
            unit="分鐘"
            value={todayLog?.exerciseMin ?? 0}
            step={5}
            quick={[15, 30]}
            onSet={(v) => set({ exerciseMin: v })}
          />
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <GoalRing pct={summary.waterPct} tone="sky" size={58} stroke={7}>
              <span className="text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">
                {summary.waterPct}%
              </span>
            </GoalRing>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
                <Droplet size={15} className="text-sky-500" aria-hidden="true" /> 飲水
              </div>
              <div
                className="mt-0.5 break-words text-xs tabular-nums text-slate-500 dark:text-slate-400"
                aria-live="polite"
              >
                {summary.waterToday} / {goals.waterTargetMl} ml
              </div>
              <div className="mt-1.5 flex gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                  aria-label="加 250 ml"
                  onClick={() => set({ waterMl: (todayLog?.waterMl ?? 0) + 250 })}
                >
                  250
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Minus}
                  disabled={(todayLog?.waterMl ?? 0) <= 0}
                  onClick={() => set({ waterMl: Math.max(0, (todayLog?.waterMl ?? 0) - 250) })}
                  aria-label="減 250 ml"
                >
                  250
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 心情 */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
            <Smile size={15} className="text-amber-500" aria-hidden="true" /> 今日心情
          </div>
          <div className="flex gap-2">
            {MOOD_EMOJI.map((emoji, i) => {
              const v = i + 1
              const on = todayLog?.mood === v
              return (
                <button
                  key={v}
                  type="button"
                  aria-label={`心情 ${v} / 5`}
                  aria-pressed={on}
                  onClick={() => set({ mood: v })}
                  className={cx(
                    'flex h-11 flex-1 items-center justify-center rounded-xl border text-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    on
                      ? 'border-amber-300 bg-amber-50 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/15'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800',
                  )}
                >
                  {emoji}
                </button>
              )
            })}
          </div>
        </div>

        {/* 備註 */}
        <div className="mt-4">
          <Input
            aria-label="今日備註"
            placeholder="今日身體 / 飲食 / 狀態備註…"
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            onBlur={() => set({ note: draft.note })}
          />
        </div>
      </Card>

      {/* ── KPI 概覽（bento 指標磚）── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          icon={Scale}
          tone="accent"
          label="體重"
          value={summary.weightKg != null ? summary.weightKg.toFixed(1) : '—'}
          unit={summary.weightKg != null ? 'kg' : undefined}
          hint={summary.weightKg == null ? '記低今日體重' : '近 7 日變化'}
          trend={
            summary.weightDelta7 != null
              ? {
                  value: `${summary.weightDelta7 > 0 ? '+' : ''}${summary.weightDelta7.toFixed(1)}kg`,
                  dir: summary.weightDelta7 < 0 ? 'down' : summary.weightDelta7 > 0 ? 'up' : 'flat',
                }
              : undefined
          }
        />
        <MetricTile
          icon={Moon}
          tone="indigo"
          label="睡眠 · 7 日均"
          value={summary.sleepAvg7 != null ? summary.sleepAvg7.toFixed(1) : '—'}
          unit={summary.sleepAvg7 != null ? '小時' : undefined}
          hint={`目標 ${goals.sleepTargetHrs} 小時`}
          highlight={summary.sleepAvg7 != null && summary.sleepAvg7 >= goals.sleepTargetHrs}
        />
        <MetricTile
          icon={Dumbbell}
          tone="emerald"
          label="本週運動"
          value={summary.exerciseWeek}
          unit="分鐘"
          hint={`目標 ${goals.exerciseTargetMin} 分鐘`}
          progress={summary.exercisePct}
          highlight={summary.exercisePct >= 100}
        />
        <MetricTile
          icon={Smile}
          tone="amber"
          label="心情 · 7 日均"
          value={summary.moodAvg7 != null ? summary.moodAvg7.toFixed(1) : '—'}
          unit={summary.moodAvg7 != null ? '/5' : undefined}
          hint={summary.moodAvg7 == null ? '今日心情如何？' : '近 7 日平均'}
        />
      </div>

      {/* ── 趨勢 ── */}
      {hasAny ? (
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                <TrendingUp size={18} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">趨勢</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">睇吓近期變化</p>
              </div>
            </div>
            <SegmentedControl
              value={range}
              onChange={setRange}
              options={[
                { id: '14', label: '14 日' },
                { id: '30', label: '30 日' },
              ]}
              size="sm"
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <TrendBlock title="體重" tone="accent" unit="kg" decimals={1}>
              <LineTrend points={seriesOf(logs, 'weightKg', days)} tone="accent" unit="kg" decimals={1} />
            </TrendBlock>
            <TrendBlock title="睡眠" tone="indigo" unit="小時" decimals={1}>
              <LineTrend points={seriesOf(logs, 'sleepHrs', days)} tone="indigo" unit="h" decimals={1} />
            </TrendBlock>
            <TrendBlock title="運動（本週）" tone="emerald" unit="分鐘">
              <WeekBars data={exerciseWeek} tone="emerald" unit="分鐘" />
            </TrendBlock>
            <TrendBlock title="心情" tone="amber" unit="/5">
              <LineTrend points={seriesOf(logs, 'mood', days)} tone="amber" decimals={0} />
            </TrendBlock>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={TrendingUp}
          art="empty-health"
          title="開始記錄你嘅健康"
          hint="喺上面填今日體重、睡眠、運動、飲水同心情，趨勢圖會慢慢長出嚟。"
          action={
            <Button variant="secondary" size="sm" icon={Target} onClick={() => setGoalsOpen(true)}>
              先設定目標
            </Button>
          }
        />
      )}

      {/* ── 目標設定 ── */}
      <GoalsModal open={goalsOpen} onClose={() => setGoalsOpen(false)} goals={goals} onSave={(g) => {
        saveGoals(g)
        toast.success('目標已更新')
        setGoalsOpen(false)
      }} />
    </div>
  )
}

// ───────── stepper（運動）─────────
function Stepper({
  icon: Icon,
  label,
  unit,
  value,
  step,
  quick,
  onSet,
}: {
  icon: typeof Dumbbell
  tone: string
  label: string
  unit: string
  value: number
  step: number
  quick: number[]
  onSet: (v: number) => void
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
        <Icon size={15} className="text-emerald-500" aria-hidden="true" /> {label}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          icon={Minus}
          disabled={value <= 0}
          aria-label={`減 ${step} ${unit}`}
          onClick={() => onSet(Math.max(0, value - step))}
        />
        <span
          className="min-w-[3.5rem] text-center text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100"
          aria-live="polite"
          aria-label={`${label} ${value} ${unit}`}
        >
          {value}
          <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">{unit}</span>
        </span>
        <Button variant="ghost" size="sm" icon={Plus} aria-label={`加 ${step} ${unit}`} onClick={() => onSet(value + step)} />
        <div className="flex-1" />
        {quick.map((q) => (
          <Button key={q} variant="secondary" size="sm" onClick={() => onSet(value + q)}>
            +{q}
          </Button>
        ))}
      </div>
    </div>
  )
}

function TrendBlock({
  title,
  unit,
  children,
}: {
  title: string
  tone: string
  unit: string
  decimals?: number
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-slate-50/60 p-3 dark:bg-slate-800/40">
      <div className="mb-2 flex items-center justify-between">
        <span className="min-w-0 break-words text-sm font-semibold text-slate-700 dark:text-slate-200">
          {title}
        </span>
        <span className="ml-2 shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700/60">
          {unit}
        </span>
      </div>
      {children}
    </div>
  )
}

// ───────── 目標設定 Modal ─────────
function GoalsModal({
  open,
  onClose,
  goals,
  onSave,
}: {
  open: boolean
  onClose: () => void
  goals: HealthGoals
  onSave: (g: Partial<HealthGoals>) => void
}) {
  const [form, setForm] = useState({
    sleep: String(goals.sleepTargetHrs),
    exercise: String(goals.exerciseTargetMin),
    water: String(goals.waterTargetMl),
    weight: goals.weightTargetKg != null ? String(goals.weightTargetKg) : '',
  })
  useEffect(() => {
    if (open)
      setForm({
        sleep: String(goals.sleepTargetHrs),
        exercise: String(goals.exerciseTargetMin),
        water: String(goals.waterTargetMl),
        weight: goals.weightTargetKg != null ? String(goals.weightTargetKg) : '',
      })
  }, [open, goals])

  const num = (s: string, fallback: number) => {
    const n = parseFloat(s)
    return Number.isFinite(n) && n > 0 ? n : fallback
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="健康目標"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            icon={Target}
            onClick={() =>
              onSave({
                sleepTargetHrs: num(form.sleep, goals.sleepTargetHrs),
                exerciseTargetMin: num(form.exercise, goals.exerciseTargetMin),
                waterTargetMl: num(form.water, goals.waterTargetMl),
                weightTargetKg: form.weight.trim() === '' ? undefined : num(form.weight, 0) || undefined,
              })
            }
          >
            儲存
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="每晚睡眠目標（小時）">
          <Input type="number" inputMode="decimal" icon={Moon} value={form.sleep} onChange={(e) => setForm((f) => ({ ...f, sleep: e.target.value }))} />
        </Field>
        <Field label="每週運動目標（分鐘）" hint="WHO 建議成人每週至少 150 分鐘中等強度運動">
          <Input type="number" inputMode="numeric" icon={Dumbbell} value={form.exercise} onChange={(e) => setForm((f) => ({ ...f, exercise: e.target.value }))} />
        </Field>
        <Field label="每日飲水目標（ml）">
          <Input type="number" inputMode="numeric" icon={Droplet} value={form.water} onChange={(e) => setForm((f) => ({ ...f, water: e.target.value }))} />
        </Field>
        <Field label="目標體重（kg，可留空）">
          <Input type="number" inputMode="decimal" icon={TrendingDown} placeholder="可選" value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} />
        </Field>
      </div>
    </Modal>
  )
}
