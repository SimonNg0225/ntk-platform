import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { daysUntil, dueLabel, buildMomentum, relTime } from './util'

// ============================================================
//  時間相依純函式 — 用 fake timers 鎖死「現在」做 deterministic 測。
//  （本 repo 用「本地時區」key 避 UTC 漂移；測試環境為 Asia/Hong_Kong = UTC+8。）
//  涵蓋：daysUntil / dueLabel / buildMomentum / relTime
// ============================================================

// 本地日曆日 key（同 source 慣例：getMonth()+1、padStart 2）
function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('daysUntil（距目標日嘅日數；fromKey 錨本地中午避漂移）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 固定「今日」= 本地 2026-05-31 09:00（HK）。時辰唔影響：todayKey 只取年月日。
    vi.setSystemTime(new Date(2026, 4, 31, 9, 0, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('無目標日 → undefined', () => {
    expect(daysUntil(undefined)).toBeUndefined()
    expect(daysUntil('')).toBeUndefined()
  })

  it('今日（inclusive）→ 0', () => {
    expect(daysUntil('2026-05-31')).toBe(0)
  })

  it('明日 → +1；昨日 → -1', () => {
    expect(daysUntil('2026-06-01')).toBe(1)
    expect(daysUntil('2026-05-30')).toBe(-1)
  })

  it('跨月：05-31 → 06-30 = 30 日', () => {
    expect(daysUntil('2026-06-30')).toBe(30)
  })

  it('逾期（負數）：05-31 → 05-01 = -30 日', () => {
    expect(daysUntil('2026-05-01')).toBe(-30)
  })

  it('跨年唔漂日：05-31 → 2027-01-01', () => {
    // 2026-05-31 至 2027-01-01：6月起 30+31+31+30+31+30+31 = 214，再 +1 到 1/1 = 215
    expect(daysUntil('2027-01-01')).toBe(215)
  })
})

describe('dueLabel（由 daysUntil 分桶出標籤 + 色票）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 31, 9, 0, 0)) // 本地 2026-05-31
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('無目標日 → null', () => {
    expect(dueLabel(undefined)).toBeNull()
  })

  it('逾期（d<0）→ rose + 「逾期 N 日」（用 Math.abs）', () => {
    expect(dueLabel('2026-05-30')).toEqual({ text: '逾期 1 日', tone: 'rose' })
    expect(dueLabel('2026-05-21')).toEqual({ text: '逾期 10 日', tone: 'rose' })
  })

  it('今日到期（d=0）→ amber + 「今日到期」', () => {
    expect(dueLabel('2026-05-31')).toEqual({ text: '今日到期', tone: 'amber' })
  })

  it('1-7 日內 → amber + 「仲有 N 日」', () => {
    expect(dueLabel('2026-06-01')).toEqual({ text: '仲有 1 日', tone: 'amber' })
    expect(dueLabel('2026-06-07')).toEqual({ text: '仲有 7 日', tone: 'amber' }) // d=7 邊界仍 amber
  })

  it('>7 日 → slate（d=8 過界轉 slate）', () => {
    expect(dueLabel('2026-06-08')).toEqual({ text: '仲有 8 日', tone: 'slate' })
    expect(dueLabel('2026-06-30')).toEqual({ text: '仲有 30 日', tone: 'slate' })
  })
})

describe('buildMomentum（簽到歷史 → 每日進度時間線，forward-fill）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 固定「今日」= 本地 2026-05-31（HK）。用足夠遠離 UTC 午夜嘅時辰。
    vi.setSystemTime(new Date(2026, 4, 31, 9, 0, 0))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // 用本地中午建立 ISO，避免 fake timer 下 UTC 漂移影響 localKey 落格
  const at = (y: number, m: number, d: number, progress: number) => ({
    createdAt: new Date(y, m - 1, d, 12, 0, 0).toISOString(),
    progress,
  })

  it('輸出長度永遠 = days，最後一格 key = 今日', () => {
    const out = buildMomentum([], 0, 7)
    expect(out).toHaveLength(7)
    expect(out[out.length - 1].key).toBe('2026-05-31')
    expect(out[0].key).toBe('2026-05-25') // 7 日窗：今日往前 6 日
  })

  it('空簽到：全程 0，但最後一格 pin 成 current', () => {
    const out = buildMomentum([], 42, 5)
    expect(out.map((p) => p.value)).toEqual([0, 0, 0, 0, 42])
  })

  it('window 內逐日 forward-fill（缺日沿用上一筆）', () => {
    // 5 日窗：05-27..05-31。只喺 05-28(=30) 同 05-30(=70) 簽到。
    const out = buildMomentum([at(2026, 5, 28, 30), at(2026, 5, 30, 70)], 70, 5)
    expect(out.map((p) => p.key)).toEqual(['2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30', '2026-05-31'])
    // 05-27 無基線 → 0；05-28 → 30；05-29 沿用 30；05-30 → 70；05-31 pin current(70)
    expect(out.map((p) => p.value)).toEqual([0, 30, 30, 70, 70])
  })

  it('window 之前嘅最後一筆簽到 → 做起始基線', () => {
    // 3 日窗：05-29..05-31。窗前有 05-20(=55)。窗內無簽到。
    const out = buildMomentum([at(2026, 5, 20, 55)], 80, 3)
    expect(out.map((p) => p.key)).toEqual(['2026-05-29', '2026-05-30', '2026-05-31'])
    // 基線 55 貫穿頭兩格，最後一格 pin current(80)
    expect(out.map((p) => p.value)).toEqual([55, 55, 80])
  })

  it('同一日多筆 → 取最後一筆（後者覆蓋前者）', () => {
    // 3 日窗：05-29..05-31。05-30 兩筆：先 20 後 65。
    const out = buildMomentum([at(2026, 5, 30, 20), at(2026, 5, 30, 65)], 65, 3)
    // 05-29 無基線 0；05-30 取最後 65；05-31 pin current(65)
    expect(out.map((p) => p.value)).toEqual([0, 65, 65])
  })

  it('最後一格固定 = current，即使今日已有簽到', () => {
    // 今日(05-31)簽到 40，但 current 傳 88 → 最後一格應顯示 88
    const out = buildMomentum([at(2026, 5, 31, 40)], 88, 3)
    expect(out[out.length - 1].value).toBe(88)
  })

  it('跨月窗：今日 06-02 時 5 日窗應橫跨 05/06', () => {
    vi.setSystemTime(new Date(2026, 5, 2, 9, 0, 0)) // 本地 2026-06-02
    const out = buildMomentum([], 0, 5)
    expect(out.map((p) => p.key)).toEqual(['2026-05-29', '2026-05-30', '2026-05-31', '2026-06-01', '2026-06-02'])
  })

  it('每格 key 皆為本地日曆日（同 localKey 一致）', () => {
    const out = buildMomentum([], 0, 3)
    const today = new Date()
    expect(out[out.length - 1].key).toBe(localKey(today))
  })
})

describe('relTime（相對時間；>30 日舊項回本地日曆日標籤）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('< 1 分鐘 → 「啱啱」', () => {
    vi.setSystemTime(new Date('2026-05-31T12:00:00.000Z'))
    expect(relTime(new Date('2026-05-31T11:59:40.000Z').toISOString())).toBe('啱啱')
  })

  it('分鐘 / 小時 / 日（< 30 日）桶', () => {
    const now = new Date('2026-05-31T12:00:00.000Z').getTime()
    vi.setSystemTime(now)
    expect(relTime(new Date(now - 5 * 60_000).toISOString())).toBe('5 分鐘前')
    expect(relTime(new Date(now - 3 * 3_600_000).toISOString())).toBe('3 小時前')
    expect(relTime(new Date(now - 2 * 864e5).toISOString())).toBe('2 日前')
    expect(relTime(new Date(now - 29 * 864e5).toISOString())).toBe('29 日前') // 邊界仍係「N 日前」
  })

  it('>= 30 日 → 切換成日曆日標籤（唔再係「N 日前」）', () => {
    const now = new Date('2026-05-31T12:00:00.000Z').getTime()
    vi.setSystemTime(now)
    const label = relTime(new Date(now - 30 * 864e5).toISOString())
    expect(label).not.toMatch(/日前$/)
    expect(label).toMatch(/月/) // 形如「5月1日」
  })

  it('[bug #1 回歸] >30 日舊簽到用「本地」日曆日，唔可以受 UTC slice 漂移錯一日', () => {
    // 情境：簽到喺本地 2026-04-01 01:00（+08）建立 → 存 UTC 2026-03-31T17:00Z。
    // 舊 code：fromKey(iso.slice(0,10)) = fromKey("2026-03-31") → 顯示「3月31日」（錯）。
    // 正確：本地日係 4 月 1 日 → 應顯示「4月1日」。
    vi.setSystemTime(new Date('2026-05-31T12:00:00.000Z')) // 令該簽到 > 30 日舊，落入日曆日分支
    const iso = new Date('2026-03-31T17:00:00.000Z').toISOString()
    const local = new Date(iso)
    // 先確認本地日的確係 4 月 1 日（UTC+8 假設成立）
    expect(localKey(local)).toBe('2026-04-01')
    const expected = new Date(local.getFullYear(), local.getMonth(), local.getDate(), 12).toLocaleDateString('zh-HK', {
      month: 'short',
      day: 'numeric',
    })
    expect(relTime(iso)).toBe(expected)
  })
})
