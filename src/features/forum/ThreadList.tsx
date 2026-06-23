import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, MessageSquare, ThumbsUp, Pin, Search, PenLine, SearchX } from 'lucide-react'
import { Button, Input, Textarea, Field, Tabs, EmptyState, Modal, Skeleton } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { listThreads, searchThreads, createThread, getMyProfile } from './api'
import { validateThread } from './logic'
import ProfileEdit from './ProfileEdit'
import type { ForumBoard, ForumThread, ThreadSort } from './types'

export default function ThreadList({ board, onBack, onOpenThread }: {
  board: ForumBoard; onBack: () => void; onOpenThread: (id: string) => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [sort, setSort] = useState<ThreadSort>('new')
  const [threads, setThreads] = useState<ForumThread[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [searched, setSearched] = useState(false)
  const [composing, setComposing] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [tags, setTags] = useState('')
  const [posting, setPosting] = useState(false)

  const load = () => {
    setLoading(true)
    setSearched(false)
    listThreads(board.id, sort).then((r) => setThreads(r.threads))
      .catch((e) => toast.error(e instanceof Error ? e.message : '載入失敗')).finally(() => setLoading(false))
  }
  useEffect(load, [board.id, sort]) // eslint-disable-line

  const doSearch = async () => {
    if (!q.trim()) { load(); return }
    setLoading(true)
    try { setThreads(await searchThreads(board.id, q)); setSearched(true) } catch (e) { toast.error(e instanceof Error ? e.message : '搜尋失敗') } finally { setLoading(false) }
  }

  const openCompose = async () => {
    const p = await getMyProfile()
    if (!p) { toast.info('請先填寫討論區顯示名'); setProfileOpen(true); return }
    setComposing(true)
  }
  const submit = async () => {
    const err = validateThread(title, body); if (err) { toast.error(err); return }
    try {
      setPosting(true)
      const { id } = await createThread(board.id, title.trim(), body.trim(), tags.split(/[、,，\s]+/).map((s) => s.trim()).filter(Boolean))
      setComposing(false); setTitle(''); setBody(''); setTags('')
      onOpenThread(id)
    } catch (e) { toast.error(e instanceof Error ? e.message : '發帖失敗') } finally { setPosting(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <button onClick={onBack} className="mb-0.5 inline-flex items-center gap-1 rounded-lg text-xs text-slate-400 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]">
            <ArrowLeft size={13} /> {t('forum.allBoards', { defaultValue: '所有版面' })}
          </button>
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-100">{board.name}</h1>
          {board.description && <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">{board.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" icon={Plus} onClick={openCompose}>{t('forum.newThread', { defaultValue: '發帖' })}</Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="sm:w-60"><Tabs<ThreadSort> active={sort} onChange={setSort} tabs={[{ id: 'new', label: t('forum.sortNew', { defaultValue: '最新' }) }, { id: 'replies', label: t('forum.sortReplies', { defaultValue: '最多回覆' }) }, { id: 'top', label: t('forum.sortTop', { defaultValue: '最熱' }) }]} size="sm" /></div>
        <form onSubmit={(e) => { e.preventDefault(); doSearch() }} className="flex flex-1 gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('forum.searchBoard', { defaultValue: '搜尋本版…' })} />
          <Button type="submit" variant="secondary" icon={Search}>{t('forum.search', { defaultValue: '搜尋' })}</Button>
        </form>
      </div>

      {loading ? (
        <ul className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/3" />
            </li>
          ))}
        </ul>
      ) : threads.length === 0 ? (
        searched ? (
          <EmptyState
            icon={SearchX}
            title={t('forum.noResults', { defaultValue: '搵唔到相關帖子' })}
            hint={t('forum.noResultsHint', { defaultValue: '試下換個關鍵字，或者清空搜尋睇晒成版。' })}
            action={<Button size="sm" variant="secondary" onClick={() => { setQ(''); load() }}>{t('forum.clearSearch', { defaultValue: '清空搜尋' })}</Button>}
          />
        ) : (
          <EmptyState
            icon={PenLine}
            title={t('forum.emptyThreads', { defaultValue: '呢個版仲未有帖' })}
            hint={t('forum.emptyThreadsHint', { defaultValue: '做第一個開話題嘅老師，分享你嘅教學經驗啦！' })}
            action={<Button size="sm" icon={Plus} onClick={openCompose}>{t('forum.startFirst', { defaultValue: '發第一帖' })}</Button>}
          />
        )
      ) : (
        <ul className="space-y-2">
          {threads.map((thread) => (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => onOpenThread(thread.id)}
                aria-label={thread.title}
                className="group flex w-full cursor-pointer items-start gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-4 text-left transition duration-200 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98] dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600"
              >
                {thread.pinned && <Pin size={14} className="mt-1 shrink-0 text-amber-500" />}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-slate-800 dark:text-slate-100">{thread.title}</h3>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{thread.authorName} · {new Date(thread.last_activity_at).toLocaleDateString('zh-HK')}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1 tabular-nums"><ThumbsUp size={12} /> {thread.score}</span>
                  <span className="inline-flex items-center gap-1 tabular-nums"><MessageSquare size={12} /> {thread.reply_count}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={composing} onClose={() => setComposing(false)} title={t('forum.postIn', { defaultValue: `喺「${board.name}」發帖` })} size="lg">
        <div className="space-y-3">
          <Field label={t('forum.fieldTitle', { defaultValue: '標題' })}><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('forum.titlePlaceholder', { defaultValue: '一句講清你想討論咩' })} /></Field>
          <Field label={t('forum.fieldBody', { defaultValue: '內文' })}><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder={t('forum.bodyPlaceholder', { defaultValue: '寫低你嘅問題或分享，講多啲背景會易回應啲。' })} /></Field>
          <Field label={t('forum.fieldTags', { defaultValue: '標籤（選填，逗號分隔，最多 5）' })}><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t('forum.tagsPlaceholder', { defaultValue: '中六、應試技巧' })} /></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setComposing(false)}>{t('forum.cancel', { defaultValue: '取消' })}</Button><Button onClick={submit} disabled={posting}>{posting ? t('forum.posting', { defaultValue: '發布中…' }) : t('forum.publish', { defaultValue: '發布' })}</Button></div>
        </div>
      </Modal>
      <ProfileEdit open={profileOpen} onClose={() => setProfileOpen(false)} onSaved={() => setComposing(true)} />
    </div>
  )
}
