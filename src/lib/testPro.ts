// ============================================================
//  測試 Pro（推廣代碼）
//  ------------------------------------------------------------
//  ⚠️ 只限本地開發模式：方便未接付款前試 Pro UI / 功能 gating。
//  Production bundle 必須不提供 client-side 解鎖，避免變成收入漏洞。
// ============================================================

const KEY = 'ntk.testPro'
const TEST_CODE = import.meta.env.DEV
  ? ((import.meta.env.VITE_TEST_PRO_CODE as string | undefined) ?? 'NTK')
      .trim()
      .toUpperCase()
  : ''
const EVENT = 'ntk:testpro'

export const isTestProEnabled = import.meta.env.DEV && Boolean(TEST_CODE)

export function hasTestPro(): boolean {
  if (!isTestProEnabled) return false
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

/** 套用推廣代碼；適合「NTK」就解鎖測試 Pro，回 true。 */
export function redeemTestCode(code: string): boolean {
  if (!isTestProEnabled) return false
  if (code.trim().toUpperCase() === TEST_CODE) {
    set(true)
    return true
  }
  return false
}

export function clearTestPro(): void {
  set(false)
}

/** 給 React 訂閱測試 Pro 變化（同頁 custom event + 跨分頁 storage）。 */
export function onTestProChange(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}
