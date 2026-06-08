import { createCollection, type Entity } from '../../../lib/store'
import type { DsePaper, DseQuestion } from './dsePrompts'

export interface DseRecord extends Entity {
  createdAt: string
  topicName: string
  paper: DsePaper
  model: string
  questions: DseQuestion[]
}

export const dseCol = createCollection<DseRecord>('work_dse', [])

// ── DSE 考試日期（倒數）──
const DSE_DATE_KEY = 'work_dse_date'

export function getDseDate(): string {
  try {
    return localStorage.getItem(DSE_DATE_KEY) || ''
  } catch {
    return ''
  }
}
export function setDseDate(d: string): void {
  try {
    if (d) localStorage.setItem(DSE_DATE_KEY, d)
    else localStorage.removeItem(DSE_DATE_KEY)
  } catch {
    /* ignore */
  }
}
