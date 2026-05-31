import { describe, it, expect } from 'vitest'
import {
  isNum,
  round,
  bmi,
  fatMassKg,
  leanMassKg,
  byDate,
  entriesOf,
  latestEntry,
  seriesOf,
  metricTrend,
  compositionChange,
  classifyRecomp,
  bmiBand,
  fmtDate,
  fmtDelta,
  deltaDir,
  goalProgress,
  weightRateKgPerWeek,
  projectedGoalDate,
  recompSeries,
} from './util'
import type { BodyEntry } from './types'

// ── 測試輔助：造一條記錄（只填關心嘅欄位） ──
const e = (over: Partial<BodyEntry>): BodyEntry => ({
  id: over.date ?? 'x',
  date: '2026-05-15',
  createdAt: '2026-05-15T00:00:00.000Z',
  ...over,
})

// 固定錨點（本地）：2026-05-31
const ANCHOR = new Date(2026, 4, 31, 12, 0, 0)

// ============================================================
//  isNum / round
// ============================================================
describe('isNum', () => {
  it('接受有限數字', () => {
    expect(isNum(0)).toBe(true)
    expect(isNum(-5.5)).toBe(true)
  })
  it('擋 undefined / null / NaN / Infinity', () => {
    expect(isNum(undefined)).toBe(false)
    expect(isNum(null)).toBe(false)
    expect(isNum(NaN)).toBe(false)
    expect(isNum(Infinity)).toBe(false)
    expect(isNum('70')).toBe(false)
  })
})

describe('round', () => {
  it('預設 1 位小數', () => expect(round(23.456)).toBe(23.5))
  it('指定 2 位', () => expect(round(12.3456, 2)).toBe(12.35))
  it('負數', () => expect(round(-0.156, 2)).toBe(-0.16))
  it('非有限 → 0', () => {
    expect(round(NaN)).toBe(0)
    expect(round(Infinity)).toBe(0)
  })
})

// ============================================================
//  bmi
// ============================================================
describe('bmi', () => {
  it('70kg / 175cm → 22.9', () => {
    // 70 / 1.75^2 = 70 / 3.0625 = 22.857 → 22.9
    expect(bmi(70, 175)).toBe(22.9)
  })
  it('60kg / 160cm → 23.4', () => {
    // 60 / 1.6^2 = 60 / 2.56 = 23.4375 → 23.4
    expect(bmi(60, 160)).toBe(23.4)
  })
  it('缺體重 → null', () => expect(bmi(undefined, 175)).toBeNull())
  it('缺身高 → null', () => expect(bmi(70, undefined)).toBeNull())
  it('身高 0（除零守衞）→ null', () => expect(bmi(70, 0)).toBeNull())
  it('負身高 → null', () => expect(bmi(70, -175)).toBeNull())
  it('體重 0 → null', () => expect(bmi(0, 175)).toBeNull())
  it('NaN → null', () => expect(bmi(NaN, 175)).toBeNull())
})

// ============================================================
//  fatMassKg / leanMassKg
// ============================================================
describe('fatMassKg', () => {
  it('80kg × 20% → 16', () => expect(fatMassKg(80, 20)).toBe(16))
  it('72.5kg × 18.4% → 13.34', () => {
    // 72.5 * 18.4 / 100 = 13.34
    expect(fatMassKg(72.5, 18.4)).toBe(13.34)
  })
  it('體脂 0% → 0（非 null）', () => expect(fatMassKg(80, 0)).toBe(0))
  it('缺體脂 → null', () => expect(fatMassKg(80, undefined)).toBeNull())
  it('缺體重 → null', () => expect(fatMassKg(undefined, 20)).toBeNull())
  it('體脂 >100 → null', () => expect(fatMassKg(80, 120)).toBeNull())
  it('負體脂 → null', () => expect(fatMassKg(80, -5)).toBeNull())
  it('負體重 → null', () => expect(fatMassKg(-80, 20)).toBeNull())
})

describe('leanMassKg', () => {
  it('80kg × 20% → 瘦體重 64', () => expect(leanMassKg(80, 20)).toBe(64))
  it('體脂 0% → 等於體重', () => expect(leanMassKg(70, 0)).toBe(70))
  it('缺值 → null', () => {
    expect(leanMassKg(undefined, 20)).toBeNull()
    expect(leanMassKg(80, undefined)).toBeNull()
  })
  it('體脂 100% → 瘦體重 0', () => expect(leanMassKg(80, 100)).toBe(0))
  it('無效體脂 → null', () => expect(leanMassKg(80, 150)).toBeNull())
})

// ============================================================
//  byDate / entriesOf / latestEntry
// ============================================================
describe('byDate', () => {
  it('同日後者覆寫', () => {
    const m = byDate([
      e({ date: '2026-05-10', weightKg: 70 }),
      e({ date: '2026-05-10', weightKg: 71 }),
    ])
    expect(m.size).toBe(1)
    expect(m.get('2026-05-10')?.weightKg).toBe(71)
  })
  it('空陣列 → 空 map', () => expect(byDate([]).size).toBe(0))
})

describe('entriesOf', () => {
  const data = [
    e({ date: '2026-05-12', weightKg: 71 }),
    e({ date: '2026-05-10', weightKg: 70 }),
    e({ date: '2026-05-11' }), // 缺 weightKg
    e({ date: '2026-05-13', weightKg: NaN }), // 無效
  ]
  it('過濾缺值/NaN 並按日期升序', () => {
    const r = entriesOf(data, 'weightKg')
    expect(r).toEqual([
      { date: '2026-05-10', value: 70 },
      { date: '2026-05-12', value: 71 },
    ])
  })
  it('空陣列 → 空', () => expect(entriesOf([], 'weightKg')).toEqual([]))
})

describe('latestEntry', () => {
  it('回最新日期那筆', () => {
    const r = latestEntry(
      [e({ date: '2026-05-10', bodyFatPct: 20 }), e({ date: '2026-05-20', bodyFatPct: 18 })],
      'bodyFatPct',
    )
    expect(r).toEqual({ date: '2026-05-20', value: 18 })
  })
  it('全無 → null', () => expect(latestEntry([], 'weightKg')).toBeNull())
})

// ============================================================
//  seriesOf
// ============================================================
describe('seriesOf', () => {
  const data = [
    e({ date: '2026-05-31', weightKg: 70 }),
    e({ date: '2026-05-29', weightKg: 71 }),
  ]
  it('近 3 日逐日序列（缺日 null），由舊到新', () => {
    const r = seriesOf(data, 'weightKg', 3, ANCHOR)
    expect(r).toEqual([
      { date: '2026-05-29', value: 71 },
      { date: '2026-05-30', value: null },
      { date: '2026-05-31', value: 70 },
    ])
  })
  it('長度等於 days', () => {
    expect(seriesOf(data, 'weightKg', 14, ANCHOR)).toHaveLength(14)
  })
  it('days ≤ 0 → 空陣列', () => {
    expect(seriesOf(data, 'weightKg', 0, ANCHOR)).toEqual([])
    expect(seriesOf(data, 'weightKg', -5, ANCHOR)).toEqual([])
  })
  it('空資料 → 全 null', () => {
    const r = seriesOf([], 'weightKg', 2, ANCHOR)
    expect(r).toEqual([
      { date: '2026-05-30', value: null },
      { date: '2026-05-31', value: null },
    ])
  })
})

// ============================================================
//  metricTrend（~30 日變化）
// ============================================================
describe('metricTrend', () => {
  it('最新 + 對比 30 日前變化', () => {
    const data = [
      e({ date: '2026-04-30', weightKg: 75 }), // 31 日前（≤ cutoff 2026-05-01）
      e({ date: '2026-05-31', weightKg: 72 }),
    ]
    const r = metricTrend(data, 'weightKg', 30, ANCHOR)
    expect(r).toEqual({ latest: 72, latestDate: '2026-05-31', delta: -3 })
  })
  it('窗外無基準時退而用最早一筆', () => {
    const data = [
      e({ date: '2026-05-20', weightKg: 73 }), // 仍喺 30 日窗內（cutoff=05-01）
      e({ date: '2026-05-31', weightKg: 72 }),
    ]
    const r = metricTrend(data, 'weightKg', 30, ANCHOR)
    expect(r?.delta).toBe(-1)
  })
  it('只得一筆 → delta null', () => {
    const r = metricTrend([e({ date: '2026-05-31', weightKg: 72 })], 'weightKg', 30, ANCHOR)
    expect(r).toEqual({ latest: 72, latestDate: '2026-05-31', delta: null })
  })
  it('全無 → null', () => expect(metricTrend([], 'weightKg', 30, ANCHOR)).toBeNull())
})

// ============================================================
//  classifyRecomp（門檻 0.3kg）
// ============================================================
describe('classifyRecomp', () => {
  it('↓脂肪 ↑肌肉 → recomp', () => expect(classifyRecomp(-1, 0.5)).toBe('recomp'))
  it('↑脂肪 ↓肌肉 → fatGain', () => expect(classifyRecomp(1, -0.5)).toBe('fatGain'))
  it('同跌 → cutLoss', () => expect(classifyRecomp(-2, -1)).toBe('cutLoss'))
  it('同升 → bulk', () => expect(classifyRecomp(1.5, 1)).toBe('bulk'))
  it('淨脂肪落、肌肉持平 → fatLoss', () => expect(classifyRecomp(-1, 0.1)).toBe('fatLoss'))
  it('淨肌肉升、脂肪持平 → muscleGain', () => expect(classifyRecomp(0.1, 0.8)).toBe('muscleGain'))
  it('都喺雜訊內 → stable', () => expect(classifyRecomp(0.1, -0.1)).toBe('stable'))
  it('剛好等於門檻當有意義', () => expect(classifyRecomp(-0.3, 0.3)).toBe('recomp'))
})

// ============================================================
//  compositionChange
// ============================================================
describe('compositionChange', () => {
  it('理想 recomp：脂肪↓ 肌肉↑', () => {
    // 首: 80kg/25% → fat20, lean60 ; 尾: 78kg/20% → fat15.6, lean62.4
    const data = [
      e({ date: '2026-05-01', weightKg: 80, bodyFatPct: 25 }),
      e({ date: '2026-05-31', weightKg: 78, bodyFatPct: 20 }),
    ]
    const r = compositionChange(data, 31, ANCHOR)
    expect(r.fatDeltaKg).toBe(-4.4) // 15.6 - 20
    expect(r.leanDeltaKg).toBe(2.4) // 62.4 - 60
    expect(r.fromDate).toBe('2026-05-01')
    expect(r.toDate).toBe('2026-05-31')
    expect(r.verdict).toBe('recomp')
    expect(r.summary).toContain('理想')
  })
  it('純減脂：脂肪↓ 肌肉持平', () => {
    // 首 80/20 fat16 lean64 ; 尾 76/15.8 fat~12.008 lean~63.992 → leanΔ≈0（雜訊）
    const data = [
      e({ date: '2026-05-10', weightKg: 80, bodyFatPct: 20 }),
      e({ date: '2026-05-31', weightKg: 76, bodyFatPct: 15.8 }),
    ]
    const r = compositionChange(data, 30, ANCHOR)
    expect(r.fatDeltaKg).toBeLessThan(-0.3)
    expect(Math.abs(r.leanDeltaKg!)).toBeLessThan(0.3)
    expect(r.verdict).toBe('fatLoss')
  })
  it('只用窗內首尾兩筆（忽略中間）', () => {
    const data = [
      e({ date: '2026-05-05', weightKg: 80, bodyFatPct: 24 }),
      e({ date: '2026-05-15', weightKg: 79, bodyFatPct: 22 }), // 中間，唔影響首尾
      e({ date: '2026-05-31', weightKg: 78, bodyFatPct: 20 }),
    ]
    const r = compositionChange(data, 30, ANCHOR)
    expect(r.fromDate).toBe('2026-05-05')
    expect(r.toDate).toBe('2026-05-31')
  })
  it('窗外記錄唔計入（只剩一筆 → insufficient）', () => {
    const data = [
      e({ date: '2026-01-01', weightKg: 90, bodyFatPct: 30 }), // 遠在 14 日窗外
      e({ date: '2026-05-31', weightKg: 78, bodyFatPct: 20 }),
    ]
    const r = compositionChange(data, 14, ANCHOR)
    expect(r.verdict).toBe('insufficient')
    expect(r.fatDeltaKg).toBeNull()
  })
  it('缺體脂嘅記錄唔算完整 → insufficient', () => {
    const data = [
      e({ date: '2026-05-10', weightKg: 80 }), // 冇體脂
      e({ date: '2026-05-31', weightKg: 78, bodyFatPct: 20 }),
    ]
    const r = compositionChange(data, 30, ANCHOR)
    expect(r.verdict).toBe('insufficient')
    expect(r.leanDeltaKg).toBeNull()
  })
  it('空陣列 → insufficient（唔 throw / 唔 NaN）', () => {
    const r = compositionChange([], 30, ANCHOR)
    expect(r.verdict).toBe('insufficient')
    expect(r.fatDeltaKg).toBeNull()
    expect(r.fromDate).toBeNull()
  })
  it('days ≤ 0 → insufficient', () => {
    const data = [
      e({ date: '2026-05-30', weightKg: 80, bodyFatPct: 20 }),
      e({ date: '2026-05-31', weightKg: 79, bodyFatPct: 19 }),
    ]
    expect(compositionChange(data, 0, ANCHOR).verdict).toBe('insufficient')
  })
})

// ============================================================
//  bmiBand
// ============================================================
describe('bmiBand', () => {
  it('過輕 / 正常 / 過重 / 肥胖', () => {
    expect(bmiBand(17)?.band).toBe('low')
    expect(bmiBand(22)?.band).toBe('normal')
    expect(bmiBand(25)?.band).toBe('high')
    expect(bmiBand(30)?.band).toBe('obese')
  })
  it('邊界 18.5 = 正常起點', () => expect(bmiBand(18.5)?.band).toBe('normal'))
  it('邊界 24 = 過重起點', () => expect(bmiBand(24)?.band).toBe('high'))
  it('邊界 27 = 肥胖起點', () => expect(bmiBand(27)?.band).toBe('obese'))
  it('null → null', () => expect(bmiBand(null)).toBeNull())
})

// ============================================================
//  格式化
// ============================================================
describe('fmtDate', () => {
  it('去前導零', () => expect(fmtDate('2026-05-23')).toBe('5月23日'))
  it('個位月日', () => expect(fmtDate('2026-01-09')).toBe('1月9日'))
  it('非法字串原樣回', () => expect(fmtDate('bad')).toBe('bad'))
})

describe('fmtDelta', () => {
  it('正數帶 +', () => expect(fmtDelta(1.25, 'kg')).toBe('+1.3kg'))
  it('負數帶 -', () => expect(fmtDelta(-0.52, 'kg')).toBe('-0.5kg'))
  it('零無號', () => expect(fmtDelta(0, '%')).toBe('0%'))
  it('null → —', () => expect(fmtDelta(null)).toBe('—'))
  it('NaN → —', () => expect(fmtDelta(NaN)).toBe('—'))
})

describe('deltaDir', () => {
  it('正 → up', () => expect(deltaDir(2)).toBe('up'))
  it('負 → down', () => expect(deltaDir(-2)).toBe('down'))
  it('零 → flat', () => expect(deltaDir(0)).toBe('flat'))
  it('null → flat', () => expect(deltaDir(null)).toBe('flat'))
})

// ============================================================
//  goalProgress（起點 → 目標 進度）
// ============================================================
describe('goalProgress', () => {
  it('減重目標：80→75，現 78 → 行咗 40%', () => {
    // (78-80)/(75-80) = -2/-5 = 0.4
    const r = goalProgress(78, 80, 75)
    expect(r.pct).toBe(40)
    expect(r.movedKg).toBe(-2)
    expect(r.remainingKg).toBe(-3)
    expect(r.losing).toBe(true)
    expect(r.reached).toBe(false)
  })
  it('增重目標：60→70，現 65 → 50%', () => {
    const r = goalProgress(65, 60, 70)
    expect(r.pct).toBe(50)
    expect(r.losing).toBe(false)
    expect(r.reached).toBe(false)
  })
  it('行過頭 clamp 落 100（減重到 73 < 目標 75）', () => {
    const r = goalProgress(73, 80, 75)
    expect(r.pct).toBe(100)
    expect(r.reached).toBe(true) // 已達/越過
  })
  it('行反方向 clamp 落 0（減重目標但變重）', () => {
    const r = goalProgress(82, 80, 75)
    expect(r.pct).toBe(0)
    expect(r.reached).toBe(false)
  })
  it('起點＝目標（除零守衞）→ pct null', () => {
    const r = goalProgress(70, 75, 75)
    expect(r.pct).toBeNull()
    expect(r.reached).toBe(false)
  })
  it('起點＝目標且 current 已等於 → reached', () => {
    const r = goalProgress(75, 75, 75)
    expect(r.pct).toBeNull()
    expect(r.reached).toBe(true)
  })
  it('剛好達標：減重 current=target → 100 + reached', () => {
    const r = goalProgress(75, 80, 75)
    expect(r.pct).toBe(100)
    expect(r.reached).toBe(true)
  })
  it('缺任一值 → 全 null', () => {
    expect(goalProgress(undefined, 80, 75).pct).toBeNull()
    expect(goalProgress(78, undefined, 75).movedKg).toBeNull()
    expect(goalProgress(78, 80, undefined).remainingKg).toBeNull()
    expect(goalProgress(NaN, 80, 75).pct).toBeNull()
  })
})

// ============================================================
//  weightRateKgPerWeek（kg/週 斜率）
// ============================================================
describe('weightRateKgPerWeek', () => {
  it('14 日跌 1.4kg → -0.7 kg/週', () => {
    // 首尾相差 14 日，跌 1.4kg → perDay -0.1 → -0.7/週
    const data = [
      e({ date: '2026-05-17', weightKg: 80 }),
      e({ date: '2026-05-31', weightKg: 78.6 }),
    ]
    expect(weightRateKgPerWeek(data, 30, ANCHOR)).toBe(-0.7)
  })
  it('增重：7 日升 0.5kg → +0.5 kg/週', () => {
    const data = [
      e({ date: '2026-05-24', weightKg: 70 }),
      e({ date: '2026-05-31', weightKg: 70.5 }),
    ]
    expect(weightRateKgPerWeek(data, 30, ANCHOR)).toBe(0.5)
  })
  it('只得一筆 → null', () => {
    expect(weightRateKgPerWeek([e({ date: '2026-05-31', weightKg: 78 })], 30, ANCHOR)).toBeNull()
  })
  it('首尾同日（除零守衞）→ null', () => {
    // 同一日兩條：byDate/entriesOf 後得一筆 → 不足兩筆
    const data = [e({ date: '2026-05-31', weightKg: 78 })]
    expect(weightRateKgPerWeek(data, 30, ANCHOR)).toBeNull()
  })
  it('窗外記錄唔計（只剩一筆 → null）', () => {
    const data = [
      e({ date: '2026-01-01', weightKg: 90 }),
      e({ date: '2026-05-31', weightKg: 78 }),
    ]
    expect(weightRateKgPerWeek(data, 14, ANCHOR)).toBeNull()
  })
  it('空陣列 → null', () => expect(weightRateKgPerWeek([], 30, ANCHOR)).toBeNull())
  it('days ≤ 0 → null', () => {
    const data = [
      e({ date: '2026-05-24', weightKg: 80 }),
      e({ date: '2026-05-31', weightKg: 79 }),
    ]
    expect(weightRateKgPerWeek(data, 0, ANCHOR)).toBeNull()
  })
})

// ============================================================
//  projectedGoalDate（達標預計日；反方向 / 速率 0 → null）
// ============================================================
describe('projectedGoalDate', () => {
  it('減重中：現 78.6、目標 75、-0.7kg/週 → 外推出日期', () => {
    // 14 日跌 1.4 → perDay -0.1；仲要跌 3.6kg → ceil(3.6/0.1)=36 日 → 2026-07-06
    const data = [
      e({ date: '2026-05-17', weightKg: 80 }),
      e({ date: '2026-05-31', weightKg: 78.6 }),
    ]
    const r = projectedGoalDate(data, 75, 30, ANCHOR)
    expect(r.rateKgPerWeek).toBe(-0.7)
    expect(r.daysAway).toBe(36)
    expect(r.dateKey).toBe('2026-07-06')
    expect(r.reached).toBe(false)
  })
  it('速率 0（體重持平）→ 全 null，唔亂推', () => {
    const data = [
      e({ date: '2026-05-17', weightKg: 78 }),
      e({ date: '2026-05-31', weightKg: 78 }),
    ]
    const r = projectedGoalDate(data, 75, 30, ANCHOR)
    expect(r.dateKey).toBeNull()
    expect(r.daysAway).toBeNull()
    expect(r.reached).toBe(false)
  })
  it('反方向（目標減重但體重在升）→ null，唔亂推', () => {
    const data = [
      e({ date: '2026-05-17', weightKg: 78 }),
      e({ date: '2026-05-31', weightKg: 79.4 }), // 升緊
    ]
    const r = projectedGoalDate(data, 75, 30, ANCHOR)
    expect(r.dateKey).toBeNull()
    expect(r.rateKgPerWeek).toBeNull()
  })
  it('已達標（current=target）→ reached，dateKey null', () => {
    const data = [
      e({ date: '2026-05-17', weightKg: 80 }),
      e({ date: '2026-05-31', weightKg: 75 }),
    ]
    const r = projectedGoalDate(data, 75, 30, ANCHOR)
    expect(r.reached).toBe(true)
    expect(r.dateKey).toBeNull()
  })
  it('缺目標 → 全 null', () => {
    const data = [
      e({ date: '2026-05-17', weightKg: 80 }),
      e({ date: '2026-05-31', weightKg: 78 }),
    ]
    expect(projectedGoalDate(data, undefined, 30, ANCHOR).dateKey).toBeNull()
  })
  it('無體重記錄 → 全 null', () => {
    expect(projectedGoalDate([], 75, 30, ANCHOR).dateKey).toBeNull()
  })
  it('得一筆體重（算唔到速率）→ null', () => {
    const r = projectedGoalDate([e({ date: '2026-05-31', weightKg: 78 })], 75, 30, ANCHOR)
    expect(r.dateKey).toBeNull()
  })
})

// ============================================================
//  recompSeries（脂肪 vs 瘦體重 雙線）
// ============================================================
describe('recompSeries', () => {
  it('逐日雙線；缺體脂嗰日兩線皆 null（斷點）', () => {
    const data = [
      e({ date: '2026-05-31', weightKg: 80, bodyFatPct: 20 }), // fat16 lean64
      e({ date: '2026-05-29', weightKg: 80 }), // 冇體脂 → null
    ]
    const r = recompSeries(data, 3, ANCHOR)
    expect(r).toEqual([
      { date: '2026-05-29', fat: null, lean: null },
      { date: '2026-05-30', fat: null, lean: null },
      { date: '2026-05-31', fat: 16, lean: 64 },
    ])
  })
  it('長度等於 days', () => {
    expect(recompSeries([], 14, ANCHOR)).toHaveLength(14)
  })
  it('days ≤ 0 → 空陣列', () => {
    expect(recompSeries([], 0, ANCHOR)).toEqual([])
    expect(recompSeries([], -5, ANCHOR)).toEqual([])
  })
  it('空資料 → 全 null', () => {
    const r = recompSeries([], 2, ANCHOR)
    expect(r).toEqual([
      { date: '2026-05-30', fat: null, lean: null },
      { date: '2026-05-31', fat: null, lean: null },
    ])
  })
})
