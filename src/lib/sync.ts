import { supabase } from './supabase'
import { collectionRegistry } from './store'
import { isCollectionSyncable } from './featureFlags'
import {
  mergeNtkSchoolEvents,
  upgradeNtkCycleCalendarSeed,
  upgradeNtkTimetableSeed,
} from '../data/ntk-seed'
import type { CalendarEvent, CycleCalendarEntry, TimetableSlot } from '../data/types'

// ============================================================
//  雲端同步 (Supabase ⇄ 本地集合)
//  ------------------------------------------------------------
//  - 未登入：完全不郁，照用 localStorage（訪客模式）。
//  - 登入後 attachSync(userId)：
//      1. 一次過由 app_rows 拉全部這個 user 的所有集合。
//      2. 雲端「有」的集合 → 覆蓋本地（cloud 優先）。
//         雲端「沒有」的集合 → 將本地資料 seed 上雲（first-login 自動上傳）。
//      3. 之後監聽每個集合的本地改動 → debounce 寫回上雲 (upsert)。
//  - 登出 detachSync()：停止同步，localStorage 保留做訪客資料。
//
//  衝突策略：以「集合」為單位 last-write-wins。個人用途、
//  最多一兩部裝置，足夠可靠又簡單。
// ============================================================

const PUSH_DEBOUNCE_MS = 800

let attachedUserId: string | null = null
let hydrating = false
const unsubscribers: Array<() => void> = []
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>()

async function pushCollection(userId: string, key: string, data: unknown[]): Promise<void> {
  if (!supabase || attachedUserId !== userId) return
  const { error } = await supabase
    .from('app_rows')
    .upsert(
      { user_id: userId, collection: key, data },
      { onConflict: 'user_id,collection' },
    )
  if (error) console.warn(`[sync] 上傳「${key}」失敗：`, error.message)
}

function schedulePush(userId: string, key: string, getData: () => unknown[]): void {
  const existing = pushTimers.get(key)
  if (existing) clearTimeout(existing)
  pushTimers.set(
    key,
    setTimeout(() => {
      pushTimers.delete(key)
      void pushCollection(userId, key, getData())
    }, PUSH_DEBOUNCE_MS),
  )
}

/** 登入後啟動同步 */
export async function attachSync(userId: string): Promise<void> {
  if (!supabase) return
  if (attachedUserId === userId) return // 已經在同步緊同一個 user
  detachSync() // 清走舊 user 的訂閱／timer

  attachedUserId = userId
  hydrating = true

  // 0) 確保所有 feature collection 都登記齊，先 hydrate / 訂閱；
  //    否則只覆蓋早期登記的核心 collection（feature 資料跨裝置會漏同步，
  //    第一次本地寫入還會反過來覆蓋雲端）。用動態 import 避免 lib→features 靜態循環。
  try {
    const data = await import('../features/preloadData')
    await data.preloadFeatureData()
  } catch {
    /* 預載失敗不阻同步：照用已登記的 collection */
  }
  if (attachedUserId !== userId) return // preload 期間若已登出 / 切 user 就停

  // 1) 一次過拉全部雲端資料（RLS 已保證只會取得到自己的 row）
  const cloud = new Map<string, unknown[]>()
  try {
    const { data, error } = await supabase
      .from('app_rows')
      .select('collection, data')
    if (error) throw error
    for (const row of data ?? []) {
      cloud.set(row.collection as string, (row.data as unknown[]) ?? [])
    }
  } catch (e) {
    console.warn('[sync] 拉雲端資料失敗，暫時繼續用本地：', (e as Error).message)
    attachedUserId = null
    hydrating = false
    return
  }

  // 2) 套用：雲端有 → 覆蓋本地；雲端沒有 → seed 本地上雲
  const migratedCloudCollections = new Map<string, unknown[]>()
  for (const [key, col] of collectionRegistry) {
    // 學生／家長 PII collection 在旗標關閉時不上雲（收費版未過 PDPO 合規）。
    if (!isCollectionSyncable(key)) continue
    if (cloud.has(key)) {
      let incoming = cloud.get(key) ?? []
      if (key === 'timetable') {
        const upgrade = upgradeNtkTimetableSeed(incoming as TimetableSlot[])
        incoming = upgrade.slots
        if (upgrade.migrated) migratedCloudCollections.set(key, incoming)
      } else if (key === 'cycle_calendar') {
        const upgrade = upgradeNtkCycleCalendarSeed(incoming as CycleCalendarEntry[])
        incoming = upgrade.entries
        if (upgrade.migrated) migratedCloudCollections.set(key, incoming)
      } else if (key === 'events') {
        const upgrade = mergeNtkSchoolEvents(incoming as CalendarEvent[])
        incoming = upgrade.events
        if (upgrade.migrated) migratedCloudCollections.set(key, incoming)
      }
      col.set(incoming as never[]) // cloud 優先，舊學年 NTK 校曆資料會先升級
    } else {
      void pushCollection(userId, key, col.get()) // first-login：本地 seed 上雲
    }
  }

  hydrating = false

  for (const [key, data] of migratedCloudCollections) {
    void pushCollection(userId, key, data)
  }

  // 3) 監聽本地改動 → 寫回上雲（hydration 期間不會 push）
  for (const [key, col] of collectionRegistry) {
    if (!isCollectionSyncable(key)) continue
    const unsub = col.subscribe(() => {
      if (hydrating || attachedUserId !== userId) return
      schedulePush(userId, key, col.get)
    })
    unsubscribers.push(unsub)
  }
}

/** 登出 / 切換 user 時停止同步 */
export function detachSync(): void {
  attachedUserId = null
  hydrating = false
  while (unsubscribers.length) unsubscribers.pop()!()
  for (const t of pushTimers.values()) clearTimeout(t)
  pushTimers.clear()
}
