import { createCollection, useCollection, uid } from '../../../../lib/store'
import type { BodyEntry, BodyProfile } from './types'
import { DEFAULT_PROFILE, PROFILE_ID } from './types'

// ============================================================
//  體態數據持久化（自動登記 collectionRegistry → 登入後雲端同步）
//  ------------------------------------------------------------
//  唯一 key（前綴 fitness_）：
//    fitness_body_entries_v1   每日身體組成（一日一條）
//    fitness_body_profile_v1   身高設定（單例）
// ============================================================

export const bodyEntriesCol = createCollection<BodyEntry>('fitness_body_entries_v1')
export const bodyProfileCol = createCollection<BodyProfile>('fitness_body_profile_v1')

export function useBodyEntries(): BodyEntry[] {
  return useCollection(bodyEntriesCol)
}

export function useBodyProfile(): BodyProfile {
  const rows = useCollection(bodyProfileCol)
  return rows[0] ?? DEFAULT_PROFILE
}

/** 設定 / 更新身高（單例 upsert）。 */
export function saveProfile(patch: Partial<Omit<BodyProfile, 'id'>>): void {
  const now = new Date().toISOString()
  const existing = bodyProfileCol.get()[0]
  if (existing) bodyProfileCol.update(existing.id, { ...patch, updatedAt: now })
  else bodyProfileCol.add({ ...DEFAULT_PROFILE, ...patch, id: PROFILE_ID, updatedAt: now })
}

type EntryPatch = Partial<Omit<BodyEntry, 'id' | 'date' | 'createdAt' | 'updatedAt'>>

/**
 * 記錄某日身體組成（按本地日期 key upsert，一日一條）。
 * patch 採 merge 語意：傳 undefined 唔會清除已存值；要清空某欄請明確傳該欄。
 */
export function logBody(date: string, patch: EntryPatch): void {
  const now = new Date().toISOString()
  const existing = bodyEntriesCol.get().find((e) => e.date === date)
  if (existing) {
    bodyEntriesCol.update(existing.id, { ...patch, updatedAt: now })
  } else {
    bodyEntriesCol.add({ id: uid(), date, ...patch, createdAt: now, updatedAt: now })
  }
}

/** 刪除一條記錄。 */
export function removeEntry(id: string): void {
  bodyEntriesCol.remove(id)
}
