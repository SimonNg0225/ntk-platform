import { useEffect, useState } from 'react'
import { ArrowLeft, ThumbsUp, Flag, Trash2, Send } from 'lucide-react'
import { Card, Button, Textarea, Badge, EmptyState, cx } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { getThread, listPosts, createPost, deleteOwn, setUpvote } from './api'
import { validatePost } from './logic'
import ReportModal from './ReportModal'
import type { ForumThread, ForumPost } from './types'
import { supabase } from '../../lib/supabase'

const rel = (s: string) => new Date(s).toLocaleString('zh-HK')

export default function ThreadView({ threadId, onBack }: { threadId: string; onBack: () => void }) {
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

  if (loading) return <p className="py-10 text-center text-sm text-slate-400">載入中…</p>
  if (!thread) return <EmptyState icon="🗑️" title="主題唔存在或已刪除。" />

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-accent"><ArrowLeft size={15} /> 返回版面</button>
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{thread.title}</h2>
            <p className="mt-1 text-xs text-slate-400">{thread.authorName} · {rel(thread.created_at)}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button onClick={() => setReport({ type: 'thread', id: thread.id })} className="rounded p-1.5 text-slate-400 hover:text-rose-500" title="檢舉"><Flag size={15} /></button>
            {meId === thread.author_id && <button onClick={() => del('thread', thread.id)} className="rounded p-1.5 text-slate-400 hover:text-rose-500" title="刪除"><Trash2 size={15} /></button>}
          </div>
        </div>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200">{thread.body}</p>
        {thread.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{thread.tags.map((t) => <Badge key={t} tone="slate">#{t}</Badge>)}</div>}
        <div className="mt-4">
          <button onClick={upThread} className={cx('inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition', thread.mineUp ? 'border-accent bg-accent-soft text-accent-strong' : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700')}>
            <ThumbsUp size={14} /> 有用 · {thread.score}
          </button>
        </div>
      </Card>

      <p className="px-1 text-sm font-medium text-slate-500">{thread.reply_count} 則回覆</p>
      {posts.map((p) => (
        <Card key={p.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-slate-400">{p.authorName} · {rel(p.created_at)}</p>
            <div className="flex shrink-0 gap-1">
              <button onClick={() => setReport({ type: 'post', id: p.id })} className="rounded p-1 text-slate-400 hover:text-rose-500" title="檢舉"><Flag size={14} /></button>
              {meId === p.author_id && <button onClick={() => del('post', p.id)} className="rounded p-1 text-slate-400 hover:text-rose-500" title="刪除"><Trash2 size={14} /></button>}
            </div>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-200">{p.body}</p>
          <button onClick={() => upPost(p)} className={cx('mt-2 inline-flex items-center gap-1 text-xs font-medium', p.mineUp ? 'text-accent-strong' : 'text-slate-400 hover:text-accent')}><ThumbsUp size={12} /> {p.score}</button>
        </Card>
      ))}

      {thread.status === 'locked' ? (
        <p className="rounded-xl bg-slate-50 py-3 text-center text-sm text-slate-400 dark:bg-slate-800/50">🔒 此主題已鎖,唔接受回覆。</p>
      ) : (
        <Card className="p-4">
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="寫低你嘅回覆…" />
          <div className="mt-2 flex justify-end"><Button icon={Send} onClick={send} disabled={sending}>{sending ? '發送中…' : '回覆'}</Button></div>
        </Card>
      )}
      <ReportModal open={!!report} onClose={() => setReport(null)} targetType={report?.type ?? 'thread'} targetId={report?.id ?? null} />
    </div>
  )
}
