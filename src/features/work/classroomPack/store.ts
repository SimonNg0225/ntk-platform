import { createCollection, type Entity } from '../../../lib/store'

export type ClassroomPackOutput = 'lesson' | 'worksheet' | 'slides'

export interface ClassroomPack extends Entity {
  topic: string
  subject: string
  className?: string
  durationMin: number
  curriculumBasis: string
  referenceText?: string
  curriculumAlignment: string[]
  sourceSummary: string
  reviewedOutputs: ClassroomPackOutput[]
  lessonPlanId: string
  paperId: string
  questionIds: string[]
  slideDeckId: string
  createdAt: string
  updatedAt: string
}

export const classroomPacksCol = createCollection<ClassroomPack>('classroom_packs', [])

export function packReviewStatus(
  pack: Pick<ClassroomPack, 'reviewedOutputs'>,
): 'draft' | 'partial' | 'reviewed' {
  const count = new Set(pack.reviewedOutputs).size
  if (count >= 3) return 'reviewed'
  return count > 0 ? 'partial' : 'draft'
}
