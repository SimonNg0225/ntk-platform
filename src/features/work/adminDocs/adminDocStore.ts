// ============================================================
//  行政文件 — 範本本機 store（重要：唔同步）
//  ------------------------------------------------------------
//  ⚠️ 刻意「唔用 createCollection」：createCollection 會自動登記入
//  collectionRegistry，而 attachSync 會 loop 成個 registry 同步**全部**集合。
//  範本 base64 .docx 體積大，會谷爆 Supabase sync → 故自管 localStorage
//  key + useSyncExternalStore，唔登記入 registry → 唔同步（MVP 本機）。
//  跨裝置留作將來（可選：接 Drive 或專屬表）。
// ============================================================

import { useSyncExternalStore } from 'react'
import { uid } from '../../../lib/store'

export type AdminDocFieldType = 'text' | 'multiline' | 'date'

export interface AdminDocField {
  tag: string
  label: string
  type: AdminDocFieldType
}

export interface AdminDocTemplate {
  id: string
  name: string
  /** 原 .docx 檔內容（base64）；填充時轉返 ArrayBuffer。 */
  base64: string
  fields: AdminDocField[]
  createdAt: string
}

const STORAGE_KEY = 'ntk.admin_doc_templates'

let templates: AdminDocTemplate[] = load()
const listeners = new Set<() => void>()

function load(): AdminDocTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as AdminDocTemplate[]
    }
  } catch {
    /* ignore — 壞資料當空 */
  }
  return []
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  } catch (e) {
    // localStorage 滿 / 配額爆 → 拋出畀 UI 提示（刪舊範本 / 範本太大）。
    throw new Error(
      '儲存失敗：本機儲存空間可能已滿，請刪除舊範本後再試（單個範本不宜過大）。',
    )
  }
}

function emit(): void {
  for (const l of listeners) l()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): AdminDocTemplate[] {
  return templates
}

/** React hook：訂閱範本清單（跨元件即時同步）。 */
export function useAdminDocTemplates(): AdminDocTemplate[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** 新增範本；回傳建立咗嘅範本（已含 id / createdAt）。 */
export function addTemplate(
  data: Omit<AdminDocTemplate, 'id' | 'createdAt'> & {
    id?: string
    createdAt?: string
  },
): AdminDocTemplate {
  const item: AdminDocTemplate = {
    id: data.id ?? uid(),
    name: data.name,
    base64: data.base64,
    fields: data.fields,
    createdAt: data.createdAt ?? new Date().toISOString(),
  }
  templates = [...templates, item]
  persist()
  emit()
  return item
}

/** 更新範本（淺層 patch）。 */
export function updateTemplate(
  id: string,
  patch: Partial<Omit<AdminDocTemplate, 'id'>>,
): void {
  templates = templates.map((t) => (t.id === id ? { ...t, ...patch } : t))
  persist()
  emit()
}

/** 刪除範本。 */
export function removeTemplate(id: string): void {
  templates = templates.filter((t) => t.id !== id)
  persist()
  emit()
}
