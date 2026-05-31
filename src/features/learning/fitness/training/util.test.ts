import { describe, it, expect } from 'vitest'
import {
  setVolume,
  exerciseVolume,
  workoutVolume,
  workoutSetCount,
  est1RM,
  dailyVolume,
  weeklyTrend,
  weeklyVolume,
  weeklySessions,
  avgRpe,
  prByExercise,
  maxRpe,
  sortWorkoutsDesc,
  volumeTrend,
  daysSinceLastWorkout,
  lastSetOf,
  computePlates,
  formatClock,
} from './util'
import type { Workout, WorkoutSet } from './types'

// 固定 anchor（中午，避免時區跨日）：2026-05-31（星期日）
const ANCHOR = new Date(2026, 4, 31, 12, 0, 0)

// ── 造資料 helper ──
function key(deltaDays: number): string {
  const d = new Date(2026, 4, 31 + deltaDays, 12)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function w(over: Partial<Workout>): Workout {
  return {
    id: 'w',
    date: key(0),
    exercises: [],
    createdAt: '2026-05-31T00:00:00.000Z',
    ...over,
  }
}

const set = (reps: number, weightKg: number, rpe?: number): WorkoutSet => ({
  reps,
  weightKg,
  ...(rpe === undefined ? {} : { rpe }),
})

// ============================================================
//  setVolume / exerciseVolume / workoutVolume
// ============================================================

describe('setVolume', () => {
  it('reps × weightKg', () => {
    expect(setVolume(set(8, 60))).toBe(480)
    expect(setVolume(set(5, 100))).toBe(500)
  })
  it('體重動作（weight=0）→ 0', () => {
    expect(setVolume(set(10, 0))).toBe(0)
  })
  it('負值當 0，唔出負 volume', () => {
    expect(setVolume(set(-5, 60))).toBe(0)
    expect(setVolume(set(8, -60))).toBe(0)
  })
  it('缺值 / NaN 守衞 → 0（唔 NaN）', () => {
    expect(setVolume({ reps: NaN, weightKg: 60 })).toBe(0)
    expect(setVolume({} as WorkoutSet)).toBe(0)
  })
})

describe('exerciseVolume / workoutVolume', () => {
  it('動作加總所有 set', () => {
    expect(
      exerciseVolume({ name: '臥推', sets: [set(8, 60), set(8, 60), set(6, 65)] }),
    ).toBe(480 + 480 + 390) // 1350
  })
  it('一次訓練加總所有動作', () => {
    const workout = w({
      exercises: [
        { name: '臥推', sets: [set(8, 60), set(8, 60)] }, // 960
        { name: '肩推', sets: [set(10, 30)] }, // 300
      ],
    })
    expect(workoutVolume(workout)).toBe(1260)
  })
  it('空動作 / 空 set 守衞 → 0', () => {
    expect(workoutVolume(w({ exercises: [] }))).toBe(0)
    expect(exerciseVolume({ name: 'x', sets: [] })).toBe(0)
    expect(workoutVolume({} as Workout)).toBe(0)
  })
  it('workoutSetCount 數總 set 數', () => {
    const workout = w({
      exercises: [
        { name: 'a', sets: [set(8, 60), set(8, 60)] },
        { name: 'b', sets: [set(10, 30)] },
      ],
    })
    expect(workoutSetCount(workout)).toBe(3)
    expect(workoutSetCount(w({ exercises: [] }))).toBe(0)
  })
})

// ============================================================
//  est1RM（Epley）
// ============================================================

describe('est1RM', () => {
  it('Epley：weight × (1 + reps/30)', () => {
    // 100kg × 5 reps = 100 × (1+5/30) = 100 × 1.1666… = 116.66…
    expect(est1RM(100, 5)).toBeCloseTo(116.6667, 3)
    // 60kg × 10 = 60 × (1+10/30) = 60 × 1.3333 = 80
    expect(est1RM(60, 10)).toBeCloseTo(80, 6)
  })
  it('reps=1 → 等於 weight 本身', () => {
    expect(est1RM(120, 1)).toBeCloseTo(124, 6) // 120×(1+1/30)=124
  })
  it('weight<=0 或 reps<=0 → 0（守衞）', () => {
    expect(est1RM(0, 5)).toBe(0)
    expect(est1RM(100, 0)).toBe(0)
    expect(est1RM(-50, 5)).toBe(0)
  })
  it('NaN 守衞 → 0', () => {
    expect(est1RM(NaN, 5)).toBe(0)
    expect(est1RM(100, NaN)).toBe(0)
  })
})

// ============================================================
//  dailyVolume / weeklyVolume / weeklySessions
// ============================================================

describe('dailyVolume', () => {
  it('回近 n 日（由舊到新），對應日子有量', () => {
    const data = [
      w({ id: 'a', date: key(0), exercises: [{ name: 'x', sets: [set(5, 100)] }] }), // 500 今日
      w({ id: 'b', date: key(-2), exercises: [{ name: 'y', sets: [set(8, 50)] }] }), // 400 前2日
    ]
    const out = dailyVolume(data, 3, ANCHOR)
    expect(out).toHaveLength(3)
    expect(out.map((d) => d.key)).toEqual([key(-2), key(-1), key(0)])
    expect(out[0].volume).toBe(400)
    expect(out[1].volume).toBe(0)
    expect(out[2].volume).toBe(500)
  })
  it('同一日多筆 workout 合併相加', () => {
    const data = [
      w({ id: 'a', date: key(0), exercises: [{ name: 'x', sets: [set(5, 100)] }] }),
      w({ id: 'b', date: key(0), exercises: [{ name: 'y', sets: [set(5, 100)] }] }),
    ]
    const out = dailyVolume(data, 1, ANCHOR)
    expect(out[0].volume).toBe(1000)
  })
  it('空陣列 → 全 0，長度仍對', () => {
    const out = dailyVolume([], 7, ANCHOR)
    expect(out).toHaveLength(7)
    expect(out.every((d) => d.volume === 0)).toBe(true)
  })
  it('days=0 → 空', () => {
    expect(dailyVolume([], 0, ANCHOR)).toHaveLength(0)
  })
})

describe('weeklyVolume / weeklySessions', () => {
  const data = [
    w({ id: 'a', date: key(0), exercises: [{ name: 'x', sets: [set(5, 100)] }] }), // 500
    w({ id: 'b', date: key(-6), exercises: [{ name: 'y', sets: [set(5, 100)] }] }), // 500（本週邊界內）
    w({ id: 'c', date: key(-7), exercises: [{ name: 'z', sets: [set(5, 100)] }] }), // 500（上週，唔計）
  ]
  it('本週 = 近 7 日（含今日）總 volume', () => {
    expect(weeklyVolume(data, ANCHOR)).toBe(1000)
  })
  it('本週 session 數（7 日內筆數）', () => {
    expect(weeklySessions(data, ANCHOR)).toBe(2)
  })
  it('空 → 0', () => {
    expect(weeklyVolume([], ANCHOR)).toBe(0)
    expect(weeklySessions([], ANCHOR)).toBe(0)
  })
})

// ============================================================
//  weeklyTrend
// ============================================================

describe('weeklyTrend', () => {
  it('回 weeks 個週（舊→新），最新標「本週」', () => {
    const data = [
      w({ id: 'a', date: key(0), exercises: [{ name: 'x', sets: [set(5, 100, 8)] }] }), // 本週 500
      w({ id: 'b', date: key(-7), exercises: [{ name: 'y', sets: [set(5, 80, 6)] }] }), // 上週 400
    ]
    const out = weeklyTrend(data, 2, ANCHOR)
    expect(out).toHaveLength(2)
    expect(out[0].label).toBe('1週前')
    expect(out[0].volume).toBe(400)
    expect(out[0].avgRpe).toBe(6)
    expect(out[0].sessions).toBe(1)
    expect(out[1].label).toBe('本週')
    expect(out[1].volume).toBe(500)
    expect(out[1].avgRpe).toBe(8)
  })
  it('空 → 全 0 但長度對', () => {
    const out = weeklyTrend([], 4, ANCHOR)
    expect(out).toHaveLength(4)
    expect(out.every((wk) => wk.volume === 0 && wk.avgRpe === 0)).toBe(true)
  })
})

// ============================================================
//  avgRpe（缺 rpe 守衞）
// ============================================================

describe('avgRpe', () => {
  it('只計有填 RPE 嘅 set', () => {
    const data = [
      w({
        date: key(0),
        exercises: [
          { name: 'x', sets: [set(5, 100, 8), set(5, 100, 10), set(5, 100)] }, // 第三組冇 rpe
        ],
      }),
    ]
    expect(avgRpe(data, 7, ANCHOR)).toBe(9) // (8+10)/2
  })
  it('完全冇 RPE → 0（唔 NaN）', () => {
    const data = [w({ date: key(0), exercises: [{ name: 'x', sets: [set(5, 100)] }] })]
    expect(avgRpe(data, 7, ANCHOR)).toBe(0)
  })
  it('超出視窗嘅 workout 唔計', () => {
    const data = [
      w({ id: 'old', date: key(-10), exercises: [{ name: 'x', sets: [set(5, 100, 2)] }] }),
      w({ id: 'new', date: key(0), exercises: [{ name: 'y', sets: [set(5, 100, 8)] }] }),
    ]
    expect(avgRpe(data, 7, ANCHOR)).toBe(8)
  })
  it('四捨五入到 0.1', () => {
    const data = [
      w({
        date: key(0),
        exercises: [{ name: 'x', sets: [set(1, 1, 7), set(1, 1, 8), set(1, 1, 8)] }] }), // 23/3=7.666→7.7
    ]
    expect(avgRpe(data, 7, ANCHOR)).toBe(7.7)
  })
  it('空陣列 → 0', () => {
    expect(avgRpe([], 7, ANCHOR)).toBe(0)
  })
})

// ============================================================
//  prByExercise
// ============================================================

describe('prByExercise', () => {
  it('每動作最大 weight + 最佳 1RM', () => {
    const data = [
      w({
        date: key(-1),
        exercises: [{ name: '臥推', sets: [set(8, 60), set(6, 65)] }],
      }),
      w({
        date: key(0),
        exercises: [{ name: '臥推', sets: [set(3, 70)] }],
      }),
    ]
    const pr = prByExercise(data)
    const bench = pr.get('臥推')
    expect(bench).toBeDefined()
    expect(bench!.maxWeight).toBe(70)
    // best 1RM：候選 60×(1+8/30)=76、65×(1+6/30)=78、70×(1+3/30)=77 → 78
    expect(bench!.best1RM).toBeCloseTo(78, 6)
  })
  it('多個動作各自分開', () => {
    const data = [
      w({
        date: key(0),
        exercises: [
          { name: '深蹲', sets: [set(5, 120)] },
          { name: '臥推', sets: [set(5, 80)] },
        ],
      }),
    ]
    const pr = prByExercise(data)
    expect(pr.size).toBe(2)
    expect(pr.get('深蹲')!.maxWeight).toBe(120)
    expect(pr.get('臥推')!.maxWeight).toBe(80)
  })
  it('同名（trim 後）合併', () => {
    const data = [
      w({ date: key(-1), exercises: [{ name: '硬舉 ', sets: [set(5, 100)] }] }),
      w({ date: key(0), exercises: [{ name: ' 硬舉', sets: [set(3, 110)] }] }),
    ]
    const pr = prByExercise(data)
    expect(pr.size).toBe(1)
    expect(pr.get('硬舉')!.maxWeight).toBe(110)
  })
  it('空名跳過、空陣列 → 空 Map', () => {
    expect(prByExercise([]).size).toBe(0)
    const data = [w({ date: key(0), exercises: [{ name: '   ', sets: [set(5, 100)] }] })]
    expect(prByExercise(data).size).toBe(0)
  })
  it('純體重動作 maxWeight=0、best1RM=0', () => {
    const data = [w({ date: key(0), exercises: [{ name: '引體', sets: [set(10, 0)] }] })]
    const pr = prByExercise(data)
    expect(pr.get('引體')!.maxWeight).toBe(0)
    expect(pr.get('引體')!.best1RM).toBe(0)
  })
})

// ============================================================
//  maxRpe / sortWorkoutsDesc / volumeTrend / daysSinceLastWorkout
// ============================================================

describe('maxRpe', () => {
  it('回最高單組 RPE', () => {
    const workout = w({
      exercises: [{ name: 'x', sets: [set(5, 100, 7), set(3, 110, 9)] }],
    })
    expect(maxRpe(workout)).toBe(9)
  })
  it('完全冇 RPE → null', () => {
    expect(maxRpe(w({ exercises: [{ name: 'x', sets: [set(5, 100)] }] }))).toBeNull()
    expect(maxRpe(w({ exercises: [] }))).toBeNull()
  })
})

describe('sortWorkoutsDesc', () => {
  it('按日期新→舊', () => {
    const data = [
      w({ id: 'old', date: key(-3) }),
      w({ id: 'new', date: key(0) }),
      w({ id: 'mid', date: key(-1) }),
    ]
    expect(sortWorkoutsDesc(data).map((x) => x.id)).toEqual(['new', 'mid', 'old'])
  })
  it('同日用 createdAt 倒序', () => {
    const data = [
      w({ id: 'first', date: key(0), createdAt: '2026-05-31T08:00:00.000Z' }),
      w({ id: 'later', date: key(0), createdAt: '2026-05-31T20:00:00.000Z' }),
    ]
    expect(sortWorkoutsDesc(data).map((x) => x.id)).toEqual(['later', 'first'])
  })
  it('唔改原陣列', () => {
    const data = [w({ id: 'a', date: key(-1) }), w({ id: 'b', date: key(0) })]
    const copy = [...data]
    sortWorkoutsDesc(data)
    expect(data).toEqual(copy)
  })
  it('空 → 空', () => {
    expect(sortWorkoutsDesc([])).toEqual([])
  })
})

describe('volumeTrend', () => {
  it('本週 > 上週 → up + 正百分比', () => {
    const data = [
      w({ id: 'a', date: key(0), exercises: [{ name: 'x', sets: [set(10, 100)] }] }), // 本週 1000
      w({ id: 'b', date: key(-7), exercises: [{ name: 'y', sets: [set(5, 100)] }] }), // 上週 500
    ]
    expect(volumeTrend(data, ANCHOR)).toEqual({ dir: 'up', pct: 100 })
  })
  it('本週 < 上週 → down', () => {
    const data = [
      w({ id: 'a', date: key(0), exercises: [{ name: 'x', sets: [set(5, 100)] }] }), // 500
      w({ id: 'b', date: key(-7), exercises: [{ name: 'y', sets: [set(10, 100)] }] }), // 1000
    ]
    expect(volumeTrend(data, ANCHOR)).toEqual({ dir: 'down', pct: -50 })
  })
  it('上週 0 量 → 唔除零（pct=0）', () => {
    const data = [w({ id: 'a', date: key(0), exercises: [{ name: 'x', sets: [set(5, 100)] }] })]
    expect(volumeTrend(data, ANCHOR)).toEqual({ dir: 'up', pct: 0 })
  })
  it('空 → flat', () => {
    expect(volumeTrend([], ANCHOR)).toEqual({ dir: 'flat', pct: 0 })
  })
})

describe('daysSinceLastWorkout', () => {
  it('用最新一筆計差日', () => {
    const data = [w({ date: key(-3) }), w({ date: key(-1) })]
    expect(daysSinceLastWorkout(data, ANCHOR)).toBe(1)
  })
  it('今日有練 → 0', () => {
    expect(daysSinceLastWorkout([w({ date: key(0) })], ANCHOR)).toBe(0)
  })
  it('無記錄 → null', () => {
    expect(daysSinceLastWorkout([], ANCHOR)).toBeNull()
  })
})

// ============================================================
//  lastSetOf（新一組預填）
// ============================================================

describe('lastSetOf', () => {
  it('取最近一次同名動作嘅最後一組 reps/weight', () => {
    const data = [
      w({
        id: 'old',
        date: key(-2),
        exercises: [{ name: '臥推', sets: [set(8, 60), set(8, 62)] }],
      }),
      w({
        id: 'new',
        date: key(0),
        exercises: [{ name: '臥推', sets: [set(5, 70), set(3, 75)] }],
      }),
    ]
    expect(lastSetOf(data, '臥推')).toEqual({ reps: 3, weightKg: 75 })
  })
  it('同名 trim 後一致；rpe 唔帶出嚟', () => {
    const data = [
      w({ date: key(0), exercises: [{ name: ' 深蹲 ', sets: [set(5, 100, 8)] }] }),
    ]
    expect(lastSetOf(data, '深蹲')).toEqual({ reps: 5, weightKg: 100 })
  })
  it('同日 tie 用 createdAt 最新一筆', () => {
    const data = [
      w({
        id: 'early',
        date: key(0),
        createdAt: '2026-05-31T08:00:00.000Z',
        exercises: [{ name: '硬舉', sets: [set(5, 100)] }],
      }),
      w({
        id: 'late',
        date: key(0),
        createdAt: '2026-05-31T20:00:00.000Z',
        exercises: [{ name: '硬舉', sets: [set(3, 120)] }],
      }),
    ]
    expect(lastSetOf(data, '硬舉')).toEqual({ reps: 3, weightKg: 120 })
  })
  it('搵唔到同名 → null', () => {
    const data = [w({ date: key(0), exercises: [{ name: '臥推', sets: [set(8, 60)] }] })]
    expect(lastSetOf(data, '划船')).toBeNull()
  })
  it('同名但嗰次無 set → 跳去再上一次有 set 嘅', () => {
    const data = [
      w({ id: 'a', date: key(-3), exercises: [{ name: '臥推', sets: [set(8, 60)] }] }),
      w({ id: 'b', date: key(0), exercises: [{ name: '臥推', sets: [] }] }),
    ]
    expect(lastSetOf(data, '臥推')).toEqual({ reps: 8, weightKg: 60 })
  })
  it('空名 / 空陣列 → null', () => {
    expect(lastSetOf([], '臥推')).toBeNull()
    expect(lastSetOf([w({ date: key(0) })], '   ')).toBeNull()
  })
  it('NaN / 缺值守衞 → 0', () => {
    const data = [
      w({ date: key(0), exercises: [{ name: 'x', sets: [{ reps: NaN, weightKg: 50 }] }] }),
    ]
    expect(lastSetOf(data, 'x')).toEqual({ reps: 0, weightKg: 50 })
  })
})

// ============================================================
//  computePlates（槓片計算器）
// ============================================================

describe('computePlates', () => {
  it('標準：100kg / 20kg 槓 → 每邊 40kg = 25+15', () => {
    const plan = computePlates(100, 20)
    expect(plan.perSide).toEqual([25, 15])
    expect(plan.achievableKg).toBe(100)
    expect(plan.remainderKg).toBe(0)
    expect(plan.belowBar).toBe(false)
  })
  it('貪心由大到細：60kg / 20kg → 每邊 20kg = 單片 20', () => {
    const plan = computePlates(60, 20)
    expect(plan.perSide).toEqual([20])
    expect(plan.achievableKg).toBe(60)
    expect(plan.remainderKg).toBe(0)
  })
  it('用到細片：62.5kg / 20kg → 每邊 21.25 = 20+1.25', () => {
    const plan = computePlates(62.5, 20)
    expect(plan.perSide).toEqual([20, 1.25])
    expect(plan.achievableKg).toBe(62.5)
    expect(plan.remainderKg).toBe(0)
  })
  it('奇數 / 湊唔齊：63kg / 20kg → 餘數 > 0，achievable 為實際可達', () => {
    const plan = computePlates(63, 20)
    // 每邊 21.5：25 太大跳過、20、1.25 → 21.25，餘 0.25/邊 → 總餘 0.5
    expect(plan.perSide).toEqual([20, 1.25])
    expect(plan.achievableKg).toBe(62.5)
    expect(plan.remainderKg).toBeCloseTo(0.5, 6)
  })
  it('等於空槓 → 空片、無餘數', () => {
    const plan = computePlates(20, 20)
    expect(plan.perSide).toEqual([])
    expect(plan.achievableKg).toBe(20)
    expect(plan.remainderKg).toBe(0)
    expect(plan.belowBar).toBe(false)
  })
  it('低過空槓 → belowBar、空片', () => {
    const plan = computePlates(15, 20)
    expect(plan.perSide).toEqual([])
    expect(plan.achievableKg).toBe(20)
    expect(plan.belowBar).toBe(true)
    expect(plan.remainderKg).toBe(0) // target-bar 為負 → clamp 0
  })
  it('唔夠片（available 只得 5kg）：50kg / 20kg → 每邊 15 = 5+5+5', () => {
    const plan = computePlates(50, 20, [5])
    expect(plan.perSide).toEqual([5, 5, 5])
    expect(plan.achievableKg).toBe(50)
    expect(plan.remainderKg).toBe(0)
  })
  it('available 全部太大 → 一片都上唔到，全部餘數', () => {
    const plan = computePlates(45, 20, [25])
    // 每邊 12.5，25 上唔到 → 空片，餘 25
    expect(plan.perSide).toEqual([])
    expect(plan.achievableKg).toBe(20)
    expect(plan.remainderKg).toBeCloseTo(25, 6)
  })
  it('自訂空槓重（女槓 15kg）：55kg / 15kg → 每邊 20 = 單片 20', () => {
    const plan = computePlates(55, 15)
    expect(plan.perSide).toEqual([20])
    expect(plan.achievableKg).toBe(55)
  })
  it('過濾非正槓片 + NaN 守衞', () => {
    const plan = computePlates(50, 20, [25, 0, -5, NaN, 5] as number[])
    // 每邊 15：25 太大、5+5+5
    expect(plan.perSide).toEqual([5, 5, 5])
    expect(plan.remainderKg).toBe(0)
  })
  it('NaN target → 當 0，低過槓 → belowBar', () => {
    const plan = computePlates(NaN, 20)
    expect(plan.perSide).toEqual([])
    expect(plan.belowBar).toBe(true)
  })
  it('唔改原 available 陣列', () => {
    const avail = [2.5, 25, 5]
    const copy = [...avail]
    computePlates(60, 20, avail)
    expect(avail).toEqual(copy)
  })
})

// ============================================================
//  formatClock（休息計時器顯示）
// ============================================================

describe('formatClock', () => {
  it('秒 → M:SS', () => {
    expect(formatClock(90)).toBe('1:30')
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(59)).toBe('0:59')
    expect(formatClock(125)).toBe('2:05')
  })
  it('向下取整秒', () => {
    expect(formatClock(90.9)).toBe('1:30')
  })
  it('負 / NaN → 0:00（守衞）', () => {
    expect(formatClock(-5)).toBe('0:00')
    expect(formatClock(NaN)).toBe('0:00')
  })
})
