// ============================================================
//  模式定義 (Modes)
//  ------------------------------------------------------------
//  呢個平台核心就係「模式切換」：個人模式 vs 工作模式。
//  每個模式有自己嘅名稱、主題色、標語。
//  切換模式時，主題色會經 CSS 變數套用落成個介面。
//
//  日後想加多一個模式（例如「研究模式」）？
//  喺 MODES 加多一個項目，再喺 ModeId 加多個 id 就得。
// ============================================================

export type ModeId = 'learning' | 'work'

export interface ModeDef {
  id: ModeId
  /** 完整名稱，例如「個人模式」 */
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

// 雙模式主色（「Indigo × Teal on Slate」配色方案）：
// 個人＝靛藍 indigo（learning indigo + progress green），工作＝青藍 teal（teal focus）。
// 兩色都係「學習＋生產力」類產品嘅典型主色，一眼分得出兩個模式；中性色用 slate（喺 index.css）。
export const MODES: Record<ModeId, ModeDef> = {
  learning: {
    id: 'learning',
    name: '個人模式',
    short: '個人',
    tagline: '記錄生活，持續成長',
    icon: '📘',
    accent: '#4f46e5', // indigo-600
    accentSoft: '#eef2ff', // indigo-50
    accentStrong: '#4338ca', // indigo-700
    gradFrom: '#6366f1', // indigo-500
    gradTo: '#4338ca', // indigo-700
  },
  work: {
    id: 'work',
    name: '工作模式',
    short: '工作',
    tagline: '備課、批改、成績、家長溝通　一站搞掂',
    icon: '💼',
    accent: '#0d9488', // teal-600
    accentSoft: '#f0fdfa', // teal-50
    accentStrong: '#0f766e', // teal-700
    gradFrom: '#14b8a6', // teal-500
    gradTo: '#0f766e', // teal-700
  },
}

/** 模式排列次序（用喺切換掣）。工作行先 → 對應商業化主打教師市場。 */
export const MODE_ORDER: ModeId[] = ['work', 'learning']

/** 預設模式 —— 商業化對象係全港老師，預設入「工作模式」。 */
export const DEFAULT_MODE: ModeId = 'work'
