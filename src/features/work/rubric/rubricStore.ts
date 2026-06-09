import { createCollection, type Entity } from '../../../lib/store'
import type { MarkingScheme, Rubric, RubricMode } from './rubricPrompts'

export interface RubricRecord extends Entity {
  createdAt: string
  mode: RubricMode
  question: string
  model: string
  scheme?: MarkingScheme
  rubric?: Rubric
}

export const rubricCol = createCollection<RubricRecord>('work_rubric', [])
