import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Copy, Trash2, MapPin } from 'lucide-react'
import type { Klass } from '../../../data/types'
import {
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
  dayShort,
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

// ============================================================
//  課堂編輯器 — 呼應「週記時間網格 / 堂卡」概念
//  ------------------------------------------------------------
//  • Masthead = 一張「課堂座標」票根：serif Day token + serif 節數 + 鐘聲時間，
//    跟返 WeekGrid 欄頭 / 堂卡嘅視覺語言（serif、accent token、tabular 時間）。
//  • 欄位分組：每組一個 hairline kicker（細體大寫字距），唔再係散亂 form grid。
//  • 預覽 = 真‧堂卡：1:1 重現 WeekGrid 嗰塊 chip（左色脊 + 科目 + 班別/課室 pill），
//    令用戶睇住「呢張卡真係落格係咁」。
//  資料流 / props / state / handler / onSave / onClose / onRemove 簽名一律不變。
// ============================================================

// 小節標題（呼應 masthead kicker：細體、大寫、闊字距）
function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
      {children}
    </p>
  )
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

  const className = d.classId
    ? (classes.find((c) => c.id === d.classId)?.name ?? '')
    : ''
  const previewTitle = d.subject.trim() || className || '課堂'
  // masthead Day token：取「一…六」尾字（WeekGrid 欄頭同一手法）
  const dayToken = dayShort(d.day)

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
              儲存課堂
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ── 課堂座標票根：serif Day token + serif 節數 + 鐘聲時間 ── */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3 dark:border-slate-700/60 dark:bg-slate-800/50">
          {/* Day token（呼應 WeekGrid 欄頭嗰粒 serif 字母）*/}
          <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-accent text-white shadow-sm shadow-accent/25">
            <span className="font-serif text-xl font-semibold leading-none">
              {dayToken}
            </span>
            <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-widest text-white/70">
              星期
            </span>
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-accent/70">
              {dayLabel(d.day)}
            </p>
            <p className="mt-0.5 flex items-baseline gap-2 leading-none">
              <span className="font-serif text-lg font-semibold text-slate-800 dark:text-slate-100">
                {periodLabel}
              </span>
              {timeLabel && (
                <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">
                  {timeLabel}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* ── 課堂內容 ── */}
        <div>
          <GroupLabel>課堂內容</GroupLabel>
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
        </div>

        {/* ── 教學備註 ── */}
        <div className="space-y-3">
          <GroupLabel>教學備註</GroupLabel>
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
        </div>

        {/* ── 堂卡外觀（顏色 + 即時堂卡預覽）── */}
        <div>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <GroupLabel>堂卡外觀</GroupLabel>
            {!d.color && (
              <span className="text-[11px] font-normal normal-case text-slate-400">
                自動 · {colorOf(autoColor).label}
              </span>
            )}
          </div>

          {/* 顏色 token：自動 + 8 色色脊（呼應堂卡左色棒）*/}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => patch({ color: '' })}
              className={cx(
                'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-800',
                !d.color
                  ? 'bg-accent text-white shadow-sm dark:shadow-none'
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
                aria-pressed={d.color === c}
                onClick={() => patch({ color: c })}
                className={cx(
                  'h-7 w-7 rounded-lg ring-2 ring-offset-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-accent/60 dark:ring-offset-slate-800',
                  colorOf(c).bar,
                  d.color === c
                    ? 'ring-slate-900 dark:ring-white'
                    : 'ring-transparent',
                )}
              />
            ))}
          </div>

          {/* 預覽 = 真‧堂卡（1:1 重現 WeekGrid chip：左色脊 + 科目 + pill）*/}
          <div className="mt-3 rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-700/60 dark:bg-slate-900/30">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              落格預覽
            </p>
            <div
              className={cx(
                'flex min-h-[72px] flex-col gap-1 rounded-2xl p-2.5 text-left text-sm shadow-xs',
                colorOf(previewColor).cell,
              )}
            >
              <span className="line-clamp-2 text-[13px] font-semibold leading-snug">
                {previewTitle}
              </span>
              <div className="mt-auto flex flex-wrap items-center gap-1">
                {className && (
                  <span className="rounded-md bg-black/[0.06] px-1.5 py-px text-[10px] font-medium dark:bg-white/10">
                    {className}
                  </span>
                )}
                {d.room && (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-black/[0.06] px-1.5 py-px text-[10px] dark:bg-white/10">
                    <MapPin size={9} className="shrink-0 opacity-70" />
                    {d.room}
                  </span>
                )}
                {d.week !== 'all' && (
                  <span className="rounded-md bg-black/[0.06] px-1.5 py-px text-[10px] font-semibold dark:bg-white/10">
                    {d.week} 週
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── 批量套用到其他星期（同一節）── */}
        {onApplyToWeekdays && (
          <div>
            <GroupLabel>套用到其他日</GroupLabel>
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-3 dark:border-slate-700/60 dark:bg-slate-900/30">
              <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <Copy size={13} className="text-slate-400" />
                同一節（第 {d.period} 節）一併排入呢幾日
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DAY_DEFS.map((dd) => {
                  const on = applyDays.includes(dd.day)
                  return (
                    <button
                      key={dd.day}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleApplyDay(dd.day)}
                      className={cx(
                        'flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-800',
                        on
                          ? 'bg-accent text-white shadow-sm dark:shadow-none'
                          : 'bg-white text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                      )}
                    >
                      <span
                        className={cx(
                          'flex h-5 w-5 items-center justify-center rounded-md font-serif text-[13px] font-semibold leading-none',
                          on
                            ? 'bg-white/20'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-300',
                        )}
                      >
                        {dayShort(dd.day)}
                      </span>
                      <span className="hidden sm:inline">{dd.short}</span>
                    </button>
                  )
                })}
              </div>
              {applyDays.length > 1 && (
                <p className="mt-2.5 text-[11px] text-amber-600 dark:text-amber-400">
                  會覆寫所揀日子嘅同一節（已有課堂會被取代）。
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
