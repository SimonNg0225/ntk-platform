import { complete, type AIModel } from '../../../lib/aiClient'
import { extractJsonArray } from '../../../lib/aiJson'
import type { Difficulty } from '../../../data/types'
import { DIFF_LABEL } from '../questionbank/util'

// ============================================================
//  教材生成共用引擎（materialGen/engine）
//  ------------------------------------------------------------
//  由題庫（QuestionBank）原有 AI 出題流程抽出嚟嘅共用 module：
//    buildPrompt → complete() → extractJsonArray → parseDrafts
//  支援 4 種 kind：mc / short / long / case，全部產出 GenDraft，
//  GenDraft 同 Question model 相容，可直接 spread 入 questionsCol.add。
//
//  · mc / short：行為同題庫原本完全一致（題庫 inline 出題沿用呢度）。
//  · long（結構式長題）／case（個案）：AI 回多部分 JSON，parse 時把
//    parts 嘅小題平鋪入 stem（題幹／情境 + 換行 + "(a) … (b) …"），
//    marking scheme 入 answer，marks 為總分 —— 維持 Question model 不變
//    （YAGNI，唔加新欄）。
//
//  本檔純邏輯，唔 import 任何 React / UI。
// ============================================================

/** 生成題型；同 QuestionType 完全一致，方便直接落 questionsCol */
export type GenKind = 'mc' | 'short' | 'long' | 'case'

/**
 * 生成草稿。欄位刻意對齊 Question model（type / stem / options /
 * answerIndex / answer / marks），令呼叫端可以
 *   questionsCol.add({ ...draft, topicId, difficulty, createdAt, source })
 * 直接落地（topicId / difficulty / createdAt / source 由呼叫端補）。
 */
export interface GenDraft {
  type: GenKind
  stem: string
  options?: string[] // mc 用
  answerIndex?: number // mc 正確答案（0-based）
  answer?: string // 非 mc 參考答案 / marking scheme
  marks?: number
}

export interface GenOptions {
  topicName: string
  difficulty: Difficulty
  count: number
  extra: string
  model?: AIModel
}

const DEFAULT_MODEL: AIModel = 'gemini-2.5-flash'

// 題型中文標籤（prompt 內用；對齊題庫 TYPE_LABEL 但本檔自含一份簡短描述）
const KIND_WORD: Record<GenKind, string> = {
  mc: '選擇題（MC）',
  short: '短答題',
  long: '結構式長題目',
  case: '教學個案（case study）',
}

// ───────── buildPrompt ─────────
// 每個 kind 要 AI 回唔同 shape 嘅 JSON 陣列；全部繁中、貼香港高中 BAFS，
// 並明確要求「只回 JSON 陣列、陣列以外冇任何文字」。
export function buildPrompt(
  kind: GenKind,
  topicName: string,
  opts: { difficulty: Difficulty; count: number; extra: string },
): string {
  const diffWord = DIFF_LABEL[opts.difficulty]
  const extra = opts.extra.trim()

  let shape: string
  switch (kind) {
    case 'mc':
      shape =
        '{ "stem": "題幹", "options": ["選項A", "選項B", "選項C", "選項D"], "answerIndex": 0, "marks": 1 }（answerIndex 由 0 起，指向正確選項；至少 3 個選項）'
      break
    case 'short':
      shape = '{ "stem": "題幹", "answer": "參考答案", "marks": 3 }'
      break
    case 'long':
      shape =
        '{ "stem": "題目引言／背景", "parts": [{ "label": "(a)", "q": "小題問題", "marks": 4 }, { "label": "(b)", "q": "小題問題", "marks": 6 }], "marking": "整體評分準則 / 參考答案", "marks": 10 }（parts 至少 2 個小題；marks 為各小題總分）'
      break
    case 'case':
      shape =
        '{ "scenario": "個案情境描述（香港中小企／真實商業處境）", "parts": [{ "label": "(a)", "q": "引導小題", "marks": 4 }, { "label": "(b)", "q": "引導小題", "marks": 6 }], "marking": "整體評分準則 / 參考答案" }（parts 至少 2 個引導小題）'
      break
  }

  return [
    `你係香港高中 BAFS（企業、會計與財務概論）科老師。請就課題「${topicName}」出 ${opts.count} 條${KIND_WORD[kind]}，難度為「${diffWord}」。`,
    '內容要貼合香港高中 BAFS 課程，用繁體中文。',
    kind === 'long'
      ? '長題目要分結構式小題（a / b / c…），逐小題標分，並附整體評分準則。'
      : '',
    kind === 'case'
      ? '個案要有一段完整商業情境，再附引導小題（a / b / c…），逐小題標分，並附整體評分準則。'
      : '',
    extra ? `額外要求：${extra}` : '',
    '',
    `只回一個 JSON 陣列（唔好有任何解釋文字、唔好 markdown），每個元素格式：${shape}`,
    '陣列以外唔好有任何文字。',
  ]
    .filter(Boolean)
    .join('\n')
}

// ───────── parseDrafts ─────────
// 寬鬆容錯：逐項嘗試解析；任何無效項（無題幹 / 選項不足等）一律略過。
// long / case 喺呢度做「平鋪」：把 parts 嘅小題拼入 stem，marking 入 answer。

function trimStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function numOrUndef(v: unknown): number | undefined {
  return typeof v === 'number' && v > 0 ? v : undefined
}

interface RawPart {
  label?: unknown
  q?: unknown
  marks?: unknown
}

// 把 parts 平鋪成多行字串："(a) 問題  (4 分)"，並回傳小題分數總和
function flattenParts(parts: unknown): { text: string; totalMarks: number } {
  if (!Array.isArray(parts)) return { text: '', totalMarks: 0 }
  const lines: string[] = []
  let total = 0
  parts.forEach((p, i) => {
    if (typeof p !== 'object' || p === null) return
    const o = p as RawPart
    const q = trimStr(o.q)
    if (!q) return
    const label = trimStr(o.label) || `(${String.fromCharCode(97 + i)})`
    const m = numOrUndef(o.marks)
    if (m) total += m
    lines.push(m ? `${label} ${q}（${m} 分）` : `${label} ${q}`)
  })
  return { text: lines.join('\n'), totalMarks: total }
}

function parseOne(kind: GenKind, raw: unknown): GenDraft | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>

  if (kind === 'mc') {
    const stem = trimStr(o.stem)
    if (!stem) return null
    if (!Array.isArray(o.options)) return null
    const options = o.options
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter(Boolean)
    if (options.length < 2) return null
    const idx = typeof o.answerIndex === 'number' ? o.answerIndex : 0
    const answerIndex = idx >= 0 && idx < options.length ? idx : 0
    return {
      type: 'mc',
      stem,
      options,
      answerIndex,
      marks: numOrUndef(o.marks),
    }
  }

  if (kind === 'short') {
    const stem = trimStr(o.stem)
    if (!stem) return null
    const answer = trimStr(o.answer)
    if (!answer) return null
    return { type: 'short', stem, answer, marks: numOrUndef(o.marks) }
  }

  if (kind === 'long') {
    const lead = trimStr(o.stem)
    const { text: partsText, totalMarks } = flattenParts(o.parts)
    // 題幹 = 引言 + 換行 + 平鋪小題；至少要有其中之一
    const stem = [lead, partsText].filter(Boolean).join('\n')
    if (!stem) return null
    const answer = trimStr(o.marking) || undefined
    const marks = numOrUndef(o.marks) ?? (totalMarks > 0 ? totalMarks : undefined)
    return { type: 'long', stem, answer, marks }
  }

  // case
  const scenario = trimStr(o.scenario) || trimStr(o.stem)
  const { text: partsText, totalMarks } = flattenParts(o.parts)
  const stem = [scenario, partsText].filter(Boolean).join('\n\n')
  if (!stem) return null
  const answer = trimStr(o.marking) || trimStr(o.answer) || undefined
  const marks = numOrUndef(o.marks) ?? (totalMarks > 0 ? totalMarks : undefined)
  return { type: 'case', stem, answer, marks }
}

export function parseDrafts(kind: GenKind, raw: unknown[]): GenDraft[] {
  return raw
    .map((r) => parseOne(kind, r))
    .filter((d): d is GenDraft => d !== null)
}

// ───────── generate ─────────
// 包 complete() → extractJsonArray → parseDrafts。任何錯誤照樣 throw（呼叫端
// 用 try/catch + toast）；extractJsonArray 失敗會 throw 友善中文 Error。
export async function generate(
  kind: GenKind,
  opts: GenOptions,
): Promise<GenDraft[]> {
  const out = await complete({
    model: opts.model ?? DEFAULT_MODEL,
    messages: [
      {
        role: 'user',
        content: buildPrompt(kind, opts.topicName, {
          difficulty: opts.difficulty,
          count: opts.count,
          extra: opts.extra,
        }),
      },
    ],
  })
  const rows = extractJsonArray<unknown>(out)
  return parseDrafts(kind, rows)
}
