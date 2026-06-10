// src/features/work/slides/SlideEditor.tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImagePlus, X } from 'lucide-react'
import { Field, Input, Textarea, Button } from '../../../ui'
import type { Slide, SlideContent } from './types'
import ImagePicker from './images/ImagePicker'

const linesToArr = (s: string): string[] => s.split('\n').map((x) => x.trim()).filter(Boolean)
const arrToLines = (a: string[]): string => a.join('\n')

export default function SlideEditor({ slide, onChange }: { slide: Slide; onChange: (s: Slide) => void }) {
  const { t } = useTranslation()
  const [picking, setPicking] = useState(false)
  const c = slide.content
  const setContent = (patch: Partial<SlideContent>) => onChange({ ...slide, content: { ...c, ...patch } as SlideContent })

  return (
    <div className="space-y-3">
      {renderFields()}

      <Field label={t('slides.fNotes', { defaultValue: '講者備註（選填）' })}>
        <Textarea rows={2} value={slide.speakerNotes ?? ''} onChange={(e) => onChange({ ...slide, speakerNotes: e.target.value })} />
      </Field>

      <div className="flex items-center gap-2">
        {slide.imageRef ? (
          <div className="flex items-center gap-2">
            <img src={slide.imageRef.src} alt="" className="h-12 w-12 rounded object-cover" />
            <Button variant="ghost" icon={X} onClick={() => { const s = { ...slide }; delete s.imageRef; onChange(s) }}>
              {t('slides.imgRemove', { defaultValue: '移除圖片' })}
            </Button>
          </div>
        ) : (
          <Button variant="secondary" icon={ImagePlus} onClick={() => setPicking(true)}>
            {t('slides.imgInsert', { defaultValue: '插入圖片' })}
          </Button>
        )}
      </div>

      <ImagePicker open={picking} onClose={() => setPicking(false)} onPick={(ref) => onChange({ ...slide, imageRef: ref })} />
    </div>
  )

  function renderFields() {
    switch (c.type) {
      case 'title':
        return (<>
          <Field label={t('slides.fHeading', { defaultValue: '標題' })}><Input value={c.heading} onChange={(e) => setContent({ heading: e.target.value })} /></Field>
          <Field label={t('slides.fSub', { defaultValue: '副標題' })}><Input value={c.subheading ?? ''} onChange={(e) => setContent({ subheading: e.target.value })} /></Field>
        </>)
      case 'section':
        return (<>
          <Field label={t('slides.fKicker', { defaultValue: '小標' })}><Input value={c.kicker ?? ''} onChange={(e) => setContent({ kicker: e.target.value })} /></Field>
          <Field label={t('slides.fHeading', { defaultValue: '標題' })}><Input value={c.heading} onChange={(e) => setContent({ heading: e.target.value })} /></Field>
        </>)
      case 'bullets':
        return (<>
          <Field label={t('slides.fHeading', { defaultValue: '標題' })}><Input value={c.heading} onChange={(e) => setContent({ heading: e.target.value })} /></Field>
          <Field label={t('slides.fItems', { defaultValue: '重點（每行一條）' })}><Textarea rows={5} value={arrToLines(c.items)} onChange={(e) => setContent({ items: linesToArr(e.target.value) })} /></Field>
        </>)
      case 'twoCol':
        return (<>
          <Field label={t('slides.fHeading', { defaultValue: '標題' })}><Input value={c.heading} onChange={(e) => setContent({ heading: e.target.value })} /></Field>
          <Field label={t('slides.fLeft', { defaultValue: '左欄（每行一條）' })}><Textarea rows={4} value={arrToLines(c.left)} onChange={(e) => setContent({ left: linesToArr(e.target.value) })} /></Field>
          <Field label={t('slides.fRight', { defaultValue: '右欄（每行一條）' })}><Textarea rows={4} value={arrToLines(c.right)} onChange={(e) => setContent({ right: linesToArr(e.target.value) })} /></Field>
        </>)
      case 'imageText':
        return (<>
          <Field label={t('slides.fHeading', { defaultValue: '標題' })}><Input value={c.heading} onChange={(e) => setContent({ heading: e.target.value })} /></Field>
          <Field label={t('slides.fBody', { defaultValue: '內文' })}><Textarea rows={4} value={c.body} onChange={(e) => setContent({ body: e.target.value })} /></Field>
        </>)
      case 'quote':
        return (<>
          <Field label={t('slides.fQuote', { defaultValue: '引言' })}><Textarea rows={3} value={c.text} onChange={(e) => setContent({ text: e.target.value })} /></Field>
          <Field label={t('slides.fAttrib', { defaultValue: '出處' })}><Input value={c.attribution ?? ''} onChange={(e) => setContent({ attribution: e.target.value })} /></Field>
        </>)
      case 'quiz':
        return (<>
          <Field label={t('slides.fQuestion', { defaultValue: '題目' })}><Input value={c.question} onChange={(e) => setContent({ question: e.target.value })} /></Field>
          <Field label={t('slides.fOptions', { defaultValue: '選項（每行一個）' })}><Textarea rows={4} value={arrToLines(c.options)} onChange={(e) => setContent({ options: linesToArr(e.target.value) })} /></Field>
        </>)
      case 'summary':
        return (<>
          <Field label={t('slides.fHeading', { defaultValue: '標題' })}><Input value={c.heading} onChange={(e) => setContent({ heading: e.target.value })} /></Field>
          <Field label={t('slides.fPoints', { defaultValue: '要點（每行一條）' })}><Textarea rows={5} value={arrToLines(c.points)} onChange={(e) => setContent({ points: linesToArr(e.target.value) })} /></Field>
        </>)
      case 'compare':
        return (<>
          <Field label={t('slides.fHeading', { defaultValue: '標題' })}><Input value={c.heading} onChange={(e) => setContent({ heading: e.target.value })} /></Field>
          <Field label={t('slides.fCompare', { defaultValue: '每行：標籤 | A | B' })}>
            <Textarea rows={5}
              value={c.rows.map((r) => `${r.label} | ${r.a} | ${r.b}`).join('\n')}
              onChange={(e) => setContent({ rows: e.target.value.split('\n').map((ln) => ln.split('|').map((x) => x.trim())).filter((p) => p[0]).map((p) => ({ label: p[0] ?? '', a: p[1] ?? '', b: p[2] ?? '' })) })} />
          </Field>
        </>)
      case 'timeline':
        return (<>
          <Field label={t('slides.fHeading', { defaultValue: '標題' })}><Input value={c.heading} onChange={(e) => setContent({ heading: e.target.value })} /></Field>
          <Field label={t('slides.fSteps', { defaultValue: '每行：步驟 | 說明（說明選填）' })}>
            <Textarea rows={5}
              value={c.steps.map((s) => (s.detail ? `${s.label} | ${s.detail}` : s.label)).join('\n')}
              onChange={(e) => setContent({ steps: e.target.value.split('\n').map((ln) => ln.split('|').map((x) => x.trim())).filter((p) => p[0]).map((p) => ({ label: p[0] ?? '', detail: p[1] || undefined })) })} />
          </Field>
        </>)
    }
  }
}
