import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  CheckSquare,
  Copy,
  Download,
  Eye,
  ListChecks,
  Pencil,
  Pin,
  Star,
  Tag as TagIcon,
  Trash2,
} from 'lucide-react'
import {
  Badge,
  Button,
  IconButton,
  ProgressBar,
  Select,
  Textarea,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import {
  NOTE_COLOR_KEYS,
  noteColorOf,
  richNotesCol,
  type Notebook,
  type RichNote,
} from './store'
import {
  checklistStat,
  download,
  fullDateTime,
  noteToMarkdown,
  parseLines,
  parseTags,
  readingMinutes,
  toggleTodoLine,
  wordCount,
} from './util'
import { NOTE_TEMPLATES } from './templates'

// 在 textarea 游標位置插入文字
function insertAtCursor(
  el: HTMLTextAreaElement | null,
  current: string,
  insert: string,
): string {
  if (!el) return current + insert
  const start = el.selectionStart ?? current.length
  const end = el.selectionEnd ?? current.length
  return current.slice(0, start) + insert + current.slice(end)
}

export default function Editor({
  note,
  notebooks,
  onClose,
}: {
  note: RichNote
  notebooks: Notebook[]
  onClose?: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const taRef = useRef<HTMLTextAreaElement>(null)

  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')

  // 持有「目前 title/content 屬於邊一則筆記」+ 已寫入快照。
  // 用嚟喺切走 / 卸載時即時 flush 未存內容（避免遺失），同時
  // 靠 saved 快照避免重複 / 多餘寫入。
  const live = useRef({
    id: note.id,
    title,
    content,
    savedTitle: note.title,
    savedContent: note.content,
  })
  live.current.title = title
  live.current.content = content

  // 即時寫入 ref 當下持有嗰則筆記；只在內容真有改動時寫，寫完更新快照。
  const flushNow = useCallback(() => {
    const s = live.current
    if (s.title === s.savedTitle && s.content === s.savedContent) return
    richNotesCol.update(s.id, {
      title: s.title,
      content: s.content,
      updatedAt: new Date().toISOString(),
    })
    s.savedTitle = s.title
    s.savedContent = s.content
  }, [])

  // 切換到另一則筆記時：cleanup 先 flush 舊筆記（此時 ref 仍持有舊 id +
  // 最新輸入），再載入新內容並重設快照。卸載時 cleanup 亦會 flush。
  useEffect(() => {
    setTitle(note.title)
    setContent(note.content)
    setMode('edit')
    live.current = {
      id: note.id,
      title: note.title,
      content: note.content,
      savedTitle: note.title,
      savedContent: note.content,
    }
    return flushNow
  }, [note.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced 自動儲存（內容 / 標題改變）
  const dirty = title !== note.title || content !== note.content
  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(flushNow, 600)
    return () => clearTimeout(t)
  }, [title, content, dirty, note.id, flushNow])

  const tags = useMemo(() => parseTags(content), [content])
  const words = wordCount(content)
  const chars = content.length
  const check = checklistStat(content)
  const color = noteColorOf(note.color)

  function patch(p: Partial<RichNote>) {
    richNotesCol.update(note.id, { ...p, updatedAt: new Date().toISOString() })
  }

  function applyTemplate(body: string) {
    if (content.trim() && content !== body) {
      setContent((c) => c.trimEnd() + '\n\n' + body)
    } else {
      setContent(body)
    }
    toast.info('已插入範本')
  }

  function copyText() {
    navigator.clipboard?.writeText(content).then(
      () => toast.success('已複製到剪貼簿'),
      () => toast.error('複製失敗'),
    )
  }

  function exportMd() {
    download(
      `${(title || '筆記').slice(0, 40)}.md`,
      noteToMarkdown({ ...note, title, content }),
      'text/markdown',
    )
    toast.success('已匯出 Markdown')
  }

  async function trash() {
    if (note.trashed) {
      const ok = await confirm({
        title: '永久刪除？',
        message: '此筆記會被永久刪除，無法復原。',
        confirmText: '永久刪除',
        tone: 'danger',
      })
      if (!ok) return
      richNotesCol.remove(note.id)
      toast.success('已永久刪除')
      onClose?.()
    } else {
      patch({ trashed: true, pinned: false })
      toast.info('已移到垃圾桶')
      onClose?.()
    }
  }

  const preview = useMemo(() => parseLines(content), [content])

  return (
    <div className="flex h-full flex-col">
      {/* 工具列 */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200/80 px-1 pb-2 dark:border-slate-700/60">
        <IconButton
          label={note.pinned ? '取消釘選' : '釘選'}
          active={note.pinned}
          onClick={() => patch({ pinned: !note.pinned })}
        >
          <Pin size={17} className={note.pinned ? 'fill-current' : ''} />
        </IconButton>
        <IconButton
          label={note.favorite ? '取消星標' : '星標'}
          active={note.favorite}
          onClick={() => patch({ favorite: !note.favorite })}
        >
          <Star size={17} className={note.favorite ? 'fill-current' : ''} />
        </IconButton>

        {/* 色標 */}
        <div className="mx-1 flex items-center gap-1">
          {NOTE_COLOR_KEYS.map((ck) => {
            const c = noteColorOf(ck)
            const on = note.color === ck
            return (
              <button
                key={ck}
                type="button"
                aria-label={`色標 ${c.label}`}
                aria-pressed={on}
                onClick={() => patch({ color: ck })}
                className="group flex h-8 w-8 items-center justify-center rounded-full"
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'h-4 w-4 rounded-full transition',
                    c.swatch,
                    on
                      ? 'ring-2 ring-slate-400 ring-offset-1 dark:ring-slate-300 dark:ring-offset-slate-800'
                      : 'group-hover:scale-110',
                  )}
                />
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <IconButton
            label={mode === 'edit' ? '預覽' : '編輯'}
            active={mode === 'preview'}
            onClick={() => setMode((m) => (m === 'edit' ? 'preview' : 'edit'))}
          >
            {mode === 'edit' ? <Eye size={17} /> : <Pencil size={17} />}
          </IconButton>
          <IconButton label="複製內文" onClick={copyText}>
            <Copy size={17} />
          </IconButton>
          <IconButton label="匯出 Markdown" onClick={exportMd}>
            <Download size={17} />
          </IconButton>
          {note.archived ? (
            <IconButton
              label="還原"
              onClick={() => {
                patch({ archived: false })
                toast.success('已還原')
              }}
            >
              <ArchiveRestore size={17} />
            </IconButton>
          ) : (
            !note.trashed && (
              <IconButton
                label="封存"
                onClick={() => {
                  patch({ archived: true, pinned: false })
                  toast.info('已封存')
                  onClose?.()
                }}
              >
                <Archive size={17} />
              </IconButton>
            )
          )}
          <IconButton
            label={note.trashed ? '永久刪除' : '移到垃圾桶'}
            tone="danger"
            onClick={trash}
          >
            <Trash2 size={17} />
          </IconButton>
        </div>
      </div>

      {/* 筆記本 + 範本 */}
      <div className="flex flex-wrap items-center gap-2 px-1 py-2">
        <Select
          value={note.notebookId ?? ''}
          onChange={(e) => patch({ notebookId: e.target.value || null })}
          className="h-8 w-auto py-1 text-xs"
        >
          <option value="">未分類</option>
          {notebooks.map((nb) => (
            <option key={nb.id} value={nb.id}>
              {nb.name}
            </option>
          ))}
        </Select>
        <span className="hidden h-4 w-px bg-slate-200 dark:bg-slate-700 sm:inline-block" />
        <span className="hidden text-[11px] font-medium text-slate-400 dark:text-slate-500 sm:inline">
          套範本
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {NOTE_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.hint}
              onClick={() => applyTemplate(t.body)}
              className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-accent-soft hover:text-accent-strong dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-accent/15 dark:hover:text-accent"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 內容區（稿紙：橫線 + 左側裝訂紅線） */}
      <div
        className={cx(
          'relative min-h-0 flex-1 overflow-y-auto rounded-2xl border p-4 pl-6 sm:p-5 sm:pl-8',
          color.card ||
            'border-amber-200/60 bg-amber-50/30 dark:border-slate-700/60 dark:bg-slate-800/40',
        )}
      >
        {/* 稿紙橫線（極淡，純裝飾） */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.4] dark:opacity-25"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0, transparent 27px, rgb(180 150 100 / 0.16) 27px, rgb(180 150 100 / 0.16) 28px)',
          }}
        />
        {/* 左側裝訂紅線 */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 w-px bg-rose-300/40 dark:bg-rose-400/20 sm:left-4"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="畀個標題…"
          className="relative w-full bg-transparent font-serif text-2xl font-semibold tracking-tight text-slate-800 outline-none placeholder:text-slate-300 dark:text-slate-100 dark:placeholder:text-slate-600"
        />
        <div className="relative mb-3 mt-1 font-serif text-[11px] italic tabular-nums text-slate-400 dark:text-slate-500">
          起稿於 {fullDateTime(note.createdAt)}
        </div>

        {mode === 'edit' ? (
          <div className="relative">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                icon={CheckSquare}
                onClick={() => {
                  const ins = insertAtCursor(
                    taRef.current,
                    content,
                    (content && !content.endsWith('\n') ? '\n' : '') + '- [ ] ',
                  )
                  setContent(ins)
                  taRef.current?.focus()
                }}
              >
                待辦行
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={TagIcon}
                onClick={() => {
                  setContent((c) => insertAtCursor(taRef.current, c, ' #'))
                  taRef.current?.focus()
                }}
              >
                標籤
              </Button>
            </div>
            <Textarea
              ref={taRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={Math.max(12, Math.min(28, content.split('\n').length + 2))}
              placeholder="由呢度落筆……　可以用 #標籤 歸類、- [ ] 整待辦。"
              className="border-0 bg-transparent px-0 text-[15px] leading-7 shadow-none focus:ring-0 dark:bg-transparent"
            />
          </div>
        ) : (
          <div className="relative">
            <PreviewBody
              lines={preview}
              onToggle={(idx) => setContent((c) => toggleTodoLine(c, idx))}
            />
          </div>
        )}
      </div>

      {/* 狀態列：字數 / 待辦進度 / 標籤 */}
      <div className="mt-2 space-y-2 px-1">
        {check.total > 0 && (
          <div className="flex items-center gap-2">
            <ListChecks size={14} className="shrink-0 text-slate-400" />
            <ProgressBar
              value={(check.done / check.total) * 100}
              tone={check.done === check.total ? 'green' : 'accent'}
              size="sm"
              className="flex-1"
            />
            <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {check.done}/{check.total}
            </span>
          </div>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Badge key={t} tone="accent">
                #{t}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <span className="tabular-nums">
            {words} 字 · {chars} 字元 · 約 {readingMinutes(words)} 分鐘
          </span>
          <span
            role="status"
            aria-live="polite"
            className={cx('transition-opacity', dirty ? 'opacity-100' : 'opacity-0')}
          >
            {dirty ? '儲存中…' : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

// ───────── 預覽（待辦可勾選、標籤高亮）─────────
function PreviewBody({
  lines,
  onToggle,
}: {
  lines: ReturnType<typeof parseLines>
  onToggle: (lineIndex: number) => void
}) {
  return (
    <div className="space-y-0.5 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
      {lines.map((l, i) => {
        if (l.kind === 'todo') {
          return (
            <button
              key={i}
              type="button"
              role="checkbox"
              aria-checked={l.done}
              onClick={() => onToggle(l.lineIndex)}
              className="flex w-full min-w-0 items-start gap-2 rounded-md px-1 py-0.5 text-left transition hover:bg-slate-100/70 dark:hover:bg-slate-700/40"
            >
              <span
                aria-hidden="true"
                className={cx(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]',
                  l.done
                    ? 'border-accent bg-accent text-white'
                    : 'border-slate-300 dark:border-slate-600',
                )}
              >
                {l.done && '✓'}
              </span>
              <span
                className={cx(
                  'min-w-0 break-words',
                  l.done && 'text-slate-400 line-through dark:text-slate-500',
                )}
              >
                {renderInline(l.text)}
              </span>
            </button>
          )
        }
        if (!l.text.trim()) return <div key={i} className="h-3" />
        return (
          <p key={i} className="whitespace-pre-wrap break-words px-1">
            {renderInline(l.text)}
          </p>
        )
      })}
    </div>
  )
}

// 簡易 inline 渲染：高亮 #標籤
function renderInline(text: string) {
  const parts = text.split(/(#[\p{L}\p{N}_-]+)/gu)
  return parts.map((p, i) =>
    p.startsWith('#') && p.length > 1 ? (
      <span key={i} className="font-medium text-accent-strong dark:text-accent">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}
