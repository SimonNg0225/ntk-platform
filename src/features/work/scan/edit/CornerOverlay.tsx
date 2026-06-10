import { useRef, useState } from 'react'
import type { Corners, Pt } from '../lib/types'

type Key = keyof Corners

const LOUPE = 132 // 放大鏡直徑（px）
const ZOOM = 2.6 // 放大倍率

/**
 * 四角可拖裁切框（0..1 正規化座標）。
 * 拖角時顯示放大鏡（loupe）—— 喺難偵測場景靠手動都拖得到啱啱貼紙邊。
 * src = 底圖（畀放大鏡用），通常 = page.rawDataUrl。
 */
export default function CornerOverlay({
  corners, onChange, src,
}: { corners: Corners; onChange: (c: Corners) => void; src?: string }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const dragging = useRef<Key | null>(null)
  const [active, setActive] = useState<Key | null>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  function toNorm(e: PointerEvent | React.PointerEvent): Pt {
    const r = boxRef.current!.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    }
  }
  function startDrag(k: Key) {
    dragging.current = k
    const r = boxRef.current!.getBoundingClientRect()
    setBox({ w: r.width, h: r.height })
    setActive(k)
    const move = (ev: PointerEvent) => {
      if (!dragging.current) return
      onChange({ ...corners, [dragging.current]: toNorm(ev) })
    }
    const up = () => {
      dragging.current = null
      setActive(null)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const pts: [Key, Pt][] = [['tl', corners.tl], ['tr', corners.tr], ['br', corners.br], ['bl', corners.bl]]

  // 放大鏡：跟住正喺拖嘅角，顯示底圖放大、十字對準。
  const ap = active ? corners[active] : null
  const loupeOnRight = ap ? ap.x < 0.5 : false // 角喺左半 → 放大鏡擺右上（唔遮手指）

  return (
    <div ref={boxRef} className="absolute inset-0 touch-none">
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        <polygon points={pts.map(([, p]) => `${p.x * 100},${p.y * 100}`).join(' ')}
          fill="rgba(99,102,241,0.12)" stroke="rgb(99,102,241)" strokeWidth="0.5" />
      </svg>
      {pts.map(([k, p]) => (
        <button key={k} type="button" aria-label={k}
          onPointerDown={() => startDrag(k)}
          className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow-md ring-2 ring-accent/30"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} />
      ))}

      {ap && src && box.w > 0 && (
        <div
          className="pointer-events-none absolute top-2 z-10 overflow-hidden rounded-full border-2 border-white bg-slate-200 shadow-lg"
          style={{
            width: LOUPE, height: LOUPE,
            left: loupeOnRight ? undefined : 8,
            right: loupeOnRight ? 8 : undefined,
            backgroundImage: `url("${src}")`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: `${box.w * ZOOM}px ${box.h * ZOOM}px`,
            backgroundPosition: `${LOUPE / 2 - ap.x * box.w * ZOOM}px ${LOUPE / 2 - ap.y * box.h * ZOOM}px`,
          }}
        >
          {/* 十字對準 */}
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-accent/70" />
          <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-accent/70" />
          <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent" />
        </div>
      )}
    </div>
  )
}
