import { describe, it, expect, beforeEach } from 'vitest'
import {
  creditCost,
  monthlyCredits,
  creditsRemaining,
  chargeCredits,
  canAfford,
  resetCreditsLedger,
  CREDIT_HKD,
} from './credits'
import { PLANS } from './billing'

describe('每次扣點', () => {
  it('標準文字生成 = 1 點', () => {
    expect(creditCost({ source: 'lessons' })).toBe(1)
    expect(creditCost({ source: 'dse-drill' })).toBe(1)
    expect(creditCost({})).toBe(1)
  })
  it('簡報 = 3 點、🎙️ 錄音 = 16 點', () => {
    expect(creditCost({ source: 'slides' })).toBe(3)
    expect(creditCost({ feature: 'transcribe' })).toBe(16)
  })
  it('用 Pro 高階模型 ×4', () => {
    expect(creditCost({ source: 'lessons', model: 'gemini-2.5-pro' })).toBe(4)
    expect(creditCost({ source: 'slides', model: 'gemini-2.5-pro' })).toBe(12)
    // Flash 唔加倍
    expect(creditCost({ source: 'slides', model: 'gemini-2.5-flash' })).toBe(3)
  })
})

describe('每月點數池', () => {
  it('free 30 / plus 300 / pro 1000', () => {
    expect(monthlyCredits('free')).toBe(30)
    expect(monthlyCredits('plus')).toBe(300)
    expect(monthlyCredits('pro')).toBe(1000)
  })
  it('付費層保證：池 × 點價 ≤ 月費 30%', () => {
    PLANS.filter((p) => p.priceHkd > 0).forEach((p) => {
      const aiCost = p.monthlyCredits * CREDIT_HKD
      expect(aiCost).toBeLessThanOrEqual(0.3 * p.priceHkd)
    })
  })
})

describe('月度用量帳', () => {
  beforeEach(() => resetCreditsLedger())

  it('扣點會減餘額', () => {
    expect(creditsRemaining('plus')).toBe(300)
    const r = chargeCredits('plus', { source: 'slides' }) // 3 點
    expect(r.ok).toBe(true)
    expect(r.cost).toBe(3)
    expect(r.remaining).toBe(297)
    expect(creditsRemaining('plus')).toBe(297)
  })

  it('唔夠點唔扣、回 ok:false', () => {
    chargeCredits('free', { feature: 'transcribe' }) // 16 點，剩 14
    expect(creditsRemaining('free')).toBe(14)
    expect(canAfford('free', { feature: 'transcribe' })).toBe(false) // 又要 16 > 14
    const r = chargeCredits('free', { feature: 'transcribe' })
    expect(r.ok).toBe(false)
    expect(creditsRemaining('free')).toBe(14) // 冇再扣
  })
})
