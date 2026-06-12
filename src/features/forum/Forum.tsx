import { useState } from 'react'
import { isSupabaseConfigured } from '../../lib/supabase'
import { EmptyState, Card } from '../../ui'
import BoardList from './BoardList'
import ThreadList from './ThreadList'
import ThreadView from './ThreadView'
import type { ForumBoard } from './types'

export default function Forum() {
  const [board, setBoard] = useState<ForumBoard | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)

  if (!isSupabaseConfigured) {
    return <Card className="p-8"><EmptyState icon="🔌" title="討論區需要連接雲端" hint="未接 Supabase；登入後先用到社群論壇。" /></Card>
  }
  if (threadId) return <ThreadView threadId={threadId} onBack={() => setThreadId(null)} />
  if (board) return <ThreadList board={board} onBack={() => setBoard(null)} onOpenThread={setThreadId} />
  return <BoardList onOpenBoard={setBoard} />
}
