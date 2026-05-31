import { useEffect, useState } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import type { Klass } from '../../../data/types'
import {
  Badge,
  Button,
  Field,
  Input,
  Modal,
  Select,
  cx,
} from '../../../ui'
import {
  DAY_DEFS,
  SLOT_COLOR_KEYS,
  autoColorFor,
  colorOf,
  dayLabel,
  type SlotColor,
  type WeekCycle,
} from './util'

export interface EditorDraft {
  day: number
  period: number
  slotId?: string
  classId: string
  subject: string
  room: string
  week: WeekCycle
  color: '' | SlotColor // '' = 自動依科目
  note: string
  coTeacher: string
}

export default function SlotEditor({
  draft,
  classes,
  periodLabel,
  timeLabel,
  onClose,
  onSave,
  onRemove,
  onApplyToWeekdays,
}: {
  draft: EditorDraft | null
  classes: Klass[]
  periodLabel: string
  timeLabel?: string
  onClose: () => void
  onSave: (d: EditorDraft, applyDays: number[]) => void
  onRemove: () => void
  onApplyToWeekdays: boolean // 是否顯示「套用到其他日」
}) {
  const [d, setD] = useState<EditorDraft | null>(draft)
  // 套用到其他星期（同節）— 預設只當前日
  const [applyDays, setApplyDays] = useState<number[]>([])

  useEffect(() => {
    setD(draft)
    setApplyDays(draft ? [draft.day] : [])
  }, [draft])

  if (!d) return null

  const autoColor = autoColorFor(d.subject || d.classId || 'x')
  const previewColor = d.color || autoColor
  const canSave = d.subject.trim().length > 0 || d.classId.length > 0

  function patch(p: Partial<EditorDraft>) {
    setD((prev) => (prev ? { ...prev, ...p } : prev))
  }

  function toggleApplyDay(day: number) {
    setApplyDays((prev) =>
      prev.includes(day) ? prev.filter((x) => x !== day) : [...prev, day],
    )
  }

  return (
    <Modal
      open={!!draft}
      onClose={onClose}
      title={d.slotId ? '編輯課堂' : '新增課堂'}
      size="md"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {d.slotId ? (
            <Button variant="danger" size="sm" icon={Trash2} onClick={onRemove}>
              刪除
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              取消
            </Button>
            <Button
              disabled={!canSave}
              onClick={() =>
                onSave(d, applyDays.length ? applyDays : [d.day])
              }
            >
              儲存
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{dayLabel(d.day)}</Badge>
          <Badge tone="slate">{periodLabel}</Badge>
          {timeLabel && (
            <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {timeLabel}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="班別（選填）">
            <Select
              value={d.classId}
              onChange={(e) => patch({ classId: e.target.value })}
            >
              <option value="">未選擇</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="科目">
            <Input
              type="text"
              value={d.subject}
              onChange={(e) => patch({ subject: e.target.value })}
              placeholder="例如：BAFS（會計）"
            />
          </Field>

          <Field label="課室（選填）">
            <Input
              type="text"
              value={d.room}
              onChange={(e) => patch({ room: e.target.value })}
              placeholder="例如：1A / 商業室"
            />
          </Field>

          <Field label="循環週">
            <Select
              value={d.week}
              onChange={(e) => patch({ week: e.target.value as WeekCycle })}
            >
              <option value="all">每週</option>
              <option value="A">A 週（單週）</option>
              <option value="B">B 週（雙週）</option>
            </Select>
          </Field>
        </div>

        <Field label="協作老師（選填）">
          <Input
            type="text"
            value={d.coTeacher}
            onChange={(e) => patch({ coTeacher: e.target.value })}
            placeholder="例如：陳 sir（拆班 / 合教）"
          />
        </Field>

        <Field label="備課提示 / 課題（選填）">
          <Input
            type="text"
            value={d.note}
            onChange={(e) => patch({ note: e.target.value })}
            placeholder="例如：成本會計 — 分批成本法"
          />
        </Field>

        {/* 顏色 */}
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            顏色
            {!d.color && (
              <span className="font-normal text-slate-400">
                （自動：{colorOf(autoColor).label}）
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => patch({ color: '' })}
              className={cx(
                'rounded-md px-2 py-1 text-xs font-medium transition',
                !d.color
                  ? 'bg-accent text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
              )}
            >
              自動
            </button>
            {SLOT_COLOR_KEYS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={colorOf(c).label}
                onClick={() => patch({ color: c })}
                className={cx(
                  'h-6 w-6 rounded-md ring-2 ring-offset-1 transition dark:ring-offset-slate-800',
                  colorOf(c).bar,
                  d.color === c ? 'ring-slate-900 dark:ring-white' : 'ring-transparent',
                )}
              />
            ))}
          </div>
        </div>

        {/* 預覽 */}
        <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            預覽
          </p>
          <div
            className={cx(
              'flex flex-col gap-1 rounded-md p-2 text-left text-sm',
              colorOf(previewColor).cell,
            )}
          >
            <span className="font-semibold">
              {d.subject.trim() ||
                (d.classId
                  ? (classes.find((c) => c.id === d.classId)?.name ?? '課堂')
                  : '課堂')}
            </span>
            <div className="flex flex-wrap gap-1">
              {d.classId && (
                <span className="rounded bg-black/5 px-1.5 py-0.5 text-[11px] dark:bg-white/10">
                  {classes.find((c) => c.id === d.classId)?.name}
                </span>
              )}
              {d.room && (
                <span className="rounded bg-black/5 px-1.5 py-0.5 text-[11px] dark:bg-white/10">
                  {d.room}
                </span>
              )}
              {d.week !== 'all' && (
                <span className="rounded bg-black/5 px-1.5 py-0.5 text-[11px] dark:bg-white/10">
                  {d.week} 週
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 批量套用到其他星期（同一節）*/}
        {onApplyToWeekdays && (
          <div className="rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-600">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Copy size={13} />
              同時套用到呢幾日（同第 {d.period} 節）
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DAY_DEFS.map((dd) => {
                const on = applyDays.includes(dd.day)
                return (
                  <button
                    key={dd.day}
                    type="button"
                    onClick={() => toggleApplyDay(dd.day)}
                    className={cx(
                      'rounded-md px-2.5 py-1 text-xs font-medium transition',
                      on
                        ? 'bg-accent text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                    )}
                  >
                    {dd.short}
                  </button>
                )
              })}
            </div>
            {applyDays.length > 1 && (
              <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                會覆寫所揀日子嘅同一節（已有課堂會被取代）。
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
