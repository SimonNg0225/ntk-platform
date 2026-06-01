// ============================================================
//  待辦趨勢 / 熱力 / 連續日：共用純函式核心（零 npm 依賴）
//  ------------------------------------------------------------
//  dashboard/util 同 todo/util 本來各自有一套近乎逐行相同嘅
//  buildTrend / buildHeat / completionStreak。呢度抽出單一核心：
//   - completionStreak：兩邊實作完全相同，直接共用。
//   - buildTrendCore / buildHeatCore：骨架（建 N 日 bucket、localDay
//     歸日、idx 累加）一致，只差「建立 / 完成時間」嘅讀法 →
//     由呼叫方傳入 accessor（createdAtIso / completedAtIso）。
//  日期工具（localISO 歸日、addDays 推窗口）由呼叫方注入，因為
//  dashboard 用 localKey/addKey、todo 用 localISO/addDays，兩者
//  實作逐字相同，注入後輸出與各自原實作完全一致（behavior-preserving）。
// ============================================================

export interface TrendPoint {
  key: string // YYYY-MM-DD
  label: string // 日
  created: number
  completed: number
}

export interface HeatCell {
  key: string
  count: number
}

// 注入嘅本地日期工具（dashboard / todo 各自傳入自家但等價嘅實作）
export interface DateHelpers {
  /** 今日嘅本地 YYYY-MM-DD */
  todayKey: () => string
  /** key + n 日（本地，跨月年） */
  addDays: (key: string, n: number) => string
  /** 完整 ISO（UTC）轉本地 YYYY-MM-DD（避免裸 slice off-by-one） */
  localDay: (iso: string) => string
}

// ───────── 完成趨勢核心（近 N 日新增 / 完成計數，倒序窗口）─────────
export function buildTrendCore<T>(
  tasks: T[],
  days: number,
  createdAtIso: (t: T) => string,
  completedAtIso: (t: T) => string | undefined,
  dh: DateHelpers,
): TrendPoint[] {
  const today = dh.todayKey()
  const out: TrendPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = dh.addDays(today, -i)
    const [, , d] = key.split('-')
    out.push({ key, label: String(Number(d)), created: 0, completed: 0 })
  }
  const idx = new Map(out.map((p, i) => [p.key, i]))
  for (const t of tasks) {
    const ck = dh.localDay(createdAtIso(t))
    if (idx.has(ck)) out[idx.get(ck)!].created++
    const completed = completedAtIso(t)
    if (completed) {
      const dk = dh.localDay(completed)
      if (idx.has(dk)) out[idx.get(dk)!].completed++
    }
  }
  return out
}

// ───────── 完成熱力核心（近 N 日完成件數，倒序窗口）─────────
export function buildHeatCore<T>(
  tasks: T[],
  days: number,
  completedAtIso: (t: T) => string | undefined,
  dh: DateHelpers,
): HeatCell[] {
  const today = dh.todayKey()
  const counts = new Map<string, number>()
  for (const t of tasks) {
    const completed = completedAtIso(t)
    if (completed) {
      const k = dh.localDay(completed)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
  }
  const cells: HeatCell[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = dh.addDays(today, -i)
    cells.push({ key, count: counts.get(key) ?? 0 })
  }
  return cells
}

// ───────── 連續完成日數（streak，由今日／尋日起計）─────────
export function completionStreak(cells: HeatCell[]): number {
  let streak = 0
  for (let i = cells.length - 1; i >= 0; i--) {
    if (cells[i].count > 0) streak++
    else if (i === cells.length - 1) continue // 今日未做都唔斷
    else break
  }
  return streak
}
