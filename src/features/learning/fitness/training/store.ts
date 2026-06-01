import { createCollection } from '../../../../lib/store'
import type { Workout } from './types'

// ============================================================
//  訓練記錄 collection
//  ------------------------------------------------------------
//  key 前綴 fitness_、獨一無二 → createCollection 自動登記，
//  登入後雲端同步。出廠空（對齊 body / nutrition）：示範資料一律
//  由 demo.ts 的 seedDemo() 種，令其 length===0 守衞正常運作。
// ============================================================

export const workoutCol = createCollection<Workout>('fitness_training_v1', [])
