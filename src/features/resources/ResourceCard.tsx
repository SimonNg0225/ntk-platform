// ============================================================
//  資源卡片 — 顯示縮略圖 / 類型佔位、標題、類型標籤、下載數、星級
// ============================================================

import { Download, Star, FileText } from 'lucide-react'
import { Card, Badge, cx } from '../../ui'
import { avg } from './logic'
import type { SharedResource } from './types'

const TYPE_LABEL: Record<string, string> = {
  handout: '講義',
  slides: '簡報',
  paper: '試題',
  link: '連結',
  video: '影片',
  note: '筆記',
}

const TYPE_BG: Record<string, string> = {
  handout: 'bg-blue-100 dark:bg-blue-900/40',
  slides: 'bg-purple-100 dark:bg-purple-900/40',
  paper: 'bg-amber-100 dark:bg-amber-900/40',
  link: 'bg-emerald-100 dark:bg-emerald-900/40',
  video: 'bg-rose-100 dark:bg-rose-900/40',
  note: 'bg-slate-100 dark:bg-slate-800',
}

const TYPE_TEXT: Record<string, string> = {
  handout: 'text-blue-600 dark:text-blue-300',
  slides: 'text-purple-600 dark:text-purple-300',
  paper: 'text-amber-600 dark:text-amber-300',
  link: 'text-emerald-600 dark:text-emerald-300',
  video: 'text-rose-600 dark:text-rose-300',
  note: 'text-slate-500 dark:text-slate-400',
}

function StarRating({ value }: { value: number }) {
  const full = Math.round(value)
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={11}
          className={i <= full ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200 dark:fill-slate-700 dark:text-slate-700'}
        />
      ))}
    </span>
  )
}

export default function ResourceCard({ resource, onClick }: {
  resource: SharedResource
  onClick: () => void
}) {
  const rating = avg(resource.rating_sum, resource.rating_count)
  const label = TYPE_LABEL[resource.type] ?? resource.type
  const bg = TYPE_BG[resource.type] ?? 'bg-slate-100'
  const text = TYPE_TEXT[resource.type] ?? 'text-slate-500'

  return (
    <Card hover clip onClick={onClick} className="flex flex-col">
      {/* Thumbnail area */}
      <div className={cx('relative flex h-36 w-full items-center justify-center overflow-hidden', resource.thumbUrl ? '' : bg)}>
        {resource.thumbUrl ? (
          <img
            src={resource.thumbUrl}
            alt={resource.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center gap-1">
            <FileText size={32} className={cx('opacity-60', text)} />
            <span className={cx('text-xs font-medium', text)}>{label}</span>
          </div>
        )}
        {/* Type badge overlay */}
        <span className="absolute left-2 top-2">
          <Badge tone={
            resource.type === 'handout' ? 'blue'
            : resource.type === 'slides' ? 'accent'
            : resource.type === 'paper' ? 'amber'
            : resource.type === 'link' ? 'green'
            : resource.type === 'video' ? 'rose'
            : 'slate'
          }>{label}</Badge>
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">
          {resource.title}
        </h3>
        <p className="mt-auto text-xs text-slate-400">{resource.authorName ?? '老師'}</p>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="inline-flex items-center gap-1">
            <Download size={11} />
            {resource.download_count}
          </span>
          {resource.rating_count > 0 && <StarRating value={rating} />}
        </div>
      </div>
    </Card>
  )
}
