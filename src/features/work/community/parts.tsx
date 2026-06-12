import { Star } from 'lucide-react'
import { cx } from '../../../ui'
import { SUBJECT_PACKS } from '../../../data/subjects'
import { publicName } from './util'
import type { CommunityProfile } from '../../../lib/community'

// ============================================================
//  資源分享區 — 共用細件（頭像 / 星評 / 開關 / 科目名）
// ============================================================

export const subjectName = (id: string | null | undefined): string | null =>
  id ? (SUBJECT_PACKS.find((p) => p.id === id)?.short ?? id) : null

/** 縮寫頭像（匿名 → 灰底「匿」；否則 pack avatarColor + 署名首字）。 */
export function Avatar({ profile, size = 28 }: { profile?: CommunityProfile | null; size?: number }) {
  const name = profile ? publicName(profile) : '老師'
  // 取署名最後一段（去學校前綴）嘅首字做縮寫
  const initial = [...name.replace(/^.*\s/, '')][0] ?? '師'
  const bg = profile?.anonymous ? '64748B' : (profile?.avatarColor ?? '4F46E5')
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: `#${bg}`, fontSize: size * 0.42 }}
    >
      {initial}
    </span>
  )
}

/** 只讀星評（4 捨 5 入填滿；可選顯示數量）。 */
export function Stars({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`${value.toFixed(1)} 星`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={12}
          className={cx(n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600')}
        />
      ))}
      {count != null && count > 0 && <span className="ml-0.5 text-[11px] text-slate-400">({count})</span>}
    </span>
  )
}

/** 可撳星評（揀星）。 */
export function StarPicker({ value, onPick }: { value: number; onPick: (n: number) => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onPick(n)} className="transition active:scale-90" aria-label={`${n} 星`}>
          <Star
            size={22}
            className={cx(n <= value ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-300 dark:text-slate-600')}
          />
        </button>
      ))}
    </span>
  )
}

/** 細 switch（show_school / anonymous 用）。 */
export function Toggle({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <span className="min-w-0">
        <span className="block text-sm text-slate-700 dark:text-slate-200">{label}</span>
        {hint && <span className="block text-[11px] text-slate-400">{hint}</span>}
      </span>
      <span
        className={cx(
          'relative h-5 w-9 shrink-0 rounded-full transition',
          on ? 'bg-accent' : 'bg-slate-300 dark:bg-slate-600',
        )}
      >
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', on ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  )
}
