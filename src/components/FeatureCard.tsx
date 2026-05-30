import type { Feature } from '../features/types'

interface Props {
  feature: Feature
  onOpen: (id: string) => void
}

// 功能卡 — 喺首頁概覽用網格顯示
export default function FeatureCard({ feature, onOpen }: Props) {
  return (
    <button
      onClick={() => onOpen(feature.id)}
      className="group flex flex-col items-start rounded-3xl border border-slate-200/80 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-xl transition group-hover:scale-105">
        {feature.icon}
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
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{feature.description}</p>
    </button>
  )
}
