import { useEffect, useState } from 'react'

// ============================================================
//  useLocalStorage
//  ------------------------------------------------------------
//  同 useState 一樣，但會自動將資料存落瀏覽器 (localStorage)，
//  refresh 或者下次開返都仲喺度。示範功能（筆記、待辦）用緊佢。
// ============================================================

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // 容量滿 / 私隱模式 — 靜靜略過
    }
  }, [key, value])

  return [value, setValue] as const
}
