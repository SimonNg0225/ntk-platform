import type { ThreadSort } from './types'

export function countLinks(s: string): number {
  return (s.match(/https?:\/\//gi) ?? []).length
}
export function validateThread(title: string, body: string): string | null {
  const t = title.trim(), b = body.trim()
  if (t.length < 1 || t.length > 120) return '標題需 1–120 字。'
  if (b.length < 1 || b.length > 5000) return '內文需 1–5000 字。'
  if (countLinks(b) > 5) return '連結太多（最多 5 條）。'
  return null
}
export function validatePost(body: string): string | null {
  const b = body.trim()
  if (b.length < 1 || b.length > 5000) return '回覆需 1–5000 字。'
  if (countLinks(b) > 5) return '連結太多（最多 5 條）。'
  return null
}
export function sortColumn(sort: ThreadSort): { column: string; ascending: boolean } {
  if (sort === 'replies') return { column: 'reply_count', ascending: false }
  if (sort === 'top') return { column: 'score', ascending: false }
  return { column: 'last_activity_at', ascending: false }
}
export function toggleSet(set: Set<string>, id: string, on: boolean): Set<string> {
  const next = new Set(set)
  if (on) next.add(id); else next.delete(id)
  return next
}
