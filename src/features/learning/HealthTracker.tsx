import { useEffect, useId, useMemo, useState } from 'react'
import {
  Plus,
  Minus,
  Target,
  Download,
  Flame,
  Scale,
  Moon,
  Dumbbell,
  Droplet,
  Smile,
  TrendingDown,
  TrendingUp,
  Activity,
  HeartPulse,
  CheckCircle2,
  CircleDashed,
  ArrowDownRight,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react'
import { Card, Button, Input, Field, Modal, SegmentedControl, EmptyState, cx } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useHealthLogs, useHealthGoals, logDay, saveGoals } from './health/store'
import { MOOD_EMOJI } from './health/types'
import type { HealthGoals } from './health/types'
import { byDate, todayKey, seriesOf, summarize, recentDays, WEEKDAY_LABELS, fromKey, logsToCsv } from './health/util'
import { LineTrend, WeekBars, GoalRing, TONE_COLOR } from './health/Charts'

type Range = '14' | '30'

// 心情 1–5 對應嘅友善廣東話描述（配 MOOD_EMOJI 同序）
const MOOD_LABELS = ['好攰', '麻麻', '一般', '幾好', '好正'] as const

// 指標色調（淺底深字 + 深色 /15，跟設計系統分類色）
type Tone = 'accent' | 'indigo' | 'emerald' | 'amber' | 'sky' | 'rose'
const TONE_CHIP: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
}

// ───────── 微縮趨勢線（sparkline，純裝飾；接 seriesOf 出嘅逐日值）─────────
//  跳過 null 斷成段，最新點加實心端子；無資料留一條柔和基線（生命徵象空讀）。
function Sparkline({
  points,
  tone,
  width = 96,
  height = 30,
  className,
}: {
  points: (number | null)[]
  tone: Exclude<Tone, 'rose'>
  width?: number
  height?: number
  className?: string
}) {
  const color = TONE_COLOR[tone]
  const vals = points.filter((v): v is number => v != null)
  const pad = 3
  const baseY = height - pad

  if (vals.length === 0) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cx('overflow-visible', className)} aria-hidden="true" focusable="false">
        <line x1={pad} y1={height / 2} x2={width - pad} y2={height / 2} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth={1.5} strokeDasharray="3 4" strokeLinecap="round" />
      </svg>
    )
  }

  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  const xAt = (i: number) => (points.length > 1 ? pad + (i / (points.length - 1)) * innerW : width / 2)
  const yAt = (v: number) => pad + innerH * (1 - (v - min) / span)

  // 連續段（跳過 null）
  const segs: { i: number; v: number }[][] = []
  let cur: { i: number; v: number }[] = []
  points.forEach((v, i) => {
    if (v == null) {
      if (cur.length) segs.push(cur)
      cur = []
    } else cur.push({ i, v })
  })
  if (cur.length) segs.push(cur)

  let lastI = -1
  for (let i = points.length - 1; i >= 0; i -= 1) if (points[i] != null) { lastI = i; break }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cx('overflow-visible', className)} aria-hidden="true" focusable="false">
      <line x1={pad} y1={baseY} x2={width - pad} y2={baseY} className="stroke-slate-100 dark:stroke-slate-700/50" strokeWidth={1} />
      {segs.map((seg, si) =>
        seg.length === 1 ? (
          <circle key={si} cx={xAt(seg[0].i)} cy={yAt(seg[0].v)} r={1.8} fill={color} />
        ) : (
          <path
            key={si}
            d={seg.map((p, k) => `${k === 0 ? 'M' : 'L'}${xAt(p.i).toFixed(1)},${yAt(p.v).toFixed(1)}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
      {lastI >= 0 && points[lastI] != null && (
        <circle cx={xAt(lastI)} cy={yAt(points[lastI] as number)} r={2.4} fill={color} className="stroke-white dark:stroke-slate-800" strokeWidth={1.5} />
      )}
    </svg>
  )
}

// ───────── 生命徵象讀數列（vitals monitor row：標籤 + 大讀數 + sparkline + 狀態）─────────
//  柔和臨床風：hairline 分隔、左色脊、tabular 數字清晰、右側微縮趨勢。
function VitalRow({
  icon: Icon,
  tone,
  label,
  value,
  unit,
  spark,
  trend,
  progress,
  status,
}: {
  icon: LucideIcon
  tone: Exclude<Tone, 'rose'>
  label: string
  value: string | number
  unit?: string
  spark: (number | null)[]
  trend?: { dir: 'up' | 'down' | 'flat'; value: string }
  progress?: number
  status?: { label: string; ok: boolean }
}) {
  const hasReading = value !== '—'
  return (
    <div className="group relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 sm:gap-4 sm:px-5">
      {/* 左色脊（生命徵象通道識別） */}
      <span aria-hidden="true" className="absolute inset-y-3 left-0 w-1 rounded-full" style={{ background: TONE_COLOR[tone], opacity: hasReading ? 0.9 : 0.3 }} />
      <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TONE_CHIP[tone])}>
        <Icon size={16} aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</span>
          {status && (
            <span
              className={cx(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-semibold',
                status.ok
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-700/60 dark:text-slate-400',
              )}
            >
              {status.ok ? <CheckCircle2 size={10} /> : <CircleDashed size={10} />}
              {status.label}
            </span>
          )}
        </div>
        <p className="mt-0.5 flex items-baseline gap-1">
          <span className={cx('font-serif text-[26px] font-semibold leading-none tabular-nums slashed-zero', hasReading ? 'text-slate-800 dark:text-slate-100' : 'text-slate-300 dark:text-slate-600')}>
            {value}
          </span>
          {unit && hasReading && <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{unit}</span>}
          {trend && trend.dir !== 'flat' && (
            <span
              className={cx(
                'inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums',
                trend.dir === 'up' ? 'text-emerald-500' : 'text-rose-500',
              )}
            >
              {trend.dir === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {trend.value}
            </span>
          )}
        </p>
        {progress != null && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
            <div
              className={cx('h-full rounded-full transition-all duration-500', progress >= 100 ? 'bg-emerald-500' : 'bg-accent')}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}
      </div>

      {/* 微縮趨勢（窄屏收窄寬度，避免擠迫 / 溢出） */}
      <div className="shrink-0 self-center">
        <Sparkline points={spark} tone={tone} width={72} height={28} className="sm:hidden" />
        <Sparkline points={spark} tone={tone} width={104} height={30} className="hidden sm:block" />
      </div>
    </div>
  )
}

// ───────── 臨床 masthead 日期（YYYY 年 M 月 D 日 · 星期X）─────────
const WD_FULL = ['日', '一', '二', '三', '四', '五', '六']
function longDateLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const dow = new Date(y, (m || 1) - 1, d || 1).getDay()
  return `${y} 年 ${m} 月 ${d} 日 · 星期${WD_FULL[dow] ?? ''}`
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

  // 同一 render 內 todayLog / 換日 effect / exerciseWeek 都要按日期查 log，
  // 統一砌一次 Map（byDate 純函式，回傳值與重複砌完全一致）。
  const logMap = useMemo(() => byDate(logs), [logs])
  const todayLog = useMemo(() => logMap.get(today), [logMap, today])
  const summary = useMemo(() => summarize(logs, goals), [logs, goals])

  // 體重 / 睡眠 / 備註用本地草稿，blur 先寫（打字順暢）；換日重置。
  const [draft, setDraft] = useState({ weight: '', sleep: '', note: '' })
  useEffect(() => {
    const l = logMap.get(today)
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

  // 一鍵匯出全部每日記錄做 CSV（UTF-8 BOM，中文 Excel 開到）；純讀取。
  // Blob / a.download 流程對齊 focus/HistoryView.tsx exportCsv。
  function exportCsv() {
    const csv = logsToCsv(logs)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `health-${todayKey()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`已匯出 ${logs.length} 日記錄`)
  }

  const days = range === '14' ? 14 : 30
  const exerciseWeek = useMemo(
    () =>
      recentDays(7).map((d) => ({
        label: WEEKDAY_LABELS[fromKey(d).getDay()],
        value: logMap.get(d)?.exerciseMin ?? 0,
        highlight: d === today,
      })),
    [logMap, today],
  )

  const hasAny = logs.length > 0

  // 生命徵象 sparkline 序列（近 14 日逐日；運動用 7 日柱列嘅值）。純衍生。
  const spark = useMemo(
    () => ({
      weight: seriesOf(logs, 'weightKg', 14).map((p) => p.value),
      sleep: seriesOf(logs, 'sleepHrs', 14).map((p) => p.value),
      mood: seriesOf(logs, 'mood', 14).map((p) => p.value),
      exercise: exerciseWeek.map((d) => d.value),
    }),
    [logs, exerciseWeek],
  )

  return (
    <div className="space-y-6">
      {/* ───────── 生命徵象 masthead（自管 header：kicker + serif 標題 + 今日狀態） ───────── */}
      <header className="flex flex-wrap items-end justify-between gap-x-5 gap-y-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.28em] text-accent/70">
            <HeartPulse size={13} aria-hidden="true" />
            生命徵象 · Vitals
          </p>
          <h1 className="mt-1.5 font-serif text-[28px] font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100 sm:text-[32px]">
            健康追蹤
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="tabular-nums">{longDateLabel(today)}</span>
            {summary.streak > 0 && (
              <>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                  <Flame size={12} aria-hidden="true" /> 連續記錄 {summary.streak} 日
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* 今日狀態指示（臨床監測燈號） */}
          <span
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
              summary.loggedToday
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/20'
                : 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
            )}
          >
            <span aria-hidden="true" className={cx('relative flex h-2 w-2', summary.loggedToday && 'text-emerald-500')}>
              <span className={cx('absolute inline-flex h-full w-full rounded-full', summary.loggedToday ? 'animate-ping bg-emerald-400/60' : 'bg-slate-300 dark:bg-slate-600')} />
              <span className={cx('relative inline-flex h-2 w-2 rounded-full', summary.loggedToday ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-500')} />
            </span>
            {summary.loggedToday ? '今日已記錄' : '今日待記錄'}
          </span>
          <Button variant="secondary" size="sm" icon={Target} onClick={() => setGoalsOpen(true)}>
            目標
          </Button>
        </div>
      </header>

      {/* ───────── 生命徵象面板（vitals monitor：hairline 分隔 + sparkline 讀數） ───────── */}
      <Card clip className="animate-fade-in">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 bg-slate-50/60 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-800/40 sm:px-5">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-accent" aria-hidden="true" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">今日讀數</h2>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">近 14 日趨勢</span>
          </div>
          <span className="hidden text-[11px] text-slate-400 dark:text-slate-500 sm:inline">即時更新</span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          <VitalRow
            icon={Scale}
            tone="accent"
            label="體重"
            value={summary.weightKg != null ? summary.weightKg.toFixed(1) : '—'}
            unit="kg"
            spark={spark.weight}
            trend={
              summary.weightDelta7 != null
                ? {
                    value: `${summary.weightDelta7 > 0 ? '+' : ''}${summary.weightDelta7.toFixed(1)}kg`,
                    dir: summary.weightDelta7 < 0 ? 'down' : summary.weightDelta7 > 0 ? 'up' : 'flat',
                  }
                : undefined
            }
          />
          <VitalRow
            icon={Moon}
            tone="indigo"
            label="睡眠 · 7 日均"
            value={summary.sleepAvg7 != null ? summary.sleepAvg7.toFixed(1) : '—'}
            unit="小時"
            spark={spark.sleep}
            status={
              summary.sleepAvg7 != null
                ? { label: `目標 ${goals.sleepTargetHrs}h`, ok: summary.sleepAvg7 >= goals.sleepTargetHrs }
                : undefined
            }
          />
          <VitalRow
            icon={Dumbbell}
            tone="emerald"
            label="本週運動"
            value={summary.exerciseWeek}
            unit="分鐘"
            spark={spark.exercise}
            progress={summary.exercisePct}
            status={{ label: `目標 ${goals.exerciseTargetMin} 分鐘`, ok: summary.exercisePct >= 100 }}
          />
          <VitalRow
            icon={Smile}
            tone="amber"
            label="心情 · 7 日均"
            value={summary.moodAvg7 != null ? summary.moodAvg7.toFixed(1) : '—'}
            unit="/5"
            spark={spark.mood}
          />
        </div>
      </Card>

      {/* ───────── 今日記錄（臨床入錄表） ───────── */}
      <Card className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
              <HeartPulse size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">今日入錄</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">記低今日身體狀態</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={Download}
            onClick={exportCsv}
            disabled={!hasAny}
            title="匯出全部每日記錄做 CSV"
          >
            匯出
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
              <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
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
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
              <Smile size={15} className="text-amber-500" aria-hidden="true" /> 今日心情
            </div>
            <span className="text-xs text-amber-600 dark:text-amber-400" aria-live="polite">
              {todayLog?.mood ? MOOD_LABELS[todayLog.mood - 1] : '撳一個面色記低'}
            </span>
          </div>
          <div className="flex gap-2">
            {MOOD_EMOJI.map((emoji, i) => {
              const v = i + 1
              const on = todayLog?.mood === v
              return (
                <button
                  key={v}
                  type="button"
                  aria-label={`心情 ${MOOD_LABELS[i]}（${v} / 5）`}
                  aria-pressed={on}
                  onClick={() => set({ mood: v })}
                  className={cx(
                    'flex h-11 flex-1 items-center justify-center rounded-xl border text-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    on
                      ? 'border-amber-300 bg-amber-50 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/15'
                      : 'border-slate-200 opacity-80 hover:bg-slate-50 hover:opacity-100 dark:border-slate-700 dark:hover:bg-slate-800',
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

      {/* ── 趨勢 ── */}
      {hasAny ? (
        <Card className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                <TrendingUp size={18} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">趨勢圖譜</h2>
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
          className="min-w-[3.5rem] text-center text-lg font-semibold tabular-nums text-slate-800 dark:text-slate-100"
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
  tone,
  unit,
  children,
}: {
  title: string
  tone: Exclude<Tone, 'rose'>
  unit: string
  decimals?: number
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-3.5 dark:border-slate-700/50 dark:bg-slate-800/40">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: TONE_COLOR[tone] }} />
          <span className="min-w-0 break-words">{title}</span>
        </span>
        <span className="ml-2 shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700/60">
          {unit}
        </span>
      </div>
      {children}
    </div>
  )
}

// ───────── 校準通道行（calibration channel：左色脊 + tone chip + serif 欄名 + 帶單位輸入）─────────
//  呼應主畫面 VitalRow 嘅生命徵象語言：每個目標係一條色脊識別嘅通道，
//  右側用「單位戳印」收尾，輸入沿用共用 <Input>（≥16px 防 iOS zoom）。
function GoalChannel({
  icon: Icon,
  tone,
  label,
  unit,
  optional,
  children,
}: {
  icon: LucideIcon
  tone: Exclude<Tone, 'rose'>
  label: string
  unit: string
  optional?: boolean
  /** render-prop：收一個唯一 id 綁 label↔input（無障礙），回 input 內容 */
  children: (id: string) => React.ReactNode
}) {
  const id = useId()
  return (
    <div className="group relative rounded-2xl border border-slate-200/70 bg-slate-50/50 py-3 pl-4 pr-3.5 dark:border-slate-700/50 dark:bg-slate-800/40">
      {/* 左色脊（通道識別，對齊 VitalRow） */}
      <span aria-hidden="true" className="absolute inset-y-3 left-0 w-1 rounded-full" style={{ background: TONE_COLOR[tone], opacity: 0.9 }} />
      <div className="mb-2 flex items-center gap-2.5">
        <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', TONE_CHIP[tone])}>
          <Icon size={15} aria-hidden="true" />
        </span>
        <label htmlFor={id} className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate font-serif text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
          {optional && (
            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:bg-slate-700/60 dark:text-slate-400">
              可選
            </span>
          )}
        </label>
        <span
          aria-hidden="true"
          className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-500 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700/60"
        >
          {unit}
        </span>
      </div>
      {children(id)}
    </div>
  )
}

// ───────── 目標設定 Modal（生命徵象校準台 / vitals calibration） ─────────
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
            儲存校準
          </Button>
        </>
      }
    >
      {/* 標題區（kicker + serif 標題，對齊 masthead 語言；取代 Modal 預設 title 列） */}
      <div className="mb-4">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.28em] text-accent/70">
          <Target size={13} aria-hidden="true" />
          目標校準 · Targets
        </p>
        <h3 className="mt-1.5 font-serif text-xl font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100">
          健康目標
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          設定每個生命徵象嘅基準值，達標判斷同進度環都會跟住校準。
        </p>
      </div>

      {/* 校準通道（逐個指標對應主畫面色脊） */}
      <div className="space-y-2.5">
        <GoalChannel icon={Moon} tone="indigo" label="每晚睡眠" unit="小時">
          {(id) => (
            <Input id={id} type="number" inputMode="decimal" value={form.sleep} onChange={(e) => setForm((f) => ({ ...f, sleep: e.target.value }))} />
          )}
        </GoalChannel>
        <GoalChannel icon={Dumbbell} tone="emerald" label="每週運動" unit="分鐘">
          {(id) => (
            <>
              <Input id={id} type="number" inputMode="numeric" value={form.exercise} onChange={(e) => setForm((f) => ({ ...f, exercise: e.target.value }))} />
              <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
                <Activity size={12} className="mt-px shrink-0" aria-hidden="true" />
                <span>WHO 建議成人每週至少 150 分鐘中等強度運動</span>
              </p>
            </>
          )}
        </GoalChannel>
        <GoalChannel icon={Droplet} tone="sky" label="每日飲水" unit="ml">
          {(id) => (
            <Input id={id} type="number" inputMode="numeric" value={form.water} onChange={(e) => setForm((f) => ({ ...f, water: e.target.value }))} />
          )}
        </GoalChannel>
        <GoalChannel icon={TrendingDown} tone="accent" label="目標體重" unit="kg" optional>
          {(id) => (
            <Input id={id} type="number" inputMode="decimal" placeholder="可留空" value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} />
          )}
        </GoalChannel>
      </div>
    </Modal>
  )
}
