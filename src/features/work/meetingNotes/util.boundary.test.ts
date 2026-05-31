import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  keyOf,
  fromKey,
  parseContent,
  renderSegments,
  mergeNotes,
  collectActions,
  typeDistribution,
  actionStats,
  monthlyMeetingBars,
  noteToPlainText,
  buildPrintHtml,
  type NoteMeta,
  type ActionItem,
  type MergedNote,
  type OpenAction,
} from './util'
import type { MeetingNote } from '../../../data/types'

// ── 測試輔助（與 util.test.ts 平行，本檔自足）──────────────
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

const merge = (n: MeetingNote, m: NoteMeta): MergedNote => ({ note: n, meta: m })

// ════════════════════════════════════════════════════════════
//  keyOf — 本地時區 YYYY-MM-DD（避 UTC 漂移）
// ════════════════════════════════════════════════════════════
describe('keyOf — 補零 / 月份 / 閏年邊界', () => {
  it('個位月、個位日同時 padStart 補零', () => {
    expect(keyOf(new Date(2026, 0, 9))).toBe('2026-01-09')
    expect(keyOf(new Date(2026, 8, 3))).toBe('2026-09-03')
  })

  it('12 月（getMonth=11）→ +1=12，唔會變 13 或 11', () => {
    expect(keyOf(new Date(2026, 11, 25))).toBe('2026-12-25')
  })

  it('閏年 2 月 29 日', () => {
    expect(keyOf(new Date(2024, 1, 29))).toBe('2024-02-29')
  })

  it('年尾午夜本地時間 → 仍係 12-31（非 12-30）', () => {
    expect(keyOf(new Date(2026, 11, 31, 0, 0, 0))).toBe('2026-12-31')
  })

  it('年初接近午夜本地時間 → 仍係 01-01', () => {
    expect(keyOf(new Date(2026, 0, 1, 23, 59, 59))).toBe('2026-01-01')
  })
})

// ════════════════════════════════════════════════════════════
//  fromKey — 鎖 12:00、月 -1、缺值 fallback、roundtrip
// ════════════════════════════════════════════════════════════
describe('fromKey — 解析邊界', () => {
  it('月份 -1 轉 0-index（2026-05-04 → getMonth()===4）', () => {
    const d = fromKey('2026-05-04')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4)
    expect(d.getDate()).toBe(4)
  })

  it('鎖 12:00 本地時間以避 DST 邊界（getHours()===12）', () => {
    expect(fromKey('2026-03-29').getHours()).toBe(12)
    expect(fromKey('2026-11-01').getHours()).toBe(12)
  })

  it('缺月/日 → fallback 1 月 1 日', () => {
    const d = fromKey('2026')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(1)
  })

  it('roundtrip keyOf(fromKey(x))===x 不漂移', () => {
    expect(keyOf(fromKey('2026-01-01'))).toBe('2026-01-01')
    expect(keyOf(fromKey('2026-06-15'))).toBe('2026-06-15')
    expect(keyOf(fromKey('2026-12-31'))).toBe('2026-12-31')
    expect(keyOf(fromKey('2024-02-29'))).toBe('2024-02-29')
  })
})

// ════════════════════════════════════════════════════════════
//  parseContent — owner/due 抽取邊界
// ════════════════════════════════════════════════════════════
describe('parseContent — owner/due 進階邊界', () => {
  it('owner 多個 @：只取第一個（replace 無 /g），第二個 @ 留喺 text', () => {
    const r = parseContent('- [ ] 跟進 @alice @bob')
    expect(r.actions).toHaveLength(1)
    expect(r.actions[0].owner).toBe('alice')
    // 第二個 @bob 唔會被剝走（OWNER_RE 無 g flag），仍喺文字中
    expect(r.actions[0].text).toContain('@bob')
  })

  it('owner 與 due 次序顛倒（!date 喺 @owner 前）仍各自抽到', () => {
    const r = parseContent('- [ ] 交報告 !2026-06-01 @carol')
    expect(r.actions).toHaveLength(1)
    expect(r.actions[0].owner).toBe('carol')
    expect(r.actions[0].due).toBe('2026-06-01')
    expect(r.actions[0].text).toBe('交報告')
    expect(r.actions[0].done).toBe(false)
  })

  it('剝走 owner+due 後 text 為空 → 唔加入', () => {
    expect(parseContent('- [ ] @alice !2026-06-01').actions).toEqual([])
  })

  it('標題行唔當行動或決議', () => {
    const r = parseContent('一、課程進度\n【議決】')
    expect(r.actions).toEqual([])
    expect(r.decisions).toEqual([])
  })

  it('決議行剝 > 同前後空白', () => {
    const r = parseContent('>   有前後空白的決議   ')
    expect(r.decisions).toEqual(['有前後空白的決議'])
  })
})

// ════════════════════════════════════════════════════════════
//  renderSegments — 判斷優先順序 + trim
// ════════════════════════════════════════════════════════════
describe('renderSegments — 優先順序 / 邊界', () => {
  it('全空白行 → []', () => {
    expect(renderSegments('   \n\t\n \n')).toEqual([])
  })

  it('"- [ ]" 唔會誤判做 bullet（action 優先於 bullet）', () => {
    const segs = renderSegments('- [ ] 真行動')
    expect(segs).toEqual([
      { kind: 'action', text: '真行動', owner: undefined, due: undefined, done: false },
    ])
    expect(segs[0].kind).toBe('action')
  })

  it('純 bullet（無 checkbox）→ bullet 而非 action', () => {
    expect(renderSegments('* 普通項目')).toEqual([{ kind: 'bullet', text: '普通項目' }])
  })

  it('action 帶 owner/due/done 同時抽出', () => {
    expect(renderSegments('- [x] 提交 @bob !2026-07-15')).toEqual([
      { kind: 'action', text: '提交', owner: 'bob', due: '2026-07-15', done: true },
    ])
  })

  it('行尾空白被 trim（heading）', () => {
    expect(renderSegments('一、上次跟進   ')).toEqual([
      { kind: 'heading', text: '一、上次跟進' },
    ])
  })

  it('decision 優先於 heading（> 行唔會誤入 heading）', () => {
    expect(renderSegments('> 一致通過')).toEqual([{ kind: 'decision', text: '一致通過' }])
  })
})

// ════════════════════════════════════════════════════════════
//  mergeNotes — 孤兒 / 重複 meta
// ════════════════════════════════════════════════════════════
describe('mergeNotes — 孤兒 / Map 覆蓋', () => {
  it('有 meta → 用同一參照', () => {
    const m = meta({ id: 'n1' })
    const merged = mergeNotes([note({ id: 'n1' })], [m])
    expect(merged[0].meta).toBe(m)
  })

  it('孤兒 note → emptyMeta（type=other / 空陣列 / pinned=false）', () => {
    const merged = mergeNotes([note({ id: 'orphan' })], [])
    expect(merged[0].meta).toMatchObject({
      id: 'orphan',
      type: 'other',
      pinned: false,
      attendees: [],
      decisions: [],
      actions: [],
    })
  })

  it('多 meta 對同一 id → Map 後者覆蓋前者', () => {
    const first = meta({ id: 'dup', type: 'staff' })
    const second = meta({ id: 'dup', type: 'parent' })
    const merged = mergeNotes([note({ id: 'dup' })], [first, second])
    expect(merged[0].meta).toBe(second)
    expect(merged[0].meta.type).toBe('parent')
  })
})

// ════════════════════════════════════════════════════════════
//  collectActions — 多 note / 單 note 多 action
// ════════════════════════════════════════════════════════════
describe('collectActions — 攤平累加', () => {
  it('全部無行動 → []', () => {
    const merged: MergedNote[] = [
      merge(note({ id: 'a' }), meta({ id: 'a' })),
      merge(note({ id: 'b' }), meta({ id: 'b' })),
    ]
    expect(collectActions(merged)).toEqual([])
  })

  it('單 note 多 action 全部保留並附 note 資訊', () => {
    const merged: MergedNote[] = [
      merge(
        note({ id: 'n3', title: '週會', date: '2026-04-01' }),
        meta({
          id: 'n3',
          actions: [action({ id: 'x1' }), action({ id: 'x2' }), action({ id: 'x3' })],
        }),
      ),
    ]
    const out = collectActions(merged)
    expect(out.map((a) => a.id)).toEqual(['x1', 'x2', 'x3'])
    out.forEach((a) => {
      expect(a.noteId).toBe('n3')
      expect(a.noteTitle).toBe('週會')
      expect(a.noteDate).toBe('2026-04-01')
    })
  })

  it('跨多 note 順序累加（保留遍歷次序）', () => {
    const merged: MergedNote[] = [
      merge(note({ id: 'n1' }), meta({ id: 'n1', actions: [action({ id: 'a1' })] })),
      merge(note({ id: 'n2' }), meta({ id: 'n2', actions: [action({ id: 'a2' })] })),
    ]
    expect(collectActions(merged).map((a) => a.id)).toEqual(['a1', 'a2'])
  })
})

// ════════════════════════════════════════════════════════════
//  typeDistribution — 排序 / 累加
// ════════════════════════════════════════════════════════════
describe('typeDistribution — ORDER / 累加', () => {
  it('同類型多則累加', () => {
    const merged: MergedNote[] = [
      merge(note({ id: '1' }), meta({ id: '1', type: 'committee' })),
      merge(note({ id: '2' }), meta({ id: '2', type: 'committee' })),
      merge(note({ id: '3' }), meta({ id: '3', type: 'committee' })),
    ]
    expect(typeDistribution(merged)).toEqual([
      { type: 'committee', label: '委員會', count: 3, tone: 'green' },
    ])
  })

  it('結果依 MEETING_TYPE_ORDER 而非插入次序', () => {
    // ORDER: staff, panel, parent, committee, training, ...
    // 插入次序 training → parent → panel；輸出應 panel, parent, training
    const merged: MergedNote[] = [
      merge(note({ id: '1' }), meta({ id: '1', type: 'training' })),
      merge(note({ id: '2' }), meta({ id: '2', type: 'parent' })),
      merge(note({ id: '3' }), meta({ id: '3', type: 'panel' })),
    ]
    expect(typeDistribution(merged).map((s) => s.type)).toEqual([
      'panel',
      'parent',
      'training',
    ])
  })

  it('只回 count>0 嘅類型（其餘缺席）', () => {
    const merged: MergedNote[] = [merge(note({ id: '1' }), meta({ id: '1', type: 'admin' }))]
    const dist = typeDistribution(merged)
    expect(dist).toEqual([{ type: 'admin', label: '行政', count: 1, tone: 'slate' }])
  })
})

// ════════════════════════════════════════════════════════════
//  actionStats — 四捨五入（half-up）純計數，無時間依賴
// ════════════════════════════════════════════════════════════
describe('actionStats — completionPct 四捨五入', () => {
  it('1/3 → 33（33.33 down）', () => {
    expect(
      actionStats([
        openAction({ id: '1', done: true }),
        openAction({ id: '2', done: false }),
        openAction({ id: '3', done: false }),
      ]).completionPct,
    ).toBe(33)
  })

  it('2/3 → 67（66.67 up）', () => {
    expect(
      actionStats([
        openAction({ id: '1', done: true }),
        openAction({ id: '2', done: true }),
        openAction({ id: '3', done: false }),
      ]).completionPct,
    ).toBe(67)
  })

  it('1/8 → 13（12.5 half-up）', () => {
    const acts: OpenAction[] = Array.from({ length: 8 }, (_, i) =>
      openAction({ id: `a${i}`, done: i === 0 }),
    )
    const s = actionStats(acts)
    expect(s.total).toBe(8)
    expect(s.done).toBe(1)
    expect(s.completionPct).toBe(13)
  })

  it('空陣列：completionPct=0（除零防護，回 0 而非 NaN）', () => {
    const s = actionStats([])
    expect(s.completionPct).toBe(0)
    expect(Number.isNaN(s.completionPct)).toBe(false)
  })

  it('全部完成 → 100 / open=0', () => {
    const s = actionStats([
      openAction({ id: '1', done: true }),
      openAction({ id: '2', done: true }),
    ])
    expect(s.completionPct).toBe(100)
    expect(s.open).toBe(0)
  })
})

// ════════════════════════════════════════════════════════════
//  actionStats — overdue / dueSoon（時間依賴 → 凍結系統時鐘）
//  凍結 2026-05-15 12:00 本地：today='2026-05-15'，soon='2026-05-22'
// ════════════════════════════════════════════════════════════
describe('actionStats — overdue / dueSoon（凍結時鐘）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0)) // 本地 2026-05-15 12:00
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('due=今日前一日 → overdue', () => {
    const s = actionStats([openAction({ done: false, due: '2026-05-14' })])
    expect(s.overdue).toBe(1)
    expect(s.dueSoon).toBe(0)
    expect(s.open).toBe(1)
  })

  it('due===today → 算 dueSoon 唔算 overdue（邊界）', () => {
    const s = actionStats([openAction({ done: false, due: '2026-05-15' })])
    expect(s.overdue).toBe(0)
    expect(s.dueSoon).toBe(1)
  })

  it('due===soon（today+7=2026-05-22）→ 仍算 dueSoon（<= inclusive）', () => {
    const s = actionStats([openAction({ done: false, due: '2026-05-22' })])
    expect(s.dueSoon).toBe(1)
    expect(s.overdue).toBe(0)
  })

  it('due 遠未來（>soon，2026-05-23）→ 只入 open，唔入 overdue/dueSoon', () => {
    const s = actionStats([openAction({ done: false, due: '2026-05-23' })])
    expect(s.overdue).toBe(0)
    expect(s.dueSoon).toBe(0)
    expect(s.open).toBe(1)
  })

  it('已完成但 due 已過 → 唔計 overdue（先 check done 就 continue）', () => {
    const s = actionStats([openAction({ done: true, due: '2026-01-01' })])
    expect(s.overdue).toBe(0)
    expect(s.dueSoon).toBe(0)
    expect(s.done).toBe(1)
  })

  it('無 due 嘅未完成項 → 入 open，唔入 overdue/dueSoon', () => {
    const s = actionStats([openAction({ done: false, due: undefined })])
    expect(s.overdue).toBe(0)
    expect(s.dueSoon).toBe(0)
    expect(s.open).toBe(1)
  })

  it('綜合：混合各類別計數正確', () => {
    const s = actionStats([
      openAction({ id: '1', done: true, due: '2026-01-01' }), // done（即使逾期都唔計）
      openAction({ id: '2', done: false, due: '2026-05-10' }), // overdue
      openAction({ id: '3', done: false, due: '2026-05-15' }), // dueSoon（today）
      openAction({ id: '4', done: false, due: '2026-05-22' }), // dueSoon（soon 邊界）
      openAction({ id: '5', done: false, due: '2026-12-31' }), // 遠未來 → open only
      openAction({ id: '6', done: false, due: undefined }), // 無 due → open only
    ])
    expect(s.total).toBe(6)
    expect(s.done).toBe(1)
    expect(s.open).toBe(5)
    expect(s.overdue).toBe(1)
    expect(s.dueSoon).toBe(2)
    expect(s.completionPct).toBe(17) // 1/6=16.67 → 17
  })
})

// ════════════════════════════════════════════════════════════
//  monthlyMeetingBars — 完全未覆蓋（凍結時鐘做月份視窗）
//  凍結 2026-05-15：months=6 → 2025-12 … 2026-05
// ════════════════════════════════════════════════════════════
describe('monthlyMeetingBars — 月度長條（凍結時鐘）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0)) // 2026-05-15
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('預設 6 個月：序列正確、label 為 M月、跨年退到上年 12 月', () => {
    const bars = monthlyMeetingBars([])
    expect(bars).toHaveLength(6)
    expect(bars.map((b) => b.key)).toEqual([
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
    ])
    expect(bars.map((b) => b.label)).toEqual([
      '12月',
      '1月',
      '2月',
      '3月',
      '4月',
      '5月',
    ])
    // 空 merged → 全部 count=0，但長度仍=months
    expect(bars.every((b) => b.count === 0)).toBe(true)
  })

  it('months=0 → 空陣列', () => {
    expect(monthlyMeetingBars([], 0)).toEqual([])
  })

  it('months=1 → 只回當月（2026-05）', () => {
    const bars = monthlyMeetingBars([], 1)
    expect(bars).toHaveLength(1)
    expect(bars[0]).toMatchObject({ key: '2026-05', label: '5月' })
  })

  it('用 note.date.slice(0,7) 做 bucket；同月多則累加', () => {
    const merged: MergedNote[] = [
      merge(note({ id: '1', date: '2026-05-04' }), meta({ id: '1' })),
      merge(note({ id: '2', date: '2026-05-20' }), meta({ id: '2' })),
      merge(note({ id: '3', date: '2026-03-09' }), meta({ id: '3' })),
    ]
    const bars = monthlyMeetingBars(merged)
    const byKey = Object.fromEntries(bars.map((b) => [b.key, b.count]))
    expect(byKey['2026-05']).toBe(2)
    expect(byKey['2026-03']).toBe(1)
    expect(byKey['2026-04']).toBe(0)
    expect(byKey['2026-01']).toBe(0)
  })

  it('跨年 bucket：2025-12 嘅 note 落喺第一條', () => {
    const merged: MergedNote[] = [
      merge(note({ id: '1', date: '2025-12-31' }), meta({ id: '1' })),
    ]
    const bars = monthlyMeetingBars(merged)
    expect(bars[0]).toMatchObject({ key: '2025-12', count: 1 })
  })

  it('視窗外（太舊，2025-11）→ 唔出現喺任何 bar', () => {
    const merged: MergedNote[] = [
      merge(note({ id: '1', date: '2025-11-30' }), meta({ id: '1' })),
    ]
    const bars = monthlyMeetingBars(merged)
    expect(bars.every((b) => b.count === 0)).toBe(true)
  })

  it('note.date 為空字串 → slice 得 ""，唔 match 任何 bar（靜默忽略）', () => {
    const merged: MergedNote[] = [
      merge(note({ id: '1', date: '' }), meta({ id: '1' })),
    ]
    const bars = monthlyMeetingBars(merged)
    expect(bars.every((b) => b.count === 0)).toBe(true)
  })

  it('本地 key 一致：note.date 本地 YYYY-MM-DD 與 bar key 本地 getMonth 無 UTC 漂移', () => {
    // 月初第一日喺 UTC+N 時區若用 UTC 會漂去上月；本函式用本地 slice + 本地 getMonth
    const merged: MergedNote[] = [
      merge(note({ id: '1', date: '2026-04-01' }), meta({ id: '1' })),
    ]
    const bars = monthlyMeetingBars(merged)
    const byKey = Object.fromEntries(bars.map((b) => [b.key, b.count]))
    expect(byKey['2026-04']).toBe(1)
    expect(byKey['2026-03']).toBe(0)
  })
})

// ════════════════════════════════════════════════════════════
//  noteToPlainText — 拼接邊界
// ════════════════════════════════════════════════════════════
describe('noteToPlainText — 拼接邊界', () => {
  it('最簡（無 time/location/attendees/decisions/actions）', () => {
    const txt = noteToPlainText(
      note({ title: '週會', date: '2026-05-04', content: '內容' }),
      meta({ type: 'staff' }),
    )
    expect(txt).toBe('週會\n教職員會議 · 2026-05-04\n\n內容')
  })

  it('空 decisions / actions → 唔加該段（無【議決】/【跟進行動】）', () => {
    const txt = noteToPlainText(
      note({ content: 'C' }),
      meta({ decisions: [], actions: [] }),
    )
    expect(txt).not.toContain('【議決】')
    expect(txt).not.toContain('【跟進行動】')
  })

  it('出席者用「、」連接', () => {
    const txt = noteToPlainText(
      note({ content: 'C' }),
      meta({ attendees: ['陳老師', '李主任', '黃Sir'] }),
    )
    expect(txt).toContain('出席：陳老師、李主任、黃Sir')
  })

  it('決議 1-based 編號', () => {
    const txt = noteToPlainText(
      note({ content: 'C' }),
      meta({ decisions: ['甲', '乙', '丙'] }),
    )
    expect(txt).toContain('【議決】\n1. 甲\n2. 乙\n3. 丙')
  })

  it('行動 done → [x]，未完成 → [ ]，owner/due 選填拼接', () => {
    const txt = noteToPlainText(
      note({ content: 'C' }),
      meta({
        actions: [
          action({ id: '1', text: '做嘢', owner: 'amy', due: '2026-06-01', done: true }),
          action({ id: '2', text: '齋文字', done: false }),
        ],
      }),
    )
    expect(txt).toContain('[x] 做嘢 @amy (2026-06-01)')
    expect(txt).toContain('[ ] 齋文字')
    // 無 owner / 無 due 嗰行唔應有 @ 或 ()
    const line = txt.split('\n').find((l) => l.includes('齋文字'))!
    expect(line).toBe('[ ] 齋文字')
  })

  it('帶 time → 日期行接時間', () => {
    const txt = noteToPlainText(note({ date: '2026-05-04', content: 'C' }), meta({ time: '09:30' }))
    expect(txt.split('\n')[1]).toContain('2026-05-04 09:30')
  })
})

// ════════════════════════════════════════════════════════════
//  buildPrintHtml — escape / 選填 row / 區段出現條件
// ════════════════════════════════════════════════════════════
describe('buildPrintHtml — escape / 選填 / 區段', () => {
  it('標題含 <>&" → 正確 escape（防 XSS）', () => {
    const html = buildPrintHtml({
      note: note({ title: '<script>"x"</script> & y', content: '' }),
      meta: meta(),
    })
    expect(html).toContain(
      '<h1>&lt;script&gt;&quot;x&quot;&lt;/script&gt; &amp; y</h1>',
    )
    expect(html).not.toContain('<h1><script>')
  })

  it('durationMin / time / location 選填 row 按資料出現', () => {
    const withRows = buildPrintHtml({
      note: note({ date: '2026-05-04', content: '' }),
      meta: meta({ durationMin: 90, time: '14:00', location: '禮堂' }),
    })
    expect(withRows).toContain('時長：</b>90 分鐘')
    expect(withRows).toContain('2026-05-04 14:00')
    expect(withRows).toContain('地點：</b>禮堂')

    const without = buildPrintHtml({ note: note({ content: '' }), meta: meta() })
    expect(without).not.toContain('時長：')
    expect(without).not.toContain('地點：')
  })

  it('出席者 escape + 「、」連接', () => {
    const html = buildPrintHtml({
      note: note({ content: '' }),
      meta: meta({ attendees: ['<陳>', '李'] }),
    })
    expect(html).toContain('出席：</b>&lt;陳&gt;、李')
  })

  it('行動 ☑/☐ + @owner +（due），owner/due escape', () => {
    const html = buildPrintHtml({
      note: note({ content: '' }),
      meta: meta({
        actions: [
          action({ id: '1', text: '提交', owner: 'b&b', due: '2026-07-01', done: true }),
          action({ id: '2', text: '待辦', done: false }),
        ],
      }),
    })
    expect(html).toContain('☑ 提交')
    expect(html).toContain('@b&amp;b')
    expect(html).toContain('（2026-07-01）')
    expect(html).toContain('☐ 待辦')
  })

  it('無決議 / 無行動 / 無標籤 → 唔出該段', () => {
    const html = buildPrintHtml({
      note: note({ content: '', tags: [] }),
      meta: meta({ decisions: [], actions: [] }),
    })
    expect(html).not.toContain('議決事項')
    expect(html).not.toContain('跟進行動')
    expect(html).not.toContain('class="tags"')
  })

  it('決議 / 行動 / 標籤段按資料出現', () => {
    const html = buildPrintHtml({
      note: note({ content: '', tags: ['期末', '緊急'] }),
      meta: meta({ decisions: ['通過預算'], actions: [action({ text: '跟進', done: false })] }),
    })
    expect(html).toContain('議決事項')
    expect(html).toContain('通過預算')
    expect(html).toContain('跟進行動')
    expect(html).toContain('#期末 #緊急')
  })
})
