import { useMemo, useState } from 'react'
import { useCollection } from '../../../lib/store'
import { quizAttemptsCol, topicsCol } from '../../../data/collections'
import {
  Activity,
  CalendarRange,
  Flame,
  Layers,
  Target,
  TrendingUp,
} from 'lucide-react'
import { Card, EmptyState, SectionTitle, StatCard } from '../../../ui'
import {
  difficultyMastery,
  pct,
  practiceHeatmap,
  practiceStreak,
  scoreSeries,
  topicMastery,
} from './util'
import {
  DifficultyDonut,
  PracticeHeatmap,
  RangeToggle,
  ScoreLineChart,
  TopicMasteryBars,
} from './charts'

// ============================================================
//  StatsView — 跨次統計儀表板（Quizlet / Anki Stats 級）
//  命中率折線 / 課題掌握 / 難度占比 / 練習熱力圖 / KPI / streak
// ============================================================

export function StatsView({ onPractice }: { onPractice: (topicId: string) => void }) {
  const attempts = useCollection(quizAttemptsCol)
  const topics = useCollection(topicsCol)
  const topicName = (id: string) => topics.find((t) => t.id === id)?.topic ?? '未分類'

  const [heatRange, setHeatRange] = useState(119)

  const series = useMemo(() => scoreSeries(attempts), [attempts])
  const topics_ = useMemo(() => topicMastery(attempts), [attempts])
  const diffs = useMemo(() => difficultyMastery(attempts), [attempts])
  const heat = useMemo(() => practiceHeatmap(attempts, heatRange), [attempts, heatRange])
  const streak = useMemo(() => practiceStreak(attempts), [attempts])

  const totalQuestions = useMemo(
    () => attempts.reduce((s, a) => s + a.total, 0),
    [attempts],
  )
  const totalCorrect = useMemo(
    () => attempts.reduce((s, a) => s + a.correctCount, 0),
    [attempts],
  )
  const overallPct = pct(totalCorrect, totalQuestions)
  const bestPct = useMemo(
    () => (series.length ? Math.max(...series.map((s) => s.pct)) : 0),
    [series],
  )
  // 趨勢：最近一半 vs 前一半平均（簡單動向指標）
  const trend = useMemo(() => {
    if (series.length < 2) return null
    const mid = Math.floor(series.length / 2)
    const a = series.slice(0, mid)
    const b = series.slice(mid)
    const avg = (xs: typeof series) =>
      xs.length ? Math.round(xs.reduce((s, x) => s + x.pct, 0) / xs.length) : 0
    const d = avg(b) - avg(a)
    return {
      value: `${d >= 0 ? '+' : ''}${d}%`,
      dir: d > 0 ? ('up' as const) : d < 0 ? ('down' as const) : ('flat' as const),
    }
  }, [series])

  if (attempts.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="仲未有測驗資料"
        hint="去「測驗」做幾份卷，呢度就會出命中率走勢、課題掌握度同練習熱力圖。"
      />
    )
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="測驗次數"
          value={attempts.length}
          unit="次"
          icon={Layers}
          highlight
        />
        <StatCard
          label="整體命中"
          value={`${overallPct}%`}
          icon={Target}
          hint={`${totalCorrect}/${totalQuestions} 題`}
          trend={trend ?? undefined}
        />
        <StatCard label="最佳一次" value={`${bestPct}%`} icon={TrendingUp} />
        <StatCard
          label="連續練習"
          value={streak.current}
          unit="日"
          icon={Flame}
          hint={`最長 ${streak.best} 日`}
        />
      </div>

      {/* 命中率走勢 */}
      <Card className="p-4">
        <SectionTitle icon={TrendingUp} description="每次測驗嘅命中率（虛線 = 60% 及格）">
          命中率走勢
        </SectionTitle>
        <ScoreLineChart points={series} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 課題掌握度 */}
        <Card className="p-4">
          <SectionTitle icon={Layers} description="弱在前，撳一下即練該課題">
            課題掌握度
          </SectionTitle>
          <TopicMasteryBars rows={topics_} nameOf={topicName} onPick={onPractice} />
        </Card>

        {/* 難度占比 */}
        <Card className="p-4">
          <SectionTitle icon={Target} description="各難度答題量同命中">
            難度表現
          </SectionTitle>
          <DifficultyDonut rows={diffs} />
        </Card>
      </div>

      {/* 練習熱力圖 */}
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
          練習熱力圖
        </SectionTitle>
        <PracticeHeatmap cells={heat} />
      </Card>
    </div>
  )
}
