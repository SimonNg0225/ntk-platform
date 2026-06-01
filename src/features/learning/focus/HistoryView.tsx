import { useMemo, useState } from 'react'
import {
  Search,
  Download,
  Plus,
  Trash2,
  Pencil,
  Brain,
  Coffee,
  Filter,
  Calendar,
} from 'lucide-react'
import {
  Input,
  Select,
  Button,
  Badge,
  EmptyState,
  Modal,
  Field,
  Textarea,
  IconButton,
  Menu,
  SegmentedControl,
  Tooltip,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useConfirm } from '../../../context/ConfirmContext'
import {
  focusLogsCol,
  fmtDuration,
  fmtTime,
  keyOf,
  relativeDay,
  logsToCsv,
  dayKey,
} from './store'
import type { FocusKind, FocusLog, FocusProject } from './types'
import { paletteOf } from './charts'

type SortKey = 'time-desc' | 'time-asc' | 'dur-desc' | 'rating-desc'
type KindFilter = 'all' | 'focus' | 'break'

const KIND_BADGE: Record<FocusKind, { label: string; tone: 'accent' | 'green' | 'amber'; icon: typeof Brain }> = {
  focus: { label: '專注', tone: 'accent', icon: Brain },
  short_break: { label: '短休', tone: 'green', icon: Coffee },
  long_break: { label: '長休', tone: 'amber', icon: Coffee },
}

export default function HistoryView({
  logs,
  projects,
}: {
  logs: FocusLog[]
  projects: FocusProject[]
}) {
  const toast = useToast()
  const confirm = useConfirm()

  const [q, setQ] = useState('')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('time-desc')

  const [editing, setEditing] = useState<FocusLog | null>(null)
  const [adding, setAdding] = useState(false)

  const projName = (id?: string) => projects.find((p) => p.id === id)?.name
  const projColor = (id?: string) => projects.find((p) => p.id === id)?.color

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    let out = logs.filter((l) => {
      if (kindFilter === 'focus' && l.kind !== 'focus') return false
      if (kindFilter === 'break' && l.kind === 'focus') return false
      if (projectFilter !== 'all') {
        if (projectFilter === 'none' && l.projectId) return false
        if (projectFilter !== 'none' && l.projectId !== projectFilter) return false
      }
      if (qq) {
        const hay = [l.label, l.note, ...(l.tags ?? []), projName(l.projectId)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(qq)) return false
      }
      return true
    })
    out = out.slice().sort((a, b) => {
      switch (sort) {
        case 'time-asc':
          return a.startedAt.localeCompare(b.startedAt)
        case 'dur-desc':
          return b.actualMin - a.actualMin
        case 'rating-desc':
          return (b.rating ?? 0) - (a.rating ?? 0)
        default:
          return b.startedAt.localeCompare(a.startedAt)
      }
    })
    return out
  }, [logs, q, kindFilter, projectFilter, sort])

  // 按日分組（只喺時間排序時）
  const grouped = useMemo(() => {
    if (sort !== 'time-desc' && sort !== 'time-asc') return null
    const map = new Map<string, FocusLog[]>()
    for (const l of filtered) {
      const k = keyOf(l.startedAt)
      const arr = map.get(k)
      if (arr) arr.push(l)
      else map.set(k, [l])
    }
    return [...map.entries()]
  }, [filtered, sort])

  async function del(l: FocusLog) {
    const ok = await confirm({
      title: '刪除呢節紀錄？',
      message: '統計數據會即時更新，此操作無法復原。',
      tone: 'danger',
      confirmText: '刪除',
    })
    if (!ok) return
    focusLogsCol.remove(l.id)
    toast.success('已刪除')
  }

  function exportCsv() {
    const csv = logsToCsv(filtered, (id) => projName(id) ?? '')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `focus-history-${dayKey(new Date())}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`已匯出 ${filtered.length} 筆`)
  }

  const dayTotal = (arr: FocusLog[]) =>
    arr.filter((l) => l.kind === 'focus' && l.completed).reduce((s, l) => s + l.actualMin, 0)

  return (
    <div className="space-y-4">
      {/* 工具列 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          icon={Search}
          placeholder="搜尋任務、標籤、筆記…"
          className="flex-1"
        />
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl<KindFilter>
            size="sm"
            value={kindFilter}
            onChange={setKindFilter}
            options={[
              { id: 'all', label: '全部' },
              { id: 'focus', label: '專注' },
              { id: 'break', label: '休息' },
            ]}
          />
          <Select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-32"
            aria-label="專案篩選"
          >
            <option value="all">全部專案</option>
            <option value="none">無專案</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Menu
            align="end"
            trigger={
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Filter size={14} />
                排序
              </span>
            }
            items={[
              { id: 'time-desc', label: '最新優先', onSelect: () => setSort('time-desc') },
              { id: 'time-asc', label: '最舊優先', onSelect: () => setSort('time-asc') },
              { id: 'dur-desc', label: '時長最長', onSelect: () => setSort('dur-desc') },
              { id: 'rating-desc', label: '評分最高', onSelect: () => setSort('rating-desc') },
            ]}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p aria-live="polite" className="text-xs text-slate-400">
          共 <span className="font-medium tabular-nums text-slate-600 dark:text-slate-300">{filtered.length}</span> 筆紀錄
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={Download} onClick={exportCsv} disabled={!filtered.length}>
            匯出 CSV
          </Button>
          <Button size="sm" icon={Plus} onClick={() => setAdding(true)}>
            補記一節
          </Button>
        </div>
      </div>

      {/* 清單 */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="未有符合的紀錄"
          hint="調整篩選，或喺計時器完成一節專注。"
        />
      ) : grouped ? (
        <div className="space-y-5">
          {grouped.map(([key, arr]) => (
            <div key={key}>
              <div className="mb-2.5 flex items-center gap-2.5">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {relativeDay(key)}
                </h3>
                <span className="h-px flex-1 bg-slate-200/70 dark:bg-slate-700/50" />
                {dayTotal(arr) > 0 && (
                  <Badge tone="accent">{fmtDuration(dayTotal(arr))}</Badge>
                )}
              </div>
              <div className="space-y-2">
                {arr.map((l) => (
                  <LogRow
                    key={l.id}
                    log={l}
                    projName={projName(l.projectId)}
                    projColor={projColor(l.projectId)}
                    onEdit={() => setEditing(l)}
                    onDelete={() => del(l)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((l) => (
            <LogRow
              key={l.id}
              log={l}
              projName={projName(l.projectId)}
              projColor={projColor(l.projectId)}
              onEdit={() => setEditing(l)}
              onDelete={() => del(l)}
            />
          ))}
        </div>
      )}

      {editing && (
        <EditModal log={editing} projects={projects} onClose={() => setEditing(null)} />
      )}
      {adding && <AddModal projects={projects} onClose={() => setAdding(false)} />}
    </div>
  )
}

// ───────── 單行紀錄 ─────────
function LogRow({
  log,
  projName,
  projColor,
  onEdit,
  onDelete,
}: {
  log: FocusLog
  projName?: string
  projColor?: string
  onEdit: () => void
  onDelete: () => void
}) {
  const meta = KIND_BADGE[log.kind]
  const pal = paletteOf(projColor)
  return (
    <div
      className={cx(
        'group flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600',
        !log.completed && 'opacity-70',
      )}
    >
      <span className={cx('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', log.kind === 'focus' ? pal.soft : 'bg-slate-100 dark:bg-slate-700')}>
        <meta.icon size={16} className={log.kind === 'focus' ? pal.text : 'text-slate-400'} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
            {log.label || meta.label}
          </span>
          {!log.completed && <Badge tone="rose">未完成</Badge>}
          {projName && (
            <span className={cx('inline-flex items-center gap-1 text-[11px]', pal.text)}>
              <span className={cx('h-1.5 w-1.5 rounded-full', pal.dot)} />
              {projName}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
          <span className="tabular-nums">
            {fmtTime(log.startedAt)}–{fmtTime(log.endedAt)}
          </span>
          <span>·</span>
          <span className="tabular-nums font-medium text-slate-500 dark:text-slate-400">
            {fmtDuration(log.actualMin)}
          </span>
          {log.actualMin !== log.plannedMin && (
            <span className="tabular-nums">（計劃 {log.plannedMin}分）</span>
          )}
          {typeof log.rating === 'number' && (
            <span className="text-amber-500">{'★'.repeat(log.rating)}</span>
          )}
          {typeof log.interruptions === 'number' && log.interruptions > 0 && (
            <span>· 分心 {log.interruptions}</span>
          )}
        </div>
        {log.tags && log.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {log.tags.map((t) => (
              <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                #{t}
              </span>
            ))}
          </div>
        )}
        {log.note && (
          <p className="mt-1 line-clamp-2 text-xs italic text-slate-500 dark:text-slate-400">
            “{log.note}”
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 transition focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        <Tooltip label="編輯">
          <IconButton label="編輯" size="md" className="p-2" onClick={onEdit}>
            <Pencil size={15} />
          </IconButton>
        </Tooltip>
        <Tooltip label="刪除">
          <IconButton label="刪除" size="md" className="p-2" tone="danger" onClick={onDelete}>
            <Trash2 size={15} />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  )
}

// ───────── 編輯 modal ─────────
function EditModal({
  log,
  projects,
  onClose,
}: {
  log: FocusLog
  projects: FocusProject[]
  onClose: () => void
}) {
  const toast = useToast()
  const [label, setLabel] = useState(log.label ?? '')
  const [projectId, setProjectId] = useState(log.projectId ?? '')
  const [rating, setRating] = useState(log.rating ?? 0)
  const [note, setNote] = useState(log.note ?? '')
  const [tags, setTags] = useState((log.tags ?? []).join(' '))

  function save() {
    focusLogsCol.update(log.id, {
      label: label.trim() || undefined,
      projectId: projectId || undefined,
      rating: rating || undefined,
      note: note.trim() || undefined,
      tags: tags.trim() ? tags.trim().split(/\s+/).map((t) => t.replace(/^#/, '')) : undefined,
    })
    toast.success('已更新')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="編輯紀錄"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save}>儲存</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="任務">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="專注內容" />
        </Field>
        <Field label="專案">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">無專案</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="標籤（空格分隔）">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="閱讀 數學" />
        </Field>
        <Field label="專注度">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`評 ${n} 分`}
                aria-pressed={rating === n}
                onClick={() => setRating(rating === n ? 0 : n)}
                className={cx(
                  'flex h-9 flex-1 items-center justify-center rounded-lg text-base transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                  rating >= n ? 'bg-accent text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-700',
                )}
              >
                <span aria-hidden="true">{rating >= n ? '★' : '☆'}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label="筆記">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </Field>
      </div>
    </Modal>
  )
}

// ───────── 補記 modal（手動加一節）─────────
function AddModal({ projects, onClose }: { projects: FocusProject[]; onClose: () => void }) {
  const toast = useToast()
  const now = new Date()
  const [date, setDate] = useState(dayKey(now))
  const [time, setTime] = useState(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
  const [minutes, setMinutes] = useState(25)
  const [label, setLabel] = useState('')
  const [projectId, setProjectId] = useState('')

  function save() {
    const start = new Date(`${date}T${time}:00`)
    if (isNaN(start.getTime()) || minutes <= 0) {
      toast.error('請輸入有效時間同時長')
      return
    }
    const end = new Date(start.getTime() + minutes * 60000)
    focusLogsCol.add({
      kind: 'focus',
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      plannedMin: minutes,
      actualMin: minutes,
      completed: true,
      projectId: projectId || undefined,
      label: label.trim() || undefined,
    })
    toast.success('已補記一節專注')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="補記一節專注"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button onClick={save}>新增</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="日期">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="開始時間">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <Field label="時長（分鐘）">
          <Input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 0))}
          />
        </Field>
        <Field label="任務（選填）">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="專注內容" />
        </Field>
        <Field label="專案（選填）">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">無專案</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}
