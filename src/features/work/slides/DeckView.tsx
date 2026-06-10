import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, FileDown, Trash2 } from 'lucide-react'
import { Button, IconButton } from '../../../ui'
import { useConfirm } from '../../../context/ConfirmContext'
import { useToast } from '../../../context/ToastContext'
import type { SlideDeck } from './types'
import { getTheme } from './themes'
import { slideDecksCol } from './store'
import SlidePreview from './SlidePreview'
import PresentMode from './PresentMode'

export default function DeckView({ deck }: { deck: SlideDeck }) {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const toast = useToast()
  const [present, setPresent] = useState(false)
  const theme = getTheme(deck.themeId)

  const remove = async () => {
    if (await confirm({ title: t('slides.confirmDelete', { defaultValue: '刪除呢份簡報？' }), tone: 'danger' })) {
      slideDecksCol.remove(deck.id)
      toast.success(t('slides.deleted', { defaultValue: '已刪除簡報' }))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-semibold">{deck.title}</h3>
        <div className="flex gap-1">
          <Button size="sm" icon={Play} onClick={() => setPresent(true)}>{t('slides.present', { defaultValue: '放映' })}</Button>
          <Button size="sm" variant="secondary" icon={FileDown} onClick={() => exportDeckPdf(deck)}>{t('slides.exportPdf', { defaultValue: '匯出 PDF' })}</Button>
          <IconButton label={t('slides.delete', { defaultValue: '刪除' })} size="sm" onClick={() => void remove()}><Trash2 size={15} /></IconButton>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {deck.slides.map((s) => (
          <SlidePreview key={s.id} slide={s} theme={theme} className="rounded-md border border-[color:var(--border)]" />
        ))}
      </div>
      {present && <PresentMode deck={deck} onClose={() => setPresent(false)} />}
    </div>
  )
}

const safeColor = (c: string) => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#000000')

// 開新視窗、render slide 縮圖、用瀏覽器列印成 PDF（橫向、逐頁分頁）。
function exportDeckPdf(deck: SlideDeck) {
  const w = window.open('', '_blank')
  if (!w) return
  const theme = getTheme(deck.themeId)
  const p = theme.tokens.palette
  const slidesHtml = deck.slides
    .map((s) => `<section class="sl"><h2>${escapeHtml(slideHeading(s))}</h2></section>`)
    .join('')
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(deck.title)}</title>
    <style>
      @page { size: A4 landscape; margin: 0 }
      body { margin: 0; font-family: system-ui }
      .sl { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center;
            background: ${safeColor(p.bg)}; color: ${safeColor(p.text)}; page-break-after: always; }
      .sl h2 { color: ${safeColor(p.primary)}; font-size: 32px; padding: 0 8% }
    </style></head><body>${slidesHtml}</body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}

// 取每頁主標題（PDF 簡化版只印標題；完整視覺以 app 內放映為準）。
function slideHeading(s: SlideDeck['slides'][number]): string {
  const c = s.content
  if ('heading' in c) return c.heading
  if (c.type === 'quote') return c.text
  if (c.type === 'quiz') return c.question
  return ''
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string))
}
