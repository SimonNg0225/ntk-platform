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
import type { BrowseSort, BrowseStateFilter } from './types'

// ============================================================
//  Browse（Anki Browser 級）
//  全卡表格 + 搜尋 + 狀態/標籤篩選 + 多欄排序 + 批量操作
//  （暫停 / 標記 / 加標籤 / 移牌組 / 重設排程 / 刪除）
// ============================================================

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
      {/* 工具列 */}
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
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
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

      {/* 標籤篩選 */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <TagIcon size={13} className="text-slate-400" />
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setTagFilter((prev) => (prev === t ? '' : t))}
              className={cx(
                'rounded-md px-2 py-0.5 text-[11px] font-medium transition',
                tagFilter === t
                  ? 'bg-accent text-white'
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

      {/* 批量操作列 */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft/50 px-3 py-2 dark:border-accent/40 dark:bg-accent/10">
          <span className="text-sm font-medium text-accent-strong dark:text-accent">
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
        <EmptyState icon={Search} title="冇符合嘅卡" hint="調整搜尋或篩選條件。" />
      ) : (
        <>
          <div className="flex items-center justify-between px-1 text-xs text-slate-400 dark:text-slate-500">
            <button
              onClick={toggleAll}
              className="inline-flex items-center gap-1.5 hover:text-accent"
            >
              {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
              {allSelected ? '取消全選' : '全選'}
            </button>
            <span className="tabular-nums">{sorted.length} 張</span>
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
                const meta = metaOf(metas, c.id)
                const st = cardState(c, meta)
                const leech = isLeech(meta)
                const checked = selected.has(c.id)
                return (
                  <Tr key={c.id}>
                    <Td>
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
                          <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                            {c.front}
                          </p>
                          <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                            {c.back}
                          </p>
                          {meta.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
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
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm transition hover:border-accent hover:bg-accent-soft dark:border-slate-700 dark:hover:bg-accent/10"
            >
              <span className="font-medium text-slate-700 dark:text-slate-200">{d.name}</span>
              <FolderInput size={15} className="text-slate-400" />
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
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            正面（問題）
          </label>
          <Input value={front} onChange={(e) => setFront(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            背面（答案）
          </label>
          <Input value={back} onChange={(e) => setBack(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            標籤
          </label>
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {tagList.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-xs text-accent-strong dark:bg-accent/15 dark:text-accent"
              >
                #{t}
                <button
                  onClick={() => setTagList((l) => l.filter((x) => x !== t))}
                  className="hover:text-rose-500"
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
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            私人備註（選填）
          </label>
          <Input
            value={noteVal}
            onChange={(e) => setNoteVal(e.target.value)}
            placeholder="額外提示 / 記憶法"
          />
        </div>
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
