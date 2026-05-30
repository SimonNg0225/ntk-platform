import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { meetingNotesCol } from '../../data/collections'
import type { MeetingNote } from '../../data/types'

const today = () => new Date().toISOString().slice(0, 10)

function parseTags(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-accent/30'

export default function MeetingNotes() {
  const notes = useCollection(meetingNotesCol)

  // 新增表單
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(today())
  const [content, setContent] = useState('')
  const [tagsInput, setTagsInput] = useState('')

  // 搜尋 / 篩選
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  // 展開 / 編輯狀態
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{
    title: string
    date: string
    content: string
    tagsInput: string
  }>({ title: '', date: today(), content: '', tagsInput: '' })

  const allTags = useMemo(() => {
    const set = new Set<string>()
    notes.forEach((n) => n.tags?.forEach((t) => set.add(t)))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [notes])

  const visibleNotes = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return notes
      .filter((n) => {
        const matchKeyword =
          keyword.length === 0 ||
          n.title.toLowerCase().includes(keyword) ||
          n.content.toLowerCase().includes(keyword)
        const matchTag = activeTag === null || (n.tags?.includes(activeTag) ?? false)
        return matchKeyword && matchTag
      })
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [notes, search, activeTag])

  const canSubmit = title.trim().length > 0 && content.trim().length > 0

  function handleAdd() {
    if (!canSubmit) return
    const tags = parseTags(tagsInput)
    meetingNotesCol.add({
      title: title.trim(),
      date: date || today(),
      content: content.trim(),
      tags: tags.length > 0 ? tags : undefined,
      createdAt: new Date().toISOString(),
    })
    setTitle('')
    setDate(today())
    setContent('')
    setTagsInput('')
  }

  function startEdit(note: MeetingNote) {
    setEditingId(note.id)
    setExpandedId(note.id)
    setEditDraft({
      title: note.title,
      date: note.date,
      content: note.content,
      tagsInput: note.tags?.join(', ') ?? '',
    })
  }

  function saveEdit(id: string) {
    if (editDraft.title.trim().length === 0 || editDraft.content.trim().length === 0) return
    const tags = parseTags(editDraft.tagsInput)
    meetingNotesCol.update(id, {
      title: editDraft.title.trim(),
      date: editDraft.date || today(),
      content: editDraft.content.trim(),
      tags: tags.length > 0 ? tags : undefined,
    })
    setEditingId(null)
  }

  function removeNote(id: string) {
    meetingNotesCol.remove(id)
    if (expandedId === id) setExpandedId(null)
    if (editingId === id) setEditingId(null)
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-800 sm:text-2xl">會議 / 行政筆記</h1>
        <p className="text-sm text-slate-500">記錄會議重點同行政事項，方便日後翻查。</p>
      </header>

      {/* 新增筆記 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-800">新增筆記</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-500">標題（必填）</label>
              <input
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：週會 — 項目進度"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">日期</label>
              <input
                type="date"
                className={inputClass}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">內容（必填）</label>
            <textarea
              className={`${inputClass} min-h-[120px] resize-y`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="會議重點、決議、跟進事項…"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              標籤（選填，用逗號或空格分隔）
            </label>
            <input
              className={inputClass}
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="例如：人事, 財務 預算"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!canSubmit}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              新增筆記
            </button>
          </div>
        </div>
      </section>

      {/* 搜尋 / 篩選 */}
      <section className="space-y-3">
        <input
          className={inputClass}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋標題或內容…"
        />
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                activeTag === null
                  ? 'bg-accent text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              全部
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag((cur) => (cur === tag ? null : tag))}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  activeTag === tag
                    ? 'bg-accent text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 筆記列表 */}
      <section className="space-y-3">
        {visibleNotes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
            未有筆記。
          </p>
        ) : (
          visibleNotes.map((note) => {
            const isExpanded = expandedId === note.id
            const isEditing = editingId === note.id
            const truncated =
              !isExpanded && note.content.length > 140
                ? `${note.content.slice(0, 140)}…`
                : note.content

            return (
              <article
                key={note.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      className={inputClass}
                      value={editDraft.title}
                      onChange={(e) =>
                        setEditDraft((d) => ({ ...d, title: e.target.value }))
                      }
                      placeholder="標題"
                    />
                    <input
                      type="date"
                      className={inputClass}
                      value={editDraft.date}
                      onChange={(e) =>
                        setEditDraft((d) => ({ ...d, date: e.target.value }))
                      }
                    />
                    <textarea
                      className={`${inputClass} min-h-[120px] resize-y`}
                      value={editDraft.content}
                      onChange={(e) =>
                        setEditDraft((d) => ({ ...d, content: e.target.value }))
                      }
                      placeholder="內容"
                    />
                    <input
                      className={inputClass}
                      value={editDraft.tagsInput}
                      onChange={(e) =>
                        setEditDraft((d) => ({ ...d, tagsInput: e.target.value }))
                      }
                      placeholder="標籤（用逗號或空格分隔）"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(note.id)}
                        disabled={
                          editDraft.title.trim().length === 0 ||
                          editDraft.content.trim().length === 0
                        }
                        className="rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        儲存
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-semibold text-slate-800">{note.title}</h3>
                      <span className="shrink-0 text-xs text-slate-400">{note.date}</span>
                    </div>

                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {note.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="whitespace-pre-wrap text-sm text-slate-600">{truncated}</p>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {note.content.length > 140 && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId((cur) => (cur === note.id ? null : note.id))
                          }
                          className="text-xs font-medium text-accent hover:text-accent-strong"
                        >
                          {isExpanded ? '收起' : '展開全文'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(note)}
                        className="text-xs font-medium text-slate-500 hover:text-slate-700"
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        onClick={() => removeNote(note.id)}
                        className="text-xs font-medium text-rose-500 hover:text-rose-600"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                )}
              </article>
            )
          })
        )}
      </section>
    </div>
  )
}
