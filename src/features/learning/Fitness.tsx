import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, Dumbbell, Apple, Bot, BookOpen, HeartPulse, type LucideIcon } from 'lucide-react'
import { cx, FeatureGuide, PageHero, type FeatureGuideStep } from '../../ui'
import BodyView from './fitness/body/BodyView'
import TrainingView from './fitness/training/TrainingView'
import NutritionView from './fitness/nutrition/NutritionView'
import CoachView from './fitness/coach/CoachView'
import LibraryView from './fitness/library/LibraryView'

// ============================================================
//  健身中心 shell —— 個人模式「健身」分區，內含 5 個工具 tab。
//  各 tab 係自足模組（自己 store/util/charts），喺呢度切換顯示。
//  ------------------------------------------------------------
//  呈現層跟「工作儀表板」設計語言：accent masthead（PageHeader 式
//  icon chip + 標題 + 狀態副題）+ FeatureGuide 教學引導 + 統一
//  card token 分頁 rail。功能邏輯／資料流不變。
// ============================================================

type Tab = 'body' | 'training' | 'nutrition' | 'coach' | 'library'

const TABS: { id: Tab; label: string; hint: string; icon: LucideIcon }[] = [
  { id: 'body', label: '體態', hint: '身體組成', icon: Activity },
  { id: 'training', label: '訓練', hint: '記錄與週期', icon: Dumbbell },
  { id: 'nutrition', label: '飲食', hint: '營養追蹤', icon: Apple },
  { id: 'coach', label: 'AI 教練', hint: '智能規劃', icon: Bot },
  { id: 'library', label: '動作庫', hint: '招式資料', icon: BookOpen },
]

export default function Fitness() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('body')
  const activeIdx = TABS.findIndex((t) => t.id === tab)
  const current = TABS[activeIdx < 0 ? 0 : activeIdx]
  const CurrentIcon = current.icon

  const guideSteps: FeatureGuideStep[] = [
    {
      title: t('fitness.guideStep1Title', { defaultValue: '揀工具' }),
      desc: t('fitness.guideStep1Desc', {
        defaultValue: '喺下方分頁揀：體態、訓練、飲食、AI 教練或動作庫。',
      }),
    },
    {
      title: t('fitness.guideStep2Title', { defaultValue: '記低數據' }),
      desc: t('fitness.guideStep2Desc', {
        defaultValue: '喺體態記體重／體脂，喺訓練記每組重量次數，喺飲食記餐單。',
      }),
    },
    {
      title: t('fitness.guideStep3Title', { defaultValue: '睇趨勢' }),
      desc: t('fitness.guideStep3Desc', {
        defaultValue: '系統即時整合圖表，睇體態走勢、訓練量同營養達標情況。',
      }),
    },
    {
      title: t('fitness.guideStep4Title', { defaultValue: '問 AI 教練' }),
      desc: t('fitness.guideStep4Desc', {
        defaultValue: '唔知點練？去 AI 教練攞訓練計劃、姿勢建議同進度評估。',
      }),
    },
  ]

  return (
    <div className="space-y-5">
      {/* ───────── page hero（統一共用 PageHero accent hero） ───────── */}
      <PageHero
        guideKey="fitness"
        icon={HeartPulse}
        kicker={t('fitness.kicker', { defaultValue: '個人成長 · 健身追蹤' })}
        title={t('fitness.title', { defaultValue: '健身中心' })}
        description={t('fitness.subtitle', {
          defaultValue: '體態、訓練、飲食、AI 教練同動作庫，一站睇晒。',
        })}
        actions={
          // 現正開啟：跟住 active tab 嘅輕量狀態 pill（純展示）
          <div className="shrink-0 rounded-xl bg-white/15 px-3.5 py-2.5 backdrop-blur-sm" aria-live="polite">
            <p className="text-xs text-white/70">
              {t('fitness.nowOpen', { defaultValue: '現正開啟' })}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <CurrentIcon size={16} />
              <span className="text-base font-semibold">{current.label}</span>
            </div>
          </div>
        }
      />

      {/* ───────── 教學引導：點用呢個功能 ───────── */}
      <FeatureGuide
        storageKey="fitness"
        title={t('fitness.guideTitle', { defaultValue: '健身中心點用？' })}
        steps={guideSteps}
      />

      {/* ───────── 工具分頁 rail（統一 card token；手機可橫向捲） ───────── */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div
          role="tablist"
          aria-label={t('fitness.toolsLabel', { defaultValue: '健身工具' })}
          className="flex min-w-max gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-1.5 sm:min-w-0 dark:border-slate-700/60 dark:bg-slate-800"
        >
          {TABS.map((tabItem) => {
            const on = tab === tabItem.id
            const Icon = tabItem.icon
            return (
              <button
                key={tabItem.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(tabItem.id)}
                className={cx(
                  'group flex min-h-14 flex-1 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                  on
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60',
                )}
              >
                <span
                  className={cx(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition',
                    on
                      ? 'bg-white/15 text-white'
                      : 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
                  )}
                >
                  <Icon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight">{tabItem.label}</span>
                  <span
                    className={cx(
                      'block truncate text-[11px]',
                      on ? 'text-white/70' : 'text-slate-400 dark:text-slate-500',
                    )}
                  >
                    {tabItem.hint}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'body' && <BodyView />}
      {tab === 'training' && <TrainingView />}
      {tab === 'nutrition' && <NutritionView />}
      {tab === 'coach' && <CoachView />}
      {tab === 'library' && <LibraryView />}
    </div>
  )
}
