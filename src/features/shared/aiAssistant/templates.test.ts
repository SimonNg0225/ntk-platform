// templates.ts 嘅 {{變數}} 純函式測試：extractVars / fillTemplate。
// 兩者皆純正則處理（無日期、無時區相依），故唔需鎖 TZ。
// builtinTemplates 內所有範本都靠呢兩個運作 —— 抽變數彈表單 + 代入，
// 任一錯就「插入表單／代入」全爛，故此處覆蓋正常 + 邊界 + 空 / 重複 / 多餘 key。

import { describe, it, expect } from 'vitest'
import {
  extractVars,
  fillTemplate,
  builtinTemplates,
  TEMPLATE_VAR_RE,
} from './templates'

describe('extractVars — 抽出 {{變數}}（去重、trim、保次序）', () => {
  it('多個 {{a}}{{b}} 依次抽出', () => {
    expect(extractVars('{{a}} 同 {{b}}')).toEqual(['a', 'b'])
  })

  it('重複 {{x}}…{{x}} 去重只回一個', () => {
    expect(extractVars('{{x}} 然後再 {{x}}')).toEqual(['x'])
  })

  it('佔位內外空白被 trim（{{ 概念 A }} → "概念 A"，內部單一空格保留）', () => {
    expect(extractVars('比較「{{ 概念 A }}」')).toEqual(['概念 A'])
  })

  it('無變數 → []', () => {
    expect(extractVars('一段完全冇佔位嘅文字。')).toEqual([])
  })

  it('空字串 → []', () => {
    expect(extractVars('')).toEqual([])
  })

  it('保留首次出現次序（即使後面先重複到前面嘅變數）', () => {
    // 出現次序：概念、內容、概念(重複)、筆記 → 去重後保首見次序
    expect(extractVars('{{概念}} {{內容}} {{概念}} {{筆記}}')).toEqual([
      '概念',
      '內容',
      '筆記',
    ])
  })

  it('混合重複 + 多變數：去重但維持各自首見位置', () => {
    expect(extractVars('{{a}}{{b}}{{a}}{{c}}{{b}}')).toEqual(['a', 'b', 'c'])
  })

  it('空佔位 {{}} / 只得空白 {{   }} 被當無名跳過（trim 後為空，不入列）', () => {
    expect(extractVars('前 {{}} 中 {{   }} 後 {{真}}')).toEqual(['真'])
  })

  it('去重對「內外空白差異」一視同仁（{{x}} 同 {{ x }} 視為同一個）', () => {
    expect(extractVars('{{x}} 與 {{ x }}')).toEqual(['x'])
  })

  it('非貪婪：相鄰兩組 {{a}}{{b}} 唔會被吞成一個', () => {
    // 若用貪婪 [^}] 以外寫法易誤配；此處確認逐組分開
    expect(extractVars('{{a}}{{b}}')).toEqual(['a', 'b'])
  })

  it('真實範本（l-compare）抽出兩個概念變數', () => {
    const t = builtinTemplates('learning').find((x) => x.id === 'l-compare')!
    expect(extractVars(t.body)).toEqual(['概念 A', '概念 B'])
  })
})

describe('fillTemplate — 代入 {{變數}}（trim、缺值留空）', () => {
  it('正常代入', () => {
    expect(fillTemplate('你好 {{name}}', { name: '世界' })).toBe('你好 世界')
  })

  it('values 缺某 key → 該位置變空字串', () => {
    expect(fillTemplate('A{{x}}B', {})).toBe('AB')
  })

  it('value 兩邊空白被 trim', () => {
    expect(fillTemplate('[{{x}}]', { x: '  中間  ' })).toBe('[中間]')
  })

  it('同一變數出現多次全部代入', () => {
    expect(fillTemplate('{{x}}-{{x}}-{{x}}', { x: 'Q' })).toBe('Q-Q-Q')
  })

  it('values 多餘 key 唔影響結果', () => {
    expect(fillTemplate('{{a}}', { a: '1', b: '2', c: '3' })).toBe('1')
  })

  it('body 無 placeholder → 原樣回', () => {
    expect(fillTemplate('純文字冇佔位', { a: 'x' })).toBe('純文字冇佔位')
  })

  it('佔位用內外帶空白寫法（{{ a }}）亦能用 trim 後 key 命中', () => {
    expect(fillTemplate('{{ a }}', { a: '命中' })).toBe('命中')
  })

  it('部分缺值：有值代入、缺值留空', () => {
    expect(fillTemplate('{{a}}|{{b}}', { a: '有' })).toBe('有|')
  })

  it('value 為空字串 → 該位置同樣留空（與缺 key 結果一致）', () => {
    expect(fillTemplate('A{{x}}B', { x: '   ' })).toBe('AB') // 全空白 trim 後為空
    expect(fillTemplate('A{{x}}B', { x: '' })).toBe('AB')
  })

  it('value 內部空白保留（只 trim 兩端）', () => {
    expect(fillTemplate('{{x}}', { x: '  a  b  ' })).toBe('a  b')
  })

  it('extractVars + fillTemplate 往返：抽出每個變數逐一填值，無殘留佔位', () => {
    const body = '就「{{課題}}」出 {{題數}} 條 MC 題'
    const vars = extractVars(body)
    const values = Object.fromEntries(vars.map((v) => [v, `<${v}>`]))
    const filled = fillTemplate(body, values)
    expect(filled).toBe('就「<課題>」出 <題數> 條 MC 題')
    // 確認再無任何 {{…}} 殘留
    expect(extractVars(filled)).toEqual([])
  })
})

describe('builtinTemplates — 範本庫 + 與抽 / 填一致性', () => {
  it("mode 'work' 回 WORK 範本（含 BAFS MC 題）", () => {
    const work = builtinTemplates('work')
    expect(work.some((t) => t.id === 'w-mc')).toBe(true)
    // work 集唔應含 learning 專屬範本
    expect(work.some((t) => t.id === 'l-explain')).toBe(false)
  })

  it("非 'work'（如 'learning'）回 LEARNING 範本", () => {
    const learn = builtinTemplates('learning')
    expect(learn.some((t) => t.id === 'l-explain')).toBe(true)
    expect(learn.some((t) => t.id === 'w-mc')).toBe(false)
  })

  it('每個內建範本：fillTemplate(body, {}) 後再無 {{…}} 佔位殘留（守護正則同步）', () => {
    const all = [...builtinTemplates('work'), ...builtinTemplates('learning')]
    for (const t of all) {
      const blanked = fillTemplate(t.body, {})
      expect(extractVars(blanked)).toEqual([])
      // 缺值留空 → 殘留 body 唔應再有原始 "{{" 序列
      expect(blanked.includes('{{')).toBe(false)
    }
  })
})

describe('TEMPLATE_VAR_RE — 共用正則狀態守護', () => {
  it('帶 g flag；連續調用前已重置 lastIndex（避免 stateful regex 漏配）', () => {
    expect(TEMPLATE_VAR_RE.flags).toContain('g')
    // 連環抽兩次同一字串應得相同結果（若 lastIndex 殘留會第二次漏配）
    const s = '{{a}} {{b}}'
    expect(extractVars(s)).toEqual(extractVars(s))
    expect(extractVars(s)).toEqual(['a', 'b'])
  })
})
