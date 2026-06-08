import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  CheckSquare,
  Copy,
  CornerUpLeft,
  Download,
  Eye,
  Link2,
  ListChecks,
  Pencil,
  Pin,
  Sparkles,
  SpellCheck,
  FileQuestion,
  Star,
  Tag as TagIcon,
  Trash2,
} from 'lucide-react'
import {
  Badge,
  Button,
  IconButton,
  Menu,
  Modal,
  ProgressBar,
  Select,
  Textarea,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { complete, isAIConfigured } from '../../../lib/aiClient'
import ProofreadModal from './ProofreadModal'
import PracticeGenModal from './PracticeGenModal'
import {
  NOTE_COLOR_KEYS,
  noteColorOf,
  richNotesCol,
  type Notebook,
  type RichNote,
} from './store'
import {
  backlinksOf,
  checklistStat,
  deriveTitle,
  download,
  fullDateTime,
  noteToMarkdown,
  parseLines,
  parseTags,
  parseWikiLinks,
  readingMinutes,
  resolveNoteByTitle,
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

// ───────── / 斜線指令（插入區塊）─────────
function todayStr(): string {
  return new Date().toLocaleDateString('zh-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
interface SlashCommand {
  id: string
  label: string
  hint: string
  keywords: string[]
  /** 插入文字（可為函式，apply 時先計，例如日期） */
  insert: string | (() => string)
  /** 插入後游標相對插入起點嘅位置（預設 = 插入文字長度，即末尾） */
  caret?: number
}
const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'h2', label: '標題', hint: '## 大標題', keywords: ['heading', 'h2', 'title'], insert: '## ' },
  { id: 'h3', label: '小標題', hint: '### 小標題', keywords: ['heading', 'h3'], insert: '### ' },
  { id: 'todo', label: '待辦', hint: '- [ ] 任務', keywords: ['todo', 'task', 'check'], insert: '- [ ] ' },
  { id: 'bullet', label: '項目符號', hint: '- 清單', keywords: ['list', 'bullet', 'ul'], insert: '- ' },
  { id: 'quote', label: '引言', hint: '> 引述', keywords: ['quote', 'blockquote'], insert: '> ' },
  { id: 'divider', label: '分隔線', hint: '———', keywords: ['divider', 'hr', 'line'], insert: '---\n' },
  {
    id: 'table',
    label: '表格',
    hint: '兩欄表格',
    keywords: ['table', 'grid'],
    insert: '| 欄位 | 欄位 |\n| --- | --- |\n|  |  |\n',
  },
  { id: 'code', label: '程式碼', hint: '``` 區塊', keywords: ['code', 'pre'], insert: '```\n\n```\n', caret: 4 },
  { id: 'date', label: '日期', hint: todayStr(), keywords: ['date', 'today'], insert: () => todayStr() + ' ' },
  { id: 'link', label: '連結', hint: '[[筆記]]', keywords: ['link', 'wiki'], insert: '[[]]', caret: 2 },
  { id: 'tag', label: '標籤', hint: '#標籤', keywords: ['tag', 'hashtag'], insert: '#' },
]

// ───────── AI × 筆記（一次過 complete） ─────────
type AiKind = 'summary' | 'points' | 'tags' | 'polish'
const AI_NOTE_SYSTEM =
  '你係一個筆記助理。用繁體中文（可書面廣東話），簡潔、實用、貼題，唔好多餘客套。'
const AI_NOTE_TASKS: Record<
  AiKind,
  { label: string; verb: string; apply: 'append' | 'replace'; prompt: (c: string) => string }
> = {
  summary: {
    label: '摘要全文',
    verb: '加到筆記末',
    apply: 'append',
    prompt: (c) =>
      `為以下筆記寫一段精簡摘要（2-3 句），抽出核心重點，最前面加一行「## 摘要」：\n\n${c}`,
  },
  points: {
    label: '列重點',
    verb: '加到筆記末',
    apply: 'append',
    prompt: (c) =>
      `將以下筆記整理成 3-6 個重點，每行用「- 」開頭，最前面加一行「## 重點」：\n\n${c}`,
  },
  tags: {
    label: '建議標籤',
    verb: '加到筆記末',
    apply: 'append',
    prompt: (c) =>
      `為以下筆記建議 3-6 個分類標籤。淨係回傳以空格分隔嘅標籤，每個前面加 #，唔好任何其他文字：\n\n${c}`,
  },
  polish: {
    label: '潤飾文字',
    verb: '取代內文',
    apply: 'replace',
    prompt: (c) =>
      `潤飾以下筆記嘅文字，令佢更清晰流暢，保留原意同 Markdown 結構。直接回傳潤飾後嘅全文，唔好加任何解釋：\n\n${c}`,
  },
}

export default function Editor({
  note,
  notebooks,
  allNotes,
  onOpenLink,
  onOpenNote,
  onClose,
}: {
  note: RichNote
  notebooks: Notebook[]
  /** 全部筆記（解析 [[連結]] / 反向連結用） */
  allNotes: RichNote[]
  /** 撳 [[標題]]：解析現有筆記就開，冇就建立 */
  onOpenLink: (title: string) => void
  /** 撳反向連結：直接以 id 開該筆記 */
  onOpenNote: (id: string) => void
  onClose?: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const taRef = useRef<HTMLTextAreaElement>(null)

  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  // / 斜線指令選單（at = '/' 喺內文嘅 index；top = 相對編輯區嘅大約 px）
  const [slash, setSlash] = useState<{ query: string; at: number; top: number } | null>(null)
  const [slashIdx, setSlashIdx] = useState(0)
  // AI × 筆記：開緊邊個任務（null = 冇）
  const [aiKind, setAiKind] = useState<AiKind | null>(null)
  // 校對 / 出練習 modal
  const [proofOpen, setProofOpen] = useState(false)
  const [practiceOpen, setPracticeOpen] = useState(false)

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

  // 偵測游標前係咪 `(行首/空白)/查詢`，係就開斜線選單
  function detectSlash() {
    const ta = taRef.current
    if (!ta) {
      setSlash(null)
      return
    }
    const caret = ta.selectionStart ?? 0
    const before = ta.value.slice(0, caret)
    const m = before.match(/(^|\s)\/([^\s/]*)$/)
    if (!m) {
      setSlash(null)
      return
    }
    const query = m[2]
    const at = caret - query.length - 1
    const lineIndex = before.split('\n').length - 1
    const top = Math.max(0, (lineIndex + 1) * 28 - ta.scrollTop)
    setSlash((prev) => (prev && prev.at === at ? { ...prev, query, top } : { query, at, top }))
    setSlashIdx(0)
  }

  // 套用斜線指令：用插入內容取代 `/查詢`，並擺好游標
  function applySlash(cmd: SlashCommand) {
    if (!slash) return
    const ta = taRef.current
    const caret = ta?.selectionStart ?? content.length
    const text = typeof cmd.insert === 'function' ? cmd.insert() : cmd.insert
    const next = content.slice(0, slash.at) + text + content.slice(caret)
    const pos = slash.at + (cmd.caret ?? text.length)
    setContent(next)
    setSlash(null)
    requestAnimationFrame(() => {
      const el = taRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(pos, pos)
      }
    })
  }

  function runAi(kind: AiKind) {
    if (!content.trim()) {
      toast.info('未有內容可以畀 AI 處理')
      return
    }
    if (!isAIConfigured) {
      toast.info('AI 未啟用 — 要設定好 Supabase + Gemini（見 docs/SETUP.md）')
      return
    }
    setAiKind(kind)
  }

  function applyAi(text: string, apply: 'append' | 'replace') {
    if (apply === 'replace') setContent(text)
    else setContent((c) => (c.trim() ? c.trimEnd() + '\n\n' : '') + text)
    setAiKind(null)
    toast.success('已套用')
  }

  // 校對 / 出練習：共用守門（要有內容 + AI 已啟用）
  function openTool(tool: 'proof' | 'practice') {
    if (!content.trim()) {
      toast.info('未有內容可以畀 AI 處理')
      return
    }
    if (!isAIConfigured) {
      toast.info('AI 未啟用 — 要設定好 Supabase + Gemini（見 docs/SETUP.md）')
      return
    }
    if (tool === 'proof') setProofOpen(true)
    else setPracticeOpen(true)
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
  // [[雙向連結]]：本篇射出去嘅連結 + 反向連結（用 live title/content 配對）
  const outgoing = useMemo(() => parseWikiLinks(content), [content])
  const backlinks = useMemo(
    () => backlinksOf(allNotes.filter((n) => !n.trashed), { ...note, title, content }),
    [allNotes, note, title, content],
  )
  const slashItems = useMemo(() => {
    if (!slash) return [] as SlashCommand[]
    const q = slash.query.toLowerCase()
    if (!q) return SLASH_COMMANDS
    return SLASH_COMMANDS.filter(
      (c) => c.label.toLowerCase().includes(q) || c.keywords.some((k) => k.includes(q)),
    )
  }, [slash])

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
          <Menu
            align="end"
            label="AI 助手"
            trigger={
              <span
                title="AI 助手：摘要 / 重點 / 標籤 / 潤飾"
                className="inline-flex items-center justify-center rounded-lg p-1.5 text-accent transition hover:bg-accent-soft dark:text-accent dark:hover:bg-accent/15"
              >
                <Sparkles size={17} />
              </span>
            }
            items={[
              ...(Object.keys(AI_NOTE_TASKS) as AiKind[]).map((k) => ({
                id: k,
                label: AI_NOTE_TASKS[k].label,
                icon:
                  k === 'points'
                    ? ListChecks
                    : k === 'tags'
                      ? TagIcon
                      : k === 'polish'
                        ? Pencil
                        : Sparkles,
                onSelect: () => runAi(k),
              })),
              {
                id: 'proofread',
                label: '校對（錯字 / 知識）',
                icon: SpellCheck,
                onSelect: () => openTool('proof'),
              },
              {
                id: 'practice',
                label: '出練習',
                icon: FileQuestion,
                onSelect: () => openTool('practice'),
              },
            ]}
          />
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
              onChange={(e) => {
                setContent(e.target.value)
                detectSlash()
              }}
              onKeyDown={(e) => {
                if (!slash || slashItems.length === 0) return
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setSlashIdx((i) => Math.min(i + 1, slashItems.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setSlashIdx((i) => Math.max(i - 1, 0))
                } else if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault()
                  applySlash(slashItems[slashIdx] ?? slashItems[0])
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setSlash(null)
                } else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                  setSlash(null)
                }
              }}
              onBlur={() => setTimeout(() => setSlash(null), 150)}
              rows={Math.max(12, Math.min(28, content.split('\n').length + 2))}
              placeholder="由呢度落筆……　可以用 #標籤 歸類、- [ ] 整待辦，打 / 插入區塊。"
              className="border-0 bg-transparent px-0 text-[15px] leading-7 shadow-none focus:ring-0 dark:bg-transparent"
            />
            {slash && slashItems.length > 0 && (
              <div
                role="listbox"
                aria-label="插入區塊"
                className="absolute z-30 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
                style={{ top: slash.top + 44, left: 0 }}
              >
                <div className="border-b border-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:text-slate-500">
                  插入區塊
                </div>
                {slashItems.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={i === slashIdx}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      applySlash(c)
                    }}
                    onMouseEnter={() => setSlashIdx(i)}
                    className={cx(
                      'flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left text-sm transition',
                      i === slashIdx
                        ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700',
                    )}
                  >
                    <span className="font-medium">{c.label}</span>
                    <span className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                      {c.hint}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="relative">
            <PreviewBody
              lines={preview}
              onToggle={(idx) => setContent((c) => toggleTodoLine(c, idx))}
              onOpenLink={onOpenLink}
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

        {/* [[雙向連結]]：射出 + 反向連結 */}
        {(outgoing.length > 0 || backlinks.length > 0) && (
          <div className="space-y-1.5 border-t border-slate-200/60 pt-2 dark:border-slate-700/50">
            {outgoing.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  <Link2 size={12} /> 連結到
                </span>
                {outgoing.map((t) => {
                  const exists = Boolean(resolveNoteByTitle(allNotes, t))
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onOpenLink(t)}
                      title={exists ? `開「${t}」` : `建立並連結「${t}」`}
                      className={cx(
                        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition',
                        exists
                          ? 'bg-accent-soft text-accent-strong hover:brightness-95 dark:bg-accent/15 dark:text-accent'
                          : 'border border-dashed border-slate-300 text-slate-400 hover:border-accent hover:text-accent dark:border-slate-600',
                      )}
                    >
                      {t}
                      {!exists && <span aria-hidden="true"> ＋</span>}
                    </button>
                  )
                })}
              </div>
            )}
            {backlinks.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  <CornerUpLeft size={12} /> 被連結（{backlinks.length}）
                </span>
                {backlinks.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => onOpenNote(n.id)}
                    title={`開「${deriveTitle(n)}」`}
                    className="inline-flex max-w-[12rem] items-center truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    {deriveTitle(n)}
                  </button>
                ))}
              </div>
            )}
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

      {aiKind && (
        <AINoteModal
          kind={aiKind}
          content={content}
          onClose={() => setAiKind(null)}
          onApply={applyAi}
        />
      )}

      {proofOpen && (
        <ProofreadModal
          content={content}
          onApply={(next) => setContent(next)}
          onClose={() => setProofOpen(false)}
        />
      )}

      {practiceOpen && (
        <PracticeGenModal note={{ title, content }} onClose={() => setPracticeOpen(false)} />
      )}
    </div>
  )
}

// ───────── 預覽（待辦可勾選、標籤高亮）─────────
function PreviewBody({
  lines,
  onToggle,
  onOpenLink,
}: {
  lines: ReturnType<typeof parseLines>
  onToggle: (lineIndex: number) => void
  onOpenLink: (title: string) => void
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
                {renderInline(l.text, onOpenLink)}
              </span>
            </button>
          )
        }
        if (!l.text.trim()) return <div key={i} className="h-3" />
        return (
          <p key={i} className="whitespace-pre-wrap break-words px-1">
            {renderInline(l.text, onOpenLink)}
          </p>
        )
      })}
    </div>
  )
}

// 簡易 inline 渲染：高亮 #標籤 + 可點 [[雙向連結]]
// 註：用 <span role="link"> 而非 <button>，因為呢個可能渲染喺待辦行嘅 <button> 入面（避免巢狀 button）。
function renderInline(text: string, onLink?: (title: string) => void) {
  const parts = text.split(/(\[\[[^[\]]+\]\]|#[\p{L}\p{N}_-]+)/gu)
  return parts.map((p, i) => {
    if (p.startsWith('[[') && p.endsWith(']]') && p.length > 4) {
      const title = p.slice(2, -2).trim()
      return (
        <span
          key={i}
          role="link"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            onLink?.(title)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              onLink?.(title)
            }
          }}
          className="cursor-pointer rounded px-0.5 font-medium text-accent-strong underline decoration-accent/40 underline-offset-2 transition hover:bg-accent-soft hover:decoration-accent dark:text-accent dark:hover:bg-accent/15"
        >
          {title}
        </span>
      )
    }
    if (p.startsWith('#') && p.length > 1) {
      return (
        <span key={i} className="font-medium text-accent-strong dark:text-accent">
          {p}
        </span>
      )
    }
    return <span key={i}>{p}</span>
  })
}

// ───────── AI × 筆記 結果 Modal ─────────
function AINoteModal({
  kind,
  content,
  onClose,
  onApply,
}: {
  kind: AiKind
  content: string
  onClose: () => void
  onApply: (text: string, apply: 'append' | 'replace') => void
}) {
  const task = AI_NOTE_TASKS[kind]
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    setResult('')
    complete({
      messages: [{ role: 'user', content: task.prompt(content) }],
      system: AI_NOTE_SYSTEM,
      model: 'gemini-2.5-flash',
      temperature: 0.4,
      signal: ctrl.signal,
    })
      .then((out) => {
        if (cancelled) return
        setResult(out.trim())
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError((e as Error).message || 'AI 出錯')
        setLoading(false)
      })
    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [kind, content, task])

  const ready = !loading && !error && Boolean(result)

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={`AI · ${task.label}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            關閉
          </Button>
          <Button
            variant="secondary"
            icon={Copy}
            disabled={!ready}
            onClick={() => {
              navigator.clipboard?.writeText(result)
              toast.success('已複製')
            }}
          >
            複製
          </Button>
          <Button disabled={!ready} onClick={() => onApply(result, task.apply)}>
            {task.verb}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400">
          <Sparkles size={16} className="animate-pulse text-accent" /> AI 生成緊…
        </div>
      ) : error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      ) : (
        <div className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
          {result}
        </div>
      )}
    </Modal>
  )
}
