import { useSyncExternalStore } from 'react'

// ============================================================
//  輕量資料 store（原型用）
//  ------------------------------------------------------------
//  - 每個「集合 (collection)」對應一類資料（班別、課題、題目…）
//  - 自動存落 localStorage；跨元件即時同步（useSyncExternalStore）
//  - 欄位結構刻意同 Supabase 表對齊，將來接雲端直接對得上
// ============================================================

export interface Entity {
  id: string
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export interface Collection<T extends Entity> {
  get: () => T[]
  set: (next: T[]) => void
  add: (data: Omit<T, 'id'> & { id?: string }) => T
  update: (id: string, patch: Partial<T>) => void
  remove: (id: string) => void
  subscribe: (listener: () => void) => () => void
}

/**
 * 全部 createCollection 出嚟嘅 collection 自動登記喺度（key = 去咗 ntk. 前綴
 * 嘅 storage key）。畀雲端同步 / 匯出匯入 / 清除資料統一枚舉 —— 各功能自家喺
 * 自己檔建立嘅 collection 都會自動納入，唔使手動逐個登記。
 */
export const collectionRegistry = new Map<string, Collection<Entity>>()

export function createCollection<T extends Entity>(
  key: string,
  seed: T[] = [],
): Collection<T> {
  const storageKey = `ntk.${key}`

  let items: T[] = load()
  const listeners = new Set<() => void>()

  function load(): T[] {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) return JSON.parse(raw) as T[]
    } catch {
      /* ignore */
    }
    // 第一次：寫入種子資料
    try {
      localStorage.setItem(storageKey, JSON.stringify(seed))
    } catch {
      /* ignore */
    }
    return seed
  }

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items))
    } catch {
      /* ignore */
    }
  }

  function emit() {
    listeners.forEach((l) => l())
  }

  const api: Collection<T> = {
    get: () => items,
    set: (next) => {
      items = next
      persist()
      emit()
    },
    add: (data) => {
      const item = { id: data.id ?? uid(), ...data } as T
      items = [...items, item]
      persist()
      emit()
      return item
    },
    update: (id, patch) => {
      items = items.map((i) => (i.id === id ? { ...i, ...patch } : i))
      persist()
      emit()
    },
    remove: (id) => {
      items = items.filter((i) => i.id !== id)
      persist()
      emit()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  collectionRegistry.set(key, api as unknown as Collection<Entity>)
  return api
}

/** React hook：訂閱一個集合，資料變即時 re-render */
export function useCollection<T extends Entity>(col: Collection<T>): T[] {
  return useSyncExternalStore(col.subscribe, col.get, col.get)
}
