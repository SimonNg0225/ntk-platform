import { createCollection } from '../../../lib/store'
import type { LessonPlan, Topic } from '../../../data/types'

// ============================================================
//  備課 / 教案 — 深化資料模型 + 工具
//  ------------------------------------------------------------
//  共用 LessonPlan（lessonPlansCol）保留唔改，喺呢度用「擴充表」
//  lesson_plan_meta（key = LessonPlan.id）存結構化教學環節、狀態、
//  教學節數、教材清單。範本（templates）獨立一個 collection。
// ============================================================

// ───────── 教案狀態（備課工作流）─────────
export type PlanStatus = 'draft' | 'ready' | 'taught'

export const STATUS_META: Record<
  PlanStatus,
  { label: string; tone: 'slate' | 'amber' | 'green'; order: number }
> = {
  draft: { label: '草稿', tone: 'slate', order: 0 },
  ready: { label: '已就緒', tone: 'amber', order: 1 },
  taught: { label: '已授課', tone: 'green', order: 2 },
}

export const STATUS_ORDER: PlanStatus[] = ['draft', 'ready', 'taught']

// ───────── 教學環節（三段式 / 自訂）─────────
export interface LessonPhase {
  id: string
  label: string // 引入 / 講解 / 活動 / 鞏固 / 總結 …
  minutes: number // 分配時間
  detail: string // 內容描述
}

// 香港課堂常見三段式結構，做新教案 / 範本骨架
export const PHASE_PRESETS: { label: string; minutes: number }[] = [
  { label: '引入 (Hook)', minutes: 5 },
  { label: '講解 (Teach)', minutes: 20 },
  { label: '課堂活動 (Activity)', minutes: 20 },
  { label: '鞏固 / 評估 (Check)', minutes: 8 },
  { label: '總結 (Summary)', minutes: 2 },
]

// ───────── 教材 / 工作紙清單項 ─────────
export interface MaterialItem {
  id: string
  text: string
  done: boolean // 是否已備妥
}

// ───────── 擴充 meta（key = LessonPlan.id）─────────
export interface PlanMeta {
  id: string // == LessonPlan.id
  status: PlanStatus
  period?: number // 第幾節（配合時間表，用嚟週視圖排序）
  durationMin?: number // 課堂總時長（分鐘）
  taughtDate?: string // 實際授課日（YYYY-MM-DD）
  phases: LessonPhase[]
  materials: MaterialItem[]
  reflection?: string // 課後反思
  updatedAt: string
}

// ───────── 範本（可重用教案骨架）─────────
export interface PlanTemplate {
  id: string
  name: string
  objectives: string
  phases: LessonPhase[]
  materials: { text: string }[]
  createdAt: string
}

// ───────── Collections（自己嘅 key，自動存 localStorage）─────────
export const planMetaCol = createCollection<PlanMeta>('lesson_plan_meta', [])

export const planTemplatesCol = createCollection<PlanTemplate>(
  'lesson_plan_templates',
  [
    {
      id: 'tpl-bafs-standard',
      name: 'BAFS 標準課堂（三段式 55 分鐘）',
      objectives:
        '1. 學生能說明本課核心概念\n2. 學生能應用概念分析香港營商個案\n3. 學生能完成相關練習',
      phases: PHASE_PRESETS.map((p, i) => ({
        id: `tpl-ph-${i}`,
        label: p.label,
        minutes: p.minutes,
        detail: '',
      })),
      materials: [
        { text: 'PowerPoint 簡報' },
        { text: '課堂工作紙' },
        { text: 'DSE 過往試題' },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tpl-case-study',
      name: '個案研習課（HKDSE 卷二）',
      objectives:
        '1. 學生能拆解商業個案的關鍵資訊\n2. 學生能運用所學理論作出建議\n3. 學生能以適當格式組織答案',
      phases: [
        { id: 'cs-0', label: '個案導讀', minutes: 10, detail: '' },
        { id: 'cs-1', label: '分組討論', minutes: 20, detail: '' },
        { id: 'cs-2', label: '匯報與點評', minutes: 15, detail: '' },
        { id: 'cs-3', label: '答題框架總結', minutes: 10, detail: '' },
      ],
      materials: [{ text: '個案文本' }, { text: '評分準則 (Marking Scheme)' }],
      createdAt: new Date().toISOString(),
    },
  ],
)

// ───────── 工具 ─────────
export function uidLocal(prefix = 'x'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`
}

export function makePhase(label = '', minutes = 10): LessonPhase {
  return { id: uidLocal('ph'), label, minutes, detail: '' }
}

export function makeMaterial(text = ''): MaterialItem {
  return { id: uidLocal('mt'), text, done: false }
}

export const emptyMeta = (id: string): PlanMeta => ({
  id,
  status: 'draft',
  phases: [],
  materials: [],
  updatedAt: new Date().toISOString(),
})

export function totalPhaseMinutes(phases: LessonPhase[]): number {
  return phases.reduce((s, p) => s + (Number(p.minutes) || 0), 0)
}

export function materialsDone(materials: MaterialItem[]): {
  done: number
  total: number
} {
  return { done: materials.filter((m) => m.done).length, total: materials.length }
}

// ───────── 日期 ─────────
export function todayKey(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function startOfWeekKey(base: Date): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12)
  const dow = d.getDay() // 0=日
  // 由星期一開始（香港上課週）
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  return keyOf(d)
}

export function keyOf(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12)
}

export function addDaysKey(key: string, n: number): string {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return keyOf(d)
}

export const WEEKDAY_SHORT = ['一', '二', '三', '四', '五'] as const

export function weekdayDateKeys(weekStart: string): string[] {
  // 一～五（5 個上課日）
  return Array.from({ length: 5 }, (_, i) => addDaysKey(weekStart, i))
}

export function shortDateLabel(key: string): string {
  const d = fromKey(key)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function longDateLabel(key: string): string {
  const d = fromKey(key)
  const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（星期${w}）`
}

export function weekRangeLabel(weekStart: string): string {
  const end = addDaysKey(weekStart, 4)
  const a = fromKey(weekStart)
  const b = fromKey(end)
  if (a.getMonth() === b.getMonth())
    return `${a.getMonth() + 1}月${a.getDate()}–${b.getDate()}日`
  return `${a.getMonth() + 1}/${a.getDate()} – ${b.getMonth() + 1}/${b.getDate()}`
}

// ───────── 課程覆蓋分析 ─────────
export interface AreaCoverage {
  area: string
  part: string
  totalTopics: number
  plannedTopics: number // 範疇下有教案嘅課題數
  taughtTopics: number // 範疇下已授課嘅課題數
}

/**
 * 按 BAFS 課題範疇統計覆蓋率。
 * plannedTopicIds：有教案連住嘅課題；taughtTopicIds：教案狀態為已授課。
 */
export function computeCoverage(
  topics: Topic[],
  plannedTopicIds: Set<string>,
  taughtTopicIds: Set<string>,
): AreaCoverage[] {
  const byArea = new Map<string, AreaCoverage>()
  for (const t of topics) {
    let row = byArea.get(t.area)
    if (!row) {
      row = {
        area: t.area,
        part: t.part,
        totalTopics: 0,
        plannedTopics: 0,
        taughtTopics: 0,
      }
      byArea.set(t.area, row)
    }
    row.totalTopics += 1
    if (plannedTopicIds.has(t.id)) row.plannedTopics += 1
    if (taughtTopicIds.has(t.id)) row.taughtTopics += 1
  }
  // 依 BAFS 課題 order（first topic order）排
  const orderOf = new Map<string, number>()
  for (const t of topics) {
    if (!orderOf.has(t.area)) orderOf.set(t.area, t.order)
  }
  return [...byArea.values()].sort(
    (a, b) => (orderOf.get(a.area) ?? 0) - (orderOf.get(b.area) ?? 0),
  )
}

// ───────── 列印（生成獨立 HTML 文件，零依賴，唔靠全域 print CSS）─────────
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function nl2br(s: string): string {
  return esc(s).replace(/\n/g, '<br/>')
}

export interface PrintPlanInput {
  plan: LessonPlan
  meta: PlanMeta | undefined
  className?: string
  topicName?: string
  area?: string
}

export function buildPlanPrintHtml(input: PrintPlanInput): string {
  const { plan, meta, className, topicName, area } = input
  const phases = meta?.phases ?? []
  const totalMin = totalPhaseMinutes(phases) || meta?.durationMin || 0
  const materials = meta?.materials ?? []
  const status = meta?.status ? STATUS_META[meta.status].label : '草稿'

  const metaRows = [
    className ? `<span><b>班別：</b>${esc(className)}</span>` : '',
    area || topicName
      ? `<span><b>課題：</b>${esc([area, topicName].filter(Boolean).join(' · '))}</span>`
      : '',
    plan.date ? `<span><b>日期：</b>${esc(plan.date)}</span>` : '',
    totalMin ? `<span><b>時長：</b>${totalMin} 分鐘</span>` : '',
    `<span><b>狀態：</b>${esc(status)}</span>`,
  ]
    .filter(Boolean)
    .join('')

  const phaseTable = phases.length
    ? `<table class="ph">
        <thead><tr><th style="width:20%">環節</th><th style="width:12%">分鐘</th><th>內容</th></tr></thead>
        <tbody>${phases
          .map(
            (p) =>
              `<tr><td><b>${esc(p.label || '—')}</b></td><td class="num">${
                Number(p.minutes) || 0
              }</td><td>${nl2br(p.detail || '')}</td></tr>`,
          )
          .join('')}</tbody>
      </table>`
    : (plan.activities
        ? `<div class="block">${nl2br(plan.activities)}</div>`
        : '')

  const materialList = materials.length
    ? `<ul class="mat">${materials
        .map(
          (m) =>
            `<li>${m.done ? '☑' : '☐'} ${esc(m.text)}</li>`,
        )
        .join('')}</ul>`
    : plan.resourcesNote
      ? `<div class="block">${nl2br(plan.resourcesNote)}</div>`
      : '<p class="muted">（無）</p>'

  return `<!doctype html><html lang="zh-HK"><head><meta charset="utf-8"/>
<title>${esc(plan.title)} — 教案</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "PingFang HK", "Microsoft JhengHei", sans-serif; color:#1e293b; margin:32px; line-height:1.5; }
  h1 { font-size:20px; margin:0 0 4px; }
  .meta { display:flex; flex-wrap:wrap; gap:6px 16px; font-size:12px; color:#475569; border-bottom:2px solid #1e293b; padding-bottom:10px; margin-bottom:14px; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.05em; color:#64748b; margin:18px 0 6px; }
  .block { font-size:13px; white-space:pre-wrap; }
  table.ph { width:100%; border-collapse:collapse; font-size:12.5px; }
  table.ph th, table.ph td { border:1px solid #cbd5e1; padding:6px 8px; text-align:left; vertical-align:top; }
  table.ph th { background:#f1f5f9; font-size:11px; }
  .num { text-align:right; font-variant-numeric:tabular-nums; }
  ul.mat { margin:0; padding-left:0; list-style:none; font-size:13px; }
  ul.mat li { padding:2px 0; }
  .muted { color:#94a3b8; font-size:12px; }
  .foot { margin-top:28px; font-size:10px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:8px; }
  @media print { body { margin:12mm; } @page { margin:0; } }
</style></head>
<body>
  <h1>${esc(plan.title)}</h1>
  <div class="meta">${metaRows}</div>
  ${plan.objectives ? `<h2>教學目標</h2><div class="block">${nl2br(plan.objectives)}</div>` : ''}
  <h2>教學流程</h2>
  ${phaseTable || '<p class="muted">（未填寫）</p>'}
  <h2>教材 / 工作紙</h2>
  ${materialList}
  ${meta?.reflection ? `<h2>課後反思</h2><div class="block">${nl2br(meta.reflection)}</div>` : ''}
  <div class="foot">NTK Platform · BAFS 教案 · 列印於 ${new Date().toLocaleString('zh-HK')}</div>
  <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
</body></html>`
}

export function printPlan(input: PrintPlanInput): boolean {
  const html = buildPlanPrintHtml(input)
  const w = window.open('', '_blank', 'width=820,height=1000')
  if (!w) return false
  w.document.open()
  w.document.write(html)
  w.document.close()
  return true
}
