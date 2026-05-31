import { describe, it, expect } from 'vitest'
import { plusHour } from './EventEditor'

// ============================================================
//  plusHour — HH:mm 加 1 小時，作結束時間預設
//  bug #3 (low)：舊 code 對 23:xx 會 wrap 到 00:xx（如 23:30→00:30），
//  令結束時間預設早過開始。修正：clamp 喺 23:59，唔 wrap 過午夜，
//  確保預設結束時間永遠 >= 開始時間。
// ============================================================
describe('plusHour', () => {
  it('一般：09:00 → 10:00', () => {
    expect(plusHour('09:00')).toBe('10:00')
  })

  it('保留分鐘：09:30 → 10:30', () => {
    expect(plusHour('09:30')).toBe('10:30')
  })

  it('00:00 → 01:00', () => {
    expect(plusHour('00:00')).toBe('01:00')
  })

  it('缺分量容錯（"09" → 10:00）', () => {
    expect(plusHour('09')).toBe('10:00')
  })

  // ── bug #3 揭發 + 修正後行為 ──
  it('23:30 → 23:59（clamp，唔 wrap 到 00:30，預設結束唔會早過開始）', () => {
    expect(plusHour('23:30')).toBe('23:59')
  })

  it('23:00 → 23:59（clamp，唔 wrap 到 00:00）', () => {
    expect(plusHour('23:00')).toBe('23:59')
  })

  it('22:30 → 23:30（未到上限，正常加 1 小時）', () => {
    expect(plusHour('22:30')).toBe('23:30')
  })

  it('23:59 → 23:59（已到上限，停喺 23:59）', () => {
    expect(plusHour('23:59')).toBe('23:59')
  })
})
