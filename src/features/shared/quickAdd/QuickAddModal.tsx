import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  CalendarDays,
  ListTodo,
  Plus,
  Repeat,
  Sparkles,
  X,
} from 'lucide-react'
import { useToast } from '../../../context/ToastContext'
import { useMode } from '../../../context/ModeContext'
import { useNav } from '../../../context/NavContext'
import { isAIConfigured } from '../../../lib/aiClient'
import { tasksCol, countdownsCol, eventsCol } from '../../../data/collections'
import type { CountdownCategory } from '../../../data/types'
import {
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  SegmentedControl,
  Select,
  Textarea,
} from '../../../ui'
import {
  parseQuickAdd,
  type ParsedDraft,
  type QuickAddKind,
  type RecurrenceDraft,
} from './parse'

// ============================================================
//  QuickAddModal — 全域「快速加入」（AI 一鍵自然語言 → 三類）
//  ------------------------------------------------------------
//  步驟一：打一句自然語言 →「分析」→ parseQuickAdd(text, mode)。
//  步驟二：預覽卡 —— SegmentedControl 切類型（待辦 / 提醒 / 行事曆），
//          按 kind 顯示可改欄位（標題 / 日期 / 時間 / 結束 / 分類）。
//          parse 回 null 即退「手動模式」：kind=task、title=原文，唔卡死。
//  「加入」→ 按 kind 寫入對應 collection → toast +「檢視」捷徑 → onClose。
//
//  · 未接 AI（!isAIConfigured）顯示友善 gate（同題庫 AI 出題一致）。
//  · mode 取自 useMode()；色用 --accent（工作=teal / 學習=indigo）。
//  · 深色 / 375px OK；繁體中文。零新 collection、零改 model。
// ============================================================

export interface QuickAddModalProps {
  open: boolean
  onClose: () => void
}

// 三類分流：label + icon + toast 文案 + 「檢視」目標 featureId
const KIND_META: Record<
  QuickAddKind,
  { label: string; icon: typeof ListTodo; toast: string; navId: string }
> = {
  task: { label: '待辦', icon: ListTodo, toast: '已加入待辦', navId: 'work-tasks' },
  countdown: {
    label: '提醒',
    icon: CalendarClock,
    toast: '已加入提醒',
    navId: 'countdown',
  },
  event: {
    label: '行事曆',
    icon: CalendarDays,
    toast: '已加入行事曆',
    navId: 'calendar',
  },
}

const KIND_OPTIONS = (['task', 'countdown', 'event'] as QuickAddKind[]).map(
  (id) => ({ id, label: KIND_META[id].label, icon: KIND_META[id].icon }),
)

const CATEGORY_OPTIONS: { id: CountdownCategory; label: string }[] = [
  { id: 'exam', label: '考試' },
  { id: 'deadline', label: '死線' },
  { id: 'assessment', label: '測驗' },
  { id: 'event', label: '活動' },
  { id: 'other', label: '其他' },
]

// 重複（只限 event 卡）：none / 每日 / 每週。'' = 不重複。
type RecFreqOption = '' | 'daily' | 'weekly'

// 輕量 t 型別（同 react-i18next 嘅 t 相容；含 {{n}} 插值用嘅 n）。
type TFn = (key: string, opts?: { defaultValue?: string; n?: number }) => string

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'] as const

/** 重複選項（雙語）：zh-HK 靠 defaultValue，en 喺 appEn.qadd。 */
function recurrenceOptions(t: TFn): { id: RecFreqOption; label: string }[] {
  return [
    { id: '', label: t('qadd.recurNone', { defaultValue: '不重複' }) },
    { id: 'daily', label: t('qadd.recurDaily', { defaultValue: '每日' }) },
    { id: 'weekly', label: t('qadd.recurWeekly', { defaultValue: '每週' }) },
  ]
}

/** 把 RecurrenceDraft 講成一句（卡上 Badge 用；雙語）。 */
function recurrenceDraftLabel(rec: RecurrenceDraft, t: TFn): string {
  const n = Math.max(1, rec.interval ?? 1)
  if (rec.freq === 'daily')
    return n === 1
      ? t('qadd.daily', { defaultValue: '每日' })
      : t('qadd.everyNDays', { defaultValue: '每 {{n}} 日', n })
  // weekly
  const base =
    n === 1
      ? t('qadd.weekly', { defaultValue: '每週' })
      : t('qadd.everyNWeeks', { defaultValue: '每 {{n}} 週', n })
  if (rec.byWeekday && rec.byWeekday.length) {
    const sep = t('qadd.wdSep', { defaultValue: '' })
    const names = [...rec.byWeekday]
      .sort((a, b) => a - b)
      .map((d) => t(`qadd.wd${d}`, { defaultValue: WEEKDAY_LABELS[d] }))
      .join(sep)
    return `${base} ${names}`
  }
  return base
}

const EXAMPLES = [
  '下星期三 3pm 同 5A 家長開會',
  '6 月 20 號交專題報告',
  '影印明日課堂筆記',
]

export function QuickAddModal({ open, onClose }: QuickAddModalProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { mode } = useMode()
  const nav = useNav()

  const [step, setStep] = useState<'input' | 'preview'>('input')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  // 一段文字可拆出多項 → 多張預覽卡。
  const [drafts, setDrafts] = useState<ParsedDraft[]>([])

  // 關閉時重設，下次開返乾淨一張（用喺 onClose 同成功加入後）
  const reset = () => {
    setStep('input')
    setText('')
    setBusy(false)
    setDrafts([])
  }
  const close = () => {
    reset()
    onClose()
  }

  // 步驟一：交畀 AI 分析 → 入預覽。parse 回 null（AI 出錯 / 解唔到）
  // 一律退「手動模式」：kind=task、title=原文（已 trim），用戶自己揀類型／填日期。
  const analyze = async () => {
    const input = text.trim()
    if (!input || busy) return
    setBusy(true)
    try {
      const parsed = await parseQuickAdd(input, mode)
      if (parsed.length > 0) {
        setDrafts(parsed)
      } else {
        toast.info('AI 分析唔到，已轉做手動填寫')
        setDrafts([{ kind: 'task', title: input, mode }])
      }
      setStep('preview')
    } catch (e) {
      toast.error((e as Error).message || 'AI 分析失敗，請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  // 預覽卡欄位更新（逐張，by index）
  const patch = (i: number, p: Partial<ParsedDraft>) =>
    setDrafts((ds) => ds.map((d, idx) => (idx === i ? { ...d, ...p } : d)))

  const removeDraft = (i: number) =>
    setDrafts((ds) => ds.filter((_, idx) => idx !== i))

  // 步驟二：全部加入 → 逐項按 kind 寫入對應 collection → toast → 關閉
  const commit = () => {
    const valid = drafts.filter((d) => d.title.trim())
    if (valid.length === 0) {
      toast.error('請先填寫標題')
      return
    }
    const createdAt = new Date().toISOString()
    for (const d of valid) {
      const title = d.title.trim()
      if (d.kind === 'task') {
        tasksCol.add({ text: title, done: false, createdAt })
      } else if (d.kind === 'countdown') {
        countdownsCol.add({
          title,
          date: d.date ?? '',
          time: d.time || undefined,
          category: d.category,
          mode: d.mode,
          notes: d.notes,
          createdAt,
        })
      } else {
        eventsCol.add({
          title,
          date: d.date ?? '',
          time: d.time || undefined,
          endTime: d.endTime || undefined,
          allDay: !d.time,
          mode: d.mode,
          notes: d.notes,
          // 重複偵測：RecurrenceDraft → RecurrenceRule（只填 freq/interval/byWeekday，其餘留空）
          ...(d.recurrence
            ? {
                recurrence: {
                  freq: d.recurrence.freq,
                  interval: d.recurrence.interval ?? 1,
                  ...(d.recurrence.freq === 'weekly' && d.recurrence.byWeekday?.length
                    ? { byWeekday: d.recurrence.byWeekday }
                    : {}),
                },
              }
            : {}),
        })
      }
    }
    if (valid.length === 1) {
      const meta = KIND_META[valid[0].kind]
      toast.success(meta.toast, {
        label: '檢視',
        onClick: () => nav.open(meta.navId),
      })
    } else {
      toast.success(`已加入 ${valid.length} 項`)
    }
    close()
  }

  // ───────── 未接 AI：友善 gate（同題庫 AI 出題一致）─────────
  if (!isAIConfigured) {
    return (
      <Modal open={open} onClose={close} title="快速加入">
        <div className="space-y-4">
          <EmptyState
            icon={Bot}
            title="AI 助手未啟用"
            hint="快速加入要靠 AI 分析你嘅文字。要設定好 Supabase 並部署 gemini Edge Function 先用到，步驟見 docs/SETUP.md。"
          />
          <div className="flex justify-end">
            <Button variant="secondary" onClick={close}>
              關閉
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={close} title="快速加入">
      {step === 'input' ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent-soft/50 p-3.5 dark:border-accent/25 dark:bg-accent/10">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
              <Sparkles size={16} />
            </span>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              打一句自然語言，AI 會幫你自動分流做{' '}
              <span className="font-semibold text-accent-strong dark:text-accent">
                待辦 / 提醒 / 行事曆
              </span>
              ，再畀你確認同修改。例如「下星期三 3pm 同家長開會」。
            </p>
          </div>

          <Field label="想記低啲乜？">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // ⌘/Ctrl + Enter 快速分析
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault()
                  void analyze()
                }
              }}
              placeholder="例如：下星期三 3pm 同 5A 家長開會 / 6 月 20 號交報告 / 影印筆記"
              rows={3}
              disabled={busy}
              autoFocus
            />
          </Field>

          <div className="-mt-1.5 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={busy}
                onClick={() => setText(ex)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-accent/40 hover:bg-accent-soft hover:text-accent-strong disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-accent/40 dark:hover:bg-accent/10 dark:hover:text-accent"
              >
                <Plus size={12} />
                {ex}
              </button>
            ))}
          </div>

          {busy && (
            <div
              className="space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-700/80 dark:bg-slate-900/40"
              aria-live="polite"
            >
              <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Sparkles size={15} className="animate-pulse text-accent" />
                AI 分析緊，請等一等…
              </p>
              <div className="h-2.5 w-full animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-2.5 w-3/5 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700/60">
            <Button variant="secondary" onClick={close}>
              取消
            </Button>
            <Button
              icon={Sparkles}
              loading={busy}
              onClick={analyze}
              disabled={busy || !text.trim()}
            >
              {busy ? '分析中…' : '分析'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            AI 拆咗{' '}
            <span className="font-semibold text-accent-strong dark:text-accent">
              {drafts.length}
            </span>{' '}
            項，逐張可改類型／日期／時間、或剔走唔要嘅，確認後一次過加入。
          </p>

          <div className="space-y-3">
            {drafts.map((d, i) => {
              const needsDate = d.kind !== 'task' && !d.date
              return (
                <div
                  key={i}
                  className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 dark:border-slate-700/70 dark:bg-slate-900/30"
                >
                  {/* 序號 + 類型切換 + 移除 */}
                  <div className="flex items-center gap-2">
                    <span className="nums flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent-strong dark:text-accent">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <SegmentedControl
                        options={KIND_OPTIONS}
                        value={d.kind}
                        onChange={(kind) => patch(i, { kind })}
                      />
                    </div>
                    {drafts.length > 1 && (
                      <IconButton
                        label="移除呢項"
                        size="sm"
                        onClick={() => removeDraft(i)}
                      >
                        <X size={15} />
                      </IconButton>
                    )}
                  </div>

                  <Field label="標題" required>
                    <Input
                      value={d.title}
                      onChange={(e) => patch(i, { title: e.target.value })}
                      placeholder="例如：同 5A 家長開會"
                    />
                  </Field>

                  {/* 提醒 / 行事曆：日期 + 時間 */}
                  {d.kind !== 'task' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        label="日期"
                        error={needsDate ? '請揀一個日子' : undefined}
                      >
                        <Input
                          type="date"
                          value={d.date ?? ''}
                          onChange={(e) =>
                            patch(i, { date: e.target.value || undefined })
                          }
                          invalid={needsDate}
                        />
                      </Field>
                      <Field
                        label={d.kind === 'event' ? '開始時間' : '時間（選填）'}
                      >
                        <Input
                          type="time"
                          value={d.time ?? ''}
                          onChange={(e) =>
                            patch(i, { time: e.target.value || undefined })
                          }
                        />
                      </Field>
                    </div>
                  )}

                  {d.kind === 'event' && (
                    <Field label="結束時間（選填）">
                      <Input
                        type="time"
                        value={d.endTime ?? ''}
                        onChange={(e) =>
                          patch(i, { endTime: e.target.value || undefined })
                        }
                      />
                    </Field>
                  )}

                  {/* 行事曆：重複（AI 偵測「每日 / 逢週X」等；可改 不重複/每日/每週）*/}
                  {d.kind === 'event' && (
                    <Field label={t('qadd.repeat', { defaultValue: '重複' })}>
                      <SegmentedControl
                        options={recurrenceOptions(t)}
                        value={(d.recurrence?.freq ?? '') as RecFreqOption}
                        onChange={(freq) => {
                          if (!freq) {
                            patch(i, { recurrence: undefined })
                            return
                          }
                          const prev = d.recurrence
                          const next: RecurrenceDraft = {
                            freq,
                            interval: prev?.interval ?? 1,
                            // 由每週切走再切返時，保留 AI 偵測到嘅星期幾
                            ...(freq === 'weekly' && prev?.byWeekday?.length
                              ? { byWeekday: prev.byWeekday }
                              : {}),
                          }
                          patch(i, { recurrence: next })
                        }}
                      />
                      {d.recurrence && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent-strong dark:text-accent">
                          <Repeat size={12} />
                          {recurrenceDraftLabel(d.recurrence, t)}
                        </span>
                      )}
                    </Field>
                  )}

                  {d.kind === 'countdown' && (
                    <Field label="分類">
                      <Select
                        value={d.category ?? ''}
                        onChange={(e) =>
                          patch(i, {
                            category: (e.target.value || undefined) as
                              | CountdownCategory
                              | undefined,
                          })
                        }
                      >
                        <option value="">未分類</option>
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700/60">
            <Button
              variant="ghost"
              icon={ArrowLeft}
              onClick={() => setStep('input')}
            >
              重新分析
            </Button>
            <Button variant="secondary" onClick={close}>
              取消
            </Button>
            <Button
              icon={Plus}
              onClick={commit}
              disabled={!drafts.some((d) => d.title.trim())}
            >
              全部加入{drafts.length > 1 ? `（${drafts.length}）` : ''}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default QuickAddModal
