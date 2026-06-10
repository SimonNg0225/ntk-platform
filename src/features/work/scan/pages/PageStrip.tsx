import { useTranslation } from 'react-i18next'
import { Plus, Trash2, ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { IconButton, cx } from '../../../../ui'
import type { ScanPage } from '../lib/types'

export default function PageStrip({
  pages, onAdd, onEdit, onDelete, onMove,
}: {
  pages: ScanPage[]
  onAdd: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {pages.map((p, i) => (
        <div key={p.id} className="group relative shrink-0">
          <img src={p.processedDataUrl || p.rawDataUrl} alt=""
            className="h-40 w-28 rounded-lg border border-border object-cover" />
          <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-2xs font-semibold text-white">{i + 1}</span>
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-0.5 rounded-b-lg bg-black/45 p-0.5 opacity-0 transition group-hover:opacity-100">
            <IconButton label={t('scan.moveLeft', { defaultValue: '前移' })} onClick={() => onMove(p.id, -1)} className={cx('text-white', i === 0 && 'invisible')}><ChevronLeft size={14} /></IconButton>
            <IconButton label={t('scan.edit', { defaultValue: '編輯' })} onClick={() => onEdit(p.id)} className="text-white"><Pencil size={14} /></IconButton>
            <IconButton label={t('scan.delete', { defaultValue: '刪除' })} onClick={() => onDelete(p.id)} className="text-white"><Trash2 size={14} /></IconButton>
            <IconButton label={t('scan.moveRight', { defaultValue: '後移' })} onClick={() => onMove(p.id, 1)} className={cx('text-white', i === pages.length - 1 && 'invisible')}><ChevronRight size={14} /></IconButton>
          </div>
        </div>
      ))}
      <button type="button" onClick={onAdd}
        className="flex h-40 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-fg-muted hover:border-accent hover:text-accent">
        <Plus size={20} />
        <span className="text-xs">{t('scan.addPage', { defaultValue: '加一頁' })}</span>
      </button>
    </div>
  )
}
