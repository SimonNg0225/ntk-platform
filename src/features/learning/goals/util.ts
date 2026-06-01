// ============================================================
//  學習目標 — 純邏輯工具（分類元資料、進度計算、動量、健康度）
// ============================================================
import {
  BookOpen,
  GraduationCap,
  Library,
  Sparkles,
  Briefcase,
  HeartPulse,
  CircleDashed,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type {
  GoalCategory,
  GoalPriority,
  GoalStatus,
  Milestone,
} from './types'

// ───────── 分類元資料（label / icon / 色票）─────────
type Tone = 'accent' | 'blue' | 'green' | 'amber' | 'rose' | 'violet' | 'cyan' | 'slate'

export interface CatMeta {
  id: GoalCategory
  label: string
  icon: LucideIcon
  tone: Tone
  dot: string
  ring: string
  text: string
}

export const CATEGORIES: CatMeta[] = [
  { id: 'study', label: '溫習', icon: BookOpen, tone: 'accent', dot: 'bg-accent', ring: 'ring-accent/30', text: 'text-accent-strong dark:text-accent' },
  { id: 'exam', label: '考試', icon: GraduationCap, tone: 'rose', dot: 'bg-rose-500', ring: 'ring-rose-400/40', text: 'text-rose-600 dark:text-rose-300' },
  { id: 'reading', label: '閱讀', icon: Library, tone: 'green', dot: 'bg-emerald-500', ring: 'ring-emerald-400/40', text: 'text-emerald-600 dark:text-emerald-300' },
  { id: 'skill', label: '技能', icon: Sparkles, tone: 'violet', dot: 'bg-violet-500', ring: 'ring-violet-400/40', text: 'text-violet-600 dark:text-violet-300' },
  { id: 'career', label: '事業', icon: Briefcase, tone: 'blue', dot: 'bg-blue-500', ring: 'ring-blue-400/40', text: 'text-blue-600 dark:text-blue-300' },
  { id: 'health', label: '健康', icon: HeartPulse, tone: 'cyan', dot: 'bg-cyan-500', ring: 'ring-cyan-400/40', text: 'text-cyan-600 dark:text-cyan-300' },
  { id: 'other', label: '其他', icon: CircleDashed, tone: 'slate', dot: 'bg-slate-400', ring: 'ring-slate-300/50', text: 'text-slate-600 dark:text-slate-300' },
]

const CAT_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]))
export function catMeta(id: GoalCategory | undefined): CatMeta {
  return CAT_BY_ID.get(id ?? 'other') ?? CATEGORIES[CATEGORIES.length - 1]
}

// ───────── 優先 / 狀態元資料 ─────────
export const PRIORITIES: { id: GoalPriority; label: string; tone: Tone }[] = [
  { id: 'high', label: '高', tone: 'rose' },
  { id: 'medium', label: '中', tone: 'amber' },
  { id: 'low', label: '低', tone: 'slate' },
]
export function priorityMeta(p: GoalPriority | undefined) {
  return PRIORITIES.find((x) => x.id === (p ?? 'medium')) ?? PRIORITIES[1]
}
/** 排序用權重（高 = 大） */
export function priorityRank(p: GoalPriority | undefined): number {
  return p === 'high' ? 3 : p === 'low' ? 1 : 2
}

export const STATUSES: { id: GoalStatus; label: string; tone: Tone }[] = [
  { id: 'active', label: '進行中', tone: 'accent' },
  { id: 'paused', label: '暫停', tone: 'amber' },
  { id: 'done', label: '已完成', tone: 'green' },
]
export function statusMeta(s: GoalStatus | undefined) {
  return STATUSES.find((x) => x.id === (s ?? 'active')) ?? STATUSES[0]
}

// ───────── 日期 ─────────
export function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

/** 距離目標日嘅日數（正 = 仲有；負 = 已過期；undefined = 無設目標日） */
export function daysUntil(targetDate?: string): number | undefined {
  if (!targetDate) return undefined
  const target = fromKey(targetDate).getTime()
  const today = fromKey(todayKey()).getTime()
  return Math.round((target - today) / 864e5)
}

export function dueLabel(targetDate?: string): { text: string; tone: Tone } | null {
  const d = daysUntil(targetDate)
  if (d === undefined) return null
  if (d < 0) return { text: `逾期 ${Math.abs(d)} 日`, tone: 'rose' }
  if (d === 0) return { text: '今日到期', tone: 'amber' }
  if (d <= 7) return { text: `仲有 ${d} 日`, tone: 'amber' }
  return { text: `仲有 ${d} 日`, tone: 'slate' }
}

// ───────── 里程碑加權進度 ─────────
/**
 * 若有里程碑：用加權完成率（更貼真實 OKR）；否則回 fallback（手動 progress）。
 */
export function computeProgress(
  milestones: Milestone[],
  fallback: number,
): number {
  if (milestones.length === 0) return Math.max(0, Math.min(100, fallback))
  let total = 0
  let done = 0
  for (const m of milestones) {
    const w = Math.max(1, m.weight || 1)
    total += w
    if (m.done) done += w
  }
  if (total === 0) return 0
  return Math.round((done / total) * 100)
}

// ───────── 里程碑寫返（upsert，保留時間戳）─────────
/** GoalEditor 草稿里程碑（只帶 UI 可編輯欄位） */
export interface DraftMilestone {
  id: string
  title: string
  done: boolean
  weight: number
}

/** syncMilestonesInto 需要嘅最小 collection 介面（方便測試 / 解耦） */
export interface MilestoneStore {
  get: () => Milestone[]
  add: (data: Omit<Milestone, 'id'> & { id?: string }) => unknown
  update: (id: string, patch: Partial<Milestone>) => void
  remove: (id: string) => void
}

/**
 * 把草稿里程碑寫返 collection（按 id upsert）。
 * - 既有里程碑：update，保留原 createdAt；只在 done 由 false→true 時寫
 *   doneAt、true→false 時清 doneAt，其餘沿用舊 doneAt。
 * - 新里程碑：add（createdAt = now）。
 * - 草稿已移除嘅：remove。
 * 避免「先全刪再重 add」會把所有 createdAt/doneAt 重設為當刻的資料污染。
 */
export function syncMilestonesInto(
  col: MilestoneStore,
  goalId: string,
  drafts: DraftMilestone[],
  now: () => string = () => new Date().toISOString(),
): void {
  const old = col.get().filter((m) => m.goalId === goalId)
  const oldById = new Map(old.map((m) => [m.id, m]))
  const keep = new Set(drafts.map((m) => m.id))
  // 1) 刪走草稿已移除嘅
  for (const m of old) if (!keep.has(m.id)) col.remove(m.id)
  // 2) upsert：既有就 update（唔郁 createdAt），新嘅先 add
  drafts.forEach((m, i) => {
    const prev = oldById.get(m.id)
    const weight = Math.max(1, m.weight || 1)
    // done 由 false→true 先寫 doneAt；true→false 清；其餘沿用舊值
    const doneAt = m.done ? (prev?.done ? prev.doneAt : now()) : undefined
    if (prev) {
      col.update(m.id, { title: m.title, done: m.done, weight, order: i, doneAt })
    } else {
      col.add({ id: m.id, goalId, title: m.title, done: m.done, weight, order: i, createdAt: now(), doneAt })
    }
  })
}

// ───────── 動量（最近進度趨勢）─────────
export interface MomentumPoint {
  key: string // YYYY-MM-DD
  value: number // 0-100（當日結束時嘅進度）
}

/**
 * 由簽到歷史砌出每日進度時間線（forward-fill），覆蓋最近 `days` 日。
 * checkins 需含 { createdAt(ISO), progress }；current 為現時進度（補最後一格）。
 */
export function buildMomentum(
  checkins: { createdAt: string; progress: number }[],
  current: number,
  days: number,
): MomentumPoint[] {
  // 用「本地日曆日」做 key（同下面時間軸一致）。
  // 用 createdAt.slice(0,10) 會攞到 UTC 日：喺 UTC+8 等時區，凌晨簽到會
  // 落錯一日、對唔到時間軸而被遺漏。改用本地日期分量保持一致。
  const localKey = (iso: string): string => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  // 整理：每日最後一筆簽到
  const byDay = new Map<string, number>()
  for (const c of checkins) {
    byDay.set(localKey(c.createdAt), c.progress) // 後者覆蓋前者（已按時間順序餵入）
  }
  const out: MomentumPoint[] = []
  const today = new Date()
  let last = 0
  // 先搵起始基線：days 之前最後一筆簽到值
  const startBoundary = new Date(today)
  startBoundary.setDate(today.getDate() - (days - 1))
  const startKey = `${startBoundary.getFullYear()}-${String(startBoundary.getMonth() + 1).padStart(2, '0')}-${String(startBoundary.getDate()).padStart(2, '0')}`
  for (const c of checkins) {
    if (localKey(c.createdAt) < startKey) last = c.progress
  }
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (byDay.has(k)) last = byDay.get(k)!
    out.push({ key: k, value: last })
  }
  // 最後一格 = 現時進度（即使今日未簽到）
  if (out.length) out[out.length - 1] = { ...out[out.length - 1], value: current }
  return out
}

// ───────── 雜項 ─────────
export function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0 // 防 NaN / ±Infinity 污染進度
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '啱啱'
  if (mins < 60) return `${mins} 分鐘前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} 小時前`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} 日前`
  // 用本地日曆日（同 buildMomentum 一致）：iso.slice(0,10) 攞嘅係 UTC 日，
  // 喺 UTC+8 等時區，本地凌晨但 UTC 未過午夜嘅簽到會顯示錯一日。
  const d = new Date(iso)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toLocaleDateString('zh-HK', { month: 'short', day: 'numeric' })
}
