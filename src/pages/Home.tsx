import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { useMode } from '../context/ModeContext'
import { useSettings } from '../context/SettingsContext'
import { groupedFeatures, getFeature } from '../features/registry'
import { useCollection } from '../lib/store'
import { recentFeaturesCol } from '../components/commandPalette/util'
import FeatureCard, { type ToneKey } from '../components/FeatureCard'
import PlanBadge from '../components/PlanBadge'
import { groupLabel } from '../i18n/appEn'
import { cx } from '../ui'

interface Props {
  onOpen: (id: string) => void
}

// 機構級 SaaS：克制配色 —— 內容群組用主題 accent，工具群組用中性 slate。
// 刻意唔再每個分組一隻彩色（嗰種「demo」感），改為單一專業色軸 + 中性。
const GROUP_TONE: Record<string, ToneKey> = {
  概覽: 'accent',
  AI: 'accent',
  教學: 'accent',
  學生: 'accent',
  行政: 'slate',
  理財: 'slate',
  知識管理: 'accent',
  目標與習慣: 'accent',
  健康: 'accent',
  工具: 'slate',
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function timeGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return '夜深了'
  if (h < 12) return '早晨'
  if (h < 18) return '午安'
  return '晚安'
}

// 首頁概覽 — 機構級 masthead（無漸變光暈）+ 分組功能網格。
export default function Home({ onOpen }: Props) {
  const { t } = useTranslation()
  const { modeDef } = useMode()
  const { displayName } = useSettings()
  const groups = groupedFeatures(modeDef.id)
  const total = groups.reduce((n, g) => n + g.items.length, 0)

  // 最近使用（常用優先）；有最近時預設收起「全部功能」，新用戶則展開。
  const recents = useCollection(recentFeaturesCol)
  const recentFeatures = recents
    .map((r) => getFeature(r.featureId))
    .filter(
      (f): f is NonNullable<typeof f> =>
        !!f && f.modes.includes(modeDef.id) && f.status === 'ready',
    )
    .slice(0, 3)
  const [showAll, setShowAll] = useState(recentFeatures.length === 0)

  const name = displayName.trim()
  const greeting = name ? `${timeGreeting()}，${name}` : timeGreeting()
  const now = new Date()
  const dateLabel = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 · 星期${WEEKDAYS[now.getDay()]}`

  return (
    <div className="space-y-8">
      {/* Masthead — 乾淨 surface，左側主題色標尺；無漸變、無光暈 blob */}
      <header className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-xs">
        <div className="flex items-stretch">
          <div className="w-1 shrink-0 bg-accent" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-wrap items-end justify-between gap-3 px-5 py-5 sm:px-7 sm:py-6">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                {t(`mode.${modeDef.id}.name`, { defaultValue: modeDef.name })} · {dateLabel}
              </p>
              <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 sm:text-[28px]">
                {greeting}
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t(`mode.${modeDef.id}.tagline`, { defaultValue: modeDef.tagline })}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <PlanBadge />
              <div className="flex items-baseline gap-1.5 text-slate-400 dark:text-slate-500">
                <span className="nums text-2xl font-semibold text-slate-700 dark:text-slate-200">
                  {total}
                </span>
                <span className="text-xs">{t('shell.featuresCount', { defaultValue: '項功能' })}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 最近使用 */}
      {recentFeatures.length > 0 && (
        <section>
          <h2 className="mb-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t('shell.recent', { defaultValue: '最近使用' })}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentFeatures.map((f) => (
              <FeatureCard key={`r-${f.id}`} feature={f} tone="accent" onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}

      {/* 全部功能（可摺疊） */}
      <div>
        <button
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="flex w-full items-center justify-between border-b border-[color:var(--border)] pb-2 text-sm font-semibold text-slate-600 transition-colors hover:text-accent dark:text-slate-300"
        >
          <span>
            {t('shell.allFeatures', { defaultValue: '全部功能' })} ·{' '}
            <span className="tabular-nums">{total}</span>
          </span>
          <ChevronDown
            size={16}
            className={cx('transition-transform', !showAll && '-rotate-90')}
          />
        </button>
      </div>

      {showAll &&
        groups.map((g) => (
          <section key={g.group}>
            <h2 className="mb-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {groupLabel(t, g.group)}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((f) => (
                <FeatureCard
                  key={f.id}
                  feature={f}
                  tone={GROUP_TONE[g.group] ?? 'accent'}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </section>
        ))}
    </div>
  )
}
