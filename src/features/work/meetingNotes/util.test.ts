import { describe, it, expect } from 'vitest'
import {
  keyOf,
  fromKey,
  parseContent,
  renderSegments,
  mergeNotes,
  collectActions,
  typeDistribution,
  actionStats,
  noteToPlainText,
  buildPrintHtml,
  type NoteMeta,
  type ActionItem,
  type MergedNote,
  type OpenAction,
} from './util'
import type { MeetingNote } from '../../../data/types'

// ── 測試輔助 ──────────────────────────────────────────────
const note = (over: Partial<MeetingNote> = {}): MeetingNote => ({
  id: 'n1',
  title: '科組會議',
  date: '2026-05-04',
  content: '',
  createdAt: '2026-05-04T00:00:00.000Z',
  ...over,
})

const meta = (over: Partial<NoteMeta> = {}): NoteMeta => ({
  id: 'n1',
  type: 'panel',
  pinned: false,
  attendees: [],
  decisions: [],
  actions: [],
  updatedAt: '2026-05-04T00:00:00.000Z',
  ...over,
})

const action = (over: Partial<ActionItem> = {}): ActionItem => ({
  id: 'a1',
  text: '跟進事項',
  done: false,
  createdAt: '2026-05-04T00:00:00.000Z',
  ...over,
})

const openAction = (over: Partial<OpenAction> = {}): OpenAction => ({
  ...action(),
  noteId: 'n1',
  noteTitle: '科組會議',
  noteDate: '2026-05-04',
  ...over,
})

// ── keyOf / fromKey：本地時區，無 UTC off-by-one ──────────
describe('keyOf — 格式化為本地 YYYY-MM-DD', () => {
  it('一般日期（個位月日要 padStart）', () => {
    // 2026-01-09 本地時間，唔應該因 UTC 變成 01-08 / 01-10
    expect(keyOf(new Date(2026, 0, 9))).toBe('2026-01-09')
    expect(keyOf(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('一年最後一日，午夜本地時間（時區陷阱）', () => {
    // new Date(2026,11,31,0,0,0) = 本地 2026-12-31 00:00。
    // 若誤用 toISOString 取 UTC，喺 UTC+N 時區會變 2026-12-30 → 錯。
    expect(keyOf(new Date(2026, 11, 31, 0, 0, 0))).toBe('2026-12-31')
  })

  it('一年第一日，接近午夜本地時間', () => {
    expect(keyOf(new Date(2026, 0, 1, 23, 59, 59))).toBe('2026-01-01')
  })
})

describe('fromKey — 解析 YYYY-MM-DD（鎖中午避 DST）', () => {
  it('回正確的本地年/月/日，時間為 12:00', () => {
    const d = fromKey('2026-05-04')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4) // 5 月 → index 4
    expect(d.getDate()).toBe(4)
    expect(d.getHours()).toBe(12)
  })

  it('keyOf(fromKey(x)) roundtrip 不漂移', () => {
    expect(keyOf(fromKey('2026-01-01'))).toBe('2026-01-01')
    expect(keyOf(fromKey('2026-12-31'))).toBe('2026-12-31')
    expect(keyOf(fromKey('2026-02-28'))).toBe('2026-02-28')
  })

  it('缺月/日時 fallback 為 1 月 1 日', () => {
    const d = fromKey('2026')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(1)
  })
})

// ── parseContent：抽行動項目 + 決議 ───────────────────────
describe('parseContent — 由 Markdown-ish 抽結構化項目', () => {
  it('空字串 → 空 actions/decisions', () => {
    expect(parseContent('')).toEqual({ actions: [], decisions: [] })
  })

  it('未勾選 / 已勾選行動項目（大小寫 x）', () => {
    const r = parseContent('- [ ] 撰寫報告\n- [x] 已完成\n- [X] 大寫完成')
    expect(r.actions).toEqual([
      { text: '撰寫報告', owner: undefined, due: undefined, done: false },
      { text: '已完成', owner: undefined, due: undefined, done: true },
      { text: '大寫完成', owner: undefined, due: undefined, done: true },
    ])
  })

  it('抽出負責人 @owner 同到期日 !YYYY-MM-DD，並由文字剝走', () => {
    const r = parseContent('- [ ] 交課程進度 @alice !2026-06-01')
    expect(r.actions).toHaveLength(1)
    expect(r.actions[0].owner).toBe('alice')
    expect(r.actions[0].due).toBe('2026-06-01')
    expect(r.actions[0].text).toBe('交課程進度')
    expect(r.actions[0].done).toBe(false)
  })

  it('決議 > 行（剝走 > 同前後空白）', () => {
    const r = parseContent('> 通過下學期評估安排\n>   有前置空白嘅決議')
    expect(r.decisions).toEqual(['通過下學期評估安排', '有前置空白嘅決議'])
  })

  it('空的勾選項（剝走 owner/due 後無文字）唔加入', () => {
    // "- [ ] @alice" → 剝走 @alice 後 text 為空 → 應跳過
    const r = parseContent('- [ ] @alice')
    expect(r.actions).toEqual([])
  })

  it('星號 bullet 同 - 一樣當行動項目', () => {
    const r = parseContent('* [ ] 用星號')
    expect(r.actions).toEqual([
      { text: '用星號', owner: undefined, due: undefined, done: false },
    ])
  })

  it('普通文字行唔當行動 / 決議', () => {
    const r = parseContent('一、課程進度\n隨便一句說話')
    expect(r.actions).toEqual([])
    expect(r.decisions).toEqual([])
  })
})

// ── renderSegments：Markdown → 區段陣列 ───────────────────
describe('renderSegments — 輕量渲染分段', () => {
  it('空行被略過', () => {
    expect(renderSegments('\n   \n\n')).toEqual([])
  })

  it('中文數字標題 / 【標題】 / 阿拉伯數字標題', () => {
    const segs = renderSegments('一、上次跟進\n【議決】\n1. 校長報告')
    expect(segs).toEqual([
      { kind: 'heading', text: '一、上次跟進' },
      { kind: 'heading', text: '【議決】' },
      { kind: 'heading', text: '1. 校長報告' },
    ])
  })

  it('決議行 → decision 區段', () => {
    expect(renderSegments('> 一致通過')).toEqual([
      { kind: 'decision', text: '一致通過' },
    ])
  })

  it('行動項目區段帶 owner/due/done', () => {
    expect(renderSegments('- [x] 提交文件 @bob !2026-07-15')).toEqual([
      { kind: 'action', text: '提交文件', owner: 'bob', due: '2026-07-15', done: true },
    ])
  })

  it('普通 bullet（無 checkbox）→ bullet 區段', () => {
    expect(renderSegments('- 一個普通項目')).toEqual([
      { kind: 'bullet', text: '一個普通項目' },
    ])
  })

  it('普通段落 → para 區段', () => {
    expect(renderSegments('這是一段普通文字')).toEqual([
      { kind: 'para', text: '這是一段普通文字' },
    ])
  })
})

// ── mergeNotes：合併 note + meta ──────────────────────────
describe('mergeNotes — 配對 note 與 meta', () => {
  it('空陣列 → 空結果', () => {
    expect(mergeNotes([], [])).toEqual([])
  })

  it('有對應 meta 時使用該 meta', () => {
    const m = meta({ id: 'n1', type: 'staff', pinned: true })
    const merged = mergeNotes([note({ id: 'n1' })], [m])
    expect(merged).toHaveLength(1)
    expect(merged[0].meta).toBe(m)
    expect(merged[0].note.id).toBe('n1')
  })

  it('無對應 meta 時回 emptyMeta（type=other，空陣列）', () => {
    const merged = mergeNotes([note({ id: 'orphan' })], [])
    expect(merged[0].meta.id).toBe('orphan')
    expect(merged[0].meta.type).toBe('other')
    expect(merged[0].meta.attendees).toEqual([])
    expect(merged[0].meta.actions).toEqual([])
    expect(merged[0].meta.pinned).toBe(false)
  })
})

// ── collectActions：抽出所有 note 嘅行動項目 ───────────────
describe('collectActions — 攤平所有行動項目並附 note 資訊', () => {
  it('無行動 → 空陣列', () => {
    const merged: MergedNote[] = [{ note: note(), meta: meta() }]
    expect(collectActions(merged)).toEqual([])
  })

  it('附上 noteId / noteTitle / noteDate', () => {
    const merged: MergedNote[] = [
      {
        note: note({ id: 'n7', title: '家長會', date: '2026-05-10' }),
        meta: meta({ actions: [action({ id: 'a9', text: '致電家長' })] }),
      },
    ]
    const collected = collectActions(merged)
    expect(collected).toHaveLength(1)
    expect(collected[0]).toMatchObject({
      id: 'a9',
      text: '致電家長',
      noteId: 'n7',
      noteTitle: '家長會',
      noteDate: '2026-05-10',
    })
  })

  it('跨多個 note 累加', () => {
    const merged: MergedNote[] = [
      { note: note({ id: 'n1' }), meta: meta({ actions: [action({ id: 'a1' })] }) },
      {
        note: note({ id: 'n2' }),
        meta: meta({ id: 'n2', actions: [action({ id: 'a2' }), action({ id: 'a3' })] }),
      },
    ]
    expect(collectActions(merged).map((a) => a.id)).toEqual(['a1', 'a2', 'a3'])
  })
})

// ── typeDistribution：按類型分布（依固定 ORDER）────────────
describe('typeDistribution — 按會議類型分組計數', () => {
  it('空 → 空陣列', () => {
    expect(typeDistribution([])).toEqual([])
  })

  it('只回有出現過嘅類型，數目正確', () => {
    const merged: MergedNote[] = [
      { note: note({ id: '1' }), meta: meta({ id: '1', type: 'staff' }) },
      { note: note({ id: '2' }), meta: meta({ id: '2', type: 'staff' }) },
      { note: note({ id: '3' }), meta: meta({ id: '3', type: 'parent' }) },
    ]
    const dist = typeDistribution(merged)
    expect(dist).toEqual([
      { type: 'staff', label: '教職員', count: 2, tone: 'blue' },
      { type: 'parent', label: '家長', count: 1, tone: 'amber' },
    ])
  })

  it('結果依 MEETING_TYPE_ORDER 排序（panel 在 parent 之前）', () => {
    const merged: MergedNote[] = [
      { note: note({ id: '1' }), meta: meta({ id: '1', type: 'parent' }) },
      { note: note({ id: '2' }), meta: meta({ id: '2', type: 'panel' }) },
    ]
    expect(typeDistribution(merged).map((s) => s.type)).toEqual(['panel', 'parent'])
  })
})

// ── actionStats（除零 / 邊界；只用接受到嘅資料）────────────
describe('actionStats — 行動統計（純計數部分）', () => {
  it('空陣列：total/done/open 為 0，completionPct 為 0（無除零）', () => {
    const s = actionStats([])
    expect(s.total).toBe(0)
    expect(s.done).toBe(0)
    expect(s.open).toBe(0)
    expect(s.completionPct).toBe(0)
  })

  it('done / open 計數 + 百分比四捨五入', () => {
    // 3 項，1 項已完成 → done=1 open=2 pct=round(33.33)=33
    const acts: OpenAction[] = [
      openAction({ id: 'a1', done: true }),
      openAction({ id: 'a2', done: false }),
      openAction({ id: 'a3', done: false }),
    ]
    const s = actionStats(acts)
    expect(s.total).toBe(3)
    expect(s.done).toBe(1)
    expect(s.open).toBe(2)
    expect(s.completionPct).toBe(33)
  })

  it('全部完成 → 100%', () => {
    const s = actionStats([openAction({ done: true }), openAction({ id: 'b', done: true })])
    expect(s.completionPct).toBe(100)
    expect(s.open).toBe(0)
  })
})

// ── noteToPlainText：複製成純文字 ─────────────────────────
describe('noteToPlainText — 序列化為純文字', () => {
  it('最簡：標題 + 類型/日期 + 空行 + 內容', () => {
    const txt = noteToPlainText(
      note({ title: '週會', date: '2026-05-04', content: '會議內容' }),
      meta({ type: 'staff' }),
    )
    expect(txt).toBe('週會\n教職員會議 · 2026-05-04\n\n會議內容')
  })

  it('帶時間 / 地點 / 出席者', () => {
    const txt = noteToPlainText(
      note({ title: 'T', date: '2026-05-04', content: 'C' }),
      meta({ type: 'panel', time: '14:30', location: '會議室 A', attendees: ['陳', '李'] }),
    )
    const lines = txt.split('\n')
    expect(lines[0]).toBe('T')
    expect(lines[1]).toBe('科組會議 · 2026-05-04 14:30')
    expect(lines[2]).toBe('地點：會議室 A')
    expect(lines[3]).toBe('出席：陳、李')
  })

  it('決議用 1. 2. 編號，行動項目用 [x]/[ ]', () => {
    const txt = noteToPlainText(
      note({ title: 'T', date: '2026-05-04', content: 'C' }),
      meta({
        type: 'panel',
        decisions: ['決議一', '決議二'],
        actions: [
          action({ text: '做嘢', owner: 'amy', due: '2026-06-01', done: true }),
          action({ id: 'a2', text: '另一件', done: false }),
        ],
      }),
    )
    expect(txt).toContain('【議決】\n1. 決議一\n2. 決議二')
    expect(txt).toContain('[x] 做嘢 @amy (2026-06-01)')
    expect(txt).toContain('[ ] 另一件')
  })
})

// ── buildPrintHtml：穩定（非時間）部分 + HTML escape ───────
describe('buildPrintHtml — HTML 輸出（escape + 內容）', () => {
  it('標題經 HTML escape，防 XSS', () => {
    const html = buildPrintHtml({
      note: note({ title: '<b>"危險"</b> & 符號', content: '' }),
      meta: meta(),
    })
    expect(html).toContain('<h1>&lt;b&gt;&quot;危險&quot;&lt;/b&gt; &amp; 符號</h1>')
    expect(html).not.toContain('<h1><b>')
  })

  it('包含類型 label 同日期', () => {
    const html = buildPrintHtml({
      note: note({ title: 'T', date: '2026-05-04', content: '' }),
      meta: meta({ type: 'staff' }),
    })
    expect(html).toContain('教職員會議')
    expect(html).toContain('2026-05-04')
  })

  it('決議 / 行動 / 標籤區段按資料出現', () => {
    const html = buildPrintHtml({
      note: note({ title: 'T', content: '', tags: ['期末', '緊急'] }),
      meta: meta({ decisions: ['通過預算'], actions: [action({ text: '跟進', done: true })] }),
    })
    expect(html).toContain('議決事項')
    expect(html).toContain('通過預算')
    expect(html).toContain('跟進行動')
    expect(html).toContain('☑ 跟進')
    expect(html).toContain('#期末 #緊急')
  })

  it('無決議 / 無行動 / 無標籤時唔出該區段', () => {
    const html = buildPrintHtml({ note: note({ content: '', tags: [] }), meta: meta() })
    expect(html).not.toContain('議決事項')
    expect(html).not.toContain('跟進行動')
    expect(html).not.toContain('class="tags"')
  })
})
