import { uid } from '../../../../lib/store'
import { recentDays } from '../common'
import { foodCol, goalsCol, DEFAULT_GOALS, GOALS_ID, saveGoals } from './store'
import type { FoodEntry, MealSlot, NutritionGoals } from './types'

// ============================================================
//  AI 飲食營養 — 示範資料
//  ------------------------------------------------------------
//  一鍵填入一個「有上進心、生活忙碌」嘅人近一週嘅飲食紀錄：
//  平日返工三餐 + 落 gym 後補蛋白小食、趕工嗰日求其食碗麵、
//  週末同朋友食好啲。今日（anchor）特登鋪到「早午晚 + 小食」齊
//  四個餐段，令日誌一打開即有嘢睇；目標係「減脂期」設定
//  （略低卡、高蛋白）。
//
//  Idempotent：
//   - foodCol 淨係喺佢而家係空（.length === 0）先種。
//   - goalsCol 係單例、出廠已帶 DEFAULT_GOALS（永遠 length === 1），
//     所以只喺佢仲係「未被用戶改過嘅原廠預設」先覆寫做示範目標，
//     唔會撞甩用戶自訂。
//
//  日期一律用 common 嘅 recentDays（本地時區 key），分佈喺最近 7 日。
// ============================================================

/** 一筆飲食草稿（未有 id / date / createdAt）。 */
type FoodDraft = Pick<
  FoodEntry,
  'label' | 'calories' | 'proteinG' | 'fatG' | 'carbG' | 'meal'
>

/** 某一日嘅幾餐（dayOffset：0 = 今日，越大 = 越近今日）。 */
interface DayMeals {
  /** recentDays 索引（0 = 7 日前，6 = 今日）。 */
  idx: number
  meals: FoodDraft[]
}

// recentDays(7)：index 0 = 6 日前，index 6 = 今日。
// 今日（idx 6）刻意鋪足早／午／晚／小食四段，令日誌即刻飽滿。
const WEEK: DayMeals[] = [
  // —— 6 日前（週末，同朋友食好啲）——
  {
    idx: 0,
    meals: [
      { label: '香腸吉列豬扒早餐連奶茶', calories: 620, proteinG: 24, fatG: 32, carbG: 58, meal: 'breakfast' },
      { label: '日式豚骨拉麵（連叉燒溏心蛋）', calories: 780, proteinG: 34, fatG: 30, carbG: 92, meal: 'lunch' },
      { label: '韓式烤肉放題（牛五花＋蔬菜）', calories: 950, proteinG: 58, fatG: 56, carbG: 40, meal: 'dinner' },
      { label: '凍檸茶（少甜）', calories: 90, proteinG: 0, fatG: 0, carbG: 22, meal: 'snack' },
    ],
  },
  // —— 5 日前（週日休息，落 gym 練完補蛋白）——
  {
    idx: 1,
    meals: [
      { label: '燕麥片配香蕉藍莓', calories: 340, proteinG: 12, fatG: 7, carbG: 60, meal: 'breakfast' },
      { label: '雞胸肉藜麥沙律', calories: 450, proteinG: 42, fatG: 14, carbG: 38, meal: 'lunch' },
      { label: '乳清蛋白奶昔（練完）', calories: 170, proteinG: 30, fatG: 2, carbG: 8, meal: 'snack' },
      { label: '蒸水蛋蒸魚配糙米飯', calories: 560, proteinG: 40, fatG: 16, carbG: 62, meal: 'dinner' },
    ],
  },
  // —— 4 日前（返工平日，正常三餐）——
  {
    idx: 2,
    meals: [
      { label: '全麥三文治（火雞胸＋芝士）', calories: 380, proteinG: 26, fatG: 12, carbG: 42, meal: 'breakfast' },
      { label: '燒雞髀飯（走皮）配油菜', calories: 620, proteinG: 38, fatG: 18, carbG: 78, meal: 'lunch' },
      { label: '希臘乳酪配果仁', calories: 220, proteinG: 16, fatG: 11, carbG: 16, meal: 'snack' },
      { label: '番茄炒蛋豆腐配白飯', calories: 540, proteinG: 28, fatG: 20, carbG: 60, meal: 'dinner' },
    ],
  },
  // —— 3 日前（趕 deadline，求其食）——
  {
    idx: 3,
    meals: [
      { label: '美式咖啡（黑）＋牛角包', calories: 290, proteinG: 6, fatG: 14, carbG: 34, meal: 'breakfast' },
      { label: '茶餐廳餐蛋公仔麵', calories: 560, proteinG: 22, fatG: 24, carbG: 62, meal: 'lunch' },
      { label: '便利店飯糰（吞拿魚）', calories: 230, proteinG: 8, fatG: 5, carbG: 38, meal: 'dinner' },
    ],
  },
  // —— 2 日前（補返狀態，落 gym 練腿）——
  {
    idx: 4,
    meals: [
      { label: '炒蛋牛油果多士', calories: 410, proteinG: 20, fatG: 24, carbG: 30, meal: 'breakfast' },
      { label: '香煎三文柳配雜菜飯', calories: 640, proteinG: 40, fatG: 28, carbG: 56, meal: 'lunch' },
      { label: '蛋白棒（練完補充）', calories: 200, proteinG: 20, fatG: 7, carbG: 22, meal: 'snack' },
      { label: '滷水雞髀配灼菜糙米飯', calories: 580, proteinG: 44, fatG: 18, carbG: 60, meal: 'dinner' },
    ],
  },
  // —— 1 日前（平日，落班同同事食日本菜）——
  {
    idx: 5,
    meals: [
      { label: '無糖豆漿＋茶葉蛋兩隻', calories: 220, proteinG: 18, fatG: 11, carbG: 12, meal: 'breakfast' },
      { label: '照燒雞肉便當', calories: 590, proteinG: 36, fatG: 20, carbG: 64, meal: 'lunch' },
      { label: '刺身定食（三文魚吞拿魚）', calories: 520, proteinG: 46, fatG: 18, carbG: 40, meal: 'dinner' },
    ],
  },
  // —— 今日（anchor）—— 鋪足四段，令日誌一打開就飽滿
  {
    idx: 6,
    meals: [
      { label: '蛋白燕麥碗（乳清＋燕麥＋果仁）', calories: 420, proteinG: 32, fatG: 12, carbG: 48, meal: 'breakfast' },
      { label: '雞胸糙米便當配西蘭花', calories: 560, proteinG: 46, fatG: 14, carbG: 60, meal: 'lunch' },
      { label: '黑咖啡', calories: 5, proteinG: 0, fatG: 0, carbG: 1, meal: 'snack' },
      { label: '清蒸鱸魚配蒜蓉炒時蔬', calories: 480, proteinG: 42, fatG: 16, carbG: 36, meal: 'dinner' },
    ],
  },
]

/** 目標已被用戶改動過？（同原廠四個值任何一個唔同 → 當已改，唔覆寫） */
function goalsArePristine(): boolean {
  const all = goalsCol.get()
  if (all.length === 0) return true // 空 → 當未設，照種
  const g = all.find((x) => x.id === GOALS_ID)
  if (!g) return true
  return (
    g.calories === DEFAULT_GOALS.calories &&
    g.proteinG === DEFAULT_GOALS.proteinG &&
    g.fatG === DEFAULT_GOALS.fatG &&
    g.carbG === DEFAULT_GOALS.carbG
  )
}

/**
 * 種飲食營養示範資料。
 * 回傳總共加咗幾多 row（飲食筆數 +（如有更新）目標 1 筆）。
 */
export function seedDemo(): number {
  let added = 0

  // ---- 每日目標（單例；減脂期：略低卡、高蛋白）----
  // 出廠已帶 DEFAULT_GOALS，故只喺仍係原廠未改先覆寫做示範目標。
  if (goalsArePristine()) {
    const demoGoals: Omit<NutritionGoals, 'id'> = {
      calories: 2100,
      proteinG: 150,
      fatG: 65,
      carbG: 210,
    }
    saveGoals(demoGoals)
    added += 1
  }

  // ---- 飲食紀錄（近一週）----
  if (foodCol.get().length === 0) {
    const dates = recentDays(WEEK.length)
    // 同一日內順序加，並微錯開 createdAt 令「同餐內新→舊」排序穩定。
    const base = Date.now()
    let seq = 0
    for (const day of WEEK) {
      const date = dates[day.idx]
      for (const m of day.meals) {
        const entry: Omit<FoodEntry, 'id'> & { id?: string } = {
          id: uid(),
          date,
          label: m.label,
          calories: m.calories,
          proteinG: m.proteinG,
          fatG: m.fatG,
          carbG: m.carbG,
          meal: m.meal as MealSlot,
          // 用日期 + 餐段次序砌一個遞增 ISO，避免全部同一刻
          createdAt: new Date(base + seq * 1000).toISOString(),
        }
        seq += 1
        foodCol.add(entry)
        added += 1
      }
    }
  }

  return added
}
