import { describe, it, expect } from 'vitest'
import {
  moodDef,
  moodScore,
  promptOfDay,
  PROMPTS,
  toKey,
  fromKey,
  addDays,
  diffDays,
  longDate,
  mediumDate,
  countWords,
  parseTags,
  allTagsOf,
  excerpt,
  longestStreak,
  moodDistribution,
  weekdayCounts,
  buildHeatGrid,
  heatLevel,
  toMarkdown,
} from './util'
import type { JournalDoc } from './util'

// 測試專用：砌一篇日誌（只需傳要關心嘅欄位）
const doc = (over: Partial<JournalDoc>): JournalDoc => ({
  id: 'd',
  date: '2026-05-04', // 星期一
  content: '',
  createdAt: '2026-05-04T08:00:00.000Z',
  updatedAt: '2026-05-04T08:00:00.000Z',
  ...over,
})

// ───────────────────────── 心情查表 ─────────────────────────
describe('moodDef / moodScore', () => {
  it('已知 emoji → 對應 def 同分數', () => {
    expect(moodDef('😀')?.score).toBe(5)
    expect(moodDef('😀')?.label).toBe('很好')
    expect(moodScore('😀')).toBe(5)
    expect(moodScore('😣')).toBe(1)
    expect(moodScore('😐')).toBe(3)
  })

  it('未知 / undefined → undefined（唔可以 throw）', () => {
    expect(moodDef('🤖')).toBeUndefined()
    expect(moodDef(undefined)).toBeUndefined()
    expect(moodScore(undefined)).toBeUndefined()
    expect(moodScore('')).toBeUndefined()
  })
})

// ───────────────────────── promptOfDay（穩定 hash）─────────────────────────
describe('promptOfDay', () => {
  it('同一 key 永遠回同一句（deterministic）', () => {
    const a = promptOfDay('2026-05-04')
    const b = promptOfDay('2026-05-04')
    expect(a).toBe(b)
  })

  it('結果一定喺 PROMPTS 入面', () => {
    for (const k of ['2026-05-04', '2026-01-01', 'x', '', 'hello-world']) {
      expect(PROMPTS).toContain(promptOfDay(k))
    }
  })

  it('手算 hash → 指定索引（第一性原理）', () => {
    // h=(h*31+code)>>>0, idx=h%7。'2026-05-04' → 0；'2026-01-01' → 1；'a' → 6
    expect(promptOfDay('2026-05-04')).toBe(PROMPTS[0])
    expect(promptOfDay('2026-01-01')).toBe(PROMPTS[1])
    expect(promptOfDay('a')).toBe(PROMPTS[6])
    // 空字串：h=0 → idx 0
    expect(promptOfDay('')).toBe(PROMPTS[0])
  })
})

// ───────────────────────── 日期 key（本地時區，無 UTC off-by-one）─────────────────────────
describe('toKey / fromKey（本地時區）', () => {
  it('roundtrip 唔漂移（含跨年邊界）', () => {
    expect(toKey(fromKey('2026-05-04'))).toBe('2026-05-04')
    expect(toKey(fromKey('2026-01-01'))).toBe('2026-01-01')
    expect(toKey(fromKey('2026-12-31'))).toBe('2026-12-31')
    expect(toKey(fromKey('2024-02-29'))).toBe('2024-02-29') // 閏日
  })

  it('toKey 由本地日曆欄位取值，唔係 UTC', () => {
    // 用明確本地 Date：2026-01-01 00:30 本地 → key 一定係 2026-01-01，
    // 而唔係 UTC 退一日嘅 2025-12-31（toISOString 嘅典型 off-by-one）。
    expect(toKey(new Date(2026, 0, 1, 0, 30, 0))).toBe('2026-01-01')
    // 本地 23:30 → 仍係同一本地日（UTC 可能已跳去下一日）
    expect(toKey(new Date(2026, 11, 31, 23, 30, 0))).toBe('2026-12-31')
  })

  it('零填充（月 / 日 < 10）', () => {
    expect(toKey(new Date(2026, 2, 5, 12))).toBe('2026-03-05')
  })

  it('fromKey 設正午（避開 DST / UTC 邊界）', () => {
    const d = fromKey('2026-05-04')
    expect(d.getHours()).toBe(12)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4) // 5 月 = index 4
    expect(d.getDate()).toBe(4)
  })
})

describe('addDays', () => {
  it('正常加減', () => {
    expect(addDays('2026-05-04', 1)).toBe('2026-05-05')
    expect(addDays('2026-05-04', 0)).toBe('2026-05-04')
    expect(addDays('2026-05-04', -1)).toBe('2026-05-03')
    expect(addDays('2026-05-04', 7)).toBe('2026-05-11')
  })

  it('跨月 / 跨年邊界', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28') // 2026 非閏年
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29') // 2024 閏年
  })
})

describe('diffDays', () => {
  it('基本相差（含負數 / 零）', () => {
    expect(diffDays('2026-05-05', '2026-05-04')).toBe(1)
    expect(diffDays('2026-05-04', '2026-05-04')).toBe(0)
    expect(diffDays('2026-05-04', '2026-05-05')).toBe(-1)
    expect(diffDays('2026-05-11', '2026-05-04')).toBe(7)
  })

  it('跨月 / 跨年', () => {
    expect(diffDays('2026-02-01', '2026-01-31')).toBe(1)
    expect(diffDays('2027-01-01', '2026-12-31')).toBe(1)
    // 2026 全年 365 日（非閏年）
    expect(diffDays('2026-12-31', '2026-01-01')).toBe(364)
  })

  it('跨 DST 邊界（美國 3 月「春跳」）仍準到日，唔受 ±1 小時影響', () => {
    // 美國 DST 2026-03-08 開始；正午對正午法可消除 23 小時當日嘅誤差。
    expect(diffDays('2026-03-09', '2026-03-08')).toBe(1)
    expect(diffDays('2026-03-08', '2026-03-07')).toBe(1)
  })
})

describe('longDate / mediumDate', () => {
  it('長格式（含星期）', () => {
    // 2026-05-04 = 星期一
    expect(longDate('2026-05-04')).toBe('2026年5月4日 星期一')
    // 2026-05-31 = 星期日
    expect(longDate('2026-05-31')).toBe('2026年5月31日 星期日')
  })

  it('中格式', () => {
    expect(mediumDate('2026-05-04')).toBe('5月4日（一）')
    expect(mediumDate('2026-01-01')).toBe('1月1日（四）') // 2026-01-01 = 星期四
  })
})

// ───────────────────────── 文字 / 標籤 ─────────────────────────
describe('countWords', () => {
  it('空 / 純空白 → 0', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('     ')).toBe(0)
    expect(countWords('\n\t  \n')).toBe(0)
  })

  it('CJK 逐字計', () => {
    expect(countWords('今日學咗好多嘢')).toBe(7)
    expect(countWords('學習')).toBe(2)
  })

  it('英文 / 數字以「詞」計', () => {
    expect(countWords('Hello world')).toBe(2)
    expect(countWords('state-of-the-art')).toBe(1) // 連字號當一詞
    expect(countWords("don't stop")).toBe(2)
  })

  it('中英夾雜', () => {
    // 「今日」2 個 CJK + learned + 3 + things = 2 + 3 = 5
    expect(countWords('今日 learned 3 things')).toBe(5)
  })

  it('純 emoji（非 CJK/拉丁）→ 0', () => {
    expect(countWords('😀')).toBe(0)
    expect(countWords('🙂 😣')).toBe(0)
  })
})

describe('parseTags', () => {
  it('解析 #標籤、去重（case-insensitive）、保留首次次序', () => {
    expect(parseTags('學咗 #數學 同 #物理')).toEqual(['數學', '物理'])
    expect(parseTags('#tag1 #Tag1 #tag2')).toEqual(['tag1', 'tag2'])
  })

  it('無標籤 / 空字串 → 空陣列', () => {
    expect(parseTags('')).toEqual([])
    expect(parseTags('完全冇 hashtag')).toEqual([])
    expect(parseTags('# 單獨井號唔算')).toEqual([])
  })

  it('支援底線 / 連字號 / 數字 / Unicode 字母', () => {
    expect(parseTags('#deep_work #day-1 #2026 #中文標籤')).toEqual([
      'deep_work',
      'day-1',
      '2026',
      '中文標籤',
    ])
  })
})

describe('allTagsOf', () => {
  it('由內文抽標籤（去重）', () => {
    expect(allTagsOf(doc({ content: '今日 #反思 又 #反思 再 #總結' }))).toEqual([
      '反思',
      '總結',
    ])
  })

  it('無標籤 → 空陣列', () => {
    expect(allTagsOf(doc({ content: '平平無奇嘅一日' }))).toEqual([])
  })
})

describe('excerpt', () => {
  it('壓平空白', () => {
    expect(excerpt('a   b\n\tc')).toBe('a b c')
  })

  it('短過上限 → 原文（無省略號）', () => {
    expect(excerpt('短句', 140)).toBe('短句')
    expect(excerpt('exactly10!', 10)).toBe('exactly10!') // 長度 = len，唔加 …
  })

  it('長過上限 → 截斷 + 省略號', () => {
    expect(excerpt('abcdefghij', 5)).toBe('abcde…')
    // 截斷處有尾隨空白先 trimEnd 再加 …
    expect(excerpt('ab cdef', 3)).toBe('ab…')
  })

  it('空字串 → 空字串', () => {
    expect(excerpt('', 140)).toBe('')
  })
})

// ───────────────────────── 連續天數 ─────────────────────────
describe('longestStreak', () => {
  it('空集合 → 0', () => {
    expect(longestStreak(new Set())).toBe(0)
  })

  it('單日 → 1', () => {
    expect(longestStreak(new Set(['2026-05-04']))).toBe(1)
  })

  it('全連續', () => {
    expect(
      longestStreak(new Set(['2026-05-01', '2026-05-02', '2026-05-03'])),
    ).toBe(3)
  })

  it('有斷層，取最長一段（最長段喺尾都計到）', () => {
    expect(
      longestStreak(
        new Set([
          '2026-05-01',
          '2026-05-02', // 段 1：長 2
          '2026-05-04',
          '2026-05-05',
          '2026-05-06', // 段 2：長 3
        ]),
      ),
    ).toBe(3)
  })

  it('亂序輸入照計（內部排序）+ 跨月連續', () => {
    expect(
      longestStreak(
        new Set(['2026-02-01', '2026-01-30', '2026-01-31', '2026-02-02']),
      ),
    ).toBe(4)
  })

  it('全部唔連續 → 1', () => {
    expect(
      longestStreak(new Set(['2026-01-01', '2026-03-01', '2026-06-01'])),
    ).toBe(1)
  })
})

// ───────────────────────── 統計聚合 ─────────────────────────
describe('moodDistribution', () => {
  it('回 5 級（依量表 5→1 次序），含 0 計數', () => {
    const docs = [
      doc({ id: '1', mood: '😀' }),
      doc({ id: '2', mood: '😀' }),
      doc({ id: '3', mood: '😐' }),
      doc({ id: '4' }), // 無心情，唔計
    ]
    const dist = moodDistribution(docs)
    expect(dist.map((x) => x.def.score)).toEqual([5, 4, 3, 2, 1])
    expect(dist.map((x) => x.count)).toEqual([2, 0, 1, 0, 0])
  })

  it('空輸入 → 全 0（仍回 5 項）', () => {
    const dist = moodDistribution([])
    expect(dist).toHaveLength(5)
    expect(dist.every((x) => x.count === 0)).toBe(true)
  })
})

describe('weekdayCounts', () => {
  it('依本地星期分桶（日=0 … 六=6）', () => {
    const docs = [
      doc({ id: '1', date: '2026-05-04' }), // 一
      doc({ id: '2', date: '2026-05-05' }), // 二
      doc({ id: '3', date: '2026-05-11' }), // 一
      doc({ id: '4', date: '2026-05-03' }), // 日
    ]
    // [日,一,二,三,四,五,六] = [1,2,1,0,0,0,0]
    expect(weekdayCounts(docs)).toEqual([1, 2, 1, 0, 0, 0, 0])
  })

  it('空輸入 → 全 0（7 桶）', () => {
    expect(weekdayCounts([])).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
})

// ───────────────────────── 年度熱力圖 ─────────────────────────
describe('buildHeatGrid', () => {
  it('2026：53 週 column，每週 7 格，全部 12 個月標籤', () => {
    const grid = buildHeatGrid([], 2026)
    expect(grid.weeks).toHaveLength(53)
    expect(grid.weeks.every((w) => w.length === 7)).toBe(true)
    // 由 1/1 嗰星期日（2025-12-28）起
    expect(grid.weeks[0][0].key).toBe('2025-12-28')
    expect(grid.weeks[0][0].inYear).toBe(false) // 2025，唔屬該年
    // 12 個月全部有標籤
    expect(grid.monthLabels).toHaveLength(12)
    expect(grid.monthLabels[0]).toEqual({ col: 0, label: '1月' })
  })

  it('正確統計 total / activeDays（只計該年）', () => {
    const docs = [
      doc({ id: '1', date: '2026-01-05' }),
      doc({ id: '2', date: '2026-01-05' }), // 同日第二篇
      doc({ id: '3', date: '2026-03-10' }),
      doc({ id: '4', date: '2025-12-31' }), // 唔屬 2026
      doc({ id: '5', date: '2027-01-01' }), // 唔屬 2026
    ]
    const grid = buildHeatGrid(docs, 2026)
    expect(grid.total).toBe(3) // 2026 篇數
    expect(grid.activeDays).toBe(2) // 2026 唔同日子數（01-05, 03-10）
  })

  it('某格 count = 該日篇數', () => {
    const grid = buildHeatGrid(
      [doc({ id: '1', date: '2026-01-05' }), doc({ id: '2', date: '2026-01-05' })],
      2026,
    )
    const cells = grid.weeks.flat()
    const jan5 = cells.find((c) => c.key === '2026-01-05')
    expect(jan5?.count).toBe(2)
    expect(jan5?.inYear).toBe(true)
  })

  it('無資料 → total / activeDays 都係 0', () => {
    const grid = buildHeatGrid([], 2026)
    expect(grid.total).toBe(0)
    expect(grid.activeDays).toBe(0)
  })
})

describe('heatLevel', () => {
  it('依篇數分 5 級', () => {
    expect(heatLevel(0)).toContain('bg-slate-100')
    expect(heatLevel(1)).toContain('accent/30')
    expect(heatLevel(2)).toContain('accent/55')
    expect(heatLevel(3)).toContain('accent/80')
    expect(heatLevel(4)).toBe('bg-accent dark:bg-accent')
    expect(heatLevel(99)).toBe('bg-accent dark:bg-accent')
  })

  it('負數 / 0 → 最低級（防呆）', () => {
    expect(heatLevel(-3)).toContain('bg-slate-100')
  })
})

// ───────────────────────── Markdown 匯出 ─────────────────────────
describe('toMarkdown', () => {
  it('空輸入 → 只有標題', () => {
    expect(toMarkdown([])).toBe('# 學習日誌\n')
  })

  it('最新喺上（依日期降序）', () => {
    const md = toMarkdown([
      doc({ id: 'old', date: '2026-05-01', content: '舊' }),
      doc({ id: 'new', date: '2026-05-10', content: '新' }),
    ])
    expect(md.indexOf('新')).toBeLessThan(md.indexOf('舊'))
  })

  it('同日多篇：保持輸入次序（comparator 自反，穩定）', () => {
    // 同日 → compare = 0 → stable；修正前同日（date<date 為 false → -1）會反轉
    const md = toMarkdown([
      doc({ id: '1', date: '2026-05-04', content: '先寫' }),
      doc({ id: '2', date: '2026-05-04', content: '後寫' }),
    ])
    expect(md.indexOf('先寫')).toBeLessThan(md.indexOf('後寫'))
  })

  it('有標題用標題做 heading；感恩 + 標籤都出', () => {
    const md = toMarkdown([
      doc({
        date: '2026-05-04',
        title: '我的一天',
        content: '學咗好多 #反思',
        gratitude: '多謝自己',
      }),
    ])
    expect(md).toContain('## 我的一天')
    expect(md).toContain('> 🙏 感恩：多謝自己')
    expect(md).toContain('#反思')
  })

  it('無標題 → 用日期 · 心情 · 天氣做 heading', () => {
    const md = toMarkdown([
      doc({ date: '2026-05-04', mood: '😀', weather: '☀️', content: '正' }),
    ])
    expect(md).toContain('## 2026年5月4日 星期一 · 😀 · ☀️')
  })
})
