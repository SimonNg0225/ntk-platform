import { useMemo, useState } from 'react'
import { useCollection } from '../../../lib/store'
import { decksCol, cardsCol } from '../../../data/collections'
import { Card, SectionTitle, StatCard, Select, EmptyState } from '../../../ui'
import {
  Activity,
  CalendarRange,
  Flame,
  Target,
  TrendingUp,
  Layers,
} from 'lucide-react'
import { cardMetaCol, reviewLogCol } from './store'
import {
  answerBreakdown,
  computeStreak,
  dailyReviewCounts,
  dueForecast,
  intervalHistogram,
  retention,
  reviewHeatmap,
  STATE_LABEL,
  stateBreakdown,
} from './srs'
import {
  AnswerBars,
  DailyTrend,
  Donut,
  ForecastChart,
  Heatmap,
  IntervalChart,
  RangeToggle,
  STATE_DONUT_COLOR,
} from './charts'
import type { CardState } from './types'

// ============================================================
//  統計儀表板（Anki Stats 級）
//  熱力圖 / 預測 / 留存率 / 答題分布 / 狀態占比 / 間隔分布 / 趨勢
// ============================================================

export default function StatsView() {
  const decks = useCollection(decksCol)
  const allCards = useCollection(cardsCol)
  const metas = useCollection(cardMetaCol)
  const logs = useCollection(reviewLogCol)

  const [deckId, setDeckId] = useState<string>('all')
  const [heatRange, setHeatRange] = useState(119)

  // 範圍過濾
  const cards = useMemo(
    () => (deckId === 'all' ? allCards : allCards.filter((c) => c.deckId === deckId)),
    [allCards, deckId],
  )
  const cardIds = useMemo(() => new Set(cards.map((c) => c.id)), [cards])
  const scopedLogs = useMemo(
    () => (deckId === 'all' ? logs : logs.filter((l) => cardIds.has(l.cardId))),
    [logs, deckId, cardIds],
  )

  const streak = useMemo(() => computeStreak(scopedLogs), [scopedLogs])
  const ret = useMemo(() => retention(scopedLogs), [scopedLogs])
  const heat = useMemo(
    () => reviewHeatmap(scopedLogs, heatRange),
    [scopedLogs, heatRange],
  )
  const forecast = useMemo(() => dueForecast(cards, metas, 14), [cards, metas])
  const answers = useMemo(() => answerBreakdown(scopedLogs), [scopedLogs])
  const states = useMemo(() => stateBreakdown(cards, metas), [cards, metas])
  const intervals = useMemo(() => intervalHistogram(cards), [cards])
  const daily = useMemo(() => dailyReviewCounts(scopedLogs, 21), [scopedLogs])

  const reviewedToday = useMemo(() => {
    const t = new Date().toISOString().slice(0, 10)
    return scopedLogs.filter((l) => l.ts.slice(0, 10) === t).length
  }, [scopedLogs])

  // 平均每張答題用時（秒）
  const avgSec = useMemo(() => {
    if (scopedLogs.length === 0) return 0
    const ms = scopedLogs.reduce((s, l) => s + l.elapsedMs, 0) / scopedLogs.length
    return Math.round((ms / 1000) * 10) / 10
  }, [scopedLogs])

  const stateSegments = (['new', 'learning', 'young', 'mature', 'suspended'] as CardState[])
    .map((s) => ({
      value: states[s],
      color: STATE_DONUT_COLOR[s],
      label: STATE_LABEL[s],
    }))
    .filter((s) => s.value > 0)

  if (allCards.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="仲未有資料做統計"
        hint="去「牌組」整啲卡、複習幾轉，呢度就會出熱力圖、留存率、預測。"
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* 範圍選擇 */}
      <div className="flex items-center justify-between gap-2">
        <Select
          value={deckId}
          onChange={(e) => setDeckId(e.target.value)}
          className="w-auto"
          aria-label="統計範圍"
        >
          <option value="all">全部牌組</option>
          {decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          共 <span className="tabular-nums">{scopedLogs.length}</span> 條複習紀錄
        </span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="今日已複習"
          value={reviewedToday}
          unit="次"
          icon={Activity}
          highlight
        />
        <StatCard
          label="連續學習"
          value={streak.current}
          unit="日"
          icon={Flame}
          hint={`最長 ${streak.best} 日`}
        />
        <StatCard
          label="留存率"
          value={`${Math.round(ret.rate)}%`}
          icon={Target}
          hint={`${ret.pass}/${ret.total} 答對`}
        />
        <StatCard
          label="平均用時"
          value={avgSec}
          unit="秒"
          icon={TrendingUp}
          hint="每張卡"
        />
      </div>

      {/* 熱力圖 */}
      <Card className="p-4">
        <SectionTitle
          icon={CalendarRange}
          right={
            <RangeToggle
              value={heatRange}
              onChange={setHeatRange}
              options={[
                { value: 119, label: '17 週' },
                { value: 182, label: '半年' },
                { value: 364, label: '一年' },
              ]}
            />
          }
        >
          複習熱力圖
        </SectionTitle>
        <Heatmap cells={heat} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 到期預測 */}
        <Card className="p-4">
          <SectionTitle icon={CalendarRange} description="未來 14 日將到期嘅卡（按熟度）">
            到期預測
          </SectionTitle>
          <ForecastChart bars={forecast} />
        </Card>

        {/* 卡片狀態占比 */}
        <Card className="p-4">
          <SectionTitle icon={Layers} description="整體牌組組成">
            卡片狀態
          </SectionTitle>
          {stateSegments.length > 0 ? (
            <Donut
              segments={stateSegments}
              centerValue={String(cards.length)}
              centerLabel="總卡數"
            />
          ) : (
            <p className="py-6 text-center text-sm text-slate-400">冇卡</p>
          )}
        </Card>

        {/* 答題分布 */}
        <Card className="p-4">
          <SectionTitle icon={Target} description="每個評分掣嘅次數占比">
            答題分布
          </SectionTitle>
          <AnswerBars data={answers} />
        </Card>

        {/* 間隔分布 */}
        <Card className="p-4">
          <SectionTitle icon={TrendingUp} description="已排程卡嘅複習間隔">
            間隔分布
          </SectionTitle>
          <IntervalChart bins={intervals} />
        </Card>
      </div>

      {/* 每日趨勢 */}
      <Card className="p-4">
        <SectionTitle icon={Activity} description="過去 21 日每日複習量">
          複習趨勢
        </SectionTitle>
        <DailyTrend data={daily} />
      </Card>
    </div>
  )
}
