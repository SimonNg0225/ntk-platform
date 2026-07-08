import { createCollection } from '../../lib/store'
import type { Entity } from '../../lib/store'

// ============================================================
//  指令面板（⌘K）— 最近開啟功能（個人化）
//  ------------------------------------------------------------
//  指令面板原本只按註冊次序列項目，無個人化。這裡同全域搜尋
//  （globalSearch/util.ts 的 recentsCol / pushRecent）一致：記低最近
//  開過邊幾個功能，未輸入關鍵字時在最頂顯示一區「最近使用」。
//
//  設計：純函式核心（dedupe / 置頂 / 限量 / 解析返可跳轉項）同
//  localStorage 持久化分離 —— 純函式零 side effect、零 Date、零
//  localStorage，方便單元測試（同 applyOperators / parseQuery 一致）。
// ============================================================

// ───────── 持久化：最近開啟的功能 id ─────────
export interface RecentFeature extends Entity {
  /** 功能 id（= FEATURES[i].id，亦可以係特殊鍵如 'home'）；同時做 collection id */
  featureId: string
  /** 最後開啟時間戳（ms epoch；排序 + 去舊用） */
  at: number
}

export const recentFeaturesCol = createCollection<RecentFeature>(
  'commandpalette.recentfeatures',
  [],
)

// 顯示上限（同全域搜尋「最近搜尋」風格一致，取 6 個）。
export const MAX_RECENT_FEATURES = 6

/**
 * 計算「記低一次開啟」之後的新清單（純函式，不掂 collection / Date）。
 *  • 去重（同一 featureId 只留一條）
 *  • 置頂（最新開那個排第一）
 *  • 限量（最多 MAX_RECENT_FEATURES）
 * 回傳全新陣列（不 mutate 入參）。空 / 空白 featureId 直接原樣回（不記）。
 */
export function computeRecentFeatures(
  prev: RecentFeature[],
  featureId: string,
  now: number,
  max = MAX_RECENT_FEATURES,
): RecentFeature[] {
  const id = featureId.trim()
  if (!id) return prev.slice()
  const rest = prev.filter((r) => r.featureId !== id)
  return [{ id, featureId: id, at: now }, ...rest].slice(0, Math.max(0, max))
}

/** 記低一次開啟（去重、置頂、限量）。寫 collection + 用 Date.now（薄 wrapper）。 */
export function pushRecentFeature(featureId: string): void {
  const id = featureId.trim()
  if (!id) return
  recentFeaturesCol.set(
    computeRecentFeatures(recentFeaturesCol.get(), id, Date.now()),
  )
}

export function clearRecentFeatures(): void {
  recentFeaturesCol.set([])
}

// ───────── 解析返可跳轉項（過濾已不正確的）─────────
//  指令面板的可跳轉項按目前模式決定（功能會切換、會新增 / 移除）。記低的
//  featureId 可能：已不在目前模式、已被移除。這裡按「目前有效項目」過濾，
//  令最近使用永遠只顯示現在按得到的嘢（同全域搜尋 isPinned 按現況解析一致）。

/** 一個指令面板可跳轉項目所需的最小 shape（同 CommandPalette 內 Item 對齊）。 */
export interface ResolvableItem {
  id: string
}

/**
 * 把「最近開啟記錄」對應返「目前有效項目」，保留 recents 的時間次序，
 * 並隔走已不存在 / 不屬目前模式的項目。純函式。
 *  @param recents   recentFeaturesCol 內容（已按 at 由新到舊；本函式不再排）
 *  @param available 目前模式下所有可跳轉項目（id 對齊 RecentFeature.featureId）
 *  @param limit     最多回幾多項
 * 回傳 available 中對應的項目（同一參照），按 recents 次序排，去重，限量。
 */
export function resolveRecentItems<T extends ResolvableItem>(
  recents: RecentFeature[],
  available: T[],
  limit = MAX_RECENT_FEATURES,
): T[] {
  const byId = new Map(available.map((it) => [it.id, it]))
  const out: T[] = []
  const seen = new Set<string>()
  for (const r of recents) {
    if (seen.has(r.featureId)) continue
    const it = byId.get(r.featureId)
    if (it) {
      out.push(it)
      seen.add(r.featureId)
      if (out.length >= limit) break
    }
  }
  return out
}
