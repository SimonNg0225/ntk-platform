import { useMemo, useState } from 'react'
import {
  Bot,
  Dumbbell,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  PersonStanding,
  Layers,
  Library,
  ListFilter,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Modal,
  SegmentedControl,
  cx,
} from '../../../../ui'
import { createCollection, useCollection, type Entity } from '../../../../lib/store'
import { useToast } from '../../../../context/ToastContext'
import { useAuth } from '../../../../context/AuthContext'
import { complete, isAIConfigured } from '../../../../lib/aiClient'
import { stripJsonFence } from '../../../../lib/aiJson'
import { EXERCISES, type Exercise, type ExerciseCategory } from './data'
import { MuscleMap } from './MuscleMap'
import {
  countByCategory,
  equipmentList,
  filterExercises,
  muscleIndex,
} from './util'

// ───────── 收藏 collection（登入後雲端同步）─────────
interface FavRow extends Entity {
  exerciseId: string
}
const favCol = createCollection<FavRow>('fitness_library_favs_v1')

// ───────── category chips（含「全部」）─────────
const CATEGORIES: ExerciseCategory[] = ['胸', '背', '腿', '肩', '手臂', '核心', '全身']
type CatFilter = ExerciseCategory | '全部'
const CAT_OPTIONS: { id: CatFilter; label: string }[] = [
  { id: '全部', label: '全部' },
  ...CATEGORIES.map((c) => ({ id: c as CatFilter, label: c })),
]

const TONE_BY_CAT: Record<ExerciseCategory, 'accent' | 'green' | 'amber' | 'rose' | 'blue'> = {
  胸: 'rose',
  背: 'blue',
  腿: 'green',
  肩: 'amber',
  手臂: 'accent',
  核心: 'amber',
  全身: 'accent',
}

// 動作卡 icon chip 配色（依分類；寫足整串畀 Tailwind 掃到）
const CAT_CHIP: Record<ExerciseCategory, string> = {
  胸: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  背: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  腿: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  肩: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  手臂: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
  核心: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  全身: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
}

// 動作卡左側色脊（依分類；寫足整串畀 Tailwind 掃到）
const CAT_SPINE: Record<ExerciseCategory, string> = {
  胸: 'bg-rose-400 dark:bg-rose-500/70',
  背: 'bg-blue-400 dark:bg-blue-500/70',
  腿: 'bg-emerald-400 dark:bg-emerald-500/70',
  肩: 'bg-amber-400 dark:bg-amber-500/70',
  手臂: 'bg-accent dark:bg-accent',
  核心: 'bg-amber-400 dark:bg-amber-500/70',
  全身: 'bg-accent dark:bg-accent',
}

// ───────── 概覽小磚（暖色 bento）─────────
type StatTone = 'accent' | 'sky' | 'violet'
const STAT_TONE: Record<StatTone, string> = {
  accent: 'bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
}
function MiniStat({
  label,
  value,
  unit,
  icon: Icon,
  tone,
  highlight,
  channel,
}: {
  label: string
  value: number | string
  unit?: string
  icon: LucideIcon
  tone: StatTone
  highlight?: boolean
  /** 記分牌頻道號（純裝飾戳印） */
  channel?: number
}) {
  return (
    <div
      className={cx(
        'group relative flex flex-col justify-between overflow-hidden rounded-3xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md',
        highlight
          ? 'border-accent/30 bg-accent-soft dark:border-accent/40 dark:bg-accent/15'
          : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-700/60 dark:bg-slate-800 dark:hover:border-slate-600',
      )}
    >
      {/* 角落頻道戳印（記分牌讀數感，純裝飾） */}
      {channel != null && (
        <span
          aria-hidden="true"
          className={cx(
            'pointer-events-none absolute -right-1 top-1 select-none font-serif text-4xl font-black leading-none tabular-nums slashed-zero',
            highlight ? 'text-accent/15 dark:text-accent/20' : 'text-slate-900/[0.04] dark:text-white/[0.05]',
          )}
        >
          {channel}
        </span>
      )}
      <div className="relative flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
          {label}
        </span>
        <span
          className={cx(
            'flex h-8 w-8 items-center justify-center rounded-xl transition group-hover:scale-105',
            highlight ? 'bg-accent text-white' : STAT_TONE[tone],
          )}
        >
          <Icon size={16} />
        </span>
      </div>
      <p className="relative mt-3 flex items-baseline gap-1">
        <span
          className={cx(
            'font-serif text-3xl font-black leading-none tabular-nums slashed-zero',
            highlight ? 'text-accent-strong dark:text-accent' : 'text-slate-800 dark:text-slate-100',
          )}
        >
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
      </p>
    </div>
  )
}

export default function LibraryView() {
  const favs = useCollection(favCol)
  const toast = useToast()

  const [q, setQ] = useState('')
  const [category, setCategory] = useState<CatFilter>('全部')
  const [equip, setEquip] = useState<string>('全部')
  const [openId, setOpenId] = useState<string | null>(null)

  const favSet = useMemo(() => new Set(favs.map((f) => f.exerciseId)), [favs])
  const catCounts = useMemo(() => countByCategory(EXERCISES), [])
  const equipOptions = useMemo(() => equipmentList(EXERCISES), [])
  const muscleCount = useMemo(() => muscleIndex(EXERCISES).length, [])

  const filtered = useMemo(
    () => filterExercises(EXERCISES, { q, category, equipment: equip }),
    [q, category, equip],
  )

  const open = openId ? EXERCISES.find((e) => e.id === openId) ?? null : null

  const toggleFav = (exerciseId: string) => {
    const existing = favs.find((f) => f.exerciseId === exerciseId)
    if (existing) {
      favCol.remove(existing.id)
    } else {
      favCol.add({ exerciseId })
    }
  }

  return (
    <div className="space-y-5">
      {/* ── 標題列（呼應記分牌：kicker + 大字 + LIVE 計數）── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            <Library size={13} /> 動作資料庫 · INDEX
          </p>
          <h2 className="mt-1 font-serif text-2xl font-black leading-none tracking-tight text-slate-800 dark:text-slate-100">
            招式名冊
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            按部位揀招、睇主／協同肌群同姿勢重點，收藏入你嘅出場名單。
          </p>
        </div>
        {/* 收錄計數面板（似記分牌讀數） */}
        <div className="shrink-0 self-start rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2 dark:border-slate-700/60 dark:bg-slate-800 sm:self-auto">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
            全庫收錄
          </p>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="font-serif text-2xl font-black leading-none tabular-nums slashed-zero text-slate-800 dark:text-slate-100">
              {EXERCISES.length}
            </span>
            <span className="text-xs font-medium text-slate-400">招</span>
          </div>
        </div>
      </div>

      {/* 概覽（記分牌讀數 bento）*/}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="動作總數" value={EXERCISES.length} icon={Dumbbell} tone="accent" channel={1} />
        <MiniStat label="分類" value={CATEGORIES.length} unit="類" icon={Layers} tone="sky" channel={2} />
        <MiniStat label="涵蓋肌群" value={muscleCount} icon={PersonStanding} tone="violet" channel={3} />
        <MiniStat
          label="我的收藏"
          value={favs.length}
          icon={Star}
          tone="accent"
          highlight={favs.length > 0}
          channel={4}
        />
      </div>

      {/* 篩選台（控制面板感）*/}
      <div className="space-y-3 rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
          <ListFilter size={13} /> 篩選台 · FILTER
        </p>

        <Input
          icon={Search}
          placeholder="搜尋動作名（中／英）…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="搜尋動作"
        />

        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <SegmentedControl
            options={CAT_OPTIONS.map((o) => ({
              ...o,
              label:
                o.id === '全部'
                  ? '全部'
                  : `${o.label}·${catCounts[o.id as ExerciseCategory]}`,
            }))}
            value={category}
            onChange={setCategory}
            size="sm"
          />
        </div>

        {/* 器材 chips */}
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300 dark:text-slate-600">
            器材
          </p>
          <div className="flex flex-wrap gap-2">
            <EquipChip
              label="全部器材"
              active={equip === '全部'}
              onClick={() => setEquip('全部')}
            />
            {equipOptions.map((eq) => (
              <EquipChip
                key={eq}
                label={eq}
                active={equip === eq}
                onClick={() => setEquip((prev) => (prev === eq ? '全部' : eq))}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 結果 grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="搵唔到相符動作"
          hint="試吓清空搜尋、或者揀返「全部」分類同器材。"
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setQ('')
                setCategory('全部')
                setEquip('全部')
              }}
            >
              重設篩選
            </Button>
          }
        />
      ) : (
        <>
          <p
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
            aria-live="polite"
          >
            <span className="font-serif text-sm font-bold tabular-nums slashed-zero text-slate-700 dark:text-slate-200">
              {filtered.length}
            </span>
            <span className="text-slate-400 dark:text-slate-500">/ {EXERCISES.length} 個動作上場</span>
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((ex) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                fav={favSet.has(ex.id)}
                onToggleFav={() => toggleFav(ex.id)}
                onOpen={() => setOpenId(ex.id)}
              />
            ))}
          </div>
        </>
      )}

      {open && (
        <DetailModal
          exercise={open}
          fav={favSet.has(open.id)}
          onToggleFav={() => toggleFav(open.id)}
          onClose={() => setOpenId(null)}
          toastError={toast.error}
        />
      )}
    </div>
  )
}

// ───────── 器材 chip ─────────
function EquipChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
        active
          ? 'bg-accent text-white shadow-sm dark:shadow-none'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
      )}
    >
      {label}
    </button>
  )
}

// ───────── 動作卡片 ─────────
function ExerciseCard({
  exercise,
  fav,
  onToggleFav,
  onOpen,
}: {
  exercise: Exercise
  fav: boolean
  onToggleFav: () => void
  onOpen: () => void
}) {
  return (
    <Card hover clip className="relative flex h-full flex-col p-4 pl-5">
      {/* 分類色脊（lineup 卡識別） */}
      <span
        aria-hidden="true"
        className={cx('absolute inset-y-0 left-0 w-1', CAT_SPINE[exercise.category])}
      />
      {/* 部位大字戳印（記分牌讀數感，純裝飾） */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-3 right-1 select-none font-serif text-6xl font-black leading-none text-slate-900/[0.03] dark:text-white/[0.04]"
      >
        {exercise.category}
      </span>

      <div className="relative flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2"
          aria-label={`查看 ${exercise.name} 詳情`}
        >
          <span
            className={cx(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              CAT_CHIP[exercise.category],
            )}
          >
            <Dumbbell size={16} />
          </span>
          <h3 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {exercise.name}
          </h3>
        </button>
        <IconButton
          label={fav ? '取消收藏' : '加入收藏'}
          size="sm"
          active={fav}
          onClick={onToggleFav}
        >
          <Star size={16} className={fav ? 'fill-current' : undefined} />
        </IconButton>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="relative mt-3 flex flex-1 flex-col items-start gap-2 text-left focus-visible:outline-none"
        tabIndex={-1}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={TONE_BY_CAT[exercise.category]}>{exercise.category}</Badge>
          {exercise.equipment.slice(0, 2).map((eq) => (
            <Badge key={eq} tone="slate">
              {eq}
            </Badge>
          ))}
          {exercise.equipment.length > 2 && (
            <Badge tone="slate">+{exercise.equipment.length - 2}</Badge>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <span className="text-slate-400 dark:text-slate-500">主肌群：</span>
          {exercise.primaryMuscles.join('、')}
        </p>
      </button>
    </Card>
  )
}

// ───────── 詳情 Modal ─────────
function DetailModal({
  exercise,
  fav,
  onToggleFav,
  onClose,
  toastError,
}: {
  exercise: Exercise
  fav: boolean
  onToggleFav: () => void
  onClose: () => void
  toastError: (m: string) => void
}) {
  const { user } = useAuth()
  const [aiBusy, setAiBusy] = useState(false)
  const [aiText, setAiText] = useState<string | null>(null)

  const canAI = isAIConfigured && !!user

  const explain = async () => {
    if (aiBusy) return
    setAiBusy(true)
    setAiText(null)
    try {
      const raw = await complete({
        model: 'gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content:
              `你係專業健身教練。用繁體中文（廣東話書面語亦可）、3-4 句簡潔解釋「${exercise.name}」` +
              `呢個動作：點解有效、最關鍵嘅發力或姿勢提示、同一個新手最易犯嘅錯。` +
              `主練：${exercise.primaryMuscles.join('、')}；器材：${exercise.equipment.join('、')}。` +
              `只回純文字解釋，唔好標題、唔好 markdown、唔好任何前後綴。`,
          },
        ],
      })
      const text = stripJsonFence(raw).trim()
      if (!text) {
        toastError('AI 暫時無回應，請再試一次。')
        return
      }
      setAiText(text)
    } catch (e) {
      toastError((e as Error).message || 'AI 解釋失敗，請再試一次。')
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} size="lg">
      <div className="space-y-5">
        {/* ── 招式名牌（深色記分牌 masthead）── */}
        <header className="relative -mx-5 -mt-5 overflow-hidden rounded-t-2xl bg-slate-950 px-5 pb-4 pt-5 text-white sm:-mx-6 sm:-mt-6 sm:px-6">
          {/* accent 發光 + LED 點陣（呼應 hero） */}
          <div className="hero-gradient pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full opacity-40 blur-3xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'radial-gradient(currentColor 1px, transparent 1.4px)',
              backgroundSize: '14px 14px',
              color: 'var(--accent-grad-from)',
            }}
            aria-hidden="true"
          />
          {/* 部位大字戳印（純裝飾） */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-5 right-2 select-none font-serif text-7xl font-black leading-none text-white/[0.06]"
          >
            {exercise.category}
          </span>

          <div className="relative flex items-start justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              招式名牌 · MOVE
            </p>
            <button
              onClick={onClose}
              className="-mr-1 -mt-0.5 rounded-lg p-1 text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              aria-label="關閉"
            >
              <X size={18} />
            </button>
          </div>

          <div className="relative mt-2 flex items-start gap-3">
            <span
              className={cx(
                'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                CAT_CHIP[exercise.category],
              )}
            >
              <Dumbbell size={18} />
            </span>
            <h3 className="min-w-0 font-serif text-xl font-black leading-tight tracking-tight sm:text-2xl">
              {exercise.name}
            </h3>
          </div>

          <div className="relative mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={TONE_BY_CAT[exercise.category]}>{exercise.category}</Badge>
            {exercise.equipment.map((eq) => (
              <span
                key={eq}
                className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80 ring-1 ring-inset ring-white/10"
              >
                <Dumbbell size={11} />
                {eq}
              </span>
            ))}
            <div className="ml-auto">
              <button
                type="button"
                onClick={onToggleFav}
                aria-pressed={fav}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                  fav
                    ? 'bg-white text-slate-900'
                    : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white',
                )}
              >
                <Star size={14} className={fav ? 'fill-current text-accent-strong' : undefined} />
                {fav ? '已收藏' : '收藏'}
              </button>
            </div>
          </div>
        </header>

        {/* 2D 肌群圖 */}
        <section>
          <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
            <PersonStanding size={14} aria-hidden="true" /> 靶位圖 · TARGET
          </h4>
          <MuscleMap
            primaryMuscles={exercise.primaryMuscles}
            secondaryMuscles={exercise.secondaryMuscles}
            className="rounded-xl border border-slate-200 bg-slate-50/50 py-3 dark:border-slate-700 dark:bg-slate-800/40"
          />
        </section>

        {/* 肌群 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MuscleBlock
            label="主要肌群"
            muscles={exercise.primaryMuscles}
            tone="accent"
          />
          <MuscleBlock
            label="協同肌群"
            muscles={exercise.secondaryMuscles}
            tone="slate"
          />
        </div>

        {/* form cues（出招步序）*/}
        <section>
          <h4 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
            <Target size={14} aria-hidden="true" /> 出招步序 · FORM
          </h4>
          <ol className="space-y-2.5">
            {exercise.formCues.map((cue, i) => (
              <li
                key={i}
                className="relative flex gap-3 text-sm text-slate-700 dark:text-slate-200"
              >
                {/* 步序連接線（最後一步唔畫）*/}
                {i < exercise.formCues.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[0.6875rem] top-7 h-[calc(100%-0.5rem)] w-px bg-slate-200 dark:bg-slate-700"
                  />
                )}
                <span className="z-10 flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-lg bg-accent-soft font-serif text-xs font-black tabular-nums text-accent-strong dark:bg-accent/15 dark:text-accent">
                  {i + 1}
                </span>
                <span className="pt-0.5">{cue}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* safety */}
        <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
          <h4 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
            <ShieldAlert size={14} aria-hidden="true" /> 安全提示 · SAFE
          </h4>
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {exercise.safety}
          </p>
        </section>

        {/* AI 解釋（gate：未設定就靜態提示，唔 call） */}
        <section
          className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/50"
          aria-live="polite"
          aria-busy={aiBusy}
        >
          <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
            <Sparkles size={14} aria-hidden="true" /> AI 教練解說 · COACH
          </h4>
          {!isAIConfigured ? (
            <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Bot size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              需要先設定雲端 AI（見 docs/SETUP.md）。
            </p>
          ) : aiText ? (
            <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
              {aiText}
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                上面已有完整重點同安全提示；想要多一段口語化講解可以叫 AI。
              </p>
              <Button
                variant="secondary"
                size="sm"
                icon={Sparkles}
                loading={aiBusy}
                onClick={explain}
              >
                {canAI ? 'AI 解釋呢個動作' : '登入後可用 AI 解釋'}
              </Button>
              {!user && isAIConfigured && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  喺左下角登入後就用得（資料只存你裝置，登入後同步到你自己 Supabase）。
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </Modal>
  )
}

function MuscleBlock({
  label,
  muscles,
  tone,
}: {
  label: string
  muscles: string[]
  tone: 'accent' | 'slate'
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
        <span
          aria-hidden="true"
          className={cx(
            'inline-block h-2 w-2 rounded-full',
            tone === 'accent' ? 'bg-accent' : 'bg-slate-300 dark:bg-slate-600',
          )}
        />
        {label}
      </p>
      {muscles.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">—</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {muscles.map((m) => (
            <Badge key={m} tone={tone}>
              {m}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
