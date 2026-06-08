import { Menu as MenuIcon, Search, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 md:hidden">
      <IconButton label="開啟選單" onClick={onMenu}>
        <MenuIcon size={22} strokeWidth={1.75} />
      </IconButton>

      <div className="flex min-w-0 items-center gap-2">
        <img
          src="/favicon.svg"
          alt="EziTeach 教學易"
          className="h-8 w-8 shrink-0 rounded-xl shadow-sm"
        />
        <span className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
          {t('shell.brandName', { defaultValue: '教學易' })}
          <span className="ml-1 font-medium text-slate-400 dark:text-slate-500">
            · {t(`mode.${modeDef.id}.short`, { defaultValue: modeDef.short })}
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
