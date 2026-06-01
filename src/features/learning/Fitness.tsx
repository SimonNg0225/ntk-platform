import { useState } from 'react'
import { Activity, Dumbbell, Apple, Bot, BookOpen, HeartPulse, type LucideIcon } from 'lucide-react'
import { cx } from '../../ui'
import BodyView from './fitness/body/BodyView'
import TrainingView from './fitness/training/TrainingView'
import NutritionView from './fitness/nutrition/NutritionView'
import CoachView from './fitness/coach/CoachView'
import LibraryView from './fitness/library/LibraryView'

// ============================================================
//  健身中心 shell —— 個人模式「健身」分區，內含 5 個工具 tab。
//  各 tab 係自足模組（自己 store/util/charts），喺呢度切換顯示。
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
  const [tab, setTab] = useState<Tab>('body')
  return (
    <div className="space-y-5">
      {/* 健身中心 hero —— 跟模式主色嘅漸變橫幅 */}
      <header className="hero-gradient relative overflow-hidden rounded-3xl px-5 py-5 text-white shadow-lg shadow-accent/25 sm:px-7 sm:py-6">
        <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <HeartPulse size={22} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">健身中心</h1>
            <p className="mt-0.5 text-sm text-white/80">
              體態、訓練、飲食、AI 教練同動作庫，一站睇晒。
            </p>
          </div>
        </div>
      </header>

      {/* tab 切換 —— tone-coloured 卡片式分頁（手機可橫向捲） */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max gap-2 sm:grid sm:min-w-0 sm:grid-cols-5">
          {TABS.map((t) => {
            const on = tab === t.id
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-pressed={on}
                className={cx(
                  'group flex flex-1 items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                  on
                    ? 'border-accent/40 bg-accent-soft shadow-sm dark:border-accent/40 dark:bg-accent/15'
                    : 'border-slate-200/80 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600',
                )}
              >
                <span
                  className={cx(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition',
                    on
                      ? 'bg-accent text-white'
                      : 'bg-slate-100 text-slate-500 group-hover:scale-105 dark:bg-slate-700/60 dark:text-slate-300',
                  )}
                >
                  <Icon size={17} />
                </span>
                <span className="min-w-0">
                  <span
                    className={cx(
                      'block text-sm font-semibold',
                      on
                        ? 'text-accent-strong dark:text-accent'
                        : 'text-slate-700 dark:text-slate-200',
                    )}
                  >
                    {t.label}
                  </span>
                  <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">
                    {t.hint}
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
