import { uid } from '../../../lib/store'
import { habitV2Col, habitLogV2Col, type Habit, type HabitLog } from './types'
import { addDaysKey, todayKey } from './util'

// ============================================================
//  習慣追蹤 — 示範資料 seeder
//  ------------------------------------------------------------
//  一鍵填入一個「有上進心、生活忙碌」嘅人嘅習慣 + 近期打卡 log，
//  令畫面即刻有 streak、heatmap、完成率睇。
//
//  鐵則：
//   - idempotent —— 每個 collection 只喺佢而家係空（length === 0）先種。
//   - 日期一律行 util 嘅本地日期 helper（todayKey / addDaysKey），
//     分佈喺最近約 4 週，唔會用未來日。
//   - 純資料，唔掂 UI / 唔 import React。
// ============================================================

/** 由近期某段日子連續打卡（含今日回推），回傳 log rows。
 *  startBack / endBack 係「距今幾多日」（0 = 今日，愈大愈舊）。
 *  endBack <= startBack；由舊到新逐日種。 */
function streak(
  habitId: string,
  startBack: number,
  endBack: number,
  notes: Record<number, string> = {},
): HabitLog[] {
  const today = todayKey()
  const out: HabitLog[] = []
  for (let back = startBack; back >= endBack; back -= 1) {
    const note = notes[back]
    out.push({
      id: uid(),
      habitId,
      date: addDaysKey(today, -back),
      ...(note ? { note } : {}),
    })
  }
  return out
}

/** 指定「距今日數」清單散打卡（用於非每日習慣，例如每週 3 次）。 */
function pick(habitId: string, backs: number[]): HabitLog[] {
  const today = todayKey()
  return backs.map((back) => ({
    id: uid(),
    habitId,
    date: addDaysKey(today, -back),
  }))
}

export function seedDemo(): number {
  let added = 0

  // ── 1. 習慣本身（只喺空先種）──────────────────────────────
  // 預先派 id，下面打卡 log 直接引用，毋須先 .add() 再查。
  const idMorningRun = uid()
  const idRead = uid()
  const idWater = uid()
  const idMeditate = uid()
  const idEnglish = uid()
  const idNoLateSnack = uid()
  const idGym = uid()

  if (habitV2Col.get().length === 0) {
    const today = todayKey()
    // createdAt 設成約 5 週前，令「成立至今」有歷史感。
    const born = (back: number) => `${addDaysKey(today, -back)}T08:00:00.000Z`

    const habits: Habit[] = [
      {
        id: idMorningRun,
        name: '晨早跑步',
        icon: '🏃',
        color: 'green',
        frequency: { kind: 'weekdays', days: [1, 3, 5] }, // 逢一、三、五
        goalKind: 'build',
        targetStreak: 30,
        category: '運動',
        notes: '六點半起身落樓跑 3 公里，趁返工前清醒個腦。',
        reminderTime: '06:30',
        archived: false,
        order: 0,
        createdAt: born(33),
      },
      {
        id: idRead,
        name: '睡前閱讀 20 分鐘',
        icon: '📚',
        color: 'violet',
        frequency: { kind: 'daily' },
        goalKind: 'build',
        targetStreak: 21,
        category: '學習',
        notes: '放低手機，讀返幾頁書先瞓，今個月睇《原子習慣》。',
        reminderTime: '22:30',
        archived: false,
        order: 1,
        createdAt: born(30),
      },
      {
        id: idWater,
        name: '飲夠 8 杯水',
        icon: '💧',
        color: 'cyan',
        frequency: { kind: 'daily' },
        goalKind: 'build',
        targetStreak: 0,
        category: '健康',
        notes: '枱面放個 1L 水樽，飲完添，唔好淨係飲咖啡。',
        reminderTime: '10:00',
        archived: false,
        order: 2,
        createdAt: born(28),
      },
      {
        id: idMeditate,
        name: '正念冥想',
        icon: '🧘',
        color: 'amber',
        frequency: { kind: 'daily' },
        goalKind: 'build',
        targetStreak: 14,
        category: '正念',
        notes: '用 app 跟住做 10 分鐘呼吸練習，減返啲返工嘅焦慮。',
        reminderTime: '07:00',
        archived: false,
        order: 3,
        createdAt: born(24),
      },
      {
        id: idEnglish,
        name: '練英文（背 10 個生字）',
        icon: '✍️',
        color: 'blue',
        frequency: { kind: 'weekly', times: 5 }, // 每週 5 次
        goalKind: 'build',
        targetStreak: 0,
        category: '學習',
        notes: '用 Anki 溫卡，目標年底考到 IELTS 7。',
        reminderTime: '20:00',
        archived: false,
        order: 4,
        createdAt: born(26),
      },
      {
        id: idNoLateSnack,
        name: '戒夜宵',
        icon: '🥗',
        color: 'rose',
        frequency: { kind: 'daily' },
        goalKind: 'quit',
        targetStreak: 30,
        category: '健康',
        notes: '九點後唔再食嘢，想減返兩磅同瞓得好啲。',
        archived: false,
        order: 5,
        createdAt: born(20),
      },
      {
        id: idGym,
        name: '健身室重訓',
        icon: '💪',
        color: 'accent',
        frequency: { kind: 'weekly', times: 3 }, // 每週 3 次
        goalKind: 'build',
        targetStreak: 0,
        category: '運動',
        notes: '推 / 拉 / 腳 三分化，跟住健身中心嘅課表做。',
        reminderTime: '19:00',
        archived: false,
        order: 6,
        createdAt: born(22),
      },
    ]

    habitV2Col.set(habits)
    added += habits.length
  }

  // ── 2. 近期打卡 log（只喺空先種）──────────────────────────
  // 設計成有真實感：有正喺進行嘅 streak、有偶爾跣一兩日、
  // 非每日習慣只喺合理日子打卡。全部分佈喺最近約 4 週。
  if (habitLogV2Col.get().length === 0) {
    const logs: HabitLog[] = [
      // 晨早跑步（逢一三五）：過去四週幾乎全勤，只漏咗一次。
      // 距今日數揀啱對應星期，毋須準確；StreakUtil 會跳過非排程日。
      ...pick(idMorningRun, [25, 23, 21, 18, 16, 11, 9, 4, 2, 0]),

      // 睡前閱讀（每日）：正喺一段健康 streak — 最近 9 日連續無斷。
      ...streak(idRead, 8, 0, {
        8: '《原子習慣》第 4 章：習慣堆疊',
        3: '改睇《深度工作力》，停唔到手。',
        0: '今晚睇咗 30 分鐘，超額完成。',
      }),
      // 再加之前一段（中間斷咗一兩日，顯得真實）。
      ...streak(idRead, 16, 11),

      // 飲水（每日）：最近 6 日連續，之前散散哋。
      ...streak(idWater, 5, 0),
      ...pick(idWater, [12, 11, 9, 8, 7]),

      // 正念冥想（每日）：最近 4 日 streak，重頭嚟過嘅感覺。
      ...streak(idMeditate, 3, 0, {
        3: '返工前坐低十分鐘，成日順咗好多。',
      }),
      ...pick(idMeditate, [13, 12, 10]),

      // 練英文（每週 5 次）：最近兩週各打卡約 5 次。
      ...pick(idEnglish, [13, 12, 11, 9, 8, 6, 5, 4, 2, 1]),

      // 戒夜宵（戒除型，每日）：連續 7 日成功忍口。
      ...streak(idNoLateSnack, 6, 0, {
        6: '今晚好想食薯片，飲咗杯水頂住。',
        0: '一個禮拜未破戒，撐住！',
      }),

      // 健身室重訓（每週 3 次）：過去三週各約 3 次。
      ...pick(idGym, [20, 18, 15, 13, 11, 8, 6, 4, 1]),
    ]

    habitLogV2Col.set(logs)
    added += logs.length
  }

  return added
}
