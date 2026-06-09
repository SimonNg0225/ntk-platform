// ============================================================
//  Smart 切換課題 — 純函式調和（reconcile）
//  ------------------------------------------------------------
//  按「課題名」配對：
//   · 同名 → 保留原 id（題庫／進度／評估／備課 嘅連繫唔甩）
//   · 新版有、舊冇 → 新增
//   · 舊有、新版冇 → 有資料連住就保留（排到後面），否則刪走（清走垃圾）
//  純函式，唔掂 collection，方便單元測試。
// ============================================================

export interface TopicInput {
  part: string
  area: string
  topic: string
}
export interface ExistingTopic {
  id: string
  topic: string
}

export interface ReconcilePlan {
  /** 同名配對 → 更新（保留 id）*/
  updates: { id: string; part: string; area: string; topic: string; order: number }[]
  /** 新增 */
  adds: { part: string; area: string; topic: string; order: number }[]
  /** 舊有但新版冇、又有資料連住 → 保留（更新 order 排後面）*/
  keeps: { id: string; order: number }[]
  /** 舊有但新版冇、又無資料連住 → 刪走 */
  removes: string[]
}

export interface ApplyResult {
  matched: number
  added: number
  kept: number
  removed: number
}

function norm(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase()
}

export function reconcileTopics(
  existing: ExistingTopic[],
  next: TopicInput[],
  isReferenced: (id: string) => boolean,
): ReconcilePlan {
  // 同名 → 現有 id（首個為準）
  const byName = new Map<string, string>()
  for (const e of existing) {
    const k = norm(e.topic)
    if (k && !byName.has(k)) byName.set(k, e.id)
  }

  const used = new Set<string>()
  const updates: ReconcilePlan['updates'] = []
  const adds: ReconcilePlan['adds'] = []

  next.forEach((it, i) => {
    const order = i + 1
    const id = byName.get(norm(it.topic))
    if (id && !used.has(id)) {
      used.add(id)
      updates.push({ id, part: it.part, area: it.area, topic: it.topic, order })
    } else {
      adds.push({ part: it.part, area: it.area, topic: it.topic, order })
    }
  })

  const keeps: ReconcilePlan['keeps'] = []
  const removes: string[] = []
  let tail = next.length
  for (const e of existing) {
    if (used.has(e.id)) continue
    if (isReferenced(e.id)) keeps.push({ id: e.id, order: ++tail })
    else removes.push(e.id)
  }

  return { updates, adds, keeps, removes }
}

export function planSummary(plan: ReconcilePlan): ApplyResult {
  return {
    matched: plan.updates.length,
    added: plan.adds.length,
    kept: plan.keeps.length,
    removed: plan.removes.length,
  }
}
