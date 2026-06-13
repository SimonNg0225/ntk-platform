import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { needsRegistration, getMyDisplayName } from '../../lib/profile'
import ProfileSetupModal from './ProfileSetupModal'

// ============================================================
//  登記閘：已登入但未完成首次登記嘅用戶，彈出 ProfileSetupModal。
//  - 訪客 / 未接 Supabase / 已登記 → 唔出。
//  - needsRegistration 任何錯誤一律當「唔使登記」，唔阻住用戶。
// ============================================================

export default function ProfileGate() {
  const { user, configured, loading } = useAuth()
  const { setDisplayName } = useSettings()
  const [open, setOpen] = useState(false)

  const uid = user?.id
  useEffect(() => {
    if (!configured || loading || !uid) {
      setOpen(false)
      return
    }
    let cancelled = false
    needsRegistration()
      .then((need) => {
        if (!cancelled) setOpen(need)
      })
      .catch(() => {})
    // 已登記用戶：用 Supabase canonical 署名 hydrate 本機歡迎訊息（失敗無聲忽略）。
    getMyDisplayName()
      .then((n) => {
        if (!cancelled && n) setDisplayName(n)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [configured, loading, uid])

  if (!open) return null
  return <ProfileSetupModal open={open} onDone={() => setOpen(false)} />
}
