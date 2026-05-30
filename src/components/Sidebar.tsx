import { useMode } from '../context/ModeContext'
import { featuresForMode } from '../features/registry'
import ModeSwitcher from './ModeSwitcher'

interface Props {
  activeId: string | null
  onSelect: (id: string | null) => void
}

// 側邊欄 — 品牌 / 模式切換 / 該模式嘅功能導覽
export default function Sidebar({ activeId, onSelect }: Props) {
  const { modeDef } = useMode()
  const features = featuresForMode(modeDef.id)

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* 品牌 */}
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-lg font-bold text-white">
          N
        </div>
        <div>
          <p className="text-sm font-bold leading-none text-slate-800">
            NTK Platform
          </p>
          <p className="mt-0.5 text-xs text-slate-400">個人學習與工作平台</p>
        </div>
      </div>

      {/* 模式切換 */}
      <div className="px-3">
        <ModeSwitcher />
      </div>

      {/* 功能導覽 */}
      <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3">
        <button
          onClick={() => onSelect(null)}
          className={navClass(activeId === null)}
        >
          <span className="text-base">🏠</span>
          <span>首頁概覽</span>
        </button>

        <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {modeDef.name}功能
        </p>

        {features.map((f) => (
          <button
            key={f.id}
            onClick={() => onSelect(f.id)}
            className={navClass(activeId === f.id)}
          >
            <span className="text-base">{f.icon}</span>
            <span className="flex-1 text-left">{f.name}</span>
            {f.status === 'soon' && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                即將
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* 頁腳 */}
      <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
        v0.1 · 初步框架
      </div>
    </aside>
  )
}

function navClass(active: boolean) {
  return active
    ? 'flex w-full items-center gap-2.5 rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-accent-strong'
    : 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50'
}
