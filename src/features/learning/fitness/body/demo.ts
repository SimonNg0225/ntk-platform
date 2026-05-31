import { uid } from '../../../../lib/store'
import { bodyEntriesCol, bodyProfileCol } from './store'
import type { BodyEntry, BodyProfile } from './types'
import { PROFILE_ID } from './types'
import { recentDays } from '../common'

// ============================================================
//  體態數據 — 示範資料 seeder
//  ------------------------------------------------------------
//  一鍵填入一個「有上進心、生活忙碌」嘅人近 4 週嘅 InBody 式身體
//  組成記錄：體重穩步輕微落、體脂率慢慢跌、骨骼肌量略升 —— 即係理想
//  嘅「體態重組（recomp）」走勢，令趨勢圖 / KPI / 增肌減脂分析 /
//  目標進度條一開即有嘢睇。配身高 + 目標 + 起點體重 profile。
//
//  鐵則：
//   - idempotent —— 每個 collection 只喺佢而家係空（length === 0）先種。
//   - 日期一律行健身共用嘅本地日期 helper（../common 嘅 recentDays），
//     分佈喺最近約 4 週，唔用未來日。
//   - 真實感：唔係日日做完整 InBody —— 個別日子淨秤體重（缺體脂 / 肌肉），
//     量度有輕微上落噪聲，唔係一條直線。
//   - 純資料，唔掂 UI / 唔 import React。
// ============================================================

/** 一個量度日嘅指標（缺值 = 嗰日冇量該項）。offset = 距今日數（愈大愈舊）。 */
interface DayPlan {
  offset: number
  weightKg?: number
  bodyFatPct?: number
  skeletalMuscleKg?: number
  /** 內臟脂肪等級（InBody 1–20，整數）；通常做完整 InBody 嗰日先有。 */
  visceralFat?: number
}

// 近 4 週（28 日窗），由舊到新。約每 4–5 日做一次完整 InBody，中間穿插
// 一兩次淨秤體重。整體：68.6→67.4kg、體脂 22.5→20.8%、骨骼肌 30.8→31.4kg。
const PLAN: DayPlan[] = [
  // ── 第 4 週前（起點，完整 InBody）──
  { offset: 27, weightKg: 68.6, bodyFatPct: 22.5, skeletalMuscleKg: 30.8, visceralFat: 9 },
  // 中段淨秤體重（趕工嗰排冇時間做完整量度）
  { offset: 23, weightKg: 68.3 },
  // ── 第 3 週（完整 InBody，脂肪開始落）──
  { offset: 20, weightKg: 68.0, bodyFatPct: 22.0, skeletalMuscleKg: 30.9, visceralFat: 9 },
  // ── 第 2 週中（完整 InBody，肌肉微升）──
  { offset: 14, weightKg: 67.7, bodyFatPct: 21.5, skeletalMuscleKg: 31.0, visceralFat: 8 },
  // 淨秤體重（週末出街食完，磅一磅）
  { offset: 9, weightKg: 67.9 },
  // ── 上週（完整 InBody）──
  { offset: 6, weightKg: 67.5, bodyFatPct: 21.0, skeletalMuscleKg: 31.2, visceralFat: 8 },
  // ── 今日（完整 InBody，最新狀態）──
  { offset: 0, weightKg: 67.4, bodyFatPct: 20.8, skeletalMuscleKg: 31.4, visceralFat: 8 },
]

export function seedDemo(): number {
  let added = 0
  const now = new Date().toISOString()

  // ── 1. 體態設定（單例）：身高 + 目標 + 起點 ────────────────
  // 有齊先計到 BMI / 目標進度條 / 達標預計。起點對齊 PLAN 最舊一筆體重。
  if (bodyProfileCol.get().length === 0) {
    const profile: Omit<BodyProfile, 'id'> & { id?: string } = {
      id: PROFILE_ID,
      heightCm: 175,
      weightTargetKg: 65,
      weightStartKg: 68.6,
      updatedAt: now,
    }
    bodyProfileCol.add(profile)
    added += 1
  }

  // ── 2. 每日身體組成記錄（近 4 週）────────────────────────
  // recentDays(28) 由舊到新；用 offset 對應「距今第幾日」攞 key。
  if (bodyEntriesCol.get().length === 0) {
    const days = recentDays(28) // index 0 = 27 日前，index 27 = 今日
    for (const plan of PLAN) {
      const { offset, ...metrics } = plan
      const date = days[days.length - 1 - offset]
      const entry: Omit<BodyEntry, 'id'> & { id?: string } = {
        id: uid(),
        date,
        ...metrics,
        createdAt: now,
        updatedAt: now,
      }
      bodyEntriesCol.add(entry)
      added += 1
    }
  }

  return added
}
