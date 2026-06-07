import { useState } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMode } from '../context/ModeContext'
import { groupedFeatures, getFeature } from '../features/registry'
import { FeatureIcon } from '../features/featureIcons'
import { useCollection } from '../lib/store'
import { recentFeaturesCol } from './commandPalette/util'
import { cx, IconButton } from '../ui'
import { featName, groupLabel } from '../i18n/appEn'
import ModeSwitcher from './ModeSwitcher'
import AccountBox from './AccountBox'

const COLLAPSE_KEY = 'ntk.sidebarCollapsed'

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

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
  const { t } = useTranslation()
  const { modeDef } = useMode()
  const groups = groupedFeatures(modeDef.id)

  const recents = useCollection(recentFeaturesCol)
  const recentFeatures = recents
    .map((r) => getFeature(r.featureId))
    .filter(
      (f): f is NonNullable<typeof f> =>
        !!f && f.modes.includes(modeDef.id) && f.status === 'ready',
    )
    .slice(0, 4)

  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed)
  const toggleGroup = (g: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]))
      } catch {
        /* ignore */
      }
      return next
    })
  }

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
            E
          </div>
          <div>
            <p className="text-sm font-bold leading-none text-slate-800 dark:text-slate-100">
              {t('shell.brandName', { defaultValue: '教學易' })}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {t('shell.brandSub', { defaultValue: '教師工作台 · 個人成長' })}
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
          <span>{t('shell.home', { defaultValue: '首頁概覽' })}</span>
        </button>

        {recentFeatures.length > 0 && (
          <div>
            <p className="px-3 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
              {t('shell.recent', { defaultValue: '最近' })}
            </p>
            {recentFeatures.map((f) => {
              const on = activeId === f.id
              return (
                <button key={`r-${f.id}`} onClick={() => choose(f.id)} className={navClass(on)}>
                  <FeatureIcon icon={f.icon} size={18} className={iconColor(on)} />
                  <span className="flex-1 text-left">{featName(t, f)}</span>
                </button>
              )
            })}
          </div>
        )}

        {groups.map((g) => {
          const isCol = collapsed.has(g.group)
          return (
            <div key={g.group}>
              <button
                onClick={() => toggleGroup(g.group)}
                aria-expanded={!isCol}
                className="flex w-full items-center justify-between rounded-md px-3 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-500 dark:hover:text-slate-300"
              >
                <span>{groupLabel(t, g.group)}</span>
                <ChevronDown
                  size={12}
                  className={cx('transition-transform', isCol && '-rotate-90')}
                />
              </button>
              {!isCol &&
                g.items.map((f) => {
                  const on = activeId === f.id
                  return (
                    <button
                      key={f.id}
                      onClick={() => choose(f.id)}
                      className={navClass(on)}
                    >
                      <FeatureIcon icon={f.icon} size={18} className={iconColor(on)} />
                      <span className="flex-1 text-left">{featName(t, f)}</span>
                      {f.status === 'soon' && (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                          {t('shell.soon', { defaultValue: '即將' })}
                        </span>
                      )}
                    </button>
                  )
                })}
            </div>
          )
        })}
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
          <span>{t('shell.settings', { defaultValue: '設定' })}</span>
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
