import { useEffect, useMemo, useRef, useState } from 'react'
import { FEATURES } from '../features/registry'
import { useMode } from '../context/ModeContext'
import { MODES, MODE_ORDER } from '../modes/modes'

// ============================================================
//  指令面板 (Command Palette) — 按 ⌘K / Ctrl+K 開啟
//  快速跳去任何功能、切換模式。商用級導航體驗。
// ============================================================

interface Props {
  open: boolean
  onClose: () => void
  onNavigate: (featureId: string | null) => void
}

export default function CommandPalette({ open, onClose, onNavigate }: Props) {
  const { mode, setMode } = useMode()
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
  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    type Item = {
      id: string
      label: string
      icon: string
      hint: string
      action: () => void
    }
    const list: Item[] = []

    // 首頁
    list.push({
      id: 'home',
      label: '首頁概覽',
      icon: '🏠',
      hint: '導航',
      action: () => onNavigate(null),
    })

    // 目前模式功能
    FEATURES.filter((f) => f.modes.includes(mode)).forEach((f) =>
      list.push({
        id: f.id,
        label: f.name,
        icon: f.icon,
        hint: f.group,
        action: () => onNavigate(f.id),
      }),
    )

    // 切換到另一模式
    MODE_ORDER.filter((m) => m !== mode).forEach((m) =>
      list.push({
        id: `mode-${m}`,
        label: `切換到${MODES[m].name}`,
        icon: MODES[m].icon,
        hint: '模式',
        action: () => {
          setMode(m)
          onNavigate(null)
        },
      }),
    )

    return q
      ? list.filter((i) => i.label.toLowerCase().includes(q))
      : list
  }, [query, mode, onNavigate, setMode])

  useEffect(() => {
    setActive(0)
  }, [query])

  if (!open) return null

  const run = (idx: number) => {
    const item = items[idx]
    if (item) {
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
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 dark:border-slate-700">
          <span className="text-slate-400">🔍</span>
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
          <kbd className="hidden rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400 dark:border-slate-600 sm:block">
            ESC
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-slate-400">
              搵唔到「{query}」
            </li>
          )}
          {items.map((item, idx) => (
            <li key={item.id}>
              <button
                onMouseEnter={() => setActive(idx)}
                onClick={() => run(idx)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                  idx === active
                    ? 'bg-accent-soft text-accent-strong dark:bg-accent/20 dark:text-accent'
                    : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="flex-1 font-medium">{item.label}</span>
                <span className="text-xs text-slate-400">{item.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
