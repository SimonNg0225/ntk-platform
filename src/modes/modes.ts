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
}

export const MODES: Record<ModeId, ModeDef> = {
  learning: {
    id: 'learning',
    name: '學習模式',
    short: '學習',
    tagline: '提升個人知識增長',
    icon: '📚',
    accent: '#0f9d6b', // emerald
    accentSoft: '#e6f6ef',
    accentStrong: '#0a7a52',
  },
  work: {
    id: 'work',
    name: '工作模式',
    short: '工作',
    tagline: 'BAFS 教學．工作效能',
    icon: '💼',
    accent: '#3b5bdb', // indigo
    accentSoft: '#eaeefb',
    accentStrong: '#2f48ad',
  },
}

/** 模式排列次序（用喺切換掣） */
export const MODE_ORDER: ModeId[] = ['learning', 'work']

/** 預設模式 */
export const DEFAULT_MODE: ModeId = 'learning'
