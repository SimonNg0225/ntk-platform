import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Square } from 'lucide-react'
import { Button, Input, Textarea, Field, Select, SegmentedControl } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useSettings } from '../../../context/SettingsContext'
import { getSubjectPack } from '../../../data/subjects'
import { streamChat } from '../../../lib/aiClient'
import { uid } from '../../../lib/store'
import { buildSlidesSystem, buildSlidesPrompt } from './prompts'
import { parseSlides } from './parse'
import { allThemes } from './themes'
import { slideDecksCol } from './store'

export default function Generator({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const { subjectPackId } = useSettings()
  const subjectName = subjectPackId !== 'custom' ? getSubjectPack(subjectPackId)?.name : undefined

  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(8)
  const [extra, setExtra] = useState('')
  const [themeId, setThemeId] = useState(allThemes[0].id)
  const [busy, setBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const stop = () => { abortRef.current?.abort(); setBusy(false) }

  async function generate() {
    if (!topic.trim()) { toast.error(t('slides.needTopic', { defaultValue: '請輸入課題' })); return }
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    let acc = ''
    try {
      for await (const chunk of streamChat({
        system: buildSlidesSystem(subjectName),
        messages: [{ role: 'user', content: buildSlidesPrompt({ topic, slideCount: count, extra }) }],
        model: 'gemini-2.5-flash',
        signal: controller.signal,
      })) acc += chunk
      const slides = parseSlides(acc)
      if (slides.length === 0) { toast.error(t('slides.genFailed', { defaultValue: 'AI 生成失敗，請再試' })); return }
      const now = new Date().toISOString()
      const id = uid()
      slideDecksCol.add({ id, title: topic.trim(), subjectPackId, themeId, slides, createdAt: now, updatedAt: now })
      toast.success(t('slides.saved', { defaultValue: '已儲存簡報' }))
      onCreated(id)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.error((e as Error).message || t('slides.genFailed', { defaultValue: 'AI 生成失敗，請再試' }))
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      <Field label={t('slides.topicLabel', { defaultValue: '課題' })}>
        <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t('slides.topicPh', { defaultValue: '例如：通脹嘅三個成因' })} />
      </Field>
      <Field label={t('slides.countLabel', { defaultValue: '頁數' })}>
        <Select value={String(count)} onChange={(e) => setCount(Number(e.target.value))}>
          {[6, 8, 10, 12, 15].map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
      </Field>
      <Field label={t('slides.extraLabel', { defaultValue: '額外要求（選填）' })}>
        <Textarea rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={t('slides.extraPh', { defaultValue: '例如：加香港中小企例子' })} />
      </Field>
      <Field label={t('slides.themeLabel', { defaultValue: '樣板' })}>
        <SegmentedControl<string>
          value={themeId}
          onChange={setThemeId}
          options={allThemes.map((th) => ({ id: th.id, label: t(th.nameKey, { defaultValue: th.nameDefault }) }))}
        />
      </Field>
      <div className="flex justify-end">
        {busy
          ? <Button variant="secondary" icon={Square} onClick={stop}>{t('slides.btnStop', { defaultValue: '停止' })}</Button>
          : <Button icon={Sparkles} onClick={() => void generate()}>{t('slides.btnGenerate', { defaultValue: '生成簡報' })}</Button>}
      </div>
      {busy && <p className="text-center text-sm text-slate-400">{t('slides.generating', { defaultValue: 'AI 砌緊你份簡報…' })}</p>}
    </div>
  )
}
