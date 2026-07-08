// ============================================================
//  外觀 / 可達性偏好 — 純邏輯核心
//  ------------------------------------------------------------
//  設定外觀區除了主題，還有兩個純 CSS 開關（預設關＝行為完全不變）：
//    - reduceMotion：減少動態效果。套 .reduce-motion 到 <html>，CSS 將
//      transition / animation 收到極短，對不想太多動畫的用戶友好。
//    - compactDensity：緊湊密度。套 .density-compact 到 <html>，收窄主內容
//      容器的 padding，一屏查看到多些。
//  ------------------------------------------------------------
//  這個 module 只負責純計算（正規化未知輸入 + 由偏好推導應套用的 html class
//  清單），不掂 DOM / store，方便用 vitest 單元測試。實際 toggle class 的
//  side-effect 留在 SettingsContext（同 .dark 一起套）。
// ============================================================

/** 外觀可達性偏好（純資料；預設全 false＝同未加功能前一模一樣） */
export interface AppearancePrefs {
  /** 減少動態效果（套 .reduce-motion） */
  reduceMotion: boolean
  /** 緊湊密度（套 .density-compact） */
  compactDensity: boolean
}

export const APPEARANCE_DEFAULTS: AppearancePrefs = {
  reduceMotion: false,
  compactDensity: false,
}

/** html class 名（同 index.css 的 selector 對齊；集中在這裡避免散落字串） */
export const REDUCE_MOTION_CLASS = 'reduce-motion'
export const COMPACT_DENSITY_CLASS = 'density-compact'

/**
 * 將「可能係任何嘢」的原始值（localStorage 反序列化 / 舊版設定缺欄位）正規化成
 * 嚴格 boolean。只有真正 === true 先當開，其餘（undefined / null / 0 / 'false'
 * 等壞值）一律 fallback 做預設關 —— 確保「未設定過」同「壞資料」都係不變行為。
 */
export function normalizeAppearancePrefs(
  raw: Partial<Record<keyof AppearancePrefs, unknown>> | null | undefined,
): AppearancePrefs {
  return {
    reduceMotion: raw?.reduceMotion === true,
    compactDensity: raw?.compactDensity === true,
  }
}

/**
 * 由偏好推導應套用在 <html> 的 class 清單。
 * 預設（全關）→ 空陣列（即不加任何 class，行為不變）。
 * 次序固定（reduce-motion 先、density-compact 後），方便測試同 diff 穩定。
 */
export function appearanceHtmlClasses(prefs: AppearancePrefs): string[] {
  const classes: string[] = []
  if (prefs.reduceMotion) classes.push(REDUCE_MOTION_CLASS)
  if (prefs.compactDensity) classes.push(COMPACT_DENSITY_CLASS)
  return classes
}

/**
 * 切換單一偏好（immutable，回新物件），方便 UI／reducer 用。
 * 傳 next 可指定目標值；不傳就 toggle 反轉。
 */
export function setAppearancePref(
  prefs: AppearancePrefs,
  key: keyof AppearancePrefs,
  next?: boolean,
): AppearancePrefs {
  return { ...prefs, [key]: next ?? !prefs[key] }
}
