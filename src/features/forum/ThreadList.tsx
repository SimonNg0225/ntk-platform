import { useEffect, useState } from 'react'
import { ArrowLeft, Plus, MessageSquare, ThumbsUp, Pin, Search } from 'lucide-react'
import { Card, Button, Input, Textarea, Field, Tabs, EmptyState, Modal } from '../../ui'
import { useToast } from '../../context/ToastContext'
import { listThreads, searchThreads, createThread, getMyProfile } from './api'
import { validateThread } from './logic'
import ProfileEdit from './ProfileEdit'
import type { ForumBoard, ForumThread, ThreadSort } from './types'

export default function ThreadList({ board, onBack, onOpenThread }: {
  board: ForumBoard; onBack: () => void; onOpenThread: (id: string) => void
}) {
  const toast = useToast()
  const [sort, setSort] = useState<ThreadSort>('new')
  const [threads, setThreads] = useState<ForumThread[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [composing, setComposing] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [tags, setTags] = useState('')
  const [posting, setPosting] = useState(false)

  const load = () => {
    setLoading(true)
    listThreads(board.id, sort).then((r) => setThreads(r.threads))
      .catch((e) => toast.error(e instanceof Error ? e.message : '載入失敗')).finally(() => setLoading(false))
  }
  useEffect(load, [board.id, sort]) // eslint-disable-line

  const doSearch = async () => {
    if (!q.trim()) { load(); return }
    setLoading(true)
    try { setThreads(await searchThreads(board.id, q)) } catch (e) { toast.error(e instanceof Error ? e.message : '搜尋失敗') } finally { setLoading(false) }
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
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-accent"><ArrowLeft size={15} /> 所有版面</button>
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{board.name}</h2><p className="text-xs text-slate-400">{board.description}</p></div>
        <Button icon={Plus} onClick={openCompose}>發帖</Button>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-56"><Tabs<ThreadSort> active={sort} onChange={setSort} tabs={[{ id: 'new', label: '最新' }, { id: 'replies', label: '最多回覆' }, { id: 'top', label: '最熱' }]} size="sm" /></div>
        <form onSubmit={(e) => { e.preventDefault(); doSearch() }} className="flex flex-1 gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋本版…" />
          <Button type="submit" variant="secondary" icon={Search}>搜尋</Button>
        </form>
      </div>

      {loading ? <p className="py-10 text-center text-sm text-slate-400">載入中…</p>
        : threads.length === 0 ? <EmptyState icon="💬" title="呢個版仲未有帖。" hint="做第一個開話題嘅老師啦！" />
        : (
          <ul className="space-y-2">
            {threads.map((t) => (
              <li key={t.id}>
                <Card className="cursor-pointer p-4 transition hover:-translate-y-0.5 hover:shadow-md" onClick={() => onOpenThread(t.id)}>
                  <div className="flex items-start gap-2">
                    {t.pinned && <Pin size={14} className="mt-1 shrink-0 text-amber-500" />}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-slate-800 dark:text-slate-100">{t.title}</h3>
                      <p className="mt-0.5 truncate text-xs text-slate-400">{t.authorName} · {new Date(t.last_activity_at).toLocaleDateString('zh-HK')}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1"><ThumbsUp size={12} /> {t.score}</span>
                      <span className="inline-flex items-center gap-1"><MessageSquare size={12} /> {t.reply_count}</span>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}

      <Modal open={composing} onClose={() => setComposing(false)} title={`喺「${board.name}」發帖`} size="lg">
        <div className="space-y-3">
          <Field label="標題"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="一句講清你想討論咩" /></Field>
          <Field label="內文"><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} /></Field>
          <Field label="標籤（選填，逗號分隔，最多 5）"><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="中六、應試技巧" /></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setComposing(false)}>取消</Button><Button onClick={submit} disabled={posting}>{posting ? '發布中…' : '發布'}</Button></div>
        </div>
      </Modal>
      <ProfileEdit open={profileOpen} onClose={() => setProfileOpen(false)} onSaved={() => setComposing(true)} />
    </div>
  )
}
