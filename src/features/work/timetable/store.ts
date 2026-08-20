import { NTK_BELLS } from '../../../data/ntk-seed'
import { createCollection, type Entity } from '../../../lib/store'
import type { BellRow, SlotMeta } from './util'

export const timetableMetaCol = createCollection<SlotMeta>('timetable_meta', [])

export interface TimetableConfig extends Entity {
  bells: BellRow[]
  days: number[]
  cycle?: boolean
}

export const timetableConfigCol = createCollection<TimetableConfig>('timetable_config', [
  { id: 'config', bells: NTK_BELLS, days: [1, 2, 3, 4, 5, 6], cycle: true },
])
