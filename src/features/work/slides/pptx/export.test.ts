// src/features/work/slides/pptx/export.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const addText = vi.fn()
const addTable = vi.fn()
const addShape = vi.fn()
const slideObj = { addText, addTable, addShape, background: undefined as unknown }
const addSlide = vi.fn(() => slideObj)
const writeFile = vi.fn(() => Promise.resolve('deck.pptx'))

vi.mock('pptxgenjs', () => {
  return {
    default: class {
      static LAYOUT_16x9 = 'LAYOUT_16x9'
      layout = ''
      addSlide = addSlide
      writeFile = writeFile
    },
  }
})

import { exportDeckPptx, pptxFileName } from './export'
import { getTheme } from '../themes'
import type { SlideDeck } from '../types'

const deck: SlideDeck = {
  id: 'd1', title: '通脹 / 報告', themeId: 'academic', slides: [
    { id: 's1', content: { type: 'title', heading: '通脹' } },
    { id: 's2', content: { type: 'bullets', heading: '成因', items: ['需求'] } },
  ], createdAt: 'x', updatedAt: 'x',
}

describe('slides/pptx/export', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pptxFileName 消毒非法檔名字元並加副檔名', () => {
    expect(pptxFileName('通脹 / 報告')).toBe('通脹 _ 報告.pptx')
  })

  it('每張 slide 都 addSlide，最後 writeFile（檔名來自 deck.title）', async () => {
    await exportDeckPptx(deck, getTheme('academic'))
    expect(addSlide).toHaveBeenCalledTimes(2)
    expect(addText).toHaveBeenCalled()      // title + bullets 都會 addText
    expect(writeFile).toHaveBeenCalledWith({ fileName: '通脹 _ 報告.pptx' })
  })
})
