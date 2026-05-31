import { createCollection } from '../../../lib/store'
import type { Entity } from '../../../lib/store'

// ============================================================
//  全域搜尋核心：模糊比對、評分、高亮、最近 / 釘選持久化
//  純函式 + 自家 collection（零新 npm，唔掂任何共用檔）
// ============================================================

// ───────── 持久化：最近搜尋 + 釘選關鍵字 ─────────
export interface RecentSearch extends Entity {
  q: string
  at: number // timestamp（用嚟排序 + 去舊）
}
export interface PinnedSearch extends Entity {
  q: string
  createdAt: number
}

export const recentsCol = createCollection<RecentSearch>('globalsearch.recents', [])
export const pinsCol = createCollection<PinnedSearch>('globalsearch.pins', [])

const MAX_RECENTS = 12

/** 記低一次搜尋（去重、置頂、限量） */
export function pushRecent(raw: string): void {
  const q = raw.trim()
  if (q.length < 2) return
  const lower = q.toLowerCase()
  const prev = recentsCol.get().filter((r) => r.q.toLowerCase() !== lower)
  const next: RecentSearch[] = [
    { id: lower, q, at: Date.now() },
    ...prev,
  ].slice(0, MAX_RECENTS)
  recentsCol.set(next)
}

export function clearRecents(): void {
  recentsCol.set([])
}

export function removeRecent(id: string): void {
  recentsCol.remove(id)
}

export function togglePin(raw: string): void {
  const q = raw.trim()
  if (!q) return
  const lower = q.toLowerCase()
  const existing = pinsCol.get().find((p) => p.q.toLowerCase() === lower)
  if (existing) pinsCol.remove(existing.id)
  else pinsCol.add({ id: lower, q, createdAt: Date.now() })
}

export function isPinned(raw: string, pins: PinnedSearch[]): boolean {
  const lower = raw.trim().toLowerCase()
  return pins.some((p) => p.q.toLowerCase() === lower)
}

// ───────── 模糊比對（子序列 + 連續加分；Raycast / VSCode 風）─────────
export interface MatchResult {
  score: number
  // 命中字元喺原字串嘅 index（用嚟高亮）
  indices: number[]
}

/**
 * 喺 text 入面搵 query 嘅子序列。
 * 計分：連續命中、字頭（詞首 / camelCase）、越前命中分越高。
 * 回傳 null = 唔匹配。
 */
export function fuzzyMatch(text: string, query: string): MatchResult | null {
  if (!query) return { score: 0, indices: [] }
  const t = text.toLowerCase()
  const q = query.toLowerCase()

  // 快路：直接子字串命中 → 高分（連續最理想）
  const sub = t.indexOf(q)
  if (sub !== -1) {
    const indices = Array.from({ length: q.length }, (_, i) => sub + i)
    let score = 1000 + q.length * 6 // 連續命中大獎
    if (sub === 0) score += 120 // 完全字頭
    else if (isBoundary(t, sub)) score += 70 // 詞首
    score -= Math.min(sub, 40) // 越前越好
    return { score, indices }
  }

  // 子序列比對
  const indices: number[] = []
  let ti = 0
  let streak = 0
  let score = 0
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]
    let found = -1
    while (ti < t.length) {
      if (t[ti] === ch) {
        found = ti
        break
      }
      ti++
    }
    if (found === -1) return null // 有字元搵唔到 → 唔匹配
    indices.push(found)
    // 連續命中 → streak 加分
    if (found > 0 && indices[qi - 1] === found - 1) {
      streak += 1
      score += 14 + streak * 6
    } else {
      streak = 0
      score += 4
    }
    if (found === 0 || isBoundary(t, found)) score += 22 // 詞首命中
    score -= Math.min(found, 30) * 0.15 // 整體靠前獎勵
    ti = found + 1
  }
  // 命中比例（query 越長、命中越密 → 越高）
  score += (q.length / Math.max(t.length, 1)) * 40
  return { score: Math.round(score), indices }
}

function isBoundary(text: string, i: number): boolean {
  if (i <= 0) return true
  const prev = text[i - 1]
  return prev === ' ' || prev === '-' || prev === '_' || prev === '/' || prev === '·' || prev === '，' || prev === '、' || prev === '\n'
}

// ───────── 高亮分段（把命中 index 切成 {text, hit} 段）─────────
export interface Segment {
  text: string
  hit: boolean
}
export function highlightSegments(text: string, indices: number[]): Segment[] {
  if (indices.length === 0) return [{ text, hit: false }]
  const set = new Set(indices)
  const out: Segment[] = []
  let buf = ''
  let curHit = set.has(0)
  for (let i = 0; i < text.length; i++) {
    const hit = set.has(i)
    if (hit === curHit) {
      buf += text[i]
    } else {
      if (buf) out.push({ text: buf, hit: curHit })
      buf = text[i]
      curHit = hit
    }
  }
  if (buf) out.push({ text: buf, hit: curHit })
  return out
}

// ───────── 命中片段（圍住第一個命中 index 取窗）─────────
//  關鍵：保持「長度 1:1」（換行 / tab → 空格），令高亮 index 可精準映射。
//  回傳 offset：snippet 內某字元 i 對應原文 index = i + offset（已計埋前綴「…」）。
export function snippetAround(
  text: string,
  indices: number[],
  pad = 36,
): { text: string; offset: number } {
  // 逐字元換成空格（唔用 + 合併連續空白），確保長度 1:1，令高亮 index 精準映射
  const flatten = (s: string) => s.replace(/[\n\r\t]/g, ' ')
  if (indices.length === 0) {
    const cut = flatten(text.slice(0, pad * 2))
    return { text: cut + (text.length > pad * 2 ? '…' : ''), offset: 0 }
  }
  const first = indices[0]
  const last = indices[indices.length - 1]
  const start = Math.max(0, first - pad)
  const end = Math.min(text.length, last + pad)
  const prefix = start > 0 ? '…' : ''
  const body = flatten(text.slice(start, end)) // 1:1 長度
  const suffix = end < text.length ? '…' : ''
  // body 內 index j 對應原文 start + j；加咗前綴「…」後再 +prefix.length
  return { text: `${prefix}${body}${suffix}`, offset: start - prefix.length }
}

// ───────── 搜尋運算子解析（type: / is:）─────────
export interface ParsedQuery {
  text: string // 去除運算子後嘅關鍵字
  typeFilter: string | null // 例如 'note'（對應 SourceKind.id）
}
export function parseQuery(raw: string, validTypes: string[]): ParsedQuery {
  let typeFilter: string | null = null
  const tokens = raw.split(/\s+/)
  const rest: string[] = []
  for (const tk of tokens) {
    const m = /^type:(\S+)$/i.exec(tk)
    if (m && validTypes.includes(m[1].toLowerCase())) {
      typeFilter = m[1].toLowerCase()
    } else {
      rest.push(tk)
    }
  }
  return { text: rest.join(' ').trim(), typeFilter }
}

// ───────── 時間標籤（相對） ─────────
export function relativeTime(iso?: string): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const diff = Date.now() - t
  const day = 864e5
  if (diff < 6e4) return '啱啱'
  if (diff < 36e5) return `${Math.floor(diff / 6e4)} 分鐘前`
  if (diff < day) return `${Math.floor(diff / 36e5)} 小時前`
  if (diff < 7 * day) return `${Math.floor(diff / day)} 日前`
  const d = new Date(t)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}
