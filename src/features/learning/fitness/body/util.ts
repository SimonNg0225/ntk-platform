import type { BodyEntry, MetricKey } from './types'
import { toKey, addDays, daysBetween } from '../common'

// ============================================================
//  體態數據統計引擎（純函式；本地時區 key，避開 toISOString UTC 漂移）
//  ------------------------------------------------------------
//  全部聚合對「無資料 / 除零 / 缺值 / 負值」有守衞，唔回 NaN / Infinity。
//  數值指標（體重 / 體脂% / 骨骼肌）用 isNum 過濾無效值；內臟脂肪係
//  等級數字，KPI 直接讀最新。
// ============================================================

/** 有限數字（擋 undefined / null / NaN / Infinity）。 */
export function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** 四捨五入到 d 位小數（守 NaN → 0）。 */
export function round(n: number, d = 1): number {
  if (!Number.isFinite(n)) return 0
  const f = 10 ** d
  return Math.round(n * f) / f
}

// ───────── 基礎組成計算 ─────────

/**
 * BMI = 體重(kg) / 身高(m)²。
 * 缺值 / 非正數（體重或身高 ≤ 0）→ null（唔回 NaN / Infinity）。
 */
export function bmi(weightKg?: number, heightCm?: number): number | null {
  if (!isNum(weightKg) || !isNum(heightCm)) return null
  if (weightKg <= 0 || heightCm <= 0) return null
  const m = heightCm / 100
  return round(weightKg / (m * m), 1)
}

/**
 * 脂肪量(kg) = 體重 × 體脂% / 100。
 * 缺值 / 體重<0 / 體脂率超出 0–100 → null。
 */
export function fatMassKg(weightKg?: number, bodyFatPct?: number): number | null {
  if (!isNum(weightKg) || !isNum(bodyFatPct)) return null
  if (weightKg < 0 || bodyFatPct < 0 || bodyFatPct > 100) return null
  return round((weightKg * bodyFatPct) / 100, 2)
}

/**
 * 瘦體重(kg) = 體重 − 脂肪量。
 * 缺值 / 無效（同 fatMassKg 守衞）→ null。
 */
export function leanMassKg(weightKg?: number, bodyFatPct?: number): number | null {
  const fat = fatMassKg(weightKg, bodyFatPct)
  if (fat === null || !isNum(weightKg)) return null
  return round(weightKg - fat, 2)
}

// ───────── 序列 / 記錄抽取 ─────────

/** 每日一條：date → entry（後者覆寫，防同日重複）。 */
export function byDate(entries: BodyEntry[]): Map<string, BodyEntry> {
  const m = new Map<string, BodyEntry>()
  for (const e of entries) m.set(e.date, e)
  return m
}

/** 某指標有效記錄（日期升序、值為有限數字）。 */
export function entriesOf(
  entries: BodyEntry[],
  field: MetricKey,
): { date: string; value: number }[] {
  return entries
    .map((e) => ({ date: e.date, value: e[field] }))
    .filter((e): e is { date: string; value: number } => isNum(e.value))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/** 最新一筆該指標（無 → null）。 */
export function latestEntry(
  entries: BodyEntry[],
  field: MetricKey,
): { date: string; value: number } | null {
  const e = entriesOf(entries, field)
  return e.length ? e[e.length - 1] : null
}

/**
 * 近 n 日逐日序列（無記錄嗰日 value=null，畀折線圖斷點）。
 * 由舊到新，含 anchor 當日。days ≤ 0 → 空陣列。
 */
export function seriesOf(
  entries: BodyEntry[],
  field: MetricKey,
  days: number,
  anchor: Date = new Date(),
): { date: string; value: number | null }[] {
  if (!Number.isFinite(days) || days <= 0) return []
  const map = byDate(entries)
  const out: { date: string; value: number | null }[] = []
  for (let i = Math.floor(days) - 1; i >= 0; i -= 1) {
    const date = toKey(addDays(anchor, -i))
    const v = map.get(date)?.[field]
    out.push({ date, value: isNum(v) ? v : null })
  }
  return out
}

/**
 * 某指標趨勢：最新值 + 對比約 days 日前嘅變化。
 * 取「截止日（anchor−days）或之前最近一筆」做基準；冇就用最早一筆。
 * 唔夠兩筆（基準=最新同一筆）→ delta = null。
 */
export function metricTrend(
  entries: BodyEntry[],
  field: MetricKey,
  days = 30,
  anchor: Date = new Date(),
): { latest: number; latestDate: string; delta: number | null } | null {
  const list = entriesOf(entries, field)
  if (list.length === 0) return null
  const latest = list[list.length - 1]
  const cutoff = toKey(addDays(anchor, -Math.abs(days)))
  let prev: { date: string; value: number } | undefined
  for (const e of list) {
    if (e.date <= cutoff) prev = e
  }
  if (!prev) prev = list[0]
  const delta = prev.date === latest.date ? null : round(latest.value - prev.value, 2)
  return { latest: latest.value, latestDate: latest.date, delta }
}

// ───────── 增肌減脂分析 ─────────

export type RecompVerdict =
  | 'recomp' // ↓脂肪 ↑肌肉：理想體態重組
  | 'fatLoss' // 脂肪明顯落、肌肉持平/微跌
  | 'muscleGain' // 肌肉明顯升、脂肪持平/微升
  | 'bulk' // 同升（增重期：肌肉脂肪都上）
  | 'cutLoss' // 同跌（減重期：肌肉脂肪都落）
  | 'fatGain' // ↑脂肪 ↓肌肉：最唔理想
  | 'stable' // 兩者變化都喺雜訊範圍
  | 'insufficient' // 唔夠資料（首尾任一缺體重+體脂）

export interface CompositionChange {
  /** 脂肪量變化（kg，尾−首）；缺資料 → null */
  fatDeltaKg: number | null
  /** 瘦體重變化（kg，尾−首）；缺資料 → null */
  leanDeltaKg: number | null
  /** 期間首條（有體重+體脂）日期 */
  fromDate: string | null
  /** 期間尾條日期 */
  toDate: string | null
  verdict: RecompVerdict
  /** 人話結論（中文） */
  summary: string
}

// 變化「有意義」嘅門檻（kg）：低過此值視為量度雜訊 / 持平。
const NOISE_KG = 0.3

const VERDICT_TEXT: Record<RecompVerdict, string> = {
  recomp: '理想體態重組：脂肪下降、肌肉上升 👏',
  fatLoss: '純減脂：脂肪明顯下降，肌肉大致保住',
  muscleGain: '純增肌：肌肉明顯上升，脂肪變化不大',
  bulk: '增重期：肌肉同脂肪一齊上升（正常 bulking）',
  cutLoss: '減重期：脂肪同肌肉一齊下降（留意保肌）',
  fatGain: '需調整：脂肪上升而肌肉下降',
  stable: '大致持平：脂肪同肌肉變化都喺雜訊範圍內',
  insufficient: '資料不足：需要期間首尾各一筆「體重＋體脂率」先計到',
}

/**
 * 期間身體組成變化分析（用窗內首尾兩筆「同時有體重＋體脂率」嘅記錄）。
 * 算脂肪量 / 瘦體重變化並判斷增肌減脂類型，畀人話結論。
 * 窗內不足兩筆完整記錄 → verdict 'insufficient'，delta = null。
 */
export function compositionChange(
  entries: BodyEntry[],
  days: number,
  anchor: Date = new Date(),
): CompositionChange {
  const empty: CompositionChange = {
    fatDeltaKg: null,
    leanDeltaKg: null,
    fromDate: null,
    toDate: null,
    verdict: 'insufficient',
    summary: VERDICT_TEXT.insufficient,
  }
  if (!Number.isFinite(days) || days <= 0) return empty

  // 窗：[anchor−(days−1), anchor]（含當日），只收同時有體重+體脂嘅完整記錄。
  const startKey = toKey(addDays(anchor, -(Math.floor(days) - 1)))
  const endKey = toKey(anchor)
  const complete = entries
    .filter((e) => e.date >= startKey && e.date <= endKey)
    .filter((e) => isNum(e.weightKg) && isNum(e.bodyFatPct))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  if (complete.length < 2) return empty
  const first = complete[0]
  const last = complete[complete.length - 1]

  const fatFrom = fatMassKg(first.weightKg, first.bodyFatPct)
  const fatTo = fatMassKg(last.weightKg, last.bodyFatPct)
  const leanFrom = leanMassKg(first.weightKg, first.bodyFatPct)
  const leanTo = leanMassKg(last.weightKg, last.bodyFatPct)
  if (fatFrom === null || fatTo === null || leanFrom === null || leanTo === null) {
    return empty
  }

  const fatDeltaKg = round(fatTo - fatFrom, 2)
  const leanDeltaKg = round(leanTo - leanFrom, 2)
  const verdict = classifyRecomp(fatDeltaKg, leanDeltaKg)

  return {
    fatDeltaKg,
    leanDeltaKg,
    fromDate: first.date,
    toDate: last.date,
    verdict,
    summary: VERDICT_TEXT[verdict],
  }
}

/** 由脂肪 / 瘦體重變化判斷重組類型（門檻 NOISE_KG）。 */
export function classifyRecomp(fatDeltaKg: number, leanDeltaKg: number): RecompVerdict {
  const fatDown = fatDeltaKg <= -NOISE_KG
  const fatUp = fatDeltaKg >= NOISE_KG
  const leanUp = leanDeltaKg >= NOISE_KG
  const leanDown = leanDeltaKg <= -NOISE_KG

  if (fatDown && leanUp) return 'recomp'
  if (fatUp && leanDown) return 'fatGain'
  if (fatDown && leanDown) return 'cutLoss'
  if (fatUp && leanUp) return 'bulk'
  if (fatDown) return 'fatLoss' // 脂肪落、肌肉持平
  if (leanUp) return 'muscleGain' // 肌肉升、脂肪持平
  return 'stable'
}

// ───────── 目標體重：進度 + 達標預計 ─────────

export interface GoalProgress {
  /** 進度百分比（0–100，已 clamp）；起點=目標 或 缺資料 → null */
  pct: number | null
  /** 已行幾多 kg（current − start，帶號）；缺資料 → null */
  movedKg: number | null
  /** 仲差幾多 kg 到目標（target − current，帶號）；缺資料 → null */
  remainingKg: number | null
  /** 係咪減重目標（target < start）；起點=目標 → null */
  losing: boolean | null
  /** 係咪已達標（朝目標方向行到或越過）。 */
  reached: boolean
}

/**
 * 目標體重進度（起點 → 目標 嘅完成 %）。
 * pct = (current − start) / (target − start) × 100，朝目標方向行為正。
 * 守衞：缺值 → null；起點=目標（除零）→ pct=null + reached 依 current 判斷。
 * pct clamp 落 0–100（行過頭當 100、行反方向當 0）。
 */
export function goalProgress(
  current?: number,
  start?: number,
  target?: number,
): GoalProgress {
  const empty: GoalProgress = {
    pct: null,
    movedKg: null,
    remainingKg: null,
    losing: null,
    reached: false,
  }
  if (!isNum(current) || !isNum(start) || !isNum(target)) return empty

  const movedKg = round(current - start, 2)
  const remainingKg = round(target - current, 2)
  const denom = target - start

  // 起點＝目標：無範圍可量度進度（除零守衞）。當 current 已達該值即 reached。
  if (denom === 0) {
    return { pct: null, movedKg, remainingKg, losing: null, reached: current === target }
  }

  const losing = target < start
  // 朝目標方向行幾多比例（行反方向 → 負；行過頭 → >1）。
  const raw = (current - start) / denom
  const pct = round(Math.max(0, Math.min(1, raw)) * 100, 1)
  // 達標 = 朝目標方向行到或越過（減重 current≤target；增重 current≥target）。
  const reached = losing ? current <= target : current >= target
  return { pct, movedKg, remainingKg, losing, reached }
}

/**
 * 近 days 日體重變化速率（kg / 週）。
 * 用窗內首尾兩筆有效體重做線性斜率：(末−首) / 週數。
 * 唔夠兩筆 / 首尾同日（除零）/ 無效 → null（唔亂回 NaN）。
 */
export function weightRateKgPerWeek(
  entries: BodyEntry[],
  days = 30,
  anchor: Date = new Date(),
): number | null {
  if (!Number.isFinite(days) || days <= 0) return null
  const startKey = toKey(addDays(anchor, -(Math.floor(days) - 1)))
  const endKey = toKey(anchor)
  const list = entriesOf(entries, 'weightKg').filter(
    (e) => e.date >= startKey && e.date <= endKey,
  )
  if (list.length < 2) return null
  const first = list[0]
  const last = list[list.length - 1]
  const dayGap = daysBetween(first.date, last.date)
  if (dayGap <= 0) return null // 首尾同日 → 無斜率（除零守衞）
  const perDay = (last.value - first.value) / dayGap
  return round(perDay * 7, 3)
}

export interface GoalEta {
  /** 預計達標日期 key（YYYY-MM-DD，本地）；推唔到 → null */
  dateKey: string | null
  /** 距今仲要幾多日；推唔到 → null */
  daysAway: number | null
  /** 用緊嘅速率（kg/週，帶號）；推唔到 → null */
  rateKgPerWeek: number | null
  /** 已達標（唔使再推）。 */
  reached: boolean
}

/**
 * 達標預計日：用近期體重速率線性外推到目標體重。
 * - 已達標（朝目標方向到/越過）→ reached=true，dateKey=null（唔使推）。
 * - 速率 0 / 朝遠離目標方向 / 無速率 → 全 null（唔亂推一個假日期）。
 * - 否則 daysAway = ceil(|remaining| / |perDay|)，由 anchor 加返。
 */
export function projectedGoalDate(
  entries: BodyEntry[],
  target?: number,
  days = 30,
  anchor: Date = new Date(),
): GoalEta {
  const empty: GoalEta = { dateKey: null, daysAway: null, rateKgPerWeek: null, reached: false }
  if (!isNum(target)) return empty

  const latest = latestEntry(entries, 'weightKg')
  if (!latest) return empty
  const current = latest.value
  const remaining = target - current // 帶號：>0 要升、<0 要減

  // 已達標（差距收窄到 0 / 越過）→ reached，唔使推日期。
  if (remaining === 0) return { ...empty, reached: true }

  const rateKgPerWeek = weightRateKgPerWeek(entries, days, anchor)
  if (rateKgPerWeek === null || rateKgPerWeek === 0) return empty
  const perDay = rateKgPerWeek / 7

  // 速率方向同「要去嘅方向」相反 → 永遠到唔到，唔亂外推。
  // （remaining>0 要升但 perDay<0；remaining<0 要減但 perDay>0）
  if (Math.sign(perDay) !== Math.sign(remaining)) return empty

  const daysAway = Math.max(1, Math.ceil(Math.abs(remaining) / Math.abs(perDay)))
  if (!Number.isFinite(daysAway)) return empty
  const dateKey = toKey(addDays(anchor, daysAway))
  return { dateKey, daysAway, rateKgPerWeek, reached: false }
}

// ───────── 脂肪量 vs 瘦體重 雙線序列 ─────────

export interface RecompPoint {
  date: string
  /** 脂肪量（kg）；嗰日缺體重或體脂 → null（折線斷點） */
  fat: number | null
  /** 瘦體重（kg）；同上 → null */
  lean: number | null
}

/**
 * 近 n 日「脂肪量 vs 瘦體重」逐日雙線序列（同一時間軸）。
 * 每日需同時有體重＋體脂先計到；缺一即該日兩線皆 null（斷點）。
 * 由舊到新，含 anchor 當日。days ≤ 0 → 空陣列。
 */
export function recompSeries(
  entries: BodyEntry[],
  days: number,
  anchor: Date = new Date(),
): RecompPoint[] {
  if (!Number.isFinite(days) || days <= 0) return []
  const map = byDate(entries)
  const out: RecompPoint[] = []
  for (let i = Math.floor(days) - 1; i >= 0; i -= 1) {
    const date = toKey(addDays(anchor, -i))
    const row = map.get(date)
    const fat = row ? fatMassKg(row.weightKg, row.bodyFatPct) : null
    const lean = row ? leanMassKg(row.weightKg, row.bodyFatPct) : null
    out.push({ date, fat, lean })
  }
  return out
}

// ───────── BMI 分類（WHO 亞洲成人通用閾值的近似） ─────────

export type BmiBand = 'low' | 'normal' | 'high' | 'obese'

export interface BmiInfo {
  band: BmiBand
  label: string
}

/** BMI 分級（缺值 → null）。閾值：<18.5 過輕 / <24 正常 / <27 過重 / ≥27 肥胖。 */
export function bmiBand(value: number | null): BmiInfo | null {
  if (value === null || !isNum(value)) return null
  if (value < 18.5) return { band: 'low', label: '過輕' }
  if (value < 24) return { band: 'normal', label: '正常' }
  if (value < 27) return { band: 'high', label: '過重' }
  return { band: 'obese', label: '肥胖' }
}

// ───────── 格式化 ─────────

/** 'YYYY-MM-DD' → 「5月23日」（去前導零）。非法 → 原字串。 */
export function fmtDate(key: string): string {
  const parts = key.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return key
  return `${parts[1]}月${parts[2]}日`
}

/** 帶正負號數值（+1.2 / -0.5 / 0），守 NaN → '—'。 */
export function fmtDelta(n: number | null, unit = '', digits = 1): string {
  if (n === null || !Number.isFinite(n)) return '—'
  const r = round(n, digits)
  const sign = r > 0 ? '+' : '' // 負數本身帶 '-'
  return `${sign}${r}${unit}`
}

/** 趨勢方向（用於 StatCard trend.dir）。 */
export function deltaDir(n: number | null): 'up' | 'down' | 'flat' {
  if (n === null || !Number.isFinite(n) || n === 0) return 'flat'
  return n > 0 ? 'up' : 'down'
}
