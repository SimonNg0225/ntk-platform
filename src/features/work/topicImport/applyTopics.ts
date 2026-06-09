import {
  topicsCol,
  questionsCol,
  progressCol,
  assessmentsCol,
  lessonPlansCol,
} from '../../../data/collections'
import { reconcileTopics, planSummary, type TopicInput, type ApplyResult } from './reconcile'

// ============================================================
//  Smart 套用課題 — 執行 reconcile 計劃喺 topicsCol
//  同名保留 id（題庫/進度/評估/備課 連繫唔甩）；舊有有資料連住就保留，否則清走。
// ============================================================

function referencedIds(): Set<string> {
  const ids = new Set<string>()
  for (const q of questionsCol.get()) ids.add(q.topicId)
  for (const p of progressCol.get()) ids.add(p.topicId)
  for (const a of assessmentsCol.get()) if (a.topicId) ids.add(a.topicId)
  for (const l of lessonPlansCol.get()) if (l.topicId) ids.add(l.topicId)
  return ids
}

export function smartApplyTopics(next: TopicInput[]): ApplyResult {
  const existing = topicsCol.get().map((t) => ({ id: t.id, topic: t.topic }))
  const refs = referencedIds()
  const plan = reconcileTopics(existing, next, (id) => refs.has(id))

  plan.updates.forEach((u) =>
    topicsCol.update(u.id, { part: u.part, area: u.area, topic: u.topic, order: u.order }),
  )
  plan.keeps.forEach((k) => topicsCol.update(k.id, { order: k.order }))
  plan.adds.forEach((a) =>
    topicsCol.add({ part: a.part, area: a.area, topic: a.topic, order: a.order }),
  )
  plan.removes.forEach((id) => topicsCol.remove(id))

  return planSummary(plan)
}
