import { describe, expect, it } from 'vitest'
import { inferWorkToolRoute } from './homeRouting'

describe('首頁工作任務分流', () => {
  it.each([
    ['為百分比建立課堂套裝，包括教案、工作紙及簡報', 'work-classroom-pack'],
    ['一次整好教案、工作紙同 PPT', 'work-classroom-pack'],
    ['我想整 ppt', 'work-slides'],
    ['生成一份 DSE 風格工作紙', 'work-generate'],
    ['生成一份百分比工作紙，連答案和評分準則', 'work-generate'],
    ['分析今次測驗成績同預測等級', 'work-grade-analytics'],
    ['幫我準備市場營銷一堂課的教案', 'work-lesson-plan'],
    ['為這份功課建立評分準則', 'work-rubric'],
    ['為這份工作紙建立評分準則', 'work-rubric'],
    ['把這份行政通告撮要成待辦', 'work-doc-digest'],
    ['回覆家長的電郵', 'work-prompt-library'],
    ['打開智能語音助手', 'work-voice-assistant'],
    ['提醒我星期五前批改中二試卷', 'work-tasks'],
    ['把家長晚會加入行事曆', 'calendar'],
    ['開一份科會會議記錄', 'work-meeting-notes'],
  ])('%s → %s', (input, featureId) => {
    expect(inferWorkToolRoute(input)?.featureId).toBe(featureId)
  })

  it('工作紙會帶入對應生成器', () => {
    expect(inferWorkToolRoute('生成一份工作紙')?.materialTool).toBe('worksheet')
  })

  it.each([
    ['提醒我星期五前批改中二試卷', '星期五前批改中二試卷'],
    ['把家長晚會加入行事曆', '家長晚會'],
    ['開一份科會會議記錄', '科會'],
  ])('語音操作詞不會混入表單內容：%s', (input, expected) => {
    expect(inferWorkToolRoute(input)?.handoffText).toBe(expected)
  })

  it('一般問題保留給教學助手', () => {
    expect(inferWorkToolRoute('什麼是市場營銷？')).toBeNull()
  })
})
