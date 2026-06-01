import { describe, it, expect } from 'vitest'
import {
  normalizeAppearancePrefs,
  appearanceHtmlClasses,
  setAppearancePref,
  APPEARANCE_DEFAULTS,
  REDUCE_MOTION_CLASS,
  COMPACT_DENSITY_CLASS,
  type AppearancePrefs,
} from './appearancePrefs'

// ============================================================
//  外觀可達性偏好 — 純函式測試
//  ------------------------------------------------------------
//  全部純由輸入推導，唔讀 DOM / 此刻，故唔使 fake timers / jsdom。
//  重點守住「預設關＝不變行為」（空 class）同壞值正規化（只 true 先當開）。
// ============================================================

describe('normalizeAppearancePrefs', () => {
  it('null / undefined / 空物件 → 全部預設關', () => {
    for (const bad of [null, undefined, {}]) {
      expect(normalizeAppearancePrefs(bad as never)).toEqual(APPEARANCE_DEFAULTS)
    }
  })

  it('只有 === true 先當開（壞值一律 fallback 關）', () => {
    // 各種 truthy-but-not-true 嘅壞值都唔應該開，保住「不變行為」
    const bad = {
      reduceMotion: 'true', // 字串唔算
      compactDensity: 1, // 數字唔算
    }
    expect(normalizeAppearancePrefs(bad as never)).toEqual({
      reduceMotion: false,
      compactDensity: false,
    })
  })

  it('真 boolean true 各自獨立開', () => {
    expect(normalizeAppearancePrefs({ reduceMotion: true })).toEqual({
      reduceMotion: true,
      compactDensity: false,
    })
    expect(normalizeAppearancePrefs({ compactDensity: true })).toEqual({
      reduceMotion: false,
      compactDensity: true,
    })
    expect(
      normalizeAppearancePrefs({ reduceMotion: true, compactDensity: true }),
    ).toEqual({ reduceMotion: true, compactDensity: true })
  })

  it('false 明確保留做關', () => {
    expect(
      normalizeAppearancePrefs({ reduceMotion: false, compactDensity: false }),
    ).toEqual(APPEARANCE_DEFAULTS)
  })
})

describe('appearanceHtmlClasses', () => {
  it('預設（全關）→ 空陣列（行為完全不變）', () => {
    expect(appearanceHtmlClasses(APPEARANCE_DEFAULTS)).toEqual([])
  })

  it('reduceMotion 開 → 只得 reduce-motion class', () => {
    expect(
      appearanceHtmlClasses({ reduceMotion: true, compactDensity: false }),
    ).toEqual([REDUCE_MOTION_CLASS])
  })

  it('compactDensity 開 → 只得 density-compact class', () => {
    expect(
      appearanceHtmlClasses({ reduceMotion: false, compactDensity: true }),
    ).toEqual([COMPACT_DENSITY_CLASS])
  })

  it('兩個都開 → 兩個 class，次序固定（reduce-motion 先）', () => {
    expect(
      appearanceHtmlClasses({ reduceMotion: true, compactDensity: true }),
    ).toEqual([REDUCE_MOTION_CLASS, COMPACT_DENSITY_CLASS])
  })

  it('class 名同 CSS selector 對齊（防手誤改名）', () => {
    expect(REDUCE_MOTION_CLASS).toBe('reduce-motion')
    expect(COMPACT_DENSITY_CLASS).toBe('density-compact')
  })
})

describe('setAppearancePref', () => {
  const base: AppearancePrefs = { reduceMotion: false, compactDensity: false }

  it('唔傳 next → toggle 反轉目標欄位', () => {
    const a = setAppearancePref(base, 'reduceMotion')
    expect(a.reduceMotion).toBe(true)
    expect(setAppearancePref(a, 'reduceMotion').reduceMotion).toBe(false)
  })

  it('傳 next → 直接設定該值（idempotent）', () => {
    const a = setAppearancePref(base, 'compactDensity', true)
    expect(a.compactDensity).toBe(true)
    expect(setAppearancePref(a, 'compactDensity', true).compactDensity).toBe(true)
  })

  it('immutable：唔 mutate 入參、唔影響另一欄位', () => {
    const next = setAppearancePref(base, 'reduceMotion', true)
    expect(next).not.toBe(base)
    expect(base.reduceMotion).toBe(false) // 入參不變
    expect(next.compactDensity).toBe(false) // 另一欄位保留
  })
})
