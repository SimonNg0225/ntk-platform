import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
        title={t('res.insights_empty_title', { defaultValue: '仲未有資料做統計' })}
        hint={t('res.insights_empty_hint', { defaultValue: '新增啲資源、開幾條連結，呢度就會出類型占比、活動趨勢同開啟排行。' })}
      />
    )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('res.insights_kpi_total', { defaultValue: '總資源' })} value={total} icon={Layers} highlight />
        <StatCard
          label={t('res.insights_kpi_opens', { defaultValue: '累計開啟' })}
          value={totalOpens}
          unit={t('res.insights_kpi_opens_unit', { defaultValue: '次' })}
          icon={TrendingUp}
          hint={t('res.insights_kpi_opens_hint', { defaultValue: `${withLink} 個有連結`, count: withLink })}
        />
        <StatCard label={t('res.insights_kpi_favs', { defaultValue: '收藏' })} value={favCount} unit={t('res.insights_kpi_favs_unit', { defaultValue: '個' })} icon={Star} />
        <StatCard
          label={t('res.insights_kpi_rating', { defaultValue: '平均評分' })}
          value={avgRating || '—'}
          icon={Star}
          hint={t('res.insights_kpi_rating_hint', { defaultValue: '已評分資源' })}
        />
      </div>

      {/* 30 日活動 */}
      <Card className="p-4">
        <SectionTitle icon={LineChart} description={t('res.insights_activity_desc', { defaultValue: '新增（虛線）對開啟（藍線）' })}>
          {t('res.insights_activity_title', { defaultValue: '近 30 日活動' })}
        </SectionTitle>
        <ActivityChart added={added} opened={opened} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle icon={Layers} description={t('res.insights_type_desc', { defaultValue: '按資源類型分佈' })}>
            {t('res.insights_type_title', { defaultValue: '類型占比' })}
          </SectionTitle>
          <TypeDonut stats={types} total={total} />
        </Card>

        <Card className="p-4">
          <SectionTitle icon={FolderTree} description={t('res.insights_folder_desc', { defaultValue: '每個收藏夾嘅資源數' })}>
            {t('res.insights_folder_title', { defaultValue: '收藏夾分佈' })}
          </SectionTitle>
          <FolderBars stats={folderStats} />
        </Card>

        <Card className="p-4">
          <SectionTitle icon={TrendingUp} description={t('res.insights_leaderboard_desc', { defaultValue: '最常開啟嘅教材' })}>
            {t('res.insights_leaderboard_title', { defaultValue: '開啟排行榜' })}
          </SectionTitle>
          <OpenLeaderboard rows={leaders} />
        </Card>

        <Card className="p-4">
          <SectionTitle icon={BarChart3} description={t('res.insights_coverage_desc', { defaultValue: '各課題下嘅資源數量' })}>
            {t('res.insights_coverage_title', { defaultValue: '課題覆蓋' })}
          </SectionTitle>
          <CoverageBars rows={coverage} />
        </Card>
      </div>

      <Card className="p-4">
        <SectionTitle icon={Hash} description={t('res.insights_tags_desc', { defaultValue: '字級越大代表用得越多' })}>
          {t('res.insights_tags_title', { defaultValue: '標籤雲' })}
        </SectionTitle>
        <TagCloud tags={tags} active={[]} onToggle={() => {}} />
      </Card>
    </div>
  )
}
