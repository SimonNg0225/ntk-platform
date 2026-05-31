import { createCollection } from '../../../lib/store'
import type { JournalDoc } from './util'

// ============================================================
//  學習日誌 — canonical collection（單一資料源）
//  ------------------------------------------------------------
//  全 app 只可有「一個」'journal_v2' collection instance：Journal 元件
//  同學習儀表板都由呢度 import，確保寫入即時通知對方（避免重複
//  createCollection 同 key 而各自一份 in-memory store 唔同步）。
//  放喺獨立 store 檔（對齊 focus/store、notes/store），等 journal/util
//  保持零副作用、純函式。首次由舊 journal 遷移喺 Journal.tsx 處理。
// ============================================================
export const journalDocsCol = createCollection<JournalDoc>('journal_v2', [])
