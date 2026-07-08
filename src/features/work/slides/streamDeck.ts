// ============================================================
//  串流逐版生成 — incremental slide-object boundary parser
//  ------------------------------------------------------------
//  Gemini 出一個大 JSON `{title,subtitle,coverImageQuery,slides:[{...},...]}`，
//  要邊收 delta 邊抽出「已完整」的 slide object 做樂觀渲染。
//  落地（存 collection）仍以 parseDeck(fullRaw) 為真相 —— 這裡只預覽。
//  純 logic，無網路／DOM，可單測。
// ============================================================

import type { Slide } from '../../../lib/export/types'
import { parseSlideRecord } from './slidePrompts'

/** 容忍未閉合 ```json fence：剝走開頭 fence，但不砍未閉合的尾（中途別斷字）。 */
function stripLeadingFence(buf: string): string {
  // 只處理開頭的 ```json / ``` ；結尾 fence 在最終整段 parse 先理
  return buf.replace(/^﻿?\s*```(?:json)?\s*/i, '')
}

/**
 * 由 fromIndex 起掃描，切出所有「完整」的頂層 `{...}` object。
 * 用括號深度計數器，正確跳過 string literal 內的括號同 `\"` 轉義。
 * 回 { objects, consumed }：consumed = 已消化到的 buffer offset（下次由此續掃）。
 */
export function parseObjectBoundaries(
  buf: string,
  fromIndex: number,
): { objects: string[]; consumed: number } {
  const objects: string[] = []
  let consumed = fromIndex
  let i = fromIndex
  const n = buf.length

  while (i < n) {
    // 搜尋下一個 object 內容來源 '{'
    while (i < n && buf[i] !== '{') i++
    if (i >= n) break
    const start = i
    let depth = 0
    let inStr = false
    let escaped = false
    let closed = false
    for (; i < n; i++) {
      const ch = buf[i]
      if (inStr) {
        if (escaped) {
          escaped = false
        } else if (ch === '\\') {
          escaped = true
        } else if (ch === '"') {
          inStr = false
        }
        continue
      }
      if (ch === '"') {
        inStr = true
        continue
      }
      if (ch === '{') {
        depth++
      } else if (ch === '}') {
        depth--
        if (depth === 0) {
          objects.push(buf.slice(start, i + 1))
          i++
          consumed = i
          closed = true
          break
        }
      }
    }
    if (!closed) {
      // 未閉合：不郁，等下個 chunk（consumed 停在上一個完整 object 之後）
      break
    }
  }

  return { objects, consumed }
}

export interface DeckStreamMeta {
  title?: string
  subtitle?: string
  coverImageQuery?: string
}

export interface DeckStreamParser {
  /** 餵一段 delta；回「本次新確認」的 slides（非累積）+ 首次解到 deck 頭的 meta。 */
  push(chunk: string): { meta?: DeckStreamMeta; slides: Slide[] }
}

/** 在 `"slides"` 之前抓 deck 頭的 title/subtitle/coverImageQuery（只認一次）。 */
function extractMeta(headBuf: string): DeckStreamMeta {
  const meta: DeckStreamMeta = {}
  const grab = (key: string): string | undefined => {
    const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`)
    const m = re.exec(headBuf)
    if (!m) return undefined
    try {
      return JSON.parse(`"${m[1]}"`)
    } catch {
      return m[1]
    }
  }
  const t = grab('title')
  const s = grab('subtitle')
  const c = grab('coverImageQuery')
  if (t) meta.title = t
  if (s) meta.subtitle = s
  if (c) meta.coverImageQuery = c
  return meta
}

/**
 * 砌一個串流 parser：邊收 delta 邊抽出已完整的 slide object。
 */
export function createDeckStreamParser(): DeckStreamParser {
  let buffer = ''
  let metaEmitted = false
  let slidesArrayStart = -1 // `"slides"` 之後 `[` 的 index
  let scanFrom = -1 // object 邊界掃描續掃位

  return {
    push(chunk: string) {
      buffer += chunk
      const cleaned = stripLeadingFence(buffer)
      // stripLeadingFence 可能改變長度；統一用 cleaned 做掃描
      buffer = cleaned

      let meta: DeckStreamMeta | undefined
      const result: Slide[] = []

      // 1) 搜尋 slides 陣列內容來源
      if (slidesArrayStart < 0) {
        const m = /"slides"\s*:\s*\[/.exec(buffer)
        if (m) {
          slidesArrayStart = m.index + m[0].length
          scanFrom = slidesArrayStart
          // deck 頭 = `"slides"` 之前的片段
          if (!metaEmitted) {
            const head = buffer.slice(0, m.index)
            const got = extractMeta(head)
            if (Object.keys(got).length > 0) {
              meta = got
              metaEmitted = true
            }
          }
        } else if (!metaEmitted) {
          // 尚未見 slides，但 deck 頭可能已齊 → 試抽
          const got = extractMeta(buffer)
          if (got.title) {
            meta = got
            metaEmitted = true
          }
        }
      }

      // 2) 由 scanFrom 續掃 object 邊界
      if (slidesArrayStart >= 0) {
        const { objects, consumed } = parseObjectBoundaries(buffer, scanFrom)
        scanFrom = consumed
        for (const raw of objects) {
          let obj: unknown
          try {
            obj = JSON.parse(raw)
          } catch {
            continue // 切了但 parse 不到（理論上不應發生）→ 跳過
          }
          if (!obj || typeof obj !== 'object') continue
          const slide = parseSlideRecord(obj as Record<string, unknown>)
          if (slide) result.push(slide)
        }
      }

      return { meta, slides: result }
    },
  }
}
