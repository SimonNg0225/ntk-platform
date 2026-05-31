import { createCollection } from '../../../lib/store'
import type { Project, SubTask, TaskMeta, TaskTemplate } from './types'

// ============================================================
//  待辦功能專屬持久化（唔掂 data/collections.ts）
//  ------------------------------------------------------------
//  共用 tasksCol 維持唔變；以下係 Task 型別冇嘅延伸資料。
//  唯一 key（已喺 newCollections 申報）：
//    todo_task_meta / todo_subtasks / todo_projects / todo_templates
// ============================================================

export const taskMetaCol = createCollection<TaskMeta>('todo_task_meta', [])
export const subtasksCol = createCollection<SubTask>('todo_subtasks', [])

// 預設兩個示範專案（老師日常）
export const projectsCol = createCollection<Project>('todo_projects', [
  {
    id: 'proj-teaching',
    name: '教學',
    color: 'blue',
    emoji: '📚',
    order: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'proj-admin',
    name: '行政',
    color: 'amber',
    emoji: '🗂️',
    order: 1,
    createdAt: new Date().toISOString(),
  },
])

// 內建範本（可直接用，亦可自製新範本）
export const templatesCol = createCollection<TaskTemplate>('todo_templates', [
  {
    id: 'tmpl-marking',
    name: '批改一份練習',
    emoji: '✍️',
    items: [
      { text: '收齊全班功課', priority: 2 },
      { text: '批改 + 寫評語', priority: 1, dueOffset: 2 },
      { text: '記錄分數入成績冊', priority: 2, dueOffset: 2 },
      { text: '派返 + 講解常見錯誤', priority: 3, dueOffset: 3 },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tmpl-lesson',
    name: '備一堂新課',
    emoji: '🧑‍🏫',
    items: [
      { text: '睇課程綱要 + 定學習目標', priority: 2 },
      {
        text: '準備教材',
        priority: 1,
        dueOffset: 1,
        subtasks: ['簡報', '工作紙', '例子 / 個案'],
      },
      { text: '預備課堂活動 / 提問', priority: 2, dueOffset: 1 },
      { text: '上載資源到學校平台', priority: 3, dueOffset: 2 },
    ],
    createdAt: new Date().toISOString(),
  },
])

// ───────── TaskMeta upsert（key = task.id；一對一）─────────
export function upsertMeta(taskId: string, patch: Partial<Omit<TaskMeta, 'id'>>) {
  const existing = taskMetaCol.get().find((m) => m.id === taskId)
  if (existing) {
    taskMetaCol.update(taskId, { ...patch, updatedAt: new Date().toISOString() })
  } else {
    taskMetaCol.add({
      id: taskId,
      priority: 4,
      tags: [],
      order: Date.now(),
      ...patch,
      updatedAt: new Date().toISOString(),
    })
  }
}

// 確保某條任務有 meta，回傳之（讀取時補底，避免舊資料無 meta）
export function ensureMeta(taskId: string): TaskMeta {
  const existing = taskMetaCol.get().find((m) => m.id === taskId)
  if (existing) return existing
  const created: TaskMeta = {
    id: taskId,
    priority: 4,
    tags: [],
    order: Date.now(),
    updatedAt: new Date().toISOString(),
  }
  taskMetaCol.add(created)
  return created
}

// ───────── 級聯刪除（任務刪走時清埋 meta + subtasks）─────────
export function cascadeDeleteTask(taskId: string) {
  taskMetaCol.remove(taskId)
  for (const s of subtasksCol.get().filter((s) => s.taskId === taskId)) {
    subtasksCol.remove(s.id)
  }
}

// ───────── 清孤兒（meta / subtask 指向已刪任務）─────────
export function pruneOrphans(validTaskIds: Set<string>) {
  for (const m of taskMetaCol.get()) {
    if (!validTaskIds.has(m.id)) taskMetaCol.remove(m.id)
  }
  for (const s of subtasksCol.get()) {
    if (!validTaskIds.has(s.taskId)) subtasksCol.remove(s.id)
  }
}
