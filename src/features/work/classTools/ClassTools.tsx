import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  Sparkles,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FeatureGuide,
  type FeatureGuideStep,
  Field,
  IconButton,
  PageHero,
  Select,
  SectionTitle,
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

// 每個分頁針對性教學（2–4 步）
const GUIDE: Record<Tab, { title: string; steps: FeatureGuideStep[] }> = {
  pick: {
    title: '抽人點用？',
    steps: [
      { title: '揀返要點名嘅班', desc: '喺上方揀班別，下面就會用呢班嘅學生。' },
      { title: '撳「抽一個」', desc: '隨機抽一位同學作答或示範。' },
      { title: '想唔重複就剔住', desc: '開「唔重複」抽到一個少一個，全部抽完自動重設。' },
    ],
  },
  group: {
    title: '分組點用？',
    steps: [
      { title: '揀組數', desc: '揀想分成幾多組（2–8 組），會盡量平均分。' },
      { title: '撳「分組」', desc: '即時隨機分好，每組名單即刻出。' },
      { title: '想換組就再撳', desc: '撳「重新分組」會重新洗牌再分一次。' },
    ],
  },
  timer: {
    title: '計時點用？',
    steps: [
      { title: '揀時間', desc: '撳下方預設（1/3/5/10 分）一鍵設定倒數。' },
      { title: '撳「開始」', desc: '開始倒數，中途可暫停或重設。' },
      { title: '時間到會提示', desc: '歸零會閃紅提醒，方便全班一齊睇。' },
    ],
  },
  score: {
    title: '計分點用？',
    steps: [
      { title: '揀返要計分嘅班', desc: '喺上方揀班別，下面就列出呢班同學。' },
      { title: '加減分', desc: '答啱撳 ＋、扣分撳 −，名單即時按分數排序。' },
      { title: '想由頭計就清零', desc: '撳「清零」一鍵清晒全部分數。' },
    ],
  },
}

export default function ClassTools() {
  const { t } = useTranslation()
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
        title={t('classTools.emptyClasses.title', { defaultValue: '未有班別' })}
        hint={t('classTools.emptyClasses.hint', {
          defaultValue: '先去「班別管理」開班、加學生，就可以用課堂工具。',
        })}
      />
    )
  }

  const guide = GUIDE[tab]

  return (
    <div className="space-y-5">
      <PageHero
        icon={Sparkles}
        kicker={t('classTools.kicker', { defaultValue: 'Class Tools' })}
        title={t('classTools.title', { defaultValue: '課堂工具' })}
        description={t('classTools.subtitle', {
          defaultValue: '隨機抽人、即時分組、計時、計分 —— 上堂即用。',
        })}
        actions={
          <Select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="max-w-[14rem]"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}（{allStudents.filter((s) => s.classId === c.id).length} 人）
              </option>
            ))}
          </Select>
        }
        tabs={
          <>
            {TABS.map((tb) => {
              const I = TAB_ICON[tb.id]
              const on = tab === tb.id
              return (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => setTab(tb.id)}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition',
                    on
                      ? 'bg-white font-semibold text-accent-strong'
                      : 'bg-white/15 font-medium text-white hover:bg-white/25',
                  )}
                >
                  <I size={14} />
                  {tb.label}
                </button>
              )
            })}
          </>
        }
      />

      {/* 針對當前分頁嘅教學引導（可摺疊 / 可永久收起，每分頁獨立記憶） */}
      <FeatureGuide storageKey={`classTools.${tab}`} title={guide.title} steps={guide.steps} />

      {students.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('classTools.emptyStudents.title', { defaultValue: '呢班未有學生' })}
          hint={t('classTools.emptyStudents.hint', {
            defaultValue: '去「班別管理」加學生，課堂工具先用得到。',
          })}
        />
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
  const { t } = useTranslation()
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
      <div className="flex min-h-[140px] flex-col items-center justify-center">
        {picked ? (
          <>
            {picked.studentNo && (
              <Badge tone="slate" className="mb-2">
                {picked.studentNo}
              </Badge>
            )}
            <p className="animate-scale-in text-4xl font-semibold tracking-tight text-accent-strong dark:text-accent sm:text-5xl">
              {picked.name}
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
              <Wand2 size={22} />
            </span>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {t('classTools.pick.emptyTitle', { defaultValue: '準備好隨機點名' })}
            </p>
            <p className="max-w-xs text-xs text-slate-400">
              {t('classTools.pick.emptyHint', { defaultValue: '撳下面「抽一個」即刻抽出一位同學。' })}
            </p>
          </div>
        )}
      </div>
      <Button icon={Wand2} onClick={pick} size="lg">
        {t('classTools.pick.cta', { defaultValue: '抽一個' })}
      </Button>
      <div className="flex items-center justify-center gap-3 text-xs text-slate-400 dark:text-slate-500">
        <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
          <input type="checkbox" checked={noRepeat} onChange={(e) => setNoRepeat(e.target.checked)} />
          {t('classTools.pick.noRepeat', { defaultValue: '唔重複' })}（
          <span className="tabular-nums">
            {used.size}/{students.length}
          </span>
          ）
        </label>
        <button
          type="button"
          onClick={() => {
            setUsed(new Set())
            setPicked(null)
          }}
          className="rounded-lg font-medium transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]"
        >
          {t('classTools.reset', { defaultValue: '重設' })}
        </button>
      </div>
    </Card>
  )
}

// ───────── 分組 ─────────
function Grouper({ students }: { students: Student[] }) {
  const { t } = useTranslation()
  const [count, setCount] = useState(4)
  const [groups, setGroups] = useState<Student[][] | null>(null)
  const make = () => setGroups(makeGroups(students, count))

  return (
    <Card padded className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('classTools.group.count', { defaultValue: '組數' })}>
          <Select value={String(count)} onChange={(e) => setCount(Number(e.target.value))}>
            {[2, 3, 4, 5, 6, 8].map((n) => (
              <option key={n} value={n}>
                {n} 組
              </option>
            ))}
          </Select>
        </Field>
        <Button icon={Shuffle} onClick={make}>
          {groups
            ? t('classTools.group.reshuffle', { defaultValue: '重新分組' })
            : t('classTools.group.cta', { defaultValue: '分組' })}
        </Button>
      </div>
      {groups ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 dark:border-slate-700/60 dark:bg-slate-800/40"
            >
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-accent-strong dark:text-accent">
                第 {i + 1} 組{' '}
                <span className="text-[11px] font-normal tabular-nums text-slate-400">
                  ({g.length})
                </span>
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
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200/80 bg-slate-50/60 px-6 py-10 text-center dark:border-slate-700/60 dark:bg-slate-800/40">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
            <Shuffle size={22} />
          </span>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {t('classTools.group.emptyTitle', { defaultValue: '揀好組數，即刻分組' })}
          </p>
          <p className="max-w-xs text-xs text-slate-400">
            {t('classTools.group.emptyHint', {
              defaultValue: '上面揀組數再撳「分組」，會把全班隨機平均分好。',
            })}
          </p>
        </div>
      )}
    </Card>
  )
}

// ───────── 計時 ─────────
const PRESETS = [60, 180, 300, 600]
function ClassTimer() {
  const { t } = useTranslation()
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
          'text-6xl font-semibold tabular-nums slashed-zero tracking-tight sm:text-7xl',
          done ? 'animate-pulse text-rose-500' : 'text-slate-800 dark:text-slate-100',
        )}
      >
        {fmtClock(left)}
      </p>
      {done && (
        <p className="text-sm font-medium text-rose-500">
          {t('classTools.timer.done', { defaultValue: '時間到！' })}
        </p>
      )}
      <div className="flex items-center justify-center gap-2">
        <Button
          icon={running ? Pause : Play}
          onClick={() => setRunning((r) => !r)}
          disabled={left === 0}
        >
          {running
            ? t('classTools.timer.pause', { defaultValue: '暫停' })
            : t('classTools.timer.start', { defaultValue: '開始' })}
        </Button>
        <Button
          variant="secondary"
          icon={RotateCcw}
          onClick={() => {
            setRunning(false)
            setLeft(300)
          }}
        >
          {t('classTools.reset', { defaultValue: '重設' })}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setRunning(false)
              setLeft(p)
            }}
            className={cx(
              'rounded-full px-3 py-1 text-xs font-medium tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 active:scale-[0.98]',
              left === p
                ? 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent'
                : 'bg-slate-100 text-slate-600 hover:bg-accent-soft hover:text-accent-strong dark:bg-slate-700/60 dark:text-slate-300',
            )}
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
  const { t } = useTranslation()
  const [pts, setPts] = useState<Record<string, number>>({})
  const bump = (id: string, d: number) => setPts((p) => ({ ...p, [id]: (p[id] ?? 0) + d }))
  const sorted = useMemo(
    () => shuffle(students).sort((a, b) => (pts[b.id] ?? 0) - (pts[a.id] ?? 0)),
    [students, pts],
  )

  return (
    <section>
      <SectionTitle
        icon={Trophy}
        description={t('classTools.score.desc', { defaultValue: '加減分即時排序' })}
        right={
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setPts({})}>
            {t('classTools.score.clear', { defaultValue: '清零' })}
          </Button>
        }
      >
        {t('classTools.score.title', { defaultValue: '即時計分' })}
      </SectionTitle>
      <div className="space-y-1.5">
        {sorted.map((s, i) => {
          const score = pts[s.id] ?? 0
          return (
            <div
              key={s.id}
              className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 dark:border-slate-700/60 dark:bg-slate-800"
            >
              <span className="w-5 text-center text-xs font-semibold tabular-nums text-slate-400 dark:text-slate-500">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                {s.name}
              </span>
              <IconButton label={t('classTools.score.minus', { defaultValue: '減分' })} size="sm" onClick={() => bump(s.id, -1)}>
                <Minus size={14} />
              </IconButton>
              <span
                className={cx(
                  'w-8 text-center text-base font-semibold tabular-nums slashed-zero',
                  score > 0
                    ? 'text-accent-strong dark:text-accent'
                    : score < 0
                      ? 'text-rose-500'
                      : 'text-slate-400 dark:text-slate-500',
                )}
              >
                {score}
              </span>
              <IconButton label={t('classTools.score.plus', { defaultValue: '加分' })} size="sm" onClick={() => bump(s.id, 1)}>
                <Plus size={14} />
              </IconButton>
            </div>
          )
        })}
      </div>
    </section>
  )
}
