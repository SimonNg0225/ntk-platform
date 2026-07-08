// ============================================================
//  示範資料聚合器
//  ------------------------------------------------------------
//  各功能在自己資料夾的 demo.ts export seedDemo()（idempotent —
//  只在該 collection 係空先種）。這裡集中一次過叫全部，給首次
//  onboarding 同設定頁「載入示範資料」用。
// ============================================================
// 動態載入各功能 seeder（不 eager import，避免把功能 store 拉入主 bundle；
// 示範資料只係一次性動作，按「載入」先至載入這些 code）。
const SEEDER_LOADERS: (() => Promise<{ seedDemo: () => number }>)[] = [
  () => import('../features/learning/notes/demo'),
  () => import('../features/learning/goals/demo'),
  () => import('../features/learning/habits/demo'),
  () => import('../features/learning/journal/demo'),
  () => import('../features/learning/reading/demo'),
  () => import('../features/learning/health/demo'),
  () => import('../features/learning/fitness/body/demo'),
  () => import('../features/learning/fitness/training/demo'),
  () => import('../features/learning/fitness/nutrition/demo'),
  () => import('../features/work/todo/demo'),
]

/**
 * 載入示範資料：動態載入並逐個功能 seed（各自 idempotent，只在空時種）。
 * 單一功能拋錯不影響其餘。回傳總共新增的 row 數。
 */
export async function seedAllDemo(): Promise<number> {
  const mods = await Promise.all(SEEDER_LOADERS.map((load) => load().catch(() => null)))
  let total = 0
  for (const m of mods) {
    if (!m) continue
    try {
      total += m.seedDemo() || 0
    } catch {
      /* 個別功能失敗：略過，繼續其餘 */
    }
  }
  return total
}

// ───────── 首次使用（onboarding）標記 ─────────
const ONBOARD_KEY = 'ntk.onboarded_v1'

export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARD_KEY) === '1'
  } catch {
    return true // 讀不到就當查看過，不要阻住用戶
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARD_KEY, '1')
  } catch {
    /* ignore */
  }
}
