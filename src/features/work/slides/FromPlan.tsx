import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Presentation } from 'lucide-react'
import { Button, Field, Select, SegmentedControl, EmptyState } from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useCollection, uid } from '../../../lib/store'
import { lessonPlansCol } from '../../../data/collections'
import { planMetaCol } from '../lessonPlanner/util'
import { lessonPlanToSlides } from './fromLessonPlan'
import { allThemes } from './themes'
import { slideDecksCol } from './store'

export default function FromPlan({ onCreated }: { onCreated: (id: string) => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const plans = useCollection(lessonPlansCol)
  const [planId, setPlanId] = useState('')
  const [themeId, setThemeId] = useState(allThemes[0].id)

  if (plans.length === 0) {
    return <EmptyState title={t('slides.planNone', { defaultValue: '仲未有教案' })} hint={t('slides.planNoneHint', { defaultValue: '去「備課 / 教案」整一份，再返嚟轉做簡報。' })} />
  }

  const convert = () => {
    const plan = plans.find((p) => p.id === planId) ?? plans[0]
    const meta = planMetaCol.get().find((m) => m.id === plan.id)
    const slides = lessonPlanToSlides(plan, meta)
    const now = new Date().toISOString()
    const id = uid()
    slideDecksCol.add({ id, title: plan.title, themeId, slides, createdAt: now, updatedAt: now })
    toast.success(t('slides.planConverted', { defaultValue: '已由教案生成簡報' }))
    onCreated(id)
  }

  return (
    <div className="space-y-3">
      <Field label={t('slides.planPick', { defaultValue: '揀一份教案' })}>
        <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="">{t('slides.planPickPh', { defaultValue: '— 揀教案 —' })}</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </Select>
      </Field>
      <Field label={t('slides.themeLabel', { defaultValue: '樣板' })}>
        <SegmentedControl<string> value={themeId} onChange={setThemeId}
          options={allThemes.map((th) => ({ id: th.id, label: t(th.nameKey, { defaultValue: th.nameDefault }) }))} />
      </Field>
      <div className="flex justify-end">
        <Button icon={Presentation} disabled={!planId} onClick={convert}>
          {t('slides.planConvert', { defaultValue: '轉做簡報' })}
        </Button>
      </div>
    </div>
  )
}
