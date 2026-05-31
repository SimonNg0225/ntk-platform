import { useState } from 'react'
import { Star } from 'lucide-react'
import { cx } from '../../../ui'

// ============================================================
//  半星評分（hover 預覽；readOnly 顯示用）
// ============================================================

export function StarRating({
  value,
  onChange,
  size = 20,
  readOnly = false,
}: {
  value: number
  onChange?: (v: number) => void
  size?: number
  readOnly?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value

  return (
    <div className="inline-flex items-center gap-0.5" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const full = shown >= star
        const half = !full && shown >= star - 0.5
        return (
          <span key={star} className="relative inline-flex" style={{ width: size, height: size }}>
            {/* 底層空星 */}
            <Star
              size={size}
              className="absolute inset-0 text-slate-300 dark:text-slate-600"
              strokeWidth={1.75}
            />
            {/* 上層實星（full / half 裁切） */}
            {(full || half) && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: half ? size / 2 : size }}
              >
                <Star
                  size={size}
                  className="text-amber-400"
                  fill="currentColor"
                  strokeWidth={1.75}
                />
              </span>
            )}
            {!readOnly && (
              <>
                {/* 左半（.5）*/}
                <button
                  type="button"
                  aria-label={`${star - 0.5} 星`}
                  className="absolute inset-y-0 left-0 z-10 w-1/2 cursor-pointer"
                  onMouseEnter={() => setHover(star - 0.5)}
                  onClick={() => onChange?.(value === star - 0.5 ? 0 : star - 0.5)}
                />
                {/* 右半（整星）*/}
                <button
                  type="button"
                  aria-label={`${star} 星`}
                  className="absolute inset-y-0 right-0 z-10 w-1/2 cursor-pointer"
                  onMouseEnter={() => setHover(star)}
                  onClick={() => onChange?.(value === star ? 0 : star)}
                />
              </>
            )}
          </span>
        )
      })}
      {!readOnly && (
        <span className={cx('ml-1.5 w-7 text-xs tabular-nums', shown > 0 ? 'text-amber-500' : 'text-slate-400')}>
          {shown > 0 ? shown.toFixed(1) : '—'}
        </span>
      )}
    </div>
  )
}
