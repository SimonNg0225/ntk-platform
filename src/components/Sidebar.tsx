import { useMemo, useState, type ReactNode } from 'react'
import {
  X,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  PanelLeftClose,
  Pin,
  Rows3,
  Search,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMode } from '../context/ModeContext'
import { groupedFeatures, getFeature } from '../features/registry'
import type { Feature } from '../features/types'
import { FeatureIcon } from '../features/featureIcons'
import { useCollection } from '../lib/store'
import { recentFeaturesCol } from './commandPalette/util'
import { pinnedFeaturesCol, togglePin } from './sidebar/pins'
import { cx, IconButton } from '../ui'
import { featName, groupLabel } from '../i18n/appEn'
import ModeSwitcher from './ModeSwitcher'
import AccountBox from './AccountBox'
import { useAuth } from '../context/AuthContext'

const COLLAPSE_KEY = 'ntk.sidebarCollapsed'
const ACCORDION_KEY = 'ntk.sidebarAccordion'

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveCollapsed(next: Set<string>) {
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]))
  } catch {
    /* ignore */
  }
}

function loadAccordion(): boolean {
  try {
    return localStorage.getItem(ACCORDION_KEY) === '1'
  } catch {
    return false
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

// 側邊欄 — 品牌 / 模式切換 / 該模式嘅功能導覽（分組 + 篩選 + 釘選）
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
  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups])

  // 釘選 / 最近：解析返「目前模式、ready」嘅功能，保留各自次序、去重。
  const pins = useCollection(pinnedFeaturesCol)
  const recents = useCollection(recentFeaturesCol)
  const pinnedIds = useMemo(() => new Set(pins.map((p) => p.featureId)), [pins])

  const resolveFeatures = (ids: { featureId: string }[], limit: number) => {
    const seen = new Set<string>()
    const out: Feature[] = []
    for (const r of ids) {
      if (seen.has(r.featureId)) continue
      const f = getFeature(r.featureId)
      if (f && f.modes.includes(modeDef.id) && f.status === 'ready') {
        out.push(f)
        seen.add(r.featureId)
        if (out.length >= limit) break
      }
    }
    return out
  }
  const pinnedFeatures = resolveFeatures(pins, 8)
  // 最近：隔走已釘嘅（已喺上面顯示），最多補夠 4 個。
  const recentFeatures = resolveFeatures(recents, 12)
    .filter((f) => !pinnedIds.has(f.id))
    .slice(0, 4)

  // 篩選（Tier 2 ①）：有輸入就改顯示扁平結果，蓋過分組 / 釘選 / 最近。
  const [filter, setFilter] = useState('')
  const q = filter.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!q) return []
    return allItems.filter(
      (f) =>
        featName(t, f).toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q),
    )
  }, [q, allItems, t])

  // 分組收合 + 手風琴（Tier 3）
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed)
  const [accordion, setAccordion] = useState<boolean>(loadAccordion)

  const toggleGroup = (g: string) => {
    setCollapsed((prev) => {
      let next: Set<string>
      if (accordion) {
        // 一次只開一組：揀嗰組打開、其餘收起。
        next = prev.has(g)
          ? new Set(groups.map((x) => x.group).filter((n) => n !== g))
          : new Set(groups.map((x) => x.group))
      } else {
        next = new Set(prev)
        if (next.has(g)) next.delete(g)
        else next.add(g)
      }
      saveCollapsed(next)
      return next
    })
  }

  const curNames = groups.map((g) => g.group)
  const allCollapsed = curNames.length > 0 && curNames.every((n) => collapsed.has(n))
  const toggleAllGroups = () => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (allCollapsed) curNames.forEach((n) => next.delete(n))
      else curNames.forEach((n) => next.add(n))
      saveCollapsed(next)
      return next
    })
  }

  const toggleAccordion = () => {
    setAccordion((a) => {
      const next = !a
      try {
        localStorage.setItem(ACCORDION_KEY, next ? '1' : '0')
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
          {pinnedFeatures.length > 0 && (
            <div className="space-y-0.5">
              <div className="mx-auto my-1.5 h-px w-6 bg-black/[0.06] dark:bg-white/[0.08]" />
              {pinnedFeatures.map((f) => {
                const on = activeId === f.id
                return (
                  <RailButton key={`p-${f.id}`} active={on} title={featName(t, f)} onClick={() => choose(f.id)}>
                    <FeatureIcon icon={f.icon} size={18} className={iconColor(on)} />
                  </RailButton>
                )
              })}
            </div>
          )}
          {groups.map((g) => (
            <div key={g.group} className="space-y-0.5">
              <div className="mx-auto my-1.5 h-px w-6 bg-black/[0.06] dark:bg-white/[0.08]" />
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

      {/* 篩選 + 分組工具（Tier 2 ① / Tier 3） */}
      <div className="mt-3 flex items-center gap-1 px-4">
        <div className="relative flex-1">
          <Search
            size={15}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('shell.filterFeatures', { defaultValue: '搜尋功能…' })}
            aria-label={t('shell.filterFeatures', { defaultValue: '搜尋功能…' })}
            className="w-full rounded-lg border border-black/[0.08] bg-black/[0.02] py-1.5 pl-8 pr-7 text-[13px] text-slate-700 placeholder:text-slate-400 transition focus:border-accent/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:focus:bg-slate-800"
          />
          {filter && (
            <button
              onClick={() => setFilter('')}
              aria-label={t('shell.clear', { defaultValue: '清除' })}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:text-slate-300"
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>
        {!filter && (
          <>
            <button
              onClick={toggleAccordion}
              aria-pressed={accordion}
              title={t('shell.accordion', { defaultValue: '手風琴模式（開一組自動收其他）' })}
              aria-label={t('shell.accordion', { defaultValue: '手風琴模式' })}
              className={cx(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                accordion
                  ? 'bg-accent/10 text-accent dark:bg-accent/20'
                  : 'text-slate-400 hover:bg-black/[0.04] hover:text-slate-600 dark:hover:bg-white/[0.06] dark:hover:text-slate-300',
              )}
            >
              <Rows3 size={15} strokeWidth={1.75} />
            </button>
            <button
              onClick={toggleAllGroups}
              title={
                allCollapsed
                  ? t('shell.expandAll', { defaultValue: '展開全部' })
                  : t('shell.collapseAll', { defaultValue: '收起全部' })
              }
              aria-label={
                allCollapsed
                  ? t('shell.expandAll', { defaultValue: '展開全部' })
                  : t('shell.collapseAll', { defaultValue: '收起全部' })
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-black/[0.04] hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-white/[0.06] dark:hover:text-slate-300"
            >
              {allCollapsed ? (
                <ChevronsUpDown size={15} strokeWidth={1.75} />
              ) : (
                <ChevronsDownUp size={15} strokeWidth={1.75} />
              )}
            </button>
          </>
        )}
      </div>

      {/* 功能導覽 */}
      <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-4 pb-4">
        {q ? (
          // ── 篩選結果（扁平）──
          filtered.length > 0 ? (
            <div className="pt-1">
              {filtered.map((f) => (
                <NavRow
                  key={`s-${f.id}`}
                  active={activeId === f.id}
                  icon={f.icon}
                  label={featName(t, f)}
                  onSelect={() => choose(f.id)}
                  pinId={f.id}
                  pinned={pinnedIds.has(f.id)}
                  badge={f.status === 'soon' ? <SoonBadge /> : undefined}
                />
              ))}
            </div>
          ) : (
            <p className="px-3 pt-6 text-center text-[13px] text-slate-400 dark:text-slate-500">
              {t('shell.noFeatureMatch', { defaultValue: '搵唔到對應功能' })}
            </p>
          )
        ) : (
          <>
            <NavRow
              active={activeId === null}
              icon="🏠"
              label={t('shell.home', { defaultValue: '首頁概覽' })}
              onSelect={() => choose(null)}
            />

            {(pinnedFeatures.length > 0 || recentFeatures.length > 0) && (
              <div>
                <p className="flex items-center gap-1.5 px-3 pb-1 pt-5 text-[11px] font-semibold text-slate-400/90 dark:text-slate-500">
                  <Pin size={11} strokeWidth={2} className="fill-current opacity-70" />
                  {t('shell.pinnedRecent', { defaultValue: '已釘選 · 最近' })}
                </p>
                {pinnedFeatures.map((f) => (
                  <NavRow
                    key={`p-${f.id}`}
                    active={activeId === f.id}
                    icon={f.icon}
                    label={featName(t, f)}
                    onSelect={() => choose(f.id)}
                    pinId={f.id}
                    pinned
                  />
                ))}
                {recentFeatures.map((f) => (
                  <NavRow
                    key={`r-${f.id}`}
                    active={activeId === f.id}
                    icon={f.icon}
                    label={featName(t, f)}
                    onSelect={() => choose(f.id)}
                    pinId={f.id}
                    pinned={false}
                  />
                ))}
              </div>
            )}

            {groups.map((g) => {
              const isCol = collapsed.has(g.group)
              return (
                <div key={g.group}>
                  <button
                    onClick={() => toggleGroup(g.group)}
                    aria-expanded={!isCol}
                    className="sticky top-0 z-[5] flex w-full items-center gap-2 rounded-md bg-white/90 px-3 pb-1 pt-5 text-[11px] font-semibold text-slate-400/90 backdrop-blur-sm transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:bg-slate-900/90 dark:text-slate-500 dark:hover:text-slate-300"
                  >
                    <span className="tracking-tight">{groupLabel(t, g.group)}</span>
                    <span className="rounded-full bg-black/[0.05] px-1.5 text-[10px] font-medium tabular-nums text-slate-400 dark:bg-white/10 dark:text-slate-500">
                      {g.items.length}
                    </span>
                    <ChevronDown
                      size={13}
                      className={cx('ml-auto transition-transform', isCol && '-rotate-90')}
                    />
                  </button>
                  <div
                    className={cx(
                      'grid transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                      isCol ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr] opacity-100',
                    )}
                  >
                    <div className="space-y-0.5 overflow-hidden">
                      {g.items.map((f) => (
                        <NavRow
                          key={f.id}
                          active={activeId === f.id}
                          icon={f.icon}
                          label={featName(t, f)}
                          onSelect={() => choose(f.id)}
                          tabIndex={isCol ? -1 : 0}
                          pinId={f.id}
                          pinned={pinnedIds.has(f.id)}
                          badge={f.status === 'soon' ? <SoonBadge /> : undefined}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </nav>

      {/* 頁腳：後台（admin）+ 設定 + 帳戶區 + 版本 */}
      <div className="border-t border-black/[0.06] dark:border-white/[0.06]">
        <div className="space-y-0.5 p-2">
          {showAdmin && (
            <NavRow
              active={activeId === '__admin__'}
              icon="🛠️"
              label={t('shell.admin', { defaultValue: '後台管理' })}
              onSelect={() => {
                onOpenAdmin?.()
                onClose?.()
              }}
            />
          )}
          <NavRow
            active={activeId === '__settings__'}
            icon="⚙️"
            label={t('shell.settings', { defaultValue: '設定' })}
            onSelect={() => {
              onOpenSettings?.()
              onClose?.()
            }}
          />
        </div>
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
  return active ? 'text-accent' : 'text-slate-400 dark:text-slate-500'
}

function SoonBadge() {
  const { t } = useTranslation()
  return (
    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:bg-slate-800 dark:text-slate-500">
      {t('shell.soon', { defaultValue: '即將' })}
    </span>
  )
}

// 導覽列：icon chip + 標籤 + active 左條 + （選用）釘選掣 + （選用）badge。
// 主按鈕同釘選掣係兄弟（唔係巢狀 button），釘選掣 z-10 浮喺上面，撳佢唔會觸發跳轉。
function NavRow({
  active,
  icon,
  label,
  onSelect,
  tabIndex,
  badge,
  pinId,
  pinned = false,
}: {
  active: boolean
  icon: string
  label: string
  onSelect: () => void
  tabIndex?: number
  badge?: ReactNode
  pinId?: string
  pinned?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="group/navrow relative">
      <button onClick={onSelect} tabIndex={tabIndex} className={navClass(active)}>
        {active && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-0 inset-y-1.5 w-[3px] rounded-r-full bg-accent"
          />
        )}
        <span className={chipClass(active)}>
          <FeatureIcon icon={icon} size={16} className={iconColor(active)} />
        </span>
        <span className="flex-1 truncate text-left">{label}</span>
        {badge}
        {pinId && <span aria-hidden className="w-5 shrink-0" />}
      </button>
      {pinId && (
        <button
          onClick={() => togglePin(pinId)}
          aria-label={
            pinned
              ? t('shell.unpin', { defaultValue: '取消釘選' })
              : t('shell.pin', { defaultValue: '釘選' })
          }
          title={
            pinned
              ? t('shell.unpin', { defaultValue: '取消釘選' })
              : t('shell.pin', { defaultValue: '釘選' })
          }
          className={cx(
            'absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded-md p-1 transition focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent/40',
            pinned
              ? 'text-accent opacity-100'
              : 'text-slate-400 opacity-0 hover:bg-black/[0.06] hover:text-slate-600 group-hover/navrow:opacity-100 dark:hover:bg-white/10 dark:hover:text-slate-200',
          )}
        >
          <Pin size={13} strokeWidth={1.75} className={cx(pinned && 'fill-current')} />
        </button>
      )}
    </div>
  )
}

function chipClass(active: boolean) {
  return cx(
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition',
    active
      ? 'bg-accent/15'
      : 'bg-black/[0.035] group-hover/navrow:bg-black/[0.06] dark:bg-white/[0.06] dark:group-hover/navrow:bg-white/[0.1]',
  )
}

function navClass(active: boolean) {
  return cx(
    'group flex w-full items-center gap-2 rounded-lg px-2 py-1 text-[13px] transition duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.985]',
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
