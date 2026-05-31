import { useEffect, useMemo, useState } from 'react'
import {
  CalendarRange,
  Download,
  LayoutGrid,
  Printer,
  RotateCcw,
  Settings2,
  PieChart,
  Filter,
  Clock,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react'
import { createCollection, useCollection } from '../../lib/store'
import { timetableCol, classesCol } from '../../data/collections'
import type { Entity } from '../../lib/store'
import {
  Badge,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  SegmentedControl,
  Select,
  cx,
} from '../../ui'
import { useToast } from '../../context/ToastContext'
import { useConfirm } from '../../context/ConfirmContext'
import WeekGrid from './timetable/WeekGrid'
import WorkloadView from './timetable/WorkloadView'
import PrintView from './timetable/PrintView'
import SlotEditor, { type EditorDraft } from './timetable/SlotEditor'
import {
  DAY_DEFS,
  DEFAULT_BELLS,
  autoColorFor,
  bellByPeriod,
  buildCsv,
  colorOf,
  computeWorkload,
  dayLabel,
  detectConflicts,
  downloadText,
  findUpNext,
  fmtDuration,
  lastLessonEndMin,
  lessonPeriods,
  minutesOf,
  slotKey,
  type BellRow,
  type SlotColor,
  type SlotMeta,
  type WeekCycle,
} from './timetable/util'

// ============================================================
//  時間表（學校週課表）— 真實參考：學校排課系統（如 Untis / iTeacher）
//  ------------------------------------------------------------
//  深度功能：
//   • 多視圖（週課表 / 工作量分析 / 列印）
//   • 鐘聲時間（每節對應上下課時間，含小息 / 午膳）— 可自訂
//   • 循環週（A/B 週）、科目上色、協作老師、備課提示
//   • 「今日 / 下一堂」即時面板
//   • 班別篩選聚焦、撞堂偵測橫額
//   • 批量套用（一鍵填到多日同節）
//   • CSV 匯出（Excel / 列印友善）
//  共用 timetableCol（向後相容）；額外資料存自己嘅 collection。
// ============================================================

// ── 自己嘅持久化資料（唔掂 data/collections）──
// 每格附加資料（循環週 / 顏色 / 備註 / 協作）
const timetableMetaCol = createCollection<SlotMeta>('timetable_meta', [])

// 設定（鐘聲時間 + 顯示日子）— 單一 row（id='config'）
interface TimetableConfig extends Entity {
  bells: BellRow[]
  days: number[] // 顯示嘅星期（1..6）
}
const timetableConfigCol = createCollection<TimetableConfig>('timetable_config', [
  { id: 'config', bells: DEFAULT_BELLS, days: [1, 2, 3, 4, 5] },
])

type ViewId = 'grid' | 'workload' | 'print'

export default function Timetable() {
  const slots = useCollection(timetableCol)
  const classes = useCollection(classesCol)
  const metas = useCollection(timetableMetaCol)
  const configs = useCollection(timetableConfigCol)
  const toast = useToast()
  const confirm = useConfirm()

  const [view, setView] = useState<ViewId>('grid')
  const [draft, setDraft] = useState<EditorDraft | null>(null)
  const [filterClass, setFilterClass] = useState('') // '' = 全部
  const [showSettings, setShowSettings] = useState(false)

  // 現在分鐘（每分鐘更新一次，畀「下一堂」用）
  const [nowMin, setNowMin] = useState(() => {
    const d = new Date()
    return d.getHours() * 60 + d.getMinutes()
  })
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date()
      setNowMin(d.getHours() * 60 + d.getMinutes())
    }, 60000)
    return () => clearInterval(id)
  }, [])

  // 設定（fallback 預設，避免空集合）
  const config = configs[0] ?? { id: 'config', bells: DEFAULT_BELLS, days: [1, 2, 3, 4, 5] }
  const bells = config.bells?.length ? config.bells : DEFAULT_BELLS
  const days = config.days?.length ? config.days : [1, 2, 3, 4, 5]

  const todayDay = new Date().getDay() // 0=日 … 6=六（1..6 對得上）

  // ── 索引 ──
  const slotByKey = useMemo(() => {
    const m = new Map<string, (typeof slots)[number]>()
    for (const s of slots) m.set(slotKey(s.day, s.period), s)
    return m
  }, [slots])

  const metaByKey = useMemo(() => {
    const m = new Map<string, SlotMeta>()
    for (const meta of metas) m.set(meta.id, meta)
    return m
  }, [metas])

  const classNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of classes) m.set(c.id, c.name)
    return m
  }, [classes])

  // 班別 → 穩定顏色（甜甜圈 / 圖例用）
  const classColorKey = useMemo(() => {
    const m = new Map<string, SlotColor>()
    return (classId?: string): SlotColor => {
      const key = classId ?? '__none__'
      if (!m.has(key)) {
        m.set(
          key,
          classId ? autoColorFor(classNameById.get(classId) ?? classId) : 'cyan',
        )
      }
      return m.get(key)!
    }
  }, [classNameById])

  // ── 篩選後嘅 slots（畀統計同篩選聚焦）──
  const visibleSlots = useMemo(
    () => slots.filter((s) => days.includes(s.day)),
    [slots, days],
  )

  // ── 衝突 ──
  const conflicts = useMemo(
    () => detectConflicts(visibleSlots, metaByKey),
    [visibleSlots, metaByKey],
  )
  const conflictKeys = useMemo(() => {
    const set = new Set<string>()
    for (const c of conflicts) for (const k of c.slotKeys) set.add(k)
    return set
  }, [conflicts])

  // ── 工作量 ──
  const workload = useMemo(
    () => computeWorkload(visibleSlots, bells, days, classNameById),
    [visibleSlots, bells, days, classNameById],
  )

  // ── 今日 / 下一堂 ──
  const upNext = useMemo(
    () => findUpNext(slots, bells, todayDay, nowMin),
    [slots, bells, todayDay, nowMin],
  )
  const todayCount = useMemo(
    () => slots.filter((s) => s.day === todayDay).length,
    [slots, todayDay],
  )

  const bellMap = useMemo(() => bellByPeriod(bells), [bells])

  // 今日最後一節放學時間（畀「今日課堂已完」文案用，唔好寫死 16:00）
  const lastEndMin = useMemo(() => lastLessonEndMin(bells), [bells])

  // ── 編輯器 ──
  function openCell(day: number, period: number) {
    const key = slotKey(day, period)
    const existing = slotByKey.get(key)
    const meta = metaByKey.get(key)
    if (existing) {
      setDraft({
        day,
        period,
        slotId: existing.id,
        classId: existing.classId ?? '',
        subject: existing.subject ?? '',
        room: existing.room ?? '',
        week: (meta?.week ?? 'all') as WeekCycle,
        color: meta?.color ?? '',
        note: meta?.note ?? '',
        coTeacher: meta?.coTeacher ?? '',
      })
    } else {
      setDraft({
        day,
        period,
        classId: filterClass || '',
        subject: '',
        room: '',
        week: 'all',
        color: '',
        note: '',
        coTeacher: '',
      })
    }
  }

  function saveDraft(d: EditorDraft, applyDays: number[]) {
    const subject = d.subject.trim()
    const room = d.room.trim()
    const classId = d.classId || undefined
    const finalSubject =
      subject || (classId ? (classNameById.get(classId) ?? '') : '')

    for (const day of applyDays) {
      const key = slotKey(day, d.period)
      const existing = slotByKey.get(key)
      const payload = {
        day,
        period: d.period,
        classId,
        subject: finalSubject,
        room: room || undefined,
      }
      if (existing) {
        timetableCol.update(existing.id, payload)
      } else {
        timetableCol.add(payload)
      }
      // meta（用 key 做 id）
      const metaPayload: SlotMeta = {
        id: key,
        week: d.week,
        color: d.color || undefined,
        note: d.note.trim() || undefined,
        coTeacher: d.coTeacher.trim() || undefined,
      }
      if (metaByKey.has(key)) timetableMetaCol.update(key, metaPayload)
      else timetableMetaCol.add(metaPayload)
    }

    toast.success(
      applyDays.length > 1
        ? `已套用到 ${applyDays.length} 日`
        : d.slotId
          ? '已更新課堂'
          : '已新增課堂',
    )
    setDraft(null)
  }

  async function removeDraft() {
    if (!draft?.slotId) return
    const ok = await confirm({
      title: '刪除課堂？',
      message: '呢節課堂將會喺時間表移除，呢個動作無法復原。',
      confirmText: '刪除',
      tone: 'danger',
    })
    if (!ok) return
    timetableCol.remove(draft.slotId)
    const key = slotKey(draft.day, draft.period)
    if (metaByKey.has(key)) timetableMetaCol.remove(key)
    toast.success('已刪除課堂')
    setDraft(null)
  }

  // ── 匯出 ──
  function handleExport() {
    if (slots.length === 0) {
      toast.error('未有課堂可匯出')
      return
    }
    const csv = buildCsv(visibleSlots, bells, days, classNameById, metaByKey)
    downloadText('時間表.csv', csv, 'text/csv')
    toast.success('已匯出 CSV')
  }

  const editorPeriod = draft ? bellMap.get(draft.period) : undefined

  return (
    <div className="space-y-4 print:space-y-0">
      <div className="print:hidden">
        <PageHeader
          icon={CalendarRange}
          title="時間表"
          description="每週教學時間表 — 鐘聲時間、循環週、撞堂偵測同工作量分析。"
          actions={
            <div className="flex items-center gap-1.5">
              <IconButton label="設定鐘聲時間" onClick={() => setShowSettings(true)}>
                <Settings2 size={18} />
              </IconButton>
              <IconButton label="匯出 CSV" onClick={handleExport}>
                <Download size={18} />
              </IconButton>
              {view === 'print' && (
                <Button
                  size="sm"
                  icon={Printer}
                  onClick={() => window.print()}
                >
                  列印
                </Button>
              )}
            </div>
          }
        />
      </div>

      {/* 今日 / 下一堂 面板 */}
      <div className="print:hidden">
        <TodayPanel
          todayDay={todayDay}
          todayCount={todayCount}
          upNext={upNext}
          nowMin={nowMin}
          lastEndMin={lastEndMin}
          classNameById={classNameById}
        />
      </div>

      {/* 撞堂橫額 */}
      {conflicts.length > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 print:hidden"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">偵測到 {conflicts.length} 個撞堂</p>
            <p className="text-xs opacity-80">
              {conflicts
                .slice(0, 3)
                .map((c) =>
                  c.kind === 'class'
                    ? `${dayLabel(c.day)} 第 ${c.period} 節：${classNameById.get(c.value) ?? '班別'} 重複`
                    : `${dayLabel(c.day)} 第 ${c.period} 節：課室 ${c.value} 重複`,
                )
                .join('；')}
              {conflicts.length > 3 && ' …'}
            </p>
          </div>
        </div>
      )}

      {/* 視圖切換 + 篩選 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <SegmentedControl<ViewId>
          value={view}
          onChange={setView}
          options={[
            { id: 'grid', label: '週課表', icon: LayoutGrid },
            { id: 'workload', label: '工作量', icon: PieChart },
            { id: 'print', label: '列印', icon: Printer },
          ]}
        />
        {view === 'grid' && classes.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-slate-400" />
            <Select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="w-40"
            >
              <option value="">全部班別</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  聚焦 {c.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* 視圖內容 */}
      {view === 'grid' && (
        <WeekGrid
          bells={bells}
          days={days}
          todayDay={todayDay}
          slotByKey={slotByKey}
          metaByKey={metaByKey}
          classNameById={classNameById}
          conflictKeys={conflictKeys}
          dimClassId={filterClass}
          onOpenCell={openCell}
        />
      )}

      {view === 'workload' && (
        <WorkloadView workload={workload} classColorKey={classColorKey} />
      )}

      {view === 'print' && (
        <PrintView
          title="教學時間表"
          bells={bells}
          days={days}
          slotByKey={slotByKey}
          metaByKey={metaByKey}
          classNameById={classNameById}
        />
      )}

      {/* 編輯器 */}
      <SlotEditor
        draft={draft}
        classes={classes}
        periodLabel={`第 ${draft?.period ?? 0} 節`}
        timeLabel={
          editorPeriod ? `${editorPeriod.start}–${editorPeriod.end}` : undefined
        }
        onClose={() => setDraft(null)}
        onSave={saveDraft}
        onRemove={removeDraft}
        onApplyToWeekdays
      />

      {/* 鐘聲時間設定 */}
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        bells={bells}
        days={days}
        onSave={(nextBells, nextDays) => {
          timetableConfigCol.update('config', { bells: nextBells, days: nextDays })
          toast.success('已更新時段設定')
          setShowSettings(false)
        }}
        onReset={() => {
          timetableConfigCol.update('config', {
            bells: DEFAULT_BELLS,
            days: [1, 2, 3, 4, 5],
          })
          toast.success('已還原預設時段')
          setShowSettings(false)
        }}
      />
    </div>
  )
}

// ───────── 今日 / 下一堂 ─────────
function TodayPanel({
  todayDay,
  todayCount,
  upNext,
  nowMin,
  lastEndMin,
  classNameById,
}: {
  todayDay: number
  todayCount: number
  upNext: ReturnType<typeof findUpNext>
  nowMin: number
  lastEndMin: number
  classNameById: Map<string, string>
}) {
  const isWeekend = todayDay === 0
  return (
    <Card padded className="bg-gradient-to-br from-accent-soft/60 to-transparent dark:from-accent/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-accent text-white">
            <Clock size={18} />
          </span>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isWeekend ? '今日係假日' : `今日 ${dayLabel(todayDay)}`}
            </p>
            <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {isWeekend ? '好好休息' : `共 ${todayCount} 節`}
            </p>
          </div>
        </div>

        {upNext ? (
          <div
            aria-live="polite"
            className="flex items-center gap-3 rounded-lg border border-slate-200/70 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70"
          >
            <div
              className={cx(
                'h-9 w-1 rounded-full',
                colorOf(autoColorFor(upNext.slot.subject || upNext.slot.classId || 'x')).bar,
              )}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Badge tone={upNext.status === 'now' ? 'green' : 'accent'}>
                  {upNext.status === 'now'
                    ? '進行中'
                    : upNext.status === 'soon'
                      ? `${upNext.startsInMin} 分鐘後`
                      : '下一堂'}
                </Badge>
                <span className="text-xs tabular-nums text-slate-400">
                  {upNext.bell.start}–{upNext.bell.end}
                </span>
              </div>
              <p className="mt-0.5 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                {upNext.slot.subject ||
                  (upNext.slot.classId
                    ? classNameById.get(upNext.slot.classId)
                    : '課堂')}
                {upNext.slot.classId && upNext.slot.subject && (
                  <span className="ml-1 text-xs text-slate-400">
                    {classNameById.get(upNext.slot.classId)}
                  </span>
                )}
                {upNext.slot.room && (
                  <span className="ml-1 text-xs text-slate-400">
                    @ {upNext.slot.room}
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : (
          !isWeekend && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {nowMin >= lastEndMin ? '今日課堂已完' : '今日未有更多課堂'}
            </p>
          )
        )}
      </div>
    </Card>
  )
}

// ───────── 鐘聲時間設定 Modal ─────────
function SettingsModal({
  open,
  onClose,
  bells,
  days,
  onSave,
  onReset,
}: {
  open: boolean
  onClose: () => void
  bells: BellRow[]
  days: number[]
  onSave: (bells: BellRow[], days: number[]) => void
  onReset: () => void
}) {
  const [rows, setRows] = useState<BellRow[]>(bells)
  const [selDays, setSelDays] = useState<number[]>(days)

  useEffect(() => {
    if (open) {
      setRows(bells)
      setSelDays(days)
    }
  }, [open, bells, days])

  function patchRow(i: number, p: Partial<BellRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...p } : r)))
  }

  function toggleDay(day: number) {
    setSelDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b),
    )
  }

  // 教學節數預覽 + 總時數
  const lessonCount = lessonPeriods(rows).length
  const totalMin = rows
    .filter((r) => r.kind === 'lesson')
    .reduce((sum, r) => sum + Math.max(0, minutesOf(r.end) - minutesOf(r.start)), 0)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="時段設定"
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onReset}>
            還原預設
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              取消
            </Button>
            <Button onClick={() => onSave(rows, selDays.length ? selDays : [1])}>
              儲存
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 顯示日子 */}
        <Field label="顯示星期">
          <div className="flex flex-wrap gap-1.5">
            {DAY_DEFS.map((d) => {
              const on = selDays.includes(d.day)
              return (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => toggleDay(d.day)}
                  className={cx(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition',
                    on
                      ? 'bg-accent text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                  )}
                >
                  {d.short}
                </button>
              )
            })}
          </div>
        </Field>

        {/* 鐘聲時間 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              鐘聲時間（每節 / 小息 / 午膳）
            </span>
            <span className="text-[11px] tabular-nums text-slate-400">
              {lessonCount} 節教學 · {fmtDuration(totalMin)}
            </span>
          </div>
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {rows.map((r, i) => (
              <div
                key={i}
                className={cx(
                  'flex items-center gap-2 rounded-lg border p-1.5',
                  r.kind === 'lesson'
                    ? 'border-slate-200 dark:border-slate-700'
                    : 'border-dashed border-slate-300 bg-slate-50/60 dark:border-slate-600 dark:bg-slate-900/30',
                )}
              >
                <span
                  className={cx(
                    'w-16 shrink-0 text-center text-[11px] font-medium',
                    r.kind === 'lesson'
                      ? 'text-slate-600 dark:text-slate-300'
                      : 'text-slate-400',
                  )}
                >
                  {r.kind === 'lesson' ? `第 ${r.period} 節` : r.label}
                </span>
                <div className="flex flex-1 min-w-0 items-center gap-1">
                  <Input
                    type="time"
                    value={r.start}
                    onChange={(e) => patchRow(i, { start: e.target.value })}
                    className="w-full min-w-0 py-1 text-xs"
                  />
                  <span className="text-slate-300">–</span>
                  <Input
                    type="time"
                    value={r.end}
                    onChange={(e) => patchRow(i, { end: e.target.value })}
                    className="w-full min-w-0 py-1 text-xs"
                  />
                </div>
                <span className="ml-auto shrink-0 text-[11px] tabular-nums text-slate-400">
                  {Math.max(0, minutesOf(r.end) - minutesOf(r.start))} 分
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
            <ChevronRight size={12} />
            改時間即時反映喺週課表同列印視圖。
          </p>
        </div>
      </div>
    </Modal>
  )
}
