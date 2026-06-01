import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Clock } from 'lucide-react'
import { FEATURES } from '../features/registry'
import { FeatureIcon } from '../features/featureIcons'
import { useMode } from '../context/ModeContext'
import { useCollection } from '../lib/store'
import { MODES, MODE_ORDER } from '../modes/modes'
import { Kbd, cx } from '../ui'
import {
  recentFeaturesCol,
  pushRecentFeature,
  resolveRecentItems,
} from './commandPalette/util'

// ============================================================
//  指令面板 (Command Palette) — 按 ⌘K / Ctrl+K 開啟
//  快速跳去任何功能、切換模式。商用級導航體驗。
// ============================================================

interface Props {
  open: boolean
  onClose: () => void
  onNavigate: (featureId: string | null) => void
}

// 一個可跳轉項目（功能 / 首頁 / 模式切換）。id 對齊 resolveRecentItems 嘅 featureId。
interface Item {
  id: string
  label: string
  icon: string
  hint: string
  recordable: boolean // 跳去「目的地」（首頁 / 功能）先記入最近；模式切換 false
  action: () => void
}

export default function CommandPalette({ open, onClose, onNavigate }: Props) {
  const { mode, setMode } = useMode()
  const recentFeatures = useCollection(recentFeaturesCol)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  // 組合所有可跳轉項目：目前模式嘅功能 + 模式切換
  // recordable：跳去一個「目的地」（首頁 / 功能）先記入最近；模式切換唔記。
  const baseItems = useMemo(() => {
    const list: Item[] = []

    list.push({
      id: 'home',
      label: '首頁概覽',
      icon: '🏠',
      hint: '導航',
      recordable: true,
      action: () => onNavigate(null),
    })

    FEATURES.filter((f) => f.modes.includes(mode)).forEach((f) =>
      list.push({
        id: f.id,
        label: f.name,
        icon: f.icon,
        hint: f.group,
        recordable: true,
        action: () => onNavigate(f.id),
      }),
    )

    MODE_ORDER.filter((m) => m !== mode).forEach((m) =>
      list.push({
        id: `mode-${m}`,
        label: `切換到${MODES[m].name}`,
        icon: MODES[m].icon,
        hint: '模式',
        recordable: false,
        action: () => {
          setMode(m)
          onNavigate(null)
        },
      }),
    )

    return list
  }, [mode, onNavigate, setMode])

  // 未輸入關鍵字時，喺最頂顯示「最近使用」（按開啟次序解析返目前有效項，
  // 隔走已唔屬目前模式 / 已移除嘅）。有輸入則照舊純搜尋、唔分區。
  const recentItems = useMemo(
    () =>
      query.trim()
        ? []
        : resolveRecentItems(recentFeatures, baseItems),
    [query, recentFeatures, baseItems],
  )

  // 鍵盤導航用嘅扁平序：最近區（如有）排頭、之後全部項目（去除已喺最近區嘅，
  // 避免重複）。recentCount = 最近區喺扁平序裡頭佔嘅項數（畀渲染畫分隔線）。
  const { items, recentCount } = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) {
      return {
        items: baseItems.filter((i) => i.label.toLowerCase().includes(q)),
        recentCount: 0,
      }
    }
    const recentIds = new Set(recentItems.map((i) => i.id))
    const rest = baseItems.filter((i) => !recentIds.has(i.id))
    return { items: [...recentItems, ...rest], recentCount: recentItems.length }
  }, [query, baseItems, recentItems])

  useEffect(() => {
    setActive(0)
  }, [query])

  if (!open) return null

  const run = (idx: number) => {
    const item = items[idx]
    if (item) {
      if (item.recordable) pushRecentFeature(item.id)
      item.action()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center pt-[12vh]">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-overlay ring-1 ring-slate-900/5 dark:bg-slate-800 dark:ring-white/10">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 dark:border-slate-700">
          <Search size={18} strokeWidth={1.75} className="text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, items.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                run(active)
              } else if (e.key === 'Escape') {
                onClose()
              }
            }}
            placeholder="搜尋功能、切換模式…"
            className="flex-1 bg-transparent py-3.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          <Kbd className="hidden sm:inline-flex">ESC</Kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-slate-400">
              搵唔到「{query}」
            </li>
          )}
          {items.map((item, idx) => {
            const on = idx === active
            // 未輸入時分區：第 0 項前加「最近使用」標題；最近區之後第一項前加
            // 「全部功能」標題（recentCount === 0 即無最近區，唔顯示任何標題）。
            const header =
              recentCount > 0 && idx === 0
                ? '最近使用'
                : recentCount > 0 && idx === recentCount
                  ? '全部功能'
                  : null
            return (
              <Fragment key={item.id}>
                {header && (
                  <li
                    role="presentation"
                    className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
                  >
                    {header === '最近使用' && <Clock size={12} />}
                    {header}
                  </li>
                )}
                <li aria-selected={on} role="option">
                <button
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => run(idx)}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                    on
                      ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                      : 'text-slate-700 dark:text-slate-200',
                  )}
                >
                  <FeatureIcon
                    icon={item.icon}
                    size={18}
                    className={on ? 'text-accent' : 'text-slate-400'}
                  />
                  <span className="flex-1 font-medium">{item.label}</span>
                  <span
                    className={cx(
                      'text-xs',
                      on
                        ? 'text-accent-strong/70 dark:text-accent/70'
                        : 'text-slate-400',
                    )}
                  >
                    {item.hint}
                  </span>
                </button>
                </li>
              </Fragment>
            )
          })}
        </ul>
        <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <Kbd>↑↓</Kbd> 選擇
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> 開啟
          </span>
          <span className="flex items-center gap-1">
            <Kbd>esc</Kbd> 關閉
          </span>
        </div>
      </div>
    </div>
  )
}
