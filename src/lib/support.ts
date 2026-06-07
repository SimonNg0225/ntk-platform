// ============================================================
//  客服 widget（Crisp）
//  ------------------------------------------------------------
//  未設 VITE_CRISP_WEBSITE_ID → 完全 no-op。
//  Crisp 會設 cookie，故同 analytics 一樣受 Cookie 同意 gating：
//  用戶「接受」後先載入。
// ============================================================

const CRISP_ID = import.meta.env.VITE_CRISP_WEBSITE_ID as string | undefined

export const isSupportConfigured = Boolean(CRISP_ID)

let loaded = false

export function loadCrisp(): void {
  if (!CRISP_ID || loaded || typeof document === 'undefined') return
  loaded = true
  const w = window as unknown as {
    $crisp: unknown[]
    CRISP_WEBSITE_ID: string
  }
  w.$crisp = []
  w.CRISP_WEBSITE_ID = CRISP_ID
  const s = document.createElement('script')
  s.id = 'crisp-script'
  s.src = 'https://client.crisp.chat/l.js'
  s.async = true
  document.head.appendChild(s)
}
