import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { meetingNotesCol } from '../../data/collections'
import type { MeetingNote } from '../../data/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  SectionTitle,
  Textarea,
} from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'

const today = () => new Date().toISOString().slice(0, 10)

function parseTags(raw: string): string[] {
  return raw
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

type Draft = {
  title: string
  date: string
  content: string
  tagsInput: string
}

const emptyDraft = (): Draft => ({
  title: '',
  date: today(),
  content: '',
  tagsInput: '',
})

export default function MeetingNotes() {
  const notes = useCollection(meetingNotesCol)
  const toast = useToast()
  const confirm = useConfirm()

  // 新增 / 編輯 Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft())

  // 搜尋 / 篩選
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  // 展開狀態
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
        const matchTag =
          activeTag === null || (n.tags?.includes(activeTag) ?? false)
        return matchKeyword && matchTag
      })
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [notes, search, activeTag])

  const canSave =
    draft.title.trim().length > 0 && draft.content.trim().length > 0

  function openAdd() {
    setEditingId(null)
    setDraft(emptyDraft())
    setModalOpen(true)
  }

  function openEdit(note: MeetingNote) {
    setEditingId(note.id)
    setDraft({
      title: note.title,
      date: note.date,
      content: note.content,
      tagsInput: note.tags?.join(', ') ?? '',
    })
    setModalOpen(true)
  }

  function handleSave() {
    if (!canSave) return
    const tags = parseTags(draft.tagsInput)
    const payload = {
      title: draft.title.trim(),
      date: draft.date || today(),
      content: draft.content.trim(),
      tags: tags.length > 0 ? tags : undefined,
    }
    if (editingId) {
      meetingNotesCol.update(editingId, payload)
      toast.success('已儲存筆記')
    } else {
      meetingNotesCol.add({ ...payload, createdAt: new Date().toISOString() })
      toast.success('已新增筆記')
    }
    setModalOpen(false)
    setEditingId(null)
  }

  async function removeNote(note: MeetingNote) {
    const ok = await confirm({
      title: '刪除筆記？',
      message: `「${note.title}」將會被永久刪除，呢個動作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    meetingNotesCol.remove(note.id)
    if (expandedId === note.id) setExpandedId(null)
    toast.success('已刪除筆記')
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 sm:text-2xl">
            會議 / 行政筆記
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            記錄會議重點同行政事項，方便日後翻查。共 {notes.length} 則。
          </p>
        </div>
        <Button onClick={openAdd} className="shrink-0">
          + 新增筆記
        </Button>
      </header>

      {/* 搜尋 / 篩選 */}
      <section className="space-y-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋標題或內容…"
        />
        {allTags.length > 0 && (
          <div className="space-y-2">
            <SectionTitle>標籤</SectionTitle>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setActiveTag(null)}>
                <Badge tone={activeTag === null ? 'accent' : 'slate'}>全部</Badge>
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setActiveTag((cur) => (cur === tag ? null : tag))
                  }
                >
                  <Badge tone={activeTag === tag ? 'accent' : 'slate'}>
                    #{tag}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 筆記列表 */}
      <section className="space-y-3">
        {visibleNotes.length === 0 ? (
          <EmptyState
            icon="📝"
            title={notes.length === 0 ? '未有筆記' : '無符合搜尋嘅筆記'}
            hint={
              notes.length === 0
                ? '撳右上角「新增筆記」記低第一則會議重點。'
                : '試吓清除搜尋字眼或標籤篩選。'
            }
          />
        ) : (
          visibleNotes.map((note) => {
            const isExpanded = expandedId === note.id
            const isLong = note.content.length > 140
            const shown =
              !isExpanded && isLong
                ? `${note.content.slice(0, 140)}…`
                : note.content

            return (
              <Card key={note.id} className="space-y-2 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    {note.title}
                  </h3>
                  <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                    {note.date}
                  </span>
                </div>

                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {note.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setActiveTag((cur) => (cur === tag ? null : tag))
                        }
                      >
                        <Badge tone={activeTag === tag ? 'accent' : 'slate'}>
                          #{tag}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}

                <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                  {shown}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {isLong && (
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
                    onClick={() => openEdit(note)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    編輯
                  </button>
                  <button
                    type="button"
                    onClick={() => removeNote(note)}
                    className="text-xs font-medium text-rose-500 hover:text-rose-600"
                  >
                    刪除
                  </button>
                </div>
              </Card>
            )
          })
        )}
      </section>

      {/* 新增 / 編輯 Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? '編輯筆記' : '新增筆記'}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="標題（必填）">
                <Input
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, title: e.target.value }))
                  }
                  placeholder="例如：週會 — 項目進度"
                />
              </Field>
            </div>
            <Field label="日期">
              <Input
                type="date"
                value={draft.date}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, date: e.target.value }))
                }
              />
            </Field>
          </div>

          <Field label="內容（必填）">
            <Textarea
              className="min-h-[120px]"
              value={draft.content}
              onChange={(e) =>
                setDraft((d) => ({ ...d, content: e.target.value }))
              }
              placeholder="會議重點、決議、跟進事項…"
            />
          </Field>

          <Field label="標籤（選填，用逗號或空格分隔）">
            <Input
              value={draft.tagsInput}
              onChange={(e) =>
                setDraft((d) => ({ ...d, tagsInput: e.target.value }))
              }
              placeholder="例如：人事, 財務 預算"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              取消
            </Button>
            <Button type="button" onClick={handleSave} disabled={!canSave}>
              {editingId ? '儲存' : '新增筆記'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
