import { createCollection } from '../../../lib/store'
import type { Resource, ResourceType } from '../../../data/types'

// ============================================================
//  教學資源庫（Raindrop.io 級書籤 / 教材管理）— 功能專屬資料 + 工具
//  ------------------------------------------------------------
//  共用 resourcesCol / Resource 型別「不可改」。凡係要「加落資源」嘅
//  豐富屬性（收藏、封存、評分、所屬收藏夾、開啟次數、最後開啟…）一律
//  存喺本功能自家擴充表 resource_meta（key = Resource.id）。
//  收藏夾（folders / collections）同開啟歷史亦各自獨立 collection。
//  唯一 key（已喺 newCollections 申報）：
//    resourceLib_meta / resourceLib_collections / resourceLib_open_log
// ============================================================

// ───────── 類型標籤 / 圖示 key（圖示喺元件度對應 lucide）─────────
export const TYPE_LABEL: Record<ResourceType, string> = {
  handout: '講義',
  slides: '簡報',
  paper: '試題',
  link: '連結',
  video: '影片',
  note: '筆記',
}
export const TYPE_ORDER: ResourceType[] = [
  'handout',
  'slides',
  'paper',
  'link',
  'video',
  'note',
]

// 每個類型一隻色（畀 badge / 圖表 / 圓點 用，全部有 dark）
export interface TypeColor {
  dot: string
  chipBg: string
  chipText: string
  bar: string // 圖表填色
  iconWrap: string
}
export const TYPE_COLOR: Record<ResourceType, TypeColor> = {
  handout: {
    dot: 'bg-accent',
    chipBg: 'bg-accent-soft dark:bg-accent/15',
    chipText: 'text-accent-strong dark:text-accent',
    bar: 'bg-accent',
    iconWrap: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
  },
  slides: {
    dot: 'bg-violet-500',
    chipBg: 'bg-violet-50 dark:bg-violet-500/10',
    chipText: 'text-violet-700 dark:text-violet-300',
    bar: 'bg-violet-500',
    iconWrap: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  },
  paper: {
    dot: 'bg-rose-500',
    chipBg: 'bg-rose-50 dark:bg-rose-500/10',
    chipText: 'text-rose-700 dark:text-rose-300',
    bar: 'bg-rose-500',
    iconWrap: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
  },
  link: {
    dot: 'bg-blue-500',
    chipBg: 'bg-blue-50 dark:bg-blue-500/10',
    chipText: 'text-blue-700 dark:text-blue-300',
    bar: 'bg-blue-500',
    iconWrap: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300',
  },
  video: {
    dot: 'bg-amber-500',
    chipBg: 'bg-amber-50 dark:bg-amber-500/10',
    chipText: 'text-amber-700 dark:text-amber-300',
    bar: 'bg-amber-500',
    iconWrap: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  },
  note: {
    dot: 'bg-emerald-500',
    chipBg: 'bg-emerald-50 dark:bg-emerald-500/10',
    chipText: 'text-emerald-700 dark:text-emerald-300',
    bar: 'bg-emerald-500',
    iconWrap: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
}

// ───────── 收藏夾色系（同行事曆風格一致，全 dark）─────────
export interface FolderColor {
  dot: string
  soft: string // 背景柔色 + 文字
  ring: string
}
export const FOLDER_COLORS: Record<string, FolderColor> = {
  slate: {
    dot: 'bg-slate-400',
    soft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    ring: 'ring-slate-300 dark:ring-slate-600',
  },
  accent: {
    dot: 'bg-accent',
    soft: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
    ring: 'ring-accent/40',
  },
  blue: {
    dot: 'bg-blue-500',
    soft: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
    ring: 'ring-blue-400/50',
  },
  green: {
    dot: 'bg-emerald-500',
    soft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    ring: 'ring-emerald-400/50',
  },
  amber: {
    dot: 'bg-amber-500',
    soft: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    ring: 'ring-amber-400/50',
  },
  rose: {
    dot: 'bg-rose-500',
    soft: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
    ring: 'ring-rose-400/50',
  },
  violet: {
    dot: 'bg-violet-500',
    soft: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300',
    ring: 'ring-violet-400/50',
  },
  cyan: {
    dot: 'bg-cyan-500',
    soft: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300',
    ring: 'ring-cyan-400/50',
  },
}
export const FOLDER_COLOR_KEYS = Object.keys(FOLDER_COLORS)
export function folderColor(key: string | undefined): FolderColor {
  return FOLDER_COLORS[key ?? 'slate'] ?? FOLDER_COLORS.slate
}

// ============================================================
//  功能專屬型別
// ============================================================

/** 資源擴充中繼（id === Resource.id，唔使另一層對照） */
export interface ResourceMeta {
  id: string // == Resource.id
  favorite: boolean // 收藏（星）
  archived: boolean // 封存（唔出現喺主清單）
  broken: boolean // 連結已失效（手動標記）
  folderId?: string // 所屬收藏夾
  rating?: number // 0–5 星評分（0 = 未評）
  opens: number // 累計開啟次數
  lastOpened?: string // ISO，最後開啟
  updatedAt: string
}

/** 收藏夾（folder / collection，類似 Raindrop） */
export interface ResourceFolder {
  id: string
  name: string
  color: string // FOLDER_COLORS key
  order: number
  createdAt: string
}

/** 開啟歷史（每次開連結寫一條，係使用分析核心） */
export interface OpenLog {
  id: string
  resourceId: string
  ts: string // ISO
}

// ───────── Collections（自家 key，自動存 localStorage）─────────
export const resourceMetaCol = createCollection<ResourceMeta>(
  'resourceLib_meta',
  [],
)
export const resourceFoldersCol = createCollection<ResourceFolder>(
  'resourceLib_collections',
  [
    {
      id: 'folder-core',
      name: '核心教材',
      color: 'accent',
      order: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'folder-dse',
      name: 'DSE 操卷',
      color: 'rose',
      order: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'folder-video',
      name: '影片 / 動畫',
      color: 'amber',
      order: 2,
      createdAt: new Date().toISOString(),
    },
  ],
)
export const resourceOpenLogCol = createCollection<OpenLog>(
  'resourceLib_open_log',
  [],
)

// ───────── meta upsert（以 resourceId 做 id）─────────
export const emptyMeta = (id: string): ResourceMeta => ({
  id,
  favorite: false,
  archived: false,
  broken: false,
  opens: 0,
  updatedAt: new Date().toISOString(),
})

export function upsertMeta(
  resourceId: string,
  patch: Partial<Omit<ResourceMeta, 'id'>>,
) {
  const existing = resourceMetaCol.get().find((m) => m.id === resourceId)
  if (existing) {
    resourceMetaCol.update(resourceId, {
      ...patch,
      updatedAt: new Date().toISOString(),
    })
  } else {
    resourceMetaCol.add({
      ...emptyMeta(resourceId),
      ...patch,
      updatedAt: new Date().toISOString(),
    })
  }
}

/** 開啟一個資源：寫開啟歷史 + 累計次數 + 最後開啟（單次原子動作） */
export function logOpen(resourceId: string) {
  const now = new Date().toISOString()
  const existing = resourceMetaCol.get().find((m) => m.id === resourceId)
  resourceOpenLogCol.add({ resourceId, ts: now })
  if (existing) {
    resourceMetaCol.update(resourceId, {
      opens: existing.opens + 1,
      lastOpened: now,
      updatedAt: now,
    })
  } else {
    resourceMetaCol.add({
      ...emptyMeta(resourceId),
      opens: 1,
      lastOpened: now,
    })
  }
}

/** 清掉孤兒 meta / 開啟歷史（資源已刪） */
export function pruneOrphans(validIds: Set<string>) {
  for (const m of resourceMetaCol.get())
    if (!validIds.has(m.id)) resourceMetaCol.remove(m.id)
  for (const l of resourceOpenLogCol.get())
    if (!validIds.has(l.resourceId)) resourceOpenLogCol.remove(l.id)
}

// ============================================================
//  純函式工具（網域、日期、搜尋、統計）
// ============================================================

/** 由 URL 抽網域（去 www.），失敗回 undefined */
export function domainOf(url?: string): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

/** 由 URL 猜資源類型（YouTube → 影片、pdf → 試題/講義…），畀快速新增提示用 */
export function guessTypeFromUrl(url: string): ResourceType | undefined {
  const u = url.toLowerCase()
  if (/youtube\.com|youtu\.be|vimeo\.com|\.mp4|bilibili/.test(u)) return 'video'
  if (/\.pdf(\?|$)/.test(u)) return 'paper'
  if (/docs\.google\.com\/presentation|\.pptx?(\?|$)|slides/.test(u))
    return 'slides'
  if (/docs\.google\.com\/document|\.docx?(\?|$)/.test(u)) return 'handout'
  return undefined
}

/** 由網域抽一個字母做 favicon 替身（無真 favicon，純文字 token） */
export function faviconLetter(domain?: string): string {
  if (!domain) return '·'
  return domain.charAt(0).toUpperCase()
}

// ───────── 日期 ─────────
export function todayKey(): string {
  return keyOf(new Date())
}
export function keyOf(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
export function addDaysKey(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, (d ?? 1) + n, 12)
  return keyOf(date)
}
export function shortDate(key: string): string {
  const [, m, d] = key.split('-').map(Number)
  return `${m}/${d}`
}

/** 「今日 / 昨日 / N 日前 / 日期」相對標籤（畀列表 / 詳情用） */
export function relativeDate(iso?: string): string {
  if (!iso) return '—'
  const then = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - then.getTime()
  const day = 864e5
  const sameDay = keyOf(then) === keyOf(now)
  if (sameDay) {
    const hrs = Math.floor(diffMs / 36e5)
    if (hrs < 1) return '剛剛'
    return `${hrs} 小時前`
  }
  const days = Math.floor(diffMs / day)
  if (days === 1) return '昨日'
  if (days < 7) return `${days} 日前`
  if (days < 30) return `${Math.floor(days / 7)} 週前`
  return `${then.getFullYear()}/${then.getMonth() + 1}/${then.getDate()}`
}

// ───────── 標籤 ─────────
/** 由全部資源抽出標籤 → 次數，按次數降序 */
export function tagFrequency(resources: Resource[]): { tag: string; count: number }[] {
  const map = new Map<string, number>()
  for (const r of resources)
    for (const t of r.tags ?? []) map.set(t, (map.get(t) ?? 0) + 1)
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

// ============================================================
//  篩選 / 排序（純函式，方便 memo）
// ============================================================
export type SortKey =
  | 'recent'
  | 'oldest'
  | 'title'
  | 'opens'
  | 'lastOpened'
  | 'type'

export const SORT_LABEL: Record<SortKey, string> = {
  recent: '最近加入',
  oldest: '最早加入',
  title: '標題 A→Z',
  opens: '最多開啟',
  lastOpened: '最近開啟',
  type: '依類型',
}

// 智能篩選（左欄快捷）
export type SmartView =
  | 'all'
  | 'favorites'
  | 'recent_opened'
  | 'unsorted'
  | 'broken'
  | 'archived'

export interface FilterState {
  smart: SmartView
  type: ResourceType | 'all'
  topicId: string
  folderId: string | 'all'
  tags: string[] // AND 多選
  search: string
  sort: SortKey
}

export const DEFAULT_FILTER: FilterState = {
  smart: 'all',
  type: 'all',
  topicId: '',
  folderId: 'all',
  tags: [],
  search: '',
  sort: 'recent',
}

/** 一條資源連同其 meta（join 後畀 UI 用） */
export interface ResourceRow {
  res: Resource
  meta: ResourceMeta
  domain?: string
}

export function joinMeta(
  resources: Resource[],
  metas: ResourceMeta[],
): ResourceRow[] {
  const byId = new Map(metas.map((m) => [m.id, m]))
  return resources.map((res) => ({
    res,
    meta: byId.get(res.id) ?? emptyMeta(res.id),
    domain: domainOf(res.url),
  }))
}

export function applyFilter(rows: ResourceRow[], f: FilterState): ResourceRow[] {
  const q = f.search.trim().toLowerCase()
  let out = rows.filter((row) => {
    const { res, meta, domain } = row
    // 智能視圖（封存獨立；其餘預設隱藏封存）
    if (f.smart === 'archived') {
      if (!meta.archived) return false
    } else {
      if (meta.archived) return false
      if (f.smart === 'favorites' && !meta.favorite) return false
      if (f.smart === 'recent_opened' && !meta.lastOpened) return false
      if (f.smart === 'unsorted' && meta.folderId) return false
      if (f.smart === 'broken' && !meta.broken) return false
    }
    if (f.type !== 'all' && res.type !== f.type) return false
    if (f.topicId && res.topicId !== f.topicId) return false
    if (f.folderId !== 'all') {
      if (f.folderId === '__none' ? !!meta.folderId : meta.folderId !== f.folderId)
        return false
    }
    if (f.tags.length) {
      const set = new Set(res.tags ?? [])
      if (!f.tags.every((t) => set.has(t))) return false
    }
    if (q) {
      const hay = [
        res.title,
        res.notes ?? '',
        res.url ?? '',
        domain ?? '',
        (res.tags ?? []).join(' '),
      ]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  out = sortRows(out, f.sort)
  return out
}

export function sortRows(rows: ResourceRow[], sort: SortKey): ResourceRow[] {
  const arr = [...rows]
  switch (sort) {
    case 'recent':
      arr.sort((a, b) => b.res.createdAt.localeCompare(a.res.createdAt))
      break
    case 'oldest':
      arr.sort((a, b) => a.res.createdAt.localeCompare(b.res.createdAt))
      break
    case 'title':
      arr.sort((a, b) => a.res.title.localeCompare(b.res.title, 'zh-HK'))
      break
    case 'opens':
      arr.sort(
        (a, b) =>
          b.meta.opens - a.meta.opens ||
          b.res.createdAt.localeCompare(a.res.createdAt),
      )
      break
    case 'lastOpened':
      arr.sort((a, b) =>
        (b.meta.lastOpened ?? '').localeCompare(a.meta.lastOpened ?? ''),
      )
      break
    case 'type':
      arr.sort(
        (a, b) =>
          TYPE_ORDER.indexOf(a.res.type) - TYPE_ORDER.indexOf(b.res.type) ||
          a.res.title.localeCompare(b.res.title, 'zh-HK'),
      )
      break
  }
  return arr
}

// ============================================================
//  統計（畀 Insights 圖表 / KPI 用）
// ============================================================
export interface TypeStat {
  type: ResourceType
  count: number
}
export function typeBreakdown(rows: ResourceRow[]): TypeStat[] {
  const counts: Record<ResourceType, number> = {
    handout: 0,
    slides: 0,
    paper: 0,
    link: 0,
    video: 0,
    note: 0,
  }
  for (const r of rows) counts[r.res.type] += 1
  return TYPE_ORDER.map((type) => ({ type, count: counts[type] }))
}

export interface FolderStat {
  id: string
  name: string
  color: string
  count: number
}
export function folderBreakdown(
  rows: ResourceRow[],
  folders: ResourceFolder[],
): FolderStat[] {
  const byFolder = new Map<string, number>()
  let none = 0
  for (const r of rows) {
    if (r.meta.folderId) byFolder.set(r.meta.folderId, (byFolder.get(r.meta.folderId) ?? 0) + 1)
    else none += 1
  }
  const ordered = [...folders]
    .sort((a, b) => a.order - b.order)
    .map((f) => ({
      id: f.id,
      name: f.name,
      color: f.color,
      count: byFolder.get(f.id) ?? 0,
    }))
  ordered.push({ id: '__none', name: '未分類', color: 'slate', count: none })
  return ordered
}

/** 每張資源被開啟次數排行（top N，只計有開過嘅） */
export function topOpened(rows: ResourceRow[], n = 6): ResourceRow[] {
  return rows
    .filter((r) => r.meta.opens > 0)
    .sort((a, b) => b.meta.opens - a.meta.opens)
    .slice(0, n)
}

/** 過去 N 日「每日新增資源數」（按 createdAt） */
export function addedTrend(
  rows: ResourceRow[],
  days: number,
): { key: string; label: string; count: number }[] {
  const today = todayKey()
  const buckets = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) buckets.set(addDaysKey(today, -i), 0)
  for (const r of rows) {
    const key = r.res.createdAt.slice(0, 10)
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return [...buckets.entries()].map(([key, count]) => ({
    key,
    label: shortDate(key),
    count,
  }))
}

/** 過去 N 日「每日開啟次數」（按開啟歷史 ts） */
export function openTrend(
  logs: OpenLog[],
  days: number,
): { key: string; label: string; count: number }[] {
  const today = todayKey()
  const buckets = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) buckets.set(addDaysKey(today, -i), 0)
  for (const l of logs) {
    const key = l.ts.slice(0, 10)
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return [...buckets.entries()].map(([key, count]) => ({
    key,
    label: shortDate(key),
    count,
  }))
}

/** 各課題下嘅資源數（top，畀覆蓋條用） */
export function topicCoverage(
  rows: ResourceRow[],
  topicName: (id: string) => string,
  n = 8,
): { id: string; name: string; count: number }[] {
  const byTopic = new Map<string, number>()
  let untagged = 0
  for (const r of rows) {
    if (r.res.topicId) byTopic.set(r.res.topicId, (byTopic.get(r.res.topicId) ?? 0) + 1)
    else untagged += 1
  }
  const list = [...byTopic.entries()]
    .map(([id, count]) => ({ id, name: topicName(id) || '（已刪課題）', count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
  if (untagged > 0) list.push({ id: '__none', name: '未連結課題', count: untagged })
  return list
}
