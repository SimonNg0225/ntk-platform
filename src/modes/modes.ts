// ============================================================
//  模式定義 (Modes)
//  ------------------------------------------------------------
//  呢個平台核心就係「模式切換」：學習模式 vs 工作模式。
//  每個模式有自己嘅名稱、主題色、標語。
//  切換模式時，主題色會經 CSS 變數套用落成個介面。
//
//  日後想加多一個模式（例如「研究模式」）？
//  喺 MODES 加多一個項目，再喺 ModeId 加多個 id 就得。
// ============================================================

export type ModeId = 'learning' | 'work'

export interface ModeDef {
  id: ModeId
  /** 完整名稱，例如「學習模式」 */
  name: string
  /** 短名，用喺切換掣 */
  short: string
  /** 一句標語，講出呢個模式嘅目標 */
  tagline: string
  /** emoji 圖示 */
  icon: string
  /** 主色 (HEX) — 會套落 CSS 變數 --accent */
  accent: string
  /** 淺色背景 — --accent-soft */
  accentSoft: string
  /** 深色 (hover / 強調) — --accent-strong */
  accentStrong: string
  /** Hero 漸變起點 — --accent-grad-from */
  gradFrom: string
  /** Hero 漸變終點 — --accent-grad-to */
  gradTo: string
}

// 統一主題：海軍藍 × 白。
// 兩個模式用唔同濃淡嘅藍嚟分辨 —— 學習較明亮、工作較深沉。
export const MODES: Record<ModeId, ModeDef> = {
  learning: {
    id: 'learning',
    name: '學習模式',
    short: '學習',
    tagline: '提升個人知識增長',
    icon: '📘',
    accent: '#2f6cb3', // 中海軍藍（較明亮）
    accentSoft: '#e9f0f9',
    accentStrong: '#234f86',
    gradFrom: '#3a74bb',
    gradTo: '#1f4a7d',
  },
  work: {
    id: 'work',
    name: '工作模式',
    short: '工作',
    tagline: 'BAFS 教學．工作效能',
    icon: '💼',
    accent: '#1e3a5f', // 深海軍藍
    accentSoft: '#e8edf4',
    accentStrong: '#142a44',
    gradFrom: '#2b4d74',
    gradTo: '#15293f',
  },
}

/** 模式排列次序（用喺切換掣） */
export const MODE_ORDER: ModeId[] = ['learning', 'work']

/** 預設模式 */
export const DEFAULT_MODE: ModeId = 'learning'
