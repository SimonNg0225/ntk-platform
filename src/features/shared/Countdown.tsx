import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlarmClock,
  BarChart3,
  CheckSquare,
  ClipboardList,
  FolderOpen,
  Hourglass,
  NotebookPen,
  PartyPopper,
  Pin,
  Plus,
  Target,
  Trash2,
} from 'lucide-react'
import { useCollection } from '../../lib/store'
import { countdownsCol } from '../../data/collections'
import type { Countdown as CountdownItem, CountdownCategory } from '../../data/types'
import { useMode } from '../../context/ModeContext'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  SectionTitle,
  Select,
  StatCard,
  Tabs,
  Textarea,
  cx,
} from '../../ui'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

type Tone = 'rose' | 'amber' | 'green' | 'slate'

/** 緊急度 → Badge tone（今日 / <=3 日 rose、<=14 日 amber、其餘 green、已過去 slate）。 */
export function toneOf(days: number): Tone {
  if (days < 0) return 'slate'
  if (days <= 3) return 'rose'
  if (days <= 14) return 'amber'
  return 'green'
}

/** 大數字色（配合 toneOf，全部帶 dark: 變體；green 用 emerald 同 Badge 一致）。 */
const TONE_TEXT: Record<Tone, string> = {
  rose: 'text-rose-600 dark:text-rose-400',
  amber: 'text-amber-600 dark:text-amber-400',
  green: 'text-emerald-600 dark:text-emerald-400',
  slate: 'text-slate-400 dark:text-slate-500',
}

const CATEGORY_META: Record<CountdownCategory, { icon: LucideIcon; label: string }> = {
  exam: { icon: NotebookPen, label: '考試' },
  deadline: { icon: AlarmClock, label: '死線' },
  assessment: { icon: BarChart3, label: '評估' },
  event: { icon: PartyPopper, label: '活動' },
  other: { icon: Pin, label: '其他' },
}

const CATEGORY_OPTIONS: CountdownCategory[] = [
  'exam',
  'deadline',
  'assessment',
  'event',
  'other',
]

/** 將 Date 轉成本地時區嘅 YYYY-MM-DD（避免 toISOString 時差問題）。 */
export function toKey(d: Date): string {
  const y = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

/** 由 YYYY-MM-DD 砌返一個本地 Date（中午，避開時區邊界）。畸形 key 回傳 Invalid Date。 */
export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date(NaN)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/** 仲有幾多日：同一日 = 0、明日 = 1、琴日 = -1。today 同 target 同基準（當地中午）。 */
export function daysUntil(dateKey: string, todayKey: string): number {
  const target = fromKey(dateKey)
  const today = fromKey(todayKey)
  return Math.round((target.getTime() - today.getTime()) / 864e5)
}

/** 格式化：M月D日（星期X），可加時間。 */
export function formatDate(dateKey: string, time?: string): string {
  const d = fromKey(dateKey)
  const base = `${d.getMonth() + 1}月${d.getDate()}日（星期${WEEKDAYS[d.getDay()]}）`
  return time ? `${base} ${time}` : base
}

type TabId = 'upcoming' | 'past'

export default function Countdown() {
  const items = useCollection(countdownsCol)
  const { mode } = useMode()
  const toast = useToast()
  const confirm = useConfirm()

  const todayKey = useMemo(() => toKey(new Date()), [])

  const [tab, setTab] = useState<TabId>('upcoming')

  // 新增 Modal 狀態
  const [modalOpen, setModalOpen] = useState(false)
  const [fTitle, setFTitle] = useState('')
  const [fDate, setFDate] = useState(todayKey)
  const [fTime, setFTime] = useState('')
  const [fCategory, setFCategory] = useState<CountdownCategory | ''>('')
  const [fNotes, setFNotes] = useState('')

  // 按目前模式過濾（mode 為 'both'、等於目前模式、或無 mode 視為共用）。
  const visible = useMemo(
    () =>
      items.filter((c) => c.mode === 'both' || c.mode === mode || !c.mode),
    [items, mode],
  )

  // 即將到嚟（今日及未來）：升序，最近喺前。
  const upcoming = useMemo(
    () =>
      visible
        .filter((c) => daysUntil(c.date, todayKey) >= 0)
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date)),
    [visible, todayKey],
  )

  // 已過去：降序，最近過去喺前。
  const past = useMemo(
    () =>
      visible
        .filter((c) => daysUntil(c.date, todayKey) < 0)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date)),
    [visible, todayKey],
  )

  // 頂部統計：最近一項（最快到嚟嘅未過事件 N 日）。
  const nearestDays = upcoming.length > 0 ? daysUntil(upcoming[0].date, todayKey) : null

  const list = tab === 'upcoming' ? upcoming : past

  function openAddModal() {
    setFTitle('')
    setFDate(todayKey)
    setFTime('')
    setFCategory('')
    setFNotes('')
    setModalOpen(true)
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = fTitle.trim()
    if (!trimmed) return
    const payload: Omit<CountdownItem, 'id'> = {
      title: trimmed,
      date: fDate,
      mode: 'both',
      createdAt: new Date().toISOString(),
    }
    if (fTime) payload.time = fTime
    if (fCategory) payload.category = fCategory
    const trimmedNotes = fNotes.trim()
    if (trimmedNotes) payload.notes = trimmedNotes
    countdownsCol.add(payload)
    setModalOpen(false)
    toast.success('已新增倒數')
  }

  async function handleRemove(c: CountdownItem) {
    const ok = await confirm({
      title: '刪除倒數？',
      message: `確定要刪除「${c.title}」？此動作無法復原。`,
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    countdownsCol.remove(c.id)
    toast.success('已刪除倒數')
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          重要日子倒數
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          設定考試、死線同評估，一眼睇清仲有幾多日。
        </p>
      </header>

      {/* 頂部統計 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="項目總數" value={upcoming.length} unit="個" icon={ClipboardList} />
        <StatCard
          label="最近一項"
          value={nearestDays === null ? '—' : nearestDays}
          unit={nearestDays === null ? undefined : '日'}
          icon={Hourglass}
          highlight={nearestDays !== null && nearestDays <= 3}
        />
        <StatCard label="已過去" value={past.length} unit="個" icon={CheckSquare} />
      </section>

      {/* 分頁 */}
      <Tabs<TabId>
        tabs={[
          { id: 'upcoming', label: '即將到嚟' },
          { id: 'past', label: '已過去' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* 倒數列表 */}
      <section className="space-y-3">
        <SectionTitle
          right={
            <Button size="sm" icon={Plus} onClick={openAddModal}>
              新增倒數
            </Button>
          }
        >
          我的倒數
        </SectionTitle>

        {list.length === 0 ? (
          tab === 'upcoming' ? (
            <EmptyState
              icon={Hourglass}
              title="未來暫時無倒數"
              hint="撳「新增倒數」加入考試、死線或評估日子。"
              action={
                <Button size="sm" icon={Plus} onClick={openAddModal}>
                  新增倒數
                </Button>
              }
            />
          ) : (
            <EmptyState icon={FolderOpen} title="未有已過去嘅項目" />
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((c) => {
              const days = daysUntil(c.date, todayKey)
              const tone = toneOf(days)
              const meta = c.category ? CATEGORY_META[c.category] : null
              const isToday = days === 0
              const badgeLabel =
                days > 0 ? `仲有 ${days} 日` : isToday ? '今日' : `已過 ${-days} 日`

              return (
                <Card key={c.id} hover className="p-4">
                  {/* 第一行：分類圖示 + 標題 + 刪除 */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
                        {(() => {
                          const CatIcon = meta ? meta.icon : Hourglass
                          return <CatIcon size={20} strokeWidth={2} />
                        })()}
                      </span>
                      <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                        {c.title}
                      </h3>
                    </div>
                    <IconButton
                      label={`刪除「${c.title}」`}
                      tone="danger"
                      onClick={() => handleRemove(c)}
                      className="shrink-0"
                    >
                      <Trash2 size={18} />
                    </IconButton>
                  </div>

                  {/* 大數字區 */}
                  <div className="mt-3 text-center">
                    {isToday ? (
                      <p className="flex items-center justify-center gap-1.5 text-2xl font-bold text-rose-600 dark:text-rose-400">
                        <Target size={22} strokeWidth={2.25} />
                        就係今日
                      </p>
                    ) : (
                      <>
                        <p
                          className={cx(
                            'text-4xl font-bold tabular-nums slashed-zero sm:text-5xl',
                            TONE_TEXT[tone],
                          )}
                        >
                          {Math.abs(days)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                          {days > 0 ? '日後' : `已過 ${-days} 日`}
                        </p>
                      </>
                    )}
                  </div>

                  {/* 底部 meta */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone={tone}>{badgeLabel}</Badge>
                    <Badge tone="slate">{formatDate(c.date, c.time)}</Badge>
                    {meta && <Badge tone="accent">{meta.label}</Badge>}
                  </div>

                  {c.notes && (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-500 dark:text-slate-400">
                      {c.notes}
                    </p>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* 新增 Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="新增倒數">
        <form onSubmit={handleAdd} className="space-y-3">
          <Field label="標題（必填）">
            <Input
              type="text"
              value={fTitle}
              onChange={(e) => setFTitle(e.target.value)}
              placeholder="例如：BAFS 卷一"
              autoFocus
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="日期">
              <Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
            </Field>
            <Field label="時間（選填）">
              <Input type="time" value={fTime} onChange={(e) => setFTime(e.target.value)} />
            </Field>
          </div>
          <Field label="分類（選填）">
            <Select
              value={fCategory}
              onChange={(e) => setFCategory(e.target.value as CountdownCategory | '')}
            >
              <option value="">未分類</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="備註（選填）">
            <Textarea
              value={fNotes}
              onChange={(e) => setFNotes(e.target.value)}
              rows={2}
              placeholder="補充資料……"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={!fTitle.trim()}>
              加入倒數
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
