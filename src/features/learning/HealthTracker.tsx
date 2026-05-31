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
} from 'lucide-react'
import { Card, Button, Input, Field, StatCard, Modal, SegmentedControl, EmptyState, cx } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useHealthLogs, useHealthGoals, logDay, saveGoals } from './health/store'
import { MOOD_EMOJI } from './health/types'
import type { HealthGoals } from './health/types'
import { byDate, todayKey, seriesOf, summarize, recentDays, WEEKDAY_LABELS, fromKey } from './health/util'
import { LineTrend, WeekBars, GoalRing } from './health/Charts'

type Range = '14' | '30'

export default function HealthTracker() {
  const logs = useHealthLogs()
  const goals = useHealthGoals()
  const toast = useToast()
  const today = todayKey()
  const [range, setRange] = useState<Range>('14')
  const [goalsOpen, setGoalsOpen] = useState(false)

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

  const set = (patch: Partial<Parameters<typeof logDay>[1]>) => logDay(today, patch)

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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
            <Flame size={18} className="text-accent" />
            今日記錄
            {summary.streak > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                連續 {summary.streak} 日 🔥
              </span>
            )}
          </h2>
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
                <Droplet size={15} className="text-sky-500" /> 飲水
              </div>
              <div className="mt-0.5 text-xs tabular-nums text-slate-400">
                {summary.waterToday} / {goals.waterTargetMl} ml
              </div>
              <div className="mt-1.5 flex gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Plus}
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
            <Smile size={15} className="text-amber-500" /> 今日心情
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
            placeholder="今日身體 / 飲食 / 狀態備註…"
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            onBlur={() => set({ note: draft.note })}
          />
        </div>
      </Card>

      {/* ── KPI 概覽 ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Scale}
          label="體重"
          value={summary.weightKg != null ? summary.weightKg.toFixed(1) : '—'}
          unit={summary.weightKg != null ? 'kg' : ''}
          trend={
            summary.weightDelta7 != null
              ? {
                  value: `${summary.weightDelta7 > 0 ? '+' : ''}${summary.weightDelta7.toFixed(1)}kg / 週`,
                  dir: summary.weightDelta7 < 0 ? 'down' : summary.weightDelta7 > 0 ? 'up' : 'flat',
                }
              : undefined
          }
        />
        <StatCard
          icon={Moon}
          label="睡眠（7 日均）"
          value={summary.sleepAvg7 != null ? summary.sleepAvg7.toFixed(1) : '—'}
          unit={summary.sleepAvg7 != null ? '小時' : ''}
          highlight={summary.sleepAvg7 != null && summary.sleepAvg7 >= goals.sleepTargetHrs}
        />
        <StatCard
          icon={Dumbbell}
          label="本週運動"
          value={summary.exerciseWeek}
          unit="分鐘"
          hint={`目標 ${goals.exerciseTargetMin}（${summary.exercisePct}%）`}
          highlight={summary.exercisePct >= 100}
        />
        <StatCard
          icon={Smile}
          label="心情（7 日均）"
          value={summary.moodAvg7 != null ? summary.moodAvg7.toFixed(1) : '—'}
          unit={summary.moodAvg7 != null ? '/5' : ''}
        />
      </div>

      {/* ── 趨勢 ── */}
      {hasAny ? (
        <Card className="p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
              <TrendingUp size={18} className="text-accent" />
              趨勢
            </h2>
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
          icon={Flame}
          art="empty-health"
          title="開始記錄你嘅健康"
          hint="喺上面填今日體重、睡眠、運動、飲水同心情，趨勢圖會慢慢長出嚟。"
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
        <Icon size={15} className="text-emerald-500" /> {label}
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
        <span className="min-w-[3.5rem] text-center text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">
          {value}
          <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>
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
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
        <span>{title}</span>
        <span className="text-slate-400">{unit}</span>
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
