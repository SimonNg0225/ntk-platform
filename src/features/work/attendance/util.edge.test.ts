import { describe, it, expect } from 'vitest'
import {
  isExcused,
  toKey,
  fromKey,
  weekdayOf,
  isWeekend,
  longDateLabel,
  shortDateLabel,
  shiftKey,
  monthDays,
  recentDayKeys,
  monthLabel,
  countDay,
  tallyByStudent,
  rateTone,
  rateBarTone,
} from './util'
import type { AttendanceRecord, AttendanceStatus } from '../../../data/types'

// ============================================================
//  attendance util — 補充邊界 case（第一階段審查列出但 util.test.ts 未覆蓋）
//  - 唔重複 util.test.ts 已有嘅斷言；只補欠缺嘅 edge
//  - 全部純函式、零 DOM、零 React
// ============================================================

const mkStatus = (entries: [string, AttendanceStatus][]) =>
  new Map<string, AttendanceStatus>(entries)

const rec = (
  studentId: string,
  date: string,
  status: AttendanceStatus,
): AttendanceRecord => ({ id: `${studentId}-${date}-${status}`, classId: 'c1', studentId, date, status })

// ───────── isExcused（official 個別確認）─────────
describe('isExcused — 公假 official 明確准假', () => {
  it('official → true（避免日後誤改成只認 sick/personal）', () => {
    expect(isExcused('official')).toBe(true)
  })
})

// ───────── countDay — 補欠缺邊界 ─────────
describe('countDay — 補充邊界', () => {
  it('只有 late、無 present：late 計入出席 → rate = 100', () => {
    const m = mkStatus([
      ['a', 'late'],
      ['b', 'late'],
    ])
    const r = countDay(m, 2)
    expect(r).toEqual({
      present: 0,
      late: 2,
      absent: 0,
      unmarked: 0,
      total: 2,
      rate: 100,
    })
  })

  it('全部 absent → rate = 0（缺席唔計入出席，但仍係已標記，分母非 0）', () => {
    const m = mkStatus([
      ['a', 'absent'],
      ['b', 'absent'],
      ['c', 'absent'],
    ])
    const r = countDay(m, 3)
    expect(r.rate).toBe(0)
    expect(r.absent).toBe(3)
    expect(r.unmarked).toBe(0)
  })

  it('四捨五入 half-up：5 出席 / 8 marked = 62.5 → 63', () => {
    const m = mkStatus([
      ['a', 'present'],
      ['b', 'present'],
      ['c', 'present'],
      ['d', 'present'],
      ['e', 'late'], // present+late = 5
      ['f', 'absent'],
      ['g', 'absent'],
      ['h', 'absent'], // marked = 8
    ])
    expect(countDay(m, 8).rate).toBe(63)
  })

  it('全 0 + total = 0 唔會除零變 NaN（rate 嚴格 === null）', () => {
    const r = countDay(new Map(), 0)
    expect(r.rate).toBeNull()
    expect(Number.isNaN(r.rate as unknown as number)).toBe(false)
  })
})

// ───────── tallyByStudent — 補欠缺邊界 ─────────
describe('tallyByStudent — 補充邊界', () => {
  it('空名單（studentIds = []）→ size 0', () => {
    expect(tallyByStudent([rec('s1', '2026-05-01', 'present')], [], ['2026-05-01']).size).toBe(0)
  })

  it('連續缺席：最新一日係未標記（gap）仍往前數連續 absent', () => {
    // 真實最新日 05-04 無記錄 → 跳過；05-03 absent、05-02 absent、05-01 present → streak = 2
    const days = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04']
    const records = [
      rec('s1', '2026-05-01', 'present'),
      rec('s1', '2026-05-02', 'absent'),
      rec('s1', '2026-05-03', 'absent'),
      // 05-04 故意冇記錄
    ]
    expect(tallyByStudent(records, ['s1'], days).get('s1')!.currentAbsentStreak).toBe(2)
  })

  it('全部 absent：streak = 已標記日數', () => {
    const days = ['2026-05-01', '2026-05-02', '2026-05-03']
    const records = [
      rec('s1', '2026-05-01', 'absent'),
      rec('s1', '2026-05-02', 'absent'),
      rec('s1', '2026-05-03', 'absent'),
    ]
    const t = tallyByStudent(records, ['s1'], days).get('s1')!
    expect(t.absent).toBe(3)
    expect(t.marked).toBe(3)
    expect(t.currentAbsentStreak).toBe(3)
  })

  it('連續缺席：中間未標記日跳過唔斷，但遇 late 即停', () => {
    // 05-05 absent、05-04 gap（跳過）、05-03 absent、05-02 late（停）、05-01 absent
    // → streak 由最新數：absent, (skip), absent, 撞 late 停 = 2
    const days = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05']
    const records = [
      rec('s1', '2026-05-01', 'absent'),
      rec('s1', '2026-05-02', 'late'),
      rec('s1', '2026-05-03', 'absent'),
      rec('s1', '2026-05-05', 'absent'),
    ]
    expect(tallyByStudent(records, ['s1'], days).get('s1')!.currentAbsentStreak).toBe(2)
  })

  it('rate 四捨五入邊界：5 出席 / 8 marked = 62.5 → 63', () => {
    const days = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8']
    const records = [
      rec('s1', 'd1', 'present'),
      rec('s1', 'd2', 'present'),
      rec('s1', 'd3', 'present'),
      rec('s1', 'd4', 'present'),
      rec('s1', 'd5', 'late'), // 出席 5
      rec('s1', 'd6', 'absent'),
      rec('s1', 'd7', 'absent'),
      rec('s1', 'd8', 'absent'), // marked 8
    ]
    expect(tallyByStudent(records, ['s1'], days).get('s1')!.rate).toBe(63)
  })

  it('同日同生重複記錄：Map 後寫覆蓋前寫（唔會重複計）', () => {
    const days = ['2026-05-01', '2026-05-02']
    // 05-01 先 absent 後 present → 應只當 present；marked 唔會變 2
    const records = [
      rec('s1', '2026-05-01', 'absent'),
      rec('s1', '2026-05-01', 'present'), // 覆蓋上一筆
      rec('s1', '2026-05-02', 'present'),
    ]
    const t = tallyByStudent(records, ['s1'], days).get('s1')!
    expect(t.marked).toBe(2)
    expect(t.present).toBe(2)
    expect(t.absent).toBe(0)
    expect(t.currentAbsentStreak).toBe(0)
  })

  it('多名學生各自獨立彙總', () => {
    const days = ['2026-05-01', '2026-05-02']
    const records = [
      rec('s1', '2026-05-01', 'present'),
      rec('s1', '2026-05-02', 'present'),
      rec('s2', '2026-05-01', 'absent'),
      rec('s2', '2026-05-02', 'absent'),
    ]
    const out = tallyByStudent(records, ['s1', 's2'], days)
    expect(out.get('s1')!.rate).toBe(100)
    expect(out.get('s1')!.currentAbsentStreak).toBe(0)
    expect(out.get('s2')!.rate).toBe(0)
    expect(out.get('s2')!.currentAbsentStreak).toBe(2)
  })
})

// ───────── recentDayKeys — 補欠缺邊界 ─────────
describe('recentDayKeys — 補充邊界', () => {
  it('跨年邊界：anchor 2026-01-02 倒數 3 日含 2025-12-31', () => {
    expect(recentDayKeys(3, '2026-01-02')).toEqual([
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
    ])
  })

  it('跨閏年 2 月：2024-03-01 倒數 3 日含 02-29', () => {
    expect(recentDayKeys(3, '2024-03-01')).toEqual([
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
    ])
  })

  it('大 n（90）：長度正確、頭尾正確、由舊到新', () => {
    const ks = recentDayKeys(90, '2026-05-31')
    expect(ks.length).toBe(90)
    expect(ks[89]).toBe('2026-05-31') // 最後 = anchor
    expect(ks[0]).toBe(shiftKey('2026-05-31', -89)) // 最舊
    // 確認嚴格遞增
    expect([...ks].sort()).toEqual(ks)
  })
})

// ───────── monthDays — 補欠缺邊界 ─────────
describe('monthDays — 補充邊界', () => {
  it('30 日月（4 月 = month 3）首尾正確', () => {
    const days = monthDays(2026, 3)
    expect(days.length).toBe(30)
    expect(days[0]).toBe('2026-04-01')
    expect(days[29]).toBe('2026-04-30')
  })

  it('12 月（month = 11）唔越界到下一年', () => {
    const days = monthDays(2026, 11)
    expect(days.length).toBe(31)
    expect(days[0]).toBe('2026-12-01')
    expect(days[30]).toBe('2026-12-31')
  })

  it('閏年 2 月（month = 1）首尾 = 01 / 29', () => {
    const days = monthDays(2024, 1)
    expect(days[0]).toBe('2024-02-01')
    expect(days[days.length - 1]).toBe('2024-02-29')
  })
})

// ───────── shiftKey — 補欠缺：大跨度 ─────────
describe('shiftKey — 大跨度 ±30 / ±90', () => {
  it('+30 跨月', () => {
    expect(shiftKey('2026-05-01', 30)).toBe('2026-05-31')
  })
  it('-30 跨月', () => {
    expect(shiftKey('2026-05-31', -30)).toBe('2026-05-01')
  })
  it('+90 連跨多月（與逐日比對）', () => {
    expect(shiftKey('2026-05-31', 90)).toBe('2026-08-29')
  })
  it('-90 連跨多月', () => {
    expect(shiftKey('2026-05-31', -90)).toBe('2026-03-02')
  })
})

// ───────── fromKey — 補欠缺：閏日 + fallback ─────────
describe('fromKey — 補充邊界', () => {
  it('閏日 02-29 正確（年/0-indexed 月/日）', () => {
    const d = fromKey('2024-02-29')
    expect(d.getFullYear()).toBe(2024)
    expect(d.getMonth()).toBe(1)
    expect(d.getDate()).toBe(29)
  })
  it('缺日 → fallback 為 1 號（month 仍正確）', () => {
    const d = fromKey('2026-07')
    expect(d.getMonth()).toBe(6) // 7 月
    expect(d.getDate()).toBe(1)
  })
  it('正午建構：唔受 DST/TZ 邊界影響，roundtrip 穩定', () => {
    expect(toKey(fromKey('2024-02-29'))).toBe('2024-02-29')
    expect(fromKey('2026-05-04').getHours()).toBe(12)
  })
})

// ───────── weekdayOf / isWeekend — 補欠缺 ─────────
describe('weekdayOf / isWeekend — 補充邊界', () => {
  it('閏日 2024-02-29 = 星期四', () => {
    expect(weekdayOf('2024-02-29')).toBe('四')
  })
  it('閏年後日子 2024-03-01 = 星期五（非週末）', () => {
    expect(weekdayOf('2024-03-01')).toBe('五')
    expect(isWeekend('2024-03-01')).toBe(false)
  })
  it('星期五 vs 星期六 邊界（連續兩日）', () => {
    expect(isWeekend('2026-05-08')).toBe(false) // 五
    expect(isWeekend('2026-05-09')).toBe(true) // 六
  })
})

// ───────── toKey — 補欠缺：跨年 + 個位數補零 ─────────
describe('toKey — 補充邊界', () => {
  it('跨年 12-31 / 01-01 + 個位數月日補零', () => {
    expect(toKey(new Date(2025, 11, 31, 12))).toBe('2025-12-31')
    expect(toKey(new Date(2026, 0, 1, 12))).toBe('2026-01-01')
    expect(toKey(new Date(2026, 2, 5, 12))).toBe('2026-03-05') // 月、日都補零
  })
})

// ───────── 顯示 label — 補欠缺 ─────────
describe('longDateLabel / shortDateLabel / monthLabel — 補充邊界', () => {
  it('long：個位數月日唔補零（顯示用），跨年日星期正確', () => {
    expect(longDateLabel('2026-01-01')).toBe('1月1日（星期四）')
  })
  it('short：雙位數 12/31', () => {
    expect(shortDateLabel('2026-12-31')).toBe('12/31')
  })
  it('monthLabel：month 0 → 1月、month 5 → 6月', () => {
    expect(monthLabel(2026, 5)).toBe('2026年6月')
  })
})

// ───────── rateTone / rateBarTone — 補欠缺：100 / null 差異 ─────────
describe('rateTone / rateBarTone — 補充邊界', () => {
  it('100% → green（兩者一致）', () => {
    expect(rateTone(100)).toBe('green')
    expect(rateBarTone(100)).toBe('green')
  })
  it('null 兩者差異：rateTone slate vs rateBarTone accent', () => {
    expect(rateTone(null)).toBe('slate')
    expect(rateBarTone(null)).toBe('accent')
  })
  it('rateBarTone 邊界 95 / 90 / 80 / 79', () => {
    expect(rateBarTone(95)).toBe('green')
    expect(rateBarTone(94)).toBe('accent')
    expect(rateBarTone(90)).toBe('accent')
    expect(rateBarTone(89)).toBe('amber')
    expect(rateBarTone(80)).toBe('amber')
    expect(rateBarTone(79)).toBe('rose')
  })
})

// ============================================================
//  疑似 bug #1（[low]）— TrendChart「期內平均出席率」(unweighted avg of
//  daily rates) vs Attendance「整體出席率」(pooled by person-session) 基數不同
//  ------------------------------------------------------------
//  複查結論：兩者各自運算「就佢自己 label 而言」都係正確；分歧源自
//  「每日一票嘅平均」vs「按人次匯總」兩種統計口徑本身定義唔同，屬刻意
//  設計（label 已分別措辭：期內平均 vs 整體）。
//
//  - TrendChart 嘅 avg 係 inline 喺 JSX component body（TrendChart.tsx:77-79），
//    且 TrendChart.tsx 屬唔可改檔；無法純測亦唔應硬抽 → 唔改 source。
//  - Attendance 嘅 overall.rate 係 inline 喺 useMemo（Attendance.tsx:889-902），
//    同樣非 top-level 純函式。
//
//  以下用可純測嘅 countDay 重現兩種口徑嘅算式，鎖死「pooled 口徑」嘅正確
//  行為（即 overall.rate 應有嘅值），並文件化兩者點解可以分歧，方便日後
//  維護者明白呢個係已知差異而非新 bug。
// ============================================================
describe('出席率口徑：pooled（countDay 匯總）vs unweighted average — 已知差異', () => {
  // 重現審查例子：Day1 得 1 人 present(rate 100%)、Day2 有 10 人其中 5 present(rate 50%)
  const day1 = countDay(mkStatus([['a', 'present']]), 1)
  const day2 = countDay(
    mkStatus([
      ['a', 'present'],
      ['b', 'present'],
      ['c', 'present'],
      ['d', 'present'],
      ['e', 'present'],
      ['f', 'absent'],
      ['g', 'absent'],
      ['h', 'absent'],
      ['i', 'absent'],
      ['j', 'absent'],
    ]),
    10,
  )

  it('每日 rate 各自正確（100% 同 50%）', () => {
    expect(day1.rate).toBe(100)
    expect(day2.rate).toBe(50)
  })

  it('unweighted average（TrendChart avg 口徑）= 每日 rate 平均 = 75%', () => {
    const dailyRates = [day1.rate, day2.rate].filter((r): r is number => r != null)
    const avg = Math.round(dailyRates.reduce((s, r) => s + r, 0) / dailyRates.length)
    expect(avg).toBe(75)
  })

  it('pooled（overall.rate 口徑：Σ出席人次 / Σmarked）= (1+5)/(1+10) = 55%', () => {
    const totPresentLate = day1.present + day1.late + (day2.present + day2.late)
    const totMarked =
      day1.present + day1.late + day1.absent + (day2.present + day2.late + day2.absent)
    const pooled = Math.round((totPresentLate / totMarked) * 100)
    expect(pooled).toBe(55)
    // 證實兩口徑相差 20 個百分點（呢個就係審查指出嘅分歧，屬刻意設計）
    expect(Math.abs(75 - pooled)).toBe(20)
  })

  it('當每日人數一致時兩口徑收斂（無分歧）', () => {
    // 兩日各 4 人、各 3 出席 → 每日 rate 75；pooled = 6/8 = 75 → 一致
    const d1 = countDay(
      mkStatus([
        ['a', 'present'],
        ['b', 'present'],
        ['c', 'present'],
        ['d', 'absent'],
      ]),
      4,
    )
    const d2 = countDay(
      mkStatus([
        ['a', 'present'],
        ['b', 'present'],
        ['c', 'present'],
        ['d', 'absent'],
      ]),
      4,
    )
    const avg = Math.round(((d1.rate ?? 0) + (d2.rate ?? 0)) / 2)
    const pooled = Math.round(
      ((d1.present + d1.late + d2.present + d2.late) /
        (d1.present + d1.late + d1.absent + d2.present + d2.late + d2.absent)) *
        100,
    )
    expect(avg).toBe(75)
    expect(pooled).toBe(75)
    expect(avg).toBe(pooled)
  })
})
