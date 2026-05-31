import { useMemo, useState } from 'react'
import {
  Scale,
  Percent,
  Dumbbell,
  Gauge,
  Plus,
  Trash2,
  Ruler,
  Activity,
  Flame,
  PencilLine,
  Target,
  CalendarClock,
  Trophy,
} from 'lucide-react'
import {
  Card,
  Button,
  Input,
  Field,
  StatCard,
  Modal,
  SegmentedControl,
  EmptyState,
  Badge,
  IconButton,
  ProgressBar,
  cx,
} from '../../../../ui'
import { useToast } from '../../../../context/ToastContext'
import { todayKey, FIT_TONE } from '../common'
import { useBodyEntries, useBodyProfile, logBody, removeEntry, saveProfile } from './store'
import type { BodyEntry } from './types'
import {
  bmi,
  bmiBand,
  fatMassKg,
  metricTrend,
  seriesOf,
  compositionChange,
  goalProgress,
  projectedGoalDate,
  recompSeries,
  entriesOf,
  fmtDate,
  fmtDelta,
  deltaDir,
  round,
  isNum,
} from './util'
import type { GoalProgress, GoalEta } from './util'
import { TrendChart, DualLineChart } from './Charts'

// ============================================================
//  體態數據（InBody 式身體組成）主視圖
//  ------------------------------------------------------------
//  快速記錄今日 → KPI（體重/體脂/骨骼肌/BMI + ~30 日 trend）
//  → 趨勢折線（14/30/90 切換）→ 增肌減脂分析 → 歷史列表（可刪）。
//  所有計算抽喺 util.ts（已測）；本檔只負責 UI / 狀態。
// ============================================================

type RangeDays = 14 | 30 | 90

const VERDICT_BADGE: Record<
  string,
  { tone: 'green' | 'amber' | 'blue' | 'rose' | 'slate'; emoji: string }
> = {
  recomp: { tone: 'green', emoji: '🎯' },
  fatLoss: { tone: 'green', emoji: '🔥' },
  muscleGain: { tone: 'blue', emoji: '💪' },
  bulk: { tone: 'blue', emoji: '📈' },
  cutLoss: { tone: 'amber', emoji: '📉' },
  fatGain: { tone: 'rose', emoji: '⚠️' },
  stable: { tone: 'slate', emoji: '➖' },
  insufficient: { tone: 'slate', emoji: '…' },
}

// 趨勢圖三指標設定（各自色調 + 單位）
const TREND_METRICS = [
  { id: 'weightKg', label: '體重', unit: ' kg', color: FIT_TONE.sky },
  { id: 'bodyFatPct', label: '體脂率', unit: ' %', color: FIT_TONE.amber },
  { id: 'skeletalMuscleKg', label: '骨骼肌', unit: ' kg', color: FIT_TONE.emerald },
] as const

type TrendMetricId = (typeof TREND_METRICS)[number]['id']

export default function BodyView() {
  const entries = useBodyEntries()
  const profile = useBodyProfile()
  const toast = useToast()

  const [recordOpen, setRecordOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<BodyEntry | null>(null)
  const [heightOpen, setHeightOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const [range, setRange] = useState<RangeDays>(30)
  const [trendMetric, setTrendMetric] = useState<TrendMetricId>('weightKg')

  const heightCm = profile.heightCm
  const targetKg = profile.weightTargetKg

  // ── KPI：最新值 + ~30 日 trend ──
  const weight = useMemo(() => metricTrend(entries, 'weightKg', 30), [entries])
  const fat = useMemo(() => metricTrend(entries, 'bodyFatPct', 30), [entries])
  const muscle = useMemo(() => metricTrend(entries, 'skeletalMuscleKg', 30), [entries])
  const visceralLatest = useMemo(() => {
    // 內臟脂肪係等級數字，直接攞最新一筆有值嘅
    const withV = entries
      .filter((e) => isNum(e.visceralFat))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
    return withV[0]?.visceralFat ?? null
  }, [entries])

  // BMI（用最新體重 + 身高）+ 約 30 日前 BMI 對比
  const bmiNow = useMemo(() => bmi(weight?.latest, heightCm), [weight, heightCm])
  const bmiInfo = bmiBand(bmiNow)
  const bmiDelta = useMemo(() => {
    if (weight?.delta == null || !isNum(weight.latest) || !isNum(heightCm)) return null
    const prevW = weight.latest - weight.delta
    const a = bmi(prevW, heightCm)
    if (a === null || bmiNow === null) return null
    return round(bmiNow - a, 1)
  }, [weight, heightCm, bmiNow])

  // ── 趨勢序列 ──
  const trendCfg = TREND_METRICS.find((m) => m.id === trendMetric)!
  const series = useMemo(
    () => seriesOf(entries, trendMetric, range),
    [entries, trendMetric, range],
  )

  // ── 增肌減脂分析（用所選區間首尾）──
  const comp = useMemo(() => compositionChange(entries, range), [entries, range])
  const compBadge = VERDICT_BADGE[comp.verdict] ?? VERDICT_BADGE.stable

  // ── 脂肪量 vs 瘦體重 雙線（同一時間軸；睇 recomp 趨勢）──
  const recompData = useMemo(() => recompSeries(entries, range), [entries, range])

  // ── 目標體重進度（起點 fallback：profile.weightStartKg → 最早一筆體重）──
  const startKg = useMemo(() => {
    if (isNum(profile.weightStartKg)) return profile.weightStartKg
    return entriesOf(entries, 'weightKg')[0]?.value
  }, [profile.weightStartKg, entries])
  const goal = useMemo(
    () => goalProgress(weight?.latest, startKg, targetKg),
    [weight, startKg, targetKg],
  )
  // 達標預計日：用所選區間嘅速率線性外推（速率 0 / 反方向 → null）。
  const eta = useMemo(
    () => projectedGoalDate(entries, targetKg, range),
    [entries, targetKg, range],
  )

  // ── 歷史（新→舊）──
  const history = useMemo(
    () => [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [entries],
  )

  const hasAny = entries.length > 0
  const todayLogged = entries.some((e) => e.date === todayKey())

  return (
    <div className="space-y-5">
      {/* ── 標題列 ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
              <Scale size={18} />
            </span>
            體態數據
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            記低 InBody 式身體組成，睇增肌減脂趨勢。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={Ruler}
            onClick={() => setHeightOpen(true)}
          >
            {isNum(heightCm) ? `${heightCm} cm` : '設身高'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Target}
            onClick={() => setGoalOpen(true)}
          >
            {isNum(targetKg) ? `目標 ${round(targetKg, 1)} kg` : '設目標'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => {
              setEditEntry(null)
              setRecordOpen(true)
            }}
          >
            記錄今日
          </Button>
        </div>
      </div>

      {!hasAny ? (
        <EmptyState
          icon={Scale}
          title="未有體態記錄"
          hint="記低今日體重 / 體脂率 / 骨骼肌量，之後就見到趨勢同增肌減脂分析。"
          action={
            <Button icon={Plus} onClick={() => setRecordOpen(true)}>
              記錄今日數據
            </Button>
          }
        />
      ) : (
        <>
          {/* ── KPI 卡 ── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="體重"
              icon={Scale}
              value={weight ? round(weight.latest, 1) : '—'}
              unit={weight ? 'kg' : undefined}
              trend={
                weight?.delta != null
                  ? { value: fmtDelta(weight.delta, 'kg'), dir: deltaDir(weight.delta) }
                  : undefined
              }
              hint={weight ? `最近：${fmtDate(weight.latestDate)}` : '未記錄'}
            />
            <StatCard
              label="體脂率"
              icon={Percent}
              value={fat ? round(fat.latest, 1) : '—'}
              unit={fat ? '%' : undefined}
              trend={
                fat?.delta != null
                  ? { value: fmtDelta(fat.delta, '%'), dir: deltaDir(fat.delta) }
                  : undefined
              }
              hint={fat ? `最近：${fmtDate(fat.latestDate)}` : '未記錄'}
            />
            <StatCard
              label="骨骼肌"
              icon={Dumbbell}
              value={muscle ? round(muscle.latest, 1) : '—'}
              unit={muscle ? 'kg' : undefined}
              trend={
                muscle?.delta != null
                  ? { value: fmtDelta(muscle.delta, 'kg'), dir: deltaDir(muscle.delta) }
                  : undefined
              }
              hint={muscle ? `最近：${fmtDate(muscle.latestDate)}` : '未記錄'}
            />
            <StatCard
              label="BMI"
              icon={Gauge}
              value={bmiNow ?? '—'}
              trend={
                bmiDelta != null
                  ? { value: fmtDelta(bmiDelta), dir: deltaDir(bmiDelta) }
                  : undefined
              }
              hint={
                bmiNow === null
                  ? isNum(heightCm)
                    ? '需要體重'
                    : '先設身高'
                  : (bmiInfo?.label ?? undefined)
              }
            />
          </div>

          {/* 內臟脂肪（如有）以小 badge 帶出 */}
          {visceralLatest !== null && (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Activity size={15} className="text-slate-400" />
              內臟脂肪等級
              <Badge tone={visceralLatest >= 10 ? 'amber' : 'green'}>
                {visceralLatest}
              </Badge>
              <span className="text-xs text-slate-400">（健康一般 &lt; 10）</span>
            </div>
          )}

          {/* ── 目標體重進度 ── */}
          <GoalCard
            targetKg={targetKg}
            startKg={startKg}
            currentKg={weight?.latest}
            goal={goal}
            eta={eta}
            onSetGoal={() => setGoalOpen(true)}
          />

          {/* ── 趨勢折線圖 ── */}
          <Card padded>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <Activity size={16} className="text-accent" />
                趨勢
              </h2>
              <SegmentedControl<`${RangeDays}`>
                size="sm"
                value={`${range}`}
                onChange={(v) => setRange(Number(v) as RangeDays)}
                options={[
                  { id: '14', label: '14 日' },
                  { id: '30', label: '30 日' },
                  { id: '90', label: '90 日' },
                ]}
              />
            </div>

            {/* 指標切換 */}
            <div className="mb-3 flex flex-wrap gap-2">
              {TREND_METRICS.map((m) => {
                const on = m.id === trendMetric
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setTrendMetric(m.id)}
                    aria-pressed={on}
                    className={cx(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                      on
                        ? 'text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                    )}
                    style={on ? { background: m.color } : undefined}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: on ? 'rgba(255,255,255,0.9)' : m.color }}
                    />
                    {m.label}
                  </button>
                )
              })}
            </div>

            <TrendChart data={series} color={trendCfg.color} unit={trendCfg.unit} />
          </Card>

          {/* ── 增肌減脂分析 ── */}
          <Card padded>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <Flame size={16} className="text-accent" />
                增肌減脂分析
              </h2>
              <Badge tone={compBadge.tone}>
                {compBadge.emoji} 近 {range} 日
              </Badge>
            </div>

            {comp.verdict === 'insufficient' ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {comp.summary}
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {comp.summary}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <DeltaTile
                    label="脂肪量變化"
                    delta={comp.fatDeltaKg}
                    goodWhenDown
                    icon={Flame}
                  />
                  <DeltaTile
                    label="瘦體重變化"
                    delta={comp.leanDeltaKg}
                    goodWhenDown={false}
                    icon={Dumbbell}
                  />
                </div>
                {comp.fromDate && comp.toDate && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    比較期間：{fmtDate(comp.fromDate)} → {fmtDate(comp.toDate)}（用區間首尾各一筆「體重＋體脂率」記錄）
                  </p>
                )}
              </div>
            )}

            {/* 脂肪量 vs 瘦體重 雙線疊圖（同一時間軸睇 recomp 走勢） */}
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
              <h3 className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                脂肪量 vs 瘦體重
              </h3>
              <DualLineChart
                data={recompData.map((p) => ({ date: p.date, a: p.fat, b: p.lean }))}
                series={{
                  a: { label: '脂肪量', color: FIT_TONE.amber },
                  b: { label: '瘦體重', color: FIT_TONE.emerald },
                }}
              />
            </div>
          </Card>

          {/* ── 歷史列表 ── */}
          <Card padded>
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <PencilLine size={16} className="text-accent" />
              歷史記錄
              <span className="text-xs font-normal text-slate-400">（{history.length}）</span>
            </h2>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.map((row) => (
                <HistoryRow
                  key={row.id}
                  row={row}
                  heightCm={heightCm}
                  onEdit={() => {
                    setEditEntry(row)
                    setRecordOpen(true)
                  }}
                  onDelete={() => {
                    removeEntry(row.id)
                    toast.success(`已刪除 ${fmtDate(row.date)} 記錄`)
                  }}
                />
              ))}
            </ul>
          </Card>
        </>
      )}

      {/* ── 記錄 / 編輯 Modal ── */}
      <RecordModal
        open={recordOpen}
        entry={editEntry}
        existingDates={entries.map((e) => e.date)}
        todayDone={todayLogged}
        onClose={() => {
          setRecordOpen(false)
          setEditEntry(null)
        }}
        onSaved={(isEdit) => {
          toast.success(isEdit ? '已更新記錄' : '已記錄今日數據')
          setRecordOpen(false)
          setEditEntry(null)
        }}
      />

      {/* ── 身高設定 Modal ── */}
      <HeightModal
        open={heightOpen}
        heightCm={heightCm}
        onClose={() => setHeightOpen(false)}
        onSaved={() => {
          toast.success('已更新身高')
          setHeightOpen(false)
        }}
      />

      {/* ── 目標體重 Modal ── */}
      <GoalModal
        open={goalOpen}
        targetKg={targetKg}
        startKg={profile.weightStartKg}
        latestKg={weight?.latest}
        onClose={() => setGoalOpen(false)}
        onSaved={() => {
          toast.success('已更新目標')
          setGoalOpen(false)
        }}
      />

      {/* ── 誠實私隱 ── */}
      <p className="pt-1 text-center text-xs text-slate-400 dark:text-slate-500">
        體態數據只存喺你裝置；登入後同步到你自己嘅 Supabase。本工具僅供個人健康參考，唔構成醫療建議。
      </p>
    </div>
  )
}

// ============================================================
//  子元件
// ============================================================

// ───────── 目標體重進度 + 達標預計 ─────────

function GoalCard({
  targetKg,
  startKg,
  currentKg,
  goal,
  eta,
  onSetGoal,
}: {
  targetKg?: number
  startKg?: number
  currentKg?: number
  goal: GoalProgress
  eta: GoalEta
  onSetGoal: () => void
}) {
  // 未設目標：提示設定（唔靜靜消失）。
  if (!isNum(targetKg)) {
    return (
      <Card padded>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
              <Target size={17} />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                未設目標體重
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                設定目標後即見進度條同達標預計日。
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" icon={Target} onClick={onSetGoal}>
            設定目標
          </Button>
        </div>
      </Card>
    )
  }

  const pct = goal.pct
  const reached = goal.reached
  // 進度條色調：達標綠、減重藍、增重 accent。
  const tone: 'accent' | 'green' = reached ? 'green' : 'accent'

  return (
    <Card padded>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Target size={16} className="text-accent" />
          目標體重進度
        </h2>
        {reached ? (
          <Badge tone="green">
            <Trophy size={12} className="mr-0.5 inline" />
            已達標
          </Badge>
        ) : (
          <Badge tone="slate">目標 {round(targetKg, 1)} kg</Badge>
        )}
      </div>

      {/* 起點 → 現在 → 目標 */}
      <div className="mb-2 flex items-end justify-between gap-2 text-xs">
        <span className="text-slate-500 dark:text-slate-400">
          起點 {isNum(startKg) ? `${round(startKg, 1)}kg` : '—'}
        </span>
        <span className="text-base font-bold tabular-nums text-slate-800 dark:text-slate-100">
          {isNum(currentKg) ? `${round(currentKg, 1)}kg` : '—'}
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          目標 {round(targetKg, 1)}kg
        </span>
      </div>

      {pct === null ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {isNum(startKg)
            ? '起點同目標相同，未量度到進度範圍。'
            : '需要一筆體重記錄做起點先計到進度。'}
        </p>
      ) : (
        <>
          <ProgressBar value={pct} tone={tone} showValue />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              {reached
                ? '已達到目標 👏'
                : goal.remainingKg != null
                  ? `仲差 ${Math.abs(goal.remainingKg)}kg`
                  : ''}
            </span>
            {/* 達標預計日 */}
            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <CalendarClock size={13} className="text-accent" />
              {eta.reached
                ? '已達標'
                : eta.dateKey
                  ? `預計 ${fmtDate(eta.dateKey)}（約 ${eta.daysAway} 日）`
                  : '預計：速率不足 / 方向相反，暫推算不到'}
            </span>
          </div>
          {eta.dateKey && eta.rateKgPerWeek != null && (
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              按近期 {fmtDelta(eta.rateKgPerWeek, ' kg')}/週 線性外推（僅供參考，實際會浮動）。
            </p>
          )}
        </>
      )}
    </Card>
  )
}

function DeltaTile({
  label,
  delta,
  goodWhenDown,
  icon: I,
}: {
  label: string
  delta: number | null
  goodWhenDown: boolean
  icon: typeof Flame
}) {
  // 「好」= 脂肪落 / 瘦體重升。flat 用中性。
  const dir = deltaDir(delta)
  const good =
    dir === 'flat' ? null : goodWhenDown ? dir === 'down' : dir === 'up'
  const color =
    good === null
      ? 'text-slate-500 dark:text-slate-400'
      : good
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-rose-500 dark:text-rose-400'
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
        <I size={13} className="text-slate-400" />
        {label}
      </p>
      <p className={cx('mt-1 text-xl font-bold tabular-nums', color)}>
        {fmtDelta(delta, ' kg')}
      </p>
    </div>
  )
}

function HistoryRow({
  row,
  heightCm,
  onEdit,
  onDelete,
}: {
  row: BodyEntry
  heightCm?: number
  onEdit: () => void
  onDelete: () => void
}) {
  const b = bmi(row.weightKg, heightCm)
  const fat = fatMassKg(row.weightKg, row.bodyFatPct)
  const cells: { v: string; muted?: boolean }[] = [
    { v: isNum(row.weightKg) ? `${round(row.weightKg, 1)} kg` : '—', muted: !isNum(row.weightKg) },
    { v: isNum(row.bodyFatPct) ? `${round(row.bodyFatPct, 1)}%` : '—', muted: !isNum(row.bodyFatPct) },
    {
      v: isNum(row.skeletalMuscleKg) ? `肌 ${round(row.skeletalMuscleKg, 1)}` : '—',
      muted: !isNum(row.skeletalMuscleKg),
    },
  ]
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {fmtDate(row.date)}
          </span>
          {b !== null && (
            <Badge tone="slate">BMI {b}</Badge>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums">
          {cells.map((c, i) => (
            <span
              key={i}
              className={cx(
                c.muted ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400',
              )}
            >
              {c.v}
            </span>
          ))}
          {fat !== null && (
            <span className="text-slate-400 dark:text-slate-500">脂 {fat} kg</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        <IconButton label={`編輯 ${fmtDate(row.date)} 記錄`} size="sm" onClick={onEdit}>
          <PencilLine size={16} />
        </IconButton>
        <IconButton
          label={`刪除 ${fmtDate(row.date)} 記錄`}
          size="sm"
          tone="danger"
          onClick={onDelete}
        >
          <Trash2 size={16} />
        </IconButton>
      </div>
    </li>
  )
}

// ───────── 記錄 / 編輯 Modal ─────────

function RecordModal({
  open,
  entry,
  existingDates,
  todayDone,
  onClose,
  onSaved,
}: {
  open: boolean
  entry: BodyEntry | null
  existingDates: string[]
  todayDone: boolean
  onClose: () => void
  onSaved: (isEdit: boolean) => void
}) {
  const isEdit = entry !== null
  const date = entry?.date ?? todayKey()

  // 受控輸入（字串，提交時 parse；空 = 唔記該欄）
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [muscle, setMuscle] = useState('')
  const [visceral, setVisceral] = useState('')

  // 開啟時用 entry 初始化（或清空）
  const [seeded, setSeeded] = useState<string | null>(null)
  const seedKey = `${open}-${entry?.id ?? 'new'}`
  if (open && seeded !== seedKey) {
    setWeight(isNum(entry?.weightKg) ? String(entry!.weightKg) : '')
    setBodyFat(isNum(entry?.bodyFatPct) ? String(entry!.bodyFatPct) : '')
    setMuscle(isNum(entry?.skeletalMuscleKg) ? String(entry!.skeletalMuscleKg) : '')
    setVisceral(isNum(entry?.visceralFat) ? String(entry!.visceralFat) : '')
    setSeeded(seedKey)
  }
  if (!open && seeded !== null) setSeeded(null)

  // 解析輸入：空字串 → undefined（唔記）；無效 → null（顯示錯誤）
  const parse = (s: string): number | undefined | null => {
    const t = s.trim()
    if (t === '') return undefined
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }
  const w = parse(weight)
  const bf = parse(bodyFat)
  const sm = parse(muscle)
  const vf = parse(visceral)

  const invalid =
    w === null ||
    bf === null ||
    sm === null ||
    vf === null ||
    (typeof bf === 'number' && (bf < 0 || bf > 100)) ||
    (typeof w === 'number' && w < 0) ||
    (typeof sm === 'number' && sm < 0) ||
    (typeof vf === 'number' && vf < 0)

  const allEmpty =
    w === undefined && bf === undefined && sm === undefined && vf === undefined

  const submit = () => {
    if (invalid || allEmpty) return
    logBody(date, {
      weightKg: w as number | undefined,
      bodyFatPct: bf as number | undefined,
      skeletalMuscleKg: sm as number | undefined,
      visceralFat: vf as number | undefined,
    })
    onSaved(isEdit)
  }

  const dupeToday = !isEdit && todayDone && date === todayKey() && existingDates.includes(date)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `編輯 ${fmtDate(date)}` : '記錄今日數據'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={invalid || allEmpty}>
            {isEdit ? '儲存' : '記錄'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {dupeToday && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            今日已有記錄，再記會覆寫（一日一條）。
          </p>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500">
          日期：{fmtDate(date)} · 各欄可留空（淨記你今日有量度嘅指標）。
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="體重 (kg)">
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              placeholder="例如 70.5"
              value={weight}
              invalid={w === null || (typeof w === 'number' && w < 0)}
              onChange={(e) => setWeight(e.target.value)}
            />
          </Field>
          <Field label="體脂率 (%)" error={typeof bf === 'number' && (bf < 0 || bf > 100) ? '0–100' : undefined}>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              max="100"
              placeholder="例如 18.5"
              value={bodyFat}
              invalid={bf === null || (typeof bf === 'number' && (bf < 0 || bf > 100))}
              onChange={(e) => setBodyFat(e.target.value)}
            />
          </Field>
          <Field label="骨骼肌 (kg)">
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              placeholder="例如 32.0"
              value={muscle}
              invalid={sm === null || (typeof sm === 'number' && sm < 0)}
              onChange={(e) => setMuscle(e.target.value)}
            />
          </Field>
          <Field label="內臟脂肪等級" hint="InBody 一般 1–20">
            <Input
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              placeholder="例如 7"
              value={visceral}
              invalid={vf === null || (typeof vf === 'number' && vf < 0)}
              onChange={(e) => setVisceral(e.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

// ───────── 身高設定 Modal ─────────

function HeightModal({
  open,
  heightCm,
  onClose,
  onSaved,
}: {
  open: boolean
  heightCm?: number
  onClose: () => void
  onSaved: () => void
}) {
  const [val, setVal] = useState('')
  const [seeded, setSeeded] = useState(false)
  if (open && !seeded) {
    setVal(isNum(heightCm) ? String(heightCm) : '')
    setSeeded(true)
  }
  if (!open && seeded) setSeeded(false)

  const n = Number(val.trim())
  const valid = val.trim() !== '' && Number.isFinite(n) && n > 0 && n < 300

  const submit = () => {
    if (!valid) return
    saveProfile({ heightCm: round(n, 1) })
    onSaved()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="設定身高"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={!valid}>
            儲存
          </Button>
        </>
      }
    >
      <Field label="身高 (cm)" hint="用嚟計 BMI">
        <Input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          placeholder="例如 175"
          value={val}
          icon={Ruler}
          invalid={val.trim() !== '' && !valid}
          autoFocus
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
      </Field>
    </Modal>
  )
}

// ───────── 目標體重 Modal ─────────

function GoalModal({
  open,
  targetKg,
  startKg,
  latestKg,
  onClose,
  onSaved,
}: {
  open: boolean
  targetKg?: number
  startKg?: number
  latestKg?: number
  onClose: () => void
  onSaved: () => void
}) {
  const [target, setTarget] = useState('')
  const [start, setStart] = useState('')
  const [seeded, setSeeded] = useState(false)
  if (open && !seeded) {
    setTarget(isNum(targetKg) ? String(targetKg) : '')
    // 起點預填：已存起點 → 用佢；否則用最新體重（畀用家確認後落 profile）。
    setStart(isNum(startKg) ? String(startKg) : isNum(latestKg) ? String(round(latestKg, 1)) : '')
    setSeeded(true)
  }
  if (!open && seeded) setSeeded(false)

  const parsePos = (s: string): number | undefined | null => {
    const t = s.trim()
    if (t === '') return undefined
    const n = Number(t)
    return Number.isFinite(n) && n > 0 && n < 500 ? n : null
  }
  const t = parsePos(target)
  const st = parsePos(start)
  const targetInvalid = t === null || t === undefined // 目標必填
  const startInvalid = st === null // 起點選填，但若填咗要有效
  const canSave = !targetInvalid && !startInvalid

  const submit = () => {
    if (!canSave) return
    saveProfile({
      weightTargetKg: round(t as number, 1),
      // 起點可選：留空 → undefined（UI 會 fallback 用最早一筆記錄）。
      weightStartKg: typeof st === 'number' ? round(st, 1) : undefined,
    })
    onSaved()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="設定目標體重"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={!canSave}>
            儲存
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="目標體重 (kg)" hint="想去到嘅體重">
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            placeholder="例如 70"
            value={target}
            icon={Target}
            invalid={target.trim() !== '' && targetInvalid}
            autoFocus
            onChange={(e) => setTarget(e.target.value)}
          />
        </Field>
        <Field
          label="起點體重 (kg)"
          hint="計進度條用；留空就由最早一筆記錄起計"
          error={startInvalid ? '請輸入有效體重' : undefined}
        >
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            placeholder="例如 80"
            value={start}
            icon={Scale}
            invalid={startInvalid}
            onChange={(e) => setStart(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
          />
        </Field>
      </div>
    </Modal>
  )
}
