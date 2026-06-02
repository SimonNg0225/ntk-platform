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

/**
 * 淺層去走「值為 undefined」嘅 key，回傳新物件（唔改原物件）。
 * 只去 undefined —— null / 0 / '' / false 等 falsy 值一律保留。
 *
 * 寫入 collection 前用：清走 optional 欄位嘅顯式 undefined（常見寫法
 * `field: value || undefined`）。否則 in-memory item 會帶住 `key: undefined`，
 * 但 persist（JSON.stringify）會 drop 咗，造成 reload 前後 shape 唔一致
 * （用 Object.keys / exactOptionalPropertyTypes 式 narrowing 嘅 consumer 行為不定）。
 * add / update 內部已自動套用，各 collection 一致，毋須各 call site 自行清。
 */
export function stripUndefined<T extends object>(obj: T): T {
  const out: Partial<T> = {}
  for (const key of Object.keys(obj) as (keyof T)[]) {
    const v = obj[key]
    if (v !== undefined) out[key] = v
  }
  return out as T
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
      // 剷走 optional 欄位嘅顯式 undefined（見 stripUndefined）：保持 in-memory
      // 同 persist 後 reload 嘅 shape 一致。id 必有值，唔會被剷。
      const item = stripUndefined({ id: data.id ?? uid(), ...data }) as T
      items = [...items, item]
      persist()
      emit()
      return item
    },
    update: (id, patch) => {
      items = items.map((i) => {
        if (i.id !== id) return i
        // merge；patch 內明確設為 undefined 嘅欄位 = 「清除」→ 真正剷走個 key
        // （而唔係留 key:undefined），令 in-memory 同 persist 後 reload shape 一致。
        // patch 無提及嘅 key 一律保留（維持原有 merge 語義）。
        const merged = { ...i, ...patch }
        const rec = merged as unknown as Record<string, unknown>
        for (const k of Object.keys(patch)) {
          if (rec[k] === undefined) delete rec[k]
        }
        return merged
      })
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
