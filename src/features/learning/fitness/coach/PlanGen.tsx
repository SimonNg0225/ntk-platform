import { useMemo, useRef, useState } from 'react'
import {
  Button,
  Card,
  Field,
  Badge,
  EmptyState,
  IconButton,
  SectionTitle,
  cx,
} from '../../../../ui'
import {
  Dumbbell,
  Sparkles,
  Save,
  Trash2,
  Target,
  CalendarDays,
  ListChecks,
  Flame,
  Camera,
} from 'lucide-react'
import { complete, type AIModel } from '../../../../lib/aiClient'
import { stripJsonFence, parseJsonArray } from '../../../../lib/aiJson'
import { useToast } from '../../../../context/ToastContext'
import { useCollection } from '../../../../lib/store'
import { coachPlansCol, type CoachDay, type CoachPlan } from './store'

// ============================================================
//  工具一：AI 課表生成
//  ------------------------------------------------------------
//  揀目標 + 勾器材 + 每週日數 → complete() 一次過要 JSON →
//  靚卡顯示 → 可撳「存做計劃」寫去 coachPlansCol。
// ============================================================

const GOALS = [
  { id: 'muscle', label: '增肌', desc: '肌肉量 / 圍度', icon: Dumbbell },
  { id: 'fatloss', label: '減脂', desc: '降體脂 / 線條', icon: Flame },
  { id: 'strength', label: '力量', desc: '大重量 / 爆發', icon: Target },
  { id: 'endurance', label: '體能', desc: '心肺 / 耐力', icon: ListChecks },
] as const

type GoalId = (typeof GOALS)[number]['id']

const EQUIPMENT = [
  '槓鈴',
  '啞鈴',
  '壺鈴',
  '單槓',
  '彈力帶',
  '機械',
  '徒手',
] as const

const DAY_OPTIONS = [3, 4, 5, 6] as const

interface RawExercise {
  name?: unknown
  sets?: unknown
  reps?: unknown
  note?: unknown
}
interface RawDay {
  day?: unknown
  focus?: unknown
  exercises?: unknown
}
interface RawPlan {
  days?: unknown
}

export function str(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return fallback
}

/** 將 AI 回應安全解析成 CoachDay[]（缺值有守衞，唔會擲）。回 null = 解析失敗。 */
export function parsePlan(raw: string): CoachDay[] | null {
  let obj: RawPlan
  try {
    obj = JSON.parse(stripJsonFence(raw)) as RawPlan
  } catch {
    return null
  }
  if (!obj || !Array.isArray(obj.days)) return null
  const days: CoachDay[] = []
  for (const d of obj.days as RawDay[]) {
    if (!d || typeof d !== 'object') continue
    const exRaw = Array.isArray(d.exercises) ? (d.exercises as RawExercise[]) : []
    const exercises = exRaw
      .filter((e) => e && typeof e === 'object' && str(e.name))
      .map((e) => ({
        name: str(e.name),
        sets: str(e.sets, '—'),
        reps: str(e.reps, '—'),
        note: str(e.note),
      }))
    days.push({
      day: str(d.day, `第 ${days.length + 1} 日`),
      focus: str(d.focus, '訓練'),
      exercises,
    })
  }
  return days.length > 0 ? days : null
}

export function buildPrompt(goalLabel: string, equip: string[], daysPerWeek: number): string {
  const eq = equip.length > 0 ? equip.join('、') : '徒手'
  return [
    `你係專業健身教練。請為一位訓練者設計一份「每週 ${daysPerWeek} 日」嘅訓練課表。`,
    `主要目標：${goalLabel}。`,
    `只可以用以下器材：${eq}（唔好用清單以外嘅器材）。`,
    `要求：每日有清晰部位/主題（focus）；每日 4 至 6 個動作；每個動作標明組數(sets)、次數(reps)同一句簡短提示(note，繁體中文，講安全或要點)。`,
    `動作名同所有文字都用繁體中文。`,
    '',
    '只回 JSON，唔好任何解說文字、唔好 markdown code fence。格式必須係：',
    '{"days":[{"day":"星期一","focus":"胸 + 三頭","exercises":[{"name":"槓鈴臥推","sets":"4","reps":"6-8","note":"手肘約45度，肩胛收緊"}]}]}',
  ].join('\n')
}

export default function PlanGen({ model }: { model: AIModel }) {
  const toast = useToast()
  const plans = useCollection(coachPlansCol)

  const [goal, setGoal] = useState<GoalId>('muscle')
  const [equip, setEquip] = useState<string[]>(['槓鈴', '啞鈴', '徒手'])
  const [daysPerWeek, setDaysPerWeek] = useState<number>(4)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CoachDay[] | null>(null)
  const [saved, setSaved] = useState(false)

  // 拍照識別器材（Gemini Vision）：相 → 認出清單內器材 → 自動勾選
  const fileRef = useRef<HTMLInputElement>(null)
  const [recog, setRecog] = useState(false)

  function recognizeEquipment(file: File) {
    const reader = new FileReader()
    reader.onerror = () => {
      setRecog(false)
      toast.error('讀唔到相，請再試')
    }
    reader.onload = async () => {
      const dataUrl = String(reader.result)
      const comma = dataUrl.indexOf(',')
      const semi = dataUrl.indexOf(';')
      const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : ''
      const mimeType = semi > 5 ? dataUrl.slice(5, semi) : 'image/jpeg'
      if (!b64) {
        toast.error('讀唔到相，請再試')
        return
      }
      setRecog(true)
      try {
        const raw = await complete({
          model,
          messages: [
            {
              role: 'user',
              content: `睇呢張健身房／器材相，從以下清單揀出相入面真係見到嘅器材：${EQUIPMENT.join('、')}。只回 JSON 字串陣列（只可以用清單內嘅名），唔好任何解說文字。例：["槓鈴","啞鈴"]`,
              images: [{ mimeType, data: b64 }],
            },
          ],
        })
        const list = parseJsonArray<string>(raw) || []
        const matched = EQUIPMENT.filter((e) =>
          list.some((x) => typeof x === 'string' && x.includes(e)),
        )
        if (matched.length > 0) {
          setEquip(matched)
          toast.success(`識別到：${matched.join('、')}`)
        } else {
          toast.info('相中認唔到清單內嘅器材，請手動揀')
        }
      } catch (e) {
        toast.error((e as Error).message || '識別失敗，請再試')
      } finally {
        setRecog(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const goalLabel = useMemo(
    () => GOALS.find((g) => g.id === goal)?.label ?? '增肌',
    [goal],
  )

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [plans],
  )

  function toggleEquip(item: string) {
    setEquip((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
    )
  }

  async function generate() {
    if (busy) return
    setBusy(true)
    setResult(null)
    setSaved(false)
    try {
      const raw = await complete({
        messages: [
          { role: 'user', content: buildPrompt(goalLabel, equip, daysPerWeek) },
        ],
        model,
        temperature: 0.6,
      })
      const parsed = parsePlan(raw)
      if (!parsed) {
        toast.error('AI 回覆格式唔啱，請再試一次或換 Pro 模型')
        return
      }
      setResult(parsed)
      toast.success(`生成咗 ${parsed.length} 日課表`)
    } catch (e) {
      toast.error((e as Error).message || 'AI 出錯，請再試')
    } finally {
      setBusy(false)
    }
  }

  function savePlan() {
    if (!result || result.length === 0) return
    const today = new Date()
    const dateLabel = `${today.getMonth() + 1}/${today.getDate()}`
    coachPlansCol.add({
      title: `${goalLabel}課表 · ${dateLabel}`,
      goal: goalLabel,
      daysPerWeek,
      equipment: [...equip],
      days: result,
      createdAt: new Date().toISOString(),
    })
    setSaved(true)
    toast.success('已存做計劃')
  }

  function removePlan(id: string) {
    coachPlansCol.remove(id)
    toast.info('已刪除計劃')
  }

  return (
    <div className="space-y-5">
      {/* ── 設定卡 ── */}
      <Card padded className="space-y-4">
        <Field label="訓練目標">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GOALS.map((g) => {
              const on = goal === g.id
              const I = g.icon
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setGoal(g.id)}
                  className={cx(
                    'group flex flex-col items-start gap-1.5 rounded-2xl border p-3.5 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    on
                      ? 'border-accent/40 bg-accent-soft shadow-sm dark:border-accent/40 dark:bg-accent/15'
                      : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600',
                  )}
                >
                  <span
                    className={cx(
                      'flex h-8 w-8 items-center justify-center rounded-xl transition',
                      on
                        ? 'bg-accent text-white'
                        : 'bg-slate-100 text-slate-500 group-hover:scale-105 dark:bg-slate-700/60 dark:text-slate-300',
                    )}
                  >
                    <I size={16} aria-hidden="true" />
                  </span>
                  <span
                    className={cx(
                      'text-sm font-semibold',
                      on
                        ? 'text-accent-strong dark:text-accent'
                        : 'text-slate-700 dark:text-slate-200',
                    )}
                  >
                    {g.label}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">{g.desc}</span>
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="可用器材" hint="揀你練得到嘅；AI 只會用你揀嘅器材">
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT.map((item) => {
              const on = equip.includes(item)
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleEquip(item)}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
                    on
                      ? 'bg-accent text-white shadow-sm dark:shadow-none'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                  )}
                >
                  {item}
                </button>
              )
            })}
          </div>
          <div className="mt-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) recognizeEquipment(f)
                e.target.value = ''
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={Camera}
              loading={recog}
              onClick={() => fileRef.current?.click()}
            >
              {recog ? 'AI 識別中…' : '影相 / 上載相 → AI 識別器材'}
            </Button>
          </div>
        </Field>

        <Field label="每週訓練日數">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/60">
            {DAY_OPTIONS.map((n) => {
              const on = daysPerWeek === n
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={on}
                  aria-label={`每週 ${n} 日`}
                  onClick={() => setDaysPerWeek(n)}
                  className={cx(
                    'min-w-[3rem] rounded-md px-3 py-1.5 text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                    on
                      ? 'bg-white text-slate-800 shadow-xs dark:bg-slate-700 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
                  )}
                >
                  {n} 日
                </button>
              )
            })}
          </div>
        </Field>

        <Button
          fullWidth
          icon={Sparkles}
          loading={busy}
          onClick={() => void generate()}
          disabled={equip.length === 0}
        >
          {busy ? 'AI 生成中…' : '生成課表'}
        </Button>
        {equip.length === 0 && (
          <p className="text-center text-xs text-rose-500">最少揀一樣器材</p>
        )}
      </Card>

      {/* ── 生成中：友善骨架（柔和點動）── */}
      {busy && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex gap-1" aria-hidden="true">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
            </span>
            AI 教練幫你度緊「{goalLabel}」課表…
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Array.from({ length: Math.min(daysPerWeek, 4) }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-3xl border border-slate-200/80 bg-slate-100/70 dark:border-slate-700/60 dark:bg-slate-800/60"
              />
            ))}
          </div>
        </div>
      )}

      {/* ── 生成結果 ── */}
      {!busy && result && result.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionTitle icon={CalendarDays}>本週課表</SectionTitle>
            <Button
              size="sm"
              variant={saved ? 'secondary' : 'primary'}
              icon={Save}
              onClick={savePlan}
              disabled={saved}
            >
              {saved ? '已存' : '存做計劃'}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {result.map((d, i) => (
              <DayCard key={i} day={d} />
            ))}
          </div>
        </div>
      )}

      {/* ── 已存計劃 ── */}
      <div className="space-y-3">
        <SectionTitle icon={ListChecks}>
          已存計劃{sortedPlans.length > 0 ? `（${sortedPlans.length}）` : ''}
        </SectionTitle>
        {sortedPlans.length === 0 ? (
          <EmptyState
            icon={Save}
            title="仲未有已存計劃"
            hint="生成課表後撳「存做計劃」，就會喺度列出，方便日後翻睇。"
          />
        ) : (
          <div className="space-y-2">
            {sortedPlans.map((p) => (
              <SavedPlanRow key={p.id} plan={p} onRemove={() => removePlan(p.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DayCard({ day }: { day: CoachDay }) {
  return (
    <Card padded hover className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
            <CalendarDays size={14} />
          </span>
          <span className="break-words">{day.day}</span>
        </h3>
        <Badge tone="accent">{day.focus}</Badge>
      </div>
      {day.exercises.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">（休息 / 無動作）</p>
      ) : (
        <ul className="space-y-2">
          {day.exercises.map((ex, i) => (
            <li
              key={i}
              className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 transition hover:border-slate-200 dark:border-slate-700/60 dark:bg-slate-900/30 dark:hover:border-slate-700"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 break-words text-sm font-medium text-slate-700 dark:text-slate-200">
                  {ex.name}
                </span>
                <span className="shrink-0 rounded-md bg-accent-soft px-1.5 py-0.5 tabular-nums text-xs font-semibold text-accent-strong dark:bg-accent/15 dark:text-accent">
                  {ex.sets} × {ex.reps}
                </span>
              </div>
              {ex.note && (
                <p className="mt-1 break-words text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                  {ex.note}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function SavedPlanRow({
  plan,
  onRemove,
}: {
  plan: CoachPlan
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Card clip>
      <div className="flex items-center gap-3 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent" aria-hidden="true">
          <Dumbbell size={16} />
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left focus-visible:outline-none"
        >
          <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
            {plan.title}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
            每週 {plan.daysPerWeek} 日 · {plan.equipment.join('、') || '徒手'}
          </p>
        </button>
        <IconButton label="刪除計劃" size="sm" tone="danger" onClick={onRemove}>
          <Trash2 size={14} />
        </IconButton>
      </div>
      {open && (
        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 p-3 dark:border-slate-700/60 lg:grid-cols-2">
          {plan.days.map((d, i) => (
            <DayCard key={i} day={d} />
          ))}
        </div>
      )}
    </Card>
  )
}
