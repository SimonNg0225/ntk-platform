import { useMemo, useState } from 'react'
import { useCollection } from '../../lib/store'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import { notesCol } from '../../data/collections'
import type { Note } from '../../data/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  SectionTitle,
  Textarea,
} from '../../ui'
import { Pencil, PenLine, Search, Trash2 } from 'lucide-react'

// ============================================================
//  學習筆記（Notion / Apple Notes 風）
//  - 多行筆記、即時搜尋、#hashtag 標籤、inline 編輯
//  - 相對時間、最新喺上、總數
//  - 只用 Note{ content, createdAt }，標籤由 content 解析（唔存）
// ============================================================

// 由內容解析出 #hashtag（去重、保留出現次序）
function parseTags(content: string): string[] {
  const matches = content.match(/#[\p{L}\p{N}_-]+/gu) ?? []
  const seen = new Set<string>()
  const tags: string[] = []
  for (const m of matches) {
    const tag = m.slice(1)
    const key = tag.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      tags.push(tag)
    }
  }
  return tags
}

// 相對時間：剛剛 / x分鐘前 / x小時前 / x天前，再耐就顯示日期
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffSec = Math.floor((Date.now() - then) / 1000)
  if (diffSec < 0) return '剛剛'
  if (diffSec < 60) return '剛剛'
  const min = Math.floor(diffSec / 60)
  if (min < 60) return `${min}分鐘前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}小時前`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}天前`
  return new Date(iso).toLocaleDateString('zh-HK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const TRUNCATE_LEN = 220

function NoteCard({ note }: { note: Note }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState(note.content)

  const tags = useMemo(() => parseTags(note.content), [note.content])
  const isLong = note.content.length > TRUNCATE_LEN
  const shownContent =
    isLong && !expanded
      ? note.content.slice(0, TRUNCATE_LEN).trimEnd() + '…'
      : note.content

  const startEdit = () => {
    setEditDraft(note.content)
    setEditing(true)
  }

  const saveEdit = () => {
    const text = editDraft.trim()
    if (!text) return
    notesCol.update(note.id, { content: text })
    setEditing(false)
    toast.success('已更新筆記')
  }

  const removeNote = async () => {
    if (
      !(await confirm({
        title: '刪除筆記？',
        message: '此筆記會被永久刪除，無法復原。',
        confirmText: '刪除',
        tone: 'danger',
      }))
    )
      return
    notesCol.remove(note.id)
    toast.success('已刪除筆記')
  }

  if (editing) {
    return (
      <Card className="p-3">
        <Field>
          <Textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            rows={Math.min(12, Math.max(3, editDraft.split('\n').length + 1))}
            autoFocus
            placeholder="筆記內容…（用 #標籤 分類）"
          />
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
          >
            取消
          </Button>
          <Button size="sm" onClick={saveEdit} disabled={!editDraft.trim()}>
            儲存
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="group p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 dark:text-slate-100">
          {shownContent}
        </p>
        <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition group-hover:opacity-100">
          <IconButton label="編輯筆記" onClick={startEdit}>
            <Pencil size={16} strokeWidth={2} />
          </IconButton>
          <IconButton label="刪除筆記" onClick={removeNote} tone="danger">
            <Trash2 size={16} strokeWidth={2} />
          </IconButton>
        </div>
      </div>

      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-accent hover:text-accent-strong"
        >
          {expanded ? '收起' : '展開全文'}
        </button>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <Badge key={t} tone="accent">
            #{t}
          </Badge>
        ))}
        <span className="ml-auto text-xs text-slate-400 dark:text-slate-400">
          {relativeTime(note.createdAt)}
        </span>
      </div>
    </Card>
  )
}

export default function NotesWidget() {
  const notes = useCollection(notesCol)
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const draftLen = draft.trim().length

  const add = () => {
    const text = draft.trim()
    if (!text) return
    notesCol.add({ content: text, createdAt: new Date().toISOString() })
    setDraft('')
    toast.success('已新增筆記')
  }

  // 全部標籤（去重、附帶筆記數，按用量排序）
  const allTags = useMemo(() => {
    const counts = new Map<string, { tag: string; count: number }>()
    for (const n of notes) {
      for (const tag of parseTags(n.content)) {
        const key = tag.toLowerCase()
        const entry = counts.get(key)
        if (entry) entry.count += 1
        else counts.set(key, { tag, count: 1 })
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count)
  }, [notes])

  // 排序（最新喺上）+ 搜尋 + 標籤篩選
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...notes]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .filter((n) => {
        if (q && !n.content.toLowerCase().includes(q)) return false
        if (
          activeTag &&
          !parseTags(n.content).some(
            (t) => t.toLowerCase() === activeTag.toLowerCase(),
          )
        )
          return false
        return true
      })
  }, [notes, query, activeTag])

  const hasFilter = Boolean(query.trim() || activeTag)

  return (
    <div className="space-y-4">
      <SectionTitle
        right={
          <Badge tone="slate">
            <span className="tabular-nums">{notes.length}</span> 則筆記
          </Badge>
        }
      >
        學習筆記
      </SectionTitle>

      {/* 新增筆記 */}
      <Card className="p-3">
        <Field hint="支援多行。用 #標籤 分類，例如 #市場營銷">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') add()
            }}
            rows={3}
            placeholder="記低一個學到嘅重點…（⌘/Ctrl + Enter 加入）"
          />
        </Field>
        <div className="mt-2 flex items-center justify-end gap-3">
          {draftLen > 0 && (
            <span className="text-xs text-slate-400 dark:text-slate-400">
              <span className="tabular-nums">{draftLen}</span> 字
            </span>
          )}
          <Button size="sm" onClick={add} disabled={!draft.trim()}>
            加入筆記
          </Button>
        </div>
      </Card>

      {/* 搜尋 */}
      <Input
        icon={Search}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜尋筆記內容…"
      />

      {/* 標籤列 */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {allTags.map(({ tag, count }) => {
            const isActive = activeTag?.toLowerCase() === tag.toLowerCase()
            return (
              <button
                key={tag}
                onClick={() => setActiveTag(isActive ? null : tag)}
                className={
                  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition ' +
                  (isActive
                    ? 'bg-accent text-white'
                    : 'bg-accent-soft text-accent-strong hover:brightness-95')
                }
              >
                #{tag}
                <span className="tabular-nums opacity-60">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* 篩選狀態 / 結果數 */}
      {hasFilter && (
        <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-400">
          <span>
            搵到 <span className="tabular-nums">{visible.length}</span> 則
            {activeTag && (
              <>
                {' '}
                · 標籤 <span className="text-accent-strong">#{activeTag}</span>
              </>
            )}
          </span>
          <button
            onClick={() => {
              setQuery('')
              setActiveTag(null)
            }}
            className="font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            清除篩選
          </button>
        </div>
      )}

      {/* 列表 */}
      {notes.length === 0 ? (
        <EmptyState
          icon={PenLine}
          title="仲未有筆記"
          hint="喺上面打低你嘅第一個學習重點，記得用 #標籤 分類！"
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title="搵唔到相符嘅筆記"
          hint="試下改吓關鍵字或者清除標籤篩選。"
        />
      ) : (
        <div className="space-y-2">
          {visible.map((n) => (
            <NoteCard key={n.id} note={n} />
          ))}
        </div>
      )}
    </div>
  )
}
