import { describe, it, expect } from 'vitest'
import { parseManualPages, frameworkToDeck, detectManualPages } from './manualPages'

describe('parseManualPages', () => {
  it('--- 分隔：每段首行做標題、其餘做內文行', () => {
    const pages = parseManualPages('收入嘅定義\n收入係企業日常活動產生\n會令權益增加\n---\n收入確認原則\n五步模型\n控制權轉移先確認')
    expect(pages).toHaveLength(2)
    expect(pages[0]).toEqual({
      title: '收入嘅定義',
      lines: ['收入係企業日常活動產生', '會令權益增加'],
    })
    expect(pages[1].title).toBe('收入確認原則')
    expect(pages[1].lines).toEqual(['五步模型', '控制權轉移先確認'])
  })

  it('空行分隔（連續兩個換行）都斬版', () => {
    const pages = parseManualPages('第一版\n內容A\n\n第二版\n內容B\n內容C')
    expect(pages).toHaveLength(2)
    expect(pages[0].lines).toEqual(['內容A'])
    expect(pages[1].lines).toEqual(['內容B', '內容C'])
  })

  it('--- 同空行混用、多餘空段過濾', () => {
    const pages = parseManualPages('\n\nA版\n點1\n---\n\n\nB版\n點2\n\n\nC版\n點3\n---\n')
    expect(pages.map((p) => p.title)).toEqual(['A版', 'B版', 'C版'])
  })

  it('單行段：標題即係成段，無內文行', () => {
    const pages = parseManualPages('總結\n---\n下一課預告')
    expect(pages).toEqual([
      { title: '總結', lines: [] },
      { title: '下一課預告', lines: [] },
    ])
  })

  it('CRLF 換行都處理到', () => {
    const pages = parseManualPages('一\r\n點1\r\n---\r\n二\r\n點2')
    expect(pages).toHaveLength(2)
    expect(pages[1]).toEqual({ title: '二', lines: ['點2'] })
  })

  it('全空輸入回空陣列', () => {
    expect(parseManualPages('   \n\n--- \n  ')).toEqual([])
  })
})

describe('frameworkToDeck', () => {
  it('照搬入版：標題+bullets，單行段變章節（空 bullets）', () => {
    const deck = frameworkToDeck(
      [
        { title: '收入', lines: ['定義一', '定義二'] },
        { title: '小結', lines: [] },
      ],
      '會計課',
    )
    expect(deck.title).toBe('會計課')
    expect(deck.slides).toHaveLength(2)
    expect(deck.slides[0].title).toBe('收入')
    expect(deck.slides[0].bullets).toEqual(['定義一', '定義二'])
    expect(deck.slides[1].bullets).toEqual([])
    expect(deck.slides[1].layout).toBe('section')
  })

  it('每版最多 6 點、每點截 60 字', () => {
    const long = 'x'.repeat(80)
    const deck = frameworkToDeck(
      [{ title: 'T', lines: ['1', '2', '3', '4', '5', '6', '7', long] }],
      'D',
    )
    expect(deck.slides[0].bullets).toHaveLength(6)
    expect(deck.slides[0].bullets[5].length).toBeLessThanOrEqual(60)
  })
})

describe('detectManualPages', () => {
  it('有 --- 分隔 → true', () => {
    expect(detectManualPages('a\n---\nb')).toBe(true)
  })
  it('有兩段（空行分隔、每段多過一行）→ true', () => {
    expect(detectManualPages('標題一\n內容\n\n標題二\n內容')).toBe(true)
  })
  it('得一段 → false', () => {
    expect(detectManualPages('淨係一段\n冇分頁')).toBe(false)
  })
  it('空字串 → false', () => {
    expect(detectManualPages('')).toBe(false)
  })
})
