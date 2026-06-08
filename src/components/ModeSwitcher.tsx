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
          ? 'flex gap-0.5 rounded-full bg-black/[0.05] p-0.5 dark:bg-white/[0.07]'
          : 'flex gap-1 rounded-xl bg-black/[0.05] p-1 dark:bg-white/[0.07]'
      }
    >
      {MODE_ORDER.map((id) => {
        const def = MODES[id]
        const active = id === mode
        const activeCls =
          'bg-white text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04] dark:bg-slate-700 dark:text-white dark:ring-white/10'
        return (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={[
              'flex flex-1 items-center justify-center gap-1.5 font-semibold transition duration-200 active:scale-[0.97]',
              compact ? 'rounded-full px-3 py-1.5 text-xs' : 'rounded-lg px-3 py-2 text-[13px]',
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
