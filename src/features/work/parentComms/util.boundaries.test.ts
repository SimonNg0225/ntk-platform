import { describe, it, expect } from 'vitest'
import type { ParentComm } from '../../../data/types'
import {
  toKey,
  fromKey,
  shiftKey,
  weekdayOf,
  longDateLabel,
  shortDateLabel,
  monthLabel,
  relativeDayLabel,
  recentMonthKeys,
  followUpBucket,
  buildOverview,
  countByCategory,
  countByOutcome,
  summarizeByStudent,
  sortRows,
  type CommRow,
  type CommMeta,
} from './util'

// ============================================================
//  補充邊界測試（util.test.ts 未覆蓋嘅 case）
//  ------------------------------------------------------------
//  只測純函式 + 注入固定 anchor，絕不掂 DOM / React。
//  著重 util.test.ts 漏咗嘅邊界：fromKey 缺段 fallback、閏年、
//  星期六端、12 月 label、跨年 / 大日數 relativeDayLabel、
//  recentMonthKeys 31 號 anchor 唔跳月 + 大 n 跨多年、
//  followUpBucket 跨月 anchor、summarizeByStudent 亂序 / open-無日期、
//  sortRows 不可變 / 缺值 fallback / 空 / 單元素。
// ============================================================

const comm = (over: Partial<ParentComm> = {}): ParentComm => ({
  id: 'c',
  classId: 'k1',
  date: '2026-05-15',
  channel: '電話',
  summary: '',
  createdAt: '2026-05-15T08:00:00.000Z',
  ...over,
})

const meta = (over: Partial<CommMeta> = {}): CommMeta => ({
  id: 'm',
  commId: 'c',
  updatedAt: '2026-05-15T08:00:00.000Z',
  ...over,
})

const row = (c: Partial<ParentComm> = {}, m?: Partial<CommMeta>): CommRow => ({
  comm: comm(c),
  meta: m ? meta(m) : undefined,
})

// ============================================================
//  fromKey — 缺段 fallback + 閏年正午錨點
// ============================================================
describe('fromKey 缺段 fallback / 閏年', () => {
  it('缺日 → fallback day = 1（正午錨點）', () => {
    const d = fromKey('2026-07')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(6) // 0-based 7月
    expect(d.getDate()).toBe(1)
    expect(d.getHours()).toBe(12)
  })

  it('缺月同日 → fallback 月 = 1（getMonth 0）、日 = 1', () => {
    const d = fromKey('2026')
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(1)
    expect(d.getHours()).toBe(12)
  })

  it('閏年 2/29 roundtrip + 正午', () => {
    const d = fromKey('2024-02-29')
    expect(d.getMonth()).toBe(1)
    expect(d.getDate()).toBe(29)
    expect(d.getHours()).toBe(12)
    expect(toKey(d)).toBe('2024-02-29')
  })

  it('平年 2/28 roundtrip', () => {
    expect(toKey(fromKey('2026-02-28'))).toBe('2026-02-28')
  })
})

// ============================================================
//  shiftKey — 閏年 vs 平年 2 月底 + 跨年負數
// ============================================================
describe('shiftKey 閏年 / 跨年補充', () => {
  it('閏年 2/29 +1 = 3/1', () => expect(shiftKey('2024-02-29', 1)).toBe('2024-03-01'))
  it('跨年負數大跳（1/1 -1 = 上年 12/31）', () =>
    expect(shiftKey('2026-01-01', -1)).toBe('2025-12-31'))
  it('跨多年負數（2026-01-01 -366 = 2024-12-31，因 2025 平年）', () =>
    expect(shiftKey('2026-01-01', -366)).toBe('2024-12-31'))
})

// ============================================================
//  weekdayOf — 星期六端 + 跨年首日
// ============================================================
describe('weekdayOf 星期六端 / 跨年', () => {
  it('星期六（2026-05-30 = 六）', () => expect(weekdayOf('2026-05-30')).toBe('六'))
  it('跨年首日（2025-01-01 = 三）', () => expect(weekdayOf('2025-01-01')).toBe('三'))
})

// ============================================================
//  longDateLabel / shortDateLabel / monthLabel — 12 月 + 個位數
// ============================================================
describe('日期 label 補充邊界', () => {
  it('longDateLabel 12 月（getMonth+1 無補零）', () =>
    expect(longDateLabel('2026-12-25')).toBe('12月25日（星期五）'))
  it('longDateLabel 個位數月日', () =>
    expect(longDateLabel('2026-09-09')).toBe('9月9日（星期三）'))
  it('shortDateLabel 個位數', () => expect(shortDateLabel('2026-09-09')).toBe('9/9'))
  it('monthLabel 補零輸入 → 無補零輸出', () =>
    expect(monthLabel('2026-09')).toBe('2026年9月'))
})

// ============================================================
//  relativeDayLabel — 跨年 + 大正 / 負日數
// ============================================================
describe('relativeDayLabel 跨年 / 大日數', () => {
  it('跨年明日（2025-12-31 → 2026-01-01）', () =>
    expect(relativeDayLabel('2026-01-01', '2025-12-31')).toBe('明日'))
  it('跨年昨日（2026-01-01 → 2025-12-31）', () =>
    expect(relativeDayLabel('2025-12-31', '2026-01-01')).toBe('昨日'))
  it('大正日數（+30 日後）', () =>
    expect(relativeDayLabel('2026-06-14', '2026-05-15')).toBe('30 日後'))
  it('大負日數（-31 日前，跨月）', () =>
    expect(relativeDayLabel('2026-04-14', '2026-05-15')).toBe('31 日前'))
})

// ============================================================
//  recentMonthKeys — 31 號 anchor 唔跳月 + 大 n 跨多年
// ============================================================
describe('recentMonthKeys 補充邊界', () => {
  it('anchor 喺 31 號唔會跳月（day 固定 1）', () => {
    // 1/31 anchor 倒數 2 個月：若用 anchor 原本 day=31，去到 2 月會溢位跳 3 月；
    // 實作用 day=1，所以正確係 2025-12 / 2026-01。
    expect(recentMonthKeys(2, new Date(2026, 0, 31))).toEqual(['2025-12', '2026-01'])
  })

  it('大 n 跨多年（n=14，由 2026-02 倒數）', () => {
    const keys = recentMonthKeys(14, new Date(2026, 1, 15))
    expect(keys).toHaveLength(14)
    expect(keys[0]).toBe('2025-01') // 14 個月前（含當月）
    expect(keys[keys.length - 1]).toBe('2026-02')
  })
})

// ============================================================
//  followUpBucket — 跨月 anchor（月底 +7 跨入下月）
// ============================================================
describe('followUpBucket 跨月 anchor', () => {
  const anchor = '2026-05-28' // +7 = 2026-06-04（跨月）
  it('anchor+7 跨月仍 soon（含入上界）', () =>
    expect(followUpBucket('2026-06-04', anchor)).toBe('soon'))
  it('anchor+8 跨月 → later', () =>
    expect(followUpBucket('2026-06-05', anchor)).toBe('later'))
  it('跨月前一日 → overdue', () =>
    expect(followUpBucket('2026-05-27', anchor)).toBe('overdue'))
})

// ============================================================
//  buildOverview — 已完成(followUp=false) 即使有逾期日都唔計 overdue
// ============================================================
describe('buildOverview 補充：已完成唔計 overdue', () => {
  const anchor = '2026-05-15'
  it('followUp=false 即使到期日逾期，overdue / openFollowUps 都係 0', () => {
    const rows: CommRow[] = [
      row({ followUp: false }, { followUpDate: '2026-01-01' }), // 早就過期但已完成
    ]
    const o = buildOverview(rows, anchor)
    expect(o.openFollowUps).toBe(0)
    expect(o.overdue).toBe(0)
  })

  it('本月邊界：anchor 當月最後一日記錄計入 thisMonth', () => {
    const o = buildOverview([row({ date: '2026-05-31' })], anchor)
    expect(o.thisMonth).toBe(1)
    expect(o.lastMonth).toBe(0)
  })
})

// ============================================================
//  countByCategory — 全部 unset 合併
// ============================================================
describe('countByCategory 補充：全部 unset', () => {
  it('全部無分類 → 單一 unset', () => {
    const rows: CommRow[] = [row({}), row({}, {}), row({})]
    expect(countByCategory(rows)).toEqual([{ key: 'unset', label: '未分類', count: 3 }])
  })
})

// ============================================================
//  countByOutcome — 只有部分 outcome 出現
// ============================================================
describe('countByOutcome 補充：部分 outcome', () => {
  it('只有 neutral 出現，其餘鍵仍係 0', () => {
    expect(countByOutcome([row({}, { outcome: 'neutral' })])).toEqual({
      positive: 0,
      neutral: 1,
      concern: 0,
    })
  })
})

// ============================================================
//  summarizeByStudent — 亂序 lastDate / open-無日期 / 動態 outcome 鍵
// ============================================================
describe('summarizeByStudent 補充邊界', () => {
  it('亂序輸入 lastDate 仍取最大', () => {
    const rows: CommRow[] = [
      row({ studentId: 's1', date: '2026-05-20' }),
      row({ studentId: 's1', date: '2026-05-31' }), // 最大
      row({ studentId: 's1', date: '2026-05-10' }),
    ]
    expect(summarizeByStudent(rows).get('s1')!.lastDate).toBe('2026-05-31')
  })

  it('open 但無到期日：計入 openFollowUps 但 nextFollowUp 維持 undefined', () => {
    const rows: CommRow[] = [
      row({ studentId: 's1', followUp: true }), // 無 followUpDate
      row({ studentId: 's1', followUp: true }, { followUpDate: '2026-06-01' }),
    ]
    const s = summarizeByStudent(rows).get('s1')!
    expect(s.openFollowUps).toBe(2)
    expect(s.nextFollowUp).toBe('2026-06-01')
  })

  it('完全冇到期日嘅 open：nextFollowUp 為 undefined', () => {
    const s = summarizeByStudent([row({ studentId: 's1', followUp: true })]).get('s1')!
    expect(s.openFollowUps).toBe(1)
    expect(s.nextFollowUp).toBeUndefined()
  })

  it('動態 outcome 鍵累加（neutral）', () => {
    const rows: CommRow[] = [
      row({ studentId: 's1' }, { outcome: 'neutral' }),
      row({ studentId: 's1' }, { outcome: 'neutral' }),
    ]
    const s = summarizeByStudent(rows).get('s1')!
    expect(s.neutral).toBe(2)
    expect(s.positive).toBe(0)
    expect(s.concern).toBe(0)
  })
})

// ============================================================
//  sortRows — 空 / 單元素 / 缺 followUpDate fallback / category 用 enum 原文
// ============================================================
describe('sortRows 補充邊界', () => {
  const name = (r: CommRow) => r.comm.id

  it('空陣列 → 空（仍係新 array）', () => {
    const empty: CommRow[] = []
    const out = sortRows(empty, 'date', 'asc', name)
    expect(out).toEqual([])
    expect(out).not.toBe(empty)
  })

  it('單元素 → 原樣（新 array）', () => {
    const one = [row({ id: 'x' })]
    expect(sortRows(one, 'date', 'asc', name).map((r) => r.comm.id)).toEqual(['x'])
  })

  it('followUp 同為 true 時：缺 followUpDate（fallback zzzz）排最後', () => {
    const rows = [
      row({ id: 'nodate', followUp: true }), // 無 followUpDate → zzzz
      row({ id: 'early', followUp: true }, { followUpDate: '2026-05-01' }),
    ]
    expect(sortRows(rows, 'followUp', 'asc', name).map((r) => r.comm.id)).toEqual([
      'early',
      'nodate',
    ])
  })

  it('date 同日 + 同 createdAt：用 fallbackName 穩定 tiebreak', () => {
    const rows = [
      row({ id: 'b', date: '2026-05-01', createdAt: '2026-05-01T08:00:00Z' }),
      row({ id: 'a', date: '2026-05-01', createdAt: '2026-05-01T08:00:00Z' }),
    ]
    // createdAt 相同 → 落到 fallbackName(id) tiebreak，asc 之下 a < b
    expect(sortRows(rows, 'date', 'asc', name).map((r) => r.comm.id)).toEqual(['a', 'b'])
  })

  it('category 比較用 enum 原文（attendance < behaviour，非中文 label 排序）', () => {
    // 中文 label：出席 / 行為；但排序係按 enum 原文 attendance / behaviour。
    // attendance < behaviour（字母序），故 asc 之下 attendance 行先。
    const rows = [
      row({ id: 'beh' }, { category: 'behaviour' }),
      row({ id: 'att' }, { category: 'attendance' }),
    ]
    expect(sortRows(rows, 'category', 'asc', name).map((r) => r.comm.id)).toEqual([
      'att',
      'beh',
    ])
  })

  it('channel 排序（localeCompare）+ desc 反向', () => {
    const rows = [
      row({ id: 'a', channel: '電郵' }),
      row({ id: 'b', channel: '電話' }),
    ]
    const asc = sortRows(rows, 'channel', 'asc', name).map((r) => r.comm.id)
    const desc = sortRows(rows, 'channel', 'desc', name).map((r) => r.comm.id)
    expect(desc).toEqual([...asc].reverse())
  })
})
