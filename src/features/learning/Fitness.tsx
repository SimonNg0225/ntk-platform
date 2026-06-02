import { useState } from 'react'
import { Activity, Dumbbell, Apple, Bot, BookOpen, Zap, type LucideIcon } from 'lucide-react'
import { cx } from '../../ui'
import BodyView from './fitness/body/BodyView'
import TrainingView from './fitness/training/TrainingView'
import NutritionView from './fitness/nutrition/NutritionView'
import CoachView from './fitness/coach/CoachView'
import LibraryView from './fitness/library/LibraryView'

// ============================================================
//  健身中心 shell —— 個人模式「健身」分區，內含 5 個工具 tab。
//  各 tab 係自足模組（自己 store/util/charts），喺呢度切換顯示。
//  ------------------------------------------------------------
//  視覺主題：運動計分板 / 能量感（LED 記分牌 hero + 頻道式分頁
//  rail + 粗大顯示字）。色票 / 元件共用，aesthetic 獨特。
// ============================================================

type Tab = 'body' | 'training' | 'nutrition' | 'coach' | 'library'

const TABS: { id: Tab; label: string; hint: string; en: string; icon: LucideIcon }[] = [
  { id: 'body', label: '體態', hint: '身體組成', en: 'BODY', icon: Activity },
  { id: 'training', label: '訓練', hint: '記錄與週期', en: 'TRAIN', icon: Dumbbell },
  { id: 'nutrition', label: '飲食', hint: '營養追蹤', en: 'FUEL', icon: Apple },
  { id: 'coach', label: 'AI 教練', hint: '智能規劃', en: 'COACH', icon: Bot },
  { id: 'library', label: '動作庫', hint: '招式資料', en: 'MOVES', icon: BookOpen },
]

export default function Fitness() {
  const [tab, setTab] = useState<Tab>('body')
  const activeIdx = TABS.findIndex((t) => t.id === tab)

  return (
    <div className="space-y-5">
      {/* ── LED 記分牌 hero ── */}
      <Scoreboard
        active={tab}
        activeIdx={activeIdx < 0 ? 0 : activeIdx}
        onPick={setTab}
      />

      {/* ── 頻道式分頁 rail（手機可橫向捲）── */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div
          role="tablist"
          aria-label="健身工具"
          className="flex min-w-max gap-1.5 rounded-2xl border border-slate-200/80 bg-white/70 p-1.5 backdrop-blur sm:min-w-0 dark:border-slate-700/60 dark:bg-slate-800/70"
        >
          {TABS.map((t, i) => {
            const on = tab === t.id
            const Icon = t.icon
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.id)}
                className={cx(
                  'group relative flex flex-1 items-center gap-2.5 overflow-hidden rounded-xl px-3 py-2.5 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                  on
                    ? 'bg-accent text-white shadow-sm shadow-accent/25'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700/50',
                )}
              >
                {/* 頻道號碼（記分牌頻道感） */}
                <span
                  className={cx(
                    'font-serif text-base font-semibold leading-none tabular-nums slashed-zero transition',
                    on ? 'text-white/80' : 'text-slate-300 group-hover:text-slate-400 dark:text-slate-600',
                  )}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span
                  className={cx(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition',
                    on
                      ? 'bg-white/15 text-white'
                      : 'bg-slate-100 text-slate-500 group-hover:text-slate-600 dark:bg-slate-700/60 dark:text-slate-300',
                  )}
                >
                  <Icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-tight">{t.label}</span>
                  <span
                    className={cx(
                      'block truncate text-[10px] font-medium uppercase tracking-[0.12em]',
                      on ? 'text-white/65' : 'text-slate-400 dark:text-slate-500',
                    )}
                  >
                    {t.en}
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

// ============================================================
//  記分牌 hero —— 深色 LED 板（mode accent 發光），粗大顯示字 +
//  「現正出場」頻道指示。純展示，撳頻道 = 切 tab。
// ============================================================
function Scoreboard({
  active,
  activeIdx,
  onPick,
}: {
  active: Tab
  activeIdx: number
  onPick: (id: Tab) => void
}) {
  const current = TABS[activeIdx]
  const CurrentIcon = current.icon

  return (
    <header className="relative overflow-hidden rounded-3xl bg-slate-950 px-5 py-6 text-white shadow-lg shadow-slate-950/20 dark:shadow-black/40 sm:px-7 sm:py-7">
      {/* accent 發光（跟模式主色） */}
      <div className="hero-gradient pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-40 blur-3xl" />
      <div className="hero-gradient pointer-events-none absolute -bottom-24 left-1/3 h-44 w-44 rounded-full opacity-25 blur-3xl" />
      {/* LED 點陣紋理（極淡，純裝飾） */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(currentColor 1px, transparent 1.4px)',
          backgroundSize: '14px 14px',
          color: 'var(--accent-grad-from)',
        }}
        aria-hidden="true"
      />

      <div className="relative">
        {/* 計分牌上排：場館燈號 + 標題 */}
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-sm shadow-accent/40">
            <Zap size={18} className="fill-current" />
          </span>
          <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            健身中心 · LIVE
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          {/* 主顯示：粗大記分牌字 */}
          <div className="min-w-0">
            <p className="font-serif text-[2.75rem] font-black leading-[0.92] tracking-tight sm:text-6xl">
              健身中心
            </p>
            <p className="mt-2 max-w-md text-sm text-white/70">
              體態、訓練、飲食、AI 教練同動作庫，一站睇晒 —— 練多陣、計清楚。
            </p>
          </div>

          {/* 「現正出場」面板：似記分牌嘅當前頻道大字 */}
          <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
              現正開啟
            </p>
            <div className="mt-1.5 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/90 text-white">
                <CurrentIcon size={18} />
              </span>
              <div>
                <p className="text-lg font-bold leading-none">{current.label}</p>
                <p className="mt-1 font-serif text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                  {current.en}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 計分牌底排：5 頻道快速切換（似燈牌 lineup） */}
        <div className="mt-5 -mx-1 overflow-x-auto px-1">
          <div className="flex min-w-max items-center gap-1.5">
            {TABS.map((t, i) => {
              const on = t.id === active
              return (
                <button
                  key={t.id}
                  onClick={() => onPick(t.id)}
                  aria-label={`切換到${t.label}`}
                  className={cx(
                    'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                    on
                      ? 'bg-white text-slate-900'
                      : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white',
                  )}
                >
                  <span
                    className={cx(
                      'font-serif tabular-nums slashed-zero',
                      on ? 'text-accent-strong' : 'text-white/45',
                    )}
                  >
                    {i + 1}
                  </span>
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </header>
  )
}
