import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { readingCol } from '../../data/collections'
import type { ReadingItem, ReadingStatus } from '../../data/types'
import {
  Button,
  Input,
  Textarea,
  Field,
  Card,
  Badge,
  SectionTitle,
  EmptyState,
  Tabs,
  StatCard,
  IconButton,
} from '../../ui'

const STATUS_ORDER: ReadingStatus[] = ['to_read', 'reading', 'done']

const STATUS_LABEL: Record<ReadingStatus, string> = {
  to_read: '想睇',
  reading: '睇緊',
  done: '睇完',
}

const STATUS_TONE: Record<ReadingStatus, 'slate' | 'accent' | 'green'> = {
  to_read: 'slate',
  reading: 'accent',
  done: 'green',
}

type ViewFilter = 'all' | ReadingStatus

const VIEW_TABS: { id: ViewFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'to_read', label: STATUS_LABEL.to_read },
  { id: 'reading', label: STATUS_LABEL.reading },
  { id: 'done', label: STATUS_LABEL.done },
]

export default function ReadingList() {
  const items = useCollection(readingCol)

  // 新增表單
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')

  // 檢視 / 搜尋
  const [view, setView] = useState<ViewFilter>('all')
  const [query, setQuery] = useState('')

  // 展開備註嘅項目
  const [openId, setOpenId] = useState<string | null>(null)
  const [draftNotes, setDraftNotes] = useState('')

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

  function setStatus(item: ReadingItem, status: ReadingStatus) {
    if (item.status === status) return
    readingCol.update(item.id, { status })
  }

  function toggleNotes(item: ReadingItem) {
    if (openId === item.id) {
      setOpenId(null)
    } else {
      setOpenId(item.id)
      setDraftNotes(item.notes ?? '')
    }
  }

  function saveNotes(item: ReadingItem) {
    const n = draftNotes.trim()
    readingCol.update(item.id, { notes: n || undefined })
    setOpenId(null)
  }

  const counts: Record<ReadingStatus, number> = {
    to_read: 0,
    reading: 0,
    done: 0,
  }
  for (const it of items) counts[it.status] += 1

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((it) => (view === 'all' ? true : it.status === view))
      .filter((it) => {
        if (!q) return true
        return (
          it.title.toLowerCase().includes(q) ||
          (it.author?.toLowerCase().includes(q) ?? false)
        )
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [items, view, query])

  return (
    <div className="space-y-5">
      {/* 統計 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="總數"
          value={items.length}
          unit="本"
          icon="📚"
          highlight
        />
        <StatCard
          label={STATUS_LABEL.to_read}
          value={counts.to_read}
          unit="本"
          icon="🔖"
        />
        <StatCard
          label={STATUS_LABEL.reading}
          value={counts.reading}
          unit="本"
          icon="📖"
        />
        <StatCard
          label={STATUS_LABEL.done}
          value={counts.done}
          unit="本"
          icon="✅"
        />
      </div>

      {/* 新增 */}
      <Card className="p-4 sm:p-5">
        <SectionTitle>新增閱讀項目</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="書名 / 文章標題（必填）">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：原則 Principles"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addItem()
              }}
            />
          </Field>
          <Field label="作者（選填）">
            <Input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="例如：Ray Dalio"
            />
          </Field>
          <Field label="連結（選填）">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field label="備註（選填）">
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="想記低嘅嘢"
            />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={addItem} disabled={!title.trim()}>
            新增
          </Button>
        </div>
      </Card>

      {/* 檢視 + 搜尋 */}
      <div className="space-y-3">
        <Tabs tabs={VIEW_TABS} active={view} onChange={setView} />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋書名或作者…"
        />
      </div>

      {/* 清單 */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="📖"
          title={query.trim() ? '搵唔到符合嘅項目' : '未有閱讀項目'}
          hint={
            query.trim()
              ? '試吓換個關鍵字。'
              : '喺上面加返第一本想睇嘅書或文章啦。'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((item) => {
            const expanded = openId === item.id
            return (
              <Card key={item.id} className="p-4" hover>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-800">
                      {item.title}
                    </p>
                    {item.author && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {item.author}
                      </p>
                    )}
                  </div>
                  <Badge tone={STATUS_TONE[item.status]}>
                    {STATUS_LABEL[item.status]}
                  </Badge>
                </div>

                {/* 快速狀態切換 */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {STATUS_ORDER.map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={item.status === s ? 'primary' : 'secondary'}
                      onClick={() => setStatus(item, s)}
                    >
                      {STATUS_LABEL[s]}
                    </Button>
                  ))}
                </div>

                {/* 操作列 */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost">
                        🔗 開啟
                      </Button>
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleNotes(item)}
                  >
                    {expanded ? '收起備註' : item.notes ? '查看備註' : '加備註'}
                  </Button>
                  <div className="ml-auto">
                    <IconButton
                      label="刪除"
                      className="hover:text-rose-600"
                      onClick={() => readingCol.remove(item.id)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M5 7h14M9 7V5h6v2m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V7"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </IconButton>
                  </div>
                </div>

                {/* 備註展開 */}
                {expanded && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <Field label="備註">
                      <Textarea
                        value={draftNotes}
                        onChange={(e) => setDraftNotes(e.target.value)}
                        rows={3}
                        placeholder="寫低你嘅筆記、重點或感想…"
                      />
                    </Field>
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setOpenId(null)}
                      >
                        取消
                      </Button>
                      <Button size="sm" onClick={() => saveNotes(item)}>
                        儲存
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
