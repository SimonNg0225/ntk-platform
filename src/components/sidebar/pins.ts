import { createCollection, type Entity } from '../../lib/store'

// ============================================================
//  側邊欄「釘選」功能（個人化）
//  ------------------------------------------------------------
//  同「最近使用」（commandPalette/util 嘅 recentFeaturesCol）一套機制：
//  記低用戶釘起嘅功能 id，喺側邊欄頂「已釘選 · 最近」一區長期顯示，
//  毋須每次碌成條長 list。純 localStorage 持久化、跨元件即時同步。
//
//  排序：按釘選次序（at 由細到大 = 先釘嘅排前），唔會跳動。
// ============================================================

export interface PinnedFeature extends Entity {
  /** 功能 id（= FEATURES[i].id）；同時做 collection id */
  featureId: string
  /** 釘選時間戳（ms epoch；穩定排序用） */
  at: number
}

export const pinnedFeaturesCol = createCollection<PinnedFeature>(
  'sidebar.pinnedfeatures',
  [],
)

/** 某功能而家釘咗未。 */
export function isPinned(featureId: string): boolean {
  return pinnedFeaturesCol.get().some((p) => p.featureId === featureId)
}

/**
 * 釘 / 取消釘（toggle）。寫 collection + 用 Date.now（薄 wrapper）。
 * 已釘 → 移除；未釘 → append 喺最後（保持先釘先排嘅穩定次序）。
 */
export function togglePin(featureId: string): void {
  const id = featureId.trim()
  if (!id) return
  const cur = pinnedFeaturesCol.get()
  if (cur.some((p) => p.featureId === id)) {
    pinnedFeaturesCol.set(cur.filter((p) => p.featureId !== id))
  } else {
    pinnedFeaturesCol.set([...cur, { id, featureId: id, at: Date.now() }])
  }
}
