import { eventsCol, tasksCol } from '../../../data/collections'
import type { Task } from '../../../data/types'
import {
  cascadeDeleteTask,
  subtasksCol,
  taskMetaCol,
  upsertMeta,
} from '../../work/todo/store'
import type { SubTask, TaskMeta } from '../../work/todo/types'
import type { AgentStep } from './agent'

type TaskSnapshot = {
  task: Task
  meta?: TaskMeta
  subtasks: SubTask[]
}

export type PlatformMutationReceipt = {
  createdTaskIds: string[]
  createdEventIds: string[]
  updatedTasks: TaskSnapshot[]
  deletedTasks: TaskSnapshot[]
}

export type PlatformStepResult = {
  affected: number
  summary: string
}

function snapshotTask(task: Task): TaskSnapshot {
  const meta = taskMetaCol.get().find((item) => item.id === task.id)
  return {
    task: { ...task },
    meta: meta ? { ...meta, tags: [...meta.tags] } : undefined,
    subtasks: subtasksCol
      .get()
      .filter((subtask) => subtask.taskId === task.id)
      .map((subtask) => ({ ...subtask })),
  }
}

function restoreTask(snapshot: TaskSnapshot) {
  const existing = tasksCol.get().some((task) => task.id === snapshot.task.id)
  if (existing) {
    tasksCol.set(
      tasksCol.get().map((task) => (task.id === snapshot.task.id ? snapshot.task : task)),
    )
  } else {
    tasksCol.add(snapshot.task)
  }

  const snapshotMeta = snapshot.meta
  if (snapshotMeta) {
    const existingMeta = taskMetaCol.get().some((meta) => meta.id === snapshotMeta.id)
    if (existingMeta) {
      taskMetaCol.set(
        taskMetaCol.get().map((meta) => (meta.id === snapshotMeta.id ? snapshotMeta : meta)),
      )
    } else {
      taskMetaCol.add(snapshotMeta)
    }
  } else {
    taskMetaCol.remove(snapshot.task.id)
  }

  for (const subtask of snapshot.subtasks) {
    const exists = subtasksCol.get().some((item) => item.id === subtask.id)
    if (exists) subtasksCol.update(subtask.id, subtask)
    else subtasksCol.add(subtask)
  }
}

export function createMutationReceipt(): PlatformMutationReceipt {
  return {
    createdTaskIds: [],
    createdEventIds: [],
    updatedTasks: [],
    deletedTasks: [],
  }
}

export function receiptMutationCount(receipt: PlatformMutationReceipt): number {
  return (
    receipt.createdTaskIds.length +
    receipt.createdEventIds.length +
    receipt.updatedTasks.length +
    receipt.deletedTasks.length
  )
}

export function executePlatformStep(
  step: Exclude<AgentStep, { kind: 'open_tool' }>,
  receipt: PlatformMutationReceipt,
  now = new Date(),
): PlatformStepResult {
  if (step.kind === 'create_task') {
    const task = tasksCol.add({
      text: step.text,
      done: false,
      createdAt: now.toISOString(),
    })
    upsertMeta(task.id, {
      due: step.due,
      priority: 3,
      tags: ['智能助手'],
      order: now.getTime(),
    })
    receipt.createdTaskIds.push(task.id)
    return { affected: 1, summary: '已新增 1 項待辦。' }
  }

  if (step.kind === 'create_event') {
    const event = eventsCol.add({
      title: step.eventTitle,
      date: step.date,
      time: step.time,
      allDay: !step.time,
      calendarId: 'cal-work',
      alertMinutes: step.time ? 30 : undefined,
      mode: 'work',
      type: '智能助手',
    })
    receipt.createdEventIds.push(event.id)
    return { affected: 1, summary: '已新增 1 個日程。' }
  }

  const targetIds = new Set(step.taskIds)
  const targets = tasksCol.get().filter((task) => targetIds.has(task.id))
  if (step.kind === 'delete_tasks') {
    for (const task of targets) {
      receipt.deletedTasks.push(snapshotTask(task))
      tasksCol.remove(task.id)
      cascadeDeleteTask(task.id)
    }
    return {
      affected: targets.length,
      summary: targets.length > 0 ? `已刪除 ${targets.length} 項待辦。` : '沒有待辦需要刪除。',
    }
  }

  const shouldBeDone = step.kind === 'complete_tasks'
  const changed = targets.filter((task) => task.done !== shouldBeDone)
  const completedAt = now.toISOString()
  for (const task of changed) {
    receipt.updatedTasks.push(snapshotTask(task))
    tasksCol.update(task.id, { done: shouldBeDone })
    upsertMeta(task.id, { completedAt: shouldBeDone ? completedAt : undefined })
  }
  const action = shouldBeDone ? '標記為完成' : '改回未完成'
  return {
    affected: changed.length,
    summary: changed.length > 0 ? `已將 ${changed.length} 項待辦${action}。` : `沒有待辦需要${action}。`,
  }
}

export function undoPlatformMutations(receipt: PlatformMutationReceipt): void {
  for (const id of receipt.createdTaskIds) {
    tasksCol.remove(id)
    cascadeDeleteTask(id)
  }
  for (const id of receipt.createdEventIds) eventsCol.remove(id)
  for (const snapshot of [...receipt.updatedTasks].reverse()) restoreTask(snapshot)
  for (const snapshot of [...receipt.deletedTasks].reverse()) restoreTask(snapshot)
}

export function receiptSummary(receipt: PlatformMutationReceipt): string {
  const parts = [
    receipt.createdTaskIds.length ? `移除剛新增的 ${receipt.createdTaskIds.length} 項待辦` : '',
    receipt.createdEventIds.length ? `移除剛新增的 ${receipt.createdEventIds.length} 個日程` : '',
    receipt.updatedTasks.length ? `還原 ${receipt.updatedTasks.length} 項待辦狀態` : '',
    receipt.deletedTasks.length ? `復原 ${receipt.deletedTasks.length} 項已刪待辦` : '',
  ].filter(Boolean)
  return parts.length > 0 ? `已撤回剛才操作：${parts.join('、')}。` : '沒有需要撤回的操作。'
}
