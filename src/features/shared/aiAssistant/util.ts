import type { AiThread, AiMessage } from '../../../data/types'

// ============================================================
//  AI 助手 — 純函式 helpers（時間分組 / 統計 / 匯出）
// ============================================================

/** 約略字數（中文逐字 + 英文逐詞），用嚟做「對話長度」指標 */
export function approxWords(text: string): number {
  if (!text) return 0
  const cjk = (text.match(/[一-鿿぀-ヿ]/g) || []).length
  const words = (text.replace(/[一-鿿぀-ヿ]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length
  return cjk + words
}

/** 粗略 token 估算（≈ 字數 × 1.6，純展示用） */
export function approxTokens(text: string): number {
  return Math.round(approxWords(text) * 1.6)
}

export type TimeBucket = '今日' | '昨日' | '過去 7 日' | '更早'

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** 將一個 ISO 時間歸入時間桶（相對今日） */
export function bucketOf(iso: string, now = new Date()): TimeBucket {
  const t = new Date(iso).getTime()
  const today = startOfDay(now)
  const day = 864e5
  if (t >= today) return '今日'
  if (t >= today - day) return '昨日'
  if (t >= today - 7 * day) return '過去 7 日'
  return '更早'
}

export const BUCKET_ORDER: TimeBucket[] = ['今日', '昨日', '過去 7 日', '更早']

/** 將 threads 按時間桶分組（已假設 input 由新到舊排好） */
export function groupByTime<T extends { createdAt: string }>(
  items: T[],
  now = new Date(),
): { bucket: TimeBucket; items: T[] }[] {
  const map = new Map<TimeBucket, T[]>()
  for (const it of items) {
    const b = bucketOf(it.createdAt, now)
    const arr = map.get(b) ?? []
    arr.push(it)
    map.set(b, arr)
  }
  return BUCKET_ORDER.filter((b) => map.has(b)).map((b) => ({
    bucket: b,
    items: map.get(b)!,
  }))
}

// ───────── 整體統計 ─────────
export interface AiStats {
  threads: number
  userMsgs: number
  modelMsgs: number
  totalWords: number
  avgPerThread: number
  /** 最近 14 日每日訊息數（畫 sparkline 用），由舊到新 */
  daily: { key: string; label: string; count: number }[]
  /** 連續有用嘅日數（streak） */
  streak: number
  busiestDay: { label: string; count: number } | null
}

export function computeStats(
  threads: AiThread[],
  messages: AiMessage[],
): AiStats {
  const userMsgs = messages.filter((m) => m.role === 'user').length
  const modelMsgs = messages.filter((m) => m.role === 'model').length
  const totalWords = messages.reduce((s, m) => s + approxWords(m.content), 0)

  // 近 14 日
  const days = 14
  const now = new Date()
  const today = startOfDay(now)
  const buckets: { key: string; label: string; count: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today - i * 864e5)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    buckets.push({ key, label: `${d.getMonth() + 1}/${d.getDate()}`, count: 0 })
  }
  const idx = new Map(buckets.map((b, i) => [b.key, i]))
  for (const m of messages) {
    const d = new Date(m.createdAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const i = idx.get(key)
    if (i !== undefined) buckets[i].count++
  }

  // streak：由今日往回數連續有訊息嘅日數
  let streak = 0
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (buckets[i].count > 0) streak++
    else break
  }

  const busiest = buckets.reduce<{ label: string; count: number } | null>(
    (best, b) => (b.count > (best?.count ?? 0) ? { label: b.label, count: b.count } : best),
    null,
  )

  return {
    threads: threads.length,
    userMsgs,
    modelMsgs,
    totalWords,
    avgPerThread: threads.length ? Math.round((userMsgs + modelMsgs) / threads.length) : 0,
    daily: buckets,
    streak,
    busiestDay: busiest && busiest.count > 0 ? busiest : null,
  }
}

// ───────── 匯出對話做 Markdown ─────────
export function conversationToMarkdown(
  title: string,
  messages: { role: 'user' | 'model'; content: string }[],
): string {
  const lines = [`# ${title}`, '', `_匯出於 ${new Date().toLocaleString('zh-HK')}_`, '']
  for (const m of messages) {
    lines.push(m.role === 'user' ? '### 🙋 我' : '### 🤖 AI')
    lines.push('')
    lines.push(m.content.trim())
    lines.push('')
  }
  return lines.join('\n')
}

/** 觸發瀏覽器下載一個文字檔 */
export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 安全檔名 */
export function safeFilename(s: string): string {
  return (s || 'conversation').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60)
}
