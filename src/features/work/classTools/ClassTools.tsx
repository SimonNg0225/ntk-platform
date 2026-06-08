import { useEffect, useMemo, useState } from 'react'
import {
  Wand2,
  Shuffle,
  TimerReset,
  Trophy,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Minus,
  Users,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Select,
  Tabs,
  cx,
} from '../../../ui'
import { useToast } from '../../../context/ToastContext'
import { useCollection } from '../../../lib/store'
import { classesCol, studentsCol } from '../../../data/collections'
import type { Student } from '../../../data/types'
import { makeGroups, fmtClock, shuffle } from './util'

type Tab = 'pick' | 'group' | 'timer' | 'score'
const TABS: { id: Tab; label: string }[] = [
  { id: 'pick', label: '抽人' },
  { id: 'group', label: '分組' },
  { id: 'timer', label: '計時' },
  { id: 'score', label: '計分' },
]
const TAB_ICON = { pick: Wand2, group: Shuffle, timer: TimerReset, score: Trophy }

export default function ClassTools() {
  const classes = useCollection(classesCol)
  const allStudents = useCollection(studentsCol)
  const [classId, setClassId] = useState<string>(() => classes[0]?.id ?? '')
  const klass = classes.find((c) => c.id === classId) ?? classes[0]
  const students = useMemo(
    () =>
      allStudents
        .filter((s) => s.classId === klass?.id)
        .sort((a, b) =>
          (a.studentNo ?? '').localeCompare(b.studentNo ?? '') || a.name.localeCompare(b.name),
        ),
    [allStudents, klass?.id],
  )

  const [tab, setTab] = useState<Tab>('pick')

  if (classes.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="未有班別"
        hint="先去「班別管理」開班、加學生，就可以用課堂工具。"
      />
    )
  }

  return (
    <div className="space-y-5">
      <header className="min-w-0">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.3em] text-accent/70">
          <Wand2 size={13} className="shrink-0" />
          課堂 · Class Tools
        </p>
        <h1 className="mt-1 font-serif text-[26px] font-semibold leading-none tracking-tight text-slate-800 dark:text-slate-100 sm:text-[30px]">
          課堂工具
        </h1>
        <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
          隨機抽人、即時分組、計時、計分 —— 上堂即用。
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={classId} onChange={(e) => setClassId(e.target.value)} className="max-w-[14rem]">
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}（{allStudents.filter((s) => s.classId === c.id).length} 人）
            </option>
          ))}
        </Select>
        <div className="min-w-[16rem] flex-1">
          <Tabs tabs={TABS} active={tab} onChange={setTab} icons={TAB_ICON} />
        </div>
      </div>

      {students.length === 0 ? (
        <EmptyState icon={Users} title="呢班未有學生" hint="去「班別管理」加學生先。" />
      ) : (
        <>
          {tab === 'pick' && <Picker key={klass?.id} students={students} />}
          {tab === 'group' && <Grouper key={klass?.id} students={students} />}
          {tab === 'timer' && <ClassTimer />}
          {tab === 'score' && <Scoreboard key={klass?.id} students={students} />}
        </>
      )}
    </div>
  )
}

// ───────── 抽人 ─────────
function Picker({ students }: { students: Student[] }) {
  const toast = useToast()
  const [picked, setPicked] = useState<Student | null>(null)
  const [used, setUsed] = useState<Set<string>>(new Set())
  const [noRepeat, setNoRepeat] = useState(true)

  function pick() {
    const pool = noRepeat ? students.filter((s) => !used.has(s.id)) : students
    if (pool.length === 0) {
      toast.info('全部抽過晒，已重設')
      setUsed(new Set())
      return
    }
    const chosen = pool[Math.floor(Math.random() * pool.length)]
    setPicked(chosen)
    if (noRepeat) setUsed((u) => new Set(u).add(chosen.id))
  }

  return (
    <Card padded className="space-y-4 text-center">
      <div className="flex min-h-[120px] flex-col items-center justify-center">
        {picked ? (
          <>
            {picked.studentNo && (
              <Badge tone="slate" className="mb-2">
                {picked.studentNo}
              </Badge>
            )}
            <p className="animate-scale-in text-4xl font-bold tracking-tight text-accent-strong dark:text-accent sm:text-5xl">
              {picked.name}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-400">撳「抽一個」隨機點名</p>
        )}
      </div>
      <Button icon={Wand2} onClick={pick} size="lg">
        抽一個
      </Button>
      <div className="flex items-center justify-center gap-3 text-xs text-slate-400">
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={noRepeat} onChange={(e) => setNoRepeat(e.target.checked)} />
          唔重複（{used.size}/{students.length}）
        </label>
        <button type="button" onClick={() => { setUsed(new Set()); setPicked(null) }} className="hover:text-accent">
          重設
        </button>
      </div>
    </Card>
  )
}

// ───────── 分組 ─────────
function Grouper({ students }: { students: Student[] }) {
  const [count, setCount] = useState(4)
  const [groups, setGroups] = useState<Student[][] | null>(null)
  const make = () => setGroups(makeGroups(students, count))

  return (
    <Card padded className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="組數">
          <Select value={String(count)} onChange={(e) => setCount(Number(e.target.value))}>
            {[2, 3, 4, 5, 6, 8].map((n) => (
              <option key={n} value={n}>
                {n} 組
              </option>
            ))}
          </Select>
        </Field>
        <Button icon={Shuffle} onClick={make}>
          {groups ? '重新分組' : '分組'}
        </Button>
      </div>
      {groups && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g, i) => (
            <div
              key={i}
              className="rounded-xl border border-black/[0.06] bg-slate-50/60 p-3 dark:border-white/[0.08] dark:bg-slate-800/40"
            >
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-accent-strong dark:text-accent">
                第 {i + 1} 組 <span className="text-[11px] font-normal text-slate-400">({g.length})</span>
              </p>
              <ul className="space-y-0.5">
                {g.map((s) => (
                  <li key={s.id} className="text-[13px] text-slate-700 dark:text-slate-200">
                    {s.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ───────── 計時 ─────────
const PRESETS = [60, 180, 300, 600]
function ClassTimer() {
  const [left, setLeft] = useState(300)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setLeft((s) => (s <= 1 ? 0 : s - 1)), 1000)
    return () => clearInterval(id)
  }, [running])
  useEffect(() => {
    if (left === 0 && running) setRunning(false)
  }, [left, running])

  const done = left === 0

  return (
    <Card padded className="space-y-4 text-center">
      <p
        className={cx(
          'font-serif text-6xl font-bold tabular-nums tracking-tight sm:text-7xl',
          done ? 'animate-pulse text-rose-500' : 'text-slate-800 dark:text-slate-100',
        )}
      >
        {fmtClock(left)}
      </p>
      {done && <p className="text-sm font-medium text-rose-500">時間到！</p>}
      <div className="flex items-center justify-center gap-2">
        <Button
          icon={running ? Pause : Play}
          onClick={() => setRunning((r) => !r)}
          disabled={left === 0}
        >
          {running ? '暫停' : '開始'}
        </Button>
        <Button variant="secondary" icon={RotateCcw} onClick={() => { setRunning(false); setLeft(300) }}>
          重設
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => { setRunning(false); setLeft(p) }}
            className="rounded-full bg-black/[0.05] px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-accent-soft hover:text-accent-strong dark:bg-white/[0.07] dark:text-slate-300"
          >
            {p / 60} 分
          </button>
        ))}
      </div>
    </Card>
  )
}

// ───────── 計分 ─────────
function Scoreboard({ students }: { students: Student[] }) {
  const [pts, setPts] = useState<Record<string, number>>({})
  const bump = (id: string, d: number) => setPts((p) => ({ ...p, [id]: (p[id] ?? 0) + d }))
  const sorted = useMemo(
    () => shuffle(students).sort((a, b) => (pts[b.id] ?? 0) - (pts[a.id] ?? 0)),
    [students, pts],
  )

  return (
    <Card padded className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-400">即時計分（按分數排序）</span>
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setPts({})}>
          清零
        </Button>
      </div>
      <div className="space-y-1.5">
        {sorted.map((s, i) => {
          const score = pts[s.id] ?? 0
          return (
            <div
              key={s.id}
              className="flex items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3 py-2 dark:border-white/[0.08] dark:bg-slate-800"
            >
              <span className="w-5 text-center text-xs font-semibold tabular-nums text-slate-400">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                {s.name}
              </span>
              <IconButton label="減分" size="sm" onClick={() => bump(s.id, -1)}>
                <Minus size={14} />
              </IconButton>
              <span
                className={cx(
                  'w-8 text-center text-base font-bold tabular-nums',
                  score > 0 ? 'text-accent-strong dark:text-accent' : score < 0 ? 'text-rose-500' : 'text-slate-400',
                )}
              >
                {score}
              </span>
              <IconButton label="加分" size="sm" onClick={() => bump(s.id, 1)}>
                <Plus size={14} />
              </IconButton>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
