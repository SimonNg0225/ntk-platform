import { Fragment } from 'react'
import { Check } from 'lucide-react'
import { cx } from '../../../../ui'

// ============================================================
//  引導式四步進度條。已行到的步驟（≤ maxReached）可㩒回到改。
// ============================================================

export interface StepDef {
  id: number
  label: string
}

export default function StepRail({
  steps,
  current,
  maxReached,
  onJump,
}: {
  steps: StepDef[]
  current: number
  /** 行到過的最高步驟 —— ≤ 這個都可以㩒回到 */
  maxReached: number
  onJump: (id: number) => void
}): JSX.Element {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {steps.map((s, i) => {
        const done = s.id < current
        const active = s.id === current
        const reachable = s.id <= maxReached
        return (
          <Fragment key={s.id}>
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onJump(s.id)}
              aria-current={active ? 'step' : undefined}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default',
                active
                  ? 'bg-accent text-white'
                  : done
                    ? 'bg-accent-soft text-accent-strong hover:opacity-80 dark:bg-accent/15 dark:text-accent'
                    : reachable
                      ? 'text-slate-500 hover:bg-black/[0.04] dark:text-slate-400 dark:hover:bg-white/[0.06]'
                      : 'text-slate-300 dark:text-slate-600',
              )}
            >
              <span
                className={cx(
                  'flex h-4 w-4 items-center justify-center rounded-full text-[10px] tabular-nums',
                  active ? 'bg-white/25' : done ? 'bg-accent/20' : 'bg-black/[0.06] dark:bg-white/10',
                )}
              >
                {done ? <Check size={11} /> : s.id}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < steps.length - 1 && (
              <span
                className={cx('h-px w-3 sm:w-5', done ? 'bg-accent/40' : 'bg-black/10 dark:bg-white/15')}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
