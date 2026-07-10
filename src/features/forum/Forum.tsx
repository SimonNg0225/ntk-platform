import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, CloudOff } from 'lucide-react'
import { isSupabaseConfigured } from '../../lib/supabase'
import { EmptyState, PageHero } from '../../ui'
import BoardList from './BoardList'
import ThreadList from './ThreadList'
import ThreadView from './ThreadView'
import type { ForumBoard } from './types'

export default function Forum() {
  const { t } = useTranslation()
  const [board, setBoard] = useState<ForumBoard | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-5">
        <PageHero
          icon={Users}
          kicker={t('forum.kicker', { defaultValue: '教師交流' })}
          title={t('forum.title', { defaultValue: '老師社群' })}
          description={t('forum.subtitle', { defaultValue: '選擇一個版面，同全港老師交流教學心得。' })}
        />
        <EmptyState
          icon={CloudOff}
          title={t('forum.needCloud', { defaultValue: '社群需要連接雲端先用到' })}
          hint={t('forum.needCloudHint', { defaultValue: '社群服務暫時未連接；服務恢復後即可加入討論。' })}
        />
      </div>
    )
  }
  if (threadId) return <ThreadView threadId={threadId} onBack={() => setThreadId(null)} />
  if (board) return <ThreadList board={board} onBack={() => setBoard(null)} onOpenThread={setThreadId} />
  return <BoardList onOpenBoard={setBoard} />
}
