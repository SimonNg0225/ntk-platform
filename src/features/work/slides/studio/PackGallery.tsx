import { Check } from 'lucide-react'
import { SLIDE_PACKS, type SlidePackId } from '../../../../lib/export'
import { cx } from '../../../../ui'
import PackPreview from '../PackPreview'

// ============================================================
//  視覺模板廊 —— 34 套 pack 用 PackPreview SVG 縮圖排成可揀 gallery。
//  揀邊套，右邊即時預覽就用嗰套設計 token 換色（Canva feel）。
// ============================================================

export default function PackGallery({
  pack,
  onPack,
}: {
  pack: SlidePackId
  onPack: (p: SlidePackId) => void
}): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {SLIDE_PACKS.map((p) => {
        const active = pack === p.id
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onPack(p.id)}
            aria-pressed={active}
            className={cx(
              'group flex flex-col items-stretch gap-1.5 rounded-xl border p-2 text-left transition duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
              active
                ? 'border-accent bg-accent-soft/40 ring-2 ring-accent/30 dark:bg-accent/10'
                : 'border-slate-200/80 hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:hover:border-slate-600',
            )}
          >
            <div className="relative">
              <PackPreview pack={p} />
              {active && (
                <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
                  <Check size={12} />
                </span>
              )}
            </div>
            <span
              className={cx(
                'px-0.5 text-xs font-semibold',
                active ? 'text-accent-strong dark:text-accent' : 'text-slate-700 dark:text-slate-200',
              )}
            >
              {p.name}
            </span>
            <span className="line-clamp-1 px-0.5 text-[10px] leading-tight text-slate-400 dark:text-slate-500">
              {p.hint}
            </span>
          </button>
        )
      })}
    </div>
  )
}
