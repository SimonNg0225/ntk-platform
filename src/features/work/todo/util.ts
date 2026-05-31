import type { FullTask, Priority, Project } from './types'

// ============================================================
//  待辦：純函式工具（日期 / 智能解析 / 分組 / 統計）
//  零依賴、可單獨測試。
// ============================================================

// ───────── 日期 ─────────
export function todayISO(): string {
  return localISO(new Date())
}

// 用「本地」年月日（避免 toISOString 時區偏移）
export function localISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  dt.setDate(dt.getDate() + n)
  return localISO(dt)
}

// 由今日起 +N 日嘅 ISO
export function offsetFromToday(n: number): string {
  return addDays(todayISO(), n)
}

// 兩個 ISO 相差幾多日（b - a，正=b 喺後）
export function daysBetween(a: string, b: string): number {
  const pa = a.split('-').map(Number)
  const pb = b.split('-').map(Number)
  const da = new Date(pa[0], (pa[1] ?? 1) - 1, pa[2] ?? 1).getTime()
  const db = new Date(pb[0], (pb[1] ?? 1) - 1, pb[2] ?? 1).getTime()
  return Math.round((db - da) / 864e5)
}

export type DueBucket = 'overdue' | 'today' | 'tomorrow' | 'soon' | 'later' | 'none'

export function dueBucket(due: string | undefined, ref = todayISO()): DueBucket {
  if (!due) return 'none'
  const diff = daysBetween(ref, due)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff <= 7) return 'soon'
  return 'later'
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']

// 人類可讀嘅到期文字（相對 + 星期）
export function dueLabel(due: string, ref = todayISO()): string {
  const diff = daysBetween(ref, due)
  if (diff === 0) return '今日'
  if (diff === 1) return '聽日'
  if (diff === -1) return '尋日'
  const [y, m, d] = due.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  const wd = `週${WEEKDAY[dt.getDay()]}`
  if (diff < 0) return `逾期 ${Math.abs(diff)} 日`
  if (diff <= 7) return `${wd}（${diff} 日後）`
  return `${m}月${d}日 ${wd}`
}

// ───────── 智能快速輸入解析（Todoist 風）─────────
//  支援：
//   !!!  → P1（!! → P2，! → P3）
//   #專案名 → 配對現有專案（大小寫 / 部分相符）
//   @標籤  → 加標籤（可多個）
//   today / tdy / 今日 / 聽日 / tmr / +N（N 日後）→ 到期日
export interface ParsedQuickAdd {
  text: string
  priority?: Priority
  projectId?: string
  tags: string[]
  due?: string
}

export function parseQuickAdd(raw: string, projects: Project[]): ParsedQuickAdd {
  let text = raw
  const tags: string[] = []
  let priority: Priority | undefined
  let projectId: string | undefined
  let due: string | undefined

  // 優先級：連續驚嘆號（!!! / !! / !）
  const prMatch = text.match(/(?:^|\s)(!{1,3})(?=\s|$)/)
  if (prMatch) {
    const n = prMatch[1].length
    priority = (n === 3 ? 1 : n === 2 ? 2 : 3) as Priority
    text = text.replace(prMatch[0], ' ')
  }

  // 標籤：@xxx（可多個）
  text = text.replace(/(?:^|\s)@([^\s@#]+)/g, (_, t: string) => {
    if (!tags.includes(t)) tags.push(t)
    return ' '
  })

  // 專案：#xxx（配對現有；部分／大小寫相符）
  const projMatch = text.match(/(?:^|\s)#([^\s@#]+)/)
  if (projMatch) {
    const q = projMatch[1].toLowerCase()
    const hit =
      projects.find((p) => p.name.toLowerCase() === q) ??
      projects.find((p) => p.name.toLowerCase().includes(q))
    if (hit) {
      projectId = hit.id
      text = text.replace(projMatch[0], ' ')
    }
  }

  // 到期：關鍵字 / +N
  const dueRules: { re: RegExp; days: number }[] = [
    { re: /(?:^|\s)(today|tdy|今日|今天)(?=\s|$)/i, days: 0 },
    { re: /(?:^|\s)(tmr|tomorrow|聽日|明日|明天)(?=\s|$)/i, days: 1 },
  ]
  for (const r of dueRules) {
    const m = text.match(r.re)
    if (m) {
      due = offsetFromToday(r.days)
      text = text.replace(m[0], ' ')
      break
    }
  }
  if (!due) {
    const plus = text.match(/(?:^|\s)\+(\d{1,3})d?(?=\s|$)/i)
    if (plus) {
      due = offsetFromToday(Number(plus[1]))
      text = text.replace(plus[0], ' ')
    }
  }

  return {
    text: text.replace(/\s{2,}/g, ' ').trim(),
    priority,
    projectId,
    tags,
    due,
  }
}

// ───────── 優先級 meta ─────────
export const PRIORITY_META: Record<
  Priority,
  { label: string; short: string; dot: string; text: string; flag: string }
> = {
  1: {
    label: '最緊要',
    short: 'P1',
    dot: 'bg-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
    flag: 'text-rose-500',
  },
  2: {
    label: '高',
    short: 'P2',
    dot: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    flag: 'text-amber-500',
  },
  3: {
    label: '中',
    short: 'P3',
    dot: 'bg-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    flag: 'text-blue-500',
  },
  4: {
    label: '無',
    short: 'P4',
    dot: 'bg-slate-300 dark:bg-slate-600',
    text: 'text-slate-400 dark:text-slate-500',
    flag: 'text-slate-300 dark:text-slate-600',
  },
}

// ───────── 專案色盤（自家定義，唔依賴行事曆）─────────
export type ProjColor = 'accent' | 'blue' | 'green' | 'amber' | 'rose' | 'violet'
export const PROJ_COLORS: ProjColor[] = [
  'accent',
  'blue',
  'green',
  'amber',
  'rose',
  'violet',
]
export const PROJ_COLOR_CLS: Record<
  ProjColor,
  { dot: string; soft: string; text: string; bar: string }
> = {
  accent: {
    dot: 'bg-accent',
    soft: 'bg-accent-soft',
    text: 'text-accent-strong dark:text-accent',
    bar: 'bg-accent',
  },
  blue: {
    dot: 'bg-blue-500',
    soft: 'bg-blue-50 dark:bg-blue-500/10',
    text: 'text-blue-600 dark:text-blue-400',
    bar: 'bg-blue-500',
  },
  green: {
    dot: 'bg-emerald-500',
    soft: 'bg-emerald-50 dark:bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    bar: 'bg-emerald-500',
  },
  amber: {
    dot: 'bg-amber-500',
    soft: 'bg-amber-50 dark:bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    bar: 'bg-amber-500',
  },
  rose: {
    dot: 'bg-rose-500',
    soft: 'bg-rose-50 dark:bg-rose-500/10',
    text: 'text-rose-600 dark:text-rose-400',
    bar: 'bg-rose-500',
  },
  violet: {
    dot: 'bg-violet-500',
    soft: 'bg-violet-50 dark:bg-violet-500/10',
    text: 'text-violet-600 dark:text-violet-400',
    bar: 'bg-violet-500',
  },
}

export function projColorCls(color: string) {
  return PROJ_COLOR_CLS[(color as ProjColor) in PROJ_COLOR_CLS ? (color as ProjColor) : 'accent']
}

// ───────── 排序 ─────────
// 預設智能排序：未完成在前；逾期/今日靠前；再按優先級；再按手動 order
export function smartSort(a: FullTask, b: FullTask): number {
  if (a.done !== b.done) return a.done ? 1 : -1
  // 有到期 vs 無到期：有到期靠前
  const ad = a.meta.due
  const bd = b.meta.due
  if (ad && bd && ad !== bd) return ad < bd ? -1 : 1
  if (ad && !bd) return -1
  if (!ad && bd) return 1
  if (a.meta.priority !== b.meta.priority) return a.meta.priority - b.meta.priority
  return a.meta.order - b.meta.order
}

// ───────── 統計：近 N 日完成趨勢 ─────────
export interface TrendPoint {
  key: string // YYYY-MM-DD
  label: string // 日
  created: number
  completed: number
}

export function buildTrend(tasks: FullTask[], days: number): TrendPoint[] {
  const today = todayISO()
  const out: TrendPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = addDays(today, -i)
    const [, , d] = key.split('-')
    out.push({ key, label: String(Number(d)), created: 0, completed: 0 })
  }
  const idx = new Map(out.map((p, i) => [p.key, i]))
  for (const t of tasks) {
    const ck = t.createdAt.slice(0, 10)
    if (idx.has(ck)) out[idx.get(ck)!].created++
    if (t.done && t.meta.completedAt) {
      const dk = t.meta.completedAt.slice(0, 10)
      if (idx.has(dk)) out[idx.get(dk)!].completed++
    }
  }
  return out
}

// ───────── 統計：完成熱力（近 N 週）─────────
export interface HeatCell {
  key: string
  count: number
}
export function buildHeat(tasks: FullTask[], days: number): HeatCell[] {
  const today = todayISO()
  const cells: HeatCell[] = []
  const counts = new Map<string, number>()
  for (const t of tasks) {
    if (t.done && t.meta.completedAt) {
      const k = t.meta.completedAt.slice(0, 10)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
  }
  for (let i = days - 1; i >= 0; i--) {
    const key = addDays(today, -i)
    cells.push({ key, count: counts.get(key) ?? 0 })
  }
  return cells
}

// 連續完成日數（streak，由今日／尋日起計）
export function completionStreak(cells: HeatCell[]): number {
  let streak = 0
  for (let i = cells.length - 1; i >= 0; i--) {
    if (cells[i].count > 0) streak++
    else if (i === cells.length - 1) continue // 今日仲未做都唔斷
    else break
  }
  return streak
}
