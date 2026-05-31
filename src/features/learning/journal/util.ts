import type { Entity } from '../../../lib/store'

// ============================================================
//  學習日誌 — 核心型別 + 工具（Day One 風）
//  ------------------------------------------------------------
//  - 自家 JournalDoc 型別（比共用 JournalEntry 更豐富）
//  - 日期 / 心情 / 字數 / 連續天數 / 圖表數學，全部零依賴
//  - 不修改任何共用檔；新欄位全部 optional，向後相容
// ============================================================

// ───────── 型別 ─────────
/** 一篇日誌（自家擴充，欄位對齊將來 Supabase 表） */
export interface JournalDoc extends Entity {
  date: string // YYYY-MM-DD（這篇日誌記錄嘅日子）
  title?: string // 標題（選填）
  content: string // 內文（支援多行 + #標籤）
  mood?: string // 心情 emoji（見 MOODS）
  weather?: string // 天氣（見 WEATHER）
  gratitude?: string // 「今日感恩」一句（選填）
  favorite?: boolean // 標記精選
  createdAt: string // ISO，建立時間
  updatedAt: string // ISO，最後修改時間
}

// ───────── 心情量表（5 級，由好至差 = 5..1）─────────
export interface MoodDef {
  emoji: string
  label: string
  score: number // 1(最差) … 5(最好)
  /** Tailwind 文字色（深色有 dark:） */
  text: string
  /** 點 / 填色（SVG / 條形圖用，吃 hex 方便 stroke/fill） */
  hex: string
  /** 軟背景 chip */
  chip: string
}

export const MOODS: MoodDef[] = [
  { emoji: '😀', label: '很好', score: 5, text: 'text-emerald-600 dark:text-emerald-400', hex: '#10b981', chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  { emoji: '🙂', label: '不錯', score: 4, text: 'text-teal-600 dark:text-teal-400', hex: '#14b8a6', chip: 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300' },
  { emoji: '😐', label: '普通', score: 3, text: 'text-amber-600 dark:text-amber-400', hex: '#f59e0b', chip: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  { emoji: '😓', label: '有點累', score: 2, text: 'text-orange-600 dark:text-orange-400', hex: '#f97316', chip: 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' },
  { emoji: '😣', label: '辛苦', score: 1, text: 'text-rose-600 dark:text-rose-400', hex: '#f43f5e', chip: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
]

const MOOD_BY_EMOJI = new Map(MOODS.map((m) => [m.emoji, m]))
export function moodDef(emoji?: string): MoodDef | undefined {
  return emoji ? MOOD_BY_EMOJI.get(emoji) : undefined
}
export function moodScore(emoji?: string): number | undefined {
  return moodDef(emoji)?.score
}

// ───────── 天氣 ─────────
export const WEATHER = ['☀️', '⛅', '☁️', '🌧️', '⛈️', '❄️', '🌫️'] as const

// ───────── 反思提示（隨機輪換，新建空白日誌時顯示）─────────
export const PROMPTS = [
  '今日學咗啲咩？有冇邊個概念終於通咗？',
  '今日最大嘅突破或心得係咩？',
  '邊一忽仲未明？聽日想點跟進？',
  '今日嘅學習，最值得記低嘅一件事係…',
  '如果同琴日嘅自己講一句話，你會講…',
  '今日邊個習慣 / 練習做得最好？',
  '有冇遇到困難？你係點克服（或打算點克服）？',
]

/** 由日期 key 穩定地揀一句提示（同一日永遠同一句） */
export function promptOfDay(key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return PROMPTS[h % PROMPTS.length]
}

// ───────── 日期工具（本地時區，避開 toISOString 時差）─────────
export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const
export const MONTHS_SHORT = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'] as const

export function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
}

export function todayKey(): string {
  return toKey(new Date())
}

export function addDays(key: string, n: number): string {
  const d = fromKey(key)
  return toKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12))
}

export function diffDays(a: string, b: string): number {
  const ms = fromKey(a).getTime() - fromKey(b).getTime()
  return Math.round(ms / 864e5)
}

export function longDate(key: string): string {
  const d = fromKey(key)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${WEEKDAYS[d.getDay()]}`
}

export function mediumDate(key: string): string {
  const d = fromKey(key)
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`
}

/** 相對時間（最後修改顯示用） */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const sec = Math.floor((Date.now() - then) / 1000)
  if (sec < 60) return '啱啱'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分鐘前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小時前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} 日前`
  return new Date(iso).toLocaleDateString('zh-HK', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ───────── 文字 / 標籤 ─────────
/** 字數：中日韓字逐隻計，英文 / 數字以「詞」計，較貼近實感 */
export function countWords(text: string): number {
  if (!text.trim()) return 0
  const cjk = (text.match(/[㐀-鿿぀-ヿ가-힯]/g) ?? []).length
  const words = (text.replace(/[㐀-鿿぀-ヿ가-힯]/g, ' ').match(/[A-Za-z0-9'’\-]+/g) ?? []).length
  return cjk + words
}

/** 由內文解析 #hashtag（去重、保留次序） */
export function parseTags(content: string): string[] {
  const matches = content.match(/#[\p{L}\p{N}_-]+/gu) ?? []
  const seen = new Set<string>()
  const tags: string[] = []
  for (const m of matches) {
    const tag = m.slice(1)
    const key = tag.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      tags.push(tag)
    }
  }
  return tags
}

/** 合併「明文 tags 欄位」+「內文 #標籤」（去重，case-insensitive） */
export function allTagsOf(doc: JournalDoc): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (t: string) => {
    const k = t.toLowerCase()
    if (!seen.has(k)) {
      seen.add(k)
      out.push(t)
    }
  }
  for (const t of parseTags(doc.content)) push(t)
  return out
}

export function excerpt(text: string, len = 140): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > len ? flat.slice(0, len).trimEnd() + '…' : flat
}

// ───────── 連續天數（streak）─────────
/** 由今日起連續有日誌嘅日數（今日未寫就由琴日計起，唔斷 streak） */
export function currentStreak(dateSet: Set<string>): number {
  let streak = 0
  let cur = todayKey()
  if (!dateSet.has(cur)) cur = addDays(cur, -1)
  while (dateSet.has(cur)) {
    streak += 1
    cur = addDays(cur, -1)
  }
  return streak
}

/** 歷來最長連續天數 */
export function longestStreak(dateSet: Set<string>): number {
  if (dateSet.size === 0) return 0
  const sorted = [...dateSet].sort()
  let best = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    if (diffDays(sorted[i], sorted[i - 1]) === 1) {
      run += 1
      if (run > best) best = run
    } else {
      run = 1
    }
  }
  return best
}

// ───────── 統計聚合 ─────────
export interface MoodPoint {
  key: string // 日期 key
  score: number // 1..5
  emoji: string
}

/** 近 n 日（含今日）有心情嘅資料點，由舊到新 */
export function moodTrend(docs: JournalDoc[], days: number): MoodPoint[] {
  const start = addDays(todayKey(), -(days - 1))
  const byDate = new Map<string, JournalDoc>()
  for (const d of docs) {
    if (d.date >= start && d.mood) {
      // 同日多篇 → 取最後修改嗰篇
      const prev = byDate.get(d.date)
      if (!prev || d.updatedAt > prev.updatedAt) byDate.set(d.date, d)
    }
  }
  const out: MoodPoint[] = []
  for (const [key, d] of byDate) {
    const s = moodScore(d.mood)
    if (s) out.push({ key, score: s, emoji: d.mood! })
  }
  return out.sort((a, b) =>
    a.key === b.key ? 0 : a.key < b.key ? -1 : 1,
  )
}

/** 心情分佈：每級幾多篇（依量表次序，5→1） */
export function moodDistribution(docs: JournalDoc[]): { def: MoodDef; count: number }[] {
  const counts = new Map<string, number>()
  for (const d of docs) if (d.mood) counts.set(d.mood, (counts.get(d.mood) ?? 0) + 1)
  return MOODS.map((def) => ({ def, count: counts.get(def.emoji) ?? 0 }))
}

/** 近 n 個月每月日誌數（由舊到新） */
export function monthlyCounts(docs: JournalDoc[], months: number): { label: string; ym: string; count: number }[] {
  const now = new Date()
  const buckets: { label: string; ym: string; count: number }[] = []
  const idx = new Map<string, number>()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    idx.set(ym, buckets.length)
    buckets.push({ label: MONTHS_SHORT[d.getMonth()], ym, count: 0 })
  }
  for (const doc of docs) {
    const ym = doc.date.slice(0, 7)
    const i = idx.get(ym)
    if (i !== undefined) buckets[i].count += 1
  }
  return buckets
}

/** 星期幾分佈（日=0 … 六=6） */
export function weekdayCounts(docs: JournalDoc[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0]
  for (const d of docs) out[fromKey(d.date).getDay()] += 1
  return out
}

// ───────── 年度熱力圖（GitHub 風 contribution grid）─────────
export interface HeatCell {
  key: string
  count: number
  inYear: boolean
}
export interface HeatGrid {
  weeks: HeatCell[][] // 每個 week 一 column，內含 7 格（日→六）
  monthLabels: { col: number; label: string }[]
  total: number
  activeDays: number
}

/** 砌指定年份嘅熱力圖（由該年 1 月 1 號嗰個星期日開始，到 12 月 31 號嗰個星期六） */
export function buildHeatGrid(docs: JournalDoc[], year: number): HeatGrid {
  const countByDate = new Map<string, number>()
  let total = 0
  for (const d of docs) {
    if (d.date.slice(0, 4) === String(year)) {
      countByDate.set(d.date, (countByDate.get(d.date) ?? 0) + 1)
      total += 1
    }
  }
  const jan1 = new Date(year, 0, 1, 12)
  const start = new Date(jan1)
  start.setDate(jan1.getDate() - jan1.getDay()) // 退到星期日
  const dec31 = new Date(year, 11, 31, 12)
  const end = new Date(dec31)
  end.setDate(dec31.getDate() + (6 - dec31.getDay())) // 進到星期六

  const weeks: HeatCell[][] = []
  const monthLabels: { col: number; label: string }[] = []
  let lastMonth = -1
  const cur = new Date(start)
  let col = 0
  while (cur <= end) {
    const week: HeatCell[] = []
    for (let dow = 0; dow < 7; dow++) {
      const key = toKey(cur)
      const inYear = cur.getFullYear() === year
      week.push({ key, count: countByDate.get(key) ?? 0, inYear })
      if (inYear && cur.getDate() <= 7 && cur.getMonth() !== lastMonth) {
        lastMonth = cur.getMonth()
        monthLabels.push({ col, label: MONTHS_SHORT[cur.getMonth()] })
      }
      cur.setDate(cur.getDate() + 1)
    }
    weeks.push(week)
    col += 1
  }
  return { weeks, monthLabels, total, activeDays: countByDate.size }
}

/** 熱力圖配色：依當日篇數分 5 級（吃 Tailwind class，深色有 dark:） */
export function heatLevel(count: number): string {
  if (count <= 0) return 'bg-slate-100 dark:bg-slate-800'
  if (count === 1) return 'bg-accent/30 dark:bg-accent/25'
  if (count === 2) return 'bg-accent/55 dark:bg-accent/50'
  if (count === 3) return 'bg-accent/80 dark:bg-accent/75'
  return 'bg-accent dark:bg-accent'
}

// ───────── 匯出 ─────────
/** 整批日誌 → Markdown（最新喺上） */
export function toMarkdown(docs: JournalDoc[]): string {
  const sorted = [...docs].sort((a, b) =>
    a.date === b.date ? 0 : a.date < b.date ? 1 : -1,
  )
  const lines: string[] = ['# 學習日誌', '']
  for (const d of sorted) {
    const head = [longDate(d.date), d.mood, d.weather].filter(Boolean).join(' · ')
    lines.push(`## ${d.title?.trim() || head}`)
    if (d.title?.trim()) lines.push(`*${head}*`)
    lines.push('')
    lines.push(d.content.trim())
    if (d.gratitude?.trim()) {
      lines.push('')
      lines.push(`> 🙏 感恩：${d.gratitude.trim()}`)
    }
    const tags = allTagsOf(d)
    if (tags.length) {
      lines.push('')
      lines.push(tags.map((t) => `#${t}`).join(' '))
    }
    lines.push('', '---', '')
  }
  return lines.join('\n')
}

/** 觸發瀏覽器下載一個文字檔（零依賴） */
export function downloadText(filename: string, text: string, mime = 'text/plain'): void {
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
