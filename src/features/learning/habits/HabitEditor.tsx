import { useEffect, useState, type ReactNode } from 'react'
import {
  Modal,
  Button,
  Input,
  Textarea,
  Field,
  SegmentedControl,
  cx,
} from '../../../ui'
import {
  Trash2,
  Target,
  Bell,
  X,
  CalendarDays,
  Repeat,
  Palette,
  Tag,
  StickyNote,
  Stamp,
} from 'lucide-react'
import {
  HABIT_COLOR_KEYS,
  HABIT_CATEGORIES,
  ICON_CHOICES,
  colorOf,
  freqLabel,
  type Habit,
  type HabitColor,
  type HabitFrequency,
  type HabitGoalKind,
} from './types'
import { WEEKDAY_LABELS } from './util'

// ============================================================
//  習慣編輯器（新增 / 編輯共用）
//  ------------------------------------------------------------
//  美學：呼應主畫面「老黃曆 + 連續鏈條」——
//  整張表編成一頁待落印嘅曆書：serif 抬頭、hairline 分節、
//  即時預覽做曆書條目首行、戳印式圖示。功能/驗證/鍵盤一律不變。
// ============================================================

type FreqKind = 'daily' | 'weekly' | 'weekdays'

interface Draft {
  name: string
  icon: string
  color: HabitColor
  goalKind: HabitGoalKind
  freqKind: FreqKind
  weeklyTimes: number
  weekdays: number[]
  targetStreak: string
  category: string
  reminderTime: string
  notes: string
}

function habitToDraft(h?: Habit): Draft {
  if (!h)
    return {
      name: '',
      icon: ICON_CHOICES[0],
      color: 'accent',
      goalKind: 'build',
      freqKind: 'daily',
      weeklyTimes: 3,
      weekdays: [1, 2, 3, 4, 5],
      targetStreak: '',
      category: '',
      reminderTime: '',
      notes: '',
    }
  const f = h.frequency
  return {
    name: h.name,
    icon: h.icon ?? ICON_CHOICES[0],
    color: h.color,
    goalKind: h.goalKind,
    freqKind: f.kind,
    weeklyTimes: f.kind === 'weekly' ? f.times : 3,
    weekdays: f.kind === 'weekdays' ? f.days : [1, 2, 3, 4, 5],
    targetStreak: h.targetStreak > 0 ? String(h.targetStreak) : '',
    category: h.category ?? '',
    reminderTime: h.reminderTime ?? '',
    notes: h.notes ?? '',
  }
}

export default function HabitEditor({
  open,
  habit,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  habit?: Habit
  onClose: () => void
  onSave: (data: Omit<Habit, 'id' | 'order' | 'createdAt' | 'archived'>) => void
  onDelete?: () => void
}) {
  const [d, setD] = useState<Draft>(() => habitToDraft(habit))

  // 每次開（或切換 habit）重置草稿
  useEffect(() => {
    if (open) setD(habitToDraft(habit))
  }, [open, habit])

  function patch<K extends keyof Draft>(k: K, v: Draft[K]) {
    setD((prev) => ({ ...prev, [k]: v }))
  }

  function toggleWeekday(day: number) {
    setD((prev) => {
      const has = prev.weekdays.includes(day)
      const next = has
        ? prev.weekdays.filter((x) => x !== day)
        : [...prev.weekdays, day]
      return { ...prev, weekdays: next }
    })
  }

  function buildFrequency(): HabitFrequency {
    if (d.freqKind === 'daily') return { kind: 'daily' }
    if (d.freqKind === 'weekly')
      return { kind: 'weekly', times: Math.max(1, Math.min(7, d.weeklyTimes)) }
    return {
      kind: 'weekdays',
      days: d.weekdays.length > 0 ? d.weekdays.slice().sort((a, b) => a - b) : [1],
    }
  }

  const canSave = d.name.trim().length > 0
  const spec = colorOf(d.color)

  // 預覽用頻率字串（純衍生，唔影響儲存）
  const previewFreq = freqLabel(buildFrequency())

  function handleSave() {
    if (!canSave) return
    onSave({
      name: d.name.trim(),
      icon: d.icon,
      color: d.color,
      goalKind: d.goalKind,
      frequency: buildFrequency(),
      targetStreak: d.targetStreak ? Math.max(0, parseInt(d.targetStreak, 10) || 0) : 0,
      category: d.category.trim() || undefined,
      reminderTime: d.reminderTime || undefined,
      notes: d.notes.trim() || undefined,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      footer={
        <>
          {habit && onDelete && (
            <Button
              variant="ghost"
              icon={Trash2}
              onClick={onDelete}
              className="mr-auto text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
            >
              刪除
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button icon={Stamp} onClick={handleSave} disabled={!canSave}>
            {habit ? '落印保存' : '新增習慣'}
          </Button>
        </>
      }
    >
      {/* ───────── 老黃曆抬頭：kicker + serif 標題 + 自家關閉鈕 ───────── */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
            <CalendarDays size={13} className="shrink-0" />
            {habit ? '修訂宜忌 · Almanac Entry' : '新立宜忌 · Almanac Entry'}
          </p>
          <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-slate-800 dark:text-slate-100">
            {habit ? '編輯習慣' : '新增習慣'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉"
          className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:hover:bg-slate-700"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-5">
        {/* ───────── 曆書條目首行：戳印圖示 + serif 名稱（即時預覽） ───────── */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-[#fcfbf7] p-4 dark:border-slate-700/60 dark:bg-slate-800/50">
          {/* 左色脊：呼應主畫面卡片色脊 */}
          <span
            aria-hidden="true"
            className={cx('absolute inset-y-0 left-0 w-1', spec.solid.split(' ')[0])}
          />
          <div className="flex items-center gap-3.5 pl-2">
            <span
              className={cx(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-xs ring-1 ring-inset ring-black/5 transition-colors dark:ring-white/5',
                spec.soft,
              )}
            >
              {d.icon}
            </span>
            <div className="min-w-0 flex-1">
              <Input
                value={d.name}
                onChange={(e) => patch('name', e.target.value)}
                placeholder="習慣名稱，例如：每日跑步"
                aria-label="習慣名稱"
                className="border-transparent bg-white text-base font-semibold shadow-xs dark:bg-slate-800"
                autoFocus
              />
              {/* 條目摘要：跟住設定即時更新，似曆書一行小註 */}
              <p className="mt-1.5 truncate pl-0.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="tabular-nums">{previewFreq}</span>
                <span aria-hidden="true" className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
                {d.goalKind === 'quit' ? '戒除' : '養成'}
                {d.category.trim() && (
                  <>
                    <span aria-hidden="true" className="mx-1.5 text-slate-300 dark:text-slate-600">·</span>
                    {d.category.trim()}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* ───────── 目標類型 ───────── */}
        <Almanac label="目標類型" icon={Target}>
          <SegmentedControl<HabitGoalKind>
            value={d.goalKind}
            onChange={(v) => patch('goalKind', v)}
            options={[
              { id: 'build', label: '養成（要做）' },
              { id: 'quit', label: '戒除（要避免）' },
            ]}
          />
        </Almanac>

        {/* ───────── 外觀（圖示 + 顏色） ───────── */}
        <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-slate-700/60">
          <AlmanacHeading icon={Palette}>外觀</AlmanacHeading>
          <div className="mt-3.5 space-y-4">
            <Field label="圖示">
              <div className="flex flex-wrap gap-2">
                {ICON_CHOICES.map((c) => {
                  const on = c === d.icon
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => patch('icon', c)}
                      aria-pressed={on}
                      className={cx(
                        'flex h-9 w-9 items-center justify-center rounded-xl border text-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                        on
                          ? 'border-accent bg-accent-soft shadow-xs'
                          : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600',
                      )}
                    >
                      {c}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label="顏色">
              <div className="flex flex-wrap gap-2.5">
                {HABIT_COLOR_KEYS.map((c) => {
                  const on = c === d.color
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => patch('color', c)}
                      aria-label={colorOf(c).label}
                      aria-pressed={on}
                      className={cx(
                        'h-8 w-8 rounded-full ring-2 ring-offset-2 transition hover:scale-110 dark:ring-offset-slate-800',
                        colorOf(c).dot,
                        on ? 'ring-slate-400 dark:ring-slate-300' : 'ring-transparent',
                      )}
                    />
                  )
                })}
              </div>
            </Field>
          </div>
        </div>

        {/* ───────── 頻率（落印節律） ───────── */}
        <Almanac label="頻率" icon={Repeat}>
          <SegmentedControl<FreqKind>
            value={d.freqKind}
            onChange={(v) => patch('freqKind', v)}
            options={[
              { id: 'daily', label: '每日' },
              { id: 'weekly', label: '每週 N 次' },
              { id: 'weekdays', label: '指定星期' },
            ]}
          />
          {d.freqKind === 'weekly' && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">每週</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => patch('weeklyTimes', n)}
                    className={cx(
                      'h-8 w-8 rounded-lg text-sm font-semibold tabular-nums transition-colors',
                      d.weeklyTimes === n
                        ? 'bg-accent text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className="text-sm text-slate-500 dark:text-slate-400">次</span>
            </div>
          )}
          {d.freqKind === 'weekdays' && (
            <div className="mt-3 flex gap-1.5">
              {WEEKDAY_LABELS.map((w, i) => {
                const on = d.weekdays.includes(i)
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => toggleWeekday(i)}
                    aria-pressed={on}
                    className={cx(
                      'flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition-colors',
                      on
                        ? 'bg-accent text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600',
                    )}
                  >
                    {w}
                  </button>
                )
              })}
            </div>
          )}
        </Almanac>

        {/* ───────── 分類 ───────── */}
        <Almanac
          label="分類"
          icon={Tag}
          hint="自由填，或揀下面常用分類"
        >
          <Input
            value={d.category}
            onChange={(e) => patch('category', e.target.value)}
            placeholder="例如：健康"
            aria-label="分類"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {HABIT_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => patch('category', d.category === c ? '' : c)}
                className={cx(
                  'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  d.category === c
                    ? 'bg-accent text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </Almanac>

        {/* ───────── 目標連續 + 提醒 ───────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="目標連續日數">
            <Input
              type="number"
              min={0}
              icon={Target}
              value={d.targetStreak}
              onChange={(e) => patch('targetStreak', e.target.value)}
              placeholder="例如：30"
            />
          </Field>
          <Field label="提醒時間">
            <Input
              type="time"
              icon={Bell}
              value={d.reminderTime}
              onChange={(e) => patch('reminderTime', e.target.value)}
            />
          </Field>
        </div>

        {/* ───────── 備註（曆書旁註） ───────── */}
        <Almanac label="備註" icon={StickyNote}>
          <Textarea
            value={d.notes}
            onChange={(e) => patch('notes', e.target.value)}
            placeholder="為何想養成 / 戒除呢個習慣？寫低提醒自己。"
            rows={2}
          />
        </Almanac>
      </div>
    </Modal>
  )
}

// ───────── 曆書分節抬頭（小帽 + icon + hairline 收尾；呼應主畫面 SectionLabel）─────────
function AlmanacHeading({
  icon: Icon,
  children,
}: {
  icon: typeof Target
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <p className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        <Icon size={12} className="shrink-0" />
        {children}
      </p>
      <span aria-hidden="true" className="h-px flex-1 bg-slate-200/80 dark:bg-slate-700/60" />
    </div>
  )
}

// ───────── 曆書分節（抬頭 + 內容 + 可選小註）─────────
//  以 fieldset/legend 保留語意分組；視覺承接老黃曆 hairline 分節節奏。
function Almanac({
  label,
  icon,
  hint,
  children,
}: {
  label: string
  icon: typeof Target
  hint?: string
  children: ReactNode
}) {
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="mb-3 w-full p-0">
        <AlmanacHeading icon={icon}>{label}</AlmanacHeading>
      </legend>
      {children}
      {hint && (
        <p className="text-xs text-slate-400 dark:text-slate-500">{hint}</p>
      )}
    </fieldset>
  )
}
