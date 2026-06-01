import { createCollection, uid } from '../../../lib/store'
import type { Difficulty, Question, QuizAttempt, QuizAttemptItem } from '../../../data/types'

// ============================================================
//  QuizMode — 純函式 / 型別 / 自家持久化（Quizlet / Kahoot 級）
//  ------------------------------------------------------------
//  零外部依賴；所有計分、洗牌、文字正規化、統計彙整集中喺呢度。
//  AttemptItem 共用 data/types（向後相容），唔改 collections.ts。
// ============================================================

// ───── 標籤 / 樣式對照（本地，跟 QuestionBank 同一慣例）─────
export const DIFF_LABEL: Record<Difficulty, string> = {
  easy: '易',
  medium: '中',
  hard: '難',
}
export const DIFF_ORDER: Difficulty[] = ['easy', 'medium', 'hard']
export const DIFF_TONE: Record<Difficulty, 'green' | 'amber' | 'rose'> = {
  easy: 'green',
  medium: 'amber',
  hard: 'rose',
}

// 範圍難度（含『不限』）
export type DiffFilter = Difficulty | 'all'
export const DIFF_FILTER_LABEL: Record<DiffFilter, string> = {
  all: '不限',
  easy: '易',
  medium: '中',
  hard: '難',
}

// 出題模式（Kahoot：計時搶分 / Quizlet：逐題即查 / 經典：一次過批改）
export type QuizMode = 'practice' | 'classic' | 'timed'
export const QUIZ_MODE_LABEL: Record<QuizMode, string> = {
  practice: '練習（即查答案）',
  classic: '測驗（最後批改）',
  timed: '計時搶分（Kahoot）',
}
export const QUIZ_MODE_HINT: Record<QuizMode, string> = {
  practice: '揀完即見對錯同解釋，無壓力鞏固',
  classic: '答晒先一次過批改，模擬考試',
  timed: '每題限時，答得快分數越高',
}

// 題型（quiz 內部用；short 用文字輸入自評，mc 維持選項）
export type QuizItemKind = 'mc' | 'short'

// 題數選項（Pills 要 string id；'all' = 全部）
export type CountId = '5' | '10' | '15' | '20' | '30' | 'all'
export const COUNT_OPTIONS: { id: CountId; label: string }[] = [
  { id: '5', label: '5 題' },
  { id: '10', label: '10 題' },
  { id: '15', label: '15 題' },
  { id: '20', label: '20 題' },
  { id: '30', label: '30 題' },
  { id: 'all', label: '全部' },
]

// 每題秒數（timed 模式用）
export type TimeLimit = 10 | 20 | 30 | 45
export const TIME_OPTIONS: { id: string; label: string }[] = [
  { id: '10', label: '10 秒' },
  { id: '20', label: '20 秒' },
  { id: '30', label: '30 秒' },
  { id: '45', label: '45 秒' },
]

// ───── 設定（由 setup 帶去 quiz / result）─────
export interface QuizSettings {
  topicId: string // '' = 全部課題
  difficulty: DiffFilter
  count: CountId
  mode: QuizMode
  includeShort: boolean // 容許短答題（文字自評）
  shuffleOptions: boolean // 打亂 MC 選項次序
  timeLimit: TimeLimit // 每題秒數（只 timed 模式用）
}

export const DEFAULT_SETTINGS: QuizSettings = {
  topicId: '',
  difficulty: 'all',
  count: '10',
  mode: 'practice',
  includeShort: false,
  shuffleOptions: true,
  timeLimit: 20,
}

// ───── 做題快照（凍結內容，題庫之後改都唔影響）─────
export interface FrozenQuestion {
  questionId: string
  kind: QuizItemKind
  topicId: string
  difficulty: Difficulty
  stem: string
  options: string[] // mc：（可能已洗牌嘅）選項；short：[正確答案]
  answerIndex: number // mc：正確 index；short：0
  explanation: string // Question.answer（mc 通常空）/ short 嘅參考答案
}

// 計時搶分：滿分基準（答對基本分 + 速度獎勵）
export const BASE_POINTS = 1000
export const SPEED_BONUS = 1000 // 最高額外速度分（剩餘時間比例 × 此值）

// ============================================================
//  純函式
// ============================================================

// 合資格 MC：有選項（>=2）+ 有效正確答案 index
export function isQuizableMc(q: Question): boolean {
  return (
    q.type === 'mc' &&
    Array.isArray(q.options) &&
    q.options.length >= 2 &&
    typeof q.answerIndex === 'number' &&
    q.answerIndex >= 0 &&
    q.answerIndex < q.options.length
  )
}

// 合資格短答：有參考答案文字
export function isQuizableShort(q: Question): boolean {
  return (
    (q.type === 'short' || q.type === 'long' || q.type === 'case') &&
    typeof q.answer === 'string' &&
    q.answer.trim().length > 0
  )
}

// 任何一種可測
export function isQuizable(q: Question, includeShort: boolean): boolean {
  if (isQuizableMc(q)) return true
  return includeShort && isQuizableShort(q)
}

// Fisher–Yates 洗牌（回傳新陣列）
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const pad2 = (n: number) => String(n).padStart(2, '0')

// 本地時區日期 key（YYYY-MM-DD）。整個 repo 用本地 key 避開 toISOString 的 UTC 漂移
// （見 calendar/util.ts toKey）；createdAt 由 new Date().toISOString() 寫入係 UTC，
// 故凌晨做題若直接 slice ISO 會落錯日。非法日期則退回 slice(0,10)。
function localDayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// ISO → `YYYY-MM-DD HH:mm`
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}`
}

// 秒 → `mm:ss`
export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`
}

// 命中率 → 文字色，帶 dark:
export function scoreColor(pct: number): string {
  if (pct >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (pct >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

export function scoreTone(pct: number): 'green' | 'amber' | 'rose' {
  if (pct >= 80) return 'green'
  if (pct >= 50) return 'amber'
  return 'rose'
}

export const pct = (correct: number, total: number) =>
  total > 0 ? Math.round((correct / total) * 100) : 0

// 等第（A+ … F），Quizlet / 學校風
export function grade(p: number): string {
  if (p >= 90) return 'A+'
  if (p >= 80) return 'A'
  if (p >= 70) return 'B'
  if (p >= 60) return 'C'
  if (p >= 50) return 'D'
  return 'F'
}

// 一句鼓勵語（按命中率）
export function verdict(p: number): string {
  if (p === 100) return '滿分！完美無瑕 🎉'
  if (p >= 90) return '非常出色，掌握得好穩'
  if (p >= 80) return '做得好，繼續保持'
  if (p >= 60) return '及格有餘，再操幾轉就更穩'
  if (p >= 40) return '有基礎，重點係錯題本'
  return '別氣餒，由錯題本逐題突破'
}

// 短答自評：正規化（去空白 / 標點 / 全形 / 大小寫）後比較
export function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。、,.;:；：!！?？「」『』""''()（）\-_/\\]/g, '')
}

// 短答自動判斷（嚴格相等 / 一方包含另一方 → 視為命中候選）
export function shortMatches(input: string, answer: string): boolean {
  const a = normalizeAnswer(input)
  const b = normalizeAnswer(answer)
  if (!a || !b) return false
  if (a === b) return true
  // 長答案：學生答案包含關鍵參考答案，或反之（短答常見）
  if (b.length >= 3 && (a.includes(b) || b.includes(a))) return true
  return false
}

// timed 模式單題得分：答啱先有分；剩餘時間比例帶速度獎勵
export function timedPoints(
  correct: boolean,
  remainingSec: number,
  limitSec: number,
): number {
  if (!correct) return 0
  const ratio = limitSec > 0 ? Math.max(0, Math.min(1, remainingSec / limitSec)) : 0
  return Math.round(BASE_POINTS + ratio * SPEED_BONUS)
}

// 由 frozen + 答案計分（同一邏輯畀做題 / 結果共用）
export function itemFromFrozen(
  q: FrozenQuestion,
  selectedIndex: number | null,
  shortInput: string | undefined,
): QuizAttemptItem {
  let correct = false
  if (q.kind === 'mc') {
    correct = selectedIndex !== null && selectedIndex === q.answerIndex
  } else {
    correct = shortInput != null && shortMatches(shortInput, q.explanation)
  }
  return {
    questionId: q.questionId,
    topicId: q.topicId,
    difficulty: q.difficulty,
    stem: q.stem,
    options: q.kind === 'mc' ? q.options : [],
    answerIndex: q.answerIndex,
    selectedIndex: q.kind === 'mc' ? selectedIndex : correct ? 0 : null,
    correct,
  }
}

// 由歷史 attempt 還原一份設定（重溫後若按「重做」沿用）
export function settingsFromAttempt(a: QuizAttempt): QuizSettings {
  const COUNTS: CountId[] = ['5', '10', '15', '20', '30']
  const asCount = String(a.total) as CountId
  return {
    ...DEFAULT_SETTINGS,
    topicId: a.topicIds[0] ?? '',
    difficulty: a.difficulty,
    count: COUNTS.includes(asCount) ? asCount : 'all',
  }
}

// ============================================================
//  自家持久化：錯題本（跨次彙整，可標記已掌握）
//  唔掂 data/collections.ts；喺 newCollections 申報。
// ============================================================
export interface MistakeEntry {
  id: string
  questionId: string
  topicId: string
  difficulty: Difficulty
  stem: string
  wrongCount: number // 累計答錯次數
  lastWrongAt: string // ISO，最近答錯
  mastered: boolean // 已克服（用家手動標記）
  masteredAt?: string
}

export const mistakesCol = createCollection<MistakeEntry>('quiz.mistakes', [])

// 由一份 attempt 把「答錯」題更新入錯題本（答啱會減 wrongCount / 自動標記掌握）
export function syncMistakesFromAttempt(attempt: QuizAttempt): void {
  const list = mistakesCol.get()
  const byQid = new Map(list.map((m) => [m.questionId, m]))
  const now = attempt.createdAt

  for (const it of attempt.items) {
    const existing = byQid.get(it.questionId)
    if (!it.correct) {
      if (existing) {
        mistakesCol.update(existing.id, {
          wrongCount: existing.wrongCount + 1,
          lastWrongAt: now,
          mastered: false,
          masteredAt: undefined,
          stem: it.stem,
          topicId: it.topicId,
          difficulty: it.difficulty,
        })
      } else {
        mistakesCol.add({
          id: uid(),
          questionId: it.questionId,
          topicId: it.topicId,
          difficulty: it.difficulty,
          stem: it.stem,
          wrongCount: 1,
          lastWrongAt: now,
          mastered: false,
        })
      }
    } else if (existing && !existing.mastered) {
      // 答啱：連續答啱兩次即自動標記掌握，否則 wrongCount 減一
      const next = existing.wrongCount - 1
      if (next <= 0) {
        mistakesCol.update(existing.id, {
          wrongCount: 0,
          mastered: true,
          masteredAt: now,
        })
      } else {
        mistakesCol.update(existing.id, { wrongCount: next })
      }
    }
  }
}

// ============================================================
//  統計彙整（畀 StatsView + charts 用）
// ============================================================
export interface ScorePoint {
  attemptId: string
  createdAt: string
  pct: number
  total: number
  correct: number
}

// 由 attempts（任意次序）→ 按時間升序嘅命中率折線資料
export function scoreSeries(attempts: QuizAttempt[]): ScorePoint[] {
  return [...attempts]
    .sort((a, b) =>
      a.createdAt === b.createdAt ? 0 : a.createdAt < b.createdAt ? -1 : 1,
    )
    .map((a) => ({
      attemptId: a.id,
      createdAt: a.createdAt,
      pct: pct(a.correctCount, a.total),
      total: a.total,
      correct: a.correctCount,
    }))
}

// 課題掌握度（合併所有 attempt 嘅逐題）
export interface TopicMastery {
  topicId: string
  correct: number
  total: number
  pct: number
}
export function topicMastery(attempts: QuizAttempt[]): TopicMastery[] {
  const map = new Map<string, { correct: number; total: number }>()
  for (const a of attempts) {
    for (const it of a.items) {
      const g = map.get(it.topicId) ?? { correct: 0, total: 0 }
      g.total++
      if (it.correct) g.correct++
      map.set(it.topicId, g)
    }
  }
  return [...map.entries()]
    .map(([topicId, g]) => ({ topicId, correct: g.correct, total: g.total, pct: pct(g.correct, g.total) }))
    .sort((a, b) => a.pct - b.pct) // 弱在前
}

// 難度掌握度
export function difficultyMastery(
  attempts: QuizAttempt[],
): { diff: Difficulty; correct: number; total: number }[] {
  return DIFF_ORDER.map((d) => {
    let correct = 0
    let total = 0
    for (const a of attempts) {
      for (const it of a.items) {
        if (it.difficulty !== d) continue
        total++
        if (it.correct) correct++
      }
    }
    return { diff: d, correct, total }
  }).filter((r) => r.total > 0)
}

// 練習熱力圖：近 N 日每日做題數（題數，唔係次數）
export interface HeatCell {
  key: string // YYYY-MM-DD
  count: number
}
export function practiceHeatmap(attempts: QuizAttempt[], days: number): HeatCell[] {
  const counts = new Map<string, number>()
  for (const a of attempts) {
    // 用本地日期分桶，對齊下面用 getFullYear/getMonth/getDate 砌嘅格仔
    // （直接 slice ISO 係 UTC，凌晨做題會落錯日 / 「今日」格永遠 0）
    const ad = new Date(a.createdAt)
    const key = Number.isNaN(ad.getTime())
      ? a.createdAt.slice(0, 10)
      : `${ad.getFullYear()}-${pad2(ad.getMonth() + 1)}-${pad2(ad.getDate())}`
    counts.set(key, (counts.get(key) ?? 0) + a.total)
  }
  const out: HeatCell[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    out.push({ key, count: counts.get(key) ?? 0 })
  }
  return out
}

// ============================================================
//  匯出 CSV（成績 + 逐題對錯）——同 AIAssistant 匯出文化一致
//  ------------------------------------------------------------
//  純函式核心：QuizAttempt[] → 試算表二維陣列（含表頭，最新喺前）。
//  CSV 轉義 / Blob 下載沿用 work/shared/csv（零新依賴、Excel BOM）。
// ============================================================

// 平台模式（learning / work）中文標籤——對齊全 repo「學習 / 工作」叫法
export const ATTEMPT_MODE_LABEL: Record<'learning' | 'work', string> = {
  learning: '學習',
  work: '工作',
}

export const QUIZ_CSV_HEADER = [
  '日期',
  '模式',
  '範圍',
  '難度',
  '題數',
  '答啱',
  '命中率%',
  '用時',
  '逐題對錯',
] as const

// 逐題對錯 → 緊湊字串（✓ = 啱、✗ = 錯），保留作答次序
export function itemsResultString(items: QuizAttemptItem[]): string {
  return items.map((it) => (it.correct ? '✓' : '✗')).join('')
}

// QuizAttempt[] → 試算表（表頭 + 每次一行，最新喺前）。
// topicName：把 topicId 還原做課題名（找唔到 → '未分類'，對齊 StatsView）。
export function attemptsToCsvRows(
  attempts: QuizAttempt[],
  topicName: (id: string) => string,
): (string | number)[][] {
  const sorted = [...attempts].sort((a, b) =>
    a.createdAt === b.createdAt ? 0 : a.createdAt < b.createdAt ? 1 : -1,
  )
  const rows: (string | number)[][] = sorted.map((a) => {
    const scope = a.topicIds.length
      ? a.topicIds.map(topicName).join(' / ')
      : '全部課題'
    return [
      formatDateTime(a.createdAt),
      ATTEMPT_MODE_LABEL[a.mode],
      scope,
      DIFF_FILTER_LABEL[a.difficulty],
      a.total,
      a.correctCount,
      pct(a.correctCount, a.total),
      fmtDuration(a.durationSec),
      itemsResultString(a.items),
    ]
  })
  return [[...QUIZ_CSV_HEADER], ...rows]
}

// CSV 轉義 + 下載：共用 work/shared 嗰份（行為與其他匯出完全一致）。
export { csvEscape, downloadCsv } from '../../work/shared/csv'

// 連續練習日數（current / best）—— 以「有做題嘅日」計
export function practiceStreak(attempts: QuizAttempt[]): { current: number; best: number } {
  // 用本地日期 key 砌「有做題的日」Set（對齊 practiceHeatmap / calendar；
  // createdAt 係 UTC ISO，直接 slice 會令凌晨做題塌入前一日、低估連續日數）。
  const days = new Set(attempts.map((a) => localDayKey(a.createdAt)))
  if (days.size === 0) return { current: 0, best: 0 }
  // 由 key 砌返本地 Date（中午，避開 DST 邊界令相鄰日差仍為 1）。
  const fromKey = (key: string): Date => {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0)
  }
  const sorted = [...days].sort()
  let best = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = fromKey(sorted[i - 1])
    const cur = fromKey(sorted[i])
    const diff = Math.round((cur.getTime() - prev.getTime()) / 864e5)
    if (diff === 1) run++
    else run = 1
    if (run > best) best = run
  }
  // current：由今日（或昨日）往回連續。全程本地 key，與 days set 一致。
  const now = new Date()
  const todayKey = localDayKey(now.toISOString())
  const yKey = localDayKey(new Date(now.getTime() - 864e5).toISOString())
  let cursor: string | null = days.has(todayKey)
    ? todayKey
    : days.has(yKey)
      ? yKey
      : null
  let current = 0
  while (cursor && days.has(cursor)) {
    current++
    const d = fromKey(cursor)
    d.setDate(d.getDate() - 1)
    cursor = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  }
  return { current, best }
}
