import { describe, it, expect } from 'vitest'
import { schedule, RATING_LABEL, type Rating } from './srs'
import type { Card } from '../data/types'

// 建一張卡（SM-2 預設：ease 2.5 / interval 0 / reps 0），可覆寫。
const card = (over: Partial<Card> = {}): Card => ({
  id: 'c1',
  deckId: 'd1',
  front: 'Q',
  back: 'A',
  ease: 2.5,
  intervalDays: 0,
  repetitions: 0,
  dueDate: '2026-05-31',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

// schedule() 嘅 dueDate / lastReviewed 用 new Date()（依賴「當前時間」），
// 唔可以 deterministic 斷言；以下只測純數值排程邏輯（ease / intervalDays /
// repetitions），全部用第一性原理人手計出預期值。

describe('schedule — rating "again"（重置）', () => {
  it('reps 歸 0、interval 歸 0、ease 減 0.2', () => {
    const r = schedule(card({ ease: 2.5, intervalDays: 6, repetitions: 3 }), 'again')
    expect(r.repetitions).toBe(0)
    expect(r.intervalDays).toBe(0)
    expect(r.ease).toBe(2.3) // 2.5 - 0.2
  })

  it('ease 唔會跌穿下限 1.3（floor）', () => {
    // 1.4 - 0.2 = 1.2 → max(1.3, 1.2) = 1.3
    expect(schedule(card({ ease: 1.4 }), 'again').ease).toBe(1.3)
    // 已經喺 1.3：max(1.3, 1.1) = 1.3
    expect(schedule(card({ ease: 1.3 }), 'again').ease).toBe(1.3)
  })
})

describe('schedule — 首次複習（reps 0 → 1）', () => {
  it('good：interval = 1', () => {
    const r = schedule(card(), 'good')
    expect(r.repetitions).toBe(1)
    expect(r.intervalDays).toBe(1)
    expect(r.ease).toBe(2.5) // good 唔改 ease
  })

  it('hard：interval = 1，ease 減 0.15', () => {
    const r = schedule(card(), 'hard')
    expect(r.repetitions).toBe(1)
    expect(r.intervalDays).toBe(1)
    expect(r.ease).toBe(2.35) // 2.5 - 0.15
  })

  it('easy：interval = 3，ease 加 0.15', () => {
    const r = schedule(card(), 'easy')
    expect(r.repetitions).toBe(1)
    expect(r.intervalDays).toBe(3)
    expect(r.ease).toBe(2.65) // 2.5 + 0.15
  })
})

describe('schedule — 第二次複習（reps 1 → 2，固定 interval）', () => {
  it('good：interval = 6（忽略舊 interval）', () => {
    const r = schedule(card({ repetitions: 1, intervalDays: 1 }), 'good')
    expect(r.repetitions).toBe(2)
    expect(r.intervalDays).toBe(6)
  })

  it('easy：interval = 8', () => {
    const r = schedule(card({ repetitions: 1, intervalDays: 1 }), 'easy')
    expect(r.repetitions).toBe(2)
    expect(r.intervalDays).toBe(8)
    expect(r.ease).toBe(2.65)
  })

  it('hard：interval = 6（固定，唔受 hard factor 影響）', () => {
    const r = schedule(card({ repetitions: 1, intervalDays: 1 }), 'hard')
    expect(r.intervalDays).toBe(6)
    expect(r.ease).toBe(2.35)
  })
})

describe('schedule — 成熟卡（reps ≥ 2 → 3+，interval × factor）', () => {
  it('good：interval = round(prev × ease)', () => {
    // prev 6, ease 2.5 → round(15) = 15
    const r = schedule(card({ repetitions: 2, intervalDays: 6, ease: 2.5 }), 'good')
    expect(r.repetitions).toBe(3)
    expect(r.intervalDays).toBe(15)
  })

  it('hard：factor 固定 1.2', () => {
    // prev 10, factor 1.2 → round(12) = 12；ease 2.5 - 0.15 = 2.35
    const r = schedule(card({ repetitions: 4, intervalDays: 10, ease: 2.5 }), 'hard')
    expect(r.intervalDays).toBe(12)
    expect(r.ease).toBe(2.35)
  })

  it('easy：factor = ease × 1.3（先加 0.15 再乘）', () => {
    // ease: 2.5 + 0.15 = 2.65；factor = 2.65 × 1.3 = 3.445
    // prev 10 → round(34.45) = 34
    const r = schedule(card({ repetitions: 3, intervalDays: 10, ease: 2.5 }), 'easy')
    expect(r.ease).toBe(2.65)
    expect(r.intervalDays).toBe(34)
  })

  it('round 採「四捨五入」：6 × 2.5 = 15.0 → 15；7 × 2.5 = 17.5 → 18', () => {
    expect(
      schedule(card({ repetitions: 2, intervalDays: 7, ease: 2.5 }), 'good').intervalDays,
    ).toBe(18) // round(17.5) = 18
  })

  it('邊界：prev interval 0 時 max(1,…) 兜底為 1（唔會回 0）', () => {
    // 資料不一致：reps 已 ≥ 2 但 interval 仍為 0 → round(0 × ease) = 0 → max(1,0) = 1
    const r = schedule(card({ repetitions: 2, intervalDays: 0, ease: 2.5 }), 'good')
    expect(r.intervalDays).toBe(1)
  })
})

describe('schedule — ease 浮點 round 至 2 位小數', () => {
  it('連續 easy 後 ease 仍係乾淨 2 位小數（無浮點殘渣）', () => {
    // 2.5 + 0.15 = 2.65；round(2.65 × 100)/100 = 2.65
    expect(schedule(card({ ease: 2.5 }), 'easy').ease).toBe(2.65)
    // 2.65 + 0.15 = 2.8；應為 2.8 而非 2.8000000000000003
    const r = schedule(card({ ease: 2.65, repetitions: 1 }), 'easy')
    expect(r.ease).toBe(2.8)
    expect(Number.isInteger(r.ease! * 100)).toBe(true)
  })
})

describe('RATING_LABEL', () => {
  it('四個 rating 都有標籤', () => {
    const ratings: Rating[] = ['again', 'hard', 'good', 'easy']
    for (const k of ratings) {
      expect(RATING_LABEL[k]).toBeTruthy()
      expect(typeof RATING_LABEL[k]).toBe('string')
    }
  })
})
