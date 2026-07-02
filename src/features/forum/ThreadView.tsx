import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ThumbsUp, Flag, Trash2, Send, Lock, FileX, MessageSquare } from 'lucide-react'
import { Card, Button, Textarea, Badge, EmptyState, Skeleton, cx } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { getThread, listPosts, createPost, deleteOwn, setUpvote } from './api'
import { validatePost } from './logic'
import ReportModal from './ReportModal'
import type { ForumThread, ForumPost } from './types'
import { supabase } from '../../lib/supabase'

const rel = (s: string) => new Date(s).toLocaleString('zh-HK')

export default function ThreadView({ threadId, onBack }: { threadId: string; onBack: () => void }) {
  const { t } = useTranslation()
  const toast = useToast(); const confirm = useConfirm()
  const [thread, setThread] = useState<ForumThread | null>(null)
  const [posts, setPosts] = useState<ForumPost[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [meId, setMeId] = useState<string | null>(null)
  const [report, setReport] = useState<{ type: 'thread' | 'post'; id: string } | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([getThread(threadId), listPosts(threadId)])
      .then(([t, p]) => { setThread(t); setPosts(p.posts) })
      .catch((e) => toast.error(e instanceof Error ? e.message : '載入失敗'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load(); supabase?.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null)) }, [threadId]) // eslint-disable-line

  const send = async () => {
    const err = validatePost(reply); if (err) { toast.error(err); return }
    try {
      setSending(true)
      await createPost(threadId, reply.trim())
      setReply(''); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : '回覆失敗') } finally { setSending(false) }
  }
  const upThread = async () => {
    if (!thread) return
    const on = !thread.mineUp
    setThread({ ...thread, mineUp: on, score: thread.score + (on ? 1 : -1) })
    try { await setUpvote('thread', thread.id, on) } catch { setThread(thread); toast.error('操作失敗') }
  }
  const upPost = async (p: ForumPost) => {
    const on = !p.mineUp
    setPosts((cur) => cur.map((x) => x.id === p.id ? { ...x, mineUp: on, score: x.score + (on ? 1 : -1) } : x))
    try { await setUpvote('post', p.id, on) } catch { load(); toast.error('操作失敗') }
  }
  const del = async (type: 'thread' | 'post', id: string) => {
    if (!(await confirm({ title: '刪除？', message: '此動作無法復原。', confirmText: '刪除', tone: 'danger' }))) return
    try { await deleteOwn(type, id); if (type === 'thread') onBack(); else load() }
    catch (e) { toast.error(e instanceof Error ? e.message : '刪除失敗') }
  }

  const backLink = (
    <button onClick={onBack} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs text-slate-400 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]">
      <ArrowLeft size={13} /> {t('forum.backToBoard', { defaultValue: '返回版面' })}
    </button>
  )

  if (loading) return (
    <div className="space-y-5">
      {backLink}
      <Card className="p-5">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="mt-2 h-3 w-1/3" />
        <Skeleton className="mt-4 h-3 w-full" />
        <Skeleton className="mt-2 h-3 w-5/6" />
      </Card>
    </div>
  )
  if (!thread) return (
    <div className="space-y-5">
      {backLink}
      <EmptyState
        icon={FileX}
        title={t('forum.threadGone', { defaultValue: '主題唔存在或已刪除' })}
        hint={t('forum.threadGoneHint', { defaultValue: '可能已被作者刪除，返回版面睇下其他帖。' })}
        action={<Button size="sm" variant="secondary" icon={ArrowLeft} onClick={onBack}>{t('forum.backToBoard', { defaultValue: '返回版面' })}</Button>}
      />
    </div>
  )

  return (
    <div className="space-y-5">
      {backLink}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">{thread.title}</h1>
            <p className="mt-1 text-xs text-slate-400">{thread.authorName} · {rel(thread.created_at)}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button onClick={() => setReport({ type: 'thread', id: thread.id })} className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 dark:hover:bg-slate-800/60" title={t('forum.report', { defaultValue: '檢舉' })} aria-label={t('forum.report', { defaultValue: '檢舉' })}><Flag size={15} /></button>
            {meId === thread.author_id && <button onClick={() => del('thread', thread.id)} className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 dark:hover:bg-slate-800/60" title={t('forum.delete', { defaultValue: '刪除' })} aria-label={t('forum.delete', { defaultValue: '刪除' })}><Trash2 size={15} /></button>}
          </div>
        </div>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200">{thread.body}</p>
        {thread.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{thread.tags.map((tag) => <Badge key={tag} tone="slate">#{tag}</Badge>)}</div>}
        <div className="mt-4">
          <button
            onClick={upThread}
            aria-pressed={!!thread.mineUp}
            className={cx('inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40', thread.mineUp ? 'border-accent bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent' : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60')}
          >
            <ThumbsUp size={14} /> {t('forum.helpful', { defaultValue: '有用' })} · <span className="tabular-nums">{thread.score}</span>
          </button>
        </div>
      </Card>

      <h2 className="px-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
        {t('forum.replyCount', { defaultValue: '{{n}} 則回覆', n: thread.reply_count })}
      </h2>

      {posts.length === 0 && thread.status !== 'locked' && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/[0.1] bg-slate-50/60 px-6 py-10 text-center dark:border-white/[0.12] dark:bg-slate-800/40">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent"><MessageSquare size={22} strokeWidth={1.75} /></span>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('forum.noReplies', { defaultValue: '仲未有回覆' })}</p>
          <p className="max-w-xs text-xs text-slate-400">{t('forum.noRepliesHint', { defaultValue: '做第一個回應嘅老師，喺下面寫低你嘅諗法。' })}</p>
        </div>
      )}

      {posts.map((p) => (
        <Card key={p.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-slate-400">{p.authorName} · {rel(p.created_at)}</p>
            <div className="flex shrink-0 gap-1">
              <button onClick={() => setReport({ type: 'post', id: p.id })} className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 dark:hover:bg-slate-800/60" title={t('forum.report', { defaultValue: '檢舉' })} aria-label={t('forum.report', { defaultValue: '檢舉' })}><Flag size={14} /></button>
              {meId === p.author_id && <button onClick={() => del('post', p.id)} className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40 dark:hover:bg-slate-800/60" title={t('forum.delete', { defaultValue: '刪除' })} aria-label={t('forum.delete', { defaultValue: '刪除' })}><Trash2 size={14} /></button>}
            </div>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">{p.body}</p>
          <button onClick={() => upPost(p)} aria-pressed={!!p.mineUp} className={cx('mt-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40', p.mineUp ? 'text-accent-strong dark:text-accent' : 'text-slate-400 hover:text-accent')}><ThumbsUp size={12} /> <span className="tabular-nums">{p.score}</span></button>
        </Card>
      ))}

      {thread.status === 'locked' ? (
        <p className="flex items-center justify-center gap-1.5 rounded-2xl bg-slate-50 py-3 text-center text-sm text-slate-400 dark:bg-slate-800/50">
          <Lock size={14} /> {t('forum.locked', { defaultValue: '此主題已鎖，唔接受回覆。' })}
        </p>
      ) : (
        <Card className="p-4">
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder={t('forum.replyPlaceholder', { defaultValue: '寫低你嘅回覆…' })} />
          <div className="mt-2 flex justify-end"><Button icon={Send} onClick={send} disabled={sending}>{sending ? t('forum.sending', { defaultValue: '發送中…' }) : t('forum.reply', { defaultValue: '回覆' })}</Button></div>
        </Card>
      )}
      <ReportModal open={!!report} onClose={() => setReport(null)} targetType={report?.type ?? 'thread'} targetId={report?.id ?? null} />
    </div>
  )
}
