import { describe, it, expect } from 'vitest'
import { str, parsePlan, buildPrompt } from './PlanGen'

// ============================================================
//  AI 課表生成 — 純函式測試（vitest, node 環境，唔 render React）
//  專測 AI JSON 解析守衞：缺值 / 壞型別 / 空陣列 / fence / NaN。
// ============================================================

describe('str', () => {
  it('trims strings', () => {
    expect(str('  hi ')).toBe('hi')
  })

  it('stringifies finite numbers', () => {
    expect(str(4)).toBe('4')
    expect(str(0)).toBe('0')
  })

  it('uses fallback for non-string / non-finite-number', () => {
    expect(str(undefined, '—')).toBe('—')
    expect(str(null, '—')).toBe('—')
    expect(str({}, '—')).toBe('—')
    expect(str(NaN, '—')).toBe('—')
    expect(str(Infinity, '—')).toBe('—')
  })

  it('defaults fallback to empty string', () => {
    expect(str(undefined)).toBe('')
  })
})

describe('parsePlan', () => {
  it('parses a well-formed plan', () => {
    const raw = JSON.stringify({
      days: [
        {
          day: '星期一',
          focus: '胸',
          exercises: [{ name: '臥推', sets: '4', reps: '6-8', note: '收緊肩胛' }],
        },
      ],
    })
    const plan = parsePlan(raw)
    expect(plan).not.toBeNull()
    expect(plan).toHaveLength(1)
    expect(plan![0]).toEqual({
      day: '星期一',
      focus: '胸',
      exercises: [{ name: '臥推', sets: '4', reps: '6-8', note: '收緊肩胛' }],
    })
  })

  it('strips a markdown code fence before parsing', () => {
    const raw =
      '```json\n{"days":[{"day":"D1","focus":"腿","exercises":[{"name":"深蹲"}]}]}\n```'
    const plan = parsePlan(raw)
    expect(plan).toHaveLength(1)
    expect(plan![0].exercises[0].name).toBe('深蹲')
  })

  it('fills fallbacks for missing day / focus / sets / reps', () => {
    const raw = JSON.stringify({
      days: [{ exercises: [{ name: '引體上升' }] }],
    })
    const plan = parsePlan(raw)!
    expect(plan[0].day).toBe('第 1 日')
    expect(plan[0].focus).toBe('訓練')
    expect(plan[0].exercises[0].sets).toBe('—')
    expect(plan[0].exercises[0].reps).toBe('—')
    expect(plan[0].exercises[0].note).toBe('')
  })

  it('drops exercises without a name and bad members', () => {
    const raw = JSON.stringify({
      days: [
        {
          day: 'D1',
          focus: '背',
          exercises: [{ name: '划船' }, { sets: '3' }, null, 'junk', { name: '   ' }],
        },
      ],
    })
    const plan = parsePlan(raw)!
    expect(plan[0].exercises).toHaveLength(1)
    expect(plan[0].exercises[0].name).toBe('划船')
  })

  it('keeps a rest day with empty exercises array', () => {
    const raw = JSON.stringify({
      days: [{ day: '星期日', focus: '休息', exercises: [] }],
    })
    const plan = parsePlan(raw)!
    expect(plan).toHaveLength(1)
    expect(plan[0].exercises).toEqual([])
  })

  it('returns null on invalid JSON（唔擲）', () => {
    expect(parsePlan('totally not json')).toBeNull()
    expect(parsePlan('')).toBeNull()
  })

  it('returns null when days is missing or not an array', () => {
    expect(parsePlan('{}')).toBeNull()
    expect(parsePlan('{"days":"oops"}')).toBeNull()
    expect(parsePlan('{"days":123}')).toBeNull()
  })

  it('returns null when days array yields zero valid days', () => {
    expect(parsePlan('{"days":[]}')).toBeNull()
    // members exist but are all non-objects → skipped → empty → null
    expect(parsePlan('{"days":[null, "x", 5]}')).toBeNull()
  })

  it('never throws and never lets a non-finite number leak into sets/reps', () => {
    // sets is a number per JSON; str() coerces finite ones, infinite is impossible in JSON
    const raw = JSON.stringify({
      days: [{ day: 'D', focus: 'f', exercises: [{ name: 'x', sets: 4, reps: 8 }] }],
    })
    const plan = parsePlan(raw)!
    expect(plan[0].exercises[0].sets).toBe('4')
    expect(plan[0].exercises[0].reps).toBe('8')
  })
})

describe('buildPrompt', () => {
  it('embeds goal, days-per-week and equipment list', () => {
    const p = buildPrompt('增肌', ['槓鈴', '啞鈴'], 4)
    expect(p).toContain('每週 4 日')
    expect(p).toContain('主要目標：增肌')
    expect(p).toContain('槓鈴、啞鈴')
  })

  it('falls back to 徒手 when equipment list is empty', () => {
    const p = buildPrompt('減脂', [], 3)
    expect(p).toContain('只可以用以下器材：徒手')
  })

  it('always demands strict JSON', () => {
    expect(buildPrompt('力量', ['壺鈴'], 5)).toContain('只回 JSON')
  })
})
