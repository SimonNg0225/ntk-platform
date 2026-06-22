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

// ============================================================
//  去重（dedupe）— 純函式
//  ------------------------------------------------------------
//  同一課題（按課題名 norm 去重）唔同 flow 會有唔同 id（pack id `chin-01`
//  vs smartApply / 手動附加嘅隨機 uid），令「淨係 by id」去重漏網、重複入庫。
//  呢度按課題名揾出要剷走嘅「重複垃圾」：
//   · 有資料連住（referenced）嘅一律保留（題庫／進度等唔斷連）；
//   · 同名又冇資料連住嘅多出條 → 剷（保留首條佔位嗰個）。
//  回傳要移除嘅 id 清單。純函式，唔掂 collection。
// ============================================================
export function planDedupe(
  topics: { id: string; topic: string }[],
  isReferenced: (id: string) => boolean,
): string[] {
  const seen = new Set<string>()
  // referenced 條一律保留並先佔位（佢哋係 canonical）
  for (const t of topics) {
    const k = norm(t.topic)
    if (k && isReferenced(t.id)) seen.add(k)
  }
  const remove: string[] = []
  for (const t of topics) {
    const k = norm(t.topic)
    if (!k || isReferenced(t.id)) continue
    if (seen.has(k)) remove.push(t.id)
    else seen.add(k)
  }
  return remove
}

// ============================================================
//  附加（append）— 純函式，按課題名去重
//  ------------------------------------------------------------
//  「附加」課題時跳過同名（norm）已存在嘅，回傳實際要 add 嘅項（order 接喺
//  現有最大值之後）。incoming 帶 id 就保留（維持 pack 分組），冇就由 store 補。
// ============================================================
export function planAppendByText(
  existing: { topic: string; order: number }[],
  incoming: (TopicInput & { id?: string })[],
): (TopicInput & { id?: string; order: number })[] {
  const have = new Set(existing.map((t) => norm(t.topic)))
  let order = existing.reduce((m, t) => Math.max(m, t.order), 0)
  const out: (TopicInput & { id?: string; order: number })[] = []
  for (const it of incoming) {
    const k = norm(it.topic)
    if (!k || have.has(k)) continue
    have.add(k)
    order += 1
    out.push({ id: it.id, part: it.part, area: it.area, topic: it.topic, order })
  }
  return out
}
