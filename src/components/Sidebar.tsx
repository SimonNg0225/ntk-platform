import { X } from 'lucide-react'
import { useMode } from '../context/ModeContext'
import { groupedFeatures } from '../features/registry'
import { FeatureIcon } from '../features/featureIcons'
import { cx, IconButton } from '../ui'
import ModeSwitcher from './ModeSwitcher'
import AccountBox from './AccountBox'

interface Props {
  activeId: string | null
  onSelect: (id: string | null) => void
  onOpenSettings?: () => void
  /** 喺手機抽屜入面用：揀完一項就關抽屜 */
  onClose?: () => void
  className?: string
}

// 側邊欄 — 品牌 / 模式切換 / 該模式嘅功能導覽（分組）
export default function Sidebar({
  activeId,
  onSelect,
  onOpenSettings,
  onClose,
  className = '',
}: Props) {
  const { modeDef } = useMode()
  const groups = groupedFeatures(modeDef.id)

  const choose = (id: string | null) => {
    onSelect(id)
    onClose?.()
  }

  return (
    <aside
      className={cx(
        'flex w-72 shrink-0 flex-col bg-white dark:bg-slate-900',
        className,
      )}
    >
      {/* 品牌 */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-base font-bold text-white shadow-sm ring-1 ring-inset ring-white/10">
            N
          </div>
          <div>
            <p className="text-sm font-bold leading-none text-slate-800 dark:text-slate-100">
              NTK Platform
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              個人學習與工作平台
            </p>
          </div>
        </div>
        {onClose && (
          <IconButton label="關閉選單" onClick={onClose} className="md:hidden">
            <X size={18} strokeWidth={1.75} />
          </IconButton>
        )}
      </div>

      {/* 模式切換 */}
      <div className="px-4">
        <ModeSwitcher />
      </div>

      {/* 功能導覽（分組） */}
      <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-4 pb-4">
        <button
          onClick={() => choose(null)}
          className={navClass(activeId === null)}
        >
          <FeatureIcon icon="🏠" size={18} className={iconColor(activeId === null)} />
          <span>首頁概覽</span>
        </button>

        {groups.map((g) => (
          <div key={g.group}>
            <p className="px-3 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 first:pt-1 dark:text-slate-500">
              {g.group}
            </p>
            {g.items.map((f) => {
              const on = activeId === f.id
              return (
                <button
                  key={f.id}
                  onClick={() => choose(f.id)}
                  className={navClass(on)}
                >
                  <FeatureIcon icon={f.icon} size={18} className={iconColor(on)} />
                  <span className="flex-1 text-left">{f.name}</span>
                  {f.status === 'soon' && (
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                      即將
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* 頁腳：設定 + 帳戶區 + 版本 */}
      <div className="border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={() => {
            onOpenSettings?.()
            onClose?.()
          }}
          className={cx(navClass(activeId === '__settings__'), 'm-2 w-[calc(100%-1rem)]')}
        >
          <FeatureIcon
            icon="⚙️"
            size={18}
            className={iconColor(activeId === '__settings__')}
          />
          <span>設定</span>
        </button>
        <AccountBox />
        <div className="px-5 pb-3 text-xs text-slate-300 dark:text-slate-600">
          v0.5 · <span className="tabular-nums">{countLabel(groups)}</span> 個功能
        </div>
      </div>
    </aside>
  )
}

function countLabel(groups: { items: unknown[] }[]) {
  return groups.reduce((n, g) => n + g.items.length, 0)
}

function iconColor(active: boolean) {
  return active ? 'text-accent' : 'text-slate-400 group-hover:text-slate-500'
}

function navClass(active: boolean) {
  return cx(
    'group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
    active
      ? 'bg-accent-soft font-semibold text-accent-strong dark:bg-accent/15 dark:text-accent before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-accent before:content-[""]'
      : 'font-medium text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  )
}
