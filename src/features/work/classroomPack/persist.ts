import { lessonPlansCol, papersCol, questionsCol, topicsCol } from '../../../data/collections'
import type { TeacherReviewStatus } from '../../../data/types'
import { uid } from '../../../lib/store'
import { planMetaCol, type PlanMeta } from '../lessonPlanner/util'
import { slideDecksCol } from '../slides/slideStore'
import type { ClassroomPackGeneration, ClassroomPackInput } from './engine'
import { classroomPacksCol, type ClassroomPack, type ClassroomPackOutput } from './store'

function sourceNote(input: ClassroomPackInput): string {
  return input.referenceText?.trim()
    ? input.referenceText.trim().slice(0, 1000)
    : '未提供外部來源；課程對應屬 AI 概括建議，待老師確認。'
}

function findOrCreateTopic(input: ClassroomPackInput): string {
  const key = input.topic.trim().toLocaleLowerCase('zh-Hant')
  const existing = topicsCol
    .get()
    .find((topic) => topic.topic.trim().toLocaleLowerCase('zh-Hant') === key)
  if (existing) return existing.id
  const topics = topicsCol.get()
  return topicsCol.add({
    part: '課堂套裝',
    area: input.subjectName?.trim() || '教學',
    topic: input.topic.trim(),
    order: topics.reduce((max, topic) => Math.max(max, topic.order), 0) + 1,
  }).id
}

export function persistClassroomPack(
  input: ClassroomPackInput,
  generation: ClassroomPackGeneration,
): ClassroomPack {
  const now = new Date().toISOString()
  const packId = uid()
  const topicId = findOrCreateTopic(input)
  const trust = {
    packId,
    curriculumBasis: input.curriculumBasis,
    sourceNote: sourceNote(input),
    reviewStatus: 'draft' as TeacherReviewStatus,
  }

  const lesson = lessonPlansCol.add({
    title: `${input.topic.trim()}｜課堂教案`,
    classId: input.className?.trim() || undefined,
    topicId,
    objectives: generation.lesson.objectives,
    activities: generation.lesson.phases
      .map((phase) => `${phase.label}（${phase.minutes} 分）：${phase.detail}`)
      .join('\n'),
    resourcesNote: [
      generation.lesson.activities,
      generation.lesson.materials.length
        ? `教材：${generation.lesson.materials.join('、')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
    createdAt: now,
    ...trust,
  })

  planMetaCol.add({
    id: lesson.id,
    status: 'draft',
    durationMin: input.durationMin,
    phases: generation.lesson.phases.map((phase) => ({
      id: uid(),
      label: phase.label,
      minutes: phase.minutes,
      detail: phase.detail,
    })),
    materials: generation.lesson.materials.map((text) => ({
      id: uid(),
      text,
      done: false,
    })),
    updatedAt: now,
  } satisfies PlanMeta)

  const questions = generation.questions.map((question) =>
    questionsCol.add({
      ...question,
      topicId,
      difficulty: 'medium',
      source: `課堂套裝 · ${input.curriculumBasis}`,
      tags: ['課堂套裝', input.topic.trim()],
      createdAt: now,
      ...trust,
    }),
  )

  const paper = papersCol.add({
    title: `${input.topic.trim()}｜課堂工作紙`,
    className: input.className?.trim() || '',
    durationMin: '',
    questionIds: questions.map((question) => question.id),
    createdAt: now,
    ...trust,
  })

  const deck = slideDecksCol.add({
    createdAt: now,
    topicName: input.topic.trim(),
    model: 'gemini-2.5-flash',
    title: generation.deck.title,
    subtitle: generation.deck.subtitle,
    slides: generation.deck.slides,
    coverImageQuery: generation.deck.coverImageQuery,
    ...trust,
  })

  return classroomPacksCol.add({
    id: packId,
    topic: input.topic.trim(),
    subject: input.subjectName?.trim() || '未指定科目',
    className: input.className?.trim() || undefined,
    durationMin: input.durationMin,
    curriculumBasis: input.curriculumBasis,
    referenceText: input.referenceText?.trim() || undefined,
    curriculumAlignment: generation.curriculumAlignment,
    sourceSummary: generation.sourceSummary,
    reviewedOutputs: [],
    lessonPlanId: lesson.id,
    paperId: paper.id,
    questionIds: questions.map((question) => question.id),
    slideDeckId: deck.id,
    createdAt: now,
    updatedAt: now,
  })
}

export function setClassroomPackOutputReviewed(
  pack: ClassroomPack,
  output: ClassroomPackOutput,
  reviewed: boolean,
): ClassroomPackOutput[] {
  const next = new Set(pack.reviewedOutputs)
  if (reviewed) next.add(output)
  else next.delete(output)
  const reviewedOutputs = [...next]
  const reviewStatus: TeacherReviewStatus = reviewed ? 'reviewed' : 'draft'

  if (output === 'lesson') lessonPlansCol.update(pack.lessonPlanId, { reviewStatus })
  if (output === 'worksheet') {
    papersCol.update(pack.paperId, { reviewStatus })
    pack.questionIds.forEach((id) => questionsCol.update(id, { reviewStatus }))
  }
  if (output === 'slides') slideDecksCol.update(pack.slideDeckId, { reviewStatus })

  classroomPacksCol.update(pack.id, {
    reviewedOutputs,
    updatedAt: new Date().toISOString(),
  })
  return reviewedOutputs
}

export function setEntireClassroomPackReviewed(pack: ClassroomPack): void {
  lessonPlansCol.update(pack.lessonPlanId, { reviewStatus: 'reviewed' })
  papersCol.update(pack.paperId, { reviewStatus: 'reviewed' })
  pack.questionIds.forEach((id) => questionsCol.update(id, { reviewStatus: 'reviewed' }))
  slideDecksCol.update(pack.slideDeckId, { reviewStatus: 'reviewed' })
  classroomPacksCol.update(pack.id, {
    reviewedOutputs: ['lesson', 'worksheet', 'slides'],
    updatedAt: new Date().toISOString(),
  })
}
