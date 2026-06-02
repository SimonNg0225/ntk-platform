import { createCollection, uid, type Entity } from '../../../lib/store'

// ============================================================
//  Notes（Apple Notes / Notion 級）— 功能專屬資料層
//  ------------------------------------------------------------
//  共用 data/types 嘅 Note 只有 { content, createdAt }，太薄。
//  呢度自定義較豐富嘅 RichNote + 自己嘅 collection（自動存
//  localStorage），唔掂任何共用檔。
//  欄位刻意對齊將來 Supabase 表（id/createdAt/updatedAt）。
// ============================================================

// ───────── 資料夾（筆記本）─────────
export interface Notebook extends Entity {
  name: string
  color: string // FOLDER_COLOR key
  createdAt: string
}

// ───────── 筆記 ─────────
export interface RichNote extends Entity {
  title: string // 標題（可空，會由內文首行推導顯示）
  content: string // 內文（支援 #標籤、- [ ] 待辦行）
  notebookId: string | null // 所屬筆記本；null = 未分類
  pinned: boolean // 釘選（置頂）
  favorite: boolean // 星標
  archived: boolean // 封存（離開主列表，可還原）
  trashed: boolean // 垃圾桶（可還原 / 永久刪）
  color: string // 卡片色標（NOTE_COLOR key；'none' = 預設）
  createdAt: string // ISO
  updatedAt: string // ISO（每次編輯更新；排序 / 統計用）
}

// ───────── 色票 ─────────
export const FOLDER_COLORS = {
  slate: { label: '石板', dot: 'bg-slate-400', text: 'text-slate-600 dark:text-slate-300' },
  accent: { label: '海軍藍', dot: 'bg-accent', text: 'text-accent-strong dark:text-accent' },
  blue: { label: '藍', dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-300' },
  green: { label: '綠', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-300' },
  amber: { label: '橙', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-300' },
  rose: { label: '紅', dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-300' },
  violet: { label: '紫', dot: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-300' },
  cyan: { label: '青', dot: 'bg-cyan-500', text: 'text-cyan-600 dark:text-cyan-300' },
} as const
export type FolderColor = keyof typeof FOLDER_COLORS
export const FOLDER_COLOR_KEYS = Object.keys(FOLDER_COLORS) as FolderColor[]
export function folderColorOf(c: string | undefined) {
  return FOLDER_COLORS[c as FolderColor] ?? FOLDER_COLORS.slate
}

// 筆記卡片色標（柔和底色，配深色變體）
export const NOTE_COLORS = {
  none: { label: '無', swatch: 'bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-600', card: '' },
  amber: { label: '黃', swatch: 'bg-amber-300', card: 'bg-amber-50/70 dark:bg-amber-500/10 border-amber-200/70 dark:border-amber-500/20' },
  rose: { label: '粉', swatch: 'bg-rose-300', card: 'bg-rose-50/70 dark:bg-rose-500/10 border-rose-200/70 dark:border-rose-500/20' },
  green: { label: '綠', swatch: 'bg-emerald-300', card: 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200/70 dark:border-emerald-500/20' },
  blue: { label: '藍', swatch: 'bg-blue-300', card: 'bg-blue-50/70 dark:bg-blue-500/10 border-blue-200/70 dark:border-blue-500/20' },
  violet: { label: '紫', swatch: 'bg-violet-300', card: 'bg-violet-50/70 dark:bg-violet-500/10 border-violet-200/70 dark:border-violet-500/20' },
} as const
export type NoteColor = keyof typeof NOTE_COLORS
export const NOTE_COLOR_KEYS = Object.keys(NOTE_COLORS) as NoteColor[]
export function noteColorOf(c: string | undefined) {
  return NOTE_COLORS[c as NoteColor] ?? NOTE_COLORS.none
}

// ───────── Collections（唯一 key，自動存 localStorage）─────────
function nowIso() {
  return new Date().toISOString()
}

export const notebooksCol = createCollection<Notebook>('notes_notebooks_v2', [
  { id: 'nb-bafs', name: 'BAFS 商業管理', color: 'accent', createdAt: nowIso() },
  { id: 'nb-ideas', name: '靈感速記', color: 'amber', createdAt: nowIso() },
])

export const richNotesCol = createCollection<RichNote>('notes_rich_v2', seedNotes())

// ───────── 儲存篩選（智能檢視）─────────
export interface SavedFilter extends Entity {
  name: string // 顯示名（預設由標籤／關鍵字推導）
  query: string // 關鍵字
  tag: string | null // 標籤篩選
  createdAt: string
}
export const savedFiltersCol = createCollection<SavedFilter>('notes_saved_filters_v1', [])

function seedNotes(): RichNote[] {
  const t = Date.now()
  const mk = (
    n: number,
    over: Partial<RichNote> & { title: string; content: string },
  ): RichNote => ({
    id: uid(),
    title: over.title,
    content: over.content,
    notebookId: over.notebookId ?? null,
    pinned: over.pinned ?? false,
    favorite: over.favorite ?? false,
    archived: false,
    trashed: false,
    color: over.color ?? 'none',
    createdAt: new Date(t - n * 86_400_000).toISOString(),
    updatedAt: new Date(t - n * 43_200_000).toISOString(),
  })
  return [
    mk(0, {
      title: '市場營銷 4P',
      notebookId: 'nb-bafs',
      pinned: true,
      favorite: true,
      color: 'amber',
      content:
        '市場營銷組合 #marketing #bafs\n\n- [x] Product 產品\n- [x] Price 價格\n- [ ] Place 地點 / 通路\n- [ ] Promotion 推廣\n\n重點：4P 要互相配合，先有一致嘅市場定位。',
    }),
    mk(2, {
      title: 'SWOT 分析框架',
      notebookId: 'nb-bafs',
      content:
        'SWOT #strategy #bafs\n\nStrengths 優勢 / Weaknesses 劣勢（內部）\nOpportunities 機會 / Threats 威脅（外部）\n\n用嚟做企業策略前嘅環境掃描。',
    }),
    mk(5, {
      title: '一本好書：深度工作',
      notebookId: 'nb-ideas',
      favorite: true,
      content:
        '《Deep Work》重點 #reading\n\n專注力係稀缺資源。安排「無干擾時段」，關通知，集中處理高認知工作。\n\n- [ ] 試行每日 90 分鐘深度時段\n- [ ] 記錄每週深度工作小時',
    }),
    mk(9, {
      title: '隨手靈感',
      content: '可以整一個自己嘅溫習計劃表 app #idea\n配合番茄鐘同知識卡。',
    }),
  ]
}
