import { describe, it, expect, beforeEach } from 'vitest'
import { calendarFeedCol } from '../../../data/collections'
import {
  FEED_TOKEN_ID,
  generateFeedToken,
  getOrCreateToken,
  rotateToken,
  peekToken,
  projectRefFromUrl,
  buildWebcalUrl,
  buildHttpsUrl,
} from './calendarFeed'

// ────────────────────────────────────────────────────────────
//  訂閱 feed token + webcal 連結組裝 純函式測試。
//  collection 用 in-memory（set/get）；persist 失敗（node 無 localStorage）
//  唔影響邏輯，皆被 store 內部 try/catch 吞咗。
// ────────────────────────────────────────────────────────────

describe('generateFeedToken', () => {
  it('回 URL-safe 字串（只含 A–Z a–z 0–9 - _）', () => {
    for (let i = 0; i < 20; i++) {
      const t = generateFeedToken()
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it('長度足夠表達 ≥128-bit（base64url 至少 22 字）', () => {
    // 預設 24 bytes = 192-bit → base64url 約 32 字，遠超 128-bit 下限。
    expect(generateFeedToken().length).toBeGreaterThanOrEqual(22)
  })

  it('連續生成幾乎肯定唔重複（高熵）', () => {
    const set = new Set<string>()
    for (let i = 0; i < 200; i++) set.add(generateFeedToken())
    expect(set.size).toBe(200)
  })

  it('冇 base64 padding（=）同非 URL-safe 字元（+ /）', () => {
    const t = generateFeedToken()
    expect(t).not.toContain('=')
    expect(t).not.toContain('+')
    expect(t).not.toContain('/')
  })
})

describe('getOrCreateToken / rotateToken / peekToken', () => {
  beforeEach(() => {
    calendarFeedCol.set([])
  })

  it('首次 getOrCreate 會生成並存單行（id=token）', () => {
    expect(peekToken()).toBeNull()
    const t = getOrCreateToken()
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/)
    const rows = calendarFeedCol.get()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(FEED_TOKEN_ID)
    expect(rows[0].token).toBe(t)
  })

  it('再次 getOrCreate 回返同一個 token（穩定）', () => {
    const a = getOrCreateToken()
    const b = getOrCreateToken()
    expect(b).toBe(a)
    expect(calendarFeedCol.get()).toHaveLength(1)
  })

  it('rotate 換新 token 並收斂成單行；舊 token 唔再存在', () => {
    const old = getOrCreateToken()
    const next = rotateToken()
    expect(next).not.toBe(old)
    const rows = calendarFeedCol.get()
    expect(rows).toHaveLength(1)
    expect(rows[0].token).toBe(next)
    expect(peekToken()).toBe(next)
  })

  it('畸形多行資料會被 getOrCreate 收斂返單行', () => {
    calendarFeedCol.set([
      { id: 'token', token: 'good' },
      { id: 'stray', token: 'junk' },
    ])
    // 已有 id='token' 行 → 直接回，唔重生
    expect(getOrCreateToken()).toBe('good')
    // 但若無乾淨 token 行，rotate 一定收斂單行
    calendarFeedCol.set([{ id: 'stray', token: 'junk' }])
    const t = getOrCreateToken()
    const rows = calendarFeedCol.get()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('token')
    expect(rows[0].token).toBe(t)
  })
})

describe('projectRefFromUrl', () => {
  it('由標準 supabase URL 拆 project-ref', () => {
    expect(projectRefFromUrl('https://abcdefgh.supabase.co')).toBe('abcdefgh')
    expect(projectRefFromUrl('https://abcdefgh.supabase.co/')).toBe('abcdefgh')
    expect(projectRefFromUrl('https://abcdefgh.supabase.co/rest/v1')).toBe('abcdefgh')
  })

  it('淨係 host（無 scheme）都拆得到', () => {
    expect(projectRefFromUrl('abcdefgh.supabase.co')).toBe('abcdefgh')
  })

  it('空 / undefined / null → null', () => {
    expect(projectRefFromUrl('')).toBeNull()
    expect(projectRefFromUrl(undefined)).toBeNull()
    expect(projectRefFromUrl(null)).toBeNull()
  })

  it('localhost / 退化 host → null', () => {
    expect(projectRefFromUrl('http://localhost:54321')).toBeNull()
  })
})

describe('buildWebcalUrl / buildHttpsUrl', () => {
  const URL_BASE = 'https://abcdefgh.supabase.co'
  const TOKEN = 'AbC-123_xyz'

  it('砌出正確 webcal 連結（含 functions/v1/calendar-feed 路徑）', () => {
    expect(buildWebcalUrl(URL_BASE, TOKEN)).toBe(
      'webcal://abcdefgh.supabase.co/functions/v1/calendar-feed?token=AbC-123_xyz',
    )
  })

  it('token 有需要 encode 嘅字元會被 encodeURIComponent', () => {
    const url = buildWebcalUrl(URL_BASE, 'a b+c')
    expect(url).toBe(
      'webcal://abcdefgh.supabase.co/functions/v1/calendar-feed?token=a%20b%2Bc',
    )
  })

  it('https 版只係 scheme 換成 https://', () => {
    expect(buildHttpsUrl(URL_BASE, TOKEN)).toBe(
      'https://abcdefgh.supabase.co/functions/v1/calendar-feed?token=AbC-123_xyz',
    )
  })

  it('拆唔到 ref → null', () => {
    expect(buildWebcalUrl('', TOKEN)).toBeNull()
    expect(buildWebcalUrl(undefined, TOKEN)).toBeNull()
    expect(buildHttpsUrl('http://localhost:54321', TOKEN)).toBeNull()
  })
})
