import { uid } from '../../../lib/store'
import { healthLogsCol, healthGoalsCol } from './store'
import type { HealthLog, HealthGoals } from './types'
import { GOALS_ID } from './types'
import { recentDays } from './util'

// ============================================================
//  健康追蹤示範資料
//  ------------------------------------------------------------
//  一鍵填入一個「有上進心、生活忙碌」嘅人近兩週嘅健康記錄：
//  體重穩步輕微下降、睡眠時多時少（趕工嗰幾日捱夜）、平日有運動、
//  週末偷懶、飲水大致達標、心情隨睡眠與運動波動。
//
//  Idempotent：每個 collection 淨係喺佢而家係空先種；已有資料就跳過。
//  日期一律用 util 嘅 recentDays（本地時區 key），分佈喺最近兩週。
// ============================================================

/** 近兩週每日記錄（由舊到新）。每筆對應 recentDays(14) 嘅一個日期。 */
interface DayPlan {
  weightKg?: number
  sleepHrs?: number
  exerciseMin?: number
  waterMl?: number
  mood?: number
  note?: string
}

// 14 日（index 0 = 兩週前，index 13 = 今日）。
// 刻意留個別日子缺少部分指標（真實人唔會日日齊），但唔好太多空窗。
const PLAN: DayPlan[] = [
  // 第一週
  { weightKg: 68.4, sleepHrs: 7.5, exerciseMin: 30, waterMl: 2000, mood: 4, note: '新一週開工，落 gym 跑咗陣，狀態唔錯' },
  { weightKg: 68.3, sleepHrs: 6.5, exerciseMin: 0, waterMl: 1600, mood: 3, note: '夜晚趕 deadline，飲水唔夠' },
  { weightKg: 68.5, sleepHrs: 7.0, exerciseMin: 45, waterMl: 2200, mood: 4, note: '放工去咗游水，肩頸鬆返晒' },
  { sleepHrs: 6.0, exerciseMin: 0, waterMl: 1800, mood: 2, note: '會議排到爆，得閒飲啖水都難' },
  { weightKg: 68.1, sleepHrs: 7.5, exerciseMin: 40, waterMl: 2400, mood: 4, note: '黃昏跑咗 5K，出咗身汗好舒服' },
  { weightKg: 68.0, sleepHrs: 8.0, exerciseMin: 60, waterMl: 2300, mood: 5, note: '週末同朋友行山，行咗成個上午' },
  { weightKg: 68.2, sleepHrs: 8.5, exerciseMin: 0, waterMl: 1700, mood: 4, note: '休息日，賴床補眠' },
  // 第二週
  { weightKg: 67.9, sleepHrs: 7.0, exerciseMin: 30, waterMl: 2100, mood: 4, note: '重新開工，做咗組核心訓練' },
  { weightKg: 67.8, sleepHrs: 6.5, exerciseMin: 35, waterMl: 2000, mood: 3, note: '有啲眼瞓，但都頂硬上做運動' },
  { sleepHrs: 5.5, exerciseMin: 0, waterMl: 1500, mood: 2, note: '通宵改 proposal，第二朝好攰' },
  { weightKg: 67.7, sleepHrs: 7.5, exerciseMin: 45, waterMl: 2300, mood: 4, note: '補返覺，落 gym 練腿' },
  { weightKg: 67.6, sleepHrs: 8.0, exerciseMin: 50, waterMl: 2500, mood: 5, note: '今日狀態大好，跑步配速都快咗' },
  { weightKg: 67.8, sleepHrs: 7.0, exerciseMin: 0, waterMl: 1900, mood: 3, note: '出街食飯，運動 off 一日' },
  { weightKg: 67.5, sleepHrs: 7.5, exerciseMin: 40, waterMl: 2200, mood: 4, note: '今朝磅返輕咗少少，繼續保持' },
]

export function seedDemo(): number {
  let added = 0
  const now = new Date().toISOString()

  // ---- 健康目標（單例）----
  if (healthGoalsCol.get().length === 0) {
    const goals: Omit<HealthGoals, 'id'> & { id?: string } = {
      id: GOALS_ID,
      weightTargetKg: 66,
      sleepTargetHrs: 7.5,
      exerciseTargetMin: 180,
      waterTargetMl: 2200,
    }
    healthGoalsCol.add(goals)
    added += 1
  }

  // ---- 每日健康記錄（近兩週）----
  if (healthLogsCol.get().length === 0) {
    const dates = recentDays(PLAN.length)
    PLAN.forEach((plan, i) => {
      const log: Omit<HealthLog, 'id'> & { id?: string } = {
        id: uid(),
        date: dates[i],
        ...plan,
        createdAt: now,
        updatedAt: now,
      }
      healthLogsCol.add(log)
      added += 1
    })
  }

  return added
}
