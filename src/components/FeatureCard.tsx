import type { Feature } from '../features/types'
import { FeatureIcon } from '../features/featureIcons'

interface Props {
  feature: Feature
  onOpen: (id: string) => void
}

// 功能卡 — 喺首頁概覽用網格顯示
export default function FeatureCard({ feature, onOpen }: Props) {
  return (
    <button
      onClick={() => onOpen(feature.id)}
      className="group flex flex-col items-start rounded-xl border border-slate-200/80 bg-white p-5 text-left shadow-xs transition duration-150 hover:-translate-y-1 hover:border-accent/40 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-strong transition group-hover:scale-105 dark:bg-accent/15 dark:text-accent">
        <FeatureIcon icon={feature.icon} size={20} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold text-slate-800 dark:text-slate-100">
          {feature.name}
        </span>
        {feature.status === 'soon' && (
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:bg-slate-700 dark:text-slate-400">
            即將推出
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {feature.description}
      </p>
    </button>
  )
}
