import { useEffect, useMemo, useState } from 'react'
import {
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
  MapPin,
  Sparkles,
} from 'lucide-react'
import { createCollection, useCollection } from '../../lib/store'
import { timetableCol, classesCol, cycleCalendarCol } from '../../data/collections'
import { NTK_BELLS } from '../../data/ntk-seed'
import type { Entity } from '../../lib/store'
import {
  Badge,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  Modal,
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
  CYCLE_LABELS,
  DAY_DEFS,
  DEFAULT_BELLS,
  autoColorFor,
  bellByPeriod,
  buildCsv,
  clampApplyDays,
  colorOf,
  computeFreePeriods,
  computeWorkload,
  cycleDayForDate,
  cycleShort,
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
  days: number[] // 顯示嘅日子（1..6；cycle 模式 = Day A..F）
  cycle?: boolean // 日循環模式：欄變 Day A–F，「今日」由校曆決定
}
const timetableConfigCol = createCollection<TimetableConfig>('timetable_config', [
  { id: 'config', bells: NTK_BELLS, days: [1, 2, 3, 4, 5, 6], cycle: true },
])

type ViewId = 'grid' | 'workload' | 'print'

export default function Timetable() {
  const slots = useCollection(timetableCol)
  const classes = useCollection(classesCol)
  const metas = useCollection(timetableMetaCol)
  const configs = useCollection(timetableConfigCol)
  const cycleCalendar = useCollection(cycleCalendarCol)
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
  const config = configs[0] ?? { id: 'config', bells: NTK_BELLS, days: [1, 2, 3, 4, 5, 6], cycle: true }
  const bells = config.bells?.length ? config.bells : NTK_BELLS
  const days = config.days?.length ? config.days : [1, 2, 3, 4, 5, 6]
  const cycle = !!config.cycle

  // cycle 模式：今日(日期) → 校曆 → cycle day(1..6)；否則用星期 getDay()。
  const _now = new Date()
  const todayKeyStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`
  const todayDay = cycle
    ? cycleDayForDate(todayKeyStr, cycleCalendar) ?? 0
    : _now.getDay() // 0=日 … 6=六（1..6 對得上）

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

  // ── 空堂時段（連續成段，含鐘聲時間）──
  const freeSegments = useMemo(
    () => computeFreePeriods(visibleSlots, bells, days),
    [visibleSlots, bells, days],
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
    // 只套用到顯示範圍(days)內嘅日子，避免寫入永不顯示／無法刪除嘅孤兒 slot。
    // 批量 picker 永遠列一至六，但顯示範圍可被收窄（如設定還原為一至五）。
    // 當前格 d.day 必定喺 days 內（格只由 WeekGrid 範圍內可開），夾完至少保留當前日。
    const targetDays = clampApplyDays(applyDays, days)
    if (targetDays.length === 0) {
      setDraft(null)
      return
    }

    const subject = d.subject.trim()
    const room = d.room.trim()
    const classId = d.classId || undefined
    const finalSubject =
      subject || (classId ? (classNameById.get(classId) ?? '') : '')

    for (const day of targetDays) {
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
      targetDays.length > 1
        ? `已套用到 ${targetDays.length} 日`
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
    <div className="space-y-5 print:space-y-0">
      {/* ───────── 週記 masthead：六日循環做頁面身份（serif「時間表」+ cycle 緞帶） ───────── */}
      <header className="print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
              {cycle ? '六日循環 · 週記網格' : '每週課表'}
            </p>
            <h1 className="mt-1 font-serif text-2xl font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100 sm:text-[28px]">
              時間表
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="tabular-nums">每週 {visibleSlots.length} 節課堂</span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
              <span>鐘聲時間 · 撞堂偵測 · 工作量分析</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <IconButton label="設定鐘聲時間" onClick={() => setShowSettings(true)}>
              <Settings2 size={18} />
            </IconButton>
            <IconButton label="匯出 CSV" onClick={handleExport}>
              <Download size={18} />
            </IconButton>
            {view === 'print' && (
              <Button size="sm" icon={Printer} onClick={() => window.print()}>
                列印
              </Button>
            )}
          </div>
        </div>

        {/* cycle 緞帶：Day A–F，今日嗰格高亮（去 Excel，循環概念視覺化） */}
        {cycle && (
          <CycleRibbon todayDay={todayDay} days={days} className="mt-4" />
        )}
      </header>

      {/* 今日 / 下一堂 面板 */}
      <div className="print:hidden">
        <TodayPanel
          todayDay={todayDay}
          cycle={cycle}
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
          className="flex items-start gap-2.5 rounded-2xl border border-rose-200/80 bg-rose-50/70 p-3.5 dark:border-rose-500/25 dark:bg-rose-500/10 print:hidden"
        >
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
            <AlertTriangle size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
              偵測到 {conflicts.length} 個撞堂
            </p>
            <p className="mt-0.5 text-xs text-rose-600/80 dark:text-rose-300/70">
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
          cycle={cycle}
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
        <WorkloadView
          workload={workload}
          classColorKey={classColorKey}
          cycle={cycle}
          freeSegments={freeSegments}
        />
      )}

      {view === 'print' && (
        <PrintView
          title="教學時間表"
          cycle={cycle}
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
        cycle={cycle}
        onSave={(nextBells, nextDays, nextCycle) => {
          timetableConfigCol.update('config', { bells: nextBells, days: nextDays, cycle: nextCycle })
          toast.success('已更新時段設定')
          setShowSettings(false)
        }}
        onReset={() => {
          // 還原鐘聲 + 顯示日子，但保留目前嘅循環／星期模式（唔再跌返星期）。
          timetableConfigCol.update('config', {
            bells: DEFAULT_BELLS,
            days: [1, 2, 3, 4, 5, 6],
            cycle,
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
  cycle,
  todayCount,
  upNext,
  nowMin,
  lastEndMin,
  classNameById,
}: {
  todayDay: number
  cycle?: boolean
  todayCount: number
  upNext: ReturnType<typeof findUpNext>
  nowMin: number
  lastEndMin: number
  classNameById: Map<string, string>
}) {
  // cycle 模式：todayDay 0 = 今日唔喺校曆（週末/假期/未排）→ 當休息日。
  const isWeekend = cycle ? todayDay < 1 : todayDay === 0
  const upColor = upNext
    ? colorOf(autoColorFor(upNext.slot.subject || upNext.slot.classId || 'x'))
    : null
  return (
    <Card
      padded
      className="relative overflow-hidden border-accent/25 bg-gradient-to-br from-accent-soft/70 via-accent-soft/20 to-transparent dark:border-accent/20 dark:from-accent/12 dark:via-accent/5"
    >
      {/* 柔光點綴（高影響時刻先用，純裝飾） */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-accent/10 blur-3xl dark:bg-accent/15"
      />
      <div className="relative flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          {/* serif 大字「今日」身份磚（cycle 模式直接顯示 Day 字母） */}
          <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-accent text-white shadow-sm shadow-accent/30">
            {isWeekend ? (
              <Clock size={22} strokeWidth={2} />
            ) : (
              <>
                <span className="font-serif text-2xl font-semibold leading-none">
                  {cycle ? cycleShort(todayDay) : dayLabel(todayDay).slice(-1)}
                </span>
                <span className="mt-0.5 text-[9px] font-medium uppercase tracking-widest text-white/70">
                  {cycle ? 'Day' : '星期'}
                </span>
              </>
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-accent/70">
              {isWeekend
                ? cycle ? '今日唔使返學' : '今日休息'
                : `今日 · ${cycle ? `Day ${cycleShort(todayDay)}` : dayLabel(todayDay)}`}
            </p>
            <p className="mt-0.5 font-serif text-xl font-semibold leading-tight text-slate-800 dark:text-slate-100">
              {isWeekend ? '好好抖一抖 ☕' : `今日有 ${todayCount} 節`}
            </p>
          </div>
        </div>

        {upNext && upColor ? (
          <div
            aria-live="polite"
            className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/80 px-3.5 py-2.5 shadow-xs backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-800/70"
          >
            <div className={cx('h-10 w-1.5 shrink-0 rounded-full', upColor.bar)} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Badge tone={upNext.status === 'now' ? 'green' : 'accent'} dot>
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
              <p className="mt-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                {upNext.slot.subject ||
                  (upNext.slot.classId
                    ? classNameById.get(upNext.slot.classId)
                    : '課堂')}
                {upNext.slot.classId && upNext.slot.subject && (
                  <span className="ml-1.5 text-xs font-normal text-slate-400">
                    {classNameById.get(upNext.slot.classId)}
                  </span>
                )}
                {upNext.slot.room && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-normal text-slate-400">
                    <MapPin size={11} />
                    {upNext.slot.room}
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : (
          !isWeekend && (
            <p className="flex items-center gap-1.5 rounded-2xl bg-white/50 px-3.5 py-2.5 text-sm text-slate-500 dark:bg-slate-800/40 dark:text-slate-400">
              <Sparkles size={14} className="text-accent/60" />
              {nowMin >= lastEndMin ? '今日課堂已完，辛苦晒！' : '今日未有更多課堂'}
            </p>
          )
        )}
      </div>
    </Card>
  )
}

// ───────── Cycle 緞帶（六日循環導航：Day A–F，今日嗰節高亮）─────────
//  將「循環週」概念由抽象變視覺：一排圓潤 Day token，今日填實 accent，
//  其餘柔底；非顯示範圍（被設定收窄）嘅日子淡化。純導覽 / 概念展示，唔改資料。
function CycleRibbon({
  todayDay,
  days,
  className,
}: {
  todayDay: number
  days: number[]
  className?: string
}) {
  const visible = new Set(days)
  return (
    <div
      className={cx(
        'flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/70 bg-slate-50/70 p-1.5 dark:border-slate-700/60 dark:bg-slate-800/50',
        className,
      )}
      role="list"
      aria-label="六日循環"
    >
      {CYCLE_LABELS.map((letter, i) => {
        const day = i + 1
        const isToday = day === todayDay
        const inRange = visible.has(day)
        return (
          <div
            key={letter}
            role="listitem"
            className={cx(
              'flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors',
              isToday
                ? 'bg-accent text-white shadow-sm shadow-accent/25'
                : inRange
                  ? 'text-slate-500 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700/60'
                  : 'text-slate-300 dark:text-slate-600',
            )}
          >
            <span
              className={cx(
                'flex h-6 w-6 items-center justify-center rounded-lg font-serif text-[15px] font-semibold leading-none',
                isToday
                  ? 'bg-white/20'
                  : inRange
                    ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                    : 'bg-slate-100 dark:bg-slate-700/50',
              )}
            >
              {letter}
            </span>
            <span className="hidden sm:inline">
              {isToday ? '今日' : `Day ${letter}`}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ───────── 鐘聲時間設定 Modal ─────────
function SettingsModal({
  open,
  onClose,
  bells,
  days,
  cycle,
  onSave,
  onReset,
}: {
  open: boolean
  onClose: () => void
  bells: BellRow[]
  days: number[]
  cycle: boolean
  onSave: (bells: BellRow[], days: number[], cycle: boolean) => void
  onReset: () => void
}) {
  const [rows, setRows] = useState<BellRow[]>(bells)
  const [selDays, setSelDays] = useState<number[]>(days)
  const [cycleOn, setCycleOn] = useState<boolean>(cycle)

  useEffect(() => {
    if (open) {
      setRows(bells)
      setSelDays(days)
      setCycleOn(cycle)
    }
  }, [open, bells, days, cycle])

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
            <Button onClick={() => onSave(rows, selDays.length ? selDays : [1], cycleOn)}>
              儲存
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 六日循環模式開關（Day A–F ↔ 星期一～六） */}
        <button
          type="button"
          onClick={() => setCycleOn((v) => !v)}
          aria-pressed={cycleOn}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-left transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              六日循環（Day A–F）
            </span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              {cycleOn
                ? '欄頭用 Day A–F，「今日」跟校曆循環日'
                : '欄頭用星期一～六（固定每週）'}
            </span>
          </span>
          <span
            aria-hidden="true"
            className={cx(
              'relative h-6 w-11 shrink-0 rounded-full transition-colors',
              cycleOn ? 'bg-accent' : 'bg-slate-300 dark:bg-slate-600',
            )}
          >
            <span
              className={cx(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                cycleOn ? 'left-[22px]' : 'left-0.5',
              )}
            />
          </span>
        </button>

        {/* 顯示日子（cycle 模式 = Day A–F；否則星期） */}
        <Field
          label={cycleOn ? '顯示循環日' : '顯示星期'}
          hint={cycleOn ? '揀邊幾個 cycle day 出現喺課表（通常 A–F 全部）' : undefined}
        >
          <div className="flex flex-wrap gap-1.5">
            {DAY_DEFS.map((d) => {
              const on = selDays.includes(d.day)
              return (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => toggleDay(d.day)}
                  className={cx(
                    'rounded-full px-3.5 py-1.5 text-sm font-medium transition',
                    on
                      ? 'bg-accent text-white shadow-sm dark:shadow-none'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                  )}
                >
                  {cycleOn ? `Day ${cycleShort(d.day)}` : d.short}
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
