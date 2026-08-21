import { beforeEach, describe, expect, it } from 'vitest'
import { eventsCol, tasksCol } from '../../../data/collections'
import { subtasksCol, taskMetaCol } from '../../work/todo/store'
import {
  createMutationReceipt,
  executePlatformStep,
  receiptMutationCount,
  undoPlatformMutations,
} from './platformExecutor'

const NOW = new Date('2026-08-21T10:00:00.000Z')

beforeEach(() => {
  tasksCol.set([
    { id: 'task-a', text: '批改練習', done: false, createdAt: '2026-08-20T00:00:00.000Z' },
    { id: 'task-b', text: '準備教案', done: false, createdAt: '2026-08-20T01:00:00.000Z' },
  ])
  taskMetaCol.set([
    {
      id: 'task-a',
      priority: 2,
      tags: ['教學'],
      order: 1,
      updatedAt: '2026-08-20T00:00:00.000Z',
    },
  ])
  subtasksCol.set([
    { id: 'sub-a', taskId: 'task-a', text: '5A 班', done: false, order: 1 },
  ])
  eventsCol.set([])
})

describe('平台指令執行器', () => {
  it('實際完成指定待辦，記錄完成時間，並可完整撤回', () => {
    const receipt = createMutationReceipt()
    const result = executePlatformStep(
      {
        id: 'step-1',
        kind: 'complete_tasks',
        title: '完成待辦',
        detail: '兩項',
        taskIds: ['task-a', 'task-b'],
      },
      receipt,
      NOW,
    )

    expect(result).toEqual({ affected: 2, summary: '已將 2 項待辦標記為完成。' })
    expect(tasksCol.get().every((task) => task.done)).toBe(true)
    expect(taskMetaCol.get().find((meta) => meta.id === 'task-a')?.completedAt).toBe(
      NOW.toISOString(),
    )
    expect(receiptMutationCount(receipt)).toBe(2)

    undoPlatformMutations(receipt)
    expect(tasksCol.get().every((task) => !task.done)).toBe(true)
    expect(taskMetaCol.get().find((meta) => meta.id === 'task-a')?.completedAt).toBeUndefined()
  })

  it('刪除待辦時一併處理附屬資料，撤回後全部復原', () => {
    const receipt = createMutationReceipt()
    executePlatformStep(
      {
        id: 'step-1',
        kind: 'delete_tasks',
        title: '刪除待辦',
        detail: '一項',
        taskIds: ['task-a'],
      },
      receipt,
      NOW,
    )

    expect(tasksCol.get().some((task) => task.id === 'task-a')).toBe(false)
    expect(taskMetaCol.get().some((meta) => meta.id === 'task-a')).toBe(false)
    expect(subtasksCol.get().some((subtask) => subtask.taskId === 'task-a')).toBe(false)

    undoPlatformMutations(receipt)
    expect(tasksCol.get().find((task) => task.id === 'task-a')?.text).toBe('批改練習')
    expect(taskMetaCol.get().find((meta) => meta.id === 'task-a')?.priority).toBe(2)
    expect(subtasksCol.get().find((subtask) => subtask.id === 'sub-a')?.text).toBe('5A 班')
  })

  it('新增待辦及日程後，以同一回條撤回', () => {
    const receipt = createMutationReceipt()
    executePlatformStep(
      {
        id: 'step-1',
        kind: 'create_task',
        title: '新增待辦',
        detail: '跟進家長信',
        text: '跟進家長信',
      },
      receipt,
      NOW,
    )
    executePlatformStep(
      {
        id: 'step-2',
        kind: 'create_event',
        title: '新增日程',
        detail: '科會',
        eventTitle: '科會',
        date: '2026-08-22',
        time: '15:00',
      },
      receipt,
      NOW,
    )

    expect(tasksCol.get().some((task) => task.text === '跟進家長信')).toBe(true)
    expect(eventsCol.get().some((event) => event.title === '科會')).toBe(true)
    undoPlatformMutations(receipt)
    expect(tasksCol.get().some((task) => task.text === '跟進家長信')).toBe(false)
    expect(eventsCol.get()).toHaveLength(0)
  })
})
