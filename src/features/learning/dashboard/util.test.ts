import { describe, it, expect } from 'vitest'
import {
  WEEKDAYS,
  dayKey,
  fromKey,
  addDays,
  keyOf,
  rangeKeys,
  fmtMin,
  longestStreakOf,
  trendOf,
  activeKeysOf,
  buildActivity,
  truncate,
  readPrefs,
  visibleWidgets,
  widgetLabel,
  DEFAULT_WIDGET_ORDER,
  DEFAULT_KPIS,
  PREFS_ID,
  type DashInput,
  type DashPrefs,
} from './util'
import type { Card } from '../../../data/types'
import type { FocusLog } from '../focus/types'
import type { JournalDoc } from '../journal/util'

// ───────── 測試工廠（只填會用到嘅欄位，其餘以合理值補齊）─────────
function emptyInput(over: Partial<DashInput> = {}): DashInput {
  return {
    cards: [],
    goals: [],
    goalMeta: [],
    milestones: [],
    books: [],
    focusLogs: [],
    focusProjects: [],
    habits: [],
    habitLogs: [],
    journal: [],
    ...over,
  }
}

function flog(over: Partial<FocusLog>): FocusLog {
  return {
    id: 'f',
    kind: 'focus',
    startedAt: '2026-05-04T08:00:00',
    endedAt: '2026-05-04T08:25:00',
    plannedMin: 25,
    actualMin: 25,
    completed: true,
    ...over,
  }
}

function card(over: Partial<Card>): Card {
  return {
    id: 'c',
    deckId: 'd',
    front: 'front',
    back: 'back',
    ease: 2.5,
    intervalDays: 0,
    repetitions: 0,
    dueDate: '2026-05-04',
    createdAt: '2026-05-01T00:00:00.000Z',
    ...over,
  }
}

function jdoc(over: Partial<JournalDoc>): JournalDoc {
  return {
    id: 'j',
    date: '2026-05-04',
    content: 'hi',
    createdAt: '2026-05-04T10:00:00.000Z',
    updatedAt: '2026-05-04T10:00:00.000Z',
    ...over,
  }
}

// ═══════════════════════════════════════════════════════════
//  日期工具（本地時區，無 TZ off-by-one）
// ═══════════════════════════════════════════════════════════
describe('dayKey / fromKey（本地時區）', () => {
  it('dayKey 由本地年月日砌 key（補零）', () => {
    expect(dayKey(new Date(2026, 0, 1, 12))).toBe('2026-01-01') // 1 月 1 號
    expect(dayKey(new Date(2026, 11, 31, 12))).toBe('2026-12-31') // 12 月 31 號
    expect(dayKey(new Date(2026, 4, 4, 8, 30))).toBe('2026-05-04') // 補零月/日
  })

  it('fromKey 回本地正午（避免 UTC 漂移），唔會 off-by-one', () => {
    // 關鍵：就算喺 UTC+N 時區，年初/年尾都唔可以跳去前一日
    const d = fromKey('2026-01-01')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(1)
    expect(d.getHours()).toBe(12)
  })

  it('dayKey ∘ fromKey roundtrip（年首 / 年尾 / 平日）', () => {
    expect(dayKey(fromKey('2026-01-01'))).toBe('2026-01-01')
    expect(dayKey(fromKey('2026-12-31'))).toBe('2026-12-31')
    expect(dayKey(fromKey('2026-05-04'))).toBe('2026-05-04')
  })

  it('fromKey 缺月/日時 fallback（默認 1 月 1 號）', () => {
    expect(dayKey(fromKey('2026'))).toBe('2026-01-01')
  })
})

describe('addDays（本地，跨月/跨年/負數）', () => {
  it('正常加減', () => {
    expect(dayKey(addDays(fromKey('2026-05-04'), 3))).toBe('2026-05-07')
    expect(dayKey(addDays(fromKey('2026-05-04'), -4))).toBe('2026-04-30')
  })
  it('跨月邊界（5 月尾 +1 → 6 月 1 號）', () => {
    expect(dayKey(addDays(fromKey('2026-05-31'), 1))).toBe('2026-06-01')
  })
  it('跨年邊界（12 月 31 +1 → 翌年 1 月 1）', () => {
    expect(dayKey(addDays(fromKey('2026-12-31'), 1))).toBe('2027-01-01')
    expect(dayKey(addDays(fromKey('2026-01-01'), -1))).toBe('2025-12-31')
  })
  it('+0 = 同日', () => {
    expect(dayKey(addDays(fromKey('2026-02-28'), 0))).toBe('2026-02-28')
  })
})

describe('keyOf（ISO datetime → 本地日 key）', () => {
  it('純字串切，唔受時間影響', () => {
    expect(keyOf('2026-05-04T08:30:00')).toBe('2026-05-04')
    expect(keyOf('2026-05-04T23:59:00')).toBe('2026-05-04')
  })
})

describe('rangeKeys（含頭尾，由舊到新）', () => {
  it('一週連續日', () => {
    expect(rangeKeys(fromKey('2026-05-01'), fromKey('2026-05-07'))).toEqual([
      '2026-05-01',
      '2026-05-02',
      '2026-05-03',
      '2026-05-04',
      '2026-05-05',
      '2026-05-06',
      '2026-05-07',
    ])
  })
  it('from == to → 單日', () => {
    expect(rangeKeys(fromKey('2026-05-04'), fromKey('2026-05-04'))).toEqual(['2026-05-04'])
  })
  it('from > to → 空陣列', () => {
    expect(rangeKeys(fromKey('2026-05-05'), fromKey('2026-05-04'))).toEqual([])
  })
  it('跨月邊界', () => {
    expect(rangeKeys(fromKey('2026-05-30'), fromKey('2026-06-02'))).toEqual([
      '2026-05-30',
      '2026-05-31',
      '2026-06-01',
      '2026-06-02',
    ])
  })
})

describe('WEEKDAYS 常量', () => {
  it('日…六（getDay() 0-6 對應）', () => {
    expect(WEEKDAYS[0]).toBe('日')
    expect(WEEKDAYS[6]).toBe('六')
    // 2026-05-04 係星期一
    expect(WEEKDAYS[fromKey('2026-05-04').getDay()]).toBe('一')
  })
})

// ═══════════════════════════════════════════════════════════
//  fmtMin（分鐘格式化）
// ═══════════════════════════════════════════════════════════
describe('fmtMin', () => {
  it('0 分', () => expect(fmtMin(0)).toBe('0分'))
  it('< 60 分純分鐘（含四捨五入）', () => {
    expect(fmtMin(25)).toBe('25分')
    expect(fmtMin(59.4)).toBe('59分')
  })
  it('59.5 四捨五入 → 60 → 1 時', () => expect(fmtMin(59.5)).toBe('1時'))
  it('整點（無餘分）只顯示時', () => {
    expect(fmtMin(60)).toBe('1時')
    expect(fmtMin(120)).toBe('2時')
  })
  it('時 + 分', () => {
    expect(fmtMin(90)).toBe('1時30分')
    expect(fmtMin(145)).toBe('2時25分')
  })
})

// ═══════════════════════════════════════════════════════════
//  longestStreakOf（歷來最長連續活躍日；操作 Set，deterministic）
// ═══════════════════════════════════════════════════════════
describe('longestStreakOf', () => {
  it('空 Set → 0', () => expect(longestStreakOf(new Set())).toBe(0))
  it('單日 → 1', () => expect(longestStreakOf(new Set(['2026-05-04']))).toBe(1))
  it('連續 3 日 → 3', () => {
    expect(longestStreakOf(new Set(['2026-05-04', '2026-05-05', '2026-05-06']))).toBe(3)
  })
  it('有斷層，取最長 run', () => {
    // 連續 [01,02] = 2；[05,06,07,08] = 4；最長 = 4
    expect(
      longestStreakOf(
        new Set(['2026-05-01', '2026-05-02', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08']),
      ),
    ).toBe(4)
  })
  it('全部不相連 → 1', () => {
    expect(longestStreakOf(new Set(['2026-05-01', '2026-05-03', '2026-05-05']))).toBe(1)
  })
  it('亂序輸入照樣計（內部排序）+ 跨月連續', () => {
    // 04-30, 05-01, 05-02 連續 3 日，跨月
    expect(longestStreakOf(new Set(['2026-05-02', '2026-04-30', '2026-05-01']))).toBe(3)
  })
  it('非閏年 2 月尾接 3 月（28→1 連續）', () => {
    expect(longestStreakOf(new Set(['2026-02-28', '2026-03-01']))).toBe(2)
  })
  it('閏年 2 月 29 號連續（2024）', () => {
    expect(longestStreakOf(new Set(['2024-02-28', '2024-02-29', '2024-03-01']))).toBe(3)
  })
  it('跨年連續（12-31 → 翌年 01-01）', () => {
    expect(longestStreakOf(new Set(['2026-12-31', '2027-01-01']))).toBe(2)
  })
})

// ═══════════════════════════════════════════════════════════
//  trendOf（本期 vs 上期）
// ═══════════════════════════════════════════════════════════
describe('trendOf', () => {
  it('上期 0 + 本期 0 → flat 「—」', () => {
    expect(trendOf(0, 0)).toEqual({ dir: 'flat', value: '—' })
  })
  it('上期 0 + 本期 > 0 → up 「新」', () => {
    expect(trendOf(5, 0)).toEqual({ dir: 'up', value: '新' })
  })
  it('上升百分比（+號）', () => {
    expect(trendOf(150, 100)).toEqual({ dir: 'up', value: '+50%' })
  })
  it('下降百分比', () => {
    expect(trendOf(50, 100)).toEqual({ dir: 'down', value: '-50%' })
    expect(trendOf(0, 10)).toEqual({ dir: 'down', value: '-100%' })
  })
  it('相等 → flat 「0%」', () => {
    expect(trendOf(100, 100)).toEqual({ dir: 'flat', value: '0%' })
  })
  it('四捨五入後為 0 仍視為 flat', () => {
    // (100-99)/99*100 = 1.01 → round = 1 → up「+1%」（驗證未被誤判 flat）
    expect(trendOf(100, 99)).toEqual({ dir: 'up', value: '+1%' })
    // (1000-996)/996*100 = 0.40 → round = 0 → flat
    expect(trendOf(1000, 996)).toEqual({ dir: 'flat', value: '0%' })
  })
})

// ═══════════════════════════════════════════════════════════
//  activeKeysOf（彙整全部活躍日期）
// ═══════════════════════════════════════════════════════════
describe('activeKeysOf', () => {
  it('空輸入 → 空 Set', () => {
    expect(activeKeysOf(emptyInput()).size).toBe(0)
  })

  it('彙整 focus(完成) / 卡複習 / 習慣 / 日誌 四源', () => {
    // 卡 lastReviewed 用本地日 key（keyOf）→ 用 TZ-naive 時間，跨時區都穩定落 05-05。
    const s = activeKeysOf(
      emptyInput({
        focusLogs: [flog({ id: 'f1', startedAt: '2026-05-04T08:30:00' })],
        cards: [card({ id: 'c1', lastReviewed: '2026-05-05T23:00:00' })],
        habitLogs: [{ id: 'hl1', habitId: 'h1', date: '2026-05-06' }],
        journal: [jdoc({ id: 'j1', date: '2026-05-07' })],
      }),
    )
    expect([...s].sort()).toEqual(['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07'])
  })

  it('未完成 / 非 focus 嘅 focusLog 唔算活躍', () => {
    const s = activeKeysOf(
      emptyInput({
        focusLogs: [
          flog({ id: 'f1', startedAt: '2026-05-04T08:30:00', completed: false }),
          flog({ id: 'f2', startedAt: '2026-05-05T08:30:00', kind: 'short_break' }),
        ],
      }),
    )
    expect(s.size).toBe(0)
  })

  it('無 lastReviewed 嘅卡唔算；同日多源去重', () => {
    const s = activeKeysOf(
      emptyInput({
        cards: [card({ id: 'c1' }), card({ id: 'c2', lastReviewed: '2026-05-04T10:00:00.000Z' })],
        habitLogs: [{ id: 'hl1', habitId: 'h1', date: '2026-05-04' }],
      }),
    )
    expect([...s]).toEqual(['2026-05-04'])
  })
})

// ═══════════════════════════════════════════════════════════
//  buildActivity（活動時間線，按 at 降序 + 截取 limit）
// ═══════════════════════════════════════════════════════════
describe('buildActivity', () => {
  it('空輸入 → 空陣列', () => {
    expect(buildActivity(emptyInput(), [], 10)).toEqual([])
  })

  it('多源事件按 at 由新到舊排序', () => {
    const items = buildActivity(
      emptyInput({
        focusLogs: [
          flog({ id: 'f1', startedAt: '2026-05-01T08:00:00', endedAt: '2026-05-01T08:25:00' }),
        ],
        cards: [card({ id: 'c1', lastReviewed: '2026-05-03T09:00:00' })],
        habitLogs: [{ id: 'hl1', habitId: 'h1', date: '2026-05-02' }],
      }),
      [],
      10,
    )
    // at: 卡 05-03T09:00 > 習慣 05-02T12:00 > focus 05-01T08:25
    expect(items.map((i) => i.id)).toEqual(['c-c1', 'h-hl1', 'f-f1'])
    expect(items.map((i) => i.kind)).toEqual(['review', 'habit', 'focus'])
  })

  it('limit 截取最新 N 條', () => {
    const items = buildActivity(
      emptyInput({
        habitLogs: [
          { id: 'a', habitId: 'h', date: '2026-05-01' },
          { id: 'b', habitId: 'h', date: '2026-05-02' },
          { id: 'c', habitId: 'h', date: '2026-05-03' },
        ],
      }),
      [],
      2,
    )
    // 取最新 2 條：05-03, 05-02
    expect(items.map((i) => i.id)).toEqual(['h-c', 'h-b'])
  })

  it('focus 文字含時長；endedAt 缺失時 fallback startedAt', () => {
    const items = buildActivity(
      emptyInput({
        focusLogs: [flog({ id: 'f1', actualMin: 90, endedAt: '', startedAt: '2026-05-01T08:00:00' })],
      }),
      [],
      10,
    )
    expect(items[0].text).toBe('專注 1時30分')
    expect(items[0].at).toBe('2026-05-01T08:00:00')
    expect(items[0].target).toBe('learning-focus')
  })

  it('noteEvents 一併納入並排序', () => {
    const items = buildActivity(
      emptyInput({
        journal: [jdoc({ id: 'j1', date: '2026-05-01', updatedAt: '2026-05-01T10:00:00.000Z' })],
      }),
      [{ id: 'n1', text: '快速筆記', at: '2026-05-09T10:00:00.000Z' }],
      10,
    )
    expect(items[0].id).toBe('n-n1')
    expect(items[0].kind).toBe('note')
    expect(items[0].text).toBe('快速筆記')
  })

  it('未完成 focus log 唔顯示', () => {
    const items = buildActivity(
      emptyInput({ focusLogs: [flog({ id: 'f1', completed: false })] }),
      [],
      10,
    )
    expect(items).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════
//  truncate（壓縮空白 + 截斷加省略號）
// ═══════════════════════════════════════════════════════════
describe('truncate', () => {
  it('短字串原樣（壓縮內部空白）', () => {
    expect(truncate('  abc  def  ', 10)).toBe('abc def')
  })
  it('超長截斷 + 省略號', () => {
    expect(truncate('abcdef', 3)).toBe('abc…')
  })
  it('長度剛好 = n → 不截斷', () => {
    expect(truncate('abc', 3)).toBe('abc')
  })
  it('空字串 → 空字串', () => {
    expect(truncate('', 5)).toBe('')
    expect(truncate('   ', 5)).toBe('')
  })
})

// ═══════════════════════════════════════════════════════════
//  readPrefs / visibleWidgets / widgetLabel（偏好持久化純邏輯）
// ═══════════════════════════════════════════════════════════
describe('readPrefs', () => {
  it('空陣列 → 全默認', () => {
    const p = readPrefs([])
    expect(p.id).toBe(PREFS_ID)
    expect(p.widgetOrder).toEqual(DEFAULT_WIDGET_ORDER)
    expect(p.kpis).toEqual(DEFAULT_KPIS)
    expect(p.range).toBe(30)
    expect(p.density).toBe('comfortable')
    expect(p.hiddenWidgets).toEqual([])
  })

  it('過濾未知 widget id，並把缺失嘅默認 widget 補去尾', () => {
    const p = readPrefs([
      {
        id: PREFS_ID,
        hiddenWidgets: ['rings', 'bogus'] as never,
        widgetOrder: ['mood', 'bogus'] as never,
        kpis: ['due'],
        range: 14,
        density: 'compact',
      } as DashPrefs,
    ])
    // mood 排頭，其餘默認 widget（剔走 mood）按默認次序補上；bogus 被剔
    expect(p.widgetOrder).toEqual([
      'mood',
      'rings',
      'agenda',
      'flashcards',
      'goals',
      'habits',
      'health',
      'reading',
      'quiz',
      'activity',
    ])
    expect(p.hiddenWidgets).toEqual(['rings'])
  })

  it('kpis 過濾未知 id 並最多保留 4 個', () => {
    const p = readPrefs([
      {
        id: PREFS_ID,
        hiddenWidgets: [],
        widgetOrder: DEFAULT_WIDGET_ORDER,
        kpis: ['due', 'streak', 'focusWeek', 'reviewsWeek', 'habitRate'],
        range: 30,
        density: 'comfortable',
      } as DashPrefs,
    ])
    expect(p.kpis).toEqual(['due', 'streak', 'focusWeek', 'reviewsWeek'])
  })

  it('kpis 全部失效 → fallback 默認', () => {
    const p = readPrefs([
      {
        id: PREFS_ID,
        hiddenWidgets: [],
        widgetOrder: DEFAULT_WIDGET_ORDER,
        kpis: ['nope', 'gone'] as never,
        range: 30,
        density: 'comfortable',
      } as DashPrefs,
    ])
    expect(p.kpis).toEqual(DEFAULT_KPIS)
  })

  it('保留有效自訂值（range / density）', () => {
    const p = readPrefs([
      {
        id: PREFS_ID,
        hiddenWidgets: [],
        widgetOrder: DEFAULT_WIDGET_ORDER,
        kpis: DEFAULT_KPIS,
        range: 90,
        density: 'compact',
      } as DashPrefs,
    ])
    expect(p.range).toBe(90)
    expect(p.density).toBe('compact')
  })
})

describe('visibleWidgets', () => {
  it('依次序、剔走隱藏', () => {
    const prefs = {
      id: PREFS_ID,
      hiddenWidgets: ['agenda'],
      widgetOrder: ['rings', 'agenda', 'goals'],
      kpis: DEFAULT_KPIS,
      range: 30,
      density: 'comfortable',
    } as DashPrefs
    expect(visibleWidgets(prefs)).toEqual(['rings', 'goals'])
  })
  it('無隱藏 → 全部依次序', () => {
    const prefs = {
      id: PREFS_ID,
      hiddenWidgets: [],
      widgetOrder: ['mood', 'quiz'],
      kpis: DEFAULT_KPIS,
      range: 30,
      density: 'comfortable',
    } as DashPrefs
    expect(visibleWidgets(prefs)).toEqual(['mood', 'quiz'])
  })
})

describe('widgetLabel', () => {
  it('已知 id 回中文標籤', () => {
    expect(widgetLabel('rings')).toBe('今日聚焦環')
    expect(widgetLabel('activity')).toBe('活動時間線')
  })
})
