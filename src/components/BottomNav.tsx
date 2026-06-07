import { useTranslation } from 'react-i18next'
import {
  Home,
  ClipboardCheck,
  GraduationCap,
  Calendar,
  LayoutGrid,
  Bot,
  Brain,
  type LucideIcon,
} from 'lucide-react'
import { useMode } from '../context/ModeContext'
import { cx } from '../ui'

// ============================================================
//  手機底部導航列（只細螢幕顯示）
//  ------------------------------------------------------------
//  4 個最常用功能 + 「選單」（開抽屜睇全部）。減少手機次次開抽屜搵嘢。
//  桌面 md: 以上隱藏（用側邊欄）。
// ============================================================

interface Item {
  id: string | null // 功能 id；null = 首頁；'__more__' = 開抽屜
  icon: LucideIcon
  key: string
  zh: string
}

const MORE: Item = { id: '__more__', icon: LayoutGrid, key: 'bnMore', zh: '選單' }
const HOME: Item = { id: null, icon: Home, key: 'bnHome', zh: '首頁' }
const CAL: Item = { id: 'calendar', icon: Calendar, key: 'bnCal', zh: '行事曆' }

const NAV: Record<'work' | 'learning', Item[]> = {
  work: [
    HOME,
    { id: 'work-grading', icon: ClipboardCheck, key: 'bnMark', zh: '批改' },
    { id: 'work-gradebook', icon: GraduationCap, key: 'bnGrades', zh: '成績' },
    CAL,
    MORE,
  ],
  learning: [
    HOME,
    { id: 'learning-ai', icon: Bot, key: 'bnAI', zh: 'AI' },
    { id: 'learning-flashcards', icon: Brain, key: 'bnCards', zh: '知識卡' },
    CAL,
    MORE,
  ],
}

export default function BottomNav({
  activeId,
  onSelect,
  onMore,
}: {
  activeId: string | null
  onSelect: (id: string | null) => void
  onMore: () => void
}) {
  const { t } = useTranslation()
  const { mode } = useMode()
  const items = NAV[mode]

  return (
    <nav
      className="z-30 flex shrink-0 items-stretch border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-900 md:hidden"
      aria-label="底部導航"
    >
      {items.map((it) => {
        const active = it.id === '__more__' ? false : it.id === activeId
        return (
          <button
            key={it.key}
            onClick={() => (it.id === '__more__' ? onMore() : onSelect(it.id))}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
              active
                ? 'text-accent'
                : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300',
            )}
          >
            <it.icon size={20} strokeWidth={active ? 2.25 : 1.75} />
            {t(`shell.${it.key}`, { defaultValue: it.zh })}
          </button>
        )
      })}
    </nav>
  )
}
