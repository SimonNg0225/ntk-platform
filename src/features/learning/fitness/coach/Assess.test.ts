import { describe, it, expect } from 'vitest'
import { num, bmi, bmiBand, strArr, parseAdvice, buildPrompt } from './Assess'

// ============================================================
//  AI 體態診斷 — 純函式測試（vitest, node 環境，唔 render React）
//  專測空 / 除零 / NaN / 負值 / 缺值守衞 + JSON 解析韌性。
// ============================================================

describe('num', () => {
  it('parses positive finite numbers', () => {
    expect(num('172')).toBe(172)
    expect(num('68.5')).toBe(68.5)
  })

  it('rejects empty / non-numeric → null', () => {
    expect(num('')).toBeNull()
    expect(num('   ')).toBeNull()
    expect(num('abc')).toBeNull()
  })

  it('rejects zero, negative and non-finite → null（守衞）', () => {
    expect(num('0')).toBeNull()
    expect(num('-5')).toBeNull()
    expect(num('Infinity')).toBeNull()
    expect(num('NaN')).toBeNull()
  })
})

describe('bmi', () => {
  it('computes rounded BMI for valid input', () => {
    // 68 / (1.72^2) = 22.99… → 23
    expect(bmi('172', '68')).toBe(23)
    // 50 / (1.5^2) = 22.22… → 22.2
    expect(bmi('150', '50')).toBe(22.2)
  })

  it('returns null on missing height or weight（缺值守衞）', () => {
    expect(bmi('', '68')).toBeNull()
    expect(bmi('172', '')).toBeNull()
    expect(bmi('', '')).toBeNull()
  })

  it('returns null on zero / negative height（除零守衞，唔出 Infinity）', () => {
    expect(bmi('0', '68')).toBeNull()
    expect(bmi('-10', '68')).toBeNull()
  })

  it('never returns NaN / Infinity for any string input', () => {
    const inputs = ['', '0', '-1', 'x', '0.0001']
    for (const h of inputs)
      for (const w of inputs) {
        const v = bmi(h, w)
        if (v !== null) expect(Number.isFinite(v)).toBe(true)
      }
  })
})

describe('bmiBand', () => {
  it('classifies the four WHO-ish bands by boundary', () => {
    expect(bmiBand(18).label).toBe('偏輕')
    expect(bmiBand(18.5).label).toBe('正常')
    expect(bmiBand(23.9).label).toBe('正常')
    expect(bmiBand(24).label).toBe('過重')
    expect(bmiBand(26.9).label).toBe('過重')
    expect(bmiBand(27).label).toBe('肥胖')
    expect(bmiBand(40).label).toBe('肥胖')
  })

  it('always returns a tone class', () => {
    expect(bmiBand(22).tone).toMatch(/text-/)
  })
})

describe('strArr', () => {
  it('keeps trimmed non-empty strings only', () => {
    expect(strArr([' a ', 'b', '  '])).toEqual(['a', 'b'])
  })

  it('drops non-string members', () => {
    expect(strArr(['a', 1, null, undefined, {}, 'b'])).toEqual(['a', 'b'])
  })

  it('returns [] for non-array input（守衞）', () => {
    expect(strArr(null)).toEqual([])
    expect(strArr(undefined)).toEqual([])
    expect(strArr('a')).toEqual([])
    expect(strArr(42)).toEqual([])
  })
})

describe('parseAdvice', () => {
  it('parses clean JSON', () => {
    const r = parseAdvice('{"bullets":["練腿"],"cautions":["腰要小心"]}')
    expect(r).toEqual({ bullets: ['練腿'], cautions: ['腰要小心'] })
  })

  it('strips markdown code fence (```json …)', () => {
    const raw = '```json\n{"bullets":["a"],"cautions":[]}\n```'
    expect(parseAdvice(raw)).toEqual({ bullets: ['a'], cautions: [] })
  })

  it('tolerates one missing key', () => {
    expect(parseAdvice('{"bullets":["a"]}')).toEqual({ bullets: ['a'], cautions: [] })
    expect(parseAdvice('{"cautions":["c"]}')).toEqual({ bullets: [], cautions: ['c'] })
  })

  it('returns null on invalid JSON（唔擲）', () => {
    expect(parseAdvice('not json at all')).toBeNull()
    expect(parseAdvice('')).toBeNull()
  })

  it('returns null when both arrays empty / absent', () => {
    expect(parseAdvice('{"bullets":[],"cautions":[]}')).toBeNull()
    expect(parseAdvice('{}')).toBeNull()
  })

  it('filters junk members out of arrays', () => {
    const r = parseAdvice('{"bullets":["ok", 5, null, "  "],"cautions":[]}')
    expect(r).toEqual({ bullets: ['ok'], cautions: [] })
  })
})

describe('buildPrompt', () => {
  const form = {
    height: '172',
    weight: '68',
    goal: '增肌',
    level: '中階（2 至 5 年）',
    injury: '膝頭舊患',
  }

  it('includes provided fields and BMI when given', () => {
    const p = buildPrompt(form, 23)
    expect(p).toContain('身高：172 cm')
    expect(p).toContain('體重：68 kg')
    expect(p).toContain('BMI：23')
    expect(p).toContain('主要目標：增肌')
    expect(p).toContain('膝頭舊患')
  })

  it('omits the BMI line when bmiValue is null', () => {
    const p = buildPrompt(form, null)
    expect(p).not.toContain('BMI：')
  })

  it('falls back to 未提供 / 無 for blank fields', () => {
    const p = buildPrompt({ height: '', weight: '', goal: '減脂', level: '新手', injury: '' }, null)
    expect(p).toContain('身高：未提供 cm')
    expect(p).toContain('體重：未提供 kg')
    expect(p).toContain('受傷史 / 限制：無')
  })

  it('always asks for strict JSON output', () => {
    expect(buildPrompt(form, 23)).toContain('只回 JSON')
  })
})
