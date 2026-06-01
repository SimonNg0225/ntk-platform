import type { Notebook, RichNote } from './store'

// ============================================================
//  Notes 工具：解析（標籤 / 待辦 / 摘要）、統計、圖表資料
// ============================================================

// ───────── #hashtag 解析（去重、保留次序）─────────
export function parseTags(content: string): string[] {
  const matches = content.match(/#[\p{L}\p{N}_-]+/gu) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of matches) {
    const tag = m.slice(1)
    const key = tag.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      out.push(tag)
    }
  }
  return out
}

// ───────── - [ ] / - [x] 待辦行 ─────────
export interface ChecklistStat {
  total: number
  done: number
}
const CHECK_RE = /^\s*[-*]\s\[( |x|X)\]\s/
export function checklistStat(content: string): ChecklistStat {
  let total = 0
  let done = 0
  for (const line of content.split('\n')) {
    const m = line.match(CHECK_RE)
    if (m) {
      total += 1
      if (m[1] !== ' ') done += 1
    }
  }
  return { total, done }
}

// 把內文每行解析成結構（一般 / 待辦），供編輯器即時渲染
export type ParsedLine =
  | { kind: 'text'; text: string }
  | { kind: 'todo'; text: string; done: boolean; lineIndex: number }
export function parseLines(content: string): ParsedLine[] {
  return content.split('\n').map((line, i) => {
    const m = line.match(CHECK_RE)
    if (m) {
      return {
        kind: 'todo',
        text: line.replace(CHECK_RE, ''),
        done: m[1] !== ' ',
        lineIndex: i,
      }
    }
    return { kind: 'text', text: line }
  })
}

// 切換第 lineIndex 行待辦狀態，回傳新內文（保留其餘行）
export function toggleTodoLine(content: string, lineIndex: number): string {
  const lines = content.split('\n')
  const line = lines[lineIndex]
  if (line === undefined) return content
  lines[lineIndex] = line.replace(/\[( |x|X)\]/, (_m, c) =>
    c === ' ' ? '[x]' : '[ ]',
  )
  return lines.join('\n')
}

// ───────── 標題 / 摘要推導 ─────────
const STRIP_RE = /[#*`>_-]/g
export function deriveTitle(note: Pick<RichNote, 'title' | 'content'>): string {
  if (note.title.trim()) return note.title.trim()
  const firstLine = note.content.split('\n').find((l) => l.trim()) ?? ''
  const clean = firstLine.replace(CHECK_RE, '').replace(STRIP_RE, '').trim()
  return clean || '未命名筆記'
}

export function snippet(content: string, max = 120): string {
  // 跳過首行（已用作標題）+ 標籤行噪音，取餘下純文字
  const lines = content.split('\n')
  const rest = lines
    .slice(1)
    .map((l) => l.replace(CHECK_RE, '☐ ').replace(/#[\p{L}\p{N}_-]+/gu, '').trim())
    .filter(Boolean)
    .join(' ')
  const base = rest || lines[0]?.replace(/#[\p{L}\p{N}_-]+/gu, '').trim() || ''
  return base.length > max ? base.slice(0, max).trimEnd() + '…' : base
}

// ───────── 字數 / 閱讀時間 ─────────
export function wordCount(content: string): number {
  // 中英混合：CJK 逐字 + 拉丁字以空白分詞
  const cjk = (content.match(/[一-鿿぀-ヿ]/g) ?? []).length
  const latin = (content.match(/[A-Za-z0-9]+/g) ?? []).length
  return cjk + latin
}
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 250))
}

// ───────── 時間標籤 ─────────
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.floor((Date.now() - then) / 1000)
  if (diff < 60) return '剛剛'
  const min = Math.floor(diff / 60)
  if (min < 60) return `${min} 分鐘前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小時前`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} 天前`
  return new Date(iso).toLocaleDateString('zh-HK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
export function fullDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
function dayKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ───────── 排序 ─────────
export type SortKey = 'updated' | 'created' | 'title' | 'words'
export function compareNotes(a: RichNote, b: RichNote, key: SortKey): number {
  // 釘選永遠喺前（主列表）
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  switch (key) {
    case 'created':
      if (a.createdAt === b.createdAt) return 0
      return a.createdAt < b.createdAt ? 1 : -1
    case 'title':
      return deriveTitle(a).localeCompare(deriveTitle(b), 'zh-HK')
    case 'words':
      return wordCount(b.content) - wordCount(a.content)
    case 'updated':
    default:
      if (a.updatedAt === b.updatedAt) return 0
      return a.updatedAt < b.updatedAt ? 1 : -1
  }
}

// ───────── 全部標籤統計（用量排序）─────────
export interface TagCount {
  tag: string
  count: number
}
export function tagCounts(notes: RichNote[]): TagCount[] {
  const map = new Map<string, TagCount>()
  for (const n of notes) {
    for (const tag of parseTags(n.content)) {
      const key = tag.toLowerCase()
      const e = map.get(key)
      if (e) e.count += 1
      else map.set(key, { tag, count: 1 })
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}

// ============================================================
//  統計圖表資料
// ============================================================

export interface NotesStats {
  total: number // 活躍（非封存非垃圾）
  pinned: number
  favorite: number
  archived: number
  trashed: number
  totalWords: number
  avgWords: number
  todoTotal: number
  todoDone: number
  tagCount: number
  activeDays: number // 過去 30 日有新增/更新嘅日數
  last7: number // 過去 7 日新增
  prev7: number // 之前 7 日新增（趨勢比較）
  topTags: TagCount[]
  daily: { key: string; label: string; count: number }[] // 過去 30 日逐日新增
  notebookDist: { id: string; count: number }[]
}

export function computeStats(active: RichNote[], all: RichNote[]): NotesStats {
  const totalWords = active.reduce((s, n) => s + wordCount(n.content), 0)
  let todoTotal = 0
  let todoDone = 0
  for (const n of active) {
    const c = checklistStat(n.content)
    todoTotal += c.total
    todoDone += c.done
  }
  const now = Date.now()
  const dayMs = 86_400_000
  const last7 = active.filter(
    (n) => now - new Date(n.createdAt).getTime() < 7 * dayMs,
  ).length
  const prev7 = active.filter((n) => {
    const age = now - new Date(n.createdAt).getTime()
    return age >= 7 * dayMs && age < 14 * dayMs
  }).length

  // 過去 30 日逐日新增
  const counts = new Map<string, number>()
  for (const n of active) {
    const k = dayKey(n.createdAt)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const daily: NotesStats['daily'] = []
  const activeKeys = new Set<string>()
  for (const n of active) {
    activeKeys.add(dayKey(n.createdAt))
    activeKeys.add(dayKey(n.updatedAt))
  }
  let activeDays = 0
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * dayMs)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const k = `${y}-${m}-${day}`
    if (activeKeys.has(k)) activeDays += 1
    daily.push({
      key: k,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      count: counts.get(k) ?? 0,
    })
  }

  const nbMap = new Map<string, number>()
  for (const n of active) {
    const id = n.notebookId ?? '__none__'
    nbMap.set(id, (nbMap.get(id) ?? 0) + 1)
  }

  const allTags = tagCounts(active)

  return {
    total: active.length,
    pinned: active.filter((n) => n.pinned).length,
    favorite: active.filter((n) => n.favorite).length,
    archived: all.filter((n) => n.archived && !n.trashed).length,
    trashed: all.filter((n) => n.trashed).length,
    totalWords,
    avgWords: active.length ? Math.round(totalWords / active.length) : 0,
    todoTotal,
    todoDone,
    tagCount: allTags.length,
    activeDays,
    last7,
    prev7,
    topTags: allTags.slice(0, 8),
    daily,
    notebookDist: [...nbMap.entries()].map(([id, count]) => ({ id, count })),
  }
}

// ───────── 匯出（Markdown / JSON）─────────
export function noteToMarkdown(n: RichNote): string {
  const title = deriveTitle(n)
  const date = new Date(n.createdAt).toLocaleDateString('zh-HK')
  const body = n.title.trim() ? n.content : n.content // 內文已含首行
  return `# ${title}\n\n_${date}_\n\n${body}\n`
}
export function notesToMarkdown(notes: RichNote[]): string {
  return notes.map(noteToMarkdown).join('\n\n---\n\n')
}
export function download(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ───────── 全量 JSON 備份 / 還原（含筆記本／釘選／色標／時間）─────────
export interface NotesBackup {
  version: number
  exportedAt: string
  notes: RichNote[]
  notebooks: Notebook[]
}

const NOTES_BACKUP_VERSION = 1

/** 把筆記 + 筆記本打包成可完整還原嘅 JSON（pretty） */
export function exportNotesJson(notes: RichNote[], notebooks: Notebook[]): string {
  const payload: NotesBackup = {
    version: NOTES_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    notes,
    notebooks,
  }
  return JSON.stringify(payload, null, 2)
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}
function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}
function asIso(v: unknown): string {
  return typeof v === 'string' && v ? v : new Date().toISOString()
}

function normalizeNote(d: Record<string, unknown>): RichNote {
  return {
    id: asString(d.id) || genId(),
    title: asString(d.title),
    content: asString(d.content),
    notebookId: typeof d.notebookId === 'string' ? d.notebookId : null,
    pinned: d.pinned === true,
    favorite: d.favorite === true,
    archived: d.archived === true,
    trashed: d.trashed === true,
    color: asString(d.color, 'none') || 'none',
    createdAt: asIso(d.createdAt),
    updatedAt: asIso(d.updatedAt),
  }
}

function normalizeNotebook(d: Record<string, unknown>): Notebook {
  return {
    id: asString(d.id) || genId(),
    name: asString(d.name) || '未命名筆記本',
    color: asString(d.color, 'slate') || 'slate',
    createdAt: asIso(d.createdAt),
  }
}

/**
 * 寬鬆解析匯入的備份 JSON（仿 reading/util.ts parseImport）。
 * 容忍舊格式 / 缺欄位：逐欄補預設（false / 空字串 / now ISO），
 * 非陣列欄位過濾成空陣列。完全唔似備份（無 notes 又無 notebooks 陣列）→ null。
 */
export function parseNotesImport(
  raw: string,
): { notes: RichNote[]; notebooks: Notebook[] } | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    const rawNotes = Array.isArray(data.notes) ? data.notes : null
    const rawNotebooks = Array.isArray(data.notebooks) ? data.notebooks : null
    // 至少要有一個係陣列，先當係有效備份（避免接受任意物件）
    if (!rawNotes && !rawNotebooks) return null
    return {
      notes: (rawNotes ?? []).map((n) => normalizeNote(n as Record<string, unknown>)),
      notebooks: (rawNotebooks ?? []).map((n) =>
        normalizeNotebook(n as Record<string, unknown>),
      ),
    }
  } catch {
    return null
  }
}
