import { describe, expect, it } from 'vitest'
import { inferWorkToolRoute } from './homeRouting'

describe('首頁工作任務分流', () => {
  it.each([
    ['我想整 ppt', 'work-slides'],
    ['生成一份 DSE 風格工作紙', 'work-generate'],
    ['分析今次測驗成績同預測等級', 'work-grade-analytics'],
    ['幫我準備市場營銷一堂課的教案', 'work-lesson-plan'],
    ['為這份功課建立評分準則', 'work-rubric'],
    ['把這份行政通告撮要成待辦', 'work-doc-digest'],
    ['回覆家長的電郵', 'work-prompt-library'],
  ])('%s → %s', (input, featureId) => {
    expect(inferWorkToolRoute(input)?.featureId).toBe(featureId)
  })

  it('工作紙會帶入對應生成器', () => {
    expect(inferWorkToolRoute('生成一份工作紙')?.materialTool).toBe('worksheet')
  })

  it('一般問題保留給教學助手', () => {
    expect(inferWorkToolRoute('什麼是市場營銷？')).toBeNull()
  })
})
