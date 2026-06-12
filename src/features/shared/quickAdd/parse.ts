import { complete } from '../../../lib/aiClient'
import { parseJsonArray } from '../../../lib/aiJson'
import { todayStr } from '../../../lib/srs'
import type { CountdownCategory } from '../../../data/types'

// ============================================================
//  快速加入 — 自然語言 → 結構化草稿（解析引擎）
//  ------------------------------------------------------------
//  一句自然語言（例：「下星期三 3pm 同 5A 家長開會」）經 Gemini
//  分析成單一 JSON 物件，再正規化成 ParsedDraft，分流去三類：
//    · task      —— 無日期、純一件要做嘅事        → tasksCol
//    · countdown —— 有日子但似死線 / 考試 / 重要日  → countdownsCol
//    · event     —— 有明確時間 / 時段              → eventsCol
//
//  本檔三層職責分明：
//    1) buildQuickAddPrompt — 純字串組裝（附今日日期 + 星期，教 AI
//                              解相對日期同分類規則，只回 JSON）。
//    2) toDraft             — **純函數**，容錯 + 正規化 AI 回嘅 raw
//                              物件（最終資料以呢層為準，唔信 AI 格式）。
//    3) parseQuickAdd       — 薄包裝：complete → extractJsonObject →
//                              toDraft；AI / 解析失敗一律回 null。
//  唔 import React；正規化邏輯全部可單元測試（見 parse.test.ts）。
// ============================================================

export type QuickAddKind = 'task' | 'countdown' | 'event'

/**
 * quick-add 簡化版重複規則（只限 event）。
 * 對應 data/types 的 RecurrenceRule，但只暴露最常見嘅 daily / weekly：
 *  · freq      —— 'daily' | 'weekly'
 *  · interval  —— 每 N 日/週（正整數，預設 1）
 *  · byWeekday —— 每週重複時指定星期幾（0=日…6=六）；daily 唔需要
 * commit 寫入時會補成完整 RecurrenceRule（其餘欄位留空）。
 */
export interface RecurrenceDraft {
  freq: 'daily' | 'weekly'
  interval?: number
  byWeekday?: number[]
}

export interface ParsedDraft {
  kind: QuickAddKind
  title: string
  date?: string // YYYY-MM-DD
  time?: string // HH:mm
  endTime?: string // HH:mm
  category?: CountdownCategory
  recurrence?: RecurrenceDraft // 只限 event；無重複講法時 undefined
  notes?: string
  mode: 'learning' | 'work'
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const
const KINDS: QuickAddKind[] = ['task', 'countdown', 'event']
const CATEGORIES: CountdownCategory[] = [
  'exam',
  'deadline',
  'assessment',
  'event',
  'other',
]

/** 今日（new Date()）→「星期X」。供 prompt 用，令 AI 解到「下星期三」。 */
function weekdayOf(d: Date): string {
  return `星期${WEEKDAYS[d.getDay()]}`
}

/**
 * 組裝畀 Gemini 嘅 prompt：要佢淨係回**單一 JSON 物件**。
 * 附 today（= todayStr()）同 weekday，令佢解到相對日期（聽日 /
 * 下星期三 / 3pm）；並寫明三類分流規則。繁體中文、零解說文字。
 */
export function buildQuickAddPrompt(
  text: string,
  today: string,
  weekday: string,
  mode: 'learning' | 'work',
): string {
  const modeLabel = mode === 'work' ? '工作' : '學習'
  return [
    '你係一個行程助手，幫用戶將一句自然語言，分類成「待辦 / 提醒倒數 / 行事曆事件」其中一種，並抽取結構化資料。',
    `今日係 ${today}（${weekday}）。用戶目前喺「${modeLabel}」模式。`,
    '',
    '分類規則（只揀一個 kind）：',
    '· 有明確時間或時段（例如「3pm」「下午兩點到四點」「朝早9點開會」）→ kind = "event"。',
    '· 有日子但似死線 / 考試 / 重要日子（例如「6月20號交報告」「下月5號測驗」「下星期一死線」）→ kind = "countdown"，再估 category。',
    '· 無日期、純粹一件要做嘅事（例如「影印筆記」「跟進家長電郵」）→ kind = "task"。',
    '',
    'category（只限 countdown，揀最貼切一個）：',
    '· exam = 考試 / 大考 / 模擬試；deadline = 死線 / 交功課 / 提交；assessment = 測驗 / 評估 / 功課；event = 活動 / 典禮 / 會議；other = 其他。',
    '',
    '日期規則：',
    `· 解相對日期時以今日 ${today}（${weekday}）為基準（「聽日」「下星期三」「下個月」等）。`,
    '· date 格式必須係 "YYYY-MM-DD"；time / endTime 格式必須係 24 小時制 "HH:mm"（例如下午3點 = "15:00"）。',
    '· 解唔到嘅欄位一律填 null（唔好亂估）。title 用繁體中文、精煉，唔好包含日期 / 時間字眼。',
    '',
    '重複規則（recurrence，只限 kind = "event"；其他類一律 null）：',
    '· 偵測到重複講法先填，否則一律 null（唔好亂估）。',
    '· 「每日 / 每朝 / 每晚 / 日日」→ {"freq":"daily","interval":1}。',
    '· 「每兩日 / 隔日」→ {"freq":"daily","interval":2}。',
    '· 「每週 / 每星期 / 每個禮拜」（無指明星期幾）→ {"freq":"weekly","interval":1}。',
    '· 「每週一 / 逢星期五 / 逢一三五」→ {"freq":"weekly","interval":1,"byWeekday":[...]}，byWeekday 用數字（0=日,1=一,2=二,3=三,4=四,5=五,6=六）。',
    '· interval 係正整數（每 N 日/週，預設 1）；byWeekday 只喺 weekly 用，daily 唔好填。',
    '',
    '若輸入包含多件事（多個時間／多項任務／用逗號、頓號、換行分隔），請逐件拆成獨立項目，每件一個物件、各自獨立分類同抽日期時間。',
    '只回一個 JSON 陣列（唔好有任何解說文字，唔好用 markdown，唔好加 ``` 圍欄）；只有一件事就回單元素陣列。每個元素格式如下：',
    '{"kind":"task|countdown|event","title":"...","date":"YYYY-MM-DD|null","time":"HH:mm|null","endTime":"HH:mm|null","category":"exam|deadline|assessment|event|other|null","recurrence":{"freq":"daily|weekly","interval":1,"byWeekday":[1,3]}|null,"notes":"...|null"}',
    '',
    `用戶輸入：\n${text}`,
  ].join('\n')
}

// ───────── 正規化 helpers（純字串）─────────

function asStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** 校驗並正規化成 YYYY-MM-DD；唔啱（含 AI 吐 "null"）回 undefined。 */
function normDate(v: unknown): string | undefined {
  const s = asStr(v)
  // 必須係 YYYY-MM-DD 形狀；再用 Date 確認係真實日子（擋 2026-13-40）
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return undefined
  const [, y, mo, d] = m
  const yi = Number(y)
  const moi = Number(mo)
  const di = Number(d)
  if (moi < 1 || moi > 12 || di < 1 || di > 31) return undefined
  const dt = new Date(yi, moi - 1, di)
  if (
    dt.getFullYear() !== yi ||
    dt.getMonth() !== moi - 1 ||
    dt.getDate() !== di
  )
    return undefined
  return s
}

/** 校驗並正規化成 HH:mm（24 小時制）；唔啱回 undefined。 */
function normTime(v: unknown): string | undefined {
  const s = asStr(v)
  const m = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (!m) return undefined
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return undefined
  return `${String(h).padStart(2, '0')}:${m[2]}`
}

/** 只接受合法 CountdownCategory；其餘回 undefined。 */
function normCategory(v: unknown): CountdownCategory | undefined {
  const s = asStr(v).toLowerCase()
  return (CATEGORIES as string[]).includes(s)
    ? (s as CountdownCategory)
    : undefined
}

const REC_FREQS = ['daily', 'weekly'] as const

/**
 * 正規化 AI 回嘅 recurrence raw（**唔信格式**；唔合法整體 drop → undefined）：
 *  · 必須係物件；null / 非物件 / 陣列 → undefined。
 *  · freq 限白名單 {daily, weekly}（大細階不敏感）；唔啱 → undefined（整體 drop）。
 *  · interval 正規化成正整數，預設 1（非數字 / ≤0 / 非整數 → 1）。
 *  · byWeekday 只喺 weekly 保留：限 0..6 整數、去重、升序；過濾後全空 → 唔帶呢欄。
 *    daily 一律唔帶 byWeekday。
 */
function normRecurrence(v: unknown): RecurrenceDraft | undefined {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return undefined
  const o = v as Record<string, unknown>

  const freq = asStr(o.freq).toLowerCase()
  if (!(REC_FREQS as readonly string[]).includes(freq)) return undefined

  const out: RecurrenceDraft = { freq: freq as RecurrenceDraft['freq'] }

  const rawInterval = o.interval
  const interval =
    typeof rawInterval === 'number' && Number.isFinite(rawInterval)
      ? Math.floor(rawInterval)
      : 1
  out.interval = interval >= 1 ? interval : 1

  if (out.freq === 'weekly' && Array.isArray(o.byWeekday)) {
    const days = [
      ...new Set(
        (o.byWeekday as unknown[])
          .map((d) => (typeof d === 'number' ? Math.floor(d) : NaN))
          .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
      ),
    ].sort((a, b) => a - b)
    if (days.length) out.byWeekday = days
  }

  return out
}

/**
 * 將 AI 回嘅 raw 物件容錯解析成 ParsedDraft（**純函數，唔 call AI**）。
 *  · raw 唔係物件 → null
 *  · kind 唔喺白名單 → 預設 'task'
 *  · title 必須 trim 後非空，否則 → null
 *  · date 正規化成 YYYY-MM-DD（唔啱 → undefined）
 *  · time / endTime 正規化成 HH:mm（唔啱 → undefined）
 *  · category 只接受合法值（唔啱 → undefined）
 *  · recurrence 只喺 kind=event 正規化（normRecurrence；唔合法 → 唔帶）
 *  · event 缺 time 仍可（allDay 由寫入層按 !time 決定，唔喺呢度）
 * date / mode 由呼叫端傳入（today 暫時無用到，預留將來「相對日期
 * 後備正規化」需要，故保留簽名一致）。
 */
export function toDraft(
  raw: unknown,
  mode: 'learning' | 'work',
  _today: string,
): ParsedDraft | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>

  const title = asStr(o.title)
  if (!title) return null

  const rawKind = asStr(o.kind).toLowerCase()
  const kind: QuickAddKind = (KINDS as string[]).includes(rawKind)
    ? (rawKind as QuickAddKind)
    : 'task'

  const draft: ParsedDraft = { kind, title, mode }

  const date = normDate(o.date)
  if (date) draft.date = date

  const time = normTime(o.time)
  if (time) draft.time = time

  const endTime = normTime(o.endTime)
  if (endTime) draft.endTime = endTime

  const category = normCategory(o.category)
  if (category) draft.category = category

  // recurrence 只限 event（重複只對行事曆事件有意義）
  if (kind === 'event') {
    const recurrence = normRecurrence(o.recurrence)
    if (recurrence) draft.recurrence = recurrence
  }

  const notes = asStr(o.notes)
  if (notes) draft.notes = notes

  return draft
}

/**
 * 端到端解析：自然語言 →（可多項）ParsedDraft[]。
 * 包 complete()（gemini-2.5-flash）→ parseJsonArray → 逐項 toDraft。
 * 一段文字含多件事（多個時間 / 多項任務）會拆成多個 draft；
 * AI 出錯 / 解唔到合法陣列 / 全部 title 空 → 回 []（呼叫端退手動預覽）。
 */
export async function parseQuickAdd(
  text: string,
  mode: 'learning' | 'work',
): Promise<ParsedDraft[]> {
  const today = todayStr()
  const weekday = weekdayOf(new Date())
  const content = buildQuickAddPrompt(text, today, weekday, mode)
  const out = await complete({
    model: 'gemini-2.5-flash',
    messages: [{ role: 'user', content }],
    source: 'quick-add',
  })
  const arr = parseJsonArray<unknown>(out)
  if (!arr) return []
  return arr
    .map((o) => toDraft(o, mode, today))
    .filter((d): d is ParsedDraft => d !== null)
}
