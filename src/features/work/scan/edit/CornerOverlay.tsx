import { useRef } from 'react'
import type { Corners, Pt } from '../lib/types'

type Key = keyof Corners

/** corners 以 0..1 正規化座標表示（相對圖片）。 */
export default function CornerOverlay({
  corners, onChange,
}: { corners: Corners; onChange: (c: Corners) => void }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<Key | null>(null)

  function toNorm(e: PointerEvent | React.PointerEvent): Pt {
    const box = boxRef.current!.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    }
  }
  function startDrag(k: Key) {
    dragging.current = k
    const move = (ev: PointerEvent) => {
      if (!dragging.current) return
      onChange({ ...corners, [dragging.current]: toNorm(ev) })
    }
    const up = () => { dragging.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const pts: [Key, Pt][] = [['tl', corners.tl], ['tr', corners.tr], ['br', corners.br], ['bl', corners.bl]]

  return (
    <div ref={boxRef} className="absolute inset-0 touch-none">
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <polygon points={pts.map(([, p]) => `${p.x * 100},${p.y * 100}`).join(' ')}
          fill="rgba(99,102,241,0.12)" stroke="rgb(99,102,241)" strokeWidth="0.5" />
      </svg>
      {pts.map(([k, p]) => (
        <button key={k} type="button" aria-label={k}
          onPointerDown={() => startDrag(k)}
          className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow-md"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} />
      ))}
    </div>
  )
}
