import { describe, expect, it } from 'vitest'
import {
  buildDailyBriefing,
  buildLocalAgentPlan,
  isBriefingRequest,
  parseNaturalDateTime,
  stripAssistantWakeWord,
} from './agent'

const NOW = new Date(2026, 7, 20, 9, 0, 0)

describe('智能助手日期理解', () => {
  it('理解最近的星期與下星期時間', () => {
    expect(parseNaturalDateTime('星期五前完成', NOW)).toEqual({
      date: '2026-08-21',
      time: undefined,
    })
    expect(parseNaturalDateTime('下星期二下午3點家長晚會', NOW)).toEqual({
      date: '2026-08-25',
      time: '15:00',
    })
  })

  it('理解香港常用相對日期', () => {
    expect(parseNaturalDateTime('聽日上午十點', NOW)).toEqual({
      date: '2026-08-21',
      time: '10:00',
    })
  })
})

describe('智能助手規劃', () => {
  it('把複合教學要求拆成課堂套裝與待辦', () => {
    const plan = buildLocalAgentPlan(
      'Ezi，幫我準備中二百分比教案、工作紙和簡報，再提醒我星期五前完成',
      NOW,
    )
    expect(plan).toMatchObject({
      title: '我會分 2 步完成',
      needsConfirmation: true,
      steps: [
        { kind: 'open_tool', featureId: 'work-classroom-pack' },
        { kind: 'create_task', due: '2026-08-21' },
      ],
    })
  })

  it('有完整日期才直接建立日程', () => {
    expect(buildLocalAgentPlan('下星期二下午3點家長晚會加入日曆', NOW)).toMatchObject({
      needsConfirmation: true,
      steps: [
        {
          kind: 'create_event',
          eventTitle: '家長晚會',
          date: '2026-08-25',
          time: '15:00',
        },
      ],
    })
  })

  it('單一低風險工具指令毋須多一步確認', () => {
    expect(buildLocalAgentPlan('幫我整一份中二百分比簡報', NOW)).toMatchObject({
      needsConfirmation: false,
      steps: [{ kind: 'open_tool', featureId: 'work-slides' }],
    })
  })
})

describe('智能助手上下文', () => {
  it('辨認今日簡報並以本機資料生成摘要', () => {
    expect(isBriefingRequest('Ezi，今日有咩要做？')).toBe(true)
    expect(stripAssistantWakeWord('Ezi，今日有咩要做？')).toBe('今日有咩要做？')
    expect(
      buildDailyBriefing({
        todayKey: '2026-08-20',
        overdueCount: 1,
        activeTasks: [{ id: 't1', text: '批改試卷', due: '2026-08-20' }],
        todayEvents: [{ id: 'e1', title: '科會', time: '15:30' }],
      }),
    ).toContain('今日有 1 項未完成待辦，1 個日程')
  })
})
