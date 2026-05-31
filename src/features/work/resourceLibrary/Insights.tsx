import { useMemo } from 'react'
import {
  BarChart3,
  FolderTree,
  Hash,
  Layers,
  LineChart,
  Star,
  TrendingUp,
} from 'lucide-react'
import { Card, EmptyState, SectionTitle, StatCard } from '../../../ui'
import {
  ActivityChart,
  CoverageBars,
  FolderBars,
  OpenLeaderboard,
  TagCloud,
  TypeDonut,
} from './charts'
import {
  addedTrend,
  folderBreakdown,
  openTrend,
  tagFrequency,
  topOpened,
  topicCoverage,
  typeBreakdown,
} from './util'
import type { OpenLog, ResourceFolder, ResourceRow } from './util'

// ============================================================
//  資源庫洞察（統計儀表板）
//  類型占比 / 收藏夾 / 30 日活動 / 標籤雲 / 開啟排行 / 課題覆蓋
// ============================================================

export function Insights({
  rows,
  folders,
  openLog,
  topicName,
}: {
  rows: ResourceRow[]
  folders: ResourceFolder[]
  openLog: OpenLog[]
  topicName: (id: string) => string
}) {
  const total = rows.length
  const types = useMemo(() => typeBreakdown(rows), [rows])
  const folderStats = useMemo(
    () => folderBreakdown(rows, folders),
    [rows, folders],
  )
  const added = useMemo(() => addedTrend(rows, 30), [rows])
  const opened = useMemo(() => openTrend(openLog, 30), [openLog])
  const tags = useMemo(
    () => tagFrequency(rows.map((r) => r.res)).slice(0, 24),
    [rows],
  )
  const leaders = useMemo(
    () =>
      topOpened(rows, 6).map((r) => ({
        id: r.res.id,
        title: r.res.title,
        opens: r.meta.opens,
      })),
    [rows],
  )
  const coverage = useMemo(
    () => topicCoverage(rows, topicName, 8),
    [rows, topicName],
  )

  // KPI
  const totalOpens = useMemo(
    () => rows.reduce((s, r) => s + r.meta.opens, 0),
    [rows],
  )
  const favCount = useMemo(
    () => rows.filter((r) => r.meta.favorite).length,
    [rows],
  )
  const withLink = useMemo(
    () => rows.filter((r) => !!r.res.url).length,
    [rows],
  )
  const avgRating = useMemo(() => {
    const rated = rows.filter((r) => (r.meta.rating ?? 0) > 0)
    if (rated.length === 0) return 0
    return (
      Math.round(
        (rated.reduce((s, r) => s + (r.meta.rating ?? 0), 0) / rated.length) * 10,
      ) / 10
    )
  }, [rows])

  if (total === 0)
    return (
      <EmptyState
        icon={BarChart3}
        title="仲未有資料做統計"
        hint="新增啲資源、開幾條連結，呢度就會出類型占比、活動趨勢同開啟排行。"
      />
    )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="總資源" value={total} icon={Layers} highlight />
        <StatCard
          label="累計開啟"
          value={totalOpens}
          unit="次"
          icon={TrendingUp}
          hint={`${withLink} 個有連結`}
        />
        <StatCard label="收藏" value={favCount} unit="個" icon={Star} />
        <StatCard
          label="平均評分"
          value={avgRating || '—'}
          icon={Star}
          hint="已評分資源"
        />
      </div>

      {/* 30 日活動 */}
      <Card className="p-4">
        <SectionTitle icon={LineChart} description="新增（虛線）對開啟（藍線）">
          近 30 日活動
        </SectionTitle>
        <ActivityChart added={added} opened={opened} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle icon={Layers} description="按資源類型分佈">
            類型占比
          </SectionTitle>
          <TypeDonut stats={types} total={total} />
        </Card>

        <Card className="p-4">
          <SectionTitle icon={FolderTree} description="每個收藏夾嘅資源數">
            收藏夾分佈
          </SectionTitle>
          <FolderBars stats={folderStats} />
        </Card>

        <Card className="p-4">
          <SectionTitle icon={TrendingUp} description="最常開啟嘅教材">
            開啟排行榜
          </SectionTitle>
          <OpenLeaderboard rows={leaders} />
        </Card>

        <Card className="p-4">
          <SectionTitle icon={BarChart3} description="各課題下嘅資源數量">
            課題覆蓋
          </SectionTitle>
          <CoverageBars rows={coverage} />
        </Card>
      </div>

      <Card className="p-4">
        <SectionTitle icon={Hash} description="字級越大代表用得越多">
          標籤雲
        </SectionTitle>
        <TagCloud tags={tags} active={[]} onToggle={() => {}} />
      </Card>
    </div>
  )
}
