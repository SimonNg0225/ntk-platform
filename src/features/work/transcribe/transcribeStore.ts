import { createCollection, type Entity } from '../../../lib/store'

export interface TranscriptRecord extends Entity {
  createdAt: string
  title: string
  model: string
  summary: string[]
  decisions: string[]
  actions: string[]
  transcript: string
}

export const transcribeCol = createCollection<TranscriptRecord>('work_transcribe', [])
