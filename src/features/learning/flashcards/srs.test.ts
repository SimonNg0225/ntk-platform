import { describe, it, expect } from 'vitest'
import type { Card } from '../../../data/types'
import type { CardMeta, DeckPref, ReviewLog } from './types'
import {
  MATURE_DAYS,
  LEECH_LAPSES,
  dayKey,
  addDaysKey,
  diffDays,
  DEFAULT_PREF,
  prefOf,
  metaOf,
  cardState,
  isLeech,
  buildQueue,
  previewIntervals,
  fmtInterval,
  computeStreak,
  retention,
  answerBreakdown,
  stateBreakdown,
  intervalHistogram,
} from './srs'

// ─────────────────────────────────────────────────────────────
//  Test fixtures（最小化、只覆寫關心嘅欄位）
// ─────────────────────────────────────────────────────────────
const mkCard = (over: Partial<Card>): Card => ({
  id: 'c',
  deckId: 'd',
  front: 'f',
  back: 'b',
  ease: 2.5,
  intervalDays: 0,
  repetitions: 0,
  dueDate: '2026-01-01',
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
  ts: '2026-01-01T10:00:00.000Z',
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
//  本地日期工具（時區安全 — 明確日期字串，確認本地、無 UTC 漂移）
// ═════════════════════════════════════════════════════════════
describe('dayKey（本地日期，無 UTC off-by-one）', () => {
  it('用本地年月日，唔係 UTC：2026-05-04 本地 00:30 仍係 05-04', () => {
    // new Date(2026, 4, 4, 0, 30) 係本地時間。若用 toISOString（UTC）喺 UTC+X
    // 時區會變成前一日 → 呢度確認用本地欄位，永遠 2026-05-04。
    expect(dayKey(new Date(2026, 4, 4, 0, 30, 0))).toBe('2026-05-04')
    expect(dayKey(new Date(2026, 4, 4, 23, 30, 0))).toBe('2026-05-04')
  })

  it('月 / 日補零', () => {
    expect(dayKey(new Date(2026, 0, 1, 12))).toBe('2026-01-01')
    expect(dayKey(new Date(2026, 8, 9, 12))).toBe('2026-09-09')
    expect(dayKey(new Date(2026, 11, 31, 12))).toBe('2026-12-31')
  })
})

describe('addDaysKey（純日曆加減，跨月跨年跨閏）', () => {
  it('加 0 = 自己', () => {
    expect(addDaysKey('2026-05-04', 0)).toBe('2026-05-04')
  })
  it('跨年：2026-12-31 +1 = 2027-01-01', () => {
    expect(addDaysKey('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('回到上年：2026-01-01 -1 = 2025-12-31', () => {
    expect(addDaysKey('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('跨月', () => {
    expect(addDaysKey('2026-05-31', 1)).toBe('2026-06-01')
  })
  it('閏年 2 月 29（2024 係閏年）', () => {
    expect(addDaysKey('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDaysKey('2024-02-29', 1)).toBe('2024-03-01')
  })
  it('平年 2 月（2026 唔係閏年）：2-28 +1 = 3-1', () => {
    expect(addDaysKey('2026-02-28', 1)).toBe('2026-03-01')
  })
  it('大跨度', () => {
    expect(addDaysKey('2026-01-01', 365)).toBe('2027-01-01')
  })
})

describe('diffDays（b 為基準，a-b 日數差）', () => {
  it('正差', () => {
    expect(diffDays('2026-05-04', '2026-05-01')).toBe(3)
  })
  it('同日 = 0', () => {
    expect(diffDays('2026-05-04', '2026-05-04')).toBe(0)
  })
  it('負差', () => {
    expect(diffDays('2026-05-01', '2026-05-04')).toBe(-3)
  })
  it('跨月', () => {
    expect(diffDays('2026-06-01', '2026-05-31')).toBe(1)
  })
  it('跨夏令時間轉換仍準確（用本地正午，避開 DST ±1 小時）', () => {
    // 美國 2026 DST 開始 = 3 月 8 日；若用本地午夜會被 DST 推前/後一小時，
    // round 後可能變 off-by-one。用正午就穩陣 → 必須 = 2。
    expect(diffDays('2026-03-09', '2026-03-07')).toBe(2)
    // 秋季 DST 結束 = 11 月 1 日。
    expect(diffDays('2026-11-02', '2026-10-31')).toBe(2)
  })
})

// ═════════════════════════════════════════════════════════════
//  常數 / 預設
// ═════════════════════════════════════════════════════════════
describe('常數', () => {
  it('MATURE_DAYS = 21（Anki 熟卡門檻）', () => {
    expect(MATURE_DAYS).toBe(21)
  })
  it('LEECH_LAPSES = 4', () => {
    expect(LEECH_LAPSES).toBe(4)
  })
})

describe('prefOf', () => {
  it('搵到就回該設定', () => {
    const p = mkPref({ id: 'deck1', newPerDay: 5 })
    expect(prefOf([p], 'deck1')).toBe(p)
  })
  it('搵唔到回 DEFAULT_PREF + id（空陣列）', () => {
    expect(prefOf([], 'deckX')).toEqual({ id: 'deckX', ...DEFAULT_PREF })
    expect(prefOf([], 'deckX')).toEqual({
      id: 'deckX',
      newPerDay: 20,
      reviewPerDay: 0,
      order: 'due',
    })
  })
})

describe('metaOf', () => {
  it('搵到就回該 meta', () => {
    const m = mkMeta({ id: 'card1', lapses: 2 })
    expect(metaOf([m], 'card1')).toBe(m)
  })
  it('搵唔到回乾淨預設 meta（空陣列）', () => {
    expect(metaOf([], 'cardX')).toEqual({
      id: 'cardX',
      tags: [],
      suspended: false,
      flagged: false,
      lapses: 0,
      updatedAt: '',
    })
  })
})

// ═════════════════════════════════════════════════════════════
//  卡片狀態推導
// ═════════════════════════════════════════════════════════════
describe('cardState', () => {
  it('暫停優先於一切（即使有複習紀錄）', () => {
    expect(
      cardState(mkCard({ repetitions: 5, intervalDays: 100 }), mkMeta({ suspended: true })),
    ).toBe('suspended')
  })
  it('repetitions === 0 → new（即使無 meta）', () => {
    expect(cardState(mkCard({ repetitions: 0, intervalDays: 0 }))).toBe('new')
  })
  it('intervalDays < 1 → learning', () => {
    expect(cardState(mkCard({ repetitions: 1, intervalDays: 0 }))).toBe('learning')
    expect(cardState(mkCard({ repetitions: 1, intervalDays: 0.5 }))).toBe('learning')
  })
  it('1 ≤ interval < 21 → young（邊界 1 與 20）', () => {
    expect(cardState(mkCard({ repetitions: 2, intervalDays: 1 }))).toBe('young')
    expect(cardState(mkCard({ repetitions: 2, intervalDays: 20 }))).toBe('young')
  })
  it('interval === 21（MATURE_DAYS 邊界）→ mature', () => {
    expect(cardState(mkCard({ repetitions: 2, intervalDays: 21 }))).toBe('mature')
  })
  it('interval > 21 → mature', () => {
    expect(cardState(mkCard({ repetitions: 3, intervalDays: 200 }))).toBe('mature')
  })
})

describe('isLeech', () => {
  it('lapses < 4 → 非 leech', () => {
    expect(isLeech(mkMeta({ lapses: 3 }))).toBe(false)
  })
  it('lapses === 4（LEECH_LAPSES 邊界）→ leech', () => {
    expect(isLeech(mkMeta({ lapses: 4 }))).toBe(true)
  })
  it('lapses > 4 → leech', () => {
    expect(isLeech(mkMeta({ lapses: 9 }))).toBe(true)
  })
  it('無 meta（undefined）→ 當 lapses 0 → 非 leech', () => {
    expect(isLeech(undefined)).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════
//  隊列建構（只測唔依賴「今日」嘅 cram / starred 模式）
// ═════════════════════════════════════════════════════════════
describe('buildQueue（cram / starred — 不依賴系統時間）', () => {
  const cards: Card[] = [
    mkCard({ id: 'a', deckId: 'd', createdAt: '2026-01-03T00:00:00Z' }),
    mkCard({ id: 'b', deckId: 'd', createdAt: '2026-01-01T00:00:00Z' }),
    mkCard({ id: 'susp', deckId: 'd', createdAt: '2026-01-02T00:00:00Z' }),
    mkCard({ id: 'other', deckId: 'OTHER', createdAt: '2026-01-00T00:00:00Z' }),
  ]
  const metas: CardMeta[] = [
    mkMeta({ id: 'susp', suspended: true }),
    mkMeta({ id: 'a', flagged: true }),
  ]

  it('cram：同牌組全部卡（排除暫停、排除其他牌組）', () => {
    const q = buildQueue({ deckId: 'd', cards, metas, pref: mkPref({ order: 'added' }), mode: 'cram' })
    // 排除 susp（暫停）+ other（別牌組）；order=added 按 createdAt：b(01-01) → a(01-03)
    expect(q).toEqual(['b', 'a'])
  })

  it('cram + order=added：嚴格按 createdAt 升序', () => {
    const q = buildQueue({ deckId: 'd', cards, metas, pref: mkPref({ order: 'added' }), mode: 'cram' })
    expect(q).toEqual(['b', 'a'])
  })

  it('starred：只揀 flagged 卡', () => {
    const q = buildQueue({ deckId: 'd', cards, metas, pref: mkPref({ order: 'added' }), mode: 'starred' })
    expect(q).toEqual(['a'])
  })

  it('starred：無任何 flagged → 空陣列', () => {
    const q = buildQueue({
      deckId: 'd',
      cards,
      metas: [mkMeta({ id: 'susp', suspended: true })],
      pref: mkPref({}),
      mode: 'starred',
    })
    expect(q).toEqual([])
  })

  it('暫停卡喺 cram 都唔出（對齊 Anki）', () => {
    const q = buildQueue({ deckId: 'd', cards, metas, pref: mkPref({ order: 'added' }), mode: 'cram' })
    expect(q).not.toContain('susp')
  })

  it('空卡陣列 → 空隊列', () => {
    expect(buildQueue({ deckId: 'd', cards: [], metas: [], pref: mkPref({}), mode: 'cram' })).toEqual([])
  })

  it('order=due：按 dueDate 升序', () => {
    const c2: Card[] = [
      mkCard({ id: 'late', deckId: 'd', dueDate: '2026-03-01' }),
      mkCard({ id: 'early', deckId: 'd', dueDate: '2026-01-01' }),
      mkCard({ id: 'mid', deckId: 'd', dueDate: '2026-02-01' }),
    ]
    const q = buildQueue({ deckId: 'd', cards: c2, metas: [], pref: mkPref({ order: 'due' }), mode: 'cram' })
    expect(q).toEqual(['early', 'mid', 'late'])
  })
})

// ═════════════════════════════════════════════════════════════
//  下次間隔預估（須與 lib/srs.schedule 邏輯一致）
// ═════════════════════════════════════════════════════════════
describe('previewIntervals', () => {
  it('again 永遠顯示「10 分鐘」', () => {
    expect(previewIntervals(mkCard({ repetitions: 5, intervalDays: 30 })).again).toBe('10 分鐘')
  })

  it('新卡（reps 0）：hard/good = 1 日，easy = 3 日', () => {
    const r = previewIntervals(mkCard({ repetitions: 0, intervalDays: 0, ease: 2.5 }))
    expect(r.hard).toBe('1 日')
    expect(r.good).toBe('1 日')
    expect(r.easy).toBe('3 日')
  })

  it('reps 1：hard/good = 6 日，easy = 8 日', () => {
    const r = previewIntervals(mkCard({ repetitions: 1, intervalDays: 1, ease: 2.5 }))
    expect(r.hard).toBe('6 日')
    expect(r.good).toBe('6 日')
    expect(r.easy).toBe('8 日')
  })

  it('reps ≥ 2：hard = round(cur·1.2)，good = round(cur·ease)，easy = round(cur·ease·1.3)', () => {
    // cur=6, ease=2.5 → hard round(7.2)=7日；good round(15)=15日；easy round(19.5)=20日
    const r = previewIntervals(mkCard({ repetitions: 2, intervalDays: 6, ease: 2.5 }))
    expect(r.hard).toBe('7 日')
    expect(r.good).toBe('15 日')
    expect(r.easy).toBe('20 日')
  })

  it('reps ≥ 2 + 長間隔：good/easy 進位到月（cur=15, ease=2.5）', () => {
    // hard round(18)=18日；good round(37.5)=38日→round(38/30)=1個月；easy round(48.75)=49日→2個月
    const r = previewIntervals(mkCard({ repetitions: 2, intervalDays: 15, ease: 2.5 }))
    expect(r.hard).toBe('18 日')
    expect(r.good).toBe('1 個月')
    expect(r.easy).toBe('2 個月')
  })
})

describe('fmtInterval', () => {
  it('0 / 負數 → 今日', () => {
    expect(fmtInterval(0)).toBe('今日')
    expect(fmtInterval(-5)).toBe('今日')
  })
  it('1 → 1 日', () => {
    expect(fmtInterval(1)).toBe('1 日')
  })
  it('< 30 用「日」（邊界 29）', () => {
    expect(fmtInterval(29)).toBe('29 日')
  })
  it('30 → 1 個月（30 不屬「日」）', () => {
    expect(fmtInterval(30)).toBe('1 個月')
  })
  it('45 → round(1.5)=2 個月', () => {
    expect(fmtInterval(45)).toBe('2 個月')
  })
  it('364 仍係月，365 進「年」邊界', () => {
    expect(fmtInterval(364)).toBe('12 個月') // round(364/30)=12
    expect(fmtInterval(365)).toBe('1.0 年')
  })
  it('730 → 2.0 年', () => {
    expect(fmtInterval(730)).toBe('2.0 年')
  })
})

// ═════════════════════════════════════════════════════════════
//  統計
// ═════════════════════════════════════════════════════════════
describe('computeStreak（best 為確定值；以日數間隔判連續）', () => {
  it('空 logs → current 0, best 0', () => {
    expect(computeStreak([])).toEqual({ current: 0, best: 0 })
  })

  it('單日多次複習 → best 1（同日去重）', () => {
    const r = computeStreak([
      mkLog({ ts: '2026-01-01T08:00:00Z' }),
      mkLog({ ts: '2026-01-01T20:00:00Z' }),
    ])
    expect(r.best).toBe(1)
  })

  it('連續 3 日 + 中斷後孤立 1 日 → best 3', () => {
    const r = computeStreak([
      mkLog({ ts: '2026-01-01T10:00:00Z' }),
      mkLog({ ts: '2026-01-02T10:00:00Z' }),
      mkLog({ ts: '2026-01-03T10:00:00Z' }),
      mkLog({ ts: '2026-01-10T10:00:00Z' }), // 斷開
    ])
    expect(r.best).toBe(3)
  })

  it('亂序輸入仍計到正確 best（內部會排序）', () => {
    const r = computeStreak([
      mkLog({ ts: '2026-01-03T10:00:00Z' }),
      mkLog({ ts: '2026-01-01T10:00:00Z' }),
      mkLog({ ts: '2026-01-02T10:00:00Z' }),
    ])
    expect(r.best).toBe(3)
  })

  it('跨月連續：1-31 → 2-01 → 2-02 算連續 → best 3', () => {
    const r = computeStreak([
      mkLog({ ts: '2026-01-31T10:00:00Z' }),
      mkLog({ ts: '2026-02-01T10:00:00Z' }),
      mkLog({ ts: '2026-02-02T10:00:00Z' }),
    ])
    expect(r.best).toBe(3)
  })

  it('兩段，較長嗰段排前都揾到 best（4 連 vs 2 連）→ best 4', () => {
    const r = computeStreak([
      mkLog({ ts: '2026-03-01T10:00:00Z' }),
      mkLog({ ts: '2026-03-02T10:00:00Z' }),
      mkLog({ ts: '2026-03-03T10:00:00Z' }),
      mkLog({ ts: '2026-03-04T10:00:00Z' }),
      mkLog({ ts: '2026-03-20T10:00:00Z' }),
      mkLog({ ts: '2026-03-21T10:00:00Z' }),
    ])
    expect(r.best).toBe(4)
  })
})

describe('retention（只計複習過嘅卡 prevInterval > 0）', () => {
  it('空 logs → rate 0', () => {
    expect(retention([])).toEqual({ rate: 0, total: 0, pass: 0 })
  })
  it('全部新卡（prevInterval 0）被排除 → rate 0, total 0', () => {
    expect(retention([mkLog({ prevInterval: 0 }), mkLog({ prevInterval: 0 })])).toEqual({
      rate: 0,
      total: 0,
      pass: 0,
    })
  })
  it('混合：新卡剔除，again 算唔過，其餘算過', () => {
    // 3 張複習過：good(過) + again(唔過) + easy(過) → pass 2 / total 3 = 66.66…%
    const r = retention([
      mkLog({ prevInterval: 0, rating: 'again' }), // 新卡，剔除
      mkLog({ prevInterval: 6, rating: 'good' }),
      mkLog({ prevInterval: 6, rating: 'again' }),
      mkLog({ prevInterval: 6, rating: 'easy' }),
    ])
    expect(r.total).toBe(3)
    expect(r.pass).toBe(2)
    expect(r.rate).toBeCloseTo(66.6667, 3)
  })
  it('全部答啱 → 100%', () => {
    const r = retention([
      mkLog({ prevInterval: 6, rating: 'good' }),
      mkLog({ prevInterval: 10, rating: 'hard' }),
    ])
    expect(r.rate).toBe(100)
    expect(r.pass).toBe(2)
  })
})

describe('answerBreakdown', () => {
  it('空 logs → 全 0', () => {
    expect(answerBreakdown([])).toEqual({ again: 0, hard: 0, good: 0, easy: 0 })
  })
  it('正確分桶計數', () => {
    expect(
      answerBreakdown([
        mkLog({ rating: 'good' }),
        mkLog({ rating: 'good' }),
        mkLog({ rating: 'again' }),
        mkLog({ rating: 'easy' }),
      ]),
    ).toEqual({ again: 1, hard: 0, good: 2, easy: 1 })
  })
})

describe('stateBreakdown', () => {
  it('空卡 → 全 0', () => {
    expect(stateBreakdown([], [])).toEqual({
      new: 0,
      learning: 0,
      young: 0,
      mature: 0,
      suspended: 0,
    })
  })
  it('各狀態各一張（暫停以 meta 標示）', () => {
    const cards: Card[] = [
      mkCard({ id: 'n', repetitions: 0 }), // new
      mkCard({ id: 'l', repetitions: 1, intervalDays: 0 }), // learning
      mkCard({ id: 'y', repetitions: 2, intervalDays: 10 }), // young
      mkCard({ id: 'm', repetitions: 3, intervalDays: 100 }), // mature
      mkCard({ id: 's', repetitions: 4, intervalDays: 200 }), // suspended（被 meta 覆蓋）
    ]
    const metas: CardMeta[] = [mkMeta({ id: 's', suspended: true })]
    expect(stateBreakdown(cards, metas)).toEqual({
      new: 1,
      learning: 1,
      young: 1,
      mature: 1,
      suspended: 1,
    })
  })
})

describe('intervalHistogram', () => {
  it('空卡 → 6 個桶全 0', () => {
    expect(intervalHistogram([]).map((b) => b.count)).toEqual([0, 0, 0, 0, 0, 0])
  })
  it('新卡（reps 0）唔計入', () => {
    expect(
      intervalHistogram([mkCard({ repetitions: 0 }), mkCard({ repetitions: 0 })]).map((b) => b.count),
    ).toEqual([0, 0, 0, 0, 0, 0])
  })
  it('各桶邊界（< max 為界）：0,1,7,21,200 各一張', () => {
    // 0→桶0(<1)；1→桶1(<7)；7→桶2(<21)；21→桶3(<60)；200→桶5(<∞)
    const cards: Card[] = [
      mkCard({ id: '0', repetitions: 1, intervalDays: 0 }),
      mkCard({ id: '1', repetitions: 2, intervalDays: 1 }),
      mkCard({ id: '7', repetitions: 2, intervalDays: 7 }),
      mkCard({ id: '21', repetitions: 2, intervalDays: 21 }),
      mkCard({ id: '200', repetitions: 2, intervalDays: 200 }),
    ]
    expect(intervalHistogram(cards).map((b) => b.count)).toEqual([1, 1, 1, 1, 0, 1])
  })
  it('極大 interval 落最後一桶（不會掉出陣列）', () => {
    expect(
      intervalHistogram([mkCard({ repetitions: 5, intervalDays: 99999 })]).map((b) => b.count),
    ).toEqual([0, 0, 0, 0, 0, 1])
  })
  it('桶標籤穩定', () => {
    expect(intervalHistogram([]).map((b) => b.label)).toEqual([
      '<1日',
      '1-7日',
      '1-3週',
      '3週-2月',
      '2-6月',
      '6月+',
    ])
  })
})
