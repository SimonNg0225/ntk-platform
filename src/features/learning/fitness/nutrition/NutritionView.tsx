import { useMemo, useState } from 'react'
import {
  Apple,
  Sparkles,
  Plus,
  Trash2,
  Bot,
  Wand2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Beef,
  Droplet,
  Wheat,
  X,
  Check,
  Target,
  Utensils,
  BarChart3,
  Settings2,
  RotateCcw,
  CalendarDays,
  Coffee,
  Sun,
  Moon,
  Cookie,
  History,
} from 'lucide-react'
import {
  Card,
  Button,
  Input,
  Field,
  StatCard,
  Modal,
  EmptyState,
  Badge,
  IconButton,
  Textarea,
  Tooltip,
  Pills,
  cx,
} from '../../../../ui'
import {
  todayKey,
  fromKey,
  addDaysKey,
  daysBetween,
  WEEKDAY_LABELS,
  FIT_TONE,
} from '../common'
import {
  complete,
  isAIConfigured,
  type AIMessage,
} from '../../../../lib/aiClient'
import { stripJsonFence } from '../../../../lib/aiJson'
import { useCollection, uid } from '../../../../lib/store'
import { useToast } from '../../../../context/ToastContext'
import { useAuth } from '../../../../context/AuthContext'
import {
  foodCol,
  goalsCol,
  readGoals,
  saveGoals,
  DEFAULT_GOALS,
} from './store'
import {
  dayTotals,
  macroPct,
  remaining,
  weeklyCalories,
  normalizeItem,
  macroKcal,
  mealGroups,
  frequentFoods,
} from './util'
import type {
  FoodEntry,
  FrequentFood,
  MealSlot,
  ParsedItem,
  RawFoodItem,
} from './types'

// ============================================================
//  AI 飲食營養（自然語言 → macros）
//  ------------------------------------------------------------
//  ① 主輸入：用日常口語講今餐食咗咩 → AI 解析成逐項 macros
//     （complete() 要求只回 JSON {items:[…]}；stripJsonFence
//      + JSON.parse，try/catch 失敗 toast）→ 逐項可微調再落地。
//  ② 手動新增 fallback：直接填 label + 四個數（唔使 AI）。
//  ③ 常食快速再記：由歷史去重統計最常用，一撳即加返今日（唔使再 AI）。
//  ④ 每餐分段：揀餐段（早/午/晚/小食）落地；日誌按餐分組 + 各餐小計。
//  ⑤ 當日總計 vs 目標：卡路里進度環 + 三大營養素進度條 + 剩餘。
//  ⑥ 飲食日誌（當日按餐分組可刪）+ 近 7 日卡路里柱狀。
//  ⑦ 目標可改（cal / P / F / C，可重設預設）。
//  AI gate：!isAIConfigured 顯示靜態提示，但手動 / 常食照用。
//  全部計算抽去 util.ts（已測）；日期用 ../common 本地 key。
//  舊資料無 meal → 歸入「其他」（向後相容）。
// ============================================================

interface AIResult {
  items?: unknown
}

/** 由 AI 回應安全抽取 {items:[…]}（物件，唔係陣列，所以自家 parse）。 */
function parseItemsObject(raw: string): RawFoodItem[] | null {
  const cleaned = stripJsonFence(raw)
  const tryParse = (text: string): RawFoodItem[] | null => {
    try {
      const obj = JSON.parse(text) as AIResult
      if (obj && Array.isArray(obj.items)) return obj.items as RawFoodItem[]
      // 容錯：有時 AI 直接回陣列
      if (Array.isArray(obj)) return obj as RawFoodItem[]
      return null
    } catch {
      return null
    }
  }
  const direct = tryParse(cleaned)
  if (direct) return direct
  // 後備：抽第一個 '{' 至最後一個 '}'
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    const sliced = tryParse(cleaned.slice(start, end + 1))
    if (sliced) return sliced
  }
  return null
}

const NUTRITION_SYSTEM =
  '你係營養師助手。使用者會用日常口語（多數係廣東話 / 中文）描述佢一餐食咗啲咩。' +
  '請估算每一項食物嘅份量同營養，逐項輸出。' +
  '只可以回一個 JSON 物件，格式：' +
  '{"items":[{"label":"食物名（簡短，含份量）","calories":數字,"proteinG":數字,"fatG":數字,"carbG":數字}]}。' +
  'calories 單位係 kcal；proteinG / fatG / carbG 單位係克；全部用數字（唔好帶單位字串）。' +
  '唔好輸出任何解說文字、唔好用 markdown code fence，淨係回純 JSON。'

type ManualForm = {
  label: string
  calories: string
  proteinG: string
  fatG: string
  carbG: string
}
const EMPTY_MANUAL: ManualForm = {
  label: '',
  calories: '',
  proteinG: '',
  fatG: '',
  carbG: '',
}

// ───────── 餐段顯示資料（label + icon + 色調）─────────
const MEAL_META: Record<
  MealSlot,
  { label: string; icon: typeof Coffee; color: string }
> = {
  breakfast: { label: '早餐', icon: Coffee, color: FIT_TONE.amber },
  lunch: { label: '午餐', icon: Sun, color: FIT_TONE.emerald },
  dinner: { label: '晚餐', icon: Moon, color: FIT_TONE.indigo },
  snack: { label: '小食', icon: Cookie, color: FIT_TONE.sky },
  other: { label: '其他', icon: Utensils, color: FIT_TONE.rose },
}

// 揀餐段嘅 Pills 選項（新增飲食時揀；唔含「其他」—— 其他只係舊資料 fallback）
const MEAL_PILL_OPTIONS: { id: MealSlot; label: string }[] = [
  { id: 'breakfast', label: '早餐' },
  { id: 'lunch', label: '午餐' },
  { id: 'dinner', label: '晚餐' },
  { id: 'snack', label: '小食' },
]

/** 依當下時鐘估計預設餐段（純前端體驗；< 11 早 / < 15 午 / < 21 晚 / 否則小食）。 */
function guessMeal(d: Date = new Date()): MealSlot {
  const h = d.getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

// ───────── 卡路里進度環（純 SVG，深色友善）─────────
function CalorieRing({
  consumed,
  goal,
}: {
  consumed: number
  goal: number
}) {
  const pct = macroPct(consumed, goal) // 已夾 0–100
  const over = goal > 0 && consumed > goal
  const left = remaining(consumed, goal)
  const R = 52
  const C = 2 * Math.PI * R
  const dash = (pct / 100) * C
  const stroke = over ? FIT_TONE.rose : FIT_TONE.emerald
  return (
    <div className="relative flex h-[140px] w-[140px] shrink-0 items-center justify-center">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          strokeWidth="12"
          className="stroke-slate-100 dark:stroke-slate-700"
        />
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          stroke={stroke}
          strokeDasharray={`${dash} ${C}`}
          style={{ transition: 'stroke-dasharray 0.5s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-bold tabular-nums slashed-zero text-slate-800 dark:text-slate-100">
          {Math.round(consumed)}
        </span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          / {Math.round(goal)} kcal
        </span>
        <span
          className={cx(
            'mt-0.5 text-[11px] font-medium tabular-nums',
            over ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400',
          )}
        >
          {over ? `超 ${Math.round(consumed - goal)}` : `剩 ${left}`}
        </span>
      </div>
    </div>
  )
}

// ───────── 單條營養素進度條 ─────────
function MacroBar({
  label,
  icon: I,
  value,
  goal,
  color,
  unit = 'g',
}: {
  label: string
  icon: typeof Beef
  value: number
  goal: number
  color: string
  unit?: string
}) {
  const pct = macroPct(value, goal)
  const left = remaining(value, goal)
  const over = goal > 0 && value > goal
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
          <I size={13} style={{ color }} />
          {label}
        </span>
        <span className="tabular-nums text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {Math.round(value)}
          </span>
          {' / '}
          {Math.round(goal)}
          {unit}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: over ? FIT_TONE.rose : color,
          }}
        />
      </div>
      <p className="mt-0.5 text-right text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
        {over ? `超標 ${Math.round(value - goal)}${unit}` : `仲可食 ${left}${unit}`}
      </p>
    </div>
  )
}

// ───────── 近 7 日卡路里柱狀（純 div，深色友善）─────────
function WeeklyBars({
  entries,
  anchorKey,
  goalCal,
}: {
  entries: FoodEntry[]
  anchorKey: string
  goalCal: number
}) {
  const data = useMemo(
    () => weeklyCalories(entries, fromKey(anchorKey)),
    [entries, anchorKey],
  )
  const max = Math.max(goalCal, ...data.map((d) => d.calories), 1)
  const totalWeek = data.reduce((s, d) => s + d.calories, 0)
  const avg = Math.round(totalWeek / 7)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          近 7 日平均{' '}
          <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
            {avg}
          </span>{' '}
          kcal/日
        </span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          目標 {Math.round(goalCal)}
        </span>
      </div>
      <div className="flex h-32 items-end gap-1.5">
        {data.map((d) => {
          const h = (d.calories / max) * 100
          const wd = WEEKDAY_LABELS[fromKey(d.key).getDay()]
          const isAnchor = d.key === anchorKey
          const over = goalCal > 0 && d.calories > goalCal
          return (
            <div
              key={d.key}
              className="group flex flex-1 flex-col items-center justify-end"
              title={`${d.key}（${wd}）：${d.calories} kcal`}
            >
              <span className="mb-1 text-[10px] font-medium tabular-nums text-slate-500 opacity-0 transition group-hover:opacity-100 dark:text-slate-400">
                {d.calories || ''}
              </span>
              <div
                className={cx(
                  'w-full rounded-t-md transition-all duration-500',
                  d.calories === 0 && 'bg-slate-100 dark:bg-slate-700/60',
                )}
                style={{
                  height: `${Math.max(h, d.calories > 0 ? 4 : 2)}%`,
                  backgroundColor:
                    d.calories === 0
                      ? undefined
                      : over
                        ? FIT_TONE.rose
                        : isAnchor
                          ? FIT_TONE.emerald
                          : FIT_TONE.sky,
                }}
              />
              <span
                className={cx(
                  'mt-1 text-[10px]',
                  isAnchor
                    ? 'font-bold text-slate-700 dark:text-slate-200'
                    : 'text-slate-400 dark:text-slate-500',
                )}
              >
                {wd}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function NutritionView() {
  const toast = useToast()
  const { user } = useAuth()
  const entries = useCollection(foodCol)
  useCollection(goalsCol) // 訂閱：目標改動即 re-render
  const goals = readGoals()

  // ── 當日 ──────────────────────────────────────────────────
  const [dateKey, setDateKey] = useState<string>(todayKey())
  const isToday = dateKey === todayKey()

  // ── 揀餐段（AI / 手動 / 常食 共用同一個目標餐段）───────────
  const [meal, setMeal] = useState<MealSlot>(() => guessMeal())

  // ── AI 自然語言輸入 ───────────────────────────────────────
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState<ParsedItem[]>([])

  // ── 手動新增 ──────────────────────────────────────────────
  const [manualOpen, setManualOpen] = useState(false)
  const [manual, setManual] = useState<ManualForm>(EMPTY_MANUAL)

  // ── 目標編輯 ──────────────────────────────────────────────
  const [goalOpen, setGoalOpen] = useState(false)
  const [goalForm, setGoalForm] = useState({
    calories: String(goals.calories),
    proteinG: String(goals.proteinG),
    fatG: String(goals.fatG),
    carbG: String(goals.carbG),
  })

  // 當日紀錄（新→舊）—— 統計卡 / 計數仍用呢個
  const dayEntries = useMemo(
    () =>
      entries
        .filter((e) => e.date === dateKey)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [entries, dateKey],
  )

  // 當日按餐分組（已排好 MEAL_ORDER；同餐內依 createdAt 新→舊）
  const groups = useMemo(
    () => mealGroups(dayEntries, dateKey),
    [dayEntries, dateKey],
  )

  // 常食：由全部歷史去重統計最常用（取前 8）
  const frequent = useMemo(() => frequentFoods(entries, 8), [entries])

  const totals = useMemo(() => dayTotals(entries, dateKey), [entries, dateKey])
  const totalsKcal = macroKcal(totals)

  const draftTotals = useMemo(
    () =>
      drafts.reduce(
        (s, d) => ({
          calories: s.calories + d.calories,
          proteinG: s.proteinG + d.proteinG,
          fatG: s.fatG + d.fatG,
          carbG: s.carbG + d.carbG,
        }),
        { calories: 0, proteinG: 0, fatG: 0, carbG: 0 },
      ),
    [drafts],
  )

  // ── AI 解析 ───────────────────────────────────────────────
  async function analyze() {
    const t = text.trim()
    if (!t || busy) return
    setBusy(true)
    try {
      const messages: AIMessage[] = [
        {
          role: 'user',
          content: `日期：${dateKey}\n餐食描述：${t}\n\n請逐項估算營養，只回 JSON 物件 {"items":[…]}。`,
        },
      ]
      const out = await complete({
        messages,
        system: NUTRITION_SYSTEM,
        model: 'gemini-2.5-flash',
        temperature: 0.2,
      })
      const raw = parseItemsObject(out)
      if (!raw) {
        toast.error('AI 回覆唔係有效 JSON，請再試或改用手動新增')
        return
      }
      const parsed: ParsedItem[] = []
      for (const r of raw) {
        const n = normalizeItem(r)
        if (!n) continue
        parsed.push({
          key: uid(),
          label: n.label || '未命名食物',
          calories: n.calories,
          proteinG: n.proteinG,
          fatG: n.fatG,
          carbG: n.carbG,
        })
      }
      if (parsed.length === 0) {
        toast.error('AI 解析唔到食物，請講具體啲或用手動新增')
        return
      }
      setDrafts(parsed)
      toast.success(`AI 解析咗 ${parsed.length} 項，校對下就可以加入日誌`)
    } catch (e) {
      toast.error((e as Error).message || 'AI 出錯，請再試')
    } finally {
      setBusy(false)
    }
  }

  function patchDraft(key: string, patch: Partial<ParsedItem>) {
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  }
  function removeDraft(key: string) {
    setDrafts((ds) => ds.filter((d) => d.key !== key))
  }

  // 落地全部草稿做當日 FoodEntry（歸入當下揀嘅餐段）
  function commitDrafts() {
    if (drafts.length === 0) return
    const now = Date.now()
    drafts.forEach((d, i) => {
      foodCol.add({
        date: dateKey,
        label: d.label.trim() || '未命名食物',
        calories: d.calories,
        proteinG: d.proteinG,
        fatG: d.fatG,
        carbG: d.carbG,
        meal,
        // 微錯開 createdAt 保持輸入次序（新→舊排序穩定）
        createdAt: new Date(now + i).toISOString(),
      })
    })
    const n = drafts.length
    setDrafts([])
    setText('')
    toast.success(`已加入 ${n} 項到「${MEAL_META[meal].label}」`)
  }

  // 常食快速再記：一撳即用同樣 macros 加返今日（歸入當下揀嘅餐段）
  function quickAdd(f: FrequentFood) {
    foodCol.add({
      date: dateKey,
      label: f.label,
      calories: f.calories,
      proteinG: f.proteinG,
      fatG: f.fatG,
      carbG: f.carbG,
      meal,
      createdAt: new Date().toISOString(),
    })
    toast.success(`已加入「${f.label}」到「${MEAL_META[meal].label}」`)
  }

  // ── 手動新增 ──────────────────────────────────────────────
  function submitManual() {
    const label = manual.label.trim()
    if (!label) {
      toast.error('請輸入食物名')
      return
    }
    foodCol.add({
      date: dateKey,
      label,
      calories: Math.max(0, Number(manual.calories) || 0),
      proteinG: Math.max(0, Number(manual.proteinG) || 0),
      fatG: Math.max(0, Number(manual.fatG) || 0),
      carbG: Math.max(0, Number(manual.carbG) || 0),
      meal,
      createdAt: new Date().toISOString(),
    })
    setManual(EMPTY_MANUAL)
    setManualOpen(false)
    toast.success(`已加入「${MEAL_META[meal].label}」`)
  }

  function removeEntry(id: string) {
    foodCol.remove(id)
    toast.info('已刪除一項')
  }

  // ── 目標 ──────────────────────────────────────────────────
  function openGoals() {
    setGoalForm({
      calories: String(goals.calories),
      proteinG: String(goals.proteinG),
      fatG: String(goals.fatG),
      carbG: String(goals.carbG),
    })
    setGoalOpen(true)
  }
  function submitGoals() {
    saveGoals({
      calories: Math.max(0, Number(goalForm.calories) || 0),
      proteinG: Math.max(0, Number(goalForm.proteinG) || 0),
      fatG: Math.max(0, Number(goalForm.fatG) || 0),
      carbG: Math.max(0, Number(goalForm.carbG) || 0),
    })
    setGoalOpen(false)
    toast.success('已更新每日目標')
  }
  function resetGoals() {
    setGoalForm({
      calories: String(DEFAULT_GOALS.calories),
      proteinG: String(DEFAULT_GOALS.proteinG),
      fatG: String(DEFAULT_GOALS.fatG),
      carbG: String(DEFAULT_GOALS.carbG),
    })
  }

  // 日期導航：唔畀去未來
  const dayOffset = daysBetween(todayKey(), dateKey) // 0=今日, 負=過去
  const dateLabel = useMemo(() => {
    const d = fromKey(dateKey)
    const wd = WEEKDAY_LABELS[d.getDay()]
    if (dayOffset === 0) return `今日 · ${wd}`
    if (dayOffset === -1) return `噖日 · ${wd}`
    return `${d.getMonth() + 1}月${d.getDate()}日 · 週${wd}`
  }, [dateKey, dayOffset])

  return (
    <div className="space-y-4">
      {/* ── 頂部：日期導航 + 目標掣 ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <IconButton
            label="前一日"
            onClick={() => setDateKey(addDaysKey(dateKey, -1))}
          >
            <ChevronLeft size={18} />
          </IconButton>
          <div className="min-w-[7.5rem] text-center">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {dateLabel}
            </p>
            <p className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
              {dateKey}
            </p>
          </div>
          <IconButton
            label="後一日"
            onClick={() => setDateKey(addDaysKey(dateKey, 1))}
            disabled={isToday}
          >
            <ChevronRight size={18} />
          </IconButton>
          {!isToday && (
            <Button
              variant="ghost"
              size="sm"
              icon={CalendarDays}
              onClick={() => setDateKey(todayKey())}
            >
              今日
            </Button>
          )}
        </div>
        <Tooltip label="設定每日營養目標">
          <Button
            variant="secondary"
            size="sm"
            icon={Target}
            onClick={openGoals}
          >
            目標
          </Button>
        </Tooltip>
      </div>

      {/* ── 當日總計 vs 目標 ── */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
          <CalorieRing consumed={totals.calories} goal={goals.calories} />
          <div className="grid w-full flex-1 gap-3 sm:grid-cols-1">
            <MacroBar
              label="蛋白質"
              icon={Beef}
              value={totals.proteinG}
              goal={goals.proteinG}
              color={FIT_TONE.rose}
            />
            <MacroBar
              label="脂肪"
              icon={Droplet}
              value={totals.fatG}
              goal={goals.fatG}
              color={FIT_TONE.amber}
            />
            <MacroBar
              label="碳水"
              icon={Wheat}
              value={totals.carbG}
              goal={goals.carbG}
              color={FIT_TONE.sky}
            />
          </div>
        </div>
        {totals.calories > 0 && (
          <p className="mt-3 border-t border-slate-100 pt-3 text-center text-[11px] text-slate-400 dark:border-slate-700/60 dark:text-slate-500">
            營養素換算：蛋白 {totalsKcal.protein} · 脂肪 {totalsKcal.fat} · 碳水{' '}
            {totalsKcal.carb} kcal
          </p>
        )}
      </Card>

      {/* ── 主輸入：AI 自然語言 ── */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-1.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent-strong dark:bg-accent/15 dark:text-accent">
            <Wand2 size={15} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              講你食咗咩，AI 幫你計營養
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              例如「今日午餐食咗半碗飯、一塊雞胸、一隻蛋」
            </p>
          </div>
        </div>

        {/* 揀餐段：AI / 手動 / 常食 加入時都歸入呢一餐 */}
        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
            加入邊一餐
          </label>
          <Pills
            options={MEAL_PILL_OPTIONS}
            active={meal === 'other' ? 'breakfast' : meal}
            onChange={setMeal}
            size="sm"
          />
        </div>

        {/* 常食快速再記：一撳即加返今日（唔使再打 / 叫 AI） */}
        {frequent.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40">
            <div className="mb-2 flex items-center gap-1.5">
              <History size={13} className="text-slate-400 dark:text-slate-500" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                常食快速加（撳即記入「{MEAL_META[meal].label}」）
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {frequent.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => quickAdd(f)}
                  title={`P${Math.round(f.proteinG)} · F${Math.round(f.fatG)} · C${Math.round(f.carbG)} · 用過 ${f.count} 次`}
                  aria-label={`加入 ${f.label}，${Math.round(f.calories)} kcal`}
                  className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-accent/50 hover:bg-accent-soft hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-accent/50 dark:hover:bg-accent/10 dark:hover:text-accent"
                >
                  <Plus
                    size={12}
                    className="shrink-0 text-slate-400 transition group-hover:text-accent-strong dark:text-slate-500 dark:group-hover:text-accent"
                  />
                  <span className="truncate">{f.label}</span>
                  <span className="shrink-0 tabular-nums text-slate-400 dark:text-slate-500">
                    {Math.round(f.calories)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {isAIConfigured ? (
          <>
            <Textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy}
              placeholder="今日午餐食咗半碗白飯、一塊煎雞胸、一隻烚蛋同少少西蘭花…"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                icon={Sparkles}
                loading={busy}
                disabled={!text.trim() || !user}
                onClick={() => void analyze()}
              >
                {busy ? 'AI 分析緊…' : 'AI 分析'}
              </Button>
              <Button
                variant="secondary"
                icon={Plus}
                onClick={() => setManualOpen(true)}
              >
                手動新增
              </Button>
              {!user && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  登入後即可用 AI；亦可先手動新增
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
              <Bot size={15} className="mt-0.5 shrink-0" />
              <span>
                需要先設定雲端 AI（見 docs/SETUP.md）。未設定都可以用下面「手動新增」記錄飲食。
              </span>
            </div>
            <Button
              variant="secondary"
              icon={Plus}
              onClick={() => setManualOpen(true)}
            >
              手動新增
            </Button>
          </div>
        )}

        {/* AI 草稿：逐項微調再落地 */}
        {drafts.length > 0 && (
          <div className="space-y-2 rounded-xl border border-accent/30 bg-accent-soft/40 p-3 dark:border-accent/40 dark:bg-accent/10">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-accent-strong dark:text-accent">
                <Sparkles size={14} />
                AI 解析結果（可微調）
              </span>
              <Badge tone="accent">
                <span className="tabular-nums">{drafts.length}</span> 項 ·{' '}
                <span className="tabular-nums">
                  {Math.round(draftTotals.calories)}
                </span>{' '}
                kcal
              </Badge>
            </div>
            <ul className="space-y-2">
              {drafts.map((d) => (
                <li
                  key={d.key}
                  className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={d.label}
                      onChange={(e) =>
                        patchDraft(d.key, { label: e.target.value })
                      }
                      aria-label="食物名"
                      className="flex-1"
                      placeholder="食物名"
                    />
                    <IconButton
                      label="移除呢項"
                      tone="danger"
                      onClick={() => removeDraft(d.key)}
                    >
                      <X size={16} />
                    </IconButton>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {(
                      [
                        ['calories', 'kcal'],
                        ['proteinG', 'P'],
                        ['fatG', 'F'],
                        ['carbG', 'C'],
                      ] as const
                    ).map(([field, lbl]) => (
                      <label key={field} className="block">
                        <span className="mb-0.5 block text-center text-[10px] text-slate-400 dark:text-slate-500">
                          {lbl}
                        </span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={String(d[field])}
                          onChange={(e) =>
                            patchDraft(d.key, {
                              [field]: Math.max(0, Number(e.target.value) || 0),
                            })
                          }
                          aria-label={`${d.label} ${lbl}`}
                          className="px-2 text-center text-sm tabular-nums"
                        />
                      </label>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDrafts([])}
              >
                取消
              </Button>
              <Button size="sm" icon={Check} onClick={commitDrafts}>
                全部加入日誌（{drafts.length}）
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ── 飲食日誌（當日列表，可刪）── */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            <Utensils size={14} />
            {isToday ? '今日' : dateLabel} 飲食日誌
          </span>
          {dayEntries.length > 0 && (
            <Badge tone="slate">
              <span className="tabular-nums">{dayEntries.length}</span> 項
            </Badge>
          )}
        </div>

        {dayEntries.length === 0 ? (
          <EmptyState
            icon={Apple}
            title="呢日仲未有飲食紀錄"
            hint="用上面 AI 分析講你食咗咩，或者撳「手動新增」自己填。"
          />
        ) : (
          <div className="space-y-4">
            {groups.map((g) => {
              const m = MEAL_META[g.meal]
              const MI = m.icon
              return (
                <div key={g.meal}>
                  {/* 餐段標題 + 小計 */}
                  <div className="mb-1 flex items-center justify-between border-b border-slate-100 pb-1 dark:border-slate-800">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <MI size={14} style={{ color: m.color }} />
                      {m.label}
                      <span className="tabular-nums text-slate-400 dark:text-slate-500">
                        · {g.entries.length}
                      </span>
                    </span>
                    <span className="text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {Math.round(g.subtotal.calories)}
                      </span>{' '}
                      kcal
                      <span className="ml-2 text-slate-400 dark:text-slate-500">
                        <span className="text-rose-500">
                          P {Math.round(g.subtotal.proteinG)}
                        </span>{' '}
                        <span className="text-amber-500">
                          F {Math.round(g.subtotal.fatG)}
                        </span>{' '}
                        <span className="text-sky-500">
                          C {Math.round(g.subtotal.carbG)}
                        </span>
                      </span>
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {g.entries.map((e) => (
                      <li
                        key={e.id}
                        className="group flex items-center gap-3 py-2.5"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                          <Flame size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                            {e.label}
                          </p>
                          <p className="flex flex-wrap gap-x-2 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                            <span className="text-rose-500">
                              P {Math.round(e.proteinG)}
                            </span>
                            <span className="text-amber-500">
                              F {Math.round(e.fatG)}
                            </span>
                            <span className="text-sky-500">
                              C {Math.round(e.carbG)}
                            </span>
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                          {Math.round(e.calories)}
                          <span className="ml-0.5 text-[10px] font-normal text-slate-400">
                            kcal
                          </span>
                        </span>
                        <IconButton
                          label={`刪除 ${e.label}`}
                          tone="danger"
                          onClick={() => removeEntry(e.id)}
                          className="opacity-0 transition group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* ── 近 7 日卡路里柱狀 ── */}
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <BarChart3 size={14} className="text-slate-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            近 7 日卡路里
          </span>
        </div>
        <WeeklyBars
          entries={entries}
          anchorKey={dateKey}
          goalCal={goals.calories}
        />
      </Card>

      {/* ── 快速統計卡 ── */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="蛋白達標"
          value={macroPct(totals.proteinG, goals.proteinG)}
          unit="%"
          icon={Beef}
        />
        <StatCard
          label="脂肪達標"
          value={macroPct(totals.fatG, goals.fatG)}
          unit="%"
          icon={Droplet}
        />
        <StatCard
          label="碳水達標"
          value={macroPct(totals.carbG, goals.carbG)}
          unit="%"
          icon={Wheat}
        />
      </div>

      {/* ── 手動新增 Modal ── */}
      <Modal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="手動新增食物"
        footer={
          <>
            <Button variant="ghost" onClick={() => setManualOpen(false)}>
              取消
            </Button>
            <Button icon={Plus} onClick={submitManual}>
              加入
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="食物名" required>
            <Input
              autoFocus
              value={manual.label}
              onChange={(e) => setManual({ ...manual, label: e.target.value })}
              placeholder="例如：白飯一碗"
            />
          </Field>
          <Field label="餐段">
            <Pills
              options={MEAL_PILL_OPTIONS}
              active={meal === 'other' ? 'breakfast' : meal}
              onChange={setMeal}
              size="sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="卡路里 (kcal)">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={manual.calories}
                onChange={(e) =>
                  setManual({ ...manual, calories: e.target.value })
                }
                placeholder="0"
                className="tabular-nums"
              />
            </Field>
            <Field label="蛋白質 (g)">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={manual.proteinG}
                onChange={(e) =>
                  setManual({ ...manual, proteinG: e.target.value })
                }
                placeholder="0"
                className="tabular-nums"
              />
            </Field>
            <Field label="脂肪 (g)">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={manual.fatG}
                onChange={(e) => setManual({ ...manual, fatG: e.target.value })}
                placeholder="0"
                className="tabular-nums"
              />
            </Field>
            <Field label="碳水 (g)">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={manual.carbG}
                onChange={(e) =>
                  setManual({ ...manual, carbG: e.target.value })
                }
                placeholder="0"
                className="tabular-nums"
              />
            </Field>
          </div>
        </div>
      </Modal>

      {/* ── 目標編輯 Modal ── */}
      <Modal
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        title="每日營養目標"
        footer={
          <>
            <Button
              variant="ghost"
              icon={RotateCcw}
              onClick={resetGoals}
            >
              還原預設
            </Button>
            <Button icon={Settings2} onClick={submitGoals}>
              儲存
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            預設參考值：卡路里 2000 · 蛋白 120g · 脂肪 60g · 碳水 220g。可按自己需要調整。
          </p>
          <Field label="每日卡路里 (kcal)">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              value={goalForm.calories}
              onChange={(e) =>
                setGoalForm({ ...goalForm, calories: e.target.value })
              }
              className="tabular-nums"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="蛋白 (g)">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={goalForm.proteinG}
                onChange={(e) =>
                  setGoalForm({ ...goalForm, proteinG: e.target.value })
                }
                className="tabular-nums"
              />
            </Field>
            <Field label="脂肪 (g)">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={goalForm.fatG}
                onChange={(e) =>
                  setGoalForm({ ...goalForm, fatG: e.target.value })
                }
                className="tabular-nums"
              />
            </Field>
            <Field label="碳水 (g)">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                value={goalForm.carbG}
                onChange={(e) =>
                  setGoalForm({ ...goalForm, carbG: e.target.value })
                }
                className="tabular-nums"
              />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  )
}
