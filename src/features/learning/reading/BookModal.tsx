import { useMemo, useState } from 'react'
import {
  Bookmark,
  BookOpen,
  CalendarDays,
  ExternalLink,
  Library,
  Link2,
  NotebookPen,
  PencilLine,
  Plus,
  Star,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import {
  Badge,
  Button,
  Input,
  Modal,
  ProgressBar,
  SegmentedControl,
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
      {/* ── 借閱卡卡頭：全寬卡紙 + 燙金細線（呼應書房 CatalogueCard）── */}
      <div className="-mx-5 -mt-5 mb-5 sm:-mx-6 sm:-mt-6">
        <div className="h-1 bg-gradient-to-r from-amber-200/70 via-accent/30 to-transparent dark:from-slate-700 dark:via-slate-700/60" />
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 bg-gradient-to-b from-amber-50/50 to-transparent px-5 pb-3.5 pt-3 dark:border-slate-700/60 dark:from-slate-800/50 sm:px-6">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.28em] text-accent/70">
              <Library size={12} /> Catalogue Card · 借閱卡
            </p>
            <h3 className="mt-1 truncate text-lg font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100">
              {book.title || '未命名書本'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="-mr-1 mt-0.5 shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[160px_1fr]">
        {/* ── 左：書脊封面 + 借閱狀態 ── */}
        <div className="space-y-3">
          {/* 封面：左脊高光 + 脊頂燙金雙線（與書庫卡片同一套書脊語彙）*/}
          <div className="relative mx-auto aspect-[2/3] w-32 overflow-hidden rounded-r-lg rounded-l-sm bg-gradient-to-br from-accent-soft to-slate-100 shadow-md ring-1 ring-slate-200 dark:from-accent/15 dark:to-slate-800 dark:ring-slate-700 sm:w-full">
            {book.cover ? (
              <img src={book.cover} alt={book.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center p-2 text-center">
                <BookOpen size={26} className="text-accent" />
                <span className="mt-1.5 line-clamp-3 text-[12px] font-semibold leading-tight text-slate-600 dark:text-slate-300">
                  {book.title}
                </span>
              </div>
            )}
            {/* 左側書脊高光：營造立體書本邊 */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/15 via-black/5 to-transparent dark:from-black/35"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-1.5 w-px bg-white/30 dark:bg-white/10"
            />
            {/* 脊頂燙金雙線 */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-2.5 top-2 h-px bg-amber-300/50 dark:bg-amber-300/20" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-2.5 top-2.5 h-px bg-amber-300/35 dark:bg-amber-300/15" />
            {book.favorite && (
              <span className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-amber-500 shadow dark:bg-slate-900/80">
                <Star size={13} fill="currentColor" />
              </span>
            )}
            {/* 讀完角標：絲帶角（與書庫卡片一致）*/}
            {book.status === 'done' && (
              <span
                aria-hidden="true"
                title={STATUS_LABEL.done}
                className="absolute -right-px -top-px h-0 w-0 border-b-[22px] border-l-[22px] border-b-emerald-500 border-l-transparent drop-shadow-sm"
              />
            )}
          </div>

          {/* 借閱狀態：卡上四格圖章式選擇 */}
          <div>
            <CardLabel icon={Bookmark}>借閱狀態</CardLabel>
            <div className="grid grid-cols-2 gap-1.5">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  aria-pressed={book.status === s}
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

        {/* ── 右：借閱卡內容 ── */}
        <div className="min-w-0 space-y-4">
          {/* 著錄欄：書名 / 作者（卡上手寫底線格）*/}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <CardLabel>書名</CardLabel>
              <Input
                value={book.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="書名"
                className=""
              />
            </div>
            <div>
              <CardLabel>作者</CardLabel>
              <Input
                value={book.author ?? ''}
                onChange={(e) => patch({ author: e.target.value || undefined })}
                placeholder="作者"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div>
              <CardLabel icon={Star}>評分</CardLabel>
              <StarRating value={book.rating ?? 0} onChange={(v) => patch({ rating: v || undefined })} />
            </div>
            <div>
              <CardLabel icon={BookOpen}>裝幀</CardLabel>
              <SegmentedControl
                size="sm"
                options={FORMAT_OPTS}
                value={book.format ?? 'paper'}
                onChange={(f) => patch({ format: f })}
              />
            </div>
          </div>

          {/* 進度：借閱卡式卡紙 + 燙金頂線 */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-amber-50/40 to-white dark:border-slate-700/60 dark:from-slate-800/50 dark:to-slate-800/30">
            <div className="h-0.5 bg-gradient-to-r from-amber-200/70 via-accent/30 to-transparent dark:from-slate-700 dark:via-slate-700/60" />
            <div className="p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight text-slate-700 dark:text-slate-200">
                <Bookmark size={13} className="text-accent" /> 閱讀進度
              </p>
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
              <span className={cx('ml-auto text-xl font-semibold tabular-nums slashed-zero leading-none', book.status === 'done' ? 'text-emerald-500' : 'text-accent')}>{pct}%</span>
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
          </div>

          {/* 借閱日誌：記錄一次閱讀（撕條式借書登記）*/}
          <div className="rounded-2xl border border-dashed border-slate-300/80 p-3.5 dark:border-slate-600/80">
            <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold tracking-tight text-slate-700 dark:text-slate-200">
              <CalendarDays size={14} className="text-accent" /> 借閱日誌 · 記一次閱讀
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
              <div className="mt-3 max-h-32 space-y-1 overflow-y-auto border-t border-dashed border-slate-200 pt-2.5 dark:border-slate-700/70">
                {sortedSessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-amber-50/60 dark:hover:bg-slate-800/60"
                  >
                    {/* 借閱日期戳：細框 + 等寬數字（似圖書館 due-date 印章）*/}
                    <span className="inline-flex shrink-0 items-center rounded-[5px] border border-slate-300/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:border-slate-600/70 dark:text-slate-400">
                      {relativeLabel(s.date)}
                    </span>
                    <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200">
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

          {/* 書架標籤：索書 / 分類籤 */}
          <div>
            <CardLabel icon={Bookmark}>書架 / 標籤</CardLabel>
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

          {/* 卡背札記分隔：細線 + serif 小題（似卡片翻面）*/}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              卡背 · 札記
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700/70" />
          </div>

          <div>
            <CardLabel icon={PencilLine}>心得 / 評語</CardLabel>
            <Textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              onBlur={() => patch({ review: review.trim() || undefined })}
              rows={3}
              placeholder="呢本書帶俾你嘅嘢…"
            />
          </div>

          <div>
            <CardLabel icon={NotebookPen}>私人筆記</CardLabel>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => patch({ notes: notes.trim() || undefined })}
              rows={2}
              placeholder="金句、重點、待辦…"
            />
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <CardLabel icon={Link2}>連結（選填）</CardLabel>
              <Input
                value={book.url ?? ''}
                onChange={(e) => patch({ url: e.target.value || undefined })}
                placeholder="https://…"
                className="w-full"
              />
            </div>
            {book.url && (
              <a href={book.url} target="_blank" rel="noreferrer">
                <Button size="sm" variant="ghost" icon={ExternalLink}>
                  開啟
                </Button>
              </a>
            )}
          </div>

          {/* 卡腳著錄：累計閱讀（似借閱卡底紀錄）*/}
          {(span || pagesRead > 0) && (
            <p className="border-t border-dashed border-slate-200 pt-2.5 text-[11px] text-slate-400 dark:border-slate-700/70 dark:text-slate-500">
              {pagesRead > 0 && (
                <>
                  累計已讀 <span className="font-semibold tabular-nums slashed-zero text-slate-500 dark:text-slate-400">{pagesRead.toLocaleString()}</span> 頁
                </>
              )}
              {span && (
                <>
                  {pagesRead > 0 && ' · '}歷時 <span className="font-semibold tabular-nums slashed-zero text-slate-500 dark:text-slate-400">{span}</span> 日讀完
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ───────── 借閱卡欄目標籤（serif 小題 + 細點，與書房 CatalogueCard 同語彙）─────────
function CardLabel({
  children,
  icon: I,
}: {
  children: React.ReactNode
  icon?: import('lucide-react').LucideIcon
}) {
  return (
    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
      {I && <I size={11} className="text-accent/70" />}
      {children}
    </p>
  )
}
