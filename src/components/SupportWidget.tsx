import { useEffect } from 'react'
import { getConsent } from '../lib/observability'
import { loadCrisp } from '../lib/support'

// 客服 widget 載入器：已同意 Cookie 嘅回訪用戶，掛載時即載 Crisp。
// 首次喺 Cookie 橫額「接受」嗰刻會即時載（見 CookieConsent）。未配置 → no-op。
export default function SupportWidget() {
  useEffect(() => {
    if (getConsent() === 'accepted') loadCrisp()
  }, [])
  return null
}
