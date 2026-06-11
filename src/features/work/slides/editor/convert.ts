import type {
  Slide,
  SlideCard,
  SlideLayout,
  SlideStat,
  SlideStep,
} from '../../../../lib/export/types'

// ============================================================
//  版式互轉 — 規則預填（純函式，可單元測試）
//  ------------------------------------------------------------
//  轉版式時即時用規則將現有內容搬入新結構（離線、零 AI），用戶再手執；
//  唔靚可以再㩒「AI 幫我轉」（slideAi.aiConvertSlide）。
//  約定：任何版式先攤平做 lines[]，再按目標版式入結構；
//  bullets 永遠保留做後備（引擎 fallback／講義用）；
//  舊結構欄位清走、其他欄位（notes/chart/imageQuery/subtitle/takeaway/emphasis）唔郁。
// ============================================================

export type ConvertResult =
  | { ok: true; slide: Slide }
  | { ok: false; reason: string }

function clamp(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, Math.max(0, max - 1)) + '…'
}

/** 以「：/—/-」第一個分隔將一行斬做 題/說明。 */
function splitLine(line: string): { head: string; rest?: string } {
  const m = line.match(/^(.+?)[：:—-]\s*(.+)$/)
  if (m && m[1].trim() && m[2].trim()) return { head: m[1].trim(), rest: m[2].trim() }
  return { head: line.trim() }
}

/**
 * 將現有版式內容攤平做 lines[]（轉換用嘅內容池）。
 * 結構欄位同後備 bullets 兩個池都睇，揀**較豐富**嗰個（行數多者）——
 * 例如卡片版得 2 張卡但 bullets 有 4 點，轉對比版就應該用 bullets。
 */
export function flattenSlide(s: Slide): string[] {
  let structured: string[] = []
  switch (s.layout) {
    case 'stats':
      structured = (s.stats ?? []).map((it) => `${it.label}：${it.value}`)
      break
    case 'compare':
      structured = s.compare ? [...s.compare.left, ...s.compare.right] : []
      break
    case 'steps':
      structured = (s.steps ?? []).map((it) => (it.desc ? `${it.title}：${it.desc}` : it.title))
      break
    case 'quote':
      structured = s.quote
        ? s.quote.attribution
          ? [s.quote.text, s.quote.attribution]
          : [s.quote.text]
        : []
      break
    case 'cards':
      structured = (s.cards ?? []).map((it) => (it.desc ? `${it.title}：${it.desc}` : it.title))
      break
  }
  const pool = s.bullets.length > structured.length ? [...s.bullets] : structured
  if (pool.length > 0) return pool
  return s.title ? [s.title] : []
}

/** 清走所有結構欄位嘅底版（保留共通欄位）。 */
function baseSlide(s: Slide): Slide {
  return {
    title: s.title,
    subtitle: s.subtitle,
    bullets: s.bullets,
    notes: s.notes,
    chart: s.chart,
    takeaway: s.takeaway,
    imageQuery: s.imageQuery,
    emphasis: s.emphasis,
    layout: undefined,
    stats: undefined,
    compare: undefined,
    steps: undefined,
    quote: undefined,
    cards: undefined,
  }
}

/** 行 → stat：抽第一個數字 token（$1,200／75%／2100萬…）做 value，剩餘做 label；冇數字 value='—'。 */
function lineToStat(line: string): SlideStat {
  const m = line.match(/[$＄]?\d[\d,.]*\s?[%％萬億千]?/)
  if (!m) return { value: '—', label: clamp(line.trim(), 20) }
  const value = m[0].replace(/\s+/g, '')
  const label = line.replace(m[0], '').replace(/[：:，,。]/g, ' ').replace(/\s+/g, ' ').trim()
  return { value: clamp(value, 8), label: clamp(label || line.trim(), 20) }
}

/**
 * 規則轉版式。內容唔夠（例如 steps/compare 嘅最低項數）→ { ok:false, reason }，
 * caller 保持原版式並提示。
 */
export function convertSlide(s: Slide, target: SlideLayout): ConvertResult {
  const lines = flattenSlide(s)
  const base = baseSlide(s)
  // 轉完之後 bullets 一律保留攤平內容做後備（section 除外）。
  const backup = lines.slice(0, 6).map((l) => clamp(l, 60))

  switch (target) {
    case 'bullets': {
      if (lines.length === 0) return { ok: false, reason: '呢版冇內容可以做要點' }
      return { ok: true, slide: { ...base, bullets: backup } }
    }
    case 'section': {
      return { ok: true, slide: { ...base, bullets: [], layout: 'section' } }
    }
    case 'steps': {
      if (lines.length < 2) return { ok: false, reason: '步驟版至少要 2 行內容' }
      const headLines = lines.slice(0, 5)
      const overflow = lines.slice(5)
      const steps: SlideStep[] = headLines.map((l) => {
        const { head, rest } = splitLine(l)
        return { title: clamp(head, 12), desc: rest ? clamp(rest, 40) : undefined }
      })
      if (overflow.length > 0) {
        const last = steps[steps.length - 1]
        const merged = [last.desc, ...overflow].filter(Boolean).join('；')
        steps[steps.length - 1] = { ...last, desc: clamp(merged, 40) }
      }
      return { ok: true, slide: { ...base, bullets: backup, layout: 'steps', steps } }
    }
    case 'cards': {
      if (lines.length < 2) return { ok: false, reason: '卡片版至少要 2 行內容' }
      const cards: SlideCard[] = lines.slice(0, 6).map((l) => {
        const { head, rest } = splitLine(l)
        return { title: clamp(head, 12), desc: rest ? clamp(rest, 36) : undefined }
      })
      return { ok: true, slide: { ...base, bullets: backup, layout: 'cards', cards } }
    }
    case 'stats': {
      if (lines.length < 2) return { ok: false, reason: '數據版至少要 2 行內容' }
      const stats = lines.slice(0, 4).map(lineToStat)
      return { ok: true, slide: { ...base, bullets: backup, layout: 'stats', stats } }
    }
    case 'compare': {
      if (lines.length < 4) return { ok: false, reason: '對比版至少要 4 行內容（兩邊各 2 點）' }
      const mid = Math.ceil(lines.length / 2)
      const side = (arr: string[]) => arr.slice(0, 4).map((l) => clamp(l, 30))
      return {
        ok: true,
        slide: {
          ...base,
          bullets: backup,
          layout: 'compare',
          compare: {
            leftTitle: '甲',
            rightTitle: '乙',
            left: side(lines.slice(0, mid)),
            right: side(lines.slice(mid)),
          },
        },
      }
    }
    case 'quote': {
      if (lines.length === 0) return { ok: false, reason: '金句版要至少 1 行內容' }
      return {
        ok: true,
        slide: {
          ...base,
          bullets: backup,
          layout: 'quote',
          quote: { text: clamp(lines[0], 60), attribution: lines[1] ? clamp(lines[1], 20) : undefined },
        },
      }
    }
  }
}
