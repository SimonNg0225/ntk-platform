import { useState } from 'react'
import { useCollection } from '../../lib/store'
import { readingCol } from '../../data/collections'
import type { ReadingItem, ReadingStatus } from '../../data/types'

const STATUS_ORDER: ReadingStatus[] = ['to_read', 'reading', 'done']

const STATUS_LABEL: Record<ReadingStatus, string> = {
  to_read: '想睇',
  reading: '睇緊',
  done: '睇完',
}

function nextStatus(status: ReadingStatus): ReadingStatus {
  const idx = STATUS_ORDER.indexOf(status)
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]
}

export default function ReadingList() {
  const items = useCollection(readingCol)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')

  function addItem() {
    const t = title.trim()
    if (!t) return
    const a = author.trim()
    const u = url.trim()
    const n = notes.trim()
    readingCol.add({
      title: t,
      author: a || undefined,
      url: u || undefined,
      status: 'to_read',
      notes: n || undefined,
      createdAt: new Date().toISOString(),
    })
    setTitle('')
    setAuthor('')
    setUrl('')
    setNotes('')
  }

  function cycleStatus(item: ReadingItem) {
    readingCol.update(item.id, { status: nextStatus(item.status) })
  }

  const counts: Record<ReadingStatus, number> = {
    to_read: 0,
    reading: 0,
    done: 0,
  }
  for (const it of items) counts[it.status] += 1

  return (
    <div className="space-y-4">
      {/* 新增 + 統計 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-800">閱讀清單</h2>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-accent-soft px-2.5 py-1 font-medium text-accent-strong">
              共 {items.length}
            </span>
            {STATUS_ORDER.map((s) => (
              <span
                key={s}
                className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600"
              >
                {STATUS_LABEL[s]} {counts[s]}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="書名 / 文章標題（必填）"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="作者（選填）"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="連結（選填）"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="備註（選填）"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            onClick={addItem}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            新增
          </button>
        </div>
      </div>

      {/* 三組顯示 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {STATUS_ORDER.map((status) => {
          const group = items.filter((it) => it.status === status)
          return (
            <div
              key={status}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">
                  {STATUS_LABEL[status]}
                </h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  {group.length}
                </span>
              </div>

              <div className="space-y-2">
                {group.length === 0 && (
                  <p className="text-sm text-slate-400">未有項目。</p>
                )}
                {group.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <p className="text-sm font-medium text-slate-800">
                      {item.title}
                    </p>
                    {item.author && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.author}
                      </p>
                    )}
                    {item.notes && (
                      <p className="mt-1 text-xs text-slate-600">{item.notes}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => cycleStatus(item)}
                        className="rounded-lg bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-strong hover:bg-accent hover:text-white focus:outline-none focus:ring-2 focus:ring-accent/30"
                      >
                        轉去「{STATUS_LABEL[nextStatus(item.status)]}」
                      </button>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-accent hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
                        >
                          開啟
                        </a>
                      )}
                      <button
                        onClick={() => readingCol.remove(item.id)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-rose-600 focus:outline-none focus:ring-2 focus:ring-accent/30"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
