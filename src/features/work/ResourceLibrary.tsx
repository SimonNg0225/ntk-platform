import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { resourcesCol, topicsCol } from '../../data/collections'
import type { ResourceType } from '../../data/types'

const TYPE_LABEL: Record<ResourceType, string> = {
  handout: '講義',
  slides: '簡報',
  paper: '試題',
  link: '連結',
  video: '影片',
  note: '筆記',
}
const TYPE_ICON: Record<ResourceType, string> = {
  handout: '📄',
  slides: '📊',
  paper: '📝',
  link: '🔗',
  video: '🎬',
  note: '🗒️',
}

export default function ResourceLibrary() {
  const resources = useCollection(resourcesCol)
  const topics = useCollection(topicsCol)

  const [showForm, setShowForm] = useState(false)
  const [fType, setFType] = useState('')
  const [fTopic, setFTopic] = useState('')
  const [search, setSearch] = useState('')

  const topicName = (id?: string) =>
    id ? (topics.find((t) => t.id === id)?.topic ?? '') : ''

  const filtered = useMemo(
    () =>
      resources
        .filter((r) => (fType ? r.type === fType : true))
        .filter((r) => (fTopic ? r.topicId === fTopic : true))
        .filter((r) =>
          search ? r.title.toLowerCase().includes(search.toLowerCase()) : true,
        )
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [resources, fType, fTopic, search],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋資源…"
          className="min-w-[140px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-strong"
        >
          {showForm ? '收起' : '＋ 新增資源'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={fType}
          onChange={(e) => setFType(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
        >
          <option value="">全部類型</option>
          {(Object.keys(TYPE_LABEL) as ResourceType[]).map((k) => (
            <option key={k} value={k}>
              {TYPE_LABEL[k]}
            </option>
          ))}
        </select>
        <select
          value={fTopic}
          onChange={(e) => setFTopic(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
        >
          <option value="">全部課題</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.topic}
            </option>
          ))}
        </select>
      </div>

      {showForm && <AddForm onDone={() => setShowForm(false)} />}

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((r) => (
          <div
            key={r.id}
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-lg">
                {TYPE_ICON[r.type]}
              </div>
              <button
                onClick={() => resourcesCol.remove(r.id)}
                className="text-xs text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
              >
                刪除
              </button>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-800">
              {r.title}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                {TYPE_LABEL[r.type]}
              </span>
              {r.topicId && (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  {topicName(r.topicId)}
                </span>
              )}
            </div>
            {r.notes && (
              <p className="mt-2 text-xs text-slate-500">{r.notes}</p>
            )}
            {r.url && (
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 text-xs font-medium text-accent hover:underline"
              >
                開啟連結 →
              </a>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400 sm:col-span-2">
            未有資源。撳「＋ 新增資源」開始建立你嘅教材庫。
          </p>
        )}
      </div>
    </div>
  )
}

function AddForm({ onDone }: { onDone: () => void }) {
  const topics = useCollection(topicsCol)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ResourceType>('link')
  const [url, setUrl] = useState('')
  const [topicId, setTopicId] = useState('')
  const [notes, setNotes] = useState('')

  const save = () => {
    if (!title.trim()) return
    resourcesCol.add({
      title: title.trim(),
      type,
      url: url.trim() || undefined,
      topicId: topicId || undefined,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
    })
    onDone()
  }

  return (
    <div className="space-y-3 rounded-2xl border border-accent/30 bg-accent-soft/40 p-4">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="資源標題…"
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
      <div className="flex flex-wrap gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ResourceType)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
        >
          {(Object.keys(TYPE_LABEL) as ResourceType[]).map((k) => (
            <option key={k} value={k}>
              {TYPE_LABEL[k]}
            </option>
          ))}
        </select>
        <select
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent"
        >
          <option value="">（選填）課題</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.topic}
            </option>
          ))}
        </select>
      </div>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="連結 URL（選填）"
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="備註（選填）"
        rows={2}
        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
      <button
        onClick={save}
        className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-strong"
      >
        儲存資源
      </button>
    </div>
  )
}
