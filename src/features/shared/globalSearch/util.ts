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

// ───────── 搜尋運算子解析（type: / is:pinned / in:recent / sort:recent）─────────
//  Raycast 風 power-user 運算子。全部 additive、大細階無關：
//    type:<kind>  → 限定某類資料（kind 要喺 validTypes 先生效，否則當普通字）
//    is:pinned    → 淨係顯示「釘選」嘅命中（底層實體 pinned = true）
//    in:recent    → 淨係喺「最近更新／建立」嘅嘢入面搵（RECENT_DAYS 內）
//    sort:recent  → 改用「最近」排序（依時間戳）而唔係相關度
//  認唔到嘅運算子（例如 is:foo / sort:bar）一律當普通關鍵字保留，唔報錯。
export interface ParsedQuery {
  text: string // 去除運算子後嘅關鍵字
  typeFilter: string | null // 例如 'note'（對應 SourceKind.id）
  pinnedOnly: boolean // is:pinned
  recentOnly: boolean // in:recent
  sortRecent: boolean // sort:recent
}

// in:recent 嘅「最近」窗口（日）。純資料：方便測試 + UI 顯示一致。
export const RECENT_DAYS = 14

export function parseQuery(raw: string, validTypes: string[]): ParsedQuery {
  let typeFilter: string | null = null
  let pinnedOnly = false
  let recentOnly = false
  let sortRecent = false
  const tokens = raw.split(/\s+/)
  const rest: string[] = []
  for (const tk of tokens) {
    const mType = /^type:(\S+)$/i.exec(tk)
    if (mType && validTypes.includes(mType[1].toLowerCase())) {
      typeFilter = mType[1].toLowerCase()
    } else if (/^is:pinned$/i.test(tk)) {
      pinnedOnly = true
    } else if (/^in:recent$/i.test(tk)) {
      recentOnly = true
    } else if (/^sort:recent$/i.test(tk)) {
      sortRecent = true
    } else {
      rest.push(tk)
    }
  }
  return { text: rest.join(' ').trim(), typeFilter, pinnedOnly, recentOnly, sortRecent }
}

// 有任何運算子生效（除咗淨打關鍵字）→ 用嚟判斷「應唔應該顯示結果區」。
export function hasOperators(p: ParsedQuery): boolean {
  return p.typeFilter !== null || p.pinnedOnly || p.recentOnly || p.sortRecent
}

// ───────── type: 運算子自動完成（輸入框下方輕量 suggestion 列）─────────
//  使用者「正喺度打」最後一個 token 形如 type:<partial> 時，提示匹配嘅 kind。
//  純函式：純粹睇 raw 字串嘅最後一個 token，回相關 kind + 補全後嘅完整 raw。
//  設計取捨：
//    • 只認「最後一個 token」做活躍輸入（貼合一般由右邊打字嘅心智模型）。
//    • partial 大細階無關，用「子字串包含」配 id 或 label（中文 label 都搵到）。
//    • partial 為空（啱啱打完 "type:"）→ 列出全部 kind（畀人揀）。
//    • 已經係完整有效 type:<id>（partial === 某 id）→ 唔再提示（避免冗餘彈層）。
export interface TypeSuggestion {
  id: string // kind id（補入 type: 後面）
  label: string // 顯示用中文標籤
  /** 撳落去後，成個搜尋框應變成嘅 raw 值（補全當前 token 為 type:<id> 並加尾空格） */
  fill: string
}

/**
 * 根據 raw 嘅「最後一個 token」判斷係咪正喺度打 type:，回匹配建議。
 * @param raw        搜尋框原文
 * @param validTypes 所有合法 kind id
 * @param labelOf    kind id → 中文標籤（用嚟顯示 + 比對）
 * @returns          匹配嘅建議陣列；唔係喺度打 type: → 空陣列
 */
export function typeSuggestions(
  raw: string,
  validTypes: string[],
  labelOf: (id: string) => string,
): TypeSuggestion[] {
  // 末端係空白 → 當前 token 已「完成」，唔提示（避免打完空格仍彈層）
  if (raw.length > 0 && /\s$/.test(raw)) return []
  const tokens = raw.split(/\s+/)
  const last = tokens[tokens.length - 1] ?? ''
  const m = /^type:(.*)$/i.exec(last)
  if (!m) return []
  const partial = m[1].toLowerCase()
  // 已經係完整且有效嘅 type:<id> → 唔重複提示
  if (partial && validTypes.includes(partial)) return []
  const prefix = tokens.slice(0, -1).join(' ')
  const head = prefix ? prefix + ' ' : ''
  return validTypes
    .filter((id) => !partial || id.includes(partial) || labelOf(id).toLowerCase().includes(partial))
    .map((id) => ({ id, label: labelOf(id), fill: `${head}type:${id} ` }))
}

// ───────── 運算子套用：過濾（is:pinned / in:recent）+ 排序（sort:recent）─────────
//  收一個極輕量 shape（唔綁死 Hit），方便純函式測試。
//    score：相關度（query 命中分；無 query 時為 0）
//    ts：可排序時間戳（ms epoch）；undefined = 冇時間資訊（例如班別 / 課題）
//    pinned：底層實體係咪釘選
export interface OperableHit {
  score: number
  ts?: number
  pinned?: boolean
}

/**
 * 按已解析運算子過濾 + 排序一批命中。純函式（唔 mutate 入參）。
 *  • is:pinned  → 只留 pinned === true
 *  • in:recent  → 只留 ts 喺 [now - RECENT_DAYS, now] 內（冇 ts 嘅一律隔走）
 *  • sort:recent → 依 ts 由新到舊排（冇 ts 嘅沉底）；否則維持入參次序（交由呼叫方按 score / 字母排）
 * 回傳全新陣列。
 */
export function applyOperators<T extends OperableHit>(
  hits: T[],
  parsed: Pick<ParsedQuery, 'pinnedOnly' | 'recentOnly' | 'sortRecent'>,
  now: number,
): T[] {
  let list = hits
  if (parsed.pinnedOnly) list = list.filter((h) => h.pinned === true)
  if (parsed.recentOnly) {
    const floor = now - RECENT_DAYS * 864e5
    list = list.filter((h) => h.ts != null && h.ts >= floor && h.ts <= now)
  }
  if (parsed.sortRecent) {
    // 穩定排序：依 ts 由新到舊；冇 ts（undefined）視為最舊沉底。
    list = list
      .slice()
      .sort((a, b) => (b.ts ?? -Infinity) - (a.ts ?? -Infinity))
  } else if (list === hits) {
    // 冇做過任何過濾 → 回新陣列避免外部誤改原陣列
    list = hits.slice()
  }
  return list
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
