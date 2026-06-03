import { useState } from 'react'
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  CalendarDays,
  ListTodo,
  Plus,
  Sparkles,
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
  Input,
  Modal,
  SegmentedControl,
  Select,
  Textarea,
} from '../../../ui'
import { parseQuickAdd, type ParsedDraft, type QuickAddKind } from './parse'

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

const EXAMPLES = [
  '下星期三 3pm 同 5A 家長開會',
  '6 月 20 號交專題報告',
  '影印明日課堂筆記',
]

export function QuickAddModal({ open, onClose }: QuickAddModalProps) {
  const toast = useToast()
  const { mode } = useMode()
  const nav = useNav()

  const [step, setStep] = useState<'input' | 'preview'>('input')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<ParsedDraft | null>(null)

  // 關閉時重設，下次開返乾淨一張（用喺 onClose 同成功加入後）
  const reset = () => {
    setStep('input')
    setText('')
    setBusy(false)
    setDraft(null)
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
      if (parsed) {
        setDraft(parsed)
      } else {
        toast.info('AI 分析唔到，已轉做手動填寫')
        setDraft({ kind: 'task', title: input, mode })
      }
      setStep('preview')
    } catch (e) {
      toast.error((e as Error).message || 'AI 分析失敗，請再試一次。')
    } finally {
      setBusy(false)
    }
  }

  // 預覽卡欄位更新 helper（部分更新 draft）
  const patch = (p: Partial<ParsedDraft>) =>
    setDraft((d) => (d ? { ...d, ...p } : d))

  // 步驟二：確認 → 按 kind 寫入對應 collection → toast +「檢視」→ 關閉
  const commit = () => {
    if (!draft) return
    const title = draft.title.trim()
    if (!title) {
      toast.error('請先填寫標題')
      return
    }
    const createdAt = new Date().toISOString()

    if (draft.kind === 'task') {
      tasksCol.add({ text: title, done: false, createdAt })
    } else if (draft.kind === 'countdown') {
      countdownsCol.add({
        title,
        date: draft.date ?? '',
        time: draft.time || undefined,
        category: draft.category,
        mode: draft.mode,
        notes: draft.notes,
        createdAt,
      })
    } else {
      eventsCol.add({
        title,
        date: draft.date ?? '',
        time: draft.time || undefined,
        endTime: draft.endTime || undefined,
        allDay: !draft.time,
        mode: draft.mode,
        notes: draft.notes,
      })
    }

    const meta = KIND_META[draft.kind]
    toast.success(meta.toast, {
      label: '檢視',
      onClick: () => nav.open(meta.navId),
    })
    close()
  }

  // 提醒 / 行事曆冇日子時提示（仍可加，由用戶補；倒數頁會用空字串）
  const needsDate = draft && draft.kind !== 'task' && !draft.date

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
      ) : draft ? (
        <div className="space-y-4">
          {/* 類型切換 */}
          <Field label="類型">
            <SegmentedControl
              options={KIND_OPTIONS}
              value={draft.kind}
              onChange={(kind) => patch({ kind })}
            />
          </Field>

          <Field label="標題" required>
            <Input
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="例如：同 5A 家長開會"
            />
          </Field>

          {/* 待辦冇日期欄位；提醒 / 行事曆顯示日期 + 時間 */}
          {draft.kind !== 'task' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="日期"
                error={needsDate ? '請揀一個日子' : undefined}
              >
                <Input
                  type="date"
                  value={draft.date ?? ''}
                  onChange={(e) => patch({ date: e.target.value || undefined })}
                  invalid={!!needsDate}
                />
              </Field>
              <Field label={draft.kind === 'event' ? '開始時間' : '時間（選填）'}>
                <Input
                  type="time"
                  value={draft.time ?? ''}
                  onChange={(e) => patch({ time: e.target.value || undefined })}
                />
              </Field>
            </div>
          )}

          {/* 行事曆：結束時間 */}
          {draft.kind === 'event' && (
            <Field label="結束時間（選填）">
              <Input
                type="time"
                value={draft.endTime ?? ''}
                onChange={(e) => patch({ endTime: e.target.value || undefined })}
              />
            </Field>
          )}

          {/* 提醒：分類 */}
          {draft.kind === 'countdown' && (
            <Field label="分類">
              <Select
                value={draft.category ?? ''}
                onChange={(e) =>
                  patch({
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

          <Field label="備註（選填）">
            <Textarea
              value={draft.notes ?? ''}
              onChange={(e) => patch({ notes: e.target.value || undefined })}
              placeholder="補充細節…"
              rows={2}
            />
          </Field>

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
            <Button icon={Plus} onClick={commit} disabled={!draft.title.trim()}>
              加入{KIND_META[draft.kind].label}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

export default QuickAddModal
