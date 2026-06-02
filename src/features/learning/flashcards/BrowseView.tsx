import { useMemo, useState } from 'react'
import { useCollection } from '../../../lib/store'
import { decksCol, cardsCol } from '../../../data/collections'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { todayStr } from '../../../lib/srs'
import type { Card } from '../../../data/types'
import {
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  Menu,
  Modal,
  Pills,
  Select,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  cx,
} from '../../../ui'
import {
  ArrowDownUp,
  Ban,
  CheckSquare,
  Flag,
  FolderInput,
  Library,
  Pencil,
  RotateCcw,
  Search,
  Square,
  Tag as TagIcon,
  Trash2,
  X,
} from 'lucide-react'
import { cardMetaCol, upsertMeta } from './store'
import {
  cardState,
  fmtInterval,
  isLeech,
  metaOf,
  STATE_LABEL,
  STATE_TONE,
} from './srs'
import type { BrowseSort, BrowseStateFilter, CardMeta, CardState } from './types'

// ============================================================
//  Browse（Anki Browser 級）
//  全卡表格 + 搜尋 + 狀態/標籤篩選 + 多欄排序 + 批量操作
//  （暫停 / 標記 / 加標籤 / 移牌組 / 重設排程 / 刪除）
// ============================================================

// metaById.get() 揾唔到時嘅 fallback，shape 同 metaOf() 內部 fallback 一致
const EMPTY_META: CardMeta = {
  id: '',
  tags: [],
  suspended: false,
  flagged: false,
  lapses: 0,
  updatedAt: '',
}

const SORT_OPTIONS: { id: BrowseSort; label: string }[] = [
  { id: 'created_desc', label: '最新加入' },
  { id: 'created_asc', label: '最早加入' },
  { id: 'due_asc', label: '到期日（近→遠）' },
  { id: 'due_desc', label: '到期日（遠→近）' },
  { id: 'interval_desc', label: '間隔（長→短）' },
  { id: 'lapses_desc', label: '最常答錯' },
  { id: 'alpha', label: '正面 A→Z' },
]

const STATE_FILTERS: { id: BrowseStateFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'due', label: '到期' },
  { id: 'new', label: '新卡' },
  { id: 'learning', label: '學習中' },
  { id: 'young', label: '生卡' },
  { id: 'mature', label: '熟卡' },
  { id: 'flagged', label: '已標記' },
  { id: 'leech', label: 'Leech' },
  { id: 'suspended', label: '已暫停' },
]

// 卡spine 色：同主畫面卡片身份脊一致（mature 熟＝綠、young 生＝accent、
// learning 學習＝琥珀、suspended 暫停＝灰、new 新＝藍），喺表列左緣呈現
const SPINE: Record<CardState, string> = {
  mature: 'border-emerald-400 dark:border-emerald-500/60',
  young: 'border-accent/70',
  learning: 'border-amber-400 dark:border-amber-500/60',
  suspended: 'border-slate-300 dark:border-slate-600',
  new: 'border-blue-400 dark:border-blue-500/60',
}

export default function BrowseView() {
  const decks = useCollection(decksCol)
  const allCards = useCollection(cardsCol)
  const metas = useCollection(cardMetaCol)
  const toast = useToast()
  const confirm = useConfirm()

  const [deckId, setDeckId] = useState<string>('all')
  const [q, setQ] = useState('')
  const [stateFilter, setStateFilter] = useState<BrowseStateFilter>('all')
  const [tagFilter, setTagFilter] = useState<string>('')
  const [sort, setSort] = useState<BrowseSort>('created_desc')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Card | null>(null)
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [moveModalOpen, setMoveModalOpen] = useState(false)

  const metaById = useMemo(() => new Map(metas.map((m) => [m.id, m])), [metas])
  const deckById = useMemo(() => new Map(decks.map((d) => [d.id, d])), [decks])

  // 所有用過嘅標籤
  const allTags = useMemo(() => {
    const s = new Set<string>()
    metas.forEach((m) => m.tags.forEach((t) => s.add(t)))
    return [...s].sort()
  }, [metas])

  // 篩選 + 搜尋
  const filtered = useMemo(() => {
    const today = todayStr()
    const kw = q.trim().toLowerCase()
    let list = allCards.filter((c) => (deckId === 'all' ? true : c.deckId === deckId))

    if (kw)
      list = list.filter(
        (c) =>
          c.front.toLowerCase().includes(kw) ||
          c.back.toLowerCase().includes(kw) ||
          (metaById.get(c.id)?.tags ?? []).some((t) => t.toLowerCase().includes(kw)),
      )

    if (tagFilter)
      list = list.filter((c) => (metaById.get(c.id)?.tags ?? []).includes(tagFilter))

    if (stateFilter !== 'all') {
      list = list.filter((c) => {
        const meta = metaById.get(c.id)
        if (stateFilter === 'due') return c.dueDate <= today && !meta?.suspended
        if (stateFilter === 'flagged') return !!meta?.flagged
        if (stateFilter === 'leech') return isLeech(meta)
        return cardState(c, meta) === stateFilter
      })
    }
    return list
  }, [allCards, deckId, q, tagFilter, stateFilter, metaById])

  // 排序
  const sorted = useMemo(() => {
    const arr = [...filtered]
    switch (sort) {
      case 'created_asc':
        return arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      case 'due_asc':
        return arr.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      case 'due_desc':
        return arr.sort((a, b) => b.dueDate.localeCompare(a.dueDate))
      case 'interval_desc':
        return arr.sort((a, b) => b.intervalDays - a.intervalDays)
      case 'lapses_desc':
        return arr.sort(
          (a, b) =>
            (metaById.get(b.id)?.lapses ?? 0) - (metaById.get(a.id)?.lapses ?? 0),
        )
      case 'alpha':
        return arr.sort((a, b) => a.front.localeCompare(b.front))
      default:
        return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
  }, [filtered, sort, metaById])

  // 選取
  const allSelected = sorted.length > 0 && sorted.every((c) => selected.has(c.id))
  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(sorted.map((c) => c.id)))
  }
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectedCards = sorted.filter((c) => selected.has(c.id))

  // ── 批量操作 ──────────────────────────────────
  const bulkSuspend = (suspend: boolean) => {
    selectedCards.forEach((c) => upsertMeta(c.id, { suspended: suspend }))
    toast.success(`已${suspend ? '暫停' : '解除暫停'} ${selectedCards.length} 張`)
    setSelected(new Set())
  }
  const bulkFlag = (flag: boolean) => {
    selectedCards.forEach((c) => upsertMeta(c.id, { flagged: flag }))
    toast.success(`已${flag ? '標記' : '取消標記'} ${selectedCards.length} 張`)
    setSelected(new Set())
  }
  const bulkResetSchedule = async () => {
    if (
      !(await confirm({
        title: '重設排程？',
        message: `${selectedCards.length} 張卡會變返「新卡」，由今日重新開始學。`,
        confirmText: '重設',
      }))
    )
      return
    selectedCards.forEach((c) =>
      cardsCol.update(c.id, {
        ease: 2.5,
        intervalDays: 0,
        repetitions: 0,
        dueDate: todayStr(),
        lastReviewed: undefined,
      }),
    )
    selectedCards.forEach((c) => upsertMeta(c.id, { lapses: 0 }))
    toast.success(`已重設 ${selectedCards.length} 張排程`)
    setSelected(new Set())
  }
  const bulkDelete = async () => {
    if (
      !(await confirm({
        title: `刪除 ${selectedCards.length} 張卡？`,
        message: '此操作無法復原。',
        confirmText: '刪除',
        tone: 'danger',
      }))
    )
      return
    selectedCards.forEach((c) => {
      cardsCol.remove(c.id)
      cardMetaCol.remove(c.id)
    })
    toast.success(`已刪除 ${selectedCards.length} 張`)
    setSelected(new Set())
  }

  return (
    <div className="space-y-3">
      {/* ───────── 卡盒索引台：全卡檢索 / 篩選（紅margin線 + kicker，呼應實體卡盒） ───────── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none">
        {/* 索引卡紅margin線 */}
        <span
          aria-hidden="true"
          className="block h-1 w-full bg-gradient-to-r from-rose-300/80 via-rose-400/70 to-rose-300/40 dark:from-rose-500/40 dark:via-rose-500/50 dark:to-rose-500/20"
        />
        <div className="space-y-3 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.28em] text-accent/70">
              <Library size={12} />
              卡盒索引
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              共 <span className="font-serif text-sm font-semibold tabular-nums slashed-zero text-slate-600 dark:text-slate-300">{allCards.length}</span> 張卡
            </p>
          </div>

          {/* 檢索工具列 */}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              icon={Search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜尋正面 / 背面 / 標籤…"
              className="min-w-[180px] flex-1"
            />
            <Select
              value={deckId}
              onChange={(e) => setDeckId(e.target.value)}
              className="w-auto"
              aria-label="牌組"
            >
              <option value="all">全部牌組</option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Menu
              align="end"
              trigger={
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 sm:text-sm">
                  <ArrowDownUp size={15} />
                  排序
                </span>
              }
              items={SORT_OPTIONS.map((o) => ({
                id: o.id,
                label: o.label + (sort === o.id ? '  ✓' : ''),
                onSelect: () => setSort(o.id),
              }))}
            />
          </div>

          {/* 狀態 Pills */}
          <Pills<BrowseStateFilter>
            size="sm"
            options={STATE_FILTERS}
            active={stateFilter}
            onChange={setStateFilter}
          />

          {/* 標籤篩選（虛線分隔，呼應卡盒分隔卡 divider） */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-dashed border-slate-200/80 pt-3 dark:border-slate-700/60">
              <TagIcon size={13} className="text-slate-400" />
              {allTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setTagFilter((prev) => (prev === t ? '' : t))}
                  className={cx(
                    'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition',
                    tagFilter === t
                      ? 'bg-accent text-white shadow-sm dark:shadow-none'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
                  )}
                >
                  #{t}
                </button>
              ))}
              {tagFilter && (
                <IconButton label="清除標籤篩選" size="sm" onClick={() => setTagFilter('')}>
                  <X size={13} />
                </IconButton>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 批量操作列 */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-accent/30 bg-accent-soft/50 px-3 py-2 dark:border-accent/40 dark:bg-accent/10">
          <span
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-strong dark:text-accent"
            aria-live="polite"
          >
            <CheckSquare size={15} />
            已選 <span className="tabular-nums">{selected.size}</span> 張
          </span>
          <span className="mx-1 h-4 w-px bg-accent/20" />
          <Button size="sm" variant="ghost" icon={Ban} onClick={() => bulkSuspend(true)}>
            暫停
          </Button>
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => bulkSuspend(false)}>
            解除
          </Button>
          <Button size="sm" variant="ghost" icon={Flag} onClick={() => bulkFlag(true)}>
            標記
          </Button>
          <Button size="sm" variant="ghost" icon={TagIcon} onClick={() => setTagModalOpen(true)}>
            加標籤
          </Button>
          <Button size="sm" variant="ghost" icon={FolderInput} onClick={() => setMoveModalOpen(true)}>
            移牌組
          </Button>
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => void bulkResetSchedule()}>
            重設排程
          </Button>
          <Button size="sm" variant="ghost" icon={Trash2} onClick={() => void bulkDelete()} className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">
            刪除
          </Button>
        </div>
      )}

      {/* 表格 */}
      {sorted.length === 0 ? (
        <EmptyState
          icon={Search}
          title="搵唔到符合嘅卡"
          hint={
            allCards.length === 0
              ? '仲未有任何卡片——去「牌組」加幾張，或匯入一批先。'
              : '試下換個關鍵字，或者放寬上面嘅篩選。'
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between px-1 text-xs text-slate-400 dark:text-slate-500">
            <button
              type="button"
              onClick={toggleAll}
              aria-pressed={allSelected}
              className="inline-flex items-center gap-1.5 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 rounded"
            >
              {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
              {allSelected ? '取消全選' : '全選'}
            </button>
            <span aria-live="polite">
              抽出{' '}
              <span className="font-serif text-sm font-semibold tabular-nums slashed-zero text-slate-600 dark:text-slate-300">
                {sorted.length}
              </span>{' '}
              張
            </span>
          </div>
          <Table>
            <Thead>
              <Tr>
                <Th className="w-8" />
                <Th>正面 / 背面</Th>
                <Th className="hidden sm:table-cell">牌組</Th>
                <Th align="center">狀態</Th>
                <Th align="right" className="hidden sm:table-cell">
                  下次
                </Th>
                <Th align="right">操作</Th>
              </Tr>
            </Thead>
            <Tbody>
              {sorted.map((c) => {
                const meta = metaById.get(c.id) ?? EMPTY_META
                const st = cardState(c, meta)
                const leech = isLeech(meta)
                const checked = selected.has(c.id)
                return (
                  <Tr key={c.id}>
                    {/* 卡spine：跟狀態色（呼應主畫面卡片身份脊）；放喺勾選格左緣 */}
                    <Td className={cx('border-l-2', SPINE[st])}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(c.id)}
                        aria-label="選取"
                        className="h-4 w-4 cursor-pointer accent-accent"
                      />
                    </Td>
                    <Td>
                      <div className="flex items-start gap-1.5">
                        <div className="min-w-0">
                          <p className="flex items-start gap-1.5 truncate font-medium text-slate-800 dark:text-slate-100">
                            <span className="mt-px shrink-0 font-serif text-[10px] font-bold uppercase tracking-wide text-slate-300 dark:text-slate-600">
                              Q
                            </span>
                            <span className="truncate">{c.front}</span>
                          </p>
                          <p className="flex items-start gap-1.5 truncate text-xs text-slate-400 dark:text-slate-500">
                            <span className="mt-px shrink-0 font-serif text-[10px] font-bold uppercase tracking-wide text-slate-300 dark:text-slate-600">
                              A
                            </span>
                            <span className="truncate">{c.back}</span>
                          </p>
                          {meta.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1 pl-4">
                              {meta.tags.map((t) => (
                                <span
                                  key={t}
                                  className="rounded bg-slate-100 px-1.5 py-px text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {meta.flagged && (
                          <Flag size={13} className="mt-0.5 shrink-0 fill-rose-500 text-rose-500" />
                        )}
                      </div>
                    </Td>
                    <Td className="hidden sm:table-cell">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {deckById.get(c.deckId)?.name ?? '—'}
                      </span>
                    </Td>
                    <Td align="center">
                      <div className="inline-flex flex-col items-center gap-0.5">
                        <Badge tone={STATE_TONE[st]}>{STATE_LABEL[st]}</Badge>
                        {leech && st !== 'suspended' && (
                          <span className="text-[9px] font-semibold text-rose-500">LEECH</span>
                        )}
                      </div>
                    </Td>
                    <Td numeric className="hidden sm:table-cell">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {c.repetitions === 0 ? '—' : fmtInterval(c.intervalDays)}
                      </span>
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-0.5">
                        <IconButton
                          label={meta.flagged ? '取消標記' : '標記'}
                          size="sm"
                          active={meta.flagged}
                          onClick={() => upsertMeta(c.id, { flagged: !meta.flagged })}
                        >
                          <Flag size={14} className={meta.flagged ? 'fill-current' : ''} />
                        </IconButton>
                        <IconButton
                          label={meta.suspended ? '解除暫停' : '暫停'}
                          size="sm"
                          active={meta.suspended}
                          onClick={() => upsertMeta(c.id, { suspended: !meta.suspended })}
                        >
                          <Ban size={14} />
                        </IconButton>
                        <IconButton label="編輯" size="sm" onClick={() => setEditing(c)}>
                          <Pencil size={14} />
                        </IconButton>
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        </>
      )}

      {/* 編輯卡 Modal */}
      {editing && (
        <EditCardModal
          card={editing}
          tags={metaOf(metas, editing.id).tags}
          note={metaOf(metas, editing.id).note}
          onClose={() => setEditing(null)}
        />
      )}

      {/* 批量加標籤 Modal */}
      <BulkTagModal
        open={tagModalOpen}
        existing={allTags}
        onClose={() => setTagModalOpen(false)}
        onApply={(tag) => {
          selectedCards.forEach((c) => {
            const cur = metaOf(metas, c.id).tags
            if (!cur.includes(tag)) upsertMeta(c.id, { tags: [...cur, tag] })
          })
          toast.success(`已為 ${selectedCards.length} 張加上 #${tag}`)
          setTagModalOpen(false)
          setSelected(new Set())
        }}
      />

      {/* 批量移牌組 Modal */}
      <Modal
        open={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        title={`移動 ${selected.size} 張到…`}
        size="sm"
      >
        <div className="space-y-2">
          {decks.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                selectedCards.forEach((c) => cardsCol.update(c.id, { deckId: d.id }))
                toast.success(`已移到「${d.name}」`)
                setMoveModalOpen(false)
                setSelected(new Set())
              }}
              className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left transition hover:-translate-y-px hover:border-accent hover:shadow-sm dark:border-slate-700 dark:hover:bg-accent/10"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 transition group-hover:bg-accent-soft group-hover:text-accent-strong dark:bg-slate-700/60 dark:text-slate-400 dark:group-hover:bg-accent/15 dark:group-hover:text-accent">
                <Library size={17} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 group-hover:text-accent dark:text-slate-200">
                {d.name}
              </span>
              <FolderInput size={15} className="shrink-0 text-slate-300 transition group-hover:text-accent dark:text-slate-600" />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}

// ───────── 編輯單張卡（正/背 + 標籤 + 備註）─────────
function EditCardModal({
  card,
  tags,
  note,
  onClose,
}: {
  card: Card
  tags: string[]
  note?: string
  onClose: () => void
}) {
  const toast = useToast()
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  const [tagList, setTagList] = useState<string[]>(tags)
  const [tagInput, setTagInput] = useState('')
  const [noteVal, setNoteVal] = useState(note ?? '')

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '')
    if (t && !tagList.includes(t)) setTagList((l) => [...l, t])
    setTagInput('')
  }
  const save = () => {
    if (!front.trim() || !back.trim()) {
      toast.error('正面同背面都要填')
      return
    }
    cardsCol.update(card.id, { front: front.trim(), back: back.trim() })
    upsertMeta(card.id, { tags: tagList, note: noteVal.trim() || undefined })
    toast.success('已儲存')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="編輯卡片"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save}>儲存</Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 這張卡：正/背一體呈現（紅margin線 + Q/A 行頭，呼應實體索引卡） */}
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-slate-700/60 dark:bg-slate-800">
          <span aria-hidden="true" className="block h-1 w-full bg-rose-300/70 dark:bg-rose-500/30" />
          <div className="space-y-2.5 p-3 sm:p-4">
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <span className="font-serif text-[11px] font-bold text-accent-strong dark:text-accent">Q</span>
                正面（問題）
              </span>
              <Input
                value={front}
                onChange={(e) => setFront(e.target.value)}
                autoFocus
                aria-label="正面（問題）"
              />
            </label>
            <div className="flex items-center gap-2" aria-hidden="true">
              <span className="h-px flex-1 bg-slate-200/80 dark:bg-slate-700/60" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-300 dark:text-slate-600">
                翻轉
              </span>
              <span className="h-px flex-1 bg-slate-200/80 dark:bg-slate-700/60" />
            </div>
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <span className="font-serif text-[11px] font-bold text-accent-strong dark:text-accent">A</span>
                背面（答案）
              </span>
              <Input
                value={back}
                onChange={(e) => setBack(e.target.value)}
                aria-label="背面（答案）"
              />
            </label>
          </div>
        </div>

        <Field label="標籤">
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {tagList.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs text-accent-strong dark:bg-accent/15 dark:text-accent"
              >
                #{t}
                <button
                  type="button"
                  aria-label={`移除標籤 ${t}`}
                  onClick={() => setTagList((l) => l.filter((x) => x !== t))}
                  className="rounded hover:text-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              }
            }}
            placeholder="輸入標籤，Enter 加入"
            aria-label="新增標籤"
          />
        </Field>
        <Field label="私人備註（選填）">
          <Input
            value={noteVal}
            onChange={(e) => setNoteVal(e.target.value)}
            placeholder="額外提示 / 記憶法"
            aria-label="私人備註（選填）"
          />
        </Field>
      </div>
    </Modal>
  )
}

// ───────── 批量加標籤 Modal ─────────
function BulkTagModal({
  open,
  existing,
  onClose,
  onApply,
}: {
  open: boolean
  existing: string[]
  onClose: () => void
  onApply: (tag: string) => void
}) {
  const [val, setVal] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="加標籤" size="sm">
      <div className="space-y-3">
        <Input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && val.trim()) onApply(val.trim().replace(/^#/, ''))
          }}
          placeholder="輸入新標籤名"
          autoFocus
        />
        {existing.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {existing.map((t) => (
              <button
                key={t}
                onClick={() => onApply(t)}
                className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 transition hover:bg-accent hover:text-white dark:bg-slate-800 dark:text-slate-300"
              >
                #{t}
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <Button
            onClick={() => val.trim() && onApply(val.trim().replace(/^#/, ''))}
            disabled={!val.trim()}
          >
            套用
          </Button>
        </div>
      </div>
    </Modal>
  )
}
