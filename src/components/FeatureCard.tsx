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
      className="group flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-xl">
        {feature.icon}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-base font-semibold text-slate-800">
          {feature.name}
        </span>
        {feature.status === 'soon' && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
            即將推出
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500">{feature.description}</p>
    </button>
  )
}
