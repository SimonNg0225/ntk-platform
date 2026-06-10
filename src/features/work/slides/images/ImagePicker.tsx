// src/features/work/slides/images/ImagePicker.tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Button, Input, cx } from '../../../../ui'
import { useToast } from '../../../../context/ToastContext'
import type { ImageRef } from '../types'
import { BUILTIN_ILLUSTRATIONS } from './builtin'
import { fileToImageRef } from './downscale'
import { searchImages, isImageSearchConfigured } from './provider'

interface Props {
  open: boolean
  onClose: () => void
  onPick: (ref: ImageRef) => void
}

export default function ImagePicker({ open, onClose, onPick }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const [tab, setTab] = useState<'builtin' | 'upload' | 'stock'>('builtin')
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ImageRef[]>([])
  const [busy, setBusy] = useState(false)

  const pick = (ref: ImageRef) => { onPick(ref); onClose() }

  const doSearch = async () => {
    setBusy(true)
    try { setResults(await searchImages(q)) } finally { setBusy(false) }
  }

  const onFile = async (file?: File) => {
    if (!file) return
    try { pick(await fileToImageRef(file)) }
    catch (e) { toast.error(e instanceof Error ? e.message : t('slides.imgUploadFailed', { defaultValue: '圖片上載失敗' })) }
  }

  const tabs = [
    { id: 'builtin' as const, label: t('slides.imgTabBuiltin', { defaultValue: '內建插圖' }) },
    { id: 'upload' as const, label: t('slides.imgTabUpload', { defaultValue: '上載' }) },
    { id: 'stock' as const, label: t('slides.imgTabStock', { defaultValue: '圖庫' }) },
  ]

  return (
    <Modal open={open} onClose={onClose} title={t('slides.imgPickTitle', { defaultValue: '插入圖片' })} size="lg">
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm dark:bg-slate-800">
        {tabs.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={cx('flex-1 rounded-md px-3 py-1.5 font-medium transition',
              tab === tb.id ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100' : 'text-slate-500')}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'builtin' && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {BUILTIN_ILLUSTRATIONS.map((x) => (
            <button key={x.id} onClick={() => pick({ kind: 'builtin', src: x.src, alt: x.label })}
              className="flex flex-col items-center gap-1 rounded-lg border border-[color:var(--border)] p-3 text-slate-600 hover:border-accent hover:text-accent dark:text-slate-300">
              <img src={x.src} alt={x.label} className="h-12 w-12" />
              <span className="text-xs">{x.label}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'upload' && (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[color:var(--border)] py-10 text-sm text-slate-500 hover:border-accent">
          <span>{t('slides.imgUploadHint', { defaultValue: '揀一張相片上載（會自動縮細）' })}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
      )}

      {tab === 'stock' && (
        !isImageSearchConfigured() ? (
          <p className="py-10 text-center text-sm text-slate-400">{t('slides.imgDisabled', { defaultValue: '圖庫搜尋未設定' })}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('slides.imgSearchPh', { defaultValue: '關鍵字…' })} />
              <Button onClick={() => void doSearch()} disabled={busy}>{t('slides.imgSearch', { defaultValue: '搜尋圖片' })}</Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {results.map((r, i) => (
                <button key={i} onClick={() => pick(r)} aria-label={r.alt || t('slides.imgPickTitle', { defaultValue: '插入圖片' })} className="overflow-hidden rounded-lg border border-[color:var(--border)] hover:border-accent">
                  <img src={r.src} alt={r.alt ?? ''} className="h-24 w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )
      )}
    </Modal>
  )
}
