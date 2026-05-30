import { useMode } from '../context/ModeContext'
import { featuresForMode } from '../features/registry'
import ModeSwitcher from './ModeSwitcher'
import AccountBox from './AccountBox'

interface Props {
  activeId: string | null
  onSelect: (id: string | null) => void
  /** 喺手機抽屜入面用：揀完一項就關抽屜 */
  onClose?: () => void
  className?: string
}

// 側邊欄 — 品牌 / 模式切換 / 該模式嘅功能導覽
// 桌面版固定喺左，手機版會喺抽屜入面重用同一個元件。
export default function Sidebar({
  activeId,
  onSelect,
  onClose,
  className = '',
}: Props) {
  const { modeDef } = useMode()
  const features = featuresForMode(modeDef.id)

  const choose = (id: string | null) => {
    onSelect(id)
    onClose?.()
  }

  return (
    <aside
      className={`flex w-72 shrink-0 flex-col bg-white ${className}`}
    >
      {/* 品牌 */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-lg font-bold text-white shadow-sm">
            N
          </div>
          <div>
            <p className="text-sm font-bold leading-none text-slate-800">
              NTK Platform
            </p>
            <p className="mt-1 text-xs text-slate-400">個人學習與工作平台</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 md:hidden"
            aria-label="關閉選單"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {/* 模式切換 */}
      <div className="px-4">
        <ModeSwitcher />
      </div>

      {/* 功能導覽 */}
      <nav className="mt-5 flex-1 space-y-1 overflow-y-auto px-4">
        <button
          onClick={() => choose(null)}
          className={navClass(activeId === null)}
        >
          <span className="text-base">🏠</span>
          <span>首頁概覽</span>
        </button>

        <p className="px-3 pb-1 pt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {modeDef.name}功能
        </p>

        {features.map((f) => (
          <button
            key={f.id}
            onClick={() => choose(f.id)}
            className={navClass(activeId === f.id)}
          >
            <span className="text-base">{f.icon}</span>
            <span className="flex-1 text-left">{f.name}</span>
            {f.status === 'soon' && (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                即將
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* 頁腳：帳戶區 + 版本 */}
      <div className="border-t border-slate-100">
        <AccountBox />
        <div className="px-5 pb-3 text-xs text-slate-300">v0.1 · 初步框架</div>
      </div>
    </aside>
  )
}

function navClass(active: boolean) {
  return active
    ? 'flex w-full items-center gap-2.5 rounded-xl bg-accent-soft px-3 py-2.5 text-sm font-semibold text-accent-strong'
    : 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50'
}
