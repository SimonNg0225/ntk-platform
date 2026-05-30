import { useMode } from '../context/ModeContext'
import ModeSwitcher from './ModeSwitcher'

// 手機頂欄（只喺細螢幕顯示）：漢堡選單 + 品牌 + 搜尋 + 緊湊模式切換
export default function MobileTopBar({
  onMenu,
  onSearch,
}: {
  onMenu: () => void
  onSearch?: () => void
}) {
  const { modeDef } = useMode()

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 md:hidden">
      <button
        onClick={onMenu}
        className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        aria-label="開啟選單"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white">
          N
        </div>
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
          NTK
          <span className="ml-1 font-normal text-slate-400">
            · {modeDef.short}
          </span>
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        {onSearch && (
          <button
            onClick={onSearch}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="搜尋"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path
                d="M20 20l-3-3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
        <ModeSwitcher size="compact" />
      </div>
    </header>
  )
}
