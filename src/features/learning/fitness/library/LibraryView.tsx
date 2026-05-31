import { useMemo, useState } from 'react'
import {
  Bot,
  Dumbbell,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
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
  StatCard,
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
      {/* 概覽 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="動作總數" value={EXERCISES.length} icon={Dumbbell} />
        <StatCard label="分類" value={CATEGORIES.length} unit="類" icon={Target} />
        <StatCard label="涵蓋肌群" value={muscleCount} icon="💪" />
        <StatCard
          label="我的收藏"
          value={favs.length}
          icon={Star}
          highlight={favs.length > 0}
        />
      </div>

      {/* 搜尋 + 分類 */}
      <div className="space-y-3">
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
            className="text-xs text-slate-500 dark:text-slate-400"
            aria-live="polite"
          >
            顯示 {filtered.length} / {EXERCISES.length} 個動作
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
    <Card hover className="flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 rounded"
          aria-label={`查看 ${exercise.name} 詳情`}
        >
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
        className="mt-2 flex flex-1 flex-col items-start gap-2 text-left focus-visible:outline-none"
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
    <Modal open onClose={onClose} title={exercise.name} size="lg">
      <div className="space-y-5">
        {/* 標籤 + 收藏 */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={TONE_BY_CAT[exercise.category]}>{exercise.category}</Badge>
          {exercise.equipment.map((eq) => (
            <Badge key={eq} tone="slate" icon={Dumbbell}>
              {eq}
            </Badge>
          ))}
          <div className="ml-auto">
            <Button
              variant={fav ? 'secondary' : 'ghost'}
              size="sm"
              icon={Star}
              onClick={onToggleFav}
            >
              {fav ? '已收藏' : '收藏'}
            </Button>
          </div>
        </div>

        {/* 2D 肌群圖 */}
        <MuscleMap
          primaryMuscles={exercise.primaryMuscles}
          secondaryMuscles={exercise.secondaryMuscles}
          className="rounded-xl border border-slate-200 bg-slate-50/50 py-3 dark:border-slate-700 dark:bg-slate-800/40"
        />

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

        {/* form cues */}
        <section>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Target size={14} aria-hidden="true" /> 動作重點
          </h4>
          <ul className="space-y-1.5">
            {exercise.formCues.map((cue, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm text-slate-700 dark:text-slate-200"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-strong dark:bg-accent/15 dark:text-accent">
                  {i + 1}
                </span>
                <span>{cue}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* safety */}
        <section className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
          <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <ShieldAlert size={14} aria-hidden="true" /> 安全提示
          </h4>
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {exercise.safety}
          </p>
        </section>

        {/* AI 解釋（gate：未設定就靜態提示，唔 call） */}
        <section
          className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/50"
          aria-live="polite"
          aria-busy={aiBusy}
        >
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Sparkles size={14} aria-hidden="true" /> AI 教練解釋
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
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
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
