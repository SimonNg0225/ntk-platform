import { describe, it, expect } from 'vitest'
import { regionFor, regionsFor } from './MuscleMap'

describe('regionFor — 肌群名 fuzzy 對應區域', () => {
  it('三角肌各變體 → shoulders', () => {
    expect(regionFor('三角肌前束')).toBe('shoulders')
    expect(regionFor('三角肌中束')).toBe('shoulders')
    expect(regionFor('後三角肌')).toBe('shoulders')
    expect(regionFor('肩')).toBe('shoulders')
    expect(regionFor('旋轉肌群')).toBe('shoulders')
  })
  it('斜方肌各變體 → traps', () => {
    expect(regionFor('斜方肌上部')).toBe('traps')
    expect(regionFor('斜方肌中下部')).toBe('traps')
    expect(regionFor('斜方肌')).toBe('traps')
  })
  it('腹部 vs 腹斜（腹斜要先判 obliques）', () => {
    expect(regionFor('腹直肌')).toBe('abs')
    expect(regionFor('腹橫肌')).toBe('abs')
    expect(regionFor('核心')).toBe('abs')
    expect(regionFor('腹斜肌')).toBe('obliques')
  })
  it('手臂 / 前臂', () => {
    expect(regionFor('肱二頭肌')).toBe('biceps')
    expect(regionFor('肱肌')).toBe('biceps')
    expect(regionFor('肱橈肌')).toBe('biceps')
    expect(regionFor('肱三頭肌')).toBe('triceps')
    expect(regionFor('肱三頭肌（長頭）')).toBe('triceps')
    expect(regionFor('前臂')).toBe('forearms')
  })
  it('背部群', () => {
    expect(regionFor('背闊肌')).toBe('lats')
    expect(regionFor('菱形肌')).toBe('upperback')
    expect(regionFor('上背')).toBe('upperback')
    expect(regionFor('豎脊肌')).toBe('lowerback')
  })
  it('腿 / 臀', () => {
    expect(regionFor('股四頭肌')).toBe('quads')
    expect(regionFor('髖屈肌')).toBe('quads')
    expect(regionFor('膕繩肌')).toBe('hamstrings')
    expect(regionFor('臀大肌')).toBe('glutes')
    expect(regionFor('內收肌')).toBe('adductors')
    expect(regionFor('腓腸肌')).toBe('calves')
    expect(regionFor('比目魚肌')).toBe('calves')
    expect(regionFor('小腿')).toBe('calves')
  })
  it('胸（含上部）→ chest；未知 → null', () => {
    expect(regionFor('胸大肌')).toBe('chest')
    expect(regionFor('胸大肌上部')).toBe('chest')
    expect(regionFor('外星肌')).toBeNull()
  })
})

describe('regionsFor — 多肌群去重', () => {
  it('合併 + 去重', () => {
    const s = regionsFor(['胸大肌', '胸大肌上部', '三角肌前束', '肱三頭肌'])
    expect(s).toEqual(new Set(['chest', 'shoulders', 'triceps']))
  })
  it('空 / 全未知 → 空 set', () => {
    expect(regionsFor([]).size).toBe(0)
    expect(regionsFor(['外星肌', 'xyz']).size).toBe(0)
  })
})
