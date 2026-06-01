import type { Feature } from '../features/types'
import { FeatureIcon } from '../features/featureIcons'

interface Props {
  feature: Feature
  /** 分類色調（由 Home 按 group 傳入）；fallback 用主題 accent。 */
  tone?: ToneKey
  onOpen: (id: string) => void
}

export type ToneKey =
  | 'accent' | 'violet' | 'blue' | 'amber' | 'rose' | 'emerald' | 'sky' | 'slate'

// 圖示 chip 配色：每個分類一隻色，淺/深色都有對應。
// ⚠️ 必須寫足整串 class（Tailwind 靠掃源碼字面值，動態拼接會被 purge）。
const TONE_CHIP: Record<ToneKey, string> = {
  accent: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
}

// 功能磚 — Bento 風：圓角、分類色圖示 chip、hover 微升。喺首頁概覽用網格顯示。
export default function FeatureCard({ feature, tone = 'accent', onOpen }: Props) {
  const chip = TONE_CHIP[tone] ?? TONE_CHIP.accent
  return (
    <button
      onClick={() => onOpen(feature.id)}
      className="group flex cursor-pointer flex-col items-start rounded-3xl border border-slate-200/80 bg-white p-5 text-left shadow-xs transition duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none dark:hover:border-slate-600"
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl transition duration-200 group-hover:scale-105 ${chip}`}
      >
        <FeatureIcon icon={feature.icon} size={22} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-semibold text-slate-800 dark:text-slate-100">
          {feature.name}
        </span>
        {feature.status === 'soon' && (
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:bg-slate-700 dark:text-slate-400">
            即將推出
          </span>
        )}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {feature.description}
      </p>
    </button>
  )
}
