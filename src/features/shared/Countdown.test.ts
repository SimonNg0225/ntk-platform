import { describe, it, expect } from 'vitest'
import { daysUntil, toneOf, toKey, fromKey, formatDate } from './Countdown'

// ────────────────────────────────────────────────────────────
//  純函式測試（倒數功能）。預期值用第一性原理人手計，
//  唔靠跑 code 反推。環境 node、無 jsdom，全部唔掂 DOM/React。
//  日期一律用「本地時區」語意（呢個 repo 刻意避 toISOString 的 UTC 漂移）。
// ────────────────────────────────────────────────────────────

describe('toKey（Date → 本地 YYYY-MM-DD）', () => {
  it('正常：補零月日', () => {
    // 用本地時間建構（new Date(y,m,d,...) 永遠當地時區），中午避邊界
    expect(toKey(new Date(2026, 0, 3, 12, 0, 0))).toBe('2026-01-03') // 1月 → '01'、3日 → '03'
    expect(toKey(new Date(2026, 8, 9, 12, 0, 0))).toBe('2026-09-09') // 9月9日 → 兩個個位數都補零
  })

  it('12 月唔好 off-by-one（getMonth=11 → "12"）', () => {
    expect(toKey(new Date(2026, 11, 25, 12, 0, 0))).toBe('2026-12-25')
  })

  it('與 fromKey round-trip 一致：toKey(fromKey(k)) === k', () => {
    for (const k of ['2026-05-04', '2026-01-01', '2026-12-31', '2024-02-29']) {
      expect(toKey(fromKey(k))).toBe(k)
    }
  })

  it('近午夜（本地 23:59）唔會跌去 UTC 前/後一日（用本地 getter）', () => {
    // 本地 2026-03-15 23:59 —— 必須係 '2026-03-15'，唔可以漂去 16 號
    expect(toKey(new Date(2026, 2, 15, 23, 59, 59))).toBe('2026-03-15')
    // 本地 2026-03-15 00:00 —— 必須係 '2026-03-15'，唔可以漂去 14 號
    expect(toKey(new Date(2026, 2, 15, 0, 0, 0))).toBe('2026-03-15')
  })
})

describe('fromKey（YYYY-MM-DD → 本地 Date，正午）', () => {
  it('正常 key 還原年月日（month-1）+ 設正午 12:00', () => {
    const d = fromKey('2026-05-04')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4) // 0-based：5月 → 4
    expect(d.getDate()).toBe(4)
    expect(d.getHours()).toBe(12) // 刻意設正午，避時區/DST 邊界
    expect(d.getMinutes()).toBe(0)
    expect(d.getSeconds()).toBe(0)
  })

  it('閏日 2024-02-29 有效（係真實存在嘅日子）', () => {
    const d = fromKey('2024-02-29')
    expect(Number.isNaN(d.getTime())).toBe(false)
    expect(d.getFullYear()).toBe(2024)
    expect(d.getMonth()).toBe(1) // 2月
    expect(d.getDate()).toBe(29)
  })

  it('與 toKey round-trip 一致', () => {
    expect(toKey(fromKey('2027-11-30'))).toBe('2027-11-30')
  })

  // ── 揭發 suspectedBug #1：畸形 key 應產生 Invalid Date，唔好靜默變 1900 ──
  it('空字串 key → Invalid Date（修 bug：唔再靜默變 1900-01-01）', () => {
    const d = fromKey('')
    expect(Number.isNaN(d.getTime())).toBe(true)
    // 修正前：呢度會係 valid 嘅 1900-01-01（getFullYear() === 1900）
    expect(d.getFullYear()).not.toBe(1900)
  })

  it('缺欄位 key（只有年）→ Invalid Date', () => {
    expect(Number.isNaN(fromKey('2026').getTime())).toBe(true)
    expect(Number.isNaN(fromKey('2026-05').getTime())).toBe(true)
  })

  it('非數字 key → Invalid Date', () => {
    expect(Number.isNaN(fromKey('abc').getTime())).toBe(true)
  })
})

describe('daysUntil（目標日距今日嘅日數）', () => {
  it('同一日 = 0（最關鍵：唔好 off-by-one 變 ±1）', () => {
    expect(daysUntil('2026-05-31', '2026-05-31')).toBe(0)
  })

  it('明日 = +1、琴日 = -1', () => {
    expect(daysUntil('2026-06-01', '2026-05-31')).toBe(1)
    expect(daysUntil('2026-05-30', '2026-05-31')).toBe(-1)
  })

  it('跨年：2026-12-31 → 2027-01-01 = 1', () => {
    expect(daysUntil('2027-01-01', '2026-12-31')).toBe(1)
  })

  it('閏年 2 月（含 2/29）：2024-02-28 → 2024-03-01 = 2', () => {
    expect(daysUntil('2024-03-01', '2024-02-28')).toBe(2)
  })

  it('平年 2 月：2025-02-28 → 2025-03-01 = 1', () => {
    expect(daysUntil('2025-03-01', '2025-02-28')).toBe(1)
  })

  it('月底跨月：2026-01-31 → 2026-02-01 = 1', () => {
    expect(daysUntil('2026-02-01', '2026-01-31')).toBe(1)
  })

  it('DST 切換期間：本地中午錨點吸收 ±1hr，整數日差不變', () => {
    // 美國 2026 DST 開始 3/8、結束 11/1（本 repo 用本地時區；HKT 無 DST，
    // 但用中午錨點 + Math.round 嘅設計本身就要對 DST 免疫）。
    // 跨越 3/8：3/7 → 3/9 應該係 2 日，唔受任何 ±1hr 影響。
    expect(daysUntil('2026-03-09', '2026-03-07')).toBe(2)
    expect(daysUntil('2026-03-08', '2026-03-07')).toBe(1)
    // 跨越 11/1：10/31 → 11/2 應該係 2 日。
    expect(daysUntil('2026-11-02', '2026-10-31')).toBe(2)
  })

  it('大跨度 365 / 366 日', () => {
    expect(daysUntil('2027-05-31', '2026-05-31')).toBe(365) // 平年區間
    expect(daysUntil('2025-02-28', '2024-02-28')).toBe(366) // 跨 2024-02-29，366 日
  })

  it('已過去大數（負值）方向正確', () => {
    expect(daysUntil('2025-05-31', '2026-05-31')).toBe(-365)
    expect(daysUntil('2020-01-01', '2026-05-31')).toBe(-2342)
  })

  // ── suspectedBug #1 連帶：空 date 應得 NaN，俾上層 filter 一致排除 ──
  it('空 date → NaN（修 bug 後：唔再回傳貌似合理嘅 -46171）', () => {
    const v = daysUntil('', '2026-05-31')
    expect(Number.isNaN(v)).toBe(true)
    // NaN 喺 .filter(>=0) 同 .filter(<0) 都係 false → upcoming/past 一致排除
    expect(v >= 0).toBe(false)
    expect(v < 0).toBe(false)
  })
})

describe('toneOf（剩餘日數 → 緊急度 tone）', () => {
  it('今日 days=0 → rose', () => {
    expect(toneOf(0)).toBe('rose')
  })

  it('邊界 days=3 → rose、days=4 → amber', () => {
    expect(toneOf(3)).toBe('rose')
    expect(toneOf(4)).toBe('amber')
  })

  it('邊界 days=14 → amber、days=15 → green', () => {
    expect(toneOf(14)).toBe('amber')
    expect(toneOf(15)).toBe('green')
  })

  it('負數 days=-1 → slate（已過去優先於 <=3 嘅 rose）', () => {
    expect(toneOf(-1)).toBe('slate')
    expect(toneOf(-100)).toBe('slate')
  })

  it('大正數 → green', () => {
    expect(toneOf(365)).toBe('green')
  })
})

describe('formatDate（M月D日（星期X）[+ 時間]）', () => {
  it('星期一基準（2026-05-04 係星期一）→ 索引對應正確', () => {
    expect(formatDate('2026-05-04')).toBe('5月4日（星期一）')
  })

  it('星期日 getDay()=0 → "日"（索引下邊界）', () => {
    // 2026-05-03 係星期日
    expect(formatDate('2026-05-03')).toBe('5月3日（星期日）')
  })

  it('星期六 getDay()=6 → "六"（索引上邊界）', () => {
    // 2026-05-02 係星期六
    expect(formatDate('2026-05-02')).toBe('5月2日（星期六）')
  })

  it('有 time：尾綴空格 + 時間', () => {
    expect(formatDate('2026-05-04', '09:30')).toBe('5月4日（星期一） 09:30')
  })

  it('月日無前導零（純顯示，與 toKey 唔同）', () => {
    // 1月3日 顯示係 "1月3日" 而非 "01月03日"
    expect(formatDate('2026-01-03')).toBe('1月3日（星期六）') // 2026-01-03 係星期六
  })
})
