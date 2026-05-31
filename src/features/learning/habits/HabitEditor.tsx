import { useEffect, useState } from 'react'
import {
  Modal,
  Button,
  Input,
  Textarea,
  Field,
  SegmentedControl,
  cx,
} from '../../../ui'
import { Trash2, Target, Bell } from 'lucide-react'
import {
  HABIT_COLOR_KEYS,
  HABIT_CATEGORIES,
  ICON_CHOICES,
  colorOf,
  type Habit,
  type HabitColor,
  type HabitFrequency,
  type HabitGoalKind,
} from './types'
import { WEEKDAY_LABELS } from './util'

// ============================================================
//  習慣編輯器（新增 / 編輯共用）— 完整設定，似真實 app
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
      title={habit ? '編輯習慣' : '新增習慣'}
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
          <Button onClick={handleSave} disabled={!canSave}>
            {habit ? '儲存' : '新增'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* 名稱 + 即時預覽 */}
        <div className="flex items-center gap-3">
          <span
            className={cx(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl',
              colorOf(d.color).soft,
            )}
          >
            {d.icon}
          </span>
          <Input
            value={d.name}
            onChange={(e) => patch('name', e.target.value)}
            placeholder="習慣名稱，例如：每日跑步"
            className="flex-1"
            autoFocus
          />
        </div>

        {/* 目標類型 */}
        <Field label="目標類型">
          <SegmentedControl<HabitGoalKind>
            value={d.goalKind}
            onChange={(v) => patch('goalKind', v)}
            options={[
              { id: 'build', label: '養成（要做）' },
              { id: 'quit', label: '戒除（要避免）' },
            ]}
          />
        </Field>

        {/* Emoji */}
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
                    'flex h-9 w-9 items-center justify-center rounded-xl border text-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    on
                      ? 'border-accent bg-accent-soft'
                      : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700',
                  )}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </Field>

        {/* 顏色 */}
        <Field label="顏色">
          <div className="flex flex-wrap gap-2">
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
                    'h-8 w-8 rounded-full ring-2 ring-offset-2 transition dark:ring-offset-slate-800',
                    colorOf(c).dot,
                    on ? 'ring-slate-400 dark:ring-slate-300' : 'ring-transparent',
                  )}
                />
              )
            })}
          </div>
        </Field>

        {/* 頻率 */}
        <Field label="頻率">
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
        </Field>

        {/* 分類 */}
        <Field label="分類" hint="自由填，或揀下面常用分類">
          <Input
            value={d.category}
            onChange={(e) => patch('category', e.target.value)}
            placeholder="例如：健康"
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
        </Field>

        {/* 目標連續 + 提醒 */}
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

        {/* 備註 */}
        <Field label="備註">
          <Textarea
            value={d.notes}
            onChange={(e) => patch('notes', e.target.value)}
            placeholder="為何想養成 / 戒除呢個習慣？寫低提醒自己。"
            rows={2}
          />
        </Field>
      </div>
    </Modal>
  )
}
