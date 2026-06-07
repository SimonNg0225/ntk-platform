import { createCollection } from '../../../lib/store'
import type { MeetingNote } from '../../../data/types'

// ============================================================
//  會議 / 行政筆記 — 深化資料模型 + 工具（媲美 Notion / Fellow）
//  ------------------------------------------------------------
//  共用 meetingNotesCol（MeetingNote）唔改：title / date / content /
//  tags / createdAt 維持原樣，舊筆記照樣顯示。
//  本功能需要而 MeetingNote 冇嘅結構化欄位 —— 會議類型、出席者、
//  行動項目（action items）、決議、置頂、完成狀態、地點、時間 ——
//  全部存喺自家「擴充表」meeting_note_meta（id == MeetingNote.id）。
//  另開 meeting_note_templates（議程範本）。
//  唯一 key（已喺 newCollections 申報）：
//    meeting_note_meta / meeting_note_templates
// ============================================================

// ───────── 會議類型（color-coded，似 Notion 嘅 select）─────────
export type MeetingType =
  | 'staff' // 教職員 / 全體會議
  | 'panel' // 科組會議
  | 'parent' // 家長會 / 家長日
  | 'committee' // 委員會 / 工作小組
  | 'training' // 培訓 / 工作坊
  | 'oneonone' // 個別會面
  | 'admin' // 行政事務（非會議筆記）
  | 'other'

export const MEETING_TYPE_META: Record<
  MeetingType,
  { label: string; tone: BadgeTone; short: string }
> = {
  staff: { label: '教職員會議', tone: 'blue', short: '教職員' },
  panel: { label: '科組會議', tone: 'accent', short: '科組' },
  parent: { label: '家長會 / 家長日', tone: 'amber', short: '家長' },
  committee: { label: '委員會 / 小組', tone: 'green', short: '委員會' },
  training: { label: '培訓 / 工作坊', tone: 'accent', short: '培訓' },
  oneonone: { label: '個別會面', tone: 'slate', short: '個別' },
  admin: { label: '行政事務', tone: 'slate', short: '行政' },
  other: { label: '其他', tone: 'slate', short: '其他' },
}

// Badge tone（同 ui/index.tsx BadgeTone 對齊，唔 import 內部型別）
export type BadgeTone = 'slate' | 'accent' | 'green' | 'amber' | 'rose' | 'blue'

export const MEETING_TYPE_ORDER: MeetingType[] = [
  'staff',
  'panel',
  'parent',
  'committee',
  'training',
  'oneonone',
  'admin',
  'other',
]

// ───────── 行動項目（會議筆記嘅核心：跟進事項）─────────
export interface ActionItem {
  id: string
  text: string
  done: boolean
  owner?: string // 負責人
  due?: string // YYYY-MM-DD（到期日，選填）
  createdAt: string
}

// ───────── 擴充 meta（id == MeetingNote.id）─────────
export interface NoteMeta {
  id: string // == MeetingNote.id
  type: MeetingType
  pinned: boolean
  attendees: string[] // 出席者
  location?: string // 地點
  time?: string // HH:mm（開始時間，選填）
  durationMin?: number // 時長（分鐘，選填）
  decisions: string[] // 決議 / 議決事項
  actions: ActionItem[] // 跟進行動項目
  updatedAt: string
}

// ───────── 議程範本（Notion 招牌功能）─────────
export interface NoteTemplate {
  id: string
  name: string
  type: MeetingType
  content: string // 預填內容（支援 - [ ] 行動項目語法）
  builtin?: boolean
  createdAt: string
}

// ───────── Collections（自家 key，自動存 localStorage）─────────
export const noteMetaCol = createCollection<NoteMeta>('meeting_note_meta', [])

export const noteTemplatesCol = createCollection<NoteTemplate>(
  'meeting_note_templates',
  [
    {
      id: 'tpl-panel',
      name: '科組會議（標準議程）',
      type: 'panel',
      builtin: true,
      createdAt: new Date().toISOString(),
      content: `【出席】
【缺席】

一、上次會議跟進
- [ ]

二、課程進度滙報


三、評估與功課安排


四、其他事項


【議決】
>

【跟進行動】
- [ ] @
`,
    },
    {
      id: 'tpl-parent',
      name: '家長會面記錄',
      type: 'parent',
      builtin: true,
      createdAt: new Date().toISOString(),
      content: `【學生】
【家長】
【出席教師】

一、學業表現


二、操行 / 課堂表現


三、家長關注事項


四、跟進安排
- [ ]
`,
    },
    {
      id: 'tpl-staff',
      name: '教職員會議',
      type: 'staff',
      builtin: true,
      createdAt: new Date().toISOString(),
      content: `【主持】
【記錄】

一、校長報告


二、各組報告


三、討論事項


【議決】
>

【行動項目】
- [ ] @
`,
    },
    {
      id: 'tpl-oneonone',
      name: '一對一傾談 / 觀課後會議',
      type: 'oneonone',
      builtin: true,
      createdAt: new Date().toISOString(),
      content: `【對象】

一、做得好嘅地方


二、可改善之處


三、雙方共識


【跟進】
- [ ]
`,
    },
  ],
)

// ============================================================
//  工具函式（純函式，方便測試 / 重用）
// ============================================================

export function uidLocal(prefix = 'x'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`
}

export function todayKey(): string {
  const d = new Date()
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

export const emptyMeta = (id: string): NoteMeta => ({
  id,
  type: 'other',
  pinned: false,
  attendees: [],
  decisions: [],
  actions: [],
  updatedAt: new Date().toISOString(),
})

export function makeAction(text = '', owner?: string, due?: string): ActionItem {
  return {
    id: uidLocal('act'),
    text,
    done: false,
    owner: owner || undefined,
    due: due || undefined,
    createdAt: new Date().toISOString(),
  }
}

// ───────── meta upsert（以 noteId 做 id）─────────
export function upsertMeta(id: string, patch: Partial<Omit<NoteMeta, 'id'>>) {
  const existing = noteMetaCol.get().find((m) => m.id === id)
  if (existing) {
    noteMetaCol.update(id, { ...patch, updatedAt: new Date().toISOString() })
  } else {
    noteMetaCol.add({
      ...emptyMeta(id),
      ...patch,
      updatedAt: new Date().toISOString(),
    })
  }
}

// ───────── 清掉孤兒 meta（筆記已刪）─────────
export function pruneMeta(validIds: Set<string>) {
  for (const m of noteMetaCol.get()) {
    if (!validIds.has(m.id)) noteMetaCol.remove(m.id)
  }
}

// ============================================================
//  內容解析：由 Markdown-ish 筆記抽行動項目 / 決議
//  - 行動項目語法： - [ ] 文字 @負責人 !YYYY-MM-DD
//  - 決議語法：     > 文字
//  俾「由內容自動建立結構化項目」用（似 Granola / Fellow 嘅抽取）。
// ============================================================
export interface ParsedContent {
  actions: { text: string; owner?: string; due?: string; done: boolean }[]
  decisions: string[]
}

const ACTION_RE = /^\s*[-*]\s*\[( |x|X)\]\s*(.+)$/
const DECISION_RE = /^\s*>\s*(.+)$/
const OWNER_RE = /@([^\s@!]+)/
const DUE_RE = /!(\d{4}-\d{2}-\d{2})/

export function parseContent(content: string): ParsedContent {
  const actions: ParsedContent['actions'] = []
  const decisions: string[] = []
  for (const rawLine of content.split('\n')) {
    const am = rawLine.match(ACTION_RE)
    if (am) {
      const done = am[1].toLowerCase() === 'x'
      let text = am[2].trim()
      let owner: string | undefined
      let due: string | undefined
      const om = text.match(OWNER_RE)
      if (om) {
        owner = om[1]
        text = text.replace(OWNER_RE, '').trim()
      }
      const dm = text.match(DUE_RE)
      if (dm) {
        due = dm[1]
        text = text.replace(DUE_RE, '').trim()
      }
      if (text.length > 0) actions.push({ text, owner, due, done })
      continue
    }
    const dm = rawLine.match(DECISION_RE)
    if (dm) {
      const t = dm[1].trim()
      if (t.length > 0) decisions.push(t)
    }
  }
  return { actions, decisions }
}

// ============================================================
//  輕量 Markdown 渲染（純資料 → 區段陣列；零依賴，畀元件畫）
//  支援：標題行（中文「一、」/「1.」/【標題】）、決議 >、
//  行動項目 - [ ]、無序列表 -、空行、普通段落。
// ============================================================
export type Segment =
  | { kind: 'heading'; text: string }
  | { kind: 'decision'; text: string }
  | { kind: 'action'; text: string; owner?: string; due?: string; done: boolean }
  | { kind: 'bullet'; text: string }
  | { kind: 'para'; text: string }

const HEADING_RE = /^\s*(?:【.+】|[一二三四五六七八九十]+、|\d+[.)、]\s).*$/
const BULLET_RE = /^\s*[-*]\s+(.+)$/

export function renderSegments(content: string): Segment[] {
  const out: Segment[] = []
  for (const raw of content.split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (line.trim().length === 0) continue
    const am = line.match(ACTION_RE)
    if (am) {
      const done = am[1].toLowerCase() === 'x'
      let text = am[2].trim()
      let owner: string | undefined
      let due: string | undefined
      const om = text.match(OWNER_RE)
      if (om) {
        owner = om[1]
        text = text.replace(OWNER_RE, '').trim()
      }
      const dm = text.match(DUE_RE)
      if (dm) {
        due = dm[1]
        text = text.replace(DUE_RE, '').trim()
      }
      out.push({ kind: 'action', text, owner, due, done })
      continue
    }
    const dm = line.match(DECISION_RE)
    if (dm) {
      out.push({ kind: 'decision', text: dm[1].trim() })
      continue
    }
    if (HEADING_RE.test(line)) {
      out.push({ kind: 'heading', text: line.trim() })
      continue
    }
    const bm = line.match(BULLET_RE)
    if (bm) {
      out.push({ kind: 'bullet', text: bm[1].trim() })
      continue
    }
    out.push({ kind: 'para', text: line })
  }
  return out
}

// ============================================================
//  統計：合併 MeetingNote + NoteMeta，計各種指標 + 圖表資料
// ============================================================
export interface MergedNote {
  note: MeetingNote
  meta: NoteMeta
}

export function mergeNotes(
  notes: MeetingNote[],
  metas: NoteMeta[],
): MergedNote[] {
  const byId = new Map(metas.map((m) => [m.id, m]))
  return notes.map((note) => ({
    note,
    meta: byId.get(note.id) ?? emptyMeta(note.id),
  }))
}

export interface OpenAction extends ActionItem {
  noteId: string
  noteTitle: string
  noteDate: string
}

export function collectActions(merged: MergedNote[]): OpenAction[] {
  const out: OpenAction[] = []
  for (const { note, meta } of merged) {
    for (const a of meta.actions) {
      out.push({
        ...a,
        noteId: note.id,
        noteTitle: note.title,
        noteDate: note.date,
      })
    }
  }
  return out
}

// ───────── 月度會議數（近 N 個月，畀長條圖）─────────
export interface MonthBar {
  key: string // YYYY-MM
  label: string // M月
  count: number
}

export function monthlyMeetingBars(
  merged: MergedNote[],
  months = 6,
): MonthBar[] {
  const now = new Date()
  const bars: MonthBar[] = []
  const counts = new Map<string, number>()
  for (const { note } of merged) {
    const key = note.date.slice(0, 7) // YYYY-MM
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    bars.push({ key, label: `${d.getMonth() + 1}月`, count: counts.get(key) ?? 0 })
  }
  return bars
}

// ───────── 按類型分布（畀甜甜圈）─────────
export interface TypeSlice {
  type: MeetingType
  label: string
  count: number
  tone: BadgeTone
}

export function typeDistribution(merged: MergedNote[]): TypeSlice[] {
  const counts = new Map<MeetingType, number>()
  for (const { meta } of merged) {
    counts.set(meta.type, (counts.get(meta.type) ?? 0) + 1)
  }
  return MEETING_TYPE_ORDER.filter((t) => (counts.get(t) ?? 0) > 0).map((t) => ({
    type: t,
    label: MEETING_TYPE_META[t].short,
    count: counts.get(t) ?? 0,
    tone: MEETING_TYPE_META[t].tone,
  }))
}

// ───────── 行動項目統計 ─────────
export interface ActionStats {
  total: number
  done: number
  open: number
  overdue: number
  dueSoon: number // 未來 7 日內到期且未完成
  completionPct: number
}

export function actionStats(actions: OpenAction[]): ActionStats {
  const today = todayKey()
  const soon = keyOf(new Date(Date.now() + 7 * 864e5))
  let done = 0
  let overdue = 0
  let dueSoon = 0
  for (const a of actions) {
    if (a.done) {
      done += 1
      continue
    }
    if (a.due) {
      if (a.due < today) overdue += 1
      else if (a.due <= soon) dueSoon += 1
    }
  }
  const total = actions.length
  const open = total - done
  return {
    total,
    done,
    open,
    overdue,
    dueSoon,
    completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
  }
}

// ───────── 按負責人分組（問責視圖：邊個欠咩跟進）─────────
// 媲美 Fellow / Asana 嘅「My / per-person」匯總：跨所有會議攤平行動，
// 以負責人 (owner) 收口；無負責人歸入「未指派」桶。每組計未完成 / 逾期 /
// 完成數，並保留該組仍未完成嘅項目（已按 OpenAction 排序）。
export const UNASSIGNED_OWNER = '__unassigned__'

export interface OwnerGroup {
  owner: string // 實際負責人名；未指派為 UNASSIGNED_OWNER
  unassigned: boolean
  open: number // 未完成數
  overdue: number // 未完成且已逾期
  done: number // 已完成數
  total: number // 該組總數
  items: OpenAction[] // 該組仍未完成嘅項目（傳入次序保留）
}

export function actionsByOwner(actions: OpenAction[]): OwnerGroup[] {
  const today = todayKey()
  const map = new Map<string, OwnerGroup>()
  for (const a of actions) {
    const name = a.owner?.trim()
    const key = name ? name : UNASSIGNED_OWNER
    let g = map.get(key)
    if (!g) {
      g = {
        owner: key,
        unassigned: !name,
        open: 0,
        overdue: 0,
        done: 0,
        total: 0,
        items: [],
      }
      map.set(key, g)
    }
    g.total += 1
    if (a.done) {
      g.done += 1
    } else {
      g.open += 1
      g.items.push(a)
      if (a.due && a.due < today) g.overdue += 1
    }
  }
  // 排序：未指派永遠墊底；其餘按未完成數（多→少）、再逾期數、再名稱
  return Array.from(map.values()).sort((a, b) => {
    if (a.unassigned !== b.unassigned) return a.unassigned ? 1 : -1
    if (b.open !== a.open) return b.open - a.open
    if (b.overdue !== a.overdue) return b.overdue - a.overdue
    return a.owner.localeCompare(b.owner)
  })
}

// ============================================================
//  匯出 / 列印（生成獨立 HTML，零依賴）
// ============================================================
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function segmentsToHtml(content: string): string {
  return renderSegments(content)
    .map((s) => {
      switch (s.kind) {
        case 'heading':
          return `<h3>${esc(s.text)}</h3>`
        case 'decision':
          return `<p class="dec">▸ ${esc(s.text)}</p>`
        case 'action': {
          const tail = [
            s.owner ? `<span class="own">@${esc(s.owner)}</span>` : '',
            s.due ? `<span class="due">${esc(s.due)}</span>` : '',
          ].join(' ')
          return `<p class="act">${s.done ? '☑' : '☐'} ${esc(s.text)} ${tail}</p>`
        }
        case 'bullet':
          return `<p class="bul">• ${esc(s.text)}</p>`
        default:
          return `<p>${esc(s.text)}</p>`
      }
    })
    .join('\n')
}

export interface PrintInput {
  note: MeetingNote
  meta: NoteMeta
}

export function buildPrintHtml(input: PrintInput): string {
  const { note, meta } = input
  const typeLabel = MEETING_TYPE_META[meta.type].label
  const metaRows = [
    `<span><b>類型：</b>${esc(typeLabel)}</span>`,
    `<span><b>日期：</b>${esc(note.date)}${meta.time ? ' ' + esc(meta.time) : ''}</span>`,
    meta.durationMin ? `<span><b>時長：</b>${meta.durationMin} 分鐘</span>` : '',
    meta.location ? `<span><b>地點：</b>${esc(meta.location)}</span>` : '',
    meta.attendees.length
      ? `<span><b>出席：</b>${esc(meta.attendees.join('、'))}</span>`
      : '',
  ]
    .filter(Boolean)
    .join('')

  const decisions = meta.decisions.length
    ? `<h2>議決事項</h2><ol class="dec">${meta.decisions
        .map((d) => `<li>${esc(d)}</li>`)
        .join('')}</ol>`
    : ''

  const actions = meta.actions.length
    ? `<h2>跟進行動</h2><ul class="act">${meta.actions
        .map(
          (a) =>
            `<li>${a.done ? '☑' : '☐'} ${esc(a.text)}${
              a.owner ? ` <em>@${esc(a.owner)}</em>` : ''
            }${a.due ? ` <span class="due">（${esc(a.due)}）</span>` : ''}</li>`,
        )
        .join('')}</ul>`
    : ''

  const tags = note.tags?.length
    ? `<div class="tags">${note.tags.map((t) => `#${esc(t)}`).join(' ')}</div>`
    : ''

  return `<!doctype html><html lang="zh-HK"><head><meta charset="utf-8"/>
<title>${esc(note.title)} — 會議筆記</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "PingFang HK", "Microsoft JhengHei", sans-serif; color:#1e293b; margin:32px; line-height:1.6; }
  h1 { font-size:21px; margin:0 0 6px; }
  .meta { display:flex; flex-wrap:wrap; gap:6px 16px; font-size:12px; color:#475569; border-bottom:2px solid #1e293b; padding-bottom:10px; margin-bottom:16px; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.05em; color:#64748b; margin:20px 0 8px; border-bottom:1px solid #e2e8f0; padding-bottom:4px; }
  h3 { font-size:13.5px; margin:14px 0 4px; color:#334155; }
  .body p { font-size:13px; margin:4px 0; white-space:pre-wrap; }
  .body p.dec { color:#234f86; font-weight:600; }
  .body p.act { color:#475569; }
  .body p.bul { padding-left:8px; }
  .own { color:#234f86; font-weight:600; }
  .due { color:#b45309; font-variant-numeric:tabular-nums; }
  ol.dec li, ul.act li { font-size:13px; margin:4px 0; }
  ul.act { list-style:none; padding-left:0; }
  ul.act em { color:#234f86; font-style:normal; font-weight:600; }
  .tags { margin-top:18px; font-size:11px; color:#64748b; }
  .foot { margin-top:28px; font-size:10px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:8px; }
  @media print { body { margin:12mm; } @page { margin:0; } }
</style></head>
<body>
  <h1>${esc(note.title)}</h1>
  <div class="meta">${metaRows}</div>
  <div class="body">${segmentsToHtml(note.content)}</div>
  ${decisions}
  ${actions}
  ${tags}
  <div class="foot">EziTeach 教學易 · 會議 / 行政筆記 · 列印於 ${new Date().toLocaleString('zh-HK')}</div>
  <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
</body></html>`
}

export function printNote(input: PrintInput): boolean {
  const html = buildPrintHtml(input)
  const w = window.open('', '_blank', 'width=820,height=1000')
  if (!w) return false
  w.document.open()
  w.document.write(html)
  w.document.close()
  return true
}

// ───────── 複製做純文字（畀「複製」用）─────────
export function noteToPlainText(note: MeetingNote, meta: NoteMeta): string {
  const lines: string[] = []
  lines.push(note.title)
  lines.push(
    `${MEETING_TYPE_META[meta.type].label} · ${note.date}${
      meta.time ? ' ' + meta.time : ''
    }`,
  )
  if (meta.location) lines.push(`地點：${meta.location}`)
  if (meta.attendees.length) lines.push(`出席：${meta.attendees.join('、')}`)
  lines.push('')
  lines.push(note.content)
  if (meta.decisions.length) {
    lines.push('')
    lines.push('【議決】')
    meta.decisions.forEach((d, i) => lines.push(`${i + 1}. ${d}`))
  }
  if (meta.actions.length) {
    lines.push('')
    lines.push('【跟進行動】')
    meta.actions.forEach((a) =>
      lines.push(
        `${a.done ? '[x]' : '[ ]'} ${a.text}${a.owner ? ` @${a.owner}` : ''}${
          a.due ? ` (${a.due})` : ''
        }`,
      ),
    )
  }
  return lines.join('\n')
}
