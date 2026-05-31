import { supabase } from './supabase'
import { ALL_COLLECTIONS } from '../data/collections'

// ============================================================
//  雲端同步 (Supabase ⇄ 本地集合)
//  ------------------------------------------------------------
//  - 未登入：完全唔郁，照用 localStorage（訪客模式）。
//  - 登入後 attachSync(userId)：
//      1. 一次過由 app_rows 拉晒呢個 user 嘅所有集合。
//      2. 雲端「有」嘅集合 → 覆蓋本地（cloud 優先）。
//         雲端「冇」嘅集合 → 將本地資料 seed 上雲（first-login 自動上傳）。
//      3. 之後監聽每個集合嘅本地改動 → debounce 寫返上雲 (upsert)。
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
  if (attachedUserId === userId) return // 已經喺同步緊同一個 user
  detachSync() // 清走舊 user 嘅訂閱／timer

  attachedUserId = userId
  hydrating = true

  // 1) 一次過拉晒雲端資料（RLS 已保證只會攞到自己嘅 row）
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

  // 2) 套用：雲端有 → 覆蓋本地；雲端冇 → seed 本地上雲
  for (const { key, col } of ALL_COLLECTIONS) {
    if (cloud.has(key)) {
      col.set(cloud.get(key) as never[]) // cloud 優先
    } else {
      void pushCollection(userId, key, col.get()) // first-login：本地 seed 上雲
    }
  }

  hydrating = false

  // 3) 監聽本地改動 → 寫返上雲（hydration 期間唔會 push）
  for (const { key, col } of ALL_COLLECTIONS) {
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
