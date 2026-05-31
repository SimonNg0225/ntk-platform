import { uid } from '../../../../lib/store'
import { workoutCol } from './store'
import type { Workout, Exercise } from './types'
import { addDaysKey, todayKey } from '../common'

// ============================================================
//  訓練記錄 — 示範資料 seeder
//  ------------------------------------------------------------
//  一鍵填入一個「有上進心、生活忙碌」嘅人近三週嘅重訓記錄：
//  跟「推 / 拉 / 腳」三分化，每週練三至四次，主項（臥推、硬舉、
//  深蹲）隨週數穩步加重（漸進超負荷），RPE 多落 7-9，趕工嗰週
//  練得少啲、感覺攰啲。令畫面即刻有 volume 趨勢、PR、平均 RPE
//  同槓片計算可以睇。
//
//  鐵則：
//   - idempotent —— workoutCol 只喺佢而家係空（length === 0）先種。
//   - 日期一律行 common 嘅本地日期 helper（todayKey / addDaysKey），
//     分佈喺最近約三週，唔會用未來日。
//   - 純資料，唔掂 UI / 唔 import React。
// ============================================================

/** 一次訓練嘅精簡描述（日後攤平成 Workout）。`back` = 距今日數（0 = 今日）。 */
interface SessionPlan {
  back: number
  title: string
  exercises: Exercise[]
  note?: string
}

// 由舊到新（back 大 → 小）。三週、每週推/拉/腳，主項逐週加重。
const PLAN: SessionPlan[] = [
  // ── 第三週前（約三星期前）──────────────────────────────
  {
    back: 20,
    title: '推日 · 胸肩三頭',
    exercises: [
      {
        name: '槓鈴臥推',
        sets: [
          { reps: 8, weightKg: 60, rpe: 7 },
          { reps: 8, weightKg: 60, rpe: 8 },
          { reps: 6, weightKg: 62.5, rpe: 9 },
        ],
      },
      {
        name: '啞鈴肩上推舉',
        sets: [
          { reps: 10, weightKg: 16, rpe: 7 },
          { reps: 10, weightKg: 16, rpe: 8 },
        ],
      },
      {
        name: '繩索下壓',
        sets: [
          { reps: 12, weightKg: 25, rpe: 7 },
          { reps: 12, weightKg: 25, rpe: 8 },
        ],
      },
    ],
    note: '重新開季第一練，重量保守，搵返手感。',
  },
  {
    back: 18,
    title: '拉日 · 背二頭',
    exercises: [
      {
        name: '硬舉',
        sets: [
          { reps: 5, weightKg: 100, rpe: 7 },
          { reps: 5, weightKg: 100, rpe: 8 },
          { reps: 5, weightKg: 105, rpe: 9 },
        ],
      },
      {
        name: '引體上升',
        sets: [
          { reps: 8, weightKg: 0, rpe: 8 },
          { reps: 6, weightKg: 0, rpe: 9 },
        ],
      },
      {
        name: '槓鈴划船',
        sets: [
          { reps: 10, weightKg: 50, rpe: 7 },
          { reps: 10, weightKg: 50, rpe: 8 },
        ],
      },
    ],
  },
  {
    back: 16,
    title: '腳日 · 股四頭臀腿',
    exercises: [
      {
        name: '深蹲',
        sets: [
          { reps: 8, weightKg: 80, rpe: 7 },
          { reps: 8, weightKg: 80, rpe: 8 },
          { reps: 6, weightKg: 85, rpe: 9 },
        ],
      },
      {
        name: '羅馬尼亞硬舉',
        sets: [
          { reps: 10, weightKg: 60, rpe: 7 },
          { reps: 10, weightKg: 60, rpe: 8 },
        ],
      },
    ],
    note: '蹲完落樓梯都軟，但好爽。',
  },

  // ── 第二週（約兩星期前，趕工撞正得閒練兩次）──────────────
  {
    back: 13,
    title: '推日 · 胸肩三頭',
    exercises: [
      {
        name: '槓鈴臥推',
        sets: [
          { reps: 8, weightKg: 62.5, rpe: 7 },
          { reps: 8, weightKg: 62.5, rpe: 8 },
          { reps: 6, weightKg: 65, rpe: 9 },
        ],
      },
      {
        name: '啞鈴肩上推舉',
        sets: [
          { reps: 10, weightKg: 18, rpe: 8 },
          { reps: 9, weightKg: 18, rpe: 9 },
        ],
      },
    ],
    note: '趕 deadline 冇乜時間，做晒大項就走。',
  },
  {
    back: 10,
    title: '拉日 · 背二頭',
    exercises: [
      {
        name: '硬舉',
        sets: [
          { reps: 5, weightKg: 105, rpe: 7 },
          { reps: 5, weightKg: 105, rpe: 8 },
          { reps: 3, weightKg: 112.5, rpe: 9 },
        ],
      },
      {
        name: '引體上升',
        sets: [
          { reps: 8, weightKg: 0, rpe: 8 },
          { reps: 7, weightKg: 0, rpe: 9 },
        ],
      },
      {
        name: '坐姿划船',
        sets: [
          { reps: 12, weightKg: 45, rpe: 7 },
          { reps: 12, weightKg: 45, rpe: 8 },
        ],
      },
    ],
    note: '捱完夜返嚟練，狀態麻麻但都頂硬上。',
  },

  // ── 本週（最近，狀態回勇、再加重）──────────────────────
  {
    back: 6,
    title: '腳日 · 股四頭臀腿',
    exercises: [
      {
        name: '深蹲',
        sets: [
          { reps: 8, weightKg: 85, rpe: 7 },
          { reps: 8, weightKg: 85, rpe: 8 },
          { reps: 5, weightKg: 90, rpe: 9 },
        ],
      },
      {
        name: '羅馬尼亞硬舉',
        sets: [
          { reps: 10, weightKg: 65, rpe: 8 },
          { reps: 10, weightKg: 65, rpe: 8 },
        ],
      },
      {
        name: '腿推',
        sets: [
          { reps: 12, weightKg: 120, rpe: 7 },
          { reps: 12, weightKg: 130, rpe: 8 },
        ],
      },
    ],
  },
  {
    back: 3,
    title: '推日 · 胸肩三頭',
    exercises: [
      {
        name: '槓鈴臥推',
        sets: [
          { reps: 8, weightKg: 65, rpe: 7 },
          { reps: 6, weightKg: 67.5, rpe: 8 },
          { reps: 5, weightKg: 70, rpe: 9 },
        ],
      },
      {
        name: '啞鈴肩上推舉',
        sets: [
          { reps: 10, weightKg: 18, rpe: 7 },
          { reps: 10, weightKg: 18, rpe: 8 },
          { reps: 8, weightKg: 20, rpe: 9 },
        ],
      },
      {
        name: '繩索下壓',
        sets: [
          { reps: 12, weightKg: 30, rpe: 8 },
          { reps: 12, weightKg: 30, rpe: 8 },
        ],
      },
    ],
    note: '臥推破咗 PR，70kg 終於上到，超開心！',
  },
  {
    back: 0,
    title: '拉日 · 背二頭',
    exercises: [
      {
        name: '硬舉',
        sets: [
          { reps: 5, weightKg: 110, rpe: 8 },
          { reps: 3, weightKg: 115, rpe: 9 },
          { reps: 1, weightKg: 120, rpe: 10 },
        ],
      },
      {
        name: '引體上升',
        sets: [
          { reps: 10, weightKg: 0, rpe: 8 },
          { reps: 8, weightKg: 5, rpe: 9 },
        ],
      },
      {
        name: '槓鈴划船',
        sets: [
          { reps: 10, weightKg: 55, rpe: 8 },
          { reps: 10, weightKg: 55, rpe: 8 },
        ],
      },
    ],
    note: '硬舉衝咗個單次 120kg，今期狀態最好。',
  },
]

export function seedDemo(): number {
  let added = 0

  // ── 訓練記錄（只喺空先種）────────────────────────────────
  if (workoutCol.get().length === 0) {
    const today = todayKey()
    const rows: Workout[] = PLAN.map((p) => ({
      id: uid(),
      date: addDaysKey(today, -p.back),
      title: p.title,
      exercises: p.exercises,
      ...(p.note ? { note: p.note } : {}),
      // createdAt 設成嗰日中午，令排序 / 趨勢有真實時序感。
      createdAt: `${addDaysKey(today, -p.back)}T12:00:00.000Z`,
    }))
    workoutCol.set(rows)
    added += rows.length
  }

  return added
}
