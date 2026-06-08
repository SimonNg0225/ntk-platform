import { useState } from 'react'
import {
  Clapperboard,
  ClipboardList,
  FileText,
  Link as LinkIcon,
  Presentation,
  Star,
  StickyNote,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cx } from '../../../ui'
import type { ResourceType } from '../../../data/types'
import { TYPE_COLOR, faviconLetter } from './util'

// ============================================================
//  共用細件（多個視圖重用）
// ============================================================

export const TYPE_ICON: Record<ResourceType, LucideIcon> = {
  handout: FileText,
  slides: Presentation,
  paper: ClipboardList,
  link: LinkIcon,
  video: Clapperboard,
  note: StickyNote,
}

// ───────── 類型圖示方塊 ─────────
export function TypeIconBox({
  type,
  size = 'md',
}: {
  type: ResourceType
  size?: 'sm' | 'md'
}) {
  const Icon = TYPE_ICON[type]
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  return (
    <span
      className={cx(
        'flex shrink-0 items-center justify-center rounded-xl',
        dim,
        TYPE_COLOR[type].iconWrap,
      )}
    >
      <Icon size={size === 'sm' ? 16 : 20} strokeWidth={1.75} />
    </span>
  )
}

// ───────── 網域 favicon 替身（文字 token）─────────
export function FaviconChip({ domain }: { domain?: string }) {
  if (!domain) return null
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
      <span className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-slate-200 text-[9px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
        {faviconLetter(domain)}
      </span>
      <span className="max-w-[12rem] truncate">{domain}</span>
    </span>
  )
}

// ───────── 星評（互動 / 唯讀）─────────
export function StarRating({
  value,
  onChange,
  size = 14,
}: {
  value: number
  onChange?: (v: number) => void
  size?: number
}) {
  const [hover, setHover] = useState(0)
  const readOnly = !onChange
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (hover || value) >= n
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onMouseEnter={() => !readOnly && setHover(n)}
            onMouseLeave={() => !readOnly && setHover(0)}
            onClick={(e) => {
              e.stopPropagation()
              if (onChange) onChange(value === n ? 0 : n)
            }}
            className={cx(
              'transition',
              !readOnly && 'cursor-pointer hover:scale-110',
              readOnly && 'cursor-default',
            )}
            aria-label={`評 ${n} 星`}
          >
            <Star
              size={size}
              className={cx(
                active
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-slate-300 dark:text-slate-600',
              )}
            />
          </button>
        )
      })}
    </span>
  )
}

// ───────── 標籤輸入（chips + enter / 逗號分隔 + 建議）─────────
export function TagEditor({
  value,
  onChange,
  suggestions = [],
}: {
  value: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
}) {
  const [draft, setDraft] = useState('')
  const add = (raw: string) => {
    const t = raw.trim().replace(/^#/, '')
    if (!t) return
    if (!value.includes(t)) onChange([...value, t])
    setDraft('')
  }
  const remove = (t: string) => onChange(value.filter((x) => x !== t))
  const pool = suggestions
    .filter((s) => !value.includes(s) && (!draft || s.includes(draft.trim())))
    .slice(0, 6)
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 dark:border-slate-700 dark:bg-slate-800">
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-strong dark:bg-accent/15 dark:text-accent"
          >
            #{t}
            <button
              type="button"
              onClick={() => remove(t)}
              className="rounded hover:text-rose-500"
              aria-label={`移除標籤 ${t}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add(draft)
            } else if (e.key === 'Backspace' && !draft && value.length) {
              remove(value[value.length - 1])
            }
          }}
          placeholder={value.length ? '' : '輸入標籤後按 Enter…'}
          className="min-w-[6rem] flex-1 bg-transparent text-base sm:text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>
      {pool.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {pool.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
