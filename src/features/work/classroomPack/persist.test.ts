import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { lessonPlansCol, papersCol, questionsCol, topicsCol } from '../../../data/collections'
import { planMetaCol } from '../lessonPlanner/util'
import { slideDecksCol } from '../slides/slideStore'
import type { ClassroomPackGeneration, ClassroomPackInput } from './engine'
import {
  persistClassroomPack,
  setClassroomPackOutputReviewed,
  setEntireClassroomPackReviewed,
} from './persist'
import { classroomPacksCol, packReviewStatus } from './store'

const collections = [
  topicsCol,
  lessonPlansCol,
  planMetaCol,
  questionsCol,
  papersCol,
  slideDecksCol,
  classroomPacksCol,
] as const

let snapshots: unknown[][]

beforeEach(() => {
  snapshots = collections.map((collection) => [...collection.get()])
})

afterEach(() => {
  collections.forEach((collection, index) => collection.set(snapshots[index] as never[]))
})

describe('課堂套裝持久化', () => {
  it('把三份成果連結起來並同步老師覆核狀態', () => {
    const input: ClassroomPackInput = {
      topic: '百分比應用',
      subjectName: '數學',
      className: '中二',
      durationMin: 45,
      curriculumBasis: '香港課程發展議會課程指引',
      referenceText: '校本進度表：學生運用百分比處理生活情境。',
    }
    const generation: ClassroomPackGeneration = {
      lesson: {
        objectives: '能運用百分比解決生活問題',
        phases: [{ label: '講解', minutes: 45, detail: '示範及練習' }],
        materials: ['工作紙'],
        activities: '分組比較折扣方案',
      },
      questions: Array.from({ length: 6 }, (_, index) => ({
        type: 'short' as const,
        stem: `題目 ${index + 1}`,
        answer: `答案 ${index + 1}`,
        marks: 2,
      })),
      deck: {
        title: '百分比應用',
        slides: Array.from({ length: 5 }, (_, index) => ({
          title: `第 ${index + 1} 頁`,
          bullets: ['重點'],
        })),
      },
      curriculumAlignment: ['運用百分比處理生活情境'],
      sourceSummary: '根據老師提供的校本進度表摘要。',
    }

    const pack = persistClassroomPack(input, generation)
    const lesson = lessonPlansCol.get().find((item) => item.id === pack.lessonPlanId)
    const paper = papersCol.get().find((item) => item.id === pack.paperId)
    const deck = slideDecksCol.get().find((item) => item.id === pack.slideDeckId)

    expect(pack.questionIds).toHaveLength(6)
    expect(lesson?.packId).toBe(pack.id)
    expect(paper?.questionIds).toEqual(pack.questionIds)
    expect(deck?.slides).toHaveLength(5)
    expect(packReviewStatus(pack)).toBe('draft')

    const reviewed = setClassroomPackOutputReviewed(pack, 'worksheet', true)
    expect(reviewed).toContain('worksheet')
    expect(papersCol.get().find((item) => item.id === pack.paperId)?.reviewStatus).toBe(
      'reviewed',
    )

    const latestPack = classroomPacksCol.get().find((item) => item.id === pack.id)!
    setEntireClassroomPackReviewed(latestPack)
    expect(packReviewStatus(classroomPacksCol.get().find((item) => item.id === pack.id)!)).toBe(
      'reviewed',
    )
    expect(lessonPlansCol.get().find((item) => item.id === pack.lessonPlanId)?.reviewStatus).toBe(
      'reviewed',
    )
  })
})
