import { describe, it, expect } from 'vitest'
import { lessonPlanToSlides } from './fromLessonPlan'
import type { LessonPlan } from '../../../data/types'
import type { PlanMeta } from '../lessonPlanner/util'
import type { BulletsContent } from './types'

const plan: LessonPlan = {
  id: 'p1', title: '通脹與物價', date: '2026-03-15',
  objectives: '理解通脹定義\n認識三大成因\n計算 CPI', activities: '小組討論\n個案分析',
  resourcesNote: 'CPI 數據表', createdAt: 'x',
}
const meta: PlanMeta = {
  id: 'p1', status: 'ready',
  phases: [
    { id: 'a', label: '引入', minutes: 5, detail: '新聞引入' },
    { id: 'b', label: '講解', minutes: 20, detail: '三大成因' },
  ],
  materials: [{ id: 'm1', text: '工作紙', done: false }, { id: 'm2', text: 'PPT', done: true }],
  updatedAt: 'x',
}

describe('slides/fromLessonPlan', () => {
  it('首頁 title（含日期），尾頁 summary', () => {
    const s = lessonPlanToSlides(plan, meta)
    expect(s[0].content).toMatchObject({ type: 'title', heading: '通脹與物價', subheading: '2026-03-15' })
    expect(s[s.length - 1].content.type).toBe('summary')
  })

  it('objectives → bullets（逐行）', () => {
    const s = lessonPlanToSlides(plan, meta)
    const obj = s.find((x) => x.content.type === 'bullets' && x.content.heading === '教學目標')
    expect(obj?.content).toMatchObject({ items: ['理解通脹定義', '認識三大成因', '計算 CPI'] })
  })

  it('phases → timeline（label 含分鐘，detail 保留）', () => {
    const s = lessonPlanToSlides(plan, meta)
    const tl = s.find((x) => x.content.type === 'timeline')
    expect(tl?.content).toMatchObject({ heading: '課堂流程', steps: [
      { label: '引入（5 分）', detail: '新聞引入' },
      { label: '講解（20 分）', detail: '三大成因' },
    ] })
  })

  it('activities → bullets；materials(+resourcesNote) → bullets', () => {
    const s = lessonPlanToSlides(plan, meta)
    expect(s.some((x) => x.content.type === 'bullets' && x.content.heading === '課堂活動' && x.content.items.includes('小組討論'))).toBe(true)
    const mat = s.find((x) => x.content.type === 'bullets' && x.content.heading === '教材準備')
    expect((mat?.content as BulletsContent | undefined)?.items).toEqual(['工作紙', 'PPT', 'CPI 數據表'])
  })

  it('每張 slide 有唯一 id', () => {
    const s = lessonPlanToSlides(plan, meta)
    const ids = s.map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('最簡教案（只有 title）→ 至少 title + summary，唔會崩', () => {
    const s = lessonPlanToSlides({ id: 'p2', title: '只有題目', createdAt: 'x' })
    expect(s[0].content.type).toBe('title')
    expect(s[s.length - 1].content.type).toBe('summary')
    expect(s.length).toBeGreaterThanOrEqual(2)
  })
})
