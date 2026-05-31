import { createCollection } from '../../../../lib/store'
import type { Workout } from './types'

// ============================================================
//  訓練記錄 collection
//  ------------------------------------------------------------
//  key 前綴 fitness_、獨一無二 → createCollection 自動登記，
//  登入後雲端同步。種子留兩日示範資料，畀新用戶即刻見到圖表
//  同 PR 點樣運作（離線 / 未登入照用）。
// ============================================================

const seed: Workout[] = [
  {
    id: 'seed-w1',
    date: offsetKey(-2),
    title: '推日 · 胸肩三頭',
    exercises: [
      {
        name: '槓鈴臥推',
        sets: [
          { reps: 8, weightKg: 60, rpe: 7 },
          { reps: 8, weightKg: 60, rpe: 8 },
          { reps: 6, weightKg: 65, rpe: 9 },
        ],
      },
      {
        name: '肩上推舉',
        sets: [
          { reps: 10, weightKg: 30, rpe: 7 },
          { reps: 10, weightKg: 30, rpe: 8 },
        ],
      },
    ],
    note: '臥推手感唔錯，下次加重。',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed-w2',
    date: offsetKey(0),
    title: '拉日 · 背二頭',
    exercises: [
      {
        name: '硬舉',
        sets: [
          { reps: 5, weightKg: 100, rpe: 8 },
          { reps: 5, weightKg: 100, rpe: 9 },
          { reps: 3, weightKg: 110, rpe: 9 },
        ],
      },
      {
        name: '引體上升',
        sets: [
          { reps: 8, weightKg: 0, rpe: 8 },
          { reps: 6, weightKg: 0, rpe: 9 },
        ],
      },
    ],
    createdAt: new Date().toISOString(),
  },
]

/** 本地時區 key（避開 UTC 漂移）；只喺種子用，runtime 一律由 common 攞。 */
function offsetKey(deltaDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + deltaDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const workoutCol = createCollection<Workout>('fitness_training_v1', seed)
