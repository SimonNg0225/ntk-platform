// ============================================================
//  Inbox meta store（功能專屬持久化）
//  ------------------------------------------------------------
//  並行於共用 inboxCol 嘅 meta 集合。key = InboxItem.id。
//  唔郁 data/collections.ts；新 collection 喺 newCollections 申報。
// ============================================================

import { createCollection } from '../../../lib/store'
import type { InboxMeta, InboxKind, InboxStatus } from './types'

/** InboxItem.id → InboxMeta（並行 meta）*/
export const inboxMetaCol = createCollection<InboxMeta>('inbox_meta_v2', [])

/** 攞某 item 嘅 meta（冇就回 undefined）*/
export function getMeta(id: string): InboxMeta | undefined {
  return inboxMetaCol.get().find((m) => m.id === id)
}

/** upsert：有就 update，冇就 add（id 與 InboxItem 對齊）*/
export function patchMeta(id: string, patch: Partial<Omit<InboxMeta, 'id'>>): void {
  const existing = inboxMetaCol.get().find((m) => m.id === id)
  if (existing) inboxMetaCol.update(id, patch)
  else inboxMetaCol.add({ id, status: 'inbox', ...patch })
}

/** 設定／清除分類 */
export function setKind(id: string, kind: InboxKind | undefined): void {
  patchMeta(id, { kind })
}

/** 置頂切換 */
export function togglePinned(id: string, current: boolean): void {
  patchMeta(id, { pinned: !current })
}

/** 歸檔（轉換成功後 / 人手歸檔）*/
export function archive(id: string, convertedTo?: InboxKind): void {
  patchMeta(id, {
    status: 'archived',
    archivedAt: new Date().toISOString(),
    ...(convertedTo
      ? { convertedTo, convertedAt: new Date().toISOString() }
      : {}),
  })
}

/** 還原（archived → inbox）*/
export function restore(id: string): void {
  patchMeta(id, { status: 'inbox', archivedAt: undefined, convertedTo: undefined })
}

/** 設定狀態（批量用）*/
export function setStatus(id: string, status: InboxStatus): void {
  if (status === 'archived') archive(id)
  else restore(id)
}

/** 記低 AI 建議 */
export function setAiSuggestion(id: string, kind: InboxKind, reason?: string): void {
  patchMeta(id, { aiKind: kind, aiReason: reason })
}

/** item 被刪除時，順手清走孤兒 meta */
export function dropMeta(id: string): void {
  if (inboxMetaCol.get().some((m) => m.id === id)) inboxMetaCol.remove(id)
}
