import {
  AlertCircle,
  ArrowUpRight,
  CalendarPlus,
  CheckCircle2,
  Circle,
  LayoutGrid,
  ListChecks,
  ListTodo,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react'
import { Button, cx } from '../../../ui'
import type { AgentOpenToolStep, AgentPlan } from './agent'

export type AgentStepState =
  | 'pending'
  | 'running'
  | 'done'
  | 'ready'
  | 'failed'
  | 'undone'

const STEP_ICON = {
  open_tool: LayoutGrid,
  create_task: ListTodo,
  create_event: CalendarPlus,
} as const

function StepStatus({ state }: { state: AgentStepState }) {
  if (state === 'running') {
    return <LoaderCircle size={18} className="animate-spin text-accent motion-reduce:animate-none" />
  }
  if (state === 'done') return <CheckCircle2 size={18} className="text-emerald-600" />
  if (state === 'ready') return <ArrowUpRight size={18} className="text-accent" />
  if (state === 'failed') return <AlertCircle size={18} className="text-rose-600" />
  if (state === 'undone') return <RotateCcw size={17} className="text-slate-400" />
  return <Circle size={17} className="text-slate-300 dark:text-slate-600" />
}

export default function AgentPlanPanel({
  plan,
  states,
  executing,
  completed,
  canUndo,
  onConfirm,
  onCancel,
  onOpenTool,
  onUndo,
}: {
  plan: AgentPlan
  states: Record<string, AgentStepState>
  executing: boolean
  completed: boolean
  canUndo: boolean
  onConfirm: () => void
  onCancel: () => void
  onOpenTool: (step: AgentOpenToolStep) => void
  onUndo: () => void
}) {
  const statusLabel = executing ? '正在執行' : completed ? '已完成' : '等你確認'

  return (
    <article
      aria-label="執行計劃"
      className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
            <ListChecks size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{plan.title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {plan.summary}
            </p>
          </div>
        </div>
        <span
          className={cx(
            'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
            completed
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
              : executing
                ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
          )}
        >
          {statusLabel}
        </span>
      </div>

      <ol className="border-y border-slate-200 dark:border-slate-700">
        {plan.steps.map((step, index) => {
          const Icon = STEP_ICON[step.kind]
          const state = states[step.id] ?? 'pending'
          return (
            <li
              key={step.id}
              className="flex min-h-[68px] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-800 sm:px-5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Icon size={17} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {index + 1}. {step.title}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">
                  {step.detail}
                </p>
              </div>
              {step.kind === 'open_tool' && state === 'ready' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  iconRight={ArrowUpRight}
                  onClick={() => onOpenTool(step)}
                  aria-label={`開啟${step.toolLabel}`}
                >
                  開啟
                </Button>
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center" aria-label={state}>
                  <StepStatus state={state} />
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {!completed && !executing && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <ShieldCheck size={15} className="text-emerald-600" />
            寫入資料前由你確認
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              取消
            </Button>
            <Button type="button" size="sm" onClick={onConfirm}>
              確認並執行
            </Button>
          </div>
        </div>
      )}

      {completed && canUndo && (
        <div className="flex justify-end px-4 py-3 sm:px-5">
          <Button type="button" size="sm" variant="ghost" icon={RotateCcw} onClick={onUndo}>
            撤回新增項目
          </Button>
        </div>
      )}
    </article>
  )
}
