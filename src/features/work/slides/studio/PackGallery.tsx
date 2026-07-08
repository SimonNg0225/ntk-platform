import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { SLIDE_PACKS, type SlidePackId } from '../../../../lib/export'
import { cx } from '../../../../ui'
import PackPreview from '../PackPreview'

// ============================================================
//  視覺模板廊 —— 34 套 pack 用 PackPreview SVG 縮圖排成可選擇 gallery。
//  選擇邊套，右邊即時預覽就用嗰套設計 token 換色（Canva feel）。
// ============================================================

type PackGroupId = 'recommended' | 'formal' | 'dark' | 'primary' | 'data' | 'story' | 'all'

const PACK_GROUPS: {
  id: PackGroupId
  label: string
  desc: string
  packs?: SlidePackId[]
}[] = [
  {
    id: 'recommended',
    label: '推薦',
    desc: '日常課堂',
    packs: ['inkwell', 'seminar', 'nocturne', 'grid', 'dawn', 'celadon'],
  },
  {
    id: 'formal',
    label: '正式課堂',
    desc: '校內匯報',
    packs: ['inkwell', 'seminar', 'ivy', 'press', 'washi', 'manuscript'],
  },
  {
    id: 'dark',
    label: '深色專業',
    desc: '投影清楚',
    packs: ['nocturne', 'seminar', 'neon', 'terminal', 'glitch', 'cosmos'],
  },
  {
    id: 'primary',
    label: '初小活潑',
    desc: '大字輕快',
    packs: ['dawn', 'confetti', 'pastel', 'comic', 'pixel', 'scrapbook'],
  },
  {
    id: 'data',
    label: 'DSE / 數據',
    desc: '分析對比',
    packs: ['grid', 'blueprint', 'isometric', 'origami', 'redgrid', 'transit'],
  },
  {
    id: 'story',
    label: '圖片故事',
    desc: '人文場景',
    packs: ['cinema', 'marble', 'botanic', 'ocean', 'sumi', 'festival'],
  },
  { id: 'all', label: '全部', desc: `${SLIDE_PACKS.length} 套` },
]

export default function PackGallery({
  pack,
  onPack,
}: {
  pack: SlidePackId
  onPack: (p: SlidePackId) => void
}): JSX.Element {
  const [group, setGroup] = useState<PackGroupId>('recommended')
  const visiblePacks = useMemo(() => {
    const selected = PACK_GROUPS.find((g) => g.id === group)
    if (!selected?.packs) return SLIDE_PACKS
    const wanted = new Set(selected.packs)
    return SLIDE_PACKS.filter((p) => wanted.has(p.id))
  }, [group])

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PACK_GROUPS.map((g) => {
          const active = group === g.id
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroup(g.id)}
              aria-pressed={active}
              className={cx(
                'min-h-11 shrink-0 rounded-xl border px-3 py-2 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                active
                  ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                  : 'border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600',
              )}
            >
              <span className="block text-xs font-semibold">{g.label}</span>
              <span className="block text-[10px] leading-tight opacity-70">{g.desc}</span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {visiblePacks.map((p) => {
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
    </div>
  )
}
