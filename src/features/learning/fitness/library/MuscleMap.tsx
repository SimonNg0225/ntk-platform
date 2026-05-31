// ============================================================
//  2D 肌群人體圖（代替 3D）—— 前 / 後視圖，按目標肌群著色。
//  紅 = 主要肌（prime mover）、橙 = 協同/穩定肌、灰 = 其餘。
//  （慣用「肌肉激活」配色；只此元件用，唔改全局海軍藍主題。）
//  肌群名詞彙來自 library/data.ts，用 fuzzy 對應到 16 個身體區域。
// ============================================================

export type Region =
  | 'chest' | 'shoulders' | 'biceps' | 'triceps' | 'forearms'
  | 'abs' | 'obliques' | 'lats' | 'traps' | 'upperback' | 'lowerback'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'adductors'

/** 單個肌群名 → 區域（fuzzy；認唔到、空字串、非字串都回 null） */
export function regionFor(muscle: string): Region | null {
  if (typeof muscle !== 'string' || !muscle) return null
  const m = muscle
  if (m.includes('胸')) return 'chest'
  if (m.includes('三角') || m === '肩' || m.includes('旋轉肌')) return 'shoulders'
  if (m.includes('二頭') || m.includes('肱肌') || m.includes('肱橈')) return 'biceps'
  if (m.includes('三頭')) return 'triceps'
  if (m.includes('前臂')) return 'forearms'
  if (m.includes('腹斜')) return 'obliques'
  if (m.includes('腹') || m.includes('核心')) return 'abs'
  if (m.includes('背闊')) return 'lats'
  if (m.includes('斜方')) return 'traps'
  if (m.includes('菱形') || m.includes('上背')) return 'upperback'
  if (m.includes('豎脊') || m.includes('下背')) return 'lowerback'
  if (m.includes('股四頭') || m.includes('髖屈')) return 'quads'
  if (m.includes('膕繩')) return 'hamstrings'
  if (m.includes('臀')) return 'glutes'
  if (m.includes('腓腸') || m.includes('比目魚') || m.includes('小腿')) return 'calves'
  if (m.includes('內收')) return 'adductors'
  return null
}

export function regionsFor(muscles: string[]): Set<Region> {
  const s = new Set<Region>()
  if (!Array.isArray(muscles)) return s
  for (const m of muscles) {
    const r = regionFor(m)
    if (r) s.add(r)
  }
  return s
}

const PRIMARY = '#ef4444' // red-500
const SECONDARY = '#f59e0b' // amber-500

// 每個區域喺前 / 後視圖嘅形狀（stylised；x 對稱用兩件）。
// 用簡單 ellipse / rounded-rect 砌出可辨識嘅肌群塊。
interface Shape {
  region: Region
  el: 'ellipse' | 'rect'
  // ellipse: cx cy rx ry ; rect: x y w h (rx 圓角)
  a: number
  b: number
  c: number
  d: number
}

// 前視圖形狀（viewBox 0 0 120 240）
const FRONT: Shape[] = [
  { region: 'shoulders', el: 'ellipse', a: 34, b: 60, c: 11, d: 9 },
  { region: 'shoulders', el: 'ellipse', a: 86, b: 60, c: 11, d: 9 },
  { region: 'chest', el: 'rect', a: 44, b: 56, c: 14, d: 16 },
  { region: 'chest', el: 'rect', a: 62, b: 56, c: 14, d: 16 },
  { region: 'biceps', el: 'ellipse', a: 30, b: 78, c: 7, d: 13 },
  { region: 'biceps', el: 'ellipse', a: 90, b: 78, c: 7, d: 13 },
  { region: 'forearms', el: 'ellipse', a: 26, b: 100, c: 6, d: 13 },
  { region: 'forearms', el: 'ellipse', a: 94, b: 100, c: 6, d: 13 },
  { region: 'abs', el: 'rect', a: 50, b: 76, c: 20, d: 26 },
  { region: 'obliques', el: 'rect', a: 44, b: 78, c: 5, d: 22 },
  { region: 'obliques', el: 'rect', a: 71, b: 78, c: 5, d: 22 },
  { region: 'quads', el: 'rect', a: 46, b: 112, c: 12, d: 44 },
  { region: 'quads', el: 'rect', a: 62, b: 112, c: 12, d: 44 },
  { region: 'adductors', el: 'rect', a: 58, b: 112, c: 4, d: 30 },
  { region: 'calves', el: 'rect', a: 47, b: 168, c: 10, d: 40 },
  { region: 'calves', el: 'rect', a: 63, b: 168, c: 10, d: 40 },
]

// 後視圖形狀
const BACK: Shape[] = [
  { region: 'traps', el: 'rect', a: 48, b: 50, c: 24, d: 16 },
  { region: 'shoulders', el: 'ellipse', a: 34, b: 60, c: 11, d: 9 },
  { region: 'shoulders', el: 'ellipse', a: 86, b: 60, c: 11, d: 9 },
  { region: 'upperback', el: 'rect', a: 50, b: 64, c: 20, d: 10 },
  { region: 'lats', el: 'rect', a: 42, b: 72, c: 12, d: 22 },
  { region: 'lats', el: 'rect', a: 66, b: 72, c: 12, d: 22 },
  { region: 'lowerback', el: 'rect', a: 52, b: 94, c: 16, d: 12 },
  { region: 'triceps', el: 'ellipse', a: 30, b: 78, c: 7, d: 13 },
  { region: 'triceps', el: 'ellipse', a: 90, b: 78, c: 7, d: 13 },
  { region: 'forearms', el: 'ellipse', a: 26, b: 100, c: 6, d: 13 },
  { region: 'forearms', el: 'ellipse', a: 94, b: 100, c: 6, d: 13 },
  { region: 'glutes', el: 'rect', a: 46, b: 110, c: 28, d: 16 },
  { region: 'hamstrings', el: 'rect', a: 46, b: 128, c: 12, d: 36 },
  { region: 'hamstrings', el: 'rect', a: 62, b: 128, c: 12, d: 36 },
  { region: 'calves', el: 'rect', a: 47, b: 168, c: 10, d: 40 },
  { region: 'calves', el: 'rect', a: 63, b: 168, c: 10, d: 40 },
]

function Figure({
  shapes,
  label,
  primary,
  secondary,
}: {
  shapes: Shape[]
  label: string
  primary: Set<Region>
  secondary: Set<Region>
}) {
  const fill = (r: Region) =>
    primary.has(r) ? PRIMARY : secondary.has(r) ? SECONDARY : 'currentColor'
  const op = (r: Region) => (primary.has(r) || secondary.has(r) ? 1 : 0.25)
  return (
    <figure className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 120 240" className="h-48 w-auto text-slate-300 dark:text-slate-600" role="img" aria-label={`${label}肌群圖`}>
        {/* 身體底圖（中性輪廓） */}
        <g fill="currentColor" opacity={0.18}>
          <circle cx={60} cy={26} r={13} />
          <rect x={42} y={40} width={36} height={72} rx={12} />
          <rect x={24} y={56} width={14} height={56} rx={7} />
          <rect x={82} y={56} width={14} height={56} rx={7} />
          <rect x={44} y={108} width={14} height={104} rx={7} />
          <rect x={62} y={108} width={14} height={104} rx={7} />
        </g>
        {/* 肌群區域 */}
        {shapes.map((s, i) =>
          s.el === 'ellipse' ? (
            <ellipse key={i} cx={s.a} cy={s.b} rx={s.c} ry={s.d} fill={fill(s.region)} opacity={op(s.region)} />
          ) : (
            <rect key={i} x={s.a} y={s.b} width={s.c} height={s.d} rx={3} fill={fill(s.region)} opacity={op(s.region)} />
          ),
        )}
      </svg>
      <figcaption className="text-[11px] text-slate-400">{label}</figcaption>
    </figure>
  )
}

export function MuscleMap({
  primaryMuscles,
  secondaryMuscles = [],
  className,
}: {
  primaryMuscles: string[]
  secondaryMuscles?: string[]
  className?: string
}) {
  const primary = regionsFor(primaryMuscles)
  const secondaryRaw = regionsFor(secondaryMuscles)
  // 主要肌優先：若同時喺主要，唔重複落協同色
  const secondary = new Set<Region>([...secondaryRaw].filter((r) => !primary.has(r)))
  return (
    <div className={className}>
      <div className="flex items-start justify-center gap-4">
        <Figure shapes={FRONT} label="正面" primary={primary} secondary={secondary} />
        <Figure shapes={BACK} label="背面" primary={primary} secondary={secondary} />
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PRIMARY }} /> 主要肌
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: SECONDARY }} /> 協同肌
        </span>
      </div>
    </div>
  )
}
