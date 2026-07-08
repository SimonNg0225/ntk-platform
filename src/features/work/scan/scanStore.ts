// ============================================================
//  掃描 → 資源庫登記（去向②③）
//  ------------------------------------------------------------
//  共用 resourcesCol / Resource 型別「不可改」。掃描出來的 PDF 係本機
//  blob —— 資源庫只存 metadata + 連結（無 blob 儲存；Google Drive 係
//  drive.readonly 不可上載），所以「存資源庫」只登記一條 metadata row
//  （無 url），同時在呼叫端照樣下載個 PDF 給用戶留底。
// ============================================================

import { resourcesCol } from '../../../data/collections'
import type { Resource } from '../../../data/types'

/** 掃描資源固定用 'note' 類型（ResourceType 既有值；代表本機掃描筆記 / 文件）。 */
export const SCAN_RESOURCE_TYPE: Resource['type'] = 'note'

/** 標記呢條係掃描來的資源（給搜尋 / 篩選認得出）。 */
export const SCAN_TAG = '掃描'

export interface RegisterScanInput {
  /** 資源標題（通常 = 輸出檔名 base） */
  title: string
  /** 額外備註（選填） */
  note?: string
  /** 雲端 PDF 連結（有就資源庫可直接 click 開；無 = 本機降級） */
  url?: string
  /** 雲端 Storage 路徑（記低，將來可重簽連結） */
  storagePath?: string
}

/**
 * 在資源庫登記一條掃描 metadata（無 url —— 檔案在呼叫端另行下載留底）。
 * 回傳新建的 Resource。
 */
export function registerScanResource(input: RegisterScanInput): Resource {
  const title = input.title.trim() || '掃描文件'

  // tags：掃描標記（方便在資源庫用標籤篩選）
  const tags = [SCAN_TAG]

  // notes：人類可讀來源說明
  const noteParts: string[] = []
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
    // url 有就存（資源庫可直接開）；無就不放這個欄位（Resource.url 選填）。
    ...(input.url ? { url: input.url } : {}),
    tags,
    notes,
    createdAt: new Date().toISOString(),
  })
}
