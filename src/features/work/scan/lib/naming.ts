import type { OutputMode } from './types'

function clean(name: string): string {
  const base = (name || '').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60)
  return base || '掃描'
}

/** 依輸出模式產生檔名陣列。合併 → 1 個；逐張 → count 個帶補零序號。 */
export function outputFilenames(name: string, mode: OutputMode, count: number): string[] {
  const base = clean(name)
  if (mode === 'merged') return [`${base}.pdf`]
  const pad = String(count).length
  return Array.from({ length: count }, (_, i) => `${base}-${String(i + 1).padStart(Math.max(2, pad), '0')}.pdf`)
}
