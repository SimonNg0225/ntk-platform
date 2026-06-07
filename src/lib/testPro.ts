// ============================================================
//  測試 Pro（推廣代碼）
//  ------------------------------------------------------------
//  ⚠️ 純前端測試機制：輸入代碼「NTK」即本機解鎖 Pro 體驗，方便未接
//  金錢付款前試 Pro UI / 功能 gating。唔會寫雲端訂閱、唔會繞過伺服器
//  端額度（Gemini 額度仍按真實訂閱）。之後接好 Stripe 即取代。
// ============================================================

const KEY = 'ntk.testPro'
const TEST_CODE = 'NTK'
const EVENT = 'ntk:testpro'

export function hasTestPro(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function set(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  // 通知同頁 useSubscription 即時更新（storage event 只跨分頁）
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

/** 套用推廣代碼；啱「NTK」就解鎖測試 Pro，回 true。 */
export function redeemTestCode(code: string): boolean {
  if (code.trim().toUpperCase() === TEST_CODE) {
    set(true)
    return true
  }
  return false
}

export function clearTestPro(): void {
  set(false)
}

/** 畀 React 訂閱測試 Pro 變化（同頁 custom event + 跨分頁 storage）。 */
export function onTestProChange(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}
