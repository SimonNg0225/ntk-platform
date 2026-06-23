import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessagesSquare, UserCog, Users, ChevronRight } from 'lucide-react'
import { EmptyState, Button, PageHeader, FeatureGuide, Skeleton } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { listBoards } from './api'
import ProfileEdit from './ProfileEdit'
import type { ForumBoard } from './types'

export default function BoardList({ onOpenBoard }: { onOpenBoard: (b: ForumBoard) => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [boards, setBoards] = useState<ForumBoard[]>([])
  const [loading, setLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  useEffect(() => {
    listBoards().then(setBoards).catch((e) => toast.error(e instanceof Error ? e.message : '載入失敗')).finally(() => setLoading(false))
  }, []) // eslint-disable-line

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Users}
        title={t('forum.title', { defaultValue: '老師社群' })}
        description={t('forum.subtitle', { defaultValue: '揀一個版面，同全港老師交流教學心得。' })}
        actions={
          <Button variant="secondary" size="sm" icon={UserCog} onClick={() => setProfileOpen(true)}>
            {t('forum.profile', { defaultValue: '個人資料' })}
          </Button>
        }
      />

      <FeatureGuide
        storageKey="forum"
        title={t('forum.guideTitle', { defaultValue: '老師社群點用？' })}
        steps={[
          { title: t('forum.guide1Title', { defaultValue: '揀版面' }), desc: t('forum.guide1Desc', { defaultValue: '揀返你想討論嘅範疇，例如某科或教學分享。' }) },
          { title: t('forum.guide2Title', { defaultValue: '睇帖傾偈' }), desc: t('forum.guide2Desc', { defaultValue: '入版面睇老師發嘅帖，覺得有用就撳「有用」或留言回覆。' }) },
          { title: t('forum.guide3Title', { defaultValue: '發帖提問' }), desc: t('forum.guide3Desc', { defaultValue: '撳「發帖」開新話題；首次發言要先填顯示名。' }) },
        ]}
      />

      <section aria-label={t('forum.boards', { defaultValue: '討論版面' })}>
        {loading ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : boards.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title={t('forum.emptyBoards', { defaultValue: '暫時未有討論版面' })}
            hint={t('forum.emptyBoardsHint', { defaultValue: '版面開放後會喺度顯示，可稍後再嚟睇睇。' })}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {boards.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onOpenBoard(b)}
                  aria-label={b.name}
                  className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-left transition duration-200 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                    <MessagesSquare size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-slate-800 dark:text-slate-100">{b.name}</h3>
                    <p className="truncate text-xs text-slate-400">{b.description}</p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-slate-300 transition group-hover:text-accent dark:text-slate-600" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProfileEdit open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  )
}
