import { useMode } from '../context/ModeContext'
import { MODES, MODE_ORDER } from '../modes/modes'

// 模式切換掣 — 平台核心互動：一撳就喺學習 / 工作之間切換
export default function ModeSwitcher() {
  const { mode, setMode } = useMode()

  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
      {MODE_ORDER.map((id) => {
        const def = MODES[id]
        const active = id === mode
        return (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={
              active
                ? 'flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm'
                : 'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-700'
            }
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
