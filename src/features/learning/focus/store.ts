import { createCollection } from '../../../lib/store'
import {
  DEFAULT_SETTINGS,
  type FocusLog,
  type FocusProject,
  type FocusSettings,
} from './types'

// ============================================================
//  專注番茄鐘 — 自家持久化集合 + 聚合工具（零外部依賴）
//  唯一 localStorage key：focus_logs / focus_projects / focus_settings_v1
// ============================================================

const now = new Date().toISOString()

// 種子：兩個常見專案，等空白時都有顏色示範
export const focusProjectsCol = createCollection<FocusProject>(
  'focus_projects',
  [
    { id: 'fp-study', name: '溫習', color: 'accent', icon: '📚', dailyGoal: 4, createdAt: now },
    { id: 'fp-work', name: '工作', color: 'blue', icon: '💼', dailyGoal: 2, createdAt: now },
    { id: 'fp-reading', name: '閱讀', color: 'green', icon: '📖', createdAt: now },
  ],
)

export const focusLogsCol = createCollection<FocusLog>('focus_logs', [])

// 設定只得一條 record（id 固定）
export const SETTINGS_ID = 'focus-settings'
export const focusSettingsCol = createCollection<FocusSettings>(
  'focus_settings_v1',
  [{ id: SETTINGS_ID, ...DEFAULT_SETTINGS }],
)

export function getSettings(all: FocusSettings[]): FocusSettings {
  return all.find((s) => s.id === SETTINGS_ID) ?? { id: SETTINGS_ID, ...DEFAULT_SETTINGS }
}

// ───────── 日期工具（本地時區，避開 toISOString 時差）─────────
export function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export function keyOf(iso: string): string {
  return dayKey(new Date(iso))
}
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
export function todayKey(): string {
  return dayKey(new Date())
}

export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const

// ───────── 只計專注（focus）+ 已完成 ─────────
export function isCountable(l: FocusLog): boolean {
  return l.kind === 'focus'
}

// ───────── 聚合：每日分鐘 / 節數 ─────────
export interface DayStat {
  key: string
  minutes: number
  sessions: number // 完成嘅專注節
}

/** [from, to] 內逐日聚合（focus + completed）。回傳由舊到新。 */
export function dailySeries(logs: FocusLog[], from: Date, to: Date): DayStat[] {
  const map = new Map<string, DayStat>()
  let cur = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  while (cur <= end) {
    const k = dayKey(cur)
    map.set(k, { key: k, minutes: 0, sessions: 0 })
    cur = addDays(cur, 1)
  }
  for (const l of logs) {
    if (!isCountable(l)) continue
    const k = keyOf(l.startedAt)
    const d = map.get(k)
    if (!d) continue
    d.minutes += l.actualMin
    if (l.completed) d.sessions += 1
  }
  return [...map.values()]
}

// ───────── 連續達標天數（streak）─────────
/** 由今日往回數，連續「有完成至少一節專注」嘅日數 */
export function currentStreak(logs: FocusLog[]): number {
  const done = new Set(
    logs.filter((l) => isCountable(l) && l.completed).map((l) => keyOf(l.startedAt)),
  )
  let streak = 0
  let cur = new Date()
  // 今日未做唔即刻斷：由今日計，今日無就睇尋日係咪 streak 起點
  if (!done.has(dayKey(cur))) cur = addDays(cur, -1)
  while (done.has(dayKey(cur))) {
    streak += 1
    cur = addDays(cur, -1)
  }
  return streak
}

/** 歷來最長連續達標 */
export function longestStreak(logs: FocusLog[]): number {
  const days = [
    ...new Set(
      logs.filter((l) => isCountable(l) && l.completed).map((l) => keyOf(l.startedAt)),
    ),
  ].sort()
  if (!days.length) return 0
  let best = 1
  let run = 1
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1] + 'T12:00:00')
    const cur = new Date(days[i] + 'T12:00:00')
    const diff = Math.round((cur.getTime() - prev.getTime()) / 86400000)
    if (diff === 1) run += 1
    else run = 1
    if (run > best) best = run
  }
  return best
}

// ───────── 星期分佈（0=日 … 6=六）─────────
export function weekdayDistribution(logs: FocusLog[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0]
  for (const l of logs) {
    if (!isCountable(l)) continue
    out[new Date(l.startedAt).getDay()] += l.actualMin
  }
  return out
}

// ───────── 一日 24 小時分佈（幾點最專注）─────────
export function hourDistribution(logs: FocusLog[]): number[] {
  const out = new Array(24).fill(0) as number[]
  for (const l of logs) {
    if (!isCountable(l)) continue
    out[new Date(l.startedAt).getHours()] += l.actualMin
  }
  return out
}

// ───────── 專案佔比 ─────────
export interface ProjectStat {
  projectId: string | null
  minutes: number
  sessions: number
}
export function projectBreakdown(logs: FocusLog[]): ProjectStat[] {
  const map = new Map<string | null, ProjectStat>()
  for (const l of logs) {
    if (!isCountable(l)) continue
    const id = l.projectId ?? null
    const s = map.get(id) ?? { projectId: id, minutes: 0, sessions: 0 }
    s.minutes += l.actualMin
    if (l.completed) s.sessions += 1
    map.set(id, s)
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes)
}

// ───────── 標籤統計 ─────────
export function tagBreakdown(logs: FocusLog[]): { tag: string; minutes: number }[] {
  const map = new Map<string, number>()
  for (const l of logs) {
    if (!isCountable(l) || !l.tags) continue
    for (const t of l.tags) map.set(t, (map.get(t) ?? 0) + l.actualMin)
  }
  return [...map.entries()]
    .map(([tag, minutes]) => ({ tag, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
}

// ───────── 總結指標 ─────────
export interface Totals {
  focusMin: number
  sessions: number
  abandoned: number
  interruptions: number
  avgRating: number | null
  completionRate: number // 0–100
  avgSessionMin: number
}
export function totalsOf(logs: FocusLog[]): Totals {
  const focus = logs.filter(isCountable)
  const done = focus.filter((l) => l.completed)
  const focusMin = done.reduce((s, l) => s + l.actualMin, 0)
  const interruptions = focus.reduce((s, l) => s + (l.interruptions ?? 0), 0)
  const rated = done.filter((l) => typeof l.rating === 'number')
  const avgRating = rated.length
    ? rated.reduce((s, l) => s + (l.rating ?? 0), 0) / rated.length
    : null
  return {
    focusMin,
    sessions: done.length,
    abandoned: focus.length - done.length,
    interruptions,
    avgRating,
    completionRate: focus.length ? (done.length / focus.length) * 100 : 0,
    avgSessionMin: done.length ? focusMin / done.length : 0,
  }
}

// ───────── 格式化 ─────────
export function fmtDuration(min: number): string {
  const m = Math.round(min)
  if (m < 60) return `${m} 分`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} 時 ${r} 分` : `${h} 時`
}

export function fmtClock(totalSec: number): string {
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function relativeDay(key: string): string {
  const t = todayKey()
  if (key === t) return '今日'
  if (key === dayKey(addDays(new Date(), -1))) return '昨日'
  const d = new Date(key + 'T12:00:00')
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

// ───────── CSV 匯出 ─────────
export function logsToCsv(logs: FocusLog[], projName: (id?: string) => string): string {
  const head = ['日期', '開始', '結束', '類型', '專案', '任務', '標籤', '計劃(分)', '實際(分)', '完成', '中斷', '評分', '筆記']
  const kindLabel: Record<FocusLog['kind'], string> = {
    focus: '專注',
    short_break: '短休',
    long_break: '長休',
  }
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const rows = logs
    .slice()
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((l) =>
      [
        keyOf(l.startedAt),
        fmtTime(l.startedAt),
        fmtTime(l.endedAt),
        kindLabel[l.kind],
        l.projectId ? projName(l.projectId) : '',
        l.label ?? '',
        (l.tags ?? []).join(' '),
        String(l.plannedMin),
        String(l.actualMin),
        l.completed ? '是' : '否',
        String(l.interruptions ?? 0),
        l.rating ? String(l.rating) : '',
        (l.note ?? '').replace(/\n/g, ' '),
      ]
        .map(esc)
        .join(','),
    )
  return [head.map(esc).join(','), ...rows].join('\n')
}
