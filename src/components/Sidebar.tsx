import { useState, type ReactNode } from 'react'
import { X, ChevronDown, PanelLeftClose } from 'lucide-react'
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
import { useAuth } from '../context/AuthContext'

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
  /** 開後台管理（只 admin 顯示入口） */
  onOpenAdmin?: () => void
  /** 喺手機抽屜入面用：揀完一項就關抽屜 */
  onClose?: () => void
  className?: string
  /** 桌面幼條（icon-only）模式 */
  rail?: boolean
  /** 收合一步（展開→幼條→收起）；只桌面傳入 */
  onCollapse?: () => void
  /** 由幼條一鍵展開返 */
  onExpand?: () => void
}

// 側邊欄 — 品牌 / 模式切換 / 該模式嘅功能導覽（分組）
export default function Sidebar({
  activeId,
  onSelect,
  onOpenSettings,
  onOpenAdmin,
  onClose,
  className = '',
  rail = false,
  onCollapse,
  onExpand,
}: Props) {
  const { t } = useTranslation()
  const { modeDef } = useMode()
  const { isAdmin: showAdmin } = useAuth()
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

  // ───────── 幼條（icon-only）模式 ─────────
  if (rail) {
    return (
      <aside
        className={cx(
          'flex w-[68px] shrink-0 flex-col border-r border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.06] dark:bg-slate-900/70',
          className,
        )}
      >
        {/* 品牌：撳 logo 展開 */}
        <div className="flex justify-center px-2 py-3">
          <button
            onClick={onExpand}
            title={t('shell.expandSidebar', { defaultValue: '展開側欄' })}
            aria-label={t('shell.expandSidebar', { defaultValue: '展開側欄' })}
            className="rounded-xl transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <img
              src="/favicon.svg"
              alt="EziTeach 教學易"
              className="h-10 w-10 rounded-xl shadow-sm"
            />
          </button>
        </div>

        {/* 功能 icon 列 */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-1">
          <RailButton
            active={activeId === null}
            title={t('shell.home', { defaultValue: '首頁概覽' })}
            onClick={() => choose(null)}
          >
            <FeatureIcon icon="🏠" size={18} className={iconColor(activeId === null)} />
          </RailButton>
          {groups.map((g, gi) => (
            <div key={g.group} className="space-y-0.5">
              {gi > 0 && (
                <div className="mx-auto my-1.5 h-px w-6 bg-black/[0.06] dark:bg-white/[0.08]" />
              )}
              {g.items.map((f) => {
                const on = activeId === f.id
                return (
                  <RailButton
                    key={f.id}
                    active={on}
                    title={featName(t, f)}
                    onClick={() => choose(f.id)}
                  >
                    <FeatureIcon icon={f.icon} size={18} className={iconColor(on)} />
                  </RailButton>
                )
              })}
            </div>
          ))}
        </nav>

        {/* 頁腳：後台（admin）+ 設定 + 完全收起 */}
        <div className="flex flex-col items-center gap-1 border-t border-black/[0.06] py-2 dark:border-white/[0.06]">
          {showAdmin && (
            <RailButton
              active={activeId === '__admin__'}
              title="後台管理"
              onClick={() => {
                onOpenAdmin?.()
                onClose?.()
              }}
            >
              <FeatureIcon icon="🛠️" size={18} className={iconColor(activeId === '__admin__')} />
            </RailButton>
          )}
          <RailButton
            active={activeId === '__settings__'}
            title={t('shell.settings', { defaultValue: '設定' })}
            onClick={() => {
              onOpenSettings?.()
              onClose?.()
            }}
          >
            <FeatureIcon
              icon="⚙️"
              size={18}
              className={iconColor(activeId === '__settings__')}
            />
          </RailButton>
          {onCollapse && (
            <button
              onClick={onCollapse}
              title={t('shell.hideSidebar', { defaultValue: '完全收起（⌘B）' })}
              aria-label={t('shell.hideSidebar', { defaultValue: '完全收起' })}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-black/[0.04] hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
            >
              <PanelLeftClose size={17} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </aside>
    )
  }

  return (
    <aside
      className={cx(
        'flex w-72 shrink-0 flex-col border-r border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.06] dark:bg-slate-900/70',
        className,
      )}
    >
      {/* 品牌 */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2.5">
          <img
            src="/favicon.svg"
            alt="EziTeach 教學易"
            className="h-10 w-10 rounded-xl shadow-sm"
          />
          <div>
            <p className="text-[15px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100">
              {t('shell.brandName', { defaultValue: '教學易' })}
            </p>
            <p className="mt-1.5 text-[11px] tracking-tight text-slate-400 dark:text-slate-500">
              {t('shell.brandSub', { defaultValue: '教師工作台 · 個人成長' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {onCollapse && (
            <IconButton
              label={t('shell.collapseSidebar', { defaultValue: '收合側欄（⌘B）' })}
              onClick={onCollapse}
              className="hidden md:inline-flex"
            >
              <PanelLeftClose size={18} strokeWidth={1.75} />
            </IconButton>
          )}
          {onClose && (
            <IconButton label="關閉選單" onClick={onClose} className="md:hidden">
              <X size={18} strokeWidth={1.75} />
            </IconButton>
          )}
        </div>
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
            <p className="px-3 pb-1 pt-5 text-[11px] font-semibold text-slate-400/90 dark:text-slate-500">
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
                className="flex w-full items-center justify-between rounded-md px-3 pb-1 pt-5 text-[11px] font-semibold text-slate-400/90 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:text-slate-500 dark:hover:text-slate-300"
              >
                <span>{groupLabel(t, g.group)}</span>
                <ChevronDown
                  size={12}
                  className={cx('transition-transform', isCol && '-rotate-90')}
                />
              </button>
              <div
                className={cx(
                  'grid transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                  isCol ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
                )}
              >
                <div className="space-y-0.5 overflow-hidden">
                  {g.items.map((f) => {
                    const on = activeId === f.id
                    return (
                      <button
                        key={f.id}
                        onClick={() => choose(f.id)}
                        tabIndex={isCol ? -1 : 0}
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
              </div>
            </div>
          )
        })}
      </nav>

      {/* 頁腳：後台（admin）+ 設定 + 帳戶區 + 版本 */}
      <div className="border-t border-black/[0.06] dark:border-white/[0.06]">
        {showAdmin && (
          <button
            onClick={() => {
              onOpenAdmin?.()
              onClose?.()
            }}
            className={cx(navClass(activeId === '__admin__'), 'mx-2 mt-2 w-[calc(100%-1rem)]')}
          >
            <FeatureIcon icon="🛠️" size={18} className={iconColor(activeId === '__admin__')} />
            <span>後台管理</span>
          </button>
        )}
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
  return active
    ? 'text-accent'
    : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
}

function navClass(active: boolean) {
  return cx(
    'group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.985]',
    active
      ? 'bg-accent/10 font-semibold text-accent-strong dark:bg-accent/20 dark:text-accent'
      : 'font-medium text-slate-600 hover:bg-black/[0.04] hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white',
  )
}

// 幼條模式嘅單個 icon 掣（置中、native title tooltip、active 有 ring）
function RailButton({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean
  title: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cx(
        'group mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.97]',
        active
          ? 'bg-accent/10 ring-1 ring-accent/25 dark:bg-accent/20'
          : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]',
      )}
    >
      {children}
    </button>
  )
}
