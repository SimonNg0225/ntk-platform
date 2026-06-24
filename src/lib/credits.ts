import { PLANS, type PlanId } from './billing'

// ============================================================
//  AI 點數制（pricing 機制核心）
//  ------------------------------------------------------------
//  每個 AI 動作按成本扣「點」；每層每月有個點數池（見 billing.ts
//  monthlyCredits）。1 點 ≈ HK$0.023；付費層「池 × 點價 ≤ 月費 30%」。
//  扣點：標準文字生成 1 點、簡報 3 點、🎙️錄音 16 點；用 Pro 高階模型 ×4。
//  免費層 30 點純試用（goodwill；唔受 30% 規則限）。
//
//  ⚠️ 呢度係前端計量 / UX（顯示餘額、唔夠就擋）。最終權威額度
//  喺後端 Supabase「gemini」Edge Function（按 user 月度計）。
// ============================================================

/** 1 點對應嘅 AI 成本（HKD）。 */
export const CREDIT_HKD = 0.023

/** 特定 source / feature 嘅每次扣點（其餘 → DEFAULT_COST）。 */
const COST_BY_KEY: Record<string, number> = {
  slides: 3, // 簡報生成（大 prompt + 多 slide 輸出）
  transcribe: 16, // 🎙️ 錄音轉文字（audio，最貴）
}
/** 標準文字生成（教案 / 出題 / DSE / 評分準則 / 文件摘要…）。 */
export const DEFAULT_COST = 1
/** 用 Pro 高階模型嘅倍率。 */
export const PRO_MODEL_MULTIPLIER = 4

export interface ChargeContext {
  /** 用量標籤（如 'slides' / 'dse-drill' / 'lessons'）。 */
  source?: string
  /** 額度分流（'transcribe' = 錄音）。 */
  feature?: string
  /** AI 模型 id（'gemini-2.5-pro' 高階模型 ×4 點）。 */
  model?: string
}

/** 一次 AI 動作扣幾多點。 */
export function creditCost(ctx: ChargeContext): number {
  const key = ctx.feature === 'transcribe' ? 'transcribe' : (ctx.source ?? '')
  const base = COST_BY_KEY[key] ?? DEFAULT_COST
  const mult = ctx.model === 'gemini-2.5-pro' ? PRO_MODEL_MULTIPLIER : 1
  return base * mult
}

/** 某層每月點數池。 */
export function monthlyCredits(plan: PlanId): number {
  return PLANS.find((p) => p.id === plan)?.monthlyCredits ?? 0
}

// ───── 本機月度用量帳（UX 計量；後端先係權威）─────
const LEDGER_KEY = 'ntk.ai_credits'

interface Ledger {
  month: string // YYYY-M
  used: number
}

function thisMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}`
}

// 記憶體鏡：localStorage 喺測試 / 私隱模式可能唔可靠，記憶體保證同程序內一致。
let memLedger: Ledger | null = null

function readLedger(): Ledger {
  if (memLedger && memLedger.month === thisMonth()) return memLedger
  try {
    const raw = localStorage.getItem(LEDGER_KEY)
    if (raw) {
      const l = JSON.parse(raw) as Ledger
      if (l && l.month === thisMonth() && typeof l.used === 'number') {
        memLedger = l
        return l
      }
    }
  } catch {
    /* ignore */
  }
  memLedger = { month: thisMonth(), used: 0 }
  return memLedger
}

function writeLedger(l: Ledger): void {
  memLedger = l
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(l))
  } catch {
    /* ignore */
  }
}

/** 今個月已用點數（自動按月重置）。 */
export function creditsUsed(): number {
  return readLedger().used
}

/** 重設本機月度帳（換月 / 測試）。 */
export function resetCreditsLedger(): void {
  writeLedger({ month: thisMonth(), used: 0 })
}

/** 某層今個月剩餘點數。 */
export function creditsRemaining(plan: PlanId): number {
  return Math.max(0, monthlyCredits(plan) - creditsUsed())
}

/** 夠唔夠點做呢個動作。 */
export function canAfford(plan: PlanId, ctx: ChargeContext): boolean {
  return creditsRemaining(plan) >= creditCost(ctx)
}

/**
 * 扣一次點。夠就扣並回傳 ok:true；唔夠回傳 ok:false（唔扣）。
 * 一併回傳今次成本同扣完之後嘅餘額。
 */
export function chargeCredits(
  plan: PlanId,
  ctx: ChargeContext,
): { ok: boolean; cost: number; remaining: number } {
  const cost = creditCost(ctx)
  const l = readLedger()
  const remaining = monthlyCredits(plan) - l.used
  if (remaining < cost) return { ok: false, cost, remaining: Math.max(0, remaining) }
  const next: Ledger = { month: l.month, used: l.used + cost }
  writeLedger(next)
  return { ok: true, cost, remaining: monthlyCredits(plan) - next.used }
}

// ───── 當前用戶層（由 useSubscription 同步，畀非 React 嘅 aiClient 讀）─────
let activePlan: PlanId = 'free'

/** 由訂閱狀態同步當前層（見 useSubscription）。 */
export function setActivePlan(plan: PlanId): void {
  activePlan = plan
}

/** 當前層（aiClient 計量用）。 */
export function getActivePlan(): PlanId {
  return activePlan
}
