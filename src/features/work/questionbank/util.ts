import type { Difficulty, Question, QuestionType } from '../../../data/types'

// ============================================================
//  BAFS 題庫核心工具（純邏輯，零 UI / 零依賴）
//  ------------------------------------------------------------
//  - 標籤 / 排序對照
//  - 難度加權 / 統計
//  - 課題覆蓋矩陣（雙向交叉表）
//  - 試卷藍圖自動組卷（blueprint auto-assembly）
//  - 重複題偵測（標準化 + 相似度）
//  - CSV 匯入 / 匯出（零依賴 parser）
// ============================================================

// ───────── 標籤 / 樣式對照 ─────────
export const TYPE_LABEL: Record<QuestionType, string> = {
  mc: '選擇題',
  short: '短答題',
  long: '長題目',
  case: '個案',
}
export const TYPE_ORDER: QuestionType[] = ['mc', 'short', 'long', 'case']

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
// 難度權重（用嚟計「卷面難度指數」0–100）
export const DIFF_WEIGHT: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
}

// 圖表 / chip 用嘅難度色（fill / bg 用 currentColor 或直接 class）
export const DIFF_FILL: Record<Difficulty, string> = {
  easy: 'text-emerald-500',
  medium: 'text-amber-500',
  hard: 'text-rose-500',
}
export const TYPE_FILL: Record<QuestionType, string> = {
  mc: 'text-blue-500',
  short: 'text-accent',
  long: 'text-violet-500',
  case: 'text-cyan-500',
}

// ───────── 排序 ─────────
export type SortKey = 'new' | 'old' | 'marksDesc' | 'marksAsc' | 'difficulty'

export const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'new', label: '最新優先' },
  { id: 'old', label: '最舊優先' },
  { id: 'marksDesc', label: '分數高→低' },
  { id: 'marksAsc', label: '分數低→高' },
  { id: 'difficulty', label: '難度易→難' },
]

export function sortQuestions(list: Question[], key: SortKey): Question[] {
  const arr = [...list]
  switch (key) {
    case 'old':
      return arr.sort((a, b) =>
        a.createdAt === b.createdAt ? 0 : a.createdAt < b.createdAt ? -1 : 1,
      )
    case 'marksDesc':
      return arr.sort((a, b) => (b.marks ?? 0) - (a.marks ?? 0))
    case 'marksAsc':
      return arr.sort((a, b) => (a.marks ?? 0) - (b.marks ?? 0))
    case 'difficulty':
      return arr.sort(
        (a, b) => DIFF_WEIGHT[a.difficulty] - DIFF_WEIGHT[b.difficulty],
      )
    case 'new':
    default:
      return arr.sort((a, b) =>
        a.createdAt === b.createdAt ? 0 : a.createdAt < b.createdAt ? 1 : -1,
      )
  }
}

// ───────── 整體統計 ─────────
export interface BankStats {
  total: number
  byType: Record<QuestionType, number>
  byDiff: Record<Difficulty, number>
  totalMarks: number
  withAnswer: number // 有參考答案 / MC（即「可即用」）
  aiCount: number // 標 source = AI 生成
  topicsCovered: number // 有題目嘅課題數
  difficultyIndex: number // 0–100，全庫平均難度
}

export function computeStats(
  questions: Question[],
  totalTopics: number,
): BankStats {
  const byType: Record<QuestionType, number> = {
    mc: 0,
    short: 0,
    long: 0,
    case: 0,
  }
  const byDiff: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 }
  const topicSet = new Set<string>()
  let totalMarks = 0
  let withAnswer = 0
  let aiCount = 0
  let weightSum = 0

  for (const q of questions) {
    byType[q.type]++
    byDiff[q.difficulty]++
    totalMarks += q.marks ?? 0
    topicSet.add(q.topicId)
    weightSum += DIFF_WEIGHT[q.difficulty]
    if (q.type === 'mc' ? typeof q.answerIndex === 'number' : !!q.answer?.trim())
      withAnswer++
    if (q.source?.includes('AI')) aiCount++
  }

  const n = questions.length
  // 把平均權重（1–3）映射去 0–100
  const difficultyIndex = n > 0 ? Math.round(((weightSum / n - 1) / 2) * 100) : 0

  return {
    total: n,
    byType,
    byDiff,
    totalMarks,
    withAnswer,
    aiCount,
    topicsCovered: Math.min(topicSet.size, totalTopics || topicSet.size),
    difficultyIndex,
  }
}

export function difficultyIndexLabel(idx: number): string {
  if (idx < 34) return '偏易'
  if (idx < 67) return '適中'
  return '偏難'
}

// ───────── 課題覆蓋矩陣（課題 × 難度）─────────
export interface TopicRow {
  topicId: string
  topic: string
  area: string
  total: number
  byDiff: Record<Difficulty, number>
  byType: Record<QuestionType, number>
  marks: number
}

export interface TopicLite {
  id: string
  topic: string
  area?: string
}

export function buildTopicRows(
  questions: Question[],
  topics: TopicLite[],
): TopicRow[] {
  const map = new Map<string, TopicRow>()
  for (const t of topics) {
    map.set(t.id, {
      topicId: t.id,
      topic: t.topic,
      area: t.area ?? '其他',
      total: 0,
      byDiff: { easy: 0, medium: 0, hard: 0 },
      byType: { mc: 0, short: 0, long: 0, case: 0 },
      marks: 0,
    })
  }
  for (const q of questions) {
    let row = map.get(q.topicId)
    if (!row) {
      row = {
        topicId: q.topicId,
        topic: '未分類',
        area: '未分類',
        total: 0,
        byDiff: { easy: 0, medium: 0, hard: 0 },
        byType: { mc: 0, short: 0, long: 0, case: 0 },
        marks: 0,
      }
      map.set(q.topicId, row)
    }
    row.total++
    row.byDiff[q.difficulty]++
    row.byType[q.type]++
    row.marks += q.marks ?? 0
  }
  return [...map.values()]
}

// 課題覆蓋缺口：有 0 題嘅課題（提示老師補題）
export function coverageGaps(rows: TopicRow[]): TopicRow[] {
  return rows.filter((r) => r.total === 0 && r.topic !== '未分類')
}

// ───────── 重複 / 相似題偵測 ─────────
// 標準化題幹（去標點 / 空白 / 全形）方便比對
export function normStem(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\s　]+/g, '')
    .replace(/[，。、；：？！「」『』（）()[\]{}.,;:?!"'`~\-_/\\]/g, '')
}

// 兩段標準化字串嘅 Jaccard（bigram）相似度 0–1
function bigramSet(s: string): Set<string> {
  const out = new Set<string>()
  if (s.length < 2) {
    if (s) out.add(s)
    return out
  }
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2))
  return out
}

export function similarity(a: string, b: string): number {
  const A = bigramSet(normStem(a))
  const B = bigramSet(normStem(b))
  if (A.size === 0 || B.size === 0) return a === b ? 1 : 0
  let inter = 0
  for (const g of A) if (B.has(g)) inter++
  return inter / (A.size + B.size - inter)
}

export interface DupGroup {
  questions: Question[]
  reason: 'exact' | 'similar'
  score: number // 相似度（exact = 1）
}

// 偵測重複：先抓完全相同（標準化後），再抓高相似（>= threshold）
export function findDuplicates(
  questions: Question[],
  threshold = 0.82,
): DupGroup[] {
  const groups: DupGroup[] = []
  const used = new Set<string>()

  // 1) 完全相同（同 type）
  const byNorm = new Map<string, Question[]>()
  for (const q of questions) {
    const k = `${q.type}::${normStem(q.stem)}`
    const list = byNorm.get(k)
    if (list) list.push(q)
    else byNorm.set(k, [q])
  }
  for (const list of byNorm.values()) {
    if (list.length > 1) {
      list.forEach((q) => used.add(q.id))
      groups.push({ questions: list, reason: 'exact', score: 1 })
    }
  }

  // 2) 高相似（未配對嘅之間兩兩比；O(n²) 但題庫規模可接受）
  const rest = questions.filter((q) => !used.has(q.id))
  for (let i = 0; i < rest.length; i++) {
    if (used.has(rest[i].id)) continue
    const cluster: Question[] = [rest[i]]
    for (let j = i + 1; j < rest.length; j++) {
      if (used.has(rest[j].id)) continue
      const sc = similarity(rest[i].stem, rest[j].stem)
      if (sc >= threshold) {
        cluster.push(rest[j])
        used.add(rest[j].id)
      }
    }
    if (cluster.length > 1) {
      used.add(rest[i].id)
      const sc = Math.min(
        ...cluster.slice(1).map((q) => similarity(rest[i].stem, q.stem)),
      )
      groups.push({ questions: cluster, reason: 'similar', score: sc })
    }
  }

  return groups.sort((a, b) => b.score - a.score)
}

// ───────── 試卷藍圖自動組卷 ─────────
// 老師指定每個難度想要幾題 → 由符合範圍嘅題池隨機抽，盡量平均覆蓋課題。
export interface Blueprint {
  topicIds: string[] // 空 = 全部課題
  type: '' | QuestionType // 空 = 不限題型
  counts: Record<Difficulty, number> // 每個難度要幾題
}

export const emptyBlueprint = (): Blueprint => ({
  topicIds: [],
  type: '',
  counts: { easy: 3, medium: 4, hard: 2 },
})

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface AssembleResult {
  picked: Question[]
  shortfall: Record<Difficulty, number> // 每個難度欠幾題（題池不足）
}

// 抽題：每個難度按需要抽，盡量「輪流」唔同課題（round-robin）以求平均覆蓋
export function assemblePaper(
  questions: Question[],
  bp: Blueprint,
): AssembleResult {
  const topicFilter = new Set(bp.topicIds)
  const inScope = questions.filter((q) => {
    if (bp.topicIds.length > 0 && !topicFilter.has(q.topicId)) return false
    if (bp.type && q.type !== bp.type) return false
    return true
  })

  const picked: Question[] = []
  const shortfall: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 }

  for (const diff of DIFF_ORDER) {
    const need = Math.max(0, Math.floor(bp.counts[diff] || 0))
    if (need === 0) continue
    const pool = shuffle(inScope.filter((q) => q.difficulty === diff))

    // round-robin by topic：先按課題分桶，逐輪各抽一題，做到覆蓋平均
    const buckets = new Map<string, Question[]>()
    for (const q of pool) {
      const list = buckets.get(q.topicId)
      if (list) list.push(q)
      else buckets.set(q.topicId, [q])
    }
    const order = shuffle([...buckets.keys()])
    let got = 0
    let guard = 0
    while (got < need && guard++ < 5000) {
      let any = false
      for (const tid of order) {
        if (got >= need) break
        const list = buckets.get(tid)
        if (list && list.length) {
          picked.push(list.shift() as Question)
          got++
          any = true
        }
      }
      if (!any) break
    }
    shortfall[diff] = need - got
  }

  return { picked, shortfall }
}

// ───────── CSV 匯出 / 匯入（零依賴）─────────
const CSV_HEADERS = [
  'topic', // 課題名（匯入時 fuzzy 對應，配唔到落第一個）
  'type', // mc / short / long / case 或中文
  'difficulty', // easy / medium / hard 或 易/中/難
  'stem',
  'optionA',
  'optionB',
  'optionC',
  'optionD',
  'answer', // MC：正確選項字母(A/B/C/D) 或 編號；其他：參考答案文字
  'marks',
] as const

function csvField(v: string | number | undefined): string {
  const s = v == null ? '' : String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function questionsToCsv(
  questions: Question[],
  topicName: (id: string) => string,
): string {
  const lines = [CSV_HEADERS.join(',')]
  for (const q of questions) {
    const opts = q.options ?? []
    const answer =
      q.type === 'mc'
        ? typeof q.answerIndex === 'number'
          ? String.fromCharCode(65 + q.answerIndex)
          : ''
        : (q.answer ?? '')
    lines.push(
      [
        csvField(topicName(q.topicId)),
        csvField(TYPE_LABEL[q.type]),
        csvField(DIFF_LABEL[q.difficulty]),
        csvField(q.stem),
        csvField(opts[0]),
        csvField(opts[1]),
        csvField(opts[2]),
        csvField(opts[3]),
        csvField(answer),
        csvField(q.marks),
      ].join(','),
    )
  }
  return lines.join('\n')
}

// 簡易 CSV parser（支援引號包欄位 + 逃逸雙引號 + 換行）
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  while (i < s.length) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += c
    i++
  }
  // 收尾
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''))
}

const TYPE_FROM_TEXT: Record<string, QuestionType> = {
  mc: 'mc',
  選擇題: 'mc',
  選擇: 'mc',
  short: 'short',
  短答題: 'short',
  短答: 'short',
  long: 'long',
  長題目: 'long',
  長題: 'long',
  case: 'case',
  個案: 'case',
}
const DIFF_FROM_TEXT: Record<string, Difficulty> = {
  easy: 'easy',
  易: 'easy',
  medium: 'medium',
  中: 'medium',
  hard: 'hard',
  難: 'hard',
}

export interface ParsedRow {
  topicId: string
  type: QuestionType
  difficulty: Difficulty
  stem: string
  options?: string[]
  answerIndex?: number
  answer?: string
  marks?: number
}

// 把 MC 選項去除空白項，並按壓縮後嘅新位置重新對應正確答案 index。
// 表單／AI 草稿固定渲染 A–D 四格，中間留空會令 filter 後嘅 options 同
// 原本嘅 answerIndex 錯位（出界或指向錯選項）。呢度一次過 trim + filter +
// remap，畀儲存路徑用，確保 options 同 answerIndex 永遠一致。
export function compactMcOptions(
  options: string[],
  answerIndex: number,
): { options: string[]; answerIndex: number } {
  const kept = options
    .map((o, i) => ({ o: o.trim(), i }))
    .filter((x) => x.o)
  const newIdx = kept.findIndex((x) => x.i === answerIndex)
  return {
    options: kept.map((x) => x.o),
    answerIndex: newIdx < 0 ? 0 : newIdx,
  }
}

// 把 CSV rows（含表頭）轉成可入庫嘅 ParsedRow[]，附帶被略過嘅行數
export function rowsToQuestions(
  rows: string[][],
  topics: TopicLite[],
): { parsed: ParsedRow[]; skipped: number } {
  if (rows.length === 0) return { parsed: [], skipped: 0 }
  // 偵測首行係咪表頭
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const hasHeader =
    header.includes('stem') ||
    header.includes('題目') ||
    header.includes('topic') ||
    header.includes('課題')

  const idx = (name: string, fallback: number) => {
    const k = header.indexOf(name)
    return hasHeader && k >= 0 ? k : fallback
  }
  const cTopic = idx('topic', 0)
  const cType = idx('type', 1)
  const cDiff = idx('difficulty', 2)
  const cStem = idx('stem', 3)
  const cA = idx('optiona', 4)
  const cB = idx('optionb', 5)
  const cC = idx('optionc', 6)
  const cD = idx('optiond', 7)
  const cAns = idx('answer', 8)
  const cMarks = idx('marks', 9)

  const body = hasHeader ? rows.slice(1) : rows
  const fallbackTopic = topics[0]?.id ?? ''
  const findTopic = (name: string): string => {
    const n = name.trim()
    if (!n) return fallbackTopic
    const exact = topics.find((t) => t.topic === n)
    if (exact) return exact.id
    const fuzzy = topics.find(
      (t) => t.topic.includes(n) || n.includes(t.topic),
    )
    return fuzzy?.id ?? fallbackTopic
  }

  const parsed: ParsedRow[] = []
  let skipped = 0
  for (const r of body) {
    const stem = (r[cStem] ?? '').trim()
    if (!stem) {
      skipped++
      continue
    }
    const type =
      TYPE_FROM_TEXT[(r[cType] ?? '').trim().toLowerCase()] ?? 'short'
    const difficulty =
      DIFF_FROM_TEXT[(r[cDiff] ?? '').trim().toLowerCase()] ?? 'medium'
    const topicId = findTopic(r[cTopic] ?? '')
    const marksRaw = (r[cMarks] ?? '').replace(/[^\d.]/g, '')
    const marksNum = marksRaw ? Number(marksRaw) : NaN
    const marks = Number.isFinite(marksNum) ? marksNum : undefined

    if (type === 'mc') {
      const options = [r[cA], r[cB], r[cC], r[cD]]
        .map((x) => (x ?? '').trim())
        .filter(Boolean)
      if (options.length < 2) {
        skipped++
        continue
      }
      const ansRaw = (r[cAns] ?? '').trim()
      let answerIndex = 0
      if (/^[A-Da-d]$/.test(ansRaw)) {
        answerIndex = ansRaw.toUpperCase().charCodeAt(0) - 65
      } else if (/^\d+$/.test(ansRaw)) {
        answerIndex = Math.max(0, Number(ansRaw) - 1)
      }
      if (answerIndex >= options.length) answerIndex = 0
      parsed.push({ topicId, type, difficulty, stem, options, answerIndex, marks })
    } else {
      const answer = (r[cAns] ?? '').trim() || undefined
      parsed.push({ topicId, type, difficulty, stem, answer, marks })
    }
  }
  return { parsed, skipped }
}

// CSV 範本（畀使用者下載對照）
export function csvTemplate(): string {
  return [
    CSV_HEADERS.join(','),
    '香港營商環境,選擇題,易,以下邊項屬於本港主要經濟支柱？,金融服務,農業,採礦,重工業,A,1',
    '會計原則與概念,短答題,中,試解釋「歷史成本」原則。,,,,,指資產按取得時嘅實際成本入帳。,3',
  ].join('\n')
}

// 觸發瀏覽器下載（純前端，零依賴）
export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const bom = mime.startsWith('text/csv') ? '﻿' : ''
  const blob = new Blob([bom + text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ───────── 列印（開新視窗，唔改全站 CSS）─────────
export interface PaperMeta {
  title: string
  className: string
  durationMin: string
  totalMarks: number
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// 砌一頁列印友善 HTML（含學校試卷格式），可選顯示答案
export function buildPrintHtml(
  meta: PaperMeta,
  questions: Question[],
  topicName: (id: string) => string,
  withAnswers: boolean,
): string {
  const items = questions
    .map((q, i) => {
      const head = `<div class="q"><span class="n">${i + 1}.</span><div class="body"><div class="stem">${escapeHtml(
        q.stem,
      )}${q.marks ? ` <span class="marks">(${q.marks} 分)</span>` : ''}</div>`
      let mid = ''
      if (q.type === 'mc' && q.options) {
        mid =
          '<ol class="opts">' +
          q.options
            .map((o, oi) => {
              const correct = withAnswers && oi === q.answerIndex
              return `<li class="${correct ? 'correct' : ''}">${String.fromCharCode(
                65 + oi,
              )}. ${escapeHtml(o)}${correct ? ' ✓' : ''}</li>`
            })
            .join('') +
          '</ol>'
      } else if (withAnswers && q.answer) {
        mid = `<div class="ans"><b>參考答案：</b>${escapeHtml(q.answer)}</div>`
      } else if (q.type !== 'mc') {
        // 留白作答區
        mid = '<div class="blank"></div>'
      }
      const tag = `<div class="tag">${escapeHtml(topicName(q.topicId))} · ${
        TYPE_LABEL[q.type]
      } · ${DIFF_LABEL[q.difficulty]}</div>`
      return head + mid + tag + '</div></div>'
    })
    .join('')

  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<title>${escapeHtml(meta.title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,"PingFang HK","Microsoft JhengHei",sans-serif;color:#0f172a;margin:0;padding:32px;line-height:1.6}
  .head{text-align:center;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:8px}
  .head h1{font-size:20px;margin:0 0 6px}
  .meta{display:flex;justify-content:space-between;font-size:13px;color:#334155;margin-bottom:18px;flex-wrap:wrap;gap:8px}
  .q{display:flex;gap:8px;margin:0 0 18px;page-break-inside:avoid}
  .n{font-weight:700}
  .body{flex:1}
  .stem{font-size:14px}
  .marks{color:#64748b;font-size:12px}
  .opts{list-style:none;padding:0;margin:8px 0 0}
  .opts li{padding:2px 0;font-size:14px}
  .opts li.correct{font-weight:700;color:#047857}
  .ans{margin-top:6px;font-size:13px;color:#047857;background:#ecfdf5;border-left:3px solid #10b981;padding:6px 10px;border-radius:4px}
  .blank{border-bottom:1px solid #cbd5e1;height:64px;margin-top:8px}
  .tag{margin-top:6px;font-size:11px;color:#94a3b8}
  @media print{ body{padding:0} @page{margin:18mm} }
</style></head><body>
  <div class="head">
    <h1>${escapeHtml(meta.title || 'BAFS 自擬試卷')}</h1>
    <div class="meta">
      <span>班別：${escapeHtml(meta.className || '____________')}</span>
      <span>時限：${escapeHtml(meta.durationMin ? meta.durationMin + ' 分鐘' : '____ 分鐘')}</span>
      <span>姓名：____________</span>
      <span>總分：${meta.totalMarks} 分</span>
    </div>
  </div>
  ${items || '<p style="text-align:center;color:#94a3b8">未有題目</p>'}
  <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
</body></html>`
}

export function openPrintWindow(html: string) {
  const w = window.open('', '_blank', 'width=820,height=1000')
  if (!w) return false
  w.document.open()
  w.document.write(html)
  w.document.close()
  return true
}
