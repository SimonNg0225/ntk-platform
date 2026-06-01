import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { relativeTime, fullDateTime } from './util'

// ============================================================
//  補測：notes 版 relativeTime / fullDateTime（util/util.edge/computeStats
//  全部零 import，完全未覆蓋）。
//  ------------------------------------------------------------
//  注意：journal/util 有同名 relativeTime（stats.test.ts 已測），但 notes 版
//  閾值唔同 —— 措辭係「剛剛」（非「啱啱」）、跌出相對措辭嘅界線係 7 天（非
//  30 日）、用「天前」（非「日前」）。故唔可以當已覆蓋，喺度逐分支重新驗。
//
//  時間相關：跟 srs.test.ts 風格用 vi.useFakeTimers + setSystemTime 鎖死
//  「此刻」。以本地建構嘅 Date 取 now，再用 isoAgo(ms) 往前推砌各 union
//  邊界。toLocaleDateString / toLocaleString 嘅確切 ICU 格式隨環境而異，
//  故落 date 分支只驗語意（唔再以「前」結尾、含年份），唔硬編格式。
// ============================================================

// 本地 2026-05-31 12:00（同 journal 測試同源；中午避開任何日界 off-by-one）
const TODAY = new Date(2026, 4, 31, 12, 0, 0)

describe('relativeTime（notes 版；now = 本地 2026-05-31 12:00）', () => {
  const nowMs = TODAY.getTime()
  const isoAgo = (ms: number) => new Date(nowMs - ms).toISOString()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(TODAY)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // ── (1) <60s → '剛剛' ──
  it('剛好 0 秒 → 剛剛', () => {
    expect(relativeTime(isoAgo(0))).toBe('剛剛')
  })

  it('<60 秒（59s）→ 剛剛', () => {
    expect(relativeTime(isoAgo(59_000))).toBe('剛剛')
  })

  // ── (2) 分鐘分支：60s → '1 分鐘前'；59 分 → '59 分鐘前' ──
  it('剛好 60 秒 → 1 分鐘前（跨入分鐘分支）', () => {
    expect(relativeTime(isoAgo(60_000))).toBe('1 分鐘前')
  })

  it('59 分鐘 → 59 分鐘前（分鐘分支上界）', () => {
    expect(relativeTime(isoAgo(59 * 60_000))).toBe('59 分鐘前')
  })

  // ── (3) 小時分支：60 分 → '1 小時前'；23 小時 → '23 小時前' ──
  it('剛好 60 分鐘 → 1 小時前（跨入小時分支）', () => {
    expect(relativeTime(isoAgo(60 * 60_000))).toBe('1 小時前')
  })

  it('23 小時 → 23 小時前（小時分支上界）', () => {
    expect(relativeTime(isoAgo(23 * 3_600_000))).toBe('23 小時前')
  })

  // ── (4) 天分支：24 小時 → '1 天前'；6 天 → '6 天前' ──
  it('剛好 24 小時 → 1 天前（跨入天分支；注意係「天」非「日」）', () => {
    expect(relativeTime(isoAgo(24 * 3_600_000))).toBe('1 天前')
  })

  it('6 天 → 6 天前（天分支上界；7 天前先跌出相對措辭）', () => {
    expect(relativeTime(isoAgo(6 * 86_400_000))).toBe('6 天前')
  })

  // ── (5) 剛好 7 天 → 走 toLocaleDateString 分支（語意斷言，唔硬編 ICU）──
  it('剛好 7 天 → 落本地日期格式（唔再以「前」結尾、含年份）', () => {
    const at7 = relativeTime(isoAgo(7 * 86_400_000))
    // notes 版閾值 day < 7 先用相對措辭；day === 7 走 toLocaleDateString。
    expect(at7).not.toBe('剛剛')
    expect(at7).not.toMatch(/前$/)
    expect(at7).toContain('2026')
  })

  it('遠古（90 天前）亦走日期格式、含年份', () => {
    const old = relativeTime(isoAgo(90 * 86_400_000))
    expect(old).not.toMatch(/前$/)
    expect(old).toContain('2026')
  })

  // ── (6) 未來時間（時鐘偏移 now+5s，diff 為負）→ '剛剛' ──
  it('未來時間（此刻 +5 秒，diff 為負 < 60）→ 剛剛', () => {
    // 多機時鐘偏差：updatedAt 比此刻遲，diff = 負數 < 60 → 落首個分支。
    expect(relativeTime(new Date(nowMs + 5_000).toISOString())).toBe('剛剛')
  })

  // ── (7) NaN 防呆：invalid / 空字串 → '' ──
  it('invalid ISO → 空字串', () => {
    expect(relativeTime('not-a-date')).toBe('')
  })

  it('空字串 → 空字串', () => {
    expect(relativeTime('')).toBe('')
  })
})

// ============================================================
//  fullDateTime —— 正常 ISO 回非空且含年份；invalid → '' 防呆。
//  唔靠 fake timers（純由輸入 iso 推導，唔讀「此刻」）。
// ============================================================
describe('fullDateTime', () => {
  it('正常 ISO → 非空、含年份（唔硬編 ICU 格式）', () => {
    const out = fullDateTime('2026-05-24T03:00:00.000Z')
    expect(out).not.toBe('')
    expect(out).toContain('2026')
  })

  it('invalid date → 空字串（NaN 防呆）', () => {
    expect(fullDateTime('bad')).toBe('')
  })

  it('空字串 → 空字串', () => {
    expect(fullDateTime('')).toBe('')
  })
})
