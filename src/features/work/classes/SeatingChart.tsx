import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Dices,
  Eraser,
  Hand,
  Minus,
  Plus,
  Presentation,
  Shuffle,
  Sparkles,
  Users,
} from 'lucide-react'
import type { Student } from '../../../data/types'
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  SegmentedControl,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { studentMetaCol, type StudentMeta } from './types'
import { buildSeatGrid, initials, metaFor, splitGroups } from './util'

// ============================================================
//  座位表 + 課堂工具（隨機分組 / 抽點名）
//  參考真實課室管理（ClassDojo / Google Classroom seating）。
//  以 StudentMeta.seat（一維 index）持久化；點兩位學生交換座位。
// ============================================================

type Tool = 'seat' | 'group' | 'pick'

export default function SeatingChart({
  students,
  metas,
  cols,
  onColsChange,
}: {
  students: Student[]
  metas: StudentMeta[]
  cols: number
  onColsChange: (n: number) => void
}) {
  const toast = useToast()
  const [tool, setTool] = useState<Tool>('seat')

  if (students.length === 0)
    return (
      <EmptyState
        icon={Users}
        title="未有學生，未能排位"
        hint="先去「名冊」分頁加幾位學生入嚟，就可以喺度砌座位、隨機分組同抽點名。"
      />
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          value={tool}
          onChange={setTool}
          options={[
            { id: 'seat', label: '座位表', icon: Users },
            { id: 'group', label: '隨機分組', icon: Shuffle },
            { id: 'pick', label: '抽點名', icon: Dices },
          ]}
        />
        {tool === 'seat' && (
          <ColsStepper value={cols} onChange={onColsChange} />
        )}
      </div>

      {tool === 'seat' && (
        <SeatGrid
          students={students}
          metas={metas}
          cols={cols}
          onToast={toast.success}
        />
      )}
      {tool === 'group' && <GroupMaker students={students} />}
      {tool === 'pick' && <RandomPicker students={students} />}
    </div>
  )
}

// ───────── 欄數調整 ─────────
function ColsStepper({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800">
      <span className="text-xs text-slate-500 dark:text-slate-400">每行</span>
      <IconButton
        label="減少欄數"
        size="sm"
        disabled={value <= 2}
        onClick={() => onChange(Math.max(2, value - 1))}
      >
        <Minus size={14} />
      </IconButton>
      <span className="w-4 text-center font-semibold tabular-nums text-slate-700 dark:text-slate-200">
        {value}
      </span>
      <IconButton
        label="增加欄數"
        size="sm"
        disabled={value >= 10}
        onClick={() => onChange(Math.min(10, value + 1))}
      >
        <Plus size={14} />
      </IconButton>
    </div>
  )
}

// ───────── 座位網格（點選兩位交換）─────────
function SeatGrid({
  students,
  metas,
  cols,
  onToast,
}: {
  students: Student[]
  metas: StudentMeta[]
  cols: number
  onToast: (msg: string) => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const grid = useMemo(
    () => buildSeatGrid(students, metas, cols),
    [students, metas, cols],
  )

  // 把目前 grid 的實際座位 index 寫返每位學生（normalize），用嚟做交換基準
  const seatIndexOf = (sid: string): number => {
    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < cols; c++)
        if (grid[r][c]?.id === sid) return r * cols + c
    return -1
  }

  const persist = (sid: string, seat: number) => {
    const m = metas.find((x) => x.studentId === sid)
    if (m) studentMetaCol.update(m.id, { seat, updatedAt: new Date().toISOString() })
    else
      studentMetaCol.add({
        studentId: sid,
        status: 'active',
        seat,
        updatedAt: new Date().toISOString(),
      })
  }

  const onSeatClick = (sid: string | null, idx: number) => {
    if (!sid) {
      // 點空位：把已選學生移過嚟
      if (picked) {
        persist(picked, idx)
        setPicked(null)
        onToast('已移動座位')
      }
      return
    }
    if (!picked) {
      setPicked(sid)
      return
    }
    if (picked === sid) {
      setPicked(null)
      return
    }
    // 交換兩位學生座位
    const a = seatIndexOf(picked)
    const b = seatIndexOf(sid)
    persist(picked, b)
    persist(sid, a)
    setPicked(null)
    onToast('已交換座位')
  }

  const reset = () => {
    students.forEach((s) => {
      const m = metas.find((x) => x.studentId === s.id)
      if (m && (m.seat ?? -1) >= 0)
        studentMetaCol.update(m.id, { seat: -1, updatedAt: new Date().toISOString() })
    })
    setPicked(null)
    onToast('已清除座位安排')
  }

  return (
    <div className="space-y-3">
      {/* 黑板 / 講台 */}
      <div className="mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-slate-700 to-slate-800 py-2.5 text-xs font-medium tracking-wide text-slate-200 shadow-sm dark:from-slate-700/80 dark:to-slate-900">
        <Presentation size={14} className="text-slate-400" />
        黑板 / 講台
      </div>
      <div className="overflow-x-auto">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(56px, 1fr))` }}
      >
        {grid.flatMap((row, r) =>
          row.map((stu, c) => {
            const idx = r * cols + c
            const on = stu && picked === stu.id
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSeatClick(stu?.id ?? null, idx)}
                className={cx(
                  'relative flex aspect-[5/4] flex-col items-center justify-center gap-0.5 rounded-xl border p-1 text-center transition duration-200',
                  stu
                    ? on
                      ? 'border-accent bg-accent text-white shadow-md shadow-accent/30'
                      : 'border-slate-200/80 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-accent-soft hover:shadow-sm dark:border-slate-700/60 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-accent/15'
                    : 'border-dashed border-slate-200 bg-slate-50/60 text-slate-300 hover:border-accent/40 hover:bg-accent-soft/50 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-600',
                )}
              >
                {stu ? (
                  <>
                    <span
                      className={cx(
                        'absolute left-1 top-1 text-[8px] font-semibold tabular-nums',
                        on ? 'text-white/60' : 'text-slate-300 dark:text-slate-600',
                      )}
                    >
                      {idx + 1}
                    </span>
                    <span
                      className={cx(
                        'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold',
                        on
                          ? 'bg-white/20 text-white'
                          : 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
                      )}
                    >
                      {initials(stu.name)}
                    </span>
                    <span className="line-clamp-1 w-full text-[10px] font-medium leading-tight">
                      {stu.name}
                    </span>
                    {stu.studentNo && (
                      <span
                        className={cx(
                          'text-[9px] tabular-nums',
                          on ? 'text-white/70' : 'text-slate-400',
                        )}
                      >
                        {stu.studentNo}
                      </span>
                    )}
                  </>
                ) : (
                  <Plus size={14} />
                )}
              </button>
            )
          }),
        )}
      </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cx(
            'inline-flex items-center gap-1.5 text-xs transition-colors',
            picked
              ? 'font-medium text-accent-strong dark:text-accent'
              : 'text-slate-400 dark:text-slate-500',
          )}
        >
          <Hand size={13} />
          {picked ? '揀另一個座位即可交換 / 移動' : '點一位學生開始排位'}
        </span>
        <Button variant="ghost" size="sm" icon={Eraser} onClick={reset}>
          清除座位
        </Button>
      </div>
    </div>
  )
}

// ───────── 隨機分組 ─────────
function GroupMaker({ students }: { students: Student[] }) {
  const [n, setN] = useState(4)
  const [groups, setGroups] = useState<Student[][]>([])
  const make = () => setGroups(splitGroups(students, n))
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600 dark:text-slate-300">分成</span>
        <ColsStepper value={n} onChange={setN} />
        <span className="text-sm text-slate-600 dark:text-slate-300">組</span>
        <Button size="sm" icon={Shuffle} onClick={make}>
          隨機分組
        </Button>
      </div>
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-800/40">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
            <Shuffle size={20} />
          </span>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            撳「隨機分組」即時將
            <span className="mx-1 font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {students.length}
            </span>
            位學生平均分組
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs transition duration-200 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800 dark:shadow-none"
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-soft text-xs font-bold tabular-nums text-accent-strong dark:bg-accent/15 dark:text-accent">
                    {i + 1}
                  </span>
                  第 {i + 1} 組
                </span>
                <Badge tone="accent">{g.length} 人</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pl-1 pr-2.5 text-xs text-slate-600 dark:bg-slate-700/60 dark:text-slate-300"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {initials(s.name)}
                    </span>
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ───────── 隨機抽點名 ─────────
function RandomPicker({ students }: { students: Student[] }) {
  const [picked, setPicked] = useState<Student | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [noRepeat, setNoRepeat] = useState(true)
  const [rolling, setRolling] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 卸載時清理仍在跑嘅抽點名動畫 interval，避免卸載後 setState
  useEffect(() => () => {
    if (timerRef.current !== null) clearInterval(timerRef.current)
  }, [])

  const pool = noRepeat
    ? students.filter((s) => !history.includes(s.id))
    : students

  const draw = () => {
    if (pool.length === 0) {
      setHistory([])
      return
    }
    setRolling(true)
    let ticks = 0
    timerRef.current = setInterval(() => {
      const r = students[Math.floor(Math.random() * students.length)]
      setPicked(r)
      ticks++
      if (ticks > 8) {
        if (timerRef.current !== null) clearInterval(timerRef.current)
        timerRef.current = null
        const final = pool[Math.floor(Math.random() * pool.length)]
        setPicked(final)
        setHistory((h) => [...h, final.id])
        setRolling(false)
      }
    }, 70)
  }

  return (
    <div className="space-y-4">
      <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 py-9 dark:border-slate-700/60 dark:from-slate-800 dark:to-slate-800/50">
        <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-accent/5 blur-2xl dark:bg-accent/10" />
        {picked ? (
          <>
            <span
              className={cx(
                'relative flex h-20 w-20 items-center justify-center rounded-full bg-accent-soft text-2xl font-bold text-accent-strong ring-4 ring-accent/10 transition dark:bg-accent/15 dark:text-accent dark:ring-accent/20',
                rolling && 'animate-pulse',
              )}
            >
              {initials(picked.name)}
            </span>
            <div className="relative text-center">
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                {picked.name}
              </p>
              {picked.studentNo && (
                <p className="text-xs tabular-nums text-slate-400">
                  學號 {picked.studentNo}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="relative flex flex-col items-center gap-2 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
              <Sparkles size={24} />
            </span>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              撳下面個掣，隨機抽一位同學
            </p>
          </div>
        )}
        <Button className="relative" icon={Dices} onClick={draw} loading={rolling}>
          {pool.length === 0 ? '重新開始一輪' : '抽一位'}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 dark:text-slate-500">
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={noRepeat}
            onChange={(e) => setNoRepeat(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-accent focus:ring-accent/40 dark:border-slate-600 dark:bg-slate-700"
          />
          一輪內唔重複（已抽 {history.length}/{students.length}）
        </label>
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setHistory([])
              setPicked(null)
            }}
            className="font-medium text-accent hover:underline"
          >
            重設
          </button>
        )}
      </div>
    </div>
  )
}

export function seatLabel(metas: StudentMeta[], studentId: string): string {
  const seat = metaFor(studentId, metas).seat ?? -1
  return seat >= 0 ? `#${seat + 1}` : '—'
}
