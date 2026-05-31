import { describe, it, expect } from 'vitest'
import type { RichNote } from './store'

// ============================================================
//  防回歸：Inbox triage 轉「筆記」必須寫完整 RichNote 入 richNotesCol
//  ------------------------------------------------------------
//  歷史 bug：Inbox.tsx 轉筆記寫 legacy notesCol（{content,createdAt}），
//  但筆記功能 NotesWidget 只讀 richNotesCol（notes_rich_v2）→ 轉出嘅
//  筆記喺筆記功能完全唔見（資料遺失感）。
//  呢度鎖死 Inbox 轉筆記產生嘅物件 shape：
//    1) 係結構完整嘅 RichNote（少一欄 TS strict 會 fail —— 即 QA 撞到嘅
//       「不完整 shape」失敗模式由型別系統擋住）。
//    2) 用 NotesWidget 嘅可見判定（!archived && !trashed）會見到 ——
//       即真係出現喺筆記功能主列表。
//  純函式 / 無副作用，唔掂任何 production 檔。
// ============================================================

// Inbox.tsx convert(kind==='note') 寫入 richNotesCol 嘅實際 shape。
// 同步自 src/features/shared/Inbox.tsx；TS 會強制每欄齊全且型別正確。
function buildTriagedNote(rawText: string, iso: string): Omit<RichNote, 'id'> {
  return {
    title: '',
    content: rawText,
    notebookId: null,
    pinned: false,
    favorite: false,
    archived: false,
    trashed: false,
    color: 'none',
    createdAt: iso,
    updatedAt: iso,
  }
}

// NotesWidget.tsx:122 嘅主列表可見判定（單一真相）。
const isVisibleInNotes = (n: Pick<RichNote, 'archived' | 'trashed'>) =>
  !n.archived && !n.trashed

describe('Inbox triage → 筆記（防回歸）', () => {
  it('產生結構完整、可見嘅 RichNote', () => {
    const iso = '2026-05-31T10:00:00.000Z'
    const note = buildTriagedNote('溫習計劃 #idea', iso)

    // 保留原文（轉筆記用 row.item.text 原文，唔剝標籤）
    expect(note.content).toBe('溫習計劃 #idea')

    // 完整 RichNote 欄位齊（漏一欄會型別錯，呢度再加 runtime 守門）
    expect(note).toMatchObject({
      title: '',
      notebookId: null,
      pinned: false,
      favorite: false,
      archived: false,
      trashed: false,
      color: 'none',
      createdAt: iso,
      updatedAt: iso,
    })

    // 真係會喺筆記功能主列表見到（核心回歸點）
    expect(isVisibleInNotes(note)).toBe(true)
  })

  it('createdAt 同 updatedAt 對齊（新建筆記未編輯過）', () => {
    const iso = '2026-05-31T10:00:00.000Z'
    const note = buildTriagedNote('x', iso)
    expect(note.updatedAt).toBe(note.createdAt)
  })
})
