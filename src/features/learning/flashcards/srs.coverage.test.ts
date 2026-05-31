import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Card } from '../../../data/types'
import { schedule } from '../../../lib/srs'
import type { CardMeta, DeckPref, ReviewLog } from './types'
import {
  isDueToday,
  buildQueue,
  previewIntervals,
  computeStreak,
  reviewHeatmap,
  dueForecast,
  dailyReviewCounts,
  addDaysKey,
  diffDays,
  retention,
  fmtInterval,
} from './srs'

// ═════════════════════════════════════════════════════════════
//  補充測試：覆蓋 srs.test.ts 未測嘅純函式
//  （reviewHeatmap / dueForecast / dailyReviewCounts / isDueToday /
//   buildQueue srs 模式 / computeStreak current / 揭發疑似 bug）
//  ------------------------------------------------------------
//  注意：呢啲函式好多都依賴 lib/srs.todayStr()（= UTC 當日 date）。
//  為咗確定性，全部用 vi.setSystemTime 鎖死「今日」做一個已知 UTC 日，
//  再用 addDaysKey 由嗰日推導 fixtures，杜絕「跑測試嗰日唔同」嘅漂移。
// ═════════════════════════════════════════════════════════════

// 鎖定一個「今日」：揀月中、UTC 上午 → 唔會掂到月界/年界
const TODAY = '2026-05-15'
// 用 UTC 中午做時戳基準：slice(0,10) 必定 = 嗰日嘅 calendar key
const at = (key: string, hour = 12) =>
  `${key}T${String(hour).padStart(2, '0')}:00:00.000Z`

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(at(TODAY, 8)))
})
afterEach(() => {
  vi.useRealTimers()
})

// ─────────────────────────────────────────────────────────────
//  Fixtures
// ─────────────────────────────────────────────────────────────
const mkCard = (over: Partial<Card>): Card => ({
  id: 'c',
  deckId: 'd',
  front: 'f',
  back: 'b',
  ease: 2.5,
  intervalDays: 0,
  repetitions: 0,
  dueDate: TODAY,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

const mkMeta = (over: Partial<CardMeta>): CardMeta => ({
  id: 'c',
  tags: [],
  suspended: false,
  flagged: false,
  lapses: 0,
  updatedAt: '',
  ...over,
})

const mkLog = (over: Partial<ReviewLog>): ReviewLog => ({
  id: 'l',
  cardId: 'c',
  deckId: 'd',
  ts: at(TODAY),
  rating: 'good',
  prevInterval: 1,
  newInterval: 6,
  elapsedMs: 1000,
  mode: 'srs',
  ...over,
})

const mkPref = (over: Partial<DeckPref>): DeckPref => ({
  id: 'd',
  newPerDay: 20,
  reviewPerDay: 0,
  order: 'added',
  ...over,
})

// ═════════════════════════════════════════════════════════════
//  isDueToday（字串比較；todayStr 為 UTC 當日）
// ═════════════════════════════════════════════════════════════
describe('isDueToday（dueDate <= 今日 為到期，inclusive）', () => {
  it('dueDate < today（逾期）→ true', () => {
    expect(isDueToday(mkCard({ dueDate: addDaysKey(TODAY, -1) }))).toBe(true)
    expect(isDueToday(mkCard({ dueDate: addDaysKey(TODAY, -30) }))).toBe(true)
  })
  it('dueDate === today（邊界，inclusive）→ true', () => {
    expect(isDueToday(mkCard({ dueDate: TODAY }))).toBe(true)
  })
  it('dueDate > today（未到）→ false', () => {
    expect(isDueToday(mkCard({ dueDate: addDaysKey(TODAY, 1) }))).toBe(false)
    expect(isDueToday(mkCard({ dueDate: addDaysKey(TODAY, 99) }))).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════
//  buildQueue —— srs / typed 模式（依賴「今日」，故鎖時鐘）
//  srs.test.ts 只測咗 cram / starred；呢度補晒到期 + 新卡上限。
// ═════════════════════════════════════════════════════════════
describe('buildQueue（srs / typed —— 到期過濾 + 每日新卡上限）', () => {
  it('srs：只出到期卡（dueDate <= 今日）；未到期唔出', () => {
    const cards: Card[] = [
      mkCard({ id: 'dueOld', repetitions: 3, dueDate: addDaysKey(TODAY, -2) }),
      mkCard({ id: 'dueNow', repetitions: 3, dueDate: TODAY }),
      mkCard({ id: 'future', repetitions: 3, dueDate: addDaysKey(TODAY, 5) }),
    ]
    const q = buildQueue({
      deckId: 'd',
      cards,
      metas: [],
      pref: mkPref({ order: 'added' }),
      mode: 'srs',
    })
    expect(q).toEqual(['dueOld', 'dueNow'])
    expect(q).not.toContain('future')
  })

  it('srs：到期複習卡 + 受 newPerDay 限制嘅新卡（新卡 slice 截斷）', () => {
    // 3 張到期新卡（reps 0），newPerDay=2 → 只引入頭 2 張
    const cards: Card[] = [
      mkCard({ id: 'rev', repetitions: 4, dueDate: TODAY }),
      mkCard({ id: 'n1', repetitions: 0, dueDate: TODAY }),
      mkCard({ id: 'n2', repetitions: 0, dueDate: TODAY }),
      mkCard({ id: 'n3', repetitions: 0, dueDate: TODAY }),
    ]
    const q = buildQueue({
      deckId: 'd',
      cards,
      metas: [],
      pref: mkPref({ newPerDay: 2, order: 'added' }),
      mode: 'srs',
    })
    // reviewDue: rev；newDue slice(0,2): n1,n2（n3 被截）
    expect(q).toContain('rev')
    expect(q).toContain('n1')
    expect(q).toContain('n2')
    expect(q).not.toContain('n3')
    expect(q.length).toBe(3)
  })

  it('srs：newPerDay = 0 → 一張新卡都唔出（只出複習卡）', () => {
    const cards: Card[] = [
      mkCard({ id: 'rev', repetitions: 4, dueDate: TODAY }),
      mkCard({ id: 'new', repetitions: 0, dueDate: TODAY }),
    ]
    const q = buildQueue({
      deckId: 'd',
      cards,
      metas: [],
      pref: mkPref({ newPerDay: 0, order: 'added' }),
      mode: 'srs',
    })
    expect(q).toEqual(['rev'])
  })

  it('srs：newPerDay 負數 → Math.max(0,…) 防護，等同 0', () => {
    const cards: Card[] = [
      mkCard({ id: 'new1', repetitions: 0, dueDate: TODAY }),
      mkCard({ id: 'new2', repetitions: 0, dueDate: TODAY }),
    ]
    const q = buildQueue({
      deckId: 'd',
      cards,
      metas: [],
      pref: mkPref({ newPerDay: -5, order: 'added' }),
      mode: 'srs',
    })
    expect(q).toEqual([])
  })

  it('srs：暫停卡唔出（即使到期）', () => {
    const cards: Card[] = [
      mkCard({ id: 'a', repetitions: 3, dueDate: TODAY }),
      mkCard({ id: 'susp', repetitions: 3, dueDate: TODAY }),
    ]
    const metas: CardMeta[] = [mkMeta({ id: 'susp', suspended: true })]
    const q = buildQueue({
      deckId: 'd',
      cards,
      metas,
      pref: mkPref({ order: 'added' }),
      mode: 'srs',
    })
    expect(q).toEqual(['a'])
  })

  it('srs：別牌組卡排除', () => {
    const cards: Card[] = [
      mkCard({ id: 'mine', repetitions: 3, deckId: 'd', dueDate: TODAY }),
      mkCard({ id: 'other', repetitions: 3, deckId: 'OTHER', dueDate: TODAY }),
    ]
    const q = buildQueue({
      deckId: 'd',
      cards,
      metas: [],
      pref: mkPref({ order: 'added' }),
      mode: 'srs',
    })
    expect(q).toEqual(['mine'])
  })

  it('typed 模式同 srs 一樣到期過濾 + 新卡上限', () => {
    const cards: Card[] = [
      mkCard({ id: 'rev', repetitions: 4, dueDate: TODAY }),
      mkCard({ id: 'n1', repetitions: 0, dueDate: TODAY }),
      mkCard({ id: 'n2', repetitions: 0, dueDate: TODAY }),
      mkCard({ id: 'future', repetitions: 3, dueDate: addDaysKey(TODAY, 3) }),
    ]
    const q = buildQueue({
      deckId: 'd',
      cards,
      metas: [],
      pref: mkPref({ newPerDay: 1, order: 'added' }),
      mode: 'typed',
    })
    expect(q).not.toContain('future')
    expect(q).toContain('rev')
    // newPerDay=1 → 只一張新卡
    const news = q.filter((id) => id === 'n1' || id === 'n2')
    expect(news.length).toBe(1)
  })

  it('srs + order=due：到期卡按 dueDate 升序排（slice 後再排）', () => {
    const cards: Card[] = [
      mkCard({ id: 'late', repetitions: 3, dueDate: TODAY }),
      mkCard({ id: 'old', repetitions: 3, dueDate: addDaysKey(TODAY, -3) }),
      mkCard({ id: 'mid', repetitions: 3, dueDate: addDaysKey(TODAY, -1) }),
    ]
    const q = buildQueue({
      deckId: 'd',
      cards,
      metas: [],
      pref: mkPref({ order: 'due' }),
      mode: 'srs',
    })
    expect(q).toEqual(['old', 'mid', 'late'])
  })
})

// ═════════════════════════════════════════════════════════════
//  computeStreak —— current 分支（srs.test.ts 只測 best）
// ═════════════════════════════════════════════════════════════
describe('computeStreak（current：由今日／昨日往回數）', () => {
  it('今日有複習 + 連續往前 → current 數到斷裂為止', () => {
    const r = computeStreak([
      mkLog({ ts: at(addDaysKey(TODAY, -2)) }),
      mkLog({ ts: at(addDaysKey(TODAY, -1)) }),
      mkLog({ ts: at(TODAY) }),
    ])
    expect(r.current).toBe(3)
    expect(r.best).toBe(3)
  })

  it('今日無、但昨日有 → current 由昨日起計', () => {
    const r = computeStreak([
      mkLog({ ts: at(addDaysKey(TODAY, -2)) }),
      mkLog({ ts: at(addDaysKey(TODAY, -1)) }),
    ])
    expect(r.current).toBe(2)
  })

  it('今日同昨日皆無 → current 0（但 best 仍係舊段長度）', () => {
    const r = computeStreak([
      mkLog({ ts: at(addDaysKey(TODAY, -10)) }),
      mkLog({ ts: at(addDaysKey(TODAY, -9)) }),
      mkLog({ ts: at(addDaysKey(TODAY, -8)) }),
    ])
    expect(r.current).toBe(0)
    expect(r.best).toBe(3)
  })

  it('current 遇斷裂即停（今日有、前日缺一格）', () => {
    const r = computeStreak([
      mkLog({ ts: at(addDaysKey(TODAY, -5)) }), // 孤立舊段
      mkLog({ ts: at(addDaysKey(TODAY, -1)) }),
      mkLog({ ts: at(TODAY) }),
    ])
    // current：今日→昨日連續 = 2；再前一格(−2)冇 → 停
    expect(r.current).toBe(2)
  })

  it('單日（只今日）→ current 1 best 1', () => {
    const r = computeStreak([mkLog({ ts: at(TODAY) })])
    expect(r).toEqual({ current: 1, best: 1 })
  })

  it('同日多次複習唔會令 current >1（去重）', () => {
    const r = computeStreak([
      mkLog({ ts: at(TODAY, 8) }),
      mkLog({ ts: at(TODAY, 20) }),
    ])
    expect(r.current).toBe(1)
  })
})

// ═════════════════════════════════════════════════════════════
//  reviewHeatmap —— srs.test.ts 完全未測
// ═════════════════════════════════════════════════════════════
describe('reviewHeatmap（過去 N 日每日複習數）', () => {
  it('空 logs → N 格全部 count 0（格數 === days）', () => {
    const h = reviewHeatmap([], 30)
    expect(h.length).toBe(30)
    expect(h.every((c) => c.count === 0)).toBe(true)
  })

  it('輸出格數 === days，最後一格係今日', () => {
    const h = reviewHeatmap([], 10)
    expect(h.length).toBe(10)
    expect(h[h.length - 1].key).toBe(TODAY)
    expect(h[0].key).toBe(addDaysKey(TODAY, -9))
  })

  it('同日多 log 累加到同一格', () => {
    const h = reviewHeatmap(
      [
        mkLog({ ts: at(TODAY, 8) }),
        mkLog({ ts: at(TODAY, 12) }),
        mkLog({ ts: at(TODAY, 20) }),
      ],
      7,
    )
    expect(h[h.length - 1]).toEqual({ key: TODAY, count: 3 })
    // 其餘格 0
    expect(h.slice(0, -1).every((c) => c.count === 0)).toBe(true)
  })

  it('範圍外（>N 日前）嘅 log 唔計入；範圍內正確落格', () => {
    const within = addDaysKey(TODAY, -3)
    const outside = addDaysKey(TODAY, -50)
    const h = reviewHeatmap(
      [mkLog({ ts: at(within) }), mkLog({ ts: at(outside) })],
      7,
    )
    const total = h.reduce((s, c) => s + c.count, 0)
    expect(total).toBe(1) // outside 唔計
    expect(h.find((c) => c.key === within)?.count).toBe(1)
  })

  it('days = 1 → 只今日一格', () => {
    const h = reviewHeatmap([mkLog({ ts: at(TODAY) })], 1)
    expect(h).toEqual([{ key: TODAY, count: 1 }])
  })

  it('預設 days = 119', () => {
    expect(reviewHeatmap([]).length).toBe(119)
  })
})

// ═════════════════════════════════════════════════════════════
//  dueForecast —— srs.test.ts 完全未測
// ═════════════════════════════════════════════════════════════
describe('dueForecast（未來 N 日將到期卡數，分 young / mature）', () => {
  it('空卡 → N 個桶全 0', () => {
    const f = dueForecast([], [], 14)
    expect(f.length).toBe(14)
    expect(f.every((b) => b.young === 0 && b.mature === 0)).toBe(true)
  })

  it('label：i0 = 今日、i1 = 聽日、其餘 = +i', () => {
    const f = dueForecast([], [], 5)
    expect(f.map((b) => b.label)).toEqual(['今日', '聽日', '+2', '+3', '+4'])
    expect(f[0].key).toBe(TODAY)
    expect(f[1].key).toBe(addDaysKey(TODAY, 1))
  })

  it('新卡（reps 0）唔計入預測', () => {
    const cards: Card[] = [
      mkCard({ id: 'new', repetitions: 0, intervalDays: 0, dueDate: TODAY }),
    ]
    const f = dueForecast(cards, [], 14)
    expect(f.every((b) => b.young === 0 && b.mature === 0)).toBe(true)
  })

  it('暫停卡唔計入', () => {
    const cards: Card[] = [
      mkCard({ id: 'susp', repetitions: 3, intervalDays: 5, dueDate: TODAY }),
    ]
    const metas: CardMeta[] = [mkMeta({ id: 'susp', suspended: true })]
    const f = dueForecast(cards, metas, 14)
    expect(f[0].young).toBe(0)
    expect(f[0].mature).toBe(0)
  })

  it('逾期卡（dueDate < 今日）全部歸今日桶（i=0）', () => {
    const cards: Card[] = [
      mkCard({ id: 'over', repetitions: 3, intervalDays: 5, dueDate: addDaysKey(TODAY, -10) }),
    ]
    const f = dueForecast(cards, [], 14)
    expect(f[0].young).toBe(1)
    // 其餘桶唔受影響
    expect(f.slice(1).every((b) => b.young === 0 && b.mature === 0)).toBe(true)
  })

  it('到期日喺範圍外（>N 日後）→ 搵唔到桶，唔計入', () => {
    const cards: Card[] = [
      mkCard({ id: 'far', repetitions: 3, intervalDays: 5, dueDate: addDaysKey(TODAY, 100) }),
    ]
    const f = dueForecast(cards, [], 14)
    expect(f.every((b) => b.young === 0 && b.mature === 0)).toBe(true)
  })

  it('interval === 21（MATURE_DAYS 邊界）算 mature；< 21 算 young', () => {
    const cards: Card[] = [
      mkCard({ id: 'mat', repetitions: 5, intervalDays: 21, dueDate: addDaysKey(TODAY, 2) }),
      mkCard({ id: 'yng', repetitions: 3, intervalDays: 20, dueDate: addDaysKey(TODAY, 2) }),
    ]
    const f = dueForecast(cards, [], 14)
    expect(f[2].mature).toBe(1)
    expect(f[2].young).toBe(1)
  })

  it('多卡分散落唔同桶', () => {
    const cards: Card[] = [
      mkCard({ id: 'a', repetitions: 3, intervalDays: 5, dueDate: TODAY }),
      mkCard({ id: 'b', repetitions: 3, intervalDays: 30, dueDate: addDaysKey(TODAY, 1) }),
      mkCard({ id: 'c2', repetitions: 3, intervalDays: 30, dueDate: addDaysKey(TODAY, 1) }),
    ]
    const f = dueForecast(cards, [], 14)
    expect(f[0].young).toBe(1)
    expect(f[1].mature).toBe(2)
  })

  it('預設 days = 14', () => {
    expect(dueForecast([], []).length).toBe(14)
  })
})

// ═════════════════════════════════════════════════════════════
//  dailyReviewCounts —— srs.test.ts 完全未測
// ═════════════════════════════════════════════════════════════
describe('dailyReviewCounts（過去 N 日每日複習量，label = 兩位日字串）', () => {
  it('空 logs → N 格全 0', () => {
    const d = dailyReviewCounts([], 14)
    expect(d.length).toBe(14)
    expect(d.every((x) => x.count === 0)).toBe(true)
  })

  it('輸出格數 === days，最後一格係今日', () => {
    const d = dailyReviewCounts([], 7)
    expect(d.length).toBe(7)
    expect(d[d.length - 1].key).toBe(TODAY)
  })

  it('label 係兩位日字串（dd）', () => {
    const d = dailyReviewCounts([], 7)
    // TODAY = 2026-05-15 → 今日 label = '15'
    expect(d[d.length - 1].label).toBe('15')
    // 全部 label 長度 2
    expect(d.every((x) => x.label.length === 2)).toBe(true)
  })

  it('同日多 log 累加', () => {
    const d = dailyReviewCounts(
      [mkLog({ ts: at(TODAY, 8) }), mkLog({ ts: at(TODAY, 20) })],
      7,
    )
    expect(d[d.length - 1].count).toBe(2)
  })

  it('範圍外 log 唔計入', () => {
    const d = dailyReviewCounts(
      [
        mkLog({ ts: at(addDaysKey(TODAY, -2)) }),
        mkLog({ ts: at(addDaysKey(TODAY, -40)) }),
      ],
      7,
    )
    const total = d.reduce((s, x) => s + x.count, 0)
    expect(total).toBe(1)
  })

  it('預設 days = 14', () => {
    expect(dailyReviewCounts([]).length).toBe(14)
  })
})

// ═════════════════════════════════════════════════════════════
//  Bug 1（已修）：previewIntervals 'easy' 須對齊 lib/srs.schedule
//  ------------------------------------------------------------
//  修正前 preview 用舊 ease（factor = ease*1.3），少報約 1 日；
//  修正後用 (ease+0.15)*1.3，同 schedule('easy') 嘅 intervalDays 一致。
//  呢組測試直接攞 schedule 嘅實際排程做 oracle，鎖死一致性。
// ═════════════════════════════════════════════════════════════
describe('previewIntervals（easy 對齊 schedule —— 揭發並鎖住 bug 1 修正）', () => {
  // 用 fmtInterval 把 schedule 算出嘅日數轉成同 preview 一樣嘅顯示
  const expectMatchesSchedule = (card: Card, rating: 'hard' | 'good' | 'easy') => {
    const sched = schedule(card, rating)
    const expected = fmtInterval(sched.intervalDays as number)
    expect(previewIntervals(card)[rating]).toBe(expected)
  }

  it('reps≥2 easy：cur=6 ease=2.5 → 21 日（修前係 20 日，顯示層可見差異）', () => {
    // 呢個 case 修前後格式化字串會唔同（20 日 → 21 日），最能直接揭發 bug 1。
    const card = mkCard({ repetitions: 3, intervalDays: 6, ease: 2.5, dueDate: TODAY })
    // schedule oracle：round(6·(2.5+0.15)·1.3)=round(20.67)=21
    expect(schedule(card, 'easy').intervalDays).toBe(21)
    expect(previewIntervals(card).easy).toBe('21 日')
  })

  it('reps≥2 easy：cur=10 ease=2.5 → schedule 排 34 日（interval 層揭發；顯示同為「1 個月」）', () => {
    const card = mkCard({ repetitions: 5, intervalDays: 10, ease: 2.5, dueDate: TODAY })
    // 修前 preview interval = round(10·2.5·1.3)=33；修後 = round(10·2.65·1.3)=34，
    // 對齊 schedule 嘅 34。呢個區間兩者 fmtInterval 都係「1 個月」，故以 schedule 做 oracle。
    expect(schedule(card, 'easy').intervalDays).toBe(34)
    expect(previewIntervals(card).easy).toBe(fmtInterval(34))
    expect(previewIntervals(card).easy).toBe('1 個月')
  })

  it('easy 與 schedule 跨多組 cur/ease 全部一致', () => {
    const cases: [number, number][] = [
      [6, 2.5],
      [10, 2.5],
      [15, 2.5],
      [6, 2.0],
      [100, 1.3], // ease 已到下限
      [40, 3.0],
    ]
    for (const [cur, ease] of cases) {
      const card = mkCard({ repetitions: 4, intervalDays: cur, ease, dueDate: TODAY })
      expectMatchesSchedule(card, 'easy')
    }
  })

  it('hard / good 分支本身已正確（複查確認），亦與 schedule 一致', () => {
    const cases: [number, number][] = [
      [6, 2.5],
      [10, 2.5],
      [30, 2.2],
    ]
    for (const [cur, ease] of cases) {
      const card = mkCard({ repetitions: 4, intervalDays: cur, ease, dueDate: TODAY })
      expectMatchesSchedule(card, 'hard')
      expectMatchesSchedule(card, 'good')
    }
  })

  it('reps 0 / reps 1 嘅 easy 同 schedule 一致（3 / 8 日）', () => {
    const c0 = mkCard({ repetitions: 0, intervalDays: 0, ease: 2.5, dueDate: TODAY })
    expect(schedule(c0, 'easy').intervalDays).toBe(3)
    expect(previewIntervals(c0).easy).toBe('3 日')
    const c1 = mkCard({ repetitions: 1, intervalDays: 1, ease: 2.5, dueDate: TODAY })
    expect(schedule(c1, 'easy').intervalDays).toBe(8)
    expect(previewIntervals(c1).easy).toBe('8 日')
  })
})

// ═════════════════════════════════════════════════════════════
//  Bug 3（已修）：buildQueue 施行 reviewPerDay 上限（0 = 不限）
//  ------------------------------------------------------------
//  修正前 reviewPerDay 喺 buildQueue 完全冇被讀取，設幾多都無效。
//  修正後：>0 時截斷到期複習卡；=0 維持不限（預設行為不變）。
// ═════════════════════════════════════════════════════════════
describe('buildQueue（reviewPerDay 上限 —— 揭發並鎖住 bug 3 修正）', () => {
  const mkReviewCards = (n: number): Card[] =>
    Array.from({ length: n }, (_, i) =>
      mkCard({ id: `r${i}`, repetitions: 3, dueDate: TODAY }),
    )

  it('reviewPerDay = 0（預設）→ 不限：全部到期複習卡都出', () => {
    const cards = mkReviewCards(5)
    const q = buildQueue({
      deckId: 'd',
      cards,
      metas: [],
      pref: mkPref({ reviewPerDay: 0, order: 'added' }),
      mode: 'srs',
    })
    expect(q.length).toBe(5)
  })

  it('reviewPerDay = 2 → 到期複習卡截斷到 2 張', () => {
    const cards = mkReviewCards(5)
    const q = buildQueue({
      deckId: 'd',
      cards,
      metas: [],
      pref: mkPref({ reviewPerDay: 2, order: 'added' }),
      mode: 'srs',
    })
    expect(q.length).toBe(2)
    // order=added、createdAt 全部一樣 → 穩定排序保留前 2 張 r0,r1
    expect(q).toEqual(['r0', 'r1'])
  })

  it('reviewPerDay 上限只截複習卡，唔影響新卡上限', () => {
    const cards: Card[] = [
      ...mkReviewCards(4), // r0..r3 複習卡
      mkCard({ id: 'n1', repetitions: 0, dueDate: TODAY }),
      mkCard({ id: 'n2', repetitions: 0, dueDate: TODAY }),
    ]
    const q = buildQueue({
      deckId: 'd',
      cards,
      metas: [],
      pref: mkPref({ reviewPerDay: 1, newPerDay: 5, order: 'added' }),
      mode: 'srs',
    })
    // 複習卡截到 1（r0）+ 新卡 2 張全出
    const reviews = q.filter((id) => id.startsWith('r'))
    const news = q.filter((id) => id === 'n1' || id === 'n2')
    expect(reviews.length).toBe(1)
    expect(news.length).toBe(2)
  })

  it('reviewPerDay 大過實際到期數 → 全部出（唔會報錯/補空）', () => {
    const cards = mkReviewCards(3)
    const q = buildQueue({
      deckId: 'd',
      cards,
      metas: [],
      pref: mkPref({ reviewPerDay: 99, order: 'added' }),
      mode: 'srs',
    })
    expect(q.length).toBe(3)
  })

  it('cram 模式唔受 reviewPerDay 限制（衝刺要全部卡）', () => {
    const cards = mkReviewCards(5)
    const q = buildQueue({
      deckId: 'd',
      cards,
      metas: [],
      pref: mkPref({ reviewPerDay: 2, order: 'added' }),
      mode: 'cram',
    })
    expect(q.length).toBe(5)
  })
})

// ═════════════════════════════════════════════════════════════
//  Bug 4（已記錄，未修）：newPerDay 係「每次 session」非「每日曆日」
//  ------------------------------------------------------------
//  buildQueue 冇參考當日已引入嘅新卡數，同一日入兩次都會再引入最多
//  newPerDay 張。呢度用測試「揭發 / 釘住」現狀：連續兩次 buildQueue
//  都各自畀足 newPerDay 張新卡（無扣減）。
//  保守起見唔修：正解要 buildQueue 讀 reviewLog 算當日已引入數
//  （改函式契約 + 改 ReviewScreen 呼叫位），超出「最小改一行/加 guard」
//  範圍、風險高，故只記錄為已知限制（見回報 summary）。
// ═════════════════════════════════════════════════════════════
describe('buildQueue（newPerDay 每 session 語義 —— 記錄 bug 4 現狀）', () => {
  it('同一日連續兩次 buildQueue 各自畀足 newPerDay 張新卡（無跨次扣減）', () => {
    const cards: Card[] = [
      mkCard({ id: 'n1', repetitions: 0, dueDate: TODAY }),
      mkCard({ id: 'n2', repetitions: 0, dueDate: TODAY }),
      mkCard({ id: 'n3', repetitions: 0, dueDate: TODAY }),
      mkCard({ id: 'n4', repetitions: 0, dueDate: TODAY }),
    ]
    const pref = mkPref({ newPerDay: 2, order: 'added' })
    const opts = { deckId: 'd', cards, metas: [], pref, mode: 'srs' as const }

    const first = buildQueue(opts)
    const second = buildQueue(opts)

    // 第一 session 引入 2 張
    expect(first.length).toBe(2)
    // 第二 session 同樣引入 2 張（理想 Anki 語義應為 0，因當日額度已用盡）
    expect(second.length).toBe(2)
    // 揭發點：兩次合計 4 張 > 設定嘅每日 2 張上限
    expect(first.length + second.length).toBe(4)
  })
})

// ═════════════════════════════════════════════════════════════
//  補充：純日曆工具額外邊界（唔依賴時鐘，補 srs.test.ts 嘅缺口）
// ═════════════════════════════════════════════════════════════
describe('addDaysKey / diffDays（額外邊界）', () => {
  it('addDaysKey 負數大跨度：2027-01-01 -365 = 2026-01-01', () => {
    expect(addDaysKey('2027-01-01', -365)).toBe('2026-01-01')
  })
  it('addDaysKey 跨年回退：2026-01-01 -1 兩步驗證', () => {
    expect(addDaysKey('2026-03-01', -1)).toBe('2026-02-28') // 平年
    expect(addDaysKey('2024-03-01', -1)).toBe('2024-02-29') // 閏年
  })
  it('diffDays 秋季 DST 結束附近仍準（用本地正午）', () => {
    // 美國 2026 秋季 DST 結束 11-01；跨埋呢日唔可以 off-by-one
    expect(diffDays('2026-11-03', '2026-10-31')).toBe(3)
  })
  it('diffDays 跨年：2027-01-02 vs 2026-12-31 = 2', () => {
    expect(diffDays('2027-01-02', '2026-12-31')).toBe(2)
  })
})

// ═════════════════════════════════════════════════════════════
//  補充：retention 額外邊界（0% 但 total>0、非整除精度）
// ═════════════════════════════════════════════════════════════
describe('retention（額外邊界）', () => {
  it('全部答 again → rate 0% 但 total > 0', () => {
    const r = retention([
      mkLog({ prevInterval: 6, rating: 'again' }),
      mkLog({ prevInterval: 10, rating: 'again' }),
    ])
    expect(r.total).toBe(2)
    expect(r.pass).toBe(0)
    expect(r.rate).toBe(0)
  })
  it('×100 係百分比（1/2 = 50%）', () => {
    const r = retention([
      mkLog({ prevInterval: 6, rating: 'good' }),
      mkLog({ prevInterval: 6, rating: 'again' }),
    ])
    expect(r.rate).toBe(50)
  })
})
