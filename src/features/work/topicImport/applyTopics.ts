import {
  topicsCol,
  questionsCol,
  lessonPlansCol,
} from '../../../data/collections'
import { getSubjectPack, missingTopicsForSubjects } from '../../../data/subjects'
import {
  reconcileTopics,
  planSummary,
  planDedupe,
  planAppendByText,
  type TopicInput,
  type ApplyResult,
} from './reconcile'

// ============================================================
//  Smart 套用課題 — 執行 reconcile 計劃在 topicsCol
//  同名保留 id（題庫/備課 連繫不甩）；舊有有資料連住就保留，否則清走。
// ============================================================

function referencedIds(): Set<string> {
  const ids = new Set<string>()
  for (const q of questionsCol.get()) ids.add(q.topicId)
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

// ============================================================
//  任教科目 → 課題自動同步（additive · load-once）
//  ------------------------------------------------------------
//  老師在個人資料選擇任教科目後，自動將該科 pack 課題補入 topicsCol，
//  令「課程進度 / 備課 / AI 教案」立即選擇得到。設計上不搞 smartApply 嗰套
//  replace（怕誤刪手動課題）：純 additive，而且每科只自動載入一次
//  （記低在 localStorage），之後老師自由增刪都不會被翻撈返。
// ============================================================
const SYNCED_SUBJECTS_KEY = 'ntk.topics_synced_subjects'

function syncedSubjectIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SYNCED_SUBJECTS_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function markSubjectsSynced(ids: string[]): void {
  try {
    const s = syncedSubjectIds()
    ids.forEach((id) => s.add(id))
    localStorage.setItem(SYNCED_SUBJECTS_KEY, JSON.stringify([...s]))
  } catch {
    /* ignore */
  }
}

/**
 * 將 subjectIds 中「未自動載入過」的科目課題補入 topicsCol。
 * - additive：只加不減（按文字 / id 去重，不會整 legacy/拆科課題重覆）。
 * - load-once：每科記低已同步，重複呼叫（每次開首頁）都係 no-op。
 * - 保留 pack id（令分組 / 題庫連繫對得返）；order 接在現有最大值之後。
 * 回傳實際新增的課題數。
 */
export function loadTopicsForSubjects(subjectIds: string[]): number {
  const done = syncedSubjectIds()
  const fresh = subjectIds.filter(
    (id) => Boolean(id) && !done.has(id) && Boolean(getSubjectPack(id)),
  )
  if (fresh.length === 0) return 0

  const existing = topicsCol.get()
  const toAdd = missingTopicsForSubjects(existing, fresh)
  let order = existing.reduce((m, t) => Math.max(m, t.order), 0)
  for (const t of toAdd) {
    order += 1
    topicsCol.add({ id: t.id, part: t.part, area: t.area, topic: t.topic, order })
  }
  markSubjectsSynced(fresh) // 即使 toAdd 為空（已存在）都標記，避免下次再掃
  return toAdd.length
}

// ============================================================
//  附加課題（按課題名去重）— Settings / TopicImport 「附加」共用
//  ------------------------------------------------------------
//  舊版「附加」只 by id 去重（或沒有去重），但同一課題在不同 flow 會有不同
//  id（pack id vs 隨機 uid），令同名課題重複入庫。改為按課題名 norm 去重。
//  incoming 帶 id 就保留（維持 pack 分組）；回傳實際新增數。
// ============================================================
export function appendTopicsByText(incoming: (TopicInput & { id?: string })[]): number {
  const toAdd = planAppendByText(topicsCol.get(), incoming)
  for (const a of toAdd) {
    topicsCol.add({ id: a.id, part: a.part, area: a.area, topic: a.topic, order: a.order })
  }
  return toAdd.length
}

// ============================================================
//  去重整理 topicsCol（self-heal）
//  ------------------------------------------------------------
//  剷走同名（norm）又沒有資料連住的重複課題；referenced 的一律保留不郁，
//  不會斷開題庫／備課的連繫。每次開首頁跑一次，止住歷史污染。
//  回傳實際剷走數。
// ============================================================
export function dedupeTopicsCol(): number {
  const refs = referencedIds()
  const removeIds = planDedupe(topicsCol.get(), (id) => refs.has(id))
  removeIds.forEach((id) => topicsCol.remove(id))
  return removeIds.length
}
