// ============================================================
//  AI 再潤飾 — 可選 structure-level pass（用戶㩒掣先觸發）
//  ------------------------------------------------------------
//  把整套 deck 餵 flash，要求同 schema 出改良版（只結構／文案優化）。
//  落地必經 parseDeck 校驗 + title 守原 + slides 縮水防呆 + 可還原。
//  唔自動、唔阻 P3 主生成（獨立入口）。
// ============================================================

import type { Deck } from '../../../lib/export/types'
import type { SlidePackId } from '../../../lib/export'
import { complete, type AIModel } from '../../../lib/aiClient'
import { parseDeck } from './slidePrompts'

/** 結構潤飾指引（聚焦結構問題，唔重抄 slidePrompts 全本 playbook）。 */
const REFINE_PLAYBOOK: string[] = [
  '結論先行：弱標題（「XX 簡介／概述」式）改成有觀點、有資訊量嘅標題。',
  '太逼就拆：一版超過 5 點，拆做兩版，或升做 stats / steps / cards 等版式。',
  '版式有節奏：避免連續 3 版都係 bullets — 適度改用 stats（數據）、compare（對比）、steps（流程）、cards（並列）、quote（金句）。',
  '輕重分明：全套揀 1-2 版最關鍵嘅標 emphasis:true（高潮版），其餘唔好亂標。',
  '關鍵版補 takeaway：一句 ≤46 字嘅包底重點，幫聽眾記住。',
  '每點精煉 ≤60 字、每版 ≤6 點；stats 2-4 項、steps 2-5 步、cards 2-6 張、compare 每邊 2-4 點。',
]

/** 由 pack 帶入版式偏好（輕量，唔重抄 slidePrompts 嘅 PACK_FAVORS）。 */
function packHint(pack?: SlidePackId): string {
  if (!pack) return ''
  return `\n· 目標模板：${pack}。可按此模板特性適度選用合適版式。`
}

export function buildRefineSystem(subjectName?: string, pack?: SlidePackId): string {
  const subj = subjectName ? `本套簡報科目：${subjectName}。` : ''
  return [
    '你係資深教學簡報設計師。輸入係一套完整簡報嘅 JSON（schema 同生成時一致）。',
    `${subj}你嘅工作：只做結構同文案優化，令簡報更清晰、更有節奏。`,
    '',
    '潤飾指引：',
    ...REFINE_PLAYBOOK.map((l) => `· ${l}`),
    packHint(pack),
    '',
    '硬規則：',
    '· 唔可以作新事實／新數據（只可重組、收緊文字、調版式）。',
    '· 唔可以改 deck.title 嘅主題。',
    '· 版數可微調，但唔好大幅增減（保持原本規模）。',
    '· 輸出必須係同 schema 嘅完整 deck JSON：{title, subtitle?, coverImageQuery?, slides:[...]}。',
    '· 只輸出 JSON，唔好有任何前後文字、唔好用 markdown fence。',
  ].join('\n')
}

/**
 * 跑一次結構潤飾 pass。網路喺 complete、校驗喺 parseDeck（throw 就照拋畀 UI）。
 * 預設用 flash（structure pass 唔需要 pro）。
 */
export async function refineDeck(
  deck: Deck,
  opts: { subjectName?: string; pack?: SlidePackId; model?: AIModel; signal?: AbortSignal } = {},
): Promise<Deck> {
  const raw = await complete({
    system: buildRefineSystem(opts.subjectName, opts.pack),
    messages: [{ role: 'user', content: JSON.stringify(deck) }],
    model: opts.model ?? 'gemini-2.5-flash',
    temperature: 0.4,
    source: 'slides',
    signal: opts.signal,
  })
  return parseDeck(raw, deck.title)
}

/**
 * 保守 merge：title 永遠以 original 為準（防 refine 改走主題）；
 * coverImageQuery 若 refined 冇出就保留 original；slides 大幅縮水（<50%）就拒絕、保留原樣。
 * 純 logic（vitest 重點）。
 */
export function mergeRefinedDeck(original: Deck, refined: Deck): Deck {
  // 縮水防呆：refined 版數少過原本一半 → 唔採納 slides（其餘照原樣）
  const tooFewSlides = refined.slides.length < Math.ceil(original.slides.length * 0.5)
  const slides = tooFewSlides || refined.slides.length === 0 ? original.slides : refined.slides
  return {
    title: original.title, // 主題守原
    subtitle: refined.subtitle ?? original.subtitle,
    slides,
    coverImageQuery: refined.coverImageQuery ?? original.coverImageQuery,
  }
}
