// ============================================================
//  課堂工具 — 純函式（洗牌 / 分組），可單元測試
// ============================================================

/** Fisher–Yates 洗牌（回新陣列，唔改原本）。 */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 隨機分成 numGroups 組（盡量平均）。 */
export function makeGroups<T>(items: readonly T[], numGroups: number): T[][] {
  const n = Math.max(1, Math.min(Math.floor(numGroups) || 1, Math.max(items.length, 1)))
  const shuffled = shuffle(items)
  const groups: T[][] = Array.from({ length: n }, () => [])
  shuffled.forEach((it, i) => groups[i % n].push(it))
  return groups
}

/** mm:ss 格式（負數當 0）。 */
export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
