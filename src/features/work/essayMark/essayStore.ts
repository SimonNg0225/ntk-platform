import { createCollection, type Entity } from '../../../lib/store'
import type { EssayIssue, EssayScore, EssaySubject } from './essayPrompts'

export interface EssayRecord extends Entity {
  createdAt: string
  subject: EssaySubject
  title: string
  total: number
  maxTotal: number
  scores: EssayScore[]
  issues: EssayIssue[]
  overall: string
  model: string
}

export const essayMarkCol = createCollection<EssayRecord>('work_essay_mark', [])
