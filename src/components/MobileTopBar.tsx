import { Menu as MenuIcon, Search, Sparkles } from 'lucide-react'
import { useMode } from '../context/ModeContext'
import { IconButton } from '../ui'
import ModeSwitcher from './ModeSwitcher'

// 手機頂欄（只喺細螢幕顯示）：漢堡選單 + 品牌 + 快速加入 + 搜尋 + 緊湊模式切換
export default function MobileTopBar({
  onMenu,
  onSearch,
  onQuickAdd,
}: {
  onMenu: () => void
  onSearch?: () => void
  onQuickAdd?: () => void
}) {
  const { modeDef } = useMode()

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 md:hidden">
      <IconButton label="開啟選單" onClick={onMenu}>
        <MenuIcon size={22} strokeWidth={1.75} />
      </IconButton>

      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white shadow-sm ring-1 ring-inset ring-white/10">
          N
        </div>
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
          NTK
          <span className="ml-1 font-medium text-slate-400 dark:text-slate-500">
            · {modeDef.short}
          </span>
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        {onQuickAdd && (
          <IconButton label="快速加入" onClick={onQuickAdd}>
            <Sparkles size={20} strokeWidth={1.75} />
          </IconButton>
        )}
        {onSearch && (
          <IconButton label="搜尋" onClick={onSearch}>
            <Search size={20} strokeWidth={1.75} />
          </IconButton>
        )}
        <ModeSwitcher size="compact" />
      </div>
    </header>
  )
}
