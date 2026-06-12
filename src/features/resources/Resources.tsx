// ============================================================
//  資源分享區 — 主容器（gallery ↔ detail 路由）
// ============================================================

import { useState, useEffect } from 'react'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { Card, EmptyState } from '../../ui'
import Gallery from './Gallery'
import ResourceDetail from './ResourceDetail'

export default function Resources() {
  const [resourceId, setResourceId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id)
    }).catch(() => {})
  }, [])

  if (!isSupabaseConfigured) {
    return (
      <Card className="p-8">
        <EmptyState
          icon="🔌"
          title="資源分享區需要連接雲端"
          hint="未接 Supabase；登入後先用到資源分享功能。"
        />
      </Card>
    )
  }

  if (resourceId) {
    return (
      <ResourceDetail
        resourceId={resourceId}
        currentUserId={userId}
        onBack={() => setResourceId(null)}
        onDeleted={() => setResourceId(null)}
      />
    )
  }

  return (
    <Gallery
      onOpenResource={setResourceId}
      currentUserId={userId}
    />
  )
}
