// src/features/work/slides/DeckEditor.tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, ChevronUp, ChevronDown, Check } from 'lucide-react'
import { Button, Select, IconButton, SegmentedControl } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import type { SlideDeck, Slide, SlideType } from './types'
import { SLIDE_TYPES } from './types'
import { allThemes, getTheme } from './themes'
import { reorderSlides, changeSlideType, newSlide } from './editorOps'
import { slideDecksCol } from './store'
import SlideEditor from './SlideEditor'
import SlidePreview from './SlidePreview'

const TYPE_LABEL: Record<SlideType, string> = {
  title: '標題頁', section: '章節', bullets: '重點', twoCol: '雙欄', imageText: '圖文',
  quote: '引言', compare: '對比', timeline: '時序', quiz: '測驗', summary: '總結',
}

export default function DeckEditor({ deck, onClose }: { deck: SlideDeck; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [slides, setSlides] = useState<Slide[]>(deck.slides)
  const [themeId, setThemeId] = useState(deck.themeId)
  const [sel, setSel] = useState(0)
  const theme = getTheme(themeId)

  const update = (i: number, s: Slide) => setSlides((arr) => arr.map((x, k) => (k === i ? s : x)))
  const add = (type: SlideType) => { setSlides((arr) => [...arr, newSlide(type)]); setSel(slides.length) }
  const del = (i: number) => { setSlides((arr) => arr.filter((_, k) => k !== i)); setSel((s) => Math.max(0, Math.min(s, slides.length - 2))) }
  const move = (i: number, dir: -1 | 1) => { setSlides((arr) => reorderSlides(arr, i, dir)); setSel((s) => Math.max(0, Math.min(s + dir, slides.length - 1))) }
  const retype = (i: number, type: SlideType) => update(i, changeSlideType(slides[i], type))

  const save = () => {
    slideDecksCol.update(deck.id, { slides, themeId, updatedAt: new Date().toISOString() })
    toast.success(t('slides.editSaved', { defaultValue: '已儲存簡報' }))
    onClose()
  }

  const cur = slides[sel]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t('slides.editTitle', { defaultValue: '編輯簡報' })} · {deck.title}</h3>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>{t('slides.editCancel', { defaultValue: '取消' })}</Button>
          <Button icon={Check} onClick={save}>{t('slides.editSave', { defaultValue: '儲存' })}</Button>
        </div>
      </div>

      <div>
        <SegmentedControl<string> size="sm" value={themeId} onChange={setThemeId}
          options={allThemes.map((th) => ({ id: th.id, label: t(th.nameKey, { defaultValue: th.nameDefault }) }))} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* slide 列 */}
        <div className="space-y-2">
          {slides.map((s, i) => (
            <div key={s.id} className={`flex items-center gap-1 rounded-lg border p-2 ${i === sel ? 'border-accent' : 'border-[color:var(--border)]'}`}>
              <button className="flex-1 truncate text-left text-xs" onClick={() => setSel(i)}>
                {i + 1}. {t(`slides.type_${s.content.type}`, { defaultValue: TYPE_LABEL[s.content.type] })}
              </button>
              <IconButton label={t('slides.moveUp', { defaultValue: '上移' })} size="sm" onClick={() => move(i, -1)}><ChevronUp size={14} /></IconButton>
              <IconButton label={t('slides.moveDown', { defaultValue: '下移' })} size="sm" onClick={() => move(i, 1)}><ChevronDown size={14} /></IconButton>
              <IconButton label={t('slides.delSlide', { defaultValue: '刪除' })} size="sm" onClick={() => del(i)}><Trash2 size={14} /></IconButton>
            </div>
          ))}
          <Select value="" onChange={(e) => { if (e.target.value) add(e.target.value as SlideType) }}>
            <option value="">{t('slides.addSlide', { defaultValue: '＋ 加一頁…' })}</option>
            {SLIDE_TYPES.map((ty) => <option key={ty} value={ty}>{t(`slides.type_${ty}`, { defaultValue: TYPE_LABEL[ty] })}</option>)}
          </Select>
        </div>

        {/* 編輯 + 預覽 */}
        {cur && (
          <div className="space-y-3">
            <SlidePreview slide={cur} theme={theme} className="rounded-md border border-[color:var(--border)]" />
            <Select value={cur.content.type} onChange={(e) => retype(sel, e.target.value as SlideType)}>
              {SLIDE_TYPES.map((ty) => <option key={ty} value={ty}>{t(`slides.type_${ty}`, { defaultValue: TYPE_LABEL[ty] })}</option>)}
            </Select>
            <SlideEditor slide={cur} onChange={(s) => update(sel, s)} />
          </div>
        )}
      </div>
    </div>
  )
}
