import { useMode } from '../context/ModeContext'
import { MODES, MODE_ORDER } from '../modes/modes'
import { FeatureIcon } from '../features/featureIcons'

// 模式切換掣 — 平台核心互動：一撳就喺個人 / 工作之間切換
// size: 'full' = 側邊欄用 / 'compact' = 手機頂欄用
export default function ModeSwitcher({
  size = 'full',
}: {
  size?: 'full' | 'compact'
}) {
  const { mode, setMode } = useMode()
  const compact = size === 'compact'

  return (
    <div
      className={
        compact
          ? 'flex gap-0.5 rounded-full bg-slate-100 p-0.5 dark:bg-slate-800'
          : 'flex gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800'
      }
    >
      {MODE_ORDER.map((id) => {
        const def = MODES[id]
        const active = id === mode
        const activeCls = compact
          ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100'
          : 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100'
        return (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={[
              'flex flex-1 items-center justify-center gap-1.5 rounded-full font-semibold transition',
              compact ? 'px-3 py-1.5 text-xs' : 'rounded-xl px-3 py-2 text-sm',
              active
                ? activeCls
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
            ].join(' ')}
            aria-pressed={active}
          >
            <FeatureIcon
              icon={def.icon}
              size={compact ? 14 : 16}
              className={active ? 'text-accent' : undefined}
            />
            <span>{def.short}</span>
          </button>
        )
      })}
    </div>
  )
}
