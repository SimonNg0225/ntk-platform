import { describe, it, expect } from 'vitest'
import { anniversaryEntries, buildMoodMonth, moodDef } from './util'
import type { JournalDoc } from './util'

// ============================================================
//  學習日誌 — 「歷年今日」+「心情月曆」純函式測試
//  ------------------------------------------------------------
//  兩者都係零時間依賴嘅純函式（基準日由 caller 傳入），故用真實
//  時間即可，唔需 fake timers。沿用功能本地日期語意（MM-DD / 本地
//  月格），邊界守空集合、跨年、Feb 29、同日多篇取最後修改。
// ============================================================

const doc = (over: Partial<JournalDoc>): JournalDoc => ({
  id: 'd',
  date: '2026-05-04',
  content: '',
  createdAt: '2026-05-04T08:00:00.000Z',
  updatedAt: '2026-05-04T08:00:00.000Z',
  ...over,
})

// ───────────────────────── 歷年今日 ─────────────────────────
describe('anniversaryEntries', () => {
  it('揾返同月同日（MM-DD 相同）但唔同年嘅舊日誌', () => {
    const docs = [
      doc({ id: 'a', date: '2024-05-31' }),
      doc({ id: 'b', date: '2025-05-31' }),
      doc({ id: 'c', date: '2026-05-30' }), // 唔同日
      doc({ id: 'd', date: '2025-04-30' }), // 唔同月
    ]
    const res = anniversaryEntries(docs, '2026-05-31')
    expect(res.map((r) => r.doc.id)).toEqual(['b', 'a'])
  })

  it('排除「今日」嗰篇（同年同月同日）', () => {
    const docs = [
      doc({ id: 'today', date: '2026-05-31' }),
      doc({ id: 'lastyear', date: '2025-05-31' }),
    ]
    const res = anniversaryEntries(docs, '2026-05-31')
    expect(res.map((r) => r.doc.id)).toEqual(['lastyear'])
  })

  it('排除未來日子（yearsAgo ≤ 0）', () => {
    const docs = [
      doc({ id: 'future', date: '2027-05-31' }), // 將來嘅同月日
      doc({ id: 'past', date: '2024-05-31' }),
    ]
    const res = anniversaryEntries(docs, '2026-05-31')
    expect(res.map((r) => r.doc.id)).toEqual(['past'])
  })

  it('yearsAgo = today 年份 − 該篇年份（一定 ≥ 1）', () => {
    const docs = [
      doc({ id: 'a', date: '2023-01-01' }),
      doc({ id: 'b', date: '2025-01-01' }),
    ]
    const res = anniversaryEntries(docs, '2026-01-01')
    expect(res).toHaveLength(2)
    expect(res.find((r) => r.doc.id === 'b')!.yearsAgo).toBe(1)
    expect(res.find((r) => r.doc.id === 'a')!.yearsAgo).toBe(3)
  })

  it('最近嗰年喺最前（近→遠）', () => {
    const docs = [
      doc({ id: 'far', date: '2020-12-25' }),
      doc({ id: 'mid', date: '2023-12-25' }),
      doc({ id: 'near', date: '2025-12-25' }),
    ]
    const res = anniversaryEntries(docs, '2026-12-25')
    expect(res.map((r) => r.doc.id)).toEqual(['near', 'mid', 'far'])
    expect(res.map((r) => r.yearsAgo)).toEqual([1, 3, 6])
  })

  it('同年同月同日多篇：按 updatedAt 新→舊（穩定）', () => {
    const docs = [
      doc({ id: 'old', date: '2024-05-31', updatedAt: '2024-05-31T08:00:00.000Z' }),
      doc({ id: 'new', date: '2024-05-31', updatedAt: '2024-06-01T10:00:00.000Z' }),
    ]
    const res = anniversaryEntries(docs, '2026-05-31')
    expect(res.map((r) => r.doc.id)).toEqual(['new', 'old'])
  })

  it('Feb 29：只配同樣 02-29 嘅閏年日誌', () => {
    const docs = [
      doc({ id: 'leap', date: '2020-02-29' }),
      doc({ id: 'feb28', date: '2025-02-28' }), // 唔同日
    ]
    const res = anniversaryEntries(docs, '2024-02-29')
    expect(res.map((r) => r.doc.id)).toEqual(['leap'])
    expect(res[0].yearsAgo).toBe(4)
  })

  it('空集合 / 無相符 → 空陣列', () => {
    expect(anniversaryEntries([], '2026-05-31')).toEqual([])
    expect(
      anniversaryEntries([doc({ date: '2025-01-01' })], '2026-05-31'),
    ).toEqual([])
  })
})

// ───────────────────────── 心情月曆 ─────────────────────────
describe('buildMoodMonth', () => {
  it('2026 年 5 月（month=4）：首格星期日、每週 7 格、尾格星期六', () => {
    const m = buildMoodMonth([], 2026, 4)
    expect(m.year).toBe(2026)
    expect(m.month).toBe(4)
    expect(m.weeks.every((w) => w.length === 7)).toBe(true)
    // 2026-05-01 = 星期五 → 退到星期日 2026-04-26
    expect(m.weeks[0][0].key).toBe('2026-04-26')
    expect(m.weeks[0][0].inMonth).toBe(false)
    // 尾格一定係星期六
    const lastWeek = m.weeks[m.weeks.length - 1]
    expect(lastWeek[6].key.length).toBe(10)
    // 2026-05-31 = 星期日 → 補到 2026-06-06（星期六）
    expect(lastWeek[6].key).toBe('2026-06-06')
    expect(lastWeek[6].inMonth).toBe(false)
  })

  it('當月每格 inMonth=true 且 day 連續 1..31', () => {
    const m = buildMoodMonth([], 2026, 4) // 5 月 31 日
    const inMonthDays = m.weeks.flat().filter((d) => d.inMonth).map((d) => d.day)
    expect(inMonthDays).toEqual(Array.from({ length: 31 }, (_, i) => i + 1))
  })

  it('padding 格唔帶心情 / 篇數（就算嗰日真係有日誌）', () => {
    // 2026-04-26 喺 5 月格網入面係 padding（屬 4 月）
    const docs = [doc({ date: '2026-04-26', mood: '😀' })]
    const m = buildMoodMonth(docs, 2026, 4)
    const pad = m.weeks[0][0]
    expect(pad.key).toBe('2026-04-26')
    expect(pad.inMonth).toBe(false)
    expect(pad.mood).toBeUndefined()
    expect(pad.count).toBe(0)
  })

  it('當日心情正確著色（帶 def，含 hex）', () => {
    const docs = [doc({ date: '2026-05-10', mood: '😀' })]
    const m = buildMoodMonth(docs, 2026, 4)
    const cell = m.weeks.flat().find((d) => d.key === '2026-05-10')!
    expect(cell.mood).toBe('😀')
    expect(cell.def?.score).toBe(5)
    expect(cell.def?.hex).toBe(moodDef('😀')!.hex)
    expect(cell.count).toBe(1)
  })

  it('同日多篇：心情取最後修改嗰篇；篇數累加', () => {
    const docs = [
      doc({ id: '1', date: '2026-05-10', mood: '😣', updatedAt: '2026-05-10T08:00:00.000Z' }),
      doc({ id: '2', date: '2026-05-10', mood: '😀', updatedAt: '2026-05-10T20:00:00.000Z' }),
    ]
    const m = buildMoodMonth(docs, 2026, 4)
    const cell = m.weeks.flat().find((d) => d.key === '2026-05-10')!
    expect(cell.mood).toBe('😀') // 最後修改
    expect(cell.count).toBe(2)
  })

  it('同日多篇但最新一篇無心情：保留較早嗰篇心情（唔變空）', () => {
    const docs = [
      doc({ id: '1', date: '2026-05-10', mood: '🙂', updatedAt: '2026-05-10T08:00:00.000Z' }),
      doc({ id: '2', date: '2026-05-10', mood: undefined, updatedAt: '2026-05-10T20:00:00.000Z' }),
    ]
    const m = buildMoodMonth(docs, 2026, 4)
    const cell = m.weeks.flat().find((d) => d.key === '2026-05-10')!
    expect(cell.mood).toBe('🙂')
    expect(cell.count).toBe(2)
  })

  it('只計當月：其他月份日誌唔影響', () => {
    const docs = [
      doc({ id: 'apr', date: '2026-04-30', mood: '😀' }),
      doc({ id: 'jun', date: '2026-06-01', mood: '😀' }),
      doc({ id: 'may', date: '2026-05-15', mood: '😐' }),
    ]
    const m = buildMoodMonth(docs, 2026, 4)
    expect(m.activeDays).toBe(1)
    expect(m.moodDays).toBe(1)
    const may15 = m.weeks.flat().find((d) => d.key === '2026-05-15')!
    expect(may15.mood).toBe('😐')
  })

  it('avgScore = 當月有心情日子嘅平均分；無心情 → null', () => {
    const docs = [
      doc({ id: '1', date: '2026-05-01', mood: '😀' }), // 5
      doc({ id: '2', date: '2026-05-02', mood: '😐' }), // 3
      doc({ id: '3', date: '2026-05-03', content: '無心情' }), // 唔計
    ]
    const m = buildMoodMonth(docs, 2026, 4)
    expect(m.moodDays).toBe(2)
    expect(m.activeDays).toBe(3)
    expect(m.avgScore).toBe(4) // (5+3)/2
  })

  it('無資料 → moodDays / activeDays = 0、avgScore = null', () => {
    const m = buildMoodMonth([], 2026, 4)
    expect(m.moodDays).toBe(0)
    expect(m.activeDays).toBe(0)
    expect(m.avgScore).toBeNull()
    expect(m.weeks.flat().every((d) => d.mood === undefined && d.count === 0)).toBe(true)
  })

  it('2 月閏年（2024-02，29 日）格網正確', () => {
    const m = buildMoodMonth([], 2024, 1) // 2024 年 2 月
    const inMonthDays = m.weeks.flat().filter((d) => d.inMonth).map((d) => d.day)
    expect(inMonthDays[inMonthDays.length - 1]).toBe(29) // 含 2/29
    expect(inMonthDays).toHaveLength(29)
  })

  it('2 月非閏年（2026-02，28 日）格網正確', () => {
    const m = buildMoodMonth([], 2026, 1)
    const inMonthDays = m.weeks.flat().filter((d) => d.inMonth).map((d) => d.day)
    expect(inMonthDays).toHaveLength(28)
    expect(inMonthDays[inMonthDays.length - 1]).toBe(28)
  })

  it('12 月（跨年補格）：尾格補到下一年 1 月', () => {
    const m = buildMoodMonth([], 2026, 11) // 2026 年 12 月
    // 2026-12-31 = 星期四 → 補到 2027-01-02（星期六）
    const lastWeek = m.weeks[m.weeks.length - 1]
    expect(lastWeek[6].key).toBe('2027-01-02')
    expect(lastWeek[6].inMonth).toBe(false)
  })
})
