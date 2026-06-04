// @vitest-environment jsdom
//
// highlightTagsInElement / colorForIndex 單元測試。
// ⚠️ highlightTagsInElement 用 document.createTreeWalker + DOM API，
// 需要瀏覽器環境。本 repo vitest 預設 environment='node'（見
// vitest.config.ts），故喺檔案頂用 per-file pragma 切到 jsdom。

import { describe, it, expect } from 'vitest'
import {
  TAG_COLORS,
  colorForIndex,
  highlightTagsInElement,
} from './highlight'

describe('colorForIndex', () => {
  it('循環取色（0 / n-1 / n / 負數）', () => {
    const n = TAG_COLORS.length
    expect(n).toBe(8)
    expect(colorForIndex(0)).toBe(TAG_COLORS[0])
    expect(colorForIndex(7)).toBe(TAG_COLORS[7])
    // 8 → wrap 返 0
    expect(colorForIndex(8)).toBe(TAG_COLORS[0])
    // -1 → 最後一隻
    expect(colorForIndex(-1)).toBe(TAG_COLORS[n - 1])
    // 大正數仍循環
    expect(colorForIndex(8 + 3)).toBe(TAG_COLORS[3])
  })
})

describe('highlightTagsInElement', () => {
  it('只包命中嘅標籤、保留純文字、文字內容不變', () => {
    const el = document.createElement('div')
    el.innerHTML =
      '<p>姓名：{name} 日期：{date} 其他：{unknown}</p>'
    const tagColors = new Map([
      ['name', '#ffe'],
      ['date', '#eef'],
    ])

    highlightTagsInElement(el, tagColors)

    // 1) 啱啱 2 個 mark.adoc-tag-hl（name / date）
    const marks = el.querySelectorAll('mark.adoc-tag-hl')
    expect(marks.length).toBe(2)

    const byTag = new Map(
      Array.from(marks).map((m) => [m.getAttribute('data-tag'), m]),
    )
    expect(byTag.has('name')).toBe(true)
    expect(byTag.has('date')).toBe(true)

    // 2) background 色啱。
    // ⚠️ 讀 .style.background 會被 jsdom CSSOM 正規化（#ffe → rgb(...)），
    // 故直接斷言 inline style 屬性原文（我哋用 setAttribute 寫入嘅字面值）。
    expect(byTag.get('name')!.getAttribute('style')).toContain(
      'background:#ffe',
    )
    expect(byTag.get('date')!.getAttribute('style')).toContain(
      'background:#eef',
    )
    // 順帶確認 mark 樣式有齊圓角／內距
    expect(byTag.get('name')!.getAttribute('style')).toContain(
      'border-radius:3px',
    )

    // 3) mark 文字 = 連大括號原文
    expect(byTag.get('name')!.textContent).toBe('{name}')
    expect(byTag.get('date')!.textContent).toBe('{date}')

    // 4) {unknown} 唔喺 map → 唔被包，仍以純文字形式留喺 DOM
    expect(el.querySelector('mark[data-tag="unknown"]')).toBeNull()
    expect(el.textContent).toContain('{unknown}')

    // 5) 純文字 label 保留
    expect(el.textContent).toContain('姓名：')
    expect(el.textContent).toContain('日期：')
    expect(el.textContent).toContain('其他：')

    // 6) 整體 textContent 不變（只係包咗 mark，可見文字一樣）
    expect(el.textContent).toContain('{name}')
    expect(el.textContent).toContain('{date}')
    expect(el.textContent).toBe(
      '姓名：{name} 日期：{date} 其他：{unknown}',
    )
  })

  it('已喺 mark.adoc-tag-hl 入面嘅文字唔會重覆包', () => {
    const el = document.createElement('div')
    el.innerHTML =
      '<p><mark class="adoc-tag-hl" data-tag="name">{name}</mark> 與 {date}</p>'
    const tagColors = new Map([
      ['name', '#ffe'],
      ['date', '#eef'],
    ])

    highlightTagsInElement(el, tagColors)

    // name 已包好（1 個），date 新包（1 個）→ 共 2 個，name 唔會被再拆／嵌套
    const marks = el.querySelectorAll('mark.adoc-tag-hl')
    expect(marks.length).toBe(2)
    // name 嘅 mark 入面唔應該再有另一個 mark（無嵌套）
    const nameMark = el.querySelector('mark[data-tag="name"]')!
    expect(nameMark.querySelector('mark')).toBeNull()
  })

  it('空 tagColors → 唔郁 DOM', () => {
    const el = document.createElement('div')
    const html = '<p>姓名：{name}</p>'
    el.innerHTML = html
    highlightTagsInElement(el, new Map())
    expect(el.querySelectorAll('mark.adoc-tag-hl').length).toBe(0)
    expect(el.innerHTML).toBe(html)
  })

  it('同一 text node 多個命中標籤都拆到', () => {
    const el = document.createElement('div')
    el.innerHTML = '<p>{a}{b}</p>'
    const tagColors = new Map([
      ['a', '#fee'],
      ['b', '#eff'],
    ])
    highlightTagsInElement(el, tagColors)
    const marks = el.querySelectorAll('mark.adoc-tag-hl')
    expect(marks.length).toBe(2)
    expect(el.textContent).toBe('{a}{b}')
  })
})
