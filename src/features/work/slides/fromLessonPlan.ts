import { uid } from '../../../lib/store'
import type { LessonPlan } from '../../../data/types'
import type { PlanMeta } from '../lessonPlanner/util'
import type { Slide, SlideContent } from './types'

// 自由文字 → 逐行清單（去 bullet 符號 / 空白行）
function splitLines(text?: string): string[] {
  if (!text) return []
  return text
    .split('\n')
    .map((l) => l.replace(/^\s*[•\-*–·]\s*/, '').trim())
    .filter(Boolean)
}

const mk = (content: SlideContent): Slide => ({ id: uid(), content })

// 教案（LessonPlan + 可選 PlanMeta）→ Phase 1 Slide[]
export function lessonPlanToSlides(plan: LessonPlan, meta?: PlanMeta): Slide[] {
  const slides: Slide[] = []

  // 封面
  slides.push(mk({ type: 'title', heading: plan.title || '教學簡報', subheading: plan.date }))

  // 教學目標
  const objectives = splitLines(plan.objectives)
  if (objectives.length) slides.push(mk({ type: 'bullets', heading: '教學目標', items: objectives }))

  // 課堂流程（環節）
  const phases = meta?.phases ?? []
  if (phases.length) {
    slides.push(mk({
      type: 'timeline', heading: '課堂流程',
      steps: phases.map((p) => ({ label: `${p.label}（${p.minutes} 分）`, detail: p.detail?.trim() || undefined })),
    }))
  }

  // 課堂活動
  const activities = splitLines(plan.activities)
  if (activities.length) slides.push(mk({ type: 'bullets', heading: '課堂活動', items: activities }))

  // 教材準備（materials + resourcesNote）
  const materials = [
    ...(meta?.materials ?? []).map((m) => m.text.trim()).filter(Boolean),
    ...splitLines(plan.resourcesNote),
  ]
  if (materials.length) slides.push(mk({ type: 'bullets', heading: '教材準備', items: materials }))

  // 總結（用目標做重點；無目標就用標題兜底）
  slides.push(mk({ type: 'summary', heading: '總結', points: objectives.length ? objectives : [plan.title || '重點回顧'] }))

  return slides
}
