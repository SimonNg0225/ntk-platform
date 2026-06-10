// ============================================================
//  掃描 → 資源庫登記（去向②③）
//  ------------------------------------------------------------
//  共用 resourcesCol / Resource 型別「不可改」。掃描出嚟嘅 PDF 係本機
//  blob —— 資源庫只存 metadata + 連結（無 blob 儲存；Google Drive 係
//  drive.readonly 唔可上載），所以「存資源庫」只登記一條 metadata row
//  （無 url），同時喺呼叫端照樣下載個 PDF 畀用戶留底。
//  班級／學生綁定純粹寫入 tags / notes（唔加新欄位，向後相容）。
// ============================================================

import { resourcesCol, classesCol, studentsCol } from '../../../data/collections'
import type { Resource } from '../../../data/types'

/** 掃描資源固定用 'note' 類型（ResourceType 既有值；代表本機掃描筆記 / 文件）。 */
export const SCAN_RESOURCE_TYPE: Resource['type'] = 'note'

/** 標記呢條係掃描嚟嘅資源（畀搜尋 / 篩選認得出）。 */
export const SCAN_TAG = '掃描'

export interface RegisterScanInput {
  /** 資源標題（通常 = 輸出檔名 base） */
  title: string
  /** 綁定班級（選填）；會記低班名 + classId */
  classId?: string
  /** 綁定學生（選填，須先有 classId）；會記低學生名 + studentId */
  studentId?: string
  /** 額外備註（選填） */
  note?: string
  /** 雲端 PDF 連結（有就資源庫可直接 click 開；無 = 本機降級） */
  url?: string
  /** 雲端 Storage 路徑（記低，將來可重簽連結） */
  storagePath?: string
}

/** 由 classId / studentId 砌人類可讀標籤（班名、學生名），搵唔到就回 undefined。 */
function classLabel(classId?: string): string | undefined {
  if (!classId) return undefined
  return classesCol.get().find((k) => k.id === classId)?.name
}
function studentLabel(studentId?: string): string | undefined {
  if (!studentId) return undefined
  return studentsCol.get().find((s) => s.id === studentId)?.name
}

/**
 * 喺資源庫登記一條掃描 metadata（無 url —— 檔案喺呼叫端另行下載留底）。
 * 班級／學生資訊寫入 tags（畀篩選）+ notes（畀人睇），唔加新欄位。
 * 回傳新建嘅 Resource。
 */
export function registerScanResource(input: RegisterScanInput): Resource {
  const title = input.title.trim() || '掃描文件'

  // tags：掃描標記 + 班名 / 學生名（方便喺資源庫用標籤篩選）
  const tags = [SCAN_TAG]
  const cls = classLabel(input.classId)
  const stu = studentLabel(input.studentId)
  if (cls) tags.push(cls)
  if (stu) tags.push(stu)

  // notes：人類可讀來源說明 + ID（畀將來程式對返班 / 學生）
  const noteParts: string[] = []
  if (cls) noteParts.push(`班級：${cls}${input.classId ? `（${input.classId}）` : ''}`)
  if (stu) noteParts.push(`學生：${stu}${input.studentId ? `（${input.studentId}）` : ''}`)
  if (input.note?.trim()) noteParts.push(input.note.trim())
  noteParts.push(
    input.url
      ? '來源：相機掃描（已存雲端 Supabase Storage）'
      : '來源：相機掃描（本機檔案，已另存下載）',
  )
  if (input.storagePath) noteParts.push(`雲端路徑：${input.storagePath}`)
  const notes = noteParts.join('\n')

  return resourcesCol.add({
    title,
    type: SCAN_RESOURCE_TYPE,
    // url 有就存（資源庫可直接開）；無就唔放呢個欄位（Resource.url 選填）。
    ...(input.url ? { url: input.url } : {}),
    tags,
    notes,
    createdAt: new Date().toISOString(),
  })
}
