import { useMode } from '../context/ModeContext'
import { MODES, MODE_ORDER } from '../modes/modes'

// 模式切換掣 — 平台核心互動：一撳就喺學習 / 工作之間切換
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
          ? 'flex gap-0.5 rounded-full bg-slate-100 p-0.5'
          : 'flex gap-1 rounded-2xl bg-slate-100 p-1'
      }
    >
      {MODE_ORDER.map((id) => {
        const def = MODES[id]
        const active = id === mode
        const activeCls = compact
          ? 'bg-white text-slate-800 shadow-sm'
          : 'bg-white text-slate-800 shadow-sm'
        return (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={[
              'flex flex-1 items-center justify-center gap-1.5 rounded-full font-semibold transition',
              compact ? 'px-3 py-1.5 text-xs' : 'rounded-xl px-3 py-2 text-sm',
              active ? activeCls : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
            aria-pressed={active}
          >
            <span>{def.icon}</span>
            <span>{def.short}</span>
          </button>
        )
      })}
    </div>
  )
}
