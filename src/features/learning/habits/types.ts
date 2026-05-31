import { createCollection, type Entity } from '../../../lib/store'
import { habitsCol, habitLogsCol } from '../../../data/collections'
import type { Habit as LegacyHabit, HabitLog as LegacyHabitLog } from '../../../data/types'

// ============================================================
//  習慣追蹤（Streaks / Habitify 級）— 功能專屬資料層
//  ------------------------------------------------------------
//  鐵則：唔可以改 data/types.ts / data/collections.ts。
//  所以喺呢度定義「擴充版」型別，並用自己嘅 collection key 持久化。
//  首次載入會由舊嘅 habits / habit_logs 一次性遷移過嚟（保住現有資料）。
// ============================================================

// ───────── 顏色（自帶調色盤，唔 import 共用色檔，避免耦合）─────────
export type HabitColor =
  | 'accent'
  | 'blue'
  | 'green'
  | 'amber'
  | 'rose'
  | 'violet'
  | 'cyan'
  | 'pink'

export interface HabitColorSpec {
  label: string
  dot: string // 小圓點
  soft: string // 淡背景 + 文字
  solid: string // 實色背景（已完成格、按鈕）
  ring: string // 今日外框
  text: string // 純文字色（圖表用）
  /** heatmap 5 級填色（0=無，到 4=最深），含 dark 變體 */
  heat: [string, string, string, string, string]
}

export const HABIT_COLORS: Record<HabitColor, HabitColorSpec> = {
  accent: {
    label: '海軍藍',
    dot: 'bg-accent',
    soft: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
    solid: 'bg-accent text-white hover:bg-accent-strong',
    ring: 'ring-accent/40',
    text: 'text-accent-strong dark:text-accent',
    heat: [
      'bg-slate-100 dark:bg-slate-800',
      'bg-accent/25 dark:bg-accent/25',
      'bg-accent/45 dark:bg-accent/40',
      'bg-accent/70 dark:bg-accent/65',
      'bg-accent dark:bg-accent',
    ],
  },
  blue: {
    label: '藍',
    dot: 'bg-blue-500',
    soft: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    solid: 'bg-blue-500 text-white hover:bg-blue-600',
    ring: 'ring-blue-400/40',
    text: 'text-blue-600 dark:text-blue-400',
    heat: [
      'bg-slate-100 dark:bg-slate-800',
      'bg-blue-500/25',
      'bg-blue-500/45',
      'bg-blue-500/70',
      'bg-blue-500',
    ],
  },
  green: {
    label: '綠',
    dot: 'bg-emerald-500',
    soft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    solid: 'bg-emerald-500 text-white hover:bg-emerald-600',
    ring: 'ring-emerald-400/40',
    text: 'text-emerald-600 dark:text-emerald-400',
    heat: [
      'bg-slate-100 dark:bg-slate-800',
      'bg-emerald-500/25',
      'bg-emerald-500/45',
      'bg-emerald-500/70',
      'bg-emerald-500',
    ],
  },
  amber: {
    label: '橙',
    dot: 'bg-amber-500',
    soft: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    solid: 'bg-amber-500 text-white hover:bg-amber-600',
    ring: 'ring-amber-400/40',
    text: 'text-amber-600 dark:text-amber-400',
    heat: [
      'bg-slate-100 dark:bg-slate-800',
      'bg-amber-500/25',
      'bg-amber-500/45',
      'bg-amber-500/70',
      'bg-amber-500',
    ],
  },
  rose: {
    label: '紅',
    dot: 'bg-rose-500',
    soft: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    solid: 'bg-rose-500 text-white hover:bg-rose-600',
    ring: 'ring-rose-400/40',
    text: 'text-rose-600 dark:text-rose-400',
    heat: [
      'bg-slate-100 dark:bg-slate-800',
      'bg-rose-500/25',
      'bg-rose-500/45',
      'bg-rose-500/70',
      'bg-rose-500',
    ],
  },
  violet: {
    label: '紫',
    dot: 'bg-violet-500',
    soft: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    solid: 'bg-violet-500 text-white hover:bg-violet-600',
    ring: 'ring-violet-400/40',
    text: 'text-violet-600 dark:text-violet-400',
    heat: [
      'bg-slate-100 dark:bg-slate-800',
      'bg-violet-500/25',
      'bg-violet-500/45',
      'bg-violet-500/70',
      'bg-violet-500',
    ],
  },
  cyan: {
    label: '青',
    dot: 'bg-cyan-500',
    soft: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
    solid: 'bg-cyan-500 text-white hover:bg-cyan-600',
    ring: 'ring-cyan-400/40',
    text: 'text-cyan-600 dark:text-cyan-400',
    heat: [
      'bg-slate-100 dark:bg-slate-800',
      'bg-cyan-500/25',
      'bg-cyan-500/45',
      'bg-cyan-500/70',
      'bg-cyan-500',
    ],
  },
  pink: {
    label: '粉紅',
    dot: 'bg-pink-500',
    soft: 'bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
    solid: 'bg-pink-500 text-white hover:bg-pink-600',
    ring: 'ring-pink-400/40',
    text: 'text-pink-600 dark:text-pink-400',
    heat: [
      'bg-slate-100 dark:bg-slate-800',
      'bg-pink-500/25',
      'bg-pink-500/45',
      'bg-pink-500/70',
      'bg-pink-500',
    ],
  },
}

export const HABIT_COLOR_KEYS = Object.keys(HABIT_COLORS) as HabitColor[]

export function colorOf(c: string | undefined): HabitColorSpec {
  return HABIT_COLORS[c as HabitColor] ?? HABIT_COLORS.accent
}

// ───────── 頻率目標（每日 / 每週 N 次 / 指定星期）─────────
export type HabitFrequency =
  | { kind: 'daily' } // 每日
  | { kind: 'weekly'; times: number } // 每週 N 次（任何日）
  | { kind: 'weekdays'; days: number[] } // 指定星期（0=日 … 6=六）

export function freqLabel(f: HabitFrequency): string {
  if (f.kind === 'daily') return '每日'
  if (f.kind === 'weekly') return `每週 ${f.times} 次`
  const names = ['日', '一', '二', '三', '四', '五', '六']
  if (f.days.length === 7) return '每日'
  if (f.days.length === 0) return '未設定'
  return `逢週 ${f.days.slice().sort((a, b) => a - b).map((d) => names[d]).join('、')}`
}

/** 某星期（0-6）係咪「應做日」（用嚟計排程完成率 / 顯示是否 due）。 */
export function isScheduledDay(f: HabitFrequency, weekday: number): boolean {
  if (f.kind === 'daily') return true
  if (f.kind === 'weekly') return true // 每週 N 次：任何日都可以做
  return f.days.includes(weekday)
}

// ───────── 擴充版型別（喺自己檔定義）─────────
export type HabitGoalKind = 'build' | 'quit' // 養成 / 戒除

export interface Habit extends Entity {
  name: string
  icon?: string
  color: HabitColor
  frequency: HabitFrequency
  goalKind: HabitGoalKind
  /** 目標連續日數（里程碑）；0 = 無 */
  targetStreak: number
  category?: string // 自由標籤分類
  notes?: string
  reminderTime?: string // HH:mm（顯示用提醒時間）
  archived: boolean
  order: number
  createdAt: string
}

export interface HabitLog extends Entity {
  habitId: string
  date: string // YYYY-MM-DD（有記錄 = 當日完成）
  note?: string
}

// ───────── 自己嘅持久化集合（新 key；自動存 localStorage）─────────
export const habitV2Col = createCollection<Habit>('habits_v2', [])
export const habitLogV2Col = createCollection<HabitLog>('habit_logs_v2', [])

// ───────── 一次性遷移：由舊 habits / habit_logs → v2 ─────────
let migrated = false
export function migrateLegacyHabits(): void {
  if (migrated) return
  migrated = true
  try {
    const flagKey = 'ntk.habits_v2_migrated'
    if (localStorage.getItem(flagKey) === '1') return

    const legacyHabits = habitsCol.get() as LegacyHabit[]
    const legacyLogs = habitLogsCol.get() as LegacyHabitLog[]
    const existing = habitV2Col.get()

    // 只喺 v2 仲空 + 舊資料有嘢時遷移，避免覆蓋
    if (existing.length === 0 && legacyHabits.length > 0) {
      const palette = HABIT_COLOR_KEYS
      const migratedHabits: Habit[] = legacyHabits.map((h, i) => ({
        id: h.id,
        name: h.name,
        icon: h.icon,
        color: palette[i % palette.length],
        frequency: { kind: 'daily' },
        goalKind: 'build',
        targetStreak: 0,
        archived: false,
        order: i,
        createdAt: h.createdAt ?? new Date().toISOString(),
      }))
      const migratedLogs: HabitLog[] = legacyLogs.map((l) => ({
        id: l.id,
        habitId: l.habitId,
        date: l.date,
      }))
      habitV2Col.set(migratedHabits)
      habitLogV2Col.set(migratedLogs)
    }
    localStorage.setItem(flagKey, '1')
  } catch {
    /* ignore */
  }
}

// ───────── 預設常用分類 + emoji 選擇 ─────────
export const HABIT_CATEGORIES = ['健康', '學習', '運動', '正念', '工作', '生活'] as const

export const ICON_CHOICES = [
  '🏃',
  '📚',
  '💧',
  '🧘',
  '🥗',
  '😴',
  '✍️',
  '🎯',
  '💪',
  '🚭',
  '🦷',
  '🌱',
  '🎸',
  '💊',
  '☀️',
  '📵',
] as const
