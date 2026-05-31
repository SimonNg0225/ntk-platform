import type { Entity } from '../../../lib/store'

// ============================================================
//  待辦（Things / Todoist 級）功能專屬型別
//  ------------------------------------------------------------
//  共用 tasksCol（Task: text / done / createdAt）維持唔變，
//  係單一真相來源。本功能需要、而 Task 冇嘅屬性（優先級 /
//  到期 / 專案 / 標籤 / 備註 / 排序）+ 子任務 + 專案清單，
//  全部存喺呢個 feature 自己嘅 collection（唔掂 data/collections.ts）。
//  TaskMeta 以「task.id」做 id（一對一 sidecar）。
// ============================================================

// P1 最緊要 → P4 無（Todoist 慣例）
export type Priority = 1 | 2 | 3 | 4

// 一條任務嘅延伸中繼資料（sidecar，key = task.id）
export interface TaskMeta extends Entity {
  priority: Priority
  due?: string // YYYY-MM-DD（到期日，選填）
  projectId?: string // 對應 Project.id（無 = 收件匣）
  tags: string[]
  note?: string
  order: number // 同一視圖內手動排序（細→前）
  completedAt?: string // ISO，done 變 true 嗰刻（統計用）
  updatedAt: string
}

// 子任務（清單項；屬於某條任務）
export interface SubTask extends Entity {
  taskId: string
  text: string
  done: boolean
  order: number
}

// 專案（清單；Things 嘅「Project」/ Todoist 嘅「Project」）
export interface Project extends Entity {
  name: string
  color: string // ProjColor key（見 util）
  emoji?: string
  order: number
  createdAt: string
}

// 任務範本（一鍵展開成一組待辦）
export interface TaskTemplate extends Entity {
  name: string
  emoji?: string
  // 每個 item 變一條任務；可帶優先級 / 相對到期（offset 日）/ 子任務
  items: {
    text: string
    priority?: Priority
    dueOffset?: number // 由今日起 +N 日（選填）
    subtasks?: string[]
  }[]
  createdAt: string
}

// ───────── 視圖內合併後嘅完整任務（記憶體用，唔持久化）─────────
export interface FullTask {
  id: string
  text: string
  done: boolean
  createdAt: string
  meta: TaskMeta
  subtasks: SubTask[]
}
