import { useEffect, useRef, useState } from 'react'
import { useCollection } from '../../lib/store'
import { focusCol } from '../../data/collections'
import { Button, Input, StatCard, Pills } from '../../ui'

const PRESETS = [
  { focus: 25, brk: 5 },
  { focus: 50, brk: 10 },
  { focus: 15, brk: 3 },
]

export default function FocusTimer() {
  const sessions = useCollection(focusCol)
  const [preset, setPreset] = useState(PRESETS[0])
  const [phase, setPhase] = useState<'focus' | 'break'>('focus')
  const [secondsLeft, setSecondsLeft] = useState(PRESETS[0].focus * 60)
  const [running, setRunning] = useState(false)
  const [label, setLabel] = useState('')
  const tick = useRef<number | null>(null)

  // 倒數
  useEffect(() => {
    if (!running) return
    tick.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          handlePhaseEnd()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => {
      if (tick.current) window.clearInterval(tick.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase, preset])

  function handlePhaseEnd() {
    if (phase === 'focus') {
      focusCol.add({
        startedAt: new Date().toISOString(),
        durationMin: preset.focus,
        label: label.trim() || undefined,
        completed: true,
      })
      setPhase('break')
      setSecondsLeft(preset.brk * 60)
    } else {
      setPhase('focus')
      setSecondsLeft(preset.focus * 60)
    }
    setRunning(false)
  }

  const reset = () => {
    setRunning(false)
    setSecondsLeft((phase === 'focus' ? preset.focus : preset.brk) * 60)
  }

  const choosePreset = (p: (typeof PRESETS)[number]) => {
    setPreset(p)
    setPhase('focus')
    setRunning(false)
    setSecondsLeft(p.focus * 60)
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  // 今日統計
  const today = new Date().toISOString().slice(0, 10)
  const todaySessions = sessions.filter((s) => s.startedAt.slice(0, 10) === today)
  const todayMin = todaySessions.reduce((sum, s) => sum + s.durationMin, 0)

  const totalSec = (phase === 'focus' ? preset.focus : preset.brk) * 60
  const pct = ((totalSec - secondsLeft) / totalSec) * 100

  return (
    <div className="space-y-5">
      <div className="flex justify-center">
        <Pills<string>
          options={PRESETS.map((p) => ({
            id: String(p.focus),
            label: `${p.focus}/${p.brk}`,
          }))}
          active={String(preset.focus)}
          onChange={(id) => {
            const p = PRESETS.find((x) => String(x.focus) === id)
            if (p) choosePreset(p)
          }}
        />
      </div>

      {/* 計時圈 */}
      <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="6" />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 45}
            strokeDashoffset={2 * Math.PI * 45 * (1 - pct / 100)}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {phase === 'focus' ? '專注中' : '休息'}
          </p>
          <p className="mt-1 text-5xl font-bold tabular-nums text-slate-800">
            {mm}:{ss}
          </p>
        </div>
      </div>

      {phase === 'focus' && (
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="而家專注緊咩？（選填）"
          className="text-center"
        />
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={() => setRunning((r) => !r)}>
          {running ? '暫停' : '開始'}
        </Button>
        <Button size="lg" variant="secondary" onClick={reset}>
          重設
        </Button>
        <Button size="lg" variant="secondary" onClick={handlePhaseEnd}>
          跳過
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="今日節數" value={todaySessions.length} unit="節" icon="🍅" highlight />
        <StatCard label="今日分鐘" value={todayMin} unit="分鐘" icon="⏱️" />
      </div>
    </div>
  )
}
