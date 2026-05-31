import { describe, it, expect } from 'vitest'
import type { ParentComm } from '../../../data/types'
import {
  toKey,
  fromKey,
  shiftKey,
  monthKeyOf,
  weekdayOf,
  longDateLabel,
  shortDateLabel,
  monthLabel,
  relativeDayLabel,
  recentMonthKeys,
  followUpBucket,
  buildOverview,
  countByChannel,
  countByCategory,
  countByOutcome,
  monthlyTrend,
  summarizeByStudent,
  sortRows,
  type CommRow,
  type CommMeta,
} from './util'

// ───────── 測試資料工廠 ─────────
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
//  日期工具（本地時區，無 UTC off-by-one）
// ============================================================
describe('toKey / fromKey（本地時區）', () => {
  it('toKey 由本地年月日組成，補零', () => {
    expect(toKey(new Date(2026, 0, 1, 12))).toBe('2026-01-01')
    expect(toKey(new Date(2026, 11, 31, 12))).toBe('2026-12-31')
    expect(toKey(new Date(2026, 8, 9, 12))).toBe('2026-09-09') // 月日都補零
  })

  it('roundtrip：toKey(fromKey(key)) 永遠等於原 key（無時區漂移）', () => {
    // fromKey 用本地年月日 + 正午錨點建立 Date，再用本地年月日讀出，
    // 所以無論機器喺邊個時區，邊界日子（1月1日 / 12月31日）都唔會 off-by-one。
    expect(toKey(fromKey('2026-01-01'))).toBe('2026-01-01')
    expect(toKey(fromKey('2026-12-31'))).toBe('2026-12-31')
    expect(toKey(fromKey('2026-05-15'))).toBe('2026-05-15')
    expect(toKey(fromKey('2025-02-28'))).toBe('2025-02-28')
  })

  it('fromKey 解析正確（本地正午，避開夏令時 / UTC 邊界）', () => {
    const d = fromKey('2026-05-04')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4) // 0-based：5月
    expect(d.getDate()).toBe(4)
    expect(d.getHours()).toBe(12) // 正午錨點
  })
})

describe('shiftKey（加減日子，含月 / 年 / 閏年邊界）', () => {
  it('0 日 = 原日', () => expect(shiftKey('2026-05-15', 0)).toBe('2026-05-15'))
  it('正常加減', () => {
    expect(shiftKey('2026-05-15', 7)).toBe('2026-05-22')
    expect(shiftKey('2026-05-15', -5)).toBe('2026-05-10')
  })
  it('跨月（月尾 +1）', () => expect(shiftKey('2026-05-31', 1)).toBe('2026-06-01'))
  it('跨年（年頭 -1）', () => expect(shiftKey('2026-01-01', -1)).toBe('2025-12-31'))
  it('閏年 2 月底（2024 閏年）', () =>
    expect(shiftKey('2024-02-28', 1)).toBe('2024-02-29'))
  it('平年 2 月底（2026 平年）', () =>
    expect(shiftKey('2026-02-28', 1)).toBe('2026-03-01'))
})

describe('monthKeyOf / weekdayOf / 日期 label', () => {
  it('monthKeyOf 取 YYYY-MM', () => {
    expect(monthKeyOf('2026-05-15')).toBe('2026-05')
    expect(monthKeyOf('2026-12-01')).toBe('2026-12')
  })

  it('weekdayOf（人手核對：2026-05-04 = 星期一）', () => {
    expect(weekdayOf('2026-05-04')).toBe('一')
    expect(weekdayOf('2026-05-31')).toBe('日') // 星期日
    expect(weekdayOf('2026-05-01')).toBe('五') // 星期五
    expect(weekdayOf('2026-01-01')).toBe('四') // 星期四
  })

  it('longDateLabel', () =>
    expect(longDateLabel('2026-05-04')).toBe('5月4日（星期一）'))

  it('shortDateLabel（無補零）', () => {
    expect(shortDateLabel('2026-05-04')).toBe('5/4')
    expect(shortDateLabel('2026-12-31')).toBe('12/31')
  })

  it('monthLabel', () => {
    expect(monthLabel('2026-05')).toBe('2026年5月') // 月無補零
    expect(monthLabel('2026-12')).toBe('2026年12月')
  })
})

describe('relativeDayLabel（傳固定 anchor，deterministic）', () => {
  const anchor = '2026-05-15'
  it('今日', () => expect(relativeDayLabel('2026-05-15', anchor)).toBe('今日'))
  it('明日', () => expect(relativeDayLabel('2026-05-16', anchor)).toBe('明日'))
  it('昨日', () => expect(relativeDayLabel('2026-05-14', anchor)).toBe('昨日'))
  it('N 日前', () => expect(relativeDayLabel('2026-05-10', anchor)).toBe('5 日前'))
  it('N 日後', () => expect(relativeDayLabel('2026-05-20', anchor)).toBe('5 日後'))
  it('跨月仍正確（正午錨點，無 DST off-by-one）', () => {
    // 5/31 → 6/1 應該係「1 日後」，唔可以因為時區 / 夏令時變 0 或 2
    expect(relativeDayLabel('2026-06-01', '2026-05-31')).toBe('明日')
    expect(relativeDayLabel('2026-05-31', '2026-06-01')).toBe('昨日')
  })
})

describe('recentMonthKeys（傳固定 anchor）', () => {
  it('由舊到新，含當月', () => {
    expect(recentMonthKeys(3, new Date(2026, 4, 15))).toEqual([
      '2026-03',
      '2026-04',
      '2026-05',
    ])
  })
  it('跨年向後（Jan anchor 倒數）', () => {
    expect(recentMonthKeys(3, new Date(2026, 0, 15))).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
    ])
  })
  it('n = 1 只得當月', () =>
    expect(recentMonthKeys(1, new Date(2026, 6, 1))).toEqual(['2026-07']))
  it('n = 0 → 空陣列', () =>
    expect(recentMonthKeys(0, new Date(2026, 6, 1))).toEqual([]))
})

// ============================================================
//  跟進管道分桶
// ============================================================
describe('followUpBucket（傳固定 anchor）', () => {
  const anchor = '2026-05-15'
  it('無日期 → nodate', () => expect(followUpBucket(undefined, anchor)).toBe('nodate'))
  it('過去 → overdue', () => expect(followUpBucket('2026-05-14', anchor)).toBe('overdue'))
  it('當日 → today', () => expect(followUpBucket('2026-05-15', anchor)).toBe('today'))
  it('7 日內 → soon（邊界 anchor+7 含入）', () => {
    expect(followUpBucket('2026-05-16', anchor)).toBe('soon')
    expect(followUpBucket('2026-05-22', anchor)).toBe('soon') // anchor + 7，含入
  })
  it('超過 7 日 → later（anchor+8）', () =>
    expect(followUpBucket('2026-05-23', anchor)).toBe('later'))
})

// ============================================================
//  統計 buildOverview
// ============================================================
describe('buildOverview（傳固定 anchor = 2026-05-15）', () => {
  const anchor = '2026-05-15'

  it('空陣列：全 0，positiveRate = null', () => {
    expect(buildOverview([], anchor)).toEqual({
      total: 0,
      thisMonth: 0,
      lastMonth: 0,
      openFollowUps: 0,
      overdue: 0,
      positiveRate: null,
      contactedStudents: 0,
    })
  })

  it('本月 / 上月計數（anchor=2026-05 → 上月=2026-04）', () => {
    const rows: CommRow[] = [
      row({ date: '2026-05-01' }), // 本月
      row({ date: '2026-05-31' }), // 本月
      row({ date: '2026-04-30' }), // 上月
      row({ date: '2026-03-15' }), // 更早，兩者都唔計
    ]
    const o = buildOverview(rows, anchor)
    expect(o.total).toBe(4)
    expect(o.thisMonth).toBe(2)
    expect(o.lastMonth).toBe(1)
  })

  it('跨年上月（anchor=2026-01-10 → 上月=2025-12）', () => {
    const rows: CommRow[] = [
      row({ date: '2026-01-05' }),
      row({ date: '2025-12-20' }),
    ]
    const o = buildOverview(rows, '2026-01-10')
    expect(o.thisMonth).toBe(1)
    expect(o.lastMonth).toBe(1)
  })

  it('openFollowUps 同 overdue（只有 followUp=true 先計）', () => {
    const rows: CommRow[] = [
      row({ followUp: true }, { followUpDate: '2026-05-10' }), // 逾期
      row({ followUp: true }, { followUpDate: '2026-05-20' }), // 未到期
      row({ followUp: true }), // 無到期日 → bucket=nodate，唔算 overdue
      row({ followUp: false }, { followUpDate: '2026-01-01' }), // 已完成，唔計
    ]
    const o = buildOverview(rows, anchor)
    expect(o.openFollowUps).toBe(3)
    expect(o.overdue).toBe(1)
  })

  it('positiveRate = 正面 / 有觀感 × 100，四捨五入', () => {
    const rows: CommRow[] = [
      row({}, { outcome: 'positive' }),
      row({}, { outcome: 'positive' }),
      row({}, { outcome: 'concern' }),
      row({}, {}), // 無 outcome，唔入分母
    ]
    // 2 / 3 = 66.67% → round → 67
    expect(buildOverview(rows, anchor).positiveRate).toBe(67)
  })

  it('contactedStudents 去重，無 studentId 唔算', () => {
    const rows: CommRow[] = [
      row({ studentId: 's1' }),
      row({ studentId: 's1' }), // 重複
      row({ studentId: 's2' }),
      row({ studentId: undefined }), // 無學生
    ]
    expect(buildOverview(rows, anchor).contactedStudents).toBe(2)
  })
})

// ============================================================
//  分組計數
// ============================================================
describe('countByChannel（按數量降序）', () => {
  it('空 → 空陣列', () => expect(countByChannel([])).toEqual([]))
  it('計數並按 count 降序', () => {
    const rows: CommRow[] = [
      row({ channel: '電話' }),
      row({ channel: '電話' }),
      row({ channel: '電郵' }),
      row({ channel: '面談' }),
      row({ channel: '面談' }),
      row({ channel: '面談' }),
    ]
    expect(countByChannel(rows)).toEqual([
      { key: '面談', label: '面談', count: 3 },
      { key: '電話', label: '電話', count: 2 },
      { key: '電郵', label: '電郵', count: 1 },
    ])
  })
})

describe('countByCategory（未分類 fallback unset）', () => {
  it('空 → 空陣列', () => expect(countByCategory([])).toEqual([]))
  it('有分類 + 未分類，降序', () => {
    const rows: CommRow[] = [
      row({}, { category: 'academic' }),
      row({}, { category: 'academic' }),
      row({}), // 無 meta → unset
      row({}, {}), // 有 meta 但無 category → unset
    ]
    expect(countByCategory(rows)).toEqual([
      { key: 'academic', label: '學業', count: 2 },
      { key: 'unset', label: '未分類', count: 2 },
    ])
  })
})

describe('countByOutcome（固定三鍵）', () => {
  it('空 → 全 0', () =>
    expect(countByOutcome([])).toEqual({ positive: 0, neutral: 0, concern: 0 }))
  it('計數，無 outcome 唔影響', () => {
    const rows: CommRow[] = [
      row({}, { outcome: 'positive' }),
      row({}, { outcome: 'positive' }),
      row({}, { outcome: 'concern' }),
      row({}), // 無 meta
    ]
    expect(countByOutcome(rows)).toEqual({ positive: 2, neutral: 0, concern: 1 })
  })
})

// ============================================================
//  每月趨勢（用真實 anchor，所以只測「結構不變量」）
// ============================================================
describe('monthlyTrend（deterministic 結構不變量）', () => {
  it('回傳長度 = months，最後一個 key = 當月', () => {
    const pts = monthlyTrend([], 6)
    expect(pts).toHaveLength(6)
    expect(pts[pts.length - 1].key).toBe(toKey(new Date()).slice(0, 7))
    expect(pts.every((p) => p.total === 0)).toBe(true)
  })

  it('months = 0 → 空陣列', () => expect(monthlyTrend([], 0)).toEqual([]))

  it('落喺當月嘅記錄按 direction 分流；唔喺範圍嘅唔計', () => {
    const thisMonth = toKey(new Date()).slice(0, 7) // YYYY-MM
    const rows: CommRow[] = [
      row({ date: `${thisMonth}-05` }, { direction: 'incoming' }),
      row({ date: `${thisMonth}-06` }, { direction: 'outgoing' }),
      row({ date: `${thisMonth}-07` }), // 無 meta → 當 outgoing
      row({ date: '1990-01-01' }), // 遠古，唔喺範圍
    ]
    const pts = monthlyTrend(rows, 3)
    const cur = pts[pts.length - 1]
    expect(cur.total).toBe(3)
    expect(cur.incoming).toBe(1)
    expect(cur.outgoing).toBe(2) // 1 個 outgoing + 1 個無 meta
  })
})

// ============================================================
//  每位學生彙總
// ============================================================
describe('summarizeByStudent', () => {
  it('空 → 空 Map', () => expect(summarizeByStudent([]).size).toBe(0))

  it('無 studentId 嘅記錄被略過', () => {
    expect(summarizeByStudent([row({ studentId: undefined })]).size).toBe(0)
  })

  it('彙總：計數 / 最近日子 / 未完成跟進 / 最近到期 / 觀感', () => {
    const rows: CommRow[] = [
      row({ studentId: 's1', date: '2026-05-01' }, { outcome: 'positive' }),
      row(
        { studentId: 's1', date: '2026-05-20', followUp: true },
        { followUpDate: '2026-06-10', outcome: 'concern' },
      ),
      row(
        { studentId: 's1', date: '2026-05-10', followUp: true },
        { followUpDate: '2026-05-25' },
      ),
    ]
    const s = summarizeByStudent(rows).get('s1')!
    expect(s.count).toBe(3)
    expect(s.lastDate).toBe('2026-05-20') // 最大日期
    expect(s.openFollowUps).toBe(2)
    expect(s.nextFollowUp).toBe('2026-05-25') // 最早到期日
    expect(s.positive).toBe(1)
    expect(s.concern).toBe(1)
    expect(s.neutral).toBe(0)
  })

  it('多名學生各自獨立', () => {
    const map = summarizeByStudent([
      row({ studentId: 's1' }),
      row({ studentId: 's2' }),
      row({ studentId: 's2' }),
    ])
    expect(map.get('s1')!.count).toBe(1)
    expect(map.get('s2')!.count).toBe(2)
  })
})

// ============================================================
//  排序
// ============================================================
describe('sortRows', () => {
  const name = (r: CommRow) => r.comm.id // fallback 用 id 做穩定排序

  it('唔改原陣列（回傳新 array）', () => {
    const rows = [row({ id: 'a', date: '2026-05-01' }), row({ id: 'b', date: '2026-05-02' })]
    const sorted = sortRows(rows, 'date', 'desc', name)
    expect(sorted).not.toBe(rows)
    expect(rows.map((r) => r.comm.id)).toEqual(['a', 'b']) // 原陣列順序不變
  })

  it('date 升 / 降序', () => {
    const rows = [
      row({ id: 'b', date: '2026-05-02' }),
      row({ id: 'a', date: '2026-05-01' }),
      row({ id: 'c', date: '2026-05-03' }),
    ]
    expect(sortRows(rows, 'date', 'asc', name).map((r) => r.comm.id)).toEqual(['a', 'b', 'c'])
    expect(sortRows(rows, 'date', 'desc', name).map((r) => r.comm.id)).toEqual(['c', 'b', 'a'])
  })

  it('date 同日：用 createdAt 做 tiebreak', () => {
    const rows = [
      row({ id: 'late', date: '2026-05-01', createdAt: '2026-05-01T10:00:00Z' }),
      row({ id: 'early', date: '2026-05-01', createdAt: '2026-05-01T08:00:00Z' }),
    ]
    expect(sortRows(rows, 'date', 'asc', name).map((r) => r.comm.id)).toEqual(['early', 'late'])
  })

  it('followUp：未完成（true）排先', () => {
    const rows = [
      row({ id: 'done', followUp: false }),
      row({ id: 'open', followUp: true }, { followUpDate: '2026-05-01' }),
    ]
    expect(sortRows(rows, 'followUp', 'asc', name).map((r) => r.comm.id)).toEqual(['open', 'done'])
  })

  it('category：unset 排最後（fallback zzz）', () => {
    const rows = [
      row({ id: 'none' }), // unset
      row({ id: 'acad' }, { category: 'academic' }),
    ]
    expect(sortRows(rows, 'category', 'asc', name).map((r) => r.comm.id)).toEqual(['acad', 'none'])
  })
})
