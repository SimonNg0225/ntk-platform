import { useEffect, useState } from 'react'
import { MessagesSquare, UserCog } from 'lucide-react'
import { Card, EmptyState, Button } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { listBoards } from './api'
import ProfileEdit from './ProfileEdit'
import type { ForumBoard } from './types'

export default function BoardList({ onOpenBoard }: { onOpenBoard: (b: ForumBoard) => void }) {
  const toast = useToast()
  const [boards, setBoards] = useState<ForumBoard[]>([])
  const [loading, setLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  useEffect(() => {
    listBoards().then(setBoards).catch((e) => toast.error(e instanceof Error ? e.message : '載入失敗')).finally(() => setLoading(false))
  }, []) // eslint-disable-line
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">揀一個版面，同全港老師交流。</p>
        <Button variant="ghost" icon={UserCog} onClick={() => setProfileOpen(true)}>個人資料</Button>
      </div>
      {loading ? <p className="py-10 text-center text-sm text-slate-400">載入中…</p>
        : boards.length === 0 ? <EmptyState icon="💬" title="未有版面。" />
        : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {boards.map((b) => (
              <li key={b.id}>
                <Card className="flex cursor-pointer items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md" onClick={() => onOpenBoard(b)}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent"><MessagesSquare size={20} /></span>
                  <div className="min-w-0"><h3 className="font-semibold text-slate-800 dark:text-slate-100">{b.name}</h3><p className="truncate text-xs text-slate-400">{b.description}</p></div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      <ProfileEdit open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  )
}
