import { describe, expect, it } from 'vitest'
import {
  buildDailyBriefing,
  buildLocalAgentPlan,
  isBriefingRequest,
  isPlanCancellation,
  isPlanConfirmation,
  parseNaturalDateTime,
  stripAssistantWakeWord,
  type AssistantContext,
} from './agent'

const NOW = new Date(2026, 7, 20, 9, 0, 0)
const CONTEXT: AssistantContext = {
  todayKey: '2026-08-20',
  overdueCount: 1,
  activeTasks: [
    { id: 't1', text: '批改 5A 班練習', due: '2026-08-20' },
    { id: 't2', text: '預備下星期寫作課堂' },
  ],
  completedTasks: [{ id: 't3', text: '上載功課到學校平台' }],
  todayEvents: [{ id: 'e1', title: '科會', time: '15:30' }],
}

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

  it('把「處理所有待辦」變成有明確項目數的真實更新', () => {
    expect(
      buildLocalAgentPlan('全部待辦事項都處理，幫我搞掂佢', NOW, CONTEXT),
    ).toMatchObject({
      needsConfirmation: true,
      steps: [
        {
          kind: 'complete_tasks',
          taskIds: ['t1', 't2'],
          title: '完成 2 項待辦',
        },
      ],
    })
    expect(
      buildLocalAgentPlan('將所有未完成待辦標記為完成', NOW, CONTEXT),
    ).toMatchObject({
      steps: [{ kind: 'complete_tasks', taskIds: ['t1', 't2'] }],
    })
    expect(buildLocalAgentPlan('全部已完成', NOW, CONTEXT)).toMatchObject({
      steps: [{ kind: 'complete_tasks', taskIds: ['t1', 't2'] }],
    })
  })

  it('可重開或刪除已知待辦，但仍要確認', () => {
    expect(buildLocalAgentPlan('將所有已完成待辦改回未完成', NOW, CONTEXT)).toMatchObject({
      steps: [{ kind: 'reopen_tasks', taskIds: ['t3'] }],
    })
    expect(buildLocalAgentPlan('刪除所有待辦事項', NOW, CONTEXT)).toMatchObject({
      steps: [{ kind: 'delete_tasks', taskIds: ['t1', 't2', 't3'] }],
    })
  })

  it('可以直接開啟完整白名單內的工具', () => {
    expect(buildLocalAgentPlan('打開時間表', NOW, CONTEXT)).toMatchObject({
      needsConfirmation: false,
      steps: [{ kind: 'open_tool', featureId: 'work-timetable' }],
    })
    expect(buildLocalAgentPlan('完成所有待辦，再打開時間表', NOW, CONTEXT)).toMatchObject({
      needsConfirmation: true,
      steps: [
        { kind: 'complete_tasks', taskIds: ['t1', 't2'] },
        { kind: 'open_tool', featureId: 'work-timetable' },
      ],
    })
    expect(buildLocalAgentPlan('完成所有待辦，再打開討論區', NOW, CONTEXT)).toMatchObject({
      steps: [
        { kind: 'complete_tasks' },
        { kind: 'open_tool', featureId: 'community-forum' },
      ],
    })
  })

  it('辨認文字及語音確認與取消', () => {
    expect(isPlanConfirmation('係')).toBe(true)
    expect(isPlanConfirmation('確認執行')).toBe(true)
    expect(isPlanCancellation('唔好')).toBe(true)
    expect(isPlanCancellation('取消')).toBe(true)
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
        completedTasks: [],
        todayEvents: [{ id: 'e1', title: '科會', time: '15:30' }],
      }),
    ).toContain('今日有 1 項未完成待辦，1 個日程')
  })
})
