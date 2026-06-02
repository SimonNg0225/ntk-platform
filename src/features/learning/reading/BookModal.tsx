import { useMemo, useState } from 'react'
import {
  BookOpen,
  CalendarDays,
  ExternalLink,
  Plus,
  Star,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import {
  Badge,
  Button,
  Field,
  Input,
  Modal,
  ProgressBar,
  SegmentedControl,
  Separator,
  Textarea,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import {
  booksCol,
  FORMAT_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  STATUS_TONE,
  type Book,
  type BookFormat,
  type BookStatus,
} from './types'
import { StarRating } from './StarRating'
import {
  daysBetween,
  progressPct,
  readingPace,
  relativeLabel,
  todayKey,
  totalPagesRead,
} from './util'
import { uid } from '../../../lib/store'

const FORMAT_OPTS: { id: BookFormat; label: string }[] = (
  Object.keys(FORMAT_LABEL) as BookFormat[]
).map((f) => ({ id: f, label: FORMAT_LABEL[f] }))

export default function BookModal({
  book,
  allShelves,
  onClose,
}: {
  book: Book
  allShelves: string[]
  onClose: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()

  // 局部草稿（散欄位即時寫回；長文本失焦先存）
  const [review, setReview] = useState(book.review ?? '')
  const [notes, setNotes] = useState(book.notes ?? '')
  const [shelfInput, setShelfInput] = useState('')

  // 加閱讀時段
  const [logPages, setLogPages] = useState('')
  const [logMinutes, setLogMinutes] = useState('')
  const [logDate, setLogDate] = useState(todayKey())

  const patch = (p: Partial<Book>) => booksCol.update(book.id, p)

  const pct = progressPct(book)
  const pagesRead = totalPagesRead(book)
  const span = daysBetween(book.startedOn, book.finishedOn)
  const pace = readingPace(book)

  const shelfSuggestions = useMemo(
    () => allShelves.filter((s) => !book.shelves.includes(s)),
    [allShelves, book.shelves],
  )

  function setStatus(status: BookStatus) {
    const p: Partial<Book> = { status }
    if (status === 'reading' && !book.startedOn) p.startedOn = todayKey()
    if (status === 'done') {
      p.finishedOn = book.finishedOn ?? todayKey()
      if (book.totalPages) p.currentPage = book.totalPages
    }
    patch(p)
  }

  function setPage(v: string) {
    const n = Math.max(0, Math.round(Number(v) || 0))
    patch({ currentPage: book.totalPages ? Math.min(n, book.totalPages) : n })
  }

  function addShelf(name: string) {
    const s = name.trim()
    if (!s || book.shelves.includes(s)) return
    patch({ shelves: [...book.shelves, s] })
    setShelfInput('')
  }

  function removeShelf(s: string) {
    patch({ shelves: book.shelves.filter((x) => x !== s) })
  }

  function logSession() {
    const pages = Math.max(0, Math.round(Number(logPages) || 0))
    const minutes = Math.max(0, Math.round(Number(logMinutes) || 0))
    if (pages <= 0 && minutes <= 0) {
      toast.error('輸入閱讀頁數或時間')
      return
    }
    const session = {
      id: uid(),
      date: logDate || todayKey(),
      pages,
      minutes: minutes || undefined,
    }
    const nextCurrent = Math.min(
      book.totalPages ?? Number.MAX_SAFE_INTEGER,
      (book.currentPage ?? 0) + pages,
    )
    const p: Partial<Book> = {
      sessions: [...book.sessions, session],
      currentPage: nextCurrent,
    }
    if (book.status === 'to_read') {
      p.status = 'reading'
      p.startedOn = book.startedOn ?? session.date
    }
    patch(p)
    setLogPages('')
    setLogMinutes('')
    toast.success('已記錄閱讀')
  }

  function delSession(id: string) {
    patch({ sessions: book.sessions.filter((s) => s.id !== id) })
  }

  async function delBook() {
    const ok = await confirm({
      title: '刪除呢本書？',
      message: `「${book.title}」連同所有評分、筆記、閱讀記錄會被永久刪除。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    booksCol.remove(book.id)
    toast.success('已刪除')
    onClose()
  }

  const sortedSessions = [...book.sessions].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      footer={
        <>
          <Button variant="danger" onClick={delBook} icon={Trash2}>
            刪除
          </Button>
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            完成
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[160px_1fr]">
        {/* ── 左：封面 + 狀態 ── */}
        <div className="space-y-3">
          <div className="relative mx-auto aspect-[2/3] w-32 overflow-hidden rounded-lg bg-gradient-to-br from-accent-soft to-slate-100 shadow-sm ring-1 ring-slate-200 dark:from-accent/15 dark:to-slate-800 dark:ring-slate-700 sm:w-full">
            {book.cover ? (
              <img src={book.cover} alt={book.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center">
                <BookOpen size={26} className="text-accent" />
                <span className="mt-1.5 line-clamp-3 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {book.title}
                </span>
              </div>
            )}
            {book.favorite && (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-amber-500 shadow dark:bg-slate-900/80">
                <Star size={13} fill="currentColor" />
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cx(
                  'rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                  book.status === s
                    ? 'border-accent bg-accent text-white shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          <Button
            variant={book.favorite ? 'primary' : 'secondary'}
            size="sm"
            fullWidth
            icon={Star}
            onClick={() => patch({ favorite: !book.favorite })}
          >
            {book.favorite ? '已收藏' : '收藏'}
          </Button>
        </div>

        {/* ── 右：詳情 ── */}
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="書名">
              <Input
                value={book.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="書名"
              />
            </Field>
            <Field label="作者">
              <Input
                value={book.author ?? ''}
                onChange={(e) => patch({ author: e.target.value || undefined })}
                placeholder="作者"
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">評分</p>
              <StarRating value={book.rating ?? 0} onChange={(v) => patch({ rating: v || undefined })} />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">格式</p>
              <SegmentedControl
                size="sm"
                options={FORMAT_OPTS}
                value={book.format ?? 'paper'}
                onChange={(f) => patch({ format: f })}
              />
            </div>
          </div>

          {/* 進度 */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-slate-700/60 dark:bg-slate-800/40">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">閱讀進度</p>
              <Badge tone={STATUS_TONE[book.status]} dot>
                {STATUS_LABEL[book.status]}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={book.currentPage ?? ''}
                onChange={(e) => setPage(e.target.value)}
                placeholder="0"
                className="w-20 text-center tabular-nums"
              />
              <span className="text-sm text-slate-400">/</span>
              <Input
                type="number"
                value={book.totalPages ?? ''}
                onChange={(e) =>
                  patch({ totalPages: e.target.value ? Math.max(0, Math.round(Number(e.target.value))) : undefined })
                }
                placeholder="總頁數"
                className="w-24 text-center tabular-nums"
              />
              <span className="text-xs text-slate-400">頁</span>
              <span className={cx('ml-auto text-lg font-bold tabular-nums', book.status === 'done' ? 'text-emerald-500' : 'text-accent')}>{pct}%</span>
            </div>
            <ProgressBar
              value={pct}
              tone={book.status === 'done' ? 'green' : 'accent'}
              className="mt-2.5"
            />
            {pace && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <TrendingUp size={13} className="shrink-0 text-accent" />
                <span>
                  約每日 <span className="tabular-nums font-medium text-slate-600 dark:text-slate-300">{Math.round(pace.pagesPerDay)}</span> 頁
                  {' · 預計 '}
                  <span className="tabular-nums font-medium text-slate-600 dark:text-slate-300">{relativeLabel(pace.etaKey)}</span>讀完
                </span>
              </p>
            )}
          </div>

          {/* 加閱讀時段 */}
          <div className="rounded-2xl border border-dashed border-slate-300/80 p-3.5 dark:border-slate-600/80">
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <CalendarDays size={14} className="text-accent" /> 記錄一次閱讀
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-base sm:text-xs text-slate-700 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <Input
                type="number"
                value={logPages}
                onChange={(e) => setLogPages(e.target.value)}
                placeholder="頁數"
                className="w-20 tabular-nums"
                onKeyDown={(e) => e.key === 'Enter' && logSession()}
              />
              <Input
                type="number"
                value={logMinutes}
                onChange={(e) => setLogMinutes(e.target.value)}
                placeholder="分鐘"
                className="w-20 tabular-nums"
                onKeyDown={(e) => e.key === 'Enter' && logSession()}
              />
              <Button size="sm" icon={Plus} onClick={logSession}>
                記錄
              </Button>
            </div>

            {sortedSessions.length > 0 && (
              <div className="mt-3 max-h-32 space-y-1 overflow-y-auto">
                {sortedSessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1 text-xs dark:bg-slate-800/60"
                  >
                    <span className="text-slate-500 dark:text-slate-400">{relativeLabel(s.date)}</span>
                    <span className="tabular-nums font-medium text-slate-700 dark:text-slate-200">
                      {s.pages} 頁
                    </span>
                    {s.minutes ? (
                      <span className="tabular-nums text-slate-400">· {s.minutes} 分鐘</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => delSession(s.id)}
                      className="-my-1 -mr-1 ml-auto inline-flex shrink-0 items-center justify-center rounded p-1.5 text-slate-300 transition-colors hover:text-rose-500 dark:text-slate-600"
                      aria-label="刪除記錄"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 書架標籤 */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">書架 / 標籤</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {book.shelves.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-strong dark:bg-accent/15 dark:text-accent"
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => removeShelf(s)}
                    aria-label={`移除 ${s}`}
                    className="-my-1 -mr-1.5 inline-flex shrink-0 items-center justify-center rounded-full p-1.5 transition-colors hover:text-rose-500"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <Input
                value={shelfInput}
                onChange={(e) => setShelfInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addShelf(shelfInput)}
                placeholder="加標籤…"
                className="h-8 w-28 py-1 text-xs"
              />
            </div>
            {shelfSuggestions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {shelfSuggestions.slice(0, 8).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addShelf(s)}
                    className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 transition-colors hover:border-accent hover:text-accent dark:border-slate-700 dark:text-slate-400"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <Field label="心得 / 評語">
            <Textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              onBlur={() => patch({ review: review.trim() || undefined })}
              rows={3}
              placeholder="呢本書帶俾你嘅嘢…"
            />
          </Field>

          <Field label="私人筆記">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => patch({ notes: notes.trim() || undefined })}
              rows={2}
              placeholder="金句、重點、待辦…"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
            <Field label="連結（選填）">
              <Input
                value={book.url ?? ''}
                onChange={(e) => patch({ url: e.target.value || undefined })}
                placeholder="https://…"
                className="w-full sm:w-72"
              />
            </Field>
            {book.url && (
              <a href={book.url} target="_blank" rel="noreferrer" className="mt-5">
                <Button size="sm" variant="ghost" icon={ExternalLink}>
                  開啟
                </Button>
              </a>
            )}
          </div>

          {(span || pagesRead > 0) && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {pagesRead > 0 && (
                <>
                  已讀 <span className="tabular-nums">{pagesRead.toLocaleString()}</span> 頁
                </>
              )}
              {span && (
                <>
                  {pagesRead > 0 && ' · '}歷時 <span className="tabular-nums">{span}</span> 日讀完
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
